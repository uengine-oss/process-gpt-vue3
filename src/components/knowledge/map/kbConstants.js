// 지식베이스 지도의 공통 어휘 — 백엔드(memento)와 같은 말을 쓴다.

// 업로드 허용 확장자 — memento knowledge_files.ALLOWED_EXTENSIONS 와 같은 집합.
// 관문은 하나뿐이다: 파서가 페이지를 만들 수 있는가. 분류는 없다.
export const ALLOWED_EXTENSIONS = ['pdf', 'hwp', 'hwpx', 'doc', 'docx', 'pptx', 'txt', 'csv', 'xlsx'];

export const ACCEPT_ATTR = ALLOWED_EXTENSIONS.map((e) => '.' + e).join(',');
export const ACCEPT_LABEL = ALLOWED_EXTENSIONS.map((e) => e.toUpperCase()).join(', ');

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
