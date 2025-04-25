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
        TenantRoutes
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
                if (to.fullPath.includes('/tenant')) {
                    return next('/');
                }
            }
        }
    }

    next();
});

export default router;
