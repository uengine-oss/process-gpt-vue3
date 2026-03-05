<template>
    <div>
        <!-- Info Banner: alert.info.v1 -->
        <v-alert dense outlined type="info" color="gray" class="mb-4 pa-4 pt-2 pb-2">
            <v-row class="ma-0 pa-0">
                <span class="text-body-1">{{ $t('taskCatalog.taskTypesDescription') }}</span>
            </v-row>
        </v-alert>
        <v-card class="pa-0"
            variant="outlined"
        >
            <!-- 테이블 -->
            <v-table density="comfortable">
                <thead>
                    <tr>
                        <th>{{ $t('taskCatalog.taskType') }}</th>
                        <th>{{ $t('taskCatalog.label') }}</th>
                        <th style="width: 100px;">{{ $t('taskCatalog.enabled') }}</th>
                        <th style="width: 120px;">{{ $t('taskCatalog.status') }}</th>
                    </tr>
                </thead>
                <tbody>
                    <!-- 로딩 -->
                    <tr v-if="loading">
                        <td colspan="5" class="text-center pa-8">
                            <v-progress-circular indeterminate size="32" color="primary" />
                        </td>
                    </tr>
                    <!-- 데이터 없음 -->
                    <tr v-else-if="paletteTaskTypes.length === 0">
                        <td colspan="5" class="text-center pa-8 text-medium-emphasis">
                            {{ $t('taskCatalog.noTaskTypes') }}
                        </td>
                    </tr>
                    <!-- 데이터 목록 -->
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
