<template>
    <div class="m-screen">
        <header class="m-appbar">
            <button type="button" aria-label="뒤로" @click="router.back()"><Icon name="back" /></button>
            <h1>{{ name || '진행 현황' }}</h1>
        </header>

        <div class="m-body">
            <p v-if="error" class="m-note m-note--danger">{{ error }}</p>
            <p v-if="loading" class="m-muted">불러오는 중…</p>

            <template v-else>
                <!-- 한눈 요약: 얼마나 왔고 지금 누구 차례인가 -->
                <div class="m-card">
                    <span class="m-muted">{{ summary.text }}</span>
                    <div class="bar" role="img" :aria-label="`${summary.percent}퍼센트 진행`">
                        <span class="bar__fill" :style="{ width: summary.percent + '%' }"></span>
                    </div>
                    <strong>{{ holder }}</strong>
                </div>

                <!--
                    전체 흐름. 지금 어디까지 왔는지 한눈에 보이게 같은 그림을 쓴다
                    (프로세스 생성 · 시작 화면과 동일).
                -->
                <section v-if="definition" class="m-card">
                    <span class="m-muted">전체 흐름</span>
                    <ProcessFlow :definition="definition" :current-id="currentActivityId" :done-ids="doneIds" />
                </section>

                <!-- 단계들 -->
                <ol v-if="steps.length" class="steps">
                    <li v-for="step in steps" :key="step.id" class="step" :class="`step--${step.state}`">
                        <span class="step__dot" aria-hidden="true"></span>
                        <span class="step__body">
                            <strong>{{ step.name }}</strong>
                            <span class="m-muted">
                                {{ stateLabel(step.state) }}<template v-if="step.who"> · {{ step.who }}</template>
                            </span>
                            <span v-if="when(step)" class="m-muted">{{ when(step) }}</span>

                            <!--
                                그 단계에서 실제로 무엇이 정해졌는가.
                                단계 이름과 상태만 보여 주면 "어디까지 왔는지" 는 알아도
                                "무엇이 결정됐는지" 는 알 수 없다.
                            -->
                            <dl v-if="outputsOf(step).length" class="step__out">
                                <template v-for="f in outputsOf(step)" :key="f.key">
                                    <dt>{{ f.label }}</dt>
                                    <dd>{{ f.value }}</dd>
                                </template>
                            </dl>
                        </span>
                        <button
                            v-if="isActionable(step) && mine(step)"
                            type="button"
                            class="m-btn step__go"
                            @click="router.push(`/tasks/${encodeURIComponent(step.id)}`)"
                        >
                            처리
                        </button>
                    </li>
                </ol>

                <div v-else class="m-empty"><p>아직 단계가 없습니다.</p></div>
            </template>
        </div>
    </div>
</template>

<script setup lang="ts">
/**
 * 이 건이 지금 어디까지 왔는가.
 *
 * 목록에서 "진행 중" 만 보면 알 수 있는 게 없다. 여기서는 끝난 단계 · 지금 하는
 * 단계 · 남은 단계를 순서대로 보여 주고, 그 단계가 내 차례면 바로 처리로 넘어간다.
 */

import Icon from '../components/Icon.vue';
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { backend } from '../lib/backend.js';
import ProcessFlow from '../components/ProcessFlow.vue';
import { flattenOutput } from '../lib/outputs.js';
import { holderText, isActionable, stateLabel, summarize, toSteps } from '../lib/progress.js';
import { assignedTo } from '../lib/tasks.js';

const route = useRoute();
const router = useRouter();

const instId = decodeURIComponent(String(route.params.id || ''));
const name = ref((route.query.name as string) || '');
const items = ref<any[]>([]);
const loading = ref(true);
const error = ref('');

const steps = computed(() => toSteps(items.value));

// 전체 흐름을 그리기 위한 정의. 없으면 흐름도는 생략한다.
const definition = ref<any>(null);

