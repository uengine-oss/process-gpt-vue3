/**
 * "지금 이 기기를 쓰고 있는가" 를 브라우저에서 판단하는 방법.
 *
 * 지키려는 것
 *   - 탭이 떠 있다고 앞에 앉아 있는 것은 아니다. 잠긴 화면에서도 탭은 보인다.
 *     그 상태를 활동 중으로 세면 자리를 비운 사람은 휴대폰 알림을 못 받는다.
 *   - 반대로 조작만 보면, 다른 창에서 일하는 동안에도 이 탭이 활동 중이라고
 *     말하게 된다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { IDLE_MS, browserActivitySource } from './index.js';

/** document 와 타이머를 흉내낸다. 2분을 실제로 기다리지 않기 위해서다. */
function fakeWin({ visibility = 'visible' } = {}) {
    const listeners = new Map();
    let nextTimer = 1;
    const timers = new Map();

    const doc = {
        visibilityState: visibility,
        addEventListener(name, fn) {
            listeners.set(name, [...(listeners.get(name) || []), fn]);
        },
        removeEventListener(name, fn) {
            listeners.set(name, (listeners.get(name) || []).filter((f) => f !== fn));
        }
    };

    return {
        document: doc,
        setTimeout(fn, ms) {
            const id = nextTimer++;
            timers.set(id, { fn, ms });
            return id;
        },
        clearTimeout(id) {
            timers.delete(id);
        },
        // 시험용 손잡이
        fire(name, ...args) {
            for (const fn of listeners.get(name) || []) fn(...args);
        },
        listenerCount(name) {
            return (listeners.get(name) || []).length;
        },
        runTimers() {
            for (const t of [...timers.values()]) t.fn();
        },
        timerDelays() {
            return [...timers.values()].map((t) => t.ms);
        },
        setVisibility(value) {
            doc.visibilityState = value;
        }
    };
}

test('탭을 숨기면 그만 쓰는 것으로 본다', () => {
    const win = fakeWin();
    const seen = [];

    browserActivitySource(win)((active) => seen.push(active));
    win.setVisibility('hidden');
    win.fire('visibilitychange');

    assert.deepEqual(seen, [false]);
});

test('돌아오면 다시 쓰는 것으로 본다', () => {
    const win = fakeWin();
    const seen = [];

    browserActivitySource(win)((active) => seen.push(active));
    win.setVisibility('hidden');
    win.fire('visibilitychange');
    win.setVisibility('visible');
    win.fire('visibilitychange');

    assert.deepEqual(seen, [false, true]);
});

test('한동안 아무것도 안 하면 자리를 비운 것으로 본다', () => {
    // 탭이 떠 있어도 사람이 없으면 알림은 휴대폰으로 가야 한다.
    const win = fakeWin();
    const seen = [];

    browserActivitySource(win)((active) => seen.push(active));
    win.runTimers();

    assert.deepEqual(seen, [false]);
});

test('무언가 하면 다시 쓰는 것으로 본다', () => {
    const win = fakeWin();
    const seen = [];

    browserActivitySource(win)((active) => seen.push(active));
    win.runTimers();
    win.fire('keydown');

    assert.deepEqual(seen, [false, true]);
});

test('숨은 상태에서 조작이 들어와도 쓰는 것으로 보지 않는다', () => {
    // 배경 탭에서 프로그램이 만든 이벤트일 수 있다.
    const win = fakeWin();
    const seen = [];

    browserActivitySource(win)((active) => seen.push(active));
    win.setVisibility('hidden');
    win.fire('visibilitychange');
    win.fire('mousemove');

    assert.deepEqual(seen, [false]);
});

test('같은 상태를 두 번 말하지 않는다', () => {
    const win = fakeWin();
    const seen = [];

    browserActivitySource(win)((active) => seen.push(active));
    win.fire('keydown');
    win.fire('keydown');
    win.fire('pointerdown');

    assert.deepEqual(seen, [], '처음부터 쓰는 중이었으므로 알릴 것이 없다');
});

test('자리 비움 판정 시간', () => {
    const win = fakeWin();

    browserActivitySource(win)(() => {});

    assert.deepEqual(win.timerDelays(), [IDLE_MS]);
});

test('떼어내면 더 듣지 않는다', () => {
    const win = fakeWin();

    const detach = browserActivitySource(win)(() => {});
    detach();

    assert.equal(win.listenerCount('keydown'), 0);
    assert.equal(win.listenerCount('visibilitychange'), 0);
});

test('브라우저가 아니면 판단할 방법이 없다', () => {
    assert.equal(browserActivitySource({}), null);
    assert.equal(browserActivitySource(undefined), null);
});
