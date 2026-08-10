/**
 * 분기 판단 이력 적용 전/후를 화면에서 비교하는 데모 영상을 녹화한다.
 *
 * 실행:
 *   cd services/frontend
 *   npm run dev -- --port 8088          # 별도 터미널
 *   node e2e/instance-progress/record-journal-demo.mjs
 *
 * 산출물: docs/demo/instance-progress-journal-demo.webm (+ .mp4 변환 시도)
 */
import { chromium } from '@playwright/test';
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync } from 'fs';
import { execFileSync } from 'child_process';
import { join, resolve } from 'path';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8088';
const REPO_ROOT = resolve(process.cwd(), '../..');
const OUT_DIR = join(REPO_ROOT, 'docs/demo');
const RAW_DIR = join(process.cwd(), 'e2e/instance-progress/e2e-results/demo-video');
const OUT_NAME = 'instance-progress-journal-demo';

const VIEWPORT = { width: 1280, height: 720 };

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
                    padding: '18px 28px',
                    background: 'rgba(17, 12, 26, 0.92)',
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
                `<div style="font-size:20px;font-weight:700;margin-bottom:6px;color:${accent}">${title}</div>` +
                lines.map((l) => `<div style="font-size:15px;line-height:1.6;opacity:.92">${l}</div>`).join('');
        },
        { title, lines, tone }
    );
}

async function openScenario(page, scenario, { journal }) {
    const query = journal ? `?scenario=${scenario}` : `?scenario=${scenario}&journal=off`;
    await page.goto(`${BASE_URL}/instance-progress-e2e${query}`, { waitUntil: 'domcontentloaded' });
    await page.locator('.djs-container g.djs-element[data-element-id="Task_A"]').first().waitFor({ timeout: 60_000 });
    await page.waitForTimeout(1000);

    // 뷰어는 실행중 태스크로 자동 포커싱하므로 다이어그램 왼쪽이 잘릴 수 있다.
    // 데모에서는 전체가 보이도록 "전체 보기"로 맞춘다.
    const fitButton = page.locator('.vue-bpmn-diagram-container .mdi-crosshairs-gps').first();
    if (await fitButton.count()) {
        await fitButton.click();
        await page.waitForTimeout(600);
    }
}

/** 강조된 연결선 목록을 화면에서 직접 읽어 자막에 쓴다(주장 대신 관측). */
async function traversedFlows(page) {
    return page.evaluate(() =>
        Array.from(document.querySelectorAll('.djs-container g.djs-element.traversed.djs-connection'))
            .map((el) => el.getAttribute('data-element-id'))
            .filter(Boolean)
            .sort()
    );
}

async function main() {
    rmSync(RAW_DIR, { recursive: true, force: true });
    mkdirSync(RAW_DIR, { recursive: true });
    mkdirSync(OUT_DIR, { recursive: true });

    const browser = await chromium.launch();
    const context = await browser.newContext({
        viewport: VIEWPORT,
        recordVideo: { dir: RAW_DIR, size: VIEWPORT }
    });
    const page = await context.newPage();

    // ── 1. 이력이 없는 인스턴스: 추론으로 동작 (기존 동작 유지)
    await openScenario(page, 'through-gateways', { journal: false });
    await caption(page, '1. 판단 이력이 없는 인스턴스', [
        '엔진이 이력을 남기기 전에 실행된 인스턴스에는 판단 기록이 없다.',
        '이 경우 진행 표시는 기존처럼 BPMN 그래프를 역추론해서 그린다.',
        `지나간 연결선: ${(await traversedFlows(page)).join(', ')}`
    ]);
    await page.waitForTimeout(4500);

    // ── 2. 추론이 판정할 수 없는 구조
    await openScenario(page, 'terminal-branches', { journal: false });
    await caption(page, '2. 추론이 판정할 수 없는 분기', [
        '승인·반려가 각각 다른 종료 이벤트로 끝나는 구조.',
        '두 갈래 모두 실행 흔적이 없어, 추론은 어느 쪽으로 갔는지 말할 수 없다.',
        '→ 잘못 칠하는 대신 아무 갈래도 표시하지 않는다.'
    ], { tone: 'bad' });
    await page.waitForTimeout(5000);

    await openScenario(page, 'terminal-branches', { journal: true });
    await caption(page, '2. 판단 이력을 적용하면', [
        '엔진이 남긴 판단 이력에 "승인 갈래를 선택했다"는 사실이 있다.',
        `지나간 연결선: ${(await traversedFlows(page)).join(', ')}`,
        '→ 승인 경로가 종료 이벤트까지 확정되어 그려진다.'
    ], { tone: 'good' });
    await page.waitForTimeout(5500);

    // ── 3. 추론이 과잉 표시하는 구조
    await openScenario(page, 'ambiguous-rejoin', { journal: false });
    const overMarked = await traversedFlows(page);
    await caption(page, '3. 추론이 과잉 표시하는 분기', [
        '두 갈래가 게이트웨이만 거쳐 다시 합류하는 구조.',
        '추론은 양쪽 모두 "뒤에 실행 흔적이 있다"고 보아 두 갈래를 전부 칠한다.',
        `지나간 연결선: ${overMarked.join(', ')} ← 상단·하단이 모두 켜져 있다`
    ], { tone: 'bad' });
    await page.waitForTimeout(5500);

    await openScenario(page, 'ambiguous-rejoin', { journal: true });
    const corrected = await traversedFlows(page);
    await caption(page, '3. 판단 이력을 적용하면', [
        '이력이 분기 지점에서 "상단 갈래를 선택했다"고 알려준다.',
        `지나간 연결선: ${corrected.join(', ')}`,
        '→ 하단 갈래(Flow_b)뿐 아니라 그 하위 구간(Flow_d)까지 함께 사라진다.'
    ], { tone: 'good' });
    await page.waitForTimeout(6000);

    // ── 4. 이력이 없는 구간은 여전히 추론이 메운다
    await openScenario(page, 'journal-corrects-branch', { journal: true });
    await caption(page, '4. 이력 있으면 사실, 없으면 추론', [
        '판단 이력은 워크아이템이 완료될 때부터 쌓이므로, 시작 이벤트 진입처럼',
        '이력이 다룰 수 없는 구간이 늘 남는다.',
        `지나간 연결선: ${(await traversedFlows(page)).join(', ')} ← Flow_1 은 추론이 메운 구간`
    ]);
    await page.waitForTimeout(6000);

    await context.close();
    await browser.close();

    // 녹화 파일을 산출물 경로로 옮긴다
    const recorded = readdirSync(RAW_DIR).filter((f) => f.endsWith('.webm'));
    if (!recorded.length) throw new Error('녹화 파일을 찾지 못했습니다');
    const webmPath = join(OUT_DIR, `${OUT_NAME}.webm`);
    renameSync(join(RAW_DIR, recorded[0]), webmPath);
    console.log('영상 저장:', webmPath);

    // ffmpeg 이 있으면 공유하기 쉬운 mp4 도 만든다
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
