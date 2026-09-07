/**
 * 데이터 접근.
 *
 * 포털이 쓰는 것과 같은 계층(ProcessGPTBackend)을 그대로 쓴다. 조회 조건 ·
 * 소속 조직 필터 · 완료 처리 절차가 이미 그 안에 있고, 모바일용으로 다시 쓰면
 * 두 벌이 서서히 어긋난다. 어긋나면 웹에서는 보이는 일이 앱에서는 안 보인다.
 */

import BackendFactory from '@/components/api/BackendFactory';

let cached = null;

export function backend() {
    if (cached) return cached;
    // createBackend 는 이 값으로 어느 구현을 쓸지 고른다. 없으면 아무것도 못 만든다.
    if (!window.$mode) window.$mode = 'ProcessGPT';
    cached = BackendFactory.createBackend();
    return cached;
}
