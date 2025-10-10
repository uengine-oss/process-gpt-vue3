<template>
    
    <div>
        <v-tabs v-model="activeTab"
            class="pl-4 pr-4"
        >
            <v-tab value="setting">{{ $t('BpmnPropertyPanel.setting') }}</v-tab>
            <v-tab value="inputData">{{ $t('BpmnPropertyPanel.referenceInfo') }}</v-tab>
            <v-tab value="edit">{{ $t('BpmnPropertyPanel.edit') }}</v-tab>
            <v-tab value="preview">{{ $t('BpmnPropertyPanel.preview') }}</v-tab>
        </v-tabs>
        <v-window v-model="activeTab">
            <v-window-item value="setting" class="pa-4">
                <div class="mb-4">{{ $t('BpmnPropertyPanel.role') }}: {{ copyUengineProperties.role ? copyUengineProperties.role.name : '' }}</div>
                <!-- <v-text-field v-model="name" label="이름" autofocus class="mb-4"></v-text-field> -->
                <!-- Duration -->
                <v-text-field v-model="activity.duration" :label="$t('BpmnPropertyPanel.duration')" :suffix="$t('BpmnPropertyPanel.days')" type="number" class="mb-4"></v-text-field>
                <!-- Instruction -->
                <Instruction v-model="activity.instruction" class="mb-4"></Instruction>
                <!-- Description -->
                <Description v-model="activity.description" class="mb-4"></Description>
                <!-- Checkpoints -->
                <Checkpoints v-model="activity.checkpoints" class="user-task-panel-check-points mb-4"></Checkpoints>
                <!-- Attachments -->
                <div>
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
                </div>
                <!-- Draft -->
                <div class="mt-4">
                    <v-select v-model="activity.agentMode" :items="agentModeItems" hide-details density="compact" :label="$t('BpmnPropertyPanel.agentMode')">
                    </v-select>
                </div>
                <!-- Orchestration -->
                <div v-if="activity.agentMode === 'draft' || activity.agentMode === 'complete'" class="mt-4">
                    <v-select v-model="activity.orchestration" :items="orchestrationItems" hide-details density="compact" :label="$t('BpmnPropertyPanel.orchestration')">
                    </v-select>
                </div>
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
                                <v-col cols="12" lg="6" md="6" sm="12" v-for="field in getFormFields(formId)" :key="`${formId}-${field.fieldId}`">
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

            <v-window-item v-for="tab in ['edit', 'preview']" :key="tab" :value="tab">
                <FormDefinition
                    ref="formDefinition"
                    :type="tab"
                    :formId="formId"
                    v-model="tempFormHtml"
                />
            </v-window-item>
        </v-window>
    </div>
</template>

<script>
import Instruction from '@/components/designer/InstructionField.vue';
import Checkpoints from '@/components/designer/CheckpointsField.vue';
import Description from '@/components/designer/DescriptionField.vue';

import { defineAsyncComponent } from 'vue';
const FormDefinition = defineAsyncComponent(() => import('@/components/FormDefinition.vue'));

import BackendFactory from '@/components/api/BackendFactory';

