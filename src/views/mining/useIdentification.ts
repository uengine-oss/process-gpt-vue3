/**
 * 프로세스 식별의 목록·상세가 함께 쓰는 묶음 불러오기 (identification-list-detail, 2026-11-12).
 *
 * 순서: 스레드 → 끝난 건 중 범주 없는 건을 한 번 판단해 저장 → 관리자 결정 → POST /processes →
 * 처음 보인 묶음을 경계로 저장. 목록에서 받은 결과를 상세가 이어 쓴다(같은 세션). 상세를 바로 열면 그때 받는다.
 * 식별 규칙은 process-miner, 저장은 identificationDecisions 에 있다. 이 모듈은 그 둘을 이어 부를 뿐이다.
 */
import { reactive } from 'vue';
import { processMiner, type HandoverThread, type MinedProcessGroup, type UnclassifiedCase } from '@/utils/processMiner';
import * as Decisions from '@/utils/identificationDecisions';
import BackendFactory from '@/components/api/BackendFactory';

const backend: any = BackendFactory.createBackend();

export const UNCLASSIFIED = '__unclassified';

/**
 * 진행 단계 — Lite 프로세스 마이닝과 같은 결정 구조(2026-11-12): 추천 → 제안 중(병합 요청 열림) → 정식 등록, 그리고 보류.
 * 관리자의 세부 판단(필수·옵션, 건 옮기기)은 추천 상태에서 그때그때 저장되므로 '맞다고 확정' 하는 단계는 두지 않는다.
 */
export type WorkStatus = 'found' | 'proposed' | 'registered' | 'held';
export const STATUS_LABEL: Record<WorkStatus, string> = {
    found: '추천',
    held: '보류',
    proposed: '제안 중',
    registered: '정식 등록'
};

export const state = reactive({
    tenantId: '',
    loaded: false,
    loading: false,
    judging: 0,
    error: '',
    threads: [] as HandoverThread[],
    roomNames: {} as Record<string, string>,
    requests: {} as Record<string, string>,
    caseCategories: {} as Record<string, Decisions.CaseCategory>,
    decisions: [] as Decisions.Decision[],
    groups: [] as MinedProcessGroup[],
    unclassified: [] as UnclassifiedCase[],
    refreshing: false,
    // 업무 키 → 진행 단계(병합 요청·정의로 정한 것)
    prStatus: {} as Record<string, 'proposed' | 'registered'>,
    // 업무 키 → 정식 프로세스 정의 id 들(병합한 것 · 실행 전환으로 저장한 것)
    registered: {} as Record<string, string[]>
});

export function tenantId(): string {
    return (window as any).$tenantName || 'localhost';
}

export function categoriesForMiner(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(state.caseCategories)) if (v?.category) out[k] = v.category;
    return out;
}

export function decided() {
    return Decisions.toDecided(state.decisions);
}

export function decisionOf(key: string) {
    return state.decisions.find((d) => d.process_key === key) || null;
}

export function threadName(t: HandoverThread | undefined): string {
    if (!t) return '';
    return state.roomNames[t.origin_room_id] || t.steps?.[0]?.activity || '—';
}

export function threadOf(id: string) {
    return state.threads.find((t) => t.origin_room_id === id);
}

export function caseLabel(id: string): string {
    return threadName(threadOf(id)) || id;
}

/** 이 건이 마지막으로 움직인 시각 */
export function lastAt(id: string): string {
    const steps = threadOf(id)?.steps || [];
    return steps.length ? steps[steps.length - 1].occurred_at || '' : '';
}

export function statusOf(g: MinedProcessGroup): WorkStatus {
    const pr = state.prStatus[g.process_key];
    if (pr) return pr;
    return decisionOf(g.process_key)?.status === 'held' ? 'held' : 'found';
}

async function loadRoomNames() {
    const ids = Array.from(new Set(state.threads.map((t) => t.origin_room_id).filter(Boolean)));
    const names: Record<string, string> = {};
    for (let i = 0; i < ids.length; i += 100) {
        const { data } = await (window as any).$supabase
            .from('chat_rooms')
            .select('id, name')
            .in('id', ids.slice(i, i + 100));
        for (const r of data || []) if (r.name) names[r.id] = r.name;
    }
    state.roomNames = names;
}

