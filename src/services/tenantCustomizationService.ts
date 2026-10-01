/**
 * 테넌트 사용자화 서비스 (PAL 전용)
 *
 * 용어(계층 레벨명·진행 단계), 프로세스 분류축(카드 보기 열), 운영 정책값, 역할 표시 라벨을
 * configuration 테이블(tenant_id + key)에 한 행씩 저장하고, 부트스트랩 때 한 번 읽어
 * 런타임(i18n 메시지, STAGE_DEFS, 분류 설정, ROLE_META, CSS 변수)에 반영한다.
 *
 *   key                     value
 *   terminology             { hierarchy:{domain,mega,major,sub}, stages:{<stage>:{label,shortLabel,color}} }
 *   process_classification  { columns:[{key,label,color,icon,keywords[]}], fallback_key, infer_stage_from_code, infer_domain }
 *   operation_policy        { public_feedback_days, feedback_alert_days, stalled_days, recycle_bin_retention_days,
 *                             annual_working_hours, cycle_factors:{Monthly,Weekly,Daily}, annual_cost_per_fte, currency }
 *   role_labels             { <role>:{label,description} }
 *
 * 저장 포맷 정규화·판정 규칙은 src/utils/tenantCustomizationCore.js (node 테스트 대상).
 * 기본값이 곧 설정 이전의 동작이라, 행이 없는 테넌트와 비 PAL 모드는 예전과 똑같이 움직인다.
 */
import { reactive, readonly } from 'vue';
import {
    DEFAULT_HIERARCHY_TERMS,
    DEFAULT_OPERATION_POLICY,
    DEFAULT_STAGE_TERMS,
    HIERARCHY_LEVELS,
    STAGE_KEYS,
    annualFrequencyFactor,
    diffTerminologyFromDefault,
    isDefaultClassification,
    normalizeClassification,
    normalizeOperationPolicy,
    normalizeRoleLabels,
    normalizeTerminology,
    recycleBinRemainingDays as coreRecycleBinRemainingDays
} from '@/utils/tenantCustomizationCore';
import { applyStageTermOverrides } from '@/utils/processStages';
import { setProcessClassificationConfig, type ProcessClassificationConfig } from '@/views/process-architecture/processClassification';
import { applyRoleLabelOverrides, type RoleType } from '@/utils/roles';

export const TERMINOLOGY_CONFIG_KEY = 'terminology';
export const CLASSIFICATION_CONFIG_KEY = 'process_classification';
export const OPERATION_POLICY_CONFIG_KEY = 'operation_policy';
export const ROLE_LABELS_CONFIG_KEY = 'role_labels';

const ALL_KEYS = [TERMINOLOGY_CONFIG_KEY, CLASSIFICATION_CONFIG_KEY, OPERATION_POLICY_CONFIG_KEY, ROLE_LABELS_CONFIG_KEY] as const;
export type TenantCustomizationKey = (typeof ALL_KEYS)[number];

export type HierarchyLevel = 'domain' | 'mega' | 'major' | 'sub';
export type StageTermKey = 'draft' | 'in_review' | 'public_feedback' | 'final_edit' | 'published' | 'wip' | 'sunset';

export interface StageTerm {
    label: string;
    shortLabel: string;
    color: string;
}

export interface Terminology {
    hierarchy: Record<HierarchyLevel, string>;
    stages: Record<StageTermKey, StageTerm>;
}

export interface OperationPolicy {
    public_feedback_days: number;
    feedback_alert_days: number;
    stalled_days: number;
    recycle_bin_retention_days: number;
    annual_working_hours: number;
    cycle_factors: { Monthly: number; Weekly: number; Daily: number };
    annual_cost_per_fte: number;
    currency: string;
}

export type RoleLabelOverrides = Partial<Record<RoleType, { label?: string; description?: string }>>;

interface State {
    loaded: boolean;
    tenantId: string | null;
    terminology: Terminology;
    classification: ProcessClassificationConfig;
    policy: OperationPolicy;
    roleLabels: RoleLabelOverrides;
    /** 설정 행이 아직 없는 키 — 화면의 "기본값 사용 중" 배지용 */
    usingDefault: Record<TenantCustomizationKey, boolean>;
}

const state = reactive<State>({
    loaded: false,
    tenantId: null,
    terminology: normalizeTerminology(null) as Terminology,
    classification: normalizeClassification(null) as ProcessClassificationConfig,
    policy: normalizeOperationPolicy(null) as OperationPolicy,
    roleLabels: {},
    usingDefault: {
        terminology: true,
        process_classification: true,
        operation_policy: true,
        role_labels: true
    }
});

