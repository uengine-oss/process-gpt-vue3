import type { GraphNode, ProcessGraph } from "../graph/types";
import { isManualActivity, usesSystem } from "./competencyQuestions";
import {
  buildGraphIndex,
  findParentProcessId,
  getIncoming,
  getNodeLabel,
  getOutgoing,
  getTargets,
  type GraphIndex,
} from "./graphIndex";
import {
  clusterSequences,
  extractTaskSequences,
  inferActionVerb,
  tokenizeLabel,
  type SequenceCluster,
} from "./sequenceMining";
import type { EvidenceRef, InsightCard } from "./types";

export type AutomationCandidateType =
  | "rpa"
  | "ai_assistant"
  | "agent_workflow"
  | "human_in_the_loop"
  | "standardization";

export const AUTOMATION_TYPE_LABELS: Record<AutomationCandidateType, string> = {
  rpa: "RPA",
  ai_assistant: "AI Assistant",
  agent_workflow: "Agent Workflow",
  human_in_the_loop: "Human-in-the-loop",
  standardization: "Standardization",
};

const RPA_VERBS = new Set(["check", "collect", "request", "act"]);
const AI_KEYWORDS = [
  "analyze",
  "analysis",
  "review",
  "판단",
  "검토",
  "분석",
  "확인",
  "evaluate",
  "assess",
];
const APPROVAL_KEYWORDS = ["승인", "결재", "approve", "review", "검토", "확정"];
const AGENT_PATTERNS = [
  "check->analyze->notify",
  "request->check->act",
  "collect->analyze->notify",
  "check->request->act",
];

const AUTOMATION_CAVEAT =
  "자동화 후보는 현재 BPMN 모델 기준 구조적 신호이며, 자동화를 확정하지 않습니다. 현업 검증이 필요합니다.";

const RECOMMENDED_ACTIONS = [
  "반복 수행 빈도 확인",
  "입력/출력 데이터 확인",
  "API 가능 여부 확인",
  "예외율 확인",
  "사람 승인 필요 여부 확인",
];

function activityHasManual(index: GraphIndex, activityId: string): boolean {
  return getOutgoing(index, activityId, "hasManual").length > 0;
}

function activityHasOrganization(index: GraphIndex, activityId: string): boolean {
  return getIncoming(index, activityId, "performedByOrganization").length > 0;
}

function activityHasLane(index: GraphIndex, activityId: string): boolean {
  return getOutgoing(index, activityId, "assignedToLane").length > 0;
}

function labelMatchesKeywords(label: string, keywords: string[]): boolean {
  const lower = label.toLowerCase();
  return keywords.some((kw) => lower.includes(kw.toLowerCase()));
}

function getGatewayCountForProcess(index: GraphIndex, processId: string): number {
  return getTargets(index, processId, "containsElement").filter((n) => n.type === "Gateway")
    .length;
}

function hasGatewayNearby(index: GraphIndex, activityId: string): boolean {
  const processId = findParentProcessId(index, activityId);
  if (!processId) return false;
  const gateways = getTargets(index, processId, "containsElement").filter(
    (n) => n.type === "Gateway",
  );
  return gateways.length > 0;
}

function scoreRpa(index: GraphIndex, activity: GraphNode, processId: string): number {
  let score = 0;
  const manual =
    isManualActivity(index, activity.id) ||
    activity.properties.bpmnType === "manualTask";
  if (manual) score += 3;
  if (usesSystem(index, activity.id)) score += 3;
  const tokens = tokenizeLabel(getNodeLabel(activity));
  const verb = inferActionVerb(tokens);
  if (RPA_VERBS.has(verb)) score += 2;
  const gatewayCount = getGatewayCountForProcess(index, processId);
  if (gatewayCount <= 2) score += 1;
  return score;
}

function scoreAiAssistant(index: GraphIndex, activity: GraphNode): number {
  let score = 0;
  const label = getNodeLabel(activity);
  if (labelMatchesKeywords(label, AI_KEYWORDS)) score += 4;
  const bpmnType = activity.properties.bpmnType;
  if (bpmnType === "manualTask" || bpmnType === "userTask") score += 2;
  if (activityHasManual(index, activity.id)) score += 2;
  if (!usesSystem(index, activity.id)) score += 2;
  return score;
}

