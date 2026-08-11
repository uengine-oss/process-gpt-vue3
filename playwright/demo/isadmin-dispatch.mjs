/**
 * localStorageChange(isAdmin) 을 누가 쏘는지 스택으로 잡는다. 읽기 전용.
 *   BENCH_EMAIL=... BENCH_PW=... node playwright/demo/isadmin-dispatch.mjs
 */
import { chromium } from '@playwright/test';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5199';
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' });
const p = await c.newPage();

await p.addInitScript(() => {
    window.__disp = [];
    const orig = window.dispatchEvent.bind(window);
    window.dispatchEvent = function (ev) {
        if (ev && ev.type === 'localStorageChange' && ev.detail && ev.detail.key === 'isAdmin') {
            window.__disp.push({ at: Date.now(), stack: new Error().stack });
        }
        return orig(ev);
    };
});

await p.goto(`${BASE}/auth/login`, { waitUntil: 'load', timeout: 90000 });
await p.waitForTimeout(2500);
await p.locator('.cp-id input').first().fill(process.env.BENCH_EMAIL);
await p.locator('.cp-pwd input').first().fill(process.env.BENCH_PW);
await p.locator('.cp-login').first().click();
await p.waitForURL((u) => !u.pathname.includes('/auth/login'), { timeout: 60000 });
await p.waitForTimeout(12000);
const before = await p.evaluate(() => window.__disp.length);

const rooms = p.locator('.v-list-item').filter({ hasText: /\S/ });
await rooms.nth(0).click({ timeout: 20000 }).catch(() => {});
await p.waitForTimeout(15000);

const all = await p.evaluate(() => window.__disp);
console.log(`\n첫 화면 ${before}건 / 채팅방 클릭 후 ${all.length - before}건`);
all.forEach((d, i) => {
    console.log(`\n[${i + 1}] ${i < before ? '첫화면' : '채팅방클릭'}`);
    String(d.stack || '')
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => s.startsWith('at '))
        .slice(0, 14)
        .forEach((f) => console.log('      ' + f.slice(0, 150)));
});

await b.close();
