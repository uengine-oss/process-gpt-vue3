/**
 * 모바일 앱 시작점.
 *
 * 포털의 시작점(src/main.ts, 527줄)과 다른 파일인 이유는 그쪽이 Monaco · jQuery ·
 * BPMN · 차트 · Keycloak 까지 불러오기 때문이다. 그 대부분은 작은 화면에서 열 수
 * 없는 화면들의 짐이다.
 *
 * 여기서 하는 일은 네 가지뿐이다.
 *   1) Supabase 붙이기
 *   2) 저장된 세션 복원 (앱을 껐다 켜도 다시 로그인하지 않게)
 *   3) 세션에서 소속 조직 알아내기 — 앱에는 주소로 알 방법이 없다
 *   4) 화면 띄우기
 */

import { createClient } from '@supabase/supabase-js';
import { createApp } from 'vue';

import axios from '@/utils/axios';
import { authClaimsState, refreshAuthClaims } from '@/utils/authClaims';
import { getValidToken } from '@/utils/supabaseAuth';

import App from './App.vue';
import { createMobileRouter } from './router';
import { applyIdentity, clearIdentity, identityFrom, loadProfile } from './lib/identity.js';
import { restore as restoreAppearance } from './lib/appearance.js';
import { toBanner } from './lib/banner.js';
import {
    attachNativeBehaviour,
    consumeLaunchNotification,
    routeForNotification
} from './lib/native.js';
import { appStateSource, startPresence } from './lib/presence.js';
import { touchDevice } from './lib/push.js';
import { showBanner } from './lib/pushBannerHost.js';
import { configure as configureHttp } from './lib/http.js';
import { applyTenant, portalOriginFor, tenantFromSession } from './lib/tenant.js';
import './styles/base.css';

/** 조직 이름을 붙일 기준 주소. 빌드할 때 정한다. */
export const PORTAL_BASE_URL: string =
    (import.meta.env.VITE_PORTAL_BASE_URL as string) || 'https://process-gpt.io';

/** 이 조직의 서버 주소. 조직을 알아낸 뒤 정해진다. */
export const apiBase = { origin: PORTAL_BASE_URL };

function connectSupabase() {
    const url = import.meta.env.VITE_SUPABASE_URL as string;
    const key = import.meta.env.VITE_SUPABASE_KEY as string;

    if (!url || !key) {
        // 여기서 멈추는 편이 낫다. 없이 뜨면 모든 화면이 빈 채로 열리고,
        // 사용자에게는 "아무것도 안 나온다" 로만 보인다.
        throw new Error('VITE_SUPABASE_URL 과 VITE_SUPABASE_KEY 가 필요합니다');
    }

    const client = createClient(url, key, {
        auth: {
            autoRefreshToken: true,
            // 앱을 껐다 켜도 다시 로그인하지 않게. 휴대폰에서 매번 입력하는 것은
            // 데스크톱보다 훨씬 번거롭다.
            persistSession: true
        }
    });

    Object.defineProperty(window, '$supabase', {
        value: client,
        writable: false,
        configurable: false
    });
    return client;
}

/**
 * 소속 조직을 정하고, 재사용하는 코드가 읽는 자리에 심는다.
 *
 * 세션의 app_metadata 에 있으면 그것을 쓰고, 없으면 authClaims 가 사용자 레코드까지
 * 뒤져 알아낸다. 둘 다 실패하면 조직 없이 둔다 — 그 상태에서는 목록이 비어 보이므로
 * 화면이 그 사실을 말해 준다.
 */
export async function establishSession(session: any) {
    if (!session) {
        clearIdentity();
        applyTenant(null);
        apiBase.origin = portalOriginFor(null, PORTAL_BASE_URL);
        return null;
    }

    // 권한과 소속 조직은 같은 곳에서 나온다. 한 번만 부른다.
    const claims = await refreshAuthClaims(session);
    const tenant = tenantFromSession(session) || claims?.tenantId || authClaimsState.tenantId || null;

    applyTenant(tenant);
    apiBase.origin = portalOriginFor(tenant, PORTAL_BASE_URL);

    // 재사용하는 데이터 계층이 localStorage 에서 사용자 정보를 읽는다.
    // 비워 두면 업무 완료 요청이 "누가" 없이 나가고, 실패가 아니라 조용히
    // 잘못된 값으로 성공한다.
    const profile = await loadProfile((window as any).$supabase, session?.user?.id);
    applyIdentity(identityFrom(session, profile, claims));

    return tenant;
}

async function boot() {
    // 색을 먼저 잡는다. 화면이 뜬 뒤에 바꾸면 잠깐 다른 색이 번쩍인다.
    restoreAppearance();

    // 재사용하는 코드는 `/memento/...` 같은 상대 경로로 부른다. 앱의 화면 주소는
    // https://localhost 라서 그대로 두면 **앱 자신에게** 요청하고, 앱 내부 서버는
    // 무엇을 물어도 화면 HTML 을 200 으로 돌려준다 — 실패하지 않고 빈 결과가 된다.
    // 서버 주소를 붙이고 토큰을 실어 준다.
    configureHttp(axios, {
        originOf: () => apiBase.origin,
        tokenOf: () => getValidToken(),
        tenantOf: () => (window as any).$tenantName || null
    });

    const supabase = connectSupabase();

    // 저장된 세션이 복원될 때까지 기다린다. 이걸 기다리지 않으면 첫 화면의
    // 조회가 로그인돼 있는데도 익명으로 나가 아무것도 못 읽는다.
    const { data } = await supabase.auth.getSession();
    await establishSession(data?.session || null);

    // 계정이 바뀌면 조직도 다시 정해야 한다.
    supabase.auth.onAuthStateChange((_event: string, next: any) => {
        void establishSession(next || null);
    });

    const router = createMobileRouter();

    // 알림을 눌러 들어온 경우 그 건으로 보낸다. 목록만 뜨면 사용자는 방금 알림이
    // 어느 건이었는지 다시 찾아야 한다 — 알림을 받는 의미가 절반으로 준다.
    // 브라우저에서는 아무것도 하지 않는다.
    attachNativeBehaviour(router, window, (event: any) => {
        // 앱을 보고 있는 동안 온 알림은 기기가 배너를 띄우지 않는다. 앱이 띄운다.
        showBanner(toBanner(event, routeForNotification));
    });

    createApp(App).use(router).mount('#app');

    // 이 기기를 쓰고 있다고 서버에 알린다.
    //
    // 알림을 어느 기기로 보낼지는 서버가 이 시각 하나로 정한다 — 쓰고 있는
    // 기기가 있으면 거기로만, 아무 데도 없으면 가진 기기 모두로. 알리지 않으면
    // 앱은 언제나 "안 쓰는 기기" 라서, PC 로 웹을 켜 둔 사람은 휴대폰 알림을
    // 영영 받지 못한다.
    startPresence({
        touch: async () => {
            const { data } = await supabase.auth.getSession();
            if (!data?.session) return;
            await touchDevice({ supabase, session: data.session });
        },
        onActiveChange: appStateSource(window)
    });

    // 알림을 눌러 앱이 처음 켜진 경우. 이벤트는 화면이 뜨기 전에 지나가 버리므로
    // 네이티브가 실행 인텐트에 담아 둔 것을 직접 꺼내 그 건으로 보낸다.
    await router.isReady();
    void consumeLaunchNotification(router);
}

void boot();
