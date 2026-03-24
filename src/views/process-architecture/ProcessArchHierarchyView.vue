<template>
    <div class="hierarchy-view-container">
        <div class="hierarchy-view-actions">
            <div class="d-flex align-center ga-1">
                <v-btn variant="text" size="small" prepend-icon="mdi-unfold-more-horizontal" @click="expandAll">
                    {{ $t('processArchitecture.hierarchy.expandAll') }}
                </v-btn>
                <v-btn variant="text" size="small" prepend-icon="mdi-unfold-less-horizontal" @click="collapseAll">
                    {{ $t('processArchitecture.hierarchy.collapseAll') }}
                </v-btn>
            </div>
        </div>

        <div v-if="visibleDomains.length === 0" class="hierarchy-view-empty text-center text-grey pa-10">
            {{ t('processArchitecture.noData') }}
        </div>

        <div v-else class="hierarchy-view-body">
            <!-- All Domains View -->
            <div v-if="!isSingleDomainMode" class="all-domains-container">
                <div v-for="domain in visibleDomains" :key="domain.id" class="domain-section mb-6">
                    <div class="hierarchy-diagram-wrapper">
                        <div class="hierarchy-diagram">
                            <div class="tree-node-wrapper">
                                <div
                                    v-if="!hideDomainRoots"
                                    class="tree-node domain-node"
                                    :class="{ 'node-collapsible': getMegasForDomain(domain).length > 0 }"
                                    :style="domain.color ? { background: domain.color } : {}"
                                    @click="toggleNode(`domain-${domain.id}`)"
                                >
                                    <div class="node-name">{{ domain.name }}</div>
                                    <div class="node-sub">Domain</div>
                                    <v-icon v-if="getMegasForDomain(domain).length > 0" class="node-toggle-icon" size="16">
                                        {{ collapsed.has(`domain-${domain.id}`) ? 'mdi-chevron-down' : 'mdi-chevron-up' }}
                                    </v-icon>
                                </div>
                                <div v-else class="domain-section-title">{{ domain.name }}</div>

                                <transition name="fold">
                                    <div
                                        v-if="
                                            getMegasForDomain(domain).length > 0 &&
                                            (hideDomainRoots || !collapsed.has(`domain-${domain.id}`))
                                        "
                                        class="tree-children"
                                        :class="{ 'tree-children-root': hideDomainRoots }"
                                    >
                                        <div v-for="mega in getMegasForDomain(domain)" :key="mega.id" class="tree-node-wrapper">
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
                                                    v-if="
                                                        getMajorsInDomain(mega, domain).length > 0 &&
                                                        !collapsed.has(`mega-${domain.id}-${mega.id}`)
                                                    "
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
                                                                v-if="
                                                                    (major.sub_proc_list || []).length > 0 &&
                                                                    !collapsed.has(`major-${major.id}`)
                                                                "
                                                                class="tree-children"
                                                            >
                                                                <div
                                                                    v-for="sub in major.sub_proc_list || []"
                                                                    :key="sub.id"
                                                                    class="tree-node-wrapper"
                                                                >
                                                                    <div
                                                                        class="tree-node sub-node cursor-pointer"
                                                                        :class="getSubNodeClass(sub.id)"
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
                                                                                v-if="
                                                                                    processStatuses.get(sub.id)?.status &&
                                                                                    processStatuses.get(sub.id)?.status !== 'none'
                                                                                "
                                                                                type="status"
                                                                                :status="processStatuses.get(sub.id).status"
                                                                                size="x-small"
                                                                            />
                                                                            <span
                                                                                v-if="processStatuses.get(sub.id)?.version"
                                                                                class="text-caption"
                                                                            >
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
                            v-if="!hideDomainRoots"
                            class="tree-node domain-node"
                            :class="{ 'node-collapsible': megaProcessesForSingleDomain.length > 0 }"
                            :style="activeDomainData?.color ? { background: activeDomainData.color } : {}"
                            @click="toggleNode('domain')"
                        >
                            <div class="node-name">{{ activeDomainData?.name }}</div>
                            <div class="node-sub">Domain</div>
                            <v-icon v-if="megaProcessesForSingleDomain.length > 0" class="node-toggle-icon" size="16">
                                {{ collapsed.has('domain') ? 'mdi-chevron-down' : 'mdi-chevron-up' }}
                            </v-icon>
                        </div>

                        <transition name="fold">
                            <div
                                v-if="megaProcessesForSingleDomain.length > 0 && (hideDomainRoots || !collapsed.has('domain'))"
                                class="tree-children"
                                :class="{ 'tree-children-root': hideDomainRoots }"
                            >
                                <div v-for="mega in megaProcessesForSingleDomain" :key="mega.id" class="tree-node-wrapper">
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
                                                        <div v-for="sub in major.sub_proc_list || []" :key="sub.id" class="tree-node-wrapper">
                                                            <div
                                                                class="tree-node sub-node cursor-pointer"
                                                                :class="getSubNodeClass(sub.id)"
                                                                @click.stop="$emit('navigate', sub.id, sub.name)"
                                                            >
                                                                <div class="node-name">{{ sub.name }}</div>
                                                                <div class="node-meta d-flex align-center justify-center ga-1 mt-1">
                                                                    <ProgressBadge
                                                                        v-if="
                                                                            processStatuses.get(sub.id)?.status &&
                                                                            processStatuses.get(sub.id)?.status !== 'none'
                                                                        "
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

        <!-- Legend -->
        <div class="hierarchy-legend">
            <div class="legend-inline">
                <span class="legend-inline__title">
                    {{ t('processArchitecture.hierarchy.legendStructure') || '계층 구조' }}
                </span>
                <div v-for="item in structureLegendItems" :key="item.key" class="legend-item">
                    <div class="legend-box" :class="item.className"></div>
                    <span class="text-caption">{{ item.label }}</span>
                </div>
                <span class="legend-inline__divider">|</span>
                <span class="legend-inline__title">
                    {{ t('processArchitecture.hierarchy.legendStatus') || '프로세스 상태' }}
                </span>
                <div v-for="item in statusLegendItems" :key="item.key" class="legend-item">
                    <div class="legend-pill" :class="item.className"></div>
                    <span class="text-caption">{{ item.label }}</span>
                </div>
                <span class="legend-inline__divider">|</span>
                <v-icon size="14" color="grey">mdi-chevron-down</v-icon>
                <span class="text-caption text-grey">{{ t('processArchitecture.hierarchy.clickToToggle') }}</span>
                <span class="legend-inline__divider">|</span>
                <span class="text-caption text-grey">
                    {{ t('processArchitecture.hierarchy.statusGuide') || '상태 색상은 Sub Process 노드 기준으로 표시됩니다.' }}
                </span>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, getCurrentInstance } from 'vue';
