/**
 * 인계 산출물 워크트리(화면 쪽).
 *
 * 인계 스레드마다 저장소 하나, 방마다 브랜치 하나. 커밋은 스냅샷 전체를 tree 로 담는다
 * (방 작업 폴더 기준 상대 경로 → { sha256, size, content_type }). 내용은 `files` 버킷
 * `artifacts/{tenant}/objects/{sha256}` 에 한 번만 둔다. 쓰기는 DB 함수(create_branch,
 * commit_branch)로만 하고, head 가 어긋나면(40001) 최신 head 를 다시 읽어 재시도한다.
 *
 * deepagents 의 core/storage/worktree.py 와 같은 규칙이다.
 */

import { decodeStorageKeyPath } from './handoverFiles.js';

const BUCKET = 'files';
const RETRY_LIMIT = 5;

export function objectKey(tenantId, sha256) {
    return `artifacts/${tenantId}/objects/${sha256}`;
}

export function objectUrl(sb, tenantId, entry) {
    if (!entry?.sha256) return '';
    return sb.storage.from(BUCKET).getPublicUrl(objectKey(tenantId, entry.sha256))?.data?.publicUrl || '';
}

export async function sha256Hex(blob) {
    const buf = await blob.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

const CONTENT_TYPES = {
    txt: 'text/plain',
    md: 'text/markdown',
    json: 'application/json',
    csv: 'text/csv',
    html: 'text/html',
    xml: 'application/xml',
    bpmn: 'application/xml',
    yaml: 'application/yaml',
    yml: 'application/yaml',
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    hwpx: 'application/hwp+zip',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg'
};

export function guessContentType(path, fallback = '') {
    const ext = String(path || '').split('.').pop().toLowerCase();
    return CONTENT_TYPES[ext] || fallback || 'application/octet-stream';
}

export function isTextEntry(path, entry) {
    const ct = String(entry?.content_type || guessContentType(path)).split(';')[0].trim();
    // docx 등은 'officedocument...+xml' 꼴이라 'xml' 을 포함해도 글이 아니다.
    return ct.startsWith('text/') || ['application/json', 'application/xml', 'application/yaml'].includes(ct);
}

/** 내용을 객체로 올린다. 같은 내용이 이미 있으면 올리지 않는다(중복 오류를 성공으로 본다). */
export async function putObject(sb, tenantId, blob, path) {
    const sha256 = await sha256Hex(blob);
    const content_type = guessContentType(path, blob.type);
    const { error } = await sb.storage.from(BUCKET).upload(objectKey(tenantId, sha256), blob, { contentType: content_type, upsert: false });
    if (error && !isDuplicateError(error)) throw error;
    return { sha256, size: blob.size, content_type };
}

function isDuplicateError(error) {
    const text = `${error?.statusCode || ''} ${error?.error || ''} ${error?.message || ''}`;
    return /409|Duplicate|already exists/i.test(text);
}

export async function readObject(sb, tenantId, entry) {
    const url = objectUrl(sb, tenantId, entry);
    if (!url) return null;
    const res = await fetch(url);
    return res.ok ? await res.blob() : null;
}

// ---------------------------------------------------------------------------
// tree 계산(순수 함수)
// ---------------------------------------------------------------------------

function sameEntry(a, b) {
    return (a?.sha256 || null) === (b?.sha256 || null);
}

/** base 에서 head 로 바뀐 경로. 추가·변경·삭제로 나눈다. */
export function diffTrees(base, head) {
    const b = base || {};
    const h = head || {};
    const added = [];
    const modified = [];
    const removed = [];
    for (const path of Object.keys(h)) {
        if (!(path in b)) added.push(path);
        else if (!sameEntry(b[path], h[path])) modified.push(path);
    }
    for (const path of Object.keys(b)) if (!(path in h)) removed.push(path);
    return { added: added.sort(), modified: modified.sort(), removed: removed.sort() };
}

export function pickTree(tree, paths) {
    const out = {};
    for (const p of paths || []) if (tree && tree[p]) out[p] = tree[p];
    return out;
}

/** base → mine 에서 바뀐 경로만 theirs 위에 얹는다(재시도 때 남의 커밋을 잃지 않게). */
export function rebaseChanges(base, mine, theirs) {
    const out = { ...(theirs || {}) };
    const { added, modified, removed } = diffTrees(base, mine);
    for (const p of [...added, ...modified]) out[p] = mine[p];
    for (const p of removed) delete out[p];
    return out;
}

/**
 * 갈래가 한 일을 기준(묶음을 나눈 커밋) tree 위에 옮긴다. 갈래는 고른 파일만 받아 시작하므로
 * 그 브랜치의 시작 tree 와 head 를 비교해야 한다. 받지 않은 파일을 지운 것으로 보면 안 된다.
 */
export function sideTree(baseTree, startTree, headTree) {
    return rebaseChanges(startTree || {}, headTree || {}, baseTree || {});
}

/**
 * 합류 3-way 병합. base 는 묶음을 나눈 커밋의 tree, sides 는 [{ key, label, tree }]
 * (첫째는 넘기는 방, 나머지는 갈래). 한 쪽만 바꾼 경로는 그 내용, 둘 이상이 서로 다르게
 * 바꿨으면 충돌로 돌려준다. choices[path] = side key 를 주면 그 쪽으로 정한다.
 */
export function mergeTrees(base, sides, choices = {}) {
    const b = base || {};
    const paths = new Set(Object.keys(b));
    for (const s of sides) for (const p of Object.keys(s.tree || {})) paths.add(p);
    const tree = {};
    const conflicts = [];
    for (const path of [...paths].sort()) {
        const changed = [];
        for (const s of sides) {
            const entry = (s.tree || {})[path];
            if (!sameEntry(entry, b[path])) changed.push({ key: s.key, label: s.label, entry: entry || null });
        }
        const distinct = [];
        for (const c of changed) if (!distinct.some((d) => sameEntry(d.entry, c.entry))) distinct.push(c);
        let result;
        if (distinct.length === 0) result = b[path] || null;
        else if (distinct.length === 1) result = distinct[0].entry;
        else {
            const chosen = choices[path] ? changed.find((c) => c.key === choices[path]) : null;
            if (chosen) result = chosen.entry;
            else {
                conflicts.push({ path, sides: changed });
                result = b[path] || null;
            }
        }
        if (result) tree[path] = result;
    }
    return { tree, conflicts };
}

// ---------------------------------------------------------------------------
// 조회
// ---------------------------------------------------------------------------

export async function getBranch(sb, roomId) {
    if (!roomId) return null;
    const { data, error } = await sb.from('artifact_branches').select('*').eq('room_id', roomId).maybeSingle();
    if (error) throw error;
    return data || null;
}

export async function getCommit(sb, commitId) {
    if (!commitId) return null;
    const { data, error } = await sb.from('artifact_commits').select('*').eq('id', commitId).maybeSingle();
    if (error) throw error;
    return data || null;
}

/** 방 브랜치와 그 head 커밋. 브랜치가 없으면(예전 방) null. */
export async function getBranchHead(sb, roomId) {
    const branch = await getBranch(sb, roomId);
    if (!branch) return null;
    const head = await getCommit(sb, branch.head_commit_id);
    return { branch, head, tree: head?.tree || {} };
}

/** 저장소의 모든 브랜치와 head 커밋. */
export async function listBranchHeads(sb, repoId) {
    if (!repoId) return [];
    const { data: branches, error } = await sb.from('artifact_branches').select('*').eq('repo_id', repoId);
    if (error) throw error;
    const ids = [...new Set((branches || []).flatMap((b) => [b.head_commit_id, b.base_commit_id]).filter(Boolean))];
    const commits = {};
    if (ids.length) {
        const { data, error: e2 } = await sb.from('artifact_commits').select('*').in('id', ids);
        if (e2) throw e2;
        for (const c of data || []) commits[c.id] = c;
    }
    return (branches || []).map((b) => ({ branch: b, head: commits[b.head_commit_id] || null, base: commits[b.base_commit_id] || null }));
}

/** 한 방 브랜치가 base 이후 추가·변경·삭제한 경로. */
export function branchChanges(item) {
    return diffTrees(item?.base?.tree || {}, item?.head?.tree || {});
}

/** 방 브랜치의 커밋 이력(최신 먼저). */
export async function listRoomCommits(sb, roomId) {
    const { data, error } = await sb.from('artifact_commits').select('*').eq('room_id', roomId).order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
}

// ---------------------------------------------------------------------------
// 방 작업 폴더(Storage skills/{tenant}/{방}/)
// ---------------------------------------------------------------------------

async function listFolder(sb, prefix) {
    const out = [];
    const { data, error } = await sb.storage.from(BUCKET).list(prefix, { limit: 1000 });
    if (error) throw error;
    for (const e of data || []) {
        if (!e?.name) continue;
        const full = `${prefix}/${e.name}`;
        if (e.id == null) out.push(...(await listFolder(sb, full)));
        else out.push({ key: full, updated_at: e.updated_at || e.created_at || null });
    }
    return out;
}

/**
 * 방 작업 폴더에서 since 이후 바뀐 파일을 tree 항목으로 올린다. since 가 없으면 전부.
 * 사람이 화면에서 올린 파일·예전 복사 인계 파일이 여기에 있다.
 */
export async function roomFolderEntries(sb, tenantId, roomId, since = null) {
    const prefix = `skills/${tenantId}/${roomId}`;
    let files = [];
    try {
        files = await listFolder(sb, prefix);
    } catch (e) {
        return {};
    }
    const sinceMs = since ? new Date(since).getTime() : 0;
    const out = {};
    for (const f of files) {
        if (sinceMs && f.updated_at && new Date(f.updated_at).getTime() <= sinceMs) continue;
        const rel = decodeStorageKeyPath(f.key.slice(prefix.length + 1));
        const url = sb.storage.from(BUCKET).getPublicUrl(f.key)?.data?.publicUrl;
        if (!url) continue;
        const res = await fetch(url);
        if (!res.ok) continue;
        out[rel] = await putObject(sb, tenantId, await res.blob(), rel);
    }
    return out;
}

// ---------------------------------------------------------------------------
// 커밋
// ---------------------------------------------------------------------------

function isRetry(error) {
    return error?.code === '40001' || /head 가 바뀌었습니다/.test(error?.message || '');
}

/**
 * 방 작업 상태를 커밋한다. change(tree) 는 지금 head tree 를 받아 새 tree 를 돌려준다.
 * head 가 그새 바뀌면 다시 읽어 change 를 새 head 위에서 다시 계산한다. 바뀐 것이 없으면 커밋하지 않는다.
 */
export async function commitRoom(sb, { roomId, reason, authorId = null, change, parents = null }) {
    for (let i = 0; i < RETRY_LIMIT; i++) {
        const current = await getBranchHead(sb, roomId);
        if (!current) throw new Error(`방 브랜치가 없습니다: ${roomId}`);
        const tree = await change(current.tree, current);
        const { data, error } = await sb.rpc('commit_branch', {
            p_room_id: roomId,
            p_expected_head: current.branch.head_commit_id,
            p_tree: tree,
            p_reason: reason,
            p_parents: parents ? [current.branch.head_commit_id, ...parents] : null,
            p_author_id: authorId
        });
        if (!error) return { commitId: data?.commit_id, created: !!data?.created, tree };
        if (!isRetry(error)) throw error;
    }
    throw new Error(`커밋 재시도 한도를 넘었습니다: ${roomId}`);
}

/**
 * 방 작업 상태 커밋(할 일 완료 등). head 이후 방 작업 폴더에 새로 생기거나 바뀐 파일을 얹는다.
 * 브랜치가 없는 방(예전 방)은 아무것도 하지 않는다.
 */
export async function commitRoomWorkState(sb, { tenantId, roomId, reason, authorId = null }) {
    const current = await getBranchHead(sb, roomId);
    if (!current) return null;
    return commitRoom(sb, {
        roomId,
        reason,
        authorId,
        change: async (tree, head) => ({ ...tree, ...(await roomFolderEntries(sb, tenantId, roomId, head.head?.created_at)) })
    });
}

/**
 * 화면의 작업 파일 경로를 그 방 브랜치 tree 경로로 바꾼다. 에이전트 작업 폴더는
 * `/workspace/.bpmn/{방}/…` 이고 tree 는 그 아래 상대 경로다. 다른 방 폴더면 null.
 */
export function treePathOf(path, roomId) {
    const p = String(path || '').replace(/\\/g, '/');
    const marker = `.bpmn/${roomId}/`;
    const i = p.indexOf(marker);
    if (i !== -1) return p.slice(i + marker.length) || null;
    if (p.includes('.bpmn/')) return null;
    return p.replace(/^\/?workspace\//, '').replace(/^\/+/, '') || null;
}

/**
 * 사람이 화면에서 고친 파일 하나를 그 방 브랜치에 바로 커밋한다(reason 'edit').
 * 내용이 head 와 같으면 커밋하지 않는다. 브랜치가 없는 방(예전 방)은 null.
 */
export async function commitEditedFile(sb, { tenantId, roomId, path, content, authorId = null }) {
    const current = await getBranchHead(sb, roomId);
    if (!current) return null;
    const blob = content instanceof Blob ? content : new Blob([String(content ?? '')], { type: guessContentType(path) });
    const entry = await putObject(sb, tenantId, blob, path);
    return commitRoom(sb, { roomId, reason: 'edit', authorId, change: (tree) => ({ ...tree, [path]: entry }) });
}

/** 저장소를 찾거나 만들고, 방 브랜치가 없으면 initialTree 로 만든다. */
export async function ensureRoomBranch(sb, { tenantId, originRoomId, roomId, initialTree, authorId = null }) {
    const existing = await getBranch(sb, roomId);
    if (existing) return existing;
    const { data: repoId, error } = await sb.rpc('ensure_artifact_repo', { p_origin_room_id: originRoomId, p_tenant_id: tenantId });
    if (error) throw error;
    const tree = typeof initialTree === 'function' ? await initialTree() : initialTree || {};
    const { error: e2 } = await sb.rpc('create_branch', {
        p_repo_id: repoId,
        p_room_id: roomId,
        p_base_commit_id: null,
        p_tree: tree,
        p_author_id: authorId
    });
    if (e2) throw e2;
    return getBranch(sb, roomId);
}

/** base 커밋에서 받는 방 브랜치를 만든다. tree 는 고른 경로만 담는다. */
export async function createBranchFrom(sb, { repoId, roomId, baseCommitId, tree, authorId = null }) {
    const { data, error } = await sb.rpc('create_branch', {
        p_repo_id: repoId,
        p_room_id: roomId,
        p_base_commit_id: baseCommitId,
        p_tree: tree,
        p_author_id: authorId
    });
    if (error) throw error;
    return data;
}
