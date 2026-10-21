# 반복 로그인 실패 잠금 운영 가이드 (docs/security.md 2-4, 항목 18)

같은 계정에 대해 **최근 M분 안에 N회** 비밀번호 검증이 실패하면 **L분 동안** 로그인을 차단한다.
판정은 GoTrue 의 Password Verification Attempt Hook(Postgres 함수)이 서버측에서 수행하므로
클라이언트를 우회해도 무력화되지 않는다. 전 모드(PAL / 비 PAL) 공통 동작이다.

## 정책 요약

| 항목 | 기본값 | 설정 위치 |
| --- | --- | --- |
| 최대 실패 횟수 (`max_attempts`) | 5회 | `public.configuration` key=`login_lockout` |
| 실패 집계 윈도우 (`window_minutes`) | 15분 | 〃 |
| 잠금 유지 시간 (`lockout_minutes`) | 15분 | 〃 |
| 훅 활성화 | on | `GOTRUE_HOOK_PASSWORD_VERIFICATION_ATTEMPT_ENABLED` |

- 잠긴 동안에는 **비밀번호가 맞아도** 거절한다.
- 잠긴 상태에서 추가로 시도해도 **잠금 시간은 연장되지 않는다**. 계속 두드리는 것만으로
  영구 잠금이 되면 정상 사용자가 영영 들어오지 못한다.
- 로그인에 성공하면 카운터를 0으로 리셋한다.
- 마지막 실패로부터 윈도우(기본 15분)가 지나면 카운터는 1부터 다시 센다.
- `max_attempts` 가 0 이하이면 잠금 기능이 꺼진다(카운터도 기록하지 않는다).

## 구성 요소

| 계층 | 대상 |
| --- | --- |
| 마이그레이션 | `supabase/migrations/20260911000006_password_lockout_hook.sql` |
| 훅 함수 | `public.hook_password_verification_attempt(jsonb)` |
| 카운터 테이블 | `public.auth_failed_attempts` (훅 전용, 클라이언트 접근 차단) |
| 정책 조회 | `public.login_lockout_policy(tenant_id)` |
| 잠금 목록 | `public.locked_accounts` (뷰, psql 점검용) / `public.admin_list_locked_accounts()` (RPC, 앱용) |
| 잠금 해제 | `public.admin_unlock_account(p_email, p_user_id)` |
| 관리자 화면 | `src/views/admin/tabs/AuditTrail.vue` → "로그인 이력" 탭 상단 잠금 계정 패널 |
| 백엔드 메서드 | `src/components/api/PalModeBackend.ts` → `getLockedAccounts()` / `unlockAccount()` |

### 왜 `auth_login_audit` 를 카운트 원천으로 쓰지 않는가

`public.auth_login_audit`(1단계, 항목 14)는 **브라우저가** 로그인 후 `record_auth_audit()` RPC 를
호출해 남기는 기록이다. 호출을 생략하거나(스크립트 로그인, 네트워크 오류) 임의 이메일로 위조
호출할 수 있어 잠금 판단의 근거가 될 수 없다.

그래서 잠금 카운트의 **신뢰 원천은 GoTrue 가 서버측에서 직접 호출하는 훅이 기록하는
`public.auth_failed_attempts`** 이다. 다만 "잠금이 걸린 순간"만은 관리자가 로그인 이력 탭에서
함께 볼 수 있도록 `auth_login_audit` 에도 한 줄 남긴다
(`action='login_failed'`, `metadata.reason='account_locked'`, `metadata.source='password_verification_hook'`).
이 기록은 표시용이며 판정에는 쓰지 않는다.

### 훅 규격

```
입력  event  = { "user_id": <uuid>, "valid": <boolean> }
출력  result = { "decision": "continue" | "reject",
                 "message": <text>,
                 "should_logout_user": <boolean> }
```

식별 가능한 `user_id` 가 없으면(미가입 이메일 등) 그대로 `continue` 한다 — GoTrue 가 이미 거절한다.

### fail-open

훅 안에서 어떤 예외가 나도 `{"decision":"continue"}` 를 돌려준다.
잠금 로직의 버그나 일시적 DB 오류가 "전 사용자 로그인 불가"로 번지면 안 되기 때문이다.
예외는 `RAISE WARNING` 으로 Postgres 로그에 남는다.

## 레포에 반영된 설정

### `docker-compose/docker-compose.yaml` → `services.auth.environment`

```yaml
GOTRUE_HOOK_PASSWORD_VERIFICATION_ATTEMPT_ENABLED: "true"
GOTRUE_HOOK_PASSWORD_VERIFICATION_ATTEMPT_URI: "pg-functions://postgres/public/hook_password_verification_attempt"
```

`pg-functions://` 뒤의 `postgres` 는 **데이터베이스 이름**이다 (`POSTGRES_DB`).
DB 이름을 바꿔 쓰는 환경이라면 이 값도 함께 바꿔야 한다.

### `kubernetes/supabase-deployment.yaml` → `supabase-auth` 컨테이너 `env`

```yaml
- name: GOTRUE_HOOK_PASSWORD_VERIFICATION_ATTEMPT_ENABLED
  value: "true"
- name: GOTRUE_HOOK_PASSWORD_VERIFICATION_ATTEMPT_URI
  value: "pg-functions://postgres/public/hook_password_verification_attempt"
```

### 버전 요구사항 (중요)

Auth Hooks(`pg-functions://`)는 **GoTrue v2.151.0 이상**에서 동작한다.

| 배포 | 이미지 | 상태 |
| --- | --- | --- |
| `docker-compose/docker-compose.yaml` | `supabase/gotrue:v2.177.0` | 충족 |
| `kubernetes/supabase-deployment.yaml` | `supabase/gotrue:v2.143.0` | **미충족 — image 승격 필요** |