/** 끝난 건 중 범주가 없는 건을 한 번 판단해 저장한다(다시 판단하지 않는다). */
async function judgePending() {
    state.caseCategories = await Decisions.loadCategories();
    const pending = state.threads.filter(
        (t) => t.finished !== false && !state.caseCategories[t.origin_room_id] && (t.steps || []).length >= 2
    );
    if (!pending.length) return;
    state.judging = pending.length;
    try {
        state.requests = { ...state.requests, ...(await Decisions.firstRequests(pending.map((t) => t.origin_room_id))) };
        // 무엇을 요청받은 일인가: 처음 요청한 대화. 대화 없이 인계로만 시작한 방이면 방 이름과 첫 지시사항.
        const requestOf = (t: HandoverThread) =>
            state.requests[t.origin_room_id] ||
            [state.roomNames[t.origin_room_id], (t.steps || []).find((st: any) => st.instruction)?.instruction].filter(Boolean).join('\n');
        const known = Array.from(new Set(Object.values(state.caseCategories).map((c) => c.category)));
        const examples = Object.values(state.caseCategories)
            .filter((c) => c.category_by === 'admin' && c.request)
            .slice(0, 30)
            .map((c) => ({ request: c.request as string, category: c.category }));
        const cases = pending.map((t) => ({
            id: t.origin_room_id,
            request: requestOf(t),
            steps: (t.steps || []).map((st) => st.activity).filter(Boolean)
        }));
        const used = Object.fromEntries(cases.map((c) => [c.id, c.request]));
        const got = await processMiner
            .categories(state.tenantId, cases, known, examples)
            .catch((e) => (console.warn('[mining] 범주 판단 실패:', e), { categories: {} as Record<string, string> }));
        const rows = Object.entries(got.categories || {}).map(([case_id, category]) => ({
            case_id,
            category,
            category_by: 'ai' as const,
            request: used[case_id] || null
        }));
        await Decisions.saveJudged(rows);
        if (rows.length) state.caseCategories = await Decisions.loadCategories();
    } finally {
        state.judging = 0;
    }
}

/** 업무 묶음을 다시 받는다. 처음 보인 묶음은 경계로 남긴다. */
export async function reloadGroups() {
    state.decisions = await Decisions.loadDecisions();
    let pg = await processMiner.processes(state.tenantId, categoriesForMiner(), decided());
    if (await Decisions.rememberShown(pg.processes || [], state.decisions)) {
        state.decisions = await Decisions.loadDecisions();
        pg = await processMiner.processes(state.tenantId, categoriesForMiner(), decided());
    }
    state.groups = pg.processes || [];
    state.unclassified = pg.unclassified || [];
    await loadPrStatus();
}

/**
 * 업무 키 → 정식 프로세스 정의 id 들. 두 길로 생긴다.
 *   - 새 프로세스로 제안 → 병합: 정의 id 가 mined_<업무 키>
 *   - 실행 가능한 프로세스로 전환 → 저장: 전환 대화방(context.identification.process_key)의 저장 결과(savedProcesses)
 */
export async function registeredDefs(keys: string[]): Promise<Record<string, string[]>> {
    const sb = (window as any).$supabase;
    const out: Record<string, string[]> = {};
    if (!keys.length) return out;
    const candidates: Record<string, string> = {}; // 정의 id → 업무 키
    for (const k of keys) candidates[`mined_${k}`] = k;
    const { data: rooms } = await sb.from('chat_rooms').select('id, context').in('context->identification->>process_key', keys);
    const roomKey: Record<string, string> = {};
    for (const r of rooms || []) {
        const k = r?.context?.identification?.process_key;
        if (k) roomKey[r.id] = k;
    }
    // 실행 전환을 시작할 때 그 업무의 관리자 대화에 남긴 전환 방(방 context 가 덮여도 이어진다)
    const { data: talks } = await sb.from('handover_identification_talk').select('process_key, change').in('process_key', keys);
    for (const t of talks || []) {
        const room = t?.change?.conversion_room;
        if (room && !roomKey[room]) roomKey[room] = t.process_key;
    }
    const roomIds = Object.keys(roomKey);
    for (let i = 0; i < roomIds.length; i += 50) {
        const { data: msgs } = await sb
            .from('chats')
            .select('id, messages')
            .in('id', roomIds.slice(i, i + 50));
        for (const m of msgs || []) {
            const res = m?.messages?.pdf2bpmnResult;
            if (!res?.__saved) continue;
            for (const sp of res.savedProcesses || []) {
                const id = sp?.process_id || sp?.definition?.processDefinitionId;
                if (id) candidates[String(id)] = roomKey[m.id];
            }
        }
    }
    const ids = Object.keys(candidates);
    for (let i = 0; i < ids.length; i += 100) {
        const { data: defs } = await sb
            .from('proc_def')
            .select('id')
            .in('id', ids.slice(i, i + 100))
            .eq('isdeleted', false)
            // 승인 전 제안이 만든 숨김(is_draft) 정의는 정식 프로세스가 아니다
            .or('is_draft.is.null,is_draft.eq.false')
            // 휴지통으로 지운 정의(deleted_at)는 세지 않는다
            .is('deleted_at', null);
        for (const d of defs || []) {
            const k = candidates[String(d.id)];
            (out[k] = out[k] || []).push(String(d.id));
        }
    }
    return out;
}

