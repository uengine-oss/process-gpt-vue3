<template>
    <div class="tree-view-container">
        <div v-if="rows.length === 0" class="text-center text-grey pa-10">
            {{ $t('processArchitecture.noData') }}
        </div>
        <div v-else class="tree-list">
            <div
                v-for="row in rows"
                :key="row.key"
                class="tree-row d-flex align-center"
                :class="[
                    `tree-level-${row.level}`,
                    { 'tree-row-clickable': row.type === 'sub' },
                    { 'dnd-over': dragOverKey === row.key && isDragOverTarget(row) },
                    { 'dnd-dragging': draggingKey === row.key },
                    { 'wip-row': showToBe && row.type === 'sub' && row.status?.status === 'wip' },
                    { 'sunset-row': showToBe && row.type === 'sub' && row.status?.status === 'sunset' }
                ]"
                :style="{ paddingLeft: `${row.level * 24 + 12}px` }"
                :draggable="row.type === 'sub'"
                @click="row.type === 'sub' ? $emit('navigate', row.id, row.name) : null"
                @dragstart="row.type === 'sub' ? onDragStart($event, row) : null"
                @dragend="onDragEnd"
                @dragover.prevent="onDragOver($event, row)"
                @dragleave="onDragLeave(row)"
                @drop.prevent="onDrop($event, row)"
            >
                <!-- Expand/Collapse -->
                <v-btn
                    v-if="row.hasChildren"
                    icon
                    variant="text"
                    size="x-small"
                    class="mr-1"
                    @click.stop="toggleExpand(row.key)"
                >
                    <v-icon size="16">
                        {{ expanded.has(row.key) ? 'mdi-chevron-down' : 'mdi-chevron-right' }}
                    </v-icon>
                </v-btn>
                <div v-else style="width: 28px;" class="mr-1"></div>

                <!-- Drag handle (only for sub-processes) -->
                <v-icon
                    v-if="row.type === 'sub'"
                    size="14"
                    color="grey-lighten-1"
                    class="drag-handle mr-1"
                    title="Drag to move"
                >
                    mdi-drag-vertical
                </v-icon>

                <!-- Type Icon -->
                <v-icon
                    :size="row.type === 'domain' ? 18 : row.type === 'sub' ? 14 : 16"
                    :color="getIconColor(row.type)"
                    class="mr-2"
                >
                    {{ getIcon(row.type) }}
                </v-icon>

                <!-- Name -->
                <span
                    class="tree-name flex-grow-1"
                    :class="{
                        'font-weight-bold': row.type === 'domain',
                        'font-weight-semibold': row.type === 'mega',
                        'font-weight-medium': row.type === 'major',
                        'text-body-2': row.type === 'sub'
                    }"
                >
                    {{ row.name }}
                </span>

                <!-- Domain Badge (for domain rows) -->
                <v-chip
                    v-if="row.type === 'domain' && row.color"
                    :color="row.color"
                    size="x-small"
                    variant="flat"
                    class="ml-2"
                >
                    {{ row.name }}
                </v-chip>

                <!-- Right info -->
                <div class="d-flex align-center ga-2 ml-auto tree-meta">
                    <!-- Process count -->
                    <span v-if="row.count !== undefined" class="text-caption text-grey">
                        {{ row.count }} {{ row.count === 1 ? 'process' : 'processes' }}
                    </span>

                    <!-- Favorite toggle for sub processes -->
                    <v-btn
                        v-if="row.type === 'sub'"
                        icon
                        variant="text"
                        size="x-small"
                        :class="['fav-btn', { 'is-fav': favorites?.has(row.id) }]"
                        @click.stop="emit('toggleFavorite', row.id)"
                    >
                        <v-icon
                            size="14"
                            :color="favorites?.has(row.id) ? 'amber' : 'grey-lighten-1'"
                        >
                            {{ favorites?.has(row.id) ? 'mdi-star' : 'mdi-star-outline' }}
                        </v-icon>
                    </v-btn>

                    <!-- Status badge for sub processes -->
                    <ProgressBadge
                        v-if="row.type === 'sub' && row.status"
                        type="status"
                        :status="row.status.status"
                        :d-day="row.status.dDay ?? null"
                        :review-end-date="row.status.reviewEndDate ?? ''"
                        size="x-small"
                    />

                    <!-- Version -->
                    <span v-if="row.type === 'sub' && row.status?.version" class="text-caption text-grey">
                        v{{ row.status.version }}
                    </span>
                </div>
            </div>
        </div>

        <!-- Drag & Drop Warning Dialog -->
        <v-dialog v-model="showMoveDialog" max-width="480" persistent>
            <v-card>
                <v-card-title class="text-subtitle-1 font-weight-bold pa-4 pb-2">
                    <v-icon color="warning" class="mr-2">mdi-alert-outline</v-icon>
                    {{ $t('processArchitecture.tree.moveWarningTitle') }}
                </v-card-title>
                <v-card-text class="pa-4">
                    <p class="text-body-2 mb-3">
                        {{ $t('processArchitecture.tree.moveWarningDesc', {
                            processName: pendingMove?.subName,
                            fromMajor: pendingMove?.fromMajorName,
                            toMajor: pendingMove?.toMajorName
                        }) }}
                    </p>
                    <v-alert type="warning" variant="tonal" density="compact" class="mb-2">
                        <strong>{{ $t('processArchitecture.tree.idRenumberAlert') }}</strong>
                        <div class="text-caption mt-1">{{ $t('processArchitecture.tree.idRenumberDesc') }}</div>
                    </v-alert>
                    <v-alert type="info" variant="tonal" density="compact">
                        {{ $t('processArchitecture.tree.uidPreservedNote') }}
                    </v-alert>
                </v-card-text>
                <v-card-actions class="pa-4 pt-0">
                    <v-spacer />
                    <v-btn variant="text" @click="cancelMove">{{ $t('processArchitecture.tree.cancel') }}</v-btn>
                    <v-btn color="warning" variant="flat" :loading="moveSaving" @click="confirmMove">
                        {{ $t('processArchitecture.tree.confirmMove') }}
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- Move success/error snackbar -->
        <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="3000">
            {{ snackbar.message }}
        </v-snackbar>
    </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import ProgressBadge from '@/components/ui/ProgressBadge.vue';

