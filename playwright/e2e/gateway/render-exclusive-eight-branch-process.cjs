const { chromium } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { createExclusiveEightBranchBpmnXml } = require('./exclusive-eight-branch-uengine-bpmn.cjs');

(async () => {
    const resultsDir = 'D:/uEngineProject/process-gpt-vue3/playwright/test-results';
    const xmlPath = path.join(resultsDir, 'exclusive-eight-branch.uengine.bpmn');
    const out = path.join(resultsDir, 'exclusive-eight-branch-process.png');
    const viewerPath = 'D:/uEngineProject/process-gpt-vue3/node_modules/bpmn-js/dist/bpmn-viewer.production.min.js';
    const cssPath = 'D:/uEngineProject/process-gpt-vue3/node_modules/bpmn-js/dist/assets/bpmn-js.css';
    const xml = createExclusiveEightBranchBpmnXml();

    fs.mkdirSync(resultsDir, { recursive: true });
    fs.writeFileSync(xmlPath, xml, 'utf8');

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1180, height: 860 }, deviceScaleFactor: 1 });
    await page.setContent(`
        <html>
            <head>
                <style>
                    ${fs.readFileSync(cssPath, 'utf8')}
                    html, body, #canvas { width: 100%; height: 100%; margin: 0; background: #fff; }
                    .bjs-powered-by { display: none; }
                </style>
            </head>
            <body><div id="canvas"></div></body>
        </html>
    `);
    await page.addScriptTag({ path: viewerPath });
    await page.evaluate(async (bpmnXml) => {
        const viewer = new window.BpmnJS({ container: '#canvas' });
        await viewer.importXML(bpmnXml);
        viewer.get('canvas').zoom('fit-viewport', 'auto');
    }, xml);
    await page.screenshot({ path: out, fullPage: true });
    await browser.close();
    console.log(JSON.stringify({ xmlPath, screenshotPath: out }));
})().catch((error) => {
    console.error(error);
    process.exit(1);
});
