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
    // 첫 화면은 할 일 — 열자마자 내 차례가 보여야 한다.
    { path: '/', redirect: '/tasks' },

    {
        path: '/login',
        name: 'login',
        component: () => import('../views/LoginView.vue'),
        meta: { public: true }
    },

    // 아래 탭 다섯 칸(meta.tab). 그 밖의 화면은 탭 없이 전체 화면 + 뒤로.
    {
        path: '/tasks',
        name: 'tasks',
        component: () => import('../views/TasksView.vue'),
        meta: { tab: 'tasks' }
    },
    {
        path: '/tasks/:id',
        name: 'task',
        component: () => import('../views/TaskDetailView.vue')
    },
    {
        path: '/start',
        name: 'start',
        component: () => import('../views/StartView.vue')
    },
    {
        // 프로세스를 시작하기 전에 흐름·담당자·첫 입력을 확인하는 화면.
        path: '/start/:id',
        component: () => import('../views/ProcessStartView.vue')
    },
    {
        path: '/progress',
        name: 'progress',
        component: () => import('../views/ProgressView.vue'),
        meta: { tab: 'progress' }
    },
    // 옛 알림 링크 · 옛 「진행 중」 필터 주소
    { path: '/status', redirect: '/progress' },
    {
        path: '/instances/:id',
        name: 'instance',
        component: () => import('../views/InstanceView.vue')
    },
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
        path: '/notifications',
        name: 'notifications',
        component: () => import('../views/NotificationsView.vue'),
        meta: { tab: 'notifications' }
    },
    {
        path: '/me',
        name: 'me',
        component: () => import('../views/MeView.vue'),
        meta: { tab: 'me' }
    },

    // 알 수 없는 주소는 할 일로 보낸다. 알림 링크가 옛 형식이어도 앱이 빈 화면으로
    // 멈추지 않게.
    { path: '/:pathMatch(.*)*', redirect: '/tasks' }
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
        return { name: 'login', query: to.fullPath === '/tasks' ? {} : { next: to.fullPath } };
    });

    return router;
}
