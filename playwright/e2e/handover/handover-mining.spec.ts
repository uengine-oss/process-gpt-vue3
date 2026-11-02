/**
 * 인계 기록 → 프로세스 식별 e2e (사람만, 빠른 검증).
 *
 *  - 스레드는 마지막으로 받은 할 일이 완료돼야 끝난 건으로 도출에 들어간다. 진행 중인 건은 결과를 바꾸지 않는다.
 *  - 도출된 단계와 흐름은 기록에서 관측된 것만으로 이루어진다(반려 반복 · 갈래).
 *  - 식별한 프로세스를 담당자를 정해 제안하고, 승인·병합하면 정식 프로세스로 저장된다.
 *
 * 테스트마다 자기 데이터를 만들고 끝나면 지운다. 업무 이름에 실행별 도장을 붙여 앞선 실행·실제 데이터와 섞이지 않는다.
 * 에이전트가 실제로 도는 흐름은 handover-agent.spec.ts(@agent)에 있다.
 *
 * 실행: BASE_URL=http://localhost:8088 SB_SERVICE_KEY=... npx playwright test playwright/e2e/handover --grep-invert @agent
 */
import { expect, test, type Page } from '@playwright/test';
import {
    BASE,
    PEOPLE,
    chatMessages,
    cleanupCreated,
    completeTodoOnBoard,
    createRoom,
    handover,
    login,
    myId,
    openRoom,
    rest,
    restDelete,
    shot,
    taskStatus,
    waitUntil
} from './helpers';
import { assertOnlyObserved, expectOnlyThisBusiness, expectVariant, openMining } from './mining';

test.setTimeout(300_000);
test.afterEach(cleanupCreated);

/** 홍길동이 새 방에서 업무를 시작해 사람에게 넘긴다. */
async function startThread(hong: Page, roomName: string, h: Parameters<typeof handover>[2]) {
    const room = await createRoom(hong, roomName, false);
    await openRoom(hong, room);
    const ev = await handover(hong, room, h);
    return { room, ev };
}

/** 받은 방에서 다음 사람에게 넘긴다. */
async function pass(page: Page, fromRoom: string, h: Parameters<typeof handover>[2]) {
    await openRoom(page, fromRoom);
    return handover(page, fromRoom, h);
}

test('두 사람 인계 — 받은 사람이 할 일을 끝내야 끝난 건이고, 진행 중인 건은 결과를 바꾸지 않는다', async ({ browser }) => {
    const s = Date.now();
    const WRITE = `계약서 작성 ${s}`;
    const REVIEW = `계약서 검토 ${s}`;
    const hong = await login(browser, PEOPLE.hong);
    const lee = await login(browser, PEOPLE.lee);
    const start = (tag: string) =>
        startThread(hong, `계약서 · ${tag} e2e`, {
            done: WRITE,
            next: REVIEW,
            to: PEOPLE.lee.name,
            tab: '사람',
            instruction: `${tag} ${s} 계약 조건 확인`
        });

    const t1 = await start('A');
    // 받은 일은 받은 사람의 업무 목록 '진행 중' 에 있고, 끝내기 전에는 끝난 건이 아니다
    expect(await taskStatus(t1.ev.to_task_id)).toBe('IN_PROGRESS');
    await completeTodoOnBoard(lee, t1.ev.to_task_id, `A ${s} 계약 조건 확인`);
    for (const tag of ['B', 'C']) {
        const t = await start(tag);
        await completeTodoOnBoard(lee, t.ev.to_task_id, `${tag} ${s} 계약 조건 확인`);
    }

    let view = await openMining(hong, WRITE, 'mining-two-person');
    expectOnlyThisBusiness(view.disc, [WRITE, REVIEW]);
    expectVariant(view.disc, [WRITE, REVIEW], 3);
    assertOnlyObserved(view.disc);
    const tree = view.disc.tree;

    // 진행 중인 건을 하나 더 만들어도 도출 결과는 같고, 그 건은 진행 중으로 보인다
    const open = await start('D');
    view = await openMining(hong, WRITE);
    expect(view.threads.find((t) => t.origin_room_id === open.room)?.finished).toBe(false);
    await expect(hong.locator(`.e2e-thread[data-room-id="${open.room}"][data-finished="false"]`)).toBeVisible();
    expect(view.disc.tree).toBe(tree);
    expect(view.disc.stats.case_count).toBe(3);
});

