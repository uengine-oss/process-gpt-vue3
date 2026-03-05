<template>
    <v-dialog v-model="dialogVisible" max-width="550" persistent>
        <v-card>
            <v-card-title>
                {{ isEdit ? $t('colorRules.editRule') : $t('colorRules.addRule') }}
            </v-card-title>

            <v-card-text>
                <v-form ref="formRef" v-model="formValid">
                    <!-- Rule Name -->
                    <v-text-field
                        v-model="localRule.name"
                        :label="$t('colorRules.ruleName')"
                        :rules="[v => !!v || $t('colorRules.ruleNameRequired')]"
                        variant="outlined"
                        density="compact"
                        class="mb-3"
                    />

                    <!-- Rule Type -->
                    <v-select
                        v-model="localRule.type"
                        :items="ruleTypes"
                        :label="$t('colorRules.ruleType')"
                        variant="outlined"
                        density="compact"
                        class="mb-3"
                    />

                    <!-- Task Type Selection (when type === 'taskType') -->
                    <v-select
                        v-if="localRule.type === 'taskType'"
                        v-model="localRule.taskTypes"
                        :items="taskTypeOptions"
                        :label="$t('colorRules.taskTypes')"
                        item-title="label"
                        item-value="value"
                        multiple
                        chips
                        closable-chips
                        variant="outlined"
                        density="compact"
                        class="mb-3"
                    />

                    <!-- Duration Range (when type === 'leadTime') -->
                    <template v-if="localRule.type === 'leadTime'">
                        <div class="d-flex gap-3 mb-3">
                            <v-text-field
                                v-model.number="localRule.minDuration"
                                :label="$t('colorRules.minDuration')"
                                type="number"
                                min="0"
                                :suffix="$t('colorRules.days')"
                                variant="outlined"
                                density="compact"
                            />
                            <v-text-field
                                v-model.number="localRule.maxDuration"
                                :label="$t('colorRules.maxDuration')"
                                type="number"
                                min="0"
                                :suffix="$t('colorRules.days')"
                                :placeholder="$t('colorRules.unlimited')"
                                variant="outlined"
                                density="compact"
                            />
                        </div>
                    </template>

                    <!-- Color Selection -->
                    <div class="mb-3">
                        <v-label class="mb-2">{{ $t('colorRules.fillColor') }}</v-label>
                        <div class="d-flex align-center gap-3">
                            <!-- Preset Colors -->
                            <div class="preset-colors d-flex gap-1 flex-wrap">
                                <div
                                    v-for="color in presetColors"
                                    :key="color.value"
                                    class="preset-color"
                                    :class="{ selected: localRule.fillColor === color.value }"
                                    :style="{ backgroundColor: color.value }"
                                    :title="color.name"
                                    @click="localRule.fillColor = color.value"
                                />
                            </div>
                            <!-- Custom Color Picker -->
                            <v-menu :close-on-content-click="false">
                                <template v-slot:activator="{ props }">
                                    <v-btn v-bind="props" size="small" variant="outlined">
                                        <div
                                            class="color-preview mr-2"
                                            :style="{ backgroundColor: localRule.fillColor }"
                                        />
                                        {{ $t('colorRules.custom') }}
                                    </v-btn>
                                </template>
                                <v-color-picker
                                    v-model="localRule.fillColor"
                                    mode="hexa"
                                />
                            </v-menu>
                        </div>
                    </div>

                    <!-- Stroke Color (Optional) -->
                    <v-expansion-panels variant="accordion" class="mb-3">
                        <v-expansion-panel>
                            <v-expansion-panel-title>
                                {{ $t('colorRules.strokeColor') }} ({{ $t('colorRules.optional') }})
                            </v-expansion-panel-title>
                            <v-expansion-panel-text>
                                <div class="d-flex align-center gap-3">
                                    <div class="preset-colors d-flex gap-1 flex-wrap">
                                        <div
                                            v-for="color in strokeColors"
                                            :key="color.value"
                                            class="preset-color"
                                            :class="{ selected: localRule.strokeColor === color.value }"
                                            :style="{ backgroundColor: color.value }"
                                            :title="color.name"
                                            @click="localRule.strokeColor = color.value"
                                        />
                                    </div>
                                    <v-btn
                                        size="small"
                                        variant="text"
                                        @click="localRule.strokeColor = undefined"
                                    >
                                        {{ $t('colorRules.noStroke') }}
                                    </v-btn>
                                </div>
                            </v-expansion-panel-text>
                        </v-expansion-panel>
                    </v-expansion-panels>

                    <!-- Enable/Disable -->
                    <v-switch
                        v-model="localRule.enabled"
                        :label="$t('colorRules.enabled')"
                        color="primary"
                        hide-details
                    />
                </v-form>
            </v-card-text>

            <v-card-actions>
                <v-spacer />
                <v-btn variant="text" @click="cancel">
                    {{ $t('common.cancel') }}
                </v-btn>
                <v-btn
                    color="primary"
                    :disabled="!formValid"
                    @click="save"
                >
                    {{ $t('common.save') }}
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<script>
import { defineComponent, ref, watch, computed } from 'vue';
import { TASK_TYPES } from '@/stores/colorRules';

