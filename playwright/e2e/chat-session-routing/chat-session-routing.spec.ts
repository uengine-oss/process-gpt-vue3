/**
 * 대화 Pod 를 띄우는 동안의 「에이전트를 준비하고 있어요 · N초」와 CLI 코딩 에이전트 고르기 (F-CR-01 ~ 02) — 2026-11-11
 *
 *   - CLI 계열 에이전트(codex · cliagents)는 대화마다 Pod 를 띄운다. 식은 Pod 면 첫 답까지 16~40초인데 화면이
 *     그대로라 사용자는 AI 가 죽은 줄 알았다. 세션 라우터가 먼저 보내는 상태 프레임
 *     (`session_status` starting → ready)을 받아, 답이 나올 자리에 몇 초째인지 보이고 ready · 첫 토큰에서 지운다.
 *   - 새 대화에서 「CLI 코딩 에이전트」를 고르면 실행 CLI(Claude Code · Codex)를 고르는 칸이 나오고,
 *     고른 값이 요청의 metadata.agent_cli 로 실리며 방에 기억된다(휴대폰 웹에서 열어도 같은 CLI).
 *   - cli-agent 의 거절(cli_not_selected)은 「실행할 CLI를 먼저 고르세요」로 읽힌다(F-CR-03).
 *
 * 실제 백엔드(설치본)에 붙은 프런트를 연다. **에이전트 스트림 주소만** 가로채 이 시험이 띄운 작은 SSE 서버로
 * 돌린다 — starting ×2 → ready → 토큰 → done 을 실제 라우터처럼 시간을 두고 흘려야 표시가 나타났다가
 * 사라지는 것을 볼 수 있다(page.route 의 fulfill 은 본문을 한 번에 내보내 표시가 깜빡이고 끝난다).
 *
 * 실행 (VM 설치본 + 이 워크트리의 개발 서버 예):
 *   UX_BASE_URL=http://127.0.0.1:5197 UX_HOST_MAP="MAP localhost 192.168.64.3" \
 *   UX_ACCOUNTS=~/.config/pgtut/local-accounts.json npx playwright test playwright/e2e/chat-session-routing
 *   - 화면은 이 워크트리의 코드여야 한다(설치본 dist 가 아니라). 포털 개발 서버의 프록시를 VM 게이트웨이로,
 *     /m/ 은 휴대폰 웹 개발 서버로 넘긴다. 앱 주소는 127.0.0.1 을 쓴다(localhost 는 VM 으로 매핑된다).
 *   - CR_SHOTS=<폴더> 를 주면 표시가 떠 있는 화면을 그 폴더에 남긴다.
 *
 * 만든 대화방은 끝에 지운다(대화 · 방). 계정 파일: { admin: {email,password} } — ux-review 묶음과 같은 파일.
 */
import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

const BASE = process.env.UX_BASE_URL || 'http://127.0.0.1:5197';
const ACCOUNTS_PATH = (process.env.UX_ACCOUNTS || '~/.config/pgtut/local-accounts.json').replace(/^~/, os.homedir());
const accounts = fs.existsSync(ACCOUNTS_PATH) ? JSON.parse(fs.readFileSync(ACCOUNTS_PATH, 'utf8')) : null;
const SHOTS = process.env.CR_SHOTS || '';

const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';
const phone = {
    viewport: { width: 390, height: 844 },
    screen: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: ANDROID_UA
};

test.use({
    locale: 'ko-KR',
    launchOptions: {
        args: process.env.UX_HOST_MAP ? [`--host-resolver-rules=${process.env.UX_HOST_MAP}`] : [],
        executablePath: process.env.UX_CHROMIUM || undefined
    }
});
test.skip(!accounts, `계정 파일이 없습니다: ${ACCOUNTS_PATH}`);
test.describe.configure({ mode: 'serial' });

const PREPARING = /^에이전트를 준비하고 있어요 · \d+초$/;
const ANSWER = 'Codex 로 준비가 끝났습니다.';

