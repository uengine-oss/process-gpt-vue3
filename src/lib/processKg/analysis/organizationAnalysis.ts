import type { GraphEdge, ProcessGraph } from "../graph/types";
import {
  HANDOFF_BPMN_TYPES,
  isManualActivity,
} from "./competencyQuestions";
import {
  buildGraphIndex,
  findParentProcessId,
  getIncoming,
  getNodeLabel,
  getOutgoing,
  getTargets,
  type GraphIndex,
} from "./graphIndex";
import type {
  InsightCard,
  OrganizationInsightMetrics,
  ScoreBreakdownItem,
} from "./types";

const SCORE_WEIGHTS = {
  process: 3.0,
  activity: 0.5,
  handoff: 2.5,
  coOrganization: 2.0,
  system: 1.5,
  supplier: 2.0,
  manual: 2.0,
} as const;

function isHandoffActivity(index: GraphIndex, activityId: string): boolean {
  const node = index.nodesById.get(activityId);
  if (!node) return false;
  const bpmnType = node.properties.bpmnType;
  if (typeof bpmnType === "string" && HANDOFF_BPMN_TYPES.has(bpmnType)) {
    return true;
  }
  return Boolean(node.properties.definitionId);
}

function getLanesForOrganization(
  index: GraphIndex,
  organizationId: string,
): Set<string> {
  const lanes = new Set<string>();
  for (const edge of getIncoming(
    index,
    organizationId,
    "performedByOrganization",
  )) {
    if (index.nodesById.get(edge.source)?.type === "Lane") {
      lanes.add(edge.source);
    }
  }
  return lanes;
}

export function getActivitiesForOrganization(
  index: GraphIndex,
  organizationId: string,
): Set<string> {
  const activities = new Set<string>();

  for (const edge of getIncoming(
    index,
    organizationId,
    "performedByOrganization",
  )) {
    if (index.nodesById.get(edge.source)?.type === "ProcessActivity") {
      activities.add(edge.source);
    }
  }

  for (const laneId of getLanesForOrganization(index, organizationId)) {
    for (const edge of getIncoming(index, laneId, "assignedToLane")) {
      if (index.nodesById.get(edge.source)?.type === "ProcessActivity") {
        activities.add(edge.source);
      }
    }
  }

  return activities;
}

export function getProcessesForOrganization(
  index: GraphIndex,
  organizationId: string,
): Set<string> {
  const processes = new Set<string>();

  for (const edge of getIncoming(
    index,
    organizationId,
    "performedByOrganization",
  )) {
    if (index.nodesById.get(edge.source)?.type === "Process") {
      processes.add(edge.source);
    }
  }

  for (const activityId of getActivitiesForOrganization(index, organizationId)) {
    const processId = findParentProcessId(index, activityId);
    if (processId) processes.add(processId);
  }

  return processes;
}

function getOrganizationsOnProcess(
  index: GraphIndex,
  processId: string,
): Set<string> {
  const organizations = new Set<string>();

  for (const edge of getOutgoing(index, processId, "performedByOrganization")) {
    organizations.add(edge.target);
  }

  for (const activity of getTargets(index, processId, "hasActivity")) {
    for (const orgEdge of getOutgoing(
      index,
      activity.id,
      "performedByOrganization",
    )) {
      organizations.add(orgEdge.target);
    }
    for (const laneEdge of getOutgoing(index, activity.id, "assignedToLane")) {
      for (const orgEdge of getOutgoing(
        index,
        laneEdge.target,
        "performedByOrganization",
      )) {
        organizations.add(orgEdge.target);
      }
    }
  }

  return organizations;
}

function getSystemsForProcesses(
  index: GraphIndex,
  processIds: Set<string>,
): Set<string> {
  const systems = new Set<string>();
  for (const processId of processIds) {
    for (const edge of getOutgoing(index, processId, "usesSystem")) {
      systems.add(edge.target);
    }
    for (const activity of getTargets(index, processId, "hasActivity")) {
      for (const edge of getOutgoing(index, activity.id, "usesSystem")) {
        systems.add(edge.target);
      }
    }
  }
  return systems;
}

