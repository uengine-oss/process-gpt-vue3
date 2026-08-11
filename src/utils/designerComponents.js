/**
 * 디자이너(레거시 opengraph/bpmnModeling) 전역 컴포넌트의 지연 등록.
 *
 * 기존에는 main.ts 부팅 경로에서 loadOpengraphComponents/loadbpmnComponents 를 동기 호출했고,
 * 두 모듈 모두 `import.meta.glob(..., { eager: true })` 라서 bpmnModeling/bpmn 128개(약 1.6MB) +
 * opengraph 28개(약 189KB)가 엔트리 청크에 그대로 포함됐다. 로그인·채팅 화면처럼 디자이너와
 * 무관한 페이지에서도 전부 다운로드·파싱·등록되어 초기 로딩을 크게 늦춘다.
 *
 * 이 모듈은 동적 import 로 감싸 해당 소스를 별도 청크로 분리하고, 실제로 필요한 시점에만 등록한다.
 *
 * 주의 — eager 로딩 자체는 유지해야 한다. 소비처(BpmnModelCanvas.getComponentByClassName 등)가
 * `component.default.computed.className()` 처럼 "해석된 모듈 객체"를 직접 순회하므로
 * defineAsyncComponent 로는 대체할 수 없다. 따라서 청크 분리까지만 수행한다.
 *
 * 참고 — BpmnUengineViewer 계열(인스턴스/워크아이템 화면의 다이어그램)은 bpmn-js 기반이라
 * 이 전역 레지스트리에 의존하지 않는다. 즉 채팅/할일 등 주요 화면은 이 청크가 필요 없다.
 */

let registrationPromise = null;

/**
 * 디자이너 전역 컴포넌트를 1회만 등록한다. 이후 호출은 동일한 Promise 를 반환한다.
 * @param {import('vue').App} app
 * @returns {Promise<void>}
 */
export function ensureDesignerComponents(app) {
    if (registrationPromise) return registrationPromise;

    registrationPromise = Promise.all([import('@/opengraph'), import('@/components/designer/bpmnModeling/bpmn')])
        .then(([opengraphModule, bpmnModule]) => {
            opengraphModule.default(app);
            bpmnModule.default(app);
        })
        .catch((e) => {
            // 실패 시 다음 시도에서 재등록할 수 있도록 캐시를 비운다.
            registrationPromise = null;
            throw e;
        });

    return registrationPromise;
}

/**
 * 해당 경로가 디자이너 전역 컴포넌트를 필요로 하는지 여부.
 * (window.bpmnComponents / opengraph 전역 등록에 의존하는 화면들)
 */
export function pathNeedsDesignerComponents(path) {
    if (!path) return false;
    const p = String(path);
    return [
        '/definitions-tree',
        '/definitions',
        '/forms',
        '/ui-definitions',
        '/dmn',
        '/definition-map',
        '/business-rule',
        '/bpmn-auto-layout-e2e',
        '/processgpt-mapper-ui-e2e'
    ].some((prefix) => p === prefix || p.startsWith(prefix + '/'));
}
