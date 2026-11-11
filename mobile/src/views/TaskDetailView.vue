<template>
    <div class="m-screen">
        <header class="m-appbar task-bar">
            <button type="button" aria-label="뒤로" @click="goBack"><Icon name="back" /></button>
            <div class="task-bar__title">
                <h1>{{ approval ? `승인 요청 · ${headline}` : headline }}</h1>
                <span v-if="barSubtitle" class="m-muted">{{ barSubtitle }}</span>
            </div>
            <button
                v-if="instId"
                type="button"
                aria-label="진행 상황"
                @click="router.push(`/instances/${encodeURIComponent(instId)}`)"
            >
                <Icon name="progress" />
            </button>
        </header>

        <div class="m-body task-body">
            <p v-if="loading && !item" class="m-muted">불러오는 중…</p>

            <template v-else-if="item">
                <!-- 그 자체가 에이전트 일(프로세스 생성 등) — 폼이 아니라 진행 상태 -->
                <template v-if="agentOnly">
                    <div class="m-card">
                        <span class="m-muted">{{ item.defId || '진행 건' }}</span>
                        <strong>{{ headline }}</strong>
                        <p v-if="summary" class="m-muted">{{ summary }}</p>
                    </div>
                    <section class="agent" :class="{ 'agent--failed': failed }">
                        <span
                            class="agent__dot"
                            :class="{
                                'agent__dot--run': stillRunning(item.task) && progressState !== 'waiting',
                                'agent__dot--wait': progressState === 'waiting',
                                'agent__dot--failed': failed
                            }"
                            aria-hidden="true"
                        ></span>
                        <span class="agent__body">
                            <strong>{{ progressState === 'waiting' ? '내 확인을 기다리고 있습니다.' : statusText }}</strong>
                            <span v-if="progressState === 'waiting'" class="m-muted">대화로 돌아가 답해 주셔야 이어집니다.</span>
                            <span v-else-if="failed" class="m-muted">잠시 후 다시 시도해 주세요. 계속 실패하면 웹에서 확인해 주세요.</span>
                            <span v-else class="m-muted">에이전트가 대신 처리합니다. 끝나면 알림으로 알려 드립니다.</span>
                        </span>
                        <button v-if="progressState === 'waiting'" type="button" class="m-btn agent__refresh" @click="goToChat">대화로</button>
                        <button v-else type="button" class="m-btn agent__refresh" :disabled="loading" @click="load">새로고침</button>
                    </section>
                    <section v-if="questions.length" class="ask">
                        <h2 class="ask__head">이어서 진행하려면 답해 주세요</h2>
                        <div v-for="q in questions" :key="q.id" class="ask__item">
                            <strong>{{ q.title }}</strong>
                            <span v-if="q.hint" class="m-muted">{{ q.hint }}</span>
                            <ul v-if="q.items.length" class="ask__items">
                                <li v-for="name in q.items" :key="name">{{ name }}</li>
                            </ul>
                            <p v-if="q.answered" class="m-muted">답하셨습니다.</p>
                            <div v-else class="ask__actions">
                                <button class="m-btn m-btn--primary" :disabled="answering" @click="answer(q, '예')">예</button>
                                <button class="m-btn" :disabled="answering" @click="answer(q, '아니오')">아니오</button>
                            </div>
                        </div>
                        <p v-if="answerError" class="m-note m-note--danger">{{ answerError }}</p>
                    </section>
                    <ol v-if="feed.length" class="feed">
                        <li v-for="f in feed" :key="f.id" class="feed__row" :class="{ 'feed__row--done': f.done, 'feed__row--failed': f.failed }">
                            <span class="feed__mark" aria-hidden="true"></span>
                            <span class="feed__body">
                                <span v-if="f.tag" class="feed__tag">{{ f.tag }}</span>
                                <span>{{ f.text }}</span>
                            </span>
                        </li>
                    </ol>
                </template>

                <!-- 승인 · 반려 -->
                <template v-else-if="approval && !finished">
                    <ApprovalBody
                        v-model="comment"
                        :subject="subject || headline"
                        :files="files"
                        :long-text="longText"
                        :facts="facts"
                        :summary="prevSummary"
                        :history="history"
                        :comment-label="approval.commentLabel"
                        :warn="rejectTried && !comment.trim()"
                    />
                    <MobileForm
                        v-if="approval.others.length"
                        :fields="approval.others"
                        :values="values"
                        @update:values="values = $event"
                        @voice-error="(m: string) => (error = m)"
                    />
                </template>

                <!-- 사람이 채우는 업무 -->
                <template v-else>
                    <div class="chips">
                        <span v-if="myTurn" class="m-tag m-tag--brand">내 차례</span>
                        <span v-if="step" class="m-tag">{{ step.no }}/{{ step.total }}단계</span>
                        <span v-if="due" class="m-tag" :class="{ 'm-tag--danger': overdue }">{{ /마감|지남/.test(due) ? due : `마감 ${due}` }}</span>
                    </div>

                    <!-- 왜(반려 사유) -->
                    <section v-if="rejection && !finished" class="reject">
                        <strong class="reject__head">
                            <Icon name="close" :size="18" /> 반려 사유<template v-if="rejection.who"> · {{ rejection.who }}</template><template v-if="rejection.at"> · {{ whenText(rejection.at) }}</template>
                        </strong>
                        <p>{{ rejection.comment || '반려되었습니다.' }}</p>
                    </section>

                    <!-- 무엇(앞 단계 내용) -->
                    <button v-if="priorSteps.length" type="button" class="m-card m-card--lg prior-card" @click="priorOpen = !priorOpen">
                        <span class="prior-card__text">
                            <span class="m-muted">{{ priorSteps[0].name }}</span>
                            <strong>{{ priorLine }}</strong>
                        </span>
                        <Icon :name="priorOpen ? 'chevron-down' : 'chevron-right'" class="prior-card__go" />
                    </button>
                    <section v-if="priorOpen && priorSteps.length" class="prior">
                        <div v-for="s in priorSteps" :key="s.id" class="prior__step">
                            <div class="prior__head">
                                <strong>{{ s.name }}</strong>
                                <span v-if="s.who" class="m-muted">{{ s.who }}</span>
                            </div>
                            <dl class="prior__fields">
                                <template v-for="f in s.fields" :key="f.key">
                                    <dt>{{ f.label }}</dt>
                                    <dd>{{ f.value }}</dd>
                                </template>
                            </dl>
                        </div>
                    </section>

                    <p v-if="finished" class="m-note">이미 완료된 업무입니다.</p>

                    <!-- 에이전트 -->
                    <section v-if="!finished && (state === 'running' || state === 'draft-ready' || state === 'failed')" class="abox" :class="`abox--${state}`">
                        <div class="abox__head">
                            <strong><Icon name="robot" :size="20" /> {{ state === 'draft-ready' ? '에이전트 초안' : state === 'failed' ? '에이전트가 처리하지 못했습니다' : '에이전트가 쓰는 중입니다' }}</strong>
                            <span v-if="state === 'draft-ready' && savedAt" class="abox__saved">자동 저장 {{ savedAt }}</span>
                            <span v-else-if="state === 'running'" class="m-spin abox__spin" aria-hidden="true"></span>
                        </div>
                        <ul v-if="state === 'draft-ready' && summaryList.length" class="abox__list">
                            <li v-for="(l, i) in summaryList" :key="i">{{ l }}</li>
                        </ul>
                        <p v-if="team" class="abox__team">{{ team.text }}</p>
                        <ol v-if="state === 'running' && feed.length" class="abox__feed">
                            <li v-for="f in feed.slice(-4)" :key="f.id" :class="{ done: f.done }">{{ f.text }}</li>
                        </ol>
                        <p v-if="state === 'running'" class="m-muted">끝나면 초안이 아래 폼에 채워집니다. 이 화면을 닫아도 됩니다.</p>
                        <p v-if="state === 'failed'" class="m-muted">아래 폼에 직접 쓰거나 다시 맡겨 주세요.</p>
                        <div v-if="state === 'draft-ready'" class="abox__actions">
                            <button type="button" class="m-btn abox__ghost" @click="draftOpen = !draftOpen">{{ draftOpen ? '초안 접기' : '초안 보기' }}</button>
                            <button type="button" class="m-btn m-btn--agent-solid" :disabled="!draftFill.count" @click="useDraft(true)">이 초안 쓰기</button>
                        </div>
                        <dl v-if="draftOpen" class="abox__draft">
                            <template v-for="f in draftRows" :key="f.key">
                                <dt>{{ f.label }}</dt>
                                <dd>{{ f.value }}</dd>
                            </template>
                            <p v-if="!draftRows.length" class="m-muted">폼에 채울 값이 없습니다.</p>
                        </dl>
                    </section>

                    <!-- 입력 -->
                    <template v-if="!finished">
                        <p v-if="!fields.length" class="m-note">입력할 항목이 없습니다. 확인 후 제출할 수 있습니다.</p>
                        <MobileForm
                            v-else
                            :fields="fields"
                            :values="values"
                            @update:values="onEdit"
                            @voice-error="(m: string) => (error = m)"
                        />
                        <p v-if="!submittable" class="m-note m-note--danger">
                            이 업무에는 휴대폰에서 입력할 수 없는 항목이 있습니다. PC 화면에서 열어 주세요.
                        </p>

                        <!-- 다시 맡기기(의견과 함께) -->
                        <section v-if="opinionOpen" class="m-card m-card--lg">
                            <div class="m-field">
                                <label for="opinion">에이전트에게 고칠 점을 적어 주세요</label>
                                <textarea id="opinion" v-model="opinion" rows="3" placeholder="예: 금액을 다시 확인해 주세요"></textarea>
                            </div>
                            <button class="m-btn m-btn--agent-solid m-btn--block" type="button" :disabled="!opinion.trim() || sendingOpinion" @click="sendOpinion">
                                {{ sendingOpinion ? '보내는 중…' : '의견 보내고 다시 맡기기' }}
                            </button>
                        </section>
                    </template>
                </template>

                <p v-if="error" class="m-note m-note--danger">{{ error }}</p>
            </template>

            <div v-else class="m-empty"><p>업무를 찾을 수 없습니다.</p></div>
        </div>

        <!-- 아래에 늘 붙어 있는 단추 -->
        <div v-if="item && !finished && !agentOnly && approval" class="m-actions m-actions--decide">
            <button type="button" class="m-btn m-btn--lg m-btn--outline-danger" :disabled="submitting" :aria-disabled="!canReject" @click="decide('reject')">
                <Icon name="close" :size="20" /> 반려
            </button>
            <button type="button" class="m-btn m-btn--lg m-btn--primary" :disabled="submitting" @click="decide('approve')">
                <Icon name="check" :size="20" /> {{ submitting ? '보내는 중…' : '승인' }}
            </button>
        </div>
        <div v-else-if="item && !finished && !agentOnly && myTurn" class="m-actions">
            <button
                type="button"
                class="m-btn m-btn--lg m-btn--agent"
                :disabled="delegating || state === 'running'"
                @click="onAgentButton"
            >
                <span v-if="delegating || state === 'running'" class="m-spin" aria-hidden="true"></span>
                <Icon v-else name="robot" :size="20" />
                {{ agentButtonText }}
            </button>
            <button
                type="button"
                class="m-btn m-btn--lg m-btn--primary"
                :disabled="!submittable || submitting || state === 'running'"
                @click="submit"
            >
                {{ submitting ? '제출 중…' : '제출' }}
            </button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import ApprovalBody from '../components/ApprovalBody.vue';
