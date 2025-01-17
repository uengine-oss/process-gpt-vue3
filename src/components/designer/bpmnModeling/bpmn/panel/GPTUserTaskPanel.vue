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
                <v-file-input
                    v-if="isPal"
                    v-model="activity.attachments"
                    label="첨부파일"
                    multiple
                    class="mb-4"
                ></v-file-input>
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
            fieldsJson: []
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
    computed: {
        isPal() {
            return window.$pal;
        }
    },
    watch: {
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
            const lastPath = me.$route.params.pathMatch[me.$route.params.pathMatch.length - 1];
            if (lastPath == 'chat') {
                me.tempFormHtml = localStorage.getItem(me.formId);
            } else {
                me.tempFormHtml = await me.backend.getRawDefinition(me.formId, options);
            }
            
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
                    const lastPath = me.$route.params.pathMatch[me.$route.params.pathMatch.length - 1];
                    if (lastPath == 'chat') {
                        localStorage.setItem(me.formId, me.tempFormHtml);
                    } else {
                        await me.backend.putRawDefinition(me.tempFormHtml, me.formId, options);
                    }
                }
            }
            
            me.$emit('update:uengineProperties', me.copyUengineProperties);
        },
    }
};
</script>

<style scoped>
.gpt-user-task-panel {
    margin: -16px;
}
</style>