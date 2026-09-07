/**
 * 앱에서 "지금 이 기기를 쓰고 있는가".
 *
 * 신호를 언제 보낼지는 웹과 한 벌이다(@/shared/presence). 여기서 정하는 것은
 * 앱에서만 알 수 있는 것 하나뿐이다 — 화면을 보고 있는가, 주머니 속인가.
 *
 * 주머니 속에서 "쓰고 있다" 고 말하면 PC 앞에 앉아 있어도 알림이 휴대폰으로
 * 간다. 반대로 아무 말도 하지 않으면 앱은 언제나 "안 쓰는 기기" 라서, PC 로
 * 웹을 켜 둔 사람은 휴대폰 알림을 영영 받지 못한다.
 */

export { HEARTBEAT_MS, startPresence } from '../../../src/shared/presence/index.js';

/**
 * Capacitor 의 앱 상태 변화를 startPresence 가 쓰는 모양으로 바꾼다.
 *
 * 브라우저에서는 상태 변화를 알 길이 없으므로 아무것도 돌려주지 않는다 —
 * 그때는 신호가 계속 나가지만, 웹은 브라우저를 닫으면 어차피 멈춘다.
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
