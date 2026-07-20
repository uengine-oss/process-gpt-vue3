// Strategy Board 매뉴얼 시연: 실제 휴가신청 프로세스 실행 → 완료 → 설문 → KPI 수집
//
// 기존 E2E(strategy-board.spec.ts)와 달리 인스턴스를 DB 시드가 아니라
// **실제 completion/polling 엔진**으로 실행한다. 각 단계에서 매뉴얼용
// 풀페이지 스크린샷(m01~m09)을 results-manual/ 에 저장한다.
import { expect, test, type Page } from '@playwright/test';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHOT_DIR = path.resolve(__dirname, 'results-manual');
fs.mkdirSync(SHOT_DIR, { recursive: true });

const EMAIL = process.env.E2E_USER || 'strategy-e2e@uengine.org';
const PASSWORD = process.env.E2E_PASS || 'e2epassword';
const INST_ID = 'leave_request_process.manual-demo-2';

test.use({ locale: 'ko-KR', viewport: { width: 1600, height: 1000 } });

function psql(sql: string): string {
    return execSync('docker exec -i supabase-db psql -U postgres -d postgres -t -A', {
        input: sql,
        encoding: 'utf-8'
    }).trim();
}

function shot(page: Page, name: string) {
    return page.screenshot({ path: path.join(SHOT_DIR, `${name}.png`), fullPage: false });
}

async function login(page: Page) {
    await page.context().clearCookies();
    await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.cp-id input')).toBeVisible({ timeout: 30_000 });
    await page.locator('.cp-id input').fill(EMAIL);
    await page.locator('.cp-pwd input').fill(PASSWORD);
    await page.locator('.cp-login').click();
    await expect(page).not.toHaveURL(/\/auth\/login/, { timeout: 60_000 });
}

const dialog = (page: Page) => page.locator('.v-overlay--active .v-card').last();

async function selectOption(page: Page, label: string, optionText: string) {
    await dialog(page).locator('.v-select, .v-autocomplete').filter({ hasText: label }).first().click();
    await page.locator('.v-overlay .v-list-item').filter({ hasText: optionText }).first().click();
    await page.locator('.v-overlay.v-menu').waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
}

// SPA-origin fetch 로 completion 엔진 호출 (실행 다이얼로그가 발화하는 것과 동일 경로)
async function completeActivity(page: Page, input: Record<string, any>) {
    return page.evaluate(async (body) => {
        const res = await fetch('/completion/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ input: body })
        });
        return res.json();
    }, input);
}

async function waitForDb(page: Page, sql: string, expected: string, timeoutMs: number, label: string) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (psql(sql) === expected) return;
        await page.waitForTimeout(5000);
    }
    throw new Error(`timeout waiting for: ${label}`);
}

