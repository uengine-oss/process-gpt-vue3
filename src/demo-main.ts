// 독립 실행 데모 엔트리 — 앱 부트스트랩(Supabase/tenant/keycloak) 없이
// Vuetify + instance-classifier 컴포넌트만 마운트한다(스크린샷/매뉴얼용).
import { createApp } from 'vue';
import vuetify from './plugins/vuetify';
import DemoApp from './views/demo/DemoApp.vue';

createApp(DemoApp).use(vuetify).mount('#demo-app');
