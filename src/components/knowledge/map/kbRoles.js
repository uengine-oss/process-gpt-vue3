// doc_role — 백엔드 인제스트 정책(memento knowledge_files.normalize_doc_role)과 짝.
export const ROLE_OPTIONS = [
    {
        value: 'content',
        label: '일반 자료',
        icon: 'mdi-file-document-outline',
        color: 'primary',
        desc: '지도에 올라가 에이전트가 찾아 읽는 본문 자료 (기본값)'
    },
    {
        value: 'glossary',
        label: '용어 사전',
        icon: 'mdi-book-alphabet',
        color: 'deep-purple',
        desc: '한↔영 용어 매핑. 답변·번역 시 자동 참조. CSV(영문,한글뜻,약어) 업로드 지원'
    },
    {
        value: 'template',
        label: '양식',
        icon: 'mdi-file-table-outline',
        color: 'orange-darken-2',
        desc: '보고서/계약서 양식. 문서 생성 시 활용 · hwpx/docx만 가능'
    },
    { value: 'reference', label: '참조', icon: 'mdi-bookmark-outline', color: 'teal', desc: '법령·규제·표준 등 인용용 참조' },
    {
        value: 'dataset',
        label: '데이터',
        icon: 'mdi-table',
        color: 'cyan-darken-2',
        desc: '엑셀(xlsx) 정량 데이터. 분석 질문 시 코드 실행으로 처리 · xlsx만 가능'
    },
    {
        value: 'legal_review',
        label: '검토 사례',
        icon: 'mdi-gavel',
        color: 'red-darken-2',
        desc: '변호사 검토 메모가 달린 과거 계약서(NDA/MOU). 사업배경으로 검색돼 검토에 활용 · docx만 가능'
    }
];

export const ROLE_ALLOWED_EXTENSIONS = {
    content: ['pdf', 'hwp', 'hwpx', 'doc', 'docx', 'pptx', 'txt', 'md'],
    glossary: ['pdf', 'hwp', 'hwpx', 'doc', 'docx', 'pptx', 'txt', 'csv'],
    reference: ['pdf', 'hwp', 'hwpx', 'doc', 'docx', 'pptx', 'txt', 'md'],
    template: ['hwpx', 'docx'],
    dataset: ['xlsx'],
    legal_review: ['docx']
};

// 카드를 만들지 않는 분류 — 지도에는 "읽을 수 있음"만 표시한다.
export const CARDLESS_ROLES = new Set(['glossary', 'template', 'dataset']);

export function roleMeta(role) {
    return ROLE_OPTIONS.find((r) => r.value === role) || ROLE_OPTIONS[0];
}

export function allowedExtensions(role) {
    return ROLE_ALLOWED_EXTENSIONS[role] || ROLE_ALLOWED_EXTENSIONS.content;
}

// 문서 한 건의 지도 상태 — 백엔드 folders._doc_state 와 같은 어휘.
export const DOC_STATES = {
    ready: { label: '읽을 수 있음', color: 'success', icon: 'mdi-check-circle-outline' },
    pending: { label: '카드 만드는 중', color: 'grey', icon: 'mdi-progress-clock' },
    failed: { label: '카드 실패', color: 'error', icon: 'mdi-alert-circle-outline' },
    no_text: { label: '본문 없음', color: 'warning', icon: 'mdi-file-hidden' }
};

// index_status — 인제스트 파이프라인 상태(페이지 저장이 성공 기준).
export const INDEX_STATES = {
    indexed: { label: '완료', color: 'success' },
    processing: { label: '처리중', color: 'info' },
    pending: { label: '대기', color: 'grey' },
    failed: { label: '실패', color: 'error' },
    excluded: { label: '제외', color: 'grey' }
};
