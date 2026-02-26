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

        <!-- 상태 진행 표시 (새 거버넌스 워크플로우) -->
        <v-card-text class="pa-3">
            <div class="governance-pipeline d-flex align-center justify-space-between">
                <div
                    v-for="(step, idx) in pipelineSteps"
                    :key="step.key"
                    class="pipeline-step text-center"
                    :class="{ active: currentStepIndex >= idx, current: currentStepIndex === idx }"
                >
                    <v-icon
                        :color="currentStepIndex >= idx ? 'primary' : 'grey-lighten-2'"
                        size="22"
                    >{{ step.icon }}</v-icon>
                    <div class="text-caption mt-1" :class="currentStepIndex === idx ? 'font-weight-bold text-primary' : 'text-grey'">
                        {{ step.label }}
                    </div>
                    <v-icon
                        v-if="idx < pipelineSteps.length - 1"
                        size="14"
                        color="grey-lighten-1"
                        class="pipeline-arrow"
                    >mdi-chevron-right</v-icon>
                </div>
            </div>

            <!-- 병렬 승인 상태 (in_review 단계) -->
            <div v-if="approvalState?.state === 'in_review'" class="mt-3">
                <div class="text-caption font-weight-medium mb-2">{{ $t('approvalState.parallelReview') }}</div>
                <div class="d-flex ga-2">
                    <v-chip
                        :color="hqChipColor"
                        variant="tonal"
                        size="small"
                    >
                        <v-icon start size="14">{{ hqChipIcon }}</v-icon>
                        HQ: {{ hqStatusLabel }}
                    </v-chip>
                    <v-chip
                        :color="fieldChipColor"
                        variant="tonal"
                        size="small"
                    >
                        <v-icon start size="14">{{ fieldChipIcon }}</v-icon>
                        Field: {{ fieldStatusLabel }}
                    </v-chip>
                </div>
            </div>

            <!-- 공람 D-day 표시 (Phase 3-3 enhanced) -->
            <v-alert
                v-if="approvalState?.state === 'public_feedback' && publicFeedbackDday"
                :type="isPublicFeedbackExpired ? 'error' : 'info'"
                variant="tonal"
                density="compact"
                class="mt-3"
            >
                <div class="d-flex align-center gap-2">
                    <span class="text-subtitle-2">
                        {{ $t('approvalState.publicFeedbackPeriod') }}
                    </span>
                    <v-chip
                        size="x-small"
                        :color="isPublicFeedbackExpired ? 'error' : 'info'"
                        variant="flat"
                        class="font-weight-bold"
                    >
                        {{ publicFeedbackDday }}
                    </v-chip>
                </div>
            </v-alert>

            <!-- Phase 3-4: 미해결 피드백 목록 (final_edit 단계) -->
            <v-alert
                v-if="approvalState?.state === 'final_edit' && unresolvedComments.length > 0"
                type="error"
                variant="tonal"
                density="compact"
                class="mt-3"
            >
                <div class="text-subtitle-2 mb-1">
                    {{ $t('approvalState.unresolvedFeedbackBlock') }} ({{ unresolvedComments.length }})
                </div>
                <div
                    v-for="uc in unresolvedComments"
                    :key="uc.id"
                    class="d-flex align-center gap-1 mb-1 unresolved-comment-item"
                    @click="$emit('navigateToElement', uc.element_id)"
                >
                    <v-icon size="14" color="error">mdi-message-alert-outline</v-icon>
                    <span class="text-body-2 text-truncate" style="max-width: 200px;">
                        {{ uc.content || uc.comment || '—' }}
                    </span>
                    <v-icon size="12" color="grey" class="ml-auto">mdi-arrow-right</v-icon>
                </div>
            </v-alert>

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

            <!-- Re-open 요청 상태 -->
            <v-alert
                v-if="approvalState?.state === 'reopen_requested'"
                type="warning"
                variant="tonal"
                density="compact"
                class="mt-3"
            >
                <div class="text-subtitle-2">{{ $t('approvalState.reopenRequested') }}: {{ approvalState.reopen_requested_by }}</div>
                <div class="text-body-2 mt-1">{{ approvalState.reopen_reason }}</div>
            </v-alert>

            <!-- 버전 표시 (Major/Minor 라벨) -->
            <div v-if="approvalState" class="mt-3">
                <div class="d-flex align-center gap-2 flex-wrap">
                    <!-- Major/Minor 버전 라벨 -->
                    <div class="asp-version-badge" :class="isPublishedState ? 'asp-version-badge--major' : 'asp-version-badge--minor'">
                        <v-icon size="12" class="mr-1">mdi-tag-outline</v-icon>
                        {{ versionDisplayLabel }}
                    </div>
                    <!-- To-Be 파생 버튼 (Published 이후에만 활성화) -->
                    <v-tooltip location="bottom" :text="canDeriveToBase ? $t('approvalState.deriveToBe') : $t('approvalState.deriveToBeLockedHint')">
                        <template #activator="{ props: tp }">
                            <span v-bind="tp">
                                <v-btn
                                    size="x-small"
                                    :variant="canDeriveToBase ? 'tonal' : 'outlined'"
                                    :color="canDeriveToBase ? 'primary' : 'grey'"
                                    :disabled="!canDeriveToBase"
                                    class="asp-derive-btn"
                                    @click="$emit('deriveToBe', approvalState.proc_def_id || approvalState.id)"
                                >
                                    <v-icon start size="13">mdi-source-fork</v-icon>
                                    To-Be 파생
                                    <v-icon v-if="!canDeriveToBase" end size="12">mdi-lock-outline</v-icon>
                                </v-btn>
                            </span>
                        </template>
                    </v-tooltip>
                </div>
            </div>

            <!-- 상태 상세 정보 -->
            <div v-if="approvalState" class="mt-3">
                <div v-if="approvalState.submitted_at" class="d-flex align-center mb-2">
                    <v-icon size="16" class="mr-2" color="grey">mdi-send</v-icon>
                    <span class="text-caption text-grey">
                        {{ $t('approvalState.submittedBy') }}: {{ approvalState.submitted_by }}
                        ({{ formatDate(approvalState.submitted_at) }})
                    </span>
                </div>
                <div v-if="approvalState.hq_reviewed_at" class="d-flex align-center mb-2">
                    <v-icon size="16" class="mr-2" color="blue">mdi-domain</v-icon>
                    <span class="text-caption text-grey">
                        HQ: {{ approvalState.hq_reviewer_name }}
                        ({{ formatDate(approvalState.hq_reviewed_at) }})
                    </span>
                </div>
                <div v-if="approvalState.field_reviewed_at" class="d-flex align-center mb-2">
                    <v-icon size="16" class="mr-2" color="green">mdi-account-hard-hat</v-icon>
                    <span class="text-caption text-grey">
                        Field: {{ approvalState.field_reviewer_name }}
                        ({{ formatDate(approvalState.field_reviewed_at) }})
                    </span>
                </div>
                <div v-if="approvalState.published_at" class="d-flex align-center mb-2">
                    <v-icon size="16" class="mr-2" color="success">mdi-rocket-launch</v-icon>
                    <span class="text-caption text-grey">
                        {{ $t('approvalState.publishedBy') }}: {{ approvalState.published_by_name }}
                        ({{ formatDate(approvalState.published_at) }})
                    </span>
                </div>
            </div>
        </v-card-text>

        <v-divider />

        <!-- 액션 버튼 -->
        <v-card-actions class="pa-3 flex-wrap ga-1">
            <!-- Draft → 검토 요청 -->
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

            <!-- HQ 승인 -->
            <v-btn
                v-if="canApproveHQ"
                color="blue"
                variant="tonal"
                size="small"
                :loading="actionLoading"
                :disabled="isSelfApproval"
                @click="openActionDialog('approve_hq')"
            >
                <v-icon start>mdi-domain</v-icon>
                {{ $t('approvalState.approveHQ') }}
            </v-btn>

            <!-- Field 승인 -->
            <v-btn
                v-if="canApproveField"
                color="green"
                variant="tonal"
                size="small"
                :loading="actionLoading"
                :disabled="isSelfApproval"
                @click="openActionDialog('approve_field')"
            >
                <v-icon start>mdi-account-hard-hat</v-icon>
                {{ $t('approvalState.approveField') }}
            </v-btn>

            <!-- 공람 조기 종료 (public_feedback → final_edit) -->
            <v-btn
                v-if="canEndPublicFeedback"
                color="deep-purple"
                variant="tonal"
                size="small"
                :loading="actionLoading"
                @click="openActionDialog('end_public_feedback')"
            >
                <v-icon start>mdi-fast-forward</v-icon>
                {{ $t('approvalState.endPublicFeedback') }}
            </v-btn>

            <!-- 최종 배포 (final_edit → published) -->
            <v-btn
                v-if="canPublish"
                color="success"
                variant="flat"
                size="small"
                :loading="actionLoading"
                :disabled="!canPublishEnabled"
                @click="openActionDialog('publish')"
            >
                <v-icon start>mdi-rocket-launch</v-icon>
                {{ $t('approvalState.publish') }}
            </v-btn>
            <v-tooltip v-if="canPublish && !canPublishEnabled" activator="parent" location="top">
                {{ $t('approvalState.unresolvedFeedbackBlock') }}
            </v-tooltip>

            <!-- 현장 개선 요청 (published 상태에서) -->
            <v-btn
                v-if="canRequestReopen"
                color="warning"
                variant="tonal"
                size="small"
                :loading="actionLoading"
                @click="openActionDialog('request_reopen')"
            >
                <v-icon start>mdi-comment-alert</v-icon>
                {{ $t('approvalState.requestReopen') }}
            </v-btn>

            <!-- Re-open 승인 (Master) -->
            <v-btn
                v-if="canApproveReopen"
                color="success"
                variant="tonal"
                size="small"
                :loading="actionLoading"
                @click="openActionDialog('approve_reopen')"
            >
                <v-icon start>mdi-check</v-icon>
                {{ $t('approvalState.approveReopen') }}
            </v-btn>

            <!-- Re-open 반려 (Master) -->
            <v-btn
                v-if="canRejectReopen"
                color="error"
                variant="text"
                size="small"
                :loading="actionLoading"
                @click="openActionDialog('reject_reopen')"
            >
                <v-icon start>mdi-close</v-icon>
                {{ $t('approvalState.rejectReopen') }}
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

            <!-- 재작성 (rejected → draft) -->
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

        <!-- Self-Approval 경고 -->
        <v-alert
            v-if="isSelfApproval && approvalState?.state === 'in_review'"
            type="warning"
            variant="tonal"
            density="compact"
            class="mx-3 mb-3"
        >
            {{ $t('approvalState.selfApprovalBlock') }}
        </v-alert>

        <!-- 이력 보기 -->
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
            <v-spacer />
            <!-- Phase 3-5: 전체 로그 보기 -->
            <v-btn
                variant="text"
                size="small"
                color="primary"
                @click="showAuditLog = true"
            >
                <v-icon start size="16">mdi-text-box-search-outline</v-icon>
                {{ $t('auditLog.viewFullLog') }}
            </v-btn>
        </v-card-actions>

        <!-- Phase 3-5: Audit Log Viewer -->
        <AuditLogViewer
            v-model="showAuditLog"
            :procDefId="procDefId"
        />

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
        <v-dialog v-model="actionDialog" max-width="450" persistent>
            <v-card>
                <v-card-title>{{ actionDialogTitle }}</v-card-title>
                <v-card-text>
                    <!-- HQ/Field 검토자 지정 (submit 시) -->
                    <template v-if="actionType === 'submit'">
                        <v-text-field
                            v-model="hqReviewerName"
                            :label="$t('approvalState.hqReviewer')"
                            variant="outlined"
                            density="compact"
                            class="mb-2"
                        />
                        <v-text-field
                            v-model="fieldReviewerName"
                            :label="$t('approvalState.fieldReviewer')"
                            variant="outlined"
                            density="compact"
                            class="mb-2"
                        />
                    </template>
                    <v-textarea
                        v-model="actionComment"
                        :label="$t('approvalState.comment')"
                        :placeholder="$t('approvalState.commentPlaceholder')"
                        variant="outlined"
                        rows="3"
                        :rules="requiresComment ? [v => !!v || $t('approvalState.commentRequired')] : []"
                    />
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn variant="text" @click="closeActionDialog">
                        {{ $t('approvalState.cancel') }}
                    </v-btn>
                    <v-btn
                        :color="actionButtonColor"
                        variant="flat"
                        :disabled="requiresComment && !actionComment.trim()"
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
import { defineComponent, ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { formatDistanceToNow } from 'date-fns';
import { ko, enUS } from 'date-fns/locale';
import BackendFactory from '@/components/api/BackendFactory';
import AuditLogViewer from '@/components/ui/AuditLogViewer.vue';

export default defineComponent({
    name: 'ApprovalStatePanel',
    components: { AuditLogViewer },
    props: {
        procDefId: {
            type: String,
            required: true
        }
    },
    emits: ['stateChanged', 'deriveToBe', 'navigateToElement'],
    setup(props, { emit }) {
        const { t } = useI18n();
        const backend: any = BackendFactory.createBackend();

        const approvalState = ref<any>(null);
        const history = ref<any[]>([]);
        const loading = ref(false);
        const actionLoading = ref(false);
        const showHistory = ref(false);
        const isSelfApproval = ref(false);
        const unresolvedCount = ref(0);

        const showAuditLog = ref(false);
        const unresolvedComments = ref<any[]>([]);

        const actionDialog = ref(false);
        const actionType = ref('');
        const actionComment = ref('');
        const hqReviewerName = ref('');
        const fieldReviewerName = ref('');

        // 파이프라인 단계 정의
        const pipelineSteps = computed(() => [
            { key: 'draft', icon: 'mdi-pencil', label: t('approvalState.draft') },
            { key: 'in_review', icon: 'mdi-account-group', label: t('approvalState.expertReview') },
            { key: 'public_feedback', icon: 'mdi-forum', label: t('approvalState.publicFeedback') },
            { key: 'final_edit', icon: 'mdi-file-edit', label: t('approvalState.finalEdit') },
            { key: 'published', icon: 'mdi-rocket-launch', label: t('approvalState.published') },
        ]);

        const stateStepMap: Record<string, number> = {
            draft: 0,
            in_review: 1,
            public_feedback: 2,
            final_edit: 3,
            published: 4,
            reopen_requested: 4,
            archived: 4,
            rejected: -1,
            cancelled: -1
        };

        const currentStepIndex = computed(() => {
            const state = approvalState.value?.state || 'draft';
            return stateStepMap[state] ?? 0;
        });

        // 상태별 설정
        const stateConfigs: Record<string, { color: string; icon: string; labelKey: string }> = {
            draft: { color: 'grey', icon: 'mdi-pencil', labelKey: 'approvalState.draft' },
            in_review: { color: 'warning', icon: 'mdi-account-group', labelKey: 'approvalState.expertReview' },
            public_feedback: { color: 'info', icon: 'mdi-forum', labelKey: 'approvalState.publicFeedback' },
            final_edit: { color: 'purple', icon: 'mdi-file-edit', labelKey: 'approvalState.finalEdit' },
            published: { color: 'success', icon: 'mdi-rocket-launch', labelKey: 'approvalState.published' },
            reopen_requested: { color: 'orange', icon: 'mdi-comment-alert', labelKey: 'approvalState.reopenRequested' },
            archived: { color: 'grey', icon: 'mdi-archive', labelKey: 'approvalState.archived' },
            rejected: { color: 'error', icon: 'mdi-close-circle', labelKey: 'approvalState.rejected' },
            cancelled: { color: 'grey', icon: 'mdi-cancel', labelKey: 'approvalState.cancelled' }
        };

        const stateConfig = computed(() => {
            const state = approvalState.value?.state || 'draft';
            const config = stateConfigs[state] || stateConfigs.draft;
            return { ...config, label: t(config.labelKey) };
        });

        // 병렬 승인 상태 chips
        const hqStatus = computed(() => approvalState.value?.hq_status || 'pending');
        const fieldStatus = computed(() => approvalState.value?.field_status || 'pending');

        const statusChipConfig = (status: string) => {
            switch (status) {
                case 'approved': return { color: 'success', icon: 'mdi-check-circle' };
                case 'rejected': return { color: 'error', icon: 'mdi-close-circle' };
                default: return { color: 'grey', icon: 'mdi-clock-outline' };
            }
        };

        const hqChipColor = computed(() => statusChipConfig(hqStatus.value).color);
        const hqChipIcon = computed(() => statusChipConfig(hqStatus.value).icon);
        const fieldChipColor = computed(() => statusChipConfig(fieldStatus.value).color);
        const fieldChipIcon = computed(() => statusChipConfig(fieldStatus.value).icon);

        const statusLabel = (status: string) => {
            switch (status) {
                case 'approved': return t('approvalState.approved');
                case 'rejected': return t('approvalState.rejected');
                default: return t('approvalState.pending');
            }
        };
        const hqStatusLabel = computed(() => statusLabel(hqStatus.value));
        const fieldStatusLabel = computed(() => statusLabel(fieldStatus.value));

        // 공람 D-day
        const publicFeedbackDday = computed(() => {
            if (!approvalState.value?.public_feedback_ends_at) return null;
            const end = new Date(approvalState.value.public_feedback_ends_at);
            const now = new Date();
            const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            if (diff > 0) return `D-${diff}`;
            if (diff === 0) return 'D-Day';
            return `D+${Math.abs(diff)}`;
        });

        // Phase 3-3: 공람 만료 여부
        const isPublicFeedbackExpired = computed(() => {
            if (!approvalState.value?.public_feedback_ends_at) return false;
            const end = new Date(approvalState.value.public_feedback_ends_at);
            return new Date() > end;
        });

        // 버전 라벨 계산 (Major.Minor)
        const isPublishedState = computed(() => {
            const s = approvalState.value?.state;
            return s === 'published' || s === 'reopen_requested' || s === 'archived';
        });

        const versionDisplayLabel = computed((): string => {
            const state = approvalState.value;
            if (!state) return 'v0.1';
            // DB에 version_label이 있으면 우선 사용
            if (state.version_label) return state.version_label;
            // major_version/minor_version 필드
            const major = state.major_version ?? 0;
            const minor = state.minor_version ?? 1;
            if (isPublishedState.value) return `v${major}.0`;
            return `v${major}.${minor}`;
        });

        // To-Be 파생 가능 여부: Published(v1.0+) 이후에만 활성화
        const canDeriveToBase = computed(() => {
            const state = approvalState.value?.state;
            const major = approvalState.value?.major_version ?? 0;
            return (state === 'published' || state === 'reopen_requested') && major >= 1;
        });

        // 권한 체크
        const canSubmitForReview = computed(() => approvalState.value?.state === 'draft');
        const canApproveHQ = computed(() =>
            approvalState.value?.state === 'in_review' && hqStatus.value === 'pending'
        );
        const canApproveField = computed(() =>
            approvalState.value?.state === 'in_review' && fieldStatus.value === 'pending'
        );
        const canEndPublicFeedback = computed(() => approvalState.value?.state === 'public_feedback');
        const canPublish = computed(() => approvalState.value?.state === 'final_edit');
        const canPublishEnabled = computed(() => canPublish.value && unresolvedCount.value === 0);
        const canRequestReopen = computed(() => approvalState.value?.state === 'published');
        const canApproveReopen = computed(() => approvalState.value?.state === 'reopen_requested');
        const canRejectReopen = computed(() => approvalState.value?.state === 'reopen_requested');
        const canReject = computed(() => {
            const state = approvalState.value?.state;
            return state && ['in_review', 'public_feedback', 'final_edit'].includes(state);
        });
        const canReopen = computed(() => approvalState.value?.state === 'rejected');

        const requiresComment = computed(() =>
            ['reject', 'reject_hq', 'reject_field', 'request_reopen'].includes(actionType.value)
        );

        const actionButtonColor = computed(() => {
            if (['reject', 'reject_hq', 'reject_field', 'reject_reopen'].includes(actionType.value)) return 'error';
            if (['approve_hq', 'approve_field', 'publish', 'approve_reopen'].includes(actionType.value)) return 'success';
            return 'primary';
        });

        const actionDialogTitle = computed(() => {
            const titles: Record<string, string> = {
                submit: t('approvalState.submitForReview'),
                approve_hq: t('approvalState.approveHQ'),
                approve_field: t('approvalState.approveField'),
                publish: t('approvalState.publish'),
                reject: t('approvalState.reject'),
                reopen: t('approvalState.reopen'),
                request_reopen: t('approvalState.requestReopen'),
                approve_reopen: t('approvalState.approveReopen'),
                reject_reopen: t('approvalState.rejectReopen'),
            };
            return titles[actionType.value] || '';
        });

        const formatDate = (dateStr: string): string => {
            if (!dateStr) return '';
            try {
                const locale = (window as any).$lang === 'ko' ? ko : enUS;
                return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale });
            } catch {
                return dateStr;
            }
        };

        const getActionIcon = (action: string): string => {
            const icons: Record<string, string> = {
                submit: 'mdi-send',
                approve_hq: 'mdi-domain',
                approve_field: 'mdi-account-hard-hat',
                reject_hq: 'mdi-close-circle',
                reject_field: 'mdi-close-circle',
                start_public_feedback: 'mdi-forum',
                auto_transition_final_edit: 'mdi-timer',
                publish: 'mdi-rocket-launch',
                reject: 'mdi-close-circle',
                reopen: 'mdi-refresh',
                request_reopen: 'mdi-comment-alert',
                approve_reopen: 'mdi-check',
                reject_reopen: 'mdi-close',
                reset_approvals: 'mdi-refresh-circle',
                cancel: 'mdi-cancel',
                comment: 'mdi-comment',
            };
            return icons[action] || 'mdi-circle';
        };

        const getActionColor = (action: string): string => {
            const colors: Record<string, string> = {
                submit: 'primary',
                approve_hq: 'blue',
                approve_field: 'green',
                reject_hq: 'error',
                reject_field: 'error',
                start_public_feedback: 'info',
                auto_transition_final_edit: 'purple',
                publish: 'success',
                reject: 'error',
                reopen: 'warning',
                request_reopen: 'orange',
                approve_reopen: 'success',
                reject_reopen: 'error',
                reset_approvals: 'warning',
                cancel: 'grey',
                comment: 'grey',
            };
            return colors[action] || 'grey';
        };

        const getActionLabel = (action: string): string => {
            const labels: Record<string, string> = {
                submit: t('approvalState.actionSubmit'),
                approve_hq: t('approvalState.actionApproveHQ'),
                approve_field: t('approvalState.actionApproveField'),
                reject_hq: t('approvalState.actionRejectHQ'),
                reject_field: t('approvalState.actionRejectField'),
                start_public_feedback: t('approvalState.actionStartFeedback'),
                auto_transition_final_edit: t('approvalState.actionAutoTransition'),
                publish: t('approvalState.actionPublish'),
                reject: t('approvalState.actionReject'),
                reopen: t('approvalState.actionReopen'),
                request_reopen: t('approvalState.actionRequestReopen'),
                approve_reopen: t('approvalState.actionApproveReopen'),
                reject_reopen: t('approvalState.actionRejectReopen'),
                reset_approvals: t('approvalState.actionReset'),
                cancel: t('approvalState.actionCancel'),
                comment: t('approvalState.actionComment'),
            };
            return labels[action] || action;
        };

        const loadApprovalState = async () => {
            if (!props.procDefId) return;
            loading.value = true;
            try {
                approvalState.value = await backend.getApprovalState(props.procDefId);
                history.value = await backend.getApprovalHistory(props.procDefId);

                // Self-Approval 체크
                if (approvalState.value?.id) {
                    isSelfApproval.value = await backend.checkSelfApproval(approvalState.value.id);
                }

                // Phase 3-3: 공람 기간 만료 시 자동 전환
                if (approvalState.value?.state === 'public_feedback' && approvalState.value.public_feedback_ends_at) {
                    const end = new Date(approvalState.value.public_feedback_ends_at);
                    if (new Date() > end) {
                        try {
                            await backend.endPublicFeedback(
                                approvalState.value.id,
                                t('approvalResetWarning.autoTransitionComment')
                            );
                            // Reload after auto-transition
                            approvalState.value = await backend.getApprovalState(props.procDefId);
                            history.value = await backend.getApprovalHistory(props.procDefId);
                        } catch (e) {
                            console.warn('공람 자동 전환 실패:', e);
                        }
                    }
                }

                // 미해결 피드백 카운트 + 목록
                const supabase = (window as any).$supabase;
                if (supabase && approvalState.value) {
                    const { count, data: unresolvedData } = await supabase
                        .from('proc_def_comments')
                        .select('id, content, comment, element_id', { count: 'exact' })
                        .eq('proc_def_id', props.procDefId)
                        .eq('is_resolved', false)
                        .is('parent_comment_id', null)
                        .limit(10);
                    unresolvedCount.value = count || 0;
                    unresolvedComments.value = unresolvedData || [];
                }
            } catch (e) {
                console.error('승인 상태 로드 실패:', e);
            } finally {
                loading.value = false;
            }
        };

        const openActionDialog = (type: string) => {
            actionType.value = type;
            actionComment.value = '';
            hqReviewerName.value = '';
            fieldReviewerName.value = '';
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
                const reviewId = approvalState.value?.id;

                switch (actionType.value) {
                    case 'submit':
                        await backend.submitForReview(props.procDefId, comment, undefined, {
                            hq: hqReviewerName.value ? { id: '', name: hqReviewerName.value } : undefined,
                            field: fieldReviewerName.value ? { id: '', name: fieldReviewerName.value } : undefined,
                        });
                        break;
                    case 'approve_hq':
                        await backend.approveHQ(reviewId, comment);
                        break;
                    case 'approve_field':
                        await backend.approveField(reviewId, comment);
                        break;
                    case 'end_public_feedback':
                        await backend.endPublicFeedback(reviewId, comment || '공람 조기 종료');
                        break;
                    case 'publish':
                        await backend.publishDefinition(reviewId, comment);
                        break;
                    case 'reject':
                        await backend.rejectDefinition(reviewId, comment!);
                        break;
                    case 'reopen':
                        await backend.reopenDefinition(reviewId, comment);
                        break;
                    case 'request_reopen':
                        await backend.requestReopen(props.procDefId, comment!);
                        break;
                    case 'approve_reopen':
                        await backend.approveReopen(reviewId, comment);
                        break;
                    case 'reject_reopen':
                        await backend.rejectReopen(reviewId, comment);
                        break;
                }

                closeActionDialog();
                await loadApprovalState();
                emit('stateChanged', approvalState.value);
            } catch (e: any) {
                console.error('액션 실행 실패:', e);
                alert(e.message || '액션 실행에 실패했습니다.');
            } finally {
                actionLoading.value = false;
            }
        };

        watch(() => props.procDefId, () => {
            loadApprovalState();
        }, { immediate: true });

        return {
            approvalState, history, loading, actionLoading, showHistory,
            isSelfApproval, unresolvedCount, unresolvedComments,
            showAuditLog, isPublicFeedbackExpired,
            actionDialog, actionType, actionComment,
            hqReviewerName, fieldReviewerName,
            pipelineSteps, currentStepIndex, stateConfig,
            hqChipColor, hqChipIcon, fieldChipColor, fieldChipIcon,
            hqStatusLabel, fieldStatusLabel,
            publicFeedbackDday,
            isPublishedState, versionDisplayLabel, canDeriveToBase,
            canSubmitForReview, canApproveHQ, canApproveField,
            canEndPublicFeedback,
            canPublish, canPublishEnabled,
            canRequestReopen, canApproveReopen, canRejectReopen,
            canReject, canReopen,
            requiresComment, actionButtonColor, actionDialogTitle,
            formatDate, getActionIcon, getActionColor, getActionLabel,
            openActionDialog, closeActionDialog, executeAction,
        };
    }
});
</script>

