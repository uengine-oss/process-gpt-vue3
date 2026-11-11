<template>
    <div class="m-screen">
        <div class="m-body home">
            <div class="home__top">
                <span class="home__date">{{ today }}</span>
                <button type="button" class="m-head__icon" aria-label="찾기" @click="toggleSearch">
                    <Icon name="search" />
                </button>
                <button type="button" class="m-btn m-btn--primary home__new" @click="router.push('/start')">
                    <Icon name="plus" :size="20" /> 새 요청
                </button>
            </div>

            <h1 class="home__title">{{ greeting }}</h1>

            <div class="m-chips" role="tablist" aria-label="할 일 보기">
                <button
                    v-for="opt in filters"
                    :key="opt.value"
                    type="button"
                    role="tab"
                    class="m-chip"
                    :class="{ 'm-chip--on': filter === opt.value }"
                    :aria-selected="filter === opt.value"
                    @click="filter = opt.value"
                >
                    {{ opt.label }} <strong>{{ opt.count }}</strong>
                </button>
            </div>

            <div v-if="searching" class="m-field">
                <input v-model="query" type="search" placeholder="업무 · 건 이름으로 찾기" aria-label="찾기" />
            </div>

            <p v-if="error" class="m-note m-note--danger">{{ error }}</p>
            <p v-if="notice" class="m-note">{{ notice }}</p>
            <p v-if="loading && !model" class="m-muted">불러오는 중…</p>

            <template v-if="model">
                <!-- 내 차례 · 승인 대기 -->
                <template v-if="filter !== 'delegated'">
                    <article v-for="card in shownCards" :key="card.id" class="m-card m-card--lg tcard">
                        <span v-if="card.badge === 'rejected'" class="m-tag m-tag--danger">반려됨 · 다시 써 주세요</span>
                        <span v-else-if="card.badge === 'approval'" class="m-tag m-tag--brand">승인 요청</span>
                        <span v-else-if="card.badge === 'new'" class="m-tag m-tag--brand">새 업무</span>
                        <button type="button" class="tcard__main" @click="open(card)">
                            <strong class="tcard__title">{{ card.title }}</strong>
                            <span v-if="contextOf(card)" class="tcard__sub">{{ contextOf(card) }}</span>
                        </button>
                        <p v-if="card.rejection" class="tcard__reject">
                            {{ card.rejection.who ? `${card.rejection.who}: ` : '' }}{{ card.rejection.comment || '반려되었습니다.' }}
                        </p>
                        <div class="tcard__foot">
                            <span class="tcard__meta" :class="{ late: card.overdue }">{{ metaOf(card) }}</span>
                            <button
                                v-if="!card.approval"
                                type="button"
                                class="m-btn m-btn--agent tcard__btn"
                                :disabled="busyId === card.id"
                                @click="delegateCard(card)"
                            >
                                <span v-if="busyId === card.id" class="m-spin" aria-hidden="true"></span>
                                <Icon v-else name="robot" :size="20" />
                                맡기기
                            </button>
                            <button type="button" class="m-btn m-btn--primary tcard__btn" @click="open(card)">열기</button>
                        </div>
                    </article>
                    <div v-if="!shownCards.length" class="m-empty home__empty">
                        <p>{{ filter === 'approval' ? '승인할 일이 없습니다.' : '지금 처리할 일이 없습니다.' }}</p>
                    </div>
                </template>

                <!-- 에이전트에 맡긴 일 -->
                <template v-if="shownDelegated.length || filter === 'delegated'">
                    <h2 class="m-section"><span>에이전트에 맡긴 일</span></h2>
                    <button
                        v-for="d in shownDelegated"
                        :key="d.id"
                        type="button"
                        class="m-card m-card--lg row"
                        @click="open(d)"
                    >
                        <span class="row__icon row__icon--agent"><Icon name="robot" /></span>
                        <span class="row__body">
                            <strong>{{ d.title }}</strong>
                            <span class="m-muted">{{ [d.subject, d.text].filter(Boolean).join(' · ') }}</span>
                        </span>
                        <span v-if="d.state === 'draft-ready'" class="m-tag m-tag--agent">확인</span>
                        <span v-else-if="d.state === 'running'" class="m-spin row__spin" aria-label="쓰는 중"></span>
                        <span v-else class="m-tag m-tag--danger">실패</span>
                    </button>
                    <p v-if="filter === 'delegated' && !shownDelegated.length" class="m-muted">맡긴 일이 없습니다.</p>
                </template>

                <!-- 내가 올린 요청 -->
                <template v-if="filter !== 'delegated' && model.requests.length">
                    <h2 class="m-section">
                        <span>내가 올린 요청</span>
                        <RouterLink to="/progress">모두 보기</RouterLink>
                    </h2>
                    <button
                        v-for="r in model.requests.slice(0, 3)"
                        :key="r.instId"
                        type="button"
                        class="m-card m-card--lg row"
                        @click="router.push(`/instances/${encodeURIComponent(r.instId)}`)"
                    >
                        <span class="row__icon"><Icon name="progress" /></span>
                        <span class="row__body">
                            <strong>{{ r.subject }}</strong>
                            <span class="m-muted">
                                <template v-if="r.progress.current">지금 {{ r.progress.current.name }} · </template>{{ r.progress.no }}/{{ r.progress.total }}단계
                            </span>
                            <span class="bar" role="img" :aria-label="`${r.progress.percent}퍼센트 진행`">
                                <span class="bar__fill" :style="{ width: r.progress.percent + '%' }"></span>
                            </span>
                        </span>
                        <Icon name="chevron-right" class="row__go" />
                    </button>
                </template>
            </template>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';

