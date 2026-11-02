import test from 'node:test';
import assert from 'node:assert/strict';

import { pickPreviewSource } from './formPreviewSource.js';

const SAVED = '<section><text-field name="proposal" alias="제안서"></text-field></section>';
const DRAFT = '<section><text-field name="client_name" alias="고객사명"></text-field></section>';
const EDITOR = '<section><text-field name="client_email" alias="이메일"></text-field></section>';

test('미리보기는 저장본보다 넘겨받은 편집본을 그린다', () => {
    // 편집 탭에서 AI로 고친 뒤 미리보기 탭을 열면, 편집기 없는 미리보기에 편집본만 넘어온다
    assert.equal(pickPreviewSource({ editorHtml: '', draftHtml: DRAFT, savedHtml: SAVED }), DRAFT);
});

test('편집기가 있으면 편집기의 현재 내용이 가장 앞선다', () => {
    assert.equal(pickPreviewSource({ editorHtml: EDITOR, draftHtml: DRAFT, savedHtml: SAVED }), EDITOR);
});

test('편집본이 없으면 저장본, 둘 다 없으면 빈 폼', () => {
    assert.equal(pickPreviewSource({ editorHtml: '', draftHtml: '', savedHtml: SAVED }), SAVED);
    assert.equal(pickPreviewSource({}), '');
});