export default {
    name: 'gpt-user-task-panel',
    components: {
        Instruction,
        Checkpoints,
        Description,
        FormDefinition
    },
    props: {
        uengineProperties: Object,
        processDefinitionId: String,
        processDefinition: Object,
        element: Object,
        isViewMode: Boolean,
        isPreviewMode: Boolean,
        role: String,
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
                duration: 5,
                attachments: [],
                instruction: '',
                description: '',
                checkpoints: [''],
                agentMode: 'none',
                orchestration: 'none'
            },
            formId: '',
            tempFormHtml: '',
            activeTab: 'setting',
            fieldsJson: [],
            agentModeItems: [
                { title: 'None', value: 'none' },
                { title: 'Draft', value: 'draft' },
                { title: 'Complete', value: 'complete' }
            ],
            orchestrationItems: [
                { title: 'None', value: 'none' },
                { title: 'Crewai Deep Research', value: 'crewai-deep-research' },
                { title: 'Crewai Action', value: 'crewai-action' },
                { title: 'OpenAI Deep Research', value: 'openai-deep-research' },
                { title: 'Browser automation agent', value: 'browser-automation-agent' },
                { title: 'Agent To Agent', value: 'a2a' }
            ],
            selectedForms: [],
            availableForms: [],
            formFields: {},
        };
    },
    created() {
        this.backend = BackendFactory.createBackend();
        if(this.processDefinition && this.processDefinition.activities && this.processDefinition.activities.length > 0) {
            const activity = this.processDefinition.activities.find(activity => activity.id === this.element.id);
            if (activity) {
                this.activity = activity;
                if (!this.activity.agentMode) this.activity.agentMode = 'none';
                if (!this.activity.orchestration) this.activity.orchestration = 'none';
                if (this.activity.isDraft) delete this.activity.isDraft;
                if (this.activity.inputData) {
                    const formIds = [...new Set(this.activity.inputData.map((item) => {
                        return item.split(".")[0]
                    }))]
                    this.selectedForms = formIds;
                }
            } else {
                console.log('Activity not found');
            }
        }
    },
    async mounted() {
        let me = this;
        await me.init();
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
        },
    },
    watch: {
        activity: {
            deep: true,
            handler(newVal, oldVal) {
                // console.log(this.processDefinition)
                this.$emit('update:processDefinition', this.processDefinition);
                this.EventBus.emit('process-definition-updated', this.processDefinition);
            }
        },
        activeTab: {
            deep: true,
            async handler(newVal, oldVal) {
                if (newVal !== oldVal) {
                    if (this.$refs.formDefinition && this.$refs.formDefinition[0]) {
                        this.tempFormHtml = this.$refs.formDefinition[0].getFormHTML();
                    } else if (newVal == 'inputData') {
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
                        this.formFields[form.formId].push({
                            fieldId: field.key,
                            fieldName: field.text,
                            selected: true
                        });
                    });
                });
            }
        },
        selectedForms:{
            deep: true,
            handler() {
                this.updateInputData()
            },
        },
        formFields: {
            deep: true,
            handler() {
                this.updateInputData()
            }
        }
    },
    methods: {
        async init() {
            var me = this;
            if(me.isPreviewMode){
                me.activeTab = 'preview'
            }
            me.formId = me.copyUengineProperties.variableForHtmlFormContext? me.copyUengineProperties.variableForHtmlFormContext.name : '';
            if (!me.formId || me.formId == '') {
                let formId = '';
                if (!me.processDefinition || !me.processDefinition.processDefinitionId) {
                    formId = me.element.id + '_form';
                } else {
                    formId = me.processDefinition.processDefinitionId + '_' + me.element.id + '_form';
                }
                formId = formId.toLowerCase();
                formId = formId.replace(/[/.]/g, "_");
                me.formId = formId;
            }
            const options = {
                type: 'form',
                match: {
                    proc_def_id: me.processDefinitionId,
                    activity_id: me.element.id
                }
            }
            if (me.lastPath) {
                if (me.lastPath == 'chat' || me.lastPath == 'definition-map') {
                    me.tempFormHtml = localStorage.getItem(me.formId);
                } else {
                    me.tempFormHtml = await me.backend.getRawDefinition(me.formId, options);
                }
            } else {
                me.tempFormHtml = localStorage.getItem(me.formId);
            }

            if(!me.tempFormHtml) {
                me.tempFormHtml = await me.backend.getRawDefinition('defaultform', { type: 'form' });
            }
            
            me.copyUengineProperties._type = 'org.uengine.kernel.FormActivity';
            me.copyUengineProperties.role = {'name': me.role || ''};
            me.copyUengineProperties.variableForHtmlFormContext = {name: me.formId};
            // me.copyUengineProperties.parameters = [];
            me.copyDefinition = me.definition;
        },
        async beforeSave() {
            var me = this;
            if (me.formId == '' || me.formId == null || me.formId.includes('undefined')) {
                let formId = '';
                if (!me.processDefinition || !me.processDefinition.processDefinitionId) {
                    formId = me.element.id + '_form';
                } else {
                    formId = me.processDefinition.processDefinitionId + '_' + me.element.id + '_form';
                }
                formId = formId.toLowerCase();
                formId = formId.replace(/[/.]/g, "_");
                me.formId = formId;
            }
            
            me.copyUengineProperties._type = 'org.uengine.kernel.FormActivity';
            me.copyUengineProperties.variableForHtmlFormContext = {name: me.formId};

            const options = {
                type: 'form',
                proc_def_id: me.processDefinition.processDefinitionId,
                activity_id: me.element.id
            }

            if (me.$refs.formDefinition && me.activeTab == 'edit') {
                me.tempFormHtml = me.$refs.formDefinition[0].getFormHTML();
            }

            if (me.tempFormHtml && me.tempFormHtml != '') {
                if (me.lastPath) {
                    if (me.lastPath == 'chat' || me.lastPath == 'definition-map') {
                        localStorage.setItem(me.formId, me.tempFormHtml);
                    } else {
                        await me.backend.putRawDefinition(me.tempFormHtml, me.formId, options);
                    }
                } else {
                    localStorage.setItem(me.formId, me.tempFormHtml);
                }
            }
            
            me.$emit('update:uengineProperties', me.copyUengineProperties);
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

        async getPreviousForms() {
            const prevForms = await this.backend.getPreviousForms(this.element.id, this.processDefinition.processDefinitionId);
            this.availableForms = prevForms.map((form) => {
                return {
                    formId: form.id,
                    title: form.title,
                    fields: form.fields_json || []
                }
            });
        },
        updateInputData() {
            const inputData = []
            this.selectedForms.forEach(formId => {
                if (this.formFields[formId]) {
                    this.formFields[formId].forEach(field => {
                        if (field.selected) {
                            inputData.push(`${formId}.${field.fieldId}`)
                        }
                    })
                }
            })
            
            this.activity.inputData = inputData
        },
        getFormTitle(formId) {
            if (this.availableForms.length == 0) {
                return formId;
            }
            return this.availableForms.find(form => form.formId === formId).title;
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
</style>