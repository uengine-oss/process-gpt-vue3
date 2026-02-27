<template>
    <div class="task-catalog-panel" :class="{ 'collapsed': isCollapsed }">
        <!-- Header -->
        <v-tooltip v-if="isCollapsed" location="right">
            <template #activator="{ props }">
                <div class="catalog-header" v-bind="props" @click="isCollapsed = !isCollapsed">
                    <v-icon size="18" class="collapse-icon">
                        {{ isCollapsed ? 'mdi-chevron-up' : 'mdi-chevron-down' }}
                    </v-icon>
                </div>
            </template>
            <span>Task Catalog</span>
        </v-tooltip>
        <div v-else class="catalog-header" @click="isCollapsed = !isCollapsed">
            <div class="header-left">
                <v-icon size="18" color="primary">mdi-folder-star</v-icon>
                <span class="header-title">Task Catalog</span>
                <v-chip
                    v-if="filteredItems.length > 0"
                    size="x-small"
                    color="primary"
                    variant="tonal"
                    class="count-badge"
                >
                    {{ filteredItems.length }}
                </v-chip>
            </div>
            <v-icon size="18" class="collapse-icon">
                {{ isCollapsed ? 'mdi-chevron-up' : 'mdi-chevron-down' }}
            </v-icon>
        </div>

        <div v-show="!isCollapsed" class="catalog-content">
            <!-- Search & Filter Row -->
            <div class="search-row">
                <div
                    class="d-flex align-center border border-borderColor header-search rounded-pill px-5 search-input"
                    style="max-width: 246px; min-width: 160px;"
                >
                    <Icons :icon="'magnifer-linear'" :size="20" />
                    <v-text-field
                        v-model="searchQuery"
                        placeholder="검색..."
                        variant="plain"
                        density="compact"
                        class="position-relative pt-0 ml-3 custom-placeholer-color"
                        single-line
                        hide-details
                    />
                </div>
                <v-btn
                    icon
                    size="small"
                    variant="text"
                    :color="showFilters ? 'primary' : 'grey'"
                    @click="showFilters = !showFilters"
                    class="filter-toggle"
                >
                    <v-icon size="18">mdi-filter-variant</v-icon>
                    <v-badge
                        v-if="activeFilterCount > 0"
                        :content="activeFilterCount"
                        color="primary"
                        floating
                        dot
                    />
                </v-btn>
            </div>

            <!-- Collapsible Filters -->
            <v-expand-transition>
                <div v-show="showFilters" class="filters-container">
                    <v-select
                        v-model="selectedSystem"
                        :items="systemOptions"
                        label="System"
                        density="compact"
                        variant="outlined"
                        hide-details
                        clearable
                        class="filter-field"
                    />
                    <div class="level-row">
                        <v-select
                            v-model="selectedLevel"
                            :items="levelOptions"
                            label="Level"
                            density="compact"
                            variant="outlined"
                            hide-details
                            clearable
                            class="filter-field"
                        />
                    </div>
                    <v-btn
                        v-if="activeFilterCount > 0"
                        variant="text"
                        size="x-small"
                        color="grey"
                        @click="clearFilters"
                        class="clear-btn"
                    >
                        필터 초기화
                    </v-btn>
                </div>
            </v-expand-transition>

            <!-- Catalog Items -->
            <div class="catalog-items" ref="catalogItemsRef">
                <div v-if="loading" class="loading-state">
                    <v-progress-circular size="24" indeterminate color="primary" />
                    <span>불러오는 중...</span>
                </div>

                <div v-else-if="filteredItems.length === 0" class="empty-state">
                    <v-icon size="40" color="grey-lighten-1">mdi-folder-open-outline</v-icon>
                    <span>등록된 Task가 없습니다</span>
                </div>

                <div
                    v-else
                    v-for="item in filteredItems"
                    :key="item.id"
                    class="catalog-card"
                    draggable="true"
                    @dragstart="onDragStart($event, item)"
                    @dragend="onDragEnd"
                >
                    <div class="card-drag-handle">
                        <v-icon size="14" color="grey-lighten-1">mdi-drag-vertical</v-icon>
                    </div>
                    <div class="card-content">
                        <div class="card-icon" :style="{ backgroundColor: getTaskTypeColor(item.task_type) }">
                            <v-icon size="14" color="white">{{ getTaskTypeIcon(item.task_type) }}</v-icon>
                        </div>
                        <div class="card-info">
                            <div class="card-name">{{ item.display_name || item.name }}</div>
                            <div class="card-meta">
                                <span v-if="item.system_name" class="meta-system">{{ item.system_name }}</span>
                                <span v-if="item.level" class="meta-level">{{ item.level }}</span>
                            </div>
                        </div>
                    </div>
                    <div v-if="item.properties?.fte" class="card-fte">
                        <span class="fte-value">{{ item.properties.fte }}</span>
                        <span class="fte-label">FTE</span>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { defineComponent, ref, computed, onMounted } from 'vue';
