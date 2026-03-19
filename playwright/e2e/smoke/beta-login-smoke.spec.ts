import { expect, test } from '@playwright/test';

function requiredEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`${name} is required for smoke test`);
    }
    return value;
}

async function clickTabOrButton(page: any, label: RegExp | string) {
    const tab = page.getByRole('tab', { name: label }).first();
    if ((await tab.count()) > 0) {
        await tab.click();
        return;
    }
    const button = page.getByRole('button', { name: label }).first();
    if ((await button.count()) > 0) {
        await button.click();
        return;
    }
    await page.getByText(label).first().click();
}

async function findInputByLabel(page: any, label: string) {
    const candidates = [
        page.getByRole('combobox', { name: new RegExp(label, 'i') }).first(),
        page.getByRole('textbox', { name: new RegExp(label, 'i') }).first(),
        page.locator(`.v-input:has(label:has-text("${label}")) input`).first(),
        page.locator(`.v-input:has(label:has-text("${label}")) textarea`).first()
    ];

    for (const candidate of candidates) {
        if ((await candidate.count()) > 0) return candidate;
    }
    throw new Error(`Cannot find input for label: ${label}`);
}

async function fillRoleIfEmpty(page: any, label: string, keyword: string, optionText: string) {
    const input = await findInputByLabel(page, label);
    await expect(input).toBeVisible({ timeout: 30_000 });

    const currentValue = ((await input.inputValue()) || '').trim();
    if (currentValue.length > 0) return;

    await input.click();
    await input.fill(keyword);

    const optionByRole = page.getByRole('option', { name: new RegExp(optionText, 'i') }).first();
    if ((await optionByRole.count()) > 0) {
        await optionByRole.click();
    } else {
        await page.getByText(optionText, { exact: false }).first().click();
    }

    await expect(input).not.toHaveValue('', { timeout: 20_000 });
}

function kanbanColumnByTitle(page: any, title: string) {
    return page.locator('h6', { hasText: title }).first().locator('xpath=ancestor::div[contains(@class,"v-card")][1]');
}

