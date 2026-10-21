#!/usr/bin/env node
// 온톨로지 E2E 가이드(spec 017) — 프로세스 생성 → 실행 → 에이전트의 온톨로지 사용 → 온톨로지 분석을
// 실제 화면으로 처음부터 끝까지 실행하며 장면별 영상(webm)과 매뉴얼 스크린샷을 남긴다.
//
//   python3 scripts/demo/ontology-e2e/cleanup.py      # 처음 상태로 (이전 실행 결과 삭제)
//   node scripts/demo/ontology-e2e/record.mjs          # 전 장면 실행·녹화 (약 5분)
//
// 결과: docs/manuals/video/ontology-e2e-guide/clips/sN.webm, docs/manuals/images/ontology-e2e-guide/*.png
// 합성: bash scripts/demo/ontology-e2e/make-video.sh <ffmpeg>
//
// - 로그인은 녹화 밖에서 한 번(storageState 재사용). 모든 화면은 사이드바를 닫고 찍는다.
// - 장면 사이의 "화면 밖" 단계: 생성된 정의 id 조회, 인스턴스 시작(실행 엔진 /initiate — 이 로컬 구성은
//   순서도의 ▶실행 버튼이 엔진 모드 배포에서만 보이므로 같은 엔진 API 로 시작한다), 에이전트 완료 대기,
//   온톨로지 동기화·KPI 측정. 실제 데이터를 만들고 남긴다(다시 하려면 cleanup.py).
// - 각 장면 하단에 단계 자막 띠를 띄운다(영상 전용, 스크린샷 전에는 숨김).

import { chromium } from '@playwright/test';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE_URL || 'http://localhost:8088';
const ENGINE = process.env.ENGINE_URL || 'http://127.0.0.1:8000';
const STRATEGY = process.env.STRATEGY_URL || 'http://127.0.0.1:8014';
const EMAIL = process.env.E2E_USER || 'manual-shots@uengine.org';
const PASSWORD = process.env.E2E_PASS || 'manual-shots-pw';
const TENANT = 'tym';
const CLIPS = 'docs/manuals/video/ontology-e2e-guide/clips';
const SHOTS = 'docs/manuals/images/ontology-e2e-guide';
const BPMN = 'docs/manuals/assets/ontology-e2e/purchase-kpi-weekly-review.bpmn';
const PROC_NAME = '구매 KPI 주간 점검';
const KPI_NAME = 'KPI 주간 점검 완료 건수';
const REQUEST_TEXT =
    '구매 처리 리드타임 — 목표 48시간인데 왜 못 미치나요? 어느 단계·누가 병목인지, 무엇을 고치면 될지 알려 주세요.';
const REVIEW_TEXT =
    '견적 검토 병목 확인. 담당자(박준호·김지훈)와 견적 검토 기준표를 정비하고, 다음 주 점검에서 평균 소요시간 변화를 다시 본다.';
const QUESTION = '구매 처리 리드타임이 왜 목표 미달이야?';
const SIZE = { width: 1440, height: 900 };

const only = process.argv.slice(2).filter((a) => /^\d+$/.test(a)).map(Number);
fs.mkdirSync(CLIPS, { recursive: true });
fs.mkdirSync(SHOTS, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const psql = (sql) =>
    execSync(`docker exec -i supabase_db_process-gpt-vue3 psql -U postgres -d postgres -At`, { input: sql })
        .toString()
        .trim();
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

// 장면 사이에 넘기는 상태 (장면만 골라 다시 찍을 때를 위해 파일에도 둔다)
const STATE_FILE = path.join(CLIPS, 'state.json');
const state = fs.existsSync(STATE_FILE) ? JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) : {};
const save = () => fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));

// ---------------------------------------------------------------- 화면 도우미

async function closeSidebar(page) {
    for (let i = 0; i < 3; i++) {
        if (await page.evaluate(() => !!document.querySelector('.sidebar-closed'))) return;
        await page.evaluate(() => document.querySelector('button[aria-label="사이드바 접기"]')?.click());
        await sleep(600);
    }
}

