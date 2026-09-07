import type { ProcessGraph } from "../graph/types";
import {
  buildGraphIndex,
  type GraphIndex,
  findParentProcessId,
  getIncoming,
  getNodeLabel,
  getOutgoing,
} from "./graphIndex";
import type { InsightCard } from "./types";

interface SystemImpactMetrics {
  processCount: number;
  organizationCount: number;
  activityUsageCount: number;
  processIds: string[];
  organizationIds: string[];
  systemId: string;
}

function collectSystemImpact(
  graph: ProcessGraph,
  systemId: string,
  index?: GraphIndex,
): SystemImpactMetrics {
  const resolvedIndex = index ?? buildGraphIndex(graph);
  const processIds = new Set<string>();
  const organizationIds = new Set<string>();
  let activityUsageCount = 0;

  const usageEdges = getIncoming(resolvedIndex, systemId, "usesSystem");
  for (const edge of usageEdges) {
    const source = resolvedIndex.nodesById.get(edge.source);
    if (!source) continue;
    if (source.type === "Process") {
      processIds.add(edge.source);
    } else if (source.type === "ProcessActivity") {
      activityUsageCount += 1;
      const pid = findParentProcessId(resolvedIndex, edge.source);
      if (pid) processIds.add(pid);
    }
  }

  for (const processId of processIds) {
    const orgEdges = getOutgoing(resolvedIndex, processId, "performedByOrganization");
    for (const orgEdge of orgEdges) {
      organizationIds.add(orgEdge.target);
    }
  }

  return {
    systemId,
    processCount: processIds.size,
    organizationCount: organizationIds.size,
    activityUsageCount,
    processIds: [...processIds],
    organizationIds: [...organizationIds],
  };
}

function computeImpactScore(metrics: SystemImpactMetrics): number {
  return (
    metrics.processCount * 5 +
    metrics.organizationCount * 2 +
    metrics.activityUsageCount * 1
  );
}

function formatTopList(
  index: ReturnType<typeof buildGraphIndex>,
  ids: string[],
  limit = 5,
): string {
  if (ids.length === 0) return "(없음)";
  const labels = ids
    .slice(0, limit)
    .map((id) => getNodeLabel(index.nodesById.get(id)));
  const suffix = ids.length > limit ? ` 외 ${ids.length - limit}개` : "";
  return `${labels.join(", ")}${suffix}`;
}

function buildImpactEvidence(
  index: ReturnType<typeof buildGraphIndex>,
  systemId: string,
  metrics: SystemImpactMetrics,
): { nodeIds: string[]; edgeIds: string[]; summary: string } {
  const nodeIds = new Set<string>([systemId]);
  const edgeIds = new Set<string>();

  const incoming = getIncoming(index, systemId, "usesSystem").slice(0, 5);
  for (const edge of incoming) {
    edgeIds.add(edge.id);
    nodeIds.add(edge.source);
    const source = index.nodesById.get(edge.source);
    if (source?.type === "ProcessActivity") {
      const pid = findParentProcessId(index, edge.source);
      if (pid) nodeIds.add(pid);
    }
  }

  for (const processId of metrics.processIds.slice(0, 5)) {
    nodeIds.add(processId);
  }
  for (const orgId of metrics.organizationIds.slice(0, 3)) {
    nodeIds.add(orgId);
    for (const edge of getIncoming(index, orgId, "performedByOrganization").slice(0, 1)) {
      edgeIds.add(edge.id);
      nodeIds.add(edge.source);
    }
  }

  return {
    nodeIds: [...nodeIds],
    edgeIds: [...edgeIds],
    summary:
      "영향 후보 근거: 시스템, 연결된 대표 프로세스·조직만 포함합니다.",
  };
}

function buildImpactMarkdown(
  systemLabel: string,
  metrics: SystemImpactMetrics,
  score: number,
  index: ReturnType<typeof buildGraphIndex>,
): string {
  return [
    `### ${systemLabel}`,
    "",
    "**결론:**",
    `이 시스템은 ${metrics.processCount}개 프로세스, ${metrics.organizationCount}개 조직과 연결되어 있어 장애 또는 변경 시 **영향 후보** 범위가 클 수 있습니다.`,
    "",
    "**지표:**",
    `- 영향 후보 점수: ${score}`,
    `- 영향 후보 프로세스 수: ${metrics.processCount}`,
    `- 관련 조직 수: ${metrics.organizationCount}`,
    `- 업무 단계 레벨 사용 연결: ${metrics.activityUsageCount}건`,
    `- 주요 영향 후보 프로세스: ${formatTopList(index, metrics.processIds)}`,
    `- 주요 관련 조직: ${formatTopList(index, metrics.organizationIds)}`,
    "",
    "**해석:**",
    "그래프 연결 범위가 넓을수록 변경·장애 시 점검 대상이 많아질 수 있습니다. 실제 운영 영향은 사용 빈도와 업무 중요도에 따라 달라집니다.",
    "",
    "**주의:**",
    "이 결과는 모델링 기반 영향 후보이며, 실제 장애 영향이나 비즈니스 손실을 단정하지 않습니다.",
    "",
    "**권장 후속 조치:**",
    "상위 영향 후보 프로세스 담당자와 변경 영향도를 검토하고, 필요 시 운영 모니터링·의존성 맵을 보강하세요.",
  ].join("\n");
}

