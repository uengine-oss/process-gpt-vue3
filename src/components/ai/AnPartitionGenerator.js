/**
 * AnPartitionGenerator — As-Is 도면을 eTOM L3 기준 논리 블록으로 자동 구획(Partitioning).
 *
 * AN Transformation Studio 1단계. qdrantChat(LLM + eTOM RAG)에 활동 목록(요소 ID 포함) + BPMN XML 을
 * 보내 2~4개의 논리 블록과 분류 근거(reasoning), eTOM L3 Process ID 를 JSON 으로 받아 PartitionBlock 으로
 * 정규화한다. (실시간 LLM 전용 — 실패 시 throw, mock fallback 없음)
 *
 * 각 블록은 (a) eTOM L3 Process ID/이름, (b) 그 블록에 속한 캔버스 요소 ID(element_ids) 를 함께 보유한다.
 * element_ids 는 2단계(Group 박스 시각화/이동)·3단계(Call Activity 모듈화 추출)의 기준이 된다.
 *
 * eTOM L3 분류와 TMF Open API 코드 판단은 사내 TMF MCP(TM Forum 공식 지식베이스) 검색 결과를
 * 최우선 근거로 사용한다(backend.tmfKbSearch → 프롬프트 그라운딩). MCP 미설정/실패 시에는
 * 기존처럼 qdrantChat(LLM + eTOM RAG) 지식으로 판단한다.
 */
import { createPartition, splitTmfCodes } from '@/composables/blueprint/blueprintModel';
import { fetchTmfKbContext } from '@/utils/tmfKb';
import { parseJsonLoose, readAnswerText } from './blueprintAiUtils';

function pickArray(parsed, key) {
    if (!parsed) return [];
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed[key])) return parsed[key];
    if (Array.isArray(parsed.blocks)) return parsed.blocks;
    if (Array.isArray(parsed.items)) return parsed.items;
    return [];
}

