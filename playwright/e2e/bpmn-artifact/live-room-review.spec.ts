import { expect, test, type Page } from '@playwright/test';

/** LIVE — 기존 방을 열어 ① BPMN autolayout 미리보기 ② 저장(스킬 zip 업로드) 콘솔 에러 확인. */
const LIVE = process.env.E2E_LIVE === '1';
const USER = process.env.E2E_USER;
const PASS = process.env.E2E_PASS;
const ROOM = process.env.E2E_ROOM || '3db83959-edea-4164-a8a2-736dd1b67ed3';
const SHOT = 'playwright/live-shots';

async function login(page: Page) {
    await page.context().clearCookies();
    await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });
    await page.locator('.cp-id input').fill(USER!);
    await page.locator('.cp-pwd input').fill(PASS!);
    const remember = page.getByRole('checkbox').first();
    if ((await remember.count()) > 0 && !(await remember.isChecked())) await remember.check();
    await page.locator('.cp-login').click();
    await expect(page).toHaveURL(/\/definition-map|\/chat|\/main/, { timeout: 60_000 });
}

test.describe('LIVE: 기존 방 검토(autolayout + 저장)', () => {
    test.skip(!LIVE || !USER || !PASS, 'E2E_LIVE=1 + creds 필요');
    test.setTimeout(180_000);

    test('autolayout 미리보기 + 저장(스킬 zip)', async ({ page }) => {
        const skill404: string[] = [];
        const httpErr: string[] = [];
        page.on('console', (m) => console.log('[browser]', m.type(), m.text().slice(0, 200)));
        page.on('response', (r) => {
            if (r.status() >= 400) {
                const u = r.url();
                if (/claude-skills\/skills\/.*\/files/.test(u)) skill404.push(`${r.status()} ${u.slice(0, 120)}`);
                else httpErr.push(`${r.status()} ${r.request().method()} ${u.slice(0, 110)}`);
            }
        });
        await page.setViewportSize({ width: 1920, height: 1080 });
        await login(page);
        await page.goto(`/chat?roomId=${ROOM}`, { waitUntil: 'domcontentloaded' });
        await expect(page.locator('.ws-files').first()).toBeVisible({ timeout: 60_000 });
        await page.waitForTimeout(2_000);
        await page.screenshot({ path: `${SHOT}/R1-room.png`, fullPage: true });

        // .bpmn 클릭 → autolayout 미리보기
        const bpmnItem = page.locator('.ws-files__item', { hasText: /\.bpmn/ }).first();
        if (await bpmnItem.count()) {
            await bpmnItem.click();
            await page.waitForTimeout(4_000); // import + autolayout
            await page.screenshot({ path: `${SHOT}/R2-bpmn-autolayout.png`, fullPage: true });
        } else {
            console.log('[warn] .bpmn item 없음');
        }

        // 저장 버튼 클릭 → 스킬 zip 업로드 포함
        const saveBtn = page.locator('.ws-files__header').getByRole('button', { name: /저장/ }).first();
        if (await saveBtn.count()) {
            await saveBtn.scrollIntoViewIfNeeded().catch(() => {});
            await saveBtn.click();
            await page.waitForTimeout(12_000); // proc_def/form/skill(zip)/agent 저장
            await page.screenshot({ path: `${SHOT}/R3-after-save.png`, fullPage: true });
        }

        console.log('[skill-files-4xx]', JSON.stringify(skill404));
        console.log('[other-4xx/5xx]', JSON.stringify(httpErr.slice(0, 12)));
        // putSkillFile 404 가 더는 없어야 함(zip 업로드로 전환)
        expect(skill404.filter((s) => s.startsWith('404')).length, `스킬 파일 404: ${skill404.join(' | ')}`).toBe(0);
    });
});
