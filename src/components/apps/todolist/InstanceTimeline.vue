<template>
    <div class="pg-tl">
        <ChatThread
            ref="thread"
            class="pg-tl__thread"
            :messages="messages"
            :current-user-email="myEmail"
            empty-text="아직 진행된 작업이 없습니다."
        />

        <!--
            지금 누가 무엇을 하고 있는지. 말풍선이 아니라 아래에 따로 둔다 —
            이건 누가 한 말이 아니라 화면의 상태다.
        -->
        <div v-if="statusLine" class="pg-tl__status">
            <v-progress-circular indeterminate :size="14" :width="2" color="primary" class="mr-2"></v-progress-circular>
            <span>{{ statusLine }}</span>
        </div>

        <!--
            에이전트가 끝까지 맡는 업무(COMPLETE)는 내 몫이어도 손댈 것이 없다.
            제출까지 에이전트가 하므로 입력창을 내면 오히려 헷갈린다 — 알리기만 한다.
        -->
        <div v-if="autoTurn" class="pg-tl__auto">
            <v-progress-circular indeterminate :size="15" :width="2" color="primary" class="mr-2"></v-progress-circular>
            <span>{{ autoTurn.name }} — 에이전트가 처리하고 제출까지 맡습니다.</span>
        </div>

        <!--
            내 차례. 채팅에서 에이전트가 사람에게 물을 때와 같은 자리다 —
            말풍선 사이가 아니라 입력창 바로 위에 붙어야, 지금 답할 것이 무엇인지 보인다.
        -->
        <div v-if="myTurn" class="pg-tl__hitl">
            <div class="pg-tl__hitl-head">
                <v-icon size="15" color="primary" class="mr-1">mdi-hand-back-right-outline</v-icon>
                <span>내 차례입니다 — {{ myTurn.name }}</span>
                <v-spacer></v-spacer>
                <v-btn size="x-small" variant="text" @click="goTask(myTurn)">따로 열기</v-btn>
            </div>
            <p v-if="myTurn.description" class="pg-tl__hitl-desc">{{ myTurn.description }}</p>

            <!--
                에이전트가 초안을 만드는 중. 기다릴 필요는 없다 — 아래 폼은 그대로 쓸 수 있고,
                먼저 적어 둔 값이 있으면 초안이 와도 덮어쓰지 않는다.
            -->
            <div v-if="draftRunning" class="pg-tl__draft pg-tl__draft--busy">
                <v-progress-circular indeterminate :size="14" :width="2" color="primary" class="mr-2"></v-progress-circular>
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

        <form class="pg-tl__composer" @submit.prevent="send">
            <textarea v-model="draft" rows="1" placeholder="메시지 입력" @keydown.enter.exact.prevent="send"></textarea>
            <v-btn icon variant="text" size="small" type="submit" :disabled="!draft.trim()">
                <v-icon size="18">mdi-send</v-icon>
            </v-btn>
        </form>
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
import BackendFactory from '@/components/api/BackendFactory';
import { fileNameOf, isWorkspacePath, workspaceFileUrl } from '@/utils/workspaceFile';

const backend = BackendFactory.createBackend();

/** 말풍선 안에서 문단을 가르는 빈 줄. */
const SEP = String.fromCharCode(10) + String.fromCharCode(10);

/** 에이전트가 손을 대는 업무인가. agent_mode 가 붙으면 에이전트가 관여한다. */
function hasAgent(raw) {
    return !!(raw && (raw.agent_mode || raw.agent_orch));
}

