<template>
    <v-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" max-width="680" persistent scrollable>
        <v-card>
            <v-card-title>{{ caseObject && caseObject.id ? $t('ProcessUnitTest.editTitle') : $t('ProcessUnitTest.newTitle') }}</v-card-title>
            <v-card-text style="max-height: 70vh">
                <v-text-field v-model="draft.name" :label="$t('ProcessUnitTest.testName')" density="compact" variant="outlined" hide-details class="mb-4" />

                <div class="text-subtitle-2 font-weight-medium mt-2 mb-1">{{ $t('ProcessUnitTest.givenTitle') }}</div>
                <div class="text-caption text-medium-emphasis mb-2">{{ $t('ProcessUnitTest.givenDesc') }}</div>
                <!-- 폼 모드: 이전 작업별 실제 폼을 그대로 렌더. 저장 시 ref 로 직접 읽음. -->
                <template v-if="givenForms && givenForms.length">
                    <v-expansion-panels multiple variant="accordion" density="compact" class="mb-2">
                        <v-expansion-panel v-for="form in givenForms" :key="form.activityId">
                            <v-expansion-panel-title>{{ form.title || form.activityId }}</v-expansion-panel-title>
                            <v-expansion-panel-text>
                                <DynamicForm
                                    :ref="(el) => { if (el) givenFormRefs[form.activityId] = el; }"
                                    :formHTML="form.html"
                                    :model-value="givenFormValue(form.activityId)"
                                />
                            </v-expansion-panel-text>
                        </v-expansion-panel>
                    </v-expansion-panels>
                </template>
                <!-- 폴백: 폼 html이 없으면 기존 key-value 행 -->
                <template v-else>
                    <div v-if="givenOptions.length === 0" class="text-caption text-medium-emphasis mb-2">
                        {{ $t('ProcessUnitTest.noGivenOptions') }}
                    </div>
                    <template v-else>
                        <div v-for="(row, index) in draft.givenRows" :key="'given-' + index" class="d-flex align-center mb-1" style="gap: 4px">
                            <v-select
                                v-model="row.k"
                                :items="givenOptions"
                                :placeholder="$t('ProcessUnitTest.givenRowPlaceholder')"
                                :no-data-text="$t('ProcessUnitTest.noDataText')"
                                density="compact"
                                variant="outlined"
                                hide-details
                                class="flex-grow-1"
                            />
                            <v-text-field
                                v-model="row.v" :placeholder="$t('ProcessUnitTest.valuePlaceholder')"
                                density="compact" variant="outlined" hide-details class="flex-grow-1"
                            />
                            <v-icon size="small" @click="draft.givenRows.splice(index, 1)">mdi-close</v-icon>
                        </div>
                        <v-btn size="x-small" variant="text" prepend-icon="mdi-plus" @click="draft.givenRows.push({ k: '', v: '' })">
                            {{ $t('ProcessUnitTest.add') }}
                        </v-btn>
                    </template>
                </template>

                <div class="text-subtitle-2 font-weight-medium mt-4 mb-1">{{ $t('ProcessUnitTest.whenSection') }}</div>
                <div class="text-caption text-medium-emphasis mb-2">{{ $t('ProcessUnitTest.whenDesc') }}</div>
                <!-- 폼 모드: 이 작업의 실제 폼을 그대로 렌더. 저장 시 ref 로 직접 읽음. -->
                <template v-if="currentForm && currentForm.html">
                    <v-card variant="outlined" class="pa-3 mb-2">
                        <DynamicForm
                            ref="whenForm"
                            :formHTML="currentForm.html"
                            :model-value="draft.whenValues"
                        />
                    </v-card>
                </template>
                <template v-else>
                <div v-for="(row, index) in draft.whenRows" :key="'when-' + index" class="d-flex align-center mb-1" style="gap: 4px">
                    <v-combobox
                        v-model="row.k"
                        :items="taskParameterOptions"
                        :placeholder="$t('ProcessUnitTest.whenRowPlaceholder')"
                        :no-data-text="$t('ProcessUnitTest.noWhenOptions')"
                        density="compact"
                        variant="outlined"
                        hide-details
                        class="flex-grow-1"
                    />
                    <!-- 값 입력: 필드 타입별 분기 -->
                    <v-select v-if="valueKind(whenFieldFor(row.k)) === 'select'"
                        v-model="row.v"
                        :items="selectItemsFor(whenFieldFor(row.k))"
                        :placeholder="$t('ProcessUnitTest.valuePlaceholder')"
                        density="compact" variant="outlined" hide-details clearable
                        class="flex-grow-1"
                    />
                    <v-checkbox v-else-if="valueKind(whenFieldFor(row.k)) === 'check'"
                        :model-value="toBool(row.v)"
                        @update:model-value="row.v = $event"
                        hide-details density="compact" color="primary" class="flex-grow-1"
                    />
                    <v-textarea v-else-if="valueKind(whenFieldFor(row.k)) === 'textarea'"
                        v-model="row.v" :placeholder="$t('ProcessUnitTest.valuePlaceholder')" rows="2" auto-grow
                        density="compact" variant="outlined" hide-details
                        class="flex-grow-1"
                    />
                    <v-text-field v-else
                        v-model="row.v" :type="valueKind(whenFieldFor(row.k))"
                        :placeholder="$t('ProcessUnitTest.valuePlaceholder')" density="compact" variant="outlined" hide-details
                        class="flex-grow-1"
                    />
                    <v-icon size="small" @click="draft.whenRows.splice(index, 1)">mdi-close</v-icon>
                </div>
                <v-btn size="x-small" variant="text" prepend-icon="mdi-plus" @click="draft.whenRows.push({ k: '', v: '' })">
                    {{ $t('ProcessUnitTest.add') }}
                </v-btn>
                </template>

                <div class="text-subtitle-2 font-weight-medium mt-4 mb-1">{{ $t('ProcessUnitTest.expectedResult') }}</div>
                <div class="text-caption text-medium-emphasis mb-2">{{ $t('ProcessUnitTest.expectedDesc') }}</div>
                <v-select
                    v-model="draft.expectedActiveActivityIds"
                    :items="userTaskOptions"
                    :label="$t('ProcessUnitTest.expectedActiveLabel')"
                    density="compact"
                    variant="outlined"
                    hide-details
                    multiple
                    chips
                    closable-chips
                    clearable
                    class="mb-2"
                />
                <v-select
                    v-model="draft.expectedPassedActivityIds"
                    :items="allActivityOptions"
                    :label="$t('ProcessUnitTest.expectedPassedLabel')"
                    density="compact"
                    variant="outlined"
                    hide-details
                    multiple
                    chips
                    closable-chips
                    clearable
                    class="mb-2"
                />
                <v-select
                    v-model="draft.expectedProcessStatus"
                    :items="processStatusOptions"
                    :label="$t('ProcessUnitTest.expectedStatusLabel')"
                    density="compact"
                    variant="outlined"
                    hide-details
                    clearable
                    class="mb-2"
                />
                <v-text-field
                    v-model.number="draft.expectedInstanceCount"
                    type="number"
                    min="0"
                    :label="$t('ProcessUnitTest.expectedInstanceLabel')"
                    :placeholder="$t('ProcessUnitTest.instancePlaceholder')"
                    :hint="$t('ProcessUnitTest.instanceHint')"
                    persistent-hint
                    density="compact"
                    variant="outlined"
                    clearable
                    class="mb-2"
                />

                <div class="d-flex align-center mt-4">
                    <v-btn variant="text" size="small"
                        :prepend-icon="advancedOpen ? 'mdi-chevron-down' : 'mdi-chevron-right'"
                        @click="advancedOpen = !advancedOpen">
                        {{ $t('ProcessUnitTest.advancedSettings') }}
                    </v-btn>
                </div>
                <v-expand-transition>
                    <div v-show="advancedOpen" class="pl-4 mt-2 mb-2" style="border-left: 2px solid rgba(0,0,0,0.08)">
                        <div class="text-subtitle-2 font-weight-medium mt-1 mb-1">{{ $t('ProcessUnitTest.aiMockTitle') }}</div>
                        <div class="text-caption text-medium-emphasis mb-2">
                            {{ $t('ProcessUnitTest.aiMockDesc') }}
                        </div>
                        <div v-for="(row, index) in draft.aiMockRows" :key="'ai-' + index" class="d-flex align-center mb-1" style="gap: 4px">
                            <v-text-field v-model="row.k" :placeholder="$t('ProcessUnitTest.aiMockKeyPlaceholder')" density="compact" variant="outlined" hide-details />
                            <v-text-field v-model="row.v" :placeholder="$t('ProcessUnitTest.aiMockValuePlaceholder')" density="compact" variant="outlined" hide-details />
                            <v-icon size="small" @click="draft.aiMockRows.splice(index, 1)">mdi-close</v-icon>
                        </div>
                        <v-btn size="x-small" variant="text" prepend-icon="mdi-plus" @click="draft.aiMockRows.push({ k: '', v: '' })">
                            {{ $t('ProcessUnitTest.add') }}
                        </v-btn>

                        <v-text-field
                            v-model.number="draft.timeoutSec"
                            type="number"
                            min="1"
                            :label="$t('ProcessUnitTest.timeoutLabel')"
                            :hint="$t('ProcessUnitTest.timeoutHint')"
                            persistent-hint
                            density="compact"
                            variant="outlined"
                            class="mt-4"
                        />
                    </div>
                </v-expand-transition>
            </v-card-text>
            <v-card-actions>
                <v-spacer />
                <v-btn variant="text" @click="cancel">{{ $t('ProcessUnitTest.cancel') }}</v-btn>
                <v-btn color="primary" @click="save">{{ $t('ProcessUnitTest.save') }}</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<script>
