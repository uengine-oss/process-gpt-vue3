import { makeEdgeId } from "./helpers";
import type { EdgeType, GraphEdge, GraphNode, ProcessGraph } from "./types";

const ACTIVITY_ROLLUP_EDGE_TYPES: EdgeType[] = [
  "usesSystem",
  "performedByOrganization",
  "performedBySupplier",
  "relatedToProject",
  "hasManual",
  "referencesDataStore",
  "usesDataObject",
  "producesDataObject",
  "hasAnnotation",
];

const PROCESS_ELEMENT_TYPES = new Set([
  "ProcessActivity",
  "Gateway",
  "Event",
]);

interface RollupContribution {
  sourceId: string;
  sourceLabel: string;
  sourceType: string;
}

interface RollupGroup {
  edgeType: EdgeType;
  targetId: string;
  contributions: RollupContribution[];
}

interface SummaryEntry {
  id: string;
  label: string;
  activityCount: number;
}

function isDerivedEdge(edge: GraphEdge): boolean {
  return edge.properties?.derived === true;
}

function nodeMap(nodes: GraphNode[]): Map<string, GraphNode> {
  return new Map(nodes.map((node) => [node.id, node]));
}

function getProcessActivityIds(
  processId: string,
  edges: GraphEdge[],
  nodesById: Map<string, GraphNode>,
): string[] {
  const fromHasActivity = edges
    .filter((edge) => edge.type === "hasActivity" && edge.source === processId)
    .map((edge) => edge.target);

  if (fromHasActivity.length > 0) {
    return fromHasActivity.filter(
      (id) => nodesById.get(id)?.type === "ProcessActivity",
    );
  }

  return edges
    .filter(
      (edge) =>
        edge.type === "containsElement" &&
        edge.source === processId &&
        nodesById.get(edge.target)?.type === "ProcessActivity",
    )
    .map((edge) => edge.target);
}

function getProcessElementIds(
  processId: string,
  edges: GraphEdge[],
  nodesById: Map<string, GraphNode>,
): string[] {
  const activityIds = getProcessActivityIds(processId, edges, nodesById);
  const otherElements = edges
    .filter(
      (edge) =>
        edge.type === "containsElement" &&
        edge.source === processId &&
        PROCESS_ELEMENT_TYPES.has(nodesById.get(edge.target)?.type ?? ""),
    )
    .map((edge) => edge.target);

  return [...new Set([...activityIds, ...otherElements])];
}

function addDerivedActivityLaneEdges(
  edges: GraphEdge[],
  edgeIds: Set<string>,
  nodesById: Map<string, GraphNode>,
): GraphEdge[] {
  const newEdges: GraphEdge[] = [];

  for (const edge of edges) {
    if (edge.type !== "assignedToLane") continue;
    const activityId = edge.source;
    const laneId = edge.target;
    if (nodesById.get(activityId)?.type !== "ProcessActivity") continue;

    for (const laneEdge of edges) {
      if (laneEdge.source !== laneId) continue;

      if (laneEdge.type === "performedByOrganization") {
        const derivedId = makeEdgeId(
          "performedByOrganization",
          activityId,
          laneEdge.target,
          `derived-activity-org-${activityId}-${laneEdge.target}`,
        );
        if (edgeIds.has(derivedId)) continue;

        newEdges.push({
          id: derivedId,
          type: "performedByOrganization",
          source: activityId,
          target: laneEdge.target,
          properties: {
            derived: true,
            rollupFrom: "Lane",
            source: "lane-responsibility-rollup",
            laneId,
          },
        });
        edgeIds.add(derivedId);
      }

      if (laneEdge.type === "performedBySupplier") {
        const derivedId = makeEdgeId(
          "performedBySupplier",
          activityId,
          laneEdge.target,
          `derived-activity-supplier-${activityId}-${laneEdge.target}`,
        );
        if (edgeIds.has(derivedId)) continue;

        newEdges.push({
          id: derivedId,
          type: "performedBySupplier",
          source: activityId,
          target: laneEdge.target,
          properties: {
            derived: true,
            rollupFrom: "Lane",
            source: "lane-responsibility-rollup",
            laneId,
          },
        });
        edgeIds.add(derivedId);
      }
    }
  }

  return newEdges;
}

