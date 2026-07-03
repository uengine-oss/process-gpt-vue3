const { chromium } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const {
    createCustomGatewayBpmnXml,
    createGatewayRegressionBpmnXml,
    customScenarios,
    scenarios
} = require('./gateway-regression-fixtures.cjs');

(async () => {
    const resultsDir = 'D:/uEngineProject/process-gpt-vue3/playwright/test-results/gateway-regression-processes';
    const viewerPath = 'D:/uEngineProject/process-gpt-vue3/node_modules/bpmn-js/dist/bpmn-viewer.production.min.js';
    const cssPath = 'D:/uEngineProject/process-gpt-vue3/node_modules/bpmn-js/dist/assets/bpmn-js.css';
    const viewerScript = fs.readFileSync(viewerPath, 'utf8');
    const css = fs.readFileSync(cssPath, 'utf8');
    const outputs = [];

    fs.mkdirSync(resultsDir, { recursive: true });

    const browser = await chromium.launch({ headless: true });
    const allScenarios = [
        ...scenarios.map((scenario) => ({ scenario, createXml: createGatewayRegressionBpmnXml })),
        ...customScenarios.map((scenario) => ({ scenario, createXml: createCustomGatewayBpmnXml }))
    ];

    for (const { scenario, createXml } of allScenarios) {
        const xml = createXml(scenario);
        const xmlPath = path.join(resultsDir, `${scenario.id}.uengine.bpmn`);
        const screenshotPath = path.join(resultsDir, `${scenario.id}.png`);
        fs.writeFileSync(xmlPath, xml, 'utf8');

        const height = scenario.branchCount === 8 ? 860 : 720;
        const width = scenario.id.includes('nested') ? 1520 : 1180;
        const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
        await page.setContent(`
            <html>
                <head>
                    <style>
                        ${css}
                        html, body, #canvas { width: 100%; height: 100%; margin: 0; background: #fff; }
                        .bjs-powered-by { display: none; }
                    </style>
                </head>
                <body><div id="canvas"></div></body>
            </html>
        `);
        await page.addScriptTag({ content: viewerScript });
        await page.evaluate(async (bpmnXml) => {
            const viewer = new window.BpmnJS({ container: '#canvas' });
            await viewer.importXML(bpmnXml);
            viewer.get('canvas').zoom('fit-viewport', 'auto');
        }, xml);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        await page.close();
        outputs.push({ id: scenario.id, xmlPath, screenshotPath });
    }
    await browser.close();
    console.log(JSON.stringify(outputs, null, 2));
})().catch((error) => {
    console.error(error);
    process.exit(1);
});
