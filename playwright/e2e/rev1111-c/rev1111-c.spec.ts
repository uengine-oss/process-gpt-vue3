/**
 * 2026-11-11 화면 검토 녹화(2:35–4:08) 반영 — 인스턴스 화면의 칸반 · 산출물 탭, 업무 화면의 액티비티 탭 (F-RV-C01 ~ C03)
 *
 * 실제 백엔드(VM 설치본)에 붙은 프런트를 화면으로 밟는다. 데이터는 읽기만 한다 — 칸반의 「기한 지남」 은
 * 업무 목록 응답을 가로채 기한만 지난 날로 바꿔 보여 준다(데이터는 그대로).
 *
 * 실행 (VM 설치본 예):
 *   BASE_URL=http://127.0.0.1:5305 UX_BASE_URL=http://127.0.0.1:5305 UX_HOST_MAP="MAP localhost 192.168.64.3" \
 *   UX_ACCOUNTS=~/.config/pgtut/local-accounts.json npx playwright test playwright/e2e/rev1111-c
 *
 * 필요한 데이터: 검토 → 반려 → 재작성 → 다시 작성 → 검토 로 되돌아간 인스턴스(RV_LOOP_INST) 와
 * 그 인스턴스의 지금 업무(RV_LOOP_TASK). VM 의 「영업 제안서 승인 한빛물산 대전 사무실 가구」 가 기본값이다.
 * SHOT_DIR 을 주면 화면 사진을 그 폴더에 <SHOT_TAG>-<이름>.png 로 남긴다.
 */
import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BASE = process.env.UX_BASE_URL || 'http://127.0.0.1:5305';
const ACCOUNTS_PATH = (process.env.UX_ACCOUNTS || '~/.config/pgtut/local-accounts.json').replace(/^~/, os.homedir());
const accounts = fs.existsSync(ACCOUNTS_PATH) ? JSON.parse(fs.readFileSync(ACCOUNTS_PATH, 'utf8')) : null;
const LOOP_INST = process.env.RV_LOOP_INST || 'cb456fd9_3c3a_47f7_83d6_dd5aa93e7191.0c540ac2-b39c-abcc-dd32-86f15d7f8e80';
const LOOP_TASK = process.env.RV_LOOP_TASK || '73d7b3fc-0d00-45ce-ab1b-b136d5f6ab62';
const SHOT_DIR = process.env.SHOT_DIR || '';
const SHOT_TAG = process.env.SHOT_TAG || 'after';

test.use({
    viewport: { width: 1440, height: 900 },
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    launchOptions: {
        args: process.env.UX_HOST_MAP ? [`--host-resolver-rules=${process.env.UX_HOST_MAP}`] : [],
        executablePath: process.env.UX_CHROMIUM || undefined
    }
});
test.skip(!accounts, `계정 파일이 없습니다: ${ACCOUNTS_PATH}`);

async function login(page: Page, who: 'admin' | 'minji' | 'seoyeon', appearance: 'sky' | 'dark' = 'sky') {
    const a = accounts[who];
    // 기존 탭 화면(간소화 끔)과 색 테마를 정해 두고 들어간다.
    await page.addInitScript((ap) => {
        try {
            localStorage.setItem('pg.simpleUi', '0');
            localStorage.setItem('pg-appearance', ap);
        } catch (e) {
            /* 저장소가 막힌 환경 */
        }
    }, appearance);
    await page.goto(`${BASE}/auth/login`);
    await page.locator('input[type="password"]').waitFor({ timeout: 30_000 });
    await page.locator('input[type="text"], input[type="email"]').first().fill(a.email);
    await page.locator('input[type="password"]').first().fill(a.password);
    await page
        .locator('button')
        .filter({ hasText: /^\s*(로그인|Sign In|Log In|Login)\s*$/i })
        .first()
        .click();
    await page.waitForURL((u) => !u.pathname.startsWith('/auth/'), { timeout: 45_000 });
}

async function shot(page: Page, name: string) {
    if (!SHOT_DIR) return;
    fs.mkdirSync(SHOT_DIR, { recursive: true });
    await page.screenshot({ path: path.join(SHOT_DIR, `${SHOT_TAG}-${name}.png`) });
}

const instPath = (id: string) => `/instancelist/${id.replace(/\./g, '_DOT_')}`;

