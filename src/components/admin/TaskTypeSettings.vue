<template>
    <div>
        <!-- Info Banner: alert.info.v1 -->
        <v-alert dense outlined type="info" color="gray" class="mb-4 pa-4 pt-2 pb-2">
            <v-row class="ma-0 pa-0">
                <span class="text-body-1">{{ $t('taskCatalog.taskTypesDescription') }}</span>
            </v-row>
        </v-alert>
        <!-- Desktop: [BLOCK:table.simple.v1] -->
        <v-card v-if="!isMobile" class="pa-0" variant="outlined">
            <v-table density="comfortable">
                <thead>
                    <tr>
                        <th>{{ $t('taskCatalog.taskType') }}</th>
                        <th>{{ $t('taskCatalog.label') }}</th>
                        <th style="width: 100px">{{ $t('taskCatalog.enabled') }}</th>
                        <th style="width: 120px">{{ $t('taskCatalog.status') }}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-if="loading">
                        <td colspan="4" class="text-center pa-8">
                            <v-progress-circular indeterminate size="32" color="primary" />
                        </td>
                    </tr>
                    <tr v-else-if="paletteTaskTypes.length === 0">
                        <td colspan="4" class="text-center pa-8 text-medium-emphasis">
                            {{ $t('taskCatalog.noTaskTypes') }}
                        </td>
                    </tr>
                    <template v-else>
                        <tr v-for="item in paletteTaskTypes" :key="item.id">
                            <td>
                                <div class="task-type-icon" :style="{ backgroundColor: getTaskTypeColor(item.task_type) }">
                                    <v-icon v-if="item.icon" size="16" color="white">{{ item.icon }}</v-icon>
                                </div>
                            </td>
                            <td class="text-caption text-grey">{{ item.task_type }}</td>
                            <td>{{ getLabel(item) }}</td>
                            <td>
                                <v-switch
                                    :model-value="item.is_enabled"
                                    color="primary"
                                    density="compact"
                                    hide-details
                                    @update:model-value="toggleTaskType(item.id)"
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
            <div v-else-if="paletteTaskTypes.length === 0" class="text-center pa-8 text-medium-emphasis">
                {{ $t('taskCatalog.noTaskTypes') }}
            </div>
            <div v-else class="d-flex flex-column ga-3">
                <v-card v-for="item in paletteTaskTypes" :key="item.id" variant="outlined" class="pa-4">
                    <div class="d-flex justify-space-between align-center">
                        <div class="d-flex align-center" style="min-width: 0">
                            <div class="task-type-icon" :style="{ backgroundColor: getTaskTypeColor(item.task_type) }">
                                <v-icon v-if="item.icon" size="16" color="white">{{ item.icon }}</v-icon>
                            </div>
                            <div class="ml-3" style="min-width: 0">
                                <div class="text-subtitle-2 font-weight-bold text-truncate">{{ getLabel(item) }}</div>
                                <div class="text-caption text-grey text-truncate">{{ item.task_type }}</div>
                            </div>
                        </div>
                        <div class="d-flex align-center flex-shrink-0 ml-2">
                            <v-switch
                                :model-value="item.is_enabled"
                                color="primary"
                                density="compact"
                                hide-details
                                @update:model-value="toggleTaskType(item.id)"
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
import { useTaskCatalogStore } from '@/stores/taskCatalog';

export default {
    name: 'TaskTypeSettings',
    data() {
        return {
            store: null
        };
    },
    computed: {
        isMobile() {
            return window.innerWidth <= 768;
        },
        loading() {
            return this.store?.loading || false;
        },
        paletteTaskTypes() {
            return this.store?.paletteTaskTypes || [];
        },
        headers() {
            return [
                { title: '', key: 'icon', sortable: false, width: '50px' },
                { title: this.$t('taskCatalog.taskType'), key: 'task_type', sortable: true },
                { title: this.$t('taskCatalog.label'), key: 'label', sortable: true },
                { title: this.$t('taskCatalog.enabled'), key: 'is_enabled', sortable: false, width: '100px' },
                { title: this.$t('taskCatalog.status'), key: 'status', sortable: false, width: '120px' }
            ];
        }
    },
    methods: {
        getLabel(item) {
            return this.$i18n.locale === 'ko' && item.label_ko ? item.label_ko : item.label;
        },
        getTaskTypeColor(taskType) {
            const colors = {
                'bpmn:ManualTask': '#FF9800',
                'bpmn:UserTask': '#2196F3',
                'bpmn:ServiceTask': '#4CAF50',
                'bpmn:ScriptTask': '#9C27B0',
                'bpmn:BusinessRuleTask': '#795548',
                'bpmn:SendTask': '#00BCD4',
                'bpmn:ReceiveTask': '#607D8B',
                'bpmn:Task': '#9E9E9E'
            };
            return colors[taskType] || '#9E9E9E';
        },
        async toggleTaskType(id) {
            try {
                await this.store.togglePaletteTaskType(id);
            } catch (error) {
                console.error('Failed to toggle task type:', error);
            }
        }
    },
    async mounted() {
        this.store = useTaskCatalogStore();
        if (!this.store.paletteTaskTypesLoaded) {
            await this.store.loadPaletteTaskTypes();
        }
    }
};
</script>

<style scoped>
.task-type-icon {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
}
</style>
