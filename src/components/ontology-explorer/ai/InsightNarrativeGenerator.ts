/**
 * InsightNarrativeGenerator — 결정론 InsightCard 에 대한 온디맨드 AI 자연어 해설 생성.
 *
 * 기존 SpofReasoningGenerator 를 카드 단위로 일반화한 구현
 * (specs/002-process-kg-integration/contracts/ai-narrative.contract.md).
 *
 *  - BackendFactory.createBackend().qdrantChat 전용(SSE 스트림을 내부에서 재조립) —
 *    **완료 후 일괄 반환**한다. UI 스트리밍이 아니다.
 *  - 프롬프트 입력은 결정론 분석 결과만: 카드의 title/answer/score/scoreBreakdown/
 *    metrics/reasons + 근거 노드/관계 라벨. 그래프 원본 전체 투입 금지.
 *  - 실패(백엔드 불가/빈 응답) 시 throw — mock/빈 문자열 대체 금지(FR-021).
 *    호출측은 결정론 카드 내용을 유지하고 재시도 UI를 제공한다.
 *  - 온디맨드 1건 생성 전용(자동 일괄 생성 금지). 캐시는 호출측(card.narrative) 책임.
 */
import BackendFactory from '@/components/api/BackendFactory';
import { readAnswerText } from '@/components/ai/blueprintAiUtils';
import type { InsightCard } from '@/lib/processKg/analysis/types';

export interface InsightNarrativeContext {
    graphSummary: { nodeCount: number; edgeCount: number; sourceLabel: string };
    /** ID→라벨 해석 결과 (근거 노드 ≤25 / 근거 관계 ≤40) */
    evidenceLabels: { nodes: string[]; edges: string[] };
}

function buildPrompt(card: InsightCard, ctx: InsightNarrativeContext): string {
    // 결정론 카드 필드만 발췌 — evidence ID 목록·markdown 등 원본 데이터는 투입하지 않는다.
    const cardPayload = {
        category: card.category,
        title: card.title,
        question: card.question,
        answer: card.answer,
        severity: card.severity,
        score: card.score,
        scoreBreakdown: card.scoreBreakdown,
        metrics: card.metrics,
        reasons: card.reasons
    };
    return [
        '당신은 전사 프로세스 지식그래프의 결정론 분석 결과를 경영진/아키텍트에게 해설하는 전문가입니다.',
        `대상 그래프: ${ctx.graphSummary.sourceLabel} (노드 ${ctx.graphSummary.nodeCount}개, 엣지 ${ctx.graphSummary.edgeCount}개)`,
        '',
        '아래는 그래프 지표 기반 결정론 분석으로 산출된 인사이트 카드와 그 근거 요소 라벨입니다.',
        '이 자료만을 근거로 한국어 자연어 해설을 작성하세요.',
        '',
        '반드시 지킬 제약:',
        '- 제공된 카드 필드와 근거 라벨에 없는 사실을 만들어내지 마세요(근거 밖 사실 생성 금지).',
        '- 그래프 자체를 변형하거나 새로운 노드/관계의 존재를 가정하지 마세요.',
        '- "반드시 ~하라" 같은 단정적 최종 판단을 내리지 마세요 — 이 카드는 "검토 후보"이며, 검증이 필요한 가설로 프레이밍하세요.',
        '- 응답은 한국어 자연어 텍스트만 작성하세요(JSON/코드펜스 불필요), 2~4문단 이내.',
        '',
        '인사이트 카드(결정론 분석 결과):',
        JSON.stringify(cardPayload, null, 2),
        '',
        '근거 노드 라벨:',
        JSON.stringify(ctx.evidenceLabels.nodes),
        '근거 관계 라벨:',
        JSON.stringify(ctx.evidenceLabels.edges)
    ].join('\n');
}

/**
 * 카드 1건에 대한 AI 내러티브 생성 — 사용자가 카드에서 AI 해설을 요청할 때 호출.
 * qdrantChat SSE 응답을 재조립해 완료 후 자연어 텍스트를 일괄 반환한다(스트리밍 아님).
 * 응답은 자연어 텍스트이므로 JSON 파싱을 강제하지 않고 readAnswerText 로만 추출한다.
 */
export async function generateInsightNarrative(
    card: InsightCard,
    ctx: InsightNarrativeContext
): Promise<string> {
    const backend = BackendFactory.createBackend() as {
        qdrantChat?: (payload: { message: string }) => Promise<unknown>;
    };
    if (!backend || typeof backend.qdrantChat !== 'function') {
        throw new Error('backend.qdrantChat 를 사용할 수 없습니다.');
    }

    const message = buildPrompt(card, ctx);
    const response = await backend.qdrantChat({ message });
    const text = String(readAnswerText(response) || '').trim();

    if (!text) {
        throw new Error('AI 내러티브 응답이 비어 있습니다.');
    }
    return text;
}