async function openInstanceTab(page: Page, label: string) {
    await page.goto(`${BASE}${instPath(LOOP_INST)}`);
    const tab = page.locator('.v-tab').filter({ hasText: label }).first();
    await tab.waitFor({ timeout: 45_000 });
    await tab.click();
}

/**
 * 업무 목록(todolist) 응답을 받아 고쳐 돌려준다(화면 확인용, 데이터는 그대로).
 * route.fetch 는 브라우저의 호스트 매핑(--host-resolver-rules)을 거치지 않는다 — 같은 매핑을 직접 적용한다.
 */
async function rewriteTodolist(page: Page, edit: (rows: any[]) => void) {
    await page.route(/\/rest\/v1\/todolist\?/, async (route) => {
        if (route.request().method() !== 'GET') return route.continue();
        const req = route.request();
        const m = /MAP\s+(\S+)\s+(\S+)/.exec(process.env.UX_HOST_MAP || '');
        const u = new URL(req.url());
        let res;
        if (m && u.hostname === m[1]) {
            const host = u.host;
            u.hostname = m[2];
            res = await route.fetch({ url: u.toString(), headers: { ...req.headers(), host } });
        } else {
            res = await route.fetch();
        }
        let body: any;
        try {
            body = await res.json();
        } catch (e) {
            return route.fulfill({ response: res });
        }
        if (Array.isArray(body)) edit(body);
        return route.fulfill({ response: res, json: body });
    });
}

/** 지금 진행 중인 업무의 기한을 지난 날로 — 칸반 카드 안의 「기한 지남」 을 보려고. */
const pastDueInProgress = (page: Page) =>
    rewriteTodolist(page, (rows) =>
        rows.forEach((row) => {
            if (row && row.status === 'IN_PROGRESS' && row.proc_inst_id === LOOP_INST) row.due_date = '2026-11-01T09:00:00';
        })
    );

/**
 * 「제안서 작성」 산출물에 이름 없는 옛 칸(text-field-2)과 에이전트식 마크다운 글을 넣어 보인다 —
 * 칸 이름 대체(「텍스트 2」)와 목록이 살아 있는 미리보기를 확인하려고.
 */
const MD_PROPOSAL =
    '검토 결과: 조건부 적합입니다.\n적합한 점:\n- **핵심** 요구사항을 반영했습니다.\n- 1개 라인 시범 적용\n보완이 필요한 사항:\n1. 설비 연동 방식\n2. 입력 담당자';
const richOutput = (page: Page) =>
    rewriteTodolist(page, (rows) =>
        rows.forEach((row) => {
            if (!row || row.proc_inst_id !== LOOP_INST || row.activity_id !== 'task2' || !row.output) return;
            const formId = Object.keys(row.output)[0];
            if (formId) row.output[formId] = { ...row.output[formId], proposal: MD_PROPOSAL, 'text-field-2': 'MES 시범 도입 제안 v0.1' };
        })
    );

