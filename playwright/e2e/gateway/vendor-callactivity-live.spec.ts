import { expect, test } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';

dotenv.config();

const screenshotDir = 'playwright/e2e/gateway/e2e-results';
const baseUrl = process.env.CALL_ACTIVITY_UI_BASE_URL || 'http://localhost:8088';
const tenantId = process.env.CALL_ACTIVITY_DB_E2E_TENANT || 'localhost';
const reviewerEmail = process.env.VENDOR_REVIEWER_EMAIL || 'security-reviewer-mr6kexs3@example.com';
const reviewerPassword = process.env.VENDOR_REVIEWER_PASSWORD || 'Codex!mr6kexs31234';
const backendParentId = process.env.VENDOR_BACKEND_PARENT_ID || 'vendor-onboarding-improvement.backend-1783183846';

const t = {
    parentProcess: '\uD611\uB825\uC0AC \uC628\uBCF4\uB529 \uAC1C\uC120 \uD504\uB85C\uC138\uC2A4',
    firstTask: '\uD611\uB825\uC0AC \uC628\uBCF4\uB529 \uC694\uCCAD \uB4F1\uB85D',
    referenceInfo: '\uCC38\uC870 \uC815\uBCF4',
    dataMapping: '\uB370\uC774\uD130 \uB9E4\uD551',
    owner: '\uB2F4\uB2F9\uC790',
    callActivity: '\uD611\uB825\uC0AC \uBCF4\uC548 \uC2EC\uC0AC \uD638\uCD9C',
    callProcessTab: '\uD638\uCD9C \uD504\uB85C\uC138\uC2A4',
    childProcess: '\uD611\uB825\uC0AC \uBCF4\uC548 \uC2EC\uC0AC \uD504\uB85C\uC138\uC2A4',
    roleMapping: '\uC5ED\uD560 \uB9E4\uD551',
    parentLane: '\uC0C1\uC704 \uD504\uB85C\uC138\uC2A4 lane',
    childLane: '\uD558\uC704 \uD504\uB85C\uC138\uC2A4 lane',
    parentSecurityLane: '\uBCF4\uC548\uAC80\uD1A0\uB2F4\uB2F9\uC790',
    childSecurityLane: '\uBCF4\uC548\uC2EC\uC0AC\uC790',
    reviewTask: '\uBCF4\uC548 \uCCB4\uD06C\uB9AC\uC2A4\uD2B8 \uC218\uC9D1'
};

function requireSupabase() {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_KEY;
    test.skip(!url || !key, 'Supabase URL/key env vars are required.');

    return createClient(url!, key!, {
        auth: { persistSession: false, autoRefreshToken: false }
    });
}

async function login(page: any, email: string, password: string) {
    await page.goto(`${baseUrl}/auth/login`, { waitUntil: 'domcontentloaded' });
    await page.locator('.cp-id input').fill(email);
    await page.locator('.cp-pwd input').fill(password);
    await page.locator('.cp-login').click();
    await page.waitForLoadState('networkidle').catch(() => undefined);
}

async function openDefinition(page: any) {
    await page.goto(`${baseUrl}/definitions/vendor-onboarding-improvement?edit=true`, {
        waitUntil: 'domcontentloaded'
    });
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await expect(page.getByText(t.parentProcess).first()).toBeVisible({ timeout: 30_000 });
}

async function openElementPanel(page: any, label: string) {
    const opened = await page.evaluate(async (label) => {
        const walkers: any[] = [];
        document.querySelectorAll('*').forEach((el: any) => {
            if (el.__vueParentComponent?.ctx?.openPanel) walkers.push(el.__vueParentComponent.ctx);
        });
        const ctx = walkers[0];
        if (!ctx?.definitions) return false;
        const queue = [...(ctx.definitions.rootElements || [])];
        while (queue.length) {
            const current: any = queue.shift();
            if (current?.name === label && current?.id) {
                await ctx.openPanel(current.id);
                return true;
            }
            if (current?.flowElements) queue.push(...current.flowElements);
            if (current?.laneSets) queue.push(...current.laneSets);
            if (current?.lanes) queue.push(...current.lanes);
        }
        return false;
    }, label);
    expect(opened, `openPanel(${label})`).toBe(true);
    await expect(page.locator('#property-panel')).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(800);
}

