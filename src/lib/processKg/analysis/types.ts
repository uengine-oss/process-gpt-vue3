import type { GraphIndex } from "./graphIndex";

export interface EvidenceRef {
  nodeIds: string[];
  edgeIds: string[];
  summary?: string;
}

export interface EvidencePath {
  id: string;
  label: string;
  nodeIds: string[];
  edgeIds: string[];
  explanation: string;
}

export type InsightCategory =
  | "cq"
  | "bottleneck"
  | "impact"
  | "organization"
  | "enrichment"
  | "redesign"
  | "automation"
  | "quality"
  | "spof";
export type InsightSeverity = "info" | "medium" | "high";

export interface InsightCard {
  id: string;
  category: InsightCategory;
  title: string;
  question?: string;
  answer: string;
  explanation: string;
  severity?: InsightSeverity;
  score?: number;
  reasons: string[];
  metrics?: Record<string, number | string>;
  scoreBreakdown?: ScoreBreakdownItem[];
  evidence: EvidenceRef;
  evidencePaths?: EvidencePath[];
  markdown: string;
  /** qdrantChat AI 해설 — 온디맨드 생성, 캐시 (data-model §2) */
  narrative?: string;
}

export interface RankedInsight extends InsightCard {
  rank: number;
}

export interface BottleneckMetrics {
  activityCount: number;
  gatewayCount: number;
  handoffTaskCount: number;
  organizationCount: number;
  supplierCount: number;
  systemCount: number;
  manualActivityCount: number;
  dataStoreCount: number;
}

export interface ScoreBreakdownItem {
  group: string;
  labelKo: string;
  points: number;
  detail: string;
}

export interface OrganizationInsightMetrics {
  processCount: number;
  activityCount: number;
  handoffTaskCount: number;
  coOrganizationCount: number;
  systemCount: number;
  supplierCount: number;
  manualActivityCount: number;
}

export type EnrichmentRecommendationType =
  | "bottleneck_validation"
  | "organization_capacity"
  | "system_risk"
  | "automation_readiness"
  | "modeling_quality";

export type EnrichmentPriority = "high" | "medium" | "low";

export interface EnrichmentRecommendation {
  targetId: string;
  targetLabel: string;
  targetType: string;
  recommendationType: EnrichmentRecommendationType;
  priority: EnrichmentPriority;
  missingFields: string[];
  suggestedSources: string[];
  reasoningBenefit: string;
  explanation: string;
}

export type RedesignRecommendationType =
  | "process_merge"
  | "process_split"
  | "process_module"
  | "cross_org_handoff"
  | "rr_clarification"
  | "ownership_realignment"
  | "task_sequence";

export interface RedesignRecommendation {
  type: RedesignRecommendationType;
  targetIds: string[];
  targetLabels: string[];
  score: number;
  reasons: string[];
  expectedBenefit: string;
  validationNeeded: string;
  recommendedActions: string[];
}

export interface AnalysisReportOptions {
  title?: string;
  topBottlenecks?: number;
  topSystems?: number;
  topOrganizations?: number;
  topEnrichmentRecommendations?: number;
  topRedesignRecommendations?: number;
  topAutomationCandidates?: number;
  topCrossOrgHandoffHotspots?: number;
  topReasoningReadiness?: number;
  topModelingQualityIssues?: number;
  includeCaveats?: boolean;
  /** When true, adds UI20 sample graph scope note to the report */
  isSampleGraph?: boolean;
  /** Reuse a prebuilt graph index for faster report generation */
  graphIndex?: GraphIndex;
}
