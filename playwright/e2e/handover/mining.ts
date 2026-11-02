/**
 * 프로세스 식별 화면 e2e 공용 — 화면을 열고 업무를 골라, 화면이 받은 스레드·업무·도출 결과로 확인한다.
 * 확인은 화면 문구가 아니라 응답 데이터와 data-* 속성으로 한다.
 */
import { expect, type Page, type Response } from '@playwright/test';
import { BASE, shot } from './helpers';

type Tree = { kind: string; label?: string; children: Tree[] };

/** 마이너 트리 표기 seq('a', xor('b', τ), loop(...)) 를 읽는다. */
export function parseTree(src: string): Tree {
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
export function language(t: Tree, loops = 2): string[][] {
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

/** 도출 결과의 단계·흐름이 관측된 것만으로 이루어졌는가. */
export function assertOnlyObserved(disc: any) {
    const observed: string[][] = disc.stats.variants.flatMap((v: any) => [v.trace]);
    const model = language(parseTree(disc.tree));
    const acts = (ts: string[][]) => new Set(ts.flat());
    expect([...acts(model)].sort()).toEqual([...acts(observed)].sort());
    const unobserved = [...df(model)].filter((p) => !df(observed).has(p));
    expect(unobserved, `관측되지 않은 순서 — ${disc.tree}`).toEqual([]);
    const always = observed.reduce((acc, t) => acc.filter((a) => t.includes(a)), observed[0] || []);
    for (const t of model) {
        expect(
            always.filter((a) => !t.includes(a)),
            `필수 단계를 건너뛰는 경로 ${t.join('→')} — ${disc.tree}`
        ).toEqual([]);
    }
    for (const t of observed) {
        expect(
            model.some((m) => m.join('\u0001') === t.join('\u0001')),
            `관측된 흐름을 재현하지 못함 ${t.join('→')}`
        ).toBe(true);
    }
}

/** 도출 결과의 단계가 이 업무의 단계와 정확히 같다 — 다른 업무가 갈래로 끼지 않았다. */
export function expectOnlyThisBusiness(disc: any, activities: string[]) {
    const got = [...new Set((disc.stats?.variants || []).flatMap((v: any) => v.trace))].sort();
    expect(got, disc.tree).toEqual([...activities].sort());
}

/** 이 흐름이 도출 근거에 정확히 n건 있다(업무 이름에 실행별 도장이 있어 앞선 실행과 섞이지 않는다). */
export function expectVariant(disc: any, trace: string[], count: number) {
    const v = (disc.stats?.variants || []).find((x: any) => x.trace.join('→') === trace.join('→'));
    expect(v?.count ?? 0, `${trace.join('→')} — ${JSON.stringify(disc.stats?.variants)}`).toBe(count);
}

/**
 * 식별 화면을 열고 activity 가 든 업무를 선택 상자에서 골라, 화면이 받은 스레드·업무·도출 결과를 돌려준다.
 * 처음에 이미 골라진 업무면 다시 요청하지 않으므로, 화면이 받은 도출 응답을 모두 모아 두고 찾는다.
 */
export async function openMining(page: Page, activity: string, shotName?: string) {
    const discovered = new Map<string, any>();
    const onResponse = async (r: Response) => {
        if (!r.url().includes('/process-miner/discovered') || !r.ok()) return;
        const key = new URL(r.url()).searchParams.get('process_key') || '';
        discovered.set(key, await r.json().catch(() => null));
    };
    page.on('response', onResponse);
    try {
        const threadsRes = page.waitForResponse((r) => r.url().includes('/process-miner/threads'), { timeout: 60_000 });
        const groupsRes = page.waitForResponse((r) => r.url().includes('/process-miner/processes'), { timeout: 60_000 });
        await page.goto(`${BASE}/mining/handover`, { waitUntil: 'domcontentloaded' });
        const threads = (await (await threadsRes).json()).threads as any[];
        const groups = (await (await groupsRes).json()).processes as any[];
        const group = groups.find((g) => g.activities.includes(activity));
        expect(group, `${activity} 가 든 업무 — ${JSON.stringify(groups.map((g) => g.activities))}`).toBeTruthy();
        const select = page.locator('.e2e-process-select');
        await expect(select).toBeVisible({ timeout: 30_000 });
        if (!discovered.has(group.process_key)) {
            await select.click();
            await page.locator(`.e2e-process-option[data-key="${group.process_key}"]`).click();
        }
        await expect.poll(() => discovered.has(group.process_key), { timeout: 60_000 }).toBe(true);
        await page.waitForTimeout(1_500);
        if (shotName) await shot(page, shotName);
        return { threads, groups, group, disc: discovered.get(group.process_key) };
    } finally {
        page.off('response', onResponse);
    }
}

/** 식별 화면이 모델러에 넘긴 BPMN XML. 그려진 도형의 종류(병렬/배타, 다중 인스턴스)를 확인한다. */
export async function renderedXml(page: Page): Promise<string> {
    return page.evaluate(() => {
        let c: any = (document.querySelector('.mining-threads') as any)?.__vueParentComponent;
        while (c && !(c.proxy && typeof c.proxy.bpmnXml === 'string')) c = c.parent;
        return c?.proxy?.bpmnXml || '';
    });
}
