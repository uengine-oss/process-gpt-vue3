/**
 * 저장 직전 폼 HTML 정규화와 fields_json 추출.
 *
 * ProcessGPTBackend.putRawDefinition(type: 'form')이 쓰던 두 메서드를 그대로 옮겼다.
 * 폼 편집기 테스트가 "저장되는 결과"를 같은 함수로 비교하려고 순수 모듈로 뺐다.
 * DOMParser는 브라우저 것을 기본으로 쓰고, node 테스트에서는 주입한다.
 */

// AI(채팅/딥에이전트 등)가 생성한 폼 HTML이 row-layout으로 감싸지 않은 채
// <div class='row' ...> 만 내보내는 경우가 있어, 저장 전에 무조건 row-layout으로 감싸서
// 렌더링(RowLayout.vue)과 fields_json 추출(row-layout 기반 is_multidata_mode 그룹핑)이
// 항상 동작하도록 보정한다. 이미 row-layout으로 감싸져 있으면 그대로 둔다.
export function normalizeFormRowLayout(html, { DOMParser = globalThis.DOMParser } = {}) {
    if (!html || typeof html !== 'string' || !/<div[^>]*class=(["'])[^"']*\brow\b[^"']*\1/i.test(html)) {
        return html;
    }
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const rows = Array.from(doc.querySelectorAll('div.row'));

        rows.forEach((row) => {
            const parent = row.parentElement;
            if (!parent || parent.tagName.toLowerCase() === 'row-layout') return;
            // 다중 데이터 행의 반복 항목(<div v-for> 안의 div.row)은 이미 row-layout 안이다.
            // 감싸면 저장할 때마다 항목마다 빈 row-layout 카드가 하나씩 더 생겼다.
            if (parent.hasAttribute('v-for')) return;

            const rowLayout = doc.createElement('row-layout');
            ['name', 'alias', 'is_multidata_mode'].forEach((attr) => {
                const value = row.getAttribute(attr);
                if (value !== null) {
                    rowLayout.setAttribute(attr, value);
                    row.removeAttribute(attr);
                }
            });
            rowLayout.setAttribute('v-model', 'formValues');
            rowLayout.setAttribute('v-slot', 'slotProps');

            parent.insertBefore(rowLayout, row);
            rowLayout.appendChild(row);
        });

        // row-layout은 slot으로 modelValue만 넘길 뿐 자식 필드에 자동으로 바인딩해주지 않는다.
        // AI가 v-model 없이 필드만 출력하면(예: `기본 에이전트` 채팅이 forms/*.html을 직접
        // 저장하는 경로 — KEditor의 keditorContentHTMLToDynamicFormHTML을 거치지 않음)
        // 화면엔 보여도 입력값이 formValues에 반영되지 않는 '먹통' 폼이 된다.
        // is_multidata_mode='true'는 슬롯이 배열(localModelValue[name])을 넘기고 v-for로
        // item을 순회해야 하는데 이 정규화 단계는 그 래퍼를 만들지 않으므로 다루지 않는다.
        doc.querySelectorAll('row-layout').forEach((rowLayout) => {
            if (rowLayout.getAttribute('is_multidata_mode') === 'true') return;
            rowLayout.querySelectorAll('[name]').forEach((field) => {
                const tag = field.tagName.toLowerCase();
                // 필드 컴포넌트는 전부 하이픈 포함 커스텀 태그(text-field 등)다.
                // div.row/col-sm-* 같은 순수 레이아웃 요소가 남겨둔 name 속성은 건드리지 않는다.
                if (!tag.includes('-') || tag === 'row-layout' || field.hasAttribute('v-model')) return;
                const name = field.getAttribute('name');
                if (!name) return;
                if (field.tagName.toLowerCase() === 'code-field') {
                    field.setAttribute('v-model', `codeInfos['${name}']`);
                } else {
                    field.setAttribute('v-model', `slotProps.modelValue['${name}']`);
                }
            });
        });

        return doc.body.innerHTML;
    } catch (error) {
        console.warn('[ProcessGPTBackend] row-layout 정규화 실패, 원본 HTML 유지:', error);
        return html;
    }
}

export function extractFields(html, { DOMParser = globalThis.DOMParser } = {}) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const fieldTags = [
        'text-field',
        'select-field',
        'checkbox-field',
        'radio-field',
        'file-field',
        'folder-field',
        'label-field',
        'boolean-field',
        'textarea-field',
        'user-select-field',
        'report-field',
        'slide-field',
        'bpmn-uengine-field'
    ];

    function parseItemsAttr(raw) {
        if (!raw) return undefined;
        try {
            return JSON.parse(raw.replace(/'/g, '"'));
        } catch (error) {
            return undefined;
        }
    }

    function extractFieldAttributes(element) {
        const alias = element.getAttribute('alias');
        const nameAttr = element.getAttribute('name') || '';
        const vModel = element.getAttribute('v-model') || '';
        // v-model 바인딩에서 bracket 표기법으로 키를 추출, 없으면 name 속성을 기본으로 사용
        const bracketMatch = vModel.match(/\[['"](.+?)['"]\]/);
        const key = bracketMatch && bracketMatch[1] ? bracketMatch[1] : nameAttr;
        const tagName = element.tagName.toLowerCase();
        const disabled = element.getAttribute('disabled');
        const readonly = element.getAttribute('readonly');
        const type = element.getAttribute('type') || tagName.replace('-field', '');

        const field = {
            key: key,
            text: alias || '',
            type: type,
            disabled: disabled ? disabled : false,
            readonly: readonly ? readonly : false
        };

        const items = parseItemsAttr(element.getAttribute('items'));
        if (items) field.items = items;

        return field;
    }

    // row-layout은 여러 필드를 묶는 컨테이너로, is_multidata_mode='true'일 때만
    // 내부 필드들이 배열(v-for) 형태로 반복되므로 group.fields 로 중첩시킴.
    // false(단건 입력)인 경우는 기존 로직대로 하위 필드를 최상위로 그대로 펼쳐서 반환
    function extractRowLayout(element) {
        const isMultidataMode = element.getAttribute('is_multidata_mode') === 'true';
        const innerFields = collectFields(element);

        if (!isMultidataMode) {
            return innerFields;
        }

        const alias = element.getAttribute('alias');
        const nameAttr = element.getAttribute('name') || '';

        return [
            {
                key: nameAttr,
                text: alias || '',
                type: 'row-layout',
                is_multidata_mode: true,
                fields: innerFields
            }
        ];
    }

    // DOM 트리를 내려가면서 field 태그나 row-layout을 만나면 수집하고,
    // row-layout 내부는 재귀 호출로 별도 처리하여 중복 수집을 막음
    function collectFields(root) {
        const fields = [];

        Array.from(root.children).forEach((child) => {
            const tagName = child.tagName.toLowerCase();

            if (tagName === 'row-layout') {
                fields.push(...extractRowLayout(child));
            } else if (fieldTags.includes(tagName)) {
                fields.push(extractFieldAttributes(child));
            } else {
                fields.push(...collectFields(child));
            }
        });

        return fields;
    }

    return collectFields(doc.body);
}
