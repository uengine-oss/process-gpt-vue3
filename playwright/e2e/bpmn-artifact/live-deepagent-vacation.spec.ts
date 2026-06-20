import { expect, test, type Page } from '@playwright/test';

/**
 * LIVE 검증 — deepagents 모드 메인채팅에서 "휴가 신청 프로세스 생성" → 우측 ArtifactPanel 표시 → 복원.
 *
 * 실 서버(프론트 8088 + gateway + supabase + deepagent)가 모두 떠 있어야 한다.
 * 실행: E2E_LIVE=1 E2E_USER=.. E2E_PASS=.. npx playwright test .../live-deepagent-vacation.spec.ts
 */

const LIVE = process.env.E2E_LIVE === '1';
const USER = process.env.E2E_USER;
const PASS = process.env.E2E_PASS;
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

test.describe('LIVE bpmn-artifact: deepagents 휴가 신청 프로세스 → ArtifactPanel', () => {
    test.skip(!LIVE || !USER || !PASS, 'E2E_LIVE=1 + E2E_USER/E2E_PASS 필요(실 서버).');
    test.setTimeout(900_000);

    test('생성 → 우측 탭 표시 → 새로고침 복원', async ({ page }) => {
        page.on('console', (m) => console.log('[browser]', m.type(), m.text().slice(0, 300)));
        page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 300)));
        page.on('requestfailed', (r) => console.log('[reqfail]', r.method(), r.url().slice(0, 120), r.failure()?.errorText));
        page.on('response', (r) => {
            if (r.status() >= 400) console.log('[http]', r.status(), r.request().method(), r.url().slice(0, 140));
        });
        // 넓은 뷰포트 — 파일 패널이 넓게 열려도 채팅의 HITL 버튼이 잘리지 않도록.
        await page.setViewportSize({ width: 1920, height: 1080 });

        // 컴파일/렌더 오류 조기 감지용 — 로그인 전 첫 화면 캡처
        await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(3_000);
        await page.screenshot({ path: `${SHOT}/00-landing.png`, fullPage: true });

        await login(page);
        await page.screenshot({ path: `${SHOT}/01-after-login.png`, fullPage: true });

        // 메인 채팅 입력창
        const input = page.locator('.cp-chat textarea').first();
        await expect(input).toBeVisible({ timeout: 30_000 });

        // deepagents 모드 선택 (orchestration-select: [기본 에이전트, 딥 에이전트])
        const select = page.locator('.orchestration-select').first();
        await expect(select).toBeVisible({ timeout: 15_000 });
        await select.click();
        const deepOption = page.getByRole('option', { name: /딥|deep/i }).first();
        await expect(deepOption).toBeVisible({ timeout: 10_000 });
        await deepOption.click();
        await page.screenshot({ path: `${SHOT}/02-deepagents-selected.png`, fullPage: true });

        // 요청 전송 — 메인 컴포저는 @keypress.enter="beforeSend" 로 전송된다.
        await input.click();
        await input.fill('휴가 신청 프로세스 생성해줘');
        await input.press('Enter');
        await page.waitForTimeout(5_000);
        await page.screenshot({ path: `${SHOT}/03-sent.png`, fullPage: true });

        // Claude Desktop식 파일 UI(WorkspaceFilesViewer = .ws-files)가 뜰 때까지 폴링.
        const filesPanel = page.locator('.ws-files').first();
        const fileItems = page.locator('.ws-files__item');

        // deepagent 는 HITL(컨설팅 초안 승인 → 후보 선택 등)을 거친 뒤 산출물 파일을 낸다.
        // 폴링하며 사람 입력 단계가 보이면 자동으로 승인/첫 후보 선택/제출해 진행시킨다.
        // 첫 파일이 뜨면 성공으로 보되, 추가 파일을 더 모으기 위해 몇 라운드 더 진행한다.
        // 검증(4단계)·완료(5단계)까지 끝까지 진행시켜 최종 파일이 규격대로 되는지 본다.
        // → 일찍 끊지 말고 완료 안내가 뜰 때까지 매 HITL 라운드를 답한다.
        // 완료 안내는 어시스턴트 버블(.ai-message-bubble) 안에서만 감지(좌측 대화목록 프리뷰 오탐 방지).
        const doneText = page.locator('.ai-message-bubble', { hasText: /확인 후 저장|저장 버튼을 눌러/ }).first();
        let appeared = false;
        let maxFiles = 0;
        let done = false;
        for (let i = 0; i < 100; i++) {
            // ~11s * 100 ≈ 18min 상한
            try {
                if ((await filesPanel.count()) > 0 && (await filesPanel.isVisible())) {
                    const n = await fileItems.count();
                    maxFiles = Math.max(maxFiles, n);
                    if (n >= 1) appeared = true;
                }
                if ((await doneText.count()) > 0 && (await doneText.isVisible())) {
                    done = true;
                    break; // 생성 완료 안내 → 종료
                }
            } catch (e) {
                /* ignore */
            }

            // HITL 응답: 실제 제시된 후보(스킬/에이전트/DMN)를 체크박스로 "모두 선택" 후 제출.
            // 컨설팅 승인(approve_reject)은 승인 클릭 후 제출.
            // 현재 활성 HITL 패널은 가장 최근(마지막) 것. .first()는 이미 제출된 이전 패널이라 안 됨.
            const panel = page.locator('.human-feedback-panel').last();
            try {
                const pCount = await panel.count();
                const pVis = pCount > 0 ? await panel.isVisible() : false;
                if (pCount > 0 && pVis) {
                    const items = panel.locator('.human-feedback-panel__item');
                    const approve = panel.getByRole('button', { name: /^\s*승인\s*$/ }).first();
                    const submit = panel.getByRole('button', { name: /응답\s*제출/ }).first();
                    const itemCount = await items.count();
                    const submitCount = await submit.count();
                    console.log(`[hitl-dbg] i=${i} panels=${await page.locator('.human-feedback-panel').count()} vis=${pVis} items=${itemCount} approve=${await approve.count()} submit=${submitCount}`);
                    if (itemCount > 0) {
                        // 제시된 후보를 모두 체크(이미 선택된 건 건너뜀 — 토글 방지)
                        for (let k = 0; k < itemCount; k++) {
                            const it = items.nth(k);
                            const cls = ((await it.getAttribute('class')) || '').toString();
                            if (cls.includes('is-selected')) continue;
                            try {
                                await it.scrollIntoViewIfNeeded();
                                await it.click({ timeout: 4_000 });
                                await page.waitForTimeout(200);
                            } catch (e) {
                                /* ignore */
                            }
                        }
                    } else if ((await approve.count()) > 0 && (await approve.isVisible())) {
                        await approve.scrollIntoViewIfNeeded().catch(() => {});
                        await approve.click({ timeout: 4_000 }).catch(() => {});
                        await page.waitForTimeout(300);
                    }
                    if ((await submit.count()) > 0) {
                        await submit.scrollIntoViewIfNeeded().catch(() => {});
                        await submit.click({ timeout: 8_000 }); // 활성화될 때까지 대기
                        await page.screenshot({ path: `${SHOT}/hitl-${String(i).padStart(2, '0')}.png` });
                        await page.waitForTimeout(7_000);
                    }
                }
            } catch (e) {
                /* 선택/제출 경합 무시 */
            }
            try {
                await page.screenshot({ path: `${SHOT}/poll-${String(i).padStart(2, '0')}.png` });
            } catch (e) {
                /* 스크린샷 실패 무시 */
            }
            await page.waitForTimeout(11_000);
        }
        await page.screenshot({ path: `${SHOT}/04-files-or-timeout.png`, fullPage: true });
        console.log(`[result] appeared=${appeared} maxFiles=${maxFiles} done=${done}`);
        expect(appeared, "우측 ArtifactPanel 에 '산출물 파일' UI(.ws-files)가 표시되어야 함").toBeTruthy();
        expect(maxFiles, '작업 폴더에 최소 1개 파일이 표시되어야 함').toBeGreaterThanOrEqual(1);

        // 생성된 파일 목록 로깅(스킬/폼 실제 생성 여부 확인용)
        const fileNames = await page.locator('.ws-files__item-name').allInnerTexts();
        console.log('[ws-files]', JSON.stringify(fileNames.map((s) => s.trim())));

        // ── 전체 흐름: 저장 버튼 클릭 → DB 저장 + 확인 메시지 ──
        const saveBtn = page.locator('.ws-files__header').getByRole('button', { name: /저장/ }).first();
        await expect(saveBtn, "'작업 폴더' 저장 버튼이 보여야 함").toBeVisible({ timeout: 15_000 });
        await saveBtn.scrollIntoViewIfNeeded().catch(() => {});
        await saveBtn.click();
        await page.waitForTimeout(10_000); // proc_def/form_def/skill/agent 저장 + 확인 메시지
        await page.screenshot({ path: `${SHOT}/06-after-save.png`, fullPage: true });

        // 저장 에러 표시가 없어야 함
        const saveErr = page.locator('.ws-files__truncated', { hasText: /실패|error/i });
        const errText = (await saveErr.count()) > 0 ? await saveErr.first().innerText() : '';
        console.log('[save-error]', errText || '(none)');
        expect(errText, `저장 에러: ${errText}`).toBe('');
        // 저장됨 표시 또는 '생성된 프로세스' 확인 메시지 노출
        const savedBadge = page.locator('.ws-files__header').getByRole('button', { name: /저장됨/ });
        const confirmMsg = page.getByText(/저장이 완료|생성된 프로세스|확인 후/).first();
        const ok = (await savedBadge.count()) > 0 || (await confirmMsg.count()) > 0;
        expect(ok, '저장 완료 표시(저장됨/확인 메시지)가 있어야 함').toBeTruthy();

        // 새로고침 → 영속된 workspaceFiles 에서 파일 패널 복원
        await page.waitForTimeout(2_000);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(page.locator('.ws-files').first()).toBeVisible({ timeout: 60_000 });
        await page.screenshot({ path: `${SHOT}/07-after-reload-restored.png`, fullPage: true });

        // ── 뷰어 품질 검증: 폼 렌더 + 미리보기/코드 토글 + BPMN 전체높이 + XML 토글 ──
        const items = page.locator('.ws-files__item');
        // 폼 파일 클릭 → 폼 미리보기
        const formItem = page.locator('.ws-files__item', { hasText: /form\// }).first();
        if (await formItem.count()) {
            await formItem.click();
            await page.waitForTimeout(1200);
            await page.screenshot({ path: `${SHOT}/08-form-preview.png`, fullPage: true });
            // 미리보기/코드 토글 → 코드
            const codeBtn = page.locator('.hwpx-viewer__toggle button', { hasText: /^코드$/ }).first();
            if (await codeBtn.count()) {
                await codeBtn.click();
                await page.waitForTimeout(600);
                await page.screenshot({ path: `${SHOT}/09-form-code.png`, fullPage: true });
            }
        }
        // BPMN 파일 클릭 → 다이어그램(전체높이)
        const bpmnItem = page.locator('.ws-files__item', { hasText: /\.bpmn/ }).first();
        if (await bpmnItem.count()) {
            await bpmnItem.click();
            await page.waitForTimeout(2500);
            await page.screenshot({ path: `${SHOT}/10-bpmn-preview.png`, fullPage: true });
            const xmlBtn = page.locator('.hwpx-viewer__toggle button', { hasText: /^XML$/ }).first();
            if (await xmlBtn.count()) {
                await xmlBtn.click();
                await page.waitForTimeout(600);
                await page.screenshot({ path: `${SHOT}/11-bpmn-xml.png`, fullPage: true });
            }
        }
        expect(await items.count()).toBeGreaterThan(0);
    });
});
