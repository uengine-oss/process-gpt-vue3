/**
 * 프로세스 식별 — 관리자가 본 업무에 같은 일의 새 건이 들어오면 제안으로 기다린다 (@agent, 느린 검증)
 * openspec: process-gpt-process-miner general-intent-grouping (2026-11-12)
 *
 * 사람이 실제로 하는 대로 한다. 업무를 시작한 사람이 방의 에이전트와 대화해 요청을 정리하고, 다음 사람에게 넘긴다.
 * 받은 사람도 방의 에이전트와 확인한 뒤 넘기고, 마지막 사람이 받은 일을 끝낸다.
 *
 *   1. 구매 요청 — 이미 본 업무에 새 구매 건이 끝나면, 업무의 건수는 그대로이고 새 건은 제안으로 보인다.
 *      관리자가 대화로 받아들이면 그때 업무에 들어가고, 다시 식별해도 그대로다.
 *   2. 교육 신청 — 단계 구성이 다른 새 업무. 세 건이 끝나면 업무 범주 이름으로 새 업무(추천)가 생긴다.
 *      넷째 건은 제안으로 기다리다 받아들이면 들어간다.
 *
 * DB 확인은 로그인한 사용자 권한(같은 테넌트)으로 한다. 서비스 키는 쓰지 않는다. 만든 데이터는 지우지 않는다.
 * 실행: HONG_EMAIL=… HONG_PASSWORD=… npx playwright test -c playwright.processgpt-live.config.ts handover/handover-identification-new-cases
 */
import { expect, test, type Browser, type Page } from '@playwright/test';
import { BASE, PEOPLE, createRoom, login, openRoom, shot } from './helpers';

test.setTimeout(90 * 60 * 1000);

// ---------- 같은 테넌트 사용자 권한으로 읽는다 ----------
async function q<T = any>(page: Page, table: string, build: string): Promise<T[]> {
    return page.evaluate(
        async ({ table, build }) => {
            // build 예: "select=id&from_room_id=eq.xxx&order=occurred_at.desc"
            let query = (window as any).$supabase.from(table).select(new URLSearchParams(build).get('select') || '*');
            for (const [k, v] of new URLSearchParams(build)) {
                if (k === 'select') continue;
                if (k === 'order') {
                    const [col, dir] = v.split('.');
                    query = query.order(col, { ascending: dir !== 'desc' });
                    continue;
                }
                const [op, ...rest] = v.split('.');
                query = query.filter(k, op, rest.join('.'));
            }
            const { data, error } = await query;
            if (error) throw new Error(error.message);
            return data;
        },
        { table, build }
    );
}

async function until<T>(fn: () => Promise<T | null | undefined | false>, label: string, timeout = 600_000, every = 5_000): Promise<T> {
    const end = Date.now() + timeout;
    let last: unknown;
    while (Date.now() < end) {
        try {
            const v = await fn();
            if (v) return v as T;
        } catch (e) {
            last = e;
        }
        await new Promise((r) => setTimeout(r, every));
    }
    throw new Error(`기다리다 시간 초과: ${label} ${last ? String(last) : ''}`);
}

/** 방의 에이전트에게 말하고 답을 기다린다. */
async function askAgent(page: Page, roomId: string, text: string) {
    const answers = async () =>
        (await q(page, 'chats', `select=messages&id=eq.${roomId}`)).filter(
            (r: any) =>
                ['assistant', 'agent'].includes(r.messages?.role) &&
                String(r.messages?.content || '').trim() &&
                !/^생각 중/.test(String(r.messages.content).trim())
        ).length;
    const before = await answers();
    const input = page.locator('textarea:not([disabled]):visible').first();
    await input.click();
    await input.fill(text);
    await input.press('Enter');
    await until(async () => (await answers()) > before, `에이전트 답 (${text.slice(0, 16)})`);
}

type Pass = { done?: string; next: string; to: string; instruction: string };

