import type { ProcessGraph } from "../graph/types";
import {
  HANDOFF_BPMN_TYPES,
  isManualActivity,
} from "./competencyQuestions";
import { buildGraphIndex, getOutgoing, getTargets } from "./graphIndex";
import type { InsightCard } from "./types";

export interface EvidenceSubgraphOptions {
  maxNodes?: number;
  maxEdges?: number;
}

export interface EvidenceSubgraph {
  nodeIds: Set<string>;
  edgeIds: Set<string>;
}

function addEdge(
  graph: ProcessGraph,
  nodeIds: Set<string>,
  edgeIds: Set<string>,
  edgeId: string,
  maxNodes: number,
  maxEdges: number,
): boolean {
  if (edgeIds.size >= maxEdges) return false;
  const edge = graph.edges.find((e) => e.id === edgeId);
  if (!edge) return false;
  if (
    nodeIds.size + 2 > maxNodes &&
    !nodeIds.has(edge.source) &&
    !nodeIds.has(edge.target)
  ) {
    return false;
  }
  edgeIds.add(edgeId);
  nodeIds.add(edge.source);
  nodeIds.add(edge.target);
  return true;
}

function addNode(
  nodeIds: Set<string>,
  nodeId: string,
  maxNodes: number,
): boolean {
  if (nodeIds.size >= maxNodes) return false;
  nodeIds.add(nodeId);
  return true;
}

function isHandoffActivity(
  index: ReturnType<typeof buildGraphIndex>,
  activityId: string,
): boolean {
  const node = index.nodesById.get(activityId);
  if (!node) return false;
  const bpmnType = node.properties.bpmnType;
  if (typeof bpmnType === "string" && HANDOFF_BPMN_TYPES.has(bpmnType)) {
    return true;
  }
  return Boolean(node.properties.definitionId);
}

function buildMinimalBottleneckEvidence(
  graph: ProcessGraph,
  insight: InsightCard,
  nodeIds: Set<string>,
  edgeIds: Set<string>,
  maxNodes: number,
  maxEdges: number,
): void {
  const index = buildGraphIndex(graph);
  const processId = insight.evidence.nodeIds.find((id) => {
    const node = index.nodesById.get(id);
    return node?.type === "Process";
  });
  if (!processId) return;

  nodeIds.clear();
  edgeIds.clear();
  addNode(nodeIds, processId, maxNodes);

  const categories = [
    "usesSystem",
    "performedByOrganization",
    "performedBySupplier",
  ] as const;

  for (const edgeType of categories) {
    for (const edge of getOutgoing(index, processId, edgeType).slice(0, 3)) {
      if (edgeIds.size >= maxEdges || nodeIds.size >= maxNodes) return;
      addEdge(graph, nodeIds, edgeIds, edge.id, maxNodes, maxEdges);
    }
  }

  const activities = getTargets(index, processId, "hasActivity");
  let rep = 0;
  for (const activity of activities) {
    if (rep >= 3 || nodeIds.size >= maxNodes) break;
    if (
      isHandoffActivity(index, activity.id) ||
      isManualActivity(index, activity.id)
    ) {
      addNode(nodeIds, activity.id, maxNodes);
      rep += 1;
    }
  }
}

function expandImpactEvidence(
  graph: ProcessGraph,
  insight: InsightCard,
  nodeIds: Set<string>,
  edgeIds: Set<string>,
  maxNodes: number,
  maxEdges: number,
): void {
  const index = buildGraphIndex(graph);
  const systemId = insight.evidence.nodeIds.find((id) => {
    const node = index.nodesById.get(id);
    return node?.type === "System";
  });
  if (!systemId) return;

  if (insight.category === "impact") {
    nodeIds.clear();
    edgeIds.clear();
  }

  addNode(nodeIds, systemId, maxNodes);

  const incoming = getIncoming(index, systemId, "usesSystem").slice(0, 5);
  for (const edge of incoming) {
    if (edgeIds.size >= maxEdges || nodeIds.size >= maxNodes) break;
    addEdge(graph, nodeIds, edgeIds, edge.id, maxNodes, maxEdges);
    const source = index.nodesById.get(edge.source);
    if (source?.type === "ProcessActivity") {
      const parentEdges = (index.incomingByNodeId.get(edge.source) ?? []).filter(
        (e) => e.type === "hasActivity",
      );
      for (const actEdge of parentEdges.slice(0, 1)) {
        addEdge(graph, nodeIds, edgeIds, actEdge.id, maxNodes, maxEdges);
      }
    }
  }

  const processNodes = [...nodeIds].filter(
    (id) => index.nodesById.get(id)?.type === "Process",
  );
  for (const processId of processNodes.slice(0, 5)) {
    if (nodeIds.size >= maxNodes) break;
    for (const orgEdge of getOutgoing(
      index,
      processId,
      "performedByOrganization",
    ).slice(0, 2)) {
      if (edgeIds.size >= maxEdges || nodeIds.size >= maxNodes) break;
      addEdge(graph, nodeIds, edgeIds, orgEdge.id, maxNodes, maxEdges);
    }
  }
}

