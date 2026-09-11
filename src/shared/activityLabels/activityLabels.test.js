import test from 'node:test';
import assert from 'node:assert/strict';

import { buildActivityLabels, labelOf, labelPath, relabelText } from './index.js';

// 실제 데이터 모양 — 온라인 쇼핑몰 주문 처리 v1.0(변경 전) / v1.1(변경 후)
const BASE = {
    activities: [
        { id: 'payment_check', name: '결제 확인' },
        { id: 'ship_order', name: '배송 출고' },
        { id: 'confirm_delivery_complete', name: '배송 완료 확인' }
    ],
    gateways: [{ id: 'gateway_payment_result', name: '결제 확인 결과 판단' }],
    events: [{ id: 'end_order_completed', name: '주문 처리 완료' }]
};
const HEAD = {
    activities: [...BASE.activities, { id: 'Activity_0q13olf', name: '고객 배송 알림' }],
    gateways: BASE.gateways,
    events: BASE.events
};

test('정의의 액티비티·게이트웨이·이벤트에서 이름표를 만든다', () => {
    const labels = buildActivityLabels([BASE, HEAD]);
    assert.equal(labels.payment_check, '결제 확인');
    assert.equal(labels.gateway_payment_result, '결제 확인 결과 판단');
    assert.equal(labels.end_order_completed, '주문 처리 완료');
    assert.equal(labels.Activity_0q13olf, '고객 배송 알림');
});

test('뒤에 넘긴(최신) 정의의 이름이 이긴다', () => {
    const renamed = { activities: [{ id: 'ship_order', name: '출고 처리' }] };
    assert.equal(buildActivityLabels([BASE, renamed]).ship_order, '출고 처리');
});

test('문자열로 저장된 정의도 읽고, 깨진 정의는 건너뛴다', () => {
    const labels = buildActivityLabels([JSON.stringify(BASE), '깨진 json', null]);
    assert.equal(labels.ship_order, '배송 출고');
});

test('서브프로세스 안의 요소도 이름표에 넣는다', () => {
    const def = { subProcesses: [{ id: 'sub_1', name: '반품 처리', activities: [{ id: 'refund', name: '환불' }] }] };
    const labels = buildActivityLabels([def]);
    assert.equal(labels.sub_1, '반품 처리');
    assert.equal(labels.refund, '환불');
});

test('실행 경로 단계 문구와 근거를 이름으로 바꾼다', () => {
    const labels = buildActivityLabels([BASE, HEAD]);
    assert.equal(
        relabelText('실행 경로가 payment_check → ship_order → confirm_delivery_complete 다', labels),
        '실행 경로가 결제 확인 → 배송 출고 → 배송 완료 확인 다'
    );
    assert.equal(
        relabelText('기대 ship_order → confirm_delivery_complete / 실제 ship_order → Activity_0q13olf → confirm_delivery_complete', labels),
        '기대 배송 출고 → 배송 완료 확인 / 실제 배송 출고 → 고객 배송 알림 → 배송 완료 확인'
    );
});

test('긴 ID 를 먼저 맞추고 낱말 일부는 건드리지 않는다', () => {
    const labels = { check: '점검', payment_check: '결제 확인', end: '끝' };
    assert.equal(relabelText('payment_check → check', labels), '결제 확인 → 점검');
    assert.equal(relabelText('프로세스가 endEvent 까지 진행된다', labels), '프로세스가 endEvent 까지 진행된다');
});

test('모르는 ID 와 빈 값은 그대로 둔다', () => {
    const labels = buildActivityLabels([BASE]);
    assert.equal(labelOf('unknown_task', labels), 'unknown_task');
    assert.deepEqual(labelPath(['payment_check', 'unknown_task'], labels), ['결제 확인', 'unknown_task']);
    assert.equal(relabelText('', labels), '');
    assert.equal(relabelText(null, labels), '');
    assert.equal(relabelText('payment_check', {}), 'payment_check');
});
