import type { ProcessGraph } from "../graph/types";
import { isManualActivity } from "./competencyQuestions";
import {
  buildGraphIndex,
  getIncoming,
  getNodeLabel,
  getOutgoing,
  getTargets,
  type GraphIndex,
} from "./graphIndex";
import type { EvidenceRef, InsightCard } from "./types";

const RUNTIME_FIELDS = [
  "frequency",
  "executionTime",
  "avgExecutionTime",
  "waitTime",
  "sla",
  "ticketCount",
] as const;

const READINESS_CAVEAT =
  "추론 준비도는 현재 모델 메타데이터 기준이며, 운영 병목 검증에는 runtime data 연결이 추가로 필요합니다.";

function readinessLabel(score: number): "High" | "Medium" | "Low" {
  if (score >= 70) return "High";
  if (score >= 40) return "Medium";
  return "Low";
}

function activityHasResponsibility(index: GraphIndex, activityId: string): boolean {
  return (
    getOutgoing(index, activityId, "assignedToLane").length > 0 ||
    getIncoming(index, activityId, "performedByOrganization").length > 0
  );
}

function countRuntimeFields(activity: { properties: Record<string, unknown> }): number {
  let count = 0;
  for (const field of RUNTIME_FIELDS) {
    const value = activity.properties[field];
    if (value != null && String(value).trim() !== "") count += 1;
  }
  return count;
}

function computeStructureScore(index: GraphIndex, processId: string, activityCount: number): number {
  let score = 0;
  if (activityCount > 0) score += 8;
  const hasSequence = (index.outgoingByNodeId.get(processId) ?? []).some(
    (e) => e.type === "hasActivity",
  );
  if (hasSequence) score += 4;
  const gateways = getTargets(index, processId, "containsElement").filter(
    (n) => n.type === "Gateway" || n.type === "Event",
  );
  if (gateways.length > 0 || activityCount <= 3) score += 4;
  return Math.min(20, score);
}

function computeResponsibilityScore(
  index: GraphIndex,
  processId: string,
  activities: { id: string }[],
): number {
  if (activities.length === 0) return 0;
  const withResp = activities.filter((a) => activityHasResponsibility(index, a.id)).length;
  const ratio = withResp / activities.length;
  const orgCount = getTargets(index, processId, "performedByOrganization").length;
  let score = ratio * 14;
  if (orgCount > 0) score += 6;
  return Math.min(20, score);
}

function computeSystemDataScore(
  index: GraphIndex,
  processId: string,
  activities: { id: string }[],
): number {
  let score = 0;
  const systems = getTargets(index, processId, "usesSystem").length;
  const dataStores = getTargets(index, processId, "referencesDataStore").length;
  if (systems > 0) score += 8;
  if (dataStores > 0) score += 4;

  let manualCount = 0;
  let manualWithLink = 0;
  for (const activity of activities) {
    if (isManualActivity(index, activity.id)) {
      manualCount += 1;
      if (getOutgoing(index, activity.id, "hasManual").length > 0) manualWithLink += 1;
    }
  }
  if (manualCount === 0) score += 4;
  else score += (manualWithLink / manualCount) * 8;

  return Math.min(20, score);
}

function computeRuntimeScore(activities: { properties: Record<string, unknown> }[]): number {
  if (activities.length === 0) return 0;
  const totalFields = activities.reduce((sum, a) => sum + countRuntimeFields(a), 0);
  const maxPossible = activities.length * RUNTIME_FIELDS.length;
  return Math.min(20, (totalFields / Math.max(1, maxPossible)) * 20);
}

function computeEvidenceQualityScore(index: GraphIndex, processId: string): number {
  let score = 10;
  const semanticTypes = new Set([
    "usesSystem",
    "performedByOrganization",
    "hasManual",
    "assignedToLane",
    "referencesDataStore",
    "isFollowedBy",
  ]);
  const edges = index.outgoingByNodeId.get(processId) ?? [];
  const semanticCount = edges.filter((e) => semanticTypes.has(e.type)).length;
  const containsOnly = edges.filter((e) => e.type === "containsElement").length;
  if (semanticCount > containsOnly) score += 6;
  else if (semanticCount > 0) score += 3;
  const annotationHeavy = getTargets(index, processId, "containsElement").filter(
    (n) => n.type === "Annotation",
  ).length;
  if (annotationHeavy <= 2) score += 4;
  return Math.min(20, score);
}

