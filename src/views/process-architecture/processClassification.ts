/**
 * 프로세스 분류축(카드 보기 열) + 도메인 판정.
 *
 * 열 정의(key/라벨/색/아이콘/키워드/폴백)는 테넌트 설정 `process_classification` 으로 바뀔 수 있다.
 * tenantCustomizationService 가 부트스트랩 시 `setProcessClassificationConfig` 로 주입하며,
 * 설정이 없는 테넌트는 기본 5열(설계·구축·감시·제어·공통)로 이전과 똑같이 동작한다.
 *
 * 저장 규약: proc_map 의 major.category 등 분류 필드에는 열 **key** 를 기록한다.
 * 읽을 때는 key/라벨/키워드 모두 허용하므로 라벨('설계')로 저장된 옛 데이터도 같은 열로 읽힌다.
 */
import { reactive } from 'vue';
import {
    DEFAULT_CLASSIFICATION,
    inferStageColumnFromCode as inferColumnFromCode,
    matchStageColumn,
    normalizeClassification
} from '@/utils/tenantCustomizationCore';

/** 열 key. 기본 5열은 'design' | 'build' | 'monitor' | 'control' | 'shared' 이지만 테넌트가 확장할 수 있다. */
export type ProcessStageColumn = string;

export interface ProcessStageColumnDef {
    key: string;
    label: string;
    color: string;
    icon: string;
    keywords: string[];
}

export interface ProcessClassificationConfig {
    columns: ProcessStageColumnDef[];
    fallback_key: string;
    infer_stage_from_code: boolean;
    infer_domain: boolean;
}

/** 현재 적용 중인 분류 설정 (reactive — 화면 computed 가 열 목록 변경을 따라간다) */
const activeConfig = reactive<ProcessClassificationConfig>(normalizeClassification(DEFAULT_CLASSIFICATION));

export function setProcessClassificationConfig(config: unknown) {
    const next = normalizeClassification(config);
    activeConfig.columns = next.columns;
    activeConfig.fallback_key = next.fallback_key;
    activeConfig.infer_stage_from_code = next.infer_stage_from_code;
    activeConfig.infer_domain = next.infer_domain;
}

export function getProcessClassificationConfig(): ProcessClassificationConfig {
    return activeConfig;
}

export function getProcessStageColumns(): ProcessStageColumnDef[] {
    return activeConfig.columns;
}

export function getProcessStageOrder(): ProcessStageColumn[] {
    return activeConfig.columns.map((c) => c.key);
}

export function getProcessStageLabel(column: ProcessStageColumn): string {
    return activeConfig.columns.find((c) => c.key === column)?.label || column;
}

export function getFallbackStageColumn(): ProcessStageColumn {
    return activeConfig.fallback_key;
}

/** 도메인 텍스트 추론(이름/ID 부분 문자열 매칭) 사용 여부 — 테넌트 설정 infer_domain */
export function isDomainInferenceEnabled(): boolean {
    return activeConfig.infer_domain;
}

function normalize(value: unknown): string {
    return String(value ?? '').trim();
}

function normalizeLower(value: unknown): string {
    return normalize(value).toLowerCase();
}

export function isProcessStageValue(value: unknown): boolean {
    return matchStageColumn(value, activeConfig.columns, true) !== null;
}

function getStageColumnFromText(value: unknown, exactOnly = false): ProcessStageColumn | null {
    return matchStageColumn(value, activeConfig.columns, exactOnly);
}

export function getProcessStageColumnFromValue(value: unknown, exactOnly = false): ProcessStageColumn | null {
    return getStageColumnFromText(value, exactOnly);
}

export function getExplicitMajorStageColumn(major: any): ProcessStageColumn | null {
    const explicitCandidates = [
        major?.category,
        major?.process_category,
        major?.processCategory,
        major?.stage,
        major?.process_stage,
        major?.processStage,
        major?.lifecycle_stage,
        major?.lifecycleStage,
        major?.phase
    ];

    for (const candidate of explicitCandidates) {
        const column = getStageColumnFromText(candidate, true);
        if (column) return column;
    }

    return null;
}

function inferStageColumnFromCode(value: unknown): ProcessStageColumn | null {
    if (!activeConfig.infer_stage_from_code) return null;
    return inferColumnFromCode(value, activeConfig.columns);
}

function inferStageColumnFromSubProcesses(major: any): ProcessStageColumn | null {
    if (!activeConfig.infer_stage_from_code) return null;
    const counts: Record<string, number> = {};
    for (const sub of major?.sub_proc_list || []) {
        const column = inferStageColumnFromCode(sub?.id) || inferStageColumnFromCode(sub?.name);
        if (!column) continue;
        counts[column] = (counts[column] || 0) + 1;
    }

    let bestColumn: ProcessStageColumn | null = null;
    let bestCount = 0;
    for (const [column, count] of Object.entries(counts)) {
        if ((count || 0) > bestCount) {
            bestColumn = column;
            bestCount = count || 0;
        }
    }

    return bestColumn;
}

