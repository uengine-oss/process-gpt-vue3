/**
 * feedback_proposals 배치 목록을 리소스(id)별 미결(PENDING) target 맵으로 변환한다.
 * SKILL(useSkillProposals.js)과 달리 PROCESS_DEFINITION/DMN_RULE은 candidate hint 매칭이 없고
 * target.id (+ PROCESS_DEFINITION만 batch.proc_def_id 폴백)로만 귀속시킨다.
 * (실제 운영 데이터 확인 결과 PROCESS_DEFINITION target은 `resource_id`가 아니라 `id` 필드에
 * proc_def.id 값을 담아 온다 — 예: {"id":"28c2f5e6-...","name":"민원 처리 프로세스","type":"PROCESS_DEFINITION",...})
 *
 * 사용 위치: VerticalSidebar.vue(사이드바), ProcessDefinitionChatHeader.vue, DmnChat.vue
 *
 * @param {Array<object>} batches feedback_proposals rows (status='PROPOSED'만 조회했다고 가정)
 * @param {'PROCESS_DEFINITION'|'DMN_RULE'} targetType
 * @returns {Map<string, Array<{
 *   key: string, batchId: string, targetIndex: number, artifact: any, resourceId: string,
 *   isHintMatch: boolean, hintCandidates: string[], otherSkillNames: string[]
 * }>>}
 */
export function buildDefinitionProposalMap(batches, targetType) {
    const map = new Map();
    if (!Array.isArray(batches)) return map;
    if (targetType !== 'PROCESS_DEFINITION' && targetType !== 'DMN_RULE') return map;

    for (const batch of batches) {
        if (!batch || batch.status !== 'PROPOSED') continue;
        const targets = Array.isArray(batch.targets) ? batch.targets : [];

        targets.forEach((target, targetIndex) => {
            if (!target || target.type !== targetType || target.status !== 'PENDING') return;

            let resourceId = target.id || target.resource_id || null;
            if (!resourceId && targetType === 'PROCESS_DEFINITION') {
                // PROCESS_DEFINITION 전용 폴백: 배치는 항상 자기 자신이 속한 프로세스(batch.proc_def_id)에
                // 대한 것이므로, target에 id가 없어도 이 값으로 안전하게 귀속 가능.
                resourceId = batch.proc_def_id || null;
            }
            // DMN_RULE은 폴백 없음: batch.proc_def_id는 부모 프로세스 id이지 DMN 리소스 자신의 id가
            // 아니므로, id가 없으면 이 target은 어떤 DMN에도 안전하게 귀속시킬 수 없다
            // (배지 미표시로 디그레이드 — SKILL의 skill_name 없음 케이스와 동일한 안전 원칙).
            if (!resourceId) return;

            const entry = {
                key: `${batch.id}:${targetIndex}`,
                batchId: batch.id,
                targetIndex,
                artifact: target.artifact,
                resourceId,
                // SkillProposalReviewModal.vue가 기대하는 필드 형태를 맞추기 위한 placeholder.
                // PROCESS_DEFINITION/DMN_RULE target은 힌트 매칭을 쓰지 않으므로 항상 비어있다.
                isHintMatch: false,
                hintCandidates: [],
                otherSkillNames: []
            };

            if (!map.has(resourceId)) map.set(resourceId, []);
            map.get(resourceId).push(entry);
        });
    }

    return map;
}
