import test from 'node:test';
import assert from 'node:assert/strict';

import { canPreview, isDocx, isHwpx, isSlide, parsePayload, toArtifact } from './index.js';

test('코드블록에 싸여 와도 읽는다', () => {
    assert.deepEqual(parsePayload('```json\n{"a":1}\n```'), { a: 1 });
    assert.equal(parsePayload('그냥 글'), null);
});

test('슬라이드·워드·한글을 포털과 같은 규칙으로 가른다', () => {
    assert.equal(isSlide({ slide_markdown: '# x' }), true);
    assert.equal(isDocx({ file_name: '보고서.docx' }), true);
    assert.equal(isDocx({ content_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), true);
    assert.equal(isHwpx({ file_name: '공문.hwpx' }), true);
});

test('슬라이드 산출물을 뽑는다', () => {
    const a = toArtifact(JSON.stringify({ slide_markdown: '# 제목', deck_title: '분기 보고' }));
    assert.equal(a.kind, 'slide');
    assert.equal(a.title, '분기 보고');
    assert.equal(canPreview(a), true);
});

test('문서 산출물은 이름과 주소를 뽑는다', () => {
    const a = toArtifact(JSON.stringify({ file_name: '계획.hwpx', file_url: 'https://u/a.hwpx' }));
    assert.equal(a.kind, 'hwpx');
    assert.equal(a.title, '계획.hwpx');
    assert.equal(a.url, 'https://u/a.hwpx');
    // 한글 문서는 앱에서 바로 못 연다. 내려받아 밖에서 열어야 한다.
    assert.equal(canPreview(a), false);
});

test('앱에서 열 수 있는 것은 미리보기로 본다', () => {
    assert.equal(canPreview(toArtifact(JSON.stringify({ file_name: 'a.pdf', file_url: 'https://u/a.pdf' }))), true);
    assert.equal(canPreview(toArtifact(JSON.stringify({ file_name: 'a.png', url: 'https://u/a.png' }))), true);
});

test('산출물이 아니면 손대지 않는다', () => {
    assert.equal(toArtifact('휴가 신청 프로세스를 만들었습니다.'), null);
    assert.equal(toArtifact(JSON.stringify({ success: true })), null);
});
