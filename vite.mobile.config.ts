import { fileURLToPath, URL } from 'url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

/**
 * 모바일 앱 빌드.
 *
 * 포털과 같은 저장소에 있지만 다른 것을 만든다. 포털 진입점은 Monaco · jQuery ·
 * BPMN · 차트까지 끌어오는데, 그 대부분은 작은 화면에서 쓸 수 없는 화면들의 것이다.
 * 같은 진입점을 쓰면 휴대폰이 쓰지도 않을 수 메가바이트를 셀룰러로 받는다.
 *
 * 대신 아래는 그대로 쓴다 — 다시 만들면 시간이 지나며 갈라진다.
 *   @/components/api   데이터 접근
 *   @/utils/authClaims 로그인 세션에서 권한 · 소속 조직 읽기
 *   @/shared/hitl      승인이냐 선택이냐를 정하는 규칙
 *
 * 산출물은 dist-mobile/ 로 나가고, Capacitor 가 그것을 감싼다.
 * 포털 빌드(dist/)는 건드리지 않는다.
 */

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
    // 진입 HTML 이 있는 곳. 이렇게 두면 산출물이 dist-mobile/index.html 로 나와
    // Capacitor 가 따로 손대지 않고 그대로 연다.
    root: here('./mobile'),

    // .env 는 저장소 뿌리에 있다. root 를 옮겼으므로 명시해야 읽힌다.
    envDir: here('.'),

    // 포털의 public/ 에는 jQuery · BPMN · PDF 같은 것이 들어 있다. 모바일은
    // 하나도 쓰지 않으므로 그쪽을 통째로 복사하지 않고, 앱에 실제로 필요한
    // 것만 담은 폴더를 따로 둔다(지금은 로고 하나).
    publicDir: here('./mobile/public'),

    plugins: [vue()],

    resolve: {
        alias: {
            '@': here('./src'),
            '@mobile': here('./mobile/src')
        }
    },

    build: {
        outDir: here('./dist-mobile'),
        emptyOutDir: true,
        // 휴대폰에서 원인을 볼 수 있어야 한다. 소스맵이 없으면 압축된 한 줄만 남는다.
        sourcemap: true
    },

    server: {
        // 포털 개발 서버(5173)와 같이 띄울 수 있게 다른 포트를 쓴다.
        port: 5174,
        host: true
    }
});
