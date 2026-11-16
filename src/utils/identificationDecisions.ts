/**
 * 프로세스 식별 화면의 저장소 — 업무 범주와 관리자 결정(general-intent-grouping, 2026-11-12).
 *
 * 범주 판단과 묶기 규칙은 process-miner 한 곳에 있다(Lite 와 같은 규칙). 마이너는 저장하지 않으므로
 * 이 화면이 저장해 두고 식별할 때마다 넘긴다.
 *   handover_case_categories   사례(origin_room_id)별 범주. 끝난 사례에 한 번 판단한다. admin 은 관리자가 정한 것
 *   handover_process_decisions 관리자가 본 묶음(경계). 묶음 하나로 고정하고, 새 사례는 제안으로 둔다
 *   handover_identification_talk 관리자와 나눈 대화
 *
 * 관리자 확인 없이는 묶음이 바뀌지 않는다. 바뀌는 곳은 applyChange 하나이고, 화면은 관리자가
 * 적용을 누른 뒤에만 그것을 부른다.
 */
import type { DecidedProcess, FeedbackChange, MinedProcessGroup, UnclassifiedCase } from '@/utils/processMiner';

export interface CaseCategory {
    case_id: string;
    category: string;
    category_by: 'ai' | 'admin';
    request?: string | null;
}

export interface Decision {
    process_key: string;
    category: string | null;
    core_activities: string[];
    confirmed_steps: string[];
    case_ids: string[];
    exclude: string[];
    // shown: 화면에 보임(추천) · held: 관리자가 보류. 예전 'confirmed' 는 추천으로 본다
    status: 'shown' | 'confirmed' | 'held';
    decided_at: string | null;
    created_at?: string;
}

export interface TalkRow {
    id?: string;
    process_key: string;
    role: 'admin' | 'assistant';
    text: string;
    change?: FeedbackChange | null;
    applied?: boolean;
    created_at?: string;
}

const sb = () => (window as any).$supabase;
const uniq = (xs: string[]) => Array.from(new Set(xs.filter(Boolean)));

export async function loadCategories(): Promise<Record<string, CaseCategory>> {
    const out: Record<string, CaseCategory> = {};
    const { data, error } = await sb().from('handover_case_categories').select('case_id, category, category_by, request');
    if (error) throw new Error(`범주 조회 실패: ${error.message}`);
    for (const r of data || []) out[r.case_id] = r;
    return out;
}

/** 판단한 범주를 저장한다. 이미 있는 사례(특히 관리자가 정한 것)는 덮지 않는다. */
export async function saveJudged(rows: CaseCategory[]) {
    if (!rows.length) return;
    const { error } = await sb().from('handover_case_categories').upsert(rows, { onConflict: 'tenant_id,case_id', ignoreDuplicates: true });
    if (error) throw new Error(`범주 저장 실패: ${error.message}`);
}

/** 관리자가 정한 범주 — 다시 판단하지 않고, 다음 판단의 예시가 된다. */
export async function setAdminCategory(caseId: string, category: string, request?: string | null) {
    const { error } = await sb()
        .from('handover_case_categories')
        .upsert({ case_id: caseId, category, category_by: 'admin', ...(request ? { request } : {}) }, { onConflict: 'tenant_id,case_id' });
    if (error) throw new Error(`범주 저장 실패: ${error.message}`);
}

