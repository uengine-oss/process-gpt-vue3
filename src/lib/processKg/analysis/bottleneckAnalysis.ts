import type { ProcessGraph } from "../graph/types";
import {
  HANDOFF_BPMN_TYPES,
  isManualActivity,
} from "./competencyQuestions";
import {
  buildGraphIndex,
  type GraphIndex,
  getNodeLabel,
  getOutgoing,
  getTargets,
} from "./graphIndex";
import type { BottleneckMetrics, InsightCard, ScoreBreakdownItem } from "./types";

const SCORE_WEIGHTS = {
  activity: 1.0,
  gateway: 2.0,
  handoff: 2.5,
  organization: 2.0,
  supplier: 3.0,
  system: 1.5,
  manual: 2.0,
  dataStore: 1.0,
} as const;

function isHandoffActivity(
  index: ReturnType<typeof buildGraphIndex>,
  activityId: string,
): boolean {
  const node = index.nodesById.get(activityId);
  if (!node) return false;
  const bpmnType = node.properties.bpmnType;
  if (typeof bpmnType === "string" && HANDOFF_BPMN_TYPES.has(bpmnType)) {
    return true;
  }
  if (node.properties.definitionId) return true;
  return false;
}

export function computeBottleneckMetrics(
  graph: ProcessGraph,
  processId: string,
  index?: GraphIndex,
): BottleneckMetrics {
  const resolvedIndex = index ?? buildGraphIndex(graph);

  const activities = getTargets(resolvedIndex, processId, "hasActivity");
  const gateways = getTargets(resolvedIndex, processId, "containsElement").filter(
    (n) => n.type === "Gateway",
  );
  const events = getTargets(resolvedIndex, processId, "containsElement").filter(
    (n) => n.type === "Event",
  );

  let handoffTaskCount = 0;
  for (const activity of activities) {
    if (isHandoffActivity(resolvedIndex, activity.id)) handoffTaskCount += 1;
  }
  for (const event of events) {
    if (event.properties.definitionId) handoffTaskCount += 1;
  }

  const organizations = getTargets(
    resolvedIndex,
    processId,
    "performedByOrganization",
  );
  const suppliers = getTargets(resolvedIndex, processId, "performedBySupplier");
  const systems = getTargets(resolvedIndex, processId, "usesSystem");
  const dataStores = getTargets(resolvedIndex, processId, "referencesDataStore");

  let manualActivityCount = 0;
  for (const activity of activities) {
    if (isManualActivity(resolvedIndex, activity.id)) manualActivityCount += 1;
  }

  return {
    activityCount: activities.length,
    gatewayCount: gateways.length,
    handoffTaskCount,
    organizationCount: organizations.length,
    supplierCount: suppliers.length,
    systemCount: systems.length,
    manualActivityCount,
    dataStoreCount: dataStores.length,
  };
}

export function computeBottleneckScore(metrics: BottleneckMetrics): number {
  return (
    metrics.activityCount * SCORE_WEIGHTS.activity +
    metrics.gatewayCount * SCORE_WEIGHTS.gateway +
    metrics.handoffTaskCount * SCORE_WEIGHTS.handoff +
    metrics.organizationCount * SCORE_WEIGHTS.organization +
    metrics.supplierCount * SCORE_WEIGHTS.supplier +
    metrics.systemCount * SCORE_WEIGHTS.system +
    metrics.manualActivityCount * SCORE_WEIGHTS.manual +
    metrics.dataStoreCount * SCORE_WEIGHTS.dataStore
  );
}

