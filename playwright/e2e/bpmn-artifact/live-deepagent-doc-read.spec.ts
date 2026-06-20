import { expect, test, type Page } from '@playwright/test';

/**
 * LIVE 검증 — 문서 업로드 → memento 로 내용 읽기 → 컨설팅/프로세스 생성 진입.
 *
 * 목표: PDF 를 첨부하고 "문서 내용으로 프로세스 생성" 을 보냈을 때
 *  - 에이전트가 "문서 목록이 비어 있어" 류로 포기하지 않고
 *  - memento 로 문서를 읽어 컨설팅 초안(또는 HITL)을 제시하는지.
 *
 * 실 서버(프론트 8088 + gateway + supabase + memento 8005 + deepagent 8888)가 모두 떠 있어야 한다.
 * 실행: E2E_LIVE=1 E2E_USER=.. E2E_PASS=.. npx playwright test .../live-deepagent-doc-read.spec.ts
 */

const LIVE = process.env.E2E_LIVE === '1';
const USER = process.env.E2E_USER;
const PASS = process.env.E2E_PASS;
const ROOM = process.env.E2E_ROOM || 'd8b92943-65a5-4659-8951-69cc75f37a34';
const FILE = process.env.E2E_FILE || 'C:\\Users\\user\\Downloads\\테스트용_업무문서_BPMN_검증.pdf';
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