import ProgressBadge from '@/components/ui/ProgressBadge.vue';

const instance = getCurrentInstance();
const t = (key: string) => {
    const fn = instance?.proxy?.$t;
    return fn ? (fn as any)(key) : key;
};

const props = defineProps<{
    procMap: any;
    domains: any[];
    processStatuses: Map<string, any>;
    selectedDomain: string | null;
    hideDomainRoots?: boolean;
    favorites?: Set<string>;
}>();

const emit = defineEmits<{
    (e: 'navigate', id: string, name?: string): void;
    (e: 'toggleFavorite', id: string): void;
}>();

const collapsed = ref(new Set<string>());

const structureLegendItems = computed(() => [
    {
        key: 'domain',
        label: t('processArchitecture.hierarchy.legendItems.domain') || '도메인',
        className: 'domain-node-color'
    },
    {
        key: 'mega',
        label: t('processArchitecture.hierarchy.legendItems.mega') || '메가프로세스',
        className: 'mega-node-color'
    },
    {
        key: 'major',
        label: t('processArchitecture.hierarchy.legendItems.major') || '메이저프로세스',
        className: 'major-node-color'
    },
    {
        key: 'sub',
        label: t('processArchitecture.hierarchy.legendItems.sub') || '서브프로세스',
        className: 'sub-node-color'
    }
]);

const statusLegendItems = computed(() => [
    {
        key: 'draft',
        label: t('progressBadge.draft') || '초안',
        className: 'legend-pill--draft'
    },
    {
        key: 'review',
        label: t('progressBadge.review') || '검토중',
        className: 'legend-pill--review'
    },
    {
        key: 'public_review',
        label: t('progressBadge.public_review') || '공람 중',
        className: 'legend-pill--public-review'
    },
    {
        key: 'published',
        label: t('progressBadge.published') || '배포 완료',
        className: 'legend-pill--published'
    },
    {
        key: 'wip',
        label: t('progressBadge.wip') || '차세대 기획 중',
        className: 'legend-pill--wip'
    },
    {
        key: 'sunset',
        label: t('progressBadge.sunset') || '폐기 예정',
        className: 'legend-pill--sunset'
    }
]);

const hideDomainRoots = computed(() => !!props.hideDomainRoots);

const visibleDomains = computed(() => {
    if (props.selectedDomain) {
        return (props.domains || []).filter((domain: any) => domain.id === props.selectedDomain || domain.name === props.selectedDomain);
    }
    return props.domains || [];
});

const isSingleDomainMode = computed(() => visibleDomains.value.length === 1);

