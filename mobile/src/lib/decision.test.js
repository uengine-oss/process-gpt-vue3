/**
 * 승인 · 반려 — 결정 칸을 알아보고, 반려에는 의견을 요구하고, 끝난 단계에서 반려 사유를 읽는다.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    canDecide,
    decisionForm,
    decisionHistory,
    decisionValues,
    isNegative,
    isPositive,
    lastRejection,
    outputDecision,
    priorRoundDecision
} from './decision.js';

const FIELDS = [
    { key: 'review_result', label: '검토 결과', type: 'select', supported: true, items: [{ value: 'approve', label: '승인' }, { value: 'reject', label: '반려' }] },
    { key: 'review_comment', label: '검토 의견', type: 'textarea', supported: true }
];

describe('값 하나', () => {
    it('긍정 · 부정', () => {
        assert.equal(isPositive('approve'), true);
        assert.equal(isPositive('승인'), true);
        assert.equal(isNegative('reject'), true);
        assert.equal(isNegative('반려'), true);
        assert.equal(isPositive('reject'), false);
        assert.equal(isNegative('제안서 본문이 비어 있습니다'), false);
        assert.equal(isPositive(''), false);
    });
});

describe('decisionForm', () => {
    it('결정 칸 · 의견 칸 · 승인/반려 값을 찾는다', () => {
        const f = decisionForm(FIELDS);
        assert.equal(f.decisionKey, 'review_result');
        assert.equal(f.commentKey, 'review_comment');
        assert.equal(f.approveValue, 'approve');
        assert.equal(f.rejectValue, 'reject');
        assert.deepEqual(f.others, []);
    });
    it('결정 칸이 없으면 null', () => {
        assert.equal(decisionForm([{ key: 'kind', type: 'select', items: [{ value: 'a', label: '가' }, { value: 'b', label: '나' }] }]), null);
    });
    it('읽기 전용 결정 칸은 결정이 아니다(앞 단계 결과를 보여 주는 칸)', () => {
        assert.equal(decisionForm([{ ...FIELDS[0], readonly: true }]), null);
    });
});

describe('단추', () => {
    it('승인은 바로, 반려는 의견이 있어야', () => {
        assert.equal(canDecide('approve', ''), true);
        assert.equal(canDecide('reject', ''), false);
        assert.equal(canDecide('reject', '   '), false);
        assert.equal(canDecide('reject', '설치비가 빠졌습니다'), true);
        assert.equal(canDecide(null, 'x'), false, '미리 고른 값은 없다');
    });
    it('제출 값은 결정 칸과 의견 칸만', () => {
        const f = decisionForm(FIELDS);
        assert.deepEqual(decisionValues(f, 'reject', ' 설치비 '), { review_result: 'reject', review_comment: '설치비' });
        assert.deepEqual(decisionValues(f, 'approve', ''), { review_result: 'approve', review_comment: '' });
    });
});

const rows = [
    { id: 'r1', activity_id: 'task1', activity_name: '요청사항 입력', status: 'DONE', username: '장진영', end_date: '2026-11-10T22:59:00', output: { f1: { request: '책상 30' } } },
    { id: 'r2', activity_id: 'task2', activity_name: '제안서 작성', status: 'DONE', username: '김민지', end_date: '2026-11-10T23:01:00', output: { f2: { proposal: 'v1' } } },
    { id: 'r3', activity_id: 'task3', activity_name: '제안서 검토', status: 'DONE', username: '장진영', end_date: '2026-11-10T23:05:00', output: { f3: { review_result: 'reject', review_comment: '설치비와 설치 일정이 빠졌습니다.' } } },
    { id: 'r4', activity_id: 'task4_reject', activity_name: '제안서 재작성', status: 'IN_PROGRESS', username: '김민지', output: {} }
];

describe('끝난 단계에서 결정 읽기', () => {
    it('반려와 사유', () => {
        assert.deepEqual(outputDecision(rows[2].output), { decision: 'reject', comment: '설치비와 설치 일정이 빠졌습니다.' });
        assert.deepEqual(outputDecision(rows[1].output), { decision: null, comment: '' });
    });
    it('반려 때문에 다시 온 업무', () => {
        const r = lastRejection(rows, rows[3]);
        assert.equal(r.who, '장진영');
        assert.equal(r.comment, '설치비와 설치 일정이 빠졌습니다.');
    });
    it('다시 검토하는 사람에게는 「반려됨」이 아니다 — 지난 결정 이력으로 본다', () => {
        const again = { id: 'r6', activity_id: 'task3', status: 'IN_PROGRESS' };
        const more = [...rows, { ...rows[1], id: 'r5', end_date: '2026-11-11T09:19:00' }];
        assert.equal(lastRejection(more, again), null);
        const h = decisionHistory(more, again);
        assert.equal(h.length, 1);
        assert.equal(h[0].round, 1);
        assert.equal(h[0].decision, 'reject');
    });
    it('마지막 결정이 승인이면 반려 사유를 보이지 않는다', () => {
        const ok = [...rows.slice(0, 2), { ...rows[2], output: { f3: { review_result: 'approve' } } }];
        assert.equal(lastRejection(ok, { id: 'x', activity_id: 'task4_approve' }), null);
    });
});

describe('같은 행이 다시 열린 경우(엔진은 반복 단계를 새 행으로 만들지 않는다)', () => {
    const reopened = { id: 'r3', activity_id: 'task3', status: 'IN_PROGRESS', username: '장진영', output: { f3: { review_result: 'reject', review_comment: '제안서 본문이 비어 있습니다.' } } };
    it('그 행에 남은 지난번 반려를 이력의 마지막 회차로 남긴다', () => {
        const h = decisionHistory([reopened], reopened);
        assert.equal(h.length, 1);
        assert.equal(h[0].decision, 'reject');
        assert.equal(h[0].comment, '제안서 본문이 비어 있습니다.');
    });
    it('끝난 행에는 해당 없음', () => {
        assert.equal(priorRoundDecision({ ...reopened, status: 'DONE' }), null);
        assert.equal(priorRoundDecision({ ...reopened, output: {} }), null);
    });
});
