import test from 'node:test';
import assert from 'node:assert/strict';
import { branchFilesForPanel } from './artifactBranchFiles.js';

const e = (h, size = 10) => ({ sha256: h.repeat(64).slice(0, 64), size, content_type: '' });

test('갈래마다 묶고, 이 방을 먼저, 기준 이후 추가·변경만 표시한다', async () => {
    const info = {
        branches: [
            {
                roomId: 'park',
                mine: false,
                event: { to_user_name: '박대리', next_activity_label: '원가 산정', occurred_at: '2026-10-26T02:00:00Z' },
                tree: { '원가표.csv': e('2'), '견적서.docx': e('1') },
                changes: { added: ['원가표.csv'], modified: [], removed: [] }
            },
            {
                roomId: 'lee',
                mine: false,
                event: { to_user_name: '이팀장', next_activity_label: '견적 검토', occurred_at: '2026-10-26T01:00:00Z' },
                tree: { '견적서.docx': e('3') },
                changes: { added: [], modified: ['견적서.docx'], removed: [] }
            },
            { roomId: 'me', mine: true, tree: { '견적서.docx': e('1') }, changes: { added: [], modified: [], removed: [] } }
        ]
    };
    const files = await branchFilesForPanel(info, (x) => `https://s/${x.sha256.slice(0, 1)}`, { mine: '내 방' }, async (url) => `text of ${url}`);
    assert.deepEqual(
        files.map((f) => [f.group, f.name, f.op]),
        [
            ['내 방', '견적서.docx', 'same'],
            ['이팀장 · 견적 검토', '견적서.docx', 'edit'],
            ['박대리 · 원가 산정', '견적서.docx', 'same'],
            ['박대리 · 원가 산정', '원가표.csv', 'create']
        ]
    );
    const docx = files[1];
    assert.equal(docx.document, true);
    assert.equal(docx.url, 'https://s/3');
    assert.equal(docx.path, 'lee/견적서.docx', '방마다 경로가 겹치지 않는다');
    const csv = files[3];
    assert.equal(csv.content, 'text of https://s/2');
    assert.equal(csv.document, undefined);
});

test('fileVersions 는 내용이 달라진 커밋만 최신 먼저 돌려준다', async () => {
    const { fileVersions } = await import('./artifactBranchFiles.js');
    const commits = [
        { id: 'c4', created_at: '4', reason: 'task_done', tree: { a: e('3') } },
        { id: 'c3', created_at: '3', reason: 'agent_turn', tree: { a: e('2'), b: e('9') } },
        { id: 'c2', created_at: '2', reason: 'agent_turn', tree: { a: e('2') } },
        { id: 'c1', created_at: '1', reason: 'handover', tree: { a: e('1') } }
    ];
    assert.deepEqual(fileVersions(commits, 'a').map((v) => v.commitId), ['c4', 'c2', 'c1']);
    assert.deepEqual(fileVersions(commits, 'b').map((v) => v.commitId), ['c3']);
});

test('주소를 Promise 로 주어도 글 내용을 받는다(화면 backend 는 메서드를 비동기로 감싼다)', async () => {
    const info = { branches: [{ roomId: 'r', mine: true, tree: { 'a.md': e('1') }, changes: {} }] };
    const files = await branchFilesForPanel(info, async () => 'https://s/a', {}, async (url) => `got ${url}`);
    assert.equal(files[0].content, 'got https://s/a');
    assert.equal(files[0].document, undefined);
});
