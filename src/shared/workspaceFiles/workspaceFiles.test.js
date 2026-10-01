import test from 'node:test';
import assert from 'node:assert/strict';

import { documentPreviewKind, downloadUrlFor, fileExtensionOf, fileIconOf, isDocumentFile } from './index.js';

test('확장자는 ext 를 먼저 믿고, 없으면 이름에서 뽑는다', () => {
    assert.equal(fileExtensionOf({ ext: 'docx' }), '.docx');
    assert.equal(fileExtensionOf({ ext: '.PDF' }), '.pdf');
    assert.equal(fileExtensionOf({ name: '보고서.docx' }), '.docx');
    assert.equal(fileExtensionOf({ path: '/workspace/.bpmn/room/안내문.pdf' }), '.pdf');
    assert.equal(fileExtensionOf({ name: 'Makefile' }), '');
});

test('주소를 들고 오는 항목은 문서 산출물이다', () => {
    assert.equal(isDocumentFile({ document: true, url: 'https://u/a.docx' }), true);
    // 표식이 없는 옛 메시지도 주소가 있으면 문서로 본다.
    assert.equal(isDocumentFile({ url: 'https://u/a.docx' }), true);
    // 내용이 실려 오는 텍스트 산출물은 문서가 아니다.
    assert.equal(isDocumentFile({ name: 'a.md', content: '# x' }), false);
    assert.equal(isDocumentFile(null), false);
});

test('미리보기 가능한 형식은 그려 주고, 그 밖의 문서는 받게 한다', () => {
    assert.equal(documentPreviewKind({ document: true, name: 'a.pdf', url: 'u' }), 'pdf');
    assert.equal(documentPreviewKind({ document: true, name: 'a.png', url: 'u' }), 'image');
    // docx·xlsx·pptx 는 브라우저가 못 그린다 — 다운로드로 내준다.
    assert.equal(documentPreviewKind({ document: true, name: 'a.docx', url: 'u' }), 'none');
    assert.equal(documentPreviewKind({ document: true, name: 'a.xlsx', url: 'u' }), 'none');
    assert.equal(documentPreviewKind({ name: 'a.md', content: '# x' }), 'none');
});

test('문서도 아이콘을 갖는다 — 목록에서 무엇인지 알아보게', () => {
    assert.equal(fileIconOf('.docx'), 'mdi-file-word-outline');
    assert.equal(fileIconOf('pdf'), 'mdi-file-pdf-box');
    assert.equal(fileIconOf('.bpmn'), 'mdi-sitemap-outline');
    assert.equal(fileIconOf('.zip'), 'mdi-file-outline');
});

test('받은 파일이 사용자가 본 이름으로 떨어진다', () => {
    const signed = 'http://s/storage/v1/object/sign/artifacts/artifacts/9cc5011e.docx?token=t';
    // 크로스 오리진이라 <a download> 이름이 무시된다 — 주소에 이름을 실어 보낸다.
    assert.equal(downloadUrlFor(signed, '분기 보고.docx'), `${signed}&download=${encodeURIComponent('분기 보고.docx')}`);
    // 이미 실려 있으면 두 번 붙이지 않는다.
    assert.equal(downloadUrlFor(`${signed}&download=a.docx`, 'b.docx'), `${signed}&download=a.docx`);
    // 서명 주소가 아니면 손대지 않는다 — 다른 저장소의 주소를 망가뜨리지 않는다.
    assert.equal(downloadUrlFor('https://u/a.docx', 'a.docx'), 'https://u/a.docx');
    assert.equal(downloadUrlFor('', 'a.docx'), '');
});
