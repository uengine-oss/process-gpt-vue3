<template>
    <div class="mermaid-view-container">
        <!-- Controls -->
        <div class="d-flex align-center justify-space-between mb-3 flex-wrap ga-2">
            <div class="d-flex align-center ga-2">
                <span class="text-body-2 text-grey-darken-1">{{ $t('processArchitecture.mermaid.zoomLevel') }}: {{ Math.round(zoomLevel * 100) }}%</span>
            </div>
            <div class="d-flex align-center ga-1">
                <v-btn variant="text" size="small" icon @click="zoomIn">
                    <v-icon size="18">mdi-magnify-plus-outline</v-icon>
                </v-btn>
                <v-btn variant="text" size="small" icon @click="zoomOut">
                    <v-icon size="18">mdi-magnify-minus-outline</v-icon>
                </v-btn>
                <v-btn variant="text" size="small" icon @click="resetZoom">
                    <v-icon size="18">mdi-fit-to-screen-outline</v-icon>
                </v-btn>
                <v-divider vertical class="mx-1" style="height: 20px;" />
                <v-btn variant="text" size="small" prepend-icon="mdi-unfold-more-horizontal" @click="expandAll">
                    {{ $t('processArchitecture.hierarchy.expandAll') }}
                </v-btn>
                <v-btn variant="text" size="small" prepend-icon="mdi-unfold-less-horizontal" @click="collapseAll">
                    {{ $t('processArchitecture.hierarchy.collapseAll') }}
                </v-btn>
            </div>
        </div>

        <!-- No data -->
        <div v-if="!procMap?.mega_proc_list || procMap.mega_proc_list.length === 0" class="text-center text-grey pa-10">
            {{ $t('processArchitecture.noData') }}
        </div>

        <!-- Mermaid diagram area -->
        <div
            v-else
            class="mermaid-wrapper"
            ref="wrapperRef"
            @mousedown="onPanStart"
            @wheel.prevent="onWheel"
        >
            <div
                class="mermaid-canvas"
                :style="{
                    transform: `translate(${panX}px, ${panY}px) scale(${zoomLevel})`,
                    transformOrigin: '0 0'
                }"
            >
                <!-- Render each domain as a separate Mermaid diagram -->
                <div
                    v-for="domain in visibleDomains"
                    :key="domain.id"
                    class="domain-diagram-block mb-6"
                >
                    <div class="domain-label mb-2" :style="{ color: domain.color || '#555' }">
                        <v-icon size="16" :color="domain.color || 'grey'" class="mr-1">mdi-domain</v-icon>
                        <strong>{{ domain.name }}</strong>
                    </div>
                    <div
                        :ref="el => setDiagramRef(el, domain.id)"
                        class="mermaid-diagram"
                    ></div>
                </div>
            </div>
        </div>

        <!-- Legend -->
        <div class="mermaid-legend d-flex align-center ga-4 mt-4 pa-3 flex-wrap">
            <div class="d-flex align-center ga-2">
                <div class="legend-box" style="background: #E65100;"></div>
                <span class="text-caption">Mega Process</span>
            </div>
            <div class="d-flex align-center ga-2">
                <div class="legend-box" style="background: #2E7D32;"></div>
                <span class="text-caption">Major Process</span>
            </div>
            <div class="d-flex align-center ga-2">
                <div class="legend-box" style="background: #E3F2FD; border: 1px solid #1976D2;"></div>
                <span class="text-caption">Sub Process (click to open)</span>
            </div>
            <v-divider vertical class="mx-2" style="height: 16px;" />
            <span class="text-caption text-grey">{{ $t('processArchitecture.mermaid.panHint') }}</span>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import mermaid from 'mermaid';

const props = defineProps<{
    procMap: any;
    domains: any[];
    processStatuses: Map<string, any>;
    selectedDomain: string | null;
}>();

const emit = defineEmits<{
    (e: 'navigate', id: string, name?: string): void;
}>();

// Zoom + Pan state
const zoomLevel = ref(1);
const panX = ref(0);
const panY = ref(0);
const wrapperRef = ref<HTMLElement | null>(null);
let isPanning = false;
let panStartX = 0;
let panStartY = 0;

