<template>
    <div class="m-screen">
        <header class="m-appbar task-bar">
            <button type="button" aria-label="뒤로" @click="goBack"><Icon name="back" /></button>
            <div class="task-bar__title">
                <h1>{{ title }}</h1>
                <span v-if="subline" class="m-muted">{{ subline }}</span>
            </div>
        </header>

        <div class="m-body inst">
            <p v-if="error" class="m-note m-note--danger">{{ error }}</p>
            <p v-if="loading && !rows.length" class="m-muted">불러오는 중…</p>

            <template v-else>
                <div class="m-card m-card--lg summary">
                    <span class="summary__top">
                        <span class="m-tag" :class="statusClass">{{ statusLabel }}</span>
                        <strong>{{ holder }}</strong>
                    </span>
                    <span class="m-muted">{{ facts }}</span>
                    <span class="bar" role="img" :aria-label="`${percent}퍼센트 진행`">
                        <span class="bar__fill" :style="{ width: percent + '%' }"></span>
                    </span>
                </div>

                <ol v-if="timeline.length" class="tl">
                    <li v-for="s in timeline" :key="s.id" class="tl__item" :class="`tl__item--${s.state}`">
                        <span class="tl__dot" aria-hidden="true">
                            <Icon v-if="s.state === 'done' || s.state === 'approved'" name="check" :size="16" />
                            <Icon v-else-if="s.state === 'rejected'" name="close" :size="16" />
                        </span>
                        <div class="tl__body">
                            <div class="tl__name">
                                <button
                                    v-if="s.state === 'current' && s.mine"
                                    type="button"
                                    class="tl__link"
                                    @click="router.push(`/tasks/${encodeURIComponent(s.id)}`)"
                                >
                                    {{ s.name }}
                                </button>
                                <strong v-else>{{ s.name }}</strong>
                                <span v-if="s.state === 'rejected'" class="m-tag m-tag--danger">반려</span>
                                <span v-else-if="s.state === 'approved'" class="m-tag m-tag--ok">승인</span>
                                <span v-else-if="s.state === 'current'" class="m-tag m-tag--brand">{{ s.mine ? '내 차례' : '진행 중' }}</span>
                            </div>
                            <span class="m-muted">{{ [s.who, s.state === 'waiting' ? '대기' : s.state === 'current' ? '지금' : when(s.at)].filter(Boolean).join(' · ') }}</span>
                            <p v-if="s.comment" class="tl__comment" :class="{ 'tl__comment--ok': s.state === 'approved' }">{{ s.comment }}</p>
                        </div>
                    </li>
                </ol>
                <div v-else class="m-empty"><p>아직 단계가 없습니다.</p></div>

                <template v-if="files.length">
                    <h2 class="m-section"><span>산출물</span></h2>
                    <div class="files">
                        <button v-for="f in files" :key="f.url" type="button" class="m-card file" @click="download(f)">
                            <span class="file__icon" aria-hidden="true"><Icon name="file" /></span>
                            <span class="file__body">
                                <strong>{{ f.name }}</strong>
                                <span class="m-muted">{{ [when(f.at), f.who].filter(Boolean).join(' · ') }}</span>
                            </span>
                        </button>
                    </div>
                </template>
            </template>
        </div>

        <div v-if="myTask" class="m-actions m-actions--one">
            <button type="button" class="m-btn m-btn--lg m-btn--primary" @click="router.push(`/tasks/${encodeURIComponent(myTask.id)}`)">
                내 차례 열기
            </button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import Icon from '../components/Icon.vue';
import { loadInstance } from '../lib/data.js';
import { download } from '../lib/download.js';
import { dueLabel } from '../lib/tasks.js';
import { fileOutputs, instanceStatusLabel, progressOf, subjectOf, timelineModel } from '../lib/workspace.js';

/**
 * 진행 상황 — BPMN 그림 대신 세로 타임라인.
 *
 * 같은 단계가 반복돼도(반려 → 다시 작성 → 다시 검토) 행마다 남겨 지난 결과(반려 사유)를 지우지 않는다.
 * 영어 상태값 없이 「진행 중 · 반려 · 대기」 로만 말한다. 내 차례면 아래에서 바로 연다.
 */

const route = useRoute();
const router = useRouter();
const instId = decodeURIComponent(String(route.params.id || ''));

const loading = ref(true);
const error = ref('');
const rows = ref<any[]>([]);
const inst = ref<any>(null);
const processName = ref('');

const uid = () => localStorage.getItem('uid') || '';
const timeline = computed(() => timelineModel(rows.value, uid()));
const progress = computed(() => progressOf(rows.value));
const files = computed(() => fileOutputs(rows.value));
const myTask = computed(() => timeline.value.find((s: any) => s.state === 'current' && s.mine) || null);
const running = computed(() => !inst.value || String(inst.value.status || '').toUpperCase() === 'RUNNING');

