import { expect, test, type Page } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

/**
 * LIVE e2e — deepagent 프로세스 생성 **전 과정** 검증(bpmn 한정 아님).
 *  로그인 → 딥에이전트 모드 → 전송
 *  → 컨설팅 초안 HITL(승인)            [resume]
 *  → 스킬/에이전트/DMN 후보 HITL(업무에 필요한 후보만 선택) [resume]
 *  → 생성(검증/자동개선 = /validate-and-improve)
 *  → 단일 프로세스 = 단일 탭(중복 없음)
 *  → 산출물 패널: bpmn + markdown + html/form + json 모두 표시
 *  → 각 확장자에 맞는 미리보기 렌더(BPMN diagram / Markdown / HTML·form / pretty JSON)
 *  → 완료 인스턴스 목록에 생성 프로세스 표시(검증 인스턴스 귀속)
 *  → 편집 이동: bpmn→/definitions/{id}, 스킬→/skills/{name}, 에이전트→/agent-chat/{id}
 *  → 저장(draft 승격) → "저장됨"
 *
 * 실행: E2E_LIVE=1 E2E_USER=.. E2E_PASS=.. BASE_URL=http://localhost:8088 \
 *       npx playwright test playwright/e2e/bpmn-artifact/live-deepagent-draft-validate.spec.ts
 */

const LIVE = process.env.E2E_LIVE === '1';
const USER = process.env.E2E_USER;
const PASS = process.env.E2E_PASS;
const RUN_ID = process.env.E2E_RUN_ID || `pg-e2e-${Date.now()}`;
const REQUEST =
    process.env.E2E_REQUEST ||
    `${RUN_ID} 자동차부품 협력사 입고검사 부적합 및 CAPA 프로세스를 만들어줘. ` +
        `부적합 접수·격리·영향도 평가·5-Why 에이전트 분석·시정조치 계획 승인/반려 재작업·조치 실행·효과성 검증·종결 흐름으로 구성하고, ` +
        `현업 입력 폼과 작업별 스킬/에이전트를 만들어줘. 추가 산출물로 운영 가이드 Markdown 파일과 CAPA 종결보고서 HTML 템플릿도 반드시 생성해줘.`;
const ARTIFACT_DIR = process.env.E2E_ARTIFACT_DIR || 'playwright/processgpt-live-artifacts';
const SHOT = join(ARTIFACT_DIR, 'screenshots');
mkdirSync(SHOT, { recursive: true });

function findValidatedDefinition(runId: string): { definitionPath: string; receiptPath: string } | null {
    const root = join(process.cwd(), '..', 'process-gpt-deepagents', 'workspace', '.bpmn');
    if (!existsSync(root)) return null;
    const visit = (dir: string): { definitionPath: string; receiptPath: string } | null => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const full = join(dir, entry.name);
            if (entry.isDirectory()) {
                const found = visit(full);
                if (found) return found;
            } else if (entry.name === 'process-definition.json') {
                const receipt = join(dir, '.process-validation.json');
                if (readFileSync(full, 'utf8').includes(runId) && existsSync(receipt)) {
                    return { definitionPath: full, receiptPath: receipt };
                }
            }
        }
        return null;
    };
    return visit(root);
}

async function login(page: Page) {
    await page.context().clearCookies();
    await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/auth\/login/, { timeout: 30_000 });
    await page.locator('.cp-id input').fill(USER!);
    await page.locator('.cp-pwd input').fill(PASS!);
    const remember = page.getByRole('checkbox').first();
    if ((await remember.count()) > 0 && !(await remember.isChecked())) await remember.check();
    await page.locator('.cp-login').click();
    await expect(page).toHaveURL(/\/definition-map|\/chat|\/main/, { timeout: 60_000 });
}

const realisticValues = [
    'PG-E2E-20260715 협력사 A사 / 품목 QP-417 / LOT 20260715-03',
    '입고검사 120개 중 치수 규격 초과 9개 확인, 불량률 7.5%. 동일 LOT 840개를 B-격리구역으로 이동하고 출하를 보류했습니다.',
    '4M 변경점과 5Why를 교차 검증한 결과 금형 예방보전 주기 누락과 작업표준 개정 미반영을 근본원인으로 확인했습니다.',
    '금형 보전주기를 5만 타발에서 3만 타발로 단축하고, 검사 게이지 MSA·작업자 재교육·표준서 개정을 2026-07-22까지 완료합니다.',
    '조치 후 3개 LOT 360개를 추적 검사하고 불량률 1% 이하, Cpk 1.33 이상을 4주 연속 충족하는지 검증합니다.'
];

