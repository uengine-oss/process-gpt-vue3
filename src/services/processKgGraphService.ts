/**
 * processKgGraphService — proc_def(BPMN)에서 ProcessGraph 빌드 (specs/002 §2.1 ProcDefGraphSource).
 *
 * 소스: Supabase `proc_def` 테이블의 `bpmn`(XML) 컬럼 — ontologyGraphService와 동일한 접근 패턴
 * (window.$supabase / window.$tenantName, tenant_id 필터, deleted_at null, 조회 실패 시 throw).
 * 파이프라인 순서 고정(샘플 cli/buildGraph.ts 파리티):
 * parse → extract → enrich(lane) → merge → resolve → invokes → rollup.
 */
import { buildGraphMetadata } from '@/lib/processKg/config/graphSource';
import { addInvokesSubprocessEdges } from '@/lib/processKg/graph/deriveSubprocessInvocation';
import { extractGraphFromParsedModel } from '@/lib/processKg/graph/extractGraph';
import { enrichLaneResponsibility } from '@/lib/processKg/graph/laneResponsibility';
import { mergeGraphs } from '@/lib/processKg/graph/mergeGraphs';
import { resolveGraphReferences } from '@/lib/processKg/graph/resolveReferences';
import { addProcessRollupRelations } from '@/lib/processKg/graph/rollupProcessRelations';
import type {
    GraphEdge,
    GraphNode,
    ParseReport,
    ProcessGraph,
    ProcessModelSummary,
} from '@/lib/processKg/graph/types';
import { parseBpmnXml } from '@/lib/processKg/parser/parseBpmnXml';
import type { GraphSourceProvider } from '@/lib/processKg/source/graphSource';

interface ProcDefRow {
    id: string;
    name: string | null;
    bpmn: string | null;
}

export interface ProcDefGraphSourceOptions {
    id?: string;
    label?: string;
    /** 미지정 시 테넌트의 삭제되지 않은 전체 정의를 대상으로 한다. */
    procDefIds?: string[];
}

export class ProcDefGraphSource implements GraphSourceProvider {
    readonly id: string;
    readonly label: string;
    readonly kind = 'proc-def' as const;

    private readonly procDefIds?: string[];

    constructor(options: ProcDefGraphSourceOptions = {}) {
        this.id = options.id ?? 'proc-def';
        this.label = options.label ?? '프로세스 정의 (proc_def)';
        this.procDefIds = options.procDefIds;
    }

    async load(): Promise<ProcessGraph> {
        const supabase = (window as any).$supabase;
        const tenantId = (window as any).$tenantName;
        if (!supabase) throw new Error('Supabase 클라이언트를 사용할 수 없습니다.');

        let query = supabase.from('proc_def').select('id,name,bpmn').eq('tenant_id', tenantId).is('deleted_at', null);
        if (this.procDefIds && this.procDefIds.length) query = query.in('id', this.procDefIds);

        const { data, error } = await query;
        if (error) throw new Error(`프로세스 정의 조회 실패: ${error.message}`);

        return buildGraphFromProcDefRows((data || []) as ProcDefRow[], {
            tenantId: String(tenantId ?? ''),
            sourceLabel: this.label,
        });
    }
}

/**
 * proc_def 행들로부터 ProcessGraph 빌드 — 샘플 buildGraphFromFiles와 동일 파이프라인
 * (파일 경로 대신 행의 bpmn XML). bpmn이 빈 행은 스킵하고 failedFiles로 계상한다.
 */
export function buildGraphFromProcDefRows(
    rows: ProcDefRow[],
    context: { tenantId: string; sourceLabel: string },
): ProcessGraph {
    const perModelGraphs: Array<{
        nodes: GraphNode[];
        edges: GraphEdge[];
        warnings: ParseReport['warnings'];
    }> = [];

    let parsedFiles = 0;
    let failedFiles = 0;
    const buildWarnings: ParseReport['warnings'] = [];

    for (const row of rows) {
        if (typeof row.bpmn !== 'string' || !row.bpmn.trim()) {
            failedFiles += 1;
            buildWarnings.push({
                code: 'parse-failed',
                message: `proc_def ${row.id} has empty bpmn xml; skipped.`,
                file: row.id,
                severity: 'error',
            });
            continue;
        }

        const model = parseBpmnXml(row.bpmn, { modelId: row.id, displayName: row.name ?? undefined });
        const extracted = extractGraphFromParsedModel(model);
        const enriched = enrichLaneResponsibility(extracted);
        perModelGraphs.push(enriched);
        parsedFiles += 1;
    }

    const merged = mergeGraphs(perModelGraphs);
    const models = buildModelSummaries(merged.nodes);

    const initialGraph: ProcessGraph = {
        nodes: merged.nodes,
        edges: merged.edges,
        models,
        parseReport: {
            parsedFiles,
            failedFiles,
            warnings: [...buildWarnings, ...merged.warnings],
            unresolvedReferences: [],
        },
    };

    const graph = addProcessRollupRelations(
        addInvokesSubprocessEdges(resolveGraphReferences(initialGraph)),
    );

    graph.metadata = buildGraphMetadata(
        {
            sourceId: context.tenantId,
            sourceLabel: context.sourceLabel,
            sourceType: 'supabase-proc-def',
            tenantId: context.tenantId,
        },
        {
            fileCount: rows.length,
            parsedFileCount: graph.parseReport.parsedFiles,
            failedFileCount: graph.parseReport.failedFiles,
        },
    );

    return graph;
}

/** 샘플 cli/buildGraph.ts buildModelSummaries와 동일 규칙. */
function buildModelSummaries(nodes: GraphNode[]): ProcessModelSummary[] {
    return nodes
        .filter((node) => node.type === 'ProcessModel')
        .map((node) => ({
            id: String(node.properties.modelId ?? node.id.replace(/^ProcessModel:/, '')),
            name: node.label,
            sourceFile: String(node.properties.sourceFile ?? ''),
            sourcePath: String(node.properties.sourcePath ?? ''),
            exporter:
                typeof node.properties.exporter === 'string'
                    ? node.properties.exporter
                    : undefined,
            exporterVersion:
                typeof node.properties.exporterVersion === 'string'
                    ? node.properties.exporterVersion
                    : undefined,
            targetNamespace:
                typeof node.properties.targetNamespace === 'string'
                    ? node.properties.targetNamespace
                    : undefined,
        }))
        .sort((a, b) => a.id.localeCompare(b.id));
}
