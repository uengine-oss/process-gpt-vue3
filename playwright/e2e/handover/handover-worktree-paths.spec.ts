/**
 * 인계 산출물 워크트리 — 기본 흐름 밖의 경로(@agent, 느린 검증).
 *
 *  - 다음 턴이 다른 실행 인스턴스(운영의 다른 파드)에서 돌아도 앞 턴에서 고친 파일을 이어서 고친다.
 *  - 인스턴스에 남은 옛 파일이 브랜치에 없으면 다음 턴 작업 폴더에서 사라진다.
 *  - 할 일 목록에서 받은 일을 완료할 때 바뀐 것이 없으면 task_done 커밋이 생기지 않는다.
 *  - 넘긴 사람이 갈래 산출물의 이전 버전 메뉴로 예전 커밋의 파일을 열면 그 시점 내용이 보인다.
 *
 * 사람이 받은 방에서 에이전트와 대화하며 파일을 고친다. 턴 사이에 deepagents 실행 인스턴스를 바꾼다
 * (POD_SWITCH A|B — 작업 폴더가 서로 다른 두 실행본 중 하나만 8888 에 띄운다). 확인용 조회만 DB·파일로 한다.
 * 결과를 화면에서 볼 수 있게 만든 데이터는 지우지 않는다.
 *
 * 실행: POD_SWITCH=… POD_A_WS=…/workspace/localhost POD_B_WS=…/workspace/localhost \
 *       BASE_URL=http://localhost:8088 SB_SERVICE_KEY=... npx playwright test playwright/e2e/handover/handover-worktree-paths.spec.ts
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { PEOPLE, chat, completeTodoOnBoard, createRoom, handover, login, openHandover, openRoom, rest, shot, waitUntil } from './helpers';

test.setTimeout(3_600_000);

const POD_SWITCH = process.env.POD_SWITCH || '';
const WS = { A: process.env.POD_A_WS || '', B: process.env.POD_B_WS || '' };
const TENANT = 'localhost';

function switchPod(pod: 'A' | 'B') {
    console.log(execFileSync(POD_SWITCH, [pod], { encoding: 'utf8', timeout: 300_000 }).trim());
}
const roomFile = (pod: 'A' | 'B', roomId: string, name: string) => join(WS[pod], '.bpmn', roomId, name);

async function headTree(roomId: string): Promise<Record<string, any>> {
    const b = (await rest(`artifact_branches?room_id=eq.${roomId}&select=head_commit_id`))[0];
    return b ? (await rest(`artifact_commits?id=eq.${b.head_commit_id}&select=tree`))[0].tree : {};
}
async function roomCommits(roomId: string) {
    return rest(`artifact_commits?room_id=eq.${roomId}&select=id,reason,created_at&order=created_at.asc`);
}
async function objectText(entry: any): Promise<string> {
    const res = await fetch(`http://127.0.0.1:54321/storage/v1/object/public/files/artifacts/${TENANT}/objects/${entry.sha256}`);
    return res.ok ? res.text() : '';
}
async function waitHead(roomId: string, label: string, ok: (tree: Record<string, any>, plan: string) => boolean) {
    return waitUntil(
        async () => {
            const t = await headTree(roomId);
            const plan = t['생산계획.md'] ? await objectText(t['생산계획.md']) : '';
            return ok(t, plan) ? { tree: t, plan } : null;
        },
        label,
        180_000,
        3_000
    );
}

/** 오른쪽 패널의 '갈래 산출물' 탭을 연다. */
async function openBranchFiles(page: Page) {
    const tab = page.locator('.artifact-panel__tab', { hasText: '갈래 산출물' });
    await expect(async () => {
        if (!(await tab.isVisible())) await page.getByRole('button', { name: '산출물' }).first().click();
        await expect(tab).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 60_000 });
    await tab.click();
    return page.locator('.ws-files').filter({ hasText: '갈래 산출물' }).first();
}

