<template>
    <div class="m-screen">
        <header class="m-appbar">
            <button type="button" aria-label="뒤로" @click="router.back()"><Icon name="back" /></button>
            <h1>{{ headline }}</h1>
        </header>

        <div class="m-body">
            <p v-if="loading" class="m-muted">불러오는 중…</p>

            <template v-else-if="item">
                <div class="m-card">
                    <span class="m-muted">{{ item.defId || '진행 건' }}</span>
                    <strong>{{ headline }}</strong>
                    <p v-if="summary" class="m-muted">{{ summary }}</p>
                    <p v-if="due" class="m-muted" :class="{ late: overdue }">{{ due }}</p>
                </div>

                <!--
                    에이전트가 맡은 업무. 사람이 채울 폼도, 제출 버튼도 필요 없다.
                    필요한 것은 "지금 어떻게 되고 있는가" 하나뿐이다.
                -->
                <section v-if="byAgent" class="agent" :class="{ 'agent--failed': failed }">
                    <span
                        class="agent__dot"
                        :class="{
                            'agent__dot--run': running && progressState !== 'waiting',
                            'agent__dot--wait': progressState === 'waiting',
                            'agent__dot--failed': failed
                        }"
                        aria-hidden="true"
                    ></span>
                    <span class="agent__body">
                        <strong>{{ progressState === 'waiting' ? '내 확인을 기다리고 있습니다.' : statusText }}</strong>
                        <span v-if="progressState === 'waiting'" class="m-muted">
                            대화로 돌아가 답해 주셔야 이어집니다.
                        </span>
                        <!--
                            실패는 반드시 말해야 한다. "처리하고 있습니다" 로 두면
                            사용자는 오지 않을 결과를 계속 기다린다.
                        -->
                        <span v-else-if="failed" class="m-muted">
                            잠시 후 다시 시도해 주세요. 계속 실패하면 웹에서 확인해 주세요.
                        </span>
                        <span v-else class="m-muted">에이전트가 대신 처리합니다. 끝나면 알림으로 알려 드립니다.</span>
                    </span>
                    <button
                        v-if="progressState === 'waiting'"
                        type="button"
                        class="m-btn agent__refresh"
                        @click="goToChat"
                    >
                        대화로
                    </button>
                    <button v-else type="button" class="m-btn agent__refresh" :disabled="loading" @click="load">
                        새로고침
                    </button>
                </section>

                <!--
                    사람이 답해야 이어지는 물음. 여기서 답해야 작업이 재개된다.
                    "대화로 가라" 고만 하면 사용자는 무엇을 답해야 할지 모른다.
                -->
                <section v-if="questions.length" class="ask">
                    <h2 class="ask__head">이어서 진행하려면 답해 주세요</h2>
                    <div v-for="q in questions" :key="q.id" class="ask__item">
                        <strong>{{ q.title }}</strong>
                        <span v-if="q.hint" class="m-muted">{{ q.hint }}</span>

                        <!-- 무엇을 만드는지 보여 준다. 모르고 답하게 하면 안 된다. -->
                        <ul v-if="q.items.length" class="ask__items">
                            <li v-for="name in q.items" :key="name">{{ name }}</li>
                        </ul>
                        <span v-else class="m-muted">만들 대상: 없음</span>

                        <p v-if="q.answered" class="m-muted">답하셨습니다.</p>
                        <div v-else class="ask__actions">
                            <button class="m-btn m-btn--primary" :disabled="answering" @click="answer(q, '예')">
                                예
                            </button>
                            <button class="m-btn" :disabled="answering" @click="answer(q, '아니오')">아니오</button>
                        </div>
                    </div>
                    <p v-if="answerError" class="m-note m-note--danger">{{ answerError }}</p>
                </section>

                <!--
                    에이전트가 지금 무엇을 하고 있는가.
                    "처리 중" 한 줄만 있으면 멈춘 것인지 알 수 없다.
                    포털과 같은 events 표를 구독해 실제 진행을 그대로 보여 준다.
                -->
                <ol v-if="byAgent && feed.length" class="feed">
                    <li
                        v-for="f in feed"
                        :key="f.id"
                        class="feed__row"
                        :class="{ 'feed__row--done': f.done, 'feed__row--failed': f.failed }"
                    >
                        <span class="feed__mark" aria-hidden="true"></span>
                        <span class="feed__body">
                            <span v-if="f.tag" class="feed__tag">{{ f.tag }}</span>
                            <span>{{ f.text }}</span>
                        </span>
                    </li>
                </ol>

                <!--
                    이 건이 여기까지 오는 동안 무엇이 정해졌는가.
                    승인만 하면 되는 업무는 입력칸이 없어, 이것이 없으면
                    무엇을 근거로 승인하라는 것인지 알 수 없다.
                -->
                <section v-if="priorSteps.length" class="prior">
                    <h2 class="prior__title">이전 단계 내용</h2>
                    <div v-for="step in priorSteps" :key="step.id" class="prior__step">
                        <div class="prior__head">
                            <strong>{{ step.name }}</strong>
                            <span v-if="step.who" class="m-muted">{{ step.who }}</span>
                        </div>
                        <dl class="prior__fields">
                            <template v-for="f in step.fields" :key="f.key">
                                <dt>{{ f.label }}</dt>
                                <dd>{{ f.value }}</dd>
                            </template>
                        </dl>
                    </div>
                </section>

                <p v-if="finished && !byAgent" class="m-note">이미 완료된 업무입니다.</p>

                <template v-else-if="!byAgent && !finished">
                    <!-- 에이전트가 만든 초안이 있으면 먼저 보여 준다. 사용자가 할 일은
                         빈 폼을 채우는 것이 아니라 이것을 검토하는 것이다. -->
                    <section v-if="draft" class="draft">
                        <h2 class="draft__title">에이전트 초안</h2>
                        <pre class="draft__body">{{ draft }}</pre>

                        <div class="m-field">
                            <label for="opinion">고칠 점이 있으면 적어 주세요</label>
                            <textarea id="opinion" v-model="opinion" rows="3"
                                      placeholder="예: 금액을 다시 확인해 주세요"></textarea>
                        </div>

                        <button class="m-btn m-btn--block" type="button"
                                :disabled="!opinion.trim() || sendingOpinion" @click="sendOpinion">
                            {{ sendingOpinion ? '보내는 중…' : '의견 보내고 다시 맡기기' }}
                        </button>
                    </section>

                    <p v-if="!fields.length" class="m-note">
                        입력할 항목이 없습니다. 확인 후 완료할 수 있습니다.
                    </p>

                    <MobileForm
                        v-else
                        :fields="fields"
                        :values="values"
                        @update:values="values = $event"
                        @voice-error="(m: string) => (error = m)"
                    />

                    <p v-if="!submittable" class="m-note m-note--danger">
                        이 업무에는 휴대폰에서 입력할 수 없는 항목이 있습니다.
                        웹에서 열어 주세요.
                    </p>

                    <p v-if="error" class="m-note m-note--danger">{{ error }}</p>

                    <button
                        class="m-btn m-btn--primary m-btn--block"
                        type="button"
                        :disabled="!submittable || submitting"
                        @click="submit"
                    >
                        {{ submitting ? '제출 중…' : draft ? '승인하고 완료' : '완료로 제출' }}
                    </button>
                </template>
            </template>

            <div v-else class="m-empty">
                <p>업무를 찾을 수 없습니다.</p>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import Icon from '../components/Icon.vue';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import MobileForm from '../components/MobileForm.vue';
