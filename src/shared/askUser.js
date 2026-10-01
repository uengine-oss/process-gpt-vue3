/**
 * 에이전트가 ask_user 도구로 사용자에게 물은 것을 질문 패널(HumanFeedbackPanel)로 그릴 값으로.
 *
 * MCP(process-gpt-mcp)의 ask_user 는 `{user_request_type: 'ask_user', question, suggestions}` 만
 * 돌려준다. 예전 판정은 feedback_type · items · option_meta 가 있어야 패널을 띄웠고, 결과가
 * `content=[{'type': 'text', 'text': '{...}'}]` 로 감싸여 오면 JSON.parse 부터 실패했다. 그래서
 * 질문이 도구 기록 속에만 있고, 에이전트가 '위 질문에 답변해 주세요' 라고만 답하면 사용자는
 * 무엇을 답해야 할지 볼 수 없었다(프로세스 실행 중 '1번 사용자 역할은 누구로…' 가 그랬다).
 *
 * @param {object|null} parsed  도구 결과를 읽은 객체(parseMcpToolOutput)
 * @returns {object|null} message.__humanFeedback 로 쓸 값, 질문이 아니면 null
 */
export function askUserFeedbackOf(parsed) {
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.user_request_type !== 'ask_user') return null;

    // 화면 모양을 이미 정해 보낸 질문(선택 항목 · 도구 옵션)은 그대로 쓴다.
    if (typeof parsed.feedback_type === 'string' || Array.isArray(parsed.items) || (parsed.option_meta && typeof parsed.option_meta === 'object')) {
        return parsed;
    }

    const question = typeof parsed.question === 'string' ? parsed.question.trim() : '';
    if (!question) return null;
    const suggestions = (Array.isArray(parsed.suggestions) ? parsed.suggestions : [])
        .map((s) => (typeof s === 'string' ? s : s && (s.label || s.text || s.value)) || '')
        .map((s) => String(s).trim())
        .filter(Boolean);

    // 제안이 있으면 고르게 하고, 그 밖의 답(다른 담당자 이름 등)은 직접 적게 한다.
    // 제안이 없으면 직접 입력만 둔다. 어느 쪽이든 답은 보통 메시지로 에이전트에게 간다.
    return {
        ...parsed,
        question,
        feedback_type: 'suggestions',
        suggestions,
        allow_other: true
    };
}
