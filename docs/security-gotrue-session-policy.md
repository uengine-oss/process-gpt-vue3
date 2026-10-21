# 세션 타임아웃 운영 가이드 (docs/security.md 2-1, 항목 12)

서버(GoTrue) 세션 정책과 화면(브라우저) 유휴 타이머 두 겹으로 구성된다.
전 모드(PAL / 비 PAL) 공통으로 동작하되, 화면 유휴 타이머는 테넌트 설정으로 끌 수 있다.

## 정책 요약

| 계층 | 항목 | 값 | 근거 |
| --- | --- | --- | --- |
| GoTrue | 액세스 토큰 수명 (`GOTRUE_JWT_EXP`) | 3600초 (1시간) | 탈취된 토큰의 유효 구간 축소 |
| GoTrue | 유휴 세션 만료 (`GOTRUE_SESSIONS_INACTIVITY_TIMEOUT`) | `4h` | 리프레시가 4시간 없으면 세션 폐기 |
| GoTrue | 세션 절대 수명 (`GOTRUE_SESSIONS_TIMEBOX`) | `12h` | 활동 중이어도 12시간 뒤 재로그인 |
| 화면 | 유휴 타임아웃 | 기본 30분 | 자리를 비운 브라우저 잠금 |
| 화면 | 경고 유예 | 기본 60초 | 만료 전 "연장" 기회 제공 |

GoTrue 쪽이 바깥 상한이고, 실제로 사용자가 체감하는 값은 화면 유휴 타이머다.
화면 타이머를 GoTrue 값보다 크게 잡으면 타이머가 돌기 전에 서버 세션이 먼저 끊기므로,
테넌트 설정값은 `GOTRUE_SESSIONS_INACTIVITY_TIMEOUT`(4h = 240분)보다 작게 유지한다.

## `JWT_EXPIRY` 공유 문제 (중요)

`docker-compose/.env.example`의 `JWT_EXPIRY`(36000초)는 auth 전용 변수가 아니라 **세 서비스가 함께 쓴다**.

| 서비스 | 환경변수 | 용도 |
| --- | --- | --- |
| `auth` | `GOTRUE_JWT_EXP` | 발급하는 액세스 토큰 수명 |
| `rest` (PostgREST) | `PGRST_APP_SETTINGS_JWT_EXP` | DB 함수가 만드는 토큰의 수명 (`app.settings.jwt_exp`) |
| `db` (Postgres 초기화) | `JWT_EXP` | `volumes/db/jwt.sql` 이 심는 `app.settings.jwt_exp` |

`JWT_EXPIRY` 자체를 3600으로 내리면 storage 서명 URL·DB 발급 토큰 등 인증 외 경로의
수명까지 같이 줄어든다. 그래서 **`JWT_EXPIRY`는 36000 그대로 두고, auth 서비스만
별도 변수 `GOTRUE_JWT_EXPIRY`(기본 3600)를 쓰도록 분리**했다.

```yaml
# docker-compose/docker-compose.yaml  services.auth.environment
GOTRUE_JWT_EXP: ${GOTRUE_JWT_EXPIRY:-3600}
```

`.env` 에 `GOTRUE_JWT_EXPIRY` 를 두지 않아도 기본 3600이 적용된다.
rest/db 는 기존과 동일하게 `JWT_EXPIRY` 를 참조하므로 영향 범위는 auth 서비스로 한정된다.

## 레포에 반영된 설정

### `docker-compose/docker-compose.yaml` → `services.auth.environment`

```yaml
GOTRUE_JWT_EXP: ${GOTRUE_JWT_EXPIRY:-3600}
GOTRUE_SESSIONS_INACTIVITY_TIMEOUT: ${GOTRUE_SESSIONS_INACTIVITY_TIMEOUT:-4h}
GOTRUE_SESSIONS_TIMEBOX: ${GOTRUE_SESSIONS_TIMEBOX:-12h}
```

### `kubernetes/supabase-deployment.yaml` → `supabase-auth` 컨테이너 `env`

```yaml
- name: GOTRUE_JWT_EXP
  value: "3600"
- name: GOTRUE_SESSIONS_INACTIVITY_TIMEOUT
  value: "4h"
- name: GOTRUE_SESSIONS_TIMEBOX
  value: "12h"
```

K8s 매니페스트의 `supabase-rest` / `supabase-storage` 는 JWT 만료 관련 env 를 갖고 있지 않아
이 변경의 영향을 받지 않는다.

### 버전 요구사항

`GOTRUE_SESSIONS_*` 는 GoTrue v2.62 이상에서 지원한다.
docker-compose(`v2.177.0`)는 충족하고, `kubernetes/supabase-deployment.yaml` 은
`supabase/gotrue:v2.143.0` 이라 역시 충족한다. 더 낮은 이미지로 되돌릴 경우
두 변수는 무시되므로 화면 유휴 타이머만 남는다.

