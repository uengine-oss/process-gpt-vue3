/**
 * 채팅 스트림 파서가 세션 라우터의 상태 프레임을 넘겨주는지, 요청에 고른 CLI 를 싣는지.
 *
 * 지키려는 것
 *   - `session_status` 가 onSessionStatus 로 간다(버리면 Pod 를 띄우는 수십 초 동안 화면이 멈춘 것처럼 보인다)
 *   - 상태 프레임 뒤의 평소 스트림(token · done)은 그대로 흐른다
 *   - 모르는 type 은 그대로 무시된다(파서는 너그럽다)
 *   - 라우터의 실패 프레임(type error, code runner_start_timeout)은 오류로 간다
 *   - cli-agent 의 거절(cli_not_selected 등)은 content 와 code 가 오류에 실려 간다
 *   - 화면이 metadata 에 실은 agent_cli 가 그대로 본문 metadata 로 간다(맨 위가 아니다 — SDK 가 버린다)
 *   - CLI 에이전트에는 수정 지시(/chat/steer)를 묻지 않는다(501 unsupported). 묻더라도 거절이면 새 턴으로 되돌린다
 *
 * 서비스 파일은 '@/' 별칭과 확장자 없는 import 를 써서 node 가 바로 불러오지 못한다.
 * 배포되는 코드를 그대로 보게 하려고, 그 두 import 만 갈아 끼운 사본을 불러온다.
 *
 * 실행: node --test src/services/agentStreamSessionStatus.test.js
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLI_AGENTS_URL = pathToFileURL(path.join(HERE, '..', 'utils', 'cliAgents.js')).href;

async function loadService(file) {
    let src = fs.readFileSync(path.join(HERE, file), 'utf8');
    const swaps = [
        [`import { buildAgentHeaders } from './agentRequestHeaders';`, 'const buildAgentHeaders = () => ({});'],
        [`import { assertAiEnabled } from '@/utils/aiFeatureGate';`, 'const assertAiEnabled = () => {};'],
        [`import { agentStreamError } from '@/utils/cliAgents';`, `import { agentStreamError } from '${CLI_AGENTS_URL}';`]
    ];
    for (const [from, to] of swaps) {
        assert.ok(src.includes(from), `${file} 에 '${from}' 가 없다 — 시험의 갈아 끼우기를 고쳐야 한다`);
        src = src.replace(from, to);
    }
    return import(`data:text/javascript;base64,${Buffer.from(src).toString('base64')}`);
}

/** SSE 응답. 프레임을 일부러 잘게 쪼개 보내 줄 경계 처리도 함께 본다. */
function sseResponse(frames) {
    const text = frames.map((f) => `data: ${typeof f === 'string' ? f : JSON.stringify(f)}\n\n`).join('');
    const bytes = new TextEncoder().encode(text);
    const body = new ReadableStream({
        start(controller) {
            for (let i = 0; i < bytes.length; i += 7) controller.enqueue(bytes.slice(i, i + 7));
            controller.close();
        }
    });
    return { ok: true, status: 200, body, headers: new Headers({ 'content-type': 'text/event-stream' }) };
}

const FRAMES = [
    { type: 'session_status', status: 'starting', agent_type: 'cliagents', elapsed_ms: 0 },
    { type: 'session_status', status: 'starting', agent_type: 'cliagents', elapsed_ms: 2000 },
    { type: 'session_status', status: 'ready', agent_type: 'cliagents', waited_ms: 3100 },
    { type: 'something_new_from_the_future', x: 1 },
    'not json',
    { type: 'token', content: '안녕' },
    { type: 'token', content: '하세요' },
    { type: 'done', content: '안녕하세요' }
];

function withFetch(response, fn) {
    const original = globalThis.fetch;
    const calls = [];
    globalThis.fetch = async (url, init) => {
        calls.push({ url, init, body: JSON.parse(init.body) });
        return response;
    };
    return Promise.resolve(fn(calls)).finally(() => {
        globalThis.fetch = original;
    });
}

function recorder() {
    const events = [];
    return {
        events,
        callbacks: {
            onSessionStatus: (e) => events.push(['status', e.status, e.elapsed_ms ?? e.waited_ms]),
            onToken: (t) => events.push(['token', t]),
            onDone: (c) => events.push(['done', c]),
            onError: (e) => events.push(['error', e.message, e.code || ''])
        }
    };
}

const PARAMS = {
    message: '보고서 써 줘',
    tenant_id: 'localhost',
    user_uid: 'u-1',
    conversation_id: 'room-1',
    metadata: { agent_cli: 'codex', agent_model: 'gpt-5-codex', room_recent_history: [] }
};

test('FixedBaseWorkAssistantAgentService: 상태 프레임 → onSessionStatus, 그 뒤 평소 스트림', async () => {
    const { default: Service } = await loadService('FixedBaseWorkAssistantAgentService.js');
    const r = recorder();
    await withFetch(sseResponse(FRAMES), async (calls) => {
        await new Service('/process-gpt-cli-agent').sendMessageStream(PARAMS, r.callbacks);
        assert.equal(calls[0].url, '/process-gpt-cli-agent/chat/stream');
        assert.equal(calls[0].body.metadata.agent_cli, 'codex');
        assert.equal(calls[0].body.metadata.agent_model, 'gpt-5-codex');
        assert.equal('agent_cli' in calls[0].body, false);
    });
    assert.deepEqual(r.events, [
        ['status', 'starting', 0],
        ['status', 'starting', 2000],
        ['status', 'ready', 3100],
        ['token', '안녕'],
        ['token', '하세요'],
        ['done', '안녕하세요']
    ]);
});

