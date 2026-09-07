import type { GraphNode, ProcessGraph } from "../graph/types";
import { rankStructuralBottleneckCandidates } from "./bottleneckAnalysis";
import { isManualActivity } from "./competencyQuestions";
import {
  buildGraphIndex,
  findParentProcessId,
  getIncoming,
  getNodeLabel,
  getOutgoing,
  getTargets,
  type GraphIndex,
} from "./graphIndex";
import { rankSystemBlastRadius } from "./impactAnalysis";
import { rankOrganizationCoordinationCandidates } from "./organizationAnalysis";
import type {
  EnrichmentPriority,
  EnrichmentRecommendation,
  EnrichmentRecommendationType,
  EvidenceRef,
  InsightCard,
} from "./types";

export interface EnrichmentFieldCatalog {
  fields: string[];
  suggestedSources: string[];
  reasoningBenefit: string;
}

export const BOTTLENECK_VALIDATION_CATALOG: EnrichmentFieldCatalog = {
  fields: [
    "ProcessActivity.frequency",
    "ProcessActivity.avgExecutionTime",
    "ProcessActivity.avgWaitTime",
    "ProcessActivity.manualEffortMinutes",
    "ProcessActivity.slaTarget",
    "ProcessActivity.slaViolationRate",
    "ProcessActivity.ticketCount",
    "ProcessActivity.exceptionRate",
  ],
  suggestedSources: [
    "workflow logs",
    "Jira tickets",
    "OSS tickets",
    "SLA reports",
    "operation dashboards",
    "manual time study",
  ],
  reasoningBenefit:
    "Allows structural bottleneck candidates to be validated against actual execution volume, delay, SLA, and workload.",
};

export const ORGANIZATION_CAPACITY_CATALOG: EnrichmentFieldCatalog = {
  fields: [
    "Organization.fte",
    "Organization.availableCapacity",
    "Organization.backlogCount",
    "Organization.ticketAssignedCount",
    "Organization.ticketResolvedCount",
    "Organization.avgResolutionTime",
    "Organization.escalationReceivedCount",
    "Organization.escalationSentCount",
  ],
  suggestedSources: [
    "HR/resource planning",
    "Jira assignment data",
    "incident/ticket system",
    "weekly operation reports",
    "on-call roster",
  ],
  reasoningBenefit:
    "Allows organization coordination candidates to be validated against workload, capacity, backlog, and escalation pressure.",
};

export const SYSTEM_RISK_CATALOG: EnrichmentFieldCatalog = {
  fields: [
    "System.criticality",
    "System.ownerOrganization",
    "System.incidentCount",
    "System.changeFrequency",
    "System.availabilityTarget",
    "System.actualAvailability",
    "System.rto",
    "System.rpo",
    "System.endOfLifeDate",
    "System.replacementRoadmap",
  ],
  suggestedSources: [
    "CMDB",
    "system inventory",
    "incident management system",
    "change management system",
    "DR/BCP documents",
    "architecture repository",
  ],
  reasoningBenefit:
    "Allows system blast radius to be prioritized by real operational criticality and reliability risk.",
};

export const AUTOMATION_READINESS_CATALOG: EnrichmentFieldCatalog = {
  fields: [
    "ProcessActivity.frequency",
    "ProcessActivity.manualEffortMinutes",
    "ProcessActivity.ruleBased",
    "ProcessActivity.requiresHumanJudgment",
    "ProcessActivity.requiresApproval",
    "ProcessActivity.inputDataType",
    "ProcessActivity.outputDataType",
    "ProcessActivity.apiAvailable",
    "ProcessActivity.exceptionRate",
    "ProcessActivity.automationLevel",
  ],
  suggestedSources: [
    "activity survey",
    "SOP/manual review",
    "system API catalog",
    "screen recording/task mining",
    "Jira/RPA candidate backlog",
    "SME interview",
  ],
  reasoningBenefit:
    "Allows manual-heavy activities to be assessed for AI/RPA/Agent automation suitability.",
};

