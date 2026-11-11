/**
 * 2026-11-11 화면 검토 녹화(업무 화면 오른쪽 칸, 0:00–1:50 · 3:30–3:50) 반영 회귀 묶음 (F-RV-A01 ~ A05)
 *
 * 시험 데이터는 seed-vm.mjs 가 VM DB 에 만들고 끝나면 지운다(운영에서 본 모양 그대로: 앞 단계 폼은
 * 자유입력 + alias 없는 text-field-2 · boolean-field-3, 산출물은 줄 머리와 목록이 섞인 글).
 * 업무 행에 쓰는 요청은 막는다 — 편집 칸을 비워 보는 시험이 저장되지 않게.
 *
 * 실행:
 *   BASE_URL=http://127.0.0.1:5301 UX_BASE_URL=http://127.0.0.1:5301 UX_HOST_MAP="MAP localhost 192.168.64.3" \
 *   UX_ACCOUNTS=~/.config/pgtut/local-accounts.json npx playwright test playwright/e2e/rev1111-a
 */
import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
// @ts-ignore — 시험 데이터 도우미(.mjs)
import { seed, cleanup, TASK_ID } from './seed-vm.mjs';

const BASE = process.env.UX_BASE_URL || 'http://127.0.0.1:5301';
const ACCOUNTS_PATH = (process.env.UX_ACCOUNTS || '~/.config/pgtut/local-accounts.json').replace(/^~/, os.homedir());
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
test.describe.configure({ mode: 'serial' });

test.beforeAll(() => {
    seed();
});
test.afterAll(() => {
    cleanup();
});

