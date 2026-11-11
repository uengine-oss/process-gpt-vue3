/**
 * 휴대폰 범위.
 *
 * 지키려는 것: 휴대폰(라이트 버전)에서는 관리 · 설계 · 분석 화면을 열지 않고, 내 일을 처리하는 화면
 * (할 일 · 인스턴스 · 대화 · 알림 · 프로세스 실행)은 그대로 여는 것. PC 와 PAL · uEngine 은 막지 않는다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { inPhoneScope, isDesktopOnlyPath, phoneRedirect, DESKTOP_ONLY_PATH } from './index.js';

const phone = { innerWidth: 390, $mode: 'ProcessGPT', $pal: false };
const desktopOnPhone = { innerWidth: 1280, $mode: 'ProcessGPT', $pal: false };

test('폭 768px 이하 · Process GPT 모드만 휴대폰 범위', () => {
    assert.equal(inPhoneScope(phone), true);
    assert.equal(inPhoneScope({ ...phone, innerWidth: 768 }), true);
    assert.equal(inPhoneScope(desktopOnPhone), false, 'PC 화면으로 보기(1280px)');
    assert.equal(inPhoneScope({ ...phone, $pal: true }), false, 'PAL');
    assert.equal(inPhoneScope({ ...phone, $mode: 'uEngine' }), false, 'uEngine');
    assert.equal(inPhoneScope({ innerWidth: 390 }), true, '모드 미설정은 Process GPT');
    assert.equal(inPhoneScope(null), false);
});

test('관리 · 설계 · 분석 화면은 PC에서만', () => {
    for (const p of [
        '/admin', '/admin/abc', '/admin-console/signup-approvals', '/admin-request',
        '/definitions/a/b', '/definitions-tree', '/forms/x', '/ui-definitions/chat', '/dmn/x', '/business-rule/new',
        '/definition-map/mega/1', '/definition-map/major/2',
        '/organization', '/skills', '/skills/abc', '/process-architecture', '/process-hierarchy/process_management',
        '/analytics/heatmap', '/analysis-dashboard', '/dashboard', '/instance-toplist', '/strategy-board', '/strategy/surveys/1',
        '/mining/handover', '/knowledge', '/review-board', '/merge-requests', '/my-feedback', '/glossary', '/ontology-explorer-new',
        '/system', '/systems', '/external-api-health', '/policy-document', '/call-activity-management', '/work-assignment', '/version-comparison'
    ]) {
        assert.equal(isDesktopOnlyPath(p), true, p);
    }
});

test('내 일을 처리하는 화면은 휴대폰에서도 연다', () => {
    for (const p of [
        '/definition-map', '/definition-map/sub/abc', '/todolist', '/todolist/123', '/instancelist/running', '/instancelist/x.y',
        '/list-pages/completed', '/chat', '/chats', '/notifications', '/account-settings', '/auth/login', '/', DESKTOP_ONLY_PATH
    ]) {
        assert.equal(isDesktopOnlyPath(p), false, p);
    }
});

test('휴대폰 범위에서만 안내 화면으로 보낸다(원래 주소를 들고)', () => {
    assert.deepEqual(phoneRedirect('/skills', '/skills?tab=1', phone), { path: DESKTOP_ONLY_PATH, query: { from: '/skills?tab=1' } });
    assert.equal(phoneRedirect('/skills', '/skills', desktopOnPhone), null);
    assert.equal(phoneRedirect('/todolist', '/todolist', phone), null);
});
