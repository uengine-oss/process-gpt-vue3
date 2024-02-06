import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { router } from './router';
import vuetify from './plugins/vuetify';
import '@/scss/style.scss';
import PerfectScrollbar from 'vue3-perfect-scrollbar';
import VueApexCharts from 'vue3-apexcharts';
import VueTablerIcons from 'vue-tabler-icons';
import { fakeBackend } from '@/utils/helpers/fake-backend';
import 'vue3-carousel/dist/carousel.css';
//Mock Api data
import './_mockApis';
import VCalendar from 'v-calendar';
import VueRecaptcha from 'vue3-recaptcha-v2';
import Maska from 'maska';
// print
// import print from 'vue3-print-nb';
// Table
import Vue3EasyDataTable from 'vue3-easy-data-table';
import 'vue3-easy-data-table/dist/style.css';
//i18
import { createI18n } from 'vue-i18n';
import messages from '@/utils/locales/messages';
import setLocale from './plugins/setLocale';

//ScrollTop
import VueScrollTo from 'vue-scrollto';
const i18n = createI18n({
    locale: 'ko',
    fallbackLocale: 'en',
    messages,
  });
// EventBus
import mitt from 'mitt';
const emitter = mitt();
const OpenGraphEmitter = mitt();
const ModelingEmitter = mitt();

const app = createApp(App);
app.config.globalProperties.$app = app;
app.config.globalProperties.EventBus = emitter;
app.config.globalProperties.OGBus = OpenGraphEmitter;
app.config.globalProperties.ModelingBus = ModelingEmitter;

import ModelerImageGenerator from '@/components/designer/ModelerImageGenerator.vue'
app.component('modeler-image-generator', ModelerImageGenerator)
// modeler-image-generator
// Use plugins
import loadOpengraphComponents from './opengraph'
import loadbpmnComponents from './components/designer/bpmnModeling/bpmn'

loadOpengraphComponents(app)
loadbpmnComponents(app)

fakeBackend();
app.use(router);
app.component('EasyDataTable', Vue3EasyDataTable);
app.use(PerfectScrollbar);
app.use(createPinia());
app.use(VCalendar, {});
app.use(VueTablerIcons);
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
    easing: "ease",
    offset:-50,
})