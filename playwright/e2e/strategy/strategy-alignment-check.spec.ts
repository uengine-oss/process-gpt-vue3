import { expect, test } from '@playwright/test';

const EMAIL = process.env.E2E_USER || 'demo@localhost';
const PASSWORD = process.env.E2E_PASS || 'Demo1234!';

test.use({ locale: 'ko-KR', viewport: { width: 1600, height: 1000 } });

async function login(page: any) {
    await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });
    await page.locator('input[type="text"]').first().fill(EMAIL);
    await page.locator('input[type="password"]').first().fill(PASSWORD);
    await page.getByRole('button', { name: /로그인/ }).click();
    await expect(page).not.toHaveURL(/\/auth\/login/, { timeout: 30_000 });
}

test('Strategy Board에서 관련 후보와 관련 항목 없음을 확인한다', async ({ page }) => {
    await login(page);
    await page.goto('/strategy-board', { waitUntil: 'domcontentloaded' });

    await page.getByTestId('open-alignment-check').click();
    await expect(page.getByTestId('alignment-dialog')).toBeVisible();

    const description = page.getByTestId('alignment-description').locator('textarea');
    await description.fill('교육 웨비나 고객 문의를 자동 분류하고 후속 상담 담당자에게 배정해 응답 리드타임을 줄이는 프로세스');
    await page.getByTestId('run-alignment-check').click();

    await expect(page.getByTestId('alignment-status')).toContainText('관련 후보 있음');
    await expect(page.locator('[data-testid^="alignment-candidate-"]').first()).toBeVisible();
    await expect(page.getByText('후속 상담 응답 리드타임', { exact: true })).toBeVisible();

    await description.fill('사내 주차장 조명 교체 일정 관리');
    await page.getByTestId('run-alignment-check').click();
    await expect(page.getByTestId('alignment-status')).toContainText('관련 항목 없음');
    await expect(page.getByTestId('alignment-empty')).toBeVisible();
});
