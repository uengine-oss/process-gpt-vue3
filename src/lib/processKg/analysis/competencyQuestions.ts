import type { GraphEdge, ProcessGraph } from "../graph/types";
import {
  buildGraphIndex,
  type GraphIndex,
  evidenceFromEdges,
  findParentProcessId,
  getIncoming,
  getNodeLabel,
  getOutgoing,
  getSources,
  getTargets,
  mergeEvidence,
} from "./graphIndex";
import type { InsightCard } from "./types";
import { generateInsightMarkdown } from "./reportMarkdown";

const HANDOFF_BPMN_TYPES = new Set(["sendTask", "receiveTask", "callActivity"]);

function isManualActivity(
  index: ReturnType<typeof buildGraphIndex>,
  activityId: string,
): boolean {
  const node = index.nodesById.get(activityId);
  if (!node) return false;
  if (node.properties.bpmnType === "manualTask") return true;
  return getOutgoing(index, activityId, "hasManual").length > 0;
}

function usesSystem(
  index: ReturnType<typeof buildGraphIndex>,
  activityId: string,
): boolean {
  return getOutgoing(index, activityId, "usesSystem").length > 0;
}

function formatList(labels: string[], max = 10): string {
  if (labels.length === 0) return "(없음)";
  const shown = labels.slice(0, max);
  const suffix = labels.length > max ? ` 외 ${labels.length - max}개` : "";
  return `${shown.join(", ")}${suffix}`;
}

function buildCqCard(
  id: string,
  title: string,
  question: string,
  answer: string,
  explanation: string,
  evidence: { nodeIds: string[]; edgeIds: string[]; summary?: string },
  reasons: string[] = [],
  metrics?: Record<string, number | string>,
): InsightCard {
  const card: InsightCard = {
    id,
    category: "cq",
    title,
    question,
    answer,
    explanation,
    reasons,
    metrics,
    evidence,
    markdown: "",
  };
  card.markdown = generateInsightMarkdown(card);
  return card;
}

export function answerSystemsUsedByProcess(
  graph: ProcessGraph,
  processId: string,
  index?: GraphIndex,
): InsightCard {
  const resolvedIndex = index ?? buildGraphIndex(graph);
  const process = resolvedIndex.nodesById.get(processId);
  const processLabel = getNodeLabel(process);

  const directEdges = getOutgoing(resolvedIndex, processId, "usesSystem");
  const directSystems = getTargets(resolvedIndex, processId, "usesSystem");

  let systems = directSystems;
  let edges = directEdges;
  let evidenceSummary =
    "프로세스와 시스템 간 직접 연결 관계를 기준으로 집계했습니다.";

  if (systems.length === 0) {
    const activityEdges = getOutgoing(resolvedIndex, processId, "hasActivity");
    const fallbackEdges: GraphEdge[] = [];
    const fallbackSystems: typeof directSystems = [];
    for (const actEdge of activityEdges) {
      const sysEdges = getOutgoing(resolvedIndex, actEdge.target, "usesSystem");
      for (const sysEdge of sysEdges) {
        fallbackEdges.push(actEdge, sysEdge);
        const sys = resolvedIndex.nodesById.get(sysEdge.target);
        if (sys) fallbackSystems.push(sys);
      }
    }
    const seen = new Set<string>();
    systems = fallbackSystems.filter((s) => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });
    edges = fallbackEdges;
    evidenceSummary =
      "프로세스 소속 업무 단계에서 사용하는 시스템을 포함해 집계했습니다.";
  }

  const labels = systems.map((s) => getNodeLabel(s));
  const answer =
    systems.length === 0
      ? `이 프로세스(${processLabel})는 연결된 시스템이 없습니다.`
      : `이 프로세스는 ${systems.length}개 시스템을 사용합니다: ${formatList(labels)}.`;

  return buildCqCard(
    `cq-systems-by-process-${processId}`,
    `시스템 사용: ${processLabel}`,
    "이 프로세스는 어떤 시스템을 사용하는가?",
    answer,
    evidenceSummary,
    evidenceFromEdges(edges, evidenceSummary),
    [],
    { systemCount: systems.length },
  );
}

