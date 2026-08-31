/**
 * useInsightWorkflow — 인사이트 검토 상태 워크플로 + 데이터 태스크 composable
 * (specs/002 갭 클로징 T064, FR-026/027, data-model §3.1).
 *
 * SAMPLE(bpmn-process-kg) `src/web/hooks/useInsightWorkflow.ts` +
 * `src/web/utils/taskMarkdown.ts`(+ `insightCardHelpers.ts` 추출 로직)의 Vue 번안.
 *  - 인사이트별 검토 상태(new/reviewed/accepted/rejected/needs_data/action_created)를
 *    세션 메모리에만 보관(영속화는 후속 피처) — 미기록 인사이트는 'new' 간주.
 *  - enrichment 카드에서만 데이터 태스크 생성(샘플 createDataTaskFromInsight 동등):
 *    recommendedFields/suggestedSources는 카드 markdown의
 *    '**추천 연결 데이터:**'/'**추천 데이터 소스:**' 불릿(전체 목록)에서 추출하고,
 *    실패 시 metrics 미리보기(콤마 목록) 폴백 — 샘플 insightCardHelpers 파리티.
 *  - 생성 시 해당 인사이트를 'action_created'로 전이, 중복 생성 허용(신규를 앞에 prepend).
 *  - 그래프/소스 교체 시 reset()으로 전체 초기화(FR-025/026).
 *
 * 컴포넌트 밖(테스트 포함)에서도 호출 가능 — 라이프사이클 훅 미사용.
 */
import { computed, shallowRef, type ComputedRef, type Ref } from 'vue';
import type { InsightCard } from '@/lib/processKg/analysis/types';

// ─────────────────────────────────────────────────────────────────────────────
// 타입 · 라벨 (data-model §3.1)
// ─────────────────────────────────────────────────────────────────────────────

export type InsightWorkflowStatus =
    | 'new'
    | 'reviewed'
    | 'accepted'
    | 'rejected'
    | 'needs_data'
    | 'action_created';

/** 인사이트 검토 상태 한국어 라벨(카드 상태 칩/목록 표시용) */
export const WORKFLOW_STATUS_LABELS: Record<InsightWorkflowStatus, string> = {
    new: '신규',
    reviewed: '검토됨',
    accepted: '승인',
    rejected: '반려',
    needs_data: '데이터 필요',
    action_created: '조치 생성됨',
};

/** statusById 엔트리 — 미기록 인사이트는 'new' 간주 */
export interface InsightWorkflowEntry {
    status: InsightWorkflowStatus;
    updatedAt: string;
}

export type DataTaskStatus = 'open' | 'in_progress' | 'done';

/** 데이터 태스크 상태 한국어 라벨(상태 요약 열림/진행/완료 — FR-027) */
export const DATA_TASK_STATUS_LABELS: Record<DataTaskStatus, string> = {
    open: '열림',
    in_progress: '진행 중',
    done: '완료',
};

