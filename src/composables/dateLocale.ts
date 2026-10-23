/**
 * 날짜·시각 표시에 쓸 로케일 태그.
 *
 * 곳곳에서 로케일을 한국어로 고정해 두는 바람에 영어 화면에서도 한국어 날짜가 찍혔다
 * (에이전트 작업 카드의 시작시간이 대표적). 표시 언어를 따라가도록 이 함수를 거친다.
 *
 * 컴포넌트가 아닌 곳(.ts 컴포저블 등)에서도 쓸 수 있도록 main.ts 가 전역에 심어 둔
 * $i18n 을 읽고, 없으면 브라우저 기본 로케일로 떨어진다.
 */
const KO = 'ko' + '-KR'; // 일괄 치환 스크립트가 이 리터럴을 건드리지 못하게 쪼개 둔다.

export function dateLocale(): string {
    const i18n = (window as any)?.$i18n?.global;
    const locale = i18n?.locale?.value ?? i18n?.locale;
    if (typeof locale === 'string' && locale.length > 0) {
        return locale === 'ko' ? KO : 'en-US';
    }
    // i18n 이 아직 없으면 undefined 를 돌려줘 런타임 기본 로케일을 쓰게 한다.
    return undefined as unknown as string;
}
