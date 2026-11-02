/**
 * 합류 지점의 앞선 대화 — 나눠 준 갈래들이 모인 방에서, 사람과 에이전트가 모든 갈래의 대화를 보고 일한다.
 *
 *   생산 계획(홍길동) ─┬─ 1공장 생산 수량 확인(이팀장) ─┐
 *                      └─ 2공장 생산 수량 확인(박대리) ─┴─ 생산 결과 취합(이팀장)
 *
 * 단계마다 사람이 그 방의 Process GPT Agent 와 대화하고(답을 받고) 나서 넘기거나 끝낸다.
 * 합류 방의 에이전트에게 한 갈래(2공장)에서만 나온 수량을 물어 맞게 답하는지 본다.
 * 실제 에이전트가 여러 번 답하므로 느린 묶음(@agent)이다. 결과를 화면에서 볼 수 있게 만든 데이터는 지우지 않는다.
 *
 * 실행: BASE_URL=http://localhost:8088 SB_SERVICE_KEY=... npx playwright test playwright/e2e/handover/handover-merge-history.spec.ts
 */
import { expect, test, type Page } from '@playwright/test';
import { PEOPLE, chat, completeTodoOnBoard, createRoom, handover, handoverMany, login, openRoom, shot } from './helpers';

test.setTimeout(1_800_000);

/** 방을 열고 그 방의 에이전트에게 묻는다. 에이전트 답을 돌려준다. */
async function ask(page: Page, roomId: string, text: string) {
    await openRoom(page, roomId);
    const reply = await chat(page, roomId, text, 300_000);
    console.log(`[대화] ${text.slice(0, 30)}… → ${reply.replace(/\s+/g, ' ').slice(0, 80)}`);
    return reply;
}

test('@agent 갈래가 모인 방에서 앞선 대화에 모든 갈래가 갈래별로 보이고, 에이전트가 한 갈래에만 나온 내용을 안다', async ({ browser }) => {
    const s = Date.now() % 100000;
    const hong = await login(browser, PEOPLE.hong);
    const lee = await login(browser, PEOPLE.lee);
    const park = await login(browser, PEOPLE.park);
    const byName = (rows: any[], name: string) => rows.find((r) => r.to_user_name === name);

    // 1) 홍길동: 에이전트와 이번 달 생산 계획을 정리하고, 공장별 수량 확인을 두 사람에게 나눠 준다
    const root = await createRoom(hong, `이번 달 생산 계획 ${s}`, true);
    await ask(hong, root, '이번 달 제품 생산을 1공장과 2공장으로 나눠 진행하려고 합니다. 공장별로 확인할 것을 두 줄로 정리해 주세요.');
    await openRoom(hong, root);
    const g = await handoverMany(hong, root, '생산 계획 수립', `공장별 이번 달 생산 수량 확인 ${s}`, [
        { to: PEOPLE.lee.name, next: '1공장 생산 수량 확인' },
        { to: PEOPLE.park.name, next: '2공장 생산 수량 확인' }
    ]);
    const f1 = byName(g, PEOPLE.lee.name);
    const f2 = byName(g, PEOPLE.park.name);

    // 2) 두 공장: 각자 방의 에이전트로 회신을 정리하고 할 일을 끝낸다. 수량은 그 갈래에만 나온다
    await ask(lee, f1.to_room_id, '1공장 이번 달 생산 수량은 1,240대로 확정됐습니다. 이 내용으로 회신 한 줄을 정리해 주세요.');
    await completeTodoOnBoard(lee, f1.to_task_id, `공장별 이번 달 생산 수량 확인 ${s}`);
    await ask(park, f2.to_room_id, '2공장 이번 달 생산 수량은 870대로 확정됐습니다. 이 내용으로 회신 한 줄을 정리해 주세요.');
    await completeTodoOnBoard(park, f2.to_task_id, `공장별 이번 달 생산 수량 확인 ${s}`);

    // 3) 홍길동: 시작 방에서 결과 취합을 이팀장에게 넘긴다 — 두 갈래가 모인다
    await openRoom(hong, root);
    const gather = await handover(hong, root, {
        done: '공장별 수량 확인',
        next: '생산 결과 취합',
        to: PEOPLE.lee.name,
        tab: '사람',
        instruction: `두 공장 수량을 합쳐 이번 달 총 생산량을 보고해 주세요 ${s}`
    });
    expect(gather.group_id, '한 사람에게 넘긴 합류 인계').toBeNull();

    // 4) 이팀장: 합류 방의 앞선 대화에 시작 방과 두 갈래가 갈래별로 보인다
    await openRoom(lee, gather.to_room_id);
    const history = lee.locator('.e2e-handover-history');
    await expect(history).toBeVisible({ timeout: 60_000 });
    await expect(history.locator('.e2e-handover-history-branch')).toHaveCount(2);
    const room = (id: string) => history.locator(`.e2e-handover-history-room[data-room-id="${id}"]`);
    await expect(room(root)).toBeVisible();
    await expect(room(f1.to_room_id)).toHaveAttribute('data-branch', /1공장 생산 수량 확인/);
    await expect(room(f2.to_room_id)).toHaveAttribute('data-branch', /2공장 생산 수량 확인/);
    await expect(room(f1.to_room_id)).toContainText('1,240');
    await expect(room(f2.to_room_id)).toContainText('870');
    await shot(lee, 'merge-history');

    // 5) 이팀장: 합류 방 에이전트에게 2공장 갈래에만 나온 수량을 묻는다
    const reply = await ask(lee, gather.to_room_id, '2공장의 이번 달 생산 수량이 몇 대였는지, 그리고 두 공장 합계가 몇 대인지 알려 주세요.');
    expect(reply, '2공장 갈래에만 나온 수량').toMatch(/870/);
    expect(reply, '두 갈래를 합친 수량').toMatch(/2,?110/);

    // 6) 갈래 방(박대리)의 앞선 대화에는 형제 갈래가 없다
    await openRoom(park, f2.to_room_id);
    const parkHistory = park.locator('.e2e-handover-history');
    await expect(parkHistory).toBeVisible({ timeout: 60_000 });
    await expect(parkHistory.locator('.e2e-handover-history-branch')).toHaveCount(0);
    await expect(parkHistory.locator(`.e2e-handover-history-room[data-room-id="${f1.to_room_id}"]`)).toHaveCount(0);
});
