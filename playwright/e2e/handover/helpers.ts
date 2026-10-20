/**
 * 인계 → 식별 e2e 공용 조작.
 *
 * 실제 서비스(게이트웨이 8088 · completion · deepagents · memento · process-miner)에
 * 계정 셋으로 로그인해 사람이 하는 대로 화면을 조작한다. 확인용 조회만 DB(서비스 키)로 한다.
 *
 * 필요한 환경 변수
 *   BASE_URL=http://localhost:8088
 *   SB_SERVICE_KEY=<로컬 supabase service_role 키>   (조회 전용)
 */
import { expect, type Browser, type Page } from '@playwright/test';

export const BASE = process.env.BASE_URL || 'http://localhost:8088';
const SB_URL = process.env.SB_URL || 'http://127.0.0.1:54321';
const SB_KEY = process.env.SB_SERVICE_KEY || '';

export type Person = { key: string; email: string; password: string; name: string };

export const PEOPLE: Record<string, Person> = {
    hong: { key: 'hong', email: 'ohsy818@uengine.org', password: 'dbdpswls', name: '홍길동' },
    lee: { key: 'lee', email: 'lee.handover@localhost.dev', password: 'handover-test-1', name: '이팀장' },
    park: { key: 'park', email: 'park.handover@localhost.dev', password: 'handover-test-1', name: '박대리' }
};

/** 인계 대상 에이전트. 할 일 폴러(deepagents)가 집어 간다. */
export const DOC_AGENT = { id: '1b76edfd-d3cc-4ab2-8f78-201a538cfb52', name: '문서 생성 전문가' };

export async function rest(path: string): Promise<any[]> {
    if (!SB_KEY) throw new Error('SB_SERVICE_KEY 가 필요합니다');
    const res = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } });
    if (!res.ok) throw new Error(`${path} 조회 실패: ${res.status} ${await res.text()}`);
    return res.json();
}

export async function waitUntil<T>(fn: () => Promise<T>, label: string, timeout = 120_000, interval = 2_000): Promise<T> {
    const start = Date.now();
    let last: any;
    while (Date.now() - start < timeout) {
        try {
            last = await fn();
            if (last) return last;
        } catch (e) {
            last = e;
        }
        await new Promise((r) => setTimeout(r, interval));
    }
    throw new Error(`기다리다 시간 초과: ${label} (마지막 값: ${String(last)})`);
}

export async function login(browser: Browser, who: Person): Promise<Page> {
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 950 }, locale: 'ko-KR' });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/auth/login`, { waitUntil: 'domcontentloaded' });
    const inputs = page.locator('input:visible');
    await inputs.nth(0).fill(who.email);
    await inputs.nth(1).fill(who.password);
    await inputs.nth(1).press('Enter');
    await page.waitForURL((u) => !u.pathname.startsWith('/auth'), { timeout: 60_000 });
    await page.waitForFunction(() => !!localStorage.getItem('uid'), null, { timeout: 30_000 });
    return page;
}

export async function myId(page: Page): Promise<string> {
    return page.evaluate(() => localStorage.getItem('uid') as string);
}

/**
 * 업무를 시작할 대화방. 방 만들기 자체는 시험 대상이 아니어서 앱의 클라이언트로 만든다
 * (로그인한 사용자 권한). withAgent 면 기본 에이전트가 함께 있는 방이다.
 */
export async function createRoom(page: Page, name: string, withAgent = false): Promise<string> {
    const id = await page.evaluate(
        async ({ name, withAgent }) => {
            const id = crypto.randomUUID();
            const uid = localStorage.getItem('uid');
            const participants: any[] = [
                { id: uid, email: localStorage.getItem('email'), username: localStorage.getItem('userName'), is_agent: null }
            ];
            if (withAgent) {
                participants.push({ id: 'process-gpt-agent', email: null, username: 'Process GPT Agent', is_agent: true, agent_type: 'agent' });
            }
            const { error } = await (window as any).$supabase.from('chat_rooms').insert({
                id,
                tenant_id: (window as any).$tenantName,
                name,
                participants,
                message: { msg: 'NEW', type: 'text', createdAt: new Date().toISOString() }
            });
            if (error) throw new Error(error.message);
            return id;
        },
        { name, withAgent }
    );
    return id;
}

export async function openRoom(page: Page, roomId: string) {
    await page.goto(`${BASE}/chat?roomId=${roomId}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.e2e-handover-open').first()).toBeVisible({ timeout: 60_000 });
    await page.waitForTimeout(2_500);
}

/** 대화창에 말을 보내고 에이전트 답을 기다린다. */
export async function chat(page: Page, roomId: string, text: string, timeout = 600_000): Promise<string> {
    const before = (await assistantMessages(roomId)).length;
    const input = page.locator('textarea:not([disabled]):visible').first();
    await input.click();
    await input.fill(text);
    await input.press('Enter');
    const msgs = await waitUntil(
        async () => {
            const m = await assistantMessages(roomId);
            return m.length > before ? m : null;
        },
        `에이전트 답 (${text.slice(0, 20)})`,
        timeout,
        5_000
    );
    return String(msgs[msgs.length - 1].content || '');
}

