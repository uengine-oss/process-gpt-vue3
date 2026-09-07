/**
 * 대화 목록 표시.
 *
 * 지키려는 것: **마지막 메시지가 사람이 읽을 수 있게 보이는 것.**
 * message 컬럼은 문자열이 아니라 객체라, 그대로 내면 `{ "msg": ... }` 가 뜬다.
 * 그러면 목록에서 어느 대화인지 알아볼 수 없어 방을 하나씩 열어 봐야 한다.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { lastMessageAt, lastMessageText, preview, roomTitle, sortRooms, withPreview } from './rooms.js';

const T1 = '2026-03-04T08:34:08.200Z';
const T2 = '2026-03-11T02:47:53.438Z';

test('객체에서 본문만 꺼낸다', () => {
    const room = { message: { msg: '안녕', type: 'text', createdAt: T1 } };

    assert.equal(lastMessageText(room), '안녕');
});

test('문자열로 저장된 JSON 도 푼다', () => {
    const room = { message: '{"msg":"안녕","type":"text"}' };

    assert.equal(lastMessageText(room), '안녕');
});

test('그냥 문자열이면 그대로 쓴다', () => {
    assert.equal(lastMessageText({ message: '평범한 문장' }), '평범한 문장');
});

test('깨진 JSON 은 원문으로 보여 준다', () => {
    // 아무것도 안 보여 주면 목록이 비어 보인다.
    assert.equal(lastMessageText({ message: '{깨진' }), '{깨진');
});

test('메시지가 없으면 빈 문자열이다', () => {
    assert.equal(lastMessageText({}), '');
    assert.equal(lastMessageText(null), '');
    assert.equal(lastMessageText({ message: { type: 'text' } }), '');
});

test('다른 키 이름도 알아본다', () => {
    assert.equal(lastMessageText({ message: { content: '내용' } }), '내용');
    assert.equal(lastMessageText({ message: { text: '본문' } }), '본문');
});

// ---------------------------------------------------------------------------
// 한 줄 미리보기
// ---------------------------------------------------------------------------

test('줄바꿈을 없애 한 줄로 만든다', () => {
    // 그대로 두면 카드 높이가 제각각이 되어 훑기 어렵다.
    const room = { message: { msg: '첫 줄\n둘째 줄\n\n셋째' } };

    assert.equal(preview(room), '첫 줄 둘째 줄 셋째');
});

test('너무 길면 줄인다', () => {
    const room = { message: { msg: 'a'.repeat(200) } };

    const p = preview(room, 20);
    assert.equal(p.length, 21); // 20자 + 말줄임표
    assert.ok(p.endsWith('…'));
});

test('짧으면 그대로 둔다', () => {
    assert.equal(preview({ message: { msg: '짧음' } }), '짧음');
});

// ---------------------------------------------------------------------------
// 제목과 순서
// ---------------------------------------------------------------------------

test('이름이 없어도 구분되게 한다', () => {
    assert.equal(roomTitle({ name: '  ' }), '이름 없는 대화');
    assert.equal(roomTitle({}), '이름 없는 대화');
    assert.equal(roomTitle({ name: '휴가 문의' }), '휴가 문의');
});

test('최근 대화가 위로 온다', () => {
    const rooms = [
        { name: '오래됨', message: { msg: 'a', createdAt: T1 } },
        { name: '최근', message: { msg: 'b', createdAt: T2 } }
    ];

    assert.deepEqual(sortRooms(rooms).map((r) => r.name), ['최근', '오래됨']);
});

test('시각이 없는 방은 아래로 밀린다', () => {
    const rooms = [
        { name: '시각없음' },
        { name: '있음', message: { msg: 'b', createdAt: T2 } }
    ];

    assert.deepEqual(sortRooms(rooms).map((r) => r.name), ['있음', '시각없음']);
});

test('시각을 읽는다', () => {
    assert.equal(lastMessageAt({ message: { createdAt: T1 } }), new Date(T1).getTime());
    assert.equal(lastMessageAt({}), 0);
    assert.equal(lastMessageAt({ message: { createdAt: '언젠가' } }), 0);
});

test('목록이 없어도 터지지 않는다', () => {
    assert.deepEqual(sortRooms(null), []);
});

test('보낸 메시지를 방의 미리보기로 기록한다 — 없으면 목록이 영원히 "아직 대화 없음"', () => {
    const out = withPreview({ id: 'r1', name: '대화', tenant_id: 't' }, '안녕하세요', '2026-01-01T00:00:00Z');
    assert.equal(out.message.msg, '안녕하세요');
    assert.equal(out.message.createdAt, '2026-01-01T00:00:00Z');
    // 방의 다른 칸을 지우지 않는다. 일부만 쓰면 이름과 소속이 날아간다.
    assert.equal(out.name, '대화');
    assert.equal(out.tenant_id, 't');
});

test('미리보기는 한 줄로, 너무 길면 자른다', () => {
    const out = withPreview({ id: 'r1' }, '  여러\n줄로\n적힌   긴 글  ');
    assert.equal(out.message.msg, '여러 줄로 적힌 긴 글');
    assert.ok(withPreview({ id: 'r1' }, 'x'.repeat(200)).message.msg.length <= 50);
});

test('빈 글은 미리보기로 쓰지 않는다', () => {
    assert.equal(withPreview({ id: 'r1' }, '   '), null);
    assert.equal(withPreview(null, 'x'), null);
});
