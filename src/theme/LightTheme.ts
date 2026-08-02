import { CLAUDE_THEME } from '@/ds/vuetify-bridge/theme';

/**
 * 디자인 시스템 교체 이후 라이트 테마는 하나다.
 *
 * 예전에는 BLUE/AQUA/PURPLE/GREEN/CYAN/ORANGE 6종의 Material 팔레트를 두고
 * Customizer 에서 고르게 했지만, 새 디자인 시스템은 단일 언어(라이트/다크)라
 * 여섯 이름 모두 같은 팔레트를 가리킨다.
 *
 * 이름을 남겨둔 이유는 `src/utils/UpdateColors.ts`, `Customizer.vue`,
 * `stores/customizer.ts` 등이 이 상수들을 이름으로 참조하기 때문이다.
 * 색 값의 출처는 `src/ds/styles/tokens.css` 이며 `ds/vuetify-bridge/theme.ts` 가 옮겨 담는다.
 */
const BLUE_THEME = { ...CLAUDE_THEME, name: 'BLUE_THEME' };
const AQUA_THEME = { ...CLAUDE_THEME, name: 'AQUA_THEME' };
const PURPLE_THEME = { ...CLAUDE_THEME, name: 'PURPLE_THEME' };
const GREEN_THEME = { ...CLAUDE_THEME, name: 'GREEN_THEME' };
const CYAN_THEME = { ...CLAUDE_THEME, name: 'CYAN_THEME' };
const ORANGE_THEME = { ...CLAUDE_THEME, name: 'ORANGE_THEME' };

export { BLUE_THEME, AQUA_THEME, ORANGE_THEME, PURPLE_THEME, GREEN_THEME, CYAN_THEME };