import { useTaskCatalogStore } from '@/stores/taskCatalog';

export default defineComponent({
    name: 'TaskCatalogSection',
    props: {
        bpmnModeler: Object
    },
    emits: ['catalog-item-dropped'],
    setup(props, { emit }) {
        const store = useTaskCatalogStore();

        const isCollapsed = ref(false);
        const showFilters = ref(false);
        const searchQuery = ref('');
        const selectedSystem = ref(null);
        const selectedLevel = ref(null);

        const loading = computed(() => store.loading);
        const systems = computed(() => store.systems);
        const catalogItems = computed(() => store.catalogItems);

        const systemOptions = computed(() => {
            return systems.value.map(s => ({ title: s.name, value: s.name }));
        });

        const levelOptions = computed(() => {
            return [
                { title: 'L2', value: 'L2' },
                { title: 'L3', value: 'L3' },
                { title: 'L4', value: 'L4' },
                { title: 'L5', value: 'L5' }
            ];
        });

        const activeFilterCount = computed(() => {
            let count = 0;
            if (selectedSystem.value) count++;
            if (selectedLevel.value) count++;
            return count;
        });

        const filteredItems = computed(() => {
            let items = catalogItems.value;

            if (searchQuery.value) {
                const query = searchQuery.value.toLowerCase();
                items = items.filter(item =>
                    (item.display_name || '').toLowerCase().includes(query) ||
                    (item.name || '').toLowerCase().includes(query) ||
                    (item.description || '').toLowerCase().includes(query)
                );
            }

            if (selectedSystem.value) {
                items = items.filter(item => item.system_name === selectedSystem.value);
            }

            if (selectedLevel.value) {
                items = items.filter(item => item.level === selectedLevel.value);
            }

            return items;
        });

        const clearFilters = () => {
            selectedSystem.value = null;
            selectedLevel.value = null;
        };

        const getTaskTypeIcon = (taskType) => {
            const icons = {
                'bpmn:ManualTask': 'mdi-hand-back-right',
                'bpmn:UserTask': 'mdi-account',
                'bpmn:ServiceTask': 'mdi-cog',
                'bpmn:ScriptTask': 'mdi-code-tags',
                'bpmn:BusinessRuleTask': 'mdi-clipboard-check',
                'bpmn:SendTask': 'mdi-send',
                'bpmn:ReceiveTask': 'mdi-inbox',
                'bpmn:Task': 'mdi-checkbox-marked-outline'
            };
            return icons[taskType] || 'mdi-checkbox-marked-outline';
        };

        const getTaskTypeColor = (taskType) => {
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
        };

        const onDragStart = (event, item) => {
            event.dataTransfer.setData('application/json', JSON.stringify({
                type: 'task-catalog',
                item: item
            }));
            event.dataTransfer.effectAllowed = 'copy';
            event.target.classList.add('dragging');
        };

        const onDragEnd = (event) => {
            event.target.classList.remove('dragging');
        };

        onMounted(async () => {
            if (!store.systemsLoaded) {
                await store.loadSystems();
            }
            if (!store.catalogLoaded) {
                await store.loadCatalog();
            }
        });

        return {
            isCollapsed,
            showFilters,
            loading,
            searchQuery,
            selectedSystem,
            selectedLevel,
            systemOptions,
            levelOptions,
            activeFilterCount,
            filteredItems,
            clearFilters,
            getTaskTypeIcon,
            getTaskTypeColor,
            onDragStart,
            onDragEnd
        };
    }
});
</script>