export interface DataTask {
    /** task-{insightId}-{seq} */
    id: string;
    insightId: string;
    title: string;
    targetId: string;
    targetLabel: string;
    recommendedFields: string[];
    suggestedSources: string[];
    status: DataTaskStatus;
    createdAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// enrichment 카드 추출 헬퍼 (SAMPLE insightCardHelpers.ts 번안)
// ─────────────────────────────────────────────────────────────────────────────

/** 카드 markdown에서 header가 포함된 줄 다음의 '- ' 불릿 목록을 추출한다. */
function parseMarkdownBulletSection(markdown: string, header: string): string[] {
    const lines = markdown.split('\n');
    const startIdx = lines.findIndex((line) => line.includes(header));
    if (startIdx < 0) return [];

    const items: string[] = [];
    for (let i = startIdx + 1; i < lines.length; i += 1) {
        const line = lines[i];
        if (line.startsWith('**') && !line.startsWith('- ')) break;
        if (line.startsWith('- ')) {
            items.push(line.slice(2).trim());
            continue;
        }
        if (line.trim() === '' && items.length > 0) break;
    }
    return items;
}

/** metrics 미리보기 값(콤마 구분 문자열) → 목록. 폴백 경로 전용. */
function splitCommaList(value: string | number | undefined): string[] {
    if (value == null || value === '') return [];
    return String(value)
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}

/**
 * 추천 연결 데이터(필드) 전체 목록 추출.
 * markdown 불릿이 전체 목록(enrichmentRecommendations.buildEnrichmentMarkdown),
 * metrics['추천 연결 데이터']는 상위 6개 미리보기 — markdown 우선.
 */
function getEnrichmentFieldList(insight: InsightCard): string[] {
    const fromMarkdown = parseMarkdownBulletSection(insight.markdown, '추천 연결 데이터');
    if (fromMarkdown.length > 0) return fromMarkdown;
    return splitCommaList(insight.metrics?.['추천 연결 데이터']);
}

/** 추천 데이터 소스 전체 목록 추출(markdown 우선, metrics 상위 4개 미리보기 폴백). */
function getEnrichmentSourceList(insight: InsightCard): string[] {
    const fromMarkdown = parseMarkdownBulletSection(insight.markdown, '추천 데이터 소스');
    if (fromMarkdown.length > 0) return fromMarkdown;
    return splitCommaList(insight.metrics?.['추천 데이터 소스']);
}

/** enrichment 추천 유형(EnrichmentRecommendationType) — 카드 id 프리픽스 해석용 */
const ENRICHMENT_RECOMMENDATION_TYPES = [
    'bottleneck_validation',
    'organization_capacity',
    'system_risk',
    'automation_readiness',
    'modeling_quality',
] as const;

/** 카드 id `enrichment-{type}-{targetId}`에서 대상 노드 id 추출. */
function extractEnrichmentTargetId(insightId: string): string {
    const prefix = 'enrichment-';
    if (!insightId.startsWith(prefix)) return insightId;

    for (const type of ENRICHMENT_RECOMMENDATION_TYPES) {
        const typePrefix = `${prefix}${type}-`;
        if (insightId.startsWith(typePrefix)) {
            return insightId.slice(typePrefix.length);
        }
    }

    return insightId.slice(prefix.length);
}

/** 카드 제목 `데이터 보강 추천: {label}`에서 대상 라벨 추출. */
function extractTargetLabelFromTitle(title: string): string {
    const marker = '데이터 보강 추천:';
    if (title.includes(marker)) {
        return title.split(marker)[1]?.trim() ?? title;
    }
    const colonIdx = title.indexOf(':');
    if (colonIdx >= 0) return title.slice(colonIdx + 1).trim();
    return title;
}

// ─────────────────────────────────────────────────────────────────────────────
// 태스크 마크다운 (SAMPLE taskMarkdown.ts generateDataTaskMarkdown 번안)
// ─────────────────────────────────────────────────────────────────────────────

/** 데이터 태스크 내보내기 마크다운 — 샘플 형식('# Data Enrichment Task' + Target/필드/소스/사유). */
export function generateDataTaskMarkdown(task: DataTask): string {
    const fields =
        task.recommendedFields.length > 0
            ? task.recommendedFields.map((field) => `- ${field}`).join('\n')
            : '- (none)';
    const sources =
        task.suggestedSources.length > 0
            ? task.suggestedSources.map((source) => `- ${source}`).join('\n')
            : '- (none)';

    return [
        '# Data Enrichment Task',
        '',
        '## Target',
        `- ID: ${task.targetId}`,
        `- Label: ${task.targetLabel}`,
        '',
        '## Recommended fields',
        fields,
        '',
        '## Suggested sources',
        sources,
        '',
        '## Reason',
        task.title,
        '',
        '## Status',
        DATA_TASK_STATUS_LABELS[task.status],
        '',
        `Created: ${task.createdAt}`,
    ]
        .filter(Boolean)
        .join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// composable
// ─────────────────────────────────────────────────────────────────────────────

export interface UseInsightWorkflowResult {
    /** 미기록 인사이트는 'new' */
    getStatus: (id: string) => InsightWorkflowStatus;
    setStatus: (id: string, s: InsightWorkflowStatus) => void;
    statusById: Readonly<Ref<Record<string, InsightWorkflowEntry>>>;
    dataTasks: Readonly<Ref<DataTask[]>>;
    /** enrichment 카드가 아니면 null. 생성 시 'action_created' 전이 + 신규를 앞에 prepend(중복 허용). */
    createTaskFromInsight: (card: InsightCard) => DataTask | null;
    updateTaskStatus: (taskId: string, s: DataTaskStatus) => void;
    openTaskCount: ComputedRef<number>;
    /** 그래프/소스 교체 시 전체 초기화(FR-025/026) */
    reset: () => void;
}

export function useInsightWorkflow(): UseInsightWorkflowResult {
    // 항상 불변 교체(setStatus/create/update가 새 객체·배열 할당) — shallowRef로 충분,
    // 태스크 객체 참조 동일성 보존(깊은 프록시 래핑 없음)
    const statusById = shallowRef<Record<string, InsightWorkflowEntry>>({});
    const dataTasks = shallowRef<DataTask[]>([]);
    let taskSeq = 0;

    function getStatus(id: string): InsightWorkflowStatus {
        return statusById.value[id]?.status ?? 'new';
    }

    function setStatus(id: string, s: InsightWorkflowStatus): void {
        statusById.value = {
            ...statusById.value,
            [id]: { status: s, updatedAt: new Date().toISOString() },
        };
    }

    /** 샘플 createDataTask 동등 — enrichment 카드에서만 태스크 생성. */
    function createTaskFromInsight(card: InsightCard): DataTask | null {
        if (card.category !== 'enrichment') return null;

        taskSeq += 1;
        const targetLabel = extractTargetLabelFromTitle(card.title);
        const task: DataTask = {
            id: `task-${card.id}-${taskSeq}`,
            insightId: card.id,
            title: `Data enrichment: ${targetLabel}`,
            targetId: extractEnrichmentTargetId(card.id),
            targetLabel,
            recommendedFields: getEnrichmentFieldList(card),
            suggestedSources: getEnrichmentSourceList(card),
            status: 'open',
            createdAt: new Date().toISOString(),
        };

        dataTasks.value = [task, ...dataTasks.value];
        setStatus(card.id, 'action_created');
        return task;
    }

    function updateTaskStatus(taskId: string, s: DataTaskStatus): void {
        dataTasks.value = dataTasks.value.map((task) =>
            task.id === taskId ? { ...task, status: s } : task
        );
    }

    const openTaskCount = computed<number>(
        () => dataTasks.value.filter((task) => task.status === 'open').length
    );

    function reset(): void {
        statusById.value = {};
        dataTasks.value = [];
        taskSeq = 0;
    }

    return {
        getStatus,
        setStatus,
        statusById,
        dataTasks,
        createTaskFromInsight,
        updateTaskStatus,
        openTaskCount,
        reset,
    };
}

export type UseInsightWorkflow = ReturnType<typeof useInsightWorkflow>;
