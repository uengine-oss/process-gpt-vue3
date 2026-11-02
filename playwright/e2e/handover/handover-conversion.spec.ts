/**
 * 인계 기반 프로세스 식별 — 실행 전환 인수조건 e2e (todo-2026-10-21).
 *
 *  1. 인계로 처리하던 업무를 전환된 프로세스로 처리하면, 같은 담당자가 같은 순서로 일하고 끝까지 완료된다.
 *  2. 식별 화면에서 업무를 골라 실행 가능한 프로세스가 되기까지 흐름을 다시 그리거나 고칠 필요가 없다.
 *  3. 같은 업무를 다시 전환해도 실행되는 흐름이 달라지지 않는다.
 *  4. 전환이나 실행이 안 되면 사용자가 그 이유를 화면에서 알 수 있다.
 *  5. 네 가지 형태(반려 후 재검토 · 갈래 · 에이전트 중간 단계 · 두 사람 인계)에서 확인한다.
 *
 * 앞선 안정화 e2e(handover-stabilization.spec.ts)가 남긴 인계 기록을 쓴다. 데이터 확인은 로그인한
 * 사용자 권한(화면의 supabase 클라이언트)으로만 한다.
 *
 * 실행: BASE_URL=http://localhost:8088 npx playwright test playwright/e2e/handover/handover-conversion.spec.ts -g '두 사람'
 */
