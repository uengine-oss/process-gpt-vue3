/**
 * 2026-11-12 오전 휴대폰 사진 다섯 장 — 받아쓰기 · 채팅 답이 안 오고, 다크 테마 글자가 안 보인다.
 * 로컬(VM)에서도 같은지 가른다. 데이터: 시험이 만든 대화방은 끝에 지운다.
 *
 *   BASE_URL=http://localhost:8088 UX_BASE_URL=http://localhost:8088 UX_HOST_MAP="MAP localhost 192.168.64.3" \
 *   UX_ACCOUNTS=~/.config/pgtut/local-accounts.json SHOT_DIR=<폴더> npx playwright test playwright/e2e/rev1112b/diagnose.spec.ts
 */
import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BASE = process.env.UX_BASE_URL || 'http://localhost:8088';
const ACCOUNTS_PATH = (process.env.UX_ACCOUNTS || '~/.config/pgtut/local-accounts.json').replace(/^~/, os.homedir());
const accounts = fs.existsSync(ACCOUNTS_PATH) ? JSON.parse(fs.readFileSync(ACCOUNTS_PATH, 'utf8')) : null;
const SHOT_DIR = process.env.SHOT_DIR || '';
const WAV = process.env.DIAG_WAV || '';

test.use({
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    launchOptions: {
        args: process.env.UX_HOST_MAP ? [`--host-resolver-rules=${process.env.UX_HOST_MAP}`] : [],
        executablePath: process.env.UX_CHROMIUM || undefined
    }
});
test.skip(!accounts, `계정 파일이 없습니다: ${ACCOUNTS_PATH}`);

async function login(page: Page, appearance = 'dark') {
    const a = accounts.admin;
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
    await page.screenshot({ path: path.join(SHOT_DIR, `${name}.png`) });
}

/** 페이지 안에서만 토큰을 꺼내 쓴다(출력하지 않는다). */
async function authedFetch(page: Page, url: string, init: { method?: string; wavB64?: string; json?: any } = {}) {
    return page.evaluate(
        async ({ url, init }) => {
            const key = Object.keys(localStorage).find((k) => /^sb-.*-auth-token$/.test(k));
            const token = key ? JSON.parse(localStorage.getItem(key) || '{}').access_token : '';
            const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
            let body: any;
            if (init.wavB64) {
                const bin = Uint8Array.from(atob(init.wavB64), (c) => c.charCodeAt(0));
                body = new FormData();
                body.append('audio', new Blob([bin], { type: 'audio/wav' }), 'hello.wav');
            } else if (init.json) {
                headers['content-type'] = 'application/json';
                body = JSON.stringify(init.json);
            }
            const t0 = performance.now();
            const r = await fetch(url, { method: init.method || 'GET', headers, body });
            const text = await r.text();
            return { status: r.status, ms: Math.round(performance.now() - t0), body: text.slice(0, 400) };
        },
        { url, init }
    );
}

test('F-RV-E05 받아쓰기: 녹음을 보내면 받아쓴 글이 온다(/completion/upload)', async ({ page }) => {
    test.skip(!WAV, 'DIAG_WAV 없음');
    await login(page);
    const res = await authedFetch(page, `${BASE}/completion/upload`, {
        method: 'POST',
        wavB64: fs.readFileSync(WAV).toString('base64')
    });
    console.log('[upload]', JSON.stringify(res));
    expect(res.status).toBe(200);
});

test('F-RV-E06 휴대폰 웹 AI 탭: 물어보면 에이전트 답이 온다', async ({ page }) => {
    test.setTimeout(240_000);
    await login(page);
    await page.goto(`${BASE}/m/#/chat`);
    const box = page.getByPlaceholder('예: 휴가 신청 프로세스 만들어줘');
    await box.waitFor({ timeout: 30_000 });
    await box.fill('어떤 프로세스들이 존재해? (시험)');
    await box.press('Enter');
    await page.waitForURL(/#\/chat\/[^/]+$/, { timeout: 30_000 });
    const roomId = decodeURIComponent(page.url().split('#/chat/')[1].split('?')[0]);
    try {
        const err = page.getByText(/답변을 받지 못했습니다|보내지 못했습니다/);
        const answered = page.getByText('Process GPT Agent');
        const outcome = await Promise.race([
            err.first().waitFor({ timeout: 180_000 }).then(() => 'error'),
            answered.first().waitFor({ timeout: 180_000 }).then(() => 'answer')
        ]).catch(() => 'timeout');
        await shot(page, 'm-chat');
        console.log('[m-chat]', outcome, roomId);
        expect(outcome).toBe('answer');
    } finally {
        const env = await page.evaluate(() => ({
            url: (window as any)._env_?.VITE_SUPABASE_URL,
            key: (window as any)._env_?.VITE_SUPABASE_KEY
        }));
        const ids = [roomId, ...(process.env.DIAG_EXTRA_ROOM ? [process.env.DIAG_EXTRA_ROOM] : [])];
        for (const id of env.url ? ids : []) {
            const roomIdToDelete = id;
            const del = (table: string, col: string) =>
                page.evaluate(
                    async ({ env, table, col, roomId }) => {
                        const k = Object.keys(localStorage).find((x) => /^sb-.*-auth-token$/.test(x));
                        const t = k ? JSON.parse(localStorage.getItem(k) || '{}').access_token : '';
                        const r = await fetch(`${env.url}/rest/v1/${table}?${col}=eq.${encodeURIComponent(roomId)}`, {
                            method: 'DELETE',
                            headers: { apikey: env.key, Authorization: `Bearer ${t}` }
                        });
                        return r.status;
                    },
                    { env, table, col, roomId: roomIdToDelete }
                );
            console.log('[cleanup] chats', await del('chats', 'id'), 'chat_rooms', await del('chat_rooms', 'id'));
        }
    }
});
