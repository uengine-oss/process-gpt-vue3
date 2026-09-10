/**
 * 사람에게 무엇을 물을 것인가 — 패널 종류를 정하는 규칙.
 *
 * 왜 여기 있는가
 *   deepagent 의 `request_human_input` 은 `{question, context}` 만 보낸다. 승인/반려를
 *   보여줄지 체크박스 다중선택을 보여줄지는 **서버가 알려 주지 않고 프론트가 문자열의
 *   생김새를 보고 추론한다.**
 *
 *   이 추론이 화면마다 따로 있으면 반드시 갈라진다. 갈라지면 승인해야 할 것이
 *   체크박스로 뜬다 — 실제로 났던 버그다(2026-07, 컨설팅 초안이 `[제목]` 머리글을
 *   포함하면 후보 선택으로 오인). 그래서 규칙을 한 곳에 두고 포털과 모바일이 같이 쓴다.
 *
 * 무엇을 하지 않는가
 *   화면을 만들지 않는다. 여기서 나오는 것은 "무엇을 물을지" 를 적은 설명서일 뿐이고,
 *   그리는 일은 각 화면이 자기 방식으로 한다. 그래서 이 파일에는 Vue 가 없다.
 */

/**
 * 2단계 후보를 가리키는 카테고리.
 *
 * 카테고리가 '있기만' 하면 체크박스로 그리던 과거 로직이 문제였다. 컨설팅 초안이
 * 임의의 `[제목]` 머리글을 포함하면 승인/반려가 아닌 체크박스로 오인 렌더됐다.
 * 그래서 아는 카테고리일 때만 선택 패널로 확정한다.
 */
export const CANDIDATE_CATEGORIES = ['스킬', '에이전트', 'dmn', 'skill', 'agent'];

/** 알려진 후보 카테고리인가. */
export function isCandidateCategory(category) {
    const k = (category || '').toString().trim().toLowerCase();
    return !!k && CANDIDATE_CATEGORIES.some((cc) => k === cc || k.includes(cc));
}

/**
 * 질문 본문에서 제목과 후보 목록을 뽑는다.
 *
 * 규칙
 *   - 한 줄이 통째로 `[카테고리]` 면 그 뒤 불릿들의 카테고리가 된다.
 *   - `• 라벨: 설명` 형태의 불릿이 후보 한 개다.
 *   - 그 밖의 첫 줄이 제목이 된다.
 *
 * @param {string} raw
 * @returns {{question: string, items: Array<{id:string,label:string,description:string,category:string}>}}
 */
export function parseHumanInputQuestion(raw) {
    const text = String(raw || '');
    const lines = text.split('\n');
    let question = '';
    let category = '';
    const items = [];
    for (const line of lines) {
        const t = (line || '').trim();
        if (!t) continue;
        if (/^[•\-*]\s+/.test(t)) {
            const body = t.replace(/^[•\-*]\s+/, '');
            const ci = body.indexOf(':');
            const label = (ci >= 0 ? body.slice(0, ci) : body).trim();
            const desc = ci >= 0 ? body.slice(ci + 1).trim() : '';
            if (label) {
                // id 에 인덱스를 포함해 라벨이 같아도 항상 고유하게
                // (같은 이름이면 한 번에 다 선택되던 버그 방지).
                items.push({
                    id: `${category || 'opt'}::${items.length}::${label}`,
                    label,
                    description: category ? (desc ? `${desc}` : '') : desc,
                    category
                });
            }
            continue;
        }
        // 섹션 헤더: `[스킬]`, `[스킬]:`, `[에이전트] :` 등 뒤따르는 콜론/공백 허용.
        const secMatch = t.match(/^\[([^\]]+)\]\s*:?\s*$/);
        if (secMatch) {
            category = secMatch[1].split(/[—\-:]/)[0].trim();
            continue;
        }
        if (!question) question = t; // 첫 일반/질문 라인
    }
    return { question: question || text.trim(), items };
}

/**
 * 여러 프로세스를 한 번에 묻는 경우를 파싱한다.
 *
 * 본문 어딘가에 `multi_process` 를 담은 JSON 객체가 섞여 온다. 배열로 감싸이거나
 * 같은 것이 두 번 나오는 경우가 있어, 중괄호 균형을 세어 첫 번째 완전한 객체만 꺼낸다.
 *
 * @param {string} text
 * @returns {{stage: 'consult'|'candidates', questions: Array<object>}|null}
 */
