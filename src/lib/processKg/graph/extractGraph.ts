import {
  deriveDisplayNameFromPath,
  extractProcessCode,
  isGenericProcessName,
} from "../parser/modelId";
import { normalizeActivityKind } from "../shared/normalize";
import {
  countByType,
  dedupeEdges,
  dedupeNodes,
  makeEdgeId,
  makeNodeId,
  normalizedElementName,
  safeLabel,
  stableSlug,
} from "./helpers";
import { normalizeSystemRef } from "./systemNormalization";
import type { GraphEdge, GraphNode, ParserWarning } from "./types";
import type {
  ParsedBpmnElement,
  ParsedBpmnModel,
  ParsedExtensionProperties,
} from "../parser/types";

interface ExtractionContext {
  model: ParsedBpmnModel;
  modelId: string;
  processModelNodeId: string;
  processNodeId?: string;
  processId?: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  warnings: ParserWarning[];
  flowElementNodeIds: Map<string, string>;
  annotationNodeIds: Map<string, string>;
  dataStoreNodeIds: Map<string, string>;
  dataObjectNodeIds: Map<string, string>;
  activityNodeIds: Map<string, string>;
}

function addWarning(
  ctx: ExtractionContext,
  code: string,
  message: string,
  elementId?: string,
): void {
  ctx.warnings.push({
    code,
    message,
    file: ctx.model.sourcePath,
    elementId,
    severity: "warning",
  });
}

function addNode(ctx: ExtractionContext, node: GraphNode): void {
  ctx.nodes.push(node);
}

function addEdge(ctx: ExtractionContext, edge: GraphEdge): void {
  ctx.edges.push(edge);
}

function addContainsElementEdges(
  ctx: ExtractionContext,
  elementNodeId: string,
): void {
  addEdge(ctx, {
    id: makeEdgeId(
      "containsElement",
      ctx.processModelNodeId,
      elementNodeId,
      `model-contains-${elementNodeId}`,
    ),
    type: "containsElement",
    source: ctx.processModelNodeId,
    target: elementNodeId,
  });

  if (ctx.processNodeId) {
    addEdge(ctx, {
      id: makeEdgeId(
        "containsElement",
        ctx.processNodeId,
        elementNodeId,
        `process-contains-${elementNodeId}`,
      ),
      type: "containsElement",
      source: ctx.processNodeId,
      target: elementNodeId,
    });
  }
}

function resolveProcessCode(model: ParsedBpmnModel): string | undefined {
  return (
    extractProcessCode(model.sourceFile) ??
    extractProcessCode(model.process?.name) ??
    extractProcessCode(model.participants[0]?.name)
  );
}

function gatewayKind(bpmnType: string): string {
  switch (bpmnType) {
    case "exclusiveGateway":
      return "decision";
    case "parallelGateway":
      return "parallel";
    case "inclusiveGateway":
      return "inclusive";
    case "eventBasedGateway":
      return "event_based";
    default:
      return "unknown";
  }
}

function gatewaySplitJoinType(
  elementId: string,
  model: ParsedBpmnModel,
): string {
  const incoming = model.sequenceFlows.filter(
    (flow) => flow.targetRef === elementId,
  ).length;
  const outgoing = model.sequenceFlows.filter(
    (flow) => flow.sourceRef === elementId,
  ).length;

  if (incoming === 1 && outgoing >= 2) return "split";
  if (incoming >= 2 && outgoing === 1) return "join";
  return "unknown";
}

function eventKind(
  bpmnType: string,
  definitionId?: string,
): string {
  if (bpmnType === "startEvent") return "start";
  if (bpmnType === "endEvent") {
    return definitionId ? "process_handoff" : "end";
  }
  return "intermediate_or_boundary";
}

function hasCostProfileData(extension?: ParsedExtensionProperties): boolean {
  if (!extension) return false;
  return (
    extension.opexCost != null ||
    extension.opexUnit != null ||
    extension.opexNote != null
  );
}

