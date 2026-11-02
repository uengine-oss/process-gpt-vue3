/**
 * 인계받은 방에서 앞선 대화 전체를 보는 e2e.
 *
 * 예전에는 받은 방에 브리핑 메시지 하나만 있고, 원래 대화는 '대화 기록 (n).md' 파일로 쪼개져
 * 넘어왔다. 받은 사람은 파일을 하나씩 열어야 맥락을 알 수 있었다.
 * 이제 받은 방 위쪽에 이 업무가 거쳐 온 방들의 대화가 순서대로, 읽기 전용으로 보인다.
 *
 * 실행: BASE_URL=http://localhost:8088 SB_SERVICE_KEY=... LEE_PASSWORD=... \
 *       npx playwright test playwright/e2e/handover/handover-history.spec.ts
 */
import { expect, test, type Page } from '@playwright/test';
import { PEOPLE, cleanupCreated, createRoom, handover, login, openRoom, rest, shot } from './helpers';

test.setTimeout(180_000);
test.afterEach(cleanupCreated);

/**
 * 방에 사람이 쓴 메시지를 남긴다. 대화를 쓰는 것 자체는 시험 대상이 아니고(에이전트 답을 기다리면
 * 느리고 흔들린다), 그 대화가 다음 방에서 보이는지가 대상이라 앱의 클라이언트로 바로 쓴다.
 */
async function say(page: Page, roomId: string, text: string, at?: string) {
    await page.evaluate(
        async ({ roomId, text, at }) => {
            const { error } = await (window as any).$supabase.from('chats').insert({
                uuid: crypto.randomUUID(),
                id: roomId,
                tenant_id: (window as any).$tenantName,
                messages: {
                    role: 'user',
                    name: localStorage.getItem('userName'),
                    email: localStorage.getItem('email'),
                    content: text,
                    timeStamp: at || new Date().toISOString()
                }
            });
            if (error) throw new Error(error.message);
        },
        { roomId, text, at }
    );
}

function history(page: Page) {
    return page.locator('.e2e-handover-history');
}

test('받은 방에서 앞선 방들의 대화를 순서대로 보고, 원래 방으로 갈 수 있다', async ({ browser }) => {
    const stamp = Date.now();
    const ask = `고객 요청 ${stamp}: 서버 3대, 대당 500만원`;
    const reply = `확인 ${stamp}: 승인 전에 납기를 4주로 맞춰 주세요`;
    const later = `인계 뒤에 쓴 다른 이야기 ${stamp}`;

    // 1) 홍길동이 시작한 방에서 대화하고 이팀장에게 넘긴다
    const hong = await login(browser, PEOPLE.hong);
    const roomA = await createRoom(hong, `이전 대화 e2e ${stamp}`, true);
    await say(hong, roomA, ask);
    await openRoom(hong, roomA);
    const ev1 = await handover(hong, roomA, { done: '견적 요청 접수', next: `견적 검토 ${stamp}`, to: PEOPLE.lee.name, tab: '사람' });
    const roomB = ev1.to_room_id;
    // 넘긴 뒤 시작 방에서 이어진 이야기는 이 업무의 맥락이 아니다
    await say(hong, roomA, later, new Date(Date.now() + 60_000).toISOString());

    // 2) 이팀장은 받은 방에서 시작 방의 대화를 본다
    const lee = await login(browser, PEOPLE.lee);
    await openRoom(lee, roomB);
    await expect(history(lee)).toBeVisible({ timeout: 60_000 });
    const roomsInB = history(lee).locator('.e2e-handover-history-room');
    await expect(roomsInB).toHaveCount(1);
    await expect(roomsInB.first()).toHaveAttribute('data-room-id', roomA);
    await expect(roomsInB.first()).toContainText(ask);
    await expect(roomsInB.first()).not.toContainText(later);
    await shot(lee, 'history-received');

    // 이전 대화에서 원래 방을 열면 — 이팀장은 그 방의 참여자가 아니므로 읽기만 한다
    await roomsInB.first().locator('.e2e-handover-history-open').click();
    await lee.waitForURL(new RegExp(`roomId=${roomA}`), { timeout: 30_000 });
    await expect(lee.locator('.e2e-view-only')).toBeVisible({ timeout: 60_000 });
    await expect(lee.locator('textarea:visible')).toHaveCount(0);
    await expect(lee.locator('.e2e-handover-open')).toHaveCount(0);
    await expect(lee.locator('.header-right .mdi-cog-outline')).toHaveCount(0);
    await expect(lee.locator('body')).toContainText(ask);
    await shot(lee, 'history-origin-view-only');
    // 참여자인 홍길동이 같은 방을 열면 예전처럼 입력할 수 있다
    await openRoom(hong, roomA);
    await expect(hong.locator('.e2e-view-only')).toHaveCount(0);
    await expect(hong.locator('textarea:not([disabled]):visible').first()).toBeVisible();

    // 3) 이팀장이 이어서 대화하고 다시 홍길동에게 넘긴다
    await say(lee, roomB, reply);
    await openRoom(lee, roomB);
    const ev2 = await handover(lee, roomB, { done: `견적 검토 ${stamp}`, next: `견적 발송 ${stamp}`, to: PEOPLE.hong.name, tab: '사람' });
    const roomC = ev2.to_room_id;

    // 4) 두 번 넘겨받은 방에서는 시작 방 → 바로 앞 방 순서로 둘 다 보인다
    await openRoom(hong, roomC);
    await expect(history(hong)).toBeVisible({ timeout: 60_000 });
    const roomsInC = history(hong).locator('.e2e-handover-history-room');
    await expect(roomsInC).toHaveCount(2);
    await expect(roomsInC.nth(0)).toHaveAttribute('data-room-id', roomA);
    await expect(roomsInC.nth(1)).toHaveAttribute('data-room-id', roomB);
    await expect(roomsInC.nth(0)).toContainText(ask);
    await expect(roomsInC.nth(1)).toContainText(reply);
    await shot(hong, 'history-chain');

    // 5) 원래 방 열기를 누르면 그 방으로 간다
    await roomsInC.nth(0).locator('.e2e-handover-history-open').click();
    await hong.waitForURL(new RegExp(`roomId=${roomA}`), { timeout: 30_000 });
    await expect(hong.locator('.e2e-handover-open').first()).toBeVisible({ timeout: 60_000 });
});

