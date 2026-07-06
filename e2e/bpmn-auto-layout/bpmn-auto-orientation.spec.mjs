import { test, expect } from '@playwright/test';
import { mkdirSync } from 'fs';
import { join } from 'path';

const SCREENSHOT_DIR = 'e2e/bpmn-auto-layout/e2e-results/bpmn-auto-layout/screenshots';
const E2E_ROUTE = '/bpmn-auto-layout-e2e?viewMode=true';

function shotPath(name) {
  return join(SCREENSHOT_DIR, `process-gpt-bpmn-auto-orientation-${name}.png`);
}

async function openE2EPage(page) {
  await page.goto(E2E_ROUTE);
  await page.waitForSelector('.djs-container, [class*="djs-"]', { timeout: 15000 });
  await page.waitForSelector('.djs-element, .djs-shape', { timeout: 15000 });
}

async function openCaseDialog(page) {
  await page.locator('.v-app-bar [class*="mdi-folder-open"]').first().click();
  await page.locator('.v-overlay-container .v-list-item').first().waitFor({ state: 'visible', timeout: 10000 });
}

async function loadCaseByIndex(page, index) {
  await openCaseDialog(page);
  await page.locator('.v-overlay-container .v-list-item').nth(index).click();
  await page.locator('.v-overlay-container .v-card').waitFor({ state: 'hidden', timeout: 10000 });
  await page.waitForSelector('.djs-element, .djs-shape', { timeout: 15000 });
  await page.waitForTimeout(1000);
}

async function screenshotCanvas(page, name) {
  await page.locator('#canvas-container').screenshot({ path: shotPath(name) });
}

async function getParticipantOrientation(page) {
  return page.evaluate(() => {
    const participant = window.$bpmnAutoLayoutE2E?.$refs?.bpmn?.bpmnViewer
      ?.get('elementRegistry')
      ?.filter((element) => element.type === 'bpmn:Participant')?.[0];

    return {
      isHorizontal: participant?.di?.isHorizontal,
      width: participant?.width,
      height: participant?.height
    };
  });
}

async function getViewportFitMetrics(page) {
  return page.evaluate(() => {
    const viewer = window.$bpmnAutoLayoutE2E?.$refs?.bpmn?.bpmnViewer;
    const component = window.$bpmnAutoLayoutE2E?.$refs?.bpmn;
    const canvas = viewer?.get('canvas');
    const bounds = component?.getDiagramContentBounds?.();
    const viewbox = canvas?.viewbox();
    const zoom = canvas?.zoom();

    if (!bounds || !viewbox) return null;

    return {
      zoom,
      bounds,
      viewbox,
      widthFillRatio: bounds.width / viewbox.width,
      heightFillRatio: bounds.height / viewbox.height,
      contained:
        bounds.x >= viewbox.x - 2 &&
        bounds.y >= viewbox.y - 2 &&
        bounds.x + bounds.width <= viewbox.x + viewbox.width + 2 &&
        bounds.y + bounds.height <= viewbox.y + viewbox.height + 2
    };
  });
}

async function getSavedOrientationFlags(page) {
  return page.evaluate(async () => {
    const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const getShapeOrientation = (xml, elementId) => {
      const shape = xml.match(new RegExp(`<bpmndi:BPMNShape\\b[^>]*bpmnElement="${escapeRegExp(elementId)}"[^>]*>`))?.[0];
      return shape?.match(/\bisHorizontal="([^"]+)"/)?.[1];
    };
    const viewer = window.$bpmnAutoLayoutE2E?.$refs?.bpmn?.bpmnViewer;
    const elementRegistry = viewer.get('elementRegistry');
    const participant = elementRegistry.filter((element) => element.type === 'bpmn:Participant')?.[0];
    const participantBounds = participant && {
      x: participant.x,
      y: participant.y,
      width: participant.width,
      height: participant.height
    };
    const isInsideParticipant = (element) => {
      let current = element?.parent;
      while (current) {
        if (current.id === participant?.id) return true;
        current = current.parent;
      }

      if (!participantBounds || !element) return false;

      const centerX = element.x + element.width / 2;
      const centerY = element.y + element.height / 2;
      return centerX >= participantBounds.x &&
        centerX <= participantBounds.x + participantBounds.width &&
        centerY >= participantBounds.y &&
        centerY <= participantBounds.y + participantBounds.height;
    };
    const registryLanes = elementRegistry
      .filter((element) => element.type === 'bpmn:Lane' && isInsideParticipant(element))
      .map((element) => ({
        id: element.id,
        isHorizontal: element.di?.isHorizontal
      }));
    const { xml } = await viewer.saveXML({ format: true });
    const participantShape = participant && getShapeOrientation(xml, participant.id);
    const laneShapes = registryLanes.map((lane) => {
      return {
        ...lane,
        saved: getShapeOrientation(xml, lane.id)
      };
    });

    return {
      participant: participantShape,
      lanes: laneShapes
    };
  });
}

