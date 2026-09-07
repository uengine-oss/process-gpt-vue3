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

import { TABLE, deviceRow, enablePush, isNativeApp, isRegistered, pushConfigured, registerDevice, unregisterDevice } from './push.js';

const AT = '2026-08-31T00:00:00.000Z';
const session = { user: { email: 'me@company.com' } };

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
                delete() {
                    return {
                        eq(column, value) {
                            calls.push({ op: 'delete', table, column, value });
                            return Promise.resolve({ error: behaviour.error || null });
                        }
                    };
                },
                select() {
                    return {
                        eq(column, value) {
                            return {
                                limit() {
                                    calls.push({ op: 'select', table, column, value });
                                    return Promise.resolve({
                                        data: behaviour.rows || [],
                                        error: behaviour.error || null
                                    });
                                }
                            };
                        }
                    };
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
    const row = deviceRow(session, 'token-1', AT);

    assert.deepEqual(row, {
        user_email: 'me@company.com',
        device_token: 'token-1',
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
// 저장
// ---------------------------------------------------------------------------

test('같은 사용자가 다시 등록하면 덮어쓴다', async () => {
    // 기기를 바꾸거나 토큰이 갱신되면, 옛 토큰으로 계속 보내다 아무 데도 닿지 않는다.
    const supabase = fakeSupabase();

    const result = await registerDevice({ supabase, session, token: 'new-token', at: AT });

    assert.equal(result.ok, true);
    assert.equal(supabase.calls[0].table, TABLE);
    assert.equal(supabase.calls[0].options.onConflict, 'user_email');
    assert.equal(supabase.calls[0].row.device_token, 'new-token');
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

test('알림 끄기는 본인 행만 지운다', async () => {
    const supabase = fakeSupabase();

    await unregisterDevice({ supabase, session });

    assert.deepEqual(supabase.calls[0], {
        op: 'delete',
        table: TABLE,
        column: 'user_email',
        value: 'me@company.com'
    });
});

test('켜져 있는지 확인한다', async () => {
    assert.equal(await isRegistered({ supabase: fakeSupabase({ rows: [{ device_token: 't' }] }), session }), true);
    assert.equal(await isRegistered({ supabase: fakeSupabase({ rows: [] }), session }), false);
});

test('확인에 실패하면 꺼진 것으로 본다', async () => {
    // 켜진 것으로 보면 사용자는 알림이 오는 줄 알고 기다린다.
    const supabase = fakeSupabase({ error: { message: '조회 실패' } });

    assert.equal(await isRegistered({ supabase, session }), false);
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
