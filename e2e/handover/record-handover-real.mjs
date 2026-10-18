/**
 * 실제 앱에서 '업무 인계'가 일어나는 과정을 녹화한다.
 * (이 대화의 최초 요청 — 채팅으로 하던 업무를 다음 담당자에게 넘기는 그 순간)
 *
 * 사전 조건: frontend :8088 · 로컬 supabase · auth-state.json
 *           ROOM 환경변수로 산출물이 있는 방을 지정한다.
 *
 * 실행:
 *   cd services/frontend
 *   ROOM=<roomId> SB_KEY=<service_role_key> node e2e/handover/record-handover-real.mjs
 *
 * 산출물: e2e-results/gen-demo/handover/*.webm, gen-timeline-handover.json
 */
import { chromium } from '@playwright/test';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';

const BASE = process.env.BASE_URL || 'http://localhost:8088';
const ROOM = process.env.ROOM;
const SB_URL = process.env.SB_URL || 'http://127.0.0.1:54321';
const SB_KEY = process.env.SB_KEY || '';
const HERE = join(process.cwd(), 'e2e/handover');
const RAW_DIR = join(HERE, 'e2e-results/gen-demo/handover');
const TIMELINE = join(HERE, 'gen-timeline-handover.json');
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

async function handoverEventCount() {
    const res = await fetch(`${SB_URL}/rest/v1/handover_events?select=id`, {
        headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` }
    });
    if (!res.ok) throw new Error(`handover_events 조회 실패: ${res.status}`);
    return (await res.json()).length;
}

async function main() {
    if (!ROOM) throw new Error('ROOM 환경변수가 필요합니다');
    rmSync(RAW_DIR, { recursive: true, force: true });
    mkdirSync(RAW_DIR, { recursive: true });

    const before = await handoverEventCount();
    console.log('  인계 이벤트(시작 전):', before);

    const browser = await chromium.launch();
    const ctx = await browser.newContext({
        viewport: VIEWPORT,
        storageState: 'e2e/handover/auth-state.json',
        recordVideo: { dir: RAW_DIR, size: VIEWPORT },
        locale: 'ko-KR'
    });
    const page = await ctx.newPage();

    // ── 업무를 하던 대화방
    await page.goto(`${BASE}/chat?roomId=${ROOM}`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(11000);
    mark('업무 대화방');
    await caption(page, '채팅으로 업무를 하던 중', [
        '에이전트와 대화하며 산출물이 쌓였다.',
        '그런데 이 다음은 누가 무엇을 하는지는 시스템에 남지 않는다.'
    ]);
    await page.waitForTimeout(8000);

    // ── 인계하기
    await caption(page, '컴포저의 [인계하기] 버튼', [
        '다음 담당자에게 일을 넘기는 수단이 대화창 안에 있다.'
    ]);
    await page.waitForTimeout(4000);
    await page.getByRole('button', { name: /인계하기/ }).first().click();
    await page.waitForTimeout(4000);
    mark('인계 다이얼로그 열기');

    await caption(page, '이 방의 산출물이 자동으로 잡힌다', [
        '에이전트가 만든 작업 파일 · 폼 · 대화 기록이 인계 대상 후보로 올라온다.'
    ]);
    await page.waitForTimeout(8000);

    // ── 다음 단계 입력
    const dlg = page.locator('.v-dialog').last();
    await dlg.getByLabel('지금까지 한 일').fill('견적 처리 프로세스 정의와 폼 설계 완료');
    await page.waitForTimeout(1200);
    await dlg.getByLabel('다음에 할 일').fill('프로세스 배포 전 검토 및 승인');
    await page.waitForTimeout(1200);
    await dlg.getByLabel('지시사항').fill('생성된 프로세스 정의와 폼 5종을 확인하고, 역할 배정과 분기 조건이 실제 업무와 맞는지 검토해 주세요.');
    await page.waitForTimeout(2000);
    mark('다음 단계 작성');
    await caption(page, '다음에 할 일과 담당자를 지정한다', [
        '사람이든 AI 에이전트든 같은 목록에서 고른다 — 둘 다 조직도의 리소스이기 때문이다.'
    ]);
    await page.waitForTimeout(5000);

    // ── 담당자 선택
    const assignee = dlg.locator('.e2e-handover-assignee input').first();
    await assignee.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1500);
    await assignee.click();
    await page.waitForTimeout(3500);
    const opt = page.locator('.v-overlay .v-list-item').first();
    const optName = await opt.innerText().catch(() => '');
    await opt.click();
    await page.waitForTimeout(2500);
    mark('담당자 선택');
    console.log('  선택된 담당자:', optName.replace(/\n/g, ' ').slice(0, 40));

    // ── 인계 실행
    await caption(page, '인계하면 실제로 일이 넘어간다', [
        '수신자에게 방과 할 일이 만들어지고, 산출물이 함께 넘어간다.',
        '그리고 이 인계 사실이 이벤트로 기록된다.'
    ]);
    await page.waitForTimeout(5000);
    await dlg.getByRole('button', { name: /^인계하기$/ }).last().click();
    mark('인계 실행');

    // ── 기록 확인
    mark('인계 처리 대기', 'wait');
    for (let i = 0; i < 40; i++) {
        await page.waitForTimeout(3000);
        try { if ((await handoverEventCount()) > before) break; } catch {}
    }
    mark('인계 완료');
    const after = await handoverEventCount().catch(() => before);
    console.log(`  인계 이벤트: ${before} → ${after}`);
    await page.waitForTimeout(6000);

    await caption(page, '인계 기록이 쌓인다', [
        '누가 → 누구에게, 무엇을 넘겼는지가 이벤트로 남는다.',
        '이 기록이 쌓이면 반복되는 업무의 흐름이 드러난다.'
    ]);
    await page.waitForTimeout(8000);
    mark('구간 종료');

    await page.screenshot({ path: join(HERE, 's-handover-done.png') }).catch(() => {});
    await ctx.close();
    await browser.close();
    writeFileSync(TIMELINE, JSON.stringify({ room: ROOM, before, after, total: (Date.now() - t0) / 1000, marks }, null, 2), 'utf-8');
    console.log('\n타임라인 저장:', TIMELINE);
}

main().catch((e) => { console.error(e); process.exit(1); });
