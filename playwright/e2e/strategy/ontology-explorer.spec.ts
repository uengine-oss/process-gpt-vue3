// 온톨로지 탐색기(애널리틱스 융합) 스모크 E2E
//   - 로그인 -> /analytics/ontology
//   - cytoscape 캔버스 + 실노드 > 15, 계층(수익 극대화 root 최상단) 검증
//   - 3개 탭(그래프/영향도/개선점) 스크린샷
//   - 노드 클릭 -> 우측 상세 패널
//   - 딥링크(프로세스 정의 편집) -> /definitions/... 착지
import { expect, test, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHOT_DIR = path.resolve(__dirname, 'results-ontology');
fs.mkdirSync(SHOT_DIR, { recursive: true });

const EMAIL = process.env.E2E_USER || 'strategy-e2e@uengine.org';
const PASSWORD = process.env.E2E_PASS || 'e2epassword';

test.use({ locale: 'ko-KR', viewport: { width: 1600, height: 1000 } });

const shot = (page: Page, name: string) => page.screenshot({ path: path.join(SHOT_DIR, `${name}.png`), fullPage: true });

async function login(page: Page) {
    await page.context().clearCookies();
    await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.cp-id input')).toBeVisible({ timeout: 30_000 });
    await page.locator('.cp-id input').fill(EMAIL);
    await page.locator('.cp-pwd input').fill(PASSWORD);
    await page.locator('.cp-login').click();
    await expect(page).not.toHaveURL(/\/auth\/login/, { timeout: 60_000 });
}

async function clickCyNode(page: Page, nodeId: string) {
    // cytoscape 캔버스 위 노드는 픽셀 좌표 클릭이 불안정하므로 컴포넌트 선택 훅을 직접 호출한다.
    await page.evaluate((id) => (window as any).$ontologySelect(id), nodeId);
}

test('온톨로지 탐색기 스모크', async ({ page }) => {
    test.setTimeout(180_000);
    const consoleErrors: string[] = [];
    page.on('console', (m) => {
        if (m.type() === 'error') consoleErrors.push(m.text());
    });

    await login(page);
    await page.goto('/analytics/ontology', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: '기업 운영 온톨로지' })).toBeVisible({ timeout: 30_000 });

    // cytoscape 준비 + 실노드 수 > 15
    await expect
        .poll(async () => page.evaluate(() => (window as any).$cyOntology?.()?.nodes('[!isGroup]')?.length || 0), {
            timeout: 30_000
        })
        .toBeGreaterThan(15);

    // 계층 검증: '수익 극대화'(root 전략)가 모든 전략 노드 중 y 최상단
    const rootIsTop = await page.evaluate(() => {
        const cy = (window as any).$cyOntology();
        const strat = cy.nodes('[!isGroup]').filter((n: any) => n.data('label') === 'Strategy');
        let rootY = Infinity;
        let minY = Infinity;
        strat.forEach((n: any) => {
            const y = n.position('y');
            if (y < minY) minY = y;
            if (n.data('name') === '수익 극대화') rootY = y;
        });
        return rootY === minY;
    });
    expect(rootIsTop, "'수익 극대화' 루트 전략이 최상단이어야 함").toBeTruthy();

    await page.waitForTimeout(600);
    await shot(page, '01-graph-tab');

    // 노드 클릭 -> 상세 패널 (KPI 노드: 연매출액)
    const kpiId = await page.evaluate(() => {
        const cy = (window as any).$cyOntology();
        const k = cy.nodes('[!isGroup]').filter((n: any) => n.data('name') === '연매출액');
        return k.length ? k[0].id() : null;
    });
    expect(kpiId).toBeTruthy();
    await clickCyNode(page, kpiId!);
    await expect(page.locator('.detail-card').getByText('연매출액')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.detail-card').getByRole('button', { name: '영향도 분석' })).toBeVisible();
    await page.waitForTimeout(400);
    await shot(page, '02-node-detail-panel');

    // 딥링크: Process 노드 클릭 -> '프로세스 정의 편집' -> /definitions/...
    const procId = await page.evaluate(() => {
        const cy = (window as any).$cyOntology();
        const p = cy.nodes('[!isGroup]').filter((n: any) => n.data('label') === 'Process');
        return p.length ? p[0].id() : null;
    });
    expect(procId).toBeTruthy();
    await clickCyNode(page, procId!);
    await expect(page.locator('.detail-card').getByRole('button', { name: '프로세스 정의 편집' })).toBeVisible({ timeout: 10_000 });
    await page.locator('.detail-card').getByRole('button', { name: '프로세스 정의 편집' }).click();
    await expect(page).toHaveURL(/\/definitions\//, { timeout: 20_000 });
    await page.waitForTimeout(1500);
    await shot(page, '03-deeplink-definitions');

    // 영향도 분석 탭
    await page.goto('/analytics/ontology?tab=impact', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: '기업 운영 온톨로지' })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('원인 후보 랭킹')).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(500);
    await shot(page, '04-impact-tab');

    // 전략 개선점 탭
    await page.getByRole('tab', { name: '전략 개선점' }).click();
    await expect(page.getByText('스킬 개선 후보')).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(500);
    await shot(page, '05-improve-tab');

    // 콘솔 에러 확인 — 온톨로지 뷰(OntologyExplorer / cytoscape / strategy-service) 관련만 검사.
    // getUserInfo/supabase/credit/스킬 목록 등은 백엔드 게이트웨이 미기동으로 인한 기존 환경 노이즈라 제외.
    const IGNORE =
        /favicon|ResizeObserver|net::ERR|getUserInfo|supabase|Failed to fetch|get_credit_balance|스킬 목록|Failed to load resource|PGRST|BackendFactory|ProcessGPTBackend|SidebarUserList|ChatList|ExtraBox|Target service has some problem|정보: mounted hook|컴포넌트: Proxy|예상치 못한 에러|애플리케이션 계속 진행/i;
    const meaningful = consoleErrors.filter((e) => !IGNORE.test(e));
    console.log('CONSOLE_ERRORS', JSON.stringify(meaningful, null, 2));
    expect(meaningful, '온톨로지 뷰 관련 콘솔 에러 없어야 함').toEqual([]);
});