function collectActivityRollupEdges(
  elementId: string,
  edges: GraphEdge[],
): Array<{ edgeType: EdgeType; targetId: string }> {
  const results: Array<{ edgeType: EdgeType; targetId: string }> = [];

  for (const edge of edges) {
    if (edge.source !== elementId) continue;
    if (!ACTIVITY_ROLLUP_EDGE_TYPES.includes(edge.type)) continue;
    results.push({ edgeType: edge.type, targetId: edge.target });
  }

  return results;
}

function groupRollups(
  processId: string,
  elementIds: string[],
  edges: GraphEdge[],
  nodesById: Map<string, GraphNode>,
): RollupGroup[] {
  const groups = new Map<string, RollupGroup>();

  for (const elementId of elementIds) {
    const elementNode = nodesById.get(elementId);
    if (!elementNode) continue;

    for (const { edgeType, targetId } of collectActivityRollupEdges(
      elementId,
      edges,
    )) {
      const key = `${processId}|${edgeType}|${targetId}`;
      const existing = groups.get(key);
      const contribution: RollupContribution = {
        sourceId: elementId,
        sourceLabel: elementNode.label,
        sourceType: elementNode.type,
      };

      if (existing) {
        if (!existing.contributions.some((c) => c.sourceId === elementId)) {
          existing.contributions.push(contribution);
        }
      } else {
        groups.set(key, {
          edgeType,
          targetId,
          contributions: [contribution],
        });
      }
    }
  }

  return [...groups.values()];
}

function rollupFromLabel(contributions: RollupContribution[]): string {
  const types = new Set(contributions.map((c) => c.sourceType));
  if (types.size === 1) {
    return types.has("ProcessActivity") ? "ProcessActivity" : "ProcessElement";
  }
  return "ProcessElement";
}

function createProcessRollupEdge(
  processId: string,
  group: RollupGroup,
  edgeIds: Set<string>,
): GraphEdge | null {
  const existingDirect = [...edgeIds].some((id) =>
    id.startsWith(`${group.edgeType}:${processId}->${group.targetId}`),
  );
  const rollupId = makeEdgeId(
    group.edgeType,
    processId,
    group.targetId,
    `rollup-${processId}-${group.edgeType}-${group.targetId}`,
  );

  if (edgeIds.has(rollupId)) return null;

  const activityContributions = group.contributions.filter(
    (c) => c.sourceType === "ProcessActivity",
  );
  const rollupFrom = rollupFromLabel(group.contributions);
  const activityIds = activityContributions.map((c) => c.sourceId);
  const activityLabels = activityContributions.map((c) => c.sourceLabel);

  return {
    id: rollupId,
    type: group.edgeType,
    source: processId,
    target: group.targetId,
    properties: {
      derived: true,
      rollupFrom,
      activityCount: activityContributions.length || group.contributions.length,
      elementCount: group.contributions.length,
      activityIds,
      activityLabels,
      elementIds: group.contributions.map((c) => c.sourceId),
      ...(existingDirect ? { note: "process-direct-edge-also-exists" } : {}),
    },
  };
}