function buildReadinessEvidence(processId: string, activityIds: string[]): EvidenceRef {
  return {
    nodeIds: [processId, ...activityIds.slice(0, 8)],
    edgeIds: [],
    summary: "추론 준비도 근거: 프로세스와 대표 activity만 포함합니다.",
  };
}

function buildReadinessMarkdown(
  title: string,
  answer: string,
  dimensions: Record<string, string>,
  recommendedActions: string[],
): string {
  return [
    `### ${title}`,
    "",
    `**결론:** ${answer}`,
    "",
    "**차원별 평가:**",
    ...Object.entries(dimensions).map(([k, v]) => `- ${k}: ${v}`),
    "",
    "**추천 조치:**",
    ...recommendedActions.map((a) => `- ${a}`),
    "",
    "**주의:**",
    READINESS_CAVEAT,
  ].join("\n");
}

export function computeReasoningReadinessForProcess(
  index: GraphIndex,
  processId: string,
): { score: number; label: "High" | "Medium" | "Low"; dimensions: Record<string, number> } {
  const activities = getTargets(index, processId, "hasActivity");
  const structure = computeStructureScore(index, processId, activities.length);
  const responsibility = computeResponsibilityScore(index, processId, activities);
  const systemData = computeSystemDataScore(index, processId, activities);
  const runtime = computeRuntimeScore(activities);
  const evidenceQuality = computeEvidenceQualityScore(index, processId);
  const score = Math.round(structure + responsibility + systemData + runtime + evidenceQuality);

  return {
    score,
    label: readinessLabel(score),
    dimensions: {
      structure,
      responsibility,
      systemData,
      runtime,
      evidenceQuality,
    },
  };
}

export function rankReasoningReadiness(
  graph: ProcessGraph,
  options?: { limit?: number },
  index?: GraphIndex,
): InsightCard[] {
  const limit = options?.limit ?? 10;
  const resolvedIndex = index ?? buildGraphIndex(graph);
  const processes = resolvedIndex.nodesByType.get("Process") ?? [];

  const ranked = processes
    .map((process) => {
      const readiness = computeReasoningReadinessForProcess(resolvedIndex, process.id);
      return { process, readiness };
    })
    .sort((a, b) => a.readiness.score - b.readiness.score)
    .slice(0, limit);

  const recommendedActions = [
    "connect activity frequency",
    "connect avg execution time",
    "connect wait time",
    "connect SLA/ticket data",
    "enrich owner/system metadata",
  ];

  return ranked.map(({ process, readiness }) => {
    const label = getNodeLabel(process);
    const title = `추론 준비도: ${label}`;
    const answer =
      readiness.label === "Low"
        ? "이 프로세스는 구조 분석은 가능하지만, 운영 병목 검증에는 runtime data가 부족합니다."
        : readiness.label === "Medium"
          ? "이 프로세스는 기본 구조·책임 메타데이터가 일부 갖춰져 있으나, runtime data 보강이 권장됩니다."
          : "이 프로세스는 구조·책임·시스템 메타데이터가 비교적 충실하여 심화 추론 준비도가 높습니다.";
    const dimLabels: Record<string, string> = {
      structure: `${readiness.dimensions.structure}/20`,
      responsibility: `${readiness.dimensions.responsibility}/20`,
      systemData: `${readiness.dimensions.systemData}/20`,
      runtime: `${readiness.dimensions.runtime}/20`,
      evidenceQuality: `${readiness.dimensions.evidenceQuality}/20`,
    };
    const activities = getTargets(resolvedIndex, process.id, "hasActivity");

    return {
      id: `readiness-${process.id}`,
      category: "quality" as const,
      title,
      question: "이 프로세스가 심화 추론에 얼마나 준비되어 있는가?",
      answer,
      explanation:
        "현재 모델 기준 준비도 점수이며, 실제 운영 성과나 병목 여부를 확정하지 않습니다.",
      severity:
        readiness.label === "Low" ? "high" : readiness.label === "Medium" ? "medium" : "info",
      score: readiness.score,
      reasons: [
        `준비도 등급: ${readiness.label}`,
        `구조 완전성 ${dimLabels.structure}`,
        `책임 완전성 ${dimLabels.responsibility}`,
        `runtime 준비도 ${dimLabels.runtime}`,
      ],
      metrics: {
        "인사이트 유형": "추론 준비도",
        "준비도 점수": readiness.score,
        "준비도 등급": readiness.label,
      },
      evidence: buildReadinessEvidence(
        process.id,
        activities.map((a) => a.id),
      ),
      markdown: buildReadinessMarkdown(title, answer, dimLabels, recommendedActions),
    };
  });
}

export { READINESS_CAVEAT };
