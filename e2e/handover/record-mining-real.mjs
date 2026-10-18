/**
 * 실제 앱의 '인계 마이닝' 화면(/mining/handover)을 녹화한다.
 * 쌓인 인계 기록 → 스레드 묶음 → 도출된 프로세스(기존 BPMN 모델러) → PR 제안.
 *
 * 사전 조건: frontend :8088 · process-miner :8014 · auth-state.json
 * 실행: cd services/frontend && node e2e/handover/record-mining-real.mjs
 * 산출물: e2e-results/gen-demo/mining/*.webm, gen-timeline-mining.json
 */
import { chromium } from '@playwright/test';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';

const BASE = process.env.BASE_URL || 'http://localhost:8088';
const HERE = join(process.cwd(), 'e2e/handover');
const RAW_DIR = join(HERE, 'e2e-results/gen-demo/mining');
const TIMELINE = join(HERE, 'gen-timeline-mining.json');
const VIEWPORT = { width: 1600, height: 900 };

const t0 = Date.now();
const marks = [];
function mark(name, phase = 'event') {
    const at = (Date.now() - t0) / 1000;
    marks.push({ name, phase, at });
    console.log(`[${at.toFixed(1)}s] ${phase === 'wait' ? '⏳' : '▶'} ${name}`);
}

async function caption(page, title, lines) {
    await Promise.race([_caption(page, title, lines), new Promise((r) => setTimeout(r, 5000))]).catch(() => {});
}
async function _caption(page, title, lines) {
    await page.evaluate(
        ({ title, lines }) => {
            let box = document.getElementById('demo-caption');
            if (!box) {
                box = document.createElement('div');
                box.id = 'demo-caption';
                Object.assign(box.style, {
                    position: 'fixed', left: '0', right: '0', bottom: '0', zIndex: '2147483647',
                    padding: '14px 26px', background: 'rgba(17,12,26,.94)', color: '#fff',
                    fontFamily: 'system-ui,-apple-system,"Apple SD Gothic Neo",sans-serif',
                    borderTop: '4px solid #68369a', pointerEvents: 'none'
                });
                document.body.appendChild(box);
            }
            box.innerHTML =
                `<div style="font-size:18px;font-weight:700;margin-bottom:5px;color:#c9a6e9">${title}</div>` +
                lines.map((l) => `<div style="font-size:14px;line-height:1.55;opacity:.92">${l}</div>`).join('');
        },
        { title, lines }
    );
}

