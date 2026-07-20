import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './playwright/e2e/gateway',
    testMatch: ['gateway-regression-branches.spec.ts'],
    timeout: 180_000,
    outputDir: './playwright/test-results/gateway-regression',
    preserveOutput: 'always',
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: 0,
    workers: 1,
    reporter: [['list']],
    use: {
        trace: 'off',
        video: 'off',
        screenshot: 'only-on-failure'
    },
    projects: [
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome']
            }
        }
    ]
});
