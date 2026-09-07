/**
 * 배너를 띄울 곳을 알려 준다.
 *
 * 알림을 받는 곳(시작점)과 배너를 그리는 곳(App.vue)이 서로 다르다.
 * 둘을 직접 잇기 어려워, 화면이 뜰 때 자기 자신을 여기에 맡겨 둔다.
 */

let host = null;

export function setBannerHost(next) {
    host = next || null;
}

export function showBanner(banner) {
    if (!banner) return false;
    host?.show?.(banner);
    return Boolean(host);
}
