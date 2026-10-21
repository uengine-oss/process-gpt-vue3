// 전략–실행 온톨로지 익스플로러의 순수 로직 (specs/013-ontology-explorer).
// 단계(stage) 매핑 · 체인(lineage) 추적 · 워터폴 배치 · 노드 지표 계산.
// 화면(StrategyOntologyExplorer.vue)과 분리해 node --test 로 검증한다.
import { DEFAULT_LEVEL_THRESHOLDS, achievementLevel } from './achievementLevel.js';

/**
 * 워터폴 단계(열). 정본은 strategy-service 스키마(`GET /api/ontology/schema` 의 columns, app/graph/schema.py EXPLORER_COLUMNS)다.
 * 화면은 스키마를 받아 applyColumns 로 바꿔 끼우고, 아래는 스키마를 못 받았을 때의 같은 내용 기본값이다.
 * course=false 는 맥락 열 — 지도·체인에는 나오지만 코스는 건너뛴다.
 */
export const STAGES = [
    { key: 'strategy', name: '전략', labels: ['Strategy'], course: true },
    { key: 'kpi', name: 'KPI · 이니셔티브', labels: ['KPI', 'Initiative'], course: true },
    { key: 'architecture', name: '영역 · 그룹', labels: ['ProcessArea', 'ProcessGroup'], course: false },
    { key: 'process', name: '프로세스', labels: ['Process'], course: true },
    { key: 'task', name: '태스크', labels: ['Task'], course: true },
    { key: 'asset', name: '시스템 · 데이터 · 문서', labels: ['System', 'DataObject', 'Document'], course: false },
    { key: 'instance', name: '실행 인스턴스', labels: ['ProcessInstance'], course: true },
    { key: 'workitem', name: '워크아이템', labels: ['WorkItem'], course: true },
    { key: 'resource', name: '리소스', labels: ['User', 'Agent', 'Team'], course: true },
    { key: 'skill', name: '스킬', labels: ['Skill'], course: true }
];

let STAGE_OF_LABEL = {};
function reindexStages() {
    STAGE_OF_LABEL = Object.fromEntries(STAGES.flatMap((s, i) => s.labels.map((l) => [l, i])));
}
reindexStages();

/** 스키마 열로 단계를 바꿔 끼운다(같은 배열을 제자리에서 바꾼다 — import 한 곳이 그대로 본다). 형식이 틀리면 무시. */
export function applyColumns(columns) {
    if (!Array.isArray(columns) || !columns.length || columns.some((c) => !c?.key || !Array.isArray(c.labels))) return false;
    STAGES.splice(
        0,
        STAGES.length,
        ...columns.map((c) => ({ key: c.key, name: c.name || c.key, labels: c.labels, course: c.course !== false }))
    );
    reindexStages();
    return true;
}

/** 열 키 → 단계 index (없으면 -1). */
export function stageIndex(key) {
    return STAGES.findIndex((s) => s.key === key);
}

/** 조망 API 에 요청할 레이어 — 스키마를 못 받았을 때의 기본값(받으면 스키마 레이어를 쓴다). */
export const EXPLORER_LAYERS = ['strategy', 'process', 'execution', 'resource', 'skill', 'architecture', 'asset'];

export function stageOf(label) {
    return STAGE_OF_LABEL[label] ?? -1;
}

/**
 * 그래프 색인. 조망 API 응답({nodes, edges})에서 단계·인접 목록을 만든다.
 * 단계 밖 라벨(Canvas 등)과 끝점이 없는 엣지는 버린다.
 */