export function answerProcessesUsingSystem(
  graph: ProcessGraph,
  systemId: string,
  index?: GraphIndex,
): InsightCard {
  const resolvedIndex = index ?? buildGraphIndex(graph);
  const system = resolvedIndex.nodesById.get(systemId);
  const systemLabel = getNodeLabel(system);

  const edges = getIncoming(resolvedIndex, systemId, "usesSystem");
  const processIds = new Set<string>();
  for (const edge of edges) {
    const source = resolvedIndex.nodesById.get(edge.source);
    if (source?.type === "Process") {
      processIds.add(edge.source);
    } else if (source?.type === "ProcessActivity") {
      const pid = findParentProcessId(resolvedIndex, edge.source);
      if (pid) processIds.add(pid);
    }
  }

  const processes = [...processIds]
    .map((id) => resolvedIndex.nodesById.get(id))
    .filter((n): n is NonNullable<typeof n> => n != null);
  const labels = processes.map((p) => getNodeLabel(p));

  const answer =
    processes.length === 0
      ? `이 시스템(${systemLabel})을 사용하는 프로세스가 없습니다.`
      : `이 시스템은 ${processes.length}개 프로세스에서 사용됩니다: ${formatList(labels)}.`;

  return buildCqCard(
    `cq-processes-using-system-${systemId}`,
    `시스템 사용 프로세스: ${systemLabel}`,
    "이 시스템을 사용하는 프로세스는 무엇인가?",
    answer,
    "이 시스템을 사용하는 프로세스 목록을 그래프 연결 관계에서 찾았습니다.",
    evidenceFromEdges(edges),
    [],
    { processCount: processes.length },
  );
}

export function answerOrganizationsInvolvedInProcess(
  graph: ProcessGraph,
  processId: string,
  index?: GraphIndex,
): InsightCard {
  const resolvedIndex = index ?? buildGraphIndex(graph);
  const process = resolvedIndex.nodesById.get(processId);
  const processLabel = getNodeLabel(process);

  const edges = getOutgoing(resolvedIndex, processId, "performedByOrganization");
  const orgs = getTargets(resolvedIndex, processId, "performedByOrganization");
  const labels = orgs.map((o) => getNodeLabel(o));

  const answer =
    orgs.length === 0
      ? `이 프로세스(${processLabel})에 연결된 조직이 없습니다.`
      : `이 프로세스는 ${orgs.length}개 조직이 관여합니다: ${formatList(labels)}.`;

  return buildCqCard(
    `cq-orgs-by-process-${processId}`,
    `관여 조직: ${processLabel}`,
    "이 프로세스에 관여하는 조직은 무엇인가?",
    answer,
    "프로세스에 연결된 조직(수행 주체) 관계를 기준으로 집계했습니다.",
    evidenceFromEdges(
      edges,
      "Process --performedByOrganization--> Organization",
    ),
    [],
    { organizationCount: orgs.length },
  );
}

export function answerProcessesInvolvingOrganization(
  graph: ProcessGraph,
  organizationId: string,
  index?: GraphIndex,
): InsightCard {
  const resolvedIndex = index ?? buildGraphIndex(graph);
  const org = resolvedIndex.nodesById.get(organizationId);
  const orgLabel = getNodeLabel(org);

  const edges = getIncoming(resolvedIndex, organizationId, "performedByOrganization");
  const processes = getSources(
    resolvedIndex,
    organizationId,
    "performedByOrganization",
  ).filter((n) => n.type === "Process");
  const labels = processes.map((p) => getNodeLabel(p));

  const answer =
    processes.length === 0
      ? `이 조직(${orgLabel})이 관여하는 프로세스가 없습니다.`
      : `이 조직은 ${processes.length}개 프로세스에 관여합니다: ${formatList(labels)}.`;

  return buildCqCard(
    `cq-processes-by-org-${organizationId}`,
    `조직 관여 프로세스: ${orgLabel}`,
    "이 조직이 관여하는 프로세스는 무엇인가?",
    answer,
    "조직이 수행 주체로 연결된 프로세스를 그래프에서 찾았습니다.",
    evidenceFromEdges(edges),
    [],
    { processCount: processes.length },
  );
}

export function answerSuppliersInvolvedInProcess(
  graph: ProcessGraph,
  processId: string,
): InsightCard {
  const index = buildGraphIndex(graph);
  const process = index.nodesById.get(processId);
  const processLabel = getNodeLabel(process);

  const edges = getOutgoing(index, processId, "performedBySupplier");
  const suppliers = getTargets(index, processId, "performedBySupplier");
  const labels = suppliers.map((s) => getNodeLabel(s));

  const answer =
    suppliers.length === 0
      ? `이 프로세스(${processLabel})에 연결된 공급사가 없습니다.`
      : `이 프로세스는 ${suppliers.length}개 공급사가 관여합니다: ${formatList(labels)}.`;

  return buildCqCard(
    `cq-suppliers-by-process-${processId}`,
    `관여 공급사: ${processLabel}`,
    "이 프로세스에 관여하는 공급사는 무엇인가?",
    answer,
    "프로세스에 연결된 공급사(수행 주체) 관계를 기준으로 집계했습니다.",
    evidenceFromEdges(edges),
    [],
    { supplierCount: suppliers.length },
  );
}

