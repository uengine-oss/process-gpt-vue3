/**
 * 로그인한 사람이 처음 닿는 화면.
 *
 * 모바일(폭 768px 이하 — main.ts 의 $globalIsMobile 과 같은 기준)에서는 **언제나 정의 체계도**다.
 * 프로세스 체계도는 조직 전체를 펼친 큰 트리라 휴대폰 화면에서는 읽을 수도 다룰 수도 없다.
 * 데스크톱은 지금처럼 프로세스 체계도로 간다.
 *
 * 첫 화면을 정하는 곳(로그인 뒤 이동 · SSO · 조직 선택/생성 · 랜딩의 시작하기 · 루트 주소)은
 * 모두 이 함수를 쓴다. 한 곳이라도 '/process-architecture' 를 직접 적으면 모바일에서 그
 * 경로로 들어온 사람만 다른 첫 화면을 보게 된다.
 *
 * 모바일 앱도 화면을 정하지 않고 조직 주소의 루트만 연다 — 어디로 갈지는 여기서 정한다.
 */
export const MOBILE_HOME = '/definition-map';
export const DESKTOP_HOME = '/process-architecture';

export function isMobileViewport(): boolean {
    return typeof window !== 'undefined' && window.innerWidth <= 768;
}

export function homePath(): string {
    return isMobileViewport() ? MOBILE_HOME : DESKTOP_HOME;
}
