/**
 * 프로세스 식별 — 실행 가능한 프로세스로 전환해 저장하면 식별 목록에서 정식 등록으로 바뀐다 (@agent, 느린 검증)
 * openspec: process-gpt-vue3 identification-list-detail (2026-11-12 결함)
 *
 * 결함: 식별 화면에서 업무를 실행 가능한 프로세스로 전환해 저장(또는 제안 → 병합)한 뒤 화면 안에서 목록으로 돌아오면
 * 상태가 '확인함'(지금 이름: 확정) 그대로였다. 목록이 처음 받은 결과를 계속 썼고, 전환으로 저장한 정의는 정식 등록으로 세지 않았다.
 *
 * 사람이 하는 그대로: 목록 → 업무 상세 → 실행 전환(로켓) → 에이전트가 만든 프로세스를 저장 → 브라우저 뒤로 가기로
 * 식별 화면에 돌아온다(전체 새로 고침 없이). 확인은 화면으로만 한다. 만든 데이터는 지우지 않는다.
 * 실행: HONG_EMAIL=… HONG_PASSWORD=… npx playwright test -c playwright.processgpt-live.config.ts handover/handover-identification-status
 */
import { expect, test, type Page } from '@playwright/test';
import { BASE, PEOPLE, login, shot } from './helpers';

test.setTimeout(60 * 60 * 1000);

const TARGET = '교육 신청';

async function until(fn: () => Promise<boolean>, label: string, timeout: number, every = 5_000) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
        if (await fn().catch(() => false)) return;
        await new Promise((r) => setTimeout(r, every));
    }
    throw new Error(`기다리다 시간 초과: ${label}`);
}

async function openList(page: Page) {
    for (let i = 0; i < 3; i++) {
        const th = page.waitForResponse((r) => r.url().includes('/process-miner/threads'), { timeout: 60_000 });
        await page.goto(`${BASE}/mining/handover`, { waitUntil: 'domcontentloaded' });
        if ((await th).ok()) break;
        await page.waitForTimeout(3_000);
    }
    await expect(page.locator('.e2e-work').first()).toBeVisible({ timeout: 300_000 });
}

/** 전환 대화방에서 생성이 끝날 때까지 기다리고(후보는 고르지 않는다), 저장한다. */
async function generateAndSave(page: Page) {
    const failRe = /검증을 통과하지 못해|통합하는 중 문제|마무리 처리 중 오류|요청을 처리하지 못했어요/;
    const done = page.locator('.ai-message-bubble', { hasText: /확인 후 저장/ }).first();
    const handled = new Set<string>();
    for (let i = 0; i < 240; i++) {
        const bubbles = await page
            .locator('.ai-message-bubble')
            .allInnerTexts()
            .catch(() => [] as string[]);
        const fail = bubbles.find((t) => failRe.test(t));
        if (fail) throw new Error(`전환 실패 — 화면 안내: ${fail}`);
        if ((await done.count()) && (await done.isVisible().catch(() => false))) break;
        const panel = page.locator('.hitl-feedback-wrap, .human-feedback-panel').last();
        if ((await panel.count()) && (await panel.isVisible().catch(() => false))) {
            const key = (await panel.allInnerTexts()).join(' ').slice(0, 200);
            if (!handled.has(key)) {
                handled.add(key);
                const approve = panel.getByRole('button', { name: /^\s*승인\s*$/ }).first();
                const submit = panel.getByRole('button', { name: /응답\s*제출/ }).first();
                const skip = panel.getByRole('button', { name: /건너뛰기/ }).first();
                if (await approve.count()) await approve.click().catch(() => undefined);
                else if ((await submit.count()) && (await submit.isEnabled())) await submit.click().catch(() => undefined);
                else if (await skip.count()) await skip.click().catch(() => undefined);
            }
        }
        await page.waitForTimeout(5_000);
    }
    await expect(done, '생성이 끝나 저장 안내가 떠야 한다').toBeVisible({ timeout: 10_000 });
    const vis = '.ws-files:visible ';
    const saveBtn = page.locator(`${vis}.ws-files__header`).getByRole('button', { name: /저장/ }).first();
    const savedBtn = page.locator(`${vis}.ws-files__header`).getByRole('button', { name: /저장됨/ });
    const validating = page.locator(`${vis}.ws-files__header`).getByText(/검증 중/);
    for (let attempt = 0; attempt < 3 && !(await savedBtn.count()); attempt++) {
        await page.waitForTimeout(5_000);
        await until(
            async () => !((await validating.count()) && (await validating.isVisible().catch(() => false))),
            '저장 전 검증',
            1_800_000
        );
        await expect(saveBtn).toBeEnabled({ timeout: 60_000 });
        await saveBtn.click();
        await savedBtn.waitFor({ state: 'visible', timeout: 30_000 }).catch(() => undefined);
    }
    await expect(savedBtn, '저장됨').toBeVisible({ timeout: 30_000 });
}

test('@agent 실행 가능한 프로세스로 전환해 저장하면, 화면 안에서 돌아온 식별 목록·상세가 정식 등록으로 바뀐다', async ({ browser }) => {
    const page = await login(browser, PEOPLE.hong);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openList(page);
    const row = page.locator('.e2e-work', { has: page.locator('.mining-work__name', { hasText: new RegExp(`^${TARGET}$`) }) });
    await expect(row).toHaveCount(1);
    const key = await row.getAttribute('data-key');
    const before = await row.getAttribute('data-status');
    expect(before, `${TARGET} 은 아직 정식 등록이 아니어야 시험이 된다`).not.toBe('registered');

    // 상세 → 실행 전환
    await row.click();
    await page.waitForURL(`**/mining/handover/${key}`);
    await expect(page.locator('.e2e-convert-process')).toBeEnabled({ timeout: 120_000 });
    await page.locator('.e2e-convert-process').click();
    await page.waitForURL(/\/chat\?roomId=/, { timeout: 60_000 });
    await shot(page, 'status-1-conversion-room');
    await generateAndSave(page);
    await shot(page, 'status-2-saved');

    // 브라우저 뒤로 가기 — 화면 안 이동(전체 새로 고침 없음)으로 상세에 돌아온다
    const marker = await page.evaluate(() => ((window as any).__e2eNoReload = Date.now()));
    await page.goBack();
    await page.waitForURL(`**/mining/handover/${key}`);
    expect(await page.evaluate(() => (window as any).__e2eNoReload), '전체 새로 고침이 일어났다').toBe(marker);
    await expect(page.locator('.mining-stepper li[data-stage="registered"].is-done')).toBeVisible({ timeout: 120_000 });
    await shot(page, 'status-3-detail-registered');

    // 목록으로(화면 안 이동) — 정식 등록
    await page.locator('.e2e-back').click();
    await page.waitForURL('**/mining/handover');
    expect(await page.evaluate(() => (window as any).__e2eNoReload)).toBe(marker);
    await expect(page.locator(`.e2e-work[data-key="${key}"]`)).toHaveAttribute('data-status', 'registered', { timeout: 120_000 });
    await shot(page, 'status-4-list-registered');
});
