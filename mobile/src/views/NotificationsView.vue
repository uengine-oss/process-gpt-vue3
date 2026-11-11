<template>
    <div class="m-screen">
        <header class="m-head">
            <h1>알림</h1>
            <button type="button" class="readall" :disabled="!unread || marking" @click="readAll">모두 읽음</button>
        </header>
        <div class="m-body notes">
            <div class="m-chips" role="tablist" aria-label="알림 갈래">
                <button
                    v-for="k in KINDS"
                    :key="k.value"
                    type="button"
                    role="tab"
                    class="m-chip"
                    :class="{ 'm-chip--on': kind === k.value }"
                    :aria-selected="kind === k.value"
                    @click="kind = k.value"
                >
                    {{ k.label }}
                </button>
            </div>

            <p v-if="error" class="m-note m-note--danger">{{ error }}</p>
            <p v-if="loading && !list.length" class="m-muted">불러오는 중…</p>

            <template v-for="g in groups" :key="g.label">
                <h2 class="m-section"><span>{{ g.label }}</span></h2>
                <article
                    v-for="n in g.items"
                    :key="n.id"
                    class="m-card m-card--lg note"
                    :class="{ 'note--unread': !n.is_checked }"
                >
                    <span class="note__icon" :class="`note__icon--${kindOf(n)}`" aria-hidden="true">
                        <Icon :name="iconOf(n)" />
                    </span>
                    <div class="note__body">
                        <strong>{{ titleOf(n) }}</strong>
                        <span v-if="subtitleOf(n)" class="m-muted">{{ subtitleOf(n) }}</span>
                        <div class="note__foot">
                            <span class="m-muted">{{ timeLabel(n.time_stamp) }}<template v-if="n.count > 1"> · {{ n.count }}건</template></span>
                            <button
                                v-if="routeOf(n)"
                                type="button"
                                class="m-btn note__open"
                                :class="kindOf(n) === 'agent' ? 'note__open--soft' : 'm-btn--primary'"
                                @click="openNote(n)"
                            >
                                {{ kindOf(n) === 'agent' ? '확인' : '열기' }}
                            </button>
                        </div>
                    </div>
                    <span v-if="!n.is_checked" class="note__dot" aria-label="안 읽음"></span>
                </article>
            </template>

            <div v-if="!loading && !groups.length" class="m-empty"><p>알림이 없습니다.</p></div>

            <p class="m-note hint">
                <Icon name="bell" :size="18" />
                <span>{{ pushHint }}</span>
            </p>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import Icon from '../components/Icon.vue';
import { refreshBadges } from '../lib/badges.js';
import { isNativeApp } from '../lib/native.js';
import {
    KINDS,
    dedupe,
    groupByDay,
    kindOf,
    listNotifications,
    markAllRead,
    markRead,
    matchesKind,
    recipientIds,
    routeOf,
    subtitleOf,
    timeLabel,
    titleOf,
    unreadCount
} from '../lib/notifications.js';

/**
 * 알림 — 배정 · 반려 · 승인 · 에이전트 완료를 알리고, 알림에서 바로 그 업무를 연다.
 *
 * 포털 종 모양과 같은 표(notifications)다. 같은 업무를 가리키는 알림은 하나로 묶는다.
 * 열면 그 알림(같은 곳 모두)을 읽음으로 바꾼다.
 */

const router = useRouter();
const loading = ref(true);
const error = ref('');
const marking = ref(false);
const raw = ref<any[]>([]);
const kind = ref('all');

const ids = () => recipientIds({ email: localStorage.getItem('email') || '', uid: localStorage.getItem('uid') || '' });

const list = computed(() => dedupe(raw.value));
const unread = computed(() => unreadCount(list.value));
const groups = computed(() => groupByDay(list.value.filter((n: any) => matchesKind(n, kind.value))));
const pushHint = computed(() =>
    isNativeApp()
        ? '휴대폰 알림을 켜 두면 내 차례 · 반려 · 승인 · 에이전트 완료를 바로 알려 드립니다.'
        : '브라우저에서는 이 목록으로 알려 드립니다. 휴대폰 알림(푸시)은 앱으로 설치하면 받을 수 있습니다.'
);

const ICONS: Record<string, string> = { turn: 'checkbox', agent: 'robot', chat: 'message', result: 'progress' };
function iconOf(n: any) {
    return ICONS[kindOf(n)] || 'bell';
}

async function load() {
    loading.value = true;
    error.value = '';
    try {
        raw.value = await listNotifications((window as any).$supabase, ids());
    } catch (e) {
        console.error('[notifications] 조회 실패', e);
        error.value = '알림을 불러오지 못했습니다.';
    } finally {
        loading.value = false;
    }
}

async function openNote(n: any) {
    const to = routeOf(n);
    try {
        if (!n.is_checked) await markRead((window as any).$supabase, n);
    } catch (e) {
        console.warn('[notifications] 읽음 처리 실패', e);
    }
    void refreshBadges();
    if (to) await router.push(to);
}

async function readAll() {
    marking.value = true;
    try {
        await markAllRead((window as any).$supabase, ids());
        raw.value = raw.value.map((n: any) => ({ ...n, is_checked: true }));
        void refreshBadges();
    } catch (e) {
        console.error('[notifications] 모두 읽음 실패', e);
        error.value = '읽음으로 바꾸지 못했습니다.';
    } finally {
        marking.value = false;
    }
}

// 새 알림이 오면 목록을 다시 읽는다
let channel: any = null;
onMounted(() => {
    void load();
    const supabase = (window as any).$supabase;
    if (supabase) {
        channel = supabase
            .channel('m-notifications-list')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (p: any) => {
                if (ids().includes(p.new?.user_id)) void load();
            })
            .subscribe();
    }
});
onUnmounted(() => {
    try {
        if (channel) (window as any).$supabase?.removeChannel(channel);
    } catch (_e) {
        // 이미 끊겼다
    }
});
</script>

<style scoped>
.readall {
    color: var(--brand);
    font-weight: 700;
    min-height: var(--tap);
    padding: 0 4px;
}

.readall:disabled {
    color: var(--ink-faint);
}

.notes {
    padding: 4px 16px 16px;
}

.note {
    position: relative;
    flex-direction: row;
    align-items: flex-start;
    gap: 12px;
}

.note--unread {
    border-color: color-mix(in srgb, var(--brand) 30%, var(--rule));
    background: color-mix(in srgb, var(--brand-wash) 35%, var(--surface));
}

.note__icon {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    flex: none;
    background: var(--brand-wash);
    color: var(--brand);
}

.note__icon--agent {
    background: var(--agent-wash);
    color: var(--agent);
}

.note__icon--result {
    background: var(--sunk);
    color: var(--ink-soft);
}

.note__body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding-right: 10px;
}

.note__foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-top: 6px;
}

.note__open {
    min-height: 38px;
    padding: 0 16px;
    border-radius: 12px;
}

.note__open--soft {
    background: var(--brand-wash);
    color: var(--brand);
    border-color: transparent;
}

.note__dot {
    position: absolute;
    top: 16px;
    right: 14px;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--brand);
}

.hint {
    display: flex;
    gap: 8px;
    align-items: flex-start;
}
</style>