import { completionFailed, failureText } from '../lib/completion.js';
import {
    agentFailed,
    agentStatusText,
    readableDescription,
    runsByAgent,
    stillRunning,
    taskTitle
} from '../lib/agentTask.js';
import { feedState, isFinished, toFeed } from '../lib/agentEvents.js';
import { emptyQuestionIds, originRoomId, submitAnswer, toQuestions } from '../lib/hitlTask.js';
import { formIdOf, labelsFromFields, previousOutputs } from '../lib/outputs.js';
import { draftText, feedbackPatch } from '../lib/approval.js';
import { backend } from '../lib/backend.js';
import { canSubmitOnMobile, initialValues, toMobileFields } from '../lib/formSchema.js';
import { currentSession } from '../lib/session.js';
import { dueLabel, isDone, isOverdue } from '../lib/tasks.js';

const route = useRoute();
const router = useRouter();

const item = ref<any>(null);
const fields = ref<any[]>([]);
const values = ref<Record<string, any>>({});
const formId = ref('');
const loading = ref(true);
const submitting = ref(false);
const sendingOpinion = ref(false);
const opinion = ref('');
const error = ref('');
// 이 건의 앞 단계에서 나온 내용. 승인 판단의 근거다.
const priorSteps = ref<any[]>([]);

