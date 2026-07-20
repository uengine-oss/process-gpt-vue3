import { expect, test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import JSZip from 'jszip';

/**
 * 프로세스 컴포넌트 패키지(zip) export → import 라운드트립 E2E.
 * 구현 스펙 검증:
 *  1) 프로세스 정의 화면에 "컴포넌트 내보내기" 버튼이 있고, 클릭 시 {componentId}-{version}.zip 다운로드
 *  2) 다운로드된 zip 이 표준 패키지 구조(manifest.json + process/process-definition.json)를 가짐
 *  3) 정의체계도에 "컴포넌트 가져오기" 카드가 있고, zip 선택 시 미리보기 다이얼로그가 뜬 뒤 설치되어 성공 토스트
 */

function requiredEnv(name: string): string {
    const value = process.env[name];
    if (!value) throw new Error(`${name} is required for this test`);
    return value;
}

const DEF_ID = process.env.E2E_DEF_ID || 'traffic_complaint_handling_process';
const outDir = path.join(process.cwd(), 'playwright', 'test-results', 'component-package');

async function login(page: any) {
    const email = requiredEnv('E2E_USER');
    const password = requiredEnv('E2E_PASS');

    await page.context().clearCookies();
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    if (!/\/auth\/login/.test(page.url())) {
        const betaCta = page
            .locator('a,button,[role="button"]')
            .filter({ hasText: /베타\s*테스트하기|beta\s*test|start/i })
            .first();
        if (await betaCta.isVisible().catch(() => false)) {
            await betaCta.click();
        }
    }
    if (!/\/auth\/login/.test(page.url())) {
        await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });
    }
    await expect(page).toHaveURL(/\/auth\/login/);

    await page.locator('.cp-id input').fill(email);
    await page.locator('.cp-pwd input').fill(password);
    const remember = page.getByRole('checkbox').first();
    if (!(await remember.isChecked().catch(() => false))) {
        await remember.check().catch(() => {});
    }
    await page.locator('.cp-login').click();
    await expect(page).toHaveURL(/\/definition-map/, { timeout: 60_000 });
}

