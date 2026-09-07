/**
 * 소속 조직 판별.
 *
 * 틀리면 남의 조직 화면이 뜨거나, 아무것도 안 뜨는데 이유를 알 수 없다.
 * 앱에는 주소로 확인할 방법이 없으니 여기서 잡아야 한다.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
    IS_TENANT_SERVER_GLOBAL,
    TENANT_GLOBAL,
    applyTenant,
    portalOriginFor,
    tenantFromSession
} from './tenant.js';

// ---------------------------------------------------------------------------
// 세션에서 읽기
// ---------------------------------------------------------------------------

test('서명된 세션의 조직을 읽는다', () => {
    const session = { user: { app_metadata: { tenant_id: 'uengine' } } };

    assert.equal(tenantFromSession(session), 'uengine');
});

test('사용자가 고칠 수 있는 자리는 믿지 않는다', () => {
    // user_metadata 는 본인이 직접 바꿀 수 있다. 이것을 믿으면 남의 조직 자료를
    // 달라고 말할 수 있게 된다.
    const session = {
        user: {
            app_metadata: {},
            user_metadata: { tenant_id: '남의조직' }
        }
    };

    assert.equal(tenantFromSession(session), null);
});

test('조직이 없는 세션은 null 이다', () => {
    assert.equal(tenantFromSession(null), null);
    assert.equal(tenantFromSession({}), null);
    assert.equal(tenantFromSession({ user: {} }), null);
    assert.equal(tenantFromSession({ user: { app_metadata: { tenant_id: '   ' } } }), null);
});

test('앞뒤 공백은 떼어낸다', () => {
    assert.equal(tenantFromSession({ user: { app_metadata: { tenant_id: ' uengine ' } } }), 'uengine');
});

// ---------------------------------------------------------------------------
// 그 조직의 주소 만들기
// ---------------------------------------------------------------------------

test('조직 이름을 주소 앞에 붙인다', () => {
    assert.equal(portalOriginFor('uengine', 'https://process-gpt.io'), 'https://uengine.process-gpt.io');
});

test('이미 그 조직 주소면 두 번 붙이지 않는다', () => {
    // 붙이면 uengine.uengine.process-gpt.io 가 되어 아무 데도 닿지 않는다.
    assert.equal(
        portalOriginFor('uengine', 'https://uengine.process-gpt.io'),
        'https://uengine.process-gpt.io'
    );
});

test('개발용 주소에는 붙이지 않는다', () => {
    assert.equal(portalOriginFor('uengine', 'http://localhost:8088'), 'http://localhost:8088');
    assert.equal(portalOriginFor('uengine', 'http://127.0.0.1:5173'), 'http://127.0.0.1:5173');
    assert.equal(portalOriginFor('uengine', 'http://10.0.2.2:8088'), 'http://10.0.2.2:8088');
});

test('조직을 모르면 기준 주소를 그대로 쓴다', () => {
    // 억지로 붙이면 존재하지 않는 곳을 가리키고, 그때 나는 오류는 원인이 안 보인다.
    assert.equal(portalOriginFor(null, 'https://process-gpt.io'), 'https://process-gpt.io');
    assert.equal(portalOriginFor('', 'https://process-gpt.io'), 'https://process-gpt.io');
});

test('포트는 유지한다', () => {
    assert.equal(portalOriginFor('uengine', 'https://process-gpt.io:8443'), 'https://uengine.process-gpt.io:8443');
});

test('끝의 슬래시와 경로는 정리한다', () => {
    assert.equal(portalOriginFor('uengine', 'https://process-gpt.io/'), 'https://uengine.process-gpt.io');
});

test('주소가 없거나 이상하면 그대로 돌려준다', () => {
    assert.equal(portalOriginFor('uengine', ''), '');
    assert.equal(portalOriginFor('uengine', '이건 주소가 아니다'), '이건 주소가 아니다');
});

// ---------------------------------------------------------------------------
// 포털 코드가 보는 자리에 심기
// ---------------------------------------------------------------------------

test('재사용하는 코드가 읽는 자리에 넣는다', () => {
    const win = {};

    applyTenant('uengine', win);

    assert.equal(win[TENANT_GLOBAL], 'uengine');
    assert.equal(win[IS_TENANT_SERVER_GLOBAL], false);
});

test('계정을 바꾸면 다시 정할 수 있다', () => {
    // 포털은 부팅 때 한 번 정하고 고정한다. 앱은 로그아웃 후 다른 계정으로
    // 들어올 수 있으므로 고정하면 안 된다.
    const win = {};

    applyTenant('첫번째', win);
    applyTenant('두번째', win);

    assert.equal(win[TENANT_GLOBAL], '두번째');
});

test('조직을 모르면 null 로 남긴다', () => {
    const win = {};

    applyTenant(null, win);

    assert.equal(win[TENANT_GLOBAL], null);
});

test('앱은 조직 선택 서버가 아니다', () => {
    // $isTenantServer 가 true 면 재사용하는 화면이 "조직을 고르라" 는 흐름을 탄다.
    // 앱은 언제나 특정 조직으로 들어가므로 그 화면이 뜨면 갇힌다.
    const win = {};

    applyTenant('uengine', win);

    assert.equal(win[IS_TENANT_SERVER_GLOBAL], false);
});