낮은 버전에서는 두 env 가 **무시될 뿐** 로그인 자체는 정상 동작한다(잠금만 걸리지 않는다).
K8s 배포에 실제로 반영하려면 `image` 를 `v2.151.0` 이상(compose 와 같은 `v2.177.0` 권장)으로 올린다.

## 적용 순서 (중요)

훅 URI 가 가리키는 함수가 없으면 GoTrue 는 비밀번호 로그인을 **실패 처리**한다.
따라서 반드시 이 순서를 지킨다.

1. 마이그레이션 적용 — `supabase/migrations/20260911000006_password_lockout_hook.sql`
2. 함수 존재 확인
   ```sql
   select public.hook_password_verification_attempt('{"valid": true}'::jsonb);
   -- → {"decision": "continue"}
   ```
3. GoTrue 재기동(`GOTRUE_HOOK_PASSWORD_VERIFICATION_ATTEMPT_*` 반영)

롤백은 역순이다 — **먼저 `_ENABLED` 를 `false` 로 내리고 재기동한 뒤** 함수를 드롭한다.

## 레포 밖 배포에 반영할 때

### Supabase Cloud (호스팅 프로젝트)

Dashboard → Authentication → Hooks → **Password Verification Attempt**

- Enable 체크
- Type: `Postgres`
- Schema: `public`, Function: `hook_password_verification_attempt`

Dashboard 에서 훅을 지정하면 `supabase_auth_admin` 에 대한 EXECUTE 권한이 필요하다.
마이그레이션이 이미 부여한다(역할이 없는 환경에서는 건너뛴다).

### Supabase CLI (`supabase/config.toml`)

```toml
[auth.hook.password_verification_attempt]
enabled = true
uri = "pg-functions://postgres/public/hook_password_verification_attempt"
```

## 테넌트별 정책 설정

`public.configuration` (tenant_id + key 유일, 쓰기는 `has_role_at_least('admin')`).
`session_timeout`(2-1) 과 같은 자리·같은 방식이다.

| 항목 | 값 |
| --- | --- |
| 테이블 | `public.configuration` |
| `key` | `login_lockout` |
| `value` (jsonb) | `{ "max_attempts": 5, "window_minutes": 15, "lockout_minutes": 15 }` |

| 상태 | 결과 |
| --- | --- |
| 행 없음 / 값 없음 | 기본값 **5회 / 15분 / 15분** |
| `max_attempts` ≤ 0 | 잠금 **비활성** (카운터도 기록하지 않음) |
| 값 파싱 실패 | 기본값으로 진행 (설정 오타로 보안 기능이 꺼지지 않게) |

해석 우선순위는 ① 해당 테넌트 행 → ② `tenant_id IS NULL` 전역 행 → ③ 코드 기본값이다.
훅은 JWT 없이 도는 컨텍스트라 `public.tenant_id()` 가 NULL 이므로,
사용자의 테넌트는 `public.users` 에서 역조회한다.

```sql
-- 값 지정
insert into public.configuration (tenant_id, key, value)
values ('<tenant>', 'login_lockout',
        '{"max_attempts": 5, "window_minutes": 15, "lockout_minutes": 15}'::jsonb)
on conflict (tenant_id, key) do update set value = excluded.value;

-- 끄기
insert into public.configuration (tenant_id, key, value)
values ('<tenant>', 'login_lockout', '{"max_attempts": 0}'::jsonb)
on conflict (tenant_id, key) do update set value = excluded.value;
```

## 관리자 운영

### 화면

관리자 콘솔 → 감사 로그 → **로그인 이력** 탭 상단의 "잠금 계정" 패널.
현재 잠긴 계정의 이메일·이름, 실패 횟수, 잠금 시각, 해제 예정 시각이 보이고
"잠금 해제" 버튼으로 즉시 풀 수 있다(확인 다이얼로그 후 실행).
잠긴 계정이 없으면 패널은 접힌 상태의 한 줄로만 표시된다.

해제는 `public.admin_unlock_account()` RPC 를 호출하며,
`public.admin_audit_log` 에 `action='account_unlock'` 으로 남는다(감사 로그 "관리자 이력" 탭에서 확인).

### 권한

조회·해제 모두 관리자만 가능하고, **같은 테넌트 계정만** 대상이 된다.
관리자 판정은 레포 표준(`current_user_role()` / `has_role_at_least('admin')` +
`users.is_admin` 폴백)을 쓰는 `public.is_lockout_admin()` 헬퍼가 담당한다.

### SQL 로 직접 처리

```sql
-- 현재 잠긴 계정
select * from public.locked_accounts;

-- 해제 (이메일 또는 user_id)
select public.admin_unlock_account('user@example.com');
select public.admin_unlock_account(null, '<uuid>');
```

## 알려진 한계

- **SSO(헤더 교환) 경로는 대상이 아니다.** `src/utils/ssoAuth.ts` 로그인은 GoTrue 의
  비밀번호 검증을 거치지 않으므로 훅이 호출되지 않는다. IdP 쪽 잠금 정책이 필요하다.
- **계정 열거 방지와의 관계**: 잠금 메시지("로그인 시도가 너무 많습니다")는 존재하는 계정에만
  뜬다. 1-4(항목 13)의 메시지 통일과는 목적이 다르며, 임계치에 도달해야만 노출된다.
- **분산 시도**: 카운터는 계정 단위다. 여러 계정에 한 번씩 시도하는 패스워드 스프레이는
  이 기능으로 막히지 않는다 — IP 단위 rate limit(Kong, 제외 항목 11) 영역이다.
- 관리자 콘솔에서 `login_lockout` 값을 편집하는 UI 는 아직 없다. 지금은 위 SQL 로 설정한다.
