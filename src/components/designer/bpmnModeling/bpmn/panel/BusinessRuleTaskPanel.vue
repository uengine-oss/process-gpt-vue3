<template>
    <div>
        <!-- (A) 룰 선택 -->
        <div class="mb-4">
            <v-row class="ma-0 pa-0 align-center mb-2">
                <div style="font-weight: 700;">{{ $t('businessRuleTaskPanel.ruleSelectTitle') }}</div>
                <v-spacer />
                <v-btn
                    variant="text"
                    density="comfortable"
                    :disabled="isRuleListLoading || isViewMode"
                    @click="refreshRuleList"
                >
                    <v-icon size="18" class="mr-1">mdi-refresh</v-icon>
                    {{ $t('businessRuleTaskPanel.refreshRuleList') }}
                </v-btn>
                <v-btn color="primary" variant="flat" rounded density="comfortable" class="ml-2" @click="createNewRule">
                    {{ $t('businessRuleTaskPanel.createNewRule') }}
                </v-btn>
            </v-row>

            <v-autocomplete
                v-model="selectedRuleId"
                :items="ruleItems"
                item-title="name"
                item-value="id"
                :label="$t('businessRuleTaskPanel.ruleSelectLabel')"
                variant="outlined"
                density="comfortable"
                hide-details
                :loading="isRuleListLoading"
                :disabled="isViewMode"
                @update:model-value="onRuleSelected"
            />

            <div v-if="selectedRuleId && selectedRuleName" class="mt-2 text-medium-emphasis" style="font-size: 13px;">
                {{ $t('businessRuleTaskPanel.selectedRulePrefix') }} <span style="font-weight: 600;">{{ selectedRuleName }}</span>
            </div>

            <!-- 선택된 룰의 판단 기준 미리보기(사람용, JSON/기술용어 노출 금지) -->
            <v-card
                v-if="selectedRuleId || loadedRule"
                variant="outlined"
                class="mt-3 pa-3"
            >
                <div class="d-flex align-center mb-2">
                    <div style="font-weight: 700;">{{ $t('businessRuleTaskPanel.conditionCriteria') }}</div>
                    <v-spacer />
                    <v-btn
                        size="small"
                        rounded="pill"
                        :variant="isAdvancedPreview ? 'flat' : 'tonal'"
                        :color="isAdvancedPreview ? 'primary' : 'primary'"
                        class="br-advanced-toggle"
                        :disabled="!loadedRule || !loadedRule.dmnXml"
                        @click="isAdvancedPreview = !isAdvancedPreview"
                    >
                        {{ $t('businessRuleTaskPanel.dmnPreview') }}
                    </v-btn>
                </div>

                <div v-if="isRuleLoading" class="text-medium-emphasis" style="font-size: 13px;">
                    {{ $t('businessRuleTaskPanel.loading') }}
                </div>

                <div v-else-if="loadedRule">
                    <template v-if="isAdvancedPreview && loadedRule.dmnXml">
                        <div class="text-medium-emphasis mb-2" style="font-size: 13px;">
                            {{ $t('businessRuleTaskPanel.dmnPreviewDescription') }}
                        </div>
                        <v-card variant="outlined" class="br-advanced-preview pa-2">
                            <DmnStructureView v-if="dmnPreview" :dmn="dmnPreview" :key="dmnPreviewKey" />
                            <div v-else class="text-medium-emphasis pa-3" style="font-size: 13px;">
                                {{ $t('businessRuleTaskPanel.dmnPreviewFailed') }}
                            </div>
                        </v-card>
                    </template>
                    <template v-else>
                        <!-- 여러 규칙이 있으면 우선순위 순서대로 전부 표시 -->
                        <v-card
                            v-for="r in previewRules"
                            :key="`rule_${r.index}`"
                            variant="outlined"
                            class="br-preview-rule-card pa-2 mb-2"
                        >
                            <div class="d-flex align-center mb-1">
                                <div style="font-weight: 700;">{{ $t('businessRuleTaskPanel.ruleNumber', { n: r.index }) }}</div>
                                <v-spacer />
                                <div class="text-medium-emphasis br-preview-rule-hint">{{ $t('businessRuleTaskPanel.rulePriorityHint') }}</div>
                            </div>

                            <v-table density="compact" class="rule-preview-table">
                                <thead>
                                    <tr>
                                        <th style="width: 56px;">#</th>
                                        <th style="min-width: 160px;">항목</th>
                                        <th style="width: 160px;">비교</th>
                                        <th style="min-width: 160px;">값</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="(c, idx) in r.conditions" :key="`c_${r.index}_${idx}`">
                                        <td class="text-medium-emphasis" style="font-size: 12px;">{{ idx + 1 }}</td>
                                        <td>{{ c.item }}</td>
                                        <td>{{ c.operatorText }}</td>
                                        <td>{{ c.value }}</td>
                                    </tr>
                                </tbody>
                            </v-table>

                            <div v-if="r.conditions.length === 0" class="text-medium-emphasis mt-2" style="font-size: 13px;">
                                {{ $t('businessRuleTaskPanel.noConditionsRegistered') }}
                            </div>

                            <div v-if="r.outcomeText" class="text-medium-emphasis mt-2" style="font-size: 13px;">
                                결과: <span style="font-weight: 600;">{{ r.outcomeText }}</span>
                                <span v-if="r.noteText"> - {{ r.noteText }}</span>
                            </div>
                        </v-card>

                        <div v-if="previewRules.length === 0" class="text-medium-emphasis mt-2" style="font-size: 13px;">
                            {{ $t('businessRuleTaskPanel.noRulesRegistered') }}
                        </div>
                    </template>
                </div>

                <div v-else class="text-medium-emphasis" style="font-size: 13px;">
                    {{ $t('businessRuleTaskPanel.selectRuleFirstMessage') }}
                </div>
            </v-card>
        </div>

        <!-- (B) 데이터 매핑 (기존 Task와 동일한 Mapper 버튼 UI/동작) -->
        <v-btn
            block
            text
            rounded
            color="primary"
            class="my-3"
            :disabled="!selectedRuleId"
            @click="openMapperDialog"
        >
            {{ $t('EventSynchronizationForm.dataMapping') }}
        </v-btn>

        <div v-if="!selectedRuleId" class="text-medium-emphasis" style="font-size: 13px;">
            {{ $t('businessRuleTaskPanel.selectRuleFirst') }}
        </div>

        <!-- Mapper dialog -->
        <v-dialog
            v-model="mappingDialog"
            max-width="80%"
            max-height="80%"
            class="mapper-dialog"
            @afterLeave="$refs.formMapper && $refs.formMapper.saveFormMapperJson()"
        >
            <mapper
                ref="formMapper"
                :definition="copyDefinition"
                :formMapperJson="formMapperJson"
                :name="name"
                :expandableTrees="nodes"
                :replaceFromExpandableNode="replaceFromExpandableNode"
                :replaceToExpandableNode="replaceToExpandableNode"
                @saveFormMapperJson="saveMapper"
                @closeFormMapper="closeFormMapper"
            />
        </v-dialog>
    </div>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
