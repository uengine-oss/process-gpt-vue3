import { makeEdgeId } from "./helpers";
import type {
  GraphEdge,
  GraphNode,
  ParserWarning,
  ProcessGraph,
  UnresolvedReference,
} from "./types";

function stripProcessModelPrefix(nodeId: string): string {
  return nodeId.startsWith("ProcessModel:")
    ? nodeId.slice("ProcessModel:".length)
    : nodeId;
}

function definitionIdBase(definitionId: string): string {
  return definitionId.replace(/\.bpmn$/i, "").trim();
}

// path.basename 대체(브라우저 안전): 후행 구분자 제거 후 마지막 세그먼트 반환
function stripPathPrefix(value: string): string {
  const trimmed = value.replace(/[/\\]+$/, "");
  const idx = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
  return idx >= 0 ? trimmed.slice(idx + 1) : trimmed;
}

// 계약 §3(2): 양쪽 모두 경로 접두사·".bpmn" 확장자 제거 후 비교하는 정규화 키
function normalizeDefinitionKey(value: string): string {
  return definitionIdBase(stripPathPrefix(value.trim()));
}

function buildProcessModelIndex(
  nodes: GraphNode[],
): Map<string, GraphNode> {
  const index = new Map<string, GraphNode>();

  for (const node of nodes) {
    if (node.type !== "ProcessModel") continue;

    const modelId = String(node.properties.modelId ?? stripProcessModelPrefix(node.id));
    const keys = new Set<string>([
      modelId,
      stripProcessModelPrefix(node.id),
      stripPathPrefix(modelId),
      definitionIdBase(modelId),
    ]);

    for (const key of keys) {
      if (key) index.set(key, node);
    }
  }

  return index;
}

export function findProcessModelByDefinitionId(
  nodes: GraphNode[],
  definitionId: string,
): GraphNode | undefined {
  const index = buildProcessModelIndex(nodes);
  const normalized = definitionId.trim();
  const withoutPrefix = stripProcessModelPrefix(normalized);
  const base = definitionIdBase(withoutPrefix);

  const candidates = [
    normalized,
    withoutPrefix,
    stripPathPrefix(normalized),
    base,
  ];

  for (const candidate of candidates) {
    const exact = index.get(candidate);
    if (exact) return exact;
  }

  const processModels = nodes.filter((node) => node.type === "ProcessModel");

  for (const model of processModels) {
    const modelId = String(
      model.properties.modelId ?? stripProcessModelPrefix(model.id),
    );
    const modelBase = definitionIdBase(modelId);
    if (modelBase === base) return model;
    if (modelId.startsWith(base) || base.startsWith(modelBase)) return model;
  }

  // 계약 §3(2): 경로 접두사·확장자 정규화 비교 폴백
  const normalizedKey = normalizeDefinitionKey(withoutPrefix);
  if (normalizedKey) {
    for (const model of processModels) {
      const modelId = String(
        model.properties.modelId ?? stripProcessModelPrefix(model.id),
      );
      if (normalizeDefinitionKey(modelId) === normalizedKey) return model;
    }
  }

  // 계약 §3(3): ProcessModel displayName/라벨(proc_def.name) 일치 폴백
  const nameCandidates = new Set(
    [normalized, withoutPrefix, base, normalizedKey].filter(Boolean),
  );
  for (const model of processModels) {
    const displayName =
      typeof model.properties.displayName === "string"
        ? model.properties.displayName.trim()
        : "";
    const label = model.label.trim();
    if (
      (displayName && nameCandidates.has(displayName)) ||
      (label && nameCandidates.has(label))
    ) {
      return model;
    }
  }

  return undefined;
}

function currentProcessModelId(
  nodes: GraphNode[],
  sourceModelId: string,
): string | undefined {
  const node = nodes.find(
    (candidate) =>
      candidate.type === "ProcessModel" &&
      String(candidate.properties.modelId ?? stripProcessModelPrefix(candidate.id)) ===
        sourceModelId,
  );
  return node?.id;
}