function getSuppliersForProcesses(
  index: GraphIndex,
  processIds: Set<string>,
): Set<string> {
  const suppliers = new Set<string>();
  for (const processId of processIds) {
    for (const edge of getOutgoing(index, processId, "performedBySupplier")) {
      suppliers.add(edge.target);
    }
  }
  return suppliers;
}

export function computeOrganizationMetrics(
  index: GraphIndex,
  organizationId: string,
): OrganizationInsightMetrics {
  const processIds = getProcessesForOrganization(index, organizationId);
  const activityIds = getActivitiesForOrganization(index, organizationId);

  let handoffTaskCount = 0;
  let manualActivityCount = 0;
  for (const activityId of activityIds) {
    if (isHandoffActivity(index, activityId)) handoffTaskCount += 1;
    if (isManualActivity(index, activityId)) manualActivityCount += 1;
  }

  const coOrganizations = new Set<string>();
  for (const processId of processIds) {
    for (const orgId of getOrganizationsOnProcess(index, processId)) {
      if (orgId !== organizationId) coOrganizations.add(orgId);
    }
  }

  return {
    processCount: processIds.size,
    activityCount: activityIds.size,
    handoffTaskCount,
    coOrganizationCount: coOrganizations.size,
    systemCount: getSystemsForProcesses(index, processIds).size,
    supplierCount: getSuppliersForProcesses(index, processIds).size,
    manualActivityCount,
  };
}

export function computeOrganizationCoordinationScore(
  metrics: OrganizationInsightMetrics,
): number {
  return (
    metrics.processCount * SCORE_WEIGHTS.process +
    metrics.activityCount * SCORE_WEIGHTS.activity +
    metrics.handoffTaskCount * SCORE_WEIGHTS.handoff +
    metrics.coOrganizationCount * SCORE_WEIGHTS.coOrganization +
    metrics.systemCount * SCORE_WEIGHTS.system +
    metrics.supplierCount * SCORE_WEIGHTS.supplier +
    metrics.manualActivityCount * SCORE_WEIGHTS.manual
  );
}

export function computeOrganizationScoreBreakdown(
  metrics: OrganizationInsightMetrics,
): ScoreBreakdownItem[] {
  return [
    {
      group: "processScope",
      labelKo: "프로세스 관여 범위",
      points: metrics.processCount * SCORE_WEIGHTS.process,
      detail: `관여 프로세스 ${metrics.processCount}개 × ${SCORE_WEIGHTS.process}`,
    },
    {
      group: "activityScope",
      labelKo: "업무 단계 관여",
      points: metrics.activityCount * SCORE_WEIGHTS.activity,
      detail: `관련 업무 단계 ${metrics.activityCount}개 × ${SCORE_WEIGHTS.activity}`,
    },
    {
      group: "handoffExposure",
      labelKo: "전달·연계 노출",
      points: metrics.handoffTaskCount * SCORE_WEIGHTS.handoff,
      detail: `전달·연계 작업 ${metrics.handoffTaskCount}개 × ${SCORE_WEIGHTS.handoff}`,
    },
    {
      group: "coordinationScope",
      labelKo: "조직 간 조율 범위",
      points: metrics.coOrganizationCount * SCORE_WEIGHTS.coOrganization,
      detail: `공존 조직 ${metrics.coOrganizationCount}개 × ${SCORE_WEIGHTS.coOrganization}`,
    },
    {
      group: "systemSurface",
      labelKo: "시스템 의존 표면",
      points: metrics.systemCount * SCORE_WEIGHTS.system,
      detail: `연결 시스템 ${metrics.systemCount}개 × ${SCORE_WEIGHTS.system}`,
    },
    {
      group: "supplierSurface",
      labelKo: "협력사 접점",
      points: metrics.supplierCount * SCORE_WEIGHTS.supplier,
      detail: `관련 공급사 ${metrics.supplierCount}개 × ${SCORE_WEIGHTS.supplier}`,
    },
    {
      group: "manualBurden",
      labelKo: "수작업 부담 후보",
      points: metrics.manualActivityCount * SCORE_WEIGHTS.manual,
      detail: `수작업성 단계 ${metrics.manualActivityCount}개 × ${SCORE_WEIGHTS.manual}`,
    },
  ];
}