export function getMajorStageColumn(major: any): ProcessStageColumn {
    const explicitColumn = getExplicitMajorStageColumn(major);
    if (explicitColumn) return explicitColumn;

    const codeColumn = inferStageColumnFromCode(major?.id) || inferStageColumnFromCode(major?.name) || inferStageColumnFromSubProcesses(major);
    if (codeColumn) return codeColumn;

    const legacyDomainColumn = getStageColumnFromText(major?.domain, true) || getStageColumnFromText(major?.domain_id, true);
    if (legacyDomainColumn) return legacyDomainColumn;

    return getStageColumnFromText(major?.name) || activeConfig.fallback_key;
}

export function getMajorStageLabel(major: any): string {
    return getProcessStageLabel(getMajorStageColumn(major));
}

export function getMajorStageSortIndex(major: any): number {
    const order = getProcessStageOrder();
    const index = order.indexOf(getMajorStageColumn(major));
    return index >= 0 ? index : order.length;
}

export function compareMajorsByStage(a: any, b: any): number {
    const stageDelta = getMajorStageSortIndex(a) - getMajorStageSortIndex(b);
    if (stageDelta !== 0) return stageDelta;

    const aName = normalize(a?.name || a?.id);
    const bName = normalize(b?.name || b?.id);
    return aName.localeCompare(bName, 'ko');
}

function findKnownDomainInText(text: string, domains: any[] = []): string {
    const normalizedText = normalizeLower(text);
    if (!normalizedText) return '';

    const sortedDomains = [...(domains || [])]
        .filter((domain: any) => domain?.name || domain?.id)
        .sort((a: any, b: any) => normalize(b.name || b.id).length - normalize(a.name || a.id).length);

    for (const domain of sortedDomains) {
        const candidates = [domain.name, domain.id].filter(Boolean);
        if (candidates.some((candidate) => {
            const normalizedCandidate = normalizeLower(candidate);
            if (!normalizedCandidate) return false;
            if (/^[a-z0-9]+$/.test(normalizedCandidate)) {
                const escaped = normalizedCandidate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(normalizedText);
            }
            return normalizedText.includes(normalizedCandidate);
        })) {
            return domain.name || domain.id;
        }
    }

    return '';
}

function inferDomainFromCodeLabel(value: unknown): string {
    const text = normalize(value);
    if (!text) return '';

    const match = text.match(/^(.+?)\s+[A-Z]\.\d+(?=\.|\s|$)/i);
    return normalize(match?.[1]);
}

/**
 * 명시 필드가 없는 major 의 도메인을 텍스트에서 추론한다.
 * 테넌트 도메인 목록(domains)만 근거로 쓴다 — 고정 시드는 없다. 추론이 꺼져 있으면 항상 ''.
 */
export function inferMajorBusinessDomain(major: any, domains: any[] = []): string {
    if (!activeConfig.infer_domain) return '';
    for (const sub of major?.sub_proc_list || []) {
        const inferredFromSub = findKnownDomainInText(`${sub?.id || ''} ${sub?.name || ''}`, domains) || inferDomainFromCodeLabel(sub?.id) || inferDomainFromCodeLabel(sub?.name);
        if (inferredFromSub) return inferredFromSub;
    }

    return (
        findKnownDomainInText(`${major?.id || ''} ${major?.name || ''}`, domains) ||
        inferDomainFromCodeLabel(major?.id) ||
        inferDomainFromCodeLabel(major?.name)
    );
}

/** major 에 명시적으로 기록된 도메인 값(추론 제외). 없으면 ''. */
export function getExplicitMajorDomain(major: any, domains: any[] = []): string {
    const rawCandidates = [major?.domain, major?.domain_id, major?.business_domain, major?.businessDomain, major?.network_domain, major?.networkDomain];
    const domainList = domains || [];
    for (const candidate of rawCandidates) {
        const value = normalize(candidate);
        if (!value) continue;
        const matched = domainList.find((d: any) => d?.name === value || d?.id === value);
        if (matched) return matched.name || matched.id;
        return value;
    }
    return '';
}

export function getMajorBusinessDomain(major: any, domains: any[] = []): string {
    const domainList = domains || [];
    const explicit = getExplicitMajorDomain(major, domainList);
    if (explicit) return explicit;

    const inferred = inferMajorBusinessDomain(major, domainList);
    if (!inferred) return '';

    const matched = domainList.find((d: any) => {
        const domainName = normalizeLower(d?.name);
        const domainId = normalizeLower(d?.id);
        const inferredKey = normalizeLower(inferred);
        return domainName === inferredKey || domainId === inferredKey;
    });

    return matched?.name || matched?.id || inferred;
}

export function majorMatchesDomain(major: any, domain: any, domains: any[] = []): boolean {
    if (!domain) return false;
    const majorDomain = getMajorBusinessDomain(major, domains);
    if (!majorDomain) return false;

    const majorDomainKey = normalizeLower(majorDomain);
    return majorDomainKey === normalizeLower(domain.name) || majorDomainKey === normalizeLower(domain.id);
}
