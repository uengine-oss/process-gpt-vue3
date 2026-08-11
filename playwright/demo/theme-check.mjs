import { chromium } from '@playwright/test';

const OUT = process.argv[2];
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' });
const p = await c.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));

await p.goto('http://127.0.0.1:5199/auth/login', { waitUntil: 'load', timeout: 90000 });
await p.waitForSelector('.login__card', { timeout: 30000 });
const i = p.locator('.pg-input__el');
await i.nth(0).fill('demo@localhost');
await i.nth(1).fill('demo1234');
await p.locator('.cp-login').click();
await p.waitForURL((u) => !u.pathname.includes('/auth/login'), { timeout: 45000 });
await p.waitForTimeout(5000);

// BPMN 편집기까지 진입해 둔다 (도형 색 확인용)
try {
    await p.getByText('휴가 신청 프로세스', { exact: false }).first().click({ timeout: 10000 });
    await p.waitForTimeout(7000);
} catch (e) {
    console.log('bpmn open:', e.message.split('\n')[0]);
}

async function snapshot(label) {
    await p.waitForTimeout(1800);
    await p.screenshot({ path: `${OUT}/${label}.png` });
    const probe = await p.evaluate(() => {
        const cs = getComputedStyle(document.documentElement);
        const task = document.querySelector('.djs-element .djs-visual rect');
        const ev = document.querySelector('.djs-element .djs-visual circle');
        return {
            appearance: document.documentElement.getAttribute('data-appearance'),
            accentBrand: cs.getPropertyValue('--accent-brand').trim(),
            appBg: getComputedStyle(document.body).backgroundColor,
            bpmnTaskFill: task ? task.getAttribute('fill') || getComputedStyle(task).fill : 'n/a',
            bpmnEventStroke: ev ? ev.getAttribute('stroke') || getComputedStyle(ev).stroke : 'n/a'
        };
    });
    console.log(label.padEnd(16), JSON.stringify(probe));
}

for (const [label, appearance] of [['01-light', 'light'], ['02-sky', 'sky'], ['03-dark', 'dark']]) {
    await p.evaluate(async (a) => {
        const m = await import('/src/ds/appearance.ts');
        m.applyAppearance(a);
    }, appearance);
    await snapshot(label);
}

console.log('pageerrors:', errs.length);
errs.slice(0, 3).forEach((e) => console.log(' -', e.slice(0, 140)));
await b.close();
