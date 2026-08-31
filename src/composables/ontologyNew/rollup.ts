/**
 * rollup — 실행 집계 소비 파생 (specs/005 data-model.md §5, US2 T020).
 *
 * ontology_execution_rollup 응답을 화면 파생값으로 변환하는 순수 함수 모음.
 * 집계 부재는 오류가 아니라 '집계 없음' 강등이다(FR-010).
 */
import type { ActivityRollup, BusinessNode, ExecutionRollup, KpiStatus } from './types';

function propStr(node: BusinessNode, key: string): string | null {
    const v = node.properties?.[key];
    return typeof v === 'string' && v ? v : v != null ? String(v) : null;
}

function propNum(node: BusinessNode, key: string): number | null {
    const v = node.properties?.[key];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
    return null;
}

/**
 * KPI 달성 상태 — direction·target_value 대비 current_value.
 * 값 부재(측정 전/단절)면 unknown (data-model.md §5).
 */
export function deriveKpiStatus(node: BusinessNode): KpiStatus {
    if (node.label !== 'KPI') return 'unknown';
    const target = propNum(node, 'target_value');
    const current = propNum(node, 'current_value');
    const direction = propStr(node, 'direction');
    if (target == null || current == null) return 'unknown';
    if (direction === 'decrease') return current <= target ? 'ok' : 'warning';
    // 기본은 increase 취급
    return current >= target ? 'ok' : 'warning';
}

/** 노드 목록의 KPI 상태 레코드 (nodeId → status) */
export function buildKpiStatusRecord(nodes: BusinessNode[]): Record<string, KpiStatus> {
    const record: Record<string, KpiStatus> = {};
    for (const node of nodes) {
        if (node.label === 'KPI') record[node.id] = deriveKpiStatus(node);
    }
    return record;
}

/**
 * Activity nodeId → ActivityRollup 매핑.
 * 매칭 키는 노드 properties 의 (proc_def_id, element_id) — RPC 노드 id 파싱에 의존하지 않는다.
 */
export function buildActivityRollupMap(nodes: BusinessNode[], rollup: ExecutionRollup | null | undefined): Map<string, ActivityRollup> {
    const map = new Map<string, ActivityRollup>();
    if (!rollup?.activities?.length) return map;
    const byKey = new Map(rollup.activities.map((a) => [`${a.procDefId} ${a.elementId}`, a] as const));
    for (const node of nodes) {
        if (node.label !== 'Activity') continue;
        const procDefId = propStr(node, 'proc_def_id');
        const elementId = propStr(node, 'element_id');
        if (!procDefId || !elementId) continue;
        const hit = byKey.get(`${procDefId} ${elementId}`);
        if (hit) map.set(node.id, hit);
    }
    return map;
}

/** ProcessDefinition nodeId → 진행 중 인스턴스 수 */
export function buildRunningCountMap(nodes: BusinessNode[], rollup: ExecutionRollup | null | undefined): Map<string, number> {
    const map = new Map<string, number>();
    if (!rollup?.processes?.length) return map;
    const byDef = new Map(rollup.processes.map((p) => [p.procDefId, p.runningCount] as const));
    for (const node of nodes) {
        if (node.label !== 'ProcessDefinition') continue;
        const defId = propStr(node, 'id');
        if (!defId) continue;
        const cnt = byDef.get(defId);
        if (cnt !== undefined) map.set(node.id, cnt);
    }
    return map;
}

/** KPI nodeId → 설문 집계(정성 평가) */
export function buildKpiSurveyMap(
    nodes: BusinessNode[],
    rollup: ExecutionRollup | null | undefined
): Map<string, { avgRating: number; answeredCount: number }> {
    const map = new Map<string, { avgRating: number; answeredCount: number }>();
    if (!rollup?.kpiSurveys?.length) return map;
    const byKpi = new Map(rollup.kpiSurveys.map((s) => [s.kpiId, s] as const));
    for (const node of nodes) {
        if (node.label !== 'KPI') continue;
        const kpiId = propStr(node, 'id');
        if (!kpiId) continue;
        const hit = byKpi.get(kpiId);
        if (hit) map.set(node.id, { avgRating: hit.avgRating, answeredCount: hit.answeredCount });
    }
    return map;
}