test('@agent 실행 인스턴스가 바뀌어도 받은 방 결과가 이어지고, 할 일 완료·이전 버전도 브랜치 기준으로 동작한다', async ({ browser }) => {
    test.skip(!POD_SWITCH || !WS.A || !WS.B, 'POD_SWITCH·POD_A_WS·POD_B_WS 가 필요합니다');
    const s = Date.now() % 100000;
    switchPod('A');

    // 1) 홍길동: 에이전트와 생산계획 문서를 만들고 이팀장에게 넘긴다
    const hong = await login(browser, PEOPLE.hong);
    const root = await createRoom(hong, `생산계획 보완 ${s}`, true);
    await openRoom(hong, root);
    await chat(
        hong,
        root,
        '작업 폴더에 마크다운 파일 두 개를 만들어 주세요. 생산계획.md: "1공장: 1,200대". 메모.md: "임시 메모 — 확정 전". 다른 파일은 만들지 마세요.'
    );
    await openRoom(hong, root);
    const instruction = `생산계획.md 를 보완해 주세요 ${s}`;
    const ev = await handover(hong, root, { done: '생산계획 초안', next: '생산계획 보완', to: PEOPLE.lee.name, tab: '사람', instruction });
    const room = ev.to_room_id;
    expect(ev.base_commit_id, '워크트리 인계').toBeTruthy();

    // 2) 이팀장(인스턴스 A): 1공장 수량을 고친다
    const lee = await login(browser, PEOPLE.lee);
    await openRoom(lee, room);
    await chat(lee, room, '넘겨받은 생산계획.md 의 1공장 수량을 1,300대로 고쳐 같은 파일에 저장해 주세요. 다른 파일은 건드리지 마세요.');
    const t1 = await waitHead(room, '1턴 커밋(A)', (_t, plan) => plan.includes('1,300'));
    expect(t1.tree['메모.md'], '1턴 뒤에도 메모.md 는 브랜치에 있다').toBeTruthy();
    expect(existsSync(roomFile('A', room, '메모.md')), '인스턴스 A 작업 폴더에 메모.md').toBe(true);

    // 3) 다음 턴은 다른 인스턴스(B)에서 돈다. B 작업 폴더에는 이 방 파일이 없다
    switchPod('B');
    expect(existsSync(roomFile('B', room, '생산계획.md')), 'B 는 이 방 파일을 가진 적 없다').toBe(false);
    await openRoom(lee, room);
    await chat(lee, room, '생산계획.md 끝에 "2공장: 900대" 줄을 추가해 같은 파일에 저장하고, 메모.md 는 지워 주세요.');
    const t2 = await waitHead(room, '2턴 커밋(B)', (t, plan) => plan.includes('900') && !t['메모.md']);
    expect(t2.plan, 'B 가 A 에서 고친 내용 위에 이어 고쳤다').toContain('1,300');
    expect(t2.plan).not.toContain('1,200');

    // 4) 다시 A 로 돌아온다. A 작업 폴더에는 브랜치에서 지워진 메모.md 와 옛 생산계획.md 가 남아 있다
    switchPod('A');
    expect(existsSync(roomFile('A', room, '메모.md')), 'A 에 옛 파일이 남아 있다').toBe(true);
    const before = (await roomCommits(room)).length;
    await openRoom(lee, room);
    const reply = await chat(
        lee,
        room,
        '파일은 고치지 말고, 지금 작업 폴더에 있는 파일 이름 목록과 생산계획.md 내용을 그대로 알려 주세요.'
    );
    expect(reply, '최신 브랜치 내용을 읽었다').toMatch(/900/);
    expect(reply).toMatch(/1,?300/);
    expect(reply, '지워진 파일이 보이지 않는다').not.toMatch(/메모\.md/);
    expect(existsSync(roomFile('A', room, '메모.md')), 'A 작업 폴더에서 옛 파일이 사라졌다').toBe(false);
    await lee.waitForTimeout(5_000);
    expect((await roomCommits(room)).length, '바뀐 게 없는 턴은 커밋 없음').toBe(before);

    // 5) 이팀장: 할 일 목록에서 받은 일을 완료한다 — 바뀐 것이 없으니 task_done 커밋은 생기지 않는다
    await completeTodoOnBoard(lee, ev.to_task_id, instruction);
    await lee.waitForTimeout(5_000);
    const commits = await roomCommits(room);
    console.log(`[커밋] ${commits.map((c: any) => c.reason).join(' → ')}`);
    expect(commits.length).toBe(before);
    expect(commits.some((c: any) => c.reason === 'task_done')).toBe(false);

    // 6) 홍길동: 갈래 산출물에서 이팀장이 고친 생산계획.md 의 이전 버전을 연다
    await openRoom(hong, root);
    const panel = await openBranchFiles(hong);
    const edited = panel.locator('.ws-files__item', { hasText: '생산계획.md' }).filter({ hasText: '수정' }).first();
    await expect(edited).toBeVisible({ timeout: 30_000 });
    await edited.click();
    await expect(panel.locator('.ws-files__preview')).toContainText('900', { timeout: 30_000 });
    await panel.locator('.e2e-ws-file-history').click();
    const versions = hong.locator('.e2e-ws-file-version');
    await expect(versions).toHaveCount(3, { timeout: 30_000 }); // 넘겨받은 것(1,200) → A 1턴(1,300) → B 2턴(+900)
    await shot(hong, 'worktree-versions');
    const opened: Record<string, string> = {};
    for (const [i, key] of [
        [2, 'base'],
        [1, 'turn1']
    ] as const) {
        const [popup] = await Promise.all([hong.waitForEvent('popup'), versions.nth(i).click()]);
        await popup.waitForLoadState();
        opened[key] = await popup.locator('body').innerText();
        await popup.close();
        if (i === 2) await panel.locator('.e2e-ws-file-history').click();
    }
    expect(opened.base).toContain('1,200');
    expect(opened.base).not.toContain('1,300');
    expect(opened.turn1).toContain('1,300');
    expect(opened.turn1).not.toContain('900');
});

