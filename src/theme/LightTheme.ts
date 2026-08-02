import { CLAUDE_THEME } from '@/ds/vuetify-bridge/theme';

/**
 * 디자인 시스템 교체 이후 라이트 팔레트는 하나다.
 * 색상 테마 선택지는 라이트 · 다크 · 자율선택(강조색 직접 지정) 세 가지이고,
 * 자율선택은 별도 테마가 아니라 이 팔레트의 강조색만 바꾼다.
 *
 * Vuetify 테마 '이름' 은 기존 것을 그대로 쓴다. `src/utils/UpdateColors.ts` 가
 * actTheme 문자열을 99곳에서 이름으로 분기하고 있어서, 새 이름을 만들면
 * 그 분기들이 전부 폴백으로 떨어진다.
 *
 *   BLUE_THEME      → 라이트모드(기본)
 *   DARK_BLUE_THEME → 다크모드 (DarkTheme.ts)
 *
 * 나머지 이름은 예전 설정이 localStorage 에 남아 있어도 깨지지 않도록 기본값을 가리킨다.
 * 색 값의 출처는 `src/ds/styles/tokens.css` 이며 `ds/vuetify-bridge/theme.ts` 가 옮겨 담는다.
 */
const BLUE_THEME = { ...CLAUDE_THEME, name: 'BLUE_THEME' };
const AQUA_THEME = { ...CLAUDE_THEME, name: 'AQUA_THEME' };
const PURPLE_THEME = { ...CLAUDE_THEME, name: 'PURPLE_THEME' };
const GREEN_THEME = { ...CLAUDE_THEME, name: 'GREEN_THEME' };
const CYAN_THEME = { ...CLAUDE_THEME, name: 'CYAN_THEME' };
const ORANGE_THEME = { ...CLAUDE_THEME, name: 'ORANGE_THEME' };

export { BLUE_THEME, AQUA_THEME, ORANGE_THEME, PURPLE_THEME, GREEN_THEME, CYAN_THEME };
