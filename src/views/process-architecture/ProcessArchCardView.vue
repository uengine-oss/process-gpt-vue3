<template>
    <div class="card-view-container">
        <div v-if="!procMap.mega_proc_list || procMap.mega_proc_list.length === 0"
            class="text-center text-grey pa-10"
        >
            {{ $t('processArchitecture.noData') }}
        </div>
        <div v-else class="columns-wrapper">
            <div
                v-for="col in columns"
                :key="col.key"
                class="board-column"
            >
                <!-- Column Header -->
                <div class="column-header" :style="{ borderBottomColor: col.color }">
                    <div class="column-header-top">
                        <div class="d-flex align-center ga-2 flex-grow-1">
                            <v-icon :color="col.color" size="18">{{ col.icon }}</v-icon>
                            <!-- Inline edit mode -->
                            <template v-if="editingColumnKey === col.key">
                                <v-text-field
                                    v-model="editingColumnName"
                                    density="compact"
                                    variant="underlined"
                                    hide-details
                                    autofocus
                                    style="max-width: 140px; font-size: 0.95rem;"
                                    @keyup.enter="saveColumnName(col.key)"
                                    @keyup.escape="cancelEditColumn"
                                    @blur="saveColumnName(col.key)"
                                />
                            </template>
                            <template v-else>
                                <span class="text-subtitle-1 font-weight-bold">{{ col.label }}</span>
                                <v-btn
                                    v-if="isAdmin"
                                    icon
                                    size="x-small"
                                    variant="text"
                                    :title="$t('processArchitecture.board.editColumnName')"
                                    @click.stop="startEditColumn(col)"
                                >
                                    <v-icon size="14" color="grey-darken-1">mdi-pencil-outline</v-icon>
                                </v-btn>
                            </template>
                        </div>
                        <v-chip
                            :color="col.color"
                            size="x-small"
                            variant="tonal"
                        >
                            {{ getMajorCountForColumn(col.key) }}
                        </v-chip>
                    </div>
                    <div class="column-stats mt-1">
                        <span class="stat-text">
                            {{ $t('processArchitecture.board.totalProcesses') }}:
                            <strong>{{ getTotalSubProcessCount(col.key) }}</strong>
                        </span>
                        <span class="stat-divider">·</span>
                        <span class="stat-text text-orange">
                            {{ $t('processArchitecture.board.reviewing') }}:
                            <strong>{{ getReviewingCount(col.key) }}</strong>{{ $t('processArchitecture.board.countUnit') }}
                        </span>
                    </div>
                </div>

                <!-- Major Process Cards with Infinite Scroll -->
                <div
                    class="cards-list"
                    :ref="el => setColumnRef(el as HTMLElement | null, col.key)"
                    @scroll="onColumnScroll(col.key)"
                >
                    <v-card
                        v-for="major in getVisibleMajors(col.key)"
                        :key="major.id"
                        variant="outlined"
                        class="major-card mb-3"
                        rounded="lg"
                    >
                        <div class="card-header pa-3 pb-2">
                            <!-- Domain Tag + Process ID row -->
                            <div class="d-flex align-center justify-space-between mb-1">
                                <v-chip
                                    v-if="major.domain || major.domain_id"
                                    :color="getDomainColor(major.domain || major.domain_id)"
                                    size="x-small"
                                    variant="flat"
                                    class="domain-chip"
                                >
                                    {{ major.domain || major.domain_id }}
                                </v-chip>
                                <span v-else class="invisible-spacer" />
                                <span
                                    v-if="major.id"
                                    class="text-caption text-grey-darken-1 font-weight-medium process-id"
                                >
                                    [{{ major.id }}]
                                </span>
                            </div>
                            <!-- Title: 1-line ellipsis -->
                            <div class="card-title text-subtitle-2 font-weight-semibold">
                                {{ major.name }}
                            </div>
                        </div>
                        <v-divider />
                        <div class="sub-list pa-2">
                            <div
                                v-for="sub in getSortedSubs(major)"
                                :key="sub.id"
                                class="sub-item d-flex align-center pa-2 rounded cursor-pointer"
                                :class="{
                                    'wip-item': showToBe && getStatus(sub.id)?.status === 'wip',
                                    'sunset-item': showToBe && getStatus(sub.id)?.status === 'sunset'
                                }"
                                @click="$emit('navigate', sub.id, sub.name)"
                            >
                                <v-icon size="14" class="mr-2 text-grey">mdi-file-document-outline</v-icon>
                                <span class="text-body-2 flex-grow-1 text-truncate">{{ sub.name }}</span>
                                <v-btn
                                    icon
                                    variant="text"
                                    size="x-small"
                                    :class="['fav-btn ml-1', { 'is-fav': favorites?.has(sub.id) }]"
                                    @click.stop="emit('toggleFavorite', sub.id)"
                                >
                                    <v-icon
                                        size="14"
                                        :color="favorites?.has(sub.id) ? 'amber' : 'grey-lighten-1'"
                                    >
                                        {{ favorites?.has(sub.id) ? 'mdi-star' : 'mdi-star-outline' }}
                                    </v-icon>
                                </v-btn>
                                <ProgressBadge
                                    v-if="getStatus(sub.id)"
                                    type="status"
                                    :status="getStatus(sub.id).status"
                                    :d-day="getStatus(sub.id).dDay ?? null"
                                    :review-end-date="getStatus(sub.id).reviewEndDate ?? ''"
                                    size="x-small"
                                    class="ml-1"
                                />
                                <span
                                    v-if="getStatus(sub.id)?.version"
                                    class="text-caption text-grey ml-1"
                                >
                                    v{{ getStatus(sub.id).version }}
                                </span>
                            </div>
                            <div v-if="!major.sub_proc_list || major.sub_proc_list.length === 0"
                                class="text-caption text-grey-lighten-1 pa-2 text-center"
                            >
                                {{ $t('processArchitecture.noSubProcesses') }}
                            </div>
                        </div>
                    </v-card>

                    <!-- Loading indicator when more items available -->
                    <div
                        v-if="hasMoreMajors(col.key)"
                        class="load-more-trigger pa-2 text-center"
                    >
                        <v-progress-circular size="20" width="2" indeterminate color="grey" />
                    </div>

                    <div v-if="getMajorsForColumn(col.key).length === 0" class="empty-column pa-4 text-center">
                        <v-icon size="32" color="grey-lighten-2">mdi-inbox-outline</v-icon>
                        <p class="text-caption text-grey mt-2">{{ $t('processArchitecture.board.noItems') }}</p>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, getCurrentInstance } from 'vue';
