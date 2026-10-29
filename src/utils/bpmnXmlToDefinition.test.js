/* eslint-env node, es2020 */
// 편집기 저장(BPMN XML → 정의)이 연결선 조건·게이트웨이 참조정보를 지우지 않는지 지킨다.
import test from 'node:test';
import assert from 'node:assert/strict';

import { convertXMLToJSON, keepStoredFlowConditions } from './bpmnXmlToDefinition.js';

globalThis.window = globalThis.window || {};
window.$mode = 'ProcessGPT';

const q = (obj) => JSON.stringify(obj).replace(/&/g, '&amp;').replace(/"/g, '&#34;');

// 편집기(bpmn-js)가 내보내는 모양: <uengine:properties json="…"/> (속성 형식)
function editorXml({ approveProps, rejectProps, gatewayProps = { role: '팀장' } }) {
    const props = (obj) =>
        obj === null
            ? '<bpmn:extensionElements><uengine:properties /></bpmn:extensionElements>'
            : `<bpmn:extensionElements><uengine:properties json="${q(obj)}" /></bpmn:extensionElements>`;
    return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:uengine="http://uengine" id="Definitions_1">
  <bpmn:process id="Process_1">
    <bpmn:startEvent id="start_event" />
    <bpmn:userTask id="review_leave" name="휴가 신청 검토">${props({ role: '팀장' })}</bpmn:userTask>
    <bpmn:exclusiveGateway id="approval_gateway" name="승인 여부 판단">${props(gatewayProps)}</bpmn:exclusiveGateway>
    <bpmn:userTask id="register_leave" name="휴가 등록">${props({ role: '직원' })}</bpmn:userTask>
    <bpmn:endEvent id="end_event" />
    <bpmn:sequenceFlow id="SequenceFlow_start_event_review_leave" sourceRef="start_event" targetRef="review_leave" />
    <bpmn:sequenceFlow id="SequenceFlow_review_leave_approval_gateway" sourceRef="review_leave" targetRef="approval_gateway" />
    <bpmn:sequenceFlow id="SequenceFlow_approval_gateway_register_leave" name="승인" sourceRef="approval_gateway" targetRef="register_leave">${props(
        approveProps
    )}</bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="SequenceFlow_approval_gateway_review_leave" name="반려" sourceRef="approval_gateway" targetRef="review_leave">${props(
        rejectProps
    )}</bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="SequenceFlow_register_leave_end_event" sourceRef="register_leave" targetRef="end_event" />
  </bpmn:process>
</bpmn:definitions>`;
}

// 대화로 만들어 저장된 정의(proc_def.definition) — 연결선 id 는 에이전트가 붙인 것이다.
function storedDefinition() {
    return {
        gateways: [{ id: 'approval_gateway', type: 'exclusiveGateway', conditionData: ['p_review_leave_form.approval_gateway_decision'] }],
        sequences: [
            { id: 'seq_review_to_gateway', source: 'review_leave', target: 'approval_gateway', condition: '', properties: '{}' },
            {
                id: 'seq_gateway_to_register',
                source: 'approval_gateway',
                target: 'register_leave',
                condition: '승인',
                properties: JSON.stringify({ conditionFunction: "approval_gateway_decision == '승인'" })
            },
            { id: 'seq_gateway_to_reapply', source: 'approval_gateway', target: 'review_leave', condition: '반려', properties: '{}' }
        ]
    };
}

const seq = (def, target) => def.sequences.find((s) => s.source === 'approval_gateway' && s.target === target);

test('연결선 조건을 json="" 속성(편집기 내보내기)에서 읽는다 — condition·properties', async () => {
    const xml = editorXml({
        approveProps: { condition: '승인', conditionMode: 'text', conditionFunction: "decision == '승인'" },
        rejectProps: { condition: '반려' }
    });
    const def = await convertXMLToJSON(xml, 'p');
    assert.equal(seq(def, 'register_leave').condition, '승인');
    assert.equal(seq(def, 'review_leave').condition, '반려');
    // 엔진(get_sequence_condition_data)은 properties 의 conditionFunction 을 먼저 평가한다.
    assert.deepEqual(JSON.parse(seq(def, 'register_leave').properties), {
        condition: '승인',
        conditionMode: 'text',
        conditionFunction: "decision == '승인'"
    });
});

test('<uengine:json> 자식 형식(BPMNXmlGenerator)도 그대로 읽는다', async () => {
    const xml = editorXml({ approveProps: null, rejectProps: null }).replace(
        '<bpmn:sequenceFlow id="SequenceFlow_approval_gateway_register_leave" name="승인" sourceRef="approval_gateway" targetRef="register_leave"><bpmn:extensionElements><uengine:properties /></bpmn:extensionElements>',
        '<bpmn:sequenceFlow id="SequenceFlow_approval_gateway_register_leave" name="승인" sourceRef="approval_gateway" targetRef="register_leave"><bpmn:extensionElements><uengine:properties><uengine:json>{"condition":"승인"}</uengine:json></uengine:properties></bpmn:extensionElements>'
    );
    const def = await convertXMLToJSON(xml, 'p');
    assert.equal(seq(def, 'register_leave').condition, '승인');
    assert.deepEqual(JSON.parse(seq(def, 'register_leave').properties), { condition: '승인' });
});

test('게이트웨이 properties 도 속성 형식에서 읽는다', async () => {
    const xml = editorXml({ approveProps: null, rejectProps: null, gatewayProps: { role: '팀장', conditionData: ['f.decision'] } });
    const def = await convertXMLToJSON(xml, 'p');
    const gw = def.gateways.find((g) => g.id === 'approval_gateway');
    assert.deepEqual(gw.conditionData, ['f.decision']);
    assert.deepEqual(JSON.parse(gw.properties), { role: '팀장', conditionData: ['f.decision'] });
});

test('XML 에 없는 조건·conditionData 는 저장돼 있던 정의에서 이어 받는다(연결선 id 가 바뀌어도 source→target 으로)', async () => {
    // 조건이 XML 에 실리지 않은 경우(대화로 만든 BPMN 은 conditionData 를 XML 에 쓰지 않는다)
    const def = await convertXMLToJSON(editorXml({ approveProps: null, rejectProps: null }), 'p');
    assert.equal(seq(def, 'register_leave').condition, '');
    assert.deepEqual(def.gateways.find((g) => g.id === 'approval_gateway').conditionData, []);

    keepStoredFlowConditions(def, storedDefinition());
    assert.equal(seq(def, 'register_leave').condition, '승인');
    assert.equal(seq(def, 'review_leave').condition, '반려');
    assert.equal(JSON.parse(seq(def, 'register_leave').properties).conditionFunction, "approval_gateway_decision == '승인'");
    assert.deepEqual(def.gateways.find((g) => g.id === 'approval_gateway').conditionData, [
        'p_review_leave_form.approval_gateway_decision'
    ]);
    // 조건이 없던 선은 그대로
    const plain = def.sequences.find((s) => s.source === 'review_leave' && s.target === 'approval_gateway');
    assert.equal(plain.condition, '');
});

test('편집기에서 직접 바꾸거나 지운 값은 이어 받지 않는다', async () => {
    const def = await convertXMLToJSON(
        editorXml({
            approveProps: { condition: '팀장 승인' },
            rejectProps: { condition: '' },
            gatewayProps: { role: '팀장', conditionData: [] }
        }),
        'p'
    );
    keepStoredFlowConditions(def, storedDefinition());
    assert.equal(seq(def, 'register_leave').condition, '팀장 승인');
    assert.deepEqual(JSON.parse(seq(def, 'register_leave').properties), { condition: '팀장 승인' });
    assert.equal(seq(def, 'review_leave').condition, '');
    assert.deepEqual(def.gateways.find((g) => g.id === 'approval_gateway').conditionData, []);
});

test('같은 두 점을 잇는 저장된 선이 여럿이면 어느 것인지 모르므로 이어 받지 않는다', () => {
    const next = { sequences: [{ id: 'SequenceFlow_a_b', source: 'a', target: 'b', condition: '', properties: '{}' }], gateways: [] };
    const stored = {
        sequences: [
            { id: 's1', source: 'a', target: 'b', condition: 'x' },
            { id: 's2', source: 'a', target: 'b', condition: 'y' }
        ]
    };
    keepStoredFlowConditions(next, stored);
    assert.equal(next.sequences[0].condition, '');
    // id 가 같으면 그것을 쓴다
    next.sequences[0].id = 's2';
    keepStoredFlowConditions(next, stored);
    assert.equal(next.sequences[0].condition, 'y');
});
