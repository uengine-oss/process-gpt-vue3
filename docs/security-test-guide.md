# 보안 기능 수동 테스트 가이드

- 작성일: 2026-09-11
- 대상: `docs/security.md` 14개 작업 (2026-09-11 이 서버에 적용 완료)
- 환경: 이 서버의 Supabase CLI 스택(`supabase start`, systemd 관리) + 프론트 dev 서버(8088)

## 공통 준비

```bash
# 프론트: http://<서버IP>:8088  (서버 로컬에서는 http://localhost:8088)
# anon 키 얻기
ANON=$(cd ~/process-gpt-vue3 && npx supabase status -o env 2>/dev/null | grep -oP 'ANON_KEY="\K[^"]+')

# DB 접속 (이하 "psql"로 표기)
docker exec -it supabase_db_process-gpt-vue3 psql -U postgres -d postgres
```

- **관리자 계정**과 **일반 계정**이 각각 1개씩 필요하다 (역할별 동작 차이 확인용).
- 관리자 콘솔 화면은 PAL 모드 + 관리자 로그인 상태에서 사이드바에 노출된다.
- 테스트 후 정리용 SQL은 각 절 끝에 있다.

---

## 1-1 / 1-2. 로그인 이력 기록·조회 (항목 14)

**절차**

1. 로그아웃 상태에서 틀린 비밀번호로 로그인 1회, 올바른 비밀번호로 로그인 1회, 로그아웃 1회.
2. 관리자로 로그인 → 관리자 콘솔 → 감사 로그(AuditTrail) → **"로그인 이력" 탭**.
3. 기간·이메일·액션·성공 여부 필터와 CSV 내보내기를 각각 확인.

**기대 결과**: 실패(성공 여부 ✗, 실패 사유 표시) / 성공 / 로그아웃 3건이 시각·이메일·IP·접속 환경과 함께 보인다.

**DB 직접 확인**

```sql
select created_at, email, action, success, error_message, ip_address
from auth_login_audit order by created_at desc limit 10;
```

**권한 확인**: 일반 계정으로 로그인한 브라우저에서는 이 탭 조회가 비어 있어야 한다(RLS가 관리자만 통과).

## 1-3. 감사 로그 actor_id 위변조 차단 (항목 16)

**절차 (SQL로 위조 시도 재현)**

```sql
-- 일반 사용자 세션을 흉내낸다 (실제 사용자 uuid 하나 필요)
select id, username from users limit 3;  -- uuid 확인
begin;
set local role authenticated;
set local request.jwt.claim.sub = '<실제 사용자 uuid>';
insert into admin_audit_log (actor_id, action, target_type, target_id, tenant_id)
values ('ceo@example.com', 'test_forgery', 'test', 't1', 'tym');
reset role;
select actor_id, actor_username, actor_org_name from admin_audit_log
 where action = 'test_forgery';
rollback;  -- 테스트 행을 남기지 않음
```

**기대 결과**: `actor_id`가 위조값 `ceo@example.com`이 아니라 **세션 uuid로 강제 교체**되고, `actor_username`/`actor_org_name`은 users 조회 결과로 채워진다.

**UI 확인**: 관리자 작업(예: 프로세스 계층 변경) 후 감사 로그 탭에서 행위자 이름·조직이 자동으로 채워져 보인다.

## 1-4. 로그인 실패 메시지 통합 (항목 13)

**절차**: 로그인 화면에서 ① 존재하지 않는 이메일 + 아무 비밀번호, ② 존재하는 이메일 + 틀린 비밀번호.

**기대 결과**: 두 경우 모두 **같은 문구** "이메일 또는 비밀번호가 올바르지 않습니다." — 계정 존재 여부를 구분할 수 없어야 한다.

## 2-1. 세션 타임아웃 (항목 12)

**빠른 테스트 (유휴 1분으로 임시 단축)**

```sql
insert into configuration (tenant_id, key, value)
values ('tym', 'session_timeout', '{"idle_timeout_minutes": 1, "warning_seconds": 30}')
on conflict (tenant_id, key) do update set value = excluded.value;
```