function buildImpactCard(
  graph: ProcessGraph,
  systemId: string,
  rank?: number,
  index?: GraphIndex,
): InsightCard {
  const resolvedIndex = index ?? buildGraphIndex(graph);
  const system = resolvedIndex.nodesById.get(systemId);
  const systemLabel = getNodeLabel(system);
  const metrics = collectSystemImpact(graph, systemId, resolvedIndex);
  const score = computeImpactScore(metrics);
  const evidence = buildImpactEvidence(resolvedIndex, systemId, metrics);

  const topProcesses = formatTopList(resolvedIndex, metrics.processIds);
  const topOrgs = formatTopList(resolvedIndex, metrics.organizationIds);

  const answer = `이 시스템은 ${metrics.processCount}개 프로세스, ${metrics.organizationCount}개 조직과 연결되어 있어 장애 또는 변경 시 영향 후보 범위가 클 수 있습니다.`;

  const card: InsightCard = {
    id: `impact-system-${systemId}`,
    category: "impact",
    title: `시스템 영향 후보: ${systemLabel}`,
    answer,
    explanation:
      "시스템 사용 연결과 관련 프로세스의 조직 관여 관계를 바탕으로 영향 후보 범위를 추정했습니다.",
    severity:
      metrics.processCount >= 3 ? "high" : metrics.processCount >= 1 ? "medium" : "info",
    score,
    reasons: [
      `영향 후보 프로세스 ${metrics.processCount}개`,
      `관련 조직 ${metrics.organizationCount}개`,
      `업무 단계 레벨 사용 연결 ${metrics.activityUsageCount}건`,
      `주요 영향 후보 프로세스: ${topProcesses}`,
      `주요 관련 조직: ${topOrgs}`,
    ],
    metrics: {
      "영향 후보 점수": score,
      "영향 후보 프로세스": metrics.processCount,
      "관련 조직": metrics.organizationCount,
      "업무 단계 사용 연결": metrics.activityUsageCount,
      ...(rank != null ? { 순위: rank } : {}),
    },
    evidence,
    markdown: buildImpactMarkdown(systemLabel, metrics, score, resolvedIndex),
  };
  return card;
}

export function rankSystemBlastRadius(
  graph: ProcessGraph,
  options?: { limit?: number },
  index?: GraphIndex,
): InsightCard[] {
  const limit = options?.limit ?? 10;
  const resolvedIndex = index ?? buildGraphIndex(graph);
  const systems = resolvedIndex.nodesByType.get("System") ?? [];

  return systems
    .map((system) => {
      const metrics = collectSystemImpact(graph, system.id, resolvedIndex);
      return { systemId: system.id, score: computeImpactScore(metrics) };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry, i) => {
      const card = buildImpactCard(graph, entry.systemId, i + 1, resolvedIndex);
      return { ...card, rank: i + 1 };
    });
}

export function analyzeSingleSystemImpact(
  graph: ProcessGraph,
  systemId: string,
  index?: GraphIndex,
): InsightCard {
  const resolvedIndex = index ?? buildGraphIndex(graph);
  const metrics = collectSystemImpact(graph, systemId, resolvedIndex);
  const system = resolvedIndex.nodesById.get(systemId);
  const systemLabel = getNodeLabel(system);
  const score = computeImpactScore(metrics);
  const evidence = buildImpactEvidence(resolvedIndex, systemId, metrics);

  const topProcesses = formatTopList(resolvedIndex, metrics.processIds);
  const topOrgs = formatTopList(resolvedIndex, metrics.organizationIds);

  const answer = `이 시스템 장애 또는 변경 시 영향 후보 프로세스는 ${metrics.processCount}개입니다. 관련 조직은 ${metrics.organizationCount}개입니다.`;

  return {
    id: `impact-single-${systemId}`,
    category: "impact",
    title: `시스템 영향 후보: ${systemLabel}`,
    question: "이 시스템 장애 또는 변경 시 영향 범위는?",
    answer,
    explanation:
      "시스템 사용 연결과 관련 프로세스의 조직 관여를 바탕으로 영향 후보를 산출했습니다. 실제 장애 영향을 단정하지 않습니다.",
    score,
    reasons: [
      `영향 후보 프로세스 ${metrics.processCount}개: ${topProcesses}`,
      `관련 조직 ${metrics.organizationCount}개: ${topOrgs}`,
      `업무 단계 레벨 연결 ${metrics.activityUsageCount}건`,
    ],
    metrics: {
      "영향 후보 점수": score,
      "영향 후보 프로세스": metrics.processCount,
      "관련 조직": metrics.organizationCount,
      "업무 단계 사용 연결": metrics.activityUsageCount,
    },
    evidence,
    markdown: buildImpactMarkdown(systemLabel, metrics, score, resolvedIndex),
  };
}

export { collectSystemImpact, computeImpactScore };