// Track collapsed state per domain
const collapsedMegas = ref(new Set<string>());
const collapsedMajors = ref(new Set<string>());

// Diagram refs keyed by domain id
const diagramRefs = ref<Record<string, HTMLElement | null>>({});

function setDiagramRef(el: any, domainId: string) {
    if (el) {
        diagramRefs.value[domainId] = el as HTMLElement;
    }
}

// Mermaid init
mermaid.initialize({
    startOnLoad: false,
    theme: 'base',
    themeVariables: {
        primaryColor: '#E3F2FD',
        primaryTextColor: '#1A237E',
        primaryBorderColor: '#1976D2',
        lineColor: '#78909C',
        secondaryColor: '#FFF3E0',
        tertiaryColor: '#E8F5E9',
    },
    flowchart: {
        curve: 'basis',
        nodeSpacing: 50,
        rankSpacing: 60,
        useMaxWidth: true,
    },
    securityLevel: 'loose', // Allow click callbacks
});

const visibleDomains = computed(() => {
    if (!props.selectedDomain) return props.domains;
    return props.domains.filter((d: any) => d.name === props.selectedDomain);
});

function getMegasForDomain(domain: any): any[] {
    if (!domain || !props.procMap?.mega_proc_list) return [];
    const domainId = domain.id;
    const domainName = domain.name;
    return props.procMap.mega_proc_list.filter((mega: any) =>
        (mega.major_proc_list || []).some((major: any) => {
            const d = major.domain || major.domain_id;
            return d === domainName || d === domainId;
        })
    );
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

function sanitizeId(str: string): string {
    return str.replace(/[^a-zA-Z0-9_]/g, '_');
}

// Lookup table for sub-process click navigation (sanitized key → original id/name)
const subLookup: Record<string, { id: string; name: string }> = {};

function sanitizeLabel(str: string): string {
    // Escape characters that conflict with Mermaid syntax
    return str
        .replace(/"/g, "'")
        .replace(/\(/g, "（")
        .replace(/\)/g, "）")
        .replace(/\[/g, "［")
        .replace(/\]/g, "］")
        .replace(/\{/g, "｛")
        .replace(/\}/g, "｝")
        .replace(/[<>]/g, " ");
}

function buildMermaidDef(domain: any): string {
    const megas = getMegasForDomain(domain);
    if (megas.length === 0) return '';

    const lines: string[] = ['flowchart TD'];

    // Add classDefs for styling
    lines.push('    classDef megaStyle fill:#E65100,color:#fff,stroke:#BF360C,rx:6,ry:6');
    lines.push('    classDef majorStyle fill:#2E7D32,color:#fff,stroke:#1B5E20,rx:4,ry:4');
    lines.push('    classDef subStyle fill:#E3F2FD,color:#1A237E,stroke:#1976D2,rx:4,ry:4');

    for (const mega of megas) {
        const megaKey = `MEGA_${sanitizeId(mega.id)}`;
        const megaLabel = sanitizeLabel(mega.name);
        lines.push(`    ${megaKey}["${megaLabel}"]`);
        lines.push(`    class ${megaKey} megaStyle`);

        const majors = getMajorsInDomain(mega, domain);
        for (const major of majors) {
            const majorKey = `MAJOR_${sanitizeId(major.id)}`;
            const majorLabel = sanitizeLabel(major.name);
            lines.push(`    ${majorKey}["${majorLabel}"]`);
            lines.push(`    class ${majorKey} majorStyle`);
            lines.push(`    ${megaKey} --> ${majorKey}`);

            const subs = major.sub_proc_list || [];
            for (const sub of subs) {
                const subKey = `SUB_${sanitizeId(sub.id)}`;
                const subLabel = sanitizeLabel(sub.name);
                lines.push(`    ${subKey}["${subLabel}"]`);
                lines.push(`    class ${subKey} subStyle`);
                lines.push(`    ${majorKey} --> ${subKey}`);
                // Register click handler - store original id/name in lookup, use sanitized key
                subLookup[subKey] = { id: sub.id, name: sub.name };
                lines.push(`    click ${subKey} call mermaidNavigate("${subKey}")`);
            }
        }
    }

    return lines.join('\n');
}

// Global callback for mermaid click events
function registerGlobalNavigate() {
    (window as any).mermaidNavigate = (key: string) => {
        const entry = subLookup[key];
        if (entry) {
            emit('navigate', entry.id, entry.name);
        }
    };
}

async function renderDiagrams() {
    await nextTick();
    for (const domain of visibleDomains.value) {
        const el = diagramRefs.value[domain.id];
        if (!el) continue;
        const def = buildMermaidDef(domain);
        if (!def) {
            el.innerHTML = `<div class="text-caption text-grey pa-4">No processes in this domain.</div>`;
            continue;
        }
        try {
            el.removeAttribute('data-processed');
            const uniqueId = `mermaid-${sanitizeId(domain.id)}-${Date.now()}`;
            const { svg } = await mermaid.render(uniqueId, def);
            el.innerHTML = svg;
            // Make SVG responsive
            const svgEl = el.querySelector('svg');
            if (svgEl) {
                svgEl.style.maxWidth = 'none';
                svgEl.style.width = '100%';
            }
        } catch (err) {
            console.error(`Mermaid render error for domain ${domain.name}:`, err);
            el.innerHTML = `<div class="text-caption text-error pa-4">Diagram render failed.</div>`;
        }
    }
}

// Zoom controls
function zoomIn() {
    zoomLevel.value = Math.min(3, zoomLevel.value + 0.15);
}

function zoomOut() {
    zoomLevel.value = Math.max(0.2, zoomLevel.value - 0.15);
}

function resetZoom() {
    zoomLevel.value = 1;
    panX.value = 0;
    panY.value = 0;
}

function onWheel(e: WheelEvent) {
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    zoomLevel.value = Math.min(3, Math.max(0.2, zoomLevel.value + delta));
}

// Pan controls
function onPanStart(e: MouseEvent) {
    if (e.button !== 0) return;
    isPanning = true;
    panStartX = e.clientX - panX.value;
    panStartY = e.clientY - panY.value;

    const onMove = (me: MouseEvent) => {
        if (!isPanning) return;
        panX.value = me.clientX - panStartX;
        panY.value = me.clientY - panStartY;
    };
    const onUp = () => {
        isPanning = false;
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
}

// Collapse/expand controls (re-render diagrams with filtered data)
function expandAll() {
    collapsedMegas.value = new Set();
    collapsedMajors.value = new Set();
    renderDiagrams();
}

function collapseAll() {
    // For mermaid view, collapse means showing only mega level
    // We re-render with limited depth — simulated by showing top 2 levels
    renderDiagrams();
}

// Watch for data/domain changes and re-render
watch(
    () => [props.procMap, props.selectedDomain, props.domains],
    () => renderDiagrams(),
    { deep: false }
);

onMounted(() => {
    registerGlobalNavigate();
    renderDiagrams();
});

onBeforeUnmount(() => {
    delete (window as any).mermaidNavigate;
});
</script>

<style scoped>
.mermaid-view-container {
    width: 100%;
}

.mermaid-wrapper {
    width: 100%;
    min-height: 500px;
    max-height: 70vh;
    overflow: hidden;
    background: #fafafa;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    cursor: grab;
    user-select: none;
    position: relative;
}

.mermaid-wrapper:active {
    cursor: grabbing;
}

.mermaid-canvas {
    display: inline-block;
    min-width: 100%;
    padding: 24px;
    will-change: transform;
}

.domain-diagram-block {
    background: white;
    border-radius: 8px;
    padding: 16px;
    border: 1px solid #eeeeee;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}

.domain-label {
    display: flex;
    align-items: center;
    font-size: 0.9rem;
}

.mermaid-diagram {
    overflow: hidden;
}

.mermaid-diagram :deep(svg) {
    max-width: none !important;
}

.mermaid-legend {
    background: #f5f5f5;
    border-radius: 8px;
}

.legend-box {
    width: 16px;
    height: 16px;
    border-radius: 4px;
}
</style>