export function buildIndex(graph) {
    const nodes = new Map();
    for (const n of graph?.nodes || []) {
        const stage = stageOf(n.label);
        if (stage < 0 || n.id == null) continue;
        nodes.set(n.id, { ...n, stage });
    }
    const edges = [];
    const adj = new Map();
    for (const n of nodes.keys()) adj.set(n, []);
    for (const e of graph?.edges || []) {
        if (!nodes.has(e.source) || !nodes.has(e.target) || e.source === e.target) continue;
        // 소속(PART_OF)은 자식 → 부모로 저장돼 있다. 같은 단계 안의 상·하류는 엣지 방향으로 정하므로(하위 전략처럼
        // 부모 → 자식이 하류) 소속은 뒤집어 읽는다 — 영역을 고르면 그 아래 그룹·프로세스가 하류로 이어진다.
        const flip = e.rel_type === 'PART_OF';
        const edge = { ...e, ...(flip ? { source: e.target, target: e.source } : {}), id: `${e.rel_type}:${e.source}->${e.target}` };
        edges.push(edge);
        adj.get(edge.source).push({ edge, other: edge.target, outgoing: true });
        adj.get(edge.target).push({ edge, other: edge.source, outgoing: false });
    }
    return { nodes, edges, adj };
}

/**
 * 선택 노드의 체인(상류 + 하류).
 * - 하류: 단계가 커지는 이웃으로만 확장(같은 단계는 엣지 방향대로 — 하위 전략, 팀 소속, 스킬 상속).
 * - 상류: 단계가 작아지는 이웃으로만 확장(같은 단계는 엣지 역방향).
 * 단조 확장이라 "사용자 → 그 사용자의 다른 업무"처럼 체인이 폭발하지 않는다.
 * @returns {{ nodes: Set<string>, edges: Set<string> }}
 */
export function lineageOf(index, startId) {
    const nodes = new Set();
    const edges = new Set();
    if (!index.nodes.has(startId)) return { nodes, edges };
    nodes.add(startId);
    walk(index, startId, +1, nodes, edges);
    walk(index, startId, -1, nodes, edges);
    return { nodes, edges };
}

function walk(index, startId, dir, nodes, edges) {
    const seen = new Set([startId]);
    const queue = [startId];
    while (queue.length) {
        const id = queue.shift();
        const stage = index.nodes.get(id).stage;
        for (const { edge, other, outgoing } of index.adj.get(id)) {
            // 상충(CONFLICTS_WITH)은 같은 열의 맞수 관계라 상류·하류가 아니다 — 체인에 넣지 않는다(직접 연결에는 보인다)
            if (edge.rel_type === 'CONFLICTS_WITH') continue;
            const otherStage = index.nodes.get(other).stage;
            const forward = otherStage === stage ? (dir > 0 ? outgoing : !outgoing) : dir > 0 ? otherStage > stage : otherStage < stage;
            if (!forward) continue;
            edges.add(edge.id);
            nodes.add(other);
            if (!seen.has(other)) {
                seen.add(other);
                queue.push(other);
            }
        }
    }
}

/** 전략 노드들에서 하류로 이어지는 모든 노드(기본 보기 = 전략과 연결된 것만). */
export function strategyConnected(index) {
    const nodes = new Set();
    const edges = new Set();
    for (const [id, n] of index.nodes) {
        if (n.stage !== 0) continue;
        nodes.add(id);
        walk(index, id, +1, nodes, edges);
    }
    // 맥락 열(영역·그룹, 시스템·데이터·문서)은 하류 걷기로는 닿지 않는 쪽(그룹은 프로세스의 상류)에도 있다 —
    // 전략과 이어진 노드에 바로 붙은 맥락 노드와, 거기서 위로 이어진 맥락 노드를 더한다.
    const isContext = (id) => STAGES[index.nodes.get(id).stage]?.course === false;
    const queue = [];
    for (const id of [...nodes]) {
        if (isContext(id)) continue;
        for (const { edge, other } of index.adj.get(id)) {
            if (isContext(other) && !nodes.has(other)) {
                nodes.add(other);
                queue.push(other);
            }
            if (isContext(other)) edges.add(edge.id);
        }
    }
    // 맥락 열 안에서는 위로만 번진다(그룹 → 영역, 데이터 → 문서) — 영역을 거쳐 전략과 무관한 그룹까지 퍼지지 않게
    const UPWARD = new Set(['ProcessGroup>ProcessArea', 'DataObject>Document']);
    while (queue.length) {
        const id = queue.shift();
        for (const { edge, other } of index.adj.get(id)) {
            if (!isContext(other) || !UPWARD.has(`${index.nodes.get(id).label}>${index.nodes.get(other).label}`)) continue;
            edges.add(edge.id);
            if (!nodes.has(other)) {
                nodes.add(other);
                queue.push(other);
            }
        }
    }
    return { nodes, edges };
}

