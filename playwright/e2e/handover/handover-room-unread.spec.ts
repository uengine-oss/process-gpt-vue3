/**
 * 인계로 받은 방의 읽음 표시 e2e.
 *
 * 예전에는 인계로 받은 방의 미리보기가 'NEW' 로 남았고, 대화 목록은 'NEW' 를 읽음 여부와
 * 상관없이 안 읽음으로 칠했다. 그래서 받은 사람이 방을 열어 읽어도, 누군가 메시지를 쓰기
 * 전까지 계속 안 읽음으로 보였다.
 *
 * 실행: BASE_URL=http://localhost:8088 SB_SERVICE_KEY=... LEE_PASSWORD=... \
 *       npx playwright test playwright/e2e/handover/handover-room-unread.spec.ts
 */
import { expect, test, type Page } from '@playwright/test';
import { BASE, PEOPLE, cleanupCreated, createRoom, handover, login, openRoom, rest, waitUntil } from './helpers';

test.setTimeout(180_000);
test.afterEach(cleanupCreated);

function roomItem(page: Page, name: string) {
    return page.locator('.chat-room-item, [class*=chat-room-item]').filter({ hasText: name }).first();
}

async function isUnreadInList(page: Page, name: string): Promise<boolean> {
    const item = roomItem(page, name);
    await expect(item).toBeVisible({ timeout: 60_000 });
    return ((await item.getAttribute('class')) || '').includes('chat-room-item--unread');
}

async function myFlag(roomId: string, email: string): Promise<boolean | undefined> {
    const [room] = await rest(`chat_rooms?id=eq.${roomId}&select=participants`);
    return (room?.participants || []).find((p: any) => p.email === email)?.isExistUnReadMessage;
}

/** 목록에서 방을 눌러 열고, 다른 화면으로 나간 뒤 목록에서 그 방이 읽음인지 본다. */
async function readThenLeave(page: Page, name: string) {
    await roomItem(page, name).click();
    await page.waitForURL(/\/chat\?roomId=/, { timeout: 60_000 });
    await page.waitForTimeout(4_000);
    await page.goto(`${BASE}/definition-map`, { waitUntil: 'domcontentloaded' });
}

test('인계로 받은 방은 안 읽음으로 보이고, 열어 읽으면 읽음으로 바뀐다', async ({ browser }) => {
    const stamp = Date.now();
    const hong = await login(browser, PEOPLE.hong);
    // 에이전트가 있는 방에서 넘긴다 — 에이전트도 함께 넘어가 받는 방 참가자가 둘이 된다.
    // (참가자가 받는 사람 하나뿐인 방은 대화 목록이 걸러 낸다)
    const fromRoom = await createRoom(hong, `읽음표시 e2e ${stamp}`, true);
    await openRoom(hong, fromRoom);
    const ev = await handover(hong, fromRoom, { next: `읽음 확인 ${stamp}`, to: PEOPLE.lee.name, tab: '사람' });
    const toRoomId = ev.to_room_id;
    const [room] = await rest(`chat_rooms?id=eq.${toRoomId}&select=name,message,participants`);

    // 받는 방 미리보기는 브리핑이고, 받는 사람에게는 안 읽음 기록이 있다
    expect(room.message.msg).not.toBe('NEW');
    expect(await myFlag(toRoomId, PEOPLE.lee.email)).toBe(true);

    const lee = await login(browser, PEOPLE.lee);
    await lee.goto(`${BASE}/definition-map`, { waitUntil: 'domcontentloaded' });
    expect(await isUnreadInList(lee, room.name)).toBe(true);

    await readThenLeave(lee, room.name);
    await waitUntil(async () => (await myFlag(toRoomId, PEOPLE.lee.email)) === false, '받는 사람 읽음 기록', 30_000, 1_000);
    expect(await isUnreadInList(lee, room.name)).toBe(false);

    // 새로고침해도 읽음이다(DB 기준)
    await lee.reload({ waitUntil: 'domcontentloaded' });
    expect(await isUnreadInList(lee, room.name)).toBe(false);
});

test('미리보기가 NEW 로 남은 예전 방도 한 번 열면 읽음이 되고, 방 정보는 그대로다', async ({ browser }) => {
    const lee = await login(browser, PEOPLE.lee);
    const name = `NEW 방 e2e ${Date.now()}`;
    const roomId = await createRoom(lee, name, true); // 미리보기 'NEW', 읽음 기록 없음
    const [before] = await rest(`chat_rooms?id=eq.${roomId}&select=name,message`);

    await lee.goto(`${BASE}/definition-map`, { waitUntil: 'domcontentloaded' });
    expect(await isUnreadInList(lee, name)).toBe(true);

    await readThenLeave(lee, name);
    await waitUntil(async () => (await myFlag(roomId, PEOPLE.lee.email)) === false, '읽음 기록', 30_000, 1_000);
    expect(await isUnreadInList(lee, name)).toBe(false);

    // 읽음 처리는 참가자 목록만 바꾼다 — 이름·미리보기를 되쓰지 않는다
    const [after] = await rest(`chat_rooms?id=eq.${roomId}&select=name,message`);
    expect(after).toEqual(before);
});
