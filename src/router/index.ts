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

router.beforeEach(async (to: any, from: any, next: any) => {
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
});

export default router;
