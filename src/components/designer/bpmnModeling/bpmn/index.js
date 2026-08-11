// BPMN 모델러 컴포넌트는 부팅 시점에 전역 등록하면 128개 SFC(약 31,000 LOC)와
// 그 의존성(bpmn-js, monaco 등)이 통째로 엔트리 청크에 들어간다. 로그인 화면에서도
// 전부 내려받게 되므로, 실제로 모델러가 필요해지는 시점까지 등록을 미룬다.
//
// 등록이 필요한 곳에서는 `ensureBpmnComponents()` 를 await 한 뒤 렌더링할 것.
// 속성 패널은 `<component :is="'gpt-user-task-panel'">` 처럼 **문자열로** 해석되기 때문에
// 개별 import 로는 대체할 수 없고, 이 전역 등록이 반드시 선행돼야 한다.
const modules = import.meta.glob('@/components/designer/bpmnModeling/bpmn/**/*.vue');

let appRef = null;
let loadingPromise = null;

/**
 * main.ts 에서 앱 인스턴스만 넘겨받는다. 실제 등록은 하지 않는다.
 */
export default function loadBpmnComponents(app) {
    appRef = app;
}

/**
 * BPMN 모델러 컴포넌트를 1회만 전역 등록한다. 중복 호출은 같은 Promise 를 돌려준다.
 */
export function ensureBpmnComponents() {
    if (loadingPromise) return loadingPromise;
    if (!appRef) return Promise.resolve();

    const app = appRef;
    loadingPromise = (async () => {
        const bpmnComponents = {};

        await Promise.all(
            Object.keys(modules).map(async (path) => {
                // copy 파일 제외
                if (path.includes(' copy') || path.includes('copy.vue')) {
                    return;
                }

                const module = await modules[path]();
                const componentDef = module.default;
                const registrationName = componentDef?.name;

                // name이 없으면 건너뛰기
                if (!registrationName) {
                    return;
                }

                const componentName = path.split('/').at(-1).split('.')[0];
                bpmnComponents[componentName] = module;

                // Vue 앱에 이미 등록된 컴포넌트인지 확인
                if (app._context?.components?.[registrationName]) {
                    return;
                }

                app.component(registrationName, componentDef);
            })
        );

        window.bpmnComponents = bpmnComponents;
    })();

    return loadingPromise;
}
