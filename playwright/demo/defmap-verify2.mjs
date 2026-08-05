import { chromium } from '@playwright/test';
const BASE='http://127.0.0.1:5199';
const b=await chromium.launch();
const c=await b.newContext({viewport:{width:1440,height:900},locale:'ko-KR'});
const p=await c.newPage();
let procdef=0;
p.on('request',r=>{ if(/proc_def/.test(r.url())) procdef++; });
await p.goto(`${BASE}/auth/login`,{waitUntil:'load',timeout:90000});
await p.waitForTimeout(2500);
await p.locator('.cp-id input').first().fill(process.env.BENCH_EMAIL);
await p.locator('.cp-pwd input').first().fill(process.env.BENCH_PW);
await p.locator('.cp-login').first().click();
await p.waitForURL(u=>!u.pathname.includes('/auth/login'),{timeout:60000});
await p.waitForTimeout(12000);
console.log('첫 화면 proc_def 요청:', procdef, ' url=', p.url());

// 상단 툴바 아이콘 목록
const btns = p.locator('header button, .v-toolbar button');
const n = await btns.count();
console.log('상단 버튼', n, '개');
procdef=0;
// 프로세스 지도로 가는 버튼 찾기: 클릭 후 url 확인
for (let i=0;i<n;i++){
  await btns.nth(i).click({timeout:5000}).catch(()=>{});
  await p.waitForTimeout(2500);
  if (p.url().includes('definition-map')) { console.log('  → 버튼',i,'이 definition-map 으로 이동'); break; }
  await p.keyboard.press('Escape').catch(()=>{});
}
await p.waitForTimeout(12000);
console.log('definition-map url=', p.url(), ' proc_def 요청:', procdef);
console.log('맵 요소:', await p.locator('.definition-map-wrapper, .definition-map-card, .process-map').count());
await p.screenshot({path:process.env.OUT+'/defmap-verify2.png'});
await b.close();