function extractProcessModel(ctx: ExtractionContext): void {
  const { model, modelId } = ctx;
  const displayName =
    model.displayName ?? deriveDisplayNameFromPath(model.sourcePath);

  addNode(ctx, {
    id: ctx.processModelNodeId,
    type: "ProcessModel",
    label: displayName || safeLabel(modelId, model.sourceFile),
    properties: {
      displayName,
      modelId,
      sourceFile: model.sourceFile,
      sourcePath: model.sourcePath,
      exporter: model.exporter,
      exporterVersion: model.exporterVersion,
      targetNamespace: model.targetNamespace,
      processCode: resolveProcessCode(model),
    },
  });
}

/**
 * Process 노드 라벨 폴백 순서 — 라벨만 결정하며 id/properties 에는 영향 없음.
 * 빈/제네릭 bpmn:process@name 이 빈 라벨로 UI 전반(인사이트 제목, 포커스 옵션,
 * 데이터 태스크, 리포트)에 노출되는 것을 그래프 빌드 시점에 차단한다:
 * 1) trim 된 process@name — 비어있지 않고 제네릭(Process_*, Proc_*)이 아닐 때
 * 2) 모델 표시 라벨(resolveProcessDisplayLabel 의미론:
 *    displayName(proc_def.name) ?? 파일명 유도) — trim 후 비어있지 않을 때
 * 3) processCode ([코드] 추출값)
 * 4) process bpmn id — 항상 존재하므로 라벨은 절대 빈 문자열이 되지 않는다
 */
function resolveProcessNodeLabel(args: {
  processName: string | undefined;
  displayName: string;
  processCode: string | undefined;
  processBpmnId: string;
}): string {
  const processName = args.processName?.trim();
  if (processName && !isGenericProcessName(processName)) return processName;

  const modelDisplayLabel = args.displayName.trim();
  if (modelDisplayLabel) return modelDisplayLabel;

  const processCode = args.processCode?.trim();
  if (processCode) return processCode;

  return args.processBpmnId;
}

function extractProcess(ctx: ExtractionContext): void {
  const process = ctx.model.process;
  if (!process) {
    addWarning(ctx, "missing-process", "No process element found in BPMN model");
    return;
  }

  const displayName =
    ctx.model.displayName ?? deriveDisplayNameFromPath(ctx.model.sourcePath);
  const processCode = resolveProcessCode(ctx.model);
  const label = resolveProcessNodeLabel({
    processName: process.name,
    displayName,
    processCode,
    processBpmnId: process.id,
  });

  ctx.processId = process.id;
  ctx.processNodeId = makeNodeId("Process", process.id, ctx.modelId);

  addNode(ctx, {
    id: ctx.processNodeId,
    type: "Process",
    label,
    properties: {
      displayName,
      processId: process.id,
      name: process.name,
      isExecutable: process.isExecutable,
      processCode,
      sourceModelId: ctx.modelId,
    },
  });

  addEdge(ctx, {
    id: makeEdgeId(
      "definesProcess",
      ctx.processModelNodeId,
      ctx.processNodeId,
      `defines-${ctx.processNodeId}`,
    ),
    type: "definesProcess",
    source: ctx.processModelNodeId,
    target: ctx.processNodeId,
  });
}

function extractParticipants(ctx: ExtractionContext): void {
  for (const participant of ctx.model.participants) {
    const nodeId = makeNodeId("Participant", participant.id, ctx.modelId);
    const poolName = participant.name?.trim();
    const label = poolName ? `Pool: ${poolName}` : safeLabel(participant.name, participant.id);

    addNode(ctx, {
      id: nodeId,
      type: "Participant",
      label,
      properties: {
        participantId: participant.id,
        name: participant.name,
        processRef: participant.processRef,
        sourceModelId: ctx.modelId,
      },
    });

    addEdge(ctx, {
      id: makeEdgeId(
        "hasParticipant",
        ctx.processModelNodeId,
        nodeId,
        `participant-${participant.id}`,
      ),
      type: "hasParticipant",
      source: ctx.processModelNodeId,
      target: nodeId,
    });
  }
}

