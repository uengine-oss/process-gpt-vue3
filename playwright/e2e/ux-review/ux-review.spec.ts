/**
 * 2026-11-09 · 11-10 사용성 검토 반영 회귀 묶음 (F-UX-01 ~ F-UX-16)
 *
 * 실제 백엔드(설치본)에 붙은 프런트를 화면으로 밟는다. 업무(todolist)에 쓰는 요청은 모두 가로채
 * 내용만 확인하므로 데이터는 바뀌지 않는다.
 *
 * 실행 (VM 설치본 예):
 *   UX_BASE_URL=http://127.0.0.1:5291 UX_HOST_MAP="MAP localhost 192.168.64.3" \
 *   UX_ACCOUNTS=~/.config/pgtut/local-accounts.json UX_TASK_ID=<담당자=minji, 시작자≠seoyeon 인 업무 id> \
 *   npx playwright test playwright/e2e/ux-review
 *
 * 계정 파일: { admin: {email,password}, minji: {...}, seoyeon: {...} } — admin 은 관리자, minji 는 업무 담당자,
 * seoyeon 은 관리자도 담당자도 시작자도 아닌 같은 조직 사람.
 */
import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';

const BASE = process.env.UX_BASE_URL || 'http://127.0.0.1:5291';
const ACCOUNTS_PATH = (process.env.UX_ACCOUNTS || '~/.config/pgtut/local-accounts.json').replace(/^~/, os.homedir());
const TASK_ID = process.env.UX_TASK_ID || '';
const accounts = fs.existsSync(ACCOUNTS_PATH) ? JSON.parse(fs.readFileSync(ACCOUNTS_PATH, 'utf8')) : null;

test.use({
    viewport: { width: 1440, height: 900 },
    locale: 'ko-KR',
    launchOptions: {
        args: process.env.UX_HOST_MAP ? [`--host-resolver-rules=${process.env.UX_HOST_MAP}`] : [],
        executablePath: process.env.UX_CHROMIUM || undefined
    }
});
test.skip(!accounts, `계정 파일이 없습니다: ${ACCOUNTS_PATH}`);

async function login(page: Page, who: 'admin' | 'minji' | 'seoyeon') {
    const a = accounts[who];
    await page.goto(`${BASE}/auth/login`);
    await page.locator('input[type="password"]').waitFor({ timeout: 30_000 });
    await page.locator('input[type="text"], input[type="email"]').first().fill(a.email);
    await page.locator('input[type="password"]').first().fill(a.password);
    await page.locator('button').filter({ hasText: /^\s*(로그인|Sign In|Log In|Login)\s*$/i }).first().click();
    await page.waitForURL((u) => !u.pathname.startsWith('/auth/'), { timeout: 45_000 });
}

/** 업무 행에 쓰는 요청은 막고 본문만 모은다 */
async function trapTodoWrites(page: Page) {
    const writes: any[] = [];
    await page.route(/\/rest\/v1\/todolist/, (route) => {
        const req = route.request();
        if (req.method() === 'GET' || req.method() === 'HEAD') return route.continue();
        writes.push({ method: req.method(), body: req.postDataJSON() });
        return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
    });
    return writes;
}

const SECTIONS = ['sidebar-chats', 'sidebar-instances', 'sidebar-agents', 'sidebar-users', 'sidebar-skills', 'sidebar-processes'];

test('F-UX-01 로그인하면 정의 체계도(입력창이 있는 첫 화면)로 간다', async ({ page }) => {
    await login(page, 'admin');
    await expect(page).toHaveURL(/\/definition-map/);
});

test('F-UX-02 사이드바 구역 머리에는 🔍 검색과 ＋ 추가 두 단추만 있다', async ({ page }) => {
    await login(page, 'admin');
    for (const id of SECTIONS) {
        const header = page.getByTestId(id);
        await expect(header, id).toBeVisible();
        await expect(header.locator('.sidebar-title-icon'), id).toHaveCount(2);
        await expect(page.getByTestId(`${id}-search`), id).toHaveCount(1);
        await expect(page.getByTestId(`${id}-add`), id).toHaveCount(1);
    }
});

test('F-UX-03 구역별 ＋ · 🔍 는 정해진 화면으로 간다', async ({ page }) => {
    await login(page, 'admin');
    const cases: [string, RegExp][] = [
        ['sidebar-instances-add', /\/definition-map$/],
        ['sidebar-instances-search', /\/list-pages\/completed$/],
        ['sidebar-agents-add', /\/organization$/],
        ['sidebar-users-add', /\/account-settings\?tab=ManageAccess$/],
        ['sidebar-skills-add', /\/skills$/],
        ['sidebar-processes-add', /\/definitions\/chat$/],
        ['sidebar-processes-search', /\/definition-map$/]
    ];
    for (const [tid, url] of cases) {
        await page.goto(`${BASE}/definition-map`);
        await page.getByTestId(tid).scrollIntoViewIfNeeded();
        await page.getByTestId(tid).click();
        await expect(page, tid).toHaveURL(url);
    }
});

