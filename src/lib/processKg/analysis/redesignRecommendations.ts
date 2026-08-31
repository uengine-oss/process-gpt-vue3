import type { GraphNode, ProcessGraph } from "../graph/types";
import { HANDOFF_BPMN_TYPES } from "./competencyQuestions";
import {
  buildGraphIndex,
  getIncoming,
  getNodeLabel,
  getOutgoing,
  getTargets,
  type GraphIndex,
} from "./graphIndex";
import type { EvidenceRef, InsightCard, RedesignRecommendationType } from "./types";
import { rankSimilarTaskSequenceClusters } from "./sequenceMining";

const MERGE_WEIGHTS = {
  organization: 3,
  system: 2,
  dataStore: 2,
  manual: 1,
  similarLabel: 1.5,
  similarType: 0.5,
  sharedReference: 2,
} as const;

const SPLIT_WEIGHTS = {
  activity: 1,
  gateway: 2,
  organization: 3,
  system: 2,
  handoff: 2.5,
  callActivity: 3,
} as const;

const MODULE_WEIGHTS = {
  parentCall: 5,
  handoffReference: 3,
  repeatedPattern: 2,
} as const;

const MAX_MERGE_PAIRS = 800;
const MIN_MERGE_SCORE = 6;

export const REDESIGN_TYPE_LABELS: Record<RedesignRecommendationType, string> = {
  process_merge: "통합",
  process_split: "분리",
  process_module: "모듈화",
  cross_org_handoff: "조직간 Handoff",
  rr_clarification: "R&R",
  ownership_realignment: "Ownership",
  task_sequence: "공통 Task Sequence",
};

const REDESIGN_CAVEAT =
  "이 결과는 PI/운영모델 재설계 검토 후보이며, 최종 결정이 아닙니다. 프로세스 오너 검토, 업무량 데이터, 비즈니스 제약, 조직 맥락 검증이 필요합니다.";

interface ProcessProfile {
  id: string;
  label: string;
  processModelId?: string;
  organizationIds: Set<string>;
  systemIds: Set<string>;
  supplierIds: Set<string>;
  dataStoreIds: Set<string>;
  manualIds: Set<string>;
  calledModelIds: Set<string>;
  activityIds: string[];
  activityLabels: string[];
  activityTypes: string[];
  gatewayCount: number;
  handoffTaskCount: number;
  callActivityCount: number;
  activityCount: number;
  organizationCount: number;
  systemCount: number;
  activitiesWithoutResponsibility: string[];
  handoffActivityIds: string[];
}

function normalizeLabel(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, " ");
}

function isHandoffActivity(node: GraphNode): boolean {
  const bpmnType = node.properties.bpmnType;
  if (typeof bpmnType === "string" && HANDOFF_BPMN_TYPES.has(bpmnType)) return true;
  return Boolean(node.properties.definitionId);
}

function isCallActivity(node: GraphNode): boolean {
  return node.properties.bpmnType === "callActivity" || Boolean(node.properties.definitionId);
}

function activityHasResponsibility(index: GraphIndex, activityId: string): boolean {
  return (
    getOutgoing(index, activityId, "assignedToLane").length > 0 ||
    getIncoming(index, activityId, "performedByOrganization").length > 0
  );
}

function getProcessModelId(index: GraphIndex, processId: string): string | undefined {
  for (const edge of getIncoming(index, processId, "definesProcess")) {
    const source = index.nodesById.get(edge.source);
    if (source?.type === "ProcessModel") return edge.source;
  }
  return undefined;
}