1. 로그인 후 새로고침(설정은 로그인 시 로드), 마우스·키보드를 1분간 건드리지 않는다.
2. 경고 모달(카운트다운 + "로그인 유지" 버튼)이 뜨는지 확인.
3. 그대로 두면 30초 후 자동 로그아웃 → 로그인 화면 이동.
4. 다시 로그인 후 모달에서 "로그인 유지"를 누르면 세션이 연장되는지 확인.
5. 탭 2개를 열고 한 탭에서만 움직여도 다른 탭이 로그아웃되지 않는지 확인(멀티탭 동기화).

**GoTrue 측 확인**: `docker exec supabase_auth_process-gpt-vue3 env | grep SESSIONS` → `INACTIVITY_TIMEOUT=4h`, `TIMEBOX=12h`. JWT 만료는 3600초.

**정리**: `delete from configuration where key='session_timeout' and tenant_id='tym';` (미설정 시 기본 30분)

## 2-2. 비밀번호 정책 (항목 21)

**UI**: 회원가입 화면에서 `weakpw`, `longpassword`, `LongPassword1` 등을 입력 → 부족한 조건(길이/대문자/특수문자 등)이 안내 문구로 표시되고 제출이 막힌다. `LongPassword1!`은 통과.

**API (서버 강제 확인 — 클라이언트 우회 불가 검증)**

```bash
curl -s -X POST http://127.0.0.1:54321/auth/v1/signup \
  -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d '{"email":"policy-test@example.com","password":"weakpw"}'
# → 422 weak_password
```

비밀번호 재설정·초기 설정·테넌트 가입 화면에도 같은 규칙이 적용되는지 확인.

## 2-3. MFA TOTP (항목 3)

**등록**

1. 로그인 → **사이드바 하단 사용자 카드의 톱니(계정 설정) 버튼** → `/account-settings` → 계정 설정 탭 하단 **MFA 섹션**.
   (PAL 모드는 상단 헤더가 없어 이 버튼이 유일한 진입점. 비 PAL은 기존처럼 상단 헤더 톱니.)
2. "등록" → QR을 Google Authenticator 등으로 스캔(또는 secret 수동 입력) → 6자리 코드 입력 → 등록 완료 확인.

**로그인 챌린지**

3. 로그아웃 후 다시 로그인 → 자동으로 `/auth/two-step` 챌린지 화면으로 이동.
4. 틀린 코드 → 오류 표시. 올바른 코드 → 원래 목적지로 이동.
5. 챌린지를 통과하지 않은 채 URL로 보호 화면에 직접 접근 → 챌린지로 리다이렉트(라우터 가드).

**해제**: MFA 섹션에서 현재 코드 재검증 후 해제.

**MFA 필수 테넌트 옵션**

```sql
insert into configuration (tenant_id, key, value)
values ('tym', 'mfa_policy', '{"require_mfa": true}')
on conflict (tenant_id, key) do update set value = excluded.value;
```
→ MFA 미등록 계정으로 로그인하면 등록 안내(계정 설정)로 유도된다. 테스트 후 `require_mfa: false`로 되돌릴 것.

**기기 분실 복구(운영자)**: `delete from auth.mfa_factors where user_id = '<uuid>';`

## 2-4. 반복 실패 잠금 (항목 18)

**주의: 실제 계정이 15분 잠기므로 테스트 계정으로 할 것.**

1. 테스트 계정으로 틀린 비밀번호 로그인을 **5회** 반복.
2. 6회째에 **올바른 비밀번호로도** 로그인이 거부되는지 확인("잠시 후 다시 시도" 계열 메시지).
3. 관리자 콘솔 → 감사 로그 → 로그인 이력 탭 상단 **잠금 계정 패널**: 계정·실패 횟수·해제 예정 시각 표시 확인.
4. "잠금 해제" 버튼 → 확인 다이얼로그 → 해제 후 정상 로그인되는지 확인.
5. 해제 이력이 관리자 감사 로그(`account_unlock`)에 남는지 확인.