test('반려 후 재검토 — 반복이 반복으로 나오고, 넘기면 내가 받은 할 일이 끝난다', async ({ browser }) => {
    const s = Date.now();
    const [WRITE, REVIEW, FIX, SEND] = [`견적서 작성 ${s}`, `견적 검토 ${s}`, `견적서 수정 ${s}`, `고객 발송 ${s}`];
    const hong = await login(browser, PEOPLE.hong);
    const lee = await login(browser, PEOPLE.lee);
    const park = await login(browser, PEOPLE.park);

    for (const [idx, rejects] of [0, 1, 2].entries()) {
        const tag = `R${idx + 1}-${s}`;
        let { room, ev } = await startThread(hong, `견적 · ${tag} e2e`, {
            done: WRITE,
            next: REVIEW,
            to: PEOPLE.lee.name,
            tab: '사람',
            instruction: `${tag} 단가 검토`
        });
        for (let k = 0; k < rejects; k++) {
            const back = await pass(lee, ev.to_room_id, {
                done: REVIEW,
                next: FIX,
                to: PEOPLE.hong.name,
                tab: '사람',
                instruction: `${tag} 반려 ${k}`
            });
            // 넘기는 순간 내가 받은 할 일은 끝난다(화면에서 한 일과 기록이 같다)
            expect(await taskStatus(ev.to_task_id)).toBe('DONE');
            ev = await pass(hong, back.to_room_id, {
                done: FIX,
                next: REVIEW,
                to: PEOPLE.lee.name,
                tab: '사람',
                instruction: `${tag} 수정본 ${k}`
            });
            expect(await taskStatus(back.to_task_id)).toBe('DONE');
        }
        const send = await pass(lee, ev.to_room_id, {
            done: REVIEW,
            next: SEND,
            to: PEOPLE.park.name,
            tab: '사람',
            instruction: `${tag} 고객 발송`
        });
        expect(await taskStatus(ev.to_task_id)).toBe('DONE');
        await completeTodoOnBoard(park, send.to_task_id, `${tag} 고객 발송`);

        // 인계 기록은 넘긴 횟수만큼, 방마다 보낸 알림·받은 브리핑이 한 건씩
        const rows = await rest(`handover_events?origin_room_id=eq.${room}&source=eq.chat_handover&select=from_room_id,to_room_id`);
        expect(rows.length).toBe(2 + rejects * 2);
        for (const r of rows) {
            const to = await chatMessages(r.to_room_id);
            expect(to.filter((m) => m.role === 'system' && m.handover?.from_room_id === r.from_room_id).length).toBe(1);
        }
    }

    const view = await openMining(hong, FIX, 'mining-rework');
    expectOnlyThisBusiness(view.disc, [WRITE, REVIEW, FIX, SEND]);
    expect(view.disc.tree).toContain(`loop('${REVIEW}', '${FIX}')`);
    assertOnlyObserved(view.disc);
});

test('갈래 — 승인자가 나뉘는 업무가 갈래로 나오고, 갈래 안 단계는 필수로 남는다', async ({ browser }) => {
    const s = Date.now();
    const [RECEIVE, LEAD, BUDGET, ORDER] = [`구매 요청 접수 ${s}`, `팀장 승인 ${s}`, `예산 검토 ${s}`, `발주 처리 ${s}`];
    const hong = await login(browser, PEOPLE.hong);
    const lee = await login(browser, PEOPLE.lee);
    const park = await login(browser, PEOPLE.park);

    for (let i = 0; i < 4; i++) {
        const tag = `P${i + 1}-${s}`;
        const [who, step, to] = i % 2 === 0 ? [lee, LEAD, PEOPLE.lee.name] : [park, BUDGET, PEOPLE.park.name];
        const { ev } = await startThread(hong, `구매 · ${tag} e2e`, {
            done: RECEIVE,
            next: step,
            to,
            tab: '사람',
            instruction: `${tag} 요청 확인`
        });
        const back = await pass(who, ev.to_room_id, {
            done: step,
            next: ORDER,
            to: PEOPLE.hong.name,
            tab: '사람',
            instruction: `${tag} 발주`
        });
        await completeTodoOnBoard(hong, back.to_task_id, `${tag} 발주`);
    }

    const view = await openMining(hong, RECEIVE, 'mining-branch');
    expectOnlyThisBusiness(view.disc, [RECEIVE, LEAD, BUDGET, ORDER]);
    expect(view.disc.tree).toMatch(new RegExp(`xor\\('(${LEAD}|${BUDGET})', '(${LEAD}|${BUDGET})'\\)`));
    assertOnlyObserved(view.disc);
});

