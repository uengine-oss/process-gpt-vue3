/**
 * 대화 목록에 무엇을 보여 줄 것인가.
 *
 * `chat_rooms.message` 는 문자열이 아니라 `{msg, type, createdAt}` 객체다.
 * 그대로 화면에 내면 `[object Object]` 나 `{ "msg": ... }` 가 뜬다.
 * 목록에서 마지막 대화를 알아볼 수 없으면 방을 하나씩 열어 봐야 한다.
 */

/** 마지막 메시지의 본문만 꺼낸다. */
export function lastMessageText(room) {
    const raw = room?.message;
    if (!raw) return '';

    if (typeof raw === 'string') {
        // 문자열로 들어 있는 경우가 섞여 있다. JSON 이면 풀고, 아니면 그대로 쓴다.
        const trimmed = raw.trim();
        if (!trimmed.startsWith('{')) return trimmed;
        try {
            return textOf(JSON.parse(trimmed));
        } catch (_e) {
            return trimmed;
        }
    }
    return textOf(raw);
}

function textOf(value) {
    if (!value || typeof value !== 'object') return '';
    const msg = value.msg ?? value.content ?? value.text ?? '';
    return typeof msg === 'string' ? msg.trim() : '';
}

/** 마지막 대화 시각. 목록을 최근 순으로 세우는 데 쓴다. */
export function lastMessageAt(room) {
    const raw = room?.message;
    const obj = typeof raw === 'string' ? safeParse(raw) : raw;
    const at = obj && typeof obj === 'object' ? obj.createdAt || obj.timeStamp : null;
    if (!at) return 0;
    const t = new Date(at).getTime();
    return Number.isFinite(t) ? t : 0;
}

function safeParse(text) {
    try {
        return JSON.parse(text);
    } catch (_e) {
        return null;
    }
}

/**
 * 한 줄로 줄인다.
 *
 * 저장된 마지막 메시지에는 줄바꿈이 그대로 들어 있다. 목록에서 그대로 두면
 * 카드 높이가 제각각이 되어 훑기 어렵다.
 */
export function preview(room, limit = 60) {
    const text = lastMessageText(room).replace(/\s+/g, ' ').trim();
    return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

/** 이름이 없는 방도 목록에서 구분되게 한다. */
export function roomTitle(room) {
    const name = (room?.name || '').toString().trim();
    return name || '이름 없는 대화';
}

/** 최근 대화가 위로. */
export function sortRooms(rooms) {
    return [...(Array.isArray(rooms) ? rooms : [])].sort((a, b) => lastMessageAt(b) - lastMessageAt(a));
}

/**
 * 목록에 보여 줄 마지막 메시지를 방에 기록한다.
 *
 * 왜 필요한가
 *   목록은 `chat_rooms.message` 를 읽는다. 대화 내용 자체(`chats`)를 읽지 않는다.
 *   그래서 메시지를 보낼 때마다 이 칸을 갱신해 주지 않으면, 대화가 쌓여도
 *   목록에는 영원히 "아직 대화 없음" 으로 남는다 — 실제로 그랬다.
 *   포털은 보낼 때마다 이 칸을 갱신한다(ChatRoomPage). 같게 한다.
 *
 *   방 전체를 다시 써야 한다. 일부만 넘기면 나머지 칸이 지워진다.
 */
export function withPreview(room, text, at = new Date().toISOString()) {
    if (!room?.id) return null;

    const msg = (text || '').toString().replace(/\s+/g, ' ').trim().slice(0, 50);
    if (!msg) return null;

    return { ...room, message: { msg, type: 'text', createdAt: at } };
}
