/** 스켈레톤이 걷힌 뒤 loadingCount 가 0 으로 돌아올 때까지 = 예전에 화면이 잠겨 있던 구간. */
import { chromium } from '@playwright/test';
const BASE='http://127.0.0.1:5199';
const b=await chromium.launch();
const c=await b.newContext({viewport:{width:1440,height:900},locale:'ko-KR'});
const p=await c.newPage();
await p.goto(`${BASE}/auth/login`,{waitUntil:'load',timeout:90000});
await p.waitForTimeout(2500);
await p.locator('.cp-id input').first().fill(process.env.BENCH_EMAIL);
await p.locator('.cp-pwd input').first().fill(process.env.BENCH_PW);
const t0=Date.now();
await p.locator('.cp-login').first().click();
await p.waitForURL(u=>!u.pathname.includes('/auth/login'),{timeout:60000});

let tSkeleton=null, tIdle=null, sawBusy=false, maxCount=0;
const end=Date.now()+30000;
while(Date.now()<end){
  const s=await p.evaluate(()=>({
    sk:!!document.querySelector('.main-page-skeleton'),
    n:window.$app_?window.$app_.loadingCount:null,
    settled:window.$app_?window.$app_.initialLoadSettled:null
  })).catch(()=>null);
  if(s){
    if(!s.sk && tSkeleton===null) tSkeleton=Date.now()-t0;
    if(s.n>maxCount) maxCount=s.n;
    if(tSkeleton!==null){
      if(s.n>0) sawBusy=true;
      if(sawBusy && s.n===0 && tIdle===null){ tIdle=Date.now()-t0; break; }
    }
  }
  await p.waitForTimeout(100);
}
console.log(`\n스켈레톤 걷힘        ${tSkeleton}ms`);
console.log(`$try 전부 끝남       ${tIdle}ms`);
console.log(`── 예전에 잠겨 있던 구간: ${tIdle!==null&&tSkeleton!==null?tIdle-tSkeleton:'n/a'}ms (동시 최대 ${maxCount}건) ──`);
await b.close();
