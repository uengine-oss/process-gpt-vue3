/**
 * 인계 → 식별 e2e 공용 조작.
 *
 * 실제 서비스(게이트웨이 8088 · completion · deepagents · memento · process-miner)에
 * 계정 셋으로 로그인해 사람이 하는 대로 화면을 조작한다. 확인용 조회만 DB(서비스 키)로 한다.
 *
 * 필요한 환경 변수
 *   BASE_URL=http://localhost:8088
 *   SB_SERVICE_KEY=<로컬 supabase service_role 키>   (조회 전용)
 *   HONG_EMAIL · HONG_PASSWORD=<로컬 관리자 계정>
 */
import { expect, type Browser, type Page } from '@playwright/test';

export const BASE = process.env.BASE_URL || 'http://localhost:8088';
const SB_URL = process.env.SB_URL || 'http://127.0.0.1:54321';
const SB_KEY = process.env.SB_SERVICE_KEY || '';

export type Person = { key: string; email: string; password: string; name: string };

export const PEOPLE: Record<string, Person> = {
    // 로컬 관리자 계정. 저장소에 남기지 않고 HONG_EMAIL · HONG_PASSWORD 로 넘긴다
    hong: { key: 'hong', email: process.env.HONG_EMAIL || '', password: process.env.HONG_PASSWORD || '', name: '홍길동' },
    // 로컬에서 비밀번호를 바꿨으면 LEE_PASSWORD 로 넘긴다
    lee: { key: 'lee', email: 'lee.handover@localhost.dev', password: process.env.LEE_PASSWORD || 'handover-test-1', name: '이팀장' },
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

/** 서비스 키로 지운다(테스트가 만든 데이터 정리 전용). */
export async function restDelete(path: string): Promise<void> {
    if (!SB_KEY) throw new Error('SB_SERVICE_KEY 가 필요합니다');
    const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
        method: 'DELETE',
        headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, Prefer: 'return=minimal' }
    });
    if (!res.ok) throw new Error(`${path} 삭제 실패: ${res.status} ${await res.text()}`);
}

/** 이 실행에서 createRoom 으로 만든 방. 인계 스레드는 모두 이 방들에서 시작한다. */
const createdRooms = new Set<string>();

/**
 * 이 실행에서 만든 방과 그 방에서 시작된 인계 스레드 전체(받은 방·대화·인계 기록·할 일)를 지운다.
 * 테스트가 남긴 방과 업무가 대화 목록과 식별 화면에 쌓여 다음 테스트와 실제 화면을 흐리지 않게 한다.
 * test.afterEach(cleanupCreated) 로 쓴다.
 */
export async function cleanupCreated(): Promise<void> {
    const origins = [...createdRooms];
    createdRooms.clear();
    // 화면에서 다시 볼 시험 데이터를 남길 때: KEEP_E2E_DATA=1
    if (!origins.length || !SB_KEY || process.env.KEEP_E2E_DATA) return;
    const inList = (ids: string[]) => `in.(${ids.map((x) => `"${x}"`).join(',')})`;
    const rows = await rest(`handover_events?origin_room_id=${inList(origins)}&select=from_room_id,to_room_id,to_task_id`);
    const rooms = new Set<string>(origins);
    const tasks = new Set<string>();
    for (const r of rows) {
        if (r.from_room_id) rooms.add(r.from_room_id);
        if (r.to_room_id) rooms.add(r.to_room_id);
        if (r.to_task_id) tasks.add(r.to_task_id);
    }
    const roomIds = [...rooms];
    if (tasks.size) await restDelete(`todolist?id=${inList([...tasks])}`);
    await restDelete(`handover_events?origin_room_id=${inList(origins)}`);
    await restDelete(`chat_attachments?chat_room_id=${inList(roomIds)}`);
    await restDelete(`chats?id=${inList(roomIds)}`);
    await restDelete(`chat_rooms?id=${inList(roomIds)}`);
}

