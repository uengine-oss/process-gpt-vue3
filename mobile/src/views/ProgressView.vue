<template>
    <div class="m-screen">
        <header class="m-head">
            <h1>진행</h1>
            <button type="button" class="m-head__icon" aria-label="새로고침" @click="load"><Icon name="refresh" /></button>
        </header>
        <div class="m-body progress">
            <div class="m-chips" role="tablist" aria-label="진행 보기">
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

            <p v-if="error" class="m-note m-note--danger">{{ error }}</p>
            <p v-if="loading && !cards.length" class="m-muted">불러오는 중…</p>

            <button
                v-for="c in shown"
                :key="c.instId"
                type="button"
                class="m-card m-card--lg pcard"
                @click="router.push(`/instances/${encodeURIComponent(c.instId)}`)"
            >
                <span class="pcard__top">
                    <span class="m-tag" :class="tagClass(c)">{{ c.mine ? '내 차례' : c.statusLabel }}</span>
                    <span class="m-muted pcard__process">{{ c.process }}</span>
                </span>
                <strong class="pcard__title">{{ c.subject }}</strong>
                <span class="m-muted">{{ lineOf(c) }}</span>
                <span class="bar" role="img" :aria-label="`${c.progress.percent}퍼센트 진행`">
                    <span class="bar__fill" :style="{ width: (c.status === 'RUNNING' ? c.progress.percent : 100) + '%' }"></span>
                </span>
            </button>

            <div v-if="!loading && !shown.length" class="m-empty">
                <p>{{ filter === 'done' ? '끝난 건이 없습니다.' : '진행 중인 건이 없습니다.' }}</p>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import Icon from '../components/Icon.vue';
import { loadProgress } from '../lib/data.js';
import { instanceCard, startedBy } from '../lib/workspace.js';

/**
 * 진행 — 내가 참여한 건이 지금 어디까지 갔는지.
 *
 * 카드마다 「지금 누구 · 무슨 단계」와 막대. 누르면 그 건의 타임라인(BPMN 그림 대신 세로 줄).
 * 내가 올린 요청만 따로 볼 수 있다.
 */

const router = useRouter();
const loading = ref(true);
const error = ref('');
const data = ref<any>(null);
const route = useRoute();
const filter = ref<'running' | 'mine' | 'done'>(
    route.query.view === 'mine' ? 'mine' : route.query.view === 'done' ? 'done' : 'running'
);

const uid = () => localStorage.getItem('uid') || '';

const cards = computed(() => {
    if (!data.value) return [];
    const byInst = new Map<string, any[]>();
    for (const r of data.value.instRows) {
        if (!byInst.has(r.proc_inst_id)) byInst.set(r.proc_inst_id, []);
        byInst.get(r.proc_inst_id)!.push(r);
    }
    return data.value.instances.map((inst: any) => {
        const rows = byInst.get(inst.proc_inst_id) || [];
        return { ...instanceCard(inst, rows, data.value.defNames, uid()), startedByMe: startedBy(rows, uid()) };
    });
});

const running = computed(() => cards.value.filter((c: any) => c.status === 'RUNNING'));
const filters = computed(() => [
    { value: 'running' as const, label: '진행 중', count: running.value.length },
    { value: 'mine' as const, label: '내가 올린', count: running.value.filter((c: any) => c.startedByMe).length },
    { value: 'done' as const, label: '끝난 건', count: cards.value.length - running.value.length }
]);
const shown = computed(() => {
    if (filter.value === 'done') return cards.value.filter((c: any) => c.status !== 'RUNNING');
    if (filter.value === 'mine') return running.value.filter((c: any) => c.startedByMe);
    // 내 차례인 건을 위로
    return [...running.value].sort((a: any, b: any) => Number(b.mine) - Number(a.mine));
});

function tagClass(c: any) {
    if (c.mine) return 'm-tag--brand';
    if (c.status === 'RUNNING') return 'm-tag--ok';
    return '';
}

function lineOf(c: any) {
    const p = c.progress;
    const parts: string[] = [];
    if (c.status === 'RUNNING' && p.current) parts.push(`지금 ${[p.current.who, p.current.name].filter(Boolean).join(' · ')}`);
    if (c.status === 'RUNNING') parts.push(`${p.no}/${p.total}단계`);
    if (p.rejections) parts.push(`반려 ${p.rejections}번`);
    if (c.startedAt) {
        const d = new Date(c.startedAt);
        if (!Number.isNaN(d.getTime())) parts.push(`${d.getMonth() + 1}월 ${d.getDate()}일 시작`);
    }
    return parts.join(' · ');
}

async function load() {
    loading.value = true;
    error.value = '';
    try {
        data.value = await loadProgress((window as any).$supabase, { uid: uid(), tenant: (window as any).$tenantName || null });
    } catch (e) {
        console.error('[progress] 조회 실패', e);
        error.value = '진행 상황을 불러오지 못했습니다.';
    } finally {
        loading.value = false;
    }
}

onMounted(load);
</script>

<style scoped>
.progress {
    padding: 4px 16px 16px;
}

.pcard {
    gap: 4px;
}

.pcard__top {
    display: flex;
    align-items: center;
    gap: 8px;
}

.pcard__process {
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.pcard__title {
    font-size: 1.08rem;
    font-weight: 800;
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
