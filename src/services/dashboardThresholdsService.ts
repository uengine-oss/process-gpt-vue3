/**
 * 분석 대시보드 차트 기준값 서비스 (specs/012-dashboard-thresholds)
 *
 * configuration(key='dashboard_thresholds') 한 행에 평탄 JSON 으로 저장한다.
 * 키·기본값·검증 규칙은 process-gpt-completion/dashboard_thresholds.py 와 같게 유지할 것
 * (기본값은 감사 로그 트리거의 dashboard_threshold_defaults() 에도 있다)
 * — 백엔드는 같은 값으로 SQL 필터(좀비·검토 지연·FTE·RAG·주간 목표)를 계산한다.
 * 변경 이력은 DB 트리거(log_dashboard_threshold_change)가 admin_audit_log 에 남기므로
 * 여기서 따로 감사 로그를 쓰지 않는다.
 */
import { reactive } from 'vue';
import { dashboardHttp as http } from './dashboardHttp';

const CONFIG_KEY = 'dashboard_thresholds';

export interface DashboardThresholds {
    kpi_rag_green_pct: number;
    kpi_rag_amber_pct: number;
    velocity_weekly_target: number;
    churn_high: number;
    churn_medium: number;
    fte_working_days: number;
    fte_critical: number;
    fte_high: number;
    fte_medium: number;
    zombie_warning_days: number;
    zombie_danger_days: number;
    review_delay_days: number;
    dq_good_pct: number;
    dq_warning_pct: number;
}

export type ThresholdKey = keyof DashboardThresholds;

export const DEFAULT_THRESHOLDS: Readonly<DashboardThresholds> = Object.freeze({
    kpi_rag_green_pct: 100,
    kpi_rag_amber_pct: 50,
    velocity_weekly_target: 0,
    churn_high: 3,
    churn_medium: 2,
    fte_working_days: 22,
    fte_critical: 5,
    fte_high: 3,
    fte_medium: 1,
    zombie_warning_days: 90,
    zombie_danger_days: 180,
    review_delay_days: 7,
    dq_good_pct: 80,
    dq_warning_pct: 60
});

const INTEGER_KEYS = new Set<ThresholdKey>([
    'velocity_weekly_target',
    'churn_high',
    'churn_medium',
    'fte_working_days',
    'zombie_warning_days',
    'zombie_danger_days',
    'review_delay_days'
]);

export interface ThresholdField {
    key: ThresholdKey;
    label: string;
    unit: string;
    hint?: string;
}

export interface ThresholdGroup {
    id: string;
    view: string;
    chart: string;
    description: string;
    fields: ThresholdField[];
    /** 위반 시 오류 메시지, 통과면 '' */
    validate: (v: DashboardThresholds) => string;
}

