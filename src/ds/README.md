# Process GPT 디자인 시스템 (`Pg*`)

Vuetify 를 대체하기 위한 자체 디자인 시스템. 스타일 원본은
`claude-capture/` 에서 claude.ai 라이브 DOM 의 computed style · CSS custom property 를
실측해 재구축한 토큰이다.

## 구성

```
src/ds/
  styles/
    tokens.css   디자인 토큰 (색·타이포·형태·모션, 라이트 + 다크)
    base.css     리셋 + 기본 타이포그래피 + 최소 유틸리티
    motion.css   원본 @keyframes 기반 모션 레이어
    index.css    위 3개를 순서대로 import
  components/    Pg* 컴포넌트 31개
  mode.ts        라이트/다크 전환
  index.ts       전역 등록 플러그인
```

`main.ts` 에서 한 번 등록하면 모든 `Pg*` 를 전역으로 쓸 수 있다.

```ts
import designSystem, { initMode } from '@/ds';
initMode();
app.use(designSystem);
```

## Vuetify 와 근본적으로 다른 점

**런타임 테마 객체가 없다.** Vuetify 는 12개 테마를 JS 객체로 들고 다니며
(`src/theme/LightTheme.ts`, `src/plugins/vuetify.ts`) 런타임에 색을 계산한다.
여기서는 색·타이포·형태가 전부 CSS custom property 라서 테마 전환이 속성 하나다.

```ts
import { setMode, toggleMode } from '@/ds';
setMode('dark');   // <html data-mode="dark">
setMode('system'); // 속성 제거 → prefers-color-scheme 를 따름
```

## 토큰

| 축 | 대표 토큰 |
|---|---|
| 표면 | `--cds-surface-0` 앱 배경 · `--cds-surface-1` 살짝 올라온 면 · `--cds-surface-2` 카드/컴포저 |
| 텍스트 | `--cds-text-primary` · `-secondary` · `-muted` · `-accent` · `-danger` · `-success` · `-warning` |
| 선 | `--cds-border` · `-strong` · `-stronger` (전부 0.5px 헤어라인 전제) |
| 상태 배경 | `--cds-bg-neutral` · `-accent` · `-success` · `-warning` · `-danger` |
| 브랜드 | `hsl(var(--accent-brand))` ≈ `#d97757` |
| 타이포 | `--cds-font-sans` UI · `--cds-font-voice` 응답 본문(세리프) · `--cds-font-mono` 코드 |
| 형태 | `--cds-radius--xs|--sm|base|--lg` · `--cds-radius-bubble` 12px · `--cds-radius-composer` 20px |
| 모션 | `--cds-ease-out` · `--cds-ease-snap` · `--cds-ease-overshoot` |
| 레이아웃 | `--app-sidebar-w` 272px · `--app-content-max` 768px · `--row-h` 32px |

> 원본 캡처에는 다크 모드의 상태색(`--cds-bg-accent/success/warning/danger`,
> `--cds-text-success/warning`)이 없었다. 라이트값을 그대로 두면 다크에서 대비가
> 무너지므로 `tokens.css` 에서 보강했다.

## 컴포넌트

| 분류 | 컴포넌트 |
|---|---|
| 코어 | `PgButton` `PgIcon` `PgSpinner` `PgCard` `PgChip` `PgDivider` `PgAvatar` `PgSkeleton` `PgProgress` |
| 폼 | `PgField` `PgTextField` `PgTextarea` `PgSelect` `PgCheckbox` `PgSwitch` `PgRadioGroup` |
| 오버레이·네비 | `PgDialog` `PgMenu` `PgMenuItem` `PgTooltip` `PgTabs` `PgAlert` `PgListItem` `PgTable` |
| 앱 셸 | `PgAppShell` |
| 대화 | `PgThread` `PgMessage` `PgComposer` `PgCodeBlock` `PgToolStep` `PgToolSteps` |

전부 `/design-system` 라우트에서 확인할 수 있다.

`PgIcon` 은 MDI 웹폰트를 쓴다. `index.html` 이 이미 `materialdesignicons.min.css` 를
로드하므로 새 의존성이 없고, 기존 코드의 `mdi-account` 같은 이름을 그대로 받는다.

## 마이그레이션 대응표

| Vuetify | 대체 | 비고 |
|---|---|---|
| `v-btn` | `PgButton` | `color="primary"` → `variant="primary"`, `icon` → `icon` |
| `v-icon` | `PgIcon` | 슬롯 대신 `:name` |
| `v-card` `v-card-title` `v-card-text` `v-card-actions` | `PgCard` | `title` prop + `#footer` 슬롯 |
| `v-text-field` | `PgTextField` | `:rules` 대신 `:error` 문자열 |
| `v-textarea` | `PgTextarea` | `auto-grow` 동일 |
| `v-select` `v-autocomplete` | `PgSelect` | `:items` 는 문자열 또는 `{label,value}` |
| `v-checkbox` `v-switch` `v-radio-group` | `PgCheckbox` `PgSwitch` `PgRadioGroup` | |
| `v-dialog` | `PgDialog` | `persistent` 동일 |
| `v-menu` | `PgMenu` + `PgMenuItem` | `#trigger` 슬롯 |
| `v-tooltip` | `PgTooltip` | `:text` |
| `v-tabs` `v-tab` | `PgTabs` | `:items` 배열 |
| `v-alert` | `PgAlert` | `type` → `tone` |
| `v-list` `v-list-item` | `PgListItem` | |
| `v-table` `v-data-table` | `PgTable` | `:columns` `:rows` |
| `v-progress-circular` `v-progress-linear` | `PgSpinner` `PgProgress` | |
| `v-skeleton-loader` | `PgSkeleton` | |
| `v-avatar` | `PgAvatar` | 이름 → 색 자동 매핑 |
| `v-row` `v-col` `v-spacer` `v-container` | `.pg-row` `.pg-col` `.pg-spacer` 유틸 | 12컬럼 그리드 대신 flex/grid |

## 현재 상태

- 전환 완료: 로그인 화면(`SideLogin.vue`, `LoginForm.vue`)
- Vuetify 와 공존 중이다. 아직 570개 파일이 `<v-*>` 를 쓰고 있어
  `main.ts` 는 두 플러그인을 모두 등록한다. 화면 단위로 옮긴 뒤 마지막에 Vuetify 를 제거한다.
