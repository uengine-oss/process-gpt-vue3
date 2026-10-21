#!/usr/bin/env node
// P5.4.3 PAL 시연 파트별 영상 녹화 드라이버.
//
//   node scripts/demo/record-demo.mjs [part번호...]   // 생략 시 1~6 전부
//
// - 파트마다 새 브라우저 컨텍스트로 녹화해 docs/demo-p543-pal/videos/partN.webm 저장.
// - 시연 데이터 보존: 순서도는 절대 저장하지 않고(모델 변경은 리로드로 폐기),
//   파트5에서 라이브 등록한 input 스키마 필드는 녹화 후 DB에서 삭제해
//   실제 발표의 라이브 등록 여지를 되살린다 (--keep-input 으로 유지 가능).
// - 시연 영상은 사이드바를 그대로 둔다 (닫기 규칙은 매뉴얼 스크린샷 전용).
// - 깜빡임 방지: 로그인은 녹화 밖(storageState 재사용)에서 처리하고, 파트 안에서는
//   전체 리로드(page.goto)를 최소화한다 — 모드 전환·사이드바 SPA 이동을 우선 사용.

import { chromium } from '@playwright/test';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE_URL || 'http://localhost:8088';
const EMAIL = process.env.E2E_USER || 'manual-shots@uengine.org';
const PASSWORD = process.env.E2E_PASS || 'manual-shots-pw';
const OUT = 'docs/demo-p543-pal/videos';
const SIZE = { width: 1440, height: 900 };
const DESIGNER = '/process-hierarchy?id=p5.4.3-internal-audit';

const wanted = process.argv.slice(2).filter((a) => /^\d+$/.test(a)).map(Number);
const keepInput = process.argv.includes('--keep-input');
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function login(page) {
    await page.goto(BASE + '/auth/login', { waitUntil: 'domcontentloaded' });
    await page.locator('.cp-id input').fill(EMAIL);
    await page.locator('.cp-pwd input').fill(PASSWORD);
    await page.locator('.cp-login').click();
    await page.waitForURL(/process-architecture|definition-map|todolist/, { timeout: 60_000 });
    await page.waitForLoadState('networkidle').catch(() => {});
}

// bpmn-js 캔버스 요소를 텍스트로 찾아 중심 클릭
async function clickElement(page, text) {
    const box = await page.evaluate((t) => {
        const el = [...document.querySelectorAll('.djs-element')].find((e) => e.textContent.includes(t));
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }, text);
    if (!box) throw new Error('canvas element not found: ' + text);
    await page.mouse.click(box.x, box.y);
}

async function contextPad(page, action) {
    await page.locator(`.djs-context-pad [data-action="${action}"]`).first().click();
}

