<template>
    <div class="hierarchy-view-container">
        <!-- Domain selector + controls -->
        <div class="d-flex align-center justify-space-between mb-4 flex-wrap ga-2">
            <div v-if="domains.length > 0" class="d-flex align-center ga-2">
                <span class="text-body-2 text-grey-darken-1">{{ $t('processArchitecture.hierarchy.selectDomain') || 'Domain' }}:</span>
                <v-chip-group v-model="activeDomainIndex">
                    <v-chip
                        :color="activeDomainIndex === undefined || activeDomainIndex === null ? 'primary' : undefined"
                        :variant="activeDomainIndex === undefined || activeDomainIndex === null ? 'flat' : 'outlined'"
                        size="small"
                        @click="activeDomainIndex = undefined"
                    >
                        {{ $t('processArchitecture.allDomains') || '전체' }}
                    </v-chip>
                    <v-chip
                        v-for="(domain, idx) in domains"
                        :key="domain.id"
                        :color="domain.color || 'primary'"
                        :variant="activeDomainIndex === idx ? 'flat' : 'outlined'"
                        size="small"
                        @click="activeDomainIndex = idx"
                    >
                        {{ domain.name }}
                    </v-chip>
                </v-chip-group>
            </div>
            <div class="d-flex align-center ga-1">
                <v-btn variant="text" size="small" prepend-icon="mdi-unfold-more-horizontal" @click="expandAll">
                    {{ $t('processArchitecture.hierarchy.expandAll') }}
                </v-btn>
                <v-btn variant="text" size="small" prepend-icon="mdi-unfold-less-horizontal" @click="collapseAll">
                    {{ $t('processArchitecture.hierarchy.collapseAll') }}
                </v-btn>
            </div>
        </div>

        <div v-if="visibleDomains.length === 0" class="text-center text-grey pa-10">
            {{ $t('processArchitecture.noData') }}
        </div>

        <!-- All Domains View -->
        <div v-else-if="isAllDomainsMode" class="all-domains-container">
            <div
                v-for="domain in visibleDomains"
                :key="domain.id"
                class="domain-section mb-6"
            >
                <div class="hierarchy-diagram-wrapper">
                    <div class="hierarchy-diagram">
                        <div class="tree-node-wrapper">
                            <div
                                class="tree-node domain-node"
                                :class="{ 'node-collapsible': getMegasForDomain(domain).length > 0 }"
                                :style="domain.color ? { background: domain.color } : {}"
                                @click="toggleNode(`domain-${domain.id}`)"
                            >
                                <div class="node-name">{{ domain.name }}</div>
                                <div class="node-sub">Domain</div>
                                <v-icon
                                    v-if="getMegasForDomain(domain).length > 0"
                                    class="node-toggle-icon"
                                    size="16"
                                >
                                    {{ collapsed.has(`domain-${domain.id}`) ? 'mdi-chevron-down' : 'mdi-chevron-up' }}
                                </v-icon>
                            </div>

                            <transition name="fold">
                                <div
                                    v-if="getMegasForDomain(domain).length > 0 && !collapsed.has(`domain-${domain.id}`)"
                                    class="tree-children"
                                >
                                    <div
                                        v-for="mega in getMegasForDomain(domain)"
                                        :key="mega.id"
                                        class="tree-node-wrapper"
                                    >
                                        <div
                                            class="tree-node mega-node"
                                            :class="{ 'node-collapsible': getMajorsInDomain(mega, domain).length > 0 }"
                                            @click="toggleNode(`mega-${domain.id}-${mega.id}`)"
                                        >
                                            <div class="node-name">{{ mega.name }}</div>
                                            <div class="node-sub">Mega</div>
                                            <v-icon
                                                v-if="getMajorsInDomain(mega, domain).length > 0"
                                                class="node-toggle-icon"
                                                size="14"
                                            >
                                                {{ collapsed.has(`mega-${domain.id}-${mega.id}`) ? 'mdi-chevron-down' : 'mdi-chevron-up' }}
                                            </v-icon>
                                        </div>

                                        <transition name="fold">
                                            <div
                                                v-if="getMajorsInDomain(mega, domain).length > 0 && !collapsed.has(`mega-${domain.id}-${mega.id}`)"
                                                class="tree-children"
                                            >
                                                <div
                                                    v-for="major in getMajorsInDomain(mega, domain)"
                                                    :key="major.id"
                                                    class="tree-node-wrapper"
                                                >
                                                    <div
                                                        class="tree-node major-node"
                                                        :class="{ 'node-collapsible': (major.sub_proc_list || []).length > 0 }"
                                                        @click="toggleNode(`major-${major.id}`)"
                                                    >
                                                        <div class="node-name">{{ major.name }}</div>
                                                        <div class="node-sub">{{ (major.sub_proc_list || []).length }} sub</div>
                                                        <v-icon
                                                            v-if="(major.sub_proc_list || []).length > 0"
                                                            class="node-toggle-icon"
                                                            size="14"
                                                        >
                                                            {{ collapsed.has(`major-${major.id}`) ? 'mdi-chevron-down' : 'mdi-chevron-up' }}
                                                        </v-icon>
                                                    </div>

                                                    <transition name="fold">
                                                        <div
                                                            v-if="(major.sub_proc_list || []).length > 0 && !collapsed.has(`major-${major.id}`)"
                                                            class="tree-children"
                                                        >
                                                            <div
                                                                v-for="sub in (major.sub_proc_list || [])"
                                                                :key="sub.id"
                                                                class="tree-node-wrapper"
                                                            >
                                                                <div
                                                                    class="tree-node sub-node cursor-pointer"
                                                                    @click.stop="emit('navigate', sub.id, sub.name)"
                                                                >
                                                                    <v-btn
                                                                        icon
                                                                        variant="text"
                                                                        size="x-small"
                                                                        :class="['fav-btn', { 'is-fav': favorites?.has(sub.id) }]"
                                                                        @click.stop="emit('toggleFavorite', sub.id)"
                                                                    >
                                                                        <v-icon
                                                                            size="12"
                                                                            :color="favorites?.has(sub.id) ? 'amber' : 'grey-lighten-1'"
                                                                        >
                                                                            {{ favorites?.has(sub.id) ? 'mdi-star' : 'mdi-star-outline' }}
                                                                        </v-icon>
                                                                    </v-btn>
                                                                    <div class="node-name">{{ sub.name }}</div>
                                                                    <div class="node-meta d-flex align-center justify-center ga-1 mt-1">
                                                                        <ProgressBadge
                                                                            v-if="processStatuses.get(sub.id)"
                                                                            type="status"
                                                                            :status="processStatuses.get(sub.id).status"
                                                                            size="x-small"
                                                                        />
                                                                        <span v-if="processStatuses.get(sub.id)?.version" class="text-caption">
                                                                            v{{ processStatuses.get(sub.id).version }}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </transition>
                                                </div>
                                            </div>
                                        </transition>
                                    </div>
                                </div>
                            </transition>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Single Domain View -->
        <div v-else class="hierarchy-diagram-wrapper overflow-x-auto">
            <div class="hierarchy-diagram">
                <div class="tree-node-wrapper">
                    <div
                        class="tree-node domain-node"
                        :class="{ 'node-collapsible': megaProcessesForSingleDomain.length > 0 }"
                        :style="activeDomainData?.color ? { background: activeDomainData.color } : {}"
                        @click="toggleNode('domain')"
                    >
                        <div class="node-name">{{ activeDomainData?.name }}</div>
                        <div class="node-sub">Domain</div>
                        <v-icon
                            v-if="megaProcessesForSingleDomain.length > 0"
                            class="node-toggle-icon"
                            size="16"
                        >
                            {{ collapsed.has('domain') ? 'mdi-chevron-down' : 'mdi-chevron-up' }}
                        </v-icon>
                    </div>

                    <transition name="fold">
                        <div
                            v-if="megaProcessesForSingleDomain.length > 0 && !collapsed.has('domain')"
                            class="tree-children"
                        >
                            <div
                                v-for="mega in megaProcessesForSingleDomain"
                                :key="mega.id"
                                class="tree-node-wrapper"
                            >
                                <div
                                    class="tree-node mega-node"
                                    :class="{ 'node-collapsible': getMajorsInDomain(mega, activeDomainData).length > 0 }"
                                    @click="toggleNode(`mega-${mega.id}`)"
                                >
                                    <div class="node-name">{{ mega.name }}</div>
                                    <div class="node-sub">Mega</div>
                                    <v-icon
                                        v-if="getMajorsInDomain(mega, activeDomainData).length > 0"
                                        class="node-toggle-icon"
                                        size="14"
                                    >
                                        {{ collapsed.has(`mega-${mega.id}`) ? 'mdi-chevron-down' : 'mdi-chevron-up' }}
                                    </v-icon>
                                </div>

                                <transition name="fold">
                                    <div
                                        v-if="getMajorsInDomain(mega, activeDomainData).length > 0 && !collapsed.has(`mega-${mega.id}`)"
                                        class="tree-children"
                                    >
                                        <div
                                            v-for="major in getMajorsInDomain(mega, activeDomainData)"
                                            :key="major.id"
                                            class="tree-node-wrapper"
                                        >
                                            <div
                                                class="tree-node major-node"
                                                :class="{ 'node-collapsible': (major.sub_proc_list || []).length > 0 }"
                                                @click="toggleNode(`major-${major.id}`)"
                                            >
                                                <div class="node-name">{{ major.name }}</div>
                                                <div class="node-sub">{{ (major.sub_proc_list || []).length }} sub</div>
                                                <v-icon
                                                    v-if="(major.sub_proc_list || []).length > 0"
                                                    class="node-toggle-icon"
                                                    size="14"
                                                >
                                                    {{ collapsed.has(`major-${major.id}`) ? 'mdi-chevron-down' : 'mdi-chevron-up' }}
                                                </v-icon>
                                            </div>

                                            <transition name="fold">
                                                <div
                                                    v-if="(major.sub_proc_list || []).length > 0 && !collapsed.has(`major-${major.id}`)"
                                                    class="tree-children"
                                                >
                                                    <div
                                                        v-for="sub in (major.sub_proc_list || [])"
                                                        :key="sub.id"
                                                        class="tree-node-wrapper"
                                                    >
                                                        <div
                                                            class="tree-node sub-node cursor-pointer"
                                                            @click.stop="$emit('navigate', sub.id, sub.name)"
                                                        >
                                                            <div class="node-name">{{ sub.name }}</div>
                                                            <div class="node-meta d-flex align-center justify-center ga-1 mt-1">
                                                                <ProgressBadge
                                                                    v-if="processStatuses.get(sub.id)"
                                                                    type="status"
                                                                    :status="processStatuses.get(sub.id).status"
                                                                    size="x-small"
                                                                />
                                                                <span v-if="processStatuses.get(sub.id)?.version" class="text-caption">
                                                                    v{{ processStatuses.get(sub.id).version }}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </transition>
                                        </div>
                                    </div>
                                </transition>
                            </div>
                        </div>
                    </transition>
                </div>
            </div>
        </div>

        <!-- Legend -->
        <div class="hierarchy-legend d-flex align-center ga-4 mt-4 pa-3">
            <div class="d-flex align-center ga-2">
                <div class="legend-box domain-node-color"></div>
                <span class="text-caption">Domain</span>
            </div>
            <div class="d-flex align-center ga-2">
                <div class="legend-box mega-node-color"></div>
                <span class="text-caption">Mega Process</span>
            </div>
            <div class="d-flex align-center ga-2">
                <div class="legend-box major-node-color"></div>
                <span class="text-caption">Major Process</span>
            </div>
            <div class="d-flex align-center ga-2">
                <div class="legend-box sub-node-color"></div>
                <span class="text-caption">Sub Process</span>
            </div>
            <v-divider vertical class="mx-2" style="height: 16px;" />
            <div class="d-flex align-center ga-1">
                <v-icon size="14" color="grey">mdi-chevron-down</v-icon>
                <span class="text-caption text-grey">{{ $t('processArchitecture.hierarchy.clickToToggle') }}</span>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import ProgressBadge from '@/components/ui/ProgressBadge.vue';

