/**
 * 휴대폰 브라우저에서 어떤 화면으로 열지(데스크톱 / 라이트), 그리고 홈 화면에 추가.
 *
 * 화면 폭을 정하는 규칙은 index.html 의 window.__pgptViewport 한 곳에 있다(첫 렌더 전에 정해야 해서).
 * 여기서는 그 규칙을 읽어 "물어볼까", "다시 불러와야 하나", "어떻게 추가하라고 안내할까"를 정한다.
 *
 * - 기본은 데스크톱 화면(폭 1280px 로 그린 뒤 줄임 — PC와 같은 화면)이다(2026-11-11 결정 D-1111-09).
 * - 라이트 버전(mobileView=light)을 고르면 휴대폰 웹(/m/ — 할 일 · 진행 · AI · 알림 · 나)으로 연다.
 * - 고른 값은 그 기기에 남는다. 바꾸는 곳은 설정 › 테마 설정 「휴대폰 화면」과 휴대폰 웹 「나」 탭(「PC 화면으로 보기」).
 * - 홈 화면에 앱으로 추가하지 않은 휴대폰에는 맨 위에 「홈 화면에 추가」 띠를 보인다. 「다시 보지 않기」를 누르면
 *   그 기기에서는 다시 보이지 않는다(웹으로 계속 쓰겠다는 뜻이다).
 */

export const MOBILE_VIEWS = ['desktop', 'light'];

export function viewportApi(win = globalThis) {
    return win?.__pgptViewport || null;
}

/** 저장된 답: 'desktop' | 'light' | null(고르지 않음 — 데스크톱 화면과 같다) */
export function savedMobileView(win = globalThis) {
    const v = viewportApi(win)?.view?.() ?? null;
    return MOBILE_VIEWS.includes(v) ? v : null;
}

export function isPhoneBrowser(win = globalThis) {
    return !!viewportApi(win)?.isPhoneBrowser?.();
}

/**
 * 이 경로로 가려면 화면 폭을 바꿔야 하는가.
 * 폭은 첫 렌더 전에만 정할 수 있으므로(화면마다 처음 그릴 때 폭을 읽는다) 바뀌면 그 주소를 새로 연다.
 * 예: 로그인(기기 폭) → 정의 체계도(데스크톱 폭).
 */
export function needsViewportReload(path, win = globalThis) {
    const api = viewportApi(win);
    if (!api) return false;
    return api.wantsDesktop(path) !== api.desktop;
}

/**
 * 휴대폰 화면(라이트)을 고른 휴대폰이면 앱 화면은 휴대폰 웹(/m/#/…)으로 연다. 옮길 주소 또는 null.
 * 규칙(포털 주소 → 휴대폰 주소)은 index.html 의 window.__pgptViewport 한 곳에 있다 —
 * 첫 렌더 전에는 index.html 이, 앱 안에서 옮겨 갈 때(로그인 뒤 등)는 라우터가 이것으로 같은 규칙을 쓴다.
 */
export function phoneWebUrl(path, win = globalThis) {
    return viewportApi(win)?.phoneWebUrl?.(path) || null;
}

/**
 * 답을 저장한다. 지금 화면의 폭이 바뀌어야 하면 reload: true 를 돌려준다(부르는 쪽이 새로 연다).
 * 휴대폰이 아닌 기기에서는 저장만 하고 폭은 그대로다.
 */
export function saveMobileView(view, win = globalThis) {
    if (!MOBILE_VIEWS.includes(view)) throw new Error(`알 수 없는 화면: ${view}`);
    const api = viewportApi(win);
    try {
        win.localStorage.setItem(api?.KEY || 'mobileView', view);
    } catch (_e) {
        // 저장하지 못하면 다음에 다시 묻는다.
    }
    const path = win.location?.pathname || '/';
    return { reload: !!api && api.wantsDesktop(path) !== api.desktop };
}

/**
 * 데스크톱 폭으로 줄여 그린 화면에서 대화상자를 휴대폰 글자 크기로 보이게 할 배율.
 * 확대(핀치)하면 그만큼 작게 잡는다. 기기 폭 화면에서는 1.
 */
export function phoneZoom(win = globalThis) {
    const api = viewportApi(win);
    const scale = win?.visualViewport?.scale;
    if (!api?.desktop || !scale) return 1;
    return Math.min(4, Math.max(1, 1 / scale));
}

/** 「홈 화면에 추가」 띠를 다시 보지 않기로 했는가 — 그 기기의 브라우저에 남긴다 */
export const INSTALL_BAR_KEY = 'installBarHidden';

/**
 * 맨 위에 「홈 화면에 추가」 띠를 보일까.
 * 휴대폰 브라우저이고, 홈 화면에서 연 앱이 아니고, 「다시 보지 않기」를 누른 적이 없을 때만.
 * phone 을 주지 않으면 index.html 의 규칙(Process GPT 모드의 휴대폰 브라우저)으로 판단한다 — 휴대폰 웹(/m/)은
 * 그 규칙이 없어 직접 넘긴다.
 */
export function shouldShowInstallBar(win = globalThis, { phone } = {}) {
    const api = viewportApi(win);
    const onPhone = phone ?? (!!api?.isEnabled?.() && !!api?.isPhoneBrowser?.());
    if (!onPhone || isStandalone(win)) return false;
    try {
        return win.localStorage.getItem(INSTALL_BAR_KEY) !== '1';
    } catch (_e) {
        return true;
    }
}

/** 「다시 보지 않기」 */
export function hideInstallBar(win = globalThis) {
    try {
        win.localStorage.setItem(INSTALL_BAR_KEY, '1');
    } catch (_e) {
        // 저장하지 못하면 다음에 다시 보인다.
    }
}

/** 이미 홈 화면에서 앱처럼 열려 있는가 */
export function isStandalone(win = globalThis) {
    const media = win?.matchMedia?.('(display-mode: standalone)');
    return !!(media && media.matches) || win?.navigator?.standalone === true;
}

/**
 * 홈 화면에 추가하는 방법.
 *   prompt  — 브라우저가 설치 창을 띄워 준다(안드로이드 크롬 · 엣지 · 데스크톱 크롬)
 *   ios     — 사파리 공유 단추 › 「홈 화면에 추가」 (iOS 는 설치 창을 띄울 수 없다)
 *   android — 브라우저 메뉴 › 「홈 화면에 추가」 또는 「앱 설치」
 *   desktop — 주소창의 설치 아이콘 또는 브라우저 메뉴
 */
export function installGuide({ userAgent = '', maxTouchPoints = 0, canPrompt = false } = {}) {
    if (canPrompt) return 'prompt';
    if (/iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && maxTouchPoints > 1)) return 'ios';
    if (/Android/i.test(userAgent)) return 'android';
    return 'desktop';
}
