/**
 * 에이전트 호출 준비.
 *
 * 지키려는 것
 *   - 앱에서 부를 수 있는 절대 주소를 만드는 것 (상대 경로면 앱 자신에게 요청한다)
 *   - 빠뜨리면 조용히 실패하는 값들을 꼭 싣는 것
 *   - 질문이 답변에 덮이지 않는 것
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { basePathFor, buildAgentMessage, buildParams, streamUrl, withKnowledge } from './agentChat.js';

const session = { user: { id: 'u-1', email: 'me@company.com' } };

test('딥 에이전트는 전용 경로로 간다', () => {
    assert.equal(basePathFor('deepagents'), '/process-gpt-deepagents');
});

test('그 밖의 에이전트는 공통 경로로 간다', () => {
    assert.equal(basePathFor('langchain-react'), '/agent');
    assert.equal(basePathFor('a2a'), '/agent');
    assert.equal(basePathFor(''), '/agent');
});

test('앱에서 부를 절대 주소를 만든다', () => {
    // 상대 경로로 두면 앱은 자기 자신(https://localhost)에게 요청한다.
    assert.equal(
        streamUrl('https://uengine.process-gpt.io', 'deepagents'),
        'https://uengine.process-gpt.io/process-gpt-deepagents'
    );
});

test('주소 끝의 슬래시를 정리한다', () => {
    assert.equal(streamUrl('https://a.b/', 'langchain-react'), 'https://a.b/agent');
});

// ---------------------------------------------------------------------------
// 요청 값
// ---------------------------------------------------------------------------

test('빠뜨리면 401 이 되는 값들을 싣는다', () => {
    const p = buildParams({
        text: '안녕',
        roomId: 'room-1',
        session,
        tenantId: 'uengine',
        jwt: 'jwt-1',
        ids: { message: 'm-1', response: 'r-1' }
    });

    assert.equal(p.tenant_id, 'uengine');
    assert.equal(p.user_jwt, 'jwt-1');
    assert.equal(p.conversation_id, 'room-1');
    assert.equal(p.user_uid, 'u-1');
    assert.equal(p.user_email, 'me@company.com');
});

test('질문과 답변에 서로 다른 식별자를 준다', () => {
    // 같으면 에이전트 응답이 사용자 메시지 행을 덮어써 질문이 사라진다.
    const p = buildParams({ text: 'x', roomId: 'r', session, ids: { message: 'm-1', response: 'r-1' } });

    assert.notEqual(p.message_uuid, p.response_message_uuid);
});

test('로그인 정보가 없어도 만들어지긴 한다', () => {
    // 여기서 던지면 화면이 멈춘다. 값이 비면 서버가 거절하고, 그건 화면이 다룬다.
    const p = buildParams({ text: 'x', roomId: 'r', session: null });

    assert.equal(p.user_uid, '');
    assert.equal(p.message, 'x');
});

// ---------------------------------------------------------------------------
// 지식 문서
// ---------------------------------------------------------------------------

const doc = {
    key: 'drive:abc',
    name: '연차규정.pdf',
    sourceType: 'drive',
    sourceRef: 'abc',
    folderPath: '인사'
};

test('고른 문서를 실어 보낸다', () => {
    // 안 보내면 사용자는 문서를 참고해 답한 줄 알지만 에이전트는 본 적이 없다.
    const meta = withKnowledge({}, [doc]);

    assert.equal(meta.knowledge_docs.length, 1);
    assert.equal(meta.knowledge_docs[0].source_ref, 'abc');
});

test('고른 문서가 없으면 아무것도 덧붙이지 않는다', () => {
    assert.deepEqual(withKnowledge({ run_state: 'x' }, []), { run_state: 'x' });
    assert.deepEqual(withKnowledge(null, null), {});
});

test('기존 메타데이터를 지우지 않는다', () => {
    // run_state 가 사라지면 승인 대기 중이던 대화가 이어지지 않는다.
    const meta = withKnowledge({ run_state: { a: 1 } }, [doc]);

    assert.deepEqual(meta.run_state, { a: 1 });
});

test('문서는 요청에도 실린다', () => {
    const p = buildParams({ text: 'x', roomId: 'r', session, docs: [doc] });

    assert.equal(p.metadata.knowledge_docs.length, 1);
});

test('첨부 — 올린 파일을 함께 보낸다. 없으면 에이전트가 문서를 본 적이 없다', () => {
    const files = [{ fileName: 'a.pdf', publicUrl: 'https://u/a' }];
    const p = buildParams({ text: 'x', roomId: 'r', session: null, files });
    assert.equal(p.file_count, 1);
    assert.equal(p.file.fileName, 'a.pdf');
    assert.deepEqual(p.files, files);
});

test('첨부 — 주소가 없는 것은 빼고 보낸다. 열지도 못하면서 봤다고 답한다', () => {
    const p = buildParams({
        text: 'x',
        roomId: 'r',
        session: null,
        files: [{ fileName: 'bad.pdf', uploadError: true }, { fileName: 'nourl.pdf' }]
    });
    assert.equal(p.file_count, 0);
    assert.equal(p.file, null);
});

test('첨부 — 없으면 빈 목록', () => {
    const p = buildParams({ text: 'x', roomId: 'r', session: null });
    assert.deepEqual(p.files, []);
    assert.equal(p.file_count, 0);
});

test('첨부 — 사진은 [InputData] 블록으로 알린다. 없으면 "첨부된 사진이 없습니다" 라고 답한다', () => {
    const out = buildAgentMessage('이거 봐줘', { images: [{ id: 'i1', url: 'https://u/a.png' }] });
    assert.match(out, /^이거 봐줘/);
    assert.ok(out.includes('\n\n[InputData]\n'));
    const json = JSON.parse(out.split('[InputData]\n')[1]);
    assert.deepEqual(json.images, [{ id: 'i1', url: 'https://u/a.png' }]);
});

test('첨부 — 파일은 file 과 files 양쪽에 넣는다(포털 하위 호환)', () => {
    const out = buildAgentMessage('요약해줘', {
        files: [{ fileName: 'a.pdf', publicUrl: 'https://u/a', fileType: 'application/pdf', fileSize: 9 }]
    });
    const json = JSON.parse(out.split('[InputData]\n')[1]);
    assert.deepEqual(json.file, { url: 'https://u/a', name: 'a.pdf', contentType: 'application/pdf', size: 9 });
    assert.equal(json.files.length, 1);
});

test('첨부 — 없으면 블록을 붙이지 않는다. 빈 블록은 에이전트를 혼란스럽게 한다', () => {
    assert.equal(buildAgentMessage('그냥 질문'), '그냥 질문');
    assert.equal(buildAgentMessage('그냥 질문', { images: [], files: [] }), '그냥 질문');
});

test('첨부 — 주소 없는 파일은 블록에도 넣지 않는다', () => {
    assert.equal(buildAgentMessage('x', { files: [{ fileName: 'a.pdf' }] }), 'x');
});

test('첨부 — buildParams 의 본문에도 블록이 실린다', () => {
    const p = buildParams({
        text: '봐줘',
        roomId: 'r',
        session: null,
        images: [{ id: 'i', url: 'https://u/a.png' }]
    });
    assert.ok(p.message.includes('[InputData]'));
});

test('첨부 — 대화에서 지금까지 오간 파일을 매번 다시 싣는다', () => {
    const out = buildAgentMessage('요약해줘', {
        sessionFiles: [{ fileName: 'a.pdf', publicUrl: 'https://u/a' }]
    });
    const json = JSON.parse(out.split('[InputData]\n')[1]);
    assert.equal(json.session_files.length, 1);
    assert.equal(json.session_files[0].name, 'a.pdf');
});

test('첨부 — 이번 턴 파일도 session_files 에 함께 들어간다', () => {
    const out = buildAgentMessage('x', {
        files: [{ fileName: 'now.pdf', publicUrl: 'https://u/now' }],
        sessionFiles: [{ fileName: 'before.pdf', publicUrl: 'https://u/before' }]
    });
    const json = JSON.parse(out.split('[InputData]\n')[1]);
    assert.deepEqual(json.session_files.map((f) => f.name), ['before.pdf', 'now.pdf']);
});

test('첨부 — 같은 파일이 두 번 실리지 않는다', () => {
    const same = { fileName: 'a.pdf', publicUrl: 'https://u/a' };
    const out = buildAgentMessage('x', { files: [same], sessionFiles: [same] });
    const json = JSON.parse(out.split('[InputData]\n')[1]);
    assert.equal(json.session_files.length, 1);
});

test('첨부 — 지난 파일만 있어도 블록을 만든다. 없으면 에이전트가 문서를 잊는다', () => {
    const out = buildAgentMessage('그 문서 요약해줘', {
        sessionFiles: [{ fileName: 'a.pdf', publicUrl: 'https://u/a' }]
    });
    assert.ok(out.includes('[InputData]'));
});

test('멘션 — 지목한 상대를 함께 보낸다. 없으면 엉뚱한 에이전트가 답한다', () => {
    const p = buildParams({
        text: '@휴가봇 확인해줘',
        roomId: 'r',
        session: null,
        mentioned: [{ id: 'a2', username: '휴가봇' }]
    });
    assert.deepEqual(p.mentioned_users, [{ id: 'a2', username: '휴가봇' }]);
});

test('멘션 — 지목이 없으면 빈 목록. 서버가 고른다', () => {
    assert.deepEqual(buildParams({ text: 'x', roomId: 'r', session: null }).mentioned_users, []);
});
