/**
 * 할 일 · 진행 화면이 읽는 행들.
 *
 * 포털 데이터 계층(ProcessGPTBackend)은 한 번에 한 건씩 읽는 길이 많아, 첫 화면에 필요한
 * 여러 건(내 업무 · 그 건들의 모든 단계 · 건 이름 · 프로세스 이름 · 승인 폼)을 몇 번의 묶음 조회로 읽는다.
 * 같은 표 · 같은 조직 조건(tenant_id)을 쓴다. 쓰기는 하지 않는다.
 */

import { decisionFields } from '../../../src/shared/decisionField/index.js';
import { SIMPLE_INBOX_ACTIONABLE_STATUSES } from '../../../src/shared/simpleInstanceInbox.js';
import { formIdOf } from './outputs.js';

/**
 * 서버에 물을 때 쓰는 「지금 손댈 수 있는」 상태 — todolist.status 는 enum(todo_status)이라
 * 그 안에 없는 값(DRAFT · RUNNING …)을 섞으면 질의 전체가 400 이 된다. 화면 쪽 판정은
 * SIMPLE_INBOX_ACTIONABLE_STATUSES 로 그대로 한다.
 */
export const ACTIONABLE_DB_STATUSES = ['IN_PROGRESS', 'SUBMITTED', 'PENDING', 'NEW'];

/** 목록에 쓰는 열 — 초안(draft)은 크고 목록에는 필요 없어 뺀다 */
export const ROW_COLUMNS =
    'id, user_id, username, proc_inst_id, proc_def_id, activity_id, activity_name, status, start_date, end_date, ' +
    'actual_start_date, updated_at, due_date, tool, output, agent_mode, agent_orch, draft_status, description, gateway_decisions';

function scoped(query, tenant) {
    return tenant ? query.eq('tenant_id', tenant) : query;
}

function unique(list) {
    return [...new Set((list || []).filter(Boolean))];
}

async function rowsOfInstances(supabase, tenant, instIds) {
    if (!instIds.length) return [];
    const { data, error } = await scoped(supabase.from('todolist').select(ROW_COLUMNS).in('proc_inst_id', instIds), tenant);
    if (error) throw error;
    return data || [];
}

async function instancesById(supabase, tenant, instIds) {
    if (!instIds.length) return {};
    const { data, error } = await scoped(
        supabase
            .from('bpm_proc_inst')
            .select('proc_inst_id, proc_inst_name, proc_def_id, status, start_date, end_date, due_date, participants')
            .in('proc_inst_id', instIds),
        tenant
    );
    if (error) throw error;
    return Object.fromEntries((data || []).map((i) => [i.proc_inst_id, i]));
}

/** { 프로세스 정의 id: 이름 } — 카드에 정의 id(UUID)가 그대로 보이던 것을 이름으로 */
export async function processNames(supabase, tenant, defIds) {
    const ids = unique(defIds);
    if (!ids.length) return {};
    const { data } = await scoped(supabase.from('proc_def').select('id, name').in('id', ids), tenant);
    return Object.fromEntries((data || []).map((d) => [d.id, d.name || '']));
}

/** 결정 칸(승인 · 반려)이 있는 폼 id */
export async function decisionFormIds(supabase, tenant, formIds) {
    const ids = unique(formIds);
    if (!ids.length) return new Set();
    const { data } = await scoped(supabase.from('form_def').select('id, html').in('id', ids), tenant);
    return new Set((data || []).filter((f) => decisionFields(f.html).length > 0).map((f) => f.id));
}

/** 할 일 첫 화면에 필요한 것 */
export async function loadHome(supabase, { uid, tenant }) {
    if (!supabase || !uid) return null;
    const { data: rows, error } = await scoped(
        supabase.from('todolist').select(ROW_COLUMNS).ilike('user_id', `%${uid}%`).order('updated_at', { ascending: false }).limit(200),
        tenant
    );
    if (error) throw error;
    const mine = rows || [];
    const openIds = unique(mine.filter((r) => SIMPLE_INBOX_ACTIONABLE_STATUSES.has(r.status)).map((r) => r.proc_inst_id));
    const recentIds = unique(mine.map((r) => r.proc_inst_id)).slice(0, 60);
    const instances = await instancesById(supabase, tenant, unique([...openIds, ...recentIds]));
    const runningIds = Object.values(instances)
        .filter((i) => String(i.status || '').toUpperCase() === 'RUNNING')
        .map((i) => i.proc_inst_id);
    const instRows = await rowsOfInstances(supabase, tenant, unique([...openIds, ...runningIds]));
    const defNames = await processNames(supabase, tenant, [...mine, ...instRows].map((r) => r.proc_def_id));
    const forms = await decisionFormIds(
        supabase,
        tenant,
        mine.filter((r) => SIMPLE_INBOX_ACTIONABLE_STATUSES.has(r.status)).map(formIdOf)
    );
    return { rows: mine, instRows, instances, defNames, decisionFormIds: forms };
}

/** 진행 — 내가 참여한 건들(최근 순) */
export async function loadProgress(supabase, { uid, tenant, limit = 40 }) {
    if (!supabase || !uid) return null;
    const { data, error } = await scoped(
        supabase
            .from('bpm_proc_inst')
            .select('proc_inst_id, proc_inst_name, proc_def_id, status, start_date, end_date, due_date, participants')
            .contains('participants', [uid])
            .eq('is_deleted', false)
            .order('start_date', { ascending: false })
            .limit(limit),
        tenant
    );
    if (error) throw error;
    const list = data || [];
    const instRows = await rowsOfInstances(supabase, tenant, list.map((i) => i.proc_inst_id));
    const defNames = await processNames(supabase, tenant, list.map((i) => i.proc_def_id));
    return { instances: list, instRows, defNames };
}

/** 한 건 — 타임라인 */
export async function loadInstance(supabase, { instId, tenant }) {
    const instances = await instancesById(supabase, tenant, [instId]);
    const rows = await rowsOfInstances(supabase, tenant, [instId]);
    const inst = instances[instId] || null;
    const defId = inst?.proc_def_id || rows[0]?.proc_def_id;
    const defNames = await processNames(supabase, tenant, [defId]);
    return { inst, rows, processName: defNames[defId] || '' };
}

/** 할 일 탭의 숫자 — 지금 내 차례(에이전트에 맡기지 않은 것) */
export async function countMyTurn(supabase, { uid, tenant }) {
    if (!supabase || !uid) return 0;
    const { count, error } = await scoped(
        supabase
            .from('todolist')
            .select('id', { count: 'exact', head: true })
            .ilike('user_id', `%${uid}%`)
            .in('status', ACTIONABLE_DB_STATUSES)
            .is('agent_orch', null),
        tenant
    );
    return error ? 0 : count || 0;
}