// 에이전트가 맡은 업무는 보여 줄 것이 다르다 — 폼이 아니라 진행 상태다.
const byAgent = computed(() => runsByAgent(item.value?.task));
const running = computed(() => stillRunning(item.value?.task));
const failed = computed(() => agentFailed(item.value?.task));
const statusText = computed(() => agentStatusText(item.value?.task));
const headline = computed(() => taskTitle(item.value?.task, item.value?.name || '업무'));
// 설명에는 에이전트에게 주는 지시문이 통째로 들어 있다. 사람이 읽을 부분만.
const summary = computed(() => readableDescription(item.value?.description));

// 에이전트 진행 기록. 실시간으로 쌓인다.
const feed = ref<any[]>([]);
const rawEvents = ref<any[]>([]);

/**
 * 지금 누가 기다리고 있는가.
 *
 * 프로세스 생성은 도중에 사용자에게 묻고 멈춘다. 그때도 "처리하고 있습니다"
 * 라고 하면 사용자는 계속 기다리기만 하고 작업은 영원히 진행되지 않는다.
 */
const progressState = computed(() => feedState(rawEvents.value));

// 사람이 답해야 이어지는 물음들.
// 만들 대상이 있는 물음만 사람에게 보인다. 나머지는 화면이 대신 답한다.
const questions = computed(() => toQuestions(item.value?.task?.output).filter((q) => q.items.length > 0));
const answering = ref(false);
const answerError = ref('');

/**
 * 이 작업을 시킨 대화로 돌아간다.
 *
 * 그냥 채팅 첫 화면으로 보내면 사용자는 어느 대화였는지 다시 찾아야 한다.
 * 실제로 "대화로" 가 새 대화 화면으로 갔다.
 */
function goToChat() {
    const roomId = originRoomId(item.value?.task);
    void router.push(roomId ? `/chat/${encodeURIComponent(roomId)}` : '/chat');
}

/**
 * 만들 대상이 없는 물음에 대신 답한다.
 *
 * "규칙을 만들까요?" 인데 만들 규칙이 하나도 없으면 물어도 뜻이 없다.
 * 그대로 두면 작업만 멈춘다.
 */
async function answerEmptyQuestions() {
    const ids = emptyQuestionIds(item.value?.task?.output);
    if (!ids.length || answering.value) return;

    answering.value = true;
    try {
        for (const id of ids) {
            await submitAnswer({
                supabase: (window as any).$supabase,
                taskId: String(item.value?.taskId || ''),
                questionId: id,
                answer: '아니오',
                reason: '만들 대상 없음'
            });
        }
        await load();
    } finally {
        answering.value = false;
    }
}

/** 답을 저장한다. 다 채워지면 워커가 다시 깨어난다. */
async function answer(question: any, value: string) {
    answering.value = true;
    answerError.value = '';
    try {
        const result = await submitAnswer({
            supabase: (window as any).$supabase,
            taskId: String(item.value?.taskId || ''),
            questionId: question.id,
            answer: value
        });
        if (!result.ok) {
            answerError.value = '답변을 저장하지 못했습니다. 다시 시도해 주세요.';
            return;
        }
        await load();
    } finally {
        answering.value = false;
    }
}
let eventChannel: any = null;

