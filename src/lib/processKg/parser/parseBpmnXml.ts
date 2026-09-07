import { XMLParser } from "fast-xml-parser";
import { asArray } from "../shared/normalize";
import { deriveDisplayNameFromPath } from "./modelId";
import { parseExtensionProperties } from "./parseExtensionProperties";
import type {
  ParsedBpmnAnnotation,
  ParsedBpmnAssociation,
  ParsedBpmnDataAssociation,
  ParsedBpmnElement,
  ParsedBpmnLane,
  ParsedBpmnModel,
  ParsedBpmnParticipant,
  ParsedBpmnProcess,
  ParsedBpmnSequenceFlow,
} from "./types";

// SAMPLE src/parser/readBpmnFile.ts 와 동일한 옵션 (파리티 필수 — 변경 금지)
const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  textNodeName: "#text",
  parseAttributeValue: true,
  trimValues: true,
  ignoreDeclaration: true,
  removeNSPrefix: true,
});

const ACTIVITY_TYPES = [
  "task",
  "manualTask",
  "userTask",
  "sendTask",
  "receiveTask",
  "serviceTask",
  "scriptTask",
  "businessRuleTask",
  "callActivity",
] as const;

const GATEWAY_TYPES = [
  "exclusiveGateway",
  "parallelGateway",
  "inclusiveGateway",
  "eventBasedGateway",
] as const;

const EVENT_TYPES = [
  "startEvent",
  "endEvent",
  "intermediateCatchEvent",
  "intermediateThrowEvent",
  "boundaryEvent",
] as const;

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value != null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

function getTextContent(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  const record = asRecord(value);
  if (!record) return undefined;

  if (typeof record["#text"] === "string") {
    return record["#text"];
  }
  if (typeof record["#text"] === "number") {
    return String(record["#text"]);
  }

  return undefined;
}

function getDefinitions(doc: unknown): Record<string, unknown> | undefined {
  const root = asRecord(doc);
  if (!root) return undefined;
  return asRecord(root.definitions) ?? asRecord(root["bpmn:definitions"]);
}

function parseProcess(
  process: Record<string, unknown>,
  context: { file: string },
  warnings: string[],
): ParsedBpmnProcess {
  const { extension, warnings: extensionWarnings } = parseExtensionProperties(
    process,
    { file: context.file, elementId: String(process.id ?? "process") },
  );
  warnings.push(...extensionWarnings);

  return {
    id: String(process.id ?? ""),
    name: typeof process.name === "string" ? process.name : undefined,
    isExecutable:
      typeof process.isExecutable === "boolean"
        ? process.isExecutable
        : process.isExecutable === "true"
          ? true
          : process.isExecutable === "false"
            ? false
            : undefined,
    raw: {
      ...process,
      ...(Object.keys(extension).length > 0 ? { _parsedExtension: extension } : {}),
    },
  };
}

function parseParticipants(
  collaboration: Record<string, unknown> | undefined,
): ParsedBpmnParticipant[] {
  if (!collaboration) return [];

  return asArray(collaboration.participant).map((participant) => {
    const record = asRecord(participant) ?? {};
    return {
      id: String(record.id ?? ""),
      name: typeof record.name === "string" ? record.name : undefined,
      processRef:
        typeof record.processRef === "string" ? record.processRef : undefined,
      raw: record,
    };
  });
}

function parseLanes(
  process: Record<string, unknown> | undefined,
  context: { file: string },
  warnings: string[],
): ParsedBpmnLane[] {
  if (!process) return [];

  const laneSet = asRecord(process.laneSet);
  if (!laneSet) return [];

  return asArray(laneSet.lane).map((lane) => {
    const record = asRecord(lane) ?? {};
    const { extension, warnings: extensionWarnings } = parseExtensionProperties(
      record,
      { file: context.file, elementId: String(record.id ?? "lane") },
    );
    warnings.push(...extensionWarnings);

    return {
      id: String(record.id ?? ""),
      name: typeof record.name === "string" ? record.name : undefined,
      flowNodeRefs: asArray(record.flowNodeRef).map((ref) => String(ref)),
      extension: Object.keys(extension).length > 0 ? extension : undefined,
      raw: record,
    };
  });
}

