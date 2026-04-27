<template>
    <div>
        <v-tabs v-model="activeTab" class="pl-4 pr-4">
            <v-tab value="setting">{{ $t('BpmnPropertyPanel.setting') }}</v-tab>
            <v-tab value="inputData">{{ $t('BpmnPropertyPanel.referenceInfo') }}</v-tab>
            <v-tab value="edit">{{ $t('BpmnPropertyPanel.edit') }}</v-tab>
            <v-tab value="preview">{{ $t('BpmnPropertyPanel.preview') }}</v-tab>
        </v-tabs>
        <v-window v-model="activeTab">
            <v-window-item value="setting" class="pa-4">
                <!-- Business ID (Phase 4-2, read-only) -->
                <v-text-field
                    v-if="activity.businessId"
                    :model-value="activity.businessId"
                    :label="$t('businessId.readOnly')"
                    density="compact"
                    variant="outlined"
                    hide-details
                    readonly
                    prepend-inner-icon="mdi-identifier"
                    class="mb-4"
                />

                <!-- Description -->
                <Description v-model="activity.description" class="mb-4"></Description>

                <!-- AI Summary Button (Phase 2-6) -->
                <v-btn
                    v-if="!isViewMode"
                    size="small"
                    variant="tonal"
                    color="primary"
                    class="mb-4"
                    :loading="isGeneratingSummary"
                    @click="generateAISummary"
                >
                    <v-icon start size="16">mdi-auto-fix</v-icon>
                    {{ $t('processSummary.generateSummary') }}
                </v-btn>

                <!-- Instruction -->
                <Instruction v-model="activity.instruction" :mention-candidates="mentionCandidates" :isViewMode="isViewMode" class="mb-4"></Instruction>

                <v-divider class="mb-2"></v-divider>

                <!-- Checkpoints -->
                <Checkpoints v-model="activity.checkpoints" class="user-task-panel-check-points mb-2"></Checkpoints>

                <v-divider class="mb-4"></v-divider>

                <!-- Attachments -->
                <!-- <div>
                    <v-file-input
                        :label="$t('BpmnPropertyPanel.attachments')"
                        multiple
                        class="mb-4"
                        @update:modelValue="onFileChange"
                    ></v-file-input>
                    <div v-if="activity.attachments && activity.attachments.length > 0">
                        <div v-for="(attachment, index) in activity.attachments" :key="index">
                            <div class="d-flex align-center cursor-pointer">
                                <v-icon @click="openFile(attachment)">mdi-file-document-outline</v-icon>
                                <div class="ml-2 mr-auto" @click="openFile(attachment)">{{ attachment.replace('uploads/', '') }}</div>
                                <v-icon v-if="!isViewMode" @click="activity.attachments = activity.attachments.filter(a => a !== attachment)">mdi-delete-outline</v-icon>
                            </div>
                        </div>
                    </div>
                </div> -->

                <AgentSelectField
                    v-model="activity"
                    :backend="backend"
                    @update:modelValue="(newVal) => (activity = newVal)"
                    class="mb-4"
                ></AgentSelectField>

                <v-divider class="mb-4"></v-divider>

                <!-- Custom Properties (Key-Value) -->
                <KeyValueField
                    v-model="activity.customProperties"
                    :label="$t('BpmnPropertyPanel.customProperties') || '사용자 속성'"
                    :readonly="isViewMode"
                    class="mb-4"
                ></KeyValueField>
            </v-window-item>

            <!-- Input Data -->
            <v-window-item value="inputData" class="pa-4">
                <div class="my-4">
                    <v-select
                        v-model="selectedForms"
                        :items="availableForms"
                        item-title="title"
                        item-value="formId"
                        :label="$t('BpmnPropertyPanel.selectForm')"
                        variant="outlined"
                        density="compact"
                        multiple
                        chips
                        closable-chips
                    ></v-select>
                </div>
                <!-- Form Fields -->
                <div v-if="selectedForms.length > 0">
                    <v-card v-for="formId in selectedForms" :key="formId" class="mb-4" variant="outlined">
                        <v-card-text class="pa-4">
                            <div class="mb-3 text-subtitle-1">{{ getFormTitle(formId) }}</div>
                            <v-row>
                                <v-col
                                    cols="12"
                                    lg="6"
                                    md="6"
                                    sm="12"
                                    v-for="field in getFormFields(formId)"
                                    :key="`${formId}-${field.fieldId}`"
                                >
                                    <v-checkbox
                                        v-model="field.selected"
                                        :label="field.fieldName"
                                        density="compact"
                                        hide-details
                                    ></v-checkbox>
                                </v-col>
                            </v-row>
                        </v-card-text>
                    </v-card>
                </div>
                <!-- No form selected message -->
                <div v-else class="text-center text-grey-500 py-8">
                    {{ $t('BpmnPropertyPanel.noFormSelected') }}
                </div>
            </v-window-item>

            <v-window-item value="edit">
                <FormDefinition ref="formDefinitionEdit" type="edit" :formId="formId" v-model="tempFormHtml" />
            </v-window-item>
            <v-window-item value="preview">
                <FormDefinition ref="formDefinitionPreview" type="preview" :formId="formId" v-model="tempFormHtml" />
            </v-window-item>
        </v-window>
    </div>
