/**
 * 저장되는 프로세스 설명이 편집기에서 쓴 설명(shortDescription.text)인가.
 * 예전에는 'process.description' 글자를 고정으로 넣어, Lite 개선 화면 같은 곳에 그 글자가 그대로 보였다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { convertXMLToJSON } from './bpmnXmlToDefinition.js';

const xml = (json) => `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:uengine="http://uengine" id="d1">
  <bpmn:process id="p1" isExecutable="true">
    ${json ? `<bpmn:extensionElements><uengine:properties><uengine:json>${json}</uengine:json></uengine:properties></bpmn:extensionElements>` : ''}
    <bpmn:startEvent id="s1" />
  </bpmn:process>
</bpmn:definitions>`;

test('편집기에서 쓴 설명을 프로세스 설명으로 저장한다', async () => {
    const def = await convertXMLToJSON(xml(JSON.stringify({ definitionName: '계약서 검토', shortDescription: { text: 'NDA 를 검토한다' } })), 'p1');
    assert.equal(def.description, 'NDA 를 검토한다');
});

test('설명이 없으면 자리표시 글자 대신 빈 값이다', async () => {
    const def = await convertXMLToJSON(xml(JSON.stringify({ definitionName: '계약서 검토', shortDescription: { text: '' } })), 'p1');
    assert.equal(def.description, '');
    const bare = await convertXMLToJSON(xml(null), 'p1');
    assert.equal(bare.description, '');
});
