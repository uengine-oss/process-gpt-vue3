/**
 * 병렬 인계 e2e.
 *
 * 한 번의 인계로 여러 사람(에이전트)에게 일을 나눠 준다. 받는 사람마다 새 방이 생기고, 같은 인계에서
 * 나온 기록은 같은 묶음(group_id)으로 남는다. 스레드에 참여한 방 어디서나 작업 흐름 카드로 갈래별
 * 담당자와 진행 상태를 본다. 갈래 끝이 모두 끝나야 스레드가 식별에 들어가고, 반복되면
 *   - 서로 다른 일을 나눠 준 단계는 병렬(병렬 게이트웨이)로
 *   - 같은 일을 여러 명에게 준 단계는 다중 인스턴스(||| 표시)로
 * 도출된다.
 *
 * 실행: BASE_URL=http://localhost:8088 SB_SERVICE_KEY=... LEE_PASSWORD=... \
 *       npx playwright test playwright/e2e/handover/handover-parallel.spec.ts
 */
import { expect, test, type Page } from '@playwright/test';
import {
    BASE,
    DOC_AGENT,
    PEOPLE,
    cleanupCreated,
    completeTodoOnBoard,
    createRoom,
    login,
    openHandover,
    openRoom,
    rest,
    shot,
    taskStatus,
    waitUntil,
    flowNodes,
    handoverMany
} from './helpers';
import { openMining, renderedXml } from './mining';

test.setTimeout(300_000);
test.afterEach(cleanupCreated);

function byUser(rows: any[], email: string) {
    return rows.find((r) => r.to_user_name === Object.values(PEOPLE).find((p) => p.email === email)?.name);
}

const stamp = Date.now();
const START = `계약 요청 접수 ${stamp}`;
const LEGAL = `법무 검토 ${stamp}`;
const FINANCE = `재무 검토 ${stamp}`;
const MI_START = `견적 요청 접수 ${stamp}`;
const MI_STEP = `견적 검토 ${stamp}`;

