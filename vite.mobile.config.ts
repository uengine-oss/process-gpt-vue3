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
 *
 * 휴대폰 웹(--mode web, npm run build:mobile:web)은 포털 산출물 안의 dist/m/ 으로 나가
 * 같은 컨테이너가 /m/ 에서 연다. 접속 값은 빌드에 넣지 않고 run.sh 가 index.html 에 넣는다.
 */

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig(({ mode }) => ({
    // 진입 HTML 이 있는 곳. 이렇게 두면 산출물이 dist-mobile/index.html 로 나와
    // Capacitor 가 따로 손대지 않고 그대로 연다.
    root: here('./mobile'),

    // 모바일 웹(--mode web): 포털과 같은 컨테이너의 /m/ 에서 연다.
    // 앱(Capacitor) 빌드는 지금처럼 '/' 그대로.
    base: mode === 'web' ? '/m/' : '/',

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
        // 웹 빌드는 포털 산출물(dist/) 안의 m/ 으로. 포털 빌드 **뒤에** 돌려야 한다
        // (포털 빌드가 dist/ 를 비운다). emptyOutDir 은 dist/m 만 비운다.
        outDir: mode === 'web' ? here('./dist/m') : here('./dist-mobile'),
        emptyOutDir: true,
        // 개발·에뮬레이터 빌드에는 소스맵을 넣는다. 없으면 휴대폰에서 나는 오류가
        // 압축된 한 줄로만 남아 원인을 찾을 수 없다.
        //
        // 배포판(prod)에는 넣지 않는다. 소스맵은 APK 안에 원본 코드를 통째로
        // 싣는 것이고(5MB 가까이), 그 APK 는 우리 손을 떠나 남의 기기로 간다.
        sourcemap: mode !== 'prod' && mode !== 'web'
    },

    server: {
        // 포털 개발 서버(5173)와 같이 띄울 수 있게 다른 포트를 쓴다.
        port: Number(process.env.MOBILE_PORT || 5174),
        host: true,
        // 브라우저(모바일 웹)로 띄울 때 운영과 같게 "같은 주소" 로 게이트웨이를 부른다.
        // MOBILE_GATEWAY=http://192.168.64.3:8088 MOBILE_GATEWAY_HOST=localhost:8088
        proxy: process.env.MOBILE_GATEWAY
            ? Object.fromEntries(
                  [
                      '/completion', '/memento', '/agent', '/agent-router', '/voice', '/api',
                      '/process-gpt-deepagents', '/process-gpt-codex', '/process-gpt-cli-agent',
                      '/claude-skills', '/feedback-proposals', '/robo', '/litellm'
                  ].map((p) => [
                      p,
                      {
                          target: process.env.MOBILE_GATEWAY,
                          ws: true,
                          configure: (proxy: any) => {
                              // 게이트웨이는 Host 맨 앞을 조직으로 본다 — 'localhost' 로 맞춘다.
                              proxy.on('proxyReq', (req: any) =>
                                  req.setHeader('host', process.env.MOBILE_GATEWAY_HOST || 'localhost')
                              );
                          }
                      }
                  ])
              )
            : undefined
    }
}));
