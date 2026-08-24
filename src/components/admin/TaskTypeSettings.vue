<template>
    <div>
        <!-- Info Banner: alert.info.v1 -->
        <v-alert dense outlined type="info" color="gray" class="mb-4 pa-4 pt-2 pb-2">
            <v-row class="ma-0 pa-0">
                <span class="text-body-1">{{ $t('taskCatalog.taskTypesDescription') }}</span>
            </v-row>
        </v-alert>

        <v-tabs v-model="activeCategory" color="primary" density="compact" class="mb-3">
            <v-tab value="tasks">Task</v-tab>
            <v-tab value="events">Event</v-tab>
        </v-tabs>

        <!-- Desktop: [BLOCK:table.simple.v1] -->
        <v-card v-if="!isMobile" class="pa-0" variant="outlined">
            <v-table density="comfortable" class="type-settings-table">
                <thead>
                    <tr>
                        <th class="type-icon-column"></th>
                        <th>{{ typeHeader }}</th>
                        <th>Key</th>
                        <th style="width: 100px">{{ $t('taskCatalog.enabled') }}</th>
                        <th style="width: 120px">{{ $t('taskCatalog.status') }}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-if="loading">
                        <td colspan="5" class="text-center pa-8">
                            <v-progress-circular indeterminate size="32" color="primary" />
                        </td>
                    </tr>
                    <tr v-else-if="settingItems.length === 0">
                        <td colspan="5" class="text-center pa-8 text-medium-emphasis">
                            {{ emptyMessage }}
                        </td>
                    </tr>
                    <template v-else>
                        <tr v-for="item in settingItems" :key="item.id">
                            <td>
                                <div class="type-icon" :style="{ backgroundColor: getSettingColor(item) }">
                                    <v-icon size="16" color="white">{{ getSettingIcon(item) }}</v-icon>
                                </div>
                            </td>
                            <td class="setting-main-cell">
                                <div class="setting-name">{{ getLabel(item) }}</div>
                                <div v-if="item.group" class="setting-group">{{ item.group }}</div>
                            </td>
                            <td class="setting-key">{{ item.value }}</td>
                            <td>
                                <v-switch
                                    :model-value="item.is_enabled"
                                    color="primary"
                                    density="compact"
                                    hide-details
                                    @update:model-value="toggleSettingItem(item)"
                                />
                            </td>
                            <td>
                                <v-chip :color="item.is_enabled ? 'success' : 'grey'" size="small" variant="tonal">
                                    {{ item.is_enabled ? $t('taskCatalog.enabled') : $t('taskCatalog.disabled') }}
                                </v-chip>
                            </td>
                        </tr>
                    </template>
                </tbody>
            </v-table>
        </v-card>

        <!-- Mobile: Card Layout -->
        <div v-else>
            <div v-if="loading" class="text-center pa-8">
                <v-progress-circular indeterminate size="32" color="primary" />
            </div>
            <div v-else-if="settingItems.length === 0" class="text-center pa-8 text-medium-emphasis">
                {{ emptyMessage }}
            </div>
            <div v-else class="d-flex flex-column ga-3">
                <v-card v-for="item in settingItems" :key="item.id" variant="outlined" class="pa-4">
                    <div class="d-flex justify-space-between align-center">
                        <div class="d-flex align-center" style="min-width: 0">
                            <div class="type-icon" :style="{ backgroundColor: getSettingColor(item) }">
                                <v-icon size="16" color="white">{{ getSettingIcon(item) }}</v-icon>
                            </div>
                            <div class="ml-3" style="min-width: 0">
                                <div class="text-subtitle-2 font-weight-bold text-truncate">{{ getLabel(item) }}</div>
                                <div class="text-caption text-grey text-truncate">{{ item.value }}</div>
                                <div v-if="item.group" class="text-caption text-grey text-truncate">{{ item.group }}</div>
                            </div>
                        </div>
                        <div class="d-flex align-center flex-shrink-0 ml-2">
                            <v-switch
                                :model-value="item.is_enabled"
                                color="primary"
                                density="compact"
                                hide-details
                                @update:model-value="toggleSettingItem(item)"
                            />
                            <v-chip :color="item.is_enabled ? 'success' : 'grey'" size="small" variant="tonal" class="ml-2">
                                {{ item.is_enabled ? $t('taskCatalog.enabled') : $t('taskCatalog.disabled') }}
                            </v-chip>
                        </div>
                    </div>
                </v-card>
            </div>
        </div>
    </div>
</template>

<script>
import { AVAILABLE_EVENT_TYPES, AVAILABLE_TASK_TYPES, DEFAULT_VISIBLE_EVENT_TYPES, DEFAULT_VISIBLE_TASK_TYPES, useTaskCatalogStore } from '@/stores/taskCatalog';