const title = computed(
    () => subjectOf(inst.value?.proc_inst_name, processName.value) || (route.query.name as string) || '진행 상황'
);
const subline = computed(() => {
    const start = inst.value?.start_date ? new Date(inst.value.start_date) : null;
    const when = start && !Number.isNaN(start.getTime()) ? `${start.getMonth() + 1}월 ${start.getDate()}일 시작` : '';
    return [processName.value, when].filter(Boolean).join(' · ');
});
const statusLabel = computed(() => instanceStatusLabel(inst.value?.status || 'RUNNING'));
const statusClass = computed(() => (running.value ? 'm-tag--brand' : 'm-tag--ok'));
const holder = computed(() => {
    const c = progress.value.current;
    if (!running.value) return '모두 끝났습니다';
    if (!c) return '다음 단계를 기다리고 있습니다';
    return `지금 ${[c.who, c.name].filter(Boolean).join(' · ')}`;
});
const facts = computed(() => {
    const p = progress.value;
    const parts = [`${p.no}/${p.total}단계`];
    if (p.rejections) parts.push(`반려 ${p.rejections}번`);
    const due = p.current?.due ? dueLabel(p.current.due) : '';
    if (due && running.value) parts.push(/마감|지남/.test(due) ? due : `마감 ${due}`);
    return parts.join(' · ');
});
const percent = computed(() => (running.value ? progress.value.percent : 100));

function when(at: string) {
    if (!at) return '';
    const d = new Date(at);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function goBack() {
    if (window.history.length > 1) router.back();
    else void router.replace('/progress');
}

onMounted(async () => {
    try {
        const found = await loadInstance((window as any).$supabase, { instId, tenant: (window as any).$tenantName || null });
        rows.value = found.rows;
        inst.value = found.inst;
        processName.value = found.processName;
    } catch (e) {
        console.error('[instance] 조회 실패', e);
        error.value = '진행 상황을 불러오지 못했습니다.';
    } finally {
        loading.value = false;
    }
});
</script>

<style scoped>
.task-bar {
    align-items: flex-start;
    background: var(--ground);
    border-bottom: none;
}

.task-bar__title {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
}

.task-bar__title h1 {
    font-size: 1.2rem;
    line-height: 1.35;
}

.inst {
    padding: 4px 16px 20px;
    gap: 14px;
}

.summary__top {
    display: flex;
    align-items: center;
    gap: 8px;
}

.summary__top strong {
    font-size: 1.02rem;
}

.bar {
    display: block;
    height: 6px;
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

.tl {
    list-style: none;
    margin: 0;
    padding: 0;
}

.tl__item {
    position: relative;
    display: grid;
    grid-template-columns: 30px 1fr;
    gap: 12px;
    padding-bottom: 18px;
}

/* 점과 점을 잇는 세로 줄 */
.tl__item::before {
    content: '';
    position: absolute;
    left: 14px;
    top: 30px;
    bottom: -2px;
    width: 2px;
    background: var(--rule);
}

.tl__item:last-child::before {
    display: none;
}

.tl__dot {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--ink-faint);
    color: #fff;
    z-index: 1;
}

.tl__item--rejected .tl__dot {
    background: var(--danger);
}

.tl__item--approved .tl__dot {
    background: var(--ok);
}

.tl__item--current .tl__dot {
    background: var(--surface);
    border: 3px solid var(--brand);
    box-shadow: inset 0 0 0 4px var(--surface), inset 0 0 0 12px var(--brand);
}

.tl__item--waiting .tl__dot {
    background: var(--surface);
    border: 2px solid var(--rule);
}

.tl__item--waiting .tl__name strong {
    color: var(--ink-faint);
}

.tl__body {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    padding-top: 3px;
}

.tl__name {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
}

.tl__name strong,
.tl__link {
    font-size: 1.02rem;
    font-weight: 700;
}

.tl__link {
    color: var(--brand);
    text-align: left;
}

.tl__comment {
    margin: 6px 0 0;
    padding: 9px 12px;
    border-radius: 10px;
    background: var(--danger-wash);
    color: var(--danger);
    font-size: 0.92rem;
}

.tl__comment--ok {
    background: var(--ok-wash);
    color: var(--ok);
}

.files {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
}

.file {
    flex-direction: row;
    align-items: center;
    gap: 10px;
    border-radius: 14px;
}

.file__icon {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: var(--brand-wash);
    color: var(--brand);
    display: grid;
    place-items: center;
    flex: none;
}

.file__body {
    display: flex;
    flex-direction: column;
    min-width: 0;
}

.file__body strong {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
</style>