/** 인계 창에서 넘긴다. 만들어진 인계 행을 돌려준다. */
async function handOver(page: Page, roomId: string, h: Pass) {
    const count = async () => (await q(page, 'handover_events', `select=id&source=eq.chat_handover&from_room_id=eq.${roomId}`)).length;
    const before = await count();
    await openRoom(page, roomId);
    await page.locator('.e2e-handover-open').first().click();
    const dlg = page.locator('.handover-dialog');
    await expect(dlg).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(1_500);
    if (h.done) await dlg.getByLabel('지금까지 한 일').fill(h.done);
    await dlg.getByLabel('다음에 할 일').fill(h.next);
    await dlg.getByLabel('지시사항').fill(h.instruction);
    await dlg.getByRole('tab', { name: /사람/ }).click();
    // 같은 이름의 사람이 여럿이라 이메일로 찾고, 이메일이 보이는 항목을 고른다
    await dlg
        .getByPlaceholder(/검색|Search/)
        .first()
        .fill(h.to);
    await dlg.locator('.e2e-assignee-item', { hasText: h.to }).first().click();
    await expect(dlg.locator('.e2e-assignee-item.v-list-item--active', { hasText: h.to })).toHaveCount(1);
    await dlg.getByRole('button', { name: /^인계하기$/ }).click();
    await expect(dlg).toBeHidden({ timeout: 120_000 });
    await until(async () => (await count()) > before, '인계 기록', 60_000, 2_000);
    const rows = await q(page, 'handover_events', `select=*&source=eq.chat_handover&from_room_id=eq.${roomId}&order=occurred_at.desc`);
    return rows[0];
}

/** 할 일 보드에서 받은 일을 '완료됨'으로 옮긴다. */
async function finishOnBoard(page: Page, taskId: string, text: string) {
    await page.goto(`${BASE}/todolist`, { waitUntil: 'domcontentloaded' });
    const card = page.locator('.todo-task-item-card-style').filter({ hasText: text }).first();
    await expect(card).toBeVisible({ timeout: 60_000 });
    const done = page
        .locator('.v-card')
        .filter({ has: page.locator('h6', { hasText: /^완료됨$/ }) })
        .last();
    await card.scrollIntoViewIfNeeded();
    await card.dragTo(done, { targetPosition: { x: 120, y: 80 } });
    await until(
        async () => (await q(page, 'todolist', `select=status&id=eq.${taskId}`))[0]?.status === 'DONE',
        `할 일 완료(${text})`,
        30_000,
        1_000
    );
}

type Work = {
    room: string;
    ask: string; // 시작한 사람이 에이전트에게 한 요청 — 처음 요청한 대화
    first: Pass & { by: 'hong' };
    second: { askAgent: string; pass: Pass };
    last: { askAgent: string; finishText: string };
};

/** 한 건을 처음부터 끝까지: 홍길동 시작 → 받은 사람 → 홍길동이 끝낸다. 시작한 방 id 를 돌려준다. */
async function runWork(pages: Record<string, Page>, w: Work, receiver: 'lee' | 'park') {
    const hong = pages.hong;
    const room = await createRoom(hong, w.room, true);
    await openRoom(hong, room);
    await askAgent(hong, room, w.ask);
    const ev1 = await handOver(hong, room, w.first);

    const other = pages[receiver];
    await openRoom(other, ev1.to_room_id);
    await askAgent(other, ev1.to_room_id, w.second.askAgent);
    const ev2 = await handOver(other, ev1.to_room_id, w.second.pass);

    await openRoom(hong, ev2.to_room_id);
    await askAgent(hong, ev2.to_room_id, w.last.askAgent);
    await finishOnBoard(hong, ev2.to_task_id, w.last.finishText);
    return room;
}

// ---------- 식별 화면 ----------
type Group = {
    process_key: string;
    name: string;
    category: string;
    activities: string[];
    cases: string[];
    new_case_ids: string[];
    case_count: number;
};

async function openScreen(page: Page): Promise<Group[]> {
    for (let i = 0; i < 3; i++) {
        const th = page.waitForResponse((r) => r.url().includes('/process-miner/threads'), { timeout: 60_000 });
        const groups = page.waitForResponse((r) => r.url().includes('/process-miner/processes') && r.request().method() === 'POST', {
            timeout: 300_000
        });
        await page.goto(`${BASE}/mining/handover`, { waitUntil: 'domcontentloaded' });
        if (!(await th).ok()) {
            await page.waitForTimeout(3_000);
            continue;
        }
        let body = await (await groups).json();
        await expect(page.locator('.e2e-work').first()).toBeVisible({ timeout: 300_000 });
        // 처음 보인 업무를 경계로 남기면 한 번 더 받는다 — 마지막 응답을 쓴다
        const again = await page
            .waitForResponse((r) => r.url().includes('/process-miner/processes') && r.request().method() === 'POST', { timeout: 3_000 })
            .catch(() => null);
        if (again) body = await again.json();
        return body.processes as Group[];
    }
    throw new Error('식별 화면을 열지 못했다');
}