export default {
    name: 'TaskTypeSettings',
    data() {
        return {
            store: null,
            activeCategory: 'tasks'
        };
    },
    computed: {
        isMobile() {
            return window.innerWidth <= 768;
        },
        loading() {
            return this.store?.loading || false;
        },
        typeHeader() {
            return this.activeCategory === 'events' ? 'Event Type' : this.$t('taskCatalog.taskType');
        },
        emptyMessage() {
            return this.activeCategory === 'events' ? '설정 가능한 Event가 없습니다.' : this.$t('taskCatalog.noTaskTypes');
        },
        settingItems() {
            return this.activeCategory === 'events' ? this.eventTypeSettings : this.taskTypeSettings;
        },
        taskTypeSettings() {
            if (!this.store) return [];

            const visibleTaskTypes = new Set(this.store.paletteSettings?.visibleTaskTypes || DEFAULT_VISIBLE_TASK_TYPES);
            const backendByType = new Map((this.store.paletteTaskTypes || []).map((item) => [item.task_type, item]));

            return AVAILABLE_TASK_TYPES.map((taskType, index) => {
                const backendItem = backendByType.get(taskType.value);

                return {
                    id: backendItem?.id || `settings:${taskType.value}`,
                    kind: 'task',
                    value: taskType.value,
                    label: backendItem?.label || taskType.label,
                    label_ko: backendItem?.label_ko || taskType.labelKo,
                    icon: backendItem?.icon || this.getDefaultTaskTypeIcon(taskType.value),
                    is_enabled: backendItem ? backendItem.is_enabled !== false : visibleTaskTypes.has(taskType.value),
                    display_order: backendItem?.display_order ?? (index + 1) * 10,
                    source: backendItem ? 'db' : 'settings'
                };
            });
        },
        eventTypeSettings() {
            if (!this.store) return [];

            const visibleEventTypes = new Set(this.store.paletteSettings?.visibleEventTypes || DEFAULT_VISIBLE_EVENT_TYPES);

            return AVAILABLE_EVENT_TYPES.map((eventType, index) => ({
                id: `event:${eventType.value}`,
                kind: 'event',
                value: eventType.value,
                label: eventType.label,
                label_ko: eventType.labelKo,
                group: eventType.group,
                icon: eventType.icon,
                is_enabled: visibleEventTypes.has(eventType.value),
                display_order: index + 1,
                source: 'settings'
            }));
        }
    },
    methods: {
        getLabel(item) {
            return this.$i18n.locale === 'ko' && item.label_ko ? item.label_ko : item.label;
        },
        getDefaultTaskTypeIcon(taskType) {
            const icons = {
                'bpmn:Task': 'mdi-checkbox-blank-outline',
                'bpmn:ManualTask': 'mdi-hand-back-left-outline',
                'bpmn:UserTask': 'mdi-account-outline',
                'bpmn:ServiceTask': 'mdi-cog-outline',
                'bpmn:ScriptTask': 'mdi-script-text-outline',
                'bpmn:BusinessRuleTask': 'mdi-clipboard-check-outline',
                'bpmn:SendTask': 'mdi-send-outline',
                'bpmn:ReceiveTask': 'mdi-inbox-arrow-down-outline',
                'bpmn:CallActivity': 'mdi-open-in-new',
                'bpmn:SubProcess': 'mdi-plus-box-outline',
                'bpmn:AdHocSubProcess': 'mdi-shuffle-variant',
                'bpmn:Transaction': 'mdi-checkbox-multiple-blank-outline'
            };
            return icons[taskType] || 'mdi-checkbox-blank-outline';
        },
        getSettingIcon(item) {
            if (item.kind === 'event') {
                return item.icon || 'mdi-circle-outline';
            }
            if (item.icon && item.icon.startsWith('mdi-')) {
                return item.icon;
            }
            return this.getDefaultTaskTypeIcon(item.value);
        },
        getSettingColor(item) {
            if (item.kind === 'event') {
                const eventColors = {
                    Start: '#2E7D32',
                    Intermediate: '#5E35B1',
                    End: '#C62828',
                    Boundary: '#00838F'
                };
                return eventColors[item.group] || '#546E7A';
            }

            const colors = {
                'bpmn:ManualTask': '#FF9800',
                'bpmn:UserTask': '#2196F3',
                'bpmn:ServiceTask': '#4CAF50',
                'bpmn:ScriptTask': '#9C27B0',
                'bpmn:BusinessRuleTask': '#795548',
                'bpmn:SendTask': '#00BCD4',
                'bpmn:ReceiveTask': '#607D8B',
                'bpmn:AdHocSubProcess': '#009688',
                'bpmn:Task': '#9E9E9E',
                'bpmn:CallActivity': '#3F51B5',
                'bpmn:SubProcess': '#673AB7',
                'bpmn:Transaction': '#455A64'
            };
            return colors[item.value] || '#9E9E9E';
        },
        async toggleSettingItem(item) {
            try {
                if (item.kind === 'event') {
                    await this.store.setEventTypeVisible(item.value, !item.is_enabled);
                    return;
                }

                if (item.source === 'db') {
                    await this.store.togglePaletteTaskType(item.id);
                    return;
                }

                await this.store.setTaskTypeVisible(item.value, !item.is_enabled);
            } catch (error) {
                console.error('Failed to toggle type setting:', error);
            }
        }
    },
    async mounted() {
        this.store = useTaskCatalogStore();
        if (!this.store.paletteTaskTypesLoaded) {
            await this.store.loadPaletteTaskTypes();
        }
        if (!this.store.paletteSettingsLoaded) {
            await this.store.loadPaletteSettings();
        }
    }
};
</script>

<style scoped>
.type-icon {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.type-icon-column {
    width: 56px;
}

.type-settings-table :deep(table) {
    table-layout: fixed;
    min-width: 760px;
}

.type-settings-table :deep(th),
.type-settings-table :deep(td) {
    vertical-align: middle;
}

.setting-main-cell {
    min-width: 0;
}

.setting-name {
    color: rgba(var(--v-theme-on-surface), 0.9);
    font-size: 0.9rem;
    font-weight: 600;
    line-height: 1.35;
    overflow-wrap: anywhere;
}

.setting-group {
    color: rgba(var(--v-theme-on-surface), 0.54);
    font-size: 0.75rem;
    line-height: 1.3;
    margin-top: 2px;
}

.setting-key {
    color: rgba(var(--v-theme-on-surface), 0.48);
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
    font-size: 0.76rem;
    line-height: 1.35;
    overflow-wrap: anywhere;
}
</style>
