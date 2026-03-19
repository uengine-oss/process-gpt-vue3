import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.BASE_URL || 'http://localhost:8088';
const useManagedWebServer = !process.env.BASE_URL;

export default defineConfig({
    testDir: './playwright/e2e',
    timeout: 90_000,

    // Playwright 관련 결과물을 playwright 폴더 내부에 저장
    outputDir: './playwright/test-results',

    // 이전 테스트 결과 보존
    preserveOutput: 'always',

    // 병렬 실행 여부 (false면 순차 실행)
    fullyParallel: false,

    forbidOnly: !!process.env.CI,

    retries: process.env.CI ? 1 : 0,

    // workers: 1 이면 완전 순차 실행, undefined면 병렬 실행
    workers: 1,

    reporter: [
        ['html', { outputFolder: './playwright/playwright-report' }],
        ['list'] // 터미널에도 결과 출력
    ],

    use: {
        baseURL, // CI/로컬에서 BASE_URL 주입 가능

        trace: 'retain-on-failure',

        video: 'retain-on-failure',
        screenshot: 'only-on-failure'
    },

    projects: [
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome']
            }
        }
    ],

    ...(useManagedWebServer
        ? {
              webServer: {
                  command: 'npm run dev -- --port 8088',
                  url: 'http://localhost:8088',
                  reuseExistingServer: true,
                  timeout: 120 * 1000
              }
          }
        : {})
});
