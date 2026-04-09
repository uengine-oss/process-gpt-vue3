> **전체 설치 및 실행 방법은 메인 프로젝트를 참고하세요:** [ProcessGPT](https://github.com/uengine-oss/process-gpt)

# process-gpt-vue3

Process-GPT **프론트엔드(Vue 3)** 프로젝트입니다. 이 저장소는 프론트엔드뿐 아니라 `docker-compose/`를 통해 **전체 스택(프론트엔드·백엔드 마이크로서비스·Supabase·Nginx·부가 에이전트)** 을 함께 실행할 수 있도록 구성되어 있습니다.

> **참고:** 프론트엔드만으로는 정상 동작하지 않습니다.

---

## 목차 📚

- [Docker Compose로 전체 스택 실행](#docker-compose로-전체-스택-실행)
- [로컬 개발 환경 셋업 (Supabase CLI + 개별 서비스 실행)](#로컬-개발-환경-셋업-supabase-cli--개별-서비스-실행)
- [Supabase 초기 설정 (DB + 스토리지)](#supabase-초기-설정-db--스토리지)

---

## 빠른 시작 🚀 (Docker Compose)

가장 빠르게 전체 Process-GPT 스택을 띄우는 방법입니다. 아래 순서만 따라 하면 됩니다.

1. **저장소 클론 & 이동 🧩**
   ```bash
   git clone https://github.com/uengine-oss/process-gpt-vue3.git
   cd process-gpt-vue3 
   ```

2. **Docker용 환경 변수 설정 🔐**
   ```bash
   cd docker-compose
   cp .env.example .env
   ```
   `OPENAI_API_KEY`, SMTP 관련 값, `POSTGRES_PASSWORD`, `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY`, `SITE_URL`, `API_EXTERNAL_URL` 등을 **실제 값으로 꼭 수정**하세요.  
   (자세한 항목은 아래 [Docker Compose로 전체 스택 실행](#docker-compose로-전체-스택-실행)의 “환경 변수 설정”을 참고할 수 있습니다.)

3. **전체 스택 실행 🐳**
   ```bash
   docker compose up -d
   ```
   - 기본 접속 URL: `http://localhost:8088`

4. **Supabase 초기 설정 (필수) 📚**
   컨테이너가 모두 올라간 뒤, 아래 섹션을 따라 **SQL 실행 + Storage 버킷 3개 생성**을 해 줍니다.
   - [Supabase 초기 설정 (DB + 스토리지)](#supabase-초기-설정-db--스토리지)

---

## Docker Compose로 전체 스택 실행

Docker Compose는 `docker-compose/docker-compose.yaml`에 정의된 서비스들을 한 번에 실행합니다.

### 1. 사전 준비

- **Docker** & **Docker Compose v2** (`docker compose` 명령 사용)
- 이 저장소 클론

```bash
git clone https://github.com/uengine-oss/process-gpt-vue3.git
cd process-gpt-vue3
```

### 2. 환경 변수 설정

#### 2-1. Docker Compose용 환경 변수 (`docker-compose/.env`)

`docker-compose` 디렉터리 내 예시 파일을 복사한 후 필요한 값들을 수정합니다.

```bash
cd docker-compose
cp .env.example .env
```

특히 아래 항목들은 **반드시 실제 값으로 채워야** 정상 동작합니다.

- **OpenAI**
  - `OPENAI_API_KEY`
- **SMTP (이메일 인증/초대/재설정 등)**
  - `SMTP_ADMIN_EMAIL`
  - `SMTP_HOST`
  - `SMTP_PORT`
  - `SMTP_USER`
  - `SMTP_PASS`
  - `SMTP_SENDER_NAME`
- **Supabase / DB 보안 키 (운영 환경에서는 꼭 교체)**
  - `POSTGRES_PASSWORD`, `JWT_SECRET`
  - `ANON_KEY`, `SERVICE_ROLE_KEY`
- **접근 URL**
  - `SITE_URL`, `API_EXTERNAL_URL`, `SUPABASE_PUBLIC_URL` 등

> 운영 환경(배포)에서는 `.env.example`에 있는 기본 키/비밀번호들을 그대로 사용하면 안 됩니다.

### 3. 서비스 구성 (`docker-compose/docker-compose.yaml`)

아래는 주요 서비스들의 개요입니다. (전체 목록은 `docker-compose/docker-compose.yaml`을 참고하세요.)

#### 프론트엔드 / 게이트웨이

- `frontend`: Process-GPT 프론트엔드 (기본 포트 `8080`)
- `nginx`: 프론트엔드 및 각 서비스 라우팅 (기본 포트 `8088`)

#### 코어 백엔드 / 폴링 / RAG

- `completion`: 핵심 Completion 백엔드 (`8000`)
- `polling-service`: Completion·Memento 등 연동 폴링 서비스 (`8010` → 컨테이너 내부 `8000`)
- `memento`: 문서 기반 RAG 서비스 (`8005`)

#### 에이전트 / 오케스트레이션 / 부가 서비스

- `crewai-action`: 액션 실행 에이전트 (`8001`)
- `crewai-deep-research`: 심층 리서치 에이전트 (`8002`)
- `openai-deep-research`: OpenAI 기반 심층 리서치 에이전트 (`8003`)
- `langchain-react`: LangChain 기반 에이전트 (`8011`)
- `work-assistant-agent`: 워크 어시스턴트 에이전트 (`8008`)
- `a2a-orch`: Agent-to-Agent(A2A) 오케스트레이션 (`8006`)
- `computer-use`: 컴퓨터 사용(automation) 서비스 (`8007`)
- `agent-feedback`: 에이전트 피드백 서비스 (`6789`)
- `process-gpt-analytic`: 분석/ETL 서비스 (`8009`)
- `fcm-service`: FCM 푸시 서비스 (`8666`)
- `bpmn-extractor`: PDF → BPMN 추출 API (`8012`)
- `browser-use`: 브라우저 자동화 서버 (`5001`, Nginx 경유 `/browser-use/`)
- `react-voice-agent`: 음성 채팅 서비스 (`3000`, Nginx 경유 `/voice/`)
- `claude-skills`: 스킬 서버/스토리지 (`8765`, Nginx 경유 `/claude-skills/`)

#### Supabase 스택 (Self-hosted)

- `studio`: Supabase Studio (웹 콘솔)
- `kong`: API Gateway
- `auth`: 인증(GoTrue)
- `rest`: PostgREST
- `realtime`: Realtime 서버
- `storage` + `imgproxy`: 스토리지 및 이미지 프록시
- `meta`: Postgres Meta
- `functions`: Edge Functions 런타임
- `analytics`: Logflare 기반 분석 서비스
- `db`: Supabase Postgres 데이터베이스

> 모든 서비스는 `.env`에서 요구하는 환경 변수(예: `OPENAI_API_KEY`, Supabase 관련 키, SMTP 설정 등)가 올바르게 지정되어야 정상 동작합니다.

### 4. Docker Compose 실행 / 중지

#### 전체 스택 시작

```bash
cd docker-compose
docker compose up -d
```

#### 전체 스택 중지

```bash
docker compose down
```

#### 로그 확인 (예시)

```bash
docker compose logs -f frontend
docker compose logs -f completion
docker compose logs -f db
```

### 5. 주요 접근 경로 예시

아래 포트/URL은 `.env` 설정에 따라 달라질 수 있습니다.

- **메인 엔트리 (Nginx)**: `http://localhost:8088`
- **프론트엔드 직접 접근**: `http://localhost:8080`
- **Completion 서비스**: `http://localhost:8000`
- **Memento 서비스**: `http://localhost:8005`
- **Completion (Nginx 경유)**: `http://localhost:8088/completion/`
- **Memento (Nginx 경유)**: `http://localhost:8088/memento/`
- **Browser Use (Nginx 경유)**: `http://localhost:8088/browser-use/`
- **Voice Agent (Nginx 경유)**: `http://localhost:8088/voice/`
- **Claude Skills (Nginx 경유)**: `http://localhost:8088/claude-skills/`
- **Supabase Studio**: `http://localhost:${STUDIO_PORT}` (기본 54323)
- **Kong (공개 API)**: `http://localhost:${KONG_HTTP_PORT}` (기본 54321)

> **필수:** 서비스를 띄운 뒤 **반드시** [Supabase 초기 설정 (DB + 스토리지)](#supabase-초기-설정-db--스토리지)을 진행해야 합니다. 이 단계를 건너뛰면 서비스를 정상적으로 이용할 수 없습니다.

---

## 로컬 개발 환경 셋업 (Supabase CLI + 개별 서비스 실행)

Docker Compose 대신, **Supabase CLI로 데이터베이스를 실행**하고 각 서비스를 **별도 프로세스로 개별 실행**하며 개발할 수 있습니다.

### 1. 사전 준비

- **Node.js**: 16 이상 (Vue 3 + Vite)
- **Java**: 8 이상 (Spring Boot Gateway 등 Java 기반 서비스)
- **Maven**: Gateway 빌드/실행
- **Python**: 마이크로서비스별 요구 버전 (각 레포지토리 README 참고)
- **Supabase CLI**: 로컬 Supabase 개발용
- **Docker**: Supabase CLI 내부에서 Docker 사용

### 2. 프론트엔드 로컬 개발용 환경 변수 (`.env`)

루트 디렉터리의 `.env.example` 파일을 복사해서 프론트엔드 개발용 환경 변수를 설정합니다.

```bash
cp .env.example .env
```

예: `VITE_SUPABASE_URL`, `VITE_SUPABASE_KEY`, `SECRET_KEY` 등.

### 3. Supabase (로컬) 시작

```bash
supabase start
```

기본적으로 Supabase Studio는 `http://localhost:54323` 에서 접근 가능합니다.

> **필수:** Supabase를 띄운 뒤 **반드시** [Supabase 초기 설정 (DB + 스토리지)](#supabase-초기-설정-db--스토리지)을 진행해야 합니다.

### 4. 프론트엔드 실행 (Vue 3)

```bash
npm install
npm run dev
```

기본적으로 `http://localhost:5173` (또는 Vite가 출력하는 포트)에서 접근할 수 있습니다.

### 5. Gateway 실행 (로컬)

```bash
cd gateway
mvn spring-boot:run
```

Gateway는 보통 `http://localhost:8088`에서 동작하도록 구성됩니다.

### 6. 기타 마이크로서비스 실행

대부분의 마이크로서비스는 Docker Compose 스택으로 함께 띄우거나, 필요 시 각자 별도로 실행할 수 있습니다.

- **필수 서비스**
  - **[process-gpt-completion](https://github.com/uengine-oss/process-gpt-completion)**: 핵심 백엔드 (필수)
    - `polling-service`, `fcm-service`는 completion 레포 내부 구성요소로 제공됩니다.
- **함께 사용하는 기타 서비스 (Docker Compose 목록과 동일, nginx/Supabase 제외)**
  - 아래 목록은 **`docker-compose/docker-compose.yaml`에 정의된 서비스와 동일**하게 유지합니다. (단, `nginx` 및 Supabase 관련 서비스들은 제외)
  - 필요하면 각 레포를 개별 실행할 수 있지만, 기본은 Docker Compose 구성을 전제로 합니다.
  - **[process-gpt](https://github.com/uengine-oss/process-gpt-vue3)**: 프론트엔드 (service: `frontend`, image: `ghcr.io/uengine-oss/process-gpt`)
  - **[process-gpt-completion](https://github.com/uengine-oss/process-gpt-completion)**: Completion 백엔드 (service: `completion`)
  - **[process-gpt-polling-service](https://github.com/uengine-oss/process-gpt-completion/tree/main/polling_service)**: 폴링 서비스 (service: `polling-service`, image: `ghcr.io/uengine-oss/process-gpt-polling-service`)
  - **[process-gpt-fcm-service](https://github.com/uengine-oss/process-gpt-completion/tree/main/fcm_service)**: 푸시(FCM) 서비스 (service: `fcm-service`, image: `ghcr.io/uengine-oss/fcm-service`)
  - **[process-gpt-memento](https://github.com/uengine-oss/process-gpt-memento)**: 문서 기반 RAG (service: `memento`)
  - **[process-gpt-crewai-action](https://github.com/uengine-oss/process-gpt-crewai-action)**: CrewAI 액션 실행 (service: `crewai-action`)
  - **[process-gpt-crewai-deep-research](https://github.com/uengine-oss/process-gpt-crewai-deep-research)**: CrewAI 심층 리서치 (service: `crewai-deep-research`)
  - **[process-gpt-openai-deep-research](https://github.com/uengine-oss/process-gpt-openai-deep-research)**: OpenAI 심층 리서치 (service: `openai-deep-research`, image: `ghcr.io/uengine-oss/openai-deep-research`)
  - **[process-gpt-browser-use](https://github.com/uengine-oss/process-gpt-browser-use)**: 브라우저 자동화 (service: `browser-use`)
  - **[process-gpt-a2a-orch](https://github.com/uengine-oss/process-gpt-a2a-orch)**: A2A 오케스트레이션 (service: `a2a-orch`)
  - **[process-gpt-react-voice-agent](https://github.com/uengine-oss/process-gpt-react-voice-agent)**: 음성 채팅 (service: `react-voice-agent`)
  - **[work-assistant-agent](https://github.com/search?q=org%3Auengine-oss+work-assistant-agent&type=repositories)**: 워크 어시스턴트 에이전트 API (service: `work-assistant-agent`, image: `ghcr.io/uengine-oss/work-assistant-agent`)
  - **[process-gpt-claude-skills](https://github.com/uengine-oss/process-gpt-claude-skills)**: 에이전트 스킬 서버/스토리지 MCP (service: `claude-skills`, image: `ghcr.io/uengine-oss/claude-skills`)
  - **[process-gpt-computer-use](https://github.com/uengine-oss/process-gpt-computer-use)**: 컴퓨터 사용(automation) MCP (service: `computer-use`, image: `ghcr.io/uengine-oss/computer-use`)
  - **[process-gpt-agent-feedback](https://github.com/uengine-oss/process-gpt-agent-feedback)**: 에이전트 피드백/지식 셋업 API (service: `agent-feedback`, image: `ghcr.io/uengine-oss/agent-feedback`)
  - **[process-gpt-analytic](https://github.com/uengine-oss/process-gpt-analytic)**: 분석/ETL 서비스 (service: `process-gpt-analytic`, image: `ghcr.io/uengine-oss/process-gpt-analytic`)
  - **[process-gpt-langchain-react](https://github.com/uengine-oss/process-gpt-langchain-react)**: LangChain 기반 에이전트 (service: `langchain-react`, image: `ghcr.io/uengine-oss/langchain-react`)
  - **[process-gpt-bpmn-extractor](https://github.com/uengine-oss/process-gpt-bpmn-extractor)**: PDF → BPMN 추출 API (service: `bpmn-extractor`, image: `ghcr.io/uengine-oss/process-gpt-bpmn-extractor`)

각 서비스는 자신의 레포지토리 README에 안내된 방식(Python venv, Docker, 기타 CLI 등)에 따라 로컬에서 개별 실행할 수 있습니다.

---

## Supabase 초기 설정 (DB + 스토리지)

> **이 설정을 완료하지 않으면 서비스를 정상적으로 이용할 수 없습니다.** Docker Compose 또는 로컬 Supabase를 띄운 뒤, 반드시 아래 절차를 진행하세요.

Supabase Studio의 **SQL Editor**에서 초기 테이블·함수·트리거를 셋업하고, **Storage 공개 버킷**을 생성합니다.

### 초기 SQL 실행

1. Supabase Studio 접속 (Docker: `http://localhost:${STUDIO_PORT}` / 로컬 CLI: `http://localhost:54323`) → **SQL Editor** 이동
2. 아래 순서대로 SQL 실행
   - **먼저** `docker-compose/volumes/db/init.sql`
   - **이어서** `docker-compose/volumes/db/vecs.sql`

> 이미 DB를 띄워두고 업데이트하는 경우라면, 필요에 따라 `docker-compose/volumes/db/migration.sql`도 함께 적용하세요.

### Storage 공개 버킷 생성

SQL 실행이 끝난 뒤, Supabase Studio의 **Storage** 메뉴에서 아래 **3개의 공개(public) 버킷**을 생성합니다.

| 버킷 이름 | 용도 |
|---|---|
| `files` | 업로드한 파일 저장 |
| `task-image` | deep research 등을 통해 생성된 이미지 저장 |
| `chat-images` | 채팅에서 입력한 이미지 저장 |

---

## (참고) OpenAI API Key 설정 위치

대부분의 서비스는 `docker-compose/.env`의 `OPENAI_API_KEY`를 사용합니다.

추가로, UI에서 설정을 저장/조회하는 흐름(예: 브라우저 에이전트 설정 등)에서는 Supabase의 `public.configuration` 테이블을 사용합니다. 필요 시 Supabase Studio에서 아래처럼 값을 넣을 수 있습니다.

- **Studio**: `http://localhost:54323` → Table Editor → `configuration`
- 예시(권장 형태):
  - `key`: `OPENAI_API_KEY`
  - `value` (jsonb):

```json
{
  "key": "sk-..."
}
```

---

## Supabase 스크립트 관련 참고

### Supabase CLI로 로컬 실행 (Easy)

Supabase CLI 및 Docker 설치 후:

```bash
supabase start
```

공식 문서: `https://supabase.com/docs/guides/cli/getting-started`

### Supabase 공식 Docker 환경 직접 실행 (Complex)

```sh
# Supabase 공식 코드 받기
git clone --depth 1 https://github.com/supabase/supabase

# docker 폴더로 이동
cd supabase/docker

# 예시 env 복사
cp .env.example .env

# 이미지 풀
docker compose pull

# 서비스 시작 (백그라운드)
docker compose up -d
```

---

## 참고: 단일 Docker 컨테이너 실행 (이전 방식)

과거에는 다음과 같이 단일 컨테이너로 Process-GPT를 실행하는 방식도 사용했습니다. 지금은 **Docker Compose로 전체 스택을 올리는 것을 권장**합니다.

```bash
# DB_PW 값은 Supabase의 ANON_KEY 등을 참고해서 설정합니다.
docker run -p 8080:8080 -e DB_URL=http://localhost:8000 -e DB_PW=<YOUR_ANON_KEY> ghcr.io/uengine-oss/process-gpt:latest
```

환경과 운영 전략에 맞게, **Docker Compose 전체 스택** 또는 **로컬 개발 환경(Supabase CLI + 개별 실행)** 중 하나를 선택해서 사용하시면 됩니다.
