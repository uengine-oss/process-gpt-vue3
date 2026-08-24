import { getMajorBusinessDomain } from '@/views/process-architecture/processClassification';
import { toSafeText } from '@/utils/safeText';

export type DataFreezeScope = 'domain' | 'mega_process' | 'major_process' | 'subprocess';

export interface DataFreezeItem {
    id?: string;
    scope: DataFreezeScope;
    target_id: string;
    target_name: string;
    reason?: string;
    locked_by?: string;
    locked_at?: string;
}

export interface ProcessFreezeContext {
    procDefId: string;
    megaId: string;
    megaName: string;
    majorId: string;
    majorName: string;
    domainId: string;
    domainName: string;
}

function normalizeText(value: unknown): string {
    return toSafeText(value).trim();
}

function normalizeKey(value: unknown): string {
    return normalizeText(value).toLowerCase();
}

function buildComparableCandidates(...values: unknown[]): Set<string> {
    const candidates = new Set<string>();
    values.forEach((value) => {
        const normalized = normalizeKey(value);
        if (normalized) candidates.add(normalized);
    });
    return candidates;
}

function resolveDomainContext(major: any, domains: any[] = []): Pick<ProcessFreezeContext, 'domainId' | 'domainName'> {
    const rawCandidates = [major?.domain, major?.domain_id, major?.business_domain, major?.businessDomain, major?.network_domain, major?.networkDomain];
    const normalizedDomains = Array.isArray(domains) ? domains : [];

    for (const candidate of rawCandidates) {
        const value = normalizeText(candidate);
        if (!value) continue;

        const matched = normalizedDomains.find((domain: any) => {
            const domainId = normalizeKey(domain?.id);
            const domainName = normalizeKey(domain?.name);
            const candidateKey = normalizeKey(value);
            return domainId === candidateKey || domainName === candidateKey;
        });

        if (matched) {
            return {
                domainId: normalizeText(matched?.id || matched?.name),
                domainName: normalizeText(matched?.name || matched?.id)
            };
        }

        return {
            domainId: value,
            domainName: value
        };
    }

    const fallbackName = normalizeText(getMajorBusinessDomain(major, normalizedDomains));
    if (!fallbackName) {
        return {
            domainId: '',
            domainName: ''
        };
    }

    const matched = normalizedDomains.find((domain: any) => {
        const domainId = normalizeKey(domain?.id);
        const domainName = normalizeKey(domain?.name);
        const fallbackKey = normalizeKey(fallbackName);
        return domainId === fallbackKey || domainName === fallbackKey;
    });

    return {
        domainId: normalizeText(matched?.id || fallbackName),
        domainName: normalizeText(matched?.name || fallbackName)
    };
}

export function listProcessFreezeContexts(procMap: any, metricsMap: any): ProcessFreezeContext[] {
    if (!procMap?.mega_proc_list) return [];

    const contexts = new Map<string, ProcessFreezeContext>();
    for (const mega of procMap.mega_proc_list || []) {
        for (const major of mega?.major_proc_list || []) {
            const { domainId, domainName } = resolveDomainContext(major, metricsMap?.domains || []);
            for (const sub of major?.sub_proc_list || []) {
                const procDefId = normalizeText(sub?.id);
                if (!procDefId) continue;

                contexts.set(procDefId, {
                    procDefId,
                    megaId: normalizeText(mega?.id),
                    megaName: normalizeText(mega?.name || mega?.id),
                    majorId: normalizeText(major?.id),
                    majorName: normalizeText(major?.name || major?.id),
                    domainId,
                    domainName
                });
            }
        }
    }

    return Array.from(contexts.values());
}

export function normalizeDataFreezeList(list: unknown): DataFreezeItem[] {
    if (!Array.isArray(list)) return [];

    return list
        .map((item: any) => ({
            id: normalizeText(item?.id),
            scope: normalizeText(item?.scope) as DataFreezeScope,
            target_id: normalizeText(item?.target_id),
            target_name: normalizeText(item?.target_name),
            reason: normalizeText(item?.reason),
            locked_by: normalizeText(item?.locked_by),
            locked_at: normalizeText(item?.locked_at)
        }))
        .filter((item) => {
            if (!item.scope || !item.target_id) return false;
            return ['domain', 'mega_process', 'major_process', 'subprocess'].includes(item.scope);
        });
}

