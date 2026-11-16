/**
 * 프로세스 식별 — 띄워 둔 목록이 다른 탭에서 한 일을 반영하고, 실행 전환 방의 식별 정보가 에이전트 턴 뒤에도 남는다
 * openspec: process-gpt-vue3 identification-list-detail (2026-11-12 결함 재발)
 *
 * 결함: 식별 목록을 띄워 둔 채 실행 전환으로 '구매 요청' 을 저장해도 상태가 바뀌지 않았다.
 *   - 목록은 화면에 들어올 때만 다시 받았다(띄워 둔 탭은 그대로)
 *   - deepagents 가 대화 턴 끝에 방 context 를 통째로 덮어써, 전환 방의 identification 이 지워졌다
 *
 * 사람이 하는 그대로: 탭 A 에 식별 목록을 띄워 두고, 탭 B 에서 전환 방에 말을 걸고 다른 업무를 보류했다 되돌린 뒤
 * 탭 A 로 돌아온다. 새 프로세스 정의는 만들지 않는다. 만든 대화는 지우지 않는다.
 * 실행: HONG_EMAIL=… HONG_PASSWORD=… npx playwright test -c playwright.processgpt-live.config.ts handover/handover-identification-live
 */
import { expect, test, type Page } from '@playwright/test';
import { BASE, PEOPLE, login, shot } from './helpers';
import { askAgent, q } from './identification-flow';

test.setTimeout(30 * 60 * 1000);

const PURCHASE_KEY = 'd760498aab90';
const CONVERSION_ROOM = '715ad709-906e-4736-867f-fbc464490b01';
const CONFIRM = '휴가 신청';

async function openList(page: Page) {
    for (let i = 0; i < 3; i++) {
        const th = page.waitForResponse((r) => r.url().includes('/process-miner/threads'), { timeout: 60_000 });
        await page.goto(`${BASE}/mining/handover`, { waitUntil: 'domcontentloaded' });
        if ((await th).ok()) break;
        await page.waitForTimeout(3_000);
    }
    await expect(page.locator('.e2e-work').first()).toBeVisible({ timeout: 300_000 });
    await page.waitForTimeout(3_000);
}

const rowOf = (page: Page, name: string) =>
    page.locator('.e2e-work', { has: page.locator('.mining-work__name', { hasText: new RegExp(`^${name}$`) }) });

test('띄워 둔 식별 목록이 다른 탭에서 한 보류·되돌리기를 반영하고, 전환 방의 식별 정보가 에이전트 턴 뒤에도 남는다', async ({
    browser
}) => {
    const a = await login(browser, PEOPLE.hong);
    await a.setViewportSize({ width: 1440, height: 900 });
    await openList(a);

    // 1. 실행 전환으로 저장한 '구매 요청' 이 정식 등록이다
    await expect(a.locator(`.e2e-work[data-key="${PURCHASE_KEY}"]`)).toHaveAttribute('data-status', 'registered', { timeout: 120_000 });
    const confirmRow = rowOf(a, CONFIRM);
    await expect(confirmRow).toHaveCount(1);
    const confirmKey = (await confirmRow.getAttribute('data-key')) as string;
    expect(await confirmRow.getAttribute('data-status'), `${CONFIRM} 은 추천 상태여야 시험이 된다`).toBe('found');
    const marker = await a.evaluate(() => ((window as any).__e2eNoReload = Date.now()));
    await shot(a, 'live-1-list-before');

    // 2. 탭 B: 전환 방에서 에이전트 턴 — 턴이 끝나도 방의 identification 이 남는다
    const b = await a.context().newPage();
    await b.setViewportSize({ width: 1440, height: 900 });
    await b.goto(`${BASE}/chat?roomId=${CONVERSION_ROOM}`, { waitUntil: 'domcontentloaded' });
    await expect(b.locator('textarea:not([disabled]):visible').first()).toBeVisible({ timeout: 60_000 });
    await askAgent(b, CONVERSION_ROOM, '저장한 구매 요청 프로세스의 단계를 한 줄로 요약해 주세요.');
    await b.waitForTimeout(5_000);
    const [room] = await q(b, 'chat_rooms', `select=context&id=eq.${CONVERSION_ROOM}`);
    expect(room?.context?.identification?.process_key, '에이전트 턴 뒤에 identification 이 지워졌다').toBe(PURCHASE_KEY);

    // 3. 탭 B: 다른 업무를 보류한다(상세 머리의 보류 버튼)
    await openList(b);
    await rowOf(b, CONFIRM).click();
    await b.waitForURL(`**/mining/handover/${confirmKey}`);
    await expect(b.locator('.e2e-hold')).toBeVisible({ timeout: 120_000 });
    await b.locator('.e2e-hold').click();
    await expect(b.locator('.e2e-group-held')).toBeVisible({ timeout: 60_000 });

    // 4. 탭 A 로 돌아온다 — 새로 고침 없이 목록이 '보류' 로 바뀐다
    await a.bringToFront();
    await a.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(rowOf(a, CONFIRM)).toHaveAttribute('data-status', 'held', { timeout: 90_000 });
    await shot(a, 'live-2-list-held');

    // 5. 탭 B 에서 추천으로 되돌리면 탭 A 도 다시 '추천'
    await b.bringToFront();
    await b.locator('.e2e-hold').click();
    await expect(b.locator('.e2e-group-held')).toHaveCount(0, { timeout: 60_000 });
    await a.bringToFront();
    await a.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(rowOf(a, CONFIRM)).toHaveAttribute('data-status', 'found', { timeout: 90_000 });
    expect(await a.evaluate(() => (window as any).__e2eNoReload), '탭 A 가 새로 고쳐졌다').toBe(marker);
});