async function openDesigner(page, edit = true) {
    await page.goto(BASE + DESIGNER, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await sleep(3500);
    // 캔버스 확보: 앱 사이드바와 프로세스 계층 트리를 접는다 (적용 확인 + 재시도)
    for (let i = 0; i < 3; i++) {
        const closed = await page.evaluate(() => !!document.querySelector('.sidebar-closed'));
        if (closed) break;
        await page.evaluate(() => {
            document.querySelector('button[aria-label="사이드바 접기"]')?.click();
        });
        await sleep(800);
    }
    // 프로세스 계층 트리 접기: 트리 패널("프로세스 계층" 텍스트)이 사라질 때까지
    for (let i = 0; i < 3; i++) {
        const collapsed = await page.evaluate(() => {
            const hasTree = [...document.querySelectorAll('*')].some(
                (e) => e.children.length === 0 && e.textContent.trim() === '프로세스 계층'
            );
            if (!hasTree) return true;
            // 주의: 닫힌 v-navigation-drawer(.leftSidebar)의 '사이드바 접기' 버튼이 DOM에 남아
            // 있으므로 반드시 제외한다 — 잘못 클릭하면 사이드바가 다시 열린다.
            const btn = [...document.querySelectorAll('button')].find(
                (b) =>
                    b.querySelector('.mdi-chevron-left') &&
                    !b.closest('.leftSidebar') &&
                    b.getBoundingClientRect().x > 0 &&
                    b.getBoundingClientRect().x < 700 &&
                    b.getBoundingClientRect().y < 150
            );
            btn?.click();
            return false;
        });
        if (collapsed) break;
        await sleep(800);
    }
    await sleep(800);
    if (edit) {
        await page.locator('button:has-text("편집")').first().click();
        await sleep(3000);
    }
}

const parts = {
    // ① 프로세스 지도 → P5.4.3 진입
    async 1(page) {
        await page.goto(BASE + '/process-architecture', { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('networkidle').catch(() => {});
        await sleep(4000);
        // 트리 훑기: 품질경영 도메인 쪽으로 시선 이동
        await page.locator('text=품질경영').first().hover().catch(() => {});
        await sleep(1500);
        await page.locator('text=P5.4.3 내부심사').first().hover().catch(() => {});
        await sleep(1500);
        await page.locator('text=P5.4.3 내부심사').first().click().catch(() => {});
        await sleep(3000);
        // 카드 클릭이 상세로 안 이어지면 디자이너로 직접 이동
        if (!page.url().includes('process-hierarchy')) {
            await page.goto(BASE + DESIGNER, { waitUntil: 'domcontentloaded' });
        }
        await sleep(4500);
    },

    // ② 순서도 라이브 모델링 (저장 안 함 — Ctrl+Z 원복 후 리로드)
    async 2(page) {
        await openDesigner(page, true);
        await clickElement(page, '내부심사 계획 공유');
        await sleep(1200);
        await contextPad(page, 'append.append-task');
        await sleep(1200);
        await page.keyboard.type('임시 검토', { delay: 120 });
        await sleep(800);
        await page.keyboard.press('Escape');
        await sleep(1200);
        await contextPad(page, 'append.gateway');
        await sleep(1500);
        await page.keyboard.press('Escape');
        await sleep(800);
        // 원복
        for (let i = 0; i < 8; i++) {
            await page.keyboard.press('Control+z');
            await sleep(350);
        }
        await sleep(1000);
        // 읽기 모드로 전환(리로드 없이 미저장 편집 종료) 후 분기 구간 확인
        await page.locator('button:has-text("읽기")').first().click();
        await sleep(3000);
        await clickElement(page, '효과성 충분');
        await sleep(2500);
    },

    // ③ Task Catalog — 패널 카탈로그 섹션 + 관리자 카탈로그 페이지
    async 3(page) {
        await openDesigner(page, true);
        await clickElement(page, '내부심사 결과 승인');
        await sleep(1000);
        await contextPad(page, 'open-panel');
        await sleep(2000);
        await page.evaluate(() => {
            [...document.querySelectorAll('.section-title')]
                .find((e) => e.textContent.includes('Task 카탈로그'))
                ?.scrollIntoView({ block: 'center' });
        });
        await sleep(800);
        await page.evaluate(() => {
            [...document.querySelectorAll('.section-title')]
                .find((e) => e.textContent.includes('Task 카탈로그'))
                ?.click();
        });
        await sleep(2500);
        // 관리자 카탈로그 페이지 — 리로드 없이 사이드바 SPA 이동 (사이드바 다시 열고 메뉴 클릭)
        await page.locator('.sidebar-open-floating-button, button[aria-label="사이드바 펼치기"]').first().click();
        await sleep(1200);
        await page.locator('.leftSidebar >> text=카탈로그').first().click();
        await page.waitForLoadState('networkidle').catch(() => {});
        await sleep(3500);
    },

    // ④ 속성패널 — 절차·RACI·통합 매트릭스
    async 4(page) {
        await openDesigner(page, true);
        await clickElement(page, '내부심사 실시');
        await sleep(1000);
        await contextPad(page, 'open-panel');
        await sleep(2000);
        await page.evaluate(() => {
            [...document.querySelectorAll('.section-title')]
                .find((e) => e.textContent.includes('세부 업무 수행 절차'))
                ?.scrollIntoView({ block: 'start' });
        });
        await sleep(1500);
        await page.locator('button:has-text("항목 편집")').first().click();
        await sleep(3000);
        await page.keyboard.press('Escape');
        await sleep(1000);
        await page.evaluate(() => {
            [...document.querySelectorAll('.section-title')]
                .find((e) => e.textContent.trim().startsWith('RACI'))
                ?.scrollIntoView({ block: 'start' });
        });
        await sleep(1200);
        await page.locator('button:has-text("RACI 편집")').first().click();
        await sleep(3000);
        await page.keyboard.press('Escape');
        await sleep(1000);
        // 통합 매트릭스: 셀 6클릭(한 바퀴 순환 = 원상복귀) 후 닫기
        await page.locator('.designer-toolbar button:has-text("RACI"), button:has-text("RACI")').first().click();
        await sleep(3000);
        const cell = await page.evaluate(() => {
            const dlg = [...document.querySelectorAll('.v-dialog, .v-overlay')].find((d) => d.textContent.includes('통합 매트릭스'));
            const tds = dlg ? [...dlg.querySelectorAll('td')] : [];
            const target = tds.find((td) => td.textContent.trim() === '' && td.cellIndex >= 2);
            if (!target) return null;
            const r = target.getBoundingClientRect();
            return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
        });
        if (cell) {
            for (let i = 0; i < 6; i++) {
                await page.mouse.click(cell.x, cell.y);
                await sleep(500);
            }
        }
        await sleep(1000);
        await page.keyboard.press('Escape');
        await sleep(800);
    },

    // ⑤ 속성 스키마 스튜디오 — input 필드 라이브 등록 → 순서도에서 확인
    async 5(page) {
        await page.goto(BASE + '/admin-console/property-schemas', { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('networkidle').catch(() => {});
        await sleep(3000);
        await page.locator('button:has-text("필드 추가")').click();
        await sleep(1500);
        await page.locator('input[placeholder="e.g. system_name"]').fill('input');
        await sleep(600);
        await page.locator('input[placeholder="예: 위험 수준"]').fill('Input (참조 문서)');
        await sleep(600);
        // 타입 → Multi Select (네이티브 select)
        await page.evaluate(() => {
            const dlg = [...document.querySelectorAll('.v-dialog, [role="dialog"], .modal, body')].pop();
            const selects = [...document.querySelectorAll('select.form-select')];
            const type = selects.find((s) => [...s.options].some((o) => /multiselect|Multi/i.test(o.text) || o.value === 'multiselect'));
            if (type) { type.value = 'multiselect'; type.dispatchEvent(new Event('change')); }
        });
        // Vue v-model은 input 이벤트도 필요할 수 있음 — selectOption 재시도
        for (const sel of await page.locator('select.form-select').all()) {
            const has = await sel.evaluate((s) => [...s.options].some((o) => o.value === 'multiselect'));
            if (has) { await sel.selectOption('multiselect'); break; }
        }
        await sleep(1200);
        // Options Source → Managed List
        for (const sel of await page.locator('select.form-select').all()) {
            const has = await sel.evaluate((s) => [...s.options].some((o) => o.value === 'list'));
            if (has) { await sel.selectOption('list'); break; }
        }
        await sleep(1000);
        // 참조 목록 → audit-documents
        for (const sel of await page.locator('select.form-select').all()) {
            const has = await sel.evaluate((s) => [...s.options].some((o) => o.value === 'audit-documents'));
            if (has) { await sel.selectOption('audit-documents'); break; }
        }
        await sleep(800);
        // 적용 대상 → Task만 (옵션 텍스트에 Task 포함, 프로세스 미포함인 것)
        for (const sel of await page.locator('select.form-select').all()) {
            const val = await sel.evaluate((s) => {
                const o = [...s.options].find((o) => /task/i.test(o.text + o.value) && !/process|프로세스|\+/i.test(o.text));
                return o ? o.value : null;
            });
            if (val) { await sel.selectOption(val); break; }
        }
        await sleep(600);
        // 그룹 (묶음) → 산출물(Input/Output)
        await page.locator('input[placeholder*="비워두면"]').fill('산출물(Input/Output)');
        await sleep(1200);
        await page.locator('.v-dialog button:has-text("필드 추가"), button:has-text("필드 추가")').last().click();
        await sleep(2500);
        // 순서도에서 확인: 계획 수립 태스크 패널에 Input 필드 등장
        await openDesigner(page, true);
        await clickElement(page, '내부심사 계획 수립');
        await sleep(1000);
        await contextPad(page, 'open-panel');
        await sleep(2000);
        await page.evaluate(() => {
            [...document.querySelectorAll('.section-title')]
                .find((e) => e.textContent.includes('산출물'))
                ?.scrollIntoView({ block: 'start' });
        });
        await sleep(3000);
    },

    // ⑥ 검증 — 구조 검증 + 필수 Rule 체크리스트 3/3
    async 6(page) {
        await openDesigner(page, false);
        await page.locator('button:has-text("검증")').click();
        await sleep(2500);
        // 첫 Rule 클릭 → 캔버스 포커스 이동
        await page.locator('text=내부심사 자격인정자에 한해').first().click();
        await sleep(2500);
        // 체크박스 3개 체크
        const boxes = page.locator('.v-dialog input[type="checkbox"], .v-overlay input[type="checkbox"]');
        const n = await boxes.count();
        for (let i = 0; i < n && i < 3; i++) {
            await boxes.nth(i).check({ force: true }).catch(() => {});
            await sleep(900);
        }
        await sleep(1500);
        await page.locator('button:has-text("닫기")').first().click();
        await sleep(1200);
        // 툴바 Rule 모아보기
        await page.locator('button:has-text("Rule")').first().click();
        await sleep(2500);
        await page.keyboard.press('Escape');
        await sleep(800);
    },
};

const run = wanted.length ? wanted : [1, 2, 3, 4, 5, 6];
const browser = await chromium.launch();
let failed = 0;

// 로그인은 녹화 밖에서 한 번만 — 각 파트 영상이 로그인 화면·리다이렉트 없이
// 바로 대상 화면에서 시작해 깜빡임이 없다.
const authCtx = await browser.newContext({ viewport: SIZE, locale: 'ko-KR' });
const authPage = await authCtx.newPage();
await login(authPage);
const storageState = await authCtx.storageState();
await authCtx.close();

for (const n of run) {
    const ctx = await browser.newContext({ viewport: SIZE, locale: 'ko-KR', storageState, recordVideo: { dir: OUT, size: SIZE } });
    const page = await ctx.newPage();
    page.setDefaultTimeout(30_000);
    try {
        await parts[n](page);
        console.log(`part${n}: ok`);
    } catch (e) {
        failed++;
        console.error(`part${n}: FAILED — ${e.message}`);
        await page.screenshot({ path: path.join(OUT, `part${n}_crash.png`) }).catch(() => {});
    }
    await ctx.close(); // close 시 비디오 flush
    const video = page.video();
    if (video) {
        const tmp = await video.path();
        fs.renameSync(tmp, path.join(OUT, `part${n}.webm`));
        console.log(`  → ${OUT}/part${n}.webm`);
    }
}
await browser.close();

// 파트5 정리: 라이브 등록한 input 필드를 지워 발표 당일 라이브 여지를 되살린다
if (run.includes(5) && !keepInput) {
    try {
        execSync(
            `docker exec supabase_db_process-gpt-vue3 psql -U postgres -d postgres -c "delete from task_property_schema where tenant_id='tym' and property_key='input'"`,
            { stdio: 'inherit' }
        );
        console.log('cleanup: input 스키마 필드 삭제(라이브 시연 상태 복구)');
    } catch (e) {
        console.error('cleanup 실패 — 수동으로 input 필드를 삭제하세요:', e.message);
    }
}
process.exit(failed ? 1 : 0);