export function parseMultiProcessHitl(text) {
    const raw = (text || '').toString();
    if (raw.indexOf('multi_process') === -1) return null;

    let obj = null;
    const key = raw.indexOf('"multi_process"');
    const start = key >= 0 ? raw.lastIndexOf('{', key) : -1;
    if (start >= 0) {
        let depth = 0;
        let end = -1;
        let inStr = false;
        let esc = false;
        for (let j = start; j < raw.length; j++) {
            const c = raw[j];
            if (inStr) {
                if (esc) esc = false;
                else if (c === '\\') esc = true;
                else if (c === '"') inStr = false;
            } else if (c === '"') inStr = true;
            else if (c === '{') depth++;
            else if (c === '}') {
                depth--;
                if (depth === 0) {
                    end = j;
                    break;
                }
            }
        }
        if (end > start) {
            try {
                obj = JSON.parse(raw.slice(start, end + 1));
            } catch (e) {
                obj = null;
            }
        }
    }
    if (!obj || !obj.multi_process || !Array.isArray(obj.processes) || obj.processes.length < 2) return null;

    const stage = obj.stage === 'candidates' ? 'candidates' : 'consult';
    const questions = [];
    obj.processes.forEach((p, pi) => {
        const name = (p?.name || `프로세스 ${pi + 1}`).toString().trim();
        if (stage === 'consult') {
            questions.push({
                question_id: `mp-${pi}-consult`,
                process: name,
                prompt: `[${name}] 초안 검토`,
                context: (p?.draft || '').toString(),
                feedback_type: 'approve_reject_with_edit',
                target_type: 'consult'
            });
        } else {
            const addKind = (kind, label, arr) => {
                const items = (Array.isArray(arr) ? arr : [])
                    .map((c, ci) => {
                        const lab = (typeof c === 'string' ? c : c?.label || c?.name || '').toString().trim();
                        if (!lab) return null;
                        return {
                            id: `${name}::${kind}::${ci}::${lab}`,
                            label: lab,
                            description: (typeof c === 'object' ? c?.desc || c?.description || '' : '').toString()
                        };
                    })
                    .filter(Boolean);
                if (!items.length) return;
                questions.push({
                    question_id: `mp-${pi}-${kind}`,
                    process: name,
                    prompt: `[${name}] ${label}`,
                    feedback_type: 'select_items',
                    items,
                    allow_multiple: true,
                    min_select: 0,
                    allow_other: true,
                    target_type: kind
                });
            };
            addKind('skills', '스킬', p?.skills);
            addKind('agents', '에이전트', p?.agents);
            addKind('dmn', 'DMN', p?.dmn);
        }
    });
    if (!questions.length) return null;
    return { stage, questions };
}

const MULTI_PROCESS_TITLE = {
    consult: '각 프로세스 초안을 검토해 주세요 (다음으로 페이지 이동)',
    candidates: '각 프로세스에 추가할 스킬·에이전트·DMN을 선택해 주세요 (다음으로 페이지 이동)'
};

/**
 * 무엇을 물을지 정한다. **이 파일의 요점.**
 *
 * 셋 중 하나가 나온다.
 *   - `multi_process`            여러 프로세스를 페이지 넘기며 묻는다
 *   - `select_items`             후보를 골라 달라고 한다 (체크박스)
 *   - `approve_reject_with_edit` 이대로 진행할지 묻는다 (승인/반려 + 자유 의견)
 *
 * 구조화된 `options` 가 오면 그것을 먼저 믿는다 — 모델이 `[카테고리]`+불릿 규칙을
 * 안 지켜도 정확히 그려진다. 프로즈만 왔을 때는 알려진 후보 카테고리가 있을 때만
 * 선택 패널로 본다.
 *
 * @param {{question?: string, context?: string, options?: Array<object>|null, multiSelect?: boolean}} input
 * @returns {{kind: string, question: string, context: string, items: Array<object>,
 *            questions?: Array<object>, stage?: string,
 *            allowMultiple: boolean, minSelect: number, allowOther: boolean}}
 */