import ProgressBadge from '@/components/ui/ProgressBadge.vue';

const instance = getCurrentInstance()!;
const t = (key: string) => instance.proxy!.$t(key);

const COLUMN_NAMES_STORAGE_KEY = 'process_arch_column_names';

const props = defineProps<{
    procMap: any;
    domains: any[];
    processStatuses: Map<string, any>;
    selectedDomain: string | null;
    showToBe?: boolean;
    isAdmin?: boolean;
    favorites?: Set<string>;
}>();

const emit = defineEmits<{
    (e: 'navigate', id: string, name?: string): void;
    (e: 'toggleFavorite', id: string): void;
}>();

// 5 fixed columns definition
const COLUMN_DEFS = [
    {
        key: 'design',
        labelKey: 'processArchitecture.board.columns.design',
        color: '#1976D2',
        icon: 'mdi-pencil-ruler',
        keywords: ['설계', 'design', '계획', 'plan', 'planning']
    },
    {
        key: 'build',
        labelKey: 'processArchitecture.board.columns.build',
        color: '#388E3C',
        icon: 'mdi-hammer-wrench',
        keywords: ['구축', 'build', '개발', 'develop', 'implement', 'implementation']
    },
    {
        key: 'monitor',
        labelKey: 'processArchitecture.board.columns.monitor',
        color: '#F57C00',
        icon: 'mdi-monitor-eye',
        keywords: ['감시', 'monitor', '모니터', '관제', 'surveillance']
    },
    {
        key: 'control',
        labelKey: 'processArchitecture.board.columns.control',
        color: '#7B1FA2',
        icon: 'mdi-tune',
        keywords: ['제어', 'control', '통제', '관리', 'manage', 'management']
    },
    {
        key: 'shared',
        labelKey: 'processArchitecture.board.columns.shared',
        color: '#607D8B',
        icon: 'mdi-share-variant',
        keywords: ['공통', 'shared', 'common']
    }
];