// ------------------------------------------------------------------ 지표

/** KPI 달성률(%) — strategy-service 의 achievement 계산과 같은 규칙. */
export function kpiAchievement(p) {
    if (!p) return null;
    const cur = p.current_value;
    const tgt = p.target_value;
    if (cur == null || tgt == null) return null;
    const base = p.baseline_value ?? 0;
    if (p.direction === 'decrease') {
        if (base === tgt) return cur <= tgt ? 100 : 0;
        return Math.round(((base - cur) / (base - tgt)) * 1000) / 10;
    }
    if (base === tgt) return cur >= tgt ? 100 : 0;
    return Math.round(((cur - base) / (tgt - base)) * 1000) / 10;
}

function avg(values) {
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

/**
 * 실행 집계 — 프로세스(인스턴스 수·완료·진행·지연·평균 소요), 태스크(워크아이템 평균 소요·병목),
 * KPI(달성률·상태 단계·연결 프로세스 유무), 전략(하위 KPI 중요도 가중 달성률·상태 단계). 노드 id → 지표 dict.
 * level: 'risk'|'warn'|'ok'|null — thresholds 는 분석 대시보드 KPI RAG 기준값.
 * @param {{ green: number, amber: number }} [thresholds]
 */
export function computeMetrics(index, thresholds = DEFAULT_LEVEL_THRESHOLDS) {
    const metrics = new Map();
    const neighborsOf = (id, label, outgoing) =>
        index.adj
            .get(id)
            .filter((a) => (outgoing == null || a.outgoing === outgoing) && index.nodes.get(a.other).label === label)
            .map((a) => index.nodes.get(a.other));

    for (const [id, n] of index.nodes) {
        if (n.label === 'KPI') {
            const a = kpiAchievement(n.properties);
            const processes = neighborsOf(id, 'Process', false);
            metrics.set(id, {
                achievement: a,
                level: achievementLevel(a, thresholds),
                linked: processes.length > 0,
                processIds: processes.map((p) => p.id)
            });
        }
    }
    for (const [id, n] of index.nodes) {
        if (n.label === 'Strategy') {
            // KPI 하나만 미달이어도 전략 전체를 경보하지 않도록 중요도 가중 평균으로 판정한다
            let sum = 0;
            let weight = 0;
            for (const k of neighborsOf(id, 'KPI', true)) {
                const a = metrics.get(k.id)?.achievement;
                if (a == null) continue;
                const w = Number(k.properties?.importance) || 3;
                sum += a * w;
                weight += w;
            }
            const a = weight ? Math.round((sum / weight) * 10) / 10 : null;
            metrics.set(id, { achievement: a, level: achievementLevel(a, thresholds) });
        } else if (n.label === 'Process') {
            const insts = neighborsOf(id, 'ProcessInstance', true);
            const done = insts.filter((i) => i.properties?.status === 'COMPLETED');
            const durations = done.map((i) => i.properties?.duration_hours).filter((v) => v != null);
            metrics.set(id, {
                instances: insts.length,
                completed: done.length,
                running: insts.length - done.length,
                overdue: insts.filter((i) => i.properties?.is_overdue).length,
                avgHours: avg(durations)
            });
        } else if (n.label === 'Task') {
            const items = neighborsOf(id, 'WorkItem', false);
            const durations = items.map((w) => w.properties?.duration_hours).filter((v) => v != null);
            metrics.set(id, { workItems: items.length, avgHours: avg(durations) });
        }
    }
    // 병목: 같은 프로세스 태스크 중 평균 소요가 가장 길고, 다른 태스크 평균의 1.5배 이상
    for (const [id, n] of index.nodes) {
        if (n.label !== 'Process') continue;
        const tasks = neighborsOf(id, 'Task', true)
            .map((t) => ({ id: t.id, h: metrics.get(t.id)?.avgHours }))
            .filter((t) => t.h != null);
        if (tasks.length < 2) continue;
        tasks.sort((a, b) => b.h - a.h);
        const restAvg = avg(tasks.slice(1).map((t) => t.h));
        if (restAvg != null && tasks[0].h >= restAvg * 1.5 && tasks[0].h > 0) {
            metrics.get(tasks[0].id).bottleneck = true;
            metrics.get(id).bottleneckTaskId = tasks[0].id;
        }
    }
    return metrics;
}

// ------------------------------------------------------------------ 배치

/** 단계별 카드 높이(px). */
// 열별 카드 높이(열 키 기준) — 지표가 두 줄인 열은 높게, 수백 건인 열은 낮게
const CARD_HEIGHT_BY_KEY = { strategy: 64, kpi: 64, process: 64, architecture: 48, task: 48, asset: 48, instance: 48 };
export function cardHeight(stage) {
    return CARD_HEIGHT_BY_KEY[STAGES[stage]?.key] ?? 40;
}
/** 접힌 단계 열의 폭(px) — 카드 대신 개수와 펼치기 버튼만 보인다. */
export const COLLAPSED_WIDTH = 44;
export const CARD_GAP = 8;

/**
 * 워터폴 배치. 단계별 열, 열 안에서는 상류 이웃 위치의 평균(barycenter)으로 정렬해
 * 교차를 줄인다. 전략 열은 하위 전략 깊이만큼 들여쓴다.
 * @param visibleIds 표시할 노드 id 집합
 * @param visibleStages 표시할 단계 index 배열(오름차순)
 * @param {{ colWidth?: number, colGap?: number, top?: number, collapsed?: Set<number>, pinFirst?: Set<string> }} [opts]
 *   pinFirst: 각 열의 맨 위로 올릴 노드(코스) — 코스가 한 줄로 가로질러 읽히게 한다.
 * @returns {{ positions: Map<string,{x,y,w,h,depth}>, columns: {stage:number,x:number,count:number,collapsed:boolean,width:number}[], width:number, height:number }}
 */
export function layoutWaterfall(
    index,
    visibleIds,
    visibleStages,
    { colWidth = 200, colGap = 44, top = 0, collapsed = new Set(), pinFirst = new Set() } = {}
) {
    const byStage = new Map(visibleStages.map((s) => [s, []]));
    for (const id of visibleIds) {
        const n = index.nodes.get(id);
        if (n && byStage.has(n.stage)) byStage.get(n.stage).push(n);
    }

    const order = new Map(); // id → 열 내 순번
    const depthOf = strategyDepths(index);
    const positions = new Map();
    const columns = [];
    let height = top;
    let x = 0;

    visibleStages.forEach((stage) => {
        const list = byStage.get(stage);
        if (collapsed.has(stage)) {
            // 접힌 단계: 카드는 배치하지 않고 좁은 열 자리만 둔다(엣지는 이 단계를 건너뛴다)
            columns.push({ stage, x, count: list.length, collapsed: true, width: COLLAPSED_WIDTH });
            x += COLLAPSED_WIDTH + colGap;
            return;
        }
        // 1차 키: 가장 가까운 상류 단계 이웃의 평균 순번(예: 워크아이템은 인스턴스별로 묶인다)
        // 2차 키: 그보다 먼 상류 이웃의 평균 순번(같은 인스턴스 안에서는 태스크 순서)
        const score = (n) => {
            const ups = index.adj
                .get(n.id)
                .map((a) => a.other)
                .filter((o) => order.has(o) && index.nodes.get(o).stage < stage);
            if (!ups.length) return [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
            const nearest = Math.max(...ups.map((o) => index.nodes.get(o).stage));
            const near = ups.filter((o) => index.nodes.get(o).stage === nearest);
            const far = ups.filter((o) => index.nodes.get(o).stage !== nearest);
            return [avg(near.map((o) => order.get(o))), far.length ? avg(far.map((o) => order.get(o))) : 0];
        };
        if (stage === 0) {
            list.sort((a, b) => (depthOf.path.get(a.id) || '').localeCompare(depthOf.path.get(b.id) || ''));
            // 전략 트리 순서는 유지하되, 코스가 지나는 전략 가지를 맨 위로
            if (pinFirst.size) list.sort((a, b) => Number(pinFirst.has(b.id)) - Number(pinFirst.has(a.id)));
        } else {
            const scores = new Map(list.map((n) => [n.id, score(n)]));
            list.sort(
                (a, b) =>
                    Number(pinFirst.has(b.id)) - Number(pinFirst.has(a.id)) ||
                    scores.get(a.id)[0] - scores.get(b.id)[0] ||
                    scores.get(a.id)[1] - scores.get(b.id)[1] ||
                    String(a.properties?.start_date || '').localeCompare(String(b.properties?.start_date || '')) ||
                    String(a.name || '').localeCompare(String(b.name || ''), 'ko')
            );
        }
        const h = cardHeight(stage);
        let y = top;
        list.forEach((n, i) => {
            order.set(n.id, i);
            // 하위 전략 들여쓰기는 단계당 8px — 카드 폭을 지켜 이름이 덜 잘리게
            const depth = stage === 0 ? Math.min(depthOf.depth.get(n.id) || 0, 3) : 0;
            positions.set(n.id, { x: x + depth * 8, y, w: colWidth - depth * 8, h, depth });
            y += h + CARD_GAP;
        });
        columns.push({ stage, x, count: list.length, collapsed: false, width: colWidth });
        x += colWidth + colGap;
        height = Math.max(height, y);
    });

    const width = Math.max(0, x - colGap);
    return { positions, columns, width, height };
}

/** 하위 전략 깊이와 트리 정렬 키(부모 경로). 순환은 끊는다. */
function strategyDepths(index) {
    const parents = new Map();
    for (const e of index.edges) {
        if (e.rel_type === 'HAS_SUB_STRATEGY') {
            if (!parents.has(e.target)) parents.set(e.target, []);
            parents.get(e.target).push(e.source);
        }
    }
    const depth = new Map();
    const path = new Map();
    const resolve = (id, seen) => {
        if (path.has(id)) return path.get(id);
        const n = index.nodes.get(id);
        const own = `${String(n?.properties?.sort_order ?? 0).padStart(4, '0')}:${n?.name || id}`;
        const parent = (parents.get(id) || []).find((p) => index.nodes.has(p) && !seen.has(p));
        if (!parent) {
            depth.set(id, 0);
            path.set(id, own);
            return own;
        }
        seen.add(id);
        const p = `${resolve(parent, seen)}/${own}`;
        depth.set(id, (depth.get(parent) || 0) + 1);
        path.set(id, p);
        return p;
    };
    for (const [id, n] of index.nodes) if (n.stage === 0) resolve(id, new Set());
    return { depth, path };
}

/** 체인 요약 — 단계별 노드 수. */
export function stageCounts(index, ids) {
    const counts = STAGES.map(() => 0);
    for (const id of ids) {
        const n = index.nodes.get(id);
        if (n) counts[n.stage] += 1;
    }
    return counts;
}

// ------------------------------------------------------------------ 코스(결정적 경로)

// 같은 단계 후보 중 "가장 나쁜" 것을 고르는 순위 — 코스는 원인 추적의 지름길을 보여 준다.
function worstFirst(metrics) {
    const props = (n) => n.properties || {};
    const score = (n) => {
        const m = metrics.get(n.id) || {};
        const p = props(n);
        switch (n.label) {
            case 'Strategy':
            case 'KPI':
                // 연결된 KPI 우선, 달성률 낮은 순
                return [m.linked === false ? 1 : 0, m.achievement ?? Number.POSITIVE_INFINITY];
            case 'Process':
                return [-(m.overdue || 0), -(m.avgHours || 0)];
            case 'Task':
                return [m.bottleneck ? 0 : 1, -(m.avgHours || 0)];
            case 'ProcessInstance':
            case 'WorkItem':
                return [p.is_overdue ? 0 : 1, -(p.duration_hours || 0)];
            default:
                return [0, 0];
        }
    };
    return (a, b) => {
        const sa = score(a);
        const sb = score(b);
        return sa[0] - sb[0] || sa[1] - sb[1] || String(a.name || '').localeCompare(String(b.name || ''), 'ko');
    };
}

/**
 * 선택 노드를 지나는 코스 — 체인 안에서 단계마다 가장 나쁜 노드 하나씩을 골라 상류(전략)부터 하류(스킬)까지 잇는다.
 * 전략을 고르면 체인에서 가장 나쁜 KPI 를 축으로 삼는다. 태스크 다음에는 그 태스크를 수행한 가장 나쁜
 * 워크아이템과 그 인스턴스를 넣어 단계 순서(태스크→인스턴스→워크아이템)를 지킨다.
 * @returns {string[]} 노드 id 순서(1번 = 가장 상류)
 */
export function coursePath(index, metrics, selectedId) {
    if (!index.nodes.has(selectedId)) return [];
    const chain = lineageOf(index, selectedId).nodes;
    const order = worstFirst(metrics);
    const node = (id) => index.nodes.get(id);
    // 맥락 열(course=false)은 코스 지점이 되지 않는다 — 선택한 노드 자신만 예외
    const onCourse = (st) => STAGES[st]?.course !== false;
    const neighbors = (id, pred) =>
        index.adj
            .get(id)
            .map((a) => ({ ...a, n: node(a.other) }))
            .filter((a) => chain.has(a.other) && onCourse(a.n.stage) && pred(a));

    let pivot = selectedId;
    if (node(selectedId).stage === 0) {
        const kpis = [...chain].map(node).filter((n) => n.label === 'KPI');
        if (kpis.length) pivot = kpis.sort(order)[0].id;
    }

    // 상류: 바로 아래 단계(같은 단계면 하위 전략의 부모) 중 가장 나쁜 것
    const up = [];
    let cur = pivot;
    for (let guard = 0; guard < 16; guard++) {
        const st = node(cur).stage;
        const cands = neighbors(cur, (a) => a.n.stage < st || (a.n.stage === st && st === 0 && !a.outgoing));
        if (!cands.length) break;
        const top = Math.max(...cands.map((a) => a.n.stage));
        const next = cands
            .filter((a) => a.n.stage === top)
            .map((a) => a.n)
            .sort(order)[0];
        if (up.includes(next.id) || next.id === pivot) break;
        up.unshift(next.id);
        cur = next.id;
    }

    // 하류: 다음 단계 중 가장 나쁜 것
    const down = [];
    cur = pivot;
    for (let guard = 0; guard < 16; guard++) {
        const st = node(cur).stage;
        const cands = neighbors(cur, (a) => a.n.stage > st);
        if (!cands.length) break;
        const low = Math.min(...cands.map((a) => a.n.stage));
        let next = cands
            .filter((a) => a.n.stage === low)
            .map((a) => a.n)
            .sort(order)[0];
        if (next.label === 'Task') {
            down.push(next.id);
            const items = neighbors(next.id, (a) => a.n.label === 'WorkItem').map((a) => a.n);
            if (!items.length) {
                cur = next.id;
                continue;
            }
            const wi = items.sort(order)[0];
            const inst = index.adj.get(wi.id).find((a) => node(a.other).label === 'ProcessInstance' && !a.outgoing);
            if (inst) down.push(inst.other);
            next = wi;
        }
        if (down.includes(next.id)) break;
        down.push(next.id);
        cur = next.id;
    }
    return [...up, pivot, ...down].filter((id, i, arr) => arr.indexOf(id) === i);
}
