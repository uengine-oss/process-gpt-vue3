<script setup lang="ts">
// 온톨로지 스키마 뷰 (specs/013-ontology-explorer — 전략 보드 탭, 모든 모드).
// strategy-service GET /api/ontology/schema 의 레이어·노드 타입·관계 타입을
// 메타 그래프(레이어 열 × 타입 카드)와 표로 보여준다. 정본: process-gpt-strategy/app/graph/schema.py
import { computed, onMounted, ref } from 'vue';
import { useStrategyStore } from '@/stores/strategy/strategyStore';
import './strategyTheme.css';

const store = useStrategyStore();

const loading = ref(false);
const error = ref('');
const schema = ref<any>(null);
// 클릭으로 고정한 타입, 마우스·키보드 포커스로 미리 보는 타입. 강조는 고정 > 미리보기 순.
const focusLabel = ref<string | null>(null);
const hoverLabel = ref<string | null>(null);
const activeLabel = computed(() => focusLabel.value || hoverLabel.value);
const query = ref('');

// 익스플로러 단계 색과 같은 무리(계획·정의·실행·사람)로 맞춘다. 흰 바탕 대비 4.5:1 이상.
const LAYER_COLORS: Record<string, string> = {
    strategy: '#4338ca',
    process: '#0f766e',
    architecture: '#0f766e',
    execution: '#0369a1',
    resource: '#a21caf',
    skill: '#be185d',
    asset: '#475569',
    other: '#475569'
};
const layerColor = (key: string) => LAYER_COLORS[key] || LAYER_COLORS.other;
// CSS 사용자 정의 속성(--layer)이 섞인 스타일 — Vue 의 StyleValue 타입에 없어 any 로 넘긴다
const cssVars = (style: Record<string, string>): any => style;

const BOX_W = 148;
const BOX_H = 48;
const COL_GAP = 40;
const ROW_GAP = 18;
const HEAD_H = 36;
const PAD_R = 28; // 마지막 열의 자기 참조 고리 자리

// 메타 그래프 배치 — 레이어별 열, 레이어 안에서 라벨 순서대로
const meta = computed(() => {
    if (!schema.value) return { boxes: new Map(), edges: [], width: 0, height: 0 };
    const boxes = new Map<string, any>();
    const countOf = new Map<string, number>((schema.value.nodes || []).map((n: any) => [n.label, n.count ?? 0]));
    let height = 0;
    schema.value.layers.forEach((layer: any, col: number) => {
        layer.labels.forEach((label: string, row: number) => {
            const box = { label, layer: layer.key, x: col * (BOX_W + COL_GAP), y: row * (BOX_H + ROW_GAP), count: countOf.get(label) ?? 0 };
            boxes.set(label, box);
            height = Math.max(height, box.y + BOX_H);
        });
    });
    const edges: any[] = [];
    for (const e of schema.value.edges) {
        for (const from of e.from) {
            for (const to of e.to) {
                const a = boxes.get(from);
                const b = boxes.get(to);
                if (!a || !b) continue;
                edges.push({ key: `${e.type}:${from}:${to}`, type: e.type, from, to, count: e.count, d: path(a, b), mid: midpoint(a, b) });
            }
        }
    }
    const width = schema.value.layers.length * (BOX_W + COL_GAP) - COL_GAP;
    return { boxes, edges, width, height };
});

// 타입별 이웃 — 박스마다 엣지 전체를 훑지 않도록 미리 만든다
const neighbors = computed(() => {
    const map = new Map<string, Set<string>>();
    for (const e of meta.value.edges) {
        if (!map.has(e.from)) map.set(e.from, new Set());
        if (!map.has(e.to)) map.set(e.to, new Set());
        map.get(e.from)!.add(e.to);
        map.get(e.to)!.add(e.from);
    }
    return map;
});