/** 설정 화면 구성 + 그룹 단위 검증. 백엔드 _GROUP_RULES 와 같은 규칙. */
export const THRESHOLD_GROUPS: ThresholdGroup[] = [
    {
        id: 'kpi_rag',
        view: '진행현황',
        chart: '조직별 KPI 달성 현황',
        description: '게시 완료 수 ÷ KPI 목표 수 비율로 조직 카드 색(초록·주황·빨강)을 정합니다.',
        fields: [
            { key: 'kpi_rag_green_pct', label: '달성(초록) 기준', unit: '% 이상' },
            { key: 'kpi_rag_amber_pct', label: '주의(주황) 기준', unit: '% 이상', hint: '이 값 미만은 빨강' }
        ],
        validate: (v) =>
            v.kpi_rag_amber_pct > 0 && v.kpi_rag_amber_pct < v.kpi_rag_green_pct
                ? ''
                : '주의 기준은 0보다 크고 달성 기준보다 작아야 합니다.'
    },
    {
        id: 'velocity',
        view: '진행현황',
        chart: '주간 완료 추이',
        description: '주마다 게시 완료되어야 할 목표 건수입니다. 차트에 점선 목표선으로 표시됩니다.',
        fields: [{ key: 'velocity_weekly_target', label: '주간 완료 목표', unit: '건', hint: '0이면 목표선을 표시하지 않음' }],
        validate: (v) => (v.velocity_weekly_target >= 0 ? '' : '0 이상이어야 합니다.')
    },
    {
        id: 'churn',
        view: '진행현황',
        chart: '단계 역행(Churn) 현황',
        description: '이전 단계로 되돌아간 횟수로 위험도를 정합니다.',
        fields: [
            { key: 'churn_high', label: '높음 기준', unit: '회 이상' },
            { key: 'churn_medium', label: '중간 기준', unit: '회 이상', hint: '이 값 미만은 낮음' }
        ],
        validate: (v) => (v.churn_medium > 0 && v.churn_medium < v.churn_high ? '' : '중간 기준은 0보다 크고 높음 기준보다 작아야 합니다.')
    },
    {
        id: 'fte_days',
        view: '운영현황',
        chart: '병목 FTE 산정',
        description: 'FTE = 태스크 소요일 합계 ÷ 월 근무일. 병목 맵·히트맵·등급 분포 전체에 적용됩니다.',
        fields: [{ key: 'fte_working_days', label: '월 근무일', unit: '일' }],
        validate: (v) => (v.fte_working_days >= 1 && v.fte_working_days <= 31 ? '' : '1~31 사이여야 합니다.')
    },
    {
        id: 'fte_grade',
        view: '운영현황',
        chart: 'FTE 등급 분포',
        description: '프로세스별 FTE 값으로 등급을 나눕니다.',
        fields: [
            { key: 'fte_critical', label: 'Critical 기준', unit: 'FTE 이상' },
            { key: 'fte_high', label: 'High 기준', unit: 'FTE 이상' },
            { key: 'fte_medium', label: 'Medium 기준', unit: 'FTE 이상', hint: '이 값 미만은 Low' }
        ],
        validate: (v) =>
            v.fte_medium > 0 && v.fte_medium < v.fte_high && v.fte_high < v.fte_critical
                ? ''
                : 'Critical > High > Medium > 0 순서여야 합니다.'
    },
    {
        id: 'zombie',
        view: '운영현황',
        chart: '장기 미갱신 프로세스',
        description: '마지막 저장 후 경과일로 장기 미갱신 대상과 주의·위험 등급을 정합니다.',
        fields: [
            { key: 'zombie_warning_days', label: '주의 기준', unit: '일 경과', hint: '이 값 이상부터 목록에 포함' },
            { key: 'zombie_danger_days', label: '위험 기준', unit: '일 경과' }
        ],
        validate: (v) =>
            v.zombie_warning_days > 0 && v.zombie_warning_days < v.zombie_danger_days
                ? ''
                : '주의 기준은 0보다 크고 위험 기준보다 작아야 합니다.'
    },
    {
        id: 'review_delay',
        view: '운영현황',
        chart: '검토 지연',
        description: '검토 요청 후 이 일수가 지나도 처리되지 않으면 지연으로 분류합니다.',
        fields: [{ key: 'review_delay_days', label: '검토 지연 기준', unit: '일 경과' }],
        validate: (v) => (v.review_delay_days >= 1 ? '' : '1 이상이어야 합니다.')
    },
    {
        id: 'dq',
        view: '입력정확도',
        chart: '속성별 입력 충실도',
        description: '입력 충실도 점수의 색(양호·주의·미흡)을 정합니다.',
        fields: [
            { key: 'dq_good_pct', label: '양호 기준', unit: '% 이상' },
            { key: 'dq_warning_pct', label: '주의 기준', unit: '% 이상', hint: '이 값 미만은 미흡' }
        ],
        validate: (v) =>
            v.dq_warning_pct > 0 && v.dq_warning_pct < v.dq_good_pct && v.dq_good_pct <= 100 ? '' : '0 < 주의 < 양호 ≤ 100 이어야 합니다.'
    }
];

/** 감사 로그 화면에서 쓰는 키 라벨 ("좀비 위험 기준(일)" 형태) */
export const THRESHOLD_KEY_LABELS: Record<ThresholdKey, string> = THRESHOLD_GROUPS.reduce((acc, group) => {
    for (const f of group.fields) acc[f.key] = `${group.chart} · ${f.label}`;
    return acc;
}, {} as Record<ThresholdKey, string>);

