import { expect, test } from '@playwright/test';
import { elementsToFlattenedDefinition } from '../../../src/utils/elementsToFlattened.js';

/**
 * bpmn-artifact-only-flow / 사용자 저장 확정 (bpmn-artifact-display spec)
 *
 * deepagent 가 전달한 출력계약(processDefinition: elements[])을 사용자가 ArtifactPanel '저장' 버튼으로
 * 확정할 때, 프론트는 elements[] → flattened(proc_def.definition) 로 변환해 저장한다. 이 변환이
 * 백엔드 스킬(save_to_supabase.flatten)과 동일하게 동작하는지 백엔드/서버 없이 검증한다.
 */

// deepagent complete_process_generation 이 emit 하는 출력계약 형태의 fixture.
const CONTRACT = {
    type: 'process-definition-result',
    processDefinition: {
        processDefinitionId: 'pd-test-1234',
        processDefinitionName: '휴가 신청 프로세스',
        roles: [{ name: '신청자' }, { name: '팀장' }],
        elements: [
            { elementType: 'Event', id: 'start_1', type: 'StartEvent', name: '시작' },
            {
                elementType: 'Activity',
                id: 'act_apply',
                type: 'UserActivity',
                name: '휴가 신청',
                role: '신청자',
                skills: ['leave-balance-check'],
                agentMode: 'complete',
                orchestration: 'deepagents'
            },
            { elementType: 'Gateway', id: 'gw_approve', type: 'ExclusiveGateway', name: '승인 여부' },
            { elementType: 'Activity', id: 'act_review', type: 'UserActivity', name: '결재 검토', role: '팀장' },
            { elementType: 'Event', id: 'end_1', type: 'EndEvent', name: '종료' },
            { elementType: 'Sequence', id: 'seq_1', source: 'start_1', target: 'act_apply' },
            { elementType: 'Sequence', id: 'seq_2', source: 'act_apply', target: 'gw_approve' },
            { elementType: 'Sequence', id: 'seq_3', source: 'gw_approve', target: 'act_review', condition: '승인' },
            { elementType: 'Sequence', id: 'seq_4', source: 'act_review', target: 'end_1' }
        ]
    },
    forms: [{ activity_id: 'act_apply', form_id: 'pd-test-1234_act_apply_form', html: '<section>폼</section>' }],
    agents: [{ name: '팀장 — 휴가 검토', role: '팀장', skills: ['leave-balance-check'], activity_ids: ['act_review'] }],
    skills: ['leave-balance-check']
};

test.describe('bpmn-artifact: 저장 변환(elements[] → flattened)', () => {
    test('출력계약을 proc_def.definition(flattened) 으로 정확히 변환한다', async () => {
        const flat = elementsToFlattenedDefinition(CONTRACT.processDefinition);

        // 타입별로 분리된다
        expect(flat.events).toHaveLength(2);
        expect(flat.activities).toHaveLength(2);
        expect(flat.gateways).toHaveLength(1);
        expect(flat.sequences).toHaveLength(4);

        // id/name 보존
        expect(flat.processDefinitionId).toBe('pd-test-1234');
        expect(flat.processDefinitionName).toBe('휴가 신청 프로세스');

        // 타입 매핑 (BPMN elementType → ProcessGPT type)
        expect(flat.events.find((e) => e.id === 'start_1')?.type).toBe('startEvent');
        expect(flat.events.find((e) => e.id === 'end_1')?.type).toBe('endEvent');
        expect(flat.gateways[0].type).toBe('exclusiveGateway');
        expect(flat.activities.every((a) => a.type === 'userTask')).toBeTruthy();

        // 스킬·자동화 속성 보존
        const apply = flat.activities.find((a) => a.id === 'act_apply');
        expect(apply?.skills).toContain('leave-balance-check');
        expect(apply?.agentMode).toBe('complete');
        expect(apply?.orchestration).toBe('deepagents');

        // Sequence source/target 보존
        const seq = flat.sequences.find((s) => s.id === 'seq_3');
        expect(seq?.source).toBe('gw_approve');
        expect(seq?.target).toBe('act_review');
        expect(seq?.condition).toBe('승인');

        // roles 보존
        expect(flat.roles).toHaveLength(2);
    });

    test('빈/누락 정의도 안전하게 처리한다(저장 전 검증용)', async () => {
        const empty = elementsToFlattenedDefinition({ processDefinitionId: 'x', elements: [] });
        expect(empty.activities).toHaveLength(0);
        expect(empty.processDefinitionId).toBe('x');

        const none = elementsToFlattenedDefinition(null);
        expect(none.activities).toHaveLength(0);
    });
});
