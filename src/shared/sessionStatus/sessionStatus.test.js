/**
 * 「에이전트를 준비하고 있어요 · N초」 표시의 상태 기계.
 *
 * 지키려는 것
 *   - starting 이 와야만 보인다(상태 프레임이 없는 대화에는 한 번도 나타나지 않는다)
 *   - 초는 서버 elapsed_ms 에서 시작해 화면에서 1초씩 센다
 *   - ready · 첫 토큰 · 도구 · done · error · 중지에서 사라지고, 타이머도 멈춘다
 *
 * 실행: node --test src/shared/sessionStatus/
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { createSessionPreparing, nextPreparing, preparingSeconds, withSessionPreparing } from './index.js';

const starting = (elapsed, agent = 'codex') => ({ type: 'session_status', status: 'starting', agent_type: agent, elapsed_ms: elapsed });
const ready = { type: 'session_status', status: 'ready', agent_type: 'codex', waited_ms: 4000 };

/** 시계와 타이머를 손으로 돌리는 환경. */
function harness() {
    let clock = 1_000_000;
    const timers = new Map();
    let nextId = 1;
    const views = [];
    const tracker = createSessionPreparing({
        onChange: (v) => views.push(v),
        now: () => clock,
        setInterval: (fn, ms) => {
            const id = nextId++;
            timers.set(id, { fn, ms });
            return id;
        },
        clearInterval: (id) => timers.delete(id)
    });
    return {
        tracker,
        views,
        timers,
        /** ms 만큼 시간을 흘리고, 그 사이 돌았을 타이머를 부른다. */
        advance(ms) {
            const step = 1000;
            for (let t = 0; t < ms; t += step) {
                clock += Math.min(step, ms - t);
                for (const { fn } of [...timers.values()]) fn();
            }
        }
    };
}

test('starting 이 오면 서버 경과 시간부터 보인다', () => {
    const h = harness();
    h.tracker.update(starting(0));
    assert.deepEqual(h.views.at(-1), { agentType: 'codex', seconds: 0 });
    assert.equal(h.tracker.active, true);
});

test('화면에서 1초씩 센다 — 프레임은 2초마다라 프레임만 따르면 숫자가 건너뛴다', () => {
    const h = harness();
    h.tracker.update(starting(0));
    h.advance(1000);
    h.advance(1000);
    assert.deepEqual(
        h.views.map((v) => v?.seconds),
        [0, 1, 2]
    );
});

test('새 프레임이 오면 서버 값으로 다시 맞춘다', () => {
    const h = harness();
    h.tracker.update(starting(0));
    h.advance(1000);
    h.tracker.update(starting(6000, 'cliagents'));
    assert.deepEqual(h.views.at(-1), { agentType: 'cliagents', seconds: 6 });
    // 타이머는 하나뿐이다 — 프레임마다 쌓이면 초가 빨리 간다.
    assert.equal(h.timers.size, 1);
});

test('starting → ready 면 사라지고 타이머가 멈춘다', () => {
    const h = harness();
    h.tracker.update(starting(0));
    h.tracker.update(starting(2000));
    h.tracker.update(ready);
    assert.equal(h.views.at(-1), null);
    assert.equal(h.tracker.active, false);
    assert.equal(h.timers.size, 0);
});

test('starting → ready → 토큰: 토큰이 와도 다시 나타나지 않는다', () => {
    const h = harness();
    const seen = [];
    const cb = withSessionPreparing({ onToken: (t) => seen.push(t) }, h.tracker);
    cb.onSessionStatus(starting(0));
    cb.onSessionStatus(starting(2000));
    cb.onSessionStatus(ready);
    cb.onToken('안녕');
    assert.deepEqual(seen, ['안녕']);
    assert.equal(h.tracker.active, false);
    // 나타남 두 번(0초, 2초) → 사라짐 한 번. 사라진 뒤에는 아무 알림도 없다.
    assert.deepEqual(
        h.views.map((v) => (v ? v.seconds : null)),
        [0, 2, null]
    );
});

test('ready 가 빠진 채 토큰부터 와도 사라진다', () => {
    const h = harness();
    const cb = withSessionPreparing({ onToken: () => {} }, h.tracker);
    cb.onSessionStatus(starting(0));
    cb.onToken('x');
    assert.equal(h.views.at(-1), null);
    assert.equal(h.timers.size, 0);
});

test('오류 · 도구 · done · 중지에서도 사라진다', () => {
    for (const name of ['onError', 'onToolStart', 'onDone', 'onAbort']) {
        const h = harness();
        const cb = withSessionPreparing({ [name]: () => {} }, h.tracker);
        cb.onSessionStatus(starting(4000));
        cb[name](new Error('에이전트를 준비하지 못했습니다'));
        assert.equal(h.tracker.active, false, name);
        assert.equal(h.views.at(-1), null, name);
        assert.equal(h.timers.size, 0, name);
    }
});

test('상태 프레임이 없는 대화(이미 떠 있는 Pod · deepagents)에는 한 번도 나타나지 않는다', () => {
    const h = harness();
    const cb = withSessionPreparing({ onToken: () => {}, onDone: () => {} }, h.tracker);
    cb.onToken('a');
    cb.onDone('a');
    h.tracker.clear();
    assert.deepEqual(h.views, []);
    assert.equal(h.timers.size, 0);
});

test('모르는 status 는 표시를 지운다 — 끝나지 않는 「준비 중」을 남기지 않는다', () => {
    const h = harness();
    h.tracker.update(starting(0));
    h.tracker.update({ type: 'session_status', status: 'something-new' });
    assert.equal(h.tracker.active, false);
});

test('원래 콜백의 반환값과 onSessionStatus 를 그대로 넘긴다', async () => {
    const h = harness();
    const statuses = [];
    const cb = withSessionPreparing({ onDone: async () => 'ok', onSessionStatus: (e) => statuses.push(e.status) }, h.tracker);
    cb.onSessionStatus(starting(0));
    assert.deepEqual(statuses, ['starting']);
    assert.equal(await cb.onDone(), 'ok');
});

test('초 계산: 음수 · 이상한 값에도 0 아래로 가지 않는다', () => {
    assert.equal(preparingSeconds(null), 0);
    const s = nextPreparing(null, { type: 'session_status', status: 'starting', elapsed_ms: 'x' }, 10);
    assert.equal(s.baseMs, 0);
    assert.equal(preparingSeconds(s, 5), 0);
    assert.equal(preparingSeconds({ baseMs: 2500, at: 0 }, 600), 3);
});
