import type { GraphNode, ProcessGraph } from "../graph/types";
import { normalizeActivityKind } from "../shared/normalize";
import {
  buildGraphIndex,
  findParentProcessId,
  getIncoming,
  getNodeLabel,
  getOutgoing,
  getTargets,
  type GraphIndex,
} from "./graphIndex";
import type { EvidenceRef, InsightCard } from "./types";

export interface TaskSignature {
  activityId: string;
  processId: string;
  label: string;
  normalizedLabel: string;
  actionVerb: string;
  objectTokens: string[];
  bpmnType: string;
  normalizedKind?: string;
  systemIds: string[];
  organizationIds: string[];
}

export interface TaskSequence {
  id: string;
  processId: string;
  activityIds: string[];
  signatures: TaskSignature[];
  actionPattern: string;
  labelPattern: string;
  bpmnTypePattern: string;
  systemIds: string[];
  organizationIds: string[];
}

export interface SequenceCluster {
  id: string;
  representativePattern: string;
  sequences: TaskSequence[];
  processIds: string[];
  score: number;
  reasons: string[];
  evidenceNodeIds: string[];
  evidenceEdgeIds: string[];
}

const ACTION_GROUPS: Record<string, string[]> = {
  check: ["확인", "조회", "점검", "검토", "파악"],
  analyze: ["분석", "판단", "평가", "산정", "진단"],
  notify: ["통보", "공유", "전달", "발송", "안내"],
  request: ["요청", "의뢰", "등록", "접수"],
  approve: ["승인", "결재", "확정"],
  act: ["조치", "처리", "수행", "반영", "적용"],
  collect: ["수집", "취합", "입력", "업로드"],
};

const ALL_ACTION_WORDS = new Set(
  Object.values(ACTION_GROUPS).flatMap((words) => words),
);

const MAX_SEQUENCES_PER_PROCESS = 300;

