/**
 * GraphSource 계약 — specs/002-process-kg-integration/contracts/process-graph.contract.md §2.
 */
import type { ProcessGraph } from "../graph/types";

export type GraphSourceKind = "proc-def" | "artifact";

/** 소스 선택 UI 등에서 쓰는 직렬화 가능한 소스 기술자. */
export interface GraphSource {
  id: string;
  label: string;
  kind: GraphSourceKind;
  url?: string;
}

export interface GraphSourceProvider {
  id: string;
  label: string;
  kind: GraphSourceKind;
  /** 실패 시 throw — mock/빈 그래프 대체 금지. */
  load(): Promise<ProcessGraph>;
}
