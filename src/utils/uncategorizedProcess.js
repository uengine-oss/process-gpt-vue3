/**
 * 정의체계도의 "미분류" 판별 유틸리티
 *
 * 미분류 Mega/Major 는 DB 에 저장된 실제 노드가 아니라
 * ProcessDefinitionMap.updateUncategorizedProcesses() 가 로드 시점에 매번 새로 만들어내는
 * 임시 노드다. (저장 직전 saveProcess() 에서 다시 제거된다)
 * 따라서 이름 수정 등 편집 동작을 허용하면 안 된다.
 */

// 임시로 생성되는 미분류 노드의 이름 / ID
const UNCATEGORIZED_NAMES = ['미분류', 'uncategorized'];
const UNCATEGORIZED_IDS = ['uncategorized', 'uncategorized_major'];

/**
 * 프로세스 노드가 임시로 생성된 "미분류" 노드인지 판별한다.
 * @param {Object} process - mega / major 프로세스 노드
 * @param {String} [translatedName] - 현재 로케일의 미분류 표시명 ($t('processDefinitionMap.uncategorized'))
 * @returns {Boolean}
 */
export function isUncategorizedProcess(process, translatedName) {
    if (!process) return false;

    const names = [...UNCATEGORIZED_NAMES, translatedName].filter(Boolean).map((name) => String(name).toLowerCase());

    const name = process.name ? String(process.name).toLowerCase() : '';
    const id = process.id ? String(process.id).toLowerCase() : '';

    return names.includes(name) || names.includes(id) || UNCATEGORIZED_IDS.includes(id);
}