function extractLanes(ctx: ExtractionContext): void {
  for (const lane of ctx.model.lanes) {
    const nodeId = makeNodeId("Lane", lane.id, ctx.modelId);

    addNode(ctx, {
      id: nodeId,
      type: "Lane",
      label: safeLabel(lane.name, lane.id),
      properties: {
        laneId: lane.id,
        name: lane.name,
        flowNodeRefs: lane.flowNodeRefs,
        sourceModelId: ctx.modelId,
        sourceProcessId: ctx.processId,
        extension: lane.extension,
      },
    });

    if (ctx.processNodeId) {
      addEdge(ctx, {
        id: makeEdgeId("hasLane", ctx.processNodeId, nodeId, `lane-${lane.id}`),
        type: "hasLane",
        source: ctx.processNodeId,
        target: nodeId,
      });
    }
  }
}

function extractActivities(ctx: ExtractionContext): void {
  for (const activity of ctx.model.activities) {
    const nodeId = makeNodeId("Activity", activity.id, ctx.modelId);
    const extension = activity.extension;
    const definitionId = extension?.definitionId;

    ctx.flowElementNodeIds.set(activity.id, nodeId);
    ctx.activityNodeIds.set(activity.id, nodeId);

    addNode(ctx, {
      id: nodeId,
      type: "ProcessActivity",
      label: safeLabel(activity.name, activity.id),
      properties: {
        elementId: activity.id,
        name: activity.name,
        normalizedName: normalizedElementName(activity.name),
        bpmnType: activity.bpmnType,
        activityKind: normalizeActivityKind(activity.bpmnType),
        sourceModelId: ctx.modelId,
        sourceProcessId: ctx.processId,
        description: extension?.description,
        futureStatus: extension?.futureStatus,
        definitionId,
        isCallReference:
          activity.bpmnType === "callActivity" || Boolean(definitionId),
        manualLink: extension?.manualLink,
        manualLinks: extension?.manualLinks,
        systems: extension?.systems,
        fte: extension?.fte,
        relatedProjects: extension?.relatedProjects,
        opexCost: extension?.opexCost,
        opexUnit: extension?.opexUnit,
        opexNote: extension?.opexNote,
        dataAttachmentUrl: extension?.dataAttachmentUrl,
        dataAttachmentFile: extension?.dataAttachmentFile,
        comments: extension?.comments,
        rawExtension: extension?.raw,
      },
    });

    addContainsElementEdges(ctx, nodeId);

    if (ctx.processNodeId) {
      addEdge(ctx, {
        id: makeEdgeId(
          "hasActivity",
          ctx.processNodeId,
          nodeId,
          `has-activity-${nodeId}`,
        ),
        type: "hasActivity",
        source: ctx.processNodeId,
        target: nodeId,
        properties: {
          derived: false,
          source: "bpmn-process-contains-activity",
        },
      });
    }

    extractActivityMetadata(ctx, activity, nodeId, extension);
  }
}