function path(a: any, b: any) {
    if (a === b) {
        // 자기 참조(하위 전략·하위 팀·스킬 상속) — 오른쪽 고리
        const x = a.x + BOX_W;
        const y = a.y + BOX_H / 2;
        return `M${x},${y - 8} C${x + 34},${y - 26} ${x + 34},${y + 26} ${x},${y + 8}`;
    }
    if (a.x === b.x) {
        const x = a.x + BOX_W;
        const [y1, y2] = [a.y + BOX_H / 2, b.y + BOX_H / 2];
        return `M${x},${y1} C${x + 40},${y1} ${x + 40},${y2} ${x},${y2}`;
    }
    const [l, r] = a.x < b.x ? [a, b] : [b, a];
    const x1 = l.x + BOX_W;
    const y1 = l.y + BOX_H / 2;
    const x2 = r.x;
    const y2 = r.y + BOX_H / 2;
    const mx = (x1 + x2) / 2;
    return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
}
function midpoint(a: any, b: any) {
    if (a === b) return { x: a.x + BOX_W + 28, y: a.y + BOX_H / 2 };
    if (a.x === b.x) return { x: a.x + BOX_W + 30, y: (a.y + b.y) / 2 + BOX_H / 2 };
    return { x: (a.x + b.x + BOX_W) / 2, y: (a.y + b.y) / 2 + BOX_H / 2 };
}

function edgeActive(e: any) {
    const f = activeLabel.value;
    return !f || e.from === f || e.to === f;
}
function boxActive(label: string) {
    const f = activeLabel.value;
    return !f || label === f || !!neighbors.value.get(f)?.has(label);
}
const activeEdges = computed(() => (activeLabel.value ? meta.value.edges.filter(edgeActive) : []));
function toggleFocus(label: string) {
    focusLabel.value = focusLabel.value === label ? null : label;
}

const layerName = computed(() => Object.fromEntries((schema.value?.layers || []).map((l: any) => [l.key, l.name])));
const q = computed(() => query.value.trim().toLowerCase());
const nodeRows = computed(() =>
    (schema.value?.nodes || []).filter((n: any) => {
        if (focusLabel.value && n.label !== focusLabel.value && !neighbors.value.get(focusLabel.value)?.has(n.label)) return false;
        if (!q.value) return true;
        return [n.label, n.description, n.source, ...(n.properties || [])].some((v) =>
            String(v || '')
                .toLowerCase()
                .includes(q.value)
        );
    })
);
const edgeRows = computed(() =>
    (schema.value?.edges || []).filter((e: any) => {
        if (focusLabel.value && !e.from.includes(focusLabel.value) && !e.to.includes(focusLabel.value)) return false;
        if (!q.value) return true;
        return [e.type, e.description, e.source, ...e.from, ...e.to].some((v) =>
            String(v || '')
                .toLowerCase()
                .includes(q.value)
        );
    })
);

async function load() {
    loading.value = true;
    error.value = '';
    try {
        schema.value = await store.getOntologySchema();
    } catch (e: any) {
        error.value = e?.response?.data?.detail || e?.message || '스키마를 불러오지 못했습니다.';
    } finally {
        loading.value = false;
    }
}

onMounted(load);
</script>

