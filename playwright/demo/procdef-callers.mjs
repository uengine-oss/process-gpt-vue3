/**
 * 채팅방을 열 때 proc_def 를 읽는 주체를 스택트레이스로 잡는다. 읽기 전용.
 *
 *   BENCH_EMAIL=... BENCH_PW=... node playwright/demo/procdef-callers.mjs
 */
import { chromium } from '@playwright/test';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5199';
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' });
const p = await c.newPage();

// fetch 를 감싸 proc_def 요청마다 호출 스택을 남긴다.
await p.addInitScript(() => {
    window.__procDefCalls = [];
    const orig = window.fetch;
    window.fetch = function (...args) {
        const url = typeof args[0] === 'string' ? args[0] : args[0] && args[0].url;
        if (url && /proc_def/.test(url)) {
            window.__procDefCalls.push({
                url: String(url).replace(/^https?:\/\/[^/]+\/rest\/v1\//, ''),
                at: Date.now(),
                stack: new Error().stack
            });
        }
        return orig.apply(this, args);
    };
});

await p.goto(`${BASE}/auth/login`, { waitUntil: 'load', timeout: 90000 });
await p.waitForTimeout(2500);
await p.locator('.cp-id input').first().fill(process.env.BENCH_EMAIL);
await p.locator('.cp-pwd input').first().fill(process.env.BENCH_PW);
await p.locator('.cp-login').first().click();
await p.waitForURL((u) => !u.pathname.includes('/auth/login'), { timeout: 60000 });
await p.waitForTimeout(12000);

const beforeCount = await p.evaluate(() => window.__procDefCalls.length);
console.log(`\n===== 첫 화면 로딩 중 proc_def 요청 ${beforeCount}건 =====`);

// 채팅방 하나 열기
const rooms = p.locator('.v-list-item').filter({ hasText: /\S/ });
const n = await rooms.count();
console.log(`사이드바 항목 ${n}개 — 첫 항목 클릭`);
await rooms.nth(0).click({ timeout: 20000 }).catch(() => {});
await p.waitForTimeout(15000);

const calls = await p.evaluate((skip) => window.__procDefCalls.slice(skip), beforeCount);

console.log(`\n===== 채팅방 열기 구간 proc_def 요청 ${calls.length}건 =====`);
calls.forEach((cl, i) => {
    console.log(`\n[${i + 1}] ${cl.url.slice(0, 110)}`);
    const frames = String(cl.stack || '')
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => s.startsWith('at '))
        // fetch 래퍼 / supabase 내부 프레임은 걷어내고 앱 코드만 본다
        .filter((s) => !/postgrest|supabase|node_modules\/@supabase/.test(s))
        .slice(0, 12);
    frames.forEach((f) => console.log('      ' + f.slice(0, 150)));
});

await b.close();
