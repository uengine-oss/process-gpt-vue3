
import '@/scss/style.scss';
import { install as VueMonacoEditorPlugin } from '@guolao/vue-monaco-editor';
import { fakeBackend } from '@/utils/helpers/fake-backend';
import { createClient } from '@supabase/supabase-js';
import { createPinia } from 'pinia';
import { createApp } from 'vue';
import VueTablerIcons from 'vue-tabler-icons';
import VueApexCharts from 'vue3-apexcharts';
import 'vue3-carousel/dist/carousel.css';
import PerfectScrollbar from 'vue3-perfect-scrollbar';
import App from './App.vue';
import vuetify from './plugins/vuetify';
import { router } from './router';
import store from './store';
import axios from 'axios';
//Mock Api data
import Maska from 'maska';
import VCalendar from 'v-calendar';
import VueRecaptcha from 'vue3-recaptcha-v2';
import './_mockApis';
// print
// import print from 'vue3-print-nb';
// Table
import Vue3EasyDataTable from 'vue3-easy-data-table';
import 'vue3-easy-data-table/dist/style.css';
//i18
import messages from '@/utils/locales/messages';
import { createI18n } from 'vue-i18n';
import setLocale from './plugins/setLocale';

// icon
import { Icon } from '@iconify/vue';
import Icons from '@/components/ui-components/Icons.vue'

// css
import '@/assets/css/globalStyle.css';
import '@/assets/css/mashUpStyle.css';

// 전역 관리 ts
import globalState from '@/stores/globalState';

// diff viewer
import xml from 'highlight.js/lib/languages/xml';
import VueDiff from 'vue-diff';
import 'vue-diff/dist/index.css';
VueDiff.hljs.registerLanguage('xml', xml);

import VueScrollTo from 'vue-scrollto';
import StorageBaseFactory from '@/utils/StorageBaseFactory';

import ModelerImageGenerator from '@/components/designer/ModelerImageGenerator.vue';
import type { KeycloakOnLoad } from 'keycloak-js';
import Keycloak from 'keycloak-js';
import loadbpmnComponents from './components/designer/bpmnModeling/bpmn';
import loadOpengraphComponents from './opengraph';
import DetailComponent from './components/ui-components/details/DetailComponent.vue'

// vue-
import dayjs from 'dayjs';
import 'dayjs/locale/ko';
import ganttastic from '@infectoone/vue-ganttastic'

const i18n = createI18n({
    locale: 'ko',
    fallbackLocale: 'en',
    messages
});
// EventBus
import mitt from 'mitt';
const emitter = mitt();
const OpenGraphEmitter = mitt();
const ModelingEmitter = mitt();

declare global {
    interface Window {
      $masterDB: any;
      $mode: any; 
      $supabase: any;
      $jms: any;
      $isTenantServer: boolean;
      $tenantName: string;
    }
}


window.$mode = 'uEngine';
// window.$mode = 'ProcessGPT';


const CACHE_EXPIRATION_TIME = 60 * 60 * 1000; 
// 인증 정보 캐싱

