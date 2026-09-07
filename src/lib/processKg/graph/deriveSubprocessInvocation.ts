import { makeEdgeId } from "./helpers";
import type { GraphEdge, GraphNode, ProcessGraph } from "./types";

function isCallActivityNode(node: GraphNode): boolean {
  if (node.type !== "ProcessActivity") return false;
  if (node.properties.bpmnType === "callActivity") return true;
  if (node.properties.activityKind === "process_call") return true;
  if (node.properties.isCallReference === true) return true;
  const definitionId = node.properties.definitionId;
  return typeof definitionId === "string" && definitionId.trim().length > 0;
}

function getProcessActivityIds(
  processId: string,
  edges: GraphEdge[],
  nodesById: Map<string, GraphNode>,
): string[] {
  return edges
    .filter((edge) => edge.type === "hasActivity" && edge.source === processId)
    .map((edge) => edge.target)
    .filter((id) => nodesById.get(id)?.type === "ProcessActivity");
}

/**
 * Adds derived Process -> ProcessModel shortcut edges for subprocess invocation chains:
 * Process -> CallActivity -> callsProcessModel -> ProcessModel
 */
export function addInvokesSubprocessEdges(graph: ProcessGraph): ProcessGraph {
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const edgeIds = new Set(graph.edges.map((edge) => edge.id));
  const edges: GraphEdge[] = [...graph.edges];

  const addEdge = (edge: GraphEdge): void => {
    if (edgeIds.has(edge.id)) return;
    edgeIds.add(edge.id);
    edges.push(edge);
  };

  for (const node of graph.nodes) {
    if (node.type !== "Process") continue;

    const seenTargets = new Set<string>(
      edges
        .filter(
          (candidate) =>
            candidate.type === "invokesSubprocess" && candidate.source === node.id,
        )
        .map((candidate) => candidate.target),
    );

    for (const activityId of getProcessActivityIds(node.id, edges, nodesById)) {
      const activity = nodesById.get(activityId);
      if (!activity || !isCallActivityNode(activity)) continue;

      for (const edge of edges) {
        if (edge.source !== activityId || edge.type !== "callsProcessModel") continue;
        if (seenTargets.has(edge.target)) continue;
        seenTargets.add(edge.target);

        addEdge({
          id: makeEdgeId(
            "invokesSubprocess",
            node.id,
            edge.target,
            `invoke-${node.id}-${activityId}-${edge.target}`,
          ),
          type: "invokesSubprocess",
          source: node.id,
          target: edge.target,
          properties: {
            derived: true,
            viaActivityId: activityId,
            definitionId: edge.properties?.definitionId,
          },
        });
      }
    }
  }

  return { ...graph, edges };
}
