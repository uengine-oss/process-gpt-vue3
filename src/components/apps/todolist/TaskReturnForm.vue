<template>
    <v-card>
        <v-card-title class="d-flex align-center">
            <span>{{ $t('TaskReturn.title') }}</span>
            <v-spacer></v-spacer>
            <v-btn icon variant="text" @click="$emit('close')">
                <v-icon>mdi-close</v-icon>
            </v-btn>
        </v-card-title>

        <v-divider></v-divider>

        <v-card-text class="pt-4">
            <v-skeleton-loader v-if="isLoadingEligibility" type="paragraph, paragraph"></v-skeleton-loader>

            <template v-else>
                <v-alert
                    v-if="eligibility && eligibility.enabled === false"
                    density="compact"
                    type="warning"
                    variant="tonal"
                    class="mb-4"
                >
                    <div class="text-body-2">
                        {{ eligibility.reason || $t('TaskReturn.notAllowed') }}
                    </div>
                </v-alert>

                <div v-if="candidates.length > 0" class="mb-3">
                    <div class="text-body-2 text-medium-emphasis mb-2">
                        {{ $t('TaskReturn.selectTarget') }}
                    </div>

                    <div class="task-return-candidates">
                        <v-row class="ma-0 pa-0" dense>
                            <v-col
                                v-for="c in candidates"
                                :key="c.key"
                                cols="12"
                                sm="6"
                                md="6"
                                class="pa-1"
                            >
                                <v-card
                                    class="task-return-tile"
                                    :class="{
                                        'task-return-tile--selected': c.key === selectedCandidateKey,
                                        'task-return-tile--disabled': !eligibility || eligibility.enabled !== true
                                    }"
                                    variant="outlined"
                                    @click="selectCandidate(c.key)"
                                >
                                    <v-card-text class="py-3">
                                        <div class="d-flex align-start">
                                            <div class="flex-grow-1">
                                                <div class="text-subtitle-2 font-weight-medium">
                                                    {{ candidateTitle(c.raw) }}
                                                </div>
                                                <div class="text-caption text-medium-emphasis">
                                                    {{ candidateSubtitle(c.raw) }}
                                                </div>
                                            </div>
                                            <v-icon
                                                v-if="c.key === selectedCandidateKey"
                                                color="primary"
                                                class="ml-2"
                                            >
                                                mdi-check-circle
                                            </v-icon>
                                        </div>
                                    </v-card-text>
                                </v-card>
                            </v-col>
                        </v-row>
                    </div>
                </div>

                <v-textarea
                    v-model="reason"
                    :label="$t('TaskReturn.reason')"
                    variant="outlined"
                    density="compact"
                    rows="3"
                    auto-grow
                    :placeholder="$t('TaskReturn.reasonPlaceholder')"
                />
            </template>
        </v-card-text>

        <v-divider></v-divider>

        <v-card-actions class="pa-4">
            <v-spacer></v-spacer>
            <v-btn variant="text" @click="$emit('close')">{{ $t('TaskReturn.cancel') }}</v-btn>
            <v-btn
                color="warning"
                rounded
                variant="flat"
                :disabled="!canSubmit"
                :loading="isSubmitting"
                :class="{ 'task-return-submit--pulse': submitPulse }"
                @click="submitReturn"
            >
                {{ $t('TaskReturn.submit') }}
            </v-btn>
        </v-card-actions>
    </v-card>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();