/**
 * 진행 기록을 구독한다.
 *
 * 이미 지나간 것도 먼저 한 번 읽는다 — 화면을 나중에 열면 그 전 기록이
 * 통째로 비어 보인다.
 */
async function watchProgress(taskId: string) {
    const supabase = (window as any).$supabase;
    if (!supabase || !taskId) return;

    try {
        const { data } = await supabase.from('events').select('*').eq('todo_id', taskId).order('seq');
        rawEvents.value = data || [];
        feed.value = toFeed(rawEvents.value);
    } catch (e) {
        console.warn('[task] 진행 기록 조회 실패', e);
    }

    eventChannel = supabase
        .channel(`task-events-${taskId}`)
        .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'events', filter: `todo_id=eq.${taskId}` },
            (payload: any) => {
                rawEvents.value = [...rawEvents.value, payload.new];
                feed.value = toFeed(rawEvents.value);
                // 끝났으면 업무 자체도 다시 읽어 상태와 산출물을 반영한다.
                if (isFinished(payload.new)) void load();
            }
        )
        .subscribe();
}

const finished = computed(() => (item.value ? isDone(item.value) : false));
const due = computed(() => (item.value ? dueLabel(item.value.dueDate) : ''));
const overdue = computed(() => (item.value ? isOverdue(item.value.dueDate) : false));
const submittable = computed(() => canSubmitOnMobile(fields.value));
const draft = computed(() => (item.value ? draftText(item.value) : ''));

async function load() {
    loading.value = true;
    error.value = '';
    try {
        const taskId = decodeURIComponent(String(route.params.id || ''));
        const list = (await backend().getWorkList({ match: { id: taskId } })) || [];
        item.value = list[0] || null;
        if (!item.value) return;

        formId.value = formIdOf(item.value.task);
        const definition = formId.value
            ? await backend().getFormFields(formId.value)
            : await backend().getFormFields(null, item.value.tracingTag, item.value.defId);

        if (definition) {
            formId.value = formId.value || definition.id;
            fields.value = toMobileFields(definition.fields_json);
            // 이미 입력해 둔 값이 있으면 이어서 쓴다.
            const saved = item.value.task?.output?.[formId.value];
            values.value = initialValues(fields.value, saved);
        }

        await loadPriorSteps();
    } catch (e: any) {
        error.value = '업무를 불러오지 못했습니다.';
        console.error('[task] 조회 실패', e);
    } finally {
        loading.value = false;
    }
}

/**
 * 이 건의 앞 단계에서 무엇이 정해졌는지 모아 온다.
 *
 * 승인만 하면 되는 업무에는 입력칸이 없다. 그때 이것이 없으면 무엇을 근거로
 * 승인하라는 것인지 알 수 없다 — 화면에 활동 이름과 빈칸만 남는다.
 *
 * 실패해도 업무 처리는 막지 않는다. 근거가 안 보일 뿐 화면 자체는 쓸 수 있다.
 */
async function loadPriorSteps() {
    const instId = item.value?.task?.proc_inst_id;
    if (!instId) return;

    try {
        const siblings = (await backend().getWorkList({ match: { proc_inst_id: instId } })) || [];
        const ordered = siblings
            .map((w: any) => w.task || w)
            .sort((a: any, b: any) => String(a.start_date || '').localeCompare(String(b.start_date || '')));
        priorSteps.value = previousOutputs(ordered, item.value?.taskId);

        // 필드 이름은 폼 정의에 있다. 먼저 그려 놓고 뒤따라 채운다 — 이것 하나
        // 때문에 앞 단계 내용이 늦게 뜨면 손해가 더 크다.
        void loadPriorLabels(ordered);

        // 에이전트가 맡은 업무면 진행 기록을 함께 본다.
        if (byAgent.value && !eventChannel) void watchProgress(String(item.value?.taskId || ''));

        // 만들 대상이 없는 물음은 사람을 붙잡을 이유가 없다. 대신 답하고 이어 간다.
        void answerEmptyQuestions();
    } catch (e) {
        console.warn('[task] 이전 단계 조회 실패', e);
    }
}

