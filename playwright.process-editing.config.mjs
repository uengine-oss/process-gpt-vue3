import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './e2e/process-editing',
    testMatch: '*.spec.mjs',
    workers: 1,
    use: { baseURL: 'http://127.0.0.1:8097', viewport: { width: 1600, height: 1000 } },
    webServer: {
        command: 'npx vite --config e2e/process-editing/vite.config.mjs',
        url: 'http://127.0.0.1:8097/e2e/process-editing/index.html',
        reuseExistingServer: !process.env.CI
    }
});
