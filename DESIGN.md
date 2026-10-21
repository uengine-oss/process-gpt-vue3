---
name: 전략 보드 — 모던 데이터 워크스페이스
description: 전략맵·온톨로지 익스플로러·온톨로지 스키마 3개 탭이 공유하는 시각 체계 (strategyTheme.css --sx-* 토큰)
colors:
  surface: "var(--cds-surface-2)"
  surface-sunken: "var(--cds-surface-0)"
  ink: "var(--cds-text-primary)"
  ink-2: "var(--cds-text-secondary)"
  ink-3: "var(--cds-text-muted)"
  line: "var(--cds-border)"
  line-strong: "var(--cds-border-strong)"
  accent: "rgb(var(--v-theme-primary))"
  course: "#6d28d9"
  risk: "#dc2626"
  warn: "#b45309"
  ok: "#15803d"
  ripple: "#0369a1"
  stage-plan: "#4338ca"
  stage-define: "#0f766e"
  stage-asset: "#475569"
  stage-execute: "#0369a1"
  stage-people: "#a21caf"
  perspective-financial: "#1d4ed8"
  perspective-customer: "#0f766e"
  perspective-internal: "#c2410c"
  perspective-learning: "#6d28d9"
typography:
  body: "앱 기본 서체(Plus Jakarta Sans + 시스템 한글), 숫자는 tabular-nums"
  card-title: { fontSize: "13–14px", fontWeight: 600–700 }
  stat: { fontSize: "22px", fontWeight: 700 }
  detail-big: { fontSize: "28–34px", fontWeight: 800 }
rounded:
  sm: "6px"
  md: "10px"
  lg: "14px"
  pill: "999px"
motion:
  duration: "160ms"
  easing: "var(--cds-ease-out)"
  reduced-motion: "모든 전환 0ms"
---

# Design System: 전략 보드 — 모던 데이터 워크스페이스

> **적용 범위.** `/strategy-board` 의 세 탭 — 전략맵(`src/views/strategy/StrategyBoard.vue`), 온톨로지 익스플로러
> (`src/components/strategy/ontology/StrategyOntologyExplorer.vue`), 온톨로지 스키마(`OntologySchemaView.vue`).
> 토큰 정본은 `src/components/strategy/ontology/strategyTheme.css` (루트에 `.sx-theme`). 앱 나머지는 Vuetify/PAL 체계를 따른다.
> 2026-10-19 '오리엔티어링 지도'(종이·등고선 갈색·Barlow Condensed) 스타일을 이 체계로 교체했다.

## 원칙

- **면은 조용히, 데이터는 또렷하게.** 흰 카드 + 옅은 sunken 면, 1px 중립 선, 아주 약한 그림자(`--sx-shadow-1`). 호버 때만 그림자가 깊어진다.
- **앱 토큰을 따른다.** 면·글자·선은 `--cds-*`(라이트/다크 자동), 강조는 Vuetify `primary`(테마별). 하드코딩 흰색 금지.
- **색은 의미에만.** 보라(`--sx-course`)는 코스(선택 노드를 지나는 결정적 경로)와 그 주 행동 전용. 선택·호버 강조는 `primary`. 상태는 위험 빨강·주의 호박·양호 초록(`achievementLevel.js` 와 같은 값).
- **모양 먼저.** 상태는 ▲(위험·병목) ◆(주의·지연) 점선 ○(실행 미연결) 기호 + 문구를 병기한다(`OntologySymbol.vue`). 색만으로 구분하지 않는다.
- **단계·관점 색은 점과 글자로.** 단계/레이어/관점 색은 8px 점, 아이콘, 열 머리 밑줄(2px, 55%)에만. 카드에 굵은 좌측 컬러바 금지.
- **숫자는 앱 서체 + tabular-nums**(`.sx-num`). 별도 웹폰트를 로드하지 않는다.

## 컴포넌트

- **탭 바**: 밑줄 대신 알약형 선택(배경 `--sx-accent-soft`, 글자 primary), 높이 36.
- **요약 타일**(전략맵 상단): 전략목표 수 · 평균 달성률 · 위험 · 주의. 값 22px.
- **관점 레인**: sunken 면 위 둥근 14px 레인, 왼쪽에 점 + 관점명 + 개수·평균 달성률.
- **목표 카드**: 232px, 이름 2줄 clamp(keep-all), 중요도 알약(★n), KPI·과제 메타, 달성률 + 상태 알약 + 4px 진행 막대(transform 애니메이션).
- **익스플로러 열 머리**: 단계 색 5% 틴트 + 아이콘 + 개수 알약 + 단계 색 밑줄. 열 바탕은 단계 색 3%.
- **익스플로러 카드**: 8px 라운드, 선택 = 보라 테두리 + 3px 링, 위험/병목 = 빨강 45% 테두리 + 3% 틴트, 맥락 노드 = 상자 없이 글자만.
- **스키마 메타 그래프**: 레이어 열(점 + 이름) × 타입 박스(점 + 이름 + 개수). 호버 = 미리보기, 클릭 = 고정(표도 필터). 활성 관계만 primary + 관계명.
- **표**: 둥근 테두리 래퍼, sunken 헤더, 행 호버, 고정 열 폭(colgroup), 속성은 mono 알약.
- **로딩**: 스피너 대신 자리 잡힌 스켈레톤(레이아웃 이동 방지).

## 성능 규칙

- 익스플로러 카드는 `cardViews` computed 에서 한 번에 계산하고 `v-memo="[c]"` — 호버·스크롤로 카드를 다시 그리지 않는다.
- 팬아웃이 큰 노드의 엣지는 `hoverEdges` 로 분리(호버마다 전체 엣지 재계산 금지).
- 캔버스 스크롤은 rAF 로 모으고, 화면 밖 코스 표식은 실제로 바뀔 때만 갱신.
- 전략맵 연결선은 rAF 로 프레임당 1회, 카드별 rect 1회 측정, ResizeObserver 로 패널·사이드바 폭 변화 대응.
- 스키마 박스 활성 판정은 미리 만든 이웃 맵으로 O(1).

## 접근성

- 클릭 가능한 카드·박스는 `role="button"` + `tabindex="0"` + Enter/Space + `aria-pressed`.
- 아이콘 전용 버튼에는 `aria-label`.
- `prefers-reduced-motion` 이면 모든 전환 0ms(`strategyTheme.css`).
- 상태 글자색은 흰 바탕 4.5:1 이상, 다크 모드는 `[data-mode='dark'] .sx-theme` 에서 밝은 변형으로 교체.
