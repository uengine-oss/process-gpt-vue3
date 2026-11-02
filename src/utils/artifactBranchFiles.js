/**
 * 인계 스레드의 방 브랜치들을 산출물 파일 패널(WorkspaceFilesViewer) 항목으로 바꾼다.
 * 브랜치마다 묶고(group), 기준 커밋 이후 추가·변경한 파일에 표시를 단다. 읽기 전용이다.
 */

import { guessContentType, isTextEntry } from './artifactWorktree.js';

const TEXT_INLINE_LIMIT = 200 * 1024;

export function branchLabel(branch, labels = {}) {
    if (branch.mine) return labels.mine || '';
    const e = branch.event || {};
    return [e.to_user_name, e.next_activity_label].filter(Boolean).join(' · ') || branch.roomName || branch.roomId;
}

/** 이 방을 먼저, 나머지는 넘겨받은 순서로. */
export function orderBranches(branches) {
    const at = (b) => (b.event?.occurred_at ? Date.parse(b.event.occurred_at) : 0);
    return [...branches].sort((a, b) => Number(b.mine) - Number(a.mine) || at(a) - at(b));
}

export function opOf(changes, path) {
    if ((changes?.added || []).includes(path)) return 'create';
    if ((changes?.modified || []).includes(path)) return 'edit';
    return 'same';
}

/**
 * @param info backend.getRoomArtifactBranches 결과
 * @param urlOf (entry) => 내용 객체 주소(또는 그 Promise — 화면의 backend 는 메서드를 비동기로 감싼다)
 * @param labels { mine }
 * @param fetchText (url) => Promise<string> — 글 파일 내용(작은 것만)
 */
export async function branchFilesForPanel(info, urlOf, labels = {}, fetchText = defaultFetchText) {
    const files = [];
    for (const b of orderBranches(info?.branches || [])) {
        const group = branchLabel(b, labels);
        for (const path of Object.keys(b.tree || {}).sort()) {
            const entry = b.tree[path];
            const url = await urlOf(entry);
            const text = isTextEntry(path, entry) && (entry.size || 0) <= TEXT_INLINE_LIMIT;
            const file = {
                path: `${b.roomId}/${path}`,
                name: path,
                group,
                groupRoomId: b.roomId,
                op: opOf(b.changes, path),
                status: 'done',
                size_bytes: entry.size || 0,
                content_type: entry.content_type || guessContentType(path)
            };
            if (text) {
                try {
                    file.content = await fetchText(url);
                } catch (e) {
                    file.content = '';
                }
            }
            if (!file.content) {
                file.document = true;
                file.url = url;
            }
            files.push(file);
        }
    }
    return files;
}

async function defaultFetchText(url) {
    const res = await fetch(url);
    return res.ok ? await res.text() : '';
}

/**
 * 방 브랜치 커밋 이력에서 한 파일의 버전들(내용이 달라진 커밋만, 최신 먼저).
 * commits 는 최신 먼저(backend.getRoomArtifactCommits). 커밋은 바뀌지 않으므로 어느 버전이든 그대로 연다.
 */
export function fileVersions(commits, path) {
    const out = [];
    const oldestFirst = [...(commits || [])].reverse();
    let prev = null;
    for (const c of oldestFirst) {
        const entry = (c.tree || {})[path];
        if (!entry || entry.sha256 === prev) continue;
        prev = entry.sha256;
        out.push({ commitId: c.id, at: c.created_at, reason: c.reason, authorId: c.author_id || '', entry });
    }
    return out.reverse();
}
