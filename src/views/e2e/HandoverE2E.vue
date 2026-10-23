<template>
    <v-app>
        <div class="handover-e2e">
            <div class="handover-e2e__topbar">
                <v-icon size="18" class="mr-2">mdi-account-arrow-right-outline</v-icon>
                <span class="font-weight-bold">업무 인계 (핸드오버)</span>
                <span class="handover-e2e__topbar-sub">ProcessGPT · /chat</span>
            </div>

            <!-- 2단계: 인계 스레드 묶음 (이메일 forward 묶음처럼 origin_room_id 로 모인다) -->
            <div v-if="stage === 'threads'" class="handover-e2e__stage">
                <div class="handover-e2e__stage-title">
                    인계 스레드
                    <v-chip size="x-small" variant="tonal" class="ml-2">{{ threads.length }}건 누적</v-chip>
                    <span class="handover-e2e__stage-sub">origin_room_id 기준 · 방이 바뀌어도 한 묶음</span>
                </div>
                <div class="handover-e2e__threads">
                    <div v-for="t in threads" :key="t.origin_room_id" class="handover-e2e__thread">
                        <div class="handover-e2e__thread-head">
                            <v-icon size="14" class="mr-1">mdi-source-branch</v-icon>
                            <span class="font-mono">{{ t.origin_room_id }}</span>
                            <v-chip size="x-small" variant="tonal" class="ml-2">{{ t.step_count }}단계</v-chip>
                        </div>
                        <div class="handover-e2e__thread-steps">
                            <template v-for="(s, i) in t.steps" :key="i">
                                <span class="handover-e2e__step" :class="{ 'is-agent': s.to_is_agent, 'is-implicit': !s.is_explicit }">
                                    <v-icon v-if="s.to_is_agent" size="11" class="mr-1">mdi-robot-outline</v-icon>{{ s.activity }}
                                </span>
                                <v-icon v-if="i < t.steps.length - 1" size="12" class="mx-1 text-medium-emphasis">mdi-arrow-right</v-icon>
                            </template>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 3단계: 마이닝 결과 + PR -->
            <div v-else-if="stage === 'mining'" class="handover-e2e__stage">
                <div class="handover-e2e__mining">
                    <div class="handover-e2e__mining-left">
                        <div class="handover-e2e__stage-title">
                            도출된 프로세스
                            <span class="handover-e2e__stage-sub">DFG → Inductive Miner (LLM 없이 결정론적)</span>
                        </div>
                        <div v-if="mining" class="handover-e2e__flow">
                            <div v-for="(n, i) in miningFlow" :key="i" class="handover-e2e__node" :class="`is-${n.kind}`">
                                <template v-if="n.kind === 'activity'">
                                    <div class="handover-e2e__node-name">
                                        <v-icon v-if="n.agent" size="13" class="mr-1">mdi-robot-outline</v-icon>{{ n.name }}
                                    </div>
                                    <div class="handover-e2e__node-role">{{ n.role }}</div>
                                    <v-chip v-if="n.agent" size="x-small" color="primary" variant="flat" class="mt-1">
                                        {{ n.orchestration }} · {{ n.agentMode }}
                                    </v-chip>
                                </template>
                                <template v-else>◇ {{ n.name }}</template>
                            </div>
                        </div>
                        <div v-if="mining" class="handover-e2e__variants">
                            <div class="text-caption font-weight-bold mb-1">관측된 흐름</div>
                            <div v-for="(v, i) in mining.stats.variants" :key="i" class="text-caption handover-e2e__variant">
                                <span class="handover-e2e__variant-count">{{ v.count }}건</span>
                                {{ v.trace.join(' → ') }}
                            </div>
                        </div>
                    </div>

                    <div class="handover-e2e__mining-right">
                        <div class="handover-e2e__stage-title">제안된 PR</div>
                        <div v-if="mining && mining.pr" class="handover-e2e__pr">
                            <div class="handover-e2e__pr-head">
                                <v-chip size="x-small" color="success" variant="flat">OPEN</v-chip>
                                <span class="ml-2 font-weight-bold">{{ mining.pr.title }}</span>
                            </div>
                            <div class="handover-e2e__pr-meta">
                                resource_type=bpmn · branch=mined-v{{ mining.pr.version }} · proc_def_version(is_draft=true)
                            </div>
                            <pre class="handover-e2e__pr-body">{{ mining.pr.description }}</pre>
                            <div class="handover-e2e__pr-foot">
                                살아 있는 proc_def 는 건드리지 않는다 — 승인은 사람의 몫.
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div v-else class="handover-e2e__body">
                <!-- 왼쪽: 인계 직전의 채팅방을 흉내낸 배경 -->
                <div class="handover-e2e__chat">
                    <div class="handover-e2e__chat-header">
                        <v-icon size="18" class="mr-2">mdi-forum-outline</v-icon>
                        <span class="font-weight-bold">{{ room.name }}</span>
                        <v-chip size="x-small" variant="tonal" class="ml-2">
                            참여자 {{ room.participants.length }}
                        </v-chip>
                    </div>
                    <div class="handover-e2e__messages">
                        <div v-for="m in messages" :key="m.uuid" class="handover-e2e__msg" :class="`is-${m.role}`">
                            <div class="handover-e2e__msg-who">{{ m.name }}</div>
                            <div class="handover-e2e__msg-body">{{ m.content }}</div>
                        </div>
                    </div>
                    <div class="handover-e2e__composer">
                        <v-icon size="18" class="mr-2 text-medium-emphasis">mdi-message-outline</v-icon>
                        <span class="text-medium-emphasis">메시지를 입력하세요…</span>
                        <v-spacer />
                        <!-- 실제 제품에서 컴포저 툴바에 붙는 그 버튼 -->
                        <v-btn
                            size="small"
                            color="primary"
                            variant="outlined"
                            rounded="pill"
                            prepend-icon="mdi-account-arrow-right-outline"
                            class="e2e-open-handover"
                            @click="openDialog"
                        >
                            인계하기
                        </v-btn>
                    </div>
                </div>

                <!-- 오른쪽: 이 인계로 실제 DB 에 쓰인 행들 -->
                <div class="handover-e2e__writes">
                    <div class="handover-e2e__writes-title">
                        기록된 DB 쓰기
                        <v-chip size="x-small" variant="tonal" class="ml-2 e2e-write-count">{{ writes.length }}</v-chip>
                    </div>
                    <div v-if="writes.length === 0" class="text-caption text-medium-emphasis pa-3">
                        아직 인계가 일어나지 않았습니다.
                    </div>
                    <div v-for="(w, i) in writes" :key="i" class="handover-e2e__write" :class="`e2e-write-${w.table}`">
                        <div class="handover-e2e__write-head">
                            <v-chip size="x-small" :color="tableColor(w.table)" variant="flat">{{ w.op }}</v-chip>
                            <span class="ml-2 font-weight-bold">{{ w.table }}</span>
                        </div>
                        <pre class="handover-e2e__write-body">{{ summarize(w.table, w.value) }}</pre>
                    </div>
                </div>
            </div>

            <v-dialog v-model="dialog" max-width="720" scrollable>
                <HandoverDialog
                    v-if="dialog"
                    :key="dialogKey"
                    :roomId="room.id"
                    :sourceRoom="room"
                    :artifactCandidates="artifactCandidates"
                    :recentMessages="messages"
                    :defaultOrchestration="'deepagents'"
                    :isSubmitting="submitting"
                    @close="dialog = false"
                    @submit="onSubmit"
                />
            </v-dialog>
        </div>
    </v-app>