test('F-UX-04 대화목록 ＋ 는 이름 · 참여자 창 없이 첫 화면 입력창에 커서를 둔다', async ({ page }) => {
    await login(page, 'admin');
    await page.goto(`${BASE}/skills`);
    await page.getByTestId('sidebar-chats-add').click();
    await expect(page).toHaveURL(/\/definition-map$/);
    await expect(page.getByText('채팅방 이름')).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest('.main-chat-input-container'))).toBe(true);
});

test('F-UX-05 관리 화면은 상단 「관리」 메뉴에 모여 있고 관리자에게만 보인다', async ({ page, browser }) => {
    await login(page, 'admin');
    await page.getByTestId('header-manage-menu').click();
    await expect(page.locator('.v-overlay--active .v-list-item')).toHaveText(['프로세스 체계도', '조직도 · 에이전트', '스킬 관리', '완료된 인스턴스']);
    await page.getByTestId('header-manage-process-architecture').click();
    await expect(page).toHaveURL(/\/process-architecture$/);

    const other = await browser.newPage();
    await login(other, 'seoyeon');
    await expect(other.getByTestId('header-manage-menu')).toHaveCount(0);
    await expect(other.getByTestId('sidebar-users-add')).toHaveCount(0);
    await other.close();
});

test.describe('남의 업무', () => {
    test.skip(!TASK_ID, 'UX_TASK_ID 가 필요합니다');

    test('F-UX-06 다른 참여자는 위임 · 에이전트 맡기기 · 채택을 할 수 없다', async ({ page }) => {
        const writes = await trapTodoWrites(page);
        await login(page, 'seoyeon');
        await page.goto(`${BASE}/todolist/${TASK_ID}`);
        await expect(page.getByRole('tab', { name: /에이전트에 맡기기/ })).toBeVisible({ timeout: 30_000 });
        await expect(page.getByTestId('workitem-delegate')).toHaveCount(0);
        await expect(page.getByTestId('workitem-delegate-agent')).toHaveCount(0);
        await page.getByRole('tab', { name: /에이전트에 맡기기/ }).click();
        await expect(page.getByText('담당자만 에이전트에 맡길 수 있습니다', { exact: false })).toBeVisible();
        await expect(page.getByRole('button', { name: /^\s*선택\s*$/ })).toHaveCount(0);
        await expect(page.getByRole('button', { name: /^\s*채택\s*$/ })).toHaveCount(0);
        expect(writes).toEqual([]);
    });

    test('F-UX-07 담당자는 「에이전트에 맡기기」 한 번으로 바로 맡긴다', async ({ page }) => {
        const writes = await trapTodoWrites(page);
        await login(page, 'minji');
        await page.goto(`${BASE}/todolist/${TASK_ID}`);
        await expect(page.getByTestId('workitem-delegate')).toHaveCount(1, { timeout: 30_000 });
        await page.getByTestId('workitem-delegate-agent').click();
        await expect.poll(() => writes.length).toBeGreaterThan(0);
        const body = writes.at(-1).body;
        expect(body.id).toBe(TASK_ID);
        expect(body.status).toBe('IN_PROGRESS');
        expect(['DRAFT', 'COMPLETE']).toContain(body.agent_mode);
        expect(body.agent_orch).toBeTruthy();
    });

    test('F-UX-08 관리자는 위임할 수 있지만 남의 업무를 에이전트에 맡기지는 못한다', async ({ page }) => {
        const writes = await trapTodoWrites(page);
        await login(page, 'admin');
        await page.goto(`${BASE}/todolist/${TASK_ID}`);
        await expect(page.getByTestId('workitem-delegate')).toHaveCount(1, { timeout: 30_000 });
        await expect(page.getByTestId('workitem-delegate-agent')).toHaveCount(0);
        await page.getByRole('tab', { name: /에이전트에 맡기기/ }).click();
        await expect(page.getByRole('button', { name: /^\s*선택\s*$/ })).toHaveCount(0);
        expect(writes).toEqual([]);
    });
});

