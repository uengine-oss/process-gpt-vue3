import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';

test.describe('ProcessGPT mapper designer UI screenshot', () => {
    test('captures real Mapper.vue with ConcatTransformer mapping restored', async ({ page }) => {
        const baseUrl = process.env.CALL_ACTIVITY_UI_BASE_URL || 'http://localhost:8088';
        const screenshotDir = 'playwright/e2e/gateway/e2e-results';
        const screenshotPath = `${screenshotDir}/processgpt-mapper-designer-ui.png`;

        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto(`${baseUrl}/processgpt-mapper-ui-e2e`, { waitUntil: 'networkidle' });

        await expect(page.locator('.form-mapper')).toBeVisible({ timeout: 30_000 });
        await expect(page.getByText('ConcatTransformer Mapper Input')).toBeVisible({ timeout: 30_000 });
        await page.locator('.tree.left-treeview .node-wrapper', { hasText: 'Variables' }).first().locator('.icon-wrapper').click();
        await page.locator('.tree.right-treeview .node-wrapper', { hasText: 'Variables' }).first().locator('.icon-wrapper').click();
        await page.locator('.tree.right-treeview .node-wrapper', { hasText: 'lane' }).first().locator('.icon-wrapper').click();
        await page
            .locator(
                "xpath=//div[contains(@class,'tree') and contains(@class,'right-treeview')]//*[normalize-space(.)='approver']/ancestor::*[contains(@class,'node-wrapper')][1]//*[contains(@class,'icon-wrapper')]"
            )
            .first()
            .click();
        await expect(page.locator('svg#formArea text', { hasText: 'ConcatTransformer' })).toBeVisible({ timeout: 30_000 });
        await expect(page.locator('.tree.left-treeview', { hasText: 'approverEmail' })).toBeVisible({ timeout: 30_000 });
        await expect(page.locator('.tree.right-treeview', { hasText: 'lane' })).toBeVisible({ timeout: 30_000 });
        await expect(page.locator('.tree.right-treeview', { hasText: 'requester' })).toBeVisible({ timeout: 30_000 });
        await expect(page.locator('.tree.right-treeview', { hasText: 'approver' })).toBeVisible({ timeout: 30_000 });
        await expect(page.locator('.tree.right-treeview', { hasText: 'finance' })).toBeVisible({ timeout: 30_000 });
        await expect(page.locator('.tree.right-treeview', { hasText: 'endpoint' })).toBeVisible({ timeout: 30_000 });
        await expect(page.locator('svg#formArea .connector').first()).toBeVisible({ timeout: 30_000 });

        mkdirSync(screenshotDir, { recursive: true });
        await page.screenshot({ path: screenshotPath, fullPage: true });
    });
});
