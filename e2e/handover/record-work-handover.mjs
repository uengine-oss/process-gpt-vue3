/**
 * 실제 업무 대화 → 인계 전 과정을 녹화한다.
 *
 * 앞선 녹화는 '프로세스를 만드는 대화' 였을 뿐, 정작 **업무를 주고받는 대화**가 없었다.
 * 여기서는 견적 업무를 실제로 대화로 처리한 뒤(여러 턴), 그 산출물을 다음 담당자에게
 * 넘기는 과정을 버튼 클릭까지 그대로 담는다.
 *
 * 사전 조건: frontend :8088 · deepagents :8888 · auth-state.json
 * 실행: cd services/frontend && SB_KEY=<service_role_key> node e2e/handover/record-work-handover.mjs
 * 산출물: e2e-results/gen-demo/work/*.webm, gen-timeline-work.json
 */
import { chromium } from '@playwright/test';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';

const BASE = process.env.BASE_URL || 'http://localhost:8088';
const SB_URL = process.env.SB_URL || 'http://127.0.0.1:54321';
const SB_KEY = process.env.SB_KEY || '';
const HERE = join(process.cwd(), 'e2e/handover');
const RAW_DIR = join(HERE, 'e2e-results/gen-demo/work');
const TIMELINE = join(HERE, 'gen-timeline-work.json');
const VIEWPORT = { width: 1600, height: 900 };

/** 실제 업무 대화 — 견적 요청을 받아 처리하는 흐름 */
const TURNS = [
    '대성산업에서 자동화 설비 12대 견적 요청이 왔어. 작년 단가표 기준으로 견적서 초안 좀 잡아줘.',
    '수량이 10대를 넘으니까 볼륨 할인 조건도 반영해줘. 납기는 언제로 잡으면 될까?'
];

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

async function agentReplyCount(roomId) {
    const res = await fetch(`${SB_URL}/rest/v1/chats?id=eq.${roomId}&select=messages`, {
        headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` }
    });
    if (!res.ok) throw new Error(`chats 조회 실패: ${res.status}`);
    return (await res.json())
        .map((r) => r.messages)
        .filter((m) => m && (m.role || '') !== 'user' && String(m.content || '').trim()).length;
}

async function handoverCount() {
    const res = await fetch(`${SB_URL}/rest/v1/handover_events?select=id`, {
        headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` }
    });
    return res.ok ? (await res.json()).length : 0;
}

async function waitFor(page, fn, { timeout = 600000, interval = 3000, label = '' } = {}) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        try { if (await fn()) return true; } catch {}
        await page.waitForTimeout(interval);
    }
    console.warn(`  (타임아웃: ${label})`);
    return false;
}

/** 사람이 치는 것처럼 보이게 천천히 입력 */
async function typeSlowly(page, text) {
    const input = page.locator('textarea:not([disabled]):visible').first();
    await input.click({ timeout: 60000 });
    await input.type(text, { delay: 18 });
    await page.waitForTimeout(900);
    await page.keyboard.press('Enter');
}

