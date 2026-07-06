import { expect, test } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

dotenv.config();

function requireDbE2e() {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_KEY;
    test.skip(!url || !key, 'Supabase URL/key env vars are required for the live mapper UI E2E test.');

    return createClient(url!, key!, {
        auth: { persistSession: false, autoRefreshToken: false }
    });
}

async function expectNoSupabaseError<T>(operation: PromiseLike<{ data: T; error: any }>) {
    const { data, error } = await operation;
    expect(error?.message || error).toBeFalsy();
    return data;
}

function runPollingBackendOnce(workitemId: string, tenantId: string) {
    const executionRoot = process.env.EXECUTION_ROOT || 'D:\\uEngineProjectC\\processEsecution\\process-gpt-execution';
    const script = String.raw`
import asyncio
import os
import pathlib
import sys

root = pathlib.Path.cwd()
polling_root = root / "polling_service"
sys.path.insert(0, str(root))
sys.path.insert(0, str(polling_root))

from database import setting_database, subdomain_var, supabase_client_var
import workitem_processor

setting_database()
subdomain_var.set("${tenantId}")
supabase = supabase_client_var.get()
resp = supabase.table("todolist").select("*").eq("id", "${workitemId}").eq("tenant_id", "${tenantId}").single().execute()
if not resp.data:
    raise RuntimeError("workitem not found")
asyncio.run(workitem_processor.handle_workitem(resp.data))
print("OK")
`;

    const result = spawnSync('uv', ['run', 'python', '-c', script], {
        cwd: executionRoot,
        encoding: 'utf8',
        timeout: 90_000,
        env: {
            ...process.env,
            ENV: 'test',
            SUPABASE_URL: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
            SUPABASE_KEY: process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_KEY || '',
            UV_CACHE_DIR: 'C:\\tmp\\uv-cache-process-gpt',
            UV_LINK_MODE: 'copy'
        }
    });
    expect(result.status, result.stderr || result.stdout).toBe(0);
}