/** 읽기 전용 reactive 스냅샷 — 화면 computed 에서 참조 */
export const tenantCustomization = readonly(state);

function getTenantId(): string {
    return (window as any).$tenantName || 'default';
}

function getSupabase() {
    const supabase = (window as any).$supabase;
    if (!supabase) throw new Error('Supabase not initialized');
    return supabase;
}

function isPal(): boolean {
    return !!(window as any).$pal;
}

function parseValue(raw: unknown): unknown {
    if (typeof raw !== 'string') return raw;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

// ---------------------------------------------------------------------------
// 런타임 반영
// ---------------------------------------------------------------------------

/**
 * 용어 오버라이드를 i18n 에 합친다.
 * 정본 키 `terminology.*` 는 항상 현재 값으로 덮고, 흩어져 있던 레거시 중복 키는
 * 첫 적용 때 원문을 보관해 두었다가 "기본값" 이면 원문으로, 바뀌었으면 새 값으로 되돌린다.
 * (레거시 키의 기본 문구는 정본과 조금씩 달라 — 예: progressBadge.draft='작성중' —
 *  기본값일 때 정본 값으로 덮어쓰면 비 오버라이드 테넌트 화면이 바뀐다.)
 */
const LEGACY_HIERARCHY_KEYS: Record<HierarchyLevel, string[]> = {
    domain: [
        'processArchitecture.hierarchy.legendItems.domain',
        'processArchitecture.matrix.domain',
        'processArchitecture.newProcessDialog.domain',
        'processArchitecture.dataFreeze.scopeDomain'
    ],
    mega: ['processArchitecture.hierarchy.legendItems.mega', 'processArchitecture.newProcessDialog.megaProcess', 'processArchitecture.dataFreeze.scopeMega'],
    major: ['processArchitecture.hierarchy.legendItems.major', 'processArchitecture.newProcessDialog.majorProcess', 'processArchitecture.dataFreeze.scopeMajor'],
    sub: ['processArchitecture.hierarchy.legendItems.sub']
};

const LEGACY_STAGE_KEYS: Record<StageTermKey, string[]> = {
    draft: ['progressBadge.draft'],
    in_review: ['progressBadge.in_review', 'progressBadge.review'],
    public_feedback: ['progressBadge.public_feedback', 'progressBadge.public_review'],
    final_edit: ['progressBadge.final_edit'],
    published: ['progressBadge.published', 'processArchitecture.hierarchy.legendItems.published'],
    wip: ['progressBadge.wip'],
    sunset: ['progressBadge.sunset']
};

const legacyOriginals = new Map<string, unknown>(); // `${locale}::${path}` → 원문

function getI18n(): any {
    return (window as any).$i18n?.global || null;
}

function readMessage(i18n: any, locale: string, path: string): unknown {
    const msgs = i18n.getLocaleMessage(locale) || {};
    return path.split('.').reduce((acc: any, key) => (acc && typeof acc === 'object' ? acc[key] : undefined), msgs);
}

function pathToObject(path: string, value: unknown): Record<string, unknown> {
    return path
        .split('.')
        .reverse()
        .reduce((acc: unknown, key) => ({ [key]: acc }), value) as Record<string, unknown>;
}

function applyTerminologyToI18n(term: Terminology) {
    const i18n = getI18n();
    if (!i18n?.mergeLocaleMessage) return;
    const locales: string[] = i18n.availableLocales || [];

    for (const locale of locales) {
        const merged: Record<string, unknown> = {
            terminology: {
                hierarchy: { ...term.hierarchy },
                stages: Object.fromEntries(STAGE_KEYS.map((k) => [k, { label: term.stages[k as StageTermKey].label, shortLabel: term.stages[k as StageTermKey].shortLabel }]))
            }
        };

        const overrideLegacy = (paths: string[], custom: string | null) => {
            for (const path of paths) {
                const cacheKey = `${locale}::${path}`;
                if (!legacyOriginals.has(cacheKey)) legacyOriginals.set(cacheKey, readMessage(i18n, locale, path));
                const original = legacyOriginals.get(cacheKey);
                const value = custom ?? original;
                if (value === undefined) continue;
                Object.assign(merged, deepMerge(merged, pathToObject(path, value)));
            }
        };

        for (const level of HIERARCHY_LEVELS as HierarchyLevel[]) {
            const custom = term.hierarchy[level] !== DEFAULT_HIERARCHY_TERMS[level] ? term.hierarchy[level] : null;
            overrideLegacy(LEGACY_HIERARCHY_KEYS[level], custom);
        }
        for (const key of STAGE_KEYS as StageTermKey[]) {
            const custom = term.stages[key].shortLabel !== DEFAULT_STAGE_TERMS[key].shortLabel ? term.stages[key].shortLabel : null;
            overrideLegacy(LEGACY_STAGE_KEYS[key], custom);
        }

        i18n.mergeLocaleMessage(locale, merged);
    }
}

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
    for (const [key, value] of Object.entries(source)) {
        const current = target[key];
        if (value && typeof value === 'object' && !Array.isArray(value) && current && typeof current === 'object' && !Array.isArray(current)) {
            deepMerge(current as Record<string, unknown>, value as Record<string, unknown>);
        } else {
            target[key] = value;
        }
    }
    return target;
}

