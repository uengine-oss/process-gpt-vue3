/**
 * 실행이 첫 단계를 건너뛰지 않는지 지킨다.
 *
 * 실제 사고(VM 녹화, 「한빛오피스 대량 주문 견적 승인」): 저장된 proc_def.definition 에 시작 이벤트에서
 * 나가는 연결선이 없었다(그림 XML 에는 SequenceFlow_start_request_quote 가 있음). 그래프 규칙의 시작
 * 지점(들어오는 선 없는 노드)이 첫 액티비티 「견적 요청 접수」 자신이 됐고, findStartActivity 는 그
 * "다음" 액티비티 「재고 확인」을 돌려줘 실행 창이 재고 확인부터 열렸다. 실행 엔진의 start-activity 도
 * 같은 규칙이라 같은 답을 줬다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { findStartActivity, findStartNodeId, hasDanglingStartEvent } from './processStart.ts';

const act = (id, role = '영업 담당') => ({ id, name: id, role, type: 'userTask' });
const seq = (source, target) => ({ id: `${source}->${target}`, source, target, condition: '' });

/** VM 에 저장된 정의와 같은 모양 — 시작 이벤트에서 나가는 연결선만 빠졌다. */
function savedQuoteDefinition() {
    return {
        processDefinitionId: '한빛오피스 대량 주문 견적 승인',
        events: [
            { id: 'start', type: 'startEvent', name: '견적 요청 접수 시작' },
            { id: 'end', type: 'endEvent', name: '견적 프로세스 종료' }
        ],
        gateways: [{ id: 'approval_gateway', type: 'exclusiveGateway' }],
        // 정의 JSON 의 배열 순서는 실행 순서와 상관없다 — 일부러 섞는다.
        activities: [
            act('check_stock', '재고 확인 에이전트'),
            act('request_quote'),
            act('calc_quote', '견적 산출 에이전트'),
            act('approve_saleslead', '영업팀장'),
            act('approve_saleslead_post', '재무 담당'),
            act('notify_customer')
        ],
        sequences: [
            seq('request_quote', 'check_stock'),
            seq('check_stock', 'calc_quote'),
            seq('calc_quote', 'approval_gateway'),
            seq('approval_gateway', 'approve_saleslead'),
            seq('approve_saleslead', 'notify_customer'),
            seq('approve_saleslead', 'calc_quote'),
            seq('approve_saleslead', 'approve_saleslead_post'),
            seq('approve_saleslead_post', 'notify_customer'),
            seq('approve_saleslead_post', 'calc_quote'),
            seq('notify_customer', 'end')
        ]
    };
}

const SAVED_XML = [
    '<?xml version="1.0" encoding="UTF-8"?><bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL">',
    '<bpmn:process id="Process_1"><bpmn:startEvent id="start" name="견적 요청 접수 시작"/>',
    '<bpmn:sequenceFlow id="SequenceFlow_request_quote_check_stock" sourceRef="request_quote" targetRef="check_stock"/>',
    '<bpmn:sequenceFlow id="SequenceFlow_notify_customer_end" sourceRef="notify_customer" targetRef="end"/>',
    '<bpmn:sequenceFlow id="SequenceFlow_start_request_quote" sourceRef="start" targetRef="request_quote"/>',
    '</bpmn:process></bpmn:definitions>'
].join('');

test('시작 이벤트에서 나가는 연결선이 없는 정의 — 첫 액티비티를 건너뛰지 않는다', () => {
    const def = savedQuoteDefinition();
    assert.equal(hasDanglingStartEvent(def), true);
    assert.equal(findStartNodeId(def), 'request_quote', '그래프 규칙의 시작 지점은 첫 액티비티 자신이 된다');
    assert.equal(findStartActivity(def).id, 'request_quote', '예전에는 그 다음인 check_stock 을 돌려줬다');
});