test('제안 — 담당자를 정해 병합함으로 보내고, 승인·병합하면 정식 프로세스로 저장된다', async ({ browser }) => {
    const s = Date.now();
    const [WRITE, REVIEW] = [`제안 작성 ${s}`, `제안 검토 ${s}`];
    const hong = await login(browser, PEOPLE.hong);
    const lee = await login(browser, PEOPLE.lee);
    for (const tag of ['A', 'B', 'C']) {
        const { ev } = await startThread(hong, `제안 · ${tag} e2e`, {
            done: WRITE,
            next: REVIEW,
            to: PEOPLE.lee.name,
            tab: '사람',
            instruction: `${tag} ${s} 검토`
        });
        await completeTodoOnBoard(lee, ev.to_task_id, `${tag} ${s} 검토`);
    }
    const view = await openMining(hong, WRITE);
    const procDefId = view.disc.definition.processDefinitionId;
    let prId = '';
    try {
        await hong.locator('.e2e-propose-pr').click();
        const dlg = hong.locator('.e2e-propose-dialog');
        await expect(dlg).toBeVisible();
        const title = `[식별] 제안 e2e ${s}`;
        await dlg.getByLabel('제목').fill(title);
        // 사람처럼 칸을 누르고 친다(기본값인 본인 이름이 선택돼 있어 치면 바뀐다)
        const owner = dlg.locator('.e2e-propose-owner input');
        await owner.click();
        await owner.pressSequentially(PEOPLE.lee.name);
        await hong.locator('.v-overlay .v-list-item', { hasText: PEOPLE.lee.name }).first().click();
        await dlg.locator('.e2e-propose-submit').click();
        await expect(hong.locator('.e2e-pr-result')).toBeVisible({ timeout: 30_000 });

        // 새 프로세스 제안 — 기준 브랜치 없음, 숨김 정의, 담당자 소유, BPMN 스냅샷을 가진 v0.x 버전
        const [pr] = await rest(`resource_pull_requests?title=eq.${encodeURIComponent(title)}&select=*`);
        prId = pr.id;
        expect(pr.branch_name).toMatch(/^v\d+\.\d+$/);
        expect(pr.base_branch).toBe('');
        expect(pr.requester_name).toBe(PEOPLE.hong.name);
        const version = pr.branch_name.slice(1);
        const [ver] = await rest(`proc_def_version?proc_def_id=eq.${procDefId}&version=eq.${version}&select=snapshot`);
        expect(String(ver.snapshot || '')).toContain(WRITE);
        const [def] = await rest(`proc_def?id=eq.${procDefId}&select=owner,is_draft`);
        expect(def.is_draft).toBe(true);
        expect(def.owner).toBe(await myId(lee));

        // 담당자의 병합함에서 열고 승인 → 병합
        await lee.goto(`${BASE}/merge-requests`, { waitUntil: 'domcontentloaded' });
        const card = lee.locator('.mrb-item', { hasText: title });
        await expect(card).toBeVisible({ timeout: 30_000 });
        await card.click();
        await lee.locator('.pab-btn', { hasText: '승인' }).last().click();
        await lee.locator('.pab-compose-foot .pab-btn').last().click();
        await waitUntil(async () => (await rest(`resource_pull_requests?id=eq.${pr.id}&select=status`))[0]?.status === 'APPROVED', '승인');
        await lee.locator('.pab-btn.merge').click();
        await waitUntil(async () => (await rest(`resource_pull_requests?id=eq.${pr.id}&select=status`))[0]?.status === 'MERGED', '병합');

        // 정식 프로세스로 저장 — 숨김이 풀리고 제안 버전에서 갈라진 새 메이저 버전
        const [saved] = await rest(`proc_def?id=eq.${procDefId}&select=is_draft,bpmn`);
        expect(saved.is_draft).toBe(false);
        expect(String(saved.bpmn || '')).toContain(WRITE);
        const majors = await rest(`proc_def_version?proc_def_id=eq.${procDefId}&version_tag=eq.major&select=parent_version`);
        expect(majors.some((m: any) => m.parent_version === version)).toBe(true);
        await shot(lee, 'propose-merged');
    } finally {
        // 이 테스트가 만든 정의·버전·병합 요청을 지운다
        if (prId) await restDelete(`resource_pull_requests?id=eq.${prId}`).catch(() => undefined);
        await restDelete(`proc_def_version?proc_def_id=eq.${procDefId}`).catch(() => undefined);
        await restDelete(`proc_def?id=eq.${procDefId}`).catch(() => undefined);
    }
});
