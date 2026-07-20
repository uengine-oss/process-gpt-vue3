import { test, expect } from '@playwright/test';
import { mkdirSync } from 'fs';
import { join } from 'path';

const SCREENSHOT_DIR = 'e2e/bpmn-auto-layout/e2e-results/bpmn-auto-layout/screenshots';
const E2E_ROUTE = '/bpmn-auto-layout-e2e';

const CASES = [
    { slug: 'uengine6-01-purchase-request', index: 0, label: 'uEngine6 Purchase Request' },
    { slug: 'uengine6-02-srms', index: 1, label: 'uEngine6 SRMS' },
    { slug: 'uengine6-03-trouble-subprocess', index: 2, label: 'uEngine6 Trouble SubProcess' },
    { slug: 'uengine6-04-credit-rating', index: 3, label: 'uEngine6 Credit Rating' },
    { slug: 'uengine6-05-credit-rating-2', index: 4, label: 'uEngine6 Credit Rating 2' },
    { slug: 'uengine6-06-trouble-branch', index: 5, label: 'uEngine6 Trouble Branch' },
    { slug: 'uengine6-07-error-fix-process', index: 6, label: 'uEngine6 Error Fix Process' },
    { slug: 'uengine6-08-incident-reception', index: 7, label: 'uEngine6 Incident Reception' },
    { slug: 'uengine6-09-trouble-report-basic', index: 8, label: 'uEngine6 Trouble Report Basic' },
    { slug: 'uengine6-10-trouble-report-mapping', index: 9, label: 'uEngine6 Trouble Report Mapping' },
    { slug: 'uengine6-11-attached-contract-review', index: 10, label: 'uEngine6 Attached Contract Review' },
    { slug: 'uengine6-12-vendor-onboarding-improvement', index: 11, label: 'uEngine6 협력사 온보딩 개선 프로세스' },
    { slug: 'uengine6-13-vendor-security-review', index: 12, label: 'uEngine6 협력사 보안 심사 프로세스' }
];

function shotPath(name) {
    return join(SCREENSHOT_DIR, `process-gpt-bpmn-auto-layout-${name}.png`);
}

async function screenshotCanvas(page, name) {
    await page.mouse.move(1260, 450);
    await page.waitForTimeout(200);
    await page.locator('style[data-bpmn-screenshot-style="true"]').evaluateAll((elements) => {
        elements.forEach((element) => element.remove());
    });
    const styleHandle = await page.addStyleTag({
        content: `
      .font-size-controls,
      .palette-toggle-button,
      .bjs-powered-by,
      .v-tooltip,
      .v-overlay.v-tooltip {
        display: none !important;
      }
    `
    });
    await styleHandle.evaluate((style) => {
        style.setAttribute('data-bpmn-screenshot-style', 'true');
    });
    await page.evaluate(() => {
        const container = document.querySelector('#canvas-container');
        const viewport = document.querySelector('g.viewport');
        if (!container || !viewport || typeof viewport.getBBox !== 'function') return;

        const bbox = viewport.getBBox();
        if (!bbox || !isFinite(bbox.width) || !isFinite(bbox.height) || bbox.width <= 0 || bbox.height <= 0) return;

        const rect = container.getBoundingClientRect();
        const padding = 40;
        const availableWidth = Math.max(1, rect.width - padding * 2);
        const availableHeight = Math.max(1, rect.height - padding * 2);
        const scale = Math.min(availableWidth / bbox.width, availableHeight / bbox.height, 1.2);
        const tx = rect.width / 2 - (bbox.x + bbox.width / 2) * scale;
        const ty = rect.height / 2 - (bbox.y + bbox.height / 2) * scale;

        viewport.setAttribute('transform', `matrix(${scale} 0 0 ${scale} ${tx} ${ty})`);
    });
    await page.locator('#canvas-container').screenshot({ path: shotPath(name) });
    await page.locator('style[data-bpmn-screenshot-style="true"]').evaluateAll((elements) => {
        elements.forEach((element) => element.remove());
    });
}

async function openCaseDialog(page) {
    await page.locator('.v-app-bar [class*="mdi-folder-open"]').first().click();
    await page.locator('.v-overlay-container .v-list-item').first().waitFor({ state: 'visible', timeout: 10000 });
}

async function loadCaseByIndex(page, index) {
    await openCaseDialog(page);
    await page.locator('.v-overlay-container .v-list-item').nth(index).click();
    await page.locator('.v-overlay-container .v-card').waitFor({ state: 'hidden', timeout: 10000 });
    await page.waitForSelector('.djs-element, .djs-shape', { timeout: 15000 });
}

async function applyAutoLayout(page) {
    await page.locator('.font-size-controls [class*="mdi-auto-fix"]').first().click();
    await page.waitForTimeout(20000);
}

async function rotateLayout(page) {
    await page.locator('.font-size-controls [class*="mdi-crop-rotate"]').first().click();
    await page.waitForTimeout(20000);
}

async function openE2EPage(page) {
    await page.goto(E2E_ROUTE);
    await page.waitForSelector('.djs-container, [class*="djs-"]', { timeout: 15000 });
    await page.waitForSelector('.djs-element, .djs-shape', { timeout: 15000 });
}

test.describe('process-gpt bpmn-auto-layout visual scenarios', () => {
    test.describe.configure({ timeout: 120000 });

    test.beforeAll(() => {
        mkdirSync(SCREENSHOT_DIR, { recursive: true });
    });

    test('01 default canvas and SRMS process auto layout + rotation', async ({ page }) => {
        await openE2EPage(page);
        await screenshotCanvas(page, '01-initial-canvas');

        await loadCaseByIndex(page, 1);
        await applyAutoLayout(page);
        await screenshotCanvas(page, '01-after-auto-layout');

        await rotateLayout(page);
        await screenshotCanvas(page, '01-after-rotation');

        await expect(page.locator('.v-alert[type="error"]')).not.toBeVisible();
    });

    for (const caseItem of CASES) {
        test(`02 process type screenshot: ${caseItem.label}`, async ({ page }) => {
            await openE2EPage(page);
            await loadCaseByIndex(page, caseItem.index);
            await screenshotCanvas(page, `02-${caseItem.slug}-loaded`);

            await applyAutoLayout(page);
            await screenshotCanvas(page, `02-${caseItem.slug}-after-auto-layout`);

            await rotateLayout(page);
            await screenshotCanvas(page, `02-${caseItem.slug}-after-rotation`);

            await expect(page.locator('.v-alert[type="error"]')).not.toBeVisible();
        });
    }
});
