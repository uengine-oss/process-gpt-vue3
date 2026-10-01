<template>
    <v-card flat class="sk-page-card audit-trail-wrapper">
        <!-- Header -->
        <div class="page-header">
            <div class="page-header-left">
                <h1 class="page-title">감사 로그</h1>
            </div>
            <div class="page-header-right">
                <v-btn
                    variant="outlined"
                    size="small"
                    prepend-icon="mdi-download"
                    :disabled="currentExportDisabled"
                    @click="exportCsv"
                >
                    CSV 내보내기
                </v-btn>
            </div>
        </div>

        <v-card-text class="pa-4 pt-0 sk-page-card-text">

        <!--
            Tab Selector — 탭은 스크립트의 TAB_DEFS 배열 하나로 정의된다.
            새 탭(예: 다운로드 이력)은 TAB_DEFS 에 항목을 추가하고 로더/내보내기/테이블 블록만
            붙이면 되며, 이 탭 바와 필터 바는 수정할 필요가 없다.
        -->
        <div class="audit-tab-bar">
            <button
                v-for="tab in tabs"
                :key="tab.key"
                class="audit-tab-btn"
                :class="{ active: activeTab === tab.key }"
                @click="switchTab(tab.key)"
            >{{ $t(tab.labelKey) }}</button>
        </div>

        <!-- Filter Bar — 각 탭이 TAB_DEFS.filters 로 선언한 필터만 노출한다 -->
        <div class="filter-bar">
            <div v-if="showFilter('startDate')" class="filter-group">
                <label class="filter-label">시작일</label>
                <input
                    v-model="filters.startDate"
                    type="date"
                    class="filter-input filter-date"
                    @change="onFilterChange"
                />
            </div>
            <div v-if="showFilter('endDate')" class="filter-group">
                <label class="filter-label">종료일</label>
                <input
                    v-model="filters.endDate"
                    type="date"
                    class="filter-input filter-date"
                    @change="onFilterChange"
                />
            </div>
            <div v-if="showFilter('action')" class="filter-group">
                <label class="filter-label">액션</label>
                <select v-model="filters.action" class="filter-input filter-select" @change="onFilterChange">
                    <option value="">전체 액션</option>
                    <option v-for="code in approvalActionCodes" :key="code" :value="code">
                        {{ getApprovalActionOptionLabel(code) }}
                    </option>
                </select>
            </div>
            <div v-if="showFilter('adminAction')" class="filter-group">
                <label class="filter-label">액션</label>
                <select v-model="filters.adminAction" class="filter-input filter-select" @change="onFilterChange">
                    <option value="">전체 액션</option>
                    <option v-for="code in adminActionCodes" :key="code" :value="code">
                        {{ getAdminActionOptionLabel(code) }}
                    </option>
                </select>
            </div>
            <div v-if="showFilter('targetType')" class="filter-group">
                <label class="filter-label">대상 유형</label>
                <select v-model="filters.targetType" class="filter-input filter-select" @change="onFilterChange">
                    <option value="">전체 유형</option>
                    <option v-for="code in targetTypeCodes" :key="code" :value="code">
                        {{ getTargetTypeOptionLabel(code) }}
                    </option>
                </select>
            </div>
            <div v-if="showFilter('loginAction')" class="filter-group">
                <label class="filter-label">{{ $t('auditLog.loginAudit.filterAction') }}</label>
                <select v-model="filters.loginAction" class="filter-input filter-select" @change="onFilterChange">
                    <option value="">{{ $t('auditLog.loginAudit.allActions') }}</option>
                    <option v-for="code in loginActionCodes" :key="code" :value="code">
                        {{ getLoginActionOptionLabel(code) }}
                    </option>
                </select>
            </div>
            <div v-if="showFilter('success')" class="filter-group">
                <label class="filter-label">{{ $t('auditLog.loginAudit.filterSuccess') }}</label>
                <select v-model="filters.success" class="filter-input filter-select" @change="onFilterChange">
                    <option value="">{{ $t('auditLog.loginAudit.allResults') }}</option>
                    <option value="true">{{ $t('auditLog.loginAudit.resultSuccess') }}</option>
                    <option value="false">{{ $t('auditLog.loginAudit.resultFailure') }}</option>
                </select>
            </div>
            <div v-if="showFilter('bucket')" class="filter-group">
                <label class="filter-label">{{ $t('auditLog.downloadAudit.filterBucket') }}</label>
                <select v-model="filters.bucket" class="filter-input filter-select" @change="onFilterChange">
                    <option value="">{{ $t('auditLog.downloadAudit.allBuckets') }}</option>
                    <option v-for="bucket in downloadBuckets" :key="bucket" :value="bucket">{{ bucket }}</option>
                </select>
            </div>
            <div v-if="showFilter('actorId')" class="filter-group filter-group-actor">
                <label class="filter-label">수행자</label>
                <input
                    v-model="filters.actorId"
                    type="text"
                    class="filter-input filter-text"
                    placeholder="수행자 검색"
                    @keydown.enter="onActorEnter"
                />
            </div>
            <div v-if="showFilter('email')" class="filter-group filter-group-actor">
                <label class="filter-label">{{ $t('auditLog.loginAudit.filterEmail') }}</label>
                <input
                    v-model="filters.email"
                    type="text"
                    class="filter-input filter-text"
                    :placeholder="$t('auditLog.loginAudit.filterEmailPlaceholder')"
                    @keydown.enter="onActorEnter"
                />
            </div>
        </div>

        <div
            v-if="showCutoverCard"
            class="cutover-audit-card"
            :class="{ 'cutover-audit-card--open': cutoverExpanded }"
        >
            <button type="button" class="cutover-audit-card__header" @click="cutoverExpanded = !cutoverExpanded">
                <div>
                    <div class="cutover-audit-card__title">구조개편 반영 이력</div>
                    <div class="cutover-audit-card__subtitle">구조개편 시나리오가 실제 체계도에 반영된 이력을 확인합니다.</div>
                </div>
                <div class="cutover-audit-card__header-right">
                    <span class="cutover-audit-count">{{ cutoverJobs.length }}건</span>
                    <v-icon size="18">{{ cutoverExpanded ? 'mdi-chevron-up' : 'mdi-chevron-down' }}</v-icon>
                </div>
            </button>
            <div v-if="cutoverExpanded" class="cutover-audit-card__body">
                <div v-if="cutoverJobs.length === 0" class="cutover-audit-empty">
                    구조개편 반영 이력이 없습니다.
                </div>
                <div v-else class="cutover-audit-list">
                    <div v-for="job in cutoverJobs" :key="job.id" class="cutover-audit-item">
                        <div class="cutover-audit-item__top">
                            <span class="cutover-audit-item__title">{{ formatCutoverTitle(job) }}</span>
                            <span class="action-chip chip-teal">{{ formatCutoverStatus(job.status) }}</span>
                        </div>
                        <div class="cutover-audit-detail-list">
                            <div class="cutover-audit-detail">
                                <span class="cutover-audit-detail__label">실행자:</span>
                                <span class="cutover-audit-detail__value">{{ job.executed_by || job.created_by || 'system' }}</span>
                            </div>
                            <div class="cutover-audit-detail">
                                <span class="cutover-audit-detail__label">구분:</span>
                                <span class="cutover-audit-detail__value">{{ formatCutoverApprovalType(job.approval_type) }}</span>
                            </div>
                            <div class="cutover-audit-detail">
                                <span class="cutover-audit-detail__label">버전:</span>
                                <span class="cutover-audit-detail__value">{{ job.version_label || '버전 정보 없음' }}</span>
                            </div>
                            <div class="cutover-audit-detail">
                                <span class="cutover-audit-detail__label">실행 일시:</span>
                                <span class="cutover-audit-detail__value">{{ formatDatetime(job.executed_at || job.failed_at || job.started_at || job.created_at) }}</span>
                            </div>
                        </div>
                        <div class="cutover-audit-section">
                            <span class="cutover-audit-section__label">반영 내용</span>
                            <p class="cutover-audit-section__text">{{ job.summary || '반영 내용이 없습니다.' }}</p>
                        </div>
                        <div v-if="job.error_message" class="cutover-audit-section cutover-audit-section--error">
                            <span class="cutover-audit-section__label">오류 내용</span>
                            <p class="cutover-audit-section__text">{{ job.error_message }}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- ======= Approval Logs Table ======= -->
        <template v-if="activeTab === 'approval'">
            <v-data-table-server
                density="compact"
                :headers="approvalHeaders"
                :items="auditLogs"
                :items-length="auditTotal"
                :items-per-page="pageSize"
                :items-per-page-options="[25, 50, 100, 200]"
                :loading="loading"
                hover
                class="sk-data-table"
                @update:options="onTableUpdate"
            >
                <template #item.created_at="{ item }">
                    <span class="datetime-text">{{ formatDatetime(item.created_at) }}</span>
                </template>
                <template #item.action="{ item }">
                    <span class="action-chip" :class="getActionChipClass(item.action)" :title="item.action">
                        {{ getApprovalActionLabel(item.action) || item.action }}
                    </span>
                </template>
                <template #item.from_state="{ item }">
                    <span class="state-text" :title="item.from_state || ''">{{ getStateLabel(item.from_state) }}</span>
                </template>
                <template #item.to_state="{ item }">
                    <span class="state-text" :title="item.to_state || ''">{{ getStateLabel(item.to_state) }}</span>
                </template>
                <template #item.actor_id="{ item }">
                    <span class="actor-text" :title="formatApprovalActor(item)">{{ formatApprovalActor(item) }}</span>
                </template>
                <template #item.comment="{ item }">
                    <span class="comment-text" :title="item.comment || ''">{{ truncateComment(item.comment) }}</span>
                </template>
                <template #no-data>
                    <div class="text-center pa-8 text-medium-emphasis">
                        <v-icon size="40" color="grey-lighten-1">mdi-clipboard-text-off-outline</v-icon>
                        <div class="mt-2">감사 로그가 없습니다.</div>
                    </div>
                </template>
            </v-data-table-server>
        </template>

        <!-- ======= Admin Audit Logs Table (When / Who / What / Changes) ======= -->
        <template v-else-if="activeTab === 'admin'">
            <v-data-table-server
                density="compact"
                :headers="adminHeaders"
                :items="adminAuditLogs"
                :items-length="adminAuditTotal"
                :items-per-page="pageSize"
                :items-per-page-options="[25, 50, 100, 200]"
                :loading="loading"
                hover
                show-expand
                :expanded="adminExpanded"
                item-value="id"
                class="sk-data-table"
                @update:options="onTableUpdate"
                @update:expanded="adminExpanded = $event"
            >
                <template #item.created_at="{ item }">
                    <span class="datetime-text">{{ formatDatetime(item.created_at) }}</span>
                </template>
                <template #item.actor="{ item }">
                    <span class="actor-text" :title="formatAdminActor(item)">{{ formatAdminActor(item) }}</span>
                </template>
                <template #item.what="{ item }">
                    <span class="action-chip" :class="getAdminActionChipClass(item.action)" :title="item.action">
                        {{ getAdminActionLabel(item.action, item) || item.action }}
                    </span>
                    <a
                        v-if="item.target_name && isProcessLinkable(item)"
                        class="what-target-name what-target-name--link"
                        href="javascript:void(0)"
                        :title="`새 창에서 열기 — ${item.target_name}`"
                        @click.stop="openTargetProcessInNewTab(item)"
                    >
                        {{ item.target_name }}
                        <v-icon size="11" class="ml-1">mdi-open-in-new</v-icon>
                    </a>
                    <span v-else-if="item.target_name" class="what-target-name">{{ item.target_name }}</span>
                </template>
                <template #item.changes="{ item }">
                    <span class="changes-brief">{{ buildChangeSummary(item) }}</span>
                </template>
                <template #expanded-row="{ columns, item }">
                    <tr class="expanded-detail-row">
                        <td :colspan="columns.length" class="expanded-detail-cell">
                            <div class="change-detail-list">
                                <div v-if="item.comment" class="change-detail-item change-reason-item">
                                    <span class="change-key">
                                        <span class="change-key-label">변경 사유</span>
                                    </span>
                                    <span class="change-reason-text">{{ item.comment }}</span>
                                </div>
                                <div
                                    v-for="detail in buildChangeDetails(item)"
                                    :key="detail.key"
                                    class="change-detail-item"
                                >
                                    <span class="change-key" :title="detail.key">
                                        <span class="change-key-code">{{ detail.key }}</span>
                                        <span v-if="getChangeKeyLabel(detail.key)" class="change-key-label">: {{ getChangeKeyLabel(detail.key) }}</span>
                                    </span>
                                    <span v-if="detail.type === 'info'" class="change-info">{{ detail.after }}</span>
                                    <span v-else-if="detail.type === 'added'" class="change-added">{{ detail.after }}</span>
                                    <span v-else-if="detail.type === 'removed'" class="change-removed">{{ detail.before }}</span>
                                    <template v-else>
                                        <span class="change-removed">{{ detail.before }}</span>
                                        <v-icon size="12" class="change-arrow">mdi-arrow-right</v-icon>
                                        <span class="change-added">{{ detail.after }}</span>
                                    </template>
                                </div>
                                <div v-if="buildChangeDetails(item).length === 0 && !item.comment" class="text-medium-emphasis">
                                    변경 상세 정보 없음
                                </div>
                            </div>
                        </td>
                    </tr>
                </template>
                <template #no-data>
                    <div class="text-center pa-8 text-medium-emphasis">
                        <v-icon size="40" color="grey-lighten-1">mdi-shield-check-outline</v-icon>
                        <div class="mt-2">관리자 감사 로그가 없습니다.</div>
                    </div>
                </template>
            </v-data-table-server>
        </template>

        <!-- ======= Login Audit Table (로그인 / 로그아웃 / 로그인 실패 이력) =======
             테이블: public.auth_login_audit (기록은 record_auth_audit RPC, 조회는 관리자 RLS)
             상단의 "잠금 계정" 패널은 2단계(항목 18) — 원천이 다르다.
             잠금 카운트는 GoTrue 훅이 직접 쓰는 public.auth_failed_attempts 이고,
             조회/해제는 admin_list_locked_accounts() / admin_unlock_account() RPC 를 쓴다. -->
        <template v-else-if="activeTab === 'login'">
            <!-- ── 잠금 계정 패널 (docs/security.md 2-4, 항목 18) ──
                 store(adminConsole) 를 거치지 않고 backend 를 직접 호출한다.
                 store 통합은 후속 작업. -->
            <div class="lockout-panel" :class="{ 'lockout-panel--idle': lockedAccounts.length === 0 }">
                <div class="lockout-header">
                    <v-icon size="16" :color="lockedAccounts.length ? '#ef4444' : '#94a3b8'">
                        {{ lockedAccounts.length ? 'mdi-lock-alert-outline' : 'mdi-lock-open-check-outline' }}
                    </v-icon>
                    <span class="lockout-title">{{ $t('auditLog.loginAudit.lockout.title') }}</span>
                    <span v-if="lockedAccounts.length" class="lockout-count">{{ lockedAccounts.length }}</span>
                    <span v-else-if="!lockedLoading && !lockedError" class="lockout-idle-text">
                        {{ $t('auditLog.loginAudit.lockout.empty') }}
                    </span>
                    <v-progress-circular v-if="lockedLoading" indeterminate size="14" width="2" class="ml-2" />
                    <span class="lockout-spacer"></span>
                    <button class="lockout-refresh" :disabled="lockedLoading" @click="loadLockedAccounts">
                        <v-icon size="13">mdi-refresh</v-icon>
                        {{ $t('auditLog.loginAudit.lockout.refresh') }}
                    </button>
                </div>

                <div v-if="lockedError" class="lockout-error">
                    <v-icon size="14" color="#ef4444">mdi-alert-circle-outline</v-icon>
                    {{ lockedError }}
                </div>

                <table v-else-if="lockedAccounts.length" class="lockout-table">
                    <thead>
                        <tr>
                            <th>{{ $t('auditLog.loginAudit.lockout.columnAccount') }}</th>
                            <th class="lockout-col-num">{{ $t('auditLog.loginAudit.lockout.columnFailedCount') }}</th>
                            <th>{{ $t('auditLog.loginAudit.lockout.columnLockedAt') }}</th>
                            <th>{{ $t('auditLog.loginAudit.lockout.columnLockedUntil') }}</th>
                            <th class="lockout-col-action"></th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="account in lockedAccounts" :key="account.user_id">
                            <td>
                                <span class="lockout-email">{{ account.email || account.user_id }}</span>
                                <span v-if="account.username" class="lockout-username">{{ account.username }}</span>
                            </td>
                            <td class="lockout-col-num">
                                <span class="action-chip chip-red">{{ account.failed_count }}</span>
                            </td>
                            <td><span class="datetime-text">{{ formatDatetime(account.locked_at) }}</span></td>
                            <td>
                                <span class="datetime-text">{{ formatDatetime(account.locked_until) }}</span>
                                <span class="lockout-remaining">{{ formatLockRemaining(account.locked_until) }}</span>
                            </td>
                            <td class="lockout-col-action">
                                <button
                                    class="lockout-unlock-btn"
                                    :disabled="unlocking"
                                    @click="openUnlockDialog(account)"
                                >{{ $t('auditLog.loginAudit.lockout.unlock') }}</button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- 잠금 해제 확인 -->
            <v-dialog v-model="unlockDialog" max-width="420" persistent>
                <v-card class="confirm-dialog">
                    <div class="dialog-header">
                        <v-icon color="#f59e0b" size="22">mdi-lock-open-variant-outline</v-icon>
                        <span class="dialog-title">{{ $t('auditLog.loginAudit.lockout.confirmTitle') }}</span>
                    </div>
                    <div class="dialog-body">
                        <p class="dialog-desc">{{ $t('auditLog.loginAudit.lockout.confirmDesc') }}</p>
                        <div class="target-info">
                            <strong>{{ unlockTarget?.email || unlockTarget?.user_id }}</strong>
                        </div>
                    </div>
                    <div class="dialog-actions">
                        <v-btn variant="text" size="small" :disabled="unlocking" @click="closeUnlockDialog">
                            {{ $t('auditLog.loginAudit.lockout.cancel') }}
                        </v-btn>
                        <v-btn color="primary" variant="flat" size="small" :loading="unlocking" @click="confirmUnlock">
                            {{ $t('auditLog.loginAudit.lockout.unlock') }}
                        </v-btn>
                    </div>
                </v-card>
            </v-dialog>

            <v-data-table-server
                density="compact"
                :headers="loginHeaders"
                :items="authLoginAudit"
                :items-length="authLoginAuditTotal"
                :items-per-page="pageSize"
                :items-per-page-options="[25, 50, 100, 200]"
                :loading="loading"
                hover
                class="sk-data-table"
                @update:options="onTableUpdate"
            >
                <template #item.created_at="{ item }">
                    <span class="datetime-text">{{ formatDatetime(item.created_at) }}</span>
                </template>
                <template #item.email="{ item }">
                    <span class="actor-text" :title="item.email || ''">{{ item.email || '—' }}</span>
                </template>
                <template #item.action="{ item }">
                    <span class="action-chip" :class="getLoginActionChipClass(item)" :title="item.action">
                        {{ getLoginActionLabel(item.action) }}
                    </span>
                </template>
                <template #item.success="{ item }">
                    <span class="action-chip" :class="item.success ? 'chip-green' : 'chip-red'">
                        {{ item.success ? $t('auditLog.loginAudit.resultSuccess') : $t('auditLog.loginAudit.resultFailure') }}
                    </span>
                </template>
                <template #item.error_message="{ item }">
                    <span class="comment-text" :title="item.error_message || ''">{{ truncateComment(item.error_message) }}</span>
                </template>
                <template #item.ip_address="{ item }">
                    <span class="state-text">{{ item.ip_address || '—' }}</span>
                </template>
                <template #item.user_agent="{ item }">
                    <span class="comment-text" :title="item.user_agent || ''">{{ summarizeUserAgent(item.user_agent) }}</span>
                </template>
                <template #item.provider="{ item }">
                    <span class="state-text" :title="formatAuthMetaTitle(item)">{{ formatAuthMeta(item) }}</span>
                </template>
                <template #no-data>
                    <div class="text-center pa-8 text-medium-emphasis">
                        <v-icon size="40" color="grey-lighten-1">mdi-login-variant</v-icon>
                        <div class="mt-2">{{ $t('auditLog.loginAudit.empty') }}</div>
                    </div>
                </template>
            </v-data-table-server>
        </template>

        <!-- ======= Download History Table (파일 다운로드 이력) =======
             테이블: public.file_download_log
             기록은 record_file_download RPC(SECURITY DEFINER)로만, 조회는 관리자 RLS.
             마이그레이션: supabase/migrations/20260911_file_download_log.sql
             다른 탭들과 달리 adminConsole store 를 경유하지 않고 backend 를 직접 부른다
             (잠금 계정 패널과 같은 이유 — store 통합은 후속 작업). -->
        <template v-else-if="activeTab === 'download'">
            <div v-if="downloadError" class="lockout-error">
                <v-icon size="14" color="#ef4444">mdi-alert-circle-outline</v-icon>
                {{ downloadError }}
            </div>
            <v-data-table-server
                density="compact"
                :headers="downloadHeaders"
                :items="fileDownloadLog"
                :items-length="fileDownloadTotal"
                :items-per-page="pageSize"
                :items-per-page-options="[25, 50, 100, 200]"
                :loading="downloadLoading"
                hover
                class="sk-data-table"
                @update:options="onTableUpdate"
            >
                <template #item.created_at="{ item }">
                    <span class="datetime-text">{{ formatDatetime(item.created_at) }}</span>
                </template>
                <template #item.email="{ item }">
                    <span class="actor-text" :title="item.email || ''">{{ item.email || '—' }}</span>
                </template>
                <template #item.file_name="{ item }">
                    <!-- 경로는 `<타임스탬프>_<uuid8>.<확장자>` 라 읽기 어렵다. 이름을 보여주고 경로는 툴팁으로. -->
                    <span class="comment-text" :title="item.path || ''">{{ formatDownloadFileName(item) }}</span>
                </template>
                <template #item.bucket="{ item }">
                    <span class="state-text">{{ item.bucket || '—' }}</span>
                </template>
                <template #item.action="{ item }">
                    <span class="action-chip" :class="getDownloadActionChipClass(item.action)" :title="item.action">
                        {{ getDownloadActionLabel(item.action) }}
                    </span>
                </template>
                <template #item.ip_address="{ item }">
                    <span class="state-text">{{ item.ip_address || '—' }}</span>
                </template>
                <template #no-data>
                    <div class="text-center pa-8 text-medium-emphasis">
                        <v-icon size="40" color="grey-lighten-1">mdi-file-download-outline</v-icon>
                        <div class="mt-2">{{ $t('auditLog.downloadAudit.empty') }}</div>
                    </div>
                </template>
            </v-data-table-server>
        </template>
        </v-card-text>
    </v-card>
