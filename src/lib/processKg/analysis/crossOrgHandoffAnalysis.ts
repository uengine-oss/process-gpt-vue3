import type { ProcessGraph } from "../graph/types";
import { HANDOFF_BPMN_TYPES, isManualActivity } from "./competencyQuestions";
import {
  buildGraphIndex,
  getIncoming,
  getNodeLabel,
  getOutgoing,
  getTargets,
  type GraphIndex,
} from "./graphIndex";
import type { EvidenceRef, InsightCard } from "./types";

const HANDOFF_WEIGHTS = {
  coProcess: 4,
  handoffTask: 2.5,
  sharedSystem: 1.5,
  sharedSupplier: 2,
  manual: 1,
} as const;

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function isHandoffActivity(index: GraphIndex, activityId: string): boolean {
  const node = index.nodesById.get(activityId);
  if (!node) return false;
  const bpmnType = node.properties.bpmnType;
  if (typeof bpmnType === "string" && HANDOFF_BPMN_TYPES.has(bpmnType)) return true;
  return Boolean(node.properties.definitionId);
}

interface ProcessHandoffProfile {
  organizationIds: Set<string>;
  systemIds: Set<string>;
  supplierIds: Set<string>;
  handoffTaskCount: number;
  handoffActivityIds: string[];
  manualActivityCount: number;
}

function buildProcessHandoffProfile(
  index: GraphIndex,
  processId: string,
): ProcessHandoffProfile {
  const organizationIds = new Set(
    getTargets(index, processId, "performedByOrganization").map((n) => n.id),
  );
  const systemIds = new Set(getTargets(index, processId, "usesSystem").map((n) => n.id));
  const supplierIds = new Set(
    getTargets(index, processId, "performedBySupplier").map((n) => n.id),
  );

  const activities = getTargets(index, processId, "hasActivity");
  let handoffTaskCount = 0;
  let manualActivityCount = 0;
  const handoffActivityIds: string[] = [];

  for (const activity of activities) {
    if (isHandoffActivity(index, activity.id)) {
      handoffTaskCount += 1;
      handoffActivityIds.push(activity.id);
    }
    if (isManualActivity(index, activity.id)) manualActivityCount += 1;
    for (const edge of getIncoming(index, activity.id, "performedByOrganization")) {
      organizationIds.add(edge.source);
    }
    for (const edge of getOutgoing(index, activity.id, "usesSystem")) {
      systemIds.add(edge.target);
    }
  }

  return {
    organizationIds,
    systemIds,
    supplierIds,
    handoffTaskCount,
    handoffActivityIds,
    manualActivityCount,
  };
}

function buildHandoffEvidence(
  orgAId: string,
  orgBId: string,
  processIds: string[],
  handoffActivityIds: string[],
  systemIds: string[],
): EvidenceRef {
  const nodeIds = new Set<string>([orgAId, orgBId]);
  for (const processId of processIds.slice(0, 5)) nodeIds.add(processId);
  for (const activityId of handoffActivityIds.slice(0, 5)) nodeIds.add(activityId);
  for (const sysId of systemIds.slice(0, 3)) nodeIds.add(sysId);

  return {
    nodeIds: [...nodeIds],
    edgeIds: [],
    summary:
      "조직 간 handoff hotspot 근거: 조직 쌍, 공유 프로세스, handoff activity, 시스템 예시만 포함합니다.",
  };
}

function buildHandoffMarkdown(
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
    "**근거:**",
    ...reasons.map((r) => `- ${r}`),
    "",
    "**추천 조치:**",
    ...recommendedActions.map((a) => `- ${a}`),
    "",
    "**주의:**",
    "조직 간 handoff hotspot 후보이며, 실제 조직 병목이나 구조 변경을 확정하지 않습니다. 현업 검증이 필요합니다.",
  ].join("\n");
}

