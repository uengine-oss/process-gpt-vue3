// 실제 샘플 콘텐츠(스킬/프로세스정의/조직도) 렌더링 검증 E2E
import { expect, test, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHOT_DIR = path.resolve(__dirname, 'results-real-sample');
fs.mkdirSync(SHOT_DIR, { recursive: true });

const EMAIL = process.env.E2E_USER || 'strategy-e2e@uengine.org';
const PASSWORD = process.env.E2E_PASS || 'e2epassword';

test.use({ locale: 'ko-KR', viewport: { width: 1600, height: 1000 } });

const shot = (page: Page, name: string) =>
    page.screenshot({ path: path.join(SHOT_DIR, `${name}.png`), fullPage: true });

async function login(page: Page) {
    await page.context().clearCookies();
    await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.cp-id input')).toBeVisible({ timeout: 30_000 });
    await page.locator('.cp-id input').fill(EMAIL);
    await page.locator('.cp-pwd input').fill(PASSWORD);
    await page.locator('.cp-login').click();
    await expect(page).not.toHaveURL(/\/auth\/login/, { timeout: 60_000 });
}

async function verifyDefinition(page: Page, id: string, label: string) {
    await page.goto('/definitions/' + id, { waitUntil: 'domcontentloaded' });
    // bpmn-js 캔버스 요소가 그려질 때까지 대기
    await expect
        .poll(async () => page.locator('.djs-element').count(), { timeout: 45_000 })
        .toBeGreaterThan(3);
    await page.waitForTimeout(2500);
    await shot(page, label);
    return page.locator('.djs-element').count();
}

test('프로세스 정의 BPMN 에디터 렌더링', async ({ page }) => {
    test.setTimeout(180_000);
    await login(page);
    const c = await verifyDefinition(page, 'contract_management_process', '03-def-contract');
    expect(c).toBeGreaterThan(3);
    const s = await verifyDefinition(page, 'system_development_process', '04-def-system');
    expect(s).toBeGreaterThan(3);
});

test('조직도 렌더링', async ({ page }) => {
    test.setTimeout(120_000);
    await login(page);
    await page.goto('/organization', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);
    await expect(page.getByText('유엔진 본사', { exact: false }).first()).toBeVisible({ timeout: 30_000 });
    await shot(page, '05-organization');
});

test('스킬 목록 + 상세 렌더링', async ({ page }) => {
    test.setTimeout(180_000);
    await login(page);

    await page.goto('/skills', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);
    for (const name of ['기본 개발 스킬', 'PPTX 생성 스킬', '고급 개발 스킬']) {
        await expect(page.getByText(name, { exact: false }).first()).toBeVisible({ timeout: 30_000 });
    }
    await shot(page, '01-skills-list');

    // 상세 진입
    await page.goto('/skills/' + encodeURIComponent('기본 개발 스킬'), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);
    // 오류 문구가 없어야 함
    const errCount = await page.getByText('스킬을 불러올 수 없습니다').count();
    expect(errCount, '스킬 로드 오류 문구가 없어야 함').toBe(0);
    // 본문에 REFERENCES 근거 문구가 렌더링 되어야 함
    await expect(page.getByText('PPTX 생성 스킬을 호출', { exact: false }).first()).toBeVisible({ timeout: 30_000 });
    await shot(page, '02-skill-detail-basic');
});
