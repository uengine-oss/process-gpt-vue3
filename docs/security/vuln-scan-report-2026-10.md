# 취약점 점검 보고서 — 2026-10 (spec 011-vuln-scan)

- 점검일: 2026-10-01
- 대상: `process-gpt-vue3` 저장소 (프론트엔드 · `server.js` · `gateway/` · Dockerfile · Kubernetes 매니페스트)
- 게이트: **Critical / High 0건** — 로컬 `scripts/security/scan.sh`, CI `.github/workflows/security-scan.yml`

## 1. 결과 요약

| 영역 | 도구 | 조치 전 (Critical / High) | 조치 후 (Critical / High) |
|---|---|---|---|
| SCA · npm | `npm audit` | **38 / 24** | 0 / 0 |
| SCA · gateway (Maven) | Trivy | **6 / 50** (Spring Boot 2.3.12, Spring4Shell CVE-2022-22965 포함) | 0 / 0 |
| 시크릿 | gitleaks | **실제 유출 4건** (+ 오탐 다수) | 0 |
| 코드 취약점 (gateway 인증) | 수동 점검 | **Critical 1건** — JWT 서명 미검증 통과 | 해소 |
| SAST | Semgrep (저장소 룰 + p/javascript·typescript·java) | 0 / 0 (ERROR 등급) | 0 / 0 |
| IaC | Trivy config | **0 / 23** | 0 / 0 (경로 한정 예외 1건) |

Medium/Low는 게이트 대상이 아니다. 조치 후 npm Moderate 5 · Low 1이 남아 있다(`npm audit` 참고).

## 2. 주요 발견과 조치

### 2.1 [Critical] gateway가 위조 JWT를 통과시킴

`ForwardHostHeaderFilter`는 토큰을 HS256 공유 시크릿으로만 검증했다. Supabase(GoTrue v2.196)는 로그인 사용자 토큰을 **ES256**(비대칭 키)으로 서명하므로 검증이 항상 실패했다. 이때 `/completion/*`, `/agent/*`, `/memento/*`, `/robo/*` 경로는 **payload만 디코드해 통과시키는 폴백**을 탔다. 그 결과 임의로 만든 토큰(alg=none, 위조 서명, 만료, 변조)이 모두 백엔드로 전달됐다.

| 토큰 | 조치 전 | 조치 후 |
|---|---|---|
| 정상 ES256 (Supabase 키) | 통과 | 통과 |
| 정상 HS256 (JWT secret, service_role 등) | 통과 | 통과 |
| 만료 | **통과** | 401 |
| payload 변조 | **통과** | 401 |
| 임의 키로 서명 | **통과** | 401 |
| `alg: none` | **통과** | 401 |

조치 내용:
- `gateway/src/main/java/shop/JwtVerifier.java`를 신설했다.
  - HS*: `SECRET_KEY`
  - ES*/RS*: Supabase JWKS의 `kid`별 공개키. 모르는 `kid`를 만나면 재조회하되 60초에 한 번으로 제한한다.
- 페이로드 폴백과 하드코딩 기본 시크릿을 제거했다.
- 검증은 `boundedElastic`에서 수행해 이벤트 루프를 막지 않는다.
- JWKS 주소는 `SUPABASE_JWKS_URL`, 없으면 `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`, 그것도 없으면 `http://127.0.0.1:54321/...` 순으로 정한다. k8s 매니페스트에 `SUPABASE_URL`을 추가했다.

### 2.2 [Critical/High] gateway 프레임워크 EOL

| | 조치 전 | 조치 후 |
|---|---|---|
| Spring Boot | 2.3.12 (EOL) | 4.0.8 |
| Spring Cloud | Hoxton.SR12 | 2025.1.3 (Gateway 5.0.3) |
| 빌드 Java | 1.8 | 17 |
| 실행 이미지 | temurin 11 JDK | temurin 21 JRE |
| jjwt | 0.9.1 | 0.13.0 |
| jaxb | 포함 | 제거 (불필요) |

