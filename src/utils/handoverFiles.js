/**
 * 대화창 인계로 넘기는 파일을 받는 방의 에이전트 작업 폴더에 놓는 규칙.
 *
 * 에이전트는 방에서 첫 턴을 시작할 때 `files` 버킷의 `skills/{tenant}/{방}/` 아래를 작업 폴더
 * (`/workspace/.bpmn/{방}/`)로 내려받는다(process-gpt-deepagents download_workspace_directory).
 * 인계 파일을 거기에 두면 받는 쪽 에이전트가 그대로 찾는다.
 *
 * Supabase Storage 는 한글 같은 글자가 든 키를 거부한다. deepagents 와 같은 규칙으로
 * 그런 경로 조각만 `__u8__` + base64url(UTF-8) 로 바꾸고, 내려받을 때 원래 이름으로 되돌린다.
 */

const SAFE_KEY_SEGMENT = /^[A-Za-z0-9_/!\-.*'() &$@=;:+,?]*$/;
const ENCODED_MARK = '__u8__';

function toBase64Url(text) {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    bytes.forEach((b) => {
        binary += String.fromCharCode(b);
    });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(raw) {
    const b64 = raw.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (raw.length % 4)) % 4);
    const binary = atob(b64);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
}

export function encodeStorageKeySegment(segment) {
    if (SAFE_KEY_SEGMENT.test(segment) && !segment.startsWith(ENCODED_MARK)) return segment;
    return `${ENCODED_MARK}${toBase64Url(segment)}`;
}

export function decodeStorageKeySegment(segment) {
    if (!segment.startsWith(ENCODED_MARK)) return segment;
    try {
        return fromBase64Url(segment.slice(ENCODED_MARK.length));
    } catch (e) {
        return segment;
    }
}

export function encodeStorageKeyPath(rel) {
    return String(rel)
        .replace(/\\/g, '/')
        .split('/')
        .map(encodeStorageKeySegment)
        .join('/');
}

/** 파일 이름에서 폴더 구분자를 걷어 낸다. 넘기는 파일은 받는 방 작업 폴더 바로 아래에 둔다. */
export function handoverFileName(name) {
    const base = String(name || '')
        .replace(/\\/g, '/')
        .split('/')
        .pop();
    return base.trim() || 'artifact';
}

/** 받는 방 작업 폴더에 놓일 저장소 키(버킷 `files` 안). */
export function roomWorkspaceKey(tenantId, roomId, name) {
    return `skills/${tenantId}/${roomId}/${encodeStorageKeyPath(handoverFileName(name))}`;
}

/** 받는 방 에이전트가 보는 경로. */
export function roomWorkspacePath(roomId, name) {
    return `/workspace/.bpmn/${roomId}/${handoverFileName(name)}`;
}

/** 같은 이름이 둘 이상이면 뒤에 번호를 붙여 서로 덮어쓰지 않게 한다. */
export function uniqueHandoverNames(names) {
    const seen = new Map();
    return names.map((raw) => {
        const name = handoverFileName(raw);
        const n = seen.get(name) || 0;
        seen.set(name, n + 1);
        if (n === 0) return name;
        const dot = name.lastIndexOf('.');
        return dot > 0 ? `${name.slice(0, dot)} (${n + 1})${name.slice(dot)}` : `${name} (${n + 1})`;
    });
}
