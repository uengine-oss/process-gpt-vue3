import { defineStore } from 'pinia';
import BackendFactory from '@/components/api/BackendFactory';
import { invalidateMaintenanceCache } from '@/utils/maintenanceGate';
import { invalidateMfaPolicyCache } from '@/utils/mfaGate';
import { getCurrentUserForSoftDelete } from '@/utils/softDeleteUser';
import { collectHierarchyProcIds } from '@/utils/processStages';
import { recycleBinRemainingDays } from '@/services/tenantCustomizationService';

export interface DataFreezeItem {
    id?: string;
    scope: 'domain' | 'mega_process' | 'major_process' | 'subprocess';
    target_id: string;
    target_name: string;
    reason: string;
    locked_by: string;
    locked_at: string;
}

export interface DeletedProcess {
    id: string;
    name: string;
    deleted_by?: string;
    deleted_at: string;
    remaining_days: number;
    deleted_from?: {
        mega_id: string;
        mega_name: string;
        major_id: string;
        major_name: string;
        process_name?: string;
    } | null;
}

export interface DeletedInstance {
    proc_inst_id: string;
    name?: string;
    deleted_at: string;
    remaining_days: number;
}

export interface DeletedPropertySchema {
    id: string;
    property_key: string;
    property_label: string;
    applies_to?: string;
    property_type?: string;
    deleted_at: string;
    deleted_by?: string | null;
    remaining_days: number;
}

export interface DeletedAuditPolicy {
    id: string;
    name: string;
    kind: 'file' | 'link';
    file_path: string | null;
    // 어느 버킷에 있는지. 정책문서는 파일 선택 스키마에서 버킷을 지정할 수 있어
    // 'files' 라고 단정하면 다른 버킷에 올린 문서가 삭제되지 않고 남는다.
    file_bucket: string | null;
    link_url: string | null;
    deleted_by: string;
    deleted_at: string;
    remaining_days: number;
}

export interface DeletedSupplier {
    id: string;
    name: string;
    business_number: string | null;
    registration_type: string | null;
    deleted_by: string;
    deleted_at: string;
    remaining_days: number;
}

export interface DeletedSystem {
    id: string;
    name: string;
    system_type?: string | null;
    category?: string | null;
    responsible_person?: string | null;
    shortcut_link?: string | null;
    description?: string | null;
    registration_status?: string | null;
    deleted_by: string;
    deleted_at: string;
    remaining_days: number;
}

export interface KpiTarget {
    id?: string;
    year: number;
    org_id: string;
    org_name: string;
    // 조직(팀) 상위 본부. parent 키 자체가 없으면 legacy(미저장),
    // null 이면 최상위 팀(본부 없음), 객체면 본부 정보.
    parent?: { id: string; name: string } | null;
    process_ids: string[];
    target: number;
    published_count?: number;
    achievement_rate?: number;
    period_type?: string;
    period_start?: string;
    updated_at?: string;
}

// 휴지통 표시용 KPI 목표 — 'kpi_targets' jsonb 배열 안에서 deleted_at 가 부착된 항목.
//   원본 KpiTarget 의 필수 정보 + 삭제 메타데이터 + 보존 일수.
export interface DeletedKpiTarget {
    id: string;
    year: number;
    org_id: string;
    org_name: string;
    parent?: { id: string; name: string } | null;
    process_ids: string[];
    deleted_at: string;
    deleted_by: string;
    remaining_days: number;
}

export interface NoticeBannerConfig {
    enabled: boolean;
    text: string;
    color: 'info' | 'warning' | 'error' | 'success';
    start_date: string;
    end_date: string;
}

export interface MaintenanceModeConfig {
    enabled: boolean;
    message: string;
    activated_by?: string;
    activated_role?: string;
    activated_at?: string;
}

/**
 * 감사 로그 보관 정책 (docs/security.md 4-3, 항목 17)
 *
 * configuration 테이블의 key = 'audit_log_retention' 한 행으로 저장한다.
 * 실제로 로그를 옮기는 주체는 DB 쪽 pg_cron 작업
 * (supabase/migrations/20260911_audit_log_retention.sql) 이고, 화면은 그 작업이
 * 읽는 일수만 노출한다.
 */
export interface AuditLogRetentionConfig {
    retention_days: number;
}

/** 보관 일수 기본값·허용 범위. DB 함수의 clamp 와 같은 값이어야 한다. */
export const AUDIT_RETENTION_DEFAULT_DAYS = 365;
export const AUDIT_RETENTION_MIN_DAYS = 30;
export const AUDIT_RETENTION_MAX_DAYS = 3650;
export const AUDIT_RETENTION_CONFIG_KEY = 'audit_log_retention';

// ============================================
// 보안 정책 (docs/security.md 2-1 / 2-3 / 2-4 / 3-3)
//
// 네 정책 모두 감사 로그 보관 정책과 같은 자리(public.configuration,
// tenant_id + key 유일)에 한 행씩 저장한다. 값을 읽는 주체는 화면이 아니라
// 프론트 composable(session_timeout, mfa_policy) 과 DB(login_lockout 훅,
// download_anomaly 함수) 라, 여기서는 "그들이 읽는 스키마" 를 그대로 쓴다.
// 스키마를 바꾸면 소비처도 같이 고쳐야 한다.
// ============================================

/** 유휴 세션 타임아웃 — src/composables/useIdleTimeout.ts 가 읽는다. */
export interface SessionTimeoutConfig {
    /** 유휴 허용 시간(분). 0 이하면 타이머 비활성. */
    idle_timeout_minutes: number;
    /** 경고 모달이 뜬 뒤 로그아웃까지의 유예(초). */
    warning_seconds: number;
}

/** 반복 로그인 실패 잠금 — DB 훅 hook_password_verification_attempt 가 읽는다. */
export interface LoginLockoutConfig {
    /** 잠금까지 허용하는 실패 횟수. 0 이하면 잠금 비활성. */
    max_attempts: number;
    /** 실패를 세는 기간(분). */
    window_minutes: number;
    /** 잠금 유지 시간(분). */
    lockout_minutes: number;
}

/** MFA 필수 여부 — src/utils/mfaGate.ts 가 읽는다(60초 캐시). */
export interface MfaPolicyConfig {
    require_mfa: boolean;
}

/** 다운로드 이상 탐지 임계치 — DB 함수 detect_download_anomalies 가 읽는다. */
export interface DownloadAnomalyConfig {
    /** 하루 다운로드 건수 임계치. 넘으면 관리자에게 알림. */
    daily_threshold: number;
}

export const SESSION_TIMEOUT_CONFIG_KEY = 'session_timeout';
export const LOGIN_LOCKOUT_CONFIG_KEY = 'login_lockout';
export const MFA_POLICY_CONFIG_KEY = 'mfa_policy';
export const DOWNLOAD_ANOMALY_CONFIG_KEY = 'download_anomaly';

/**
 * 기본값·허용 범위.
 *
 * 기본값은 소비처(composable / DB 함수)가 설정 행이 없을 때 쓰는 값과 같아야
 * 한다 — 화면이 "기본값 사용 중" 으로 보여주는 숫자가 실제 동작과 달라지면
 * 안 되기 때문이다. 범위는 화면 검증용이며, 저장 직전 한 번 더 clamp 한다.
 */
export const SESSION_TIMEOUT_DEFAULTS: SessionTimeoutConfig = {
    idle_timeout_minutes: 30,
    warning_seconds: 60
};
export const IDLE_MINUTES_MIN = 0; // 0 = 비활성
export const IDLE_MINUTES_MAX = 1440; // 24시간
export const WARNING_SECONDS_MIN = 5;
export const WARNING_SECONDS_MAX = 600;

export const LOGIN_LOCKOUT_DEFAULTS: LoginLockoutConfig = {
    max_attempts: 5,
    window_minutes: 15,
    lockout_minutes: 15
};
export const LOCKOUT_ATTEMPTS_MIN = 0; // 0 = 비활성
export const LOCKOUT_ATTEMPTS_MAX = 100;
export const LOCKOUT_WINDOW_MIN = 1;
export const LOCKOUT_WINDOW_MAX = 1440;
export const LOCKOUT_DURATION_MIN = 1;
export const LOCKOUT_DURATION_MAX = 1440;

export const MFA_POLICY_DEFAULTS: MfaPolicyConfig = { require_mfa: false };

export const DOWNLOAD_ANOMALY_DEFAULTS: DownloadAnomalyConfig = { daily_threshold: 100 };
export const DOWNLOAD_THRESHOLD_MIN = 1;
export const DOWNLOAD_THRESHOLD_MAX = 1000000;

/** 화면이 "기본값 사용 중" 배지를 붙일 때 쓰는 키 집합 */
export type SecurityConfigKey =
    | typeof SESSION_TIMEOUT_CONFIG_KEY
    | typeof LOGIN_LOCKOUT_CONFIG_KEY
    | typeof MFA_POLICY_CONFIG_KEY
    | typeof DOWNLOAD_ANOMALY_CONFIG_KEY;

export type CutoverJobStatus = 'scheduled' | 'running' | 'completed' | 'failed';
export type CutoverApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface CutoverJobSnapshot {
    mega_count: number;
    major_count: number;
    sub_count: number;
    highlights?: string[];
}

export interface CutoverJob {
    id: string;
    draft_id: string;
    title: string;
    operation: string;
    approval_type: string;
    status: CutoverJobStatus;
    summary: string;
    impacted_mega_count: number;
    impacted_major_count: number;
    impacted_sub_count: number;
    created_at: string;
    created_by?: string;
    scheduled_at?: string;
    started_at?: string;
    executed_at?: string;
    failed_at?: string;
    executed_by?: string;
    maintenance_message?: string;
    approval_title?: string;
    version_label?: string;
    change_summary?: string[];
    before_snapshot?: CutoverJobSnapshot | null;
    after_snapshot?: CutoverJobSnapshot | null;
    error_message?: string;
    approval_status?: CutoverApprovalStatus;
    approval_comment?: string;
    approved_by?: string;
    approved_at?: string;
    rejected_by?: string;
    rejected_at?: string;
    draft_map?: any;
    /** 도메인 구조개편일 때만 채워진다 — proc_map 과 함께 반영할 metrics(도메인 마스터) 스냅샷 */
    draft_metrics?: any;
}

