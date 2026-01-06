<template>
    <div class="settings-container">
        <!-- Info Banner -->
        <div class="info-banner">
            <v-icon size="18" color="primary">mdi-information-outline</v-icon>
            <span>{{ $t('taskCatalog.taskTypesDescription') }}</span>
        </div>

        <!-- Flat Table -->
        <div class="flat-table-container">
            <table class="flat-table">
                <thead>
                    <tr>
                        <th style="width: 50px;"></th>
                        <th>{{ $t('taskCatalog.taskType') }}</th>
                        <th>{{ $t('taskCatalog.label') }}</th>
                        <th style="width: 100px;">{{ $t('taskCatalog.enabled') }}</th>
                        <th style="width: 120px;">{{ $t('taskCatalog.status') }}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-if="loading">
                        <td colspan="5" class="loading-cell">
                            <v-progress-circular indeterminate size="24" color="primary" />
                        </td>
                    </tr>
                    <tr v-else-if="paletteTaskTypes.length === 0">
                        <td colspan="5" class="empty-cell">
                            {{ $t('taskCatalog.noTaskTypes') }}
                        </td>
                    </tr>
                    <tr v-else v-for="item in paletteTaskTypes" :key="item.id">
                        <td class="icon-cell">
                            <div class="task-type-icon" :style="{ backgroundColor: getTaskTypeColor(item.task_type) }">
                                <v-icon v-if="item.icon" size="16" color="white">{{ item.icon }}</v-icon>
                            </div>
                        </td>
                        <td class="type-cell">{{ item.task_type }}</td>
                        <td>{{ getLabel(item) }}</td>
                        <td>
                            <label class="flat-switch">
                                <input
                                    type="checkbox"
                                    :checked="item.is_enabled"
                                    @change="toggleTaskType(item.id)"
                                />
                                <span class="slider"></span>
                            </label>
                        </td>
                        <td>
                            <span class="status-badge" :class="item.is_enabled ? 'enabled' : 'disabled'">
                                {{ item.is_enabled ? $t('taskCatalog.enabled') : $t('taskCatalog.disabled') }}
                            </span>
                        </td>
                    </tr>
                </tbody>
            </table>
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
.settings-container {
    padding: 24px;
}

/* Info Banner */
.info-banner {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    background: #eff6ff;
    border: 1px solid #dbeafe;
    border-radius: 8px;
    margin-bottom: 20px;
    font-size: 13px;
    color: #1e40af;
}

/* Flat Table */
.flat-table-container {
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    overflow: hidden;
}

.flat-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
}

.flat-table thead {
    background: #f9fafb;
}

.flat-table th {
    padding: 12px 16px;
    text-align: left;
    font-weight: 600;
    color: #374151;
    border-bottom: 1px solid #e5e7eb;
}

.flat-table td {
    padding: 12px 16px;
    border-bottom: 1px solid #f3f4f6;
    color: #4b5563;
}

.flat-table tbody tr:last-child td {
    border-bottom: none;
}

.flat-table tbody tr:hover {
    background: #f9fafb;
}

.icon-cell {
    width: 50px;
}

.task-type-icon {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.type-cell {
    font-family: monospace;
    font-size: 12px;
    color: #6b7280;
}

.loading-cell,
.empty-cell {
    text-align: center;
    padding: 40px 16px !important;
    color: #9ca3af;
}

/* Flat Switch */
.flat-switch {
    position: relative;
    display: inline-block;
    width: 40px;
    height: 22px;
}

.flat-switch input {
    opacity: 0;
    width: 0;
    height: 0;
}

.slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: #e5e7eb;
    border-radius: 22px;
    transition: 0.2s;
}

.slider:before {
    position: absolute;
    content: "";
    height: 16px;
    width: 16px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    border-radius: 50%;
    transition: 0.2s;
}

.flat-switch input:checked + .slider {
    background-color: #3b82f6;
}

.flat-switch input:checked + .slider:before {
    transform: translateX(18px);
}

/* Status Badge */
.status-badge {
    display: inline-block;
    padding: 4px 10px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
}

.status-badge.enabled {
    background: #dcfce7;
    color: #166534;
}

.status-badge.disabled {
    background: #f3f4f6;
    color: #6b7280;
}
</style>
