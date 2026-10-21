# 비밀번호 정책 운영 가이드 (docs/security.md 2-2, 항목 21)

전 모드(PAL / 비 PAL) 공통으로 적용되는 보안 설정이다.

## 정책 규칙

| 항목 | 값 |
| --- | --- |
| 최소 길이 | 10자 |
| 필수 구성 | 영문 소문자, 영문 대문자, 숫자, 특수문자 각 1자 이상 |
| 특수문자 집합 | ``!@#$%^&*()_+-=[]{};'\":\|<>?,./`~`` |
| 유출 비밀번호 차단 | HaveIBeenPwned(HIBP) 조회 활성화 |

## 구현 위치

- 클라이언트 검증: `src/utils/passwordPolicy.ts` (회원가입 / 비밀번호 재설정 / 초기 설정 화면 공통)
- 서버 강제: GoTrue 환경변수 (아래)

두 곳의 규칙은 항상 같이 바꿔야 한다.

## 레포에 반영된 설정

- `docker-compose/docker-compose.yaml` → `services.auth.environment`
- `kubernetes/supabase-deployment.yaml` → `supabase-auth` 컨테이너 `env`

```yaml
GOTRUE_PASSWORD_MIN_LENGTH: "10"
GOTRUE_PASSWORD_REQUIRED_CHARACTERS: "abcdefghijklmnopqrstuvwxyz:ABCDEFGHIJKLMNOPQRSTUVWXYZ:0123456789:!@#$%^&*()_+-=[]{};'\\\":|<>?,./`~"
GOTRUE_PASSWORD_HIBP_ENABLED: "true"
```

`GOTRUE_PASSWORD_REQUIRED_CHARACTERS`는 `:` 로 구분된 각 집합에서 최소 1자를 요구한다.
docker-compose에서는 `$` 가 변수 보간 문자이므로 `$$` 로 이스케이프해서 기재한다
(`!@#$$%^&*()...`). K8s 매니페스트에는 `$` 를 그대로 쓴다.

## 레포 밖 배포에 반영할 때

### Supabase Cloud (호스팅 프로젝트)

Dashboard → Authentication → Policies(Password) 에서 동일하게 설정한다.

- Minimum password length: `10`
- Password Requirements: `Lowercase, uppercase letters, digits and symbols`
- Prevent use of leaked passwords: `Enabled` (Pro 이상 플랜에서 사용 가능)

### Supabase CLI (`supabase/config.toml`)

```toml
[auth]
password_min_length = 10
password_requirements = "lower_upper_letters_digits_symbols"
```

### 버전 요구사항

`GOTRUE_PASSWORD_HIBP_ENABLED`와 `GOTRUE_PASSWORD_REQUIRED_CHARACTERS`는 비교적 최신 GoTrue에서 지원한다.
`kubernetes/supabase-deployment.yaml`의 이미지가 `supabase/gotrue:v2.143.0`으로 docker-compose(`v2.177.0`)보다 낮으므로,
K8s 환경에서 HIBP가 동작하지 않으면 이미지 태그를 docker-compose와 맞춘 뒤 재배포한다.

## 서버 거부 메시지 매핑

GoTrue가 정책 위반으로 거부하면 영문 원문(`Password should be at least 10 characters.` 등)이 내려온다.
`src/utils/passwordPolicy.ts`의 `mapPasswordServerError()`가 아래 케이스를 사용자 문구로 변환한다.

| GoTrue 응답 | 화면 문구 키 |
| --- | --- |
| `weak_password`, `Password should be at least ...`, `Password should contain at least one character of each: ...` | `passwordPolicy.serverRejected` |
| `This password is known to be weak and easy to guess...` (HIBP) | `passwordPolicy.serverLeaked` |
| `New password should be different from the old password.` | `passwordPolicy.serverSameAsOld` |

i18n 키는 `src/utils/locales/ko.json`, `src/utils/locales/en.json`의 `passwordPolicy` 섹션에 있다.
