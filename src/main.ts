import '@/scss/style.scss';
import { fakeBackend } from '@/utils/helpers/fake-backend';
import { createPinia } from 'pinia';
import { createApp } from 'vue';
import VueTablerIcons from 'vue-tabler-icons';
import VueApexCharts from 'vue3-apexcharts';
import 'vue3-carousel/dist/carousel.css';
import PerfectScrollbar from 'vue3-perfect-scrollbar';
import App from './App.vue';
import vuetify from './plugins/vuetify';
import { router } from './router';
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

// css
import '@/assets/css/globalStyle.css';

// 전역 관리 ts
import globalState from '@/stores/globalState';

// diff viewer
import xml from 'highlight.js/lib/languages/xml';
import VueDiff from 'vue-diff';
import 'vue-diff/dist/index.css';
VueDiff.hljs.registerLanguage('xml', xml);

//ScrollTop
import VueScrollTo from 'vue-scrollto';
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
window.$mode = 'uEngine';
const app = createApp(App);

// @ts-ignore
app.config.globalProperties.$try = app._component.methods.try;
app.config.globalProperties.EventBus = emitter;
app.config.globalProperties.OGBus = OpenGraphEmitter;
app.config.globalProperties.ModelingBus = ModelingEmitter;
// 전역 상태 관리자를 전역 속성으로 추가
app.config.globalProperties.$globalState = globalState;

import ModelerImageGenerator from '@/components/designer/ModelerImageGenerator.vue';
app.component('modeler-image-generator', ModelerImageGenerator);
// modeler-image-generator
// Use plugins
import loadbpmnComponents from './components/designer/bpmnModeling/bpmn';
import loadOpengraphComponents from './opengraph';

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
app.use(VueDiff, {
    componentName: 'vuediff'
});
let initOptions = {
    url: `http://localhost:9090/`,
    realm: `uengine6`,
    clientId: `uengine`,
    onLoad: 'login-required' as KeycloakOnLoad // Explicitly cast to KeycloakOnLoad
};
import Keycloak from 'keycloak-js';
import type { KeycloakOnLoad } from 'keycloak-js';
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
