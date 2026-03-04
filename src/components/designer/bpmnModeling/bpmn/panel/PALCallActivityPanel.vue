<template>
    <div class="pal-call-activity-panel">
        <div class="mb-4">
            <label class="text-body-2 font-weight-medium mb-2 d-block">
                {{ $t('CallActivityPanel.selectDefinition') || '호출할 프로세스' }}
            </label>
            <ProcessDefinitionDisplay
                v-model="copyUengineProperties.definitionId"
                :disabled="isViewMode"
                :file-extensions="['.bpmn']"
                :options="{ hideDetails: true, itemTitle: 'name', itemValue: 'path' }"
            />
        </div>
        <div v-if="copyUengineProperties.definitionId" class="text-caption text-medium-emphasis">
            {{ $t('CallActivityPanel.noDefinitionSelected') ? '' : '선택된 프로세스가 호출됩니다.' }}
        </div>
    </div>
</template>

<script>
import ProcessDefinitionDisplay from '@/components/designer/ProcessDefinitionDisplay.vue';

export default {
    name: 'pal-call-activity-panel',
    components: {
        ProcessDefinitionDisplay,
    },
    props: {
        uengineProperties: { type: Object, default: null },
        isViewMode: { type: Boolean, default: false },
        element: { type: Object, default: null },
    },
    emits: ['update:uengineProperties'],
    created() {
        if (this.uengineProperties && typeof this.uengineProperties === 'object') {
            this.copyUengineProperties = JSON.parse(JSON.stringify(this.uengineProperties));
        } else {
            this.copyUengineProperties = {};
        }
        this.ensureKeyExists(this.copyUengineProperties, 'definitionId', '');
    },
    data() {
        return {
            copyUengineProperties: {},
        };
    },
    watch: {
        copyUengineProperties: {
            deep: true,
            handler(val) {
                this.$emit('update:uengineProperties', val ? { ...val } : {});
            },
        },
    },
    methods: {
        ensureKeyExists(obj, key, defaultValue) {
            if (!Object.prototype.hasOwnProperty.call(obj, key)) {
                obj[key] = defaultValue;
            }
        },
        async beforeSave() {
            this.$emit('update:uengineProperties', { ...this.copyUengineProperties });
        },
    },
};
</script>

<style scoped>
.pal-call-activity-panel {
    padding: 0 4px;
}
</style>