/**
 * 앞 단계의 필드 이름을 그 단계의 폼 정의에서 가져온다.
 *
 * 없으면 `end_date` 가 "end date" 로 보인다. 값은 맞지만 무엇을 뜻하는지는
 * 폼에 적힌 이름("출장 종료일")을 봐야 안다 — 승인 판단의 근거로 쓰는 화면이라
 * 이름이 어긋나면 곤란하다.
 *
 * 같은 폼을 여러 단계가 쓰기도 하므로 폼 하나당 한 번만 부른다.
 */
async function loadPriorLabels(ordered: any[]) {
    const wanted = new Map<string, any>();
    for (const step of priorSteps.value) {
        const row = ordered.find((o: any) => (o?.id || o?.taskId) === step.id);
        const formId = formIdOf(row);
        if (formId && !wanted.has(formId)) wanted.set(formId, row);
    }
    if (!wanted.size) return;

    const found: Record<string, Record<string, string>> = {};
    await Promise.all(
        [...wanted.entries()].map(async ([formId, row]) => {
            try {
                // 위치 인자다(formId, activityId, procDefId).
                const form = await backend().getFormFields(formId, row?.activity_id, row?.proc_def_id);
                const labels: Record<string, string> = labelsFromFields(form?.fields_json);
                if (Object.keys(labels).length) found[formId] = labels;
            } catch (_e) {
                // 이름을 못 가져와도 값은 이미 보인다. 조용히 둔다.
            }
        })
    );

    if (Object.keys(found).length) priorSteps.value = previousOutputs(ordered, item.value?.taskId, found);
}

async function submit() {
    submitting.value = true;
    error.value = '';
    try {
        // 포털의 완료 경로를 그대로 쓴다. 이 안에서 프로세스 다음 단계가 만들어진다.
        const result: any = await backend().putWorkItemComplete(item.value.taskId, {
            formId: formId.value,
            parameterValues: values.value
        });

        // putWorkItemComplete 는 실패해도 예외를 던지지 않고 오류 **본문**을 돌려준다
        // (공용 axios 가 Error 가 아니라 응답 데이터로 거절하기 때문이다).
        // Error 만 보면 404 가 통과해, 처리되지 않은 업무가 완료된 것처럼 보인다.
        if (completionFailed(result)) {
            error.value = failureText(result);
            return;
        }

        await router.replace('/tasks');
    } catch (e: any) {
        error.value = '제출하지 못했습니다. 다시 시도해 주세요.';
        console.error('[task] 제출 실패', e);
    } finally {
        submitting.value = false;
    }
}

/**
 * 초안에 의견을 보내고 에이전트에게 다시 맡긴다.
 *
 * 의견만 저장하고 끝내면 에이전트는 멈춘 채로 남는다. 사용자에게는 "보냈는데
 * 아무 일도 안 일어남" 으로 보인다. feedbackPatch 가 다시 깨우는 표시까지 넣는다.
 */
async function sendOpinion() {
    sendingOpinion.value = true;
    error.value = '';
    try {
        const session = await currentSession();
        const patch = feedbackPatch({
            existingFeedback: item.value.task?.feedback,
            text: opinion.value,
            status: item.value.status,
            agentOrch: item.value.task?.agent_orch,
            userId: session?.user?.id || null
        });
        if (!patch) return;

        await backend().putWorkItem(item.value.taskId, patch);
        await router.replace('/tasks');
    } catch (e: any) {
        error.value = '의견을 보내지 못했습니다. 다시 시도해 주세요.';
        console.error('[task] 의견 전송 실패', e);
    } finally {
        sendingOpinion.value = false;
    }
}

