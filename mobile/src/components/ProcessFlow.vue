<template>
    <div class="flow">
        <ol class="flow__list">
            <FlowStep
                v-for="(step, i) in flow.steps"
                :key="step.id"
                :step="step"
                :index="i + 1"
                :current-id="currentId"
                :done-ids="doneIds"
            />
        </ol>
        <p v-if="!flow.steps.length" class="m-muted">흐름 정보가 없습니다.</p>
    </div>
</template>

<script setup lang="ts">
/**
 * 프로세스 흐름을 가볍게 보여 준다.
 *
 * BPMN 도면 대신 위에서 아래로 흐르는 목록으로 그린다. 좁은 화면에서 도형을
 * 확대·이동하며 읽게 하는 대신, **누가 · 무엇을 · 어떤 순서로** 를 그대로
 * 읽히게 하는 편이 낫다. 그리는 규칙(@/shared/processFlow)은 웹과 한 벌이다.
 *
 * 지금 어디까지 왔는지(currentId · doneIds)를 함께 받으면 진행 현황으로도 쓴다.
 * 프로세스 생성 · 실행 시작 · 진행 현황이 모두 같은 그림을 본다.
 */

import { computed } from 'vue';

import { toFlow } from '@/shared/processFlow/index.js';
import FlowStep from './FlowStep.vue';

const props = defineProps<{
    definition: any;
    /** 지금 진행 중인 단계의 활동 id. 진행 현황에서 쓴다. */
    currentId?: string;
    /** 이미 끝난 단계들의 활동 id. */
    doneIds?: string[];
}>();

const flow = computed(() => toFlow(props.definition));
</script>

<style scoped>
.flow__list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0;
}
</style>
