/**
 * 두 가지 체감 문제를 계측한다. 읽기 전용.
 *   1) 첫 화면 — 콘텐츠는 그려졌는데 로딩 스플래시가 계속 떠 있는 구간
 *   2) 채팅방 열기 — 클릭부터 메시지가 보일 때까지
 *
 *   ORIGIN=https://uengine.process-gpt.io BENCH_EMAIL=... BENCH_PW=... \
 *     node playwright/demo/splash-and-chat-bench.mjs
 */
import { chromium } from '@playwright/test';

const ORIGIN = process.env.ORIGIN || 'https://uengine.process-gpt.io';
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' });
const p = await c.newPage();

let reqs = [];
p.on('response', async (r) => {
    const t = r.request().timing();
    let bytes = 0;
    try {
        bytes = (await r.body()).length;
    } catch {}
    reqs.push({
        url: r.url(),
        type: r.request().resourceType(),
        ms: t && t.responseEnd > 0 ? t.responseEnd - t.requestStart : 0,
        bytes,
        at: Date.now()
    });
});

function summarize(label, since, topN = 8) {
    const win = reqs.filter((r) => r.at >= since);
    const api = win.filter((r) => /\/rest\/v1\/|\/rpc\/|process-gpt-deepagents|agent-router/.test(r.url));
    console.log(`\n  [${label}] 요청 ${win.length}건 (API ${api.length}) / ${(win.reduce((s, r) => s + r.bytes, 0) / 1024).toFixed(0)}KB`);
    [...win]
        .sort((a, b) => b.ms - a.ms)
        .slice(0, topN)
        .forEach((r) => {
            const s = r.url.replace(/^https?:\/\/[^/]+/, '').replace(/\/rest\/v1\//, '').slice(0, 76);
            console.log(`      ${String(Math.round(r.ms)).padStart(6)}ms ${(r.bytes / 1024).toFixed(0).padStart(6)}KB [${r.type}] ${s}`);
        });
}

// ---------- 1) 로그인 → 첫 화면 ----------
await p.goto(`${ORIGIN}/auth/login`, { waitUntil: 'load', timeout: 120000 });
await p.waitForTimeout(4000);
await p.locator('.cp-id input').first().fill(process.env.BENCH_EMAIL);
await p.locator('.cp-pwd input').first().fill(process.env.BENCH_PW);

reqs = [];
const tLogin = Date.now();
await p.locator('.cp-login').first().click();
await p.waitForURL((u) => !u.pathname.includes('/auth/login'), { timeout: 90000 });
const tRouted = Date.now() - tLogin;

// 스플래시(.main-page-skeleton)가 사라지는 시점 = App.vue 의 loadScreen=true
let tSplashGone = null;
try {
    await p.waitForSelector('.main-page-skeleton', { state: 'detached', timeout: 90000 });
    tSplashGone = Date.now() - tLogin;
} catch {
    tSplashGone = -1;
}
// 실제 콘텐츠가 보이는 시점
let tContent = null;
try {
    await p.waitForSelector('.v-navigation-drawer, aside, .definition-map-wrapper', { timeout: 60000 });
    tContent = Date.now() - tLogin;
} catch {
    tContent = -1;
}
await p.waitForTimeout(6000);

console.log(`\n===== 1) 로그인 → 첫 화면 (${ORIGIN}) =====`);
console.log(`  라우팅 완료         ${tRouted}ms`);
console.log(`  콘텐츠 등장         ${tContent}ms`);
console.log(`  스플래시 사라짐     ${tSplashGone}ms   ← 이 시점까지 화면이 잠겨 있다`);
if (tSplashGone > 0 && tContent > 0) console.log(`  ** 콘텐츠 후 추가 대기 ${tSplashGone - tContent}ms **`);
summarize('로그인 직후 구간', tLogin);

// ---------- 2) 채팅방 열기 ----------
const rooms = p.locator('.v-list-item').filter({ hasText: /\S/ });
const n = await rooms.count();
console.log(`\n===== 2) 채팅방 열기 (사이드바 항목 ${n}개) =====`);

for (const idx of [0, 1]) {
    if (idx >= n) break;
    reqs = [];
    const t0 = Date.now();
    await rooms.nth(idx).click({ timeout: 20000 }).catch(() => {});
    // 메시지 영역이 채워질 때까지
    let painted = -1;
    for (let i = 0; i < 40; i++) {
        await p.waitForTimeout(500);
        const cnt = await p.locator('.chat-message, .msg-user, .message-item, .v-card-text').count();
        if (cnt > 0) {
            painted = Date.now() - t0;
            break;
        }
    }
    // 네트워크가 조용해질 때까지
    let last = -1;
    let quiet = Date.now();
    while (Date.now() - t0 < 40000) {
        await p.waitForTimeout(700);
        if (reqs.length !== last) {
            last = reqs.length;
            quiet = Date.now();
        } else if (Date.now() - quiet > 2500) break;
    }
    console.log(`\n  방 #${idx + 1}: 메시지 등장 ${painted}ms / 네트워크 안정화 ${Date.now() - t0}ms`);
    summarize(`방 #${idx + 1} 열기`, t0);
}

await p.screenshot({ path: (process.env.OUT || '/tmp') + '/splash-chat.png' });
await b.close();
