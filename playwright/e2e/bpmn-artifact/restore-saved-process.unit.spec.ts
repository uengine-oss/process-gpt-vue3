import { expect, test } from '@playwright/test';
import {
    isRestorableProcessResult,
    buildProcessPanelFromMessage,
    processIdFromResult,
    processNameFromResult
} from '../../../src/utils/processArtifactPanel.js';

/**
 * 결정적 단위 스펙 — 브라우저/서버 불필요.
 * OpenSpec change `wa-process-artifact-restore` / capability `bpmn-artifact-display` 의
 * "저장된 프로세스 산출물의 참조 기반 복원" 시나리오를 순수 헬퍼로 검증한다.
 *
 * 실행: BASE_URL=http://localhost:9 npx playwright test playwright/e2e/bpmn-artifact/restore-saved-process.unit.spec.ts
 *   (BASE_URL 을 주면 managed dev 서버를 띄우지 않는다 — 이 스펙은 page 를 쓰지 않는다.)
 */

// work-assistant 완료 경로가 chats.messages 에 실제로 영속하는 스키마(관측된 형태):
// savedProcesses 원소가 { id, name, bpmn_xml, neo4j_proc_id }, __contract 없음.
const persistedWorkAssistantResult = {
    taskId: 'consulting_13320b80a78c',
    processCount: 1,
    savedProcesses: [
        {
            id: '9160a7ba_a753_43da_9f53_db24983a5264',
            name: '국민신문고 민원 처리 프로세스',
            bpmn_xml: null,
            neo4j_proc_id: 'consulting_13320b80a78c'
        }
    ],
    generatedBpmns: [],
    savedSkills: [],
    savedAgents: [],
    processGraphs: {},
    integratedGraph: null,
    graphName: ''
};

// 라이브 매핑 스키마(_mapPostprocessToPdf2bpmnResult): process_id/process_name + __contract.
const liveMappedResult = {
    savedProcesses: [{ process_id: 'proc_live_1', process_name: '휴가 신청', bpmn_xml: '' }],
    savedSkills: [],
    savedAgents: [],
    __contract: { processDefinition: { processDefinitionId: 'proc_live_1', activities: [] }, forms: [] },
    __saved: false
};

test.describe('bpmn-artifact-display: 저장참조 기반 복원 (단위)', () => {
    test('Scenario: __contract 없는 저장참조 결과가 복원 가능으로 판정', () => {
        expect(isRestorableProcessResult(persistedWorkAssistantResult)).toBe(true);

        const panel = buildProcessPanelFromMessage({ pdf2bpmnResult: persistedWorkAssistantResult, uuid: 'msg-uuid-1' });
        expect(panel).not.toBeNull();
        expect(panel!.type).toBe('process');
        expect(panel!.label).toBe('국민신문고 민원 처리 프로세스');
        expect(panel!.data.result).toBe(persistedWorkAssistantResult);
        expect(panel!.data.messageId).toBe('msg-uuid-1');
    });

    test('Scenario: 저장참조 결과에서 process_id/이름 추출 (id/name 폴백)', () => {
        expect(processIdFromResult(persistedWorkAssistantResult)).toBe('9160a7ba_a753_43da_9f53_db24983a5264');
        expect(processNameFromResult(persistedWorkAssistantResult)).toBe('국민신문고 민원 처리 프로세스');
    });

    test('라이브 매핑 스키마(__contract/process_id)도 복원 가능 — 회귀 방지', () => {
        expect(isRestorableProcessResult(liveMappedResult)).toBe(true);
        expect(processIdFromResult(liveMappedResult)).toBe('proc_live_1');
        expect(processNameFromResult(liveMappedResult)).toBe('휴가 신청');
        const panel = buildProcessPanelFromMessage({ pdf2bpmnResult: liveMappedResult, uuid: 'msg-uuid-2' });
        expect(panel).not.toBeNull();
        expect(panel!.type).toBe('process');
    });

    test('복원 불가 케이스 — __contract 도 저장참조도 없으면 false', () => {
        expect(isRestorableProcessResult(null)).toBe(false);
        expect(isRestorableProcessResult({})).toBe(false);
        expect(isRestorableProcessResult({ savedProcesses: [] })).toBe(false);
        expect(isRestorableProcessResult({ savedProcesses: [{ name: '이름만' }] })).toBe(false);
        expect(buildProcessPanelFromMessage({ pdf2bpmnResult: { savedProcesses: [] } })).toBeNull();
        expect(buildProcessPanelFromMessage({})).toBeNull();
    });
});