test.describe('vendor CallActivity mapper live screenshots', () => {
    test('captures persisted panel configuration and mapped reviewer assignment', async ({ page }) => {
        const supabase = requireSupabase();
        mkdirSync(screenshotDir, { recursive: true });

        await page.setViewportSize({ width: 1920, height: 1080 });
        const suffix = randomUUID().slice(0, 8);
        const createdUsers: string[] = [];
        const adminEmail = process.env.E2E_USER || `vendor-admin-${suffix}@example.com`;
        const adminPassword = process.env.E2E_PASS || `Codex!${suffix}1234`;

        const { data: procRow, error: procError } = await supabase
            .from('proc_def')
            .select('definition,bpmn')
            .eq('tenant_id', tenantId)
            .eq('id', 'vendor-onboarding-improvement')
            .single();
        expect(procError?.message || procError).toBeFalsy();
        expect(JSON.stringify(procRow?.definition)).toContain('vendor-security-review');
        expect(JSON.stringify(procRow?.definition)).toContain('callActivity.lane.');
        expect(procRow?.bpmn).toContain(t.callActivity);

        try {
            if (!process.env.E2E_USER) {
                const createdAdmin = await supabase.auth.admin.createUser({
                    email: adminEmail,
                    password: adminPassword,
                    email_confirm: true,
                    user_metadata: { name: 'vendor-admin' },
                    app_metadata: { tenant_id: tenantId }
                });
                expect(createdAdmin.error?.message || createdAdmin.error).toBeFalsy();
                const adminAuthUserId = createdAdmin.data.user?.id || null;
                expect(adminAuthUserId).toBeTruthy();
                createdUsers.push(adminAuthUserId!);
                const { error: upsertAdminError } = await supabase.from('users').upsert({
                    id: adminAuthUserId,
                    email: adminEmail,
                    username: 'vendor-admin',
                    tenant_id: tenantId,
                    is_admin: true,
                    role: 'admin'
                });
                expect(upsertAdminError?.message || upsertAdminError).toBeFalsy();
            }

            const existingReviewer = await supabase
                .from('users')
                .select('id,email')
                .eq('tenant_id', tenantId)
                .eq('email', reviewerEmail)
                .maybeSingle();
            expect(existingReviewer.error?.message || existingReviewer.error).toBeFalsy();

            await login(page, adminEmail, adminPassword);
            await openDefinition(page);

            await openElementPanel(page, t.firstTask);
            await page.getByText(t.referenceInfo).first().click();
            await expect(page.getByText(t.dataMapping).first()).toBeVisible({ timeout: 10_000 });
            await expect(page.locator('.v-select', { hasText: t.firstTask })).toHaveCount(0);
            await page.getByText(t.dataMapping).first().click();
            await expect(page.getByText(/forms|Forms/).first()).toBeVisible({ timeout: 15_000 });
            await page.locator('.tree.left-treeview .node-wrapper', { hasText: 'forms' }).first().locator('.icon-wrapper').click();
            await page.locator('.tree.left-treeview .node-wrapper', { hasText: t.firstTask }).first().locator('.icon-wrapper').click();
            await page.locator('.tree.right-treeview .node-wrapper', { hasText: 'lane' }).first().locator('.icon-wrapper').click();
            await expect(page.locator('.tree.left-treeview').getByText(t.owner).first()).toBeVisible({ timeout: 15_000 });
            await expect(page.locator('.tree.right-treeview').getByText(t.parentSecurityLane).first()).toBeVisible({ timeout: 15_000 });
            await expect(page.locator('.tree.right-treeview .node-wrapper', { hasText: 'endpoint' })).toHaveCount(0);
            const readMapperConnections = () =>
                page.evaluate(() => {
                    const element = document.querySelector('.form-mapper') as any;
                    let component = element?.__vueParentComponent;
                    while (component && component.type?.name !== 'mapper') component = component.parent;
                    const connections = component?.ctx?.connections || [];
                    return connections.map((connection) => ({
                        from: String(connection?.from?.[1] || ''),
                        to: String(connection?.to?.[1] || '')
                    }));
                });
            await expect
                .poll(
                    async () => {
                        return readMapperConnections();
                    },
                    { timeout: 15_000 }
                )
                .toHaveLength(1);
            const mapperConnections = await readMapperConnections();
            expect(mapperConnections[0].from).toContain('forms.vendor_onboarding_task_submit_vendor_need_form');
            expect(mapperConnections[0].from).toContain(t.owner);
            expect(mapperConnections[0].to).toContain(`lane.${t.parentSecurityLane}`);
            expect(mapperConnections[0].to).toContain('endpoint');
            await page.waitForTimeout(700);
            await page.screenshot({
                path: `${screenshotDir}/vendor-user-task-data-mapping.png`,
                fullPage: true
            });

            await openDefinition(page);
            await openElementPanel(page, t.callActivity);
            await page.getByText(t.callProcessTab).first().click();
            await expect(page.getByText(/vendor-security-review/).first()).toBeVisible({ timeout: 15_000 });
            await page.screenshot({
                path: `${screenshotDir}/vendor-callactivity-target-tab.png`,
                fullPage: true
            });

            await page.getByText(t.roleMapping).first().click();
            await expect(page.getByText(t.parentSecurityLane).first()).toBeVisible({ timeout: 15_000 });
            await expect(page.getByText(t.childSecurityLane).first()).toBeVisible({ timeout: 15_000 });
            await page.evaluate(() => {
                document.querySelectorAll('#property-panel, #property-panel *').forEach((element) => {
                    if (element instanceof HTMLElement) element.scrollLeft = 0;
                });
            });
            await page.waitForTimeout(1000);
            await page.screenshot({
                path: `${screenshotDir}/vendor-callactivity-role-mapping.png`,
                fullPage: true
            });

            const runtimeCheck = await page.evaluate(
                async ({ tenantId, reviewerEmail, backendParentId, t }) => {
                    const supabase = (window as any).$supabase;
                    const childResult = await supabase
                        .from('bpm_proc_inst')
                        .select('proc_inst_id,role_bindings,variables_data')
                        .eq('tenant_id', tenantId)
                        .eq('parent_proc_inst_id', backendParentId)
                        .eq('proc_def_id', 'vendor-security-review')
                        .single();
                    if (childResult.error) throw new Error(childResult.error.message);
                    const todoResult = await supabase
                        .from('todolist')
                        .select('id,activity_id,activity_name,status,user_id,assignees')
                        .eq('tenant_id', tenantId)
                        .eq('proc_inst_id', childResult.data.proc_inst_id)
                        .eq('activity_id', 'Task_collect_security_questionnaire')
                        .single();
                    if (todoResult.error) throw new Error(todoResult.error.message);
                    return {
                        childId: childResult.data.proc_inst_id,
                        roleBindings: childResult.data.role_bindings,
                        variablesData: childResult.data.variables_data,
                        todo: todoResult.data
                    };
                },
                { tenantId, reviewerEmail, backendParentId, t }
            );
            expect(runtimeCheck.roleBindings).toEqual(
                expect.arrayContaining([expect.objectContaining({ name: t.childSecurityLane, endpoint: reviewerEmail })])
            );
            expect(runtimeCheck.variablesData).toMatchObject({ assignedReviewerEmail: reviewerEmail });
            expect(runtimeCheck.todo.assignees).toEqual(
                expect.arrayContaining([expect.objectContaining({ name: t.childSecurityLane, endpoint: reviewerEmail })])
            );

            await login(page, reviewerEmail, reviewerPassword);
            await page.goto(`${baseUrl}/todolist`, { waitUntil: 'domcontentloaded' });
            await page.waitForLoadState('networkidle').catch(() => undefined);
            await expect(page.getByText(t.reviewTask).first()).toBeVisible({ timeout: 30_000 });
            await page.screenshot({
                path: `${screenshotDir}/vendor-role-mapped-reviewer-login.png`,
                fullPage: true
            });
        } finally {
            for (const userId of createdUsers) {
                await supabase.from('users').delete().eq('id', userId).eq('tenant_id', tenantId);
                await supabase.auth.admin.deleteUser(userId);
            }
        }
    });
});