/** 세션 라우터처럼 상태 프레임부터 시간을 두고 흘려보내는 SSE 서버. 받은 요청 본문을 남긴다. */
function startRouterStub() {
    const bodies: any[] = [];
    const frame = (o: unknown) => `data: ${JSON.stringify(o)}\n\n`;
    const server = http.createServer((req, res) => {
        let raw = '';
        req.on('data', (c) => (raw += c));
        req.on('end', () => {
            try {
                bodies.push(JSON.parse(raw));
            } catch {
                bodies.push(raw);
            }
            res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
            const agent = 'cliagents';
            const plan: [number, unknown][] = [
                [0, { type: 'session_status', status: 'starting', agent_type: agent, elapsed_ms: 0 }],
                [2000, { type: 'session_status', status: 'starting', agent_type: agent, elapsed_ms: 2000 }],
                [4000, { type: 'session_status', status: 'starting', agent_type: agent, elapsed_ms: 4000 }],
                [4600, { type: 'session_status', status: 'ready', agent_type: agent, waited_ms: 4600 }],
                [4900, { type: 'token', content: 'Codex 로 ' }],
                [5200, { type: 'token', content: '준비가 끝났습니다.' }],
                [5600, { type: 'done', content: ANSWER }]
            ];
            const timers = plan.map(([at, f]) => setTimeout(() => res.write(frame(f)), at));
            timers.push(setTimeout(() => res.end(), 5800));
            // 브라우저가 끊으면(중지 · 화면 이동) 남은 프레임을 보내지 않는다. req 의 close 는 본문을 다 읽은
            // 순간에 와서 쓰면 안 된다 — 프레임이 하나도 나가지 않는다.
            res.on('close', () => timers.forEach(clearTimeout));
        });
    });
    return new Promise<{ url: string; bodies: any[]; close: () => Promise<void> }>((resolve) =>
        server.listen(0, '127.0.0.1', () => {
            const { port } = server.address() as any;
            resolve({ url: `http://127.0.0.1:${port}/chat/stream`, bodies, close: () => new Promise((r) => server.close(() => r())) });
        })
    );
}

/** 에이전트 스트림 주소만 가로채 위 서버로 돌린다. 나머지는 실제 설치본으로 간다. */
async function routeAgentStream(page: Page, stubUrl: string) {
    await page.route(/\/(agent|process-gpt-[a-z-]+)\/chat\/stream(\?.*)?$/, (route) => route.continue({ url: stubUrl }));
}

async function fillLogin(page: Page) {
    const a = accounts.admin;
    await page.locator('input[type="password"]').waitFor({ timeout: 60_000 });
    await page.locator('input[type="text"], input[type="email"]').first().fill(a.email);
    await page.locator('input[type="password"]').first().fill(a.password);
    await page.locator('button').filter({ hasText: /^\s*(로그인|Sign In|Log In|Login)\s*$/i }).first().click();
}

async function login(page: Page) {
    await page.goto(`${BASE}/auth/login`);
    await fillLogin(page);
    await page.waitForURL((u) => !u.pathname.startsWith('/auth'), { timeout: 90_000 });
}

async function shot(page: Page, name: string) {
    if (!SHOTS) return;
    fs.mkdirSync(SHOTS, { recursive: true });
    await page.screenshot({ path: path.join(SHOTS, name) });
}

/** 표시가 몇 초째인지 숫자만. */
async function preparingSeconds(locator: ReturnType<Page['locator']>) {
    const text = ((await locator.textContent()) || '').trim();
    const m = text.match(/(\d+)초/);
    return m ? Number(m[1]) : -1;
}

let roomId = '';

