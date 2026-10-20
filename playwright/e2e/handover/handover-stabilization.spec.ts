/**
 * 인계 기반 프로세스 식별 안정화 — 인수조건 e2e (todo-2026-10-20).
 *
 *  1. 인계 대상이 누구든 받는 쪽은 넘긴 결과와 파일을 보고 다음 담당자에게 인계할 수 있다.
 *  2. 인계 기록은 보낸 쪽과 받는 쪽 각각 한 건씩 남는다. 덮어써지거나 대화 턴 때문에 늘지 않는다.
 *  3. 스레드는 마지막으로 받은 할 일이 완료돼야 끝난 건으로 도출에 들어간다.
 *  4. 도출된 단계와 흐름은 기록에서 관측된 것만으로 이루어진다.
 *  5. 위 성질을 네 가지 형태의 업무로 확인한다 — 반려 후 재검토 · 갈래 · 에이전트 중간 단계 · 두 사람 인계.
 *
 * 실행: BASE_URL=http://localhost:8088 SB_SERVICE_KEY=... npx playwright test playwright/e2e/handover
 * 형태별로 -g '두 사람' 처럼 골라 돌릴 수 있다. 앞 단계가 만든 방은 test-results 의 상태 파일로 이어 간다.
 */
import { expect, test, type Page } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import {
    PEOPLE,
    DOC_AGENT,
    login,
    createRoom,
    openRoom,
    chat,
    chatMessages,
    handover,
    openHandover,
    closeWork,
    taskStatus,
    completeTodoOnBoard,
    rest,
    waitUntil,
    shot
} from './helpers';

const OUT = 'playwright/handover-e2e';
const STATE = `${OUT}/state.json`;
mkdirSync(OUT, { recursive: true });
const state: Record<string, any> = existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf-8')) : {};
const save = () => writeFileSync(STATE, JSON.stringify(state, null, 2));

test.describe.configure({ mode: 'serial', timeout: 1_800_000 });

/** 방 메시지 중 인계 알림(보낸 쪽)과 브리핑(받는 쪽) 수. */
async function handoverNotes(roomId: string) {
    const msgs = await chatMessages(roomId);
    return {
        sent: msgs.filter((m) => m.role === 'system' && /업무를 인계했습니다/.test(m.content || '')).length,
        briefing: msgs.filter((m) => m.role === 'system' && /님이 업무를 넘겼습니다/.test(m.content || '')).length
    };
}

async function filesPanelText(page: Page): Promise<string> {
    return (await page.locator('body').innerText()).replace(/\s+/g, ' ');
}

test('두 사람 인계 — 사람이 받은 쪽이 파일을 보고, 받은 방 에이전트도 그 파일을 쓴다 (AC1·AC2)', async ({ browser }) => {
    const hong = await login(browser, PEOPLE.hong);
    const roomName = `계약서 · 한빛상사 e2e ${Date.now() % 100000}`;
    const room = await createRoom(hong, roomName, true);
    state.twoPerson = { rooms: [room] };
    save();
    await openRoom(hong, room);

    // 홍길동이 에이전트와 함께 산출물(docx)을 만든다
    const reply = await chat(
        hong,
        room,
        '한빛상사와 맺을 서버 유지보수 계약서 초안을 짧게(1쪽) 작성해서 docx 파일로 만들어 주세요. 파일 이름은 계약서_한빛상사.docx 로 해 주세요.'
    );
    expect(reply).not.toMatch(/찾지 못했/);
    await openRoom(hong, room);
    const candidates = await openHandover(hong);
    await shot(hong, '01-hong-handover-candidates');
    expect(candidates.join(' | ')).toContain('계약서_한빛상사.docx');
    await hong.keyboard.press('Escape');

    await openRoom(hong, room);
    const ev = await handover(hong, room, {
        done: '계약서 작성',
        next: '계약서 검토',
        to: PEOPLE.lee.name,
        tab: '사람',
        instruction: '계약 기간과 유지보수 범위를 확인해 주세요.'
    });
    state.twoPerson.first = ev;
    save();

    // AC2 — 보낸 방 알림 1건, 받은 방 브리핑 1건
    expect(await handoverNotes(room)).toEqual({ sent: 1, briefing: 0 });
    expect(await handoverNotes(ev.to_room_id)).toEqual({ sent: 0, briefing: 1 });

    // AC1 — 이팀장이 받은 방에서 파일을 보고, 방 에이전트가 그 파일을 읽는다
    const lee = await login(browser, PEOPLE.lee);
    await openRoom(lee, ev.to_room_id);
    await shot(lee, '02-lee-received-room');
    expect(await filesPanelText(lee)).toContain('계약서_한빛상사.docx');
    const answer = await chat(
        lee,
        ev.to_room_id,
        '넘겨받은 계약서_한빛상사.docx 파일을 열어서 계약 당사자와 계약 기간을 알려 주세요.'
    );
    await shot(lee, '03-lee-agent-read-file');
    expect(answer).not.toMatch(/찾지 못했|없습니다|존재하지 않/);
    expect(answer).toMatch(/한빛/);

    // 받은 사람이 다시 넘길 때 그 파일이 후보에 있다
    await openRoom(lee, ev.to_room_id);
    const leeCandidates = await openHandover(lee);
    await shot(lee, '04-lee-handover-candidates');
    expect(leeCandidates.join(' | ')).toContain('계약서_한빛상사.docx');
    await lee.keyboard.press('Escape');

    // AC2 — 대화 턴이 지나도 인계 기록은 그대로
    expect(await handoverNotes(room)).toEqual({ sent: 1, briefing: 0 });
    expect(await handoverNotes(ev.to_room_id)).toEqual({ sent: 0, briefing: 1 });
    const thread = await rest(`handover_events?origin_room_id=eq.${room}&source=eq.chat_handover&select=id`);
    expect(thread.length).toBe(1);
    // 받은 일은 받은 사람의 업무 목록 '진행 중' 에 뜬다
    expect(await taskStatus(ev.to_task_id)).toBe('IN_PROGRESS');
});