import Icon from '../components/Icon.vue';
import MobileForm from '../components/MobileForm.vue';
import { feedState, isFinished, loadEvents, toFeed } from '../lib/agentEvents.js';
import { agentFailed, agentState, agentStatusText, readableDescription, stillRunning, taskTitle } from '../lib/agentTask.js';
import { feedbackPatch } from '../lib/approval.js';
import { backend } from '../lib/backend.js';
import { refreshBadges } from '../lib/badges.js';
import { completionFailed, failureText } from '../lib/completion.js';
import { loadInstance } from '../lib/data.js';
import { canDecide, decisionForm, decisionHistory, decisionValues, lastRejection } from '../lib/decision.js';
import { delegate } from '../lib/delegation.js';
import { draftValues, fallbackLines, fillableDraft, hasUserInput, summaryLines, summaryOf, teamNote } from '../lib/draft.js';
import { withHtmlItems } from '../lib/formHtml.js';
import { canSubmitOnMobile, initialValues, toMobileFields } from '../lib/formSchema.js';
import { emptyQuestionIds, originRoomId, submitAnswer, toQuestions } from '../lib/hitlTask.js';
import { displayValue, flattenOutput, formIdOf, labelsFromFields, previousOutputs } from '../lib/outputs.js';
import { currentSession } from '../lib/session.js';
import { dueLabel, isDone, isOverdue } from '../lib/tasks.js';
import { assignedTo, fileOutputs, isActionable, isDoneRow, stepOf, subjectOf } from '../lib/workspace.js';

