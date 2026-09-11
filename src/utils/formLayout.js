/**
 * 저장된 폼 HTML(<row-layout>)과 KEditor 편집 구조(div.row) 사이를 오가는 도우미.
 *
 * KEditor는 div.row 하나를 컨테이너 하나로 다루는데, 저장된 폼은 row-layout 하나가
 * 여러 div.row를 품고 있을 수 있다(AI가 생성한 폼이 그렇다). 예전에는 첫 행만 옮기고
 * row-layout을 통째로 갈아치워서, 두 번째 행부터의 필드가 편집기에서 통째로 사라졌다.
 */

const ROW_ATTRIBUTES = ['name', 'alias', 'is_multidata_mode'];

/** 편집기에는 런타임 바인딩이 남으면 안 된다 — 저장할 때 다시 붙는다. */
function stripBindings(row) {
    row.querySelectorAll('[class^="col-sm-"] > *').forEach((field) => {
        field.removeAttribute('v-model');
        Array.from(field.attributes).forEach((attr) => {
            if (attr.name.startsWith('v-on:')) field.removeAttribute(attr.name);
        });
    });
}

/**
 * row-layout을 KEditor가 아는 div.row 목록으로 편다.
 *
 * name/alias는 첫 행만 물려받는다. 모든 행에 같은 이름을 주면 저장할 때
 * 이름 중복 검사에 걸린다.
 */
export function rowLayoutToKeditorRows(rowLayout) {
    const innerRows = Array.from(rowLayout.children).filter(
        (child) => child.tagName.toLowerCase() === 'div' && child.classList.contains('row')
    );

    return innerRows.map((innerRow, index) => {
        const newRow = innerRow.ownerDocument.createElement('div');
        newRow.setAttribute('class', 'row');
        ROW_ATTRIBUTES.forEach((attribute) => {
            const inherited = index === 0 || attribute === 'is_multidata_mode';
            newRow.setAttribute(attribute, inherited ? (rowLayout.getAttribute(attribute) ?? '') : '');
        });
        if (!newRow.getAttribute('is_multidata_mode')) newRow.setAttribute('is_multidata_mode', 'false');

        Array.from(innerRow.children).forEach((child) => newRow.appendChild(child));
        stripBindings(newRow);
        return newRow;
    });
}

/**
 * 껍데기만 벗겨 안쪽을 부모로 올린다.
 *
 * row-layout이 다시 row-layout을 품은 폼(미리보기가 만들어내는 모양)에서 쓴다.
 * 바깥 이름은 이름이 비어 있는 첫 자식에게 물려준다.
 */
export function unwrapRowLayout(rowLayout) {
    const firstChild = rowLayout.firstElementChild;
    if (firstChild && firstChild.tagName.toLowerCase() === 'row-layout') {
        ROW_ATTRIBUTES.forEach((attribute) => {
            if (!firstChild.getAttribute(attribute) && rowLayout.getAttribute(attribute)) {
                firstChild.setAttribute(attribute, rowLayout.getAttribute(attribute));
            }
        });
    }
    while (rowLayout.firstChild) {
        rowLayout.parentNode.insertBefore(rowLayout.firstChild, rowLayout);
    }
    rowLayout.parentNode.removeChild(rowLayout);
}

/** row-layout 하나를 KEditor 구조로 바꿔 제자리에 끼운다. */
export function expandRowLayoutInPlace(rowLayout) {
    const rows = rowLayoutToKeditorRows(rowLayout);
    if (!rows.length) {
        // 직속 div.row가 없다 = 중첩 row-layout. 껍데기만 벗기면 안쪽은 같은 순회가 마저 처리한다.
        unwrapRowLayout(rowLayout);
        return 0;
    }
    rows.forEach((row) => rowLayout.parentNode.insertBefore(row, rowLayout));
    rowLayout.parentNode.removeChild(rowLayout);
    return rows.length;
}
