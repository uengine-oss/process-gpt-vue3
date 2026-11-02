<template>
    <v-card elevation="10" class="rounded-xl handover-mining">
        <v-card-text class="pa-4">
            <!-- Header — 분석 메뉴의 다른 화면과 같은 틀(제목 · 한 줄 설명 · 오른쪽 아이콘 동작) -->
            <div class="d-flex justify-space-between align-center mb-4">
                <div>
                    <h1 class="text-h5 font-weight-bold text-textPrimary">프로세스 식별</h1>
                    <p class="text-body-2 text-grey100 mb-0 mt-1">인계 기록에서 아직 정의되지 않은 업무를 찾습니다</p>
                </div>
                <div class="d-flex align-center">
                    <v-tooltip text="새로고침" location="bottom">
                        <template v-slot:activator="{ props }">
                            <v-btn v-bind="props" icon variant="text" size="small" :loading="loading" @click="load">
                                <v-icon>mdi-refresh</v-icon>
                            </v-btn>
                        </template>
                    </v-tooltip>
                    <v-tooltip text="새 프로세스로 제안" location="bottom">
                        <template v-slot:activator="{ props }">
                            <v-btn
                                v-bind="props"
                                icon
                                variant="text"
                                size="small"
                                :loading="proposing"
                                :disabled="!discovered"
                                class="e2e-propose-pr"
                                aria-label="새 프로세스로 제안"
                                @click="openProposeDialog"
                            >
                                <v-icon>mdi-source-pull</v-icon>
                            </v-btn>
                        </template>
                    </v-tooltip>
                    <v-tooltip text="실행 가능한 프로세스로 전환" location="bottom">
                        <template v-slot:activator="{ props }">
                            <v-btn
                                v-bind="props"
                                icon
                                variant="text"
                                size="small"
                                :loading="converting"
                                :disabled="!discovered"
                                class="e2e-convert-process"
                                aria-label="실행 가능한 프로세스로 전환"
                                @click="convertToProcess"
                            >
                                <v-icon>mdi-rocket-launch-outline</v-icon>
                            </v-btn>
                        </template>
                    </v-tooltip>
                </div>
            </div>

            <div v-if="loading" class="pa-8 text-center">
                <v-progress-circular indeterminate color="primary" />
            </div>
            <v-alert v-else-if="error" type="error" variant="tonal" class="mb-4">{{ error }}</v-alert>

            <template v-if="!loading && !error">
                <!-- 업무 묶음: 서로 다른 업무를 한 프로세스의 갈래로 그리지 않도록 묶음마다 따로 도출한다 -->
                <!-- 업무 묶음: 서로 다른 업무를 한 프로세스의 갈래로 그리지 않도록 묶음마다 따로 도출한다.
                     업무는 계속 늘어나므로 칩으로 다 펼치지 않고 검색되는 선택 상자 하나로 고른다. -->
                <v-row v-if="groups.length" dense class="mb-2">
                    <v-col cols="12" md="5">
                        <v-autocomplete
                            :model-value="selectedKey"
                            :items="groupItems"
                            item-title="name"
                            item-value="process_key"
                            label="업무"
                            density="compact"
                            variant="outlined"
                            hide-details
                            class="e2e-process-select"
                            @update:model-value="selectGroup"
                        >
                            <template v-slot:item="{ props, item }">
                                <v-list-item
                                    v-bind="props"
                                    class="e2e-process-option"
                                    :class="{ 'text-medium-emphasis': !item.raw.minable }"
                                    :data-key="item.raw.process_key"
                                >
                                    <template v-slot:append>
                                        <span class="text-caption text-medium-emphasis">{{ item.raw.case_count }}</span>
                                    </template>
                                </v-list-item>
                            </template>
                        </v-autocomplete>
                    </v-col>
                </v-row>

                <v-row>
                    <v-col cols="12" md="4" class="d-flex flex-column ga-4">
                        <!-- 인계 스레드 — 업무 이름 · 시작한 사람 · 날짜. 누르면 시작한 방이 열린다 -->
                        <v-card variant="outlined" class="rounded-lg">
                            <v-card-text class="pa-4">
                                <div class="d-flex align-center mb-3">
                                    <h3 class="text-subtitle-1 font-weight-semibold text-textPrimary">인계 스레드</h3>
                                    <v-chip size="x-small" variant="tonal" class="ml-2 e2e-thread-count">{{
                                        visibleThreads.length
                                    }}</v-chip>
                                </div>
                                <div class="mining-threads">
                                    <div
                                        v-for="t in visibleThreads"
                                        :key="t.origin_room_id"
                                        class="mining-thread e2e-thread"
                                        :class="{ 'is-open': t.finished === false }"
                                        :data-room-id="t.origin_room_id"
                                        :data-finished="t.finished === false ? 'false' : 'true'"
                                        role="button"
                                        tabindex="0"
                                        @click="openRoom(t.origin_room_id)"
                                        @keydown.enter="openRoom(t.origin_room_id)"
                                    >
                                        <div class="mining-thread__title">
                                            <span class="mining-thread__name">{{ threadName(t) }}</span>
                                            <!-- 마지막으로 받은 할 일이 끝나지 않은 건은 도출에 들어가지 않는다 -->
                                            <v-tooltip v-if="t.finished === false" text="진행 중 — 도출에서 제외" location="top">
                                                <template v-slot:activator="{ props }">
                                                    <v-icon v-bind="props" size="14" class="ml-1 text-medium-emphasis e2e-thread-open">
                                                        mdi-progress-clock
                                                    </v-icon>
                                                </template>
                                            </v-tooltip>
                                        </div>
                                        <div class="text-caption text-medium-emphasis">
                                            {{ threadStarter(t) }} · {{ formatDate(threadStartedAt(t)) }}
                                        </div>
                                    </div>
                                    <div v-if="!visibleThreads.length" class="text-caption text-medium-emphasis">—</div>
                                </div>
                            </v-card-text>
                        </v-card>

                        <!-- 조직 마이닝: 고른 업무의 단계를 실제로 수행해 온 사람과 에이전트 -->
                        <v-card v-if="eligibility.length" variant="outlined" class="rounded-lg">
                            <v-card-text class="pa-4">
                                <h3 class="text-subtitle-1 font-weight-semibold text-textPrimary mb-3">수행한 사람</h3>
                                <div v-for="e in eligibility" :key="e.activity" class="mining-elig e2e-elig-row">
                                    <div class="mining-elig__act">{{ e.activity }}</div>
                                    <div class="mining-elig__who">
                                        <span
                                            v-for="c in e.candidates.slice(0, 2)"
                                            :key="c.user_id"
                                            class="mining-who-chip"
                                            :class="{ 'is-agent': c.is_agent }"
                                        >
                                            <v-icon v-if="c.is_agent" size="10" class="mr-1">mdi-robot-outline</v-icon>{{ c.name }}
                                            <span class="mining-who-ev">{{ c.evidence_count }}</span>
                                        </span>
                                    </div>
                                    <v-tooltip :text="automationText(e.automation_rate)" location="top">
                                        <template v-slot:activator="{ props }">
                                            <v-icon v-bind="props" size="16" class="text-medium-emphasis">
                                                {{ automationIcon(e.automation_rate) }}
                                            </v-icon>
                                        </template>
                                    </v-tooltip>
                                </div>
                            </v-card-text>
                        </v-card>
                    </v-col>

                    <v-col cols="12" md="8" class="d-flex flex-column ga-4">
                        <!-- 도출된 프로세스 — 흐름은 여기 한 곳에서만 보인다 -->
                        <v-card variant="outlined" class="rounded-lg">
                            <v-card-text class="pa-4">
                                <div class="d-flex align-center mb-3">
                                    <h3 class="text-subtitle-1 font-weight-semibold text-textPrimary">도출된 프로세스</h3>
                                    <v-chip v-if="discovered" size="x-small" variant="tonal" class="ml-2">
                                        케이스 {{ discovered.stats.case_count }}
                                    </v-chip>
                                </div>
                                <div class="mining-canvas">
                                    <BpmnUengineViewer
                                        v-if="bpmnXml"
                                        :key="bpmnXml.length"
                                        :bpmn="bpmnXml"
                                        :disable-auto-orientation="true"
                                    />
                                    <div v-else class="pa-6 text-caption text-medium-emphasis e2e-discover-empty">
                                        도출된 프로세스가 없습니다.
                                        <div v-if="discoverError" class="mt-1">{{ discoverError }}</div>
                                    </div>
                                </div>
                            </v-card-text>
                        </v-card>

                        <!-- 식별된 신규 프로세스 제안 -->
                        <v-card variant="outlined" class="rounded-lg">
                            <v-card-text class="pa-4">
                                <div class="d-flex align-center mb-2">
                                    <h3 class="text-subtitle-1 font-weight-semibold text-textPrimary">제안</h3>
                                    <v-chip size="x-small" variant="tonal" class="ml-2 e2e-proposal-count">{{ proposals.length }}</v-chip>
                                </div>
                                <v-alert v-if="prResult" type="success" variant="tonal" density="compact" class="mb-2 e2e-pr-result">
                                    {{ prResult.title }}
                                </v-alert>
                                <div v-if="!proposals.length" class="text-caption text-medium-emphasis">—</div>
                                <div v-for="p in proposals" :key="p.id" class="mining-proposal e2e-proposal-row">
                                    <v-chip size="x-small" :color="p.status === 'OPEN' ? 'success' : 'grey'" variant="flat">
                                        {{ p.status }}
                                    </v-chip>
                                    <span class="ml-2 font-weight-medium">{{ p.title }}</span>
                                    <v-spacer />
                                    <span class="text-caption text-medium-emphasis">{{ formatDate(p.created_at) }}</span>
                                </div>
                            </v-card-text>
                        </v-card>
                    </v-col>
                </v-row>
            </template>
        </v-card-text>

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
                    @focus="selectOwnerText"
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
    </v-card>
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
            organization: null,
            // 스레드를 시작한 방의 이름(업무 이름) — 방 id 대신 보인다
            roomNames: {}
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
        /** 선택 상자 항목 — 도출할 수 있는 업무 먼저, 케이스가 많은 순 */
        groupItems() {
            return [...this.groups].sort((a, b) => Number(!!b.minable) - Number(!!a.minable) || (b.case_count || 0) - (a.case_count || 0));
        },
        selectedGroup() {
            return this.groups.find((g) => g.process_key === this.selectedKey) || null;
        },
        /** 고른 업무의 단계만. 다른 업무의 단계와 담당자는 보이지 않는다. */
        eligibility() {
            const rows = this.organization?.eligibility || [];
            const acts = new Set(this.selectedGroup?.activities || []);
            if (!acts.size) return [];
            return rows.filter((e) => acts.has(e.activity));
        }
    },
    async created() {
        await this.load();
    },
    methods: {
        threadName(t) {
            return this.roomNames[t.origin_room_id] || t.steps?.[0]?.activity || '—';
        },
        threadStarter(t) {
            const first = t.steps?.[0];
            return (first && (first.source === 'start' ? first.to : first.from)) || '';
        },
        threadStartedAt(t) {
            return t.steps?.[0]?.occurred_at || '';
        },
        openRoom(roomId) {
            if (roomId) this.$router.push({ path: '/chat', query: { roomId } });
        },
        automationIcon(rate) {
            if (rate >= 1) return 'mdi-robot-outline';
            if (rate > 0) return 'mdi-account-cog-outline';
            return 'mdi-account-outline';
        },
        automationText(rate) {
            if (rate >= 1) return '에이전트가 수행';
            if (rate > 0) return '사람과 에이전트가 함께 수행';
            return '사람이 수행';
        },
        /** 담당자 칸에 들어갈 때 기존 이름을 선택해 둔다 — 바로 다른 사람 이름을 치면 바뀐다. */
        selectOwnerText(e) {
            const el = e?.target;
            if (el && typeof el.select === 'function') requestAnimationFrame(() => el.select());
        },
        /** 스레드를 시작한 방 이름을 한 번에 읽는다. */
        async loadRoomNames() {
            const ids = Array.from(new Set(this.threads.map((t) => t.origin_room_id).filter(Boolean)));
            const names = {};
            for (let i = 0; i < ids.length; i += 100) {
                const { data } = await window.$supabase
                    .from('chat_rooms')
                    .select('id, name')
                    .in('id', ids.slice(i, i + 100));
                for (const r of data || []) if (r.name) names[r.id] = r.name;
            }
            this.roomNames = names;
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
                await this.loadRoomNames().catch((e) => console.warn('[mining] 방 이름 조회 실패:', e));
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
            this.bpmnXml = dc ? this.markMultiInstance(this.toBpmn(dc.definition), dc) : '';
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
            // 생성기는 elements[] 가 이미 있으면 자체 변환(transformJsonModel)을 건너뛰고 gateWayType 만 읽는다.
            // 비어 있으면 모든 게이트웨이가 배타(X)로 그려져, 병렬 분기가 선택처럼 보였다.
            const GW_XML = { parallelGateway: 'bpmn:parallelGateway', inclusiveGateway: 'bpmn:inclusiveGateway' };
            (d.gateways || []).forEach((g) =>
                elements.push({
                    elementType: 'Gateway',
                    id: g.id,
                    name: g.name || '',
                    type: GW[g.type] || 'ExclusiveGateway',
                    gateWayType: GW_XML[g.type] || 'bpmn:exclusiveGateway',
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
        /**
         * 같은 일을 한 번에 여러 명에게 준 단계(다중 인스턴스)에 BPMN 표준 표시를 붙인다.
         * 병렬 다중 인스턴스(multiInstanceLoopCharacteristics, isSequential 기본 false)라 모델러가
         * 표준 ||| 표시로 그린다. 정의 JSON 에는 이 속성이 없어 XML 에만 붙인다.
         */
        markMultiInstance(xml, dc) {
            const names = new Set(dc?.stats?.multi_instance_activities || []);
            if (!xml || !names.size) return xml;
            try {
                const ids = new Set((dc.definition?.activities || []).filter((a) => names.has(a.name)).map((a) => a.id));
                const doc = new DOMParser().parseFromString(xml, 'application/xml');
                const NS = 'http://www.omg.org/spec/BPMN/20100524/MODEL';
                let marked = 0;
                for (const el of Array.from(doc.getElementsByTagNameNS(NS, '*'))) {
                    if (!/Task$/.test(el.localName) || !ids.has(el.getAttribute('id'))) continue;
                    if (el.getElementsByTagNameNS(NS, 'multiInstanceLoopCharacteristics').length) continue;
                    el.appendChild(doc.createElementNS(NS, `${el.prefix ? el.prefix + ':' : ''}multiInstanceLoopCharacteristics`));
                    marked += 1;
                }
                return marked ? new XMLSerializer().serializeToString(doc) : xml;
            } catch (e) {
                console.warn('[mining] 다중 인스턴스 표시 실패:', e);
                return xml;
            }
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
                    // 도출된 정의를 그대로 싣는다. 생성 에이전트는 이 정의를 작업 폴더에 받아
                    // 흐름(단계·담당자·순서·분기)은 두고 폼·스킬·에이전트만 보강한다.
                    context: {
                        identification: {
                            source: 'handover-mining',
                            process_definition_id: d.processDefinitionId,
                            process_key: this.selectedKey || null,
                            case_count: this.discovered.stats.case_count,
                            definition: d
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
                `흐름은 프로세스 폴더의 process-definition.json 에 이미 있습니다. 흐름은 바꾸지 말고 폼·스킬·에이전트만 보강해 주세요.`,
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
            const roleOf = (n) => {
                try {
                    return JSON.parse(n.properties || '{}').minedRole || '';
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
                } else if (role === 'loop_exit' && roleOf(s) === 'redo') {
                    // 반복 판정에서 빠져나가는 선에도 선택값('완료')이 붙으므로 선의 자리로 가른다
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
.mining-threads {
    max-height: 420px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 2px;
}
.mining-thread {
    padding: 8px 10px;
    border-radius: 8px;
    cursor: pointer;
}
.mining-thread:hover,
.mining-thread:focus-visible {
    background: rgba(var(--v-theme-on-surface), 0.04);
    outline: none;
}
.mining-thread.is-open {
    opacity: 0.6;
}
.mining-thread__title {
    display: flex;
    align-items: center;
    font-size: 14px;
    font-weight: 600;
}
.mining-thread__name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.mining-canvas {
    height: 460px;
    border-radius: 8px;
    overflow: hidden;
}
.mining-elig {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    padding: 6px 0;
    border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.06);
}
.mining-elig:last-child {
    border-bottom: none;
}
.mining-elig__act {
    flex: 0 0 38%;
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
    font-size: 12px;
    background: rgba(var(--v-theme-on-surface), 0.05);
    border-radius: 20px;
    padding: 2px 8px;
}
.mining-who-chip.is-agent {
    background: rgba(var(--v-theme-primary), 0.08);
    color: rgb(var(--v-theme-primary));
}
.mining-who-ev {
    margin-left: 4px;
    opacity: 0.6;
    font-size: 11px;
}
.mining-proposal {
    display: flex;
    align-items: center;
    font-size: 13px;
    padding: 6px 0;
    border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.06);
}
.mining-proposal:last-child {
    border-bottom: none;
}
</style>
