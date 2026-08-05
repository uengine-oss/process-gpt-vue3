/**
 * 배포된 운영 사이트의 특정 페이지 로딩을 계측한다. 읽기 전용.
 *
 *   TARGET=https://uengine.process-gpt.io/definition-map \
 *   BENCH_EMAIL=... BENCH_PW=... node playwright/demo/live-page-bench.mjs
 */
import { chromium } from '@playwright/test';

const ORIGIN = process.env.ORIGIN || 'https://uengine.process-gpt.io';
const TARGET = process.env.TARGET || `${ORIGIN}/definition-map`;

const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' });
const p = await c.newPage();

const reqs = [];
p.on('response', async (r) => {
    const t = r.request().timing();
    let bytes = 0;
    try {
        bytes = (await r.body()).length;
    } catch {}
    reqs.push({
        url: r.url(),
        type: r.request().resourceType(),
        status: r.status(),
        ms: t && t.responseEnd > 0 ? t.responseEnd - t.requestStart : 0,
        bytes
    });
});

const console_errors = [];
p.on('pageerror', (e) => console_errors.push(e.message));

// --- 로그인 ---
await p.goto(`${ORIGIN}/auth/login`, { waitUntil: 'load', timeout: 120000 });
await p.waitForTimeout(4000);
await p.locator('.cp-id input').first().fill(process.env.BENCH_EMAIL);
await p.locator('.cp-pwd input').first().fill(process.env.BENCH_PW);
await p.locator('.cp-login').first().click();
await p.waitForURL((u) => !u.pathname.includes('/auth/login'), { timeout: 90000 });
await p.waitForTimeout(8000);

// --- 대상 페이지 계측 ---
reqs.length = 0;
const t0 = Date.now();
await p.goto(TARGET, { waitUntil: 'domcontentloaded', timeout: 120000 });
const domReady = Date.now() - t0;

// 네트워크가 조용해질 때까지(또는 60초) 기다렸다가 '실질 완료' 시점을 잡는다
let lastCount = -1;
let quietSince = Date.now();
while (Date.now() - t0 < 60000) {
    await p.waitForTimeout(1000);
    if (reqs.length !== lastCount) {
        lastCount = reqs.length;
        quietSince = Date.now();
    } else if (Date.now() - quietSince > 3000) break;
}
const settled = Date.now() - t0;

const landed = p.url();
const onTarget = landed.includes(new URL(TARGET).pathname);
const hasMap = await p.locator('.definition-map-wrapper, .definition-map-card').count();
if (!onTarget || hasMap === 0) {
    console.log(`\n[경고] 대상 페이지에 도착하지 못했습니다. url=${landed} mapEl=${hasMap}`);
    console.log('       측정값은 비교에 쓰지 말 것.');
}

const total = reqs.reduce((s, r) => s + r.bytes, 0);
const api = reqs.filter((r) => /\/rest\/v1\//.test(r.url));
const apiBytes = api.reduce((s, r) => s + r.bytes, 0);

console.log(`\n===== ${TARGET} =====`);
console.log(`DOM ready         ${domReady}ms`);
console.log(`네트워크 안정화   ${settled}ms`);
console.log(`요청 ${reqs.length}건 / ${(total / 1024 / 1024).toFixed(2)}MB   (그중 API ${api.length}건 / ${(apiBytes / 1024).toFixed(0)}KB)`);

console.log('\n-- 가장 느린 요청 10 --');
[...reqs]
    .sort((a, b) => b.ms - a.ms)
    .slice(0, 10)
    .forEach((r) => {
        const short = r.url.replace(/^https?:\/\/[^/]+/, '').replace(/\/rest\/v1\//, '').slice(0, 78);
        console.log(`  ${String(Math.round(r.ms)).padStart(6)}ms ${(r.bytes / 1024).toFixed(0).padStart(7)}KB [${r.type}] ${short}`);
    });

console.log('\n-- 전송량 상위 10 --');
[...reqs]
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 10)
    .forEach((r) => {
        const short = r.url.replace(/^https?:\/\/[^/]+/, '').replace(/\/rest\/v1\//, '').slice(0, 78);
        console.log(`  ${(r.bytes / 1024).toFixed(0).padStart(7)}KB ${String(Math.round(r.ms)).padStart(6)}ms [${r.type}] ${short}`);
    });

if (console_errors.length) {
    console.log('\n-- pageerror --');
    [...new Set(console_errors)].slice(0, 5).forEach((e) => console.log('  ', e.slice(0, 140)));
}

await p.screenshot({ path: (process.env.OUT || '/tmp') + '/live-page.png' });
await b.close();
