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

        <!-- Tab Selector -->
        <div class="audit-tab-bar">
            <button
                class="audit-tab-btn"
                :class="{ active: activeTab === 'approval' }"
                @click="switchTab('approval')"
            >승인 이력</button>
            <button
                class="audit-tab-btn"
                :class="{ active: activeTab === 'admin' }"
                @click="switchTab('admin')"
            >관리자 감사 로그</button>
        </div>

        <!-- Filter Bar -->
        <div class="filter-bar">
            <div class="filter-group">
                <label class="filter-label">시작일</label>
                <input
                    v-model="filters.startDate"
                    type="date"
                    class="filter-input filter-date"
                    @change="onFilterChange"
                />
            </div>
            <div class="filter-group">
                <label class="filter-label">종료일</label>
                <input
                    v-model="filters.endDate"
                    type="date"
                    class="filter-input filter-date"
                    @change="onFilterChange"
                />
            </div>
            <div v-if="activeTab === 'approval'" class="filter-group">
                <label class="filter-label">액션</label>
                <select v-model="filters.action" class="filter-input filter-select" @change="onFilterChange">
                    <option value="">전체 액션</option>
                    <option v-for="code in approvalActionCodes" :key="code" :value="code">
                        {{ getApprovalActionOptionLabel(code) }}
                    </option>
                </select>
            </div>
            <div v-if="activeTab === 'admin'" class="filter-group">
                <label class="filter-label">액션</label>
                <select v-model="filters.adminAction" class="filter-input filter-select" @change="onFilterChange">
                    <option value="">전체 액션</option>
                    <option v-for="code in adminActionCodes" :key="code" :value="code">
                        {{ getAdminActionOptionLabel(code) }}
                    </option>
                </select>
            </div>
            <div v-if="activeTab === 'admin'" class="filter-group">
                <label class="filter-label">대상 유형</label>
                <select v-model="filters.targetType" class="filter-input filter-select" @change="onFilterChange">
                    <option value="">전체 유형</option>
                    <option v-for="code in targetTypeCodes" :key="code" :value="code">
                        {{ getTargetTypeOptionLabel(code) }}
                    </option>
                </select>
            </div>
            <div class="filter-group filter-group-actor">
                <label class="filter-label">수행자</label>
                <input
                    v-model="filters.actorId"
                    type="text"
                    class="filter-input filter-text"
                    placeholder="수행자 검색"
                    @keydown.enter="onActorEnter"
                />
            </div>
        </div>

        <div class="cutover-audit-card" :class="{ 'cutover-audit-card--open': cutoverExpanded }">
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
                @update:options="onApprovalTableUpdate"
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
                @update:options="onAdminTableUpdate"
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
        </v-card-text>
    </v-card>
</template>

<script>
import { defineComponent, ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAdminConsoleStore } from '@/stores/adminConsole';
import { storeToRefs } from 'pinia';
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
        const { auditLogs, auditTotal, adminAuditLogs, adminAuditTotal, loading, cutoverJobs } = storeToRefs(store);

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
                    left: PROCESS_HIERARCHY_PANEL_STATE.COLLAPSED,
                    right: PROCESS_HIERARCHY_PANEL_STATE.OPEN,
                    rightTab: PROCESS_HIERARCHY_RIGHT_TAB.GOVERNANCE,
                    reviewId
                })
            });
            window.open(route.href, '_blank', 'noopener');
        }

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
            targetType: ''
        });


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

        const currentExportDisabled = computed(() => {
            if (activeTab.value === 'approval') return auditLogs.value.length === 0;
            return adminAuditLogs.value.length === 0;
        });

        async function loadLogs(page = 1) {
            if (activeTab.value === 'approval') {
                await store.fetchAuditLogs({
                    startDate: filters.value.startDate || undefined,
                    endDate: filters.value.endDate || undefined,
                    action: filters.value.action || undefined,
                    actorId: filters.value.actorId || undefined,
                    page,
                    pageSize: pageSize.value
                });
            } else {
                await store.fetchAdminAuditLogs({
                    startDate: filters.value.startDate || undefined,
                    endDate: filters.value.endDate || undefined,
                    action: filters.value.adminAction || undefined,
                    actorId: filters.value.actorId || undefined,
                    targetType: filters.value.targetType || undefined,
                    page,
                    pageSize: pageSize.value
                });
            }
        }

        // v-data-table-server 가 페이지 사이즈 변경 시 itemsPerPage 도 전달함.
        function onApprovalTableUpdate({ page, itemsPerPage }) {
            if (typeof itemsPerPage === 'number' && itemsPerPage !== pageSize.value) {
                pageSize.value = itemsPerPage;
            }
            loadLogs(page);
        }

        function onAdminTableUpdate({ page, itemsPerPage }) {
            if (typeof itemsPerPage === 'number' && itemsPerPage !== pageSize.value) {
                pageSize.value = itemsPerPage;
            }
            loadLogs(page);
        }

        function switchTab(tab) {
            activeTab.value = tab;
            adminExpanded.value = [];
            loadLogs(1);
        }

        function onFilterChange() {
            loadLogs(1);
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
            event_type_visibility_update: 'Event 종류 활성화 설정'
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
            task: '태스크'
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
            primaryOwner: 'PI팀 담당자',
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

        function exportCsv() {
            if (activeTab.value === 'approval') {
                exportApprovalCsv();
            } else {
                exportAdminCsv();
            }
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
        });

        return {
            activeTab,
            auditLogs,
            auditTotal,
            adminAuditLogs,
            adminAuditTotal,
            cutoverJobs,
            loading,
            filters,
            pageSize,
            adminExpanded,
            cutoverExpanded,
            approvalHeaders,
            adminHeaders,
            currentExportDisabled,
            switchTab,
            onFilterChange,
            onActorEnter,
            onApprovalTableUpdate,
            onAdminTableUpdate,
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
            buildChangeSummary,
            buildChangeDetails,
            exportCsv,
            isProcessLinkable,
            openTargetProcessInNewTab
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
</style>
