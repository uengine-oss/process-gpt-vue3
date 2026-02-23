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
                    { 'tree-row-clickable': row.type === 'sub' }
                ]"
                :style="{ paddingLeft: `${row.level * 24 + 12}px` }"
                @click="row.type === 'sub' ? $emit('navigate', row.id, row.name) : null"
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

                    <!-- Status badge for sub processes -->
                    <ProgressBadge
                        v-if="row.type === 'sub' && row.status"
                        type="status"
                        :status="row.status.status"
                        size="x-small"
                    />

                    <!-- Version -->
                    <span v-if="row.type === 'sub' && row.status?.version" class="text-caption text-grey">
                        v{{ row.status.version }}
                    </span>
                </div>
            </div>
        </div>
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
}>();

defineEmits<{
    (e: 'navigate', id: string, name?: string): void;
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
                    addMajorRows(result, major, 2, `domain-${domain.id}-mega-${mega.id}`);
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
                        addMajorRows(result, o.major, 2, megaKey);
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
                addMajorRows(result, major, 1, megaKey);
            }
        }
    }

    return result;
});

function addMajorRows(result: TreeRow[], major: any, level: number, parentKey: string) {
    const majorKey = `${parentKey}-major-${major.id}`;
    const subs = major.sub_proc_list || [];
    result.push({
        key: majorKey,
        type: 'major',
        level,
        id: major.id,
        name: major.name,
        hasChildren: subs.length > 0,
        count: subs.length
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
            status: props.processStatuses.get(sub.id)
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
</style>