function extractActivityMetadata(
  ctx: ExtractionContext,
  activity: ParsedBpmnElement,
  activityNodeId: string,
  extension?: ParsedExtensionProperties,
): void {
  if (!extension) return;

  for (const system of extension.systems ?? []) {
    const normalized = normalizeSystemRef(system, {
      activityId: activity.id,
      sourceModelId: ctx.modelId,
    });

    if (!normalized) {
      addWarning(
        ctx,
        "system-invalid-entry",
        `Invalid or empty system entry on activity ${activity.id}`,
        activity.id,
      );
      continue;
    }

    addNode(ctx, {
      id: normalized.id,
      type: "System",
      label: normalized.label,
      properties: normalized.properties,
    });

    addEdge(ctx, {
      id: makeEdgeId(
        "usesSystem",
        activityNodeId,
        normalized.id,
        `uses-system-${activity.id}-${normalized.id}`,
      ),
      type: "usesSystem",
      source: activityNodeId,
      target: normalized.id,
    });
  }

  const manualEntries: Array<{
    title?: string;
    url?: string;
    source?: string;
  }> = [];

  if (extension.manualLink) {
    manualEntries.push({ url: extension.manualLink, source: "manualLink" });
  }

  for (const manual of extension.manualLinks ?? []) {
    manualEntries.push({
      title: manual.title,
      url: manual.url,
      source: manual.source ?? "manualLinks",
    });
  }

  manualEntries.forEach((manual, index) => {
    const manualKey = manual.url
      ? stableSlug(manual.url)
      : `${activity.id}-${stableSlug(manual.title ?? String(index))}`;
    const manualNodeId = makeNodeId(
      "Manual",
      manualKey,
      ctx.modelId,
    );

    addNode(ctx, {
      id: manualNodeId,
      type: "Manual",
      label: safeLabel(manual.title, manual.url, manualKey),
      properties: {
        title: manual.title,
        url: manual.url,
        source: manual.source,
        sourceModelId: ctx.modelId,
      },
    });

    addEdge(ctx, {
      id: makeEdgeId(
        "hasManual",
        activityNodeId,
        manualNodeId,
        `manual-${activity.id}-${manualKey}`,
      ),
      type: "hasManual",
      source: activityNodeId,
      target: manualNodeId,
    });
  });

  if (extension.fte) {
    const fteNodeId = `FTEProfile:${activityNodeId}`;

    addNode(ctx, {
      id: fteNodeId,
      type: "FTEProfile",
      label: safeLabel(activity.name, activity.id),
      properties: {
        ...extension.fte,
        sourceModelId: ctx.modelId,
        sourceActivityId: activity.id,
      },
    });

    addEdge(ctx, {
      id: makeEdgeId(
        "hasFTEProfile",
        activityNodeId,
        fteNodeId,
        `fte-${activity.id}`,
      ),
      type: "hasFTEProfile",
      source: activityNodeId,
      target: fteNodeId,
    });
  }

  if (hasCostProfileData(extension)) {
    const costNodeId = `CostProfile:${activityNodeId}`;

    addNode(ctx, {
      id: costNodeId,
      type: "CostProfile",
      label: safeLabel(activity.name, activity.id),
      properties: {
        opexCost: extension.opexCost,
        opexUnit: extension.opexUnit,
        opexNote: extension.opexNote,
        sourceModelId: ctx.modelId,
        sourceActivityId: activity.id,
      },
    });

    addEdge(ctx, {
      id: makeEdgeId(
        "hasCostProfile",
        activityNodeId,
        costNodeId,
        `cost-${activity.id}`,
      ),
      type: "hasCostProfile",
      source: activityNodeId,
      target: costNodeId,
    });
  }

  for (const project of extension.relatedProjects ?? []) {
    const projectKey = project.id
      ? String(project.id)
      : project.url
        ? stableSlug(project.url)
        : stableSlug(String(project.name ?? activity.id));
    const projectNodeId = makeNodeId("Project", projectKey, ctx.modelId);

    addNode(ctx, {
      id: projectNodeId,
      type: "Project",
      label: safeLabel(project.name, projectKey),
      properties: {
        id: project.id,
        name: project.name,
        url: project.url,
        raw: project,
        sourceModelId: ctx.modelId,
      },
    });

    addEdge(ctx, {
      id: makeEdgeId(
        "relatedToProject",
        activityNodeId,
        projectNodeId,
        `project-${activity.id}-${projectKey}`,
      ),
      type: "relatedToProject",
      source: activityNodeId,
      target: projectNodeId,
    });
  }
}

