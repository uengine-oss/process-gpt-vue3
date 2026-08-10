import { chromium } from '@playwright/test';
const b = await chromium.launch();
const p = await (await b.newContext({viewport:{width:1440,height:900},locale:'ko-KR'})).newPage();
const t0 = Date.now();
await p.goto('http://localhost:5199/auth/login',{waitUntil:'load',timeout:90000});
await p.waitForTimeout(3000);
await p.locator('.cp-id input').fill(process.env.BENCH_EMAIL);
await p.locator('.cp-pwd input').fill(process.env.BENCH_PW);
await p.locator('.cp-login').click();
await p.waitForURL(u=>!u.pathname.includes('/auth/login'),{timeout:60000});
let unlocked=null, content=null;
for (let i=0;i<60;i++){
  await p.waitForTimeout(400);
  const s = await p.evaluate(()=>({ loading: (window.$app_||{}).loading,
      overlay: !!document.querySelector('.v-overlay--active'),
      content: !!document.querySelector('.v-navigation-drawer, aside') })).catch(()=>null);
  if(!s) continue;
  if(content===null && s.content) content = Date.now()-t0;
  if(s.loading===false && !s.overlay){ unlocked = Date.now()-t0; break; }
}
const info = await p.evaluate(() => ({
   url: location.href,
   tenant: window.$tenantName,
   supa: (window.$supabase && window.$supabase.supabaseUrl) || '?'
})).catch((e)=>({err:String(e).slice(0,80)}));
console.log('연결 테넌트 :', info.tenant);
console.log('도착 URL    :', info.url);
console.log('콘텐츠 등장 :', content+'ms');
console.log('화면 활성화 :', unlocked+'ms');
await p.screenshot({path:(process.env.OUT||'/tmp')+'/up.png'});
await b.close();