function applyTerminology(term: Terminology) {
    state.terminology = term;
    applyTerminologyToI18n(term);
    applyStageTermOverrides(term.stages);
}

function applyClassification(config: ProcessClassificationConfig) {
    state.classification = config;
    setProcessClassificationConfig(config);
}

function applyPolicy(policy: OperationPolicy) {
    state.policy = policy;
}

function applyRoleLabels(labels: RoleLabelOverrides) {
    state.roleLabels = labels;
    applyRoleLabelOverrides(labels);
}

function applyRow(key: string, value: unknown) {
    switch (key) {
        case TERMINOLOGY_CONFIG_KEY:
            applyTerminology(normalizeTerminology(value) as Terminology);
            break;
        case CLASSIFICATION_CONFIG_KEY:
            applyClassification(normalizeClassification(value) as ProcessClassificationConfig);
            break;
        case OPERATION_POLICY_CONFIG_KEY:
            applyPolicy(normalizeOperationPolicy(value) as OperationPolicy);
            break;
        case ROLE_LABELS_CONFIG_KEY:
            applyRoleLabels(normalizeRoleLabels(value) as RoleLabelOverrides);
            break;
    }
}

/** 모든 설정을 기본값으로 되돌린다(테넌트 전환·로드 실패 대비) */
function resetToDefaults() {
    for (const key of ALL_KEYS) {
        applyRow(key, null);
        state.usingDefault[key] = true;
    }
}

// ---------------------------------------------------------------------------
// 로드 / 저장
// ---------------------------------------------------------------------------

let loadPromise: Promise<void> | null = null;

/**
 * 4개 설정을 한 번의 조회로 읽어 런타임에 반영한다. PAL 모드가 아니면 아무것도 하지 않는다.
 * 실패해도 예외를 던지지 않는다(기본값으로 동작).
 */
export async function loadTenantCustomization(force = false): Promise<void> {
    if (!isPal()) return;
    const tenantId = getTenantId();
    if (!force && loadPromise && state.tenantId === tenantId) return loadPromise;

    loadPromise = (async () => {
        try {
            const supabase = getSupabase();
            const { data, error } = await supabase
                .from('configuration')
                .select('key, value')
                .eq('tenant_id', tenantId)
                .in('key', [...ALL_KEYS]);
            if (error) throw error;

            resetToDefaults();
            for (const row of data || []) {
                if (!ALL_KEYS.includes(row.key)) continue;
                applyRow(row.key, parseValue(row.value));
                state.usingDefault[row.key as TenantCustomizationKey] = false;
            }
        } catch (e) {
            console.error('[tenantCustomization] 로드 실패 — 기본값으로 동작합니다:', e);
            resetToDefaults();
        } finally {
            state.tenantId = tenantId;
            state.loaded = true;
        }
    })();
    return loadPromise;
}

async function upsertConfig(key: TenantCustomizationKey, value: unknown) {
    const supabase = getSupabase();
    const { error } = await supabase.from('configuration').upsert({ tenant_id: getTenantId(), key, value }, { onConflict: 'tenant_id,key' });
    if (error) throw error;
}

async function deleteConfig(key: TenantCustomizationKey) {
    const supabase = getSupabase();
    const { error } = await supabase.from('configuration').delete().eq('tenant_id', getTenantId()).eq('key', key);
    if (error) throw error;
}