export default defineComponent({
    name: 'ColorRuleDialog',
    props: {
        modelValue: {
            type: Boolean,
            default: false
        },
        rule: {
            type: Object,
            default: null
        },
        isEdit: {
            type: Boolean,
            default: false
        }
    },
    emits: ['update:modelValue', 'save'],
    setup(props, { emit }) {
        const formRef = ref(null);
        const formValid = ref(false);

        const defaultRule = {
            name: '',
            type: 'taskType',
            enabled: true,
            taskTypes: [],
            minDuration: 0,
            maxDuration: null,
            fillColor: '#e3f2fd',
            strokeColor: undefined
        };

        const localRule = ref({ ...defaultRule });

        const dialogVisible = computed({
            get: () => props.modelValue,
            set: (value) => emit('update:modelValue', value)
        });

        const ruleTypes = [
            { title: 'Task Type', value: 'taskType' },
            { title: 'Lead Time', value: 'leadTime' }
        ];

        const taskTypeOptions = TASK_TYPES;

        const presetColors = [
            { name: 'Light Blue', value: '#e3f2fd' },
            { name: 'Light Green', value: '#e8f5e9' },
            { name: 'Light Purple', value: '#f3e5f5' },
            { name: 'Light Orange', value: '#fff3e0' },
            { name: 'Light Pink', value: '#fce4ec' },
            { name: 'Light Cyan', value: '#e0f7fa' },
            { name: 'Light Red', value: '#ffebee' },
            { name: 'Light Yellow', value: '#fdf2d0' },
            { name: 'Light Gray', value: '#f5f5f5' },
            { name: 'White', value: '#ffffff' }
        ];

        const strokeColors = [
            { name: 'Blue', value: '#1976d2' },
            { name: 'Green', value: '#388e3c' },
            { name: 'Orange', value: '#f57c00' },
            { name: 'Red', value: '#d32f2f' },
            { name: 'Purple', value: '#7b1fa2' },
            { name: 'Gray', value: '#757575' },
            { name: 'Black', value: '#212121' }
        ];

        watch(() => props.modelValue, (newVal) => {
            if (newVal) {
                if (props.rule) {
                    localRule.value = { ...props.rule };
                } else {
                    localRule.value = { ...defaultRule };
                }
            }
        });

        const cancel = () => {
            dialogVisible.value = false;
        };

        const save = () => {
            emit('save', { ...localRule.value });
        };

        return {
            formRef,
            formValid,
            localRule,
            dialogVisible,
            ruleTypes,
            taskTypeOptions,
            presetColors,
            strokeColors,
            cancel,
            save
        };
    }
});
</script>

<style scoped>
.preset-color {
    width: 24px;
    height: 24px;
    border-radius: 4px;
    border: 2px solid transparent;
    cursor: pointer;
    transition: border-color 0.2s;
}

.preset-color:hover {
    border-color: #1976d2;
}

.preset-color.selected {
    border-color: #1976d2;
    box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.3);
}

.color-preview {
    width: 16px;
    height: 16px;
    border-radius: 3px;
    border: 1px solid #ccc;
}
</style>