// Load custom column names from localStorage
function loadCustomColumnNames(): Record<string, string> {
    try {
        const raw = localStorage.getItem(COLUMN_NAMES_STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

function saveCustomColumnNames(names: Record<string, string>) {
    try {
        localStorage.setItem(COLUMN_NAMES_STORAGE_KEY, JSON.stringify(names));
    } catch {}
}

const customColumnNames = ref<Record<string, string>>(loadCustomColumnNames());

// Column name editing state
const editingColumnKey = ref<string | null>(null);
const editingColumnName = ref('');

function startEditColumn(col: { key: string; label: string }) {
    editingColumnKey.value = col.key;
    editingColumnName.value = customColumnNames.value[col.key] || col.label;
}

function saveColumnName(colKey: string) {
    const name = editingColumnName.value.trim();
    if (name) {
        customColumnNames.value = { ...customColumnNames.value, [colKey]: name };
        saveCustomColumnNames(customColumnNames.value);
    }
    editingColumnKey.value = null;
    editingColumnName.value = '';
}

function cancelEditColumn() {
    editingColumnKey.value = null;
    editingColumnName.value = '';
}

const columns = computed(() =>
    COLUMN_DEFS.map(col => ({
        ...col,
        label: customColumnNames.value[col.key] || t(col.labelKey)
    }))
);

// Display count per column for infinite scroll (initial: 20)
const displayCounts = ref<Record<string, number>>({
    design: 20,
    build: 20,
    monitor: 20,
    control: 20,
    shared: 20
});

// Column scroll container refs
const columnRefs = ref<Record<string, HTMLElement | null>>({});

function setColumnRef(el: HTMLElement | null, key: string) {
    columnRefs.value[key] = el;
}

// Determine which column a major process belongs to
function getColumnKey(major: any): string {
    const domain = (major.domain || major.domain_id || '').toLowerCase().trim();
    const category = (major.category || '').toLowerCase().trim();
    const searchStr = `${domain} ${category}`;

    for (const col of COLUMN_DEFS) {
        if (col.key === 'shared') continue;
        for (const keyword of col.keywords) {
            if (searchStr.includes(keyword.toLowerCase())) {
                return col.key;
            }
        }
    }

    // Also try matching major process name
    const majorName = (major.name || '').toLowerCase();
    for (const col of COLUMN_DEFS) {
        if (col.key === 'shared') continue;
        for (const keyword of col.keywords) {
            if (majorName.includes(keyword.toLowerCase())) {
                return col.key;
            }
        }
    }

    return 'shared';
}

// Collect all major processes sorted by last_modified DESC
const allMajors = computed(() => {
    const list: any[] = [];
    const map = props.procMap;
    if (!map || !map.mega_proc_list) return list;
    for (const mega of map.mega_proc_list) {
        for (const major of (mega.major_proc_list || [])) {
            list.push({ ...major, _megaId: mega.id, _megaName: mega.name });
        }
    }
    // Sort by last_modified DESC
    list.sort((a, b) => {
        const ta = a.last_modified || a.updated_at || a.created_at || '';
        const tb = b.last_modified || b.updated_at || b.created_at || '';
        if (ta && tb) return new Date(tb).getTime() - new Date(ta).getTime();
        if (ta) return -1;
        if (tb) return 1;
        return (a.name || '').localeCompare(b.name || '');
    });
    return list;
});

function getMajorsForColumn(colKey: string): any[] {
    return allMajors.value.filter(major => getColumnKey(major) === colKey);
}

function getVisibleMajors(colKey: string): any[] {
    const count = displayCounts.value[colKey] ?? 20;
    return getMajorsForColumn(colKey).slice(0, count);
}

function hasMoreMajors(colKey: string): boolean {
    return getMajorsForColumn(colKey).length > (displayCounts.value[colKey] ?? 20);
}

function getMajorCountForColumn(colKey: string): number {
    return getMajorsForColumn(colKey).length;
}

function getTotalSubProcessCount(colKey: string): number {
    return getMajorsForColumn(colKey).reduce((sum, major) => {
        return sum + (major.sub_proc_list || []).length;
    }, 0);
}

function getReviewingCount(colKey: string): number {
    let count = 0;
    for (const major of getMajorsForColumn(colKey)) {
        for (const sub of (major.sub_proc_list || [])) {
            const status = props.processStatuses.get(sub.id);
            if (status?.status === 'review') count++;
        }
    }
    return count;
}

function getSortedSubs(major: any): any[] {
    const subs = major.sub_proc_list || [];
    return [...subs].sort((a, b) => {
        const ta = a.last_modified || a.updated_at || a.created_at || '';
        const tb = b.last_modified || b.updated_at || b.created_at || '';
        if (ta && tb) return new Date(tb).getTime() - new Date(ta).getTime();
        if (ta) return -1;
        if (tb) return 1;
        return 0;
    });
}

// Infinite scroll: load 20 more when 80% scrolled
function onColumnScroll(colKey: string) {
    const el = columnRefs.value[colKey];
    if (!el) return;
    const threshold = el.scrollHeight * 0.8;
    if (el.scrollTop + el.clientHeight >= threshold) {
        loadMore(colKey);
    }
}

function loadMore(colKey: string) {
    const total = getMajorsForColumn(colKey).length;
    const current = displayCounts.value[colKey] ?? 20;
    if (current < total) {
        displayCounts.value[colKey] = Math.min(current + 20, total);
    }
}

function getStatus(subId: string) {
    return props.processStatuses.get(subId);
}

function getDomainColor(domainName: string): string {
    const d = props.domains.find((d: any) => d.name === domainName || d.id === domainName);
    return d?.color || 'grey';
}
</script>

<style scoped>
.card-view-container {
    width: 100%;
    height: 100%;
}

.columns-wrapper {
    display: flex;
    gap: 16px;
    overflow-x: auto;
    padding-bottom: 16px;
    min-height: 400px;
}

.board-column {
    min-width: 320px;
    flex: 1 0 320px;
    display: flex;
    flex-direction: column;
    max-height: calc(100vh - 300px);
}

.column-header {
    padding: 10px 8px;
    margin-bottom: 10px;
    border-bottom: 3px solid #e0e0e0;
    flex-shrink: 0;
}

.column-header-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.column-stats {
    display: flex;
    align-items: center;
    gap: 6px;
    padding-left: 2px;
}

.stat-text {
    font-size: 0.75rem;
    color: #757575;
}

.stat-divider {
    color: #bdbdbd;
    font-size: 0.75rem;
}

.cards-list {
    flex: 1;
    overflow-y: auto;
    padding-right: 4px;
}

.cards-list::-webkit-scrollbar {
    width: 4px;
}

.cards-list::-webkit-scrollbar-track {
    background: transparent;
}

.cards-list::-webkit-scrollbar-thumb {
    background: #e0e0e0;
    border-radius: 2px;
}

.major-card {
    transition: box-shadow 0.2s ease;
}

.major-card:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.card-header {
    background: #fafafa;
    user-select: none;
}

.domain-chip {
    flex-shrink: 0;
    max-width: 120px;
}

.process-id {
    flex-shrink: 0;
    font-family: monospace;
    font-size: 0.72rem;
    opacity: 0.75;
    white-space: nowrap;
}

.card-title {
    max-width: 100%;
    line-height: 1.4;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.invisible-spacer {
    width: 1px;
}

.sub-item {
    transition: background-color 0.15s ease;
}

.sub-item:hover {
    background-color: #f5f5f5;
}

.sub-item .fav-btn {
    opacity: 0;
    transition: opacity 0.15s ease;
}

.sub-item:hover .fav-btn {
    opacity: 1;
}

.sub-item .fav-btn.is-fav {
    opacity: 1;
}


.load-more-trigger {
    min-height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.empty-column {
    border: 2px dashed #e0e0e0;
    border-radius: 8px;
}

/* To-Be view styles */
@keyframes wip-pulse {
    0%, 100% { background-color: transparent; }
    50% { background-color: rgba(123, 31, 162, 0.08); }
}

.wip-item {
    animation: wip-pulse 2s ease-in-out infinite;
    border-left: 3px solid #7B1FA2;
    padding-left: 9px !important;
}

.sunset-item {
    opacity: 0.7;
    border-left: 3px solid #C62828;
    padding-left: 9px !important;
}
</style>