</template>

<script>
/**
 * 인계(핸드오버) 기능 E2E / 데모 하네스.
 *
 * 실제 HandoverDialog 와 실제 ProcessGPTBackend.createChatHandover 를 그대로 실행하고,
 * window.$supabase 만 인메모리 스텁으로 바꿔 어떤 행이 어느 테이블에 쓰이는지 화면에 보여준다.
 * (로그인·원격 DB·에이전트 런타임 없이도 실제 코드 경로를 검증·시연할 수 있게)
 */
import BackendFactory from '@/components/api/BackendFactory';
import HandoverDialog from '@/components/chat/HandoverDialog.vue';

export default {
    name: 'HandoverE2E',
    components: { HandoverDialog },
    data() {
        return {
            // 데모 단계: chat → threads → mining (recorder 가 전환한다)
            stage: 'chat',
            threads: [],
            mining: null,
            dialog: false,
            dialogKey: 0,
            submitting: false,
            writes: [],
            room: {
                id: 'room-quote-2026',
                name: '대성산업 견적 건',
                participants: [
                    { id: 'u-alice', username: '김주임', isAgent: false },
                    { id: 'a-quote', username: '견적 산출 에이전트', isAgent: true }
                ],
                primary_agent_id: 'a-quote'
            },
            messages: [
                { uuid: 'm1', role: 'user', name: '김주임', content: '대성산업 견적 요청 왔어. 작년 단가 기준으로 초안 좀 만들어줘.' },
                {
                    uuid: 'm2',
                    role: 'assistant',
                    name: '견적 산출 에이전트',
                    content: '작년 단가표를 반영해 견적서 초안을 작성했습니다. 수량 할인 12%를 적용했고, 납기는 4주로 잡았습니다.'
                },
                { uuid: 'm3', role: 'user', name: '김주임', content: '좋다. 이건 내 결재 권한을 넘으니 상무님 검토가 필요하겠네.' }
            ],
            artifactCandidates: [
                { type: 'workspace_file', ref: 'process-a/견적서_대성산업.md', name: '견적서_대성산업.md', content: '# 견적서\n- 품목: 자동화 설비\n- 수량: 12\n- 단가: 4,200,000원\n- 할인: 12%\n- 납기: 4주\n' },
                { type: 'workspace_file', ref: 'process-a/단가근거.md', name: '단가근거.md', content: '2025년 단가표 기준, 수량 10대 이상 12% 할인 적용' },
                { type: 'attachment', ref: 'files/rfq-daesung.pdf', name: 'RFQ_대성산업.pdf', storagePath: 'files/rfq-daesung.pdf' }
            ]
        };
    },
    created() {
        // 신원만 로컬에 심는다. window.$supabase 는 부트스트랩이 non-writable 로 정의하므로
        // 페이지 안에서 못 바꾼다 → 네트워크 계층(Playwright page.route)에서 가로챈다.
        localStorage.setItem('uid', 'u-alice');
        localStorage.setItem('userName', '김주임');
        localStorage.setItem('email', 'alice@uengine.org');

        // 녹화/E2E 하네스가 가로챈 DB 쓰기를 이 패널로 흘려보내기 위한 훅
        window.__pushHandoverWrites = (rows) => {
            for (const r of rows || []) this.writes.push(r);
        };
        // 실제 마이너(services/process-miner)가 만든 결과를 주입받기 위한 훅
        window.__setHandoverStage = (stage, payload) => {
            if (payload?.threads) this.threads = payload.threads;
            if (payload?.mining) this.mining = payload.mining;
            this.stage = stage;
        };
    },
    computed: {
        /**
         * 도출된 정의를 시작 이벤트부터 따라가며 한 줄로 편다.
         * 실제 마이너가 만든 sequences 를 그대로 순회하므로, 화면에 보이는 순서가
         * 곧 엔진이 실행할 순서다(그림용으로 따로 지어낸 순서가 아니다).
         */
        miningFlow() {
            const defn = this.mining?.definition;
            if (!defn) return [];
            const byId = {};
            for (const a of defn.activities || []) byId[a.id] = { ...a, kind: 'activity' };
            for (const g of defn.gateways || []) byId[g.id] = { ...g, kind: 'gateway' };
            for (const e of defn.events || []) byId[e.id] = { ...e, kind: 'event' };

            const next = {};
            for (const s of defn.sequences || []) (next[s.source] = next[s.source] || []).push(s.target);

            const out = [];
            const seen = new Set();
            const stack = ['start_event'];
            while (stack.length) {
                const id = stack.shift();
                if (!id || seen.has(id)) continue;
                seen.add(id);
                const n = byId[id];
                if (n && n.kind !== 'event') out.push(n);
                for (const t of next[id] || []) stack.push(t);
            }
            return out;
        }
    },
    methods: {
        tableColor(table) {
            return (
                {
                    handover_events: 'deep-purple',
                    todolist: 'indigo',
                    chat_rooms: 'teal',
                    chats: 'blue-grey',
                    chat_attachments: 'brown',
                    notifications: 'grey'
                }[table] || 'grey'
            );
        },
        /** 영상에서 읽히도록 행마다 핵심 필드만 뽑는다. */
        summarize(table, v) {
            const pick = (keys) => {
                const o = {};
                for (const k of keys) if (v[k] !== undefined && v[k] !== null && v[k] !== '') o[k] = v[k];
                return o;
            };
            if (table === 'handover_events') {
                return JSON.stringify(
                    pick([
                        'case_id',
                        'source',
                        'is_explicit',
                        'from_user_id',
                        'to_user_id',
                        'to_is_agent',
                        'agent_orch',
                        'activity_label',
                        'next_activity_label',
                        'from_room_id',
                        'to_room_id'
                    ]),
                    null,
                    2
                );
            }
            if (table === 'todolist') {
                const o = pick(['user_id', 'activity_name', 'status', 'adhoc', 'reference_ids', 'agent_orch', 'agent_mode']);
                if (v.query) o.query = String(v.query).slice(0, 180) + (String(v.query).length > 180 ? '…' : '');
                return JSON.stringify(o, null, 2);
            }
            if (table === 'chat_rooms') return JSON.stringify(pick(['id', 'name', 'primary_agent_id']), null, 2);
            if (table === 'chats') return String(v?.messages?.content || '').slice(0, 200);
            if (table === 'chat_attachments') return JSON.stringify(pick(['file_name', 'chat_room_id']), null, 2);
            if (table === 'notifications') return JSON.stringify(pick(['user_id', 'title', 'url']), null, 2);
            return JSON.stringify(v, null, 2);
        },


        openDialog() {
            this.dialogKey += 1;
            this.dialog = true;
        },

        async onSubmit(payload) {
            this.submitting = true;
            try {
                const backend = BackendFactory.createBackend();
                // 실제 프로덕션 코드 경로를 그대로 실행한다.
                await backend.createChatHandover(payload);
                this.dialog = false;
            } catch (e) {
                this.writes.push({ table: 'error', op: 'error', value: { message: e?.message || String(e) } });
            } finally {
                this.submitting = false;
            }
        }
    }
};
</script>

