/**
 * VerticalSidebar.getDefinitionList() 를 채팅방 열기 때 다시 돌리는 트리거를 찾는다. 읽기 전용.
 * EventBus emit / localStorageChange / 라우트 변경을 시간순으로 기록해 proc_def 요청과 대조한다.
 *
 *   BENCH_EMAIL=... BENCH_PW=... node playwright/demo/procdef-trigger.mjs
 */
import { chromium } from '@playwright/test';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5199';
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' });
const p = await c.newPage();

await p.addInitScript(() => {
    window.__ev = [];
    const t0 = Date.now();
    const log = (kind, detail) => window.__ev.push({ t: Date.now() - t0, kind, detail });

    const orig = window.fetch;
    window.fetch = function (...args) {
        const url = typeof args[0] === 'string' ? args[0] : args[0] && args[0].url;
        if (url && /proc_def/.test(url)) log('FETCH proc_def', String(url).replace(/^https?:\/\/[^/]+\/rest\/v1\//, '').slice(0, 60));
        return orig.apply(this, args);
    };

    window.addEventListener('localStorageChange', (e) => log('localStorageChange', e.detail && e.detail.key));

    // EventBus 는 앱이 만든 뒤에야 잡을 수 있으니 폴링으로 한 번만 감싼다.
    const hook = setInterval(() => {
        const bus = window.EventBus || (window.$app && window.$app.config.globalProperties.EventBus);
        if (bus && !bus.__hooked) {
            bus.__hooked = true;
            const oe = bus.emit.bind(bus);
            bus.emit = (name, ...rest) => {
                log('EventBus.emit', name);
                return oe(name, ...rest);
            };
            clearInterval(hook);
            log('hook', 'EventBus wrapped');
        }
    }, 200);
    setTimeout(() => clearInterval(hook), 30000);
});

await p.goto(`${BASE}/auth/login`, { waitUntil: 'load', timeout: 90000 });
await p.waitForTimeout(2500);
await p.locator('.cp-id input').first().fill(process.env.BENCH_EMAIL);
await p.locator('.cp-pwd input').first().fill(process.env.BENCH_PW);
await p.locator('.cp-login').first().click();
await p.waitForURL((u) => !u.pathname.includes('/auth/login'), { timeout: 60000 });
await p.waitForTimeout(12000);

await p.evaluate(() => window.__ev.push({ t: -1, kind: '───── 채팅방 클릭 ─────', detail: '' }));
const rooms = p.locator('.v-list-item').filter({ hasText: /\S/ });
await rooms.nth(0).click({ timeout: 20000 }).catch(() => {});
await p.waitForTimeout(15000);

const ev = await p.evaluate(() => window.__ev);
console.log('\n===== 이벤트 타임라인 =====');
ev.forEach((e) => {
    if (e.t === -1) return console.log(`\n${e.kind}\n`);
    console.log(`${String(e.t).padStart(7)}ms  ${e.kind.padEnd(18)} ${e.detail || ''}`);
});

await b.close();
