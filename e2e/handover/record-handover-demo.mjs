/**
 * 채팅 인계(핸드오버) 기능 데모 영상을 녹화한다.
 *
 * 실행:
 *   cd services/frontend
 *   npm run build && npx vite preview --host 127.0.0.1 --port 8088   # 별도 터미널
 *   node e2e/handover/record-handover-demo.mjs
 *
 * 산출물: docs/demo/handover-demo.webm (+ ffmpeg 있으면 .mp4)
 *
 * 중요: Supabase REST 트래픽을 전부 가로채 시드 데이터로 응답한다.
 * 실제 원격 DB 는 읽지도 쓰지도 않는다. 화면 오른쪽 패널에 표시되는 행들은
 * 프로덕션 코드(createChatHandover)가 실제로 만들어 전송한 payload 그대로다.
 */
import { chromium } from '@playwright/test';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync } from 'fs';
import { execFileSync } from 'child_process';
import { join, resolve } from 'path';

/**
 * 2·3단계에서 쓰는 데이터는 실제 마이너(services/process-miner)가 만든 산출물이다.
 * 없으면 그 단계는 건너뛰고, 영상에서 없는 걸 있는 척하지 않는다.
 *   ./.venv/bin/python scripts/export_threads.py localhost threads.json
 *   ./.venv/bin/python scripts/run_mining.py --tenant localhost --out mining_result.json
 */
function loadJson(path) {
    try {
        return JSON.parse(readFileSync(path, 'utf-8'));
    } catch {
        return null;
    }
}

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8088';
const REPO_ROOT = resolve(process.cwd(), '../..');
const OUT_DIR = join(REPO_ROOT, 'docs/demo');
const RAW_DIR = join(process.cwd(), 'e2e/handover/e2e-results/demo-video');
const OUT_NAME = 'handover-demo';
const VIEWPORT = { width: 1440, height: 810 };
const MINER_DIR = resolve(REPO_ROOT, 'services/process-miner');
const THREADS_PATH = process.env.THREADS_JSON || join(MINER_DIR, 'threads.json');
const MINING_PATH = process.env.MINING_JSON || join(MINER_DIR, 'mining_result.json');

/** 인계 대상 후보 — 사람과 에이전트가 같은 users 테이블에 함께 있다. */
const SEED_USERS = [
    { id: 'u-bob', username: '박상무', email: 'bob@uengine.org', is_agent: false, role: '영업총괄', department_name: '영업본부', profile: null },
    { id: 'u-carol', username: '이대리', email: 'carol@uengine.org', is_agent: false, role: '영업담당', department_name: '영업본부', profile: null },
    { id: 'u-dan', username: '최과장', email: 'dan@uengine.org', is_agent: false, role: '계약검토', department_name: '법무팀', profile: null },
    { id: 'a-review', username: '계약검토 에이전트', email: 'agent:contract', is_agent: true, role: '계약검토', profile: null },
    { id: 'a-quote', username: '견적 산출 에이전트', email: 'agent:quote', is_agent: true, role: '견적', profile: null }
];

/** 화면에 설명 자막을 띄운다. 영상만 봐도 무엇을 보고 있는지 알 수 있게. */
async function caption(page, title, lines, { tone = 'neutral' } = {}) {
    await page.evaluate(
        ({ title, lines, tone }) => {
            let box = document.getElementById('demo-caption');
            if (!box) {
                box = document.createElement('div');
                box.id = 'demo-caption';
                Object.assign(box.style, {
                    position: 'fixed',
                    left: '0',
                    right: '0',
                    bottom: '0',
                    zIndex: '99999',
                    padding: '16px 28px',
                    background: 'rgba(17, 12, 26, 0.94)',
                    color: '#fff',
                    fontFamily: 'system-ui, -apple-system, "Apple SD Gothic Neo", sans-serif',
                    borderTop: '4px solid #68369a',
                    pointerEvents: 'none'
                });
                document.body.appendChild(box);
            }
            const accent = tone === 'good' ? '#8ee6a8' : tone === 'bad' ? '#ff9d9d' : '#c9a6e9';
            box.style.borderTopColor = tone === 'good' ? '#3fa860' : tone === 'bad' ? '#c0392b' : '#68369a';
            box.innerHTML =
                `<div style="font-size:19px;font-weight:700;margin-bottom:6px;color:${accent}">${title}</div>` +
                lines.map((l) => `<div style="font-size:14px;line-height:1.6;opacity:.92">${l}</div>`).join('');
        },
        { title, lines, tone }
    );
}

