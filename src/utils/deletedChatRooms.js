/**
 * 삭제된 채팅방 id 차단 목록.
 *
 * chat_rooms 는 전부 upsert 로 쓰인다(putObject). 그래서 방을 지운 뒤에 뒤늦게
 * 돌아온 비동기 작업이 행을 그대로 되살린다 — 방 이름 자동생성(/completion/generate-name)
 * 응답, 스트림 뒷정리, 저장 보류 타이머가 모두 그렇다. 실제로 답변이 오류로 끝난 턴에서
 * "메시지는 지워졌는데 방만 남는" 유령 방이 그렇게 생겼다(메시지는 서버가 저장하지
 * 않았으니 다시 생기지 않고, 방만 스냅샷으로 되살아난다).
 *
 * 그래서 지운 id 를 여기 적어 두고, 방/메시지 행을 쓰는 쪽은 쓰기 전에 이걸 확인한다.
 * 탭 수명 동안만 들고 있으면 충분하다 — 새로고침하면 되살릴 메모리 스냅샷 자체가 없다.
 */

const deletedRoomIds = new Set();

/** 이 방은 지워졌다 — 이후 이 id 로 가는 쓰기는 모두 막는다. */
export function markChatRoomDeleted(roomId) {
    const id = (roomId || '').toString();
    if (id) deletedRoomIds.add(id);
}

/** 지워진 방인가. 방/메시지 행을 쓰기 전에 묻는다. */
export function isChatRoomDeleted(roomId) {
    const id = (roomId || '').toString();
    return !!id && deletedRoomIds.has(id);
}

/** 삭제가 실패했다 — 차단을 되돌린다(방이 DB 에 그대로 남아 있으므로). */
export function forgetChatRoomDeleted(roomId) {
    const id = (roomId || '').toString();
    if (id) deletedRoomIds.delete(id);
}

/** 로컬 방 목록 캐시(chatRoomIndex)에서 지운다 — 남으면 loadRoom 이 그걸로 방을 되살린다. */
export function removeChatRoomFromLocalIndex(roomId) {
    const id = (roomId || '').toString();
    if (!id) return;
    try {
        const raw = localStorage.getItem('chatRoomIndex');
        if (!raw) return;
        const idx = JSON.parse(raw);
        if (!idx || typeof idx !== 'object' || !(id in idx)) return;
        delete idx[id];
        localStorage.setItem('chatRoomIndex', JSON.stringify(idx));
    } catch (e) {
        // 캐시 정리 실패가 삭제를 막아서는 안 된다.
    }
}
