# iBPMS 보안 지원여부 확인표 기반 작업 계획

- 작성일: 2026-09-11
- 근거 문서: `iBPMS_보안_지원여부_확인표_작성본.xlsx` (23개 항목)
- 범위: 화면(process-gpt-vue3-main)과 DB(Supabase 마이그레이션·RLS·GoTrue 설정)에서 처리 가능한 항목만 포함.
  TLS·Kong·망분리·IP 제한·OS 패치·백업 스냅샷 등 인프라 영역은 제외.
- 규모 기준: S(1~2일), M(3~5일), L(1~2주)

## 요약

| 단계 | 목표 | 항목 | 규모 합계 |
|---|---|---|---|
| 1 | 이미 있는 코드 활성화 | 14, 16, 13 | S×3 + M×1 |
| 2 | 인증 강화 | 12, 21, 3, 18 | S×1 + M×2 + L×1 |
| 3 | 파일 다운로드 통제 | 8, 9, 18 | M×3 |
| 4 | 데이터 보호 | 6, 5, 17 | S×1 + M×1 + L×1 |

## 1단계: 이미 있는 코드 활성화

코드나 마이그레이션이 이미 존재해 비용 대비 효과가 가장 큰 작업.

### 1-1. 로그인/로그아웃/실패 이력 기록 활성화 (항목 14, S)

- `src/utils/StorageBaseSupabase.js`의 `recordAuthAudit` 본문(현재 주석 처리)을 복원한다.
  호출부는 `signIn`, `signInWithKeycloak`, `signOut`에 이미 연결되어 있다.
- `supabase/migrations/auth_audit_log.sql`을 날짜 접두어 마이그레이션으로 옮겨 정식 적용 대상에 포함한다.
  → 적용 완료: `supabase/migrations/20260911000001_auth_audit_log.sql` (구 파일 삭제).
- 기록 필드: 이메일, 액션, 성공 여부, 오류 메시지, user_id, IP, User-Agent, provider(metadata).
  IP/User-Agent 는 클라이언트 값이 아니라 `record_auth_audit()` RPC 가 서버측 요청 헤더에서 캡처한다.
- 테이블 `public.auth_login_audit` — 기록은 RPC 전용, 조회는 관리자만(RLS), UPDATE/DELETE 차단(append-only).

### 1-2. 로그인 이력 조회 화면 (항목 14, M)

- 관리자 콘솔 감사 로그 화면(`AuditTrail.vue`)에 "로그인 이력" 탭을 추가한다.
- 필터: 기간, 이메일, 액션, 성공 여부. 페이지네이션과 CSV 내보내기는 기존 탭 구현을 재사용한다.
- 이후 3단계 다운로드 이력, 2단계 잠금 계정 표시가 같은 탭 구조를 쓰므로 탭을 확장 가능하게 설계한다.

### 1-3. 감사 로그 actor_id 위변조 차단 (항목 16, S)

- `admin_audit_log` INSERT 트리거를 추가해 `actor_id`를 `auth.uid()`로 강제 덮어쓴다.
- actor 이름·조직·사번은 클라이언트 값 대신 `users` 조회 결과로 채운다.
- 마이그레이션 `20260526_admin_audit_log_append_only.sql`이 범위 밖으로 남겨둔 항목이다.

### 1-4. 로그인 실패 메시지 통합 (항목 13, S)

- `src/components/auth/LoginForm.vue`와 `src/stores/auth.ts`에서 계정 없음/비밀번호 오류를 하나의 문구로 통일한다.
- i18n 키를 정리해 계정 존재 여부가 드러나지 않게 한다.

## 2단계: 인증 강화

GoTrue 설정과 화면 작업을 조합한다. 1단계 로그인 이력 테이블을 재사용한다.

### 2-1. 세션 타임아웃 (항목 12, M) — 반영 완료

- GoTrue 설정: `GOTRUE_SESSIONS_INACTIVITY_TIMEOUT`(`4h`), `GOTRUE_SESSIONS_TIMEBOX`(`12h`)를
  `docker-compose/docker-compose.yaml`(`services.auth`)과 `kubernetes/supabase-deployment.yaml`(`supabase-auth`)에 추가했다.