export function answerDataStoresReferencedByProcess(
  graph: ProcessGraph,
  processId: string,
): InsightCard {
  const index = buildGraphIndex(graph);
  const process = index.nodesById.get(processId);
  const processLabel = getNodeLabel(process);

  const edges = getOutgoing(index, processId, "referencesDataStore");
  const stores = getTargets(index, processId, "referencesDataStore");
  const labels = stores.map((d) => getNodeLabel(d));

  const answer =
    stores.length === 0
      ? `이 프로세스(${processLabel})가 참조하는 DataStore가 없습니다.`
      : `이 프로세스는 ${stores.length}개 DataStore를 참조합니다: ${formatList(labels)}.`;

  return buildCqCard(
    `cq-datastores-by-process-${processId}`,
    `참조 DataStore: ${processLabel}`,
    "이 프로세스가 참조하는 DataStore는 무엇인가?",
    answer,
    "프로세스가 참조하는 데이터저장소 연결을 기준으로 집계했습니다.",
    evidenceFromEdges(edges),
    [],
    { dataStoreCount: stores.length },
  );
}

export function answerManualOnlyActivities(graph: ProcessGraph): InsightCard {
  const index = buildGraphIndex(graph);
  const activities = index.nodesByType.get("ProcessActivity") ?? [];
  const matches: { id: string; label: string; edges: GraphEdge[] }[] = [];

  for (const activity of activities) {
    if (!isManualActivity(index, activity.id)) continue;
    if (usesSystem(index, activity.id)) continue;
    const edges = [
      ...getOutgoing(index, activity.id, "hasManual"),
      ...getIncoming(index, activity.id, "hasActivity"),
    ];
    matches.push({ id: activity.id, label: getNodeLabel(activity), edges });
  }

  const top = matches.slice(0, 20);
  const labels = top.map((m) => m.label);
  const allEdges = top.flatMap((m) => m.edges);

  const answer =
    matches.length === 0
      ? "시스템을 사용하지 않는 수동 작업 단계가 없습니다."
      : `시스템을 사용하지 않는 수동 작업 단계는 ${matches.length}개입니다. 예: ${formatList(labels, 20)}.`;

  return buildCqCard(
    "cq-manual-only-activities",
    "수동 전용 Activity",
    "시스템을 사용하지 않는 수동 작업 단계는 무엇인가?",
    answer,
    "수동 작업으로 분류되면서 시스템 연결이 없는 업무 단계를 찾았습니다.",
    mergeEvidence(
      evidenceFromEdges(allEdges),
      { nodeIds: top.map((m) => m.id), edgeIds: [] },
    ),
    [],
    { totalCount: matches.length, shownCount: top.length },
  );
}

export function answerActivitiesWithoutResponsibility(
  graph: ProcessGraph,
): InsightCard {
  const index = buildGraphIndex(graph);
  const activities = index.nodesByType.get("ProcessActivity") ?? [];
  const matches: { id: string; label: string; edges: GraphEdge[] }[] = [];

  for (const activity of activities) {
    const hasLane = getOutgoing(index, activity.id, "assignedToLane").length > 0;
    const hasOrg =
      getOutgoing(index, activity.id, "performedByOrganization").length > 0;
    const hasSupplier =
      getOutgoing(index, activity.id, "performedBySupplier").length > 0;
    if (hasLane || hasOrg || hasSupplier) continue;

    const edges = getIncoming(index, activity.id, "hasActivity");
    matches.push({ id: activity.id, label: getNodeLabel(activity), edges });
  }

  const top = matches.slice(0, 20);
  const labels = top.map((m) => m.label);
  const allEdges = top.flatMap((m) => m.edges);

  const answer =
    matches.length === 0
      ? "책임 주체(레인·조직·공급사)가 없는 업무 단계가 없습니다."
      : `책임 주체가 지정되지 않은 업무 단계는 ${matches.length}개입니다. 예: ${formatList(labels, 20)}.`;

  return buildCqCard(
    "cq-activities-without-responsibility",
    "책임 없는 Activity",
    "레인·조직·공급사 책임이 없는 업무 단계는 무엇인가?",
    answer,
    "수행 레인, 조직, 공급사 중 어느 것에도 연결되지 않은 업무 단계를 찾았습니다.",
    mergeEvidence(
      evidenceFromEdges(allEdges),
      { nodeIds: top.map((m) => m.id), edgeIds: [] },
    ),
    [],
    { totalCount: matches.length, shownCount: top.length },
  );
}

export { isManualActivity, usesSystem, HANDOFF_BPMN_TYPES };
