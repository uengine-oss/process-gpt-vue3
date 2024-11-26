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
// import Vue3EasyDataTable from 'vue3-easy-data-table';
// import 'vue3-easy-data-table/dist/style.css';
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
        $mode: any; 
        $supabase: any;
        $jms: any;
        $isTenantServer: boolean;
        $tenantName: string;
    }
}

Object.defineProperty(window, '$mode', {
    // value: 'uEngine',
    value: 'ProcessGPT',
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

    if (window.location.host.includes('localhost') || 
        window.location.host.includes('192.168') || 
        window.location.host.includes('127.0.0.1') || 
        window.$mode == 'uEngine'
    ) {
        Object.defineProperty(window, '$supabase', {
            value: createClient(
                'http://127.0.0.1:54321',
                'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU',
                {
                    auth: {
                        autoRefreshToken: true,
                        persistSession: true
                    }
                }
            ),
            writable: false,
            configurable: false
        });
    } else {
        Object.defineProperty(window, '$supabase', {
            value: createClient(
                'https://qivmgbtrzgnjcpyynpam.supabase.co',
                'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpdm1nYnRyemduamNweXlucGFtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxNTU4ODc3NSwiZXhwIjoyMDMxMTY0Nzc1fQ.z8LIo50hs1gWcerWxx1dhjri-DMoDw9z0luba_Ap4cI',
                {
                    auth: {
                        autoRefreshToken: true,
                        persistSession: true
                    }
                }
            ),
            writable: false,
            configurable: false
        });
    }
}

async function initializeApp() {
    await setupSupabase();
    const app = createApp(App);
    app.use(VueMonacoEditorPlugin, {
        paths: {
            vs: '/node_modules/monaco-editor/min/vs'
        }
    });
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

    app.component('modeler-image-generator', ModelerImageGenerator);
    // modeler-image-generator
    // Use plugins

    loadOpengraphComponents(app);
    loadbpmnComponents(app);

    fakeBackend();
    app.use(router);
    // app.component('EasyDataTable', Vue3EasyDataTable);
    app.use(PerfectScrollbar);
    app.use(createPinia());
    app.use(VCalendar, {});
    app.use(VueTablerIcons);
    app.component('Icon', Icon);
    app.component('Icons', Icons)
    app.component('DetailComponent', DetailComponent);
    // app.use(print);
    app.use(VueRecaptcha, {
        siteKey: '6LdzqbcaAAAAALrGEZWQHIHUhzJZc8O-KSTdTTh_',
        alterDomain: false // default: false
    });
    app.use(i18n);
    app.use(Maska);
    app.use(VueApexCharts);
    app.use(vuetify).mount('#app');
    app.use(setLocale);
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

    // 전역으로 복사 가능하게 추가
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
            event.preventDefault(); // 기본 이벤트 방지
        }
    });

    app.use(VueDiff, {
        componentName: 'vuediff'
    });
    let initOptions = {
        url: `http://localhost:9090/`,
        realm: `uengine`,
        clientId: `uengine`,
        onLoad: 'login-required' as KeycloakOnLoad // Explicitly cast to KeycloakOnLoad
    };
    (async () => {
        let keycloak = new Keycloak(initOptions);
        try {
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
                    localStorage.setItem('isAdmin', 'true');
                    localStorage.setItem('picture', '');
                }
            }
            // const response = await fetch('http://localhost:9090/api/users', {
            //     headers: {
            //         accept: 'application/json',
            //         authorization: `Bearer ${keycloak.token}`
            //     }
            // });
            // console.log(response.json());
        } catch (error) {
            console.error('Failed to initialize adapter:', error);
        }
    })();
}
export { i18n };
initializeApp();
