// 개발 환경에서 콘솔 워닝 메시지 비활성화 (크롬 개발자 도구 렉 방지)
window.console.warn = () => {};
// 필요시 다른 콘솔도 비활성화
// window.console.log = () => {};
// window.console.error = () => {};

// PAL 플래그는 라우터 모듈보다 먼저 초기화되어야 한다.
import './palMode';

import '@/scss/style.scss';
import { install as VueMonacoEditorPlugin } from '@guolao/vue-monaco-editor';

// ---------------------------------------------------------------------------
// Monaco 워커 설정 (Vite 기본 방식)
//
// 예전에는 vite-plugin-monaco-editor 가 워커를 만들어 줬는데, 그 플러그인(1.1.0)은
// esbuild.buildSync 를 keepNames 없이 호출한다. 그러면 monaco 0.52 의
//   class Node { static { this.Undefined = new Node(undefined); } }
// 가
//   var Node = class { static { this.Undefined = new Node(void 0); } }
// 로 변환되면서 클래스 이름 바인딩이 사라져, 정적 초기화 시점에 Node 가 아직 undefined 라
// "TypeError: Node is not a constructor" 로 워커가 즉시 죽는다.
// (게다가 플러그인은 캐시 파일이 있으면 다시 빌드하지 않아 깨진 번들이 계속 남는다)
//
// Vite 의 `?worker` 임포트는 Rollup 이 처리하므로 이 문제가 없다.
// 워커 파일은 별도 청크로 나가고, 실제로 new 로 만들 때만 로드된다.
// ---------------------------------------------------------------------------
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import HtmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import TsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

(self as any).MonacoEnvironment = {
    getWorker(_moduleId: string, label: string) {
        if (label === 'json') return new JsonWorker();
        if (label === 'html' || label === 'handlebars' || label === 'razor') return new HtmlWorker();
        if (label === 'typescript' || label === 'javascript') return new TsWorker();
        return new EditorWorker();
    }
};
import { createClient } from '@supabase/supabase-js';
import { createPinia } from 'pinia';
import { createApp } from 'vue';
import { initAuthClaimsListener } from '@/utils/authClaims';
import VueTablerIcons from 'vue-tabler-icons';
import VueApexCharts from 'vue3-apexcharts';
import 'vue3-carousel/dist/carousel.css';
import { PerfectScrollbar } from 'vue3-perfect-scrollbar';
import 'perfect-scrollbar/css/perfect-scrollbar.css';
import App from './App.vue';
import designSystem, { initMode as initDesignSystemMode } from '@/ds';
import vuetify from './plugins/vuetify';
import hammerDirective from '@/components/directive/hammerDirective';
import i18nDirective from './plugins/i18nDirective';
import { router } from './router';
import { startUsageTracking } from '@/services/usageAnalytics';
import store from './store';
import axios from 'axios';
import Maska from 'maska';
import VCalendar from 'v-calendar';
import VueRecaptcha from 'vue3-recaptcha-v2';
// spikeadmin 템플릿 데모용 axios mock(`./_mockApis`)은 더 이상 등록하지 않는다.
// 라우트가 모두 주석 처리된 데모 화면 전용이었고, 엔트리 청크에 mock 데이터를
// 통째로 끌어들이고 있었다. 살아있는 정적 데이터 모듈은 각자 직접 import 한다.
// print
// import print from 'vue3-print-nb';
// Table
// import Vue3EasyDataTable from 'vue3-easy-data-table';
// import 'vue3-easy-data-table/dist/style.css';
//i18
import messages from '@/utils/locales/messages';
import { createI18n } from 'vue-i18n';
import setLocale from './plugins/setLocale';

// icon
import { Icon } from '@iconify/vue';
import Icons from '@/components/ui-components/Icons.vue';
import InfoAlert from '@/components/ui/InfoAlert.vue';

// css
import '@/assets/css/globalStyle.css';
import '@/assets/css/dmnStyle.scss';
import '@/assets/css/mashUpStyle.css';
import '@/assets/css/customMarkdown.scss';

// Pal 모드 공통 디자인 시스템 (page-header / sk-page-card / sk-data-table / sk-mapping-list 등
// 글로벌 클래스 정의) — 비 Pal 화면의 스타일에 영향을 주지 않도록 Pal 모드에서만 로드한다.
if ((window as any).$pal) {
    import('@/assets/css/SKGlobalStyle.scss');
}

// 전역 관리 ts
import globalState from '@/stores/globalState';

