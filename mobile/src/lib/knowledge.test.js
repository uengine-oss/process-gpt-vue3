/**
 * 지식 베이스 문서 목록.
 *
 * 지키려는 것: **앱에서 고른 문서를 에이전트가 찾을 수 있는 것.**
 * 담아 보내는 모양이 포털과 다르면 문서를 고른 것처럼 보여도 실제로는 안 쓰인다.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { filterDocs, isPicked, toDoc, toDocs, togglePick } from './knowledge.js';

const detail = {
    file_name: '연차규정.pdf',
    folder_path: '인사',
    mime_type: 'application/pdf',
    source_type: 'drive',
    source_ref: 'abc123'
};

test('참조가 있으면 그것으로 구분한다', () => {
    assert.equal(toDoc(detail).key, 'drive:abc123');
});

test('참조가 없으면 폴더와 이름으로 구분한다', () => {
    // 같은 파일명이 여러 폴더에 있을 수 있다. 이름만 쓰면 서로 덮어쓴다.
    const noRef = { ...detail, source_ref: null };

    assert.equal(toDoc(noRef).key, '인사::연차규정.pdf');
});

test('폴더 이름이 다른 키로 올 때도 읽는다', () => {
    const alt = { file_name: 'a.pdf', drive_folder_name: '공유' };

    assert.equal(toDoc(alt).folderPath, '공유');
});

test('파일 이름이 없으면 버린다', () => {
    assert.equal(toDoc({ source_ref: 'x' }), null);
    assert.equal(toDoc(null), null);
});

test('목록을 이름 순으로 세운다', () => {
    // 폰에서는 검색보다 훑기가 먼저다.
    const docs = toDocs({
        file_details: [
            { file_name: '나중.pdf', source_ref: '2' },
            { file_name: '가나다.pdf', source_ref: '1' }
        ]
    });

    assert.deepEqual(docs.map((d) => d.name), ['가나다.pdf', '나중.pdf']);
});

test('응답이 비어도 터지지 않는다', () => {
    assert.deepEqual(toDocs(null), []);
    assert.deepEqual(toDocs({}), []);
    assert.deepEqual(toDocs({ file_details: 'x' }), []);
});

// ---------------------------------------------------------------------------
// 고르기
// ---------------------------------------------------------------------------

const a = toDoc(detail);
const b = toDoc({ file_name: '급여규정.pdf', source_ref: 'def' });

test('이름으로 걸러낸다', () => {
    assert.deepEqual(filterDocs([a, b], '연차').map((d) => d.name), ['연차규정.pdf']);
});

test('폴더로도 걸러낸다', () => {
    // 같은 이름의 파일이 여럿일 때 사용자는 폴더로 구분한다.
    assert.deepEqual(filterDocs([a, b], '인사').map((d) => d.name), ['연차규정.pdf']);
});

test('검색어가 없으면 전부 보여 준다', () => {
    assert.equal(filterDocs([a, b], '').length, 2);
    assert.equal(filterDocs([a, b], '   ').length, 2);
});

test('같은 문서를 두 번 담지 않는다', () => {
    const once = togglePick([], a);
    const twice = togglePick(once, a);

    assert.equal(once.length, 1);
    assert.equal(twice.length, 0, '다시 누르면 빠진다');
});

test('고른 것을 알아본다', () => {
    assert.equal(isPicked([a], a), true);
    assert.equal(isPicked([a], b), false);
    assert.equal(isPicked(null, a), false);
});
