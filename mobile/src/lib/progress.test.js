/**
 * 진행 상황 계산.
 *
 * 목록에 "진행 중" 이라고만 쓰면 알 수 있는 게 없다. 정작 궁금한 것은
 * 내 신청이 지금 누구 손에 있고 얼마나 남았는가다.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
    activeStep,
    activityIdOf,
    activityNameOf,
    currentHolder,
    holderText,
    isActionable,
    stateLabel,
    stepState,
    summarize,
    toSteps
} from './progress.js';

const T = (h) => `2026-09-01T0${h}:00:00Z`;

test('상태를 네 갈래로 나눈다', () => {
    assert.equal(stepState({ status: 'DONE' }), 'done');
    assert.equal(stepState({ status: 'IN_PROGRESS' }), 'current');
    assert.equal(stepState({ status: 'TODO' }), 'waiting');
    assert.equal(stepState({ status: 'CANCELLED' }), 'cancelled');
});

test('모르는 상태는 진행 중으로 본다', () => {
    // 대기로 보면 실제로 돌고 있는 단계가 아직 시작 안 한 것처럼 보인다.
    assert.equal(stepState({ status: '처음보는상태' }), 'current');
    assert.equal(stepState({}), 'current');
});

test('시간 순으로 세운다', () => {
    const steps = toSteps([
        { taskId: 'b', name: '둘째', startDate: T(2) },
        { taskId: 'a', name: '첫째', startDate: T(1) }
    ]);

    assert.deepEqual(steps.map((s) => s.name), ['첫째', '둘째']);
});

test('시작 시각이 없는 단계는 뒤로 민다', () => {
    const steps = toSteps([
        { taskId: 'x', name: '아직' },
        { taskId: 'a', name: '시작함', startDate: T(1) }
    ]);

    assert.deepEqual(steps.map((s) => s.name), ['시작함', '아직']);
});

test('같은 시각이면 원래 순서를 지킨다', () => {
    // 흔들리면 새로 고칠 때마다 순서가 바뀌어 어디까지 봤는지 잃는다.
    const steps = toSteps([
        { taskId: 'a', name: '먼저', startDate: T(1) },
        { taskId: 'b', name: '나중', startDate: T(1) }
    ]);

    assert.deepEqual(steps.map((s) => s.name), ['먼저', '나중']);
});

test('이름이 없어도 빈 줄로 두지 않는다', () => {
    assert.equal(toSteps([{ taskId: 'a', name: '  ' }])[0].name, '이름 없는 단계');
});

test('업무가 없어도 터지지 않는다', () => {
    assert.deepEqual(toSteps(null), []);
});

// ---------------------------------------------------------------------------
// 요약
// ---------------------------------------------------------------------------

test('몇 단계 중 몇 개를 끝냈는지 센다', () => {
    const steps = toSteps([
        { taskId: 'a', status: 'DONE', startDate: T(1) },
        { taskId: 'b', status: 'IN_PROGRESS', startDate: T(2) },
        { taskId: 'c', status: 'TODO', startDate: T(3) }
    ]);

    const s = summarize(steps);
    assert.equal(s.done, 1);
    assert.equal(s.total, 3);
    assert.equal(s.text, '1/3 단계');
});

test('취소된 단계는 세지 않는다', () => {
    // 세면 진행률이 깎여 실제보다 덜 온 것처럼 보인다.
    const steps = toSteps([
        { taskId: 'a', status: 'DONE', startDate: T(1) },
        { taskId: 'b', status: 'CANCELLED', startDate: T(2) }
    ]);

    assert.equal(summarize(steps).text, '1/1 단계');
    assert.equal(summarize(steps).percent, 100);
});

test('단계가 없으면 그렇다고 말한다', () => {
    assert.equal(summarize([]).text, '단계 없음');
    assert.equal(summarize([]).percent, 0);
});

// ---------------------------------------------------------------------------
// 지금 누구 차례인가
// ---------------------------------------------------------------------------

test('진행 중 단계의 담당자를 알려 준다', () => {
    // 진행 현황에서 가장 자주 찾는 정보다.
    const steps = toSteps([
        { taskId: 'a', status: 'DONE', username: '나' },
        { taskId: 'b', status: 'IN_PROGRESS', username: '팀장' }
    ]);

    assert.equal(currentHolder(steps), '팀장');
});

test('담당자가 비어 있으면 이름은 빈 값이다 — 화면이 다른 문장을 고를 수 있게', () => {
    const steps = toSteps([{ taskId: 'b', status: 'IN_PROGRESS' }]);

    assert.equal(currentHolder(steps), '');
});

test('진행 중 단계가 없으면 빈 문자열', () => {
    assert.equal(currentHolder(toSteps([{ taskId: 'a', status: 'DONE' }])), '');
});

test('상태 이름을 한국어로', () => {
    assert.equal(stateLabel('done'), '완료');
    assert.equal(stateLabel('current'), '진행 중');
});

// ---------------------------------------------------------------------------
// 아직 안 끝난 첫 단계
//
// 진행 중(IN_PROGRESS)만 찾으면, 막 넘어가 아직 손대지 않은 대기(TODO) 단계가
// 있는 건이 "아무 데도 없는" 것처럼 보인다.
// ---------------------------------------------------------------------------

test('대기 단계도 지금 그 사람 차례로 본다', () => {
    const steps = toSteps([
        { taskId: 'a', status: 'DONE', username: '나', startDate: T(1) },
        { taskId: 'b', status: 'TODO', username: '팀장', startDate: T(2) }
    ]);

    assert.equal(currentHolder(steps), '팀장');
    assert.equal(isActionable(activeStep(steps)), true);
});

test('진행 중이 대기보다 먼저다', () => {
    const steps = toSteps([
        { taskId: 'a', status: 'IN_PROGRESS', username: '지금', startDate: T(1) },
        { taskId: 'b', status: 'TODO', username: '다음', startDate: T(2) }
    ]);

    assert.equal(currentHolder(steps), '지금');
});

test('모두 끝났으면 차례가 없다', () => {
    const steps = toSteps([{ taskId: 'a', status: 'DONE', username: '나' }]);

    assert.equal(activeStep(steps), null);
    assert.equal(currentHolder(steps), '');
});

test('끝났거나 취소된 단계는 처리할 수 없다', () => {
    assert.equal(isActionable({ state: 'done' }), false);
    assert.equal(isActionable({ state: 'cancelled' }), false);
    assert.equal(isActionable(null), false);
});

test('담당자를 모르면 이름 자리에 "담당자 미정" 을 끼워 넣지 않는다', () => {
    const steps = toSteps([{ taskId: 't1', name: '승인', status: 'TODO' }]);
    assert.equal(currentHolder(steps), '');
    assert.equal(holderText(steps), '아직 담당자가 정해지지 않았습니다');
});

test('담당자가 있으면 누구 차례인지 말한다', () => {
    const steps = toSteps([{ taskId: 't1', name: '승인', status: 'TODO', username: '홍길동' }]);
    assert.equal(holderText(steps), '지금 홍길동 차례');
});

test('다 끝난 건은 끝났다고 말한다 — "단계 없음" 은 멈춘 것처럼 읽힌다', () => {
    const steps = toSteps([{ taskId: 't1', name: '승인', status: 'DONE' }]);
    assert.equal(holderText(steps), '모두 끝났습니다');
});

test('단계 자체가 없으면 그렇게 말한다', () => {
    assert.equal(holderText([]), '진행 중인 단계가 없습니다');
});

/**
 * 활동 식별.
 *
 * 데이터 계층은 원본 행을 `task` 안에 넣어 돌려준다. 바깥에서 activity_id 를
 * 찾으면 언제나 비어 있어, 흐름도의 "지금 여기" 표시가 통째로 사라졌었다.
 */
