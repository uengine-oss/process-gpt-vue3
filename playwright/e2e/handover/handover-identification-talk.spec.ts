/**
 * 프로세스 식별 — 관리자가 대화로 단계(필수·옵션)를 확정한다 (general-intent-grouping, 2026-11-12).
 *
 * 실제 ProcessGPT(8088) 식별 화면에서 관리자가 묶음을 열고 말한다. 확인하는 것:
 *   1. 묶음 이름은 업무 범주이고, 단계 이름 겹침으로 묶지 않는다(마이너 POST /processes 응답)
 *   2. 말하면 바뀔 내용이 정해진 문장으로 보이고, 적용하기 전에는 저장된 결정이 그대로다
 *   3. 적용하면 저장되고, 화면을 다시 열어 식별해도 필수 확정이 그대로다
 *   4. 단계 구성이 다른 업무 두 개에서 위가 같다
 *
 * 필요한 것: 실제 마이너(8015, LLM 설정 포함), 로그인 계정(HONG_EMAIL · HONG_PASSWORD).
 * 결정을 저장한다(handover_process_decisions). 시험 데이터는 지우지 않는다.
 * 실행: npx playwright test -c playwright.processgpt-live.config.ts handover/handover-identification-talk
 */
import { expect, test, type Page } from '@playwright/test';
import { BASE, PEOPLE, login, shot } from './helpers';

type Group = {
    process_key: string;
    name: string;
    category: string;
    activities: string[];
    core_activities: string[];
    optional_activities: string[];
    cases: string[];
    minable: boolean;
};

async function openScreen(page: Page): Promise<Group[]> {
    // 로그인 직후에는 토큰이 아직 없어 첫 요청이 401 일 수 있다 — 그때만 한 번 다시 연다
    for (let i = 0; i < 3; i++) {
        const th = page.waitForResponse((r) => r.url().includes('/process-miner/threads'), { timeout: 60_000 });
        await page.goto(`${BASE}/mining/handover`, { waitUntil: 'domcontentloaded' });
        if ((await th).ok()) break;
        await page.waitForTimeout(3_000);
    }
    const groupsRes = page.waitForResponse((r) => r.url().includes('/process-miner/processes') && r.request().method() === 'POST', {
        timeout: 180_000
    });
    await page.goto(`${BASE}/mining/handover`, { waitUntil: 'domcontentloaded' });
    // 처음 보인 묶음을 경계로 남기면 한 번 더 받는다 — 마지막 응답을 쓴다
    let body = await (await groupsRes).json();
    // 목록(/mining/handover)이 업무 줄을 그릴 때까지
    await expect(page.locator('.e2e-work').first()).toBeVisible({ timeout: 180_000 });
    const again = await page
        .waitForResponse((r) => r.url().includes('/process-miner/processes') && r.request().method() === 'POST', { timeout: 3_000 })
        .catch(() => null);
    if (again) body = await again.json();
    return body.processes as Group[];
}

async function decisionOf(page: Page, key: string) {
    return page.evaluate(async (k) => {
        const { data } = await (window as any).$supabase
            .from('handover_process_decisions')
            .select('status, core_activities, confirmed_steps')
            .eq('process_key', k)
            .maybeSingle();
        return data;
    }, key);
}

async function pick(page: Page, key: string) {
    // 목록에서 업무 줄을 누르면 상세(/mining/handover/:key)로 간다
    if (!page.url().endsWith(`/mining/handover/${key}`)) {
        if (!page.url().endsWith('/mining/handover')) await page.goto(`${BASE}/mining/handover`, { waitUntil: 'domcontentloaded' });
        await page.locator(`.e2e-work[data-key="${key}"]`).click();
        await page.waitForURL(`**/mining/handover/${key}`);
    }
    await expect(page.locator('.e2e-steps')).toBeVisible();
}

