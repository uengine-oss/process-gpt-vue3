/**
 * 말로 하는 대화의 규칙.
 *
 * 지키려는 것
 *   - 오간 말이 글로도 남는 것. 안 남으면 대화를 다시 열었을 때 빈 방이 된다.
 *   - 순서가 뒤집히지 않는 것. OpenAI 는 답변 전사가 질문 전사보다 먼저 온다.
 *   - 앱에서 앱 자신에게 연결하려 들지 않는 것.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    canUseVoice,
    placeUserMessage,
    voiceAgentMessage,
    voiceHistory,
    voiceSocketUrl,
    voiceStatusText,
    voiceUserMessage
} from './index.js';

const ME = { email: 'me@company.com', username: '홍길동' };
const AGENT = { id: 'a1', username: '업무 도우미' };

// ---------------------------------------------------------------------------
// 누가 말할 수 있는가
// ---------------------------------------------------------------------------

test('나와 에이전트 단둘일 때만 말로 할 수 있다', () => {
    assert.equal(canUseVoice([{ email: 'me' }, { email: 'bot', is_agent: true }]), true);
});

test('사람이 여럿이면 쓰지 않는다 — 누구의 말인지 모호해진다', () => {
    assert.equal(canUseVoice([{ email: 'me' }, { email: 'you' }]), false);
    assert.equal(
        canUseVoice([{ email: 'me' }, { email: 'you' }, { email: 'bot', is_agent: true }]),
        false
    );
});

test('에이전트가 둘이어도 쓰지 않는다', () => {
    assert.equal(canUseVoice([{ is_agent: true }, { is_agent: true }]), false);
});

test('혼자 있는 방에서는 쓰지 않는다', () => {
    assert.equal(canUseVoice([{ email: 'me' }]), false);
    assert.equal(canUseVoice([]), false);
    assert.equal(canUseVoice(null), false);
});

test('isAgent 로 적힌 것도 알아본다', () => {
    assert.equal(canUseVoice([{ email: 'me' }, { email: 'bot', isAgent: true }]), true);
});

// ---------------------------------------------------------------------------
// 지난 대화 넘기기
// ---------------------------------------------------------------------------

test('방금까지 글로 나눈 이야기를 함께 넘긴다', () => {
    const msgs = [
        { mine: true, text: '휴가 신청 어떻게 해?' },
        { mine: false, text: '휴가 신청 프로세스를 쓰시면 됩니다.' }
    ];

    assert.deepEqual(voiceHistory(msgs), [
        { role: 'user', content: '휴가 신청 어떻게 해?' },
        { role: 'assistant', content: '휴가 신청 프로세스를 쓰시면 됩니다.' }
    ]);
});

test('빈 말과 아직 오는 중인 말은 넘기지 않는다', () => {
    const msgs = [
        { mine: true, text: '   ' },
        { mine: false, text: '오는 중', isLoading: true },
        { mine: true, text: '진짜 말' }
    ];

    assert.deepEqual(voiceHistory(msgs), [{ role: 'user', content: '진짜 말' }]);
});

test('길어지면 최근 것만 — 전부 보내면 응답이 느려진다', () => {
    const msgs = Array.from({ length: 50 }, (_, i) => ({ mine: true, text: `말 ${i}` }));

    const out = voiceHistory(msgs);
    assert.equal(out.length, 20);
    assert.equal(out.at(-1).content, '말 49');
});

test('content 로 적힌 포털 모양도 읽는다', () => {
    assert.deepEqual(voiceHistory([{ role: 'user', content: '안녕' }]), [
        { role: 'user', content: '안녕' }
    ]);
});

// ---------------------------------------------------------------------------
// 오간 말을 글로 남기기
// ---------------------------------------------------------------------------

test('사용자가 한 말을 대화 한 줄로 만든다', () => {
    const msg = voiceUserMessage({ text: '휴가 신청할게', user: ME, uuid: 'u1', at: 'T' });

    assert.equal(msg.role, 'user');
    assert.equal(msg.content, '휴가 신청할게');
    assert.equal(msg.email, 'me@company.com');
    assert.equal(msg.name, '홍길동');
    assert.equal(msg.isVoiceMessage, true);
    // 포털이 같은 표시를 쓴다 — 앱에서 말한 것을 웹에서도 알아본다.
    assert.equal(msg.contentType, 'voice');
});

test('에이전트가 한 말도 남긴다', () => {
    const msg = voiceAgentMessage({ text: '네, 도와드릴게요', agent: AGENT, uuid: 'a1', at: 'T' });

    assert.equal(msg.role, 'assistant');
    assert.equal(msg.name, '업무 도우미');
    assert.equal(msg.isVoiceResponse, true);
});

test('이름 없는 에이전트에도 부를 이름을 준다', () => {
    assert.equal(voiceAgentMessage({ text: '음', agent: null, uuid: 'x' }).name, 'AI');
});

test('빈 말은 남기지 않는다 — 빈 말풍선만 쌓인다', () => {
    assert.equal(voiceUserMessage({ text: '  ', user: ME, uuid: 'u' }), null);
    assert.equal(voiceAgentMessage({ text: '', agent: AGENT, uuid: 'a' }), null);
});

// ---------------------------------------------------------------------------
// 순서
// ---------------------------------------------------------------------------

test('에이전트 말이 먼저 들어와 있으면 그 앞에 끼운다', () => {
    // OpenAI 는 답변 전사가 질문 전사보다 먼저 온다. 규격상 정상이다.
    // 그대로 뒤에 붙이면 "답변 → 질문" 으로 뒤집혀 보인다.
    const before = [{ uuid: 'ai-1', role: 'assistant', content: '네' }];
    const mine = { uuid: 'me-1', role: 'user', content: '휴가 신청할게' };

    const after = placeUserMessage(before, mine, 'ai-1');

    assert.deepEqual(after.map((m) => m.uuid), ['me-1', 'ai-1']);
});

test('에이전트 말이 아직 없으면 뒤에 붙인다', () => {
    const after = placeUserMessage([{ uuid: 'old' }], { uuid: 'me-1' }, null);
    assert.deepEqual(after.map((m) => m.uuid), ['old', 'me-1']);
});

test('가리키는 에이전트 말을 못 찾으면 뒤에 붙인다', () => {
    const after = placeUserMessage([{ uuid: 'old' }], { uuid: 'me-1' }, '없는id');
    assert.deepEqual(after.map((m) => m.uuid), ['old', 'me-1']);
});

test('원래 목록을 건드리지 않는다', () => {
    const before = [{ uuid: 'ai-1' }];
    placeUserMessage(before, { uuid: 'me-1' }, 'ai-1');
    assert.equal(before.length, 1);
});

// ---------------------------------------------------------------------------
// 지금 무슨 일이 일어나는가
// ---------------------------------------------------------------------------

test('상태를 사람 말로 옮긴다', () => {
    assert.equal(voiceStatusText('listening'), '듣고 있습니다');
    assert.equal(voiceStatusText('playing'), '대답하는 중');
    assert.equal(voiceStatusText('error'), '연결하지 못했습니다');
    assert.equal(voiceStatusText('idle'), '');
});

test('모르는 상태에는 아무 말도 하지 않는다 — 기계 이름을 보여 주느니', () => {
    assert.equal(voiceStatusText('무언가'), '');
});

// ---------------------------------------------------------------------------
// 어디로 연결하는가
// ---------------------------------------------------------------------------

test('조직 서버로 연결한다', () => {
    assert.equal(
        voiceSocketUrl('https://uengine.process-gpt.io'),
        'wss://uengine.process-gpt.io/voice/ws'
    );
});

test('개발용 평문 주소면 ws 로', () => {
    assert.equal(voiceSocketUrl('http://10.0.2.2:8088'), 'ws://10.0.2.2:8088/voice/ws');
});

test('주소가 없으면 열지 않는다 — 앱 자신에게 연결하려 들면 안 된다', () => {
    assert.equal(voiceSocketUrl(''), '');
    assert.equal(voiceSocketUrl(null), '');
    assert.equal(voiceSocketUrl('주소아님'), '');
});
