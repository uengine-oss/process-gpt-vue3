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
- 기록 필드: 이메일, 액션, 성공 여부, 오류 메시지, user_id, IP, User-Agent, provider(metadata).

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

### 2-1. 세션 타임아웃 (항목 12, M)

- GoTrue 설정: `GOTRUE_SESSIONS_INACTIVITY_TIMEOUT`, `GOTRUE_SESSIONS_TIMEBOX`를 docker-compose와 K8s 매니페스트에 추가한다. `JWT_EXPIRY`(현재 36000초)를 단축한다.
- 프론트 유휴 타이머: 마우스·키 입력을 감지해 N분 미사용 시 경고 모달, 만료 시 `signOut` 후 로그인 화면으로 이동.
- SSO 헤더 교환 토큰은 GoTrue 세션 정책 밖이므로 `src/utils/ssoAuth.ts` 경로에도 같은 타이머를 적용한다.
- 타임아웃 값은 테넌트 설정으로 노출한다.

### 2-2. 비밀번호 정책 (항목 21, S)

- GoTrue 설정: `GOTRUE_PASSWORD_MIN_LENGTH`, `GOTRUE_PASSWORD_REQUIRED_CHARACTERS`, `GOTRUE_PASSWORD_HIBP_ENABLED`.
- 회원가입·비밀번호 변경 화면에 동일 규칙의 클라이언트 검증과 안내 문구를 추가한다.

### 2-3. MFA(TOTP) (항목 3, L)

- GoTrue 설정: `GOTRUE_MFA_TOTP_ENROLL_ENABLED`, `GOTRUE_MFA_TOTP_VERIFY_ENABLED`.
- 등록 화면: 프로필 화면에 MFA 등록(QR 표시, 6자리 검증, 해제). supabase-js `auth.mfa.enroll/challenge/verify` 사용.
- 로그인 흐름: 로그인 후 `aal1`이면 challenge 화면으로 라우팅. 기존 `src/views/authentication/SideTwoStep.vue`, `src/components/auth/TwoStepForm.vue` 템플릿을 실제 흐름에 연결한다.
- 관리자 콘솔에 "MFA 필수" 테넌트 설정을 추가하고, 필수인 경우 라우터 가드에서 `aal2` 미충족 시 차단한다.
- 선택: 민감 테이블 RLS에 `auth.jwt()->>'aal' = 'aal2'` 조건을 테넌트 옵션으로 추가한다.
- SSO 연동 사용자는 IdP MFA를 따르므로 제외한다.

### 2-4. 반복 실패 잠금 (항목 18, M)

- Password Verification Attempt Hook용 Postgres 함수 마이그레이션. N회 실패 시 M분 차단하고 실패 카운트를 `auth_login_audit`와 연계한다.
- GoTrue 설정: `GOTRUE_HOOK_PASSWORD_VERIFICATION_ATTEMPT_ENABLED`, `_URI`.
- 관리자 로그인 이력 탭에 "잠금 계정" 표시와 잠금 해제 버튼을 추가한다.

## 3단계: 파일 다운로드 통제

### 3-1. files 버킷 비공개 전환 (항목 8, 9, M)

- `storage.buckets`의 `files` 버킷을 `public = false`로 전환한다 (현재 `20260507_audit_policy.sql`에서 public true).
- 버킷별 `allowed_mime_types`, `file_size_limit`을 설정해 서버 측 확장자·크기 제한을 강제한다.
- `storage.objects` RLS를 테넌트·역할 기준으로 재작성한다. `chat-images` 버킷도 같은 정책을 적용한다.

### 3-2. 서명 URL 전환 (항목 8, M)

- `src/utils/StorageBaseSupabase.js`의 `getFileUrl`, `downloadFile`과 `src/components/ui/SchemaFieldInput.vue`의 `getPublicUrl` 호출을 `createSignedUrl`(만료 시간)로 교체한다.
- `src/stores/adminConsole.ts`의 `files` 버킷 접근(정책문서)도 같은 방식으로 바꾼다.
- 이미 저장된 공개 URL 참조(폼 데이터 등)는 경로만 저장하고 표시 시점에 서명 URL을 생성하도록 정리한다.

### 3-3. 다운로드 이력과 이상 탐지 (항목 8, 18, M)

- `file_download_log` 테이블과 기록 RPC를 추가하고 다운로드 시 호출한다.
- 감사 로그 화면에 "다운로드 이력" 탭을 추가한다.
- pg_cron 작업으로 사용자별 일 다운로드 건수가 임계치를 넘으면 `notifications`에 관리자 알림을 적재한다.

## 4단계: 데이터 보호

### 4-1. 개인정보 마스킹 (항목 6, L)

- `users`와 조직 테이블의 이메일·전화 컬럼에 대해 `security_invoker` 마스킹 뷰를 만들고, admin 역할만 원본을 조회하게 한다.
- 조직도, 사용자 목록, 감사 로그, 리뷰어 선택 등 개인정보를 표시하는 화면의 조회를 뷰로 전환한다.
- 원본 컬럼은 일반 역할에서 `REVOKE SELECT`로 숨긴다.

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