- `JWT_EXPIRY`(36000초)는 auth 전용이 아니라 rest(`PGRST_APP_SETTINGS_JWT_EXP`)·db(`JWT_EXP`)가 함께 쓰므로 그대로 두고,
  auth 서비스만 `GOTRUE_JWT_EXP: ${GOTRUE_JWT_EXPIRY:-3600}`(1시간)으로 분리했다. K8s 는 `GOTRUE_JWT_EXP: "3600"` 직접 기재.
- 프론트 유휴 타이머: `src/composables/useIdleTimeout.ts` + `src/components/auth/IdleTimeoutDialog.vue`(`src/App.vue` 전역 마운트).
  기본 30분 유휴 → 경고 모달(60초 카운트다운) → `useAuthStore().logout()` 후 로그인 화면.
- SSO(`src/utils/ssoAuth.ts`)도 App.vue 전역 마운트로 같은 타이머가 걸린다. 로그아웃만 `redirectToSsoLogin('idle-timeout')`으로 분기.
  단, 게이트웨이가 `x-playground-*` 헤더를 계속 주입하면 즉시 재로그인될 수 있어 실제 강제는 IdP 세션 정책이 필요하다.
- 타임아웃 값은 `public.configuration`의 `session_timeout` 키(`{"idle_timeout_minutes":30,"warning_seconds":60}`)로 테넌트별 설정한다.
  `idle_timeout_minutes`가 0 이하이면 유휴 타이머 비활성. 마이그레이션 `supabase/migrations/20260911000010_tenant_session_timeout.sql`.
- 관리자 콘솔 편집 UI: `/admin-console/security-settings` (보안 설정 화면, 2026-09-11 반영). 자세한 배포·운영 절차는 `docs/security-gotrue-session-policy.md` 참고.

### 2-2. 비밀번호 정책 (항목 21, S) — 반영 완료

- 규칙: 최소 10자, 영문 대문자·소문자·숫자·특수문자 각 1자 이상, 유출 비밀번호(HIBP) 차단.
- GoTrue 설정: `GOTRUE_PASSWORD_MIN_LENGTH`, `GOTRUE_PASSWORD_REQUIRED_CHARACTERS`, `GOTRUE_PASSWORD_HIBP_ENABLED`를 `docker-compose/docker-compose.yaml`(`services.auth`)과 `kubernetes/supabase-deployment.yaml`(`supabase-auth`)에 추가했다.
- 클라이언트 검증: `src/utils/passwordPolicy.ts`를 회원가입(`RegisterForm.vue`, `TenantRegisterForm.vue`), 비밀번호 재설정(`ResetForm.vue`), 초기 비밀번호 설정(`InitialSettingForm.vue`) 화면이 공유한다. 미충족 조건을 문구로 안내한다.
- 서버 거부 메시지는 `mapPasswordServerError()`로 사용자 문구(`passwordPolicy.server*`)에 매핑한다.
- Supabase Cloud·CLI 등 레포 밖 배포 반영 방법은 `docs/security-gotrue-password-policy.md` 참고.

### 2-3. MFA(TOTP) (항목 3, L) — 반영 완료

