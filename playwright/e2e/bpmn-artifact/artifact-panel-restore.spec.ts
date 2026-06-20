import { expect, test } from '@playwright/test';
import {
    buildProcessPanelFromMessage,
    isRestorableProcessResult,
    processIdFromResult,
    processNameFromResult
} from '../../../src/utils/processArtifactPanel.js';

/**
 * bpmn-artifact-only-flow / 채팅방 재진입 시 산출물 패널 복원 (bpmn-artifact-display spec)
 *
 * 새로고침/재진입 시 ChatRoomPage.checkExistingArtifactPanels 가 영속된 메시지
 * (msg.pdf2bpmnResult.__contract)에서 우측 ArtifactPanel 의 process 패널을 재구성한다.
 * 그 핵심 결정 로직(복원 대상 판별 + 패널 디스크립터 생성)을 서버/컴포넌트 없이 검증한다.
 */

// onProcessResult → _mapPostprocessToPdf2bpmnResult 가 메시지에 박는 영속 형태(요지)
function persistedMessage() {
    return {
        uuid: 'msg-uuid-1',
        role: 'agent',
        content: '프로세스를 생성했어요. 확인 후 저장 버튼을 눌러주세요.',
        pdf2bpmnResult: {
            savedProcesses: [{ process_id: 'e2e-pd-0001', process_name: '휴가 신청 프로세스', bpmn_xml: '' }],
            savedSkills: [{ name: 'leave-balance-check' }],
            savedAgents: [{ id: 'agent_pl_review', name: '팀장 — 휴가 검토' }],
            __contract: {
                type: 'process-definition-result',
                processDefinition: { processDefinitionId: 'e2e-pd-0001', processDefinitionName: '휴가 신청 프로세스', elements: [] },
                forms: [],
                agents: [],
                skills: ['leave-balance-check']
            },
            __saved: false,
            __saving: false
        }
    };
}

test.describe('bpmn-artifact: 재진입 산출물 패널 복원(helper)', () => {
    test('영속된 출력계약에서 process 패널 디스크립터를 재구성한다', async () => {
        const msg = persistedMessage();
        const panel = buildProcessPanelFromMessage(msg);

        expect(panel).not.toBeNull();
        expect(panel!.type).toBe('process');
        expect(panel!.label).toBe('휴가 신청 프로세스');
        // 같은 객체 참조여야 저장 시 __saved 갱신이 패널에 반영된다
        expect(panel!.data.result).toBe(msg.pdf2bpmnResult);
        expect(panel!.data.messageId).toBe('msg-uuid-1');

        // '저장됨' 재확인에 쓰는 proc_def id 추출
        expect(processIdFromResult(msg.pdf2bpmnResult)).toBe('e2e-pd-0001');
        expect(processNameFromResult(msg.pdf2bpmnResult)).toBe('휴가 신청 프로세스');
    });

    test('출력계약(__contract)이 없으면 복원 대상이 아니다', async () => {
        expect(isRestorableProcessResult(null)).toBeFalsy();
        expect(isRestorableProcessResult({})).toBeFalsy();
        // 카드만 있고 전체 계약이 없는 구버전 요약은 복원하지 않는다(저장 불가 → 미리보기 의미 없음)
        expect(isRestorableProcessResult({ savedProcesses: [{ process_id: 'x' }] })).toBeFalsy();

        expect(buildProcessPanelFromMessage({ uuid: 'm', pdf2bpmnResult: { savedProcesses: [] } })).toBeNull();
        expect(buildProcessPanelFromMessage({ uuid: 'm' })).toBeNull();
        expect(buildProcessPanelFromMessage(null)).toBeNull();
    });

    test('프로세스명이 없으면 기본 라벨로 폴백한다', async () => {
        const panel = buildProcessPanelFromMessage({
            uuid: 'm2',
            pdf2bpmnResult: { __contract: { processDefinition: { elements: [] } }, savedProcesses: [] }
        });
        expect(panel).not.toBeNull();
        expect(panel!.label).toBe('생성된 프로세스');
        expect(panel!.data.messageId).toBe('m2');
    });
});
