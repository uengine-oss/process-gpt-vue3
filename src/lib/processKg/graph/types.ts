export type NodeType =
  | "ProcessModel"
  | "Process"
  | "Participant"
  | "Lane"
  | "Organization"
  | "Supplier"
  | "ProcessElement"
  | "ProcessActivity"
  | "Gateway"
  | "Event"
  | "SequenceFlow"
  | "System"
  | "DataStore"
  | "DataObject"
  | "Manual"
  | "Annotation"
  | "FTEProfile"
  | "CostProfile"
  | "Project";

export type EdgeType =
  | "definesProcess"
  | "hasParticipant"
  | "containsElement"
  | "hasActivity"
  | "hasLane"
  | "assignedToLane"
  | "performedByOrganization"
  | "performedBySupplier"
  | "isFollowedBy"
  | "flowFrom"
  | "flowTo"
  | "usesSystem"
  | "referencesDataStore"
  | "usesDataObject"
  | "producesDataObject"
  | "hasManual"
  | "hasAnnotation"
  | "hasFTEProfile"
  | "hasCostProfile"
  | "relatedToProject"
  | "callsProcessModel"
  | "handsOffToProcessModel"
  | "invokesSubprocess"
  | "isChildOf";

export interface GraphNode {
  id: string;
  type: NodeType;
  label: string;
  properties: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  type: EdgeType;
  source: string;
  target: string;
  label?: string;
  properties?: Record<string, unknown>;
}

export interface ParserWarning {
  code: string;
  message: string;
  file?: string;
  elementId?: string;
  severity: "info" | "warning" | "error";
  details?: Record<string, unknown>;
}

export interface UnresolvedReference {
  sourceModelId: string;
  sourceElementId: string;
  definitionId: string;
}

export interface ParseReport {
  parsedFiles: number;
  failedFiles: number;
  warnings: ParserWarning[];
  unresolvedReferences: UnresolvedReference[];
}

export interface ProcessModelSummary {
  id: string;
  name: string;
  sourceFile: string;
  sourcePath: string;
  modelLevel?: "parent" | "child" | "unknown";
  parentModelId?: string | null;
  exporter?: string;
  exporterVersion?: string;
  targetNamespace?: string;
  checksum?: string;
}

export interface ProcessGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  models: ProcessModelSummary[];
  parseReport: ParseReport;
  metadata?: import("../config/graphSource").GraphBuildMetadata;
}
