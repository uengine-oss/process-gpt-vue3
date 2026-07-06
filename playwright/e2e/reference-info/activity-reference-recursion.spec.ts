import { expect, test } from '@playwright/test';

/**
 * 액티비티 참조정보(참조할 폼 선택)에서 이전 태스크 폼을 선택할 때
 * inputData ↔ selectedForms 재귀 갱신 루프("Maximum recursive updates exceeded")가
 * 발생하지 않는지 검증하는 headed 재현 테스트.
 *
 * 실행: npx playwright test reference-info/activity-reference-recursion --headed
 */

const BASE = process.env.BASE_URL || 'http://localhost:8088';
const DEF_ID = process.env.REF_DEF_ID || 'e3996a73-aefc-42de-9c24-42d1a66e7404';
const LOGIN_ID = process.env.REF_LOGIN_ID || 'jaeh@uengine.org';
const LOGIN_PW = process.env.REF_LOGIN_PW || '@wkdwo56322';
// 참조정보를 설정할 액티비티 이름 (게이트웨이 X, 유저태스크 O)
const ACTIVITY_NAME = process.env.REF_ACTIVITY_NAME || '최종 산출물 및 결과 알림';

test('activity reference form selection has no recursive-update error', async ({ page }) => {
    test.setTimeout(180_000);
    const recursiveErrors: string[] = [];
    const allErrors: string[] = [];

    page.on('console', (msg) => {
        if (msg.type() === 'error' || msg.type() === 'warning') {
            const text = msg.text();
            allErrors.push(`[${msg.type()}] ${text}`);
            if (/recursive updates|Maximum recursive/i.test(text)) {
                recursiveErrors.push(text);
            }
        }
    });
    page.on('pageerror', (err) => {
        allErrors.push(`[pageerror] ${err.message}`);
        if (/recursive updates|Maximum recursive/i.test(err.message)) {
            recursiveErrors.push(err.message);
        }
    });

    const t0 = Date.now();
    const step = (m: string) => console.log(`[+${((Date.now() - t0) / 1000).toFixed(1)}s] ${m}`);

    // 1) 로그인
    await page.goto(`${BASE}/auth/login`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    step('login page loaded');
    await page.locator('.cp-id input').waitFor({ timeout: 20_000 });
    // Vue 앱 하이드레이션 대기 (핸들러 바인딩 전 클릭 방지)
    await page.waitForTimeout(2500);
    await page.locator('.cp-id input').fill(LOGIN_ID);
    await page.locator('.pwdInput input').fill(LOGIN_PW);
    // "이 장치에 기억" 체크 → 토큰이 localStorage에 영속되어 full-page goto 후에도 세션 유지
    const remember = page.getByRole('checkbox').first();
    if ((await remember.count()) > 0 && !(await remember.isChecked())) {
        await remember.check({ timeout: 5_000 }).catch(() => undefined);
    }
    step('form filled');

    // 로그인 시도(최대 4회): 검증된 로그인 버튼 클릭 → 실패 시 Enter 제출
    let loggedIn = false;
    for (let attempt = 0; attempt < 4 && !loggedIn; attempt++) {
        const btn = page.getByRole('button', { name: /로그인|login/i }).first();
        if (await btn.count()) {
            await btn.click({ timeout: 5_000 }).catch(() => undefined);
        }
        await page.locator('.pwdInput input').press('Enter').catch(() => undefined);
        loggedIn = await page
            .waitForFunction(() => !/\/auth\/login/.test(location.pathname), { timeout: 10_000 })
            .then(() => true)
            .catch(() => false);
        step(`login attempt ${attempt + 1} -> loggedIn=${loggedIn}`);
    }
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'playwright/test-results/ref-00-afterlogin.png', fullPage: true });
    expect(loggedIn, 'login did not leave /auth/login').toBeTruthy();

    // 2) 정의 편집 화면으로 이동
    await page.goto(`${BASE}/definitions/${DEF_ID}?edit=true`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    step('definitions page goto done');
    // 캔버스의 실제 bpmn 노드들이 그려질 때까지 대기 (루트 요소는 hidden일 수 있어 개수로 판단)
    await page
        .waitForFunction(() => document.querySelectorAll('g.djs-element').length > 3, { timeout: 45_000 })
        .catch(() => undefined);
    step('canvas nodes rendered');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'playwright/test-results/ref-01-loaded.png', fullPage: true });

    // 3) 액티비티 노드 더블클릭 → 속성 패널 오픈
    const nodeTexts = await page.$$eval('g.djs-element', (els) =>
        els.map((el) => ({
            id: el.getAttribute('data-element-id'),
            text: (el.textContent || '').replace(/\s+/g, ' ').trim()
        }))
    );
    console.log('=== djs-element nodes ===');
    nodeTexts.forEach((n) => n.text && console.log(`${n.id} :: ${n.text}`));
    console.log('=========================');

    const target = nodeTexts.find((n) => n.text.includes(ACTIVITY_NAME));
    expect(target, `activity node "${ACTIVITY_NAME}" not found. available: ${JSON.stringify(nodeTexts.filter((n) => n.text))}`).toBeTruthy();

    const node = page.locator(`g.djs-element[data-element-id="${target!.id}"]`);
    await expect(node).toBeVisible({ timeout: 20_000 });
    await node.scrollIntoViewIfNeeded().catch(() => undefined);
    await node.dblclick();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'playwright/test-results/ref-02-panel.png', fullPage: true });

    // 4) 참조정보 탭 클릭
    const refTab = page.getByRole('tab', { name: /참조\s*정보|reference/i }).first();
    await expect(refTab, '참조정보 tab not found').toBeVisible({ timeout: 15_000 });
    await refTab.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'playwright/test-results/ref-03-reftab.png', fullPage: true });

    // 5) "참조할 폼 선택" 드롭다운 열기
    const select = page.locator('.v-select', { hasText: /참조할 폼|select form/i }).first();
    await expect(select, 'reference form select not found').toBeVisible({ timeout: 15_000 });
    await select.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'playwright/test-results/ref-04-dropdown.png', fullPage: true });

    // 6) 드롭다운의 모든 폼 항목 선택 (a, b, c ...)
    const options = page.locator('.v-overlay .v-list-item');
    const optionCount = await options.count();
    step(`dropdown options=${optionCount}`);
    expect(optionCount, 'no form option in dropdown').toBeGreaterThan(0);
    for (let i = 0; i < optionCount; i++) {
        await options.nth(i).click();
        await page.waitForTimeout(300);
    }
    // 드롭다운 닫기
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1200);
    await page.screenshot({ path: 'playwright/test-results/ref-05-selected.png', fullPage: true });

    // 선택된 폼 카드 수 (template: v-card v-for="formId in selectedForms")
    const formCards = page.locator('.v-window-item--active .v-card');
    const cardsBefore = await formCards.count();
    step(`selected form cards before field check=${cardsBefore}`);

    // 7) 첫 번째 폼의 첫 번째 필드 체크 → 나머지 선택 폼이 사라지면 안 됨
    if (cardsBefore >= 2) {
        const firstFieldCheckbox = formCards.first().locator('.v-checkbox input[type="checkbox"]').first();
        await firstFieldCheckbox.check({ force: true });
        await page.waitForTimeout(2000);
        await page.screenshot({ path: 'playwright/test-results/ref-06-after-field-check.png', fullPage: true });

        const cardsAfter = await formCards.count();
        step(`selected form cards after field check=${cardsAfter}`);
        expect(
            cardsAfter,
            `필드 체크 후 선택된 폼이 사라짐: before=${cardsBefore}, after=${cardsAfter}`
        ).toBeGreaterThanOrEqual(cardsBefore);
    } else {
        step(`선택 가능한 폼이 ${cardsBefore}개뿐이라 다중폼 유지 검증은 스킵 (재귀 에러 검증만 수행)`);
    }

    // 8) 검증: 재귀 갱신 에러가 없어야 함
    console.log('--- captured console errors/warnings ---');
    allErrors.forEach((e) => console.log(e));
    console.log('----------------------------------------');

    expect(
        recursiveErrors,
        `Recursive update error detected:\n${recursiveErrors.join('\n')}`
    ).toHaveLength(0);
});
