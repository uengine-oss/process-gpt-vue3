/**
 * 할 일 목록 정리 규칙.
 *
 * 급한 것이 위에 오지 않으면 사용자는 목록을 훑으며 찾아야 하고, 그게 앱을
 * 안 쓰게 되는 이유가 된다.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { assignedTo, cardLines, dueLabel, isDone, isOpen, isOverdue, needsMe, sortForMobile } from './tasks.js';

const NOW = new Date('2026-08-31T09:00:00+09:00').getTime();
const day = (n) => new Date(NOW + n * 24 * 60 * 60 * 1000).toISOString();

// ---------------------------------------------------------------------------
// 열린 것과 끝난 것
// ---------------------------------------------------------------------------

test('끝난 상태를 구분한다', () => {
    assert.equal(isDone({ status: 'DONE' }), true);
    assert.equal(isDone({ status: 'COMPLETED' }), true);
    assert.equal(isDone({ status: 'CANCELLED' }), true);
    assert.equal(isDone({ status: 'IN_PROGRESS' }), false);
});

test('모르는 상태는 감추지 않는다', () => {
    // 감추면 사용자는 할 일이 사라졌다고 느끼는데, 앱 안에서 찾을 방법이 없다.
    assert.equal(isOpen({ status: '처음보는상태' }), true);
    assert.equal(isOpen({}), true);
});

test('대소문자가 달라도 같게 본다', () => {
    assert.equal(isDone({ status: 'done' }), true);
});

// ---------------------------------------------------------------------------
// 순서
// ---------------------------------------------------------------------------

test('기한이 빠른 것이 위로 온다', () => {
    const sorted = sortForMobile([
        { name: '나중', dueDate: day(5) },
        { name: '오늘', dueDate: day(0) },
        { name: '지남', dueDate: day(-2) }
    ]);

    assert.deepEqual(sorted.map((t) => t.name), ['지남', '오늘', '나중']);
});

test('기한 있는 것이 없는 것보다 먼저다', () => {
    const sorted = sortForMobile([
        { name: '기한없음', updatedAt: day(0) },
        { name: '기한있음', dueDate: day(3) }
    ]);

    assert.deepEqual(sorted.map((t) => t.name), ['기한있음', '기한없음']);
});

test('기한이 없으면 최근에 움직인 것부터', () => {
    const sorted = sortForMobile([
        { name: '오래됨', updatedAt: day(-5) },
        { name: '최근', updatedAt: day(-1) }
    ]);

    assert.deepEqual(sorted.map((t) => t.name), ['최근', '오래됨']);
});

test('원본 배열을 바꾸지 않는다', () => {
    const original = [{ name: 'b', dueDate: day(2) }, { name: 'a', dueDate: day(1) }];
    sortForMobile(original);

    assert.equal(original[0].name, 'b');
});

test('이상한 날짜는 기한 없음으로 다룬다', () => {
    const sorted = sortForMobile([
        { name: '깨진기한', dueDate: '언젠가' },
        { name: '정상', dueDate: day(1) }
    ]);

    assert.deepEqual(sorted.map((t) => t.name), ['정상', '깨진기한']);
});

test('목록이 없어도 터지지 않는다', () => {
    assert.deepEqual(sortForMobile(null), []);
});

// ---------------------------------------------------------------------------
// 기한 표시
// ---------------------------------------------------------------------------

test('날짜 대신 사람 말로 보여 준다', () => {
    assert.equal(dueLabel(day(0), NOW), '오늘 마감');
    assert.equal(dueLabel(day(1), NOW), '내일');
    assert.equal(dueLabel(day(3), NOW), '3일 뒤');
});

test('지난 기한은 지났다고 말한다', () => {
    assert.equal(dueLabel(day(-1), NOW), '어제 지남');
    assert.equal(dueLabel(day(-4), NOW), '4일 지남');
});

test('한참 뒤는 날짜로 보여 준다', () => {
    // "40일 뒤" 는 세어 보기 전에는 언제인지 감이 오지 않는다.
    assert.match(dueLabel(day(40), NOW), /월 \d+일/);
});

test('기한이 없으면 아무것도 쓰지 않는다', () => {
    assert.equal(dueLabel(null, NOW), '');
    assert.equal(dueLabel('언젠가', NOW), '');
});

test('같은 날 안에서는 시각이 달라도 오늘이다', () => {
    // 시각까지 빼면 아침에 본 "오늘 마감" 이 오후에 "지남" 으로 바뀐다.
    const laterToday = new Date(NOW + 8 * 60 * 60 * 1000).toISOString();
    assert.equal(dueLabel(laterToday, NOW), '오늘 마감');
    assert.equal(isOverdue(laterToday, NOW), false);
});

test('지난 기한 표시', () => {
    assert.equal(isOverdue(day(-1), NOW), true);
    assert.equal(isOverdue(day(1), NOW), false);
    assert.equal(isOverdue(null, NOW), false);
});

// ---------------------------------------------------------------------------
// 카드 문구
// ---------------------------------------------------------------------------

test('카드에 업무명과 어느 건인지를 함께 보여 준다', () => {
    const lines = cardLines(
        { name: '견적서 검토', dueDate: day(0), defId: '구매요청' },
        NOW
    );

    assert.equal(lines.title, '견적서 검토');
    assert.equal(lines.subtitle, '구매요청 · 오늘 마감');
});

test('이름이 비어 있어도 빈 줄로 두지 않는다', () => {
    // 이름 없는 워크아이템이 실제로 있다. 빈 카드는 누를 수 있는지도 알 수 없다.
    assert.equal(cardLines({ name: '   ' }).title, '이름 없는 업무');
    assert.equal(cardLines({}).title, '이름 없는 업무');
});

test('보여 줄 부가 정보가 없으면 둘째 줄을 비운다', () => {
    assert.equal(cardLines({ name: '단독 업무' }).subtitle, '');
});

// ---------------------------------------------------------------------------
// 담당자 확인
//
// 조회는 부분 일치라, 확인하지 않으면 남의 업무가 섞인다.
// ---------------------------------------------------------------------------

test('내 식별자가 담당자에 있으면 내 것이다', () => {
    assert.equal(assignedTo({ endpoint: 'u-1' }, 'u-1'), true);
});

test('여러 담당자 중 하나여도 내 것이다', () => {
    assert.equal(assignedTo({ endpoint: 'u-9, u-1 ,u-3' }, 'u-1'), true);
});

test('일부만 겹치는 것은 내 것이 아니다', () => {
    // 부분 일치 조회가 잡아 온 것을 그대로 두면 남의 업무가 목록에 뜬다.
    assert.equal(assignedTo({ endpoint: 'u-11' }, 'u-1'), false);
    assert.equal(assignedTo({ endpoint: 'xx-u-1-yy' }, 'u-1'), false);
});

test('담당자가 없으면 내 것이 아니다', () => {
    assert.equal(assignedTo({ endpoint: '' }, 'u-1'), false);
    assert.equal(assignedTo({}, 'u-1'), false);
    assert.equal(assignedTo({ endpoint: 'u-1' }, ''), false);
});

test('원본 행의 담당자도 본다', () => {
    assert.equal(assignedTo({ task: { user_id: 'u-1' } }, 'u-1'), true);
});

test('끝난 업무는 지연으로 표시하지 않는다 — 완료 목록에 빨간 "지남" 이 뜨면 할 일이 남은 것처럼 보인다', () => {
    const done = { status: 'DONE', dueDate: '2026-01-01T00:00:00Z' };
    assert.equal(isOverdue(done.dueDate, Date.parse('2026-09-01T00:00:00Z')), true);
    assert.equal(isOverdue(done.dueDate, Date.parse('2026-09-01T00:00:00Z'), done), false);
});

test('끝난 업무 카드는 기한 대신 완료 날짜를 보여 준다', () => {
    const line = cardLines(
        { name: '휴가 신청서 작성', defId: 'leave', status: 'DONE', endDate: '2026-03-05T00:00:00Z', dueDate: '2026-01-01T00:00:00Z' },
        Date.parse('2026-09-01T00:00:00Z')
    );
    assert.match(line.subtitle, /완료/);
    assert.doesNotMatch(line.subtitle, /지남/);
});

test('완료 날짜를 모르면 그냥 완료라고만 한다', () => {
    const line = cardLines({ name: 'x', status: 'DONE' }, Date.parse('2026-09-01T00:00:00Z'));
    assert.equal(line.subtitle, '완료');
});

test('에이전트가 대신 하는 업무는 내 할 일이 아니다 — 목록의 뜻이 흐려진다', () => {
    assert.equal(needsMe({ task: { agent_orch: 'pdf2bpmn', output: null } }), false);
});

test('그 작업이 나에게 물으며 멈춰 있으면 그때는 내 차례다', () => {
    assert.equal(needsMe({ task: { agent_orch: 'pdf2bpmn', output: { hitl_paused: true } } }), true);
});

test('사람이 하는 업무는 언제나 내 할 일이다', () => {
    assert.equal(needsMe({ task: { activity_name: '승인' } }), true);
    assert.equal(needsMe({}), true);
});
