/**
 * 인스턴스 업무의 이름 · 산출물 값 · 폼 정의를 대화(InstanceTimeline)와 산출물 칸(InstanceOutput)이
 * 같은 규칙으로 다루도록 모아 둔다. 한쪽만 고치면 같은 단계가 두 곳에서 다르게 보인다.
 */

/**
 * 서브 프로세스 단계는 엔진이 이름 뒤에 실행 범위 표시를 붙인다('현장조사: (:0)').
 * 사람이 읽을 이름이 아니므로 떼어 낸다.
 */
export function stripScopeSuffix(name) {
    return String(name || '')
        .replace(/\s*:\s*\([^()]*\)\s*$/, '')
        .trim();
}

/** 비어 있지 않은 값이 하나라도 있는가(객체 · 배열은 안까지 본다). */
export function hasValue(v) {
    if (v === null || v === undefined || v === '') return false;
    if (Array.isArray(v)) return v.some(hasValue);
    if (typeof v === 'object') return Object.values(v).some(hasValue);
    return true;
}

/** 업무가 가리키는 폼 id(tool 이 formHandler:<id>). */
export function formIdOf(work) {
    const tool = (work && work.tool) || '';
    return tool.startsWith('formHandler:') ? tool.slice('formHandler:'.length) : '';
}

/**
 * 업무들이 쓰는 폼 정의를 받아 온다.
 *
 * 서브 프로세스 단계의 폼은 부모가 아니라 서브 프로세스 정의에 딸려 있고, 자유 입력(defaultform)은
 * 어느 정의에도 딸리지 않는다(proc_defaultform). 부모 정의의 폼만 받으면 그런 단계는 입력 칸 없이
 * '제출' 만 보이거나, 산출물을 눌러도 원본 폼이 열리지 않는다. 정의마다 받고, 그래도 없는 폼은 id 로 받는다.
 *
 * @param {object} backend  listDefinition 을 가진 백엔드
 * @param {object} p
 * @param {string[]} p.defIds  받아 올 정의 id
 * @param {string[]} p.formIds  업무가 가리키는 폼 id
 * @param {Array} [p.have]  이미 가진 폼 정의
 * @param {Set<string>} [p.tried]  이미 받아 본 키(정의 id 와 '#폼 id'). 받아 볼 때마다 채운다.
 * @returns {Promise<Array>} 새로 받은 폼 정의(have 에 없던 것만)
 */
export async function fetchFormDefs(backend, { defIds, formIds, have = [], tried = new Set() }) {
    const known = new Set(have.map((f) => f.id));
    const fresh = [];
    const add = (list) =>
        (list || []).forEach((f) => {
            if (f && !known.has(f.id)) {
                known.add(f.id);
                fresh.push(f);
            }
        });
    const fetchAll = (keys, match) =>
        Promise.all(
            keys.map((key) => {
                tried.add(key);
                return backend.listDefinition('form_def', { match: match(key) }).catch(() => {
                    // 못 받으면 다음에 다시 받아 볼 수 있게 둔다. 카드는 값만으로 그린다.
                    tried.delete(key);
                    return [];
                });
            })
        );

    const defs = [...new Set((defIds || []).filter(Boolean))].filter((id) => !tried.has(id));
    (await fetchAll(defs, (id) => ({ proc_def_id: id }))).forEach(add);

    const byId = [...new Set((formIds || []).filter(Boolean))].filter((id) => !known.has(id) && !tried.has(`#${id}`));
    (await fetchAll(byId.map((id) => `#${id}`), (key) => ({ id: key.slice(1) }))).forEach(add);
    return fresh;
}
