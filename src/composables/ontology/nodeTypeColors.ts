/**
 * nodeTypeColors — canonical NodeType 색상/한국어 라벨 팔레트 (specs/002 T022+T046).
 *
 * OntologyCanvas3D 렌더·범례와 상단 바 범례가 공유하는 단일 소스.
 *  - ProcessActivity/Organization/System/DataStore 는 001 레거시 4종(KIND_COLOR) 색을 계승
 *  - 나머지 신규 타입은 SAMPLE bpmn-process-kg GraphCanvas NODE_COLORS 를 참고해
 *    타입 가족(모델·조직·데이터·프로필) 단위로 색상 계열을 유지하되 상호 구분되게 조정
 *  - 레거시 4종 뷰(legacyOntologyMapper)의 kind→색 매핑은 KIND_COLOR 로 그대로 통과
 */

import type { NodeType } from '@/lib/processKg/graph/types';
import type { OntologyNodeKind } from '@/composables/ontology/ontologyTypes';

/** 팔레트에 없는 타입(방어용) 기본색. */
export const FALLBACK_NODE_COLOR = '#8899aa';

/**
 * canonical NodeType 전수 색상 매핑.
 * DataObject 는 DataStore(#a78bfa, violet-400)와 같은 보라 계열이되 명확히 어두운
 * 인접색(violet-600)으로 구분한다.
 */
export const NODE_TYPE_COLORS: Record<NodeType, string> = {
    ProcessModel: '#2563eb',
    Process: '#1d4ed8',
    Participant: '#6366f1',
    Lane: '#c026d3',
    Organization: '#31c48d', // 레거시 Role 색 계승
    Supplier: '#14b8a6',
    ProcessElement: '#8899aa',
    ProcessActivity: '#4f8cff', // 레거시 ProcessTask 색 계승
    Gateway: '#d97706',
    Event: '#dc2626',
    SequenceFlow: '#64748b',
    System: '#f0a020', // 레거시 System 색 계승
    DataStore: '#a78bfa', // 레거시 Data 색 계승
    DataObject: '#7c3aed',
    Manual: '#65a30d',
    Annotation: '#ca8a04',
    FTEProfile: '#84cc16',
    CostProfile: '#a3e635',
    Project: '#ec4899'
};

/** canonical NodeType 한국어 라벨 — 범례·툴팁·콘솔 공용. */
export const NODE_TYPE_LABELS: Record<NodeType, string> = {
    ProcessModel: '프로세스 모델',
    Process: '프로세스',
    Participant: '참여자',
    Lane: '레인',
    Organization: '조직',
    Supplier: '공급사',
    ProcessElement: '프로세스 요소',
    ProcessActivity: '활동',
    Gateway: '게이트웨이',
    Event: '이벤트',
    SequenceFlow: '순서 흐름',
    System: '시스템',
    DataStore: '데이터 저장소',
    DataObject: '데이터 객체',
    Manual: '매뉴얼',
    Annotation: '주석',
    FTEProfile: 'FTE 프로필',
    CostProfile: '비용 프로필',
    Project: '프로젝트'
};

/**
 * 레거시 4종 뷰(001) kind→색 통과 매핑 — 기존 화면 색 경험을 그대로 유지한다.
 * (레거시 kind 는 canonical 타입의 부분집합에 해당: ProcessTask→ProcessActivity,
 *  Role→Organization, System→System, Data→DataStore)
 */
export const KIND_COLOR: Record<OntologyNodeKind, string> = {
    ProcessTask: NODE_TYPE_COLORS.ProcessActivity,
    Role: NODE_TYPE_COLORS.Organization,
    System: NODE_TYPE_COLORS.System,
    Data: NODE_TYPE_COLORS.DataStore
};

/** 타입 색상 조회(미지 타입 방어). */
export function colorForNodeType(type: string): string {
    return (NODE_TYPE_COLORS as Record<string, string>)[type] || FALLBACK_NODE_COLOR;
}

/** 타입 한국어 라벨 조회(미지 타입은 원문 표기). */
export function labelForNodeType(type: string): string {
    return (NODE_TYPE_LABELS as Record<string, string>)[type] || type;
}
