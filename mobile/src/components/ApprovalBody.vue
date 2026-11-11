<template>
    <div class="approval">
        <h2 class="approval__subject">{{ subject }}</h2>

        <!-- 문서: 앞 단계가 남긴 파일. 없으면 앞 단계가 쓴 긴 글을 문서처럼 -->
        <div v-for="f in files.slice(0, 2)" :key="f.url" class="m-card m-card--lg doc">
            <span class="doc__thumb" aria-hidden="true">
                <span v-for="n in 5" :key="n" class="doc__line" :class="{ 'doc__line--head': n === 1 }"></span>
            </span>
            <span class="doc__body">
                <strong class="doc__name">{{ f.name }}</strong>
                <span class="m-muted">{{ [f.who, f.when].filter(Boolean).join(' · ') || '눌러서 크게 보기' }}</span>
                <button type="button" class="m-btn doc__open" @click="openFile(f)">문서 열기</button>
            </span>
        </div>
        <div v-if="!files.length && longText" class="m-card m-card--lg doc doc--text">
            <span class="m-muted">{{ longText.label }}</span>
            <p class="doc__text" :class="{ 'doc__text--open': textOpen }">{{ longText.value }}</p>
            <button type="button" class="m-btn doc__open" @click="textOpen = !textOpen">
                {{ textOpen ? '접기' : '전체 보기' }}
            </button>
        </div>

        <!-- 핵심 값 -->
        <div v-if="facts.length" class="facts">
            <div v-for="f in facts" :key="f.key" class="m-card fact" :class="{ 'fact--wide': f.value.length > 18 }">
                <span class="m-muted">{{ f.label }}</span>
                <strong>{{ f.value }}</strong>
            </div>
        </div>

        <!-- 에이전트 요약 — 판단은 사람이 한다 -->
        <div v-if="summary" class="ai">
            <span class="ai__head"><Icon name="sparkle" :size="16" /> AI 요약 · 판단은 직접</span>
            <p>{{ summary }}</p>
        </div>

        <!-- 같은 단계에서 지난번에 내린 결정 -->
        <div v-if="history.length" class="m-card m-card--lg history">
            <div v-for="h in history" :key="h.id" class="history__row">
                <span class="history__when">{{ [when(h.at), `${h.round}차`].filter(Boolean).join(' ') }}</span>
                <span>
                    <strong :class="h.decision === 'reject' ? 'no' : 'yes'">{{ h.decision === 'reject' ? '반려' : '승인' }}</strong>
                    <template v-if="h.comment"> — {{ h.comment }}</template>
                </span>
            </div>
        </div>

        <div class="m-field">
            <div class="approval__label">
                <label for="decision-comment">{{ commentLabel || '의견' }}</label>
                <span class="m-muted" :class="{ warn: warn }">반려할 때는 꼭 적어 주세요</span>
            </div>
            <textarea
                id="decision-comment"
                :value="modelValue"
                rows="3"
                placeholder="의견 입력"
                @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
            ></textarea>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

import Icon from './Icon.vue';
import { download } from '../lib/download.js';

/**
 * 승인 · 반려 화면의 본문.
 *
 * 문서와 핵심 값, 지난 반려 이력을 한 화면에. 결정 칸은 미리 골라 두지 않고, 화면 아래 두 단추(반려 · 승인)로만
 * 정한다 — 단추는 부르는 화면(TaskDetailView)에 있다. 반려는 의견이 있어야 눌린다.
 */
defineProps<{
    subject: string;
    files: Array<any>;
    longText: { label: string; value: string } | null;
    facts: Array<{ key: string; label: string; value: string }>;
    summary: string;
    history: Array<any>;
    commentLabel: string;
    modelValue: string;
    warn: boolean;
}>();
const emit = defineEmits<{ (e: 'update:modelValue', value: string): void }>();

const textOpen = ref(false);

function when(at: string | null) {
    if (!at) return '';
    const d = new Date(at);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getMonth() + 1}/${d.getDate()}`;
}

function openFile(f: any) {
    download(f);
}
</script>

<style scoped>
.approval {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.approval__subject {
    margin: 2px 2px 0;
    font-size: 1.4rem;
    font-weight: 800;
    letter-spacing: -0.02em;
    line-height: 1.3;
}

.doc {
    flex-direction: row;
    align-items: flex-start;
    gap: 14px;
}

.doc--text {
    flex-direction: column;
    gap: 6px;
}

.doc__thumb {
    width: 64px;
    height: 84px;
    border: 1px solid var(--rule);
    border-radius: 8px;
    padding: 9px 7px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: none;
    background: var(--surface);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
}

.doc__line {
    height: 4px;
    border-radius: 2px;
    background: var(--sunk);
}

.doc__line--head {
    width: 70%;
    background: var(--brand-wash);
}

.doc__body {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
}

.doc__name {
    word-break: break-all;
}

.doc__open {
    align-self: flex-start;
    min-height: 38px;
    margin-top: 4px;
    background: var(--brand-wash);
    color: var(--brand);
    border-color: transparent;
}

.doc__text {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 7.5em;
    overflow: hidden;
    font-size: 0.92rem;
}

.doc__text--open {
    max-height: none;
}

.facts {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
}

.fact {
    border-radius: 14px;
    gap: 2px;
}

.fact--wide {
    grid-column: 1 / -1;
}

.fact strong {
    font-size: 1rem;
    word-break: break-word;
}

.ai {
    background: var(--agent-wash);
    border-radius: 14px;
    padding: 12px 14px;
}

.ai__head {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--agent);
    font-weight: 700;
    font-size: 0.9rem;
}

.ai p {
    margin: 4px 0 0;
}

.history {
    gap: 0;
    padding: 4px 14px;
}

.history__row {
    display: grid;
    grid-template-columns: 74px 1fr;
    gap: 8px;
    padding: 10px 0;
    border-bottom: 1px solid var(--rule);
    font-size: 0.92rem;
}

.history__row:last-child {
    border-bottom: none;
}

.history__when {
    color: var(--ink-faint);
}

.no {
    color: var(--danger);
}

.yes {
    color: var(--ok);
}

.approval__label {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
}

.approval__label label {
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--ink);
}

.warn {
    color: var(--danger);
    font-weight: 700;
}
</style>