// diff viewer
import xml from 'highlight.js/lib/languages/xml';
import VueDiff from 'vue-diff';
import 'vue-diff/dist/index.css';
VueDiff.hljs.registerLanguage('xml', xml);

import VueScrollTo from 'vue-scrollto';

import ModelerImageGenerator from '@/components/designer/ModelerImageGenerator.vue';
import type { KeycloakOnLoad } from 'keycloak-js';
import Keycloak from 'keycloak-js';
import { ensureDesignerComponents, pathNeedsDesignerComponents } from './utils/designerComponents';
import DetailComponent from './components/ui-components/details/DetailComponent.vue';

import BackendFactory from '@/components/api/BackendFactory';

// vue-
import dayjs from 'dayjs';
import 'dayjs/locale/ko';
import ganttastic from '@infectoone/vue-ganttastic';
import { ref } from 'vue';

// 브라우저 언어로 즉시 판정 (네트워크 없음)
function detectLanguageFromBrowser(): 'ko' | 'en' {
    const browserLang = navigator.language || (navigator.languages && navigator.languages[0]) || '';
    return browserLang.toLowerCase().startsWith('ko') ? 'ko' : 'en';
}

// IP 기반 언어 보정(비동기, 백그라운드 전용).
// 과거에는 이 조회를 createApp() 이전에 await 했는데, IP 서비스 3곳을 각 5초 타임아웃으로 "순차" 시도하는 구조라
// 광고차단기/프록시 환경에서 최대 15초간 화면이 백지로 남았다. (특히 http://ip-api.com 은 HTTPS 배포에서
// mixed content 로 무조건 차단되어 타임아웃이 확정적으로 발생했다.)
// 따라서 (1) 부팅을 막지 않고, (2) 순차가 아닌 병렬로, (3) 짧은 타임아웃으로 시도한다.
async function detectLanguageByIp(timeoutMs = 2000): Promise<'ko' | 'en' | null> {
    // http:// 서비스는 HTTPS 페이지에서 mixed content 로 차단되므로 아예 시도하지 않는다.
    const isHttps = typeof location !== 'undefined' && location.protocol === 'https:';
    const ipServices = [
        { url: 'https://ipinfo.io/json', parser: (d: any) => d.country },
        { url: 'https://ipapi.co/json/', parser: (d: any) => d.country_code },
        { url: 'http://ip-api.com/json/', parser: (d: any) => d.countryCode }
    ].filter((s) => !isHttps || s.url.startsWith('https:'));

    const probe = async (service: (typeof ipServices)[number]): Promise<'ko' | 'en'> => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(service.url, {
                signal: controller.signal,
                headers: { Accept: 'application/json' }
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error('Invalid content type');
            }
            const country = service.parser(await response.json());
            if (!country) throw new Error('No country');
            return country === 'KR' ? 'ko' : 'en';
        } finally {
            clearTimeout(timeoutId);
        }
    };

    try {
        // 가장 먼저 성공한 응답을 사용한다(모두 실패하면 AggregateError).
        return await Promise.any(ipServices.map(probe));
    } catch {
        return null;
    }
}

/**
 * 지오IP 기반 언어 판정을 백그라운드로 수행한다.
 * 예전에는 이 조회를 mount 전에 await 해서, IP 조회가 차단된 환경에서
 * 서비스 3곳 × 5초 타임아웃 = 최대 15초 동안 백지 화면이 노출됐다.
 * 이제는 브라우저 언어로 즉시 렌더한 뒤, 결과가 다를 때만 살짝 갱신한다.
 */
function refineLocaleInBackground() {
    detectLanguageByIp()
        .then((detectedLocale) => {
            // 조회에 모두 실패하면 브라우저 언어 판정을 그대로 둔다.
            if (!detectedLocale) return;
            // 조회 도중 사용자가 직접 언어를 골랐다면 그 선택을 존중한다.
            if (localStorage.getItem('locale')) return;

            localStorage.setItem('locale', detectedLocale);
            if ((i18n.global as any).locale !== detectedLocale) {
                (i18n.global as any).locale = detectedLocale;
            }
        })
        .catch(() => {
            /* 언어 자동 감지는 실패해도 앱 동작에 영향이 없다 */
        });
}

// i18n 설정을 기본값으로 초기화
const i18n = createI18n({
    locale: localStorage.getItem('locale') || 'ko', // localStorage에 저장된 언어 또는 기본값 ko
    fallbackLocale: 'en',
    messages
});

