/**
 * 작업 흐름 탭 — 대화로 일하다가 일이 여러 갈래로 나뉘고 모이는 업무를 실제 사용 흐름 그대로 만들고, 탭에 그림처럼 보이는지 본다.
 * 기준 그림: 업무 기록/KakaoTalk_Photo_2026-10-23-11-55-05.png (고객 A사 · 납기 단축 요청)
 *
 *   고객 요청 접수(홍길동)
 *     ├─ 생산 가능 여부 검토(이팀장) ─┬─ 1공장 수량 확인(홍길동) ─┐
 *     │                              └─ 2공장 수량 확인(박대리) ─┴─ 생산 결과 취합(홍길동) ─┐
 *     └─ 추가 비용 검토(박대리) ── 긴급 비용 계산(문서 생성 전문가) ─────────────────────────┴─ 본부장 승인(이팀장)  [추가 비용 300만 원 초과]
 *
 * 단계마다 사람이 그 방의 Process GPT Agent 와 대화하고(답을 받고) 나서 넘기거나 끝낸다. 받은 방의 에이전트는
 * 앞선 방들의 대화를 알고 답해야 한다. 계정이 셋뿐이라 사람 이름만 그림과 다르다.
 * 실제 에이전트가 여러 번 답하므로 느린 묶음(@agent)이다. 결과를 화면에서 볼 수 있게 만든 데이터는 지우지 않는다.
 *
 * 실행: BASE_URL=http://localhost:8088 SB_SERVICE_KEY=... npx playwright test playwright/e2e/handover/handover-flow-scenario.spec.ts
 */
import { expect, test, type Page } from '@playwright/test';
import {
    BASE,
    DOC_AGENT,
    PEOPLE,
    chat,
    chatMessages,
    completeTodoOnBoard,
    createRoom,
    flowNodes,
    handover,
    handoverMany,
    login,
    openHandover,
    openRoom,
    rest,
    shot,
    waitUntil
} from './helpers';

test.setTimeout(1_800_000);

/** 방을 열고 그 방의 에이전트에게 묻는다. 에이전트 답을 돌려준다. */
async function ask(page: Page, roomId: string, text: string) {
    await openRoom(page, roomId);
    const reply = await chat(page, roomId, text, 300_000);
    console.log(`[대화] ${text.slice(0, 30)}… → ${reply.replace(/\s+/g, ' ').slice(0, 80)}`);
    return reply;
}

