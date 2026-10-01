<template>
    <div class="pg-tl">
        <!-- 휴대폰 간소화 화면에서는 띠 대신 입력창 위 한 줄 + 진행 상황 패널로 보인다(아래). -->
        <InstanceFlow v-if="!phoneShell" :instance="instance" :workList="workList" />

        <ChatThread
            ref="thread"
            class="pg-tl__thread"
            :messages="messages"
            :current-user-email="myEmail"
            empty-text="아직 진행된 작업이 없습니다."
        />

        <!--
            지금 누가 무엇을 하고 있는지. 말풍선이 아니라 대화 끝에 붙는 상태 한 줄이다 —
            누가 한 말이 아니라 화면의 상태이기 때문이다.
            에이전트·엔진이 일하는 중이면 클로드처럼 '✻ 작업 중…' 으로 움직이게 보이고,
            사람이 맡고 있으면 누가 하고 있는지만 조용히 적는다.
        -->
        <div
            v-if="working"
            class="pg-working"
            :class="{ 'pg-working--busy': working.busy }"
            role="status"
            aria-live="polite"
            data-testid="instance-working"
        >
            <span v-if="working.busy" class="pg-working__spark" aria-hidden="true">✻</span>
            <span class="pg-working__text">{{ working.text }}</span>
            <span v-if="working.what" class="pg-working__what">{{ working.what }}</span>
        </div>

        <!--
            내 차례. 채팅에서 에이전트가 사람에게 물을 때와 같은 자리다 —
            말풍선 사이가 아니라 입력창 바로 위에 붙어야, 지금 답할 것이 무엇인지 보인다.
        -->
        <div v-if="myTurn" class="pg-tl__hitl">
            <div class="pg-tl__hitl-head">
                <v-icon size="15" color="primary" class="mr-1">mdi-hand-back-right-outline</v-icon>
                <!--
                    초안(DRAFT) 모드는 에이전트가 폼을 채우고 제출은 내가 한다. 그냥 '내 차례' 라고만
                    하면 자동으로 끝나야 할 일이 왜 멈춰 있느냐고 읽힌다 — 무엇을 하면 되는지 적는다.
                -->
                <span v-if="myTurn.agentMode === 'DRAFT' && !draftRunning">초안 확인 후 제출해 주세요 — {{ myTurn.name }}</span>
                <span v-else>내 차례입니다 — {{ myTurn.name }}</span>
                <v-spacer></v-spacer>
                <v-btn size="x-small" variant="text" @click="goTask(myTurn)">따로 열기</v-btn>
            </div>
            <p v-if="myTurn.description" class="pg-tl__hitl-desc">{{ myTurn.description }}</p>

            <!--
                에이전트가 초안을 만드는 중. 기다릴 필요는 없다 — 아래 폼은 그대로 쓸 수 있고,
                먼저 적어 둔 값이 있으면 초안이 와도 덮어쓰지 않는다.
            -->
            <div v-if="draftRunning" class="pg-tl__draft pg-tl__draft--busy">
                <!-- 돌아가는 표시는 대화 끝의 '작업 중…' 한 곳에만 둔다. 여기는 할 수 있는 일을 알린다. -->
                에이전트가 초안을 만드는 중입니다. 먼저 적어 넣으셔도 됩니다.
            </div>

            <!-- 내가 이미 적어 둔 값이 있어 자동으로 채우지 않았다. 보고 고르게 한다. -->
            <div v-else-if="draftOffered" class="pg-tl__draft">
                <div class="pg-tl__draft-head">
                    <v-icon size="14" color="primary" class="mr-1">mdi-auto-fix</v-icon>
                    에이전트 초안이 준비됐습니다
                    <v-spacer></v-spacer>
                    <v-btn size="x-small" variant="text" @click="draftPreview = !draftPreview">
                        {{ draftPreview ? '접기' : '미리보기' }}
                    </v-btn>
                    <v-btn size="x-small" variant="flat" color="primary" @click="adoptDraft">채택하기</v-btn>
                </div>
                <div v-if="draftPreview" class="pg-tl__draft-body">
                    <div v-for="(l, i) in draftLines" :key="i" class="pg-tl__draft-line">
                        <span class="pg-tl__draft-k">{{ l.k }}</span>
                        <a v-if="l.href" class="pg-tl__draft-v pg-tl__draft-v--file" :href="l.href" :download="l.v">{{ l.v }}</a>
                        <span v-else class="pg-tl__draft-v">{{ l.v }}</span>
                    </div>
                </div>
            </div>

            <!-- 채울 것이 폼 하나뿐이라 따로 창을 띄우지 않는다. 여기서 채우고 보낸다. -->
            <div v-if="myTurnForm" class="pg-tl__form">
                <DynamicForm :key="myTurn.taskId" :formHTML="myTurnForm.html" v-model="formData" @update:modelValue="onFormTouched" />
            </div>
            <div v-else-if="formLoading" class="pg-tl__form-loading">
                <v-progress-circular indeterminate :size="16" :width="2" color="primary" class="mr-2"></v-progress-circular>
                입력할 내용을 불러오는 중…
            </div>

            <div class="pg-tl__hitl-actions">
                <v-btn color="primary" size="small" variant="flat" :loading="submitting" @click="submitMyTurn">제출</v-btn>
            </div>
        </div>

        <!--
            입력창은 채팅이 쓰는 것을 그대로 가지와 쓴다.
            지금까지 여기만 별도의 textarea 여서 보내기 단추 하나밖에 없었다 —
            파일을 붙이거나 말로 적는 일은 인스턴스 대화에서도 마찬가지로 필요하고,
            달리 만들어 두면 채팅 쓰다 이리 오는 사람이 다시 배우게 된다.
        -->
        <!--
            휴대폰: 지금 어디쯤인지 한 줄. 누르면 진행 상황 패널이 열린다.
            대화 위에 띠를 얹으면 화면을 먹고 대화와 따로 노는 것처럼 보였다 —
            Claude Code 가 할 일을 입력창 위 한 줄로 접어 두는 자리에 둔다.
        -->
        <div v-if="phoneShell" class="pg-tl__pill">
            <InstanceFlow
                variant="pill"
                :instance="instance"
                :workList="workList"
                :mineTaskId="(myTurn && myTurn.taskId) || ''"
                @open="openPanel('progress')"
            />
        </div>

        <UnifiedChatInput ref="composer" variant="inline" class="pg-tl__composer" @sendMessage="send" />

        <!--
            휴대폰: 앱바 오른쪽 패널 단추 → 클로드 Cowork 의 오른쪽 패널처럼
            '진행 상황' 과 '산출물' 을 접이식 칸으로 모아 보인다. 바깥을 누르면 닫힌다.
        -->
        <template v-if="phoneShell">
            <Teleport to="#pg-m-appbar-actions">
                <button
                    type="button"
                    class="pg-tl__panel-btn"
                    :class="{ 'pg-tl__panel-btn--on': panelOpen }"
                    aria-label="진행 상황 · 산출물"
                    data-testid="instance-panel-toggle"
                    @click="panelOpen ? (panelOpen = false) : openPanel('progress')"
                >
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                        <rect x="2.75" y="3.75" width="14.5" height="12.5" rx="2.25" stroke="currentColor" stroke-width="1.5" />
                        <path d="M12.5 4v12" stroke="currentColor" stroke-width="1.5" />
                    </svg>
                </button>
            </Teleport>
            <Teleport to="body">
                <div v-if="panelOpen" class="pg-m-side-scrim" @click="panelOpen = false"></div>
                <aside v-if="panelOpen" class="pg-m-side" data-testid="instance-side-panel">
                    <section class="pg-m-side__sec">
                        <button type="button" class="pg-m-side__head" :aria-expanded="sections.progress" @click="sections.progress = !sections.progress">
                            진행 상황
                            <v-icon size="16">{{ sections.progress ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon>
                        </button>
                        <div v-if="sections.progress" class="pg-m-side__body">
                            <InstanceFlow variant="list" :instance="instance" :workList="workList" :mineTaskId="(myTurn && myTurn.taskId) || ''" />
                        </div>
                    </section>
                    <section class="pg-m-side__sec">
                        <button type="button" class="pg-m-side__head" :aria-expanded="sections.output" @click="sections.output = !sections.output">
                            산출물
                            <v-icon size="16">{{ sections.output ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon>
                        </button>
                        <div v-if="sections.output" class="pg-m-side__body">
                            <InstanceOutput :instance="instance" :compact="true" />
                        </div>
                    </section>
                </aside>
            </Teleport>
        </template>
    </div>
</template>

<script>
/**
 * 인스턴스 대화.
 *
 * 한 인스턴스에서 벌어진 일을 대화로 읽는다 — 사람이 무엇을 끝냈는지,
 * 에이전트가 무슨 도구를 쓰며 무엇을 내놨는지, 지금 누가 일하는 중인지,
 * 그리고 사람들이 주고받은 말.
 *
 * 화면은 채팅방 것을 그대로 쓴다
 *   ChatThread — 말풍선, 보낸이·시각, '실행 상세 N건' 접기(도구 입력·결과),
 *   맨 아래 도는 표시. 채팅에서 에이전트 답변이 보이는 모양 그대로다.
 *   여기서 하는 일은 인스턴스에서 벌어진 일을 그 메시지 모양으로 옮기는 것뿐이다.
 *
 * 재료
 *   events    (proc_inst_id) — 에이전트가 한 일. 업무 하나가 메시지 하나가 된다.
 *   todolist  (instId)       — 업무의 상태 · 수행자 · 산출물 · 초안
 *   chats     (instId)       — 사람이 남긴 말
 *   셋 다 실시간으로 구독한다.
 */
import ChatThread from '@/components/chat/ChatThread.vue';
import agentEventTimeline from '@/components/ui/agentEventTimeline.js';
import DynamicForm from '@/components/designer/DynamicForm.vue';
import UnifiedChatInput from '@/components/chat/UnifiedChatInput.vue';
import InstanceFlow from './InstanceFlow.vue';
import InstanceOutput from './InstanceOutput.vue';
import BackendFactory from '@/components/api/BackendFactory';
import { usePhoneShell } from '@/shared/phoneShell';
import { fileNameOf, isWorkspacePath, workspaceFileUrl } from '@/utils/workspaceFile';
import { fetchFormDefs, formIdOf, hasValue, stripScopeSuffix } from '@/shared/workItemOutput';

const backend = BackendFactory.createBackend();

/** 에이전트가 손을 대는 업무인가. agent_mode 가 붙으면 에이전트가 관여한다. */
function hasAgent(raw) {
    return !!(raw && (raw.agent_mode || raw.agent_orch));
}


export default {
    name: 'InstanceTimeline',
    components: { ChatThread, DynamicForm, UnifiedChatInput, InstanceFlow, InstanceOutput },
    mixins: [agentEventTimeline],
    setup() {
        const { active: phoneShell } = usePhoneShell();
        return { phoneShell };
    },
    props: {
        instance: Object,
        participantUsers: {
            type: Array,
            default: () => []
        }
    },
    data: () => ({
        events: [],
        workList: [],
        chatRows: [],
        userList: [],

        // 내 차례 업무에 붙은 입력 폼
        formDefs: [],
        // 폼 정의를 받아 본 정의 id · 폼 id. 같은 것을 두 번 받지 않는다.
        formTried: new Set(),
        /** 휴대폰의 진행 상황 · 산출물 패널. */
        panelOpen: false,
        sections: { progress: true, output: true },
        formData: {},
        formLoading: false,
        submitting: false,
        loadedFormFor: null,

        /** 내가 폼에 손을 댔는가. 댔으면 에이전트 초안으로 덮지 않는다. */
        formTouched: false,
        /** 초안이 왔지만 내가 적어 둔 값이 있어 기다리는 중. */
        draftOffered: false,
        draftPreview: false,
        /** 초안을 채워 넣는 동안에는 '내가 손댔다' 로 보지 않는다. */
        draftAdopting: false,
        /** 폼이 스스로 올려 보낸 초기값. 이것과 같으면 손대지 않은 것이다. */
        formBaseline: '',

        width: typeof window !== 'undefined' ? window.innerWidth : 1280,

        workWatchRef: null,
        rootWatchRef: null,
        eventChannel: null,
        chatChannel: null
    }),
    computed: {
        instId() {
            return this.instance ? this.instance.instId : null;
        },
        isNarrow() {
            return this.width <= 768;
        },
        myUid() {
            try {
                return localStorage.getItem('uid') || '';
            } catch (e) {
                return '';
            }
        },
        myEmail() {
            try {
                return localStorage.getItem('email') || '';
            } catch (e) {
                return '';
            }
        },

        /**
         * 지금 누가 무엇을 하고 있는지 한 줄 — { busy, text, what } 또는 null.
         *
         * 아직 끝나지 않은 업무는 '한 말'이 없으니 말풍선으로 세우지 않는다.
         * 기계(에이전트 · 엔진)가 일하는 중이면 busy — 클로드의 '작업 중…' 처럼 움직이게 보인다.
         * 사람이 맡고 있으면 누가 하고 있는지만 적는다. 기다리는 것 말고 할 일이 없기 때문이다.
         * 내 차례(초안이 끝난 뒤)는 아래 '내 차례' 상자가 알리므로 비운다.
         */
        working() {
            if (this.draftRunning) return { busy: true, text: '작업 중…', what: `${this.myTurn.name} 초안` };
            if (this.autoTurn) return { busy: true, text: '작업 중…', what: this.autoTurn.name };

            // 제출된 뒤 엔진이 다음 단계를 여는 사이.
            const submitted = this.workList.find((x) => x.status === 'SUBMITTED');
            if (submitted) return { busy: true, text: '다음 단계로 넘기는 중…', what: submitted.name };

            // PENDING(서브 프로세스를 기다리는 부모 등)은 누가 '하고 있는' 것이 아니라 건너뛴다 —
            // 그 아래에서 실제로 돌아가는 자식 단계가 IN_PROGRESS 로 따로 있다.
            const w = this.workList.find((x) => x.status === 'IN_PROGRESS' && !(this.myTurn && this.myTurn.taskId === x.taskId));
            if (!w) return null;
            const byAgent = this.isAgentAssignee(w) || (w.task || {}).agent_mode === 'COMPLETE';
            const who = this.displayName(w) || (byAgent ? '에이전트' : '담당자');
            if (byAgent) return { busy: true, text: '작업 중…', what: `${w.name} · ${who}` };
            return { busy: false, text: `${who} 님이 진행 중`, what: w.name };
        },

        /**
         * 내가 지금 처리해야 하는 업무.
         *
         * 에이전트가 붙어 있어도 초안(DRAFT) 모드면 제출은 내가 한다 —
         * 그러니 초안이 도는 중에도 폼을 내준다. 기다릴지 먼저 적을지는 내가 고른다.
         * 끝까지 맡기는(COMPLETE) 모드만 빠진다.
         */
        myTurn() {
            const w = this.workList.find((x) => this.isMyPendingTask(x) && (x.task || {}).agent_mode !== 'COMPLETE');
            if (!w) return null;
            const raw = w.task || {};
            return {
                taskId: w.taskId,
                defId: w.defId,
                name: w.name,
                tool: w.tool || '',
                agentMode: raw.agent_mode || '',
                draftStatus: raw.draft_status || '',
                draft: raw.draft || null,
                // 액티비티 설명은 편집기에서 HTML(<p>…</p>)로 저장되기도 한다. 글자로 그대로 두면
                // 태그가 보이므로 본문만 꺼낸다.
                description: this.shorten(this.plainText(w.description), 200)
            };
        },

        /** 에이전트가 제출까지 맡는 내 업무. 알리기만 하고 입력창은 내지 않는다. */
        autoTurn() {
            const w = this.workList.find((x) => this.isMyPendingTask(x) && (x.task || {}).agent_mode === 'COMPLETE');
            return w ? { taskId: w.taskId, name: w.name } : null;
        },

        /** 초안을 만드는 중인가. */
        draftRunning() {
            if (!this.myTurn || this.myTurn.agentMode !== 'DRAFT') return false;
            return this.myTurn.draftStatus !== 'COMPLETED';
        },

        /** 폼 하나짜리라 폼 아이디로 한 겹 감싸여 온다. 벗겨서 값만 낸다. */
        draftValues() {
            const raw = this.myTurn && this.myTurn.draft;
            if (!raw || typeof raw !== 'object') return null;
            const id = (this.myTurn.tool || '').replace('formHandler:', '');
            const inner = id && raw[id] ? raw[id] : raw;
            return inner && typeof inner === 'object' ? inner : null;
        },

        /** 초안 값을 읽기 좋은 줄로. 미리보기에 쓴다. */
        draftLines() {
            const d = this.draftValues;
            if (!d) return [];
            return Object.keys(d).map((k) => {
                const raw = String(d[k]);
                const file = isWorkspacePath(raw);
                return {
                    k: String(k).replace(/_/g, ' '),
                    v: file ? fileNameOf(raw) : raw,
                    href: file ? workspaceFileUrl(raw) : ''
                };
            });
        },

        /** 내 차례 업무가 쓰는 입력 폼. tool 이 formHandler:<id> 로 가리킨다. */
        myTurnForm() {
            if (!this.myTurn) return null;
            const id = (this.myTurn.tool || '').replace('formHandler:', '');
            if (!id) return null;
            return this.formDefs.find((f) => f.id === id) || null;
        },

        /**
         * 에이전트 이벤트를 업무별 도구 목록과 실제로 돈 시각으로 접는다.
         * 결과 값은 산출물 카드가 보이므로 여기서 글로 옮기지 않는다.
         */
        agentResultByTodo() {
            const todoByJob = {};
            this.events.forEach((e) => {
                const jobId = e.job_id || (e.data && e.data.job_id) || e.id;
                if (e.todo_id) todoByJob[jobId] = e.todo_id;
            });

            const out = {};
            this.tasks.forEach((t) => {
                const todoId = todoByJob[t.jobId];
                if (!todoId) return;
                const bucket = (out[todoId] = out[todoId] || { toolCalls: [], at: null });
                // 언제 실제로 돌았는지. 업무의 start_date 는 '언제 하기로 되어 있었는지'라
                // 미래 날짜인 경우가 흔하다 — 대화 순서는 실제로 벌어진 시각을 따라야 한다.
                if (t.startTime && (!bucket.at || new Date(t.startTime) < new Date(bucket.at))) bucket.at = t.startTime;

                (this.toolUsageStatusByTask[t.jobId] || []).forEach((u) => {
                    bucket.toolCalls.push({
                        name: u.tool_name,
                        status: u.status === 'searching' ? 'running' : 'done',
                        input: u.query || null,
                        output: u.info || null
                    });
                });
            });
            return out;
        },

        /** 업무 하나 = 메시지 하나. */
        workMessages() {
            const byTodo = this.agentResultByTodo;
            const STARTED = ['IN_PROGRESS', 'PENDING', 'SUBMITTED', 'DONE', 'CANCELLED'];

            return this.workList
                .filter((w) => STARTED.includes(w.status))
                .map((w) => {
                    const found = byTodo[w.taskId];
                    // 끝난 단계가 남긴 것은 제출한 폼 하나다 — 산출물 카드로만 붙인다(누르면 원본 폼).
                    // 대화에 말을 지어 넣지 않는다: '아래 내용으로 제출했습니다', '작업을 마치고 아래 내용을
                    // 남겼습니다', '· 키: 값' 줄, 에이전트 결과를 풀어 쓴 글 모두 카드와 같은 것을 한 번 더
                    // 말할 뿐이다. 진행 중인 단계는 대화 아래 '작업 중…' 표시가, 시작은 봇 줄이 알린다.
                    if (w.status !== 'DONE') return null;
                    const card = this.outputCardOf(w);
                    if (!card) return null;

                    // 에이전트가 끝까지 맡아 제출한 일만 '에이전트가 한 일' 이다(도구 실행 요약을 단다).
                    // 초안(DRAFT) 모드는 에이전트가 채운 것을 사람이 확인해 제출했으므로 사람이 한 일이다.
                    const agent = hasAgent(w.task) && (w.task || {}).agent_mode !== 'DRAFT';
                    // 내가 맡은 업무는 내 말로 취급한다 — 시작한 사람이 나인데 남처럼
                    // 왼쪽에 서 있으면 누가 한 일인지 오히려 헷갈린다.
                    const mine = this.isMine(w);
                    const agentAssignee = this.isAgentAssignee(w);
                    return {
                        uuid: `w-${w.taskId}`,
                        role: mine ? 'user' : 'system',
                        email: mine ? this.myEmail : '',
                        name: mine ? w.name : `${w.name} · ${this.displayName(w) || (agentAssignee ? '에이전트' : '담당자')}`,
                        content: '',
                        timeStamp: this.happenedAt(w, found),
                        isAgent: agentAssignee,
                        avatar: mine || agentAssignee ? '' : this.avatarOf(w.endpoint) || this.avatarOf(w.username),
                        toolCalls: agent && found ? found.toolCalls : [],
                        outputCard: card
                    };
                })
                .filter(Boolean);
        },

        /**
         * 단계가 시작될 때마다 봇이 알려 주는 줄.
         *
         * 업무 결과만 쌓이면 대화가 뜸기게 이어진다 — 누가 무엇을 마치자
         * 다음에 무슨 일이 시작됐는지가 어디에도 적혀 있지 않다. 그래서 단계가
         * 열릴 때 그 사실을 한 줄로 남긴다.
         *
         * 누가 하는지는 붙이지 않는다. 내 차례면 아래 '내 차례' 상자와 진행 알약이,
         * 남의 차례면 '○○ 님이 진행 중' 줄이 이미 알린다 — 여기서 또 말하면 겹친다.
         */
        stepMessages() {
            // 실제로 열린 단계만 알린다. TODO 는 엔진이 미리 만들어 둔 '예정' 이라 아직
            // 시작되지 않았다 — 이걸 알리면 배타 게이트웨이의 가지 전부와 마지막 단계까지
            // '진행됩니다' 가 한꺼번에 찍혀, 인스턴스가 다 끝난 것처럼 보였다.
            const STARTED = ['IN_PROGRESS', 'PENDING', 'SUBMITTED', 'DONE', 'CANCELLED'];
            return this.workList
                .filter((w) => w && w.taskId && STARTED.includes(w.status))
                .map((w) => {
                    return {
                        uuid: `step-${w.taskId}`,
                        role: 'system',
                        email: '',
                        name: 'Process GPT',
                        // 마크다운을 쓰지 않는다 — 이 대화창은 **굵게** 를 모르고 별표를 그대로 보인다.
                        content: `다음 단계로 ${w.name}${this.subjectJosa(w.name)} 진행됩니다.`,
                        timeStamp: this.openedAt(w),
                        isAgent: true,
                        avatar: ''
                    };
                });
        },

        /** 업무 메시지와 사람이 남긴 말을 시간순으로. */
        messages() {
            return [...this.stepMessages, ...this.workMessages, ...this.chatRows].sort(
                (a, b) => new Date(a.timeStamp || 0) - new Date(b.timeStamp || 0)
            );
        }
    },
    watch: {
        instId(v, old) {
            if (v && v !== old) this.reload();
        },
        myTurn: {
            immediate: true,
            deep: true,
            handler(v) {
                if (!v) {
                    this.formData = {};
                    this.loadedFormFor = null;
                    this.formTouched = false;
                    this.draftOffered = false;
                    return;
                }
                if (v.taskId !== this.loadedFormFor) {
                    this.formTouched = false;
                    this.draftOffered = false;
                    this.draftPreview = false;
                    this.loadForm(v);
                }
                this.considerDraft();
            }
        },
        messages() {
            this.$nextTick(() => this.$refs.thread && this.$refs.thread.scrollToBottom());
        }
    },
    async mounted() {
        window.addEventListener('resize', this.onResize);
        await this.reload();
    },
    beforeUnmount() {
        window.removeEventListener('resize', this.onResize);
        this.teardown();
    },
    methods: {
        onResize() {
            this.width = window.innerWidth;
        },

        /** 진행 상황 · 산출물 패널을 연다. 알약에서 열면 진행 상황이 펼쳐진 채로 연다. */
        openPanel(section) {
            if (section) this.sections[section] = true;
            this.panelOpen = true;
        },

        async reload() {
            this.panelOpen = false;
            this.teardown();
            this.formDefs = [];
            this.formTried = new Set();
            if (!this.instId) return;
            await Promise.all([this.loadWorkList(), this.loadEvents(), this.loadChats(), this.loadUsers()]);
            await this.subscribe();
            this.$nextTick(() => this.$refs.thread && this.$refs.thread.scrollToBottom());
        },

        teardown() {
            [this.workWatchRef, this.rootWatchRef].forEach((ref) => {
                if (ref) backend.watchOff(ref);
            });
            this.workWatchRef = null;
            this.rootWatchRef = null;
            [this.eventChannel, this.chatChannel].forEach((ch) => {
                try {
                    if (ch && window.$supabase) window.$supabase.removeChannel(ch);
                } catch (e) {
                    /* 이미 닫힌 채널 */
                }
            });
            this.eventChannel = null;
            this.chatChannel = null;
        },

        loadWorkList() {
            return this.$try({
                context: this,
                noLoading: true,
                action: async () => {
                    const list = await backend.getAllWorkListByInstId(this.instId);
                    list.sort((a, b) => new Date(a.startDate || 0) - new Date(b.startDate || 0));
                    // 서브 프로세스 단계는 엔진이 이름 뒤에 실행 범위 표시를 붙인다('현장조사: (:0)').
                    // 사람이 읽을 이름이 아니므로 떼어 낸다.
                    list.forEach((w) => {
                        if (w && typeof w.name === 'string') w.name = stripScopeSuffix(w.name);
                    });
                    this.workList = list;
                    // 새로 열린 서브 프로세스가 있으면 그 정의의 폼도 받는다(이미 받은 정의는 건너뛴다).
                    this.loadFormDefs();
                }
            });
        },

        /** 얼굴 사진을 붙이기 위한 사용자 목록. 한 번만 받는다. */
        async loadUsers() {
            if (this.userList.length) return;
            try {
                this.userList = (await backend.getUserList()) || [];
            } catch (e) {
                this.userList = [];
            }
        },

        /** uid · 이메일 · 이름 중 무엇으로 와도 그 사람(또는 에이전트)을 찾아 준다. */
        userOf(who) {
            if (!who) return null;
            const key = String(who).toLowerCase();
            return (
                this.userList.find(
                    (x) =>
                        String(x.id || '').toLowerCase() === key ||
                        String(x.email || '').toLowerCase() === key ||
                        String(x.username || '').toLowerCase() === key
                ) || null
            );
        },

        /**
         * 단계가 실제로 열린 시각.
         *
         * start_date 는 '언제 하기로 되어 있었는지' 라 미래 날짜인 경우가 흔하다(기간을 더해
         * 미리 잡아 둔다). 그걸 쓰면 알림이 대화 맨 끝으로 밀리거나 앞뒤가 뒤집힌다.
         * 상태가 바뀔 때 DB 트리거가 적는 actual_start_date 를 먼저 쓰고, 없으면(처음 단계 등)
         * 미래가 아닌 한 start_date 를 쓴다.
         */
        openedAt(w) {
            const raw = w.task || {};
            if (raw.actual_start_date) return raw.actual_start_date;
            const planned = new Date(w.startDate || 0).getTime();
            if (planned && planned <= Date.now()) return w.startDate;
            return raw.updated_at || w.startDate;
        },

        /**
         * 받침에 따라 '이' 와 '가' 를 고른다.
         *
         * '이(가)' 로 적으면 틀리지는 않지만 사람이 쓴 문장처럼 읽히지 않는다.
         * 한글은 마지막 글자의 받침만 보면 정해지므로 그만큼은 맞춘다.
         * 한글이 아니면(영문·숫자) 굴리지 않고 둘 다 적는다.
         */
        subjectJosa(word) {
            const last = String(word || '').trim().slice(-1);
            const code = last.charCodeAt(0);
            if (!last || Number.isNaN(code)) return '이(가)';
            if (code < 0xac00 || code > 0xd7a3) return '이(가)';
            return (code - 0xac00) % 28 === 0 ? '가' : '이';
        },

        /**
         * 보낸이 이름.
         * 업무에 적힌 username 이 이메일인 경우가 있다 — 사람 이름이 있으면 그걸 쓴다.
         */
        displayName(w) {
            const u = this.userOf(w.endpoint) || this.userOf(w.username);
            return (u && u.username) || w.username || '';
        },

        avatarOf(who) {
            const u = this.userOf(who);
            return (u && (u.profile || u.picture || u.avatar)) || '';
        },

        /**
         * 담당자가 에이전트인가.
         *
         * agent_mode 로 판단하면 안 된다 — 그건 '에이전트가 초안을 만든다'는 뜻이지
         * 담당자가 에이전트라는 뜻이 아니다. 사람에게 배정된 업무를 에이전트에게
         * 맡겨 둔 것이라면 얼굴은 그 사람의 것이어야 한다.
         */
        isAgentAssignee(w) {
            const u = this.userOf(w.endpoint) || this.userOf(w.username);
            return !!(u && u.is_agent);
        },

        async loadEvents() {
            if (!window.$supabase) return;
            const { data } = await window.$supabase
                .from('events')
                .select('*')
                .eq('proc_inst_id', this.instId)
                .order('seq', { ascending: true });
            this.events = data || [];
        },

        async loadChats() {
            if (!window.$supabase) return;
            const { data } = await window.$supabase.from('chats').select('*').eq('id', this.instId);
            this.chatRows = (data || [])
                .map((r) => {
                    const m = r.messages;
                    if (!m) return null;
                    const images = Array.isArray(m.images) && m.images.length ? m.images : null;
                    const pdfFile = m.pdfFile || null;
                    // 그림만 붙이고 글은 안 쓰는 일은 흔하다. 글이 없다고 버리면 그 말은 사라진다.
                    if (!m.content && !images && !pdfFile) return null;
                    return {
                        uuid: r.uuid,
                        role: 'user',
                        name: m.name || m.email || '',
                        email: m.email || '',
                        isAgent: false,
                        // m.image 는 첫 번째 첨부 그림이다(채팅방과 같은 모양). 아바타가 아니므로
                        // 그것을 아바타 자리에 놓으면 붙인 사진이 사람 얼굴처럼 둔갑한다.
                        avatar: this.avatarOf(m.email) || this.avatarOf(m.name),
                        content: typeof m.content === 'string' ? m.content : m.content ? JSON.stringify(m.content) : '',
                        images,
                        pdfFile,
                        timeStamp: m.timeStamp || r.created_at
                    };
                })
                .filter(Boolean);
        },

        async subscribe() {
            // 업무 목록은 proc_inst_id 와 root_proc_inst_id 를 합쳐 읽는다(서브프로세스 포함).
            // 구독도 같은 범위여야 한다 — proc_inst_id 만 보면 하위 단계의 변화를 놓친다.
            this.workWatchRef = await backend.watchWorkList(() => this.loadWorkList(), { instId: this.instId });
            this.rootWatchRef = await backend.watchWorkList(() => this.loadWorkList(), { rootInstId: this.instId });

            if (!window.$supabase) return;
            const tag = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

            this.eventChannel = window.$supabase
                .channel(`inst-tl-ev-${tag}`)
                .on(
                    'postgres_changes',
                    { event: 'INSERT', schema: 'public', table: 'events', filter: `proc_inst_id=eq.${this.instId}` },
                    (p) => this.pushEvent(p.new)
                )
                .subscribe();

            this.chatChannel = window.$supabase
                .channel(`inst-tl-ch-${tag}`)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'chats', filter: `id=eq.${this.instId}` }, () =>
                    this.loadChats()
                )
                .subscribe();
        },

        pushEvent(e) {
            if (!e || this.events.some((x) => x.id === e.id)) return;
            this.events = [...this.events, e];
        },

        /** 에이전트가 손을 뗐는가. 손대지 않는 업무는 처음부터 뗀 것으로 본다. */
        isAgentFinished(taskId) {
            const mine = this.events.filter((e) => e.todo_id === taskId);
            if (!mine.length) return true;
            return mine.some((e) => e.event_type === 'task_completed' || e.event_type === 'crew_completed');
        },

        /**
         * 이 업무가 실제로 벌어진 시각.
         *
         * start_date 는 일정상의 시작일이라 앞으로의 날짜가 들어 있기도 하다.
         * 그대로 줄을 세우면 어제 한 일이 내일 한 일 뒤로 간다.
         * 끝난 일은 끝난 시각, 에이전트가 한 일은 첫 이벤트 시각을 쓴다.
         */
        happenedAt(w, agentResult) {
            if (w.status === 'DONE' && w.endDate) return w.endDate;
            if (agentResult && agentResult.at) return agentResult.at;
            return w.startDate;
        },

        /** 내가 지금 손대야 하는(또는 에이전트가 대신 하는) 업무인가. */
        /**
         * 지금 내가 손댈 업무인가.
         *
         * IN_PROGRESS 만 센다. PENDING 은 엔진 쪽 대기다 — 서브 프로세스를 부른 부모 단계가
         * 자식이 끝나길 기다리거나(폼이 없다), 체크포인트를 다시 따지는 중이다. 이걸 내 차례로
         * 잡으면 '교통 민원 처리' 같은 부모가 내 차례로 뜨고, 정작 해야 할 자식 단계
         * ('현장조사')는 남의 일처럼 '진행 중' 줄로 밀려났다.
         */
        isMyPendingTask(w) {
            return w.status === 'IN_PROGRESS' && this.isMine(w);
        },

        /**
         * 폼에 손을 댄 순간부터는 초안이 와도 덮어쓰지 않는다.
         *
         * 다만 폼은 처음 그려질 때도 값을 한 번 올려 보낸다(빈 칸들을 채운 초기값).
         * 그걸 '내가 썼다' 로 세면, 초안이 와도 늘 '채택하기' 로 빠져 자동 채움이
         * 한 번도 일어나지 않는다. 기준값과 견줘 실제로 달라졌을 때만 센다.
         */
        onFormTouched() {
            if (this.draftAdopting) return;
            if (this.snapshot(this.formData) === this.formBaseline) return;
            this.formTouched = true;
        },

        /** 값 비교용 문자열. 빈 칸은 없는 것으로 본다. */
        snapshot(obj) {
            if (!obj || typeof obj !== 'object') return '';
            return Object.keys(obj)
                .sort()
                .map((k) => `${k}=${obj[k] === null || obj[k] === undefined ? '' : String(obj[k])}`)
                .filter((x) => !x.endsWith('='))
                .join('&');
        },

        /**
         * 초안이 도착했을 때.
         *   내가 아직 손대지 않았으면 그대로 채운다 — 기존 화면이 하던 대로다.
         *   이미 적어 둔 값이 있으면 덮지 않고 '채택하기' 로 미뤄 둔다.
         */
        considerDraft() {
            const values = this.draftValues;
            if (!values || this.myTurn.draftStatus !== 'COMPLETED') return;
            if (this.formTouched) {
                this.draftOffered = true;
                return;
            }
            if (!this.sameAsForm(values)) this.fillForm(values);
        },

        sameAsForm(values) {
            return Object.keys(values).every((k) => String(this.formData[k] ?? '') === String(values[k] ?? ''));
        },

        fillForm(values) {
            this.draftAdopting = true;
            this.formData = { ...this.formData, ...values };
            this.formBaseline = this.snapshot(this.formData);
            this.$nextTick(() => {
                this.draftAdopting = false;
            });
        },

        adoptDraft() {
            const values = this.draftValues;
            if (values) this.fillForm(values);
            this.draftOffered = false;
            this.draftPreview = false;
        },

        /**
         * 이 인스턴스가 쓰는 폼 목록. 내 차례 폼뿐 아니라, 끝난 단계의 산출물 카드를 눌렀을 때
         * 원본 폼을 그대로 그려 보이는 데도 쓴다.
         *
         * 서브 프로세스 단계의 폼은 부모가 아니라 서브 프로세스 정의에 딸려 있다. 부모 정의의
         * 폼만 받으면 서브 프로세스의 내 차례에 입력 칸 없이 '제출' 만 보인다 — 업무들이
         * 가리키는 정의마다 한 번씩 받아 합친다.
         */
        loadFormDefs(extraDefIds = []) {
            // 업무 목록이 바뀔 때마다 불린다. 겹쳐 돌면 앞 호출이 받는 중인 폼을 뒤 호출이 없는 줄 알고
            // id 로 또 받는다 — 한 줄로 세워 차례로 돈다.
            this.formLoadChain = (this.formLoadChain || Promise.resolve()).then(async () => {
                const tried = this.formTried;
                const fresh = await fetchFormDefs(backend, {
                    defIds: [this.instance && this.instance.defId, ...this.workList.map((w) => w.defId), ...extraDefIds],
                    formIds: this.workList.map(formIdOf),
                    have: this.formDefs,
                    tried
                });
                // 받는 사이 다른 인스턴스로 넘어갔으면 버린다.
                if (fresh.length && tried === this.formTried) this.formDefs = [...this.formDefs, ...fresh];
            });
            return this.formLoadChain;
        },

        /** 내 차례 업무의 입력 폼을 받아 온다. 정의당 폼 목록은 한 번만 받는다. */
        async loadForm(turn) {
            this.loadedFormFor = turn.taskId;
            this.formData = {};
            this.formBaseline = '';
            if (!turn.tool || !turn.tool.startsWith('formHandler:') || !turn.defId) return;
            if (this.myTurnForm) return;
            this.formLoading = true;
            try {
                await this.loadFormDefs([turn.defId]);
            } finally {
                this.formLoading = false;
            }
        },

        /** 채운 폼을 그대로 보낸다 — 창을 띄우지 않으므로 여기서 끝난다. */
        submitMyTurn() {
            const turn = this.myTurn;
            if (!turn || this.submitting) return;
            this.submitting = true;
            this.$try({
                context: this,
                noLoading: true,
                action: async () => {
                    await backend.putWorkItemComplete(turn.taskId, { parameterValues: this.formData });
                    this.formData = {};
                    this.loadedFormFor = null;
                    this.formTouched = false;
                    this.draftOffered = false;
                    await this.loadWorkList();
                },
                onFail: () => {
                    this.submitting = false;
                }
            }).finally(() => {
                this.submitting = false;
            });
        },

        /**
         * 끝난 업무가 남긴 값을 산출물 카드(OutputCard)가 읽는 꼴로.
         * 폼으로 남긴 값이면 그 폼을 함께 넘겨, 카드를 눌렀을 때 원본 폼 그대로 보이게 한다.
         */
        outputCardOf(w) {
            const out = w.task && w.task.output;
            if (!out || typeof out !== 'object' || Object.keys(out).length === 0) return null;
            const formId = (w.tool || '').replace('formHandler:', '');
            const form = formId ? this.formDefs.find((f) => f.id === formId) : null;
            const inner = formId && out[formId] && typeof out[formId] === 'object' ? out[formId] : out;
            // 빈 폼으로 제출됐거나 값이 모두 비어 있으면(파일 칸이 null 등) 보일 것이 없다 — 빈 카드를 달지 않는다.
            if (!hasValue(inner)) return null;
            return { name: w.name, type: form ? 'form' : 'value', html: form ? form.html : null, output: inner };
        },

        /** HTML 조각에서 본문 글자만. 줄을 나누는 태그는 공백으로 두어 낱말이 붙지 않게 한다. */
        plainText(s) {
            if (!s) return '';
            const html = String(s).replace(/<\s*(br|\/p|\/div|\/li|\/h[1-6])\s*\/?>/gi, ' ');
            return new DOMParser().parseFromString(html, 'text/html').body.textContent || '';
        },

        shorten(s, n) {
            if (!s) return '';
            const t = String(s).replace(/\s+/g, ' ').trim();
            return t.length > n ? `${t.slice(0, n)}…` : t;
        },

        isMine(w) {
            const uid = this.myUid;
            const email = this.myEmail;
            if (!uid && !email) return false;
            if (!w.endpoint) {
                return (w.assignees || []).some((a) => a.uid === uid || (email && a.email === email));
            }
            const list = String(w.endpoint)
                .split(',')
                .map((s) => s.trim());
            return list.includes(uid) || (!!email && list.includes(email));
        },

        // ---- 행동 -------------------------------------------------------

        goTask(t) {
            this.$router.push(`/todolist/${t.taskId}`);
        },

        /**
         * 사람이 남긴 말을 저장한다.
         *
         * 채팅방이 넣는 것과 같은 모양으로 넣는다 — 같은 chats 표이고
         * 그리는 것도 같은 ChatThread 라, 다르게 넣으면 그쪽에서만 첨부가
         * 사라진다. 그림은 images, 그 밖의 파일은 pdfFile 로 간다.
         */
        send(message) {
            if (!this.instId || !message) return;
            const text = (message.text || '').trim();
            const images = Array.isArray(message.images) && message.images.length ? message.images : null;
            const files = Array.isArray(message.files) && message.files.length ? message.files : null;
            const attachment = files ? files[0] : message.file || null;
            // 글도 첨부도 없으면 보낼 것이 없다.
            if (!text && !images && !attachment) return;
            let name = '';
            try {
                name = localStorage.getItem('userName') || '';
            } catch (e) {
                /* 저장소를 막아 둔 환경 */
            }
            this.$try({
                context: this,
                noLoading: true,
                action: async () => {
                    await backend.updateInstanceChat(this.instId, {
                        name,
                        role: 'user',
                        email: this.myEmail,
                        image: images && images[0] ? images[0].url || '' : '',
                        images,
                        pdfFile: attachment,
                        content: text,
                        timeStamp: new Date().toISOString()
                    });
                    await this.loadChats();
                }
            });
        }
    }
};
</script>

<style scoped>
.pg-tl {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
}

.pg-tl__thread {
    flex: 1 1 auto;
    min-height: 0;
}

/* 지금 진행 중인 것. 말풍선이 아니라 목록 아래 한 줄. */
/*
 * 작업 중 표시 — 대화 끝에 붙는 상태 한 줄.
 * 기계가 일하는 동안(busy)은 클로드처럼 별표가 돌고 글자에 빛이 지나간다.
 * 말풍선이 아니므로 상자를 두르지 않는다.
 */
.pg-working {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    padding: 4px 16px 8px 20px;
    font-size: 14px;
    line-height: 20px;
    color: rgba(var(--v-theme-on-surface), 0.55);
}

.pg-working__spark {
    flex: 0 0 auto;
    display: inline-block;
    font-size: 16px;
    line-height: 1;
    color: rgb(var(--v-theme-primary));
    animation: pg-working-spark 1.6s ease-in-out infinite;
}

.pg-working__text {
    flex: 0 0 auto;
}

.pg-working--busy .pg-working__text {
    background: linear-gradient(
        90deg,
        rgba(var(--v-theme-on-surface), 0.45) 0%,
        rgba(var(--v-theme-on-surface), 0.9) 50%,
        rgba(var(--v-theme-on-surface), 0.45) 100%
    );
    background-size: 200% 100%;
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    animation: pg-working-shimmer 1.8s linear infinite;
}

.pg-working__what {
    min-width: 0;
    font-size: 13px;
    color: rgba(var(--v-theme-on-surface), 0.45);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

@keyframes pg-working-spark {
    0% {
        transform: rotate(0deg) scale(0.9);
        opacity: 0.7;
    }
    50% {
        transform: rotate(90deg) scale(1.1);
        opacity: 1;
    }
    100% {
        transform: rotate(180deg) scale(0.9);
        opacity: 0.7;
    }
}

@keyframes pg-working-shimmer {
    from {
        background-position: 200% 0;
    }
    to {
        background-position: -200% 0;
    }
}

@media (prefers-reduced-motion: reduce) {
    .pg-working__spark,
    .pg-working--busy .pg-working__text {
        animation: none;
    }
}

.pg-tl__hitl {
    flex: 0 0 auto;
    margin: 0 10px 8px;
    padding: 12px 14px;
    border: 1px solid rgba(var(--v-theme-primary), 0.35);
    border-radius: 12px;
    background: rgba(var(--v-theme-primary), 0.05);
}

.pg-tl__hitl-head {
    display: flex;
    align-items: center;
    font-size: 0.8125rem;
    font-weight: 700;
    color: rgb(var(--v-theme-primary));
}

.pg-tl__hitl-desc {
    margin: 6px 0 10px;
    font-size: 0.8125rem;
    color: rgba(var(--v-theme-on-surface), 0.7);
}

.pg-tl__hitl-actions {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
}

.pg-tl__draft {
    margin: 8px 0 0;
    padding: 8px 10px;
    border-radius: 10px;
    background: rgba(var(--v-theme-primary), 0.07);
    font-size: 0.75rem;
    color: rgba(var(--v-theme-on-surface), 0.7);
}

.pg-tl__draft--busy {
    display: flex;
    align-items: center;
}

.pg-tl__draft-head {
    display: flex;
    align-items: center;
    gap: 4px;
    font-weight: 700;
    color: rgb(var(--v-theme-primary));
}

.pg-tl__draft-body {
    margin-top: 6px;
    padding-top: 6px;
    border-top: 1px solid rgba(var(--v-theme-primary), 0.18);
}

.pg-tl__draft-line {
    display: flex;
    gap: 8px;
    line-height: 1.7;
}

.pg-tl__draft-k {
    flex: 0 0 auto;
    max-width: 34%;
    color: rgba(var(--v-theme-on-surface), 0.5);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.pg-tl__draft-v--file {
    color: rgb(var(--v-theme-primary));
    text-decoration: none;
}

.pg-tl__draft-v--file:hover {
    text-decoration: underline;
}

.pg-tl__draft-v {
    flex: 1 1 auto;
    min-width: 0;
    color: rgba(var(--v-theme-on-surface), 0.85);
}

/* 상자 안에서 폼이 너무 길어지면 상자만 스크롤한다 — 대화는 그대로 둔다. */
.pg-tl__form {
    margin: 8px 0 10px;
    max-height: 40vh;
    overflow: auto;
}

.pg-tl__form-loading {
    display: flex;
    align-items: center;
    margin: 8px 0 10px;
    font-size: 0.8125rem;
    color: rgba(var(--v-theme-on-surface), 0.6);
}

.pg-tl__composer {
    /* 입력창은 이제 채팅의 것을 그대로 쓴다. 여기서는 자리만 잡아 준다. */
    flex: 0 0 auto;
    padding: 6px 8px;
    border-top: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}

</style>