## 레포 밖 배포에 반영할 때

### Supabase Cloud (호스팅 프로젝트)

Dashboard → Authentication → Sessions

- Time-box user sessions: `12 hours`
- Inactivity timeout: `4 hours`

Dashboard → Authentication → Sessions → Access token (JWT) expiry: `3600`

### Supabase CLI (`supabase/config.toml`)

```toml
[auth]
jwt_expiry = 3600

[auth.sessions]
timebox = "12h"
inactivity_timeout = "4h"
```

## 화면 유휴 타이머

- 구현: `src/composables/useIdleTimeout.ts`
- 모달: `src/components/auth/IdleTimeoutDialog.vue` (`src/App.vue` 에서 전역 마운트)
- 감지 이벤트: `mousemove`, `mousedown`, `click`, `keydown`, `scroll`, `touchstart`, `wheel`
  (passive 리스너 + 1초 스로틀). 다른 탭에서의 활동은 `localStorage` 를 통해 공유된다.
- 동작: 유휴 N분 → 경고 모달(남은 초 카운트다운) → 유예 60초 경과 시 로그아웃 후 로그인 화면 이동.
  경고가 뜬 뒤에는 마우스가 스쳤다는 이유로 경고가 사라지지 않는다 — "로그인 유지" 를 눌러야 다시 센다.
- 로그아웃은 기존 경로를 그대로 쓴다: `useAuthStore().logout()` → `StorageBaseSupabase.signOut()`
  (로그아웃 감사 기록 + localStorage/쿠키 정리 + `supabase.auth.signOut()`).
- 로그인 상태(`localStorage.email` 또는 유효한 SSO 토큰)에서만 센다. `/` 와 `/auth/*` 화면에서는 세지 않는다.
- 여러 탭: 한 탭의 조작을 `localStorage` (`sessionIdle:lastActivity`, 5초 주기) 로 다른 탭에 알린다.

### SSO(헤더 교환) 경로

`src/utils/ssoAuth.ts` 로 로그인한 세션도 `localStorage.email` 을 심으므로 App.vue 전역 마운트로 자연히 커버된다.
다만 로그아웃 경로가 다르므로 분기했다 — `isSsoAuthenticated()` 면 `redirectToSsoLogin('idle-timeout')`
(메모리 토큰 + `localStorage.accessToken` 정리 후 SSO 게이트웨이로 이동), 아니면 `useAuthStore().logout()`.

> 한계: SSO exchange 는 역방향 프록시가 주입하는 `x-playground-*` 헤더로 인증한다.
> 게이트웨이가 헤더를 계속 주입하는 한 재이동 즉시 다시 로그인될 수 있다.
> SSO 세션에 유휴 만료를 실제로 강제하려면 게이트웨이(IdP) 쪽 세션 정책이 필요하다.

## 테넌트 설정

`public.tenants` 에 컬럼을 더하지 않았다. 이 레포가 테넌트 설정에 쓰는 자리는
`public.configuration` (`tenant_id` + `key` 유일, SELECT 는 인증 사용자 전체,
쓰기는 `has_role_at_least('admin')`) 이고, `palette_settings` · `maintenance_mode` ·
`pi_flag_types` 등이 모두 여기 있다. 세션 타임아웃도 같은 자리에 둔다.

| 항목 | 값 |
| --- | --- |
| 테이블 | `public.configuration` |
| `key` | `session_timeout` |
| `value` (jsonb) | `{ "idle_timeout_minutes": 30, "warning_seconds": 60 }` |

| 상태 | 결과 |
| --- | --- |
| 행 없음 / 값 없음 | 코드 기본값 **30분 / 60초** |
| `idle_timeout_minutes` ≤ 0 | 유휴 타이머 **비활성** (기존 동작 유지) |
| 조회 실패 | 기본값으로 진행 (보안 기능이 조회 장애로 사라지지 않게) |

```sql
-- 값 지정
insert into public.configuration (tenant_id, key, value)
values ('<tenant>', 'session_timeout', '{"idle_timeout_minutes": 30, "warning_seconds": 60}'::jsonb)
on conflict (tenant_id, key) do update set value = excluded.value;

-- 끄기
insert into public.configuration (tenant_id, key, value)
values ('<tenant>', 'session_timeout', '{"idle_timeout_minutes": 0}'::jsonb)
on conflict (tenant_id, key) do update set value = excluded.value;
```

마이그레이션: `supabase/migrations/20260911000010_tenant_session_timeout.sql`
(값을 심지 않는다 — 유일 제약 확인과 키 문서화만 한다.)

### 남은 작업

관리자 콘솔에서 이 값을 편집하는 UI 는 아직 없다. 지금은 위 SQL 로 설정한다.
