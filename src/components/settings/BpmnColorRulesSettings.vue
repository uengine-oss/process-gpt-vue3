<template>
    <v-card class="color-rules-settings">
        <v-card-title class="d-flex align-center">
            <v-icon class="mr-2">mdi-palette-outline</v-icon>
            {{ $t('colorRules.title') }}
            <v-spacer />
            <v-btn icon variant="text" @click="$emit('close')">
                <v-icon>mdi-close</v-icon>
            </v-btn>
        </v-card-title>

        <v-card-text>
            <!-- Default Color Section -->
            <div class="mb-4">
                <v-label class="mb-2">{{ $t('colorRules.defaultColor') }}</v-label>
                <div class="d-flex align-center gap-2">
                    <div
                        class="color-preview"
                        :style="{ backgroundColor: colorRulesStore.defaultColor }"
                    />
                    <v-menu :close-on-content-click="false">
                        <template v-slot:activator="{ props }">
                            <v-btn v-bind="props" size="small" variant="outlined">
                                {{ colorRulesStore.defaultColor }}
                            </v-btn>
                        </template>
                        <v-color-picker
                            v-model="tempDefaultColor"
                            mode="hexa"
                            @update:model-value="updateDefaultColor"
                        />
                    </v-menu>
                </div>
            </div>

            <v-divider class="my-4" />

            <!-- Rules Section -->
            <div class="d-flex align-center mb-3">
                <v-label>{{ $t('colorRules.rulesList') }}</v-label>
                <v-spacer />
                <v-btn
                    color="primary"
                    size="small"
                    @click="openAddDialog"
                >
                    <v-icon left>mdi-plus</v-icon>
                    {{ $t('colorRules.addRule') }}
                </v-btn>
            </div>

            <!-- Rules List -->
            <v-list v-if="colorRulesStore.sortedRules.length > 0" density="compact">
                <draggable
                    v-model="draggableRules"
                    item-key="id"
                    handle=".drag-handle"
                    @end="onDragEnd"
                >
                    <template #item="{ element }">
                        <v-list-item class="rule-item mb-2">
                            <template v-slot:prepend>
                                <v-icon class="drag-handle mr-2" style="cursor: grab;">
                                    mdi-drag
                                </v-icon>
                                <div
                                    class="color-preview mr-3"
                                    :style="{ backgroundColor: element.fillColor }"
                                />
                            </template>

                            <v-list-item-title>
                                {{ element.name }}
                            </v-list-item-title>
                            <v-list-item-subtitle>
                                <v-chip
                                    size="x-small"
                                    :color="element.type === 'taskType' ? 'blue' : 'orange'"
                                    class="mr-1"
                                >
                                    {{ element.type === 'taskType' ? $t('colorRules.taskType') : $t('colorRules.leadTime') }}
                                </v-chip>
                                <span v-if="element.type === 'taskType'">
                                    {{ element.taskTypes?.length || 0 }} {{ $t('colorRules.types') }}
                                </span>
                                <span v-else>
                                    {{ element.minDuration ?? 0 }} - {{ element.maxDuration ?? '∞' }} {{ $t('colorRules.days') }}
                                </span>
                            </v-list-item-subtitle>

                            <template v-slot:append>
                                <v-switch
                                    v-model="element.enabled"
                                    hide-details
                                    density="compact"
                                    color="primary"
                                    @update:model-value="toggleRule(element)"
                                />
                                <v-btn
                                    icon
                                    variant="text"
                                    size="small"
                                    @click="editRule(element)"
                                >
                                    <v-icon>mdi-pencil</v-icon>
                                </v-btn>
                                <v-btn
                                    icon
                                    variant="text"
                                    size="small"
                                    color="error"
                                    @click="deleteRule(element.id)"
                                >
                                    <v-icon>mdi-delete</v-icon>
                                </v-btn>
                            </template>
                        </v-list-item>
                    </template>
                </draggable>
            </v-list>

            <v-alert v-else type="info" variant="tonal" density="compact">
                {{ $t('colorRules.noRules') }}
            </v-alert>
        </v-card-text>

        <!-- Add/Edit Dialog -->
        <ColorRuleDialog
            v-model="showDialog"
            :rule="editingRule"
            :is-edit="isEditMode"
            @save="saveRule"
        />
    </v-card>
</template>

<script>
import { defineComponent, ref, computed, onMounted } from 'vue';
import { useColorRulesStore } from '@/stores/colorRules';
import ColorRuleDialog from './ColorRuleDialog.vue';
import draggable from 'vuedraggable';

export default defineComponent({
    name: 'BpmnColorRulesSettings',
    components: {
        ColorRuleDialog,
        draggable
    },
    emits: ['close'],
    setup() {
        const colorRulesStore = useColorRulesStore();
        const showDialog = ref(false);
        const editingRule = ref(null);
        const isEditMode = ref(false);
        const tempDefaultColor = ref(colorRulesStore.defaultColor);

        const draggableRules = computed({
            get: () => colorRulesStore.sortedRules,
            set: (value) => colorRulesStore.reorderRules(value)
        });

        onMounted(() => {
            if (!colorRulesStore.isLoaded) {
                colorRulesStore.loadRules();
            }
            tempDefaultColor.value = colorRulesStore.defaultColor;
        });

        const openAddDialog = () => {
            editingRule.value = null;
            isEditMode.value = false;
            showDialog.value = true;
        };

        const editRule = (rule) => {
            editingRule.value = { ...rule };
            isEditMode.value = true;
            showDialog.value = true;
        };

        const saveRule = (rule) => {
            if (isEditMode.value) {
                colorRulesStore.updateRule(rule);
            } else {
                colorRulesStore.addRule(rule);
            }
            showDialog.value = false;
        };

        const deleteRule = (id) => {
            colorRulesStore.deleteRule(id);
        };

        const toggleRule = (rule) => {
            colorRulesStore.updateRule(rule);
        };

        const updateDefaultColor = (color) => {
            colorRulesStore.setDefaultColor(color);
        };

        const onDragEnd = () => {
            colorRulesStore.reorderRules(draggableRules.value);
        };

        return {
            colorRulesStore,
            showDialog,
            editingRule,
            isEditMode,
            draggableRules,
            tempDefaultColor,
            openAddDialog,
            editRule,
            saveRule,
            deleteRule,
            toggleRule,
            updateDefaultColor,
            onDragEnd
        };
    }
});
</script>

<style scoped>
.color-rules-settings {
    min-width: 500px;
    max-width: 700px;
}

.color-preview {
    width: 24px;
    height: 24px;
    border-radius: 4px;
    border: 1px solid #ccc;
}

.rule-item {
    border: 1px solid #e0e0e0;
    border-radius: 8px;
}

.drag-handle:hover {
    color: #1976d2;
}
</style>
