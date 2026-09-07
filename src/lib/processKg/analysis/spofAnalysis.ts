/**
 * spofAnalysis — 그래프 지표 기반 SPOF/구조적 결함 후보 산출 (순수 함수).
 *
 * src/composables/ontology/spofAnalyzer.ts 의 Tarjan 관절점 분석을
 * ProcessGraph/InsightCard 체계로 번안한 모듈 (specs/002 data-model §2).
 *  - SPOF: 관절점(articulation point) — 제거 시 그래프가 분리되는 노드
 *  - StructuralDefect: 과도한 fan-in/fan-out(병목) 노드
 * 각 후보에 impactedProcessCount(도달 가능 ProcessActivity 수)·fte 지표를 계산해
 * metrics 에 담는다. 레거시와 달리 graph 를 변이하지 않는다(순수 함수).
 */
import type { GraphEdge, GraphNode, ProcessGraph } from "../graph/types";
import {
  buildGraphIndex,
  type GraphIndex,
  getNodeLabel,
} from "./graphIndex";
import type { InsightCard } from "./types";

// 게이트웨이 축약으로 인접이 pairwise 확장되어 degree가 부풀므로 임계값을 보수적으로 잡는다.
// Organization 허브는 설계상 고차수(모든 소속 활동 연결)라 관절점(SPOF) 판정에서 제외해
// 위험 표시가 실제 구조 리스크에 집중되게 한다(레거시의 Role 제외 규칙에 대응).
const BOTTLENECK_DEGREE = 8;

type SpofRiskType = "SPOF" | "StructuralDefect";

function buildAdjacency(graph: ProcessGraph): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    if (!adj.has(a)) adj.set(a, new Set());
    adj.get(a)!.add(b);
  };
  for (const n of graph.nodes) if (!adj.has(n.id)) adj.set(n.id, new Set());
  for (const e of graph.edges) {
    if (e.source === e.target) continue;
    link(e.source, e.target);
    link(e.target, e.source);
  }
  return adj;
}

/** Tarjan 기반 관절점 탐색(무방향, 반복 DFS — 스택 오버플로 방지). */
function findArticulationPoints(adj: Map<string, Set<string>>): Set<string> {
  const ids = Array.from(adj.keys());
  const disc = new Map<string, number>();
  const low = new Map<string, number>();
  const visited = new Set<string>();
  const aps = new Set<string>();
  let timer = 0;

  const dfs = (root: string) => {
    const stack: Array<{
      u: string;
      parent: string | null;
      iter: Iterator<string>;
      children: number;
    }> = [];
    visited.add(root);
    disc.set(root, timer);
    low.set(root, timer);
    timer++;
    stack.push({
      u: root,
      parent: null,
      iter: (adj.get(root) ?? new Set<string>()).values(),
      children: 0,
    });

    while (stack.length) {
      const frame = stack[stack.length - 1];
      const next = frame.iter.next();
      if (!next.done) {
        const v = next.value;
        if (v === frame.parent) continue;
        if (!visited.has(v)) {
          visited.add(v);
          disc.set(v, timer);
          low.set(v, timer);
          timer++;
          frame.children++;
          stack.push({
            u: v,
            parent: frame.u,
            iter: (adj.get(v) ?? new Set<string>()).values(),
            children: 0,
          });
        } else {
          low.set(frame.u, Math.min(low.get(frame.u)!, disc.get(v)!));
        }
      } else {
        stack.pop();
        const parentFrame = stack[stack.length - 1];
        if (parentFrame) {
          low.set(
            parentFrame.u,
            Math.min(low.get(parentFrame.u)!, low.get(frame.u)!),
          );
          if (
            parentFrame.parent !== null &&
            low.get(frame.u)! >= disc.get(parentFrame.u)!
          ) {
            aps.add(parentFrame.u);
          }
        }
        if (frame.parent === null && frame.children > 1) {
          aps.add(frame.u);
        }
      }
    }
  };

  for (const id of ids) if (!visited.has(id)) dfs(id);
  return aps;
}