export const MODELING_QUALITY_CATALOG: EnrichmentFieldCatalog = {
  fields: [
    "ProcessActivity.ownerRole",
    "ProcessActivity.usedSystem",
    "ProcessActivity.inputData",
    "ProcessActivity.outputData",
    "ProcessActivity.manualLink",
    "ProcessActivity.definitionId",
    "Lane.organization",
    "System.normalizedName",
    "Organization.normalizedName",
  ],
  suggestedSources: [
    "BPMN extension properties",
    "process owner review",
    "system master data",
    "organization master data",
    "manual repository",
  ],
  reasoningBenefit:
    "Improves graph consistency, deduplication, CQ answer accuracy, and evidence reliability.",
};

const RECOMMENDATION_TYPE_LABELS: Record<EnrichmentRecommendationType, string> = {
  bottleneck_validation: "병목 검증",
  organization_capacity: "조직 capacity",
  system_risk: "시스템 risk",
  automation_readiness: "자동화 readiness",
  modeling_quality: "모델링 품질",
};

const PRIORITY_SCORE: Record<EnrichmentPriority, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

function propertyKey(field: string): string {
  const dot = field.indexOf(".");
  return dot >= 0 ? field.slice(dot + 1) : field;
}

function hasField(node: GraphNode, field: string): boolean {
  const key = propertyKey(field);
  const value = node.properties[key];
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return !Number.isNaN(value);
  if (typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function getMissingFields(
  nodes: GraphNode[],
  catalog: EnrichmentFieldCatalog,
): string[] {
  return catalog.fields.filter((field) => !nodes.some((node) => hasField(node, field)));
}

function priorityLabel(priority: EnrichmentPriority): string {
  if (priority === "high") return "High";
  if (priority === "medium") return "Medium";
  return "Low";
}

function severityFromPriority(priority: EnrichmentPriority): "info" | "medium" | "high" {
  if (priority === "high") return "high";
  if (priority === "medium") return "medium";
  return "info";
}

function extractIdFromInsight(insight: InsightCard, prefix: string): string | null {
  if (!insight.id.startsWith(prefix)) return null;
  return insight.id.slice(prefix.length);
}

function buildEnrichmentEvidence(
  targetId: string,
  relatedNodeIds: string[] = [],
  relatedEdgeIds: string[] = [],
): EvidenceRef {
  const nodeIds = new Set<string>([targetId]);
  for (const id of relatedNodeIds.slice(0, 8)) {
    nodeIds.add(id);
  }
  return {
    nodeIds: [...nodeIds],
    edgeIds: relatedEdgeIds.slice(0, 10),
    summary:
      "데이터 보강 추천 근거: 대상 노드와 대표 연결 노드만 포함합니다. 전체 activity/containsElement 확장은 하지 않습니다.",
  };
}

function buildEnrichmentMarkdown(
  rec: EnrichmentRecommendation,
  reasons: string[],
): string {
  const typeLabel = RECOMMENDATION_TYPE_LABELS[rec.recommendationType];
  const fields =
    rec.missingFields.length > 0
      ? rec.missingFields.map((f) => `- ${f}`).join("\n")
      : "- (catalog fields to connect)";
  const sources = rec.suggestedSources.map((s) => `- ${s}`).join("\n");

  return [
    `### 데이터 보강 추천: ${rec.targetLabel}`,
    "",
    `**질문:** 이 분석의 추론 품질을 높이려면 어떤 데이터를 추가로 연결해야 하는가?`,
    "",
    `**결론:** ${rec.explanation}`,
    "",
    "**근거:**",
    ...reasons.map((r) => `- ${r}`),
    "",
    "**추천 연결 데이터:**",
    fields,
    "",
    "**추천 데이터 소스:**",
    sources,
    "",
    "**기대되는 reasoning 개선 효과:**",
    rec.reasoningBenefit,
    "",
    "**주의사항:**",
    "추천 필드가 없다고 해서 모델링이 잘못되었다고 단정하지 않습니다. 추론 품질을 높이기 위해 연결하면 좋은 데이터입니다.",
    "",
    "**권장 후속 조치:**",
    `${typeLabel} 관점에서 우선순위 ${priorityLabel(rec.priority)} 항목부터 데이터 소유자와 연결 범위를 검토하세요.`,
  ].join("\n");
}

function recommendationToInsightCard(
  rec: EnrichmentRecommendation,
  reasons: string[],
  evidence: EvidenceRef,
  triggerScore = 0,
): InsightCard & { triggerScore: number } {
  const typeLabel = RECOMMENDATION_TYPE_LABELS[rec.recommendationType];
  const fieldsPreview =
    rec.missingFields.length > 0
      ? rec.missingFields.slice(0, 6).join(", ")
      : rec.missingFields.join(", ");
  const sourcesPreview = rec.suggestedSources.slice(0, 4).join(", ");

  return {
    id: `enrichment-${rec.recommendationType}-${rec.targetId}`,
    category: "enrichment",
    title: `데이터 보강 추천: ${rec.targetLabel}`,
    question: "이 분석의 추론 품질을 높이려면 어떤 데이터를 추가로 연결해야 하는가?",
    answer: rec.explanation,
    explanation:
      "현재 분석은 BPMN 구조를 기반으로 한 후보 도출입니다. 운영·메타데이터가 연결되면 실제 업무량, 영향도, 자동화 적합성을 함께 판단할 수 있습니다.",
    severity: severityFromPriority(rec.priority),
    score: triggerScore,
    reasons,
    metrics: {
      "추천 우선순위": priorityLabel(rec.priority),
      "추천 유형": typeLabel,
      "추천 필드 수": rec.missingFields.length,
      "추천 데이터 소스 수": rec.suggestedSources.length,
      "추천 연결 데이터": fieldsPreview,
      "추천 데이터 소스": sourcesPreview,
      "기대 효과": rec.reasoningBenefit,
    },
    evidence,
    markdown: buildEnrichmentMarkdown(rec, reasons),
    triggerScore: triggerScore + PRIORITY_SCORE[rec.priority] * 10,
  };
}

function getProcessActivities(
  index: GraphIndex,
  processId: string,
): GraphNode[] {
  return getTargets(index, processId, "hasActivity");
}

function activityHasResponsibility(index: GraphIndex, activityId: string): boolean {
  const hasLane = getOutgoing(index, activityId, "assignedToLane").length > 0;
  const hasOrg = getIncoming(index, activityId, "performedByOrganization").length > 0;
  return hasLane || hasOrg;
}

function activityUsesSystem(index: GraphIndex, activityId: string): boolean {
  return getOutgoing(index, activityId, "usesSystem").length > 0;
}

function isHandoffHeavyProcess(index: GraphIndex, processId: string): boolean {
  const activities = getProcessActivities(index, processId);
  let handoffCount = 0;
  for (const activity of activities) {
    const bpmnType = activity.properties.bpmnType;
    if (
      bpmnType === "sendTask" ||
      bpmnType === "receiveTask" ||
      bpmnType === "callActivity" ||
      activity.properties.definitionId
    ) {
      handoffCount += 1;
    }
  }
  return handoffCount >= 2;
}

function looksLikeActivityId(label: string): boolean {
  const lower = label.toLowerCase();
  return (
    /^act[-_]/.test(lower) ||
    lower.includes("task") ||
    lower.includes("activity") ||
    /^[a-z]+[-_]\d+$/i.test(label)
  );
}

function findDuplicateOrganizations(index: GraphIndex): string[] {
  const labelToIds = new Map<string, string[]>();
  for (const org of index.nodesByType.get("Organization") ?? []) {
    const label = getNodeLabel(org).toLowerCase();
    const ids = labelToIds.get(label) ?? [];
    ids.push(org.id);
    labelToIds.set(label, ids);
  }
  const duplicates: string[] = [];
  for (const ids of labelToIds.values()) {
    if (ids.length > 1) duplicates.push(...ids);
  }
  return duplicates;
}

function buildBottleneckRecommendations(
  index: GraphIndex,
  bottleneckInsights: InsightCard[],
): (InsightCard & { triggerScore: number })[] {
  const cards: (InsightCard & { triggerScore: number })[] = [];

  for (const insight of bottleneckInsights) {
    const processId = extractIdFromInsight(insight, "bottleneck-");
    if (!processId) continue;
    const process = index.nodesById.get(processId);
    if (!process) continue;

    const activities = getProcessActivities(index, processId);
    const missingFields = getMissingFields(activities, BOTTLENECK_VALIDATION_CATALOG);
    if (missingFields.length === 0) continue;

    const score = insight.score ?? 0;
    const priority: EnrichmentPriority =
      insight.severity === "high" || score >= 40 ? "high" : "medium";

    const rec: EnrichmentRecommendation = {
      targetId: processId,
      targetLabel: getNodeLabel(process),
      targetType: "Process",
      recommendationType: "bottleneck_validation",
      priority,
      missingFields,
      suggestedSources: BOTTLENECK_VALIDATION_CATALOG.suggestedSources,
      reasoningBenefit: BOTTLENECK_VALIDATION_CATALOG.reasoningBenefit,
      explanation: `이 프로세스는 구조적 병목 후보이지만, 실제 병목 여부를 검증하려면 activity별 수행 빈도, 평균 처리시간, 대기시간, SLA 위반율, ticket count 데이터가 필요합니다.`,
    };

    const reasons = [
      "구조적 병목 후보 상위권입니다.",
      `업무 단계 ${activities.length}개와 연결되어 있습니다.`,
      "현재 실행 시간, 대기 시간, SLA, ticket volume 데이터가 연결되어 있지 않습니다.",
    ];
    if ((insight.metrics?.["전달·연계 작업"] as number) > 0) {
      reasons.push("전달·연계 작업이 많아 운영 데이터 검증이 특히 유용합니다.");
    }

    cards.push(
      recommendationToInsightCard(
        rec,
        reasons,
        buildEnrichmentEvidence(processId, insight.evidence.nodeIds, insight.evidence.edgeIds),
        score,
      ),
    );
  }

  return cards;
}

function buildOrganizationRecommendations(
  index: GraphIndex,
  organizationInsights: InsightCard[],
): (InsightCard & { triggerScore: number })[] {
  const cards: (InsightCard & { triggerScore: number })[] = [];

  for (const insight of organizationInsights) {
    const orgId = extractIdFromInsight(insight, "org-coordination-");
    if (!orgId) continue;
    const org = index.nodesById.get(orgId);
    if (!org) continue;

    const missingFields = getMissingFields([org], ORGANIZATION_CAPACITY_CATALOG);
    if (missingFields.length === 0) continue;

    const score = insight.score ?? 0;
    const priority: EnrichmentPriority =
      insight.severity === "high" || score >= 50 ? "high" : "medium";

    const rec: EnrichmentRecommendation = {
      targetId: orgId,
      targetLabel: getNodeLabel(org),
      targetType: "Organization",
      recommendationType: "organization_capacity",
      priority,
      missingFields,
      suggestedSources: ORGANIZATION_CAPACITY_CATALOG.suggestedSources,
      reasoningBenefit: ORGANIZATION_CAPACITY_CATALOG.reasoningBenefit,
      explanation: `이 조직은 조율 부담 후보 조직이지만, 실제 capacity·backlog·escalation 압력을 검증하려면 FTE, backlog, ticket 처리, escalation 데이터가 필요합니다.`,
    };

    const reasons = [
      "조직 조율 부담 후보 상위권입니다.",
      "여러 프로세스·시스템·handoff 접점에 관여합니다.",
      "현재 capacity, backlog, escalation 운영 데이터가 연결되어 있지 않습니다.",
    ];

    cards.push(
      recommendationToInsightCard(
        rec,
        reasons,
        buildEnrichmentEvidence(orgId, insight.evidence.nodeIds, insight.evidence.edgeIds),
        score,
      ),
    );
  }

  return cards;
}

function buildSystemRiskRecommendations(
  index: GraphIndex,
  systemImpactInsights: InsightCard[],
): (InsightCard & { triggerScore: number })[] {
  const cards: (InsightCard & { triggerScore: number })[] = [];

  for (const insight of systemImpactInsights) {
    const systemId = extractIdFromInsight(insight, "impact-system-");
    if (!systemId) continue;
    const system = index.nodesById.get(systemId);
    if (!system) continue;

    const missingFields = getMissingFields([system], SYSTEM_RISK_CATALOG);
    if (missingFields.length === 0) continue;

    const processCount = Number(insight.metrics?.["영향 후보 프로세스"] ?? 0);
    const organizationCount = Number(insight.metrics?.["관련 조직"] ?? 0);
    const priority: EnrichmentPriority =
      processCount >= 3 || organizationCount >= 3 || insight.severity === "high"
        ? "high"
        : "medium";

    const rec: EnrichmentRecommendation = {
      targetId: systemId,
      targetLabel: getNodeLabel(system),
      targetType: "System",
      recommendationType: "system_risk",
      priority,
      missingFields,
      suggestedSources: SYSTEM_RISK_CATALOG.suggestedSources,
      reasoningBenefit: SYSTEM_RISK_CATALOG.reasoningBenefit,
      explanation: `이 시스템은 blast radius 후보이지만, 영향도 우선순위 판단을 위해 criticality, incident, change, owner, availability 메타데이터가 필요합니다.`,
    };

    const reasons = [
      "시스템 blast radius 후보 상위권입니다.",
      `${processCount}개 프로세스, ${organizationCount}개 조직과 연결되어 있습니다.`,
      "현재 criticality, incident, change, DR/BCP 메타데이터가 연결되어 있지 않습니다.",
    ];

    cards.push(
      recommendationToInsightCard(
        rec,
        reasons,
        buildEnrichmentEvidence(systemId, insight.evidence.nodeIds, insight.evidence.edgeIds),
        insight.score ?? 0,
      ),
    );
  }

  return cards;
}

function buildAutomationRecommendations(
  index: GraphIndex,
  bottleneckProcessIds: Set<string>,
): (InsightCard & { triggerScore: number })[] {
  const cards: (InsightCard & { triggerScore: number })[] = [];
  const activities = index.nodesByType.get("ProcessActivity") ?? [];

  const candidates = activities
    .filter((activity) => {
      if (!isManualActivity(index, activity.id)) return false;
      if (activityUsesSystem(index, activity.id)) return false;
      return true;
    })
    .slice(0, 20);

  for (const activity of candidates) {
    const missingFields = getMissingFields([activity], AUTOMATION_READINESS_CATALOG);
    if (missingFields.length === 0) continue;

    const parentProcessId = findParentProcessId(index, activity.id);
    const inBottleneck =
      parentProcessId != null && bottleneckProcessIds.has(parentProcessId);
    const priority: EnrichmentPriority = inBottleneck ? "high" : "medium";

    const rec: EnrichmentRecommendation = {
      targetId: activity.id,
      targetLabel: getNodeLabel(activity),
      targetType: "ProcessActivity",
      recommendationType: "automation_readiness",
      priority,
      missingFields,
      suggestedSources: AUTOMATION_READINESS_CATALOG.suggestedSources,
      reasoningBenefit: AUTOMATION_READINESS_CATALOG.reasoningBenefit,
      explanation: `이 activity는 수작업 중심이며 시스템 연결이 없어, 자동화 가능성 판단을 위해 frequency, manual effort, rule-based, API availability 메타데이터가 필요합니다.`,
    };

    const reasons = [
      "수작업 중심 activity입니다.",
      "usesSystem 연결이 없어 자동화 후보 검토에 유용합니다.",
      "자동화 적합성 판단용 activity metadata가 연결되어 있지 않습니다.",
    ];
    if (inBottleneck) {
      reasons.unshift("구조적 병목 후보 프로세스에 속합니다.");
    }

    const relatedIds = parentProcessId ? [parentProcessId] : [];
    cards.push(
      recommendationToInsightCard(
        rec,
        reasons,
        buildEnrichmentEvidence(activity.id, relatedIds),
        inBottleneck ? 30 : 10,
      ),
    );
  }

  return cards;
}

function buildModelingQualityRecommendations(
  index: GraphIndex,
): (InsightCard & { triggerScore: number })[] {
  const cards: (InsightCard & { triggerScore: number })[] = [];
  const seen = new Set<string>();

  const addCard = (
    targetId: string,
    targetType: string,
    priority: EnrichmentPriority,
    explanation: string,
    reasons: string[],
    triggerScore: number,
    relatedNodeIds: string[] = [],
  ) => {
    const key = `modeling_quality-${targetId}`;
    if (seen.has(key)) return;
    seen.add(key);

    const node = index.nodesById.get(targetId);
    if (!node) return;

    const missingFields = getMissingFields([node], MODELING_QUALITY_CATALOG);
    const rec: EnrichmentRecommendation = {
      targetId,
      targetLabel: getNodeLabel(node),
      targetType,
      recommendationType: "modeling_quality",
      priority,
      missingFields: missingFields.length > 0 ? missingFields : MODELING_QUALITY_CATALOG.fields.slice(0, 4),
      suggestedSources: MODELING_QUALITY_CATALOG.suggestedSources,
      reasoningBenefit: MODELING_QUALITY_CATALOG.reasoningBenefit,
      explanation,
    };

    cards.push(
      recommendationToInsightCard(
        rec,
        reasons,
        buildEnrichmentEvidence(targetId, relatedNodeIds),
        triggerScore,
      ),
    );
  };

  let orphanCount = 0;
  for (const activity of index.nodesByType.get("ProcessActivity") ?? []) {
    if (orphanCount >= 10) break;
    if (activityHasResponsibility(index, activity.id)) continue;
    orphanCount += 1;
    addCard(
      activity.id,
      "ProcessActivity",
      "medium",
      "이 activity는 lane/organization 책임 연결이 없어 CQ·evidence 정확도를 높이려면 ownerRole, lane.organization 등 모델링 보강이 도움이 됩니다.",
      [
        "assignedToLane 또는 performedByOrganization 연결이 없습니다.",
        "책임 주체가 명확하면 조직·병목 분석 정확도가 높아집니다.",
      ],
      5,
      findParentProcessId(index, activity.id)
        ? [findParentProcessId(index, activity.id)!]
        : [],
    );
  }

  let sparseDataArtifactCount = 0;
  for (const process of index.nodesByType.get("Process") ?? []) {
    if (sparseDataArtifactCount >= 6) break;
    const dataObjectCount =
      getTargets(index, process.id, "usesDataObject").length +
      getTargets(index, process.id, "producesDataObject").length;
    if (dataObjectCount === 0) continue;
    const systemCount = getTargets(index, process.id, "usesSystem").length;
    const orgCount = getTargets(index, process.id, "performedByOrganization").length;
    if (systemCount > 0 && orgCount > 0) continue;
    sparseDataArtifactCount += 1;
    addCard(
      process.id,
      "Process",
      "medium",
      "프로세스에 data artifact(DataObject)는 모델링되어 있지만 system/organization 메타데이터가 부족합니다.",
      [
        "DataObject 사용/생성 관계는 존재합니다.",
        "System 또는 Organization 연결을 보강하면 분석 정확도가 높아집니다.",
      ],
      4,
      [
        ...getTargets(index, process.id, "usesDataObject").map((node) => node.id),
        ...getTargets(index, process.id, "producesDataObject").map((node) => node.id),
      ],
    );
  }

  let noSystemCount = 0;
  for (const activity of index.nodesByType.get("ProcessActivity") ?? []) {
    if (noSystemCount >= 8) break;
    if (!isManualActivity(index, activity.id)) continue;
    if (activityUsesSystem(index, activity.id)) continue;
    const parentId = findParentProcessId(index, activity.id);
    if (!parentId || !isHandoffHeavyProcess(index, parentId)) continue;
    noSystemCount += 1;
    addCard(
      activity.id,
      "ProcessActivity",
      "low",
      "handoff가 많은 프로세스의 수작업 activity에 system/input/output 메타데이터를 연결하면 시스템 의존·자동화 분석이 개선됩니다.",
      [
        "수작업 activity이며 usesSystem 연결이 없습니다.",
        "handoff가 많은 프로세스에 속합니다.",
      ],
      4,
      [parentId],
    );
  }

  let suspiciousSystemCount = 0;
  for (const system of index.nodesByType.get("System") ?? []) {
    if (suspiciousSystemCount >= 5) break;
    const label = getNodeLabel(system);
    if (!looksLikeActivityId(label) && !looksLikeActivityId(system.id)) continue;
    suspiciousSystemCount += 1;
    addCard(
      system.id,
      "System",
      "low",
      "시스템 라벨이 activity id 형태로 보입니다. normalizedName·master data 연결로 deduplication과 CQ 정확도를 높일 수 있습니다.",
      [
        "시스템 이름/ID가 activity 식별자 형태와 유사합니다.",
        "system master data 연결을 검토하면 좋습니다.",
      ],
      3,
    );
  }

  const duplicateOrgIds = findDuplicateOrganizations(index).slice(0, 5);
  for (const orgId of duplicateOrgIds) {
    addCard(
      orgId,
      "Organization",
      "low",
      "동일·유사 조직명이 여러 노드에 존재합니다. normalizedName 연결로 deduplication과 조직 분석 정확도를 높일 수 있습니다.",
      [
        "유사한 조직 라벨이 여러 Organization 노드에 나타납니다.",
        "organization master data 연결을 검토하면 좋습니다.",
      ],
      3,
    );
  }

  let sparseProcessCount = 0;
  for (const process of index.nodesByType.get("Process") ?? []) {
    if (sparseProcessCount >= 5) break;
    const activities = getProcessActivities(index, process.id);
    if (activities.length < 4) continue;
    const orgCount = getTargets(index, process.id, "performedByOrganization").length;
    const sysCount = getTargets(index, process.id, "usesSystem").length;
    if (orgCount >= 2 && sysCount >= 1) continue;
    sparseProcessCount += 1;
    addCard(
      process.id,
      "Process",
      "low",
      "activity 수 대비 organization/system 연결이 적습니다. process owner review로 모델링 일관성을 높이면 분석 신뢰도가 개선됩니다.",
      [
        `업무 단계 ${activities.length}개 대비 조직 ${orgCount}개, 시스템 ${sysCount}개만 연결되어 있습니다.`,
        "BPMN extension·owner review로 보강을 검토할 수 있습니다.",
      ],
      4,
      activities.slice(0, 3).map((a) => a.id),
    );
  }

  return cards;
}

export function rankEnrichmentRecommendations(
  graph: ProcessGraph,
  options?: { limit?: number },
  index?: GraphIndex,
  context?: {
    bottleneckInsights?: InsightCard[];
    organizationInsights?: InsightCard[];
    systemImpactInsights?: InsightCard[];
  },
): InsightCard[] {
  const limit = options?.limit ?? 50;
  const resolvedIndex = index ?? buildGraphIndex(graph);

  const bottleneckInsights =
    context?.bottleneckInsights ??
    rankStructuralBottleneckCandidates(graph, { limit: 50 }, resolvedIndex);
  const organizationInsights =
    context?.organizationInsights ??
    rankOrganizationCoordinationCandidates(graph, { limit: 50 }, resolvedIndex);
  const systemImpactInsights =
    context?.systemImpactInsights ??
    rankSystemBlastRadius(graph, { limit: 50 }, resolvedIndex);

  const bottleneckProcessIds = new Set(
    bottleneckInsights
      .map((i) => extractIdFromInsight(i, "bottleneck-"))
      .filter((id): id is string => id != null),
  );

  const allCards = [
    ...buildBottleneckRecommendations(resolvedIndex, bottleneckInsights),
    ...buildOrganizationRecommendations(resolvedIndex, organizationInsights),
    ...buildSystemRiskRecommendations(resolvedIndex, systemImpactInsights),
    ...buildAutomationRecommendations(resolvedIndex, bottleneckProcessIds),
    ...buildModelingQualityRecommendations(resolvedIndex),
  ];

  const deduped = new Map<string, InsightCard & { triggerScore: number }>();
  for (const card of allCards) {
    const existing = deduped.get(card.id);
    if (!existing || card.triggerScore > existing.triggerScore) {
      deduped.set(card.id, card);
    }
  }

  return [...deduped.values()]
    .sort((a, b) => b.triggerScore - a.triggerScore)
    .slice(0, limit)
    .map(({ triggerScore: _ts, ...card }) => card);
}

export {
  RECOMMENDATION_TYPE_LABELS,
  buildEnrichmentEvidence,
  buildEnrichmentMarkdown,
  getMissingFields,
  recommendationToInsightCard,
};