<style scoped>
.handover-e2e__topbar {
    display: flex;
    align-items: center;
    height: 44px;
    padding: 0 16px;
    background: #2d1b45;
    color: #fff;
    font-size: 14px;
}
.handover-e2e__topbar-sub {
    margin-left: 12px;
    opacity: 0.6;
    font-size: 12px;
}
.handover-e2e__body {
    display: flex;
    gap: 12px;
    /* 하단 자막(약 120px)에 컴포저가 가리지 않도록 여유를 둔다 */
    padding: 12px 12px 132px;
    height: calc(100vh - 44px);
    box-sizing: border-box;
    background: #f4f2f8;
}
.handover-e2e__chat {
    flex: 1 1 58%;
    display: flex;
    flex-direction: column;
    background: #fff;
    border-radius: 12px;
    overflow: hidden;
}
.handover-e2e__chat-header {
    display: flex;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid #eee;
}
.handover-e2e__messages {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
}
.handover-e2e__msg {
    margin-bottom: 14px;
}
.handover-e2e__msg-who {
    font-size: 12px;
    font-weight: 700;
    color: #68369a;
    margin-bottom: 4px;
}
.handover-e2e__msg-body {
    font-size: 14px;
    line-height: 1.6;
    background: #f7f5fb;
    border-radius: 10px;
    padding: 10px 14px;
    display: inline-block;
    max-width: 90%;
}
.handover-e2e__msg.is-assistant .handover-e2e__msg-body {
    background: #eef4ff;
}
.handover-e2e__composer {
    display: flex;
    align-items: center;
    border-top: 1px solid #eee;
    padding: 12px 16px;
}
.handover-e2e__writes {
    flex: 1 1 42%;
    background: #fff;
    border-radius: 12px;
    overflow-y: auto;
    padding: 12px;
}
.handover-e2e__writes-title {
    font-weight: 700;
    padding: 4px 4px 10px;
    border-bottom: 1px solid #eee;
    margin-bottom: 8px;
}
.handover-e2e__write {
    border: 1px solid #ececec;
    border-radius: 8px;
    padding: 8px 10px;
    margin-bottom: 8px;
}
.handover-e2e__write-head {
    display: flex;
    align-items: center;
    font-size: 13px;
    margin-bottom: 6px;
}
.handover-e2e__write-body {
    font-size: 12px;
    line-height: 1.5;
    margin: 0;
    white-space: pre-wrap;
    word-break: break-all;
    color: #333;
}

