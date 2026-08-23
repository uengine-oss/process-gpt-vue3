# Process-GPT 처음 시작 가이드 (Getting Started)

처음 받은 상태에서 **아무것도 설치되어 있지 않다는 가정** 하에, 설치해야 할 것 → 환경 변수 → DB(SQL) 초기화 → 첫 접속까지 순서대로 정리한 문서입니다.

두 가지 실행 경로 중 하나를 선택하세요.

| 경로 | 대상 | 특징 |
|---|---|---|
| **A. Docker Compose 전체 스택** (권장) | 일단 써보고 싶은 사용자 | 프론트엔드 + 백엔드 전체 + Supabase가 한 번에 뜸. DB 스키마도 최초 기동 시 자동 적용 |
| **B. 로컬 개발 환경** | 프론트엔드를 수정할 개발자 | Supabase CLI로 DB만 띄우고, Vue 앱은 Vite dev 서버로 실행 |

---

## 0. 공통 사전 설치

| 도구 | 필요 경로 | 비고 |
|---|---|---|
| [Git](https://git-scm.com/) | A, B | 저장소 클론 |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) (또는 Docker Engine + Compose v2) | A, B | `docker compose` 명령이 동작해야 함 (`docker-compose` 아님). B 경로에서도 Supabase CLI가 내부적으로 Docker를 사용 |
| **OpenAI API Key** | A, B | AI 기능(프로세스 생성, 딥리서치 등) 전반에 필수. [platform.openai.com](https://platform.openai.com/api-keys)에서 발급 |
| [Node.js](https://nodejs.org/) 18 LTS 이상 (최소 16) + npm | B | Vue 3 + Vite 프론트엔드 |
| [Supabase CLI](https://supabase.com/docs/guides/cli/getting-started) | B | `brew install supabase/tap/supabase` (macOS) |
| Java 8 이상 + Maven | B (선택) | `gateway/` (Spring Boot Gateway)를 로컬 실행할 때만 |

설치 확인:

```bash
git --version
docker compose version   # v2.x 이상
node -v                  # B 경로만
supabase --version       # B 경로만
```

---

## A. Docker Compose 전체 스택 실행 (권장)

### A-1. 클론

```bash
git clone https://github.com/uengine-oss/process-gpt-vue3.git
cd process-gpt-vue3
```

### A-2. 환경 변수 설정 (`docker-compose/.env`)

```bash
cd docker-compose
cp .env.example .env
```

`.env`에서 **반드시 채워야 하는 값**:

| 변수 | 설명 |
|---|---|
| `OPENAI_API_KEY` | OpenAI API 키. completion·딥리서치·에이전트 등 대부분의 서비스가 이 값을 공유 (기본값이 비어 있음) |

**첫 실행이라면 함께 손봐야 하는 값 — 회원가입 이메일 인증**:

기본 `.env.example`의 SMTP 값은 가짜(`supabase-mail`)이고 해당 메일 컨테이너는 스택에 없습니다. 그대로 두면 **회원가입 후 인증 메일이 오지 않아 로그인할 수 없습니다.** 둘 중 하나를 선택하세요.

- **간단(로컬 체험용)**: 이메일 인증 생략
  ```bash
  ENABLE_EMAIL_AUTOCONFIRM=true
  ```
- **정식**: 실제 SMTP 정보 입력 (`SMTP_ADMIN_EMAIL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SENDER_NAME`)

**운영(외부 공개) 배포라면 반드시 교체해야 하는 값**:

| 변수 | 설명 |
|---|---|
| `POSTGRES_PASSWORD` | DB 비밀번호 |
| `JWT_SECRET` | 32자 이상 임의 문자열 |
| `ANON_KEY`, `SERVICE_ROLE_KEY` | `JWT_SECRET`으로 서명한 JWT ([Supabase self-hosting 문서의 키 생성기](https://supabase.com/docs/guides/self-hosting/docker#generate-api-keys) 사용) |
| `DASHBOARD_USERNAME` / `DASHBOARD_PASSWORD` | Supabase Studio 로그인 계정 |
| `SITE_URL`, `API_EXTERNAL_URL`, `SUPABASE_PUBLIC_URL`, `ADDITIONAL_REDIRECT_URLS` | 실제 접근 도메인으로 변경 (로컬은 기본값 유지) |
| `LOGFLARE_PUBLIC_ACCESS_TOKEN`, `LOGFLARE_PRIVATE_ACCESS_TOKEN`, `LOGFLARE_API_KEY` | 로그 수집(analytics) 토큰 |
| `SECRET_KEY_BASE`, `VAULT_ENC_KEY`, `PG_META_CRYPTO_KEY` | 내부 암호화 키 |

> 로컬에서 그냥 써 보는 경우라면 `OPENAI_API_KEY` + `ENABLE_EMAIL_AUTOCONFIRM=true` 두 가지만 바꿔도 기동됩니다.

### A-3. 전체 스택 기동

```bash
# docker-compose/ 디렉터리에서
docker compose up -d
```

- 첫 실행은 이미지 풀(pull) 때문에 수 분~수십 분 걸릴 수 있습니다.
- 상태 확인: `docker compose ps` — `supabase-db`, `supabase-kong`, `frontend`, `completion`, `nginx` 등이 `running`/`healthy`인지 확인.

### A-4. DB 초기화 — 무엇이 자동이고 무엇이 수동인가

**자동 (아무것도 안 해도 됨)**: `db` 컨테이너가 **처음 기동될 때** (`docker-compose/volumes/db/data`가 비어 있을 때) 아래 SQL이 자동 실행됩니다.

- Supabase 인프라 SQL: `_supabase.sql`, `webhooks.sql`, `roles.sql`, `jwt.sql`, `realtime.sql`, `logs.sql`, `pooler.sql`
- **`init.sql` — Process-GPT 전체 스키마 정본** (테이블·함수·트리거 전부)

적용 확인: Supabase Studio(`http://localhost:54323`, `DASHBOARD_USERNAME`/`DASHBOARD_PASSWORD`로 로그인) → Table Editor에 `proc_def`, `todolist`, `users`, `tenants` 같은 테이블이 보이면 성공.

**수동 (Supabase Studio → SQL Editor에서 실행)**:

| SQL 파일 | 언제 실행하나 |
|---|---|
| `docker-compose/volumes/db/vecs.sql` | **`vecs` 스키마가 생긴 뒤에만** 실행. `vecs` 스키마는 memento(mem0)가 처음 벡터 데이터를 쓸 때 만들어지므로, 서비스를 한 번 사용해 본 후 실행하면 됨. 에이전트 메모리 조회/삭제 함수 3개를 만듦 |
| `docker-compose/volumes/db/migration.sql` | **기존에 쓰던 DB를 새 버전으로 업데이트**할 때만 (신규 설치에는 불필요 — init.sql에 이미 반영됨) |

> `db` 데이터를 유지한 채 컨테이너만 재시작하면 init.sql은 다시 실행되지 않습니다. 스키마를 처음부터 다시 만들려면 `docker compose down` 후 `docker-compose/volumes/db/data` 디렉터리를 삭제하고 다시 올리세요 (**데이터 전체 삭제됨**).

### A-5. Storage 공개 버킷 3개 생성 (필수, 수동)

Supabase Studio → **Storage** 메뉴에서 아래 3개 버킷을 **Public** 으로 생성합니다.

| 버킷 이름 | 용도 |
|---|---|
| `files` | 업로드 파일 저장 |
| `task-image` | 딥리서치 등에서 생성된 이미지 |
| `chat-images` | 채팅에 첨부한 이미지 |

### A-6. (선택) UI 설정용 OPENAI_API_KEY

브라우저 에이전트 설정 등 UI에서 키를 조회하는 흐름은 `public.configuration` 테이블을 사용합니다. 필요 시 Studio → Table Editor → `configuration`에 추가:

- `key`: `OPENAI_API_KEY`
- `value`(jsonb): `{"key": "sk-..."}`

### A-7. 접속 확인

| URL | 서비스 |
|---|---|
| `http://localhost:8088` | **메인 진입점 (Nginx)** — 여기서 회원가입 후 사용 시작 |
| `http://localhost:8080` | 프론트엔드 직접 접근 |
| `http://localhost:54323` | Supabase Studio (웹 DB 콘솔) |
| `http://localhost:54321` | Supabase API (Kong) |
| `http://localhost:8000` | Completion 백엔드 |

`http://localhost:8088` 접속 → 회원가입 → (autoconfirm이면 바로) 로그인되면 설치 완료입니다.

### A-8. 운영 명령 모음

```bash
docker compose ps                 # 상태 확인
docker compose logs -f frontend   # 서비스별 로그
docker compose logs -f completion
docker compose logs -f db
docker compose down               # 중지 (데이터 유지)
docker compose down && rm -rf volumes/db/data   # DB까지 완전 초기화 (주의!)
```

---

## B. 로컬 개발 환경 (Supabase CLI + Vite)

프론트엔드 코드를 수정하며 개발할 때의 구성입니다. DB는 Supabase CLI가, 프론트엔드는 Vite dev 서버가 담당합니다.

### B-1. Supabase 로컬 스택 시작

저장소 루트에서:

```bash
supabase start
```

- 첫 실행 시 이미지를 내려받은 뒤, **`supabase/migrations/*.sql`(타임스탬프 파일)이 파일명 순서대로 자동 적용**됩니다. 별도 SQL 실행이 필요 없습니다.
- 완료되면 터미널에 `API URL`, `anon key`, `service_role key` 등이 출력됩니다. **`anon key`를 복사해 두세요** (다음 단계에서 사용).

로컬 포트 (`supabase/config.toml` 기준):

| 포트 | 서비스 |
|---|---|
| 54321 | API (Kong) — 프론트엔드가 바라보는 주소 |
| 54322 | PostgreSQL 직접 접속 |
| 54323 | Supabase Studio |
| 54324 | **Inbucket (가짜 메일함)** — 가입/초대 메일이 실제 발송되지 않고 여기에 쌓임 |

> 로컬 CLI 환경은 `enable_confirmations = false`라 이메일 인증 없이 바로 로그인됩니다.
>
> `supabase/migrations/`의 타임스탬프 없는 파일(`auth_audit_log.sql`, `schema_merge.sql`)은 CLI가 자동 적용하지 **않습니다**. 필요한 경우에만 Studio SQL Editor에서 수동 실행하세요.

스키마를 초기 상태로 다시 만들려면: `supabase db reset` (migrations 전체 재적용).

### B-2. Storage 공개 버킷 3개 생성

`http://localhost:54323` (Studio) → Storage에서 A-5와 동일하게 `files`, `task-image`, `chat-images` 버킷을 **Public**으로 생성합니다.

### B-3. 프론트엔드 환경 변수 (루트 `.env`)

```bash
cp .env.example .env
```

```bash
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_KEY=<supabase start가 출력한 anon key>
VITE_PAL_MODE=false
SECRET_KEY=<임의의 문자열>
```

### B-4. 프론트엔드 실행

```bash
npm install
npm run dev
```

`http://localhost:5173` (또는 Vite가 출력한 포트)로 접속합니다.

### B-5. 백엔드 서비스

프론트엔드만으로는 정상 동작하지 않습니다. 최소한 **[process-gpt-completion](https://github.com/uengine-oss/process-gpt-completion)** (핵심 백엔드)이 필요하고, 기능에 따라 memento(RAG)·crewai 계열 에이전트 등이 추가로 필요합니다. 각 레포의 README를 따라 개별 실행하거나, 백엔드만 Docker Compose 스택으로 띄워 함께 사용할 수 있습니다.

Spring Boot Gateway를 로컬에서 쓰려면:

```bash
cd gateway
mvn spring-boot:run   # http://localhost:8088
```

### B-6. (개발자용) 마이그레이션 검증

`supabase/migrations`가 빈 DB에서 순서대로 적용되는지 검증하려면:

```bash
bash scripts/validate-migrations-empty-db.sh
```

일회용 postgres 컨테이너를 띄워 검사하며 기존 DB에는 영향이 없습니다.

---

## C. DB SQL 파일 총정리

| 파일 | 용도 | 적용 방법 |
|---|---|---|
| `docker-compose/volumes/db/init.sql` | **전체 스키마 정본** (테이블·함수·트리거 CREATE) | 경로 A: 최초 기동 시 자동. 그 외: SQL Editor에서 수동 실행 |
| `docker-compose/volumes/db/migration.sql` | 기존 DB 구조 변경(ALTER) 누적본 | 기존 DB 업데이트 시에만 수동 실행 |
| `docker-compose/volumes/db/vecs.sql` | mem0 에이전트 메모리 조회/삭제 함수 | `vecs` 스키마 생성 후 수동 실행 |
| `docker-compose/volumes/db/{_supabase,webhooks,roles,jwt,realtime,logs,pooler}.sql` | Supabase 인프라 초기화 | 경로 A에서 자동 (건드릴 필요 없음) |
| `supabase/migrations/2026*.sql` | 로컬 CLI 개발용 마이그레이션 (타임스탬프 순 적용) | `supabase start` / `supabase db reset` 시 자동 |
| `supabase/migrations/auth_audit_log.sql`, `schema_merge.sql` | 타임스탬프 없는 보조 SQL | CLI가 적용하지 않음 — 필요 시 수동 |
| `supabase/seed.sql` | 시드 데이터 | 현재 비어 있음 |

---

## D. 트러블슈팅

**회원가입은 되는데 인증 메일이 안 와요 (경로 A)**
기본 SMTP 설정이 가짜입니다. `docker-compose/.env`에서 `ENABLE_EMAIL_AUTOCONFIRM=true`로 바꾸고 `docker compose up -d auth`로 auth만 재기동하거나, 실제 SMTP 정보를 입력하세요. 경로 B는 메일이 Inbucket(`http://localhost:54324`)에 쌓입니다.

**Studio Table Editor에 테이블이 하나도 없어요 (경로 A)**
`db` 컨테이너 최초 기동 시점에 `volumes/db/data`가 비어 있지 않았다면 init.sql이 실행되지 않은 것입니다. `docker compose down` → `rm -rf docker-compose/volumes/db/data` → `docker compose up -d` 로 재기동하거나, Studio SQL Editor에서 `init.sql`을 직접 실행하세요.

**`vecs.sql` 실행 시 "schema vecs does not exist" 에러**
정상입니다. `vecs` 스키마는 memento(mem0)가 처음 동작할 때 생성됩니다. 서비스를 한 번 사용한 뒤 다시 실행하세요.

**포트 충돌로 컨테이너가 안 떠요**
사용 포트: 8088(nginx), 8080(frontend), 8000(completion), 8001~8012(에이전트류), 54321(Kong), 54322(DB), 54323(Studio), 4000(analytics), 3000(voice), 5001(browser-use), 6789(agent-feedback), 8666(fcm). 겹치는 로컬 프로세스를 내리거나 `.env`의 포트 변수(`KONG_HTTP_PORT`, `STUDIO_PORT` 등)를 바꾸세요. 경로 A와 경로 B(Supabase CLI)는 **같은 54321-54323 포트를 쓰므로 동시에 띄울 수 없습니다.**

**`supabase-analytics`가 계속 재시작해요**
`LOGFLARE_*` 토큰이 기본값이어도 로컬에서는 대개 동작하지만, 문제가 계속되면 임의의 긴 문자열로 교체 후 재기동하세요. analytics는 로그 수집용이라 잠시 죽어 있어도 본 기능 사용에는 지장이 없습니다.

**AI 기능(프로세스 생성 등)이 응답하지 않아요**
`docker-compose/.env`의 `OPENAI_API_KEY`가 비어 있거나 잘못된 경우입니다. 값을 채우고 `docker compose up -d` 로 재적용하세요. `docker compose logs -f completion`에서 인증 오류 여부를 확인할 수 있습니다.

---

## E. 최종 체크리스트 (경로 A 기준)

- [ ] Docker Desktop 설치, `docker compose version` 동작
- [ ] 저장소 클론
- [ ] `docker-compose/.env` 생성 (`cp .env.example .env`)
- [ ] `OPENAI_API_KEY` 입력
- [ ] `ENABLE_EMAIL_AUTOCONFIRM=true` (또는 실제 SMTP 설정)
- [ ] `docker compose up -d` → `docker compose ps` 전부 running
- [ ] Studio(`:54323`)에서 `proc_def` 등 테이블 확인 (init.sql 자동 적용 확인)
- [ ] Storage 버킷 `files` / `task-image` / `chat-images` Public 생성
- [ ] `http://localhost:8088` 접속 → 회원가입 → 로그인 성공
- [ ] (사용 후) SQL Editor에서 `vecs.sql` 실행
