import { createRouter, createWebHistory } from 'vue-router';
import MainRoutes from './MainRoutes';
import AuthRoutes from './AuthRoutes';
import TenantRoutes from './TenantRoutes';

export const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [
        {
            path: '/:pathMatch(.*)*',
            component: () => import('@/views/authentication/Error.vue')
        },
        // 외부 고객용 폼 URL
        {
            name: 'External Forms',
            path: '/external-forms/:formId',
            component: () => import('@/components/ui/ExternalForms.vue')
        },
        MainRoutes,
        AuthRoutes,
        TenantRoutes,
        {
            name: 'Markdown Editor',
            path: '/markdown-editor',
            component: () => import('@/views/markdown/MarkdownEditor.vue')
        },
        {
            name: 'Slide',
            path: '/slide-editor',
            component: () => import('@/views/markdown/SlideEditor.vue')
        },
        {
            path: '/present',
            name: 'presentation',
            component: () => import('@/views/markdown/SlidePresentation.vue'),
            props: (route) => ({
                printPdf: route.query['print-pdf'] !== undefined,
                showNotes: route.query.showNotes,
                pdfSeparateFragments: route.query.pdfSeparateFragments
            })
        }
    ]
});

// 라우터 에러 상태 추적
let hasRouterError = false;

router.beforeEach(async (to: any, from: any, next: any) => {
    try {
        // 라우터 에러 상태가 있으면 강제 새로고침
        if (hasRouterError) {
            console.log('[라우터] 에러 상태 감지 - 페이지 새로고침 실행');
            hasRouterError = false;
            window.location.reload();
            return;
        }

        if (window.$mode !== 'uEngine') {
            if (to.fullPath.includes('/auth') || to.fullPath.includes('/external-forms')) {
                next();
            } else {
                if (window.$isTenantServer) {
                    if (!to.fullPath.includes('/tenant') && to.fullPath !== '/') {
                        return next('/tenant/manage');
                    } else if (to.fullPath === '/' || 
                        to.matched.some((record) => TenantRoutes.children.includes(record as any))) {
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
    hasRouterError = true;
});

// 전역 에러 핸들러로 Vue 컴포넌트 에러도 감지
window.addEventListener('unhandledrejection', (event) => {
    const errorMessage = event.reason?.message || event.reason?.toString() || '';
    
    // Supabase, 초기화, 파일 처리 관련 에러는 라우터 에러로 처리하지 않음
    if (errorMessage.includes('$supabase') || 
        errorMessage.includes('Cannot redefine property') ||
        errorMessage.includes('setupSupabase') ||
        errorMessage.includes('downloadFile') ||
        errorMessage.includes('uploadFile') ||
        errorMessage.includes('error in downloadFile') ||
        errorMessage.includes('400 (Bad Request)')) {
        console.warn('[전역] 초기화/파일처리 관련 에러 무시:', event.reason);
        return;
    }
    
    console.error('[전역] 처리되지 않은 Promise 에러:', event.reason);
    hasRouterError = true;
});

window.addEventListener('error', (event) => {
    const errorMessage = event.error?.message || event.error?.toString() || '';
    
    // Supabase, 초기화, 파일 처리 관련 에러는 라우터 에러로 처리하지 않음
    if (errorMessage.includes('$supabase') || 
        errorMessage.includes('Cannot redefine property') ||
        errorMessage.includes('setupSupabase') ||
        errorMessage.includes('downloadFile') ||
        errorMessage.includes('uploadFile') ||
        errorMessage.includes('error in downloadFile') ||
        errorMessage.includes('400 (Bad Request)')) {
        console.warn('[전역] 초기화/파일처리 관련 에러 무시:', event.error);
        return;
    }
    
    console.error('[전역] JavaScript 에러:', event.error);
    hasRouterError = true;
});

export default router;
