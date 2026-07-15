<script setup lang="ts">
// 기업 운영 온톨로지 탐색기 — 애널리틱스 영역에 융합된 뷰.
// 전략(Strategy/KPI/Initiative) → 프로세스(Process/Task) → 리소스(User/Agent/Team) → 지식(Skill)
// 4레이어를 계층적(top-down) 스윔레인 그래프로 시각화하고, 각 요소를 원래 편집 화면으로 딥링크한다.
// KPI/전략 등록·설문 등은 기존 StrategyBoard 기능을 그대로 사용(중복 제거).
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import cytoscape from 'cytoscape';
import { useStrategyStore } from '@/stores/strategy/strategyStore';

const store = useStrategyStore();
const router = useRouter();
const route = useRoute();

// ---------------------------------------------------------------- 상태
const loading = ref(false);
const syncing = ref(false);
const activeTab = ref<'graph' | 'impact' | 'improve'>('graph');

const graph = ref<{ nodes: any[]; edges: any[]; last_synced_at?: string }>({ nodes: [], edges: [] });
const cyContainer = ref<HTMLElement | null>(null);
let cy: any = null;

// 레이어 필터 (전략/프로세스/리소스/지식)
const layerState = ref<Record<string, boolean>>({ strategy: true, process: true, resource: true, skill: true });
const LAYER_CHIPS = [
    { key: 'strategy', label: '전략' },
    { key: 'process', label: '프로세스' },
    { key: 'resource', label: '리소스' },
    { key: 'skill', label: '지식·스킬' }
];

// 우측 상세 패널
const selectedNode = ref<any | null>(null);
const neighbors = ref<{ nodes: any[]; edges: any[] }>({ nodes: [], edges: [] });
const neighborsLoading = ref(false);

// 영향도 분석 탭
const selectedKpiId = ref<string | null>(null);
const impactData = ref<any | null>(null);
const impactLoading = ref(false);

// 전략 개선점 탭
const selectedStrategyId = ref<string | null>(null);
const improveData = ref<any | null>(null);
const improveLoading = ref(false);

// ---------------------------------------------------------------- 라벨 메타(색/모양/그룹)
const LABEL_META: Record<string, { color: string; shape: string; group: string; glyph: string }> = {
    Strategy: { color: '#5b4ff5', shape: 'round-rectangle', group: 'grp_strategy', glyph: '◎' },
    KPI: { color: '#0ea5a4', shape: 'ellipse', group: 'grp_kpi', glyph: '％' },
    Initiative: { color: '#f59e0b', shape: 'diamond', group: 'grp_kpi', glyph: '▲' },
    Process: { color: '#2563eb', shape: 'round-rectangle', group: 'grp_process', glyph: '⛭' },
    Task: { color: '#60a5fa', shape: 'round-rectangle', group: 'grp_task', glyph: '☑' },
    User: { color: '#16a34a', shape: 'ellipse', group: 'grp_resource', glyph: '👤' },
    Agent: { color: '#ea580c', shape: 'hexagon', group: 'grp_resource', glyph: '🤖' },
    Team: { color: '#78716c', shape: 'round-rectangle', group: 'grp_resource', glyph: '👥' },
    Skill: { color: '#db2777', shape: 'round-tag', group: 'grp_skill', glyph: '✦' }
};
const GROUP_META: Record<string, { label: string; color: string }> = {
    grp_strategy: { label: '전략', color: '#5b4ff5' },
    grp_kpi: { label: 'KPI · 이니셔티브', color: '#0ea5a4' },
    grp_process: { label: '프로세스', color: '#2563eb' },
    grp_task: { label: '태스크', color: '#60a5fa' },
    grp_resource: { label: '리소스 (조직)', color: '#78716c' },
    grp_skill: { label: '지식 · 스킬', color: '#db2777' }
};
const REL_LABEL: Record<string, string> = {
    HAS_SUB_STRATEGY: '하위전략',
    HAS_KPI: 'KPI',
    HAS_INITIATIVE: '이니셔티브',
    IMPACTS_KPI: '영향',
    EXECUTED_BY: '실행',
    CONTAINS_TASK: '태스크',
    PERFORMS: '수행',
    USES_SKILL: '스킬사용',
    INHERITS: '상속',
    REFERENCES: '참조',
    HAS_SUB_TEAM: '하위팀',
    MEMBER_OF: '소속'
};