- GoTrue 설정: `GOTRUE_MFA_TOTP_ENROLL_ENABLED`, `GOTRUE_MFA_TOTP_VERIFY_ENABLED`를 `docker-compose/docker-compose.yaml`(`services.auth`)과 `kubernetes/supabase-deployment.yaml`(`supabase-auth`)에 추가했다. MFA는 GoTrue v2.68.0 이상이면 동작하므로 양쪽 image 모두 그대로 쓸 수 있다.
- 공용 로직: `src/utils/mfa.ts`(enroll/challenge/verify/unenroll·정책 조회), `src/utils/mfaGate.ts`(라우터 판정·리다이렉트 대상 검사).
- 등록 화면: 계정 설정(`/account-settings`) "계정 설정" 탭 하단에 `src/components/pages/account-settings/MfaSection.vue` 섹션을 추가했다. QR(`totp.qr_code` SVG) + 수동 입력용 secret → 6자리 코드로 확정, 등록된 factor 목록, 해제(확인 다이얼로그 + 현재 코드 재검증 후 `unenroll`). 기존 레이아웃은 그대로 두고 섹션만 덧붙였다.
- 로그인 흐름: `src/stores/auth.ts`의 `signIn()`이 로그인 직후 `getAuthenticatorAssuranceLevel()`로 `aal1`+`nextLevel=aal2`면 `/auth/two-step?redirect=`로 보낸다. 챌린지 화면은 기존 템플릿 `src/views/authentication/SideTwoStep.vue` + `src/components/auth/TwoStepForm.vue`에 로직만 연결했다(디자인 유지). 라우트는 `src/router/AuthRoutes.ts`에 등록.
- 라우터 가드: `src/router/index.ts` `beforeEach`에서 `evaluateMfaGate()` 호출. `aal1`+`aal2` 가능이면 챌린지로, 미등록인데 테넌트가 `require_mfa`면 계정 설정(`?tab=Account&mfaRequired=1`)으로. `/`·`/auth/*`·`/external-forms/*`·`/design-system*`은 제외한다. 판정은 JWT의 `aal` 클레임만 보므로 네비게이션마다 네트워크를 타지 않는다.
- "MFA 필수"는 `public.configuration`의 `mfa_policy` 키(`{"require_mfa": false}`)로 테넌트별 설정한다. 마이그레이션 `supabase/migrations/20260911000005_mfa_policy.sql`(값 미주입, 키 문서화만). 조회 실패 시 fail-open — 설정 장애로 전 사용자가 등록 화면에 갇히지 않게 한다.
- 관리자 콘솔 편집 UI: `/admin-console/security-settings` (보안 설정 화면, 2026-09-11 반영).
- 선택 항목인 민감 테이블 RLS `auth.jwt()->>'aal' = 'aal2'` 조건은 적용하지 않았다. 적용 방법과 선행 조건은 `docs/security-gotrue-mfa-policy.md`에 기록.
- SSO 연동 사용자는 IdP MFA를 따르므로 제외한다 — 가드가 `isSsoAuthenticated()`면 통과시키고, 등록 섹션도 렌더하지 않는다.
- 배포·운영 절차(Supabase Cloud/CLI 반영, 기기 분실 시 복구)는 `docs/security-gotrue-mfa-policy.md` 참고.

### 2-4. 반복 실패 잠금 (항목 18, M) — 반영 완료

- 정책: 최근 15분 내 5회 실패 시 15분 잠금. 잠긴 동안은 비밀번호가 맞아도 거절하고, 추가 시도로 잠금이 연장되지는 않는다. 성공 시 카운터 리셋.
- 마이그레이션 `supabase/migrations/20260911000006_password_lockout_hook.sql`: GoTrue Password Verification Attempt Hook 함수 `public.hook_password_verification_attempt(jsonb)`.
- 카운트의 신뢰 원천은 훅이 직접 기록하는 `public.auth_failed_attempts`다. `auth_login_audit`는 클라이언트 RPC 기록이라 위조·누락이 가능해 판정에 쓰지 않고, "잠금이 걸린 순간"만 `metadata.reason='account_locked'`로 한 줄 남겨 로그인 이력 탭에서 함께 보이게 한다.
- 정책 값은 `public.configuration`의 `login_lockout` 키(`{"max_attempts":5,"window_minutes":15,"lockout_minutes":15}`)로 테넌트별 오버라이드. `max_attempts`가 0 이하이면 비활성. 훅 오류 시 fail-open(로그인 허용).
- GoTrue 설정: `GOTRUE_HOOK_PASSWORD_VERIFICATION_ATTEMPT_ENABLED`/`_URI`를 `docker-compose/docker-compose.yaml`(`services.auth`)과 `kubernetes/supabase-deployment.yaml`(`supabase-auth`)에 추가했다. Auth Hooks는 GoTrue v2.151.0 이상 필요 — K8s 매니페스트는 아직 v2.143.0이라 image 승격이 선행돼야 실제로 동작한다.
- 관리자 화면: `AuditTrail.vue`의 "로그인 이력" 탭 상단에 잠금 계정 패널(이메일·실패 횟수·잠금 시각·해제 예정 시각 + 잠금 해제 버튼). 조회 `public.admin_list_locked_accounts()`, 해제 `public.admin_unlock_account()` — 둘 다 관리자·같은 테넌트로 제한되고 해제는 `admin_audit_log`에 `account_unlock`으로 남는다.
- 적용 순서·운영 절차·한계(SSO 경로 제외, 패스워드 스프레이 미차단)는 `docs/security-gotrue-lockout-policy.md` 참고.

## 3단계: 파일 다운로드 통제

### 3-1. files 버킷 비공개 전환 (항목 8, 9, M)