/**
 * 업무 하나.
 *
 * 위에서 아래로 「왜(반려 사유) → 무엇(앞 단계 내용) → 에이전트 초안 → 입력」. 「에이전트에 맡기기」 ·
 * 「제출」은 화면 아래에 늘 붙어 있다. 맡기면 에이전트가 쓰는 동안 진행을 보여 주고, 초안이 오면
 * 폼에 채워 바로 저장한다(다시 열어도 남는다). 사람은 확인하고 제출한다.
 *
 * 결정 칸(승인 · 반려)이 있는 업무는 승인 화면으로 연다 — 문서 · 핵심 값 · 지난 반려 이력을 한 화면에,
 * 결정 칸은 미리 고르지 않고 아래 두 단추로만 정하며, 반려는 의견이 있어야 한다.
 * 그 자체가 에이전트의 일인 업무(프로세스 생성 등)는 예전처럼 진행 상태만 보여 준다.
 */

const route = useRoute();
const router = useRouter();
const taskId = decodeURIComponent(String(route.params.id || ''));

const item = ref<any>(null);
const fields = ref<any[]>([]);
const values = ref<Record<string, any>>({});
const formId = ref('');
const rows = ref<any[]>([]);
const inst = ref<any>(null);
const processName = ref('');
const events = ref<any[]>([]);
const priorLabels = ref<Record<string, Record<string, string>>>({});
const prevSummary = ref('');

