/**
 * 2026-11-11 화면 검토(1:50~2:35) — 업무 화면 음성 입력: 칸이 여럿인 양식 (F-RV-B02 · F-RV-B04 · F-RV-B05 · F-RV-B06)
 *
 * 예전 「음성 에이전트」 창이 하던 일(말한 내용 → update_form_fields 로 칸 채우기)을 창 없이 한다.
 * 받아쓰기는 진짜(VM STT), 칸 채우기 LLM 답은 흉내(F-RV-B05 만 진짜). 자세한 것은 voice-helpers.ts 머리말.
 *
 * 한 줄 칸(고객명 · 제안 제목)은 말한 값으로 바꾸고, 여러 줄 칸(요청 상세)만 「새로 넣을 말만」 받아 기존 글 뒤에
 * 잇는다(2026-11-11 결정). 어느 칸이든 답을 기다리는 사이 사람이 고친 칸은 건너뛴다.
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
    // 초안이 들어 있는 한 줄 칸 — 말한 값으로 바뀌어야 한다(뒤에 이어 「홍길동 한빛물산」 이 되면 안 된다)
    await expect(page.getByLabel('고객명')).not.toHaveValue('');

    await dictate(page);
    await expect(page.getByTestId('workitem-dictation-note')).toContainText('2개 칸을 채웠습니다', { timeout: 30_000 });
    await expect(page.getByLabel('고객명')).toHaveValue('한빛물산');
    await expect(page.getByLabel('제안 제목')).toHaveValue('회의실 가구 교체');
    await expect(contact).toHaveValue(contactBefore);
    await shot(page, 'after-5-structured-filled');

    // 서버에 간 요청: 진짜로 받아쓴 글과 이 양식의 칸 이름이 실렸고, 파일 칸은 빠졌다
    expect(sent).toHaveLength(1);
    const text = JSON.stringify(sent[0].messages);
    // 진짜 받아쓰기라 한 글자쯤 다르게 들을 때가 있다(「한빈물산」 — 2026-11-11 VM). 받아쓴 글이 실렸는지만 본다.
    expect(text).toMatch(/받아쓴 글: \\"[^"]*한\S?\s?물산[^"]*회의실/);
    expect(text).toContain('customer_name');
    expect(text).toContain('고객명');
    expect(text).not.toContain('attachment');
    // 한 줄 칸은 값 전체(replace), 여러 줄 칸은 새로 넣을 말만(append) 달라고 칸마다 적었다
    expect(text).toContain('\\"name\\":\\"customer_name\\",\\"label\\":\\"고객명\\",\\"type\\":\\"text-field\\",\\"inputType\\":\\"text\\",\\"fill\\":\\"replace\\"');
    expect(text).toContain('\\"name\\":\\"request_detail\\",\\"label\\":\\"요청 상세 내용\\",\\"type\\":\\"textarea-field\\",\\"fill\\":\\"append\\"');
    expect(writes, '사람이 보고 제출한다 — 자동 저장 · 자동 제출 없음').toEqual([]);
    await expectNoPopup(page, seen);
});

test('F-RV-B06 칸을 채우는 동안 사람이 쓴 글은 그대로 남는다 — 그 칸은 건너뛰고 한 줄로 알린다', async ({ page }) => {
    const seen = watchForPopups(page);
    const writes = await trapTodoWrites(page);
    // 칸 채우기 답을 늦춘다 — 사람이 그 사이 「제안 제목」 을 고쳐 쓴 뒤에야 답이 온다(LLM 이 오래 걸리는 경우)
    let release!: () => void;
    const typed = new Promise<void>((resolve) => (release = resolve));
    await page.route(/\/completion\/langchain-chat\/messages/, async (route) => {
        await typed;
        await new Promise((r) => setTimeout(r, 500));
        const reply = JSON.stringify({
            fields: [
                { name: 'customer_name', value: '한빛물산' },
                { name: 'request_title', value: '회의실 가구 교체' }
            ]
        });
        await route.fulfill({ status: 200, contentType: 'text/event-stream', body: sse(reply) });
    });
    await login(page, 'minji');
    await openTask(page, FORM_TASK);
    const name = page.getByLabel('고객명');
    const title = page.getByLabel('제안 제목');
    await expect(page.getByLabel('연락처')).toHaveValue(/\S/, { timeout: 30_000 });

    await dictate(page);
    const bar = page.getByTestId('workitem-dictation-bar');
    await expect(bar).toHaveAttribute('data-state', 'filling', { timeout: 30_000 });
    // 답을 기다리는 동안 사람이 제안 제목을 계속 쓴다
    await title.click();
    await title.press('End');
    await title.pressSequentially(' (사람이 고쳐 씀)', { delay: 20 });
    const typedTitle = await title.inputValue();
    expect(typedTitle).toContain('(사람이 고쳐 씀)');
    await expect(bar).toHaveAttribute('data-state', 'filling');
    release();

    const note = page.getByTestId('workitem-dictation-note');
    await expect(note).toContainText('1개 칸을 채웠습니다', { timeout: 30_000 });
    await expect(note).toContainText('입력 중이던 칸 1개는 건드리지 않았습니다');
    await expect(note).toContainText('제안 제목');
    // 사람이 쓴 글은 한 글자도 바뀌지 않았고, 건드리지 않은 칸만 채워졌다
    await expect(title).toHaveValue(typedTitle);
    await expect(name).toHaveValue('한빛물산');
    await shot(page, 'after-8-typed-during-fill');
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