const props = defineProps<{
    procMap: any;
    domains: any[];
    processStatuses: Map<string, any>;
    selectedDomain: string | null;
    showToBe?: boolean;
    favorites?: Set<string>;
}>();

const emit = defineEmits<{
    (e: 'navigate', id: string, name?: string): void;
    (e: 'moveSub', subId: string, fromMajorId: string, toMajorId: string): void;
    (e: 'toggleFavorite', id: string): void;
}>();

const expanded = ref(new Set<string>());

// Initialize with domains expanded
function initExpanded() {
    const map = props.procMap;
    if (!map?.mega_proc_list) return;
    // Expand domain-level items and mega items by default
    for (const domain of props.domains) {
        expanded.value.add(`domain-${domain.id}`);
    }
    for (const mega of map.mega_proc_list) {
        expanded.value.add(`mega-${mega.id}`);
    }
}
initExpanded();

interface TreeRow {
    key: string;
    type: 'domain' | 'mega' | 'major' | 'sub';
    level: number;
    id: string;
    name: string;
    hasChildren: boolean;
    color?: string;
    count?: number;
    status?: any;
    // For DnD: track parent context
    megaId?: string;
    majorId?: string;
    majorName?: string;
}

const rows = computed<TreeRow[]>(() => {
    const result: TreeRow[] = [];
    const map = props.procMap;
    if (!map?.mega_proc_list) return result;

    // If domains exist, group by domain
    if (props.domains.length > 0) {
        for (const domain of props.domains) {
            const domainKey = `domain-${domain.id}`;
            // Count processes in this domain
            let domainCount = 0;
            if (map.mega_proc_list) {
                for (const mega of map.mega_proc_list) {
                    for (const major of (mega.major_proc_list || [])) {
                        const majorDomain = major.domain || major.domain_id;
                        if (majorDomain === domain.name || majorDomain === domain.id) {
                            domainCount += (major.sub_proc_list || []).length;
                        }
                    }
                }
            }

            result.push({
                key: domainKey,
                type: 'domain',
                level: 0,
                id: domain.id,
                name: domain.name,
                hasChildren: true,
                color: domain.color,
                count: domainCount
            });

            if (!expanded.value.has(domainKey)) continue;

            // Find mega processes that have majors in this domain
            for (const mega of map.mega_proc_list) {
                const megaMajorsInDomain = (mega.major_proc_list || []).filter((m: any) => {
                    const d = m.domain || m.domain_id;
                    return d === domain.name || d === domain.id;
                });
                if (megaMajorsInDomain.length === 0) continue;

                const megaKey = `domain-${domain.id}-mega-${mega.id}`;
                result.push({
                    key: megaKey,
                    type: 'mega',
                    level: 1,
                    id: mega.id,
                    name: mega.name,
                    hasChildren: megaMajorsInDomain.length > 0,
                    count: megaMajorsInDomain.length
                });

                if (!expanded.value.has(megaKey)) continue;

                for (const major of megaMajorsInDomain) {
                    addMajorRows(result, major, 2, `domain-${domain.id}-mega-${mega.id}`, mega.id);
                }
            }
        }

        // Also show majors without domain
        const orphanMajors: any[] = [];
        for (const mega of map.mega_proc_list) {
            for (const major of (mega.major_proc_list || [])) {
                const d = major.domain || major.domain_id;
                if (!d || !props.domains.find((dom: any) => dom.name === d || dom.id === d)) {
                    orphanMajors.push({ mega, major });
                }
            }
        }

        if (orphanMajors.length > 0) {
            const orphanKey = 'domain-unassigned';
            result.push({
                key: orphanKey,
                type: 'domain',
                level: 0,
                id: 'unassigned',
                name: '미분류',
                hasChildren: true,
                count: orphanMajors.reduce((sum, o) => sum + (o.major.sub_proc_list || []).length, 0)
            });

            if (expanded.value.has(orphanKey)) {
                // Group orphans by mega
                const megaGroups = new Map<string, any[]>();
                for (const o of orphanMajors) {
                    if (!megaGroups.has(o.mega.id)) megaGroups.set(o.mega.id, []);
                    megaGroups.get(o.mega.id)!.push(o);
                }
                for (const [megaId, group] of megaGroups) {
                    const mega = group[0].mega;
                    const megaKey = `domain-unassigned-mega-${megaId}`;
                    result.push({
                        key: megaKey,
                        type: 'mega',
                        level: 1,
                        id: megaId,
                        name: mega.name,
                        hasChildren: true,
                        count: group.length
                    });

                    if (!expanded.value.has(megaKey)) continue;
                    for (const o of group) {
                        addMajorRows(result, o.major, 2, megaKey, megaId);
                    }
                }
            }
        }
    } else {
        // No domains - just show mega → major → sub
        for (const mega of map.mega_proc_list) {
            const megaKey = `mega-${mega.id}`;
            result.push({
                key: megaKey,
                type: 'mega',
                level: 0,
                id: mega.id,
                name: mega.name,
                hasChildren: (mega.major_proc_list || []).length > 0,
                count: (mega.major_proc_list || []).length
            });

            if (!expanded.value.has(megaKey)) continue;

            for (const major of (mega.major_proc_list || [])) {
                addMajorRows(result, major, 1, megaKey, mega.id);
            }
        }
    }

    return result;
});