function buildProcessProfile(index: GraphIndex, processId: string): ProcessProfile {
  const process = index.nodesById.get(processId);
  const activities = getTargets(index, processId, "hasActivity");
  const gateways = getTargets(index, processId, "containsElement").filter(
    (n) => n.type === "Gateway",
  );

  const organizationIds = new Set(
    getTargets(index, processId, "performedByOrganization").map((n) => n.id),
  );
  const systemIds = new Set(getTargets(index, processId, "usesSystem").map((n) => n.id));
  const supplierIds = new Set(
    getTargets(index, processId, "performedBySupplier").map((n) => n.id),
  );
  const dataStoreIds = new Set(
    getTargets(index, processId, "referencesDataStore").map((n) => n.id),
  );

  const manualIds = new Set<string>();
  const calledModelIds = new Set<string>();
  const activityLabels: string[] = [];
  const activityTypes: string[] = [];
  const activityIds: string[] = [];
  const activitiesWithoutResponsibility: string[] = [];
  const handoffActivityIds: string[] = [];
  let handoffTaskCount = 0;
  let callActivityCount = 0;

  for (const activity of activities) {
    activityIds.push(activity.id);
    activityLabels.push(normalizeLabel(getNodeLabel(activity)));
    const bpmnType = activity.properties.bpmnType;
    if (typeof bpmnType === "string") activityTypes.push(bpmnType);

    if (!activityHasResponsibility(index, activity.id)) {
      activitiesWithoutResponsibility.push(activity.id);
    }
    if (isHandoffActivity(activity)) {
      handoffTaskCount += 1;
      handoffActivityIds.push(activity.id);
    }
    if (isCallActivity(activity)) callActivityCount += 1;

    for (const edge of getOutgoing(index, activity.id, "hasManual")) {
      manualIds.add(edge.target);
    }
    for (const edge of getOutgoing(index, activity.id, "usesSystem")) {
      systemIds.add(edge.target);
    }

    const definitionId = activity.properties.definitionId;
    if (typeof definitionId === "string" && definitionId.trim()) {
      calledModelIds.add(definitionId.trim());
    }
  }

  for (const activity of activities) {
    for (const edge of getIncoming(index, activity.id, "performedByOrganization")) {
      organizationIds.add(edge.source);
    }
    for (const laneEdge of getOutgoing(index, activity.id, "assignedToLane")) {
      for (const orgEdge of getOutgoing(index, laneEdge.target, "performedByOrganization")) {
        organizationIds.add(orgEdge.target);
      }
    }
  }

  return {
    id: processId,
    label: getNodeLabel(process),
    processModelId: getProcessModelId(index, processId),
    organizationIds,
    systemIds,
    supplierIds,
    dataStoreIds,
    manualIds,
    calledModelIds,
    activityIds,
    activityLabels,
    activityTypes,
    gatewayCount: gateways.length,
    handoffTaskCount,
    callActivityCount,
    activityCount: activities.length,
    organizationCount: organizationIds.size,
    systemCount: systemIds.size,
    activitiesWithoutResponsibility,
    handoffActivityIds,
  };
}

function intersectionSize(a: Set<string>, b: Set<string>): number {
  let count = 0;
  for (const id of a) {
    if (b.has(id)) count += 1;
  }
  return count;
}

function countLabelOverlap(a: string[], b: string[]): number {
  const setB = new Set(b);
  let count = 0;
  for (const label of a) {
    if (label && setB.has(label)) count += 1;
  }
  return count;
}

