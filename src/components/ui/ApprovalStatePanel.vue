<template>
    <v-card class="approval-state-panel" elevation="0">
        <!-- 현재 상태 표시 -->
        <v-card-title class="d-flex align-center pa-3 pb-2">
            <v-icon class="mr-2" size="20">mdi-clipboard-check-outline</v-icon>
            <span class="text-subtitle-1 font-weight-medium">{{ $t('approvalState.title') }}</span>
            <v-spacer />
            <v-chip
                :color="stateConfig.color"
                variant="tonal"
                size="small"
            >
                <v-icon start size="14">{{ stateConfig.icon }}</v-icon>
                {{ stateConfig.label }}
            </v-chip>
        </v-card-title>

        <v-divider />

        <!-- 상태 진행 표시 -->
        <v-card-text class="pa-3">
            <v-stepper
                v-model="currentStep"
                :items="stepItems"
                alt-labels
                hide-actions
                flat
                class="approval-stepper"
            >
                <template #item.1>
                    <div class="text-center pa-2">
                        <v-icon :color="getStepColor(1)" size="24">mdi-pencil</v-icon>
                        <div class="text-caption mt-1">{{ $t('approvalState.draft') }}</div>
                    </div>
                </template>
                <template #item.2>
                    <div class="text-center pa-2">
                        <v-icon :color="getStepColor(2)" size="24">mdi-eye</v-icon>
                        <div class="text-caption mt-1">{{ $t('approvalState.review') }}</div>
                    </div>
                </template>
                <template #item.3>
                    <div class="text-center pa-2">
                        <v-icon :color="getStepColor(3)" size="24">mdi-check</v-icon>
                        <div class="text-caption mt-1">{{ $t('approvalState.level1') }}</div>
                    </div>
                </template>
                <template #item.4>
                    <div class="text-center pa-2">
                        <v-icon :color="getStepColor(4)" size="24">mdi-check-all</v-icon>
                        <div class="text-caption mt-1">{{ $t('approvalState.level2') }}</div>
                    </div>
                </template>
                <template #item.5>
                    <div class="text-center pa-2">
                        <v-icon :color="getStepColor(5)" size="24">mdi-shield-check</v-icon>
                        <div class="text-caption mt-1">{{ $t('approvalState.confirmed') }}</div>
                    </div>
                </template>
            </v-stepper>

            <!-- 반려 상태 표시 -->
            <v-alert
                v-if="approvalState?.state === 'rejected'"
                type="error"
                variant="tonal"
                density="compact"
                class="mt-3"
            >
                <div class="text-subtitle-2">{{ $t('approvalState.rejectedBy') }}: {{ approvalState.rejected_by_name }}</div>
                <div class="text-body-2 mt-1">{{ approvalState.reject_comment }}</div>
            </v-alert>

            <!-- 상태 상세 정보 -->
            <div v-if="approvalState" class="mt-4">
                <div v-if="approvalState.submitted_at" class="d-flex align-center mb-2">
                    <v-icon size="16" class="mr-2" color="grey">mdi-send</v-icon>
                    <span class="text-caption text-grey">
                        {{ $t('approvalState.submittedBy') }}: {{ approvalState.submitted_by }}
                        ({{ formatDate(approvalState.submitted_at) }})
                    </span>
                </div>
                <div v-if="approvalState.reviewed_at_level1" class="d-flex align-center mb-2">
                    <v-icon size="16" class="mr-2" color="grey">mdi-check</v-icon>
                    <span class="text-caption text-grey">
                        {{ $t('approvalState.level1By') }}: {{ approvalState.reviewer_level1_name }}
                        ({{ formatDate(approvalState.reviewed_at_level1) }})
                    </span>
                </div>
                <div v-if="approvalState.reviewed_at_level2" class="d-flex align-center mb-2">
                    <v-icon size="16" class="mr-2" color="grey">mdi-check-all</v-icon>
                    <span class="text-caption text-grey">
                        {{ $t('approvalState.level2By') }}: {{ approvalState.reviewer_level2_name }}
                        ({{ formatDate(approvalState.reviewed_at_level2) }})
                    </span>
                </div>
                <div v-if="approvalState.confirmed_at" class="d-flex align-center mb-2">
                    <v-icon size="16" class="mr-2" color="grey">mdi-shield-check</v-icon>
                    <span class="text-caption text-grey">
                        {{ $t('approvalState.confirmedBy') }}: {{ approvalState.confirmed_by_name }}
                        ({{ formatDate(approvalState.confirmed_at) }})
                    </span>
                </div>
            </div>
        </v-card-text>

        <v-divider />

        <!-- 액션 버튼 -->
        <v-card-actions class="pa-3">
            <!-- 작성중 → 검토 요청 -->
            <v-btn
                v-if="canSubmitForReview"
                color="primary"
                variant="tonal"
                size="small"
                :loading="actionLoading"
                @click="openActionDialog('submit')"
            >
                <v-icon start>mdi-send</v-icon>
                {{ $t('approvalState.submitForReview') }}
            </v-btn>

            <!-- 검토중 → 1차 승인 -->
            <v-btn
                v-if="canApproveLevel1"
                color="success"
                variant="tonal"
                size="small"
                :loading="actionLoading"
                @click="openActionDialog('approve_level1')"
            >
                <v-icon start>mdi-check</v-icon>
                {{ $t('approvalState.approveLevel1') }}
            </v-btn>

            <!-- 1차 승인 → 2차 승인 -->
            <v-btn
                v-if="canApproveLevel2"
                color="success"
                variant="tonal"
                size="small"
                :loading="actionLoading"
                @click="openActionDialog('approve_level2')"
            >
                <v-icon start>mdi-check-all</v-icon>
                {{ $t('approvalState.approveLevel2') }}
            </v-btn>

            <!-- 2차 승인 → 확정 -->
            <v-btn
                v-if="canConfirm"
                color="success"
                variant="flat"
                size="small"
                :loading="actionLoading"
                @click="openActionDialog('confirm')"
            >
                <v-icon start>mdi-shield-check</v-icon>
                {{ $t('approvalState.confirm') }}
            </v-btn>

            <v-spacer />

            <!-- 반려 버튼 -->
            <v-btn
                v-if="canReject"
                color="error"
                variant="text"
                size="small"
                :loading="actionLoading"
                @click="openActionDialog('reject')"
            >
                <v-icon start>mdi-close-circle</v-icon>
                {{ $t('approvalState.reject') }}
            </v-btn>

            <!-- 재작성 버튼 -->
            <v-btn
                v-if="canReopen"
                color="warning"
                variant="text"
                size="small"
                :loading="actionLoading"
                @click="openActionDialog('reopen')"
            >
                <v-icon start>mdi-refresh</v-icon>
                {{ $t('approvalState.reopen') }}
            </v-btn>
        </v-card-actions>

        <!-- 이력 보기 버튼 -->
        <v-card-actions class="pa-3 pt-0">
            <v-btn
                variant="text"
                size="small"
                color="grey"
                @click="showHistory = !showHistory"
            >
                <v-icon start>mdi-history</v-icon>
                {{ $t('approvalState.viewHistory') }}
                <v-icon end>{{ showHistory ? 'mdi-chevron-up' : 'mdi-chevron-down' }}</v-icon>
            </v-btn>
        </v-card-actions>

        <!-- 이력 목록 -->
        <v-expand-transition>
            <div v-if="showHistory">
                <v-divider />
                <v-list density="compact" class="pa-0">
                    <v-list-item
                        v-for="item in history"
                        :key="item.id"
                        class="px-3"
                    >
                        <template #prepend>
                            <v-icon size="16" :color="getActionColor(item.action)">
                                {{ getActionIcon(item.action) }}
                            </v-icon>
                        </template>
                        <v-list-item-title class="text-body-2">
                            {{ getActionLabel(item.action) }}
                        </v-list-item-title>
                        <v-list-item-subtitle class="text-caption">
                            {{ item.actor_name }} · {{ formatDate(item.created_at) }}
                            <span v-if="item.comment"> - {{ item.comment }}</span>
                        </v-list-item-subtitle>
                    </v-list-item>
                    <v-list-item v-if="history.length === 0">
                        <v-list-item-title class="text-body-2 text-grey text-center">
                            {{ $t('approvalState.noHistory') }}
                        </v-list-item-title>
                    </v-list-item>
                </v-list>
            </div>
        </v-expand-transition>

        <!-- 액션 다이얼로그 -->
        <v-dialog v-model="actionDialog" max-width="400" persistent>
            <v-card>
                <v-card-title>{{ actionDialogTitle }}</v-card-title>
                <v-card-text>
                    <v-textarea
                        v-model="actionComment"
                        :label="$t('approvalState.comment')"
                        :placeholder="$t('approvalState.commentPlaceholder')"
                        variant="outlined"
                        rows="3"
                        :rules="actionType === 'reject' ? [v => !!v || $t('approvalState.commentRequired')] : []"
                    />
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn variant="text" @click="closeActionDialog">
                        {{ $t('approvalState.cancel') }}
                    </v-btn>
                    <v-btn
                        :color="actionType === 'reject' ? 'error' : 'primary'"
                        variant="flat"
                        :disabled="actionType === 'reject' && !actionComment.trim()"
                        :loading="actionLoading"
                        @click="executeAction"
                    >
                        {{ $t('approvalState.confirm') }}
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </v-card>
</template>