test.describe('smoke: landing to login', () => {
    test('uengine login -> definition-map -> execute flow', async ({ page }) => {
        test.setTimeout(600_000);

        const email = requiredEnv('E2E_USER');
        const password = requiredEnv('E2E_PASS');

        await page.context().clearCookies();
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

        // 로그인 성공 시 definition-map으로 이동해야 함
        await expect(page).toHaveURL(/\/definition-map/, { timeout: 60_000 });

        // 메인 채팅 입력/전송 검증
        const mainChatInput = page.locator('.cp-chat textarea').first();
        await expect(mainChatInput).toBeVisible({ timeout: 30_000 });
        const otherMessageLocator = page.locator('.message-bubble-wrap--other .chat-message-bubble');
        const otherMessageCountBefore = await otherMessageLocator.count();
        await mainChatInput.fill('안녕하세요');
        await page.locator('.cp-send').first().click();

        await expect(page.getByText('안녕하세요').first()).toBeVisible({ timeout: 30_000 });
        await expect
            .poll(
                async () => {
                    const count = await otherMessageLocator.count();
                    if (count <= otherMessageCountBefore) return false;

                    const lastBubble = otherMessageLocator.nth(count - 1);
                    const lastText = (await lastBubble.innerText()).trim();

                    // 로딩 버블("...")이 아닌 실제 AI 응답 텍스트가 도착했는지 확인
                    return lastText.length > 0 && lastText !== '...' && lastText !== '…';
                },
                { timeout: 120_000 }
            )
            .toBeTruthy();

        // 정의체계도 메인으로 복귀
        const homeLink = page.getByRole('link', { name: /home/i }).first();
        if ((await homeLink.count()) > 0) {
            await homeLink.click();
        } else {
            await page.goto('/definition-map', { waitUntil: 'domcontentloaded' });
        }
        await expect(page).toHaveURL(/\/definition-map/, { timeout: 60_000 });

        // deploy > test > 대출 심사 프로세스_V2 선택
        const deployNode = page.getByText(/^deploy$/i).first();
        if ((await deployNode.count()) > 0) await deployNode.click();
        const testNode = page.getByText(/^test$/i).first();
        if ((await testNode.count()) > 0) await testNode.click();

        const targetProcess = page.getByText('대출 심사 프로세스_V2', { exact: false }).first();
        await targetProcess.scrollIntoViewIfNeeded();
        await targetProcess.click();

        // 실행 다이얼로그 진입
        await page.getByRole('button', { name: /^실행$/ }).first().click();

        // 역할 지정: 값이 비어있을 때만 자동 입력
        await fillRoleIfEmpty(page, '신청자', 'jhyg', 'jhyg');
        await fillRoleIfEmpty(page, '대출 심사 에이전트', '대출 심사 전문가', '대출 심사 전문가');

        // 실행 시작
        await page.getByRole('button', { name: /^실행$/ }).first().click();

        // WorkItem: 에이전트에 맡기기 > 빠른 초안 생성
        await clickTabOrButton(page, /에이전트에 맡기기/);
        await clickTabOrButton(page, /빠른 초안 생성/);

        // 초안 채움 완료까지 대기 후 제출 완료
        await expect
            .poll(
                async () => {
                    const msg = page.getByText('빠른 생성이 완료되었습니다.', { exact: false }).first();
                    return (await msg.count()) > 0;
                },
                { timeout: 180_000 }
            )
            .toBeTruthy();
        await page.getByRole('button', { name: /제출 완료/ }).first().click();

        // 칸반보드 전환 후 상태 확인
        const doneColumn = kanbanColumnByTitle(page, '완료됨');
        const progressColumn = kanbanColumnByTitle(page, '진행중');
        await expect(doneColumn).toBeVisible({ timeout: 120_000 });
        await expect(progressColumn).toBeVisible({ timeout: 120_000 });
        await expect(doneColumn.getByText(/대출 신청서/, { exact: false }).first()).toBeVisible({ timeout: 120_000 });
        await expect(progressColumn.getByText(/신청서 검토/, { exact: false }).first()).toBeVisible({ timeout: 120_000 });

        // 신청서 검토 단계 진입
        await progressColumn.getByText(/신청서 검토/, { exact: false }).first().click();

        // 신청서 검토: 에이전트 탭에서 폼(심사 영역) 채워질 때까지 대기
        await clickTabOrButton(page, /에이전트에 맡기기/);
        await expect
            .poll(
                async () => {
                    const input = page.locator('.v-input:has(label:has-text("심사 영역")) textarea, .v-input:has(label:has-text("심사 영역")) input').first();
                    if ((await input.count()) === 0) return false;
                    const val = ((await input.inputValue()) || '').trim();
                    return val.length > 0;
                },
                { timeout: 180_000 }
            )
            .toBeTruthy();

        // 이전 작업 입력 내역 확인
        await clickTabOrButton(page, /이전 작업 입력 내역/);
        await expect
            .poll(
                async () => {
                    const values = await page
                        .locator('.dynamic-form input, .dynamic-form textarea')
                        .evaluateAll((els) => els.map((el: any) => (el.value || '').trim()).filter((v: string) => v.length > 0));
                    return values.length > 0;
                },
                { timeout: 60_000 }
            )
            .toBeTruthy();

        // 이전 버튼으로 칸반 복귀
        await page.locator('button:has(.mdi-arrow-left)').first().click();
        await expect(doneColumn.or(progressColumn)).toBeVisible({ timeout: 60_000 });

        // 승인 결과 통보 단계가 진행중 또는 완료됨에 있는지 확인
        const hasNotifyInProgress = (await progressColumn.getByText(/승인 결과 통보/, { exact: false }).count()) > 0;
        const hasNotifyDone = (await doneColumn.getByText(/승인 결과 통보/, { exact: false }).count()) > 0;
        expect(hasNotifyInProgress || hasNotifyDone).toBeTruthy();
    });
});
