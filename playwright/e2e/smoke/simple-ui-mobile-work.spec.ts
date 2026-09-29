import { expect, test } from '@playwright/test';

const email = process.env.E2E_USER;
const password = process.env.E2E_PASS;

test.describe('simple UI mobile work surface', () => {
    test.skip(!email || !password, 'E2E_USER and E2E_PASS are required');
    test.use({ viewport: { width: 390, height: 844 } });

    test.beforeEach(async ({ page }) => {
        await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });
        await page.locator('.cp-id input').fill(email!);
        await page.locator('.cp-pwd input').fill(password!);
        await page.locator('.cp-login').click();
        await expect(page).not.toHaveURL(/\/auth\/login/, { timeout: 60_000 });
        await page.evaluate(() => localStorage.setItem('pg.simpleUi', '1'));
    });

    test('uses a top app bar instead of bottom tabs and keeps notifications reachable', async ({ page }) => {
        await page.goto('/todolist', { waitUntil: 'domcontentloaded' });

        await expect(page.getByTestId('simple-instance-list')).toBeVisible({ timeout: 30_000 });
        await expect(page.getByTestId('mobile-appbar')).toBeVisible();
        await expect(page.locator('.pg-tabbar')).toHaveCount(0);

        await page.getByTestId('mobile-notifications').getByRole('button', { name: /알림|notification/i }).click();
        await expect(page.locator('.notification-dd-box')).toBeVisible();
    });

    test('opens the full-screen sidebar and closes it after choosing a destination', async ({ page }) => {
        await page.goto('/definition-map', { waitUntil: 'domcontentloaded' });

        await page.getByTestId('mobile-sidebar-open').click();
        const nav = page.getByTestId('mobile-sidebar-nav');
        await expect(nav).toBeVisible();

        // 이름으로 찾지 않는다 — 화면 언어에 따라 '나의 업무' / 'My Task List' 로 바뀐다(CI 는 영어).
        await nav.getByTestId('mobile-sidebar-todo').click();
        await expect(page).toHaveURL(/\/todolist/);
        await expect(nav).toBeHidden();
    });
});