- `storage.buckets`의 `files` 버킷을 `public = false`로 전환한다 (현재 `20260507_audit_policy.sql`에서 public true).
- 버킷별 `allowed_mime_types`, `file_size_limit`을 설정해 서버 측 확장자·크기 제한을 강제한다.
- `storage.objects` RLS를 테넌트·역할 기준으로 재작성한다. `chat-images` 버킷도 같은 정책을 적용한다.

### 3-2. 서명 URL 전환 (항목 8, M)

- `src/utils/StorageBaseSupabase.js`의 `getFileUrl`, `downloadFile`과 `src/components/ui/SchemaFieldInput.vue`의 `getPublicUrl` 호출을 `createSignedUrl`(만료 시간)로 교체한다.
- `src/stores/adminConsole.ts`의 `files` 버킷 접근(정책문서)도 같은 방식으로 바꾼다.
- 이미 저장된 공개 URL 참조(폼 데이터 등)는 경로만 저장하고 표시 시점에 서명 URL을 생성하도록 정리한다.

### 3-3. 다운로드 이력과 이상 탐지 (항목 8, 18, M) — 반영 완료

- 마이그레이션 `supabase/migrations/20260911000004_file_download_log.sql`.
  - `public.file_download_log`(id, created_at, tenant_id, user_id, email, bucket, path, file_name, action, ip_address, user_agent, metadata). 인덱스: `created_at DESC`, `(tenant_id, created_at DESC)`, `(user_id, created_at DESC)`, `(email, created_at DESC)`.
  - 기록은 `public.record_file_download(bucket, path, file_name, action, metadata)` RPC로만. SECURITY DEFINER이며 `user_id`는 `auth.uid()`로 강제하고 IP·User-Agent는 `request.headers`에서 서버측으로 캡처한다(클라이언트 값 불신). 예외는 삼켜 다운로드 흐름을 깨지 않는다. `record_auth_audit`과 같은 관례.
  - RLS: SELECT는 관리자·같은 테넌트만. INSERT 정책 없음 + `GRANT INSERT` 없음 = 직접 INSERT 차단(RPC 전용). UPDATE/DELETE 정책 없음 = append-only.
  - `action`은 `download`(바이트 직접 수신) / `signed_url`(다운로드 가능한 서명 URL 발급) / `view`(미리보기).
- 기록 호출: 공용 헬퍼 `src/shared/downloadAudit/index.js`의 `recordFileDownload()`(실패해도 절대 던지지 않는다)를 `StorageBaseSupabase.downloadFile`·`getFileUrl`, `PolicyDocumentManager`(다운로드·미리보기), `SchemaFieldInput.downloadFile`, `ProcessGPTBackend`의 마켓플레이스 패키지 다운로드에서 부른다. 표시 전용인 `getImageUrl`과 `createSignedStorageUrl`에는 넣지 않는다 — 목록 한 번에 수십 건이 쌓여 이력이 소음으로 덮인다.
- 이상 탐지: `public.detect_download_anomalies()`가 오늘 사용자별 건수가 임계치를 넘으면 같은 테넌트 관리자에게 `notifications`(type `download_anomaly`) 알림을 넣는다. 임계치는 `public.configuration`의 `download_anomaly` 키(`{"daily_threshold": 100}`, 테넌트 행 → 전역 행 → 기본 100). 중복 알림은 (사용자, 날짜, 받는 관리자)로 결정되는 UUID + `ON CONFLICT DO NOTHING`으로 하루 한 번만.
- pg_cron 스케줄 `download-anomaly-detection`(`0 * * * *`). pg_cron이 없는 환경에서는 등록을 건너뛰고 마이그레이션은 통과하며, 함수는 직접 호출할 수 있다.
- 관리자 화면: `AuditTrail.vue`의 "다운로드 이력" 탭(기간·이메일·버킷 필터, 시각/이메일/파일명(경로 툴팁)/버킷/액션/IP 컬럼, CSV 내보내기). 조회는 `PalModeBackend.getFileDownloadLog()`.
- 후속: `adminConsole` store 통합 (임계치 편집 UI는 `/admin-console/security-settings`에 반영 완료), `uploadFile` 직후의 `getFileUrl` 호출이 `signed_url` 한 줄을 남기는 점(`metadata.source`로 구분 가능).

## 4단계: 데이터 보호

### 4-1. 개인정보 마스킹 (항목 6, L) — 1단계 반영 완료

