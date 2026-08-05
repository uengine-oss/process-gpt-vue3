/**
 * isAdmin 이벤트 억제 후에도 사이드바(정의 목록·관리자 메뉴)와 채팅방이 정상인지 확인. 읽기 전용.
 *   BENCH_EMAIL=... BENCH_PW=... node playwright/demo/sidebar-verify.mjs
 */
import { chromium } from '@playwright/test';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5199';
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' });
const p = await c.newPage();

await p.goto(`${BASE}/auth/login`, { waitUntil: 'load', timeout: 90000 });
await p.waitForTimeout(2500);
await p.locator('.cp-id input').first().fill(process.env.BENCH_EMAIL);
await p.locator('.cp-pwd input').first().fill(process.env.BENCH_PW);
await p.locator('.cp-login').first().click();
await p.waitForURL((u) => !u.pathname.includes('/auth/login'), { timeout: 60000 });
await p.waitForTimeout(14000);

const state = await p.evaluate(() => ({
    isAdmin: localStorage.getItem('isAdmin'),
    role: localStorage.getItem('role'),
    userName: localStorage.getItem('userName'),
    email: localStorage.getItem('email')
}));
console.log('\n=== localStorage ===');
console.log(state);

const sideTexts = await p.locator('aside .v-list-item').allTextContents();
console.log(`\n=== 사이드바 항목 ${sideTexts.length}개 ===`);
console.log(
    sideTexts
        .map((t) => t.replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .join(' | ')
        .slice(0, 900)
);

// 채팅방 열기
const rooms = p.locator('.v-list-item').filter({ hasText: /\S/ });
await rooms.nth(0).click({ timeout: 20000 }).catch(() => {});
await p.waitForTimeout(10000);
const msgCount = await p.locator('.chat-message, .msg-user, .message-item, .v-card-text').count();
console.log(`\n=== 채팅방 ===`);
console.log(`url=${p.url()}  메시지 요소 ${msgCount}개`);

await p.screenshot({ path: (process.env.OUT || '/tmp') + '/sidebar-verify.png', fullPage: false });
console.log('스크린샷:', (process.env.OUT || '/tmp') + '/sidebar-verify.png');
await b.close();
