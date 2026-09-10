/**
 * 푸시 알림 등록.
 *
 * 여기서 지키려는 것
 *   - 남의 이메일로 등록되지 않는 것 (알림 가로채기)
 *   - 브라우저에서 열었을 때 실패처럼 보이지 않는 것
 *   - 토큰이 안 오면 영원히 기다리지 않는 것
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
    TABLE,
    deviceRow,
    enablePush,
    isNativeApp,
    isRegistered,
    pushConfigured,
    registerDevice,
    touchDevice,
    unregisterDevice
} from './push.js';
import { DEVICE_ID_KEY } from '../../../src/shared/deviceIdentity/index.js';

const AT = '2026-08-31T00:00:00.000Z';
const session = { user: { email: 'me@company.com' } };

/** 이 기기의 기억. 실제 localStorage 와 같은 모양이면 된다. */
function fakeDevice(saved = {}) {
    const store = { ...saved };
    return {
        localStorage: {
            getItem: (k) => (k in store ? store[k] : null),
            setItem: (k, v) => {
                store[k] = String(v);
            },
            removeItem: (k) => {
                delete store[k];
            }
        }
    };
}

function fakeSupabase(behaviour = {}) {
    const calls = [];
    return {
        calls,
        from(table) {
            return {
                upsert(row, options) {
                    calls.push({ op: 'upsert', table, row, options });
                    return Promise.resolve({ error: behaviour.error || null });
                },
                update(patch) {
                    const where = {};
                    const chain = {
                        eq(column, value) {
                            where[column] = value;
                            return chain;
                        },
                        then(resolve) {
                            calls.push({ op: 'update', table, patch, where });
                            return Promise.resolve({ error: behaviour.error || null }).then(resolve);
                        }
                    };
                    return chain;
                },
                delete() {
                    const where = {};
                    const chain = {
                        eq(column, value) {
                            where[column] = value;
                            calls.push({ op: 'delete', table, where: { ...where } });
                            return chain;
                        },
                        then(resolve) {
                            return Promise.resolve({ error: behaviour.error || null }).then(resolve);
                        }
                    };
                    return chain;
                },
                select() {
                    const where = {};
                    const chain = {
                        eq(column, value) {
                            where[column] = value;
                            return chain;
                        },
                        limit() {
                            calls.push({ op: 'select', table, where: { ...where } });
                            return Promise.resolve({
                                data: behaviour.rows || [],
                                error: behaviour.error || null
                            });
                        }
                    };
                    return chain;
                }
            };
        }
    };
}

/** 앱 안에서 도는 상황을 흉내낸다. */
async function inApp(run) {
    const saved = globalThis.Capacitor;
    globalThis.Capacitor = { isNativePlatform: () => true };
    try {
        return await run();
    } finally {
        globalThis.Capacitor = saved;
    }
}

// ---------------------------------------------------------------------------
// 등록할 내용
// ---------------------------------------------------------------------------

test('이메일은 세션에서만 가져온다', () => {
    // 호출자가 정하게 두면 남의 이메일을 넣어 알림을 가로챌 수 있다.
    const win = fakeDevice({ [DEVICE_ID_KEY]: 'this-phone' });
    const row = deviceRow(session, 'token-1', AT, win);

    assert.deepEqual(row, {
        user_email: 'me@company.com',
        device_id: 'this-phone',
        device_type: 'web',
        device_token: 'token-1',
        last_active_at: AT,
        last_access_at: AT
    });
});

test('세션이나 토큰이 없으면 만들지 않는다', () => {
    assert.equal(deviceRow(null, 'token'), null);
    assert.equal(deviceRow({ user: {} }, 'token'), null);
    assert.equal(deviceRow(session, ''), null);
    assert.equal(deviceRow(session, '   '), null);
});

// ---------------------------------------------------------------------------
// 저장 — 기기마다 한 줄
// ---------------------------------------------------------------------------

test('자기 기기 줄만 고친다', async () => {
    // 이메일만으로 덮어쓰면 PC 에서 웹을 켜는 순간 휴대폰 줄이 사라진다.
    // 그러면 휴대폰 알림이 조용히 끊기고, 끊긴 줄도 모른다.
    const supabase = fakeSupabase();
    const win = fakeDevice({ [DEVICE_ID_KEY]: 'this-phone' });

    const result = await registerDevice({ supabase, session, token: 'new-token', at: AT, win });

    assert.equal(result.ok, true);
    assert.equal(supabase.calls[0].table, TABLE);
    assert.equal(supabase.calls[0].options.onConflict, 'user_email,device_id');
    assert.equal(supabase.calls[0].row.device_id, 'this-phone');
    assert.equal(supabase.calls[0].row.device_token, 'new-token');
});

