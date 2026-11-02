import { test, expect } from '@playwright/test';

const cases = [
    { name: 'credit vertical branch', index: 3, rotations: 1, flow: 'Flow_1vkw8st', segment: 0, dx: 0, dy: 35 },
    { name: 'subprocess horizontal terminal segment', index: 2, rotations: 2, flow: 'Flow_0j41oad', segment: 1, dx: 35, dy: 0 },
    { name: 'subprocess horizontal interior segment', index: 2, rotations: 2, flow: 'Flow_09hmm06', segment: 1, dx: 0, dy: 35 }
];

async function snapshot(page) {
    return page.evaluate(() => {
        const viewer = window.$bpmnAutoLayoutE2E.$refs.bpmn.bpmnViewer;
        return viewer.get('elementRegistry').getAll().map(element => ({
            id: element.id, type: element.type, parent: element.parent?.id,
            x: element.x, y: element.y, width: element.width, height: element.height,
            horizontal: element.di?.isHorizontal,
            waypoints: element.waypoints?.map(point => [point.x, point.y])
        })).sort((a, b) => a.id.localeCompare(b.id));
    });
}

async function getRenderedEndpointGaps(page, flowId) {
    return page.evaluate(flowId => {
        const viewer = window.$bpmnAutoLayoutE2E.$refs.bpmn.bpmnViewer;
        const edge = viewer.get('elementRegistry').get(flowId);
        const path = document.querySelector(`g.djs-connection[data-element-id="${flowId}"] .djs-visual > path`);
        if (!path) throw new Error('Connection visual is missing');
        const matrix = document.querySelector('g.viewport').getScreenCTM().inverse();
        const distance = (point, shape) => {
            const cx = shape.x + shape.width / 2, cy = shape.y + shape.height / 2;
            if (shape.type.endsWith('Gateway')) {
                return Math.abs(Math.abs(point.x - cx) / (shape.width / 2) +
                    Math.abs(point.y - cy) / (shape.height / 2) - 1) * Math.min(shape.width, shape.height) / 2;
            }
            if (shape.type.endsWith('Event')) {
                return Math.abs(Math.hypot((point.x - cx) / (shape.width / 2),
                    (point.y - cy) / (shape.height / 2)) - 1) * Math.min(shape.width, shape.height) / 2;
            }
            const dx = Math.max(shape.x - point.x, 0, point.x - shape.x - shape.width);
            const dy = Math.max(shape.y - point.y, 0, point.y - shape.y - shape.height);
            return dx || dy ? Math.hypot(dx, dy) : Math.min(point.x - shape.x,
                shape.x + shape.width - point.x, point.y - shape.y, shape.y + shape.height - point.y);
        };
        return [edge.source, edge.target].map((shape, index) => {
            const local = path.getPointAtLength(index ? path.getTotalLength() : 0);
            const point = local.matrixTransform(path.getScreenCTM()).matrixTransform(matrix);
            return distance(point, shape);
        });
    }, flowId);
}

for (const item of cases) {
    test(`connection segment keeps orthogonal path: ${item.name}`, async ({ page }, testInfo) => {
        const errors = [];
        page.on('pageerror', error => errors.push(String(error)));
        await page.setViewportSize({ width: 1500, height: 1050 });
        await page.goto('/bpmn-auto-layout-e2e');
        await page.locator('.djs-palette [data-action="change-orientation"]').waitFor();
        await page.locator('.v-app-bar [class*="mdi-folder-open"]').click();
        await page.locator('.v-overlay-container .v-list-item').nth(item.index).click();
        await page.waitForTimeout(1000);
        for (let i = 0; i < item.rotations; i++) {
            await page.locator('.djs-palette [data-action="change-orientation"]').click();
            await page.waitForTimeout(700);
        }
        await page.evaluate(() => {
            const viewer = window.$bpmnAutoLayoutE2E.$refs.bpmn.bpmnViewer;
            viewer.get('canvas').zoom('fit-viewport', 'auto');
            window.__segmentDragEvents = [];
            viewer.get('eventBus').on(['connectionSegment.move.start', 'connectionSegment.move.end'],
                event => window.__segmentDragEvents.push(event.type));
        });
        const before = await snapshot(page);
        const target = await page.evaluate(({ flow, segment }) => {
            const viewer = window.$bpmnAutoLayoutE2E.$refs.bpmn.bpmnViewer;
            const edge = viewer.get('elementRegistry').get(flow);
            const a = edge.waypoints[segment], b = edge.waypoints[segment + 1];
            const point = new DOMPoint((a.x + b.x) / 2, (a.y + b.y) / 2)
                .matrixTransform(document.querySelector('g.viewport').getScreenCTM());
            const hit = document.elementFromPoint(point.x, point.y)?.closest('.djs-element');
            return { x: point.x, y: point.y, hit: hit?.getAttribute('data-element-id') };
        }, item);
        expect(target.hit).toBe(item.flow);
        await page.mouse.click(target.x, target.y);
        await page.mouse.move(target.x, target.y);
        await page.mouse.down();
        await page.mouse.move(target.x + item.dx, target.y + item.dy, { steps: 18 });
        await page.mouse.up();
        const after = await snapshot(page);
        const changed = after.find(element => element.id === item.flow);
        expect(changed.waypoints).not.toEqual(before.find(element => element.id === item.flow).waypoints);
        expect(await page.evaluate(() => window.__segmentDragEvents))
            .toEqual(['connectionSegment.move.start', 'connectionSegment.move.end']);
        const diagonals = after.filter(element => element.type === 'bpmn:SequenceFlow').flatMap(edge =>
            edge.waypoints.slice(1).flatMap((point, index) => {
                const previous = edge.waypoints[index];
                expect(point.every(Number.isFinite)).toBe(true);
                return Math.abs(point[0] - previous[0]) > 0.1 && Math.abs(point[1] - previous[1]) > 0.1
                    ? [`${edge.id}:${index}`] : [];
            })
        );
        expect(diagonals, 'all sequence flows stay orthogonal').toEqual([]);
        expect(after.filter(element => element.type !== 'label' && element.id !== item.flow))
            .toEqual(before.filter(element => element.type !== 'label' && element.id !== item.flow));
        for (const gap of await getRenderedEndpointGaps(page, item.flow)) expect(gap).toBeLessThanOrEqual(3);
        await page.waitForTimeout(600);
        expect(await snapshot(page), 'drop remains stable').toEqual(after);
        await page.screenshot({ path: testInfo.outputPath('after-drag.png') });
        await page.evaluate(() => window.$bpmnAutoLayoutE2E.$refs.bpmn.bpmnViewer.get('commandStack').undo());
        expect(await snapshot(page), 'undo restores exact geometry').toEqual(before);
        await page.evaluate(() => window.$bpmnAutoLayoutE2E.$refs.bpmn.bpmnViewer.get('commandStack').redo());
        expect(await snapshot(page), 'redo restores exact geometry').toEqual(after);
        expect(errors).toEqual([]);
    });
}
