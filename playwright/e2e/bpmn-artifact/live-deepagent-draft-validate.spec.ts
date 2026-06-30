import { expect, test, type Page } from '@playwright/test';

/**
 * LIVE e2e — deepagent 프로세스 생성 **전 과정** 검증(bpmn 한정 아님).
 *  로그인 → 딥에이전트 모드 → 전송
 *  → 컨설팅 초안 HITL(승인)            [resume]
 *  → 스킬/에이전트/DMN 후보 HITL(모두 체크) [resume]
 *  → 생성(검증/자동개선 = /validate-and-improve)
 *  → 단일 프로세스 = 단일 탭(중복 없음)
 *  → 산출물 패널: bpmn + 스킬(SKILL.md) + 에이전트(agents.json) 모두 표시
 *  → 미리보기 렌더(bpmn)
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
const REQUEST = process.env.E2E_REQUEST || '휴가 신청 프로세스 만들어줘';
const SHOT = 'playwright/live-shots';

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

test.describe('LIVE: 생성 → HITL(resume) → 검증/draft → 산출물(프로세스·스킬·에이전트) → 편집 → 저장', () => {
    test.skip(!LIVE || !USER || !PASS, 'E2E_LIVE=1 + E2E_USER/E2E_PASS 필요(실 서버).');
    test.setTimeout(1_200_000);

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
                        console.log('[validate-report]', JSON.stringify({ passed: b?.passed, iterations: b?.iterations, instances: (b?.test_instance_ids || []).length, remaining: (b?.remaining_defects || []).length }));
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
        if ((await select.count()) > 0) {
            try {
                await select.click();
                const deepOption = page.getByRole('option', { name: /딥|deep/i }).first();
                if (await deepOption.count()) {
                    await deepOption.click();
                    await page.waitForTimeout(500);
                }
            } catch {
                /* ignore */
            }
        }
        await input.click();
        await input.fill(REQUEST);
        await input.press('Enter');

        const failRe = /오류가 발생|tenant_git_config|APIError|PGRST205|Could not find the table|unhashable/;
        let sawApproveHitl = false;
        let sawCheckboxHitl = false;
        let sawError = false;
        let appeared = false;
        let done = false;
        const candidateLabels = new Set<string>(); // 선택한 후보 라벨([스킬]/[에이전트]/[DMN] ...)
        const filesPanel = page.locator('.ws-files').first();
        const fileItems = page.locator('.ws-files__item');
        const doneText = page.locator('.ai-message-bubble', { hasText: /확인 후 저장|저장 버튼을 눌러|저장이 완료/ }).first();

        // ── 1) HITL 루프: 컨설팅 승인 + 후보 체크 → 제출 ──
        for (let i = 0; i < 100; i++) {
            try {
                const bubbles = await page.locator('.ai-message-bubble').allInnerTexts();
                if (bubbles.some((t) => failRe.test(t))) sawError = true;
            } catch {
                /* ignore */
            }
            try {
                if ((await filesPanel.count()) > 0 && (await filesPanel.isVisible())) {
                    if ((await fileItems.count()) >= 1) appeared = true;
                }
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
                    if (itemCount > 0) {
                        sawCheckboxHitl = true;
                        for (let k = 0; k < itemCount; k++) {
                            const it = items.nth(k);
                            const label = ((await it.innerText().catch(() => '')) || '').trim();
                            if (label) candidateLabels.add(label);
                            const cls = ((await it.getAttribute('class')) || '').toString();
                            if (cls.includes('is-selected')) continue;
                            await it.scrollIntoViewIfNeeded().catch(() => {});
                            await it.click({ timeout: 4_000 }).catch(() => {});
                            await page.waitForTimeout(120);
                        }
                    } else if ((await approve.count()) > 0 && (await approve.isVisible())) {
                        sawApproveHitl = true;
                        await approve.click({ timeout: 4_000 }).catch(() => {});
                        await page.waitForTimeout(250);
                    }
                    if ((await submit.count()) > 0) {
                        await submit.scrollIntoViewIfNeeded().catch(() => {});
                        await submit.click({ timeout: 8_000 }).catch(() => {});
                        await page.waitForTimeout(6_000);
                    }
                }
            } catch {
                /* ignore */
            }

            if (sawError) break;
            if (done && appeared) break;
            if (i % 4 === 0) await page.screenshot({ path: `${SHOT}/df-poll-${String(i).padStart(2, '0')}.png` }).catch(() => {});
            await page.waitForTimeout(11_000);
        }

        await page.screenshot({ path: `${SHOT}/ff-01-generated.png`, fullPage: true });
        console.log('[hitl-summary]', JSON.stringify({ sawApproveHitl, sawCheckboxHitl, sawError, appeared, done }));

        expect(sawError, '생성 중 오류(tenant_git_config/unhashable 등)가 없어야 함').toBeFalsy();
        expect(sawApproveHitl, '컨설팅 초안이 승인/반려 HITL 패널로 표시(resume)되어야 함').toBeTruthy();
        expect(sawCheckboxHitl, '스킬/에이전트/DMN 후보가 체크박스 HITL 패널로 표시되어야 함').toBeTruthy();
        expect(appeared, '우측 작업폴더(.ws-files)에 산출물이 떠야 함').toBeTruthy();

        // ── 2) 단일 프로세스 = 단일 탭(중복 생성 없음) ──
        await page.waitForTimeout(3_000);
        const tabLabels = await page.locator('.artifact-panel__tab .artifact-panel__tab-label').allInnerTexts().catch(() => []);
        const procTabs = tabLabels.map((t) => t.trim()).filter((t) => t && !/산출물\s*파일/.test(t));
        console.log('[tabs]', JSON.stringify(tabLabels), '→ process tabs:', procTabs.length);
        const uniqueProcTabs = Array.from(new Set(procTabs));
        expect(uniqueProcTabs.length, `단일 프로세스는 탭 1개여야 함(중복 생성 회귀 감지). tabs=${JSON.stringify(tabLabels)}`).toBe(1);

        // ── 3) 산출물: bpmn 은 항상, 스킬/에이전트는 **선택됐을 때만** 표시되어야 한다(스킬은 조건부 — 모델 변동).
        const itemNames = await page.locator('.ws-files__item-name').allInnerTexts().catch(() => []);
        const names = itemNames.map((t) => t.trim());
        console.log('[artifacts]', JSON.stringify(names));
        const skillNames = names.filter((n) => /SKILL\.md$/i.test(n));
        const agentNames = names.filter((n) => /^agent\//i.test(n) || /agents\.json$/i.test(n));
        const hasBpmn = names.some((n) => /\.bpmn$/i.test(n));
        expect(hasBpmn, 'bpmn 산출물이 표시되어야 함').toBeTruthy();

        // ── 3-b) 선택한 후보가 모두 생성되었는지(누락 금지) — 선택 개수 ≤ 생성 개수 ──
        const labels = Array.from(candidateLabels);
        const selSkills = labels.filter((l) => /\[\s*스킬\s*\]/.test(l));
        const selAgents = labels.filter((l) => /\[\s*에이전트\s*\]/.test(l));
        console.log('[selected]', JSON.stringify({ skills: selSkills, agents: selAgents }));
        expect(skillNames.length, `선택한 스킬 ${selSkills.length}개가 모두 SKILL.md 로 생성되어야 함(생성 ${skillNames.length}개)`).toBeGreaterThanOrEqual(selSkills.length);
        expect(agentNames.length, `선택한 에이전트 ${selAgents.length}개가 모두 개별 json 으로 생성되어야 함(생성 ${agentNames.length}개)`).toBeGreaterThanOrEqual(selAgents.length);
        // 후보가 하나도 안 떴거나(드묾) 스킬·에이전트 둘 다 0 이면 편집기 검증이 무의미 → 최소 1종은 있어야 함.
        expect(skillNames.length + agentNames.length, '스킬 또는 에이전트 산출물이 최소 1개는 있어야 함').toBeGreaterThan(0);

        // ── 4) 검증/자동개선 호출 + settle ──
        const validatingChip = page.locator('.ws-files__header', { hasText: /검증 중/ });
        for (let i = 0; i < 60; i++) {
            const validating = (await validatingChip.count()) > 0 && (await validatingChip.isVisible().catch(() => false));
            if (!validating) break;
            await page.waitForTimeout(4_000);
        }
        await page.screenshot({ path: `${SHOT}/ff-02-validated.png`, fullPage: true });
        console.log('[validate-calls]', validateCalls);
        expect(validateCalls, '/validate-and-improve 가 1회 이상 호출(제시 전 자동 검증)').toBeGreaterThan(0);

        // 검증 응답으로 **실제 실행엔진 실행**을 확인(정적 검사만이 아님):
        // 엔진이 인스턴스를 실제로 생성/진행해야 한다(skipped=false + test_instance_ids>0).
        // (passed 는 프로세스 품질·LLM 자동개선 결과에 따라 true/false 가 될 수 있으므로 통과 조건으로 쓰지 않는다.)
        await page.waitForTimeout(2_000);
        console.log('[validate-reports]', JSON.stringify(validateReports.map((b) => ({ passed: b?.passed, skipped: b?.skipped, instances: (b?.test_instance_ids || []).length, skip_reason: b?.skip_reason }))));
        const ranReport = validateReports.find((b) => b && b.skipped !== true && (b.test_instance_ids || []).length > 0);
        expect(ranReport, '검증이 실제 실행엔진으로 인스턴스를 생성·실행해야 함(skipped 아님 + test_instance_ids>0) — 정적 검사만이 아님').toBeTruthy();

        const roomUrl = page.url();

        // 여러 탭(프로세스 + '산출물 파일')이 모두 mount 되어 있으므로 보이는(active) 패널로 스코프한다.
        // 프로세스 탭을 활성화하고, 그 안의 산출물만 조작한다(strict-mode 다중매칭 방지).
        const activateProcTab = async () => {
            const procTab = page.locator('.artifact-panel__tab').filter({ hasNotText: /산출물\s*파일/ }).first();
            if (await procTab.count()) await procTab.click().catch(() => {});
            await page.waitForTimeout(600);
        };
        const vis = '.artifact-panel__content:visible ';
        await activateProcTab();

        // ── 5) bpmn 미리보기 렌더 확인 ──
        const bpmnItem = page.locator(`${vis}.ws-files__item`, { hasText: /\.bpmn/ }).first();
        await bpmnItem.click();
        await page.waitForTimeout(1500);
        const preview = page.locator(`${vis}.ws-files__preview`).first();
        await expect(preview, 'bpmn 미리보기 영역이 보여야 함').toBeVisible({ timeout: 15_000 });
        await page.screenshot({ path: `${SHOT}/ff-03-preview.png`, fullPage: true });

        // ── 6) bpmn 편집 → /definitions/{id} (draft) ──
        const editBtn = page.locator(`${vis}.hwpx-viewer`).getByRole('button', { name: /^\s*편집\s*$/ }).first();
        await expect(editBtn, 'bpmn 미리보기에 편집 버튼이 있어야 함').toBeVisible({ timeout: 15_000 });
        await editBtn.click();
        await page.waitForURL(/\/definitions\//, { timeout: 20_000 });
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
            const skillEdit = page.locator(`${vis}.hwpx-viewer`).getByRole('button', { name: /^\s*편집\s*$/ }).first();
            await expect(skillEdit, '스킬 미리보기에 편집 버튼이 있어야 함').toBeVisible({ timeout: 15_000 });
            skillLoadError = false;
            await skillEdit.click();
            await page.waitForURL(/\/skills\//, { timeout: 20_000 });
            console.log('[edit-nav-skill]', page.url());
            expect(page.url(), '스킬 편집 → /skills/{name}').toMatch(/\/skills\//);
            // 편집기에서 draft 스킬 내용이 로드되어야 함(getSkillFile null 등 로드 실패 없음).
            await page.waitForTimeout(4_000);
            await page.screenshot({ path: `${SHOT}/ff-06-skill-editor.png`, fullPage: true });
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
            const agentEdit = page.locator(`${vis}.hwpx-viewer`).getByRole('button', { name: /^\s*편집\s*$/ }).first();
            await expect(agentEdit, '에이전트 미리보기에 편집 버튼이 있어야 함').toBeVisible({ timeout: 15_000 });
            agentLoadError = false;
            await agentEdit.click();
            await page.waitForURL(/\/agent-chat\//, { timeout: 20_000 });
            const agentUrl = page.url();
            console.log('[edit-nav-agent]', agentUrl);
            expect(agentUrl, '에이전트 편집 → /agent-chat/{id}').toMatch(/\/agent-chat\//);
            // editTarget 이 결정적 uuid 를 써야 함(슬러그 금지) → draft 저장된 에이전트와 id 일치 → 편집기 로드.
            expect(agentUrl, '에이전트 id 가 uuid 여야 draft 에이전트를 로드함').toMatch(/\/agent-chat\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
            await page.waitForTimeout(4_000);
            await page.screenshot({ path: `${SHOT}/ff-07-agent-editor.png`, fullPage: true });
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
        await page.screenshot({ path: `${SHOT}/ff-04-completed.png`, fullPage: true });
        // 목록은 페이지네이션(상위 N)일 수 있어 개수 증가가 항상 보이진 않는다 → 존재만 확인(실제 엔진 실행은 위 validate-report 로 단언).
        expect(cnt, '완료 인스턴스 목록이 표시되어야 함').toBeGreaterThan(0);
        await page.goto(roomUrl, { waitUntil: 'domcontentloaded' });
        await expect(filesPanel).toBeVisible({ timeout: 30_000 });

        // ── 10) 저장(draft 승격) → "저장됨" ──
        const saveBtn = page.locator(`${vis}.ws-files__header`).getByRole('button', { name: /저장|저장됨/ }).first();
        await expect(saveBtn).toBeEnabled({ timeout: 30_000 });
        await saveBtn.click();
        await page.waitForTimeout(8_000);
        await page.screenshot({ path: `${SHOT}/ff-05-saved.png`, fullPage: true });
        const saveErr = page.locator(`${vis}.ws-files__truncated`, { hasText: /실패|error/i });
        const errText = (await saveErr.count()) > 0 ? await saveErr.first().innerText() : '';
        expect(errText, `저장 에러: ${errText}`).toBe('');
        const savedBadge = page.locator(`${vis}.ws-files__header`).getByRole('button', { name: /저장됨/ });
        expect(await savedBadge.count(), '저장 후 "저장됨" 표시').toBeGreaterThan(0);
        console.log('[done] 전체 흐름 통과 — chat/stream reqs:', chatStreamReqs.length);
    });
});
