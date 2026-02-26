<template>
    <div>
        <div class="mb-6">
            <!-- Duration -->
            <v-text-field v-model="activity.duration" label="소요시간" suffix="일" type="number" class="mb-4"></v-text-field>

            <!-- Future Status (Phase 2-2) -->
            <v-select
                v-model="activity.futureStatus"
                :label="$t('futureStatus.label')"
                :items="futureStatusOptions"
                item-title="title"
                item-value="value"
                density="compact"
                variant="outlined"
                class="mb-4"
                hide-details
                :disabled="isViewMode"
                clearable
            ></v-select>

            <!-- Instruction -->
            <Instruction v-model="activity.description" class="mb-4"></Instruction>
            <!-- Checkpoints -->
            <Checkpoints v-model="activity.checkpoints" class="user-task-panel-check-points mb-4"></Checkpoints>
            
            <!-- Custom Properties -->
            <KeyValueField
                v-model="activity.customProperties"
                :label="$t('BpmnPropertyPanel.customProperties') || '사용자 속성'"
                :readonly="isViewMode"
                class="mb-4"
            ></KeyValueField>
        </div>
    </div>
</template>
<script>
import Instruction from '@/components/designer/InstructionField.vue';
import Checkpoints from '@/components/designer/CheckpointsField.vue';
import KeyValueField from '@/components/designer/KeyValueField.vue';

import BackendFactory from '@/components/api/BackendFactory';

export default {
    name: 'gpt-service-task-panel',
    components: {
        Instruction,
        Checkpoints,
        KeyValueField
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
        definition: Object,
        name: String
    },
    data() {
        return {
            copyUengineProperties: JSON.parse(JSON.stringify(this.uengineProperties)),
            copyDefinition: null,
            backend: null,
            activity: {
                type: 'serviceTask',
                duration: 5,
                attachments: [],
                instruction: '',
                checkpoints: [''],
                customProperties: [],
                futureStatus: null
            }
        }
    },
    async mounted() {
        var me = this;
        if(this.processDefinition && this.processDefinition.activities && this.processDefinition.activities.length > 0) {
            const activity = me.processDefinition.activities.find(activity => activity.id === me.element.id);
            if (activity) {
                me.activity = { ...me.activity, ...activity };
                console.log(me.activity);
            } else {
                console.log('Activity not found');
            }
        }
        me.activity.type = 'serviceTask';
        if (me.copyUengineProperties && me.copyUengineProperties.customProperties) {
            me.activity.customProperties = me.copyUengineProperties.customProperties;
        }
    },
    computed: {
        futureStatusOptions() {
            return [
                { title: this.$t('futureStatus.maintain'), value: 'maintain' },
                { title: this.$t('futureStatus.sunset'), value: 'sunset' },
                { title: this.$t('futureStatus.new'), value: 'new' },
                { title: this.$t('futureStatus.automation_planned'), value: 'automation_planned' }
            ];
        }
    },
    methods: {
        beforeSave() {
            var me = this;
            me.copyUengineProperties.customProperties = me.activity.customProperties;
            me.$emit('update:uengineProperties', me.copyUengineProperties);
        }
    }
};
</script>