function countTypeOverlap(a: string[], b: string[]): number {
  const setB = new Set(b);
  let count = 0;
  for (const type of a) {
    if (type && setB.has(type)) count += 1;
  }
  return count;
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function severityFromScore(score: number): "info" | "medium" | "high" {
  if (score >= 40) return "high";
  if (score >= 15) return "medium";
  return "info";
}

function buildRedesignMarkdown(
  title: string,
  answer: string,
  reasons: string[],
  expectedBenefit: string,
  validationNeeded: string,
  recommendedActions: string[],
): string {
  return [
    `### ${title}`,
    "",
    `**결론:** ${answer}`,
    "",
    "**근거:**",
    ...reasons.map((r) => `- ${r}`),
    "",
    "**기대 효과:**",
    expectedBenefit,
    "",
    "**검증 필요:**",
    validationNeeded,
    "",
    "**권장 조치:**",
    ...recommendedActions.map((a) => `- ${a}`),
    "",
    "**주의:**",
    REDESIGN_CAVEAT,
  ].join("\n");
}

function toInsightCard(
  id: string,
  type: RedesignRecommendationType,
  title: string,
  answer: string,
  explanation: string,
  score: number,
  reasons: string[],
  expectedBenefit: string,
  validationNeeded: string,
  recommendedActions: string[],
  evidence: EvidenceRef,
  metrics: Record<string, number | string>,
): InsightCard {
  return {
    id,
    category: "redesign",
    title,
    question: "이 그래프 구조를 기반으로 어떤 프로세스/조직 재설계를 검토할 수 있는가?",
    answer,
    explanation,
    severity: severityFromScore(score),
    score,
    reasons,
    metrics: {
      "추천 유형": REDESIGN_TYPE_LABELS[type],
      "기대 효과": expectedBenefit,
      "검증 필요": validationNeeded,
      "권장 조치": recommendedActions.join("; "),
      ...metrics,
    },
    evidence,
    markdown: buildRedesignMarkdown(
      title,
      answer,
      reasons,
      expectedBenefit,
      validationNeeded,
      recommendedActions,
    ),
  };
}

function computeMergeScore(a: ProcessProfile, b: ProcessProfile): number {
  const sharedOrganizationCount = intersectionSize(a.organizationIds, b.organizationIds);
  const sharedSystemCount = intersectionSize(a.systemIds, b.systemIds);
  const sharedDataStoreCount = intersectionSize(a.dataStoreIds, b.dataStoreIds);
  const sharedManualCount = intersectionSize(a.manualIds, b.manualIds);
  const similarActivityLabelCount = countLabelOverlap(a.activityLabels, b.activityLabels);
  const similarActivityTypeCount = countTypeOverlap(a.activityTypes, b.activityTypes);
  const sharedReferenceCount = intersectionSize(a.calledModelIds, b.calledModelIds);

  return (
    sharedOrganizationCount * MERGE_WEIGHTS.organization +
    sharedSystemCount * MERGE_WEIGHTS.system +
    sharedDataStoreCount * MERGE_WEIGHTS.dataStore +
    sharedManualCount * MERGE_WEIGHTS.manual +
    similarActivityLabelCount * MERGE_WEIGHTS.similarLabel +
    similarActivityTypeCount * MERGE_WEIGHTS.similarType +
    sharedReferenceCount * MERGE_WEIGHTS.sharedReference
  );
}

function buildMergeEvidence(
  index: GraphIndex,
  profileA: ProcessProfile,
  profileB: ProcessProfile,
): EvidenceRef {
  const nodeIds = new Set<string>([profileA.id, profileB.id]);
  const edgeIds: string[] = [];

  const sharedOrgs = [...profileA.organizationIds].filter((id) =>
    profileB.organizationIds.has(id),
  );
  const sharedSystems = [...profileA.systemIds].filter((id) =>
    profileB.systemIds.has(id),
  );

  for (const orgId of sharedOrgs.slice(0, 3)) nodeIds.add(orgId);
  for (const sysId of sharedSystems.slice(0, 3)) nodeIds.add(sysId);

  const sharedLabels = new Set(
    profileA.activityLabels.filter((l) => profileB.activityLabels.includes(l)),
  );
  let rep = 0;
  for (const activityId of profileA.activityIds) {
    if (rep >= 3) break;
    const activity = index.nodesById.get(activityId);
    if (activity && sharedLabels.has(normalizeLabel(getNodeLabel(activity)))) {
      nodeIds.add(activityId);
      rep += 1;
    }
  }

  return {
    nodeIds: [...nodeIds],
    edgeIds,
    summary:
      "통합 검토 후보 근거: 두 프로세스와 공유 조직·시스템·유사 activity 예시만 포함합니다.",
  };
}

export function rankProcessMergeCandidates(
  graph: ProcessGraph,
  options?: { limit?: number },
  index?: GraphIndex,
): InsightCard[] {
  const limit = options?.limit ?? 10;
  const resolvedIndex = index ?? buildGraphIndex(graph);
  const processes = resolvedIndex.nodesByType.get("Process") ?? [];
  const profiles = new Map(processes.map((p) => [p.id, buildProcessProfile(resolvedIndex, p.id)]));

  const orgToProcesses = new Map<string, Set<string>>();
  const sysToProcesses = new Map<string, Set<string>>();

  for (const profile of profiles.values()) {
    for (const orgId of profile.organizationIds) {
      const set = orgToProcesses.get(orgId) ?? new Set();
      set.add(profile.id);
      orgToProcesses.set(orgId, set);
    }
    for (const sysId of profile.systemIds) {
      const set = sysToProcesses.get(sysId) ?? new Set();
      set.add(profile.id);
      sysToProcesses.set(sysId, set);
    }
  }

  const candidatePairs = new Map<string, { a: string; b: string; blockScore: number }>();
  const addPairs = (processIds: Set<string>) => {
    const ids = [...processIds];
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        const key = pairKey(ids[i], ids[j]);
        if (!candidatePairs.has(key)) {
          candidatePairs.set(key, { a: ids[i], b: ids[j], blockScore: 1 });
        } else {
          candidatePairs.get(key)!.blockScore += 1;
        }
      }
    }
  };

  for (const set of orgToProcesses.values()) {
    if (set.size > 1 && set.size <= 50) addPairs(set);
  }
  for (const set of sysToProcesses.values()) {
    if (set.size > 1 && set.size <= 50) addPairs(set);
  }

  const rankedPairs = [...candidatePairs.values()]
    .sort((x, y) => y.blockScore - x.blockScore)
    .slice(0, MAX_MERGE_PAIRS)
    .map(({ a, b }) => {
      const profileA = profiles.get(a)!;
      const profileB = profiles.get(b)!;
      const score = computeMergeScore(profileA, profileB);
      return { profileA, profileB, score };
    })
    .filter((item) => item.score >= MIN_MERGE_SCORE)
    .sort((x, y) => y.score - x.score)
    .slice(0, limit);

  return rankedPairs.map(({ profileA, profileB, score }) => {
    const title = `프로세스 통합 검토 후보: ${profileA.label} ↔ ${profileB.label}`;
    const answer = `두 프로세스는 수행 조직, 사용 시스템, activity 구조가 유사하여 공통 Process Module 또는 표준 프로세스로 통합 검토할 수 있습니다.`;
    const reasons = [
      `공유 조직 ${intersectionSize(profileA.organizationIds, profileB.organizationIds)}개`,
      `공유 시스템 ${intersectionSize(profileA.systemIds, profileB.systemIds)}개`,
      `유사 activity 라벨 ${countLabelOverlap(profileA.activityLabels, profileB.activityLabels)}개`,
    ];
    const expectedBenefit =
      "중복 프로세스를 표준화하면 운영 일관성, 교육 비용, 시스템 연계 복잡도를 줄일 수 있습니다.";
    const validationNeeded =
      "업무 목적, 예외 처리, 규제 요건, 조직별 책임 차이는 현업 검증이 필요합니다.";
    const recommendedActions = [
      "프로세스 오너와 통합/표준화 범위 워크숍을 진행합니다.",
      "차이 activity와 예외 시나리오를 비교합니다.",
      "통합 시 공통 Process Module 후보를 식별합니다.",
    ];

    return toInsightCard(
      `redesign-process_merge-${pairKey(profileA.id, profileB.id)}`,
      "process_merge",
      title,
      answer,
      "구조적 유사성 기반 통합 검토 후보이며, 통합 확정을 의미하지 않습니다.",
      score,
      reasons,
      expectedBenefit,
      validationNeeded,
      recommendedActions,
      buildMergeEvidence(resolvedIndex, profileA, profileB),
      { "통합 검토 점수": score.toFixed(1) },
    );
  });
}

