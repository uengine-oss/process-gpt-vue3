/**
 * 폼 편집기 팔레트.
 *
 * 기본 속성은 KEditor 스니펫(public/snippets/default/snippets.html)과 같다 — 새로 넣은 필드가
 * 예전 편집기로 넣은 것과 같은 모양으로 저장되게 한다. 이름(name)은 편집기가 겹치지 않게 붙인다.
 * code-field의 스크립트는 속성이 아니라 태그 안 텍스트로 저장되므로 encoded_code는 넣지 않는다.
 */
export const FIELD_PALETTE = [
    { tag: 'text-field', label: '텍스트', icon: 'mdi-form-textbox', defaults: { alias: '', type: 'text', disabled: 'false' } },
    { tag: 'textarea-field', label: '여러 줄', icon: 'mdi-text-box-outline', defaults: { alias: '', rows: '5', disabled: 'false' } },
    { tag: 'boolean-field', label: '예/아니오', icon: 'mdi-toggle-switch-outline', defaults: { alias: '', disabled: 'false' } },
    { tag: 'select-field', label: '선택', icon: 'mdi-form-dropdown', defaults: { alias: '', items: '[]', disabled: 'false' } },
    {
        tag: 'checkbox-field',
        label: '체크박스',
        icon: 'mdi-checkbox-multiple-marked-outline',
        defaults: { alias: '', items: '[]', disabled: 'false' }
    },
    { tag: 'radio-field', label: '라디오', icon: 'mdi-radiobox-marked', defaults: { alias: '', items: '[]', disabled: 'false' } },
    { tag: 'user-select-field', label: '사용자', icon: 'mdi-account-search-outline', defaults: { alias: '', disabled: 'false' } },
    { tag: 'file-field', label: '파일', icon: 'mdi-paperclip', defaults: { alias: '', disabled: 'false' } },
    { tag: 'folder-field', label: '폴더', icon: 'mdi-folder-upload-outline', defaults: { alias: '', disabled: 'false' } },
    { tag: 'label-field', label: '안내 문구', icon: 'mdi-format-text', defaults: { label: '안내 문구' } },
    { tag: 'report-field', label: '문서', icon: 'mdi-file-document-edit-outline', defaults: { disabled: 'false' } },
    { tag: 'slide-field', label: '슬라이드', icon: 'mdi-presentation', defaults: { disabled: 'false' } },
    { tag: 'bpmn-uengine-field', label: 'BPMN', icon: 'mdi-sitemap-outline', defaults: { disabled: 'false' } },
    { tag: 'code-field', label: '스크립트', icon: 'mdi-code-braces', defaults: { event_type: 'click' } }
];

/** 행 템플릿 — 칸 비율(합 12). KEditor 팔레트에서 빠져 있던 8:4, 3:6:3도 넣었다. */
export const ROW_TEMPLATES = [
    { spans: [12], label: '1칸' },
    { spans: [6, 6], label: '2칸 · 반반' },
    { spans: [4, 8], label: '2칸 · 4:8' },
    { spans: [8, 4], label: '2칸 · 8:4' },
    { spans: [4, 4, 4], label: '3칸' },
    { spans: [3, 6, 3], label: '3칸 · 3:6:3' },
    { spans: [3, 3, 3, 3], label: '4칸' }
];

export const paletteOf = (tag) => FIELD_PALETTE.find((item) => item.tag === tag);