const loading = ref(true);
const submitting = ref(false);
const delegating = ref(false);
const error = ref('');
const comment = ref('');
const rejectTried = ref(false);
const opinion = ref('');
const opinionOpen = ref(false);
const sendingOpinion = ref(false);
const priorOpen = ref(false);
const draftOpen = ref(false);
const savedAt = ref('');

const task = computed(() => item.value?.task || null);
const state = computed(() => agentState(task.value));
const agentOnly = computed(() => state.value === 'agent-only');
const failed = computed(() => agentFailed(task.value));
const statusText = computed(() => agentStatusText(task.value));
const headline = computed(() => taskTitle(task.value, item.value?.name || '업무'));
const summary = computed(() => readableDescription(item.value?.description));
const feed = computed(() => toFeed(events.value));
const progressState = computed(() => feedState(events.value));
const finished = computed(() => (item.value ? isDone(item.value) : false));
const uid = () => localStorage.getItem('uid') || '';
const myTurn = computed(() => !!task.value && assignedTo(task.value, uid()) && isActionable(task.value));
const instId = computed(() => task.value?.proc_inst_id || '');
const subject = computed(() => subjectOf(inst.value?.proc_inst_name, processName.value));
const step = computed(() => (task.value && instId.value ? stepOf(task.value, rows.value) : null));
const due = computed(() => dueLabel(task.value?.due_date));
const overdue = computed(() => isOverdue(task.value?.due_date));
const submittable = computed(() => canSubmitOnMobile(fields.value));
const rejection = computed(() => (task.value ? lastRejection(rows.value, task.value) : null));
const history = computed(() => (task.value ? decisionHistory(rows.value, task.value) : []));