function buildMinimalOrganizationEvidence(
  graph: ProcessGraph,
  insight: InsightCard,
  nodeIds: Set<string>,
  edgeIds: Set<string>,
  maxNodes: number,
  maxEdges: number,
): void {
  const index = buildGraphIndex(graph);
  const organizationId = insight.evidence.nodeIds.find((id) => {
    const node = index.nodesById.get(id);
    return node?.type === "Organization";
  });
  if (!organizationId) return;

  nodeIds.clear();
  edgeIds.clear();
  addNode(nodeIds, organizationId, maxNodes);

  const processIds = [...insight.evidence.nodeIds].filter(
    (id) => index.nodesById.get(id)?.type === "Process",
  );
  for (const processId of processIds.slice(0, 5)) {
    if (nodeIds.size >= maxNodes) break;
    addNode(nodeIds, processId, maxNodes);
    for (const edge of getOutgoing(
      index,
      processId,
      "performedByOrganization",
    ).slice(0, 1)) {
      if (edge.target === organizationId) {
        addEdge(graph, nodeIds, edgeIds, edge.id, maxNodes, maxEdges);
      }
    }
    for (const edge of getOutgoing(index, processId, "usesSystem").slice(0, 2)) {
      if (edgeIds.size >= maxEdges || nodeIds.size >= maxNodes) break;
      addEdge(graph, nodeIds, edgeIds, edge.id, maxNodes, maxEdges);
    }
  }

  const activityIds = [...insight.evidence.nodeIds].filter(
    (id) => index.nodesById.get(id)?.type === "ProcessActivity",
  );
  for (const activityId of activityIds.slice(0, 5)) {
    if (nodeIds.size >= maxNodes) break;
    addNode(nodeIds, activityId, maxNodes);
  }
}

function getIncoming(
  index: ReturnType<typeof buildGraphIndex>,
  nodeId: string,
  edgeType: "usesSystem",
) {
  return (index.incomingByNodeId.get(nodeId) ?? []).filter(
    (e) => e.type === edgeType,
  );
}

function buildMinimalAutomationEvidence(
  graph: ProcessGraph,
  insight: InsightCard,
  nodeIds: Set<string>,
  edgeIds: Set<string>,
  maxNodes: number,
  maxEdges: number,
): void {
  nodeIds.clear();
  edgeIds.clear();
  for (const nodeId of insight.evidence.nodeIds.slice(0, maxNodes)) {
    addNode(nodeIds, nodeId, maxNodes);
  }
  for (const edgeId of insight.evidence.edgeIds.slice(0, maxEdges)) {
    addEdge(graph, nodeIds, edgeIds, edgeId, maxNodes, maxEdges);
  }
}

function buildMinimalQualityEvidence(
  graph: ProcessGraph,
  insight: InsightCard,
  nodeIds: Set<string>,
  edgeIds: Set<string>,
  maxNodes: number,
  maxEdges: number,
): void {
  const index = buildGraphIndex(graph);
  const processId = insight.evidence.nodeIds.find(
    (id) => index.nodesById.get(id)?.type === "Process",
  );
  if (!processId) {
    for (const nodeId of insight.evidence.nodeIds.slice(0, maxNodes)) {
      addNode(nodeIds, nodeId, maxNodes);
    }
    return;
  }

  nodeIds.clear();
  edgeIds.clear();
  addNode(nodeIds, processId, maxNodes);

  const activityIds = insight.evidence.nodeIds.filter(
    (id) => index.nodesById.get(id)?.type === "ProcessActivity",
  );
  for (const activityId of activityIds.slice(0, 8)) {
    if (nodeIds.size >= maxNodes) break;
    addNode(nodeIds, activityId, maxNodes);
    for (const edge of getOutgoing(index, activityId, "usesSystem").slice(0, 1)) {
      if (edgeIds.size >= maxEdges || nodeIds.size >= maxNodes) break;
      addEdge(graph, nodeIds, edgeIds, edge.id, maxNodes, maxEdges);
    }
  }
}