const props = defineProps<{
    procMap: any;
    domains: any[];
    processStatuses: Map<string, any>;
    selectedDomain: string | null;
    favorites?: Set<string>;
}>();

const emit = defineEmits<{
    (e: 'navigate', id: string, name?: string): void;
    (e: 'toggleFavorite', id: string): void;
}>();

const activeDomainIndex = ref<number | undefined>(undefined);
const collapsed = ref(new Set<string>());

const isAllDomainsMode = computed(() => activeDomainIndex.value === undefined || activeDomainIndex.value === null);

// If parent selectedDomain changes, sync
watch(() => props.selectedDomain, (val) => {
    if (val) {
        const idx = props.domains.findIndex((d: any) => d.name === val);
        if (idx >= 0) activeDomainIndex.value = idx;
    } else {
        activeDomainIndex.value = undefined;
    }
});

// Reset collapsed state when domain changes
watch(activeDomainIndex, () => {
    collapsed.value = new Set();
});

const visibleDomains = computed(() => {
    if (isAllDomainsMode.value) return props.domains;
    if (activeDomainIndex.value !== undefined && props.domains[activeDomainIndex.value]) {
        return [props.domains[activeDomainIndex.value]];
    }
    return props.domains;
});

const activeDomainData = computed(() => {
    if (props.domains.length === 0 || activeDomainIndex.value === undefined) return null;
    return props.domains[activeDomainIndex.value] || props.domains[0];
});

