import test from 'node:test';
import assert from 'node:assert/strict';
import { diffTrees, pickTree, rebaseChanges, mergeTrees, commitRoom, putObject, sha256Hex, objectKey } from './artifactWorktree.js';

const e = (h) => ({ sha256: h.repeat(64).slice(0, 64), size: 1, content_type: 'text/plain' });

test('diffTrees 는 추가·변경·삭제를 나눈다', () => {
    const d = diffTrees({ a: e('1'), b: e('2'), c: e('3') }, { a: e('1'), b: e('9'), d: e('4') });
    assert.deepEqual(d, { added: ['d'], modified: ['b'], removed: ['c'] });
});

test('pickTree 는 고른 경로만 남긴다', () => {
    assert.deepEqual(Object.keys(pickTree({ a: e('1'), b: e('2'), c: e('3') }, ['a', 'c', 'x'])), ['a', 'c']);
});

test('rebaseChanges 는 내가 바꾼 경로만 새 head 위에 얹는다', () => {
    const base = { a: e('1'), b: e('2') };
    const mine = { a: e('5'), c: e('6') }; // a 고침, b 지움, c 추가
    const theirs = { a: e('1'), b: e('2'), d: e('7') }; // 남이 d 추가
    assert.deepEqual(rebaseChanges(base, mine, theirs), { a: e('5'), c: e('6'), d: e('7') });
});

test('mergeTrees: 한쪽만 바꾼 경로는 그 내용, 같은 내용이면 충돌 아님', () => {
    const base = { 견적서: e('1'), 원가표: e('2') };
    const { tree, conflicts } = mergeTrees(base, [
        { key: 'me', tree: base },
        { key: 'lee', tree: { 견적서: e('3'), 원가표: e('2') } },
        { key: 'park', tree: { 견적서: e('1'), 원가표: e('4'), 신규: e('5') } },
        { key: 'kim', tree: { 견적서: e('3'), 원가표: e('2') } }
    ]);
    assert.equal(conflicts.length, 0);
    assert.deepEqual(tree, { 견적서: e('3'), 원가표: e('4'), 신규: e('5') });
});

test('mergeTrees: 서로 다르게 바꾼 경로는 충돌이고, 고르면 그 쪽', () => {
    const base = { 견적서: e('1') };
    const sides = [
        { key: 'me', tree: base },
        { key: 'lee', tree: { 견적서: e('3') } },
        { key: 'park', tree: { 견적서: e('4') } }
    ];
    const open = mergeTrees(base, sides);
    assert.deepEqual(open.conflicts.map((c) => [c.path, c.sides.map((s) => s.key)]), [['견적서', ['lee', 'park']]]);
    assert.deepEqual(mergeTrees(base, sides, { 견적서: 'park' }), { tree: { 견적서: e('4') }, conflicts: [] });
});

test('mergeTrees: 한 갈래가 지우고 다른 갈래가 고치면 충돌', () => {
    const base = { a: e('1') };
    const r = mergeTrees(base, [{ key: 'x', tree: {} }, { key: 'y', tree: { a: e('2') } }]);
    assert.equal(r.conflicts.length, 1);
    assert.deepEqual(mergeTrees(base, [{ key: 'x', tree: {} }, { key: 'y', tree: { a: e('2') } }], { a: 'x' }).tree, {});
});

function fakeSb({ heads, failTimes = 0 }) {
    const calls = [];
    let fails = failTimes;
    return {
        calls,
        from(table) {
            const q = { filters: {} };
            const api = {
                select: () => api,
                eq: (k, v) => ((q.filters[k] = v), api),
                maybeSingle: async () => {
                    if (table === 'artifact_branches') return { data: { room_id: q.filters.room_id, head_commit_id: heads.current }, error: null };
                    return { data: { id: q.filters.id, tree: heads.trees[q.filters.id], created_at: '2026-10-26T00:00:00Z' }, error: null };
                }
            };
            return api;
        },
        async rpc(name, args) {
            calls.push({ name, args });
            if (fails > 0) {
                fails -= 1;
                // 그 사이 다른 커밋이 head 를 옮겼다.
                heads.trees.h2 = { ...heads.trees[heads.current], other: e('8') };
                heads.current = 'h2';
                return { data: null, error: { code: '40001', message: 'artifact: head 가 바뀌었습니다' } };
            }
            return { data: { commit_id: 'new', created: true }, error: null };
        }
    };
}

test('commitRoom 은 head 가 바뀌면 새 head 위에서 다시 계산해 커밋한다', async () => {
    const heads = { current: 'h1', trees: { h1: { a: e('1') } } };
    const sb = fakeSb({ heads, failTimes: 1 });
    const base = { a: e('1') };
    const mine = { a: e('2') };
    const r = await commitRoom(sb, { roomId: 'r', reason: 'agent_turn', change: (tree) => rebaseChanges(base, mine, tree) });
    assert.equal(r.created, true);
    assert.equal(sb.calls.length, 2);
    assert.equal(sb.calls[1].args.p_expected_head, 'h2');
    assert.deepEqual(sb.calls[1].args.p_tree, { a: e('2'), other: e('8') });
});

