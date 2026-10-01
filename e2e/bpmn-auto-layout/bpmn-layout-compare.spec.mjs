// 기존 자동 정렬(window.BpmnAutoLayout, mdi-auto-fix) 과 신규 자동 정렬(src/lib/bpmnAutoLayout 열·행, mdi-view-column-outline)
// 을 같은 케이스에 각각 적용해 스크린샷 + 기하 통계(겹침·대각선·도형 관통)를 나란히 남긴다.
// 실행: npm run test:e2e:bpmn-layout-compare  → e2e/bpmn-auto-layout/e2e-results/bpmn-auto-layout/{screenshots,compare-summary.md}
import { test, expect } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const RESULT_DIR = 'e2e/bpmn-auto-layout/e2e-results/bpmn-auto-layout';
const SCREENSHOT_DIR = join(RESULT_DIR, 'screenshots');
const E2E_ROUTE = '/bpmn-auto-layout-e2e';

const CASES = [
    { slug: 'uengine6-01-purchase-request', index: 0, label: 'Purchase Request' },
    { slug: 'uengine6-02-srms', index: 1, label: 'SRMS' },
    { slug: 'uengine6-03-trouble-subprocess', index: 2, label: 'Trouble SubProcess' },
    { slug: 'uengine6-04-credit-rating', index: 3, label: 'Credit Rating' },
    { slug: 'uengine6-05-credit-rating-2', index: 4, label: 'Credit Rating 2' },
    { slug: 'uengine6-06-trouble-branch', index: 5, label: 'Trouble Branch' },
    { slug: 'uengine6-07-error-fix-process', index: 6, label: 'Error Fix Process' },
    { slug: 'uengine6-08-incident-reception', index: 7, label: 'Incident Reception' },
    { slug: 'uengine6-09-trouble-report-basic', index: 8, label: 'Trouble Report Basic' },
    { slug: 'uengine6-10-trouble-report-mapping', index: 9, label: 'Trouble Report Mapping' },
    { slug: 'uengine6-11-attached-contract-review', index: 10, label: 'Attached Contract Review' },
    { slug: 'uengine6-12-vendor-onboarding-improvement', index: 11, label: '협력사 온보딩 개선' },
    { slug: 'uengine6-13-vendor-security-review', index: 12, label: '협력사 보안 심사' }
];

const ENGINES = [
    { key: 'legacy', icon: 'mdi-auto-fix', label: '기존 로직' },
    { key: 'new', icon: 'mdi-view-column-outline', label: '신규 로직(열·행)' }
];

function shotPath(name) {
    return join(SCREENSHOT_DIR, `compare-${name}.png`);
}

async function screenshotCanvas(page, name) {
    await page.mouse.move(1260, 450);
    await page.waitForTimeout(200);
    const styleHandle = await page.addStyleTag({
        content: `.font-size-controls, .palette-toggle-button, .bjs-powered-by, .v-tooltip, .v-overlay.v-tooltip { display: none !important; }`
    });
    await page.evaluate(() => {
        const container = document.querySelector('#canvas-container');
        const viewport = document.querySelector('g.viewport');
        if (!container || !viewport || typeof viewport.getBBox !== 'function') return;
        const bbox = viewport.getBBox();
        if (!bbox || !isFinite(bbox.width) || bbox.width <= 0 || bbox.height <= 0) return;
        const rect = container.getBoundingClientRect();
        const padding = 40;
        const scale = Math.min((rect.width - padding * 2) / bbox.width, (rect.height - padding * 2) / bbox.height, 1.2);
        const tx = rect.width / 2 - (bbox.x + bbox.width / 2) * scale;
        const ty = rect.height / 2 - (bbox.y + bbox.height / 2) * scale;
        viewport.setAttribute('transform', `matrix(${scale} 0 0 ${scale} ${tx} ${ty})`);
    });
    await page.locator('#canvas-container').screenshot({ path: shotPath(name) });
    await styleHandle.evaluate((style) => style.remove());
}

