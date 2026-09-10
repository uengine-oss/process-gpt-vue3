/**
 * 에이전트가 도구를 실행하고 돌려주는 결과를 사람 말로 바꾼다.
 *
 * 왜 필요한가
 *   프로세스 생성을 시키면 답이 이렇게 온다.
 *     {"success": true, "workitem_id": "ffffd520-...",
 *      "message": "컨설팅 기반 프로세스 생성 워크아이템이 생성되었습니다.",
 *      "status": "IN_PROGRESS", "agent_orch": "pdf2bpmn", ...}
 *   이것이 중괄호째 화면에 찍혔다. 사용자에게는 읽을 수 없는 덩어리이고,
 *   더 나쁜 것은 **실제 생성은 이제부터 백그라운드에서 진행된다**는 사실이
 *   어디에도 드러나지 않는다는 점이다. 결과를 보러 갈 길도 없다.
 *
 *   그래서 안의 `message` 를 꺼내 보여 주고, 따라갈 수 있는 곳이 있으면
 *   그리로 가는 길을 함께 준다.
 */

/** 이 글이 통째로 JSON 한 덩어리인가. 앞뒤에 말이 섞여 있으면 손대지 않는다. */
function wholeJson(text) {
    const t = (text || '').toString().trim();
    if (!t.startsWith('{') || !t.endsWith('}')) return null;
    try {
        const parsed = JSON.parse(t);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
    } catch (_e) {
        return null;
    }
}

/** 결과에 담긴 식별자로 갈 곳을 정한다. */
export function followUp(parsed) {
    const workitem = parsed?.workitem_id || parsed?.workitemId || parsed?.task_id;
    if (workitem) {
        return { label: '진행 상황 보기', route: `/tasks/${encodeURIComponent(String(workitem))}` };
    }

    const inst = parsed?.proc_inst_id || parsed?.instance_id;
    if (inst) {
        return { label: '진행 상황 보기', route: `/instances/${encodeURIComponent(String(inst))}` };
    }
    return null;
}

/**
 * 도구 실행 결과인가. 맞으면 사람이 읽을 모양으로 돌려준다.
 *
 * @returns {null | {text: string, ok: boolean, follow: object|null}}
 */
export function parseToolResult(content) {
    const parsed = wholeJson(content);
    if (!parsed) return null;

    // 성공/실패 표시가 있고 할 말이 있는 것만 다룬다. 그 밖의 JSON 은
    // 무슨 뜻인지 알 수 없으므로 함부로 바꿔 쓰지 않는다.
    const hasVerdict = 'success' in parsed || 'status' in parsed;
    const message = typeof parsed.message === 'string' ? parsed.message.trim() : '';
    if (!hasVerdict || !message) return null;

    const ok = parsed.success !== false;
    return {
        ok,
        text: ok ? message : `${message} (실패)`,
        follow: ok ? followUp(parsed) : null
    };
}
