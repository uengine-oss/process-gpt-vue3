import { makeEdgeId, safeLabel } from "./helpers";
import type { GraphEdge, GraphNode, ParserWarning } from "./types";

interface LaneExtensionRaw {
  laneDescription?: string;
  laneResourceType?: string;
  laneAssigneeType?: string;
  laneOrganization?: Array<Record<string, unknown>>;
  laneSupplier?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value != null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

function asArray(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is Record<string, unknown> =>
      item != null && typeof item === "object" && !Array.isArray(item),
  );
}

function getLaneRaw(laneNode: GraphNode): LaneExtensionRaw | undefined {
  const extension = asRecord(laneNode.properties.extension);
  const raw = extension?.raw;
  return asRecord(raw) as LaneExtensionRaw | undefined;
}

function collectOrganizationArrays(raw: LaneExtensionRaw): Array<Record<string, unknown>> {
  const candidates = [
    raw.laneOrganization,
    raw.organizations,
    raw.organization,
    raw.orgs,
    raw.org,
    raw.assignees,
    raw.assignee,
  ];

  const results: Array<Record<string, unknown>> = [];
  for (const candidate of candidates) {
    results.push(...asArray(candidate));
  }
  return results;
}

function collectSupplierArrays(raw: LaneExtensionRaw): Array<Record<string, unknown>> {
  const candidates = [
    raw.laneSupplier,
    raw.suppliers,
    raw.supplier,
    raw.vendors,
    raw.vendor,
  ];

  const results: Array<Record<string, unknown>> = [];
  for (const candidate of candidates) {
    results.push(...asArray(candidate));
  }
  return results;
}

function organizationId(entry: Record<string, unknown>, laneId: string): string {
  const id = entry.id ?? entry.orgId ?? entry.organizationId;
  if (id != null && String(id).trim() !== "") {
    return String(id);
  }
  const name = entry.name ?? entry.displayName;
  return `name:${laneId}:${String(name ?? "unknown")}`;
}

function supplierId(entry: Record<string, unknown>, laneId: string): string {
  const id = entry.id ?? entry.supplierId ?? entry.vendorId;
  if (id != null && String(id).trim() !== "") {
    return String(id);
  }
  const name = entry.name ?? entry.displayName;
  return `name:${laneId}:${String(name ?? "unknown")}`;
}

export function enrichLaneResponsibility(graph: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  warnings?: ParserWarning[];
}): {
  nodes: GraphNode[];
  edges: GraphEdge[];
  warnings: ParserWarning[];
} {
  const nodes = [...graph.nodes];
  const edges = [...graph.edges];
  const warnings = [...(graph.warnings ?? [])];
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edgeIds = new Set(edges.map((edge) => edge.id));

  const addNode = (node: GraphNode): void => {
    if (nodeIds.has(node.id)) return;
    nodeIds.add(node.id);
    nodes.push(node);
  };

  const addEdge = (edge: GraphEdge): void => {
    if (edgeIds.has(edge.id)) return;
    edgeIds.add(edge.id);
    edges.push(edge);
  };

  for (const laneNode of graph.nodes) {
    if (laneNode.type !== "Lane") continue;

    const raw = getLaneRaw(laneNode);
    if (!raw) continue;

    const laneId = String(laneNode.properties.laneId ?? laneNode.id);
    const laneResourceType = String(raw.laneResourceType ?? "").toLowerCase();
    const organizations = collectOrganizationArrays(raw);
    const suppliers = collectSupplierArrays(raw);

    if (
      laneResourceType === "internal" ||
      (organizations.length > 0 && suppliers.length === 0)
    ) {
      for (const org of organizations) {
        const orgKey = organizationId(org, laneId);
        const orgNodeId = `Organization:${orgKey}`;

        addNode({
          id: orgNodeId,
          type: "Organization",
          label: safeLabel(
            typeof org.name === "string" ? org.name : undefined,
            orgKey,
          ),
          properties: {
            organizationId: org.id ?? orgKey,
            name: org.name,
            memberCount: org.member_count ?? org.memberCount,
            sourceLaneId: laneId,
            sourceModelId: laneNode.properties.sourceModelId,
            laneResourceType: raw.laneResourceType,
            laneAssigneeType: raw.laneAssigneeType,
            laneDescription: raw.laneDescription,
            raw: org,
          },
        });

        addEdge({
          id: makeEdgeId(
            "performedByOrganization",
            laneNode.id,
            orgNodeId,
            `lane-org-${laneId}-${orgKey}`,
          ),
          type: "performedByOrganization",
          source: laneNode.id,
          target: orgNodeId,
        });
      }
    }

    if (
      laneResourceType === "external" ||
      suppliers.length > 0
    ) {
      for (const supplier of suppliers) {
        const supplierKey = supplierId(supplier, laneId);
        const supplierNodeId = `Supplier:${supplierKey}`;

        addNode({
          id: supplierNodeId,
          type: "Supplier",
          label: safeLabel(
            typeof supplier.name === "string" ? supplier.name : undefined,
            typeof supplier.displayName === "string"
              ? supplier.displayName
              : undefined,
            supplierKey,
          ),
          properties: {
            supplierId: supplier.id ?? supplierKey,
            name: supplier.name,
            displayName: supplier.displayName,
            businessNumber: supplier.business_number ?? supplier.businessNumber,
            registrationType:
              supplier.registration_type ?? supplier.registrationType,
            sourceLaneId: laneId,
            sourceModelId: laneNode.properties.sourceModelId,
            laneResourceType: raw.laneResourceType,
            laneAssigneeType: raw.laneAssigneeType,
            raw: supplier,
          },
        });

        addEdge({
          id: makeEdgeId(
            "performedBySupplier",
            laneNode.id,
            supplierNodeId,
            `lane-supplier-${laneId}-${supplierKey}`,
          ),
          type: "performedBySupplier",
          source: laneNode.id,
          target: supplierNodeId,
        });
      }
    }

    if (
      organizations.length === 0 &&
      suppliers.length === 0 &&
      (raw.laneOrganization != null || raw.laneSupplier != null)
    ) {
      warnings.push({
        code: "lane-extension-unparsed",
        message: `Lane ${laneId} has organization/supplier extension fields but no entries could be extracted`,
        elementId: laneId,
        severity: "info",
        details: {
          sourceModelId: laneNode.properties.sourceModelId,
        },
      });
    }
  }

  return { nodes, edges, warnings };
}