// ---------------------------------------------------------------------------
// 식별 화면 — 화면이 받은 도출 결과로 성질을 확인한다
// ---------------------------------------------------------------------------
type Tree = { kind: string; label?: string; children: Tree[] };

/** 마이너 트리 표기 seq('a', xor('b', τ), loop(...)) 를 읽는다. */
function parseTree(src: string): Tree {
    let i = 0;
    const ws = () => {
        while (src[i] === ' ' || src[i] === ',') i++;
    };
    const node = (): Tree => {
        ws();
        if (src[i] === "'") {
            const end = src.indexOf("'", i + 1);
            const label = src.slice(i + 1, end);
            i = end + 1;
            return { kind: 'act', label, children: [] };
        }
        if (src[i] === 'τ') {
            i++;
            return { kind: 'tau', children: [] };
        }
        const open = src.indexOf('(', i);
        const kind = src.slice(i, open);
        i = open + 1;
        const children: Tree[] = [];
        ws();
        while (src[i] !== ')') {
            children.push(node());
            ws();
        }
        i++;
        return { kind, children };
    };
    return node();
}

function shuffles(a: string[], b: string[]): string[][] {
    if (!a.length) return [b];
    if (!b.length) return [a];
    return [...shuffles(a.slice(1), b).map((t) => [a[0], ...t]), ...shuffles(a, b.slice(1)).map((t) => [b[0], ...t])];
}

/** 트리가 허용하는 실행 순서(반복은 두 번까지). */
function language(t: Tree, loops = 2): string[][] {
    const uniq = (xs: string[][]) => [...new Map(xs.map((x) => [x.join('\u0001'), x])).values()];
    if (t.kind === 'act') return [[t.label!]];
    if (t.kind === 'tau') return [[]];
    const langs = t.children.map((c) => language(c, loops));
    if (t.kind === 'seq') return uniq(langs.reduce((acc, l) => acc.flatMap((a) => l.map((b) => [...a, ...b])), [[]] as string[][]));
    if (t.kind === 'xor') return uniq(langs.flat());
    if (t.kind === 'and') return uniq(langs.reduce((acc, l) => acc.flatMap((a) => l.flatMap((b) => shuffles(a, b))), [[]] as string[][]));
    if (t.kind === 'loop') {
        const body = langs[0];
        const redo = uniq(langs.slice(1).flat());
        let out = [...body];
        let frontier = [...body];
        for (let k = 0; k < loops; k++) {
            frontier = frontier.flatMap((f) => redo.flatMap((r) => body.map((b) => [...f, ...r, ...b])));
            out = out.concat(frontier);
        }
        return uniq(out);
    }
    throw new Error(`모르는 연산자 ${t.kind}`);
}

