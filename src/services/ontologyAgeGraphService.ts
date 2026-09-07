/**
 * ontologyAgeGraphService — Apache AGE process_gpt 그래프 읽기 RPC 호출 계층
 * (specs/005 contracts/graph-read-rpc.contract.md).
 *
 * 그래프 스키마는 PostgREST 미노출(보안 정책) — public RPC 3종이 유일한 읽기 경로.
 * 기존 규약 준수: window.$supabase / window.$tenantName, 실패 시 throw(mock fallback 금지).
 * snake_case(RPC) → camelCase(types.ts) 변환은 이 계층 책임.
 */
import type {
    ActivityRollup,
    BusinessEdge,
    BusinessLayer,
    BusinessNode,
    BusinessOntologyGraph,
    ExecutionRollup,
    GraphHealth,
    KpiSurveyRollup,
    ProcessRollup
} from '@/composables/ontologyNew/types';

/** 스키마 계약 호환 기준 — '0.2' prefix (research.md R10, V4) */
export const COMPATIBLE_VERSION_PREFIX = '0.2';

function supabaseClient(): any {
    const supabase = (window as any).$supabase;
    if (!supabase) throw new Error('Supabase 클라이언트를 사용할 수 없습니다.');
    return supabase;
}

function currentTenantId(): string {
    const tenantId = (window as any).$tenantName;
    if (!tenantId || !String(tenantId).trim()) throw new Error('테넌트가 설정되지 않았습니다.');
    return String(tenantId);
}

export function isCompatibleSchemaVersion(version: string | null | undefined): boolean {
    if (!version) return false;
    return version === COMPATIBLE_VERSION_PREFIX || version.startsWith(`${COMPATIBLE_VERSION_PREFIX}.`);
}

const EMPTY_LAYER_COUNTS: Record<BusinessLayer, number> = {
    strategy: 0,
    process: 0,
    task: 0,
    resource: 0,
    knowledge: 0
};

/** ontology_graph_health → GraphHealth (compatible 파생 포함) */
export async function loadHealth(): Promise<GraphHealth> {
    const { data, error } = await supabaseClient().rpc('ontology_graph_health', {
        p_tenant_id: currentTenantId()
    });
    if (error) throw new Error(`온톨로지 그래프 헬스체크 실패: ${error.message}`);

    const raw = data ?? {};
    const rawCounts = (raw.layer_counts ?? {}) as Record<string, number>;
    const layerCounts: Record<BusinessLayer, number> = {
        ...EMPTY_LAYER_COUNTS,
        strategy: Number(rawCounts.strategy ?? 0),
        process: Number(rawCounts.process ?? 0),
        task: Number(rawCounts.task ?? 0),
        resource: Number(rawCounts.resource ?? 0),
        knowledge: Number(rawCounts.knowledge ?? 0)
    };
    const schemaVersion: string | null = raw.schema_version ?? null;

    return {
        installed: raw.installed === true,
        schemaVersion,
        compatible: raw.installed === true && isCompatibleSchemaVersion(schemaVersion),
        layerCounts,
        danglingCount: Number(raw.dangling_count ?? 0)
    };
}

/** ontology_business_graph → BusinessOntologyGraph. 화이트리스트·id 생성은 서버 책임. */
export async function loadBusinessGraph(layers?: BusinessLayer[]): Promise<BusinessOntologyGraph> {
    const { data, error } = await supabaseClient().rpc('ontology_business_graph', {
        p_tenant_id: currentTenantId(),
        p_layers: layers && layers.length ? layers : null
    });
    if (error) throw new Error(`온톨로지 그래프 조회 실패: ${error.message}`);

    const raw = data ?? {};
    const nodes: BusinessNode[] = ((raw.nodes ?? []) as any[]).map((n) => ({
        id: String(n.id),
        label: String(n.label),
        layer: n.layer as BusinessLayer,
        name: String(n.name ?? n.id),
        properties: (n.properties ?? {}) as Record<string, unknown>
    }));
    const edges: BusinessEdge[] = ((raw.edges ?? []) as any[]).map((e) => ({
        id: String(e.id),
        type: String(e.type),
        source: String(e.source),
        target: String(e.target),
        properties: (e.properties ?? {}) as Record<string, unknown>
    }));

    const graph: BusinessOntologyGraph = { nodes, edges };
    if (raw.truncated === true) graph.truncated = true;
    return graph;
}

/** ontology_execution_rollup → ExecutionRollup. 부재 데이터는 빈 배열(FR-010 '집계 없음'). */
export async function loadExecutionRollup(): Promise<ExecutionRollup> {
    const { data, error } = await supabaseClient().rpc('ontology_execution_rollup', {
        p_tenant_id: currentTenantId()
    });
    if (error) throw new Error(`실행 집계 조회 실패: ${error.message}`);

    const raw = data ?? {};
    const processes: ProcessRollup[] = ((raw.processes ?? []) as any[]).map((p) => ({
        procDefId: String(p.proc_def_id),
        runningCount: Number(p.running_count ?? 0)
    }));
    const activities: ActivityRollup[] = ((raw.activities ?? []) as any[]).map((a) => ({
        procDefId: String(a.proc_def_id),
        elementId: String(a.element_id),
        workItemCount: Number(a.work_item_count ?? 0),
        avgDurationHours: a.avg_duration_hours == null ? null : Number(a.avg_duration_hours),
        reworkSum: Number(a.rework_sum ?? 0),
        inProgressCount: Number(a.in_progress_count ?? 0)
    }));
    const kpiSurveys: KpiSurveyRollup[] = ((raw.kpi_surveys ?? []) as any[]).map((s) => ({
        kpiId: String(s.kpi_id),
        avgRating: Number(s.avg_rating ?? 0),
        answeredCount: Number(s.answered_count ?? 0)
    }));

    return { processes, activities, kpiSurveys };
}
