/**
 * 마이닝으로 도출한 프로세스를 ProcessGPT 메인 대화창의 실제 생성 기능으로
 * 등록하는 과정을 녹화한다. 한 번에 다 찍으면 실행이 길어져 중간에 끊기므로
 * 두 구간으로 나눠 찍고 나중에 이어붙인다.
 *
 *   PART=1  메인화면 → 새 대화 → 서술문 전송 → 컨설팅 초안 수신
 *   PART=2  같은 방 열기 → 승인 → 프로세스 생성 → 저장(배포)
 *
 * 사전 조건: frontend :8088 · completion :8099 · deepagents :8888 · auth-state.json
 *
 * 실행:
 *   cd services/frontend
 *   SB_KEY=<service_role_key> PART=1 node e2e/handover/record-part.mjs
 *   SB_KEY=<service_role_key> PART=2 node e2e/handover/record-part.mjs
 *
 * 산출물: e2e-results/gen-demo/part<N>/*.webm, gen-timeline-part<N>.json,
 *        gen-room.json(두 구간이 같은 방을 쓰도록 roomId 전달)
 */
import { chromium } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';

const PART = Number(process.env.PART || 1);
const BASE = process.env.BASE_URL || 'http://localhost:8088';
const HERE = join(process.cwd(), 'e2e/handover');
const RAW_DIR = join(HERE, `e2e-results/gen-demo/part${PART}`);
const ROOM_FILE = join(HERE, 'gen-room.json');
const TIMELINE = join(HERE, `gen-timeline-part${PART}.json`);
const VIEWPORT = { width: 1600, height: 900 };

const SB_URL = process.env.SB_URL || 'http://127.0.0.1:54321';
const SB_KEY = process.env.SB_KEY || '';

const BRIEF = `실제 인계 기록 35건(업무 케이스 8건)을 분석해 반복되는 공통 흐름을 찾았어. 이걸 정식 프로세스로 만들어줘.

견적 처리 프로세스
1) 견적 산출 — 견적 산출 에이전트가 자동 수행
2) 견적서 검토 및 승인 — 영업총괄이 승인 여부 결정
3) 승인되지 않으면 견적 재산출 — 영업담당이 수정 (승인되면 이 단계는 건너뜀)
4) 계약서 초안 작성 — 계약검토 에이전트가 자동 수행
5) 고객 발송 — 영업담당`;

const t0 = Date.now();
const marks = [];
function mark(name, phase) {
    const at = (Date.now() - t0) / 1000;
    marks.push({ name, phase, at });
    console.log(`[${at.toFixed(1)}s] ${phase === 'wait' ? '⏳' : '▶'} ${name}`);
}

async function caption(page, title, lines) {
    // 응답 스트리밍 중에는 페이지 JS 스레드가 바빠 evaluate 가 오래 걸릴 수 있다.
    // 자막 때문에 녹화 전체가 멈추지 않도록 상한을 둔다.
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

async function waitFor(page, fn, { timeout = 600000, interval = 3000, label = '' } = {}) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        try {
            if (await fn()) return true;
        } catch { /* 전환 중이면 다음 폴에서 재시도 */ }
        await page.waitForTimeout(interval);
    }
    console.warn(`  (타임아웃: ${label})`);
    return false;
}

