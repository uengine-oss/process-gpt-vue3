<template>
    <div>
        <div class="mb-6">
            <!-- Duration -->
            <v-text-field v-model="activity.duration" label="소요시간" suffix="일" type="number" class="mb-4"></v-text-field>
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

            <!-- Task Color Picker -->
            <div class="mt-4">
                <div class="text-subtitle-2 mb-2">{{ $t('BpmnPropertyPanel.taskColor') || '작업 색상' }}</div>
                <div class="d-flex flex-wrap gap-2 mb-3">
                    <v-btn v-for="color in presetColors" :key="color.value" :style="{ backgroundColor: color.value, border: copyUengineProperties.taskColor === color.value ? '3px solid #1976D2' : '1px solid #ccc' }" size="small" icon :disabled="isViewMode" @click="setTaskColor(color.value)">
                        <v-icon v-if="copyUengineProperties.taskColor === color.value" size="small" color="white">mdi-check</v-icon>
                    </v-btn>
                </div>
                <v-row class="ma-0 pa-0 align-center">
                    <v-menu v-model="showColorPicker" :close-on-content-click="false" location="bottom">
                        <template v-slot:activator="{ props }">
                            <v-btn v-bind="props" :disabled="isViewMode" variant="outlined" size="small" class="mr-2">
                                <v-icon start size="small">mdi-palette</v-icon>{{ $t('BpmnPropertyPanel.customColor') || '사용자 정의 색상' }}
                            </v-btn>
                        </template>
                        <v-card min-width="300">
                            <v-color-picker v-model="customColor" mode="hexa" hide-inputs></v-color-picker>
                            <v-card-actions>
                                <v-btn size="small" @click="showColorPicker = false">{{ $t('common.cancel') || '취소' }}</v-btn>
                                <v-btn size="small" color="primary" @click="applyCustomColor">{{ $t('common.confirm') || '적용' }}</v-btn>
                            </v-card-actions>
                        </v-card>
                    </v-menu>
                    <v-btn v-if="copyUengineProperties.taskColor" variant="text" size="small" color="error" :disabled="isViewMode" @click="resetTaskColor">
                        <v-icon size="small">mdi-close</v-icon>{{ $t('BpmnPropertyPanel.resetColor') || '초기화' }}
                    </v-btn>
                </v-row>
                <div v-if="copyUengineProperties.taskColor" class="mt-2 d-flex align-center">
                    <div :style="{ backgroundColor: copyUengineProperties.taskColor, width: '24px', height: '24px', borderRadius: '4px', border: '1px solid #ccc' }" class="mr-2"></div>
                    <span class="text-caption">{{ copyUengineProperties.taskColor }}</span>
                </div>
            </div>
        </div>
    </div>
</template>
<script>
import Instruction from '@/components/designer/InstructionField.vue';
import Checkpoints from '@/components/designer/CheckpointsField.vue';
import KeyValueField from '@/components/designer/KeyValueField.vue';
import { useBpmnStore } from '@/stores/bpmn';

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
                customProperties: []
            },
            showColorPicker: false,
            customColor: '#e3f2fd',
            presetColors: [
                { name: 'Light Blue', value: '#e3f2fd' },
                { name: 'Light Yellow', value: '#fdf2d0' },
                { name: 'Light Green', value: '#e8f5e9' },
                { name: 'Light Purple', value: '#f3e5f5' },
                { name: 'Light Orange', value: '#fff3e0' },
                { name: 'Light Pink', value: '#fce4ec' },
                { name: 'Light Cyan', value: '#e0f7fa' },
                { name: 'Light Red', value: '#ffebee' },
                { name: 'Light Gray', value: '#f5f5f5' },
                { name: 'White', value: '#ffffff' }
            ]
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
    methods: {
        beforeSave() {
            var me = this;
            me.copyUengineProperties.customProperties = me.activity.customProperties;
            me.$emit('update:uengineProperties', me.copyUengineProperties);
        },
        setTaskColor(color) {
            this.copyUengineProperties.taskColor = color;
            this.$emit('update:uengineProperties', this.copyUengineProperties);
            this.refreshTaskVisual();
        },
        applyCustomColor() {
            this.copyUengineProperties.taskColor = this.customColor;
            this.$emit('update:uengineProperties', this.copyUengineProperties);
            this.showColorPicker = false;
            this.refreshTaskVisual();
        },
        resetTaskColor() {
            delete this.copyUengineProperties.taskColor;
            this.$emit('update:uengineProperties', this.copyUengineProperties);
            this.refreshTaskVisual();
        },
        refreshTaskVisual() {
            const store = useBpmnStore();
            const modeler = store.getModeler;
            if (modeler) {
                try {
                    const elementRegistry = modeler.get('elementRegistry');
                    const graphicsFactory = modeler.get('graphicsFactory');
                    const element = elementRegistry.get(this.element?.id);
                    if (element) {
                        const gfx = elementRegistry.getGraphics(element);
                        if (gfx) { graphicsFactory.update('shape', element, gfx); }
                    }
                } catch (e) { console.warn('Could not refresh task visual:', e); }
            }
        }
    }
};
</script>
