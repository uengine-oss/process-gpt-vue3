import type { GraphEdge, GraphNode, ParserWarning } from "./types";

function nodesEqual(a: GraphNode, b: GraphNode): boolean {
  return (
    a.id === b.id &&
    a.type === b.type &&
    a.label === b.label &&
    JSON.stringify(a.properties) === JSON.stringify(b.properties)
  );
}

export function mergeGraphs(
  graphs: Array<{
    nodes: GraphNode[];
    edges: GraphEdge[];
    warnings?: ParserWarning[];
  }>,
): {
  nodes: GraphNode[];
  edges: GraphEdge[];
  warnings: ParserWarning[];
} {
  const nodeById = new Map<string, GraphNode>();
  const edgeById = new Map<string, GraphEdge>();
  const warnings: ParserWarning[] = [];

  for (const graph of graphs) {
    if (graph.warnings) {
      warnings.push(...graph.warnings);
    }

    for (const node of graph.nodes) {
      const existing = nodeById.get(node.id);
      if (!existing) {
        nodeById.set(node.id, node);
        continue;
      }

      if (existing.type !== node.type) {
        warnings.push({
          code: "duplicate-node-conflict",
          message: `Duplicate node id ${node.id} has conflicting types: ${existing.type} vs ${node.type}`,
          severity: "warning",
          details: {
            existingType: existing.type,
            incomingType: node.type,
          },
        });
        continue;
      }

      if (!nodesEqual(existing, node)) {
        warnings.push({
          code: "duplicate-node-properties",
          message: `Duplicate node id ${node.id} has differing properties; keeping first occurrence`,
          severity: "info",
          details: {
            type: node.type,
          },
        });
      }
    }

    for (const edge of graph.edges) {
      if (!edgeById.has(edge.id)) {
        edgeById.set(edge.id, edge);
      }
    }
  }

  return {
    nodes: [...nodeById.values()],
    edges: [...edgeById.values()],
    warnings,
  };
}
