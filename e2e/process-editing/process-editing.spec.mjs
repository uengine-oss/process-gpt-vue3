import { test, expect } from '@playwright/test';

const fixture = '/e2e/process-editing/index.html';

for (const mode of ['card', 'tree']) {
    test(`${mode}: small pointer movement still opens the process with one click`, async ({ page }) => {
        await page.goto(`${fixture}?mode=${mode}`);
        await page.waitForFunction(() => window.ready);
        const name = page.getByText('시정조치', { exact: true });
        const box = await name.boundingBox();
        await page.mouse.move(box.x + 10, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + 18, box.y + box.height / 2, { steps: 4 });
        await page.mouse.up();
        await expect.poll(() => page.evaluate(() => window.navigations)).toEqual([['capa', '시정조치']]);
        const handle = page.locator(mode === 'card' ? '.sub-drag-handle' : '.drag-handle');
        await expect(handle).toBeVisible();
        await handle.click();
        expect(await page.evaluate(() => window.navigations.length)).toBe(1);
        await page.locator('.fav-btn').click();
        expect(await page.evaluate(() => window.favorites)).toEqual(['capa']);
        expect(await page.evaluate(() => window.navigations.length)).toBe(1);
    });
}

test('task replacement preserves all paths and labels through undo, redo and XML round trip', async ({ page }, testInfo) => {
    await page.goto(fixture);
    await page.waitForFunction(() => window.ready);
    await page.locator('#canvas').screenshot({ path: testInfo.outputPath('corrective-action.png') });
    const result = await page.evaluate(async () => {
        const m = window.modeler;
        const registry = m.get('elementRegistry');
        const stack = m.get('commandStack');
        const snapshot = () =>
            registry
                .filter((e) => e.waypoints)
                .map((e) => ({
                    id: e.id,
                    source: e.source.id,
                    target: e.target.id,
                    points: e.waypoints.map(({ x, y }) => ({ x, y })),
                    labels: e.labels.map(({ x, y, width, height }) => ({ x, y, width, height }))
                }))
                .sort((a, b) => a.id.localeCompare(b.id));
        const before = snapshot();
        const bounds = ({ x, y, width, height }) => ({ x, y, width, height });
        const originalBounds = bounds(registry.get('CA_Analyze'));
        const states = [];
        for (const type of [
            'bpmn:Task',
            'bpmn:ServiceTask',
            'bpmn:ManualTask',
            'bpmn:SendTask',
            'bpmn:ReceiveTask',
            'bpmn:ScriptTask',
            'bpmn:BusinessRuleTask',
            'bpmn:UserTask'
        ]) {
            m.get('bpmnReplace').replaceElement(registry.get('CA_Analyze'), { type });
            states.push({
                type: registry.get('CA_Analyze').type,
                expectedType: type,
                bounds: bounds(registry.get('CA_Analyze')),
                paths: snapshot()
            });
            stack.undo();
            states.push({ paths: snapshot() });
            stack.redo();
            states.push({ paths: snapshot() });
        }
        const { xml } = await m.saveXML({ format: true });
        await m.importXML(xml);
        const lanes = registry.filter((e) => e.type === 'bpmn:Lane');
        const assignments = lanes.flatMap((e) => e.businessObject.flowNodeRef.map((node) => node.id)).sort();
        const nodes = registry
            .filter((e) => !e.labelTarget && e.businessObject?.$instanceOf('bpmn:FlowNode'))
            .map((e) => e.id)
            .sort();
        return {
            before,
            originalBounds,
            states,
            after: snapshot(),
            warnings: window.importResult.warnings.map((w) => w.message),
            lanes: lanes.length,
            assignments,
            nodes
        };
    });
    expect(result.warnings).toEqual([]);
    expect(result.lanes).toBe(4);
    expect(result.assignments).toEqual(result.nodes);
    for (const state of result.states) {
        expect(state.paths).toEqual(result.before);
        if (state.expectedType) {
            expect(state.type).toBe(state.expectedType);
            expect(state.bounds).toEqual(result.originalBounds);
        }
    }
    expect(result.after).toEqual(result.before);
});

test('moving a task still reroutes its connections', async ({ page }) => {
    await page.goto(fixture);
    await page.waitForFunction(() => window.ready);
    expect(
        await page.evaluate(() => {
            const m = window.modeler;
            const task = m.get('elementRegistry').get('CA_Analyze');
            const flow = task.outgoing[0];
            const before = JSON.stringify(flow.waypoints);
            m.get('modeling').moveShape(task, { x: 40, y: 20 });
            return JSON.stringify(flow.waypoints) !== before;
        })
    ).toBe(true);
});