export function buildEvidenceSubgraph(
  graph: ProcessGraph,
  insight: InsightCard,
  options?: EvidenceSubgraphOptions,
): EvidenceSubgraph {
  const maxNodes = options?.maxNodes ?? 25;
  const maxEdges = options?.maxEdges ?? 40;

  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();

  if (insight.category === "bottleneck") {
    buildMinimalBottleneckEvidence(
      graph,
      insight,
      nodeIds,
      edgeIds,
      maxNodes,
      maxEdges,
    );
  } else if (insight.category === "impact") {
    expandImpactEvidence(graph, insight, nodeIds, edgeIds, maxNodes, maxEdges);
  } else if (insight.category === "organization") {
    buildMinimalOrganizationEvidence(
      graph,
      insight,
      nodeIds,
      edgeIds,
      maxNodes,
      maxEdges,
    );
  } else if (insight.category === "enrichment") {
    for (const nodeId of insight.evidence.nodeIds.slice(0, maxNodes)) {
      addNode(nodeIds, nodeId, maxNodes);
    }
    for (const edgeId of insight.evidence.edgeIds.slice(0, maxEdges)) {
      addEdge(graph, nodeIds, edgeIds, edgeId, maxNodes, maxEdges);
    }
  } else if (insight.category === "redesign") {
    for (const nodeId of insight.evidence.nodeIds.slice(0, maxNodes)) {
      addNode(nodeIds, nodeId, maxNodes);
    }
    for (const edgeId of insight.evidence.edgeIds.slice(0, maxEdges)) {
      addEdge(graph, nodeIds, edgeIds, edgeId, maxNodes, maxEdges);
    }
  } else if (insight.category === "automation") {
    buildMinimalAutomationEvidence(
      graph,
      insight,
      nodeIds,
      edgeIds,
      maxNodes,
      maxEdges,
    );
  } else if (insight.category === "quality") {
    buildMinimalQualityEvidence(
      graph,
      insight,
      nodeIds,
      edgeIds,
      maxNodes,
      maxEdges,
    );
  } else {
    for (const nodeId of insight.evidence.nodeIds) {
      if (nodeIds.size >= maxNodes) break;
      nodeIds.add(nodeId);
    }
    for (const edgeId of insight.evidence.edgeIds) {
      if (edgeIds.size >= maxEdges) break;
      addEdge(graph, nodeIds, edgeIds, edgeId, maxNodes, maxEdges);
    }
  }

  trimSubgraph(graph, insight, nodeIds, edgeIds, maxNodes, maxEdges);

  return { nodeIds, edgeIds };
}

function trimSubgraph(
  graph: ProcessGraph,
  insight: InsightCard,
  nodeIds: Set<string>,
  edgeIds: Set<string>,
  maxNodes: number,
  maxEdges: number,
): void {
  if (edgeIds.size > maxEdges) {
    const keptEdges = [...edgeIds].slice(0, maxEdges);
    edgeIds.clear();
    for (const id of keptEdges) edgeIds.add(id);
  }

  if (nodeIds.size <= maxNodes) {
    pruneDanglingEdges(graph, nodeIds, edgeIds);
    return;
  }

  const priority: string[] = [];
  for (const id of insight.evidence.nodeIds) {
    if (nodeIds.has(id)) priority.push(id);
  }
  for (const id of nodeIds) {
    if (!priority.includes(id)) priority.push(id);
  }

  const keptNodes = new Set(priority.slice(0, maxNodes));
  nodeIds.clear();
  for (const id of keptNodes) nodeIds.add(id);
  pruneDanglingEdges(graph, nodeIds, edgeIds);
}

function pruneDanglingEdges(
  graph: ProcessGraph,
  nodeIds: Set<string>,
  edgeIds: Set<string>,
): void {
  for (const edgeId of [...edgeIds]) {
    const edge = graph.edges.find((e) => e.id === edgeId);
    if (!edge || !nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      edgeIds.delete(edgeId);
    }
  }
}
