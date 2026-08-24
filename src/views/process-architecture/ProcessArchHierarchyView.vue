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
                <div class="d-flex align-center ga-1 hierarchy-zoom-controls">
                    <v-tooltip :text="t('processArchitecture.hierarchy.zoomOut') || t('BpmnUengine.zoomOut') || '축소'" location="bottom">
                        <template #activator="{ props: tooltipProps }">
                            <v-btn
                                v-bind="tooltipProps"
                                icon="mdi-magnify-minus-outline"
                                variant="text"
                                size="small"
                                :disabled="!canZoomOut"
                                @click="zoomOut"
                            />
                        </template>
                    </v-tooltip>
                    <span class="hierarchy-zoom-level text-caption">{{ zoomPercent }}%</span>
                    <v-tooltip :text="t('processArchitecture.hierarchy.zoomIn') || t('BpmnUengine.zoomIn') || '확대'" location="bottom">
                        <template #activator="{ props: tooltipProps }">
                            <v-btn
                                v-bind="tooltipProps"
                                icon="mdi-magnify-plus-outline"
                                variant="text"
                                size="small"
                                :disabled="!canZoomIn"
                                @click="zoomIn"
                            />
                        </template>
                    </v-tooltip>
                </div>
                <v-btn v-if="!props.readonly" variant="tonal" size="small" color="primary" prepend-icon="mdi-plus" @click="emit('addProcess', { type: 'mega' })">
                    {{ $t('processHierarchy.addMega') || 'Mega 프로세스 추가' }}
                </v-btn>
            </div>
        </div>

        <div v-if="visibleDomains.length === 0" class="hierarchy-view-empty text-center text-grey pa-10">
            {{ t('processArchitecture.noData') }}
        </div>

        <div v-else ref="diagramViewportRef" class="hierarchy-view-body">
            <div class="hierarchy-zoom-shell" :style="zoomShellStyle">
                <div class="hierarchy-zoom-stage" :style="zoomStageStyle">
                    <div ref="diagramCanvasRef" class="hierarchy-zoom-canvas" :style="zoomCanvasStyle">
                        <div class="all-domains-container">
                            <div v-for="domain in visibleDomains" :key="domain.id" class="domain-section mb-6">
                                <div class="hierarchy-diagram-wrapper">
                                    <div class="hierarchy-diagram">
                                        <div class="tree-node-wrapper">
                                            <div
                                                class="tree-node domain-node"
                                                :class="{ 'node-collapsible': getMegasForDomain(domain).length > 0 }"
                                                :style="getDomainNodeStyle(domain)"
                                                @click="toggleNode(`domain-${domain.id}`)"
                                            >
                                                <div class="node-name">{{ domain.name }}</div>
                                                <div class="node-sub">Domain</div>
                                                <v-icon v-if="getMegasForDomain(domain).length > 0" class="node-toggle-icon" size="16">
                                                    {{ collapsed.has(`domain-${domain.id}`) ? 'mdi-chevron-down' : 'mdi-chevron-up' }}
                                                </v-icon>
                                            </div>
                                            <transition name="fold">
                                                <div
                                                    v-if="
                                                        getMegasForDomain(domain).length > 0 &&
                                                        !collapsed.has(`domain-${domain.id}`)
                                                    "
                                                    class="tree-children"
                                                >
                                                    <div v-for="mega in getMegasForDomain(domain)" :key="mega.id" class="tree-node-wrapper">
                                                        <div
                                                            class="tree-node mega-node"
                                                            :class="{ 'node-collapsible': getMajorsInDomain(mega, domain).length > 0 }"
                                                            @click="toggleNode(`mega-${domain.id}-${mega.id}`)"
                                                        >
                                                            <div class="node-name">{{ mega.name }}</div>
                                                            <div class="node-sub">Mega</div>
                                                            <v-icon v-if="!props.readonly" class="node-add-icon" size="12" @click.stop="emit('addProcess', { type: 'major', megaId: mega.id })">mdi-plus</v-icon>
                                                            <v-icon v-if="!props.readonly" class="node-edit-icon" size="12" @click.stop="emit('editProcess', { type: 'mega', id: mega.id, name: mega.name })">mdi-pencil-outline</v-icon>
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
                                                                        <v-icon v-if="isUpdatedSinceLastVisit?.(major)" size="8" color="info" class="mr-1">mdi-circle</v-icon>
                                                                        <div v-if="getProcessLabelCode(major.name)" class="node-code">
                                                                            {{ getProcessLabelCode(major.name) }}
                                                                        </div>
                                                                        <div class="node-name">{{ getProcessLabelName(major.name) }}</div>
                                                                        <div class="node-sub">{{ (major.sub_proc_list || []).length }} sub</div>
                                                                        <v-icon v-if="!props.readonly" class="node-edit-icon" size="12" @click.stop="emit('editProcess', { type: 'major', id: major.id, name: major.name })">mdi-pencil-outline</v-icon>
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
                                                                            class="tree-children tree-children-vertical"
                                                                        >
                                                                            <div
                                                                                v-for="sub in sortedSubs(major)"
                                                                                :key="sub.id"
                                                                                class="tree-node-wrapper"
                                                                            >
                                                                                <div
                                                                                    class="tree-node sub-node cursor-pointer"
                                                                                    :class="getSubNodeClass(sub.id)"
                                                                                    :title="processDescription(sub)"
                                                                                    @click.stop="emit('navigate', sub.id, sub.name)"
                                                                                >
                                                                                    <v-tooltip v-if="processDescription(sub)" activator="parent" location="top" max-width="360">
                                                                                        <div class="process-desc-tooltip">{{ processDescription(sub) }}</div>
                                                                                    </v-tooltip>
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
                                                                                    <v-icon v-if="isUpdatedSinceLastVisit?.(sub)" size="8" color="info" class="updated-dot">mdi-circle</v-icon>
                                                                                    <div v-if="getProcessLabelCode(sub.name)" class="node-code">
                                                                                        {{ getProcessLabelCode(sub.name) }}
                                                                                    </div>
                                                                                    <div class="node-name">{{ getProcessLabelName(sub.name) }}</div>
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
                                                                                    <div
                                                                                        v-if="kpiTaggedProcessIds?.get(sub.id)"
                                                                                        class="d-flex justify-center mt-1"
                                                                                    >
                                                                                        <v-chip
                                                                                            size="x-small"
                                                                                            color="primary"
                                                                                            variant="tonal"
                                                                                            class="kpi-org-chip"
                                                                                        >
                                                                                            {{ kpiTaggedProcessIds.get(sub.id) }}
                                                                                        </v-chip>
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
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, getCurrentInstance, nextTick, onMounted, onBeforeUnmount } from 'vue';
import ProgressBadge from '@/components/ui/ProgressBadge.vue';
import { compareMajorsByStage, getMajorBusinessDomain, majorMatchesDomain } from './processClassification';

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
    isUpdatedSinceLastVisit?: (process: any) => boolean;
    readonly?: boolean;
    kpiTaggedProcessIds?: Map<string, string>;
}>();

