<template>
    <div class="card-view-container">
        <div v-if="!procMap.mega_proc_list || procMap.mega_proc_list.length === 0" class="text-center text-grey pa-10">
            {{ $t('processArchitecture.noData') }}
        </div>
        <div v-else class="columns-wrapper">
            <div v-for="col in visibleColumns" :key="col.key" class="board-column">
                <!-- Column Header -->
                <div class="column-header" :style="{ borderBottomColor: col.color }">
                    <div class="column-header-top">
                        <div class="d-flex align-center ga-2 flex-grow-1">
                            <v-icon :color="col.color" size="18">{{ col.icon }}</v-icon>
                            <template v-if="editingColumnKey === col.key">
                                <v-text-field
                                    v-model="editingColumnName"
                                    density="compact"
                                    variant="underlined"
                                    hide-details
                                    autofocus
                                    style="max-width: 140px; font-size: 0.95rem"
                                    @keyup.enter="saveColumnName(col.key)"
                                    @keyup.escape="cancelEditColumn"
                                    @blur="saveColumnName(col.key)"
                                />
                            </template>
                            <template v-else>
                                <span class="text-subtitle-1 font-weight-bold">{{ col.label }}</span>
                                <v-btn
                                    v-if="isAdmin && !props.readonly"
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
                        <v-chip :color="col.color" size="x-small" variant="tonal">
                            {{ getMajorCountForColumn(col.key) }}
                        </v-chip>
                    </div>
                </div>

                <!-- Major Process Cards with Infinite Scroll + Drag & Drop -->
                <div
                    class="cards-list"
                    :data-column-key="col.key"
                    :ref="el => setColumnRef(el as HTMLElement | null, col.key)"
                    @scroll="onColumnScroll(col.key)"
                >
                    <draggable
                        :key="`major-drag-${col.key}-${props.readonly}`"
                        :model-value="getVisibleMajors(col.key)"
                        :animation="200"
                        ghost-class="ghost-card"
                        group="majorCards"
                        :disabled="!!props.readonly"
                        :data-column-key="col.key"
                        handle=".major-drag-handle"
                        class="major-draggable-zone"
                        @start="(evt) => onCardDragStart(evt, col.key)"
                        @add="(evt) => onCardDragAdd(evt, col.key)"
                        @end="onCardDragEnd"
                    >
                        <transition-group>
                            <v-card
                                v-for="major in getVisibleMajors(col.key)"
                                :key="major.id"
                                variant="outlined"
                                class="major-card mb-3"
                                :data-major-id="major.id"
                                style="border-radius: 16px !important;"
                            >
                                <div
                                    class="card-header major-drag-handle pa-3 pb-2 d-flex align-center cursor-pointer"
                                    :class="{ 'cursor-grab': !props.readonly }"
                                    @click.stop="toggleCardCollapse(major.id)"
                                >
                                    <div class="flex-grow-1" style="min-width: 0;">
                                        <!-- [ID] 프로세스이름 (Domain) -->
                                        <div class="card-title text-subtitle-2 font-weight-semibold d-flex align-center ga-1">
                                            <v-icon v-if="isUpdatedSinceLastVisit?.(major)" size="8" color="info" class="flex-shrink-0">mdi-circle</v-icon>
                                            <span class="text-truncate">{{ major.name }}</span>
                                            <v-chip
                                                v-if="getBusinessDomain(major)"
                                                :color="getDomainColor(getBusinessDomain(major))"
                                                size="x-small"
                                                variant="flat"
                                                class="domain-chip flex-shrink-0"
                                            >
                                                {{ getBusinessDomain(major) }}
                                            </v-chip>
                                        </div>
                                        <!-- 날짜만 표시 -->
                                        <div v-if="getMajorCardDate(major)" class="mt-1">
                                            <span class="text-caption text-grey">
                                                {{ getMajorCardDate(major) }}
                                            </span>
                                        </div>
                                    </div>
                                    <v-icon
                                        v-if="!props.readonly"
                                        size="14"
                                        class="ml-2 flex-shrink-0 edit-major-icon"
                                        color="grey-lighten-1"
                                        @click.stop="emit('editProcess', { type: 'major', id: major.id, name: major.name })"
                                        title="편집"
                                    >mdi-pencil-outline</v-icon>
                                    <v-icon size="18" class="ml-1 flex-shrink-0" color="grey">
                                        {{ collapsedCards.has(major.id) ? 'mdi-chevron-down' : 'mdi-chevron-up' }}
                                    </v-icon>
                                </div>
                                <template v-if="!collapsedCards.has(major.id)">
                                    <v-divider />
                                    <div class="sub-list pa-2" :data-major-id="major.id">
                                        <draggable
                                            :key="`sub-drag-${major.id}-${props.readonly}`"
                                            :model-value="getSortedSubs(major)"
                                            :animation="200"
                                            ghost-class="ghost-sub"
                                            group="subProcesses"
                                            :disabled="!!props.readonly"
                                            class="sub-draggable-zone"
                                            :data-major-id="major.id"
                                            @start="(evt) => onSubDragStart(evt, major.id)"
                                            @add="(evt) => onSubDragAdd(evt, major.id)"
                                            @end="onSubDragEnd"
                                        >
                                            <div
                                                v-for="(sub, subIdx) in getSortedSubs(major)"
                                                :key="sub.id"
                                                :class="[
                                                    'sub-item d-flex flex-column pa-2 rounded cursor-pointer',
                                                    { 'cursor-grab': !props.readonly },
                                                    {
                                                        'wip-item': showToBe && getStatus(sub.id)?.status === 'wip',
                                                        'sunset-item': showToBe && getStatus(sub.id)?.status === 'sunset'
                                                    }
                                                ]"
                                                :data-sub-id="sub.id"
                                                :data-major-id="major.id"
                                                :title="processDescription(sub)"
                                                @click="$emit('navigate', sub.id, sub.name)"
                                            >
                                                <v-tooltip v-if="processDescription(sub)" activator="parent" location="top" max-width="360">
                                                    <div class="process-desc-tooltip">{{ processDescription(sub) }}</div>
                                                </v-tooltip>
                                                <!-- sub-item 간 구분선 (첫 항목 제외) -->
                                                <v-divider v-if="subIdx > 0" class="sub-item-divider" />
                                                <!-- 1행: sub-process 이름 (잘림 없음) -->
                                                <div class="d-flex align-center sub-name-row">
                                                    <v-icon size="14" class="mr-2 text-grey flex-shrink-0">mdi-file-document-outline</v-icon>
                                                    <v-icon v-if="isUpdatedSinceLastVisit?.(sub)" size="8" color="info" class="mr-1 flex-shrink-0">mdi-circle</v-icon>
                                                    <span class="text-body-2 sub-name-text">{{ sub.name }}</span>
                                                </div>
                                                <!-- 2행: 즐겨찾기 / 상태 / KPI / 버전 -->
                                                <div class="d-flex align-center ga-1 mt-1 sub-meta-row">
                                                    <v-btn
                                                        icon
                                                        variant="text"
                                                        size="x-small"
                                                        :class="['fav-btn', { 'is-fav': favorites?.has(sub.id) }]"
                                                        @click.stop="emit('toggleFavorite', sub.id)"
                                                    >
                                                        <v-icon size="14" :color="favorites?.has(sub.id) ? 'amber' : 'grey-lighten-1'">
                                                            {{ favorites?.has(sub.id) ? 'mdi-star' : 'mdi-star-outline' }}
                                                        </v-icon>
                                                    </v-btn>
                                                    <ProgressBadge
                                                        v-if="getStatus(sub.id)?.status && getStatus(sub.id)?.status !== 'none'"
                                                        type="status"
                                                        :status="getStatus(sub.id).status"
                                                        :d-day="getStatus(sub.id).dDay ?? null"
                                                        :review-end-date="getStatus(sub.id).reviewEndDate ?? ''"
                                                        size="x-small"
                                                    />
                                                    <v-chip
                                                        v-if="kpiTaggedProcessIds?.get(sub.id)"
                                                        size="x-small"
                                                        color="primary"
                                                        variant="tonal"
                                                        class="kpi-org-chip"
                                                    >
                                                        {{ kpiTaggedProcessIds.get(sub.id) }}
                                                    </v-chip>
                                                    <v-spacer />
                                                    <span v-if="getStatus(sub.id)?.version" class="text-caption text-grey">
                                                        v{{ getStatus(sub.id).version }}
                                                    </span>
                                                </div>
                                            </div>
                                        </draggable>
                                        <div
                                            v-if="!major.sub_proc_list || major.sub_proc_list.length === 0"
                                            class="text-caption text-grey-lighten-1 pa-2 text-center"
                                        >
                                            {{ $t('processArchitecture.noSubProcesses') }}
                                        </div>
                                    </div>
                                </template>
                            </v-card>
                        </transition-group>
                    </draggable>

                    <!-- Loading indicator when more items available -->
                    <div v-if="hasMoreMajors(col.key)" class="load-more-trigger pa-2 text-center">
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
import { VueDraggableNext as draggable } from 'vue-draggable-next';
import ProgressBadge from '@/components/ui/ProgressBadge.vue';
import { formatDateKST } from '@/utils/datetime';
import {
    getMajorBusinessDomain,
    getMajorStageColumn,
    PROCESS_STAGE_LABELS,
    type ProcessStageColumn
} from './processClassification';

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
    hideEmptyColumns?: boolean;
    isUpdatedSinceLastVisit?: (process: any) => boolean;
    readonly?: boolean;
    kpiTaggedProcessIds?: Map<string, string>;
}>();

