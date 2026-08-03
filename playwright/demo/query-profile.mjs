/**
 * 화면별로 Supabase REST 를 몇 번, 어떤 모양으로 호출하는지 집계한다.
 * (행 수는 환경마다 달라도 '호출 횟수'와 'select 모양'은 동일하다)
 *
 * 사용: node playwright/demo/query-profile.mjs
 */
import { chromium } from '@playwright/test';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5199';
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' });
const p = await c.newPage();

let calls = [];
p.on('response', async (r) => {
    const u = r.url();
    if (!/\/rest\/v1\//.test(u)) return;
    const path = u.split('/rest/v1/')[1];
    const table = path.split('?')[0];
    const qs = new URLSearchParams(path.split('?')[1] || '');
    let bytes = 0;
    try {
        bytes = (await r.body()).length;
    } catch {}
    calls.push({
        table,
        select: qs.get('select') || '(전체)',
        hasLimit: qs.has('limit') || !!r.request().headers()['range'],
        order: qs.get('order') || '',
        bytes
    });
});

function report(label) {
    const byTable = {};
    for (const c of calls) {
        const k = `${c.table}  select=${c.select.slice(0, 40)}${c.order ? '  order=' + c.order.slice(0, 28) : ''}${c.hasLimit ? '' : '  [무제한]'}`;
        byTable[k] = byTable[k] || { n: 0, bytes: 0 };
        byTable[k].n++;
        byTable[k].bytes += c.bytes;
    }
    const rows = Object.entries(byTable).sort((a, b) => b[1].bytes - a[1].bytes);
    const totalBytes = calls.reduce((s, c) => s + c.bytes, 0);
    console.log(`\n===== ${label} — 호출 ${calls.length}건 / ${(totalBytes / 1024).toFixed(0)}KB =====`);
    rows.slice(0, 12).forEach(([k, v]) => console.log(`  ${String(v.n).padStart(3)}회 ${(v.bytes / 1024).toFixed(0).padStart(6)}KB  ${k}`));
    calls = [];
}

await p.goto(`${BASE}/auth/login`, { waitUntil: 'load', timeout: 90000 });
await p.waitForTimeout(3000);
await p.locator('.cp-id input').fill('demo@localhost');
await p.locator('.cp-pwd input').fill('demo1234');
calls = [];
await p.locator('.cp-login').click();
await p.waitForURL((u) => !u.pathname.includes('/auth/login'), { timeout: 45000 });
await p.waitForTimeout(9000);
report('로그인 → 프로세스 정의 체계도');

for (const [label, path] of [['할일 목록', '/todolist'], ['인스턴스 목록', '/admin']]) {
    await p.goto(`${BASE}${path}`, { waitUntil: 'load', timeout: 60000 });
    calls = [];
    await p.waitForTimeout(8000);
    report(label);
}

// 채팅방 열기
await p.goto(`${BASE}/definition-map`, { waitUntil: 'load', timeout: 60000 });
await p.waitForTimeout(5000);
calls = [];
const room = p.locator('.v-list-item, .chat-room-item').filter({ hasText: '프로세스' }).first();
await room.click({ timeout: 15000 }).catch(() => {});
await p.waitForTimeout(9000);
report('채팅방 열기');

await b.close();