/** 결정 순서: 화면에 처음 보인 순(같은 범주 업무끼리 새 건을 다툴 때 먼저 보인 쪽). */
export async function loadDecisions(): Promise<Decision[]> {
    const { data, error } = await sb().from('handover_process_decisions').select('*');
    if (error) throw new Error(`결정 조회 실패: ${error.message}`);
    const rows: Decision[] = data || [];
    return rows.sort(
        (a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')) || a.process_key.localeCompare(b.process_key)
    );
}

export function toDecided(decisions: Decision[]): DecidedProcess[] {
    return decisions.map((d) => ({
        key: d.process_key,
        category: d.category,
        core_activities: d.core_activities || [],
        case_ids: d.case_ids || [],
        exclude: d.exclude || []
    }));
}

/** 화면에 처음 보인 묶음을 경계로 남긴다. 그래야 새 사례로 묶음 id 가 바뀌지 않는다. */
export async function rememberShown(groups: MinedProcessGroup[], decisions: Decision[]) {
    const known = new Set(decisions.map((d) => d.process_key));
    const rows = groups
        .filter((g) => !known.has(g.process_key))
        .map((g) => ({
            process_key: g.process_key,
            category: g.category || null,
            core_activities: g.core_activities || [],
            case_ids: g.cases || [],
            exclude: [],
            status: 'shown'
        }));
    if (!rows.length) return false;
    const { error } = await sb()
        .from('handover_process_decisions')
        .upsert(rows, { onConflict: 'tenant_id,process_key', ignoreDuplicates: true });
    if (error) throw new Error(`결정 저장 실패: ${error.message}`);
    return true;
}

/** 보류하거나(held) 추천으로 되돌린다(shown). 보류한 업무는 목록 끝으로 가고, 새 건은 계속 제안으로 기다린다. */
export async function setHold(group: MinedProcessGroup, decisions: Decision[], held: boolean) {
    const d = decisions.find((x) => x.process_key === group.process_key);
    const base: Decision = d
        ? { ...d }
        : {
              process_key: group.process_key,
              category: group.category || null,
              core_activities: group.core_activities || [],
              confirmed_steps: [],
              case_ids: group.cases || [],
              exclude: [],
              status: 'shown',
              decided_at: null
          };
    base.status = held ? 'held' : 'shown';
    base.decided_at = new Date().toISOString();
    await saveDecision(base);
}

async function saveDecision(d: Decision) {
    const { error } = await sb()
        .from('handover_process_decisions')
        .upsert(
            {
                process_key: d.process_key,
                category: d.category,
                core_activities: uniq(d.core_activities),
                confirmed_steps: uniq(d.confirmed_steps || []),
                case_ids: uniq(d.case_ids),
                exclude: uniq(d.exclude),
                status: d.status,
                decided_at: d.decided_at,
                decided_by: localStorage.getItem('uid') || null
            },
            { onConflict: 'tenant_id,process_key' }
        );
    if (error) throw new Error(`결정 저장 실패: ${error.message}`);
}

/**
 * 관리자가 적용을 누른 change 를 저장한다.
 * group 은 대화한 묶음, decisions 는 저장된 결정(모든 묶음), requests 는 사례 → 처음 요청(관리자 예시용).
 */
export async function applyChange(
    change: FeedbackChange,
    group: MinedProcessGroup,
    decisions: Decision[],
    requests: Record<string, string> = {}
) {
    const now = new Date().toISOString();
    const byKey: Record<string, Decision> = {};
    for (const d of decisions) byKey[d.process_key] = { ...d, case_ids: [...(d.case_ids || [])], exclude: [...(d.exclude || [])] };
    const mine: Decision = byKey[group.process_key] || {
        process_key: group.process_key,
        category: group.category || null,
        core_activities: group.core_activities || [],
        confirmed_steps: [],
        case_ids: group.cases || [],
        exclude: [],
        status: 'shown',
        decided_at: null
    };
    byKey[group.process_key] = mine;
    const touched = new Set<string>([group.process_key]);

    for (const s of change.steps || []) {
        mine.core_activities =
            s.kind === 'required' ? uniq([...mine.core_activities, s.step]) : mine.core_activities.filter((a) => a !== s.step);
        mine.confirmed_steps = uniq([...(mine.confirmed_steps || []), s.step]);
        mine.decided_at = mine.decided_at || now;
    }
    if (change.proposal === 'accept') mine.case_ids = uniq([...mine.case_ids, ...(group.new_case_ids || [])]);
    if (change.proposal === 'reject') mine.exclude = uniq([...mine.exclude, ...(group.new_case_ids || [])]);

    for (const m of change.moves || []) {
        // 어느 묶음에서든 그 사례를 뺀다
        for (const d of Object.values(byKey)) {
            if (d.case_ids.includes(m.case_id)) {
                d.case_ids = d.case_ids.filter((c) => c !== m.case_id);
                touched.add(d.process_key);
            }
        }
        if (m.to === 'out') {
            mine.exclude = uniq([...mine.exclude, m.case_id]);
            if (m.category) await setAdminCategory(m.case_id, m.category, requests[m.case_id]);
        } else if (m.to) {
            const target = byKey[m.to];
            if (target) {
                target.case_ids = uniq([...target.case_ids, m.case_id]);
                target.exclude = target.exclude.filter((c) => c !== m.case_id);
                touched.add(target.process_key);
                if (m.to !== group.process_key) mine.exclude = uniq([...mine.exclude, m.case_id]);
                if (target.category) await setAdminCategory(m.case_id, target.category, requests[m.case_id]);
            }
        } else if (m.category) {
            await setAdminCategory(m.case_id, m.category, requests[m.case_id]);
        }
    }
    // 확인 필요(업무가 아닌 목록)에서 한 대화는 그 자리를 결정으로 남기지 않는다
    for (const k of touched) if (k !== '__unclassified') await saveDecision(byKey[k]);
}

/** 바뀐 내용을 정해진 문장으로 — 모델의 말로 쓰지 않는다. */
export function describeChange(
    change: FeedbackChange,
    group: MinedProcessGroup,
    names: Record<string, string>,
    label: (id: string) => string
) {
    const out: string[] = [];
    for (const s of change.steps || []) out.push(`'${s.step}' 단계를 ${s.kind === 'required' ? '필수' : '옵션'}로 확정합니다`);
    for (const m of change.moves || []) {
        if (m.to === 'out') out.push(`'${label(m.case_id)}' 건을 이 업무에서 뺍니다${m.category ? ` (범주: ${m.category})` : ''}`);
        else if (m.to) out.push(`'${label(m.case_id)}' 건을 '${names[m.to] || m.to}' 업무로 옮깁니다`);
        else if (m.category) out.push(`'${label(m.case_id)}' 건의 업무 범주를 '${m.category}'로 정합니다`);
    }
    // 지난 대화는 지금 건수가 아니라 그때의 결정이므로, 건수가 없으면 수를 쓰지 않는다
    const n = (group.new_case_ids || []).length;
    if (change.proposal === 'accept') out.push(`새로 들어온 ${n ? `${n}건을` : '건을'} 이 업무에 넣습니다`);
    if (change.proposal === 'reject') out.push(`새로 들어온 ${n ? `${n}건은` : '건은'} 이 업무가 아닙니다`);
    return out;
}

export async function loadTalk(processKey: string): Promise<TalkRow[]> {
    const { data, error } = await sb()
        .from('handover_identification_talk')
        .select('id, process_key, role, text, change, applied, created_at')
        .eq('process_key', processKey)
        .order('created_at', { ascending: true });
    if (error) throw new Error(`대화 조회 실패: ${error.message}`);
    return data || [];
}

export async function addTalk(row: TalkRow): Promise<TalkRow> {
    const { data, error } = await sb()
        .from('handover_identification_talk')
        .insert({ ...row, user_id: localStorage.getItem('uid') || null })
        .select('id, process_key, role, text, change, applied, created_at')
        .single();
    if (error) throw new Error(`대화 저장 실패: ${error.message}`);
    return data;
}

export async function markApplied(id: string) {
    const { error } = await sb().from('handover_identification_talk').update({ applied: true }).eq('id', id);
    if (error) throw new Error(`대화 저장 실패: ${error.message}`);
}

/** 처음 요청한 대화 — 그 방의 첫 사용자 메시지. 업무 범주 판단의 근거다. */
export async function firstRequests(roomIds: string[]): Promise<Record<string, string>> {
    const out: Record<string, string> = {};
    const first: Record<string, string> = {};
    for (let i = 0; i < roomIds.length; i += 50) {
        const { data } = await sb()
            .from('chats')
            .select('id, messages')
            .in('id', roomIds.slice(i, i + 50));
        for (const r of data || []) {
            const m = r.messages || {};
            if (m.role !== 'user' || !m.content) continue;
            const at = String(m.timeStamp || '');
            if (!(r.id in first) || at < first[r.id]) {
                first[r.id] = at;
                out[r.id] = String(m.content).slice(0, 600);
            }
        }
    }
    return out;
}

export type { UnclassifiedCase };