- `jackson-databind`의 HIGH CVE 때문에 BOM을 고정했다: `jackson-bom` 3.1.7, `jackson-2-bom` 2.21.7.
- `application.yml`을 이관했다.
  - `spring.profiles` → `spring.config.activate.on-profile`
  - `spring.cloud.gateway.*` → `spring.cloud.gateway.server.webflux.*`
  - `allowedOrigins: '*'` + `allowCredentials` → `allowedOriginPatterns: '*'` (기존 동작과 동일)
- 회귀 확인 항목: 라우팅, 테넌트 일치/불일치, CORS preflight, `/health`, docker 프로파일 기동.

### 2.3 [Critical/High] npm 의존성

| 조치 | 대상 |
|---|---|
| 미사용 패키지 제거 | `update`(Critical 체인 30여 건의 원인), `html2pdf.js`, `@iconify/tools`, `@intlify/vite-plugin-vue-i18n`, `@vitejs/plugin-vue-jsx`, `@modyfi/vite-plugin-yaml`, `vite-plugin-monaco-editor`, `unplugin-vue-define-options` |
| 상향 | `jspdf` 2.5 → 4.2.1 · `jsondiffpatch` 0.6 → 0.7.6 · `vite` 4.5 → 6.4.3 · `@vitejs/plugin-vue` 4 → 5.2.4 · `vite-plugin-vuetify` 1 → 2.1.3 |
| 전이 의존성 고정 (`overrides` + yarn `resolutions`) | `underscore` ^1.13.8 (jsonpath) · `js-cookie` ^3.0.8 (@neo4j-nvl) · `postcss` ^8.5.23 (vue3-perfect-scrollbar) · `image-size` ^2.0.3 (pptxgenjs, 브라우저 번들은 미사용) |

- `deploy-prod.yaml`은 yarn으로 잠금파일 없이 설치한다. yarn v1은 `overrides`를 읽지 않으므로 같은 값을 `resolutions`에도 두었다. 두 곳은 항상 함께 고친다.
- 검증 결과:
  - `vue-tsc` + `vite build` 성공, 모바일 빌드 성공, 단위 테스트 741/741 통과.
  - vite 6 개발 서버에서 로그인 → 프로세스 체계도 → 대시보드를 확인했고, 콘솔 오류는 vite 4와 동일(기존 오류)했다.
  - jsPDF 4(`new jsPDF('l','mm','a4')`, `addImage`, 다중 페이지)와 jsondiffpatch 0.7(`create/diff/patch/reverse`)을 실제 호출해 확인했다.

### 2.4 시크릿 유출

| 위치 | 내용 | 조치 | **소유자 후속 조치** |
|---|---|---|---|
| `src/.../MessageEventDefinitionPanel.vue` | GitHub PAT `ghp_…` (2024-06부터 커밋 이력 + 프론트 번들에 포함) | 기본값을 빈 값으로 변경 | **즉시 폐기(revoke)** |
| `scanning_linux.sh` | BlackDuck API 토큰 | `BLACKDUCK_API_TOKEN` 환경변수로 대체 | **토큰 재발급** |
| `supabase/config.toml` | Keycloak client secret | `env(SUPABASE_AUTH_EXTERNAL_KEYCLOAK_SECRET)` + `supabase/.env`(git 미추적, 0600) | **Keycloak에서 secret 재생성** 후 `supabase/.env` 갱신 |
| `kubernetes/cluster-issuer.yaml` | AWS Access Key ID | `accessKeyIDSecretRef`로 대체 | 적용 전 `route53-credentials` Secret에 `accessKeyID` 키 추가 |

> 파일에서 지워도 **git 이력에는 남는다.** 폐기·재발급만이 실제 해소다. 이력 재작성(filter-repo)은 공개 저장소 특성상 효과가 제한적이어서 하지 않았다.

