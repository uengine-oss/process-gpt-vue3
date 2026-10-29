// 지식베이스 지도의 공통 어휘 — 백엔드(memento)와 같은 말을 쓴다.

import { t } from '@/composables/i18nText';

// 업로드 허용 확장자 — memento knowledge_files.ALLOWED_EXTENSIONS 와 같은 집합.
// 관문은 하나뿐이다: 파서가 페이지를 만들 수 있는가. 분류는 없다.
export const ALLOWED_EXTENSIONS = ['pdf', 'hwp', 'hwpx', 'doc', 'docx', 'pptx', 'txt', 'csv', 'xlsx'];

export const ACCEPT_ATTR = ALLOWED_EXTENSIONS.map((e) => '.' + e).join(',');
export const ACCEPT_LABEL = ALLOWED_EXTENSIONS.map((e) => e.toUpperCase()).join(', ');

// 문서 한 건의 지도 상태 — 백엔드 folders._doc_state 와 같은 어휘.
// label 은 getter 라 그릴 때마다 현재 언어로 읽힌다(import 시점에 굳지 않는다).
export const DOC_STATES = {
    ready: { get label() { return t('kbConstants.docStates.ready'); }, color: 'success', icon: 'mdi-check-circle-outline' },
    pending: { get label() { return t('kbConstants.docStates.pending'); }, color: 'grey', icon: 'mdi-progress-clock' },
    failed: { get label() { return t('kbConstants.docStates.failed'); }, color: 'error', icon: 'mdi-alert-circle-outline' },
    no_text: { get label() { return t('kbConstants.docStates.no_text'); }, color: 'warning', icon: 'mdi-file-hidden' }
};

// index_status — 인제스트 파이프라인 상태(페이지 저장이 성공 기준).
export const INDEX_STATES = {
    indexed: { get label() { return t('kbConstants.indexStates.indexed'); }, color: 'success' },
    processing: { get label() { return t('kbConstants.indexStates.processing'); }, color: 'info' },
    pending: { get label() { return t('kbConstants.indexStates.pending'); }, color: 'grey' },
    failed: { get label() { return t('kbConstants.indexStates.failed'); }, color: 'error' },
    excluded: { get label() { return t('kbConstants.indexStates.excluded'); }, color: 'grey' }
};
