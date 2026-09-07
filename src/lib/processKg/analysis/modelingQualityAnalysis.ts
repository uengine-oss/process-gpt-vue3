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

const MODELING_CAVEAT =
  "모델링 품질 보완 후보는 분석 신뢰도 향상을 위한 메타데이터 보완 제안이며, 품질 결함을 단정하지 않습니다.";

function activityHasResponsibility(index: GraphIndex, activityId: string): boolean {
  return (
    getOutgoing(index, activityId, "assignedToLane").length > 0 ||
    getIncoming(index, activityId, "performedByOrganization").length > 0
  );
}

function normalizeName(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, " ");
}

function looksLikeActivityId(label: string): boolean {
  return /^act[-_]/i.test(label) || /^activity[-_]/i.test(label) || /^[a-z]+_\d+$/i.test(label);
}

function countSuspiciousSystemNames(index: GraphIndex, processId: string): number {
  const systems = getTargets(index, processId, "usesSystem");
  let count = 0;
  for (const sys of systems) {
    const label = getNodeLabel(sys);
    if (looksLikeActivityId(label) || label.length <= 2) count += 1;
  }
  return count;
}

function countDuplicateNames(labels: string[]): number {
  const seen = new Map<string, number>();
  for (const label of labels) {
    const key = normalizeName(label);
    if (!key) continue;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  let dupes = 0;
  for (const count of seen.values()) {
    if (count > 1) dupes += count - 1;
  }
  return dupes;
}

function computeModelingRiskScore(
  index: GraphIndex,
  processId: string,
  unresolvedCount: number,
): {
  score: number;
  missingResponsibility: number;
  manualWithoutLink: number;
  missingSystemOnManual: number;
  annotationCount: number;
  suspiciousSystemName: number;
  duplicateNames: number;
} {
  const activities = getTargets(index, processId, "hasActivity");
  let missingResponsibility = 0;
  let manualWithoutLink = 0;
  let missingSystemOnManual = 0;

  for (const activity of activities) {
    if (!activityHasResponsibility(index, activity.id)) missingResponsibility += 1;
    const manual = isManualActivity(index, activity.id);
    if (manual && getOutgoing(index, activity.id, "hasManual").length === 0) {
      manualWithoutLink += 1;
    }
    if (manual && getOutgoing(index, activity.id, "usesSystem").length === 0) {
      missingSystemOnManual += 1;
    }
  }

  const annotationCount = getTargets(index, processId, "containsElement").filter(
    (n) => n.type === "Annotation",
  ).length;

  const suspiciousSystemName = countSuspiciousSystemNames(index, processId);

  const orgLabels = getTargets(index, processId, "performedByOrganization").map((n) =>
    getNodeLabel(n),
  );
  const sysLabels = getTargets(index, processId, "usesSystem").map((n) => getNodeLabel(n));
  const duplicateNames = countDuplicateNames([...orgLabels, ...sysLabels]);

  const score =
    missingResponsibility * 3 +
    manualWithoutLink * 2 +
    missingSystemOnManual * 1.5 +
    unresolvedCount * 3 +
    annotationCount * 0.5 +
    suspiciousSystemName * 3 +
    duplicateNames * 1;

  return {
    score,
    missingResponsibility,
    manualWithoutLink,
    missingSystemOnManual,
    annotationCount,
    suspiciousSystemName,
    duplicateNames,
  };
}

function buildModelingEvidence(
  processId: string,
  issueActivityIds: string[],
): EvidenceRef {
  return {
    nodeIds: [processId, ...issueActivityIds.slice(0, 10)],
    edgeIds: [],
    summary: "모델링 품질 보완 근거: 프로세스와 이슈 activity 예시만 포함합니다.",
  };
}

function buildModelingMarkdown(
  title: string,
  answer: string,
  reasons: string[],
  recommendedActions: string[],
): string {
  return [
    `### ${title}`,
    "",
    `**결론:** ${answer}`,
    "",
    "**구조적 신호:**",
    ...reasons.map((r) => `- ${r}`),
    "",
    "**추천 조치:**",
    ...recommendedActions.map((a) => `- ${a}`),
    "",
    "**주의:**",
    MODELING_CAVEAT,
  ].join("\n");
}

export function rankModelingQualityIssues(
  graph: ProcessGraph,
  options?: { limit?: number },
  index?: GraphIndex,
): InsightCard[] {
  const limit = options?.limit ?? 10;
  const resolvedIndex = index ?? buildGraphIndex(graph);
  const processes = resolvedIndex.nodesByType.get("Process") ?? [];
  const unresolvedCount = graph.parseReport?.unresolvedReferences?.length ?? 0;
  const unresolvedPerProcess =
    processes.length > 0 ? Math.ceil(unresolvedCount / processes.length) : unresolvedCount;

  const recommendedActions = [
    "lane/organization mapping 보완",
    "system name normalization",
    "manual link 보완",
    "definitionId resolution",
    "annotation 내용을 structured property로 이전",
  ];

  const ranked = processes
    .map((process) => {
      const activities = getTargets(resolvedIndex, process.id, "hasActivity");
      const risk = computeModelingRiskScore(
        resolvedIndex,
        process.id,
        unresolvedPerProcess,
      );
      const sparseLinks =
        activities.length >= 5 &&
        getTargets(resolvedIndex, process.id, "performedByOrganization").length <= 1 &&
        getTargets(resolvedIndex, process.id, "usesSystem").length <= 1;

      const effectiveScore = risk.score + (sparseLinks ? 5 : 0);
      const issueActivityIds = activities
        .filter((a) => !activityHasResponsibility(resolvedIndex, a.id))
        .map((a) => a.id);

      return { process, risk, effectiveScore, sparseLinks, issueActivityIds };
    })
    .filter((item) => item.effectiveScore >= 3)
    .sort((a, b) => b.effectiveScore - a.effectiveScore)
    .slice(0, limit);

  return ranked.map(({ process, risk, effectiveScore, sparseLinks, issueActivityIds }) => {
    const label = getNodeLabel(process);
    const title = `모델링 품질 보완 후보: ${label}`;
    const answer =
      "이 프로세스는 메타데이터 보완을 통해 분석 신뢰도를 높일 수 있는 구조적 신호를 포함합니다.";
    const reasons: string[] = [];
    if (risk.missingResponsibility > 0) {
      reasons.push(`책임 미연결 activity ${risk.missingResponsibility}개`);
    }
    if (risk.manualWithoutLink > 0) {
      reasons.push(`manual link 없는 manualTask ${risk.manualWithoutLink}개`);
    }
    if (risk.missingSystemOnManual > 0) {
      reasons.push(`시스템 미연결 수작업 activity ${risk.missingSystemOnManual}개`);
    }
    if (risk.annotationCount >= 3) {
      reasons.push(`annotation 다수 사용 (${risk.annotationCount}개)`);
    }
    if (risk.suspiciousSystemName > 0) {
      reasons.push(`의심 system name ${risk.suspiciousSystemName}개`);
    }
    if (risk.duplicateNames > 0) {
      reasons.push(`중복 가능 org/system name ${risk.duplicateNames}건`);
    }
    if (sparseLinks) {
      reasons.push("activity 대비 org/system 연결 희소");
    }

    return {
      id: `modeling-quality-${process.id}`,
      category: "quality" as const,
      title,
      question: "어떤 프로세스의 모델링 메타데이터를 보완하면 분석 신뢰도가 향상되는가?",
      answer,
      explanation:
        "현재 모델 기준 메타데이터 보완 후보이며, 모델 품질 결함을 단정하지 않습니다.",
      severity: effectiveScore >= 20 ? "high" : effectiveScore >= 10 ? "medium" : "info",
      score: effectiveScore,
      reasons,
      metrics: {
        "인사이트 유형": "모델링 품질 보완",
        "품질 리스크 점수": effectiveScore.toFixed(1),
        "책임 미연결": risk.missingResponsibility,
        "annotation": risk.annotationCount,
      },
      evidence: buildModelingEvidence(process.id, issueActivityIds),
      markdown: buildModelingMarkdown(title, answer, reasons, recommendedActions),
    };
  });
}

export { MODELING_CAVEAT };
