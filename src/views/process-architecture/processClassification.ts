export type ProcessStageColumn = 'design' | 'build' | 'monitor' | 'control' | 'shared';

export const PROCESS_STAGE_LABELS: Record<ProcessStageColumn, string> = {
    design: '설계',
    build: '구축',
    monitor: '감시',
    control: '제어',
    shared: '공통'
};

export const PROCESS_STAGE_ORDER: ProcessStageColumn[] = ['design', 'build', 'monitor', 'control', 'shared'];

const PROCESS_STAGE_KEYWORDS: Record<ProcessStageColumn, string[]> = {
    design: ['설계', 'design', '계획', 'plan', 'planning'],
    build: ['구축', 'build', '개발', 'develop', 'implement', 'implementation'],
    monitor: ['감시', 'monitor', '모니터', '관제', 'surveillance'],
    control: ['제어', 'control', '통제', '관리', 'manage', 'management'],
    shared: ['공통', 'shared', 'common']
};

const PROCESS_STAGE_BY_SEQUENCE: Record<string, ProcessStageColumn> = {
    '1': 'design',
    '2': 'build',
    '3': 'monitor',
    '4': 'control',
    '5': 'shared'
};

function normalize(value: unknown): string {
    return String(value ?? '').trim();
}

function normalizeLower(value: unknown): string {
    return normalize(value).toLowerCase();
}

export function isProcessStageValue(value: unknown): boolean {
    const text = normalizeLower(value);
    if (!text) return false;

    return Object.entries(PROCESS_STAGE_LABELS).some(([columnKey, label]) => {
        if (text === normalizeLower(label) || text === columnKey) return true;
        return PROCESS_STAGE_KEYWORDS[columnKey as ProcessStageColumn].some((keyword) => text === normalizeLower(keyword));
    });
}

function getStageColumnFromText(value: unknown, exactOnly = false): ProcessStageColumn | null {
    const text = normalizeLower(value);
    if (!text) return null;

    for (const [columnKey, label] of Object.entries(PROCESS_STAGE_LABELS)) {
        const key = columnKey as ProcessStageColumn;
        if (text === normalizeLower(label) || text === key) return key;
        if (PROCESS_STAGE_KEYWORDS[key].some((keyword) => text === normalizeLower(keyword))) return key;
    }

    if (exactOnly) return null;

    for (const [columnKey, keywords] of Object.entries(PROCESS_STAGE_KEYWORDS)) {
        const key = columnKey as ProcessStageColumn;
        if (keywords.some((keyword) => text.includes(normalizeLower(keyword)))) return key;
    }

    return null;
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
    const text = normalize(value);
    if (!text) return null;

    const match = text.match(/(?:^|[^A-Za-z0-9])([A-Z])\.(\d+)(?=\.|[^0-9]|$)/i);
    if (!match) return null;

    return PROCESS_STAGE_BY_SEQUENCE[match[2]] || null;
}

function inferStageColumnFromSubProcesses(major: any): ProcessStageColumn | null {
    const counts: Partial<Record<ProcessStageColumn, number>> = {};
    for (const sub of major?.sub_proc_list || []) {
        const column = inferStageColumnFromCode(sub?.id) || inferStageColumnFromCode(sub?.name);
        if (!column) continue;
        counts[column] = (counts[column] || 0) + 1;
    }

    let bestColumn: ProcessStageColumn | null = null;
    let bestCount = 0;
    for (const [column, count] of Object.entries(counts)) {
        if ((count || 0) > bestCount) {
            bestColumn = column as ProcessStageColumn;
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

    return getStageColumnFromText(major?.name) || 'shared';
}

export function getMajorStageLabel(major: any): string {
    return PROCESS_STAGE_LABELS[getMajorStageColumn(major)];
}

export function getMajorStageSortIndex(major: any): number {
    const index = PROCESS_STAGE_ORDER.indexOf(getMajorStageColumn(major));
    return index >= 0 ? index : PROCESS_STAGE_ORDER.length;
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

export function inferMajorBusinessDomain(major: any, domains: any[] = []): string {
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

export function getMajorBusinessDomain(major: any, domains: any[] = []): string {
    const rawCandidates = [major?.domain, major?.domain_id, major?.business_domain, major?.businessDomain, major?.network_domain, major?.networkDomain];

    const domainList = domains || [];
    for (const candidate of rawCandidates) {
        const value = normalize(candidate);
        if (!value) continue;

        // 도메인 목록에서 매칭되면 정규화된 이름 반환
        const matched = domainList.find((d: any) => d?.name === value || d?.id === value);
        if (matched) return matched.name || matched.id;

        // 명시적 값이 있으면 그대로 반환
        return value;
    }

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