test('여러 명에게 한 번에 넘기면 각자 새 방에서 앞선 대화를 보고, 갈래끼리 섞이지 않으며, 흐름 카드로 진행을 본다', async ({ browser }) => {
    const hong = await login(browser, PEOPLE.hong);
    const lee = await login(browser, PEOPLE.lee);
    const park = await login(browser, PEOPLE.park);

    // 병렬 단계가 반복되도록 같은 모양의 업무를 세 번 처리한다
    for (let i = 0; i < 3; i++) {
        const room = await createRoom(hong, `병렬 인계 e2e ${stamp}-${i}`, true);
        await openRoom(hong, room);
        const instruction = `병렬 ${stamp}-${i} 검토 부탁드립니다`;
        const rows = await handoverMany(hong, room, START, instruction, [
            { to: PEOPLE.lee.name, next: LEGAL },
            { to: PEOPLE.park.name, next: FINANCE }
        ]);
        expect(rows).toHaveLength(2);
        expect(new Set(rows.map((r) => r.group_id)).size).toBe(1);
        const legal = byUser(rows, PEOPLE.lee.email);
        const finance = byUser(rows, PEOPLE.park.email);
        expect(legal.next_activity_label).toBe(LEGAL);
        expect(finance.next_activity_label).toBe(FINANCE);
        expect(legal.to_room_id).not.toBe(finance.to_room_id);

        if (i === 0) {
            // 받은 사람은 각자 새 방에서 시작 방의 대화를 본다. 다른 갈래 방의 대화는 섞이지 않는다.
            await openRoom(park, finance.to_room_id);
            const parkNote = `재무 갈래에서만 한 이야기 ${stamp}`;
            await park.evaluate(
                async ({ roomId, text }) => {
                    await (window as any).$supabase.from('chats').insert({
                        uuid: crypto.randomUUID(),
                        id: roomId,
                        tenant_id: (window as any).$tenantName,
                        messages: {
                            role: 'user',
                            name: localStorage.getItem('userName'),
                            email: localStorage.getItem('email'),
                            content: text,
                            timeStamp: new Date().toISOString()
                        }
                    });
                },
                { roomId: finance.to_room_id, text: parkNote }
            );
            await openRoom(lee, legal.to_room_id);
            const history = lee.locator('.e2e-handover-history-room');
            await expect(history).toHaveCount(1, { timeout: 60_000 });
            await expect(history.first()).toHaveAttribute('data-room-id', room);
            await expect(lee.locator('.e2e-handover-history')).not.toContainText(parkNote);

            // 흐름 카드: 시작 방 + 두 갈래, 두 갈래 모두 진행 중
            let nodes = await flowNodes(lee);
            expect(nodes.map((n) => n.room)).toEqual([room, legal.to_room_id, finance.to_room_id]);
            expect(nodes.slice(1).map((n) => n.status)).toEqual(['progress', 'progress']);
            await shot(lee, 'parallel-flow-progress');

            // 한 갈래가 끝나도 다른 갈래가 진행 중이면 스레드는 끝나지 않는다
            await completeTodoOnBoard(lee, legal.to_task_id, instruction);
            await openRoom(park, finance.to_room_id);
            nodes = await flowNodes(park);
            expect(nodes.find((n) => n.room === legal.to_room_id)?.status).toBe('done');
            expect(nodes.find((n) => n.room === finance.to_room_id)?.status).toBe('progress');
            const threads = await hong.evaluate(async () => {
                const k = Object.keys(localStorage).find((x) => /auth-token/.test(x)) as string;
                const tok = JSON.parse(localStorage.getItem(k) as string).access_token;
                const r = await fetch(`/process-miner/threads?tenant_id=${(window as any).$tenantName}&limit=1000`, {
                    headers: { Authorization: `Bearer ${tok}` }
                });
                return (await r.json()).threads;
            });
            expect(threads.find((t: any) => t.origin_room_id === room)?.finished).toBe(false);

            await completeTodoOnBoard(park, finance.to_task_id, instruction);
            await openRoom(park, finance.to_room_id);
            nodes = await flowNodes(park);
            expect(nodes.slice(1).map((n) => n.status)).toEqual(['done', 'done']);
            await shot(park, 'parallel-flow-done');
        } else {
            await completeTodoOnBoard(lee, legal.to_task_id, instruction);
            await completeTodoOnBoard(park, finance.to_task_id, instruction);
        }
        expect(await taskStatus(legal.to_task_id)).toBe('DONE');
        expect(await taskStatus(finance.to_task_id)).toBe('DONE');
    }

    // 다른 일을 나눠 준 단계는 병렬로 도출된다
    const { disc } = await openMining(hong, LEGAL);
    expect(disc.tree, disc.tree).toContain('and(');
    expect(disc.stats.case_count).toBe(3);
    await expect(hong.locator('[data-element-id^="gateway_parallel"]:not([data-element-id$="_label"])')).toHaveCount(2, {
        timeout: 30_000
    });
    // 병렬 분기·합류는 병렬 게이트웨이(+)로 그린다 — 배타(X)로 그리면 선택처럼 보인다
    const xml = await renderedXml(hong);
    expect(xml.match(/<bpmn:parallelGateway /g) || []).toHaveLength(2);
    expect(xml).not.toContain('<bpmn:exclusiveGateway ');
    await shot(hong, 'parallel-mining');
});

test('나눠 준 갈래가 끝난 뒤 다음 일로 넘기면 흐름 그림에 합류로 보이고, 인계 사유가 연결선 이름으로 보인다', async ({ browser }) => {
    const hong = await login(browser, PEOPLE.hong);
    const lee = await login(browser, PEOPLE.lee);
    const park = await login(browser, PEOPLE.park);
    const room = await createRoom(hong, `합류 e2e ${stamp}`, true);
    await openRoom(hong, room);
    const instruction = `합류 ${stamp} 확인`;
    const rows = await handoverMany(hong, room, `요청 접수 ${stamp}`, instruction, [
        { to: PEOPLE.lee.name, next: `1공장 수량 확인 ${stamp}` },
        { to: PEOPLE.park.name, next: `2공장 수량 확인 ${stamp}` }
    ]);
    await completeTodoOnBoard(lee, byUser(rows, PEOPLE.lee.email).to_task_id, instruction);
    await completeTodoOnBoard(park, byUser(rows, PEOPLE.park.email).to_task_id, instruction);

    // 두 갈래가 끝난 뒤 같은 방에서 다음 일을 넘긴다 — 사유를 적는다
    const reason = `두 공장 합계 300개 이상 ${stamp}`;
    await openRoom(hong, room);
    await openHandover(hong);
    const dlg = hong.locator('.handover-dialog');
    await dlg.getByLabel('다음에 할 일').fill(`생산 결과 취합 ${stamp}`);
    await dlg.getByLabel('인계 사유').fill(reason);
    await dlg
        .getByPlaceholder(/검색|Search/)
        .first()
        .fill(PEOPLE.lee.name);
    await dlg.locator('.e2e-assignee-item', { hasText: PEOPLE.lee.name }).first().click();
    await dlg.getByRole('button', { name: /^인계하기$/ }).click();
    await expect(dlg).toBeHidden({ timeout: 120_000 });
    const join = await waitUntil(async () => {
        const r = await rest(`handover_events?source=eq.chat_handover&from_room_id=eq.${room}&group_id=is.null&select=*`);
        return r[0] || null;
    }, '합류 인계 기록');

    await openRoom(lee, join.to_room_id);
    const nodes = await flowNodes(lee);
    // 시작 카드 + 두 갈래 + 취합, 모두 한 그림에
    expect(nodes[0].room).toBe(room);
    expect(new Set(nodes.map((n) => n.room))).toEqual(new Set([room, rows[0].to_room_id, rows[1].to_room_id, join.to_room_id]));
    const ids = await lee
        .locator('.e2e-handover-flow-node')
        .evaluateAll((els) => els.map((e) => [e.getAttribute('data-room-id'), e.getAttribute('data-node-id')]));
    const nodeOf = Object.fromEntries(ids as [string, string][]);
    const edges = await lee
        .locator('.e2e-handover-flow-edge')
        .evaluateAll((els) => els.map((e) => [e.getAttribute('data-from'), e.getAttribute('data-to')]));
    // 두 갈래의 카드에서 취합 카드로 모인다(시작 카드에서 바로 오지 않는다)
    const into = edges
        .filter(([, to]) => to === nodeOf[join.to_room_id])
        .map(([from]) => from)
        .sort();
    expect(into).toEqual([nodeOf[rows[0].to_room_id], nodeOf[rows[1].to_room_id]].sort());
    await expect(lee.locator('.e2e-handover-flow-label')).toContainText(reason);
    await shot(lee, 'flow-join');
});

