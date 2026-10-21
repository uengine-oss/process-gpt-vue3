import { test, expect } from '@playwright/test';
const url = '/e2e/process-editing/drilldown.html';
const root = (page) => page.evaluate(() => window.modeler.get('canvas').getRootElement().id);
const drill = (page, id) => page.locator(`[data-container-id="${id}"] .ca-drilldown`).click();
const card = (page) => page.locator('.ca-drilldown-breadcrumbs');

async function open(page, suffix = '') {
    await page.goto(url + suffix);
    await page.waitForFunction(() => window.ready);
}

test('inline child has lanes, labels, connections and a return card; parent XML is unchanged', async ({ page }, testInfo) => {
    await open(page);
    await expect(page.locator('.ca-drilldown')).toHaveCount(3); // Start/End/Call, no duplicate on Start label
    await drill(page, 'Call');
    await expect.poll(() => root(page)).toBe('Call_ca_plane');
    await expect(card(page)).toBeVisible();
    await expect(card(page)).toContainText('시정조치 모듈');
    const result = await page.evaluate(async () => {
        const m = window.modeler;
        const registry = m.get('elementRegistry');
        const elements = registry.getAll().filter((e) => e._caDrilldown);
        return {
            unchanged: (await m.saveXML({ format: true })).xml === window.baselineXml,
            lanes: elements.filter((e) => e.type === 'bpmn:Lane').length,
            labels: elements.filter((e) => e.labelTarget).length,
            connections: elements.filter((e) => e.waypoints).length,
            childWithSameId: !!registry.get('Call::Call'),
            parentWithSameId: !!registry.get('Call'),
            commands: m.get('commandStack').canUndo(),
            readOnly: m.get('rules').allowed('elements.delete', { elements: [registry.get('Call::Call')] }) === false
        };
    });
    expect(result).toMatchObject({
        unchanged: true,
        lanes: 4,
        connections: 15,
        childWithSameId: true,
        parentWithSameId: true,
        commands: false,
        readOnly: true
    });
    expect(result.labels).toBeGreaterThan(0);
    await card(page)
        .getByRole('button', { name: /편집하기/ })
        .click();
    expect(await page.evaluate(() => window.opened)).toEqual([{ id: 'child', label: '시정조치 모듈' }]);
    await page.screenshot({ path: testInfo.outputPath('inline-drilldown.png') });
    await card(page)
        .getByRole('button', { name: /돌아가기/ })
        .click();
    await expect.poll(() => root(page)).toBe('Parent');
    await expect(card(page)).toBeHidden();
    expect(await page.evaluate(() => window.routerTransitions)).toEqual([]);
});

test('nested calls use browser back/forward without triggering Vue Router navigation', async ({ page }) => {
    await open(page);
    const routerState = await page.evaluate(() => ({ ...history.state }));
    await drill(page, 'Call');
    await expect.poll(() => root(page)).toBe('Call_ca_plane');
    await drill(page, 'Call::CA_Register');
    await expect.poll(() => root(page)).toBe('Call::CA_Register_ca_plane');
    await page.evaluate(() => history.back());
    await expect.poll(() => root(page)).toBe('Call_ca_plane');
    await page.evaluate(() => history.back());
    await expect.poll(() => root(page)).toBe('Parent');
    await page.evaluate(() => history.forward());
    await expect.poll(() => root(page)).toBe('Call_ca_plane');
    expect(await page.evaluate(() => window.routerTransitions)).toEqual([]);
    const state = await page.evaluate(() => history.state);
    for (const key of ['back', 'current', 'forward', 'position', 'scroll']) expect(state[key]).toEqual(routerState[key]);
    await page.evaluate(() => window.router.push('/outside'));
    expect(await page.evaluate(() => window.routerTransitions)).toEqual(['/outside']);
});

