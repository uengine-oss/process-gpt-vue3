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
    // 넘긴 사람이 적은 지시사항(시작 단계에는 없다)
    instruction?: string;
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

async function post<T>(path: string, body: Record<string, any>): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify(body)
    });
    if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(`${path} 실패 (${res.status}) ${detail.slice(0, 200)}`);
    }
    return res.json();
}

/** 지켜야 할 묶음 경계 — 관리자가 본 묶음. 저장은 handover_process_decisions */
export interface DecidedProcess {
    key: string;
    category?: string | null;
    core_activities: string[];
    case_ids?: string[] | null;
    exclude: string[];
}

export interface UnclassifiedCase {
    case_id: string;
    trace: string[];
    reason: 'no_category' | 'no_core_step';
}

/** 관리자의 말에서 읽은 결정. 마이너가 사실과 맞춰 본 것만 온다 */
export interface FeedbackChange {
    confirm?: boolean;
    // kind 는 BPMN 의 뜻. when: 옵션이면 언제 건너뛰는지, 택일이면 언제 그 갈래로 가는지, 반복이면 언제 다시 하는지
    steps?: {
        step: string;
        kind: 'required' | 'optional' | 'choice' | 'loop';
        when?: string;
        by?: 'admin' | 'cases';
        matched?: number;
        total?: number;
        opposite?: string;
    }[];
    moves?: { case_id: string; to: string; category?: string }[];
    proposal?: 'accept' | 'reject';
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
    // 정의가 말하는 단계 진행 방식(규칙 반영 뒤)
    steps?: StepShape[];
    // 아직 조건이 정해지지 않은 분기 — 남아 있으면 제안·실행 전환을 할 수 없다
    undecided?: OpenSplit[];
    notes?: { step: string; reason: string }[];
}

export interface StepShape {
    step: string;
    kind: 'required' | 'optional' | 'choice';
    skip_when: string;
    when: string;
    redo_when: string;
    alternatives: string[];
    by: '' | 'admin' | 'cases';
    matched?: number;
    total?: number;
}

export interface OpenSplit {
    step: string;
    need: 'skip' | 'when' | 'redo';
    gateway: string;
    draft: string;
    matched?: number;
    total?: number;
    alternatives?: string[];
}

/** 단계 규칙 — handover_process_decisions.step_rules 의 값(process-miner step_rules) */
export type StepRule =
    | 'required'
    | { kind: 'required'; by?: string }
    | { kind: 'optional'; skip_when?: string; by?: string; matched?: number; total?: number; opposite?: string; draft?: any }
    | { kind: 'choice'; when?: string; by?: string; matched?: number; total?: number; opposite?: string; draft?: any }
    | { kind: 'loop'; redo_when?: string; by?: string; draft?: any };

/** 업무 묶음 — 업무 범주가 같은 끝난 스레드. 관리자가 본 묶음은 경계로 고정된다 */
export interface MinedProcessGroup {
    process_key: string;
    decided_key: string;
    category: string;
    // 업무 범주
    name: string;
    case_count: number;
    activities: string[];
    core_activities: string[];
    optional_activities: string[];
    variants: { trace: string[]; count: number }[];
    // 묶음의 사례(관리자가 확인한 사례). 화면은 이것으로 스레드를 거른다
    cases: string[];
    minable: boolean;
    // 관리자가 본 묶음에 새로 붙은 사례 — 받아들이기 전에는 묶음에 들어가지 않는다
    new_case_ids: string[];
    proposed: { case_ids: string[]; case_count: number; variants: { trace: string[]; count: number }[] } | null;
}

export interface GroupResult {
    processes: MinedProcessGroup[];
    unclassified: UnclassifiedCase[];
    in_progress_cases: number;
    dropped_short_cases: number;
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
    threads: (tenantId?: string, limit = 1000) =>
        get<{ count: number; threads: HandoverThread[] }>('/threads', { tenant_id: tenantId, limit }),
    network: (tenantId?: string) =>
        get<{ edges: { from: string; to: string; count: number }[]; automation: Record<string, any> }>('/network', {
            tenant_id: tenantId
        }),
    /** 업무 범주 판단(쓰기 없음) — 결과는 부른 쪽이 handover_case_categories 에 한 번 저장한다 */
    categories: (
        tenantId: string,
        cases: { id: string; request: string; steps: string[] }[],
        known: string[] = [],
        examples: { request: string; category: string }[] = [],
        lang?: string
    ) => post<{ categories: Record<string, string> }>('/categories', { tenant_id: tenantId, cases, known, examples, lang }),
    /** 업무 묶음 — 저장해 둔 범주와 관리자 결정(경계)을 넘긴다 */
    processes: (tenantId: string, categories: Record<string, string>, decided: DecidedProcess[]) =>
        post<GroupResult>('/processes', { tenant_id: tenantId, categories, decided }),
    discovered: (
        tenantId: string,
        processKey: string,
        categories: Record<string, string>,
        decided: DecidedProcess[],
        processId?: string,
        name?: string,
        rules: Record<string, StepRule> = {}
    ) =>
        post<DiscoveredProcess>('/discovered', {
            tenant_id: tenantId,
            process_key: processKey,
            categories,
            decided,
            process_id: processId,
            name,
            rules
        }),
    /** 정해지지 않은 분기의 조건을 사례에서 찾는다(LLM, 쓰기 없음). 관리자가 보고 적용한다 */
    conditions: (
        tenantId: string,
        processKey: string,
        categories: Record<string, string>,
        decided: DecidedProcess[],
        rules: Record<string, StepRule>,
        requests: Record<string, string>
    ) =>
        post<{ found: Record<string, any>; undecided: OpenSplit[] }>('/conditions', {
            tenant_id: tenantId,
            process_key: processKey,
            categories,
            decided,
            rules,
            requests
        }),
    /** 관리자의 말을 결정으로 읽는다(쓰기 없음). 저장은 관리자가 적용을 누른 뒤 화면이 한다 */
    feedback: (tenantId: string, message: string, facts: Record<string, any>, lang?: string) =>
        post<{ reply: string; change: FeedbackChange | null; error?: string }>('/feedback', {
            tenant_id: tenantId,
            message,
            facts,
            lang
        }),
    /** 조직 마이닝 — 역할 클러스터·활동별 자격·핸드오버 네트워크 */
    organization: (tenantId?: string) =>
        get<{
            network: { from: string; from_name: string; to: string; to_name: string; count: number }[];
            roles: {
                role: string;
                members: { user_id: string; name: string; is_agent: boolean }[];
                activities: string[];
                mixed: boolean;
            }[];
            eligibility: {
                activity: string;
                required_capability: string;
                observations: number;
                automation_rate: number;
                candidates: { user_id: string; name: string; is_agent: boolean; evidence_count: number; share: number }[];
            }[];
        }>('/organization', { tenant_id: tenantId }),
    /** 마이닝 실행 → proc_def_version(draft) + PR 생성. 살아있는 proc_def 는 건드리지 않는다. */
    mine: async (body: {
        tenant_id?: string;
        process_id?: string;
        name?: string;
        dry_run?: boolean;
        process_key?: string;
        categories?: Record<string, string>;
        decided?: DecidedProcess[];
    }) => {
        const res = await fetch(`${BASE}/mine`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
            body: JSON.stringify(body)
        });
        if (!res.ok) throw new Error(`마이닝 실패 (${res.status}) ${(await res.text()).slice(0, 200)}`);
        return res.json();
    }
};
