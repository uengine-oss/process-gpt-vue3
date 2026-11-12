/**
 * 2026-11-11 화면 검토(1:50~2:35) — 업무 화면 음성 입력 시험의 공통 도구.
 *
 * 무엇이 진짜이고 무엇을 흉내 내나
 *   - 마이크: Chromium 가짜 장치(--use-fake-device-for-media-stream)에 macOS `say -v Yuna` 로 만든 한국어
 *     wav 를 물린다(--use-file-for-fake-audio-capture). 녹음(MediaRecorder)은 진짜다.
 *     가짜 장치 파일은 브라우저마다 하나라서 말소리마다 시험 파일을 나눴다.
 *   - 받아쓰기: VM 설치본의 /completion/upload(진짜 STT)를 그대로 부른다. 오류 시험만 503 으로 막는다.
 *   - 칸 채우기 LLM(/completion/langchain-chat/messages): 답을 흉내 낸다(요청 본문은 진짜 — 받아쓴 글 ·
 *     칸 이름이 실렸는지 확인한다). RV_LIVE_LLM=1 이면 VM 의 진짜 LLM 으로 한 번 더 돈다.
 *   - 마이크 권한 거부: navigator.mediaDevices.getUserMedia 가 NotAllowedError 를 내게 바꾼다.
 *   - 업무 행에 쓰는 요청(/rest/v1/todolist 쓰기)은 모두 막는다 — 시험이 VM 데이터를 바꾸지 않는다.
 *
 * 실행 (VM 설치본):
 *   BASE_URL=http://127.0.0.1:5303 UX_BASE_URL=http://127.0.0.1:5303 UX_HOST_MAP="MAP localhost 192.168.64.3" \
 *   UX_ACCOUNTS=~/.config/pgtut/local-accounts.json npx playwright test playwright/e2e/rev1111-b
 *
 * 업무(VM 한빛물산 시연 데이터): RV_FREE_TASK = 장진영(admin)의 「요청사항 입력」(글 칸 하나 — 자유 입력과 같은 모양),
 * RV_FORM_TASK = 김민지(minji)의 「고객 요청사항 입력」(고객명 · 연락처 · 제안 제목 · 요청 상세 · 첨부).
 */
import { expect, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const BASE = process.env.UX_BASE_URL || 'http://127.0.0.1:5303';
const ACCOUNTS_PATH = (process.env.UX_ACCOUNTS || '~/.config/pgtut/local-accounts.json').replace(/^~/, os.homedir());
export const accounts = fs.existsSync(ACCOUNTS_PATH) ? JSON.parse(fs.readFileSync(ACCOUNTS_PATH, 'utf8')) : null;
export const NO_ACCOUNTS = `계정 파일이 없습니다: ${ACCOUNTS_PATH}`;
export const FREE_TASK = process.env.RV_FREE_TASK || 'dd55c191-8914-0f26-256e-a16c478fafb7';
export const FORM_TASK = process.env.RV_FORM_TASK || 'd5eb82e6-5635-7dbc-2409-87a217e2e5b9';

/** 한국어 말소리 wav 를 만든다(macOS say + ffmpeg). 브라우저를 띄우기 전에 있어야 하므로 모듈을 읽을 때 만든다. */
export function speechWav(name: string, text: string): string | null {
    const dir = path.join(os.tmpdir(), 'rv-b-speech');
    const wav = path.join(dir, `${name}.wav`);
    if (fs.existsSync(wav)) return wav;
    try {
        fs.mkdirSync(dir, { recursive: true });
        const aiff = path.join(dir, `${name}.aiff`);
        execFileSync('say', ['-v', 'Yuna', '-o', aiff, text]);
        execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', aiff, '-ar', '48000', '-ac', '1', wav]);
        return wav;
    } catch {
        return null;
    }
}

export const NO_WAV = 'say · ffmpeg 로 말소리 wav 를 만들 수 없습니다(macOS 필요)';

/** 브라우저 설정 — 마이크 권한을 묻지 않고, 가짜 마이크가 wav 를 되풀이해 들려준다 */
export function voiceBrowser(wav: string | null) {
    const args = ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'];
    if (wav) args.push(`--use-file-for-fake-audio-capture=${wav}`);
    if (process.env.UX_HOST_MAP) args.push(`--host-resolver-rules=${process.env.UX_HOST_MAP}`);
    return {
        viewport: { width: 1440, height: 900 },
        locale: 'ko-KR',
        permissions: ['microphone'],
        launchOptions: { args, executablePath: process.env.UX_CHROMIUM || undefined }
    };
}

export async function login(page: Page, who: 'admin' | 'minji') {
    const a = accounts[who];
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

/** 업무 행에 쓰는 요청은 막고 본문만 모은다 */
export async function trapTodoWrites(page: Page) {
    const writes: any[] = [];
    await page.route(/\/rest\/v1\/todolist/, (route) => {
        const req = route.request();
        if (req.method() === 'GET' || req.method() === 'HEAD') return route.continue();
        writes.push({ method: req.method(), body: req.postDataJSON() });
        return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
    });
    return writes;
}

/** 창(브라우저 alert) · 음성 에이전트(Realtime) 연결이 생기는지 지켜본다 */
export function watchForPopups(page: Page) {
    const seen = { dialogs: [] as string[], voiceSockets: [] as string[] };
    page.on('dialog', (d) => {
        seen.dialogs.push(d.message());
        d.dismiss().catch(() => undefined);
    });
    page.on('websocket', (ws) => {
        if (/\/voice\//.test(ws.url())) seen.voiceSockets.push(ws.url());
    });
    return seen;
}

export async function openTask(page: Page, taskId: string) {
    await page.goto(`${BASE}/todolist/${taskId}`);
    await expect(page.getByTestId('workitem-delegate-agent')).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId('workitem-dictation-mic')).toBeVisible();
}

export async function expectNoPopup(page: Page, seen: ReturnType<typeof watchForPopups>) {
    // 예전 「음성 에이전트」 창(.ai-chat-card)도, 다른 대화 상자도 없다
    await expect(page.locator('.ai-chat-card')).toHaveCount(0);
    await expect(page.locator('.v-overlay--active .v-dialog, .v-overlay--active [role="dialog"]')).toHaveCount(0);
    expect(seen.dialogs, '브라우저 alert 가 뜨면 안 된다').toEqual([]);
    expect(seen.voiceSockets, '음성 에이전트(Realtime) 연결을 열지 않는다').toEqual([]);
}

/** LLM 서버(/completion/langchain-chat/messages)의 스트림 답 모양 */
export function sse(content: string) {
    const chunk = { id: 'rv-b-mock', choices: [{ index: 0, delta: { content }, finish_reason: null }] };
    return `data: ${JSON.stringify(chunk)}\n\ndata: [DONE]\n\n`;
}

/** RV_SHOTS 폴더가 있으면 화면 사진을 남긴다 */
export async function shot(page: Page, name: string) {
    const dir = process.env.RV_SHOTS;
    if (!dir) return;
    fs.mkdirSync(dir, { recursive: true });
    await page.screenshot({ path: path.join(dir, `${name}.png`) });
}
