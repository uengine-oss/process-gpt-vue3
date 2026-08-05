/**
 * 운영 Supabase(uengine 테넌트)에 붙어 화면별 실측 성능을 잰다. 읽기 전용.
 *
 *   BENCH_LABEL=before node playwright/demo/prod-scenario-bench.mjs
 */
import { chromium } from '@playwright/test';
import fs from 'fs';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5199';
const LABEL = process.env.BENCH_LABEL || 'run';
const EMAIL = process.env.BENCH_EMAIL;
const PW = process.env.BENCH_PW;

const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' });
const p = await c.newPage();

let calls = [];
p.on('response', async (r) => {
    const u = r.url();
    if (!/\/rest\/v1\//.test(u)) return;
    const path = u.split('/rest/v1/')[1];
    const qs = new URLSearchParams(path.split('?')[1] || '');
    let bytes = 0;
    try {
        bytes = (await r.body()).length;
    } catch {}
    const t = r.request().timing();
    calls.push({
        table: path.split('?')[0],
        select: qs.get('select') || '(전체)',
        order: qs.get('order') || '',
        unlimited: !qs.has('limit') && !r.request().headers()['range'],
        bytes,
        ms: t && t.responseEnd > 0 ? t.responseEnd - t.requestStart : 0
    });
});

const results = [];
async function measure(label, fn) {
    calls = [];
    const t0 = Date.now();
    await fn();
    const wall = Date.now() - t0;
    const bytes = calls.reduce((s, x) => s + x.bytes, 0);
    const slowest = [...calls].sort((a, b) => b.ms - a.ms).slice(0, 5);
    const agg = {};
    for (const x of calls) {
        const k = `${x.table} select=${x.select.slice(0, 28)}${x.unlimited ? ' [무제한]' : ''}`;
        agg[k] = agg[k] || { n: 0, bytes: 0, ms: 0 };
        agg[k].n++;
        agg[k].bytes += x.bytes;
        agg[k].ms += x.ms;
    }
    results.push({ label, wall, calls: calls.length, bytes, agg, slowest });

    console.log(`\n===== ${label} — ${wall}ms / 호출 ${calls.length}건 / ${(bytes / 1024).toFixed(0)}KB =====`);
    Object.entries(agg)
        .sort((a, b) => b[1].ms - a[1].ms)
        .slice(0, 8)
        .forEach(([k, v]) =>
            console.log(`  ${String(v.n).padStart(3)}회 ${v.ms.toFixed(0).padStart(6)}ms ${(v.bytes / 1024).toFixed(0).padStart(6)}KB  ${k}`)
        );
    console.log('  가장 느린 단일 호출:');
    slowest.slice(0, 3).forEach((x) => console.log(`    ${x.ms.toFixed(0)}ms ${(x.bytes / 1024).toFixed(0)}KB  ${x.table} ${x.order ? 'order=' + x.order.slice(0, 30) : ''}`));
}

// --- 로그인 ---
await p.goto(`${BASE}/auth/login`, { waitUntil: 'load', timeout: 90000 });
await p.waitForTimeout(2500);
await p.locator('.cp-id input').fill(EMAIL);
await p.locator('.cp-pwd input').fill(PW);

await measure('로그인 → 첫 화면', async () => {
    await p.locator('.cp-login').click();
    await p.waitForURL((u) => !u.pathname.includes('/auth/login'), { timeout: 60000 });
    await p.waitForTimeout(12000);
});

for (const [label, path] of [
    ['할일 목록', '/todolist'],
    ['인스턴스 목록', '/admin'],
    ['프로세스 정의 체계도', '/definition-map']
]) {
    await measure(label, async () => {
        await p.goto(`${BASE}${path}`, { waitUntil: 'load', timeout: 90000 });
        await p.waitForTimeout(11000);
    });
}

// --- 채팅방 열기 ---
await measure('채팅방 열기', async () => {
    const room = p.locator('.v-list-item').filter({ hasText: /./ }).first();
    await room.click({ timeout: 20000 }).catch(() => {});
    await p.waitForTimeout(12000);
});

const out = `/private/tmp/claude-501/-Users-uengine-process-gpt/bd5b43df-79f3-457c-b577-87d8ce7a9538/scratchpad/bench-${LABEL}.json`;
fs.writeFileSync(out, JSON.stringify(results, null, 1));
console.log('\n총계:', results.reduce((s, r) => s + r.bytes, 0) / 1024 / 1024, 'MB /', results.reduce((s, r) => s + r.calls, 0), '호출');
console.log('저장:', out);
await b.close();
