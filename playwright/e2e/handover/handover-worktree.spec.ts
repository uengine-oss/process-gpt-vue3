/**
 * 인계 산출물 워크트리 e2e (@agent, 느린 검증).
 *
 * 산출물을 받는 방마다 복사하지 않고, 스레드 저장소 하나에서 방마다 자기 브랜치로 일한다.
 * 사람이 에이전트와 대화하며 파일을 만들고·고치고·넘기는 흐름을 그대로 밟는다. 확인용 조회만 DB 로 한다.
 *
 * 실행: BASE_URL=http://localhost:8088 SB_SERVICE_KEY=... npx playwright test playwright/e2e/handover/handover-worktree.spec.ts
 */
import { expect, test, type Page } from '@playwright/test';
import {
    BASE,
    DOC_AGENT,
    PEOPLE,
    chat,
    cleanupCreated,
    createRoom,
    handoverMany,
    login,
    openHandover,
    openRoom,
    rest,
    shot,
    waitUntil
} from './helpers';

test.setTimeout(3_600_000);
test.afterEach(cleanupCreated);

const DOC_MANAGER = { id: '5f01d166-043f-60a9-7835-de0146fb3718', name: '문서관리 도우미' };
const TENANT = 'localhost';

async function branch(roomId: string) {
    const rows = await rest(`artifact_branches?room_id=eq.${roomId}&select=*`);
    return rows[0] || null;
}
async function commit(id: string) {
    return (await rest(`artifact_commits?id=eq.${id}&select=*`))[0];
}
async function headTree(roomId: string): Promise<Record<string, any>> {
    const b = await branch(roomId);
    return b ? (await commit(b.head_commit_id)).tree : {};
}
async function roomCommits(roomId: string) {
    return rest(`artifact_commits?room_id=eq.${roomId}&select=id,reason,created_at&order=created_at.asc`);
}
async function objectText(entry: any): Promise<string> {
    const res = await fetch(`http://127.0.0.1:54321/storage/v1/object/public/files/artifacts/${TENANT}/objects/${entry.sha256}`);
    return res.ok ? res.text() : '';
}
async function storageNames(prefix: string): Promise<string[]> {
    const key = process.env.SB_SERVICE_KEY || '';
    const res = await fetch('http://127.0.0.1:54321/storage/v1/object/list/files', {
        method: 'POST',
        headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefix, limit: 1000 })
    });
    return res.ok ? (await res.json()).map((o: any) => o.name) : [];
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

