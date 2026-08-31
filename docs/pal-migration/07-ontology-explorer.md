# 07. 온톨로지 익스플로러 (구/신)

pi 핸드오버 문서 07 대응. BPMN 정의로부터 프로세스 지식그래프(Process KG)를 추출·분석하는 화면 2종.

## 이관 파일 (디렉터리 단위로 pi 동일 경로에서 복사)

| 경로 | 내용 |
|---|---|
| `src/views/ontology-explorer/OntologyExplorer.vue` | 구 익스플로러 (2D/3D 캔버스, 인사이트, What-if 등) |
| `src/views/ontology-explorer-new/OntologyExplorerNew.vue` | 신 익스플로러 (비즈니스 온톨로지 / Apache AGE 기반) |
| `src/components/ontology-explorer/` (11개 파일) | AiReasoningConsole, DataTasksPanel, DimensionFilterPanel, EntityFocusPanel, InsightCardView, InsightListPanel, OntologyCanvas2D, OntologyCanvas3D, OverviewPanel, WhatIfSimulatorPanel, ai/InsightNarrativeGenerator.ts |
| `src/components/ontology-explorer-new/` (5개 파일) | GraphHealthBanner, ImpactTracePanel, NodeDetailPanel, NvlCanvas, TypeFilterPanel |
| `src/composables/ontology/` (14개 파일) | useOntologyGraph, entityFocus, viewModes, ontologyMapper, legacyOntologyMapper, bpmnOntologyParser, useAnalysisCache, useInsightWorkflow, overviewInsights, spofAnalyzer, contextSlicer, nodeTypeColors, ontologyTypes, renderGuard |
| `src/composables/ontologyNew/` (8개 파일) | useBusinessOntology, config, health, impactTrace, layerMapping, rollup, typeFilters, types |
| `src/lib/processKg/` (33개 파일) | parser/(parseBpmnXml 등), graph/(extractGraph, rollupProcessRelations 등), analysis/(bottleneck·spof·automation·organization·redesign 등 15종), source/, config/, shared/, ai/ |
| `src/services/ontologyGraphService.ts` | proc_def 기반 그래프 소스 |
| `src/services/ontologyAgeGraphService.ts` | **Apache AGE RPC 호출** (`ontology_graph_health`, `ontology_business_graph`, `ontology_execution_rollup`) |
| `src/services/processKgGraphService.ts` | Process KG 그래프 소스 (proc_def 조회) |

`*.spec.ts` 테스트 파일(vitest 의존)은 **복사에서 제외**했다 — 현재 프로젝트에 vitest가 설정되어 있지 않아 typecheck를 깨뜨리기 때문. 테스트가 필요해지면 vitest devDependency 추가 후 pi에서 가져오면 된다.

## 신규 npm 의존성

- `cytoscape` (^3.34) — OntologyCanvas2D 그래프 렌더링
- `fast-xml-parser` (^5.11) — `lib/processKg/parser/parseBpmnXml.ts`의 BPMN XML 파싱 (정적 import)
- `3d-force-graph` (^1.80) — OntologyCanvas3D 3D 렌더링 (동적 import → 별도 청크)
- `@neo4j-nvl/base`, `@neo4j-nvl/interaction-handlers` (^1.2) — 신 익스플로러 NvlCanvas 렌더링 (동적 import → 별도 청크)
- `three` ^0.178 → ^0.185 상향 (pi와 동일) — 3d-force-graph@1.80이 `three >=0.179`를 요구해 0.178 유지 시 서브트리에 three 두 벌이 섞여(0.178/0.185) 3D 캔버스가 런타임에 깨질 수 있다. 현재 프로젝트에서 three를 직접 import하는 파일은 ThreeWaveAnimation.vue(pi와 동일 파일·pi에서 0.185로 검증됨)와 OntologyCanvas3D.vue(pi에서 가져옴)뿐이라 상향 안전.

모두 pi package.json과 동일 버전 대역으로 설치.

## vite.config.ts

pi와 동일하게 `optimizeDeps`에 NVL layout-workers 처리 추가: CJS 하위 의존성 5종 include + `@neo4j-nvl/layout-workers` exclude (사전 번들 시 SharedWorker URL이 깨져 레이아웃 결과가 오지 않는 문제 — NVL 공식 Vite 가이드 패턴).

## 라우트 / 사이드바

- PAL 블록: `/ontology-explorer` → OntologyExplorer, `/ontology-explorer-new` → OntologyExplorerNew
- PAL 분석 섹션에 `온톨로지 익스플로러`(sitemap) → `/ontology-explorer`. 신 익스플로러는 MENU_DEFINITIONS상 주석 처리(비노출) 상태를 따라 사이드바에 넣지 않음 (직접 URL 접근).

## DB / 인프라

- `20260710_ontology_explorer_rpc.sql` (pi 그대로) — AGE 기반 RPC 3종
- **Apache AGE 도커 이미지** (이번 이관에서 추가):
  - `docker-compose/supabase-postgres-age/Dockerfile` — supabase/postgres 베이스에 AGE 확장 빌드
  - `docker-compose/docker-compose.yaml` — db 서비스 이미지를 `process-gpt/supabase-postgres-age`로 교체 + `volumes/db/age.sql` init 스크립트 마운트
  - `docker-compose/.env.example` — `SUPABASE_POSTGRES_IMAGE`, `SUPABASE_POSTGRES_AGE_TAG`, `POSTGRES_MAJOR_VERSION`, `APACHE_AGE_REF` 변수 추가
  - `docker-compose/volumes/db/age.sql` — AGE 확장 로드/그래프 초기화

## 의존성 확인

- `@/components/ai/blueprintAiUtils` — 현재 프로젝트에 존재 (js)
- 그래프 서비스가 읽는 테이블은 `proc_def`뿐 (신규 테이블 없음)
