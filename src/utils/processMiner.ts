/**
 * process-miner 마이크로서비스 클라이언트.
 * 게이트웨이(nginx)가 /process-miner/* 를 서비스로 프록시한다(prefix strip).
 * dev 에서는 vite.config.ts 의 프록시가 같은 역할을 한다.
 */
const BASE = '/process-miner';

async function get<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params || {})) {
        if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
    }
    const url = `${BASE}${path}${qs.toString() ? `?${qs}` : ''}`;
    const res = await fetch(url);
    if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(`${path} 실패 (${res.status}) ${detail.slice(0, 200)}`);
    }
    return res.json();
}

export interface HandoverStep {
    from: string;
    to: string;
    to_is_agent: boolean;
    activity: string;
    source: string;
    is_explicit: boolean;
    occurred_at: string;
}

export interface HandoverThread {
    origin_room_id: string;
    step_count: number;
    steps: HandoverStep[];
}

export interface DiscoveredProcess {
    stats: {
        event_count: number;
        case_count: number;
        activity_count: number;
        dropped_short_cases?: number;
        variants: { trace: string[]; count: number }[];
        handover_matrix: { from: string; to: string; count: number }[];
    };
    tree: string;
    definition: any;
}

export interface IdentifiedProposal {
    id: string;
    resource_id: string;
    branch_name: string;
    title: string;
    description: string;
    status: string;
    created_at: string;
}

export const processMiner = {
    health: () => get<{ status: string }>('/health'),
    threads: (tenantId?: string, limit = 50) => get<{ count: number; threads: HandoverThread[] }>('/threads', { tenant_id: tenantId, limit }),
    network: (tenantId?: string) =>
        get<{ edges: { from: string; to: string; count: number }[]; automation: Record<string, any> }>('/network', {
            tenant_id: tenantId
        }),
    discovered: (tenantId?: string, processId?: string, name?: string) =>
        get<DiscoveredProcess>('/discovered', { tenant_id: tenantId, process_id: processId, name }),
    /** 조직 마이닝 — 역할 클러스터·활동별 자격·핸드오버 네트워크 */
    organization: (tenantId?: string) =>
        get<{
            network: { from: string; from_name: string; to: string; to_name: string; count: number }[];
            roles: { role: string; members: { user_id: string; name: string; is_agent: boolean }[]; activities: string[]; mixed: boolean }[];
            eligibility: {
                activity: string;
                required_capability: string;
                observations: number;
                automation_rate: number;
                candidates: { user_id: string; name: string; is_agent: boolean; evidence_count: number; share: number }[];
            }[];
        }>('/organization', { tenant_id: tenantId }),
    /** 마이닝 실행 → proc_def_version(draft) + PR 생성. 살아있는 proc_def 는 건드리지 않는다. */
    mine: async (body: { tenant_id?: string; process_id?: string; name?: string; dry_run?: boolean }) => {
        const res = await fetch(`${BASE}/mine`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (!res.ok) throw new Error(`마이닝 실패 (${res.status}) ${(await res.text()).slice(0, 200)}`);
        return res.json();
    }
};