export default {
    name: 'InstanceTimeline',
    components: { ChatThread, DynamicForm },
    mixins: [agentEventTimeline],
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

        draft: '',

        // 내 차례 업무에 붙은 입력 폼
        formDefs: [],
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
         * 지금 누가 무엇을 하고 있는지 한 줄.
         *
         * 아직 끝나지 않은 업무는 '한 말'이 없으니 말풍선으로 세우지 않는다.
         * 내 차례이거나 에이전트가 대신 하는 중이면 아래 상자가 이미 알리므로 비운다.
         */
        statusLine() {
            const w = this.workList.find((x) => x.status === 'IN_PROGRESS' || x.status === 'PENDING');
            if (!w) return '';
            if (this.myTurn && this.myTurn.taskId === w.taskId) return '';
            if (this.autoTurn && this.autoTurn.taskId === w.taskId) return '';
            const who = this.displayName(w) || (this.isAgentAssignee(w) ? '에이전트' : '담당자');
            return `${w.name} · ${who} 진행 중`;
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
                description: this.shorten(w.description, 200)
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
         * 에이전트 이벤트를 업무별 결과와 도구 목록으로 접는다.
         * 카드 여러 장 대신 말풍선 하나로 합친다 — 같은 업무의 도구 사용은
         * '실행 상세' 안으로 들어가고, 겉에는 결과만 남는다.
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
                const bucket = (out[todoId] = out[todoId] || { content: '', toolCalls: [], at: null });
                // 언제 실제로 돌았는지. 업무의 start_date 는 '언제 하기로 되어 있었는지'라
                // 미래 날짜인 경우가 흔하다 — 대화 순서는 실제로 벌어진 시각을 따라야 한다.
                if (t.startTime && (!bucket.at || new Date(t.startTime) < new Date(bucket.at))) bucket.at = t.startTime;

                // 같은 결과가 에이전트 태스크와 '최종 결과 반환' 태스크로 두 번 온다.
                // 그대로 이으면 같은 말을 두 번 하는 말풍선이 된다.
                const text = this.asText(t.content);
                if (text && !bucket.content.includes(text)) {
                    bucket.content = bucket.content ? [bucket.content, text].join(SEP) : text;
                }

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
                    const agent = hasAgent(w.task);
                    const found = byTodo[w.taskId];
                    // 아직 끝나지 않은 업무는 남긴 말이 없다 — 아래 상태 줄이 대신 알린다.
                    // 에이전트가 중간 결과를 내놓은 것만 예외로 말풍선에 올린다.
                    if (w.status !== 'DONE' && w.status !== 'CANCELLED' && !(agent && found)) return null;

                    // 내가 맡은 업무는 내 말로 취급한다 — 시작한 사람이 나인데 남처럼
                    // 왼쪽에 서 있으면 누가 한 일인지 오히려 헷갈린다.
                    const mine = this.isMine(w);
                    const agentAssignee = this.isAgentAssignee(w);

                    // 무슨 일이 있었는지 한 줄, 그 아래에 남긴 값.
                    // 에이전트가 한 일이라고 값만 툭 던지면 읽는 사람은 그게 결과인지
                    // 중간 기록인지 알 수 없다 — 사람이 한 일과 똑같이 설명을 붙인다.
                    const body = agent && found ? found.content : this.outputText(w.task && w.task.output);
                    const lead = this.leadLine(w, mine, agent);
                    const content = body ? [lead, body].join(SEP) : lead;
                    if (!content) return null;

                    return {
                        uuid: `w-${w.taskId}`,
                        role: mine ? 'user' : 'system',
                        email: mine ? this.myEmail : '',
                        name: mine ? w.name : `${w.name} · ${this.displayName(w) || (agentAssignee ? '에이전트' : '담당자')}`,
                        content,
                        timeStamp: this.happenedAt(w, found),
                        isAgent: agentAssignee,
                        avatar: mine || agentAssignee ? '' : this.avatarOf(w.endpoint) || this.avatarOf(w.username),
                        toolCalls: agent && found ? found.toolCalls : []
                    };
                })
                .filter(Boolean);
        },

        /** 업무 메시지와 사람이 남긴 말을 시간순으로. */
        messages() {
            return [...this.workMessages, ...this.chatRows].sort((a, b) => new Date(a.timeStamp || 0) - new Date(b.timeStamp || 0));
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

        async reload() {
            this.teardown();
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
                    this.workList = list;
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
                    if (!m || !m.content) return null;
                    return {
                        uuid: r.uuid,
                        role: 'user',
                        name: m.name || m.email || '',
                        email: m.email || '',
                        isAgent: false,
                        avatar: m.image || this.avatarOf(m.email) || this.avatarOf(m.name),
                        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
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
        isMyPendingTask(w) {
            return (w.status === 'IN_PROGRESS' || w.status === 'PENDING') && this.isMine(w);
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

        /** 내 차례 업무의 입력 폼을 받아 온다. 정의당 폼 목록은 한 번만 받는다. */
        async loadForm(turn) {
            this.loadedFormFor = turn.taskId;
            this.formData = {};
            this.formBaseline = '';
            if (!turn.tool || !turn.tool.startsWith('formHandler:') || !turn.defId) return;
            if (this.formDefs.length) return;
            this.formLoading = true;
            try {
                this.formDefs = (await backend.listDefinition('form_def', { match: { proc_def_id: turn.defId } })) || [];
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

        // ---- 사람이 한 일을 말로 ----------------------------------------

        /**
         * 무슨 일이 있었는지 한 줄로.
         * 내가 한 일이면 '완료했습니다' 는 군더더기라 값만 남기지만,
         * 그마저 없으면 아무 말도 없는 말풍선이 되므로 한 줄은 남긴다.
         */
        leadLine(w, mine, agent) {
            const hasValues = !!this.outputText(w.task && w.task.output) || (agent && !!(this.agentResultByTodo[w.taskId] || {}).content);
            if (w.status === 'DONE') {
                if (agent) return hasValues ? '작업을 마치고 아래 내용을 남겼습니다.' : '작업을 마쳤습니다.';
                if (mine) return hasValues ? '아래 내용으로 제출했습니다.' : '완료했습니다.';
                return hasValues ? '완료하고 아래 내용을 남겼습니다.' : '완료했습니다.';
            }
            if (w.status === 'SUBMITTED') return '제출했습니다. 다음 단계를 준비하는 중입니다.';
            if (w.status === 'CANCELLED') return '취소되었습니다.';
            if (agent) return '작업하는 중입니다.';
            return mine ? '내가 맡고 있습니다.' : '맡고 있습니다.';
        },

        humanContent(w, mine) {
            // 업무 이름은 보낸이 줄에 이미 있다. 본문에서 또 부르면 같은 말을 두 번 한다.
            if (w.status === 'DONE') {
                const out = this.outputText(w.task && w.task.output);
                // 내가 한 일이면 '완료했습니다' 는 군더더기다. 내가 적어 넣은 값이
                // 곧 내가 한 말이고, 남이 한 일일 때만 무슨 일이 있었는지 알려야 한다.
                if (mine) return out || '완료했습니다.';
                return out ? ['완료했습니다.', out].join(SEP) : '완료했습니다.';
            }
            if (w.status === 'SUBMITTED') return '제출했습니다. 다음 단계를 준비하는 중입니다.';
            if (w.status === 'CANCELLED') return '취소되었습니다.';
            return '맡고 있습니다.';
        },

        /** 업무가 남긴 값. 폼 아이디로 한 겹 감싸여 오므로 벗겨서 줄로 편다. */
        outputText(output) {
            if (!output || typeof output !== 'object') return '';
            const lines = [];
            const walk = (obj, depth) => {
                if (depth > 2 || lines.length >= 8) return;
                Object.keys(obj).forEach((k) => {
                    if (lines.length >= 8) return;
                    const v = obj[k];
                    const label = String(k).replace(/_/g, ' ');
                    const file = this.fileLink(v);
                    if (file) lines.push(`· ${label}: ${file}`);
                    else if (v && typeof v === 'object' && !Array.isArray(v)) walk(v, depth + 1);
                    else if (v !== null && v !== undefined && v !== '')
                        lines.push(`· ${label}: ${this.readable(Array.isArray(v) ? v.join(', ') : String(v))}`);
                });
            };
            walk(output, 0);
            return lines.join('\n');
        },

        /**
         * 파일 하나를 가리키는 값이면 이름 한 줄짜리 링크로 돌려준다.
         *
         * 에이전트가 올린 문서는 {path, name, html_url, ext} 꼴로 남는다. 그것을 그대로
         * 펌면 대화에 긴 저장소 주소가 네 줄 쌓인다 — 읽는 사람에게 필요한 것은
         * 어떤 파일이 나왔는가이지, 그것이 어느 버킷에 있는가가 아니다.
         */
        fileLink(v) {
            if (!v || typeof v !== 'object' || Array.isArray(v)) return '';
            const path = v.path || v.fullPath || v.file_path || '';
            if (!path) return '';
            const name = v.name || fileNameOf(String(path));
            const href = isWorkspacePath(path) ? workspaceFileUrl(String(path)) : String(path);
            return /^https?:[/][/]/.test(href) ? `[${name}](${href})` : name;
        },

        /**
         * 에이전트가 내놓은 값을 읽을 수 있는 글로 바꾼다.
         * 결과가 JSON 문자열로 오는 경우가 흔한데 그대로 말풍선에 넣으면
         * 중괄호와 따옴표가 화면을 덮는다. 펴서 항목 줄로 바꾼다.
         */
        asText(v) {
            if (v === null || v === undefined) return '';
            if (typeof v === 'object') return this.outputText(v);
            const t = String(v).trim();
            if (t.startsWith('{') || t.startsWith('[')) {
                try {
                    return this.outputText(JSON.parse(t)) || t;
                } catch (e) {
                    return t;
                }
            }
            return t;
        },

        /**
         * 값을 읽기 좋게.
         * 파일은 작업 공간 경로(/workspace/…)로 온다. 대화에 그 경로를 그대로 적으면
         * 어디에 있는지만 알 뿐 꺼내 볼 수가 없다. 이름으로 보이되, 누르면
         * 받을 수 있게 링크로 남긴다(ChatThread 가 [이름](주소)를 링크로 그린다).
         */
        readable(v) {
            const t = String(v).trim();
            if (isWorkspacePath(t)) return `[${fileNameOf(t)}](${workspaceFileUrl(t)})`;
            if (/^[\/].*[\/]/.test(t) && !t.includes(' ')) return t.split(/[\/]/).pop();
            return this.shorten(t, 200);
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

        send() {
            const text = this.draft.trim();
            if (!text || !this.instId) return;
            this.draft = '';
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
                        image: '',
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
.pg-tl__status {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    margin: 0 10px 6px;
    padding: 8px 12px;
    border-radius: 10px;
    background: rgba(var(--v-theme-on-surface), 0.04);
    font-size: 0.75rem;
    color: rgba(var(--v-theme-on-surface), 0.65);
}

/* 에이전트가 제출까지 맡는 업무 알림. 손댈 것이 없으니 상자도 옅게. */
.pg-tl__auto {
    display: flex;
    align-items: center;
    margin: 0 10px 8px;
    padding: 10px 14px;
    border-radius: 12px;
    background: rgba(var(--v-theme-on-surface), 0.05);
    font-size: 0.8125rem;
    color: rgba(var(--v-theme-on-surface), 0.7);
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
    flex: 0 0 auto;
    display: flex;
    align-items: flex-end;
    gap: 6px;
    padding: 8px 10px;
    border-top: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}

.pg-tl__composer textarea {
    flex: 1 1 auto;
    min-height: 34px;
    max-height: 120px;
    padding: 7px 10px;
    border: 1px solid rgba(var(--v-theme-on-surface), 0.16);
    border-radius: 10px;
    font-size: 0.875rem;
    font-family: inherit;
    resize: none;
    outline: none;
    color: rgb(var(--v-theme-on-surface));
    background: transparent;
}

.pg-tl__composer textarea:focus {
    border-color: rgb(var(--v-theme-primary));
}
</style>
