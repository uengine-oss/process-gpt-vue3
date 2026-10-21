# MFA(TOTP) 운영 가이드 (docs/security.md 2-3, 항목 3)

비밀번호 다음에 인증 앱의 6자리 코드를 한 번 더 확인한다.
서버(GoTrue)의 MFA API, 화면의 등록·챌린지 UI, 테넌트 정책(`configuration.mfa_policy`) 세 조각으로 구성된다.

전 모드(PAL / 비 PAL) 공통으로 동작한다. 다만 **기본값이 "끔"이라 이 변경만으로 기존 로그인 동작은 바뀌지 않는다** —
사용자가 직접 등록했거나 테넌트가 `require_mfa` 를 켠 경우에만 챌린지가 생긴다.

## 정책 요약

| 계층 | 항목 | 값 | 근거 |
| --- | --- | --- | --- |
| GoTrue | TOTP 등록 (`GOTRUE_MFA_TOTP_ENROLL_ENABLED`) | `true` | 사용자가 인증 앱을 등록할 수 있게 한다 |
| GoTrue | TOTP 검증 (`GOTRUE_MFA_TOTP_VERIFY_ENABLED`) | `true` | 로그인 후 챌린지로 세션을 aal2 까지 올린다 |
| DB | 테넌트 필수 여부 (`configuration.mfa_policy`) | `{"require_mfa": false}` | 조직 단위로 필수 전환 |
| 화면 | 등록·해제 | 계정 설정 > 계정 탭 | 사용자가 스스로 켜고 끈다 |
| 화면 | 챌린지 | `/auth/two-step` | 로그인 직후 코드 입력 |

## AAL — 이 기능의 판정 기준

GoTrue 는 액세스 토큰에 `aal`(Authenticator Assurance Level) 클레임을 넣는다.
supabase-js 의 `auth.mfa.getAuthenticatorAssuranceLevel()` 이 이를 두 값으로 돌려준다.

| `currentLevel` | `nextLevel` | 의미 | 화면 동작 |
| --- | --- | --- | --- |
| `aal1` | `aal1` | 검증된 팩터가 없다 (= 미등록) | 테넌트가 필수면 등록 화면으로, 아니면 통과 |
| `aal1` | `aal2` | 등록은 했는데 이번 세션은 아직 코드 미입력 | `/auth/two-step` 으로 |
| `aal2` | `aal2` | 챌린지 통과 | 통과 |
| `null` | `null` | 세션 없음 / 판정 불가 | 통과 (로그인 여부는 다른 가드가 본다) |

중요한 점은 **`nextLevel` 만 보면 팩터 등록 여부를 알 수 있다**는 것이다.
그래서 라우터 가드는 네비게이션마다 `listFactors()`(네트워크) 를 부르지 않는다.
AAL 조회는 저장된 세션의 JWT 를 읽는 로컬 연산이라 비용이 없다.

## 레포에 반영된 설정

### `docker-compose/docker-compose.yaml` → `services.auth.environment`

```yaml
GOTRUE_MFA_TOTP_ENROLL_ENABLED: "true"
GOTRUE_MFA_TOTP_VERIFY_ENABLED: "true"
```

### `kubernetes/supabase-deployment.yaml` → `supabase-auth` 컨테이너 `env`

```yaml
- name: GOTRUE_MFA_TOTP_ENROLL_ENABLED
  value: "true"
- name: GOTRUE_MFA_TOTP_VERIFY_ENABLED
  value: "true"
```

### 버전 요구사항

`GOTRUE_MFA_TOTP_*` 는 GoTrue v2.68.0 이상에서 지원한다.
docker-compose(`v2.177.0`)와 `kubernetes/supabase-deployment.yaml`(`v2.143.0`) 모두 충족한다.
(2-4 잠금 훅과 달리 이 항목은 K8s image 승격이 선행되지 않아도 동작한다.)

더 낮은 이미지로 되돌리면 등록 요청이 422 로 거절되고, 화면은 등록 실패 메시지를 보여 준다.

## 레포 밖 배포에 반영할 때

### Supabase Cloud (호스팅 프로젝트)

Dashboard → Authentication → Multi-Factor Authentication

- TOTP (App Authenticator): **Enabled** (Enroll / Verify 둘 다)
- 요금제 주의: MFA 는 Pro 이상에서 제공된다. Free 프로젝트는 이 화면이 잠겨 있다.

### Supabase CLI (`supabase/config.toml`)

```toml
[auth.mfa]
max_enrolled_factors = 10

[auth.mfa.totp]
enroll_enabled = true
verify_enabled = true
```

## 화면 구성

### 등록 / 해제 — 계정 설정

- 위치: `/account-settings` → "계정 설정" 탭 하단
- 컴포넌트: `src/components/pages/account-settings/MfaSection.vue`
  (`src/components/pages/account-settings/AccountTab.vue` 가 기존 레이아웃 아래에 섹션으로 붙인다)
