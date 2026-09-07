<template>
    <div class="m-screen">
        <header class="m-appbar">
            <h1>할 일</h1>
            <button type="button" aria-label="새로고침" @click="load"><Icon name="refresh" /></button>
            <button type="button" aria-label="프로세스 시작" @click="router.push('/start')"><Icon name="plus" /></button>
        </header>

        <div class="tabs">
            <button
                v-for="opt in FILTERS"
                :key="opt.value"
                type="button"
                class="tabs__item"
                :class="{ 'tabs__item--on': filter === opt.value }"
                @click="filter = opt.value"
            >
                {{ opt.label }}
                <span v-if="opt.value === 'open' && openCount" class="tabs__count">{{ openCount }}</span>
            </button>
        </div>

        <div class="m-body">
            <p v-if="error" class="m-note m-note--danger">{{ error }}</p>
            <p v-if="loading" class="m-muted">불러오는 중…</p>

            <!-- 내 차례인 일 / 끝난 일 -->
            <template v-else-if="filter !== 'running'">
                <template v-if="visible.length">
                    <button
                        v-for="item in visible"
                        :key="item.taskId"
                        type="button"
                        class="m-card task"
                        @click="open(item)"
                    >
                        <span class="task__title">{{ cardLines(item).title }}</span>
                        <span class="task__sub" :class="{ 'task__sub--late': isOverdue(item.dueDate, undefined, item) }">
                            {{ cardLines(item).subtitle || '기한 없음' }}
                        </span>
                    </button>
                </template>
                <div v-else class="m-empty">
                    <p>{{ filter === 'open' ? '할 일이 없습니다.' : '완료한 업무가 없습니다.' }}</p>
                </div>
            </template>

            <!-- 내가 관련됐지만 지금 내 차례가 아닌 건 -->
            <template v-else>
                <p class="m-muted">내가 관련된 건이 지금 어디까지 갔는지 보여 줍니다.</p>
                <template v-if="instances.length">
                    <button
                        v-for="inst in instances"
                        :key="inst.instId"
                        type="button"
                        class="m-card"
                        @click="openInstance(inst)"
                    >
                        <span class="m-muted">{{ statusLabel(inst.status) }}</span>
                        <strong>{{ inst.name || inst.defId }}</strong>
                        <span class="m-muted">{{ stepLabel(inst) }}</span>
                    </button>
                </template>
                <div v-else class="m-empty">
                    <p>진행 중인 건이 없습니다.</p>
                </div>
            </template>
        </div>
    </div>
</template>

<script setup lang="ts">
import Icon from '../components/Icon.vue';
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { backend } from '../lib/backend.js';
import { visibleInstances } from '../lib/instances.js';
import { currentSession } from '../lib/session.js';
import { assignedTo, cardLines, isDone, isOpen, isOverdue, needsMe, sortForMobile } from '../lib/tasks.js';

/**
 * 세 갈래로 나눈 이유
 *   해야 할 일 : 지금 내 차례인 단계
 *   진행 중    : 내가 관련됐지만 지금은 남의 차례인 건 — 내가 낸 신청이 어떻게
 *                되고 있는지 보는 곳이다. 제출하는 순간 할 일에서는 사라진다.
 *   완료       : 끝난 것
 */
const FILTERS = [
    { value: 'open', label: '해야 할 일' },
    { value: 'running', label: '진행 중' },
    { value: 'done', label: '완료' }
] as const;

const STATUS: Record<string, string> = {
    RUNNING: '진행 중',
    COMPLETED: '완료',
    CANCELLED: '취소됨',
    PENDING: '대기'
};

const route = useRoute();
const router = useRouter();
const items = ref<any[]>([]);
const instances = ref<any[]>([]);
const loading = ref(true);
const error = ref('');
const filter = ref<'open' | 'running' | 'done'>('open');

/**
 * 에이전트가 대신 하는 업무는 목록에서 뺀다.
 * "내가 처리해야 할 것" 이라는 목록의 뜻을 지키기 위해서다.
 * 그 작업이 나에게 물으며 멈춘 경우에만 올라온다(needsMe).
 */