const df = (traces: string[][]) => {
    const s = new Set<string>();
    for (const t of traces) {
        if (!t.length) continue;
        s.add(`▶→${t[0]}`);
        s.add(`${t[t.length - 1]}→■`);
        for (let k = 0; k + 1 < t.length; k++) s.add(`${t[k]}→${t[k + 1]}`);
    }
    return s;
};

/**
 * 식별 화면을 열고, activity 가 든 업무 묶음을 골라, 화면이 받은 스레드·묶음·도출 결과를 돌려준다.
 * 서로 다른 업무는 묶음으로 갈려 따로 도출된다(한 프로세스의 갈래로 그리지 않는다).
 */
async function openMining(page: Page, shotName: string, activity: string) {
    const threadsRes = page.waitForResponse((r) => r.url().includes('/process-miner/threads'), { timeout: 60_000 });
    const groupsRes = page.waitForResponse((r) => r.url().includes('/process-miner/processes'), { timeout: 60_000 });
    await page.goto(`${BASE_URL}/mining/handover`, { waitUntil: 'domcontentloaded' });
    const threads = (await (await threadsRes).json()).threads as any[];
    const groups = (await (await groupsRes).json()).processes as any[];
    const group = groups.find((g) => g.activities.includes(activity));
    expect(group, `${activity} 가 든 업무 묶음 — ${JSON.stringify(groups.map((g) => g.activities))}`).toBeTruthy();
    const discRes = page.waitForResponse(
        (r) => r.url().includes('/process-miner/discovered') && r.url().includes(`process_key=${group.process_key}`),
        { timeout: 60_000 }
    );
    const chip = page.locator(`.e2e-process-group[data-key="${group.process_key}"]`);
    await expect(chip).toBeVisible({ timeout: 30_000 });
    // 처음 고른 묶음이면 다시 눌러도 요청이 없다 — 그때는 다른 묶음을 거쳐 돌아온다
    const other = groups.find((g) => g.process_key !== group.process_key);
    if (other) await page.locator(`.e2e-process-group[data-key="${other.process_key}"]`).click();
    await chip.click();
    const disc = await (await discRes).json();
    await page.waitForTimeout(3_000);
    await shot(page, shotName);
    return { threads, groups, group, disc };
}

/** 도출 결과의 단계가 이 업무의 단계와 정확히 같다 — 다른 업무가 갈래로 끼지 않았다. */
function expectOnlyThisBusiness(disc: any, activities: string[]) {
    const got = [...new Set((disc.stats?.variants || []).flatMap((v: any) => v.trace))].sort();
    expect(got, disc.tree).toEqual([...activities].sort());
}

/** AC4 — 도출 결과의 단계·흐름이 관측된 것만으로 이루어졌는가. */
function assertOnlyObserved(disc: any) {
    const observed: string[][] = disc.stats.variants.flatMap((v: any) => [v.trace]);
    const model = language(parseTree(disc.tree));
    const acts = (ts: string[][]) => new Set(ts.flat());
    expect([...acts(model)].sort()).toEqual([...acts(observed)].sort());
    const unobserved = [...df(model)].filter((p) => !df(observed).has(p));
    expect(unobserved, `관측되지 않은 순서 — ${disc.tree}`).toEqual([]);
    const always = observed.reduce((acc, t) => acc.filter((a) => t.includes(a)), observed[0] || []);
    for (const t of model) {
        expect(always.filter((a) => !t.includes(a)), `필수 단계를 건너뛰는 경로 ${t.join('→')} — ${disc.tree}`).toEqual([]);
    }
    for (const t of observed) {
        expect(model.some((m) => m.join('\u0001') === t.join('\u0001')), `관측된 흐름을 재현하지 못함 ${t.join('→')}`).toBe(true);
    }
}

const BASE_URL = process.env.BASE_URL || 'http://localhost:8088';

/** 이 흐름이 도출 근거에 최소 n건 있다(로컬 DB 에 앞선 실행의 끝난 건이 함께 쌓인다). */
function expectVariant(disc: any, trace: string[], min: number) {
    const v = (disc.stats?.variants || []).find((x: any) => x.trace.join('→') === trace.join('→'));
    expect(v?.count ?? 0, `${trace.join('→')} — ${JSON.stringify(disc.stats?.variants)}`).toBeGreaterThanOrEqual(min);
}

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

