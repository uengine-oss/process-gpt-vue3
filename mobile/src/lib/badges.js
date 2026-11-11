/**
 * 아래 탭의 숫자(할 일 · 알림).
 *
 * 여러 화면이 같은 값을 본다 — 탭 줄, 할 일 첫 화면 제목, 알림 목록. 한 곳에 두고
 * 화면을 옮길 때와 알림이 새로 올 때 다시 센다. 실패하면 숫자만 그대로 둔다(화면은 쓸 수 있다).
 */

import { reactive } from 'vue';

import { countMyTurn } from './data.js';
import { countUnread, recipientIds } from './notifications.js';

export const badges = reactive({ tasks: 0, notifications: 0 });

let channel = null;
let pending = null;

function me() {
    const store = globalThis.localStorage;
    return {
        uid: store?.getItem('uid') || '',
        email: store?.getItem('email') || '',
        tenant: globalThis.$tenantName || null
    };
}

/** 다시 센다. 짧은 사이에 여러 번 불려도 한 번만 묻는다. */
export function refreshBadges() {
    if (pending) return pending;
    pending = (async () => {
        const supabase = globalThis.$supabase;
        const who = me();
        if (!supabase || !who.uid) return;
        const [tasks, unread] = await Promise.all([
            countMyTurn(supabase, who).catch(() => badges.tasks),
            countUnread(supabase, recipientIds(who)).catch(() => badges.notifications)
        ]);
        badges.tasks = tasks;
        badges.notifications = unread;
    })().finally(() => {
        pending = null;
    });
    return pending;
}

let timer = null;

/** 바뀐 것이 몰려 와도 잠시 기다렸다 한 번만 센다. */
function soon() {
    if (timer) return;
    timer = setTimeout(() => {
        timer = null;
        void refreshBadges();
    }, 1500);
}

/** 알림 · 할 일이 새로 오면 다시 센다(실시간). 한 번만 붙인다. */
export function watchBadges() {
    const supabase = globalThis.$supabase;
    if (!supabase || channel) return;
    channel = supabase
        .channel('m-badges')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, soon)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'todolist' }, soon)
        .subscribe();
}

export function stopBadges() {
    if (channel && globalThis.$supabase) globalThis.$supabase.removeChannel(channel);
    channel = null;
}
