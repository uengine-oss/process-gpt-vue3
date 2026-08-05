/**
 * 운영 Supabase REST 응답 시간을 재는 읽기 전용 진단 스크립트.
 * 쓰기·스키마 변경은 하지 않는다.
 */
import fs from 'fs';

const env = Object.fromEntries(
    fs.readFileSync(process.argv[2], 'utf8').split('\n').filter(Boolean).map((l) => {
        const i = l.indexOf('=');
        return [l.slice(0, i), l.slice(i + 1)];
    })
);
const URL_ = env.PROD_URL;
const KEY = env.PROD_KEY;

async function timed(label, path, { count = true, runs = 3 } = {}) {
    const headers = { apikey: KEY, Authorization: `Bearer ${KEY}`, Accept: 'application/json' };
    if (count) {
        headers.Prefer = 'count=exact';
        headers.Range = '0-0';
    }
    const times = [];
    let status = 0;
    let rows = '?';
    let bytes = 0;
    for (let i = 0; i < runs; i++) {
        const t0 = performance.now();
        try {
            const r = await fetch(`${URL_}/rest/v1/${path}`, { headers });
            const body = await r.text();
            times.push(performance.now() - t0);
            status = r.status;
            bytes = body.length;
            const cr = r.headers.get('content-range');
            if (cr) rows = cr.split('/')[1];
            if (r.status >= 400) rows = body.slice(0, 90);
        } catch (e) {
            times.push(performance.now() - t0);
            rows = 'ERR ' + e.message.slice(0, 50);
        }
    }
    times.sort((a, b) => a - b);
    const med = times[Math.floor(times.length / 2)];
    console.log(
        `${label.padEnd(34)} ${String(status).padEnd(4)} ${med.toFixed(0).padStart(6)}ms  rows=${String(rows).padEnd(10)} ${bytes}B`
    );
    return med;
}

console.log('label'.padEnd(34), 'http', '  median', ' rows');
console.log('-'.repeat(86));
for (const [label, path] of JSON.parse(process.argv[3])) {
    await timed(label, path);
}