test('F-CR-01 포털: CLI 코딩 에이전트 · Codex 로 새 대화 — 준비 중 N초가 보였다가 첫 답에서 사라진다', async ({ page }) => {
    test.setTimeout(180_000);
    const stub = await startRouterStub();
    try {
        await login(page);
        await routeAgentStream(page, stub.url);
        await page.goto(`${BASE}/definition-map`);

        // 오케스트레이션 → CLI 코딩 에이전트. 그때만 실행 CLI 칸이 나온다.
        const orch = page.getByTestId('orchestration-select');
        await expect(orch).toBeVisible({ timeout: 60_000 });
        await expect(page.getByTestId('agent-cli-select')).toHaveCount(0);
        await orch.click();
        await page.locator('.v-overlay--active .v-list-item').filter({ hasText: 'CLI 코딩 에이전트' }).click();
        const cli = page.getByTestId('agent-cli-select');
        await expect(cli).toBeVisible();
        await expect(cli).toContainText('Claude Code');
        await cli.click();
        await expect(page.locator('.v-overlay--active .v-list-item')).toContainText(['Claude Code', 'Codex']);
        await page.locator('.v-overlay--active .v-list-item').filter({ hasText: /^Codex$/ }).click();
        await expect(cli).toContainText('Codex');

        const input = page.locator('.main-chat-input-container textarea:visible').first();
        await input.fill('저장소 점검 보고서를 써 줘');
        await input.press('Enter');
        await page.waitForURL((u) => u.pathname === '/chat' && !!u.searchParams.get('roomId'), { timeout: 60_000 });
        roomId = new URL(page.url()).searchParams.get('roomId') || '';

        // 답이 나올 자리(진행 중 말풍선)에 몇 초째인지 보인다.
        const preparing = page.getByTestId('session-preparing');
        await expect(preparing).toBeVisible({ timeout: 30_000 });
        await expect(preparing).toHaveText(PREPARING);
        // 서버 프레임(2초 간격) 사이에도 1초씩 센다.
        await expect.poll(() => preparingSeconds(preparing), { timeout: 6_000 }).toBeGreaterThanOrEqual(2);
        await shot(page, 'portal-preparing.png');

        // ready → 첫 토큰에서 사라지고 답이 그 자리에 나온다.
        await expect(preparing).toHaveCount(0, { timeout: 15_000 });
        await expect(page.getByText(ANSWER).first()).toBeVisible({ timeout: 15_000 });

        // 요청에 고른 CLI 가 실렸다 — metadata 안에(맨 위에 두면 에이전트 SDK 가 버린다).
        expect(stub.bodies.length).toBeGreaterThan(0);
        expect(stub.bodies[0].metadata?.agent_cli).toBe('codex');
        expect(stub.bodies[0].agent_cli).toBeUndefined();

        // 방에 기억됐다 — 다시 열어도, 휴대폰 웹에서 열어도 같은 CLI 로 간다.
        const ctx = await page.evaluate(async (id) => {
            const { data } = await (window as any).$supabase.from('chat_rooms').select('context').eq('id', id).maybeSingle();
            return data?.context || null;
        }, roomId);
        expect(ctx?.orchestration).toBe('cliagents');
        expect(ctx?.agent_cli).toBe('codex');
    } finally {
        await stub.close();
    }
});

test('F-CR-01b 포털: 상태 프레임이 없는 대화(딥 에이전트)에는 준비 중 표시가 나타나지 않는다', async ({ page }) => {
    test.setTimeout(120_000);
    await login(page);
    let streamed = 0;
    // 이미 떠 있는 Pod · deepagents 처럼 상태 프레임 없이 곧바로 답한다.
    await page.route(/\/(agent|process-gpt-[a-z-]+)\/chat\/stream(\?.*)?$/, async (route) => {
        streamed++;
        await route.fulfill({
            status: 200,
            headers: { 'content-type': 'text/event-stream' },
            body: [
                { type: 'token', content: '바로 답합니다.' },
                { type: 'done', content: '바로 답합니다.' }
            ]
                .map((f) => `data: ${JSON.stringify(f)}\n\n`)
                .join('')
        });
    });
    // 화면에 한 번이라도 붙으면 남는 표식.
    await page.addInitScript(() => {
        new MutationObserver(() => {
            if (document.querySelector('[data-testid="session-preparing"]')) (window as any).__sawPreparing = true;
        }).observe(document, { childList: true, subtree: true });
    });
    await page.goto(`${BASE}/chat?roomId=${encodeURIComponent(roomId)}`);
    // 같은 방(cliagents)이라도 상태 프레임이 없으면 나오지 않는다 — 판단은 프레임으로만 한다.
    const input = page.locator('textarea:visible').last();
    await expect(input).toBeVisible({ timeout: 60_000 });
    await input.fill('한 번 더');
    await input.press('Enter');
    await expect.poll(() => streamed, { timeout: 30_000 }).toBeGreaterThan(0);
    await expect(page.getByText('바로 답합니다.').first()).toBeVisible({ timeout: 15_000 });
    expect(await page.evaluate(() => !!(window as any).__sawPreparing)).toBe(false);
});

