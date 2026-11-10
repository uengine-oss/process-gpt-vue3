import test from 'node:test';
import assert from 'node:assert/strict';
import { fieldTypeLabel } from './fieldRegistry.js';

const ko = { 'formBuilder.type.text': '텍스트', 'formBuilder.type.boolean': '예/아니오', 'formBuilder.type.userSelect': '사용자 선택' };
const en = { 'formBuilder.type.text': 'Text', 'formBuilder.type.boolean': 'Yes/No' };
const translator = (messages) => (key) => messages[key] || null;

test('새 필드의 보이는 이름은 지금 언어의 필드 종류 이름이다', () => {
    assert.equal(fieldTypeLabel('text-field', translator(ko)), '텍스트');
    assert.equal(fieldTypeLabel('BOOLEAN-FIELD', translator(ko)), '예/아니오', '예전 편집기는 DOM 태그 이름(대문자)을 넘긴다');
    assert.equal(fieldTypeLabel('user-select-field', translator(ko)), '사용자 선택', 'user-select → userSelect 키');
    assert.equal(fieldTypeLabel('boolean-field', translator(en)), 'Yes/No');
});

test('번역이 없으면 팔레트 이름, 모르는 태그면 빈 문자열', () => {
    assert.equal(fieldTypeLabel('folder-field', translator(ko)), '폴더');
    assert.equal(fieldTypeLabel('text-field'), '텍스트');
    assert.equal(fieldTypeLabel('unknown-field', translator(ko)), '');
});
