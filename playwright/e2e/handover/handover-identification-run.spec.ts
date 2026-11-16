/**
 * 프로세스 식별로 저장한 정식 프로세스를 실제로 실행한다 (todo-2026-11-16 둘째 할일).
 *
 * 인수조건
 *  - 실행 전환·제안(병합 요청)으로 저장한 정식 프로세스가 화면에서 시작되어 마지막 단계까지 완료된다
 *  - 각 단계의 할 일이 그 단계의 담당자에게 간다. 모든 건이 거치는 단계는 언제나 거치고,
 *    어떤 경우에만 거치는 단계는 분기 조건에 맞을 때만 거친다
 *  - 단계 구성이 다른 정식 프로세스 두 개 이상에서 성립한다. API·스크립트로 시작하거나 완료하지 않는다
 *
 * 사람이 하는 대로 한다: 첫 단계 담당자가 정의 화면에서 '실행' 을 눌러 시작 폼을 제출하고, 다음 할 일은
 * 그 담당자가 자기 계정 화면(할 일)에서 폼을 채워 제출한다. 분기 판단 필드는 저장된 정의의 조건 문장 중
 * 이번 건이 맞는 것을 고른다. 확인용 조회만 로그인한 사용자 권한(같은 테넌트)으로 한다.
 *
 * 실행: HONG_EMAIL=… HONG_PASSWORD=… RUN_DEFS=mined_a,mined_b \
 *   npx playwright test -c playwright.processgpt-live.config.ts handover/handover-identification-run
 */
import { expect, test, type Browser, type Page } from '@playwright/test';
import { mkdirSync } from 'fs';
import { BASE, PEOPLE, login, myId } from './helpers';

const OUT = 'playwright/handover-e2e/identification-run';
mkdirSync(OUT, { recursive: true });
test.describe.configure({ mode: 'serial', timeout: 3_600_000 });
test.use({ actionTimeout: 30_000 });

const shot = (page: Page, name: string) => page.screenshot({ path: `${OUT}/${name}.png` });