import Mapper from '@/components/designer/mapper/Mapper.vue';
import { parseDmnXml } from '@/utils/dmnParser';
import DmnStructureView from '@/components/dmn/DmnStructureView.vue';

export default {
    name: 'business-rule-task-panel',
    components: {
        Mapper,
        DmnStructureView
    },
    props: {
        uengineProperties: Object,
        processDefinitionId: String,
        processDefinition: Object,
        element: Object,
        isViewMode: Boolean,
        roles: Array,
        definition: Object,
        name: String
    },
    emits: ['update:uengineProperties'],
    data() {
        return {
            backend: null,
            copyUengineProperties: this.uengineProperties ? JSON.parse(JSON.stringify(this.uengineProperties)) : {},
            copyDefinition: this.definition,

            // rule
            isRuleListLoading: false,
            isRuleLoading: false,
            ruleItems: [],
            selectedRuleId: null,
            selectedRuleName: '',
            loadedRule: null, // 내부 데이터 (UI에 노출 금지)
            isAdvancedPreview: false,
            dmnPreviewKey: 0,

            // mapper (기존 UI/동작 유지)
            mappingDialog: false,
            formMapperJson: '',
            nodes: {},
            replaceFromExpandableNode: () => null,
            replaceToExpandableNode: () => null
        };
    },
    async created() {
        this.backend = BackendFactory.createBackend();

        // 매핑 저장 구조는 기존 엔진 패턴(EventSynchronization.mappingContext)을 재사용한다.
        // (UI에 EventSynchronization 설정을 노출하지 않고, 내부 저장만 동일하게 맞춘다)
        this.ensureEventSynchronization();

        // 이전 선택 복원(내부 저장: UI에 노출 금지)
        // - 신규 저장 위치: copyUengineProperties.businessRuleId
        // - (과거/중간 버전) eventSynchronization.businessRuleId
        // - 레거시: customProperties.businessRuleId
        this.selectedRuleId = this.normalizeRuleId(
            this.copyUengineProperties?.businessRuleId ??
                this.copyUengineProperties?.eventSynchronization?.businessRuleId ??
                this.readCustomProperty('businessRuleId')
        );

        // 1) 표준 저장 위치(권장): eventSynchronization.mappingContext
        const mc = this.copyUengineProperties?.eventSynchronization?.mappingContext;
        if (mc && typeof mc === 'object') {
            this.formMapperJson = JSON.stringify(mc, null, 2);
        } else {
            this.formMapperJson = '';
        }

        // 2) 레거시 호환: customProperties.businessRuleMapping 이 있으면 1회 이관
        const legacy = this.readCustomProperty('businessRuleMapping');
        if ((!this.formMapperJson || this.formMapperJson === '{}' || this.formMapperJson === 'null') && legacy) {
            try {
                const parsed = JSON.parse(String(legacy));
                if (parsed && typeof parsed === 'object') {
                    this.copyUengineProperties.eventSynchronization.mappingContext = parsed;
                    this.formMapperJson = JSON.stringify(parsed, null, 2);
                }
            } catch (e) {
                // 레거시 JSON이 깨져있으면 무시(사용자에게 기술 정보 노출 금지)
            }
        }

        await this.loadRuleList();
        if (this.selectedRuleId) {
            await this.loadRule(this.selectedRuleId);
        }
    },
    computed: {
        dmnPreview() {
            const xml = this.loadedRule && typeof this.loadedRule.dmnXml === 'string' ? this.loadedRule.dmnXml : '';
            return xml ? parseDmnXml(xml) : null;
        },
        previewConditions() {
            const rule = this.loadedRule;
            const inputs = Array.isArray(rule?.inputs) ? rule.inputs : [];
            const labelByKey = new Map();
            inputs.forEach((i) => {
                const key = String(i?.key ?? i?.item ?? '').trim();
                const label = String(i?.label ?? '').trim();
                if (key) labelByKey.set(key, label || key);
            });

            // 다중 규칙(행) 모델: 첫 번째 규칙의 조건을 미리보기로 노출
            const firstRow = Array.isArray(rule?.rules) && rule.rules.length > 0 ? rule.rules[0] : null;
            const conditions = Array.isArray(firstRow?.conditions) ? firstRow.conditions : [];
            return conditions
                .map((c) => {
                    const key = String(c?.key ?? c?.item ?? '').trim();
                    return {
                        item: labelByKey.get(key) || key,
                        operatorText: this.operatorToText(c?.operator),
                        value: String(c?.value ?? '').trim()
                    };
                })
                .filter((r) => r.item || r.value || r.operatorText);
        },
        previewRules() {
            const rule = this.loadedRule;
            const inputs = Array.isArray(rule?.inputs) ? rule.inputs : [];
            const labelByKey = new Map();
            inputs.forEach((i) => {
                const key = String(i?.key ?? i?.item ?? '').trim();
                const label = String(i?.label ?? '').trim();
                if (key) labelByKey.set(key, label || key);
            });

            const rows = Array.isArray(rule?.rules) ? rule.rules : [];
            return rows.map((row, idx) => {
                const conds = Array.isArray(row?.conditions) ? row.conditions : [];
                const prettyConditions = conds
                    .map((c) => {
                        const key = String(c?.key ?? c?.item ?? '').trim();
                        return {
                            item: labelByKey.get(key) || key,
                            operatorText: this.operatorToText(c?.operator),
                            value: this.valueToText(c?.value)
                        };
                    })
                    .filter((c) => c.item || c.value || c.operatorText);

                return {
                    index: idx + 1,
                    conditions: prettyConditions,
                    outcomeText: this.outcomeToText(row?.result?.outcome),
                    noteText: typeof row?.result?.note === 'string' ? row.result.note.trim() : ''
                };
            });
        },
        previewOutcomeText() {
            const firstRow = Array.isArray(this.loadedRule?.rules) && this.loadedRule.rules.length > 0 ? this.loadedRule.rules[0] : null;
            const outcome = firstRow?.result?.outcome;
            return this.outcomeToText(outcome);
        },
        previewOutcomeNote() {
            const firstRow = Array.isArray(this.loadedRule?.rules) && this.loadedRule.rules.length > 0 ? this.loadedRule.rules[0] : null;
            const note = firstRow?.result?.note;
            const text = typeof note === 'string' ? note.trim() : '';
            return text || '';
        }
    },
    methods: {
        valueToText(value) {
            if (value === true) return '예';
            if (value === false) return '아니오';
            if (value === null || value === undefined) return '';
            return String(value).trim();
        },
        operatorToText(op) {
            // 기술 코드(gte/eq 등)를 UI에 노출하지 않고 사람 언어로만 표시
            switch (String(op || '')) {
                case 'gte':
                    return '이상';
                case 'lte':
                    return '이하';
                case 'eq':
                    return '같다';
                case 'neq':
                    return '다르다';
                case 'contains':
                    return '포함';
                case 'before':
                    return '이전';
                case 'after':
                    return '이후';
                default:
                    return '';
            }
        },
        outcomeToText(outcome) {
            switch (String(outcome || '')) {
                case 'approve':
                    return '승인';
                case 'conditional':
                    return '조건부 승인';
                case 'reject':
                    return '거절';
                default:
                    return '';
            }
        },
        notifyWarning(message) {
            // 공통 토스트/알럿 사용(기술 용어 금지)
            if (this.$try) {
                this.$try({ context: this, action: async () => {}, warningMsg: message });
            } else if (window.$app_) {
                window.$app_.snackbarMessage = message;
                window.$app_.snackbarColor = 'warning';
                window.$app_.snackbar = true;
            } else {
                alert(message);
            }
        },
        ensureCustomProperties() {
            if (!this.copyUengineProperties) this.copyUengineProperties = {};
            if (!Array.isArray(this.copyUengineProperties.customProperties)) {
                this.copyUengineProperties.customProperties = [];
            }
        },
        ensureEventSynchronization() {
            if (!this.copyUengineProperties) this.copyUengineProperties = {};
            if (!this.copyUengineProperties.eventSynchronization) this.copyUengineProperties.eventSynchronization = {};
            if (!this.copyUengineProperties.eventSynchronization.mappingContext) {
                this.copyUengineProperties.eventSynchronization.mappingContext = { mappingElements: [] };
            }
        },
        readCustomProperty(key) {
            try {
                const list = this.copyUengineProperties?.customProperties;
                if (!Array.isArray(list)) return null;
                const found = list.find((p) => p && p.key === key);
                return found ? found.value : null;
            } catch (e) {
                return null;
            }
        },
        upsertCustomProperty(key, value) {
            this.ensureCustomProperties();
            const list = this.copyUengineProperties.customProperties;
            const idx = list.findIndex((p) => p && p.key === key);
            const entry = { key, value };
            if (idx >= 0) list.splice(idx, 1, entry);
            else list.push(entry);
        },
        removeCustomProperty(key) {
            try {
                const list = this.copyUengineProperties?.customProperties;
                if (!Array.isArray(list)) return;
                const idx = list.findIndex((p) => p && p.key === key);
                if (idx >= 0) list.splice(idx, 1);
            } catch (e) {
                // ignore
            }
        },

        async loadRuleList() {
            this.isRuleListLoading = true;
            try {
                const list = await this.backend.listBusinessRules();
                this.ruleItems = Array.isArray(list) ? list : [];
            } catch (e) {
                this.ruleItems = [];
                this.notifyWarning(this.$t('businessRuleTaskPanel.ruleListLoadFailed'));
            } finally {
                this.isRuleListLoading = false;
            }
        },
        async refreshRuleList() {
            const keepRuleId = this.normalizeRuleId(this.selectedRuleId);
            await this.loadRuleList();
            // 새로 생성된 룰이 반영되도록 목록 갱신 후 선택된 룰도 다시 로드
            if (keepRuleId) {
                await this.loadRule(keepRuleId);
            }
        },
        async onRuleSelected(ruleId) {
            const normalized = this.normalizeRuleId(ruleId);
            this.selectedRuleId = normalized; // v-model 값도 id로 정규화
            if (!normalized) {
                this.selectedRuleName = '';
                this.loadedRule = null;
                this.isAdvancedPreview = false;
                this.dmnPreviewKey += 1;
                this.nodes = {};
                this.replaceFromExpandableNode = () => null;
                this.replaceToExpandableNode = () => null;
                return;
            }
            await this.loadRule(normalized);
        },
        async loadRule(ruleId) {
            const normalized = this.normalizeRuleId(ruleId);
            if (!normalized) return;
            this.isRuleLoading = true;
            try {
                const rule = await this.backend.getBusinessRule(normalized);
                if (!rule) {
                    this.notifyWarning(this.$t('businessRuleTaskPanel.ruleLoadFailed'));
                    return;
                }
                this.loadedRule = rule; // 내부 데이터로만 보관
                this.selectedRuleName = rule.name || '';
                // 룰 변경 시 DMN 미리보기 갱신
                this.dmnPreviewKey += 1;
                this.buildMapperIOFromRule(rule);
            } catch (e) {
                this.notifyWarning(this.$t('businessRuleTaskPanel.ruleLoadFailed'));
            } finally {
                this.isRuleLoading = false;
            }
        },
        normalizeRuleId(value) {
            if (value === null || value === undefined) return null;
            // v-autocomplete가 객체를 반환하는 경우 대비
            if (typeof value === 'object') {
                const id = value && (value.id ?? value.ruleId ?? value.value);
                if (id === null || id === undefined) return null;
                const s = String(id).trim();
                return s || null;
            }
            const s = String(value).trim();
            return s || null;
        },

        normalizeLabel(text) {
            const raw = String(text || '').trim();
            // Mapper 포트/경로에 점(.)이 들어가면 읽기 어려워질 수 있어, 사람이 읽기 좋은 형태로 정리
            return raw.replace(/\./g, ' ').replace(/\s+/g, ' ').trim();
        },
        normalizeKey(text) {
            const raw = String(text || '').trim();
            // 노드 key는 매핑 경로/식별자로 쓰이므로 가능한 안정적으로(구분자 '.' 제외) 만든다.
            // - 공백/특수문자 → '_'
            // - 연속 '_' 축소
            // - 빈 값은 fallback
            const safe = raw
                .replace(/\./g, ' ')
                .replace(/[^a-zA-Z0-9가-힣]+/g, '_')
                .replace(/_+/g, '_')
                .replace(/^_+|_+$/g, '');
            return safe || 'item';
        },
        makeUniqueLabel(base, existingSet) {
            let name = base;
            if (!name) name = this.$t('businessRuleTaskPanel.unnamedItem');
            if (!existingSet.has(name)) return name;
            let i = 2;
            while (existingSet.has(`${name} (${i})`)) i += 1;
            return `${name} (${i})`;
        },
        makeUniqueKey(base, existingSet) {
            let key = base || 'item';
            if (!existingSet.has(key)) return key;
            let i = 2;
            while (existingSet.has(`${key}_${i}`)) i += 1;
            return `${key}_${i}`;
        },
        buildMapperIOFromRule(rule) {
            try {
                // 표시 계층: 비즈니스 규칙 → (룰 이름) → 항목
                const brRootKey = 'businessRule';
                // NOTE: 이 라벨은 매퍼에서 "루트명"으로도 사용될 수 있어(운영/실행 연계),
                // 로케일에 따라 변하지 않도록 고정 문자열(영문)을 사용한다.
                const brRootText = 'BusinessRule';

                const nodes = {};
                nodes[brRootKey] = { text: brRootText, children: [], parent: null };

                // 2단계: 룰 이름(표시), key는 ruleId 기반으로 안정화
                const ruleId = rule?.id ? String(rule.id) : 'selected';
                // NOTE:
                // - 요청에 따라 rule node key의 br_ 접두사를 제거한다.
                // - 기존에 br_ 기반으로 저장된 매핑은 깨지는 것이 맞다(레거시 호환 제거).
                let ruleNodeKey = this.normalizeKey(ruleId);
                // ruleId가 숫자로 시작하면 경로 해석이 깨질 수 있어 최소 접두사를 붙인다.
                if (/^\d/.test(ruleNodeKey)) ruleNodeKey = `r_${ruleNodeKey}`;
                const ruleNodeText = this.normalizeLabel(rule?.name) || this.$t('businessRuleTaskPanel.unnamedItem');
                nodes[brRootKey].children.push(ruleNodeKey);
                nodes[ruleNodeKey] = { text: ruleNodeText, children: [], parent: brRootKey };

                const usedLabels = new Set();
                const usedKeys = new Set();
                const inputs = Array.isArray(rule?.inputs) ? rule.inputs : [];
                inputs.forEach((i) => {
                    const labelText = this.normalizeLabel(i?.label ?? i?.item);
                    const keyText = this.normalizeLabel(i?.key ?? i?.item);
                    const label = this.makeUniqueLabel(labelText, usedLabels);
                    usedLabels.add(label);

                    const keyBase = `in_${this.normalizeKey(keyText || label)}`;
                    const key = this.makeUniqueKey(keyBase, usedKeys);
                    usedKeys.add(key);

                    nodes[ruleNodeKey].children.push(key);
                    // leaf 노드는 children 속성을 만들지 않는다 (Mapper가 children 존재 여부로 roots를 늘려 중복 렌더링할 수 있음)
                    nodes[key] = { text: label, parent: ruleNodeKey };
                });

                // 결과는 고정 컬럼(outcome, note)만 노출
                const outcomeLabel = this.$t('businessRuleTaskPanel.mapperResultOutcome');
                const outcomeKey = this.makeUniqueKey('out_outcome', usedKeys);
                usedKeys.add(outcomeKey);
                nodes[ruleNodeKey].children.push(outcomeKey);
                nodes[outcomeKey] = { text: outcomeLabel, parent: ruleNodeKey };

                const noteLabel = this.$t('businessRuleTaskPanel.mapperResultNoteConditional');
                const noteKey = this.makeUniqueKey('out_note', usedKeys);
                usedKeys.add(noteKey);
                nodes[ruleNodeKey].children.push(noteKey);
                nodes[noteKey] = { text: noteLabel, parent: ruleNodeKey };

                this.nodes = nodes;

                // expandableTrees 경로 치환(외부 확장 방식)
                this.replaceFromExpandableNode = (nodeKey) => {
                    if (typeof nodeKey !== 'string') return null;
                    if (nodeKey.indexOf(`${brRootKey}.`) !== -1) return nodeKey.replace(`${brRootKey}.`, `[${brRootKey}].`);
                    return null;
                };
                this.replaceToExpandableNode = (nodeKey) => {
                    if (typeof nodeKey !== 'string') return null;
                    if (nodeKey.indexOf(`[${brRootKey}].`) !== -1) return nodeKey.replace(`[${brRootKey}].`, `${brRootKey}.`);
                    return null;
                };
            } catch (e) {
                this.nodes = {};
                this.replaceFromExpandableNode = () => null;
                this.replaceToExpandableNode = () => null;
                this.notifyWarning(this.$t('businessRuleTaskPanel.ioExtractFailed'));
            }
        },

        openInNewTab(path) {
            try {
                const href = this.$router?.resolve(path)?.href || path;
                window.open(href, '_blank');
            } catch (e) {
                // fallback: same-tab navigation
                this.$router.push(path);
            }
        },
        createNewRule() {
            // 사이드바가 아닌 패널 버튼은 "별도 탭"으로 열어야 한다.
            this.openInNewTab('/business-rule/new');
        },

        openMapperDialog() {
            if (!this.selectedRuleId) return;
            this.mappingDialog = true;
            // Mapper는 expandableTrees의 "children 존재" 노드를 roots로 올려 중복 표시될 수 있어,
            // 초기화(비동기) 완료 시점까지 몇 차례 재시도하며 parent===null 인 것만 roots로 유지하도록 외부에서 정리한다.
            this.$nextTick(() => {
                this.scheduleNormalizeMapperRoots();
            });
        },
        saveMapper(jsonString) {
            this.formMapperJson = jsonString;
            // 표준 저장 위치로 동기화
            this.ensureEventSynchronization();
            try {
                const parsed = JSON.parse(String(jsonString || ''));
                if (parsed && typeof parsed === 'object') {
                    this.copyUengineProperties.eventSynchronization.mappingContext = parsed;
                }
            } catch (e) {
                // 사용자에게 기술 정보 노출 금지: 공통 경고만
                this.notifyWarning(this.$t('businessRuleTaskPanel.ioExtractFailed'));
            }
            this.mappingDialog = false;
        },
        closeFormMapper() {
            this.mappingDialog = false;
        },
        normalizeMapperRoots() {
            // Mapper 내부 로직 수정 없이, 확장 주입 노드가 roots에 중복으로 올라가는 문제만 외부에서 보정
            const mapper = this.$refs.formMapper;
            if (!mapper || !mapper.config || !Array.isArray(mapper.config.roots)) return;

            const left = mapper.leftNodes || {};
            const right = mapper.rightNodes || {};
            const originalRoots = Array.from(new Set(mapper.config.roots)); // dedupe
            const normalized = originalRoots.filter((key) => {
                const node = left[key] || right[key];
                // 노드 정보가 없으면 일단 유지(기존 Mapper 기본 루트 등)
                if (!node) return true;
                return node.parent === null;
            });

            // 변경이 있을 때만 반영
            if (normalized.length !== originalRoots.length) {
                mapper.config.roots = normalized;
                // treeview 강제 갱신
                if (typeof mapper.renderKey === 'number') mapper.renderKey += 1;
            }
        },
        scheduleNormalizeMapperRoots() {
            // Mapper created()가 async로 nodes/roots를 구성하므로, 초기화 완료 시점까지 재시도
            let tries = 0;
            const maxTries = 12;
            const intervalMs = 120;

            const tick = () => {
                tries += 1;
                this.normalizeMapperRoots();

                const mapper = this.$refs.formMapper;
                const left = mapper?.leftNodes || {};
                const right = mapper?.rightNodes || {};
                const roots = Array.isArray(mapper?.config?.roots) ? mapper.config.roots : [];

                // "parent가 null이 아닌 노드가 roots에 남아있는지" 확인 → 남아있으면 계속 보정
                const hasBadRoot = roots.some((k) => {
                    const node = left[k] || right[k];
                    return node && node.parent !== null;
                });

                if (!hasBadRoot || tries >= maxTries) return;
                setTimeout(tick, intervalMs);
            };

            setTimeout(tick, intervalMs);
        },

        beforeSave() {
            // 기존 저장 흐름과의 연결만 수행 (UI에 기술 개념 노출 금지)
            // UserTaskPanel처럼 _type 을 명시적으로 세팅
            this.copyUengineProperties._type = 'org.uengine.kernel.bpmn.BusinessRuleTask';

            // businessRuleId는 최상위(copyUengineProperties)에 저장
            if (this.selectedRuleId) {
                this.copyUengineProperties.businessRuleId = this.selectedRuleId;
            } else if (this.copyUengineProperties.businessRuleId) {
                delete this.copyUengineProperties.businessRuleId;
            }

            // 매핑은 eventSynchronization.mappingContext에 저장(기존 패턴 재사용)
            this.ensureEventSynchronization();
            if (this.formMapperJson) {
                try {
                    const parsed = JSON.parse(String(this.formMapperJson));
                    if (parsed && typeof parsed === 'object') {
                        this.copyUengineProperties.eventSynchronization.mappingContext = parsed;
                    }
                } catch (e) {
                    // ignore
                }
            }

            // 중간 버전에서 eventSynchronization에 저장했던 값이 남아있으면 제거(단일 소스 유지)
            if (this.copyUengineProperties?.eventSynchronization?.businessRuleId) {
                delete this.copyUengineProperties.eventSynchronization.businessRuleId;
            }
            // 레거시 값은 혼동 방지를 위해 제거(표준 저장 위치로 이관됨)
            this.removeCustomProperty('businessRuleMapping');
            this.removeCustomProperty('businessRuleId');

            // UserTaskPanel과 동일한 저장 패턴:
            // - 꼭 필요한 필드만 남기고 나머지는 제거하여 저장 payload를 안정화한다.
            const { eventSynchronization, businessRuleId, _type } = this.copyUengineProperties || {};
            const compact = { eventSynchronization, businessRuleId, _type };

            this.copyUengineProperties = compact;
            this.$emit('update:uengineProperties', this.copyUengineProperties);
        }
    }
};
</script>

<style scoped>
.br-preview-rule-card {
    /* 회색 톤(tornal) 대신, 다른 카드들과 어울리는 밝은 톤 */
    background: #fff;
    border-color: rgba(0, 0, 0, 0.08);
    border-radius: 12px;
}
.br-preview-rule-hint {
    font-size: 12px;
    line-height: 1.2;
}
.rule-preview-table :deep(th),
.rule-preview-table :deep(td) {
    padding: 6px 10px;
    vertical-align: middle;
}
.rule-preview-table :deep(th) {
    font-weight: 700;
    font-size: 12px;
}

.br-advanced-preview {
    height: 420px;
    overflow: hidden;
}
.br-advanced-preview :deep(.vue-dmn-diagram-container) {
    height: 100%;
}

.br-advanced-toggle {
    margin-left: 8px; /* 스페이서 다음 요소가 오른쪽에 붙되, 타이틀과는 적당히 간격 */
}
</style>