const emit = defineEmits<{
    (e: 'navigate', id: string, name?: string): void;
    (e: 'toggleFavorite', id: string): void;
    (e: 'editProcess', row: { type: string; id: string; name: string }): void;
    (e: 'addProcess', row: { type: string; megaId?: string }): void;
}>();

const collapsed = ref(new Set<string>());
const diagramViewportRef = ref<HTMLElement | null>(null);
const diagramCanvasRef = ref<HTMLElement | null>(null);
const canvasSize = ref({ width: 0, height: 0 });
const autoFitScale = ref(1);
const manualZoomFactor = ref(1);
const MANUAL_ZOOM_STEP = 0.1;
const MIN_MANUAL_ZOOM_FACTOR = 0.5;
const MAX_MANUAL_ZOOM_FACTOR = 3;
const MIN_EFFECTIVE_SCALE = 0.1;
const MAX_EFFECTIVE_SCALE = 3;
const UNASSIGNED_DOMAIN_ID = '__unassigned__';
const unassignedDomain = {
    id: UNASSIGNED_DOMAIN_ID,
    name: '미분류',
    color: '#78909C'
};
let resizeObserver: ResizeObserver | null = null;
let resizeFrame: number | null = null;

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
        key: 'in_review',
        label: t('progressBadge.in_review') || t('progressBadge.review') || '검토',
        className: 'legend-pill--review'
    },
    {
        key: 'public_feedback',
        label: t('progressBadge.public_feedback') || t('progressBadge.public_review') || '공람',
        className: 'legend-pill--public-feedback'
    },
    {
        key: 'final_edit',
        label: t('progressBadge.final_edit') || '최종수정',
        className: 'legend-pill--final-edit'
    },
    {
        key: 'published',
        label: t('progressBadge.published') || '완료',
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

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

function round(value: number, digits = 3): number {
    return Number(value.toFixed(digits));
}

const effectiveScale = computed(() => clamp(round(autoFitScale.value * manualZoomFactor.value, 4), MIN_EFFECTIVE_SCALE, MAX_EFFECTIVE_SCALE));
const zoomPercent = computed(() => Math.round(effectiveScale.value * 100));
const canZoomOut = computed(() => manualZoomFactor.value > MIN_MANUAL_ZOOM_FACTOR + 0.001);
const canZoomIn = computed(() => manualZoomFactor.value < MAX_MANUAL_ZOOM_FACTOR - 0.001);

const zoomShellStyle = computed(() => ({
    width: canvasSize.value.width > 0 ? `${Math.ceil(canvasSize.value.width * effectiveScale.value)}px` : '100%',
    height: canvasSize.value.height > 0 ? `${Math.ceil(canvasSize.value.height * effectiveScale.value)}px` : '100%'
}));

const zoomStageStyle = computed(() => ({
    width: canvasSize.value.width > 0 ? `${canvasSize.value.width}px` : 'auto',
    height: canvasSize.value.height > 0 ? `${canvasSize.value.height}px` : 'auto'
}));

const zoomCanvasStyle = computed(() => ({
    transform: `scale(${effectiveScale.value})`
}));

function getDomainNodeStyle(domain: any): Record<string, string> {
    const color = String(domain?.color || '').trim();
    return {
        '--domain-color': color || '#004d40'
    };
}

function isUnassignedDomain(domain: any): boolean {
    return domain?.id === UNASSIGNED_DOMAIN_ID;
}

function isKnownDomainValue(value: string): boolean {
    if (!value) return false;
    return (props.domains || []).some((domain: any) => domain.name === value || domain.id === value);
}

function isMajorUnassigned(major: any): boolean {
    const domainValue = getMajorBusinessDomain(major, props.domains);
    return !domainValue || !isKnownDomainValue(domainValue);
}

const hasUnassignedStructures = computed(() => {
    for (const mega of props.procMap?.mega_proc_list || []) {
        if ((mega.major_proc_list || []).some((major: any) => isMajorUnassigned(major))) return true;
    }
    return false;
});

const visibleDomains = computed(() => {
    if (props.selectedDomain) {
        return (props.domains || []).filter((domain: any) => domain.id === props.selectedDomain || domain.name === props.selectedDomain);
    }
    const baseDomains = props.domains || [];
    return hasUnassignedStructures.value ? [...baseDomains, unassignedDomain] : baseDomains;
});

function getDomainKey(domain: any): string {
    return String(domain?.id || domain?.name || '');
}

function getDomainMegaKey(domain: any, mega: any): string {
    return `${getDomainKey(domain)}::${mega?.id || mega?.name || ''}`;
}

const hierarchyIndex = computed(() => {
    const megasByDomain = new Map<string, any[]>();
    const majorsByDomainMega = new Map<string, any[]>();

    for (const domain of visibleDomains.value) {
        const domainKey = getDomainKey(domain);
        const megas: any[] = [];

        for (const mega of props.procMap?.mega_proc_list || []) {
            const majors = (mega.major_proc_list || [])
                .filter((major: any) =>
                    isUnassignedDomain(domain) ? isMajorUnassigned(major) : majorMatchesDomain(major, domain, props.domains)
                )
                .sort(compareMajorsByStage);

            if (majors.length === 0) continue;
            const hasSubsInDomain = majors.some((major: any) => (major.sub_proc_list || []).length > 0);
            if (!hasSubsInDomain) continue;
            megas.push(mega);
            majorsByDomainMega.set(getDomainMegaKey(domain, mega), majors);
        }

        megasByDomain.set(domainKey, megas);
    }

    return { megasByDomain, majorsByDomainMega };
});

function getMegasForDomain(domain: any): any[] {
    if (!domain) return [];
    return hierarchyIndex.value.megasByDomain.get(getDomainKey(domain)) || [];
}

function getMajorsInDomain(mega: any, domain: any): any[] {
    if (!domain) return [];
    return hierarchyIndex.value.majorsByDomainMega.get(getDomainMegaKey(domain, mega)) || [];
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
        keys.add(`domain-${domain.id}`);
        for (const mega of getMegasForDomain(domain)) {
            keys.add(`mega-${domain.id}-${mega.id}`);
            for (const major of getMajorsInDomain(mega, domain)) {
                keys.add(`major-${major.id}`);
            }
        }
    }
    collapsed.value = keys;
}