// For single domain mode
const megaProcessesForSingleDomain = computed(() => {
    if (!activeDomainData.value || !props.procMap?.mega_proc_list) return [];
    return getMegasForDomain(activeDomainData.value);
});

function getMegasForDomain(domain: any): any[] {
    if (!domain || !props.procMap?.mega_proc_list) return [];
    const domainId = domain.id;
    const domainName = domain.name;

    return props.procMap.mega_proc_list.filter((mega: any) => {
        return (mega.major_proc_list || []).some((major: any) => {
            const d = major.domain || major.domain_id;
            return d === domainName || d === domainId;
        });
    });
}

function getMajorsInDomain(mega: any, domain: any): any[] {
    if (!domain) return [];
    const domainId = domain.id;
    const domainName = domain.name;
    return (mega.major_proc_list || []).filter((major: any) => {
        const d = major.domain || major.domain_id;
        return d === domainName || d === domainId;
    });
}

function toggleNode(key: string) {
    const next = new Set(collapsed.value);
    if (next.has(key)) {
        next.delete(key);
    } else {
        next.add(key);
    }
    collapsed.value = next;
}

function expandAll() {
    collapsed.value = new Set();
}

function collapseAll() {
    const keys = new Set<string>();
    for (const domain of visibleDomains.value) {
        if (isAllDomainsMode.value) {
            keys.add(`domain-${domain.id}`);
            for (const mega of getMegasForDomain(domain)) {
                keys.add(`mega-${domain.id}-${mega.id}`);
                for (const major of getMajorsInDomain(mega, domain)) {
                    keys.add(`major-${major.id}`);
                }
            }
        } else {
            keys.add('domain');
            for (const mega of megaProcessesForSingleDomain.value) {
                keys.add(`mega-${mega.id}`);
                for (const major of getMajorsInDomain(mega, domain)) {
                    keys.add(`major-${major.id}`);
                }
            }
        }
    }
    collapsed.value = keys;
}
</script>