test('인계로 받지 않은 방에는 이전 대화가 없다', async ({ browser }) => {
    const hong = await login(browser, PEOPLE.hong);
    const roomId = await createRoom(hong, `이전 대화 없음 e2e ${Date.now()}`, true);
    await say(hong, roomId, '그냥 대화');
    await openRoom(hong, roomId);
    await hong.waitForTimeout(3_000);
    await expect(history(hong)).toHaveCount(0);
});

/** 방 화면 설정 메뉴에서 대화 삭제를 누르고 확인한다. */
async function deleteFromRoom(page: Page) {
    await page.locator('.header-right .mdi-cog-outline').first().click();
    await page.locator('.v-overlay .v-list-item', { hasText: /삭제/ }).first().click();
    await page
        .locator('.v-dialog')
        .getByRole('button', { name: /^삭제$/ })
        .click();
    await page.waitForURL((u) => !u.search.includes('roomId='), { timeout: 30_000 });
}

test('인계 스레드에 속한 방은 지워도 내 목록에서만 빠지고, 다음 사람은 그 대화를 계속 본다', async ({ browser }) => {
    const stamp = Date.now();
    const ask = `지우기 전 대화 ${stamp}`;
    const hong = await login(browser, PEOPLE.hong);
    const roomA = await createRoom(hong, `숨기기 e2e ${stamp}`, true);
    await say(hong, roomA, ask);
    await openRoom(hong, roomA);
    const ev = await handover(hong, roomA, { done: '요청 접수', next: `검토 ${stamp}`, to: PEOPLE.lee.name, tab: '사람' });

    await openRoom(hong, roomA);
    await deleteFromRoom(hong);

    // 방과 대화는 남고, 넘긴 사람만 참여자에서 빠진다
    const [room] = await rest(`chat_rooms?id=eq.${roomA}&select=id,participants`);
    expect(room?.id).toBe(roomA);
    expect((room.participants || []).some((p: any) => p.email === PEOPLE.hong.email)).toBe(false);
    expect((await rest(`chats?id=eq.${roomA}&select=uuid`)).length).toBeGreaterThan(0);

    // 받은 사람은 그 대화를 계속 본다
    const lee = await login(browser, PEOPLE.lee);
    await openRoom(lee, ev.to_room_id);
    await expect(lee.locator('.e2e-handover-history-room').first()).toContainText(ask, { timeout: 60_000 });
});

test('인계와 상관없는 방은 예전처럼 지워진다', async ({ browser }) => {
    const hong = await login(browser, PEOPLE.hong);
    const roomId = await createRoom(hong, `그냥 지우기 e2e ${Date.now()}`, true);
    await say(hong, roomId, '지울 대화');
    await openRoom(hong, roomId);
    await deleteFromRoom(hong);
    expect(await rest(`chat_rooms?id=eq.${roomId}&select=id`)).toHaveLength(0);
    expect(await rest(`chats?id=eq.${roomId}&select=uuid`)).toHaveLength(0);
});
