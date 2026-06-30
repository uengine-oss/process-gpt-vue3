/**
 * 에이전트 산출물(agents/<id>.json)의 안정적 DB id 유틸.
 *
 * 배경: deepagent 는 에이전트 파일 id 를 슬러그(예: 'approval-notifier')로 만든다.
 * 그런데 users.id 는 uuid 타입이라 슬러그를 그대로 쓸 수 없다. 매번 랜덤 uuid 를 발급하면
 * 방 재진입(워크스페이스 파일 재복원) 시 값이 달라져 편집기(/agent-chat/{id})가 draft 저장된
 * 에이전트를 못 찾는다. → 슬러그에서 **결정적(deterministic) uuid** 를 파생해, 편집 이동·draft 저장·
 * 최종 저장이 영속화 없이도 항상 동일한 id 를 쓰게 한다.
 */

export function isUuid(v) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test((v || '').toString());
}

/** 문자열 → 결정적 uuid(버전4 형식). 같은 입력 → 항상 같은 uuid. */
export function slugToUuid(s) {
    const str = (s || '').toString();
    const bytes = [];
    for (let salt = 0; salt < 4; salt++) {
        let h = (0x811c9dc5 ^ salt) >>> 0;
        for (let i = 0; i < str.length; i++) {
            h ^= str.charCodeAt(i);
            h = Math.imul(h, 0x01000193) >>> 0;
        }
        bytes.push((h >>> 24) & 0xff, (h >>> 16) & 0xff, (h >>> 8) & 0xff, h & 0xff);
    }
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant
    const hex = bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/**
 * 에이전트 객체/파일경로에서 안정적 DB id 를 구한다.
 * - obj.id 가 이미 uuid 면 그대로.
 * - 아니면 obj.id(슬러그) 또는 파일명 stem 에서 결정적 uuid 파생.
 */
export function agentStableId(obj, filePath) {
    const rawId = (obj && obj.id ? obj.id : '').toString().trim();
    if (isUuid(rawId)) return rawId;
    let seed = rawId;
    if (!seed && filePath) {
        const m = (filePath || '').replace(/\\/g, '/').match(/\/agents\/([^/]+)\.json$/i);
        if (m) seed = m[1];
    }
    if (!seed) seed = (filePath || '').toString();
    return slugToUuid(seed);
}
