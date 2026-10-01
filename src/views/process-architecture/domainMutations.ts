/**
 * 도메인 변경(이름 변경 / 삭제) 공용 로직.
 *
 * 도메인은 configuration.metrics(domains 배열)와 configuration.proc_map(major 의 domain 필드)
 * 두 곳에 걸쳐 있어, 한쪽만 고치면 체계도에서 프로세스가 떨어져 나가거나(rename)
 * 삭제한 도메인이 추론으로 되살아난다(delete). 두 맵을 항상 함께 변환하려고 여기로 모았다.
 *
 * 재구성 모드(ProcessArchRestructureStudio)와 체계도 화면이 같은 함수를 쓴다.
 */
import { majorMatchesDomain } from './processClassification';

export interface DomainLike {
    id?: string;
    name?: string;
    color?: string | null;
    order?: number;
}

function normalizeKey(value: unknown): string {
    return String(value ?? '').trim().toLowerCase();
}

/** metrics.domains 의 한 항목이 대상 도메인인지 — id 우선, 없으면 이름으로 매칭 */
export function matchesDomainEntry(entry: any, domain: DomainLike): boolean {
    const entryId = normalizeKey(entry?.id);
    const entryName = normalizeKey(entry?.name);
    const domainId = normalizeKey(domain?.id);
    const domainName = normalizeKey(domain?.name);
    return (!!entryId && entryId === domainId) || (!!entryName && entryName === domainName);
}

/** 도메인에 소속된 major 목록 (명시 필드 + 추론 매칭 기준) */
export function findMajorsForDomain(map: any, domain: DomainLike, domainList: any[] = []): any[] {
    const matched: any[] = [];
    for (const mega of map?.mega_proc_list || []) {
        for (const major of mega.major_proc_list || []) {
            if (majorMatchesDomain(major, domain, domainList)) matched.push(major);
        }
    }
    return matched;
}

/**
 * major 의 도메인 지정/해제.
 * 해제 시에는 추론 매칭에 쓰이는 레거시 필드까지 모두 지워야 미분류로 내려간다.
 */
export function applyMajorDomain(major: any, domainName: string, domainId: string) {
    delete major.business_domain;
    delete major.businessDomain;
    delete major.network_domain;
    delete major.networkDomain;

    if (domainName) {
        major.domain = domainName;
        major.domain_id = domainId;
        return;
    }

    delete major.domain;
    delete major.domain_id;
}

export interface DomainImpact {
    majorCount: number;
    subCount: number;
    majorNames: string[];
}

/** 도메인 변경의 영향 범위 — 소속 major 수 / 하위 프로세스 수 */
export function measureDomainImpact(map: any, domain: DomainLike, domainList: any[] = []): DomainImpact {
    const majors = findMajorsForDomain(map, domain, domainList);
    return {
        majorCount: majors.length,
        subCount: majors.reduce((sum: number, major: any) => sum + (major.sub_proc_list || []).length, 0),
        majorNames: majors.map((major: any) => String(major?.name || major?.id || ''))
    };
}

/**
 * proc_map 에서 도메인 이름을 일괄 변경한다(id 는 유지).
 * id 를 그대로 두는 이유: proc_def.domain_id, KPI 목표, 정책문서가 모두 id 로 도메인을 참조한다.
 */
export function applyDomainRenameToProcMap(map: any, domain: DomainLike, newName: string, domainList: any[] = []): number {
    const majors = findMajorsForDomain(map, domain, domainList);
    for (const major of majors) {
        applyMajorDomain(major, newName, String(domain.id ?? newName));
    }
    return majors.length;
}

/** proc_map 에서 도메인 참조를 제거한다 — 소속 major 는 미분류로 내려간다. */
export function applyDomainDeleteToProcMap(map: any, domain: DomainLike, domainList: any[] = []): number {
    const majors = findMajorsForDomain(map, domain, domainList);
    for (const major of majors) {
        applyMajorDomain(major, '', '');
    }
    return majors.length;
}

function baseMetrics(metrics: any) {
    return {
        ...(metrics || {}),
        domains: Array.isArray(metrics?.domains) ? metrics.domains.map((d: any) => ({ ...d })) : [],
        mega_processes: metrics?.mega_processes ?? [],
        processes: metrics?.processes ?? []
    };
}

/**
 * metrics.domains 의 이름/색상을 변경한다.
 * 항목이 없으면(추론으로만 존재하던 도메인) 새로 넣어 영속화한다.
 */
export function applyDomainRenameToMetrics(metrics: any, domain: DomainLike, newName: string, color?: string | null): any {
    const next = baseMetrics(metrics);
    const entry = next.domains.find((d: any) => matchesDomainEntry(d, domain));
    if (entry) {
        entry.name = newName;
        if (color !== undefined) entry.color = color;
    } else {
        next.domains.push({
            id: domain.id ?? newName,
            name: newName,
            color: color ?? null,
            order: next.domains.length + 1
        });
    }
    return next;
}

/** metrics 에서 도메인과 그 도메인을 참조하던 process 미러 행을 제거한다. */
export function applyDomainDeleteToMetrics(metrics: any, domain: DomainLike): any {
    const next = baseMetrics(metrics);
    next.domains = next.domains.filter((d: any) => !matchesDomainEntry(d, domain));
    next.processes = (Array.isArray(next.processes) ? next.processes : []).filter(
        (p: any) =>
            normalizeKey(p?.domain_id) !== normalizeKey(domain.id) &&
            normalizeKey(p?.domain_id) !== normalizeKey(domain.name)
    );
    return next;
}
