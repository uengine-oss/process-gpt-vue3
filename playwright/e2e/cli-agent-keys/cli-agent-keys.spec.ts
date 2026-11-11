/**
 * 설정 › 「CLI 에이전트 API 키」와 채팅의 「CLI 코딩 에이전트」 선택지 (F-CK-01 ~ 06) — 2026-11-11
 *
 *   - 회사 관리자가 Anthropic · OpenAI API 키를 넣는다. 쓰기 전용 — 저장하면 칸이 비고 상태(설정됨 · ••••끝 네 자리 ·
 *     바꾼 사람 · 때)만 보인다. 지우기는 확인 한 번. 관리자가 아니면 칸이 없다(서버도 관리자만 쓰게 막는다).
 *   - 회사 키가 하나라도 있으면 VITE_FF_CLI_AGENT_CHAT 이 꺼져 있어도 새 대화에서 「CLI 코딩 에이전트」를 고를 수 있다
 *     (관리자 · 일반 사용자 모두). 키가 없으면 지금처럼 숨긴다.
 *   - 서버: supabase/migrations/20261111000001_cli_agent_credentials.sql (Vault 에만 암호화 저장).
 *
 * 실제 백엔드(설치본)에 붙은 이 워크트리의 개발 서버를 연다. 가로채지 않는다 — 실제 RPC 로 넣고 지운다.
 * 키는 누가 봐도 가짜인 값(sk-ant-test-…)만 쓰고, 끝에 이 시험이 넣은 키를 모두 지운다. 시작할 때 이미 회사 키가
 * 있으면(사람이 넣은 진짜 키일 수 있다) 건드리지 않고 건너뛴다.
 *
 * 실행 (VM 설치본 + 이 워크트리의 개발 서버 예):
 *   ~/.claude/skills/screen-review-ship/scripts/devserver/start.sh $PWD 5311 5312
 *   BASE_URL=http://127.0.0.1:5311 UX_BASE_URL=http://127.0.0.1:5311 UX_HOST_MAP="MAP localhost 192.168.64.3" \
 *   UX_ACCOUNTS=~/.config/pgtut/local-accounts.json CK_SHOTS=<사진 폴더> npx playwright test playwright/e2e/cli-agent-keys
 *   - 계정 파일: { admin, minji: {email,password} } — admin 은 관리자, minji 는 관리자가 아니다.
 *   - 앱 주소는 127.0.0.1(localhost 는 VM 으로 매핑된다).
 */
import { test, expect, type Browser, type Page } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BASE = process.env.UX_BASE_URL || 'http://127.0.0.1:5311';
const ACCOUNTS_PATH = (process.env.UX_ACCOUNTS || '~/.config/pgtut/local-accounts.json').replace(/^~/, os.homedir());
const accounts = fs.existsSync(ACCOUNTS_PATH) ? JSON.parse(fs.readFileSync(ACCOUNTS_PATH, 'utf8')) : null;
const SHOTS = process.env.CK_SHOTS || '';
const LAUNCH_ARGS = process.env.UX_HOST_MAP ? [`--host-resolver-rules=${process.env.UX_HOST_MAP}`] : [];

// 누가 봐도 가짜. 끝 네 자리로 화면 상태를 맞춰 본다.
const FAKE_ANTHROPIC = `sk-ant-test-clikey-e2e-${Date.now().toString(36)}-QA7Z`;
const LAST4 = FAKE_ANTHROPIC.slice(-4);
const CLI_OPTION = 'CLI 코딩 에이전트';

test.use({
    locale: 'ko-KR',
    viewport: { width: 1440, height: 900 },
    launchOptions: { args: LAUNCH_ARGS, executablePath: process.env.UX_CHROMIUM || undefined }
});
test.skip(!accounts, `계정 파일이 없습니다: ${ACCOUNTS_PATH}`);
test.describe.configure({ mode: 'serial' });

async function login(page: Page, who: 'admin' | 'minji') {
    const a = accounts[who];
    await page.goto(`${BASE}/auth/login`);
    await page.locator('input[type="password"]').waitFor({ timeout: 60_000 });
    await page.locator('input[type="text"], input[type="email"]').first().fill(a.email);
    await page.locator('input[type="password"]').first().fill(a.password);
    await page.locator('button').filter({ hasText: /^\s*(로그인|Sign In|Log In|Login)\s*$/i }).first().click();
    await page.waitForURL((u) => !u.pathname.startsWith('/auth'), { timeout: 90_000 });
    // 관리자 여부(localStorage isAdmin)는 가입 상태를 읽은 뒤 정해진다. 설정 화면은 그 값을 열 때 한 번 읽는다.
    await page.waitForFunction(() => localStorage.getItem('isAdmin') !== null, null, { timeout: 30_000 });
}