// ---------------------------------------------------------------- 달성률/미달 계산
function kpiAchievement(p: any): number | null {
    if (!p) return null;
    const cur = p.current_value;
    const tgt = p.target_value;
    const base = p.baseline_value ?? 0;
    if (cur == null || tgt == null) return null;
    if (p.direction === 'decrease') {
        if (base === tgt) return cur <= tgt ? 100 : 0;
        return ((base - cur) / (base - tgt)) * 100;
    }
    return tgt ? (cur / tgt) * 100 : null;
}
function isLaggingKpi(node: any): boolean {
    if (node.label !== 'KPI') return false;
    const a = kpiAchievement(node.properties);
    return a != null && a < 100;
}

// ---------------------------------------------------------------- 계층 레이아웃
const ROW_H = 150; // 밴드(행) 간 수직 간격
const MIN_GAP = 180; // 같은 행 노드 최소 수평 간격

// 노드별 행(rank) 계산: 상위 전략이 맨 위(row 0), 하위 요소들이 아래로 레이어링된다.
function computeRows(nodes: any[], edges: any[]) {
    const subEdges = edges.filter((e) => e.rel_type === 'HAS_SUB_STRATEGY');
    const parentsOf: Record<string, string[]> = {};
    subEdges.forEach((e) => {
        (parentsOf[e.target] ||= []).push(e.source);
    });
    const depthCache: Record<string, number> = {};
    function stratDepth(id: string, seen = new Set<string>()): number {
        if (depthCache[id] != null) return depthCache[id];
        if (seen.has(id)) return 0;
        seen.add(id);
        const ps = parentsOf[id];
        if (!ps || !ps.length) return (depthCache[id] = 0);
        const d = 1 + Math.max(...ps.map((p) => stratDepth(p, seen)));
        return (depthCache[id] = d);
    }
    nodes.filter((n) => n.label === 'Strategy').forEach((n) => stratDepth(n.id));
    const base = Math.max(0, ...Object.values(depthCache), 0);

    const rowOf: Record<string, number> = {};
    for (const n of nodes) {
        switch (n.label) {
            case 'Strategy':
                rowOf[n.id] = depthCache[n.id] ?? 0;
                break;
            case 'KPI':
            case 'Initiative':
                rowOf[n.id] = base + 1;
                break;
            case 'Process':
                rowOf[n.id] = base + 2;
                break;
            case 'Task':
                rowOf[n.id] = base + 3;
                break;
            case 'Team':
                rowOf[n.id] = base + 4;
                break;
            case 'User':
            case 'Agent':
                rowOf[n.id] = base + 5;
                break;
            case 'Skill':
                rowOf[n.id] = base + 6;
                break;
            default:
                rowOf[n.id] = base + 6;
        }
    }
    return rowOf;
}

// 바리센터(상위 연결 노드 평균 x)로 x 좌표를 정해 자식이 부모 바로 아래로 떨어지게 한다.
function computePositions(nodes: any[], edges: any[]) {
    const rowOf = computeRows(nodes, edges);
    const neigh: Record<string, Set<string>> = {};
    nodes.forEach((n) => (neigh[n.id] = new Set()));
    edges.forEach((e) => {
        if (neigh[e.source] && neigh[e.target]) {
            neigh[e.source].add(e.target);
            neigh[e.target].add(e.source);
        }
    });
    const byRow: Record<number, string[]> = {};
    nodes.forEach((n) => {
        (byRow[rowOf[n.id]] ||= []).push(n.id);
    });
    const placedX: Record<string, number> = {};
    const rowKeys = Object.keys(byRow)
        .map(Number)
        .sort((a, b) => a - b);
    for (const r of rowKeys) {
        const list = byRow[r];
        const items = list.map((id) => {
            const ups = [...neigh[id]].filter((n) => placedX[n] !== undefined && rowOf[n] < r);
            const d = ups.length ? ups.reduce((s, n) => s + placedX[n], 0) / ups.length : null;
            return { id, d: d as number | null };
        });
        const known = items.filter((i) => i.d !== null).map((i) => i.d as number);
        const meanKnown = known.length ? known.reduce((s, v) => s + v, 0) / known.length : 0;
        let nullCounter = 0;
        items.forEach((i) => {
            if (i.d === null) i.d = meanKnown + nullCounter++ * MIN_GAP;
        });
        items.sort((a, b) => (a.d as number) - (b.d as number));
        // 충돌 해소: 최소 간격 유지
        for (let k = 1; k < items.length; k++) {
            if ((items[k].d as number) < (items[k - 1].d as number) + MIN_GAP) {
                items[k].d = (items[k - 1].d as number) + MIN_GAP;
            }
        }
        items.forEach((i) => (placedX[i.id] = i.d as number));
    }
    // 전체를 양수 영역으로 이동
    const minX = Math.min(0, ...Object.values(placedX));
    const pos: Record<string, { x: number; y: number }> = {};
    nodes.forEach((n) => {
        pos[n.id] = { x: (placedX[n.id] ?? 0) - minX + 120, y: rowOf[n.id] * ROW_H + 80 };
    });
    return pos;
}