async function talkAndApply(page: Page, g: Group, step: string, shotPrefix: string) {
    await pick(page, g.process_key);
    await expect(page.locator('.e2e-talk')).toBeVisible();
    const before = await decisionOf(page, g.process_key);

    const msgs = page.locator('.e2e-talk-msg[data-role="assistant"]');
    // 지난 대화를 다 불러온 뒤에 센다
    let n = -1;
    for (let stable = 0; stable < 3; ) {
        await page.waitForTimeout(1_000);
        const c = await msgs.count();
        stable = c === n ? stable + 1 : 0;
        n = c;
    }
    await page.locator('.e2e-talk-input input').fill(`${step} 단계는 필수로 확정해줘`);
    await page.locator('.e2e-talk-input input').press('Enter');
    await expect(msgs).toHaveCount(n + 1, { timeout: 120_000 });
    const reply = msgs.nth(n);
    await expect(reply.locator('.e2e-talk-change')).toContainText(`'${step}' 단계를 필수로 확정합니다`);
    await shot(page, `${shotPrefix}-1-proposed`);

    // 적용하기 전에는 저장된 결정이 그대로이고, 단계 칩에 미리보기로만 보인다
    expect(await decisionOf(page, g.process_key)).toEqual(before);
    await expect(page.locator(`.e2e-step[data-step="${step}"]`)).toHaveClass(/is-preview/);
    const talkCount = await page.locator('.e2e-talk-msg').count();

    await reply.locator('.e2e-talk-apply').click();
    await expect.poll(async () => (await decisionOf(page, g.process_key))?.confirmed_steps || [], { timeout: 60_000 }).toContain(step);
    const after = await decisionOf(page, g.process_key);
    expect(after.core_activities).toContain(step);
    expect(after.confirmed_steps).toContain(step);
    // 화면 전체를 다시 불러오지 않는다 — 대화가 그대로 있고, 칩이 그 자리에서 필수·관리자 확정으로 바뀐다
    await expect(page.locator('.e2e-talk-msg')).toHaveCount(talkCount);
    await expect(page.locator(`.e2e-step[data-step="${step}"]`)).toHaveAttribute('data-kind', 'required');
    await expect(page.locator(`.e2e-step[data-step="${step}"] .v-icon`)).toBeVisible();
    await shot(page, `${shotPrefix}-2-applied`);
}

test('관리자가 대화로 확정한 필수 단계가 다시 식별해도 유지된다 — 단계 구성이 다른 업무 두 개', async ({ browser }) => {
    test.setTimeout(20 * 60 * 1000);
    const hong = await login(browser, PEOPLE.hong);
    const groups = await openScreen(hong);

    // 단계 구성이 다른 업무 두 개(도출할 수 있는 것)
    const usable = groups.filter((g) => g.minable && g.activities.length >= 2);
    expect(usable.length, JSON.stringify(groups.map((g) => [g.name, g.activities]))).toBeGreaterThanOrEqual(2);
    const [a, b] = usable;
    expect(a.activities.join('|')).not.toEqual(b.activities.join('|'));
    // 묶음 이름은 업무 범주다
    for (const g of [a, b]) expect(g.name).toBe(g.category);

    const target = (g: Group) => g.optional_activities[0] || g.activities[g.activities.length - 1];
    const steps = { [a.process_key]: target(a), [b.process_key]: target(b) };
    await talkAndApply(hong, a, steps[a.process_key], 'talk-a');
    await talkAndApply(hong, b, steps[b.process_key], 'talk-b');

    // 다시 식별 — 묶음 키·필수 확정이 그대로다
    const again = await openScreen(hong);
    for (const g of [a, b]) {
        const now = again.find((x) => x.process_key === g.process_key);
        expect(now, `${g.name} 묶음 키가 바뀌었다`).toBeTruthy();
        expect(now!.core_activities).toContain(steps[g.process_key]);
        expect(now!.cases.length).toBe(g.cases.length);
        await pick(hong, g.process_key);
        await expect(hong.locator(`.e2e-step[data-step="${steps[g.process_key]}"]`)).toHaveAttribute('data-kind', 'required');
        await shot(hong, `talk-reload-${g === a ? 'a' : 'b'}`);
    }
});
