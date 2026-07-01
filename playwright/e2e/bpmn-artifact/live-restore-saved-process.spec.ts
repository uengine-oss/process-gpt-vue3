import { expect, test, type Page } from '@playwright/test';

/**
 * LIVE e2e — 저장된 프로세스 산출물의 "재진입 복원" 검증.
 * OpenSpec: wa-process-artifact-restore / bpmn-artifact-display.
 *
 * 시나리오(GIVEN/WHEN/THEN):
 *  - GIVEN work-assistant 로 프로세스를 생성해 "생성 완료" 메시지가 영속된 채팅방
 *  - WHEN 사용자가 그 방을 (새로고침으로) 재진입
 *  - THEN 우측 ArtifactPanel 에 프로세스 산출물 패널(.process-artifact)이 복원(빈 화면 아님)
 *  - AND 미리보기를 열면 저장된 정의로부터 BPMN 다이어그램이 렌더
 *
 * 실행:
 *   E2E_LIVE=1 E2E_USER=.. E2E_PASS=.. E2E_ROOM=<roomId> \
 *   BASE_URL=http://localhost:8088 \
 *   npx playwright test playwright/e2e/bpmn-artifact/live-restore-saved-process.spec.ts
 *
 * E2E_ROOM 은 "생성 완료" 메시지가 이미 영속된 방의 roomId. 미지정 시 이 테스트는 skip.
 */

const LIVE = process.env.E2E_LIVE === '1';
const USER = process.env.E2E_USER;
const PASS = process.env.E2E_PASS;
const ROOM = process.env.E2E_ROOM;
const SHOT = 'playwright/live-shots';

async function login(page: Page) {
    await page.context().clearCookies();
    await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/auth\/login/, { timeout: 30_000 });
    await page.locator('.cp-id input').fill(USER!);
    await page.locator('.cp-pwd input').fill(PASS!);
    const remember = page.getByRole('checkbox').first();
    if ((await remember.count()) > 0 && !(await remember.isChecked())) await remember.check();
    await page.locator('.cp-login').click();
    await expect(page).toHaveURL(/\/definition-map|\/chat|\/main/, { timeout: 60_000 });
}

test.describe('LIVE: 저장된 프로세스 산출물 재진입 복원', () => {
    test.skip(!LIVE || !USER || !PASS || !ROOM, 'E2E_LIVE=1 + E2E_USER/E2E_PASS + E2E_ROOM 필요(실 서버 + 생성완료 방).');
    test.setTimeout(180_000);

    test('재진입 시 process 패널 복원 + 미리보기 렌더', async ({ page }) => {
        page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 200)));
        await page.setViewportSize({ width: 1920, height: 1080 });
        await login(page);

        // WHEN — 생성 완료 메시지가 영속된 방으로 재진입(직접 URL 진입 = 새로고침 경로).
        await page.goto(`/chat?roomId=${ROOM}`, { waitUntil: 'domcontentloaded' });

        // 채팅이 로드되고 "생성 완료" 메시지가 있어야 GIVEN 성립.
        const doneMsg = page.locator('.ai-message-bubble, .ai-message', { hasText: /생성\s*완료|BPMN 프로세스 생성/ }).first();
        await expect(doneMsg, '"BPMN 프로세스 생성 완료" 메시지가 있는 방이어야 함(GIVEN)').toBeVisible({ timeout: 60_000 });

        // THEN — 우측 산출물 패널에 process 아티팩트가 복원되어야 한다(빈 화면 아님).
        const procPanel = page.locator('.process-artifact').first();
        await expect(procPanel, '재진입 후 process 산출물 패널(.process-artifact)이 복원되어야 함').toBeVisible({ timeout: 30_000 });

        // 저장된 프로세스이므로 '저장됨' 배지 + 제목이 보여야 한다.
        await expect(procPanel.locator('.process-artifact__title'), '프로세스 제목 표시').toBeVisible();
        await page.screenshot({ path: `${SHOT}/restore-01-panel.png`, fullPage: true }).catch(() => null);

        // AND — 미리보기: 저장 정의로부터 다이어그램 렌더(process_id 조회 경로).
        const previewBtn = procPanel.getByRole('button', { name: /미리보기/ }).first();
        await expect(previewBtn, '미리보기 버튼이 있어야 함').toBeVisible({ timeout: 15_000 });
        await previewBtn.click();

        // bpmn 미리보기 표면(다이어그램 canvas/svg 또는 미리보기 다이얼로그)이 떠야 한다.
        const previewSurface = page
            .locator('.bpmn-preview-dialog, .vue-bpmn-diagram-container, .bjs-container, canvas, .ws-files__preview')
            .first();
        await expect(previewSurface, '미리보기 다이어그램이 렌더되어야 함(저장 정의 → XML 생성)').toBeVisible({ timeout: 30_000 });
        await page.screenshot({ path: `${SHOT}/restore-02-preview.png`, fullPage: true }).catch(() => null);
    });
});