test('같은 일을 여러 명에게 한 번에 넘긴 단계는 다중 인스턴스로 도출된다', async ({ browser }) => {
    const hong = await login(browser, PEOPLE.hong);
    const lee = await login(browser, PEOPLE.lee);
    const park = await login(browser, PEOPLE.park);
    for (let i = 0; i < 3; i++) {
        const room = await createRoom(hong, `다중 인계 e2e ${stamp}-${i}`, true);
        await openRoom(hong, room);
        const instruction = `다중 ${stamp}-${i} 각자 검토`;
        const rows = await handoverMany(hong, room, MI_START, instruction, [
            { to: PEOPLE.lee.name, next: MI_STEP },
            { to: PEOPLE.park.name, next: MI_STEP }
        ]);
        await completeTodoOnBoard(lee, byUser(rows, PEOPLE.lee.email).to_task_id, instruction);
        await completeTodoOnBoard(park, byUser(rows, PEOPLE.park.email).to_task_id, instruction);
    }
    const { disc } = await openMining(hong, MI_STEP);
    expect(disc.stats.multi_instance_activities).toEqual([MI_STEP]);
    expect(disc.tree).toBe(`seq('${MI_START}', '${MI_STEP}')`);
    await expect(hong.locator('[data-marker="parallel"]')).toHaveCount(1, { timeout: 30_000 });
    expect((await renderedXml(hong)).match(/multiInstanceLoopCharacteristics/g) || []).toHaveLength(1);
    await shot(hong, 'multi-instance-mining');
});

test('사람과 에이전트를 섞어 한 번에 넘길 수 있다', async ({ browser }) => {
    const hong = await login(browser, PEOPLE.hong);
    const room = await createRoom(hong, `혼합 인계 e2e ${stamp}`, true);
    await openRoom(hong, room);
    const rows = await handoverMany(hong, room, `혼합 접수 ${stamp}`, `혼합 ${stamp}`, [
        { to: PEOPLE.lee.name, next: `혼합 검토 ${stamp}` },
        { to: DOC_AGENT.name, tab: '에이전트', next: `혼합 초안 작성 ${stamp}` }
    ]);
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((r) => r.group_id)).size).toBe(1);
    const agentRow = rows.find((r) => r.to_is_agent);
    const personRow = rows.find((r) => !r.to_is_agent);
    expect(agentRow?.to_user_id).toBe(DOC_AGENT.id);
    expect(personRow?.to_user_name).toBe(PEOPLE.lee.name);
    // 에이전트가 받은 일은 폴러가 집어 가도록 라우팅된다
    const [task] = await rest(`todolist?id=eq.${agentRow.to_task_id}&select=agent_mode,agent_orch`);
    expect(task.agent_mode).toBeTruthy();
    // 넘긴 방에는 두 사람에게 넘겼다는 기록이 한 번 남는다
    await openRoom(hong, room);
    await expect(
        hong
            .locator('.chat-message-row')
            .filter({ hasText: `혼합 검토 ${stamp}` })
            .filter({ hasText: `혼합 초안 작성 ${stamp}` })
    ).toHaveCount(1);
});