function sortedSubs(major: any): any[] {
    return [...(major.sub_proc_list || [])].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'));
}

function getSubStatus(subId: string) {
    return props.processStatuses.get(subId)?.status || 'none';
}

function splitProcessLabel(value: any): { code: string; name: string } {
    const raw = String(value || '').trim();
    if (!raw) return { code: '', name: '' };

    const match = raw.match(/^(\[[^\]]+\])(?:\s+|$)(.*)$/);
    if (!match) {
        return { code: '', name: raw };
    }

    return {
        code: match[1],
        name: match[2].trim()
    };
}

function getProcessLabelCode(value: any): string {
    return splitProcessLabel(value).code;
}

function getProcessLabelName(value: any): string {
    const { code, name } = splitProcessLabel(value);
    return name || code;
}

function processDescription(process: any): string {
    return String(process?.description || '').trim();
}

function getSubNodeClass(subId: string) {
    return `sub-node--${String(getSubStatus(subId)).replace(/_/g, '-')}`;
}

function syncZoomLayout() {
    const viewport = diagramViewportRef.value;
    const canvas = diagramCanvasRef.value;

    if (!viewport || !canvas) {
        canvasSize.value = { width: 0, height: 0 };
        autoFitScale.value = 1;
        return;
    }

    const width = Math.ceil(Math.max(canvas.scrollWidth, canvas.clientWidth, canvas.offsetWidth));
    const height = Math.ceil(Math.max(canvas.scrollHeight, canvas.clientHeight, canvas.offsetHeight));
    canvasSize.value = { width, height };

    const availableWidth = Math.max(viewport.clientWidth - 24, 0);
    autoFitScale.value = width > 0 && availableWidth > 0 ? round(Math.min(1, availableWidth / width), 4) : 1;
}