test('원본 행이 task 안에 있어도 활동 id 를 찾는다', () => {
    assert.equal(activityIdOf({ raw: { task: { activity_id: 'A1' } } }), 'A1');
    assert.equal(activityIdOf({ task: { activity_id: 'A1' } }), 'A1');
    assert.equal(activityIdOf({ activityId: 'A1' }), 'A1');
    assert.equal(activityIdOf({ activity_id: 'A1' }), 'A1');
});

test('활동 id 가 없으면 빈 값 — 억지로 만들지 않는다', () => {
    assert.equal(activityIdOf({}), '');
    assert.equal(activityIdOf(null), '');
});

test('활동 id 를 사람이 읽는 이름으로 바꾼다', () => {
    const items = [
        { task: { activity_id: 'A1', activity_name: '출장 계획 등록' } },
        { task: { activity_id: 'A2', activity_name: '숙소 검색' } }
    ];
    assert.equal(activityNameOf('A2', items), '숙소 검색');
});

test('이름을 못 찾으면 받은 id 를 그대로 돌려준다 — 부르는 쪽이 판단한다', () => {
    assert.equal(activityNameOf('A9', [{ task: { activity_id: 'A1', activity_name: '가' } }]), 'A9');
    assert.equal(activityNameOf('A9', []), 'A9');
});

test('id 가 없으면 빈 값', () => {
    assert.equal(activityNameOf('', [{ task: { activity_id: 'A1', activity_name: '가' } }]), '');
    assert.equal(activityNameOf(null, null), '');
});