function parseElements(
  container: Record<string, unknown> | undefined,
  bpmnTypes: readonly string[],
  context: { file: string },
  warnings: string[],
): ParsedBpmnElement[] {
  if (!container) return [];

  const elements: ParsedBpmnElement[] = [];

  for (const bpmnType of bpmnTypes) {
    for (const item of asArray(container[bpmnType])) {
      const record = asRecord(item);
      if (!record) continue;

      const { extension, warnings: extensionWarnings } = parseExtensionProperties(
        record,
        { file: context.file, elementId: String(record.id ?? bpmnType) },
      );
      warnings.push(...extensionWarnings);

      elements.push({
        id: String(record.id ?? ""),
        name: typeof record.name === "string" ? record.name : undefined,
        bpmnType,
        raw: record,
        extension: Object.keys(extension).length > 0 ? extension : undefined,
      });
    }
  }

  return elements;
}

function parseSequenceFlows(
  process: Record<string, unknown> | undefined,
): ParsedBpmnSequenceFlow[] {
  if (!process) return [];

  return asArray(process.sequenceFlow).map((flow) => {
    const record = asRecord(flow) ?? {};
    return {
      id: String(record.id ?? ""),
      name: typeof record.name === "string" ? record.name : undefined,
      sourceRef:
        typeof record.sourceRef === "string" ? record.sourceRef : undefined,
      targetRef:
        typeof record.targetRef === "string" ? record.targetRef : undefined,
      conditionExpression: getTextContent(record.conditionExpression),
      raw: record,
    };
  });
}

function parseAnnotations(
  ...containers: Array<Record<string, unknown> | undefined>
): ParsedBpmnAnnotation[] {
  const annotations: ParsedBpmnAnnotation[] = [];

  for (const container of containers) {
    if (!container) continue;

    for (const item of asArray(container.textAnnotation)) {
      const record = asRecord(item);
      if (!record) continue;

      annotations.push({
        id: String(record.id ?? ""),
        text: getTextContent(record.text),
        raw: record,
      });
    }
  }

  return annotations;
}

function parseAssociations(
  ...containers: Array<Record<string, unknown> | undefined>
): ParsedBpmnAssociation[] {
  const associations: ParsedBpmnAssociation[] = [];

  for (const container of containers) {
    if (!container) continue;

    for (const item of asArray(container.association)) {
      const record = asRecord(item);
      if (!record) continue;

      associations.push({
        id: String(record.id ?? ""),
        sourceRef:
          typeof record.sourceRef === "string" ? record.sourceRef : undefined,
        targetRef:
          typeof record.targetRef === "string" ? record.targetRef : undefined,
        raw: record,
      });
    }
  }

  return associations;
}

function parseActivityDataAssociations(
  activity: ParsedBpmnElement,
): ParsedBpmnDataAssociation[] {
  const associations: ParsedBpmnDataAssociation[] = [];
  const raw = activity.raw;

  for (const item of asArray(raw.dataInputAssociation)) {
    const record = asRecord(item);
    if (!record) continue;

    associations.push({
      id: String(record.id ?? ""),
      direction: "input",
      sourceRef:
        typeof record.sourceRef === "string" ? record.sourceRef : undefined,
      targetRef:
        typeof record.targetRef === "string" ? record.targetRef : undefined,
      activityId: activity.id,
      raw: record,
    });
  }

  for (const item of asArray(raw.dataOutputAssociation)) {
    const record = asRecord(item);
    if (!record) continue;

    associations.push({
      id: String(record.id ?? ""),
      direction: "output",
      sourceRef:
        typeof record.sourceRef === "string" ? record.sourceRef : undefined,
      targetRef:
        typeof record.targetRef === "string" ? record.targetRef : undefined,
      activityId: activity.id,
      raw: record,
    });
  }

  return associations;
}

function collectDataAssociations(
  activities: ParsedBpmnElement[],
): ParsedBpmnDataAssociation[] {
  return activities.flatMap((activity) => parseActivityDataAssociations(activity));
}

function basenameOf(filePath: string): string {
  const trimmed = filePath.replace(/\/+$/, "");
  const separatorIndex = trimmed.lastIndexOf("/");
  return separatorIndex >= 0 ? trimmed.slice(separatorIndex + 1) : trimmed;
}

