<template>
    <v-dialog v-model="dialogVisible" max-width="800px" persistent>
        <v-card class="color-ruleset-dialog">
            <v-card-title class="d-flex justify-space-between align-center pa-4">
                <div class="d-flex align-center gap-2">
                    <v-icon color="primary">mdi-palette</v-icon>
                    <span class="text-h6">Color Ruleset</span>
                </div>
                <v-btn icon variant="text" size="small" @click="closeDialog">
                    <v-icon>mdi-close</v-icon>
                </v-btn>
            </v-card-title>

            <v-divider />

            <v-card-text class="pa-4" style="max-height: 550px; overflow-y: auto;">
                <!-- Quick Add Section -->
                <div class="add-rule-section mb-4">
                    <div class="text-subtitle-2 mb-2 text-grey-darken-1">Add New Rule</div>
                    <div class="d-flex gap-2">
                        <v-btn
                            variant="outlined"
                            color="blue"
                            @click="addRule('taskType')"
                            class="flex-grow-1"
                        >
                            <v-icon start>mdi-shape</v-icon>
                            Task Type Rule
                        </v-btn>
                        <v-btn
                            variant="outlined"
                            color="green"
                            @click="addRule('leadTime')"
                            class="flex-grow-1"
                        >
                            <v-icon start>mdi-clock-outline</v-icon>
                            Lead Time Rule
                        </v-btn>
                    </div>
                </div>

                <v-divider class="mb-4" />

                <!-- Rules List -->
                <div class="text-subtitle-2 mb-2 text-grey-darken-1">
                    Rules ({{ rules.length }})
                </div>

                <!-- Empty State -->
                <div v-if="rules.length === 0" class="empty-state text-center py-8">
                    <v-icon size="64" color="grey-lighten-1">mdi-palette-outline</v-icon>
                    <div class="text-h6 text-grey mt-2">No Rules Defined</div>
                    <div class="text-body-2 text-grey-darken-1 mt-1">
                        Add a rule above to colorize tasks based on type or lead time
                    </div>
                </div>

                <!-- Rules -->
                <div v-if="rules && rules.length > 0" class="rules-list">
                    <v-card
                        v-for="(rule, index) in rules"
                        :key="rule.id || index"
                        class="rule-card mb-3"
                        :class="{ 'rule-disabled': !rule.enabled }"
                        variant="outlined"
                    >
                        <!-- Rule Header -->
                        <div class="rule-header d-flex align-center pa-3">
                            <!-- Color Preview -->
                            <div
                                v-if="rule.type === 'taskType'"
                                class="color-preview-box mr-3"
                                :style="{
                                    backgroundColor: normalizeColor(rule.fillColor) || '#fdf2d0',
                                    borderColor: normalizeColor(rule.strokeColor) || '#ccc'
                                }"
                            />
                            <!-- Intensity Preview for leadTime -->
                            <div
                                v-else
                                class="intensity-preview-box mr-3"
                            />

                            <!-- Rule Name -->
                            <v-text-field
                                v-model="rule.name"
                                :placeholder="rule.type === 'taskType' ? 'Task Type Rule' : 'Lead Time Rule'"
                                variant="plain"
                                density="compact"
                                hide-details
                                class="rule-name-input flex-grow-1"
                            />

                            <!-- Rule Type Badge -->
                            <v-chip
                                size="small"
                                :color="rule.type === 'taskType' ? 'blue' : 'green'"
                                variant="flat"
                                class="mx-2"
                            >
                                <v-icon start size="small">
                                    {{ rule.type === 'taskType' ? 'mdi-shape' : 'mdi-clock-outline' }}
                                </v-icon>
                                {{ rule.type === 'taskType' ? 'Type' : 'Time' }}
                            </v-chip>

                            <!-- Toggle & Delete -->
                            <v-switch
                                v-model="rule.enabled"
                                hide-details
                                density="compact"
                                color="primary"
                                class="mr-1"
                            />
                            <v-btn
                                icon
                                variant="text"
                                size="small"
                                color="error"
                                @click="removeRule(index)"
                            >
                                <v-icon size="small">mdi-delete-outline</v-icon>
                            </v-btn>
                        </div>

                        <!-- Rule Content -->
                        <v-expand-transition>
                            <div v-show="rule.enabled" class="rule-content px-3 pb-3">
                                <v-divider class="mb-3" />

                                <!-- Task Type Condition -->
                                <div v-if="rule.type === 'taskType'" class="condition-section">
                                    <div class="text-caption text-grey mb-1">Apply to task types:</div>

                                    <!-- Warning for duplicate task types -->
                                    <v-alert
                                        v-if="getDuplicateTaskTypes(rule, index).length > 0"
                                        type="warning"
                                        density="compact"
                                        variant="tonal"
                                        class="mb-2"
                                    >
                                        <span class="text-caption">
                                            Warning: {{ getDuplicateTaskTypes(rule, index).join(', ') }} already defined in another rule
                                        </span>
                                    </v-alert>

                                    <v-chip-group
                                        v-model="rule.taskTypes"
                                        multiple
                                        column
                                        selected-class="bg-blue-lighten-4"
                                    >
                                        <v-chip
                                            v-for="taskType in taskTypeOptions"
                                            :key="taskType.value"
                                            :value="taskType.value"
                                            filter
                                            variant="outlined"
                                            size="small"
                                            :class="{ 'duplicate-warning': isTaskTypeDuplicate(taskType.value, index) }"
                                        >
                                            {{ taskType.text }}
                                            <v-icon
                                                v-if="isTaskTypeDuplicate(taskType.value, index)"
                                                end
                                                size="x-small"
                                                color="warning"
                                            >mdi-alert</v-icon>
                                        </v-chip>
                                    </v-chip-group>

                                    <!-- Color Selection for taskType -->
                                    <div class="color-section mt-4">
                                        <div class="text-caption text-grey mb-2">Colors:</div>

                                        <!-- Preset Colors -->
                                        <div class="preset-colors d-flex flex-wrap gap-1 mb-3">
                                            <div
                                                v-for="preset in presetColors"
                                                :key="preset.value"
                                                class="preset-color"
                                                :class="{ 'selected': normalizeColor(rule.fillColor) === preset.value }"
                                                :style="{ backgroundColor: preset.value }"
                                                :title="preset.name"
                                                @click="rule.fillColor = preset.value"
                                            />
                                        </div>

                                        <!-- Custom Color Pickers -->
                                        <div class="d-flex align-center gap-4">
                                            <div class="d-flex align-center gap-2">
                                                <span class="text-caption">Fill:</span>
                                                <v-menu :close-on-content-click="false">
                                                    <template v-slot:activator="{ props }">
                                                        <div
                                                            v-bind="props"
                                                            class="color-picker-btn"
                                                            :style="{ backgroundColor: normalizeColor(rule.fillColor) || '#fdf2d0' }"
                                                        >
                                                            <v-icon size="x-small" color="grey-darken-2">mdi-eyedropper</v-icon>
                                                        </div>
                                                    </template>
                                                    <v-color-picker
                                                        v-model="rule.fillColor"
                                                        mode="hexa"
                                                        show-swatches
                                                    />
                                                </v-menu>
                                            </div>

                                            <div class="d-flex align-center gap-2">
                                                <span class="text-caption">Border:</span>
                                                <v-menu :close-on-content-click="false">
                                                    <template v-slot:activator="{ props }">
                                                        <div
                                                            v-bind="props"
                                                            class="color-picker-btn"
                                                            :style="{
                                                                backgroundColor: normalizeColor(rule.strokeColor) || 'transparent',
                                                                border: normalizeColor(rule.strokeColor) ? 'none' : '2px dashed #ccc'
                                                            }"
                                                        >
                                                            <v-icon size="x-small" color="grey-darken-2">mdi-eyedropper</v-icon>
                                                        </div>
                                                    </template>
                                                    <v-card>
                                                        <v-card-text class="pa-2">
                                                            <v-btn
                                                                size="small"
                                                                variant="text"
                                                                block
                                                                @click="rule.strokeColor = ''"
                                                                class="mb-2"
                                                            >
                                                                No Border
                                                            </v-btn>
                                                        </v-card-text>
                                                        <v-color-picker
                                                            v-model="rule.strokeColor"
                                                            mode="hexa"
                                                            show-swatches
                                                        />
                                                    </v-card>
                                                </v-menu>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <!-- Lead Time Condition -->
                                <div v-if="rule.type === 'leadTime'" class="condition-section">
                                    <div class="text-caption text-grey mb-2">Lead time range:</div>

                                    <!-- Min Duration -->
                                    <div class="duration-input-group mb-3">
                                        <div class="text-caption text-grey-darken-1 mb-1">Minimum:</div>
                                        <div class="d-flex align-center gap-2">
                                            <v-text-field
                                                :model-value="getDurationPart(rule.minDuration, 'days')"
                                                @update:model-value="setDurationPart(rule, 'minDuration', 'days', $event)"
                                                type="number"
                                                label="Days"
                                                variant="outlined"
                                                density="compact"
                                                hide-details
                                                style="max-width: 80px;"
                                                :min="0"
                                            />
                                            <v-text-field
                                                :model-value="getDurationPart(rule.minDuration, 'hours')"
                                                @update:model-value="setDurationPart(rule, 'minDuration', 'hours', $event)"
                                                type="number"
                                                label="Hours"
                                                variant="outlined"
                                                density="compact"
                                                hide-details
                                                style="max-width: 80px;"
                                                :min="0"
                                                :max="23"
                                            />
                                            <v-text-field
                                                :model-value="getDurationPart(rule.minDuration, 'minutes')"
                                                @update:model-value="setDurationPart(rule, 'minDuration', 'minutes', $event)"
                                                type="number"
                                                label="Min"
                                                variant="outlined"
                                                density="compact"
                                                hide-details
                                                style="max-width: 80px;"
                                                :min="0"
                                                :max="59"
                                            />
                                            <span class="text-caption text-grey-darken-1">= {{ rule.minDuration }} min</span>
                                        </div>
                                    </div>

                                    <!-- Max Duration -->
                                    <div class="duration-input-group mb-4">
                                        <div class="text-caption text-grey-darken-1 mb-1">Maximum:</div>
                                        <div class="d-flex align-center gap-2">
                                            <v-text-field
                                                :model-value="getDurationPart(rule.maxDuration, 'days')"
                                                @update:model-value="setDurationPart(rule, 'maxDuration', 'days', $event)"
                                                type="number"
                                                label="Days"
                                                variant="outlined"
                                                density="compact"
                                                hide-details
                                                style="max-width: 80px;"
                                                :min="0"
                                            />
                                            <v-text-field
                                                :model-value="getDurationPart(rule.maxDuration, 'hours')"
                                                @update:model-value="setDurationPart(rule, 'maxDuration', 'hours', $event)"
                                                type="number"
                                                label="Hours"
                                                variant="outlined"
                                                density="compact"
                                                hide-details
                                                style="max-width: 80px;"
                                                :min="0"
                                                :max="23"
                                            />
                                            <v-text-field
                                                :model-value="getDurationPart(rule.maxDuration, 'minutes')"
                                                @update:model-value="setDurationPart(rule, 'maxDuration', 'minutes', $event)"
                                                type="number"
                                                label="Min"
                                                variant="outlined"
                                                density="compact"
                                                hide-details
                                                style="max-width: 80px;"
                                                :min="0"
                                                :max="59"
                                            />
                                            <span class="text-caption text-grey-darken-1">= {{ rule.maxDuration }} min</span>
                                        </div>
                                    </div>

                                    <!-- Intensity-based Color Description -->
                                    <div class="intensity-section">
                                        <v-alert
                                            type="info"
                                            variant="tonal"
                                            density="compact"
                                            class="mb-3"
                                        >
                                            <div class="text-caption">
                                                Lead Time rule adjusts the intensity of the task's base color:
                                            </div>
                                            <div class="d-flex align-center gap-2 mt-2">
                                                <span class="text-caption">{{ formatDuration(rule.minDuration) }}</span>
                                                <div class="intensity-preview-bar flex-grow-1"></div>
                                                <span class="text-caption">{{ formatDuration(rule.maxDuration) }}</span>
                                            </div>
                                            <div class="d-flex justify-space-between text-caption text-grey mt-1">
                                                <span>Light (short time)</span>
                                                <span>Dark (long time)</span>
                                            </div>
                                        </v-alert>
                                    </div>
                                </div>
                            </div>
                        </v-expand-transition>
                    </v-card>
                </div>
            </v-card-text>

            <v-divider />

            <v-card-actions class="pa-4">
                <v-btn variant="text" color="grey" @click="closeDialog">
                    Cancel
                </v-btn>
                <v-spacer />
                <v-btn color="primary" variant="flat" @click="saveRules">
                    <v-icon start>mdi-check</v-icon>
                    Save & Apply
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<script>
export default {
    name: 'ColorRulesetDialog',
    props: {
        modelValue: {
            type: Boolean,
            default: false
        },
        initialRules: {
            type: Array,
            default: () => []
        }
    },
    emits: ['update:modelValue', 'save'],
    data() {
        return {
            rules: [],
            taskTypeOptions: [
                { text: 'User Task', value: 'bpmn:UserTask' },
                { text: 'Manual Task', value: 'bpmn:ManualTask' },
                { text: 'Service Task', value: 'bpmn:ServiceTask' },
                { text: 'Script Task', value: 'bpmn:ScriptTask' },
                { text: 'Business Rule Task', value: 'bpmn:BusinessRuleTask' },
                { text: 'Send Task', value: 'bpmn:SendTask' },
                { text: 'Receive Task', value: 'bpmn:ReceiveTask' }
            ],
            presetColors: [
                { name: 'Yellow (Default)', value: '#fdf2d0' },
                { name: 'Blue', value: '#e3f2fd' },
                { name: 'Green', value: '#e8f5e9' },
                { name: 'Purple', value: '#f3e5f5' },
                { name: 'Orange', value: '#fff3e0' },
                { name: 'Pink', value: '#fce4ec' },
                { name: 'Cyan', value: '#e0f7fa' },
                { name: 'Red', value: '#ffebee' },
                { name: 'Grey', value: '#f5f5f5' },
                { name: 'White', value: '#ffffff' }
            ],
        };
    },
    computed: {
        dialogVisible: {
            get() {
                return this.modelValue;
            },
            set(value) {
                this.$emit('update:modelValue', value);
            }
        }
    },
    watch: {
        modelValue: {
            immediate: true,
            handler(newVal) {
                if (newVal) {
                    this.loadRules();
                }
            }
        }
    },
    methods: {
        loadRules() {
            const rules = JSON.parse(JSON.stringify(this.initialRules || []));
            this.rules = rules.map((rule, index) => ({
                ...rule,
                id: rule.id || `rule_${Date.now()}_${index}`,
                name: rule.name || ''
            }));
        },
        addRule(type) {
            const newRule = {
                id: `rule_${Date.now()}`,
                type: type,
                name: '',
                enabled: true,
                priority: this.rules.length + 1
            };

            if (type === 'taskType') {
                newRule.taskTypes = [];
                newRule.fillColor = '#fdf2d0';
                newRule.strokeColor = '';
            } else if (type === 'leadTime') {
                newRule.minDuration = 0;
                newRule.maxDuration = 480;  // Default 8 hours (480 minutes)
            }

            this.rules.push(newRule);
        },
        removeRule(index) {
            this.rules.splice(index, 1);
        },
        // Convert total minutes to days/hours/minutes parts
        getDurationPart(totalMinutes, part) {
            const total = totalMinutes || 0;
            if (part === 'days') {
                return Math.floor(total / (24 * 60));
            } else if (part === 'hours') {
                return Math.floor((total % (24 * 60)) / 60);
            } else {
                return total % 60;
            }
        },
        // Set duration part and update total minutes
        setDurationPart(rule, field, part, value) {
            const numValue = parseInt(value) || 0;
            const currentTotal = rule[field] || 0;
            const currentDays = Math.floor(currentTotal / (24 * 60));
            const currentHours = Math.floor((currentTotal % (24 * 60)) / 60);
            const currentMinutes = currentTotal % 60;

            let newDays = currentDays;
            let newHours = currentHours;
            let newMinutes = currentMinutes;

            if (part === 'days') {
                newDays = numValue;
            } else if (part === 'hours') {
                newHours = Math.min(23, Math.max(0, numValue));
            } else {
                newMinutes = Math.min(59, Math.max(0, numValue));
            }

            rule[field] = (newDays * 24 * 60) + (newHours * 60) + newMinutes;
        },
        // Format duration for display
        formatDuration(totalMinutes) {
            const total = totalMinutes || 0;
            const days = Math.floor(total / (24 * 60));
            const hours = Math.floor((total % (24 * 60)) / 60);
            const minutes = total % 60;

            const parts = [];
            if (days > 0) parts.push(`${days}d`);
            if (hours > 0) parts.push(`${hours}h`);
            if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);
            return parts.join(' ');
        },
        // Check if a task type is already used in another rule
        isTaskTypeDuplicate(taskTypeValue, currentRuleIndex) {
            return this.rules.some((rule, index) => {
                if (index === currentRuleIndex) return false;
                if (rule.type !== 'taskType') return false;
                if (!rule.enabled) return false;
                return rule.taskTypes && rule.taskTypes.includes(taskTypeValue);
            });
        },
        // Get list of duplicate task types for a rule
        getDuplicateTaskTypes(rule, currentRuleIndex) {
            if (!rule.taskTypes) return [];
            return rule.taskTypes
                .filter(tt => this.isTaskTypeDuplicate(tt, currentRuleIndex))
                .map(tt => {
                    const option = this.taskTypeOptions.find(o => o.value === tt);
                    return option ? option.text : tt;
                });
        },
        normalizeColor(color) {
            if (!color) return '';
            if (typeof color === 'object' && color.hexa) {
                return color.hexa;
            }
            if (typeof color === 'object' && color.hex) {
                return color.hex;
            }
            return String(color);
        },
        saveRules() {
            const normalizedRules = this.rules.map((rule, index) => {
                const normalized = {
                    ...rule,
                    priority: index + 1
                };

                if (rule.type === 'taskType') {
                    normalized.fillColor = this.normalizeColor(rule.fillColor);
                    normalized.strokeColor = this.normalizeColor(rule.strokeColor);
                }
                // leadTime rules only need minDuration and maxDuration

                return normalized;
            });
            this.$emit('save', normalizedRules);
            this.closeDialog();
        },
        closeDialog() {
            this.dialogVisible = false;
        }
    }
};
</script>

