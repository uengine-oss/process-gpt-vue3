/**
 * 대화에서 특정 에이전트를 불러 세운다(@멘션).
 *
 * 여러 에이전트가 들어와 있는 방에서는 누가 답할지 라우터가 고른다. 멘션은
 * 그것을 사용자가 직접 정하는 방법이다 — "이건 네가 답해" 라고 지목하는 것.
 * 멘션이 없으면 엉뚱한 에이전트가 답하거나, 아무도 답하지 않을 수 있다.
 *
 * 규칙(무엇을 멘션으로 볼 것인가)은 포털과 같아야 한다. 앱에서만 다르게 잘리면
 * 같은 문장이 웹에서는 지목되고 앱에서는 무시된다.
 */

/** 포털(ChatRoomPage.parseMentions)과 같은 규칙. 한글·영문·숫자와 . _ - 를 이름으로 본다. */
const MENTION = /@([0-9A-Za-z가-힣._-]+)/g;

export function parseMentions(text) {
    const s = String(text || '');
    const found = [];
    let m;
    while ((m = MENTION.exec(s)) !== null) {
        const raw = (m[1] || '').trim();
        if (raw) found.push(raw);
    }
    return [...new Set(found)];
}

/** 견주기 위해 이름을 다듬는다. 띄어쓰기와 대소문자는 무시한다. */
function norm(v) {
    return String(v || '').toLowerCase().replace(/\s+/g, '');
}

/**
 * 적힌 이름을 실제 참가자로 맞춘다.
 *
 * 못 맞춘 이름은 버린다 — 없는 사람을 지목한 채로 보내면 아무도 답하지 않는다.
 */
export function resolveMentions(text, candidates) {
    const names = parseMentions(text).map(norm);
    if (!names.length) return [];

    const list = Array.isArray(candidates) ? candidates : [];
    const picked = list.filter((c) =>
        [c?.username, c?.alias, c?.email, c?.id].filter(Boolean).some((v) => names.includes(norm(v)))
    );

    const seen = new Set();
    return picked.filter((c) => {
        const id = String(c?.id || '');
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
    });
}

/**
 * 지금 입력 중인 멘션 조각.
 *
 * `@김` 까지 쳤을 때 후보를 띄우기 위한 것. 커서 앞쪽만 본다.
 * 이미 완성된 멘션 뒤에 공백이 오면 더 이상 고르는 중이 아니다.
 */
export function mentionDraft(text, caret = null) {
    const s = String(text || '');
    const upto = caret === null ? s : s.slice(0, caret);
    const m = upto.match(/@([0-9A-Za-z가-힣._-]*)$/);
    return m ? m[1] : null;
}

/** 입력 중인 조각으로 후보를 좁힌다. */
export function suggest(candidates, draft) {
    const q = norm(draft);
    const list = Array.isArray(candidates) ? candidates : [];
    if (!q) return list;
    return list.filter((c) => [c?.username, c?.alias, c?.email].filter(Boolean).some((v) => norm(v).includes(q)));
}

/** 고른 후보를 입력 글에 끼워 넣는다. */
export function applyMention(text, caret, candidate) {
    const s = String(text || '');
    const at = caret === null ? s.length : caret;
    const before = s.slice(0, at).replace(/@([0-9A-Za-z가-힣._-]*)$/, '');
    const name = String(candidate?.username || candidate?.alias || candidate?.id || '').trim();
    return `${before}@${name} ${s.slice(at)}`;
}