function extractGateways(ctx: ExtractionContext): void {
  for (const gateway of ctx.model.gateways) {
    const nodeId = makeNodeId("Gateway", gateway.id, ctx.modelId);
    ctx.flowElementNodeIds.set(gateway.id, nodeId);

    addNode(ctx, {
      id: nodeId,
      type: "Gateway",
      label: safeLabel(gateway.name, gateway.id),
      properties: {
        elementId: gateway.id,
        name: gateway.name,
        bpmnType: gateway.bpmnType,
        gatewayKind: gatewayKind(gateway.bpmnType),
        splitJoinType: gatewaySplitJoinType(gateway.id, ctx.model),
        sourceModelId: ctx.modelId,
        sourceProcessId: ctx.processId,
        rawExtension: gateway.extension?.raw,
      },
    });

    addContainsElementEdges(ctx, nodeId);
  }
}

function extractEvents(ctx: ExtractionContext): void {
  for (const event of ctx.model.events) {
    const nodeId = makeNodeId("Event", event.id, ctx.modelId);
    const definitionId = event.extension?.definitionId;
    ctx.flowElementNodeIds.set(event.id, nodeId);

    addNode(ctx, {
      id: nodeId,
      type: "Event",
      label: safeLabel(event.name, event.id),
      properties: {
        elementId: event.id,
        name: event.name,
        bpmnType: event.bpmnType,
        eventKind: eventKind(event.bpmnType, definitionId),
        sourceModelId: ctx.modelId,
        sourceProcessId: ctx.processId,
        definitionId,
        futureStatus: event.extension?.futureStatus,
        rawExtension: event.extension?.raw,
      },
    });

    addContainsElementEdges(ctx, nodeId);
  }
}

function extractDataStores(ctx: ExtractionContext): void {
  for (const dataStore of ctx.model.dataStores) {
    const nodeId = makeNodeId("DataStore", dataStore.id, ctx.modelId);
    ctx.dataStoreNodeIds.set(dataStore.id, nodeId);
    ctx.flowElementNodeIds.set(dataStore.id, nodeId);

    addNode(ctx, {
      id: nodeId,
      type: "DataStore",
      label: safeLabel(dataStore.name, dataStore.id),
      properties: {
        elementId: dataStore.id,
        bpmnId: dataStore.id,
        name: dataStore.name,
        sourceModelId: ctx.modelId,
        sourceProcessId: ctx.processId,
      },
    });

    addContainsElementEdges(ctx, nodeId);
  }
}

function extractDataObjects(ctx: ExtractionContext): void {
  for (const dataObject of ctx.model.dataObjects) {
    const nodeId = makeNodeId("DataObject", dataObject.id, ctx.modelId);
    ctx.dataObjectNodeIds.set(dataObject.id, nodeId);
    ctx.flowElementNodeIds.set(dataObject.id, nodeId);

    const dataObjectRef =
      typeof dataObject.raw.dataObjectRef === "string"
        ? dataObject.raw.dataObjectRef
        : undefined;

    addNode(ctx, {
      id: nodeId,
      type: "DataObject",
      label: safeLabel(dataObject.name, dataObject.id),
      properties: {
        elementId: dataObject.id,
        bpmnId: dataObject.id,
        name: dataObject.name,
        dataObjectRef,
        sourceModelId: ctx.modelId,
        sourceProcessId: ctx.processId,
      },
    });

    addContainsElementEdges(ctx, nodeId);
  }
}

