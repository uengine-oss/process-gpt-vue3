/**
 * AnGapToPiFlagGenerator — As-Is 도면의 이슈 요소를 AI로 진단해 PI Flag 초안을 생성.
 *
 * 기존 AnGapGenerator(블록 단위 GapCard)와 달리, 순서도 화면의 PI Flag 시스템에 맞춰
 * "이슈가 있는 개별 요소(activity/gateway/event)" 단위로 진단 결과를 반환한다.
 * 각 결과는 element_id 로 BPMN 요소에 매핑되며, 매핑 불가/프로세스 전반 이슈는
 * element 없는(프로세스 레벨) PI Flag 로 반환된다. (실시간 LLM 전용)
 */
import { parseJsonLoose, readAnswerText } from './blueprintAiUtils';

const VALID_CATEGORY = ['PROCESS', 'DATA', 'AUTOMATION'];

function pickArray(parsed) {
    if (!parsed) return [];
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed.flags)) return parsed.flags;
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

/** title/problem/improvement 본문에서 노출되면 안 되는 raw element id(UserTask_* 등) 제거(방어). */
function stripElementIds(text) {
    return String(text || '')
        .replace(
            /\b(?:UserTask|ServiceTask|ScriptTask|ManualTask|Task|Activity|Gateway|Event|StartEvent|EndEvent|Flow|SubProcess|CallActivity)_[A-Za-z0-9]+\b/g,
            ''
        )
        .replace(/\s{2,}/g, ' ')
        .trim();
}

function buildPrompt({ processName, elements, existingFlags }) {
    const context = {
        process: processName || '',
        elements: (elements || []).map((e) => ({ id: e.id, name: e.name, type: e.type }))
    };
    const flagLines = (existingFlags || [])
        .filter((f) => f && (f.problem || f.description || f.title))
        .map((f) => {
            const head = `- [${f.elementName || f.elementId || '프로세스'}]`;
            return `${head} ${f.title || ''} ${f.problem || f.description || ''}`.trim();
        });
    return [
        '당신은 통신사 프로세스 혁신(PI) 감사(Audit) 전문가입니다.',
        'eTOM 표준 및 사내 감사 룰셋 관점에서, 아래 As-Is BPMN 도면을 진단하여 개선이 필요한',
        '개별 요소(activity/gateway/event)를 식별하고 각 요소에 대한 PI Flag(개선 이슈)를 도출하세요.',
        '',
        '각 PI Flag 은 반드시 다음 중 하나의 category 를 가집니다:',
        '- PROCESS: 비효율적/위험한 업무 흐름, 수작업 의존, 병목, 통제 부재',
        '- DATA: 데이터 정합성/수기 입력/단절/추적성 문제',
        '- AUTOMATION: 자동화(API/RPA/AI) 적용 가능 지점',
        '',
        '규칙:',
        '- element_ids 에는 이슈(Gap)가 있는 캔버스 요소(activity/gateway/event)의 id 를 배열로 넣으세요. 하나의 이슈가 여러 요소에 걸쳐 있으면 관련 요소 id 를 모두 포함하세요.',
        '- element_ids 의 각 id 는 반드시 위 elements 목록의 id 와 정확히 일치시키세요. 특정 요소에 귀속되지 않는 프로세스 전반의 이슈는 element_ids 를 빈 배열([])로 두세요.',
        '- 의미있는 이슈만 제시하세요. 도면 규모에 따라 3~12개 정도가 적절합니다.',
        '- 각 항목은 title(제목), problem(문제점), improvement(개선방향)을 분리해서 작성하세요.',
        '- 매우 중요: title/problem/improvement 본문에는 절대로 "UserTask_xxx", "Gateway_xxx", "Activity_xxx" 같은 내부 요소 ID 를 쓰지 마세요. 사람이 읽는 업무 용어와 요소 이름(name)만 사용하세요. 요소 매핑은 별도 element_ids 필드로만 표현합니다.',
        ...(flagLines.length ? ['', '현업이 이미 등록한 PI Flag 입니다. 중복을 피하고, 관련 이슈는 구체화/보강하세요:', ...flagLines] : []),
        '',
        '반드시 아래 형식의 JSON 객체만 ```json 코드펜스로 출력하세요. 다른 설명 금지.',
        '```json',
        '{',
        '  "flags": [',
        '    {',
        '      "element_ids": ["Activity_1a2b3c", "Gateway_0d4e5f"],',
        '      "category": "AUTOMATION",',
        '      "title": "수기 승인 대기 구간 자동화",',
        '      "problem": "승인 단계가 담당자 수기 확인에 의존하여 평균 대기시간이 길고 추적이 어렵습니다.",',
        '      "improvement": "규칙 기반 자동 승인 + 예외 건만 담당자 라우팅으로 전환합니다."',
        '    }',
        '  ]',
        '}',
        '```',
        '',
        '컨텍스트(JSON):',
        JSON.stringify(context, null, 2)
    ].join('\n');
}

