import { expect, test } from '@playwright/test';
import { mkdirSync } from 'fs';
import { join } from 'path';

const SCREENSHOT_DIR = 'e2e/instance-progress/e2e-results/screenshots';
const E2E_ROUTE = '/instance-progress-e2e';

const ALL_FLOWS = ['Flow_1', 'Flow_2', 'Flow_3', 'Flow_4', 'Flow_5', 'Flow_6', 'Flow_7', 'Flow_8'];
const ALL_PASS_THROUGH_NODES = ['StartEvent_1', 'Gateway_1', 'Gateway_2', 'EndEvent_1'];

const CASES = [
    {
        scenario: 'started',
        title: '첫 액티비티만 실행중이면 시작 이벤트에서 들어오는 선만 흘러간 경로로 표시된다',
        traversedFlows: ['Flow_1'],
        traversedNodes: ['StartEvent_1']
    },
    {
        scenario: 'branch-b-running',
        title: 'A 완료 · B 실행중이면 게이트웨이를 관통해 선택된 분기까지만 표시된다',
        traversedFlows: ['Flow_1', 'Flow_2', 'Flow_3'],
        traversedNodes: ['StartEvent_1', 'Gateway_1']
    },
    {
        scenario: 'through-gateways',
        title: '게이트웨이 두 개를 관통한 구간이 모두 표시되고 미선택 분기는 제외된다',
        traversedFlows: ['Flow_1', 'Flow_2', 'Flow_3', 'Flow_5', 'Flow_7'],
        traversedNodes: ['StartEvent_1', 'Gateway_1', 'Gateway_2']
    },
    {
        scenario: 'finished',
        title: '종료까지 완료되면 종료 이벤트로 가는 선까지 표시된다',
        traversedFlows: ['Flow_1', 'Flow_2', 'Flow_3', 'Flow_5', 'Flow_7', 'Flow_8'],
        traversedNodes: ['StartEvent_1', 'Gateway_1', 'Gateway_2', 'EndEvent_1']
    }
];

function elementLocator(page, id) {
    return page.locator(`.djs-container g.djs-element[data-element-id="${id}"]`).first();
}

async function openScenario(page, scenario, options = {}) {
    const query = options.journal === false ? `?scenario=${scenario}&journal=off` : `?scenario=${scenario}`;
    await page.goto(`${E2E_ROUTE}${query}`, { waitUntil: 'domcontentloaded' });
    // 다이어그램 import 및 상태 반영이 끝날 때까지 대기
    await expect(elementLocator(page, 'Task_A')).toBeVisible({ timeout: 60_000 });
    await expect(elementLocator(page, options.anchor || 'EndEvent_1')).toBeVisible({ timeout: 60_000 });
    await page.waitForTimeout(500);
}

async function traversedClassOf(page, id) {
    const handle = elementLocator(page, id);
    const className = await handle.getAttribute('class');
    return (className || '').split(/\s+/).includes('traversed');
}