function scheduleZoomLayoutSync() {
    if (typeof window === 'undefined') return;

    if (resizeFrame !== null) {
        window.cancelAnimationFrame(resizeFrame);
    }

    resizeFrame = window.requestAnimationFrame(() => {
        resizeFrame = null;
        void nextTick().then(syncZoomLayout);
    });
}

function bindResizeObserver() {
    resizeObserver?.disconnect();
    resizeObserver = null;

    if (typeof ResizeObserver === 'undefined') return;

    resizeObserver = new ResizeObserver(() => {
        scheduleZoomLayoutSync();
    });

    if (diagramViewportRef.value) resizeObserver.observe(diagramViewportRef.value);
    if (diagramCanvasRef.value) resizeObserver.observe(diagramCanvasRef.value);
}

function zoomOut() {
    manualZoomFactor.value = round(clamp(manualZoomFactor.value - MANUAL_ZOOM_STEP, MIN_MANUAL_ZOOM_FACTOR, MAX_MANUAL_ZOOM_FACTOR), 2);
}

function zoomIn() {
    manualZoomFactor.value = round(clamp(manualZoomFactor.value + MANUAL_ZOOM_STEP, MIN_MANUAL_ZOOM_FACTOR, MAX_MANUAL_ZOOM_FACTOR), 2);
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

watch(
    () => visibleDomains.value.length,
    () => {
        void nextTick().then(() => {
            bindResizeObserver();
            scheduleZoomLayoutSync();
        });
    },
    { immediate: true }
);

watch(
    () => collapsed.value.size,
    () => {
        scheduleZoomLayoutSync();
    }
);

onMounted(() => {
    bindResizeObserver();
    window.addEventListener('resize', scheduleZoomLayoutSync);
    scheduleZoomLayoutSync();
});

onBeforeUnmount(() => {
    resizeObserver?.disconnect();
    window.removeEventListener('resize', scheduleZoomLayoutSync);
    if (resizeFrame !== null) {
        window.cancelAnimationFrame(resizeFrame);
    }
});
</script>

<style scoped>
.hierarchy-view-container {
    height: 100%;
    min-height: 0;
    border-radius: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.hierarchy-view-actions {
    display: flex;
    justify-content: flex-end;
    flex-shrink: 0;
}

.hierarchy-zoom-controls {
    margin-inline-start: 4px;
}

.hierarchy-zoom-level {
    min-width: 48px;
    text-align: center;
    color: #475569;
    font-weight: 700;
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

.hierarchy-zoom-shell {
    position: relative;
    min-width: 100%;
    min-height: 100%;
}

.hierarchy-zoom-stage {
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    transform-origin: top center;
}

.hierarchy-zoom-canvas {
    display: inline-block;
    transform-origin: top center;
}

.hierarchy-diagram-wrapper {
    padding: 16px 0;
    overflow: visible;
}

.hierarchy-diagram {
    display: flex;
    justify-content: center;
    min-width: fit-content;
    padding: 0 16px;
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

.tree-children-vertical {
    flex-direction: column;
    align-items: center;
}

.tree-children-vertical > .tree-node-wrapper::after {
    display: none !important;
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
    box-sizing: border-box;
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

.node-edit-icon,
.node-add-icon {
    position: absolute;
    top: 3px;
    opacity: 0;
    cursor: pointer;
    color: rgba(255,255,255,0.7);
    transition: opacity 0.15s ease;
}

.node-edit-icon {
    right: 3px;
}

.node-add-icon {
    right: 20px;
}

.tree-node:hover .node-edit-icon,
.tree-node:hover .node-add-icon {
    opacity: 0.7;
}

.tree-node:hover .node-edit-icon:hover,
.tree-node:hover .node-add-icon:hover {
    opacity: 1;
}

.node-name {
    font-size: 0.8rem;
    font-weight: 600;
    word-break: keep-all;
    overflow-wrap: break-word;
    line-height: 1.25;
    max-width: 100%;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
}

.node-sub {
    font-size: 0.65rem;
    opacity: 0.8;
    margin-top: 2px;
}

.process-desc-tooltip {
    white-space: pre-line;
    line-height: 1.45;
}

.domain-node {
    background: #00695c !important;
    color: #ffffff !important;
    border: 2px solid var(--domain-color, #004d40);
    box-shadow: 0 0 0 2px rgba(0, 105, 92, 0.16), 0 3px 10px rgba(15, 23, 42, 0.22);
    z-index: 2;
}

.domain-node,
.mega-node,
.major-node {
    width: 160px;
    min-width: 160px;
    max-width: 160px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
}

.domain-node,
.mega-node {
    height: 72px;
}

.major-node {
    min-height: 84px;
    height: auto;
    gap: 2px;
}

.major-node .node-sub {
    margin-top: 0;
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
    min-width: 156px;
    max-width: 190px;
    box-shadow: 0 6px 18px rgba(15, 23, 42, 0.08);
}

.node-code {
    font-size: 0.68rem;
    font-weight: 700;
    line-height: 1.2;
    color: inherit;
    opacity: 0.82;
    word-break: keep-all;
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

.sub-node--review,
.sub-node--in-review {
    background: #fff7ed;
    border-color: #fdba74;
    color: #9a3412;
}

.sub-node--review::before,
.sub-node--in-review::before {
    background: #f59e0b;
}

.sub-node--public-review,
.sub-node--public-feedback {
    background: #eff6ff;
    border-color: #93c5fd;
    color: #1d4ed8;
}

.sub-node--public-review::before,
.sub-node--public-feedback::before {
    background: #2563eb;
}

.sub-node--final-edit {
    background: #faf5ff;
    border-color: #d8b4fe;
    color: #6b21a8;
}

.sub-node--final-edit::before {
    background: #9333ea;
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

.updated-dot {
    position: absolute;
    top: 12px;
    left: 12px;
    margin: 0;
    pointer-events: none;
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

.legend-pill--public-review,
.legend-pill--public-feedback {
    background: #eff6ff;
    border-color: #93c5fd;
}

.legend-pill--final-edit {
    background: #faf5ff;
    border-color: #d8b4fe;
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