function scoreHumanInLoop(index: GraphIndex, activity: GraphNode, processId: string): number {
  let score = 0;
  const label = getNodeLabel(activity);
  if (labelMatchesKeywords(label, APPROVAL_KEYWORDS)) score += 3;
  if (hasGatewayNearby(index, activity.id)) score += 2;
  if (getGatewayCountForProcess(index, processId) >= 2) score += 2;
  if (usesSystem(index, activity.id)) score += 2;
  return score;
}

function scoreStandardization(index: GraphIndex, activity: GraphNode): number {
  let score = 0;
  if (!usesSystem(index, activity.id)) score += 2;
  if (!activityHasOrganization(index, activity.id) && !activityHasLane(index, activity.id)) {
    score += 2;
  }
  if (!activityHasManual(index, activity.id) && isManualActivity(index, activity.id)) {
    score += 1;
  }
  return score;
}

function pickAutomationType(
  index: GraphIndex,
  activity: GraphNode,
  processId: string,
): { type: AutomationCandidateType; score: number } | null {
  const scores: Array<{ type: AutomationCandidateType; score: number }> = [
    { type: "rpa", score: scoreRpa(index, activity, processId) },
    { type: "ai_assistant", score: scoreAiAssistant(index, activity) },
    { type: "human_in_the_loop", score: scoreHumanInLoop(index, activity, processId) },
    { type: "standardization", score: scoreStandardization(index, activity) },
  ];
  const best = scores.sort((a, b) => b.score - a.score)[0];
  if (!best || best.score < 4) return null;
  return best;
}

function classifySequenceCluster(cluster: SequenceCluster): {
  refinement: string;
  automationType: AutomationCandidateType;
  score: number;
} {
  const length = cluster.sequences[0]?.activityIds.length ?? 0;
  const processCount = cluster.processIds.length;
  const hasSystems = cluster.sequences.some((seq) => seq.systemIds.length > 0);
  const pattern = cluster.sequences[0]?.actionPattern ?? cluster.representativePattern;
  const matchesAgentPattern = AGENT_PATTERNS.some(
    (p) => pattern === p || pattern.includes(p),
  );

  if (length >= 3 && hasSystems && matchesAgentPattern && processCount >= 2) {
    return { refinement: "Agent Skill 후보", automationType: "agent_workflow", score: cluster.score + 5 };
  }
  if (processCount >= 2 && hasSystems) {
    return { refinement: "Process Module 후보", automationType: "agent_workflow", score: cluster.score + 3 };
  }
  if (processCount >= 2 && !hasSystems) {
    return { refinement: "Standardization 후보", automationType: "standardization", score: cluster.score + 2 };
  }
  if (length >= 3 && hasSystems) {
    return { refinement: "Agent Workflow 후보", automationType: "agent_workflow", score: cluster.score };
  }
  return { refinement: "반복 sequence 후보", automationType: "standardization", score: cluster.score };
}

function buildActivityEvidence(
  activityId: string,
  processId: string,
  systemIds: string[],
): EvidenceRef {
  const nodeIds = [activityId, processId, ...systemIds.slice(0, 3)];
  return {
    nodeIds,
    edgeIds: [],
    summary: "자동화 후보 근거: activity, 프로세스, 연결 시스템 예시만 포함합니다.",
  };
}

function buildSequenceEvidence(cluster: SequenceCluster): EvidenceRef {
  const activityIds = [
    ...new Set(cluster.sequences.flatMap((seq) => seq.activityIds)),
  ];
  return {
    nodeIds: activityIds.slice(0, 12),
    edgeIds: cluster.evidenceEdgeIds.slice(0, 8),
    summary: "sequence 자동화 후보 근거: 대표 activity와 sequence flow 예시만 포함합니다.",
  };
}

function buildAutomationMarkdown(
  title: string,
  answer: string,
  reasons: string[],
  candidateType: string,
): string {
  return [
    `### ${title}`,
    "",
    `**결론:** ${answer}`,
    "",
    `**후보 유형:** ${candidateType}`,
    "",
    "**구조적 신호:**",
    ...reasons.map((r) => `- ${r}`),
    "",
    "**추천 조치:**",
    ...RECOMMENDED_ACTIONS.map((a) => `- ${a}`),
    "",
    "**주의:**",
    AUTOMATION_CAVEAT,
  ].join("\n");
}