**SQL로 즉시 해제/정리**

```sql
select * from public.auth_failed_attempts;   -- 카운터 확인
delete from public.auth_failed_attempts;     -- 전체 리셋
```

**정책 변경 테스트**: `configuration` 키 `login_lockout` = `{"max_attempts":3,"window_minutes":5,"lockout_minutes":5}` 넣고 3회 만에 잠기는지 확인.

## 3-1 / 3-2. 버킷 비공개 + 서명 URL (항목 8, 9)

**공개 URL 차단 (비로그인)**

```bash
curl -s "http://127.0.0.1:54321/storage/v1/object/public/files/uploads/아무경로.pdf"
# → "Bucket not found" (public 접근 차단)
```

**서명 URL 동작 (UI)**

1. 폼/속성 패널에서 파일 업로드 → 미리보기·다운로드가 정상 동작.
2. 브라우저 개발자도구 Network 탭에서 파일 요청 URL이 `/storage/v1/object/sign/...?token=...` 형태인지 확인 (`/object/public/` 이면 실패).
3. 채팅 이미지 첨부 → 표시 정상 + 1시간 이상 열어둔 화면에서도 이미지가 깨지지 않는지(자동 재서명).
4. **기존(작업 이전) 업로드 파일**을 여는 화면에서도 열리는지 — 저장된 public URL을 재서명하는 하위 호환 경로 확인.

**확장자/크기 제한 (서버 강제)**: `.exe` 파일 업로드 시도 → 거부. 50MB 초과 파일 → 거부.

**RLS**: 일반 계정으로 로그인한 상태에서 타 테넌트 파일 경로의 서명 URL 발급이 실패하는지(개발자도구 콘솔 오류) 확인.

## 3-3. 다운로드 이력·이상 탐지 (항목 8, 18)

**이력 기록**

1. 아무 파일 다운로드/미리보기 수행.
2. 관리자 콘솔 → 감사 로그 → **"다운로드 이력" 탭**: 시각·이메일·파일명·버킷·액션·IP 확인. CSV 내보내기 확인.

```sql
select created_at, email, bucket, path, action from file_download_log
order by created_at desc limit 10;
```

**이상 탐지 (수동 실행)**

```sql
-- 임계치를 1로 낮춘 뒤 파일 2개 다운로드하고:
insert into configuration (tenant_id, key, value)
values ('tym', 'download_anomaly', '{"daily_threshold": 1}')
on conflict (tenant_id, key) do update set value = excluded.value;

select public.detect_download_anomalies();
-- 현재 이 DB에는 notifications 테이블이 없어 결과에 skipped 로 표시된다 (아래 미비사항 #2)
```

크론 등록 확인: `select jobname, schedule from cron.job;` → `download-anomaly-detection` 매시.

## 4-1. 개인정보 마스킹 (항목 6)

**UI**

1. **일반 계정**(viewer/editor)으로 로그인 → 조직도, 계정 관리(ManageAccess), 사이드바 사용자 목록에서 이메일이 `ab***@domain.com` 형태로 보이는지 확인.
2. **관리자 계정** → 같은 화면에서 원본 이메일이 보이는지 확인.
3. 본인 행은 일반 계정에서도 원본이 보인다.

**SQL**

```sql
begin;
set local role authenticated;
set local request.jwt.claim.sub = '<일반 사용자 uuid>';
set local request.jwt.claims = '{"sub":"<같은 uuid>","app_metadata":{"tenant_id":"tym"}}';
select email from users_masked limit 5;   -- 본인 외 마스킹
rollback;
```

**주의**: 마스킹은 화면 표시용이다. 담당자 지정·채팅 등 기능 화면은 의도적으로 원본을 유지한다(이메일이 식별자). 접근 통제 관점의 한계는 미비사항 #5 참조.

## 4-2. 프로세스 공개 범위 (항목 5)