<script lang="ts">
import { defineComponent, ref, computed, watch, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { formatDistanceToNow } from 'date-fns';
import { ko, enUS } from 'date-fns/locale';
import BackendFactory from '@/components/api/BackendFactory';

export default defineComponent({
    name: 'ApprovalStatePanel',
    props: {
        procDefId: {
            type: String,
            required: true
        }
    },
    emits: ['stateChanged'],
    setup(props, { emit }) {
        const { t } = useI18n();
        const backend = BackendFactory.createBackend();

        const approvalState = ref<any>(null);
        const history = ref<any[]>([]);
        const loading = ref(false);
        const actionLoading = ref(false);
        const showHistory = ref(false);

        const actionDialog = ref(false);
        const actionType = ref('');
        const actionComment = ref('');

        // 상태별 설정
        const stateConfigs: Record<string, { color: string; icon: string; labelKey: string; step: number }> = {
            draft: { color: 'grey', icon: 'mdi-pencil', labelKey: 'approvalState.draft', step: 1 },
            review: { color: 'warning', icon: 'mdi-eye', labelKey: 'approvalState.review', step: 2 },
            approved_level1: { color: 'info', icon: 'mdi-check', labelKey: 'approvalState.level1', step: 3 },
            approved_level2: { color: 'info', icon: 'mdi-check-all', labelKey: 'approvalState.level2', step: 4 },
            confirmed: { color: 'success', icon: 'mdi-shield-check', labelKey: 'approvalState.confirmed', step: 5 },
            rejected: { color: 'error', icon: 'mdi-close-circle', labelKey: 'approvalState.rejected', step: 0 }
        };

        const stateConfig = computed(() => {
            const state = approvalState.value?.state || 'draft';
            const config = stateConfigs[state] || stateConfigs.draft;
            return {
                ...config,
                label: t(config.labelKey)
            };
        });

        const currentStep = computed(() => stateConfig.value.step);

        const stepItems = [
            { title: '', value: 1 },
            { title: '', value: 2 },
            { title: '', value: 3 },
            { title: '', value: 4 },
            { title: '', value: 5 }
        ];

        const getStepColor = (step: number) => {
            if (approvalState.value?.state === 'rejected') return 'grey';
            return currentStep.value >= step ? 'primary' : 'grey-lighten-2';
        };

        // 권한 체크 (간단한 버전 - 실제로는 권한 시스템 연동 필요)
        const canSubmitForReview = computed(() => {
            const state = approvalState.value?.state || 'draft';
            return state === 'draft';
        });

        const canApproveLevel1 = computed(() => {
            return approvalState.value?.state === 'review';
        });

        const canApproveLevel2 = computed(() => {
            return approvalState.value?.state === 'approved_level1';
        });

        const canConfirm = computed(() => {
            return approvalState.value?.state === 'approved_level2';
        });

        const canReject = computed(() => {
            const state = approvalState.value?.state;
            return state && ['review', 'approved_level1', 'approved_level2'].includes(state);
        });

        const canReopen = computed(() => {
            return approvalState.value?.state === 'rejected';
        });

        const actionDialogTitle = computed(() => {
            const titles: Record<string, string> = {
                submit: t('approvalState.submitForReview'),
                approve_level1: t('approvalState.approveLevel1'),
                approve_level2: t('approvalState.approveLevel2'),
                confirm: t('approvalState.confirm'),
                reject: t('approvalState.reject'),
                reopen: t('approvalState.reopen')
            };
            return titles[actionType.value] || '';
        });

        const formatDate = (dateStr: string): string => {
            if (!dateStr) return '';
            try {
                const locale = window.$lang === 'ko' ? ko : enUS;
                return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale });
            } catch {
                return dateStr;
            }
        };

        const getActionIcon = (action: string): string => {
            const icons: Record<string, string> = {
                submit: 'mdi-send',
                approve_level1: 'mdi-check',
                approve_level2: 'mdi-check-all',
                confirm: 'mdi-shield-check',
                reject: 'mdi-close-circle',
                reopen: 'mdi-refresh'
            };
            return icons[action] || 'mdi-circle';
        };

        const getActionColor = (action: string): string => {
            const colors: Record<string, string> = {
                submit: 'primary',
                approve_level1: 'success',
                approve_level2: 'success',
                confirm: 'success',
                reject: 'error',
                reopen: 'warning'
            };
            return colors[action] || 'grey';
        };

        const getActionLabel = (action: string): string => {
            const labels: Record<string, string> = {
                submit: t('approvalState.actionSubmit'),
                approve_level1: t('approvalState.actionApprove1'),
                approve_level2: t('approvalState.actionApprove2'),
                confirm: t('approvalState.actionConfirm'),
                reject: t('approvalState.actionReject'),
                reopen: t('approvalState.actionReopen')
            };
            return labels[action] || action;
        };

        const loadApprovalState = async () => {
            if (!props.procDefId) return;

            loading.value = true;
            try {
                approvalState.value = await backend.getApprovalState(props.procDefId);
                history.value = await backend.getApprovalHistory(props.procDefId);
            } catch (e) {
                console.error('승인 상태 로드 실패:', e);
            } finally {
                loading.value = false;
            }
        };

        const openActionDialog = (type: string) => {
            actionType.value = type;
            actionComment.value = '';
            actionDialog.value = true;
        };

        const closeActionDialog = () => {
            actionDialog.value = false;
            actionType.value = '';
            actionComment.value = '';
        };

        const executeAction = async () => {
            actionLoading.value = true;
            try {
                const comment = actionComment.value.trim() || undefined;

                switch (actionType.value) {
                    case 'submit':
                        await backend.submitForReview(props.procDefId, comment);
                        break;
                    case 'approve_level1':
                        await backend.approveLevel1(props.procDefId, comment);
                        break;
                    case 'approve_level2':
                        await backend.approveLevel2(props.procDefId, comment);
                        break;
                    case 'confirm':
                        await backend.confirmDefinition(props.procDefId, comment);
                        break;
                    case 'reject':
                        await backend.rejectDefinition(props.procDefId, comment!);
                        break;
                    case 'reopen':
                        await backend.reopenDefinition(props.procDefId, comment);
                        break;
                }

                closeActionDialog();
                await loadApprovalState();
                emit('stateChanged', approvalState.value);
            } catch (e) {
                console.error('액션 실행 실패:', e);
            } finally {
                actionLoading.value = false;
            }
        };

        watch(() => props.procDefId, () => {
            loadApprovalState();
        }, { immediate: true });

        return {
            approvalState,
            history,
            loading,
            actionLoading,
            showHistory,
            actionDialog,
            actionType,
            actionComment,
            stateConfig,
            currentStep,
            stepItems,
            getStepColor,
            canSubmitForReview,
            canApproveLevel1,
            canApproveLevel2,
            canConfirm,
            canReject,
            canReopen,
            actionDialogTitle,
            formatDate,
            getActionIcon,
            getActionColor,
            getActionLabel,
            openActionDialog,
            closeActionDialog,
            executeAction
        };
    }
});
</script>

<style scoped>
.approval-state-panel {
    border: none;
}

.approval-stepper {
    background: transparent !important;
}

.approval-stepper :deep(.v-stepper-item) {
    padding: 8px 4px;
}

.approval-stepper :deep(.v-stepper__step) {
    padding: 4px;
}
</style>