test('두 사람 인계 — 받은 사람이 할 일을 끝내야 끝난 건이고, 진행 중인 건은 결과를 바꾸지 않는다 (AC3·AC4)', async ({ browser }) => {
    const hong = await login(browser, PEOPLE.hong);
    const lee = await login(browser, PEOPLE.lee);
    const first = state.twoPerson.first;

    // 아직 이팀장이 끝내지 않은 첫 건은 진행 중이다
    let view = await openMining(hong, '10-mining-before-complete', '계약서 작성');
    const t1 = view.threads.find((t) => t.origin_room_id === state.twoPerson.rooms[0]);
    expect(t1?.finished).toBe(false);
    await expect(hong.locator(`.e2e-thread[data-finished="false"]`).filter({ hasText: state.twoPerson.rooms[0] })).toBeVisible();

    await completeTodoOnBoard(lee, first.to_task_id, '계약 기간과 유지보수 범위를 확인해 주세요.');

    for (const tag of ['B', 'C']) {
        const { room, ev } = await startThread(hong, `계약서 · ${tag}상사 e2e`, {
            done: '계약서 작성',
            next: '계약서 검토',
            to: PEOPLE.lee.name,
            tab: '사람',
            instruction: `${tag}상사 계약 조건을 확인해 주세요.`
        });
        state.twoPerson.rooms.push(room);
        save();
        await completeTodoOnBoard(lee, ev.to_task_id, `${tag}상사 계약 조건을 확인해 주세요.`);
    }

    view = await openMining(hong, '11-mining-two-person', '계약서 작성');
    expectOnlyThisBusiness(view.disc, ['계약서 작성', '계약서 검토']);
    for (const r of state.twoPerson.rooms) {
        expect(view.threads.find((t) => t.origin_room_id === r)?.finished, r).toBe(true);
    }
    expectVariant(view.disc, ['계약서 작성', '계약서 검토'], 3);
    assertOnlyObserved(view.disc);
    state.twoPerson.tree = view.disc.tree;

    // 진행 중인 건을 하나 더 만들어도 도출 결과는 같다
    const open = await startThread(hong, '계약서 · 진행중상사 e2e', {
        done: '계약서 작성',
        next: '계약서 검토',
        to: PEOPLE.lee.name,
        tab: '사람',
        instruction: '진행중상사 계약 조건을 확인해 주세요.'
    });
    state.twoPerson.openRoom = open.room;
    save();
    view = await openMining(hong, '12-mining-with-open-thread', '계약서 작성');
    expect(view.threads.find((t) => t.origin_room_id === open.room)?.finished).toBe(false);
    await expect(hong.locator(`.e2e-thread[data-finished="false"]`).filter({ hasText: open.room })).toBeVisible();
    expect(view.disc.tree).toBe(state.twoPerson.tree);
});