function buildReasons(metrics: OrganizationInsightMetrics): string[] {
  const reasons: string[] = [];
  if (metrics.processCount > 0) {
    reasons.push(
      `${metrics.processCount}개 프로세스에 관여하여 업무 범위가 넓습니다.`,
    );
  }
  if (metrics.activityCount > 0) {
    reasons.push(
      `${metrics.activityCount}개 업무 단계와 연결되어 업무 접점이 많습니다.`,
    );
  }
  if (metrics.handoffTaskCount > 0) {
    reasons.push(
      `${metrics.handoffTaskCount}개 전달·연계 작업에 노출되어 조율 부담 후보입니다.`,
    );
  }
  if (metrics.coOrganizationCount > 0) {
    reasons.push(
      `${metrics.coOrganizationCount}개 다른 조직과 같은 프로세스에 함께 등장합니다.`,
    );
  }
  if (metrics.systemCount > 0) {
    reasons.push(
      `${metrics.systemCount}개 시스템과 연결된 프로세스에 관여합니다.`,
    );
  }
  if (metrics.supplierCount > 0) {
    reasons.push(
      `${metrics.supplierCount}개 공급사 접점이 있는 프로세스에 관여합니다.`,
    );
  }
  if (metrics.manualActivityCount > 0) {
    reasons.push(
      `${metrics.manualActivityCount}개 수작업성 activity와 연결되어 있습니다.`,
    );
  }
  return reasons;
}

export function buildOrganizationEvidence(
  index: GraphIndex,
  organizationId: string,
  metrics: OrganizationInsightMetrics,
): { nodeIds: string[]; edgeIds: string[]; summary: string } {
  const nodeIds = new Set<string>([organizationId]);
  const edgeIds = new Set<string>();

  const addEdges = (edges: GraphEdge[]) => {
    for (const edge of edges) {
      edgeIds.add(edge.id);
      nodeIds.add(edge.source);
      nodeIds.add(edge.target);
    }
  };

  const processIds = [...getProcessesForOrganization(index, organizationId)].slice(
    0,
    5,
  );
  for (const processId of processIds) {
    nodeIds.add(processId);
    addEdges(
      getOutgoing(index, processId, "performedByOrganization").filter(
        (e) => e.target === organizationId,
      ),
    );
  }

  const systemIds = [...getSystemsForProcesses(index, new Set(processIds))].slice(
    0,
    5,
  );
  for (const processId of processIds.slice(0, 3)) {
    for (const edge of getOutgoing(index, processId, "usesSystem")) {
      if (systemIds.includes(edge.target)) addEdges([edge]);
    }
  }

  const supplierIds = [...getSuppliersForProcesses(index, new Set(processIds))].slice(
    0,
    3,
  );
  for (const processId of processIds.slice(0, 3)) {
    for (const edge of getOutgoing(index, processId, "performedBySupplier")) {
      if (supplierIds.includes(edge.target)) addEdges([edge]);
    }
  }

  const activities = getActivitiesForOrganization(index, organizationId);
  let rep = 0;
  for (const activityId of activities) {
    if (rep >= 5) break;
    if (isHandoffActivity(index, activityId) || isManualActivity(index, activityId)) {
      nodeIds.add(activityId);
      rep += 1;
    }
  }

  return {
    nodeIds: [...nodeIds],
    edgeIds: [...edgeIds],
    summary:
      "조율 부담 후보 근거: 조직과 대표 프로세스·시스템·공급사 및 전달·수작업 activity 일부만 포함합니다.",
  };
}