async function go(page, url, settle = 3500) {
    await page.goto(BASE + url, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await closeSidebar(page);
    await sleep(settle);
}

// 하단 자막 띠 — 페이지를 옮겨도 남도록 sessionStorage + initScript 로 다시 그린다
const CAPTION_INIT = () => {
    const draw = () => {
        const text = sessionStorage.getItem('__e2eCaption');
        let el = document.getElementById('__e2e_caption');
        if (!text) { el?.remove(); return; }
        if (!el) {
            el = document.createElement('div');
            el.id = '__e2e_caption';
            el.style.cssText =
                'position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:2147483647;' +
                'background:rgba(24,20,38,.88);color:#fff;font:600 19px/1.45 "Noto Sans KR",sans-serif;' +
                'padding:11px 22px;border-radius:12px;box-shadow:0 6px 24px rgba(0,0,0,.25);max-width:1100px;' +
                'text-align:center;pointer-events:none;letter-spacing:-.2px';
            (document.body || document.documentElement).appendChild(el);
        }
        el.innerHTML = text;
    };
    window.__e2eDrawCaption = draw;
    document.addEventListener('DOMContentLoaded', draw);
    setInterval(() => { if (!document.getElementById('__e2e_caption') && sessionStorage.getItem('__e2eCaption')) draw(); }, 500);
};

// 장면 영상의 앞부분(첫 페이지 로딩·사이드바 닫기)을 잘라내기 위해 첫 자막이 뜬 시각을 기록한다
let sceneT0 = 0;
let sceneTrim = null;

async function caption(page, html) {
    if (html && sceneTrim === null) sceneTrim = Math.max(0, (Date.now() - sceneT0) / 1000 - 0.4);
    await page.evaluate((t) => {
        if (t) sessionStorage.setItem('__e2eCaption', t);
        else sessionStorage.removeItem('__e2eCaption');
        window.__e2eDrawCaption?.();
    }, html);
}

// 매뉴얼 스크린샷 — 자막 띠는 잠깐 숨긴다
async function shot(page, name, opts = {}) {
    await page.evaluate(() => { const el = document.getElementById('__e2e_caption'); if (el) el.style.visibility = 'hidden'; });
    await page.screenshot({ path: path.join(SHOTS, name), ...opts });
    await page.evaluate(() => { const el = document.getElementById('__e2e_caption'); if (el) el.style.visibility = 'visible'; });
    console.log('  shot', name);
}

async function slowType(locator, text, delay = 28) {
    await locator.click();
    await locator.pressSequentially(text, { delay });
}

async function waitFor(fn, { timeout = 180_000, every = 3000, label = '' } = {}) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
        const v = await fn();
        if (v) return v;
        await sleep(every);
    }
    throw new Error('timeout: ' + label);
}

const instPath = () => '/instancelist/' + state.instId.replace(/\./g, '_DOT_');
const todoId = (activity) =>
    psql(`select id from public.todolist where tenant_id=${q(TENANT)} and proc_inst_id=${q(state.instId)} and activity_id=${q(activity)}`);
const todoStatus = (activity) =>
    psql(`select status from public.todolist where tenant_id=${q(TENANT)} and proc_inst_id=${q(state.instId)} and activity_id=${q(activity)}`);

// ---------------------------------------------------------------- 장면

