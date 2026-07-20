<template>
    <div>
        <v-tabs v-model="activeTab" class="pl-4 pr-4">
            <v-tab value="setting">{{ $t('BpmnPropertyPanel.setting') }}</v-tab>
            <v-tab value="edit">{{ $t('BpmnPropertyPanel.edit') }}</v-tab>
            <v-tab value="preview">{{ $t('BpmnPropertyPanel.preview') }}</v-tab>
        </v-tabs>
        <v-window v-model="activeTab">
            <v-window-item value="setting" class="pa-4">
                <!-- Description -->
                <Description v-model="copyUengineProperties.description" class="mb-4"></Description>

                <!-- Instruction -->
                <Instruction
                    v-model="copyUengineProperties.instruction"
                    :mention-candidates="mentionCandidates"
                    :isViewMode="isViewMode"
                    class="mb-4"
                ></Instruction>
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
import { useBpmnStore } from '@/stores/bpmn';
import Description from '@/components/designer/DescriptionField.vue';
import Instruction from '@/components/designer/InstructionField.vue';
import BackendFactory from '@/components/api/BackendFactory';

import { defineAsyncComponent } from 'vue';
const FormDefinition = defineAsyncComponent(() => import('@/components/FormDefinition.vue'));

export default {
    name: 'gpt-ad-hoc-sub-process-panel',
    components: {
        Description,
        Instruction,
        FormDefinition
    },
    props: {
        uengineProperties: Object,
        isViewMode: Boolean,
        element: Object,
        processDefinitionId: String,
        processDefinition: Object,
        definition: Object
    },
    data() {
        return {
            calleeDefinitionRoles: [],
            copyUengineProperties: JSON.parse(JSON.stringify(this.uengineProperties)),
            mentionCandidates: [],
            bpmnModeler: null,
            backend: null,
            activeTab: 'setting',
            formId: '',
            tempFormHtml: ''
        };
    },
    async mounted() {
        let me = this;
        const store = useBpmnStore();
        this.bpmnModeler = store.getModeler;
        let def = this.bpmnModeler.getDefinitions();
        const processElement = def.rootElements.filter((element) => element.$type === 'bpmn:Process');
        if (!processElement) {
            console.error('bpmn:Process element not found');
            return;
        }
        processElement.forEach((process) => {
            (process.laneSets || []).forEach((laneSet) => {
                (laneSet.lanes || []).forEach((lane) => {
                    if (lane?.name?.length > 0) me.calleeDefinitionRoles.push(lane.name);
                });
            });
        });

        this.backend = BackendFactory.createBackend();
        await this.init();
    },
    watch: {
        activeTab(newVal, oldVal) {
            // 폼 편집 탭에서 나갈 때 HTML 저장
            if (newVal !== oldVal && oldVal === 'edit' && this.$refs.formDefinitionEdit) {
                this.tempFormHtml = this.$refs.formDefinitionEdit.getFormHTML();
            }
        }
    },
    methods: {
        // 서브프로세스의 formId 결정 및 폼 로딩 (GPTUserTaskPanel과 동일한 우선순위: 메모리 draft -> DB -> defaultform)
        async init() {
            const me = this;

            const subProcessFromDefinition =
                me.processDefinition && Array.isArray(me.processDefinition.subProcesses)
                    ? me.processDefinition.subProcesses.find((sp) => sp.id === me.element?.id)
                    : null;
            const currentTool = me.copyUengineProperties?.tool || subProcessFromDefinition?.tool || 'formHandler:defaultform';

            me.formId = currentTool && currentTool.includes('formHandler:') ? currentTool.replace('formHandler:', '') : '';
            if (!me.formId) {
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
                    activity_id: me.element.id
                }
            };

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
        },
        beforeSave() {
            const me = this;

            if (me.$refs.formDefinitionEdit && me.activeTab === 'edit') {
                me.tempFormHtml = me.$refs.formDefinitionEdit.getFormHTML();
            }

            // defaultform을 수정 저장하면 요소 전용 폼 ID로 승격 (GPTUserTaskPanel과 동일한 규칙)
            if (me.formId === 'defaultform' && me.tempFormHtml) {
                const normalizeIdPart = (id) => (id || '').toString().toLowerCase().replace(/[/.]/g, '_').replace(/#/g, '_');
                const procId = normalizeIdPart(me.processDefinition?.processDefinitionId || me.processDefinitionId);
                const elementId = normalizeIdPart(me.element?.id);
                if (procId && elementId) {
                    me.formId = `${procId}_${elementId}_form`;
                }
            }

            if (me.tempFormHtml && me.processDefinition) {
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

            const tool = `formHandler:${me.formId}`;

            // 패널 재오픈 시 값이 되돌아가지 않도록 processDefinition.subProcesses에도 즉시 동기화
            if (me.processDefinition && Array.isArray(me.processDefinition.subProcesses)) {
                const targetSubProcess = me.processDefinition.subProcesses.find((sp) => sp.id === me.element?.id);
                if (targetSubProcess) {
                    targetSubProcess.tool = tool;
                }
            }

            const props = {
                ...me.copyUengineProperties,
                description: me.copyUengineProperties.description || '',
                instruction: me.copyUengineProperties.instruction || '',
                tool
            };
            me.copyUengineProperties = props;
            me.$emit('update:uengineProperties', props);
            me.$emit('update:processDefinition', me.processDefinition);
        }
    }
};
</script>
