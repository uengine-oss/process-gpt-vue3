import { createRouter, createWebHistory } from 'vue-router';
import MainRoutes from './MainRoutes';
import AuthRoutes from './AuthRoutes';
import TenantRoutes from './TenantRoutes';
import BackendFactory from '@/components/api/BackendFactory';

export const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [
        {
            path: '/:pathMatch(.*)*',
            component: () => import('@/views/authentication/Error.vue')
        },
        MainRoutes,
        AuthRoutes,
        TenantRoutes
    ]
});

router.beforeEach(async (to, from, next) => {
    const backend = BackendFactory.createBackend();

    if (window.$mode !== 'uEngine') {
        const subdomain = window.location.host.split('.')[0];
        if(subdomain == 'www' || subdomain == 'process-gpt') {
            Object.defineProperty(window, '$isTenantServer', {
                value: true,
                writable: false,
                configurable: true
            });
        } else if(window.location.host.includes('localhost') || 
            window.location.host.includes('192.168') || 
            window.location.host.includes('127.0.0.1')
        ) {
            Object.defineProperty(window, '$isTenantServer', {
                value: false,
                writable: false,
                configurable: true
            });
            Object.defineProperty(window, '$tenantName', {
                value: 'localhost',
                writable: false,
                configurable: false
            });
        } else {
            const isValidTenant = await backend.getTenant(subdomain);
            if (!isValidTenant) {
                alert("존재하지 않는 경로입니다.");
                window.location.href = 'https://www.process-gpt.io/tenant/manage';
                return;
            } else {
                Object.defineProperty(window, '$isTenantServer', {
                    value: false,
                    writable: false,
                    configurable: true
                });
                Object.defineProperty(window, '$tenantName', {
                    value: subdomain,
                    writable: false,
                    configurable: false
                });
            }
        }
        // redirect to login page if not logged in and trying to access a restricted page
        let isLogin = false;
        if (window.$isTenantServer) {
            isLogin = await backend.checkDBConnection();
        } else {
            isLogin = await backend.setTenant(window.$tenantName) ?? false;
        }

        if (to.fullPath.includes('/auth')) {
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