function mapFlag(raw, elementsById) {
    // element_ids(신규, 배열) 우선 — 구버전 단수 element_id 응답도 호환 처리.
    const rawIds = Array.isArray(raw?.element_ids)
        ? raw.element_ids
        : Array.isArray(raw?.elementIds)
        ? raw.elementIds
        : [raw?.element_id || raw?.elementId || raw?.id];
    const matchedList = [];
    const seen = new Set();
    for (const rid of rawIds) {
        const id = String(rid || '').trim();
        if (!id || seen.has(id) || !elementsById.has(id)) continue;
        seen.add(id);
        matchedList.push(elementsById.get(id));
    }
    const problem = stripElementIds(raw?.problem || raw?.description || raw?.desc || '');
    return {
        // 단수 필드는 하위 호환(줌 이동·기존 UI)용 — 다중 매핑은 elementIds/elementNames 로 전달.
        elementId: matchedList.length ? matchedList[0].id : '',
        elementName: matchedList.length ? matchedList[0].name : '',
        elementIds: matchedList.map((m) => m.id),
        elementNames: matchedList.map((m) => m.name),
        category: normalizeCategory(raw?.category || raw?.type),
        title: stripElementIds(raw?.title || raw?.name || '개선 이슈').slice(0, 200),
        problem,
        improvement: stripElementIds(raw?.improvement || raw?.recommendation || raw?.fix || '')
    };
}

/**
 * As-Is 도면에서 이슈 요소를 진단해 PI Flag 초안 배열을 생성.
 * 각 초안은 이슈가 걸친 캔버스 요소들(elementIds)을 함께 보유한다 (없으면 프로세스 전반 이슈).
 * @param {any} backend
 * @param {{ asIsXml: string, processName?: string, elements: {id:string,name:string,type:string}[], existingFlags?: any[], sessionId?: string }} params
 * @returns {Promise<{elementId:string,elementName:string,elementIds:string[],elementNames:string[],category:string,title:string,problem:string,improvement:string}[]>}
 */
export async function analyzeGapsToPiFlags(backend, params = {}) {
    const { asIsXml = '', processName = '', elements = [], existingFlags = [], sessionId } = params;
    if (!backend || typeof backend.qdrantChat !== 'function') {
        throw new Error('backend.qdrantChat 를 사용할 수 없습니다.');
    }
    if (!elements.length) {
        throw new Error('진단할 요소가 없습니다. 도면을 확인하세요.');
    }
    const elementsById = new Map(elements.map((e) => [String(e.id), e]));
    const message = buildPrompt({ processName, elements, existingFlags });
    const response = await backend.qdrantChat({ message, xml: asIsXml || undefined, sessionId });
    const text = readAnswerText(response);
    const parsed = parseJsonLoose(text);
    const arr = pickArray(parsed)
        .filter((x) => x && (x.title || x.problem || x.description))
        .map((x) => mapFlag(x, elementsById));

    if (!arr.length) {
        throw new Error('AI Gap 진단 결과를 해석하지 못했습니다.');
    }
    return arr.slice(0, 30);
}
