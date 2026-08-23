/**
 * SolutionProposalGenerator — 확정된 이슈(PI Flag)별 복수 솔루션 옵션을 AI로 제안.
 *
 * qdrantChat(LLM + eTOM RAG)에 구조화 프롬프트를 보내 JSON 배열을 받아오고,
 * SolutionOption 스키마로 정규화한다. (요구사항: AI 자동 제안 + 사용자 CRUD)
 */
import { createSolution, SOLUTION_TYPES } from '@/composables/blueprint/blueprintModel';
import { parseJsonLoose, coerceArray, readAnswerText } from './blueprintAiUtils';

const VALID_TYPES = SOLUTION_TYPES.map((t) => t.value);
const VALID_EFFORT = ['low', 'medium', 'high'];
const VALID_CONFIDENCE = ['low', 'medium', 'high'];

function normalizeType(raw) {
    const up = String(raw || '')
        .toUpperCase()
        .replace(/[\s-]+/g, '_');
    if (VALID_TYPES.includes(up)) return up;
    // 흔한 동의어 매핑
    if (/API/.test(up)) return 'API_INTEGRATION';
    if (/RPA|BOT/.test(up)) return 'RPA';
    if (/REDESIGN|REENG|재설계|PROCESS/.test(up)) return 'PROCESS_REDESIGN';
    if (/MANUAL|자동화/.test(up)) return 'MANUAL_AUTOMATION';
    if (/SYSTEM|시스템/.test(up)) return 'SYSTEM_ENHANCEMENT';
    if (/OUTSOURC|아웃소싱|위탁/.test(up)) return 'OUTSOURCING';
    return 'OTHER';
}

function pick(list, value, fallback) {
    const v = String(value || '').toLowerCase();
    return list.includes(v) ? v : fallback;
}

function buildPrompt({ issue, processName, count, hasXml }) {
    const enumList = SOLUTION_TYPES.map((t) => `${t.value}(${t.label})`).join(', ');
    const context = {
        process: processName || '',
        issue: {
            title: issue?.title || '',
            description: issue?.description || '',
            flag_type: issue?.flag_type || '',
            target_task: issue?.source_element_name || ''
        }
    };
    return [
        '당신은 통신사 프로세스 혁신(PI) 컨설턴트입니다.',
        'eTOM 25 RAG 지식과 아래 BPMN/이슈 컨텍스트를 참고하여, 주어진 개선 이슈를 해결할',
        `서로 다른 접근의 솔루션 옵션 ${count}개를 제안하세요.`,
        '각 옵션은 가능한 한 다른 solution_type 을 사용하고, 현실적인 ROI 추정을 포함합니다.',
        '',
        `solution_type 은 다음 코드 중 하나여야 합니다: ${enumList}`,
        'expected_impact.cost_delta 는 "연간 비용 변화(원, KRW)"이며 절감이면 음수입니다.',
        'expected_impact.fte_delta 는 "FTE(인력) 변화"이며 절감이면 음수입니다.',
        'implementation_effort 는 low|medium|high, confidence 는 low|medium|high 입니다.',
        '',
        '반드시 아래 형식의 JSON 배열만 ```json 코드펜스로 출력하세요. 다른 설명 금지.',
        '```json',
        '[',
        '  {',
        '    "solution_type": "RPA",',
        '    "title": "...",',
        '    "description": "...",',
        '    "pros": "...",',
        '    "cons": "...",',
        '    "implementation_effort": "medium",',
        '    "expected_impact": { "cost_delta": -12000000, "fte_delta": -0.5, "timeline_months": 3, "confidence": "medium" }',
        '  }',
        ']',
        '```',
        '',
        hasXml ? '(BPMN XML 은 함께 첨부됩니다.)' : '',
        '컨텍스트(JSON):',
        JSON.stringify(context, null, 2)
    ]
        .filter(Boolean)
        .join('\n');
}

function mapToSolution(raw) {
    const impact = raw?.expected_impact || raw?.impact || {};
    return createSolution({
        solution_type: normalizeType(raw?.solution_type || raw?.type),
        title: String(raw?.title || raw?.name || '솔루션 옵션').slice(0, 200),
        description: String(raw?.description || raw?.desc || ''),
        pros: String(raw?.pros || raw?.benefit || ''),
        cons: String(raw?.cons || raw?.risk || ''),
        implementation_effort: pick(VALID_EFFORT, raw?.implementation_effort || raw?.effort, 'medium'),
        expected_impact: {
            cost_delta: Number(impact.cost_delta ?? impact.cost ?? 0) || 0,
            fte_delta: Number(impact.fte_delta ?? impact.fte ?? 0) || 0,
            timeline_months: impact.timeline_months != null ? Number(impact.timeline_months) : undefined,
            confidence: pick(VALID_CONFIDENCE, impact.confidence, 'medium')
        },
        ai_generated: true
    });
}

/**
 * 이슈 하나에 대한 솔루션 옵션 배열을 AI로 생성.
 * @param {any} backend
 * @param {{ issue: any, processName?: string, bpmnXml?: string, count?: number, sessionId?: string }} [params]
 * @returns {Promise<import('@/composables/blueprint/blueprintModel').SolutionOption[]>}
 */
export async function proposeSolutions(backend, params = {}) {
    const { issue, processName = '', bpmnXml = '', count = 3, sessionId } = params;
    if (!backend || typeof backend.qdrantChat !== 'function') {
        throw new Error('backend.qdrantChat 를 사용할 수 없습니다.');
    }
    const safeCount = Math.min(4, Math.max(2, Number(count) || 3));
    const message = buildPrompt({ issue, processName, count: safeCount, hasXml: !!bpmnXml });

    const response = await backend.qdrantChat({
        message,
        xml: bpmnXml || undefined,
        sessionId
    });

    const text = readAnswerText(response);
    const parsed = parseJsonLoose(text);
    const arr = coerceArray(parsed)
        .filter((x) => x && (x.title || x.solution_type || x.type))
        .map(mapToSolution);

    if (!arr.length) {
        throw new Error('AI 솔루션 제안 결과를 해석하지 못했습니다.');
    }
    return arr.slice(0, safeCount);
}
