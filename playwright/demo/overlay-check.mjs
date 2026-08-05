/**
 * $try 오버레이가 (1) 첫 화면 로딩 중에는 화면을 안 잠그고
 * (2) 부팅이 끝난 뒤에는 원래대로 동작하는지 확인. 읽기 전용.
 *
 *   BENCH_EMAIL=... BENCH_PW=... node playwright/demo/overlay-check.mjs
 */
import { chromium } from '@playwright/test';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5199';
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' });
const p = await c.newPage();

await p.goto(`${BASE}/auth/login`, { waitUntil: 'load', timeout: 90000 });
await p.waitForTimeout(2500);
await p.locator('.cp-id input').first().fill(process.env.BENCH_EMAIL);
await p.locator('.cp-pwd input').first().fill(process.env.BENCH_PW);

const t0 = Date.now();
await p.locator('.cp-login').first().click();
await p.waitForURL((u) => !u.pathname.includes('/auth/login'), { timeout: 60000 });

// 부팅 구간을 촘촘히 샘플링한다.
const samples = [];
const deadline = Date.now() + 25000;
while (Date.now() < deadline) {
    const s = await p
        .evaluate(() => {
            const a = window.$app_;
            return {
                skeleton: !!document.querySelector('.main-page-skeleton'),
                // 화면을 실제로 덮는 스크림이 떠 있는가
                scrim: !!document.querySelector('.v-overlay__scrim'),
                bar: !!document.querySelector('.my-progress-linear'),
                count: a ? a.loadingCount : null,
                settled: a ? a.initialLoadSettled : null,
                loadScreen: a ? a.loadScreen : null
            };
        })
        .catch(() => null);
    if (s) samples.push({ t: Date.now() - t0, ...s });
    await p.waitForTimeout(250);
}

console.log('\n===== 부팅 구간 (250ms 간격) =====');
console.log('   시각  스켈레톤  스크림  진행바  loadingCount  settled');
let prev = '';
for (const s of samples) {
    const key = `${s.skeleton}${s.scrim}${s.bar}${s.count > 0}${s.settled}`;
    if (key === prev) continue; // 상태가 바뀔 때만 출력
    prev = key;
    console.log(
        `${String(s.t).padStart(7)}ms  ${String(s.skeleton).padEnd(8)} ${String(s.scrim).padEnd(6)} ${String(s.bar).padEnd(6)} ${String(s.count).padStart(11)}  ${s.settled}`
    );
}

const boot = samples.filter((s) => !s.skeleton && !s.settled);
const blockedDuringBoot = boot.filter((s) => s.scrim).length;
console.log(`\n부팅 중(스켈레톤 걷힌 뒤 ~ settled 전) 샘플 ${boot.length}개, 그중 스크림 떠있던 샘플 ${blockedDuringBoot}개`);
console.log(`최종 상태: settled=${samples.at(-1)?.settled}  loadingCount=${samples.at(-1)?.count}`);

// 부팅 후에는 원래대로 오버레이가 동작해야 한다 — 방을 열며 스크림을 샘플링한다.
const rooms = p.locator('.v-list-item').filter({ hasText: /\S/ });
await rooms.nth(0).click({ timeout: 15000 }).catch((e) => console.log('클릭 실패:', String(e).slice(0, 80)));

const after = [];
const d2 = Date.now() + 8000;
while (Date.now() < d2) {
    const s = await p
        .evaluate(() => ({
            scrim: !!document.querySelector('.v-overlay__scrim'),
            count: window.$app_ ? window.$app_.loadingCount : null,
            settled: window.$app_ ? window.$app_.initialLoadSettled : null
        }))
        .catch(() => null);
    if (s) after.push(s);
    await p.waitForTimeout(120);
}
const busy = after.filter((s) => s.count > 0);
console.log(`\n===== 부팅 후 방 열기 =====`);
console.log(`url=${p.url()}`);
console.log(`샘플 ${after.length}개 / loadingCount>0 인 샘플 ${busy.length}개 / 그중 스크림 뜬 샘플 ${busy.filter((s) => s.scrim).length}개`);
console.log(`(부팅 후에는 loadingCount>0 이면 스크림이 떠야 원래 동작 유지)`);

await p.screenshot({ path: (process.env.OUT || '/tmp') + '/overlay-check.png' });
await b.close();