오탐은 `.gitleaks.toml` 허용목록에 근거와 함께 두었다: `.env.example`의 Supabase 공식 데모 값, LLM 모델 식별자, UI 예시 문자열.

### 2.5 IaC

| 대상 | 조치 |
|---|---|
| `Dockerfile` (프론트) | non-root(1000)로 실행. 빌드 산출물은 `/opt/www-dist`에 두고 `run.sh`가 `/opt/www`로 복사 → 읽기 전용 루트 FS에서도 동작. `--read-only` + tmpfs 실행 검증 완료 |
| `gateway/Dockerfile` | temurin 21 JRE, uid 10001, `apt-get` 제거. 읽기 전용 실행 검증 완료 |
| `proxies/litellm-proxy/Dockerfile` | uid 10001 |
| `kubernetes/*.yaml`, `gateway/kubernetes/deployment.yml` | pod seccomp `RuntimeDefault`, 컨테이너 `readOnlyRootFilesystem` · `allowPrivilegeEscalation: false` · `capabilities.drop: ALL`, `/tmp` emptyDir. 프론트는 `/opt/www` emptyDir + `runAsNonRoot` |

> 이 저장소의 `kubernetes/` 매니페스트는 참고용이다. 실제 배포는 GitOps 저장소 `uengine-oss/process-gpt-k8s`가 담당한다. 같은 보안 설정을 그쪽에도 반영해야 하며, 프론트의 `/opt/www` emptyDir은 이번 변경 이후 빌드된 이미지에서만 동작한다.

**예외 (`.trivyignore.yaml`)**

| ID | 경로 | 사유 | 만료 |
|---|---|---|---|
| DS-0002 | `docker-compose/supabase-postgres-age/Dockerfile` | postgres entrypoint가 root로 시작해 gosu로 강등하는 구조. USER 변경 시 initdb 실패 | 2027-03-31 |

## 3. 상시 점검 (CI)

`.github/workflows/security-scan.yml`

- **실행 시점**: 모든 push · PR, 매주 월요일 09:00 KST(신규 CVE 감지), 수동 실행.
- **구성**: 5개 잡(npm · maven · secrets · sast · iac)이 병렬로 돌며 하나라도 Critical/High가 있으면 실패한다.
- **결과 위치**: SARIF를 GitHub Security 탭에 올리고, 리포트는 아티팩트로 30일 보관한다.
- **스캐너 버전**: 이미지 버전을 고정했다(trivy 0.74.0 · gitleaks v8.30.1 · semgrep 1.177.0). 서드파티 액션 대신 공식 이미지를 직접 실행해 태그 변조 위험을 줄였다.
- **시크릿 검사 범위**: 작업 트리 전체 + 이번 push/PR의 커밋 범위만 검사한다. 과거 이력은 2.4의 폐기 조치로 처리한다.
- **로컬 실행**: `scripts/security/scan.sh all` (개별 실행: `npm|maven|secrets|sast|iac`)

## 4. 잔여 위험 · 후속 과제

1. **유출 시크릿 폐기** (2.4) — 가장 우선이다.
2. **CORS**: gateway가 모든 출처를 자격 증명과 함께 허용한다(`allowedOriginPatterns: '*'`). 조치 전과 같은 동작을 유지했다. 운영 도메인과 모바일 앱 출처로 좁혀야 한다.
3. **package-lock.json 미추적** (`.gitignore`) — 빌드마다 의존성이 새로 해석되어 재현성이 없고, 점검 시점과 배포 시점의 버전이 달라질 수 있다. 잠금파일을 커밋하고 `npm ci`로 전환하기를 권장한다. 현재 루트 `Dockerfile`의 `npm ci`도 잠금파일이 없으면 실패한다.
4. **컨테이너 이미지(OS 패키지) 스캔**은 이번 범위 밖이다. 베이스 이미지 CVE는 수정 버전이 없는 경우가 많아, 차단 게이트가 아니라 보고 전용으로 추가하는 것을 권장한다.
5. **npm Moderate 5건**: quill(XSS, 2.0.3), uuid, esbuild(개발 서버), qs, @tiptap/core. 다음 정기 점검에서 처리한다.
6. **배포 반영**:
   - gateway는 Java 17+ 런타임이 필요하다(Cloud Build `mvn` 이미지의 JDK 확인).
   - `SUPABASE_URL` 또는 `SUPABASE_JWKS_URL`이 없으면 로그인 사용자 토큰이 모두 401이 된다.