function buildSplitEvidence(index: GraphIndex, profile: ProcessProfile): EvidenceRef {
  const nodeIds = new Set<string>([profile.id]);
  const edgeIds: string[] = [];

  for (const orgId of [...profile.organizationIds].slice(0, 3)) nodeIds.add(orgId);
  for (const sysId of [...profile.systemIds].slice(0, 3)) nodeIds.add(sysId);
  for (const activityId of profile.handoffActivityIds.slice(0, 5)) {
    nodeIds.add(activityId);
  }

  return {
    nodeIds: [...nodeIds],
    edgeIds,
    summary: "분리 검토 후보 근거: 프로세스와 대표 조직·시스템·handoff activity만 포함합니다.",
  };
}

export function rankProcessSplitCandidates(
  graph: ProcessGraph,
  options?: { limit?: number },
  index?: GraphIndex,
): InsightCard[] {
  const limit = options?.limit ?? 10;
  const resolvedIndex = index ?? buildGraphIndex(graph);
  const processes = resolvedIndex.nodesByType.get("Process") ?? [];

  const ranked = processes
    .map((process) => {
      const profile = buildProcessProfile(resolvedIndex, process.id);
      const score =
        profile.activityCount * SPLIT_WEIGHTS.activity +
        profile.gatewayCount * SPLIT_WEIGHTS.gateway +
        profile.organizationCount * SPLIT_WEIGHTS.organization +
        profile.systemCount * SPLIT_WEIGHTS.system +
        profile.handoffTaskCount * SPLIT_WEIGHTS.handoff +
        profile.callActivityCount * SPLIT_WEIGHTS.callActivity;

      return { profile, score };
    })
    .filter((item) => item.score >= 12)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return ranked.map(({ profile, score }) => {
    const title = `프로세스 분리 검토 후보: ${profile.label}`;
    const answer = `이 프로세스는 여러 조직, 시스템, 전달·연계 작업이 하나의 모델에 혼재되어 있어 하위 Process Module 단위로 분리 검토할 수 있습니다.`;
    const reasons = [
      `업무 단계 ${profile.activityCount}개`,
      `관여 조직 ${profile.organizationCount}개`,
      `연결 시스템 ${profile.systemCount}개`,
      `전달·연계 작업 ${profile.handoffTaskCount}개`,
      `callActivity ${profile.callActivityCount}개`,
    ];
    const expectedBenefit =
      "모듈 단위 분리는 책임 경계, 변경 영향도 관리, 자동화 단위 정의를 명확히 할 수 있습니다.";
    const validationNeeded =
      "업무 흐름 연속성, 트랜잭션 경계, 승인 체계는 현업 프로세스 오너 검토가 필요합니다.";
    const recommendedActions = [
      "조직/시스템 경계 기준으로 하위 모듈 후보를 식별합니다.",
      "handoff 지점을 interface rule 후보로 문서화합니다.",
      "분리 후 end-to-end SLA 영향을 평가합니다.",
    ];

    return toInsightCard(
      `redesign-process_split-${profile.id}`,
      "process_split",
      title,
      answer,
      "복잡도 기반 분리 검토 후보이며, 분리 확정을 의미하지 않습니다.",
      score,
      reasons,
      expectedBenefit,
      validationNeeded,
      recommendedActions,
      buildSplitEvidence(resolvedIndex, profile),
      {
        "분리 검토 점수": score.toFixed(1),
        "업무 단계": profile.activityCount,
        "관여 조직": profile.organizationCount,
      },
    );
  });
}

