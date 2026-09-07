/**
 * @deprecated specs/002 — src/lib/processKg 로 대체됨(다음 정리 시 삭제 예정).
 * 대체 경로: src/services/processKgGraphService.ts (ProcDefGraphSource → canonical ProcessGraph).
 *
 * ontologyGraphService — proc_def(BPMN)에서 온톨로지 그래프 파생 생성 (FR-008).
 *
 * 소스: Supabase `proc_def` 테이블의 `bpmn`(XML) 컬럼 — 프로세스 정의의 단일 소스.
 * (tb_bpmn_* 정규화 테이블이 아니라, 실제 편집·게시되는 proc_def 를 직접 사용)
 * 각 정의의 BPMN XML 을 bpmnOntologyParser 로 파싱 → ontologyMapper 로 Node/Edge 투영 → 병합.
 * 조회 실패 시 throw(에러 노출, mock fallback 없음).
 */
import { parseBpmnToOntologyInput } from '@/composables/ontology/bpmnOntologyParser';
import { mergeGraphs, toOntology } from '@/composables/ontology/ontologyMapper';
import type { OntologyGraph } from '@/composables/ontology/ontologyTypes';

interface ProcDefRow {
    id: string;
    name: string | null;
    bpmn: string | null;
}

/**
 * 접근 가능한 proc_def 들을 온톨로지 그래프로 로드.
 * @param procDefIds 미지정 시 테넌트의 삭제되지 않은 전체 정의를 대상으로 한다.
 */
export async function loadGraph(procDefIds?: string[]): Promise<OntologyGraph> {
    const supabase = (window as any).$supabase;
    const tenantId = (window as any).$tenantName;
    if (!supabase) throw new Error('Supabase 클라이언트를 사용할 수 없습니다.');

    let query = supabase.from('proc_def').select('id,name,bpmn').eq('tenant_id', tenantId).is('deleted_at', null);
    if (procDefIds && procDefIds.length) query = query.in('id', procDefIds);

    const { data, error } = await query;
    if (error) throw new Error(`프로세스 정의 조회 실패: ${error.message}`);

    const rows: ProcDefRow[] = (data || []).filter((r: ProcDefRow) => typeof r.bpmn === 'string' && r.bpmn.trim());
    if (!rows.length) return { nodes: [], edges: [], dimensionAxes: [] };

    const graphs: OntologyGraph[] = [];
    for (const row of rows) {
        const parsed = parseBpmnToOntologyInput(row.bpmn as string);
        if (!parsed.nodes.length) continue; // activity 가 없는 정의는 스킵
        graphs.push(toOntology(parsed, row.id));
    }

    return mergeGraphs(graphs);
}