async function login(page: Page) {
    const a = accounts.admin;
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

/** 업무 행에 쓰는 요청은 막는다(읽기만) */
async function trapTodoWrites(page: Page) {
    await page.route(/\/rest\/v1\/todolist/, (route) => {
        const m = route.request().method();
        if (m === 'GET' || m === 'HEAD') return route.continue();
        return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
    });
}

async function openTask(page: Page) {
    await trapTodoWrites(page);
    await login(page);
    await page.goto(`${BASE}/todolist/${TASK_ID}`);
    await expect(page.getByTestId('received-output')).toBeVisible({ timeout: 45_000 });
    // 지금 단계 폼(에이전트 초안이 들어 있는 읽기 화면)이 그려질 때까지
    await expect(page.locator('.dynamic-form .form-text-area__md').first()).toBeVisible({ timeout: 30_000 });
}

async function expandReceived(page: Page) {
    await page.getByTestId('received-output-toggle').first().click();
    const body = page.getByTestId('received-output-body').first();
    await expect(body.locator('.form-text-area__md')).toBeVisible({ timeout: 20_000 });
    return body;
}

test('F-RV-A01 「전달받은 산출물」 · 「해야 할 작업」 — 예전 이름과 도움말 문구가 남지 않는다', async ({ page }) => {
    await openTask(page);
    await expect(page.getByTestId('received-output-title')).toHaveText(/^\s*전달받은 산출물/);
    await expect(page.getByText('해야 할 작업', { exact: true })).toBeVisible();
    await expect(page.getByText('이전 작업 입력 내역')).toHaveCount(0);
    await expect(page.getByText('현재 작업', { exact: true })).toHaveCount(0);

    await page.getByTestId('received-output-title').locator('button').first().click();
    const help = page.locator('.detail-popup-card');
    await expect(help).toBeVisible();
    await expect(help).toContainText('넘겨받은 산출물');
    await expect(help).toContainText('해야 할 작업');
    await expect(help).not.toContainText('입력 내역');
    await expect(help).not.toContainText('현재 작업');
});

test('F-RV-A02 기본 자유입력 폼은 「작업 내용」 제목 한 번 — 「자유입력」이 두 번 나오지 않는다', async ({ page }) => {
    await openTask(page);
    const form = page.locator('.dynamic-form').first(); // 해야 할 작업의 폼
    await expect(form.locator('.form-layout-card .v-card-title')).toHaveText(['작업 내용']);
    await expect(form.getByText('자유입력')).toHaveCount(0);
    // 앞 단계 산출물도 같은 폼 모양이다
    const body = await expandReceived(page);
    await expect(body.getByText('작업 내용', { exact: true })).toHaveCount(1);
    await expect(body.getByText('자유입력')).toHaveCount(0);

    // 편집 칸: 라벨이 없고 비우면 안내 문구가 보인다(쓰기 요청은 막혀 있다)
    await form.getByRole('button', { name: '편집' }).click();
    const textarea = form.locator('textarea').first();
    await expect(textarea).toBeVisible();
    await expect(form.locator('.v-textarea .v-field')).toHaveClass(/v-field--no-label/);
    await expect(form.locator('.v-textarea .v-label')).toHaveText('');
    await textarea.fill('');
    await expect(textarea).toHaveAttribute('placeholder', '한 일과 결과를 자유롭게 적어 주세요.');
});

test('F-RV-A03 산출물 글: 줄 머리는 따로, 목록은 카드 안에서 들여 쓰고, HTML 은 걸러진다', async ({ page }) => {
    await openTask(page);
    const body = await expandReceived(page);
    const md = body.locator('.form-text-area__md').first();

    // 줄 머리 세 개가 목록 밖의 머리 문단으로
    await expect(md.locator('p.md-section')).toHaveText(['적합한 점:', '보완이 필요한 사항:', '권고 후속 조치:']);
    await expect(md.locator('li', { hasText: '보완이 필요한 사항' })).toHaveCount(0);
    await expect(md.locator('li', { hasText: '권고 후속 조치' })).toHaveCount(0);
    await expect(md.locator('ul > li')).toHaveCount(6);
    await expect(md.locator('ol > li')).toHaveCount(6);

    // 글머리 · 번호가 글 칸 밖(왼쪽)으로 튀어나오지 않는다: 목록은 들여 쓰고, 항목 왼쪽은 문단보다 안쪽
    const geo = await md.evaluate((el) => {
        const box = el.getBoundingClientRect();
        const list = el.querySelector('ol') as HTMLElement;
        const li = el.querySelector('ol > li') as HTMLElement;
        const p = el.querySelector('p') as HTMLElement;
        return {
            padLeft: parseFloat(getComputedStyle(list).paddingLeft),
            liLeft: li.getBoundingClientRect().left,
            pLeft: p.getBoundingClientRect().left,
            boxLeft: box.left
        };
    });
    expect(geo.padLeft).toBeGreaterThanOrEqual(16);
    expect(geo.liLeft - geo.pLeft).toBeGreaterThanOrEqual(16);
    expect(geo.pLeft).toBeGreaterThanOrEqual(geo.boxLeft);

    // 글 속 <img onerror> 는 실행되지 않는다
    expect(await page.evaluate(() => (window as any).__rv1111aXss)).toBeUndefined();
    await expect(page.locator('[onerror]')).toHaveCount(0);

    // 해야 할 작업의 읽기 화면(편집 단추)도 같은 방식으로 그린다
    const current = page.locator('.dynamic-form').first().locator('.form-text-area__md').first();
    await expect(current.locator('p.md-section')).toHaveText(['반영 계획:', '남은 확인 사항:']);
    await expect(current.locator('ol > li')).toHaveCount(3);
    await expect(current.locator('ul > li')).toHaveCount(1);
});

test('F-RV-A04 alias 없는 필드는 내부 id 대신 읽을 수 있는 이름, 문자열 "false" 는 체크되지 않는다', async ({ page }) => {
    await openTask(page);
    const body = await expandReceived(page);
    await expect(body.getByText('text-field-2')).toHaveCount(0);
    await expect(body.getByText('boolean-field-3')).toHaveCount(0);
    // (Vuetify 입력 칸은 떠 있는 라벨을 하나 더 그린다)
    await expect(body.getByText('텍스트 2', { exact: true }).first()).toBeVisible();
    await expect(body.getByText('예/아니오 3', { exact: true }).first()).toBeVisible();
    await expect(body.locator('.form-boolean-field input[type="checkbox"]')).not.toBeChecked();
    await expect(page.getByText(/text-field-\d|boolean-field-\d/)).toHaveCount(0);
});

test('F-RV-A05 접힌 「전달받은 산출물」: 기울어진 미니 카드 대신 단계 이름 · 한 줄 미리보기 · 펼치기 단추', async ({ page }) => {
    await openTask(page);
    const box = page.getByTestId('received-output');
    await expect(box.locator('.summary-document')).toHaveCount(0);
    const rotated = await box.evaluate((el) =>
        [...el.querySelectorAll('*')].some((n) => {
            const t = getComputedStyle(n).transform;
            if (!t || t === 'none') return false;
            const m = t.match(/matrix\(([^)]+)\)/);
            return !!m && Math.abs(parseFloat(m[1].split(',')[1])) > 0.01; // 회전 성분
        })
    );
    expect(rotated).toBe(false);

    await expect(page.getByTestId('received-output-source').first()).toHaveText('제안서 작성');
    await expect(page.getByTestId('received-output-count').first()).toContainText('항목 3개');
    const preview = page.getByTestId('received-output-preview').first();
    await expect(preview).toContainText('검토 결과: 조건부 적합입니다.');
    // 한 줄: 글자 크기가 읽을 만하고(12px 이상) 높이가 한 줄
    const style = await preview.evaluate((el) => ({ fs: parseFloat(getComputedStyle(el).fontSize), h: el.getBoundingClientRect().height }));
    expect(style.fs).toBeGreaterThanOrEqual(12);
    expect(style.h).toBeLessThan(style.fs * 2);

    const head = page.locator('.received-output__head').first();
    await expect(head).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByTestId('received-output-toggle').first()).toHaveText(/펼쳐 보기/);
    await page.getByTestId('received-output-toggle').first().click();
    await expect(head).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByTestId('received-output-body').first()).toBeVisible();
    await expect(page.getByTestId('received-output-toggle').first()).toHaveText(/접기/);
    await expect(page.getByTestId('received-output-preview')).toHaveCount(0);
    await page.getByTestId('received-output-toggle').first().click();
    await expect(page.getByTestId('received-output-body')).toHaveCount(0);
});