// ---------------------------------------------------------------- cytoscape 빌드
function visibleNodes() {
    return graph.value.nodes.filter((n) => layerState.value[n.layer]);
}
function buildCy() {
    if (!cyContainer.value) return;
    const nodes = visibleNodes();
    const visibleIds = new Set(nodes.map((n) => n.id));
    const edges = graph.value.edges.filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target));
    const pos = computePositions(nodes, edges);

    // 스윔레인(그룹) 컴파운드 부모 노드
    const usedGroups = new Set(nodes.map((n) => LABEL_META[n.label]?.group).filter(Boolean));
    const groupEls = [...usedGroups].map((gid) => ({
        data: { id: gid, isGroup: true, groupLabel: GROUP_META[gid as string]?.label || gid, groupColor: GROUP_META[gid as string]?.color }
    }));

    const nodeEls = nodes.map((n) => {
        const meta = LABEL_META[n.label] || { color: '#888', shape: 'ellipse', group: 'grp_skill' };
        return {
            data: {
                id: n.id,
                raw: n,
                label: n.label,
                name: n.name,
                nodeColor: meta.color,
                nodeShape: meta.shape,
                lagging: isLaggingKpi(n) ? 1 : 0,
                parent: meta.group
            },
            position: pos[n.id]
        };
    });
    const edgeEls = edges.map((e, i) => ({
        data: {
            id: `e${i}`,
            source: e.source,
            target: e.target,
            relLabel: REL_LABEL[e.rel_type] || e.rel_type,
            relType: e.rel_type
        }
    }));

    if (cy) {
        cy.destroy();
        cy = null;
    }
    cy = cytoscape({
        container: cyContainer.value,
        elements: [...groupEls, ...nodeEls, ...edgeEls],
        layout: { name: 'preset' },
        wheelSensitivity: 0.2,
        style: [
            {
                selector: 'node[?isGroup]',
                style: {
                    'background-color': 'data(groupColor)',
                    'background-opacity': 0.05,
                    'border-width': 1,
                    'border-style': 'dashed',
                    'border-color': 'data(groupColor)',
                    'border-opacity': 0.5,
                    shape: 'round-rectangle',
                    label: 'data(groupLabel)',
                    'text-valign': 'top',
                    'text-halign': 'left',
                    'font-size': 14,
                    'font-weight': 'bold',
                    color: 'data(groupColor)',
                    'text-margin-x': 10,
                    'text-margin-y': 8,
                    padding: 18 as any,
                    'z-index': 0
                }
            },
            {
                selector: 'node[!isGroup]',
                style: {
                    'background-color': 'data(nodeColor)',
                    shape: 'data(nodeShape)' as any,
                    width: 34,
                    height: 34,
                    label: 'data(name)',
                    'text-valign': 'bottom',
                    'text-halign': 'center',
                    'text-margin-y': 5,
                    'font-size': 11,
                    'font-weight': 'normal' as any,
                    color: '#334155',
                    'text-max-width': '110px',
                    'text-wrap': 'wrap',
                    'border-width': 2,
                    'border-color': '#ffffff',
                    'z-index': 10
                }
            },
            {
                selector: 'node[lagging = 1]',
                style: {
                    'border-width': 4,
                    'border-color': '#ef4444'
                }
            },
            {
                selector: 'node:selected',
                style: {
                    'border-width': 4,
                    'border-color': '#111827'
                }
            },
            {
                selector: 'edge',
                style: {
                    width: 1.5,
                    'line-color': '#cbd5e1',
                    'target-arrow-color': '#cbd5e1',
                    'target-arrow-shape': 'triangle',
                    'arrow-scale': 0.9,
                    'curve-style': 'bezier',
                    label: 'data(relLabel)',
                    'font-size': 8,
                    color: '#94a3b8',
                    'text-rotation': 'autorotate',
                    'text-background-color': '#ffffff',
                    'text-background-opacity': 0.85,
                    'text-background-padding': '1px'
                }
            },
            {
                selector: 'edge[relType = "IMPACTS_KPI"], edge[relType = "PERFORMS"]',
                style: { 'line-style': 'dashed', 'line-color': '#f59e0b', 'target-arrow-color': '#f59e0b' }
            },
            {
                selector: 'edge[relType = "INHERITS"], edge[relType = "REFERENCES"]',
                style: { 'line-color': '#db2777', 'target-arrow-color': '#db2777' }
            }
        ]
    });

    // 그룹 노드는 선택/드래그 불가
    cy.$('node[?isGroup]').ungrabify().unselectify();

    cy.on('tap', 'node[!isGroup]', (evt: any) => {
        onNodeTap(evt.target.data('raw'));
    });
    cy.on('tap', (evt: any) => {
        if (evt.target === cy) selectedNode.value = null;
    });
    nextTick(() => cy && cy.fit(undefined, 40));
}