export interface ParseBpmnXmlOptions {
  /** proc_def.id — 항상 호출자가 제공(파일명 유도 아님) */
  modelId: string;
  /** proc_def.name 등 표시명. sourcePath 없을 때 processCode 추출 시드로도 사용 */
  displayName?: string;
  /** 원본 파일 경로가 있으면 파일명 유도 헬퍼(sourceFile/displayName)가 샘플과 동일하게 적용됨 */
  sourcePath?: string;
}

function emptyModel(
  base: Pick<
    ParsedBpmnModel,
    "modelId" | "sourceFile" | "sourcePath" | "displayName"
  >,
  warnings: string[],
): ParsedBpmnModel {
  return {
    ...base,
    participants: [],
    lanes: [],
    activities: [],
    gateways: [],
    events: [],
    sequenceFlows: [],
    dataStores: [],
    dataObjects: [],
    dataAssociations: [],
    annotations: [],
    associations: [],
    warnings,
  };
}

export function parseBpmnXml(
  xml: string,
  opts: ParseBpmnXmlOptions,
): ParsedBpmnModel {
  const warnings: string[] = [];
  const modelId = opts.modelId;
  const sourcePath = opts.sourcePath ?? opts.modelId;
  // sourcePath 없으면 displayName 을 sourceFile 로 사용해 extractGraph 의
  // extractProcessCode(sourceFile) → process.name → participant.name 폴백 순서가 유지되게 한다
  const sourceFile = opts.sourcePath
    ? basenameOf(opts.sourcePath)
    : (opts.displayName ?? opts.modelId);
  const displayName =
    opts.displayName ??
    (opts.sourcePath ? deriveDisplayNameFromPath(opts.sourcePath) : "");
  const context = { file: sourcePath };
  const base = { modelId, sourceFile, sourcePath, displayName };

  let doc: unknown;
  try {
    doc = xmlParser.parse(xml);
  } catch (error) {
    // NEVER throw: 파싱 실패는 경고 + 빈 모델로 수렴
    warnings.push(
      `[${sourcePath}] parse-failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return emptyModel(base, warnings);
  }

  const definitions = getDefinitions(doc);

  if (!definitions) {
    warnings.push(`[${sourcePath}] Missing root definitions element`);
    return emptyModel(base, warnings);
  }

  const collaboration = asRecord(definitions.collaboration);
  const processRecords = asArray(definitions.process).map(
    (item) => asRecord(item) ?? {},
  );
  const process = processRecords[0];

  if (!process) {
    warnings.push(`[${sourcePath}] No bpmn:process element found`);
  }

  const participants = parseParticipants(collaboration);
  const lanes = parseLanes(process, context, warnings);
  const activities = parseElements(process, ACTIVITY_TYPES, context, warnings);
  const gateways = parseElements(process, GATEWAY_TYPES, context, warnings);
  const events = parseElements(process, EVENT_TYPES, context, warnings);
  const sequenceFlows = parseSequenceFlows(process);
  const dataStores = parseElements(
    process,
    ["dataStoreReference"],
    context,
    warnings,
  ).map((element) => ({
    ...element,
    bpmnType: "dataStoreReference",
  }));
  const dataObjects = parseElements(
    process,
    ["dataObjectReference"],
    context,
    warnings,
  ).map((element) => ({
    ...element,
    bpmnType: "dataObjectReference",
    raw: {
      ...element.raw,
      dataObjectRef:
        typeof element.raw.dataObjectRef === "string"
          ? element.raw.dataObjectRef
          : undefined,
    },
  }));
  const dataAssociations = collectDataAssociations(activities);
  const annotations = parseAnnotations(collaboration, process);
  const associations = parseAssociations(collaboration, process);

  return {
    modelId,
    sourceFile,
    sourcePath,
    displayName,
    exporter:
      typeof definitions.exporter === "string"
        ? definitions.exporter
        : undefined,
    exporterVersion:
      typeof definitions.exporterVersion === "string"
        ? definitions.exporterVersion
        : undefined,
    targetNamespace:
      typeof definitions.targetNamespace === "string"
        ? definitions.targetNamespace
        : undefined,
    process: process ? parseProcess(process, context, warnings) : undefined,
    participants,
    lanes,
    activities,
    gateways,
    events,
    sequenceFlows,
    dataStores,
    dataObjects,
    dataAssociations,
    annotations,
    associations,
    warnings,
  };
}