<style scoped>
.color-ruleset-dialog {
    overflow: hidden;
}

.add-rule-section {
    background: #f8f9fa;
    border-radius: 8px;
    padding: 16px;
}

.empty-state {
    background: #fafafa;
    border-radius: 8px;
    border: 2px dashed #e0e0e0;
}

.rule-card {
    border-radius: 8px !important;
    transition: all 0.2s ease;
}

.rule-card:hover {
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.rule-card.rule-disabled {
    opacity: 0.6;
    background: #fafafa;
}

.rule-header {
    background: #fafafa;
    border-radius: 8px 8px 0 0;
}

.color-preview-box {
    width: 32px;
    height: 32px;
    border-radius: 6px;
    border: 2px solid;
    flex-shrink: 0;
}


.rule-name-input {
    font-weight: 500;
}

.rule-name-input :deep(input) {
    font-size: 14px;
}

.preset-colors {
    padding: 4px;
    background: #f5f5f5;
    border-radius: 6px;
}

.preset-color {
    width: 24px;
    height: 24px;
    border-radius: 4px;
    border: 1px solid #ddd;
    cursor: pointer;
    transition: all 0.15s ease;
}

.preset-color:hover {
    transform: scale(1.15);
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}

.preset-color.selected {
    border: 2px solid #1976d2;
    box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.3);
}

.color-picker-btn {
    width: 32px;
    height: 32px;
    border-radius: 6px;
    border: 1px solid #ccc;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
}

.color-picker-btn:hover {
    box-shadow: 0 2px 4px rgba(0,0,0,0.15);
}

.condition-section {
    background: #fafafa;
    border-radius: 6px;
    padding: 12px;
}

.color-section {
    background: #fff;
    border-radius: 6px;
    padding: 12px;
    border: 1px solid #eee;
}

.duplicate-warning {
    border-color: #ff9800 !important;
}

.duration-input-group {
    background: #fff;
    border-radius: 6px;
    padding: 8px 12px;
    border: 1px solid #eee;
}

.intensity-preview-box {
    width: 32px;
    height: 32px;
    border-radius: 6px;
    border: 1px solid #ccc;
    flex-shrink: 0;
    background: linear-gradient(to right, #fdf2d0, #7a6520);
}

.intensity-preview-bar {
    height: 16px;
    border-radius: 4px;
    background: linear-gradient(to right,
        rgba(200, 200, 200, 0.3),
        rgba(50, 50, 50, 0.8)
    );
    border: 1px solid rgba(0,0,0,0.1);
}

.intensity-section {
    margin-top: 12px;
}
</style>
