#!/usr/bin/env node
// 온톨로지 근거 에이전트 판단(spec 018) — 데모 시나리오별 실제 화면 실행·녹화. 일반 BPM 모드(:8081).
//
//   python3 scripts/demo/ontology-decision/seed.py         # 데모 데이터(프로세스 3·KPI·상충·우선순위·에이전트)
//   node scripts/demo/ontology-decision/record.mjs 1        # 시나리오 1   — 정상(상충 없음)
//   node scripts/demo/ontology-decision/record.mjs 2.1      # 시나리오 2.1 — 상충 + 우선순위 → 에이전트가 선택
//   node scripts/demo/ontology-decision/record.mjs 2.2      # 시나리오 2.2 — 상충 + 우선순위 미정 → 에이전트가 담당자에게 질문
//   node scripts/demo/ontology-decision/record.mjs x        # 통합 — 긴 프로세스 한 건에서 세 경우가 차례로(판단 단계 3개)
//   node scripts/demo/ontology-decision/record.mjs 2.2 3 4  # 일부 장면만 다시
//
// 결과: docs/manuals/video/ontology-agent-decision/<sc>/clips/sN.webm, docs/manuals/images/ontology-agent-decision/*.png
// 합성: bash scripts/demo/ontology-decision/make-video.sh <sc> <ffmpeg> <ffprobe>
//
// 모든 단계는 화면에서 한다(정의 지도 → 상세 → 실행 → 업무 화면의 폼 입력·제출, 질문 카드 답). 화면 밖에서 하는 것은
// 에이전트 완료를 기다리는 DB 조회뿐이다. 실제 인스턴스를 만들고 남긴다(지우려면 seed.py --cleanup).
// 로그인 계정은 E2E_USER / E2E_PASS — 사람 단계 담당과 같아야 한다(seed.py --lead <이메일>).

import { chromium } from '@playwright/test';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE_URL || 'http://localhost:8081';
const EMAIL = process.env.E2E_USER || 'manual-shots@uengine.org';
const PASSWORD = process.env.E2E_PASS || 'manual-shots-pw';
const TENANT = 'tym';
const SIZE = { width: 1440, height: 900 };
const ROOT = 'docs/manuals/video/ontology-agent-decision';
const SHOTS = 'docs/manuals/images/ontology-agent-decision';

// 단계별 입력 문구는 점검 스크립트(check.py)와 같은 파일
const TEXTS = JSON.parse(fs.readFileSync(new URL('./scenarios.json', import.meta.url), 'utf8'));
const SCENARIOS = {
    1: { slug: 'sc1', proc: 'ont-dec-regular', procName: '소모품 정기 구매' },
    2.1: { slug: 'sc21', proc: 'ont-dec-urgent', procName: '생산 자재 긴급 구매' },
    // decide: 검수 Gateway 가 읽는 판단 단계(그 폼의 '적용 기준')
    // poAgent: 발주서 발행을 발주 처리 에이전트가 한다
    2.2: { slug: 'sc22', proc: 'ont-dec-parts', procName: '설비 부품 구매', answer: '품질', decide: 'Task_Decide', poAgent: true },
    x: { slug: 'scx', proc: 'ont-dec-expansion', procName: '생산라인 증설 자재 조달', answer: '품질', decide: 'Task_Parts' }
};

const sc = process.argv[2];
const cfg = SCENARIOS[sc];
const T = cfg ? TEXTS[cfg.proc] : {};
if (!cfg) {
    console.error('usage: record.mjs <1|2.1|2.2> [scene...]');
    process.exit(2);
}
const only = process.argv.slice(3).filter((a) => /^\d+$/.test(a)).map(Number);
const CLIPS = path.join(ROOT, cfg.slug, 'clips');
fs.mkdirSync(CLIPS, { recursive: true });
fs.mkdirSync(SHOTS, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const psql = (sql) =>
    execSync(`docker exec -i supabase_db_process-gpt-vue3 psql -U postgres -d postgres -At`, { input: sql }).toString().trim();
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

const STATE_FILE = path.join(CLIPS, 'state.json');
const state = fs.existsSync(STATE_FILE) ? JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) : {};
const save = () => fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));

// ---------------------------------------------------------------- 화면 도우미 (017 녹화 드라이버와 같은 방식)