// ---------------------------------------------------------------- 노드 상호작용
async function onNodeTap(node: any) {
    selectedNode.value = node;
    neighbors.value = { nodes: [], edges: [] };
    neighborsLoading.value = true;
    try {
        const data = await store.getNodeNeighbors(node.id, 1);
        neighbors.value = data || { nodes: [], edges: [] };
    } catch (e) {
        neighbors.value = { nodes: [], edges: [] };
    } finally {
        neighborsLoading.value = false;
    }
}

// 이웃 관계를 사람이 읽는 문장으로
const neighborRels = computed(() => {
    if (!selectedNode.value) return [] as any[];
    const selfId = selectedNode.value.id;
    const nameById: Record<string, string> = {};
    neighbors.value.nodes.forEach((n) => (nameById[n.id] = n.name));
    return neighbors.value.edges.map((e) => {
        const out = e.source === selfId;
        const otherId = out ? e.target : e.source;
        return {
            rel: REL_LABEL[e.rel_type] || e.rel_type,
            dir: out ? '→' : '←',
            other: nameById[otherId] || otherId
        };
    });
});

// 속성 목록(내부 필드 제외)
const nodeProps = computed(() => {
    const n = selectedNode.value;
    if (!n || !n.properties) return [] as any[];
    const HIDE = new Set(['created_at', 'updated_at', 'objective_id', 'survey_questions']);
    return Object.entries(n.properties)
        .filter(([k, v]) => !HIDE.has(k) && v !== null && v !== '' && !(Array.isArray(v) && !v.length))
        .map(([k, v]) => ({ k, v: typeof v === 'object' ? JSON.stringify(v) : String(v) }));
});

const selectedAchievement = computed(() => {
    if (!selectedNode.value || selectedNode.value.label !== 'KPI') return null;
    const a = kpiAchievement(selectedNode.value.properties);
    return a == null ? null : Math.round(a * 10) / 10;
});

// ---------------------------------------------------------------- 딥링크(원래 편집 화면)
function procDefIdOf(node: any): string {
    // Process id 는 곧 proc_def_id. Task id 는 "pd-xxx:activity" 형태 → prefix 추출.
    return node.properties?.proc_def_id || String(node.id).split(':')[0];
}
function openEdit(node: any) {
    switch (node.label) {
        case 'Process':
        case 'Task':
            router.push(`/definitions/${procDefIdOf(node)}`);
            break;
        case 'Skill':
            // SkillDetail 의 :id 는 스킬 이름(name). slug 가 아니라 원래 이름을 인코딩해 전달.
            router.push(`/skills/${encodeURIComponent(node.name)}`);
            break;
        case 'User':
        case 'Agent':
        case 'Team':
            router.push('/organization');
            break;
        case 'Strategy':
        case 'KPI':
        case 'Initiative':
        default:
            router.push('/strategy-board');
    }
}
const editActionLabel = computed(() => {
    const n = selectedNode.value;
    if (!n) return '';
    switch (n.label) {
        case 'Process':
        case 'Task':
            return '프로세스 정의 편집';
        case 'Skill':
            return '스킬 상세 보기';
        case 'User':
        case 'Agent':
        case 'Team':
            return '조직도 보기';
        default:
            return '전략보드에서 편집';
    }
});

function analyzeSelectedKpi() {
    if (!selectedNode.value || selectedNode.value.label !== 'KPI') return;
    selectedKpiId.value = selectedNode.value.id;
    activeTab.value = 'impact';
    loadImpact();
}