test('@agent 첫 인계에서 일부만 골라 넘겨도 넘긴 방은 고르지 않은 파일을 잃지 않는다', async ({ browser }) => {
    // 방은 처음 인계할 때 브랜치를 얻는다. 첫 커밋에는 그 방 폴더의 파일 전체가 들어가야 한다 —
    // 고른 것만 들어가면 넘긴 방의 다음 에이전트 턴이 작업 폴더를 head 에 맞추며 나머지를 지운다.
    const s = Date.now() % 100000;
    const hong = await login(browser, PEOPLE.hong);
    const root = await createRoom(hong, `견적 준비 첫 인계 ${s}`, true);
    await openRoom(hong, root);
    await chat(
        hong,
        root,
        '작업 폴더에 마크다운 파일 세 개를 만들어 주세요. 견적서.md: "고객사: 한빛상사 / 합계: 3,000만원". ' +
            '원가표.md: "원가 합계: 2,400만원". 메모.md: "내부 검토용". 다른 파일은 만들지 마세요.'
    );
    await openRoom(hong, root);
    const ev = await handover(hong, root, {
        done: '견적 준비',
        next: '견적 검토',
        to: PEOPLE.lee.name,
        tab: '사람',
        instruction: `견적서만 검토해 주세요 ${s}`,
        onlyArtifacts: ['견적서.md']
    });

    // 받는 방은 고른 것만 받는다
    const received = await headTree(ev.to_room_id);
    expect(Object.keys(received)).toEqual(['견적서.md']);
    // 넘긴 방의 첫 커밋에는 방 폴더 파일이 모두 있다
    const mine = await headTree(root);
    expect(Object.keys(mine).sort()).toEqual(['견적서.md', '메모.md', '원가표.md']);

    // 홍길동이 자기 방에서 에이전트와 이어서 일한다 — 고르지 않은 파일을 여전히 읽는다
    await openRoom(hong, root);
    const reply = await chat(hong, root, '파일은 고치지 말고, 원가표.md 와 메모.md 의 내용을 그대로 알려 주세요.');
    expect(reply).toMatch(/2,?400/);
    expect(reply).toMatch(/내부 검토용/);
    expect(Object.keys(await headTree(root)).sort()).toEqual(['견적서.md', '메모.md', '원가표.md']);

    // 다음 인계 후보에도 남아 있다
    await openRoom(hong, root);
    const candidates = (await openHandover(hong)).join(' | ');
    expect(candidates).toContain('원가표.md');
    expect(candidates).toContain('메모.md');
    await hong.keyboard.press('Escape');
});
