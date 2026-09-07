/**
 * 도구 이름을 사람 말로.
 *
 * 에이전트가 무엇을 하는 중인지 보여 줄 때 쓴다. `get_todolist` 같은 내부
 * 이름을 그대로 내면 사용자는 무슨 일이 벌어지는지 알 수 없고, 오래 걸리는
 * 작업에서는 멈춘 것처럼 보인다.
 *
 * 포털(ChatRoomPage · Chat.vue · WorkAssistantChatPanel)이 쓰던 것과 같은 표다.
 * 세 곳이 각자 갖고 있으면 새 도구가 생길 때 한 곳만 고쳐진다.
 */

export const TOOL_NAMES = {
    get_process_list: '프로세스 목록 조회',
    get_process_detail: '프로세스 상세 조회',
    get_form_fields: '폼 필드 조회',
    execute_process: '프로세스 실행',
    get_instance_list: '인스턴스 목록 조회',
    get_todolist: '할일 목록 조회',
    get_organization: '조직도 조회',
    ask_user: '사용자 확인 요청',
    create_consulting_process_workitem: '컨설팅 기반 프로세스 생성',
    create_pdf2bpmn_workitem: 'PDF→BPMN 변환 요청',
    get_current_user: '사용자 정보 조회'
};

/**
 * 도구 이름 하나를 사람 말로 바꾼다.
 *
 * 이름은 `server__tool_name` 처럼 앞에 출처가 붙어 오기도 한다. 뒤쪽만 본다.
 * 모르는 도구는 있는 그대로 보여 준다 — 감추면 무엇을 했는지 알 수 없다.
 */
export function formatToolName(name) {
    if (!name) return '';
    const raw = String(name);
    const key = raw.split('__').pop();
    return TOOL_NAMES[key] || key || raw;
}
