// Strategy Board (BSC 전략맵 · KPI · 이니셔티브 · 설문 성과수집) E2E
//
// 사전 조건:
//   - strategy 서비스 기동 (:8014, compose service `strategy`)
//   - 프론트 dev 서버 (BASE_URL, vite proxy /strategy-service -> :8014)
//   - 시드: strategy-e2e@uengine.org / e2epassword (scratchpad/strategy_e2e_seed.sql)
//
// 커버리지:
//   [UI]   전략목표 CRUD + 관점 레인 + 상위목표 연결선(SVG)
//   [정량] instance_count KPI: 완료 인스턴스 주입 -> 측정 갱신 -> 달성률 반영
//   [AI]   KPI 다이얼로그 AI 추천(프로세스 후보 + 설문 문항 자동 생성)
//   [정성] survey_score KPI: 프로세스 완료 -> 설문 워크아이템 발행 -> /todolist/<id>
//          리다이렉트 -> 별점 응답 -> KPI 점수/달성률 반영
//   [대시보드] /analytics/kpi 의 전략 목표달성도 카드
import { expect, test, type Page } from '@playwright/test';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHOT_DIR = path.resolve(__dirname, 'results');
fs.mkdirSync(SHOT_DIR, { recursive: true });

const EMAIL = process.env.E2E_USER || 'strategy-e2e@uengine.org';
const PASSWORD = process.env.E2E_PASS || 'e2epassword';

test.use({ locale: 'ko-KR', viewport: { width: 1600, height: 1000 } });

function psql(sql: string): string {
    return execSync('docker exec -i supabase-db psql -U postgres -d postgres -t -A', {
        input: sql,
        encoding: 'utf-8'
    }).trim();
}