import Icon from '../components/Icon.vue';
import { badges, refreshBadges } from '../lib/badges.js';
import { backend } from '../lib/backend.js';
import { loadHome } from '../lib/data.js';
import { delegate } from '../lib/delegation.js';
import { homeModel } from '../lib/workspace.js';

/**
 * 할 일 — 첫 화면.
 *
 * 열자마자 내 차례 건수와 카드. 반려된 건은 카드에서 바로 반려 사유를 보고,
 * 단추는 「맡기기」 · 「열기」 둘만 둔다. 새 요청은 오른쪽 위.
 * 에이전트에 맡긴 일은 따로 모아 「초안 준비됨」 을 바로 알 수 있게 한다.
 */

const route = useRoute();
const router = useRouter();

const data = ref<any>(null);
const loading = ref(true);
const error = ref('');
const notice = ref('');
const busyId = ref('');
const searching = ref(false);
const query = ref('');
const filter = ref<'turn' | 'approval' | 'delegated'>(
    route.query.view === 'delegated' ? 'delegated' : route.query.view === 'approval' ? 'approval' : 'turn'
);

const uid = () => localStorage.getItem('uid') || '';

const model = computed(() =>
    data.value ? homeModel({ ...data.value, uid: uid(), now: Date.now() }) : null
);

const filters = computed(() => [
    { value: 'turn' as const, label: '내 차례', count: model.value?.turn.length ?? 0 },
    { value: 'approval' as const, label: '승인 대기', count: model.value?.approvals.length ?? 0 },
    { value: 'delegated' as const, label: '맡긴 일', count: model.value?.delegated.length ?? 0 }
]);

const today = computed(() => {
    const d = new Date();
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return `${d.getMonth() + 1}월 ${d.getDate()}일 ${days[d.getDay()]}요일`;
});

const greeting = computed(() => {
    const name = (localStorage.getItem('userName') || '').trim();
    const n = model.value?.turn.length ?? 0;
    return `${name ? `${name}님, ` : ''}처리할 일 ${n}건`;
});

function matches(card: any) {
    const q = query.value.trim();
    if (!q) return true;
    return [card.title, card.subject, card.process].some((t) => (t || '').includes(q));
}

const shownCards = computed(() => {
    const list = filter.value === 'approval' ? model.value?.approvals || [] : model.value?.turn || [];
    return list.filter(matches);
});

const shownDelegated = computed(() => (model.value?.delegated || []).filter(matches));

function contextOf(card: any) {
    return [card.process, card.subject].filter(Boolean).join(' · ');
}

function metaOf(card: any) {
    const parts: string[] = [];
    if (card.due) parts.push(/마감|지남/.test(card.due) ? card.due : `마감 ${card.due}`);
    else if (card.since) {
        const d = new Date(card.since);
        if (!Number.isNaN(d.getTime())) {
            const sameDay = new Date().toDateString() === d.toDateString();
            const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
            parts.push(sameDay ? `오늘 ${hm}` : `${d.getMonth() + 1}월 ${d.getDate()}일`);
        }
    }
    if (card.step) parts.push(`${card.step.no}/${card.step.total}단계`);
    return parts.join(' · ');
}

