/**
 * 테마별 BPMN 캔버스 도형 색을 확인한다.
 * 사용: node playwright/demo/bpmn-color-check.mjs <출력디렉터리>
 */
import { chromium } from '@playwright/test';

const OUT = process.argv[2] || '/tmp';
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' });
const p = await c.newPage();

await p.goto('http://127.0.0.1:5199/auth/login', { waitUntil: 'load', timeout: 90000 });
await p.waitForSelector('.login__card', { timeout: 30000 });
const i = p.locator('.pg-input__el');
await i.nth(0).fill('demo@localhost');
await i.nth(1).fill('demo1234');
await p.locator('.cp-login').click();
await p.waitForURL((u) => !u.pathname.includes('/auth/login'), { timeout: 45000 });
await p.waitForTimeout(5000);

// BPMN 편집기 진입 — 사이드바에 같은 이름의 대화방이 많아 클릭이 엇나가므로
// 프로세스 정의 URL 로 바로 들어간다.
const PROC_DEF = process.env.PROC_DEF || '1c5bd5a5_3c66_4081_94be_e5dd12334309';
await p.goto(`http://127.0.0.1:5199/definitions/${PROC_DEF}`, { waitUntil: 'load', timeout: 60000 });
await p.waitForSelector('.djs-element', { timeout: 40000 });
await p.waitForTimeout(6000);

for (const appearance of ['light', 'sky', 'dark']) {
    await p.evaluate(async (a) => {
        const m = await import('/src/ds/appearance.ts');
        m.applyAppearance(a);
    }, appearance);
    await p.waitForTimeout(2500);

    const colors = await p.evaluate(() => {
        const shapes = [...document.querySelectorAll('.djs-element .djs-visual')];
        // 렌더러가 속성/스타일 어느 쪽으로 넣었는지 알 수 없어 computed 로 읽는다
        const pick = (sel) => {
            for (const s of shapes) {
                const el = s.querySelector(sel);
                if (!el) continue;
                const cs = getComputedStyle(el);
                if (cs.fill === 'none' && cs.stroke === 'none') continue;
                return { fill: cs.fill, stroke: cs.stroke };
            }
            return null;
        };
        return { rect: pick('rect'), circle: pick('circle'), n: shapes.length };
    });

    console.log(appearance.padEnd(6), JSON.stringify(colors));
    await p.screenshot({ path: `${OUT}/bpmn-${appearance}.png` });
}

await b.close();