function buildSummaryEntries(
  rollupGroups: RollupGroup[],
  edgeType: EdgeType,
  nodesById: Map<string, GraphNode>,
): SummaryEntry[] {
  return rollupGroups
    .filter((group) => group.edgeType === edgeType)
    .map((group) => ({
      id: group.targetId,
      label: nodesById.get(group.targetId)?.label ?? group.targetId,
      activityCount:
        group.contributions.filter((c) => c.sourceType === "ProcessActivity")
          .length || group.contributions.length,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function updateProcessSummaries(
  nodes: GraphNode[],
  processId: string,
  activityIds: string[],
  rollupGroups: RollupGroup[],
  nodesById: Map<string, GraphNode>,
): GraphNode | undefined {
  const processNode = nodes.find((node) => node.id === processId);
  if (!processNode) return undefined;

  const activityTypes: Record<string, number> = {};
  for (const activityId of activityIds) {
    const activity = nodesById.get(activityId);
    if (!activity) continue;
    const bpmnType = String(activity.properties.bpmnType ?? "unknown");
    activityTypes[bpmnType] = (activityTypes[bpmnType] ?? 0) + 1;
  }

  return {
    ...processNode,
    properties: {
      ...processNode.properties,
      activityCount: activityIds.length,
      systemCount: buildSummaryEntries(rollupGroups, "usesSystem", nodesById)
        .length,
      organizationCount: buildSummaryEntries(
        rollupGroups,
        "performedByOrganization",
        nodesById,
      ).length,
      supplierCount: buildSummaryEntries(
        rollupGroups,
        "performedBySupplier",
        nodesById,
      ).length,
      projectCount: buildSummaryEntries(
        rollupGroups,
        "relatedToProject",
        nodesById,
      ).length,
      manualCount: buildSummaryEntries(rollupGroups, "hasManual", nodesById)
        .length,
      dataStoreCount: buildSummaryEntries(
        rollupGroups,
        "referencesDataStore",
        nodesById,
      ).length,
      dataObjectUsedCount: buildSummaryEntries(
        rollupGroups,
        "usesDataObject",
        nodesById,
      ).length,
      dataObjectProducedCount: buildSummaryEntries(
        rollupGroups,
        "producesDataObject",
        nodesById,
      ).length,
      annotationCount: buildSummaryEntries(
        rollupGroups,
        "hasAnnotation",
        nodesById,
      ).length,
      activityTypes,
      systems: buildSummaryEntries(rollupGroups, "usesSystem", nodesById),
      organizations: buildSummaryEntries(
        rollupGroups,
        "performedByOrganization",
        nodesById,
      ),
      suppliers: buildSummaryEntries(
        rollupGroups,
        "performedBySupplier",
        nodesById,
      ),
      projects: buildSummaryEntries(rollupGroups, "relatedToProject", nodesById),
      manuals: buildSummaryEntries(rollupGroups, "hasManual", nodesById),
      dataStores: buildSummaryEntries(
        rollupGroups,
        "referencesDataStore",
        nodesById,
      ),
      dataObjectsUsed: buildSummaryEntries(
        rollupGroups,
        "usesDataObject",
        nodesById,
      ),
      dataObjectsProduced: buildSummaryEntries(
        rollupGroups,
        "producesDataObject",
        nodesById,
      ),
      annotations: buildSummaryEntries(
        rollupGroups,
        "hasAnnotation",
        nodesById,
      ),
    },
  };
}

export function addProcessRollupRelations(graph: ProcessGraph): ProcessGraph {
  const nodesById = nodeMap(graph.nodes);
  const edgeIds = new Set(graph.edges.map((edge) => edge.id));
  let edges = [...graph.edges];

  const derivedActivityEdges = addDerivedActivityLaneEdges(
    edges,
    edgeIds,
    nodesById,
  );
  edges.push(...derivedActivityEdges);

  const processNodes = graph.nodes.filter((node) => node.type === "Process");
  const rollupEdges: GraphEdge[] = [];
  const updatedNodes = [...graph.nodes];

  for (const processNode of processNodes) {
    const activityIds = getProcessActivityIds(
      processNode.id,
      edges,
      nodesById,
    );
    const elementIds = getProcessElementIds(
      processNode.id,
      edges,
      nodesById,
    );
    const rollupGroups = groupRollups(
      processNode.id,
      elementIds,
      edges,
      nodesById,
    );

    for (const group of rollupGroups) {
      const rollupEdge = createProcessRollupEdge(
        processNode.id,
        group,
        edgeIds,
      );
      if (!rollupEdge) continue;
      rollupEdges.push(rollupEdge);
      edgeIds.add(rollupEdge.id);
    }

    const updatedProcess = updateProcessSummaries(
      updatedNodes,
      processNode.id,
      activityIds,
      rollupGroups,
      nodesById,
    );
    if (updatedProcess) {
      const index = updatedNodes.findIndex((node) => node.id === processNode.id);
      if (index >= 0) updatedNodes[index] = updatedProcess;
    }
  }

  return {
    ...graph,
    nodes: updatedNodes,
    edges: [...edges, ...rollupEdges],
  };
}