function toNumber(value: unknown): number | null {
    if (typeof value === 'boolean' || value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

/** 저장값을 기본값과 병합하고, 규칙을 어긴 그룹은 기본값으로 대체한다 (백엔드 normalize_thresholds 와 동일). */
export function normalizeThresholds(raw: unknown): DashboardThresholds {
    let source: any = raw;
    if (typeof source === 'string') {
        try {
            source = JSON.parse(source);
        } catch {
            source = null;
        }
    }
    if (!source || typeof source !== 'object' || Array.isArray(source)) source = {};

    const values = { ...DEFAULT_THRESHOLDS } as DashboardThresholds;
    for (const key of Object.keys(DEFAULT_THRESHOLDS) as ThresholdKey[]) {
        const n = toNumber(source[key]);
        if (n !== null) values[key] = INTEGER_KEYS.has(key) ? Math.round(n) : n;
    }
    for (const group of THRESHOLD_GROUPS) {
        if (group.validate(values)) {
            for (const f of group.fields) values[f.key] = DEFAULT_THRESHOLDS[f.key];
        }
    }
    return values;
}

/** 편집 중 값 검증: 그룹 id → 오류 메시지 (숫자 아님 포함) */
export function validateThresholds(values: Record<ThresholdKey, unknown>): Record<string, string> {
    const errors: Record<string, string> = {};
    const numeric = {} as DashboardThresholds;
    for (const group of THRESHOLD_GROUPS) {
        let bad = '';
        for (const f of group.fields) {
            const n = toNumber(values[f.key]);
            if (n === null) bad = `${f.label}에 숫자를 입력하세요.`;
            else if (INTEGER_KEYS.has(f.key) && !Number.isInteger(n)) bad = `${f.label}은 정수여야 합니다.`;
            else numeric[f.key] = n;
        }
        const msg = bad || group.validate({ ...DEFAULT_THRESHOLDS, ...numeric });
        if (msg) errors[group.id] = msg;
    }
    return errors;
}

function getTenantId(): string {
    return (window as any).$tenantName || 'default';
}

function getSupabase() {
    const supabase = (window as any).$supabase;
    if (!supabase) throw new Error('Supabase not initialized');
    return supabase;
}

// ── 화면 공유 상태: 탭 컴포넌트들이 같은 값을 반응형으로 본다 ──
const state = reactive<{ values: DashboardThresholds; loaded: boolean }>({
    values: { ...DEFAULT_THRESHOLDS },
    loaded: false
});
let inflight: Promise<DashboardThresholds> | null = null;

/** 현재 테넌트 기준값 조회. 백엔드가 정규화한 값을 우선, 실패 시 configuration 직접 조회, 그것도 실패하면 기본값. */
export async function loadThresholds(force = false): Promise<DashboardThresholds> {
    if (state.loaded && !force) return state.values;
    if (inflight && !force) return inflight;
    inflight = (async () => {
        let values: DashboardThresholds;
        try {
            const { data } = await http.get('/completion/dashboard/thresholds');
            values = normalizeThresholds(data?.values);
        } catch (e) {
            console.warn('[dashboardThresholds] 백엔드 조회 실패, configuration 직접 조회:', e);
            try {
                const { data, error } = await getSupabase()
                    .from('configuration')
                    .select('value')
                    .eq('key', CONFIG_KEY)
                    .eq('tenant_id', getTenantId())
                    .maybeSingle();
                if (error) throw error;
                values = normalizeThresholds(data?.value);
            } catch (err) {
                console.error('[dashboardThresholds] 기준값 로드 실패, 기본값 사용:', err);
                values = { ...DEFAULT_THRESHOLDS };
            }
        }
        state.values = values;
        state.loaded = true;
        return values;
    })();
    try {
        return await inflight;
    } finally {
        inflight = null;
    }
}

/** 기준값 저장 (관리자만 — RLS). 감사 로그는 DB 트리거가 남긴다. */
export async function saveThresholds(values: DashboardThresholds): Promise<DashboardThresholds> {
    const errors = validateThresholds(values);
    const first = Object.values(errors)[0];
    if (first) throw new Error(first);

    const normalized = normalizeThresholds(values);
    const { error } = await getSupabase()
        .from('configuration')
        .upsert({ tenant_id: getTenantId(), key: CONFIG_KEY, value: normalized }, { onConflict: 'tenant_id,key' });
    if (error) throw error;

    state.values = normalized;
    state.loaded = true;
    return normalized;
}

/** 탭 컴포넌트용: 반응형 기준값 (최초 호출 시 로드 시작) */
export function useDashboardThresholds() {
    if (!state.loaded) loadThresholds().catch(() => undefined);
    return state;
}