test('commitRoom 병합은 지금 head 를 첫 부모로 넣는다', async () => {
    const heads = { current: 'h1', trees: { h1: {} } };
    const sb = fakeSb({ heads });
    await commitRoom(sb, { roomId: 'r', reason: 'merge', parents: ['g1', 'g2'], change: () => ({}) });
    assert.deepEqual(sb.calls[0].args.p_parents, ['h1', 'g1', 'g2']);
});

test('putObject 는 같은 내용이 이미 있으면 성공으로 본다', async () => {
    const uploads = [];
    const sb = {
        storage: {
            from: () => ({
                upload: async (key) => {
                    uploads.push(key);
                    return uploads.length > 1 ? { error: { statusCode: '409', message: 'The resource already exists' } } : { error: null };
                }
            })
        }
    };
    const blob = new Blob(['같은 내용']);
    const a = await putObject(sb, 't', blob, '견적서.md');
    const b = await putObject(sb, 't', new Blob(['같은 내용']), '다른이름.md');
    assert.equal(a.sha256, b.sha256);
    assert.equal(a.content_type, 'text/markdown');
    assert.deepEqual(uploads, [objectKey('t', a.sha256), objectKey('t', a.sha256)]);
    assert.equal(a.sha256, await sha256Hex(new Blob(['같은 내용'])));
});

test('sideTree: 일부만 받은 갈래는 받지 않은 파일을 지운 것이 아니다', async () => {
    const { sideTree } = await import('./artifactWorktree.js');
    const base = { 견적서: e('1'), 원가표: e('2'), 메모: e('3') };
    const start = { 견적서: e('1') }; // 견적서만 받았다
    const head = { 견적서: e('5'), 검토의견: e('6') };
    assert.deepEqual(sideTree(base, start, head), { 견적서: e('5'), 원가표: e('2'), 메모: e('3'), 검토의견: e('6') });
    const merged = mergeTrees(base, [
        { key: 'me', tree: base },
        { key: 'lee', tree: sideTree(base, start, head) },
        { key: 'park', tree: sideTree(base, { 원가표: e('2') }, { 원가표: e('7') }) }
    ]);
    assert.deepEqual(merged.tree, { 견적서: e('5'), 원가표: e('7'), 메모: e('3'), 검토의견: e('6') });
    assert.equal(merged.conflicts.length, 0);
});

test('treePathOf: 이 방 작업 폴더 경로만 tree 경로로 바꾼다', async () => {
    const { treePathOf } = await import('./artifactWorktree.js');
    assert.equal(treePathOf('/workspace/.bpmn/r1/견적서.md', 'r1'), '견적서.md');
    assert.equal(treePathOf('/workspace/.bpmn/r1/sub/원가표.md', 'r1'), 'sub/원가표.md');
    assert.equal(treePathOf('/workspace/.bpmn/r0/견적서.md', 'r1'), null); // 다른 방 폴더
    assert.equal(treePathOf('', 'r1'), null);
});

test('commitEditedFile: 고친 파일을 올리고 그 경로만 바꿔 edit 으로 커밋한다', async () => {
    const { commitEditedFile } = await import('./artifactWorktree.js');
    const heads = { current: 'h1', trees: { h1: { '견적서.md': e('1'), '원가표.md': e('2') } } };
    const sb = fakeSb({ heads });
    const uploads = [];
    sb.storage = { from: () => ({ upload: async (key) => (uploads.push(key), { error: null }) }) };
    const r = await commitEditedFile(sb, { tenantId: 't', roomId: 'r', path: '견적서.md', content: '합계: 2,700만원' });
    assert.equal(r.created, true);
    assert.equal(uploads.length, 1);
    const call = sb.calls[0];
    assert.equal(call.args.p_reason, 'edit');
    assert.equal(call.args.p_expected_head, 'h1');
    assert.notEqual(call.args.p_tree['견적서.md'].sha256, e('1').sha256);
    assert.deepEqual(call.args.p_tree['원가표.md'], e('2')); // 다른 파일은 그대로
});

test('commitEditedFile: 브랜치가 없는 방은 아무것도 하지 않는다', async () => {
    const { commitEditedFile } = await import('./artifactWorktree.js');
    const sb = { from: () => ({ select: () => sb.from(), eq: () => sb.from(), maybeSingle: async () => ({ data: null, error: null }) }), rpc: async () => assert.fail('커밋하면 안 된다') };
    assert.equal(await commitEditedFile(sb, { tenantId: 't', roomId: 'old', path: 'a.md', content: 'x' }), null);
});
