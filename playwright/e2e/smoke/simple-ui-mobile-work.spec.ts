import { expect, test } from '@playwright/test';

const email = process.env.E2E_USER;
const password = process.env.E2E_PASS;

test.describe('simple UI mobile work surface', () => {
    test.skip(!email || !password, 'E2E_USER and E2E_PASS are required');
    test.use({ viewport: { width: 390, height: 844 } });

    test('shows instance inbox and opens notifications from the right-most tab', async ({ page }) => {
        await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });
        await page.locator('.cp-id input').fill(email!);
        await page.locator('.cp-pwd input').fill(password!);
        await page.locator('.cp-login').click();
        await expect(page).not.toHaveURL(/\/auth\/login/, { timeout: 60_000 });

        await page.evaluate(() => localStorage.setItem('pg.simpleUi', '1'));
        await page.goto('/todolist', { waitUntil: 'domcontentloaded' });

        await expect(page.getByTestId('simple-instance-list')).toBeVisible({ timeout: 30_000 });
        const tabs = page.locator('.pg-tabbar > *');
        await expect(tabs).toHaveCount(4);
        await expect(tabs.last()).toHaveAttribute('data-testid', 'mobile-notifications-tab');

        await page
            .getByTestId('mobile-notifications-tab')
            .getByRole('button', { name: /알림|notification/i })
            .click();
        await expect(page.locator('.notification-dd-box')).toBeVisible();
    });
});
