import { createRouter, createWebHistory } from 'vue-router';
import MainRoutes from './MainRoutes';
import AuthRoutes from './AuthRoutes';

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
    const isLogin = localStorage.getItem("accessToken") ? true : false;

    if (to.matched.some((record) => record.meta.requiresAuth)) {
        if (authRequired && !isLogin) {
            alert("로그인이 필요합니다.")
            return next('/auth/login');
        } else next();
    } else {
        next();
    }
});

export default router;
