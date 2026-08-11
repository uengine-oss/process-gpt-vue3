/**
 * 채팅으로 프로세스 생성을 요청해 에이전트 백엔드가 실제로 응답하는지 확인한다.
 * 사용: node playwright/demo/agent-chat-check.mjs [출력디렉터리]
 */
import { chromium } from '@playwright/test';

const OUT = process.argv[2] || '/tmp';
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' });
const p = await c.newPage();

const failedApi = [];
p.on('response', (r) => {
    const u = r.url();
    if (r.status() >= 400 && /\/(process-gpt-deepagents|agent-router|agent|completion|claude-skills)\//.test(u)) {
        failedApi.push(`${r.status()} ${u.replace('http://127.0.0.1:5199', '')}`);
    }
});

await p.goto('http://127.0.0.1:5199/auth/login', { waitUntil: 'load', timeout: 90000 });
await p.waitForSelector('.login__card', { timeout: 30000 });
const i = p.locator('.pg-input__el');
await i.nth(0).fill('demo@localhost');
await i.nth(1).fill('demo1234');
await p.locator('.cp-login').click();
await p.waitForURL((u) => !u.pathname.includes('/auth/login'), { timeout: 45000 });
await p.waitForTimeout(6000);

// 메인 채팅 입력창에 요청
const box = p.locator('textarea, [contenteditable="true"]').first();
await box.click();
await box.type('휴가 신청 프로세스를 만들어줘', { delay: 30 });
await p.waitForTimeout(600);
await p.keyboard.press('Enter');

// 응답(또는 오류)이 나타날 때까지 관찰
let sawError = false;
for (let s = 0; s < 24; s++) {
    await p.waitForTimeout(2500);
    const text = await p.evaluate(() => document.body.innerText);
    if (/오류가 발생했습니다|Agent API error/.test(text)) {
        sawError = true;
        break;
    }
}

await p.screenshot({ path: `${OUT}/agent-chat.png`, fullPage: false });
const body = await p.evaluate(() => document.body.innerText);
const line = body.split('\n').find((l) => /오류|error/i.test(l));

console.log('오류 표시:', sawError ? `예 — ${line}` : '아니오');
console.log('실패한 백엔드 호출:', failedApi.length);
[...new Set(failedApi)].slice(0, 6).forEach((f) => console.log('  -', f));
await b.close();