const scenes = {
    // ① 프로세스 생성 — 체계도 · 새 프로세스(업로드) → 순서도 → 버전 저장
    async 1(page) {
        await go(page, '/process-architecture');
        await caption(page, '① 프로세스 생성 — 프로세스 체계도 · 편집 모드');
        await sleep(1500);
        await page.locator('button:has-text("편집 모드")').click();
        await sleep(1500);
        await page.locator('button:has-text("새 프로세스")').first().click();
        await sleep(1800);
        const dlg = page.locator('.v-dialog').last();
        await caption(page, '① 새 프로세스 — 이름 · 설명 · 계층 위치');
        await slowType(dlg.locator('input').first(), PROC_NAME, 60);
        await slowType(dlg.locator('textarea').first(), '매주 미달 KPI 를 골라 온톨로지 조회 에이전트가 원인 경로를 보고하고 구매팀장이 검토한다.', 18);
        const pick = async (label, opt) => {
            await dlg.locator(`.v-select:has-text("${label}"), .v-autocomplete:has-text("${label}")`).first().click();
            await sleep(700);
            await page.locator(`.v-overlay--active .v-list-item:has-text("${opt}")`).first().click();
            await sleep(700);
        };
        await pick('도메인', '구매관리');
        await pick('Mega', '구매 운영');
        await pick('Major', '구매 실행');
        await shot(page, '01-new-process-dialog.png');
        await caption(page, '① 생성 방식 — 업로드: 미리 그린 BPMN 파일');
        await dlg.locator('button:has-text("업로드")').click();
        await sleep(800);
        await page.locator('input[type=file][accept*=".bpmn"]').setInputFiles(BPMN);
        await sleep(1200);
        await dlg.locator('.v-card-text').first().evaluate((e) => e.scrollTo({ top: 10000, behavior: 'smooth' })).catch(() => {});
        await sleep(1500);
        await shot(page, '02-upload-bpmn.png');
        await dlg.locator('button:has-text("생성 후 열기")').click();
        await sleep(4000);

        state.procId = await waitFor(
            () => psql(`select id from public.proc_def where tenant_id=${q(TENANT)} and name=${q(PROC_NAME)} order by id desc limit 1`),
            { label: 'proc_def', every: 1000, timeout: 20_000 }
        );
        save();
        console.log('  proc_def', state.procId);

        await go(page, '/process-hierarchy?id=' + state.procId, 4500);
        await caption(page, '① 순서도 — 구매팀장 레인 · <b>온톨로지 조회 에이전트</b> 레인(톱니 = 에이전트가 맡는 서비스 태스크)');
        await sleep(4500);
        await shot(page, '03-designer.png');
        await caption(page, '① 편집 → 저장: 버전을 저장하면 실행 정의가 만들어진다');
        await page.locator('button:has-text("편집")').first().click();
        await sleep(2500);
        await page.locator('button:has-text("저장")').first().click();
        await sleep(1800);
        await slowType(page.locator('.v-dialog textarea').first(), '초기 등록 — 업로드한 정의를 버전으로 저장', 25);
        await sleep(600);
        await shot(page, '04-save-version.png');
        await page.locator('.v-dialog button:has-text("저장")').last().click();
        await waitFor(
            () => psql(`select jsonb_array_length(coalesce(definition->'activities','[]')) from public.proc_def where id=${q(state.procId)}`) === '3',
            { label: 'definition', every: 1000, timeout: 30_000 }
        );
        await sleep(2500);
    },

    // ② 전략 연결 — 전략 보드 · KPI 추가(연관 프로세스)
    async 2(page) {
        await go(page, '/strategy-board');
        await caption(page, '② 전략과 잇기 — 전략 보드 · 「AI 에이전트 활용 확대」');
        await sleep(1500);
        await page.locator('text=AI 에이전트 활용 확대').first().click();
        await sleep(2200);
        await page.locator('button:has-text("KPI 추가")').first().click();
        await sleep(1500);
        const dlg = page.locator('.v-dialog').last();
        await caption(page, '② KPI 추가 — 측정: 완료 건수 · 연관 프로세스: 구매 KPI 주간 점검 · 목표 4건');
        await slowType(dlg.locator('input').first(), KPI_NAME, 50);
        await slowType(dlg.locator('textarea').first(), '에이전트가 온톨로지로 원인을 분석하고 구매팀장이 검토까지 마친 주간 점검 건수', 15);
        await dlg.locator('.v-select:has-text("측정 방식")').click();
        await sleep(700);
        await page.locator('.v-overlay--active .v-list-item:has-text("완료 건수")').first().click();
        await sleep(700);
        await dlg.locator('.v-autocomplete:has-text("연관 프로세스"), .v-select:has-text("연관 프로세스")').first().click();
        await sleep(600);
        await page.keyboard.type('구매 KPI', { delay: 60 });
        await sleep(1000);
        await page.locator(`.v-overlay--active .v-list-item:has-text("${PROC_NAME}")`).first().click();
        await sleep(700);
        for (const [lab, val] of [['단위', '건'], ['기준선', '0'], ['목표치', '4']]) {
            await slowType(dlg.locator(`.v-text-field:has(label:text-is("${lab}")) input`).first(), val, 80);
        }
        await sleep(800);
        await shot(page, '05-kpi-dialog.png');
        await dlg.locator('button:has-text("저장")').click();
        await sleep(2500);
        await caption(page, '② 저장 — KPI 카드에 연관 프로세스가 붙는다');
        await sleep(2500);
        await shot(page, '06-kpi-linked.png');
        await sleep(1500);
    },

    // ③ 실행 — 점검 요청 작성 · 제출
    async 3(page) {
        // 화면 밖: 실행 엔진으로 인스턴스 시작 → 첫 업무(점검 요청)가 구매팀장에게 배정된다
        const res = await fetch(ENGINE + '/initiate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Forwarded-Host': `${TENANT}.x` },
            body: JSON.stringify({ input: { process_definition_id: state.procId, tenant_id: TENANT } })
        }).then((r) => r.json());
        state.instId = res.proc_inst_id;
        save();
        console.log('  instance', state.instId);

        await go(page, '/todolist/' + res.id, 4000);
        await caption(page, '③ 실행 — 구매팀장의 첫 업무 「점검 요청」');
        await sleep(2500);
        await caption(page, '③ 점검할 KPI 와 궁금한 점을 적는다');
        await slowType(page.locator('textarea').first(), REQUEST_TEXT, 30);
        await sleep(1000);
        await shot(page, '07-request-form.png');
        await caption(page, '③ 제출 완료 → 다음 단계는 에이전트');
        await page.locator('button:has-text("제출 완료")').first().click();
        // 제출하면 앱이 인스턴스 화면으로 옮겨 준다
        await page.waitForURL(/\/instancelist\//, { timeout: 30_000 });
        await page.waitForLoadState('networkidle').catch(() => {});
        await sleep(1500);
        await page.locator('.v-tab:has-text("칸반보드")').first().click().catch(() => {});
        await sleep(2000);
        await caption(page, '③ 「온톨로지 원인 분석」 — 에이전트가 작업 중');
        await sleep(4000);
        await shot(page, '08-agent-running.png');
    },

    // ④ 에이전트 — 완료 · 보고서 확인
    async 4(page) {
        // 화면 밖: 에이전트 단계 완료 대기
        await waitFor(() => todoStatus('Task_Analyze') === 'DONE', { label: 'agent', timeout: 240_000 });
        await waitFor(() => todoStatus('Task_Review') === 'IN_PROGRESS', { label: 'review', timeout: 120_000 });
        const out = psql(`select output::text from public.todolist where tenant_id=${q(TENANT)} and proc_inst_id=${q(state.instId)} and activity_id='Task_Analyze'`);
        const log = psql(`select log from public.todolist where tenant_id=${q(TENANT)} and proc_inst_id=${q(state.instId)} and activity_id='Task_Analyze'`);
        fs.writeFileSync(path.join(CLIPS, 'agent-output.json'), out);
        console.log('  agent log:', log);

        await go(page, instPath(), 2500);
        await page.locator('.v-tab:has-text("칸반보드")').first().click().catch(() => {});
        await sleep(2000);
        await caption(page, '④ 에이전트 단계 완료 — 다음 업무 「점검 결과 검토」가 구매팀장에게');
        await sleep(3500);
        await shot(page, '09-agent-done.png');
        await go(page, '/todolist/' + todoId('Task_Analyze'), 3500);
        await caption(page, '④ 에이전트 보고서 — 온톨로지 MCP 도구 ① KPI 찾기 ② 원인 역추적 결과');
        await sleep(1500);
        // 보고서 칸을 키워 전문이 보이게
        await page.evaluate(() => {
            const ta = document.querySelector('textarea');
            if (ta) { ta.style.height = '600px'; ta.scrollTop = 0; }
        });
        await sleep(2500);
        await shot(page, '10-agent-report.png');
        await page.evaluate(async () => {
            const ta = document.querySelector('textarea');
            if (!ta) return;
            for (let y = 0; y < ta.scrollHeight; y += 6) { ta.scrollTop = y; await new Promise((r) => setTimeout(r, 16)); }
        });
        await sleep(2500);
    },

    // ⑤ 검토 완료 — 인스턴스 완료
    async 5(page) {
        await go(page, '/todolist/' + todoId('Task_Review'), 3500);
        await caption(page, '⑤ 「점검 결과 검토」 — 보고서를 읽고 후속 조치를 적는다');
        await slowType(page.locator('textarea').first(), REVIEW_TEXT, 25);
        await sleep(800);
        await shot(page, '11-review.png');
        await page.locator('button:has-text("제출 완료")').first().click();
        await waitFor(
            () => psql(`select status from public.bpm_proc_inst where proc_inst_id=${q(state.instId)}`) === 'COMPLETED',
            { label: 'complete', timeout: 180_000 }
        );
        await go(page, instPath(), 2500);
        await caption(page, '⑤ 인스턴스 완료 — 사람 → 에이전트 → 사람');
        await sleep(3500);
        await shot(page, '12-instance-completed.png');
    },

    // ⑥ 온톨로지 반영 — 익스플로러에서 코스 확인
    async 6(page) {
        // 화면 밖: 온톨로지 동기화 + KPI 측정(완료 건수 반영)
        await fetch(`${STRATEGY}/api/ontology/sync?tenant_id=${TENANT}`, { method: 'POST' });
        await fetch(`${STRATEGY}/api/measure/run?tenant_id=${TENANT}`, { method: 'POST' });
        await fetch(`${STRATEGY}/api/ontology/sync?tenant_id=${TENANT}`, { method: 'POST' });

        await go(page, '/strategy-board?view=explorer', 5000);
        await caption(page, '⑥ 온톨로지 반영 — 전략 보드 · 온톨로지 익스플로러 · 동기화');
        await sleep(1500);
        await page.locator('button:has-text("동기화")').last().click();
        await sleep(4000);
        const s = page.locator('input[placeholder="노드 검색 (Enter: 선택)"]');
        await caption(page, '⑥ 「구매 KPI 주간 점검」 검색 — 전략 → KPI → 프로세스 → 태스크 → 인스턴스 → 워크아이템 → 담당자');
        await slowType(s, PROC_NAME, 60);
        await sleep(800);
        await s.press('Enter');
        await sleep(4500);
        await shot(page, '13-explorer-process.png');
        await caption(page, '⑥ 에이전트 단계 — 수행 주체: 온톨로지 조회 에이전트 · 스킬: 온톨로지 질의');
        await s.fill('');
        await slowType(s, '온톨로지 원인 분석', 60);
        await sleep(800);
        await s.press('Enter');
        await sleep(4500);
        await shot(page, '14-explorer-agent-task.png');
        await caption(page, `⑥ 새 KPI 「${KPI_NAME}」 — 완료 1건이 실적으로`);
        await s.fill('');
        await slowType(s, KPI_NAME, 50);
        await sleep(800);
        await s.press('Enter');
        await sleep(4000);
        await shot(page, '15-explorer-new-kpi.png');
    },

    // ⑦ 온톨로지로 분석 — 질문하기 · 원인 분석
    async 7(page) {
        await go(page, '/strategy-board?view=explorer', 5000);
        await caption(page, '⑦ 분석 — 질문하기');
        await page.locator('button:has-text("질문하기")').first().click();
        await sleep(1500);
        const ask = page.locator('input[placeholder="예: 구매 리드타임이 왜 목표 미달이야?"], textarea[placeholder="예: 구매 리드타임이 왜 목표 미달이야?"]').first();
        await slowType(ask, QUESTION, 60);
        await sleep(600);
        await shot(page, '16-ask-bar.png');
        await page.locator('button:has-text("묻기")').first().click();
        await caption(page, '⑦ 에이전트가 온톨로지 도구로 탐색하는 중…');
        await waitFor(
            () => page.evaluate(() => document.body.innerText.includes('질문 답') && /근거 경로|근거로 확인된/.test(document.body.innerText)),
            { label: 'ask', every: 1000, timeout: 90_000 }
        );
        await sleep(1500);
        await caption(page, '⑦ 답 + 근거 경로(보라 코스) — 에이전트 보고와 같은 결론: 견적 검토 병목');
        await sleep(4500);
        await shot(page, '17-ask-answer.png');
        await caption(page, '⑦ 에이전트가 한 일 — ① 이름 찾기 ② 원인 분석: 업무 중 에이전트가 쓴 것과 같은 도구');
        await page.locator('text=/에이전트가 한 일 \\d+단계/').first().click().catch(() => {});
        await sleep(1500);
        await page.locator('text=/에이전트가 한 일 \\d+단계/').first().evaluate((el) => el.scrollIntoView({ block: 'start', behavior: 'smooth' }));
        await sleep(3500);
        await shot(page, '18-ask-steps.png');
        // KPI 원인 분석 — 질문 답을 닫고 KPI 를 고른다
        const s = page.locator('input[placeholder="노드 검색 (Enter: 선택)"]');
        await s.fill('');
        await slowType(s, '구매 처리 리드타임', 60);
        await s.press('Enter');
        await sleep(3500);
        await caption(page, '⑦ KPI → 원인 분석(실행까지 역추적) — 개선 후보 순위');
        await page.locator('[data-testid="kpi-impact"]').click();
        await waitFor(
            () => page.evaluate(() => /개선 후보 \(영향 점수순\)/.test(document.body.innerText)),
            { label: 'root-cause', every: 1000, timeout: 60_000 }
        );
        await sleep(1500);
        await page.locator('text=개선 후보 (영향 점수순)').first().evaluate((el) => el.scrollIntoView({ block: 'start', behavior: 'smooth' }));
        await sleep(4500);
        await shot(page, '19-root-cause.png');
    }
};

