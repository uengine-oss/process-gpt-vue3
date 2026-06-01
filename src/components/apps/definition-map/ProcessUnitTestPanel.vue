<template>
    <div class="process-unit-test-panel">
        <div class="d-flex align-center justify-space-between mb-3" style="gap: 8px">
            <div class="text-subtitle-2 font-weight-medium flex-grow-1">
                {{ $t('ProcessUnitTest.allUnitTests') }}
                <span v-if="totalCaseCount > 0" class="text-caption text-medium-emphasis ml-1">
                    {{ $t('ProcessUnitTest.caseCountSummary', { count: totalCaseCount, workCount: groupedCases.length }) }}
                </span>
            </div>
            <v-chip v-if="runAllProgress.running" size="small" color="primary" variant="tonal">
                <v-icon start size="14">mdi-progress-clock</v-icon>
                {{ runAllProgress.current }} / {{ runAllProgress.total }}
            </v-chip>
            <v-btn v-if="runAllProgress.running" size="small" color="error" variant="text" @click="abortRunAll">
                {{ $t('ProcessUnitTest.abort') }}
            </v-btn>
            <v-btn v-else size="small" color="success" variant="tonal" prepend-icon="mdi-play-box-multiple"
                :disabled="totalCaseCount === 0 || runningCaseIds.size > 0" @click="runAll">
                {{ $t('ProcessUnitTest.runAll') }}
            </v-btn>
            <v-btn size="small" variant="text" icon="mdi-refresh" :loading="loading" @click="loadCases" />
        </div>

        <div v-if="loading" class="text-caption text-medium-emphasis py-4 text-center">{{ $t('ProcessUnitTest.loading') }}</div>
        <div v-else-if="groupedCases.length === 0" class="text-caption text-medium-emphasis py-6 text-center">
            {{ $t('ProcessUnitTest.panelEmptyTitle') }}<br />
            {{ $t('ProcessUnitTest.panelEmptyHint') }}
        </div>

        <div v-if="groupedCases.length > 0" class="mb-3">
            <v-select
                v-model="addCaseTargetActivityId"
                :items="userTaskOptions"
                :label="$t('ProcessUnitTest.selectTaskAddCase')"
                density="compact"
                variant="outlined"
                hide-details
                clearable
                @update:model-value="onAddCaseTargetSelected"
            />
        </div>
        <div v-else class="mb-3">
            <v-select
                v-model="addCaseTargetActivityId"
                :items="userTaskOptions"
                :label="$t('ProcessUnitTest.selectTaskFirstCase')"
                density="compact"
                variant="outlined"
                hide-details
                clearable
                @update:model-value="onAddCaseTargetSelected"
            />
        </div>

        <v-expansion-panels v-if="groupedCases.length > 0" v-model="expandedGroupIds" multiple variant="accordion" density="compact">
            <v-expansion-panel v-for="group in groupedCases" :key="group.activityId" :value="group.activityId">
                <v-expansion-panel-title>
                    <div class="d-flex align-center w-100" style="gap: 8px">
                        <v-avatar size="24" color="primary" variant="tonal" class="flex-shrink-0">
                            <v-icon size="14">mdi-clipboard-check-outline</v-icon>
                        </v-avatar>
                        <span class="text-truncate flex-grow-1 text-body-2 font-weight-medium">
                            {{ activityName(group.activityId) }}
                        </span>
                        <v-chip size="x-small" variant="tonal" color="primary">{{ group.cases.length }}</v-chip>
                        <v-chip v-if="groupSummary(group).pass" size="x-small" color="success" variant="tonal">
                            {{ $t('ProcessUnitTest.passCount', { count: groupSummary(group).pass }) }}
                        </v-chip>
                        <v-chip v-if="groupSummary(group).fail" size="x-small" color="error" variant="tonal">
                            {{ $t('ProcessUnitTest.failCount', { count: groupSummary(group).fail }) }}
                        </v-chip>
                        <!-- 접힌 상태에서만: 이 작업의 모든 케이스 실행 -->
                        <template v-if="!isGroupExpanded(group.activityId)">
                            <v-chip v-if="groupRunningId === group.activityId" size="x-small" color="primary" variant="tonal">
                                <v-icon start size="12">mdi-progress-clock</v-icon>
                                {{ groupRunProgress.current }}/{{ groupRunProgress.total }}
                            </v-chip>
                            <v-btn v-else size="x-small" variant="tonal" color="success" icon="mdi-play-box-multiple"
                                density="comfortable"
                                :disabled="runningCaseIds.size > 0 || group.cases.length === 0"
                                @click.stop="runGroup(group.activityId)" />
                        </template>
                    </div>
                </v-expansion-panel-title>
                <v-expansion-panel-text>
                    <div class="d-flex justify-end mb-2" style="gap: 4px">
                        <v-chip v-if="groupRunningId === group.activityId" size="small" color="primary" variant="tonal">
                            <v-icon start size="14">mdi-progress-clock</v-icon>
                            {{ groupRunProgress.current }} / {{ groupRunProgress.total }}
                        </v-chip>
                        <v-btn v-else size="x-small" variant="tonal" color="success" prepend-icon="mdi-play-box-multiple"
                            :disabled="runningCaseIds.size > 0 || group.cases.length === 0"
                            @click="runGroup(group.activityId)">
                            {{ $t('ProcessUnitTest.runAll') }}
                        </v-btn>
                        <v-btn size="x-small" variant="tonal" color="primary" prepend-icon="mdi-plus"
                            @click="openEditor(group.activityId, null)">
                            {{ $t('ProcessUnitTest.addCase') }}
                        </v-btn>
                    </div>
                    <div v-for="(testCase, idx) in group.cases" :key="testCase.id"
                        class="pa-2 mb-2 rounded-lg" :class="{ 'border': true }">
                        <div class="d-flex align-center" style="gap: 6px; cursor: pointer"
                            @click="toggleCaseExpand(testCase.id)">
                            <v-icon size="18">{{ expandedCaseIds[testCase.id] ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon>
                            <span class="text-caption font-weight-medium flex-grow-1 text-truncate">
                                {{ testCase.name || `Case ${idx + 1}` }}
                            </span>
                            <v-chip size="x-small" :color="statusColor(testCase.lastResult?.status)" variant="tonal">
                                {{ statusLabel(testCase) }}
                            </v-chip>
                            <!-- 접힌 상태에서만 빠른 액션 버튼 노출. 펼치면 본문 아래 액션 바로 이동. -->
                            <template v-if="!expandedCaseIds[testCase.id]">
                                <v-btn size="x-small" variant="tonal" color="success" icon="mdi-play"
                                    density="comfortable" :loading="runningCaseIds.has(testCase.id)"
                                    :disabled="runningCaseIds.size > 0" @click.stop="runCase(group.activityId, testCase)" />
                                <v-btn size="x-small" variant="text" icon="mdi-pencil" density="comfortable"
                                    @click.stop="openEditor(group.activityId, testCase)" />
                                <v-btn size="x-small" variant="text" color="error" icon="mdi-delete" density="comfortable"
                                    @click.stop="deleteCase(group.activityId, testCase)" />
                            </template>
                        </div>
                        <div v-if="expandedCaseIds[testCase.id]" class="mt-2">
                                <div class="text-caption text-medium-emphasis">
                                    <span v-if="hasEntries(testCase.when?.parameterValues)" class="mr-2">
                                        {{ $t('ProcessUnitTest.input') }}: {{ formatObject(testCase.when.parameterValues) }}
                                    </span>
                                    <span v-if="hasExpected(testCase.expected)">{{ $t('ProcessUnitTest.expected') }}: {{ formatExpected(testCase.expected) }}</span>
                                </div>
                                <div v-if="testCase.lastResult" class="text-caption mt-1">
                                    <div v-if="testCase.lastResult.actual" class="text-medium-emphasis">
                                        {{ $t('ProcessUnitTest.actual') }}: {{ formatExpected(testCase.lastResult.actual) }}
                                    </div>
                                    <ul v-if="testCase.lastResult.mismatches && testCase.lastResult.mismatches.length"
                                        class="pl-4 mb-0">
                                        <li v-for="(msg, mi) in testCase.lastResult.mismatches" :key="mi" class="text-error">
                                            {{ msg }}
                                        </li>
                                    </ul>
                                    <div v-if="testCase.lastResult.message" class="text-error">
                                        {{ testCase.lastResult.message }}
                                    </div>
                                    <div v-if="testCase.lastResult.ranAt" class="text-medium-emphasis">
                                        {{ formatRanAt(testCase.lastResult.ranAt) }}
                                    </div>
                                </div>
                                <div class="d-flex justify-end mt-2" style="gap: 4px">
                                    <v-btn size="x-small" variant="tonal" color="success" prepend-icon="mdi-play"
                                        :loading="runningCaseIds.has(testCase.id)"
                                        :disabled="runningCaseIds.size > 0"
                                        @click="runCase(group.activityId, testCase)">{{ $t('ProcessUnitTest.run') }}</v-btn>
                                    <v-btn size="x-small" variant="text" icon="mdi-pencil"
                                        @click="openEditor(group.activityId, testCase)" />
                                    <v-btn size="x-small" variant="text" color="error" icon="mdi-delete"
                                        @click="deleteCase(group.activityId, testCase)" />
                                </div>
                            </div>
                    </div>
                </v-expansion-panel-text>
            </v-expansion-panel>
        </v-expansion-panels>

        <v-alert type="info" variant="tonal" density="compact" class="mt-3">
            {{ $t('ProcessUnitTest.panelInfoAlert') }}
        </v-alert>

        <UnitTestCaseEditor
            v-model="editorOpen"
            :case-object="editingCase"
            :given-forms="editorGivenForms"
            :current-form="editorCurrentForm"
            :given-options="editorGivenOptions"
            :task-parameter-options="editorTaskParameterOptions"
            :user-task-options="userTaskOptions"
            :all-activity-options="allActivityOptions"
            @save="onCaseSaved"
        />
    </div>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
import { useBpmnStore } from '@/stores/bpmn';
import UnitTestCaseEditor from '@/components/designer/bpmnModeling/bpmn/panel/UnitTestCaseEditor.vue';

// BPMN 2.0 XSD 는 lowercase 시작 (userTask). bpmn.io 가 'UserTask' 로 쓰는 경우도 있어 모두 허용.

export default {
    name: 'ProcessUnitTestPanel',
    components: { UnitTestCaseEditor },
    props: {
        definitionId: { type: String, required: true },
        bpmn: { type: [String, Object], default: null },
        // BpmnUengineViewer 컴포넌트 ref. activityName 해석에 사용한다.
        bpmnViewerComponent: { type: Object, default: null },
        // 옵션. 있으면 backend.getPreviousForms 호출 시 사용.
        processDefinition: { type: Object, default: null }
    },
    data() {
        return {
            backend: null,
            loading: false,
            // { activityId: [cases...] } — UserTaskUnitTest.vue 와 동일한 저장 포맷.
            allCases: {},
            // 폼 필드 메타맵: fieldKey → { label, valueLabels }. 화면 표시(키→이름)에만 쓴다.
            fieldMeta: {},
            runningCaseIds: new Set(),
            runAllProgress: { running: false, total: 0, current: 0, abort: false },
            // best-effort cleanup 을 위한 인플라이트 인스턴스 id 추적.
            _inflightProcInstIds: new Set(),
            // 에디터 상태.
            editorOpen: false,
            editingCase: null,
            editorActivityId: null,
            editorGivenForms: [],
            editorCurrentForm: null,
            editorGivenOptions: [],
            editorTaskParameterOptions: [],
            // 작업 선택 드롭다운(케이스 추가 진입점)
            addCaseTargetActivityId: null,
            // 케이스별 펼침 상태 — 기본 접힘.
            expandedCaseIds: {},
            // v-expansion-panels v-model — 펼쳐진 그룹(activityId) 배열.
            expandedGroupIds: [],
            // 그룹 단위 전체 실행 추적. 동시에 한 그룹만 가능.
            groupRunningId: null,
            groupRunProgress: { current: 0, total: 0 }
        };
    },
    computed: {
        groupedCases() {
            return Object.entries(this.allCases || {})
                .filter(([, cases]) => Array.isArray(cases) && cases.length > 0)
                .map(([activityId, cases]) => ({ activityId, cases }));
        },
        totalCaseCount() {
            return this.groupedCases.reduce((sum, g) => sum + g.cases.length, 0);
        },
        // BPMN XML 에서 id → name 맵을 한 번 파싱해 둔다. viewer ref 는 reactive 가 아니라 못 잡힐 수 있음.
        activityNameMap() {
            const map = {};
            const xml = typeof this.bpmn === 'string' ? this.bpmn : null;
            if (!xml) return map;
            try {
                const doc = new DOMParser().parseFromString(xml, 'text/xml');
                // 모든 BPMN flow 노드 (UserTask, Gateway, Event 등) — id/name 속성을 가진 것 전부.
                const walk = (el) => {
                    if (!el) return;
                    const id = el.getAttribute && el.getAttribute('id');
                    const name = el.getAttribute && el.getAttribute('name');
                    if (id && name) map[id] = name;
                    for (let i = 0; i < el.children.length; i++) walk(el.children[i]);
                };
                walk(doc.documentElement);
            } catch (e) { /* ignore */ }
            return map;
        },
        // BPMN XML 에서 flow 노드를 분류해서 { id, name, tag } 로. 에디터의 select 옵션에 쓴다.
        // 태그명에 'task'/'gateway'/'event' 포함 (대소문자 무시) + id 가 있는 노드.
        // DI(BPMNShape/BPMNEdge) 와 중복 id 가 있을 수 있어 id 기준 dedupe.
        bpmnFlowNodes() {
            const xml = typeof this.bpmn === 'string' ? this.bpmn : null;
            if (!xml) return [];
            try {
                const doc = new DOMParser().parseFromString(xml, 'text/xml');
                const found = [];
                const seen = new Set();
                const interesting = /task|gateway|event|subprocess|callactivity|transaction/i;
                // BPMN DI 네임스페이스(Shape/Edge) 는 제외 — 같은 id 가 두 번 나옴.
                const skipDi = /^(bpmndi|omgdi|omgdc|di|dc)$/i;
                const walk = (el) => {
                    if (!el || !el.getAttribute) {
                        if (el && el.children) for (let i = 0; i < el.children.length; i++) walk(el.children[i]);
                        return;
                    }
                    const tag = el.localName || el.tagName || '';
                    const prefix = (el.prefix || '').toLowerCase();
                    if (skipDi.test(prefix)) return; // DI 서브트리 통째로 스킵
                    const id = el.getAttribute('id');
                    if (id && interesting.test(tag) && !seen.has(id)) {
                        seen.add(id);
                        const name = el.getAttribute('name') || id;
                        // 비교용 fullTag — 항상 'prefix:localName' 형태 (prefix 없으면 localName).
                        const fullTag = prefix ? `${prefix}:${tag}` : tag;
                        found.push({ id, name, tag: fullTag });
                    }
                    for (let i = 0; i < el.children.length; i++) walk(el.children[i]);
                };
                walk(doc.documentElement);
                return found;
            } catch (e) { return []; }
        },
        userTaskOptions() {
            return this.bpmnFlowNodes
                .filter((n) => /usertask$|subprocess$|callactivity$|transaction$|adhocsubprocess$/i.test(n.tag))
                .map((n) => ({ title: `${n.name} (${n.id})`, value: n.id }));
        },
        allActivityOptions() {
            return this.bpmnFlowNodes.map((n) => ({ title: `${n.name} (${n.id})`, value: n.id }));
        }
    },
    watch: {
        definitionId: {
            immediate: false,
            handler() {
                this.loadCases();
            }
        },
        // bpmn 이 created 이후 늦게 도착하면 fieldMeta 가 비어 키로만 표시되므로 재적재.
        bpmn: {
            immediate: false,
            handler() {
                this.loadFieldMeta();
            }
        }
    },
    created() {
        this.backend = BackendFactory.createBackend();
        this.loadCases();
        this.loadFieldMeta();
    },
    beforeUnmount() {
        try {
            const store = useBpmnStore();
            store.clearRunningActivityIds();
            store.clearCompletedActivityIds();
        } catch (e) { /* ignore */ }
        // 진행 중이던 인스턴스 정리 시도.
        if (this._inflightProcInstIds && this._inflightProcInstIds.size > 0) {
            const ids = Array.from(this._inflightProcInstIds);
            this._inflightProcInstIds.clear();
            ids.forEach((id) => {
                try { this.backend && this.backend.testCleanup(id); } catch (e) { /* ignore */ }
            });
        }
    },
    methods: {
        async loadCases() {
            if (!this.backend || !this.definitionId) return;
            this.loading = true;
            try {
                const raw = await this.backend.getRawDefinition(`unitTests/${this.definitionId}`, { type: 'unit' });
                const data = typeof raw === 'string' ? (raw ? JSON.parse(raw) : {}) : raw || {};
                this.allCases = data && typeof data === 'object' ? data : {};
            } finally {
                this.loading = false;
            }
        },
        async persist() {
            await this.backend.putRawDefinition(
                JSON.stringify(this.allCases),
                `unitTests/${this.definitionId}.unit`,
                { type: 'unit' }
            );
        },
        // 1순위: BPMN XML 에서 파싱한 id→name 맵, 2순위: viewer registry, 3순위: id 그대로.
        activityName(activityId) {
            if (!activityId) return activityId;
            const fromXml = this.activityNameMap && this.activityNameMap[activityId];
            if (fromXml) return fromXml;
            try {
                const viewer = this.bpmnViewerComponent && this.bpmnViewerComponent.bpmnViewer;
                if (viewer) {
                    const reg = viewer.get('elementRegistry');
                    const el = reg.get(activityId);
                    const name = el && el.businessObject && el.businessObject.name;
                    if (name) return name;
                }
            } catch (e) { /* ignore */ }
            return activityId;
        },
        hasEntries(value) {
            return value && typeof value === 'object' && Object.keys(value).length > 0;
        },
        hasExpected(expected) {
            if (!expected || typeof expected !== 'object') return false;
            return (
                (Array.isArray(expected.activeActivityIds) && expected.activeActivityIds.length > 0) ||
                (Array.isArray(expected.passedActivityIds) && expected.passedActivityIds.length > 0) ||
                !!expected.processStatus
            );
        },
        formatObject(value) {
            try {
                if (!value || typeof value !== 'object' || Object.keys(value).length === 0) return '-';
                return Object.entries(value)
                    .map(([k, v]) => `${this.fieldLabel(k)}: ${this.formatValue(v, k)}`)
                    .join(' · ');
            } catch (e) {
                return this.$t('ProcessUnitTest.serializeFailed');
            }
        },
        // 표시용 필드 라벨. 폼 정의에 있으면 사람이 보는 이름, 없으면 키 그대로.
        // 성공/실패 판정은 키로 하므로 이 매핑은 화면 표시에만 영향을 준다.
        fieldLabel(key) {
            const meta = this.fieldMeta && this.fieldMeta[key];
            return (meta && meta.label) || key;
        },
        // 선택형 필드의 옵션 값(예: "approved")을 사람이 보는 라벨(예: "결재 완료")로. 없으면 null.
        valueLabel(key, raw) {
            const meta = this.fieldMeta && this.fieldMeta[key];
            if (meta && meta.valueLabels && Object.prototype.hasOwnProperty.call(meta.valueLabels, raw)) {
                return meta.valueLabels[raw];
            }
            return null;
        },
        // 값 하나를 사람이 읽기 좋은 짧은 문자열로. 중첩 객체/배열은 개수로 요약한다.
        formatValue(v, key) {
            if (v === null || v === undefined || v === '') return this.$t('ProcessUnitTest.noneLabel');
            if (typeof v === 'boolean') return this.$t(v ? 'ProcessUnitTest.boolTrue' : 'ProcessUnitTest.boolFalse');
            if (Array.isArray(v)) {
                if (v.length === 0) return this.$t('ProcessUnitTest.noneLabel');
                if (v.every((item) => item == null || typeof item !== 'object')) {
                    return v.map((item) => {
                        if (item == null || item === '') return this.$t('ProcessUnitTest.noneLabel');
                        return this.valueLabel(key, item) || String(item);
                    }).join(', ');
                }
                return this.$t('ProcessUnitTest.itemCount', { count: v.length });
            }
            if (typeof v === 'object') {
                const keys = Object.keys(v);
                if (keys.length === 0) return this.$t('ProcessUnitTest.noneLabel');
                return this.$t('ProcessUnitTest.itemCount', { count: keys.length });
            }
            return this.valueLabel(key, v) || String(v);
        },
        processStatusLabel(status) {
            if (status === 'RUNNING') return this.$t('ProcessUnitTest.statusRunning');
            if (status === 'COMPLETED') return this.$t('ProcessUnitTest.statusCompleted');
            return status || this.$t('ProcessUnitTest.statusUnknown');
        },
        formatExpected(value) {
            try {
                if (!value || typeof value !== 'object') return '-';
                const parts = [];
                if (Array.isArray(value.activeActivityIds) && value.activeActivityIds.length) {
                    parts.push(this.$t('ProcessUnitTest.formatNext', { names: value.activeActivityIds.map((id) => this.activityName(id)).join(', ') }));
                }
                if (Array.isArray(value.passedActivityIds) && value.passedActivityIds.length) {
                    parts.push(this.$t('ProcessUnitTest.formatPassed', { names: value.passedActivityIds.map((id) => this.activityName(id)).join(', ') }));
                }
                if (value.processStatus) parts.push(this.$t('ProcessUnitTest.formatStatus', { status: this.processStatusLabel(value.processStatus) }));
                if (value.instanceCount !== undefined && value.instanceCount !== null) {
                    parts.push(this.$t('ProcessUnitTest.formatInstance', { count: value.instanceCount }));
                }
                return parts.length ? parts.join(' / ') : '-';
            } catch (e) {
                return '-';
            }
        },
        statusColor(status) {
            if (status === 'pass') return 'success';
            if (status === 'fail') return 'error';
            if (status === 'error') return 'warning';
            return 'grey';
        },
        statusLabel(testCase) {
            if (this.runningCaseIds.has(testCase.id)) return this.$t('ProcessUnitTest.caseRunning');
            const s = testCase.lastResult?.status;
            if (s === 'pass') return this.$t('ProcessUnitTest.casePass');
            if (s === 'fail') return this.$t('ProcessUnitTest.caseFail');
            if (s === 'error') return this.$t('ProcessUnitTest.caseError');
            return this.$t('ProcessUnitTest.caseNotRun');
        },
        formatRanAt(iso) {
            try { return new Date(iso).toLocaleString(); } catch (e) { return iso; }
        },
        groupSummary(group) {
            let pass = 0, fail = 0;
            (group.cases || []).forEach((c) => {
                const s = c.lastResult?.status;
                if (s === 'pass') pass++;
                else if (s === 'fail' || s === 'error') fail++;
            });
            return { pass, fail };
        },
        // UserTaskUnitTest.vue 와 동일한 비교 로직. 격리된 인스턴스에서 받은 실제 결과를 기대값과 비교.
        // instanceCount 는 명시 안 하면 1 로 가정 — 서브프로세스가 의도치 않게 여러 개 만들어지면 잡아낸다.
        compareExpected(expected, actual) {
            const ex = expected || {};
            const mismatches = [];
            const sortedActive = (actual.activeActivityIds || []).slice().sort();
            const actualPassed = actual.passedActivityIds || [];
            const nameList = (ids) => (ids && ids.length ? ids.map((id) => `'${this.activityName(id)}'`).join(', ') : this.$t('ProcessUnitTest.noneLabel'));
            if (Array.isArray(ex.activeActivityIds) && ex.activeActivityIds.length) {
                const wanted = [...ex.activeActivityIds].sort();
                if (JSON.stringify(wanted) !== JSON.stringify(sortedActive)) {
                    mismatches.push(this.$t('ProcessUnitTest.mismatchActive', { wanted: nameList(wanted), actual: nameList(sortedActive) }));
                }
            }
            if (Array.isArray(ex.passedActivityIds) && ex.passedActivityIds.length) {
                const missing = ex.passedActivityIds.filter((id) => !actualPassed.includes(id));
                if (missing.length) {
                    mismatches.push(this.$t('ProcessUnitTest.mismatchPassed', { missing: nameList(missing) }));
                }
            }
            if (ex.processStatus && ex.processStatus !== actual.processStatus) {
                mismatches.push(this.$t('ProcessUnitTest.mismatchStatus', { expected: this.processStatusLabel(ex.processStatus), actual: this.processStatusLabel(actual.processStatus) }));
            }
            const expectedCount = (ex.instanceCount === undefined || ex.instanceCount === null) ? 1 : Number(ex.instanceCount);
            const actualCount = (actual.instanceCount === undefined || actual.instanceCount === null) ? 1 : Number(actual.instanceCount);
            if (Number.isFinite(expectedCount) && expectedCount !== actualCount) {
                mismatches.push(this.$t('ProcessUnitTest.mismatchInstance', { expected: expectedCount, actual: actualCount }));
            }
            return { status: mismatches.length ? 'fail' : 'pass', mismatches };
        },
        extractErrorMessage(e) {
            if (!e) return this.$t('ProcessUnitTest.unknownError');
            if (typeof e === 'string') return e;
            if (typeof e.detail === 'string') return e.detail;
            if (typeof e.message === 'string') return e.message;
            if (e.detail && typeof e.detail === 'object') {
                try { return JSON.stringify(e.detail); } catch (err) { /* fallthrough */ }
            }
            try { return JSON.stringify(e); } catch (err) { return String(e); }
        },
        async setLastResult(activityId, testCase, lastResult) {
            const list = (this.allCases[activityId] || []).slice();
            const idx = list.findIndex((c) => c.id === testCase.id);
            if (idx < 0) return;
            list.splice(idx, 1, { ...list[idx], lastResult });
            this.allCases = { ...this.allCases, [activityId]: list };
            try { await this.persist(); } catch (e) { console.error('[ProcessUnitTestPanel] persist failed:', e); }
        },
        async runCase(activityId, testCase) {
            if (!this.backend || !this.definitionId) return;
            if (this.runningCaseIds.has(testCase.id)) return;
            const store = useBpmnStore();
            try { store.clearRunningActivityIds(); } catch (e) {}
            try { store.clearCompletedActivityIds(); } catch (e) {}
            try { store.setRunningActivityIds([activityId]); } catch (e) {}

            this.runningCaseIds = new Set([...this.runningCaseIds, testCase.id]);
            let procInstId = null;
            try {
                const init = await this.backend.testInitiate({
                    process_definition_id: this.definitionId,
                    target_activity_id: activityId,
                    given: testCase.given || {}
                });
                if (!init || !init.task_id) {
                    await this.setLastResult(activityId, testCase, {
                        status: 'error',
                        message: this.$t('ProcessUnitTest.noTaskId'),
                        ranAt: new Date().toISOString()
                    });
                    return null;
                }
                procInstId = init.proc_inst_id;
                if (procInstId) this._inflightProcInstIds.add(procInstId);
                const timeoutMs = Math.max(1, Number(testCase.timeoutSec) || 120) * 1000;
                const result = await this.backend.testComplete({
                    task_id: init.task_id,
                    form_values: (testCase.when && testCase.when.parameterValues) || {},
                    timeout_ms: timeoutMs
                });
                const actual = {
                    activeActivityIds: (result && result.active_activity_ids) || [],
                    passedActivityIds: (result && result.passed_activity_ids) || [],
                    processStatus: (result && result.process_status) || '',
                    instanceCount: (result && (result.instance_count != null ? Number(result.instance_count) : null))
                };
                try {
                    (actual.passedActivityIds || []).forEach((id) => store.addCompletedActivityId(id));
                    store.setRunningActivityIds(actual.activeActivityIds || []);
                } catch (e) {}
                const cmp = this.compareExpected(testCase.expected, actual);
                const lastResult = {
                    status: cmp.status,
                    actual,
                    mismatches: cmp.mismatches,
                    timedOut: !!(result && result.timed_out),
                    ranAt: new Date().toISOString()
                };
                await this.setLastResult(activityId, testCase, lastResult);
                return lastResult;
            } catch (e) {
                const lastResult = {
                    status: 'error',
                    message: this.extractErrorMessage(e),
                    ranAt: new Date().toISOString()
                };
                await this.setLastResult(activityId, testCase, lastResult);
                return lastResult;
            } finally {
                if (procInstId) {
                    try { await this.backend.testCleanup(procInstId); } catch (e) { /* ignore */ }
                    this._inflightProcInstIds.delete(procInstId);
                }
                const next = new Set(this.runningCaseIds);
                next.delete(testCase.id);
                this.runningCaseIds = next;
            }
        },
        toggleCaseExpand(caseId) {
            this.expandedCaseIds = { ...this.expandedCaseIds, [caseId]: !this.expandedCaseIds[caseId] };
        },
        isGroupExpanded(activityId) {
            return Array.isArray(this.expandedGroupIds) && this.expandedGroupIds.includes(activityId);
        },
        // 한 작업(group) 의 모든 케이스를 순차 실행. runAll 의 그룹 한정 버전.
        async runGroup(activityId) {
            if (this.groupRunningId) return;
            const group = this.groupedCases.find((g) => g.activityId === activityId);
            if (!group || !group.cases.length) return;
            this.groupRunningId = activityId;
            this.groupRunProgress = { current: 0, total: group.cases.length };
            try {
                for (const tc of [...group.cases]) {
                    this.groupRunProgress.current++;
                    try { await this.runCase(activityId, tc); } catch (e) { /* runCase 내부 기록 */ }
                }
            } finally {
                this.groupRunningId = null;
                this.groupRunProgress = { current: 0, total: 0 };
            }
        },
        // 작업 선택 → 새 케이스 에디터 열기. 선택 후 즉시 초기화.
        onAddCaseTargetSelected(activityId) {
            if (!activityId) return;
            this.openEditor(activityId, null);
            this.$nextTick(() => { this.addCaseTargetActivityId = null; });
        },
        async openEditor(activityId, testCase) {
            this.editorActivityId = activityId;
            this.editingCase = testCase || null;
            // 1) 폼 모드 데이터 — 이전 활동들의 폼 html + 이 활동의 폼 html.
            this.editorGivenForms = await this.fetchPreviousFormsWithHtml(activityId);
            this.editorCurrentForm = await this.fetchActivityForm(activityId);
            // 2) rows 폴백 모드 데이터 (폼이 없는 정의를 위해 항상 같이 준비).
            this.editorGivenOptions = await this.computeGivenOptions(activityId);
            const all = await this.computeAllFormFieldOptions();
            this.editorTaskParameterOptions = all.length ? all : this.computeTaskParameterOptions(activityId);
            this.editorOpen = true;
        },
        async fetchPreviousFormsWithHtml(activityId) {
            if (!this.backend || !activityId) return [];
            try {
                const forms = await this.backend.getPreviousForms(activityId, this.processDefinition || undefined);
                return (forms || [])
                    .filter((f) => f && f.html)
                    .map((f) => ({ activityId: f.activityId || f.id, title: f.title || f.id, html: f.html }));
            } catch (e) { return []; }
        },
        async fetchActivityForm(activityId) {
            if (!this.backend || !activityId) return null;
            try {
                const procDefId = this.definitionId || (this.processDefinition && (this.processDefinition.id || this.processDefinition.processDefinitionId));
                const form = await this.backend.getFormFields(undefined, activityId, procDefId);
                if (form && form.html) return { html: form.html };
                return null;
            } catch (e) { return null; }
        },
        // 프로세스 안 모든 UserTask 의 폼 필드를 합쳐 { title, value } 목록으로.
        // 각 액티비티별로 getPreviousForms 를 호출하고 fields_json 을 펼친 뒤 dedupe.
        async computeAllFormFieldOptions() {
            if (!this.backend) return [];
            try {
                const activityIds = this.bpmnFlowNodes
                    .filter((n) => /usertask$/i.test(n.tag))
                    .map((n) => n.id);
                if (!activityIds.length) return [];
                const collected = new Map(); // value → option
                for (const aid of activityIds) {
                    try {
                        const forms = await this.backend.getPreviousForms(aid, this.processDefinition || undefined);
                        // 해당 활동 자체의 폼은 getPreviousForms 결과에 없을 수 있음 → 별도 조회 생략하고
                        // 모든 액티비티를 한 바퀴 돌면서 결국 다 커버됨.
                        (forms || []).forEach((form) => {
                            const formActivityId = form.activityId || form.id || form.formId;
                            const formTitle = form.title || formActivityId || form.formId || this.$t('ProcessUnitTest.formFallbackTitle');
                            (form.fields_json || form.fields || []).forEach((field) => {
                                if (!field || !field.key) return;
                                const value = String(field.key);
                                if (collected.has(value)) return;
                                collected.set(value, {
                                    title: `${formTitle} › ${field.text || field.key}`,
                                    value,
                                    fieldType: field.type || field.inputType || field.fieldType || 'text',
                                    fieldOptions: field.options || field.items || null
                                });
                            });
                        });
                    } catch (e) { /* 한 활동 실패해도 계속 */ }
                }
                return Array.from(collected.values());
            } catch (e) {
                return [];
            }
        },
        // 폼 필드 메타맵을 미리 적재 — 화면 표시(키→이름)에만 쓰며 성공/실패 판정에는 영향이 없다.
        async loadFieldMeta() {
            if (!this.backend) return;
            try {
                const activityIds = this.bpmnFlowNodes
                    .filter((n) => /usertask$/i.test(n.tag))
                    .map((n) => n.id);
                const meta = {};
                for (const aid of activityIds) {
                    try {
                        const forms = await this.backend.getPreviousForms(aid, this.processDefinition || undefined);
                        (forms || []).forEach((form) => this.parseFormHtmlMeta(form && form.html, meta));
                    } catch (e) { /* 한 활동 실패해도 계속 */ }
                }
                this.fieldMeta = meta;
            } catch (e) { /* 라벨 못 받으면 키로 표시 */ }
        },
        // 폼 HTML에서 필드 메타 추출 → meta[name] = { label, valueLabels }.
        // label/valueLabels 는 화면 표시 전용 — 성공/실패 판정에는 쓰지 않는다.
        parseFormHtmlMeta(html, meta) {
            if (!html || typeof html !== 'string') return;
            try {
                const doc = new DOMParser().parseFromString(html, 'text/html');
                doc.querySelectorAll('[name]').forEach((el) => {
                    const tag = (el.tagName || '').toLowerCase();
                    // *-field 태그 또는 alias 를 가진 컨테이너(반복 섹션 등)만 대상.
                    if (!tag.endsWith('-field') && !el.hasAttribute('alias')) return;
                    const key = el.getAttribute('name');
                    if (!key || meta[key]) return;
                    const alias = (el.getAttribute('alias') || '').trim();
                    const valueLabels = {};
                    const itemsAttr = el.getAttribute('items');
                    if (itemsAttr) {
                        try {
                            const items = JSON.parse(itemsAttr.replace(/'/g, '"'));
                            (Array.isArray(items) ? items : []).forEach((it) => {
                                if (!it || typeof it !== 'object') return;
                                if (it.value !== undefined && (it.text !== undefined || it.label !== undefined)) {
                                    valueLabels[it.value] = it.text != null ? it.text : it.label;
                                } else {
                                    Object.entries(it).forEach(([k, v]) => { valueLabels[k] = v; });
                                }
                            });
                        } catch (e) { /* items 파싱 실패 시 값은 키 그대로 */ }
                    }
                    meta[key] = { label: alias || key, valueLabels };
                });
            } catch (e) { /* HTML 파싱 실패 시 키 그대로 표시 */ }
        },
        async computeGivenOptions(activityId) {
            if (!this.backend || !activityId) return [];
            try {
                const prevForms = await this.backend.getPreviousForms(activityId, this.processDefinition || undefined);
                const SEP = '';
                const options = [];
                (prevForms || []).forEach((form) => {
                    const aid = form.activityId || form.id || form.formId;
                    if (!aid) return;
                    (form.fields_json || form.fields || []).forEach((field) => {
                        if (!field || !field.key) return;
                        options.push({
                            title: `${form.title || aid} › ${field.text || field.key}`,
                            value: `${aid}${SEP}${field.key}`,
                            fieldType: field.type || field.inputType || field.fieldType || 'text',
                            fieldOptions: field.options || field.items || null
                        });
                    });
                });
                return options;
            } catch (e) {
                return [];
            }
        },
        computeTaskParameterOptions(activityId) {
            const xml = typeof this.bpmn === 'string' ? this.bpmn : null;
            if (!xml || !activityId) return [];
            try {
                const doc = new DOMParser().parseFromString(xml, 'text/xml');
                // id 로 활동 노드 찾기
                const all = doc.getElementsByTagName('*');
                let target = null;
                for (let i = 0; i < all.length; i++) {
                    if (all[i].getAttribute && all[i].getAttribute('id') === activityId) { target = all[i]; break; }
                }
                if (!target) return [];
                // uengine:eventSynchronization > attribute name
                const attrs = target.getElementsByTagName('*');
                const options = [];
                for (let i = 0; i < attrs.length; i++) {
                    const el = attrs[i];
                    const local = el.localName || el.tagName;
                    if (local === 'attribute' || local === 'attributes') {
                        const name = el.getAttribute && el.getAttribute('name');
                        if (name) options.push({ title: name, value: name });
                    }
                }
                return options;
            } catch (e) { return []; }
        },
        async onCaseSaved(nextCase) {
            const activityId = this.editorActivityId;
            if (!activityId) return;
            const existing = Array.isArray(this.allCases[activityId]) ? this.allCases[activityId] : [];
            const list = [...existing];
            const idx = list.findIndex((c) => c.id === nextCase.id);
            if (idx >= 0) list.splice(idx, 1, nextCase);
            else list.push(nextCase);
            this.allCases = { ...this.allCases, [activityId]: list };
            await this.persist();
        },
        async deleteCase(activityId, testCase) {
            if (!confirm(this.$t('ProcessUnitTest.deleteCaseConfirm'))) return;
            const existing = Array.isArray(this.allCases[activityId]) ? this.allCases[activityId] : [];
            const list = existing.filter((c) => c.id !== testCase.id);
            this.allCases = { ...this.allCases, [activityId]: list };
            await this.persist();
        },
        async runAll() {
            if (this.runAllProgress.running) return;
            const flat = [];
            this.groupedCases.forEach((g) => {
                g.cases.forEach((c) => flat.push({ activityId: g.activityId, testCase: c }));
            });
            if (!flat.length) return;
            this.runAllProgress = { running: true, total: flat.length, current: 0, abort: false };
            try {
                for (const item of flat) {
                    if (this.runAllProgress.abort) break;
                    this.runAllProgress.current++;
                    try {
                        await this.runCase(item.activityId, item.testCase);
                    } catch (e) {
                        // runCase 내부에서 이미 결과 기록.
                    }
                }
            } finally {
                this.runAllProgress = { running: false, total: 0, current: 0, abort: false };
            }
        },
        abortRunAll() {
            if (this.runAllProgress.running) this.runAllProgress.abort = true;
        }
    }
};
</script>

<style scoped>
.process-unit-test-panel {
    padding: 4px;
}
.border {
    border: 1px solid rgba(0, 0, 0, 0.08);
}
</style>