/** 지금 로그인한 사용자의 토큰으로 상태 RPC 를 부른다(화면이 쓰는 클라이언트 그대로). */
async function rpcStatus(page: Page) {
    return page.evaluate(async () => {
        const { data, error } = await (window as any).$supabase.rpc('cli_agent_credential_status');
        if (error) throw new Error(error.message);
        return data as { provider: string; configured: boolean; last4: string | null }[];
    });
}

async function rpcDeleteAll(page: Page) {
    await page.evaluate(async () => {
        for (const p of ['anthropic', 'openai']) {
            const { error } = await (window as any).$supabase.rpc('cli_agent_credential_set', { p_provider: p, p_secret: '' });
            if (error) throw new Error(error.message);
        }
    });
}

async function shot(page: Page, name: string, fullPage = false) {
    if (!SHOTS) return;
    fs.mkdirSync(SHOTS, { recursive: true });
    await page.screenshot({ path: path.join(SHOTS, name), fullPage });
}

async function openKeySettings(page: Page) {
    await page.goto(`${BASE}/account-settings`);
    const tab = page.getByTestId('tab-cli-agent-keys');
    await expect(tab).toBeVisible({ timeout: 60_000 });
    await tab.click();
    await expect(page.getByTestId('cli-agent-keys')).toBeVisible();
    // 첫 상태 읽기가 끝날 때까지(로딩 원이 사라질 때까지)
    await expect(page.getByTestId('cli-key-status-anthropic').locator('.v-progress-circular')).toHaveCount(0, { timeout: 30_000 });
    await windowSettled(page);
}

/** 새 대화 화면의 오케스트레이션 목록에 「CLI 코딩 에이전트」가 있나. */
async function pickerHasCliOption(page: Page, shotName = '') {
    // 회사 키 여부는 화면이 열린 뒤 비동기로 읽는다 — 그 응답을 받은 뒤에 목록을 연다.
    const statusRead = page.waitForResponse((r) => r.url().includes('/rpc/cli_agent_credential_status'), { timeout: 60_000 });
    await page.goto(`${BASE}/definition-map`);
    const orch = page.getByTestId('orchestration-select');
    await expect(orch).toBeVisible({ timeout: 60_000 });
    await statusRead;
    await orch.click();
    const items = page.locator('.v-overlay--active .v-list-item');
    await expect(items.filter({ hasText: '딥 에이전트' }).first()).toBeVisible();
    const has = (await items.filter({ hasText: CLI_OPTION }).count()) > 0;
    if (shotName) {
        // 목록이 펼쳐지는 동안(scale 전환) 찍으면 빈 상자로 나온다 — 전환이 끝난 뒤에 찍는다.
        await page.waitForFunction(() => !document.querySelector('.v-overlay--active [class*="-transition-enter-active"]'));
        await page.waitForTimeout(250);
        await shot(page, shotName);
    }
    await page.keyboard.press('Escape');
    return has;
}

/** 탭 창(v-window)이 미끄러지는 중이면 사진에 두 탭이 겹쳐 찍힌다. 끝날 때까지 기다린다. */
async function windowSettled(page: Page) {
    await page.waitForFunction(() => !document.querySelector('.v-window [class*="-transition-enter-active"], .v-window [class*="-transition-leave-active"]'));
}

let adminPage: Page;
let skipAll = '';

test.beforeAll(async ({ browser }: { browser: Browser }) => {
    adminPage = await browser.newPage({ locale: 'ko-KR', viewport: { width: 1440, height: 900 } });
    await login(adminPage, 'admin');
    const rows = await rpcStatus(adminPage);
    if (rows.some((r) => r.configured)) skipAll = '이 설치본에 이미 회사 키가 있다 — 사람이 넣은 키일 수 있어 건드리지 않는다';
    // 이 배포는 플래그를 켜지 않았다(키로만 열리는지 보려면 꺼져 있어야 한다).
    const flag = await adminPage.evaluate(() => (window as any)._env_?.VITE_FF_CLI_AGENT_CHAT ?? '');
    if (flag === 'true' || flag === true) skipAll = 'VITE_FF_CLI_AGENT_CHAT 이 켜진 배포 — 회사 키로 열리는지 볼 수 없다';
});