/** focus 노드에서 무방향 도달 가능한 ProcessActivity id 집합(자기 자신 제외). */
function reachableActivityIds(
  index: GraphIndex,
  startId: string,
  adj: Map<string, Set<string>>,
): Set<string> {
  const visited = new Set<string>([startId]);
  const queue = [startId];
  const activities = new Set<string>();
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur !== startId && index.nodesById.get(cur)?.type === "ProcessActivity") {
      activities.add(cur);
    }
    for (const nb of adj.get(cur) ?? []) {
      if (!visited.has(nb)) {
        visited.add(nb);
        queue.push(nb);
      }
    }
  }
  return activities;
}

/**
 * 후보 노드 FTE 추정 — 영향 활동에 실제 FTEProfile(hasFTEProfile)이 있으면
 * headcount 합계를 사용하고, 없으면 레거시 휴리스틱
 * (System 1.5 / Organization 2 / 기타 1 + impacted*0.5)으로 근사한다.
 */
function estimateFte(
  index: GraphIndex,
  node: GraphNode,
  impactedActivityIds: Set<string>,
): number {
  let headcountSum = 0;
  let hasProfile = false;
  for (const activityId of impactedActivityIds) {
    for (const edge of index.outgoingByNodeId.get(activityId) ?? []) {
      if (edge.type !== "hasFTEProfile") continue;
      const profile = index.nodesById.get(edge.target);
      if (!profile) continue;
      hasProfile = true;
      const headcount = profile.properties.headcount;
      if (typeof headcount === "number" && Number.isFinite(headcount)) {
        headcountSum += headcount;
      }
    }
  }
  if (hasProfile) return Math.round(headcountSum * 10) / 10;

  const base =
    node.type === "System" ? 1.5 : node.type === "Organization" ? 2 : 1;
  return Math.round((base + impactedActivityIds.size * 0.5) * 10) / 10;
}

/** 후보 노드 + 인접 엣지 최대 5개를 근거로 수집(자기 루프 제외). */
function buildSpofEvidence(
  index: GraphIndex,
  nodeId: string,
): { nodeIds: string[]; edgeIds: string[]; summary: string } {
  const nodeIds = new Set<string>([nodeId]);
  const edgeIds = new Set<string>();
  const neighborEdges: GraphEdge[] = [
    ...(index.outgoingByNodeId.get(nodeId) ?? []),
    ...(index.incomingByNodeId.get(nodeId) ?? []),
  ].filter((edge) => edge.source !== edge.target);

  for (const edge of neighborEdges) {
    if (edgeIds.size >= 5) break;
    edgeIds.add(edge.id);
    nodeIds.add(edge.source);
    nodeIds.add(edge.target);
  }

  return {
    nodeIds: [...nodeIds],
    edgeIds: [...edgeIds],
    summary:
      "단일 장애점/구조 결함 후보 근거: 해당 노드와 대표 인접 연결(최대 5개)만 포함합니다.",
  };
}

function buildReasons(
  riskType: SpofRiskType,
  degree: number,
  impacted: number,
  fte: number,
): string[] {
  const reasons: string[] = [];
  if (riskType === "SPOF") {
    reasons.push(
      "이 노드는 관절점(articulation point)으로, 제거 시 그래프가 분리되는 단일 장애점 후보입니다.",
    );
    reasons.push(`무방향 연결 차수가 ${degree}개로 여러 경로가 이 노드를 경유합니다.`);
  } else {
    reasons.push(
      `유입·유출 연결이 ${degree}개로 임계값(${BOTTLENECK_DEGREE}) 이상인 과밀 활동입니다.`,
    );
  }
  reasons.push(`영향 범위 내 도달 가능한 업무 활동이 ${impacted}개입니다.`);
  reasons.push(`추정 FTE 규모는 약 ${fte}입니다.`);
  return reasons;
}

