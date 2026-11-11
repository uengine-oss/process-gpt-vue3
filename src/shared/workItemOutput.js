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

/**
 * 폼 정의들에서 항목 키 → 사람이 읽을 이름(「request_detail」 → 「요청사항」).
 *
 * 산출물 카드는 값에 붙은 키를 그대로 보여 줬다(「text-field-2 : …」). 폼에 적힌 이름이 있으면 그것을 쓴다.
 * 같은 키가 여러 폼에 있으면 먼저 받은 폼의 이름을 쓴다(호출하는 쪽이 해당 업무의 폼을 앞에 둔다).
 *
 * @param {object|object[]} forms  form_def 행(fields_json: [{key, text}])
 * @returns {Record<string, string>}
 */
export function fieldLabelsOf(forms) {
    const labels = {};
    (Array.isArray(forms) ? forms : [forms]).forEach((form) => {
        let fields = form && form.fields_json;
        if (typeof fields === 'string') {
            try {
                fields = JSON.parse(fields);
            } catch (e) {
                fields = [];
            }
        }
        (Array.isArray(fields) ? fields : []).forEach((f) => {
            const key = f && (f.key || f.name);
            const text = f && String(f.text || f.alias || f.label || '').trim();
            // 이름 칸에 키를 그대로 베낀 폼(text-field-2)은 이름이 없는 것과 같다 — 화면에서 「텍스트 2」 로 바꿔 부른다.
            if (key && text && text !== key && !labels[key]) labels[key] = text;
        });
    });
    return labels;
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

/** 미리보기 한 줄에 맞게 마크다운 표시(글머리 · 번호 · 제목 · 굵게)와 HTML 태그를 걷어 낸다. */
function plainLine(text) {
    return String(text)
        .split(/\r?\n/)
        .map((line) =>
            line
                .replace(/<[^>]*>/g, ' ')
                .replace(/^\s*(?:#{1,6}\s+|[-*+•·]\s+|\d{1,3}[.)]\s+|>\s+)/, '')
                .replace(/\*\*|__|`/g, '')
                .trim()
        )
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * 「전달받은 산출물」을 접어 둔 채 보여 줄 한 줄 미리보기와 값이 든 항목 수.
 * 글(문자열)이 있으면 폼 순서(order)대로 첫 글을, 없으면 첫 값을 쓴다.
 *
 * @param {object} values  폼 값({필드: 값})
 * @param {object} [opts]
 * @param {string[]} [opts.order]  필드 순서(폼 정의 fields_json 의 key 순서)
 * @param {number} [opts.maxLength]  미리보기 최대 글자 수
 * @returns {{ text: string, count: number }}
 */
export function outputPreview(values, { order = [], maxLength = 120 } = {}) {
    const v = values && typeof values === 'object' ? values : {};
    const keys = [...new Set([...(order || []).filter((k) => k in v), ...Object.keys(v)])].filter(
        (k) => k && !k.startsWith('__') && hasValue(v[k])
    );
    const pick = keys.find((k) => typeof v[k] === 'string' && plainLine(v[k])) ?? keys[0];
    let text = '';
    if (pick !== undefined) {
        const value = v[pick];
        if (typeof value === 'string') text = plainLine(value);
        else if (Array.isArray(value)) text = value.filter((x) => typeof x !== 'object').join(', ');
        else if (typeof value !== 'object') text = String(value);
    }
    if (text.length > maxLength) text = `${text.slice(0, maxLength).trimEnd()}…`;
    return { text, count: keys.length };
}