test('@agent 병렬 인계는 한 벌을 나눠 쓰고, 갈래 결과를 넘긴 사람이 보고, 합류에서 충돌을 고른다', async ({ browser }) => {
    const s = Date.now();
    const hong = await login(browser, PEOPLE.hong);
    const room = await createRoom(hong, `견적 · 한빛상사 워크트리 e2e ${s}`, true);
    await openRoom(hong, room);

    // 1) 홍길동이 에이전트와 대화하며 산출물 두 개를 만든다
    await chat(
        hong,
        room,
        '작업 폴더에 마크다운 파일 두 개를 만들어 주세요. ' +
            '견적서.md: "고객사: 한빛상사 / 품목: 서버 3대 / 합계: 3,000만원". ' +
            '원가표.md: "서버 단가: 800만원 / 수량: 3대 / 원가 합계: 2,400만원". 다른 파일은 만들지 마세요.'
    );
    await openRoom(hong, room);
    const candidates = (await openHandover(hong)).join(' | ');
    expect(candidates).toContain('견적서.md');
    expect(candidates).toContain('원가표.md');
    await hong.keyboard.press('Escape');

    // 2) 네 명(사람 둘·에이전트 둘)에게 한 번에 나눠 준다
    await openRoom(hong, room);
    const rows = await handoverMany(hong, room, '견적서·원가표 초안 작성', '넘겨받은 견적서.md·원가표.md 를 확인해 주세요. 에이전트는 파일을 고치지 말고 내용만 세 줄로 요약해 답해 주세요.', [
        { to: PEOPLE.lee.name, tab: '사람', next: '견적 검토' },
        { to: PEOPLE.park.name, tab: '사람', next: '원가 검토' },
        { to: DOC_AGENT.name, tab: '에이전트', next: '견적 요약' },
        { to: DOC_MANAGER.name, tab: '에이전트', next: '문서 분류' }
    ]);
    expect(rows).toHaveLength(4);
    const byName = (n: string) => rows.find((r: any) => r.to_user_name === n);
    const leeRoom = byName(PEOPLE.lee.name).to_room_id;
    const parkRoom = byName(PEOPLE.park.name).to_room_id;

    // 넘기는 방 커밋은 한 번, 받는 방 네 곳은 모두 그 커밋에서 시작한다
    const baseId = rows[0].base_commit_id;
    expect(baseId).toBeTruthy();
    expect(new Set(rows.map((r: any) => r.base_commit_id)).size).toBe(1);
    const base = await commit(baseId);
    expect(Object.keys(base.tree)).toEqual(expect.arrayContaining(['견적서.md', '원가표.md']));
    for (const r of rows) expect((await branch(r.to_room_id))?.base_commit_id).toBe(baseId);

    // Storage 에는 내용마다 객체 한 벌, 받는 방 작업 폴더에는 사본이 없다
    const objects = await storageNames(`artifacts/${TENANT}/objects/`);
    for (const p of ['견적서.md', '원가표.md']) expect(objects.filter((n) => n.endsWith(base.tree[p].sha256))).toHaveLength(1);
    for (const r of rows) expect(await storageNames(`skills/${TENANT}/${r.to_room_id}/`)).toEqual([]);

    // 받은 네 방 모두 그 산출물이 열린다 — 사람 방은 받은 사람이, 에이전트 방은 넘긴 사람(함께 남아 있다)이 연다
    const lee = await login(browser, PEOPLE.lee);
    const park = await login(browser, PEOPLE.park);
    for (const [page, r] of [
        [lee, byName(PEOPLE.lee.name)],
        [park, byName(PEOPLE.park.name)],
        [hong, byName(DOC_AGENT.name)],
        [hong, byName(DOC_MANAGER.name)]
    ] as const) {
        await openRoom(page, r.to_room_id);
        await expect(page.locator('body')).toContainText('견적서.md', { timeout: 60_000 });
        await expect(page.locator('body')).toContainText('원가표.md');
    }
    await shot(lee, 'worktree-lee-received');

    // 3) 이팀장은 방 에이전트에게 견적서 할인을, 박대리는 견적서 납기와 원가표 단가를 고치게 한다
    await openRoom(lee, leeRoom);
    await chat(lee, leeRoom, '넘겨받은 견적서.md 의 합계를 10% 할인한 2,700만원으로 고쳐서 같은 파일에 저장해 주세요. 다른 파일은 건드리지 마세요.');
    await openRoom(park, parkRoom);
    await chat(
        park,
        parkRoom,
        '넘겨받은 견적서.md 끝에 "납기: 계약 후 4주" 한 줄을 추가하고, 원가표.md 의 서버 단가를 750만원·원가 합계를 2,250만원으로 고쳐 같은 파일에 저장해 주세요. ' +
            '그리고 검토의견.md 를 새로 만들어 "원가 6% 절감" 이라고 적어 주세요.'
    );

    // 에이전트 턴이 끝나면 그 방 브랜치에 새 커밋이 생긴다
    const leeTree = await waitUntil(async () => {
        const t = await headTree(leeRoom);
        return t['견적서.md']?.sha256 !== base.tree['견적서.md'].sha256 ? t : null;
    }, '이팀장 방 커밋', 120_000);
    const parkTree = await waitUntil(async () => {
        const t = await headTree(parkRoom);
        return t['검토의견.md'] ? t : null;
    }, '박대리 방 커밋', 120_000);
    expect((await roomCommits(leeRoom)).some((c: any) => c.reason === 'agent_turn')).toBe(true);
    expect(await objectText(leeTree['견적서.md'])).toContain('2,700');
    expect(await objectText(parkTree['원가표.md'])).toContain('750');

    // 한 갈래에서 고친 파일은 다른 갈래 방에서 바뀌지 않는다
    expect(parkTree['견적서.md'].sha256).not.toBe(leeTree['견적서.md'].sha256);
    expect(await objectText(parkTree['견적서.md'])).not.toContain('2,700');
    expect((await headTree(leeRoom))['원가표.md'].sha256).toBe(base.tree['원가표.md'].sha256);

    // 바뀐 것이 없는 턴은 커밋을 만들지 않는다
    const leeCommitsBefore = (await roomCommits(leeRoom)).length;
    const ask = await chat(lee, leeRoom, '파일은 고치지 말고, 견적서.md 의 고객사 이름만 알려 주세요.');
    expect(ask).toMatch(/한빛/);
    await lee.waitForTimeout(5_000);
    expect((await roomCommits(leeRoom)).length).toBe(leeCommitsBefore);

    // 4) 넘긴 사람은 자기 방에서 갈래가 고친 파일·새로 만든 파일을 열어 본다(고칠 수는 없다)
    await openRoom(hong, room);
    const panel = await openBranchFiles(hong);
    await expect(panel).toContainText('이팀장 · 견적 검토');
    await expect(panel).toContainText('박대리 · 원가 검토');
    await expect(panel.locator('.mdi-lock-outline')).toBeVisible();
    await expect(panel.getByRole('button', { name: /^저장/ })).toHaveCount(0);
    const parkItems = panel.locator('.ws-files__item', { hasText: '검토의견.md' });
    await expect(parkItems.first()).toContainText('생성');
    await parkItems.first().click();
    await expect(panel.locator('.ws-files__preview')).toContainText('6%', { timeout: 30_000 });
    const leeEdit = panel.locator('.ws-files__item', { hasText: '견적서.md' }).filter({ hasText: '수정' });
    await expect(leeEdit.first()).toBeVisible();
    await shot(hong, 'worktree-hong-branch-files');

    // 작업 흐름 그림 카드에 그 단계가 추가·변경한 산출물이 보인다
    const flowTab = hong.locator('.artifact-panel__tab', { hasText: '작업 흐름' });
    await flowTab.click();
    const parkCard = hong.locator(`.e2e-handover-flow-node[data-room-id="${parkRoom}"]`);
    await expect(parkCard.locator('.e2e-handover-flow-artifacts')).toContainText('검토의견.md', { timeout: 30_000 });

    // 5) 합류: 홍길동이 다음 일을 넘긴다. 견적서는 두 갈래가 다르게 고쳐 충돌, 원가표는 박대리만 고쳐 그대로 넘어간다
    await openRoom(hong, room);
    await openHandover(hong);
    const dlg = hong.locator('.handover-dialog');
    const conflict = dlg.locator('.e2e-handover-conflict');
    await expect(conflict.first()).toBeVisible({ timeout: 30_000 });
    const conflictPaths = await dlg.locator('.v-checkbox', { has: hong.locator('.mdi-source-merge') }).allInnerTexts();
    expect(conflictPaths.join(' ')).toContain('견적서.md');
    expect(conflictPaths.join(' ')).not.toContain('원가표.md');
    await dlg.getByLabel('지금까지 한 일').fill('견적·원가 검토 취합');
    await dlg.getByLabel('다음에 할 일').fill('최종 견적 확정');
    await dlg.getByPlaceholder(/검색|Search/).first().fill(PEOPLE.lee.name);
    await dlg.locator('.e2e-assignee-item', { hasText: PEOPLE.lee.name }).first().click();
    // 고르기 전에는 넘기지 못한다
    await expect(dlg.getByRole('button', { name: /^인계하기$/ })).toBeDisabled();
    for (let i = 0; i < (await conflict.count()); i++) {
        const chips = conflict.nth(i).locator('.v-chip');
        const parkChip = chips.filter({ hasText: '박대리' });
        await ((await parkChip.count()) ? parkChip.first() : chips.first()).click();
    }
    await dlg.getByRole('button', { name: /^인계하기$/ }).click();
    await expect(dlg).toBeHidden({ timeout: 120_000 });
    const merged = await waitUntil(async () => {
        const r = await rest(`handover_events?source=eq.chat_handover&from_room_id=eq.${room}&group_id=is.null&select=*`);
        return r[0] || null;
    }, '합류 인계 기록');
    const mergeCommit = await commit(merged.base_commit_id);
    expect(mergeCommit.reason).toBe('merge');
    expect(mergeCommit.parents.length).toBeGreaterThanOrEqual(3);
    const joined = await headTree(merged.to_room_id);
    expect(joined['견적서.md'].sha256).toBe(parkTree['견적서.md'].sha256); // 고른 쪽
    expect(joined['원가표.md'].sha256).toBe(parkTree['원가표.md'].sha256); // 한쪽만 바꾼 것
    expect(joined['검토의견.md']?.sha256).toBe(parkTree['검토의견.md'].sha256);

    // 받은 사람이 연 방에 합쳐진 파일이 있다
    await openRoom(lee, merged.to_room_id);
    await expect(lee.locator('body')).toContainText('검토의견.md', { timeout: 60_000 });
    await shot(lee, 'worktree-merge-received');
});

test('@agent 예전에 복사로 넘긴 방은 그대로 열리고 에이전트도 그 파일로 일한다', async ({ browser }) => {
    // 2026-10-20 에 복사 방식으로 이팀장에게 넘긴 방(견적서_한빛상사.docx 사본이 방 작업 폴더에 있다)
    const legacy = '30437c00-4650-bdf0-54c1-45459765b300';
    expect(await branch(legacy)).toBeNull();
    const lee = await login(browser, PEOPLE.lee);
    await openRoom(lee, legacy);
    await expect(lee.locator('body')).toContainText('견적서_한빛상사.docx', { timeout: 60_000 });
    const answer = await chat(lee, legacy, '넘겨받은 견적서_한빛상사.docx 파일을 열어서 고객사 이름만 알려 주세요. 파일은 고치지 마세요.');
    expect(answer).toMatch(/한빛/);
    // 예전 방은 브랜치를 만들지 않고 예전처럼 방 작업 폴더를 쓴다
    expect(await branch(legacy)).toBeNull();
    await shot(lee, 'worktree-legacy-room');
    expect(BASE).toContain('8088');
});