function tableOf(pathname) {
    const m = /\/rest\/v1\/([^?]+)/.exec(pathname);
    return m ? m[1] : '';
}

async function main() {
    rmSync(RAW_DIR, { recursive: true, force: true });
    mkdirSync(RAW_DIR, { recursive: true });
    mkdirSync(OUT_DIR, { recursive: true });

    const browser = await chromium.launch();
    const context = await browser.newContext({
        viewport: VIEWPORT,
        recordVideo: { dir: RAW_DIR, size: VIEWPORT },
        locale: 'ko-KR'
    });

    const captured = [];

    // Supabase REST 를 전부 가로챈다. 원격 DB 로는 한 바이트도 나가지 않는다.
    await context.route('**/rest/v1/**', async (route) => {
        const req = route.request();
        const table = tableOf(new URL(req.url()).pathname);
        const method = req.method();

        if (method === 'GET' || method === 'HEAD') {
            const body = table === 'users' ? SEED_USERS : [];
            return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
        }

        // 쓰기: 어떤 행이 어느 테이블로 갔는지 기록만 하고 성공 응답을 돌려준다.
        let payload = null;
        try {
            payload = JSON.parse(req.postData() || 'null');
        } catch {
            payload = null;
        }
        const rows = Array.isArray(payload) ? payload : payload ? [payload] : [];
        const op = method === 'POST' ? 'upsert' : method === 'PATCH' ? 'update' : method.toLowerCase();
        for (const value of rows) captured.push({ table, op, value });

        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) });
    });

    // 인증/실시간 등 나머지 supabase 트래픽도 밖으로 내보내지 않는다.
    await context.route('**/auth/v1/**', (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) })
    );
    await context.route('**/memento/**', (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ file_path: 'files/seeded.bin' }) })
    );
    await context.route('**/completion/**', (route) =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                doneLabel: '대성산업 견적서 초안 작성 (단가·할인·납기 반영)',
                nextActivityLabel: '견적서 검토 및 승인',
                instruction:
                    '첨부된 견적서 초안과 단가 근거를 확인하고 승인 여부를 회신해 주세요. 12% 할인은 작년 단가표 기준이며, 납기 4주는 생산팀 확인이 필요합니다.',
                candidateAssignees: [{ id: 'u-bob', email: 'bob@uengine.org', reason: '결재 권한자' }]
            })
        })
    );

    const page = await context.newPage();

    /** 가로챈 쓰기를 화면 패널로 흘려보낸다. */
    const flushWrites = async () => {
        if (!captured.length) return;
        const batch = captured.splice(0, captured.length);
        await page.evaluate((rows) => window.__pushHandoverWrites && window.__pushHandoverWrites(rows), batch);
    };

    await page.goto(`${BASE_URL}/handover-e2e`, { waitUntil: 'domcontentloaded' });
    await page.locator('.e2e-open-handover').waitFor({ timeout: 60_000 });
    await page.waitForTimeout(800);

    // ── 1. 문제: 채팅으로 일은 끝났는데 다음 사람이 시스템에 없다
    await caption(page, '1. 채팅으로 일은 끝났지만, 다음 담당자는 어디에도 없다', [
        '에이전트와 대화해 견적서 초안이 나왔다. 산출물도 방 안에 쌓였다.',
        '그런데 "이 다음은 누가 무엇을 하는가" 는 시스템에 전혀 기록되지 않는다.',
        '기존 /chat 에는 사람에게 일을 넘기는 수단이 아예 없었다.'
    ]);
    await page.waitForTimeout(5200);

    // ── 2. 인계 다이얼로그 열기
    await caption(page, '2. 대화창에 붙인 [인계하기]', [
        '컴포저 툴바와 헤더에서 바로 인계를 시작한다.',
        '이 방이 들고 있는 산출물이 자동으로 후보로 올라온다.'
    ]);
    await page.locator('.e2e-open-handover').click();
    await page.waitForTimeout(2600);

    await caption(page, '3. 인계할 산출물 선택', [
        '에이전트 워크스페이스 파일 · 방 첨부 · 지식 문서 · 대화 기록이 모두 후보다.',
        '기본은 전체 선택 — 맥락이 통째로 다음 사람에게 넘어간다.'
    ]);
    await page.waitForTimeout(4800);

    // ── 3. AI 제안
    await caption(page, '4. 다음 단계는 AI 가 초안을 잡아 준다', [
        '선택한 산출물과 대화 맥락을 근거로 "지금까지 한 일 / 다음에 할 일 / 지시사항" 을 제안한다.',
        '담당자 후보는 조직도에서 고른다.'
    ]);
    const suggestBtn = page.getByRole('button', { name: /AI 제안/ });
    if (await suggestBtn.count()) {
        await suggestBtn.first().click();
        await page.waitForTimeout(2600);
    }
    await page.waitForTimeout(3200);

    // ── 4. 사람/에이전트 단일 피커 (앱 표준 UserSelectField 재사용)
    await caption(page, '5. 사람과 에이전트를 구분하지 않는 하나의 피커', [
        '둘 다 users 테이블 · 조직도에 함께 있는 리소스이기 때문이다.',
        'BPMN 역할 지정 등에서 쓰는 앱 표준 컴포넌트(UserSelectField)를 그대로 재사용했다.',
        '→ users 의 사람·에이전트에 더해 내장 기본 에이전트까지 같은 목록에 나온다.'
    ]);
    const assigneeField = page.locator('.e2e-handover-assignee input').first();
    await assigneeField.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1200);
    await assigneeField.click();
    await page.waitForTimeout(2600);

    await page.locator('.v-overlay .v-list-item', { hasText: '박상무' }).first().click();
    await page.waitForTimeout(1800);

    await caption(page, '6. 다음 담당자 지정 완료', [
        '박상무(영업본부 · 영업총괄)에게 넘긴다.',
        '에이전트를 골랐다면 agent_orch 가 함께 세팅되어 폴러가 바로 집어간다.'
    ]);
    await page.waitForTimeout(3800);

    // ── 5. 인계 실행 → 실제로 쓰이는 행들
    await caption(page, '7. 인계 실행', [
        '이제 프로덕션 코드(createChatHandover)가 그대로 실행된다.',
        '오른쪽 패널에 실제로 전송된 DB 행이 순서대로 쌓인다.'
    ]);
    const submitBtn = page.locator('.v-dialog').getByRole('button', { name: '인계하기' });
    await submitBtn.last().click();
    await page.waitForTimeout(3000);
    await flushWrites();
    await page.waitForTimeout(1200);

    await caption(page, '8. 한 번의 인계가 남기는 것', [
        'chat_rooms — 수신자 방 생성 (에이전트도 함께 넘길 수 있다)',
        'chats — "○○님이 넘긴 업무" 브리핑 / chat_attachments — 산출물 이관',
        'todolist — 수신자의 ad-hoc 작업 (reference_ids 로 이전 방과 연결)',
        'notifications — 수신자 알림'
    ], { tone: 'good' });
    await page.waitForTimeout(6000);

    // handover_events 카드로 스크롤
    const eventCard = page.locator('.e2e-write-handover_events').first();
    if (await eventCard.count()) {
        await eventCard.scrollIntoViewIfNeeded();
        await page.waitForTimeout(600);
    }
    await caption(page, '9. 그리고 핵심 — handover_events', [
        '누가 → 누구에게, 무엇을 넘겼는지가 이벤트로 남는다.',
        'origin_room_id 는 "이 업무가 최초로 시작된 방" 이며 인계받는 방으로 계속 전파된다',
        '— 이메일이 References 로 루트 Message-ID 를 끌고 가는 것과 같은 방식이다.',
        '에이전트 위임(source=agent_delegation)은 버튼 없이도 자동 기록된다.'
    ], { tone: 'good' });
    await page.waitForTimeout(7000);

    // ── 10. 스레드 묶음 (Gmail forward 묶음)
    const threads = loadJson(THREADS_PATH);
    const mining = loadJson(MINING_PATH);

    if (threads) {
        await page.evaluate((t) => window.__setHandoverStage('threads', { threads: t }), threads);
        await page.waitForTimeout(900);
        await caption(page, '10. 한 업무가 여러 방을 거쳐도 한 스레드로 모인다', [
            'origin_room_id 로 묶으면 Gmail 의 forward 묶음처럼 인계 전체가 한 줄로 보인다.',
            '점선 = 버튼 없이 자동 기록된 에이전트 위임, 실선 = 사람이 누른 인계.',
            `아래는 같은 업무가 ${threads.length}번 반복 수행되며 쌓인 스레드다.`
        ]);
        await page.waitForTimeout(7000);

        await caption(page, '11. 여기서 패턴이 보이기 시작한다', [
            '대부분 같은 순서로 흐르지만, 일부 스레드에만 "견적 재산출" 단계가 끼어 있다.',
            '사람 눈에도 보이는 이 규칙성을 통계로 확정하는 것이 프로세스 마이닝이다.'
        ]);
        await page.waitForTimeout(6000);
    } else {
        console.warn('threads.json 이 없어 스레드 단계를 건너뜁니다.');
    }

    // ── 11. 마이닝 결과 + PR
    if (mining && mining.definition) {
        await page.evaluate((m) => window.__setHandoverStage('mining', { mining: m }), mining);
        await page.waitForTimeout(900);
        await caption(page, '12. 누적된 인계 로그에서 프로세스를 도출한다', [
            'DFG(직후관계 그래프) → Inductive Miner 로 컷을 재귀 탐지해 프로세스 트리를 만든다.',
            'LLM 없이 결정론적으로 돌고, 트리에서 변환하므로 교착·도달불가 노드가 생길 수 없다.',
            '에이전트가 수행하던 단계는 agent·orchestration 이 채워진 채로 나온다 — 바로 실행 가능하다.'
        ], { tone: 'good' });
        await page.waitForTimeout(8000);

        await caption(page, '13. 8건 중 3건에만 있던 단계는 "선택적" 으로 도출된다', [
            '견적 재산출은 배타 게이트웨이로 감싸여 건너뛸 수 있게 표현된다.',
            '이걸 안 하면 모든 케이스가 재산출을 반드시 거치는, 로그와 안 맞는 모델이 된다.'
        ]);
        await page.waitForTimeout(6500);

        await caption(page, '14. 결과는 PR 로 제안된다', [
            '살아 있는 proc_def 는 건드리지 않는다. proc_def_version 에 draft 를 넣고',
            "resource_pull_requests 에 resource_type='bpmn' PR 을 연다.",
            '기존 프로세스 버전 승인 UI 가 그대로 이 PR 을 리뷰한다 — 승인은 사람의 몫이다.'
        ], { tone: 'good' });
        await page.waitForTimeout(8000);
    } else {
        console.warn('mining_result.json 이 없어 마이닝 단계를 건너뜁니다.');
    }

    await context.close();
    await browser.close();

    const recorded = readdirSync(RAW_DIR).filter((f) => f.endsWith('.webm'));
    if (!recorded.length) throw new Error('녹화 파일을 찾지 못했습니다');
    const webmPath = join(OUT_DIR, `${OUT_NAME}.webm`);
    renameSync(join(RAW_DIR, recorded[0]), webmPath);
    console.log('영상 저장:', webmPath);

    try {
        const mp4Path = join(OUT_DIR, `${OUT_NAME}.mp4`);
        execFileSync('ffmpeg', ['-y', '-i', webmPath, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4Path], {
            stdio: 'ignore'
        });
        if (existsSync(mp4Path)) console.log('영상 저장:', mp4Path);
    } catch {
        console.log('ffmpeg 이 없어 webm 만 생성했습니다.');
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
