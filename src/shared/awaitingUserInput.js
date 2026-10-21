// 에이전트가 판단에 필요한 답을 사용자에게 묻고 기다리는 업무인지 (spec 018). 질문 자체는 events(human_asked)에 있다.
// - 서비스 태스크(실행 엔진 폴링 서비스): 업무를 PENDING + output.awaiting_user_input{job_id, question, options}
// - 사용자 태스크 + 에이전트(오케스트레이션 워커): 업무는 IN_PROGRESS 인 채 draft.awaiting_user_input
// 같은 PENDING 이라도 오류·조건 미충족 보류와는 다르게 보여야 한다.
// item: todolist 행, 업무 화면의 worklist, 칸반 업무(task.task 에 원본 행) 어느 것이든 받는다.
function parse(value) {
    if (typeof value !== 'string') return value;
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}

export function awaitingUserInput(item) {
    for (const key of ['output', 'draft']) {
        const out = parse(item?.[key] ?? item?.task?.[key]);
        const waiting = out && typeof out === 'object' ? out.awaiting_user_input : null;
        if (waiting && waiting.job_id) return waiting;
    }
    return null;
}