const emit = defineEmits<{
    (e: 'navigate', id: string, name?: string): void;
    (e: 'toggleFavorite', id: string): void;
    (e: 'moveSub', subId: string, fromMajorId: string, toMajorId: string): void;
    (e: 'moveMajor', majorId: string, megaId: string, newStage: string): void;
    (e: 'editProcess', row: { type: string; id: string; name: string }): void;
    (e: 'addProcess', row: { type: string; megaId?: string }): void;
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
    } catch {
        // localStorage can be unavailable in restricted browser contexts.
    }
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
    COLUMN_DEFS.map((col) => ({
        ...col,
        label: customColumnNames.value[col.key] || t(col.labelKey)
    }))
);

const visibleColumns = computed(() => {
    if (!props.hideEmptyColumns) return columns.value;
    return columns.value.filter((col) => getMajorCountForColumn(col.key) > 0);
});

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
    return getMajorStageColumn(major);
}

// Collect all major processes sorted by last_modified DESC
const allMajors = computed(() => {
    const list: any[] = [];
    const map = props.procMap;
    if (!map || !map.mega_proc_list) return list;
    for (const mega of map.mega_proc_list) {
        for (const major of mega.major_proc_list || []) {
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

const majorsByColumn = computed<Record<string, any[]>>(() => {
    const grouped: Record<string, any[]> = {};
    for (const col of COLUMN_DEFS) {
        grouped[col.key] = [];
    }

    for (const major of allMajors.value) {
        const columnKey = getColumnKey(major);
        if (!grouped[columnKey]) grouped[columnKey] = [];
        grouped[columnKey].push(major);
    }

    return grouped;
});

function getMajorsForColumn(colKey: string): any[] {
    return majorsByColumn.value[colKey] || [];
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
        for (const sub of major.sub_proc_list || []) {
            const status = props.processStatuses.get(sub.id);
            if (status?.status === 'in_review') count++;
        }
    }
    return count;
}

function getSortedSubs(major: any): any[] {
    const subs = major.sub_proc_list || [];
    return [...subs].sort((a, b) => {
        const na = (a.name || '').toLowerCase();
        const nb = (b.name || '').toLowerCase();
        return na.localeCompare(nb, 'ko');
    });
}

function processDescription(process: any): string {
    return String(process?.description || '').trim();
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

function getBusinessDomain(major: any): string {
    return getMajorBusinessDomain(major, props.domains);
}

function getDomainColor(domainName: string): string {
    const d = props.domains.find((d: any) => d.name === domainName || d.id === domainName);
    return d?.color || 'grey';
}

// 카드 접기/펴기
const collapsedCards = ref(new Set<string>());

function toggleCardCollapse(majorId: string) {
    const next = new Set(collapsedCards.value);
    if (next.has(majorId)) {
        next.delete(majorId);
    } else {
        next.add(majorId);
    }
    collapsedCards.value = next;
}

// 카드 헤더에 표시할 대표 상태 (첫 번째 sub-process의 상태)
function getMajorCardStatus(major: any): string | null {
    const subs = major.sub_proc_list || [];
    for (const sub of subs) {
        const status = props.processStatuses.get(sub.id);
        if (status?.status && status.status !== 'none') {
            return status.status;
        }
    }
    return null;
}

// 카드 헤더에 표시할 날짜 (최근 수정일)
function getMajorCardDate(major: any): string {
    const dateStr = major.last_modified || major.updated_at || major.created_at || '';
    if (!dateStr) return '';
    return formatDateKST(dateStr);
}

// ===== Drag & Drop Handlers =====
let cardDragContext: { majorId: string; fromColumnKey: string; handled: boolean } | null = null;
let subDragContext: { subId: string; fromMajorId: string; handled: boolean } | null = null;

function toDataAttributeName(key: string): string {
    return key.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
}

function getDatasetValue(el: HTMLElement | null | undefined, key: string): string {
    if (!el) return '';
    const direct = el.dataset?.[key];
    if (direct) return direct;

    const attrName = toDataAttributeName(key);
    const closest = el.closest?.(`[data-${attrName}]`) as HTMLElement | null;
    return closest?.dataset?.[key] || '';
}

function emitMoveMajor(majorId: string, fromColumnKey: string, toColumnKey: string): boolean {
    if (!majorId || !toColumnKey || fromColumnKey === toColumnKey) return false;

    const major = allMajors.value.find((item) => item.id === majorId);
    if (!major) return false;
    if (getColumnKey(major) === toColumnKey) return false;

    emit('moveMajor', majorId, major._megaId, PROCESS_STAGE_LABELS[toColumnKey as ProcessStageColumn] || toColumnKey);
    return true;
}

function onCardDragStart(evt: any, fromColumnKey: string) {
    cardDragContext = {
        majorId: getDatasetValue(evt?.item, 'majorId'),
        fromColumnKey,
        handled: false
    };
}

function onCardDragAdd(evt: any, toColumnKey: string) {
    const majorId = cardDragContext?.majorId || getDatasetValue(evt?.item, 'majorId');
    const fromColumnKey = cardDragContext?.fromColumnKey || getDatasetValue(evt?.from, 'columnKey');
    const handled = emitMoveMajor(majorId, fromColumnKey, toColumnKey);
    if (cardDragContext) cardDragContext.handled = handled;
}

function onCardDragEnd(evt: any) {
    if (cardDragContext?.handled) {
        cardDragContext = null;
        return;
    }

    const majorId = cardDragContext?.majorId || getDatasetValue(evt?.item, 'majorId');
    const fromColumnKey = cardDragContext?.fromColumnKey || getDatasetValue(evt?.from, 'columnKey');
    const toColumnKey = getDatasetValue(evt?.to, 'columnKey');
    emitMoveMajor(majorId, fromColumnKey, toColumnKey);
    cardDragContext = null;
}

function emitMoveSub(subId: string, fromMajorId: string, toMajorId: string): boolean {
    if (!subId || !fromMajorId || !toMajorId || fromMajorId === toMajorId) return false;

    emit('moveSub', subId, fromMajorId, toMajorId);
    return true;
}

function onSubDragStart(evt: any, fromMajorId: string) {
    subDragContext = {
        subId: getDatasetValue(evt?.item, 'subId'),
        fromMajorId,
        handled: false
    };
}

function onSubDragAdd(evt: any, toMajorId: string) {
    const subId = subDragContext?.subId || getDatasetValue(evt?.item, 'subId');
    const fromMajorId = subDragContext?.fromMajorId || getDatasetValue(evt?.from, 'majorId');
    const handled = emitMoveSub(subId, fromMajorId, toMajorId);
    if (subDragContext) subDragContext.handled = handled;
}

function onSubDragEnd(evt: any) {
    if (subDragContext?.handled) {
        subDragContext = null;
        return;
    }

    const subId = subDragContext?.subId || getDatasetValue(evt?.item, 'subId');
    const fromMajorId = subDragContext?.fromMajorId || getDatasetValue(evt?.from, 'majorId');
    const toMajorId = getDatasetValue(evt?.to, 'majorId');
    emitMoveSub(subId, fromMajorId, toMajorId);
    subDragContext = null;
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
    height: 100%;
}

.board-column {
    min-width: 320px;
    flex: 1 0 320px;
    display: flex;
    flex-direction: column;
    height: 100%;
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
    position: relative;
    display: flex;
    flex-direction: column;
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

.edit-major-icon {
    opacity: 0;
    transition: opacity 0.15s ease;
    cursor: pointer;
}

.major-card:hover .edit-major-icon {
    opacity: 0.5;
}

.major-card:hover .edit-major-icon:hover {
    opacity: 1;
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

.sub-name-text {
    flex: 1 1 auto;
    min-width: 0;
    word-break: break-word;
    line-height: 1.35;
}

/* sub-item 내부에 둔 v-divider 가 카드 좌우 끝까지 닿도록 padding(pa-2) 만큼 음수 margin */
.sub-item-divider {
    margin: -8px -8px 8px -8px;
}

.sub-meta-row {
    min-height: 22px;
}

.process-desc-tooltip {
    white-space: pre-line;
    line-height: 1.45;
}

.sub-item .fav-btn {
    opacity: 1;
}

.load-more-trigger {
    min-height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.major-draggable-zone {
    flex: 1;
}

.empty-column {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: calc(100% - 16px);
    border: 2px dashed #e0e0e0;
    border-radius: 8px;
    pointer-events: none;
}

/* To-Be view styles */
@keyframes wip-pulse {
    0%,
    100% {
        background-color: transparent;
    }
    50% {
        background-color: rgba(123, 31, 162, 0.08);
    }
}

.wip-item {
    animation: wip-pulse 2s ease-in-out infinite;
    border-left: 3px solid #7b1fa2;
    padding-left: 9px !important;
}

.sunset-item {
    opacity: 0.7;
    border-left: 3px solid #c62828;
    padding-left: 9px !important;
}

.cursor-grab {
    cursor: grab;
}

.cursor-grab:active {
    cursor: grabbing;
}

.ghost-card {
    opacity: 0.4;
    background: #e3f2fd;
    border: 2px dashed #1976d2 !important;
}

.ghost-sub {
    opacity: 0.4;
    background: #e8f5e9;
    border: 2px dashed #388e3c !important;
    border-radius: 4px;
}

.sub-draggable-zone {
    min-height: 32px;
}
</style>
