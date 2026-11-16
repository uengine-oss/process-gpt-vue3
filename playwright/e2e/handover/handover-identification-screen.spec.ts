/**
 * 프로세스 식별 화면 — 목록과 상세 (identification-list-detail, 2026-11-12).
 *
 * 실제 ProcessGPT(8088) 에서 관리자가 화면을 쓰는 그대로 본다. 확인하는 것:
 *   1. 목록 /mining/handover 과 상세 /mining/handover/:key 가 나뉘고, 1440×900 에서 두 화면 모두 페이지가 내려가지 않는다
 *   2. 목록은 처리할 일 순이고, 필터로 걸러진다. 확인 필요는 목록 끝 한 줄이다
 *   3. 상세의 단계를 누르면 그 단계를 거친 건만 강조된다(칩의 건수와 같다)
 *   4. 상세 주소를 새로 고쳐도 같은 업무가 보이고, 없는 업무 키는 안내가 나온다
 *   5. 관리자 대화는 상세에 늘 보이고, 입력 칸이 첫 화면 안에 있다
 *
 * 저장하지 않는다(보기만). 실행: HONG_EMAIL=… HONG_PASSWORD=… npx playwright test -c playwright.processgpt-live.config.ts handover/handover-identification-screen
 */
import { expect, test, type Page } from '@playwright/test';
import { BASE, PEOPLE, login, shot } from './helpers';

test.setTimeout(10 * 60 * 1000);

async function noPageScroll(page: Page) {
    const { sh, ih } = await page.evaluate(() => ({ sh: document.scrollingElement!.scrollHeight, ih: window.innerHeight }));
    expect(sh, `문서 높이 ${sh} > 창 높이 ${ih}`).toBeLessThanOrEqual(ih + 1);
}

async function openList(page: Page) {
    for (let i = 0; i < 3; i++) {
        const th = page.waitForResponse((r) => r.url().includes('/process-miner/threads'), { timeout: 60_000 });
        await page.goto(`${BASE}/mining/handover`, { waitUntil: 'domcontentloaded' });
        if ((await th).ok()) break;
        await page.waitForTimeout(3_000);
    }
    await expect(page.locator('.e2e-work').first()).toBeVisible({ timeout: 300_000 });
    await page.waitForTimeout(1_500);
}

test('목록과 상세가 나뉘고, 한 화면 안에서 업무를 판단한다', async ({ browser }) => {
    const page = await login(browser, PEOPLE.hong);
    await page.setViewportSize({ width: 1440, height: 900 });

    // 1·2. 목록
    await openList(page);
    await noPageScroll(page);
    await shot(page, 'screen-1-list');
    const statuses = await page.locator('.e2e-work').evaluateAll((els) =>
        els.map((e) => ({
            key: e.getAttribute('data-key'),
            status: e.getAttribute('data-status'),
            hasNew: !!e.querySelector('.e2e-work-new')
        }))
    );
    expect(statuses.length).toBeGreaterThan(0);
    // 처리할 일 순: 새로 들어온 건 → 추천 → 제안 중 → 정식 등록 → 보류
    const rank = (w: { status: string | null; hasNew: boolean }) =>
        w.hasNew ? 0 : { found: 1, proposed: 2, registered: 3, held: 4 }[w.status || 'found'] ?? 9;
    const ranks = statuses.map(rank);
    expect(ranks, JSON.stringify(statuses)).toEqual([...ranks].sort((a, b) => a - b));
    // 추천 필터
    await page.locator('.e2e-filter-found').click();
    const foundOnly = await page.locator('.e2e-work').evaluateAll((els) => els.map((e) => e.getAttribute('data-status')));
    expect(foundOnly.every((s) => s === 'found')).toBe(true);
    await page.locator('.e2e-filter-all').click();
    await expect(page.locator('.e2e-work-unclassified')).toBeVisible();

    // 3·5. 상세 — 건이 가장 많은 업무
    const target = await page.locator('.e2e-work').evaluateAll((els) => {
        const n = (e: Element) => parseInt((e.querySelector('.mining-work__n')?.textContent || '0').replace(/\D/g, ''), 10) || 0;
        return [...els].sort((a, b) => n(b) - n(a))[0].getAttribute('data-key');
    });
    await page.locator(`.e2e-work[data-key="${target}"]`).click();
    await page.waitForURL(`**/mining/handover/${target}`);
    await expect(page.locator('.e2e-step').first()).toBeVisible({ timeout: 60_000 });
    await expect(page.locator('.e2e-thread').first()).toBeVisible();
    await page.waitForTimeout(2_000);
    await noPageScroll(page);
    await expect(page.locator('.e2e-talk')).toBeVisible();
    await expect(page.locator('.e2e-talk-input')).toBeInViewport();
    await shot(page, 'screen-2-detail');

    // 단계를 누르면 그 단계를 거친 건만 강조된다 — 칩의 건수와 같다
    const chips = page.locator('.e2e-step');
    const n = await chips.count();
    let checked = false;
    for (let i = 0; i < n && !checked; i++) {
        const chip = chips.nth(i);
        const [count, total] = ((await chip.locator('.mining-step__n').textContent()) || '0/0').split('/').map((x) => parseInt(x, 10));
        if (!(count > 0 && count < total)) continue; // 갈리는 단계로 본다
        await chip.click();
        await expect(page.locator('.e2e-thread.is-hit')).toHaveCount(count);
        await expect(page.locator('.e2e-thread.is-dim')).toHaveCount(total - count);
        await shot(page, 'screen-3-step-highlight');
        await chip.click();
        await expect(page.locator('.e2e-thread.is-hit')).toHaveCount(0);
        checked = true;
    }
    expect(checked, '모든 건이 거친 단계뿐이라 강조를 볼 수 없다').toBe(true);

    // 4. 새로 고침 · 없는 업무 키
    const name = (await page.locator('.e2e-detail-name').textContent())?.trim();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('.e2e-detail-name')).toHaveText(name || '', { timeout: 300_000 });
    await page.goto(`${BASE}/mining/handover/no-such-work`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.e2e-not-found')).toBeVisible({ timeout: 300_000 });

    // 확인 필요 상세: 건과 사유
    await page.locator('.e2e-not-found a').click();
    await page.waitForURL('**/mining/handover');
    await page.locator('.e2e-work-unclassified').click();
    await expect(page.locator('.e2e-thread').first()).toBeVisible({ timeout: 60_000 });
    await expect(page.locator('.e2e-thread-unclassified').first()).toBeVisible();
    await noPageScroll(page);
    await shot(page, 'screen-4-unclassified');
});