function addMajorRows(result: TreeRow[], major: any, level: number, parentKey: string, megaId: string) {
    const majorKey = `${parentKey}-major-${major.id}`;
    const subs = major.sub_proc_list || [];
    result.push({
        key: majorKey,
        type: 'major',
        level,
        id: major.id,
        name: major.name,
        hasChildren: subs.length > 0,
        count: subs.length,
        megaId
    });

    if (!expanded.value.has(majorKey)) return;

    for (const sub of subs) {
        result.push({
            key: `${majorKey}-sub-${sub.id}`,
            type: 'sub',
            level: level + 1,
            id: sub.id,
            name: sub.name,
            hasChildren: false,
            status: props.processStatuses.get(sub.id),
            megaId,
            majorId: major.id,
            majorName: major.name
        });
    }
}

function toggleExpand(key: string) {
    if (expanded.value.has(key)) {
        expanded.value.delete(key);
    } else {
        expanded.value.add(key);
    }
    // Trigger reactivity
    expanded.value = new Set(expanded.value);
}

function getIcon(type: string): string {
    const icons: Record<string, string> = {
        domain: 'mdi-folder-outline',
        mega: 'mdi-folder-outline',
        major: 'mdi-file-document-outline',
        sub: 'mdi-file-outline'
    };
    return icons[type] || 'mdi-file-outline';
}

function getIconColor(type: string): string {
    const colors: Record<string, string> = {
        domain: 'primary',
        mega: 'orange',
        major: 'green',
        sub: 'grey'
    };
    return colors[type] || 'grey';
}

// ===== Drag & Drop =====
const draggingRow = ref<TreeRow | null>(null);
const draggingKey = ref<string>('');
const dragOverKey = ref<string>('');