function extractDataAssociations(ctx: ExtractionContext): void {
  for (const association of ctx.model.dataAssociations) {
    const activityNodeId = ctx.activityNodeIds.get(association.activityId);
    if (!activityNodeId) {
      addWarning(
        ctx,
        "unresolved-data-association-activity",
        `Data association ${association.id} activity ${association.activityId} could not be resolved`,
        association.id,
      );
      continue;
    }

    if (association.direction === "input") {
      if (!association.sourceRef) continue;

      const dataObjectNodeId = ctx.dataObjectNodeIds.get(association.sourceRef);
      if (dataObjectNodeId) {
        addEdge(ctx, {
          id: makeEdgeId(
            "usesDataObject",
            activityNodeId,
            dataObjectNodeId,
            `uses-data-${ctx.modelId}-${association.id}`,
          ),
          type: "usesDataObject",
          source: activityNodeId,
          target: dataObjectNodeId,
          properties: {
            associationId: association.id,
            associationDirection: "input",
          },
        });
        continue;
      }

      const dataStoreNodeId = ctx.dataStoreNodeIds.get(association.sourceRef);
      if (dataStoreNodeId) {
        addEdge(ctx, {
          id: makeEdgeId(
            "referencesDataStore",
            activityNodeId,
            dataStoreNodeId,
            `datastore-input-${ctx.modelId}-${association.id}`,
          ),
          type: "referencesDataStore",
          source: activityNodeId,
          target: dataStoreNodeId,
          properties: {
            associationId: association.id,
            associationDirection: "input",
          },
        });
        continue;
      }

      addWarning(
        ctx,
        "unresolved-data-association-source",
        `Data input association ${association.id} sourceRef ${association.sourceRef} could not be resolved`,
        association.id,
      );
      continue;
    }

    if (!association.targetRef) continue;
    if (association.targetRef.startsWith("Property_")) continue;

    const dataObjectNodeId = ctx.dataObjectNodeIds.get(association.targetRef);
    if (dataObjectNodeId) {
      addEdge(ctx, {
        id: makeEdgeId(
          "producesDataObject",
          activityNodeId,
          dataObjectNodeId,
          `produces-data-${ctx.modelId}-${association.id}`,
        ),
        type: "producesDataObject",
        source: activityNodeId,
        target: dataObjectNodeId,
        properties: {
          associationId: association.id,
          associationDirection: "output",
        },
      });
      continue;
    }

    const dataStoreNodeId = ctx.dataStoreNodeIds.get(association.targetRef);
    if (dataStoreNodeId) {
      addEdge(ctx, {
        id: makeEdgeId(
          "referencesDataStore",
          activityNodeId,
          dataStoreNodeId,
          `datastore-output-${ctx.modelId}-${association.id}`,
        ),
        type: "referencesDataStore",
        source: activityNodeId,
        target: dataStoreNodeId,
        properties: {
          associationId: association.id,
          associationDirection: "output",
        },
      });
      continue;
    }

    addWarning(
      ctx,
      "unresolved-data-association-target",
      `Data output association ${association.id} targetRef ${association.targetRef} could not be resolved`,
      association.id,
    );
  }
}

function extractAnnotations(ctx: ExtractionContext): void {
  for (const annotation of ctx.model.annotations) {
    const nodeId = makeNodeId("Annotation", annotation.id, ctx.modelId);
    ctx.annotationNodeIds.set(annotation.id, nodeId);

    addNode(ctx, {
      id: nodeId,
      type: "Annotation",
      label: safeLabel(annotation.text, annotation.id),
      properties: {
        elementId: annotation.id,
        text: annotation.text,
        annotationKind: "business_rule_candidate",
        sourceModelId: ctx.modelId,
        sourceProcessId: ctx.processId,
      },
    });

    addContainsElementEdges(ctx, nodeId);
  }
}

function resolveFlowElementNodeId(
  ctx: ExtractionContext,
  elementId?: string,
): string | undefined {
  if (!elementId) return undefined;
  return ctx.flowElementNodeIds.get(elementId);
}