/* --- 2단계: 인계 스레드 묶음 --- */
.handover-e2e__stage {
    height: calc(100vh - 44px);
    box-sizing: border-box;
    padding: 14px 16px 132px;
    background: #f4f2f8;
    overflow-y: auto;
}
.handover-e2e__stage-title {
    font-weight: 700;
    font-size: 15px;
    margin-bottom: 10px;
}
.handover-e2e__stage-sub {
    margin-left: 10px;
    font-size: 12px;
    font-weight: 400;
    color: #7a7a8c;
}
.handover-e2e__threads {
    display: flex;
    flex-direction: column;
    gap: 8px;
}
.handover-e2e__thread {
    background: #fff;
    border-radius: 10px;
    padding: 10px 12px;
}
.handover-e2e__thread-head {
    display: flex;
    align-items: center;
    font-size: 12px;
    color: #68369a;
    margin-bottom: 6px;
}
.font-mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.handover-e2e__thread-steps {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    row-gap: 4px;
}
.handover-e2e__step {
    display: inline-flex;
    align-items: center;
    font-size: 12px;
    background: #f0edf7;
    border-radius: 20px;
    padding: 3px 10px;
}
.handover-e2e__step.is-agent {
    background: #e6efff;
    color: #1c4ea8;
}
.handover-e2e__step.is-implicit {
    border: 1px dashed #b9a8d6;
}