interface PendingMove {
    subId: string;
    subName: string;
    fromMajorId: string;
    fromMajorName: string;
    toMajorId: string;
    toMajorName: string;
}

const showMoveDialog = ref(false);
const pendingMove = ref<PendingMove | null>(null);
const moveSaving = ref(false);
const snackbar = ref({ show: false, color: 'success', message: '' });

function onDragStart(e: DragEvent, row: TreeRow) {
    draggingRow.value = row;
    draggingKey.value = row.key;
    e.dataTransfer?.setData('text/plain', row.id);
    if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
    }
}

function onDragEnd() {
    draggingRow.value = null;
    draggingKey.value = '';
    dragOverKey.value = '';
}

function isDragOverTarget(row: TreeRow): boolean {
    // Allow drop on major rows that are different from the source major
    if (!draggingRow.value) return false;
    return row.type === 'major' && row.id !== draggingRow.value.majorId;
}

function onDragOver(e: DragEvent, row: TreeRow) {
    if (!isDragOverTarget(row)) {
        e.dataTransfer!.dropEffect = 'none';
        return;
    }
    dragOverKey.value = row.key;
    e.dataTransfer!.dropEffect = 'move';
}

function onDragLeave(row: TreeRow) {
    if (dragOverKey.value === row.key) {
        dragOverKey.value = '';
    }
}

function onDrop(e: DragEvent, targetRow: TreeRow) {
    dragOverKey.value = '';
    if (!draggingRow.value) return;
    if (targetRow.type !== 'major') return;
    if (targetRow.id === draggingRow.value.majorId) return;

    // Prepare the pending move
    pendingMove.value = {
        subId: draggingRow.value.id,
        subName: draggingRow.value.name,
        fromMajorId: draggingRow.value.majorId!,
        fromMajorName: draggingRow.value.majorName!,
        toMajorId: targetRow.id,
        toMajorName: targetRow.name
    };
    showMoveDialog.value = true;
}

function cancelMove() {
    showMoveDialog.value = false;
    pendingMove.value = null;
}

async function confirmMove() {
    if (!pendingMove.value) return;
    const { subId, fromMajorId, toMajorId } = pendingMove.value;
    moveSaving.value = true;
    try {
        emit('moveSub', subId, fromMajorId, toMajorId);
        showMoveDialog.value = false;
        snackbar.value = {
            show: true,
            color: 'success',
            message: t('processArchitecture.tree.moveSuccess', { name: pendingMove.value.subName })
        };
        pendingMove.value = null;
    } catch (err) {
        snackbar.value = {
            show: true,
            color: 'error',
            message: t('processArchitecture.tree.moveFailed')
        };
    } finally {
        moveSaving.value = false;
    }
}
</script>

<style scoped>
.tree-list {
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    overflow: hidden;
}

.tree-row {
    padding: 8px 12px;
    border-bottom: 1px solid #f5f5f5;
    min-height: 40px;
    transition: background-color 0.15s ease;
}

.tree-row:last-child {
    border-bottom: none;
}

.tree-row:hover {
    background-color: #fafafa;
}

.tree-row-clickable {
    cursor: pointer;
}

.tree-row-clickable:hover {
    background-color: #e3f2fd;
}

.tree-level-0 {
    background-color: #f8f9fa;
}

.tree-name {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 400px;
}

.tree-meta {
    flex-shrink: 0;
}

.tree-row .fav-btn {
    opacity: 0;
    transition: opacity 0.15s ease;
}

.tree-row:hover .fav-btn {
    opacity: 1;
}

.tree-row .fav-btn.is-fav {
    opacity: 1;
}

/* Drag & Drop styles */
.drag-handle {
    cursor: grab;
    opacity: 0.4;
    transition: opacity 0.15s ease;
}

.tree-row:hover .drag-handle {
    opacity: 0.8;
}

.dnd-dragging {
    opacity: 0.4;
}

.dnd-over {
    background-color: #E8F5E9 !important;
    border: 2px dashed #4CAF50 !important;
    border-radius: 4px;
}

/* To-Be view styles */
@keyframes wip-pulse {
    0%, 100% { background-color: transparent; }
    50% { background-color: rgba(123, 31, 162, 0.08); }
}

.wip-row {
    animation: wip-pulse 2s ease-in-out infinite;
    border-left: 3px solid #7B1FA2 !important;
}

.sunset-row {
    opacity: 0.7;
    border-left: 3px solid #C62828 !important;
}
</style>
