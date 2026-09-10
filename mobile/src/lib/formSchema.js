/**
 * 폼 정의를 휴대폰에서 그릴 수 있는 모양으로 바꾼다.
 *
 * 포털의 폼은 넓은 화면을 전제로 만들어졌다. 한 줄에 12칸을 나눠 쓰고, 그 안에
 * 보고서·슬라이드·BPMN 편집기까지 들어간다. 휴대폰에서는 대부분 그릴 수 없다.
 *
 * 못 그리는 것을 만났을 때의 방침
 *   숨기지 않는다. 숨기면 사용자는 폼을 다 채웠다고 믿고 제출하는데, 실제로는
 *   빈 항목이 남아 프로세스가 뒤에서 멈춘다. 대신 "여기서는 입력할 수 없다" 고
 *   말하고 제출을 막는다. 웹에서 열도록 안내하는 편이 정직하다.
 */

/**
 * 휴대폰에서 입력받을 수 있는 것들.
 *
 * 폼은 **전부** 휴대폰에서 채울 수 있어야 한다. 하나라도 웹으로 미루면 그 업무는
 * 결국 앱에서 끝낼 수 없고, 사용자는 노트북을 켜러 가야 한다.
 *   file        사진·파일 고르기로 받는다(채팅 첨부와 같은 방식)
 *   user-select 조직 구성원 목록에서 고른다
 *   반복 입력   묶음을 여러 번 추가·삭제할 수 있게 한다
 */
export const SUPPORTED_TYPES = [
    'text',
    'textarea',
    'boolean',
    'select',
    'radio',
    'checkbox',
    'label',
    'number',
    'date',
    'datetime',
    'time',
    'email',
    'tel',
    'url',
    'password',
    'file',
    'user-select'
];

/**
 * 휴대폰에서 **입력**받지 않는 것들.
 *
 * 이것들은 값을 적는 칸이 아니라 넓은 화면에서 보고 편집하는 산출물이다
 * (보고서 본문 · 슬라이드 · 프로세스 도면). 읽기로는 보여 주되, 편집은 웹에서
 * 하도록 안내한다.
 */
export const UNSUPPORTED_TYPES = ['report', 'slide', 'bpmn-uengine'];

function isTruthyAttr(value) {
    return value === true || value === 'true';
}

/** 이 항목이 화면에 값을 보여주기만 하는가. */
export function isReadOnly(field) {
    return isTruthyAttr(field?.readonly) || isTruthyAttr(field?.disabled) || field?.type === 'label';
}

/**
 * 중첩된 정의를 한 줄로 편다.
 *
 * row-layout 은 넓은 화면에서 칸을 나누는 장치일 뿐이라 휴대폰에서는 의미가 없다.
 * 다만 `is_multidata_mode` 인 것은 다르다 — 같은 묶음을 여러 번 반복 입력하는
 * 것이라 단순히 펴면 뜻이 달라진다. 그래서 통째로 "여기서는 못 한다" 로 둔다.
 */
export function flattenFields(fields) {
    const out = [];
    for (const field of Array.isArray(fields) ? fields : []) {
        if (!field || typeof field !== 'object') continue;

        if (field.type === 'row-layout') {
            if (isTruthyAttr(field.is_multidata_mode)) {
                // 같은 묶음을 여러 번 적는 항목. 안쪽 칸들을 함께 넘겨야
                // 화면이 줄을 더하고 지울 수 있다.
                out.push({ ...field, __repeating: true, __fields: flattenFields(field.fields) });
                continue;
            }
            out.push(...flattenFields(field.fields));
            continue;
        }
        out.push(field);
    }
    return out;
}

/**
 * 화면이 그대로 쓸 수 있는 목록으로 만든다.
 *
 * 각 항목에 `supported` 를 붙여, 그릴 수 있는 것과 안내만 할 것을 화면이 한눈에
 * 구분하게 한다.
 */
export function toMobileFields(fieldsJson) {
    return flattenFields(fieldsJson).map((field) => {
        const type = (field.type || 'text').toString();
        const repeating = Boolean(field.__repeating);
        // 반복 입력도 휴대폰에서 받는다. 안쪽 칸들이 모두 그릴 수 있을 때만이다 —
        // 그릴 수 없는 칸이 섞이면 빈 채로 제출되어 뒤에서 멈춘다.
        const inner = repeating ? toMobileFields(field.__fields) : [];
        const supported = repeating
            ? inner.length > 0 && inner.every((f) => f.supported || f.readonly)
            : SUPPORTED_TYPES.includes(type);

        return {
            key: field.key || '',
            label: field.text || field.key || '',
            type,
            supported,
            repeating,
            // 반복 입력의 안쪽 칸들.
            fields: inner,
            readonly: isReadOnly(field),
            items: normalizeItems(field.items)
        };
    }).filter((field) => field.key);
}

/**
 * 선택지를 `{value, label}` 로 통일한다.
 *
 * 정의에는 `[{"key1":"label1"}, ...]` 형태로 들어 있다. 화면마다 이것을 풀면
 * 실수하기 쉬우니 한 번만 푼다.
 */
export function normalizeItems(items) {
    if (!Array.isArray(items)) return [];
    const out = [];
    for (const item of items) {
        if (item === null || item === undefined) continue;
        if (typeof item === 'string' || typeof item === 'number') {
            out.push({ value: String(item), label: String(item) });
            continue;
        }
        if (typeof item === 'object') {
            // {value, label} 형태면 그대로
            if ('value' in item) {
                out.push({ value: String(item.value), label: String(item.label ?? item.value) });
                continue;
            }
            // {키: 라벨} 형태
            for (const [value, label] of Object.entries(item)) {
                out.push({ value: String(value), label: String(label) });
            }
        }
    }
    return out;
}

/**
 * 이 폼을 휴대폰에서 끝낼 수 있는가.
 *
 * 입력이 필요한데 그릴 수 없는 항목이 하나라도 있으면 안 된다. 그 상태로 제출하면
 * 빈 값이 그대로 넘어가고, 프로세스는 다음 단계에서 멈춘다. 멈춘 이유는 어디에도
 * 남지 않는다.
 */
export function canSubmitOnMobile(fields) {
    return fields.every((f) => f.supported || f.readonly);
}

/** 왜 못 하는지 사용자에게 말해 줄 항목들. */
export function blockingFields(fields) {
    return fields.filter((f) => !f.supported && !f.readonly);
}

/**
 * 빈 답안을 만든다.
 *
 * 기존 값이 있으면 그것으로 채운다 — 임시 저장했다가 다시 열었을 때 처음부터
 * 다시 쓰게 하면 안 된다.
 */
export function initialValues(fields, existing) {
    const saved = existing && typeof existing === 'object' ? existing : {};
    const values = {};
    for (const field of fields) {
        const prior = saved[field.key];
        if (prior !== undefined && prior !== null) {
            values[field.key] = prior;
            continue;
        }
        if (field.type === 'boolean') values[field.key] = false;
        else if (field.type === 'checkbox') values[field.key] = [];
        else values[field.key] = '';
    }
    return values;
}