/** 용어 저장 — 기본값과 다른 항목만 기록. 전부 기본값이면 행을 지운다. */
export async function saveTerminology(value: unknown): Promise<Terminology> {
    const diff = diffTerminologyFromDefault(value);
    const isEmpty = Object.keys(diff.hierarchy).length === 0 && Object.keys(diff.stages).length === 0;
    if (isEmpty) await deleteConfig(TERMINOLOGY_CONFIG_KEY);
    else await upsertConfig(TERMINOLOGY_CONFIG_KEY, diff);
    const full = normalizeTerminology(value) as Terminology;
    applyTerminology(full);
    state.usingDefault.terminology = isEmpty;
    return full;
}

export async function saveClassification(value: unknown): Promise<ProcessClassificationConfig> {
    const normalized = normalizeClassification(value) as ProcessClassificationConfig;
    const isDefault = isDefaultClassification(normalized);
    if (isDefault) await deleteConfig(CLASSIFICATION_CONFIG_KEY);
    else await upsertConfig(CLASSIFICATION_CONFIG_KEY, normalized);
    applyClassification(normalized);
    state.usingDefault.process_classification = isDefault;
    return normalized;
}

export async function saveOperationPolicy(value: unknown): Promise<OperationPolicy> {
    const normalized = normalizeOperationPolicy(value) as OperationPolicy;
    await upsertConfig(OPERATION_POLICY_CONFIG_KEY, normalized);
    applyPolicy(normalized);
    state.usingDefault.operation_policy = false;
    return normalized;
}

export async function saveRoleLabels(value: unknown): Promise<RoleLabelOverrides> {
    const normalized = normalizeRoleLabels(value) as RoleLabelOverrides;
    const isEmpty = Object.keys(normalized).length === 0;
    if (isEmpty) await deleteConfig(ROLE_LABELS_CONFIG_KEY);
    else await upsertConfig(ROLE_LABELS_CONFIG_KEY, normalized);
    applyRoleLabels(normalized);
    state.usingDefault.role_labels = isEmpty;
    return normalized;
}

// ---------------------------------------------------------------------------
// 동기 조회 헬퍼 — 코드 곳곳에 박혀 있던 상수 자리에 들어간다
// ---------------------------------------------------------------------------

export function getTerminology(): Terminology {
    return state.terminology;
}

/** 계층 레벨 표시명 (도메인/메가/메이저/서브) */
export function getHierarchyLabel(level: HierarchyLevel): string {
    return state.terminology.hierarchy[level] || DEFAULT_HIERARCHY_TERMS[level];
}

export function getOperationPolicy(): OperationPolicy {
    return state.policy;
}

/** 공람 기간(일). 비 PAL·미설정 = 30 */
export function getPublicFeedbackDays(): number {
    return state.policy.public_feedback_days || DEFAULT_OPERATION_POLICY.public_feedback_days;
}

/** 공람 마감 D-경보 기준(일). 미설정 = 7 */
export function getFeedbackAlertDays(): number {
    return state.policy.feedback_alert_days ?? DEFAULT_OPERATION_POLICY.feedback_alert_days;
}

/** 정체 판정 기준(일). 미설정 = 7 */
export function getStalledDays(): number {
    return state.policy.stalled_days || DEFAULT_OPERATION_POLICY.stalled_days;
}

export function getRecycleBinRetentionDays(): number {
    return state.policy.recycle_bin_retention_days || DEFAULT_OPERATION_POLICY.recycle_bin_retention_days;
}

/** 휴지통 남은 일수 — 스토어/백엔드/화면이 모두 이 함수를 쓴다 */
export function recycleBinRemainingDays(deletedAt: string | null | undefined): number {
    return coreRecycleBinRemainingDays(deletedAt, getRecycleBinRetentionDays());
}

export function getAnnualWorkingHours(): number {
    return state.policy.annual_working_hours || DEFAULT_OPERATION_POLICY.annual_working_hours;
}

/** 주기(Yearly/Monthly/Weekly/Daily) → 연간 횟수 환산 계수 */
export function getCycleFactor(cycle: string | null | undefined): number {
    return annualFrequencyFactor(cycle, state.policy);
}

export function getAnnualCostPerFte(): number {
    return state.policy.annual_cost_per_fte ?? DEFAULT_OPERATION_POLICY.annual_cost_per_fte;
}

export function getCurrency(): string {
    return state.policy.currency || DEFAULT_OPERATION_POLICY.currency;
}