async function fillVisibleBusinessForm(page: Page, step: number) {
    const scope = page.locator('.dynamic-form:visible, #kEditor1:visible').last();
    await expect(scope, '현재 사용자 태스크의 상세 입력 폼이 표시되어야 함').toBeVisible({ timeout: 30_000 });
    const text = realisticValues[step % realisticValues.length];

    const textareas = scope.locator('textarea:visible:not([readonly]):not([disabled])');
    for (let i = 0; i < (await textareas.count()); i++) await textareas.nth(i).fill(`${text}\n증빙: 검사성적서, 격리라벨 사진, CAPA 검토기록`);

    const inputs = scope.locator('input:visible:not([readonly]):not([disabled])');
    for (let i = 0; i < (await inputs.count()); i++) {
        const input = inputs.nth(i);
        const type = ((await input.getAttribute('type')) || 'text').toLowerCase();
        if (['checkbox', 'radio', 'file', 'hidden', 'button', 'submit'].includes(type)) continue;
        if (type === 'date') await input.fill('2026-07-22').catch(() => {});
        else if (type === 'datetime-local') await input.fill('2026-07-22T17:00').catch(() => {});
        else if (type === 'number') await input.fill(String(step % 2 ? 9 : 120)).catch(() => {});
        else await input.fill(text).catch(() => {});
    }

    const selects = scope.locator('select:visible:not([disabled])');
    for (let i = 0; i < (await selects.count()); i++) {
        const values = await selects.nth(i).locator('option').evaluateAll((opts) => opts.map((o: any) => o.value).filter(Boolean));
        if (values.length) await selects.nth(i).selectOption(values[0]).catch(() => {});
    }

    const checkboxes = scope.locator('input[type="checkbox"]:visible:not([disabled])');
    for (let i = 0; i < (await checkboxes.count()); i++) if (!(await checkboxes.nth(i).isChecked())) await checkboxes.nth(i).check().catch(() => {});

    const radios = scope.locator('input[type="radio"]:visible:not([disabled])');
    const radioNames = new Set<string>();
    for (let i = 0; i < (await radios.count()); i++) {
        const radio = radios.nth(i);
        const name = (await radio.getAttribute('name')) || `radio-${i}`;
        if (!radioNames.has(name)) {
            radioNames.add(name);
            await radio.check().catch(() => {});
        }
    }
    return text;
}

