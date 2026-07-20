<template>
    <v-card class="process-feedback" flat>
        <v-card-text v-if="isApplyMode" class="pa-1">
            <div class="d-flex justify-start align-center mb-1">
                <v-icon>mdi-information</v-icon>
                <span class="text-h6 ml-2">{{ $t('ProcessFeedback.applyTitle') }}</span>
            </div>
            <v-skeleton-loader v-if="isGenerating || isSubmitting" type="image" class="mx-auto"></v-skeleton-loader>

            <!-- 개선안 생성 실패 -->
            <v-alert v-else-if="diffError" type="error" variant="tonal" density="compact" class="mb-2">
                {{ $t('ProcessFeedback.diffError') }}
                <div class="text-caption mt-1">{{ diffError }}</div>
            </v-alert>

            <!-- 변경 사항 없음 -->
            <v-card v-else-if="!hasChanges" class="mb-2" elevation="0" variant="outlined">
                <v-card-text class="text-center py-4">
                    <v-icon class="mr-2">mdi-information</v-icon>
                    {{ $t('ProcessFeedback.noChanges') }}
                </v-card-text>
            </v-card>

            <!-- 개선안 준비됨: 요약 + 비교 다이얼로그 진입 -->
            <v-card v-else class="mb-2 ready-card" elevation="0" variant="outlined">
                <v-card-text>
                    <div v-if="summary" class="text-body-2 mb-2">{{ summary }}</div>
                    <div class="text-caption text-medium-emphasis mb-3">
                        {{ $t('ProcessFeedback.changesCount', { count: changes.length }) }}
                    </div>
                    <v-btn color="primary" variant="elevated" class="rounded-pill" block @click="startCompareReview">
                        <v-icon start size="18">mdi-file-compare</v-icon>
                        {{ $t('ProcessFeedback.reviewButton') }}
                    </v-btn>
                </v-card-text>
            </v-card>

            <v-row v-if="!isGenerating && !isSubmitting" class="ma-0 pa-0 mt-2">
                <v-spacer></v-spacer>
                <v-btn @click="closeFeedback" color="gray" variant="elevated" class="rounded-pill" density="compact">{{
                    $t('Common.cancel')
                }}</v-btn>
            </v-row>
        </v-card-text>

        <v-card-text v-else class="pa-1">
            <div class="d-flex justify-start align-center mb-2">
                <v-icon size="small">mdi-information-outline</v-icon>
                <span class="text-body-1 font-weight-bold ml-2">{{ $t('ProcessFeedback.inputTitle') }}</span>
                <div class="ml-auto d-flex align-center">
                    <v-btn
                        icon
                        variant="text"
                        density="compact"
                        :loading="isGenerating"
                        :disabled="isGenerating || !task"
                        @click="getFeedback"
                    >
                        <Icons :icon="'magic'" :size="20" />
                    </v-btn>
                    <v-tooltip activator="parent" location="left">
                        <span>{{ $t('ProcessFeedback.autoGenerate') }}</span>
                    </v-tooltip>
                </div>
            </div>

            <v-textarea
                v-model="feedbackValue"
                :label="$t('ProcessFeedback.feedbackLabel')"
                :disabled="isGenerating || isSubmitting"
                rows="3"
                hide-details
            />
            <div class="d-flex justify-end align-center mt-4">
                <v-btn
                    @click="closeFeedback"
                    color="gray"
                    variant="elevated"
                    class="rounded-pill mr-2"
                    density="compact"
                    :disabled="isSubmitting"
                >
                    {{ $t('Common.cancel') }}
                </v-btn>
                <v-btn
                    @click="submitFeedback"
                    :disabled="!feedbackValue"
                    color="primary"
                    variant="elevated"
                    class="rounded-pill"
                    density="compact"
                    :loading="isSubmitting"
                >
                    {{ $t('Common.submit') }}
                </v-btn>
            </div>
        </v-card-text>
    </v-card>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
import BPMNXmlGenerator from '@/components/BPMNXmlGenerator.vue';
import { computeBpmnDiff } from '@/composables/useBpmnDiff';
const backend = BackendFactory.createBackend();