function buildOrganizationMarkdown(
  orgLabel: string,
  score: number,
  metrics: OrganizationInsightMetrics,
  breakdown: ScoreBreakdownItem[],
): string {
  const breakdownLines = breakdown
    .filter((item) => item.points > 0)
    .map((item) => `- ${item.labelKo}: ${item.points.toFixed(1)} (${item.detail})`);

  return [
    `### ${orgLabel}`,
    "",
    "**결론:** 이 조직은 구조적 조율 병목 후보로 검토할 수 있습니다.",
    "",
    `**종합 점수:** ${score.toFixed(1)}`,
    "",
    "**점수 구성:**",
    ...breakdownLines,
    "",
    "**해석:**",
    "여러 프로세스, 시스템, 전달·연계 작업, 공존 조직에 걸쳐 등장하는 정도를 바탕으로 조율 부담 후보를 제시합니다.",
    "",
    "**주의:**",
    "이 결과는 업무 과부하나 지연을 확정하지 않습니다. 구조적 조율 병목 후보이며, 업무량·처리시간·티켓 수 데이터와 함께 검증해야 합니다.",
    "",
    "**권장 후속 조치:**",
    "조직 담당자와 관여 프로세스를 검토하고, 운영 데이터로 조율 부담 여부를 검증하세요.",
  ].join("\n");
}

function severityFromScore(score: number): "info" | "medium" | "high" {
  if (score >= 80) return "high";
  if (score >= 30) return "medium";
  return "info";
}

export function rankOrganizationCoordinationCandidates(
  graph: ProcessGraph,
  options?: { limit?: number },
  index?: GraphIndex,
): InsightCard[] {
  const limit = options?.limit ?? 50;
  const resolvedIndex = index ?? buildGraphIndex(graph);
  const organizations = resolvedIndex.nodesByType.get("Organization") ?? [];

  const ranked = organizations
    .map((organization) => {
      const metrics = computeOrganizationMetrics(resolvedIndex, organization.id);
      if (metrics.processCount === 0 && metrics.activityCount === 0) {
        return null;
      }

      const score = computeOrganizationCoordinationScore(metrics);
      const orgLabel = getNodeLabel(organization);
      const reasons = buildReasons(metrics);
      const scoreBreakdown = computeOrganizationScoreBreakdown(metrics);
      const evidence = buildOrganizationEvidence(
        resolvedIndex,
        organization.id,
        metrics,
      );

      const answer = `이 조직은 ${metrics.processCount}개 프로세스, ${metrics.systemCount}개 시스템, ${metrics.handoffTaskCount}개 전달·연계 작업에 연결되어 있어 구조적 조율 병목 후보로 검토할 수 있습니다.`;

      const card: InsightCard = {
        id: `org-coordination-${organization.id}`,
        category: "organization",
        title: `구조적 조율 병목 후보: ${orgLabel}`,
        answer,
        explanation:
          "이 분석은 조직이 여러 프로세스, 시스템, handoff-like activity에 걸쳐 얼마나 자주 등장하는지 기반으로 조율 부담 후보를 찾습니다. 실제 업무 과부하나 지연 확정은 아니며, 업무량·처리시간·티켓 수 데이터와 함께 검증해야 합니다.",
        severity: severityFromScore(score),
        score,
        reasons,
        metrics: {
          "종합 점수": score.toFixed(1),
          "관여 프로세스": metrics.processCount,
          "관련 업무 단계": metrics.activityCount,
          "전달·연계 노출": metrics.handoffTaskCount,
          "공존 조직": metrics.coOrganizationCount,
          "연결 시스템": metrics.systemCount,
          "관련 공급사": metrics.supplierCount,
          "수작업성 단계": metrics.manualActivityCount,
        },
        scoreBreakdown,
        evidence,
        markdown: buildOrganizationMarkdown(orgLabel, score, metrics, scoreBreakdown),
      };
      return card;
    })
    .filter((card): card is InsightCard => card != null)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, limit);

  return ranked.map((card, i) => ({ ...card, rank: i + 1 }));
}

export { SCORE_WEIGHTS };