test.afterAll(async () => {
    if (!skipAll) await rpcDeleteAll(adminPage).catch(() => {});
    const after = await rpcStatus(adminPage).catch(() => []);
    console.log('[cli-agent-keys] 끝난 뒤 상태:', JSON.stringify(after));
    await adminPage.close();
});

test.beforeEach(() => {
    test.skip(!!skipAll, skipAll);
});

test('F-CK-01 키가 없으면 새 대화에 「CLI 코딩 에이전트」가 없다(플래그 꺼짐)', async () => {
    test.setTimeout(120_000);
    expect(await pickerHasCliOption(adminPage, 'picker-without-key.png')).toBe(false);
});

test('F-CK-02 관리자: Anthropic 키를 넣으면 칸이 비고 상태에 ••••끝 네 자리 · 이름 · 때가 보인다', async () => {
    test.setTimeout(120_000);
    const page = adminPage;
    await openKeySettings(page);

    // 빈 상태: 둘 다 「설정 안 됨」, 지우기 단추 없음, 안내 · 링크
    await expect(page.getByTestId('cli-key-status-anthropic')).toHaveText('설정 안 됨');
    await expect(page.getByTestId('cli-key-status-openai')).toHaveText('설정 안 됨');
    await expect(page.getByTestId('cli-key-delete-anthropic')).toHaveCount(0);
    await expect(page.getByTestId('cli-key-notice')).toContainText('회사가 직접 만든 API 키');
    await expect(page.getByTestId('cli-key-notice').locator('a[href^="https://console.anthropic.com"]')).toBeVisible();
    await expect(page.getByTestId('cli-key-notice').locator('a[href^="https://platform.openai.com"]')).toBeVisible();
    await expect(page.getByTestId('cli-key-save-anthropic')).toBeDisabled();
    await shot(page, 'admin-empty.png');

    // 모양 검사는 경고만 — Codex 줄에 Anthropic 키를 붙이면 알려 주되 저장 단추는 살아 있다. 저장하지 않고 지운다.
    const openaiInput = page.getByTestId('cli-key-input-openai').locator('input');
    await openaiInput.fill('sk-ant-test-wrong-row-0000');
    await expect(page.getByTestId('cli-key-warning-openai')).toContainText('OpenAI 키');
    await expect(page.getByTestId('cli-key-save-openai')).toBeEnabled();
    await openaiInput.fill('');
    await expect(page.getByTestId('cli-key-warning-openai')).toHaveCount(0);

    // 넣기: 입력 칸은 가려져 있고(type=password), 저장하면 비고, 상태가 바뀐다.
    const input = page.getByTestId('cli-key-input-anthropic').locator('input');
    await expect(input).toHaveAttribute('type', 'password');
    await input.fill(FAKE_ANTHROPIC);
    await expect(page.getByTestId('cli-key-warning-anthropic')).toHaveCount(0);
    await page.getByTestId('cli-key-save-anthropic').click();

    const status = page.getByTestId('cli-key-status-anthropic');
    await expect(status).toHaveText(new RegExp(`^\\s*설정됨 · ••••${LAST4} · 장진영 · \\d{2}\\.\\d{2} \\d{2}:\\d{2}$`), { timeout: 30_000 });
    await expect(input).toHaveValue('');
    await expect(page.getByTestId('cli-key-status-openai')).toHaveText('설정 안 됨');
    await expect(page.getByTestId('cli-key-delete-anthropic')).toBeVisible();
    // 화면 어디에도 키 원문이 없다(쓰기 전용)
    expect(await page.content()).not.toContain(FAKE_ANTHROPIC);
    await shot(page, 'admin-set.png');

    // 새로 열어도 그대로(서버 상태)
    await page.reload();
    await openKeySettings(page);
    await expect(page.getByTestId('cli-key-status-anthropic')).toContainText(`••••${LAST4}`);
});

