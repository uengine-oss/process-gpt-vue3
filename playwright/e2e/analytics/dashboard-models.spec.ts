import { test, expect } from '@playwright/test';

const base = process.env.DASHBOARD_TEST_URL || 'http://127.0.0.1:5173';
const analytics = {
    system_map: [], project_map: [], heatmap: [],
    task_types: [{ task_type: 'task', total_count: 3 }, { task_type: 'service', total_count: 1 }],
    task_ratio: [{ name: '구매 프로세스', proc_def_id: 'purchase', domain: '미분류', tasks: { task: 3, service: 1 }, automation_score: 25 }],
    automation_score: { overall: 25, total_count: 4, by_domain: [] }, top_n: {},
    model_summary: { process_count: 1, task_count: 4, role_assigned_count: 0, system_mapped_count: 0 }
};
const quality = {
    asset_status: [], version_top: [], dq_scores: [{ field_key: 'overall', label: '입력 충실도 평균', score: null }],
    grammar_errors: [],
    validation_summary: { total_count: 1, checked_count: 1, valid_count: 1, unchecked_count: 0, error_process_count: 0 }
};

test('saved task types and automatic share render with authenticated requests', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/completion/dashboard/process-analytics*', async route => {
        expect(route.request().headers().authorization).toBe('Bearer dashboard-test-session');
        await route.fulfill({ json: analytics });
    });
    await page.goto(`${base}/playwright/fixtures/analytics-dashboard.html?view=process`);
    await expect(page.getByText('일반 Task', { exact: true })).toBeVisible();
    await expect(page.getByText('구매 프로세스', { exact: true })).toBeVisible();
    await expect(page.locator('.automation-overall')).toContainText('25%');
    await expect(page.locator('.ratio-col-auto .progress-fill')).toHaveAttribute('style', /width: 25%/);
    await expect(page.getByText('Task에 역할을 지정하면 역할별 분포가 표시됩니다.')).toBeVisible();
    expect(errors).toEqual([]);
});

test('no issues is distinguished from missing measurements', async ({ page }) => {
    await page.route('**/completion/dashboard/governance-quality*', route => route.fulfill({ json: quality }));
    await page.goto(`${base}/playwright/fixtures/analytics-dashboard.html?view=quality`);
    await expect(page.getByText('검사한 순서도에서 구조 오류가 발견되지 않았습니다.')).toBeVisible();
    await expect(page.locator('.dq-gauge-inner strong')).toHaveText('미집계');
    await expect(page.getByText('검사 1개 · 통과 1개 · 순서도 미등록 0개')).toBeVisible();
});

test('invalid model links to the process and displays element diagnostics', async ({ page }) => {
    await page.route('**/completion/dashboard/governance-quality*', route => route.fulfill({ json: {
        ...quality,
        validation_summary: { ...quality.validation_summary, valid_count: 0, error_process_count: 1 },
        grammar_errors: [{ proc_def_id: 'broken', proc_def_name: '연결 오류 프로세스', error_count: 1, primary_error_type: '연결 참조 오류',
            last_checked_at: '2026-09-08T00:00:00Z', status: '수정 필요', issues: [{ element_id: 'flow1', message: '도착 요소가 없습니다.' }] }]
    } }));
    await page.goto(`${base}/playwright/fixtures/analytics-dashboard.html?view=quality`);
    await expect(page.getByRole('link', { name: '연결 오류 프로세스' })).toHaveAttribute('href', '/definitions/broken');
    await page.getByText('검사 상세').click();
    await expect(page.getByText('flow1: 도착 요소가 없습니다.')).toBeVisible();
});

test('operational model summary and search use model counts', async ({ page }) => {
    await page.route('**/completion/dashboard/process-analytics*', route => route.fulfill({ json: analytics }));
    await page.goto(`${base}/playwright/fixtures/analytics-dashboard.html?view=operational`);
    await expect(page.getByRole('link', { name: '구매 프로세스' })).toBeVisible();
    await expect(page.getByText('4개', { exact: true })).toBeVisible();
    await page.getByLabel('프로세스 검색').fill('해당없음');
    await expect(page.getByText('검색 결과가 없습니다.')).toBeVisible();
});