async function sb<T = any>(page: Page, table: string, filters: Record<string, string>, select = '*', order?: string): Promise<T[]> {
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

type Defn = { activities: any[]; gateways: any[]; sequences: any[]; roles: any[]; events?: any[] };

/** 엔진이 새 인스턴스를 시작할 버전: 초안이 아닌 버전 중 가장 늦게 저장된 것 */
async function releasedVersion(page: Page, procDefId: string) {
    const rows = await sb(
        page,
        'proc_def_version',
        { proc_def_id: procDefId },
        'arcv_id,version,is_draft,definition,"timeStamp"',
        'timeStamp'
    );
    const released = rows.filter((r: any) => !r.is_draft);
    return { latest: rows[rows.length - 1], released: released[released.length - 1] };
}

/**
 * 배타 분기마다 갈래 → 조건 문장. 갈래는 그 흐름에서 처음 하는 단계 이름(아무것도 하지 않으면 '').
 */
function splits(d: Defn) {
    const outs = (id: string) => d.sequences.filter((s) => s.source === id);
    const name = (id: string) => d.activities.find((a) => a.id === id)?.name || '';
    const firstTask = (from: string, seen = new Set<string>()): string => {
        if (seen.has(from)) return '';
        seen.add(from);
        if (name(from)) return name(from);
        // 합류(들어오는 흐름이 둘 이상)에 닿으면 이 갈래는 아무 단계도 하지 않은 빈 갈래다
        if (d.sequences.filter((s) => s.target === from).length > 1) return '';
        const o = outs(from);
        return o.length === 1 ? firstTask(o[0].target, seen) : '';
    };
    const out: { gateway: string; before: string; ways: { first: string; condition: string }[] }[] = [];
    for (const g of d.gateways.filter((x) => /exclusive/i.test(x.type) && outs(x.id).length > 1)) {
        const before =
            d.sequences
                .filter((s) => s.target === g.id)
                .map((s) => name(s.source))
                .find(Boolean) || '';
        // 합류로 바로 가는 흐름(빈 갈래)은 first 가 다음 공통 단계가 된다 — 다른 갈래에도 있는 단계면 빈 갈래로 본다
        const ways = outs(g.id).map((s) => ({ first: firstTask(s.target), condition: String(s.condition || '') }));
        out.push({ gateway: g.id, before, ways });
    }
    return out;
}

/** 단계 이름 → 담당 사용자 id(정의의 역할 endpoint) */
function assignees(d: Defn) {
    const ep: Record<string, string> = {};
    for (const r of d.roles || []) ep[r.name] = r.endpoint;
    return Object.fromEntries(d.activities.map((a) => [a.name, ep[a.role] || '']));
}

async function chooseDecision(page: Page, value: string): Promise<boolean> {
    const field = page.locator('.v-select:visible', { hasText: /분기|판정/ }).last();
    if (!(await field.count())) return false;
    await field.click();
    const option = page.locator('.v-overlay--active .v-list-item', { hasText: value }).first();
    await expect(option).toBeVisible({ timeout: 10_000 });
    await option.click();
    await expect(field).toContainText(value.slice(0, 20));
    return true;
}

/** 폼의 빈 칸을 채운다. 선택 칸은 첫 선택지를 고른다(분기 판단 칸은 chooseDecision 이 고른다) */
async function fillForm(page: Page, step: string) {
    const fields = page.locator(
        '.dynamic-form:visible input[type="text"]:not([readonly]):not([disabled]), .dynamic-form:visible textarea:not([readonly]):not([disabled])'
    );
    for (let i = 0; i < (await fields.count()); i++) {
        const f = fields.nth(i);
        if (!(await f.inputValue({ timeout: 3_000 }).catch(() => 'x'))) await f.fill(`${step} 처리`, { timeout: 5_000 }).catch(() => {});
    }
    const nums = page.locator('.dynamic-form:visible input[type="number"]:not([readonly]):not([disabled])');
    for (let i = 0; i < (await nums.count()); i++) {
        const f = nums.nth(i);
        if (!(await f.inputValue({ timeout: 3_000 }).catch(() => 'x'))) await f.fill('350000', { timeout: 5_000 }).catch(() => {});
    }
    const dates = page.locator('.dynamic-form:visible input[type="date"]:not([readonly]):not([disabled])');
    for (let i = 0; i < (await dates.count()); i++)
        await dates
            .nth(i)
            .fill('2026-11-16', { timeout: 5_000 })
            .catch(() => {});
    const selects = page.locator('.dynamic-form:visible .v-select').filter({ hasNotText: /분기|판정/ });
    for (let i = 0; i < (await selects.count()); i++) {
        const s = selects.nth(i);
        if (!(await s.isVisible().catch(() => false))) continue;
        const has = (await s.locator('.v-select__selection-text').count()) > 0;
        if (has) continue;
        await s.click().catch(() => {});
        const opt = page.locator('.v-overlay--active .v-list-item').first();
        if (await opt.isVisible().catch(() => false)) await opt.click().catch(() => {});
        // Escape 는 실행 창을 닫는다 — 선택지가 안 열렸으면 폼 제목을 눌러 닫는다
        else await page.locator('.dynamic-form:visible').first().click({ position: { x: 5, y: 5 } }).catch(() => {});
    }
}

async function submit(page: Page, step: string, decide: Record<string, string>, tag: string, n: number) {
    await fillForm(page, step);
    const want = decide[step];
    if (want) expect(await chooseDecision(page, want), `'${step}' 폼에 분기 판단 '${want}' 선택지`).toBe(true);
    await shot(page, `${tag}-${String(n).padStart(2, '0')}-${step}`);
    const btn = page.getByRole('button', { name: /제출.*완료|완료.*제출/ }).first();
    await expect(btn).toBeEnabled({ timeout: 60_000 });
    await btn.click();
}

type People = Record<string, Page>;

/** 정의 화면에서 시작해, 열린 할 일을 담당자가 자기 화면에서 제출하며 끝까지 진행한다 */
async function run(people: People, starter: Page, procDefId: string, decide: Record<string, string>, first: string, tag: string) {
    await starter.goto(`${BASE}/definition-map/sub/${procDefId}`, { waitUntil: 'domcontentloaded' });
    const btn = starter.getByRole('button', { name: /^실행$/ }).first();
    await expect(btn).toBeVisible({ timeout: 60_000 });
    await btn.click();
    await starter.waitForTimeout(4_000);
    await submit(starter, first, decide, tag, 0);
    await starter.waitForURL(/\/instancelist\//, { timeout: 120_000, waitUntil: 'commit' });
    const instId = decodeURIComponent(starter.url().match(/\/instancelist\/([^?#]+)/)![1]).replace(/_DOT_/g, '.');
    const trail: { step: string; user: string }[] = [{ step: first, user: await myId(starter) }];
    const handled = new Set<string>();
    // 엔진(폴링)이 다음 할 일을 여는 데 걸리는 시간은 일정하지 않다 — 횟수가 아니라 시간으로 기다린다
    const deadline = Date.now() + 15 * 60_000;
    for (let n = 1; Date.now() < deadline; n++) {
        const [inst] = await sb(starter, 'bpm_proc_inst', { proc_inst_id: instId }, 'status');
        if (/COMPLETED/i.test(inst?.status || '')) break;
        const items = await sb(starter, 'todolist', { proc_inst_id: instId }, 'id,activity_name,user_id,status', 'start_date');
        const open = items.find((w: any) => /^IN_PROGRESS$/i.test(w.status) && !handled.has(w.id));
        if (!open) {
            await new Promise((r) => setTimeout(r, 6_000));
            continue;
        }
        handled.add(open.id);
        trail.push({ step: open.activity_name, user: open.user_id });
        const page = people[open.user_id];
        expect(page, `'${open.activity_name}' 의 담당자(${open.user_id})가 로그인한 사람 중에 있다`).toBeTruthy();
        await page.goto(`${BASE}/todolist/${open.id}`, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(5_000);
        await submit(page, open.activity_name, decide, tag, n);
        await until(
            async () => /DONE|SUBMITTED|COMPLETED/i.test((await sb(page, 'todolist', { id: open.id }, 'status'))[0]?.status || ''),
            `제출 ${open.activity_name}`,
            120_000,
            3_000
        );
    }
    const done = await until(
        async () => {
            const [inst] = await sb(starter, 'bpm_proc_inst', { proc_inst_id: instId }, 'status,proc_def_version');
            return /COMPLETED/i.test(inst?.status || '') ? inst : null;
        },
        '인스턴스 완료',
        600_000,
        6_000
    );
    await starter.goto(`${BASE}/instancelist/${instId.replace(/\./g, '_DOT_')}`, { waitUntil: 'domcontentloaded' });
    await starter.waitForTimeout(5_000);
    await shot(starter, `${tag}-99-completed`);
    return { instId, version: done.proc_def_version, trail };
}

async function everyone(browser: Browser) {
    const hong = await login(browser, PEOPLE.hong);
    const pages: People = { [await myId(hong)]: hong };
    for (const who of [PEOPLE.lee, PEOPLE.park]) {
        const p = await login(browser, who);
        pages[await myId(p)] = p;
    }
    return { hong, pages };
}

const DEFS = (process.env.RUN_DEFS || 'mined_cc674492fc5d,mined_d760498aab90').split(',').filter(Boolean);

for (const procDefId of DEFS) {
    test(`식별로 저장한 정식 프로세스 ${procDefId} — 분기 갈래마다 끝까지 실행`, async ({ browser }) => {
        const { hong, pages } = await everyone(browser);
        const { latest, released } = await releasedVersion(hong, procDefId);
        expect(released, `${procDefId} 의 정식(초안 아님) 버전`).toBeTruthy();
        const d: Defn = released.definition;
        const who = assignees(d);
        const sp = splits(d);
        expect(sp.length, '분기가 하나 이상 있는 정의로 확인한다').toBeGreaterThan(0);
        expect(
            sp.every((s) => s.ways.every((w) => w.condition.trim())),
            '분기의 모든 흐름에 업무 조건'
        ).toBe(true);
        // 시작 단계: 시작 이벤트 바로 뒤
        const start = d.sequences.find((s) => /start/i.test(s.source))!;
        const first = d.activities.find((a) => a.id === start.target)!.name;
        const required = d.activities.map((a) => a.name).filter((n) => !sp.some((s) => s.ways.some((w) => w.first === n)));

        // 첫 분기의 갈래마다 한 번씩 실행한다
        const s0 = sp[0];
        for (const [i, way] of s0.ways.entries()) {
            const tag = `${procDefId}-${i}`;
            const r = await run(pages, hong, procDefId, { [s0.before]: way.condition }, first, tag);
            console.log(`[${tag}] ${r.version} ${r.trail.map((t) => t.step).join(' → ')}`);
            // 승인 전 제안(초안) 버전이 아니라 정식 버전으로 돈다
            expect(r.version, '인스턴스가 고정된 버전').toBe(released.arcv_id);
            if (latest.is_draft) expect(r.version).not.toBe(latest.arcv_id);
            // 각 단계의 할 일은 그 단계의 담당자에게
            for (const t of r.trail) expect(t.user, `'${t.step}' 담당자`).toBe(who[t.step]);
            const steps = r.trail.map((t) => t.step);
            // 모든 건이 거치는 단계는 언제나 거친다
            for (const n of required) expect(steps, `필수 단계 '${n}'`).toContain(n);
            // 고른 갈래의 단계만 거친다
            for (const other of s0.ways.filter((w) => w !== way && w.first && !required.includes(w.first)))
                expect(steps, `고르지 않은 갈래 '${other.first}'`).not.toContain(other.first);
            if (way.first && !required.includes(way.first)) expect(steps, `고른 갈래 '${way.first}'`).toContain(way.first);
        }
    });
}
