# 06. 분석 대시보드 (Analysis Dashboard)

pi 핸드오버 문서 06 대응. 경영/운영/프로세스/거버넌스 4개 탭으로 구성된 통합 분석 대시보드.

## 이관 파일 (모두 pi 동일 경로에서 그대로 복사)

| 파일 | 내용 |
|---|---|
| `src/views/analytics/AnalysisDashboard.vue` | 탭 컨테이너 (defineAsyncComponent 지연 로드) + 설정 다이얼로그 |
| `src/views/analytics/AnalysisDashboardSettings.vue` | 탭 노출/순서 설정 (`configuration` 테이블 저장) |
| `src/views/analytics/tabs/ExecutiveSummary.vue` | 경영 요약 |
| `src/views/analytics/tabs/OperationalBoard.vue` | 운영 보드 |
| `src/views/analytics/tabs/ProcessAnalytics.vue` | 프로세스 분석 |
| `src/views/analytics/tabs/GovernanceQuality.vue` | 거버넌스 품질 |
| `src/stores/analytics/analysisDashboardStore.ts` | 대시보드 상태 (backend.getMetricsMap 사용) — `fetchDomainOptions`의 `domains`에 `any[]` 명시 (현재 프로젝트 백엔드 래퍼 타입 추론 차이로 인한 `unknown[]` 오류 회피, 1줄 델타) |
| `src/services/dashboardDataService.ts` | 공용 데이터 집계 |
| `src/services/dashboardSettingsService.ts` | 설정 저장/로드 (`configuration` 테이블) |

차트는 외부 라이브러리 없이 순수 Vue/CSS/SVG로 렌더링하므로 **추가 npm 의존성 없음** (pi의 echarts/AppEChart는 이 대시보드가 아니라 pi의 demo 대시보드 전용이라 이관하지 않음).

## 라우트 / 사이드바

- PAL 블록에 `/analysis-dashboard` → AnalysisDashboard
- PAL 모드에서 기존에 통째로 비우던 분석(Analytics) 사이드바 섹션을 PAL 전용 목록으로 대체: `분석 대시보드`(dashboard), `온톨로지 익스플로러`(sitemap)

## 백엔드 의존 (현재 프로젝트에 모두 존재 확인)

- `getMetricsMap` (ProcessGPTBackend:1986)
- `getKpiTargets` (ProcessGPTBackend:10901)
- `listDefinitionStatusLite` (PalModeBackend:467)
- `getAliveProcessIdsAmong` (PalModeBackend:968)

## DB

- `20260626_analysis_dashboard_reviewer_access.sql` (pi 그대로) — reviewer 권한 접근 허용
- 설정 저장은 기존 `configuration` 테이블 재사용 (신규 DDL 없음)