test('같은 기기가 토큰을 갱신하면 같은 줄을 고친다 — 죽은 줄을 남기지 않는다', async () => {
    const win = fakeDevice({ [DEVICE_ID_KEY]: 'this-phone' });

    const first = deviceRow(session, 'old-token', AT, win);
    const second = deviceRow(session, 'new-token', AT, win);

    assert.equal(first.device_id, second.device_id);
    assert.notEqual(first.device_token, second.device_token);
});

test('저장에 실패하면 실패라고 말한다', async () => {
    const supabase = fakeSupabase({ error: { message: '거부됨' } });

    const result = await registerDevice({ supabase, session, token: 'token' });

    assert.equal(result.ok, false);
    assert.equal(result.reason, 'rejected');
});

test('세션이 없으면 저장을 시도하지 않는다', async () => {
    const supabase = fakeSupabase();

    const result = await registerDevice({ supabase, session: null, token: 'token' });

    assert.equal(result.ok, false);
    assert.equal(supabase.calls.length, 0);
});

test('알림 끄기는 이 기기 줄만 지운다', async () => {
    // 이메일로만 지우면 휴대폰에서 끄는 순간 회사 PC 알림까지 함께 꺼진다.
    const supabase = fakeSupabase();
    const win = fakeDevice({ [DEVICE_ID_KEY]: 'this-phone' });

    await unregisterDevice({ supabase, session, win });

    const del = supabase.calls.filter((c) => c.op === 'delete').pop();
    assert.deepEqual(del.where, { user_email: 'me@company.com', device_id: 'this-phone' });
});

// ---------------------------------------------------------------------------
// 켜져 있는가 — 이 기기 기준으로
// ---------------------------------------------------------------------------

test('이 기기 줄에 토큰이 있어야 켜진 것이다', async () => {
    const supabase = fakeSupabase({ rows: [{ device_token: 'this-device' }] });
    const win = fakeDevice({ [DEVICE_ID_KEY]: 'this-phone' });

    assert.equal(await isRegistered({ supabase, session, win }), true);
    assert.deepEqual(supabase.calls[0].where, {
        user_email: 'me@company.com',
        device_id: 'this-phone'
    });
});

/**
 * 이것이 실제로 사람들을 막고 있던 문제다.
 *
 * 포털은 로그인할 때마다 토큰 없는 빈 줄을 만든다. 줄이 있는지만 보면 웹에
 * 한 번이라도 들어가 본 사람은 앱에서 "알림 켜짐" 으로 보이고, 그래서 켜지
 * 않고, 알림은 영영 오지 않는다. 운영 192줄 중 184줄이 그런 빈 줄이었다.
 */
test('토큰이 비어 있으면 켜진 것이 아니다', async () => {
    const supabase = fakeSupabase({ rows: [{ device_token: null }] });

    assert.equal(await isRegistered({ supabase, session, win: fakeDevice() }), false);
});

test('내 기기 줄이 없으면 꺼진 것이다', async () => {
    const supabase = fakeSupabase({ rows: [] });

    assert.equal(await isRegistered({ supabase, session, win: fakeDevice() }), false);
});

test('확인에 실패하면 꺼진 것으로 본다', async () => {
    // 켜진 것으로 보면 사용자는 알림이 오는 줄 알고 기다린다. 잘못 꺼졌다고
    // 말하면 한 번 더 누를 뿐이다.
    const supabase = fakeSupabase({ error: { message: '조회 실패' } });

    assert.equal(await isRegistered({ supabase, session, win: fakeDevice() }), false);
});

// ---------------------------------------------------------------------------
// 지금 이 기기를 쓰고 있다고 알리기
//
// 보내는 쪽은 이 시각 하나로 어디에 보낼지 정한다. 갱신하지 않으면 앱은 언제나
// "안 쓰는 기기" 라서, PC 를 켜 둔 사람은 휴대폰 알림을 받지 못한다.
// ---------------------------------------------------------------------------

test('이 기기 줄의 마지막 사용 시각만 갱신한다', async () => {
    const supabase = fakeSupabase();
    const win = fakeDevice({ [DEVICE_ID_KEY]: 'this-phone' });

    const result = await touchDevice({ supabase, session, at: AT, win });

    assert.equal(result.ok, true);
    const patch = supabase.calls.find((c) => c.op === 'update');
    assert.deepEqual(patch.patch, { last_active_at: AT });
    assert.deepEqual(patch.where, { user_email: 'me@company.com', device_id: 'this-phone' });
});

test('없는 줄을 만들지 않는다 — 갱신이지 등록이 아니다', async () => {
    const supabase = fakeSupabase();

    await touchDevice({ supabase, session, at: AT, win: fakeDevice() });

    assert.equal(supabase.calls.some((c) => c.op === 'upsert'), false);
});

test('로그인하지 않았으면 아무것도 하지 않는다', async () => {
    const supabase = fakeSupabase();

    const result = await touchDevice({ supabase, session: null });

    assert.equal(result.ok, false);
    assert.equal(supabase.calls.length, 0);
});

// ---------------------------------------------------------------------------
// 앱 안에서만
// ---------------------------------------------------------------------------