export async function chatMessages(roomId: string): Promise<any[]> {
    const rows = await rest(`chats?id=eq.${roomId}&select=uuid,messages`);
    return rows.map((r) => ({ ...r.messages, rowUuid: r.uuid }));
}

export async function assistantMessages(roomId: string): Promise<any[]> {
    // 답을 쓰는 동안 남는 자리 표시('생각 중...')는 답이 아니다.
    return (await chatMessages(roomId)).filter(
        (m) => m && ['assistant', 'agent'].includes(m.role) && String(m.content || '').trim() && !/^생각 중/.test(String(m.content).trim())
    );
}

export type HandoverInput = {
    done?: string;
    next: string;
    to: string;
    tab?: '사람' | '에이전트';
    instruction?: string;
    /** 후보 중 이 이름들만 넘긴다. 없으면 기본(전체 선택) */
    onlyArtifacts?: string[];
};

/** 인계 창을 연다. 산출물 후보 이름 목록을 돌려준다. */
export async function openHandover(page: Page): Promise<string[]> {
    await page.locator('.e2e-handover-open').first().click();
    const dlg = page.locator('.handover-dialog');
    await expect(dlg).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(1_500);
    return dlg.locator('.v-checkbox .text-body-2').allInnerTexts();
}

/** 화면에서 인계한다. 만들어진 인계 행을 돌려준다. */
export async function handover(page: Page, roomId: string, h: HandoverInput): Promise<any> {
    const before = await rest(`handover_events?source=eq.chat_handover&from_room_id=eq.${roomId}&select=id`);
    const candidates = await openHandover(page);
    const dlg = page.locator('.handover-dialog');
    if (h.onlyArtifacts) {
        const boxes = dlg.locator('.v-checkbox');
        for (let i = 0; i < candidates.length; i++) {
            const want = h.onlyArtifacts.some((n) => candidates[i].includes(n));
            const input = boxes.nth(i).locator('input');
            if ((await input.isChecked()) !== want) await input.click();
        }
    }
    if (h.done) await dlg.getByLabel('지금까지 한 일').fill(h.done);
    await dlg.getByLabel('다음에 할 일').fill(h.next);
    if (h.instruction) await dlg.getByLabel('지시사항').fill(h.instruction);
    if (h.tab) await dlg.getByRole('tab', { name: new RegExp(h.tab) }).click();
    await dlg.getByPlaceholder(/검색|Search/).first().fill(h.to);
    await dlg.locator('.e2e-assignee-item', { hasText: h.to }).first().click();
    await dlg.getByRole('button', { name: /^인계하기$/ }).click();
    await expect(dlg).toBeHidden({ timeout: 120_000 });
    const rows = await waitUntil(
        async () => {
            const r = await rest(
                `handover_events?source=eq.chat_handover&from_room_id=eq.${roomId}&select=*&order=occurred_at.desc`
            );
            return r.length > before.length ? r : null;
        },
        '인계 기록'
    );
    return rows[0];
}

/** 에이전트에게 넘긴 방에서 업무 종료. */
export async function closeWork(page: Page) {
    await openHandover(page);
    const btn = page.locator('.e2e-handover-close-thread');
    await expect(btn).toBeVisible({ timeout: 30_000 });
    await btn.click();
    await expect(page.locator('.handover-dialog')).toBeHidden({ timeout: 30_000 });
}

/**
 * 할 일 목록(칸반)에서 그 할 일 카드를 '완료됨'으로 끌어다 놓는다 — 사람이 받은 일을 끝내는 화면 조작.
 * 같은 이름의 할 일이 여럿이라 카드는 건마다 다른 지시사항(설명)으로 찾는다.
 */
export async function completeTodoOnBoard(page: Page, taskId: string, uniqueText: string) {
    await page.goto(`${BASE}/todolist`, { waitUntil: 'domcontentloaded' });
    const card = page.locator('.todo-task-item-card-style').filter({ hasText: uniqueText }).first();
    await expect(card).toBeVisible({ timeout: 60_000 });
    const doneColumn = page
        .locator('.v-card')
        .filter({ has: page.locator('h6', { hasText: /^완료됨$/ }) })
        .last(); // 보드 전체 카드도 걸리므로 가장 안쪽(열) 카드
    await card.scrollIntoViewIfNeeded();
    // 칸반은 SortableJS(HTML5 드래그). 열의 목록 영역 위쪽에 놓는다.
    await card.dragTo(doneColumn, { targetPosition: { x: 120, y: 80 } });
    await waitUntil(async () => (await taskStatus(taskId)) === 'DONE', `할 일 완료(${uniqueText})`, 30_000, 1_000);
}

/** 이 인계로 받은 할 일 상태. */
export async function taskStatus(taskId: string): Promise<string> {
    const rows = await rest(`todolist?id=eq.${taskId}&select=status`);
    return rows[0]?.status || '';
}

export async function shot(page: Page, name: string) {
    await page.screenshot({ path: `playwright/handover-e2e/${name}.png`, fullPage: false });
}
