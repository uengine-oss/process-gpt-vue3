<template>
    <div>
        <!-- Lead Time -->
        <div class="mt-4">
            <LeadTimeInput
                v-model="copyUengineProperties.leadTime"
                :label="$t('leadTime.title') || 'Lead Time'"
                :disabled="isViewMode"
            />
        </div>

        <div class="mt-3">
            <KeyValueField
                v-model="copyUengineProperties.customProperties"
                :label="$t('BpmnPropertyPanel.customProperties') || '사용자 속성'"
                :readonly="isViewMode"
            />
        </div>
    </div>
</template>
<script>
import KeyValueField from '@/components/designer/KeyValueField.vue';
import LeadTimeInput from './LeadTimeInput.vue';

export default {
    name: 'business-rule-task-panel',
    props: {
        uengineProperties: Object,
        processDefinitionId: String,
        isViewMode: Boolean
    },
    components: {
        KeyValueField,
        LeadTimeInput
    },
    created() {
        if (this.uengineProperties) {
            this.copyUengineProperties = JSON.parse(JSON.stringify(this.uengineProperties));
        } else {
            this.copyUengineProperties = {};
        }
        if(!this.copyUengineProperties.customProperties) this.copyUengineProperties.customProperties = [];
    },
    data() {
        return {
            copyUengineProperties: null,
        };
    },
    methods: {
        beforeSave() {
            this.$emit('update:uengineProperties', this.copyUengineProperties);
        }
    }
};
</script>