<template>
    <div class="osv sx-theme" data-testid="ontology-schema-view">
        <div v-if="loading" class="osv-skeleton" aria-busy="true" aria-label="스키마 불러오는 중">
            <div class="osv-skeleton-block" style="height: 260px"></div>
            <div class="osv-skeleton-block" style="height: 180px"></div>
        </div>
        <v-alert v-else-if="error" type="error" variant="tonal" rounded="lg">
            {{ error }}
            <template #append><v-btn size="small" variant="text" @click="load">다시 시도</v-btn></template>
        </v-alert>
        <template v-else-if="schema">
            <!-- 요약 + 검색 -->
            <div class="osv-head">
                <div class="osv-stats">
                    <span class="osv-stat"
                        ><span class="osv-stat-label">스키마 버전</span><b class="sx-num">{{ schema.version }}</b></span
                    >
                    <span class="osv-stat"
                        ><span class="osv-stat-label">노드 타입</span><b class="sx-num">{{ schema.nodes.length }}</b></span
                    >
                    <span class="osv-stat"
                        ><span class="osv-stat-label">관계 타입</span><b class="sx-num">{{ schema.edges.length }}</b></span
                    >
                    <span class="osv-note">개수는 현재 테넌트 기준</span>
                </div>
                <div class="osv-head-actions">
                    <v-chip
                        v-if="focusLabel"
                        size="small"
                        closable
                        color="primary"
                        variant="tonal"
                        data-testid="schema-focus-chip"
                        @click:close="focusLabel = null"
                        >{{ focusLabel }} 관련만</v-chip
                    >
                    <v-text-field
                        v-model="query"
                        density="compact"
                        variant="outlined"
                        hide-details
                        clearable
                        prepend-inner-icon="mdi-magnify"
                        placeholder="타입·관계·속성 검색"
                        aria-label="스키마 검색"
                        class="osv-search"
                    />
                </div>
            </div>

            <!-- 메타 그래프 -->
            <section class="osv-meta" aria-label="온톨로지 메타 그래프">
                <div class="osv-meta-scroll">
                    <div class="osv-meta-plane" :style="{ width: meta.width + PAD_R + 'px', height: meta.height + HEAD_H + 12 + 'px' }">
                        <div
                            v-for="(layer, col) in schema.layers"
                            :key="layer.key"
                            class="osv-layer-title"
                            :style="
                                cssVars({ left: col * (BOX_W + COL_GAP) + 'px', width: BOX_W + 'px', '--layer': layerColor(layer.key) })
                            "
                            :title="layer.description"
                        >
                            <span class="osv-layer-dot" aria-hidden="true"></span>{{ layer.name }}
                        </div>
                        <svg class="osv-edges" :width="meta.width + PAD_R" :height="meta.height + HEAD_H + 12" aria-hidden="true">
                            <defs>
                                <marker id="osv-arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                                    <path d="M0,0 L7,3 L0,6 Z" class="osv-arrow" />
                                </marker>
                                <marker id="osv-arrow-active" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                                    <path d="M0,0 L7,3 L0,6 Z" class="osv-arrow osv-arrow--active" />
                                </marker>
                            </defs>
                            <g :transform="`translate(0,${HEAD_H})`">
                                <path
                                    v-for="e in meta.edges"
                                    :key="e.key"
                                    :d="e.d"
                                    fill="none"
                                    class="osv-edge"
                                    :class="{ muted: !edgeActive(e), active: activeLabel && edgeActive(e) }"
                                    :marker-end="activeLabel && edgeActive(e) ? 'url(#osv-arrow-active)' : 'url(#osv-arrow)'"
                                />
                            </g>
                        </svg>
                        <div
                            v-for="[label, box] in meta.boxes"
                            :key="label"
                            class="osv-box"
                            :class="{ focus: label === focusLabel, muted: !boxActive(label) }"
                            :style="
                                cssVars({
                                    left: box.x + 'px',
                                    top: box.y + HEAD_H + 'px',
                                    width: BOX_W + 'px',
                                    height: BOX_H + 'px',
                                    '--layer': layerColor(box.layer)
                                })
                            "
                            :data-label="label"
                            role="button"
                            tabindex="0"
                            :aria-pressed="label === focusLabel"
                            :aria-label="`${label} ${box.count.toLocaleString()}개 — 연결된 관계만 보기`"
                            @click="toggleFocus(label)"
                            @keydown.enter.prevent="toggleFocus(label)"
                            @keydown.space.prevent="toggleFocus(label)"
                            @mouseenter="hoverLabel = label"
                            @mouseleave="hoverLabel = null"
                            @focus="hoverLabel = label"
                            @blur="hoverLabel = null"
                        >
                            <span class="osv-box-name"
                                ><span class="osv-layer-dot" aria-hidden="true"></span><span class="osv-box-text">{{ label }}</span></span
                            >
                            <span class="osv-box-count sx-num">{{ box.count.toLocaleString() }}</span>
                        </div>
                        <!-- 관계 이름은 박스 위에 그린다(박스에 가려지지 않게) -->
                        <svg
                            v-if="activeLabel"
                            class="osv-edges osv-labels"
                            :width="meta.width + PAD_R"
                            :height="meta.height + HEAD_H + 12"
                            aria-hidden="true"
                        >
                            <text
                                v-for="e in activeEdges"
                                :key="e.key"
                                :x="e.mid.x"
                                :y="e.mid.y + HEAD_H - 4"
                                text-anchor="middle"
                                class="osv-edge-label"
                            >
                                {{ e.type }}
                            </text>
                        </svg>
                    </div>
                </div>
                <div class="osv-hint">
                    <v-icon size="14">mdi-cursor-default-click-outline</v-icon>
                    타입에 마우스를 올리면 연결된 관계를 미리 보고, 클릭하면 그 타입 관련만 고정해 아래 표도 걸러집니다.
                </div>
            </section>

            <!-- 노드 타입 -->
            <section class="osv-section">
                <div class="osv-section-head">
                    <h3>노드 타입</h3>
                    <span class="osv-section-count sx-num">{{ nodeRows.length }}</span>
                </div>
                <div class="osv-table-wrap">
                    <v-table density="compact" class="osv-table">
                        <colgroup>
                            <col style="width: 140px" />
                            <col style="width: 120px" />
                            <col style="min-width: 240px" />
                            <col style="width: 150px" />
                            <col />
                            <col style="width: 170px" />
                            <col style="width: 72px" />
                        </colgroup>
                        <thead>
                            <tr>
                                <th>타입</th>
                                <th>레이어</th>
                                <th>설명</th>
                                <th>업무키</th>
                                <th>주요 속성</th>
                                <th>원천</th>
                                <th class="text-right text-no-wrap">개수</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="n in nodeRows" :key="n.label" :data-label="n.label" :class="{ 'is-focus': n.label === focusLabel }">
                                <td class="osv-type text-no-wrap">{{ n.label }}</td>
                                <td>
                                    <span class="osv-layer-tag" :style="cssVars({ '--layer': layerColor(n.layer || 'other') })">
                                        <span class="osv-layer-dot" aria-hidden="true"></span>{{ layerName[n.layer] || '기타(BMC)' }}
                                    </span>
                                </td>
                                <td class="osv-desc">{{ n.description }}</td>
                                <td class="text-no-wrap">
                                    <code class="osv-code">{{ n.key }}</code>
                                </td>
                                <td>
                                    <span v-for="p in n.properties" :key="p" class="osv-prop">{{ p }}</span>
                                </td>
                                <td class="osv-source">{{ n.source }}</td>
                                <td class="text-right sx-num">{{ n.count.toLocaleString() }}</td>
                            </tr>
                            <tr v-if="!nodeRows.length">
                                <td colspan="7" class="osv-empty">검색 결과가 없습니다.</td>
                            </tr>
                        </tbody>
                    </v-table>
                </div>
            </section>

            <!-- 관계 타입 -->
            <section class="osv-section">
                <div class="osv-section-head">
                    <h3>관계 타입</h3>
                    <span class="osv-section-count sx-num">{{ edgeRows.length }}</span>
                </div>
                <div class="osv-table-wrap">
                    <v-table density="compact" class="osv-table">
                        <colgroup>
                            <col style="width: 200px" />
                            <col style="width: 260px" />
                            <col />
                            <col style="width: 170px" />
                            <col style="width: 72px" />
                        </colgroup>
                        <thead>
                            <tr>
                                <th>관계</th>
                                <th>시작 → 끝</th>
                                <th>의미</th>
                                <th>원천</th>
                                <th class="text-right text-no-wrap">개수</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="e in edgeRows" :key="e.type">
                                <td class="text-no-wrap">
                                    <code class="osv-code osv-code--rel">{{ e.type }}</code>
                                </td>
                                <td class="osv-route">
                                    <span>{{ e.from.join(' | ') }}</span>
                                    <v-icon size="14" aria-hidden="true">mdi-arrow-right</v-icon>
                                    <span>{{ e.to.join(' | ') }}</span>
                                </td>
                                <td class="osv-desc">{{ e.description }}</td>
                                <td class="osv-source">{{ e.source }}</td>
                                <td class="text-right sx-num">{{ e.count.toLocaleString() }}</td>
                            </tr>
                            <tr v-if="!edgeRows.length">
                                <td colspan="5" class="osv-empty">검색 결과가 없습니다.</td>
                            </tr>
                        </tbody>
                    </v-table>
                </div>
            </section>
        </template>
    </div>
