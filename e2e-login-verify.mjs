import { chromium } from 'playwright';
const OUT = '/Users/uengine/process-gpt/services/instance-classifier/docs/manual/screenshots';
const BASE = 'http://localhost:5173';
const EMAIL = process.env.E2E_EMAIL, PW = process.env.E2E_PW;

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 950 }, deviceScaleFactor: 1 });
const clog = [];
p.on('console', (m) => { const t = m.text(); if (t.includes('InstanceTopListPopup') || m.type() === 'error') clog.push(m.type() + ': ' + t.slice(0, 160)); });

try {
    await p.goto(`${BASE}/auth/login`, { waitUntil: 'domcontentloaded' });
    await p.waitForSelector('.cp-id input', { timeout: 20000 });
    await p.fill('.cp-id input', EMAIL);
    await p.fill('input[type="password"]', PW);
    const cb = p.locator('input[type="checkbox"]').first();
    if (await cb.count()) await cb.check({ force: true }).catch(() => {});
    await p.locator('.cp-login').first().click();
    console.log('login clicked, waiting...');
    await p.waitForTimeout(7000);
    console.log('after login url:', p.url());

    await p.goto(`${BASE}/definition-map/sub/minwon_civil_complaint_process`, { waitUntil: 'domcontentloaded' });
    // 다이어그램 렌더 대기
    await p.waitForTimeout(9000);
    console.log('def url:', p.url());

    // Top 3 애니메이션 막대 위젯
    const bars = p.locator('.itb-fill');
    await bars.first().waitFor({ timeout: 15000 }).catch(() => {});
    const barCount = await bars.count();
    console.log('TOP-BARS count=', barCount);
    // 애니메이션 진행 중 캡처
    await p.waitForTimeout(400);
    await p.screenshot({ path: `${OUT}/N1_bars_animating.png`, fullPage: false });
    await p.waitForTimeout(1200);
    await p.screenshot({ path: `${OUT}/N2_bars_final.png`, fullPage: false });

    // "자세히..." → 분석 화면 이동
    if (barCount) {
        await p.locator('.itb-more').click();
        await p.waitForTimeout(3000);
        console.log('after 자세히 url=', p.url());
        await p.waitForTimeout(2000);
        await p.screenshot({ path: `${OUT}/N3_analysis_list.png`, fullPage: false });
        // 트리맵 보기 전환
        const tmBtn = p.locator('button:has(.mdi-chart-tree)');
        if (await tmBtn.count()) {
            await tmBtn.first().click();
            await p.waitForTimeout(2000);
            const cells = await p.locator('.apexcharts-treemap-rect, rect.apexcharts-treemap-rect').count();
            console.log('ANALYSIS treemap cells=', cells);
            await p.screenshot({ path: `${OUT}/N4_analysis_treemap.png`, fullPage: false });
        }
    }
    if (cnt && !vis) {
        const cs = await popup.first().evaluate((el) => { const s = getComputedStyle(el); return `display=${s.display} vis=${s.visibility} z=${s.zIndex} bottom=${s.bottom} right=${s.right}`; });
        console.log('popup computed:', cs);
    }
    console.log('POPUP LOGS:', clog.filter(l => l.includes('InstanceTopListPopup')).join(' | ') || '(none)');
    console.log('ERRORS:', clog.filter(l => l.startsWith('error')).slice(0, 5).join(' | ') || '(none)');
} catch (e) {
    console.error('FAIL:', e.message);
    await p.screenshot({ path: `${OUT}/L_error.png`, fullPage: true }).catch(() => {});
    process.exitCode = 1;
} finally {
    await b.close();
}
