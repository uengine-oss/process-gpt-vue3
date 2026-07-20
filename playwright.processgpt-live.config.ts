import { defineConfig, devices } from '@playwright/test';

const artifactDir = process.env.E2E_ARTIFACT_DIR || 'playwright/processgpt-live-artifacts';

export default defineConfig({
    testDir: './playwright/e2e',
    outputDir: `${artifactDir}/test-results`,
    preserveOutput: 'always',
    timeout: 30 * 60 * 1000,
    expect: { timeout: 30_000 },
    fullyParallel: false,
    workers: 1,
    retries: 0,
    reporter: [['list'], ['html', { outputFolder: `${artifactDir}/html-report`, open: 'never' }]],
    use: {
        baseURL: process.env.BASE_URL || 'http://localhost:8088',
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        video: { mode: 'on', size: { width: 1920, height: 1080 } },
        screenshot: 'only-on-failure',
        // DOM/network/action trace는 유지하되 매 프레임 JPEG 캡처는 끈다. 장시간 AI 검증에서
        // trace screenshot이 수 GB로 커지고 HTML report에 다시 복제되는 것을 방지한다.
        trace: { mode: 'retain-on-failure', screenshots: false, snapshots: true, sources: true },
        actionTimeout: 20_000,
        navigationTimeout: 60_000
    }
});
