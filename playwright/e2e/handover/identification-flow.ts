/**
 * 실제 사용자 흐름으로 업무 한 건을 처리하는 조작 — 식별 시나리오 공용.
 * 시작한 사람이 방의 에이전트와 요청을 정리해 넘기고, 받은 사람마다 방의 에이전트와 확인한 뒤 넘기고,
 * 마지막 사람이 받은 일을 할 일 보드에서 끝낸다. DB 확인은 로그인한 사용자 권한(같은 테넌트)으로 한다.
 */
import { expect, type Page } from '@playwright/test';
import { BASE, createRoom, openRoom } from './helpers';

export async function q<T = any>(page: Page, table: string, build: string): Promise<T[]> {
    return page.evaluate(
        async ({ table, build }) => {
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

export async function until<T>(
    fn: () => Promise<T | null | undefined | false>,
    label: string,
    timeout = 600_000,
    every = 5_000
): Promise<T> {
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
export async function askAgent(page: Page, roomId: string, text: string) {
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

export type Pass = { done?: string; next: string; to: string; instruction: string };

/** 인계 창에서 넘긴다(받는 사람은 이메일로 찾는다 — 같은 이름이 여럿이다). 만들어진 인계 행을 돌려준다. */
export async function handOver(page: Page, roomId: string, h: Pass) {
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
    await dlg
        .getByPlaceholder(/검색|Search/)
        .first()
        .fill(h.to);
    await dlg.locator('.e2e-assignee-item', { hasText: h.to }).first().click();
    await dlg.getByRole('button', { name: /^인계하기$/ }).click();
    await expect(dlg).toBeHidden({ timeout: 120_000 });
    await until(async () => (await count()) > before, '인계 기록', 60_000, 2_000);
    const rows = await q(page, 'handover_events', `select=*&source=eq.chat_handover&from_room_id=eq.${roomId}&order=occurred_at.desc`);
    return rows[0];
}

/** 할 일 보드에서 받은 일을 '완료됨'으로 옮긴다. */
export async function finishOnBoard(page: Page, taskId: string, text: string) {
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

/** 업무 한 건의 단계: 그 사람이 방의 에이전트에게 할 말, 그리고 다음 사람에게 넘길 내용(마지막은 끝낼 할 일의 글귀) */
export type Leg = { by: string; ask: string; pass?: Pass; finish?: string };
export type Work = { room: string; legs: Leg[] };

/**
 * 업무 한 건을 처음부터 끝까지 처리한다. 시작한 방 id 를 돌려준다.
 * legs[0] 은 방을 만든 사람, 그다음은 받은 사람 순서. 마지막 leg 는 finish(받은 할 일의 지시사항 일부)를 가진다.
 */
export async function runWork(pages: Record<string, Page>, w: Work): Promise<string> {
    const first = pages[w.legs[0].by];
    const room = await createRoom(first, w.room, true);
    await openRoom(first, room);
    let at = room;
    let ev: any = null;
    for (const [i, leg] of w.legs.entries()) {
        const page = pages[leg.by];
        if (i > 0) await openRoom(page, at);
        await askAgent(page, at, leg.ask);
        if (leg.pass) {
            ev = await handOver(page, at, leg.pass);
            at = ev.to_room_id;
        } else if (leg.finish && ev) {
            await finishOnBoard(page, ev.to_task_id, leg.finish);
        }
    }
    return room;
}