const activeDomainData = computed(() => {
    return isSingleDomainMode.value ? visibleDomains.value[0] || null : null;
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
        if (!isSingleDomainMode.value) {
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

function getSubStatus(subId: string) {
    return props.processStatuses.get(subId)?.status || 'none';
}

function getSubNodeClass(subId: string) {
    return `sub-node--${String(getSubStatus(subId)).replace(/_/g, '-')}`;
}

watch(
    () => [props.selectedDomain, props.domains],
    () => {
        collapsed.value = new Set();
    },
    { deep: true }
);

watch(
    () => [visibleDomains.value, props.procMap],
    () => {
        expandAll();
    },
    { deep: true, immediate: true }
);
</script>

<style scoped>
.hierarchy-view-container {
    height: 100%;
    min-height: 0;
    padding: 20px;
    border: 1px solid #e5e7eb;
    border-radius: 16px;
    background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.hierarchy-view-actions {
    display: flex;
    justify-content: flex-end;
    flex-shrink: 0;
}

.hierarchy-view-empty {
    flex: 1;
}

.hierarchy-view-body {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding-right: 4px;
}

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

.domain-section-title {
    margin-bottom: 12px;
    color: #475569;
    font-size: 0.85rem;
    font-weight: 700;
    letter-spacing: 0.03em;
    text-align: center;
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

.tree-children-root {
    padding-top: 0;
}

.tree-children-root::before {
    display: none;
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
    background: #00695c;
    color: white;
}

.mega-node {
    background: #e65100;
    color: white;
}

.major-node {
    background: #2e7d32;
    color: white;
}

.sub-node {
    background: #ffffff;
    color: #1f2937;
    border: 1px solid #d1d5db;
    min-width: 132px;
    box-shadow: 0 6px 18px rgba(15, 23, 42, 0.08);
}

.sub-node::before {
    content: '';
    position: absolute;
    inset: 0 auto 0 0;
    width: 6px;
    border-radius: 8px 0 0 8px;
    background: #cbd5e1;
}

.sub-node:hover {
    background: #f8fafc;
    border-color: #1976d2;
}

.sub-node--none,
.sub-node--draft {
    background: #f8fafc;
    border-color: #cbd5e1;
    color: #334155;
}

.sub-node--none::before,
.sub-node--draft::before {
    background: #94a3b8;
}

.sub-node--review {
    background: #fff7ed;
    border-color: #fdba74;
    color: #9a3412;
}

.sub-node--review::before {
    background: #f59e0b;
}

.sub-node--public-review {
    background: #eff6ff;
    border-color: #93c5fd;
    color: #1d4ed8;
}

.sub-node--public-review::before {
    background: #2563eb;
}

.sub-node--published {
    background: #f0fdf4;
    border-color: #86efac;
    color: #166534;
}

.sub-node--published::before {
    background: #22c55e;
}

.sub-node--wip {
    background: #faf5ff;
    border-color: #d8b4fe;
    color: #7e22ce;
}

.sub-node--wip::before {
    background: #9333ea;
}

.sub-node--sunset {
    background: #fef2f2;
    border-color: #fca5a5;
    color: #b91c1c;
}

.sub-node--sunset::before {
    background: #ef4444;
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
    flex-shrink: 0;
    padding: 12px 16px;
    background: #f8fafc;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    overflow-x: auto;
}

.legend-item {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
}

.legend-inline {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: max-content;
    white-space: nowrap;
}

.legend-inline__title {
    font-size: 12px;
    font-weight: 700;
    color: #475569;
}

.legend-inline__divider {
    color: #94a3b8;
    font-size: 12px;
    font-weight: 700;
}

.legend-box {
    width: 16px;
    height: 16px;
    border-radius: 4px;
}

.domain-node-color {
    background: #00695c;
}

.mega-node-color {
    background: #e65100;
}

.major-node-color {
    background: #2e7d32;
}

.sub-node-color {
    background: #ffffff;
    border: 1px solid #d1d5db;
}

.legend-pill {
    width: 18px;
    height: 18px;
    border-radius: 999px;
    border: 1px solid transparent;
}

.legend-pill--draft {
    background: #f8fafc;
    border-color: #cbd5e1;
}

.legend-pill--review {
    background: #fff7ed;
    border-color: #fdba74;
}

.legend-pill--public-review {
    background: #eff6ff;
    border-color: #93c5fd;
}

.legend-pill--published {
    background: #f0fdf4;
    border-color: #86efac;
}

.legend-pill--wip {
    background: #faf5ff;
    border-color: #d8b4fe;
}

.legend-pill--sunset {
    background: #fef2f2;
    border-color: #fca5a5;
}

@media (max-width: 960px) {
    .hierarchy-view-container {
        padding: 16px;
    }
}
</style>