test.describe('process-gpt bpmn auto orientation on viewport ratio change', () => {
  test.describe.configure({ timeout: 180000 });

  test.beforeAll(() => {
    mkdirSync(SCREENSHOT_DIR, { recursive: true });
  });

  test('auto rotates by viewport ratio and relayouts after rotation', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await openE2EPage(page);
    await loadCaseByIndex(page, 3);
    await page.waitForTimeout(1000);

    await screenshotCanvas(page, '01-landscape-horizontal');
    const landscape = await getParticipantOrientation(page);

    await page.setViewportSize({ width: 768, height: 1366 });
    await page.waitForTimeout(2500);
    await screenshotCanvas(page, '02-portrait-auto-vertical');
    const portrait = await getParticipantOrientation(page);
    const portraitFit = await getViewportFitMetrics(page);
    const portraitXml = await getSavedOrientationFlags(page);

    await page.setViewportSize({ width: 1366, height: 768 });
    await page.waitForTimeout(2500);
    await screenshotCanvas(page, '03-landscape-auto-horizontal');
    const landscapeAgain = await getParticipantOrientation(page);
    const landscapeAgainFit = await getViewportFitMetrics(page);
    const landscapeAgainXml = await getSavedOrientationFlags(page);

    expect(landscape.isHorizontal).toBe(true);
    expect(portrait.isHorizontal).toBe(false);
    expect(portraitFit?.contained, JSON.stringify(portraitFit)).toBe(true);
    expect(Math.max(portraitFit.widthFillRatio, portraitFit.heightFillRatio), JSON.stringify(portraitFit)).toBeGreaterThan(0.75);
    expect(portraitXml.participant).toBe('false');
    expect(portraitXml.lanes.length).toBeGreaterThan(0);
    expect(
      portraitXml.lanes.filter((lane) => lane.isHorizontal !== false || lane.saved !== 'false'),
      JSON.stringify(portraitXml.lanes)
    ).toEqual([]);
    expect(landscapeAgain.isHorizontal).toBe(true);
    expect(landscapeAgainFit?.contained, JSON.stringify(landscapeAgainFit)).toBe(true);
    expect(Math.max(landscapeAgainFit.widthFillRatio, landscapeAgainFit.heightFillRatio), JSON.stringify(landscapeAgainFit)).toBeGreaterThan(0.75);
    expect(landscapeAgainXml.participant).toBe('true');
    expect(landscapeAgainXml.lanes.length).toBeGreaterThan(0);
    expect(
      landscapeAgainXml.lanes.filter((lane) => lane.isHorizontal !== true || lane.saved !== 'true'),
      JSON.stringify(landscapeAgainXml.lanes)
    ).toEqual([]);
  });

  test('view mode normalizes attached contract review bounds before auto rotation', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await openE2EPage(page);
    await loadCaseByIndex(page, 10);

    await screenshotCanvas(page, '04-attached-view-landscape-normalized');
    const landscape = await getParticipantOrientation(page);

    await page.setViewportSize({ width: 768, height: 1366 });
    await page.waitForTimeout(2500);
    await screenshotCanvas(page, '05-attached-view-portrait-normalized');
    const portrait = await getParticipantOrientation(page);
    const portraitFit = await getViewportFitMetrics(page);
    const portraitXml = await getSavedOrientationFlags(page);

    expect(landscape.isHorizontal).toBe(true);
    expect(portrait.isHorizontal).toBe(false);
    expect(portraitFit?.contained, JSON.stringify(portraitFit)).toBe(true);
    expect(Math.max(portraitFit.widthFillRatio, portraitFit.heightFillRatio), JSON.stringify(portraitFit)).toBeGreaterThan(0.75);
    expect(portraitXml.participant).toBe('false');
    expect(portraitXml.lanes.length).toBeGreaterThan(0);
    expect(
      portraitXml.lanes.filter((lane) => lane.isHorizontal !== false || lane.saved !== 'false'),
      JSON.stringify(portraitXml.lanes)
    ).toEqual([]);
  });

  test('auto rotation fits a complex process into the visible viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 760 });
    await openE2EPage(page);
    await loadCaseByIndex(page, 4);

    await screenshotCanvas(page, '06-fit-complex-landscape');
    const landscapeFit = await getViewportFitMetrics(page);

    await page.setViewportSize({ width: 760, height: 1440 });
    await page.waitForTimeout(2500);
    await screenshotCanvas(page, '07-fit-complex-portrait');
    const portrait = await getParticipantOrientation(page);
    const portraitFit = await getViewportFitMetrics(page);

    expect(landscapeFit?.contained, JSON.stringify(landscapeFit)).toBe(true);
    expect(Math.max(landscapeFit.widthFillRatio, landscapeFit.heightFillRatio), JSON.stringify(landscapeFit)).toBeGreaterThan(0.75);
    expect(portrait.isHorizontal).toBe(false);
    expect(portraitFit?.contained, JSON.stringify(portraitFit)).toBe(true);
    expect(Math.max(portraitFit.widthFillRatio, portraitFit.heightFillRatio), JSON.stringify(portraitFit)).toBeGreaterThan(0.75);
  });
});
