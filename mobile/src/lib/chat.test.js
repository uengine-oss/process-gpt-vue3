/**
 * 대화 정규화.
 *
 * 여기서 지키려는 것: **메시지가 조용히 사라지지 않는 것.**
 * messages 컬럼에는 객체 하나일 때도 배열일 때도 있어서, 한쪽만 처리하면
 * 대화가 중간부터 비어 보인다.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { displayText, messagesFromRow, openuiLangOf, outgoingMessage, pendingPanel, toConversation } from './chat.js';

const T1 = '2026-08-31T01:00:00Z';
const T2 = '2026-08-31T02:00:00Z';

test('객체 하나로 온 메시지를 읽는다', () => {
    const list = messagesFromRow({ uuid: 'r1', messages: { role: 'user', content: '안녕' } });

    assert.equal(list.length, 1);
    assert.equal(list[0].content, '안녕');
    assert.equal(list[0].mine, true);
});

test('배열로 온 메시지도 읽는다', () => {
    // 한쪽만 처리하면 다른 쪽 대화가 통째로 안 보인다.
    const list = messagesFromRow({
        uuid: 'r1',
        messages: [
            { role: 'user', content: '질문' },
            { role: 'assistant', content: '답변' }
        ]
    });

    assert.deepEqual(list.map((m) => m.content), ['질문', '답변']);
    assert.deepEqual(list.map((m) => m.mine), [true, false]);
});

test('같은 행의 메시지들은 서로 다른 식별자를 갖는다', () => {
    // 같으면 화면이 하나만 그리거나 갱신할 때 엉뚱한 것을 바꾼다.
    const list = messagesFromRow({ uuid: 'r1', messages: [{ role: 'user', content: 'a' }, { role: 'user', content: 'b' }] });

    assert.notEqual(list[0].id, list[1].id);
});

test('내용이 없는 기록은 말풍선으로 만들지 않는다', () => {
    // 도구 호출만 있는 기록이 빈 말풍선으로 뜨면 대화가 끊긴 것처럼 보인다.
    const list = messagesFromRow({ messages: [{ role: 'assistant', content: '   ' }, { role: 'assistant' }] });

    assert.equal(list.length, 0);
});

test('구조화된 내용도 읽을 수 있게 만든다', () => {
    const list = messagesFromRow({ messages: { role: 'assistant', content: { result: 3 } } });

    assert.match(list[0].content, /result/);
    assert.doesNotMatch(list[0].content, /\[object/);
});

test('메시지가 없으면 빈 목록이다', () => {
    assert.deepEqual(messagesFromRow(null), []);
    assert.deepEqual(messagesFromRow({}), []);
    assert.deepEqual(messagesFromRow({ messages: [] }), []);
});

test('여러 행을 시간순으로 편다', () => {
    const rows = [
        { uuid: 'r2', messages: { role: 'assistant', content: '나중', timeStamp: T2 } },
        { uuid: 'r1', messages: { role: 'user', content: '먼저', timeStamp: T1 } }
    ];

    assert.deepEqual(toConversation(rows).map((m) => m.content), ['먼저', '나중']);
});

test('시각이 없는 메시지도 버리지 않는다', () => {
    const rows = [{ uuid: 'r1', messages: { role: 'user', content: '시각 없음' } }];

    assert.equal(toConversation(rows).length, 1);
});

// ---------------------------------------------------------------------------
// 답을 기다리는 메시지
// ---------------------------------------------------------------------------

test('승인 요청은 패널로 인식한다', () => {
    const panel = pendingPanel({ mine: false, content: '초안입니다. 이대로 진행할까요?' });

    assert.equal(panel.kind, 'approve_reject_with_edit');
});

test('후보 선택 요청은 선택 패널이다', () => {
    const panel = pendingPanel({
        mine: false,
        content: '무엇을 추가할지 선택해 주세요\n\n[스킬]\n• 연차관리: 설명'
    });

    assert.equal(panel.kind, 'select_items');
});

test('평범한 답변에는 패널을 붙이지 않는다', () => {
    // 아무 글에나 버튼이 생기면 답할 것도 없는 자리에 누를 것이 생긴다.
    assert.equal(pendingPanel({ mine: false, content: '조회 결과입니다.' }), null);
});

test('내가 쓴 글에는 패널을 붙이지 않는다', () => {
    assert.equal(pendingPanel({ mine: true, content: '이대로 진행할까요?' }), null);
});

// ---------------------------------------------------------------------------
// 보내기
// ---------------------------------------------------------------------------

test('보낼 메시지는 포털이 저장하는 모양과 같다', () => {
    const msg = outgoingMessage({ text: '확인했습니다', name: '홍길동', email: 'me@c.com', at: T1 });

    assert.deepEqual(msg, {
        name: '홍길동',
        role: 'user',
        email: 'me@c.com',
        image: '',
        images: [],
        files: [],
        content: '확인했습니다',
        timeStamp: T1
    });
});

test('사진 한 장은 image 와 images 양쪽에 담는다 — 포털이 옛 대화를 image 로 읽는다', () => {
    const msg = outgoingMessage({ text: '이것 좀', images: [{ url: 'https://u/a.png' }], at: T1 });
    assert.equal(msg.image, 'https://u/a.png');
    assert.deepEqual(msg.images, [{ url: 'https://u/a.png' }]);
});

test('여러 장이면 image 는 비우고 images 에만 담는다', () => {
    const msg = outgoingMessage({ text: 'x', images: [{ url: 'a' }, { url: 'b' }], at: T1 });
    assert.equal(msg.image, '');
    assert.equal(msg.images.length, 2);
});

test('글 없이 첨부만 보낼 수 있다 — 사진 한 장만 보내는 일이 흔하다', () => {
    assert.notEqual(outgoingMessage({ text: '', images: [{ url: 'a' }] }), null);
    assert.notEqual(outgoingMessage({ text: '', files: [{ fileName: 'a.pdf' }] }), null);
});

test('이름이 없으면 이메일로 대신한다', () => {
    assert.equal(outgoingMessage({ text: 'x', email: 'me@c.com' }).name, 'me@c.com');
});

test('빈 메시지는 만들지 않는다', () => {
    assert.equal(outgoingMessage({ text: '   ' }), null);
    assert.equal(outgoingMessage({}), null);
    assert.equal(outgoingMessage({ text: '', images: [], files: [] }), null);
});

test('사진만 있는 메시지도 말풍선이 된다 — 사라지면 보낸 사진이 없던 일이 된다', () => {
    const rows = [{ uuid: 'r1', messages: [{ role: 'user', content: '', image: 'https://u/a.png' }] }];
    const out = toConversation(rows);
    assert.equal(out.length, 1);
    assert.deepEqual(out[0].images, [{ url: 'https://u/a.png' }]);
});

test('되묻는 JSON 은 질문만 보여 준다 — 중괄호 덩어리가 그대로 보이면 안 된다', () => {
    const message = {
        content: JSON.stringify({
            user_request_type: 'ask_user',
            question: '어떤 작업을 원하시나요?',
            context: '첨부된 파일: testdoc.txt'
        })
    };
    assert.equal(displayText(message), '어떤 작업을 원하시나요?\n\n첨부된 파일: testdoc.txt');
});

test('평범한 답변은 그대로 보여 준다', () => {
    assert.equal(displayText({ content: '안녕하세요' }), '안녕하세요');
    assert.equal(displayText({}), '');
});

test('되묻는 JSON 은 제안을 누를 수 있는 패널이 된다', () => {
    const panel = pendingPanel({
        mine: false,
        content: JSON.stringify({
            user_request_type: 'ask_user',
            question: '어떤 작업을 원하시나요?',
            suggestions: ['요약해줘', '프로세스 만들어줘']
        })
    });
    assert.equal(panel.kind, 'select_items');
    // 패널은 {id,label} 을 기대한다. 문자열이면 글자 없는 동그라미만 보인다.
    assert.deepEqual(
        panel.items.map((i) => i.label),
        ['요약해줘', '프로세스 만들어줘']
    );
    assert.ok(panel.items.every((i) => typeof i.id === 'string' && i.id));
    assert.equal(panel.allowOther, true);
    assert.equal(panel.allowMultiple, false);
});

test('직접 적어야 뜻이 통하는 제안은 목록에서 뺀다 — 누르면 에이전트가 되묻는다', () => {
    const panel = pendingPanel({
        mine: false,
        content: JSON.stringify({
            user_request_type: 'ask_user',
            question: '이 프로세스 초안으로 생성할까요?',
            suggestions: ['이대로 프로세스 생성', '단계를 더 자세히 나눠줘', '더 간결하게 만들어줘', '역할/담당자를 조정해줘']
        })
    });
    assert.deepEqual(
        panel.items.map((i) => i.label),
        ['이대로 프로세스 생성', '단계를 더 자세히 나눠줘', '더 간결하게 만들어줘']
    );
    // 뺀 것은 직접 적는 칸으로 받는다.
    assert.equal(panel.allowOther, true);
});

test('산출물 JSON 은 본문에 중괄호를 남기지 않고 카드로 넘긴다', () => {
    const rows = [
        {
            uuid: 'r1',
            messages: [{ role: 'assistant', content: JSON.stringify({ slide_markdown: '# 제목', deck_title: '분기 보고' }) }]
        }
    ];
    const [msg] = toConversation(rows);
    assert.equal(msg.text, '');
    assert.equal(msg.artifact.kind, 'slide');
    assert.equal(msg.artifact.title, '분기 보고');
});

test('평범한 답변에는 산출물이 붙지 않는다', () => {
    const [msg] = toConversation([{ uuid: 'r1', messages: [{ role: 'assistant', content: '안녕하세요' }] }]);
    assert.equal(msg.artifact, null);
    assert.equal(msg.text, '안녕하세요');
});

test('저장된 메시지에서 입력 양식을 꺼낸다 — 포털과 같은 칸', () => {
    assert.equal(openuiLangOf({ openui_lang: '<form/>' }), '<form/>');
    assert.equal(openuiLangOf({ run_state: { openui_lang: '<form/>' } }), '<form/>');
    assert.equal(openuiLangOf({}), '');
});