test('@agent 대화로 일하다 일이 나뉘고 모이면 작업 흐름 탭에 분기·합류·배분 조건이 그림처럼 보인다', async ({ browser }) => {
    const s = Date.now() % 100000;
    const hong = await login(browser, PEOPLE.hong);
    const lee = await login(browser, PEOPLE.lee);
    const park = await login(browser, PEOPLE.park);
    const byName = (rows: any[], name: string) => rows.find((r) => r.to_user_name === name);

    // 1) 홍길동: Process GPT Agent 와 고객 요청을 정리하고, 생산 검토와 비용 검토를 두 사람에게 한 번에 나눠 준다
    const root = await createRoom(hong, `고객 A사 · 납기 단축 요청 ${s}`, true);
    await ask(
        hong,
        root,
        '고객 A사가 제품 300개를 10월 30일까지 납품해 달라고 요청했습니다. 기존 납기보다 2주 빠릅니다. 이 요청을 처리하려면 생산 쪽과 비용 쪽에서 각각 무엇을 확인해야 하는지 세 줄 이내로 정리해 주세요.'
    );
    await openRoom(hong, root);
    const g1 = await handoverMany(hong, root, '고객 요청 접수', `A사 300개 · 10/30 납품 요청 검토 ${s}`, [
        { to: PEOPLE.lee.name, next: '생산 가능 여부 검토' },
        { to: PEOPLE.park.name, next: '추가 비용 검토' }
    ]);
    const prod = byName(g1, PEOPLE.lee.name);
    const cost = byName(g1, PEOPLE.park.name);

    // 2) 이팀장: 받은 방의 에이전트가 앞선 대화를 알고 답한다. 생산 여력을 공장별로 나눠 확인시킨다
    const leeReply = await ask(
        lee,
        prod.to_room_id,
        '앞선 대화에서 고객이 요청한 수량과 납기를 알려 주세요. 그리고 공장별로 무엇을 확인해야 할지 한 줄로 정리해 주세요.'
    );
    expect(leeReply, '받은 방 에이전트가 앞선 대화의 수량을 안다').toMatch(/300/);
    await openRoom(lee, prod.to_room_id);
    const g2 = await handoverMany(lee, prod.to_room_id, '생산 가능 여부 검토', `공장별 생산 가능 수량 확인 ${s}`, [
        { to: PEOPLE.hong.name, next: '1공장 수량 확인' },
        { to: PEOPLE.park.name, next: '2공장 수량 확인' }
    ]);
    const f1 = byName(g2, PEOPLE.hong.name);
    const f2 = byName(g2, PEOPLE.park.name);

    // 3) 박대리: 비용 검토 방에서 에이전트와 상의하고, 긴급 비용 계산을 문서 생성 전문가에게 맡긴다
    await ask(
        park,
        cost.to_room_id,
        '긴급 생산 추가 비용 계산을 문서 생성 전문가에게 맡기려고 합니다. 맡길 때 줄 지시사항을 한 줄로 써 주세요.'
    );
    await openRoom(park, cost.to_room_id);
    const toAgent = await handover(park, cost.to_room_id, {
        done: '추가 비용 검토',
        next: '긴급 비용 계산',
        to: DOC_AGENT.name,
        tab: '에이전트',
        instruction: `300개를 2주 앞당겨 생산할 때의 추가 비용(야간 근무·외주·긴급 자재)을 계산해 표로 정리해 주세요 ${s}`
    });

    // 4) 두 공장: 각자 방의 에이전트로 회신을 정리하고 할 일을 끝낸다
    await ask(hong, f1.to_room_id, '1공장은 10월 30일까지 200개 생산 가능합니다. 이 내용으로 회신 한 줄을 정리해 주세요.');
    await completeTodoOnBoard(hong, f1.to_task_id, `공장별 생산 가능 수량 확인 ${s}`);
    await ask(park, f2.to_room_id, '2공장은 10월 30일까지 100개 생산 가능합니다. 이 내용으로 회신 한 줄을 정리해 주세요.');
    await completeTodoOnBoard(park, f2.to_task_id, `공장별 생산 가능 수량 확인 ${s}`);

    // 5) 이팀장: 작업 흐름 탭에서 두 공장이 끝난 것을 보고, 결과 취합을 넘긴다 — 1·2공장 갈래가 모인다
    await openRoom(lee, prod.to_room_id);
    let nodes = await flowNodes(lee);
    expect(nodes.find((n) => n.room === f1.to_room_id)?.status).toBe('done');
    expect(nodes.find((n) => n.room === f2.to_room_id)?.status).toBe('done');
    await openRoom(lee, prod.to_room_id);
    const gather = await handover(lee, prod.to_room_id, {
        done: '생산 가능 여부 검토',
        next: '생산 결과 취합',
        to: PEOPLE.hong.name,
        tab: '사람',
        instruction: `1공장 200개 + 2공장 100개 회신을 합쳐 납기 가능 여부를 정리해 주세요 ${s}`
    });
    await ask(hong, gather.to_room_id, '1공장 200개, 2공장 100개 회신을 합쳐 10월 30일까지 300개 납기가 가능한지 한 줄로 정리해 주세요.');
    await completeTodoOnBoard(hong, gather.to_task_id, `납기 가능 여부를 정리해 주세요 ${s}`);

    // 6) 에이전트가 긴급 비용 계산을 마친다(넘긴 박대리 방에 결과가 남는다)
    const agentResult = await waitUntil(
        async () => (await chatMessages(toAgent.to_room_id)).find((m) => m.rowUuid === `handover-result-${toAgent.to_task_id}`),
        '긴급 비용 계산 결과',
        900_000,
        10_000
    );
    console.log(`[에이전트] ${String(agentResult.content).replace(/\s+/g, ' ').slice(0, 100)}`);

    // 7) 홍길동: 시작 방에서 작업 흐름을 보고 두 갈래 결과가 모였으니, 배분 조건과 함께 본부장 승인을 넘긴다 — 두 갈래가 모인다
    await openRoom(hong, root);
    nodes = await flowNodes(hong);
    expect(nodes.find((n) => n.room === gather.to_room_id)?.status).toBe('done');
    const reason = '추가 비용 300만 원 초과';
    await openRoom(hong, root);
    await openHandover(hong);
    const dlg = hong.locator('.handover-dialog');
    await dlg.getByLabel('지금까지 한 일').fill('고객 요청 접수');
    await dlg.getByLabel('다음에 할 일').fill('본부장 승인');
    await dlg.getByLabel('지시사항').fill(`긴급 생산 추가 비용에 대한 승인을 요청합니다 ${s}`);
    await dlg.getByLabel('인계 사유').fill(reason);
    await dlg
        .getByPlaceholder(/검색|Search/)
        .first()
        .fill(PEOPLE.lee.name);
    await dlg.locator('.e2e-assignee-item', { hasText: PEOPLE.lee.name }).first().click();
    await dlg.getByRole('button', { name: /^인계하기$/ }).click();
    await expect(dlg).toBeHidden({ timeout: 120_000 });
    const approve = await waitUntil(async () => {
        const r = await rest(`handover_events?source=eq.chat_handover&from_room_id=eq.${root}&group_id=is.null&select=*`);
        return r[0] || null;
    }, '본부장 승인 인계');

    // 8) 이팀장: 받은 방이 대화 목록에 보이고(에이전트가 함께 있다), 작업 흐름 탭에 그림처럼 보인다
    const [approveRoom] = await rest(`chat_rooms?id=eq.${approve.to_room_id}&select=name,participants`);
    expect((approveRoom.participants || []).some((p: any) => p.id === 'process-gpt-agent')).toBe(true);
    await lee.goto(`${BASE}/definition-map`, { waitUntil: 'domcontentloaded' });
    await expect(
        lee
            .locator('.chat-room-item, [class*=chat-room-item]')
            .filter({ hasText: approveRoom.name.slice(0, 12) })
            .first()
    ).toBeVisible({
        timeout: 60_000
    });
    await openRoom(lee, approve.to_room_id);
    // 받은 방 위쪽의 이전 대화 — 시작 방의 사람·에이전트 대화가 이어져 보인다
    await expect(lee.locator('.e2e-handover-history-room').first()).toHaveAttribute('data-room-id', root);
    await expect(lee.locator('.e2e-handover-history-room').first()).toContainText('300개');
    nodes = await flowNodes(lee);
    const roomOf = Object.fromEntries(nodes.map((n) => [n.room, n]));
    const rooms = [
        root,
        prod.to_room_id,
        cost.to_room_id,
        f1.to_room_id,
        f2.to_room_id,
        toAgent.to_room_id,
        gather.to_room_id,
        approve.to_room_id
    ];
    expect(nodes).toHaveLength(8);
    for (const room of rooms) expect(roomOf[room], room).toBeTruthy();
    for (const room of rooms.slice(0, 7)) expect(roomOf[room].status, roomOf[room].text).toBe('done');
    expect(roomOf[approve.to_room_id].status).not.toBe('done');

    // 연결선 — 분기 두 번, 합류 두 번, 배분 조건 이름
    const ids = await lee
        .locator('.e2e-handover-flow-node')
        .evaluateAll((els) => els.map((e) => [e.getAttribute('data-room-id'), e.getAttribute('data-node-id')]));
    const node = Object.fromEntries(ids as [string, string][]);
    const edges = await lee
        .locator('.e2e-handover-flow-edge')
        .evaluateAll((els) => els.map((e) => `${e.getAttribute('data-from')}>${e.getAttribute('data-to')}`));
    const ends = (room: string, side: 'from' | 'to') =>
        edges
            .filter((e) => (side === 'from' ? e.startsWith(`${node[room]}>`) : e.endsWith(`>${node[room]}`)))
            .map((e) => e.split('>')[side === 'from' ? 1 : 0])
            .sort();
    expect(ends(root, 'from')).toEqual([node[prod.to_room_id], node[cost.to_room_id]].sort());
    expect(ends(prod.to_room_id, 'from')).toEqual([node[f1.to_room_id], node[f2.to_room_id]].sort());
    expect(ends(gather.to_room_id, 'to')).toEqual([node[f1.to_room_id], node[f2.to_room_id]].sort());
    expect(ends(approve.to_room_id, 'to')).toEqual([node[gather.to_room_id], node[toAgent.to_room_id]].sort());
    await expect(lee.locator('.e2e-handover-flow-label')).toHaveText([reason]);

    // 세로 스크롤은 패널 하나뿐이다
    const vScrollers = await lee.locator('.artifact-panel').evaluate((panel) => {
        const all = [panel, ...Array.from(panel.querySelectorAll('*'))] as HTMLElement[];
        return all.filter((el) => {
            const oy = getComputedStyle(el).overflowY;
            return (oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 1 && el.offsetParent !== null;
        }).length;
    });
    expect(vScrollers).toBe(1);

    await shot(lee, 'flow-scenario');
    console.log(`[작업 흐름] 이팀장 본부장 승인 방: /chat?roomId=${approve.to_room_id} · 홍길동 시작 방: /chat?roomId=${root}`);
});
