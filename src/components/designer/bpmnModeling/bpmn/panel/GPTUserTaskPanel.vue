<template>
    <div>
        <v-tabs v-model="activeTab">
            <v-tab value="setting">설정</v-tab>
            <v-tab value="edit">폼 편집</v-tab>
            <v-tab value="preview">폼 미리보기</v-tab>
        </v-tabs>
        <v-window v-model="activeTab">
            <v-window-item value="setting" class="pt-4">
                <div class="mb-4">{{ $t('BpmnPropertyPanel.role') }}: {{ copyUengineProperties.role ? copyUengineProperties.role.name : '' }}</div>
                <v-text-field v-model="name" label="이름" autofocus class="mb-4"></v-text-field>
                <v-text-field v-model="activity.duration" label="소요시간" suffix="일" type="number" class="mb-4"></v-text-field>
                <Instruction v-model="activity.instruction" class="mb-4"></Instruction>
                <Checkpoints v-model="activity.checkpoints" class="user-task-panel-check-points mb-4"></Checkpoints>
            </v-window-item>
            <v-window-item v-for="tab in ['edit', 'preview']" :key="tab" :value="tab">
                <FormDefinition
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
            activeTab: 'setting'
        };
    },
    computed: {
        existForm() {
            return this.processDefinition.data.find(data => data.name === this.formId);
        }
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
        activity: {
            deep: true,
            handler(newVal, oldVal) {
                this.EventBus.emit('process-definition-updated', this.processDefinition);
            }
        }
    },
    methods: {
        async init() {
            var me = this;
            me.formId = me.copyUengineProperties.variableForHtmlFormContext.name;
            if (!me.formId || me.formId == '') {
                me.formId = me.processDefinition.processDefinitionId + '_' + me.elem.id + '_form';
            }
            const options = {
                type: 'form',
                match: {
                    proc_def_id: me.processDefinitionId,
                    activity_id: me.element.id
                }
            }
            me.tempFormHtml = await me.backend.getRawDefinition(me.formId, options);
            
            me.copyUengineProperties = {
                _type: 'org.uengine.kernel.FormActivity',
                role: {
                    name: me.role || ''
                },
                variableForHtmlFormContext: {
                    name: me.formId
                },
                parameters: []
            };
            me.copyDefinition = me.definition;
        },
        async beforeSave() {
            var me = this;
            if (me.formId == '' || me.formId == null) {
                me.formId = me.processDefinition.processDefinitionId + '_' + me.element.id + '_form';
            }
            me.copyUengineProperties = {
                _type: 'org.uengine.kernel.FormActivity',
                role: {
                    name: me.role
                },
                variableForHtmlFormContext: {
                    name: me.formId
                },
                parameters: []
            };
            const options = {
                type: 'form',
                proc_def_id: me.processDefinition.processDefinitionId,
                activity_id: me.element.id
            }
            if (me.tempFormHtml && me.tempFormHtml != '') {
                if (!me.existForm) {
                    me.$emit('addUengineVariable', {
                        name: me.formId,
                        type: 'Form',
                        defaultValue: me.formId,
                        description: '',
                        datasource: {
                            type: '',
                            sql: ''
                        },
                        table: '',
                        backend: null
                    });
                }

                if (options && options.proc_def_id && options.activity_id) {
                    await me.backend.putRawDefinition(me.tempFormHtml, me.formId, options);
                }
            }
            me.$emit('update:uengineProperties', me.copyUengineProperties);
        },
    }
};
</script>