function activityToInsightCard(
  index: GraphIndex,
  activity: GraphNode,
  processId: string,
  picked: { type: AutomationCandidateType; score: number },
): InsightCard {
  const label = getNodeLabel(activity);
  const typeLabel = AUTOMATION_TYPE_LABELS[picked.type];
  const title = `자동화 후보: ${label}`;
  const answer = `이 activity는 ${typeLabel} 후보로 검토할 수 있습니다.`;
  const reasons: string[] = [];
  if (isManualActivity(index, activity.id)) reasons.push("수작업 activity 구조적 신호");
  if (usesSystem(index, activity.id)) reasons.push("시스템 연결 존재");
  if (activityHasManual(index, activity.id)) reasons.push("매뉴얼 연결 존재");
  const tokens = tokenizeLabel(label);
  const verb = inferActionVerb(tokens);
  if (verb !== "other") reasons.push(`action verb: ${verb}`);
  if (hasGatewayNearby(index, activity.id)) reasons.push("gateway 인접/프로세스 내 분기 존재");

  const systemIds = getOutgoing(index, activity.id, "usesSystem").map((e) => e.target);

  return {
    id: `automation-activity-${activity.id}`,
    category: "automation",
    title,
    question: "어떤 activity가 자동화 검토 후보인가?",
    answer,
    explanation:
      "현재 모델 기준 구조적 자동화 신호이며, 자동화 유형·범위는 현업 검증이 필요합니다.",
    severity: picked.score >= 8 ? "high" : picked.score >= 5 ? "medium" : "info",
    score: picked.score,
    reasons,
    metrics: {
      "후보 유형": typeLabel,
      "프로세스": getNodeLabel(index.nodesById.get(processId)),
    },
    evidence: buildActivityEvidence(activity.id, processId, systemIds),
    markdown: buildAutomationMarkdown(title, answer, reasons, typeLabel),
  };
}

function sequenceToInsightCard(
  index: GraphIndex,
  cluster: SequenceCluster,
  classification: ReturnType<typeof classifySequenceCluster>,
): InsightCard {
  const pattern = cluster.representativePattern;
  const typeLabel = AUTOMATION_TYPE_LABELS[classification.automationType];
  const title = `자동화 후보: ${pattern}`;
  const answer = `이 task sequence는 ${typeLabel} 및 ${classification.refinement}로 검토할 수 있습니다.`;
  const reasons = [
    ...cluster.reasons,
    `프로세스 ${cluster.processIds.length}개에서 반복`,
    classification.refinement,
  ];

  return {
    id: `automation-sequence-${cluster.id}`,
    category: "automation",
    title,
    question: "어떤 반복 sequence가 자동화/모듈화 검토 후보인가?",
    answer,
    explanation:
      "유사 task sequence mining 기반 구조적 신호이며, 모듈/스킬 경계는 현업 검증이 필요합니다.",
    severity: classification.score >= 15 ? "high" : classification.score >= 8 ? "medium" : "info",
    score: classification.score,
    reasons,
    metrics: {
      "후보 유형": typeLabel,
      "정제 라벨": classification.refinement,
      "반복 프로세스": cluster.processIds.length,
      "sequence 길이": cluster.sequences[0]?.activityIds.length ?? 0,
    },
    evidence: buildSequenceEvidence(cluster),
    markdown: buildAutomationMarkdown(title, answer, reasons, `${typeLabel} / ${classification.refinement}`),
  };
}

export function rankAutomationCandidates(
  graph: ProcessGraph,
  options?: { limit?: number },
  index?: GraphIndex,
): InsightCard[] {
  const limit = options?.limit ?? 10;
  const resolvedIndex = index ?? buildGraphIndex(graph);
  const activities = resolvedIndex.nodesByType.get("ProcessActivity") ?? [];

  const activityCards: InsightCard[] = [];
  for (const activity of activities) {
    const processId = findParentProcessId(resolvedIndex, activity.id);
    if (!processId) continue;
    const picked = pickAutomationType(resolvedIndex, activity, processId);
    if (!picked) continue;
    activityCards.push(activityToInsightCard(resolvedIndex, activity, processId, picked));
  }

  const sequences = extractTaskSequences(graph, undefined, resolvedIndex);
  const clusters = clusterSequences(sequences, 2, 50);
  const sequenceCards = clusters
    .slice(0, Math.max(5, Math.ceil(limit / 2)))
    .map((cluster) => {
      const classification = classifySequenceCluster(cluster);
      return sequenceToInsightCard(resolvedIndex, cluster, classification);
    });

  const combined = [...activityCards, ...sequenceCards]
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, limit);

  const deduped = new Map<string, InsightCard>();
  for (const card of combined) deduped.set(card.id, card);
  return [...deduped.values()];
}

export { AUTOMATION_CAVEAT };
