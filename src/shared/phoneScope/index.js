/**
 * 휴대폰에서는 「내 일」만 처리한다 — 관리 · 설계 · 분석은 PC에서 연다.
 *
 * 휴대폰 범위: 화면 폭 768px 이하(좁은 화면, 기기 폭)이고 Process GPT 모드일 때.
 * PAL · uEngine 은 메뉴 체계가 달라 그대로 둔다. 휴대폰에서 「PC 화면으로 보기(데스크톱 버전)」를 고르면
 * 폭이 1280px 이 되어 이 범위에서 벗어난다 — 모든 메뉴가 그대로 나온다.
 *
 * 메뉴를 숨기는 곳(사이드바 · 설정)과 주소를 막는 곳(라우터)이 같은 규칙을 쓰도록 여기 한 곳에 둔다.
 */

export const PHONE_MAX_WIDTH = 768;
export const DESKTOP_ONLY_PATH = '/desktop-only';

/**
 * 휴대폰에서 열지 않는 화면 — 관리 · 설계 · 분석.
 * 남기는 것: 홈(정의 체계도) · 프로세스 실행 화면(/definition-map/sub/*) · 할 일 · 인스턴스 · 대화 · 알림 · 설정(내 계정 · 화면).
 */
const DESKTOP_ONLY = [
    /^\/admin(\/|$|-)/,
    /^\/definitions(\/|-tree|$)/,
    /^\/forms\//,
    /^\/ui-definitions\//,
    /^\/dmn\//,
    /^\/business-rule/,
    /^\/definition-map\/(mega|major)\//,
    /^\/organization/,
    /^\/skills/,
    /^\/process-architecture/,
    /^\/process-hierarchy/,
    /^\/analytics/,
    /^\/analysis-dashboard/,
    /^\/dashboard/,
    /^\/instance-toplist/,
    /^\/strategy-board/,
    /^\/strategy\//,
    /^\/mining\//,
    /^\/knowledge/,
    /^\/review-board/,
    /^\/merge-requests/,
    /^\/my-feedback/,
    /^\/glossary/,
    /^\/ontology-explorer/,
    /^\/systems?$/,
    /^\/external-api-health/,
    /^\/policy-document/,
    /^\/call-activity-management/,
    /^\/work-assignment/,
    /^\/version-comparison/
];

/** 이 모드에서 휴대폰 범위를 쓰는가 (Process GPT · PAL 아님) */
export function phoneScopeMode(win = globalThis) {
    return !!win && !win.$pal && (win.$mode || 'ProcessGPT') === 'ProcessGPT';
}

/** 지금 휴대폰 범위인가 — 폭 768px 이하 + Process GPT 모드 */
export function inPhoneScope(win = globalThis) {
    const width = Number(win?.innerWidth);
    return phoneScopeMode(win) && Number.isFinite(width) && width > 0 && width <= PHONE_MAX_WIDTH;
}

/** 휴대폰에서 열지 않는 주소인가 */
export function isDesktopOnlyPath(path) {
    const p = String(path || '');
    return DESKTOP_ONLY.some((re) => re.test(p));
}

/** 휴대폰 범위에서 이 주소로 가면 어디로 보낼지. 그대로 가도 되면 null */
export function phoneRedirect(path, fullPath, win = globalThis) {
    if (!inPhoneScope(win) || !isDesktopOnlyPath(path)) return null;
    return { path: DESKTOP_ONLY_PATH, query: { from: fullPath || path } };
}