/** 지금 진행 중인 단계의 활동 id. 흐름도에서 그 자리를 짚어 준다. */
const currentActivityId = computed(() => {
    const now = steps.value.find((s: any) => s.state === 'current' || s.state === 'waiting');
    return now?.raw?.activity_id || '';
});

/** 이미 끝난 단계들. */
const doneIds = computed(() =>
    steps.value.filter((s: any) => s.state === 'done').map((s: any) => s.raw?.activity_id).filter(Boolean)
);
const summary = computed(() => summarize(steps.value));
const holder = computed(() => holderText(steps.value));

/** 그 단계에서 정해진 내용. 없으면 아무것도 그리지 않는다. */
function outputsOf(step: any) {
    return flattenOutput(step?.raw?.output);
}

/** 이 단계가 내 차례인가. 그럴 때만 [처리] 를 보여 준다. */
function mine(step: any) {
    return assignedTo(step.raw, localStorage.getItem('uid'));
}

function when(step: any) {
    const at = step.endedAt || step.startedAt;
    if (!at) return '';
    const d = new Date(at);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

onMounted(async () => {
    try {
        items.value = (await backend().getWorkListByRootInstId(instId)) || [];
        if (!items.value.length) {
            // 자식 인스턴스로 갈라진 건은 root 로 안 잡히는 경우가 있다.
            items.value = (await backend().getWorkList({ instId })) || [];
        }
        // 흐름도용 정의. 실패해도 단계 목록은 그대로 보인다.
        const defId = items.value[0]?.task?.proc_def_id || items.value[0]?.defId;
        if (defId) {
            try {
                const row = await backend().getRawDefinition(String(defId), null);
                // 행 전체가 오므로 정의 본문만 꺼낸다.
                const body = row?.definition ?? row;
                definition.value = typeof body === 'string' ? JSON.parse(body) : body;
            } catch (_e) {
                definition.value = null;
            }
        }
    } catch (e: any) {
        error.value = '진행 상황을 불러오지 못했습니다.';
        console.error('[instance] 조회 실패', e);
    } finally {
        loading.value = false;
    }
});
</script>

<style scoped>
/* 단계 안의 산출물. 흐름을 방해하지 않게 작고 조용하게. */
.step__out {
    margin: 6px 0 0;
    display: grid;
    grid-template-columns: minmax(64px, 36%) 1fr;
    gap: 2px 8px;
    font-size: 0.82rem;
}

.step__out dt {
    color: var(--ink-faint);
    overflow: hidden;
    text-overflow: ellipsis;
}

.step__out dd {
    margin: 0;
    word-break: break-word;
}

.bar {
    height: 6px;
    border-radius: 3px;
    background: var(--sunk);
    overflow: hidden;
    margin: 6px 0 2px;
}

.bar__fill {
    display: block;
    height: 100%;
    background: var(--brand);
    border-radius: 3px;
}

.steps {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
}

.step {
    display: grid;
    grid-template-columns: 18px 1fr auto;
    gap: 10px;
    align-items: start;
    padding: 12px 2px;
    border-bottom: 1px solid var(--rule);
}

.step:last-child {
    border-bottom: none;
}

.step__body {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
}

/* 점 하나로 상태를 구분한다. 색만으로 나누지 않도록 글자도 함께 적는다. */
.step__dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    margin-top: 5px;
    border: 2px solid var(--rule);
    background: var(--surface);
}

.step--done .step__dot {
    background: var(--brand);
    border-color: var(--brand);
}

.step--current .step__dot {
    border-color: var(--brand);
    box-shadow: 0 0 0 3px var(--brand-wash);
}

.step--cancelled .step__dot {
    background: var(--rule);
}

.step--cancelled .step__body strong {
    text-decoration: line-through;
    color: var(--ink-faint);
}

.step__go {
    min-height: 36px;
    padding: 0 14px;
    background: var(--brand);
    color: var(--brand-ink);
    border-color: transparent;
}
</style>
