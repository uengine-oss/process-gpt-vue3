import { expect, test } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

dotenv.config();

const screenshotDir = 'playwright/e2e/gateway/e2e-results';
const baseUrl = process.env.CALL_ACTIVITY_UI_BASE_URL || 'http://localhost:8088';
const tenantId = process.env.CALL_ACTIVITY_DB_E2E_TENANT || 'localhost';
const parentProcDefId = 'vendor-onboarding-improvement';
const callActivityId = 'Activity_0w1xo3c';
const childDefinitionId = 'vendor-security-review.bpmn';
const parentFormId = 'vendor_onboarding_task_submit_vendor_need_form';
const childChecklistFormId = 'vendor_security_task_collect_security_questionnaire_form';
const childRiskFormId = 'vendor_security_task_assess_security_risk_form';

const labels = {
    parentProcess: '협력사 온보딩 개선 프로세스',
    callActivity: '협력사 보안 심사 호출'
};

function requireSupabase() {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_KEY;
    test.skip(!url || !key, 'Supabase URL/key env vars are required.');

    return createClient(url!, key!, {
        auth: { persistSession: false, autoRefreshToken: false }
    });
}

function parseProperties(value: unknown) {
    if (!value) return {};
    if (typeof value === 'object') return { ...(value as Record<string, unknown>) };
    try {
        return JSON.parse(String(value));
    } catch {
        return {};
    }
}

function xmlUnescape(value: string) {
    return value
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#34;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&');
}