onUnmounted(() => {
    try {
        eventChannel?.unsubscribe?.();
    } catch (_e) {}
});

onMounted(load);
</script>

<style scoped>
/* --- 사람에게 묻는 자리 --- */
.ask {
    background: var(--surface);
    border: 1px solid var(--brand);
    border-radius: var(--radius);
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 14px;
}

.ask__head {
    margin: 0;
    font-size: 1rem;
    font-weight: 700;
}

.ask__item {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.ask__items {
    margin: 4px 0 0;
    padding-left: 18px;
    font-size: 0.88rem;
    color: var(--ink-soft);
}

.ask__items li {
    margin: 2px 0;
}

.ask__actions {
    display: flex;
    gap: 8px;
    margin-top: 6px;
}

.ask__actions .m-btn {
    flex: 1;
}

/* --- 에이전트 진행 기록 --- */
.feed {
    list-style: none;
    margin: 0;
    padding: 0 0 0 4px;
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.feed__row {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    font-size: 0.86rem;
    color: var(--ink-soft);
    line-height: 1.45;
}

.feed__mark {
    width: 7px;
    height: 7px;
    margin-top: 6px;
    border-radius: 50%;
    flex: none;
    background: var(--brand);
    opacity: 0.45;
}

.feed__row--done .feed__mark {
    opacity: 1;
}

.feed__row--failed .feed__mark {
    background: var(--danger);
}

.feed__body {
    flex: 1;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}

.feed__tag {
    font-size: 0.72rem;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 4px;
    background: var(--sunk);
    color: var(--ink-faint);
    flex: none;
}

/* --- 에이전트가 처리 중 --- */
.agent {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    background: var(--surface);
    border: 1px solid var(--rule);
    border-radius: var(--radius);
}

.agent__dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--ink-faint);
    flex: none;
}

.agent__dot--run {
    background: var(--brand);
}

/* 사람을 기다리는 중 — 깜빡이지 않는다. 진행 중처럼 보이면 안 된다. */
.agent--failed {
    border-color: var(--danger, #c0392b);
}

.agent__dot--failed {
    background: var(--danger, #c0392b);
    box-shadow: none;
    animation: none;
}

.agent__dot--wait {
    background: var(--danger);
}

@media (prefers-reduced-motion: no-preference) {
    .agent__dot--run {
        animation: agent-pulse 1.4s ease-in-out infinite;
    }
    @keyframes agent-pulse {
        50% {
            opacity: 0.35;
        }
    }
}

.agent__body {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 0.9rem;
}

.agent__refresh {
    flex: none;
    min-height: 34px;
    padding: 0 12px;
    font-size: 0.82rem;
}

/* --- 이전 단계 내용 --- */
.prior {
    background: var(--surface);
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.prior__title {
    margin: 0;
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--ink-faint);
    letter-spacing: 0.02em;
}

.prior__step {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.prior__head {
    display: flex;
    align-items: baseline;
    gap: 8px;
    font-size: 0.9rem;
}

/* 항목과 값을 두 칸으로. 훑을 때 값만 따라 읽을 수 있어야 한다. */
.prior__fields {
    margin: 0;
    display: grid;
    grid-template-columns: minmax(72px, 34%) 1fr;
    gap: 4px 10px;
    font-size: 0.88rem;
}

.prior__fields dt {
    color: var(--ink-faint);
    overflow: hidden;
    text-overflow: ellipsis;
}

.prior__fields dd {
    margin: 0;
    word-break: break-word;
}

.draft {
    background: var(--surface);
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.draft__title {
    margin: 0;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--ink-soft);
}

/* 초안은 줄바꿈이 의미를 가진다. 다만 긴 줄이 화면을 옆으로 밀지 않게 접는다. */
.draft__body {
    margin: 0;
    background: var(--sunk);
    border-radius: var(--radius);
    padding: 12px;
    font-family: inherit;
    font-size: 0.92rem;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 45vh;
    overflow-y: auto;
}

.late {
    color: var(--danger);
    font-weight: 600;
}
</style>
