import { expect, test } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';

dotenv.config();

function requireDbE2e() {
    test.skip(process.env.CALL_ACTIVITY_DB_E2E !== '1', 'Set CALL_ACTIVITY_DB_E2E=1 to run the Supabase UI E2E test.');

    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_KEY;
    test.skip(!url || !key, 'Supabase URL/key env vars are required for the UI E2E test.');

    return createClient(url!, key!, {
        auth: { persistSession: false, autoRefreshToken: false }
    });
}

async function expectNoSupabaseError<T>(operation: PromiseLike<{ data: T; error: any }>) {
    const { data, error } = await operation;
    expect(error?.message || error).toBeFalsy();
    return data;
}

test.describe('ProcessGPT CallActivity Kanban UI', () => {
    test('shows parent CallActivity pending workitem on instance Kanban board', async ({ page }) => {
        const supabase = requireDbE2e();
        const suffix = randomUUID().slice(0, 8);
        const tenantId = process.env.CALL_ACTIVITY_DB_E2E_TENANT || 'localhost';
        const baseUrl = process.env.CALL_ACTIVITY_UI_BASE_URL || 'http://localhost:8088';
        const parentDefId = `codex_call_ui_parent_${suffix}`;
        const childDefId = `codex_call_ui_child_${suffix}`;
        const parentInstId = `${parentDefId}.1`;
        const childInstId = `${childDefId}.1`;
        const parentWorkitemId = randomUUID();
        const childWorkitemId = randomUUID();
        const parentName = `Codex CallActivity UI Parent ${suffix}`;
        const callActivityName = `Call child ${suffix}`;
        const screenshotDir = 'playwright/e2e/gateway/e2e-results';
        const screenshotPath = `${screenshotDir}/call-activity-kanban-${suffix}.png`;
        const authEmail = `codex-call-ui-${suffix}@example.com`;
        const authPassword = `Codex!${suffix}1234`;
        let authUserId: string | null = null;

        const parentDefinition = {
            processDefinitionName: parentName,
            processDefinitionId: parentDefId,
            roles: [{ name: 'requester' }, { name: 'child_worker' }],
            activities: [
                { id: 'A', name: 'A', type: 'userTask', role: 'requester', description: '' },
                {
                    id: 'call_child',
                    name: callActivityName,
                    type: 'CallActivity',
                    role: 'requester',
                    description: 'Parent waits while child process is running',
                    properties: JSON.stringify({
                        definitionId: childDefId,
                        roleBindings: [{ sourceRole: 'requester', targetRole: 'child_worker' }]
                    })
                }
            ],
            events: [{ id: 'start', type: 'startEvent' }, { id: 'end', type: 'endEvent' }],
            gateways: [],
            sequences: [
                { id: 'flow_start_a', source: 'start', target: 'A' },
                { id: 'flow_a_call', source: 'A', target: 'call_child' },
                { id: 'flow_call_end', source: 'call_child', target: 'end' }
            ],
            subProcesses: []
        };
        const childDefinition = {
            processDefinitionName: `Codex CallActivity UI Child ${suffix}`,
            processDefinitionId: childDefId,
            roles: [{ name: 'child_worker' }],
            activities: [{ id: 'X', name: 'Child task', type: 'userTask', role: 'child_worker', description: '' }],
            events: [{ id: 'child_start', type: 'startEvent' }, { id: 'child_end', type: 'endEvent' }],
            gateways: [],
            sequences: [
                { id: 'flow_child_start_x', source: 'child_start', target: 'X' },
                { id: 'flow_x_child_end', source: 'X', target: 'child_end' }
            ],
            subProcesses: []
        };

        try {
            const createdAuthUser = await supabase.auth.admin.createUser({
                email: authEmail,
                password: authPassword,
                email_confirm: true,
                user_metadata: { name: 'requester' },
                app_metadata: { tenant_id: tenantId }
            });
            test.skip(!!createdAuthUser.error, `Supabase admin auth is required for UI login E2E: ${createdAuthUser.error?.message}`);
            authUserId = createdAuthUser.data.user?.id || null;
            expect(authUserId).toBeTruthy();

            await expectNoSupabaseError(supabase.from('tenants').upsert({ id: tenantId }, { onConflict: 'id' }));
            await expectNoSupabaseError(
                supabase.from('users').upsert({
                    id: authUserId,
                    email: authEmail,
                    username: 'requester',
                    tenant_id: tenantId,
                    is_admin: true,
                    role: 'admin'
                })
            );
            await expectNoSupabaseError(
                supabase.from('proc_def').upsert([
                    {
                        id: parentDefId,
                        name: parentName,
                        tenant_id: tenantId,
                        definition: parentDefinition,
                        bpmn: '<bpmn:callActivity id="call_child" />',
                        isdeleted: false,
                        type: 'process'
                    },
                    {
                        id: childDefId,
                        name: `Codex CallActivity UI Child ${suffix}`,
                        tenant_id: tenantId,
                        definition: childDefinition,
                        bpmn: '<bpmn:userTask id="X" />',
                        isdeleted: false,
                        type: 'process'
                    }
                ])
            );
            await expectNoSupabaseError(
                supabase.from('bpm_proc_inst').upsert([
                    {
                        proc_inst_id: parentInstId,
                        proc_inst_name: parentName,
                        proc_def_id: parentDefId,
                        tenant_id: tenantId,
                        current_activity_ids: ['call_child'],
                        participants: [authUserId],
                        role_bindings: [{ name: 'requester', endpoint: authEmail }],
                        variables_data: {},
                        status: 'RUNNING',
                        root_proc_inst_id: parentInstId,
                        parent_proc_inst_id: null,
                        is_deleted: false,
                        start_date: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    },
                    {
                        proc_inst_id: childInstId,
                        proc_inst_name: `Codex CallActivity UI Child ${suffix}`,
                        proc_def_id: childDefId,
                        tenant_id: tenantId,
                        current_activity_ids: ['child_start'],
                        participants: [authUserId],
                        role_bindings: [{ name: 'child_worker', endpoint: authEmail }],
                        variables_data: {},
                        status: 'NEW',
                        root_proc_inst_id: parentInstId,
                        parent_proc_inst_id: parentInstId,
                        is_deleted: false,
                        start_date: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    }
                ])
            );
            await expectNoSupabaseError(
                supabase.from('todolist').upsert([
                    {
                        id: parentWorkitemId,
                        proc_inst_id: parentInstId,
                        root_proc_inst_id: parentInstId,
                        proc_def_id: parentDefId,
                        activity_id: 'call_child',
                        activity_name: callActivityName,
                        description: 'Parent waits while child process is running',
                        status: 'PENDING',
                        tenant_id: tenantId,
                        user_id: authEmail,
                        username: authEmail,
                        assignees: [{ name: 'child_worker', endpoint: authEmail }],
                        output: {},
                        retry: 0
                    },
                    {
                        id: childWorkitemId,
                        proc_inst_id: childInstId,
                        root_proc_inst_id: parentInstId,
                        proc_def_id: childDefId,
                        activity_id: 'child_start',
                        activity_name: `Child start ${suffix}`,
                        status: 'SUBMITTED',
                        tenant_id: tenantId,
                        user_id: authEmail,
                        username: authEmail,
                        assignees: [{ name: 'child_worker', endpoint: authEmail }],
                        output: {},
                        retry: 0
                    }
                ])
            );

            await page.goto(`${baseUrl}/auth/login`, { waitUntil: 'networkidle' });
            await page.locator('.cp-id input').fill(authEmail);
            await page.locator('.pwdInput input').fill(authPassword);
            await page.locator('.cp-login').click();
            await page.waitForURL(/definition-map|tenant|\/$/, { timeout: 20_000 }).catch(() => undefined);
            await page.evaluate(() => localStorage.setItem('instanceCard-lastTab', 'todo'));

            const instancePath = `/instancelist/${parentInstId.replace(/\./g, '_DOT_')}`;
            if (baseUrl.includes(':8088')) {
                await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
                await page.evaluate((routePath) => {
                    window.history.pushState({}, '', routePath);
                    window.dispatchEvent(new PopStateEvent('popstate'));
                }, instancePath);
            } else {
                await page.goto(`${baseUrl}${instancePath}`, { waitUntil: 'networkidle' });
            }
            const kanbanTab = page.getByRole('tab', { name: /칸반보드|Kanban/i });
            if (await kanbanTab.isVisible().catch(() => false)) {
                await kanbanTab.click();
            }

            await expect(page.getByText(parentName).first()).toBeVisible({ timeout: 20_000 });
            await expect(page.getByText(callActivityName)).toBeVisible({ timeout: 20_000 });
            await expect(page.getByText(/보류\/반송|Pending/i)).toBeVisible();

            mkdirSync(screenshotDir, { recursive: true });
            await page.screenshot({
                path: screenshotPath,
                fullPage: true
            });
        } finally {
            await supabase.from('todolist').delete().in('id', [childWorkitemId, parentWorkitemId]).eq('tenant_id', tenantId);
            await supabase.from('bpm_proc_inst').delete().in('proc_inst_id', [childInstId, parentInstId]).eq('tenant_id', tenantId);
            await supabase.from('proc_def').delete().in('id', [childDefId, parentDefId]).eq('tenant_id', tenantId);
            if (authUserId) {
                await supabase.from('users').delete().eq('id', authUserId).eq('tenant_id', tenantId);
                await supabase.auth.admin.deleteUser(authUserId);
            }
        }
    });

    test('redirects completed child instance board back to parent instance board', async ({ page }) => {
        const supabase = requireDbE2e();
        const suffix = randomUUID().slice(0, 8);
        const tenantId = process.env.CALL_ACTIVITY_DB_E2E_TENANT || 'localhost';
        const baseUrl = process.env.CALL_ACTIVITY_UI_BASE_URL || 'http://localhost:8088';
        const parentDefId = `codex_call_redirect_parent_${suffix}`;
        const childDefId = `codex_call_redirect_child_${suffix}`;
        const parentInstId = `${parentDefId}.1`;
        const childInstId = `${childDefId}.1`;
        const parentName = `Codex Redirect Parent ${suffix}`;
        const childName = `Codex Redirect Child ${suffix}`;
        const authEmail = `codex-call-redirect-${suffix}@example.com`;
        const authPassword = `Codex!${suffix}1234`;
        let authUserId: string | null = null;

        try {
            const createdAuthUser = await supabase.auth.admin.createUser({
                email: authEmail,
                password: authPassword,
                email_confirm: true,
                user_metadata: { name: 'requester' },
                app_metadata: { tenant_id: tenantId }
            });
            test.skip(!!createdAuthUser.error, `Supabase admin auth is required for UI login E2E: ${createdAuthUser.error?.message}`);
            authUserId = createdAuthUser.data.user?.id || null;
            expect(authUserId).toBeTruthy();

            await expectNoSupabaseError(supabase.from('tenants').upsert({ id: tenantId }, { onConflict: 'id' }));
            await expectNoSupabaseError(
                supabase.from('users').upsert({
                    id: authUserId,
                    email: authEmail,
                    username: 'requester',
                    tenant_id: tenantId,
                    is_admin: true,
                    role: 'admin'
                })
            );
            await expectNoSupabaseError(
                supabase.from('proc_def').upsert([
                    {
                        id: parentDefId,
                        name: parentName,
                        tenant_id: tenantId,
                        definition: { processDefinitionName: parentName, processDefinitionId: parentDefId, activities: [], events: [], gateways: [], sequences: [] },
                        bpmn: '<bpmn:process />',
                        isdeleted: false,
                        type: 'process'
                    },
                    {
                        id: childDefId,
                        name: childName,
                        tenant_id: tenantId,
                        definition: { processDefinitionName: childName, processDefinitionId: childDefId, activities: [], events: [], gateways: [], sequences: [] },
                        bpmn: '<bpmn:process />',
                        isdeleted: false,
                        type: 'process'
                    }
                ])
            );
            await expectNoSupabaseError(
                supabase.from('bpm_proc_inst').upsert([
                    {
                        proc_inst_id: parentInstId,
                        proc_inst_name: parentName,
                        proc_def_id: parentDefId,
                        tenant_id: tenantId,
                        current_activity_ids: ['call_child'],
                        participants: [authUserId],
                        role_bindings: [{ name: 'requester', endpoint: authEmail }],
                        variables_data: {},
                        status: 'RUNNING',
                        root_proc_inst_id: parentInstId,
                        parent_proc_inst_id: null,
                        is_deleted: false,
                        start_date: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    },
                    {
                        proc_inst_id: childInstId,
                        proc_inst_name: childName,
                        proc_def_id: childDefId,
                        tenant_id: tenantId,
                        current_activity_ids: [],
                        participants: [authUserId],
                        role_bindings: [{ name: 'child_worker', endpoint: authEmail }],
                        variables_data: {},
                        status: 'RUNNING',
                        root_proc_inst_id: parentInstId,
                        parent_proc_inst_id: parentInstId,
                        is_deleted: false,
                        start_date: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    }
                ])
            );

            await page.goto(`${baseUrl}/auth/login`, { waitUntil: 'networkidle' });
            await page.locator('.cp-id input').fill(authEmail);
            await page.locator('.pwdInput input').fill(authPassword);
            await page.locator('.cp-login').click();
            await page.waitForURL(/definition-map|tenant|\/$/, { timeout: 20_000 }).catch(() => undefined);
            await page.evaluate(() => localStorage.setItem('instanceCard-lastTab', 'todo'));

            const childPath = `/instancelist/${childInstId.replace(/\./g, '_DOT_')}?tab=todo`;
            if (baseUrl.includes(':8088')) {
                await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
                await page.evaluate((routePath) => {
                    window.history.pushState({}, '', routePath);
                    window.dispatchEvent(new PopStateEvent('popstate'));
                }, childPath);
            } else {
                await page.goto(`${baseUrl}${childPath}`, { waitUntil: 'networkidle' });
            }

            await expect(page).toHaveURL(new RegExp(childInstId.replace(/\./g, '_DOT_')), { timeout: 20_000 });
            await expect(page.getByText(childName).first()).toBeVisible({ timeout: 20_000 });

            await expectNoSupabaseError(
                supabase
                    .from('bpm_proc_inst')
                    .update({ status: 'COMPLETED', updated_at: new Date().toISOString() })
                    .eq('proc_inst_id', childInstId)
                    .eq('tenant_id', tenantId)
            );

            await expect(page).toHaveURL(new RegExp(parentInstId.replace(/\./g, '_DOT_')), { timeout: 25_000 });
            await expect(page.getByText(parentName).first()).toBeVisible({ timeout: 20_000 });
        } finally {
            await supabase.from('bpm_proc_inst').delete().in('proc_inst_id', [childInstId, parentInstId]).eq('tenant_id', tenantId);
            await supabase.from('proc_def').delete().in('id', [childDefId, parentDefId]).eq('tenant_id', tenantId);
            if (authUserId) {
                await supabase.from('users').delete().eq('id', authUserId).eq('tenant_id', tenantId);
                await supabase.auth.admin.deleteUser(authUserId);
            }
        }
    });
});
