/**
 * 2026-11-11 화면 검토(1:50~2:35) — 업무 화면 음성 입력: 글 칸 하나짜리 양식 (F-RV-B01 · F-RV-B03)
 *
 * 지적: 마이크를 눌러 말해도 아무것도 안 들어간다. 「음성 에이전트 · 연결됨」 창이 뜨는 방식이 아니라,
 * 창 없이 이 폼에 바로 들어가야 한다. 무엇이 진짜이고 무엇을 흉내 내는지는 voice-helpers.ts 머리말.
 */
import { test, expect } from '@playwright/test';
import {
    FREE_TASK,
    NO_ACCOUNTS,
    NO_WAV,
    accounts,
    expectNoPopup,
    login,
    openTask,
    shot,
    speechWav,
    trapTodoWrites,
    voiceBrowser,
    watchForPopups
} from './voice-helpers';

const WAV = speechWav('review', '검토 결과 조건부 적합입니다');

test.use(voiceBrowser(WAV));
test.skip(!accounts, NO_ACCOUNTS);
test.skip(!WAV, NO_WAV);

test('F-RV-B01 마이크를 누르고 말하면 창 없이 그 칸 뒤에 말한 그대로 들어간다', async ({ page }) => {
    const seen = watchForPopups(page);
    const writes = await trapTodoWrites(page);
    const llmCalls: string[] = [];
    page.on('request', (r) => {
        if (/langchain-chat\/messages/.test(r.url())) llmCalls.push(r.url());
    });
    await login(page, 'admin');
    await openTask(page, FREE_TASK);

    const field = page.locator('.dynamic-form textarea').first();
    await field.fill('기존 메모');

    // ⋯ 메뉴에 「음성 에이전트」(창) 항목이 없다
    await page.getByTestId('workitem-more-actions').click();
    await expect(page.locator('.v-overlay--active .v-list-item').first()).toBeVisible();
    await expect(page.locator('.v-overlay--active .v-list-item', { hasText: '음성 에이전트' })).toHaveCount(0);
    await page.keyboard.press('Escape');

    await page.getByTestId('workitem-dictation-mic').click();
    const bar = page.getByTestId('workitem-dictation-bar');
    await expect(bar).toHaveAttribute('data-state', 'recording');
    await expect(page.getByTestId('workitem-dictation-mic')).toHaveAttribute('aria-pressed', 'true');
    // 말하는 동안 지금까지 받아쓴 글이 막대에 보인다(진짜 받아쓰기)
    await expect(page.getByTestId('workitem-dictation-partial')).toContainText('적합', { timeout: 20_000 });
    await expect(page.getByTestId('workitem-dictation-elapsed')).toHaveText(/^\d:\d\d$/);
    await shot(page, 'after-1-recording');
    await expectNoPopup(page, seen);

    await page.getByTestId('workitem-dictation-stop').click();
    await expect(page.getByTestId('workitem-dictation-note')).toContainText('칸에 넣었습니다', { timeout: 30_000 });
    await expect(field).toHaveValue(/^기존 메모 .*조건부 적합/);
    await shot(page, 'after-2-appended');

    expect(llmCalls, '자유 입력은 LLM 을 거치지 않는다(말한 그대로)').toEqual([]);
    expect(writes, '자동 저장 · 자동 제출이 없다').toEqual([]);
    await expect(page.getByTestId('workitem-dictation-mic')).toHaveAttribute('aria-pressed', 'false');
    await expectNoPopup(page, seen);
});

test('F-RV-B03 받아쓰기 서버가 안 되거나 마이크를 막으면 한 줄로 알리고 마이크는 다시 쓸 수 있다', async ({ page }) => {
    const seen = watchForPopups(page);
    await trapTodoWrites(page);
    await login(page, 'admin');
    await openTask(page, FREE_TASK);
    const field = page.locator('.dynamic-form textarea').first();
    const before = await field.inputValue();

    // ① 받아쓰기 서버 고장
    await page.route(/\/completion\/upload/, (route) => route.fulfill({ status: 503, body: 'down' }));
    await page.getByTestId('workitem-dictation-mic').click();
    await expect(page.getByTestId('workitem-dictation-bar')).toHaveAttribute('data-state', 'recording');
    await page.waitForTimeout(1500);
    await page.getByTestId('workitem-dictation-stop').click();
    await expect(page.getByTestId('workitem-dictation-error')).toContainText('받아쓰기 서버에 연결하지 못했습니다');
    // 한 줄: 막대 높이가 한 줄 남짓이다
    const box = await page.getByTestId('workitem-dictation-bar').boundingBox();
    expect(box!.height).toBeLessThan(48);
    await shot(page, 'after-3-stt-down');
    await expect(field).toHaveValue(before);
    await expect(page.getByTestId('workitem-dictation-mic')).toBeEnabled();
    await expect(page.getByTestId('workitem-dictation-mic')).toHaveAttribute('aria-pressed', 'false');
    await page.getByTestId('workitem-dictation-close').click();
    await expect(page.getByTestId('workitem-dictation-bar')).toHaveCount(0);
    await page.unroute(/\/completion\/upload/);

    // ② 마이크 권한 거부 — 녹음 상태에 갇히지 않는다(예전에는 단추가 ■ 로 남고 아무 말도 없었다)
    await page.evaluate(() => {
        navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('denied', 'NotAllowedError'));
    });
    await page.getByTestId('workitem-dictation-mic').click();
    await expect(page.getByTestId('workitem-dictation-error')).toContainText('마이크 사용을 허용해 주세요');
    await expect(page.getByTestId('workitem-dictation-mic')).toHaveAttribute('aria-pressed', 'false');
    await shot(page, 'after-4-mic-denied');
    await expectNoPopup(page, seen);
});
