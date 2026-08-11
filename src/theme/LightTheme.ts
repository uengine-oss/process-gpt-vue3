import { CLAUDE_THEME, SKY_THEME } from '@/ds/vuetify-bridge/theme';

/**
 * 색상 테마는 라이트 · 스카이 · 다크 세 가지다.
 *
 * Vuetify 테마 '이름' 은 기존 것을 그대로 쓴다. `src/utils/UpdateColors.ts` 가
 * actTheme 문자열을 99곳에서 이름으로 분기하고 있어서, 새 이름을 만들면
 * 그 분기들이 전부 폴백으로 떨어진다.
 *
 *   BLUE_THEME      → 라이트 (Claude 라이트 토큰)
 *   AQUA_THEME      → 스카이 (디자인 시스템 교체 이전의 원래 팔레트)
 *   DARK_BLUE_THEME → 다크   (DarkTheme.ts)
 *
 * 나머지 이름은 예전 설정이 localStorage 에 남아 있어도 깨지지 않도록 라이트를 가리킨다.
 */
const BLUE_THEME = { ...CLAUDE_THEME, name: 'BLUE_THEME' };
const AQUA_THEME = { ...SKY_THEME, name: 'AQUA_THEME' };
const PURPLE_THEME = { ...CLAUDE_THEME, name: 'PURPLE_THEME' };
const GREEN_THEME = { ...CLAUDE_THEME, name: 'GREEN_THEME' };
const CYAN_THEME = { ...CLAUDE_THEME, name: 'CYAN_THEME' };
const ORANGE_THEME = { ...CLAUDE_THEME, name: 'ORANGE_THEME' };

export { BLUE_THEME, AQUA_THEME, ORANGE_THEME, PURPLE_THEME, GREEN_THEME, CYAN_THEME };
