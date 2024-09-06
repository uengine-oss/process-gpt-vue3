<template>
    <div class="gpt-user-task-panel">
        <v-tabs v-model="activeTab" class="ma-3">
            <v-tab value="setting">설정</v-tab>
            <v-tab value="edit">폼 편집</v-tab>
            <v-tab value="preview">폼 미리보기</v-tab>
        </v-tabs>
        <v-window v-model="activeTab">
            <v-window-item value="setting" class="pa-4">
                <div class="mb-4">{{ $t('BpmnPropertyPanel.role') }}: {{ copyUengineProperties.role ? copyUengineProperties.role.name : '' }}</div>
                <v-text-field v-model="name" label="이름" autofocus class="mb-4"></v-text-field>
                <v-text-field v-model="activity.duration" label="소요시간" suffix="일" type="number" class="mb-4"></v-text-field>
                <Instruction v-model="activity.instruction" class="mb-4"></Instruction>
                <Checkpoints v-model="activity.checkpoints" class="user-task-panel-check-points mb-4"></Checkpoints>
            </v-window-item>
            <v-window-item v-for="tab in ['edit', 'preview']" :key="tab" :value="tab">
                <FormDefinition
                    :key="formRenderKey"
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

import { defineAsyncComponent } from 'vue';
const FormDefinition = defineAsyncComponent(() => import('@/components/FormDefinition.vue'));

import BackendFactory from '@/components/api/BackendFactory';

export default {
    name: 'gpt-user-task-panel',
    components: {
        Instruction,
        Checkpoints,
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
                instruction: '',
                checkpoints: ['']
            },
            formId: '',
            tempFormHtml: '',
            activeTab: 'setting',
            formRenderKey: 0
        };
    },
    created() {
        this.backend = BackendFactory.createBackend();
        if(this.processDefinition && this.processDefinition.activities && this.processDefinition.activities.length > 0) {
            const activity = this.processDefinition.activities.find(activity => activity.id === this.element.id);
            if (activity) {
                this.activity = activity;
            } else {
                console.log('Activity not found');
            }
        }
    },
    async mounted() {
        let me = this;
        await me.init();
    },
    watch: {
        activeTab: {
            handler(newVal) {
                if (newVal == 'preview') {
                    this.formRenderKey++;
                }
            }
        },
        activity: {
            deep: true,
            handler(newVal, oldVal) {
                console.log(this.processDefinition)
                this.EventBus.emit('process-definition-updated', this.processDefinition);
            }
        },
        activeTab(newVal, oldVal) {
            if (newVal !== oldVal) {
                if (this.$refs.formDefinition && this.$refs.formDefinition[0]) {
                    this.tempFormHtml = this.$refs.formDefinition[0].getFormHTML();
                }
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
                me.formId = me.processDefinition.processDefinitionId + '_' + me.element.id + '_form';
            }
            const options = {
                type: 'form',
                match: {
                    proc_def_id: me.processDefinitionId,
                    activity_id: me.element.id
                }
            }
            me.tempFormHtml = await me.backend.getRawDefinition(me.formId, options);
            
            me.copyUengineProperties._type = 'org.uengine.kernel.FormActivity';
            me.copyUengineProperties.role = {'name': me.role || ''};
            me.copyUengineProperties.variableForHtmlFormContext = {name: me.formId};
            // me.copyUengineProperties.parameters = [];
            me.copyDefinition = me.definition;
        },
        async beforeSave() {
            var me = this;
            if (me.formId == '' || me.formId == null) {
                me.formId = me.processDefinition.processDefinitionId + '_' + me.element.id + '_form';
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
                if (options && options.proc_def_id && options.activity_id) {
                    await me.backend.putRawDefinition(me.tempFormHtml, me.formId, options);
                }

                const taskFields = me.processDefinition.data.map(data => { 
                    return {name: data.name, type: data.type}
                });
                const fields = me.extractFields(me.tempFormHtml);
                fields.forEach(field => {
                    const existVar = taskFields.find(data => data.name === field.text && data.type === field.type);
                    if (!existVar) {
                        me.$emit('addUengineVariable', {
                            name: field.text,
                            type: field.type,
                            defaultValue: '',
                            description: '',
                            datasource: {
                                type: '',
                                sql: ''
                            },
                            table: '',
                            backend: null
                        });
                    }
                });
            }
            
            me.$emit('update:uengineProperties', me.copyUengineProperties);
        },
        extractFields(htmlString) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlString, 'text/html');
            const fields = [];

            function extractFieldAttributes(elements) {
                elements.forEach((element) => {
                    const alias = element.getAttribute('alias');
                    const key = element.getAttribute('name') || '';
                    if (alias) {
                        let type = "Text";
                        const tagName = element.tagName.toLowerCase();
                        if (tagName === 'text-field' && element.getAttribute('type') === 'number') {
                            type = "Number";
                        } else if (tagName === 'text-field' && element.getAttribute('type') === 'date') {
                            type = "Date";
                        } else if (tagName === 'file-field') {
                            type = "Attachment";
                        }
                        fields.push({ text: alias, key: key, type: type });
                    }
                });
            }

            const fieldTags = [
                'text-field', 'select-field', 'checkbox-field', 'radio-field', 
                'file-field', 'label-field', 'boolean-field', 'textarea-field', 
                'user-select-field'
            ];

            fieldTags.forEach(tag => {
                const elements = doc.querySelectorAll(tag);
                extractFieldAttributes(elements);
            });

            return fields;
        },
    }
};
</script>

<style scoped>
.gpt-user-task-panel {
    margin: -16px;
}
</style>