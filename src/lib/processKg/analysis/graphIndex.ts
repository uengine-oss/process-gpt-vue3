import type {
  EdgeType,
  GraphEdge,
  GraphNode,
  NodeType,
  ProcessGraph,
} from "../graph/types";
import type { EvidenceRef } from "./types";

export interface GraphIndex {
  nodesById: Map<string, GraphNode>;
  edgesById: Map<string, GraphEdge>;
  outgoingByNodeId: Map<string, GraphEdge[]>;
  incomingByNodeId: Map<string, GraphEdge[]>;
  nodesByType: Map<NodeType, GraphNode[]>;
  edgesByType: Map<EdgeType, GraphEdge[]>;
}

function propertyString(
  properties: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = properties[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function getNodeLabel(node: GraphNode | undefined): string {
  if (!node) return "";
  const displayName = propertyString(node.properties, "displayName");
  if (displayName) return displayName;
  if (node.label.trim()) return node.label.trim();
  const name = propertyString(node.properties, "name");
  if (name) return name;
  return node.id;
}

export function buildGraphIndex(graph: ProcessGraph): GraphIndex {
  const nodesById = new Map<string, GraphNode>();
  const edgesById = new Map<string, GraphEdge>();
  const outgoingByNodeId = new Map<string, GraphEdge[]>();
  const incomingByNodeId = new Map<string, GraphEdge[]>();
  const nodesByType = new Map<NodeType, GraphNode[]>();
  const edgesByType = new Map<EdgeType, GraphEdge[]>();

  for (const node of graph.nodes) {
    nodesById.set(node.id, node);
    const typeNodes = nodesByType.get(node.type) ?? [];
    typeNodes.push(node);
    nodesByType.set(node.type, typeNodes);
  }

  for (const edge of graph.edges) {
    edgesById.set(edge.id, edge);
    const outgoing = outgoingByNodeId.get(edge.source) ?? [];
    outgoing.push(edge);
    outgoingByNodeId.set(edge.source, outgoing);
    const incoming = incomingByNodeId.get(edge.target) ?? [];
    incoming.push(edge);
    incomingByNodeId.set(edge.target, incoming);
    const typeEdges = edgesByType.get(edge.type) ?? [];
    typeEdges.push(edge);
    edgesByType.set(edge.type, typeEdges);
  }

  return {
    nodesById,
    edgesById,
    outgoingByNodeId,
    incomingByNodeId,
    nodesByType,
    edgesByType,
  };
}

export function getOutgoing(
  index: GraphIndex,
  nodeId: string,
  edgeType?: EdgeType,
): GraphEdge[] {
  const edges = index.outgoingByNodeId.get(nodeId) ?? [];
  if (!edgeType) return edges;
  return edges.filter((edge) => edge.type === edgeType);
}

export function getIncoming(
  index: GraphIndex,
  nodeId: string,
  edgeType?: EdgeType,
): GraphEdge[] {
  const edges = index.incomingByNodeId.get(nodeId) ?? [];
  if (!edgeType) return edges;
  return edges.filter((edge) => edge.type === edgeType);
}

export function getTargets(
  index: GraphIndex,
  nodeId: string,
  edgeType?: EdgeType,
): GraphNode[] {
  return getOutgoing(index, nodeId, edgeType)
    .map((edge) => index.nodesById.get(edge.target))
    .filter((node): node is GraphNode => node != null);
}

export function getSources(
  index: GraphIndex,
  nodeId: string,
  edgeType?: EdgeType,
): GraphNode[] {
  return getIncoming(index, nodeId, edgeType)
    .map((edge) => index.nodesById.get(edge.source))
    .filter((node): node is GraphNode => node != null);
}

export function findParentProcessId(
  index: GraphIndex,
  activityId: string,
): string | undefined {
  for (const edge of getIncoming(index, activityId, "hasActivity")) {
    return edge.source;
  }
  return undefined;
}

export function mergeEvidence(...refs: EvidenceRef[]): EvidenceRef {
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();
  for (const ref of refs) {
    for (const id of ref.nodeIds) nodeIds.add(id);
    for (const id of ref.edgeIds) edgeIds.add(id);
  }
  return { nodeIds: [...nodeIds], edgeIds: [...edgeIds] };
}

export function evidenceFromEdges(
  edges: GraphEdge[],
  summary?: string,
): EvidenceRef {
  const nodeIds = new Set<string>();
  const edgeIds: string[] = [];
  for (const edge of edges) {
    edgeIds.push(edge.id);
    nodeIds.add(edge.source);
    nodeIds.add(edge.target);
  }
  return { nodeIds: [...nodeIds], edgeIds, summary };
}
