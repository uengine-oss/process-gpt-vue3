/**
 * 프로세스 요소 ID 를 이름으로.
 *
 * 병합 전 검증의 시나리오·단계·근거는 실행 엔진이 `payment_check → ship_order` 처럼
 * 요소 ID 로 적는다. 변경 전/후 단계를 짝짓는 열쇠라 저장된 문구는 ID 로 두고,
 * 리뷰어에게 보여 줄 때만 정의의 이름으로 바꾼다. 방금 추가한 태스크(`Activity_0q13olf`)
 * 처럼 ID 만으로는 무엇인지 알 수 없는 요소가 특히 그렇다.
 */

// 이름을 가진 요소가 들어 있는 정의의 칸
const ELEMENT_KEYS = ['activities', 'gateways', 'events', 'subProcesses'];

function parseDefinition(definition) {
    if (!definition) return null;
    if (typeof definition === 'object') return definition;
    try {
        return JSON.parse(definition);
    } catch (e) {
        return null;
    }
}

function collect(container, labels) {
    for (const key of ELEMENT_KEYS) {
        const elements = Array.isArray(container?.[key]) ? container[key] : [];
        for (const element of elements) {
            if (!element || typeof element !== 'object') continue;
            const id = element.id == null ? '' : String(element.id).trim();
            const name = element.name == null ? '' : String(element.name).trim();
            if (id && name && name !== id) labels[id] = name;
            // 서브프로세스는 안에 자기 요소를 품는다.
            if (ELEMENT_KEYS.some((k) => Array.isArray(element[k]))) collect(element, labels);
        }
    }
}

/**
 * 정의 여러 벌에서 {요소 ID: 이름} 표를 만든다.
 *
 * 오래된 것부터 넘기면 뒤의 이름이 앞의 이름을 덮는다 — 이름이 바뀐 요소는 최신 이름으로,
 * 변경 전 버전에만 있던(삭제된) 요소도 이름으로 보인다. 문자열로 저장된 정의도 읽는다.
 */
export function buildActivityLabels(definitions) {
    const labels = {};
    for (const raw of definitions || []) {
        const definition = parseDefinition(raw);
        if (definition) collect(definition, labels);
    }
    return labels;
}

/** ID 하나를 이름으로. 모르는 ID 는 그대로 — 감추면 무엇인지 알 수 없다. */
export function labelOf(id, labels) {
    const key = id == null ? '' : String(id);
    return (labels && labels[key]) || key;
}

/** 실행 경로(ID 배열)를 이름 배열로. */
export function labelPath(order, labels) {
    return (order || []).map((id) => labelOf(id, labels));
}

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 문구 속 요소 ID 를 이름으로 바꾼다.
 *
 * 긴 ID 부터 맞추고 앞뒤가 영숫자·밑줄이 아닐 때만 바꾼다 — `check` 라는 ID 가 있어도
 * `payment_check` 의 일부를 건드리지 않고, `endEvent` 같은 낱말 안의 `end` 도 그대로 둔다.
 */
export function relabelText(text, labels) {
    const source = text == null ? '' : String(text);
    const ids = Object.keys(labels || {})
        .filter(Boolean)
        .sort((a, b) => b.length - a.length);
    if (!source || !ids.length) return source;
    const pattern = new RegExp(`(?<![A-Za-z0-9_])(${ids.map(escapeRegExp).join('|')})(?![A-Za-z0-9_])`, 'g');
    return source.replace(pattern, (id) => labels[id]);
}
