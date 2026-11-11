/**
 * 정의 JSON(proc_def.definition)이 흐름도(BPMN XML)와 같은 연결선을 갖는지 지킨다.
 *
 * 실제 사고(VM 녹화): 딥 에이전트의 process-definition.json(elements[])에 시작 이벤트에서 나가는 Sequence 가
 * 없고 첫 액티비티에 source:'start' 만 있었다. 흐름도는 BPMNXmlGenerator.ensureSequenceGuardrails 가 그
 * source 로 화살표를 채워 그렸지만, 정의 JSON 으로 바꾸는 elementsToFlattenedDefinition 은 그러지 않아
 * 저장된 정의에 시작 연결선이 없었다 → 실행이 첫 단계를 건너뜀.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { elementsToFlattenedDefinition } from './elementsToFlattened.js';

/** VM 샌드박스의 process-definition.json 과 같은 모양(내용은 줄임). */
function generatedQuoteProcess() {
    return {
        processDefinitionId: '한빛오피스 대량 주문 견적 승인',
        processDefinitionName: '한빛오피스 대량 주문 견적 승인',
        roles: [{ name: '영업 담당' }],
        elements: [
            { elementType: 'Event', id: 'start', type: 'StartEvent', role: '영업 담당' },
            { elementType: 'Activity', id: 'request_quote', type: 'UserActivity', role: '영업 담당', source: 'start' },
            { elementType: 'Sequence', id: 'seq_req_to_stock', source: 'request_quote', target: 'check_stock' },
            { elementType: 'Activity', id: 'check_stock', type: 'UserActivity', role: '재고 확인 에이전트', source: 'request_quote' },
            { elementType: 'Sequence', id: 'seq_stock_to_gw', source: 'check_stock', target: 'approval_gateway' },
            { elementType: 'Gateway', id: 'approval_gateway', type: 'ExclusiveGateway', source: 'check_stock' },
            { elementType: 'Sequence', id: 'seq_gw_a', source: 'approval_gateway', target: 'approve', condition: '미만' },
            { elementType: 'Sequence', id: 'seq_gw_b', source: 'approval_gateway', target: 'approve', condition: '이상' },
            { elementType: 'Activity', id: 'approve', type: 'UserActivity', role: '영업팀장', source: 'approval_gateway' },
            { elementType: 'Sequence', id: 'seq_approve_end', source: 'approve', target: 'end' },
            { elementType: 'Event', id: 'end', type: 'EndEvent', role: '영업 담당' }
        ]
    };
}

test('source 에만 적힌 시작 연결선을 흐름도와 같은 id 로 정의에도 넣는다', () => {
    const flat = elementsToFlattenedDefinition(generatedQuoteProcess());
    const fromStart = flat.sequences.filter((s) => s.source === 'start');
    assert.deepEqual(fromStart, [
        // BPMNXmlGenerator.ensureSequenceGuardrails 가 그림에 넣는 것과 같은 id 규칙
        { id: 'seq_start_request_quote', name: '', source: 'start', target: 'request_quote', condition: '', properties: '{}' }
    ]);
});

test('이미 있는 연결선은 되풀이하지 않는다(조건이 다른 두 갈래도 그대로)', () => {
    const flat = elementsToFlattenedDefinition(generatedQuoteProcess());
    assert.equal(flat.sequences.length, 6, '원래 5개 + 시작 연결선 1개');
    assert.deepEqual(
        flat.sequences.filter((s) => s.source === 'approval_gateway').map((s) => s.condition),
        ['미만', '이상']
    );
});

test('정의에 없는 노드를 가리키는 source 나 none 은 연결선을 만들지 않는다', () => {
    const pd = generatedQuoteProcess();
    pd.elements.push({ elementType: 'Activity', id: 'orphan', type: 'UserActivity', source: 'ghost_node' });
    pd.elements.push({ elementType: 'Activity', id: 'manual', type: 'UserActivity', source: 'none' });
    const flat = elementsToFlattenedDefinition(pd);
    assert.equal(
        flat.sequences.some((s) => s.target === 'orphan' || s.target === 'manual'),
        false
    );
});

test('만든 연결선 id 가 이미 쓰인 id 와 겹치면 번호를 붙인다', () => {
    const pd = generatedQuoteProcess();
    // 다른 곳을 잇는 연결선이 우연히 같은 id 를 쓰고 있다.
    pd.elements.push({ elementType: 'Sequence', id: 'seq_start_request_quote', source: 'approve', target: 'request_quote' });
    const flat = elementsToFlattenedDefinition(pd);
    const ids = flat.sequences.map((s) => s.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(flat.sequences.some((s) => s.id === 'seq_start_request_quote_1' && s.source === 'start'));
});
