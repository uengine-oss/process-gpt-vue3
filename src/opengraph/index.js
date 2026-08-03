// OpenGraph(레거시 SVG 다이어그램 엔진) 컴포넌트도 BPMN 모델러와 같은 이유로
// 부팅 시 전역 등록하지 않는다. 소비처가 전부 BPMN 모델러 트리 안이므로
// `ensureModelerComponents()` 가 BPMN 컴포넌트와 함께 등록해 준다.
import { ensureOpenGraphLib } from '@/utils/legacyAssets';

const modules = import.meta.glob('@/opengraph/**/*.vue');

let appRef = null;
let loadingPromise = null;

export default function loadOpengraphComponents(app) {
    appRef = app;
}

export function ensureOpengraphComponents() {
    if (loadingPromise) return loadingPromise;
    if (!appRef) return Promise.resolve();

    const app = appRef;
    loadingPromise = (async () => {
        // 이 컴포넌트들은 전역 `OG` 네임스페이스(레거시 벤더 스크립트) 위에서 동작한다.
        await ensureOpenGraphLib();

        await Promise.all(
            Object.keys(modules).map(async (path) => {
                const module = await modules[path]();
                const registrationName = module.default?.name;
                if (!registrationName) return;
                app.component(registrationName, module.default);
            })
        );
    })();

    return loadingPromise;
}