<style scoped>
.hierarchy-diagram-wrapper {
    padding: 16px 0;
    overflow-x: auto;
}

.hierarchy-diagram {
    display: flex;
    justify-content: center;
}

.all-domains-container {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.domain-section {
    border-bottom: 1px solid #eee;
    padding-bottom: 16px;
}

.domain-section:last-child {
    border-bottom: none;
}

/* Tree layout using CSS flexbox */
.tree-node-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
}

.tree-children {
    display: flex;
    gap: 12px;
    padding-top: 24px;
    position: relative;
}

/* Connecting lines */
.tree-children::before {
    content: '';
    position: absolute;
    top: 0;
    left: 50%;
    width: 0;
    height: 12px;
    border-left: 2px solid #bdbdbd;
}

.tree-children > .tree-node-wrapper {
    position: relative;
}

.tree-children > .tree-node-wrapper::before {
    content: '';
    position: absolute;
    top: -12px;
    left: 50%;
    width: 0;
    height: 12px;
    border-left: 2px solid #bdbdbd;
}

/* Horizontal connector between siblings */
.tree-children > .tree-node-wrapper:not(:only-child)::after {
    content: '';
    position: absolute;
    top: -12px;
    width: 100%;
    height: 0;
    border-top: 2px solid #bdbdbd;
}