function buildModuleEvidence(index: GraphIndex, modelId: string): EvidenceRef {
  const nodeIds = new Set<string>([modelId]);
  const edgeIds: string[] = [];

  const callEdges = getIncoming(index, modelId, "callsProcessModel").slice(0, 5);
  const handoffEdges = getIncoming(index, modelId, "handsOffToProcessModel").slice(0, 5);

  for (const edge of [...callEdges, ...handoffEdges]) {
    edgeIds.push(edge.id);
    nodeIds.add(edge.source);
    nodeIds.add(edge.target);
  }

  return {
    nodeIds: [...nodeIds],
    edgeIds,
    summary: "모듈화 후보 근거: ProcessModel과 상위 호출/handoff 연결만 포함합니다.",
  };
}

export function rankProcessModuleCandidates(
  graph: ProcessGraph,
  options?: { limit?: number },
  index?: GraphIndex,
): InsightCard[] {
  const limit = options?.limit ?? 10;
  const resolvedIndex = index ?? buildGraphIndex(graph);
  const models = resolvedIndex.nodesByType.get("ProcessModel") ?? [];

  const ranked = models
    .map((model) => {
      const parentCallCount = getIncoming(resolvedIndex, model.id, "callsProcessModel").length;
      const handoffReferenceCount = getIncoming(
        resolvedIndex,
        model.id,
        "handsOffToProcessModel",
      ).length;

      const childProcesses = getTargets(resolvedIndex, model.id, "definesProcess");
      let repeatedActivityPatternCount = 0;
      if (childProcesses.length > 0) {
        const childProfile = buildProcessProfile(resolvedIndex, childProcesses[0].id);
        repeatedActivityPatternCount = Math.min(childProfile.activityCount, parentCallCount);
      }

      const score =
        parentCallCount * MODULE_WEIGHTS.parentCall +
        handoffReferenceCount * MODULE_WEIGHTS.handoffReference +
        repeatedActivityPatternCount * MODULE_WEIGHTS.repeatedPattern;

      return { model, score, parentCallCount, handoffReferenceCount };
    })
    .filter((item) => item.score >= 5)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return ranked.map(({ model, score, parentCallCount, handoffReferenceCount }) => {
    const label = getNodeLabel(model);
    const title = `공통 Process Module 후보: ${label}`;
    const answer = `이 프로세스 모델은 여러 상위 프로세스에서 호출 또는 handoff 대상으로 등장하여 공통 Process Module 또는 Agent Skill 후보로 검토할 수 있습니다.`;
    const reasons = [
      `callsProcessModel 참조 ${parentCallCount}건`,
      `handsOffToProcessModel 참조 ${handoffReferenceCount}건`,
    ];
    const expectedBenefit =
      "공통 모듈화는 재사용성, 표준화, 자동화/Agent 적용 범위를 확대할 수 있습니다.";
    const validationNeeded =
      "모듈 경계, 입력/출력 계약, 버전 관리 정책은 아키텍처·현업 공동 검토가 필요합니다.";
    const recommendedActions = [
      "상위 프로세스별 호출 맥락을 비교합니다.",
      "모듈 I/O와 책임 범위를 정의합니다.",
      "Agent Skill 또는 RPA 후보와 연계 검토합니다.",
    ];

    return toInsightCard(
      `redesign-process_module-${model.id}`,
      "process_module",
      title,
      answer,
      "재사용 신호 기반 모듈화 후보이며, 최종 모듈 채택을 의미하지 않습니다.",
      score,
      reasons,
      expectedBenefit,
      validationNeeded,
      recommendedActions,
      buildModuleEvidence(resolvedIndex, model.id),
      {
        "모듈화 점수": score.toFixed(1),
        "상위 호출 수": parentCallCount,
        "handoff 참조 수": handoffReferenceCount,
      },
    );
  });
}