export function computeBottleneckScoreBreakdown(
  metrics: BottleneckMetrics,
): ScoreBreakdownItem[] {
  return [
    {
      group: "activityComplexity",
      labelKo: "업무 복잡도 (Activity complexity)",
      points: metrics.activityCount * SCORE_WEIGHTS.activity,
      detail: `업무 단계 ${metrics.activityCount}개 × ${SCORE_WEIGHTS.activity}`,
    },
    {
      group: "decisionComplexity",
      labelKo: "판단/분기 복잡도 (Decision complexity)",
      points: metrics.gatewayCount * SCORE_WEIGHTS.gateway,
      detail: `분기·판단 지점 ${metrics.gatewayCount}개 × ${SCORE_WEIGHTS.gateway}`,
    },
    {
      group: "handoffComplexity",
      labelKo: "Handoff 복잡도 (Handoff complexity)",
      points: metrics.handoffTaskCount * SCORE_WEIGHTS.handoff,
      detail: `전달·연계 작업 ${metrics.handoffTaskCount}개 × ${SCORE_WEIGHTS.handoff}`,
    },
    {
      group: "coordinationComplexity",
      labelKo: "조율 복잡도 (Coordination complexity)",
      points:
        metrics.organizationCount * SCORE_WEIGHTS.organization +
        metrics.supplierCount * SCORE_WEIGHTS.supplier,
      detail: `조직 ${metrics.organizationCount}개 × ${SCORE_WEIGHTS.organization} + 공급사 ${metrics.supplierCount}개 × ${SCORE_WEIGHTS.supplier}`,
    },
    {
      group: "manualBurden",
      labelKo: "수작업 부담 (Manual burden)",
      points: metrics.manualActivityCount * SCORE_WEIGHTS.manual,
      detail: `수작업 중심 단계 ${metrics.manualActivityCount}개 × ${SCORE_WEIGHTS.manual}`,
    },
    {
      group: "systemDataDependency",
      labelKo: "시스템·데이터 의존 (System/Data dependency)",
      points:
        metrics.systemCount * SCORE_WEIGHTS.system +
        metrics.dataStoreCount * SCORE_WEIGHTS.dataStore,
      detail: `시스템 ${metrics.systemCount}개 × ${SCORE_WEIGHTS.system} + 데이터저장소 ${metrics.dataStoreCount}개 × ${SCORE_WEIGHTS.dataStore}`,
    },
  ];
}

function buildReasons(metrics: BottleneckMetrics): string[] {
  const reasons: string[] = [];
  if (metrics.activityCount > 0) {
    reasons.push(
      `업무 단계가 ${metrics.activityCount}개로 많아 프로세스 구조가 복잡합니다.`,
    );
  }
  if (metrics.gatewayCount > 0) {
    reasons.push(
      `분기·판단 지점이 ${metrics.gatewayCount}개 있어 의사결정 경로가 많습니다.`,
    );
  }
  if (metrics.handoffTaskCount > 0) {
    reasons.push(
      `전달·연계 작업이 ${metrics.handoffTaskCount}개 있어 부서/시스템 간 인계가 잦을 수 있습니다.`,
    );
  }
  if (metrics.organizationCount > 0) {
    reasons.push(`관여 조직이 ${metrics.organizationCount}개입니다.`);
  }
  if (metrics.supplierCount > 0) {
    reasons.push(`관여 공급사가 ${metrics.supplierCount}개입니다.`);
  }
  if (metrics.systemCount > 0) {
    reasons.push(`연결된 시스템이 ${metrics.systemCount}개입니다.`);
  }
  if (metrics.manualActivityCount > 0) {
    reasons.push(
      `수작업 중심 단계가 ${metrics.manualActivityCount}개 있어 자동화 여지를 검토할 수 있습니다.`,
    );
  }
  if (metrics.dataStoreCount > 0) {
    reasons.push(`참조 데이터저장소가 ${metrics.dataStoreCount}개입니다.`);
  }
  return reasons;
}

function buildBottleneckEvidence(
  index: ReturnType<typeof buildGraphIndex>,
  processId: string,
): { nodeIds: string[]; edgeIds: string[]; summary: string } {
  const nodeIds = new Set<string>([processId]);
  const edgeIds = new Set<string>();

  const addCategoryEdges = (edgeType: Parameters<typeof getOutgoing>[2], limit: number) => {
    for (const edge of getOutgoing(index, processId, edgeType).slice(0, limit)) {
      edgeIds.add(edge.id);
      nodeIds.add(edge.source);
      nodeIds.add(edge.target);
    }
  };

  addCategoryEdges("usesSystem", 3);
  addCategoryEdges("performedByOrganization", 3);
  addCategoryEdges("performedBySupplier", 3);

  const activities = getTargets(index, processId, "hasActivity");
  let repCount = 0;
  for (const activity of activities) {
    if (repCount >= 3) break;
    if (
      isHandoffActivity(index, activity.id) ||
      isManualActivity(index, activity.id)
    ) {
      nodeIds.add(activity.id);
      repCount += 1;
    }
  }

  return {
    nodeIds: [...nodeIds],
    edgeIds: [...edgeIds],
    summary:
      "구조적 병목 후보 근거: 프로세스와 대표 시스템·조직·공급사 연결, 수작업·전달 작업 예시만 포함합니다.",
  };
}

