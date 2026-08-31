/**
 * AGE 라벨 → 비즈니스 레이어 매핑·팔레트·모양·엣지 화이트리스트
 * (specs/005 data-model.md §1·§3, contracts/explorer-new-ui.contract.md 스타일 규칙).
 *
 * 5레벨: 전략 > 프로세스(지도·정의) > 테스크(+역할 슬롯) > 리소스(사람·에이전트·팀·시스템·서비스) > 지식.
 * PiSystem/PiService/PI_USES_* 는 이 리포 확장 라벨(scripts/ontology-graph/schema/10-pi-extensions.sql,
 * INTEGRATION.md §7 — 'Pi'/'PI_' 접두).
 *
 * RPC(supabase/migrations/20260710_ontology_explorer_rpc.sql 의 ontology_layer_of /
 * c_edge_specs)와 반드시 동기 유지 — 서버가 반환 화이트리스트의 정본이고
 * 이 모듈은 표시(색·모양·스타일)와 순회의 클라이언트 사본이다.
 */
import type { BusinessLayer } from './types';

/* ── 라벨 → 레이어 (16종, data-model.md §1) ── */

export const LABEL_LAYER: Record<string, BusinessLayer> = {
    Perspective: 'strategy',
    Objective: 'strategy',
    KPI: 'strategy',
    Initiative: 'strategy',
    MegaProcess: 'process',
    MajorProcess: 'process',
    ProcessDefinition: 'process',
    Activity: 'task',
    Role: 'task',
    User: 'resource',
    Agent: 'resource',
    Team: 'resource',
    PiSystem: 'resource',
    PiService: 'resource',
    Skill: 'knowledge',
    KnowledgeDoc: 'knowledge'
};

export function layerOfLabel(label: string): BusinessLayer | null {
    return LABEL_LAYER[label] ?? null;
}

/** 레벨 순서(위→아래) — 위계 판정·필터 그룹 순회 기준 */
export const LAYER_ORDER: BusinessLayer[] = ['strategy', 'process', 'task', 'resource', 'knowledge'];

export const LAYER_LABEL_KO: Record<BusinessLayer, string> = {
    strategy: '전략 (Strategy)',
    process: '프로세스 (Process)',
    task: '테스크 (Task)',
    resource: '리소스 (Resource)',
    knowledge: '지식·스킬 (Knowledge & Skill)'
};

/* ── 레이어 팔레트 (전략 보라 / 프로세스 파랑 / 테스크 하늘 / 리소스 주황 / 지식 초록) ── */

export const LAYER_COLOR: Record<BusinessLayer, string> = {
    strategy: '#7c3aed',
    process: '#1d4ed8',
    task: '#0284c7',
    resource: '#ea580c',
    knowledge: '#16a34a'
};

export const LAYER_BAND_BG: Record<BusinessLayer, string> = {
    strategy: 'rgba(124, 58, 237, 0.05)',
    process: 'rgba(29, 78, 216, 0.05)',
    task: 'rgba(2, 132, 199, 0.05)',
    resource: 'rgba(234, 88, 12, 0.05)',
    knowledge: 'rgba(22, 163, 74, 0.05)'
};

/** 라벨별 색 미세 조정(레이어 색 기반, 판독성 향상) */
export const LABEL_COLOR: Record<string, string> = {
    Perspective: '#6d28d9',
    Objective: '#7c3aed',
    KPI: '#a855f7',
    Initiative: '#8b5cf6',
    MegaProcess: '#1e3a8a',
    MajorProcess: '#1d4ed8',
    ProcessDefinition: '#3b82f6',
    Activity: '#0ea5e9',
    Role: '#7dd3fc',
    User: '#ea580c',
    Agent: '#f97316',
    Team: '#fb923c',
    PiSystem: '#d97706',
    PiService: '#fbbf24',
    Skill: '#16a34a',
    KnowledgeDoc: '#4ade80'
};

export function colorForLabel(label: string): string {
    return LABEL_COLOR[label] ?? '#94a3b8';
}

/**
 * 라벨별 텍스트(폰트) 색 — 노드 색과 같은 색조의 어두운 톤 (흰 배경 대비 확보).
 * 노드 채움색을 그대로 폰트에 쓰면 밝은 색(Role/PiService 등)이 안 보이므로
 * 색조는 유지하고 명도만 낮춘 변형을 쓴다. 노드 테두리에도 동일 색을 써서
 * 노드-라벨 시각 연결을 만든다 (가시성 개선).
 */