function buildRrEvidence(
  index: GraphIndex,
  processId: string,
  missingActivityIds: string[],
): EvidenceRef {
  const nodeIds = new Set<string>([processId]);
  for (const activityId of missingActivityIds.slice(0, 10)) {
    nodeIds.add(activityId);
  }
  return {
    nodeIds: [...nodeIds],
    edgeIds: [],
    summary: "R&R 명확화 후보 근거: 프로세스와 책임 미연결 activity 예시만 포함합니다.",
  };
}

export function rankRrClarificationCandidates(
  graph: ProcessGraph,
  options?: { limit?: number },
  index?: GraphIndex,
): InsightCard[] {
  const limit = options?.limit ?? 10;
  const resolvedIndex = index ?? buildGraphIndex(graph);
  const processes = resolvedIndex.nodesByType.get("Process") ?? [];

  const ranked = processes
    .map((process) => {
      const profile = buildProcessProfile(resolvedIndex, process.id);
      const missingCount = profile.activitiesWithoutResponsibility.length;
      const sparseOrgLink =
        profile.activityCount >= 3 &&
        profile.organizationCount <= 1 &&
        missingCount > 0;

      let laneWithoutOrg = 0;
      for (const lane of getTargets(resolvedIndex, process.id, "hasLane")) {
        const hasOrg = getOutgoing(resolvedIndex, lane.id, "performedByOrganization").length > 0;
        const hasSupplier = getOutgoing(resolvedIndex, lane.id, "performedBySupplier").length > 0;
        if (!hasOrg && !hasSupplier) laneWithoutOrg += 1;
      }

      let unclearHandoff = 0;
      for (const activityId of profile.handoffActivityIds) {
        const activity = resolvedIndex.nodesById.get(activityId);
        const bpmnType = activity?.properties.bpmnType;
        if (bpmnType === "sendTask" || bpmnType === "receiveTask") {
          if (!activityHasResponsibility(resolvedIndex, activityId)) unclearHandoff += 1;
        }
      }

      const score =
        missingCount * 3 + laneWithoutOrg * 2 + unclearHandoff * 2 + (sparseOrgLink ? 4 : 0);

      return { profile, score, missingCount, laneWithoutOrg, unclearHandoff, sparseOrgLink };
    })
    .filter((item) => item.score >= 3)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return ranked.map(({ profile, score, missingCount, laneWithoutOrg, unclearHandoff }) => {
    const title = `R&R 명확화 후보: ${profile.label}`;
    const answer = `이 프로세스 또는 activity는 책임 조직/역할 연결이 부족하여 R&R 보완 또는 lane/organization mapping 현행화가 필요합니다.`;
    const reasons = [
      `책임 미연결 activity ${missingCount}개`,
      `조직/공급사 미매핑 lane ${laneWithoutOrg}개`,
      `책임 불명확 send/receive task ${unclearHandoff}개`,
    ];
    const expectedBenefit =
      "R&R 정렬은 CQ 정확도, 조직 분석, handoff SLA 정의의 기반이 됩니다.";
    const validationNeeded =
      "실제 조직 구조, 대행/위탁 관계, 임시 조직은 현업 확인이 필요합니다.";
    const recommendedActions = [
      "lane/organization mapping을 BPMN extension과 함께 현행화합니다.",
      "책임 미연결 activity에 owner role을 지정합니다.",
      "send/receive task의 source/target 조직을 명시합니다.",
    ];

    return toInsightCard(
      `redesign-rr_clarification-${profile.id}`,
      "rr_clarification",
      title,
      answer,
      "R&R 정렬 검토 후보이며, 조직 개편 확정을 의미하지 않습니다.",
      score,
      reasons,
      expectedBenefit,
      validationNeeded,
      recommendedActions,
      buildRrEvidence(resolvedIndex, profile.id, profile.activitiesWithoutResponsibility),
      { "R&R 검토 점수": score.toFixed(1), "책임 미연결 activity": missingCount },
    );
  });
}

