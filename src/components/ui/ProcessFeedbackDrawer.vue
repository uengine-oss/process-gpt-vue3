<template>
    <v-navigation-drawer
        :model-value="modelValue"
        location="right"
        temporary
        width="480"
        class="process-feedback-drawer"
        @update:model-value="(v) => $emit('update:modelValue', v)"
    >
        <div class="drawer-root">
            <div class="drawer-header">
                <v-icon size="20" color="primary" class="mr-2">mdi-clipboard-text-outline</v-icon>
                <span class="drawer-title">{{ activityName || $t('ProcessFeedbackDrawer.title') }}</span>
                <v-chip v-if="statusLabel" size="x-small" color="success" variant="tonal" class="ml-2">{{ statusLabel }}</v-chip>
                <v-spacer />
                <v-btn icon variant="text" density="comfortable" @click="close">
                    <v-icon size="20">mdi-close</v-icon>
                </v-btn>
            </div>

            <div class="drawer-body">
                <div v-if="isLoading" class="pa-4">
                    <v-skeleton-loader type="heading, paragraph" />
                </div>

                <template v-else>
                    <!-- 산출물: workItem.worklist.output에 저장된 이 단계 자신의 제출 데이터
                         (FormWorkItem.vue의 loadForm()과 동일한 방식 — 채팅 메시지가 아니라
                         workitem 레코드 자체에서 읽는다) -->
                    <section class="drawer-section">
                        <div class="drawer-section-title">
                            <v-icon size="16" color="primary" class="mr-1">mdi-file-document-outline</v-icon>
                            {{ $t('ProcessInstanceTable.userInput') }}
                        </div>
                        <v-card variant="outlined" class="drawer-card output-card">
                            <div v-if="formHtml" class="pa-4">
                                <DynamicForm :formHTML="formHtml" :readonly="true" :modelValue="formData" />
                            </div>
                            <div v-else class="pa-6 text-center text-medium-emphasis text-caption">
                                <v-icon size="28" class="mb-2 d-block mx-auto">mdi-file-outline</v-icon>
                                {{ $t('ProcessInstanceTable.noFormContent') }}
                            </div>
                        </v-card>
                    </section>

                    <!-- 이 단계에 대한 피드백 -->
                    <section class="drawer-section">
                        <div class="drawer-section-title">
                            <v-icon size="16" color="primary" class="mr-1">mdi-comment-question-outline</v-icon>
                            {{ $t('ProcessInstanceTable.stepFeedback') }}
                        </div>
                        <v-card v-if="!showFeedbackInput" variant="outlined" class="drawer-card feedback-prompt-card">
                            <div class="d-flex align-center justify-space-between pa-3">
                                <span class="text-body-2 text-medium-emphasis">{{ $t('ProcessFeedbackDrawer.rateStep') }}</span>
                                <div class="d-flex" style="gap: 8px">
                                    <v-btn variant="tonal" size="small" color="success" class="rounded-pill" @click="selectGood">
                                        <v-icon start size="small">mdi-thumb-up</v-icon>
                                        Good
                                    </v-btn>
                                    <v-btn
                                        variant="tonal"
                                        size="small"
                                        color="error"
                                        class="rounded-pill"
                                        @click="showFeedbackInput = true"
                                    >
                                        <v-icon start size="small">mdi-thumb-down</v-icon>
                                        Bad
                                    </v-btn>
                                </div>
                            </div>
                        </v-card>
                        <v-card v-else variant="flat" class="drawer-card">
                            <ProcessFeedback
                                :task="task"
                                @closeFeedback="showFeedbackInput = false"
                                @startCompare="(payload) => $emit('startCompare', payload)"
                            />
                        </v-card>
                    </section>
                </template>
            </div>
        </div>
    </v-navigation-drawer>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
import DynamicForm from '@/components/designer/DynamicForm.vue';
import ProcessFeedback from '@/components/ui/ProcessFeedback.vue';

const backend = BackendFactory.createBackend();

