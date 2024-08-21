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

async function setupSupabase() {
    // window.$mode = 'uEngine';
    window.$mode = 'ProcessGPT';
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

                    await axios.post(`/execution/update_db`);

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

async function initializeApp() {
    await setupSupabase();
    const app = createApp(App);
    app.use(VueMonacoEditorPlugin, {
        paths: {
            // The recommended CDN config
            vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.43.0/min/vs'
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
    app.component('EasyDataTable', Vue3EasyDataTable);
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

initializeApp();