// 국가별언어를 전역으로 .js 파일에서도 사용 가능하게 추가
(window as any).$i18n = i18n;

// EventBus
import mitt from 'mitt';
import { EventBus as emitter } from '@/utils/eventBus';
const OpenGraphEmitter = mitt();
const ModelingEmitter = mitt();

declare global {
    interface Window {
        $mode: any;
        $pal: any;
        $supabase: any;
        $jms: any;
        $isTenantServer: boolean;
        $tenantName: string;
        _env_: any;
        $themeColor: any; // 테마 색상을 위한 전역 변수 추가
        $globalIsMobile: boolean; // 모바일 체크를 위한 전역 변수 추가
        $paletteSettings: any;
        $paletteTaskTypes: any[];
        $enabledPaletteTaskTypes: any[];
    }
}

// 반응형 모바일 상태 생성
const globalIsMobile = ref(window.innerWidth <= 768);

// 모바일 체크 전역 변수 설정
Object.defineProperty(window, '$globalIsMobile', {
    value: window.innerWidth <= 768,
    writable: true,
    configurable: false
});

// 윈도우 리사이즈 이벤트 리스너 추가
window.addEventListener('resize', () => {
    const isMobile = window.innerWidth <= 768;
    window.$globalIsMobile = isMobile;
    globalIsMobile.value = isMobile;
});

Object.defineProperty(window, '$mode', {
    // value: 'uEngine',
    value: window._env_?.VITE_MODE || import.meta.env.VITE_MODE || window.$mode || 'ProcessGPT',
    writable: false,
    configurable: false
});

Object.defineProperty(window, '$jms', {
    value: false,
    writable: false,
    configurable: false
});

async function setupSupabase() {
    // window.$mode = 'uEngine';
    // window.$mode = 'ProcessGPT';
    // window.$jms = false;

    // $supabase가 이미 정의되어 있는지 확인
    if (window.$supabase) {
        console.log('[Main] $supabase가 이미 정의되어 있습니다.');
        return;
    }

    const supabaseUrl = window._env_?.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = window._env_?.VITE_SUPABASE_KEY || import.meta.env.VITE_SUPABASE_KEY;

    try {
        const client = createClient(supabaseUrl, supabaseKey, {
            auth: {
                autoRefreshToken: true,
                persistSession: true
            }
        });
        Object.defineProperty(window, '$supabase', {
            value: client,
            writable: false,
            configurable: false
        });
        // localStorage에 저장된 세션이 복원될 때까지 대기.
        // 이걸 기다리지 않으면 mounted() 시점의 첫 쿼리(예: tenants 조회)가
        // 로그인 세션이 있어도 anon 롤로 나가서 authenticated 전용 RLS 정책에 막힌다.
        await client.auth.getSession();
        console.log('[Main] $supabase 클라이언트가 성공적으로 설정되었습니다.');
    } catch (error) {
        console.error('[Main] $supabase 설정 중 오류 발생:', error);
    }
}

async function setupTenant() {
    Object.defineProperty(window, '$isTenantServer', {
        value: false,
        writable: false,
        configurable: true
    });
    Object.defineProperty(window, '$tenantName', {
        value: 'tym',
        writable: false,
        configurable: false
    });
}

