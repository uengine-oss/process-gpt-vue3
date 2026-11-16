<template>
    <!-- 프로세스 식별 상세(/mining/handover/:key) — 업무 하나를 페이지를 내리지 않고 판단한다 -->
    <v-card elevation="10" class="rounded-xl handover-mining mining-detail">
        <div class="mining-detail__body">
            <!-- 위치: 목록으로 · 프로세스 식별 / 업무 이름 -->
            <div class="d-flex align-center ga-2 mb-3">
                <v-tooltip text="업무 목록으로" location="bottom">
                    <template v-slot:activator="{ props }">
                        <v-btn
                            v-bind="props"
                            icon
                            variant="text"
                            size="small"
                            aria-label="업무 목록으로"
                            class="e2e-back"
                            :to="'/mining/handover'"
                        >
                            <v-icon>mdi-arrow-left</v-icon>
                        </v-btn>
                    </template>
                </v-tooltip>
                <router-link to="/mining/handover" class="text-body-2 text-medium-emphasis text-decoration-none">프로세스 식별</router-link>
                <span class="text-medium-emphasis">/</span>
                <h1 class="text-h6 font-weight-bold text-textPrimary e2e-detail-name">{{ title }}</h1>
                <span v-if="group" class="text-body-2 text-medium-emphasis">{{ group.case_count }}건</span>
                <span v-if="newIds.length" class="mining-new-badge">+{{ newIds.length }}</span>
                <v-spacer />
                <span v-if="store.judging" class="text-caption text-medium-emphasis">
                    <v-progress-circular indeterminate size="14" width="2" class="mr-1" />{{ store.judging }}건의 업무 범주를 판단하는 중
                </span>
            </div>

            <div v-if="!store.loaded && store.loading" class="pa-8 text-center">
                <v-progress-circular indeterminate color="primary" />
            </div>
            <v-alert v-else-if="store.error" type="error" variant="tonal">{{ store.error }}</v-alert>
            <v-alert
                v-else-if="store.loaded && !store.loading && !group && !isUnclassified"
                type="info"
                variant="tonal"
                class="e2e-not-found"
            >
                이 업무를 찾지 못했습니다.
                <router-link to="/mining/handover">업무 목록으로</router-link>
            </v-alert>

            <div v-else-if="group || isUnclassified" class="mining-detail__grid">
                <!-- 왼쪽: 진행 단계 · 흐름 · 단계 근거 · 근거 건 -->
                <section class="mining-pane mining-pane--main">
                    <div v-if="group" class="mining-pane__head">
                        <ol class="mining-stepper" aria-label="진행 단계">
                            <li v-for="(s, i) in stages" :key="s.key" :class="{ 'is-done': i <= stageIndex }" :data-stage="s.key">
                                <span class="mining-stepper__dot" />{{ s.label }}
                            </li>
                        </ol>
                        <span v-if="isHeld" class="mining-held e2e-group-held">보류</span>
                        <v-spacer />
                        <!-- 조건이 정해지지 않은 분기 — 남아 있으면 정의로 저장하지 않는다 -->
                        <v-tooltip v-if="openSplits.length" :text="openSplitsTip" location="bottom">
                            <template v-slot:activator="{ props }">
                                <span v-bind="props" class="mining-open e2e-open-splits" :data-count="openSplits.length">
                                    <v-icon size="16">mdi-source-branch</v-icon>{{ openSplits.length }}
                                </span>
                            </template>
                        </v-tooltip>
                        <v-btn
                            color="primary"
                            variant="flat"
                            size="small"
                            prepend-icon="mdi-source-pull"
                            class="e2e-propose-pr"
                            :disabled="!discovered || openSplits.length > 0"
                            :loading="proposing"
                            @click="openProposeDialog"
                            >제안</v-btn
                        >
                        <v-tooltip text="실행 가능한 프로세스로 전환" location="bottom">
                            <template v-slot:activator="{ props }">
                                <v-btn
                                    v-bind="props"
                                    icon
                                    variant="text"
                                    size="small"
                                    class="ml-1 e2e-convert-process"
                                    aria-label="실행 가능한 프로세스로 전환"
                                    :disabled="!discovered || openSplits.length > 0"
                                    :loading="converting"
                                    @click="convertToProcess"
                                >
                                    <v-icon>mdi-rocket-launch-outline</v-icon>
                                </v-btn>
                            </template>
                        </v-tooltip>
                        <!-- 보류: 프로세스로 만들지 않을 업무. 목록 끝으로 가고, 언제든 추천으로 되돌린다(Lite 와 같은 결정) -->
                        <v-tooltip :text="isHeld ? '추천으로 되돌리기' : '보류'" location="bottom">
                            <template v-slot:activator="{ props }">
                                <v-btn
                                    v-bind="props"
                                    icon
                                    variant="text"
                                    size="small"
                                    class="e2e-hold"
                                    :aria-label="isHeld ? '추천으로 되돌리기' : '보류'"
                                    :loading="holding"
                                    @click="toggleHold"
                                >
                                    <v-icon>{{ isHeld ? 'mdi-restore' : 'mdi-pause-circle-outline' }}</v-icon>
                                </v-btn>
                            </template>
                        </v-tooltip>
                    </div>

                    <div v-if="group" class="mining-flow">
                        <div class="mining-canvas">
                            <BpmnUengineViewer v-if="bpmnXml" :key="bpmnXml.length" :bpmn="bpmnXml" :disable-auto-orientation="true" />
                            <div v-else class="pa-6 text-caption text-medium-emphasis e2e-discover-empty">
                                도출된 프로세스가 없습니다.
                                <div v-if="discoverError" class="mt-1">{{ discoverError }}</div>
                            </div>
                        </div>
                        <v-tooltip text="BPMN 크게 보기" location="left">
                            <template v-slot:activator="{ props }">
                                <v-btn
                                    v-bind="props"
                                    icon
                                    size="small"
                                    variant="tonal"
                                    class="mining-flow__zoom"
                                    aria-label="BPMN 크게 보기"
                                    :disabled="!bpmnXml"
                                    @click="bigFlow = true"
                                >
                                    <v-icon size="18">mdi-arrow-expand</v-icon>
                                </v-btn>
                            </template>
                        </v-tooltip>
                    </div>

                    <!-- 단계 근거: 흐름 순서 · 건수 · 필수(채움)/옵션(테두리) · 관리자 확정(자물쇠) · 미리보기(점선) -->
                    <div v-if="group" class="mining-steps e2e-steps">
                        <v-tooltip v-for="s in steps" :key="s.name" :text="s.tip" location="top">
                            <template v-slot:activator="{ props }">
                                <button
                                    v-bind="props"
                                    type="button"
                                    class="mining-step e2e-step"
                                    :class="[`is-${s.look}`, { 'is-on': pickedStep === s.name }]"
                                    :data-step="s.name"
                                    :data-kind="s.kind"
                                    :data-when="s.when"
                                    :aria-pressed="pickedStep === s.name ? 'true' : 'false'"
                                    @click="pickStep(s.name)"
                                >
                                    <v-icon v-if="s.locked" size="12">mdi-lock</v-icon>
                                    <v-icon v-if="s.open" size="12" color="warning" class="e2e-step-open">mdi-help-circle-outline</v-icon>
                                    <v-icon v-else-if="s.kind === 'choice'" size="12">mdi-call-split</v-icon>
                                    <span>{{ s.name }}</span>
                                    <span class="mining-step__n">{{ s.count }}/{{ group.case_count }}</span>
                                </button>
                            </template>
                        </v-tooltip>
                    </div>

                    <!-- 근거 건 -->
                    <div class="mining-evidence">
                        <div class="d-flex align-center ga-1 mb-2" role="tablist" aria-label="근거 건">
                            <template v-if="group">
                                <button
                                    type="button"
                                    role="tab"
                                    class="mining-tab e2e-tab-in"
                                    :class="{ 'is-on': tab === 'in' }"
                                    :aria-selected="tab === 'in'"
                                    @click="tab = 'in'"
                                >
                                    업무에 든 건 {{ group.cases.length }}
                                </button>
                                <button
                                    type="button"
                                    role="tab"
                                    class="mining-tab e2e-tab-new"
                                    :class="{ 'is-on': tab === 'new' }"
                                    :aria-selected="tab === 'new'"
                                    @click="tab = 'new'"
                                >
                                    새로 들어온 건 {{ newIds.length }}
                                </button>
                            </template>
                            <span v-else class="text-body-2 font-weight-medium"
                                >어느 업무인지 정하지 못한 건 {{ store.unclassified.length }}</span
                            >
                            <v-spacer />
                            <span v-if="pickedStep" class="text-caption text-primary">'{{ pickedStep }}' 을 거친 건</span>
                        </div>
                        <div class="mining-evidence__list">
                            <div
                                v-for="r in rows"
                                :key="r.id"
                                class="mining-row e2e-thread"
                                :class="{ 'is-hit': r.hit, 'is-dim': r.dim, 'is-new': r.waiting }"
                                :data-room-id="r.id"
                                :data-category="r.category"
                            >
                                <div class="mining-row__main">
                                    <div class="mining-row__title">
                                        {{ r.title }}
                                        <v-tooltip v-if="r.waiting" text="새로 들어온 건 — 관리자가 받아들이기 전" location="top">
                                            <template v-slot:activator="{ props }">
                                                <v-icon v-bind="props" size="14" color="warning" class="ml-1 e2e-thread-proposal"
                                                    >mdi-plus-circle-outline</v-icon
                                                >
                                            </template>
                                        </v-tooltip>
                                        <v-tooltip v-if="r.reason" :text="r.reason" location="top">
                                            <template v-slot:activator="{ props }">
                                                <v-icon v-bind="props" size="14" class="ml-1 text-medium-emphasis e2e-thread-unclassified"
                                                    >mdi-help-circle-outline</v-icon
                                                >
                                            </template>
                                        </v-tooltip>
                                    </div>
                                    <div class="mining-row__trace">{{ r.trace }}</div>
                                </div>
                                <span v-if="r.category && isUnclassified" class="text-caption text-medium-emphasis">{{ r.category }}</span>
                                <span class="text-caption text-medium-emphasis mining-row__at">{{ r.at }}</span>
                                <template v-if="r.waiting">
                                    <v-tooltip text="이 업무에 넣기" location="top">
                                        <template v-slot:activator="{ props }">
                                            <v-btn
                                                v-bind="props"
                                                icon
                                                size="small"
                                                variant="tonal"
                                                color="primary"
                                                class="e2e-accept-case"
                                                aria-label="이 업무에 넣기"
                                                :loading="applying"
                                                @click="decideCase(r.id, true)"
                                            >
                                                <v-icon size="16">mdi-check</v-icon>
                                            </v-btn>
                                        </template>
                                    </v-tooltip>
                                    <v-tooltip text="이 업무가 아님" location="top">
                                        <template v-slot:activator="{ props }">
                                            <v-btn
                                                v-bind="props"
                                                icon
                                                size="small"
                                                variant="text"
                                                class="e2e-reject-case"
                                                aria-label="이 업무가 아님"
                                                :loading="applying"
                                                @click="decideCase(r.id, false)"
                                            >
                                                <v-icon size="16">mdi-close</v-icon>
                                            </v-btn>
                                        </template>
                                    </v-tooltip>
                                </template>
                                <v-tooltip text="대화방 열기 (새 탭)" location="top">
                                    <template v-slot:activator="{ props }">
                                        <v-btn
                                            v-bind="props"
                                            icon
                                            size="small"
                                            variant="text"
                                            :href="`/chat?roomId=${r.id}`"
                                            target="_blank"
                                            aria-label="대화방 열기"
                                        >
                                            <v-icon size="16">mdi-open-in-new</v-icon>
                                        </v-btn>
                                    </template>
                                </v-tooltip>
                            </div>
                            <div v-if="!rows.length" class="pa-4 text-caption text-medium-emphasis">—</div>
                        </div>
                    </div>
                </section>

                <!-- 오른쪽: 관리자 대화 — 늘 보인다. 바뀔 내용은 단계에 미리 보이고, 적용해야 저장된다 -->
                <aside class="mining-pane mining-pane--talk e2e-talk" aria-label="관리자 대화">
                    <div class="mining-pane__head">
                        <v-icon size="18" class="mr-2">mdi-message-text-outline</v-icon>
                        <h2 class="text-subtitle-2 font-weight-semibold">관리자 대화</h2>
                    </div>
                    <div ref="talkList" class="mining-talk">
                        <div v-if="!talk.length" class="text-caption text-medium-emphasis pa-2">
                            어떤 단계를 모든 건이 거치는지, 어떤 경우에만 거치는지, 어떤 건을 옮길지 말해 주세요.
                        </div>
                        <div
                            v-for="(m, i) in talk"
                            :key="m.id || i"
                            class="mining-talk__msg e2e-talk-msg"
                            :class="m.role === 'admin' ? 'is-admin' : 'is-assistant'"
                            :data-role="m.role"
                        >
                            <div class="mining-talk__text">{{ m.text }}</div>
                            <div v-if="m.change && m.lines && m.lines.length" class="mining-talk__change e2e-talk-change">
                                <div v-for="(l, j) in m.lines" :key="j" class="text-caption">· {{ l }}</div>
                                <div class="d-flex justify-end ga-1 mt-1">
                                    <v-icon v-if="m.applied" size="16" color="success" class="e2e-talk-applied">mdi-check-circle</v-icon>
                                    <span v-else-if="i !== lastChangeIndex" class="text-caption text-medium-emphasis e2e-talk-skipped"
                                        >적용하지 않음</span
                                    >
                                    <v-tooltip v-else text="적용" location="top">
                                        <template v-slot:activator="{ props }">
                                            <v-btn
                                                v-bind="props"
                                                icon
                                                size="x-small"
                                                variant="flat"
                                                color="primary"
                                                class="e2e-talk-apply"
                                                aria-label="적용"
                                                :loading="applying"
                                                @click="applyTalk(m)"
                                            >
                                                <v-icon size="16">mdi-check</v-icon>
                                            </v-btn>
                                        </template>
                                    </v-tooltip>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="mining-talk__input">
                        <v-text-field
                            v-model="talkInput"
                            density="compact"
                            variant="outlined"
                            hide-details
                            class="e2e-talk-input"
                            placeholder="이 업무에 대해 말하기"
                            aria-label="관리자 대화 입력"
                            :disabled="talking"
                            :loading="talking"
                            append-inner-icon="mdi-send"
                            @click:append-inner="sendTalk"
                            @keydown.enter.prevent="sendTalk"
                        />
                    </div>
                </aside>
            </div>
        </div>

        <!-- BPMN 크게 보기 -->
        <v-dialog v-model="bigFlow" max-width="1200">
            <v-card class="pa-2">
                <div class="d-flex align-center px-2">
                    <span class="text-subtitle-1 font-weight-bold">{{ title }}</span>
                    <v-spacer />
                    <v-btn icon variant="text" size="small" aria-label="닫기" @click="bigFlow = false"><v-icon>mdi-close</v-icon></v-btn>
                </div>
                <div style="height: 70vh">
                    <BpmnUengineViewer v-if="bigFlow && bpmnXml" :bpmn="bpmnXml" :disable-auto-orientation="true" />
                </div>
            </v-card>
        </v-dialog>

        <!-- 새 프로세스로 제안: 담당자(소유자)를 정한다. 병합함은 소유자를 검토자로 본다 -->
        <v-dialog v-model="proposeDialog" max-width="520">
            <v-card class="pa-4 e2e-propose-dialog">
                <div class="text-subtitle-1 font-weight-bold mb-1">새 프로세스로 제안</div>
                <div class="text-caption text-medium-emphasis mb-4">
                    담당자가 병합함에서 검토하고 승인하면 실제 프로세스로 저장됩니다. 본인을 지정해도 됩니다.
                </div>
                <v-alert v-if="proposals.length" type="info" variant="tonal" density="compact" class="mb-3 e2e-proposal-row">
                    이미 낸 제안 {{ proposals.length }}건 · 최근 {{ proposals[0].status }} · {{ formatDate(proposals[0].created_at) }}
                </v-alert>
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
                <v-alert v-if="prResult" type="success" variant="tonal" density="compact" class="mb-2 e2e-pr-result">{{
                    prResult.title
                }}</v-alert>
                <div class="d-flex justify-end">
                    <v-btn variant="text" @click="proposeDialog = false">닫기</v-btn>
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
 * 프로세스 식별 상세 (identification-list-detail, 2026-11-12).
 * 업무 하나의 진행 단계 · 흐름(BPMN) · 단계 근거 · 근거 건 · 관리자 대화를 한 화면에 둔다.
 * 묶음은 목록과 같은 useIdentification 에서 받는다. 정의 JSON → BPMN 은 BPMNXmlGenerator 를 그대로 쓴다.
 */