test('브라우저에서는 앱이 아니라고 본다', () => {
    assert.equal(isNativeApp({}), false);
    assert.equal(isNativeApp({ Capacitor: { isNativePlatform: () => false } }), false);
});

test('앱 안이면 앱이라고 본다', () => {
    assert.equal(isNativeApp({ Capacitor: { isNativePlatform: () => true } }), true);
    assert.equal(isNativeApp({ Capacitor: { isNative: true } }), true);
});

test('브라우저에서는 실패가 아니라 해당 없음이다', async () => {
    // 실패로 처리하면 사용자는 자기가 뭘 잘못한 줄 안다.
    const result = await enablePush({ supabase: fakeSupabase(), session });

    assert.equal(result.ok, false);
    assert.equal(result.reason, 'not-an-app');
});

test('플러그인이 없으면 없다고 말한다', async () => {
    // 앱으로 설치했지만 알림 플러그인이 빠진 빌드일 수 있다.
    const result = await inApp(() =>
        enablePush({ supabase: fakeSupabase(), session, loadPlugin: () => null })
    );

    assert.equal(result.reason, 'plugin-missing');
});

test('알림을 거부하면 토큰을 요청하지 않는다', async () => {
    let registered = false;
    const plugin = {
        requestPermissions: async () => ({ receive: 'denied' }),
        addListener: () => {},
        register: () => {
            registered = true;
        }
    };

    const result = await inApp(() =>
        enablePush({ supabase: fakeSupabase(), session, loadPlugin: () => plugin })
    );

    assert.equal(result.reason, 'denied');
    assert.equal(registered, false, '거부했는데 등록을 시도하면 안 된다');
});

test('허용하면 받은 토큰으로 등록한다', async () => {
    const plugin = {
        requestPermissions: async () => ({ receive: 'granted' }),
        addListener: (_event, cb) => {
            setTimeout(() => cb({ value: '기기-토큰' }), 0);
        },
        register: () => {}
    };
    const supabase = fakeSupabase();

    const result = await inApp(() => enablePush({ supabase, session, loadPlugin: () => plugin }));

    assert.equal(result.ok, true);
    assert.equal(supabase.calls[0].row.device_token, '기기-토큰');
});

test('설정이 없으면 register 를 부르지 않는다 — 부르면 네이티브에서 앱이 죽는다', async () => {
    const saved = globalThis.Capacitor;
    globalThis.Capacitor = { isNativePlatform: () => true };

    let registered = false;
    const result = await enablePush({
        supabase: null,
        session: { user: { email: 'a@b.c' } },
        loadPlugin: () => ({
            requestPermissions: async () => ({ receive: 'granted' }),
            addListener: () => {},
            register: () => {
                registered = true;
            }
        }),
        checkAvailable: async () => false
    });

    globalThis.Capacitor = saved;
    assert.equal(registered, false);
    assert.deepEqual(result, { ok: false, reason: 'not-configured' });
});

test('설정을 확인할 수 없는 환경(iOS 등)에서는 막지 않는다', async () => {
    const available = await pushConfigured({ Capacitor: { Plugins: {} } });
    assert.equal(available, true);
});

test('네이티브가 없다고 하면 못 켠다', async () => {
    const available = await pushConfigured({
        Capacitor: { Plugins: { PushSupport: { isAvailable: async () => ({ available: false }) } } }
    });
    assert.equal(available, false);
});

// ---------------------------------------------------------------------------
// 지금 보고 있는 화면
//
// 대화방을 보고 있는 동안 그 방의 알림이 울리면 방해일 뿐이다. 데이터베이스
// 트리거가 이 값을 보고 알림을 만들지 말지 정한다.
// ---------------------------------------------------------------------------

test('보고 있는 대화방을 함께 남긴다', async () => {
    const supabase = fakeSupabase();
    const win = fakeDevice({ [DEVICE_ID_KEY]: 'this-phone' });

    await touchDevice({ supabase, session, at: AT, accessPage: 'chat:room-1', win });

    const patch = supabase.calls.find((c) => c.op === 'update');
    assert.deepEqual(patch.patch, {
        last_active_at: AT,
        access_page: 'chat:room-1',
        last_access_at: AT
    });
});

test('방을 떠나면 비운다 — 안 그러면 떠난 뒤에도 알림이 안 온다', async () => {
    const supabase = fakeSupabase();

    await touchDevice({ supabase, session, at: AT, accessPage: '', win: fakeDevice() });

    const patch = supabase.calls.find((c) => c.op === 'update');
    assert.equal(patch.patch.access_page, null);
});

test('화면을 말하지 않으면 건드리지 않는다 — 살아 있다는 신호만 보낸다', async () => {
    const supabase = fakeSupabase();

    await touchDevice({ supabase, session, at: AT, win: fakeDevice() });

    const patch = supabase.calls.find((c) => c.op === 'update');
    assert.deepEqual(Object.keys(patch.patch), ['last_active_at']);
});