test('DeepAgentRouterService: 같은 프레임을 같은 콜백으로 넘긴다', async () => {
    const { DeepAgentRouterService } = await loadService('DeepAgentRouterService.js');
    const r = recorder();
    await withFetch(sseResponse(FRAMES), async (calls) => {
        await new DeepAgentRouterService('/process-gpt-cli-agent').sendMessageStream('agent-1', PARAMS, r.callbacks);
        assert.equal(calls[0].url, '/process-gpt-cli-agent/chat/stream');
        assert.equal(calls[0].body.metadata.agent_cli, 'codex');
        assert.equal('agent_cli' in calls[0].body, false);
    });
    assert.deepEqual(
        r.events.map((e) => e[0]),
        ['status', 'status', 'status', 'token', 'token', 'done']
    );
});

test('onSessionStatus 를 주지 않은 화면은 아무 일 없이 지나간다', async () => {
    const { default: Service } = await loadService('FixedBaseWorkAssistantAgentService.js');
    const tokens = [];
    await withFetch(sseResponse(FRAMES), () =>
        new Service('/process-gpt-codex').sendMessageStream({ message: 'x' }, { onToken: (t) => tokens.push(t) })
    );
    assert.deepEqual(tokens, ['안녕', '하세요']);
});

test('Pod 를 띄우지 못하면 라우터의 오류 프레임이 오류로 간다', async () => {
    const { default: Service } = await loadService('FixedBaseWorkAssistantAgentService.js');
    const r = recorder();
    const frames = [
        { type: 'session_status', status: 'starting', agent_type: 'codex', elapsed_ms: 0 },
        { type: 'error', error: '에이전트를 준비하지 못했습니다. 잠시 뒤 다시 시도해 주세요.', code: 'runner_start_timeout' }
    ];
    await withFetch(sseResponse(frames), () => new Service('/process-gpt-codex').sendMessageStream({ message: 'x' }, r.callbacks));
    assert.deepEqual(r.events, [
        ['status', 'starting', 0],
        ['error', '에이전트를 준비하지 못했습니다. 잠시 뒤 다시 시도해 주세요.', 'runner_start_timeout']
    ]);
});

test('cli-agent 의 거절: 사유는 content 에, code · available 은 오류에 붙어 온다(두 서비스 모두)', async () => {
    const frame = {
        type: 'error',
        code: 'cli_not_selected',
        content: 'No CLI selected for this chat.',
        available: ['claude-code', 'codex']
    };
    const { default: Fixed } = await loadService('FixedBaseWorkAssistantAgentService.js');
    const { DeepAgentRouterService } = await loadService('DeepAgentRouterService.js');
    for (const send of [
        (cb) => new Fixed('/process-gpt-cli-agent').sendMessageStream({ message: 'x' }, cb),
        (cb) => new DeepAgentRouterService('/process-gpt-cli-agent').sendMessageStream('a', { message: 'x' }, cb)
    ]) {
        let got = null;
        await withFetch(sseResponse([frame]), () => send({ onError: (e) => (got = e) }));
        // 예전에는 error · message 만 보아 「Agent error」만 남았다.
        assert.equal(got.message, 'No CLI selected for this chat.');
        assert.equal(got.code, 'cli_not_selected');
        assert.deepEqual(got.available, ['claude-code', 'codex']);
    }
});

test('CLI 에이전트에는 수정 지시를 묻지 않는다 — 곧바로 거절해 새 턴으로 보낸다', async () => {
    const { DeepAgentRouterService } = await loadService('DeepAgentRouterService.js');
    const original = globalThis.fetch;
    let called = 0;
    globalThis.fetch = async () => {
        called++;
        throw new Error('부르면 안 된다');
    };
    try {
        const r = await new DeepAgentRouterService('/process-gpt-cli-agent', { supportsSteer: false }).steerStream('room-1', '방향 바꿔');
        assert.deepEqual(r, { accepted: false, reason: 'unsupported' });
        assert.equal(called, 0);
    } finally {
        globalThis.fetch = original;
    }
});

test('수정 지시를 501 unsupported 로 거절하는 런타임도 메시지를 삼키지 않는다(거절 → 부르는 쪽이 새 턴)', async () => {
    const { DeepAgentRouterService } = await loadService('DeepAgentRouterService.js');
    const response = { ok: false, status: 501, json: async () => ({ accepted: false, reason: 'unsupported' }) };
    await withFetch(response, async () => {
        const r = await new DeepAgentRouterService('/process-gpt-codex').steerStream('room-1', '방향 바꿔');
        assert.equal(r.accepted, false);
        assert.equal(r.reason, 'unsupported');
    });
});

test('CLI 를 고르지 않은 대화의 요청에는 agent_cli 칸이 없다', async () => {
    const { default: Service } = await loadService('FixedBaseWorkAssistantAgentService.js');
    await withFetch(sseResponse([{ type: 'done', content: '' }]), async (calls) => {
        await new Service('/process-gpt-deepagents').sendMessageStream({ message: 'x' }, {});
        assert.equal('agent_cli' in calls[0].body, false);
        assert.equal('agent_cli' in calls[0].body.metadata, false);
    });
});