// 사람이 답해야 이어지는 물음(에이전트 일). 만들 대상이 있는 물음만.
const questions = computed(() => toQuestions(task.value?.output).filter((q: any) => q.items.length > 0));
const answering = ref(false);
const answerError = ref('');

/** 결정 칸이 있는 내 업무면 승인 화면 */
const approval = computed(() => {
    if (!myTurn.value || agentOnly.value) return null;
    const form = decisionForm(fields.value);
    if (!form) return null;
    const label = fields.value.find((f: any) => f.key === form.commentKey)?.label || '의견';
    return { ...form, commentLabel: label };
});

/** 끝난 앞 단계들(끝난 순서) */
const doneBefore = computed(() =>
    rows.value
        .filter((r: any) => isDoneRow(r) && r.id !== taskId)
        .sort((a: any, b: any) => new Date(a.end_date || 0).getTime() - new Date(b.end_date || 0).getTime())
);
const priorSteps = computed(() => previousOutputs(doneBefore.value, '__none__', priorLabels.value));
const priorLine = computed(() => {
    const first = priorSteps.value[0];
    if (!first) return '';
    return first.fields
        .slice(0, 4)
        .map((f: any) => (f.value.length > 24 ? `${f.value.slice(0, 24)}…` : f.value))
        .join(' · ');
});

/** 승인 화면: 바로 앞 단계(올린 사람)의 값 — 짧은 것은 칸으로, 긴 것은 문서처럼 */
const prevRow = computed(() => doneBefore.value[doneBefore.value.length - 1] || null);
const prevFields = computed(() =>
    prevRow.value ? flattenOutput(prevRow.value.output, priorLabels.value[formIdOf(prevRow.value)]) : []
);
const facts = computed(() => prevFields.value.filter((f: any) => f.value.length <= 40).slice(0, 6));
const longText = computed(() => {
    const pick = (list: any[]) => list.filter((f: any) => f.value.length > 40).sort((a: any, b: any) => b.value.length - a.value.length)[0];
    // 올린 사람이 쓴 긴 글(제안서 본문 등), 없으면 맨 처음 요청 내용
    const first = doneBefore.value[0];
    const long =
        pick(prevFields.value) ||
        (first && first !== prevRow.value ? pick(flattenOutput(first.output, priorLabels.value[formIdOf(first)])) : null);
    return long ? { label: long.label, value: long.value } : null;
});
const files = computed(() =>
    fileOutputs(rows.value)
        .reverse()
        .map((f: any) => ({ ...f, when: f.at ? whenText(f.at) : '' }))
);
const barSubtitle = computed(() => {
    if (approval.value && prevRow.value) {
        const who = prevRow.value.username ? `${prevRow.value.username}가 올림` : '';
        const at = prevRow.value.end_date ? whenText(prevRow.value.end_date) : '';
        return [who, at, `${history.value.length + 1}번째 검토`].filter(Boolean).join(' · ');
    }
    return subject.value || processName.value;
});
const canReject = computed(() => canDecide('reject', comment.value));

/** 초안 */
const draft = computed(() => (task.value ? draftValues(task.value, formId.value) : {}));
const draftFill = computed(() => {
    const v = fillableDraft(fields.value, draft.value);
    return { values: v, count: Object.keys(v).length };
});
const draftRows = computed(() =>
    Object.entries(draftFill.value.values).map(([key, value]) => {
        const text = displayValue(value);
        return {
            key,
            label: fields.value.find((f: any) => f.key === key)?.label || key,
            value: text.length > 400 ? `${text.slice(0, 400)}…` : text
        };
    })
);
const team = computed(() => teamNote(events.value));
const summaryList = computed(() => {
    const lines = summaryLines(summaryOf(events.value));
    return lines.length ? lines : fallbackLines(fields.value, draftFill.value.values);
});
const agentButtonText = computed(() => {
    if (delegating.value) return '맡기는 중…';
    if (state.value === 'running') return '에이전트가 쓰는 중';
    if (state.value === 'draft-ready') return '다시 맡기기';
    return '에이전트에 맡기기';
});