async function initializeApp() {
    await setupSupabase();
    await setupTenant();
    initAuthClaimsListener();

    // 동적 언어 설정 (localStorage에 저장된 언어 우선, 없으면 브라우저 언어로 즉시 판정)
    // 지오IP 조회는 렌더를 막지 않도록 mount 이후 백그라운드로 돌린다. (refineLocaleInBackground)
    const savedLocale = localStorage.getItem('locale');
    (i18n.global as any).locale = savedLocale || detectLanguageFromBrowser();

    const app = createApp(App);

    // Vue 애플리케이션 전역 에러 핸들러 추가
    app.config.errorHandler = (err, vm, info) => {
        console.error('[Vue Error Handler] 에러 발생:', err);
        console.error('[Vue Error Handler] 컴포넌트:', vm);
        console.error('[Vue Error Handler] 정보:', info);

        // 에러가 발생해도 애플리케이션이 계속 작동하도록 처리
        // 심각한 에러가 아닌 경우 무시하고 계속 진행
        const errorMessage = (err instanceof Error ? err.message : String(err)) || '';

        if (
            errorMessage.includes('putObject') ||
            errorMessage.includes('setCalendarData') ||
            errorMessage.includes('Cannot read properties of null') ||
            errorMessage.includes('400 (Bad Request)')
        ) {
            console.warn('[Vue Error Handler] 비즈니스 로직 에러 - 계속 진행');
            return;
        }

        // 기타 에러는 콘솔에만 로그하고 애플리케이션 중단 방지
        console.error('[Vue Error Handler] 예상치 못한 에러 발생 - 애플리케이션 계속 진행');
    };

    // vite-plugin-monaco-editor가 자동으로 경로를 설정하므로 별도 경로 설정 불필요
    //
    // [주의] 여기에서 Ctrl+C / Ctrl+V 를 커스텀 액션으로 덮어쓰면 안 된다. (과거 그렇게 하다 아래 문제들이 있었다)
    //  1) 커스텀 붙여넣기는 executeEdits 로 텍스트를 직접 밀어넣기 때문에 Monaco 의 붙여넣기 파이프라인을
    //     타지 않는다. 그래서 formatOnPaste 가 동작하지 않아, 한 줄로 압축된 JSON 을 붙여넣으면
    //     그대로 한 줄로 들어갔다.
    //  2) navigator.clipboard.readText() 는 Firefox 등에서 웹 페이지에 허용되지 않고 Chrome 에서도 권한이
    //     필요해, 실패하면 붙여넣기가 아무 반응 없이 무시됐다.
    //  3) 선택 영역이 없을 때 네이티브 Ctrl+C 는 '현재 줄 전체'를 복사하는데, 커스텀 액션은 아무것도
    //     복사하지 않았다.
    // Monaco 의 기본 클립보드 처리는 브라우저 네이티브 copy/paste 이벤트를 쓰므로 권한이 필요 없고
    // formatOnPaste / 실행취소 묶음도 정상 동작한다.
    app.use(VueMonacoEditorPlugin, {});
    app.use(store);
    // @ts-ignore
    app.config.globalProperties.$try = app._component.methods.try;
    // @ts-ignore
    window.$try = app._component.methods.try;
    app.config.globalProperties.EventBus = emitter;
    app.config.globalProperties.OGBus = OpenGraphEmitter;
    app.config.globalProperties.ModelingBus = ModelingEmitter;
    // 전역 상태 관리자를 전역 속성으로 추가
    app.config.globalProperties.$globalState = globalState;

    // globalIsMobile을 Vue 전역 속성으로 추가 (반응형)
    app.config.globalProperties.globalIsMobile = globalIsMobile;

    app.component('modeler-image-generator', ModelerImageGenerator);
    // modeler-image-generator
    // Use plugins

    // 디자이너 전역 컴포넌트(opengraph 28개 + bpmnModeling 128개, 약 1.8MB)는 부팅 시 등록하지 않는다.
    // 별도 청크로 분리해 두고 (1) 실제 디자이너 라우트 진입 시 라우터 가드에서 보장 등록,
    // (2) 그 외에는 최초 렌더 이후 유휴 시점에 백그라운드 등록한다.
    router.beforeEach(async (to, _from, next) => {
        if (pathNeedsDesignerComponents(to.path)) {
            try {
                await ensureDesignerComponents(app);
            } catch (e) {
                console.error('[designer components] 등록 실패:', e);
            }
        }
        next();
    });

    app.use(router);
    // 사용/도입 현황 분석(app_usage_events) — pal 모드 전용 수집
    if (window.$pal) {
        startUsageTracking(router);
    }
    // app.component('EasyDataTable', Vue3EasyDataTable);
    app.component('perfect-scrollbar', PerfectScrollbar);
    app.use(createPinia());
    app.use(VCalendar, {});
    app.use(VueTablerIcons);
    app.component('Icon', Icon);
    app.component('Icons', Icons);
    app.component('InfoAlert', InfoAlert);
    app.component('DetailComponent', DetailComponent);
    app.directive('hammer', hammerDirective);
    // app.use(print);
    app.use(VueRecaptcha, {
        siteKey: '6LdzqbcaAAAAALrGEZWQHIHUhzJZc8O-KSTdTTh_',
        alterDomain: false // default: false
    });
    app.use(i18n);
    app.use(i18nDirective);
    app.use(Maska);
    app.use(VueApexCharts);

    // 새 디자인 시스템 (Pg*). Vuetify 를 대체해 가는 중이라 당분간 공존한다.
    initDesignSystemMode();
    app.use(designSystem);

    app.use(vuetify).mount('#app');
    // Vuetify 컴포넌트를 새 디자인 언어로 덮는 레이어.
    // Vuetify 스타일이 주입된 뒤에 와야 하므로 mount 이후에 적용한다.
    await import('@/ds/vuetify-bridge/overrides.css');

    // NOTE: 디자이너 컴포넌트를 여기서 유휴 프리로드하지 않는다.
    // 번들 분석 결과 그 청크는 ChatModule 과 병합되어 gzip 약 2.5MB 이므로,
    // 디자이너를 쓰지 않는 사용자에게까지 배경 다운로드시키면 절감 효과가 상쇄된다.
    // 등록은 위의 라우터 가드(pathNeedsDesignerComponents)가 전담한다.

    app.use(setLocale);

    // mount 이후에 지오IP 기반 언어 판정을 이어서 수행 (렌더를 막지 않음)
    if (!savedLocale) refineLocaleInBackground();
    //ScrollTop Use
    // app.use(VueScrollTo);
    app.use(VueScrollTo, {
        duration: 1000,
        easing: 'ease',
        offset: -50
    });
    // vue-ganttastic
    dayjs.locale('ko');
    app.use(ganttastic);

    // 전역 복사 보조 — 일부 커스텀 뷰에서 선택 영역 복사가 되지 않는 경우를 위한 폴백.
    // Monaco 에디터와 입력 요소 안에서는 브라우저 기본 동작을 그대로 둔다.
    // (과거에는 선택 영역이 없어도 preventDefault 를 호출해 Ctrl+C 자체를 먹어버렸다)
    document.addEventListener('keydown', function (event) {
        if (!(event.ctrlKey || event.metaKey) || event.key !== 'c') return;

        const target = event.target as HTMLElement | null;
        if (!target) return;
        if (target.closest('.monaco-editor')) return;
        if (target.closest('input, textarea, [contenteditable="true"]')) return;

        const selection = window.getSelection();
        const text = selection ? selection.toString() : '';
        if (!text) return; // 복사할 것이 없으면 기본 동작을 막지 않는다

        try {
            navigator.clipboard.writeText(text);
            event.preventDefault();
        } catch {
            /* 클립보드 API 불가 시 브라우저 기본 복사에 맡긴다 */
        }
    });

    app.use(VueDiff, {
        componentName: 'vuediff'
    });

    if (window.$mode == 'uEngine') {
        (async () => {
            try {
                const initOptions = {
                    url: window._env_?.VITE_KEYCLOAK_URL || import.meta.env.VITE_KEYCLOAK_URL || `http://localhost:9090/`,
                    realm: window._env_?.VITE_KEYCLOAK_REALM || import.meta.env.VITE_KEYCLOAK_REALM || `uengine`,
                    clientId: window._env_?.VITE_KEYCLOAK_CLIENT_ID || import.meta.env.VITE_KEYCLOAK_CLIENT_ID || `uengine`,
                    onLoad: 'login-required' as KeycloakOnLoad // Explicitly cast to KeycloakOnLoad
                };
                const keycloak = new Keycloak(initOptions);
                const authenticated = await keycloak.init({
                    onLoad: initOptions.onLoad
                });
                console.log(`User is ${authenticated ? 'authenticated' : 'not authenticated'}`);
                if (authenticated) {
                    localStorage.setItem('keycloak', `${keycloak.token}`);
                    console.log(keycloak.tokenParsed);
                    if (keycloak.token && keycloak.tokenParsed) {
                        localStorage.setItem('accessToken', `${keycloak.token}`);
                        localStorage.setItem('author', `${keycloak.tokenParsed.email}`);
                        localStorage.setItem('userName', `${keycloak.tokenParsed.preferred_username}`);
                        localStorage.setItem('email', `${keycloak.tokenParsed.email}`);
                        localStorage.setItem('uid', `${keycloak.tokenParsed.sub}`);
                        localStorage.setItem('groups', `${keycloak.tokenParsed.groups}`);
                        localStorage.setItem('roles', `${keycloak.tokenParsed.realm_access?.roles}`);
                        localStorage.setItem('isAdmin', 'true');
                        const defaultPicture = '/images/defaultUser.png';
                        localStorage.setItem('picture', localStorage.getItem('picture') || defaultPicture);
                    }
                }
            } catch (error) {
                console.error(`Failed to initialize adapter: ${error}`);
            }
        })();
    }
}
export { i18n };
initializeApp();
