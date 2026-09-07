import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { followUp, parseToolResult } from './agentResult.js';

const created = JSON.stringify({
    success: true,
    workitem_id: 'ffffd520-e80f-4caf-bb97-2db046f2b41a',
    message: '컨설팅 기반 프로세스 생성 워크아이템이 생성되었습니다.',
    status: 'IN_PROGRESS',
    agent_orch: 'pdf2bpmn'
});

describe('parseToolResult', () => {
    it('중괄호 덩어리 대신 안의 말을 보여 준다', () => {
        const out = parseToolResult(created);
        assert.equal(out.text, '컨설팅 기반 프로세스 생성 워크아이템이 생성되었습니다.');
        assert.equal(out.ok, true);
    });

    it('따라갈 곳을 함께 준다 — 생성은 이제부터 뒤에서 진행된다', () => {
        assert.deepEqual(parseToolResult(created).follow, {
            label: '진행 상황 보기',
            route: '/tasks/ffffd520-e80f-4caf-bb97-2db046f2b41a'
        });
    });

    it('실패는 실패라고 말한다', () => {
        const out = parseToolResult(JSON.stringify({ success: false, message: '만들지 못했습니다' }));
        assert.match(out.text, /실패/);
        assert.equal(out.follow, null);
    });

    it('평범한 답변은 건드리지 않는다', () => {
        assert.equal(parseToolResult('휴가 신청 프로세스를 만들었습니다.'), null);
        assert.equal(parseToolResult(''), null);
    });

    it('앞뒤에 말이 섞인 글은 손대지 않는다 — 설명까지 지워 버리면 안 된다', () => {
        assert.equal(parseToolResult(`이렇게 만들었습니다.\n${created}`), null);
    });

    it('무슨 뜻인지 알 수 없는 JSON 은 그대로 둔다', () => {
        assert.equal(parseToolResult(JSON.stringify({ a: 1, b: 2 })), null);
        assert.equal(parseToolResult(JSON.stringify({ success: true })), null);
    });
});

describe('followUp', () => {
    it('건 식별자만 있으면 진행 현황으로 보낸다', () => {
        assert.deepEqual(followUp({ proc_inst_id: 'inst-1' }), {
            label: '진행 상황 보기',
            route: '/instances/inst-1'
        });
    });

    it('따라갈 곳이 없으면 만들지 않는다', () => {
        assert.equal(followUp({}), null);
    });
});