/** 살아있는 모델러의 기하 통계 — Vue 컴포넌트 체인에서 bpmnViewer 를 찾는다 (dev 서버 전용). */
async function readGeometryStats(page) {
    return page.evaluate(() => {
        const host = document.querySelector('#canvas-container');
        let c = host && host.__vueParentComponent;
        let modeler = null;
        while (c) {
            const p = c.proxy;
            if (p && p.bpmnViewer && typeof p.bpmnViewer.get === 'function') {
                modeler = p.bpmnViewer;
                break;
            }
            c = c.parent;
        }
        if (!modeler) return { error: 'modeler not found' };
        const all = modeler.get('elementRegistry').getAll();
        const CONTAINER = new Set(['bpmn:Participant', 'bpmn:Lane', 'bpmn:Process', 'bpmn:Collaboration', 'label']);
        const shapes = all.filter((e) => !e.waypoints && !e.labelTarget && e.parent && !CONTAINER.has(e.type) && e.width > 0);
        const leaf = shapes.filter((s) => !(s.children && s.children.length));
        const box = (s) => ({ id: s.id, x: s.x, y: s.y, r: s.x + s.width, b: s.y + s.height });
        const boxes = leaf.map(box);
        const overlaps = [];
        for (let i = 0; i < boxes.length; i++) {
            for (let j = i + 1; j < boxes.length; j++) {
                const a = boxes[i];
                const b = boxes[j];
                if (a.x < b.r - 1 && b.x < a.r - 1 && a.y < b.b - 1 && b.y < a.b - 1) overlaps.push(`${a.id}~${b.id}`);
            }
        }
        const flows = all.filter((e) => e.waypoints && e.type === 'bpmn:SequenceFlow');
        const diagonal = [];
        const throughShape = [];
        for (const f of flows) {
            const w = f.waypoints;
            for (let i = 1; i < w.length; i++) {
                const a = w[i - 1];
                const b = w[i];
                if (Math.abs(a.x - b.x) > 0.5 && Math.abs(a.y - b.y) > 0.5) {
                    diagonal.push(f.id);
                    break;
                }
            }
            for (const s of boxes) {
                if (s.id === f.source?.id || s.id === f.target?.id) continue;
                if (f.source?.host?.id === s.id || f.target?.host?.id === s.id) continue;
                for (let i = 1; i < w.length; i++) {
                    const a = w[i - 1];
                    const b = w[i];
                    const x1 = Math.min(a.x, b.x);
                    const x2 = Math.max(a.x, b.x);
                    const y1 = Math.min(a.y, b.y);
                    const y2 = Math.max(a.y, b.y);
                    if (x1 < s.r - 2 && x2 > s.x + 2 && y1 < s.b - 2 && y2 > s.y + 2) {
                        throughShape.push(`${f.id}>${s.id}`);
                        break;
                    }
                }
            }
        }
        const signature = JSON.stringify([
            boxes.map((b) => [b.id, b.x, b.y]),
            flows.map((f) => [f.id, f.waypoints.map((p) => [p.x, p.y])])
        ]);
        return {
            shapes: shapes.length,
            flows: flows.length,
            overlaps,
            diagonal,
            throughShape,
            canUndo: modeler.get('commandStack').canUndo(),
            signature
        };
    });
}

/** 레이아웃 적용 후 도형/선 좌표가 stableMs 동안 변하지 않을 때까지 기다린다 (기존 로직은 지연 라우팅이 있음). */
async function waitForStableLayout(page, before, { stableMs = 2500, timeoutMs = 40000 } = {}) {
    const start = Date.now();
    let last = before.signature;
    let lastChange = Date.now();
    let changed = false;
    while (Date.now() - start < timeoutMs) {
        await page.waitForTimeout(500);
        const stats = await readGeometryStats(page);
        if (stats.signature !== last) {
            last = stats.signature;
            lastChange = Date.now();
            changed = true;
        } else if (changed && Date.now() - lastChange >= stableMs) {
            return { stats, ms: lastChange - start };
        }
    }
    return { stats: await readGeometryStats(page), ms: Date.now() - start, timedOut: !changed };
}

async function openE2EPage(page) {
    await page.goto(E2E_ROUTE);
    await page.waitForSelector('.djs-container, [class*="djs-"]', { timeout: 15000 });
    await page.waitForSelector('.djs-element, .djs-shape', { timeout: 15000 });
}

async function loadCaseByIndex(page, index) {
    await page.locator('.v-app-bar [class*="mdi-folder-open"]').first().click();
    await page.locator('.v-overlay-container .v-list-item').first().waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('.v-overlay-container .v-list-item').nth(index).click();
    await page.locator('.v-overlay-container .v-card').waitFor({ state: 'hidden', timeout: 10000 });
    await page.waitForSelector('.djs-element, .djs-shape', { timeout: 15000 });
    await page.waitForTimeout(800);
}