async function setupSupabase() {
    window.$jms = false;

    if (window.location.host.includes('localhost') || window.location.host.includes('192.168') || window.location.host.includes('127.0.0.1') || 
        window.$mode == 'uEngine') {
        window.$isTenantServer = false
        window.$supabase = createClient(
            'http://127.0.0.1:54321',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU',
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            }
        );
    } else {
        window.$masterDB = createClient(
            'https://qivmgbtrzgnjcpyynpam.supabase.co',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpdm1nYnRyemduamNweXlucGFtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxNTU4ODc3NSwiZXhwIjoyMDMxMTY0Nzc1fQ.z8LIo50hs1gWcerWxx1dhjri-DMoDw9z0luba_Ap4cI',
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            }
        );
        const subdomain = window.location.host.split('.')[0];
        if(subdomain == 'www'){
            window.$isTenantServer = true;
            window.$supabase = createClient(
                'https://qivmgbtrzgnjcpyynpam.supabase.co',
                'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpdm1nYnRyemduamNweXlucGFtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxNTU4ODc3NSwiZXhwIjoyMDMxMTY0Nzc1fQ.z8LIo50hs1gWcerWxx1dhjri-DMoDw9z0luba_Ap4cI',
                {
                    auth: {
                        autoRefreshToken: false,
                        persistSession: false
                    }
                }
            );
        } else {
            let res: any;
            window.$isTenantServer = false;
            window.$tenantName = subdomain;
            await (async () => {
                let options: {
                    key: string;
                    match?: Record<string, any>;
                } = {
                    key: "id"
                };
                let obj: {
                    table: string;
                    searchKey?: string;
                    searchVal?: string;
                } = {
                    table: ''
                };
            
                let path = `db://tenant_def/${subdomain}`
                path = path.includes('://') ? path.split('://')[1] : path;
            
                if (path.includes('/')) {
                    obj.table = path.split('/')[0];
                    if (options && options.key) {
                        obj.searchKey = options.key;
                        obj.searchVal = path.split('/')[1];
                    }
                } else {
                    obj.table = path;
                }
                if (options && options.match) {
                    const { data, error } = await window.$masterDB
                        .from(obj.table)
                        .select()
                        .match(options.match)
                        .maybeSingle();
            
                    if (error) {
                        alert(error);
                    } else if (data) {
                        res = data;
                    }
                } else if (obj.searchVal) {
                    const { data, error } = await window.$masterDB
                        .from(obj.table)
                        .select()
                        .eq(obj.searchKey, obj.searchVal)
                        .maybeSingle();
            
                    if (error) {
                        alert(error);
                    } else if (data) {
                        res = data;
                    }
                } else {
                    const { data, error } = await window.$masterDB
                        .from(obj.table)
                        .select()
                        .maybeSingle();
                    
                    if (error) {
                        alert(error);
                    } else if (data) {
                        res = data;
                    }
                }
                if(res.url && res.secret){
                    window.$supabase = createClient(res.url, res.secret, {
                        auth: {
                            autoRefreshToken: false,
                            persistSession: false
                        }
                    });
                    
                    const storage = StorageBaseFactory.getStorage();

                    try {
                        await axios.post(`/execution/update_db`);
                    } catch (error: any) {
                        if (error.response && error.response.status === 500) {
                            console.error('Error updating DB:', error);
                            alert('DB 연결에 실패하였습니다. 연결된 DB가 정상적으로 동작 중인지 확인 후 다시 시도해주세요.');
                        } else {
                            console.error('An unexpected error occurred:', error);
                        }
                    }

                    const response = await storage.list(`users`);
                    if (response && response.length == 0) {
                        if (res && res.owner) {
                            const { data, error } = await window.$masterDB
                                .from('users')
                                .select('*')
                                .eq('email', res.owner)
                                .maybeSingle();
        
                            if (error) {
                                console.error('Error fetching user:', error);
                                throw error;
                            } else if (data && data.pw) {
                                let userInfo = {
                                    username: data.username,
                                    email: data.email,
                                    password: data.pw,
                                };
                                const result = await storage.signUp(userInfo);
                                let dbUserInfo = {
                                    id: result.user.id,
                                    username: data.username,
                                    email: data.email,
                                };
                                await storage.putObject('users', dbUserInfo);
                            }
                        }
                    } 

                } else {
                    alert('해당 주소는 존재하지 않는 주소입니다. 가입 후 이용하세요.');
                    window.location.href = 'https://www.process-gpt.io';
                }
            })();
        }
    }
}