1. PAL 모드에서 프로세스 계층 화면 → 프로세스 선택 → 속성 패널 → **"공개 범위"** 섹션.
2. `비공개`로 저장 → **다른 일반 계정**으로 로그인하면 해당 프로세스가 목록에서 사라짐. 작성자·관리자에게는 보임.
3. `조직 한정` + 특정 팀 선택 → 그 팀(및 하위 팀) 소속만 보임. 상위 본부를 선택하면 하위 팀원도 보임.
4. `전체 공개`로 되돌리면 기존과 동일.
5. 비 PAL 모드에서는 이 섹션이 노출되지 않아야 한다.

**목록 숨김·직접 접근 안내 (2026-09-11 추가)**

6. 권한 없는 계정으로: **프로세스 계층 트리**와 **프로세스 체계도(`/process-architecture`)** 의 카드·트리·매트릭스 뷰, 상단 카운트, 검색, 담당자/시스템 필터 드롭다운, Excel/PDF/JSON 내보내기 어디에도 해당 프로세스가 나타나지 않아야 한다 (mega/major 구조는 유지, sub만 숨김).
7. 권한 없는 프로세스의 URL(`/process-hierarchy?id=...`)로 직접 진입 → 캔버스 중앙에 **"이 프로세스를 볼 수 있는 권한이 없습니다"** 안내 + "체계도로 돌아가기" 버튼. CallActivity 드릴다운으로 진입해도 동일 안내(토스트).
8. 권한 있는 계정(작성자·해당 조직·관리자)에게는 6·7 모두 기존과 동일하게 보여야 한다. 체계도에서 드래그 이동·이름 변경 후 저장해도 **숨겨진 프로세스가 proc_map에서 삭제되지 않는지**(다른 계정으로 재확인) 점검.

```sql
select id, name, visibility, allowed_org_codes from proc_def
 where visibility is distinct from 'all';
```

## 4-3. 로그 보관 정책 (항목 17)

1. 관리자 콘솔 → 시스템 운영(SystemOperations) → **"감사 로그 보관 정책"** 섹션 → 보관 일수 입력(30~3650 검증 확인) → 저장.
2. 저장 자체가 감사 로그(`audit_retention_update`)에 남는지 확인.

**아카이브 수동 실행 테스트**

```sql
-- 보관 일수를 최소(30)로 잡고 31일 전 날짜의 테스트 로그를 하나 만들어 실행
insert into auth_login_audit (email, action, success, created_at)
values ('archive-test@example.com', 'login', true, now() - interval '31 days');
select public.archive_expired_audit_logs();
select count(*) from auth_login_audit_archive;   -- 이동 확인
delete from auth_login_audit_archive where email='archive-test@example.com';
```

크론 확인: `select jobname, schedule from cron.job;` → `audit-log-retention` `0 18 * * *` (= KST 03:00).

---

# 2026-09-11 추가분 (관리자 UI · users RLS · notifications)

## 보안 설정 관리자 화면

1. 관리자로 로그인 → 좌측 사이드바 **"보안 설정"** 메뉴 (`/admin-console/security-settings`). 일반 계정에는 메뉴가 보이지 않아야 한다.
2. 5개 섹션(세션 타임아웃 / 로그인 잠금 / MFA / 다운로드 이상 탐지 / 감사 로그 보관) 각각:
   - 미설정 상태면 **"기본값 사용 중"** 배지 확인.
   - 범위 밖 값(예: 세션 유휴 -1, 잠금 횟수 문자열) 입력 → 검증 오류로 저장 차단.
   - 값 변경 후 저장 → 성공 피드백, `configuration` 테이블 반영 확인:
     ```sql
     select key, value from configuration
      where key in ('session_timeout','login_lockout','mfa_policy','download_anomaly','audit_log_retention');
     ```
   - 저장 이력이 감사 로그 탭에 `security_settings_update`로 남는지 확인.