test('F-CR-03 포털: cli-agent 가 「CLI 를 고르지 않았다」고 거절하면 무엇을 하면 되는지 읽힌다', async ({ page }) => {
    test.setTimeout(120_000);
    test.skip(!roomId, 'F-CR-01 에서 만든 방이 없다');
    await login(page);
    let calledUrl = '';
    await page.route(/\/(agent|process-gpt-[a-z-]+)\/chat\/stream(\?.*)?$/, async (route) => {
        calledUrl = route.request().url();
        await route.fulfill({
            status: 200,
            headers: { 'content-type': 'text/event-stream' },
            body: `data: ${JSON.stringify({
                type: 'error',
                code: 'cli_not_selected',
                content: 'No CLI selected for this chat.',
                available: ['claude-code', 'codex']
            })}\n\n`
        });
    });
    await page.goto(`${BASE}/chat?roomId=${encodeURIComponent(roomId)}`);
    const input = page.locator('textarea:visible').last();
    await expect(input).toBeVisible({ timeout: 60_000 });
    await input.fill('CLI 없이');
    await input.press('Enter');
    await expect(page.getByText('실행할 CLI를 먼저 고르세요. (Claude Code · Codex)').first()).toBeVisible({ timeout: 30_000 });
    // 이 방은 CLI 에이전트 방이라 CLI 게이트웨이로 갔다.
    expect(new URL(calledUrl).pathname).toBe('/process-gpt-cli-agent/chat/stream');
    await shot(page, 'portal-cli-not-selected.png');
});

test('F-CR-02 휴대폰 웹(/m/): 같은 방을 열면 Codex 가 골라져 있고, 준비 중 N초가 보였다가 첫 답에서 사라진다', async ({ browser }) => {
    test.setTimeout(180_000);
    test.skip(!roomId, 'F-CR-01 에서 만든 방이 없다');
    const stub = await startRouterStub();
    const ctx: BrowserContext = await browser.newContext({ ...phone });
    await ctx.addInitScript(() => {
        if (sessionStorage.getItem('cr-seeded')) return;
        localStorage.setItem('mobileView', 'light');
        sessionStorage.setItem('cr-seeded', '1');
    });
    const page = await ctx.newPage();
    try {
        await login(page);
        await page.waitForURL((u) => u.pathname === '/m/', { timeout: 60_000 });
        await routeAgentStream(page, stub.url);
        await page.goto(`${BASE}/m/#/chat/${encodeURIComponent(roomId)}`);

        // 방에 기억된 CLI 가 입력창에 보인다(cliagents 방에서만 나오는 칸).
        const chip = page.getByTestId('m-agent-cli');
        await expect(chip).toBeVisible({ timeout: 60_000 });
        await expect(chip).toContainText('Codex');

        const input = page.locator('.composer__text');
        await input.fill('휴대폰에서 한 번 더');
        await input.press('Enter');

        const preparing = page.getByTestId('m-session-preparing');
        await expect(preparing).toBeVisible({ timeout: 30_000 });
        await expect(preparing).toHaveText(PREPARING);
        await expect.poll(() => preparingSeconds(preparing), { timeout: 6_000 }).toBeGreaterThanOrEqual(2);
        await shot(page, 'm-preparing-390x844.png');

        await expect(preparing).toHaveCount(0, { timeout: 15_000 });
        // 토큰이 말풍선에 이어 붙는다(최종본은 서버가 저장해 실시간으로 들어온다 — 여기서는 스트림만 본다).
        await expect.poll(() => stub.bodies.length, { timeout: 5_000 }).toBeGreaterThan(0);
        expect(stub.bodies[0].metadata?.agent_cli).toBe('codex');
        expect(stub.bodies[0].conversation_id).toBe(roomId);
    } finally {
        await stub.close();
        await ctx.close();
    }
});

test.afterAll(async ({ browser }) => {
    if (!roomId) return;
    // 시험이 만든 대화방을 지운다(포털과 같은 순서 — 대화 먼저, 방 나중).
    const page = await browser.newPage();
    try {
        await login(page);
        await page.evaluate(async (id) => {
            const sb = (window as any).$supabase;
            await sb.from('chats').delete().eq('id', id);
            await sb.from('chat_rooms').delete().eq('id', id);
        }, roomId);
    } finally {
        await page.close();
    }
});