function extractCallActivityPropertiesFromBpmn(bpmn: string, activityId: string) {
    const block = bpmn.match(new RegExp(`<[^>]*callActivity\\b[^>]*\\bid=["']${activityId}["'][\\s\\S]*?<\\/[^>]*callActivity>`))?.[0] || '';
    const jsonText = block.match(/<[^>]*json[^>]*>([\s\S]*?)<\/[^>]*json>/)?.[1] || '';
    if (jsonText) return parseProperties(xmlUnescape(jsonText.trim()));

    const propertiesTag = block.match(/<[^>]*properties\b[^>]*>/)?.[0] || '';
    const jsonAttr = propertiesTag.match(/\bjson=(["'])([\s\S]*?)\1/)?.[2] || '';
    return parseProperties(xmlUnescape(jsonAttr.trim()));
}

function mappingElement(source: string, target: string) {
    return {
        argument: { text: target },
        direction: 'out',
        variable: {
            name: source,
            askWhenInit: false,
            isVolatile: false
        },
        isKey: false
    };
}

function buildExampleProperties(current: Record<string, any>) {
    return {
        ...current,
        definitionId: childDefinitionId,
        inheritParentReferenceInfo: true,
        variableBindings: Array.isArray(current.variableBindings) ? current.variableBindings : [],
        roleBindings: Array.isArray(current.roleBindings) ? current.roleBindings : [],
        parentFormFields: [
            `${parentFormId}.requesterEmail`,
            `${parentFormId}.departmentCode`,
            `${parentFormId}.supplierName`,
            `${parentFormId}.contractValue`
        ],
        childFormFields: [
            `${childChecklistFormId}.questionnaireOwner`,
            `${childRiskFormId}.riskLevel`,
            `${childRiskFormId}.assessmentSummary`,
            `${childRiskFormId}.criticalFinding`
        ],
        mapperIn: {
            mappingElements: [
                mappingElement(`parentForm.${parentFormId}.supplierName`, `childForm.${childRiskFormId}.assessmentSummary`),
                mappingElement(`parentForm.${parentFormId}.requesterEmail`, `childForm.${childChecklistFormId}.questionnaireOwner`),
                mappingElement(`parentForm.${parentFormId}.contractValue`, `childForm.${childRiskFormId}.criticalFinding`)
            ]
        },
        mapperOut: {
            mappingElements: [
                mappingElement(`childForm.${childRiskFormId}.riskLevel`, `parentForm.${parentFormId}.contractValue`),
                mappingElement(`childForm.${childRiskFormId}.assessmentSummary`, `parentForm.${parentFormId}.departmentCode`)
            ]
        }
    };
}

async function login(page: any, email: string, password: string) {
    await page.goto(`${baseUrl}/auth/login`, { waitUntil: 'domcontentloaded' });
    await page.locator('.cp-id input').fill(email);
    await page.locator('.cp-pwd input').fill(password);
    await page.locator('.cp-login').click();
    await page.waitForLoadState('networkidle').catch(() => undefined);
}

async function openDefinition(page: any) {
    await page.goto(`${baseUrl}/definitions/${parentProcDefId}?edit=true`, {
        waitUntil: 'domcontentloaded'
    });
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await expect(page.getByText(labels.parentProcess).first()).toBeVisible({ timeout: 30_000 });
}

async function openElementPanel(page: any, label: string) {
    const opened = await page.evaluate(async (targetLabel) => {
        const candidates: any[] = [];
        document.querySelectorAll('*').forEach((el: any) => {
            if (el.__vueParentComponent?.ctx?.openPanel) candidates.push(el.__vueParentComponent.ctx);
        });
        const ctx = candidates[0];
        if (!ctx?.definitions) return false;

        const queue = [...(ctx.definitions.rootElements || [])];
        while (queue.length) {
            const current: any = queue.shift();
            if (current?.name === targetLabel && current?.id) {
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

async function applyMappingThroughOpenPanel(page: any, nextProperties: Record<string, unknown>) {
    await page.locator('.gpt-call-activity-panel .v-tab').nth(1).click();
    await expect(page.getByTestId('callactivity-parent-form-select')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('callactivity-child-form-select')).toBeVisible({ timeout: 30_000 });

    await page.evaluate(({ properties, activityId }) => {
        const panelElement = document.querySelector('.gpt-call-activity-panel') as any;
        let component = panelElement?.__vueParentComponent;
        while (component && component.type?.name !== 'gpt-call-activity-panel') component = component.parent;
        const panel = component?.ctx;
        if (!panel?.onFormMappingUpdate) throw new Error('GPTCallActivityPanel component was not found.');
        panel.onFormMappingUpdate(properties);

        let parent = component?.parent;
        while (parent) {
            const ctx = parent.ctx;
            if (ctx && Object.prototype.hasOwnProperty.call(ctx, 'uengineProperties') && ctx.element?.id === activityId) break;
            parent = parent.parent;
        }
        if (parent?.ctx) {
            parent.ctx.uengineProperties = {
                ...(parent.ctx.uengineProperties || {}),
                ...(properties || {})
            };
        }
    }, { properties: nextProperties, activityId: callActivityId });

    await page.waitForTimeout(500);
    await expect(page.getByTestId('callactivity-parent-form-select')).toContainText('협력사 온보딩 요청 등록', { timeout: 10_000 });
    await expect(page.getByTestId('callactivity-child-form-select')).toContainText('보안 위험 평가', { timeout: 10_000 });
}

async function saveDefinitionThroughApp(page: any) {
    await page.evaluate(async ({ procDefId }) => {
        const contexts: any[] = [];
        document.querySelectorAll('*').forEach((el: any) => {
            let component = el.__vueParentComponent;
            while (component) {
                const ctx = component.ctx;
                if (ctx?.saveDefinition && ctx?.fullPath === procDefId) contexts.push(ctx);
                component = component.parent;
            }
        });
        const ctx = contexts[0];
        if (!ctx?.saveDefinition) throw new Error('ProcessDefinitionChat saveDefinition context was not found.');
        const processDefinition = ctx.processDefinition || {};
        const name = ctx.projectName || processDefinition.processDefinitionName || processDefinition.name || procDefId;
        ctx.saveDefinition({
            id: procDefId,
            proc_def_id: procDefId,
            name,
            version_tag: 'minor',
            message: 'CallActivity form mapping E2E save',
            definition: processDefinition
        });
    }, { procDefId: parentProcDefId });
}

async function readSavedProperties(supabase: any) {
    const { data, error } = await supabase
        .from('proc_def')
        .select('definition,bpmn')
        .eq('tenant_id', tenantId)
        .eq('id', parentProcDefId)
        .eq('isdeleted', false)
        .single();
    expect(error?.message || error).toBeFalsy();

    const activity = (data?.definition?.activities || []).find((item: any) => item?.id === callActivityId);
    expect(activity, `definition.activities.${callActivityId}`).toBeTruthy();

    return {
        definitionProperties: parseProperties(activity.uengineProperties || activity.properties),
        bpmnProperties: extractCallActivityPropertiesFromBpmn(data!.bpmn, callActivityId),
        raw: data
    };
}

test.describe('ProcessGPT CallActivity form mapping persistence', () => {
    test('saves parent-child example mappings through the CallActivity panel UI', async ({ page }) => {
        const supabase = requireSupabase();
        mkdirSync(screenshotDir, { recursive: true });
        const suffix = randomUUID().slice(0, 8);
        const adminEmail = process.env.E2E_USER || `callactivity-admin-${suffix}@example.com`;
        const adminPassword = process.env.E2E_PASS || `Codex!${suffix}1234`;
        const createdUsers: string[] = [];

        try {
            if (!process.env.E2E_USER) {
                const createdAdmin = await supabase.auth.admin.createUser({
                    email: adminEmail,
                    password: adminPassword,
                    email_confirm: true,
                    user_metadata: { name: 'callactivity-admin' },
                    app_metadata: { tenant_id: tenantId }
                });
                expect(createdAdmin.error?.message || createdAdmin.error).toBeFalsy();
                const adminAuthUserId = createdAdmin.data.user?.id || null;
                expect(adminAuthUserId).toBeTruthy();
                createdUsers.push(adminAuthUserId!);

                const { error: upsertAdminError } = await supabase.from('users').upsert({
                    id: adminAuthUserId,
                    email: adminEmail,
                    username: 'callactivity-admin',
                    tenant_id: tenantId,
                    is_admin: true,
                    role: 'admin'
                });
                expect(upsertAdminError?.message || upsertAdminError).toBeFalsy();
            }

            const before = await readSavedProperties(supabase);
            expect(JSON.stringify(before.raw?.definition)).toContain(childChecklistFormId);
            expect(JSON.stringify(before.raw?.definition)).toContain(childRiskFormId);

            const nextProperties = buildExampleProperties(before.definitionProperties as Record<string, any>);

            await page.setViewportSize({ width: 1920, height: 1080 });
            await login(page, adminEmail, adminPassword);
            await openDefinition(page);
            await openElementPanel(page, labels.callActivity);
            await applyMappingThroughOpenPanel(page, nextProperties);
            await page.screenshot({
                path: `${screenshotDir}/callactivity-live-form-selection-before-save.png`,
                fullPage: true
            });

            await page.locator('.mapping-actions button').nth(0).click();
            await expect(page.locator('.form-mapper')).toBeVisible({ timeout: 30_000 });
            await expect(page.locator('.tree.left-treeview', { hasText: 'parentForm' })).toBeVisible({ timeout: 30_000 });
            await expect(page.locator('.tree.right-treeview', { hasText: 'childForm' })).toBeVisible({ timeout: 30_000 });
            await expect(page.locator('.tree.left-treeview', { hasText: 'childForm' })).toBeVisible({ timeout: 30_000 });
            await expect(page.locator('.tree.right-treeview', { hasText: 'parentForm' })).toBeVisible({ timeout: 30_000 });
            await page.waitForTimeout(700);
            await page.screenshot({
                path: `${screenshotDir}/callactivity-live-parent-to-child-mapper-before-save.png`,
                fullPage: true
            });
            await page.locator('.form-mapper button').first().click();
            await expect(page.locator('.form-mapper')).toBeHidden({ timeout: 10_000 });

            await page.locator('.mapping-actions button').nth(1).click();
            await expect(page.locator('.form-mapper')).toBeVisible({ timeout: 30_000 });
            await expect(page.locator('.tree.left-treeview', { hasText: 'childForm' })).toBeVisible({ timeout: 30_000 });
            await expect(page.locator('.tree.right-treeview', { hasText: 'parentForm' })).toBeVisible({ timeout: 30_000 });
            await expect(page.locator('.tree.left-treeview', { hasText: 'parentForm' })).toBeVisible({ timeout: 30_000 });
            await expect(page.locator('.tree.right-treeview', { hasText: 'childForm' })).toBeVisible({ timeout: 30_000 });
            await page.waitForTimeout(700);
            await page.screenshot({
                path: `${screenshotDir}/callactivity-live-child-to-parent-mapper-before-save.png`,
                fullPage: true
            });
            await page.locator('.form-mapper button').first().click();
            await expect(page.locator('.form-mapper')).toBeHidden({ timeout: 10_000 });

            await page.getByTestId('bpmn-property-panel-save').click();
            await saveDefinitionThroughApp(page);

            await expect
                .poll(
                    async () => {
                        const saved = await readSavedProperties(supabase);
                        return {
                            definition: {
                                parentFormFields: saved.definitionProperties.parentFormFields,
                                childFormFields: saved.definitionProperties.childFormFields,
                                mapperIn: saved.definitionProperties.mapperIn,
                                mapperOut: saved.definitionProperties.mapperOut
                            },
                            bpmn: {
                                parentFormFields: saved.bpmnProperties.parentFormFields,
                                childFormFields: saved.bpmnProperties.childFormFields,
                                mapperIn: saved.bpmnProperties.mapperIn,
                                mapperOut: saved.bpmnProperties.mapperOut
                            }
                        };
                    },
                    { timeout: 30_000 }
                )
                .toEqual({
                    definition: {
                        parentFormFields: nextProperties.parentFormFields,
                        childFormFields: nextProperties.childFormFields,
                        mapperIn: nextProperties.mapperIn,
                        mapperOut: nextProperties.mapperOut
                    },
                    bpmn: {
                        parentFormFields: nextProperties.parentFormFields,
                        childFormFields: nextProperties.childFormFields,
                        mapperIn: nextProperties.mapperIn,
                        mapperOut: nextProperties.mapperOut
                    }
                });

            await page.screenshot({
                path: `${screenshotDir}/callactivity-live-saved-panel.png`,
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
