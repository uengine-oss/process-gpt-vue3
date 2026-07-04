import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './playwright/e2e',
    timeout: 90_000,
    outputDir: './playwright/test-results',
    preserveOutput: 'always',
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    workers: 1,
    reporter: [['list']]
});