test('그림 XML 이 있으면 XML 의 시작 연결선을 따른다(되돌아오는 선으로 구조 판별이 안 될 때도)', () => {
    const def = savedQuoteDefinition();
    // 반려가 첫 단계로 되돌아오면 들어오는 선 없는 노드가 사라져 구조만으로는 찾을 수 없다.
    def.sequences.push(seq('approve_saleslead', 'request_quote'));
    assert.equal(findStartNodeId(def), null);
    assert.equal(findStartActivity(def, { bpmn: SAVED_XML }).id, 'request_quote');
    // XML 이 없으면 폴백 — 배열 첫 번째(여기서는 check_stock)라 틀린다. 그래서 부르는 쪽이 XML 을 넘긴다.
    assert.equal(findStartActivity(def).id, 'check_stock');
});

test('XML 을 definition.bpmn 으로 들고 있어도 읽는다', () => {
    const def = { ...savedQuoteDefinition(), bpmn: SAVED_XML };
    def.sequences.push(seq('approve_saleslead', 'request_quote'));
    assert.equal(findStartActivity(def).id, 'request_quote');
});

test('XML 의 시작 이벤트 다음이 게이트웨이여도 처음 만나는 액티비티를 고른다', () => {
    const def = {
        events: [{ id: 'StartEvent_1', type: 'startEvent' }],
        gateways: [{ id: 'gw', type: 'exclusiveGateway' }],
        activities: [act('b'), act('a')],
        sequences: [seq('gw', 'a'), seq('a', 'b'), seq('b', 'gw')]
    };
    const xml =
        '<bpmn2:definitions><bpmn2:startEvent id="StartEvent_1"/>' +
        '<bpmn2:sequenceFlow id="f0" sourceRef="StartEvent_1" targetRef="gw"/>' +
        '<bpmn2:sequenceFlow id="f1" sourceRef="gw" targetRef="a"/></bpmn2:definitions>';
    assert.equal(hasDanglingStartEvent(def), true);
    assert.equal(findStartActivity(def, { bpmn: xml }).id, 'a');
});

test('시작 이벤트가 이어진 보통 정의는 예전과 같다', () => {
    const def = savedQuoteDefinition();
    def.sequences.unshift(seq('start', 'request_quote'));
    assert.equal(hasDanglingStartEvent(def), false);
    assert.equal(findStartNodeId(def), 'start');
    assert.equal(findStartActivity(def).id, 'request_quote');
    // 시작 직후 게이트웨이
    const gwDef = {
        events: [{ id: 'start_event1', type: 'startEvent' }],
        gateways: [{ id: 'gw', type: 'exclusiveGateway' }],
        activities: [act('last'), act('first')],
        sequences: [seq('start_event1', 'gw'), seq('gw', 'first'), seq('first', 'last')]
    };
    assert.equal(hasDanglingStartEvent(gwDef), false);
    assert.equal(findStartActivity(gwDef).id, 'first');
});

test('시작 이벤트가 아예 없는 정의 — 들어오는 선 없는 액티비티 자신이 첫 단계', () => {
    const def = { activities: [act('second'), act('first')], sequences: [seq('first', 'second')] };
    assert.equal(hasDanglingStartEvent(def), false, '시작 이벤트가 없으면 dangling 이 아니다(엔진 답을 그대로 쓴다)');
    assert.equal(findStartActivity(def).id, 'first');
});

test('서브프로세스 안의 시작 이벤트는 dangling 판정에 넣지 않는다', () => {
    const def = {
        events: [
            { id: 'start', type: 'startEvent' },
            { id: 'sub_start', type: 'startEvent', process: 'sub1' }
        ],
        subProcesses: [{ id: 'sub1' }],
        activities: [act('a'), act('b')],
        sequences: [seq('start', 'a'), seq('a', 'sub1'), seq('sub1', 'b')]
    };
    assert.equal(hasDanglingStartEvent(def), false);
    assert.equal(findStartActivity(def).id, 'a');
});