3. **반영 시점 주의** (화면 안내 문구와 동일): 세션 타임아웃은 사용자 다음 접속부터, 잠금·MFA는 다음 로그인 시도부터, 이상 탐지는 다음 매시 작업부터.
4. 기존 SystemOperations 화면에서 "감사 로그 보관 정책" 섹션이 **사라졌는지**(보안 설정으로 이동) 확인.

## users RLS 테넌트 축소 (#5)

**anon 차단 (핵심)**

```bash
curl -s "http://127.0.0.1:54321/rest/v1/users?select=email&limit=3" \
  -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
# → []  (변경 전에는 전 테넌트 email이 나왔다)
```

**로그인 회귀 없음**: 정상 로그인 / 틀린 비밀번호(통합 문구) / 미등록 이메일(같은 문구) 모두 기존과 동일해야 한다. 사전 조회는 `login_precheck` RPC(boolean)로 전환됨:

```bash
curl -s -X POST "http://127.0.0.1:54321/rest/v1/rpc/login_precheck" \
  -H "apikey: $ANON" -H "Authorization: Bearer $ANON" -H "Content-Type: application/json" \
  -d '{"p_email":"<이메일>","p_tenant_id":"tym"}'   # → true/false
```

**화면 회귀**: 사용자 목록·조직도·리뷰어 선택·채팅 참가자가 정상(전부 자기 테넌트 조회). `/external-forms/*`의 사용자 선택 필드는 비로그인 시 **의도적으로 빈 목록**(아래 미비사항 참조).

## notifications 테이블 (#2)

```sql
-- 테이블·정책 존재 확인
\d notifications
-- 이상 탐지 e2e (검증 완료된 절차): 임계치 1 + 오늘 다운로드 2건 → 관리자 알림 적재, 재실행 시 0건(중복 방지)
```

- 알림함(종 아이콘) 표시, 읽음 처리, 채팅/업무 알림 생성이 기존대로 동작하는지 확인.
- realtime: 브라우저 2개(서로 다른 계정)로 접속해 한쪽에만 온 알림이 **다른 쪽 브라우저에 이벤트로 흘러가지 않는지** (RLS 적용 전에는 전 브라우저로 브로드캐스트됐음).
- 남의 알림 읽음 처리 시도 → 0건 처리(위조 차단), 내 알림의 `url`/`title` 변경 시도 → 조용히 원복.

---

# 미비 사항 (후속 과제)

**2026-09-11 해소됨**: ~~#2 notifications 부재~~ → `20260911000012`로 생성·적재 검증 완료 / ~~#4 관리자 UI~~ → `/admin-console/security-settings` / ~~#5 users RLS~~ → `20260911000011` + `login_precheck` RPC.

## 이 서버(스택) 한정

| # | 항목 | 내용 |
|---|---|---|
| 1 | **HIBP(유출 비밀번호 차단) 미적용** | Supabase CLI `config.toml`에 옵션이 노출되지 않음. Supabase Cloud/self-host env 배포에서만 `GOTRUE_PASSWORD_HIBP_ENABLED`로 적용 가능(compose/K8s 파일에는 반영돼 있음) |
| 2 | fcm 푸시 발송은 별개 | notifications **테이블·적재**는 해결됐으나, 실제 모바일 푸시는 fcm_service(process-gpt-completion)가 돌고 FCM 키가 설정돼 있어야 한다. 인앱 알림함은 테이블만으로 동작 |
| 3 | K8s 배포 시 잠금 훅 무동작 | `kubernetes/supabase-deployment.yaml`의 GoTrue 이미지 v2.143.0 < 훅 요구 v2.151.0. 이미지 승격 필요. 같은 파일 라인 215 부근에 기존 YAML 오류도 있어 현재 `kubectl apply` 불가 |

## 보안 잔여 리스크 (구현 범위 밖 발견 사항)

