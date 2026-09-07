# 02. 시스템 관리 + API 연동 상태

pi 핸드오버 문서 12(System Management) 대응.

## 이관 파일

| 파일 | 출처 | 비고 |
|---|---|---|
| `src/views/system-management/SystemManagement.vue` | pi 동일 경로 | 시스템 목록/등록/수정/soft delete |
| `src/views/system-management/ExternalApiHealth.vue` | pi 동일 경로 | API 연동 상태 조회 + 수동 동기화 요청 |
| `src/stores/systemManagement.ts` | pi 동일 경로 | Pinia 스토어 |

## 라우트 (`src/router/MainRoutes.ts` — PAL 블록)

- `/systems` → SystemManagement (`/system` → `/systems` 리다이렉트 포함)
- `/external-api-health` → ExternalApiHealth (사이드바 비노출 — MENU_DEFINITIONS의 `hiddenInSidebar` 준수)

## 사이드바

- 관리자 섹션에 `시스템 관리` (icon `server-line-duotone`) 추가.

## 백엔드 어댑테이션 (핵심 결정)

pi의 시스템 CRUD는 별도 백엔드 REST(`/pi-system-backend/systems`, `playground-pi-system-backend`의 `system_api.py`)를 호출한다. **그 백엔드도 함께 이관되어 있으므로**, `PalModeBackend`의 systems 메서드 8종을 pi와 동일한 **REST 1차** 호출로 구성했다. 백엔드 미기동 등으로 REST가 실패하면 Supabase `systems` 테이블 직접 접근으로 폴백한다 (`searchUsersByName`/`searchSuppliers`와 같은 "REST 시도 → Supabase 폴백" 관례):

| 메서드 | REST (1차) | Supabase 폴백 (2차) |
|---|---|---|
| `getSystemList()` | `GET /pi-system-backend/systems` | `deleted_at IS NULL`, `created_at desc` |
| `getSystem(id)` | `GET /pi-system-backend/systems/{id}` | `maybeSingle()` |
| `putSystem(system)` | id 있으면 `PUT /systems/{id}`, 없으면 `POST /systems` | `upsert(..., { onConflict: 'id' })` |
| `deleteSystem(system)` | → `softDeleteSystem()` 위임 (pi 동일) | — |
| `softDeleteSystem(system, deletedBy?)` | `DELETE /systems/{id}` (body `{ deleted_by }`) | `deleted_at/deleted_by` 마킹 update |
| `getDeletedSystemList()` | `GET /systems/deleted` | `deleted_at IS NOT NULL`, `deleted_at desc` |
| `restoreSystem(id)` | `POST /systems/{id}/restore` | `deleted_at/deleted_by` null update |
| `hardDeleteSystem(id)` | `DELETE /systems/{id}/permanent` | 실제 delete |

백엔드 응답은 배열/단일 객체(plain row)로 Supabase 폴백과 동일한 형태이므로 호출부(`stores/systemManagement.ts`)는 무수정.

- dev 프록시: `vite.config.ts`에 `/pi-system-backend/` → `http://127.0.0.1:8000` (prefix 제거 rewrite) 추가. 대상은 `VITE_PI_SYSTEM_BACKEND_URL` 환경변수로 오버라이드 가능(`.env.example` 문서화 — 호스트 :8000 포트 충돌 이력 대비).
- pi의 프록시에 있던 SSO 헤더 주입(`injectDevSsoHeaders`)은 계정 연동 제외 방침에 따라 가져오지 않음 — 헤더가 없으면 백엔드가 로컬 기본 사용자를 사용한다.

`ProcessGPTBackend`의 시스템 CRUD 스텁은 건드리지 않았다 (PAL 오버라이드로 해결).

## External API Health

`ProcessGPTBackend`에 pi 구현을 그대로 추가:

- `getExternalApiHealthList()` — `storage.list('external_api_health')` 후 tenant → 'default' → 전체 순 폴백 필터링
- `requestExternalApiManualSync(id)` — `storage.putObject(..., { onConflict: 'id' })`로 `last_manual_sync_requested_at` 갱신

## DB

- `20260709_systems_table.sql` (신규 작성 — [01-db-schema.md](01-db-schema.md) 참조)
- `20260710_systems_soft_delete.sql` (pi 그대로)
- `20260511_external_api_health_table.sql` (중복 제거 + 멱등 가드로 재작성)

## 제한 사항

- pi에서 헬스체크 데이터를 적재하던 외부 백엔드(스케줄러)는 이관 범위 밖이다. `external_api_health` 테이블에 데이터를 넣는 주체가 생기기 전까지 화면은 빈 목록을 표시한다.