export default {
    name: 'ProcessFeedbackDrawer',
    components: { DynamicForm, ProcessFeedback },
    props: {
        modelValue: Boolean,
        instanceId: String,
        activityId: String
    },
    data() {
        return {
            isLoading: false,
            task: null,
            workItemDetail: null,
            formDefId: null,
            formHtml: null,
            formData: {},
            showFeedbackInput: false
        };
    },
    computed: {
        activityName() {
            return (this.workItemDetail && this.workItemDetail.activity && this.workItemDetail.activity.name) || '';
        },
        statusLabel() {
            const status = this.workItemDetail && this.workItemDetail.worklist && this.workItemDetail.worklist.status;
            if (!status) return '';
            return status === 'COMPLETED' || status === 'DONE' ? this.$t('ProcessFeedbackDrawer.completed') : '';
        }
    },
    watch: {
        async modelValue(open) {
            if (open) {
                await this.load();
            } else {
                this.showFeedbackInput = false;
            }
        }
    },
    methods: {
        close() {
            this.$emit('update:modelValue', false);
        },
        async load() {
            if (!this.instanceId || !this.activityId) return;
            this.isLoading = true;
            this.workItemDetail = null;
            this.formHtml = null;
            this.formData = {};
            this.showFeedbackInput = false;
            try {
                this.task = await backend.getWorkItemByActivity(this.instanceId, this.activityId);
                if (this.task && this.task.id) {
                    this.workItemDetail = await backend.getWorkItem(this.task.id);
                    await this.loadOutput();
                }
            } finally {
                this.isLoading = false;
            }
        },
        // FormWorkItem.vue의 init()/loadForm()과 동일한 규칙: activity.tool(또는 worklist.tool)의
        // formHandler:<formDefId>에서 폼을 찾고, 완료된 workitem이면 worklist.output에 저장된
        // 제출 데이터를 그대로 보여준다.
        async loadOutput() {
            const detail = this.workItemDetail;
            if (!detail) return;

            const tool = (detail.activity && detail.activity.tool) || (detail.worklist && detail.worklist.tool) || '';
            this.formDefId = tool.includes('formHandler:') ? tool.split('formHandler:')[1] : 'defaultform';

            let html = null;
            try {
                const formInfo = await backend.getFormFields(this.formDefId);
                html = (formInfo && formInfo.html) || null;
            } catch (e) {
                console.warn('[ProcessFeedbackDrawer] getFormFields failed:', e);
            }
            if (!html) {
                try {
                    html = await backend.getRawDefinition(this.formDefId, { type: 'form' });
                } catch (e) {
                    console.warn('[ProcessFeedbackDrawer] getRawDefinition(form) failed:', e);
                }
            }
            this.formHtml = html;

            const output = detail.worklist && detail.worklist.output;
            if (output) {
                this.formData = this.formDefId === 'defaultform' ? output['defaultForm'] || {} : output[this.formDefId] || {};
            } else {
                this.formData = {};
            }
        },
        async selectGood() {
            if (this.task && this.task.id) {
                try {
                    await backend.saveFeedback('good', this.task.id);
                } catch (e) {
                    console.error('Failed to save feedback:', e);
                }
            }
        }
    }
};
</script>

<style scoped>
.drawer-root {
    height: 100%;
    display: flex;
    flex-direction: column;
}

.drawer-header {
    flex: none;
    display: flex;
    align-items: center;
    padding: 14px 16px;
    border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.drawer-title {
    font-size: 15px;
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.drawer-body {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
}

.drawer-section {
    margin-bottom: 20px;
}

.drawer-section:last-child {
    margin-bottom: 0;
}

.drawer-section-title {
    display: flex;
    align-items: center;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.02em;
    color: rgba(var(--v-theme-on-surface), 0.6);
    text-transform: uppercase;
    margin-bottom: 8px;
}

.drawer-card {
    border-radius: 10px !important;
    overflow: hidden;
    background-color: rgb(var(--v-theme-surface));
}

.output-card :deep(.dynamic-form) {
    margin-bottom: 0;
}

.feedback-prompt-card {
    background-color: rgba(var(--v-theme-primary), 0.03) !important;
}
</style>