async function main() {
    rmSync(RAW_DIR, { recursive: true, force: true });
    mkdirSync(RAW_DIR, { recursive: true });
    const hoBefore = await handoverCount();

    const browser = await chromium.launch();
    const ctx = await browser.newContext({
        viewport: VIEWPORT, storageState: 'e2e/handover/auth-state.json',
        recordVideo: { dir: RAW_DIR, size: VIEWPORT }, locale: 'ko-KR'
    });
    const page = await ctx.newPage();

    // ── 메인 화면
    await page.goto(`${BASE}/chat`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(9000);
    mark('메인 화면');
    await caption(page, 'ProcessGPT 메인 화면', [
        '왼쪽에 대화 목록과 진행 중인 업무가 보인다.',
        '오늘은 견적 요청 하나를 이 대화창에서 처리한다.'
    ]);
    await page.waitForTimeout(6000);

    // ── 새 업무 대화방
    const roomId = crypto.randomUUID();
    await page.evaluate(async ({ roomId }) => {
        const uid = localStorage.getItem('uid');
        await window.$supabase.from('chat_rooms').insert({
            id: roomId, tenant_id: window.$tenantName, name: '대성산업 견적 요청',
            participants: [
                { id: uid, email: localStorage.getItem('email'), username: 'demo',
                  profile: '/assets/images/profile/user-3.jpg', is_agent: null, agent_type: null },
                { id: 'process-gpt-agent', email: null, username: 'Process GPT Agent',
                  profile: '/images/chat-icon.png', is_agent: true, agent_type: 'agent' }
            ],
            message: { msg: 'NEW', type: 'text', createdAt: new Date().toISOString() }
        });
    }, { roomId });
    await page.goto(`${BASE}/chat?roomId=${roomId}`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(7000);
    mark('업무 대화 시작');
    console.log('  roomId =', roomId);

    await caption(page, '들어온 요청을 대화로 처리한다', [
        '별도 시스템을 열지 않고, 대화창에서 에이전트와 함께 일한다.'
    ]);

    // ── 실제 업무 대화 (여러 턴)
    for (let i = 0; i < TURNS.length; i++) {
        await typeSlowly(page, TURNS[i]);
        mark(`업무 질문 ${i + 1}`);
        await page.waitForTimeout(2500);
        mark(`응답 대기 ${i + 1}`, 'wait');
        await waitFor(page, async () => (await agentReplyCount(roomId)) >= i + 1, {
            timeout: 420000, label: `응답 ${i + 1}`
        });
        mark(`응답 도착 ${i + 1}`);
        // 대화가 흘러가는 걸 보여준다
        await page.mouse.wheel(0, 400);
        await page.waitForTimeout(6000);
    }

    await caption(page, '산출물이 대화 안에 쌓였다', [
        '견적 근거와 납기까지 정리됐다. 그런데 이 다음은 상무님 승인이 필요하다.',
        '지금까지는 여기서 흐름이 끊겼다 — 다음이 누구인지 시스템에 남지 않았다.'
    ]);
    await page.waitForTimeout(9000);

    // ── 인계 (버튼 클릭이 보이게)
    await caption(page, '컴포저의 [인계하기] 버튼을 누른다', [
        '대화창 안에서 바로 다음 담당자에게 넘길 수 있다.'
    ]);
    await page.waitForTimeout(4000);
    const btn = page.getByRole('button', { name: /인계하기/ }).first();
    await btn.scrollIntoViewIfNeeded().catch(() => {});
    await btn.hover().catch(() => {});
    await page.waitForTimeout(1500);
    await btn.click();
    mark('인계 버튼 클릭');
    await page.waitForTimeout(4000);

    await caption(page, '이 대화의 산출물이 자동으로 모인다', [
        '작업 파일 · 첨부 · 대화 기록이 인계 대상 후보로 올라온다.'
    ]);
    await page.waitForTimeout(7000);

    const dlg = page.locator('.v-dialog').last();
    await dlg.getByLabel('지금까지 한 일').fill('대성산업 견적서 초안 작성 (볼륨 할인·납기 반영)');
    await page.waitForTimeout(1200);
    await dlg.getByLabel('다음에 할 일').fill('견적서 검토 및 승인');
    await page.waitForTimeout(1200);
    await dlg.getByLabel('지시사항').fill('할인율이 승인 한도 이내인지, 납기 4주가 생산팀과 합의 가능한지 확인해 주세요.');
    await page.waitForTimeout(2000);
    mark('다음 단계 작성');

    await caption(page, '다음 담당자를 지정한다', [
        '전체 · 사람 · 에이전트 탭으로 나눠 고른다.',
        '이 단계를 실제로 수행해 온 사람은 자격 보유로 표시된다.'
    ]);
    const tabs = dlg.locator('.e2e-assignee-tabs');
    await tabs.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(2500);
    // '사람' 탭으로 좁힌다 — 승인은 사람이 해야 하는 단계다
    await dlg.getByRole('tab', { name: /사람/ }).click().catch(() => {});
    await page.waitForTimeout(3000);
    const person = dlg.locator('.e2e-assignee-item', { hasText: '박상무' }).first();
    await person.scrollIntoViewIfNeeded().catch(() => {});
    await person.hover().catch(() => {});
    await page.waitForTimeout(1200);
    await person.click();
    await page.waitForTimeout(2500);
    mark('담당자 선택');

    await page.waitForTimeout(3000);
    await dlg.getByRole('button', { name: /^인계하기$/ }).last().click();
    mark('인계 실행');
    mark('인계 처리 대기', 'wait');
    await waitFor(page, async () => (await handoverCount()) > hoBefore, { timeout: 120000, interval: 2500, label: '인계 기록' });
    mark('인계 완료');
    await page.waitForTimeout(6000);

    await caption(page, '넘어간 흔적이 기록된다', [
        '수신자에게 방과 할 일이 생기고, 산출물이 함께 넘어간다.',
        '누가 → 누구에게 무엇을 넘겼는지가 이벤트로 남는다.'
    ]);
    await page.waitForTimeout(8000);
    mark('구간 종료');

    await page.screenshot({ path: join(HERE, 's-work-done.png') }).catch(() => {});
    await ctx.close();
    await browser.close();
    writeFileSync(TIMELINE, JSON.stringify({ roomId, total: (Date.now() - t0) / 1000, marks }, null, 2), 'utf-8');
    console.log('\n타임라인 저장:', TIMELINE);
}

main().catch((e) => { console.error(e); process.exit(1); });
