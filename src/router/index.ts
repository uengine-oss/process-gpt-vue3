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
            if(window.location.pathname == '/auth/register'){
                alert("계정 인증 메일을 전송해드렸습니다. 이메일 확인 후 다시 로그인하세요.");
            } else {
                alert("로그인이 필요합니다.")
            }
            return next('/auth/login');
        } else next();
    } else {
        next();
    }
});

export default router;
