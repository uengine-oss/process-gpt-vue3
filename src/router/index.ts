import { createRouter, createWebHistory } from 'vue-router';
import MainRoutes from './MainRoutes';
import AuthRoutes from './AuthRoutes';
import TenantRoutes from './TenantRoutes';
import { evaluateMaintenanceGate, MAINTENANCE_PATH } from '@/utils/maintenanceGate';
import { membershipRedirect, SIGNUP_PENDING_PATH } from '@/utils/membershipGate';
import { withCallActivityHistory } from '@/components/customDrilldown/drilldownHistory';

declare global {
    interface Window {
        $try?: (options: any, parameters?: any, options_?: any) => Promise<void>;
        $app_?: any;
    }
}

// 동적 임포트 재시도 래퍼 함수
export const retryDynamicImport = (importFn: () => Promise<any>, retries = 3, delay = 1000) => {
    return new Promise((resolve, reject) => {
        importFn()
            .then(resolve)
            .catch((error) => {
                if (retries > 0) {
                    setTimeout(() => {
                        retryDynamicImport(importFn, retries - 1, delay)
                            .then(resolve)
                            .catch(reject);
                    }, delay);
                } else {
                    reject(error);
                }
            });
    });
};

// 개발·데모 라우트 게이트 (VITE_FF_DEV_ROUTES) — 인증 게이트 밖 공개 라우트이므로 기본 OFF.
// vite dev 서버(로컬 개발·playwright e2e)는 항상 노출하고,
// 프로덕션 빌드는 VITE_FF_DEV_ROUTES=true 를 명시한 배포에서만 등록한다.
const devRoutesEnabled = (() => {
    if (import.meta.env.DEV) return true;
    const runtime = (window as any)._env_?.VITE_FF_DEV_ROUTES;
    const raw = runtime !== undefined && runtime !== '' ? runtime : import.meta.env.VITE_FF_DEV_ROUTES;
    return raw === true || raw === 'true';
})();

export const router = createRouter({
    history: withCallActivityHistory(createWebHistory(import.meta.env.BASE_URL)),
    routes: [
        // 외부 고객용 폼 URL
        {
            name: 'External Forms',
            path: '/external-forms/:formId',
            component: () => retryDynamicImport(() => import('@/components/ui/ExternalForms.vue'))
        },
        ...(devRoutesEnabled
            ? [
                  {
                      name: 'Design System',
                      path: '/design-system',
                      component: () => retryDynamicImport(() => import('@/views/ds/DesignSystem.vue'))
                  },
                  {
                      // 로그인 화면은 App.vue 의 테넌트 게이트 뒤에 있어 백엔드 없이는 렌더되지 않는다.
                      // 디자인 확인용으로 게이트가 열려 있는 /design-system 경로 아래에 미리보기를 둔다.
                      name: 'Design System Login Preview',
                      path: '/design-system/login',
                      component: () => retryDynamicImport(() => import('@/views/authentication/SideLogin.vue'))
                  },
                  {
                      name: 'BPMN Auto Layout E2E',
                      path: '/bpmn-auto-layout-e2e',
                      component: () => retryDynamicImport(() => import('@/views/e2e/BpmnAutoLayoutE2E.vue'))
                  },
                  {
                      name: 'ProcessGPT Mapper UI E2E',
                      path: '/processgpt-mapper-ui-e2e',
                      component: () => retryDynamicImport(() => import('@/views/e2e/ProcessGptMapperUiE2E.vue'))
                  },
                  {
                      name: 'ProcessGPT CallActivity Form Mapping E2E',
                      path: '/processgpt-callactivity-form-mapping-e2e',
                      component: () => retryDynamicImport(() => import('@/views/e2e/ProcessGptCallActivityFormMappingE2E.vue'))
                  }
              ]
            : []),
        MainRoutes,
        AuthRoutes,
        TenantRoutes,
        ...(devRoutesEnabled
            ? [
                  {
                      // 순서도/폼의 마크다운·슬라이드 필드는 컴포넌트를 직접 임베드하므로
                      // 아래 라우트를 꺼도 폼 렌더링에는 영향이 없다 (단독 편집 화면 전용).
                      name: 'Markdown Editor',
                      path: '/markdown-editor',
                      component: () => retryDynamicImport(() => import('@/views/markdown/MarkdownEditor.vue'))
                  },
                  {
                      // 공개 데모 라우트(인증 불필요) — 인스턴스 자동분류 · Top List · 유사 사례.
                      name: 'Instance Classifier Demo',
                      path: '/instance-classifier-demo',
                      component: () => retryDynamicImport(() => import('@/views/demo/InstanceClassifierDemo.vue'))
                  },
                  {
                      name: 'Slide',
                      path: '/slide-editor',
                      component: () => retryDynamicImport(() => import('@/views/markdown/SlideEditor.vue'))
                  },
                  {
                      path: '/present',
                      name: 'presentation',
                      component: () => retryDynamicImport(() => import('@/views/markdown/SlidePresentation.vue')),
                      props: (route: any) => ({
                          printPdf: route.query['print-pdf'] !== undefined,
                          showNotes: route.query.showNotes,
                          pdfSeparateFragments: route.query.pdfSeparateFragments
                      })
                  }
              ]
            : []),
        // 404 등 미매칭 경로는 마지막에 매칭되도록 catch-all을 맨 뒤에 둠 (예: /auth/reset-password가 Error로 떨어지지 않도록)
        {
            path: '/:pathMatch(.*)*',
            component: () => retryDynamicImport(() => import('@/views/authentication/Error.vue'))
        }
    ]
});