function whenText(at: string) {
    const d = new Date(at);
    if (Number.isNaN(d.getTime())) return '';
    const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    return new Date().toDateString() === d.toDateString() ? `오늘 ${hm}` : `${d.getMonth() + 1}/${d.getDate()} ${hm}`;
}

function goBack() {
    if (window.history.length > 1) router.back();
    else void router.replace('/tasks');
}

function goToChat() {
    const roomId = originRoomId(task.value);
    void router.push(roomId ? `/chat/${encodeURIComponent(roomId)}` : '/chat');
}

async function load() {
    loading.value = true;
    error.value = '';
    try {
        const list = (await backend().getWorkList({ match: { id: taskId } })) || [];
        item.value = list[0] || null;
        if (!item.value) return;

        formId.value = formIdOf(item.value.task);
        const definition = formId.value
            ? await backend().getFormFields(formId.value)
            : await backend().getFormFields(null, item.value.tracingTag, item.value.defId);
        if (definition) {
            formId.value = formId.value || definition.id;
            fields.value = withHtmlItems(toMobileFields(definition.fields_json), definition.html);
            const saved = item.value.task?.output?.[formId.value];
            values.value = initialValues(fields.value, saved);
        }

        const supabase = (window as any).$supabase;
        const tenant = (window as any).$tenantName || null;
        if (item.value.task?.proc_inst_id) {
            const found = await loadInstance(supabase, { instId: item.value.task.proc_inst_id, tenant });
            rows.value = found.rows;
            inst.value = found.inst;
            processName.value = found.processName;
            void loadPriorLabels();
        }
        try {
            events.value = await loadEvents(supabase, taskId);
        } catch (e) {
            console.warn('[task] 진행 기록 조회 실패', e);
        }

        // 초안이 왔고 아직 아무것도 적지 않았으면 채워 바로 저장한다(다시 열어도 남게).
        const saved = item.value.task?.output?.[formId.value];
        if (state.value === 'draft-ready' && myTurn.value && !hasUserInput(saved) && draftFill.value.count) {
            await useDraft(false);
        }

        if (agentOnly.value) void answerEmptyQuestions();
        if (approval.value && prevRow.value) void loadPrevSummary(prevRow.value.id);
    } catch (e: any) {
        error.value = '업무를 불러오지 못했습니다.';
        console.error('[task] 조회 실패', e);
    } finally {
        loading.value = false;
        watchChanges();
    }
}

/** 앞 단계 칸 이름(「end_date」 대신 「출장 종료일」) */
async function loadPriorLabels() {
    const wanted = new Map<string, any>();
    for (const r of rows.value) {
        const id = formIdOf(r);
        if (id && !wanted.has(id) && !priorLabels.value[id]) wanted.set(id, r);
    }
    const found: Record<string, Record<string, string>> = {};
    await Promise.all(
        [...wanted.entries()].map(async ([id, r]) => {
            try {
                const form = await backend().getFormFields(id, r?.activity_id, r?.proc_def_id);
                const labels = labelsFromFields(form?.fields_json);
                if (Object.keys(labels).length) found[id] = labels;
            } catch (_e) {
                // 이름을 못 찾으면 칸 이름 그대로 보인다
            }
        })
    );
    priorLabels.value = { ...priorLabels.value, ...found };
}

/** 올린 사람이 에이전트에 맡겨 썼다면 그 요약 */
async function loadPrevSummary(rowId: string) {
    try {
        prevSummary.value = summaryOf(await loadEvents((window as any).$supabase, rowId));
    } catch (_e) {
        prevSummary.value = '';
    }
}

