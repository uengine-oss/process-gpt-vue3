/**
 * 알림 목록.
 *
 * 포털과 같은 notifications 표를 읽는다(포털 백엔드의 fetchNotifications 는 안 읽은 것만 주므로
 * 목록은 여기서 직접 읽는다). 받는 사람(user_id)은 예전 행은 이메일, 지금 행은 사용자 id 라 둘 다 본다.
 * 알림 주소(/todolist/<id> 등)를 휴대폰 화면으로 바꾸는 규칙은 앱이 이미 쓰는 routeForUrl 하나다.
 */

import { routeForUrl } from './native.js';

export const KINDS = [
    { value: 'all', label: '전체' },
    { value: 'turn', label: '내 차례' },
    { value: 'result', label: '결과' },
    { value: 'agent', label: '에이전트' }
];

/** 알림의 갈래: turn(새 할 일) · agent(에이전트) · chat(대화) · result(그 밖의 결과) */
export function kindOf(n) {
    const type = String(n?.type || '').toLowerCase();
    const text = `${n?.title || ''} ${n?.description || ''}`;
    if (type.includes('agent') || /에이전트|초안/.test(text)) return 'agent';
    if (type.startsWith('workitem') || type.includes('todo')) return 'turn';
    if (type.includes('chat') || type.includes('mention')) return 'chat';
    return 'result';
}

export function matchesKind(n, kind) {
    if (!kind || kind === 'all') return true;
    return kindOf(n) === kind;
}

/** 첫 줄 */
export function titleOf(n) {
    const title = String(n?.title || '').trim() || '알림';
    return kindOf(n) === 'turn' ? `새 할 일: ${title}` : title;
}

/** 둘째 줄 — 제목과 같으면 비운다 */
export function subtitleOf(n) {
    const d = String(n?.description || '').trim();
    return d && d !== String(n?.title || '').trim() ? d : '';
}

/** 눌렀을 때 갈 곳. 모르면 null(목록에 그대로) */
export function routeOf(n) {
    return routeForUrl(n?.url);
}

function startOfDay(ms) {
    const d = new Date(ms);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
}

/** 오늘 · 어제 · M월 D일 */
export function dayLabel(at, now = Date.now()) {
    const t = new Date(at || 0).getTime();
    if (!Number.isFinite(t) || t <= 0) return '이전';
    const days = Math.round((startOfDay(now) - startOfDay(t)) / 86400000);
    if (days <= 0) return '오늘';
    if (days === 1) return '어제';
    const d = new Date(t);
    return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/** HH:MM */
export function timeLabel(at) {
    const d = new Date(at || 0);
    if (Number.isNaN(d.getTime())) return '';
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** 같은 곳(url)을 가리키는 알림은 가장 최근 것 하나로 — 포털 종 모양과 같다. 안 읽은 것이 하나라도 있으면 안 읽음. */
export function dedupe(list) {
    const byKey = new Map();
    for (const n of Array.isArray(list) ? list : []) {
        const key = n?.url || n?.id;
        const prev = byKey.get(key);
        if (!prev) {
            byKey.set(key, { ...n, count: 1, ids: [n.id] });
            continue;
        }
        const newer = new Date(n.time_stamp || 0) > new Date(prev.time_stamp || 0);
        const merged = newer ? { ...n } : { ...prev };
        merged.count = prev.count + 1;
        merged.ids = [...prev.ids, n.id];
        merged.is_checked = prev.is_checked && n.is_checked;
        byKey.set(key, merged);
    }
    return [...byKey.values()].sort((a, b) => new Date(b.time_stamp || 0) - new Date(a.time_stamp || 0));
}

/** [{ label: '오늘', items: [...] }, …] */
export function groupByDay(list, now = Date.now()) {
    const groups = [];
    for (const n of Array.isArray(list) ? list : []) {
        const label = dayLabel(n.time_stamp, now);
        const last = groups[groups.length - 1];
        if (last && last.label === label) last.items.push(n);
        else groups.push({ label, items: [n] });
    }
    return groups;
}

export function unreadCount(list) {
    return (Array.isArray(list) ? list : []).filter((n) => !n.is_checked).length;
}

/** 받는 사람 키 — 이메일과 사용자 id */
export function recipientIds({ email, uid } = {}) {
    return [email, uid].map((v) => (v || '').toString().trim()).filter(Boolean);
}

// --- 읽기 · 쓰기 --------------------------------------------------------------

export async function listNotifications(supabase, ids, { limit = 80 } = {}) {
    if (!supabase || !ids?.length) return [];
    const { data, error } = await supabase
        .from('notifications')
        .select('id, title, description, type, url, is_checked, time_stamp, from_user_id, user_id')
        .in('user_id', ids)
        .order('time_stamp', { ascending: false })
        .limit(limit);
    if (error) throw error;
    return data || [];
}

/** 안 읽은 알림 수(같은 곳을 가리키는 것은 하나로) */
export async function countUnread(supabase, ids) {
    if (!supabase || !ids?.length) return 0;
    const { data, error } = await supabase
        .from('notifications')
        .select('id, url')
        .in('user_id', ids)
        .eq('is_checked', false)
        .limit(200);
    if (error) return 0;
    return new Set((data || []).map((n) => n.url || n.id)).size;
}

/** 이 알림(같은 곳을 가리키는 것 모두)을 읽음으로 */
export async function markRead(supabase, n) {
    const ids = (n?.ids || [n?.id]).filter(Boolean);
    if (!supabase || !ids.length) return;
    await supabase.from('notifications').update({ is_checked: true }).in('id', ids);
}

export async function markAllRead(supabase, ids) {
    if (!supabase || !ids?.length) return;
    await supabase.from('notifications').update({ is_checked: true }).in('user_id', ids).eq('is_checked', false);
}
