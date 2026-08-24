/**
 * AnGapGenerator — 확정된 블록별로 Process / Data / Automation Gap 을 AI로 진단.
 *
 * AN Transformation Studio 2단계(Gap Triage). eTOM 표준 + 사내 감사(Audit) 룰셋 관점에서
 * 블록별 이슈 카드를 JSON 으로 받아 GapCard 로 정규화한다. (실시간 LLM 전용)
 */
import { createGapCard } from '@/composables/blueprint/blueprintModel';
import { parseJsonLoose, readAnswerText } from './blueprintAiUtils';

const VALID_CATEGORY = ['PROCESS', 'DATA', 'AUTOMATION'];
const VALID_SEVERITY = ['low', 'medium', 'high'];

function pickArray(parsed) {
    if (!parsed) return [];
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed.gaps)) return parsed.gaps;
    if (Array.isArray(parsed.issues)) return parsed.issues;
    if (Array.isArray(parsed.items)) return parsed.items;
    return [];
}

function normalizeCategory(raw) {
    const up = String(raw || '')
        .toUpperCase()
        .replace(/[\s-]+/g, '_');
    if (VALID_CATEGORY.includes(up)) return up;
    if (/PROC|프로세스|흐름/.test(up)) return 'PROCESS';
    if (/DATA|데이터|정보/.test(up)) return 'DATA';
    if (/AUTO|자동|RPA|API/.test(up)) return 'AUTOMATION';
    return 'PROCESS';
}

function buildPrompt({ processName, partitions, piFlags }) {
    const context = {
        process: processName || '',
        blocks: (partitions || []).map((p) => ({
            id: p.id,
            name: p.name,
            etom_l3: p.etom_l3,
            tasks: (p.tasks || []).map((t) => t.name)
        }))
    };
    const flagLines = (piFlags || [])
        .filter((f) => f && (f.description || f.type))
        .map((f) => {
            const head = `- [${f.elementName || f.elementId}]`;
            const meta = `(${f.type || '미분류'}/${f.status === 'resolved' ? '즉시 개선' : '향후 과제'})`;
            return `${head} ${meta} ${f.description || ''}`.trim();
        });
    return [
        '당신은 통신사 프로세스 혁신(PI) 감사(Audit) 전문가입니다.',
        'eTOM 표준 및 사내 감사 룰셋 관점에서, 아래 확정된 논리 블록들의 As-Is 흐름을 진단하여',
        'Gap(개선 이슈)을 도출하세요. 각 Gap 은 반드시 다음 3가지 분류 중 하나입니다:',
        '- PROCESS: 비효율적/위험한 업무 흐름, 수작업 의존, 병목, 통제 부재',
        '- DATA: 데이터 정합성/수기 입력/단절/추적성 문제',
        '- AUTOMATION: 자동화(API/RPA/AI) 적용 가능 지점',
        '각 블록당 1~3개, 전체적으로 의미있는 Gap 만 제시하고, severity(low|medium|high)와 개선 권고(recommendation)를 포함합니다.',
        'partition_name 은 위 블록의 name 과 정확히 일치시키세요.',
        ...(flagLines.length
            ? [
                  '',
                  '현업이 캔버스 요소에 직접 등록한 PI Flag(개선 포인트)입니다. 이 항목들을 우선적인 근거로 삼아',
                  '해당 요소가 속한 블록의 Gap 으로 반영하거나 구체화하세요:',
                  ...flagLines
              ]
            : []),
        '',
        '반드시 아래 형식의 JSON 객체만 ```json 코드펜스로 출력하세요. 다른 설명 금지.',
        '```json',
        '{',
        '  "gaps": [',
        '    {',
        '      "category": "AUTOMATION",',
        '      "partition_name": "현장 위험 식별",',
        '      "title": "...",',
        '      "description": "...",',
        '      "severity": "high",',
        '      "recommendation": "..."',
        '    }',
        '  ]',
        '}',
        '```',
        '',
        '컨텍스트(JSON):',
        JSON.stringify(context, null, 2)
    ].join('\n');
}

function mapGap(raw, partitions) {
    const pname = String(raw?.partition_name || raw?.block || raw?.partition || '');
    const match = (partitions || []).find((p) => p.name === pname);
    return createGapCard({
        category: normalizeCategory(raw?.category || raw?.type),
        title: String(raw?.title || raw?.name || '개선 이슈').slice(0, 200),
        description: String(raw?.description || raw?.desc || ''),
        partition_id: match ? match.id : null,
        partition_name: match ? match.name : pname,
        severity: VALID_SEVERITY.includes(String(raw?.severity).toLowerCase()) ? String(raw?.severity).toLowerCase() : 'medium',
        recommendation: String(raw?.recommendation || raw?.remediation || raw?.fix || ''),
        triage: 'pending'
    });
}

/**
 * 블록별 Gap 카드 생성.
 * @param {any} backend
 * @param {{ asIsXml?: string, processName?: string, partitions: any[], piFlags?: any[], sessionId?: string }} [params]
 * @returns {Promise<import('@/composables/blueprint/blueprintModel').GapCard[]>}
 */
export async function analyzeGaps(backend, params = {}) {
    const { asIsXml = '', processName = '', partitions = [], piFlags = [], sessionId } = params;
    if (!backend || typeof backend.qdrantChat !== 'function') {
        throw new Error('backend.qdrantChat 를 사용할 수 없습니다.');
    }
    const message = buildPrompt({ processName, partitions, piFlags });
    const response = await backend.qdrantChat({ message, xml: asIsXml || undefined, sessionId });
    const text = readAnswerText(response);
    const parsed = parseJsonLoose(text);
    const arr = pickArray(parsed)
        .filter((x) => x && (x.title || x.description))
        .map((x) => mapGap(x, partitions));

    if (!arr.length) {
        throw new Error('AI Gap 진단 결과를 해석하지 못했습니다.');
    }
    return arr.slice(0, 24);
}
