import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router';
import { currentSession } from '../lib/session.js';

/**
 * 앱 안에서의 화면 이동.
 *
 * 주소 방식(history) 대신 해시(#)를 쓴다. Capacitor 는 페이지를 file:// 이나
 * localhost 로 띄우므로 서버가 없다. history 방식이면 새로고침하거나 알림에서
 * 특정 화면으로 들어올 때 "그 경로에 파일이 없다" 로 끝난다.
 */

const routes: RouteRecordRaw[] = [
    { path: '/', redirect: '/chat' },

    {
        path: '/login',
        name: 'login',
        component: () => import('../views/LoginView.vue'),
        meta: { public: true }
    },

    {
        path: '/tasks',
        name: 'tasks',
        component: () => import('../views/TasksView.vue'),
        meta: { tab: 'tasks' }
    },
    {
        path: '/tasks/:id',
        name: 'task',
        component: () => import('../views/TaskDetailView.vue'),
        meta: { tab: 'tasks' }
    },
    {
        path: '/start',
        name: 'start',
        component: () => import('../views/StartView.vue'),
        meta: { tab: 'tasks' }
    },
    // 진행 현황은 할 일 탭의 필터로 들어갔다. 옛 알림 링크가 이 주소로 와도
    // 빈 화면이 되지 않게 넘겨 준다.
    {
        // 프로세스를 시작하기 전에 흐름·담당자·첫 입력을 확인하는 화면.
        path: '/start/:id',
        component: () => import('../views/ProcessStartView.vue'),
        meta: { tab: 'tasks' }
    },
    { path: '/status', redirect: '/tasks?view=running' },
    {
        path: '/chat',
        name: 'chat',
        component: () => import('../views/ChatView.vue'),
        meta: { tab: 'chat' }
    },
    {
        // :id 보다 먼저 와야 한다. 뒤에 두면 'history' 가 방 식별자로 잡힌다.
        path: '/chat/history',
        name: 'chat-history',
        component: () => import('../views/ChatHistoryView.vue'),
        meta: { tab: 'chat' }
    },
    {
        path: '/chat/:id',
        name: 'chat-room',
        component: () => import('../views/ChatRoomView.vue'),
        meta: { tab: 'chat' }
    },
    {
        path: '/instances/:id',
        name: 'instance',
        component: () => import('../views/InstanceView.vue'),
        meta: { tab: 'tasks' }
    },
    {
        path: '/me',
        name: 'me',
        component: () => import('../views/MeView.vue'),
        meta: { tab: 'me' }
    },

    // 알 수 없는 주소는 할 일로 보낸다. 알림 링크가 옛 형식이어도 앱이 빈 화면으로
    // 멈추지 않게.
    { path: '/:pathMatch(.*)*', redirect: '/chat' }
];

export function createMobileRouter() {
    const router = createRouter({
        history: createWebHashHistory(),
        routes,
        scrollBehavior: () => ({ top: 0 })
    });

    router.beforeEach(async (to) => {
        if (to.meta?.public) return true;

        const session = await currentSession();
        if (session) return true;

        // 로그인 후 원래 가려던 곳으로 돌려보낸다. 알림을 눌러 들어왔는데 로그인이
        // 풀려 있으면, 로그인 후 목록이 아니라 그 건으로 가야 한다.
        return { name: 'login', query: to.fullPath === '/chat' ? {} : { next: to.fullPath } };
    });

    return router;
}