// ---------------------------------------------------------------- 데이터 로드
async function loadGraph() {
    loading.value = true;
    try {
        const data = await store.getOntologyGraph();
        graph.value = data || { nodes: [], edges: [] };
        // 기본 선택값 세팅
        if (!selectedKpiId.value && kpiList.value.length) selectedKpiId.value = laggingKpiId.value || kpiList.value[0].id;
        if (!selectedStrategyId.value && strategyList.value.length) selectedStrategyId.value = strategyList.value[0].id;
        await nextTick();
        if (activeTab.value === 'graph') buildCy();
    } finally {
        loading.value = false;
    }
}
async function doSync() {
    syncing.value = true;
    try {
        await store.runOntologySync();
        await loadGraph();
    } finally {
        syncing.value = false;
    }
}

async function loadImpact() {
    if (!selectedKpiId.value) return;
    impactLoading.value = true;
    impactData.value = null;
    try {
        impactData.value = await store.getImpactKpi(selectedKpiId.value);
    } finally {
        impactLoading.value = false;
    }
}
async function loadImprove() {
    if (!selectedStrategyId.value) return;
    improveLoading.value = true;
    improveData.value = null;
    try {
        improveData.value = await store.getImpactStrategy(selectedStrategyId.value);
    } finally {
        improveLoading.value = false;
    }
}

// ---------------------------------------------------------------- 목록 파생
const kpiList = computed(() =>
    graph.value.nodes
        .filter((n) => n.label === 'KPI')
        .map((n) => ({ id: n.id, name: n.name, achievement: kpiAchievement(n.properties), lagging: isLaggingKpi(n) }))
);
const laggingKpiId = computed(() => kpiList.value.find((k) => k.lagging)?.id || null);
const strategyList = computed(() =>
    graph.value.nodes.filter((n) => n.label === 'Strategy').map((n) => ({ id: n.id, name: n.name }))
);

// 영향도 체인(path 배열 → node/rel 청크)
function parseChain(path: string[]) {
    const chunks: { node?: string; rel?: string }[] = [];
    (path || []).forEach((p, i) => {
        if (i % 2 === 0) {
            const [, ...rest] = p.split(':');
            chunks.push({ node: rest.join(':') || p });
        } else {
            chunks.push({ rel: REL_LABEL[p] || p });
        }
    });
    return chunks;
}
function metricsText(m: any) {
    if (!m) return '';
    return Object.entries(m)
        .filter(([, v]) => typeof v !== 'object')
        .map(([k, v]) => `${k}: ${v}`)
        .join(' · ');
}
// 스킬 개선 후보 헬퍼 — skill 은 {id,name} 객체, linked_via 는 경로 배열의 배열.
function skillName(s: any): string {
    return typeof s?.skill === 'object' ? s.skill?.name : s?.skill;
}
function skillLinkedChain(s: any): string {
    const path = Array.isArray(s?.linked_via?.[0]) ? s.linked_via[0] : s?.linked_via;
    if (!Array.isArray(path)) return '';
    return path
        .filter((_: any, i: number) => i % 2 === 0)
        .map((p: string) => p.split(':').slice(1).join(':') || p)
        .join(' → ');
}

const impactCandidateHeaders = [
    { title: '유형', key: 'type', width: 90 },
    { title: '이름', key: 'name' },
    { title: '지표', key: 'metricsText' },
    { title: '점수', key: 'score', width: 90 }
];
const impactRows = computed(() =>
    (impactData.value?.candidates || []).map((c: any) => ({ ...c, metricsText: metricsText(c.metrics) }))
);

const lastSyncedText = computed(() => {
    const t = graph.value.last_synced_at;
    if (!t) return '동기화 이력 없음';
    try {
        return new Date(t).toLocaleString('ko-KR');
    } catch {
        return t;
    }
});

const nodeCountText = computed(() => `노드 ${graph.value.nodes.length} · 관계 ${graph.value.edges.length}`);

const typeLabelKo: Record<string, string> = {
    task: '태스크',
    process: '프로세스',
    resource: '리소스',
    skill: '스킬',
    kpi: 'KPI'
};

// ---------------------------------------------------------------- watch / lifecycle
watch(layerState, () => {
    if (activeTab.value === 'graph') buildCy();
}, { deep: true });

watch(activeTab, async (tab) => {
    await nextTick();
    if (tab === 'graph') {
        if (cy) cy.resize();
        else buildCy();
        if (cy) cy.fit(undefined, 40);
    } else if (tab === 'impact') {
        if (!impactData.value) loadImpact();
    } else if (tab === 'improve') {
        if (!improveData.value) loadImprove();
    }
});
watch(selectedKpiId, () => activeTab.value === 'impact' && loadImpact());
watch(selectedStrategyId, () => activeTab.value === 'improve' && loadImprove());

