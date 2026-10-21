<template>
    <v-app>
        <div class="mining-page">
            <div class="mining-header">
                <v-icon size="20" class="mr-2">mdi-source-branch</v-icon>
                <span class="text-h6 font-weight-bold">프로세스 식별</span>
                <span class="mining-header__sub">
                    아직 정의되지 않은 업무를 인계 기록에서 찾아 <b>새 프로세스로 제안</b>합니다
                    (기존 프로세스 개선은 리뷰 보드에서 다룹니다)
                </span>
                <v-spacer />
                <v-btn
                    color="primary"
                    variant="flat"
                    rounded="pill"
                    size="small"
                    prepend-icon="mdi-source-pull"
                    :loading="proposing"
                    :disabled="!discovered"
                    class="e2e-propose-pr"
                    @click="openProposeDialog"
                >
                    새 프로세스로 제안
                </v-btn>
                <v-btn
                    color="success"
                    variant="flat"
                    rounded="pill"
                    size="small"
                    class="ml-2 e2e-convert-process"
                    prepend-icon="mdi-rocket-launch-outline"
                    :loading="converting"
                    @click="convertToProcess"
                >
                    실행 가능한 프로세스로 전환
                </v-btn>
            </div>

            <div v-if="loading" class="pa-8 text-center">
                <v-progress-circular indeterminate color="primary" />
                <div class="text-caption mt-3 text-medium-emphasis">인계 기록을 분석하는 중…</div>
            </div>

            <div v-if="!loading && error" class="pa-8">
                <v-alert type="error" variant="tonal">{{ error }}</v-alert>
            </div>

            <!-- 업무 묶음: 서로 다른 업무를 한 프로세스의 갈래로 그리지 않도록 묶음마다 따로 도출한다 -->
            <div v-if="!loading && !error && groups.length" class="mining-groups">
                <span class="mining-section-sub mr-2">업무</span>
                <v-chip-group v-model="selectedKey" mandatory selected-class="text-primary" @update:model-value="selectGroup">
                    <v-chip
                        v-for="g in groups"
                        :key="g.process_key"
                        :value="g.process_key"
                        size="small"
                        variant="outlined"
                        class="e2e-process-group"
                        :data-key="g.process_key"
                    >
                        {{ g.name }}
                        <span class="ml-1 text-medium-emphasis">{{ g.case_count }}건</span>
                    </v-chip>
                </v-chip-group>
            </div>

            <div v-if="!loading && !error" class="mining-body">
                <!-- 왼쪽: 인계 스레드 묶음 -->
                <div class="mining-left">
                    <div class="mining-section-title">
                        인계 스레드
                        <v-chip size="x-small" variant="tonal" class="ml-2 e2e-thread-count">{{ visibleThreads.length }}건</v-chip>
                        <span class="mining-section-sub">최초 시작된 방 기준 · 방이 바뀌어도 한 묶음</span>
                    </div>

                    <div class="mining-threads">
                        <div
                            v-for="t in visibleThreads"
                            :key="t.origin_room_id"
                            class="mining-thread e2e-thread"
                            :class="{ 'is-open': t.finished === false }"
                            :data-finished="t.finished === false ? 'false' : 'true'"
                        >
                            <div class="mining-thread__head">
                                <v-icon size="13" class="mr-1">mdi-source-branch</v-icon>
                                <span class="mono">{{ t.origin_room_id }}</span>
                                <v-chip size="x-small" variant="tonal" class="ml-2">{{ t.step_count }}단계</v-chip>
                                <!-- 마지막으로 받은 할 일이 끝나지 않은 건은 도출에 들어가지 않는다 -->
                                <v-tooltip v-if="t.finished === false" text="진행 중 — 도출에서 제외" location="top">
                                    <template v-slot:activator="{ props }">
                                        <v-icon v-bind="props" size="14" class="ml-1 text-medium-emphasis e2e-thread-open">
                                            mdi-progress-clock
                                        </v-icon>
                                    </template>
                                </v-tooltip>
                            </div>
                            <div class="mining-thread__steps">
                                <template v-for="(s, i) in t.steps" :key="i">
                                    <span class="mining-step" :class="{ 'is-agent': s.to_is_agent, 'is-implicit': !s.is_explicit }">
                                        <v-icon v-if="s.to_is_agent" size="11" class="mr-1">mdi-robot-outline</v-icon>
                                        {{ shortLabel(s.activity) }}
                                    </span>
                                    <v-icon v-if="i < t.steps.length - 1" size="12" class="mx-1 text-medium-emphasis">
                                        mdi-arrow-right
                                    </v-icon>
                                </template>
                            </div>
                        </div>
                    </div>

                    <!-- 조직 마이닝: 누가 이 일을 할 수 있나 -->
                    <div v-if="organization" class="mining-org mt-2">
                        <div class="text-caption font-weight-bold mb-2">
                            조직 마이닝
                            <span class="mining-section-sub">이 흐름을 실제로 수행해 온 사람과 역할</span>
                        </div>
                        <div v-for="e in organization.eligibility.slice(0, 6)" :key="e.activity" class="mining-elig e2e-elig-row">
                            <div class="mining-elig__act">{{ e.activity }}</div>
                            <div class="mining-elig__who">
                                <span v-for="c in e.candidates.slice(0, 2)" :key="c.user_id" class="mining-who-chip" :class="{ 'is-agent': c.is_agent }">
                                    <v-icon v-if="c.is_agent" size="10" class="mr-1">mdi-robot-outline</v-icon>{{ c.name }}
                                    <span class="mining-who-ev">{{ c.evidence_count }}건</span>
                                </span>
                            </div>
                            <div class="mining-elig__auto">
                                <span v-if="e.automation_rate >= 1">자동</span>
                                <span v-else-if="e.automation_rate > 0">혼합</span>
                                <span v-else>사람</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 오른쪽: 도출된 프로세스 (기존 BPMN 모델러로 렌더) -->
                <div class="mining-right">
                    <div class="mining-section-title">
                        도출된 프로세스
                        <span class="mining-section-sub">
                            케이스 {{ discovered?.stats.case_count ?? 0 }}건에서 도출 · 기존 BPMN 모델러로 표시
                        </span>
                    </div>

                    <div class="mining-canvas">
                        <BpmnUengineViewer v-if="bpmnXml" :key="bpmnXml.length" :bpmn="bpmnXml" :disable-auto-orientation="true" />
                        <div v-else class="pa-6 text-caption text-medium-emphasis e2e-discover-empty">
                            도출된 프로세스가 없습니다.
                            <div v-if="discoverError" class="mt-1">{{ discoverError }}</div>
                        </div>
                    </div>

                    <div v-if="discovered" class="mining-variants">
                        <div class="text-caption font-weight-bold mb-1">관측된 흐름</div>
                        <div v-for="(v, i) in discovered.stats.variants" :key="i" class="text-caption mining-variant">
                            <span class="mining-variant__count">{{ v.count }}건</span>
                            {{ v.trace.join(' → ') }}
                        </div>
                        <div v-if="agentActivities.length" class="text-caption mt-2">
                            <v-icon size="13" class="mr-1">mdi-robot-outline</v-icon>
                            자동 수행 단계:
                            <span class="font-weight-bold">{{ agentActivities.join(', ') }}</span>
                        </div>
                    </div>

                    <v-alert v-if="prResult" type="success" variant="tonal" density="compact" class="mt-3 e2e-pr-result mining-pr-result">
                        새 프로세스 제안이 등록되었습니다 — {{ prResult.title }}
                        <div class="text-caption mt-1">아래 목록에서 검토·승인할 수 있습니다.</div>
                    </v-alert>

                    <!-- 식별된 신규 프로세스 제안이 모이는 곳 -->
                    <div class="mining-proposals mt-3">
                        <div class="text-caption font-weight-bold mb-2 d-flex align-center">
                            식별된 신규 프로세스 제안
                            <v-chip size="x-small" variant="tonal" class="ml-2 e2e-proposal-count">{{ proposals.length }}건</v-chip>
                            <span class="mining-section-sub">승인 전까지 실제 프로세스 정의는 바뀌지 않습니다</span>
                        </div>
                        <div v-if="!proposals.length" class="text-caption text-medium-emphasis">
                            아직 제안이 없습니다. 위 [새 프로세스로 제안]을 눌러 등록하세요.
                        </div>
                        <div v-for="p in proposals" :key="p.id" class="mining-proposal e2e-proposal-row">
                            <v-chip size="x-small" :color="p.status === 'OPEN' ? 'success' : 'grey'" variant="flat">
                                {{ p.status }}
                            </v-chip>
                            <span class="ml-2 font-weight-medium">{{ p.title }}</span>
                            <span class="ml-2 text-caption text-medium-emphasis mono">{{ p.branch_name }}</span>
                            <v-spacer />
                            <span class="text-caption text-medium-emphasis">{{ formatDate(p.created_at) }}</span>
                        </div>
                    </div>
                </div>
            </div>
            <!-- 새 프로세스로 제안: 담당자(소유자)를 정한다. 병합함은 소유자를 검토자로 본다 -->
            <v-dialog v-model="proposeDialog" max-width="520">
                <v-card class="pa-4 e2e-propose-dialog">
                    <div class="text-subtitle-1 font-weight-bold mb-1">새 프로세스로 제안</div>
                    <div class="text-caption text-medium-emphasis mb-4">
                        담당자가 병합함에서 검토하고 승인하면 실제 프로세스로 저장됩니다. 본인을 지정해도 됩니다.
                    </div>
                    <v-text-field v-model="proposeTitle" label="제목" variant="outlined" density="compact" class="mb-2" />
                    <v-autocomplete
                        v-model="proposeOwnerId"
                        :items="people"
                        item-title="label"
                        item-value="id"
                        label="이 프로세스의 담당자(검토자)"
                        variant="outlined"
                        density="compact"
                        class="e2e-propose-owner"
                    />
                    <div v-if="proposeError" class="text-caption text-error mb-2">{{ proposeError }}</div>
                    <div class="d-flex justify-end">
                        <v-btn variant="text" @click="proposeDialog = false">취소</v-btn>
                        <v-btn
                            color="primary"
                            variant="flat"
                            class="ml-2 e2e-propose-submit"
                            :loading="proposing"
                            :disabled="!proposeOwnerId || !proposeTitle"
                            @click="proposePr"
                        >
                            제안
                        </v-btn>
                    </div>
                </v-card>
            </v-dialog>
        </div>
    </v-app>