</template>

<script>
import Instruction from '@/components/designer/InstructionField.vue';
import Checkpoints from '@/components/designer/CheckpointsField.vue';
import Description from '@/components/designer/DescriptionField.vue';
import AgentSelectField from '@/components/ui/field/AgentSelectField.vue';
import KeyValueField from '@/components/designer/KeyValueField.vue';
import ManualLinkField from '@/components/ui/ManualLinkField.vue';

import { defineAsyncComponent } from 'vue';
const FormDefinition = defineAsyncComponent(() => import('@/components/FormDefinition.vue'));

import BackendFactory from '@/components/api/BackendFactory';
import ProcessSummaryGenerator from '@/components/ai/ProcessSummaryGenerator.js';

export default {
    name: 'gpt-user-task-panel',
    components: {
        Instruction,
        Checkpoints,
        Description,
        FormDefinition,
        AgentSelectField,
        KeyValueField,
        ManualLinkField
    },
    props: {
        uengineProperties: Object,
        processDefinitionId: String,
        processDefinition: Object,
        element: Object,
        isViewMode: Boolean,
        isPreviewMode: Boolean,
        roles: Array,
        variableForHtmlFormContext: Object,
        definition: Object,
        name: String
    },
    data() {
        return {
            copyUengineProperties: JSON.parse(JSON.stringify(this.uengineProperties)),
            copyDefinition: null,
            backend: null,
            activity: {
                role: '',
                duration: 5,
                attachments: [],
                instruction: '',
                description: '',
                checkpoints: [''],
                agent: '',
                agentMode: 'none',
                orchestration: null,
                tool: '',
                inputData: [],
                customProperties: [],
                systemName: '',
                menuName: '',
                futureStatus: null,
                costType: 'FTE',
                contractCost: null,
                unitPrice: null,
                hitlEnabled: false,
                hitlCapabilities: [],
                tools: [],
                skills: []
            },
            isGeneratingSummary: false,
            formId: '',
            tempFormHtml: '',
            activeTab: 'setting',
            fieldsJson: [],
            selectedForms: [],
            availableForms: [],
            formFields: {},
            mentionCandidates: []
        };
    },
    created() {
        this.backend = BackendFactory.createBackend();

        if (this.element.lanes?.length > 0) {
            this.activity.role = this.element.lanes[0].name;
            // Phase 2-3: Auto-set costType based on lane
            const laneName = this.element.lanes[0].name || '';
            if (/외부|external|협력사/i.test(laneName)) {
                this.activity.costType = 'OPEX';
            }
        }

        // processDefinition에서 기본값 설정 (편집 내용이 사라진 경우 폴백 처리)
        if (this.processDefinition && this.processDefinition.activities && this.processDefinition.activities.length > 0) {
            const activity = this.processDefinition.activities.find((activity) => activity.id === this.element.id);
            if (activity) {
                this.activity = { ...this.activity, ...activity };
            }
        }

        // copyUengineProperties로 덮어쓰기 (편집된 최신 내용)
        if (this.copyUengineProperties) {
            if (this.copyUengineProperties.duration !== undefined) this.activity.duration = this.copyUengineProperties.duration;
            if (this.copyUengineProperties.description !== undefined) this.activity.description = this.copyUengineProperties.description;
            if (this.copyUengineProperties.instruction !== undefined) this.activity.instruction = this.copyUengineProperties.instruction;
            if (this.copyUengineProperties.checkpoints !== undefined) this.activity.checkpoints = this.copyUengineProperties.checkpoints;
            if (this.copyUengineProperties.agent !== undefined) this.activity.agent = this.copyUengineProperties.agent;
            if (this.copyUengineProperties.agentMode !== undefined) this.activity.agentMode = this.copyUengineProperties.agentMode;
            if (this.copyUengineProperties.orchestration !== undefined && this.copyUengineProperties.orchestration !== 'none')
                this.activity.orchestration = this.copyUengineProperties.orchestration;
            if (this.copyUengineProperties.attachments !== undefined) this.activity.attachments = this.copyUengineProperties.attachments;
            if (this.copyUengineProperties.inputData !== undefined) this.activity.inputData = this.copyUengineProperties.inputData;
            // tool의 기준은 processDefinition.activities이며, uengineProperties.tool은 보조값으로만 사용
            if (this.copyUengineProperties.tool !== undefined && !this.activity.tool) this.activity.tool = this.copyUengineProperties.tool;
            if (this.copyUengineProperties.customProperties !== undefined)
                this.activity.customProperties = this.copyUengineProperties.customProperties;
            if (this.copyUengineProperties.systemName !== undefined) this.activity.systemName = this.copyUengineProperties.systemName;
            if (this.copyUengineProperties.menuName !== undefined) this.activity.menuName = this.copyUengineProperties.menuName;
            if (this.copyUengineProperties.manualLinks !== undefined) this.activity.manualLinks = this.copyUengineProperties.manualLinks;
            if (this.copyUengineProperties.businessId !== undefined) this.activity.businessId = this.copyUengineProperties.businessId;
            if (this.copyUengineProperties.tools !== undefined) this.activity.tools = this.copyUengineProperties.tools;
            if (this.copyUengineProperties.skills !== undefined) this.activity.skills = this.copyUengineProperties.skills;
        }

        this.normalizeActivityMcpSkillArrays();

        if (this.activity.inputData) {
            const formIds = [
                ...new Set(
                    this.activity.inputData.map((item) => {
                        return item.split('.')[0];
                    })
                )
            ];
            this.selectedForms = formIds;
        }
    },
    async mounted() {
        let me = this;
        await me.init();
        await me.loadMentionCandidates();
    },
    computed: {
        lastPath() {
            if (this.$route.path == '/definition-map') {
                return 'definition-map';
            }
            if (this.$route.path.includes('/definition-map/sub/') && this.$route.params.id) {
                return this.$route.params.id;
            }
            if (this.$route.params && this.$route.params.pathMatch && this.$route.params.pathMatch.length > 0) {
                return this.$route.params.pathMatch[this.$route.params.pathMatch.length - 1];
            }
            return null;
        }
    },
    watch: {
        activeTab: {
            deep: true,
            async handler(newVal, oldVal) {
                if (newVal !== oldVal) {
                    // 폼 편집 탭에서 나갈 때 HTML 저장
                    if (oldVal === 'edit' && this.$refs.formDefinitionEdit) {
                        this.tempFormHtml = this.$refs.formDefinitionEdit.getFormHTML();
                    }

                    // 참조정보 탭으로 들어갈 때 이전 폼 목록 로드
                    if (newVal === 'inputData') {
                        await this.getPreviousForms();
                    }
                }
            }
        },
        availableForms(newVal) {
            if (newVal.length > 0) {
                this.formFields = {};
                newVal.forEach((form) => {
                    this.formFields[form.formId] = [];
                    form.fields.forEach((field) => {
                        if (!this.activity.inputData) {
                            this.activity.inputData = [];
                        }
                        const selected = this.activity.inputData.includes(`${form.formId}.${field.key}`);
                        this.formFields[form.formId].push({
                            fieldId: field.key,
                            fieldName: field.text,
                            selected: selected
                        });
                    });
                });
            }
        },
        selectedForms: {
            deep: true,
            handler() {
                this.updateInputData();
            }
        },
        formFields: {
            deep: true,
            handler() {
                this.updateInputData();
            }
        }
    },
    computed: {
        // Phase 2-2: Future Status options
        futureStatusOptions() {
            return [
                { title: this.$t('futureStatus.maintain'), value: 'maintain' },
                { title: this.$t('futureStatus.sunset'), value: 'sunset' },
                { title: this.$t('futureStatus.new'), value: 'new' },
                { title: this.$t('futureStatus.automation_planned'), value: 'automation_planned' }
            ];
        },
        // Phase 2-3: Check if lane is external
        isExternalLane() {
            const laneName = this.element?.lanes?.[0]?.name || '';
            return /외부|external|협력사/i.test(laneName);
        },
        // Phase 2-4: Available capabilities (static list, can be extended)
        availableCapabilities() {
            return [
                'Data Analysis',
                'Decision Making',
                'Exception Handling',
                'Customer Communication',
                'Quality Review',
                'Compliance Check',
                'Technical Expertise',
                'Process Improvement'
            ];
        }
    },
    methods: {
        normalizeActivityMcpSkillArrays() {
            if (!Array.isArray(this.activity.tools)) this.activity.tools = [];
            if (!Array.isArray(this.activity.skills)) this.activity.skills = [];
        },
        // Phase 2-6: AI Summary generation
        async generateAISummary() {
            this.isGeneratingSummary = true;
            try {
                const { useBpmnStore } = await import('@/stores/bpmn');
                const store = useBpmnStore();
                const modeler = store.getModeler;
                if (!modeler) return;

                const elementRegistry = modeler.get('elementRegistry');
                const elements = elementRegistry.getAll();
                const elementsText = elements
                    .filter((el) => el.type && (el.type.includes('Task') || el.type.includes('Event') || el.type.includes('Gateway')))
                    .map((el) => `[${el.type.replace('bpmn:', '')}] ${el.businessObject?.name || el.id}`)
                    .join('\n');

                const generator = new ProcessSummaryGenerator(
                    {
                        onModelCreated: () => {},
                        onGenerationFinished: (result) => {
                            if (result) {
                                this.activity.description = typeof result === 'string' ? result : result.text || '';
                            }
                            this.isGeneratingSummary = false;
                        },
                        onModelStopped: () => {
                            this.isGeneratingSummary = false;
                        }
                    },
                    { elementsText, preferredLanguage: window.countryCode === 'ko' ? 'Korean' : 'English' }
                );

                await generator.generate();
            } catch (e) {
                console.error('[GPTUserTaskPanel] generateAISummary error:', e);
                this.isGeneratingSummary = false;
            }
        },
        async loadMentionCandidates() {
            const candidates = [];

            // Agents
            try {
                if (this.backend && this.backend.getAgentList) {
                    const agents = await this.backend.getAgentList();
                    if (Array.isArray(agents)) {
                        agents.forEach((agent) => {
                            if (!agent) return;

                            // 기본 LLM(숨김 기본 에이전트)은 멘션 후보에서 제외
                            const username = (agent.username || '').toString();
                            const isHiddenDefault = agent.is_hidden === true || (agent.is_default === true && username === '기본 LLM');
                            if (isHiddenDefault) return;

                            const id = agent.id || agent.user_id || agent.uid;
                            if (!id) return;
                            const label = (agent.username || agent.name || agent.alias || agent.email || id).toString();
                            const description = (agent.goal || agent.description || '').toString();
                            candidates.push({
                                id: String(id),
                                type: 'agent',
                                label,
                                description
                            });
                        });
                    }
                }
            } catch (error) {
                // 에이전트 목록 조회 실패 시 로깅만 수행 (기능은 계속 동작)
                // eslint-disable-next-line no-console
                console.error('[GPTUserTaskPanel] loadMentionCandidates - getAgentList error', error);
            }

            // Skills
            try {
                if (this.backend && this.backend.getTenantSkills && window.$tenantName) {
                    const result = await this.backend.getTenantSkills(window.$tenantName);
                    const tenantSkills = result && result.skills;
                    const list = Array.isArray(tenantSkills) ? tenantSkills : (tenantSkills && tenantSkills.skills) || [];

                    list.forEach((skill) => {
                        if (!skill) return;
                        const name = skill.name || skill.skill_name;
                        if (!name) return;
                        const description = (skill.description || '').toString();
                        candidates.push({
                            id: String(name),
                            type: 'skill',
                            label: String(name),
                            description
                        });
                    });
                }
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error('[GPTUserTaskPanel] loadMentionCandidates - getTenantSkills error', error);
            }

            // Activities
            try {
                const pd = this.processDefinition;
                if (pd && Array.isArray(pd.activities)) {
                    pd.activities.forEach((act) => {
                        if (!act || !act.id) return;
                        const label = (act.name || act.activityName || act.displayName || act.id).toString();
                        const description = (act.description || '').toString();
                        candidates.push({
                            id: String(act.id),
                            type: 'activity',
                            label,
                            description
                        });
                    });
                }
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error('[GPTUserTaskPanel] loadMentionCandidates - activities error', error);
            }

            this.mentionCandidates = candidates;
        },
        async init() {
            var me = this;
            if (me.isPreviewMode) {
                me.activeTab = 'preview';
            }

            // 패널 로드시 tool 기준을 processDefinition.activities 값으로 재정렬
            const activityFromDefinition =
                me.processDefinition && Array.isArray(me.processDefinition.activities)
                    ? me.processDefinition.activities.find((activity) => activity.id === me.element.id)
                    : null;
            if (activityFromDefinition) {
                me.activity = { ...me.activity, ...activityFromDefinition };
            }
            me.normalizeActivityMcpSkillArrays();

            me.formId =
                me.activity.tool != '' && me.activity.tool.includes('formHandler:') ? me.activity.tool.replace('formHandler:', '') : '';
            if (!me.formId || me.formId == '') {
                let formId = '';
                if (!me.processDefinition || !me.processDefinition.processDefinitionId) {
                    formId = me.element.id + '_form';
                } else {
                    formId = me.processDefinition.processDefinitionId + '_' + me.element.id + '_form';
                }
                formId = formId.toLowerCase().replace(/[/.]/g, '_');
                me.formId = formId;
            }

            const options = {
                type: 'form',
                match: {
                    proc_def_id: me.processDefinitionId,
                    activity_id: me.activity.id
                }
            };

            // 폼 로딩 우선순위 통일:
            // 1) 메모리 임시본(formDrafts) -> 2) DB(formId) -> 3) defaultform
            const formDrafts = Array.isArray(me.processDefinition?.formDrafts) ? me.processDefinition.formDrafts : [];
            const inMemoryDraft =
                formDrafts.find((draft) => draft?.activity_id === me.element.id && draft?.id === me.formId) ||
                formDrafts.find((draft) => draft?.activity_id === me.element.id);

            if (inMemoryDraft && inMemoryDraft.html) {
                me.tempFormHtml = inMemoryDraft.html;
            } else {
                me.tempFormHtml =
                    me.formId === 'defaultform'
                        ? await me.backend.getRawDefinition(me.formId, { type: 'form' })
                        : await me.backend.getRawDefinition(me.formId, options);
            }

            if (!me.tempFormHtml) {
                me.tempFormHtml = await me.backend.getRawDefinition('defaultform', { type: 'form' });
            }

            me.copyDefinition = me.definition;
        },
        async beforeSave() {
            var me = this;

            if (me.$refs.formDefinitionEdit && me.activeTab == 'edit') {
                me.tempFormHtml = me.$refs.formDefinitionEdit.getFormHTML();
            }

            // 저장 시 규칙 통일:
            // - defaultform을 수정 저장하면 activity 전용 폼 ID로 승격
            // - tool도 같은 ID로 즉시 갱신
            if (me.formId === 'defaultform') {
                const normalizeIdPart = (id) => (id || '').toString().toLowerCase().replace(/[/.]/g, '_').replace(/#/g, '_');
                const procId = normalizeIdPart(me.processDefinition?.processDefinitionId || me.processDefinitionId);
                const activityId = normalizeIdPart(me.element?.id);
                if (procId && activityId) {
                    me.formId = `${procId}_${activityId}_form`;
                }
            }

            if (me.tempFormHtml && me.tempFormHtml != '') {
                if (!Array.isArray(me.processDefinition.formDrafts)) {
                    me.processDefinition.formDrafts = [];
                }
                const draft = {
                    id: me.formId,
                    html: me.tempFormHtml,
                    proc_def_id: me.processDefinition?.processDefinitionId || me.processDefinitionId || '',
                    activity_id: me.element.id
                };
                const existingIndex = me.processDefinition.formDrafts.findIndex((item) => item && item.activity_id === me.element.id);
                if (existingIndex > -1) {
                    me.processDefinition.formDrafts[existingIndex] = draft;
                } else {
                    me.processDefinition.formDrafts.push(draft);
                }
            }
            me.activity.tool = `formHandler:${me.formId}`;

            // processDefinition 활동 정보에도 tool 동기화
            if (me.processDefinition && Array.isArray(me.processDefinition.activities)) {
                const targetActivity = me.processDefinition.activities.find((activity) => activity.id === me.element.id);
                if (targetActivity) {
                    // 패널 재오픈 시(created()에서 processDefinition.activities를 먼저 merge) 값이 되돌아가지 않도록
                    // 현재 activity 상태를 processDefinition.activities에도 동기화한다.
                    targetActivity.role = me.activity.role || '';
                    targetActivity.duration = me.activity.duration;
                    targetActivity.description = me.activity.description || '';
                    targetActivity.instruction = me.activity.instruction || '';
                    targetActivity.checkpoints = Array.isArray(me.activity.checkpoints) ? [...me.activity.checkpoints] : [];

                    targetActivity.agent = me.activity.agent || null;
                    targetActivity.agentMode = me.activity.agentMode || null;
                    targetActivity.orchestration = me.activity.orchestration || null;

                    targetActivity.attachments = Array.isArray(me.activity.attachments) ? [...me.activity.attachments] : [];
                    targetActivity.inputData = Array.isArray(me.activity.inputData) ? [...me.activity.inputData] : [];
                    targetActivity.customProperties = Array.isArray(me.activity.customProperties) ? [...me.activity.customProperties] : [];

                    targetActivity.systemName = me.activity.systemName || '';
                    targetActivity.menuName = me.activity.menuName || '';
                    if (me.activity.businessId !== undefined) targetActivity.businessId = me.activity.businessId;

                    targetActivity.tool = me.activity.tool;
                    targetActivity.tools = Array.isArray(me.activity.tools) ? [...me.activity.tools] : [];
                    targetActivity.skills = Array.isArray(me.activity.skills) ? [...me.activity.skills] : [];
                }
            }

            if (me.activity.checkpoints && me.activity.checkpoints.join() == '') {
                me.activity.checkpoints = [];
            }

            // 편집 내용을 uengineProperties로 전달
            me.copyUengineProperties = {
                role: me.activity.role,
                duration: me.activity.duration,
                instruction: me.activity.instruction,
                description: me.activity.description,
                checkpoints: me.activity.checkpoints,
                agent: me.activity.agent,
                agentMode: me.activity.agentMode,
                orchestration: me.activity.orchestration,
                attachments: me.activity.attachments,
                inputData: me.activity.inputData,
                tool: me.activity.tool,
                customProperties: me.activity.customProperties,
                systemName: me.activity.systemName,
                menuName: me.activity.menuName,
                tools: Array.isArray(me.activity.tools) ? [...me.activity.tools] : [],
                skills: Array.isArray(me.activity.skills) ? [...me.activity.skills] : []
            };

            me.$emit('update:uengineProperties', me.copyUengineProperties);
            me.$emit('update:processDefinition', me.processDefinition);
        },
        onFileChange(files) {
            var me = this;
            if (!me.activity.attachments) {
                me.activity.attachments = [];
            }
            if (files && files.length > 0) {
                files.forEach(async (file) => {
                    const data = await me.backend.uploadFile(file.name, file);
                    if (data && data.path) {
                        me.activity.attachments.push(data.path);
                    }
                });
            }
            me.$emit('update:processDefinition', me.processDefinition);
        },
        async openFile(path) {
            const downloadUrl = await this.backend.getFileUrl(path);
            window.open(downloadUrl, '_blank');
        },

        getPreviousForms() {
            var me = this;
            this.$try({
                context: me,
                action: async () => {
                    // EventBus를 통해 최신 processDefinition을 가져와서 바로 처리
                    me.EventBus.emit('get-process-definition', async (processDefinition) => {
                        console.log('[GPTUserTaskPanel] 콜백 수신:', processDefinition);

                        if (!processDefinition || !processDefinition.activities) {
                            console.error('[GPTUserTaskPanel] processDefinition이 비어있거나 activities가 없습니다.');
                            return;
                        }

                        const prevForms = await me.backend.getPreviousForms(me.element.id, processDefinition);
                        console.log('[GPTUserTaskPanel] 조회된 이전 폼:', prevForms);

                        me.availableForms = prevForms.map((form) => {
                            return {
                                formId: form.id,
                                title: form.title,
                                fields: form.fields_json || []
                            };
                        });
                    });
                }
            });
        },
        updateInputData() {
            if (this.availableForms.length == 0) {
                return;
            }

            const inputData = [];
            this.selectedForms.forEach((formId) => {
                if (this.formFields[formId]) {
                    this.formFields[formId].forEach((field) => {
                        if (field.selected) {
                            inputData.push(`${formId}.${field.fieldId}`);
                        }
                    });
                }
            });

            this.activity.inputData = inputData;
        },
        getFormTitle(formId) {
            if (this.availableForms.length == 0) {
                return formId;
            }
            return this.availableForms.find((form) => form.formId === formId).title;
        },
        getFormFields(formId) {
            if (this.formFields.length == 0) {
                return [];
            }
            return this.formFields[formId];
        }
    }
};
</script>

<style scoped>
.gpt-user-task-panel {
    margin: -16px;
}

.select-icon {
    padding-right: 16px !important;
}

.divider-top {
    border-top: 1px solid rgba(0, 0, 0, 0.12);
    margin-top: 8px !important;
    padding-top: 16px !important;
}

.meta-info {
    display: flex;
    gap: 12px;
    font-size: 12px;
    color: rgba(0, 0, 0, 0.6);
}

.meta-item {
    display: inline-block;
}
</style>
