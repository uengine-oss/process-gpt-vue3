import { expect, test, type Page } from '@playwright/test';

/**
 * bpmn-artifact-only-flow / 생성 산출물 ArtifactPanel 표시 (bpmn-artifact-display spec)
 *
 * deepagent SSE 의 `process_result` 이벤트를 가로채(mock) 출력계약을 주입하고, 프론트가 우측
 * ArtifactPanel 에 'process' 패널(프로세스 미리보기 + 스킬/에이전트 + 저장 버튼)을 띄우는지 검증한다.
 * LLM/백엔드 없이 UI 연결만 결정적으로 확인하기 위해 스트림을 mock 한다.
 *
 * 실행 전제(라이브 dev 서버 + 로그인): 아래 env 가 모두 있어야 실행되고, 없으면 skip 된다.
 *   E2E_USER, E2E_PASS               — 로그인 자격
 *   E2E_DEEPAGENT_CHAT_URL           — orchestration=deepagents 인 채팅방 경로(예: /chat?roomId=...)
 *
 *   BASE_URL (선택)                  — 미설정 시 playwright.config 의 managed dev 서버(8088) 사용
 */

const USER = process.env.E2E_USER;
const PASS = process.env.E2E_PASS;
const CHAT_URL = process.env.E2E_DEEPAGENT_CHAT_URL;

const CONTRACT = {
    type: 'process-definition-result',
    processDefinition: {
        processDefinitionId: 'e2e-pd-0001',
        processDefinitionName: '휴가 신청 프로세스',
        roles: [{ name: '신청자' }, { name: '팀장' }],
        elements: [
            { elementType: 'Event', id: 'start_1', type: 'StartEvent', name: '시작' },
            { elementType: 'Activity', id: 'act_apply', type: 'UserActivity', name: '휴가 신청', role: '신청자', skills: ['leave-balance-check'] },
            { elementType: 'Gateway', id: 'gw_approve', type: 'ExclusiveGateway', name: '승인 여부' },
            { elementType: 'Activity', id: 'act_review', type: 'UserActivity', name: '결재 검토', role: '팀장' },
            { elementType: 'Event', id: 'end_1', type: 'EndEvent', name: '종료' },
            { elementType: 'Sequence', id: 'seq_1', source: 'start_1', target: 'act_apply' },
            { elementType: 'Sequence', id: 'seq_2', source: 'act_apply', target: 'gw_approve' },
            { elementType: 'Sequence', id: 'seq_3', source: 'gw_approve', target: 'act_review', condition: '승인' },
            { elementType: 'Sequence', id: 'seq_4', source: 'act_review', target: 'end_1' }
        ]
    },
    forms: [{ activity_id: 'act_apply', form_id: 'e2e-pd-0001_act_apply_form', html: '<section>폼</section>' }],
    agents: [{ id: 'agent_pl_review', name: '팀장 — 휴가 검토', role: '팀장', skills: ['leave-balance-check'], activity_ids: ['act_review'] }],
    skills: ['leave-balance-check']
};

function sseBody(): string {
    const lines = [
        { type: 'meta', conversation_id: 'e2e-test' },
        { type: 'token', content: '프로세스를 생성했어요. 확인 후 저장 버튼을 눌러주세요.' },
        { type: 'process_result', data: CONTRACT },
        { type: 'done', content: '' }
    ];
    return lines.map((o) => `data: ${JSON.stringify(o)}\n`).join('\n') + '\n';
}

async function login(page: Page) {
    await page.context().clearCookies();
    await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/auth\/login/);
    await page.locator('.cp-id input').fill(USER!);
    await page.locator('.cp-pwd input').fill(PASS!);
    await page.locator('.cp-login').click();
    await expect(page).toHaveURL(/\/definition-map|\/chat|\/main/, { timeout: 60_000 });
}

test.describe('bpmn-artifact: ArtifactPanel 표시 + 저장(mocked SSE)', () => {
    test.skip(!USER || !PASS || !CHAT_URL, 'E2E_USER/E2E_PASS/E2E_DEEPAGENT_CHAT_URL 필요(라이브 서버).');

    test('process_result → ArtifactPanel 에 프로세스 산출물 + 저장 버튼', async ({ page }) => {
        // deepagent 스트림 mock — 어떤 메시지를 보내도 동일한 출력계약을 반환
        await page.route('**/process-gpt-deepagents/chat/stream', async (route) => {
            await route.fulfill({
                status: 200,
                headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache' },
                body: sseBody()
            });
        });

        await login(page);
        await page.goto(CHAT_URL!, { waitUntil: 'domcontentloaded' });

        // 채팅 입력창에 메시지 입력 후 전송
        const input = page.locator('textarea, [contenteditable="true"], input[type="text"]').first();
        await expect(input).toBeVisible({ timeout: 30_000 });
        await input.click();
        await input.fill('휴가 신청 프로세스 만들어줘');
        await page.keyboard.press('Enter');

        // 우측 ArtifactPanel 에 생성 산출물(프로세스명)이 표시되어야 한다
        await expect(page.getByText('휴가 신청 프로세스').first()).toBeVisible({ timeout: 30_000 });
        // 저장 버튼 노출
        const saveBtn = page.getByRole('button', { name: /저장/ }).first();
        await expect(saveBtn).toBeVisible({ timeout: 15_000 });

        // 미리보기 버튼 동작(저장 전 createBpmnXml 변환 미리보기)
        const previewBtn = page.getByRole('button', { name: /미리보기/ }).first();
        if (await previewBtn.isVisible()) {
            await previewBtn.click();
            await expect(page.locator('.bpmn-preview, [class*="bpmn"], .v-dialog').first()).toBeVisible({ timeout: 15_000 });
        }
    });

    test('재진입 시 산출물 패널 복원 — 새로고침 후에도 우측 탭에서 다시 열어본다', async ({ page }) => {
        // deepagent 스트림 mock — 메시지를 보내 산출물을 메시지에 영속시킨다.
        await page.route('**/process-gpt-deepagents/chat/stream', async (route) => {
            await route.fulfill({
                status: 200,
                headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache' },
                body: sseBody()
            });
        });

        await login(page);
        await page.goto(CHAT_URL!, { waitUntil: 'domcontentloaded' });

        const input = page.locator('textarea, [contenteditable="true"], input[type="text"]').first();
        await expect(input).toBeVisible({ timeout: 30_000 });
        await input.click();
        await input.fill('휴가 신청 프로세스 만들어줘');
        await page.keyboard.press('Enter');

        // 1) 스트리밍으로 패널이 떠야 한다(영속까지 시간 확보)
        await expect(page.getByText('휴가 신청 프로세스').first()).toBeVisible({ timeout: 30_000 });
        await page.waitForTimeout(2_000); // persistMessageFrontendState 가 chats row 에 기록될 시간

        // 2) 새로고침 — 이때 mock 스트림은 다시 호출되지 않는다(새 메시지 미전송).
        //    패널은 오직 영속된 msg.pdf2bpmnResult.__contract 로부터 복원되어야 한다.
        await page.reload({ waitUntil: 'domcontentloaded' });

        // 3) 우측 ArtifactPanel 에 process 패널이 복원되어 프로세스명이 다시 보인다
        await expect(page.getByText('휴가 신청 프로세스').first()).toBeVisible({ timeout: 30_000 });
        // 복원된 패널에서도 미리보기/저장 액션을 다시 사용할 수 있다
        await expect(page.getByRole('button', { name: /저장|미리보기/ }).first()).toBeVisible({ timeout: 15_000 });
    });
});