export function rankOwnershipRealignmentCandidates(
  graph: ProcessGraph,
  options?: { limit?: number },
  index?: GraphIndex,
): InsightCard[] {
  const limit = options?.limit ?? 10;
  const resolvedIndex = index ?? buildGraphIndex(graph);
  const processes = resolvedIndex.nodesByType.get("Process") ?? [];

  const ranked = processes
    .map((process) => {
      const profile = buildProcessProfile(resolvedIndex, process.id);
      if (profile.organizationCount < 3) return null;

      let activityOrgLinks = 0;
      for (const activityId of profile.activityIds) {
        if (getIncoming(resolvedIndex, activityId, "performedByOrganization").length > 0) {
          activityOrgLinks += 1;
        }
      }
      const coverageRatio =
        profile.activityCount > 0 ? activityOrgLinks / profile.activityCount : 0;
      if (coverageRatio >= 0.6) return null;

      const score =
        profile.organizationCount * 4 +
        profile.handoffTaskCount * 2 +
        (1 - coverageRatio) * 10;

      return { profile, score, coverageRatio, activityOrgLinks };
    })
    .filter((item): item is NonNullable<typeof item> => item != null)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return ranked.map(({ profile, score, coverageRatio, activityOrgLinks }) => {
    const title = `ownership 명확화 후보: ${profile.label}`;
    const answer = `이 프로세스는 다수 조직이 관여하지만 activity-level ownership 연결이 부족하여 ownership 정렬 및 조직 구조 재검토 후보입니다.`;
    const reasons = [
      `관여 조직 ${profile.organizationCount}개`,
      `activity-level ownership 연결 ${activityOrgLinks}/${profile.activityCount}`,
      `ownership coverage ${(coverageRatio * 100).toFixed(0)}%`,
    ];
    const expectedBenefit =
      "ownership 정렬은 책임 추적, 성과 관리, handoff SLA 정의를 개선할 수 있습니다.";
    const validationNeeded =
      "조직 구조 재검토는 HR/PI 정책, 계약, 규제 제약과 함께 검토해야 합니다.";
    const recommendedActions = [
      "프로세스 오너와 조직별 책임 범위를 workshop으로 정리합니다.",
      "activity-level ownership 매핑을 보강합니다.",
      "조직 구조 재검토 필요 여부를 PI 관점에서 평가합니다.",
    ];

    return toInsightCard(
      `redesign-ownership_realignment-${profile.id}`,
      "ownership_realignment",
      title,
      answer,
      "ownership 명확화·조직 구조 재검토 후보이며, 조직 변경을 확정하지 않습니다.",
      score,
      reasons,
      expectedBenefit,
      validationNeeded,
      recommendedActions,
      buildRrEvidence(resolvedIndex, profile.id, profile.activitiesWithoutResponsibility),
      {
        "ownership 검토 점수": score.toFixed(1),
        "관여 조직": profile.organizationCount,
      },
    );
  });
}

