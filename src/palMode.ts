// PAL 모드는 빌드 환경 또는 런타임 config로 활성화한다.
// 라우터가 모드별 화면을 구성하기 전에 이 모듈이 먼저 평가되어야 한다.
const runtimePalMode = (window as any)._env_?.VITE_PAL_MODE;
const buildPalMode = import.meta.env.VITE_PAL_MODE;
const enabled = runtimePalMode === true || runtimePalMode === 'true' || buildPalMode === 'true';

Object.defineProperty(window, '$pal', {
    value: enabled,
    writable: false,
    configurable: false
});

export {};