onMounted(async () => {
    // 쿼리 프리셋: ?tab=impact&kpi={id}
    const q = route.query;
    if (q.kpi) selectedKpiId.value = String(q.kpi);
    if (q.tab === 'impact' || q.tab === 'improve' || q.tab === 'graph') activeTab.value = q.tab as any;
    (window as any).$cyOntology = () => cy; // 스모크 테스트용 핸들
    // 스모크 테스트용: 노드 id 로 상세 패널 선택(캔버스 픽셀 클릭 대신 결정적 호출)
    (window as any).$ontologySelect = (id: string) => {
        const n = graph.value.nodes.find((x) => x.id === id);
        if (n) onNodeTap(n);
    };
    await loadGraph();
    if (activeTab.value === 'impact') loadImpact();
    if (activeTab.value === 'improve') loadImprove();
});
onBeforeUnmount(() => {
    if (cy) {
        cy.destroy();
        cy = null;
    }
});
</script>

<template>
    <div class="ontology-explorer pa-4">
        <!-- 툴바 -->
        <div class="d-flex align-center justify-space-between mb-3 flex-wrap ga-2">
            <div>
                <h2 class="text-h5 font-weight-bold">기업 운영 온톨로지</h2>
                <span class="text-caption text-medium-emphasis">
                    전략 → 프로세스 → 리소스 → 지식 4레이어 계층 그래프 · {{ nodeCountText }} · 최근 동기화: {{ lastSyncedText }}
                </span>
            </div>
            <div class="d-flex align-center ga-2 flex-wrap">
                <v-chip
                    v-for="chip in LAYER_CHIPS"
                    :key="chip.key"
                    size="small"
                    :variant="layerState[chip.key] ? 'flat' : 'outlined'"
                    :color="layerState[chip.key] ? 'primary' : undefined"
                    @click="layerState[chip.key] = !layerState[chip.key]"
                >
                    {{ chip.label }}
                </v-chip>
                <v-btn variant="outlined" size="small" :loading="syncing" @click="doSync">
                    <v-icon start size="16">mdi-sync</v-icon>동기화
                </v-btn>
                <v-btn color="primary" variant="outlined" size="small" @click="router.push('/strategy-board')">
                    <v-icon start size="16">mdi-pencil-ruler</v-icon>전략보드에서 편집
                </v-btn>
            </div>
        </div>

        <v-tabs v-model="activeTab" density="compact" class="mb-2">
            <v-tab value="graph">온톨로지 그래프</v-tab>
            <v-tab value="impact">영향도 분석</v-tab>
            <v-tab value="improve">전략 개선점</v-tab>
        </v-tabs>

        <v-window v-model="activeTab" class="ontology-window">
            <!-- ============ 그래프 탭 ============ -->
            <v-window-item value="graph">
                <div class="graph-layout">
                    <v-card variant="outlined" class="graph-card">
                        <div v-if="loading" class="d-flex align-center justify-center" style="height: 100%">
                            <v-progress-circular indeterminate color="primary" />
                        </div>
                        <div v-show="!loading" ref="cyContainer" class="cy-canvas"></div>
                        <!-- 범례 -->
                        <div class="legend">
                            <div v-for="(m, lbl) in LABEL_META" :key="lbl" class="legend-item">
                                <span class="legend-dot" :style="{ background: m.color }"></span>{{ lbl }}
                            </div>
                            <div class="legend-item"><span class="legend-dot lagging-dot"></span>미달 KPI</div>
                        </div>
                    </v-card>

                    <!-- 우측 상세 패널 -->
                    <v-card variant="outlined" class="detail-card">
                        <template v-if="selectedNode">
                            <div class="pa-3">
                                <div class="d-flex align-center ga-2 mb-1">
                                    <v-chip size="x-small" :color="LABEL_META[selectedNode.label]?.color" variant="flat" class="text-white">
                                        {{ selectedNode.label }}
                                    </v-chip>
                                    <span v-if="selectedAchievement != null" :class="selectedAchievement < 100 ? 'text-error' : 'text-success'" class="text-caption font-weight-bold">
                                        달성률 {{ selectedAchievement }}%
                                    </span>
                                </div>
                                <div class="text-subtitle-1 font-weight-bold mb-2">{{ selectedNode.name }}</div>

                                <div class="d-flex flex-column ga-2 mb-3">
                                    <v-btn color="primary" size="small" block @click="openEdit(selectedNode)">
                                        <v-icon start size="16">mdi-open-in-new</v-icon>{{ editActionLabel }}
                                    </v-btn>
                                    <v-btn
                                        v-if="selectedNode.label === 'KPI'"
                                        color="deep-orange"
                                        variant="tonal"
                                        size="small"
                                        block
                                        @click="analyzeSelectedKpi"
                                    >
                                        <v-icon start size="16">mdi-chart-timeline-variant</v-icon>영향도 분석
                                    </v-btn>
                                </div>

                                <div class="text-caption font-weight-bold text-medium-emphasis mb-1">속성</div>
                                <v-table density="compact" class="mb-3 prop-table">
                                    <tbody>
                                        <tr v-for="p in nodeProps" :key="p.k">
                                            <td class="text-caption text-medium-emphasis">{{ p.k }}</td>
                                            <td class="text-caption">{{ p.v }}</td>
                                        </tr>
                                        <tr v-if="!nodeProps.length"><td class="text-caption text-medium-emphasis">속성 없음</td></tr>
                                    </tbody>
                                </v-table>

                                <div class="text-caption font-weight-bold text-medium-emphasis mb-1">
                                    이웃 관계
                                    <v-progress-circular v-if="neighborsLoading" size="12" width="2" indeterminate class="ml-1" />
                                </div>
                                <div v-for="(r, i) in neighborRels" :key="i" class="text-caption mb-1">
                                    <span class="rel-tag">{{ r.rel }}</span> {{ r.dir }} {{ r.other }}
                                </div>
                                <div v-if="!neighborRels.length && !neighborsLoading" class="text-caption text-medium-emphasis">연결된 관계 없음</div>
                            </div>
                        </template>
                        <div v-else class="pa-6 text-center text-medium-emphasis">
                            <v-icon size="40" class="mb-2">mdi-cursor-default-click-outline</v-icon>
                            <div class="text-caption">그래프에서 요소를 클릭하면<br />세부 정보와 편집 링크가 표시됩니다.</div>
                        </div>
                    </v-card>
                </div>
            </v-window-item>

            <!-- ============ 영향도 분석 탭 ============ -->
            <v-window-item value="impact">
                <div class="pa-2">
                    <v-select
                        v-model="selectedKpiId"
                        :items="kpiList"
                        item-title="name"
                        item-value="id"
                        label="KPI 선택 (미달 강조)"
                        density="compact"
                        variant="outlined"
                        style="max-width: 420px"
                        class="mb-3"
                    >
                        <template #item="{ props, item }">
                            <v-list-item v-bind="props">
                                <template #append>
                                    <v-chip v-if="item.raw.achievement != null" size="x-small" :color="item.raw.lagging ? 'error' : 'success'" variant="tonal">
                                        {{ Math.round(item.raw.achievement) }}%
                                    </v-chip>
                                </template>
                            </v-list-item>
                        </template>
                    </v-select>

                    <div v-if="impactLoading" class="d-flex justify-center pa-6"><v-progress-circular indeterminate color="primary" /></div>
                    <template v-else-if="impactData">
                        <v-alert v-if="impactData.diagnosis" type="info" variant="tonal" density="compact" class="mb-3">
                            {{ impactData.diagnosis }}
                        </v-alert>

                        <div class="text-subtitle-2 font-weight-bold mb-2">역추적 체인 (KPI → 원인 후보)</div>
                        <div class="chain-scroll mb-4">
                            <div v-for="(c, ci) in (impactData.candidates || []).slice(0, 4)" :key="ci" class="chain-row mb-2">
                                <template v-for="(chunk, idx) in parseChain(c.path)" :key="idx">
                                    <v-chip v-if="chunk.node" size="small" variant="outlined" class="chain-node">{{ chunk.node }}</v-chip>
                                    <span v-else class="chain-rel">─ {{ chunk.rel }} →</span>
                                </template>
                            </div>
                        </div>

                        <div class="text-subtitle-2 font-weight-bold mb-2">원인 후보 랭킹</div>
                        <v-data-table
                            :headers="impactCandidateHeaders"
                            :items="impactRows"
                            density="compact"
                            :items-per-page="10"
                            class="rank-table"
                        >
                            <template #item.type="{ item }">
                                <v-chip size="x-small" variant="tonal">{{ typeLabelKo[item.type] || item.type }}</v-chip>
                            </template>
                            <template #item.score="{ item }">
                                <span class="font-weight-bold">{{ item.score }}</span>
                            </template>
                        </v-data-table>
                    </template>
                    <div v-else class="text-medium-emphasis text-caption pa-4">KPI를 선택하세요.</div>
                </div>
            </v-window-item>

            <!-- ============ 전략 개선점 탭 ============ -->
            <v-window-item value="improve">
                <div class="pa-2">
                    <v-select
                        v-model="selectedStrategyId"
                        :items="strategyList"
                        item-title="name"
                        item-value="id"
                        label="전략 선택"
                        density="compact"
                        variant="outlined"
                        style="max-width: 420px"
                        class="mb-3"
                    />
                    <div v-if="improveLoading" class="d-flex justify-center pa-6"><v-progress-circular indeterminate color="primary" /></div>
                    <template v-else-if="improveData">
                        <v-alert v-if="improveData.diagnosis" type="info" variant="tonal" density="compact" class="mb-3">
                            {{ improveData.diagnosis }}
                        </v-alert>

                        <div class="text-subtitle-2 font-weight-bold mb-2">미달 KPI</div>
                        <div class="d-flex flex-wrap ga-2 mb-4">
                            <v-card v-for="k in improveData.lagging_kpis || []" :key="k.id" variant="outlined" class="pa-2 kpi-mini">
                                <div class="text-caption font-weight-bold">{{ k.name }}</div>
                                <div class="text-caption text-error">달성률 {{ Math.round(k.achievement) }}%</div>
                                <div class="text-caption text-medium-emphasis">현재 {{ k.current_value }} / 목표 {{ k.target_value }} {{ k.unit }}</div>
                            </v-card>
                            <div v-if="!(improveData.lagging_kpis || []).length" class="text-caption text-medium-emphasis">미달 KPI 없음</div>
                        </div>

                        <div class="text-subtitle-2 font-weight-bold mb-2">스킬 개선 후보</div>
                        <div class="d-flex flex-wrap ga-3">
                            <v-card v-for="(s, si) in improveData.skill_improvements || []" :key="si" variant="outlined" class="pa-3 skill-card">
                                <div class="d-flex align-center ga-2 mb-1">
                                    <v-icon size="18" color="pink">mdi-star-four-points</v-icon>
                                    <span class="text-subtitle-2 font-weight-bold">{{ skillName(s) }}</span>
                                    <v-chip size="x-small" color="pink" variant="tonal">점수 {{ s.score }}</v-chip>
                                </div>
                                <div class="text-caption text-medium-emphasis mb-1">연결 경로: {{ skillLinkedChain(s) }}</div>
                                <div v-if="metricsText(s.metrics)" class="text-caption">{{ metricsText(s.metrics) }}</div>
                                <v-btn class="mt-2" size="x-small" variant="text" color="pink" @click="router.push(`/skills/${encodeURIComponent(skillName(s))}`)">
                                    스킬 상세 보기
                                </v-btn>
                            </v-card>
                            <div v-if="!(improveData.skill_improvements || []).length" class="text-caption text-medium-emphasis">스킬 개선 후보 없음</div>
                        </div>
                    </template>
                    <div v-else class="text-medium-emphasis text-caption pa-4">전략을 선택하세요.</div>
                </div>
            </v-window-item>
        </v-window>
    </div>
