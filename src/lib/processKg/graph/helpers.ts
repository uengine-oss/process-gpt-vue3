import type { GraphEdge, GraphNode } from "./types";

export function safeLabel(
  ...candidates: Array<string | undefined | null>
): string {
  for (const candidate of candidates) {
    if (candidate != null && String(candidate).trim() !== "") {
      return String(candidate).trim();
    }
  }
  return "(unnamed)";
}

export function stableSlug(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
}

export function makeNodeId(
  type: string,
  rawId: string,
  sourceModelId?: string,
): string {
  const scopedTypes = new Set([
    "Process",
    "Participant",
    "Lane",
    "Activity",
    "Gateway",
    "Event",
    "SequenceFlow",
    "DataStore",
    "DataObject",
    "Annotation",
    "Manual",
    "FTEProfile",
    "CostProfile",
    "Project",
  ]);

  if (type === "ProcessModel") {
    return `ProcessModel:${rawId}`;
  }

  if (type === "System") {
    return `System:${rawId}`;
  }

  if (scopedTypes.has(type) && sourceModelId) {
    return `${type}:${sourceModelId}:${rawId}`;
  }

  return `${type}:${rawId}`;
}

export function makeEdgeId(
  type: string,
  source: string,
  target: string,
  rawId?: string,
): string {
  if (rawId) {
    return `${type}:${rawId}`;
  }
  return `${type}:${source}->${target}`;
}

export function dedupeNodes(nodes: GraphNode[]): GraphNode[] {
  const seen = new Set<string>();
  const result: GraphNode[] = [];

  for (const node of nodes) {
    if (seen.has(node.id)) continue;
    seen.add(node.id);
    result.push(node);
  }

  return result;
}

export function dedupeEdges(edges: GraphEdge[]): GraphEdge[] {
  const seen = new Set<string>();
  const result: GraphEdge[] = [];

  for (const edge of edges) {
    if (seen.has(edge.id)) continue;
    seen.add(edge.id);
    result.push(edge);
  }

  return result;
}

export function countByType<T extends { type: string }>(
  items: T[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    counts[item.type] = (counts[item.type] ?? 0) + 1;
  }
  return counts;
}

export function normalizedElementName(name?: string): string | undefined {
  if (!name) return undefined;
  const stripped = name.replace(/^\[[^\]]+\]\s*/, "").trim();
  return stripped || name;
}
