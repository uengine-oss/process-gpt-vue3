import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './playwright/e2e',
    
    // Playwright 관련 결과물을 playwright 폴더 내부에 저장
    outputDir: './playwright/test-results',
    
    // 이전 테스트 결과 보존
    preserveOutput: 'always',
    
    // 병렬 실행 여부 (false면 순차 실행)
    fullyParallel: false,
    
    forbidOnly: !!process.env.CI,
    
    retries: process.env.CI ? 2 : 0,
    
    // workers: 1 이면 완전 순차 실행, undefined면 병렬 실행
    workers: 1,
    
    reporter: [
        ['html', { outputFolder: './playwright/playwright-report' }],
        ['list']  // 터미널에도 결과 출력
    ],
    
    use: {
        baseURL: 'http://localhost:8088',  // 로컬 개발 환경
        
        trace: 'on',  // 모든 테스트의 trace 저장
        
        video: 'on',  // 모든 테스트의 비디오 저장
    },

    projects: [
        {
            name: 'chromium',
            use: { 
                ...devices['Desktop Chrome'],
            },
        },
    ],

    webServer: {
        command: 'npm run dev',
        url: 'http://localhost:8088',
        reuseExistingServer: true,
        timeout: 120 * 1000,
    },
});