</template>

<script>
/**
 * 인계 마이닝 화면.
 * process-miner 서비스가 계산한 결과를 읽어, 도출된 프로세스를 **기존 BPMN 모델러**
 * (BpmnUengineViewer)로 렌더한다. 정의 JSON → BPMN XML 변환은 BPMNXmlGenerator 의
 * createBpmnXml 을 그대로 재사용한다(ProcessFeedback 과 같은 방식).
 */
import BPMNXmlGenerator from '@/components/BPMNXmlGenerator.vue';
import BpmnUengineViewer from '@/components/BpmnUengineViewer.vue';
import { processMiner } from '@/utils/processMiner';
import BackendFactory from '@/components/api/BackendFactory';

const backend = BackendFactory.createBackend();

export default {
    name: 'HandoverMining',
    // createBpmnXml(jsonModel) 만 쓰는 순수 유틸 mixin
    mixins: [BPMNXmlGenerator],
    components: { BpmnUengineViewer },
    data() {
        return {
            loading: true,
            error: '',
            threads: [],
            // 업무 묶음과 지금 보고 있는 묶음
            groups: [],
            selectedKey: null,
            discovered: null,
            discoverError: '',
            bpmnXml: '',
            proposing: false,
            converting: false,
            prResult: null,
            proposals: [],
            proposeDialog: false,
            proposeTitle: '',
            proposeOwnerId: null,
            proposeError: '',
            people: [],
            organization: null
        };
    },
    computed: {
        tenantId() {
            return window.$tenantName || 'localhost';
        },
        /** 고른 업무의 스레드. 진행 중인 스레드는 가장 가까운 업무에 붙어 함께 보인다. 묶음이 없으면 전부 */
        visibleThreads() {
            if (!this.selectedKey) return this.threads;
            return this.threads.filter((t) => t.process_key === this.selectedKey);
        },
        agentActivities() {
            return (this.discovered?.definition?.activities || []).filter((a) => a.agent).map((a) => a.name);
        }
    },
    async created() {
        await this.load();
    },
    methods: {
        shortLabel(s) {
            const t = String(s || '').trim();
            return t.length > 22 ? `${t.slice(0, 22)}…` : t;
        },
        async load() {
            this.loading = true;
            this.error = '';
            try {
                // 스레드와 업무 묶음은 도출과 따로 받는다. 끝난 건이 모자라 도출이 안 돼도
                // 쌓인 스레드(진행 중인 건 포함)는 보여야 한다.
                const [th, pg] = await Promise.all([
                    processMiner.threads(this.tenantId),
                    processMiner.processes(this.tenantId).catch(() => ({ processes: [] }))
                ]);
                this.threads = th.threads || [];
                this.groups = pg.processes || [];
                const first = this.groups.find((g) => g.minable) || this.groups[0];
                this.selectedKey = first ? first.process_key : null;
                await this.loadDiscovered();
                this.organization = await processMiner.organization(this.tenantId).catch(() => null);
            } catch (e) {
                this.error = e?.message || String(e);
            } finally {
                this.loading = false;
            }
        },
        /** 고른 업무 묶음의 프로세스를 도출한다. */
        async loadDiscovered() {
            this.discoverError = '';
            this.prResult = null;
            const dc = await processMiner.discovered(this.tenantId, this.selectedKey || undefined).catch((e) => {
                this.discoverError = e?.message || String(e);
                return null;
            });
            this.discovered = dc;
            this.bpmnXml = dc ? this.toBpmn(dc.definition) : '';
            this.proposals = [];
            if (dc) await this.loadProposals(dc.definition?.processDefinitionId);
        },
        async selectGroup(key) {
            if (!key) return;
            this.selectedKey = key;
            await this.loadDiscovered();
        },
        /**
         * 마이너가 내는 flattened 정의(activities/gateways/events/sequences)를
         * BPMNXmlGenerator 가 소비하는 elements[] 저작 형식으로 바꾼다.
         * (생성기의 createSequenceFlows/createProcessElements 는 elements[] 를 읽는다)
         */
        toElementsFormat(d) {
            const ACT = { userTask: 'UserActivity', manualTask: 'UserActivity', serviceTask: 'UserActivity' };
            const GW = {
                exclusiveGateway: 'ExclusiveGateway',
                parallelGateway: 'ParallelGateway',
                inclusiveGateway: 'InclusiveGateway'
            };
            const EV = { startEvent: 'StartEvent', endEvent: 'EndEvent', intermediateCatchEvent: 'IntermediateCatchEvent' };

            const roles = d.roles || [];
            const defaultRole = roles.length ? roles[0].name : '담당자';
            // 게이트웨이는 role 이 비어 있을 수 있는데, 레인 배치가 role 기준이라
            // 비면 도형이 어느 레인에도 못 들어간다. 직전 활동의 역할을 물려준다.
            const roleOfNode = {};
            (d.activities || []).forEach((a) => (roleOfNode[a.id] = a.role || defaultRole));

            const prevRole = (id) => {
                const seq = (d.sequences || []).find((s) => s.target === id);
                return seq ? roleOfNode[seq.source] || defaultRole : defaultRole;
            };

            const elements = [];
            (d.events || []).forEach((e) =>
                elements.push({
                    elementType: 'Event',
                    id: e.id,
                    name: e.name,
                    type: EV[e.type] || 'StartEvent',
                    role: e.role || defaultRole,
                    description: e.description || ''
                })
            );
            (d.activities || []).forEach((a) =>
                elements.push({
                    elementType: 'Activity',
                    id: a.id,
                    name: a.name,
                    type: ACT[a.type] || 'UserActivity',
                    role: a.role || defaultRole,
                    description: a.description || '',
                    instruction: a.instruction || '',
                    inputData: a.inputData || [],
                    outputData: a.outputData || [],
                    checkpoints: a.checkpoints || [],
                    agent: a.agent || '',
                    agentMode: a.agentMode || '',
                    orchestration: a.orchestration || '',
                    duration: a.duration || 1
                })
            );
            (d.gateways || []).forEach((g) =>
                elements.push({
                    elementType: 'Gateway',
                    id: g.id,
                    name: g.name || '',
                    type: GW[g.type] || 'ExclusiveGateway',
                    role: g.role || prevRole(g.id),
                    description: g.description || ''
                })
            );
            (d.sequences || []).forEach((s) =>
                elements.push({
                    elementType: 'Sequence',
                    id: s.id,
                    source: s.source,
                    target: s.target,
                    condition: s.condition || ''
                })
            );

            return {
                processDefinitionId: d.processDefinitionId,
                processDefinitionName: d.processDefinitionName,
                description: d.description || '',
                isHorizontal: d.isHorizontal !== false,
                data: d.data || [],
                roles: roles.length ? roles : [{ name: defaultRole, endpoint: '', resolutionRule: '' }],
                elements,
                subProcesses: []
            };
        },
        /** 도출된 정의 JSON → BPMN XML (기존 모델러가 그대로 읽는 형식) */
        toBpmn(definition) {
            if (!definition) return '';
            try {
                const model = this.toElementsFormat(definition);
                return this.createBpmnXml(model, model.isHorizontal) || '';
            } catch (e) {
                console.error('[mining] BPMN 변환 실패:', e);
                this.error = `BPMN 변환 실패: ${e?.message || e}`;
                return '';
            }
        },
        formatDate(v) {
            if (!v) return '';
            const d = new Date(v);
            if (isNaN(d.getTime())) return String(v).slice(0, 16);
            const pad = (n) => String(n).padStart(2, '0');
            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
        },
        /** 이 화면에서 낸 신규 프로세스 제안 목록. 기존 PR 승인 틀(resource_pull_requests)을 그대로 쓴다. */
        async loadProposals(procDefId) {
            if (!procDefId) return;
            try {
                this.proposals = await backend.getResourcePrRecords('bpmn', procDefId);
            } catch (e) {
                console.warn('[mining] 제안 목록 조회 실패:', e);
                this.proposals = [];
            }
        },
        /**
         * 도출된 프로세스를 실행 가능한 형태로 전환한다.
         *
         * 이미 BPMN 으로 모델링된 결과가 있으므로, 사용자가 프로세스를 말로 다시
         * 설명할 이유가 없다. 전환용 대화방을 만들어 **도출된 정의를 그대로 실어**
         * 보내고 그 방으로 이동한다. 대화창은 열리자마자 생성 단계로 들어간다.
         */
        async convertToProcess() {
            if (!this.discovered?.definition) {
                this.error = '도출된 프로세스가 아직 준비되지 않았습니다.';
                return;
            }
            this.converting = true;
            try {
                const d = this.discovered.definition;
                // 브라우저 표준 UUID 를 쓴다(자체 uuid 생성기는 충돌이 관측됐다)
                const roomId = crypto.randomUUID();
                const uid = localStorage.getItem('uid');

                const { error: roomErr } = await window.$supabase.from('chat_rooms').insert({
                    id: roomId,
                    tenant_id: this.tenantId,
                    name: `${d.processDefinitionName} 실행 전환`,
                    participants: [
                        {
                            id: uid,
                            email: localStorage.getItem('email'),
                            username: localStorage.getItem('userName') || 'demo',
                            profile: '/assets/images/profile/user-3.jpg',
                            is_agent: null,
                            agent_type: null
                        },
                        {
                            id: 'process-gpt-agent',
                            email: null,
                            username: 'Process GPT Agent',
                            profile: '/images/chat-icon.png',
                            is_agent: true,
                            agent_type: 'agent'
                        }
                    ],
                    message: { msg: 'NEW', type: 'text', createdAt: new Date().toISOString() },
                    // 어디서 온 전환인지 남긴다
                    context: {
                        identification: {
                            source: 'handover-mining',
                            process_definition_id: d.processDefinitionId,
                            case_count: this.discovered.stats.case_count
                        }
                    }
                });
                if (roomErr) throw new Error(`대화방 생성 실패: ${roomErr.message}`);

                // 사람이 다시 서술하지 않는다. 도출된 정의를 그대로 실어 보낸다.
                const msgUuid = crypto.randomUUID();
                const { error: msgErr } = await window.$supabase.from('chats').insert({
                    uuid: msgUuid,
                    id: roomId,
                    tenant_id: this.tenantId,
                    messages: {
                        role: 'user',
                        name: localStorage.getItem('userName') || 'demo',
                        email: localStorage.getItem('email') || '',
                        content: this.buildConversionRequest(d),
                        timeStamp: new Date().toISOString()
                    }
                });
                if (msgErr) throw new Error(`요청문 저장 실패: ${msgErr.message}`);

                this.$router.push(`/chat?roomId=${roomId}&autosend=1`);
            } catch (e) {
                this.error = e?.message || String(e);
            } finally {
                this.converting = false;
            }
        },
        /** 도출 결과를 생성 요청문으로 편다(사람이 타이핑하지 않는다). */
        buildConversionRequest(d) {
            // miningFlow 는 렌더용 computed 라 비어 있을 수 있다. 정의에서 직접 편다.
            const order = (Array.isArray(this.miningFlow) ? this.miningFlow : []).filter((n) => n.kind === 'activity');
            const activities = order.length ? order : (d.activities || []).map((a) => ({ ...a, kind: 'activity' }));
            const tags = this.conditionalActivityTags(d);
            const lines = [
                `인계 기록에서 식별된 업무 흐름입니다. 이대로 실행 가능한 프로세스로 만들어 주세요.`,
                ``,
                `[${d.processDefinitionName}]`
            ];
            activities.forEach((a, i) => {
                const tag = a.agent ? ` — ${a.role}(자동 수행, ${a.orchestration})` : ` — ${a.role}`;
                const opt = tags[a.name] ? ` (${tags[a.name]})` : '';
                lines.push(`${i + 1}) ${a.name}${tag}${opt}`);
            });
            lines.push('');
            lines.push(`관측 근거: 업무 케이스 ${this.discovered.stats.case_count}건`);
            (this.discovered.stats.variants || []).forEach((v) => {
                lines.push(`- (${v.count}건) ${v.trace.join(' → ')}`);
            });
            return lines.join('\n');
        },
        /**
         * 단계마다 붙일 조건 표시 { 활동명: 표시 }.
         * 마이너가 게이트웨이 properties.minedRole 에 도출 구조를 남긴다. 이름으로 짐작하면
         * 반복 판정 게이트웨이 뒤의 필수 단계(예: 고객 발송)까지 '건너뜀'으로 읽힌다.
         */
        conditionalActivityTags(d) {
            const roleOf = (g) => {
                try {
                    return JSON.parse(g.properties || '{}').minedRole || '';
                } catch (e) {
                    return '';
                }
            };
            const gwRole = {};
            (d.gateways || []).forEach((g) => (gwRole[g.id] = roleOf(g)));
            const actById = {};
            (d.activities || []).forEach((a) => (actById[a.id] = a));
            const out = {};
            const seqs = d.sequences || [];
            seqs.forEach((s) => {
                const target = actById[s.target];
                if (!target) return;
                const role = gwRole[s.source];
                if (role === 'choice') {
                    const hasSkip = seqs.some((x) => x.source === s.source && gwRole[x.target] === 'skip');
                    out[target.name] = hasSkip ? '조건에 따라 건너뜀' : '조건에 따라 택일';
                } else if (role === 'loop_exit' && s.condition) {
                    out[target.name] = '반려 시 반복';
                }
            });
            return out;
        },
        /** 제안 창을 연다. 담당자는 기본으로 나다(본인이 검토해도 된다). */
        async openProposeDialog() {
            const d = this.discovered?.definition || {};
            this.proposeTitle = `[식별] ${d.processDefinitionName || '새 프로세스'}`;
            this.proposeOwnerId = localStorage.getItem('uid');
            this.proposeError = '';
            if (!this.people.length) {
                try {
                    const users = (await backend.getUserList({ orderBy: 'username' })) || [];
                    this.people = users
                        .filter((u) => u && !u.is_agent)
                        .map((u) => ({ id: u.id, label: [u.username, u.email].filter(Boolean).join(' · ') }));
                } catch (e) {
                    this.people = [];
                }
            }
            this.proposeDialog = true;
        },
        /** 제안 설명 — 관측 근거를 요청 본문에 남긴다. */
        proposalDescription() {
            const st = this.discovered?.stats || {};
            const lines = [`인계 기록의 끝난 업무 ${st.case_count || 0}건에서 도출했습니다.`, '', '관측된 흐름:'];
            (st.variants || []).slice(0, 5).forEach((v) => lines.push(`- ${v.trace.join(' → ')} (${v.count}건)`));
            return lines.join('\n');
        },
        /**
         * 화면에 그린 그 정의로 제안한다. 프로세스 편집기와 같은 "버전 저장 → 병합 요청" 경로라
         * 병합함·변경사항·병합이 그대로 동작한다(BPMN 스냅샷 · v0.x 브랜치 · 요청자 · 소유자).
         */
        async proposePr() {
            this.proposing = true;
            this.proposeError = '';
            try {
                const d = this.discovered?.definition || {};
                const r = await backend.proposeIdentifiedProcess({
                    procDefId: d.processDefinitionId,
                    name: d.processDefinitionName,
                    xml: this.bpmnXml,
                    definition: d,
                    ownerId: this.proposeOwnerId,
                    title: this.proposeTitle,
                    description: this.proposalDescription()
                });
                this.prResult = r.pr || null;
                this.proposeDialog = false;
                await this.loadProposals(d.processDefinitionId);
            } catch (e) {
                this.proposeError = e?.message || String(e);
            } finally {
                this.proposing = false;
            }
        }
    }
};
</script>

