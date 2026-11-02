/**
 * 폼 디자이너 AI의 수정 명령(modifications)을 폼 HTML에 적용한다.
 *
 * 명령: { action: 'addAsChild' | 'addAfter' | 'replace' | 'delete', targetCSSSelector, tagValue }
 *
 * 예전에는 tagValue를 파싱한 결과의 첫 노드만 넣었다. AI가 명령 하나에 섹션 두 개를 담아
 * 보내면(예: 기존 섹션을 새 섹션 + 메모 섹션으로 교체) 두 번째가 사라졌다. 이제 모두 넣는다.
 * 대상을 찾지 못한 명령은 건너뛰고 skipped 로 돌려준다.
 */
export function applyFormModifications(html, modifications, { DOMParser = globalThis.DOMParser } = {}) {
    const parse = (text) => new DOMParser().parseFromString(`<!doctype html><html><body>${text || ''}</body></html>`, 'text/html');
    const doc = parse(html);
    const skipped = [];
    let added = 0;

    // 태그 사이 공백 텍스트는 넣지 않는다
    const nodesOf = (tagValue) =>
        Array.from(parse(tagValue).body.childNodes)
            .filter((node) => node.nodeType === 1 || (node.nodeType === 3 && node.textContent.trim()))
            .map((node) => doc.importNode(node, true));

    (modifications || []).forEach((modification) => {
        let target = null;
        try {
            // 문서 전체에서 찾는다 — 빈 폼에 섹션을 넣을 때 AI는 'body'를 대상으로 준다.
            // 여러 곳이 걸리면 최상위(body 바로 아래)를 우선한다. 'section:last-child' 같은 선택자는 칸 안의
            // 중첩 섹션에도 걸리는데, AI는 폼의 마지막 섹션을 뜻한다(맨 아래에 추가 → 첫 행 안에 들어갔다).
            const matches = Array.from(doc.querySelectorAll(modification.targetCSSSelector));
            target = matches.find((el) => el.parentElement === doc.body) || matches[0] || null;
        } catch (error) {
            target = null; // 잘못된 선택자
        }
        if (!target) {
            skipped.push(modification);
            return;
        }
        if (modification.action === 'addAsChild') {
            nodesOf(modification.tagValue).forEach((node) => target.appendChild(node));
            added++;
        } else if (modification.action === 'addAfter') {
            const anchor = target.nextSibling;
            nodesOf(modification.tagValue).forEach((node) => target.parentNode.insertBefore(node, anchor));
            added++;
        } else if (modification.action === 'replace') {
            nodesOf(modification.tagValue).forEach((node) => target.parentNode.insertBefore(node, target));
            target.parentNode.removeChild(target);
        } else if (modification.action === 'delete') {
            target.parentNode.removeChild(target);
        } else {
            skipped.push(modification);
        }
    });

    return { html: doc.body.innerHTML, skipped, added };
}