test.describe('LIVE: 생성 → HITL(resume) → 검증/draft → 산출물(프로세스·스킬·에이전트) → 편집 → 저장', () => {
    test.skip(!LIVE || !USER || !PASS, 'E2E_LIVE=1 + E2E_USER/E2E_PASS 필요(실 서버).');
    test.setTimeout(1_800_000);

    test('전체 흐름', async ({ page }) => {
        let skillLoadError = false;
        let agentLoadError = false;
        page.on('console', (m) => {
            const t = m.text();
            // 편집기 콘텐츠 로드 실패 감지(스킬: getSkillFile null / Skill structure load failed, 에이전트: agent load 실패).
            if (/getSkillFile|Skill structure load failed|스킬.*로드.*실패/i.test(t)) skillLoadError = true;
            if (/agent.*(load|불러).*(fail|실패)|에이전트.*로드.*실패|getAgent.*null/i.test(t)) agentLoadError = true;
            if (/DraftValidate|validate|draft|hitl|에이전트|스킬|Error|오류/i.test(t)) console.log('[browser]', m.type(), t.slice(0, 240));
        });
        page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 200)));
        let validateCalls = 0;
        const validateReports: any[] = []; // /validate-and-improve 응답(실제 엔진 실행 결과 확인용)
        const chatStreamReqs: string[] = [];
        page.on('request', (r) => {
            if (/\/validate-and-improve/.test(r.url())) validateCalls++;
            if (/\/chat\/stream/.test(r.url())) chatStreamReqs.push(r.url());
        });
        page.on('response', (r) => {
            if (/\/validate-and-improve/.test(r.url())) {
                console.log('[validate]', r.status());
                r.json()
                    .then((b) => {
                        validateReports.push(b);
                        console.log(
                            '[validate-report]',
                            JSON.stringify({
                                passed: b?.passed,
                                iterations: b?.iterations,
                                instances: (b?.test_instance_ids || []).length,
                                remaining: (b?.remaining_defects || []).length
                            })
                        );
                    })
                    .catch(() => {});
            }
            if (r.status() >= 400 && !/\/validate-and-improve|get_credit_balance/.test(r.url()))
                console.log('[http]', r.status(), r.request().method(), r.url().slice(0, 110));
        });
        await page.setViewportSize({ width: 1920, height: 1080 });

        await login(page);
        const postLoginUrl = page.url();

        // 완료 인스턴스 baseline 캡처(검증이 실제 엔진 실행으로 '완료' 인스턴스를 1건 이상 추가하는지 delta 로 확인).
        let completedBefore = 0;
        try {
            await page.goto('/list-pages/completed', { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(4_000);
            completedBefore = await page.locator('.completed-instances-style').count();
        } catch {
            /* ignore */
        }
        console.log('[completed-before]', completedBefore);

        // 채팅 페이지(로그인 직후 URL)로 복귀.
        await page.goto(postLoginUrl, { waitUntil: 'domcontentloaded' }).catch(() => {});
        const input = page.locator('.cp-chat textarea').first();
        await expect(input).toBeVisible({ timeout: 30_000 });

        // 딥에이전트 모드 선택
        const select = page.locator('.orchestration-select').first();
        await expect(select, '메인 채팅 orchestration 선택기가 보여야 함').toBeVisible({ timeout: 30_000 });
        await select.click();
        // Vuetify v-select 항목은 환경에 따라 role=option이 아니라 list item으로 렌더된다.
        // 실제 열린 overlay 안에서 선택하고, 전송 전에 표시값까지 검증해 기본 에이전트 오실행을 막는다.
        const deepOption = page
            .locator('.v-overlay-container .v-list-item, .v-overlay-container [role="option"]')
            .filter({ hasText: /딥\s*에이전트|deep\s*agent/i })
            .last();
        await expect(deepOption, '딥에이전트 선택 항목이 보여야 함').toBeVisible({ timeout: 10_000 });
        await deepOption.click();
        await expect(select, '메시지 전송 전 딥에이전트가 실제 선택되어야 함').toContainText(/딥\s*에이전트|deep\s*agent/i);
        await input.click();
        await input.fill(REQUEST);
        await input.press('Enter');

        const failRe = /오류가 발생|검증을 통과하지 못|validation failed|tenant_git_config|APIError|PGRST205|Could not find the table|unhashable/i;
        let sawApproveHitl = false;
        let sawCheckboxHitl = false;
        let sawError = false;
        let appeared = false;
        let done = false;
        let reloadedAfterDone = false;
        const handledHitlPanels = new Set<string>();
        const candidateLabels = new Set<string>(); // 선택한 후보 라벨([스킬]/[에이전트]/[DMN] ...)
        const filesPanel = page.locator('.ws-files').first();
        const fileItems = page.locator('.ws-files__item');
        const doneText = page.locator('.ai-message-bubble', { hasText: /확인 후 저장|저장 버튼을 눌러|저장이 완료/ }).first();

        // ── 1) HITL 루프: 컨설팅 승인 + 후보 체크 → 제출 ──
        // 실제 3개 분기 엔진 검증은 로컬 polling 부하에 따라 30분 이상 걸릴 수 있다.
        // 업무상 필요한 후보만 생성하고 오류를 즉시 감지한다. 전체 생성 대기는 최대 10분이다.
        for (let i = 0; i < 120; i++) {
            try {
                const bubbleLocator = page.locator('.ai-message-bubble');
                const bubbleCount = await bubbleLocator.count();
                const start = Math.max(0, bubbleCount - 4);
                const bubbles: string[] = [];
                for (let b = start; b < bubbleCount; b++) bubbles.push(await bubbleLocator.nth(b).innerText());
                if (bubbles.some((t) => failRe.test(t))) sawError = true;
            } catch {
                /* ignore */
            }
            try {
                // ArtifactPanel keeps inactive tabs mounted but hidden. File generation
                // is complete when the items exist; tab visibility is a separate UI state.
                if ((await filesPanel.count()) > 0 && (await fileItems.count()) >= 1) appeared = true;
                if ((await doneText.count()) > 0 && (await doneText.isVisible())) done = true;
            } catch {
                /* ignore */
            }

            const panel = page.locator('.hitl-feedback-wrap, .human-feedback-panel').last();
            try {
                if ((await panel.count()) > 0 && (await panel.isVisible().catch(() => false))) {
                    const items = panel.locator('.human-feedback-panel__item');
                    const approve = panel.getByRole('button', { name: /^\s*승인\s*$/ }).first();
                    const submit = panel.getByRole('button', { name: /응답\s*제출/ }).first();
                    const itemCount = await items.count();
                    const question = ((await panel.locator('.human-feedback-panel__question').first().innerText().catch(() => '')) || '').trim();
                    const fingerprint = `${itemCount}:${question}`;
                    const shouldHandleHitl = !handledHitlPanels.has(fingerprint);
                    if (shouldHandleHitl && itemCount > 0) {
                        sawCheckboxHitl = true;
                        for (let k = 0; k < itemCount; k++) {
                            const it = items.nth(k);
                            const label = ((await it.innerText().catch(() => '')) || '').trim();
                            const wanted = /CAPA 계획서|5-Why 분석|gw_capa|gw_effectiveness/i.test(label);
                            const cls = ((await it.getAttribute('class')) || '').toString();
                            const selected = cls.includes('is-selected');
                            if (wanted) candidateLabels.add(label);
                            if (selected !== wanted) {
                                await it.scrollIntoViewIfNeeded().catch(() => {});
                                await it.click({ timeout: 4_000 }).catch(() => {});
                                await page.waitForTimeout(120);
                            }
                        }
                    } else if (shouldHandleHitl && (await approve.count()) > 0 && (await approve.isVisible())) {
                        sawApproveHitl = true;
                        await approve.click({ timeout: 4_000 }).catch(() => {});
                        await page.waitForTimeout(250);
                    }
                    if (shouldHandleHitl && (await submit.count()) > 0) {
                        handledHitlPanels.add(fingerprint);
                        await submit.scrollIntoViewIfNeeded().catch(() => {});
                        await submit.click({ timeout: 8_000 }).catch(() => {});
                        await page.waitForTimeout(6_000);
                    }
                }
            } catch {
                /* ignore */
            }

            if (sawError) break;
            if (done && !appeared && !reloadedAfterDone) {
                reloadedAfterDone = true;
                await page.reload({ waitUntil: 'domcontentloaded' });
                await page.waitForTimeout(4_000);
                continue;
            }
            if (done && appeared) break;
            await page.waitForTimeout(5_000);
        }

        await page.screenshot({ path: `${SHOT}/ff-01-generated.png` });
        console.log('[hitl-summary]', JSON.stringify({ sawApproveHitl, sawCheckboxHitl, sawError, appeared, done }));

        expect(sawError, '생성 중 오류(tenant_git_config/unhashable 등)가 없어야 함').toBeFalsy();
        expect(sawApproveHitl, '컨설팅 초안이 승인/반려 HITL 패널로 표시(resume)되어야 함').toBeTruthy();
        expect(sawCheckboxHitl, '스킬/에이전트/DMN 후보가 체크박스 HITL 패널로 표시되어야 함').toBeTruthy();
        expect(appeared, '우측 작업폴더(.ws-files)에 산출물이 떠야 함').toBeTruthy();

        // ── 2) 단일 프로세스 = 단일 탭(중복 생성 없음) ──
        await page.waitForTimeout(3_000);
        const tabLabels = await page
            .locator('.artifact-panel__tab .artifact-panel__tab-label')
            .allInnerTexts()
            .catch(() => []);
        const procTabs = tabLabels.map((t) => t.trim()).filter((t) => t && !/산출물\s*파일/.test(t));
        console.log('[tabs]', JSON.stringify(tabLabels), '→ process tabs:', procTabs.length);
        const uniqueProcTabs = Array.from(new Set(procTabs));
        expect(uniqueProcTabs.length, `단일 프로세스는 탭 1개여야 함(중복 생성 회귀 감지). tabs=${JSON.stringify(tabLabels)}`).toBe(1);
        expect(
            tabLabels.map((label) => label.trim()).filter((label) => /^산출물\s*파일$/.test(label)),
            `default 그룹은 늦게 확정된 process-* 그룹에 병합되어야 함. tabs=${JSON.stringify(tabLabels)}`
        ).toHaveLength(0);

        const staleUpdateStatus = page.locator('.ai-message-bubble').filter({
            hasText: /update_process_definition\s+실행\s*중/i
        });
        await expect(
            staleUpdateStatus,
            '완료된 update_process_definition이 채팅 본문에 실행 중으로 남아있지 않아야 함'
        ).toHaveCount(0);

        // ── 3) 산출물: bpmn 은 항상, 스킬/에이전트는 **선택됐을 때만** 표시되어야 한다(스킬은 조건부 — 모델 변동).
        const itemNames = await page
            .locator('.ws-files__item-name')
            .allInnerTexts()
            .catch(() => []);
        const names = itemNames.map((t) => t.trim());
        console.log('[artifacts]', JSON.stringify(names));
        expect(new Set(names).size, `같은 논리 산출물은 한 번만 표시되어야 함: ${JSON.stringify(names)}`).toBe(names.length);
        const skillNames = names.filter((n) => /SKILL\.md$/i.test(n));
        const agentNames = names.filter((n) => /^agent\//i.test(n) || /agents\.json$/i.test(n));
        const markdownNames = names.filter((n) => /\.md$/i.test(n));
        const htmlNames = names.filter((n) => /\.html?$/i.test(n));
        const formNames = names.filter((n) => /\.form$/i.test(n));
        const hasBpmn = names.some((n) => /\.bpmn$/i.test(n));
        expect(hasBpmn, 'bpmn 산출물이 표시되어야 함').toBeTruthy();
        expect(markdownNames.length, 'Markdown 산출물이 목록에 표시되어야 함').toBeGreaterThan(0);
        expect(htmlNames.length, '요청한 HTML 산출물이 목록에 표시되어야 함').toBeGreaterThan(0);
        expect(formNames.length, 'ProcessGPT .form 산출물이 목록에 표시되어야 함').toBeGreaterThan(0);
        expect(agentNames.length, 'JSON 에이전트 산출물이 목록에 표시되어야 함').toBeGreaterThan(0);

        // ── 3-b) 선택한 후보가 모두 생성되었는지(누락 금지) — 선택 개수 ≤ 생성 개수 ──
        const labels = Array.from(candidateLabels);
        const selSkills = labels.filter((l) => /\[\s*스킬\s*\]/.test(l));
        const selAgents = labels.filter((l) => /\[\s*에이전트\s*\]/.test(l));
        console.log('[selected]', JSON.stringify({ skills: selSkills, agents: selAgents }));
        expect(
            skillNames.length,
            `선택한 스킬 ${selSkills.length}개가 모두 SKILL.md 로 생성되어야 함(생성 ${skillNames.length}개)`
        ).toBeGreaterThanOrEqual(selSkills.length);
        expect(
            agentNames.length,
            `선택한 에이전트 ${selAgents.length}개가 모두 개별 json 으로 생성되어야 함(생성 ${agentNames.length}개)`
        ).toBeGreaterThanOrEqual(selAgents.length);
        // 후보가 하나도 안 떴거나(드묾) 스킬·에이전트 둘 다 0 이면 편집기 검증이 무의미 → 최소 1종은 있어야 함.
        expect(skillNames.length + agentNames.length, '스킬 또는 에이전트 산출물이 최소 1개는 있어야 함').toBeGreaterThan(0);

        // ── 4) 검증/자동개선 호출 + settle ──
        const validatingChip = page.locator('.ws-files__header', { hasText: /검증 중/ });
        for (let i = 0; i < 60; i++) {
            const validating = (await validatingChip.count()) > 0 && (await validatingChip.isVisible().catch(() => false));
            if (!validating) break;
            await page.waitForTimeout(4_000);
        }
        await page.screenshot({ path: `${SHOT}/ff-02-validated.png` });
        console.log('[validate-calls]', validateCalls);
        expect(validateCalls, '/validate-and-improve 가 1회 이상 호출(제시 전 자동 검증)').toBeGreaterThan(0);

        // 검증 응답으로 **실제 실행엔진 실행**을 확인(정적 검사만이 아님):
        // 엔진이 인스턴스를 실제로 생성/진행해야 한다(skipped=false + test_instance_ids>0).
        // (passed 는 프로세스 품질·LLM 자동개선 결과에 따라 true/false 가 될 수 있으므로 통과 조건으로 쓰지 않는다.)
        await page.waitForTimeout(2_000);
        console.log(
            '[validate-reports]',
            JSON.stringify(
                validateReports.map((b) => ({
                    passed: b?.passed,
                    skipped: b?.skipped,
                    instances: (b?.test_instance_ids || []).length,
                    skip_reason: b?.skip_reason
                }))
            )
        );
        const ranReport = validateReports.find((b) => b && b.skipped !== true && (b.test_instance_ids || []).length > 0);
        expect(
            ranReport,
            '검증이 실제 실행엔진으로 인스턴스를 생성·실행해야 함(skipped 아님 + test_instance_ids>0) — 정적 검사만이 아님'
        ).toBeTruthy();

        const roomUrl = page.url();
        let definitionUrl = '';

        // 여러 탭(프로세스 + '산출물 파일')이 모두 mount 되어 있으므로 보이는(active) 패널로 스코프한다.
        // 프로세스 탭을 활성화하고, 그 안의 산출물만 조작한다(strict-mode 다중매칭 방지).
        const activateProcTab = async () => {
            const procTab = page
                .locator('.artifact-panel__tab')
                .filter({ hasNotText: /산출물\s*파일/ })
                .first();
            if (await procTab.count()) await procTab.click().catch(() => {});
            await page.waitForTimeout(600);
        };
        const vis = '.artifact-panel__content:visible ';
        await activateProcTab();

        // ── 5) 확장자별 viewer 미리보기 렌더 확인 ──
        const bpmnItem = page.locator(`${vis}.ws-files__item`, { hasText: /\.bpmn/ }).first();
        await bpmnItem.click();
        await page.waitForTimeout(1500);
        const preview = page.locator(`${vis}.ws-files__preview`).first();
        await expect(preview, 'bpmn 미리보기 영역이 보여야 함').toBeVisible({ timeout: 15_000 });
        await expect(preview.locator('[data-viewer-kind="bpmn"]'), 'BPMN은 diagram viewer로 표시되어야 함').toBeVisible();
        await expect(preview.locator('.djs-container, .bjs-container').first(), 'BPMN diagram canvas가 렌더되어야 함').toBeVisible({
            timeout: 20_000
        });
        await page.screenshot({ path: `${SHOT}/ff-03-preview.png` });

        const markdownItem = page.locator(`${vis}.ws-files__item`).filter({ hasText: /\.md/i }).first();
        await markdownItem.click();
        const markdownViewer = preview.locator('[data-viewer-kind="markdown"]');
        await expect(markdownViewer, 'Markdown은 렌더링된 문서 viewer로 표시되어야 함').toBeVisible({ timeout: 15_000 });
        await expect(markdownViewer.locator('h1, h2, h3, p, li').first(), 'Markdown 문서 요소가 렌더되어야 함').toBeVisible();

        const htmlItem = page.locator(`${vis}.ws-files__item`).filter({ hasText: /\.html?/i }).first();
        await htmlItem.click();
        const htmlViewer = preview.locator('[data-viewer-kind="html"]');
        await expect(htmlViewer, 'HTML은 렌더링된 문서 viewer로 표시되어야 함').toBeVisible({ timeout: 15_000 });
        expect((await htmlViewer.innerText()).trim().length, 'HTML 미리보기에 실제 내용이 있어야 함').toBeGreaterThan(10);

        const formItem = page.locator(`${vis}.ws-files__item`).filter({ hasText: /\.form/i }).first();
        await formItem.click();
        const formViewer = preview.locator('[data-viewer-kind="form"]');
        await expect(formViewer, '.form은 DynamicForm viewer로 표시되어야 함').toBeVisible({ timeout: 15_000 });
        await expect(formViewer.locator('input, textarea, select, .dynamic-form').first(), '폼 입력 컴포넌트가 렌더되어야 함').toBeVisible();

        const jsonItem = page.locator(`${vis}.ws-files__item`).filter({ hasText: /agent\/|agents\.json/i }).first();
        await jsonItem.click();
        const jsonViewer = preview.locator('[data-viewer-kind="json"]');
        await expect(jsonViewer, 'JSON은 pretty JSON viewer로 표시되어야 함').toBeVisible({ timeout: 15_000 });
        const prettyJson = (await jsonViewer.innerText()).trim();
        expect(() => JSON.parse(prettyJson), 'JSON viewer 내용은 유효하고 들여쓰기된 JSON이어야 함').not.toThrow();
        expect(prettyJson, 'JSON viewer는 들여쓰기를 적용해야 함').toContain('\n  ');
        await page.screenshot({ path: `${SHOT}/ff-03b-format-viewers.png` });

        // 편집 이동 검증을 위해 BPMN을 다시 선택한다.
        await bpmnItem.click();
        await expect(preview.locator('[data-viewer-kind="bpmn"]')).toBeVisible({ timeout: 15_000 });

        // ── 6) bpmn 편집 → /definitions/{id} (draft) ──
        const editBtn = page
            .locator(`${vis}.hwpx-viewer`)
            .getByRole('button', { name: /^\s*편집\s*$/ })
            .first();
        await expect(editBtn, 'bpmn 미리보기에 편집 버튼이 있어야 함').toBeVisible({ timeout: 15_000 });
        await editBtn.click();
        await page.waitForURL(/\/definitions\//, { timeout: 20_000 });
        definitionUrl = page.url();
        console.log('[edit-nav-bpmn]', page.url());
        expect(page.url(), 'bpmn 편집 → /definitions/{id}').toMatch(/\/definitions\//);
        await page.goto(roomUrl, { waitUntil: 'domcontentloaded' });
        await expect(filesPanel).toBeVisible({ timeout: 30_000 });
        await activateProcTab();

        // ── 7) 스킬 편집 → /skills/{name} (스킬 산출물이 있을 때만) ──
        if (skillNames.length > 0) {
            const skillItem = page.locator(`${vis}.ws-files__item`, { hasText: /SKILL\.md/ }).first();
            await skillItem.click();
            await page.waitForTimeout(1200);
            const skillEdit = page
                .locator(`${vis}.hwpx-viewer`)
                .getByRole('button', { name: /^\s*편집\s*$/ })
                .first();
            await expect(skillEdit, '스킬 미리보기에 편집 버튼이 있어야 함').toBeVisible({ timeout: 15_000 });
            skillLoadError = false;
            await skillEdit.click();
            await page.waitForURL(/\/skills\//, { timeout: 20_000 });
            console.log('[edit-nav-skill]', page.url());
            expect(page.url(), '스킬 편집 → /skills/{name}').toMatch(/\/skills\//);
            // 편집기에서 draft 스킬 내용이 로드되어야 함(getSkillFile null 등 로드 실패 없음).
            await page.waitForTimeout(4_000);
            await page.screenshot({ path: `${SHOT}/ff-06-skill-editor.png` });
            expect(skillLoadError, 'draft 스킬이 편집기에서 로드되어야 함(스킬 파일 로드 실패 없음)').toBeFalsy();
            await page.goto(roomUrl, { waitUntil: 'domcontentloaded' });
            await expect(filesPanel).toBeVisible({ timeout: 30_000 });
            await activateProcTab();
        } else {
            console.log('[edit-nav-skill] (이 run 은 스킬 산출물 없음 — 편집기 검증 생략)');
        }

        // ── 8) 에이전트 편집 → /agent-chat/{id} (에이전트 산출물이 있을 때만) ──
        if (agentNames.length > 0) {
            const agentItem = page.locator(`${vis}.ws-files__item`, { hasText: /agent\/|agents\.json/ }).first();
            await agentItem.click();
            await page.waitForTimeout(1200);
            const agentEdit = page
                .locator(`${vis}.hwpx-viewer`)
                .getByRole('button', { name: /^\s*편집\s*$/ })
                .first();
            await expect(agentEdit, '에이전트 미리보기에 편집 버튼이 있어야 함').toBeVisible({ timeout: 15_000 });
            agentLoadError = false;
            await agentEdit.click();
            await page.waitForURL(/\/agent-chat\//, { timeout: 20_000 });
            const agentUrl = page.url();
            console.log('[edit-nav-agent]', agentUrl);
            expect(agentUrl, '에이전트 편집 → /agent-chat/{id}').toMatch(/\/agent-chat\//);
            // editTarget 이 결정적 uuid 를 써야 함(슬러그 금지) → draft 저장된 에이전트와 id 일치 → 편집기 로드.
            expect(agentUrl, '에이전트 id 가 uuid 여야 draft 에이전트를 로드함').toMatch(
                /\/agent-chat\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
            );
            await page.waitForTimeout(4_000);
            await page.screenshot({ path: `${SHOT}/ff-07-agent-editor.png` });
            expect(agentLoadError, 'draft 에이전트가 편집기에서 로드되어야 함(에이전트 로드 실패 없음)').toBeFalsy();
            await page.goto(roomUrl, { waitUntil: 'domcontentloaded' });
            await expect(filesPanel).toBeVisible({ timeout: 30_000 });
            await activateProcTab();
        } else {
            console.log('[edit-nav-agent] (이 run 은 에이전트 산출물 없음 — 편집기 검증 생략)');
        }

        // ── 9) 완료 인스턴스 목록(검증 인스턴스 귀속) ──
        await page.goto('/list-pages/completed', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(5_000);
        const rows = page.locator('.completed-instances-style');
        const cnt = await rows.count();
        console.log('[completed-instances]', cnt, 'before:', completedBefore, 'delta:', cnt - completedBefore);
        await page.screenshot({ path: `${SHOT}/ff-04-completed.png` });
        // 목록은 페이지네이션(상위 N)일 수 있어 개수 증가가 항상 보이진 않는다 → 존재만 확인(실제 엔진 실행은 위 validate-report 로 단언).
        expect(cnt, '완료 인스턴스 목록이 표시되어야 함').toBeGreaterThan(0);
        await page.goto(roomUrl, { waitUntil: 'domcontentloaded' });
        await expect(filesPanel).toBeVisible({ timeout: 30_000 });

        // ── 10) 저장(draft 승격) → "저장됨" ──
        const saveBtn = page
            .locator(`${vis}.ws-files__header`)
            .getByRole('button', { name: /저장|저장됨/ })
            .first();
        await expect(saveBtn).toBeEnabled({ timeout: 30_000 });
        await saveBtn.click();
        await page.waitForTimeout(8_000);
        await page.screenshot({ path: `${SHOT}/ff-05-saved.png` });
        const saveErr = page.locator(`${vis}.ws-files__truncated`, { hasText: /실패|error/i });
        const errText = (await saveErr.count()) > 0 ? await saveErr.first().innerText() : '';
        expect(errText, `저장 에러: ${errText}`).toBe('');
        const savedBadge = page.locator(`${vis}.ws-files__header`).getByRole('button', { name: /저장됨/ });
        expect(await savedBadge.count(), '저장 후 "저장됨" 표시').toBeGreaterThan(0);

        // ── 11) 새로고침 복원: 내부 JSON은 숨기고 bpmn/스킬/에이전트는 중복 없이 유지 ──
        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(filesPanel).toBeVisible({ timeout: 30_000 });
        await activateProcTab();
        const restoredTabLabels = await page
            .locator('.artifact-panel__tab .artifact-panel__tab-label')
            .allInnerTexts()
            .catch(() => []);
        expect(
            restoredTabLabels.map((label) => label.trim()).filter((label) => /^산출물\s*파일$/.test(label)),
            `새로고침 후에도 default 탭이 부활하지 않아야 함. tabs=${JSON.stringify(restoredTabLabels)}`
        ).toHaveLength(0);
        await expect(
            page.locator('.ai-message-bubble').filter({ hasText: /update_process_definition\s+실행\s*중/i }),
            '새로고침 후에도 완료된 도구가 실행 중으로 복원되지 않아야 함'
        ).toHaveCount(0);
        const restoredNames = (await page.locator(`${vis}.ws-files__item-name`).allInnerTexts()).map((n) => n.trim());
        expect(restoredNames.some((n) => /\.bpmn$/i.test(n)), '새로고침 후에도 .bpmn 산출물이 유지되어야 함').toBeTruthy();
        expect(restoredNames.some((n) => /process-definition\.json|manifest\.json/i.test(n)), '내부 JSON은 목록에서 숨겨야 함').toBeFalsy();
        expect(new Set(restoredNames).size, `업로드/복원 산출물 중복 금지: ${JSON.stringify(restoredNames)}`).toBe(restoredNames.length);
        expect(restoredNames.filter((n) => /SKILL\.md$/i.test(n)).length).toBeGreaterThanOrEqual(skillNames.length);
        expect(restoredNames.filter((n) => /^agent\//i.test(n)).length).toBeGreaterThanOrEqual(agentNames.length);
        await page.screenshot({ path: `${SHOT}/ff-08-restored.png` });

        // ── 12) 정의체계도에서 방금 저장한 프로세스를 선택하고 실제 실행 ──
        const definitionId = definitionUrl.match(/\/definitions\/([^?/#]+)/)?.[1] || '';
        expect(definitionId, '저장된 프로세스 정의 ID를 확보해야 함').not.toBe('');
        const processName = uniqueProcTabs[0];
        const savedRecord = await page.evaluate(async (id) => {
            const supabase = (window as any).$supabase;
            const { data, error } = await supabase.from('proc_def').select('definition,bpmn').eq('id', id).single();
            if (error) throw new Error(error.message);
            return data || null;
        }, definitionId);
        const savedDefinition = savedRecord?.definition;
        expect(savedDefinition, '저장된 프로세스 정의 JSON을 조회할 수 있어야 함').toBeTruthy();
        expect(savedRecord?.bpmn, '저장된 최종 BPMN XML을 조회할 수 있어야 함').toContain('definitions');

        const validatedBundle = findValidatedDefinition(RUN_ID);
        expect(validatedBundle, '최종 정의와 실행엔진 검증 영수증을 찾을 수 있어야 함').toBeTruthy();
        const validatedBytes = readFileSync(validatedBundle!.definitionPath);
        const validationReceipt = JSON.parse(readFileSync(validatedBundle!.receiptPath, 'utf8'));
        expect(validationReceipt.passed).toBe(true);
        expect(validationReceipt.engine_validated).toBe(true);
        expect(validationReceipt.definition_sha256).toBe(createHash('sha256').update(validatedBytes).digest('hex'));
        writeFileSync(join(ARTIFACT_DIR, 'validated-process-definition.json'), validatedBytes);
        writeFileSync(join(ARTIFACT_DIR, 'final-process-definition.json'), JSON.stringify(savedDefinition, null, 2), 'utf8');
        writeFileSync(join(ARTIFACT_DIR, 'final-process.bpmn'), String(savedRecord.bpmn), 'utf8');
        writeFileSync(join(ARTIFACT_DIR, 'validation-receipt.json'), JSON.stringify(validationReceipt, null, 2), 'utf8');
        const elements = Array.isArray(savedDefinition?.elements)
            ? savedDefinition.elements
            : [
                  ...(savedDefinition?.events || []),
                  ...(savedDefinition?.activities || []),
                  ...(savedDefinition?.gateways || []),
                  ...(savedDefinition?.sequences || [])
              ];
        const activities = elements.filter((e: any) => /activity|task/i.test(String(e?.type || '')));
        const gateways = elements.filter((e: any) => /gateway/i.test(String(e?.type || '')));
        const sequences = elements.filter((e: any) => /sequence/i.test(String(e?.type || '')) || (e?.source && e?.target));
        const activityNames = activities.map((a: any) => String(a?.name || '')).join(' ');
        expect(activities.length, '현업 CAPA 흐름은 7개 이상의 실행 태스크가 필요함').toBeGreaterThanOrEqual(7);
        expect(gateways.length, '승인/반려 및 효과검증 분기 게이트웨이가 필요함').toBeGreaterThanOrEqual(2);
        expect(sequences.length, '모든 태스크가 시작부터 종료까지 연결되어야 함').toBeGreaterThanOrEqual(activities.length);
        expect(activityNames).toMatch(/부적합/);
        expect(activityNames).toMatch(/격리/);
        expect(activityNames).toMatch(/원인|5Why/i);
        expect(activityNames).toMatch(/조치/);
        expect(activityNames).toMatch(/검증/);
        expect(activityNames).toMatch(/종결/);
        const configuredAgentTasks = activities.filter(
            (a: any) => /deep|complete|agent/i.test(String(a?.agent_mode || a?.agentMode || a?.agent_orch || a?.agentOrch || ''))
        );
        expect(configuredAgentTasks.length, '분석/검토 태스크에 딥에이전트 또는 완성 모드 설정이 필요함').toBeGreaterThan(0);
        await page.goto('/definition-map', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(4_000);
        const mapProcess = page.locator('.sub-process-style h6', { hasText: processName }).first();
        await expect(mapProcess, `정의체계도에 저장한 프로세스가 보여야 함: ${processName}`).toBeVisible({ timeout: 30_000 });
        await mapProcess.click();
        await page.waitForURL(new RegExp(`/definition-map/sub/${definitionId}`), { timeout: 30_000 });
        const executeButton = page.getByRole('button', { name: /^실행$/ }).first();
        await expect(executeButton).toBeVisible({ timeout: 30_000 });
        await executeButton.click();

        // ── 13) 시작 폼에 현업 데이터를 입력하고 제출; 인스턴스 화면으로 이동 ──
        const firstInput = await fillVisibleBusinessForm(page, 0);
        await page.screenshot({ path: `${SHOT}/ff-09-first-form.png` });
        const firstSubmit = page.getByRole('button', { name: /제출.*완료|완료.*제출/ }).first();
        await expect(firstSubmit).toBeEnabled({ timeout: 30_000 });
        await firstSubmit.click();
        await page.waitForURL(/\/instancelist\//, { timeout: 60_000 });
        const instanceUrl = page.url();
        await page.waitForTimeout(4_000);
        await expect(page.getByTestId('instance-status')).toHaveText(/RUNNING|COMPLETED/, { timeout: 30_000 });

        // 첫 태스크 입력값이 완료 태스크의 읽기 전용 폼에 유지되는지 확인한다.
        const completedColumn = page.locator('.kanban-column', { has: page.getByRole('heading', { name: '완료됨' }) });
        const completedCard = completedColumn.locator('.todo-task-item-card-style').first();
        if ((await completedCard.count()) > 0) {
            await completedCard.click();
            await page.waitForURL(/\/todolist\//, { timeout: 30_000 });
            await expect(page.locator('body')).toContainText(firstInput.slice(0, 20), { timeout: 30_000 });
            await page.goto(instanceUrl, { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(3_000);
        }

        // ── 14) 사람 태스크는 폼을 채워 제출하고, 에이전트 태스크는 자동 완료와 스킬/MCP 로그를 확인 ──
        let humanTasksCompleted = 1;
        let agentTaskObserved = false;
        let executionLogObserved = false;
        for (let cycle = 0; cycle < 24; cycle++) {
            await page.goto(instanceUrl, { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(4_000);
            const titleText = await page.locator('.instance-card-title').innerText().catch(() => '');
            if (/COMPLETED/.test(titleText)) break;

            const runningColumn = page.locator('.kanban-column', { has: page.getByRole('heading', { name: '진행 중' }) });
            const cards = runningColumn.locator('.todo-task-item-card-style');
            if ((await cards.count()) === 0) {
                await page.waitForTimeout(6_000);
                continue;
            }
            const card = cards.first();
            const cardText = await card.innerText();
            if (/에이전트|딥에이전트|완성 모드|작업 중|처리 중/.test(cardText)) agentTaskObserved = true;

            await card.click();
            await page.waitForURL(/\/todolist\//, { timeout: 30_000 });
            await page.waitForTimeout(3_000);
            const bodyText = await page.locator('body').innerText();
            if (/스킬|커넥터|MCP|도구 실행|tool/i.test(bodyText)) executionLogObserved = true;
            const submit = page.getByRole('button', { name: /제출.*완료|완료.*제출/ }).first();
            if ((await submit.count()) > 0 && (await submit.isVisible().catch(() => false))) {
                await fillVisibleBusinessForm(page, humanTasksCompleted);
                await submit.click();
                humanTasksCompleted++;
                await page.waitForURL(/\/instancelist\//, { timeout: 60_000 }).catch(() => {});
            } else {
                // 자동 에이전트 태스크: 완료 서비스가 결과를 반영할 시간을 준다.
                await page.waitForTimeout(12_000);
            }
        }

        await page.goto(instanceUrl, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(5_000);
        await page.screenshot({ path: `${SHOT}/ff-10-process-completed.png` });
        await expect(page.locator('.instance-card-title')).toContainText('COMPLETED', { timeout: 30_000 });
        expect(humanTasksCompleted, '복수의 실제 사용자 폼 태스크를 제출해야 함').toBeGreaterThan(1);
        expect(agentTaskObserved, '에이전트를 활용하는 태스크가 실행 흐름에서 관찰되어야 함').toBeTruthy();
        expect(executionLogObserved, '에이전트 태스크에서 사용한 스킬/MCP/도구 실행 로그가 사용자에게 보여야 함').toBeTruthy();

        console.log('[done] 생성→복원→실행→완료 전체 흐름 통과', {
            chatStreamRequests: chatStreamReqs.length,
            processName,
            definitionId,
            humanTasksCompleted,
            agentTaskObserved,
            executionLogObserved
        });
        writeFileSync(
            join(ARTIFACT_DIR, 'summary.json'),
            JSON.stringify(
                {
                    runId: process.env.E2E_RUN_ID || '',
                    passed: true,
                    processName,
                    definitionId,
                    instanceUrl,
                    selectedSkills: selSkills,
                    selectedAgents: selAgents,
                    visibleArtifacts: restoredNames,
                    humanTasksCompleted,
                    agentTaskObserved,
                    executionLogObserved,
                    validateCalls,
                    chatStreamRequests: chatStreamReqs.length
                },
                null,
                2
            ),
            'utf8'
        );
    });
});