/** 제안 중·정식 등록: 정식 정의가 있으면 정식 등록, 없고 mined_<키> 병합 요청이 열려 있으면 제안 중. */
async function loadPrStatus() {
    const out: Record<string, 'proposed' | 'registered'> = {};
    const keys = state.groups.map((g) => g.process_key);
    try {
        const defs = await registeredDefs(keys);
        state.registered = defs;
        for (const k of Object.keys(defs)) out[k] = 'registered';
        for (const k of keys) {
            if (out[k]) continue;
            const prs = await backend.getResourcePrRecords('bpmn', `mined_${k}`).catch(() => []);
            if ((prs || []).some((p: any) => p.status === 'OPEN')) out[k] = 'proposed';
        }
    } catch (e) {
        console.warn('[mining] 제안 상태 조회 실패:', e);
    }
    state.prStatus = out;
}

/** 스레드 · 범주 · 묶음 · 상태를 받는다. */
async function fetchAll() {
    const th = await processMiner.threads(state.tenantId);
    state.threads = th.threads || [];
    await loadRoomNames().catch((e) => console.warn('[mining] 방 이름 조회 실패:', e));
    state.loaded = true;
    await judgePending();
    await reloadGroups();
}

/**
 * 목록·상세에 들어올 때마다 부른다. 처음이면 받는 동안 로딩을 보이고, 이미 받았으면 지금 결과를 바로 보이고
 * 뒤에서 다시 받는다 — 병합함·대화방(실행 전환)을 다녀오면 상태가 바뀌어 있을 수 있다.
 */
export async function ensureLoaded(force = false) {
    if (state.loading || state.refreshing) return;
    const fresh = !state.loaded || state.tenantId !== tenantId();
    state.tenantId = tenantId();
    state.error = '';
    if (fresh || force) state.loading = true;
    else state.refreshing = true;
    try {
        await fetchAll();
    } catch (e: any) {
        state.error = e?.message || String(e);
    } finally {
        state.loading = false;
        state.refreshing = false;
    }
}

/** 처리할 일 순: 새로 들어온 건 → 추천 → 제안 중 → 정식 등록 → 보류, 같은 순위는 최근 순 */
export function sortedGroups(): MinedProcessGroup[] {
    const rank = (g: MinedProcessGroup) =>
        g.new_case_ids?.length ? 0 : ({ found: 1, proposed: 2, registered: 3, held: 4 } as const)[statusOf(g)];
    const latest = (g: MinedProcessGroup) => [...(g.cases || []), ...(g.new_case_ids || [])].map(lastAt).sort().pop() || '';
    return [...state.groups].sort((a, b) => rank(a) - rank(b) || latest(b).localeCompare(latest(a)));
}

/**
 * 흐름 순서의 단계. 가장 많이 관측된 흐름을 뼈대로, 다른 흐름에만 있는 단계는 그 흐름에서 바로 뒤에 오는
 * 단계 앞에 끼운다(예산 검토 | 팀장 승인 처럼 갈리는 단계가 나란히 온다).
 */
export function stepOrder(g: MinedProcessGroup): string[] {
    const out: string[] = [];
    for (const v of g.variants || []) {
        const t = v.trace;
        t.forEach((a, i) => {
            if (out.includes(a)) return;
            const next = t.slice(i + 1).find((x) => out.includes(x));
            if (next) out.splice(out.indexOf(next), 0, a);
            else out.push(a);
        });
    }
    for (const a of g.activities || []) if (!out.includes(a)) out.push(a);
    return out;
}

/** 건의 단계 순서 — 인계로 넘긴 일만(에이전트에게 한 대화 원문은 단계가 아니다), 연달아 같은 단계는 하나로 */
export function traceOf(t: HandoverThread | undefined): string[] {
    const out: string[] = [];
    for (const s of t?.steps || []) {
        if (!s.activity || s.source === 'agent_delegation') continue;
        if (out[out.length - 1] !== s.activity) out.push(s.activity);
    }
    return out;
}

/** 목록에 보일 주요 흐름: 같은 자리에서 갈리는 단계는 '|' 로 */
export function flowLine(g: MinedProcessGroup): string {
    const vs = (g.variants || []).map((v) => v.trace);
    if (!vs.length) return '';
    const main = vs[0];
    const parts = main.map((a, i) => {
        const alts = Array.from(new Set(vs.filter((t) => t.length === main.length).map((t) => t[i])));
        return alts.length > 1 ? alts.join(' | ') : a;
    });
    return parts.join(' → ');
}

export function shortDate(v: string): string {
    if (!v) return '';
    const d = new Date(v);
    if (isNaN(d.getTime())) return String(v).slice(5, 10);
    return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * 화면을 띄워 둔 채 다른 탭·창에서 일하고 돌아와도 맞게 — 창에 다시 들어오거나(포커스·탭 전환)
 * 화면을 보고 있는 동안 주기적으로 뒤에서 다시 받는다. 그만 받을 때 부를 함수를 돌려준다.
 */
export function watchRefresh(everyMs = 30_000): () => void {
    const refresh = () => {
        if (document.visibilityState === 'visible') ensureLoaded().catch((e) => console.warn('[mining] 다시 받기 실패:', e));
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    const timer = window.setInterval(refresh, everyMs);
    return () => {
        window.removeEventListener('focus', refresh);
        document.removeEventListener('visibilitychange', refresh);
        window.clearInterval(timer);
    };
}