// 대기 판정은 화면 문구가 아니라 DB 를 본다 — LLM 응답 문구가 매번 달라진다.
async function agentReplyCount(roomId) {
    const res = await fetch(`${SB_URL}/rest/v1/chats?id=eq.${roomId}&select=messages`, {
        headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` }
    });
    if (!res.ok) throw new Error(`chats 조회 실패: ${res.status}`);
    const rows = await res.json();
    return rows
        .map((r) => r.messages)
        .filter((m) => m && (m.role || '') !== 'user' && String(m.content || '').trim())
        .length;
}

async function typeAndSend(page, text, pause = 2000) {
    const input = page.locator('textarea:not([disabled]):visible').first();
    await input.click({ timeout: 60000 });
    await input.fill(text);
    await page.waitForTimeout(pause);
    await page.keyboard.press('Enter');
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

    let roomId;

    if (PART === 1) {
        // ── 메인 화면
        await page.goto(`${BASE}/chat`, { waitUntil: 'load', timeout: 60000 });
        await page.waitForTimeout(9000);
        mark('메인 화면 진입', 'event');
        await caption(page, 'ProcessGPT 메인 화면', [
            '왼쪽에 대화 목록과 실행 중인 프로세스 인스턴스가 보인다.',
            '이 대화창에서 업무를 설명하면 실행 가능한 프로세스가 만들어진다.'
        ]);
        await page.waitForTimeout(6000);

        // ── 빈 방을 직접 만들어 이동 (지난 대화가 섞이면 대기 판정이 오염된다)
        roomId = crypto.randomUUID();
        await page.evaluate(async ({ roomId }) => {
            const uid = localStorage.getItem('uid');
            await window.$supabase.from('chat_rooms').insert({
                id: roomId,
                tenant_id: window.$tenantName,
                name: '견적 처리 프로세스 만들기',
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
        await page.waitForTimeout(8000);
        mark('새 대화 시작', 'event');
        console.log('  roomId =', roomId);
        writeFileSync(ROOM_FILE, JSON.stringify({ roomId }, null, 2), 'utf-8');

        // ── 서술문 전송
        await caption(page, '인계 기록에서 찾아낸 흐름을 그대로 설명한다', [
            '앞서 프로세스 마이닝이 인계 로그 35건 · 케이스 8건에서 도출한 결과다.',
            '조건부 단계(견적 재산출)까지 문장으로 그대로 옮긴다.'
        ]);
        await typeAndSend(page, BRIEF, 2500);
        mark('서술문 전송', 'event');
        await page.waitForTimeout(4000);

        // ── 초안 대기
        mark('초안 생성 대기 시작', 'wait');
        const ok = await waitFor(page, async () => (await agentReplyCount(roomId)) >= 1, {
            timeout: 600000, label: '컨설팅 초안'
        });
        mark('초안 생성 대기 끝', 'event');
        if (!ok) console.warn('  초안 미수신');
        await caption(page, 'Process GPT 가 흐름을 정리해 확인을 요청한다', [
            '바로 만들지 않고, 이해한 내용을 먼저 보여주고 승인을 받는다.',
            '마이닝이 찾아낸 조건부 단계가 그대로 반영되어 있다.'
        ]);
        await page.waitForTimeout(10000);
        mark('구간1 종료', 'event');
    } else {
        // ── PART 2: 같은 방에서 이어간다
        if (!existsSync(ROOM_FILE)) throw new Error('gen-room.json 이 없습니다. PART=1 을 먼저 실행하세요.');
        roomId = JSON.parse(readFileSync(ROOM_FILE, 'utf-8')).roomId;
        const baseReplies = await agentReplyCount(roomId);
        console.log('  roomId =', roomId, '| 기존 응답 수 =', baseReplies);

        await page.goto(`${BASE}/chat?roomId=${roomId}`, { waitUntil: 'load', timeout: 60000 });
        await page.waitForTimeout(9000);
        mark('대화 이어서 열기', 'event');
        await caption(page, '제시된 흐름을 승인한다', [
            '내용이 맞으면 승인만 하면 된다.'
        ]);
        await page.waitForTimeout(5000);

        await typeAndSend(page, '진행해줘', 1500);
        mark('승인 전송', 'event');
        await page.waitForTimeout(4000);

        await caption(page, '실행 가능한 프로세스를 생성한다', [
            '역할 · 폼 · 분기 조건까지 갖춘 프로세스 정의가 만들어진다.',
            '자동 수행 단계에는 에이전트가 그대로 배정된다.'
        ]);
        mark('프로세스 생성 대기 시작', 'wait');
        const gotResult = await waitFor(page, async () => {
            if ((await page.locator('.djs-container, .bjs-container').count()) > 0) return true;
            return (await agentReplyCount(roomId)) > baseReplies;
        }, { timeout: 900000, label: '프로세스 생성' });
        mark('프로세스 생성 대기 끝', 'event');
        await page.waitForTimeout(6000);
        await page.screenshot({ path: join(HERE, 's-gen-done.png') }).catch(() => {});

        // ── 저장(배포)
        if (gotResult) {
            await caption(page, '생성된 프로세스를 확인한다', [
                '오른쪽 패널에서 만들어진 프로세스 정의와 폼을 볼 수 있다.'
            ]);
            await page.waitForTimeout(8000);

            const saveBtn = page.getByRole('button', { name: /^저장$|저장하기/ }).first();
            if (await saveBtn.count()) {
                await caption(page, '저장하면 바로 쓸 수 있는 프로세스로 등록된다', [
                    '프로세스 정의와 폼이 ProcessGPT 에 배포된다.'
                ]);
                await saveBtn.click();
                mark('저장(배포) 클릭', 'event');
                await waitFor(page, async () => /저장됨|저장되었|등록되었/.test(await page.locator('body').innerText().catch(() => '')), {
                    timeout: 180000, label: '저장 완료'
                });
                mark('저장 완료', 'event');
                await page.waitForTimeout(7000);
            } else {
                console.warn('  저장 버튼을 찾지 못함');
            }
        }

        await caption(page, '등록 완료', [
            '인계 기록에서 찾아낸 업무 흐름이 실행 가능한 프로세스가 되었다.'
        ]);
        await page.waitForTimeout(8000);
        mark('구간2 종료', 'event');
        await page.screenshot({ path: join(HERE, 's-gen-final.png') }).catch(() => {});
    }

    await ctx.close();
    await browser.close();
    writeFileSync(TIMELINE, JSON.stringify({ part: PART, roomId, total: (Date.now() - t0) / 1000, marks }, null, 2), 'utf-8');
    console.log('\n타임라인 저장:', TIMELINE);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