test('F-UX-09 조직도는 새 화면이고 ApexCharts 워터마크가 없으며 ?createAgent=1 로 생성 창이 열린다', async ({ page }) => {
    await login(page, 'admin');
    await page.goto(`${BASE}/organization`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/APEXCHARTS/i)).toHaveCount(0);
    await expect(page.locator('#apexTreeWrapper')).toHaveCount(0);
    await page.goto(`${BASE}/organization?createAgent=1`);
    await expect(page.locator('.v-overlay--active .v-card').first()).toBeVisible({ timeout: 30_000 });
    await expect(page).toHaveURL(/\/organization$/);
});

/** 인스턴스 목록 응답을 가짜로 — 운영처럼 start_date 가 빈 오래된 인스턴스를 섞는다. PostgreSQL 은 DESC 에서 NULL 이 먼저다. */
const LONG_NAME = '연구과제 정산 프로세스 · 2026년 1차 연구비 정산 및 증빙 서류 검토 요청 — 영수증·세금계산서 원본 대조와 연구비 집행 내역 검증을 포함합니다';
function instRow(id: string, name: string, start: string | null, upd: string | null, status = 'RUNNING') {
    return {
        proc_inst_id: `mock_def.${id}`, proc_def_id: 'mock_def', proc_inst_name: name, status, participants: [], tenant_id: 'localhost',
        start_date: start, end_date: status === 'COMPLETED' ? start : null, updated_at: upd, is_deleted: false, deleted_at: null,
        parent_proc_inst_id: null, root_proc_inst_id: null, current_activity_ids: [], role_bindings: [], variables_data: []
    };
}
function pgOrder(rows: any[], order: string) {
    const keys = order.split(',').filter(Boolean).map((s) => { const [col, dir] = s.split('.'); return { col, desc: dir === 'desc' }; });
    return [...rows].sort((a, b) => {
        for (const { col, desc } of keys) {
            const x = a[col], y = b[col];
            if (x === y) continue;
            if (x == null) return desc ? -1 : 1;
            if (y == null) return desc ? 1 : -1;
            const c = String(x) < String(y) ? -1 : 1;
            return desc ? -c : c;
        }
        return 0;
    });
}
async function mockInstances(page: Page, running: any[], completed: any[]) {
    await page.route('**/rest/v1/bpm_proc_inst?*', (route) => {
        const url = new URL(route.request().url());
        const status = url.searchParams.get('status') || '';
        if (route.request().method() !== 'GET') return route.continue();
        const rows = status.includes('RUNNING') ? running : status.includes('COMPLETED') ? completed : null;
        if (!rows) return route.continue();
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(pgOrder(rows, url.searchParams.get('order') || '')) });
    });
}

test('F-UX-10 사이드바 인스턴스는 최근에 갱신된 것이 맨 위에 온다 (시작일이 빈 옛 인스턴스가 있어도)', async ({ page }) => {
    await mockInstances(page, [
        instRow('a1', LONG_NAME, null, '2026-11-06T10:00:00+09:00'),
        instRow('a2', '연구과제 정산 프로세스 · 2차 정산', null, '2026-11-07T09:00:00+09:00'),
        instRow('a3', '영업활동 프로세스 · 경영에이전트 구현', '2026-11-09T14:31:00', '2026-11-09T14:31:05+09:00'),
        instRow('a4', '견적 승인 프로세스 · 대량 주문', '2026-11-08T10:00:00', '2026-11-08T16:00:00+09:00')
    ], []);
    await login(page, 'admin');
    const titles = page.locator('[data-testid="sidebar-instances"] + * .v-list-item-title');
    await expect(titles.first()).toHaveText(/영업활동 프로세스 · 경영에이전트 구현/, { timeout: 30_000 });
    await expect(titles.nth(1)).toHaveText(/견적 승인 프로세스/);
});

test('F-UX-11 사이드바 인스턴스 툴팁은 화면을 가로지르지 않는다 (폭 360px 이하)', async ({ page }) => {
    await mockInstances(page, [instRow('a1', LONG_NAME, '2026-11-09T09:00:00', '2026-11-09T09:00:00+09:00')], []);
    await login(page, 'admin');
    const item = page.locator('[data-testid="sidebar-instances"] + * .v-list-item-title').first();
    await item.hover();
    const tip = page.locator('.nav-item-tooltip').last();
    await expect(tip).toBeVisible();
    const box = await tip.boundingBox();
    expect(box!.width).toBeLessThanOrEqual(361);
});

