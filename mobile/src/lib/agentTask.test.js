import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { agentStatusText, readableDescription, runsByAgent, stillRunning, taskTitle } from './agentTask.js';

const REAL = '[Description] 컨설팅 결과를 바탕으로 BPMN 프로세스를 생성합니다. (업로드 문서 없음) '
    + '[Instruction] 1. 컨설팅 내용을 분석하세요. [InputData] {"input_mode": "consulting"}';

describe('readableDescription', () => {
    it('사람이 읽을 설명만 남긴다 — 지시문과 입력데이터는 사용자의 것이 아니다', () => {
        assert.equal(
            readableDescription(REAL),
            '컨설팅 결과를 바탕으로 BPMN 프로세스를 생성합니다. (업로드 문서 없음)'
        );
    });

    it('구획이 없으면 뒤에 붙은 것만 뗀다', () => {
        assert.equal(readableDescription('금액을 확인하고 승인'), '금액을 확인하고 승인');
        assert.equal(readableDescription('승인해 주세요 [InputData] {"a":1}'), '승인해 주세요');
    });

    it('빈 설명', () => {
        assert.equal(readableDescription(''), '');
        assert.equal(readableDescription(null), '');
    });
});

describe('runsByAgent', () => {
    it('에이전트가 맡은 업무를 알아본다 — 입력 폼을 보여 줄 이유가 없다', () => {
        assert.equal(runsByAgent({ agent_orch: 'pdf2bpmn' }), true);
        assert.equal(runsByAgent({ activity_name: '승인' }), false);
    });
});

describe('taskTitle', () => {
    it('내부 엔진 이름 대신 사람이 아는 말로', () => {
        assert.equal(taskTitle({ activity_name: 'pdf2bpmn', agent_orch: 'pdf2bpmn' }), '프로세스 생성');
    });

    it('제대로 된 활동 이름이면 그대로 쓴다', () => {
        assert.equal(taskTitle({ activity_name: '휴가 신청서 검토', agent_orch: 'pdf2bpmn' }), '휴가 신청서 검토');
    });

    it('아무 이름도 없으면 대체 문구', () => {
        assert.equal(taskTitle({}), '업무');
    });
});

describe('agentStatusText / stillRunning', () => {
    it('기다리는 사람에게 필요한 한 문장', () => {
        assert.match(agentStatusText({ status: 'IN_PROGRESS' }), /처리하고 있습니다/);
        assert.match(agentStatusText({ status: 'DONE' }), /끝났습니다/);
    });

    it('끝났는지 알려 준다 — 끝나지 않았으면 화면이 다시 확인해야 한다', () => {
        assert.equal(stillRunning({ status: 'IN_PROGRESS' }), true);
        assert.equal(stillRunning({ status: 'DONE' }), false);
        assert.equal(stillRunning({ status: 'CANCELLED' }), false);
    });
});