<style scoped>
.mining-page {
    height: 100vh;
    display: flex;
    flex-direction: column;
    background: #f4f2f8;
}
.mining-header {
    display: flex;
    align-items: center;
    padding: 12px 20px;
    background: #2d1b45;
    color: #fff;
}
/* 테마의 .text-h6 글자색이 어두운 머리 줄 위에서 묻히지 않게 한다 */
.mining-header .text-h6 {
    color: inherit;
}
.mining-header__sub {
    margin-left: 14px;
    font-size: 12px;
    opacity: 0.7;
}
.mining-body {
    flex: 1;
    display: flex;
    gap: 12px;
    padding: 12px;
    overflow: hidden;
}
.mining-left {
    flex: 0 0 40%;
    display: flex;
    flex-direction: column;
    min-width: 0;
}
.mining-right {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
}
.mining-section-title {
    font-weight: 700;
    font-size: 14px;
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
}
.mining-section-sub {
    margin-left: 10px;
    font-size: 12px;
    font-weight: 400;
    color: #7a7a8c;
}
.mining-groups {
    display: flex;
    align-items: center;
    padding: 6px 20px 0;
    flex-wrap: wrap;
}
.mining-thread.is-open {
    opacity: 0.6;
}
.mining-threads {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 6px;
}
.mining-thread {
    background: #fff;
    border-radius: 10px;
    padding: 8px 10px;
}
.mining-thread__head {
    display: flex;
    align-items: center;
    font-size: 11px;
    color: #68369a;
    margin-bottom: 5px;
}
.mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.mining-thread__steps {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    row-gap: 4px;
}
.mining-step {
    display: inline-flex;
    align-items: center;
    font-size: 11.5px;
    background: #f0edf7;
    border-radius: 20px;
    padding: 3px 9px;
}
.mining-step.is-agent {
    background: #e6efff;
    color: #1c4ea8;
}
.mining-step.is-implicit {
    border: 1px dashed #b9a8d6;
}
/* 세로 flex 안에서 알림이 남는 높이를 차지해 도면을 밀어내지 않게 한다 */
.mining-pr-result {
    flex: 0 0 auto;
}
.mining-canvas {
    flex: 1;
    background: #fff;
    border-radius: 10px;
    overflow: hidden;
    min-height: 260px;
}
.mining-variants {
    background: #fff;
    border-radius: 10px;
    padding: 10px 12px;
    margin-top: 10px;
}
.mining-variant {
    line-height: 1.75;
}
.mining-org {
    background: #fff;
    border-radius: 10px;
    padding: 10px 12px;
    max-height: 220px;
    overflow-y: auto;
}
.mining-elig {
    display: flex;
    align-items: center;
    font-size: 12px;
    padding: 5px 2px;
    border-bottom: 1px solid #f4f2f8;
}
.mining-elig:last-child {
    border-bottom: none;
}
.mining-elig__act {
    flex: 0 0 36%;
    font-weight: 600;
}
.mining-elig__who {
    flex: 1;
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
}
.mining-who-chip {
    display: inline-flex;
    align-items: center;
    background: #f0edf7;
    border-radius: 20px;
    padding: 2px 8px;
}
.mining-who-chip.is-agent {
    background: #e6efff;
    color: #1c4ea8;
}
.mining-who-ev {
    margin-left: 4px;
    opacity: 0.6;
    font-size: 11px;
}
.mining-elig__auto {
    flex: 0 0 44px;
    text-align: right;
    color: #7a7a8c;
}
.mining-proposals {
    background: #fff;
    border-radius: 10px;
    padding: 10px 12px;
}
.mining-proposal {
    display: flex;
    align-items: center;
    font-size: 12.5px;
    padding: 6px 4px;
    border-bottom: 1px solid #f0eef5;
}
.mining-proposal:last-child {
    border-bottom: none;
}
.mining-variant__count {
    display: inline-block;
    min-width: 34px;
    font-weight: 700;
    color: #68369a;
}
</style>