- 흐름
  1. "2단계 인증 사용" → `auth.mfa.enroll({ factorType: 'totp' })`
  2. 응답의 `totp.qr_code`(SVG data URI)를 그대로 `<img>` 로 렌더하고,
     QR 을 못 쓰는 환경을 위해 `totp.secret` 을 눈 아이콘/복사 버튼과 함께 노출한다.
  3. 인증 앱이 만든 6자리 코드를 받아 `challenge` → `verify` 로 팩터를 확정한다.
  4. 등록된 팩터는 이름·등록 시각과 함께 목록으로 보여 준다.
- 해제: 확인 다이얼로그 + **현재 코드 재검증**(`challenge`+`verify`) 후 `unenroll`.
  코드를 다시 받는 이유는, 잠깐 자리를 비운 브라우저에서 2단계 인증이 소리 없이 꺼지는 것을 막기 위해서다.
- `enroll` 만 하고 코드를 넣지 않은 채 창을 닫으면 `unverified` 팩터가 남는다.
  `friendly_name` 은 계정당 유일해야 해서 다음 등록이 충돌하므로,
  `cleanupUnverifiedFactors()` 가 새 등록을 시작하기 전에 남은 것을 치운다.

### 챌린지 — 로그인 직후

- 경로: `/auth/two-step` (`src/router/AuthRoutes.ts`)
- 화면: `src/views/authentication/SideTwoStep.vue` + `src/components/auth/TwoStepForm.vue`
  (기존 템플릿의 6칸 입력 디자인을 그대로 두고 로직만 연결했다. 자동 포커스 이동·붙여넣기·백스페이스 처리 포함)
- 진입 경로 두 가지
  - `src/stores/auth.ts` 의 `signIn()` — 로그인 성공 직후 AAL 을 보고 바로 분기한다.
    보호 화면이 한 번 깜빡였다가 튕기는 것을 피하려는 것이다.
  - 라우터 가드 — 새로고침·직접 URL 입력·다른 탭에서 온 경우를 잡는다.
- `?redirect=` 쿼리로 원래 목적지를 실어 오고, 검증에 성공하면 그리로 돌아간다.
  값은 `safeRedirectTarget()` 이 검사한다 — `/` 로 시작하되 `//` 가 아닌 같은 출처 경로만 허용하고,
  챌린지 화면 자신으로 되돌아오는 순환도 막는다 (오픈 리다이렉트 방지).

## 라우터 가드

- 구현: `src/utils/mfaGate.ts` (`evaluateMfaGate()`), 호출부는 `src/router/index.ts` 의 `beforeEach`
- 순서: 가입 승인 게이트 → 점검 모드 게이트 → PAL 루트 분기 → **MFA 게이트** → 모드별 분기

| 판정 | 조건 | 이동 |
| --- | --- | --- |
| `challenge` | `currentLevel=aal1`, `nextLevel=aal2` | `/auth/two-step?redirect=<원래 경로>` |
| `enroll` | 미등록 + 테넌트 `require_mfa=true` | `/account-settings?tab=Account&mfaRequired=1` |
| `pass` | 그 외 | 그대로 |

게이트를 적용하지 않는 경로: `/`, `/auth/*`, `/external-forms/*`, `/design-system*`.
로그인·비밀번호 재설정 경로를 막으면 사용자가 빠져나올 방법이 없어진다.
`enroll` 판정에서는 `/account-settings` 자신도 제외한다 (막으면 등록할 화면에 못 들어간다).
다만 `challenge` 판정은 `/account-settings` 에도 적용된다 — 등록을 마친 사용자는 어디서든 코드를 넣어야 한다.

테넌트 관리 서버(`window.$isTenantServer`, www)에서는 `enroll` 판정을 하지 않는다.
그 서버는 `/tenant/*` 밖의 모든 경로를 `/tenant/manage` 로 되돌리기 때문에,
등록 화면으로 보내면 두 리다이렉트가 서로를 불러 순환한다.
`/auth/*` 는 그 서버에서도 열려 있으므로 `challenge` 는 정상 동작한다.

## 테넌트 설정

`public.tenants` 에 컬럼을 더하지 않았다. 세션 타임아웃(`session_timeout`)·잠금 정책(`login_lockout`)과
같은 자리인 `public.configuration` (`tenant_id` + `key` 유일, SELECT 는 인증 사용자 전체,
쓰기는 `has_role_at_least('admin')`) 에 한 행으로 둔다.

| 항목 | 값 |
| --- | --- |
| 테이블 | `public.configuration` |
| `key` | `mfa_policy` |
| `value` (jsonb) | `{ "require_mfa": false }` |

| 상태 | 결과 |
| --- | --- |
| 행 없음 / 값 없음 | `require_mfa = false` (등록은 선택) |
| `require_mfa = true` | 미등록 사용자를 계정 설정으로 유도, aal1 세션은 챌린지로 |
| 조회 실패 | `false` 로 진행 (fail-open) |

조회 실패에 fail-open 을 택한 이유: 설정 조회 장애로 **전 사용자가 등록 화면에 갇히는** 상황이
조회 장애 자체보다 나쁘다. 이미 등록한 사용자의 챌린지는 이 값과 무관하게 AAL 만으로 판정하므로
정책 조회가 실패해도 2단계 인증이 풀리지는 않는다.