test('매뉴얼 시연: 휴가신청 프로세스 실제 실행 → 설문 → KPI 수집', async ({ page }) => {
    test.setTimeout(480_000);

    await login(page);

    // ---- m01. 전략보드 전체 화면 -----------------------------------
    await page.goto('/strategy-board', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Strategy Board' })).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(1500);
    await shot(page, 'm01-strategy-board');

    // ---- m02~m03. 실제 프로세스에 연결된 설문 KPI 생성 (AI 추천) ----
    await page.locator('.objective-card').filter({ hasText: '고객 만족도 향상' }).first().click();
    await expect(page.locator('.detail-panel')).toBeVisible();

    await page.locator('.detail-panel').getByRole('button', { name: 'KPI 추가' }).click();
    await dialog(page).getByLabel('이름').fill('휴가신청 처리 만족도');
    await dialog(page).getByLabel('설명').fill('휴가신청 프로세스 완료 후 신청자/승인자 만족도');
    await selectOption(page, '측정 방식', '설문 점수');
    await dialog(page).getByRole('button', { name: 'AI 추천' }).click();
    await expect(dialog(page).getByText('AI 추천 프로세스')).toBeVisible({ timeout: 60_000 });
    await shot(page, 'm02-kpi-ai-suggest');

    const candidateChip = dialog(page).locator('.v-alert .v-chip').filter({ hasText: '휴가신청 프로세스' });
    if ((await candidateChip.count()) > 0) {
        await candidateChip.first().click();
    } else {
        await selectOption(page, '연관 프로세스 정의', '휴가신청 프로세스');
    }
    const questionInputs = dialog(page).locator('input[placeholder^="Q"]');
    if ((await questionInputs.count()) === 0) {
        await dialog(page).getByRole('button', { name: '문항 추가' }).click();
        await dialog(page).locator('input[placeholder^="Q"]').first().fill('휴가신청 처리 결과에 만족하십니까?');
    }
    await dialog(page).getByLabel('기준선').fill('0');
    await dialog(page).getByLabel('목표치').fill('4.5');
    await dialog(page).getByRole('button', { name: '저장' }).click();
    await expect(page.locator('.detail-panel').getByText('휴가신청 처리 만족도')).toBeVisible({ timeout: 15_000 });

    // 정량 KPI (완료 건수) 도 함께 연결
    await page.locator('.detail-panel').getByRole('button', { name: 'KPI 추가' }).click();
    await dialog(page).getByLabel('이름').fill('휴가신청 완료 건수');
    await selectOption(page, '측정 방식', '완료 건수');
    await selectOption(page, '연관 프로세스 정의', '휴가신청 프로세스');
    await dialog(page).getByLabel('단위').fill('건');
    await dialog(page).getByLabel('기준선').fill('0');
    await dialog(page).getByLabel('목표치').fill('10');
    await dialog(page).getByRole('button', { name: '저장' }).click();
    await expect(page.locator('.detail-panel').getByText('휴가신청 완료 건수')).toBeVisible({ timeout: 15_000 });
    await shot(page, 'm03-kpi-created');

    // ---- 실제 프로세스 실행 (completion 엔진) -----------------------
    const startResult = await completeActivity(page, {
        process_instance_id: INST_ID,
        process_definition_id: 'leave_request_process',
        activity_id: 'apply_leave_activity',
        chat_room_id: INST_ID,
        role_mappings: [
            { name: '직원', endpoint: EMAIL, default: EMAIL },
            { name: '상사', endpoint: EMAIL, default: EMAIL }
        ],
        answer: '',
        form_values: { 휴가신청서: { 휴가종류: '연차', 기간: '2026-07-10 ~ 2026-07-11', 사유: '개인 사유로 연차를 신청합니다.' } },
        tenant_id: 'localhost',
        email: EMAIL
    });
    expect(startResult.proc_inst_id).toBe(INST_ID);

    // 폴링 엔진이 첫 활동을 완료 판정하고 승인 활동을 생성할 때까지 대기
    await waitForDb(
        page,
        `select status from todolist where proc_inst_id='${INST_ID}' and activity_id='review_leave_activity';`,
        'IN_PROGRESS',
        180_000,
        '승인 활동 생성'
    );

    // ---- m04. 실제 워크아이템(승인) 화면 ----------------------------
    const reviewTaskId = psql(`select id from todolist where proc_inst_id='${INST_ID}' and activity_id='review_leave_activity';`);
    await page.goto(`/todolist/${reviewTaskId}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);
    await shot(page, 'm04-workitem-approval');

    // 승인 제출 (실행 UI 와 동일한 SPA 호출)
    await completeActivity(page, {
        task_id: reviewTaskId,
        process_instance_id: INST_ID,
        process_definition_id: 'leave_request_process',
        activity_id: 'review_leave_activity',
        answer: '',
        form_values: { 승인결과: '승인합니다. 좋은 휴가 되세요.' },
        tenant_id: 'localhost',
        email: EMAIL
    });

    // 결과 통보 활동 생성 대기 → 제출 → 인스턴스 완료 대기
    await waitForDb(
        page,
        `select count(*)::text from todolist where proc_inst_id='${INST_ID}' and activity_id='notify_result_activity';`,
        '1',
        180_000,
        '결과 통보 활동 생성'
    );
    const notifyTaskId = psql(`select id from todolist where proc_inst_id='${INST_ID}' and activity_id='notify_result_activity';`);
    await completeActivity(page, {
        task_id: notifyTaskId,
        process_instance_id: INST_ID,
        process_definition_id: 'leave_request_process',
        activity_id: 'notify_result_activity',
        answer: '',
        form_values: { 결과확인: '결과를 확인했습니다.' },
        tenant_id: 'localhost',
        email: EMAIL
    });
    await waitForDb(
        page,
        `select status from bpm_proc_inst where proc_inst_id='${INST_ID}';`,
        'COMPLETED',
        240_000,
        '인스턴스 완료'
    );

    // ---- 설문 자동 발행 대기 (완료 감시자) --------------------------
    await page.request.post('/strategy-service/api/measure/run');
    const deadline = Date.now() + 90_000;
    let requestId = '';
    while (Date.now() < deadline) {
        requestId = psql(`select id from strategy_survey_requests where proc_inst_id='${INST_ID}' limit 1;`);
        if (requestId) break;
        await page.request.post('/strategy-service/api/measure/run');
        await page.waitForTimeout(5000);
    }
    expect(requestId, '프로세스 완료 시 설문이 자동 발행되어야 함').toBeTruthy();

    // ---- m05. 할 일 목록에 설문 워크아이템 --------------------------
    await page.goto('/todolist', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/설문: 휴가신청 처리 만족도/).first()).toBeVisible({ timeout: 30_000 });
    await shot(page, 'm05-todolist-survey');

    // ---- m06~m07. 설문 응답 -----------------------------------------
    await page.goto(`/todolist/${requestId}`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(new RegExp(`/strategy/surveys/${requestId}`), { timeout: 30_000 });
    await expect(page.getByText('프로세스 만족도 설문')).toBeVisible({ timeout: 15_000 });
    await shot(page, 'm06-survey-form');

    const ratings = page.locator('.v-rating');
    const ratingCount = await ratings.count();
    for (let i = 0; i < ratingCount; i++) {
        await ratings.nth(i).locator('.v-rating__item').nth(i === 0 ? 4 : 3).click();
    }
    await page.locator('input[placeholder*="의견"]').first().fill('처리가 빨라서 만족합니다.').catch(() => {});
    await page.getByRole('button', { name: '제출' }).click();
    await expect(page.getByText('응답해 주셔서 감사합니다')).toBeVisible({ timeout: 15_000 });
    await shot(page, 'm07-survey-done');

    // ---- m08. 전략보드에 실적 반영 -----------------------------------
    await page.goto('/strategy-board', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: '측정 갱신' }).click();
    await expect(page.getByText(/측정 완료/)).toBeVisible({ timeout: 30_000 });
    await page.locator('.objective-card').filter({ hasText: '고객 만족도 향상' }).first().click();
    await expect(page.locator('.detail-panel').getByText(/\/ 4\.5/).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('.detail-panel').getByText('1 / 10').first()).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(1000);
    await shot(page, 'm08-kpi-collected');

    // ---- m09. KPI 대시보드 전략 목표달성도 ---------------------------
    await page.goto('/analytics/kpi', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-testid="strategy-achievement-card"]')).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(1500);
    await shot(page, 'm09-dashboard-achievement');
});