async function main() {
    rmSync(RAW_DIR, { recursive: true, force: true });
    mkdirSync(RAW_DIR, { recursive: true });

    const browser = await chromium.launch();
    const ctx = await browser.newContext({
        viewport: VIEWPORT,
        storageState: 'e2e/handover/auth-state.json',
        recordVideo: { dir: RAW_DIR, size: VIEWPORT },
        locale: 'ko-KR'
    });
    const page = await ctx.newPage();

    // 메뉴를 통해 들어가는 모습을 담는다 — URL 직접 진입은 '어느 메뉴인지' 가 안 보인다.
    await page.goto(`${BASE}/chat`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(3500);
    mark('메인 화면');
    await caption(page, '식별된 프로세스는 어디에서 보나', [
        '기존 프로세스를 고치는 것이 아니라, 아직 정의되지 않은 업무를 찾아내는 화면이다.'
    ]);
    await page.waitForTimeout(3500);

    // 사이드바에서 '프로세스 식별' 메뉴 클릭
    let entered = false;
    try {
        const menu = page.getByText('프로세스 식별', { exact: true }).first();
        await menu.scrollIntoViewIfNeeded({ timeout: 5000 });
        await menu.hover();
        await page.waitForTimeout(1200);
        await menu.click({ timeout: 8000 });
        await page.waitForTimeout(3000);
        entered = page.url().includes('/mining/handover');
        mark('메뉴로 진입');
    } catch (e) {
        console.warn('  메뉴 클릭 실패, URL 로 진입:', e?.message || e);
    }
    if (!entered) {
        await page.goto(`${BASE}/mining/handover`, { waitUntil: 'load', timeout: 60000 });
        mark('식별 화면 열기');
    }
    mark('분석 대기', 'wait');
    // 도출이 끝나 BPMN 이 그려질 때까지
    for (let i = 0; i < 60; i++) {
        await page.waitForTimeout(2000);
        if ((await page.locator('.djs-element').count()) > 3) break;
    }
    mark('분석 완료');
    await page.waitForTimeout(3000);

    await caption(page, '쌓인 인계 기록을 스레드로 묶는다', [
        '한 업무가 여러 방과 여러 담당자를 거쳐도, 최초 시작된 방을 기준으로 한 줄기가 된다.',
        '파란 칩은 에이전트가 수행한 단계, 점선은 버튼 없이 자동 기록된 위임이다.'
    ]);
    await page.waitForTimeout(3500);

    await caption(page, '반복되는 흐름에서 프로세스를 도출한다', [
        '도출 결과는 기존 BPMN 모델러로 그대로 표시된다 — 역할 레인과 분기까지.',
        '8건 중 3건에만 있던 견적 재산출은 건너뛸 수 있는 조건부 단계로 구분된다.'
    ]);
    await page.waitForTimeout(4000);

    // 도출된 프로세스로 스크롤/포커스
    const canvas = page.locator('.mining-canvas').first();
    await canvas.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(4000);

    await caption(page, '자동 수행 단계는 에이전트가 그대로 배정된다', [
        '견적 산출과 계약서 초안 작성은 지금까지 에이전트가 처리해 왔다.',
        '도출된 프로세스에도 그 배정이 유지된다.'
    ]);
    await page.waitForTimeout(3500);

    // PR 제안
    await caption(page, '도출 결과는 PR 로 제안된다', [
        '살아 있는 프로세스 정의는 건드리지 않는다. 승인해야 반영된다.'
    ]);
    await page.waitForTimeout(4000);
    const btn = page.locator('.e2e-propose-pr').first();
    if (await btn.count()) {
        await btn.click();
        mark('PR 제안 클릭');
        for (let i = 0; i < 40; i++) {
            await page.waitForTimeout(2000);
            if (await page.locator('.e2e-pr-result').count()) break;
        }
        mark('PR 생성 완료');
        await page.waitForTimeout(3500);
    } else {
        console.warn('  제안 버튼을 찾지 못함');
    }

    // 이후 구간은 브라우저가 예기치 않게 닫혀도 타임라인이 남도록 감싼다
    try {
    // 조직 마이닝 결과
    await caption(page, '누가 이 일을 할 수 있는지도 함께 나온다', [
        '인계 기록에서 활동별 수행자와 역할이 도출된다.',
        '근거 건수가 함께 남아 왜 이 사람이 후보인지 설명된다.'
    ]);
    const org = page.locator('.mining-org').first();
    await org.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(3500);

    // 실행 전환 — 서술을 다시 입력하지 않는다
    await caption(page, '여기서 바로 실행으로 연결한다', [
        '이미 BPMN 으로 모델링된 결과가 있으므로 프로세스를 말로 다시 설명할 이유가 없다.',
        '전환 버튼을 누르면 도출 결과를 실은 대화창이 열린다.'
    ]);
    await page.waitForTimeout(3500);
    const conv = page.locator('.e2e-convert-process').first();
    await conv.scrollIntoViewIfNeeded().catch(() => {});
    await conv.hover().catch(() => {});
    await page.waitForTimeout(1500);
    await conv.click({ timeout: 20000 });
    mark('실행 전환 클릭');
    // 대화창으로 이동해 자동 전송이 시작되는 것까지
    for (let i = 0; i < 30; i++) {
        await page.waitForTimeout(2000);
        if (page.url().includes('/chat?roomId=')) break;
    }
    mark('전환 대화창 열림');
    await page.waitForTimeout(4000);
    await caption(page, '요청문이 이미 들어가 있다', [
        '식별된 단계와 담당 역할, 관측 근거가 그대로 전달된다.',
        '사용자는 아무것도 다시 입력하지 않았다.'
    ]);
    await page.waitForTimeout(3500);

    } catch (e) {
        console.warn('  이후 구간 중단:', e?.message || e);
    }

    mark('구간 종료');
    await page.screenshot({ path: join(HERE, 's-mining-final.png') }).catch(() => {});
    await ctx.close().catch(() => {});
    await browser.close().catch(() => {});
    writeFileSync(TIMELINE, JSON.stringify({ total: (Date.now() - t0) / 1000, marks }, null, 2), 'utf-8');
    console.log('\n타임라인 저장:', TIMELINE);
}

main().catch((e) => { console.error(e); process.exit(1); });
