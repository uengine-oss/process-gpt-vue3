import { defineConfig, devices } from '@playwright/test';

const port = process.env.INSTANCE_PROGRESS_PORT || '8088';
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
    testDir: './e2e/instance-progress',
    testMatch: ['instance-progress-traversed-path.spec.mjs'],
    fullyParallel: false,
    workers: 1,
    reporter: [
        ['list'],
        ['html', { outputFolder: 'e2e/instance-progress/e2e-results/html-report', open: 'never' }],
        ['json', { outputFile: 'e2e/instance-progress/e2e-results/results.json' }]
    ],
    outputDir: 'e2e/instance-progress/e2e-results/artifacts',
    use: {
        baseURL,
        trace: 'on-first-retry',
        screenshot: 'only-on-failure'
    },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    webServer: {
        command: `npm run dev -- --host 0.0.0.0 --port ${port}`,
        url: `${baseURL}/instance-progress-e2e`,
        reuseExistingServer: true,
        timeout: 120 * 1000
    }
});
