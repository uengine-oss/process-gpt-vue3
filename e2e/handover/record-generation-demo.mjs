/**
 * 마이닝으로 도출한 프로세스를 ProcessGPT 메인 대화창의 실제 생성 기능으로
 * 등록하는 과정을 녹화한다.
 *
 * 사전 조건 (모두 실제로 떠 있어야 한다):
 *   - frontend dev  :8088  (Node 22, 로컬 supabase 로 env override)
 *   - completion    :8099
 *   - deepagents    :8888
 *   - e2e/handover/auth-state.json (demo@localhost 로그인 상태)
 *
 * 실행: cd services/frontend && node e2e/handover/record-generation-demo.mjs
 * 산출물:
 *   e2e/handover/e2e-results/gen-demo/*.webm  (원본 녹화)
 *   e2e/handover/gen-timeline.json            (구간 타임스탬프 — 배속 편집에 쓴다)
 */
import { chromium } from '@playwright/test';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';

const BASE = process.env.BASE_URL || 'http://localhost:8088';
const RAW_DIR = join(process.cwd(), 'e2e/handover/e2e-results/gen-demo');
const TIMELINE = join(process.cwd(), 'e2e/handover/gen-timeline.json');
const VIEWPORT = { width: 1600, height: 900 };

const BRIEF = `실제 인계 기록 35건(업무 케이스 8건)을 분석해 반복되는 공통 흐름을 찾았어. 이걸 정식 프로세스로 만들어줘.

견적 처리 프로세스
1) 견적 산출 — 견적 산출 에이전트가 자동 수행
2) 견적서 검토 및 승인 — 영업총괄이 승인 여부 결정
3) 승인되지 않으면 견적 재산출 — 영업담당이 수정 (승인되면 이 단계는 건너뜀)
4) 계약서 초안 작성 — 계약검토 에이전트가 자동 수행
5) 고객 발송 — 영업담당`;

const t0 = Date.now();
const marks = [];
/** 구간 표시. phase='event' 는 실시간 유지, 'wait' 는 나중에 배속 압축한다. */
function mark(name, phase) {
    const at = (Date.now() - t0) / 1000;
    marks.push({ name, phase, at });
    console.log(`[${at.toFixed(1)}s] ${phase === 'wait' ? '⏳' : '▶'} ${name}`);
}

async function caption(page, title, lines) {
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

/** 조건이 만족될 때까지 기다리되, 최대 대기시간을 넘기면 false. */
async function waitFor(page, fn, { timeout = 600000, interval = 3000, label = '' } = {}) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        try {
            if (await fn()) return true;
        } catch {
            /* 페이지 전환 중이면 다음 폴에서 재시도 */
        }
        await page.waitForTimeout(interval);
    }
    console.warn(`  (타임아웃: ${label})`);
    return false;
}

const bodyText = (page) => page.locator('body').innerText().catch(() => '');

// 대기 판정은 화면 문구가 아니라 DB 를 직접 본다.
// LLM 응답 문구는 매번 달라서("진행할까요" / "'진행' 또는 '수정 의견'" ...)
// 본문 정규식으로는 신뢰할 수 없다.
const SB_URL = process.env.SB_URL || 'http://127.0.0.1:54321';
const SB_KEY = process.env.SB_KEY || '';