test.describe('ProcessGPT mapper live UI screenshot', () => {
    test('shows backend mapper result on real instance output tab', async ({ page }) => {
        const supabase = requireDbE2e();
        const suffix = randomUUID().slice(0, 8);
        const tenantId = process.env.CALL_ACTIVITY_DB_E2E_TENANT || 'localhost';
        const baseUrl = process.env.CALL_ACTIVITY_UI_BASE_URL || 'http://localhost:8088';
        const procDefId = `codex_mapper_live_${suffix}`;
        const instId = `${procDefId}.1`;
        const workitemId = randomUUID();
        const formId = `mapper_form_${suffix}`;
        const processName = `Codex Mapper Live ${suffix}`;
        const activityName = `ConcatTransformer Mapper Input ${suffix}`;
        const approvedActivityName = `Approved Task From JaneKim ${suffix}`;
        const reviewActivityName = `Review Task Should Not Start ${suffix}`;
        const approverEmail = `mapped-approver-${suffix}@example.com`;
        const authEmail = `codex-mapper-live-${suffix}@example.com`;
        const authPassword = `Codex!${suffix}1234`;
        const screenshotDir = 'playwright/e2e/gateway/e2e-results';
        const mapperOutputScreenshotPath = `${screenshotDir}/processgpt-mapper-transformer-output-ui-${suffix}.png`;
        const progressScreenshotPath = `${screenshotDir}/processgpt-mapper-transformer-progress-ui-${suffix}.png`;
        let authUserId: string | null = null;

        const formHtml = `
<section>
  <row-layout name="mapper_result" alias="Mapper Result" v-model="formValues" v-slot="slotProps">
    <div class="row">
      <div class="col-sm-12"><text-field name="name" alias="Name" v-model="slotProps.modelValue['name']"></text-field></div>
      <div class="col-sm-12"><text-field name="firstName" alias="First Name" v-model="slotProps.modelValue['firstName']"></text-field></div>
      <div class="col-sm-12"><text-field name="lastName" alias="Last Name" v-model="slotProps.modelValue['lastName']"></text-field></div>
      <div class="col-sm-12"><text-field name="approverEmail" alias="Mapped Approver Email" v-model="slotProps.modelValue['approverEmail']"></text-field></div>
      <div class="col-sm-12"><text-field name="fullName" alias="Mapped Full Name" v-model="slotProps.modelValue['fullName']"></text-field></div>
    </div>
  </row-layout>
</section>`;

        const processDefinition = {
            processDefinitionName: processName,
            processDefinitionId: procDefId,
            roles: [{ name: 'requester', default: authEmail }],
            activities: [
                {
                    id: 'A',
                    name: activityName,
                    type: 'userTask',
                    role: 'requester',
                    description: '',
                    tool: `formHandler:${formId}`,
                    properties: JSON.stringify({
                        eventSynchronization: {
                            mappingContext: {
                                mappingElements: [
                                    {
                                        argument: { text: 'customerName' },
                                        direction: 'out',
                                        variable: { name: 'name' }
                                    },
                                    {
                                        argument: { text: 'lane.approver.endpoint' },
                                        direction: 'out',
                                        variable: { name: 'approverEmail' }
                                    },
                                    {
                                        argument: { text: 'forms.current.fullName' },
                                        direction: 'out',
                                        transformerMapping: {
                                            transformer: {
                                                _type: 'org.uengine.processdesigner.mapper.transformers.ConcatTransformer',
                                                argumentSourceMap: {
                                                    str1: 'firstName',
                                                    str2: 'lastName'
                                                }
                                            },
                                            linkedArgumentName: 'fullName'
                                        }
                                    },
                                    {
                                        argument: { text: 'fullName' },
                                        direction: 'out',
                                        transformerMapping: {
                                            transformer: {
                                                _type: 'org.uengine.processdesigner.mapper.transformers.ConcatTransformer',
                                                argumentSourceMap: {
                                                    str1: 'firstName',
                                                    str2: 'lastName'
                                                }
                                            },
                                            linkedArgumentName: 'fullName'
                                        }
                                    }
                                ]
                            }
                        }
                    })
                },
                { id: 'B_APPROVED', name: approvedActivityName, type: 'userTask', role: 'approver', description: 'Started because fullName == JaneKim and assigned through mapped role binding' },
                { id: 'B_REVIEW', name: reviewActivityName, type: 'userTask', role: 'requester', description: 'Should not start when mapper condition is true' }
            ],
            events: [{ id: 'start', type: 'startEvent' }, { id: 'end', type: 'endEvent' }],
            gateways: [],
            sequences: [
                { id: 'flow_start_a', source: 'start', target: 'A' },
                {
                    id: 'flow_a_approved',
                    source: 'A',
                    target: 'B_APPROVED',
                    properties: JSON.stringify({
                        condition: 'ConcatTransformer result is JaneKim',
                        conditionMode: 'function',
                        conditionFunction: "__mapped['fullName'] == 'JaneKim'"
                    })
                },
                {
                    id: 'flow_a_review',
                    source: 'A',
                    target: 'B_REVIEW',
                    properties: JSON.stringify({
                        condition: 'Fallback when ConcatTransformer result is not JaneKim',
                        conditionMode: 'function',
                        conditionFunction: "__mapped['fullName'] != 'JaneKim'"
                    })
                },
                { id: 'flow_approved_end', source: 'B_APPROVED', target: 'end' },
                { id: 'flow_review_end', source: 'B_REVIEW', target: 'end' }
            ],
            subProcesses: []
        };

        try {
            await page.setViewportSize({ width: 1920, height: 1080 });

            const createdAuthUser = await supabase.auth.admin.createUser({
                email: authEmail,
                password: authPassword,
                email_confirm: true,
                user_metadata: { name: 'requester' },
                app_metadata: { tenant_id: tenantId }
            });
            test.skip(!!createdAuthUser.error, `Supabase admin auth is required for live UI E2E: ${createdAuthUser.error?.message}`);
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
                supabase.from('proc_def').upsert({
                    id: procDefId,
                    name: processName,
                    tenant_id: tenantId,
                    definition: processDefinition,
                    bpmn: '<bpmn:process />',
                    isdeleted: false,
                    type: 'process'
                })
            );
            await expectNoSupabaseError(
                supabase.from('form_def').upsert({
                    id: formId,
                    tenant_id: tenantId,
                    proc_def_id: procDefId,
                    activity_id: 'A',
                    html: formHtml,
                    fields_json: [
                        { key: 'name', text: 'Name', type: 'text' },
                        { key: 'firstName', text: 'First Name', type: 'text' },
                        { key: 'lastName', text: 'Last Name', type: 'text' },
                        { key: 'approverEmail', text: 'Mapped Approver Email', type: 'text' },
                        { key: 'fullName', text: 'Mapped Full Name', type: 'text' }
                    ]
                })
            );
            await expectNoSupabaseError(
                supabase.from('bpm_proc_inst').upsert({
                    proc_inst_id: instId,
                    proc_inst_name: processName,
                    proc_def_id: procDefId,
                    tenant_id: tenantId,
                    current_activity_ids: ['A'],
                    participants: [authUserId],
                    role_bindings: [{ name: 'requester', endpoint: authEmail }],
                    variables_data: [],
                    status: 'RUNNING',
                    root_proc_inst_id: instId,
                    parent_proc_inst_id: null,
                    is_deleted: false,
                    start_date: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
            );
            await expectNoSupabaseError(
                supabase.from('todolist').upsert({
                    id: workitemId,
                    proc_inst_id: instId,
                    root_proc_inst_id: instId,
                    proc_def_id: procDefId,
                    activity_id: 'A',
                    activity_name: activityName,
                    description: 'Submitted workitem with mapper',
                    status: 'SUBMITTED',
                    tenant_id: tenantId,
                    user_id: authEmail,
                    username: authEmail,
                    tool: `formHandler:${formId}`,
                    assignees: [{ name: 'requester', endpoint: authEmail }],
                    output: {
                        [formId]: {
                            name: 'Jane Kim',
                            firstName: 'Jane',
                            lastName: 'Kim',
                            approverEmail
                        }
                    },
                    retry: 0
                })
            );

            runPollingBackendOnce(workitemId, tenantId);

            const { data: completedWorkitem, error: workitemError } = await supabase
                .from('todolist')
                .select('output,status')
                .eq('id', workitemId)
                .eq('tenant_id', tenantId)
                .single();
            expect(workitemError?.message || workitemError).toBeFalsy();
            expect(completedWorkitem?.output?.[formId]?.fullName).toBe('JaneKim');
            expect(completedWorkitem?.output?.__mapped?.customerName).toBe('Jane Kim');

            const { data: instanceRow, error: instanceError } = await supabase
                .from('bpm_proc_inst')
                .select('variables_data,role_bindings')
                .eq('proc_inst_id', instId)
                .eq('tenant_id', tenantId)
                .single();
            expect(instanceError?.message || instanceError).toBeFalsy();
            expect(instanceRow?.variables_data?.customerName).toBe('Jane Kim');
            expect(instanceRow?.variables_data?.fullName).toBe('JaneKim');
            expect(instanceRow?.role_bindings).toEqual(
                expect.arrayContaining([expect.objectContaining({ name: 'approver', endpoint: approverEmail })])
            );

            const { data: routedWorkitems, error: routedError } = await supabase
                .from('todolist')
                .select('activity_id,activity_name,status,description,user_id,assignees')
                .eq('proc_inst_id', instId)
                .eq('tenant_id', tenantId);
            expect(routedError?.message || routedError).toBeFalsy();
            expect(
                routedWorkitems?.some(
                    (item) => item.activity_id === 'B_APPROVED' && item.activity_name === approvedActivityName && item.status === 'IN_PROGRESS'
                ),
                JSON.stringify(routedWorkitems, null, 2)
            ).toBe(true);
            expect(
                routedWorkitems?.some(
                    (item) =>
                        item.activity_id === 'B_APPROVED' &&
                        item.user_id === approverEmail &&
                        item.assignees?.some((assignee: any) => assignee.name === 'approver' && assignee.endpoint === approverEmail)
                ),
                JSON.stringify(routedWorkitems, null, 2)
            ).toBe(true);
            expect(
                routedWorkitems?.some((item) => item.activity_id === 'B_REVIEW' && item.status === 'IN_PROGRESS'),
                JSON.stringify(routedWorkitems, null, 2)
            ).toBe(false);

            await page.goto(`${baseUrl}/auth/login`, { waitUntil: 'networkidle' });
            await page.locator('.cp-id input').fill(authEmail);
            await page.locator('.pwdInput input').fill(authPassword);
            await page.locator('.cp-login').click();
            await page.waitForURL(/definition-map|tenant|\/$/, { timeout: 20_000 }).catch(() => undefined);
            await page.evaluate(() => localStorage.setItem('instanceCard-lastTab', 'output'));

            const instancePath = `/instancelist/${instId.replace(/\./g, '_DOT_')}?tab=output`;
            if (baseUrl.includes(':8088')) {
                await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
                await page.evaluate((routePath) => {
                    window.history.pushState({}, '', routePath);
                    window.dispatchEvent(new PopStateEvent('popstate'));
                }, instancePath);
            } else {
                await page.goto(`${baseUrl}${instancePath}`, { waitUntil: 'networkidle' });
            }

            await expect(page.getByText(processName).first()).toBeVisible({ timeout: 20_000 });
            const outputTab = page.getByRole('tab', { name: /Output|산출|출력|output/i });
            if (await outputTab.isVisible().catch(() => false)) {
                await outputTab.click();
            }
            await expect(page.getByText(activityName).first()).toBeVisible({ timeout: 20_000 });
            await page.waitForTimeout(500);

            mkdirSync(screenshotDir, { recursive: true });
            await page.screenshot({
                path: mapperOutputScreenshotPath,
                fullPage: true
            });

            const kanbanTab = page.getByRole('tab', { name: /Kanban|칸반|kanban/i });
            if (await kanbanTab.isVisible().catch(() => false)) {
                await kanbanTab.click();
            } else {
                await page.evaluate(() => localStorage.setItem('instanceCard-lastTab', 'todo'));
                const kanbanPath = `/instancelist/${instId.replace(/\./g, '_DOT_')}?tab=todo`;
                await page.goto(`${baseUrl}${kanbanPath}`, { waitUntil: 'networkidle' });
            }
            const approvedCardText = page.getByText(approvedActivityName).first();
            await expect(approvedCardText).toBeVisible({ timeout: 20_000 });
            await approvedCardText.scrollIntoViewIfNeeded();
            await page.waitForTimeout(500);
            await page.screenshot({
                path: progressScreenshotPath,
                fullPage: true
            });
        } finally {
            await supabase.from('todolist').delete().eq('id', workitemId).eq('tenant_id', tenantId);
            await supabase.from('bpm_proc_inst').delete().eq('proc_inst_id', instId).eq('tenant_id', tenantId);
            await supabase.from('form_def').delete().eq('id', formId).eq('tenant_id', tenantId);
            await supabase.from('proc_def').delete().eq('id', procDefId).eq('tenant_id', tenantId);
            if (authUserId) {
                await supabase.from('users').delete().eq('id', authUserId).eq('tenant_id', tenantId);
                await supabase.auth.admin.deleteUser(authUserId);
            }
        }
    });
});