export function rankCrossOrgHandoffHotspots(
  graph: ProcessGraph,
  options?: { limit?: number },
  index?: GraphIndex,
): InsightCard[] {
  const limit = options?.limit ?? 10;
  const resolvedIndex = index ?? buildGraphIndex(graph);
  const processes = resolvedIndex.nodesByType.get("Process") ?? [];

  const pairStats = new Map<
    string,
    {
      orgA: string;
      orgB: string;
      coProcessIds: string[];
      handoffTaskCount: number;
      handoffActivityIds: string[];
      manualActivityCount: number;
      sharedSystemIds: Set<string>;
      sharedSupplierIds: Set<string>;
    }
  >();

  for (const process of processes) {
    const profile = buildProcessHandoffProfile(resolvedIndex, process.id);
    const orgIds = [...profile.organizationIds];
    if (orgIds.length < 2) continue;

    for (let i = 0; i < orgIds.length; i += 1) {
      for (let j = i + 1; j < orgIds.length; j += 1) {
        const key = pairKey(orgIds[i], orgIds[j]);
        const stats = pairStats.get(key) ?? {
          orgA: orgIds[i] < orgIds[j] ? orgIds[i] : orgIds[j],
          orgB: orgIds[i] < orgIds[j] ? orgIds[j] : orgIds[i],
          coProcessIds: [],
          handoffTaskCount: 0,
          handoffActivityIds: [],
          manualActivityCount: 0,
          sharedSystemIds: new Set<string>(),
          sharedSupplierIds: new Set<string>(),
        };
        stats.coProcessIds.push(process.id);
        stats.handoffTaskCount += profile.handoffTaskCount;
        stats.handoffActivityIds.push(...profile.handoffActivityIds);
        stats.manualActivityCount += profile.manualActivityCount;
        for (const sysId of profile.systemIds) stats.sharedSystemIds.add(sysId);
        for (const supId of profile.supplierIds) stats.sharedSupplierIds.add(supId);
        pairStats.set(key, stats);
      }
    }
  }

  const ranked = [...pairStats.entries()]
    .map(([key, stats]) => {
      const coProcessCount = stats.coProcessIds.length;
      const score =
        coProcessCount * HANDOFF_WEIGHTS.coProcess +
        stats.handoffTaskCount * HANDOFF_WEIGHTS.handoffTask +
        stats.sharedSystemIds.size * HANDOFF_WEIGHTS.sharedSystem +
        stats.sharedSupplierIds.size * HANDOFF_WEIGHTS.sharedSupplier +
        stats.manualActivityCount * HANDOFF_WEIGHTS.manual;
      return { key, stats, score, coProcessCount };
    })
    .filter((item) => item.coProcessCount >= 1 && item.stats.handoffTaskCount >= 1)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return ranked.map(({ key, stats, score, coProcessCount }) => {
    const orgALabel = getNodeLabel(resolvedIndex.nodesById.get(stats.orgA));
    const orgBLabel = getNodeLabel(resolvedIndex.nodesById.get(stats.orgB));
    const title = `조직 간 handoff hotspot: ${orgALabel} ↔ ${orgBLabel}`;
    const answer = `두 조직은 여러 프로세스에서 함께 등장하고 전달·연계 작업이 반복되어 R&R 경계, interface rule, handoff SLA 검토 후보입니다.`;
    const reasons = [
      `공동 관여 프로세스 ${coProcessCount}개`,
      `전달·연계 작업 ${stats.handoffTaskCount}건`,
      `공유 시스템 ${stats.sharedSystemIds.size}개`,
      `수작업 activity ${stats.manualActivityCount}건`,
    ];
    const recommendedActions = [
      "handoff object 정의",
      "입력/출력 데이터 정의",
      "SLA 또는 응답 기준 정의",
      "책임 경계 확인",
      "반복 handoff 자동화 후보 검토",
    ];

    return {
      id: `handoff-crossorg-${key}`,
      category: "organization" as const,
      title,
      question: "어떤 조직 쌍이 handoff-heavy interface 후보인가?",
      answer,
      explanation:
        "현재 BPMN 모델 기준 구조적 handoff 신호이며, 실제 조직 병목이나 지연을 확정하지 않습니다.",
      severity: score >= 40 ? "high" : score >= 15 ? "medium" : "info",
      score,
      reasons,
      metrics: {
        "인사이트 유형": "조직 간 handoff hotspot",
        "공동 프로세스": coProcessCount,
        "전달·연계 작업": stats.handoffTaskCount,
        "공유 시스템": stats.sharedSystemIds.size,
        "공유 협력사": stats.sharedSupplierIds.size,
        "수작업 activity": stats.manualActivityCount,
      },
      evidence: buildHandoffEvidence(
        stats.orgA,
        stats.orgB,
        stats.coProcessIds,
        stats.handoffActivityIds,
        [...stats.sharedSystemIds],
      ),
      markdown: buildHandoffMarkdown(title, answer, reasons, recommendedActions),
    };
  });
}