/** 지금 값을 이 업무의 중간 저장 칸(output)에 쓴다 — 포털 「중간 저장」 과 같은 길 */
async function autosave() {
    if (!formId.value || !task.value?.proc_inst_id) return;
    await backend().setVariableWithTaskId(task.value.proc_inst_id, taskId, formId.value, { valueMap: { ...values.value } });
    const d = new Date();
    savedAt.value = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** 초안을 폼에 채우고 저장한다. force 면 이미 적은 값도 초안으로 바꾼다. */
async function useDraft(force: boolean) {
    const next = force ? { ...values.value, ...draftFill.value.values } : { ...draftFill.value.values, ...nonEmpty(values.value) };
    values.value = next;
    try {
        await autosave();
    } catch (e) {
        console.warn('[task] 초안 저장 실패', e);
        error.value = '초안을 저장하지 못했습니다. 제출하기 전에 다시 확인해 주세요.';
    }
}

function nonEmpty(v: Record<string, any>) {
    return Object.fromEntries(Object.entries(v || {}).filter(([, x]) => x !== '' && x !== null && x !== undefined && !(Array.isArray(x) && !x.length)));
}

function onEdit(next: Record<string, any>) {
    values.value = next;
}

async function onAgentButton() {
    if (state.value === 'draft-ready') {
        opinionOpen.value = !opinionOpen.value;
        return;
    }
    delegating.value = true;
    error.value = '';
    try {
        await delegate(backend(), task.value);
        await load();
        void refreshBadges();
    } catch (e) {
        console.error('[task] 맡기기 실패', e);
        error.value = '에이전트에 맡기지 못했습니다. 다시 시도해 주세요.';
    } finally {
        delegating.value = false;
    }
}

async function complete(parameterValues: Record<string, any>) {
    submitting.value = true;
    error.value = '';
    try {
        // 포털의 완료 경로를 그대로 쓴다. 이 안에서 프로세스 다음 단계가 만들어진다.
        const result: any = await backend().putWorkItemComplete(taskId, { formId: formId.value, parameterValues });
        // putWorkItemComplete 는 실패해도 예외 대신 오류 본문을 돌려준다.
        if (completionFailed(result)) {
            error.value = failureText(result);
            return false;
        }
        void refreshBadges();
        await router.replace('/tasks');
        return true;
    } catch (e: any) {
        error.value = '제출하지 못했습니다. 다시 시도해 주세요.';
        console.error('[task] 제출 실패', e);
        return false;
    } finally {
        submitting.value = false;
    }
}

function submit() {
    return complete(values.value);
}

/** 반려 · 승인. 미리 고른 값은 없다 — 누른 단추가 곧 결정이다. 반려는 의견이 있어야 한다. */
async function decide(kind: 'approve' | 'reject') {
    if (!approval.value) return;
    if (!canDecide(kind, comment.value)) {
        rejectTried.value = true;
        error.value = '반려하려면 의견을 적어 주세요.';
        document.getElementById('decision-comment')?.focus();
        return;
    }
    await complete(decisionValues(approval.value, kind, comment.value, values.value));
}

/** 초안에 의견을 보내고 다시 맡긴다(draft_status → FB_REQUESTED 로 워커를 깨운다). */
async function sendOpinion() {
    sendingOpinion.value = true;
    error.value = '';
    try {
        const session = await currentSession();
        const patch = feedbackPatch({
            existingFeedback: task.value?.feedback,
            text: opinion.value,
            status: item.value.status,
            agentOrch: task.value?.agent_orch,
            userId: session?.user?.id || null
        });
        if (!patch) return;
        await backend().putWorkItem(taskId, patch);
        opinion.value = '';
        opinionOpen.value = false;
        await load();
    } catch (e: any) {
        error.value = '의견을 보내지 못했습니다. 다시 시도해 주세요.';
        console.error('[task] 의견 전송 실패', e);
    } finally {
        sendingOpinion.value = false;
    }
}

/** 답을 저장한다(에이전트 일의 물음). 다 채워지면 워커가 다시 깨어난다. */
async function answer(question: any, value: string) {
    answering.value = true;
    answerError.value = '';
    try {
        const result = await submitAnswer({ supabase: (window as any).$supabase, taskId, questionId: question.id, answer: value });
        if (!result.ok) {
            answerError.value = '답변을 저장하지 못했습니다. 다시 시도해 주세요.';
            return;
        }
        await load();
    } finally {
        answering.value = false;
    }
}

/** 만들 대상이 없는 물음은 사람을 붙잡을 이유가 없다. 대신 답하고 이어 간다. */
async function answerEmptyQuestions() {
    const ids = emptyQuestionIds(task.value?.output);
    if (!ids.length || answering.value) return;
    answering.value = true;
    try {
        for (const id of ids) {
            await submitAnswer({ supabase: (window as any).$supabase, taskId, questionId: id, answer: '아니오', reason: '만들 대상 없음' });
        }
        await load();
    } finally {
        answering.value = false;
    }
}

/**
 * 진행 기록과 이 업무의 상태를 실시간으로 본다 — 맡긴 뒤 초안이 오면 화면을 다시 읽어 채운다.
 */
let channel: any = null;
let reloadTimer: any = null;
function reloadSoon() {
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => void load(), 800);
}
function watchChanges() {
    const supabase = (window as any).$supabase;
    if (!supabase || channel || !taskId) return;
    channel = supabase
        .channel(`m-task-${taskId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'events', filter: `todo_id=eq.${taskId}` }, (payload: any) => {
            events.value = [...events.value, payload.new];
            if (isFinished(payload.new)) reloadSoon();
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'todolist', filter: `id=eq.${taskId}` }, (payload: any) => {
            const before = task.value?.draft_status;
            const after = payload.new?.draft_status;
            if (before !== after || payload.new?.status !== task.value?.status) reloadSoon();
        })
        .subscribe();
}

onMounted(load);
onUnmounted(() => {
    clearTimeout(reloadTimer);
    try {
        if (channel) (window as any).$supabase?.removeChannel(channel);
    } catch (_e) {
        // 이미 끊겼다
    }
});
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

/* --- 휴대폰 웹: 업무 화면 -------------------------------------------------- */
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

.task-body {
    padding: 4px 16px 20px;
    gap: 12px;
}

.chips {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}

.reject {
    background: var(--danger-wash);
    border-radius: 14px;
    padding: 12px 14px;
}

.reject__head {
    display: flex;
    align-items: center;
    gap: 4px;
    color: var(--danger);
    font-size: 0.92rem;
}

.reject p {
    margin: 4px 0 0;
    color: var(--ink);
}

.prior-card {
    flex-direction: row;
    align-items: center;
    gap: 8px;
}

.prior-card__text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.prior-card__text strong {
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.prior-card__go {
    color: var(--ink-faint);
}

.abox {
    background: var(--agent-wash);
    border: 1px solid var(--agent-rule);
    border-radius: var(--radius-lg);
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.abox--failed {
    background: var(--danger-wash);
    border-color: transparent;
}

.abox__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
}

.abox__head strong {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--agent);
}

.abox--failed .abox__head strong {
    color: var(--danger);
}

.abox__saved {
    color: var(--agent);
    font-size: 0.85rem;
    font-weight: 600;
    opacity: 0.85;
}

.abox__spin {
    color: var(--agent);
}

.abox__list {
    margin: 0;
    padding-left: 20px;
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.abox__team {
    margin: 0;
    font-size: 0.86rem;
    color: var(--ink-soft);
}

.abox__feed {
    margin: 0;
    padding-left: 18px;
    font-size: 0.88rem;
    color: var(--ink-soft);
}

.abox__feed .done {
    color: var(--ink-faint);
}

.abox__actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-top: 4px;
}

.abox__ghost {
    background: var(--surface);
    color: var(--agent);
    border-color: var(--agent-rule);
}

.abox__draft {
    margin: 0;
    display: grid;
    grid-template-columns: minmax(70px, 30%) 1fr;
    gap: 6px 10px;
    font-size: 0.86rem;
    background: var(--surface);
    border-radius: 10px;
    padding: 10px;
}

.abox__draft dt {
    color: var(--ink-faint);
}

.abox__draft dd {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
}

.m-actions--decide {
    grid-template-columns: 1fr 1.3fr;
}
</style>
