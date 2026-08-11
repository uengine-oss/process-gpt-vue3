/**
 * checkDBConnection → isConnection → writeUserData 체인을 누가 시작하는지 잡는다. 읽기 전용.
 *   BENCH_EMAIL=... BENCH_PW=... node playwright/demo/checkdb-callers.mjs
 */
import { chromium } from '@playwright/test';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5199';
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' });
const p = await c.newPage();

await p.addInitScript(() => {
    window.__gs = [];
    const hook = setInterval(() => {
        const sb = window.$supabase;
        if (sb && sb.auth && !sb.auth.__hooked) {
            sb.auth.__hooked = true;
            const og = sb.auth.getSession.bind(sb.auth);
            sb.auth.getSession = function (...a) {
                window.__gs.push({ at: Date.now(), stack: new Error().stack });
                return og(...a);
            };
            clearInterval(hook);
        }
    }, 100);
    setTimeout(() => clearInterval(hook), 40000);
});

await p.goto(`${BASE}/auth/login`, { waitUntil: 'load', timeout: 90000 });
await p.waitForTimeout(2500);
await p.locator('.cp-id input').first().fill(process.env.BENCH_EMAIL);
await p.locator('.cp-pwd input').first().fill(process.env.BENCH_PW);
await p.locator('.cp-login').first().click();
await p.waitForURL((u) => !u.pathname.includes('/auth/login'), { timeout: 60000 });
await p.waitForTimeout(12000);
const before = await p.evaluate(() => window.__gs.length);

const rooms = p.locator('.v-list-item').filter({ hasText: /\S/ });
await rooms.nth(0).click({ timeout: 20000 }).catch(() => {});
await p.waitForTimeout(15000);

const all = await p.evaluate(() => window.__gs);
console.log(`\ngetSession 호출: 첫화면 ${before}건 / 채팅방 클릭 후 ${all.length - before}건`);
all.slice(before).forEach((d, i) => {
    console.log(`\n[채팅방클릭 ${i + 1}]`);
    String(d.stack || '')
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => s.startsWith('at '))
        .filter((s) => !/@supabase|postgrest|gotrue/.test(s))
        .slice(0, 14)
        .forEach((f) => console.log('      ' + f.slice(0, 160)));
});

await b.close();