for (const appearance of ['sky', 'dark'] as const) {
    test(`F-RV-C01 칸반 — 흰 카드 · 같은 열 바탕 · 상태는 왼쪽 띠와 점으로 (${appearance})`, async ({ page }) => {
        await pastDueInProgress(page);
        await login(page, 'admin', appearance);
        await openInstanceTab(page, '칸반보드');
        const board = page.locator('.instance-card-kanban-board');
        await expect(board.locator('.v-card').filter({ hasText: '제안서 검토 및 승인/반려' }).first()).toBeVisible({ timeout: 30_000 });
        await page.waitForTimeout(800);
        await shot(page, `c01-kanban-${appearance}`);

        // 1) 열 바탕은 모두 같다(상태별 색 바탕 없음).
        const columns = board.getByTestId('kanban-column');
        await expect(columns).toHaveCount(4);
        const bgs = await columns.evaluateAll((els) => els.map((el) => getComputedStyle(el).backgroundColor));
        expect(new Set(bgs).size, `열 바탕: ${bgs.join(' | ')}`).toBe(1);

        // 2) 진행 중 카드(내 업무)는 꽉 찬 주 색 바탕이 아니라 카드 면 그대로이고, 왼쪽 띠로 상태를 보인다.
        const card = board.getByTestId('kanban-card').filter({ hasText: '제안서 검토 및 승인/반려' }).first();
        await expect(card).toHaveAttribute('data-status', 'IN_PROGRESS');
        const look = await card.evaluate((el) => {
            const cs = getComputedStyle(el);
            // 테마 변수는 v-app(.v-theme--*) 안에서 정해진다 — 견본은 카드 옆에 둔다.
            const probe = document.createElement('div');
            probe.style.background = 'rgb(var(--v-theme-surface))';
            (el.parentElement || document.body).appendChild(probe);
            const surface = getComputedStyle(probe).backgroundColor;
            probe.style.background = 'rgb(var(--v-theme-primary))';
            const primary = getComputedStyle(probe).backgroundColor;
            probe.remove();
            return { bg: cs.backgroundColor, surface, primary, accent: cs.borderLeftWidth, accentColor: cs.borderLeftColor };
        });
        expect(look.bg).not.toBe(look.primary);
        expect(look.bg).toBe(look.surface);
        expect(parseFloat(look.accent)).toBeGreaterThanOrEqual(3);
        expect(look.accentColor).toBe(look.primary);

        // 3) 내 업무 표시 · BPM 표시는 남는다. 기한 지남 칩은 카드 안에서 읽힌다.
        await expect(card.getByTestId('kanban-my-task')).toBeVisible();
        await expect(card.getByText('BPM', { exact: true })).toBeVisible();
        await expect(card.getByText('기한 지남')).toBeVisible();

        // 4) 열 머리에 상태 점이 있고, 그 색은 카드 왼쪽 띠와 같다.
        const dot = columns.first().getByTestId('kanban-column-dot');
        await expect(dot).toBeVisible();
        expect(await dot.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(look.primary);
    });
}

for (const appearance of ['sky', 'dark'] as const) {
    test(`F-RV-C02 산출물 탭 — 빈 산출물은 「아직 산출물이 없습니다」, 내용은 항목 이름과 함께 읽을 수 있는 크기로 (${appearance})`, async ({
        page
    }) => {
        await richOutput(page);
        await login(page, 'admin', appearance);
        await openInstanceTab(page, '산출물');
        const tab = page.locator('.instance-card-tab-7');
        const cards = tab.getByTestId('output-card');
        await expect(tab.locator('.v-card').filter({ hasText: '요청사항 입력' }).first()).toBeVisible({ timeout: 30_000 });
        await page.waitForTimeout(500);
        await shot(page, `c02-output-${appearance}`);

        // 기울어진 작은 썸네일(SummaryButton)은 이 탭에 없다.
        await expect(tab.locator('.summary-document')).toHaveCount(0);

        // 값이 하나도 없는 단계(제안서 재작성)는 비어 있다고 말한다.
        const empty = cards.filter({ hasText: '제안서 재작성' }).first();
        await expect(empty.getByText('아직 산출물이 없습니다')).toBeVisible();

        // 값이 있는 단계는 폼 항목 이름(요청사항)과 본문 첫 줄을 보통 글자 크기로 보인다 — 키(request_detail)가 아니다.
        const filled = cards.filter({ hasText: '요청사항 입력' }).first();
        await expect(filled.getByText('요청사항', { exact: true })).toBeVisible();
        await expect(filled.getByText('request_detail')).toHaveCount(0);
        const value = filled.locator('.pg-out-wide__v').first();
        await expect(value).toContainText('한빛물산 대전 지사');
        const fontSize = await value.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
        expect(fontSize).toBeGreaterThanOrEqual(13);
        // 카드 폭을 쓴다 — 탭 폭의 40% 이상.
        const [cardW, tabW] = await Promise.all([
            filled.evaluate((el) => el.getBoundingClientRect().width),
            tab.evaluate((el) => el.getBoundingClientRect().width)
        ]);
        expect(cardW / tabW).toBeGreaterThan(0.4);

        // 이름 없는 옛 칸은 「텍스트 2」, 마크다운 글은 목록으로 그린다(markdownText) — 키나 ** 가 보이지 않는다.
        const rich = cards.filter({ hasText: '제안서 작성' }).filter({ hasText: '제안서' }).first();
        await expect(rich.getByText('텍스트 2', { exact: true })).toBeVisible();
        await expect(rich.getByText('text-field-2')).toHaveCount(0);
        const md = rich.locator('.pg-out-wide__v--md').first();
        await expect(md.locator('li').first()).toContainText('핵심');
        await expect(md).not.toContainText('**');

        // 원본 보기로 전체를 연다.
        await filled.getByRole('button', { name: /원본 보기/ }).click();
        const dialog = page.locator('.v-overlay--active .v-card').filter({ hasText: '요청사항 입력' }).last();
        await expect(dialog).toBeVisible();
        await page.waitForTimeout(600);
        await shot(page, `c02-output-detail-${appearance}`);
    });
}

for (const appearance of ['sky', 'dark'] as const) {
    test(`F-RV-C03 액티비티 탭 — 회차 · 되돌아감 · 지금 단계, 한 줄 시간 (${appearance})`, async ({ page }) => {
        await login(page, 'admin', appearance);
        await page.goto(`${BASE}/todolist/${LOOP_TASK}`);
        const tab = page.locator('.v-tab').filter({ hasText: '액티비티' }).first();
        await tab.waitFor({ timeout: 45_000 });
        await tab.click();
        const table = page.locator('.work-item-history-tab .log-table');
        await expect(table.locator('tbody tr').first()).toBeVisible({ timeout: 30_000 });
        await page.waitForTimeout(800);
        await shot(page, `c03-activity-${appearance}`);

        // 같은 단계를 다시 하면 회차가 붙는다.
        await expect(table.getByText('2회차').first()).toBeVisible();
        await expect(table.getByText('3회차').first()).toBeVisible();

        // 흐름을 되돌린 단계는 갈림길 조건과 함께 표시한다.
        const loop = table.getByTestId('activity-loop').first();
        await expect(loop).toBeVisible();
        // VM 정의에는 갈림길 이름이 있다 — 「다시 진행」 이 아니라 갈래 이름이 붙어야 한다.
        await expect(loop).toContainText('되돌아감');
        await expect(loop).toContainText('반려인 경우');
        await expect(
            table
                .locator('tbody tr')
                .filter({ has: page.getByTestId('activity-loop') })
                .first()
        ).toContainText('제안서 검토 및');

        // 지금 단계(아직 끝나지 않은 다음 업무)가 무엇인지 보인다.
        const current = table.getByTestId('activity-current');
        await expect(current).toHaveCount(1);
        await current.scrollIntoViewIfNeeded();
        await shot(page, `c03-activity-current-${appearance}`);
        await expect(current.locator('xpath=ancestor::tr[1]')).toContainText('제안서 검토 및 승인/반려');

        // 「상태」 머리는 한 줄, 시간은 「MM.dd HH:mm」 한 줄 + 전체 날짜는 title.
        const statusHead = table.locator('thead th').filter({ hasText: '상태' }).first();
        const lineH = await statusHead.evaluate((el) => {
            const span = el.querySelector('span') || el;
            const r = span.getBoundingClientRect();
            return { h: r.height, lh: parseFloat(getComputedStyle(span).lineHeight) || 20 };
        });
        expect(lineH.h).toBeLessThan(lineH.lh * 1.6);
        const times = table.getByTestId('activity-time');
        const first = times.first();
        await expect(first).toHaveText(/^\s*\d{2}\.\d{2} \d{2}:\d{2}\s*$/);
        await expect(first).toHaveAttribute('title', /^\d{4}\.\d{2}\.\d{2} \d{2}:\d{2}:\d{2}$/);
        const tb = await first.evaluate((el) => {
            const r = el.getBoundingClientRect();
            return { h: r.height, lh: parseFloat(getComputedStyle(el).lineHeight) || 18 };
        });
        expect(tb.h).toBeLessThan(tb.lh * 1.6);
    });
}

test('F-RV-C03b 좁은 화면(카드 모양)의 액티비티에도 회차 · 되돌아감 · 지금 단계가 보인다', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, 'admin');
    await page.goto(`${BASE}${instPath(LOOP_INST)}`);
    await page.getByRole('button', { name: '액티비티' }).first().click();
    const cards = page.locator('.process-instance-mobile-card');
    await expect(cards.first()).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('.process-instance-mobile-cards').getByText('2회차').first()).toBeVisible();
    await expect(page.locator('.process-instance-mobile-cards').getByTestId('activity-loop').first()).toContainText('반려인 경우');
    const current = page.locator('.process-instance-mobile-cards').getByTestId('activity-current');
    await expect(current).toHaveCount(1);
    await current.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await shot(page, 'c03b-activity-phone');
    await expect(page.locator('.process-instance-mobile-cards').getByTestId('activity-time').first()).toHaveText(
        /^\s*\d{2}\.\d{2} \d{2}:\d{2}\s*$/
    );
});