async function pick(page: Page, key: string) {
    // 목록에서 업무 줄을 누르면 상세(/mining/handover/:key)로 간다
    if (!page.url().endsWith(`/mining/handover/${key}`)) {
        if (!page.url().endsWith('/mining/handover')) await page.goto(`${BASE}/mining/handover`, { waitUntil: 'domcontentloaded' });
        await page.locator(`.e2e-work[data-key="${key}"]`).click();
        await page.waitForURL(`**/mining/handover/${key}`);
    }
    await expect(page.locator('.e2e-steps')).toBeVisible();
}

async function say(page: Page, text: string, expectLines: string[], shotName: string) {
    const msgs = page.locator('.e2e-talk-msg[data-role="assistant"]');
    // 지난 대화를 다 불러온 뒤에 센다
    let n = -1;
    for (let stable = 0; stable < 3; ) {
        await page.waitForTimeout(1_000);
        const c = await msgs.count();
        stable = c === n ? stable + 1 : 0;
        n = c;
    }
    await page.locator('.e2e-talk-input input').fill(text);
    await page.locator('.e2e-talk-input input').press('Enter');
    await expect(msgs).toHaveCount(n + 1, { timeout: 120_000 });
    const reply = msgs.nth(n);
    for (const l of expectLines) await expect(reply.locator('.e2e-talk-change')).toContainText(l);
    await shot(page, shotName);
    return reply;
}

async function decision(page: Page, key: string) {
    return (await q(page, 'handover_process_decisions', `select=status,case_ids,core_activities&process_key=eq.${key}`))[0];
}

async function people(browser: Browser) {
    return { hong: await login(browser, PEOPLE.hong), lee: await login(browser, PEOPLE.lee), park: await login(browser, PEOPLE.park) };
}

// ---------- 1. 구매 요청: 관리자가 본 업무에 새 건 ----------
test('@agent 관리자가 본 구매 요청 업무에 새 구매 건이 끝나면 제안으로 기다리고, 관리자가 받아들이면 들어간다', async ({ browser }) => {
    const pages = await people(browser);
    const hong = pages.hong;
    const before = await openScreen(hong);
    const purchase = before.find((g) => g.name === '구매 요청');
    expect(purchase, JSON.stringify(before.map((g) => g.name))).toBeTruthy();

    const room = await runWork(
        pages,
        {
            room: '영업팀 모니터 구매 요청',
            ask: '영업팀 신규 입사자용 27인치 모니터 5대를 구매하려고 해요. 구매 요청서에 들어갈 품목·수량·예상 금액·필요 사유를 정리해 주세요.',
            first: {
                by: 'hong',
                done: '구매 요청 접수',
                next: '예산 검토',
                to: PEOPLE.park.email,
                instruction: '영업팀 모니터 5대 구매 건입니다. 이번 분기 예산 안에서 가능한지 확인해 주세요.'
            },
            second: {
                askAgent: '넘겨받은 모니터 5대 구매 요청을 보고, 예산 검토 의견을 두세 줄로 정리해 주세요.',
                pass: {
                    done: '예산 검토',
                    next: '발주 처리',
                    to: PEOPLE.hong.email,
                    instruction: '예산 안에서 가능합니다. 모니터 5대 발주를 진행해 주세요.'
                }
            },
            last: { askAgent: '모니터 5대 발주서에 들어갈 내용을 정리해 주세요.', finishText: '모니터 5대 발주' }
        },
        'park'
    );

    const after = await openScreen(hong);
    const g = after.find((x) => x.process_key === purchase!.process_key)!;
    expect(g, '구매 요청 업무 키가 바뀌었다').toBeTruthy();
    expect(g.case_count, '관리자 확인 없이 업무에 들어갔다').toBe(purchase!.case_count);
    expect(g.new_case_ids).toContain(room);
    await pick(hong, g.process_key);
    await hong.locator('.e2e-tab-new').click();
    await expect(hong.locator(`.e2e-thread[data-room-id="${room}"] .e2e-thread-proposal`)).toBeVisible();
    await shot(hong, 'newcase-purchase-1-proposal');

    // 새로 들어온 건 탭에서 그 건의 '이 업무에 넣기' 로 바로 받는다(대화의 change 와 같은 저장)
    expect((await decision(hong, g.process_key)).case_ids).not.toContain(room);
    await hong.locator(`.e2e-thread[data-room-id="${room}"] .e2e-accept-case`).click();
    await until(async () => (await decision(hong, g.process_key)).case_ids.includes(room), '받아들인 건 저장', 60_000, 2_000);

    const again = await openScreen(hong);
    const g2 = again.find((x) => x.process_key === g.process_key)!;
    expect(g2.case_count).toBe(purchase!.case_count + g.new_case_ids.length);
    expect(g2.cases).toContain(room);
    expect(g2.new_case_ids).not.toContain(room);
    await pick(hong, g2.process_key);
    await shot(hong, 'newcase-purchase-3-accepted');
});