export default {
    // createBpmnXml(jsonModel)만 필요 — BPMNXmlGenerator는 mounted/EventBus 구독이 없는
    // 순수 유틸리티 mixin이라 부작용 없이 재사용 가능하다.
    mixins: [BPMNXmlGenerator],
    props: {
        lastMessage: Object,
        task: Object
    },
    data() {
        return {
            isGenerating: false,
            isSubmitting: false,
            isApplyMode: false,
            feedbackValue: null,
            feedbackText: '',

            // 노드 단위 개선안 검토 상태
            beforeXml: '',
            afterXml: '',
            summary: '',
            changes: [],
            diffActivitiesA: {},
            diffActivitiesB: {},
            diffError: null
        };
    },
    computed: {
        isMobile() {
            return window.innerWidth <= 768;
        },
        hasChanges() {
            return this.changes.length > 0;
        }
    },
    mounted() {
        this.isApplyMode = false;
    },
    methods: {
        closeFeedback() {
            this.$emit('closeFeedback');
        },

        async getFeedback() {
            if (!this.task || this.isGenerating) {
                return;
            }
            this.isGenerating = true;
            this.feedbackValue = null;
            const obj = {
                processDefinitionId: this.task.procDefId,
                activityId: this.task.activityId,
                taskId: this.task.id
            };
            try {
                const items = await backend.getFeedback(obj);
                if (items && items.length > 0) {
                    this.feedbackValue = items[0];
                } else {
                    this.feedbackValue = '';
                }
            } finally {
                this.isGenerating = false;
            }
        },
        async submitFeedback() {
            if (this.feedbackValue) {
                if (this.feedbackValue == 'etc') {
                    this.feedbackValue = this.feedbackText;
                }
                this.isSubmitting = true;
                await backend.saveFeedback(this.feedbackValue, this.task.id);
                await this.getFeedbackDiff();
                this.isSubmitting = false;
            }
        },
        async getFeedbackDiff() {
            this.diffError = null;
            this.changes = [];
            this.diffActivitiesA = {};
            this.diffActivitiesB = {};

            const diff = await backend.getFeedbackDiff(this.task.id);
            this.summary = diff && diff.summary ? diff.summary : '';

            if (!diff || !diff.jsonModel) {
                this.closeFeedback();
                return;
            }

            try {
                this.afterXml = this.createBpmnXml(diff.jsonModel);
            } catch (e) {
                console.error('[ProcessFeedback] createBpmnXml(jsonModel) failed:', e);
                this.diffError = e && e.message ? e.message : String(e);
                this.isApplyMode = true;
                return;
            }

            try {
                this.beforeXml = await backend.getRawDefinition(this.task.procDefId, {
                    type: 'bpmn',
                    version: this.task.version
                });
            } catch (e) {
                console.error('[ProcessFeedback] failed to load current snapshot for diff:', e);
                this.diffError = e && e.message ? e.message : String(e);
                this.isApplyMode = true;
                return;
            }

            const result = computeBpmnDiff(this.beforeXml, this.afterXml);
            this.changes = result.changes;
            this.diffActivitiesA = result.diffActivitiesA;
            this.diffActivitiesB = result.diffActivitiesB;

            this.isApplyMode = true;
        },
        // 비교 UI는 이 컴포넌트(우측 드로어) 안에 두기엔 좌우 다이어그램을 위한 공간이 부족하다.
        // 실제 좌우 비교/체크박스/반영 처리는 InstanceProgress.vue가 메인 다이어그램 자리에서 담당한다.
        startCompareReview() {
            this.$emit('startCompare', {
                task: this.task,
                beforeXml: this.beforeXml,
                afterXml: this.afterXml,
                changes: this.changes,
                diffActivitiesA: this.diffActivitiesA,
                diffActivitiesB: this.diffActivitiesB,
                summary: this.summary
            });
        }
    }
};
</script>

<style scoped>
.ready-card {
    background-color: rgba(var(--v-theme-primary), 0.03);
}
</style>
