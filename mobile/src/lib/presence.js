/**
 * 이 기기를 쓰고 있다고 알린다.
 *
 * 왜 필요한가
 *   알림을 어느 기기로 보낼지는 서버가 `user_devices.last_active_at` 하나로
 *   정한다 — 지금 쓰고 있는 기기가 있으면 거기로만, 아무 데도 없으면 가진
 *   기기 모두로. 메신저들이 하는 방식이다.
 *
 *   그래서 앱이 자기가 살아 있다고 말하지 않으면, 앱은 언제나 "안 쓰는 기기" 다.
 *   PC 로 웹을 켜 둔 사람은 휴대폰 알림을 영영 받지 못한다 — PC 만 활동 중으로
 *   보이기 때문이다.
 *
 * 언제 알리는가
 *   화면을 보고 있는 동안에만. 주머니 속에서 신호를 보내면 "쓰고 있다" 는 말이
 *   거짓이 되고, 그러면 PC 앞에 앉아 있어도 알림이 휴대폰으로 간다.
 *
 *   배경으로 내려가면 멈추고, 다시 열면 곧바로 한 번 알린 뒤 이어 간다.
 *
 * 얼마나 자주
 *   서버가 보는 창(10분)의 절반이 안전하다. 한 번 놓쳐도 아직 활동 중으로 남는다.
 */

export const HEARTBEAT_MS = 5 * 60 * 1000;

/**
 * 신호 보내기를 시작한다.
 *
 * 시간과 앱 상태를 직접 만지지 않고 받아서 쓴다 — 그래야 5분을 기다리지 않고
 * 시험할 수 있다.
 *
 * @param {object} deps
 *   touch        한 번 알리는 함수 (async)
 *   onAppState   (listener) => 떼어내는 함수. listener 는 (isActive) 를 받는다.
 *   setInterval  기본은 전역
 *   clearInterval
 *   every        간격(ms)
 * @returns {() => void} 멈추는 함수
 */
export function startPresence({
    touch,
    onAppState = null,
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

    const detach = onAppState
        ? onAppState((isActive) => {
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
 * Capacitor 의 앱 상태 변화를 위 규칙이 쓰는 모양으로 바꾼다.
 *
 * 브라우저에서는 상태 변화를 알 길이 없으므로 아무것도 하지 않는다 — 그때는
 * 신호가 계속 나가지만, 웹은 어차피 브라우저를 닫으면 멈춘다.
 */
export function appStateSource(win = globalThis) {
    const app = win?.Capacitor?.Plugins?.App;
    if (!app?.addListener) return null;

    return (listener) => {
        const handle = app.addListener('appStateChange', (state) => {
            listener(Boolean(state?.isActive));
        });

        return () => {
            try {
                if (handle && typeof handle.then === 'function') handle.then((h) => h?.remove?.());
                else handle?.remove?.();
            } catch (_e) {
                // 이미 떼어졌을 수 있다.
            }
        };
    };
}