// Given key (activityId + fieldKey) 직렬화 구분자. activityId/fieldKey 에 보통 안 쓰는 U+001F.
const GIVEN_KEY_SEP = '';

function parseValue(value) {
    if (value === '' || value == null) return value;
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (!isNaN(Number(value)) && /^-?\d+(\.\d+)?$/.test(value)) return Number(value);
    if ((value.startsWith('{') && value.endsWith('}')) || (value.startsWith('[') && value.endsWith(']'))) {
        try { return JSON.parse(value); } catch (e) { return value; }
    }
    return value;
}

function rowsToObject(rows) {
    const result = {};
    (rows || []).forEach((row) => { if (row && row.k) result[row.k] = parseValue(row.v); });
    return result;
}

function objectToRows(value) {
    return Object.entries(value || {}).map(([k, v]) => ({ k, v: typeof v === 'string' ? v : JSON.stringify(v) }));
}

function givenToRows(given) {
    const rows = [];
    Object.entries(given || {}).forEach(([activityId, fields]) => {
        Object.entries(fields || {}).forEach(([fieldKey, v]) => {
            rows.push({ k: `${activityId}${GIVEN_KEY_SEP}${fieldKey}`, v: typeof v === 'string' ? v : JSON.stringify(v) });
        });
    });
    return rows;
}