.tree-children > .tree-node-wrapper:first-child:not(:only-child)::after {
    left: 50%;
    width: 50%;
}

.tree-children > .tree-node-wrapper:last-child:not(:only-child)::after {
    right: 50%;
    left: auto;
    width: 50%;
}

.tree-children > .tree-node-wrapper:not(:first-child):not(:last-child)::after {
    left: 0;
    width: 100%;
}

/* Node styles */
.tree-node {
    padding: 10px 16px;
    border-radius: 8px;
    text-align: center;
    min-width: 100px;
    max-width: 160px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
    transition: transform 0.15s ease, box-shadow 0.15s ease;
    position: relative;
}

.tree-node:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
}

.node-collapsible {
    cursor: pointer;
    padding-bottom: 20px;
}

.node-toggle-icon {
    position: absolute;
    bottom: 2px;
    left: 50%;
    transform: translateX(-50%);
    opacity: 0.7;
    color: inherit;
}

.node-collapsible:hover .node-toggle-icon {
    opacity: 1;
}

.node-name {
    font-size: 0.8rem;
    font-weight: 600;
    word-break: keep-all;
    overflow-wrap: break-word;
}

.node-sub {
    font-size: 0.65rem;
    opacity: 0.8;
    margin-top: 2px;
}

.domain-node {
    background: #00695C;
    color: white;
}

.mega-node {
    background: #E65100;
    color: white;
}

.major-node {
    background: #2E7D32;
    color: white;
}

.sub-node {
    background: #f5f5f5;
    color: #424242;
    border: 1px solid #e0e0e0;
}

.sub-node:hover {
    background: #e3f2fd;
    border-color: #1976D2;
}

.sub-node .fav-btn {
    position: absolute;
    top: 2px;
    right: 2px;
    opacity: 0;
    transition: opacity 0.15s ease;
}

.sub-node:hover .fav-btn {
    opacity: 1;
}

.sub-node .fav-btn.is-fav {
    opacity: 1;
}

/* Fold transition */
.fold-enter-active,
.fold-leave-active {
    transition: opacity 0.25s ease, transform 0.25s ease;
    transform-origin: top center;
}

.fold-enter-from,
.fold-leave-to {
    opacity: 0;
    transform: scaleY(0.6);
}

/* Legend */
.hierarchy-legend {
    background: #f5f5f5;
    border-radius: 8px;
}

.legend-box {
    width: 16px;
    height: 16px;
    border-radius: 4px;
}

.domain-node-color {
    background: #00695C;
}

.mega-node-color {
    background: #E65100;
}

.major-node-color {
    background: #2E7D32;
}

.sub-node-color {
    background: #f5f5f5;
    border: 1px solid #e0e0e0;
}
</style>
