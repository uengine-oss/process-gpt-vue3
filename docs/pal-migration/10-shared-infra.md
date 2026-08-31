# 10. 공통 인프라 변경

기능 단위에 속하지 않는 공용 파일 변경의 총정리.

## `src/router/MainRoutes.ts`

PAL 게이트(`...(window.$pal ? [...] : [])`) 안에 추가된 라우트 전체:

```
/analysis-dashboard          → views/analytics/AnalysisDashboard.vue
/ontology-explorer           → views/ontology-explorer/OntologyExplorer.vue
/ontology-explorer-new       → views/ontology-explorer-new/OntologyExplorerNew.vue
/systems (+ /system 리다이렉트) → views/system-management/SystemManagement.vue
/external-api-health         → views/system-management/ExternalApiHealth.vue
/policy-document             → views/policy-document/PolicyDocumentManager.vue
/call-activity-management    → views/admin/tabs/CallActivityManagement.vue
/work-assignment             → views/work-assignment/WorkAssignment.vue
/admin-console/{data-freeze, system-operations, kpi-targets, usage-adoption,
                audit-trail, exec-instances, governance-studio, pi-flags} (children 추가)
/review-board/restructure    → views/review-board/RestructureApprovalBoard.vue   (별도 PAL 스프레드)
/review-board-debug          → views/review-board/ReviewBoardSubmissionDebug.vue (별도 PAL 스프레드)
```

`/review-board/restructure`는 `/review-board/:reviewId`보다 앞에 위치.

추가로 `allRoutes` 배열에 `RouteRecordRaw[]` 명시 어노테이션을 붙였다(+`import type { RouteRecordRaw } from 'vue-router'`). PAL 스프레드로 redirect 전용 라우트(`/system`)가 섞이면서 배열 추론 타입이 vue-router 유니온과 어긋나 `router/index.ts`에서 불투명한 타입 에러가 났던 것을, 요소 단위로 검사되도록 바꾼 것. GS 모드 필터의 `route.name`은 `as string` 캐스트.

## `src/layouts/full/vertical-sidebar/VerticalSidebar.vue`

- **관리자 섹션** (pal && isAdmin 인라인 배열): 속성 스키마, **수정 잠금**, 휴지통, **시스템 운영**, **KPI 목표**, **사용 활성도**, **감사 로그**, **실행 인스턴스**, **PI Flag**, Task 종류 설정, 시스템 관리, **업무분장**, 사내 정책문서 (굵은 항목이 이번 추가; 라벨/아이콘은 `utils/routePermissions.ts`의 MENU_DEFINITIONS 준수)
- **프로세스 관리 섹션**: PAL 한정 `프로세스 리스트`(delegation) → `/call-activity-management`
- **분석 섹션**: PAL에서 통째로 숨기던 것을 PAL 전용 목록(`분석 대시보드`, `온톨로지 익스플로러`)으로 대체

## `src/main.ts`

- `startUsageTracking(router)` PAL 게이트 호출 ([05-usage-analytics.md](05-usage-analytics.md))

## `src/components/api/PalModeBackend.ts`

- systems CRUD 8종: pi 동일 REST(`/pi-system-backend/systems`) 1차 + Supabase 폴백 ([02-system-management.md](02-system-management.md))
- `getGroupById` (REST 시도 → null)

## `src/components/api/ProcessGPTBackend.ts`

- `getExternalApiHealthList` / `requestExternalApiManualSync` 추가
- `getInstanceListByStatus`의 `allParticipants` 필터 옵션
- `putRawDefinition`의 usage 이벤트 기록 + `recordUsageEvent` import

## `src/services/bpmnModelService.ts`

- createModel/saveModel에 usage 이벤트 기록

## `src/components/ui/list-pages/InstanceListPage.vue`

- `allUsers` prop (최소 델타 — 현재의 정렬 로직 유지)

## 공용 신규 파일

- `src/components/ui/common/UserIdentityText.vue`
- `src/utils/piFlagTypes.js`
- `public/assets/images/icon/{settings,target,flag-line-duotone}.svg`

## package.json