```sql
-- MFA 필수로 전환
insert into public.configuration (tenant_id, key, value)
values ('<tenant>', 'mfa_policy', '{"require_mfa": true}'::jsonb)
on conflict (tenant_id, key) do update set value = excluded.value;

-- 다시 선택 사항으로
insert into public.configuration (tenant_id, key, value)
values ('<tenant>', 'mfa_policy', '{"require_mfa": false}'::jsonb)
on conflict (tenant_id, key) do update set value = excluded.value;

-- 등록 현황 확인
select u.email, f.friendly_name, f.status, f.created_at
  from auth.mfa_factors f
  join auth.users u on u.id = f.user_id
 where f.factor_type = 'totp'
 order by f.created_at desc;
```

마이그레이션: `supabase/migrations/20260911000005_mfa_policy.sql`
(값을 심지 않는다 — 유일 제약 확인과 키 문서화만 한다.)

정책 값은 화면에서 60초 TTL 로 캐시한다(`isMfaRequired()`).
관리자가 값을 바꾼 직후 즉시 반영하려면 `invalidateMfaPolicyCache()` 를 부른다.

## SSO(헤더 교환) 경로 제외

`src/utils/ssoAuth.ts` 로 로그인한 세션은 IdP 가 MFA 를 책임지므로 이 기능에서 제외한다.

- 라우터 가드: `evaluateMfaGate()` 가 맨 앞에서 `isSsoAuthenticated()` 면 `pass` 를 돌려준다.
- 등록 UI: `MfaSection.vue` 가 SSO 세션에서는 섹션 자체를 렌더하지 않는다.
  (GoTrue 세션이 아니라 등록을 시도해도 실패한다 — 켤 수 없는 스위치를 보여 주지 않는다.)

`require_mfa = true` 인 테넌트라도 SSO 사용자는 막히지 않는다.
이 경우 실제 2단계 인증은 게이트웨이(IdP) 쪽 정책으로 강제해야 한다.

## 계정 복구

TOTP 기기를 잃으면 사용자가 스스로 풀 방법이 없다 (복구 코드는 GoTrue 가 제공하지 않는다).
지금은 운영자가 DB 에서 팩터를 지워 주는 수동 절차다.

```sql
-- 특정 사용자의 TOTP 팩터 삭제 (다음 로그인에 aal1 로 통과, 재등록 안내)
delete from auth.mfa_factors
 where user_id = (select id from auth.users where email = '<email>');
```

서비스 역할(service_role) 키가 있으면 Admin API `DELETE /admin/users/{id}/factors/{factor_id}` 도 같은 일을 한다.
어느 쪽이든 본인 확인 절차를 거친 뒤에만 수행하고, 수행 사실을 `admin_audit_log` 에 남기는 것이 좋다
(자동 기록은 아직 없다 — 후속 작업).

## 선택 항목: 민감 테이블 RLS 에 aal2 조건 (미적용)

`docs/security.md` 2-3 의 선택 항목이다. **이번 작업에서는 적용하지 않았다.**
적용하려면 대상 테이블의 RLS 정책에 아래 조건을 `AND` 로 덧붙인다.

```sql
alter policy "<policy name>" on public.<table>
  using ( <기존 조건> and (auth.jwt() ->> 'aal') = 'aal2' );
```

`aal` 클레임은 GoTrue 가 액세스 토큰에 직접 넣는 값이라 클라이언트가 위조할 수 없다.
화면 가드와 달리 이건 서버측 강제라, 가드를 우회한 직접 REST 호출도 막힌다.

적용 전 확인할 것.

1. **먼저 `require_mfa = true` 로 전환하고 전원 등록을 마친 뒤에** 켠다.
   미등록 사용자는 aal1 이라 해당 테이블을 아예 읽지 못한다 — 사실상 서비스 중단이다.
2. SSO(헤더 교환) 세션은 GoTrue 세션이 아니라 `aal` 클레임이 없다. 함께 차단되므로
   SSO 사용자가 있는 테넌트에서는 이 옵션을 쓸 수 없다.
3. 서버 배치·트리거 등 `service_role` 경로는 RLS 를 우회하므로 영향받지 않는다.
4. 테넌트 옵션으로 만들려면 정책 조건을
   `((auth.jwt() ->> 'aal') = 'aal2' or not <테넌트의 require_aal2 여부>)` 형태로 써야 하는데,
   정책마다 `configuration` 을 조회하면 쿼리마다 비용이 붙는다. 안정화 함수로 감싸는 설계가 선행돼야 한다.

## 남은 작업

- 관리자 콘솔에서 `mfa_policy.require_mfa` 를 편집하는 UI. 지금은 위 SQL 로 설정한다.
  (세션 타임아웃·잠금 정책도 같은 상태라 설정 화면을 한 번에 만드는 편이 낫다.)
- 관리자 화면의 사용자별 MFA 등록 현황 / 원격 해제 버튼 + `admin_audit_log` 기록.
- 민감 테이블 RLS aal2 조건 (위 선택 항목).
- 복구 코드. GoTrue 가 제공하지 않으므로 자체 테이블로 구현해야 한다.
