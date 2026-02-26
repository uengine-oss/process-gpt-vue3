<template>
    <div class="ontology-viewer">
        <div v-if="!hasElements && !hasDefinition" class="ontology-empty">
            온톨로지 그래프를 표시할 프로세스 정의(definition)가 없습니다.
        </div>
        <div v-else ref="cyContainer" class="ontology-cy"></div>
        <div v-if="selected" class="ontology-detail">
            <div class="detail-title">{{ selected.label || selected.id }}</div>
            <div class="detail-sub">{{ selected.type }}</div>
            <div v-if="selected.instruction" class="detail-block">
                <div class="detail-label">instruction</div>
                <pre class="detail-pre">{{ selected.instruction }}</pre>
            </div>
            <div v-if="selected.description" class="detail-block">
                <div class="detail-label">description</div>
                <div class="detail-text">{{ selected.description }}</div>
            </div>
            <div v-if="selected.condition" class="detail-block">
                <div class="detail-label">condition</div>
                <div class="detail-text">{{ selected.condition }}</div>
            </div>
        </div>
    </div>
</template>

<script>
import cytoscape from 'cytoscape';

export default {
    name: 'OntologyGraphViewer',
    props: {
        elements: {
            type: Array,
            default: null
        },
        definition: {
            type: Object,
            default: null
        }
    },
    data() {
        return {
            cy: null,
            selected: null
        };
    },
    computed: {
        hasElements() {
            return Array.isArray(this.elements) && this.elements.length > 0;
        },
        hasDefinition() {
            return !!this.definition && typeof this.definition === 'object';
        }
    },
    watch: {
        elements() {
            this.renderGraph();
        },
        definition: {
            handler() {
                this.renderGraph();
            },
            deep: true
        }
    },
    mounted() {
        this.renderGraph();
        window.addEventListener('resize', this.onResize, { passive: true });
    },
    beforeUnmount() {
        window.removeEventListener('resize', this.onResize);
        this.destroyGraph();
    },
    methods: {
        fitAndClampZoom(padding = 40, maxZoom = 1.0) {
            try {
                if (!this.cy) return;
                this.cy.fit(undefined, padding);
                const z = this.cy.zoom();
                if (typeof z === 'number' && z > maxZoom) {
                    this.cy.zoom(maxZoom);
                    this.cy.center();
                }
            } catch (e) {
                // ignore
            }
        },
        onResize() {
            try {
                if (this.cy) {
                    this.cy.resize();
                }
            } catch (e) {
                // ignore
            }
        },
        destroyGraph() {
            if (this.cy) {
                try {
                    this.cy.destroy();
                } catch (e) {
                    // ignore
                }
            }
            this.cy = null;
            this.selected = null;
        },
        buildElements() {
            if (this.hasElements) {
                // Normalize labels so they look closer to Neo4j Browser:
                // - edges show relationship type (and condition for NEXT when present)
                return (this.elements || []).map((el) => {
                    const d = el?.data || {};
                    const isEdge = !!d.source && !!d.target;
                    if (!isEdge) return el;
                    const type = String(d.type || '').trim();
                    const cond = String(d.condition || '').trim();
                    let label = '';
                    if (type === 'NEXT') {
                        label = cond || 'NEXT';
                    } else {
                        label = type || String(d.label || '');
                    }
                    return { ...el, data: { ...d, label } };
                });
            }
            const def = this.definition || {};
            const roles = Array.isArray(def.roles) ? def.roles : [];
            const activities = Array.isArray(def.activities) ? def.activities : [];
            const gateways = Array.isArray(def.gateways) ? def.gateways : [];
            const events = Array.isArray(def.events) ? def.events : [];
            const sequences = Array.isArray(def.sequences) ? def.sequences : [];

            const elements = [];

            const roleNodeIdByName = {};
            for (const r of roles) {
                if (!r) continue;
                const name = String(r.name || '').trim();
                if (!name) continue;
                const endpoint = String(r.endpoint || '').trim();
                const id = endpoint ? `role:${endpoint}` : `role:${name}`;
                roleNodeIdByName[name] = id;
                elements.push({
                    data: {
                        id,
                        type: 'role',
                        label: name
                    }
                });
            }

            const addNode = (type, raw) => {
                const id0 = String(raw?.id || '').trim();
                if (!id0) return;
                elements.push({
                    data: {
                        id: id0,
                        type,
                        label: String(raw?.name || id0),
                        description: String(raw?.description || ''),
                        instruction: String(raw?.instruction || '')
                    }
                });
            };

            for (const a of activities) addNode('activity', a);
            for (const g of gateways) addNode('gateway', g);
            for (const e of events) addNode('event', e);

            // role -> activity edges
            for (const a of activities) {
                const roleName = String(a?.role || '').trim();
                const roleNodeId = roleNodeIdByName[roleName];
                const actId = String(a?.id || '').trim();
                if (!roleNodeId || !actId) continue;
                elements.push({
                    data: {
                        id: `performed_by:${roleNodeId}->${actId}`,
                        source: roleNodeId,
                        target: actId,
                        type: 'performed_by',
                        label: 'PERFORMS'
                    }
                });
            }

            // sequence edges (process flow)
            for (const s of sequences) {
                const source = String(s?.source || '').trim();
                const target = String(s?.target || '').trim();
                if (!source || !target) continue;
                const condition = String(s?.condition || '').trim();
                elements.push({
                    data: {
                        id: String(s?.id || `seq:${source}->${target}`),
                        source,
                        target,
                        type: 'sequence',
                        label: condition || ''
                    }
                });
            }

            return elements;
        },
        getStyle() {
            // Neo4j Browser-like default: circular nodes + relationship type labels
            return [
                {
                    selector: 'node',
                    style: {
                        label: 'data(label)',
                        'text-wrap': 'wrap',
                        'text-max-width': 90,
                        color: '#e2e8f0',
                        'text-outline-width': 1,
                        'text-outline-color': '#0b1220',
                        'font-size': 9,
                        'text-valign': 'center',
                        'text-halign': 'center',
                        'background-color': '#64748b',
                        shape: 'ellipse',
                        width: 28,
                        height: 28,
                        'border-width': 2,
                        'border-color': '#0f172a'
                    }
                },
                {
                    selector: 'node[type="Task"], node[type="activity"]',
                    style: { 'background-color': '#22c55e' }
                },
                {
                    selector: 'node[type="Role"], node[type="role"]',
                    style: { 'background-color': '#f59e0b' }
                },
                {
                    selector: 'node[type="Gateway"], node[type="gateway"]',
                    style: { 'background-color': '#60a5fa' }
                },
                {
                    selector: 'node[type="Event"], node[type="event"]',
                    style: { 'background-color': '#ef4444' }
                },
                {
                    selector: 'node[type="Process"]',
                    style: { 'background-color': '#a78bfa' }
                },
                {
                    selector: 'node[type="Skill"]',
                    style: { 'background-color': '#14b8a6' }
                },
                {
                    selector: 'edge',
                    style: {
                        width: 2,
                        'curve-style': 'bezier',
                        'target-arrow-shape': 'triangle',
                        'target-arrow-color': '#94a3b8',
                        'line-color': '#94a3b8',
                        label: 'data(label)',
                        'font-size': 8,
                        color: '#e2e8f0',
                        'text-background-opacity': 0.65,
                        'text-background-color': '#0f172a',
                        'text-background-padding': 2,
                        'text-rotation': 'autorotate'
                    }
                },
                {
                    // When zoomed out, hide labels to avoid unreadable overlaps
                    selector: '.labels-off',
                    style: {
                        label: '',
                        'text-opacity': 0
                    }
                },
                {
                    selector: 'edge[type="performed_by"]',
                    style: {
                        'line-style': 'dashed',
                        'line-color': '#f59e0b',
                        'target-arrow-color': '#f59e0b'
                    }
                },
                {
                    selector: 'edge[type="HAS_TASK"], edge[type="HAS_GATEWAY"], edge[type="HAS_EVENT"]',
                    style: {
                        'line-style': 'dotted',
                        'line-color': '#64748b',
                        'target-arrow-color': '#64748b'
                    }
                },
                {
                    selector: 'node:selected',
                    style: {
                        'border-width': 3,
                        'border-color': '#2563eb'
                    }
                }
            ];
        },
        renderGraph() {
            if (!this.hasElements && !this.hasDefinition) {
                this.destroyGraph();
                return;
            }
            const container = this.$refs.cyContainer;
            if (!container) return;

            const elements = this.buildElements();
            if (!Array.isArray(elements) || elements.length === 0) {
                this.destroyGraph();
                return;
            }
            const style = this.getStyle();

            const getLayoutPlan = () => {
                const nodes = (elements || []).filter((el) => {
                    const d = el?.data || {};
                    return !!d.id && !(d.source && d.target);
                });
                const edges = (elements || []).filter((el) => {
                    const d = el?.data || {};
                    return !!d.source && !!d.target;
                });

                const isFlowEdge = (d) => {
                    const t = String(d?.type || '').toLowerCase();
                    return t === 'next' || t === 'sequence';
                };
                const flowEdges = edges.filter((el) => isFlowEdge(el?.data || {}));

                // If it looks like a process flow, prefer a directed hierarchical layout (more "일반적"으로 읽힘)
                const hasFlow = flowEdges.length >= 1;
                if (hasFlow) {
                    // Prefer rooting from Process node when present, else use indegree=0 roots on flow edges
                    const processNode = nodes.find((n) => String(n?.data?.type || '') === 'Process');
                    let rootIds = [];
                    if (processNode?.data?.id) {
                        rootIds = [String(processNode.data.id)];
                    } else {
                        const indeg = new Map();
                        for (const n of nodes) indeg.set(String(n?.data?.id || ''), 0);
                        for (const e of flowEdges) {
                            const tgt = String(e?.data?.target || '');
                            if (!tgt) continue;
                            indeg.set(tgt, (indeg.get(tgt) || 0) + 1);
                        }
                        rootIds = Array.from(indeg.entries())
                            .filter(([id, v]) => id && v === 0)
                            .slice(0, 5)
                            .map(([id]) => id);
                    }

                    return {
                        layoutOptions: {
                            name: 'breadthfirst',
                            directed: true,
                            circle: false,
                            fit: true,
                            padding: 40,
                            spacingFactor: 1.6,
                            avoidOverlap: true,
                            avoidOverlapPadding: 18
                        },
                        rootIds
                    };
                }

                // Otherwise, use a balanced force layout (avoid "스크롤 지옥" + 겹침 완화)
                return {
                    layoutOptions: {
                        name: 'cose',
                        animate: false,
                        fit: true,
                        padding: 50,
                        nodeRepulsion: 42000,
                        idealEdgeLength: 200,
                        edgeElasticity: 0.25,
                        gravity: 0.18,
                        componentSpacing: 140,
                        nodeOverlap: 10,
                        randomize: true,
                        numIter: 1400,
                        nodeDimensionsIncludeLabels: true,
                        avoidOverlap: true
                    },
                    rootIds: []
                };
            };

            if (!this.cy) {
                this.cy = cytoscape({
                    container,
                    elements,
                    style,
                    wheelSensitivity: 3,
                    // Layout runs right after init below
                });

                // Tune zoom behavior and label visibility similar to Neo4j Browser
                try {
                    this.cy.minZoom(0.15);
                    this.cy.maxZoom(3.5);
                } catch (e) {
                    // ignore
                }

                const updateLabelVisibility = () => {
                    if (!this.cy) return;
                    const z = this.cy.zoom();
                    const show = z >= 0.7;
                    // Toggle a class to hide labels when zoomed out
                    this.cy.nodes().toggleClass('labels-off', !show);
                    // Keep relationship type visible a bit earlier than node labels
                    this.cy.edges().toggleClass('labels-off', z < 0.6);
                };

                this.cy.on('zoom', () => updateLabelVisibility());
                updateLabelVisibility();

                // Run layout (flow -> hierarchical, otherwise balanced force)
                const { layoutOptions, rootIds } = getLayoutPlan();
                let roots = undefined;
                try {
                    if (Array.isArray(rootIds) && rootIds.length) {
                        roots = this.cy.nodes().filter((n) => rootIds.includes(n.id()));
                    }
                } catch (e) {
                    // ignore
                }
                this.cy.layout({ ...layoutOptions, roots }).run();

                // Initial fit, but avoid over-zooming on small graphs
                this.fitAndClampZoom(40, 1.0);

                this.cy.on('tap', (evt) => {
                    const isBackground = evt?.target === this.cy;
                    if (isBackground) {
                        this.selected = null;
                    }
                });

                this.cy.on('tap', 'node', (evt) => {
                    const data = evt?.target?.data?.();
                    if (!data) return;
                    this.selected = {
                        id: data.id,
                        type: data.type,
                        label: data.label,
                        description: data.description,
                        instruction: data.instruction
                    };
                });

                this.cy.on('tap', 'edge', (evt) => {
                    const data = evt?.target?.data?.();
                    if (!data) return;
                    this.selected = {
                        id: data.id,
                        type: data.type,
                        label: data.label,
                        condition: data.label
                    };
                });
            } else {
                this.cy.json({ elements, style });
                const { layoutOptions, rootIds } = getLayoutPlan();
                let roots = undefined;
                try {
                    if (Array.isArray(rootIds) && rootIds.length) {
                        roots = this.cy.nodes().filter((n) => rootIds.includes(n.id()));
                    }
                } catch (e) {
                    // ignore
                }
                this.cy.layout({ ...layoutOptions, roots }).run();
                this.fitAndClampZoom(40, 1.0);
                // Re-apply label rule after refresh
                try {
                    const z = this.cy.zoom();
                    this.cy.nodes().toggleClass('labels-off', z < 0.7);
                    this.cy.edges().toggleClass('labels-off', z < 0.6);
                } catch (e) {
                    // ignore
                }
            }

            this.$nextTick(() => {
                this.onResize();
            });
        }
    }
};
</script>