- 의존성 추가 (모두 온톨로지 익스플로러용, pi와 동일 대역): `cytoscape`, `fast-xml-parser`, `3d-force-graph`, `@neo4j-nvl/base`, `@neo4j-nvl/interaction-handlers` — [07-ontology-explorer.md](07-ontology-explorer.md)
- `three` ^0.178 → ^0.185 상향 (pi와 동일, 3d-force-graph 요구 대역) — 근거는 [07-ontology-explorer.md](07-ontology-explorer.md)
- `vue-tsc` ^2.1.10 → ^2.2.12 (pi와 동일 버전) — 라우터/스토어의 허위 타입 에러 해소. 단 vue 3.2 타입 정의 기인 문제 2건은 코드 측 우회 필요했음(아래)

## 이관 파일에 가한 최소 타입 수정 (vue 3.2 타입 정의 호환)

현재 프로젝트는 vue 3.2.31(pi는 3.5.32)이라 pi에서 그대로 가져온 두 .vue 파일이 vue-tsc에서 허위 에러를 냈고, 런타임 동작이 동일한 최소 수정으로 우회했다:

- `WhatIfSimulatorPanel.vue`: 템플릿 v-if 내로잉이 `metadata` prop을 unknown으로 만드는 문제 → 항상 non-null인 `metaInfo` computed로 우회 (템플릿 7곳 치환)
- `ProcessAnalytics.vue`: `Object.entries(...)` 값이 unknown으로 추론 → `(v as number)` 캐스트 1곳

## vite.config.ts

- `optimizeDeps`에 NVL layout-workers 처리(pi와 동일) — [07-ontology-explorer.md](07-ontology-explorer.md)
- `/pi-system-backend/` dev 프록시 추가 (`VITE_PI_SYSTEM_BACKEND_URL` || `http://127.0.0.1:8000`, prefix 제거 rewrite; SSO 헤더 주입은 제외) — [02-system-management.md](02-system-management.md)

## .env / docker-compose

- `.env.example`: `VITE_PAL_MODE=false` 항목 추가 (PAL 모드 플래그 문서화)
- `.env.example`: `VITE_PI_SYSTEM_BACKEND_URL` 항목 추가 (pi-system-backend dev 프록시 대상 오버라이드)
- `docker-compose/`: Apache AGE 커스텀 postgres 이미지 빌드 구성 ([07-ontology-explorer.md](07-ontology-explorer.md))

## 검증 (최종)

- `vue-tsc --noEmit` **통과 (에러 0건)** — 최초 전체 빌드에서 14건의 타입 에러가 발견되어(미설치 의존성 4종 + 타입 우회 4건, 위 항목들) 모두 해소한 뒤의 결과.
- `vite build` **통과 (exit 0)** — dist에 AnalysisDashboard/OntologyExplorer/OntologyExplorerNew 등 이관 기능 청크 생성 확인. 남은 경고는 기존부터 있던 SCSS deprecation/CSS minify 경고로 이관과 무관.
- 참고: 기존 build 스크립트는 `cross-env NODE_OPTIONS=... vue-tsc && vite build` 구조라 `&&` 뒤의 vite build에는 힙 옵션이 적용되지 않았고, 이관으로 번들이 커지며 청크 렌더링 중 V8 OOM(exit 134)이 발생 → build 스크립트에서 vite build에도 `--max-old-space-size=8192`를 명시하도록 수정.

## 이관하지 않은 pi 공용 파일 (현재 버전 유지 — 필요 시 참고)

- `stores/notification.ts`, `utils/{uuidv7.ts, jsonPath.js, lastSeen.ts, formjsSchema.ts, bpmnXmlUuid.ts}`, `ValidationWaiveDialog.vue`, `customDrilldown/`, form-designer(formjs) 계열: 이번에 이관한 기능 단위들이 참조하지 않아 가져오지 않았다. 추후 다른 pi 기능을 이관할 때 단위별로 재평가.
- `MyInbox.vue`/`ProcessReviewBoard.vue`/`ProcessReviewDetail.vue`/`reviewVersionGrouping.ts`/`bpmnDiff.ts`/`ProgressBadge.vue`/`reviewBoard.ts` — 이후 **pi 버전으로 전체 이관 완료** ([08-review-board-extensions.md](08-review-board-extensions.md)). 단 `BpmnUengineViewer.vue`는 현재 버전 유지.
- pi의 `SkillDetail.vue`, `OntologyGraphViewer.vue`(cytoscape 사용) — 현재 프로젝트에 대응 화면이 이미 있거나 사용처 없음.
