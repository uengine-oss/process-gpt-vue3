export type BpmnActivityType =
  | "task"
  | "manualTask"
  | "userTask"
  | "sendTask"
  | "receiveTask"
  | "serviceTask"
  | "scriptTask"
  | "businessRuleTask"
  | "callActivity";

export type BpmnGatewayType =
  | "exclusiveGateway"
  | "parallelGateway"
  | "inclusiveGateway"
  | "eventBasedGateway";

export type BpmnEventType =
  | "startEvent"
  | "endEvent"
  | "intermediateCatchEvent"
  | "intermediateThrowEvent"
  | "boundaryEvent";

export interface ParsedExtensionProperties {
  description?: string;
  manualLink?: string;
  manualLinks?: Array<{
    title?: string;
    url?: string;
    source?: string;
    [key: string]: unknown;
  }>;
  systems?: Array<
    | string
    | {
        id?: string;
        systemId?: string;
        code?: string;
        key?: string;
        name?: string;
        systemName?: string;
        label?: string;
        displayName?: string;
        [key: string]: unknown;
      }
  >;
  fte?: {
    inputMode?: string;
    directPercent?: number;
    freqCycle?: string;
    freqCount?: number;
    timePerTask?: number;
    headcount?: number;
    [key: string]: unknown;
  };
  futureStatus?: string;
  relatedProjects?: Array<{
    id?: string;
    name?: string;
    url?: string;
    [key: string]: unknown;
  }>;
  opexCost?: number | null;
  opexUnit?: string;
  opexNote?: string;
  dataAttachmentUrl?: string;
  dataAttachmentFile?: unknown;
  comments?: unknown[];
  definitionId?: string;
  raw?: Record<string, unknown>;
}

export interface ParsedBpmnElement {
  id: string;
  name?: string;
  bpmnType: string;
  raw: Record<string, unknown>;
  extension?: ParsedExtensionProperties;
}

export interface ParsedBpmnProcess {
  id: string;
  name?: string;
  isExecutable?: boolean;
  raw: Record<string, unknown>;
}

export interface ParsedBpmnParticipant {
  id: string;
  name?: string;
  processRef?: string;
  raw: Record<string, unknown>;
}

export interface ParsedBpmnLane {
  id: string;
  name?: string;
  flowNodeRefs: string[];
  extension?: ParsedExtensionProperties;
  raw: Record<string, unknown>;
}

export interface ParsedBpmnSequenceFlow {
  id: string;
  name?: string;
  sourceRef?: string;
  targetRef?: string;
  conditionExpression?: string;
  raw: Record<string, unknown>;
}

export interface ParsedBpmnAnnotation {
  id: string;
  text?: string;
  raw: Record<string, unknown>;
}

export interface ParsedBpmnAssociation {
  id: string;
  sourceRef?: string;
  targetRef?: string;
  raw: Record<string, unknown>;
}

export interface ParsedBpmnDataAssociation {
  id: string;
  direction: "input" | "output";
  sourceRef?: string;
  targetRef?: string;
  activityId: string;
  raw: Record<string, unknown>;
}

export interface ParsedBpmnModel {
  modelId: string;
  sourceFile: string;
  sourcePath: string;
  displayName: string;
  exporter?: string;
  exporterVersion?: string;
  targetNamespace?: string;
  process?: ParsedBpmnProcess;
  participants: ParsedBpmnParticipant[];
  lanes: ParsedBpmnLane[];
  activities: ParsedBpmnElement[];
  gateways: ParsedBpmnElement[];
  events: ParsedBpmnElement[];
  sequenceFlows: ParsedBpmnSequenceFlow[];
  dataStores: ParsedBpmnElement[];
  dataObjects: ParsedBpmnElement[];
  dataAssociations: ParsedBpmnDataAssociation[];
  annotations: ParsedBpmnAnnotation[];
  associations: ParsedBpmnAssociation[];
  warnings: string[];
}