function buildBottleneckMarkdown(
  processLabel: string,
  score: number,
  metrics: BottleneckMetrics,
  breakdown: ScoreBreakdownItem[],
): string {
  const breakdownLines = breakdown
    .filter((item) => item.points > 0)
    .map((item) => `- ${item.labelKo}: ${item.points.toFixed(1)} (${item.detail})`);

  return [
    `### ${processLabel}`,
    "",
    "**결론:** 이 프로세스는 **구조적 병목 후보**입니다.",
    "",
    `**종합 점수:** ${score.toFixed(1)}`,
    "",
    "**점수 구성:**",
    ...breakdownLines,
    "",
    "**해석:**",
    "BPMN 모델 구조상 업무 단계, 분기, 전달 작업, 다주체 관여가 많아 조율 비용과 복잡도가 높을 가능성이 있습니다.",
    "",
    "**주의:**",
    "이 결과는 실행 데이터(처리시간, 대기시간, SLA, 티켓량) 없이 병목을 확정할 수 없습니다. 구조적 병목 후보입니다.",
    "",
    "**권장 후속 조치:**",
    "도메인 담당자와 후보 근거를 검토하고, 가능하면 운영 로그·티켓·SLA 데이터로 우선순위를 검증하세요.",
  ].join("\n");
}

function severityFromScore(score: number): "info" | "medium" | "high" {
  if (score >= 100) return "high";
  if (score >= 40) return "medium";
  return "info";
}

export function rankStructuralBottleneckCandidates(
  graph: ProcessGraph,
  options?: { limit?: number },
  index?: GraphIndex,
): InsightCard[] {
  const limit = options?.limit ?? 10;
  const resolvedIndex = index ?? buildGraphIndex(graph);
  const processes = resolvedIndex.nodesByType.get("Process") ?? [];

  const ranked = processes
    .map((process) => {
      const metrics = computeBottleneckMetrics(graph, process.id, resolvedIndex);
      const score = computeBottleneckScore(metrics);
      const processLabel = getNodeLabel(process);
      const reasons = buildReasons(metrics);
      const scoreBreakdown = computeBottleneckScoreBreakdown(metrics);
      const evidence = buildBottleneckEvidence(resolvedIndex, process.id);

      const metricsRecord: Record<string, number | string> = {
        "종합 점수": score.toFixed(1),
        "업무 단계 수": metrics.activityCount,
        "분기·판단 지점": metrics.gatewayCount,
        "전달·연계 작업": metrics.handoffTaskCount,
        "관여 조직": metrics.organizationCount,
        "관여 공급사": metrics.supplierCount,
        "연결 시스템": metrics.systemCount,
        "수작업 중심 단계": metrics.manualActivityCount,
        "참조 데이터저장소": metrics.dataStoreCount,
      };

      const card: InsightCard = {
        id: `bottleneck-${process.id}`,
        category: "bottleneck",
        title: `구조적 병목 후보: ${processLabel}`,
        answer: `이 프로세스는 구조적 병목 후보입니다. 구조 점수는 ${score.toFixed(1)}점입니다.`,
        explanation:
          "BPMN 모델 구조(업무 단계, 분기, 전달 작업, 조직·공급사·시스템 관여)를 합산한 후보 점수입니다. 실행 데이터 없이 병목 여부를 확정할 수 없습니다.",
        severity: severityFromScore(score),
        score,
        reasons,
        metrics: metricsRecord,
        scoreBreakdown,
        evidence,
        markdown: buildBottleneckMarkdown(
          processLabel,
          score,
          metrics,
          scoreBreakdown,
        ),
      };
      return card;
    })
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, limit);

  return ranked.map((card, i) => ({ ...card, rank: i + 1 }));
}

export {
  SCORE_WEIGHTS,
  isHandoffActivity,
  buildReasons,
  buildBottleneckEvidence,
};
