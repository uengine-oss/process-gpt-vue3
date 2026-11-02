/* eslint-env node, es2020 */
/**
 * 편집기 저장 경로(ProcessDefinitionModule.saveDefinition) — XML 에서 다시 만든 정의를 저장돼 있던 정의와
 * 합치는 mergeProcessDefinitionActivities 가 무엇을 지키는지 고정한다.
 *
 * 실제 사고(튜토리얼 조사 A): 대화로 만든 휴가 신청 프로세스를 편집기에서 열어 레인 담당자만 바꾸고 저장하자
 * 승인/반려 연결선의 condition 과 게이트웨이 conditionData 가 비었다(버전 0.1~0.5 모두). 엔진은 갈림길을
 * 연결선 이름만 보고 LLM 으로 골랐다. activity 의 tool·agent·agentMode·orchestration·skills 는 이 병합이
 * 이전 값으로 보완해 남았다.
 *
 * SFC 를 번들 없이 테스트하려고 메서드 본문을 파일에서 꺼내 쓴다(ChatRoomPage.serverContent.test.js 와 같은 방식).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as bpmnXmlToDefinition from '../utils/bpmnXmlToDefinition.js';

globalThis.window = globalThis.window || {};
window.$mode = 'ProcessGPT';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(HERE, 'ProcessDefinitionModule.vue'), 'utf8');

function extractMethod(name) {
    const start = source.indexOf(`\n        ${name}(`);
    assert.notEqual(start, -1, `method not found in ProcessDefinitionModule.vue: ${name}`);
    const paramStart = source.indexOf('(', start);
    let parens = 0;
    let cursor = paramStart;
    for (; cursor < source.length; cursor++) {
        if (source[cursor] === '(') parens++;
        else if (source[cursor] === ')' && --parens === 0) break;
    }
    const bodyStart = source.indexOf('{', cursor);
    let depth = 0;
    let end = bodyStart;
    for (; end < source.length; end++) {
        if (source[end] === '{') depth++;
        else if (source[end] === '}' && --depth === 0) break;
    }
    return `${name}: function ${source.slice(paramStart, cursor + 1)}${source.slice(bodyStart, end + 1)}`;
}

const METHODS = [
    'cloneJsonSafe',
    'isPlainObject',
    'isPlaceholderString',
    'shouldFallbackToPrevious',
    'mergeValueWithFallback',
    'collectActivitiesForMerge',
    'buildPreviousActivityMap',
    'mergeActivitiesArrayWithMap',
    'mergeSubProcessActivitiesRecursively',
    'mergeProcessDefinitionActivities'
];

function buildModule() {
    // 꺼낸 메서드가 모듈 스코프에서 쓰는 import 들
    Object.assign(globalThis, bpmnXmlToDefinition);
    // eslint-disable-next-line no-eval
    return (0, eval)(`({${METHODS.map(extractMethod).join(',\n')}})`);
}

const q = (obj) => JSON.stringify(obj).replace(/&/g, '&amp;').replace(/"/g, '&#34;');
const props = (obj) => `<bpmn:extensionElements><uengine:properties json="${q(obj)}" /></bpmn:extensionElements>`;

// 편집기가 내보낸 XML — 조사 A 의 버전 0.1 스냅샷과 같은 모양(activity JSON 에 role 만, 연결선 확장 비어 있음).
const EDITOR_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:uengine="http://uengine" id="Definitions_1">
  <bpmn:process id="Process_1">
    <bpmn:startEvent id="start_event" />
    <bpmn:userTask id="review_leave" name="휴가 신청 검토">${props({ role: '팀장' })}</bpmn:userTask>
    <bpmn:exclusiveGateway id="approval_gateway" name="승인 여부 판단">${props({ role: '팀장' })}</bpmn:exclusiveGateway>
    <bpmn:userTask id="register_leave" name="휴가 등록">${props({ role: '직원' })}</bpmn:userTask>
    <bpmn:endEvent id="end_event" />
    <bpmn:sequenceFlow id="SequenceFlow_start_event_review_leave" sourceRef="start_event" targetRef="review_leave" />
    <bpmn:sequenceFlow id="SequenceFlow_review_leave_approval_gateway" sourceRef="review_leave" targetRef="approval_gateway" />
    <bpmn:sequenceFlow id="SequenceFlow_approval_gateway_register_leave" name="승인" sourceRef="approval_gateway" targetRef="register_leave"><bpmn:extensionElements><uengine:properties /></bpmn:extensionElements></bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="SequenceFlow_approval_gateway_review_leave" name="반려" sourceRef="approval_gateway" targetRef="review_leave"><bpmn:extensionElements><uengine:properties /></bpmn:extensionElements></bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="SequenceFlow_register_leave_end_event" sourceRef="register_leave" targetRef="end_event" />
  </bpmn:process>
</bpmn:definitions>`;

const P = '3ca712d5-07a5-488c-9ae3-99a409d4c022';

// 대화 「저장」이 남긴 proc_def.definition
function storedDefinition() {
    return {
        processDefinitionId: P,
        activities: [
            {
                id: 'review_leave',
                name: '휴가 신청 검토',
                role: '팀장',
                tool: `formHandler:${P}_review_leave_form`,
                agent: 'a5f0c3e2-0000-4000-8000-000000000001',
                agentMode: 'draft',
                orchestration: 'deepagents',
                skills: ['leave-policy'],
                inputData: [`${P}_apply_leave_form.reason`]
            },
            { id: 'register_leave', name: '휴가 등록', role: '직원', tool: `formHandler:${P}_register_leave_form` }
        ],
        gateways: [
            { id: 'approval_gateway', type: 'exclusiveGateway', conditionData: [`${P}_review_leave_form.approval_gateway_decision`] }
        ],
        sequences: [
            { id: 'seq_review_to_gateway', source: 'review_leave', target: 'approval_gateway', condition: '', properties: '{}' },
            { id: 'seq_gateway_to_register', source: 'approval_gateway', target: 'register_leave', condition: '승인', properties: '{}' },
            { id: 'seq_gateway_to_reapply', source: 'approval_gateway', target: 'review_leave', condition: '반려', properties: '{}' }
        ]
    };
}

test('편집기 저장 — 연결선 condition·게이트웨이 conditionData 가 남는다', async () => {
    const mod = buildModule();
    const next = await bpmnXmlToDefinition.convertXMLToJSON(EDITOR_XML, P);
    mod.mergeProcessDefinitionActivities(next, storedDefinition());

    const byTarget = (target) => next.sequences.find((s) => s.source === 'approval_gateway' && s.target === target);
    assert.equal(byTarget('register_leave').condition, '승인');
    assert.equal(byTarget('review_leave').condition, '반려');
    assert.deepEqual(next.gateways.find((g) => g.id === 'approval_gateway').conditionData, [
        `${P}_review_leave_form.approval_gateway_decision`
    ]);
});

test('편집기 저장 — activity 의 tool·agent·agentMode·orchestration·skills·inputData 는 이전 값으로 남는다', async () => {
    const mod = buildModule();
    const next = await bpmnXmlToDefinition.convertXMLToJSON(EDITOR_XML, P);
    const fromXml = next.activities.find((a) => a.id === 'review_leave');
    // XML 만으로는 비어 있다(BPMNXmlGenerator·편집기 모두 이 값을 XML 에 쓰지 않는다)
    assert.equal(fromXml.agent, '');
    assert.equal(fromXml.tool, 'formHandler:defaultform');

    mod.mergeProcessDefinitionActivities(next, storedDefinition());
    const merged = next.activities.find((a) => a.id === 'review_leave');
    assert.equal(merged.tool, `formHandler:${P}_review_leave_form`);
    assert.equal(merged.agent, 'a5f0c3e2-0000-4000-8000-000000000001');
    assert.equal(merged.agentMode, 'draft');
    assert.equal(merged.orchestration, 'deepagents');
    assert.deepEqual(merged.skills, ['leave-policy']);
    assert.deepEqual(merged.inputData, [`${P}_apply_leave_form.reason`]);
});