// ---------------------------------------------------------------- 실행

const run = only.length ? only : [1, 2, 3, 4, 5, 6, 7];
const browser = await chromium.launch();
const authCtx = await browser.newContext({ viewport: SIZE, locale: 'ko-KR' });
const authPage = await authCtx.newPage();
await authPage.goto(BASE + '/auth/login', { waitUntil: 'domcontentloaded' });
await authPage.locator('.cp-id input').fill(EMAIL);
await authPage.locator('.cp-pwd input').fill(PASSWORD);
await authPage.locator('.cp-login').click();
await authPage.waitForURL(/process-architecture|definition-map|todolist/, { timeout: 60_000 });
await authPage.waitForLoadState('networkidle').catch(() => {});
const storageState = await authCtx.storageState();
await authCtx.close();

let failed = 0;
for (const n of run) {
    const ctx = await browser.newContext({ viewport: SIZE, locale: 'ko-KR', storageState, recordVideo: { dir: CLIPS, size: SIZE } });
    await ctx.addInitScript(CAPTION_INIT);
    const page = await ctx.newPage();
    page.setDefaultTimeout(30_000);
    const t0 = Date.now();
    sceneT0 = t0;
    sceneTrim = null;
    try {
        await scenes[n](page);
        await caption(page, '');
        console.log(`scene${n}: ok (${Math.round((Date.now() - t0) / 1000)}s)`);
    } catch (e) {
        failed++;
        console.error(`scene${n}: FAILED — ${e.message}`);
        await page.screenshot({ path: path.join(CLIPS, `s${n}_crash.png`) }).catch(() => {});
    }
    await ctx.close();
    const video = page.video();
    if (video) fs.renameSync(await video.path(), path.join(CLIPS, `s${n}.webm`));
    state.trims = { ...(state.trims || {}), [n]: Number((sceneTrim || 0).toFixed(2)) };
    save();
    if (failed) break; // 장면은 앞 장면의 데이터에 기대므로 실패하면 멈춘다
}
await browser.close();
process.exit(failed ? 1 : 0);
