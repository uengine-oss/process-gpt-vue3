/**
 * 화면을 열기 전 인증 관문.
 *
 * 지키려는 것: 휴대폰 웹(/m/)으로 들어와도 포털과 똑같이 로그인 · 2단계 인증(TOTP) · 등록을 거치는 것.
 * 휴대폰 웹이 자기 로그인만 보면 비밀번호만으로 들어와 2단계 인증을 건너뛴다.
 * 앱은 포털 화면이 없으므로 2단계 인증이 필요한 계정을 들이지 않는다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { decide, portalPathFor, NEXT_KEY, PORTAL_LOGIN, PORTAL_ENROLL } from './authGate.js';

function store(init = {}) {
    const s = { ...init };
    return {
        getItem: (k) => (k in s ? s[k] : null),
        setItem: (k, v) => {
            s[k] = String(v);
        },
        removeItem: (k) => {
            delete s[k];
        },
        s
    };
}

const route = (path, extra = {}) => ({ path, fullPath: path, name: extra.name, meta: extra.meta || {} });
const login = route('/login', { name: 'login', meta: { public: true } });
const session = { access_token: 'x' };
const pass = async () => 'pass';

test('휴대폰 주소 → 포털 주소(index.html 의 phoneWebHash 를 거꾸로)', () => {
    assert.equal(portalPathFor('/tasks/abc-1'), '/todolist/abc-1');
    assert.equal(portalPathFor('/tasks'), '/todolist');
    assert.equal(portalPathFor('/instances/def.inst-1'), '/instancelist/def.inst-1');
    assert.equal(portalPathFor('/progress'), '/instancelist/running');
    assert.equal(portalPathFor('/chat/room-9'), '/chats');
    assert.equal(portalPathFor('/notifications'), '/notifications');
    assert.equal(portalPathFor('/me'), '/todolist');
});

test('휴대폰 웹: 세션이 없으면 포털 로그인으로 — 가려던 곳은 기억한다', async () => {
    const storage = store();
    assert.deepEqual(await decide(route('/tasks/t-1'), { web: true, session: null, evaluate: pass, storage }), { location: PORTAL_LOGIN });
    assert.equal(storage.s[NEXT_KEY], '/tasks/t-1');
    assert.deepEqual(await decide(login, { web: true, session: null, evaluate: pass, storage: store() }), { location: PORTAL_LOGIN }, '휴대폰 웹에는 자기 로그인 화면이 없다');
});

test('휴대폰 웹: 비밀번호만 통과한 세션(aal1)은 포털 2단계 인증으로 — 끝나면 같은 화면으로 돌아오게', async () => {
    const r = await decide(route('/tasks/t-1'), { web: true, session, evaluate: async () => 'challenge', storage: store() });
    assert.deepEqual(r, { location: '/auth/two-step?redirect=%2Ftodolist%2Ft-1' });
});

test('휴대폰 웹: 조직이 2단계 인증을 요구하는데 등록 전이면 포털 등록 화면으로', async () => {
    const r = await decide(route('/tasks'), { web: true, session, evaluate: async () => 'enroll', storage: store() });
    assert.deepEqual(r, { location: PORTAL_ENROLL });
});

test('휴대폰 웹: 판정에 포털 주소를 넘긴다', async () => {
    const seen = [];
    await decide(route('/instances/i-1'), { web: true, session, evaluate: async (p) => (seen.push(p), 'pass'), storage: store() });
    assert.deepEqual(seen, ['/instancelist/i-1']);
});

test('휴대폰 웹: 로그인을 마치고 오면 기억해 둔 곳을 한 번만 연다', async () => {
    const storage = store({ [NEXT_KEY]: '/tasks/t-1' });
    assert.deepEqual(await decide(route('/tasks'), { web: true, session, evaluate: pass, storage }), { route: '/tasks/t-1' });
    assert.equal(storage.s[NEXT_KEY], undefined);
    assert.deepEqual(await decide(route('/tasks'), { web: true, session, evaluate: pass, storage }), { allow: true });
});

test('휴대폰 웹: 기억한 주소가 이상하면 쓰지 않는다', async () => {
    for (const bad of ['//evil.example', 'https://evil.example', '/login']) {
        const storage = store({ [NEXT_KEY]: bad });
        assert.deepEqual(await decide(route('/tasks'), { web: true, session, evaluate: pass, storage }), { allow: true }, bad);
    }
});

test('휴대폰 웹: 로그인돼 있는데 로그인 주소로 오면 할 일로', async () => {
    assert.deepEqual(await decide(login, { web: true, session, evaluate: pass, storage: store() }), { route: '/tasks' });
});

test('앱: 세션이 없으면 앱 로그인 화면으로(가려던 곳을 next 로)', async () => {
    assert.deepEqual(await decide(route('/tasks/t-1'), { web: false, session: null, evaluate: pass, storage: store() }), {
        route: { name: 'login', query: { next: '/tasks/t-1' } }
    });
    assert.deepEqual(await decide(login, { web: false, session: null, evaluate: pass, storage: store() }), { allow: true });
});

test('앱: 2단계 인증이 필요한 계정은 로그아웃하고 로그인 화면에서 알린다', async () => {
    for (const d of ['challenge', 'enroll']) {
        const r = await decide(route('/tasks'), { web: false, session, evaluate: async () => d, storage: store() });
        assert.deepEqual(r, { signOut: true, route: { name: 'login', query: { mfa: '1' } } }, d);
    }
});

test('통과하면 그대로 연다', async () => {
    assert.deepEqual(await decide(route('/tasks/t-1'), { web: true, session, evaluate: pass, storage: store() }), { allow: true });
    assert.deepEqual(await decide(route('/tasks/t-1'), { web: false, session, evaluate: pass, storage: store() }), { allow: true });
});