// 라우터 에러 상태 추적
let hasRouterError = false;

/** 비밀번호 재설정 화면에 메일 링크(recovery)로 진입한 상태인지 여부 */
function isOnResetPasswordWithRecoveryHash(): boolean {
    return (
        typeof window !== 'undefined' &&
        window.location.pathname === '/auth/reset-password' &&
        window.location.hash.includes('type=recovery')
    );
}

router.beforeEach(async (to: any, from: any, next: any) => {
    // Approval lookup fails closed; a network error must not admit pending accounts.
    try {
        const redirect = await membershipRedirect(to.path);
        if (redirect) return next(redirect);
    } catch (error) {
        console.error('가입 승인 상태 조회 실패:', error);
        return next(SIGNUP_PENDING_PATH);
    }
    try {
        // 라우터 에러 상태가 있으면 상태 리셋 후 계속 진행
        if (hasRouterError) {
            console.log('[라우터] 에러 상태 감지 - 상태 리셋 후 계속 진행');
            hasRouterError = false;
        }

        // 비밀번호 재설정 화면(recovery 해시)에 있는 동안 테넌트 관리 등으로 나가는 네비게이션 차단 (재설정 완료 후 /auth/login 이동은 허용)
        if (isOnResetPasswordWithRecoveryHash()) {
            const isBlocked = to.path.startsWith('/tenant/');
            if (isBlocked) {
                return next(false);
            }
        }

        // PAL 점검 모드: 점검 중에는 admin 이 아닌 사용자를 점검 안내 화면으로 보낸다.
        // (인증 라우트/외부 폼은 통과 — 관리자가 로그인해서 점검을 해제할 수 있어야 한다)
        if (window.$pal) {
            const maintenanceDecision = await evaluateMaintenanceGate(to.path);
            if (maintenanceDecision === 'block') {
                return next(MAINTENANCE_PATH);
            }
            if (maintenanceDecision === 'release' && to.path === MAINTENANCE_PATH) {
                return next('/');
            }
        }

        // PAL 모드의 루트는 별도 랜딩 페이지로 노출하지 않고 인증 상태에 따른 시작 화면으로 보낸다.
        // setupSupabase()에서 세션 복원을 기다린 뒤 라우터가 설치되므로 여기서는 복원된
        // 세션을 그대로 확인할 수 있다.
        if (window.$pal && to.path === '/') {
            const { data, error } = (await window.$supabase?.auth?.getSession?.()) || {};
            const isLoggedIn = !error && !!data?.session?.user;

            return next(isLoggedIn ? '/process-architecture' : '/auth/login');
        }

        if (window.$mode !== 'uEngine') {
            if (to.fullPath.includes('/auth') || to.fullPath.includes('/external-forms')) {
                return next();
            } else {
                if (window.$isTenantServer) {
                    if (!to.fullPath.includes('/tenant') && to.fullPath !== '/') {
                        return next('/tenant/manage');
                    } else if (to.fullPath === '/' || to.matched.some((record) => TenantRoutes.children.includes(record as any))) {
                        next();
                    }
                } else {
                    // ===== 로컬 테스트용 코드 시작 =====
                    // 로컬호스트에서 테넌트 관리 페이지 테스트를 위한 코드
                    // 필요시 주석을 해제하여 사용
                    // const isLocalhost = window.location.host.includes('localhost') ||
                    //                    window.location.host.includes('192.168') ||
                    //                    window.location.host.includes('127.0.0.1');
                    //
                    // if (to.fullPath.includes('/tenant') && !isLocalhost) {
                    //     return next('/');
                    // }
                    // ===== 로컬 테스트용 코드 끝 =====

                    // 기존 코드 (운영환경용)
                    if (to.fullPath.includes('/tenant')) {
                        return next('/');
                    }
                }
            }
        }

        next();
    } catch (error) {
        console.error('[라우터] beforeEach 에러 발생:', error);
        hasRouterError = true;
        next();
    }
});

// 라우터 에러 핸들러 추가
router.onError((error) => {
    console.error('[라우터] 라우팅 에러 발생:', error);

    const errorMessage = error?.message || error?.toString() || '';

    // 동적 임포트 실패 시 자동 복구
    if (
        errorMessage.includes('Failed to fetch dynamically imported module') ||
        errorMessage.includes('Module not found') ||
        errorMessage.includes('Cannot resolve component')
    ) {
        hasRouterError = true;

        // 사용자에게 알림
        if (window.$app_) {
            window.$app_.snackbarMessage = '페이지 로딩 중 오류가 발생했습니다. 자동으로 재시도합니다.';
            window.$app_.snackbarColor = 'warning';
            window.$app_.snackbar = true;
            window.$app_.clickCount = 0;
        }

        // 2초 후 자동 새로고침
        setTimeout(() => {
            window.location.reload();
        }, 2000);
    } else {
        console.log('[라우터] 일반적인 에러 - 라우팅 계속 진행');
    }
});

export default router;