/* --- 3단계: 마이닝 결과 --- */
.handover-e2e__mining {
    display: flex;
    gap: 12px;
    align-items: flex-start;
}
.handover-e2e__mining-left {
    flex: 1 1 56%;
}
.handover-e2e__mining-right {
    flex: 1 1 44%;
}
.handover-e2e__flow {
    display: flex;
    flex-wrap: wrap;
    align-items: stretch;
    gap: 8px;
    background: #fff;
    border-radius: 10px;
    padding: 12px;
    margin-bottom: 10px;
}
.handover-e2e__node {
    border: 1px solid #ddd8ea;
    border-radius: 8px;
    padding: 8px 10px;
    font-size: 12px;
    min-width: 118px;
}
.handover-e2e__node.is-gateway {
    display: flex;
    align-items: center;
    background: #fbf8e8;
    border-color: #e2d79a;
    min-width: 0;
    color: #7a6a1f;
}
.handover-e2e__node-name {
    font-weight: 700;
    display: flex;
    align-items: center;
}
.handover-e2e__node-role {
    color: #7a7a8c;
    margin-top: 2px;
}
.handover-e2e__variants {
    background: #fff;
    border-radius: 10px;
    padding: 10px 12px;
}
.handover-e2e__variant {
    line-height: 1.8;
}
.handover-e2e__variant-count {
    display: inline-block;
    min-width: 34px;
    font-weight: 700;
    color: #68369a;
}
.handover-e2e__pr {
    background: #fff;
    border-radius: 10px;
    padding: 12px;
}
.handover-e2e__pr-head {
    display: flex;
    align-items: center;
    font-size: 13px;
}
.handover-e2e__pr-meta {
    font-size: 11px;
    color: #7a7a8c;
    margin: 6px 0 8px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.handover-e2e__pr-body {
    font-size: 12px;
    line-height: 1.6;
    white-space: pre-wrap;
    margin: 0;
    color: #333;
}
.handover-e2e__pr-foot {
    margin-top: 10px;
    font-size: 11px;
    color: #3fa860;
}
</style>