function rowsToGiven(rows) {
    const given = {};
    (rows || []).forEach((row) => {
        if (!row || !row.k) return;
        const sepIndex = row.k.indexOf(GIVEN_KEY_SEP);
        if (sepIndex < 0) return;
        const activityId = row.k.slice(0, sepIndex);
        const fieldKey = row.k.slice(sepIndex + 1);
        if (!activityId || !fieldKey) return;
        if (!given[activityId]) given[activityId] = {};
        given[activityId][fieldKey] = parseValue(row.v);
    });
    return given;
}

import { defineAsyncComponent } from 'vue';
// 정적 import 면 SelectField 모듈 top-level 의 BackendFactory.createBackend() 가
// window.$mode 가 아직 안 잡힌 시점에 실행돼 throw 한다. 다이얼로그 표시 시점에 로드되도록 lazy.
const DynamicForm = defineAsyncComponent(() => import('@/components/designer/DynamicForm.vue'));

export default {
    name: 'UnitTestCaseEditor',
    components: { DynamicForm },
    props: {
        modelValue: { type: Boolean, default: false },
        // 편집 대상 케이스 (null 이면 신규).
        caseObject: { type: Object, default: null },
        // (폼 모드) 이전 활동들의 폼: [{ activityId, title, html }]
        givenForms: { type: Array, default: () => [] },
        // (폼 모드) 이 활동의 폼: { html }
        currentForm: { type: Object, default: null },
        // (rows fallback 모드) 키-값 옵션들
        givenOptions: { type: Array, default: () => [] },
        taskParameterOptions: { type: Array, default: () => [] },
        userTaskOptions: { type: Array, default: () => [] },
        allActivityOptions: { type: Array, default: () => [] },
        processStatusOptions: {
            type: Array,
            default: () => [
                { title: window.$i18n.global.t('ProcessUnitTest.statusRunning'), value: 'RUNNING' },
                { title: window.$i18n.global.t('ProcessUnitTest.statusCompleted'), value: 'COMPLETED' }
            ]
        }
    },
    emits: ['update:modelValue', 'save'],
    data() {
        return {
            draft: this.emptyDraft(),
            advancedOpen: false,
            // DynamicForm refs — 저장 시점에 .formValues 를 직접 읽기 위해 사용.
            givenFormRefs: {}
        };
    },
    watch: {
        modelValue: {
            immediate: true,
            handler(open) {
                if (open) {
                    this.givenFormRefs = {}; // 새로 열 때 ref 맵 초기화
                    this.resetDraft();
                }
            }
        }
    },
    computed: {
        // 빠른 lookup 용. givenOptions/taskParameterOptions value → option 전체.
        givenOptionByValue() {
            const map = {};
            (this.givenOptions || []).forEach((opt) => { if (opt && opt.value != null) map[opt.value] = opt; });
            return map;
        },
        taskParamOptionByValue() {
            const map = {};
            (this.taskParameterOptions || []).forEach((opt) => { if (opt && opt.value != null) map[opt.value] = opt; });
            return map;
        }
    },
    methods: {
        givenFieldFor(key) { return key ? this.givenOptionByValue[key] : null; },
        whenFieldFor(key) { return key ? this.taskParamOptionByValue[key] : null; },
        // 폼 모드: 특정 활동의 given 값 객체. 없으면 빈 객체 반환 (참조 안정성을 위해 초기 init).
        givenFormValue(activityId) {
            if (!this.draft.given[activityId]) this.draft.given[activityId] = {};
            return this.draft.given[activityId];
        },
        setGivenFormValue(activityId, value) {
            this.draft.given = { ...this.draft.given, [activityId]: value || {} };
        },
        // 필드 타입을 input 컨트롤 종류로 분류. 반환: 'select' | 'check' | 'textarea' | HTML5 input type ('text'/'number'/'date'/…).
        valueKind(field) {
            const t = (field && field.fieldType ? String(field.fieldType) : 'text').toLowerCase();
            if (['select', 'enum', 'radio', 'dropdown', 'combobox'].includes(t)) return 'select';
            if (['boolean', 'checkbox', 'check', 'switch', 'bool', 'toggle', 'yesno'].includes(t)) return 'check';
            if (['textarea', 'longtext', 'multiline', 'long_text'].includes(t)) return 'textarea';
            if (['number', 'integer', 'currency', 'float', 'decimal', 'numeric', 'int'].includes(t)) return 'number';
            if (t === 'date') return 'date';
            if (['datetime', 'datetime-local'].includes(t)) return 'datetime-local';
            if (t === 'time') return 'time';
            if (t === 'email') return 'email';
            if (['url', 'link'].includes(t)) return 'url';
            return 'text';
        },
        selectItemsFor(field) {
            const raw = field && field.fieldOptions;
            if (!Array.isArray(raw)) return [];
            return raw.map((o) => {
                if (o && typeof o === 'object') {
                    const value = o.value != null ? o.value : (o.text || o.label || o.title);
                    const title = o.title || o.label || o.text || String(value);
                    return { title, value };
                }
                return { title: String(o), value: o };
            });
        },
        toBool(v) {
            if (typeof v === 'boolean') return v;
            if (typeof v === 'string') return v === 'true' || v === '1' || v === 'on' || v === 'yes';
            if (typeof v === 'number') return v !== 0;
            return false;
        },
        emptyDraft() {
            return {
                name: '',
                // 폼 모드 데이터 — DynamicForm 의 modelValue 와 직접 바인딩
                given: {},        // { activityId: { fieldName: value } }
                whenValues: {},   // { fieldName: value }
                // rows 폴백 모드
                givenRows: [],
                whenRows: [],
                aiMockRows: [],
                expectedActiveActivityIds: [],
                expectedPassedActivityIds: [],
                expectedProcessStatus: '',
                expectedInstanceCount: null,
                timeoutSec: 120
            };
        },
        resetDraft() {
            const draft = this.emptyDraft();
            const tc = this.caseObject;
            if (tc) {
                draft.name = tc.name || '';
                // 폼 모드용 — 원본 객체를 깊은 복사로 채워둠.
                draft.given = tc.given ? JSON.parse(JSON.stringify(tc.given)) : {};
                draft.whenValues = (tc.when && tc.when.parameterValues) ? JSON.parse(JSON.stringify(tc.when.parameterValues)) : {};
                // rows 폴백 모드용 — 같은 데이터를 행 형태로도 미리 채워둠.
                draft.givenRows = givenToRows(tc.given);
                draft.whenRows = objectToRows(tc.when && tc.when.parameterValues);
                draft.aiMockRows = objectToRows(tc.aiMock);
                const expected = tc.expected || {};
                draft.expectedActiveActivityIds = Array.isArray(expected.activeActivityIds) ? [...expected.activeActivityIds] : [];
                draft.expectedPassedActivityIds = Array.isArray(expected.passedActivityIds) ? [...expected.passedActivityIds] : [];
                draft.expectedProcessStatus = expected.processStatus || '';
                draft.expectedInstanceCount = Number.isFinite(Number(expected.instanceCount)) && expected.instanceCount !== null && expected.instanceCount !== ''
                    ? Number(expected.instanceCount) : null;
                draft.timeoutSec = Number(tc.timeoutSec) > 0 ? Number(tc.timeoutSec) : 120;
            }
            this.draft = draft;
            this.advancedOpen = (draft.aiMockRows && draft.aiMockRows.length > 0)
                || (Number(draft.timeoutSec) > 0 && Number(draft.timeoutSec) !== 120);
        },
        cancel() {
            this.$emit('update:modelValue', false);
        },
        save() {
            const draft = this.draft;
            const expected = {};
            if (draft.expectedActiveActivityIds && draft.expectedActiveActivityIds.length) expected.activeActivityIds = [...draft.expectedActiveActivityIds];
            if (draft.expectedPassedActivityIds && draft.expectedPassedActivityIds.length) expected.passedActivityIds = [...draft.expectedPassedActivityIds];
            if (draft.expectedProcessStatus) expected.processStatus = draft.expectedProcessStatus;
            // 비우면 저장 안 함 → 비교 시 기본 1 로 처리.
            if (draft.expectedInstanceCount !== null && draft.expectedInstanceCount !== '' && Number.isFinite(Number(draft.expectedInstanceCount))) {
                expected.instanceCount = Number(draft.expectedInstanceCount);
            }
            const tc = this.caseObject;
            // 폼이 있으면 ref 로 DynamicForm.formValues 를 직접 읽음 (reactivity 우회).
            const useGivenForms = this.givenForms && this.givenForms.length > 0;
            const useCurrentForm = !!(this.currentForm && this.currentForm.html);
            let givenData;
            if (useGivenForms) {
                givenData = {};
                Object.entries(this.givenFormRefs || {}).forEach(([activityId, ref]) => {
                    try {
                        const v = ref && ref.formValues;
                        if (v && typeof v === 'object' && Object.keys(v).length > 0) {
                            givenData[activityId] = JSON.parse(JSON.stringify(v));
                        }
                    } catch (e) { /* ignore */ }
                });
            } else {
                givenData = rowsToGiven(draft.givenRows);
            }
            let whenData;
            if (useCurrentForm) {
                try {
                    const v = this.$refs.whenForm && this.$refs.whenForm.formValues;
                    whenData = v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : {};
                } catch (e) { whenData = {}; }
            } else {
                whenData = rowsToObject(draft.whenRows);
            }
            const nextCase = {
                id: tc?.id || `tc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                name: draft.name || '',
                given: givenData,
                when: { parameterValues: whenData },
                aiMock: rowsToObject(draft.aiMockRows),
                expected,
                timeoutSec: Number(draft.timeoutSec) > 0 ? Number(draft.timeoutSec) : 120,
                lastResult: tc?.lastResult || null
            };
            this.$emit('save', nextCase);
            this.$emit('update:modelValue', false);
        }
    }
};
</script>