function fmt(stats) {
    return `${stats.overlaps.length} / ${stats.diagonal.length} / ${stats.throughShape.length}`;
}

test.describe('legacy vs new auto layout comparison', () => {
    test.describe.configure({ timeout: 180000 });

    test.beforeAll(() => {
        mkdirSync(SCREENSHOT_DIR, { recursive: true });
    });

    const SUMMARY_JSON = join(RESULT_DIR, 'compare-summary.json');

    // 실패한 테스트가 있으면 Playwright 가 워커를 재시작해 메모리상 summary 가 사라지므로
    // 케이스마다 파일에 병합 저장한다.
    function writeSummary(row) {
        let rows = [];
        if (existsSync(SUMMARY_JSON)) {
            try {
                rows = JSON.parse(readFileSync(SUMMARY_JSON, 'utf8'));
            } catch {
                rows = [];
            }
        }
        const known = new Set(CASES.map((c) => c.slug));
        rows = rows.filter((r) => known.has(r.slug) && r.slug !== row.slug);
        rows.push(row);
        rows.sort((a, b) => CASES.findIndex((c) => c.slug === a.slug) - CASES.findIndex((c) => c.slug === b.slug));
        writeFileSync(SUMMARY_JSON, JSON.stringify(rows, null, 2));
        const lines = [
            '# 자동 정렬 비교 (기존 로직 vs 신규 로직)',
            '',
            '각 칸: 겹치는 도형 쌍 / 대각선 sequenceFlow / 도형을 관통하는 sequenceFlow 수. ms = 클릭 후 좌표가 안정될 때까지.',
            '',
            '| 케이스 | 도형/선 | 로드 직후 | 기존 로직 | ms | 신규 로직 | ms | 스크린샷 |',
            '|---|---|---|---|---|---|---|---|'
        ];
        for (const r of rows) {
            const legacy = r.engines.legacy;
            const fresh = r.engines.new;
            if (!r.loaded) {
                lines.push(`| ${r.label} | - | (로드 실패) | - | - | - | - | - |`);
                continue;
            }
            lines.push(
                `| ${r.label} | ${r.loaded.shapes}/${r.loaded.flows} | ${fmt(r.loaded)} | ${legacy ? fmt(legacy.stats) : '-'} | ${
                    legacy ? legacy.ms : '-'
                } | ${fresh ? fmt(fresh.stats) : '-'} | ${fresh ? fresh.ms : '-'} | compare-${r.slug}-{loaded,legacy,new}.png |`
            );
        }
        writeFileSync(join(RESULT_DIR, 'compare-summary.md'), lines.join('\n') + '\n');
    }

    for (const caseItem of CASES) {
        test(`compare: ${caseItem.label}`, async ({ page }) => {
            const row = { slug: caseItem.slug, label: caseItem.label, loaded: null, engines: {} };
            const errors = [];
            page.on('pageerror', (e) => errors.push(String(e)));

            for (const [i, engine] of ENGINES.entries()) {
                await openE2EPage(page);
                await loadCaseByIndex(page, caseItem.index);
                const loaded = await readGeometryStats(page);
                expect(loaded.error, 'modeler lookup').toBeUndefined();
                if (i === 0) {
                    row.loaded = loaded;
                    await screenshotCanvas(page, `${caseItem.slug}-loaded`);
                }
                await page.locator(`.font-size-controls [class*="${engine.icon}"]`).first().click();
                const { stats, ms, timedOut } = await waitForStableLayout(page, loaded);
                row.engines[engine.key] = { stats: { ...stats, signature: undefined }, ms, timedOut: !!timedOut };
                await screenshotCanvas(page, `${caseItem.slug}-${engine.key}`);
                expect.soft(timedOut, `${engine.label}: 좌표 변화 없음`).toBeFalsy();
                if (engine.key === 'new') {
                    expect.soft(stats.diagonal, `${engine.label}: 대각선 선`).toEqual([]);
                    expect.soft(stats.overlaps, `${engine.label}: 도형 겹침`).toEqual([]);
                    expect.soft(stats.canUndo, `${engine.label}: Ctrl+Z 가능`).toBeTruthy();
                }
            }
            row.pageErrors = errors;
            writeSummary(row);
            await expect(page.locator('.v-alert[type="error"]')).not.toBeVisible();
            expect(errors, 'page errors').toEqual([]);
        });
    }
});