const mine = computed(() => items.value.filter(needsMe));

const openCount = computed(() => mine.value.filter(isOpen).length);
const visible = computed(() =>
    sortForMobile(mine.value.filter(filter.value === 'open' ? isOpen : isDone))
);

function statusLabel(status: string) {
    return STATUS[(status || '').toUpperCase()] || status || '상태 없음';
}

/** 지금 어느 단계인지. 여러 갈래로 갈렸으면 개수로 말한다. */
function stepLabel(inst: any) {
    const ids = Array.isArray(inst.currentActivityIds) ? inst.currentActivityIds.filter(Boolean) : [];
    if (!ids.length) return '단계 정보 없음';
    if (ids.length === 1) return `현재 단계: ${ids[0]}`;
    return `동시에 ${ids.length}개 단계 진행 중`;
}

async function load() {
    loading.value = true;
    error.value = '';
    try {
        // 업무의 담당자 칸에는 이메일이 아니라 식별자(UUID)가 들어간다.
        // 이메일로 찾으면 아무것도 나오지 않는다.
        const uid = localStorage.getItem('uid');
        if (!uid) {
            error.value = '로그인 정보를 확인하지 못했습니다.';
            return;
        }

        const list = (await backend().getWorkList({ userId: uid })) || [];
        // 조회는 부분 일치라, 내 식별자를 일부로 포함하는 남의 업무가 섞일 수 있다.
        items.value = list.filter((item: any) => assignedTo(item, uid));
    } catch (e: any) {
        error.value = '목록을 불러오지 못했습니다. 다시 시도해 주세요.';
        console.error('[tasks] 목록 조회 실패', e);
    } finally {
        loading.value = false;
    }
}

/** 진행 중 탭을 처음 열 때만 불러온다 — 평소에는 필요 없는 조회다. */
async function loadInstances() {
    if (instances.value.length) return;
    try {
        const all = (await backend().getInstanceList({ orderBy: 'start_date', sort: 'desc' })) || [];
        const session = await currentSession();
        instances.value = visibleInstances(all, {
            uid: localStorage.getItem('uid'),
            email: session?.user?.email
        });
    } catch (e: any) {
        error.value = '진행 현황을 불러오지 못했습니다.';
        console.error('[tasks] 현황 조회 실패', e);
    }
}

watch(filter, (next) => {
    if (next === 'running') void loadInstances();
});

/** 그 건의 단계별 진행 상황으로 들어간다. */
function openInstance(inst: any) {
    router.push({
        path: `/instances/${encodeURIComponent(inst.instId)}`,
        query: { name: inst.name || inst.defId || '' }
    });
}

function open(item: any) {
    router.push(`/tasks/${encodeURIComponent(item.taskId)}`);
}

onMounted(() => {
    // 옛 /status 링크로 들어온 경우 곧바로 그 화면을 보여 준다.
    if (route.query.view === 'running') {
        filter.value = 'running';
        void loadInstances();
    }
    void load();
});
</script>

<style scoped>
.tabs {
    display: flex;
    gap: 6px;
    padding: 10px 12px 0;
    background: var(--surface);
    border-bottom: 1px solid var(--rule);
    overflow-x: auto;
}

.tabs__item {
    min-height: var(--tap);
    padding: 0 14px;
    border-radius: 999px;
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--ink-faint);
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 10px;
    white-space: nowrap;
}

.tabs__item--on {
    background: var(--brand-wash);
    color: var(--brand);
}

.tabs__count {
    background: var(--brand);
    color: var(--brand-ink);
    border-radius: 999px;
    min-width: 20px;
    padding: 0 6px;
    font-size: 0.72rem;
    line-height: 20px;
    text-align: center;
}

.task {
    gap: 3px;
}

.task__title {
    font-weight: 600;
    line-height: 1.4;
}

.task__sub {
    font-size: 0.85rem;
    color: var(--ink-faint);
}

.task__sub--late {
    color: var(--danger);
    font-weight: 600;
}
</style>