test('F-UX-12 완료된 인스턴스 목록은 빈 날짜를 1970년이 아닌 「-」로 보인다', async ({ page }) => {
    await mockInstances(page, [], [
        instRow('c1', '계약관리 프로세스 · 날짜 없음', null, null, 'COMPLETED'),
        instRow('c2', '휴가 신청 · 날짜 있음', '2026-06-23T06:01:16', '2026-06-23T06:06:56+09:00', 'COMPLETED')
    ]);
    await login(page, 'admin');
    await page.goto(`${BASE}/list-pages/completed`);
    await expect(page.getByText('계약관리 프로세스 · 날짜 없음').first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/시작일:\s*-/).first()).toBeVisible();
    await expect(page.getByText(/1970년/)).toHaveCount(0);
    await expect(page.getByText(/2026년 06월 23일/).first()).toBeVisible();
});

// ── 2026-11-10 검토 반영 (F-UX-13 ~ F-UX-16) ─────────────────────────────────────────────

test('F-UX-13 데스크톱 상단 줄에 「나의 업무」가 없고 /todolist 주소는 그대로 열린다', async ({ page }) => {
    await login(page, 'admin');
    await page.getByTestId('sidebar-instances').waitFor({ timeout: 30_000 });
    const headerLinks = await page.locator('header a, .v-app-bar a').evaluateAll((as) => as.map((a) => a.getAttribute('href') || ''));
    expect(headerLinks.filter((h) => h.startsWith('/todolist'))).toEqual([]);
    await expect(page.locator('.v-tooltip').filter({ hasText: '나의 업무' })).toHaveCount(0);
    await page.goto(`${BASE}/todolist`);
    await expect(page.getByText('진행 중').first()).toBeVisible({ timeout: 30_000 });
});

test('F-UX-14 내가 처리할 업무가 있는 인스턴스에만 「내 업무 N」 칩이 붙는다', async ({ page }) => {
    // 인스턴스 목록과 내 업무 조회 응답을 정해 둔다(설치본 데이터와 상관없이 칩 규칙만 본다).
    const target = 'f_ux_14.11111111-2222-3333-4444-555555555555';
    const now = new Date().toISOString();
    await page.route(/\/rest\/v1\/bpm_proc_inst\?/, (route) => {
        if (route.request().method() !== 'GET' || !/status=in\.%28NEW%2CRUNNING%29/.test(route.request().url())) return route.continue();
        return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([
                { proc_inst_id: target, proc_inst_name: '내 차례인 인스턴스', proc_def_id: 'f_ux_14', status: 'RUNNING', updated_at: now, start_date: now, participants: [] },
                { proc_inst_id: 'f_ux_14_other.9', proc_inst_name: '남의 차례인 인스턴스', proc_def_id: 'f_ux_14_other', status: 'RUNNING', updated_at: now, start_date: now, participants: [] }
            ])
        });
    });
    let query = '';
    await page.route(/\/rest\/v1\/todolist\?select=user_id%2Cstatus/, async (route) => {
        query = route.request().url();
        const uid = await page.evaluate(() => localStorage.getItem('uid'));
        return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([
                { user_id: uid, status: 'IN_PROGRESS', proc_inst_id: target, root_proc_inst_id: target, tool: 'formHandler:a', description: '' },
                { user_id: `someone, ${uid}`, status: 'PENDING', proc_inst_id: `${target}.child`, root_proc_inst_id: target, tool: 'formHandler:b', description: '' }
            ])
        });
    });
    await login(page, 'admin');
    const chip = page.getByTestId('sidebar-instance-mywork');
    await expect(chip).toHaveCount(1, { timeout: 30_000 });
    await expect(chip).toHaveText(/내 업무\s*2/);
    // 예정(TODO) · 완료 업무는 묻지 않는다
    expect(decodeURIComponent(query)).toContain('status=in.(IN_PROGRESS,SUBMITTED,PENDING)');
});

test('F-UX-15 에이전트 고르기는 엔진 이름을 함께 보이고 기본값은 딥 에이전트 (LangGraph)다', async ({ page }) => {
    await login(page, 'admin');
    const select = page.getByTestId('orchestration-select');
    await expect(select).toContainText('딥 에이전트 (LangGraph)', { timeout: 30_000 });
    await select.click();
    const options = page.locator('.v-overlay--active .v-list-item');
    await expect(options).toHaveText(['기본 에이전트 (LangChain ReAct)', '딥 에이전트 (LangGraph)', '딥 에이전트 (Codex)']);
    await page.keyboard.press('Escape');
});

test('F-UX-16 정의 체계도의 가져오기는 「프로세스 가져오기」다 (컴포넌트라는 말을 쓰지 않는다)', async ({ page }) => {
    await login(page, 'admin');
    await expect(page.getByText('프로세스 가져오기').first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('컴포넌트 가져오기')).toHaveCount(0);
});