async function fetchMsgs(roomId) {
    const res = await fetch(`${SB_URL}/rest/v1/chats?id=eq.${roomId}&select=uuid,messages`, {
        headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` }
    });
    if (!res.ok) throw new Error(`chats 조회 실패: ${res.status}`);
    const rows = await res.json();
    return rows
        .map((r) => r.messages)
        .filter(Boolean)
        .sort((a, b) => String(a.timeStamp).localeCompare(String(b.timeStamp)));
}

/** 어시스턴트(에이전트) 응답 개수 */
async function agentReplyCount(roomId) {
    const msgs = await fetchMsgs(roomId);
    return msgs.filter((m) => (m.role || '') !== 'user' && String(m.content || '').trim()).length;
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

    // ── 1. 메인 화면
    await page.goto(`${BASE}/chat`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(9000);
    mark('메인 화면 진입', 'event');
    await caption(page, 'ProcessGPT 메인 화면', [
        '왼쪽에 대화 목록과 실행 중인 프로세스 인스턴스가 보인다.',
        '이 대화창에서 업무를 설명하면 실행 가능한 프로세스가 만들어진다.'
    ]);
    await page.waitForTimeout(6000);

    // ── 2. 새 대화 (빈 방을 직접 만들어 이동한다 — 이전 대화가 섞이면
    //     대기 조건이 지난 메시지에 걸려 즉시 통과해 버린다)
    const roomId = crypto.randomUUID();
    await page.evaluate(async ({ roomId }) => {
        const me = JSON.parse(localStorage.getItem('userInfo') || '{}');
        const uid = localStorage.getItem('uid');
        await window.$supabase.from('chat_rooms').insert({
            id: roomId,
            tenant_id: window.$tenantName,
            name: '견적 처리 프로세스 만들기',
            participants: [
                { id: uid, email: localStorage.getItem('email'), username: me.name || 'demo',
                  profile: '/assets/images/profile/user-3.jpg', is_agent: null, agent_type: null },
                { id: 'process-gpt-agent', email: null, username: 'Process GPT Agent',
                  profile: '/images/chat-icon.png', is_agent: true, agent_type: 'agent' }
            ],
            message: { msg: 'NEW', type: 'text', createdAt: new Date().toISOString() }
        });
    }, { roomId });
    await page.goto(`${BASE}/chat?roomId=${roomId}`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(8000);
    mark('새 대화 시작', 'event');
    console.log('  roomId =', roomId);

    // ── 3. 마이닝 결과를 그대로 설명
    await caption(page, '인계 기록에서 찾아낸 흐름을 그대로 설명한다', [
        '앞서 프로세스 마이닝이 인계 로그 35건 · 케이스 8건에서 도출한 결과다.',
        '조건부 단계(견적 재산출)까지 문장으로 그대로 옮긴다.'
    ]);
    const input = page.locator('textarea:not([disabled]):visible').first();
    await input.click();
    await input.fill(BRIEF);
    await page.waitForTimeout(2500);
    await page.keyboard.press('Enter');
    mark('서술문 전송', 'event');
    await page.waitForTimeout(4000);

    // ── 4. 컨설팅 초안 대기 (LLM)
    mark('초안 생성 대기 시작', 'wait');
    const gotDraft = await waitFor(page, async () => (await agentReplyCount(roomId)) >= 1, {
        timeout: 600000, label: '컨설팅 초안'
    });
    mark('초안 생성 대기 끝', 'event');
    if (!gotDraft) console.warn('  초안을 못 받았지만 계속 진행');
    await caption(page, 'Process GPT 가 흐름을 정리해 확인을 요청한다', [
        '바로 만들지 않고, 이해한 내용을 먼저 보여주고 승인을 받는다.',
        '마이닝이 찾아낸 조건부 단계가 그대로 반영되어 있다.'
    ]);
    await page.waitForTimeout(9000);

    // ── 5. 승인
    const input2 = page.locator('textarea:not([disabled]):visible').first();
    await input2.click();
    await input2.fill('진행해줘');
    await page.waitForTimeout(1500);
    await page.keyboard.press('Enter');
    mark('승인 전송', 'event');
    await page.waitForTimeout(4000);

    // ── 6. 생성 대기 (LLM + 스킬)
    await caption(page, '실행 가능한 프로세스를 생성한다', [
        '역할 · 폼 · 분기 조건까지 갖춘 프로세스 정의가 만들어진다.',
        '자동 수행 단계에는 에이전트가 그대로 배정된다.'
    ]);
    mark('프로세스 생성 대기 시작', 'wait');
    const gotResult = await waitFor(page, async () => {
        if ((await page.locator('.djs-container, .bjs-container').count()) > 0) return true;
        return (await agentReplyCount(roomId)) >= 2; // 초안 + 생성완료
    }, { timeout: 900000, label: '프로세스 생성' });
    mark('프로세스 생성 대기 끝', 'event');
    await page.waitForTimeout(5000);
    await page.screenshot({ path: 'e2e/handover/s-gen-done.png' }).catch(() => {});

    // ── 7. 산출물 확인 + 저장(배포)
    let saved = false;
    if (gotResult) {
        await caption(page, '생성된 프로세스를 확인한다', [
            '오른쪽 패널에서 만들어진 프로세스 정의와 폼을 볼 수 있다.'
        ]);
        await page.waitForTimeout(7000);

        const saveBtn = page.getByRole('button', { name: /^저장$|저장하기/ }).first();
        const hasSave = (await saveBtn.count()) > 0;
        console.log('  저장 버튼:', hasSave ? '있음' : '없음');
        if (hasSave) {
            await caption(page, '저장하면 바로 쓸 수 있는 프로세스로 등록된다', [
                '프로세스 정의와 폼이 ProcessGPT 에 배포된다.'
            ]);
            await saveBtn.click();
            mark('저장(배포) 클릭', 'event');
            saved = await waitFor(page, async () => /저장됨|저장되었|등록되었/.test(await bodyText(page)), {
                timeout: 180000, label: '저장 완료'
            });
            mark('저장 완료', 'event');
            await page.waitForTimeout(6000);
        }
    }

    await caption(page, saved ? '등록 완료' : '생성 완료', [
        '인계 기록에서 찾아낸 업무 흐름이 실행 가능한 프로세스가 되었다.'
    ]);
    await page.waitForTimeout(7000);
    mark('종료', 'event');

    await page.screenshot({ path: 'e2e/handover/s-gen-final.png' }).catch(() => {});
    await ctx.close();
    await browser.close();

    writeFileSync(TIMELINE, JSON.stringify({ roomId, total: (Date.now() - t0) / 1000, marks }, null, 2), 'utf-8');
    console.log('\n타임라인 저장:', TIMELINE);
    console.log('원본 녹화:', RAW_DIR);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
