/**
 * 인덱스가 겨냥하는 쿼리들을 로그인된 supabase 클라이언트로 직접 실행해 시간을 잰다.
 * UI 클릭에 의존하지 않아 before/after 비교가 안정적이다. 읽기 전용.
 *
 *   BENCH_LABEL=before BENCH_EMAIL=... BENCH_PW=... \
 *     node playwright/demo/index-impact-bench.mjs
 */
import { chromium } from '@playwright/test';
import fs from 'fs';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5199';
const LABEL = process.env.BENCH_LABEL || 'run';
const RUNS = Number(process.env.BENCH_RUNS || 5);

const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' });
const p = await c.newPage();

await p.goto(`${BASE}/auth/login`, { waitUntil: 'load', timeout: 90000 });
await p.waitForTimeout(2500);
await p.locator('.cp-id input').fill(process.env.BENCH_EMAIL);
await p.locator('.cp-pwd input').fill(process.env.BENCH_PW);
await p.locator('.cp-login').click();
await p.waitForURL((u) => !u.pathname.includes('/auth/login'), { timeout: 60000 });
await p.waitForTimeout(6000);

const results = await p.evaluate(
    async ({ runs }) => {
        const sb = window.$supabase;
        const tenant = window.$tenantName;
        const out = [];

        // 대표 채팅방 하나를 골라 chats 쿼리에 쓴다
        const { data: rooms } = await sb.from('chat_rooms').select('id').eq('tenant_id', tenant).limit(1);
        const roomId = rooms && rooms[0] ? rooms[0].id : null;

        const cases = [
            {
                name: 'chats: 방 메시지 (id 필터 + JSONB 정렬)',
                skip: !roomId,
                run: () =>
                    sb.from('chats').select('*').eq('id', roomId).order('messages->>timeStamp', { ascending: false }).limit(50)
            },
            {
                name: 'chats: tenant 스코프 카운트',
                run: () => sb.from('chats').select('uuid', { count: 'exact', head: true }).eq('tenant_id', tenant)
            },
            {
                name: 'chat_rooms: 테넌트 목록',
                run: () => sb.from('chat_rooms').select('id,name,message,participants').eq('tenant_id', tenant)
            },
            {
                name: 'todolist: 테넌트 + updated_at 정렬',
                run: () => sb.from('todolist').select('*').eq('tenant_id', tenant).order('updated_at', { ascending: false }).limit(100)
            },
            {
                name: 'bpm_proc_inst: 테넌트 + start_date 정렬',
                run: () =>
                    sb.from('bpm_proc_inst').select('*').eq('tenant_id', tenant).order('start_date', { ascending: false }).limit(100)
            },
            {
                name: 'proc_def: 목록(투영)',
                run: () => sb.from('proc_def').select('uuid,id,name,type,isdeleted').eq('tenant_id', tenant).eq('isdeleted', false)
            }
        ];

        for (const t of cases) {
            if (t.skip) {
                out.push({ name: t.name, skipped: true });
                continue;
            }
            const times = [];
            let rows = 0;
            let err = null;
            for (let i = 0; i < runs; i++) {
                const t0 = performance.now();
                const r = await t.run();
                times.push(performance.now() - t0);
                if (r.error) err = r.error.message;
                rows = r.count != null ? r.count : (r.data || []).length;
            }
            times.sort((a, b) => a - b);
            out.push({
                name: t.name,
                median: Math.round(times[Math.floor(times.length / 2)]),
                min: Math.round(times[0]),
                max: Math.round(times[times.length - 1]),
                rows,
                err
            });
        }
        return { tenant, roomId, out };
    },
    { runs: RUNS }
);

console.log(`\n===== 인덱스 영향 벤치 [${LABEL}] — tenant=${results.tenant}, ${RUNS}회 중앙값 =====`);
console.log('쿼리'.padEnd(46), 'median', '  min', '  max', ' rows');
console.log('-'.repeat(86));
for (const r of results.out) {
    if (r.skipped) {
        console.log(`${r.name.padEnd(46)} (건너뜀 - 대상 없음)`);
        continue;
    }
    console.log(
        `${r.name.padEnd(46)} ${String(r.median).padStart(5)}ms ${String(r.min).padStart(5)} ${String(r.max).padStart(5)} ${String(r.rows).padStart(6)}${r.err ? '  ERR ' + r.err.slice(0, 40) : ''}`
    );
}

const out = `/private/tmp/claude-501/-Users-uengine-process-gpt/bd5b43df-79f3-457c-b577-87d8ce7a9538/scratchpad/idxbench-${LABEL}.json`;
fs.writeFileSync(out, JSON.stringify(results, null, 1));
console.log('\n저장:', out);
await b.close();
