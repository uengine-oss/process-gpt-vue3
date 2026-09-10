<template>
    <li class="fs" :class="[`fs--${state}`, { 'fs--gate': step.kind === 'gateway' }]">
        <span class="fs__rail" aria-hidden="true">
            <span class="fs__dot"></span>
            <span class="fs__line"></span>
        </span>

        <span class="fs__body">
            <span class="fs__head">
                <strong class="fs__name">{{ step.name }}</strong>
                <span v-if="state === 'current'" class="fs__now">진행 중</span>
            </span>
            <span v-if="step.role" class="fs__meta">
                {{ step.role }}<template v-if="step.byAgent"> · 에이전트</template>
            </span>

            <!--
                갈림길. 조건이 곧 갈래 이름이라("승인" / "반려") 그대로 보여 주면
                무엇에 따라 나뉘는지 읽힌다.
            -->
            <span v-if="step.branches" class="fs__branches">
                <span v-for="b in step.branches" :key="b.label" class="fs__branch">
                    <span class="fs__label">{{ b.label }}</span>
                    <ol class="fs__sub">
                        <FlowStep
                            v-for="(s, i) in b.steps"
                            :key="s.id"
                            :step="s"
                            :index="i + 1"
                            :current-id="currentId"
                            :done-ids="doneIds"
                        />
                    </ol>
                </span>
            </span>
        </span>
    </li>
</template>

<script setup lang="ts">
/**
 * 흐름의 한 단계.
 *
 * 갈림길이면 자기 자신을 다시 불러 갈래를 그린다. 단계 수가 많지 않아
 * (한 프로세스에 보통 열 몇 개) 이 방식이면 충분하다.
 */

import { computed } from 'vue';

const props = defineProps<{
    step: any;
    index: number;
    currentId?: string;
    doneIds?: string[];
}>();

/** 지금 어디까지 왔는가. 진행 현황으로 쓸 때만 뜻이 있다. */
const state = computed(() => {
    if (props.currentId && props.step.id === props.currentId) return 'current';
    if ((props.doneIds || []).includes(props.step.id)) return 'done';
    return 'todo';
});
</script>

<style scoped>
.fs {
    display: flex;
    gap: 10px;
}

/* 왼쪽 세로선 — 단계가 이어져 있다는 것을 눈으로 알린다. */
.fs__rail {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex: none;
    width: 14px;
}

.fs__dot {
    width: 10px;
    height: 10px;
    margin-top: 6px;
    border-radius: 50%;
    background: var(--rule);
    flex: none;
}

.fs__line {
    flex: 1;
    width: 2px;
    background: var(--rule);
    margin: 2px 0;
}

.fs--done .fs__dot {
    background: var(--brand);
}

.fs--current .fs__dot {
    background: var(--brand);
    box-shadow: 0 0 0 4px var(--brand-wash);
}

.fs--gate .fs__dot {
    border-radius: 2px;
    transform: rotate(45deg);
}

.fs__body {
    flex: 1;
    min-width: 0;
    padding: 2px 0 14px;
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.fs__head {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
}

.fs__name {
    font-size: 0.94rem;
    line-height: 1.4;
}

.fs--todo .fs__name {
    color: var(--ink-soft);
}

.fs__now {
    font-size: 0.7rem;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 4px;
    background: var(--brand-wash);
    color: var(--brand);
}

.fs__meta {
    font-size: 0.8rem;
    color: var(--ink-faint);
}

.fs__branches {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 8px;
}

.fs__label {
    display: inline-block;
    font-size: 0.74rem;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 999px;
    border: 1px solid var(--rule);
    color: var(--ink-faint);
    margin-bottom: 4px;
}

.fs__sub {
    list-style: none;
    margin: 0;
    padding: 0 0 0 4px;
    border-left: 1px dashed var(--rule);
}
</style>
