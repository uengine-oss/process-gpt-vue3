import { expect, test } from '@playwright/test';

/**
 * 배포된 환경에서 "내 피드백"(피드백 처리 상태) 화면이 실제로 열리는지 확인한다.
 *
 * 이 스모크가 필요한 이유 — 아래 두 가지는 로컬(vite dev)에서는 절대 드러나지 않는다.
 * dev 서버는 /feedback-proposals 를 agent-feedback(6789)으로 직접 프록시해 주지만,
 * 배포 환경은 게이트웨이 라우트와 Kubernetes Service 가 있어야 같은 경로가 닿는다.
 *
 *  1) 게이트웨이에 /feedback-proposals 라우트가 없으면 SPA 폴백으로 index.html 이
 *     돌아간다(200 text/html). 화면은 뜨지만 목록이 영원히 비고 승인·반려도 안 된다.
 *  2) agent-feedback Service 가 없으면 게이트웨이가 업스트림을 못 찾아 5xx 가 난다.
 *
 * 둘 다 실제로 운영에서 발생했다(2026-09-23). 그래서 "응답이 JSON 인지"를 직접
 * 단언한다 — 화면 렌더링만 보면 SPA 폴백을 통과시켜 버린다.
 */

function requiredEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`${name} is required for smoke test`);
    }
    return value;
}

async function login(page: import('@playwright/test').Page) {
    const email = requiredEnv('E2E_USER');
    const password = requiredEnv('E2E_PASS');

    await page.context().clearCookies();
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    if (!/\/auth\/login/.test(page.url())) {
        const betaCta = page
            .locator('a,button,[role="button"]')
            .filter({ hasText: /베타\s*테스트하기|beta\s*test|start/i })
            .first();
        if (await betaCta.isVisible({ timeout: 10_000 }).catch(() => false)) {
            await betaCta.click();
        }
    }

    if (!/\/auth\/login/.test(page.url())) {
        await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });
    }
    await expect(page).toHaveURL(/\/auth\/login/);

    await page.locator('.cp-id input').fill(email);
    await page.locator('.cp-pwd input').fill(password);
    await page.locator('.cp-login').click();
    await expect(page).toHaveURL(/\/process-architecture/, { timeout: 60_000 });
}

test.describe('smoke: 피드백 처리 상태 화면', () => {
    test('로그인 후 /my-feedback 이 열리고 피드백 API 가 JSON 을 돌려준다', async ({ page }) => {
        await login(page);

        // 화면이 부르는 피드백 API 응답을 전부 모은다. 라우트가 빠지면 SPA 폴백(text/html)이
        // 돌아오므로 content-type 으로 구분한다.
        const feedbackResponses: { url: string; status: number; contentType: string }[] = [];
        page.on('response', (res) => {
            const url = res.url();
            if (!url.includes('/feedback-proposals')) return;
            feedbackResponses.push({
                url,
                status: res.status(),
                contentType: (res.headers()['content-type'] || '').toLowerCase()
            });
        });

        await page.goto('/my-feedback', { waitUntil: 'domcontentloaded' });

        // 화면 문구(i18n)나 데이터 유무에는 기대지 않는다. 이 스모크가 실패하면
        // 프론트엔드·게이트웨이가 직전 이미지로 롤백되므로, "정말로 라우팅이 깨졌을 때"만
        // 실패해야 한다. 로케일이 다르거나 피드백이 0건이어도 통과해야 한다.
        // 로그인 세션이 유지돼 화면까지 도달했는지만 URL 로 확인한다.
        await expect(page).toHaveURL(/\/my-feedback/, { timeout: 60_000 });

        // API 가 호출될 때까지 기다린다
        await expect
            .poll(() => feedbackResponses.length, {
                message: '"내 피드백" 화면이 /feedback-proposals 를 호출하지 않았다',
                timeout: 60_000
            })
            .toBeGreaterThan(0);

        const htmlFallbacks = feedbackResponses.filter((r) => r.contentType.includes('text/html'));
        expect(
            htmlFallbacks,
            `피드백 API 가 JSON 대신 HTML 을 돌려줬다 — 게이트웨이에 /feedback-proposals 라우트가 ` +
                `빠졌을 때 나타나는 증상이다(SPA 폴백). 응답: ${JSON.stringify(htmlFallbacks)}`
        ).toEqual([]);

        const serverErrors = feedbackResponses.filter((r) => r.status >= 500);
        expect(
            serverErrors,
            `피드백 API 가 5xx 를 돌려줬다 — agent-feedback Service 나 파드가 뜨지 않았을 때 ` +
                `나타나는 증상이다. 응답: ${JSON.stringify(serverErrors)}`
        ).toEqual([]);

        // 최소 한 건은 정상 JSON 이어야 한다
        const okJson = feedbackResponses.filter((r) => r.status === 200 && r.contentType.includes('application/json'));
        expect(okJson.length, `정상 JSON 응답이 없다. 응답: ${JSON.stringify(feedbackResponses)}`).toBeGreaterThan(0);
    });
});