export default {
    name: 'TaskReturnForm',
    props: {
        taskId: {
            type: [String, Number],
            required: true
        },
        workItem: {
            type: Object,
            default: () => null
        }
    },
    data: () => ({
        eligibility: null,
        isLoadingEligibility: false,
        isSubmitting: false,
        reason: '',
        candidates: [],
        selectedCandidateKey: null,
        submitPulse: false
    }),
    computed: {
        selectedCandidate() {
            const found = this.candidates.find((c) => c.key === this.selectedCandidateKey);
            return found ? found.raw : null;
        },
        canSubmit() {
            if (this.isSubmitting) return false;
            if (!this.eligibility || this.eligibility.enabled !== true) return false;
            // 후보가 내려오는 경우, 선택이 필수
            if (this.candidates.length > 0 && !this.selectedCandidateKey) return false;
            return true;
        }
    },
    watch: {
        canSubmit(newVal, oldVal) {
            if (newVal === true && oldVal === false) {
                this.submitPulse = true;
                setTimeout(() => {
                    this.submitPulse = false;
                }, 650);
            }
        }
    },
    mounted() {
        this.loadEligibility();
    },
    methods: {
        normalizeCandidates(rawCandidates) {
            if (!Array.isArray(rawCandidates)) return [];
            return rawCandidates
                .map((c, idx) => {
                    const activityName = c.activityName || c.activity_name || c.name || c.tracingTag || c.trcTag || '';
                    const endpoint = c.endpoint || c.userId || c.user_id || c.email || '';
                    const labelParts = [];
                    if (activityName) labelParts.push(activityName);
                    if (endpoint) labelParts.push(endpoint);
                    const label = labelParts.length > 0 ? labelParts.join(' / ') : `#${idx + 1}`;
                    return {
                        key: String(c.taskId || c.task_id || c.tracingTag || c.trcTag || idx),
                        label,
                        raw: c
                    };
                })
                .filter((x) => x && x.key);
        },
        selectCandidate(key) {
            if (!this.eligibility || this.eligibility.enabled !== true) return;
            this.selectedCandidateKey = key;
        },
        candidateTitle(raw) {
            return (
                raw?.activityName ||
                raw?.activity_name ||
                raw?.name ||
                raw?.tracingTag ||
                raw?.trcTag ||
                '(이름 없음)'
            );
        },
        candidateSubtitle(raw) {
            const endpoint = raw?.endpoint || raw?.userId || raw?.user_id || raw?.email || '';
            const taskId = raw?.taskId || raw?.task_id || '';
            const parts = [];
            if (endpoint) parts.push(endpoint);
            if (taskId !== '') parts.push(`#${taskId}`);
            return parts.join(' · ');
        },
        async loadEligibility() {
            const me = this;
            me.isLoadingEligibility = true;
            me.eligibility = null;
            me.candidates = [];
            me.selectedCandidateKey = null;

            const taskId = String(me.taskId);
            try {
                const res = await backend.getTaskReturnAvailability(taskId);
                // 예상 shape:
                // { enabled: boolean, reason?: string, candidates?: [...] }
                me.eligibility = res || { enabled: false, reason: me.$t('TaskReturn.notAllowed') };
                const candidates = me.normalizeCandidates(res?.candidates || res?.targets || res?.previous || []);
                me.candidates = candidates;
                if (candidates.length > 0) {
                    me.selectedCandidateKey = candidates[0].key;
                }
            } catch (err) {
                const status =
                    err?.response?.status ||
                    err?.status ||
                    err?.code ||
                    null;

                // 404 포함: 사용자에게 "불러올 수 없습니다" 표시
                me.eligibility = {
                    enabled: false,
                    reason: me.$t('TaskReturn.fetchFailed')
                };
                me.candidates = [];
                me.selectedCandidateKey = null;

                // 다른 에러라도 UI가 깨지지 않도록만 처리하고, 필요 시 콘솔로 확인
                // eslint-disable-next-line no-console
                console.warn('[TaskReturnForm] getTaskReturnAvailability failed:', status, err);
            }

            me.isLoadingEligibility = false;
        },
        async submitReturn() {
            const me = this;
            me.$try({
                context: me,
                action: async () => {
                    me.isSubmitting = true;
                    const taskId = String(me.taskId);
                    const selected = me.selectedCandidate || {};

                    const payload = {
                        taskId: selected.taskId ?? selected.task_id ?? null,
                        tracingTag: selected.tracingTag ?? selected.trcTag ?? null,
                        execScope: selected.execScope ?? null,
                        reason: me.reason || null
                    };

                    const res = await backend.returnTask(taskId, payload);
                    me.$emit('returned', res);
                },
                successMsg: me.$t('successMsg.taskReturned')
            });
            me.isSubmitting = false;
        }
    }
};
</script>

<style scoped>
.task-return-candidates {
    max-height: 240px;
    overflow-y: auto;
    padding-right: 4px; /* scrollbar 공간 */
}

.task-return-tile {
    border-radius: 12px;
    background: #fff8e1; /* 부드러운 크림톤 */
    border-color: rgba(0, 0, 0, 0.12);
    transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease, background 160ms ease;
    cursor: pointer;
}

.task-return-tile:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.08);
}

.task-return-tile--selected {
    border-color: rgba(var(--v-theme-primary), 1);
    box-shadow: 0 10px 24px rgba(var(--v-theme-primary), 0.18);
    background: rgba(var(--v-theme-primary), 0.06);
}

.task-return-tile--disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

@keyframes taskReturnPulse {
    0% {
        transform: scale(1);
        box-shadow: 0 0 0 rgba(0, 0, 0, 0);
    }
    45% {
        transform: scale(1.04);
        box-shadow: 0 10px 26px rgba(255, 152, 0, 0.25);
    }
    100% {
        transform: scale(1);
        box-shadow: 0 0 0 rgba(0, 0, 0, 0);
    }
}

.task-return-submit--pulse {
    animation: taskReturnPulse 650ms ease;
}
</style>

