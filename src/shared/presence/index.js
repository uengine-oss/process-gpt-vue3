/**
 * 이 기기를 지금 쓰고 있는가.
 *
 * 왜 필요한가
 *   알림을 어느 기기로 보낼지는 서버가 `user_devices.last_active_at` 하나로
 *   정한다 — 쓰고 있는 기기가 있으면 거기로만, 아무 데도 없으면 가진 기기
 *   모두로. 메신저들이 하는 방식이다.
 *
 *   그래서 화면은 쓰이고 있는 동안 자기가 살아 있다고 말해야 한다. 말하지
 *   않으면 그 기기는 언제나 "안 쓰는 기기" 다.
 *
 * 웹과 앱이 같은 규칙을 써야 한다
 *   PC 앞에 앉아 있는데 휴대폰이 울리거나, 반대로 PC 를 덮어 뒀는데 아무 데도
 *   안 오는 일을 막으려면 양쪽이 같은 기준으로 "쓰고 있다" 를 말해야 한다.
 *   신호를 언제 보낼지(아래 startPresence)는 공용이고, "지금 쓰고 있는가" 를
 *   판단하는 방법만 환경마다 다르다(앱은 전경/배경, 웹은 탭과 사람의 조작).
 */

/**
 * 얼마나 자주 알리는가.
 *
 * 서버가 보는 창(10분)의 절반보다 짧아야 한다. 한 번 놓쳐도 아직 활동 중으로
 * 남는다.
 */
export const HEARTBEAT_MS = 5 * 60 * 1000;

/**
 * 사람이 손을 뗀 것으로 볼 시간.
 *
 * 탭이 떠 있다고 앞에 앉아 있는 것은 아니다. 잠긴 화면에서도 탭은 계속 보인다.
 * 그 상태를 "쓰고 있다" 로 세면 PC 를 켜 둔 채 자리를 비운 사람은 휴대폰
 * 알림을 못 받는다.
 */
export const IDLE_MS = 2 * 60 * 1000;

/**
 * 신호 보내기를 시작한다.
 *
 * 시간과 활동 판단을 직접 만지지 않고 받아서 쓴다 — 그래야 5분을 기다리지 않고
 * 시험할 수 있다.
 *
 * @param {object} deps
 *   touch          한 번 알리는 함수 (async 가능)
 *   onActiveChange (listener) => 떼어내는 함수. listener 는 (isActive) 를 받는다.
 *   setInterval / clearInterval  기본은 전역
 *   every          간격(ms)
 * @returns {() => void} 멈추는 함수
 */
export function startPresence({
    touch,
    onActiveChange = null,
    setInterval: setEvery = globalThis.setInterval,
    clearInterval: clearEvery = globalThis.clearInterval,
    every = HEARTBEAT_MS
} = {}) {
    if (typeof touch !== 'function') return () => {};

    let timer = null;

    const beat = () => {
        // 실패는 삼킨다. 신호 하나 못 보낸 것으로 화면이 멈추면 안 된다 —
        // 다음 회차에 다시 보낸다.
        try {
            const result = touch();
            if (result && typeof result.catch === 'function') result.catch(() => {});
        } catch (_e) {
            // 위와 같다.
        }
    };

    const run = () => {
        if (timer !== null) return;
        beat();
        timer = setEvery(beat, every);
    };

    const halt = () => {
        if (timer === null) return;
        clearEvery(timer);
        timer = null;
    };

    run();

    const detach = onActiveChange
        ? onActiveChange((isActive) => {
              if (isActive) run();
              else halt();
          })
        : null;

    return () => {
        halt();
        try {
            detach?.();
        } catch (_e) {
            // 떼어내기 실패가 종료를 막을 이유는 없다.
        }
    };
}

/**
 * 브라우저에서 "지금 쓰고 있는가".
 *
 * 두 가지를 모두 본다.
 *   1. 탭이 보이는가 (`visibilitychange`)
 *   2. 사람이 최근에 무언가 했는가 (누르기 · 움직이기 · 자판 · 스크롤)
 *
 * 탭만 보면 잠긴 화면도 "쓰고 있다" 가 된다. 그러면 PC 를 켜 둔 채 자리를 비운
 * 사람에게는 휴대폰 알림이 가지 않는다. 조작만 보면 반대로, 다른 창에서 일하는
 * 동안에도 이 탭이 활동 중이라고 말하게 된다.
 *
 * @returns {(listener: (isActive: boolean) => void) => () => void}
 */
export function browserActivitySource(win = globalThis, { idleMs = IDLE_MS } = {}) {
    const doc = win?.document;
    if (!doc?.addEventListener) return null;

    return (listener) => {
        let lastInput = Date.now();
        let active = true;
        let idleTimer = null;

        const visible = () => doc.visibilityState !== 'hidden';

        const tell = (next) => {
            if (next === active) return;
            active = next;
            listener(next);
        };

        const armIdle = () => {
            if (idleTimer !== null) win.clearTimeout(idleTimer);
            idleTimer = win.setTimeout(() => tell(false), idleMs);
        };

        const onInput = () => {
            lastInput = Date.now();
            if (visible()) tell(true);
            armIdle();
        };

        const onVisibility = () => {
            if (!visible()) {
                tell(false);
                return;
            }
            // 돌아왔다. 사람이 방금 창을 띄운 것이므로 조작으로 친다.
            onInput();
        };

        const events = ['pointerdown', 'keydown', 'wheel', 'scroll', 'mousemove'];
        for (const name of events) doc.addEventListener(name, onInput, { passive: true });
        doc.addEventListener('visibilitychange', onVisibility);

        armIdle();

        return () => {
            for (const name of events) doc.removeEventListener(name, onInput);
            doc.removeEventListener('visibilitychange', onVisibility);
            if (idleTimer !== null) win.clearTimeout(idleTimer);
        };
    };
}
