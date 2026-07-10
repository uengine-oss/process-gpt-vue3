// Playwright 스크린샷 캡처 — instance-classifier 데모(독립 엔트리).
// 실행: node e2e-instance-classifier.mjs
import { chromium } from 'playwright';
import fs from 'fs';

const OUT = '/Users/uengine/process-gpt/services/instance-classifier/docs/manual/screenshots';
const BASE = 'http://localhost:5173';
fs.mkdirSync(OUT, { recursive: true });

const done = [];
async function snap(page, name, opts = {}) {
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: opts.full !== false });
    done.push(name);
    console.log('  captured', name);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });

try {
    console.log('1) 데모 페이지 로드');
    await page.goto(`${BASE}/demo.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('table tbody tr', { timeout: 25000 });
    await page.waitForTimeout(2000);
    await snap(page, '01_overview_full');

    console.log('2) Top List — 상단 뷰(뷰포트)');
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    await snap(page, '02_toplist', { full: false });

    console.log('3) 유형 상세 드릴다운 다이얼로그');
    await page.locator('table tbody tr button:has-text("보기")').first().click();
    await page.waitForSelector('.v-overlay .v-list-item, .v-dialog .v-list-item', { timeout: 10000 });
    await page.waitForTimeout(800);
    await snap(page, '03_topic_detail_dialog', { full: false });
    await page.locator('button:has-text("닫기")').first().click();
    await page.waitForTimeout(500);

    console.log('4) 유사 사례 패널 — 항목 펼쳐 처리결과 표시');
    const header = page.locator('.v-expansion-panel-title').first();
    await header.scrollIntoViewIfNeeded();
    await header.click();
    await page.waitForTimeout(1200);
    await header.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await snap(page, '04_similar_expanded', { full: false });

    console.log('5) 유사 사례 패널 전체(스크롤)');
    await snap(page, '05_similar_full');

    console.log('DONE:', done.join(', '));
} catch (e) {
    console.error('CAPTURE FAILED:', e.message);
    await page.screenshot({ path: `${OUT}/_error.png`, fullPage: true }).catch(() => {});
    process.exitCode = 1;
} finally {
    await browser.close();
}