test('반려 후 재검토 — 반복이 반복으로 나오고, 넘기면 내가 받은 할 일이 끝난다 (AC2·AC3·AC4)', async ({ browser }) => {
    const hong = await login(browser, PEOPLE.hong);
    const lee = await login(browser, PEOPLE.lee);
    const park = await login(browser, PEOPLE.park);
    state.rework = { rooms: [] };

    for (const [idx, rejects] of [0, 1, 2].entries()) {
        const tag = `R${idx + 1}`;
        let { room, ev } = await startThread(hong, `견적 · ${tag} e2e`, {
            done: '견적서 작성',
            next: '견적 검토',
            to: PEOPLE.lee.name,
            tab: '사람',
            instruction: `${tag} 견적 단가를 검토해 주세요.`
        });
        state.rework.rooms.push(room);
        save();
        for (let k = 0; k < rejects; k++) {
            const back = await pass(lee, ev.to_room_id, {
                done: '견적 검토',
                next: '견적서 수정',
                to: PEOPLE.hong.name,
                tab: '사람',
                instruction: `${tag} 반려 ${k + 1} — 단가를 낮춰 주세요.`
            });
            // 넘기는 순간 이팀장이 받은 할 일은 끝난다(화면에서 한 일과 기록이 같다)
            expect(await taskStatus(ev.to_task_id)).toBe('DONE');
            ev = await pass(hong, back.to_room_id, {
                done: '견적서 수정',
                next: '견적 검토',
                to: PEOPLE.lee.name,
                tab: '사람',
                instruction: `${tag} 수정본 ${k + 1} 을 검토해 주세요.`
            });
            expect(await taskStatus(back.to_task_id)).toBe('DONE');
        }
        const send = await pass(lee, ev.to_room_id, {
            done: '견적 검토',
            next: '고객 발송',
            to: PEOPLE.park.name,
            tab: '사람',
            instruction: `${tag} 견적을 고객에게 보내 주세요.`
        });
        expect(await taskStatus(ev.to_task_id)).toBe('DONE');
        await completeTodoOnBoard(park, send.to_task_id, `${tag} 견적을 고객에게 보내 주세요.`);

        // AC2 — 이 스레드의 인계 기록은 넘긴 횟수만큼, 방마다 알림·브리핑 1건
        const rows = await rest(`handover_events?origin_room_id=eq.${room}&source=eq.chat_handover&select=from_room_id,to_room_id`);
        expect(rows.length).toBe(2 + rejects * 2);
        for (const r of rows) {
            const from = await chatMessages(r.from_room_id);
            const to = await chatMessages(r.to_room_id);
            expect(to.filter((m) => m.role === 'system' && /님이 업무를 넘겼습니다/.test(m.content || '')).length).toBe(1);
            expect(from.filter((m) => m.role === 'system' && /업무를 인계했습니다/.test(m.content || '')).length).toBe(1);
        }
    }

    const view = await openMining(hong, '20-mining-rework', '견적서 수정');
    expectOnlyThisBusiness(view.disc, ['견적서 작성', '견적 검토', '견적서 수정', '고객 발송']);
    for (const r of state.rework.rooms) expect(view.threads.find((t) => t.origin_room_id === r)?.finished, r).toBe(true);
    expect(view.disc.tree).toContain("loop('견적 검토', '견적서 수정')");
    assertOnlyObserved(view.disc);
});

test('갈래 — 승인자가 나뉘는 업무가 갈래로 나오고, 갈래 안 단계는 필수로 남는다 (AC4·AC5)', async ({ browser }) => {
    const hong = await login(browser, PEOPLE.hong);
    const lee = await login(browser, PEOPLE.lee);
    const park = await login(browser, PEOPLE.park);
    state.branch = { rooms: [] };

    for (let i = 0; i < 4; i++) {
        const tag = `P${i + 1}`;
        const [who, step] = i % 2 === 0 ? [lee, ['팀장 승인', PEOPLE.lee.name]] : [park, ['예산 검토', PEOPLE.park.name]];
        const { room, ev } = await startThread(hong, `구매 · ${tag} e2e`, {
            done: '구매 요청 접수',
            next: step[0],
            to: step[1],
            tab: '사람',
            instruction: `${tag} 구매 요청을 확인해 주세요.`
        });
        state.branch.rooms.push(room);
        save();
        const back = await pass(who, ev.to_room_id, {
            done: step[0],
            next: '발주 처리',
            to: PEOPLE.hong.name,
            tab: '사람',
            instruction: `${tag} 발주를 진행해 주세요.`
        });
        await completeTodoOnBoard(hong, back.to_task_id, `${tag} 발주를 진행해 주세요.`);
    }

    const view = await openMining(hong, '30-mining-branch', '구매 요청 접수');
    expectOnlyThisBusiness(view.disc, ['구매 요청 접수', '팀장 승인', '예산 검토', '발주 처리']);
    for (const r of state.branch.rooms) expect(view.threads.find((t) => t.origin_room_id === r)?.finished, r).toBe(true);
    expect(view.disc.tree).toMatch(/xor\('팀장 승인', '예산 검토'\)|xor\('예산 검토', '팀장 승인'\)/);
    assertOnlyObserved(view.disc);
});

