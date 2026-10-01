import { defineConfig, devices } from '@playwright/test';

const port = process.env.BPMN_AUTO_LAYOUT_PORT || '8088';
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
    testDir: './e2e/bpmn-auto-layout',
    testMatch: ['bpmn-auto-layout.spec.mjs', 'bpmn-auto-orientation.spec.mjs', 'bpmn-layout-compare.spec.mjs'],
    fullyParallel: false,
    workers: 1,
    reporter: [
        ['list'],
        ['html', { outputFolder: 'e2e/bpmn-auto-layout/e2e-results/bpmn-auto-layout/html-report', open: 'never' }],
        ['json', { outputFile: 'e2e/bpmn-auto-layout/e2e-results/bpmn-auto-layout/results.json' }]
    ],
    outputDir: 'e2e/bpmn-auto-layout/e2e-results/bpmn-auto-layout/artifacts',
    use: {
        baseURL,
        trace: 'on-first-retry',
        // PLAYWRIGHT_CHANNEL=chrome 으로 설치된 Chrome 을 사용 (playwright 번들 브라우저 미설치 환경)
        ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}),
        screenshot: 'only-on-failure'
    },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    webServer: {
        command: `npm run dev -- --host 0.0.0.0 --port ${port}`,
        url: `${baseURL}/bpmn-auto-layout-e2e`,
        reuseExistingServer: true,
        timeout: 120 * 1000
    }
});