function shot(page: Page, name: string) {
    return page.screenshot({ path: path.join(SHOT_DIR, `${name}.png`), fullPage: true });
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

async function selectOption(page: Page, label: string, optionText: string, multiple = false) {
    // Vuetify v-select/v-autocomplete 는 label 이 input 과 aria 연결되지 않으므로
    // 라벨 텍스트를 포함한 필드 래퍼를 직접 클릭해 메뉴를 연다.
    await dialog(page)
        .locator('.v-select, .v-autocomplete')
        .filter({ hasText: label })
        .first()
        .click();
    await page
        .locator('.v-overlay .v-list-item')
        .filter({ hasText: optionText })
        .first()
        .click();
    if (multiple) {
        // multiple select 만 선택 후에도 메뉴가 열려 있으므로 Escape 로 메뉴를 닫는다.
        // 단일 select 는 자동으로 닫히므로 Escape 를 보내면 다이얼로그가 닫혀버린다.
        await page.keyboard.press('Escape');
        await page.locator('.v-overlay.v-menu').waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
    } else {
        await page.locator('.v-overlay.v-menu').waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
    }
}

test.describe.serial('Strategy Board 정량/정성 E2E', () => {
    test('전체 흐름: 전략목표 -> KPI(AI추천) -> 이니셔티브 -> 정량측정 -> 설문응답 -> 달성률', async ({ page }) => {
        test.setTimeout(300_000);

        // ---------------- 로그인 & 보드 진입 -------------------------
        await login(page);
        await page.goto('/strategy-board', { waitUntil: 'domcontentloaded' });
        await expect(page.getByRole('heading', { name: 'Strategy Board' })).toBeVisible({ timeout: 30_000 });
        await shot(page, '01-strategy-board-empty');

        // ---------------- 전략목표 추가 (사용자가 실패했던 시나리오) --
        await page.getByRole('button', { name: '전략목표 추가' }).click();
        await dialog(page).getByLabel('이름').fill('고객 만족도 향상');
        await dialog(page).getByLabel('설명').fill('전자결재 프로세스 처리 만족도를 설문 기반으로 수집');
        await selectOption(page, '관점', '고객');
        await dialog(page).getByRole('button', { name: '저장' }).click();
        await expect(page.locator('.objective-card').filter({ hasText: '고객 만족도 향상' })).toBeVisible({ timeout: 15_000 });
        await shot(page, '02-objective-created');

        // ---------------- 상위목표 연결된 두 번째 목표 + SVG 연결선 --
        await page.getByRole('button', { name: '전략목표 추가' }).click();
        await dialog(page).getByLabel('이름').fill('업무 처리 효율 향상');
        await selectOption(page, '관점', '내부 프로세스');
        await selectOption(page, '상위 전략목표', '고객 만족도 향상', true);
        await dialog(page).getByRole('button', { name: '저장' }).click();
        await expect(page.locator('.objective-card').filter({ hasText: '업무 처리 효율 향상' })).toBeVisible({ timeout: 15_000 });
        await expect(page.locator('svg.edge-layer > path')).toHaveCount(1, { timeout: 15_000 });
        await shot(page, '03-objective-linked-edge');

        // ---------------- 상세 패널 & 정량 KPI 추가 -------------------
        await page.locator('.objective-card').filter({ hasText: '고객 만족도 향상' }).click();
        await expect(page.locator('.detail-panel')).toBeVisible();
        await page.locator('.detail-panel').getByRole('button', { name: 'KPI 추가' }).click();
        await dialog(page).getByLabel('이름').fill('전자결재 완료 건수');
        await selectOption(page, '측정 방식', '완료 건수');
        await selectOption(page, '연관 프로세스 정의', 'E2E 전자결재 프로세스');
        await dialog(page).getByLabel('단위').fill('건');
        await dialog(page).getByLabel('기준선').fill('0');
        await dialog(page).getByLabel('목표치').fill('10');
        await dialog(page).getByRole('button', { name: '저장' }).click();
        await expect(page.locator('.detail-panel').getByText('전자결재 완료 건수')).toBeVisible({ timeout: 15_000 });
        await shot(page, '04-kpi-quantitative');

        // ---------------- 정성 KPI + AI 추천 --------------------------
        await page.locator('.detail-panel').getByRole('button', { name: 'KPI 추가' }).click();
        await dialog(page).getByLabel('이름').fill('전자결재 처리 만족도');
        await dialog(page).getByLabel('설명').fill('전자결재 프로세스 완료 후 요청자 만족도');
        await selectOption(page, '측정 방식', '설문 점수');
        await dialog(page).getByRole('button', { name: 'AI 추천' }).click();
        // LLM 또는 휴리스틱 결과 대기
        await expect(dialog(page).getByText('AI 추천 프로세스')).toBeVisible({ timeout: 60_000 });
        await shot(page, '05-kpi-ai-suggest');

        // 후보가 있으면 자동 적용됐는지 확인, 없으면 수동 선택
        const candidateChip = dialog(page).locator('.v-alert .v-chip').filter({ hasText: 'E2E 전자결재 프로세스' });
        if ((await candidateChip.count()) > 0) {
            await candidateChip.first().click();
        } else {
            await selectOption(page, '연관 프로세스 정의', 'E2E 전자결재 프로세스');
        }
        // 설문 문항이 자동 생성되지 않았으면 수동 추가
        const questionInputs = dialog(page).locator('input[placeholder^="Q"]');
        if ((await questionInputs.count()) === 0) {
            await dialog(page).getByRole('button', { name: '문항 추가' }).click();
            await dialog(page).locator('input[placeholder^="Q"]').first().fill('전자결재 처리 결과에 만족하십니까?');
        }
        await dialog(page).getByLabel('기준선').fill('0');
        await dialog(page).getByLabel('목표치').fill('4.5');
        await dialog(page).getByRole('button', { name: '저장' }).click();
        await expect(page.locator('.detail-panel').getByText('전자결재 처리 만족도')).toBeVisible({ timeout: 15_000 });
        await shot(page, '06-kpi-survey-created');

        // ---------------- 이니셔티브 추가 ------------------------------
        await page.locator('.detail-panel').getByRole('tab', { name: /이니셔티브/ }).click();
        await page.locator('.detail-panel').getByRole('button', { name: '이니셔티브 추가' }).click();
        await dialog(page).getByLabel('이름').fill('전자결재 개선 TF');
        await selectOption(page, '상태', '진행 중');
        await selectOption(page, '연관 프로세스 정의', 'E2E 전자결재 프로세스');
        await dialog(page).getByRole('button', { name: '저장' }).click();
        await expect(page.locator('.detail-panel').getByText('전자결재 개선 TF')).toBeVisible({ timeout: 15_000 });
        await shot(page, '07-initiative-created');

        // ---------------- [정량] 완료 인스턴스 주입 -> 측정 갱신 -------
        psql(`
            insert into public.bpm_proc_inst
                (proc_inst_id, proc_def_id, proc_inst_name, participants, status, tenant_id,
                 start_date, end_date, updated_at, is_deleted)
            values
                ('strategy-e2e.inst1', 'strategy_e2e_process', '[E2E] 전자결재 승인 #1',
                 array['strategy-e2e@uengine.org'], 'COMPLETED', 'localhost',
                 now() - interval '26 hours', now(), now(), false),
                ('strategy-e2e.inst2', 'strategy_e2e_process', '[E2E] 전자결재 승인 #2',
                 array['strategy-e2e@uengine.org'], 'COMPLETED', 'localhost',
                 now() - interval '22 hours', now(), now(), false)
            on conflict (proc_inst_id) do update set updated_at = now(), status = 'COMPLETED';
        `);

        // 상세 패널이 header 버튼을 가리므로 먼저 닫는다
        await page.locator('.detail-panel .mdi-close').first().click();
        await expect(page.locator('.detail-panel')).toBeHidden();
        await page.getByRole('button', { name: '측정 갱신' }).click();
        await expect(page.getByText(/측정 완료/)).toBeVisible({ timeout: 30_000 });

        // 정량 KPI: 완료 2건 / 목표 10건 = 20%
        const detailPanel = page.locator('.detail-panel');
        await page.locator('.objective-card').filter({ hasText: '고객 만족도 향상' }).first().click();
        await detailPanel.getByRole('tab', { name: /KPI/ }).click();
        await expect(detailPanel.getByText('2 / 10')).toBeVisible({ timeout: 30_000 });
        await expect(detailPanel.getByText('20%').first()).toBeVisible();
        await shot(page, '08-quantitative-measured');

        // ---------------- [정성] 설문 워크아이템 발행 확인 -------------
        const requestId = psql(`
            select id from public.strategy_survey_requests
            where respondent_email = 'strategy-e2e@uengine.org'
            order by created_at desc limit 1;
        `);
        expect(requestId, '설문 요청이 생성되어야 함').toBeTruthy();

        const workitemStatus = psql(`
            select status from public.todolist where id = '${requestId}'::uuid;
        `);
        expect(workitemStatus, '설문 워크아이템(todolist)이 발행되어야 함').toBe('IN_PROGRESS');

        // ---------------- 워크아이템 클릭 -> 설문 화면 리다이렉트 -------
        await page.goto(`/todolist/${requestId}`, { waitUntil: 'domcontentloaded' });
        await expect(page).toHaveURL(new RegExp(`/strategy/surveys/${requestId}`), { timeout: 30_000 });
        await expect(page.getByText('프로세스 만족도 설문')).toBeVisible({ timeout: 15_000 });
        await shot(page, '09-survey-redirected');

        // 모든 문항 별점 응답 (첫 문항 5점, 나머지 4점)
        const ratings = page.locator('.v-rating');
        const count = await ratings.count();
        expect(count).toBeGreaterThan(0);
        for (let i = 0; i < count; i++) {
            await ratings.nth(i).locator('.v-rating__item').nth(i === 0 ? 4 : 3).click();
        }
        await page.getByRole('button', { name: '제출' }).click();
        await expect(page.getByText('응답해 주셔서 감사합니다')).toBeVisible({ timeout: 15_000 });
        await shot(page, '10-survey-answered');

        // 워크아이템 DONE 전환 확인
        const doneStatus = psql(`select status from public.todolist where id = '${requestId}'::uuid;`);
        expect(doneStatus).toBe('DONE');

        // ---------------- 설문 점수 -> KPI 달성률 반영 -----------------
        await page.goto('/strategy-board', { waitUntil: 'domcontentloaded' });
        await page.getByRole('button', { name: '측정 갱신' }).click();
        await expect(page.getByText(/측정 완료/)).toBeVisible({ timeout: 30_000 });
        await page.locator('.objective-card').filter({ hasText: '고객 만족도 향상' }).first().click();

        // 설문 KPI 실적: 문항 1개면 5.0, 여러 개면 4.x — "/ 4.5" 목표 대비 표기 확인
        await expect(page.locator('.detail-panel').getByText(/\/ 4\.5/)).toBeVisible({ timeout: 30_000 });
        // 목표 카드에 종합 달성률 게이지 표시
        await expect(
            page.locator('.objective-card').filter({ hasText: '고객 만족도 향상' }).getByRole('progressbar')
        ).toBeVisible();
        await shot(page, '11-survey-score-reflected');
    });

    test('할 일 목록에 설문 워크아이템 노출', async ({ page }) => {
        // 두 번째 수신 설문(응답 전) 또는 응답 완료 항목이 목록에 보이는지 확인
        await login(page);
        await page.goto('/todolist', { waitUntil: 'domcontentloaded' });
        await expect(page.getByText(/설문: 전자결재 처리 만족도/).first()).toBeVisible({ timeout: 30_000 });
        await shot(page, '12-todolist-survey-item');
    });

    test('KPI 대시보드에 전략 목표달성도 표시', async ({ page }) => {
        await login(page);
        await page.goto('/analytics/kpi', { waitUntil: 'domcontentloaded' });
        const card = page.locator('[data-testid="strategy-achievement-card"]');
        await expect(card).toBeVisible({ timeout: 30_000 });
        await expect(card.getByText('전략 목표달성도')).toBeVisible();
        await expect(card.getByText('고객 만족도 향상')).toBeVisible();
        await expect(card.getByText(/%/).first()).toBeVisible();
        await shot(page, '13-dashboard-strategy-achievement');
    });
});