test.describe('LIVE bpmn-artifact: 문서 업로드 → memento 읽기 → 컨설팅 진입', () => {
    test.skip(!LIVE || !USER || !PASS, 'E2E_LIVE=1 + E2E_USER/E2E_PASS 필요(실 서버).');
    test.setTimeout(600_000);

    test('PDF 첨부 후 프로세스 생성 요청 시 문서를 읽어 진행', async ({ page }) => {
        page.on('console', (m) => console.log('[browser]', m.type(), m.text().slice(0, 300)));
        page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 300)));
        page.on('response', (r) => {
            if (r.status() >= 400) console.log('[http]', r.status(), r.request().method(), r.url().slice(0, 140));
        });
        await page.setViewportSize({ width: 1920, height: 1080 });

        // deepagent 로 실제 요청이 나갔는지 확인용 — /chat/stream 호출 카운트
        let chatStreamCalls = 0;
        page.on('request', (r) => {
            if (/\/chat\/stream/.test(r.url())) chatStreamCalls++;
        });

        await login(page);

        // 지정 채팅방으로 진입
        await page.goto(`/chat?roomId=${ROOM}`, { waitUntil: 'domcontentloaded' });
        const input = page.locator('.cp-chat textarea').first();
        await expect(input).toBeVisible({ timeout: 30_000 });
        await page.waitForTimeout(2_000);

        // deepagents 모드 선택(있으면)
        const select = page.locator('.orchestration-select').first();
        if ((await select.count()) > 0) {
            try {
                await select.click();
                const deepOption = page.getByRole('option', { name: /딥|deep/i }).first();
                if (await deepOption.count()) {
                    await deepOption.click();
                    await page.waitForTimeout(500);
                }
            } catch {
                /* ignore */
            }
        }
        await page.screenshot({ path: `${SHOT}/doc-00-room.png`, fullPage: true });

        // 파일 첨부 — 숨겨진 통합 파일 input(.pdf 허용)에 직접 주입
        const fileInput = page.locator('input[type="file"][accept*=".pdf"]').first();
        await expect(fileInput).toHaveCount(1, { timeout: 15_000 });
        await fileInput.setInputFiles(FILE);

        // 업로드(임베딩) 완료 대기 — "문서 임베딩 중..." 버블이 사라질 때까지
        await page.waitForTimeout(2_000);
        await page.screenshot({ path: `${SHOT}/doc-01-attached.png`, fullPage: true });
        const embedding = page.locator('.ai-message-bubble, .cp-chat', { hasText: /임베딩 중/ }).first();
        for (let i = 0; i < 30; i++) {
            if ((await embedding.count()) === 0) break;
            if (!(await embedding.isVisible().catch(() => false))) break;
            await page.waitForTimeout(1_000);
        }

        // 전송 직전 어시스턴트 버블 수를 기준선으로 잡아, 이전 run 잔여 메시지 오탐 방지.
        const baselineBubbles = await page.locator('.ai-message-bubble').count();

        // 요청 전송 — Enter 가 안 먹으면(모드/포커스 문제) 전송버튼/재시도로 보강.
        await input.click();
        await input.fill('문서 내용으로 프로세스 생성');
        await input.press('Enter');
        for (let s = 0; s < 6 && chatStreamCalls === 0; s++) {
            await page.waitForTimeout(2_000);
            if (chatStreamCalls > 0) break;
            // 입력이 남아 있으면(전송 실패) 다시 시도
            const cur = (await input.inputValue().catch(() => '')) || '';
            if (cur.includes('문서 내용으로 프로세스 생성')) {
                const sendBtn = page
                    .locator('.cp-chat button, .cp-chat [class*="send"]')
                    .filter({ has: page.locator('svg, i') })
                    .last();
                if ((await sendBtn.count()) > 0) await sendBtn.click().catch(() => {});
                await input.press('Enter').catch(() => {});
            }
        }

        // 응답 폴링 — 실패 문구 없이 컨설팅 초안/HITL/산출물 패널이 뜨는지 확인.
        // (이번 전송 이후 새로 생긴 버블만 평가)
        const failRe = /문서 목록(에서|이)?\s*비어|파일이 제대로 업로드|문서를 처리할 수 없|다시 선택해|문서를 읽지 못|문서를 읽어들이지 못|읽어들이지 못했|찾지 못했/;
        const consultRe = /단계|프로세스|초안|승인|진행할까요|신청|검토/;
        let sawFail = false;
        let sawConsult = false;
        let sawHitl = false;
        let sawFiles = false;
        let lastAssistant = '';

        for (let i = 0; i < 80; i++) {
            // ~9s * 80 ≈ 12min 상한
            const bubbles = page.locator('.ai-message-bubble');
            const n = await bubbles.count();
            // 기준선 이후 새 버블만 검사
            const newTexts: string[] = [];
            for (let k = baselineBubbles; k < n; k++) {
                newTexts.push((await bubbles.nth(k).innerText().catch(() => '')) || '');
            }
            if (newTexts.length > 0) {
                lastAssistant = newTexts[newTexts.length - 1];
                const joined = newTexts.join('\n');
                if (failRe.test(joined)) sawFail = true;
                if (consultRe.test(lastAssistant) && lastAssistant.length > 40) sawConsult = true;
            }
            const hitl = page.locator('.human-feedback-panel').last();
            if ((await hitl.count()) > 0 && (await hitl.isVisible().catch(() => false))) sawHitl = true;
            const filesPanel = page.locator('.ws-files__item');
            if ((await filesPanel.count()) > 0) sawFiles = true;

            if (sawFail) break; // 실패 문구가 뜨면 즉시 종료(테스트 실패로)
            if (sawHitl || sawConsult || sawFiles) {
                await page.screenshot({ path: `${SHOT}/doc-02-consult.png`, fullPage: true });
                break;
            }
            if (i % 3 === 0) await page.screenshot({ path: `${SHOT}/doc-poll-${String(i).padStart(2, '0')}.png` });
            await page.waitForTimeout(9_000);
        }

        await page.screenshot({ path: `${SHOT}/doc-03-final.png`, fullPage: true });
        console.log('[result]', JSON.stringify({ chatStreamCalls, sawFail, sawConsult, sawHitl, sawFiles, baselineBubbles }));
        console.log('[last-assistant]', lastAssistant.slice(0, 600));

        expect(chatStreamCalls, 'deepagent(/chat/stream)로 요청이 전송되어야 함(딥에이전트 모드)').toBeGreaterThan(0);
        expect(sawFail, `에이전트가 문서를 못 읽고 포기함. 마지막 응답: ${lastAssistant.slice(0, 300)}`).toBeFalsy();
        expect(sawConsult || sawHitl || sawFiles, '컨설팅 초안/HITL/산출물 패널이 떠야 함(문서 읽기 성공)').toBeTruthy();
    });
});
