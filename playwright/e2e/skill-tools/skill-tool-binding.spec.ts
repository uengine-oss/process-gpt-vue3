import { expect, test, type Page } from '@playwright/test';

/**
 * 스킬 전용 도구 지정·스킬 연결 화면 — 2026-10-15 관리자·비관리자로 처음부터 끝까지 써 보며 막힌 곳을 고친 동작.
 * 저장하지 않는다(데이터를 바꾸지 않는다). 로컬 업무 화면(BASE_URL)과 딥 에이전트가 떠 있어야 한다.
 *
 * E2E_ADMIN / E2E_ADMIN_PASS : 테넌트 관리자
 * E2E_USER / E2E_USER_PASS   : 관리자가 아닌 사용자
 * E2E_SKILL                  : 테넌트가 올린 스킬(기본 room-booking-check)
 * E2E_MCP_SERVER             : 도구가 여러 개인 테넌트 MCP 서버(기본 supabase)
 * E2E_SYSTEM_SKILL           : 서비스 기본 스킬(기본 bsc-strategy-interview)
 */
const SKILL = process.env.E2E_SKILL || 'room-booking-check';
const SERVER = process.env.E2E_MCP_SERVER || 'supabase';
const SYSTEM_SKILL = process.env.E2E_SYSTEM_SKILL || 'bsc-strategy-interview';

function env(name: string): string {
    const v = process.env[name];
    if (!v) throw new Error(`${name} is required`);
    return v;
}

async function login(page: Page, email: string, password: string) {
    await page.context().clearCookies();
    await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });
    await page.locator('.cp-id input').fill(email);
    await page.locator('.cp-pwd input').fill(password);
    await page.locator('.cp-login').click();
    await page.waitForURL((u) => !/auth\/login/.test(u.toString()), { timeout: 60_000 });
}

// 추가·빼기는 창 없이 바로 된다(예전에는 도구마다 확인 창이 떴다).
async function expectNoDialog(page: Page) {
    await expect(page.locator('.v-overlay--active .v-card')).toHaveCount(0);
}

async function openPicker(page: Page, skill: string) {
    await page.goto(`/skills/${skill}`, { waitUntil: 'domcontentloaded' });
    await page.locator('[data-test=open-tool-drawer]').click();
    const panel = page.locator('[data-test=skill-tool-panel]');
    await expect(panel).toBeVisible();
    await expect(panel.locator('[data-test=add-tool]')).toBeEnabled({ timeout: 30_000 });
    await panel.locator('[data-test=add-tool]').click();
    return page.locator('[data-test=tool-picker]');
}