<style scoped>
.task-catalog-panel {
    width: 220px;
    border: 1px solid #e8e8e8;
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    max-height: calc(100vh - 180px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    overflow: hidden;
    transition: all 0.3s ease;
}

.task-catalog-panel.collapsed {
    max-height: 40px;
    width: 40px;
}

/* Header */
.catalog-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px;
    background: rgba(var(--v-theme-primary));
    cursor: pointer;
    user-select: none;
}

.task-catalog-panel.collapsed .catalog-header {
    justify-content: center;
    padding: 8px;
}

.header-left {
    display: flex;
    align-items: center;
    gap: 8px;
}

.header-left .v-icon {
    color: white !important;
}

.header-title {
    font-size: 13px;
    font-weight: 600;
    color: white;
    letter-spacing: 0.3px;
}

.count-badge {
    font-size: 10px;
    height: 18px;
    background: rgba(255,255,255,0.25) !important;
    color: white !important;
}

.collapse-icon {
    color: rgba(255,255,255,0.8) !important;
    transition: transform 0.3s ease;
}

/* Content */
.catalog-content {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow: hidden;
}

/* Search Row */
.search-row {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 10px 10px 6px;
    background: #fff;
}

.search-input {
    flex: 1;
}

.search-input :deep(.v-field) {
    font-size: 12px;
}

.search-input :deep(.v-field__input) {
    padding: 6px 8px;
    min-height: 32px;
}

.filter-toggle {
    position: relative;
}

/* Filters */
.filters-container {
    padding: 8px 10px;
    background: #fafafa;
    border-bottom: 1px solid #f0f0f0;
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.filter-field :deep(.v-field) {
    font-size: 11px;
}

.level-row {
    display: flex;
    gap: 6px;
}

.clear-btn {
    align-self: flex-end;
    font-size: 10px;
    text-transform: none;
}

/* Catalog Items */
.catalog-items {
    flex: 1;
    overflow-y: auto;
    padding: 6px;
}

.catalog-items::-webkit-scrollbar {
    width: 4px;
}

.catalog-items::-webkit-scrollbar-track {
    background: transparent;
}

.catalog-items::-webkit-scrollbar-thumb {
    background: #ddd;
    border-radius: 4px;
}

/* Card */
.catalog-card {
    display: flex;
    align-items: center;
    padding: 8px;
    margin-bottom: 6px;
    background: white;
    border: 1px solid #eee;
    border-radius: 8px;
    cursor: grab;
    transition: all 0.2s ease;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}

.catalog-card:hover {
    border-color: #667eea;
    box-shadow: 0 3px 8px rgba(102, 126, 234, 0.15);
    transform: translateY(-1px);
}

.catalog-card.dragging {
    opacity: 0.6;
    cursor: grabbing;
    transform: scale(0.98);
    box-shadow: 0 8px 20px rgba(102, 126, 234, 0.25);
}

.card-drag-handle {
    padding: 0 4px;
    opacity: 0.4;
    transition: opacity 0.2s;
}

.catalog-card:hover .card-drag-handle {
    opacity: 1;
}

.card-content {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 0;
}

.card-icon {
    width: 26px;
    height: 26px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.card-info {
    flex: 1;
    min-width: 0;
}

.card-name {
    font-size: 12px;
    font-weight: 500;
    color: #333;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.3;
}

.card-meta {
    display: flex;
    gap: 4px;
    margin-top: 2px;
}

.meta-system,
.meta-level {
    font-size: 9px;
    padding: 1px 4px;
    border-radius: 3px;
    background: #f0f0f0;
    color: #666;
}

.meta-level {
    background: #e3f2fd;
    color: #1976d2;
}

.card-fte {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 2px 6px;
    background: linear-gradient(135deg, #f5f5f5 0%, #eeeeee 100%);
    border-radius: 4px;
    margin-left: 4px;
}

.fte-value {
    font-size: 11px;
    font-weight: 600;
    color: #333;
    line-height: 1;
}

.fte-label {
    font-size: 8px;
    color: #999;
    text-transform: uppercase;
}

/* States */
.loading-state,
.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 30px 20px;
    gap: 10px;
    color: #999;
    font-size: 12px;
}
</style>
