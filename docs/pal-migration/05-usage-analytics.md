# 05. 사용/도입 분석 (Usage Analytics)

관리자 콘솔의 "사용 활성도" 대시보드가 소비하는 이벤트 수집 파이프라인.

## 이관 파일

| 파일 | 출처 | 내용 |
|---|---|---|
| `src/services/usageAnalytics.ts` | pi 동일 경로 (931줄, 그대로) | `startUsageTracking(router)` (페이지 방문/세션 추적), `recordUsageEvent(type, payload)` (`app_usage_events` 적재), `getUsageAdoptionDashboard()` (대시보드 집계) |

## 변경 파일 (이벤트 기록 지점 배선)

### `src/main.ts`
- `import { startUsageTracking } from '@/services/usageAnalytics';`
- `app.use(router);` 직후 **PAL 게이트**로 호출:
  ```ts
  if (window.$pal) {
      startUsageTracking(router);
  }
  ```
- pi는 무조건 호출하지만, 현재 프로젝트는 여러 모드를 서빙하므로 PAL 전용 수집으로 게이팅했다 (설계 결정).

### `src/components/api/ProcessGPTBackend.ts` — `putRawDefinition()`
- proc_def 저장 성공 직후 `recordUsageEvent(isNewProcDef ? 'model_create' : 'model_edit', ...)` 기록 (source: `ProcessGPTBackend.putRawDefinition`, name/version/versionTag 메타 포함). `void`로 fire-and-forget.

### `src/services/bpmnModelService.ts`
- `createModel()` 성공 시 `recordUsageEvent('model_create', ...)` (source: `BpmnModelService.createModel`)
- `saveModel()` 성공 시 `recordUsageEvent('model_edit', ...)` (node/link/lane 카운트 메타 포함)

## DB

- `20260421_usage_adoption_analytics.sql` — `app_usage_events` 테이블 (pi 그대로)

## 참고

- 대시보드 화면은 [04-admin-console.md](04-admin-console.md)의 `UsageAdoptionDashboard.vue` (`/admin-console/usage-adoption`).
- `usageAnalytics.ts`는 `@/utils/ssoAuth`의 `getSsoUser`를 사용 — 현재 프로젝트에 동일 export 존재 확인.
