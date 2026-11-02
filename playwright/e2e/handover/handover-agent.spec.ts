/**
 * 에이전트가 실제로 도는 인계 e2e (@agent, 느린 검증).
 *
 * 실제 LLM 에이전트가 문서를 만들고 답하므로 수 분씩 걸리고 결과 문장이 매번 다르다.
 * 기본 실행에서 빼고(--grep-invert @agent), deepagents·인계 처리처럼 에이전트 경로가 바뀐 때만 돌린다.
 *
 * 실행: BASE_URL=http://localhost:8088 SB_SERVICE_KEY=... npx playwright test playwright/e2e/handover --grep @agent
 */
import { expect, test } from '@playwright/test';
import {
    DOC_AGENT,
    PEOPLE,
    chat,
    chatMessages,
    cleanupCreated,
    closeWork,
    completeTodoOnBoard,
    createRoom,
    handover,
    login,
    openHandover,
    openRoom,
    rest,
    shot,
    taskStatus,
    waitUntil
} from './helpers';
import { assertOnlyObserved, expectOnlyThisBusiness, expectVariant, openMining } from './mining';

test.setTimeout(1_800_000);
test.afterEach(cleanupCreated);

test('@agent 두 사람 인계 — 사람이 받은 쪽이 파일을 보고, 받은 방 에이전트도 그 파일을 쓴다', async ({ browser }) => {
    const s = Date.now();
    const hong = await login(browser, PEOPLE.hong);
    const room = await createRoom(hong, `계약서 · 한빛상사 e2e ${s}`, true);
    await openRoom(hong, room);

    // 홍길동이 에이전트와 함께 산출물(docx)을 만든다
    const reply = await chat(
        hong,
        room,
        '한빛상사와 맺을 서버 유지보수 계약서 초안을 짧게(1쪽) 작성해서 docx 파일로 만들어 주세요. 파일 이름은 계약서_한빛상사.docx 로 해 주세요.'
    );
    expect(reply).not.toMatch(/찾지 못했/);
    await openRoom(hong, room);
    expect((await openHandover(hong)).join(' | ')).toContain('계약서_한빛상사.docx');
    await hong.keyboard.press('Escape');

    await openRoom(hong, room);
    const ev = await handover(hong, room, {
        done: '계약서 작성',
        next: '계약서 검토',
        to: PEOPLE.lee.name,
        tab: '사람',
        instruction: '계약 기간과 유지보수 범위를 확인해 주세요.'
    });

    // 이팀장이 받은 방에서 파일을 보고, 방 에이전트가 그 파일을 읽는다
    const lee = await login(browser, PEOPLE.lee);
    await openRoom(lee, ev.to_room_id);
    await expect(lee.locator('body')).toContainText('계약서_한빛상사.docx');
    const answer = await chat(lee, ev.to_room_id, '넘겨받은 계약서_한빛상사.docx 파일을 열어서 계약 당사자와 계약 기간을 알려 주세요.');
    await shot(lee, 'agent-lee-read-file');
    expect(answer).toMatch(/한빛/);

    // 받은 사람이 다시 넘길 때 그 파일이 후보에 있다
    await openRoom(lee, ev.to_room_id);
    expect((await openHandover(lee)).join(' | ')).toContain('계약서_한빛상사.docx');
    await lee.keyboard.press('Escape');

    // 대화 턴이 지나도 인계 기록은 한 건, 받은 방 브리핑도 한 건
    expect(await rest(`handover_events?origin_room_id=eq.${room}&source=eq.chat_handover&select=id`)).toHaveLength(1);
    const briefings = (await chatMessages(ev.to_room_id)).filter((m) => m.role === 'system' && m.handover?.from_room_id === room);
    expect(briefings).toHaveLength(1);
    expect(await taskStatus(ev.to_task_id)).toBe('IN_PROGRESS');
});

test('@agent 에이전트 중간 단계 — 에이전트가 앞선 대화로 일하고, 넘긴 사람이 결과와 파일을 보고 이어 넘긴다', async ({ browser }) => {
    const s = Date.now();
    const [RECEIVE, DRAFT, APPROVE] = [`견적 요청 접수 ${s}`, `견적서 초안 작성 ${s}`, `견적서 승인 ${s}`];
    const hong = await login(browser, PEOPLE.hong);
    const lee = await login(browser, PEOPLE.lee);

    for (let i = 0; i < 4; i++) {
        const tag = `A${i + 1}`;
        const customer = ['대한물산', '서울전자', '한빛상사', '미래기술'][i];
        const room = await createRoom(hong, `견적 요청 · ${customer} ${tag} e2e ${s}`, false);
        await openRoom(hong, room);
        // 요청 내용은 대화로만 남긴다 — 받은 에이전트가 받은 방 id 로 인계 체인을 따라 이 대화를 읽는다
        const input = hong.locator('textarea:not([disabled]):visible').first();
        await input.fill(`${customer} 견적 요청: 서버 ${i + 2}대, 대당 500만원, 납기 4주`);
        await input.press('Enter');
        await waitUntil(async () => (await chatMessages(room)).some((m) => m.role === 'user'), '요청 메시지 저장');
        await openRoom(hong, room);

        const toAgent = await handover(hong, room, {
            done: RECEIVE,
            next: DRAFT,
            to: DOC_AGENT.name,
            tab: '에이전트',
            instruction: `앞선 대화의 고객 요청대로 견적서를 docx 파일로 만들어 주세요. 파일 이름은 견적서_${customer}.docx 로 해 주세요.`
        });
        const result = await waitUntil(
            async () => (await chatMessages(toAgent.to_room_id)).find((m) => m.rowUuid === `handover-result-${toAgent.to_task_id}`),
            `에이전트 결과 ${tag}`,
            900_000,
            10_000
        );
        // 수량은 앞선 대화에만 있다 — 에이전트가 앞선 대화를 받았다는 근거
        expect(String(result.content), String(result.content)).toContain(`${i + 2}대`);
        expect(result.name).toBe(DOC_AGENT.name);
        await openRoom(hong, toAgent.to_room_id);
        const candidates = (await openHandover(hong)).join(' | ');
        expect(candidates).toContain(`견적서_${customer}.docx`);
        expect(candidates).not.toContain('대화 기록');
        await hong.keyboard.press('Escape');

        if (i === 3) {
            // 에이전트가 끝낸 것만으로는 끝난 건이 아니다 — 넘긴 사람이 업무 종료해야 끝
            let view = await openMining(hong, DRAFT);
            expect(view.threads.find((t) => t.origin_room_id === room)?.finished).toBe(false);
            await openRoom(hong, toAgent.to_room_id);
            await closeWork(hong);
            view = await openMining(hong, DRAFT);
            expect(view.threads.find((t) => t.origin_room_id === room)?.finished).toBe(true);
            continue;
        }

        await openRoom(hong, toAgent.to_room_id);
        const toLee = await handover(hong, toAgent.to_room_id, {
            done: DRAFT,
            next: APPROVE,
            to: PEOPLE.lee.name,
            tab: '사람',
            instruction: `${tag} ${s} 승인`
        });
        await openRoom(lee, toLee.to_room_id);
        await expect(lee.locator('body')).toContainText(`견적서_${customer}.docx`);
        await completeTodoOnBoard(lee, toLee.to_task_id, `${tag} ${s} 승인`);
    }

    const view = await openMining(hong, DRAFT, 'agent-mining');
    expectOnlyThisBusiness(view.disc, [RECEIVE, DRAFT, APPROVE]);
    expectVariant(view.disc, [RECEIVE, DRAFT, APPROVE], 3);
    assertOnlyObserved(view.disc);
});