export function normalizeActivityLabel(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[()[\]{}.,;:!?'"`~]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenizeLabel(label: string): string[] {
  const normalized = normalizeActivityLabel(label);
  if (!normalized) return [];
  return normalized.split(/[\s/|>-]+/).filter((token) => token.length > 0);
}

export function inferActionVerb(tokens: string[]): string {
  for (const token of tokens) {
    for (const [verb, words] of Object.entries(ACTION_GROUPS)) {
      if (words.some((word) => token.includes(word) || word.includes(token))) {
        return verb;
      }
    }
  }
  return "other";
}

export function extractObjectTokens(tokens: string[]): string[] {
  return tokens.filter((token) => !ALL_ACTION_WORDS.has(token));
}

function getOrganizationsForActivity(index: GraphIndex, activityId: string): string[] {
  const orgIds = new Set<string>();
  for (const edge of getIncoming(index, activityId, "performedByOrganization")) {
    orgIds.add(edge.source);
  }
  for (const laneEdge of getOutgoing(index, activityId, "assignedToLane")) {
    for (const orgEdge of getOutgoing(index, laneEdge.target, "performedByOrganization")) {
      orgIds.add(orgEdge.target);
    }
  }
  return [...orgIds];
}

function getSystemsForActivity(index: GraphIndex, activityId: string): string[] {
  return getOutgoing(index, activityId, "usesSystem").map((edge) => edge.target);
}

export function createTaskSignature(
  activityNode: GraphNode,
  processId: string,
  index: GraphIndex,
): TaskSignature {
  const label = getNodeLabel(activityNode);
  const normalizedLabel = normalizeActivityLabel(label);
  const tokens = tokenizeLabel(label);
  const actionVerb = inferActionVerb(tokens);
  const objectTokens = extractObjectTokens(tokens);
  const bpmnType =
    typeof activityNode.properties.bpmnType === "string"
      ? activityNode.properties.bpmnType
      : "task";
  const normalizedKind =
    typeof activityNode.properties.normalizedKind === "string"
      ? activityNode.properties.normalizedKind
      : normalizeActivityKind(bpmnType);

  return {
    activityId: activityNode.id,
    processId,
    label,
    normalizedLabel,
    actionVerb,
    objectTokens,
    bpmnType,
    normalizedKind,
    systemIds: getSystemsForActivity(index, activityNode.id),
    organizationIds: getOrganizationsForActivity(index, activityNode.id),
  };
}

function buildProcessActivityAdjacency(
  index: GraphIndex,
  processId: string,
): Map<string, string[]> {
  const adjacency = new Map<string, string[]>();
  const activities = getTargets(index, processId, "hasActivity");

  for (const activity of activities) {
    adjacency.set(activity.id, []);
  }

  for (const activity of activities) {
    for (const edge of getOutgoing(index, activity.id, "isFollowedBy")) {
      const target = index.nodesById.get(edge.target);
      if (target?.type !== "ProcessActivity") continue;
      const parentProcessId = findParentProcessId(index, edge.target);
      if (parentProcessId !== processId) continue;
      const next = adjacency.get(activity.id) ?? [];
      next.push(edge.target);
      adjacency.set(activity.id, next);
    }
  }

  return adjacency;
}

function collectPaths(
  startId: string,
  adjacency: Map<string, string[]>,
  minLength: number,
  maxLength: number,
  paths: string[][],
  maxPaths: number,
): void {
  const stack: string[][] = [[startId]];

  while (stack.length > 0 && paths.length < maxPaths) {
    const path = stack.pop()!;
    const lastId = path[path.length - 1];

    if (path.length >= minLength) {
      paths.push([...path]);
    }

    if (path.length >= maxLength) continue;

    for (const nextId of adjacency.get(lastId) ?? []) {
      if (path.includes(nextId)) continue;
      stack.push([...path, nextId]);
    }
  }
}

function unionUnique(values: string[][]): string[] {
  return [...new Set(values.flat())];
}

export function extractTaskSequences(
  graph: ProcessGraph,
  options?: { minLength?: number; maxLength?: number },
  index?: GraphIndex,
): TaskSequence[] {
  const minLength = options?.minLength ?? 3;
  const maxLength = options?.maxLength ?? 5;
  const resolvedIndex = index ?? buildGraphIndex(graph);
  const sequences: TaskSequence[] = [];

  for (const process of resolvedIndex.nodesByType.get("Process") ?? []) {
    const adjacency = buildProcessActivityAdjacency(resolvedIndex, process.id);
    const activityIds = [...adjacency.keys()];
    const paths: string[][] = [];

    for (const startId of activityIds) {
      if (paths.length >= MAX_SEQUENCES_PER_PROCESS) break;
      collectPaths(
        startId,
        adjacency,
        minLength,
        maxLength,
        paths,
        MAX_SEQUENCES_PER_PROCESS,
      );
    }

    for (const activityPath of paths) {
      const signatures = activityPath.map((activityId) => {
        const node = resolvedIndex.nodesById.get(activityId)!;
        return createTaskSignature(node, process.id, resolvedIndex);
      });

      const actionPattern = signatures.map((sig) => sig.actionVerb).join(" -> ");
      const labelPattern = signatures.map((sig) => sig.normalizedLabel).join(" -> ");
      const bpmnTypePattern = signatures.map((sig) => sig.bpmnType).join(" -> ");

      sequences.push({
        id: `seq-${process.id}-${activityPath.join("-")}`,
        processId: process.id,
        activityIds: activityPath,
        signatures,
        actionPattern,
        labelPattern,
        bpmnTypePattern,
        systemIds: unionUnique(signatures.map((sig) => sig.systemIds)),
        organizationIds: unionUnique(signatures.map((sig) => sig.organizationIds)),
      });
    }
  }

  return sequences;
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const value of a) {
    if (b.has(value)) intersection += 1;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function labelTokenSet(sequence: TaskSequence): Set<string> {
  const tokens = new Set<string>();
  for (const signature of sequence.signatures) {
    for (const token of tokenizeLabel(signature.label)) {
      tokens.add(token);
    }
    for (const objectToken of signature.objectTokens) {
      tokens.add(objectToken);
    }
  }
  return tokens;
}

export function calculateSequenceSimilarity(a: TaskSequence, b: TaskSequence): number {
  let actionPatternSimilarity = 0;
  if (a.actionPattern === b.actionPattern) {
    actionPatternSimilarity = 1;
  } else {
    const verbsA = new Set(a.signatures.map((sig) => sig.actionVerb));
    const verbsB = new Set(b.signatures.map((sig) => sig.actionVerb));
    actionPatternSimilarity = jaccardSimilarity(verbsA, verbsB);
  }

  const labelTokenSimilarity = jaccardSimilarity(labelTokenSet(a), labelTokenSet(b));

  let bpmnTypeSimilarity = 0;
  if (a.bpmnTypePattern === b.bpmnTypePattern) {
    bpmnTypeSimilarity = 1;
  } else {
    const typesA = new Set(a.signatures.map((sig) => sig.bpmnType));
    const typesB = new Set(b.signatures.map((sig) => sig.bpmnType));
    bpmnTypeSimilarity = jaccardSimilarity(typesA, typesB);
  }

  const sharedSystems = jaccardSimilarity(new Set(a.systemIds), new Set(b.systemIds));
  const sharedOrganizations = jaccardSimilarity(
    new Set(a.organizationIds),
    new Set(b.organizationIds),
  );

  const score =
    actionPatternSimilarity * 40 +
    labelTokenSimilarity * 30 +
    bpmnTypeSimilarity * 15 +
    sharedSystems * 10 +
    sharedOrganizations * 5;

  return Math.min(100, Math.max(0, score));
}

function intersectionCount(a: string[], b: string[]): number {
  const setB = new Set(b);
  let count = 0;
  for (const value of a) {
    if (setB.has(value)) count += 1;
  }
  return count;
}

function buildSequenceEvidence(
  index: GraphIndex,
  cluster: SequenceCluster,
): EvidenceRef {
  const nodeIds = new Set<string>();
  const edgeIds: string[] = [];

  for (const sequence of cluster.sequences.slice(0, 5)) {
    nodeIds.add(sequence.processId);
    for (const activityId of sequence.activityIds) {
      nodeIds.add(activityId);
    }
  }

  const sharedSystems = new Set<string>();
  const sharedOrganizations = new Set<string>();
  if (cluster.sequences.length > 0) {
    let systems = cluster.sequences[0].systemIds;
    let orgs = cluster.sequences[0].organizationIds;
    for (const sequence of cluster.sequences.slice(1)) {
      systems = systems.filter((id) => sequence.systemIds.includes(id));
      orgs = orgs.filter((id) => sequence.organizationIds.includes(id));
    }
    for (const id of systems.slice(0, 3)) sharedSystems.add(id);
    for (const id of orgs.slice(0, 3)) sharedOrganizations.add(id);
  }

  for (const id of sharedSystems) nodeIds.add(id);
  for (const id of sharedOrganizations) nodeIds.add(id);

  for (const sequence of cluster.sequences.slice(0, 3)) {
    for (let i = 0; i < sequence.activityIds.length - 1; i += 1) {
      const source = sequence.activityIds[i];
      const target = sequence.activityIds[i + 1];
      for (const edge of getOutgoing(index, source, "isFollowedBy")) {
        if (edge.target === target) {
          edgeIds.push(edge.id);
        }
      }
    }
  }

  return {
    nodeIds: [...nodeIds].slice(0, 20),
    edgeIds: edgeIds.slice(0, 15),
    summary:
      "공통 Task Sequence 근거: 대표 activity, 프로세스, 공유 시스템·조직만 포함합니다.",
  };
}

function clusterSequences(
  sequences: TaskSequence[],
  minProcesses: number,
  minScore: number,
): SequenceCluster[] {
  const byActionPattern = new Map<string, TaskSequence[]>();
  for (const sequence of sequences) {
    const bucket = byActionPattern.get(sequence.actionPattern) ?? [];
    bucket.push(sequence);
    byActionPattern.set(sequence.actionPattern, bucket);
  }

  const clusters: SequenceCluster[] = [];

  for (const [actionPattern, group] of byActionPattern.entries()) {
    const processIds = [...new Set(group.map((seq) => seq.processId))];
    if (processIds.length < minProcesses) continue;

    let averageSimilarity = 100;
    if (group.length > 1) {
      let total = 0;
      let pairs = 0;
      for (let i = 0; i < group.length; i += 1) {
        for (let j = i + 1; j < group.length; j += 1) {
          total += calculateSequenceSimilarity(group[i], group[j]);
          pairs += 1;
        }
      }
      averageSimilarity = pairs > 0 ? total / pairs : 100;
    }

    if (averageSimilarity < minScore) continue;

    const sharedSystemIds = group.reduce((acc, seq, idx) => {
      if (idx === 0) return [...seq.systemIds];
      return acc.filter((id) => seq.systemIds.includes(id));
    }, [] as string[]);

    const sharedOrganizationIds = group.reduce((acc, seq, idx) => {
      if (idx === 0) return [...seq.organizationIds];
      return acc.filter((id) => seq.organizationIds.includes(id));
    }, [] as string[]);

    const clusterScore =
      processIds.length * 10 +
      group.length * 3 +
      averageSimilarity +
      sharedSystemIds.length * 2 +
      sharedOrganizationIds.length * 2;

    const representativePattern =
      group[0]?.signatures.map((sig) => sig.label).join(" -> ") ?? actionPattern;

    const reasons = [
      `${processIds.length}개 프로세스에서 유사 sequence가 발견되었습니다.`,
      `공통 action pattern: ${actionPattern}`,
    ];
    if (sharedSystemIds.length > 0) {
      reasons.push(`공통 사용 시스템 ${sharedSystemIds.length}개`);
    }
    if (sharedOrganizationIds.length > 0) {
      reasons.push(`공통 관여 조직 ${sharedOrganizationIds.length}개`);
    }

    clusters.push({
      id: `cluster-${actionPattern.replace(/\s+/g, "-")}-${processIds.length}`,
      representativePattern,
      sequences: group,
      processIds,
      score: clusterScore,
      reasons,
      evidenceNodeIds: [],
      evidenceEdgeIds: [],
    });
  }

  return clusters.sort((a, b) => b.score - a.score);
}

function buildSequenceMarkdown(
  title: string,
  answer: string,
  cluster: SequenceCluster,
  processLabels: string[],
  recommendedActions: string[],
): string {
  return [
    `### ${title}`,
    "",
    `**결론:** ${answer}`,
    "",
    "**반복 패턴:**",
    `- action: ${cluster.sequences[0]?.actionPattern ?? ""}`,
    `- label: ${cluster.representativePattern}`,
    "",
    "**등장 프로세스:**",
    ...processLabels.map((label) => `- ${label}`),
    "",
    "**공통 특징:**",
    ...cluster.reasons.map((reason) => `- ${reason}`),
    "",
    "**추천 조치:**",
    ...recommendedActions.map((action) => `- ${action}`),
    "",
    "**주의사항:**",
    "LLM semantic matching은 현재 적용하지 않으며, label/action dictionary 기반 유사도입니다.",
    "단일 프로세스 동일성 또는 운영 자동화가 이미 결정된 것을 뜻하지 않습니다. 표준화·모듈화 검토 후보입니다.",
  ].join("\n");
}

function clusterToInsightCard(
  index: GraphIndex,
  cluster: SequenceCluster,
): InsightCard {
  const processCount = cluster.processIds.length;
  const answer = `이 task sequence는 ${processCount}개 프로세스에서 유사하게 반복되어 공통 Process Module 또는 Agent Skill 후보로 검토할 수 있습니다.`;
  const title = `공통 Task Sequence 후보: ${cluster.representativePattern}`;
  const recommendedActions = [
    "공통 입력/출력 데이터가 같은지 확인",
    "예외 처리 차이를 확인",
    "공통 Process Module 또는 Call Activity로 분리 가능한지 검토",
    "Agent Skill 후보로 정의 가능한지 검토",
  ];

  const processLabels = cluster.processIds.map((processId) =>
    getNodeLabel(index.nodesById.get(processId)),
  );

  const evidence = buildSequenceEvidence(index, cluster);

  return {
    id: `redesign-task_sequence-${cluster.id}`,
    category: "redesign",
    title,
    question: "여러 프로세스에서 반복되는 유사 업무 흐름이 있는가?",
    answer,
    explanation:
      "이 분석은 BPMN isFollowedBy와 activity label/action pattern을 기반으로 유사한 local task sequence를 찾습니다. 의미적 동일성은 현업 검증이 필요합니다.",
    severity: cluster.score >= 40 ? "high" : cluster.score >= 20 ? "medium" : "info",
    score: cluster.score,
    reasons: cluster.reasons,
    metrics: {
      "추천 유형": "공통 Task Sequence",
      "등장 프로세스 수": processCount,
      "sequence 수": cluster.sequences.length,
      "action pattern": cluster.sequences[0]?.actionPattern ?? "",
      "기대 효과":
        "공통 모듈·Call Activity·Agent Skill 후보를 식별하여 표준화 검토를 지원합니다.",
      "검증 필요": "입력/출력, 예외 처리, SLA, 책임 조직 차이는 현업 검증이 필요합니다.",
      "권장 조치": recommendedActions.join("; "),
    },
    evidence,
    markdown: buildSequenceMarkdown(
      title,
      answer,
      cluster,
      processLabels,
      recommendedActions,
    ),
  };
}

export function rankSimilarTaskSequenceClusters(
  graph: ProcessGraph,
  options?: {
    limit?: number;
    minScore?: number;
    minProcesses?: number;
  },
  index?: GraphIndex,
): InsightCard[] {
  const limit = options?.limit ?? 50;
  const minScore = options?.minScore ?? 60;
  const minProcesses = options?.minProcesses ?? 2;
  const resolvedIndex = index ?? buildGraphIndex(graph);

  const sequences = extractTaskSequences(graph, undefined, resolvedIndex);
  const clusters = clusterSequences(sequences, minProcesses, minScore);

  return clusters.slice(0, limit).map((cluster) => clusterToInsightCard(resolvedIndex, cluster));
}

export {
  ACTION_GROUPS,
  buildProcessActivityAdjacency,
  clusterSequences,
  intersectionCount,
};
