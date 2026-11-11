/**
 * 2026-11-11 화면 검토(1:50~2:35) — 업무 화면 음성 입력: 칸이 여럿인 양식 (F-RV-B02 · F-RV-B04 · F-RV-B05)
 *
 * 예전 「음성 에이전트」 창이 하던 일(말한 내용 → update_form_fields 로 칸 채우기)을 창 없이 한다.
 * 받아쓰기는 진짜(VM STT), 칸 채우기 LLM 답은 흉내(F-RV-B05 만 진짜). 자세한 것은 voice-helpers.ts 머리말.
 */
import { test, expect, type Page } from '@playwright/test';
import {
    FORM_TASK,
    NO_ACCOUNTS,
    NO_WAV,
    accounts,
    expectNoPopup,
    login,
    openTask,
    shot,
    speechWav,
    sse,
    trapTodoWrites,
    voiceBrowser,
    watchForPopups
} from './voice-helpers';

const WAV = speechWav('customer', '고객명은 한빛물산이고 제안 제목은 회의실 가구 교체입니다');

test.use(voiceBrowser(WAV));
test.skip(!accounts, NO_ACCOUNTS);
test.skip(!WAV, NO_WAV);

async function dictate(page: Page) {
    await page.getByTestId('workitem-dictation-mic').click();
    await expect(page.getByTestId('workitem-dictation-bar')).toHaveAttribute('data-state', 'recording');
    // wav 한 번(약 4초)을 다 듣고 멈춘다
    await page.waitForTimeout(5000);
    await page.getByTestId('workitem-dictation-stop').click();
}

test('F-RV-B02 말한 내용이 칸에 나뉘어 들어가고, 말하지 않은 칸은 그대로다', async ({ page }) => {
    const seen = watchForPopups(page);
    const writes = await trapTodoWrites(page);
    const sent: any[] = [];
    await page.route(/\/completion\/langchain-chat\/messages/, async (route) => {
        sent.push(route.request().postDataJSON());
        const reply = JSON.stringify({
            fields: [
                { name: 'customer_name', value: '한빛물산' },
                { name: 'request_title', value: '회의실 가구 교체' },
                { name: 'not_on_form', value: '지어낸 칸' }
            ]
        });
        await route.fulfill({ status: 200, contentType: 'text/event-stream', body: sse(reply) });
    });
    await login(page, 'minji');
    await openTask(page, FORM_TASK);
    const contact = page.getByLabel('연락처');
    // 이 업무에는 에이전트가 채운 초안이 있다 — 초안이 다 들어온 뒤의 값을 기준으로 삼는다
    await expect(contact).toHaveValue(/\S/, { timeout: 30_000 });
    const contactBefore = await contact.inputValue();

    await dictate(page);
    await expect(page.getByTestId('workitem-dictation-note')).toContainText('2개 칸을 채웠습니다', { timeout: 30_000 });
    await expect(page.getByLabel('고객명')).toHaveValue('한빛물산');
    await expect(page.getByLabel('제안 제목')).toHaveValue('회의실 가구 교체');
    await expect(contact).toHaveValue(contactBefore);
    await shot(page, 'after-5-structured-filled');

    // 서버에 간 요청: 진짜로 받아쓴 글과 이 양식의 칸 이름이 실렸고, 파일 칸은 빠졌다
    expect(sent).toHaveLength(1);
    const text = JSON.stringify(sent[0].messages);
    expect(text).toContain('한빛물산');
    expect(text).toContain('customer_name');
    expect(text).toContain('고객명');
    expect(text).not.toContain('attachment');
    expect(writes, '사람이 보고 제출한다 — 자동 저장 · 자동 제출 없음').toEqual([]);
    await expectNoPopup(page, seen);
});

test('F-RV-B04 칸 채우기 서버가 안 되면 받아쓴 글과 함께 한 줄로 알린다', async ({ page }) => {
    const seen = watchForPopups(page);
    await trapTodoWrites(page);
    await page.route(/\/completion\/langchain-chat\/messages/, (route) => route.fulfill({ status: 502, body: 'bad gateway' }));
    await login(page, 'minji');
    await openTask(page, FORM_TASK);
    const name = page.getByLabel('고객명');
    await expect(name).toHaveValue(/\S/, { timeout: 30_000 });
    const before = await name.inputValue();

    await dictate(page);
    const error = page.getByTestId('workitem-dictation-error');
    await expect(error).toContainText('칸을 채우지 못했습니다', { timeout: 30_000 });
    await expect(error).toContainText('한빛물산');
    await expect(name).toHaveValue(before);
    await shot(page, 'after-6-fill-down');
    await expectNoPopup(page, seen);
});

test('F-RV-B05 (RV_LIVE_LLM=1) VM 의 진짜 LLM 으로도 칸이 채워진다', async ({ page }) => {
    test.skip(process.env.RV_LIVE_LLM !== '1', 'RV_LIVE_LLM=1 일 때만 — 진짜 LLM 을 부른다');
    const seen = watchForPopups(page);
    const writes = await trapTodoWrites(page);
    await login(page, 'minji');
    await openTask(page, FORM_TASK);

    await dictate(page);
    await expect(page.getByTestId('workitem-dictation-note')).toContainText('칸을 채웠습니다', { timeout: 90_000 });
    await expect(page.getByLabel('고객명')).toHaveValue(/한빛/);
    await expect(page.getByLabel('제안 제목')).toHaveValue(/회의실/);
    await shot(page, 'after-7-structured-live');
    expect(writes).toEqual([]);
    await expectNoPopup(page, seen);
});