function extractSequenceFlows(ctx: ExtractionContext): void {
  for (const flow of ctx.model.sequenceFlows) {
    const flowNodeId = makeNodeId("SequenceFlow", flow.id, ctx.modelId);
    const label = safeLabel(flow.name, flow.conditionExpression, flow.id);

    addNode(ctx, {
      id: flowNodeId,
      type: "SequenceFlow",
      label,
      properties: {
        flowId: flow.id,
        name: flow.name,
        sourceRef: flow.sourceRef,
        targetRef: flow.targetRef,
        conditionExpression: flow.conditionExpression,
        sourceModelId: ctx.modelId,
        sourceProcessId: ctx.processId,
      },
    });

    const sourceNodeId = resolveFlowElementNodeId(ctx, flow.sourceRef);
    const targetNodeId = resolveFlowElementNodeId(ctx, flow.targetRef);

    if (!sourceNodeId) {
      addWarning(
        ctx,
        "unresolved-flow-source",
        `Sequence flow ${flow.id} sourceRef ${flow.sourceRef ?? "(missing)"} could not be resolved`,
        flow.id,
      );
    }

    if (!targetNodeId) {
      addWarning(
        ctx,
        "unresolved-flow-target",
        `Sequence flow ${flow.id} targetRef ${flow.targetRef ?? "(missing)"} could not be resolved`,
        flow.id,
      );
    }

    if (sourceNodeId) {
      addEdge(ctx, {
        id: makeEdgeId(
          "flowFrom",
          flowNodeId,
          sourceNodeId,
          `flow-from-${flow.id}`,
        ),
        type: "flowFrom",
        source: flowNodeId,
        target: sourceNodeId,
        label,
      });
    }

    if (targetNodeId) {
      addEdge(ctx, {
        id: makeEdgeId(
          "flowTo",
          flowNodeId,
          targetNodeId,
          `flow-to-${flow.id}`,
        ),
        type: "flowTo",
        source: flowNodeId,
        target: targetNodeId,
        label,
      });
    }

    if (sourceNodeId && targetNodeId) {
      addEdge(ctx, {
        id: makeEdgeId(
          "isFollowedBy",
          sourceNodeId,
          targetNodeId,
          `followed-by-${flow.id}`,
        ),
        type: "isFollowedBy",
        source: sourceNodeId,
        target: targetNodeId,
        label,
        properties: {
          sequenceFlowId: flow.id,
        },
      });
    }
  }
}

function extractLaneAssignments(ctx: ExtractionContext): void {
  for (const lane of ctx.model.lanes) {
    const laneNodeId = makeNodeId("Lane", lane.id, ctx.modelId);

    for (const flowNodeRef of lane.flowNodeRefs) {
      const elementNodeId = resolveFlowElementNodeId(ctx, flowNodeRef);

      if (!elementNodeId) {
        addWarning(
          ctx,
          "unresolved-lane-flow-node",
          `Lane ${lane.id} flowNodeRef ${flowNodeRef} could not be resolved`,
          lane.id,
        );
        continue;
      }

      addEdge(ctx, {
        id: makeEdgeId(
          "assignedToLane",
          elementNodeId,
          laneNodeId,
          `assigned-${flowNodeRef}-${lane.id}`,
        ),
        type: "assignedToLane",
        source: elementNodeId,
        target: laneNodeId,
      });

      addEdge(ctx, {
        id: makeEdgeId(
          "containsElement",
          laneNodeId,
          elementNodeId,
          `lane-contains-${lane.id}-${flowNodeRef}`,
        ),
        type: "containsElement",
        source: laneNodeId,
        target: elementNodeId,
      });
    }
  }
}

