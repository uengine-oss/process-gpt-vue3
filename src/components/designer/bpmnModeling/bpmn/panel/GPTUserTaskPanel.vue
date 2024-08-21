<template>
    <div>
        <v-tabs v-model="activeTab">
            <v-tab value="setting">설정</v-tab>
            <v-tab value="form">폼 편집</v-tab>
        </v-tabs>
        <v-window v-model="activeTab">
            <v-window-item value="setting" class="pt-4">
                <div class="mb-4">{{ $t('BpmnPropertyPanel.role') }}: {{ copyUengineProperties.role.name }}</div>
                <v-text-field v-model="name" label="이름" autofocus></v-text-field>
                <v-text-field v-model="activity.duration" label="소요시간" suffix="일" type="number"></v-text-field>
                <Instruction v-model="activity.instruction"></Instruction>
                <Checkpoints v-model="activity.checkpoints" class="user-task-panel-check-points"></Checkpoints>
            </v-window-item>
            <v-window-item value="form">
                <!-- <UIDefinitionChat></UIDefinitionChat> -->
            </v-window-item>
        </v-window>
    </div>
</template>

<script>
import Instruction from '@/components/designer/InstructionField.vue';
import Checkpoints from '@/components/designer/CheckpointsField.vue';

import { defineAsyncComponent } from 'vue';
const UIDefinitionChat = defineAsyncComponent(() => import('@/components/UIDefinitionChat.vue'));

import BackendFactory from '@/components/api/BackendFactory';

export default {
    name: 'gpt-user-task-panel',
    components: {
        Instruction,
        Checkpoints,
        UIDefinitionChat
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
    emits: [ 'update:uengineProperties', 'update:name' ],
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
            formHtml: '',
            formValues: {},
            activeTab: null
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
        activity: {
            deep: true,
            handler(newVal, oldVal) {
                if (!this.useEvent && (newVal.checkpoints || newVal.instruction) ) {
                    this.EventBus.emit('process-definition-updated', this.processDefinition);
                }
            }
        }
    },
    methods: {
        async init() {
            var me = this;
            if (me.roles.length > 0) {
                me.copyUengineProperties.role = { name: me.role };
            }

            me.copyUengineProperties._type = 'org.uengine.kernel.FormActivity';
            if (!me.copyUengineProperties.variableForHtmlFormContext) {
                me.copyUengineProperties.variableForHtmlFormContext = {};
            }
            me.formId = me.copyUengineProperties.variableForHtmlFormContext.name;
            if (me.formId && me.formId != '') {
                me.formHtml = await me.backend.getRawDefinition(me.formId, { type: 'form' });
            }
            me.copyDefinition = me.definition;
        },
        beforeSave() {
            var me = this;
            me.$emit('update:uengineProperties', me.copyUengineProperties);
        },
    }
};
</script>
