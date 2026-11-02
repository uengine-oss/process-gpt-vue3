/**
 * 폼 미리보기가 그릴 HTML을 고른다.
 *
 * 속성 패널은 편집 탭과 미리보기 탭에 FormDefinition을 하나씩 따로 띄우고, 편집 중인
 * 폼을 v-model(draftHtml)로 넘긴다. 미리보기에는 편집기가 없어서, 예전에는 DB에서 읽은
 * 저장본(savedHtml)을 먼저 골랐다. 그래서 AI로 고치거나 손으로 고친 폼이 미리보기에
 * 보이지 않고 저장 전 모습이 그대로 남았다.
 *
 * 우선순위: 편집기의 현재 내용 → 넘겨받은 편집본 → 저장본.
 */
export function pickPreviewSource({ editorHtml, draftHtml, savedHtml }) {
    return editorHtml || draftHtml || savedHtml || '';
}