<style scoped>
.ontology-viewer {
    position: relative;
    height: 100%;
    background: #0b1220;
}

.ontology-empty {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #cbd5e1;
    font-size: 13px;
    padding: 16px;
    text-align: center;
}

.ontology-cy {
    height: 100%;
    width: 100%;
}

.ontology-detail {
    position: absolute;
    right: 10px;
    bottom: 10px;
    width: 320px;
    max-height: 55%;
    overflow: auto;
    background: rgba(15, 23, 42, 0.92);
    border: 1px solid rgba(148, 163, 184, 0.35);
    border-radius: 10px;
    padding: 10px 12px;
    color: #e2e8f0;
}

.detail-title {
    font-weight: 700;
    font-size: 13px;
    margin-bottom: 2px;
}

.detail-sub {
    font-size: 11px;
    color: #94a3b8;
    margin-bottom: 10px;
}

.detail-block {
    margin-top: 8px;
}

.detail-label {
    font-size: 11px;
    color: #a5b4fc;
    margin-bottom: 4px;
}

.detail-pre {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    font-family: 'Fira Code', 'Consolas', monospace;
    font-size: 11px;
    line-height: 1.5;
}

.detail-text {
    font-size: 12px;
    line-height: 1.4;
    color: #e2e8f0;
    word-break: break-word;
}
</style>

