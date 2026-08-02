import { ensureBpmnComponents } from '@/components/designer/bpmnModeling/bpmn';
import { ensureOpengraphComponents } from '@/opengraph';

/**
 * BPMN 모델러 화면이 의존하는 전역 컴포넌트(속성 패널 + OpenGraph 도형)를 등록한다.
 *
 * 이 컴포넌트들은 `<component :is="문자열">` 로 해석되기 때문에 개별 import 로
 * 대체할 수 없고, 렌더링 전에 전역 등록이 끝나 있어야 한다.
 * 부팅 시 등록하면 엔트리 청크가 수 MB 커지므로, 모델러를 실제로 여는 시점에
 * 이 함수를 await 한 뒤 렌더링할 것.
 *
 * 중복 호출은 안전하다 (각 로더가 Promise 를 캐시한다).
 */
export function ensureModelerComponents() {
    return Promise.all([ensureOpengraphComponents(), ensureBpmnComponents()]);
}

export default ensureModelerComponents;