</template>

<style scoped>
.graph-layout {
    display: flex;
    gap: 12px;
}
.graph-card {
    position: relative;
    flex: 1 1 auto;
    height: 72vh;
    min-height: 520px;
    overflow: hidden;
    background: #fbfcfe;
}
.cy-canvas {
    width: 100%;
    height: 100%;
}
.detail-card {
    flex: 0 0 320px;
    height: 72vh;
    min-height: 520px;
    overflow-y: auto;
}
.legend {
    position: absolute;
    left: 10px;
    bottom: 10px;
    background: rgba(255, 255, 255, 0.92);
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 6px 10px;
    display: flex;
    flex-wrap: wrap;
    gap: 6px 12px;
    max-width: 70%;
    font-size: 11px;
    color: #475569;
}
.legend-item {
    display: flex;
    align-items: center;
    gap: 4px;
}
.legend-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    display: inline-block;
}
.lagging-dot {
    background: #fff;
    border: 3px solid #ef4444;
}
.prop-table td {
    padding: 2px 6px !important;
    height: auto !important;
    word-break: break-all;
}
.rel-tag {
    background: #eef2ff;
    color: #4f46e5;
    border-radius: 4px;
    padding: 0 5px;
    font-weight: 600;
}
.chain-scroll {
    overflow-x: auto;
}
.chain-row {
    display: flex;
    align-items: center;
    gap: 4px;
    white-space: nowrap;
}
.chain-rel {
    color: #94a3b8;
    font-size: 11px;
    padding: 0 2px;
}
.chain-node {
    background: #fff !important;
}
.kpi-mini {
    min-width: 200px;
}
.skill-card {
    min-width: 260px;
    max-width: 340px;
}
</style>