function toggleSearch() {
    searching.value = !searching.value;
    if (!searching.value) query.value = '';
}

function open(card: any) {
    router.push(`/tasks/${encodeURIComponent(card.id)}`);
}

/** 카드에서 바로 맡긴다 — 포털과 같은 방식으로, 담당자는 그대로. */
async function delegateCard(card: any) {
    const row = (data.value?.rows || []).find((r: any) => r.id === card.id);
    if (!row) return;
    busyId.value = card.id;
    error.value = '';
    try {
        await delegate(backend(), row);
        notice.value = `「${card.title}」을(를) 에이전트에 맡겼습니다. 초안이 오면 「맡긴 일」에서 확인해 주세요.`;
        await load();
        void refreshBadges();
    } catch (e) {
        console.error('[tasks] 맡기기 실패', e);
        error.value = '에이전트에 맡기지 못했습니다. 다시 시도해 주세요.';
    } finally {
        busyId.value = '';
    }
}

async function load() {
    loading.value = true;
    error.value = '';
    try {
        const supabase = (window as any).$supabase;
        const id = uid();
        if (!id) {
            error.value = '로그인 정보를 확인하지 못했습니다.';
            return;
        }
        data.value = await loadHome(supabase, { uid: id, tenant: (window as any).$tenantName || null });
    } catch (e) {
        console.error('[tasks] 목록 조회 실패', e);
        error.value = '목록을 불러오지 못했습니다. 다시 시도해 주세요.';
    } finally {
        loading.value = false;
    }
}

// 새 업무가 오거나 끝나면(탭 숫자가 바뀌면) 다시 읽는다.
watch(() => badges.tasks, () => void load());

let timer: any = null;
onMounted(() => {
    void load();
    // 맡긴 일의 초안이 오는 것은 할 일 수를 바꾸지 않는다 — 맡긴 것이 있으면 잠깐씩 다시 본다.
    timer = setInterval(() => {
        if ((model.value?.delegated || []).some((d: any) => d.state === 'running')) void load();
    }, 15000);
});
onUnmounted(() => clearInterval(timer));
</script>

<style scoped>
.home {
    padding: calc(var(--safe-top) + 10px) 16px 16px;
    gap: 12px;
}

.home__top {
    display: flex;
    align-items: center;
    gap: 6px;
}

.home__date {
    flex: 1;
    color: var(--ink-faint);
    font-weight: 600;
    font-size: 0.92rem;
}

.home__new {
    min-height: 42px;
    border-radius: 12px;
    padding: 0 14px;
}

.home__title {
    margin: 0 0 2px;
    font-size: 1.45rem;
    font-weight: 800;
    letter-spacing: -0.02em;
    line-height: 1.3;
}

.home__empty {
    padding: 28px 12px;
}

.tcard {
    gap: 6px;
}

.tcard__main {
    display: flex;
    flex-direction: column;
    gap: 2px;
    text-align: left;
}

.tcard__title {
    font-size: 1.1rem;
    font-weight: 800;
    letter-spacing: -0.01em;
}

.tcard__sub {
    color: var(--ink-faint);
    font-size: 0.9rem;
}

.tcard__reject {
    margin: 4px 0 0;
    padding: 10px 12px;
    border-radius: 12px;
    background: var(--danger-wash);
    color: var(--danger);
    font-size: 0.92rem;
}

.tcard__foot {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 6px;
}

.tcard__meta {
    flex: 1;
    min-width: 0;
    color: var(--ink-faint);
    font-size: 0.86rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.tcard__meta.late {
    color: var(--danger);
}

.tcard__btn {
    min-height: 42px;
    border-radius: 12px;
    padding: 0 12px;
    flex: none;
}

.row {
    flex-direction: row;
    align-items: center;
    gap: 12px;
}

.row__icon {
    width: 40px;
    height: 40px;
    border-radius: 12px;
    display: grid;
    place-items: center;
    background: var(--brand-wash);
    color: var(--brand);
    flex: none;
}

.row__icon--agent {
    background: var(--agent-wash);
    color: var(--agent);
}

.row__body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.row__body strong {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.row__go {
    color: var(--ink-faint);
}

.row__spin {
    color: var(--agent);
}

.bar {
    display: block;
    height: 5px;
    border-radius: 3px;
    background: var(--sunk);
    overflow: hidden;
    margin-top: 6px;
}

.bar__fill {
    display: block;
    height: 100%;
    background: var(--brand);
    border-radius: 3px;
}
</style>
