import { createRouter, createWebHistory } from 'vue-router';
import MainRoutes from './MainRoutes';
import AuthRoutes from './AuthRoutes';
import { useAuthStore } from '@/stores/auth';

import CommonStorageBase from "@/components/storage/CommonStorageBase";

export const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [
        {
            path: '/:pathMatch(.*)*',
            component: () => import('@/views/authentication/Error.vue')
        },
        MainRoutes,
        AuthRoutes
    ]
});

router.beforeEach(async (to, from, next) => {
    // redirect to login page if not logged in and trying to access a restricted page
    const publicPages = ['/'];
    const authRequired = !publicPages.includes(to.path);
    const auth: any = useAuthStore();

    const storage = new CommonStorageBase(this);
    await storage.loginUser();   

    if (to.matched.some((record) => record.meta.requiresAuth)) {
        if (authRequired && !storage.isLogin) {
            auth.returnUrl = to.fullPath;
            // return next('/');
            alert("로그인이 필요합니다.")
        } else next();
    } else {
        next();
    }
});

// router.beforeEach(async (to, from, next) => {
//     const storage = new CommonStorageBase(this);
//     await storage.loginUser();    
    
//     if (to.matched.some(record => record.meta.requiresAuth)) {
//         if (storage.isLogin) {
//             next();
//         } else {
//             next('/');
//         }
//     } else {
//         next();
//     }
// });

export default router;