export function resolveGraphReferences(graph: ProcessGraph): ProcessGraph {
  const warnings: ParserWarning[] = [...graph.parseReport.warnings];
  const unresolvedReferences: UnresolvedReference[] = [
    ...graph.parseReport.unresolvedReferences,
  ];
  const edges: GraphEdge[] = [...graph.edges];
  const edgeIds = new Set(edges.map((edge) => edge.id));

  const addEdge = (edge: GraphEdge): void => {
    if (edgeIds.has(edge.id)) return;
    edgeIds.add(edge.id);
    edges.push(edge);
  };

  const addUnresolved = (
    sourceModelId: string,
    sourceElementId: string,
    definitionId: string,
    message: string,
  ): void => {
    unresolvedReferences.push({
      sourceModelId,
      sourceElementId,
      definitionId,
    });
    warnings.push({
      code: "unresolved-definition-id",
      message,
      elementId: sourceElementId,
      severity: "warning",
      details: { sourceModelId, definitionId },
    });
  };

  for (const node of graph.nodes) {
    const definitionId = node.properties.definitionId;
    if (typeof definitionId !== "string" || definitionId.trim() === "") {
      continue;
    }

    const sourceModelId = String(node.properties.sourceModelId ?? "");
    const sourceElementId = String(
      node.properties.elementId ?? node.id.split(":").pop() ?? node.id,
    );
    const currentModelNodeId = currentProcessModelId(graph.nodes, sourceModelId);

    const targetModel = findProcessModelByDefinitionId(
      graph.nodes,
      definitionId,
    );

    if (!targetModel) {
      addUnresolved(
        sourceModelId,
        sourceElementId,
        definitionId,
        `Could not resolve definitionId ${definitionId} from ${node.type} ${sourceElementId} in model ${sourceModelId}`,
      );
      continue;
    }

    if (node.type === "ProcessActivity") {
      addEdge({
        id: makeEdgeId(
          "callsProcessModel",
          node.id,
          targetModel.id,
          `calls-${sourceModelId}-${sourceElementId}-${definitionId}`,
        ),
        type: "callsProcessModel",
        source: node.id,
        target: targetModel.id,
        properties: {
          definitionId,
          sourceModelId,
        },
      });

      if (currentModelNodeId) {
        addEdge({
          id: makeEdgeId(
            "isChildOf",
            targetModel.id,
            currentModelNodeId,
            `child-of-${stripProcessModelPrefix(targetModel.id)}-${sourceModelId}`,
          ),
          type: "isChildOf",
          source: targetModel.id,
          target: currentModelNodeId,
          properties: {
            parentModelId: sourceModelId,
            childModelId: stripProcessModelPrefix(targetModel.id),
          },
        });
      }
      continue;
    }

    if (node.type === "Event") {
      addEdge({
        id: makeEdgeId(
          "handsOffToProcessModel",
          node.id,
          targetModel.id,
          `handoff-${sourceModelId}-${sourceElementId}-${definitionId}`,
        ),
        type: "handsOffToProcessModel",
        source: node.id,
        target: targetModel.id,
        properties: {
          definitionId,
          sourceModelId,
        },
      });

      if (currentModelNodeId) {
        addEdge({
          id: makeEdgeId(
            "isChildOf",
            targetModel.id,
            currentModelNodeId,
            `child-of-handoff-${stripProcessModelPrefix(targetModel.id)}-${sourceModelId}`,
          ),
          type: "isChildOf",
          source: targetModel.id,
          target: currentModelNodeId,
          properties: {
            parentModelId: sourceModelId,
            childModelId: stripProcessModelPrefix(targetModel.id),
            via: "handsOffToProcessModel",
          },
        });
      }
    }
  }

  return {
    ...graph,
    edges,
    parseReport: {
      ...graph.parseReport,
      warnings,
      unresolvedReferences,
    },
  };
}