export function getProcessFreezeContext(procDefId: unknown, procMap: any, metricsMap: any): ProcessFreezeContext | null {
    const normalizedProcDefId = normalizeText(procDefId);
    if (!normalizedProcDefId || !procMap?.mega_proc_list) return null;

    return listProcessFreezeContexts(procMap, metricsMap).find((context) => context.procDefId === normalizedProcDefId) || null;
}

export function getProcessFreezeContextFromDefinition(
    procDefId: unknown,
    procDef: any,
    procMap: any,
    metricsMap: any
): ProcessFreezeContext | null {
    const normalizedProcDefId = normalizeText(procDefId);
    if (!normalizedProcDefId) return null;

    const fallbackContext = getProcessFreezeContext(normalizedProcDefId, procMap, metricsMap);
    const domainId = normalizeText(procDef?.domain_id || fallbackContext?.domainId);
    const megaId = normalizeText(procDef?.mega_process_id || fallbackContext?.megaId);
    const majorId = normalizeText(procDef?.major_process_id || fallbackContext?.majorId);

    if (!domainId && !megaId && !majorId && !fallbackContext) return null;

    return {
        procDefId: normalizedProcDefId,
        megaId,
        megaName: normalizeText(fallbackContext?.megaName),
        majorId,
        majorName: normalizeText(fallbackContext?.majorName),
        domainId,
        domainName: normalizeText(fallbackContext?.domainName)
    };
}

export function dataFreezeMatchesContext(item: DataFreezeItem, context: ProcessFreezeContext | null): boolean {
    if (!context) return false;

    const targetCandidates = buildComparableCandidates(item.target_id, item.target_name);
    if (targetCandidates.size === 0) return false;

    switch (item.scope) {
        case 'subprocess': {
            const contextCandidates = buildComparableCandidates(context.procDefId);
            return [...contextCandidates].some((candidate) => targetCandidates.has(candidate));
        }
        case 'major_process': {
            const contextCandidates = buildComparableCandidates(context.majorId, context.majorName);
            return [...contextCandidates].some((candidate) => targetCandidates.has(candidate));
        }
        case 'mega_process': {
            const contextCandidates = buildComparableCandidates(context.megaId, context.megaName);
            return [...contextCandidates].some((candidate) => targetCandidates.has(candidate));
        }
        case 'domain': {
            const contextCandidates = buildComparableCandidates(context.domainId, context.domainName);
            return [...contextCandidates].some((candidate) => targetCandidates.has(candidate));
        }
        default:
            return false;
    }
}

export function findMatchingDataFreezeItem(
    procDefId: unknown,
    procMap: any,
    metricsMap: any,
    freezeList: unknown,
    procDef?: any
): DataFreezeItem | null {
    const normalizedList = normalizeDataFreezeList(freezeList);
    if (normalizedList.length === 0) return null;

    const context = procDef
        ? getProcessFreezeContextFromDefinition(procDefId, procDef, procMap, metricsMap)
        : getProcessFreezeContext(procDefId, procMap, metricsMap);
    if (!context) return null;

    return normalizedList.find((item) => dataFreezeMatchesContext(item, context)) || null;
}

export function formatDataFreezeScopeLabel(scope: DataFreezeScope): string {
    const scopeLabelMap: Record<DataFreezeScope, string> = {
        domain: '도메인',
        mega_process: 'Mega 프로세스',
        major_process: 'Major 프로세스',
        subprocess: '프로세스'
    };

    return scopeLabelMap[scope] || scope;
}

export function describeDataFreeze(item: DataFreezeItem | null): string {
    if (!item) return '';

    const scopeLabel = formatDataFreezeScopeLabel(item.scope);
    const targetLabel = normalizeText(item.target_name || item.target_id);
    const baseMessage = targetLabel
        ? `Data Freeze로 ${scopeLabel} "${targetLabel}" 범위가 잠겨 있습니다.`
        : `Data Freeze로 ${scopeLabel} 범위가 잠겨 있습니다.`;
    const reason = normalizeText(item.reason);

    return reason ? `${baseMessage} 사유: ${reason}.` : baseMessage;
}
