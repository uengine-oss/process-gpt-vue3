/**
 * process-miner 마이크로서비스 클라이언트.
 * dev 에서는 vite.config.ts 의 프록시가 /process-miner/* 를 서비스로 보낸다(prefix strip).
 *
 * 서비스는 요청이 보낸 tenant_id 를 믿지 않는다. JWT 로 확인한 사용자의 테넌트와
 * 대조하므로 모든 호출에 Authorization: Bearer <access_token> 을 싣는다.
 */
import { getAgentApiToken } from '@/utils/deepagentsApi';

const BASE = '/process-miner';

async function authHeaders(): Promise<Record<string, string>> {
    const token = await getAgentApiToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
}

async function get<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params || {})) {
        if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
    }
    const url = `${BASE}${path}${qs.toString() ? `?${qs}` : ''}`;
    const res = await fetch(url, { headers: await authHeaders() });
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
    // 마지막으로 받은 할 일이 끝나지 않은 스레드는 false — 도출에 들어가지 않는다
    finished?: boolean;
    // 끝난 스레드가 속한 업무 묶음. 진행 중이거나 단계가 하나뿐이면 null
    process_key?: string | null;
    steps: HandoverStep[];
}

export interface DiscoveredProcess {
    stats: {
        event_count: number;
        case_count: number;
        activity_count: number;
        dropped_short_cases?: number;
        in_progress_cases?: number;
        process_key?: string | null;
        process_name?: string | null;
        process_count?: number;
        delegation_count?: number;
        variants: { trace: string[]; count: number }[];
        // 한 번의 인계로 같은 일을 여러 명에게 준 단계(다중 인스턴스)
        multi_instance_activities?: string[];
        handover_matrix: { from: string; to: string; count: number }[];
    };
    tree: string;
    definition: any;
}

/** 업무 묶음 — 거친 단계가 겹치는 끝난 스레드끼리 묶은 것. 묶음마다 프로세스를 따로 도출한다 */
export interface MinedProcessGroup {
    process_key: string;
    name: string;
    case_count: number;
    activities: string[];
    variants: { trace: string[]; count: number }[];
    minable: boolean;
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
    // 식별 화면은 업무별로 스레드를 거른다. 50건에서 자르면 업무의 케이스 수와 스레드 수가 맞지 않았다.
    threads: (tenantId?: string, limit = 1000) => get<{ count: number; threads: HandoverThread[] }>('/threads', { tenant_id: tenantId, limit }),
    network: (tenantId?: string) =>
        get<{ edges: { from: string; to: string; count: number }[]; automation: Record<string, any> }>('/network', {
            tenant_id: tenantId
        }),
    processes: (tenantId?: string) =>
        get<{ processes: MinedProcessGroup[]; in_progress_cases: number; dropped_short_cases: number }>('/processes', {
            tenant_id: tenantId
        }),
    discovered: (tenantId?: string, processKey?: string, processId?: string, name?: string) =>
        get<DiscoveredProcess>('/discovered', { tenant_id: tenantId, process_key: processKey, process_id: processId, name }),
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
    mine: async (body: { tenant_id?: string; process_id?: string; name?: string; dry_run?: boolean; process_key?: string }) => {
        const res = await fetch(`${BASE}/mine`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
            body: JSON.stringify(body)
        });
        if (!res.ok) throw new Error(`마이닝 실패 (${res.status}) ${(await res.text()).slice(0, 200)}`);
        return res.json();
    }
};