async function setupKeycloak() {
    if(window.$mode != "uEngine") return;
    const cachedKeycloak = localStorage.getItem('cachedKeycloak');
    const cachedKeycloakTimestamp = localStorage.getItem('cachedKeycloakTimestamp');

    if (cachedKeycloak && cachedKeycloakTimestamp) {
        const currentTime = new Date().getTime();
        if (currentTime - parseInt(cachedKeycloakTimestamp) < CACHE_EXPIRATION_TIME) {
            // 캐시가 유효한 경우
            const keycloakData = JSON.parse(cachedKeycloak);
            // 캐시된 Keycloak 정보 사용
            localStorage.setItem('accessToken', keycloakData.token);
            localStorage.setItem('author', keycloakData.email);
            localStorage.setItem('userName', keycloakData.username);
            localStorage.setItem('email', keycloakData.email);
            localStorage.setItem('uid', keycloakData.sub);
            localStorage.setItem('isAdmin', 'true');
            localStorage.setItem('picture', '');
            console.log('Keycloak 인증 정보가 캐시에서 로드되었습니다.');
            return;
        }
    }

    // 캐시가 없거나 만료된 경우, 새로운 Keycloak 인증 수행
    let initOptions = {
        url: `http://localhost:9090/`,
        realm: `uengine`,
        clientId: `uengine`,
        onLoad: 'login-required' as KeycloakOnLoad
    };

    let keycloak = new Keycloak(initOptions);
    try {
        const authenticated = await keycloak.init({
            onLoad: initOptions.onLoad
        });
        if (authenticated && keycloak.token && keycloak.tokenParsed) {
            // 새로운 인증 정보를 캐시에 저장
            const keycloakData = {
                token: keycloak.token,
                email: keycloak.tokenParsed.email,
                username: keycloak.tokenParsed.preferred_username,
                sub: keycloak.tokenParsed.sub
            };
            localStorage.setItem('cachedKeycloak', JSON.stringify(keycloakData));
            localStorage.setItem('cachedKeycloakTimestamp', new Date().getTime().toString());

            // 로컬 스토리지에 인증 정보 저장
            localStorage.setItem('accessToken', keycloak.token);
            localStorage.setItem('author', keycloak.tokenParsed.email);
            if (keycloak.tokenParsed.preferred_username) {
                localStorage.setItem('userName', keycloak.tokenParsed.preferred_username);
            }
            if (keycloak.tokenParsed.email) {
                localStorage.setItem('email', keycloak.tokenParsed.email);
            }
            if (keycloak.tokenParsed.sub) {
                localStorage.setItem('uid', keycloak.tokenParsed.sub);
            }
            localStorage.setItem('isAdmin', 'true');
            localStorage.setItem('picture', '');
        }
    } catch (error) {
            console.error('Failed to initialize Keycloak:', error);
        console.error('Failed to initialize Keycloak:', error);
    }
}
async function initializeApp() {
    await setupSupabase();
    await setupKeycloak();

    const app = createApp(App);

    // Vue Monaco Editor 플러그인 설정
    app.use(VueMonacoEditorPlugin, {
        paths: {
            vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.43.0/min/vs'
        }
    });

    // Vuex 스토어 사용
    app.use(store);

    // 전역 메서드 설정
    // @ts-ignore
    app.config.globalProperties.$try = app._component.methods.try;
    // @ts-ignore
    window.$try = app._component.methods.try;

    // 이벤트 버스 설정
    app.config.globalProperties.EventBus = emitter;
    app.config.globalProperties.OGBus = OpenGraphEmitter;
    app.config.globalProperties.ModelingBus = ModelingEmitter;

    // 전역 상태 관리자 설정
    app.config.globalProperties.$globalState = globalState;

    // 컴포넌트 등록
    app.component('modeler-image-generator', ModelerImageGenerator);
    app.component('EasyDataTable', Vue3EasyDataTable);
    app.component('Icon', Icon);
    app.component('Icons', Icons);
    app.component('DetailComponent', DetailComponent);

    // 플러그인 로드
    loadOpengraphComponents(app);
    loadbpmnComponents(app);

    // 기타 플러그인 및 라이브러리 설정
    fakeBackend();
    app.use(router);
    app.use(PerfectScrollbar);
    app.use(createPinia());
    app.use(VCalendar, {});
    app.use(VueTablerIcons);
    app.use(VueRecaptcha, {
        siteKey: '6LdzqbcaAAAAALrGEZWQHIHUhzJZc8O-KSTdTTh_',
        alterDomain: false // default: false
    });
    app.use(i18n);
    app.use(Maska);
    app.use(VueApexCharts);
    app.use(vuetify);
    app.use(setLocale);
    app.use(VueScrollTo, {
        duration: 1000,
        easing: 'ease',
        offset: -50
    });

    // 날짜 라이브러리 설정
    dayjs.locale('ko');
    app.use(ganttastic);

    // 전역 복사 기능 추가
    document.addEventListener('keydown', function (event) {
        if ((event.ctrlKey || event.metaKey) && event.key === 'c') {
            let selection = window.getSelection();
            if (selection) {
                navigator.clipboard.writeText(selection.toString()).then(
                    function () {
                        console.log('Copying to clipboard was successful!');
                    },
                    function (err) {
                        console.error('Could not copy text: ', err);
                    }
                );
            }
            event.preventDefault();
        }
    });

    // Vue Diff 플러그인 설정
    app.use(VueDiff, {
        componentName: 'vuediff'
    });

    // 앱 마운트
    app.mount('#app');

    console.log('Application initialized successfully');
}


initializeApp();