function extractAssociations(ctx: ExtractionContext): void {
  for (const association of ctx.model.associations) {
    const sourceFlow = resolveFlowElementNodeId(ctx, association.sourceRef);
    const targetFlow = resolveFlowElementNodeId(ctx, association.targetRef);
    const sourceAnnotation = association.sourceRef
      ? ctx.annotationNodeIds.get(association.sourceRef)
      : undefined;
    const targetAnnotation = association.targetRef
      ? ctx.annotationNodeIds.get(association.targetRef)
      : undefined;
    const sourceDataStore = association.sourceRef
      ? ctx.dataStoreNodeIds.get(association.sourceRef)
      : undefined;
    const targetDataStore = association.targetRef
      ? ctx.dataStoreNodeIds.get(association.targetRef)
      : undefined;
    const sourceDataObject = association.sourceRef
      ? ctx.dataObjectNodeIds.get(association.sourceRef)
      : undefined;
    const targetDataObject = association.targetRef
      ? ctx.dataObjectNodeIds.get(association.targetRef)
      : undefined;

    if (sourceFlow && targetAnnotation) {
      addEdge(ctx, {
        id: makeEdgeId(
          "hasAnnotation",
          sourceFlow,
          targetAnnotation,
          `annotation-${association.id}`,
        ),
        type: "hasAnnotation",
        source: sourceFlow,
        target: targetAnnotation,
      });
      continue;
    }

    if (targetFlow && sourceAnnotation) {
      addEdge(ctx, {
        id: makeEdgeId(
          "hasAnnotation",
          targetFlow,
          sourceAnnotation,
          `annotation-${association.id}`,
        ),
        type: "hasAnnotation",
        source: targetFlow,
        target: sourceAnnotation,
      });
      continue;
    }

    if (sourceFlow && targetDataStore) {
      addEdge(ctx, {
        id: makeEdgeId(
          "referencesDataStore",
          sourceFlow,
          targetDataStore,
          `datastore-${ctx.modelId}-${association.id}`,
        ),
        type: "referencesDataStore",
        source: sourceFlow,
        target: targetDataStore,
      });
      continue;
    }

    if (targetFlow && sourceDataStore) {
      addEdge(ctx, {
        id: makeEdgeId(
          "referencesDataStore",
          targetFlow,
          sourceDataStore,
          `datastore-${ctx.modelId}-${association.id}`,
        ),
        type: "referencesDataStore",
        source: targetFlow,
        target: sourceDataStore,
      });
      continue;
    }

    if (sourceFlow && targetDataObject) {
      addEdge(ctx, {
        id: makeEdgeId(
          "usesDataObject",
          sourceFlow,
          targetDataObject,
          `dataobject-${ctx.modelId}-${association.id}`,
        ),
        type: "usesDataObject",
        source: sourceFlow,
        target: targetDataObject,
      });
      continue;
    }

    if (targetFlow && sourceDataObject) {
      addEdge(ctx, {
        id: makeEdgeId(
          "usesDataObject",
          targetFlow,
          sourceDataObject,
          `dataobject-${ctx.modelId}-${association.id}`,
        ),
        type: "usesDataObject",
        source: targetFlow,
        target: sourceDataObject,
      });
      continue;
    }

    addWarning(
      ctx,
      "unresolved-association",
      `Association ${association.id} could not be resolved to element/annotation/data endpoints`,
      association.id,
    );
  }
}

export function extractGraphFromParsedModel(model: ParsedBpmnModel): {
  nodes: GraphNode[];
  edges: GraphEdge[];
  warnings: ParserWarning[];
} {
  const modelId = model.modelId;
  const ctx: ExtractionContext = {
    model,
    modelId,
    processModelNodeId: makeNodeId("ProcessModel", modelId),
    nodes: [],
    edges: [],
    warnings: [],
    flowElementNodeIds: new Map(),
    annotationNodeIds: new Map(),
    dataStoreNodeIds: new Map(),
    dataObjectNodeIds: new Map(),
    activityNodeIds: new Map(),
  };

  for (const warning of model.warnings) {
    ctx.warnings.push({
      code: "parser-warning",
      message: warning,
      file: model.sourcePath,
      severity: "warning",
    });
  }

  extractProcessModel(ctx);
  extractProcess(ctx);
  extractParticipants(ctx);
  extractLanes(ctx);
  extractActivities(ctx);
  extractGateways(ctx);
  extractEvents(ctx);
  extractDataStores(ctx);
  extractDataObjects(ctx);
  extractAnnotations(ctx);
  extractSequenceFlows(ctx);
  extractLaneAssignments(ctx);
  extractDataAssociations(ctx);
  extractAssociations(ctx);

  return {
    nodes: dedupeNodes(ctx.nodes),
    edges: dedupeEdges(ctx.edges),
    warnings: ctx.warnings,
  };
}

export { countByType };
