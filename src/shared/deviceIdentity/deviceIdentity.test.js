/**
 * 기기 식별.
 *
 * 지키려는 것: 같은 기기는 언제나 같은 줄로 들어가는 것. 토큰이 바뀌었다고
 * 새 기기가 하나 더 생기면 죽은 줄이 쌓이고, 그만큼 헛되이 발송한다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { DEVICE_ID_KEY, deviceId, deviceType } from './index.js';

function fakeWin(saved = {}, extra = {}) {
    const store = { ...saved };
    return {
        localStorage: {
            getItem: (k) => (k in store ? store[k] : null),
            setItem: (k, v) => {
                store[k] = String(v);
            }
        },
        __store: store,
        ...extra
    };
}

test('한 번 만든 식별자를 계속 쓴다', () => {
    const win = fakeWin();

    const first = deviceId(win);
    const second = deviceId(win);

    assert.equal(first, second);
    assert.equal(win.__store[DEVICE_ID_KEY], first);
});

test('저장된 것이 있으면 그것을 쓴다', () => {
    const win = fakeWin({ [DEVICE_ID_KEY]: 'saved-device' });
    assert.equal(deviceId(win), 'saved-device');
});

test('공백만 있는 값은 없는 것으로 본다', () => {
    const win = fakeWin({ [DEVICE_ID_KEY]: '   ' });
    assert.notEqual(deviceId(win), '   ');
});

test('저장소를 못 써도 식별자는 준다 — 알림이 아예 안 가는 것보다 낫다', () => {
    const win = {
        get localStorage() {
            throw new Error('저장소가 막혔습니다');
        }
    };
    assert.ok(deviceId(win).length > 0);
});

test('브라우저는 web', () => {
    assert.equal(deviceType({}), 'web');
    assert.equal(deviceType({ Capacitor: { isNativePlatform: () => false } }), 'web');
});

test('앱은 그 플랫폼 이름으로', () => {
    const android = { Capacitor: { isNativePlatform: () => true, getPlatform: () => 'android' } };
    const ios = { Capacitor: { isNativePlatform: () => true, getPlatform: () => 'ios' } };

    assert.equal(deviceType(android), 'android');
    assert.equal(deviceType(ios), 'ios');
});

test('앱이지만 플랫폼을 모르면 app', () => {
    assert.equal(deviceType({ Capacitor: { isNative: true } }), 'app');
});
