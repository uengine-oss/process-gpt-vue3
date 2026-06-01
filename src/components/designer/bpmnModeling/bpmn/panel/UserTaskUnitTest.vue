<template>
    <div class="user-task-unit-test">
        <div class="d-flex align-center justify-space-between mb-3" style="gap: 8px">
            <div class="text-subtitle-2 font-weight-medium flex-grow-1">{{ $t('ProcessUnitTest.unitTest') }}</div>
            <v-btn size="small" color="success" variant="tonal" prepend-icon="mdi-play-box-multiple"
                :disabled="cases.length === 0 || runningCaseIds.size > 0" :loading="runningAll" @click="runAll">
                {{ $t('ProcessUnitTest.runAll') }}
            </v-btn>
            <v-btn size="small" color="primary" variant="tonal" prepend-icon="mdi-plus" @click="openCaseEditor()">
                {{ $t('ProcessUnitTest.add') }}
            </v-btn>
        </div>

        <div v-if="loading" class="text-caption text-medium-emphasis py-4 text-center">{{ $t('ProcessUnitTest.loading') }}</div>
        <div v-else-if="cases.length === 0" class="text-caption text-medium-emphasis py-4 text-center">
            {{ $t('ProcessUnitTest.listEmpty') }}
        </div>

        <div v-else>
            <div v-for="(testCase, index) in cases" :key="testCase.id"
                class="pa-2 mb-2 rounded-lg" style="border: 1px solid rgba(0, 0, 0, 0.08)">
                <div class="d-flex align-center" style="gap: 6px; cursor: pointer"
                    @click="toggleCaseExpand(testCase.id)">
                    <v-icon size="18">{{ expandedCaseIds[testCase.id] ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon>
                    <span class="text-caption font-weight-medium flex-grow-1 text-truncate">
                        {{ testCase.name || `Case ${index + 1}` }}
                    </span>
                    <v-chip size="x-small" :color="statusColor(testCase.lastResult?.status)" variant="tonal">
                        {{ statusLabel(testCase) }}
                    </v-chip>
                    <!-- 접힌 상태에서만 빠른 액션 -->
                    <template v-if="!expandedCaseIds[testCase.id]">
                        <v-btn size="x-small" variant="tonal" color="success" icon="mdi-play" density="comfortable"
                            :loading="runningCaseIds.has(testCase.id)" :disabled="runningCaseIds.size > 0"
                            @click.stop="runCase(testCase)" />
                        <v-btn size="x-small" variant="text" icon="mdi-pencil" density="comfortable"
                            @click.stop="openCaseEditor(testCase)" />
                        <v-btn size="x-small" variant="text" color="error" icon="mdi-delete" density="comfortable"
                            @click.stop="deleteCase(testCase)" />
                    </template>
                </div>
                <div v-if="expandedCaseIds[testCase.id]" class="mt-2">
                    <div class="text-caption mb-2">
                        <strong>{{ $t('ProcessUnitTest.givenSection') }}</strong>
                        <div v-if="!hasGiven(testCase.given)" class="text-medium-emphasis ml-1">-</div>
                        <ul v-else class="pl-4 mb-0">
                            <li v-for="(fields, activityId) in testCase.given" :key="activityId">
                                {{ activityName(activityId) }}: {{ formatObject(fields) }}
                            </li>
                        </ul>
                    </div>
                    <div class="text-caption mb-2">
                        <strong>{{ $t('ProcessUnitTest.whenSection') }}</strong>
                        <span class="ml-1">{{ formatObject(testCase.when?.parameterValues) }}</span>
                    </div>
                    <div v-if="hasEntries(testCase.aiMock)" class="text-caption mb-2">
                        <strong>{{ $t('ProcessUnitTest.aiMockSection') }}</strong>
                        <span class="ml-1">{{ formatObject(testCase.aiMock) }}</span>
                    </div>
                    <div class="text-caption mb-2">
                        <strong>{{ $t('ProcessUnitTest.expectedResult') }}</strong>
                        <span class="ml-1">{{ formatExpected(testCase.expected) }}</span>
                    </div>
                    <div v-if="testCase.lastResult" class="text-caption mb-2">
                        <strong>{{ $t('ProcessUnitTest.runResult') }}</strong>
                        <span v-if="testCase.lastResult.actual" class="ml-1">{{ formatExpected(testCase.lastResult.actual) }}</span>
                        <v-chip v-if="testCase.lastResult.timedOut" size="x-small" color="warning" variant="tonal" class="ml-2">{{ $t('ProcessUnitTest.timedOut') }}</v-chip>
                        <v-chip v-if="testCase.lastResult.status === 'error'" size="x-small" color="error" variant="tonal" class="ml-2">{{ $t('ProcessUnitTest.caseError') }}</v-chip>
                        <div v-if="testCase.lastResult.message" class="text-medium-emphasis ml-1">{{ testCase.lastResult.message }}</div>
                        <ul v-if="testCase.lastResult.mismatches && testCase.lastResult.mismatches.length" class="pl-4 mb-0">
                            <li v-for="(msg, mi) in testCase.lastResult.mismatches" :key="mi" class="text-error">{{ msg }}</li>
                        </ul>
                        <div v-if="testCase.lastResult.ranAt" class="text-medium-emphasis ml-1">{{ formatRanAt(testCase.lastResult.ranAt) }}</div>
                        <v-btn v-if="testCase.lastResult.actual" size="x-small" variant="tonal" color="primary" prepend-icon="mdi-content-copy"
                            class="mt-1" @click="adoptActualAsExpected(testCase)">
                            {{ $t('ProcessUnitTest.adoptAsExpected') }}
                        </v-btn>
                    </div>
                    <div class="d-flex justify-end mt-2" style="gap: 4px">
                        <v-btn size="x-small" variant="tonal" color="success" prepend-icon="mdi-play"
                            :loading="runningCaseIds.has(testCase.id)" :disabled="runningCaseIds.size > 0"
                            @click="runCase(testCase)">{{ $t('ProcessUnitTest.run') }}</v-btn>
                        <v-btn size="x-small" variant="text" icon="mdi-pencil" @click="openCaseEditor(testCase)" />
                        <v-btn size="x-small" variant="text" icon="mdi-delete" color="error" @click="deleteCase(testCase)" />
                    </div>
                </div>
            </div>
        </div>

        <v-alert type="info" variant="tonal" density="compact" class="mt-3">
            {{ $t('ProcessUnitTest.userTaskInfoAlert') }}
        </v-alert>

        <UnitTestCaseEditor
            v-model="editorOpen"
            :case-object="editingCase"
            :given-forms="givenFormsWithHtml"
            :current-form="currentActivityForm"
            :given-options="givenOptions"
            :task-parameter-options="taskParameterOptions"
            :user-task-options="userTaskOptions"
            :all-activity-options="allActivityOptions"
            :process-status-options="processStatusOptions"
            @save="onCaseSaved"
        />
    </div>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
import { useBpmnStore } from '@/stores/bpmn';
import UnitTestCaseEditor from './UnitTestCaseEditor.vue';

// activityId 와 fieldKey 를 한 문자열로 합쳐 givenOptions value 로 쓰는 구분자 (editor 와 동일).
const GIVEN_KEY_SEP = '';

export default {

    name: 'UserTaskUnitTest',
    components: { UnitTestCaseEditor },
    props: {
        element: Object,
        processDefinitionId: String,
        definition: Object,
        uengineProperties: Object,
        activity: Object,
        availableForms: {
            type: Array,
            default: () => []
        }
    },
    data() {
        return {
            backend: null,
            loading: false,
            allCases: {},
            // 실행 중인 케이스 id 집합. 동시 실행은 막고, 버튼 disable/loading 표시에 사용.
            runningCaseIds: new Set(),
            runningAll: false,
            editorOpen: false,
            editingCase: null,
            // 이 액티비티의 폼 html (When 섹션용). loadCurrentForm 에서 비동기 채워짐.
            currentActivityForm: null,
            // 케이스별 펼침 상태 — 기본 접힘.
            expandedCaseIds: {}
        };
    },
    computed: {
        activityId() {
            return this.element?.id || this.uengineProperties?.tracingTag || this.uengineProperties?.name || 'unknown';
        },
        cases() {
            return Array.isArray(this.allCases[this.activityId]) ? this.allCases[this.activityId] : [];
        },
        storagePath() {
            return `unitTests/${this.processDefinitionId || 'unknown'}`;
        },
        // 폼 모드용: availableForms 중 html 이 있는 것만 골라 에디터에 넘김.
        givenFormsWithHtml() {
            return (this.availableForms || [])
                .filter((f) => f && f.html)
                .map((f) => ({ activityId: f.activityId || f.formId, title: f.title || f.activityId || f.formId, html: f.html }));
        },
        // Given: 선행 작업(폼)의 필드 목록. ProcessGPT는 전역 변수가 없으므로 "각 작업의 폼 출력"이 상태이다.
        givenOptions() {
            const options = [];
            (this.availableForms || []).forEach((form) => {
                const activityId = form.activityId || form.formId;
                if (!activityId) return;
                (form.fields || []).forEach((field) => {
                    if (!field || !field.key) return;
                    options.push({
                        title: `${form.title || form.activityId || form.formId} › ${field.text || field.key}`,
                        value: `${activityId}${GIVEN_KEY_SEP}${field.key}`,
                        fieldType: field.type || field.inputType || field.fieldType || 'text',
                        fieldOptions: field.options || field.items || null
                    });
                });
            });
            return options;
        },
        // When: 이 작업을 제출할 때 넣는 입력. 우선 uengine eventSynchronization attributes, 없으면 빈 목록.
        taskParameterOptions() {
            const attrs = this.uengineProperties?.eventSynchronization?.attributes || [];
            return attrs
                .filter((attr) => attr && attr.name)
                .map((attr) => ({
                    title: attr.name + (attr.className ? ` (${attr.className})` : ''),
                    value: attr.name
                }));
        },
        // 기대 활성 작업 후보: 프로세스가 멈출 수 있는 사람 작업과 서브프로세스(멀티 인스턴스 포함).
        userTaskOptions() {
            return this.bpmnFlowElements(['bpmn:UserTask', 'bpmn:SubProcess', 'bpmn:CallActivity', 'bpmn:Transaction', 'bpmn:AdHocSubProcess']);
        },
        // 기대 거쳐간 활동 후보: 모든 flow 노드(작업·게이트웨이·이벤트).
        allActivityOptions() {
            return this.bpmnFlowElements(null);
        },
        processStatusOptions() {
            return [
                { title: this.$t('ProcessUnitTest.statusRunning'), value: 'RUNNING' },
                { title: this.$t('ProcessUnitTest.statusCompleted'), value: 'COMPLETED' }
            ];
        },
        // 폼 필드 메타맵: fieldKey → { label, valueLabels }. 폼 HTML에서 추출하며 화면 표시에만 쓴다.
        fieldMeta() {
            const meta = {};
            (this.availableForms || []).forEach((form) => this.parseFormHtmlMeta(form && form.html, meta));
            if (this.currentActivityForm) this.parseFormHtmlMeta(this.currentActivityForm.html, meta);
            return meta;
        }
    },
    watch: {
        'element.id': {
            immediate: true,
            handler(id) {
                if (id && this.backend) {
                    this.loadCases();
                    this.loadCurrentForm();
                }
            }
        },
        // activity prop 이 늦게 채워지는 경우(폼 변경/패널 첫 진입) 폼 html 재로드.
        'activity.tool': {
            handler() { if (this.backend) this.loadCurrentForm(); }
        }
    },
    created() {
        this.backend = BackendFactory.createBackend();
        // 실행 중인 테스트 인스턴스의 procInstId를 추적해, unmount 시 cleanup 누락을 막는다.
        this._inflightProcInstIds = new Set();
        this.loadCases();
        // element.id 의 immediate watch 는 backend 준비 전에 한 번 돌고 끝나므로
        // 현재 작업 폼(when 필드 라벨 소스)을 여기서 직접 적재한다.
        this.loadCurrentForm();
    },
    beforeUnmount() {
        // 패널/화면이 닫힐 때 캔버스 마커 정리 (hli 패턴).
        try {
            const store = useBpmnStore();
            store.clearRunningActivityIds();
            store.clearCompletedActivityIds();
        } catch (e) { /* ignore */ }
        // 화면 이동/창 닫힘으로 runCase 의 finally 가 못 돌면 RUNNING 인스턴스가 잔존한다.
        // 추적된 procInstId 들에 대해 best-effort cleanup.
        try {
            if (this._inflightProcInstIds && this._inflightProcInstIds.size > 0) {
                const ids = Array.from(this._inflightProcInstIds);
                this._inflightProcInstIds.clear();
                ids.forEach((id) => {
                    try { this.backend && this.backend.testCleanup(id); } catch (e) { /* ignore */ }
                });
            }
        } catch (e) { /* ignore */ }
    },
    methods: {
        toggleCaseExpand(caseId) {
            this.expandedCaseIds = { ...this.expandedCaseIds, [caseId]: !this.expandedCaseIds[caseId] };
        },
        async loadCases() {
            if (!this.backend) return;
            this.loading = true;
            try {
                const raw = await this.backend.getRawDefinition(this.storagePath, { type: 'unit' });
                const data = typeof raw === 'string' ? (raw ? JSON.parse(raw) : {}) : raw || {};
                this.allCases = data && typeof data === 'object' ? data : {};
            } finally {
                this.loading = false;
            }
        },
        async persist() {
            await this.backend.putRawDefinition(JSON.stringify(this.allCases), `${this.storagePath}.unit`, { type: 'unit' });
        },
        async loadCurrentForm() {
            // 이 액티비티 자체의 폼 html. activity.tool 의 formHandler:formId 패턴으로 formId 추출 후 form_def 조회.
            // (form_def 는 항상 activity_id 가 채워져 있지 않아 getFormFields(activityId,...) 가 비어 돌아오는 경우가 있다.)
            try {
                if (!this.backend || !this.activityId) { this.currentActivityForm = null; return; }
                const formId = this.extractFormIdForActivity(this.activityId);
                if (!formId) { this.currentActivityForm = null; return; }
                const form = await this.backend.getFormFields(formId);
                this.currentActivityForm = form && form.html ? { html: form.html } : null;
            } catch (e) {
                this.currentActivityForm = null;
            }
        },
        // 1순위: activity prop (현재 선택된 task), 2순위: definition.activities 에서 검색.
        // tool 필드의 'formHandler:xxx' 패턴에서 formId 추출.
        extractFormIdForActivity(activityId) {
            const fromActivityProp = this.activity && typeof this.activity.tool === 'string' ? this.activity.tool : '';
            if (fromActivityProp.startsWith('formHandler:')) return fromActivityProp.split('formHandler:')[1];
            const def = this.definition || {};
            const activities = Array.isArray(def.activities) ? def.activities : [];
            const found = activities.find((a) => a && a.id === activityId);
            const tool = found && typeof found.tool === 'string' ? found.tool : '';
            if (tool.startsWith('formHandler:')) return tool.split('formHandler:')[1];
            return null;
        },
        async openCaseEditor(testCase) {
            this.editingCase = testCase || null;
            // 폼 데이터를 최신화한 뒤 다이얼로그 오픈 (loadCurrentForm 이 watch 로 못 잡힌 케이스 대비).
            try { await this.loadCurrentForm(); } catch (e) { /* ignore */ }
            this.editorOpen = true;
        },
        async onCaseSaved(nextCase) {
            const nextCases = [...this.cases];
            const index = nextCases.findIndex((item) => item.id === nextCase.id);
            if (index >= 0) nextCases.splice(index, 1, nextCase);
            else nextCases.push(nextCase);
            this.allCases = { ...this.allCases, [this.activityId]: nextCases };
            await this.persist();
        },
        async deleteCase(testCase) {
            this.allCases = {
                ...this.allCases,
                [this.activityId]: this.cases.filter((item) => item.id !== testCase.id)
            };
            await this.persist();
        },
        hasEntries(value) {
            return value && typeof value === 'object' && Object.keys(value).length > 0;
        },
        hasGiven(given) {
            try {
                if (!given || typeof given !== 'object') return false;
                return Object.keys(given).some((activityId) => given[activityId] && typeof given[activityId] === 'object' && Object.keys(given[activityId]).length > 0);
            } catch (e) {
                return false;
            }
        },
        activityLabel(activityId) {
            try {
                // 1) BPMN 모델러의 elementRegistry — 캔버스에서 방금 바꾼 이름까지 반영되는 1차 소스.
                try {
                    const store = useBpmnStore();
                    const modeler = store && store.bpmnModeler;
                    if (modeler) {
                        const reg = modeler.get && modeler.get('elementRegistry');
                        const el = reg && reg.get && reg.get(activityId);
                        const name = el && el.businessObject && el.businessObject.name;
                        if (name) return name;
                    }
                } catch (e) { /* ignore */ }
                // 2) 저장된 정의의 activities[].name — 모델러가 아직 없거나 못 찾을 때 폴백.
                const activities = (this.definition && Array.isArray(this.definition.activities)) ? this.definition.activities : [];
                const found = activities.find((a) => a && a.id === activityId);
                if (found && found.name) return found.name;
                // 3) availableForms 의 title — 폼이 붙은 사용자 작업 한정.
                const form = (this.availableForms || []).find((f) => (f.activityId || f.formId) === activityId);
                if (form && form.title) return form.title;
                return activityId;
            } catch (e) {
                return activityId;
            }
        },
        // 에디터 select 옵션 소스. types=null 이면 모든 flow 노드(작업·게이트웨이·이벤트).
        bpmnFlowElements(types) {
            try {
                const store = useBpmnStore();
                const modeler = store && store.bpmnModeler;
                if (!modeler) return [];
                const reg = modeler.get && modeler.get('elementRegistry');
                if (!reg || !reg.getAll) return [];
                const filterType = (type) => {
                    if (!type) return false;
                    if (Array.isArray(types) && types.length) return types.includes(type);
                    return /Task$|Gateway$|Event$|SubProcess$|CallActivity$|Transaction$/.test(type);
                };
                return reg.getAll()
                    .filter((el) => el && el.id && el.businessObject && filterType(el.type))
                    .map((el) => {
                        const name = el.businessObject.name;
                        return { title: name ? `${name} (${el.id})` : el.id, value: el.id };
                    });
            } catch (e) {
                return [];
            }
        },
        // 결과/오류 메시지에서 쓰는 사람용 이름. activityLabel에 붙는 "(id)" 꼬리표를 떼낸다.
        activityName(activityId) {
            try {
                const label = this.activityLabel(activityId);
                return typeof label === 'string' ? label.replace(/\s*\([^)]+\)\s*$/, '') : (activityId || '');
            } catch (e) {
                return activityId || '';
            }
        },
        processStatusLabel(status) {
            if (status === 'RUNNING') return this.$t('ProcessUnitTest.statusRunning');
            if (status === 'COMPLETED') return this.$t('ProcessUnitTest.statusCompleted');
            return status || this.$t('ProcessUnitTest.statusUnknown');
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
        // Then / 실행결과 표시: { activeActivityIds, passedActivityIds, processStatus } 를 사람이 읽기 좋게.
        formatExpected(value) {
            try {
                if (!value || typeof value !== 'object') return '-';
                const parts = [];
                if (Array.isArray(value.activeActivityIds) && value.activeActivityIds.length) {
                    parts.push(this.$t('ProcessUnitTest.formatNextTask', { names: value.activeActivityIds.map((id) => this.activityName(id)).join(', ') }));
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
            try {
                return new Date(iso).toLocaleString();
            } catch (e) {
                return iso;
            }
        },
        // 단일 케이스 실행: initiate → complete → 결과 비교 → 백엔드 인스턴스 cleanup.
        // 캔버스 마커(store)는 hli 패턴대로 패널 닫힘/다음 실행 전까지 유지.
        async runCase(testCase) {
            if (!this.backend || !this.processDefinitionId) return;
            if (this.runningCaseIds.has(testCase.id)) return;
            // 새 실행을 시작할 때 이전 실행의 마커는 초기화.
            const store = useBpmnStore();
            try { store.clearRunningActivityIds(); } catch (e) {}
            try { store.clearCompletedActivityIds(); } catch (e) {}
            // 타깃 작업은 "진행 중"으로 표시.
            try { store.setRunningActivityIds([this.activityId]); } catch (e) {}

            this.runningCaseIds = new Set([...this.runningCaseIds, testCase.id]);
            let procInstId = null;
            try {
                const init = await this.backend.testInitiate({
                    process_definition_id: this.processDefinitionId,
                    target_activity_id: this.activityId,
                    given: testCase.given || {}
                });
                if (!init || !init.task_id) {
                    this.setLastResult(testCase, { status: 'error', message: this.$t('ProcessUnitTest.noTaskId'), ranAt: new Date().toISOString() });
                    return;
                }
                procInstId = init.proc_inst_id;
                // beforeUnmount 에서 cleanup 보장.
                if (procInstId && this._inflightProcInstIds) this._inflightProcInstIds.add(procInstId);
                // AI 작업은 LLM 호출이 끼면 분 단위가 걸릴 수 있다. 케이스별 timeoutSec 설정 ▶ 없으면 120s.
                // 백엔드는 진행을 감지하면 즉시 리턴하므로 이 값은 그냥 상한선.
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
                // 캔버스 마커 갱신: 거쳐간 활동들 → 완료, 현재 활성 → 진행 중.
                try {
                    (actual.passedActivityIds || []).forEach((id) => store.addCompletedActivityId(id));
                    store.setRunningActivityIds(actual.activeActivityIds || []);
                } catch (e) {}
                const cmp = this.compareExpected(testCase.expected, actual);
                this.setLastResult(testCase, {
                    status: cmp.status,
                    actual,
                    mismatches: cmp.mismatches,
                    timedOut: !!(result && result.timed_out),
                    ranAt: new Date().toISOString()
                });
            } catch (e) {
                this.setLastResult(testCase, {
                    status: 'error',
                    message: this.extractErrorMessage(e),
                    ranAt: new Date().toISOString()
                });
            } finally {
                if (procInstId) {
                    try {
                        await this.backend.testCleanup(procInstId);
                    } catch (e) {
                        // cleanup 실패는 테스트 결과에 영향 없음.
                    }
                    if (this._inflightProcInstIds) this._inflightProcInstIds.delete(procInstId);
                }
                const next = new Set(this.runningCaseIds);
                next.delete(testCase.id);
                this.runningCaseIds = next;
            }
        },
        async runAll() {
            if (this.runningAll) return;
            this.runningAll = true;
            try {
                for (const tc of [...this.cases]) {
                    await this.runCase(tc);
                }
            } finally {
                this.runningAll = false;
            }
        },
        // 기대값과 실제 결과 비교. activeActivityIds는 정확히 일치, passedActivityIds는 포함(부분집합),
        // processStatus는 지정 시 일치해야 한다. 지정되지 않은 항목은 검사하지 않는다.
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
            // 인스턴스 개수: 명시 안 했으면 1 로 가정. 서브프로세스 케이스 검증용.
            const expectedCount = (ex.instanceCount === undefined || ex.instanceCount === null) ? 1 : Number(ex.instanceCount);
            const actualCount = (actual.instanceCount === undefined || actual.instanceCount === null) ? 1 : Number(actual.instanceCount);
            if (Number.isFinite(expectedCount) && expectedCount !== actualCount) {
                mismatches.push(this.$t('ProcessUnitTest.mismatchInstance', { expected: expectedCount, actual: actualCount }));
            }
            return { status: mismatches.length ? 'fail' : 'pass', mismatches };
        },
        // axios interceptor 가 reject 한 값은 response body(FastAPI 의 {detail}) 거나 문자열이거나
        // Error 객체일 수 있다. 사람이 읽을 한 줄을 뽑아낸다. ({{ "[object Object]" }} 방지)
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
        // 현재 실행 결과를 기대값으로 채택한 뒤, 같은 결과가 실제로 다시 나오는지 검증하기 위해 즉시 재실행.
        // (성공 마킹만 하고 끝내지 않는다 — 매 실행이 실제 엔진을 거쳐야 의미가 있다.)
        async adoptActualAsExpected(testCase) {
            const actual = testCase.lastResult && testCase.lastResult.actual;
            if (!actual) return;
            const expected = {};
            if (Array.isArray(actual.activeActivityIds) && actual.activeActivityIds.length) {
                expected.activeActivityIds = [...actual.activeActivityIds];
            }
            if (Array.isArray(actual.passedActivityIds) && actual.passedActivityIds.length) {
                expected.passedActivityIds = [...actual.passedActivityIds];
            }
            if (actual.processStatus) expected.processStatus = actual.processStatus;
            // 실제 인스턴스 수가 1이 아니면 그 값을 채택. 1이면 기본값과 같으므로 생략.
            if (actual.instanceCount != null && Number(actual.instanceCount) !== 1) {
                expected.instanceCount = Number(actual.instanceCount);
            }
            const list = this.cases.slice();
            const idx = list.findIndex((c) => c.id === testCase.id);
            if (idx < 0) return;
            const updated = { ...list[idx], expected, lastResult: null };
            list.splice(idx, 1, updated);
            this.allCases = { ...this.allCases, [this.activityId]: list };
            await this.persist();
            // 새 기대값으로 실제 검증.
            await this.runCase(updated);
        },
        // 케이스의 lastResult를 갱신하고 저장. 동일 activityId 안에서 해당 case를 찾아 교체.
        async setLastResult(testCase, lastResult) {
            const list = this.cases.slice();
            const idx = list.findIndex((c) => c.id === testCase.id);
            if (idx < 0) return;
            list.splice(idx, 1, { ...list[idx], lastResult });
            this.allCases = { ...this.allCases, [this.activityId]: list };
            try {
                await this.persist();
            } catch (e) {
                console.error('[UserTaskUnitTest] persist lastResult failed:', e);
            }
        }
    }
};
</script>

<style scoped>
.user-task-unit-test {
    padding: 16px;
}
</style>
