/**
 * 앱 전용 동작.
 *
 * 여기서 지키려는 것: **알림을 눌렀을 때 그 건으로 가는 것.**
 * 목록만 뜨면 사용자는 방금 알림이 어느 건이었는지 다시 찾아야 하고,
 * 그러면 알림을 받는 의미가 절반으로 준다.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { attachNativeBehaviour, consumeLaunchNotification, isNativeApp, routeForDeepLink, routeForNotification, routeForUrl } from './native.js';

// ---------------------------------------------------------------------------
// 알림 → 화면
// ---------------------------------------------------------------------------

test('업무 알림은 그 업무로 간다', () => {
    assert.equal(routeForNotification({ notification: { data: { task_id: 'todo-7' } } }), '/tasks/todo-7');
});

test('키 이름이 달라도 알아본다', () => {
    // 서버가 보내는 형태가 한 가지가 아니다.
    assert.equal(routeForNotification({ data: { taskId: 'todo-7' } }), '/tasks/todo-7');
    assert.equal(routeForNotification({ data: { todo_id: 'todo-7' } }), '/tasks/todo-7');
});

test('채팅 알림은 그 방으로 간다', () => {
    assert.equal(routeForNotification({ data: { chat_room_id: 'room-1' } }), '/chat/room-1');
});

test('업무가 채팅보다 먼저다', () => {
    // 둘 다 들어 있으면 할 일이 사용자가 눌러야 할 것에 더 가깝다.
    const route = routeForNotification({ data: { task_id: 't1', chat_room_id: 'r1' } });

    assert.equal(route, '/tasks/t1');
});

test('식별자에 특수문자가 있어도 주소가 깨지지 않는다', () => {
    assert.equal(routeForNotification({ data: { task_id: 'a/b c' } }), '/tasks/a%2Fb%20c');
});

test('모르는 알림은 목록으로 보낸다', () => {
    // 빈 화면보다 낫다.
    assert.equal(routeForNotification({ data: {} }), '/tasks');
    assert.equal(routeForNotification(null), '/tasks');
});

// ---------------------------------------------------------------------------
// 딥링크
// ---------------------------------------------------------------------------

test('딥링크의 해시 뒷부분이 갈 곳이다', () => {
    assert.equal(routeForDeepLink('https://app.example/#/tasks/todo-7'), '/tasks/todo-7');
});

test('해시가 없으면 목록으로 보낸다', () => {
    assert.equal(routeForDeepLink('https://app.example/tasks'), '/tasks');
    assert.equal(routeForDeepLink(''), '/tasks');
    assert.equal(routeForDeepLink(null), '/tasks');
});

test('경로처럼 보이지 않으면 목록으로 보낸다', () => {
    assert.equal(routeForDeepLink('https://app.example/#access_token=abc'), '/tasks');
});

// ---------------------------------------------------------------------------
// 붙이기
// ---------------------------------------------------------------------------

function fakeWin(pluginSet) {
    return {
        Capacitor: { isNativePlatform: () => true, Plugins: pluginSet }
    };
}

test('브라우저에서는 아무것도 붙이지 않는다', () => {
    let touched = false;
    const router = {
        push: () => {
            touched = true;
        }
    };

    const detach = attachNativeBehaviour(router, {});
    detach();

    assert.equal(touched, false);
});

test('알림을 누르면 그 화면으로 보낸다', () => {
    const pushed = [];
    const listeners = {};
    const win = fakeWin({
        PushNotifications: {
            addListener: (event, cb) => {
                listeners[event] = cb;
                return { remove() {} };
            }
        }
    });

    attachNativeBehaviour({ push: (r) => pushed.push(r) }, win);
    listeners.pushNotificationActionPerformed({ notification: { data: { task_id: 'todo-9' } } });

    assert.deepEqual(pushed, ['/tasks/todo-9']);
});

test('뒤로 갈 곳이 있으면 앱을 닫지 않는다', () => {
    // 기본 동작은 곧바로 종료다. 화면 하나 들어왔다가 나가려던 사용자가 앱을 잃는다.
    const listeners = {};
    let exited = false;
    let wentBack = false;
    const win = fakeWin({
        App: {
            addListener: (event, cb) => {
                listeners[event] = cb;
                return { remove() {} };
            },
            exitApp: () => {
                exited = true;
            }
        }
    });

    globalThis.window = { history: { length: 3 } };
    try {
        attachNativeBehaviour({ push: () => {}, back: () => { wentBack = true; } }, win);
        listeners.backButton();
    } finally {
        delete globalThis.window;
    }

    assert.equal(wentBack, true);
    assert.equal(exited, false);
});

test('더 뒤로 갈 곳이 없으면 앱을 닫는다', () => {
    const listeners = {};
    let exited = false;
    const win = fakeWin({
        App: {
            addListener: (event, cb) => {
                listeners[event] = cb;
                return { remove() {} };
            },
            exitApp: () => {
                exited = true;
            }
        }
    });

    globalThis.window = { history: { length: 1 } };
    try {
        attachNativeBehaviour({ push: () => {}, back: () => {} }, win);
        listeners.backButton();
    } finally {
        delete globalThis.window;
    }

    assert.equal(exited, true);
});

test('떼어낼 때 등록한 것을 정리한다', () => {
    // 안 떼면 화면을 옮길 때마다 쌓여, 알림 한 번에 여러 번 이동한다.
    let removed = 0;
    const win = fakeWin({
        PushNotifications: { addListener: () => ({ remove: () => { removed += 1; } }) },
        App: { addListener: () => ({ remove: () => { removed += 1; } }) }
    });

    const detach = attachNativeBehaviour({ push: () => {} }, win);
    detach();

    assert.equal(removed, 3);
});

test('플러그인이 없어도 터지지 않는다', () => {
    const detach = attachNativeBehaviour({ push: () => {} }, fakeWin({}));
    detach();
    assert.equal(isNativeApp(fakeWin({})), true);
});

// ---------------------------------------------------------------------------
// 알림을 눌렀을 때 어디로 가는가
//
// 서버는 포털(웹) 주소를 실어 보낸다. 앱 경로로 옮기지 않으면 무엇을 눌러도
// 늘 목록으로 갔다 — 알림을 받는 의미가 절반으로 준다.
// ---------------------------------------------------------------------------

test('업무 알림은 그 업무 처리 화면으로 간다', () => {
    assert.equal(
        routeForNotification({ data: { type: 'workitem_bpm', url: '/todolist/abc-123' } }),
        '/tasks/abc-123'
    );
});

test('채팅 알림은 그 대화방으로 간다', () => {
    assert.equal(
        routeForNotification({ data: { type: 'chat', url: '/chats?id=room-9' } }),
        '/chat/room-9'
    );
});

test('진행 현황 주소는 그 건의 단계 화면으로 간다', () => {
    assert.equal(routeForUrl('/instances/inst-1'), '/instances/inst-1');
});

test('절대 주소로 와도 경로만 본다', () => {
    assert.equal(routeForUrl('https://acme.process-gpt.io/todolist/t-1'), '/tasks/t-1');
});

test('알림 payload 는 notification.data 안에 들어오기도 한다', () => {
    assert.equal(
        routeForNotification({ notification: { data: { url: '/todolist/t-2' } } }),
        '/tasks/t-2'
    );
});

test('식별자에 특수문자가 있어도 주소가 깨지지 않는다', () => {
    assert.equal(routeForUrl('/todolist/a%2Fb'), '/tasks/a%2Fb');
});

test('종류만 알면 적어도 맞는 탭으로 보낸다', () => {
    assert.equal(routeForNotification({ data: { type: 'chat' } }), '/chat');
});

test('아무것도 모르면 할 일 목록. 빈 화면보다 낫다', () => {
    assert.equal(routeForNotification({ data: {} }), '/tasks');
    assert.equal(routeForNotification(null), '/tasks');
});

test('모르는 주소는 억지로 해석하지 않는다', () => {
    assert.equal(routeForUrl('/definition-map'), null);
    assert.equal(routeForUrl(''), null);
});

test('서버가 나중에 식별자를 직접 실어도 동작한다', () => {
    assert.equal(routeForNotification({ data: { task_id: 't-9' } }), '/tasks/t-9');
    assert.equal(routeForNotification({ data: { chat_room_id: 'r-9' } }), '/chat/r-9');
    assert.equal(routeForNotification({ data: { proc_inst_id: 'i-9' } }), '/instances/i-9');
});

test('앱이 꺼진 채 알림을 누르면 실행 인텐트에서 꺼내 그 화면으로 간다', async () => {
    const pushed = [];
    const win = {
        Capacitor: {
            isNativePlatform: () => true,
            Plugins: {
                PushSupport: {
                    consumeLaunchNotification: async () => ({
                        found: true,
                        data: { url: '/todolist/t-77', type: 'workitem_bpm' }
                    })
                }
            }
        }
    };
    const route = await consumeLaunchNotification({ replace: (r) => pushed.push(r) }, win);
    assert.equal(route, '/tasks/t-77');
    assert.deepEqual(pushed, ['/tasks/t-77']);
});

test('알림으로 켠 것이 아니면 아무 데도 보내지 않는다', async () => {
    const pushed = [];
    const win = {
        Capacitor: {
            Plugins: { PushSupport: { consumeLaunchNotification: async () => ({ found: false }) } }
        }
    };
    assert.equal(await consumeLaunchNotification({ replace: (r) => pushed.push(r) }, win), null);
    assert.deepEqual(pushed, []);
});

test('브라우저에서는 아무것도 하지 않는다', async () => {
    assert.equal(await consumeLaunchNotification({ replace: () => {} }, {}), null);
});