import { expect, test, type Browser, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'fs';
import { PEOPLE, login, myId } from './helpers';
import { openMining as openMiningView } from './mining';

const BASE = process.env.BASE_URL || 'http://localhost:8088';
const OUT = 'playwright/handover-e2e/conversion';
mkdirSync(OUT, { recursive: true });

test.describe.configure({ mode: 'serial', timeout: 3_600_000 });
// 동작마다 시간 제한을 둔다(기본 0 = 무한 대기라 숨은 입력란에서 멈춘다)
test.use({ actionTimeout: 30_000 });

const shot = (page: Page, name: string) => page.screenshot({ path: `${OUT}/${name}.png` });

/** 화면의 supabase 클라이언트로 조회한다(로그인한 사용자 권한). */
async function sb<T = any>(page: Page, table: string, filters: Record<string, string>, select = '*', order?: string): Promise<T[]> {
    // 페이지가 넘어가는 중이면 클라이언트가 아직 없다 — 생길 때까지 기다린다
    await page.waitForFunction(() => !!(window as any).$supabase, null, { timeout: 60_000 });
    return page.evaluate(
        async ({ table, filters, select, order }) => {
            let q = (window as any).$supabase.from(table).select(select);
            for (const [k, v] of Object.entries(filters)) q = q.eq(k, v);
            if (order) q = q.order(order, { ascending: true });
            const { data, error } = await q;
            if (error) throw new Error(`${table}: ${error.message}`);
            return data || [];
        },
        { table, filters, select, order }
    );
}

async function until<T>(fn: () => Promise<T>, label: string, timeout = 300_000, every = 5_000): Promise<T> {
    const start = Date.now();
    let last: any;
    while (Date.now() - start < timeout) {
        try {
            last = await fn();
            if (last) return last;
        } catch (e) {
            last = e;
        }
        await new Promise((r) => setTimeout(r, every));
    }
    throw new Error(`시간 초과: ${label} (마지막: ${String(last)})`);
}

/** 식별 화면에서 activity 가 든 업무를 고른다(공용 mining.openMining). 화면이 받은 도출 결과를 돌려준다. */
async function openMining(page: Page, activity: string) {
    const { group, disc } = await openMiningView(page, activity);
    return { group, disc };
}

/** 구조 서명: 단계(이름·담당 endpoint·에이전트), 게이트웨이 종류, 연결(이름→이름, 분기값). */
function signature(defn: any) {
    const endpoint: Record<string, string> = {};
    for (const r of defn.roles || []) endpoint[r.name] = r.endpoint;
    // 정의 화면이 XML 에서 정의를 다시 만들면 이벤트가 gateways 목록에 들어가기도 한다 — 목록이 아니라 종류로 가른다
    const all = [...(defn.activities || []), ...(defn.gateways || []), ...(defn.events || [])];
    const isEvent = (n: any) => /event/i.test(String(n.type || ''));
    const isGateway = (n: any) => /gateway/i.test(String(n.type || ''));
    const nodes: Record<string, string> = {};
    for (const n of all) nodes[n.id] = isEvent(n) ? String(n.type) : isGateway(n) ? `${n.type}:${n.id}` : n.name;
    return {
        activities: (defn.activities || []).map((a: any) => `${a.id}|${a.name}|${endpoint[a.role] || a.role}|${a.agent || ''}`).sort(),
        gateways: all
            .filter(isGateway)
            .map((g: any) => `${g.id}|${g.type}`)
            .sort(),
        sequences: (defn.sequences || []).map((s: any) => `${nodes[s.source]}→${nodes[s.target]}|${s.condition || ''}`).sort()
    };
}

type Converted = { roomId: string; procDefId: string; definition: any; chatText: string };

/**
 * 식별 화면 → '실행 가능한 프로세스로 전환' → 생성(후보 선택은 고르지 않고 제출) → 저장.
 * 사용자가 흐름을 그리거나 고치는 조작은 하지 않는다(AC2).
 */
async function convert(page: Page, activity: string, tag: string): Promise<Converted & { disc: any }> {
    const { disc } = await openMining(page, activity);
    await page.locator('.e2e-convert-process').click();
    await page.waitForURL(/\/chat\?roomId=/, { timeout: 60_000 });
    const roomId = new URL(page.url()).searchParams.get('roomId') as string;
    await shot(page, `${tag}-01-conversion-room`);

    const failRe = /검증을 통과하지 못해|통합하는 중 문제|마무리 처리 중 오류|요청을 처리하지 못했어요/;
    const done = page.locator('.ai-message-bubble', { hasText: /확인 후 저장/ }).first();
    const handled = new Set<string>();
    let consultApproval = false;
    for (let i = 0; i < 180; i++) {
        const bubbles = await page
            .locator('.ai-message-bubble')
            .allInnerTexts()
            .catch(() => [] as string[]);
        const fail = bubbles.find((t) => failRe.test(t));
        if (fail) {
            await shot(page, `${tag}-02-conversion-failed`);
            throw new Error(`전환 실패 — 화면 안내: ${fail}`);
        }
        if ((await done.count()) && (await done.isVisible().catch(() => false))) break;
        const panel = page.locator('.hitl-feedback-wrap, .human-feedback-panel').last();
        if ((await panel.count()) && (await panel.isVisible().catch(() => false))) {
            // innerText() 는 요소가 없으면 무한정 기다린다 — 기다리지 않는 allInnerTexts 로 읽는다
            const q = (await panel.allInnerTexts()).join(' ').slice(0, 200);
            const items = await panel.locator('.human-feedback-panel__item').count();
            const key = `${items}:${q}`;
            if (!handled.has(key)) {
                handled.add(key);
                // 흐름 초안 승인(체크박스 없음)을 묻는다면 흐름을 다시 확인시키는 것이다 — AC2 위반으로 기록
                if (items === 0) consultApproval = true;
                await shot(page, `${tag}-02-hitl-${handled.size}`);
                const approve = panel.getByRole('button', { name: /^\s*승인\s*$/ }).first();
                if (items === 0 && (await approve.count())) await approve.click().catch(() => {});
                // 후보는 고르지 않는다(보강 없이도 실행돼야 한다) — 고른 게 없으면 '건너뛰기'
                const submit = panel.getByRole('button', { name: /응답\s*제출/ }).first();
                const skip = panel.getByRole('button', { name: /건너뛰기/ }).first();
                if ((await submit.count()) && (await submit.isEnabled())) await submit.click().catch(() => {});
                else if (await skip.count()) await skip.click().catch(() => {});
                await page.waitForTimeout(5_000);
            }
        }
        await page.waitForTimeout(5_000);
    }
    await expect(done, '생성이 끝나 저장 안내가 떠야 한다').toBeVisible({ timeout: 10_000 });
    const chatText = (await page.locator('.ai-message-bubble').allInnerTexts()).join('\n');
    expect(consultApproval, '흐름 초안을 다시 승인받으면 안 된다(흐름은 이미 도출됨)').toBe(false);
    expect(chatText).toContain('인계 기록에서 도출된 흐름');

    const { procDefId, definition } = await saveAndRead(page, tag);
    return { roomId, procDefId, definition, chatText, disc };
}

/** 방의 산출물을 저장하고 저장된 정의를 읽는다. */
async function saveAndRead(page: Page, tag: string) {
    // 저장 전 실제 엔진 검증이 끝나길 기다린 뒤 저장
    const vis = '.artifact-panel__content:visible ';
    const procTab = page
        .locator('.artifact-panel__tab')
        .filter({ hasNotText: /산출물\s*파일/ })
        .first();
    if (await procTab.count()) await procTab.click().catch(() => {});
    const validating = page.locator(`${vis}.ws-files__header`, { hasText: /검증 중/ });
    await until(async () => !((await validating.count()) && (await validating.isVisible().catch(() => false))), '저장 전 검증', 1_800_000);
    await shot(page, `${tag}-03-generated`);
    const saveBtn = page.locator(`${vis}.ws-files__header`).getByRole('button', { name: /저장/ }).first();
    const savedBtn = page.locator(`${vis}.ws-files__header`).getByRole('button', { name: /저장됨/ });
    // 저장 전 자동 검증이 뒤늦게 시작되기도 한다 — 잠시 두고 다시 끝나길 기다린 뒤 누른다.
    // 검증 중에 누른 저장은 반영되지 않으므로 '저장됨'이 안 뜨면 한 번 더 누른다.
    for (let attempt = 0; attempt < 3 && !(await savedBtn.count()); attempt++) {
        await page.waitForTimeout(5_000);
        await until(
            async () => !((await validating.count()) && (await validating.isVisible().catch(() => false))),
            '저장 전 검증',
            1_800_000
        );
        await expect(saveBtn).toBeEnabled({ timeout: 60_000 });
        await saveBtn.click();
        await savedBtn.waitFor({ state: 'visible', timeout: 30_000 }).catch(() => {});
    }
    const saveErr = (await page.locator(`${vis}.ws-files__truncated`).allInnerTexts()).join(' ');
    await expect(savedBtn, `저장 결과(화면 오류: ${saveErr || '없음'})`).toBeVisible({ timeout: 30_000 });
    await shot(page, `${tag}-04-saved`);

    // 저장된 정의 — 방의 bpmn 미리보기 '편집'이 정의 화면으로 데려간다
    const bpmnItem = page.locator(`${vis}.ws-files__item`, { hasText: /\.bpmn/ }).first();
    await bpmnItem.click();
    await page
        .locator(`${vis}.hwpx-viewer`)
        .getByRole('button', { name: /^\s*편집\s*$/ })
        .first()
        .click();
    await page.waitForURL(/\/definitions\//, { timeout: 30_000 });
    const procDefId = decodeURIComponent(page.url().match(/\/definitions\/([^?#]+)/)![1]);
    const [row] = await sb(page, 'proc_def', { id: procDefId }, 'id,definition,is_draft');
    expect(row?.definition, `저장된 정의 ${procDefId}`).toBeTruthy();
    // 다이어그램은 역할(레인)별로 노드를 놓는다 — 이벤트·게이트웨이도 레인에 들어가야 선이 깨지지 않는다
    const laneless = [...(row.definition.events || []), ...(row.definition.gateways || [])]
        .filter((n: any) => !n.role)
        .map((n: any) => n.id);
    expect(laneless, '레인(역할)이 없는 이벤트·게이트웨이').toEqual([]);
    await page.waitForTimeout(4_000);
    await shot(page, `${tag}-05-diagram`);
    return { procDefId, definition: row.definition };
}

type People = Record<string, Page>; // user id → 로그인한 화면

/** 지금 화면(할 일 폼)에서 판단 선택 필드에 value 를 고른다. 선택 필드가 없으면 false. */
async function chooseDecision(page: Page, value: string): Promise<boolean> {
    // 판단 필드는 게이트웨이 이름('분기'·'반복 판정')을 라벨로 단다. 역할 지정 필드는 건드리지 않는다
    // (열고 Escape 를 누르면 실행 창이 닫힌다).
    const field = page.locator('.v-select:visible', { hasText: /분기|판정/ }).last();
    if (!(await field.count())) return false;
    await field.click();
    const option = page.locator('.v-overlay--active .v-list-item', { hasText: value }).first();
    await expect(option).toBeVisible({ timeout: 10_000 });
    await option.click();
    await expect(field).toContainText(value);
    return true;
}

async function fillText(page: Page, step: string) {
    const fields = page.locator(
        '.dynamic-form:visible input[type="text"]:not([readonly]):not([disabled]), .dynamic-form:visible textarea:not([readonly]):not([disabled])'
    );
    for (let i = 0; i < (await fields.count()); i++) {
        const f = fields.nth(i);
        if (!(await f.inputValue({ timeout: 3_000 }).catch(() => 'x')))
            await f.fill(`${step} e2e 입력`, { timeout: 5_000 }).catch(() => {});
    }
}

/**
 * 실행: 첫 단계 담당자가 시작하고, 열린 할 일을 담당자가 자기 화면에서 제출한다. 에이전트 단계는 기다린다.
 * decide[단계 이름] = 그 단계 폼에서 고를 분기값 목록(차례대로 쓴다).
 */
async function execute(
    people: People,
    starter: Page,
    procDefId: string,
    decide: Record<string, string[]>,
    tag: string,
    firstActivity: string
) {
    const pick = Object.fromEntries(Object.entries(decide).map(([k, v]) => [k, [...v]]));
    await starter.goto(`${BASE}/definition-map/sub/${procDefId}`, { waitUntil: 'domcontentloaded' });
    const run = starter.getByRole('button', { name: /^실행$/ }).first();
    await expect(run).toBeVisible({ timeout: 60_000 });
    await run.click();
    await starter.waitForTimeout(4_000);
    await shot(starter, `${tag}-10-start-form`);
    await submitCurrentForm(starter, pick, tag, 0, firstActivity);
    console.log(`[${tag}] 시작 폼 제출`);
    await starter.waitForURL(/\/instancelist\//, { timeout: 120_000, waitUntil: 'commit' });
    console.log(`[${tag}] 인스턴스 화면 ${starter.url()}`);
    // 인스턴스 화면 주소는 id 의 '.' 을 '_DOT_' 로 바꿔 쓴다
    const instId = decodeURIComponent(starter.url().match(/\/instancelist\/([^?#]+)/)![1]).replace(/_DOT_/g, '.');

    // 실제로 처리한 차례(단계·담당자). 엔진은 반복 때 같은 할 일 행을 다시 IN_PROGRESS 로 쓰므로
    // 행 목록만으로는 반복 횟수가 남지 않는다 — 처리할 때마다 기록한다.
    const steps: { activity_name: string; user_id: string }[] = [{ activity_name: firstActivity, user_id: await myId(starter) }];
    for (let step = 1; step < 30; step++) {
        const inst = (await sb(starter, 'bpm_proc_inst', { proc_inst_id: instId }, 'status'))[0];
        if (/COMPLETED/i.test(inst?.status || '')) break;
        const items = await sb(starter, 'todolist', { proc_inst_id: instId }, 'id,activity_name,user_id,status,log', 'start_date');
        // 지금 차례인 일만(IN_PROGRESS). 엔진은 갈래 뒤에 올 수 있는 단계를 TODO(예정)로 미리 만든다
        const open = items.find((w: any) => /^IN_PROGRESS$/i.test(w.status));
        if (!open) {
            await new Promise((r) => setTimeout(r, 8_000));
            continue;
        }
        console.log(`[${tag}] 열린 할 일 ${open.activity_name} → ${open.user_id}`);
        const page = people[open.user_id];
        if (!page) {
            // 에이전트(또는 화면 없는 담당자) 단계 — 처리될 때까지 기다린다
            await until(
                async () => {
                    const [w] = await sb(starter, 'todolist', { id: open.id }, 'status');
                    return /DONE|SUBMITTED|COMPLETED/i.test(w?.status || '');
                },
                `에이전트 단계 ${open.activity_name}`,
                900_000,
                10_000
            );
            steps.push({ activity_name: open.activity_name, user_id: open.user_id });
            continue;
        }
        steps.push({ activity_name: open.activity_name, user_id: open.user_id });
        await page.goto(`${BASE}/todolist/${open.id}`, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(5_000);
        await submitCurrentForm(page, pick, tag, step, open.activity_name);
        await until(
            async () => {
                const [w] = await sb(page, 'todolist', { id: open.id }, 'status');
                return /DONE|SUBMITTED|COMPLETED/i.test(w?.status || '');
            },
            `제출 ${open.activity_name}`,
            120_000,
            3_000
        );
    }
    const done = await until(
        async () => {
            const [inst] = await sb(starter, 'bpm_proc_inst', { proc_inst_id: instId }, 'status');
            return /COMPLETED/i.test(inst?.status || '') ? inst : null;
        },
        '인스턴스 완료',
        600_000,
        8_000
    );
    await starter.goto(`${BASE}/instancelist/${instId.replace(/\./g, '_DOT_')}`, { waitUntil: 'domcontentloaded' });
    await starter.waitForTimeout(5_000);
    await shot(starter, `${tag}-19-instance-completed`);
    return { instId, status: done.status, trail: steps };
}

async function submitCurrentForm(page: Page, pick: Record<string, string[]>, tag: string, step: number, activity = '') {
    const name = activity;
    await fillText(page, name || `step${step}`);
    const want = pick[name]?.[0];
    if (want) {
        expect(await chooseDecision(page, want), `'${name}' 폼에 분기값 '${want}' 선택지가 있어야 한다`).toBe(true);
        pick[name].shift();
    }
    await shot(page, `${tag}-1${step}-form-${name || 'start'}`);
    const submit = page.getByRole('button', { name: /제출.*완료|완료.*제출/ }).first();
    await expect(submit).toBeEnabled({ timeout: 60_000 });
    await submit.click();
}

async function everyone(browser: Browser, hong: Page) {
    const pages: People = { [await myId(hong)]: hong };
    for (const who of [PEOPLE.lee, PEOPLE.park]) {
        const p = await login(browser, who);
        pages[await myId(p)] = p;
    }
    return pages;
}

/**
 * 한 형태를 끝까지 확인한다.
 *  - 전환된 정의의 구조가 도출된 구조와 같다(AC2)
 *  - 실행하면 관측된 흐름 중 하나를 같은 담당자가 같은 순서로 밟고 완료된다(AC1)
 *  - 다시 전환해도 구조가 같다(AC3)
 */
async function verifyCase(browser: Browser, c: { tag: string; activity: string; decide: Record<string, string[]> }) {
    const hong = await login(browser, PEOPLE.hong);
    // 디버깅용: 이미 전환·저장한 정의로 실행만 다시 확인한다(RUN_ONLY_DEF=<proc_def id>)
    const reuse = process.env.RUN_ONLY_DEF;
    let first: Converted & { disc: any };
    let second: Converted | null = null;
    if (reuse) {
        const { disc: d } = await openMining(hong, c.activity);
        const [row] = await sb(hong, 'proc_def', { id: reuse }, 'definition');
        first = { roomId: '', procDefId: reuse, definition: row.definition, chatText: '', disc: d };
    } else {
        first = await convert(hong, c.activity, `${c.tag}-a`);
    }
    const disc = first.disc;
    writeFileSync(`${OUT}/${c.tag}-discovered.json`, JSON.stringify(disc.definition, null, 2));
    writeFileSync(`${OUT}/${c.tag}-converted.json`, JSON.stringify(first.definition, null, 2));
    expect(signature(first.definition), 'AC2 — 전환된 흐름이 도출된 흐름과 같다').toEqual(signature(disc.definition));

    if (!reuse) {
        second = await convert(hong, c.activity, `${c.tag}-b`);
        writeFileSync(`${OUT}/${c.tag}-reconverted.json`, JSON.stringify(second.definition, null, 2));
        expect(signature(second.definition), 'AC3 — 다시 전환해도 흐름이 같다').toEqual(signature(first.definition));
    }

    const people = await everyone(browser, hong);
    const startId = disc.definition.sequences.find((q: any) => q.source === 'start_event')?.target;
    const firstActivity = disc.definition.activities.find((a: any) => a.id === startId)?.name || '';
    const run = await execute(people, hong, first.procDefId, c.decide, c.tag, firstActivity);
    writeFileSync(`${OUT}/${c.tag}-run.json`, JSON.stringify(run, null, 2));
    const endpoint: Record<string, string> = {};
    for (const r of disc.definition.roles) endpoint[r.name] = r.endpoint;
    const roleOf: Record<string, string> = {};
    for (const a of disc.definition.activities) roleOf[a.name] = endpoint[a.role];
    const trace = run.trail.map((w: any) => w.activity_name);
    const observed = disc.stats.variants.map((v: any) => v.trace.join('→'));
    expect(observed, `AC1 — 실행 순서 ${trace.join('→')} 가 인계 때 관측된 흐름이어야 한다`).toContain(trace.join('→'));
    for (const w of run.trail) {
        expect(w.user_id, `AC1 — '${w.activity_name}' 담당자가 인계 때와 같아야 한다`).toBe(roleOf[w.activity_name]);
    }
    expect(run.status).toMatch(/COMPLETED/i);
    return { first, second, run };
}

test('@agent 두 사람 인계 — 전환한 프로세스를 같은 두 사람이 같은 순서로 끝내고, 다시 전환해도 같다', async ({ browser }) => {
    await verifyCase(browser, { tag: 'two', activity: '계약서 작성', decide: {} });
});

test('@agent 갈래 — 고른 갈래의 담당자가 일하고, 다시 전환해도 같다', async ({ browser }) => {
    await verifyCase(browser, { tag: 'branch', activity: '구매 요청 접수', decide: { '구매 요청 접수': ['팀장 승인'] } });
});

test('@agent 반려 후 재검토 — 반려하면 수정 후 다시 검토하고, 다시 전환해도 같다', async ({ browser }) => {
    await verifyCase(browser, {
        tag: 'rework',
        activity: '견적서 수정',
        decide: { '견적 검토': ['견적서 수정 필요', '완료'] }
    });
});

test('@agent 에이전트 중간 단계 — 에이전트가 맡던 단계를 그 에이전트가 처리하고, 다시 전환해도 같다', async ({ browser }) => {
    await verifyCase(browser, { tag: 'agent', activity: '견적서 초안 작성', decide: {} });
});

test('@agent 이유 표시 — 전환한 방에서 흐름을 바꿔 달라고 하면, 반영하지 않은 이유가 화면에 보이고 흐름은 그대로다', async ({
    browser
}) => {
    const hong = await login(browser, PEOPLE.hong);
    const { disc } = await openMining(hong, '계약서 작성');
    await hong.locator('.e2e-convert-process').click();
    await hong.waitForURL(/\/chat\?roomId=/, { timeout: 60_000 });
    // 생성이 끝날 때까지(후보는 건너뛴다) — convert() 와 같은 기다림을 쓰되 저장은 하지 않는다
    const done = hong.locator('.ai-message-bubble', { hasText: /확인 후 저장/ });
    for (let i = 0; i < 180 && !(await done.count()); i++) {
        const skip = hong
            .locator('.human-feedback-panel')
            .last()
            .getByRole('button', { name: /건너뛰기/ });
        if ((await skip.count()) && (await skip.isVisible().catch(() => false))) await skip.click().catch(() => {});
        await hong.waitForTimeout(5_000);
    }
    await expect(done.first()).toBeVisible();
    // 답하지 않은 질문 패널이 남아 있으면 그 답으로 읽히지 않도록 먼저 건너뛴다
    const pending = hong
        .locator('.human-feedback-panel')
        .last()
        .getByRole('button', { name: /건너뛰기/ });
    if ((await pending.count()) && (await pending.isVisible().catch(() => false)) && (await pending.isEnabled())) {
        await pending.click();
        await hong.waitForTimeout(10_000);
    }
    const bubbles = hong.locator('.ai-message-bubble');
    const before = await bubbles.count();

    // 후보 패널의 '직접 입력'란도 textarea 라 대화 입력란을 자리표시로 가리킨다
    const input = hong.getByPlaceholder('메시지 입력').first();
    await input.fill("계약서 검토 다음에 '법무 검토' 단계를 추가하고 담당은 박대리로 해 주세요.");
    await input.press('Enter');
    // 에이전트 답 또는 시스템 안내 중 하나 — 흐름을 바꾸지 않은 이유가 '법무 검토'와 함께 나와야 한다
    // 표현은 에이전트마다 다르다('바꾸지 않습니다' · '반영하지 않았어요' · '원래 구조로 되돌립니다') — 이유가 요청과 함께 나오면 된다
    const refuse = '(바꾸지 않|변경하지 않|반영하지 않|되돌|유지|정의 편집기)';
    const reasonRe = new RegExp(`${refuse}[\\s\\S]*법무 검토|법무 검토[\\s\\S]*${refuse}`);
    const text = await until(
        async () => {
            if ((await bubbles.count()) <= before) return null;
            const t = (await bubbles.allInnerTexts()).slice(before).join('\n');
            return reasonRe.test(t) ? t : null;
        },
        '흐름을 바꾸지 않은 이유',
        300_000
    );
    await hong.waitForTimeout(3_000);
    await shot(hong, 'reason-01-change-refused');
    expect(text, 'AC4 — 흐름을 바꾸지 않은 이유가 화면에 보여야 한다').toMatch(reasonRe);
    expect(
        await hong.locator('.human-feedback-panel:visible', { hasText: /새 설계/ }).count(),
        '흐름을 다시 그리는 선택지를 내지 않는다'
    ).toBe(0);

    // 저장해도 흐름은 도출된 그대로다
    const saved = await saveAndRead(hong, 'reason');
    expect(signature(saved.definition), 'AC4 — 요청이 반영되지 않았으니 흐름은 그대로').toEqual(signature(disc.definition));
});