test('에이전트 중간 단계 — 에이전트가 받은 일의 결과와 파일을 넘긴 사람이 보고 이어 넘긴다 (AC1·AC3·AC4)', async ({ browser }) => {
    const hong = await login(browser, PEOPLE.hong);
    const lee = await login(browser, PEOPLE.lee);
    state.agent = { rooms: [] };

    for (let i = 0; i < 4; i++) {
        const tag = `A${i + 1}`;
        const customer = ['대한물산', '서울전자', '한빛상사', '미래기술'][i];
        const room = await createRoom(hong, `견적 요청 · ${customer} ${tag} e2e`, false);
        state.agent.rooms.push(room);
        save();
        await openRoom(hong, room);
        // 요청 내용을 방에 적어 둔다(에이전트가 없는 방이라 답은 없다). 대화 기록.md 로 넘어간다.
        const input = hong.locator('textarea:not([disabled]):visible').first();
        await input.fill(`${customer} 견적 요청: 서버 ${i + 2}대, 대당 500만원, 납기 4주`);
        await input.press('Enter');
        await waitUntil(async () => (await chatMessages(room)).some((m) => m.role === 'user'), '요청 메시지 저장');
        await openRoom(hong, room);

        const toAgent = await handover(hong, room, {
            done: '견적 요청 접수',
            next: '견적서 초안 작성',
            to: DOC_AGENT.name,
            tab: '에이전트',
            instruction: `넘겨받은 대화 기록.md 의 고객 요청대로 견적서를 docx 파일로 만들어 주세요. 파일 이름은 견적서_${customer}.docx 로 해 주세요.`
        });
        expect(toAgent.to_is_agent).toBe(true);

        // AC1 — 에이전트가 마친 결과가 넘긴 사람이 보는 방에 한 건 남는다
        const result = await waitUntil(
            async () => (await chatMessages(toAgent.to_room_id)).find((m) => m.rowUuid === `handover-result-${toAgent.to_task_id}`),
            `에이전트 결과 ${tag}`,
            900_000,
            10_000
        );
        expect(String(result.content)).toContain(customer);
        // 사람이 읽는 글로 남고(폼 JSON 원문이 아님), 발신자는 에이전트 이름이다
        expect(String(result.content).trim().startsWith('{'), String(result.content).slice(0, 80)).toBe(false);
        expect(result.name).toBe(DOC_AGENT.name);
        // 방 목록 미리보기가 그 결과와 같다(부가: 미리보기 불일치)
        const [roomRow] = await rest(`chat_rooms?id=eq.${toAgent.to_room_id}&select=message`);
        expect(String(roomRow?.message?.msg || '')).toBe(String(result.content).trim().slice(0, 50));
        await openRoom(hong, toAgent.to_room_id);
        await shot(hong, `40-${tag}-agent-result`);
        const candidates = await openHandover(hong);
        expect(candidates.join(' | ')).toContain(`견적서_${customer}.docx`);
        await hong.keyboard.press('Escape');

        if (i === 3) {
            // 에이전트가 끝낸 것만으로는 끝난 건이 아니다 — 넘긴 사람이 업무 종료해야 끝
            let view = await openMining(hong, '41-agent-last-before-close', '견적서 초안 작성');
            expect(view.threads.find((t) => t.origin_room_id === room)?.finished).toBe(false);
            state.agent.treeBeforeClose = view.disc.tree;
            await openRoom(hong, toAgent.to_room_id);
            await closeWork(hong);
            view = await openMining(hong, '42-agent-last-after-close', '견적서 초안 작성');
            expect(view.threads.find((t) => t.origin_room_id === room)?.finished).toBe(true);
            state.agent.treeAfterClose = view.disc.tree;
            save();
            continue;
        }

        await openRoom(hong, toAgent.to_room_id);
        const toLee = await handover(hong, toAgent.to_room_id, {
            done: '견적서 초안 작성',
            next: '견적서 승인',
            to: PEOPLE.lee.name,
            tab: '사람',
            instruction: `${tag} 견적서를 승인해 주세요.`
        });
        await openRoom(lee, toLee.to_room_id);
        await shot(lee, `43-${tag}-lee-received`);
        expect((await lee.locator('body').innerText()).includes(`견적서_${customer}.docx`)).toBe(true);
        await completeTodoOnBoard(lee, toLee.to_task_id, `${tag} 견적서를 승인해 주세요.`);
    }

    const view = await openMining(hong, '44-mining-agent', '견적서 초안 작성');
    expectOnlyThisBusiness(view.disc, ['견적 요청 접수', '견적서 초안 작성', '견적서 승인']);
    expectVariant(view.disc, ['견적 요청 접수', '견적서 초안 작성', '견적서 승인'], 3);
    assertOnlyObserved(view.disc);
});
