/** blockingLoading 계산과 오버레이 바인딩이 의도대로인지 직접 확인. */
import { chromium } from '@playwright/test';
const BASE='http://127.0.0.1:5199';
const b=await chromium.launch();
const c=await b.newContext({viewport:{width:1440,height:900},locale:'ko-KR'});
const p=await c.newPage();
await p.goto(`${BASE}/auth/login`,{waitUntil:'load',timeout:90000});
await p.waitForTimeout(2500);
await p.locator('.cp-id input').first().fill(process.env.BENCH_EMAIL);
await p.locator('.cp-pwd input').first().fill(process.env.BENCH_PW);
await p.locator('.cp-login').first().click();
await p.waitForURL(u=>!u.pathname.includes('/auth/login'),{timeout:60000});
await p.waitForTimeout(14000);

const probe = async (settled, count) => {
  await p.evaluate(([s,n])=>{ window.$app_.initialLoadSettled=s; window.$app_.loadingCount=n; },[settled,count]);
  await p.waitForTimeout(600);
  return await p.evaluate(()=>({
    scrim: !!document.querySelector('.v-overlay__scrim'),
    bar: !!document.querySelector('.my-progress-linear'),
    blocking: window.$app_.blockingLoading,
    loading: window.$app_.loading
  }));
};
console.log('\n case                      | scrim | 진행바 | blockingLoading | loading');
for (const [s,n,label] of [[false,0,'부팅중 · 유휴  '],[false,2,'부팅중 · 로딩중'],[true,0,'부팅후 · 유휴  '],[true,2,'부팅후 · 로딩중']]) {
  const r = await probe(s,n);
  console.log(` ${label} settled=${String(s).padEnd(5)} count=${n} | ${String(r.scrim).padEnd(5)} | ${String(r.bar).padEnd(6)} | ${String(r.blocking).padEnd(15)} | ${r.loading}`);
}
await p.evaluate(()=>{ window.$app_.loadingCount=0; });
await b.close();
