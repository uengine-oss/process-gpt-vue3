import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/bpmn-auto-layout',
  testMatch: 'bpmn-auto-layout.spec.mjs',
  fullyParallel: false,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'e2e/bpmn-auto-layout/e2e-results/bpmn-auto-layout/html-report', open: 'never' }],
    ['json', { outputFile: 'e2e/bpmn-auto-layout/e2e-results/bpmn-auto-layout/results.json' }],
  ],
  outputDir: 'e2e/bpmn-auto-layout/e2e-results/bpmn-auto-layout/artifacts',
  use: {
    baseURL: 'http://127.0.0.1:8088',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run dev -- --host 0.0.0.0 --port 8088',
    url: 'http://127.0.0.1:8088/bpmn-auto-layout-e2e',
    reuseExistingServer: true,
    timeout: 120 * 1000,
  },
});
