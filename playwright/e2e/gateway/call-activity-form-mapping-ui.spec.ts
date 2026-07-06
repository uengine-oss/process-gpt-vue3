import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';

test.describe('ProcessGPT CallActivity form mapping UI', () => {
    test('shows selected parentForm and childForm fields in both mapper directions', async ({ page }) => {
        const baseUrl = process.env.CALL_ACTIVITY_UI_BASE_URL || 'http://localhost:8088';
        const screenshotDir = 'playwright/e2e/gateway/e2e-results';

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto(`${baseUrl}/processgpt-callactivity-form-mapping-e2e`, { waitUntil: 'networkidle' });

        await expect(page.getByText('ProcessGPT CallActivity Form Mapping E2E')).toBeVisible({ timeout: 30_000 });
        await page.locator('.gpt-call-activity-panel .v-tab').nth(1).click();
        await page.waitForTimeout(600);

        await expect(page.getByTestId('callactivity-parent-form-select')).toBeVisible({ timeout: 30_000 });
        await expect(page.getByTestId('callactivity-child-form-select')).toBeVisible({ timeout: 30_000 });
        await page.getByTestId('callactivity-parent-form-select').click();
        await page.locator('.v-overlay-container .v-list-item').first().click();
        await page.getByTestId('callactivity-child-form-select').click();
        await page.locator('.v-overlay-container .v-list-item').first().click();
        await page.keyboard.press('Escape');
        await page.locator('.call-activity-e2e__json-title').click();
        await page.waitForTimeout(300);

        await expect(page.getByTestId('call-activity-properties')).toContainText('parentFormFields');
        await expect(page.getByTestId('call-activity-properties')).toContainText('childFormFields');
        await expect(page.getByTestId('call-activity-properties')).toContainText('vendorOnboardingForm');
        await expect(page.getByTestId('call-activity-properties')).toContainText('ReviewVendorSecurity_form');
        await expect(page.getByTestId('call-activity-properties')).toContainText('vendorOnboardingForm.vendorName');
        await expect(page.getByTestId('call-activity-properties')).toContainText('ReviewVendorSecurity_form.vendorName');

        mkdirSync(screenshotDir, { recursive: true });
        await page.screenshot({
            path: `${screenshotDir}/callactivity-form-mapping-tab.png`,
            fullPage: true
        });

        await page.locator('.mapping-actions button').nth(0).click();
        await expect(page.locator('.form-mapper')).toBeVisible({ timeout: 30_000 });
        await page.waitForTimeout(600);
        await expect(page.locator('.tree.left-treeview', { hasText: 'parentForm' })).toBeVisible({ timeout: 30_000 });
        await expect(page.locator('.tree.right-treeview', { hasText: 'childForm' })).toBeVisible({ timeout: 30_000 });
        await expect(page.locator('.tree.left-treeview', { hasText: 'childForm' })).toBeVisible({ timeout: 30_000 });
        await expect(page.locator('.tree.right-treeview', { hasText: 'parentForm' })).toBeVisible({ timeout: 30_000 });
        await expect(page.locator('.tree.left-treeview', { hasText: '협력사 정보 입력' })).toBeVisible({ timeout: 30_000 });
        await expect(page.locator('.tree.right-treeview', { hasText: '보안 심사 입력' })).toBeVisible({ timeout: 30_000 });
        await page.screenshot({
            path: `${screenshotDir}/callactivity-parent-to-child-mapper.png`,
            fullPage: true
        });

        await page.goto(`${baseUrl}/processgpt-callactivity-form-mapping-e2e`, { waitUntil: 'networkidle' });
        await expect(page.getByText('ProcessGPT CallActivity Form Mapping E2E')).toBeVisible({ timeout: 30_000 });
        await page.locator('.gpt-call-activity-panel .v-tab').nth(1).click();
        await page.waitForTimeout(600);
        await page.getByTestId('callactivity-parent-form-select').click();
        await page.locator('.v-overlay-container .v-list-item').first().click();
        await page.getByTestId('callactivity-child-form-select').click();
        await page.locator('.v-overlay-container .v-list-item').first().click();
        await page.keyboard.press('Escape');

        await page.locator('.mapping-actions button').nth(1).click();
        await expect(page.locator('.form-mapper')).toBeVisible({ timeout: 30_000 });
        await page.waitForTimeout(600);
        await expect(page.locator('.tree.left-treeview', { hasText: 'childForm' })).toBeVisible({ timeout: 30_000 });
        await expect(page.locator('.tree.right-treeview', { hasText: 'parentForm' })).toBeVisible({ timeout: 30_000 });
        await expect(page.locator('.tree.left-treeview', { hasText: 'parentForm' })).toBeVisible({ timeout: 30_000 });
        await expect(page.locator('.tree.right-treeview', { hasText: 'childForm' })).toBeVisible({ timeout: 30_000 });
        await expect(page.locator('.tree.left-treeview', { hasText: '보안 심사 입력' })).toBeVisible({ timeout: 30_000 });
        await expect(page.locator('.tree.right-treeview', { hasText: '협력사 정보 입력' })).toBeVisible({ timeout: 30_000 });
        await page.screenshot({
            path: `${screenshotDir}/callactivity-child-to-parent-mapper.png`,
            fullPage: true
        });
    });
});