| # | 항목 | 내용 |
|---|---|---|
| 5-a | `/external-forms` 사용자 선택 필드 | users RLS 축소로 비로그인 방문자에게 빈 목록(의도된 차단, 오류 아님). 외부 폼에 이 필드를 쓴다면 폼 지정 후보만 반환하는 SECURITY DEFINER RPC 별도 설계 필요 |
| 5-b | 비 PAL 라우터에 세션 가드 없음 | `requiresAuth` 메타가 선언만 되고 어디서도 읽히지 않음 (`membershipGate.ts`는 PAL 전용). 별도 과제 |
| 5-c | notifications 임의 INSERT 개방 | 클라이언트가 남 앞으로 알림(피싱 URL 포함)을 넣을 수 있는 것은 RLS 적용 전과 동일 수준. 트리거 SECURITY DEFINER 전환 + upsert의 무의미한 `ON CONFLICT` 제거 후 INSERT를 RPC로 옮기면 정책을 "본인 것만"으로 좁힐 수 있음 (`20260911000012` 주석 참고) |
| 5-d | 알림함 uuid 조회 불능 | `sb-127-auth-token` localStorage 키 하드코딩(`ProcessGPTBackend.ts:3848` 등) — URL이 127.0.0.1일 때만 유효해 운영에서 알림함이 이메일로만 조회됨. uuid 수신 알림·콤마 목록 수신자는 화면에 안 뜸(기존 문제) |
| 6 | PII 컬럼 REVOKE 미적용 | `select('*')` 로그인 경로가 깨져 1단계에서 보류. 4단계 적용 계획이 `20260911000007_pii_masking.sql` 하단 주석에 있음 |
| 7 | 뷰 36건 전부 `security_invoker` 미설정 | owner 권한으로 RLS 우회. 특히 `v_review_board`는 owner 필드 값이 실질 email — proc_def owner를 uuid로 옮기는 것이 근본 해결 |
| 8 | 회원가입 계정 열거 | "이미 가입된 이메일입니다" 노출(`StorageBaseSupabase.js` signUp). 로그인 쪽 타이밍 사이드채널(미등록 이메일은 Auth 왕복 없이 즉시 반환)도 존재 |
| 9 | `admin_audit_log` 잔여 구멍 | anon 키 직접 INSERT는 트리거 우회(세션 없음 분기), `created_at`/`tenant_id`는 클라이언트 값 신뢰 |
| 10 | 스토리지 테넌트 격리 불완전 | 업로드 경로에 테넌트 프리픽스가 없어 owner 유실 레거시 객체는 테넌트 간 열람 가능. 경로 체계 변경 + 기존 객체 이관 필요 |
| 11 | SSO 경로 전반 미커버 | `ssoAuth.ts` 경로는 감사 기록·잠금·MFA 전부 대상 외(IdP 정책 필요). 현재 호출부 없는 휴면 코드. Keycloak OAuth 최종 성공 로그인도 미기록 |
| 12 | MFA 복구 코드 없음 | GoTrue 미제공. 기기 분실 시 운영자가 `auth.mfa_factors` 수동 삭제. 자체 복구 코드 테이블 검토 |
| 13 | 잠금은 계정 단위 | 패스워드 스프레이(계정당 1회 분산)는 IP rate limit(Kong, 제외 항목 11) 영역 |
| 14 | 조직도 편집자(owner)는 마스킹 미적용 | 편집 시 원본 email을 JSON에 저장해야 해서 예외. 조직도 노드의 email 저장 제거 + uuid 매칭 전환이 선행 조건 |
| 15 | 아카이브 조회 UI 없음 | `*_archive` 테이블을 보는 화면 없음(AuditTrail에 "보관된 로그" 탭 후보) |
| 16 | 업로드 직후 `signed_url` 로그 소음 | `uploadFile`이 업로드 후 `getFileUrl`을 불러 다운로드 이력에 1건씩 남음(`metadata.source`로 구분은 가능) |

## 기타

- 모든 변경은 **아직 커밋 전** 작업트리 상태다 (마이그레이션 리네임 git mv 2건 포함).
- 감사 로그 조회 화면·마스킹 전환 화면은 PAL 모드 기준. 비 PAL 모드 동작은 기존과 동일하게 유지됨.