</template>

<script>
import { defineComponent, ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAdminConsoleStore } from '@/stores/adminConsole';
import { storeToRefs } from 'pinia';
import BackendFactory from '@/components/api/BackendFactory';
import {
    buildProcessHierarchyQuery,
    PROCESS_HIERARCHY_ENTRY,
    PROCESS_HIERARCHY_MODE,
    PROCESS_HIERARCHY_PANEL_STATE,
    PROCESS_HIERARCHY_RIGHT_TAB
} from '@/views/process-hierarchy/navigation';
import { STAGE_DEFS, mapStateToStage } from '@/utils/processStages';
import { formatIdentityFull } from '@/utils/userIdentity';
import { formatKST } from '@/utils/datetime';

export default defineComponent({
    name: 'AuditTrail',

    setup() {
        const store = useAdminConsoleStore();
        const router = useRouter();
        // main.ts 의 createI18n 은 legacy 모드(기본값)라 setup 에서 useI18n() 을 쓸 수 없다.
        // 레포 표준대로 전역 인스턴스의 t 를 쓴다 (템플릿에서는 $t 를 그대로 쓴다).
        // params 를 주면 메시지의 {name} 자리를 채운다 (vue-i18n 보간).
        const t = (key, params) =>
            (params ? window.$i18n?.global?.t(key, params) : window.$i18n?.global?.t(key)) ?? key;
        const {
            auditLogs,
            auditTotal,
            adminAuditLogs,
            adminAuditTotal,
            authLoginAudit,
            authLoginAuditTotal,
            loading,
            cutoverJobs
        } = storeToRefs(store);

        // 감사로그의 대상(target)이 프로세스를 가리키는 타입 — target_id를 proc_def_id로 가정하고 BPMN 화면으로 새 창 라우팅
        const PROCESS_LINKABLE_TARGET_TYPES = new Set([
            'public_feedback_review',
            'process',
            'process_definition',
            'proc_def'
        ]);

        function isProcessLinkable(item) {
            return !!item?.target_id && PROCESS_LINKABLE_TARGET_TYPES.has(String(item?.target_type || ''));
        }

        function openTargetProcessInNewTab(item) {
            if (!isProcessLinkable(item)) return;
            const procDefId = String(item.target_id);
            const reviewId = (() => {
                const safeParseLocal = (v) => {
                    try { return v ? JSON.parse(v) : null; } catch { return null; }
                };
                const a = safeParseLocal(item.after_value);
                const b = safeParseLocal(item.before_value);
                return a?.review_id || b?.review_id || '';
            })();
            const route = router.resolve({
                name: 'Process Hierarchy',
                query: buildProcessHierarchyQuery({
                    id: procDefId,
                    name: item.target_name || procDefId,
                    entry: PROCESS_HIERARCHY_ENTRY.REVIEW_BOARD,
                    mode: PROCESS_HIERARCHY_MODE.VIEW,
                    left: PROCESS_HIERARCHY_PANEL_STATE.EXPANDED,
                    right: PROCESS_HIERARCHY_PANEL_STATE.OPEN,
                    rightTab: PROCESS_HIERARCHY_RIGHT_TAB.GOVERNANCE,
                    reviewId
                })
            });
            window.open(route.href, '_blank', 'noopener');
        }

        // ────────────────────────────────────────────────────────────────
        // 탭 정의 — 이 화면의 단일 확장 지점.
        //
        // 탭 하나를 추가하려면
        //   ① TAB_DEFS 에 { key, labelKey, filters, showCutover } 를 추가하고
        //   ② tabLoaders / tabExporters / tabItems 에 같은 key 로 항목을 넣고
        //   ③ 템플릿에 <template v-else-if="activeTab === '<key>'"> 테이블 블록을 붙인다.
        // 탭 바·필터 바·페이지네이션·CSV 버튼은 전부 이 정의를 보고 동작하므로 손대지 않는다.
        //
        // filters 에 적는 값은 아래 filters ref 의 키이며, 그 키가 들어 있는 탭에서만
        // 해당 필터 UI 가 보인다(showFilter).
        // ────────────────────────────────────────────────────────────────
        const TAB_DEFS = [
            {
                key: 'approval',
                labelKey: 'auditLog.tabApproval',
                filters: ['startDate', 'endDate', 'action', 'actorId'],
                showCutover: true
            },
            {
                key: 'admin',
                labelKey: 'auditLog.tabAdmin',
                filters: ['startDate', 'endDate', 'adminAction', 'targetType', 'actorId'],
                showCutover: true
            },
            {
                key: 'login',
                labelKey: 'auditLog.tabLogin',
                filters: ['startDate', 'endDate', 'email', 'loginAction', 'success'],
                showCutover: false
            },
            {
                key: 'download',
                labelKey: 'auditLog.tabDownload',
                filters: ['startDate', 'endDate', 'email', 'bucket'],
                showCutover: false
            }
        ];

        const activeTab = ref('admin');
        const pageSize = ref(25);
        const adminExpanded = ref([]);
        const cutoverExpanded = ref(false);

        const filters = ref({
            startDate: '',
            endDate: '',
            action: '',
            adminAction: '',
            actorId: '',
            targetType: '',
            // 로그인 이력 탭 — 현재 클라이언트는 실패도 action='login' + success=false 로
            // 기록하므로 액션과 성공 여부를 별개 필터로 둔다.
            email: '',
            loginAction: '',
            success: '',
            // 다운로드 이력 탭 — 버킷 선택지는 이력에 실제로 등장한 값에서 뽑는다.
            bucket: ''
        });

        const currentTabDef = computed(() => TAB_DEFS.find((tab) => tab.key === activeTab.value) || TAB_DEFS[0]);
        const showCutoverCard = computed(() => !!currentTabDef.value.showCutover);

        function showFilter(name) {
            return currentTabDef.value.filters.includes(name);
        }


        const approvalHeaders = [
            { title: '일시', key: 'created_at', width: '180px', sortable: false },
            { title: '액션', key: 'action', width: '140px', sortable: false },
            { title: '이전 상태', key: 'from_state', width: '110px', sortable: false },
            { title: '이후 상태', key: 'to_state', width: '110px', sortable: false },
            { title: '수행자', key: 'actor_id', width: '160px', sortable: false },
            { title: '코멘트', key: 'comment', sortable: false },
        ];

        const adminHeaders = [
            { title: '일시', key: 'created_at', width: '180px', sortable: false },
            { title: '수행자', key: 'actor', width: '200px', sortable: false },
            { title: '액션', key: 'what', sortable: false },
            { title: '변경 내역', key: 'changes', sortable: false },
        ];

        const loginHeaders = computed(() => [
            { title: t('auditLog.loginAudit.columnTime'), key: 'created_at', width: '180px', sortable: false },
            { title: t('auditLog.loginAudit.columnEmail'), key: 'email', width: '200px', sortable: false },
            { title: t('auditLog.loginAudit.columnAction'), key: 'action', width: '120px', sortable: false },
            { title: t('auditLog.loginAudit.columnResult'), key: 'success', width: '100px', sortable: false },
            { title: t('auditLog.loginAudit.columnError'), key: 'error_message', sortable: false },
            { title: t('auditLog.loginAudit.columnIp'), key: 'ip_address', width: '130px', sortable: false },
            { title: t('auditLog.loginAudit.columnUserAgent'), key: 'user_agent', width: '170px', sortable: false },
            { title: t('auditLog.loginAudit.columnProvider'), key: 'provider', width: '140px', sortable: false }
        ]);

        // ── 다운로드 이력 탭 (docs/security.md 3-3, 항목 8·18) ──
        // 원천: public.file_download_log — 기록은 record_file_download RPC 로만 들어오고
        // 조회는 관리자 RLS 를 통과한 행(같은 테넌트)만 돌아온다.
        // 잠금 계정 패널과 같은 이유로 store 를 거치지 않고 backend 를 직접 부른다.
        const fileDownloadLog = ref([]);
        const fileDownloadTotal = ref(0);
        const downloadLoading = ref(false);
        const downloadError = ref('');
        const downloadBuckets = ref([]);

        const downloadHeaders = computed(() => [
            { title: t('auditLog.downloadAudit.columnTime'), key: 'created_at', width: '180px', sortable: false },
            { title: t('auditLog.downloadAudit.columnEmail'), key: 'email', width: '200px', sortable: false },
            { title: t('auditLog.downloadAudit.columnFile'), key: 'file_name', sortable: false },
            { title: t('auditLog.downloadAudit.columnBucket'), key: 'bucket', width: '140px', sortable: false },
            { title: t('auditLog.downloadAudit.columnAction'), key: 'action', width: '120px', sortable: false },
            { title: t('auditLog.downloadAudit.columnIp'), key: 'ip_address', width: '130px', sortable: false }
        ]);

        const DOWNLOAD_ACTION_LABELS = {
            download: 'auditLog.downloadAudit.actionDownload',
            signed_url: 'auditLog.downloadAudit.actionSignedUrl',
            view: 'auditLog.downloadAudit.actionView'
        };

        function getDownloadActionLabel(action) {
            const key = DOWNLOAD_ACTION_LABELS[String(action || '')];
            return key ? t(key) : (action || '—');
        }

        function getDownloadActionChipClass(action) {
            const map = { download: 'chip-blue', signed_url: 'chip-amber', view: 'chip-grey' };
            return map[String(action || '')] || 'chip-grey';
        }

        // 업로드 때 `<타임스탬프>_<uuid8>.<확장자>` 로 이름을 바꾼다(StorageBaseSupabase.uploadFile).
        // file_name 이 비어 있는 옛 기록은 경로에서 그 앞머리를 떼어 원래 이름을 되살린다.
        function formatDownloadFileName(item) {
            const name = String(item?.file_name || '').trim();
            if (name) return name;
            const last = String(item?.path || '').split('/').pop() || '';
            return last.split('_').slice(1).join('_') || last || '—';
        }

        async function loadFileDownloadLog(page = 1) {
            if (!backend.getFileDownloadLog) return;
            downloadLoading.value = true;
            downloadError.value = '';
            try {
                const result = await backend.getFileDownloadLog({
                    startDate: filters.value.startDate || undefined,
                    endDate: filters.value.endDate || undefined,
                    email: filters.value.email || undefined,
                    bucket: filters.value.bucket || undefined,
                    page,
                    pageSize: pageSize.value
                });
                fileDownloadLog.value = result?.data || [];
                fileDownloadTotal.value = result?.total || 0;
            } catch (e) {
                fileDownloadLog.value = [];
                fileDownloadTotal.value = 0;
                // 마이그레이션 미적용 환경에서는 표 자체가 없다. 오류로 놀라게 할 필요는 없다.
                const code = e?.code || '';
                downloadError.value =
                    code === '42P01' || code === 'PGRST205'
                        ? ''
                        : e?.message || t('auditLog.downloadAudit.loadError');
            } finally {
                downloadLoading.value = false;
            }
        }

        async function loadDownloadBuckets() {
            if (!backend.getFileDownloadBuckets) return;
            try {
                downloadBuckets.value = (await backend.getFileDownloadBuckets()) || [];
            } catch (_e) {
                downloadBuckets.value = [];
            }
        }

        // 탭 key → 현재 표시 중인 행 목록 (CSV 버튼 활성화 판단 및 내보내기 대상)
        const tabItems = {
            approval: auditLogs,
            admin: adminAuditLogs,
            login: authLoginAudit,
            download: fileDownloadLog
        };

        const currentExportDisabled = computed(() => (tabItems[activeTab.value]?.value?.length || 0) === 0);

        // 탭 key → 조회 함수. 필터 매핑도 여기서만 한다.
        const tabLoaders = {
            approval: (page) =>
                store.fetchAuditLogs({
                    startDate: filters.value.startDate || undefined,
                    endDate: filters.value.endDate || undefined,
                    action: filters.value.action || undefined,
                    actorId: filters.value.actorId || undefined,
                    page,
                    pageSize: pageSize.value
                }),
            admin: (page) =>
                store.fetchAdminAuditLogs({
                    startDate: filters.value.startDate || undefined,
                    endDate: filters.value.endDate || undefined,
                    action: filters.value.adminAction || undefined,
                    actorId: filters.value.actorId || undefined,
                    targetType: filters.value.targetType || undefined,
                    page,
                    pageSize: pageSize.value
                }),
            login: (page) =>
                store.fetchAuthLoginAudit({
                    startDate: filters.value.startDate || undefined,
                    endDate: filters.value.endDate || undefined,
                    email: filters.value.email || undefined,
                    action: filters.value.loginAction || undefined,
                    // '' = 전체. 'true'/'false' 만 boolean 으로 넘긴다.
                    success: filters.value.success === '' ? undefined : filters.value.success === 'true',
                    page,
                    pageSize: pageSize.value
                }),
            download: (page) => loadFileDownloadLog(page)
        };

        async function loadLogs(page = 1) {
            const load = tabLoaders[activeTab.value];
            if (load) await load(page);
        }

        // v-data-table-server 가 페이지 사이즈 변경 시 itemsPerPage 도 전달함.
        // 모든 탭이 같은 페이지네이션 동작을 쓰므로 핸들러도 하나만 둔다.
        function onTableUpdate({ page, itemsPerPage }) {
            if (typeof itemsPerPage === 'number' && itemsPerPage !== pageSize.value) {
                pageSize.value = itemsPerPage;
            }
            loadLogs(page);
        }

        function switchTab(tab) {
            activeTab.value = tab;
            adminExpanded.value = [];
            loadLogs(1);
            if (tab === 'login') loadLockedAccounts();
            if (tab === 'download') loadDownloadBuckets();
        }

        function onFilterChange() {
            loadLogs(1);
        }

        // ────────────────────────────────────────────────────────────────
        // 잠금 계정 패널 (docs/security.md 2-4, 항목 18)
        //
        // 로그인 이력(auth_login_audit)과 원천이 다르다. 잠금 카운트는 GoTrue 의
        // password_verification_attempt 훅이 직접 쓰는 public.auth_failed_attempts 이고,
        // 그 테이블에는 클라이언트 권한이 없어 SECURITY DEFINER RPC 로만 접근한다.
        //   조회: admin_list_locked_accounts()  해제: admin_unlock_account()
        //   마이그레이션: supabase/migrations/20260911_password_lockout_hook.sql
        //
        // ※ 다른 탭들은 adminConsole store 를 경유하지만 이 패널은 backend 를 직접 부른다.
        //   store 통합은 후속 작업 (docs/security-gotrue-lockout-policy.md 참고).
        // ────────────────────────────────────────────────────────────────
        const backend = BackendFactory.createBackend();
        const lockedAccounts = ref([]);
        const lockedLoading = ref(false);
        const lockedError = ref('');
        const unlockDialog = ref(false);
        const unlockTarget = ref(null);
        const unlocking = ref(false);

        async function loadLockedAccounts() {
            if (lockedLoading.value) return;
            lockedLoading.value = true;
            lockedError.value = '';
            try {
                // 훅/마이그레이션이 아직 적용되지 않은 환경에서는 RPC 자체가 없다.
                // 그 경우에도 로그인 이력 탭 본체는 정상 동작해야 하므로 패널만 조용히 비운다.
                lockedAccounts.value = (await backend.getLockedAccounts?.()) || [];
            } catch (e) {
                lockedAccounts.value = [];
                const code = e?.code || '';
                if (code === 'PGRST202' || code === '42883') {
                    // 함수 미배포 — 관리자에게 오류로 보일 필요는 없다.
                    lockedError.value = '';
                } else {
                    lockedError.value = e?.message || t('auditLog.loginAudit.lockout.loadError');
                }
            } finally {
                lockedLoading.value = false;
            }
        }

        function openUnlockDialog(account) {
            unlockTarget.value = account;
            unlockDialog.value = true;
        }

        function closeUnlockDialog() {
            if (unlocking.value) return;
            unlockDialog.value = false;
            unlockTarget.value = null;
        }

        async function confirmUnlock() {
            const target = unlockTarget.value;
            if (!target || unlocking.value) return;
            unlocking.value = true;
            try {
                await backend.unlockAccount({ email: target.email, userId: target.user_id });
                unlockDialog.value = false;
                unlockTarget.value = null;
                await loadLockedAccounts();
                // 해제 직후 로그인 이력도 최신화 (잠금 기록이 목록에 남아 있다)
                loadLogs(1);
            } catch (e) {
                lockedError.value = e?.message || t('auditLog.loginAudit.lockout.unlockError');
                unlockDialog.value = false;
                unlockTarget.value = null;
            } finally {
                unlocking.value = false;
            }
        }

        // "해제까지 N분" — 목록 조회 시점 기준의 대략값. 초 단위 갱신은 하지 않는다.
        function formatLockRemaining(lockedUntil) {
            if (!lockedUntil) return '';
            const remainMs = new Date(lockedUntil).getTime() - Date.now();
            if (!Number.isFinite(remainMs) || remainMs <= 0) return '';
            const minutes = Math.max(1, Math.ceil(remainMs / 60000));
            return t('auditLog.loginAudit.lockout.remaining', { minutes });
        }

        function onActorEnter() {
            loadLogs(1);
        }

        function formatDatetime(isoStr) {
            if (!isoStr) return '—';
            return formatKST(isoStr, 'YYYY년 M월 D일 A h:mm', isoStr).replace('AM', '오전').replace('PM', '오후');
        }

        function truncateComment(text) {
            if (!text) return '—';
            return text.length > 40 ? text.slice(0, 40) + '…' : text;
        }

        function formatAdminActor(log) {
            if (!log) return '—';
            const identity = (log.actor_username || log.actor_employee_no)
                ? {
                      username: log.actor_username,
                      org_name: log.actor_org_name,
                      employee_no: log.actor_employee_no
                  }
                : null;
            return formatIdentityFull(identity, log.actor_id || '—');
        }

        // 승인 이력 탭의 actor 표시 — 통합 formatIdentityFull 사용 (다른 화면들과 일관)
        // lookup 실패 시 fallback 순서: actor_name 컬럼 (테이블 저장됨) → raw actor_id
        function formatApprovalActor(log) {
            if (!log) return '—';
            const identity = (log.actor_username || log.actor_employee_no)
                ? {
                      username: log.actor_username,
                      org_name: log.actor_org_name,
                      employee_no: log.actor_employee_no
                  }
                : null;
            const fallback = log.actor_name || log.actor_id || '—';
            return formatIdentityFull(identity, fallback);
        }

        // proc_def state → 공통 STAGE_DEFS 의 label 매핑 (0단계 ~ 4단계)
        // 5단계 외 상태(rejected, archived 등)는 raw 값 유지
        function getStateLabel(state) {
            const stage = mapStateToStage(state);
            if (stage === 'none') return state || '—';
            const def = STAGE_DEFS.find((s) => s.stage === stage);
            return def ? def.label : (state || '—');
        }

        function getActionChipClass(action) {
            const map = {
                submit: 'chip-blue',
                approve: 'chip-green',
                reject: 'chip-red',
                reset_approvals: 'chip-orange',
                request_changes: 'chip-amber',
                publish: 'chip-teal',
                unpublish: 'chip-grey',
                cancel: 'chip-pink'
            };
            return map[action] || 'chip-default';
        }

        const APPROVAL_ACTION_LABELS = {
            submit: '검토 요청',
            approve: '승인',
            approve_field: '현업 승인',
            approve_hq: '본사 승인',
            reject: '반려',
            reset_approvals: '승인 초기화',
            request_changes: '수정 요청',
            publish: '게시',
            unpublish: '게시 취소',
            cancel: '취소',
            admin_shorten_public_feedback: '공람 종료일 단축',
            admin_end_public_feedback: '공람 즉시 종료',
            admin_adjust_public_feedback_period: '공람 기간 조정',
            end_public_feedback: '공람 종료'
        };

        const ADMIN_ACTION_LABELS = {
            schema_create: '스키마 생성',
            schema_update: '스키마 수정',
            schema_soft_delete: '스키마 휴지통 이동',
            schema_restore: '스키마 복원',
            schema_hard_delete: '스키마 영구 삭제',
            schema_activate: '스키마 활성화',
            schema_deactivate: '스키마 비활성화',
            process_create: '프로세스 생성',
            process_update: '프로세스 수정',
            process_parent_change: '프로세스 계층 위치 변경',
            process_soft_delete: '프로세스 휴지통 이동',
            process_restore: '프로세스 복원',
            process_hard_delete: '프로세스 영구 삭제',
            system_create: '시스템 생성',
            system_update: '시스템 수정',
            system_soft_delete: '시스템 휴지통 이동',
            system_restore: '시스템 복원',
            system_hard_delete: '시스템 영구 삭제',
            instance_hard_delete: '인스턴스 영구 삭제',
            permission_change: '권한 변경',
            menu_permission_change: '메뉴 권한 변경',
            // 반복 로그인 실패 잠금 해제 (admin_unlock_account RPC 가 남긴다)
            account_unlock: '계정 잠금 해제',
            maintenance_toggle: '점검 모드 전환',
            notice_banner_update: '공지 배너 설정 변경',
            restructure_draft_create: '구조개편 초안 생성',
            restructure_approve: '구조개편 승인',
            restructure_reject: '구조개편 반려',
            restructure_apply: '구조개편 적용',
            restructure_apply_failed: '구조개편 적용 실패',
            audit_policy_create: '정책 생성',
            audit_policy_restore: '정책 복원',
            audit_policy_soft_delete: '정책 휴지통 이동',
            audit_policy_hard_delete: '정책 영구 삭제',
            admin_shorten_public_feedback: '공람 종료일 단축',
            admin_end_public_feedback: '공람 즉시 종료',
            kpi_target_create: 'KPI 목표 생성',
            kpi_target_update: 'KPI 목표 수정',
            kpi_target_delete: 'KPI 목표 휴지통 이동',
            kpi_target_restore: 'KPI 목표 복원',
            kpi_target_hard_delete: 'KPI 목표 영구 삭제',
            pi_flag_type_create: 'PI Flag 유형 생성',
            pi_flag_type_delete: 'PI Flag 유형 휴지통 이동',
            pi_flag_type_hard_delete: 'PI Flag 유형 영구 삭제',
            lane_role_group_create: '역할 그룹 생성',
            lane_role_group_update: '역할 그룹 수정',
            lane_role_group_delete: '역할 그룹 삭제',
            lane_role_group_restore: '역할 그룹 복원',
            lane_role_group_hard_delete: '역할 그룹 영구 삭제',
            supplier_create: '외부협력사 생성',
            supplier_update: '외부협력사 수정',
            supplier_soft_delete: '외부협력사 휴지통 이동',
            supplier_restore: '외부협력사 복원',
            supplier_hard_delete: '외부협력사 영구 삭제',
            data_freeze_lock: '프로세스 수정 잠금',
            data_freeze_unlock: '프로세스 수정 잠금 해제',
            task_api_integration_change: 'API 연동 변경',
            task_manual_link_change: '관련자료 링크 변경',
            task_type_visibility_update: 'Task 종류 활성화 설정',
            event_type_visibility_update: 'Event 종류 활성화 설정',
            audit_retention_update: '감사 로그 보존 기간 변경',
            security_settings_update: '보안 설정 변경',
            // 활동 로그 전면 수집 (specs/002-activity-audit-logging)
            page_view: '페이지 조회',
            process_architecture_export: '프로세스 체계도 내보내기',
            process_domain_create: '도메인 추가',
            process_domain_update: '도메인 수정',
            process_domain_delete: '도메인 삭제',
            process_domain_reorder: '도메인 순서 변경',
            process_uncategorized_assign: '미분류 프로세스 배정',
            menu_settings_update: '메뉴 표시 설정 변경',
            menu_role_override_update: '메뉴 필요 역할 변경',
            review_bulk_approve: '검토 일괄 승인',
            review_bulk_reject: '검토 일괄 반려',
            review_bulk_publish: '검토 일괄 게시',
            call_activity_delete: '프로세스 목록 삭제',
            glossary_term_create: '용어 등록',
            glossary_term_update: '용어 수정',
            glossary_term_delete: '용어 삭제',
            org_chart_update: '조직도 저장',
            org_team_create: '조직 팀 추가',
            org_team_update: '조직 팀 수정',
            org_team_delete: '조직 팀 삭제',
            org_member_assign: '조직 구성원 배치',
            org_member_remove: '조직 구성원 제외',
            org_role_update: '조직 역할 변경',
            org_agent_create: '에이전트 추가',
            org_agent_delete: '에이전트 삭제',
            org_user_delete: '사용자 삭제',
            role_request_submit: '권한 변경 신청',
            role_request_approve: '권한 신청 승인',
            role_request_reject: '권한 신청 반려',
            dashboard_settings_update: '대시보드 설정 변경',
            task_catalog_create: 'Task 카탈로그 등록',
            task_catalog_update: 'Task 카탈로그 수정',
            task_catalog_delete: 'Task 카탈로그 삭제',
            governance_blacklist_add: '거버넌스 블랙리스트 추가',
            governance_blacklist_remove: '거버넌스 블랙리스트 제거',
            schema_export: '스키마 템플릿 내보내기',
            audit_log_export: '감사 로그 내보내기'
        };

        const TARGET_TYPE_LABELS = {
            property_schema: '속성 스키마',
            process: '프로세스',
            permission: '권한',
            system: '시스템',
            audit_policy: '정책 문서',
            custom_permission: '임시 권한',
            kpi_target: 'KPI 목표',
            pi_flag_type: 'PI Flag 유형',
            lane_role_group: '역할 그룹',
            supplier: '외부협력사',
            data_freeze: '프로세스 수정 잠금',
            task_event_type: 'Task/Event 종류',
            task: '태스크',
            page: '페이지',
            review: '프로세스 검토',
            glossary_term: '용어',
            organization: '조직도',
            role_request: '권한 신청',
            dashboard: '분석 대시보드',
            task_catalog: 'Task 카탈로그',
            governance: '데이터 거버넌스',
            audit_log: '감사 로그'
        };

        const approvalActionCodes = Object.keys(APPROVAL_ACTION_LABELS);
        const adminActionCodes = Object.keys(ADMIN_ACTION_LABELS);
        const targetTypeCodes = Object.keys(TARGET_TYPE_LABELS);

        function getTargetTypeLabel(code) {
            return TARGET_TYPE_LABELS[code] || '';
        }

        function getTargetTypeOptionLabel(code) {
            const label = getTargetTypeLabel(code);
            return label ? `${label}(${code})` : code;
        }

        const CHANGE_KEY_LABELS = {
            name: '이름',
            code: '키',
            label: '이름',
            display_name: '표시명',
            description: '설명',
            hierarchy_location: '계층 위치',
            status: '상태',
            state: '상태',
            version: '버전',
            version_label: '버전',
            category: '분류',
            system_type: '유형',
            responsible_person: '담당자',
            shortcut_link: '바로가기 링크',
            registration_status: '등록 상태',
            required_role: '필요 권한',
            role: '권한',
            is_admin: '관리자 여부',
            type_id: 'ID',
            permission_ids: '임시 권한 목록',
            public_feedback_ends_at: '공개 피드백 종료일',
            public_feedback_starts_at: '공개 피드백 시작일',
            fte: 'FTE',
            owner: '담당자',
            primaryOwner: '프로세스 담당자',
            masterOwner: '최종검토자',
            fieldOwners: '현업담당자',
            hqOwners: '검토담당자',
            proc_def_name: '프로세스명',
            proc_def_id: '프로세스 ID',
            proc_inst_id: '인스턴스 ID',
            target_name: '대상명',
            order_index: '정렬 순서',
            sort_order: '정렬 순서',
            active: '사용 여부',
            is_active: '활성 여부',
            is_deleted: '삭제 여부',
            enabled: '활성화',
            text: '문구',
            color: '색상',
            message: '안내 문구',
            start_date: '시작일',
            end_date: '종료일',
            activated_by: '활성화한 사람',
            activated_role: '활성화 권한',
            activated_at: '활성화 일시',
            deleted_at: '삭제 일시',
            approval_status: '승인 상태',
            approved_by: '승인자',
            approved_at: '승인 일시',
            rejected_by: '반려자',
            rejected_at: '반려 일시',
            executed_by: '실행자',
            executed_at: '실행 일시',
            failed_at: '실패 일시',
            cloned_from: '복제 원본',
            year: '연도',
            org_id: '조직 ID',
            org_name: '조직명',
            parent: '상위 조직',
            process_ids: '프로세스 목록',
            deleted_by: '삭제자',
            parent_name: '상위 그룹',
            members: '연결된 팀',
            members_added: '추가된 팀',
            members_removed: '제거된 팀',
            sub_groups: '하위 그룹 구성',
            children_removed: '함께 삭제된 하위 그룹',
            method: '메서드',
            url: 'URL',
            params: '파라미터'
        };

        function getApprovalActionLabel(action) {
            return APPROVAL_ACTION_LABELS[action] || '';
        }

        function getAdminActionLabel(action, item = null) {
            if (action === 'permission_change' && item?.target_type === 'custom_permission') {
                return '임시 권한 설정';
            }
            return ADMIN_ACTION_LABELS[action] || '';
        }

        function getApprovalActionOptionLabel(code) {
            const label = getApprovalActionLabel(code);
            return label ? `${label}(${code})` : code;
        }

        function getAdminActionOptionLabel(code) {
            const label = getAdminActionLabel(code);
            return label ? `${label}(${code})` : code;
        }

        // ── 로그인 이력 (auth_login_audit) ─────────────────────────────
        // action 허용값은 마이그레이션의 CHECK 제약과 동일하다.
        const LOGIN_ACTION_LABEL_KEYS = {
            login: 'auditLog.loginAudit.actionLogin',
            login_failed: 'auditLog.loginAudit.actionLoginFailed',
            logout: 'auditLog.loginAudit.actionLogout',
            login_oauth: 'auditLog.loginAudit.actionLoginOauth'
        };

        const loginActionCodes = Object.keys(LOGIN_ACTION_LABEL_KEYS);

        function getLoginActionLabel(action) {
            const key = LOGIN_ACTION_LABEL_KEYS[action];
            return key ? t(key) : action || '—';
        }

        function getLoginActionOptionLabel(code) {
            return `${getLoginActionLabel(code)}(${code})`;
        }

        // 실패한 시도는 action 이 'login' 이어도 빨간 칩으로 보이게 한다.
        function getLoginActionChipClass(item) {
            if (item && item.success === false) return 'chip-red';
            const map = {
                login: 'chip-blue',
                login_oauth: 'chip-teal',
                logout: 'chip-grey',
                login_failed: 'chip-red'
            };
            return map[item?.action] || 'chip-default';
        }

        // User-Agent 는 길어서 표에 그대로 못 쓴다. "브라우저 · OS" 로 축약하고
        // 원문은 title 속성(툴팁)으로 남긴다. 규칙은 위에서부터 먼저 맞는 것 하나.
        const UA_BROWSER_RULES = [
            [/Edg[A-Za-z]*\//, 'Edge'],
            [/OPR\/|Opera/, 'Opera'],
            [/Whale\//, 'Whale'],
            [/SamsungBrowser\//, 'Samsung Internet'],
            [/Firefox\//, 'Firefox'],
            [/Chrome\//, 'Chrome'],
            [/Safari\//, 'Safari']
        ];

        const UA_OS_RULES = [
            [/Windows NT/, 'Windows'],
            [/iPhone|iPad|iPod/, 'iOS'],
            [/Android/, 'Android'],
            [/Mac OS X/, 'macOS'],
            [/Linux/, 'Linux']
        ];

        function summarizeUserAgent(ua) {
            if (!ua) return '—';
            const browser = UA_BROWSER_RULES.find(([re]) => re.test(ua));
            const os = UA_OS_RULES.find(([re]) => re.test(ua));
            const parts = [browser && browser[1], os && os[1]].filter(Boolean);
            if (parts.length > 0) return parts.join(' · ');
            return ua.length > 40 ? `${ua.slice(0, 40)}…` : ua;
        }

        function getAuthMeta(item) {
            const meta = item?.metadata;
            if (!meta) return {};
            if (typeof meta === 'string') {
                try { return JSON.parse(meta) || {}; } catch { return {}; }
            }
            return typeof meta === 'object' ? meta : {};
        }

        // metadata.provider(keycloak 등) / metadata.method(password 등)
        function formatAuthMeta(item) {
            const meta = getAuthMeta(item);
            const parts = [meta.provider, meta.method].filter(Boolean);
            return parts.length > 0 ? parts.join(' · ') : '—';
        }

        // 툴팁에는 metadata 전체(reason, origin, referer, host 등)를 보여준다.
        function formatAuthMetaTitle(item) {
            const meta = getAuthMeta(item);
            const keys = Object.keys(meta);
            if (keys.length === 0) return '';
            return keys.map((key) => `${key}: ${meta[key]}`).join('\n');
        }

        function formatCutoverTitle(job) {
            const raw = String(job?.title || '').trim();
            const action = raw.split('·').pop()?.trim() || raw;
            const map = {
                'add-major': 'Major 추가',
                'move-major': 'Major 이동',
                'rename-major': 'Major 이름 변경',
                'delete-major': 'Major 삭제',
                restructure: '구조개편',
                cutover: '반영'
            };
            return `구조개편 반영 · ${map[action] || action || '상세 작업'}`;
        }

        function formatCutoverStatus(status) {
            const map = {
                completed: '완료',
                failed: '실패',
                running: '진행 중',
                pending: '대기'
            };
            return map[status] || status || '-';
        }

        function formatCutoverApprovalType(type) {
            const map = {
                structure_restructure: '구조개편',
                restructure: '구조개편'
            };
            return map[type] || type || '-';
        }

        function getChangeKeyLabel(key) {
            return CHANGE_KEY_LABELS[key] || '';
        }

        function getAdminActionChipClass(action) {
            if (!action) return 'chip-default';
            if (action.includes('hard_delete')) return 'chip-red';
            if (action.includes('delete')) return 'chip-orange';
            if (action.includes('restore')) return 'chip-grey';
            if (action.includes('create')) return 'chip-green';
            return 'chip-blue';
        }

        const META_KEYS = ['id', 'tenant_id', 'created_at', 'updated_at'];

        function safeParse(val) {
            if (!val) return null;
            try { return typeof val === 'string' ? JSON.parse(val) : val; }
            catch { return null; }
        }

        // 객체 비교 시 키 순서에 의존하지 않도록 정렬된 JSON 문자열 생성
        // (write 단계의 spread 등으로 동일 데이터가 다른 키 순서로 직렬화돼 "가짜 변경"으로 잡히는 문제 방지)
        function canonicalStringify(val) {
            if (val === null || typeof val !== 'object') return JSON.stringify(val);
            if (Array.isArray(val)) return '[' + val.map(canonicalStringify).join(',') + ']';
            const keys = Object.keys(val).sort();
            return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalStringify(val[k])).join(',') + '}';
        }

        function buildChangeSummary(log) {
            const before = safeParse(log.before_value);
            const after = safeParse(log.after_value);
            if (!before && !after) return '—';

            const allKeys = new Set([
                ...Object.keys(before || {}).filter(k => !META_KEYS.includes(k)),
                ...Object.keys(after || {}).filter(k => !META_KEYS.includes(k)),
            ]);

            const changed = [];
            for (const key of allKeys) {
                const bVal = before ? before[key] : undefined;
                const aVal = after ? after[key] : undefined;
                if (canonicalStringify(bVal) !== canonicalStringify(aVal)) changed.push(key);
            }

            if (changed.length === 0) return '—';
            const labeled = changed.map(k => CHANGE_KEY_LABELS[k] || k);
            if (labeled.length <= 2) return labeled.join(', ') + ' 변경';
            return `${labeled.slice(0, 2).join(', ')} 외 ${labeled.length - 2}건 변경`;
        }

        function isDatetimeKey(key) {
            return typeof key === 'string' && key.endsWith('_at');
        }

        // before/after JSON 내부에서 사용자 ID 가 들어가는 키 (백엔드와 동일 목록)
        //   - scalar: 단일 사용자 ID 문자열 → username 으로 치환
        //   - array: 사용자 ID 배열 → 각 원소 username 으로 치환 후 콤마 구분
        const USER_ID_SCALAR_FIELDS = new Set(['primaryOwner', 'owner', 'masterOwner']);
        const USER_ID_ARRAY_FIELDS = new Set(['fieldOwners', 'hqOwners']);
        const PROCESS_ID_SCALAR_FIELDS = new Set(['cloned_from', 'proc_def_id']);
        const PROCESS_ID_ARRAY_FIELDS = new Set(['process_ids']);

        // 2줄 포맷 — 1줄: "이름(사번)" / 2줄: "팀"
        // 한 사용자 정보가 한 뭉텅이로 시각적으로 그룹화되어, 배열로 여러 명 있어도 안 헷갈림
        function formatUserLookup(profile, fallback) {
            if (!profile?.username) return fallback;
            const nameWithEmpNo = profile.employee_no
                ? `${profile.username}(${profile.employee_no})`
                : profile.username;
            return profile.org_name ? `${nameWithEmpNo}\n${profile.org_name}` : nameWithEmpNo;
        }

        // 배열·scalar 동일 포맷 사용 (한 사용자 = 2줄 묶음)
        // 배열일 땐 사용자 사이를 빈 줄로 구분 (white-space: pre-line + 빈 줄)
        function formatUserLookupCompact(profile, fallback) {
            return formatUserLookup(profile, fallback);
        }

        function formatPermissionLookup(permission, fallback) {
            return permission?.label || permission?.name || fallback;
        }

        function formatProcessLookup(process, fallback) {
            if (!process?.name) return fallback;
            return process.name === fallback ? process.name : `${process.name} (${fallback})`;
        }

        function formatChangeValue(key, val, userLookups, permissionLookups, processLookups) {
            if (val === null || val === undefined) return String(val);
            if (typeof val === 'boolean') return val ? '활성화' : '비활성화';

            if (key === 'permission_ids' && Array.isArray(val)) {
                if (val.length === 0) return '(없음)';
                return val
                    .map((id) => {
                        const idStr = String(id);
                        return formatPermissionLookup(permissionLookups && permissionLookups[idStr], idStr);
                    })
                    .join('\n');
            }

            if (PROCESS_ID_ARRAY_FIELDS.has(key) && Array.isArray(val)) {
                if (val.length === 0) return '(없음)';
                return val
                    .map((id) => {
                        const idStr = String(id);
                        return formatProcessLookup(processLookups && processLookups[idStr], idStr);
                    })
                    .join('\n');
            }

            // 배열 user-ID 필드: 각 원소를 lookup 해 한 사용자=2줄(이름·팀) 형식으로 변환.
            // 사용자 사이는 빈 줄로 구분 — CSS white-space: pre-line 으로 줄바꿈 렌더됨
            if (USER_ID_ARRAY_FIELDS.has(key) && Array.isArray(val)) {
                if (val.length === 0) return '(없음)';
                return val
                    .map((id) => {
                        const idStr = String(id);
                        const profile = userLookups && userLookups[idStr];
                        return profile ? formatUserLookupCompact(profile, idStr) : idStr;
                    })
                    .join('\n\n');
            }

            if (typeof val === 'object') return JSON.stringify(val);
            const str = String(val);
            if (USER_ID_SCALAR_FIELDS.has(key) && userLookups && userLookups[str]) {
                return formatUserLookup(userLookups[str], str);
            }
            if (PROCESS_ID_SCALAR_FIELDS.has(key) && processLookups && processLookups[str]) {
                return formatProcessLookup(processLookups[str], str);
            }
            if (isDatetimeKey(key) && /^\d{4}-\d{2}-\d{2}T/.test(str)) {
                const d = new Date(str);
                if (!isNaN(d.getTime())) return formatDatetime(str);
            }
            return str;
        }

        function buildChangeDetails(log) {
            const before = safeParse(log.before_value);
            const after = safeParse(log.after_value);
            if (!before && !after) return [];

            const details = [];
            if (log?.target_type === 'task_event_type') {
                const displayName = after?.name || before?.name || log.target_name;
                const typeId = after?.type_id || before?.type_id || log.target_id;
                if (displayName) details.push({ key: 'name', type: 'info', after: displayName });
                if (typeId) details.push({ key: 'type_id', type: 'info', after: typeId });
            }

            const allKeys = new Set([
                ...Object.keys(before || {}).filter(k => !META_KEYS.includes(k)),
                ...Object.keys(after || {}).filter(k => !META_KEYS.includes(k)),
            ]);

            for (const key of allKeys) {
                if (log?.target_type === 'task_event_type' && (key === 'name' || key === 'type_id')) continue;
                const bVal = before ? before[key] : undefined;
                const aVal = after ? after[key] : undefined;
                if (canonicalStringify(bVal) === canonicalStringify(aVal)) continue;

                const bStr = bVal !== undefined ? formatChangeValue(key, bVal, log.user_lookups, log.permission_lookups, log.process_lookups) : undefined;
                const aStr = aVal !== undefined ? formatChangeValue(key, aVal, log.user_lookups, log.permission_lookups, log.process_lookups) : undefined;

                if (bVal === undefined) {
                    details.push({ key, type: 'added', after: aStr });
                } else if (aVal === undefined) {
                    details.push({ key, type: 'removed', before: bStr });
                } else {
                    details.push({ key, type: 'changed', before: bStr, after: aStr });
                }
            }
            return details;
        }

        // 탭 key → CSV 내보내기. 헤더 버튼은 이 맵만 보고 동작한다.
        const tabExporters = {
            approval: () => exportApprovalCsv(),
            admin: () => exportAdminCsv(),
            login: () => exportLoginCsv(),
            download: () => exportDownloadCsv()
        };

        function exportCsv() {
            tabExporters[activeTab.value]?.();
        }

        // CSV 내보내기 자체도 활동 로그로 남긴다 (다운로드 행위 감사)
        function logAuditExport(tabKey, tabLabel, rowCount) {
            store.writeAdminAuditLog({
                action: 'audit_log_export',
                target_type: 'audit_log',
                target_id: tabKey,
                target_name: tabLabel,
                after_value: { row_count: rowCount }
            });
        }

        function exportApprovalCsv() {
            if (auditLogs.value.length === 0) return;
            const headers = ['일시', '액션', '이전상태', '이후상태', '수행자', '코멘트', '프로세스'];
            const rows = auditLogs.value.map(log => [
                log.created_at || '',
                log.action || '',
                log.from_state || '',
                log.to_state || '',
                log.actor_id || '',
                (log.comment || '').replace(/"/g, '""'),
                (log.proc_def_name || log.proc_def_id || '')
            ]);
            downloadCsv(headers, rows, 'approval_audit_log');
            logAuditExport('approval', '승인 이력', rows.length);
        }

        function exportAdminCsv() {
            if (adminAuditLogs.value.length === 0) return;
            const headers = ['일시', '수행자', '액션', '대상명', '변경 전', '변경 후'];
            const rows = adminAuditLogs.value.map(log => [
                log.created_at || '',
                formatAdminActor(log),
                log.action || '',
                log.target_name || '',
                (log.before_value || '').replace(/"/g, '""'),
                (log.after_value || '').replace(/"/g, '""')
            ]);
            downloadCsv(headers, rows, 'admin_audit_log');
            logAuditExport('admin', '관리자 감사 로그', rows.length);
        }

        function exportLoginCsv() {
            if (authLoginAudit.value.length === 0) return;
            const headers = [
                t('auditLog.loginAudit.columnTime'),
                t('auditLog.loginAudit.columnEmail'),
                t('auditLog.loginAudit.columnAction'),
                t('auditLog.loginAudit.columnResult'),
                t('auditLog.loginAudit.columnError'),
                t('auditLog.loginAudit.columnIp'),
                'User-Agent',
                'provider',
                'method'
            ];
            const rows = authLoginAudit.value.map((log) => {
                const meta = getAuthMeta(log);
                return [
                    log.created_at || '',
                    log.email || '',
                    log.action || '',
                    log.success
                        ? t('auditLog.loginAudit.resultSuccess')
                        : t('auditLog.loginAudit.resultFailure'),
                    (log.error_message || '').replace(/"/g, '""'),
                    log.ip_address || '',
                    (log.user_agent || '').replace(/"/g, '""'),
                    meta.provider || '',
                    meta.method || ''
                ];
            });
            downloadCsv(headers, rows, 'auth_login_audit');
            logAuditExport('login', '로그인 이력', rows.length);
        }

        function exportDownloadCsv() {
            if (fileDownloadLog.value.length === 0) return;
            const headers = [
                t('auditLog.downloadAudit.columnTime'),
                t('auditLog.downloadAudit.columnEmail'),
                t('auditLog.downloadAudit.columnFile'),
                t('auditLog.downloadAudit.columnPath'),
                t('auditLog.downloadAudit.columnBucket'),
                t('auditLog.downloadAudit.columnAction'),
                t('auditLog.downloadAudit.columnIp'),
                'User-Agent'
            ];
            const rows = fileDownloadLog.value.map((log) => [
                log.created_at || '',
                log.email || '',
                formatDownloadFileName(log),
                (log.path || '').replace(/"/g, '""'),
                log.bucket || '',
                getDownloadActionLabel(log.action),
                log.ip_address || '',
                (log.user_agent || '').replace(/"/g, '""')
            ]);
            downloadCsv(headers, rows, 'file_download_log');
            logAuditExport('download', '다운로드 이력', rows.length);
        }

        function downloadCsv(headers, rows, filePrefix) {
            const csvLines = [
                headers.map(h => `"${h}"`).join(','),
                ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
            ];
            const csvStr = '\uFEFF' + csvLines.join('\r\n');
            const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            const now = new Date();
            const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
            anchor.href = url;
            anchor.download = `${filePrefix}_${dateStr}.csv`;
            document.body.appendChild(anchor);
            anchor.click();
            document.body.removeChild(anchor);
            URL.revokeObjectURL(url);
        }

        onMounted(async () => {
            await store.loadCutoverJobs();
            loadLogs(1);
            if (activeTab.value === 'login') loadLockedAccounts();
            if (activeTab.value === 'download') loadDownloadBuckets();
        });

        return {
            activeTab,
            tabs: TAB_DEFS,
            showFilter,
            showCutoverCard,
            auditLogs,
            auditTotal,
            adminAuditLogs,
            adminAuditTotal,
            authLoginAudit,
            authLoginAuditTotal,
            cutoverJobs,
            loading,
            filters,
            pageSize,
            adminExpanded,
            cutoverExpanded,
            approvalHeaders,
            adminHeaders,
            loginHeaders,
            currentExportDisabled,
            switchTab,
            onFilterChange,
            onActorEnter,
            onTableUpdate,
            formatDatetime,
            truncateComment,
            formatAdminActor,
            formatApprovalActor,
            getStateLabel,
            getActionChipClass,
            getAdminActionChipClass,
            getApprovalActionLabel,
            getAdminActionLabel,
            getApprovalActionOptionLabel,
            getAdminActionOptionLabel,
            formatCutoverTitle,
            formatCutoverStatus,
            formatCutoverApprovalType,
            getChangeKeyLabel,
            getTargetTypeLabel,
            getTargetTypeOptionLabel,
            approvalActionCodes,
            adminActionCodes,
            targetTypeCodes,
            loginActionCodes,
            getLoginActionLabel,
            getLoginActionOptionLabel,
            getLoginActionChipClass,
            summarizeUserAgent,
            formatAuthMeta,
            formatAuthMetaTitle,
            buildChangeSummary,
            buildChangeDetails,
            exportCsv,
            isProcessLinkable,
            openTargetProcessInNewTab,
            // 잠금 계정 패널 (항목 18)
            lockedAccounts,
            lockedLoading,
            lockedError,
            unlockDialog,
            unlockTarget,
            unlocking,
            loadLockedAccounts,
            openUnlockDialog,
            closeUnlockDialog,
            confirmUnlock,
            formatLockRemaining,
            // 다운로드 이력 탭 (항목 8·18)
            fileDownloadLog,
            fileDownloadTotal,
            downloadLoading,
            downloadError,
            downloadBuckets,
            downloadHeaders,
            getDownloadActionLabel,
            getDownloadActionChipClass,
            formatDownloadFileName
        };
    }
});
</script>

<style scoped>
/* ── Header ─────────────────────────────────────────── */
.section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
}

.section-title-group {
    display: flex;
    align-items: center;
    gap: 8px;
}

.section-icon {
    color: #3b82f6;
    font-size: 20px;
}

.section-title {
    font-size: 16px;
    font-weight: 600;
    color: #1f2937;
}

.export-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 7px 14px;
    background: #ffffff;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    color: #374151;
    cursor: pointer;
    transition: all 0.15s ease;
}

.export-btn:hover:not(:disabled) {
    background: #f3f4f6;
    border-color: #9ca3af;
}

.export-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}

/* ── Tab Bar ─────────────────────────────────────────── */
.audit-tab-bar {
    display: flex;
    flex: 0 0 auto;
    gap: 0;
    margin-bottom: 16px;
    border-bottom: 2px solid #e5e7eb;
}

.audit-tab-btn {
    padding: 10px 20px;
    font-size: 13px;
    font-weight: 600;
    color: #6b7280;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    margin-bottom: -2px;
    cursor: pointer;
    transition: all 0.15s;
}

.audit-tab-btn:hover {
    color: #374151;
}

.audit-tab-btn.active {
    color: #3b82f6;
    border-bottom-color: #3b82f6;
}

/* ── Filter Bar ──────────────────────────────────────── */
.filter-bar {
    display: flex;
    flex: 0 0 auto;
    align-items: flex-end;
    gap: 12px;
    padding: 16px;
    background: #f8fafc;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    margin-bottom: 20px;
    flex-wrap: wrap;
}

.filter-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.filter-group-actor {
    flex: 1;
    min-width: 160px;
}

.filter-label {
    font-size: 11px;
    font-weight: 500;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.04em;
}

.filter-input {
    height: 34px;
    padding: 0 10px;
    background: #ffffff;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 13px;
    color: #1f2937;
    outline: none;
    transition: border-color 0.15s ease;
}

.filter-input:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
}

.filter-date {
    width: 140px;
}

.filter-select {
    width: 160px;
    cursor: pointer;
}

.filter-text {
    width: 100%;
}

/* ── Cut-over Audit Card ───────────────────────────── */
.cutover-audit-card {
    flex: 0 0 auto;
    margin-bottom: 20px;
    border: 1px solid #e0e7ff;
    border-radius: 10px;
    background: #f8faff;
    overflow: hidden;
}

.cutover-audit-card__header {
    width: 100%;
    padding: 14px 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    border: 0;
    background: transparent;
    cursor: pointer;
    text-align: left;
}

.cutover-audit-card__header-right {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: #64748b;
}

.cutover-audit-card__title {
    font-size: 14px;
    font-weight: 600;
    color: #1e3a8a;
}

.cutover-audit-card__subtitle {
    margin-top: 4px;
    font-size: 12px;
    color: #64748b;
}

.cutover-audit-count {
    min-width: 34px;
    padding: 2px 8px;
    border-radius: 999px;
    background: #e0edff;
    color: #1d4ed8;
    font-size: 11px;
    font-weight: 700;
    text-align: center;
}

.cutover-audit-card__body {
    padding: 0 16px 16px;
    max-height: 30vh;
    overflow-y: auto;
}

.cutover-audit-empty {
    padding: 14px;
    border-radius: 8px;
    background: #ffffff;
    font-size: 13px;
    color: #64748b;
}

.cutover-audit-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.cutover-audit-item {
    padding: 12px 14px;
    border-radius: 8px;
    background: #ffffff;
    border: 1px solid #dbeafe;
}

.cutover-audit-item__top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
}

.cutover-audit-item__title {
    font-size: 13px;
    font-weight: 600;
    color: #0f172a;
}

.cutover-audit-detail-list {
    margin-top: 10px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px 10px;
    border-radius: 6px;
    background: #f8fafc;
}

.cutover-audit-detail {
    display: flex;
    align-items: flex-start;
    gap: 6px;
}

.cutover-audit-detail__label,
.cutover-audit-section__label {
    flex: 0 0 auto;
    font-size: 11px;
    font-weight: 700;
    color: #64748b;
}

.cutover-audit-detail__value {
    font-size: 12px;
    color: #0f172a;
    word-break: break-word;
}

.cutover-audit-section {
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid #e2e8f0;
}

.cutover-audit-section--error {
    color: #b91c1c;
}

.cutover-audit-section__text {
    margin: 0;
    font-size: 12px;
    line-height: 1.5;
    color: #334155;
}

.cutover-audit-section--error .cutover-audit-section__text {
    color: #b91c1c;
}

/* ── Cell Styles ─────────────────────────────────────── */
.datetime-text {
    font-size: 12px;
    color: #6b7280;
    white-space: nowrap;
}

.state-text {
    font-size: 12px;
    color: #6b7280;
}

.actor-text {
    font-size: 12px;
    color: #374151;
    font-weight: 500;
}

.comment-text {
    font-size: 12px;
    color: #6b7280;
}

.what-target-name {
    margin-left: 8px;
    font-size: 12px;
    color: #374151;
    font-weight: 500;
}

.what-target-name--link {
    color: #2563eb;
    text-decoration: none;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
}

.what-target-name--link:hover {
    text-decoration: underline;
    color: #1d4ed8;
}

.changes-brief {
    font-size: 12px;
    color: #374151;
}

/* ── Expanded Detail Row ─────────────────────────────── */
.expanded-detail-row .expanded-detail-cell {
    background: #f8fafc;
    padding: 0 !important;
}

.change-detail-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 14px 24px;
}

.change-detail-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    flex-wrap: wrap;
}

.change-key {
    font-size: 11px;
    font-weight: 600;
    color: #4b5563;
    min-width: 200px;
    display: inline-flex;
    align-items: baseline;
    gap: 0;
}

.change-key-code {
    font-family: 'Roboto Mono', monospace;
}

.change-key-label {
    margin-left: 2px;
    font-family: inherit;
    color: #1f2937;
}

.change-arrow {
    color: #9ca3af;
    flex-shrink: 0;
}

.change-removed {
    color: #dc2626;
    background: #fef2f2;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-family: 'Roboto Mono', monospace;
    word-break: break-all;
    white-space: pre-line;
}

.change-added {
    color: #16a34a;
    background: #f0fdf4;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-family: 'Roboto Mono', monospace;
    word-break: break-all;
    white-space: pre-line;
}

.change-info {
    color: #374151;
    background: #f3f4f6;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-family: 'Roboto Mono', monospace;
    word-break: break-all;
    white-space: pre-line;
}

.change-reason-item {
    padding-bottom: 8px;
    margin-bottom: 4px;
    border-bottom: 1px dashed #e5e7eb;
}

.change-reason-text {
    color: #1f2937;
    font-size: 12px;
    word-break: break-word;
    white-space: pre-wrap;
    line-height: 1.5;
}

/* ── Action Chips ────────────────────────────────────── */
.action-chip {
    display: inline-flex;
    align-items: baseline;
    gap: 0;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.02em;
    white-space: nowrap;
}

.action-chip-code {
    font-family: 'Roboto Mono', monospace;
}

.action-chip-label {
    margin-left: 2px;
    font-family: inherit;
    font-weight: 600;
    letter-spacing: 0;
}

.chip-blue {
    background: #eff6ff;
    color: #1d4ed8;
    border: 1px solid #bfdbfe;
}

.chip-green {
    background: #f0fdf4;
    color: #15803d;
    border: 1px solid #bbf7d0;
}

.chip-red {
    background: #fef2f2;
    color: #b91c1c;
    border: 1px solid #fecaca;
}

.chip-orange {
    background: #fff7ed;
    color: #c2410c;
    border: 1px solid #fed7aa;
}

.chip-amber {
    background: #fffbeb;
    color: #b45309;
    border: 1px solid #fde68a;
}

.chip-teal {
    background: #f0fdfa;
    color: #0f766e;
    border: 1px solid #99f6e4;
}

.chip-grey {
    background: #f9fafb;
    color: #6b7280;
    border: 1px solid #e5e7eb;
}

.chip-pink {
    background: #fdf2f8;
    color: #9d174d;
    border: 1px solid #fbcfe8;
}

.chip-default {
    background: #f3f4f6;
    color: #374151;
    border: 1px solid #d1d5db;
}

/* ── 잠금 계정 패널 (docs/security.md 2-4, 항목 18) ────── */
.lockout-panel {
    border: 1px solid #fecaca;
    border-radius: 8px;
    background: #fff7f7;
    margin-bottom: 12px;
    overflow: hidden;
}

/* 잠긴 계정이 없을 때는 시선을 끌지 않게 한 줄로만 남긴다 */
.lockout-panel--idle {
    border-color: #e5e7eb;
    background: #fafafa;
}

.lockout-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
}

.lockout-spacer {
    flex: 1 1 auto;
}

.lockout-title {
    font-size: 12px;
    font-weight: 700;
    color: #374151;
}

.lockout-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: 9px;
    background: #ef4444;
    color: #fff;
    font-size: 11px;
    font-weight: 700;
}

.lockout-idle-text {
    font-size: 12px;
    color: #9ca3af;
}

.lockout-refresh {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 2px 8px;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    background: #fff;
    font-size: 11px;
    color: #4b5563;
    cursor: pointer;
}

.lockout-refresh:disabled {
    opacity: 0.5;
    cursor: default;
}

.lockout-error {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 0 12px 10px;
    font-size: 12px;
    color: #b91c1c;
}

.lockout-table {
    width: 100%;
    border-collapse: collapse;
    background: #fff;
    border-top: 1px solid #fecaca;
}

.lockout-table th {
    padding: 6px 12px;
    text-align: left;
    font-size: 11px;
    font-weight: 600;
    color: #6b7280;
    background: #fafafa;
    border-bottom: 1px solid #e5e7eb;
    white-space: nowrap;
}

.lockout-table td {
    padding: 7px 12px;
    border-bottom: 1px solid #f3f4f6;
    vertical-align: middle;
}

.lockout-table tr:last-child td {
    border-bottom: none;
}

.lockout-col-num {
    width: 90px;
    text-align: center;
}

.lockout-col-action {
    width: 100px;
    text-align: right;
}

.lockout-email {
    font-size: 12px;
    font-weight: 500;
    color: #374151;
}

.lockout-username {
    margin-left: 6px;
    font-size: 11px;
    color: #9ca3af;
}

.lockout-remaining {
    margin-left: 6px;
    font-size: 11px;
    color: #b45309;
}

.lockout-unlock-btn {
    padding: 3px 10px;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    background: #fff;
    font-size: 11px;
    font-weight: 600;
    color: #374151;
    cursor: pointer;
}

.lockout-unlock-btn:hover:not(:disabled) {
    background: #f9fafb;
    border-color: #9ca3af;
}

.lockout-unlock-btn:disabled {
    opacity: 0.5;
    cursor: default;
}

/* ── 잠금 해제 확인 다이얼로그 ────── */
.confirm-dialog {
    border-radius: 10px;
}

.confirm-dialog .dialog-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 16px 20px 0;
}

.confirm-dialog .dialog-title {
    font-size: 15px;
    font-weight: 700;
    color: #111827;
}

.confirm-dialog .dialog-body {
    padding: 12px 20px 4px;
}

.confirm-dialog .dialog-desc {
    font-size: 13px;
    color: #4b5563;
    margin: 0 0 10px;
}

.confirm-dialog .target-info {
    padding: 8px 10px;
    border-radius: 6px;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    font-size: 13px;
    color: #111827;
    word-break: break-all;
}

.confirm-dialog .dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 6px;
    padding: 12px 16px 16px;
}
</style>