test.describe('프로세스 모니터링 - 흘러간 경로 강조', () => {
    test.beforeAll(() => {
        mkdirSync(SCREENSHOT_DIR, { recursive: true });
    });

    for (const testCase of CASES) {
        test(`${testCase.scenario}: ${testCase.title}`, async ({ page }) => {
            await openScenario(page, testCase.scenario);

            for (const flowId of ALL_FLOWS) {
                const expected = testCase.traversedFlows.includes(flowId);
                expect(await traversedClassOf(page, flowId), `${flowId} traversed=${expected} 이어야 함`).toBe(expected);
            }

            for (const nodeId of ALL_PASS_THROUGH_NODES) {
                const expected = testCase.traversedNodes.includes(nodeId);
                expect(await traversedClassOf(page, nodeId), `${nodeId} traversed=${expected} 이어야 함`).toBe(expected);
            }

            await page.screenshot({ path: join(SCREENSHOT_DIR, `instance-progress-${testCase.scenario}.png`), fullPage: false });
        });
    }

    test('흘러간 연결선은 두꺼운 실선으로 그려진다', async ({ page }) => {
        await openScenario(page, 'through-gateways');

        const traversedPath = page.locator('g.djs-element.traversed.djs-connection[data-element-id="Flow_3"] .djs-visual > path').first();
        await expect(traversedPath).toBeAttached();

        const traversedStyle = await traversedPath.evaluate((el) => {
            const computed = window.getComputedStyle(el);
            return { strokeWidth: computed.strokeWidth, strokeDasharray: computed.strokeDasharray };
        });

        expect(parseFloat(traversedStyle.strokeWidth)).toBeGreaterThanOrEqual(4);
        expect(traversedStyle.strokeDasharray === 'none' || traversedStyle.strokeDasharray === '').toBeTruthy();

        // 지나가지 않은 분기는 기본 굵기를 유지해야 한다
        const plainPath = page.locator('g.djs-element[data-element-id="Flow_4"] .djs-visual > path').first();
        const plainStrokeWidth = await plainPath.evaluate((el) => window.getComputedStyle(el).strokeWidth);
        expect(parseFloat(plainStrokeWidth)).toBeLessThan(4);
    });

    test('판단 이력이 있으면 추론이 고른 갈래를 교정한다', async ({ page }) => {
        // 이력 없음: 상태만 보고 추론 → B 로 가는 Flow_3
        await openScenario(page, 'journal-corrects-branch', { journal: false });
        expect(await traversedClassOf(page, 'Flow_3')).toBe(true);
        expect(await traversedClassOf(page, 'Flow_4')).toBe(false);

        // 이력 있음: 엔진이 실제로 고른 Flow_4 가 사실
        await openScenario(page, 'journal-corrects-branch');
        expect(await traversedClassOf(page, 'Flow_4')).toBe(true);
        expect(await traversedClassOf(page, 'Flow_3')).toBe(false);
        // 이력이 다루지 않는 구간(시작 이벤트 진입)은 여전히 추론이 메운다
        expect(await traversedClassOf(page, 'Flow_1')).toBe(true);
    });

    test('선택되지 않은 갈래의 하위 구간까지 함께 사라진다', async ({ page }) => {
        const anchor = { anchor: 'Task_D' };

        // 추론만으로는 통과 노드로만 이뤄진 두 갈래를 구분하지 못해 양쪽을 모두 표시한다(알려진 과잉 표시)
        await openScenario(page, 'ambiguous-rejoin', { ...anchor, journal: false });
        expect(await traversedClassOf(page, 'Flow_a')).toBe(true);
        expect(await traversedClassOf(page, 'Flow_b')).toBe(true);
        expect(await traversedClassOf(page, 'Flow_d')).toBe(true);

        // 이력이 분기 지점에서 갈래를 끊으므로, 이력에 명시되지 않은 하위 구간(Flow_d)까지 함께 사라진다
        await openScenario(page, 'ambiguous-rejoin', anchor);
        expect(await traversedClassOf(page, 'Flow_a')).toBe(true);
        expect(await traversedClassOf(page, 'Flow_c')).toBe(true);
        expect(await traversedClassOf(page, 'Flow_b')).toBe(false);
        expect(await traversedClassOf(page, 'Flow_d')).toBe(false);
        expect(await traversedClassOf(page, 'Gateway_4')).toBe(false);
    });

    test('추론이 판정할 수 없는 분기는 이력이 있어야 확정된다', async ({ page }) => {
        const anchor = { anchor: 'End_approved' };

        // 양쪽 갈래가 모두 종료 이벤트 → 추론은 어느 쪽도 표시하지 못한다
        await openScenario(page, 'terminal-branches', { ...anchor, journal: false });
        expect(await traversedClassOf(page, 'Flow_2')).toBe(true);
        expect(await traversedClassOf(page, 'Flow_approve')).toBe(false);
        expect(await traversedClassOf(page, 'Flow_reject')).toBe(false);

        // 이력이 있으면 승인 갈래가 확정된다
        await openScenario(page, 'terminal-branches', anchor);
        expect(await traversedClassOf(page, 'Flow_approve')).toBe(true);
        expect(await traversedClassOf(page, 'Flow_reject')).toBe(false);
        expect(await traversedClassOf(page, 'End_approved')).toBe(true);
        expect(await traversedClassOf(page, 'End_rejected')).toBe(false);
    });

    test('이력이 없는 시나리오는 추론 결과가 그대로 유지된다', async ({ page }) => {
        // 회귀: 판단 이력 기능이 들어와도 이력 없는 인스턴스의 표시는 달라지지 않아야 한다
        for (const scenario of ['started', 'branch-b-running', 'through-gateways', 'finished']) {
            await openScenario(page, scenario, { journal: false });
            const withoutJournal = [];
            for (const flowId of ALL_FLOWS) withoutJournal.push(await traversedClassOf(page, flowId));

            await openScenario(page, scenario);
            const withJournal = [];
            for (const flowId of ALL_FLOWS) withJournal.push(await traversedClassOf(page, flowId));

            expect(withJournal, `${scenario} 는 이력이 없으므로 동일해야 함`).toEqual(withoutJournal);
        }
    });

    test('시나리오를 바꾸면 이전 강조가 남지 않는다', async ({ page }) => {
        await openScenario(page, 'through-gateways');
        expect(await traversedClassOf(page, 'Flow_7')).toBe(true);

        await page.locator('.e2e-scenario-started').click();
        await expect(elementLocator(page, 'Task_A')).toBeVisible({ timeout: 60_000 });
        await page.waitForTimeout(500);

        expect(await traversedClassOf(page, 'Flow_1')).toBe(true);
        expect(await traversedClassOf(page, 'Flow_7')).toBe(false);
        expect(await traversedClassOf(page, 'Gateway_1')).toBe(false);
    });
});