import BPMNXmlGenerator from '@/components/BPMNXmlGenerator.vue';
import BpmnUengineViewer from '@/components/BpmnUengineViewer.vue';
import { processMiner } from '@/utils/processMiner';
import * as Decisions from '@/utils/identificationDecisions';
import * as Ident from '@/views/mining/useIdentification';
import { withSupplements } from '@/utils/identifiedSupplements';
import BackendFactory from '@/components/api/BackendFactory';

const backend = BackendFactory.createBackend();

export default {
    name: 'HandoverMiningDetail',
    mixins: [BPMNXmlGenerator],
    components: { BpmnUengineViewer },
    data() {
        return {
            store: Ident.state,
            discovered: null,
            discoverError: '',
            bpmnXml: '',
            bigFlow: false,
            tab: 'in',
            pickedStep: null,
            organization: null,
            // 관리자 대화
            talk: [],
            talkInput: '',
            talking: false,
            applying: false,
            holding: false,
            asking: false,
            // 제안 · 실행 전환
            proposing: false,
            converting: false,
            prResult: null,
            proposals: [],
            proposeDialog: false,
            proposeTitle: '',
            proposeOwnerId: null,
            proposeError: '',
            people: [],
            error: ''
        };
    },
    computed: {
        key() {
            return String(this.$route.params.key || '');
        },
        // 실행 전환이 정의에 남기는 업무 키(예전 이름)
        selectedKey() {
            return this.key;
        },
        isUnclassified() {
            return this.key === Ident.UNCLASSIFIED;
        },
        group() {
            return this.store.groups.find((g) => g.process_key === this.key) || null;
        },
        title() {
            if (this.isUnclassified) return '확인 필요';
            return this.group?.name || '';
        },
        newIds() {
            return this.group?.new_case_ids || [];
        },
        stages() {
            return ['found', 'proposed', 'registered'].map((k) => ({
                key: k,
                label: k === 'registered' ? '정식' : Ident.STATUS_LABEL[k]
            }));
        },
        stageIndex() {
            if (!this.group) return -1;
            const st = Ident.statusOf(this.group);
            return st === 'held' ? 0 : ['found', 'proposed', 'registered'].indexOf(st);
        },
        isHeld() {
            return !!this.group && Ident.statusOf(this.group) === 'held';
        },
        decision() {
            return Ident.decisionOf(this.key);
        },
        /** 바뀔 내용이 있는 가장 최근 답 — 이 답만 적용하거나 미리 볼 수 있다. 그 전의 적용하지 않은 답은 지나간 제안이다 */
        lastChangeIndex() {
            for (let i = this.talk.length - 1; i >= 0; i--)
                if (this.talk[i].role === 'assistant' && this.talk[i].change && (this.talk[i].lines || []).length) return i;
            return -1;
        },
        /** 적용하지 않은 최근 change — 단계에 미리 보인다 */
        pendingChange() {
            const m = this.talk[this.lastChangeIndex];
            return m && !m.applied ? m.change : null;
        },
        traces() {
            const out = {};
            for (const t of this.store.threads) out[t.origin_room_id] = Ident.traceOf(t);
            return out;
        },
        performers() {
            const out = {};
            for (const e of this.organization?.eligibility || []) out[e.activity] = (e.candidates || []).slice(0, 3).map((c) => c.name);
            return out;
        },
        /** 정의가 말하는 단계 진행 방식(규칙 반영 뒤) */
        shapeOf() {
            const out = {};
            for (const x of this.discovered?.steps || []) out[x.step] = x;
            return out;
        },
        /** 조건이 정해지지 않은 분기 */
        openSplits() {
            return this.discovered?.undecided || [];
        },
        openSplitsTip() {
            const need = { skip: '언제 건너뛰는지', when: '언제 이 갈래로 가는지', redo: '언제 다시 하는지' };
            return `정할 분기 조건 ${this.openSplits.length}개 — ${this.openSplits.map((u) => `${u.step}: ${need[u.need]}`).join(', ')}`;
        },
        steps() {
            const g = this.group;
            if (!g) return [];
            const confirmed = this.decision?.confirmed_steps || [];
            const preview = {};
            for (const s of this.pendingChange?.steps || []) preview[s.step] = s;
            const open = new Set(this.openSplits.map((u) => u.step));
            const KIND = { required: '필수', optional: '옵션', choice: '택일' };
            return Ident.stepOrder(g).map((name) => {
                const count = g.cases.filter((c) => (this.traces[c] || []).includes(name)).length;
                const sh = this.shapeOf[name];
                // 정의에 없으면(아직 도출 전) 묶음의 필수 단계로 본다
                const kind = sh?.kind || ((g.core_activities || []).includes(name) ? 'required' : 'optional');
                const required = kind === 'required';
                const locked = confirmed.includes(name) || !!sh?.by;
                const pv = preview[name];
                const look = pv ? 'preview' : kind;
                const who = (this.performers[name] || []).join(', ');
                const when = kind === 'optional' ? sh?.skip_when || '' : kind === 'choice' ? sh?.when || '' : '';
                const cond =
                    kind === 'optional'
                        ? when
                            ? `${when} 건너뜀`
                            : '언제 건너뛰는지 정해야 함'
                        : kind === 'choice'
                        ? when
                            ? `${when} 이 갈래`
                            : '언제 이 갈래로 가는지 정해야 함'
                        : '';
                const redo = sh?.redo_when ? ` · ${sh.redo_when} 다시 함` : '';
                const by = sh?.by === 'cases' ? `사례로 정함(${sh.matched}/${sh.total}건)` : locked ? '관리자 확정' : '건수로 본 초안';
                const tip = pv
                    ? `미리보기 — 적용하면 ${KIND[pv.kind] || '반복'}${pv.when ? ` · ${pv.when}` : ''}`
                    : `${KIND[kind]}${cond ? ` · ${cond}` : ''}${redo} · ${by} · ${count}/${g.case_count}건${who ? ` · 수행: ${who}` : ''}`;
                return { name, count, kind, required, locked, look, tip, when, open: open.has(name) };
            });
        },
        rows() {
            const reasons = {
                no_category: '업무 범주를 정하지 못했습니다',
                no_core_step: '그 업무의 필수 단계를 하나도 거치지 않았습니다'
            };
            let ids;
            let waiting = false;
            if (this.isUnclassified) ids = this.store.unclassified.map((u) => u.case_id);
            else if (this.tab === 'new') {
                ids = this.newIds;
                waiting = true;
            } else ids = this.group?.cases || [];
            const why = {};
            for (const u of this.store.unclassified) why[u.case_id] = reasons[u.reason] || '';
            return [...ids]
                .sort((a, b) => Ident.lastAt(b).localeCompare(Ident.lastAt(a)))
                .map((id) => {
                    const tr = this.traces[id] || [];
                    const hit = !!this.pickedStep && tr.includes(this.pickedStep);
                    return {
                        id,
                        title: Ident.caseLabel(id),
                        trace: tr.join(' → '),
                        at: Ident.shortDate(Ident.lastAt(id)),
                        category: this.store.caseCategories[id]?.category || '',
                        reason: this.isUnclassified ? why[id] : '',
                        waiting,
                        hit,
                        dim: !!this.pickedStep && !hit
                    };
                });
        }
    },
    watch: {
        key() {
            this.enter();
        }
    },
    async created() {
        await this.enter();
    },
    mounted() {
        this.stopRefresh = Ident.watchRefresh();
    },
    beforeUnmount() {
        if (this.stopRefresh) this.stopRefresh();
    },
    methods: {
        async enter() {
            this.tab = 'in';
            this.pickedStep = null;
            this.talk = [];
            await Ident.ensureLoaded();
            await this.loadDiscovered();
            await this.loadTalkRows();
            this.askConditions();
            if (!this.organization) this.organization = await processMiner.organization(Ident.tenantId()).catch(() => null);
        },
        pickStep(name) {
            this.pickedStep = this.pickedStep === name ? null : name;
        },
        selectOwnerText(e) {
            const el = e?.target;
            if (el && typeof el.select === 'function') requestAnimationFrame(() => el.select());
        },
        /** 이 업무의 프로세스를 도출한다. 그 업무의 확인된 건으로만 그린다. */
        async loadDiscovered() {
            this.discoverError = '';
            this.prResult = null;
            if (!this.group) {
                this.discovered = null;
                this.bpmnXml = '';
                return;
            }
            const rules = this.decision?.step_rules || {};
            const dc = await processMiner
                .discovered(Ident.tenantId(), this.key, Ident.categoriesForMiner(), Ident.decided(), undefined, undefined, rules)
                .catch((e) => {
                    this.discoverError = e?.message || String(e);
                    return null;
                });
            this.discovered = dc;
            this.bpmnXml = dc ? this.markMultiInstance(this.toBpmn(dc.definition), dc) : '';
            this.proposals = [];
            if (dc) await this.loadProposals(dc.definition?.processDefinitionId);
        },
        /** 정의를 한 줄로: '접수 → [예산 검토 | 건너뜀] → 발주' */
        flowLine(items) {
            const one = (it) =>
                it.step
                    ? it.step
                    : `[${(it.branches || [])
                          .map((b) => (b.items.length ? this.flowLine(b.items) : '건너뜀'))
                          .join(it.parallel ? ' + ' : ' | ')}]`;
            return (items || []).map(one).join(' → ');
        },
        /** 사례 → 처음 요청. 범주를 판단할 때 저장한 요청을 먼저 쓴다(이번 세션에 판단한 건만 store.requests 에 있다) */
        requestsOf(ids) {
            const out = {};
            for (const id of ids || []) {
                const r = this.store.caseCategories[id]?.request || this.store.requests[id] || '';
                if (r) out[id] = r;
            }
            return out;
        },
        /** 대화에 남은 사례 초안(가장 최근 것) */
        draftFor(step) {
            for (let i = this.talk.length - 1; i >= 0; i--) {
                const d = (this.talk[i].change?.drafts || []).find((x) => x.step === step);
                if (d) return d.text;
            }
            return '';
        },
        // ---------- 관리자 대화 ----------
        withLines(m) {
            const names = {};
            for (const g of this.store.groups) names[g.process_key] = g.name;
            const g = this.group || { process_key: Ident.UNCLASSIFIED, name: '확인 필요', new_case_ids: [] };
            return { ...m, lines: m.change ? Decisions.describeChange(m.change, g, names, Ident.caseLabel) : [] };
        },
        scrollTalk() {
            this.$nextTick(() => {
                const el = this.$refs.talkList;
                if (el) el.scrollTop = el.scrollHeight;
            });
        },
        async loadTalkRows() {
            if (!this.group && !this.isUnclassified) return;
            const rows = await Decisions.loadTalk(this.key).catch(() => []);
            this.talk = rows.map((m) => this.withLines(m));
            this.scrollTalk();
        },
        /** 마이너에 넘길 사실 — 저장된 값으로만 만든다. 숫자는 여기서만 나온다. */
        talkFacts() {
            const asCase = (id) => ({
                id,
                label: Ident.caseLabel(id),
                trace: this.traces[id] || [],
                category: this.store.caseCategories[id]?.category || ''
            });
            const g = this.group;
            return {
                group: g
                    ? {
                          key: g.process_key,
                          name: g.name,
                          category: g.category,
                          status: Ident.statusOf(g),
                          steps: g.activities,
                          core: g.core_activities,
                          optional: g.optional_activities,
                          confirmed_steps: this.decision?.confirmed_steps || [],
                          // 지금 정의가 말하는 것: 순서와 갈래([A | B] 는 택일), 단계마다 필수·옵션·택일과 조건
                          definition_flow: this.flowLine(this.discovered?.flow || []),
                          step_kinds: (this.discovered?.steps || []).map((x) => ({
                              step: x.step,
                              kind: x.kind,
                              ...(x.skip_when ? { skipped_when: x.skip_when } : {}),
                              ...(x.when ? { taken_when: x.when } : {}),
                              ...(x.redo_when ? { done_again_when: x.redo_when } : {}),
                              set_by: x.by === 'cases' ? 'cases' : x.by === 'admin' ? 'admin' : 'draft'
                          })),
                          to_decide: this.openSplits.map((u) => ({
                              step: u.step,
                              need: u.need,
                              draft: this.draftFor(u.step),
                              ...(u.alternatives?.length ? { instead_of: u.alternatives } : {})
                          })),
                          case_count: g.case_count,
                          variants: g.variants,
                          cases: g.cases.map(asCase),
                          proposal: g.new_case_ids?.length ? { case_count: g.new_case_ids.length, cases: g.new_case_ids.map(asCase) } : null
                      }
                    : { key: Ident.UNCLASSIFIED, name: '확인 필요', steps: [], cases: [], proposal: null },
                others: this.store.groups
                    .filter((o) => o.process_key !== this.key)
                    .map((o) => ({ key: o.process_key, name: o.name, category: o.category })),
                unclassified: this.store.unclassified.map((u) => asCase(u.case_id))
            };
        },
        async sendTalk() {
            const text = (this.talkInput || '').trim();
            if (!text || this.talking) return;
            this.talking = true;
            try {
                this.talk.push(this.withLines(await Decisions.addTalk({ process_key: this.key, role: 'admin', text })));
                this.talkInput = '';
                this.scrollTalk();
                const r = await processMiner.feedback(Ident.tenantId(), text, this.talkFacts());
                const reply = r.reply || (r.change ? '이렇게 바꿀까요?' : '');
                const row = await Decisions.addTalk({ process_key: this.key, role: 'assistant', text: reply, change: r.change || null });
                this.talk.push(this.withLines(row));
            } catch (e) {
                this.talk.push({ role: 'assistant', text: e?.message || String(e), lines: [] });
            } finally {
                this.talking = false;
                this.scrollTalk();
            }
        },
        /** 결정을 저장하고 그 업무만 다시 받는다(화면 전체를 다시 불러오지 않는다). */
        async saveAndRefresh(change) {
            const g = this.group || {
                process_key: Ident.UNCLASSIFIED,
                name: '확인 필요',
                category: '',
                core_activities: [],
                cases: [],
                new_case_ids: []
            };
            await Decisions.applyChange(change, g, this.store.decisions, this.store.requests);
            if ((change.moves || []).some((m) => m.category || m.to)) this.store.caseCategories = await Decisions.loadCategories();
            await Ident.reloadGroups();
            await this.loadDiscovered();
            this.askConditions();
        },
        /**
         * 조건이 정해지지 않은 분기가 있으면, 사례(요청·분기 앞 단계 지시사항)에서 조건을 찾아 대화로 보여 준다.
         * 모든 사례를 실제 간 흐름대로 가른 조건만 적용할 수 있는 결정으로 보이고(관리자가 적용해야 저장),
         * 초안·근거 없는 분기는 관리자에게 묻는다. 같은 분기 묶음에는 한 번만 묻는다.
         */
        async askConditions() {
            const open = this.openSplits;
            if (!open.length || !this.group || this.asking) return;
            // 같은 분기·같은 건수면 한 번만 묻는다(건이 늘면 근거가 달라지므로 다시 찾는다)
            const sig = `${this.group.case_count}#${open
                .map((u) => `${u.step}:${u.need}`)
                .sort()
                .join('|')}`;
            if (this.talk.some((m) => m.role === 'assistant' && m.change?.ask === sig)) return;
            this.asking = true;
            try {
                let found = {};
                try {
                    const r = await processMiner.conditions(
                        Ident.tenantId(),
                        this.key,
                        Ident.categoriesForMiner(),
                        Ident.decided(),
                        this.decision?.step_rules || {},
                        this.requestsOf(this.group.cases)
                    );
                    found = r.found || {};
                } catch (e) {
                    console.warn('[mining] 조건 찾기 실패:', e);
                }
                const { change, drafts } = Decisions.changeFromFound(found);
                const decided = new Set((change?.steps || []).map((x) => x.step));
                const lines = [];
                if (change) lines.push('사례에서 분기 조건을 찾았어요. 모든 건이 실제 간 흐름과 맞아요. 맞으면 적용해 주세요.');
                for (const d of drafts)
                    lines.push(
                        `'${d.step}': 사례에서 찾은 "${d.text}" 는 ${d.total}건 중 ${d.matched}건만 맞아요. 이 조건으로 할지, 다른 조건인지 말해 주세요.`
                    );
                const drafted = new Set(drafts.map((d) => d.step));
                for (const u of open) {
                    if (decided.has(u.step) || drafted.has(u.step)) continue;
                    if (u.need === 'skip')
                        lines.push(`'${u.step}' 단계는 어떤 경우에 건너뛰나요? 모든 건이 거쳐야 하면 필수라고 말해 주세요.`);
                    else if (u.need === 'when') lines.push(`'${u.step}' 갈래로는 어떤 경우에 가나요?`);
                    else lines.push(`'${u.step}' 단계는 어떤 경우에 다시 하나요?`);
                }
                const row = await Decisions.addTalk({
                    process_key: this.key,
                    role: 'assistant',
                    text: lines.join('\n'),
                    change: { ...(change || {}), ask: sig, ...(drafts.length ? { drafts } : {}) }
                });
                this.talk.push(this.withLines(row));
                this.scrollTalk();
            } catch (e) {
                console.warn('[mining] 조건 묻기 실패:', e);
            } finally {
                this.asking = false;
            }
        },
        async applyTalk(m) {
            if (!m?.change) return;
            this.applying = true;
            try {
                await this.saveAndRefresh(m.change);
                if (m.id) await Decisions.markApplied(m.id);
                m.applied = true;
                this.talk = this.talk.map((x) => this.withLines(x));
            } catch (e) {
                this.discoverError = e?.message || String(e);
            } finally {
                this.applying = false;
            }
        },
        /** 보류 ↔ 추천. 저장하고 그 업무 상태만 다시 받는다 */
        async toggleHold() {
            if (!this.group) return;
            this.holding = true;
            try {
                await Decisions.setHold(this.group, this.store.decisions, !this.isHeld);
                await Ident.reloadGroups();
            } catch (e) {
                this.discoverError = e?.message || String(e);
            } finally {
                this.holding = false;
            }
        },
        /** 새로 들어온 건을 바로 넣거나 뺀다 — 대화의 change 와 같은 저장 */
        async decideCase(id, accept) {
            this.applying = true;
            try {
                await this.saveAndRefresh({ moves: [{ case_id: id, to: accept ? this.key : 'out' }] });
                if (!this.newIds.length) this.tab = 'in';
            } catch (e) {
                this.discoverError = e?.message || String(e);
            } finally {
                this.applying = false;
            }
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

                // 이 업무에서 실행 전환을 시작했다는 기록 — 그 방에서 저장한 정의를 이 업무의 정식 프로세스로 잇는다.
                // 방 context 의 identification 만으로 이으면, 방 context 를 다른 곳에서 덮어쓸 때 연결이 끊긴다.
                await Decisions.addTalk({
                    process_key: this.key,
                    role: 'assistant',
                    text: '실행 가능한 프로세스로 전환을 시작했어요. 전환 대화방에서 저장하면 이 업무가 정식 등록으로 바뀝니다.',
                    change: { conversion_room: roomId }
                }).catch((e) => console.warn('[mining] 전환 기록 실패:', e));

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
         * 단계마다 붙일 진행 방식 { 활동명: 표시 } — 관리자·사례가 정한 규칙을 반영한 정의가 말하는 것(miner steps).
         */
        conditionalActivityTags() {
            const out = {};
            for (const x of this.discovered?.steps || []) {
                const parts = [];
                if (x.kind === 'optional') parts.push(`${x.skip_when} 건너뜀`);
                if (x.kind === 'choice') parts.push(`${x.when} 이 갈래`);
                if (x.redo_when) parts.push(`${x.redo_when} 다시 함`);
                if (parts.length) out[x.step] = parts.join(' · ');
            }
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
                // 이미 정식 정의가 있으면(실행 전환·병합) 폼·입출력 같은 보강은 이어받고 흐름만 식별 결과로 바꾼다
                const mined = this.discovered?.definition || {};
                const { data: cur } = await window.$supabase
                    .from('proc_def')
                    .select('definition')
                    .eq('id', mined.processDefinitionId)
                    .maybeSingle();
                const d = withSupplements(mined, cur?.definition);
                const xml = cur?.definition ? this.markMultiInstance(this.toBpmn(d), this.discovered) : this.bpmnXml;
                const r = await backend.proposeIdentifiedProcess({
                    procDefId: d.processDefinitionId,
                    name: d.processDefinitionName,
                    xml,
                    definition: d,
                    ownerId: this.proposeOwnerId,
                    title: this.proposeTitle,
                    description: this.proposalDescription()
                });
                this.prResult = r.pr || null;
                // 진행 단계가 '제안 중' 으로 바로 바뀌게 상태를 다시 받는다
                Ident.reloadGroups().catch(() => {});
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
/* 앱 레이아웃(헤더·사이드바)이 남겨 준 칸을 채우고, 페이지 자체는 내려가지 않는다 */
.mining-detail {
    height: calc(100vh - 132px);
    min-height: 560px;
    display: flex;
    flex-direction: column;
}
.mining-detail__body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    padding: 14px 16px 16px;
}
.mining-detail__grid {
    flex: 1;
    min-height: 0;
    display: flex;
    gap: 12px;
}
.mining-pane {
    min-height: 0;
    border: 1px solid rgba(var(--v-theme-on-surface), 0.1);
    border-radius: 12px;
    display: flex;
    flex-direction: column;
}
.mining-pane--main {
    flex: 1;
    min-width: 0;
}
.mining-pane--talk {
    width: 320px;
    flex-shrink: 0;
}
.mining-pane__head {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}
.mining-stepper {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    align-items: center;
    gap: 14px;
    font-size: 12px;
    color: rgba(var(--v-theme-on-surface), 0.6);
}
.mining-stepper li {
    display: flex;
    align-items: center;
    gap: 5px;
    white-space: nowrap;
}
.mining-stepper__dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    border: 1.5px solid currentColor;
    box-sizing: border-box;
}
.mining-stepper li.is-done {
    color: rgb(var(--v-theme-success));
    font-weight: 600;
}
.mining-held {
    font-size: 12px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 999px;
    background: rgba(var(--v-theme-on-surface), 0.08);
    color: rgba(var(--v-theme-on-surface), 0.75);
}
.mining-stepper li.is-done .mining-stepper__dot {
    background: currentColor;
}
.mining-flow {
    position: relative;
    padding: 4px 8px 0;
}
.mining-canvas {
    height: clamp(180px, 30vh, 300px);
    border-radius: 8px;
    overflow: hidden;
}
.mining-flow__zoom {
    position: absolute;
    left: 16px;
    bottom: 8px;
}
.mining-steps {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 10px 12px;
    border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}
.mining-step {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    min-height: 30px;
    padding: 0 11px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    border: 1px solid transparent;
}
.mining-step.is-required {
    background: rgb(var(--v-theme-primary));
    color: rgb(var(--v-theme-on-primary));
}
.mining-step.is-optional {
    background: rgb(var(--v-theme-surface));
    color: rgb(var(--v-theme-primary));
    border-color: rgba(var(--v-theme-primary), 0.5);
}
.mining-step.is-choice {
    background: rgb(var(--v-theme-surface));
    color: rgb(var(--v-theme-primary));
    border: 1.5px solid rgba(var(--v-theme-primary), 0.5);
}
.mining-open {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    font-size: 12px;
    font-weight: 700;
    color: rgb(var(--v-theme-warning));
    margin-right: 6px;
}
.mining-step.is-preview {
    background: rgba(var(--v-theme-warning), 0.1);
    color: rgb(var(--v-theme-warning));
    border: 1.5px dashed rgb(var(--v-theme-warning));
}
.mining-step.is-on {
    box-shadow: 0 0 0 3px rgba(var(--v-theme-warning), 0.55);
}
.mining-step__n {
    font-weight: 400;
    opacity: 0.85;
}
.mining-evidence {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    padding: 8px 12px 12px;
}
.mining-evidence__list {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
    border-radius: 8px;
}
.mining-tab {
    min-height: 30px;
    padding: 0 10px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 600;
    color: rgba(var(--v-theme-on-surface), 0.6);
}
.mining-tab.is-on {
    background: rgba(var(--v-theme-primary), 0.1);
    color: rgb(var(--v-theme-primary));
}
.mining-row {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 48px;
    padding: 4px 8px 4px 12px;
    border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.06);
}
.mining-row.is-hit {
    background: rgba(var(--v-theme-warning), 0.08);
}
.mining-row.is-dim {
    opacity: 0.45;
}
.mining-row.is-new {
    background: rgba(var(--v-theme-warning), 0.05);
}
.mining-row__main {
    flex: 1;
    min-width: 0;
}
.mining-row__title {
    display: flex;
    align-items: center;
    font-size: 13px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.mining-row__trace {
    font-size: 12px;
    color: rgba(var(--v-theme-on-surface), 0.6);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.mining-row__at {
    white-space: nowrap;
}
.mining-new-badge {
    font-size: 11px;
    font-weight: 700;
    color: rgb(var(--v-theme-warning));
    background: rgba(var(--v-theme-warning), 0.14);
    border-radius: 999px;
    padding: 1px 7px;
}
.mining-talk {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px 12px;
}
.mining-talk__msg {
    max-width: 90%;
    padding: 6px 10px;
    border-radius: 10px;
    font-size: 13px;
    white-space: pre-wrap;
}
.mining-talk__msg.is-admin {
    align-self: flex-end;
    background: rgba(var(--v-theme-primary), 0.1);
}
.mining-talk__msg.is-assistant {
    align-self: flex-start;
    background: rgba(var(--v-theme-on-surface), 0.05);
}
.mining-talk__change {
    margin-top: 4px;
    padding-top: 4px;
    border-top: 1px dashed rgba(var(--v-theme-on-surface), 0.15);
}
.mining-talk__input {
    padding: 8px 12px 12px;
    border-top: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}
</style>
