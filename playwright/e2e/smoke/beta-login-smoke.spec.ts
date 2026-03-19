import { expect, test } from '@playwright/test';

function requiredEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`${name} is required for smoke test`);
    }
    return value;
}

test.describe('smoke: landing to login', () => {
    test('uengine login -> definition-map', async ({ page }) => {
        const email = requiredEnv('E2E_USER');
        const password = requiredEnv('E2E_PASS');

        await page.context().clearCookies();
        await page.addInitScript(() => {
            window.localStorage.clear();
            window.sessionStorage.clear();
        });

        await page.goto('/', { waitUntil: 'domcontentloaded' });

        // 운영/로컬 배포별로 CTA의 태그가 link/button으로 달라질 수 있어 텍스트 기준으로 클릭
        if (!/\/auth\/login/.test(page.url())) {
            const betaCta = page.locator('a,button,[role="button"]').filter({ hasText: /베타\s*테스트하기|beta\s*test|start/i }).first();
            await expect(betaCta).toBeVisible({ timeout: 30_000 });
            await betaCta.click();
        }

        if (!/\/auth\/login/.test(page.url())) {
            await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });
        }
        await expect(page).toHaveURL(/\/auth\/login/);

        await page.locator('.cp-id input').fill(email);
        await page.locator('.cp-pwd input').fill(password);

        // 로그인 폼은 체크박스 동의가 required라서 반드시 체크해야 제출됨
        const rememberCheckbox = page.getByRole('checkbox').first();
        if (!(await rememberCheckbox.isChecked())) {
            await rememberCheckbox.check();
        }

        await page.locator('.cp-login').click();

        // uengine 도메인에서는 로그인 후 definition-map으로 진입 확인
        await page.waitForLoadState('domcontentloaded');
        if (!/\/definition-map/.test(page.url())) {
            await page.goto('/definition-map', { waitUntil: 'domcontentloaded' });
        }
        await expect(page).toHaveURL(/\/definition-map/, { timeout: 60_000 });
    });
});