test('edit mode opens the referenced definition without importing a child plane', async ({ page }) => {
    await open(page, '?edit=1');
    await drill(page, 'Call');
    expect(await root(page)).toBe('Parent');
    expect(await page.evaluate(() => window.opened)).toEqual([{ id: 'child', label: '시정조치 모듈' }]);
    expect(await page.evaluate(() => window.requests)).toEqual([]);
    await expect(card(page)).toBeHidden();
});

test('failed loading keeps the parent intact and allows retry', async ({ page }) => {
    await open(page);
    await page.evaluate(() => {
        window.failRequest = true;
    });
    await drill(page, 'Call');
    await expect.poll(() => page.evaluate(() => window.errors)).toEqual(['조회 실패']);
    expect(await root(page)).toBe('Parent');
    await page.evaluate(() => {
        window.failRequest = false;
    });
    await drill(page, 'Call');
    await expect.poll(() => root(page)).toBe('Call_ca_plane');
});

test('pending imports cannot resurrect planes after a new diagram or destruction', async ({ page }) => {
    await open(page);
    await page.evaluate(() => {
        window.delayRequest = true;
    });
    await drill(page, 'Call');
    await page.waitForFunction(() => window.deferResolve);
    await page.evaluate(async () => {
        await window.modeler.importXML(window.parentXml);
        window.deferResolve();
    });
    await expect.poll(() => root(page)).toBe('Parent');
    expect(
        await page.evaluate(() =>
            window.modeler
                .get('elementRegistry')
                .getAll()
                .some((e) => e._caDrilldown)
        )
    ).toBe(false);
    await page.evaluate(() => {
        window.delayRequest = false;
    });
    await drill(page, 'Call');
    await expect.poll(() => root(page)).toBe('Call_ca_plane');
    await page.evaluate(() => window.modeler.destroy());
    await expect(card(page)).toHaveCount(0);
    expect(await page.evaluate(() => history.state.caDrilldown)).toBeUndefined();
    await page.evaluate(() => history.back());
    await expect.poll(() => page.evaluate(() => window.routerTransitions.length)).toBeGreaterThan(0);
});

test('extension definitionId takes precedence; malformed JSON falls back to calledElement', async ({ page }) => {
    await open(page, '?edit=1');
    await page.evaluate(() => {
        const m = window.modeler;
        const bo = m.get('elementRegistry').get('Call').businessObject;
        bo.extensionElements = m
            .get('moddle')
            .create('bpmn:ExtensionElements', {
                values: [m.get('moddle').create('uengine:Properties', { json: '{"definitionId":" override.bpmn "}' })]
            });
    });
    await drill(page, 'Call');
    expect(await page.evaluate(() => window.opened[0].id)).toBe('override');
    await page.evaluate(() => {
        window.modeler.get('elementRegistry').get('Call').businessObject.extensionElements.values[0].json = 'invalid';
    });
    await drill(page, 'Call');
    expect(await page.evaluate(() => window.opened[1].id)).toBe('child');
});

test('return restores the parent viewport and cached children do not duplicate overlays', async ({ page }) => {
    await open(page);
    const viewport = await page.evaluate(() => {
        const canvas = window.modeler.get('canvas');
        canvas.viewbox({ x: 100, y: 80, width: 1200, height: 750 });
        const { x, y, width, height } = canvas.viewbox();
        return { x, y, width, height };
    });
    await drill(page, 'Call');
    await expect.poll(() => root(page)).toBe('Call_ca_plane');
    await card(page)
        .getByRole('button', { name: /돌아가기/ })
        .click();
    await expect.poll(() => root(page)).toBe('Parent');
    const after = await page.evaluate(() => {
        const { x, y, width, height } = window.modeler.get('canvas').viewbox();
        return { x, y, width, height };
    });
    for (const key of Object.keys(viewport)) expect(after[key]).toBeCloseTo(viewport[key], 2);
    await drill(page, 'Call');
    await expect.poll(() => root(page)).toBe('Call_ca_plane');
    expect(await page.evaluate(() => window.requests)).toEqual(['child']);
    await expect(page.locator('[data-container-id="Call::CA_Register"] .ca-drilldown')).toHaveCount(1);
});