// ---------- 2. 교육 신청: 단계 구성이 다른 새 업무 ----------
const TRAININGS = [
    { team: '영업팀', course: '고객 응대 교육', date: '12월 3일' },
    { team: '재무팀', course: '엑셀 실무 교육', date: '12월 10일' },
    { team: '개발팀', course: '보안 인식 교육', date: '12월 17일' },
    { team: '인사팀', course: '리더십 교육', date: '1월 7일' }
];

function trainingWork(t: (typeof TRAININGS)[number]): Work {
    return {
        room: `${t.team} ${t.course} 신청`,
        ask: `${t.team}에서 ${t.course}을 ${t.date}에 받고 싶다는 신청이 들어왔어요. 신청 내용(대상 팀, 과정, 희망 날짜, 인원)을 정리해 주세요.`,
        first: {
            by: 'hong',
            done: '교육 신청 접수',
            next: '교육 일정 조율',
            to: PEOPLE.lee.email,
            instruction: `${t.team} ${t.course} 신청입니다. 강사와 교육장 일정을 맞춰 주세요.`
        },
        second: {
            askAgent: `${t.team} ${t.course} 일정을 ${t.date} 오후로 잡으려고 해요. 강사와 교육장 확인 사항을 정리해 주세요.`,
            pass: {
                done: '교육 일정 조율',
                next: '참석 안내',
                to: PEOPLE.hong.email,
                instruction: `${t.date} 오후로 확정했습니다. ${t.team}에 참석 안내를 보내 주세요.`
            }
        },
        last: { askAgent: `${t.team}에 보낼 ${t.course} 참석 안내문을 짧게 써 주세요.`, finishText: `${t.date} 오후로 확정했습니다` }
    };
}

test('@agent 교육 신청 — 세 건이 끝나면 범주 이름으로 새 업무가 생기고, 관리자가 본 뒤 넷째 건은 제안으로 기다린다', async ({
    browser
}) => {
    const pages = await people(browser);
    const hong = pages.hong;
    const rooms: string[] = [];
    for (const t of TRAININGS.slice(0, 3)) rooms.push(await runWork(pages, trainingWork(t), 'lee'));

    const groups = await openScreen(hong);
    const g = groups.find((x) => rooms.every((r) => x.cases.includes(r)));
    expect(g, `세 건이 한 업무로 — ${JSON.stringify(groups.map((x) => [x.name, x.cases.length]))}`).toBeTruthy();
    // 이름은 업무 범주이고, 단계 이름을 이은 것이 아니다
    expect(g!.name).toBe(g!.category);
    expect(['교육 신청 접수', '교육 일정 조율', '참석 안내']).not.toContain(g!.name);
    expect(g!.activities.sort()).toEqual(['교육 신청 접수', '교육 일정 조율', '참석 안내'].sort());
    await pick(hong, g!.process_key);
    await shot(hong, 'newcase-training-1-group');

    const fourth = await runWork(pages, trainingWork(TRAININGS[3]), 'lee');
    const after = await openScreen(hong);
    const g2 = after.find((x) => x.process_key === g!.process_key)!;
    expect(g2, '업무 키가 바뀌었다').toBeTruthy();
    expect(g2.case_count).toBe(3);
    expect(g2.new_case_ids).toContain(fourth);
    await pick(hong, g2.process_key);
    await hong.locator('.e2e-tab-new').click();
    await expect(hong.locator(`.e2e-thread[data-room-id="${fourth}"] .e2e-thread-proposal`)).toBeVisible();
    await shot(hong, 'newcase-training-3-proposal');

    const accept = await say(
        hong,
        '새로 들어온 인사팀 리더십 교육 신청도 이 업무가 맞아. 넣어줘',
        [`새로 들어온 ${g2.new_case_ids.length}건을 이 업무에 넣습니다`],
        'newcase-training-4-talk'
    );
    await accept.locator('.e2e-talk-apply').click();
    await until(async () => (await decision(hong, g2.process_key)).case_ids.includes(fourth), '받아들인 건 저장', 60_000, 2_000);
    const again = await openScreen(hong);
    const g3 = again.find((x) => x.process_key === g2.process_key)!;
    expect(g3.case_count).toBe(3 + g2.new_case_ids.length);
    await pick(hong, g3.process_key);
    await shot(hong, 'newcase-training-5-accepted');
});
