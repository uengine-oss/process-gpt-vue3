/**
 * 살아 있다는 신호.
 *
 * 지키려는 것
 *   - 화면을 보고 있는 동안에만 알린다. 주머니 속에서 "쓰고 있다" 고 하면
 *     PC 앞에 앉아 있어도 알림이 휴대폰으로 간다.
 *   - 신호 하나 실패했다고 멈추지 않는다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { HEARTBEAT_MS, appStateSource, startPresence } from './presence.js';

/** setInterval 을 대신한다. 5분을 실제로 기다리지 않기 위해서다. */
function fakeClock() {
    let nextId = 1;
    const timers = new Map();
    return {
        timers,
        setInterval(fn, ms) {
            const id = nextId++;
            timers.set(id, { fn, ms });
            return id;
        },
        clearInterval(id) {
            timers.delete(id);
        },
        tick(id) {
            timers.get(id)?.fn();
        },
        tickAll() {
            for (const t of [...timers.values()]) t.fn();
        }
    };
}

test('시작하면 곧바로 한 번 알린다', () => {
    const clock = fakeClock();
    let beats = 0;

    startPresence({ touch: () => beats++, ...clock });

    assert.equal(beats, 1);
});

test('그 뒤로는 일정 간격으로 알린다', () => {
    const clock = fakeClock();
    let beats = 0;

    startPresence({ touch: () => beats++, ...clock });
    clock.tickAll();
    clock.tickAll();

    assert.equal(beats, 3);
});

test('간격은 서버가 보는 창의 절반보다 짧다 — 한 번 놓쳐도 활동 중으로 남는다', () => {
    const clock = fakeClock();

    startPresence({ touch: () => {}, ...clock });

    const [timer] = [...clock.timers.values()];
    assert.equal(timer.ms, HEARTBEAT_MS);
    assert.ok(HEARTBEAT_MS * 2 <= 10 * 60 * 1000);
});

test('배경으로 내려가면 멈춘다', () => {
    const clock = fakeClock();
    let beats = 0;
    let notify = null;

    startPresence({
        touch: () => beats++,
        onAppState: (fn) => {
            notify = fn;
            return () => {};
        },
        ...clock
    });

    assert.equal(beats, 1);
    notify(false);
    clock.tickAll();

    assert.equal(beats, 1, '배경에서는 더 알리지 않는다');
});

test('다시 열면 곧바로 알리고 이어 간다', () => {
    const clock = fakeClock();
    let beats = 0;
    let notify = null;

    startPresence({
        touch: () => beats++,
        onAppState: (fn) => {
            notify = fn;
            return () => {};
        },
        ...clock
    });

    notify(false);
    notify(true);

    assert.equal(beats, 2, '다시 열자마자 한 번');
    clock.tickAll();
    assert.equal(beats, 3);
});

test('이미 켜져 있으면 두 번 걸지 않는다', () => {
    const clock = fakeClock();
    let notify = null;

    startPresence({
        touch: () => {},
        onAppState: (fn) => {
            notify = fn;
            return () => {};
        },
        ...clock
    });

    notify(true);
    notify(true);

    assert.equal(clock.timers.size, 1);
});

test('멈추면 더 알리지 않는다', () => {
    const clock = fakeClock();
    let beats = 0;

    const stop = startPresence({ touch: () => beats++, ...clock });
    stop();
    clock.tickAll();

    assert.equal(beats, 1);
    assert.equal(clock.timers.size, 0);
});

test('멈출 때 앱 상태 구독도 떼어낸다', () => {
    const clock = fakeClock();
    let detached = false;

    const stop = startPresence({
        touch: () => {},
        onAppState: () => () => {
            detached = true;
        },
        ...clock
    });
    stop();

    assert.equal(detached, true);
});

test('신호가 실패해도 멈추지 않는다', () => {
    const clock = fakeClock();
    let beats = 0;

    startPresence({
        touch: () => {
            beats++;
            return Promise.reject(new Error('네트워크 없음'));
        },
        ...clock
    });
    clock.tickAll();

    assert.equal(beats, 2);
});

test('신호가 그 자리에서 터져도 멈추지 않는다', () => {
    const clock = fakeClock();
    let beats = 0;

    startPresence({
        touch: () => {
            beats++;
            throw new Error('무언가 잘못됨');
        },
        ...clock
    });
    clock.tickAll();

    assert.equal(beats, 2);
});

test('알릴 방법이 없으면 아무것도 하지 않는다', () => {
    const clock = fakeClock();

    const stop = startPresence({ ...clock });
    stop();

    assert.equal(clock.timers.size, 0);
});

test('브라우저에는 앱 상태가 없다', () => {
    assert.equal(appStateSource({}), null);
});

test('앱에서는 활성 여부를 참·거짓으로 넘겨 준다', () => {
    let handler = null;
    const win = {
        Capacitor: {
            Plugins: {
                App: {
                    addListener: (_name, fn) => {
                        handler = fn;
                        return { remove: () => {} };
                    }
                }
            }
        }
    };

    const seen = [];
    appStateSource(win)((isActive) => seen.push(isActive));
    handler({ isActive: true });
    handler({ isActive: false });
    handler({});

    assert.deepEqual(seen, [true, false, false]);
});
