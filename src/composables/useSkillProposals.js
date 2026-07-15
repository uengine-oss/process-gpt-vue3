/**
 * feedback_proposals 배치 목록을 스킬별 미결(PENDING) SKILL 제안 맵으로 변환한다.
 *
 * 매칭은 targets[] 각 항목의 skill_name(tenant_skills.skill_name과 동일 문자열)을
 * 우선으로 하되, 아직 제안 생성 파이프라인(deepagents)이 SKILL target에
 * skill_name을 채워주지 않는 경우가 실제로 있어 — 이 경우 row-level
 * candidate_skill_names(non-binding hint)로 폴백한다. 폴백 매칭은 어떤 스킬이
 * 진짜 대상인지 확정할 수 없으므로 entry.isHintMatch로 표시해 화면에서
 * "추정" 임을 알 수 있게 한다.
 *
 * 사용 위치: SkillList.vue(사이드바), SkillsManagement.vue(스킬 관리 페이지)
 */

/**
 * 같은 배치 안에 같은 skill_name을 겨냥한 SKILL target이 여러 개 있을 수 있다
 * (분류기가 한 관심사당 하나씩, 같은 type의 target을 여러 개 만들 수 있음 — DB
 * 함수 decide_feedback_proposal_target의 주석 참고). batchId만으로는 이런
 * 항목들을 구분할 수 없어 화면에서 중복 키로 취급돼 하나만 보이는 문제가
 * 생기므로, targets 배열 내 위치(targetIndex)까지 포함한 key를 항상 함께 둔다.
 *
 * @param {Array<object>} batches feedback_proposals rows (status='PROPOSED'만 조회했다고 가정)
 * @returns {Map<string, Array<{
 *   key: string, batchId: string, targetIndex: number, artifact: any, skillName: string,
 *   isHintMatch: boolean, hintCandidates: string[], otherSkillNames: string[]
 * }>>}
 */
export function buildSkillProposalMap(batches) {
    const map = new Map();
    if (!Array.isArray(batches)) return map;

    for (const batch of batches) {
        if (!batch || batch.status !== 'PROPOSED') continue;
        const targets = Array.isArray(batch.targets) ? batch.targets : [];
        const pendingSkillTargets = targets
            .map((target, targetIndex) => ({ target, targetIndex }))
            .filter(({ target }) => target && target.type === 'SKILL' && target.status === 'PENDING');
        if (pendingSkillTargets.length === 0) continue;

        const candidateNames = Array.isArray(batch.candidate_skill_names) ? [...new Set(batch.candidate_skill_names.filter(Boolean))] : [];

        // target별로 "이 target이 나타내는 스킬명 후보" 목록. skill_name이 있으면 그 하나뿐,
        // 없으면 row의 candidate_skill_names 전체(=확정 불가, 후보 다수일 수 있음).
        const namesPerTarget = pendingSkillTargets.map(({ target }) => (target.skill_name ? [target.skill_name] : candidateNames));

        pendingSkillTargets.forEach(({ target, targetIndex }, i) => {
            const namesToUse = namesPerTarget[i];
            if (namesToUse.length === 0) return; // skill_name도 없고 candidate 힌트도 없으면 매칭 불가 — 배지 안 뜸(디그레이드 세이프)

            const isHintMatch = !target.skill_name;
            // "공유 배치" 경고는 다른 target(different targetIndex)이 같은 배치에서 경쟁할 때만 의미가 있다
            // (decide RPC가 배열 순서상 첫 PENDING만 결정하므로 오귀속 위험 — design.md D4).
            // 같은 target을 가리키는 hint 후보끼리는 여기 포함하지 않는다(그건 "어떤 스킬인지 불확실"이지
            // "다른 항목이 먼저 처리될 위험"이 아님 — hintCandidates로 별도 표시).
            const otherTargetNames = [...new Set(namesPerTarget.filter((_, j) => j !== i).flat())];

            for (const skillName of namesToUse) {
                const entry = {
                    key: `${batch.id}:${targetIndex}:${skillName}`,
                    batchId: batch.id,
                    targetIndex,
                    artifact: target.artifact,
                    skillName,
                    isHintMatch,
                    hintCandidates: isHintMatch ? namesToUse.filter((n) => n !== skillName) : [],
                    otherSkillNames: otherTargetNames.filter((n) => n !== skillName)
                };
                if (!map.has(skillName)) {
                    map.set(skillName, []);
                }
                map.get(skillName).push(entry);
            }
        });
    }

    return map;
}
