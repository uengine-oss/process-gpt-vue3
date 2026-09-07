/**
 * 이전 단계에서 무엇이 나왔는가.
 *
 * 왜 필요한가
 *   승인 업무를 받은 사람이 가장 먼저 궁금해하는 것은 "무엇을 승인하라는 건가"
 *   다. 그런데 신청자가 적어 넣은 내용은 **앞 단계의 산출물**에 들어 있고,
 *   화면에는 활동 이름과 빈 입력칸만 있었다. 그러면 승인을 누를 근거가 없다.
 *
 *   `todolist.output` 은 폼 하나를 통째로 감싼 모양이다.
 *     { "<폼 아이디>": { "필드": "값", ... } }
 *   폼 아이디는 사용자에게 아무 뜻이 없으므로 한 겹 벗기고 필드만 보여 준다.
 */

/** 값이 실제로 보여 줄 만한가. 빈 값을 늘어놓으면 오히려 읽기 어렵다. */
function meaningful(value) {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim() !== '';
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    return true;
}

/** 사람이 읽는 글로 바꾼다. 객체를 그대로 찍으면 [object Object] 가 된다. */
export function displayValue(value) {
    if (Array.isArray(value)) return value.map(displayValue).filter(Boolean).join(', ');
    if (value && typeof value === 'object') {
        try {
            return JSON.stringify(value);
        } catch (_e) {
            return '';
        }
    }
    if (typeof value === 'boolean') return value ? '예' : '아니오';
    return (value ?? '').toString().trim();
}

/**
 * 필드 이름을 읽을 만하게.
 *
 * `customer_email` 같은 기계 이름이 그대로 보이면 무엇을 뜻하는지 알기 어렵다.
 * 폼 정의를 따로 불러오면 진짜 라벨을 쓸 수 있지만, 그것 하나 때문에 화면이
 * 늦어진다. 밑줄만 풀어 주는 것으로도 대부분 읽힌다.
 */
export function fieldLabel(key) {
    return (key || '').toString().replace(/[_.]+/g, ' ').trim() || '항목';
}

/**
 * 산출물에서 보여 줄 항목들을 편다.
 *
 * 폼이 여러 개 담겨 있을 수도 있어 모두 훑는다.
 */
export function flattenOutput(output) {
    if (!output || typeof output !== 'object') return [];

    const rows = [];
    const seen = new Set();

    const collect = (obj) => {
        for (const [key, value] of Object.entries(obj || {})) {
            if (!meaningful(value)) continue;

            // 한 겹 더 싸인 폼이면 안으로 들어간다.
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                collect(value);
                continue;
            }

            const text = displayValue(value);
            if (!text || seen.has(key)) continue;
            seen.add(key);
            rows.push({ key, label: fieldLabel(key), value: text });
        }
    };

    collect(output);
    return rows;
}

/**
 * 이 단계 앞에 끝난 단계들의 산출물.
 *
 * 순서를 지킨다 — 사람은 진행 순서대로 읽는다.
 * 산출물이 없는 단계는 넣지 않는다. "없음" 만 늘어놓으면 훑기 어렵다.
 */
export function previousOutputs(items, currentId) {
    const list = Array.isArray(items) ? items : [];
    const stop = list.findIndex((i) => i && (i.taskId || i.id) === currentId);
    const before = stop >= 0 ? list.slice(0, stop) : list;

    return before
        .map((item) => ({
            id: item?.taskId || item?.id,
            name: (item?.name || item?.activity_name || '').trim() || '이전 단계',
            who: (item?.username || '').trim(),
            endedAt: item?.endDate || item?.end_date || null,
            fields: flattenOutput(item?.output ?? item?.raw?.output)
        }))
        .filter((step) => step.fields.length > 0);
}