export async function waitUntil<T>(fn: () => Promise<T>, label: string, timeout = 60_000, interval = 2_000): Promise<T> {
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
    if (!who.email || !who.password) throw new Error(`${who.key} 계정의 이메일·비밀번호 환경 변수가 필요합니다`);
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
                participants.push({
                    id: 'process-gpt-agent',
                    email: null,
                    username: 'Process GPT Agent',
                    is_agent: true,
                    agent_type: 'agent'
                });
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
    createdRooms.add(id);
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
    // 조회 순서는 시간순이 아니다. 마지막 답을 집는 쪽(chat)이 엉뚱한 답을 받지 않게 시각으로 정렬한다.
    return rows
        .map((r) => ({ ...r.messages, rowUuid: r.uuid }))
        .sort((a, b) => new Date(a.timeStamp || 0).getTime() - new Date(b.timeStamp || 0).getTime());
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
    await dlg
        .getByPlaceholder(/검색|Search/)
        .first()
        .fill(h.to);
    await dlg.locator('.e2e-assignee-item', { hasText: h.to }).first().click();
    await dlg.getByRole('button', { name: /^인계하기$/ }).click();
    await expect(dlg).toBeHidden({ timeout: 120_000 });
    const rows = await waitUntil(async () => {
        const r = await rest(`handover_events?source=eq.chat_handover&from_room_id=eq.${roomId}&select=*&order=occurred_at.desc`);
        return r.length > before.length ? r : null;
    }, '인계 기록');
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

export type Receiver = { to: string; tab?: '사람' | '에이전트'; next: string };

/** 인계 창에서 여러 명을 골라 한 번에 넘긴다. 같은 묶음으로 만들어진 인계 행을 돌려준다. */
export async function handoverMany(page: Page, roomId: string, done: string, instruction: string, receivers: Receiver[]): Promise<any[]> {
    await openHandover(page);
    const dlg = page.locator('.handover-dialog');
    await dlg.getByLabel('지금까지 한 일').fill(done);
    await dlg.getByLabel('지시사항').fill(instruction);
    for (const r of receivers) {
        await dlg.getByRole('tab', { name: new RegExp(r.tab || '사람') }).click();
        const search = dlg.getByPlaceholder(/검색|Search/).first();
        await search.fill(r.to);
        await dlg.locator('.e2e-assignee-item', { hasText: r.to }).first().click();
        await search.fill('');
    }
    const rows = dlg.locator('.e2e-selected-receiver');
    await expect(rows).toHaveCount(receivers.length);
    // 두 명 이상이면 사람마다 '다음에 할 일' 을 따로 적는다
    for (let i = 0; i < receivers.length; i++) {
        await rows.nth(i).locator('.e2e-receiver-next input').fill(receivers[i].next);
    }
    await dlg.getByRole('button', { name: /^인계하기$/ }).click();
    await expect(dlg).toBeHidden({ timeout: 120_000 });
    return waitUntil(async () => {
        const r = await rest(`handover_events?source=eq.chat_handover&from_room_id=eq.${roomId}&group_id=not.is.null&select=*`);
        return r.length >= receivers.length ? r : null;
    }, '묶음 인계 기록');
}

/** 기존 산출물 버튼으로 오른쪽 패널을 열고 '작업 흐름' 탭을 골라, 카드 목록을 읽는다. */
export async function flowNodes(page: Page) {
    const tab = page.locator('.artifact-panel__tab', { hasText: '작업 흐름' });
    if (!(await tab.isVisible())) await page.getByRole('button', { name: '산출물' }).first().click();
    await tab.click();
    const card = page.locator('.e2e-handover-flow');
    await expect(card).toBeVisible({ timeout: 30_000 });
    const nodes = card.locator('.e2e-handover-flow-node');
    await expect(nodes.first()).toBeVisible({ timeout: 30_000 });
    const out: { room: string | null; status: string | null; text: string }[] = [];
    for (let i = 0; i < (await nodes.count()); i++) {
        const n = nodes.nth(i);
        out.push({ room: await n.getAttribute('data-room-id'), status: await n.getAttribute('data-status'), text: await n.innerText() });
    }
    return out;
}