export const LABEL_TEXT_COLOR: Record<string, string> = {
    Perspective: '#5b21b6',
    Objective: '#6d28d9',
    KPI: '#7e22ce',
    Initiative: '#6d28d9',
    MegaProcess: '#1e3a8a',
    MajorProcess: '#1e40af',
    ProcessDefinition: '#1d4ed8',
    Activity: '#0369a1',
    Role: '#0369a1',
    User: '#c2410c',
    Agent: '#c2410c',
    Team: '#c2410c',
    PiSystem: '#92400e',
    PiService: '#92400e',
    Skill: '#15803d',
    KnowledgeDoc: '#15803d'
};

export function textColorForLabel(label: string): string {
    return LABEL_TEXT_COLOR[label] ?? '#475569';
}

/** cytoscape shape (contracts/explorer-new-ui.contract.md — KPI=diamond, Skill=hexagon 등) */
export const LABEL_SHAPE: Record<string, string> = {
    Perspective: 'round-rectangle',
    Objective: 'round-rectangle',
    KPI: 'diamond',
    Initiative: 'round-rectangle',
    MegaProcess: 'round-rectangle',
    MajorProcess: 'round-rectangle',
    ProcessDefinition: 'round-rectangle',
    Activity: 'round-rectangle',
    Role: 'round-tag',
    User: 'ellipse',
    Agent: 'ellipse',
    Team: 'round-rectangle',
    PiSystem: 'barrel',
    PiService: 'rhomboid',
    Skill: 'hexagon',
    KnowledgeDoc: 'round-rectangle'
};

export function shapeForLabel(label: string): string {
    return LABEL_SHAPE[label] ?? 'ellipse';
}

export const LABEL_KO: Record<string, string> = {
    Perspective: 'BSC 관점',
    Objective: '전략목표',
    KPI: 'KPI',
    Initiative: '실행과제',
    MegaProcess: '메가 프로세스',
    MajorProcess: '메이저 프로세스',
    ProcessDefinition: '프로세스 정의',
    Activity: '테스크',
    Role: '역할(레인)',
    User: '사용자',
    Agent: 'AI 에이전트',
    Team: '팀',
    PiSystem: '시스템',
    PiService: '서비스',
    Skill: '스킬',
    KnowledgeDoc: '지식문서'
};

export function labelKo(label: string): string {
    return LABEL_KO[label] ?? label;
}

/* ── 엣지 화이트리스트 (21종, data-model.md §3) ── */

export type EdgeStyleClass =
    | 'thin' //     구조/소속 (실선 얇게)
    | 'arrow' //    방향 흐름/인과 (실선 화살표)
    | 'gateway' //  레이어 관문 (강조 실선 굵게)
    | 'dashedThin' // 보조 점선
    | 'reference' // REQUIRES_SKILL — UML 의존 (점선 + 열린 화살촉)
    | 'inheritance'; // EXTENDS — UML 일반화 (실선 + 채워진 삼각 화살촉)

export const EDGE_WHITELIST: Record<string, EdgeStyleClass> = {
    IN_PERSPECTIVE: 'thin',
    CONTRIBUTES_TO: 'arrow',
    MEASURES: 'arrow',
    DRIVES: 'arrow',
    OWNED_BY: 'dashedThin',
    SOURCED_FROM: 'gateway',
    REALIZED_BY: 'arrow',
    CONTAINS: 'thin',
    DEFINES: 'thin',
    FLOWS_TO: 'arrow',
    CALLS: 'dashedThin',
    IN_LANE: 'thin',
    RESOLVES_TO: 'gateway',
    PERFORMED_BY_AGENT: 'gateway',
    MEMBER_OF: 'thin',
    PART_OF: 'thin',
    REQUIRES_SKILL: 'reference',
    HAS_SKILL: 'dashedThin',
    EXTENDS: 'inheritance',
    // PI 확장 — 테스크→시스템/서비스 관문 (10-pi-extensions.sql)
    PI_USES_SYSTEM: 'gateway',
    PI_USES_SERVICE: 'gateway'
};

export function isWhitelistedEdge(type: string): boolean {
    return type in EDGE_WHITELIST;
}

export function edgeStyleClass(type: string): EdgeStyleClass {
    return EDGE_WHITELIST[type] ?? 'thin';
}

/** 레이어 관문 엣지 — 전략→프로세스→테스크→리소스 연결의 시각 강조 대상 */
export const GATEWAY_EDGES = ['SOURCED_FROM', 'RESOLVES_TO', 'PERFORMED_BY_AGENT', 'PI_USES_SYSTEM', 'PI_USES_SERVICE'] as const;