export function rankRedesignRecommendations(
  graph: ProcessGraph,
  options?: { limit?: number },
  index?: GraphIndex,
): InsightCard[] {
  const limit = options?.limit ?? 50;
  const resolvedIndex = index ?? buildGraphIndex(graph);
  const perTypeLimit = Math.max(5, Math.ceil(limit / 6));

  const all = [
    ...rankProcessMergeCandidates(graph, { limit: perTypeLimit }, resolvedIndex),
    ...rankProcessSplitCandidates(graph, { limit: perTypeLimit }, resolvedIndex),
    ...rankProcessModuleCandidates(graph, { limit: perTypeLimit }, resolvedIndex),
    ...rankRrClarificationCandidates(graph, { limit: perTypeLimit }, resolvedIndex),
    ...rankOwnershipRealignmentCandidates(graph, { limit: perTypeLimit }, resolvedIndex),
    ...rankSimilarTaskSequenceClusters(graph, { limit: perTypeLimit }, resolvedIndex),
  ];

  const deduped = new Map<string, InsightCard>();
  for (const card of all) {
    deduped.set(card.id, card);
  }

  return [...deduped.values()]
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, limit);
}

export { REDESIGN_CAVEAT, buildRedesignMarkdown };
export { rankCrossOrgHandoffHotspots } from "./crossOrgHandoffAnalysis";