test.describe('관리자', () => {
    test.beforeEach(async ({ page }) => login(page, env('E2E_ADMIN'), env('E2E_ADMIN_PASS')));

    test('서버 이름으로 찾으면 그 서버 도구가 모두 나오고, 창 없이 모두 지정·연결하며, 도구줄의 저장이 가려지지 않는다', async ({ page }) => {
        const picker = await openPicker(page, SKILL);
        await page.locator('[data-test=tool-search] input').fill(SERVER);
        const group = picker.locator(`[data-group="mcp:${SERVER}"]`);
        await expect(group).toBeVisible();
        const rows = group.locator('[data-pick]');
        const total = await rows.count();
        test.skip(total < 2, `${SERVER} 서버 도구가 2개 미만`);
        // 설명에 서버 이름이 없는 도구도 나와야 한다(예전에는 이름·설명만 찾아 일부만 나왔다).
        const addAll = group.locator(`[data-add-group="mcp:${SERVER}"]`);
        await expect(addAll).toContainText(String(total));
        await addAll.click();
        await expectNoDialog(page);
        const panel = page.locator('[data-test=skill-tool-panel]');
        await expect(panel.locator('[data-test=unsaved-note]')).toBeVisible();
        await panel.locator('[data-test=add-tool]').click();
        await expect(panel.locator('[data-connected]')).toHaveCount(total);
        // 도구 칸은 편집기 옆에 있어 도구줄의 저장 아이콘을 가리지 않는다.
        await page.getByRole('button', { name: '저장', exact: true }).click();
        // 저장 창이 열리고 도구 변경 안내가 함께 보인다(저장은 하지 않는다).
        await expect(page.locator('.v-overlay--active').getByText('저장하면 반영됩니다').first()).toBeVisible();
    });

    test('관리자 표: 서버 이름으로 찾고, 고른 도구를 한 번에 스킬에 연결하며, 서비스 기본 스킬은 연결 대상이 아니다', async ({ page }) => {
        await page.goto('/skills', { waitUntil: 'domcontentloaded' });
        await page.locator('[data-test=open-skill-only-tools]').click();
        const dialog = page.locator('[data-test=skill-only-tools-dialog]');
        await expect(dialog.locator('[data-test=tool-table]')).toBeVisible({ timeout: 30_000 });
        await dialog.locator('[data-filter=all]').click();
        // 연결도 지정도 없는 도구는 "지정 안 됨" 보기(연결됐지만 지정 안 된 도구)와 다른 말로 보인다.
        await expect(dialog.locator('tbody tr[data-kind=free]').first()).toContainText('모든 대화');
        await dialog.getByPlaceholder('도구 찾기').fill(SERVER);
        const rows = dialog.locator('tbody tr[data-row]');
        const total = await rows.count();
        test.skip(total < 2, `${SERVER} 서버 도구가 2개 미만`);
        await dialog.getByRole('checkbox', { name: '모두 선택', exact: true }).check();
        await dialog.locator('[data-test=connect-selected]').click();
        const menu = page.locator('.v-overlay--active .v-list').last();
        await expect(menu.locator(`[data-connect-skill="${SKILL}"]`)).toBeVisible();
        await expect(menu.locator(`[data-connect-skill="${SYSTEM_SKILL}"]`)).toHaveCount(0);
        await menu.locator(`[data-connect-skill="${SKILL}"]`).click();
        await expect(page).toHaveURL(new RegExp(`/skills/${SKILL}\\?addTool=`));
        // 고른 도구가 (필요하면 확인 한 번으로) 함께 들어온다.
        await expect(page.locator('[data-test=skill-tool-panel]')).toBeVisible({ timeout: 30_000 });
        await expectNoDialog(page);
        await expect(page.locator('[data-test=skill-tool-panel] [data-connected]')).toHaveCount(total);
    });

    test('관리자 표는 딥 에이전트 서비스 도구와 MCP 서버별 도구를 묶음으로 나눠 보이고, 묶음 단위로 고르고 접는다', async ({ page }) => {
        await page.goto('/skills', { waitUntil: 'domcontentloaded' });
        await page.locator('[data-test=open-skill-only-tools]').click();
        const dialog = page.locator('[data-test=skill-only-tools-dialog]');
        await expect(dialog.locator('[data-test=tool-table]')).toBeVisible({ timeout: 30_000 });
        await dialog.locator('[data-filter=all]').click();
        const heads = dialog.locator('tr[data-group-head]');
        // 서비스 도구가 맨 앞, 그다음 MCP 서버별 묶음
        await expect(heads.first()).toHaveAttribute('data-group-head', 'service');
        await expect(heads.first().locator('[data-source-icon=service]')).toBeVisible();
        const server = dialog.locator(`tr[data-group-head="mcp:${SERVER}"]`);
        await expect(server.locator('[data-source-icon=mcp]')).toBeVisible();
        // 묶음 안의 행은 그 출처의 도구뿐이다
        const serverRows = dialog.locator(`tbody[data-group="mcp:${SERVER}"] tr[data-row]`);
        const n = await serverRows.count();
        expect(n).toBeGreaterThan(1);
        await expect(dialog.locator(`tbody[data-group="mcp:${SERVER}"] tr[data-row]:not([data-source=mcp])`)).toHaveCount(0);
        await expect(dialog.locator('tbody[data-group="service"] tr[data-row]:not([data-source=service])')).toHaveCount(0);
        // 묶음 체크박스로 그 서버 도구만 고른다
        await server.getByRole('checkbox').check();
        await expect(dialog.locator('[data-test=select-bar]')).toContainText(`${n}개 선택`);
        // 접으면 그 묶음의 행이 사라지고 다른 묶음은 남는다
        await dialog.locator(`[data-group-toggle="mcp:${SERVER}"]`).click();
        await expect(serverRows).toHaveCount(0);
        await expect(dialog.locator('tbody[data-group="service"] tr[data-row]').first()).toBeVisible();
    });

    test('도구 칸은 편집기와 높이가 같고, 연결된 도구를 출처별로 묶으며, 빼기는 창 없이 하고 되돌릴 수 있다', async ({ page }) => {
        await page.goto(`/skills/${SKILL}`, { waitUntil: 'domcontentloaded' });
        await page.locator('[data-test=open-tool-drawer]').click();
        const panel = page.locator('[data-test=skill-tool-panel]');
        await expect(panel.locator('[data-test=add-tool]')).toBeEnabled({ timeout: 30_000 });
        const editor = await page.locator('.monaco-editor').boundingBox();
        const aside = await page.locator('[data-test=tool-drawer]').boundingBox();
        expect(Math.round(aside!.y)).toBe(Math.round(editor!.y));
        expect(Math.round(aside!.height)).toBe(Math.round(editor!.height));
        // 어디에 적히는지 보이고, 누르면 편집기의 그 줄로 간다
        await expect(panel.locator('[data-test=where-stored]')).toContainText('metadata.include_tools');
        // 저장된 연결이 없으면 하나 넣는다 — 저장 전에 넣었다 뺀 도구는 저장할 것이 없어 되돌리기 줄이 없다
        const saved = (await panel.locator('[data-connected]').count()) > 0;
        if (!saved) {
            await panel.locator('[data-test=add-tool]').click();
            await panel.locator('[data-add]').first().click();
            await panel.locator('[data-test=add-tool]').click();
        }
        await expect(panel.locator('[data-connected-group] [data-source-icon]').first()).toBeVisible();
        const first = panel.locator('[data-connected]').first();
        const name = (await first.getAttribute('data-connected'))!;
        await panel.locator(`[data-remove="${name}"]`).click();
        await expectNoDialog(page);
        await expect(panel.locator(`[data-connected="${name}"]`)).toHaveCount(0);
        if (!saved) {
            await expect(panel.locator(`[data-undo="${name}"]`)).toHaveCount(0);
            return;
        }
        await panel.locator(`[data-undo="${name}"]`).click();
        await expect(panel.locator(`[data-connected="${name}"]`)).toHaveCount(1);
    });

    test('도구 추가 창도 같은 묶음으로 나오고, 모두 추가는 MCP 서버 묶음에만 있다', async ({ page }) => {
        const picker = await openPicker(page, SKILL);
        await expect(picker.locator('[data-group=service] [data-source-icon=service]')).toBeVisible();
        await expect(picker.locator(`[data-group="mcp:${SERVER}"] [data-source-icon=mcp]`)).toBeVisible();
        await expect(picker.locator('[data-add-group=service]')).toHaveCount(0);
    });

    test('서비스 기본 스킬은 읽기 전용이고 그 이유가 보인다', async ({ page }) => {
        await page.goto(`/skills/${SYSTEM_SKILL}`, { waitUntil: 'domcontentloaded' });
        await page.locator('[data-test=open-tool-drawer]').click();
        const panel = page.locator('[data-test=skill-tool-panel]');
        await expect(panel.locator('[data-test=read-only]')).toBeVisible({ timeout: 30_000 });
        await expect(panel.locator('[data-test=add-tool]')).toHaveCount(0);
        await page.locator('[data-test=read-only]').hover();
        await expect(page.getByText('서비스 기본 스킬이라 바꿀 수 없습니다')).toBeVisible();
    });
});

test.describe('관리자가 아닌 사용자', () => {
    test.beforeEach(async ({ page }) => login(page, env('E2E_USER'), env('E2E_USER_PASS')));

    test('지정되지 않은 도구는 고를 수 없고, 그 이유가 추가 창 맨 위에 한 번 보인다', async ({ page }) => {
        const picker = await openPicker(page, SKILL);
        await expect(picker.locator('[data-test=picker-notice]')).toHaveCount(1);
        await expect(picker.locator('[data-test=picker-notice]')).toContainText('관리자');
        // 예전에는 같은 문장이 도구 행마다 반복됐다.
        await expect(picker.getByText('관리자만 스킬 전용으로 지정할 수 있습니다')).toHaveCount(0);
        await expect(picker.locator('[data-blocked]').first()).toBeDisabled();
        await expect(page.locator('[data-test=open-skill-only-tools]')).toHaveCount(0);
    });
});