<style scoped>
.approval-state-panel {
    border: none;
}

.governance-pipeline {
    position: relative;
    padding: 8px 0;
}

.pipeline-step {
    flex: 1;
    position: relative;
    opacity: 0.5;
    transition: opacity 0.2s;
}

.pipeline-step.active {
    opacity: 1;
}

.pipeline-step.current {
    opacity: 1;
}

.pipeline-arrow {
    position: absolute;
    right: -7px;
    top: 4px;
}

/* Version badge */
.asp-version-badge {
    display: inline-flex;
    align-items: center;
    font-size: 12px;
    font-weight: 700;
    padding: 3px 10px;
    border-radius: 20px;
}
.asp-version-badge--major {
    background: #d1fae5;
    color: #065f46;
    border: 1px solid #a7f3d0;
}
.asp-version-badge--minor {
    background: #f1f5f9;
    color: #475569;
    border: 1px solid #e2e8f0;
}

/* To-Be derive button */
.asp-derive-btn {
    font-size: 11px !important;
    height: 24px !important;
}

/* Phase 3-4: Unresolved comment items */
.unresolved-comment-item {
    cursor: pointer;
    padding: 2px 4px;
    border-radius: 4px;
    transition: background-color 0.15s;
}
.unresolved-comment-item:hover {
    background-color: rgba(0, 0, 0, 0.04);
}
</style>