function buildSpofMarkdown(
  label: string,
  riskType: SpofRiskType,
  impacted: number,
  fte: number,
): string {
  const conclusion =
    riskType === "SPOF"
      ? "**결론:** 이 노드는 **단일 장애점(SPOF) 후보**입니다."
      : "**결론:** 이 노드는 **구조적 결함(과밀 연결) 후보**입니다.";
  const interpretation =
    riskType === "SPOF"
      ? "그래프 구조상 이 노드가 제거되면 연결이 분리되는 관절점이라, 장애 시 다수 업무 흐름이 단절될 가능성이 있습니다."
      : "그래프 구조상 유입·유출 연결이 과도하게 집중되어 있어, 처리 지연이나 변경 파급이 커질 가능성이 있습니다.";

  return [
    `### ${label}`,
    "",
    conclusion,
    "",
    `**영향 업무 활동 수:** ${impacted}`,
    "",
    `**추정 FTE:** ${fte}`,
    "",
    "**해석:**",
    interpretation,
    "",
    "**주의:**",
    "이 결과는 실행 데이터(장애 이력, 처리시간, SLA) 없이 위험을 확정할 수 없습니다. 구조 기반 후보입니다.",
    "",
    "**권장 후속 조치:**",
    "도메인 담당자와 후보 근거를 검토하고, 가능하면 장애 이력·운영 로그로 실제 위험도를 검증하세요.",
  ].join("\n");
}

export function rankSpofCandidates(
  graph: ProcessGraph,
  options: { limit?: number } = {},
  index?: GraphIndex,
): InsightCard[] {
  const limit = options.limit ?? 10;
  const resolvedIndex = index ?? buildGraphIndex(graph);

  const adj = buildAdjacency(graph);
  const aps = findArticulationPoints(adj);

  const cards: InsightCard[] = [];
  for (const node of graph.nodes) {
    const degree = (adj.get(node.id) ?? new Set()).size;
    const inOutDegree =
      (resolvedIndex.incomingByNodeId.get(node.id)?.length ?? 0) +
      (resolvedIndex.outgoingByNodeId.get(node.id)?.length ?? 0);

    const isSpof =
      node.type !== "Organization" && aps.has(node.id) && degree >= 2;
    const isBottleneck =
      node.type === "ProcessActivity" && inOutDegree >= BOTTLENECK_DEGREE;
    if (!isSpof && !isBottleneck) continue;

    const riskType: SpofRiskType = isSpof ? "SPOF" : "StructuralDefect";
    const impactedIds = reachableActivityIds(resolvedIndex, node.id, adj);
    const impacted = impactedIds.size;
    const fte = estimateFte(resolvedIndex, node, impactedIds);
    const label = getNodeLabel(node);
    const evidence = buildSpofEvidence(resolvedIndex, node.id);

    cards.push({
      id: `spof-${node.id}`,
      category: "spof",
      title:
        riskType === "SPOF"
          ? `단일 장애점 후보: ${label}`
          : `구조적 결함 후보: ${label}`,
      answer:
        riskType === "SPOF"
          ? `이 노드는 단일 장애점(SPOF) 후보입니다. 영향 업무 활동은 ${impacted}개입니다.`
          : `이 노드는 구조적 결함(과밀 연결) 후보입니다. 영향 업무 활동은 ${impacted}개입니다.`,
      explanation:
        "무방향 그래프의 관절점과 연결 차수를 기반으로 산출한 구조적 후보입니다. 실행 데이터 없이 위험 여부를 확정할 수 없습니다.",
      severity: riskType === "SPOF" ? "high" : "medium",
      score: impacted,
      reasons: buildReasons(riskType, riskType === "SPOF" ? degree : inOutDegree, impacted, fte),
      metrics: {
        nodeId: node.id,
        riskType,
        impactedProcessCount: impacted,
        fte,
      },
      evidence,
      markdown: buildSpofMarkdown(label, riskType, impacted, fte),
    });
  }

  const ranked = cards
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, limit);

  return ranked.map((card, i) => ({ ...card, rank: i + 1 }));
}

export { BOTTLENECK_DEGREE };