## 5. process-gpt-completion 점검 (2026-10-01 추가)

대상 저장소: `uengine-oss/process-gpt-completion`
- 본 API(`uv run main.py`)
- `polling_service/`, `fcm_service/`
- `frontend/` 데모

| 영역 | 조치 전 (Critical / High) | 조치 후 |
|---|---|---|
| Python 의존성 (`uv.lock`·`requirements.txt`) | 23개 패키지 — chromadb RCE, langchain-core 직렬화 RCE, pyjwt 인증 우회, fastmcp SSRF, starlette, anyio 등 | 0 / 0 (예외 1건) |
| polling_service 의존성 | fastmcp·langchain 계열 11건 | 0 / 0 |
| frontend 데모 (vue-cli, EOL) | High 8 (webpack-dev-server 등) | 0 — vite로 이전 |
| 시크릿 | **Odoo 계정 비밀번호(API 키)** — `mcp.json`에 있었고 `/mcp-tools` API가 로그인 사용자 전원에게 그대로 반환 | 자리표시자로 교체 |
| SAST | ERROR 3건 (f-string SQL — 실제 값은 바인딩, 테이블명 상수) | `psycopg2.sql.Identifier` 조립으로 교체 → 0 |
| IaC | High 12 (root 실행, securityContext 없음) | 0 |

**의존성 조치**
- 사용하지 않는 `chromadb`, `transformers`를 제거했다.
- 상향한 버전:
  - langchain 1.4 / langchain-core 1.6 / langchain-community 0.4
  - langgraph 1.2 (checkpoint 4.2)
  - fastmcp 3.4
  - fastapi 0.141 / starlette 1.7
  - pyjwt 2.15
  - openai는 1.x(1.109)로 유지했다.
- langchain 1.x에서 사라진 import 경로를 이전했다: `langchain.schema` / `prompts` / `cache` / `globals` / `tools` / `text_splitter` → `langchain_core` / `langchain_community` / `langchain_text_splitters`, `load_summarize_chain` → `langchain_classic`.
- `requirements.txt`(Docker 빌드용)는 `uv export`로 `uv.lock`과 같은 버전을 쓰도록 다시 만들었다.

**예외 (`.trivyignore.yaml`)**

| ID | 패키지 | 사유 | 만료 |
|---|---|---|---|
| CVE-2026-31240 | mem0ai (수정 버전 없음) | 취약점은 mem0 **서버**의 인증 부재다. 이 서비스는 `mem0.Memory` 라이브러리만 쓰며, pip 패키지에는 서버 모듈이 없다 | 2027-01-31 |

**검증**
- 테스트: 본 서비스 308개, polling 313개 모두 통과했다(업스트림 병합 후 기준).
- API 25개 경로의 응답 코드가 조치 전과 같았다.
- SQL을 바꾼 엔드포인트(공급업체 검색, 시스템 조회)를 실제 DB로 호출해 결과가 같음을 확인했다.
- 이 서버에서 실로그인 후 `/completion/*` 호출이 정상이다.

**CI**: completion 저장소에도 `scripts/security/scan.sh [deps|secrets|sast|iac|all]`와 `.github/workflows/security-scan.yml`(4개 잡)을 추가했다.

**소유자 후속 조치**: Odoo API 키를 **폐기·재발급**해야 한다(2025-06부터 커밋 이력에 있다).
