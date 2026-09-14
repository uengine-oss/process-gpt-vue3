/**
 * 서버가 확정한 답변이 '생각 중...' 으로 되덮이지 않는지 지킨다.
 *
 * 실제 사고: SSE 가 끊긴 18분짜리 codex 턴에서 서버는 본문과 파일 링크를 모두
 * chats row 에 썼는데, realtime UPDATE 를 받은 프런트가 아직 placeholder 인
 * 자기 객체를 통째로 다시 저장했다. 파일 링크만 남고 본문이 사라져, 화면에는
 * 다운로드 버튼 아래로 '생각 중...' 이 영원히 떠 있었다.
 *
 * SFC 를 번들 없이 테스트하기 위해 메서드 본문을 파일에서 직접 꺼내 쓴다.
 * 테스트가 실제로 배포되는 코드를 보게 하려는 것이다.
 */
import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'ChatRoomPage.vue');
const source = fs.readFileSync(FILE, 'utf8');

function extractMethod(name) {
    let start = source.indexOf(`\n        ${name}(`);
    let isAsync = false;
    if (start === -1) {
        start = source.indexOf(`\n        async ${name}(`);
        isAsync = true;
    }
    assert.notStrictEqual(start, -1, `method not found in ChatRoomPage.vue: ${name}`);
    const paramStart = source.indexOf('(', start);
    let parens = 0;
    let cursor = paramStart;
    for (; cursor < source.length; cursor++) {
        if (source[cursor] === '(') parens++;
        else if (source[cursor] === ')' && --parens === 0) break;
    }
    const bodyStart = source.indexOf('{', cursor);
    let depth = 0;
    let end = bodyStart;
    for (; end < source.length; end++) {
        if (source[end] === '{') depth++;
        else if (source[end] === '}' && --depth === 0) break;
    }
    const signature = source.slice(paramStart, cursor + 1);
    return `${name}: ${isAsync ? 'async ' : ''}function ${signature}${source.slice(bodyStart, end + 1)}`;
}

const METHODS = ['_isPlaceholderContent', 'carryOptimisticOnlyFields', 'adoptServerFinalContent', 'persistMessageFrontendState'];

function buildComponent() {
    const writes = [];
    globalThis.backend = { putObject: async (key, row) => writes.push({ key, row }) };
    // eslint-disable-next-line no-eval
    const methods = (0, eval)(`({${METHODS.map(extractMethod).join(',\n')}})`);
    return {
        writes,
        vm: {
            ...methods,
            _frontendStatePersistTimers: {},
            _serverRowPersistFallbackTimers: {},
            currentChatRoom: { id: 'room-1' },
            roomId: 'room-1',
            setAgentStatus() {},
            scrollToBottomSafe() {},
            scheduleServerRowPersistFallback() {},
            $nextTick(fn) {
                fn();
            }
        }
    };
}

function streamingBubble() {
    return {
        uuid: 'client-uuid',
        clientUuid: 'client-uuid',
        role: 'assistant',
        agentId: 'codex',
        content: '생각 중...',
        contentType: 'text',
        isLoading: true,
        toolCalls: [{ name: 'shell', status: 'running' }],
        agentPlan: { summary: '', steps: [] }
    };
}

function finalServerRow() {
    return {
        uuid: 'server-uuid',
        rowUuid: 'server-uuid',
        role: 'assistant',
        agentId: 'codex',
        content: '최종 제안서를 수정·검수하여 완성했습니다.\n\n파일: **제안서.hwpx**',
        contentType: 'text',
        timeStamp: '2026-09-14T03:24:55.586Z',
        pdfFiles: [{ url: 'http://example.invalid/proposal.hwpx', name: '제안서.hwpx' }]
    };
}

/** realtime UPDATE 를 받은 activeStreams 분기를 그대로 재현한다. */
async function applyRealtimeFinalRow(vm, streamMsg, incoming) {
    streamMsg.rowUuid = incoming.rowUuid;
    streamMsg.uuid = incoming.uuid;
    vm.carryOptimisticOnlyFields(incoming, streamMsg);
    vm.adoptServerFinalContent(streamMsg, incoming, 'codex');
    await vm.persistMessageFrontendState(streamMsg, 'room-1', { force: true });
}

test('서버 확정 본문이 placeholder 로 되덮이지 않는다', async () => {
    const { vm, writes } = buildComponent();
    const streamMsg = streamingBubble();
    const incoming = finalServerRow();

    await applyRealtimeFinalRow(vm, streamMsg, incoming);

    const saved = writes.at(-1).row.messages;
    assert.strictEqual(saved.content, incoming.content);
    assert.strictEqual(saved.pdfFiles.length, 1, '파일 링크도 함께 남아야 한다');
    assert.ok(!('__serverContent' in saved), '내부 필드는 DB 로 나가지 않는다');
});

test('done 이 오지 않아도 말풍선이 완료 상태가 된다', async () => {
    const { vm } = buildComponent();
    const streamMsg = streamingBubble();

    await applyRealtimeFinalRow(vm, streamMsg, finalServerRow());

    assert.strictEqual(streamMsg.isLoading, false, '스피너가 멈춰야 한다');
    assert.deepStrictEqual(
        streamMsg.toolCalls.map((toolCall) => toolCall.status),
        ['done'],
        "완료된 턴의 도구가 'running' 으로 얼어붙으면 안 된다"
    );
});

test('턴 시작의 placeholder row 는 말풍선을 확정하지 않는다', async () => {
    const { vm } = buildComponent();
    const streamMsg = streamingBubble();
    const placeholderRow = { ...finalServerRow(), content: '생각 중...', pdfFiles: undefined };

    const adopted = vm.adoptServerFinalContent(streamMsg, placeholderRow, 'codex');

    assert.strictEqual(adopted, false);
    assert.strictEqual(streamMsg.isLoading, true, '진행 중인 턴은 계속 진행 중이어야 한다');
});

test('placeholder 를 저장하려 해도 확정 본문이 살아남는다', async () => {
    const { vm, writes } = buildComponent();
    const streamMsg = streamingBubble();
    const incoming = finalServerRow();

    await applyRealtimeFinalRow(vm, streamMsg, incoming);
    // 다른 경로가 뒤늦게 placeholder 상태로 같은 row 를 다시 저장하는 경우.
    streamMsg.content = '생각 중...';
    await vm.persistMessageFrontendState(streamMsg, 'room-1', { force: true });

    assert.strictEqual(writes.at(-1).row.messages.content, incoming.content);
});