/** 이름 매칭용 정규화 (공백 정리 + 소문자). */
function normName(s) {
    return String(s || '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

function buildPrompt({ processName, activities, tmfContext = '' }) {
    const context = {
        process: processName || '',
        // 각 활동의 정확한 BPMN 요소 id 를 함께 제공 → AI 가 블록 배정 시 동일 id 를 그대로 반환하도록 유도.
        as_is_activities: activities.map((a) => ({ id: a.id, name: a.name }))
    };
    const groundingLines = tmfContext
        ? [
              '',
              '아래 [TMF MCP 검색 결과]는 사내 TM Forum 공식 지식베이스(MCP)에서 검색한 결과입니다.',
              'eTOM L3 분류(etom_l3/etom_process_id/etom_candidates)와 TMF Open API 코드(tmf)는',
              '이 검색 결과를 최우선 근거로 판단하고, 검색 결과에서 확인되지 않는 값만 일반 지식으로 보완합니다.',
              '',
              '[TMF MCP 검색 결과]',
              tmfContext
          ]
        : [];
    return [
        '당신은 통신사 프로세스 혁신(PI) eTOM 아키텍트입니다.',
        '아래 As-Is 활동 목록(각 활동의 BPMN 요소 id 포함)과 첨부된 BPMN XML 을 분석하여, 복잡하게 얽힌',
        '현행 업무를 eTOM L3 카테고리 기준의 논리 블록(Block) 2~4개로 구획(Partitioning)하세요.',
        '각 블록은 의미적으로 응집된 활동들을 묶고, 왜 이 eTOM L3 로 분류했는지 근거(reasoning)를 한 문장으로 제시합니다.',
        '각 블록에는 매핑된 eTOM L3 Process ID(예: "1.5.10.3")를 etom_process_id 에 넣고, 알 수 없으면 빈 문자열로 둡니다.',
        '각 블록의 etom_candidates 에는 유력한 eTOM L3 매핑 후보를 확신도가 높은 순으로 2~3개 나열합니다.',
        '각 후보는 etom_l3(카테고리명)·etom_process_id(Process ID, 모르면 빈 문자열)·reason(한 문장 근거)을 가지며,',
        '1순위 후보는 블록의 etom_l3/etom_process_id 와 동일해야 합니다. 확실한 후보가 하나뿐이면 1개만 넣습니다.',
        '각 활동(task)에는 위 목록에서 받은 동일한 id 를 반드시 그대로 복사해 넣고, tmf 에는 관련된 TMF Open API 코드를 배열로 모두 넣습니다',
        '(예: ["TMF641"], 여러 개면 ["TMF641", "TMF645"], 불명확하면 ["TMF XXX"]). 한 활동이 여러 API 와 연동되면 빠짐없이 나열합니다.',
        '한 활동은 하나의 블록에만 배정합니다.',
        '',
        '반드시 아래 형식의 JSON 객체만 ```json 코드펜스로 출력하세요. 다른 설명 금지.',
        '```json',
        '{',
        '  "partitions": [',
        '    {',
        '      "name": "현장 위험 식별",',
        '      "name_en": "Risk Identification",',
        '      "etom_l3": "Service Problem Management",',
        '      "etom_process_id": "1.5.10.3",',
        '      "etom_candidates": [',
        '        { "etom_l3": "Service Problem Management", "etom_process_id": "1.5.10.3", "reason": "..." },',
        '        { "etom_l3": "Service Quality Management", "etom_process_id": "1.5.11.1", "reason": "..." }',
        '      ],',
        '      "reasoning": "...",',
        '      "tasks": [ { "id": "Activity_0abc12", "name": "현장 방문 일정 스케줄링한다", "tmf": ["TMF641", "TMF645"] } ]',
        '    }',
        '  ]',
        '}',
        '```',
        ...groundingLines,
        '',
        '컨텍스트(JSON):',
        JSON.stringify(context, null, 2)
    ].join('\n');
}

/** LLM 이 돌려준 eTOM L3 후보 목록을 정규화(중복 제거, 최대 4개). */
function mapEtomCandidates(raw) {
    const list = Array.isArray(raw?.etom_candidates)
        ? raw.etom_candidates
        : Array.isArray(raw?.etomCandidates)
        ? raw.etomCandidates
        : Array.isArray(raw?.candidates)
        ? raw.candidates
        : [];
    const out = [];
    for (const c of list) {
        const etom_l3 = String(c?.etom_l3 || c?.etomL3 || c?.name || '')
            .slice(0, 160)
            .trim();
        const etom_process_id = String(c?.etom_process_id || c?.etomProcessId || c?.process_id || '')
            .slice(0, 60)
            .trim();
        const reason = String(c?.reason || c?.reasoning || '')
            .slice(0, 300)
            .trim();
        if (!etom_l3 && !etom_process_id) continue;
        const dup = out.some(
            (x) => (etom_process_id && x.etom_process_id === etom_process_id) || (!etom_process_id && x.etom_l3 === etom_l3)
        );
        if (dup) continue;
        out.push({ etom_l3, etom_process_id, reason });
    }
    return out.slice(0, 4);
}

/**
 * LLM 이 돌려준 블록 1개를 PartitionBlock 으로 정규화.
 * task 의 id 는 (1) AI 가 반환한 요소 id 가 실제 As-Is 요소이면 그대로, (2) 아니면 활동명으로 역매칭,
 * (3) 둘 다 실패하면 합성 id(createPartition 내부). element_ids 는 createPartition 이 task id 에서 파생.
 */
function mapPartition(raw, byId, byName) {
    const tasks = Array.isArray(raw?.tasks) ? raw.tasks : [];
    let etomL3 = String(raw?.etom_l3 || raw?.etomL3 || raw?.etom || '').slice(0, 160);
    let etomProcessId = String(raw?.etom_process_id || raw?.etomProcessId || raw?.etom_id || raw?.process_id || '').slice(0, 60);
    const reasoning = String(raw?.reasoning || raw?.reason || raw?.rationale || '');
    let etomCandidates = mapEtomCandidates(raw);
    // 대표 매핑과 후보 목록의 정합: 대표가 비면 1순위 후보로 채우고, 대표가 후보에 없으면 1순위로 끼워 넣는다.
    if (!etomL3 && !etomProcessId && etomCandidates.length) {
        etomL3 = etomCandidates[0].etom_l3;
        etomProcessId = etomCandidates[0].etom_process_id;
    } else if (etomL3 || etomProcessId) {
        const hasPrimary = etomCandidates.some(
            (c) => (etomProcessId && c.etom_process_id === etomProcessId) || (etomL3 && c.etom_l3 === etomL3)
        );
        if (!hasPrimary) {
            etomCandidates = [
                { etom_l3: etomL3, etom_process_id: etomProcessId, reason: reasoning.slice(0, 300).trim() },
                ...etomCandidates
            ].slice(0, 4);
        }
    }
    return createPartition({
        name: String(raw?.name || raw?.title || '논리 블록').slice(0, 120),
        name_en: String(raw?.name_en || raw?.nameEn || raw?.english || '').slice(0, 120),
        etom_l3: etomL3,
        etom_process_id: etomProcessId,
        etom_candidates: etomCandidates,
        reasoning,
        tasks: tasks
            .map((t) => {
                const name = typeof t === 'string' ? t : t?.name || t?.title || '';
                const rawId = typeof t === 'object' ? t?.id || t?.element_id || t?.elementId || '' : '';
                // tmf 는 문자열("TMF641")·콤마 문자열("TMF641, TMF645")·배열 모두 수용 → 콤마 결합 문자열로 정규화.
                const tmfCodes = typeof t === 'object' ? splitTmfCodes(t?.tmf ?? t?.tmf_code ?? t?.tmf_apis) : [];
                // 요소 id 복원: AI 가 준 id 가 실제 요소면 채택, 아니면 이름으로 역매칭.
                const resolvedId = (rawId && byId.has(rawId) && rawId) || byName.get(normName(name)) || '';
                return { id: resolvedId, name: String(name).slice(0, 200), tmf: tmfCodes.length ? tmfCodes.join(', ') : 'TMF XXX' };
            })
            .filter((t) => t.name)
    });
}

/**
 * As-Is 를 논리 블록으로 구획.
 * @param {any} backend
 * @param {{ asIsXml: string, processName?: string, activities?: {id:string,name:string,type?:string}[], taskNames?: string[], sessionId?: string }} [params]
 *   activities: extractTasksFromXml 결과(id 포함, 권장). taskNames: 구버전 호환(이름만).
 * @returns {Promise<import('@/composables/blueprint/blueprintModel').PartitionBlock[]>}
 */
export async function partitionAsIs(backend, params = {}) {
    const { asIsXml = '', processName = '', activities, taskNames = [], sessionId } = params;
    if (!backend || typeof backend.qdrantChat !== 'function') {
        throw new Error('backend.qdrantChat 를 사용할 수 없습니다.');
    }
    // activities(id 포함) 우선, 없으면 taskNames(이름만)로 폴백.
    const acts =
        Array.isArray(activities) && activities.length
            ? activities.map((a) => ({ id: String(a?.id || ''), name: String(a?.name || a?.id || '') }))
            : (taskNames || []).map((n) => ({ id: '', name: String(n || '') }));

    const byId = new Set(acts.map((a) => a.id).filter(Boolean));
    const byName = new Map();
    for (const a of acts) {
        const key = normName(a.name);
        if (key && a.id && !byName.has(key)) byName.set(key, a.id);
    }

    // eTOM L3/TMF API 판단 근거: 사내 TMF MCP 검색 결과(공식 지식베이스). 실패/미설정 시 '' → 기존 동작.
    const tmfContext = await fetchTmfKbContext(
        backend,
        [processName, ...acts.map((a) => a.name)].filter(Boolean).join(', '),
        { categories: ['etom', 'tmf_api'], topK: 5 }
    );

    const message = buildPrompt({ processName, activities: acts, tmfContext });
    const response = await backend.qdrantChat({ message, xml: asIsXml || undefined, sessionId });
    const text = readAnswerText(response);
    const parsed = parseJsonLoose(text);
    const arr = pickArray(parsed, 'partitions')
        .filter((x) => x && (x.name || x.title || (Array.isArray(x.tasks) && x.tasks.length)))
        .map((raw) => mapPartition(raw, byId, byName))
        .filter((p) => p.tasks.length || p.name);

    if (!arr.length) {
        throw new Error('AI 블록 파티셔닝 결과를 해석하지 못했습니다.');
    }
    return arr.slice(0, 6);
}