export interface AuditLogEntry {
    id: string;
    proc_def_id: string;
    review_id?: string;
    action: string;
    from_state: string;
    to_state: string;
    actor_id: string;
    comment?: string;
    created_at: string;
    proc_def_name?: string;
}

export interface AdminAuditLogEntry {
    id: string;
    actor_id: string;
    actor_username?: string;
    actor_org_name?: string;
    actor_employee_no?: string;
    action: string;
    target_type: string;
    target_id?: string;
    target_name?: string;
    before_value?: string;
    after_value?: string;
    comment?: string;
    created_at: string;
}

export interface AuditFilter {
    startDate?: string;
    endDate?: string;
    action?: string;
    actorId?: string;
    procDefId?: string;
    page?: number;
    pageSize?: number;
}

export interface AdminAuditFilter {
    startDate?: string;
    endDate?: string;
    action?: string;
    actorId?: string;
    targetType?: string;
    page?: number;
    pageSize?: number;
}

/** public.auth_login_audit 1행 (로그인/로그아웃/로그인 실패 이력) */
export interface AuthLoginAuditEntry {
    id: string;
    created_at: string;
    tenant_id?: string | null;
    /** login | login_failed | logout | login_oauth */
    action: string;
    email?: string | null;
    success: boolean;
    error_message?: string | null;
    user_id?: string | null;
    /** 서버측(RPC)에서 요청 헤더로 캡처 — 클라이언트 입력 아님 */
    ip_address?: string | null;
    user_agent?: string | null;
    /** { method, provider, reason, origin, referer, host } */
    metadata?: Record<string, any> | null;
}

export interface AuthLoginAuditFilter {
    startDate?: string;
    endDate?: string;
    email?: string;
    action?: string;
    /** 액션과 별개 축 — 현재 클라이언트는 실패도 action='login' 으로 남긴다 */
    success?: boolean;
    userId?: string;
    page?: number;
    pageSize?: number;
}

export interface SignupRequest {
    id: string;
    user_id: string;
    username?: string;
    email: string;
    tenant_id: string;
    status: 'pending' | 'approved' | 'rejected';
    reject_reason?: string | null;
    reviewed_by?: string | null;
    reviewed_at?: string | null;
    created_at: string;
    updated_at?: string | null;
}

export interface AdminRequest {
    id: string;
    user_id: string;
    username?: string;
    email: string;
    org_name?: string;
    tenant_id: string;
    reason?: string;
    requested_role?: string;
    status: 'pending' | 'approved' | 'rejected';
    reject_reason?: string | null;
    reviewed_by?: string | null;
    reviewed_at?: string | null;
    created_at: string;
    updated_at?: string | null;
}

/**
 * 보관 일수를 화면·DB 양쪽이 받아들이는 형태로 정리한다.
 * 숫자가 아니거나 비어 있으면 기본값, 범위를 벗어나면 경계값으로 잘라낸다.
 * DB 함수 archive_expired_audit_logs() 도 같은 범위로 clamp 하므로,
 * 설정 행이 어떤 경로로 오염되든 "어제 로그까지 삭제" 같은 일은 생기지 않는다.
 */
export function normalizeRetentionDays(value: unknown): number {
    const n = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : NaN;
    if (!Number.isFinite(n)) return AUDIT_RETENTION_DEFAULT_DAYS;
    return Math.min(AUDIT_RETENTION_MAX_DAYS, Math.max(AUDIT_RETENTION_MIN_DAYS, Math.trunc(n)));
}

/**
 * 보안 정책 값 정규화.
 *
 * 설정 행의 value 는 사람이 SQL 로 넣었을 수도 있어 문자열·null·범위 밖 값이
 * 그대로 들어올 수 있다. 화면에 올리기 전과 저장 직전 양쪽에서 같은 함수로
 * 정수 + 범위 안 값으로 만든다.
 */
export function clampInt(value: unknown, min: number, max: number, fallback: number): number {
    const n = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : NaN;
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, Math.trunc(n)));
}

export function normalizeSessionTimeout(raw: any): SessionTimeoutConfig {
    return {
        idle_timeout_minutes: clampInt(
            raw?.idle_timeout_minutes,
            IDLE_MINUTES_MIN,
            IDLE_MINUTES_MAX,
            SESSION_TIMEOUT_DEFAULTS.idle_timeout_minutes
        ),
        warning_seconds: clampInt(
            raw?.warning_seconds,
            WARNING_SECONDS_MIN,
            WARNING_SECONDS_MAX,
            SESSION_TIMEOUT_DEFAULTS.warning_seconds
        )
    };
}

export function normalizeLoginLockout(raw: any): LoginLockoutConfig {
    return {
        max_attempts: clampInt(
            raw?.max_attempts,
            LOCKOUT_ATTEMPTS_MIN,
            LOCKOUT_ATTEMPTS_MAX,
            LOGIN_LOCKOUT_DEFAULTS.max_attempts
        ),
        window_minutes: clampInt(
            raw?.window_minutes,
            LOCKOUT_WINDOW_MIN,
            LOCKOUT_WINDOW_MAX,
            LOGIN_LOCKOUT_DEFAULTS.window_minutes
        ),
        lockout_minutes: clampInt(
            raw?.lockout_minutes,
            LOCKOUT_DURATION_MIN,
            LOCKOUT_DURATION_MAX,
            LOGIN_LOCKOUT_DEFAULTS.lockout_minutes
        )
    };
}

export function normalizeMfaPolicy(raw: any): MfaPolicyConfig {
    return { require_mfa: raw?.require_mfa === true || raw?.require_mfa === 'true' };
}

export function normalizeDownloadAnomaly(raw: any): DownloadAnomalyConfig {
    return {
        daily_threshold: clampInt(
            raw?.daily_threshold,
            DOWNLOAD_THRESHOLD_MIN,
            DOWNLOAD_THRESHOLD_MAX,
            DOWNLOAD_ANOMALY_DEFAULTS.daily_threshold
        )
    };
}

const CUTOVER_JOBS_KEY = 'admin_console_cutover_jobs';

function readCutoverJobs(): CutoverJob[] {
    if (typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem(CUTOVER_JOBS_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        console.error('Failed to read cutover jobs:', e);
        return [];
    }
}

function writeCutoverJobs(jobs: CutoverJob[]) {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(CUTOVER_JOBS_KEY, JSON.stringify(jobs));
    } catch (e) {
        console.error('Failed to persist cutover jobs:', e);
    }
}

function resolveCutoverActor() {
    if (typeof window === 'undefined') return 'admin';
    return (
        localStorage.getItem('userName') ||
        localStorage.getItem('email') ||
        (window as any).$userName ||
        (window as any).$user?.email ||
        'admin'
    );
}

function getCutoverSortTime(job: CutoverJob): number {
    const source =
        job.executed_at ||
        job.failed_at ||
        job.started_at ||
        job.approved_at ||
        job.rejected_at ||
        job.scheduled_at ||
        job.created_at;
    const time = source ? new Date(source).getTime() : 0;
    return Number.isNaN(time) ? 0 : time;
}

function normalizeCutoverJob(job: CutoverJob): CutoverJob {
    return {
        approval_status: 'pending',
        change_summary: [],
        before_snapshot: null,
        after_snapshot: null,
        ...job
    };
}

function sortCutoverJobs(jobs: CutoverJob[]): CutoverJob[] {
    return [...jobs]
        .map(normalizeCutoverJob)
        .sort((a, b) => getCutoverSortTime(b) - getCutoverSortTime(a))
        .slice(0, 50);
}

function mergeCutoverJobs(primary: CutoverJob[], fallback: CutoverJob[]): CutoverJob[] {
    const merged = new Map<string, CutoverJob>();
    for (const job of fallback || []) {
        const normalized = normalizeCutoverJob(job);
        if (normalized.id) merged.set(normalized.id, normalized);
    }
    for (const job of primary || []) {
        const normalized = normalizeCutoverJob(job);
        if (normalized.id) merged.set(normalized.id, normalized);
    }
    return sortCutoverJobs([...merged.values()]);
}