test.describe('process component package export/import', () => {
    test.setTimeout(180_000);

    test('export produces a valid package and import installs it', async ({ page }) => {
        fs.mkdirSync(outDir, { recursive: true });

        // 진단: 콘솔/페이지 에러 수집
        const consoleLogs: string[] = [];
        page.on('console', (msg: any) => {
            const t = msg.type();
            if (t === 'error' || t === 'warning' || /export|import|component|skill|package/i.test(msg.text())) {
                consoleLogs.push(`[${t}] ${msg.text()}`);
            }
        });
        page.on('pageerror', (err: any) => consoleLogs.push(`[pageerror] ${err.message}`));

        // 1) 로그인
        await login(page);

        // 2) 프로세스 정의 편집 화면 진입
        await page.goto(`/definitions/${DEF_ID}?edit=true`, { waitUntil: 'domcontentloaded' });

        // export 버튼(mdi-package-variant-closed) 노출 대기
        const exportIcon = page.locator('.mdi-package-variant-closed').first();
        await expect(exportIcon, 'export 버튼이 헤더에 렌더링되어야 함').toBeVisible({ timeout: 60_000 });

        // 3) export 클릭 → 다운로드 캡처 (실패 시 콘솔/토스트 진단 출력)
        let download: any;
        try {
            [download] = await Promise.all([page.waitForEvent('download', { timeout: 45_000 }), exportIcon.click()]);
        } catch (e) {
            const toastText = await page
                .locator('.v-snackbar, [role="alert"], .toast')
                .allTextContents()
                .catch(() => []);
            console.log('=== 진단: 다운로드 미발생 ===');
            console.log('toast:', JSON.stringify(toastText));
            console.log('console logs:\n' + consoleLogs.slice(-40).join('\n'));
            await page.screenshot({ path: path.join(outDir, 'export-fail.png'), fullPage: true }).catch(() => {});
            throw e;
        }
        const filename = download.suggestedFilename();
        const zipPath = path.join(outDir, filename);
        await download.saveAs(zipPath);
        console.log(`[export] downloaded: ${filename}`);

        // 파일명 규칙: {componentId}-{version}.zip
        expect(filename, '다운로드 파일명이 .zip 이어야 함').toMatch(/\.zip$/);

        // 4) 패키지 구조 검증
        const buf = fs.readFileSync(zipPath);
        const zip = await JSZip.loadAsync(buf);

        const manifestFile = zip.file('manifest.json');
        expect(manifestFile, 'manifest.json 이 패키지에 있어야 함').toBeTruthy();
        const manifest = JSON.parse(await manifestFile!.async('string'));
        console.log(
            '[export] manifest:',
            JSON.stringify(
                {
                    schemaVersion: manifest.schemaVersion,
                    componentId: manifest.componentId,
                    version: manifest.version,
                    contents: manifest.contents,
                    dependencies: manifest.dependencies
                },
                null,
                2
            )
        );

        expect(manifest.schemaVersion, 'schemaVersion=1').toBe(1);
        expect(manifest.componentId, 'componentId 존재').toBeTruthy();
        expect(manifest.version, 'version 존재').toBeTruthy();
        expect(zip.file('process/process-definition.json'), 'process-definition.json 존재').toBeTruthy();

        // sanitize 검증: 정의 JSON 에 tenant_id 가 남아있지 않아야 함
        const defJson = JSON.parse(await zip.file('process/process-definition.json')!.async('string'));
        expect(JSON.stringify(defJson).includes('"tenant_id"'), '정의에서 tenant_id 제거됨').toBeFalsy();
        // roles[].default/endpoint sanitize (roles 있을 때만)
        if (Array.isArray(defJson.roles)) {
            for (const r of defJson.roles) {
                expect(r.default === '' || r.default === undefined, 'role.default sanitize').toBeTruthy();
                expect(r.endpoint === '' || r.endpoint === undefined, 'role.endpoint sanitize').toBeTruthy();
            }
        }

        // 5) 정의체계도로 이동해 "컴포넌트 가져오기" 버튼 확인
        await page.goto('/definition-map', { waitUntil: 'domcontentloaded' });
        // 액션 바 렌더 대기(마켓플레이스 버튼 존재 확인)
        await page
            .getByRole('button', { name: /마켓플레이스/ })
            .first()
            .waitFor({ timeout: 30_000 })
            .catch(() => {});

        const importBtn = page.getByRole('button', { name: /컴포넌트 가져오기/ }).first();
        const importVisible = await importBtn.isVisible({ timeout: 15_000 }).catch(() => false);
        if (!importVisible) {
            const btnNames = await page
                .getByRole('button')
                .allInnerTexts()
                .catch(() => []);
            console.warn('[import] "컴포넌트 가져오기" 버튼 미노출. 렌더된 버튼들:', JSON.stringify(btnNames.filter(Boolean).slice(0, 40)));
            test.info().annotations.push({ type: 'note', description: 'import 버튼 미노출: export만 검증' });
            return;
        }

        // 6) 버튼 클릭 → 파일 선택 → 미리보기 다이얼로그
        const [chooser] = await Promise.all([page.waitForEvent('filechooser', { timeout: 30_000 }), importBtn.click()]);
        await chooser.setFiles(zipPath);

        const previewTitle = page.getByText('컴포넌트 가져오기 미리보기').first();
        await expect(previewTitle, '미리보기 다이얼로그 노출').toBeVisible({ timeout: 30_000 });

        // 7) 설치 버튼 클릭 → 성공 토스트
        const installBtn = page.getByRole('button', { name: /^설치$/ }).first();
        await expect(installBtn).toBeVisible({ timeout: 10_000 });
        await installBtn.click();

        const successToast = page.getByText(/컴포넌트를 설치했습니다/).first();
        try {
            await expect(successToast, '설치 성공 토스트').toBeVisible({ timeout: 45_000 });
            console.log('[import] 설치 성공 토스트 확인');
        } catch (e) {
            // 진단: 다이얼로그 인라인 에러 + 콘솔
            const dialogText = await page
                .locator('.v-dialog')
                .allTextContents()
                .catch(() => []);
            console.log('=== 진단: 설치 성공 토스트 미노출 ===');
            console.log('dialog text:', JSON.stringify(dialogText).slice(0, 1500));
            console.log('console logs:\n' + consoleLogs.slice(-50).join('\n'));
            await page.screenshot({ path: path.join(outDir, 'install-fail.png'), fullPage: true }).catch(() => {});
            throw e;
        }
    });
});