export function buildHitlPanel({ question, context, options, multiSelect } = {}) {
    const headerQ = (question || '').toString().trim();
    const bodyText = (context || '').toString().trim();
    // 모델이 초안/후보를 question 과 context 어디에 넣든 잡히도록 둘을 합쳐 본다.
    const combined = [headerQ, bodyText].filter(Boolean).join('\n\n');

    const mp = parseMultiProcessHitl(combined);
    if (mp) {
        return {
            kind: 'multi_process',
            stage: mp.stage,
            question: MULTI_PROCESS_TITLE[mp.stage] || MULTI_PROCESS_TITLE.consult,
            context: '',
            items: [],
            questions: mp.questions,
            allowMultiple: true,
            minSelect: 0,
            allowOther: true
        };
    }

    const parsed = parseHumanInputQuestion(combined);

    const structuredItems =
        Array.isArray(options) && options.length
            ? options
                  .map((o, idx) => ({
                      id: `opt::${idx}::${(o?.label || '').toString()}`,
                      label: (o?.label || '').toString(),
                      description: (o?.description || '').toString()
                  }))
                  .filter((it) => it.label)
            : [];

    const hasCategorizedItems =
        structuredItems.length > 0 ||
        (parsed.items.length > 0 && parsed.items.some((it) => isCandidateCategory(it.category)));

    if (hasCategorizedItems) {
        const items = structuredItems.length
            ? structuredItems
            : parsed.items.map((it) => ({
                  id: it.id,
                  label: it.category ? `[${it.category}] ${it.label}` : it.label,
                  description: it.description || ''
              }));
        return {
            kind: 'select_items',
            // 후보가 question 전체에 들어온 경우 headerQ 는 후보까지 포함하므로,
            // 헤더는 첫 줄(제목)인 parsed.question 을 쓴다(후보는 items 로 표시).
            question: headerQ || parsed.question || '추가할 항목을 골라주세요',
            context: '',
            items,
            allowMultiple: structuredItems.length ? Boolean(multiSelect) : true,
            minSelect: 0,
            allowOther: true
        };
    }

    // 후보 없음 → 승인형. 초안은 패널 본문으로만 보여준다(본문+패널 중복 표시 방지).
    return {
        kind: 'approve_reject_with_edit',
        question: headerQ || '이대로 진행할까요?',
        context: combined,
        items: [],
        allowMultiple: false,
        minSelect: 0,
        allowOther: true
    };
}

/**
 * 지난 대화를 다시 불러왔을 때, 이 어시스턴트 글이 답을 기다리던 것인가.
 *
 * 새로고침하면 화면에만 있던 패널 상태가 사라진다. 저장된 본문만 보고 같은 패널을
 * 되살릴 수 있어야, 사용자가 새로고침했다는 이유로 답할 곳을 잃지 않는다.
 *
 * 아래 정규식이 한글 리터럴과 유니코드 이스케이프 두 벌인 것은 의도된 것이다.
 * 원본이 있던 SFC 가 과거 비-UTF8 도구를 거치며 한글 리터럴이 깨진 적이 있어,
 * 깨져도 살아남도록 이스케이프 판을 함께 둔다.
 *
 * @param {string} content
 * @returns {boolean}
 */
export function shouldRestoreFromAssistantContent(content) {
    const text = (content || '').toString().trim();
    if (!text) return false;

    const hasCandidateSectionsUnicode = /\[(?:스킬|에이전트|DMN|skill|agent)\]/i.test(text);
    const isCandidateRequestUnicode =
        hasCandidateSectionsUnicode && /(?:선택|고르|추가|후보)/i.test(text);
    const isConsultingRequestUnicode =
        /(?:이대로\s*진행할까요|추가하거나\s*바꿀\s*단계|초안.*(?:승인|진행))/i.test(text);

    const hasCandidateSections = /\[(?:스킬|에이전트|DMN|skill|agent)\]/i.test(text);
    const isCandidateRequest = hasCandidateSections && /(선택|골라|추가할|안 고르면|후보)/i.test(text);
    const isConsultingRequest = /(이대로 진행할까요|초안.*(?:승인|진행)|추가하거나 바꿀 단계)/i.test(text);

    return (
        isCandidateRequest || isConsultingRequest || isCandidateRequestUnicode || isConsultingRequestUnicode
    );
}

/**
 * 에이전트가 JSON 으로 되물어 오는 형태를 읽는다.
 *
 * 답이 이렇게 온다.
 *   {"user_request_type":"ask_user","question":"...","suggestions":[...]}
 *
 * 그대로 화면에 내면 사용자에게는 중괄호와 따옴표 덩어리가 보인다. 실제로 앱에서
 * 그렇게 보였다. 포털은 여기서 question 만 꺼내 보여 준다 — 같은 규칙을 쓴다.
 *
 * @returns {null | {question: string, context: string, suggestions: string[]}}
 */
export function parseAskUser(content) {
    const text = (content || '').toString().trim();
    if (!text.includes('{')) return null;

    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) return null;

    let parsed;
    try {
        parsed = JSON.parse(text.slice(start, end + 1));
    } catch (_e) {
        return null;
    }
    if (!parsed || typeof parsed !== 'object') return null;

    const question = typeof parsed.question === 'string' ? parsed.question.trim() : '';
    const isAsk = parsed.user_request_type === 'ask_user' || parsed.waiting_for_user_input === true;
    if (!isAsk || !question) return null;

    return {
        question,
        context: typeof parsed.context === 'string' ? parsed.context.trim() : '',
        suggestions: (Array.isArray(parsed.suggestions) ? parsed.suggestions : [])
            .filter((s) => typeof s === 'string' && s.trim())
            .map((s) => s.trim())
    };
}