</template>

<style scoped>
.osv {
    height: 100%;
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: 16px;
    color: var(--sx-ink);
}

/* 요약 + 검색 */
.osv-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
}
.osv-stats {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
}
.osv-stat {
    display: inline-flex;
    align-items: baseline;
    gap: 6px;
    padding: 6px 12px;
    border: 1px solid var(--sx-line);
    border-radius: 999px;
    background: var(--sx-surface);
    font-size: 12px;
}
.osv-stat-label {
    color: var(--sx-ink-2);
}
.osv-stat b {
    font-size: 14px;
}
.osv-note {
    font-size: 12px;
    color: var(--sx-ink-3);
}
.osv-head-actions {
    display: flex;
    align-items: center;
    gap: 8px;
}
.osv-search {
    width: 260px;
}
.osv-search :deep(.v-field) {
    border-radius: 8px;
}

/* 메타 그래프 */
.osv-meta {
    border: 1px solid var(--sx-line);
    border-radius: var(--sx-radius-lg);
    background: var(--sx-surface-sunken);
    flex-shrink: 0;
}
.osv-meta-scroll {
    overflow-x: auto;
    padding: 16px 20px 8px;
}
.osv-meta-plane {
    position: relative;
}
.osv-layer-title {
    position: absolute;
    top: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    height: 22px;
    font-size: 12px;
    font-weight: 700;
    color: var(--sx-ink-2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.osv-layer-dot {
    flex-shrink: 0;
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--layer);
}
.osv-edges {
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: visible;
}
.osv-labels {
    z-index: 2;
}
.osv-edge {
    stroke: var(--sx-ink-3);
    stroke-opacity: 0.45;
    stroke-width: 1.2;
    transition: stroke-opacity var(--sx-dur) var(--sx-ease);
}
.osv-edge.active {
    stroke: var(--sx-accent);
    stroke-opacity: 0.9;
    stroke-width: 1.6;
}
.osv-edge.muted {
    stroke-opacity: 0.08;
}
.osv-arrow {
    fill: var(--sx-ink-3);
    fill-opacity: 0.6;
}
.osv-arrow--active {
    fill: var(--sx-accent);
    fill-opacity: 1;
}
.osv-edge-label {
    /* 박스·다른 선 위에서도 읽히도록 배경색 외곽선 */
    paint-order: stroke;
    stroke: var(--sx-surface-sunken);
    stroke-width: 4px;
    stroke-linejoin: round;
    fill: var(--sx-accent);
    font-size: 10px;
    font-weight: 700;
}
.osv-box {
    position: absolute;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 2px;
    padding: 6px 10px;
    border: 1px solid var(--sx-line);
    border-radius: var(--sx-radius);
    background: var(--sx-surface);
    box-shadow: var(--sx-shadow-1);
    cursor: pointer;
    z-index: 1;
    overflow: hidden;
    transition: opacity var(--sx-dur) var(--sx-ease), box-shadow var(--sx-dur) var(--sx-ease), border-color var(--sx-dur) var(--sx-ease);
}
.osv-box:hover {
    border-color: var(--sx-line-strong);
    box-shadow: var(--sx-shadow-2);
}
.osv-box.focus {
    border-color: var(--sx-accent);
    box-shadow: 0 0 0 3px var(--sx-accent-ring);
}
.osv-box.muted {
    opacity: 0.32;
}
.osv-box-name {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    font-size: 12px;
    font-weight: 700;
    line-height: 1.35;
}
.osv-box-text {
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.osv-box-count {
    padding-left: 14px;
    font-size: 11.5px;
    font-weight: 600;
    color: var(--sx-ink-2);
}
.osv-hint {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 20px 12px;
    font-size: 12px;
    color: var(--sx-ink-2);
}

/* 표 */
.osv-section-head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
}
.osv-section-head h3 {
    font-size: 14px;
    font-weight: 700;
}
.osv-section-count {
    padding: 0 8px;
    border-radius: 999px;
    background: var(--sx-surface-hover);
    font-size: 12px;
    line-height: 20px;
    color: var(--sx-ink-2);
}
.osv-table-wrap {
    border: 1px solid var(--sx-line);
    border-radius: var(--sx-radius-lg);
    overflow: hidden;
}
.osv-table {
    background: var(--sx-surface);
}
.osv-table :deep(table) {
    table-layout: fixed;
    min-width: 960px;
}
.osv-table :deep(thead th) {
    background: var(--sx-surface-sunken) !important;
    font-size: 12px !important;
    font-weight: 700 !important;
    color: var(--sx-ink-2) !important;
    height: 38px !important;
    border-bottom: 1px solid var(--sx-line) !important;
}
.osv-table td {
    font-size: 12.5px;
    vertical-align: top;
    padding-top: 9px !important;
    padding-bottom: 9px !important;
    border-bottom-color: var(--sx-line) !important;
}
.osv-table tbody tr {
    transition: background-color var(--sx-dur) var(--sx-ease);
}
.osv-table tbody tr:hover {
    background: var(--sx-surface-hover);
}
.osv-table tbody tr.is-focus {
    background: var(--sx-accent-soft);
}
.osv-type {
    font-weight: 700;
}
.osv-desc {
    line-height: 1.5;
    word-break: keep-all;
    overflow-wrap: anywhere;
}
.osv-source {
    font-size: 12px;
    color: var(--sx-ink-2);
    overflow-wrap: anywhere;
}
.osv-layer-tag {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 600;
    color: var(--sx-ink-2);
    white-space: nowrap;
}
.osv-code {
    padding: 1px 6px;
    border-radius: 4px;
    background: var(--sx-surface-hover);
    font-family: var(--cds-font-mono, ui-monospace, monospace);
    font-size: 11.5px;
}
.osv-code--rel {
    color: var(--sx-accent);
    background: var(--sx-accent-soft);
    font-weight: 600;
}
.osv-route {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
    color: var(--sx-ink);
}
.osv-route :deep(.v-icon) {
    color: var(--sx-ink-3);
}
.osv-prop {
    display: inline-block;
    max-width: 100%;
    overflow-wrap: anywhere;
    margin: 0 4px 4px 0;
    padding: 1px 6px;
    border-radius: 4px;
    background: var(--sx-surface-hover);
    font-family: var(--cds-font-mono, ui-monospace, monospace);
    font-size: 11px;
    color: var(--sx-ink-2);
}
.osv-empty {
    text-align: center;
    padding: 20px !important;
    color: var(--sx-ink-3);
}
.osv-skeleton {
    display: flex;
    flex-direction: column;
    gap: 16px;
}
.osv-skeleton-block {
    border-radius: var(--sx-radius-lg);
    background: linear-gradient(90deg, var(--sx-surface-hover) 25%, var(--sx-surface) 50%, var(--sx-surface-hover) 75%);
    background-size: 200% 100%;
    animation: osv-shimmer 1.4s ease-in-out infinite;
}
@keyframes osv-shimmer {
    from {
        background-position: 200% 0;
    }
    to {
        background-position: -200% 0;
    }
}
@media (max-width: 760px) {
    .osv-head-actions,
    .osv-search {
        width: 100%;
    }
}
</style>
