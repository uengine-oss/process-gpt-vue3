/**
 * 대화방 이름을 자동으로 지을 것인가.
 *
 * 포털(ChatRoomPage)에 있던 규칙을 그대로 옮겨 왔다. 화면은 웹과 앱이 다르지만
 * **판단 규칙은 한 벌이어야 한다** — 두 벌이면 한쪽에서만 이름이 안 붙는다.
 * 실제로 앱에서 모든 방이 "새 대화" 로 남아 있었다.
 *
 * 이름은 첫 사용자 메시지로 짓는다. 그 뒤에는 사용자가 바꿨을 수 있으므로
 * 건드리지 않는다.
 */

/** 아직 이름이 없는 것으로 볼 이름들. */
export const UNNAMED = ['새 대화', 'new chat', 'chat'];

export function shouldGenerateChatRoomName(room, newChatLabel = '') {
    if (!room) return false;

    // 서버/다른 화면이 명시적으로 정해 둔 경우 그것을 따른다.
    if (room.context?.auto_name_pending === true) return true;
    if (room.context?.auto_name_pending === false) return false;

    const name = String(room.name || '').trim().toLowerCase();
    const translated = String(newChatLabel || '').trim().toLowerCase();

    return !name || [translated, ...UNNAMED].filter(Boolean).includes(name);
}

/**
 * 지금 보내는 것이 이 방의 첫 사용자 메시지인가.
 *
 * 이름은 첫 마디로 짓는다. 두 번째부터 다시 지으면 사용자가 바꾼 이름을 덮는다.
 */
export function isFirstUserMessage(messages) {
    return !(Array.isArray(messages) ? messages : []).some((m) => m?.role === 'user' || m?.mine === true);
}