- 마이그레이션 `supabase/migrations/20260911000007_pii_masking.sql`.
- 마스킹 함수 `public.mask_email()`(`ab***@domain.com`), `public.mask_phone()`(`010-****-1234`,
  하이픈 유무·`+82`·`02` 지역번호 대응). 판정은 `public.pii_visible(uuid)` — **admin 이상이거나 본인 행**이면 원본.
- 마스킹 뷰(모두 `security_invoker = true` → 기반 테이블 RLS 가 호출자 기준으로 그대로 적용):
  `users_masked`, `pending_org_members_masked`, `signup_requests_masked`, `admin_requests_masked`.
  뷰는 `public.rebuild_pii_masked_views()` 가 `information_schema` 를 읽어 생성한다.
  **기반 테이블에 컬럼을 추가하는 마이그레이션은 이 함수를 다시 호출해야 한다** —
  안 하면 뷰를 읽는 화면에서 새 컬럼이 조용히 빈다.
- **전화번호 컬럼은 이 스키마에 존재하지 않는다**(users·조직 테이블 전수 확인). 함수만 준비해 두었고,
  뷰 생성기가 `phone`/`phone_number`/`mobile`/`tel` 계열 컬럼이 생기면 자동으로 마스킹 대상에 넣는다.
- 화면 전환: 조직도(`src/views/organization/`), 가입·권한 승인 목록(`src/services/membershipService.ts`),
  접근권한 관리(`ManageAccessTab.vue`), 사이드바 사용자 목록(`SidebarUserList.vue`).
  백엔드에는 `getMaskedUserList()`(`ProcessGPTBackend.ts`)를 새로 뒀다 — 비 PAL 모드에서는 기존 `getUserList()` 로 위임한다.
- 전환하지 않은 곳: 이메일을 **값(identifier)** 으로 쓰는 경로(owner·담당자 선택 `item-value="email"`,
  채팅 참가자 매칭, 알림 발송, 위임 대상 검색)와 본인 1행 조회(뷰에서도 원본이라 전환 실익 없음).
  마스킹하면 기능이 조용히 깨진다.
- **원본 컬럼 `REVOKE SELECT` 는 아직 적용하지 않았다.** 컬럼 단위 REVOKE 는 `select *` 쿼리 전체를
  거부해 로그인 경로(`StorageBaseSupabase.js` 의 `getUserInfo`/`writeUserData`)가 먼저 막힌다.
  2단계 조건과 순서는 마이그레이션 파일 하단 주석에 적어 두었다.
- 남은 과제(마스킹보다 실효가 큼): `20260403000001_role_based_rls.sql` 의 `users_select_all USING (true)`.
  지금은 인증만 되면 다른 테넌트 행까지 읽힌다. 이것을 좁히기 전에는 마스킹은 화면 노출 축소이지 접근 통제가 아니다.

### 4-2. 프로세스 공개 범위 (항목 5, M)

- `proc_def`에 `visibility`(all / org / private)와 `allowed_org_codes` 컬럼을 추가하고 RLS 조건에 반영한다.
- 프로세스 속성 패널에 공개 범위 선택 UI를 추가한다.

### 4-3. 로그 보관 정책 (항목 17, S)

- 테넌트 설정에 감사 로그 보관 일수를 추가한다.
- pg_cron이 경과 로그를 `_archive` 테이블로 이동한다.
- 관리자 콘솔 설정 화면에 보관 일수를 노출한다.

## 제외 항목

| 항목 | 사유 |
|---|---|
| 7 HTTPS | 인프라(인증서, Kong/nginx TLS) |
| 10 CORS·CSP 헤더 | 게이트웨이·백엔드 설정 |
| 11 API rate limit | Kong 플러그인 |
| 19 망분리 | 인프라 |
| 20 관리자 IP 제한 | Kong ip-restriction |
| 22 패치 | 운영 절차 |
| 23 백업 스냅샷·PITR | 인프라 |
| 1, 2, 4, 15 | 이미 구현되어 추가 작업 없음 (1·2는 환경 구성으로 활성화) |

## 순서 근거

- 1단계는 코드가 이미 있어 착수 비용이 가장 낮다.
- 2단계 MFA와 반복 실패 잠금은 1단계 로그인 이력 테이블을 재사용한다.
- 3단계 다운로드 이력과 4단계 보관 정책은 감사 로그 화면 탭 구조를 공유하므로 1-2에서 탭을 확장 가능하게 잡는다.
- 4단계 마스킹은 조회 화면이 많아 가장 뒤에 두고, 3단계 RLS 재작성과 함께 정책을 설계한다.