test('F-CK-03 좁은 화면(390)에서도 줄이 넘치지 않고 쓸 수 있다', async ({ browser }) => {
    test.setTimeout(120_000);
    const ctx = await browser.newContext({ locale: 'ko-KR', viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    try {
        await login(page, 'admin');
        await page.goto(`${BASE}/account-settings?tab=CliAgentKeys`);
        const section = page.getByTestId('cli-agent-keys');
        await expect(section).toBeVisible({ timeout: 60_000 });
        await expect(page.getByTestId('cli-key-status-anthropic')).toContainText(`••••${LAST4}`, { timeout: 30_000 });
        // 가로로 넘치지 않는다
        const overflow = await page.evaluate(() => {
            const el = document.querySelector('[data-testid="cli-agent-keys"]') as HTMLElement;
            return el.scrollWidth - el.clientWidth;
        });
        expect(overflow).toBeLessThanOrEqual(1);
        const save = await page.getByTestId('cli-key-save-anthropic').boundingBox();
        expect(save && save.x + save.width).toBeLessThanOrEqual(390);
        await shot(page, 'admin-390.png', true);
    } finally {
        await ctx.close();
    }
});

test('F-CK-04 회사 키가 있으면 플래그가 꺼져 있어도 새 대화에 「CLI 코딩 에이전트」가 있다(관리자)', async () => {
    test.setTimeout(120_000);
    expect(await pickerHasCliOption(adminPage, 'picker-with-key.png')).toBe(true);
    // 고르면 실행 CLI 칸이 나온다(기존 흐름 그대로)
    await adminPage.getByTestId('orchestration-select').click();
    await adminPage.locator('.v-overlay--active .v-list-item').filter({ hasText: CLI_OPTION }).click();
    await expect(adminPage.getByTestId('agent-cli-select')).toBeVisible();
});

test('F-CK-05 관리자가 아니면 칸이 없다 — 주소로 와도 계정 탭, 서버도 거절. 선택지는 일반 사용자에게도 열린다', async ({ browser }) => {
    test.setTimeout(180_000);
    const ctx = await browser.newContext({ locale: 'ko-KR', viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    try {
        await login(page, 'minji');
        expect(await page.evaluate(() => localStorage.getItem('isAdmin'))).toBe('false');

        await page.goto(`${BASE}/account-settings`);
        await expect(page.locator('.v-tab').first()).toBeVisible({ timeout: 60_000 });
        await expect(page.getByTestId('tab-cli-agent-keys')).toHaveCount(0);

        await page.goto(`${BASE}/account-settings?tab=CliAgentKeys`);
        await expect(page.locator('.v-tab').first()).toBeVisible({ timeout: 60_000 });
        await page.waitForTimeout(1000);
        await expect(page.getByTestId('cli-agent-keys')).toHaveCount(0);

        // 서버: 일반 사용자는 넣지도 지우지도 못한다. 상태는 「있다」만 보이고 끝 네 자리 · 이름은 없다.
        const denied = await page.evaluate(async () => {
            const sb = (window as any).$supabase;
            const set = await sb.rpc('cli_agent_credential_set', { p_provider: 'anthropic', p_secret: '' });
            const get = await sb.rpc('cli_agent_credential_get', { p_tenant: 'localhost', p_provider: 'anthropic' });
            const st = await sb.rpc('cli_agent_credential_status');
            return { set: set.error?.code, get: get.error?.code, status: st.data };
        });
        expect(denied.set).toBe('42501');
        expect(denied.get).toBe('42501');
        const anth = denied.status.find((r: any) => r.provider === 'anthropic');
        expect(anth).toMatchObject({ configured: true, last4: null, updated_by_name: null });

        // 회사 키는 회사 사람 모두의 것 — 일반 사용자 새 대화에도 선택지가 있다
        expect(await pickerHasCliOption(page)).toBe(true);
    } finally {
        await ctx.close();
    }
});

test('F-CK-06 지우기(확인 한 번) → 「설정 안 됨」, 새 대화 선택지도 다시 숨는다', async () => {
    test.setTimeout(180_000);
    const page = adminPage;
    await openKeySettings(page);
    await page.getByTestId('cli-key-delete-anthropic').click();
    const dialog = page.getByTestId('cli-key-confirm-delete');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Claude Code 키를 지울까요?');
    await page.getByTestId('cli-key-confirm-delete-ok').click();
    await expect(page.getByTestId('cli-key-status-anthropic')).toHaveText('설정 안 됨', { timeout: 30_000 });
    await expect(page.getByTestId('cli-key-delete-anthropic')).toHaveCount(0);
    expect((await rpcStatus(page)).every((r) => !r.configured)).toBe(true);

    // 새 대화 화면을 열면 선택지도 다시 숨는다
    expect(await pickerHasCliOption(page)).toBe(false);
});