async function closeSidebar(page) {
    for (let i = 0; i < 3; i++) {
        if (await page.evaluate(() => !!document.querySelector('.sidebar-closed'))) return;
        // 일반 모드는 헤더(#top)의 첫 버튼이 사이드바 토글이다
        await page.evaluate(() => {
            const pal = document.querySelector('button[aria-label="사이드바 접기"]');
            if (pal) pal.click();
            else document.querySelector('#top button')?.click();
        });
        await sleep(700);
    }
}

async function go(page, url, settle = 3500) {
    await page.goto(BASE + url, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await closeSidebar(page);
    await sleep(settle);
}

const CAPTION_INIT = () => {
    const draw = () => {
        const text = sessionStorage.getItem('__e2eCaption');
        let el = document.getElementById('__e2e_caption');
        if (!text) {
            el?.remove();
            return;
        }
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
    setInterval(() => {
        if (!document.getElementById('__e2e_caption') && sessionStorage.getItem('__e2eCaption')) draw();
    }, 500);
};

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

async function shot(page, name) {
    await page.evaluate(() => {
        const el = document.getElementById('__e2e_caption');
        if (el) el.style.visibility = 'hidden';
    });
    await page.screenshot({ path: path.join(SHOTS, name) });
    await page.evaluate(() => {
        const el = document.getElementById('__e2e_caption');
        if (el) el.style.visibility = 'visible';
    });
    console.log('  shot', name);
}

async function slowType(locator, text, delay = 18) {
    await locator.click();
    await locator.fill(''); // 숫자 칸의 기본값(0) 뒤에 이어 쓰지 않게
    await locator.pressSequentially(text, { delay });
}

// 단계 전용 폼(seed.py form_id_of) — 필드 이름(라벨)으로 찾아 값을 넣는다
const formId = (activity) => `${cfg.proc}-${activity}`.replace(/-/g, '_').toLowerCase() + '_form';
const fieldsOf = (activity) =>
    JSON.parse(psql(`select fields_json from public.form_def where tenant_id=${q(TENANT)} and id=${q(formId(activity))}`) || '[]');
const exact = (t) => new RegExp('^\\s*' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$');

async function fillField(page, scope, f, v, delay) {
    const field = scope.locator('.v-input', { has: page.locator('label', { hasText: exact(f.text) }) }).first();
    await field.scrollIntoViewIfNeeded();
    if (f.type === 'select') {
        await field.locator('.v-field').first().click();
        await sleep(600);
        await page.locator('.v-overlay--active .v-list-item', { hasText: exact(v) }).first().click();
        await sleep(500);
    } else if (f.type === 'date') {
        await field.locator('input').first().fill(v);
    } else {
        await slowType(field.locator(f.type === 'textarea' ? 'textarea:not(.v-textarea__sizer)' : 'input').first(), v, delay);
    }
    await sleep(250);
}

// 반복 행 — 행은 업무 화면이 앞 단계 값(rows_from)으로 미리 만든다. 기대한 행 수가 생겼는지 확인하고, 행마다 나머지 칸을 채운다.
async function fillRows(page, scope, f, rows, delay) {
    const items = scope.locator('.row-layout-box > div');
    await waitFor(async () => (await items.count()) === rows.length, { label: `${f.key} ${rows.length}행 자동 생성`, every: 500, timeout: 15_000 });
    for (let i = 0; i < rows.length; i++) {
        const item = items.nth(i);
        for (const sub of f.fields) {
            const v = rows[i][sub.key];
            if (v == null) continue;
            if (sub.key === f.row_key) {
                const got = await item.locator('.v-input', { has: page.locator('label', { hasText: exact(sub.text) }) }).locator('input').first().inputValue();
                if (got.trim() !== v) throw new Error(`${i + 1}행 ${sub.text}: '${got}' (기대 '${v}')`);
                continue;
            }
            await fillField(page, item, sub, v, delay);
        }
    }
}

async function fillForm(page, scope, activity, values, delay = 12) {
    for (const f of fieldsOf(activity)) {
        const v = values[f.key];
        if (v == null || f.readonly === 'true') continue;
        if (f.type === 'row-layout') await fillRows(page, scope, f, v, delay);
        else await fillField(page, scope, f, v, delay);
    }
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

const instPath = () => '/instancelist/' + state.instId.replace(/\./g, '_DOT_') + '?tab=todo';
const todoOf = (activity, col = 'id') =>
    psql(
        `select ${col} from public.todolist where tenant_id=${q(TENANT)} and proc_inst_id=${q(state.instId)} and activity_id=${q(activity)}`
    );
const P = { 1: '1', 2.1: '21', 2.2: '22', x: 'x' }[sc]; // 스크린샷 접두사

// 전략 보드 — 전략 카드 → KPI 수정 대화상자
async function openKpiDialog(page, objective, kpi) {
    await page.locator('.objective-card', { hasText: objective }).first().click();
    await sleep(1500);
    const card = page.locator('.detail-panel .v-card', { hasText: kpi }).first();
    await card.scrollIntoViewIfNeeded();
    await sleep(800);
    return card;
}
async function setPriority(page, label) {
    await page.locator('[data-testid="kpi-priority"]').click();
    await sleep(700);
    await page.locator('.v-overlay--active .v-list-item', { hasText: label }).first().click();
    await sleep(800);
}

// ---------------------------------------------------------------- 장면

// 정의 지도 → 프로세스 상세(흐름 소개)
async function openProcess(page, n, note) {
    await go(page, '/definition-map', 3000);
    await caption(page, `${n} 정의 지도 → 구매 운영 · AI 판단 시나리오 → <b>${cfg.procName}</b>`);
    const item = page.getByText(cfg.procName, { exact: true }).first();
    await item.scrollIntoViewIfNeeded();
    await sleep(2000);
    await item.click();
    await page.waitForURL(/definition-map\/sub\//, { timeout: 20_000 });
    await sleep(3500);
    await caption(page, `${n} ${note}`);
    await sleep(6000);
    await shot(page, `${P}-01-process.png`);
}

// 실행 → 첫 단계(구매 요청) 제출 → 인스턴스
async function startInstance(page, n, shots = true) {
    await caption(page, `${n} 실행 — 첫 단계 <b>구매 요청</b>(요청 부서) 폼을 채우고 제출`);
    await page.locator('button', { hasText: /^\s*실행\s*$/ }).first().click();
    await sleep(4500);
    await fillForm(page, page.locator('.v-overlay--active'), 'Task_Request', T.request);
    await sleep(1200);
    if (shots) await shot(page, `${P}-02-request.png`);
    await page.locator('.v-overlay--active button', { hasText: '제출 완료' }).first().click();
    await page.waitForURL(/instancelist\//, { timeout: 30_000 });
    state.instId = decodeURIComponent(page.url().split('/instancelist/')[1].split('?')[0]).replace(/_DOT_/g, '.');
    save();
    console.log('  instance', state.instId);
    await sleep(3500);
}

// 사람 단계 — 업무를 열어 쓰고 제출
async function humanStep(page, activity, values, note, shotName) {
    const id = await waitFor(() => (todoOf(activity, 'status') === 'IN_PROGRESS' ? todoOf(activity) : null), {
        label: activity + ' ready',
        every: 2000,
        timeout: 90_000
    });
    await go(page, '/todolist/' + id, 4000);
    await caption(page, note);
    await fillForm(page, page, activity, values);
    // 반복 행은 마지막 행까지 내려가 있다 — 촬영 전에 표 머리로 올린다
    await page.evaluate(() => document.querySelector('.row-layout-box')?.previousElementSibling?.scrollIntoView({ block: 'start' }));
    await sleep(1000);
    if (shotName) await shot(page, shotName);
    await page.locator('button', { hasText: '제출 완료' }).first().click();
    await waitFor(() => ['DONE', 'SUBMITTED'].includes(todoOf(activity, 'status')), { label: activity + ' done', every: 1500, timeout: 60_000 });
    await sleep(1500);
}

async function receiveAndQuote(page, n, shots = true) {
    await humanStep(page, 'Task_Receive', T.receive, `${n} 구매 담당 — 요청 접수·사양 확인`, shots && `${P}-03-receive.png`);
    await humanStep(page, 'Task_Quote', T.quote, `${n} 구매 담당 — 견적 접수(후보 공급사 두 곳의 단가·납기·품질)`, shots && `${P}-04-quote.png`);
}

async function waitAgent(page, want, activity = 'Task_Decide') {
    return waitFor(
        async () => {
            const st = todoOf(activity, 'status');
            return want.includes(st) ? st : null;
        },
        { label: `agent ${activity} ${want.join('|')}`, every: 3000, timeout: 360_000 }
    );
}

// 에이전트가 담당자에게 질문할 때까지 — 서비스 태스크는 업무가 PENDING, 오케스트레이션 워커(사용자 태스크)는
// 업무가 IN_PROGRESS 인 채 events 에 human_asked 가 생긴다
async function waitQuestion(page, activity = 'Task_Decide') {
    return waitFor(
        () => {
            const id = todoOf(activity);
            if (!id) return null;
            const asked = psql(`select count(*) from public.events where todo_id=${q(id)} and event_type='human_asked'`);
            return asked !== '0' || todoOf(activity, 'status') === 'PENDING';
        },
        { label: `question ${activity}`, every: 3000, timeout: 360_000 }
    );
}

// 에이전트 판단 단계의 보고서를 연다
async function openReport(page, activity, text, shotName) {
    await go(page, '/todolist/' + todoOf(activity), 4500);
    await caption(page, text);
    await sleep(6500);
    await shot(page, shotName);
}

// 에이전트 판단이 진행되는 칸반(실시간) → 보고서
async function agentScene(page, n, kanbanNote, reportNote, first) {
    await go(page, instPath(), 3000);
    await caption(page, `${n} ${kanbanNote}`);
    await waitAgent(page, ['DONE']);
    await sleep(4000);
    await shot(page, `${P}-${pad(first)}-kanban.png`);
    await openReport(page, 'Task_Decide', `${n} 에이전트 보고 — ${reportNote}`, `${P}-${pad(first + 1)}-report.png`);
}

const pad = (k) => String(k).padStart(2, '0');

// 정의 편집기 — 판단 단계(사용자 태스크)의 에이전트 탭
async function showAgentTab(page, n, activity = 'Task_Decide') {
    await go(page, '/definitions/' + cfg.proc, 6000);
    await page.locator(`g.djs-element.djs-shape[data-element-id='${activity}']`).first().dblclick();
    await sleep(2500);
    await page.locator('.v-tab', { hasText: '에이전트' }).first().click();
    await sleep(2000);
    await caption(page, `${n} 판단 단계 = <b>사용자 태스크 + 에이전트</b> — 기본 에이전트(langchain-react) · 완성 모드 · 구매 판단 에이전트`);
    await sleep(5000);
    await shot(page, `${P}-01b-agent-tab.png`);
}

const INSPECT = { Task_Inspect: '입고·검수(요청 부서)', Task_Inspect_Strict: '강화 검수(품질 관리)' };
// 판단 업무 폼의 '적용 기준' — 워커가 판단 근거 결과로 채우고 검수 Gateway 가 조건으로 읽는다
const chosenOf = (activity) =>
    psql(
        `select v->>'decision_chosen' from public.todolist t, jsonb_each(t.output) e(k, v) where t.tenant_id=${q(TENANT)} ` +
            `and t.proc_inst_id=${q(state.instId)} and t.activity_id=${q(activity)} and k like '%_form'`
    );

// 승인 → 발주서 발행 → (검수 Gateway) → 입고·검수 또는 강화 검수 → 완료
async function closeOut(page, n, first, { approve = T.approve, po = T.po, tag = '' } = {}) {
    await humanStep(page, 'Task_Approve', approve, `${n} 구매팀장 — 에이전트의 선정 결과와 근거(전략·KPI)를 보고 승인`, `${P}-${pad(first)}${tag}-approve.png`);
    if (cfg.poAgent) {
        await go(page, instPath(), 3000);
        await caption(page, `${n} <b>발주 처리 에이전트</b> — 승인 결과·판단·견적을 읽고 발주서를 쓴다`);
        await waitAgent(page, ['DONE'], 'Task_PO');
        await openReport(page, 'Task_PO', `${n} 에이전트가 쓴 발주서 — 발주 번호·공급사·약속 납기·조건`, `${P}-${pad(first)}${tag}-po.png`);
    } else {
        await humanStep(page, 'Task_PO', po, `${n} 구매 담당 — 승인된 공급사로 발주서 발행`, null);
    }
    const inspect = await waitFor(() => Object.keys(INSPECT).find((a) => todoOf(a, 'status') === 'IN_PROGRESS'), {
        label: 'inspection opened',
        every: 2000,
        timeout: 120_000
    });
    if (cfg.decide) {
        await go(page, instPath(), 3500);
        await caption(page, `${n} 검수 Gateway — 판단 단계의 적용 기준 <b>${chosenOf(cfg.decide)}</b> → <b>${INSPECT[inspect]}</b>`);
        await sleep(5500);
        await shot(page, `${P}-${pad(first)}${tag}-branch.png`);
    }
    const strict = inspect === 'Task_Inspect_Strict';
    await humanStep(page, inspect, strict ? T.inspect_strict : T.inspect, `${n} ${INSPECT[inspect]}`, strict ? `${P}-${pad(first)}${tag}-strict.png` : null);
    await waitFor(() => psql(`select status from public.bpm_proc_inst where proc_inst_id=${q(state.instId)}`) === 'COMPLETED', {
        label: 'instance completed',
        every: 2000,
        timeout: 90_000
    });
    await go(page, instPath(), 4000);
    await caption(page, `${n} 인스턴스 완료 — 요청부터 검수까지, 판단 단계는 온톨로지를 근거로`);
    await sleep(4500);
    await shot(page, `${P}-${pad(first + 1)}${tag}-done.png`);
}

// 질문 카드에서 답하기
async function answerQuestion(page, activity, note, answer, shots) {
    await go(page, '/todolist/' + todoOf(activity), 5000);
    await caption(page, note);
    await page.locator('.query-options').first().scrollIntoViewIfNeeded().catch(() => {});
    await sleep(4000);
    if (shots) await shot(page, shots[0]);
    await page.locator('.query-option', { hasText: answer }).first().click();
    await sleep(1500);
    await caption(page, `${note.split(' ')[0]} <b>${answer}</b> 기준 선택 → 확인`);
    if (shots) await shot(page, shots[1]);
    await page.locator('.query-confirm').first().click();
    await sleep(2000);
}

const FLOW = '요청 → 접수·사양 확인 → 견적 접수 → <b>에이전트 판단</b>(구매 판단 에이전트 레인) → 발주 승인 → 발주서 발행 → 입고·검수';
const FLOW_BRANCH =
    '요청 → 접수 → 견적 → <b>에이전트 판단</b> → 승인 → 발주서 발행 → <b>검수 Gateway</b>: 품질 우선 → 입고·검수 / 단가 우선 → 품질 관리 <b>강화 검수</b>';

const SCENES = {
    1: {
        async 1(page) {
            await openProcess(page, '①', FLOW);
            await showAgentTab(page, '①');
            await go(page, '/definition-map/sub/' + cfg.proc, 3500);
            await startInstance(page, '①');
        },
        async 2(page) {
            await receiveAndQuote(page, '②');
        },
        async 3(page) {
            await agentScene(page, '③', '에이전트가 판단 근거 조회 — 지배 KPI 2개, 상충 없음', '단가 절감률·계획 준수율을 함께 만족하는 A 공급사', 5);
        },
        async 4(page) {
            await closeOut(page, '④', 7);
        }
    },
    2.1: {
        async 1(page) {
            await go(page, '/strategy-board', 3000);
            await caption(page, '① 전략 보드 — 상충하는 두 KPI: 긴급 자재 <b>납기 준수율</b> ↔ <b>구매 단가 절감률</b>');
            const card = await openKpiDialog(page, '협력사 납기 신뢰도 향상', '긴급 자재 납기 준수율');
            await sleep(2500);
            await card.locator('button[aria-label="KPI 수정"]').click();
            await sleep(1800);
            await caption(page, '① 판단 우선순위 1(최우선) — 상충 시 실행 중 에이전트가 이 KPI 를 따른다');
            await setPriority(page, '1 (최우선)');
            await sleep(1500);
            await shot(page, `${P}-00-priority.png`);
            await page.locator('.v-overlay--active button', { hasText: '저장' }).last().click();
            await sleep(2500);
            await caption(page, '① 반대편 KPI(구매 단가 절감률)는 우선순위 2');
            const card2 = await openKpiDialog(page, '구매 원가 절감', '긴급 자재 구매 단가 절감률');
            await card2.locator('button[aria-label="KPI 수정"]').click();
            await sleep(1500);
            await setPriority(page, '2');
            await page.locator('.v-overlay--active button', { hasText: '저장' }).last().click();
            await sleep(2500);
            await openKpiDialog(page, '협력사 납기 신뢰도 향상', '긴급 자재 납기 준수율');
            await caption(page, '① KPI 카드: <b>우선 1</b> · <b>상충</b> 표시');
            await sleep(3500);
            await shot(page, `${P}-00b-board.png`);
        },
        async 2(page) {
            await openProcess(page, '②', FLOW);
            await startInstance(page, '②');
        },
        async 3(page) {
            await receiveAndQuote(page, '③');
        },
        async 4(page) {
            await agentScene(page, '④', '에이전트가 판단 근거 조회 — 상충 감지, 우선순위로 결정(묻지 않음)', '우선순위 1 인 납기 준수율을 따라 B 공급사, 단가 절감률은 포기', 5);
        },
        async 5(page) {
            await closeOut(page, '⑤', 7);
        }
    },
    2.2: {
        async 1(page) {
            await go(page, '/strategy-board', 3000);
            await caption(page, '① 전략 보드 — 설비 부품 <b>품질 합격률</b> ↔ <b>구매 단가 절감률</b> 상충, 우선순위는 정하지 않음');
            const card = await openKpiDialog(page, '협력사 관리 체계 고도화', '설비 부품 품질 합격률');
            await sleep(2500);
            await card.locator('button[aria-label="KPI 수정"]').click();
            await sleep(2000);
            await caption(page, '① 판단 우선순위 <b>미정</b> — 상충하면 에이전트가 그 업무에서 담당자에게 묻는다');
            await sleep(3500);
            await shot(page, `${P}-00-no-priority.png`);
            await page.locator('.v-overlay--active button', { hasText: '취소' }).last().click();
            await sleep(1500);
        },
        async 2(page) {
            await openProcess(page, '②', FLOW_BRANCH);
            await startInstance(page, '②');
        },
        async 3(page) {
            await receiveAndQuote(page, '③');
        },
        async 4(page) {
            await go(page, instPath(), 3000);
            await caption(page, '④ 에이전트가 상충을 감지 — 우선순위가 없어 스스로 정하지 않고 <b>담당자에게 질문</b>(답변 대기)');
            await waitQuestion(page);
            await sleep(4500);
            await shot(page, `${P}-05-kanban-waiting.png`);
            await answerQuestion(page, 'Task_Decide', '④ 질문 카드 — 이번 건은 어느 기준을 우선할까요? (선택지 = 상충하는 두 KPI)', cfg.answer, [
                `${P}-06-question.png`,
                `${P}-07-answer.png`
            ]);
        },
        async 5(page) {
            await go(page, instPath(), 3000);
            await caption(page, '⑤ 답을 받은 에이전트가 이어서 처리');
            await waitAgent(page, ['DONE']);
            await sleep(2500);
            await openReport(page, 'Task_Decide', '⑤ 에이전트 보고 — 사용자 선택(품질)을 근거로 B 공급사, 단가 절감률은 포기', `${P}-08-report.png`);
        },
        async 6(page) {
            await closeOut(page, '⑥', 9);
        },
        // 같은 프로세스, 다른 답 — 단가를 택하면 검수 Gateway 가 강화 검수로 보낸다. 두 번째 건도 화면에서 시작한다.
        async 7(page) {
            await go(page, '/definition-map/sub/' + cfg.proc, 3500);
            await startInstance(page, '⑦', false);
            await receiveAndQuote(page, '⑦', false);
            await waitQuestion(page);
            await go(page, instPath(), 3500);
            await caption(page, '⑦ 같은 프로세스의 두 번째 건 — 요청·견적은 같고, 이번에는 담당자가 <b>단가</b>를 택한다');
            await sleep(4500);
            await answerQuestion(page, 'Task_Decide', '⑦ 질문 카드 — 같은 질문, 다른 답', '단가', null);
            await go(page, instPath(), 3000);
            await waitAgent(page, ['DONE']);
            await openReport(page, 'Task_Decide', '⑦ 에이전트 보고 — 사용자 선택(단가)을 근거로 A 공급사, 품질 합격률은 포기', `${P}-11-report-cost.png`);
            await closeOut(page, '⑦', 12, { approve: T.approve_cost, po: T.po_cost, tag: '-cost' });
        }
    },
    x: {
        async 1(page) {
            await openProcess(page, '①', '요청 → 접수 → 견적 → <b>에이전트 판단 3단계</b>(포장 부자재 · 핵심 자재 · 설비 부품) → 통합 승인 → 발주 → <b>검수 Gateway</b>(설비 부품의 적용 기준)');
            await go(page, '/strategy-board', 3000);
            await caption(page, '① 같은 프로세스라도 판단 단계마다 근거 KPI 가 다르다 — KPI 의 <b>판단 적용 활동</b>');
            const card = await openKpiDialog(page, '협력사 납기 신뢰도 향상', '증설 핵심자재 납기 준수율');
            await card.locator('button[aria-label="KPI 수정"]').click();
            await sleep(2000);
            await page.locator('[data-testid="kpi-activities"]').scrollIntoViewIfNeeded();
            await caption(page, '① 증설 핵심자재 납기 준수율 — 적용 활동: 핵심 자재 조달 판단 · 우선순위 1 · 단가 절감률과 상충');
            await sleep(4500);
            await shot(page, 'x-00-kpi-scope.png');
            await page.locator('.v-overlay--active button', { hasText: '취소' }).last().click();
            await sleep(1200);
        },
        async 2(page) {
            await go(page, '/definition-map/sub/' + cfg.proc, 3500);
            await startInstance(page, '②');
            await receiveAndQuote(page, '②');
            await go(page, instPath(), 3000);
            await caption(page, '② 에이전트 판단 단계가 차례로 진행된다 — 칸반이 실시간으로 바뀐다');
            await waitAgent(page, ['DONE'], 'Task_Packaging');
            await sleep(4000);
            await shot(page, 'x-05-kanban.png');
        },
        async 3(page) {
            await openReport(page, 'Task_Packaging', '③ 판단 1 · 포장 부자재 — 상충 없음: 단가·계획 준수 KPI 를 함께 만족하는 A', 'x-06-report-packaging.png');
            await waitAgent(page, ['DONE'], 'Task_Core');
            await openReport(page, 'Task_Core', '③ 판단 2 · 핵심 자재 — 상충: 납기(우선순위 1) ↔ 단가(2) → 납기를 따라 B', 'x-07-report-core.png');
        },
        async 4(page) {
            await waitQuestion(page, 'Task_Parts');
            await go(page, instPath(), 3500);
            await caption(page, '④ 판단 3 · 설비 부품 — 상충인데 우선순위가 없어 <b>답변 대기</b>');
            await sleep(4500);
            await shot(page, 'x-08-kanban-waiting.png');
            await go(page, '/todolist/' + todoOf('Task_Parts'), 5000);
            await caption(page, '④ 질문 카드 — 품질 합격률과 단가 절감률 중 이번 건의 기준은?');
            await page.locator('.query-options').first().scrollIntoViewIfNeeded().catch(() => {});
            await sleep(4000);
            await shot(page, 'x-09-question.png');
            await page.locator('.query-option', { hasText: cfg.answer }).first().click();
            await sleep(1500);
            await caption(page, `④ <b>${cfg.answer}</b> 선택 → 확인`);
            await page.locator('.query-confirm').first().click();
            await sleep(2000);
            // (설비 부품 판단의 적용 기준이 뒤의 검수 Gateway 를 정한다)
        },
        async 5(page) {
            await waitAgent(page, ['DONE'], 'Task_Parts');
            await openReport(page, 'Task_Parts', '⑤ 판단 3 보고 — 사용자 선택(품질)을 근거로 B, 단가 절감률은 포기', 'x-10-report-parts.png');
        },
        async 6(page) {
            await go(page, instPath().replace('tab=todo', 'tab=output'), 4000);
            await caption(page, '⑥ 산출물 — 세 판단의 보고가 한곳에. 구매팀장이 함께 검토한다');
            await sleep(5000);
            await shot(page, 'x-11-outputs.png');
            await closeOut(page, '⑥', 12);
        }
    }
};

// ---------------------------------------------------------------- 실행

const scenes = SCENES[sc];
const run = only.length ? only : Object.keys(scenes).map(Number);
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
    if (failed) break;
}
await browser.close();
process.exit(failed ? 1 : 0);