export const useAdminConsoleStore = defineStore({
    id: 'adminConsole',
    state: () => ({
        activeTab: 'schemas' as string,
        dataFreezeList: [] as DataFreezeItem[],
        deletedProcesses: [] as DeletedProcess[],
        deletedInstances: [] as DeletedInstance[],
        deletedSchemas: [] as DeletedPropertySchema[],
        deletedAuditPolicies: [] as DeletedAuditPolicy[],
        deletedSuppliers: [] as DeletedSupplier[],
        deletedSystems: [] as DeletedSystem[],
        kpiTargets: [] as KpiTarget[],
        deletedKpiTargets: [] as DeletedKpiTarget[],
        deletedLaneRoleGroups: [] as any[],
        noticeBanner: {
            enabled: false,
            text: '',
            color: 'info',
            start_date: '',
            end_date: ''
        } as NoticeBannerConfig,
        maintenanceMode: {
            enabled: false,
            message: '',
            activated_by: '',
            activated_at: ''
        } as MaintenanceModeConfig,
        auditLogRetention: {
            retention_days: AUDIT_RETENTION_DEFAULT_DAYS
        } as AuditLogRetentionConfig,
        sessionTimeoutPolicy: { ...SESSION_TIMEOUT_DEFAULTS } as SessionTimeoutConfig,
        loginLockoutPolicy: { ...LOGIN_LOCKOUT_DEFAULTS } as LoginLockoutConfig,
        mfaPolicy: { ...MFA_POLICY_DEFAULTS } as MfaPolicyConfig,
        downloadAnomalyPolicy: { ...DOWNLOAD_ANOMALY_DEFAULTS } as DownloadAnomalyConfig,
        /**
         * 설정 행이 아직 없는(= 기본값으로 동작 중인) 보안 정책 키.
         *
         * getConfigurationValue 는 행이 없으면 fallback 을 돌려주므로 값만 봐선
         * "기본값과 같은 값을 저장한 것" 과 구분되지 않는다. fallback 을 null 로
         * 두고 null 이 오는지로 판별해 화면에 "기본값 사용 중" 을 표시한다.
         */
        securityPolicyUsingDefault: {
            session_timeout: true,
            login_lockout: true,
            mfa_policy: true,
            download_anomaly: true
        } as Record<SecurityConfigKey, boolean>,
        cutoverJobs: sortCutoverJobs(readCutoverJobs()) as CutoverJob[],
        adminRequests: [] as AdminRequest[],
        myAdminRequests: [] as AdminRequest[],
        signupRequests: [] as SignupRequest[],
        auditLogs: [] as AuditLogEntry[],
        auditTotal: 0,
        adminAuditLogs: [] as AdminAuditLogEntry[],
        adminAuditTotal: 0,
        authLoginAudit: [] as AuthLoginAuditEntry[],
        authLoginAuditTotal: 0,
        loading: false,
        error: null as string | null
    }),

    actions: {
        // ============================================
        // Data Freeze
        // ============================================
        async fetchDataFreezeList() {
            this.loading = true;
            try {
                const backend = BackendFactory.createBackend() as any;
                this.dataFreezeList = (await backend.getDataFreezeList()) || [];
            } catch (e: any) {
                console.error('Failed to fetch data freeze list:', e);
                this.error = e.message;
            } finally {
                this.loading = false;
            }
        },

        async setDataFreeze(item: Omit<DataFreezeItem, 'id' | 'locked_by' | 'locked_at'>) {
            this.loading = true;
            try {
                const backend = BackendFactory.createBackend() as any;
                const created = await backend.setDataFreeze(item);
                await this.writeAdminAuditLog({
                    action: 'data_freeze_lock',
                    target_type: 'data_freeze',
                    target_id: item.target_id,
                    target_name: item.target_name,
                    before_value: null,
                    after_value: created || item,
                    comment: item.reason || '프로세스 수정 잠금'
                });
                await this.fetchDataFreezeList();
            } catch (e: any) {
                console.error('Failed to set data freeze:', e);
                this.error = e.message;
                throw e;
            } finally {
                this.loading = false;
            }
        },

        async removeDataFreeze(targetId: string) {
            this.loading = true;
            try {
                const matched = this.dataFreezeList.find(item => item.target_id === targetId || item.id === targetId);
                const backend = BackendFactory.createBackend() as any;
                await backend.removeDataFreeze(targetId);
                await this.writeAdminAuditLog({
                    action: 'data_freeze_unlock',
                    target_type: 'data_freeze',
                    target_id: matched?.target_id || targetId,
                    target_name: matched?.target_name || targetId,
                    before_value: matched || { target_id: targetId },
                    after_value: null,
                    comment: '프로세스 수정 잠금 해제'
                });
                await this.fetchDataFreezeList();
            } catch (e: any) {
                console.error('Failed to remove data freeze:', e);
                this.error = e.message;
                throw e;
            } finally {
                this.loading = false;
            }
        },

        // ============================================
        // Recycle Bin
        // ============================================
        async fetchDeletedProcesses() {
            this.loading = true;
            try {
                const backend = BackendFactory.createBackend() as any;
                this.deletedProcesses = await backend.getDeletedProcesses();
            } catch (e: any) {
                console.error('Failed to fetch deleted processes:', e);
                this.error = e.message;
            } finally {
                this.loading = false;
            }
        },

        async fetchDeletedInstances() {
            this.loading = true;
            try {
                const backend = BackendFactory.createBackend() as any;
                const list = await backend.getDeletedInstances();
                this.deletedInstances = (list || []).map((inst: any) => ({
                    ...inst,
                    remaining_days: recycleBinRemainingDays(inst.deleted_at)
                }));
            } catch (e: any) {
                console.error('Failed to fetch deleted instances:', e);
                this.error = e.message;
            } finally {
                this.loading = false;
            }
        },

        async restoreProcess(procDefId: string) {
            this.loading = true;
            try {
                const matched = this.deletedProcesses.find(p => p.id === procDefId);
                const backend = BackendFactory.createBackend() as any;
                await backend.restoreProcess(procDefId);
                this.deletedProcesses = this.deletedProcesses.filter(p => p.id !== procDefId);
                await this.writeAdminAuditLog({
                    action: 'process_restore',
                    target_type: 'process',
                    target_id: procDefId,
                    target_name: matched?.name || procDefId,
                });
            } catch (e: any) {
                console.error('Failed to restore process:', e);
                this.error = e.message;
                throw e;
            } finally {
                this.loading = false;
            }
        },

        async hardDeleteProcess(procDefId: string) {
            this.loading = true;
            try {
                const matched = this.deletedProcesses.find(p => p.id === procDefId);
                const backend = BackendFactory.createBackend() as any;
                await backend.hardDeleteProcess(procDefId);
                this.deletedProcesses = this.deletedProcesses.filter(p => p.id !== procDefId);
                await this.writeAdminAuditLog({
                    action: 'process_hard_delete',
                    target_type: 'process',
                    target_id: procDefId,
                    target_name: matched?.name || procDefId,
                    before_value: { id: procDefId, name: matched?.name || null }
                });
            } catch (e: any) {
                console.error('Failed to hard delete process:', e);
                this.error = e.message;
                throw e;
            } finally {
                this.loading = false;
            }
        },

        async restoreInstance(instId: string) {
            this.loading = true;
            try {
                const backend = BackendFactory.createBackend() as any;
                await backend.restoreInstance(instId);
                this.deletedInstances = this.deletedInstances.filter(i => i.proc_inst_id !== instId);
            } catch (e: any) {
                console.error('Failed to restore instance:', e);
                this.error = e.message;
                throw e;
            } finally {
                this.loading = false;
            }
        },

        async hardDeleteInstance(instId: string) {
            this.loading = true;
            try {
                const backend = BackendFactory.createBackend() as any;
                await backend.hardDeleteInstance(instId);
                this.deletedInstances = this.deletedInstances.filter(i => i.proc_inst_id !== instId);
                await this.writeAdminAuditLog({
                    action: 'instance_hard_delete',
                    target_type: 'instance',
                    target_id: instId,
                    target_name: instId,
                    before_value: { proc_inst_id: instId }
                });
            } catch (e: any) {
                console.error('Failed to hard delete instance:', e);
                this.error = e.message;
                throw e;
            } finally {
                this.loading = false;
            }
        },

        // ============================================
        // Lane Role Group 휴지통 (soft delete 된 역할 그룹 그룹)
        // ============================================
        async fetchDeletedLaneRoleGroups() {
            const supabase = (window as any).$supabase;
            const tenantId = (window as any).$tenantName;
            if (!supabase) return;
            this.loading = true;
            try {
                const { data, error } = await supabase
                    .from('lane_role_groups')
                    .select('*')
                    .eq('tenant_id', tenantId)
                    .not('deleted_at', 'is', null)
                    .order('deleted_at', { ascending: false });
                if (error) throw error;
                // 부모 그룹도 같이 deleted 된 자식은 휴지통에서 숨김 (상위 단위로만 표시)
                // 자기 parent_id 가 deleted 목록에 있으면 cascade 로 묶여 있는 것 → 상위가 대표 행
                const rows = data || [];
                const deletedIds = new Set(rows.map((r: any) => r.id));
                this.deletedLaneRoleGroups = rows.filter(
                    (r: any) => !r.parent_id || !deletedIds.has(r.parent_id)
                );
            } catch (e: any) {
                console.error('Failed to fetch deleted lane role groups:', e);
                this.error = e.message;
            } finally {
                this.loading = false;
            }
        },

        async restoreLaneRoleGroup(id: string) {
            const supabase = (window as any).$supabase;
            const tenantId = (window as any).$tenantName;
            if (!supabase) return;
            this.loading = true;
            try {
                const matched = this.deletedLaneRoleGroups.find((g: any) => g.id === id);
                const groupDeletedAt = matched?.deleted_at;
                if (!matched || !groupDeletedAt) throw new Error('대상 그룹을 찾을 수 없습니다.');

                const now = new Date().toISOString();
                const currentUser = getCurrentUserForSoftDelete();

                // 같은 시각에 cascade 로 같이 삭제된 자식 그룹 ids
                const { data: childRows, error: childErr } = await supabase
                    .from('lane_role_groups')
                    .select('id')
                    .eq('tenant_id', tenantId)
                    .eq('parent_id', id)
                    .eq('deleted_at', groupDeletedAt);
                if (childErr) throw childErr;
                const childIds = (childRows || []).map((c: any) => c.id);
                const allIds = [id, ...childIds];

                // 1. 멤버 복원 (같은 시각에 cascade 된 것만)
                const { error: mErr } = await supabase
                    .from('lane_role_group_members')
                    .update({ deleted_at: null, deleted_by: null, updated_at: now, updated_by: currentUser })
                    .in('role_group_id', allIds)
                    .eq('tenant_id', tenantId)
                    .eq('deleted_at', groupDeletedAt);
                if (mErr) throw mErr;

                // 2. 그룹 복원
                const { error: gErr } = await supabase
                    .from('lane_role_groups')
                    .update({ deleted_at: null, deleted_by: null, updated_at: now, updated_by: currentUser })
                    .in('id', allIds)
                    .eq('tenant_id', tenantId)
                    .eq('deleted_at', groupDeletedAt);
                if (gErr) throw gErr;

                this.deletedLaneRoleGroups = this.deletedLaneRoleGroups.filter((g: any) => !allIds.includes(g.id));
                await this.writeAdminAuditLog({
                    action: 'lane_role_group_restore',
                    target_type: 'lane_role_group',
                    target_id: id,
                    target_name: matched.name
                });
            } catch (e: any) {
                console.error('Failed to restore lane role group:', e);
                this.error = e.message;
                throw e;
            } finally {
                this.loading = false;
            }
        },

        async hardDeleteLaneRoleGroup(id: string) {
            const supabase = (window as any).$supabase;
            const tenantId = (window as any).$tenantName;
            if (!supabase) return;
            this.loading = true;
            try {
                const matched = this.deletedLaneRoleGroups.find((g: any) => g.id === id);
                // FK CASCADE 로 자식 그룹 + 모든 멤버 자동 hard delete
                const { error } = await supabase
                    .from('lane_role_groups')
                    .delete()
                    .eq('id', id)
                    .eq('tenant_id', tenantId);
                if (error) throw error;
                this.deletedLaneRoleGroups = this.deletedLaneRoleGroups.filter((g: any) => g.id !== id);
                await this.writeAdminAuditLog({
                    action: 'lane_role_group_hard_delete',
                    target_type: 'lane_role_group',
                    target_id: id,
                    target_name: matched?.name || id,
                    before_value: { id, name: matched?.name || null }
                });
            } catch (e: any) {
                console.error('Failed to hard delete lane role group:', e);
                this.error = e.message;
                throw e;
            } finally {
                this.loading = false;
            }
        },

        // ============================================
        // 외부협력사 휴지통
        // ============================================
        async fetchDeletedSuppliers() {
            const supabase = (window as any).$supabase;
            const tenantId = (window as any).$tenantName;
            if (!supabase) return;
            this.loading = true;
            try {
                const { data, error } = await supabase
                    .from('suppliers')
                    .select('*')
                    .eq('tenant_id', tenantId)
                    .not('deleted_at', 'is', null)
                    .order('deleted_at', { ascending: false });
                if (error) throw error;

                this.deletedSuppliers = (data || []).map((s: any) => ({
                    id: s.id,
                    name: s.name || s.id,
                    business_number: s.business_number || null,
                    registration_type: s.registration_type || null,
                    deleted_by: s.deleted_by || '',
                    deleted_at: s.deleted_at,
                    remaining_days: recycleBinRemainingDays(s.deleted_at)
                }));
            } catch (e: any) {
                console.error('Failed to fetch deleted suppliers:', e);
                this.error = e.message;
            } finally {
                this.loading = false;
            }
        },

        async restoreSupplier(id: string) {
            const supabase = (window as any).$supabase;
            const tenantId = (window as any).$tenantName;
            if (!supabase) return;
            this.loading = true;
            try {
                const matched = this.deletedSuppliers.find((s: DeletedSupplier) => s.id === id);
                const now = new Date().toISOString();
                const { error } = await supabase
                    .from('suppliers')
                    .update({ deleted_at: null, deleted_by: null, updated_at: now })
                    .eq('id', id)
                    .eq('tenant_id', tenantId);
                if (error) throw error;

                this.deletedSuppliers = this.deletedSuppliers.filter((s: DeletedSupplier) => s.id !== id);
                await this.writeAdminAuditLog({
                    action: 'supplier_restore',
                    target_type: 'supplier',
                    target_id: id,
                    target_name: matched?.name || id,
                    before_value: { deleted_at: matched?.deleted_at || null, deleted_by: matched?.deleted_by || null },
                    after_value: { deleted_at: null, deleted_by: null }
                });
            } catch (e: any) {
                console.error('Failed to restore supplier:', e);
                this.error = e.message;
                throw e;
            } finally {
                this.loading = false;
            }
        },

        async hardDeleteSupplier(id: string) {
            const supabase = (window as any).$supabase;
            const tenantId = (window as any).$tenantName;
            if (!supabase) return;
            this.loading = true;
            try {
                const matched = this.deletedSuppliers.find((s: DeletedSupplier) => s.id === id);
                const { error } = await supabase
                    .from('suppliers')
                    .delete()
                    .eq('id', id)
                    .eq('tenant_id', tenantId)
                    .not('deleted_at', 'is', null);
                if (error) throw error;

                this.deletedSuppliers = this.deletedSuppliers.filter((s: DeletedSupplier) => s.id !== id);
                await this.writeAdminAuditLog({
                    action: 'supplier_hard_delete',
                    target_type: 'supplier',
                    target_id: id,
                    target_name: matched?.name || id,
                    before_value: matched || { id }
                });
            } catch (e: any) {
                console.error('Failed to hard delete supplier:', e);
                this.error = e.message;
                throw e;
            } finally {
                this.loading = false;
            }
        },

        // ============================================
        // 시스템 관리 휴지통
        // ============================================
        async fetchDeletedSystems() {
            this.loading = true;
            try {
                const backend = BackendFactory.createBackend() as any;
                const list = await backend.getDeletedSystemList();
                this.deletedSystems = (list || []).map((system: any) => ({
                    id: system.id,
                    name: system.name || system.id,
                    system_type: system.system_type || null,
                    category: system.category || null,
                    responsible_person: system.responsible_person || null,
                    shortcut_link: system.shortcut_link || null,
                    description: system.description || null,
                    registration_status: system.registration_status || null,
                    deleted_by: system.deleted_by || '',
                    deleted_at: system.deleted_at,
                    remaining_days: recycleBinRemainingDays(system.deleted_at)
                }));
            } catch (e: any) {
                console.error('Failed to fetch deleted systems:', e);
                this.error = e.message;
            } finally {
                this.loading = false;
            }
        },

        async restoreSystem(id: string) {
            this.loading = true;
            try {
                const matched = this.deletedSystems.find((system: DeletedSystem) => system.id === id);
                const backend = BackendFactory.createBackend() as any;
                await backend.restoreSystem(id);
                this.deletedSystems = this.deletedSystems.filter((system: DeletedSystem) => system.id !== id);
                await this.writeAdminAuditLog({
                    action: 'system_restore',
                    target_type: 'system',
                    target_id: id,
                    target_name: matched?.name || id,
                    before_value: matched || { id },
                    after_value: { id, deleted_at: null, deleted_by: null }
                });
            } catch (e: any) {
                console.error('Failed to restore system:', e);
                this.error = e.message;
                throw e;
            } finally {
                this.loading = false;
            }
        },

        async hardDeleteSystem(id: string) {
            this.loading = true;
            try {
                const matched = this.deletedSystems.find((system: DeletedSystem) => system.id === id);
                const backend = BackendFactory.createBackend() as any;
                await backend.hardDeleteSystem(id);
                this.deletedSystems = this.deletedSystems.filter((system: DeletedSystem) => system.id !== id);
                await this.writeAdminAuditLog({
                    action: 'system_hard_delete',
                    target_type: 'system',
                    target_id: id,
                    target_name: matched?.name || id,
                    before_value: matched || { id }
                });
            } catch (e: any) {
                console.error('Failed to hard delete system:', e);
                this.error = e.message;
                throw e;
            } finally {
                this.loading = false;
            }
        },

        async fetchDeletedSchemas() {
            this.loading = true;
            try {
                const backend = BackendFactory.createBackend() as any;
                const list = await backend.getDeletedPropertySchemas();
                this.deletedSchemas = (list || []).map((s: any) => ({
                    id: s.id,
                    property_key: s.property_key,
                    property_label: s.property_label || s.property_key,
                    applies_to: s.applies_to || 'both',
                    property_type: s.property_type,
                    deleted_at: s.deleted_at,
                    deleted_by: s.deleted_by || null,
                    remaining_days: recycleBinRemainingDays(s.deleted_at)
                }));
            } catch (e: any) {
                console.error('Failed to fetch deleted schemas:', e);
                this.error = e.message;
            } finally {
                this.loading = false;
            }
        },

        async restoreSchema(schemaId: string) {
            this.loading = true;
            try {
                const matched = this.deletedSchemas.find(s => s.id === schemaId);
                const backend = BackendFactory.createBackend() as any;
                await backend.restorePropertySchema(schemaId);
                this.deletedSchemas = this.deletedSchemas.filter(s => s.id !== schemaId);
                await this.writeAdminAuditLog({
                    action: 'schema_restore',
                    target_type: 'property_schema',
                    target_id: matched?.property_key || schemaId,
                    target_name: matched?.property_label || schemaId,
                    before_value: { deleted_at: matched?.deleted_at },
                    after_value: { deleted_at: null }
                });
            } catch (e: any) {
                console.error('Failed to restore property schema:', e);
                this.error = e.message;
                throw e;
            } finally {
                this.loading = false;
            }
        },

        async hardDeleteSchema(schemaId: string) {
            this.loading = true;
            try {
                const matched = this.deletedSchemas.find(s => s.id === schemaId);
                const backend = BackendFactory.createBackend() as any;
                await backend.deletePropertySchema(schemaId);
                this.deletedSchemas = this.deletedSchemas.filter(s => s.id !== schemaId);
                await this.writeAdminAuditLog({
                    action: 'schema_hard_delete',
                    target_type: 'property_schema',
                    target_id: matched?.property_key || schemaId,
                    target_name: matched?.property_label || schemaId,
                    before_value: matched || { id: schemaId },
                    after_value: null,
                    comment: '휴지통에서 영구 삭제'
                });
            } catch (e: any) {
                console.error('Failed to hard delete property schema:', e);
                this.error = e.message;
                throw e;
            } finally {
                this.loading = false;
            }
        },

        async fetchDeletedAuditPolicies() {
            const supabase = (window as any).$supabase;
            const tenantId = (window as any).$tenantName;
            if (!supabase) return;
            this.loading = true;
            try {
                const { data, error } = await supabase
                    .from('audit_policy')
                    .select('*')
                    .eq('tenant_id', tenantId)
                    .not('deleted_at', 'is', null)
                    .order('deleted_at', { ascending: false });
                if (error) throw error;
                this.deletedAuditPolicies = (data || []).map((row: any) => {
                    return {
                        id: row.id,
                        name: row.name,
                        kind: row.kind,
                        file_path: row.file_path || null,
                        file_bucket: row.file_bucket || null,
                        link_url: row.link_url || null,
                        deleted_by: row.deleted_by || '',
                        deleted_at: row.deleted_at,
                        remaining_days: recycleBinRemainingDays(row.deleted_at)
                    } as DeletedAuditPolicy;
                });
            } catch (e: any) {
                console.error('Failed to fetch deleted audit policies:', e);
                this.error = e.message;
            } finally {
                this.loading = false;
            }
        },

        async restoreAuditPolicy(policyId: string) {
            const supabase = (window as any).$supabase;
            const tenantId = (window as any).$tenantName;
            if (!supabase) return;
            this.loading = true;
            try {
                const matched = this.deletedAuditPolicies.find(p => p.id === policyId);
                const { error } = await supabase
                    .from('audit_policy')
                    .update({
                        deleted_at: null
                    })
                    .eq('id', policyId)
                    .eq('tenant_id', tenantId);
                if (error) throw error;
                this.deletedAuditPolicies = this.deletedAuditPolicies.filter(p => p.id !== policyId);
                await this.writeAdminAuditLog({
                    action: 'audit_policy_restore',
                    target_type: 'audit_policy',
                    target_id: policyId,
                    target_name: matched?.name || policyId
                });
            } catch (e: any) {
                console.error('Failed to restore audit policy:', e);
                this.error = e.message;
                throw e;
            } finally {
                this.loading = false;
            }
        },

        async hardDeleteAuditPolicy(policyId: string) {
            const supabase = (window as any).$supabase;
            const tenantId = (window as any).$tenantName;
            if (!supabase) return;
            this.loading = true;
            try {
                const matched = this.deletedAuditPolicies.find(p => p.id === policyId);
                if (matched?.kind === 'file' && matched.file_path) {
                    // 비공개 버킷이어도 삭제는 로그인 세션으로 그대로 된다(RLS 적용).
                    // 주소를 만들 일이 없으므로 서명 URL 은 필요 없다.
                    await supabase.storage
                        .from(matched.file_bucket || 'files')
                        .remove([matched.file_path])
                        .catch(() => undefined);
                }
                const { error } = await supabase
                    .from('audit_policy')
                    .delete()
                    .eq('id', policyId)
                    .eq('tenant_id', tenantId);
                if (error) throw error;
                this.deletedAuditPolicies = this.deletedAuditPolicies.filter(p => p.id !== policyId);
                await this.writeAdminAuditLog({
                    action: 'audit_policy_hard_delete',
                    target_type: 'audit_policy',
                    target_id: policyId,
                    target_name: matched?.name || policyId,
                    comment: '휴지통에서 영구 삭제'
                });
            } catch (e: any) {
                console.error('Failed to hard delete audit policy:', e);
                this.error = e.message;
                throw e;
            } finally {
                this.loading = false;
            }
        },

        // ============================================
        // KPI Targets
        // ============================================
        async fetchKpiTargets(year?: number) {
            this.loading = true;
            try {
                const backend = BackendFactory.createBackend() as any;
                const targets = (await backend.getKpiTargets()) || [];

                const yearOf = (t: any) =>
                    t.year ?? (t.period_start ? new Date(t.period_start).getFullYear() : null);

                // 한 번의 GET 으로 활성/휴지통 둘 다 가져오는 단일 jsonb 구조이므로 여기서 분리.
                //   - 활성 (deleted_at 없는 것): 연도 필터 + published 계산 후 kpiTargets 에 채움
                //   - 휴지통 (deleted_at 있는 것): 연도 필터 없이 deletedKpiTargets 에 채움 (보존 30일)
                const active = targets.filter((t: any) => !t.deleted_at);
                const trash = targets.filter((t: any) => !!t.deleted_at);

                const filtered = active.filter((t: any) => !year || yearOf(t) === year);

                // 모든 target 의 process_ids 를 모아 alive / published / 체계도 등록 여부를 한 번에 조회.
                //   alive     = proc_def.deleted_at IS NULL 인 살아있는 proc (soft/hard 삭제 모두 제외)
                //   published = alive 중 현재 published 버전이 있는 것
                //   registered = procMap.sub_proc_list 에 등록된 id (= 체계도에 정식 등록된 sub-process)
                // → 화면에는 (alive ∩ registered) 만 노출. target/published_count 도 같은 기준.
                //   체계도 미등록(모듈, 빈 껍데기, 사고로 빠진 것 등) 은 KPI 집계 대상에서 제외.
                //   jsonb 원본 process_ids 는 건드리지 않음 (체계도 복원/모듈 해제 시 자동 복귀).
                const allProcessIds = [
                    ...new Set(
                        filtered.flatMap((t: any) =>
                            Array.isArray(t.process_ids) ? t.process_ids : []
                        )
                    )
                ] as string[];

                const [aliveSet, publishedSet, procMap]: [Set<string>, Set<string>, any] =
                    allProcessIds.length > 0
                        ? await Promise.all([
                              backend.getAliveProcessIdsAmong(allProcessIds),
                              backend.getPublishedProcessIds(allProcessIds),
                              backend.getProcessDefinitionMap()
                          ])
                        : [new Set(), new Set(), null];

                const registeredSet: Set<string> = collectHierarchyProcIds(
                    procMap?.value || procMap || {}
                );

                this.kpiTargets = filtered.map((t: any) => {
                    const rawProcessIds: string[] = Array.isArray(t.process_ids) ? t.process_ids : [];
                    const visibleProcessIds = rawProcessIds.filter(
                        (id) => aliveSet.has(id) && registeredSet.has(id)
                    );
                    const target = visibleProcessIds.length;
                    const published = visibleProcessIds.filter((id) => publishedSet.has(id)).length;
                    const row: KpiTarget = {
                        id: t.id,
                        year: yearOf(t),
                        org_id: t.org_id || t.domain_id || '',
                        org_name: t.org_name || t.domain_name || t.org_id || '',
                        process_ids: visibleProcessIds,
                        target,
                        published_count: published,
                        achievement_rate: target > 0 ? Math.round((published / target) * 100) : 0,
                        period_type: t.period_type,
                        period_start: t.period_start,
                        updated_at: t.updated_at
                    };
                    // parent 키가 raw 에 존재하면 그대로 보존 — undefined(legacy) 와 null(최상위) 구분
                    if ('parent' in t) {
                        row.parent = t.parent
                            ? { id: String(t.parent.id || '').trim(), name: String(t.parent.name || '') }
                            : null;
                    }
                    return row;
                });

                this.deletedKpiTargets = trash.map((t: any) => {
                    const processIds: string[] = Array.isArray(t.process_ids) ? t.process_ids : [];
                    const row: DeletedKpiTarget = {
                        id: t.id,
                        year: yearOf(t),
                        org_id: t.org_id || t.domain_id || '',
                        org_name: t.org_name || t.domain_name || t.org_id || '',
                        process_ids: processIds,
                        deleted_at: t.deleted_at,
                        deleted_by: t.deleted_by || '',
                        remaining_days: recycleBinRemainingDays(t.deleted_at)
                    };
                    if ('parent' in t) {
                        row.parent = t.parent
                            ? { id: String(t.parent.id || '').trim(), name: String(t.parent.name || '') }
                            : null;
                    }
                    return row;
                });
            } catch (e: any) {
                console.error('Failed to fetch KPI targets:', e);
                this.error = e.message;
            } finally {
                this.loading = false;
            }
        },

        async saveKpiTarget(target: KpiTarget) {
            this.loading = true;
            try {
                const backend = BackendFactory.createBackend() as any;
                const rawProcessIds = Array.isArray(target.process_ids) ? target.process_ids : [];

                // 점진 정리 — hard 삭제된 (proc_def row 가 아예 사라진) id 만 자동 제거.
                //   soft 삭제된 id 는 복원 가능성 위해 유지 (복원되면 화면에 자동 복귀).
                //   → 사용자가 KPI 를 한 번이라도 수정 저장하면 누적된 dead id 가 점차 사라짐.
                const supabase = (window as any).$supabase;
                let processIds = rawProcessIds;
                if (supabase && rawProcessIds.length > 0) {
                    try {
                        const CHUNK = 50;
                        const existing = new Set<string>();
                        for (let i = 0; i < rawProcessIds.length; i += CHUNK) {
                            const chunk = rawProcessIds.slice(i, i + CHUNK);
                            const { data } = await supabase
                                .from('proc_def')
                                .select('id')
                                .eq('tenant_id', (window as any).$tenantName)
                                .in('id', chunk);
                            (data || []).forEach((r: any) => r?.id && existing.add(r.id));
                        }
                        processIds = rawProcessIds.filter((id) => existing.has(id));
                    } catch (e) {
                        console.warn('[adminConsole] saveKpiTarget dead-id purge skipped:', e);
                        // 정리 실패는 무시 — 원본 그대로 저장
                    }
                }

                // parent 는 호출자가 명시적으로 지정한 경우(객체 or null)에만 페이로드에 포함.
                // 키 자체 미전달이면 backend 의 기존값을 그대로 유지하기 위해 보내지 않는다.
                const payload: any = {
                    id: target.id,
                    year: target.year,
                    org_id: target.org_id,
                    org_name: target.org_name,
                    process_ids: processIds,
                    target_value: processIds.length,
                    period_type: 'yearly',
                    period_start: `${target.year}-01-01`
                };
                if ('parent' in target) payload.parent = target.parent;

                // audit 용 before 스냅샷 — id 매칭 우선, 신규(id 없음) 면 (year, org_id) 로 폴백 매칭
                const previous = target.id
                    ? this.kpiTargets.find((t) => t.id === target.id)
                    : this.kpiTargets.find(
                          (t) => t.year === target.year && t.org_id === target.org_id
                      );
                const isCreate = !previous;

                const saved = await backend.upsertKpiTarget(payload);
                await this.fetchKpiTargets(target.year);

                const targetIdForAudit = saved?.id || previous?.id || target.id || '';
                const targetNameForAudit = `${target.year} · ${target.org_name || target.org_id}`;
                if (isCreate) {
                    await this.writeAdminAuditLog({
                        action: 'kpi_target_create',
                        target_type: 'kpi_target',
                        target_id: targetIdForAudit,
                        target_name: targetNameForAudit,
                        before_value: null,
                        after_value: {
                            year: target.year,
                            org_id: target.org_id,
                            org_name: target.org_name,
                            parent: 'parent' in target ? target.parent ?? null : undefined,
                            process_ids: processIds
                        }
                    });
                } else {
                    await this.writeAdminAuditLog({
                        action: 'kpi_target_update',
                        target_type: 'kpi_target',
                        target_id: targetIdForAudit,
                        target_name: targetNameForAudit,
                        before_value: {
                            year: previous!.year,
                            org_id: previous!.org_id,
                            org_name: previous!.org_name,
                            parent: 'parent' in previous! ? previous!.parent ?? null : undefined,
                            process_ids: Array.isArray(previous!.process_ids)
                                ? [...previous!.process_ids]
                                : []
                        },
                        after_value: {
                            year: target.year,
                            org_id: target.org_id,
                            org_name: target.org_name,
                            parent: 'parent' in target ? target.parent ?? null : undefined,
                            process_ids: processIds
                        }
                    });
                }
            } catch (e: any) {
                console.error('Failed to save KPI target:', e);
                this.error = e.message;
                throw e;
            } finally {
                this.loading = false;
            }
        },

        // KpiTargetManager 의 삭제 버튼 → soft delete (휴지통 이동). 영구 삭제는 hardDeleteKpiTarget.
        async deleteKpiTarget(id: string) {
            this.loading = true;
            try {
                const backend = BackendFactory.createBackend() as any;
                // 다른 휴지통 entity 와 동일하게 "이름\n(팀)" 포맷으로 저장 →
                //   RecycleBin 의 deletedByName/deletedByTeam 분해 로직이 그대로 적용됨.
                const deletedBy = getCurrentUserForSoftDelete();
                const moved = this.kpiTargets.find(t => t.id === id);
                await backend.softDeleteKpiTarget(id, deletedBy);
                this.kpiTargets = this.kpiTargets.filter(t => t.id !== id);
                if (moved) {
                    const nowIso = new Date().toISOString();
                    const entry: DeletedKpiTarget = {
                        id: moved.id || '',
                        year: moved.year,
                        org_id: moved.org_id,
                        org_name: moved.org_name,
                        process_ids: Array.isArray(moved.process_ids) ? [...moved.process_ids] : [],
                        deleted_at: nowIso,
                        deleted_by: deletedBy,
                        remaining_days: recycleBinRemainingDays(null)
                    };
                    if ('parent' in moved) entry.parent = moved.parent ?? null;
                    this.deletedKpiTargets = [entry, ...this.deletedKpiTargets];
                }
                if (moved) {
                    await this.writeAdminAuditLog({
                        action: 'kpi_target_delete',
                        target_type: 'kpi_target',
                        target_id: moved.id || id,
                        target_name: `${moved.year} · ${moved.org_name || moved.org_id}`,
                        before_value: {
                            year: moved.year,
                            org_id: moved.org_id,
                            org_name: moved.org_name,
                            parent: 'parent' in moved ? moved.parent ?? null : undefined,
                            process_ids: Array.isArray(moved.process_ids)
                                ? [...moved.process_ids]
                                : []
                        },
                        after_value: { deleted_at: new Date().toISOString(), deleted_by: deletedBy },
                        comment: '휴지통 이동'
                    });
                }
            } catch (e: any) {
                console.error('Failed to soft-delete KPI target:', e);
                this.error = e.message;
                throw e;
            } finally {
                this.loading = false;
            }
        },

        async restoreKpiTarget(id: string) {
            this.loading = true;
            try {
                const backend = BackendFactory.createBackend() as any;
                const matched = this.deletedKpiTargets.find(t => t.id === id);
                await backend.restoreKpiTarget(id);
                this.deletedKpiTargets = this.deletedKpiTargets.filter(t => t.id !== id);
                // 활성 목록은 KpiTargetManager 진입 시 fetch 로 갱신되므로 여기서는 별도 push 생략
                if (matched) {
                    await this.writeAdminAuditLog({
                        action: 'kpi_target_restore',
                        target_type: 'kpi_target',
                        target_id: matched.id,
                        target_name: `${matched.year} · ${matched.org_name || matched.org_id}`,
                        before_value: {
                            deleted_at: matched.deleted_at,
                            deleted_by: matched.deleted_by
                        },
                        after_value: { deleted_at: null, deleted_by: null }
                    });
                }
            } catch (e: any) {
                console.error('Failed to restore KPI target:', e);
                this.error = e.message;
                throw e;
            } finally {
                this.loading = false;
            }
        },

        async hardDeleteKpiTarget(id: string) {
            this.loading = true;
            try {
                const backend = BackendFactory.createBackend() as any;
                const matched =
                    this.deletedKpiTargets.find(t => t.id === id) ||
                    this.kpiTargets.find(t => t.id === id);
                await backend.deleteKpiTarget(id);
                this.deletedKpiTargets = this.deletedKpiTargets.filter(t => t.id !== id);
                this.kpiTargets = this.kpiTargets.filter(t => t.id !== id);
                if (matched) {
                    await this.writeAdminAuditLog({
                        action: 'kpi_target_hard_delete',
                        target_type: 'kpi_target',
                        target_id: matched.id || id,
                        target_name: `${matched.year} · ${matched.org_name || matched.org_id}`,
                        before_value: matched,
                        after_value: null,
                        comment: '휴지통에서 영구 삭제'
                    });
                }
            } catch (e: any) {
                console.error('Failed to hard-delete KPI target:', e);
                this.error = e.message;
                throw e;
            } finally {
                this.loading = false;
            }
        },

        // ============================================
        // Notice Banner
        // ============================================
        async fetchNoticeBanner() {
            try {
                const backend = BackendFactory.createBackend() as any;
                const config = await backend.getNoticeBanner();
                if (config) {
                    this.noticeBanner = config;
                }
            } catch (e: any) {
                console.error('Failed to fetch notice banner:', e);
            }
        },

        async saveNoticeBanner(config: NoticeBannerConfig) {
            this.loading = true;
            try {
                const backend = BackendFactory.createBackend() as any;
                const beforeValue = { ...this.noticeBanner };
                await backend.saveNoticeBanner(config);
                this.noticeBanner = config;
                await this.writeAdminAuditLog({
                    action: 'notice_banner_update',
                    target_type: 'system',
                    target_id: 'notice_banner',
                    target_name: '공지 배너',
                    before_value: beforeValue,
                    after_value: { ...config }
                });
            } catch (e: any) {
                console.error('Failed to save notice banner:', e);
                this.error = e.message;
                throw e;
            } finally {
                this.loading = false;
            }
        },

        // ============================================
        // Maintenance Mode
        // ============================================
        async fetchMaintenanceMode() {
            try {
                const backend = BackendFactory.createBackend() as any;
                const config = await backend.getMaintenanceMode();
                if (config) {
                    this.maintenanceMode = config;
                }
            } catch (e: any) {
                console.error('Failed to fetch maintenance mode:', e);
            }
        },

        async toggleMaintenanceMode(enabled: boolean, message?: string) {
            this.loading = true;
            try {
                const backend = BackendFactory.createBackend() as any;
                const beforeValue = { ...this.maintenanceMode };
                const config = {
                    enabled,
                    message: message || this.maintenanceMode.message,
                    activated_by: enabled ? (localStorage.getItem('userName') || localStorage.getItem('email') || (window as any).$userName || 'admin') : '',
                    activated_role: enabled ? ((localStorage.getItem('roles') || '').split(',').find(r => ['admin', 'role_admin', 'superAdmin'].includes(r.trim().toLowerCase()) || r.trim().toLowerCase() === 'superadmin') || 'Admin') : '',
                    activated_at: enabled ? new Date().toISOString() : ''
                };
                await backend.setMaintenanceMode(config);
                this.maintenanceMode = config;
                // 라우터 가드가 30초 TTL 캐시로 판정하므로 토글 즉시 재조회되도록 무효화
                invalidateMaintenanceCache();
                await this.writeAdminAuditLog({
                    action: 'maintenance_toggle',
                    target_type: 'system',
                    target_id: 'maintenance_mode',
                    target_name: '점검 모드',
                    before_value: beforeValue,
                    after_value: { ...config }
                });
            } catch (e: any) {
                console.error('Failed to toggle maintenance mode:', e);
                this.error = e.message;
                throw e;
            } finally {
                this.loading = false;
            }
        },

        // ============================================
        // Audit Log Retention (docs/security.md 4-3, 항목 17)
        //
        // 저장 위치는 다른 테넌트 설정과 같은 public.configuration
        // (tenant_id + key 유일, 쓰기는 admin 이상). PalModeBackend 의
        // get/setConfigurationValue 헬퍼를 그대로 쓴다 — notice_banner /
        // maintenance_mode 와 동일한 경로라 RLS·테넌트 스코프가 자동으로 맞는다.
        //
        // 여기서 일수를 바꿔도 즉시 로그가 옮겨지지는 않는다. DB 의
        // archive_expired_audit_logs() 를 pg_cron 이 매일 03:00 에 돌리면서
        // 이 값을 읽는다.
        // ============================================
        async fetchAuditLogRetention() {
            try {
                const backend = BackendFactory.createBackend() as any;
                const config = await backend.getConfigurationValue(AUDIT_RETENTION_CONFIG_KEY, {
                    retention_days: AUDIT_RETENTION_DEFAULT_DAYS
                });
                this.auditLogRetention = {
                    retention_days: normalizeRetentionDays(config?.retention_days)
                };
            } catch (e: any) {
                // 조회 실패는 화면을 막지 않는다 — 기본값(365)을 그대로 보여준다.
                console.error('Failed to fetch audit log retention:', e);
            }
        },

        async saveAuditLogRetention(days: number) {
            const next = normalizeRetentionDays(days);
            if (next !== Math.trunc(Number(days))) {
                // 화면에서 이미 막지만, 스토어를 직접 부르는 경로가 생겨도
                // 범위 밖 값이 DB 로 새어나가지 않게 한다.
                throw new Error(
                    `보관 일수는 ${AUDIT_RETENTION_MIN_DAYS}~${AUDIT_RETENTION_MAX_DAYS}일 사이의 정수여야 합니다.`
                );
            }

            this.loading = true;
            try {
                const backend = BackendFactory.createBackend() as any;
                const beforeValue = { ...this.auditLogRetention };
                const config: AuditLogRetentionConfig = { retention_days: next };

                await backend.setConfigurationValue(AUDIT_RETENTION_CONFIG_KEY, config);
                this.auditLogRetention = config;

                // 보관 정책 변경은 "기록을 언제 지울지" 를 바꾸는 일이라
                // 그 자체가 감사 대상이다.
                await this.writeAdminAuditLog({
                    action: 'audit_retention_update',
                    target_type: 'system',
                    target_id: AUDIT_RETENTION_CONFIG_KEY,
                    target_name: '감사 로그 보관 일수',
                    before_value: beforeValue,
                    after_value: { ...config }
                });
                return config;
            } catch (e: any) {
                console.error('Failed to save audit log retention:', e);
                this.error = e.message;
                throw e;
            } finally {
                this.loading = false;
            }
        },

        // ============================================
        // 보안 정책 (docs/security.md 2-1 / 2-3 / 2-4 / 3-3)
        //
        // 저장 경로는 감사 로그 보관 정책과 같다 — PalModeBackend 의
        // get/setConfigurationValue 헬퍼(configuration 테이블, tenant_id + key).
        //
        // 네 정책 모두 "여기서 바꾸면 다른 곳이 읽는" 구조다.
        //   session_timeout  → useIdleTimeout (앱 시작 시 1회 조회, 새로고침 후 반영)
        //   login_lockout    → DB 훅 (다음 로그인 시도부터 반영)
        //   mfa_policy       → mfaGate (60초 캐시, 저장 후 즉시 무효화한다)
        //   download_anomaly → DB 함수 (매시 예약 실행 시 반영)
        // 즉시 반영되지 않는 지연은 화면 안내 문구로 알린다.
        // ============================================

        /** 보안 정책 저장 공통 경로 — 정규화·감사 기록·기본값 플래그 해제를 한 곳에 모은다. */
        async saveSecurityPolicy(params: {
            key: SecurityConfigKey;
            targetName: string;
            before: Record<string, any>;
            value: Record<string, any>;
        }) {
            this.loading = true;
            try {
                const backend = BackendFactory.createBackend() as any;
                await backend.setConfigurationValue(params.key, params.value);
                this.securityPolicyUsingDefault[params.key] = false;

                // 보안 정책 변경은 그 자체가 감사 대상이다. 어떤 키를 어떻게
                // 바꿨는지 before/after 로 남긴다.
                await this.writeAdminAuditLog({
                    action: 'security_settings_update',
                    target_type: 'system',
                    target_id: params.key,
                    target_name: params.targetName,
                    before_value: { ...params.before },
                    after_value: { ...params.value }
                });
                return params.value;
            } catch (e: any) {
                console.error(`Failed to save security policy (${params.key}):`, e);
                this.error = e.message;
                throw e;
            } finally {
                this.loading = false;
            }
        },

        async fetchSessionTimeoutPolicy() {
            try {
                const backend = BackendFactory.createBackend() as any;
                const raw = await backend.getConfigurationValue(SESSION_TIMEOUT_CONFIG_KEY, null);
                this.securityPolicyUsingDefault[SESSION_TIMEOUT_CONFIG_KEY] = raw == null;
                this.sessionTimeoutPolicy = normalizeSessionTimeout(raw ?? SESSION_TIMEOUT_DEFAULTS);
            } catch (e: any) {
                // 조회 실패는 화면을 막지 않는다 — 기본값을 그대로 보여준다.
                console.error('Failed to fetch session timeout policy:', e);
            }
        },

        async saveSessionTimeoutPolicy(config: SessionTimeoutConfig): Promise<SessionTimeoutConfig> {
            const value = normalizeSessionTimeout(config);
            await this.saveSecurityPolicy({
                key: SESSION_TIMEOUT_CONFIG_KEY,
                targetName: '세션 타임아웃 정책',
                before: { ...this.sessionTimeoutPolicy },
                value
            });
            this.sessionTimeoutPolicy = value;
            return value;
        },

        async fetchLoginLockoutPolicy() {
            try {
                const backend = BackendFactory.createBackend() as any;
                const raw = await backend.getConfigurationValue(LOGIN_LOCKOUT_CONFIG_KEY, null);
                this.securityPolicyUsingDefault[LOGIN_LOCKOUT_CONFIG_KEY] = raw == null;
                this.loginLockoutPolicy = normalizeLoginLockout(raw ?? LOGIN_LOCKOUT_DEFAULTS);
            } catch (e: any) {
                console.error('Failed to fetch login lockout policy:', e);
            }
        },

        async saveLoginLockoutPolicy(config: LoginLockoutConfig): Promise<LoginLockoutConfig> {
            const value = normalizeLoginLockout(config);
            await this.saveSecurityPolicy({
                key: LOGIN_LOCKOUT_CONFIG_KEY,
                targetName: '로그인 잠금 정책',
                before: { ...this.loginLockoutPolicy },
                value
            });
            this.loginLockoutPolicy = value;
            return value;
        },

        async fetchMfaPolicy() {
            try {
                const backend = BackendFactory.createBackend() as any;
                const raw = await backend.getConfigurationValue(MFA_POLICY_CONFIG_KEY, null);
                this.securityPolicyUsingDefault[MFA_POLICY_CONFIG_KEY] = raw == null;
                this.mfaPolicy = normalizeMfaPolicy(raw ?? MFA_POLICY_DEFAULTS);
            } catch (e: any) {
                console.error('Failed to fetch MFA policy:', e);
            }
        },

        async saveMfaPolicy(config: MfaPolicyConfig): Promise<MfaPolicyConfig> {
            const value = normalizeMfaPolicy(config);
            await this.saveSecurityPolicy({
                key: MFA_POLICY_CONFIG_KEY,
                targetName: 'MFA 필수 정책',
                before: { ...this.mfaPolicy },
                value
            });
            this.mfaPolicy = value;
            // 라우터 게이트는 정책을 60초 캐시한다. 방금 바꾼 관리자가 이전
            // 정책으로 판정되는 일이 없게 즉시 무효화한다.
            invalidateMfaPolicyCache();
            return value;
        },

        async fetchDownloadAnomalyPolicy() {
            try {
                const backend = BackendFactory.createBackend() as any;
                const raw = await backend.getConfigurationValue(DOWNLOAD_ANOMALY_CONFIG_KEY, null);
                this.securityPolicyUsingDefault[DOWNLOAD_ANOMALY_CONFIG_KEY] = raw == null;
                this.downloadAnomalyPolicy = normalizeDownloadAnomaly(raw ?? DOWNLOAD_ANOMALY_DEFAULTS);
            } catch (e: any) {
                console.error('Failed to fetch download anomaly policy:', e);
            }
        },

        async saveDownloadAnomalyPolicy(config: DownloadAnomalyConfig): Promise<DownloadAnomalyConfig> {
            const value = normalizeDownloadAnomaly(config);
            await this.saveSecurityPolicy({
                key: DOWNLOAD_ANOMALY_CONFIG_KEY,
                targetName: '다운로드 이상 탐지 임계치',
                before: { ...this.downloadAnomalyPolicy },
                value
            });
            this.downloadAnomalyPolicy = value;
            return value;
        },

        /** 보안 설정 화면 진입 시 한 번에 불러오기 */
        async fetchSecuritySettings() {
            await Promise.all([
                this.fetchSessionTimeoutPolicy(),
                this.fetchLoginLockoutPolicy(),
                this.fetchMfaPolicy(),
                this.fetchDownloadAnomalyPolicy(),
                this.fetchAuditLogRetention()
            ]);
        },

        async persistCutoverJobs(nextJobs: CutoverJob[]) {
            const normalized = sortCutoverJobs(nextJobs);
            this.cutoverJobs = normalized;
            writeCutoverJobs(normalized);

            const backend = BackendFactory.createBackend() as any;
            await backend.saveRestructureCutoverJobs(normalized);
            return normalized;
        },

        async loadCutoverJobs() {
            try {
                const backend = BackendFactory.createBackend() as any;
                const remoteJobs = ((await backend.getRestructureCutoverJobs()) || []) as CutoverJob[];
                const localJobs = readCutoverJobs();
                const merged = mergeCutoverJobs(remoteJobs, localJobs);
                this.cutoverJobs = merged;
                writeCutoverJobs(merged);

                if (JSON.stringify(remoteJobs || []) !== JSON.stringify(merged)) {
                    await backend.saveRestructureCutoverJobs(merged);
                }
            } catch (e: any) {
                console.error('Failed to load restructure cutover jobs:', e);
                this.error = e.message || String(e);
                this.cutoverJobs = sortCutoverJobs(readCutoverJobs());
            }
        },

        async recordCutoverJob(job: CutoverJob) {
            const nextJobs = sortCutoverJobs([normalizeCutoverJob(job), ...this.cutoverJobs.filter((item) => item.id !== job.id)]);
            await this.persistCutoverJobs(nextJobs);
            return nextJobs.find((item) => item.id === job.id) || null;
        },

        async updateCutoverJob(jobId: string, patch: Partial<CutoverJob>) {
            if (!this.cutoverJobs.some((job) => job.id === jobId)) {
                throw new Error('구조개편 cut-over job을 찾을 수 없습니다.');
            }
            const nextJobs = this.cutoverJobs.map((job) =>
                job.id === jobId
                    ? {
                          ...job,
                          ...patch
                      }
                    : job
            );
            await this.persistCutoverJobs(nextJobs);
            return nextJobs.find((job) => job.id === jobId) || null;
        },

        async approveCutoverJob(jobId: string, comment = '') {
            const now = new Date().toISOString();
            const actor = resolveCutoverActor();
            const updated = await this.updateCutoverJob(jobId, {
                approval_status: 'approved',
                approval_comment: comment,
                approved_by: actor,
                approved_at: now,
                rejected_by: '',
                rejected_at: ''
            });
            if (updated) {
                await this.writeAdminAuditLog({
                    action: 'restructure_approve',
                    target_type: 'system',
                    target_id: jobId,
                    target_name: updated.title,
                    after_value: { approval_status: 'approved', approved_by: actor, approved_at: now },
                    comment
                });
            }
            return updated;
        },

        async rejectCutoverJob(jobId: string, comment = '') {
            const now = new Date().toISOString();
            const actor = resolveCutoverActor();
            const updated = await this.updateCutoverJob(jobId, {
                approval_status: 'rejected',
                approval_comment: comment,
                rejected_by: actor,
                rejected_at: now
            });
            if (updated) {
                await this.writeAdminAuditLog({
                    action: 'restructure_reject',
                    target_type: 'system',
                    target_id: jobId,
                    target_name: updated.title,
                    after_value: { approval_status: 'rejected', rejected_by: actor, rejected_at: now },
                    comment
                });
            }
            return updated;
        },

        async runCutoverJob(jobId: string) {
            const backend = BackendFactory.createBackend() as any;
            const job = this.cutoverJobs.find((item) => item.id === jobId);
            if (!job) throw new Error('구조개편 cut-over job을 찾을 수 없습니다.');
            if (!job.draft_map) throw new Error('적용할 target architecture draft가 없습니다.');
            if (job.approval_status !== 'approved') {
                throw new Error('특별 결재 라인 승인이 완료된 후 cut-over를 적용할 수 있습니다.');
            }

            const maintenanceMode = await backend.getMaintenanceMode();
            if (!maintenanceMode?.enabled) {
                throw new Error('점검 모드를 먼저 활성화해야 구조개편 cut-over를 적용할 수 있습니다.');
            }

            const actor = resolveCutoverActor();
            const startedAt = new Date().toISOString();

            await this.updateCutoverJob(jobId, {
                status: 'running',
                scheduled_at: job.scheduled_at || job.created_at,
                started_at: startedAt,
                executed_by: actor,
                maintenance_message: maintenanceMode.message || job.maintenance_message || '',
                error_message: ''
            });

            try {
                // 도메인 개편은 도메인 마스터(metrics)를 먼저 반영한다.
                // proc_map 이 먼저 들어가면 그 사이 화면이 "없는 도메인"을 추론해 되살릴 수 있다.
                if (job.draft_metrics) {
                    await backend.putMetricsMap(job.draft_metrics);
                }
                await backend.putProcessDefinitionMap(job.draft_map);
                const executedAt = new Date().toISOString();
                const updated = await this.updateCutoverJob(jobId, {
                    status: 'completed',
                    executed_at: executedAt,
                    executed_by: actor,
                    failed_at: '',
                    error_message: ''
                });
                if (updated) {
                    await this.writeAdminAuditLog({
                        action: 'restructure_apply',
                        target_type: 'system',
                        target_id: jobId,
                        target_name: updated.title,
                        after_value: { status: 'completed', executed_by: actor, executed_at: executedAt }
                    });
                }
                return updated;
            } catch (e: any) {
                const failedAt = new Date().toISOString();
                await this.updateCutoverJob(jobId, {
                    status: 'failed',
                    failed_at: failedAt,
                    executed_by: actor,
                    error_message: e?.message || 'unknown error'
                });
                await this.writeAdminAuditLog({
                    action: 'restructure_apply_failed',
                    target_type: 'system',
                    target_id: jobId,
                    target_name: job.title,
                    after_value: { status: 'failed', failed_at: failedAt },
                    comment: e?.message || 'unknown error'
                });
                throw e;
            }
        },

        // ============================================
        // Audit Logs
        // ============================================
        async fetchAuditLogs(filters?: AuditFilter) {
            this.loading = true;
            try {
                const backend = BackendFactory.createBackend() as any;
                const result = await backend.getAllAuditLogs(filters);
                this.auditLogs = result.data || result;
                this.auditTotal = result.total || this.auditLogs.length;
            } catch (e: any) {
                console.error('Failed to fetch audit logs:', e);
                this.error = e.message;
            } finally {
                this.loading = false;
            }
        },

        // ============================================
        // Admin Audit Logs (관리자 감사 로그)
        // ============================================
        async writeAdminAuditLog(entry: {
            action: string;
            target_type: string;
            target_id?: string;
            target_name?: string;
            before_value?: any;
            after_value?: any;
            comment?: string;
        }) {
            try {
                const backend = BackendFactory.createBackend() as any;
                await backend.insertAdminAuditLog(entry);
            } catch (e: any) {
                console.error('Failed to write admin audit log:', e);
            }
        },

        async fetchAdminAuditLogs(filters?: AdminAuditFilter) {
            this.loading = true;
            try {
                const backend = BackendFactory.createBackend() as any;
                const result = await backend.getAdminAuditLogs(filters);
                this.adminAuditLogs = result.data || [];
                this.adminAuditTotal = result.total || 0;
            } catch (e: any) {
                console.error('Failed to fetch admin audit logs:', e);
                this.error = e.message;
            } finally {
                this.loading = false;
            }
        },

        // ============================================
        // Auth Login Audit (로그인/로그아웃/로그인 실패 이력)
        //  - 테이블 public.auth_login_audit, 조회는 RLS 로 관리자만 통과한다.
        //  - 조회 메서드는 PalModeBackend 에만 있으므로 비 PAL 백엔드에서는 빈 결과로 둔다.
        // ============================================
        async fetchAuthLoginAudit(filters?: AuthLoginAuditFilter) {
            this.loading = true;
            try {
                const backend = BackendFactory.createBackend() as any;
                if (typeof backend.getAuthLoginAudit !== 'function') {
                    this.authLoginAudit = [];
                    this.authLoginAuditTotal = 0;
                    return;
                }
                const result = await backend.getAuthLoginAudit(filters);
                this.authLoginAudit = result.data || [];
                this.authLoginAuditTotal = result.total || 0;
            } catch (e: any) {
                console.error('Failed to fetch auth login audit:', e);
                this.error = e.message;
                this.authLoginAudit = [];
                this.authLoginAuditTotal = 0;
            } finally {
                this.loading = false;
            }
        },

        // ============================================
        // Admin Requests (권한 신청/승인)
        // ============================================
        async createAdminRequest(reason: string, requestedRole?: string) {
            this.loading = true;
            try {
                const backend = BackendFactory.createBackend() as any;
                const result = await backend.createAdminRequest(reason, requestedRole);
                await this.fetchMyAdminRequests();
                return result;
            } catch (e: any) {
                console.error('Failed to create admin request:', e);
                this.error = e.detail || e.message || String(e);
                throw e;
            } finally {
                this.loading = false;
            }
        },

        async fetchMyAdminRequests() {
            this.loading = true;
            try {
                const backend = BackendFactory.createBackend() as any;
                this.myAdminRequests = (await backend.getMyAdminRequests()) || [];
            } catch (e: any) {
                console.error('Failed to fetch my admin requests:', e);
                this.error = e.message;
            } finally {
                this.loading = false;
            }
        },

        async fetchAdminRequests(status: 'all' | 'pending' | 'approved' | 'rejected' = 'all') {
            this.loading = true;
            try {
                const backend = BackendFactory.createBackend() as any;
                this.adminRequests = (await backend.getAdminRequests(status)) || [];
            } catch (e: any) {
                console.error('Failed to fetch admin requests:', e);
                this.error = e.message;
            } finally {
                this.loading = false;
            }
        },

        async approveAdminRequest(requestId: string) {
            this.loading = true;
            try {
                const backend = BackendFactory.createBackend() as any;
                await backend.approveAdminRequest(requestId);
                this.adminRequests = this.adminRequests.map((item) =>
                    item.id === requestId ? { ...item, status: 'approved' as const } : item
                );
            } catch (e: any) {
                console.error('Failed to approve admin request:', e);
                this.error = e.message;
                throw e;
            } finally {
                this.loading = false;
            }
        },

        async rejectAdminRequest(requestId: string, rejectReason = '') {
            this.loading = true;
            try {
                const backend = BackendFactory.createBackend() as any;
                await backend.rejectAdminRequest(requestId, rejectReason);
                this.adminRequests = this.adminRequests.map((item) =>
                    item.id === requestId
                        ? { ...item, status: 'rejected' as const, reject_reason: rejectReason }
                        : item
                );
            } catch (e: any) {
                console.error('Failed to reject admin request:', e);
                this.error = e.message;
                throw e;
            } finally {
                this.loading = false;
            }
        },

        // ============================================
        // Signup Requests
        // ============================================
        async fetchSignupRequests(status: 'all' | 'pending' | 'approved' | 'rejected' = 'all') {
            this.loading = true;
            try {
                const backend = BackendFactory.createBackend() as any;
                this.signupRequests = (await backend.getSignupRequests(status)) || [];
            } catch (e: any) {
                console.error('Failed to fetch signup requests:', e);
                this.error = e.message;
            } finally {
                this.loading = false;
            }
        },

        async approveSignupRequest(requestId: string) {
            this.loading = true;
            try {
                const backend = BackendFactory.createBackend() as any;
                await backend.approveSignupRequest(requestId);
                this.signupRequests = this.signupRequests.map((item) =>
                    item.id === requestId
                        ? {
                              ...item,
                              status: 'approved'
                          }
                        : item
                );
            } catch (e: any) {
                console.error('Failed to approve signup request:', e);
                this.error = e.message;
                throw e;
            } finally {
                this.loading = false;
            }
        },

        async rejectSignupRequest(requestId: string, rejectReason = '') {
            this.loading = true;
            try {
                const backend = BackendFactory.createBackend() as any;
                await backend.rejectSignupRequest(requestId, rejectReason);
                this.signupRequests = this.signupRequests.map((item) =>
                    item.id === requestId
                        ? {
                              ...item,
                              status: 'rejected',
                              reject_reason: rejectReason
                          }
                        : item
                );
            } catch (e: any) {
                console.error('Failed to reject signup request:', e);
                this.error = e.message;
                throw e;
            } finally {
                this.loading = false;
            }
        }
    }
});
