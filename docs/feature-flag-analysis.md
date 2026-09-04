# 기능 플래그 분리 설계 · 페이지 영향도 분석

> 작성일: 2026-09-04 · 대상: process-gpt-vue3 (main)
> 목적: 전체 기능을 도메인 단위로 분리하여 환경변수(feature flag)로 활성화/비활성화를 관리하기 위한 현황 점검, 플래그 카탈로그 제안, 기능별 OFF 시 페이지 영향도 분석

---

## 1. 요약 (TL;DR)

- 이 프로젝트는 이미 **3계층 설정 체계**를 갖고 있음: ① 빌드타임 `VITE_*` env → ② 런타임 `window._env_` 주입(run.sh) → ③ Supabase `configuration` 테이블(테넌트별). 새 feature flag는 이 체계 위에 얹으면 되며, 새 메커니즘을 발명할 필요가 없음.
- 모드 분기 선례가 이미 3종 존재: **PAL 모드**(`window.$pal`, 라우트 스프레드+컴포넌트 스왑), **GS 모드**(라우트 name 블랙리스트), **엔진 모드**(`window.$mode`). GS 모드가 사실상 "기능 제외 플래그"의 프로토타입.
- AI 기능은 **약 60개 파일, 17개 기능군**에 분산되어 있으나, 호출 경로가 2개 지점으로 수렴함: `src/components/ai/AIGenerator.js`(레거시 49개 생성기의 기반 클래스)와 `PalModeBackend.qdrantChat()`(PAL 모드 AI 전부). **이 2곳에 가드를 넣으면 AI 호출의 대부분을 일괄 차단 가능.**
- 페이지 단위 플래그 **14개 + AI 세부 플래그 9개** 체계를 제안(§4). 각 플래그의 OFF 시 영향도는 §5, §6에 상세 기술.
- 단, 플래그를 깨끗하게 걸려면 먼저 정리해야 할 **구조적 결합/부채**가 있음(§7): 사이드바 메뉴 3중 분산, `adminConsole` 스토어의 광범위 결합, `/completion` 서비스에 AI·비AI 혼재, 죽은 플래그(`$gs`, `$jms`)와 죽은 코드 등.

---

## 2. 현재 설정·모드 체계 현황

### 2.1 설정 3계층

| 계층 | 메커니즘 | 특징 | 현재 사용 예 |
|---|---|---|---|
| ① 빌드타임 | `import.meta.env.VITE_*` | 배포 이미지에 고정. 재빌드 필요 | `VITE_PAL_MODE`, `VITE_MODE`, `VITE_SUPABASE_URL` |
| ② 런타임 주입 | `window._env_` — `run.sh:19-32`가 `index.html`에 sed로 삽입 | 컨테이너 env로 재빌드 없이 변경 가능. **주입 목록이 run.sh에 하드코딩**(현재 7개만) | `VITE_GS_MODE`, `VITE_MODE`, Supabase/Keycloak 키 |
| ③ 테넌트 DB | Supabase `configuration` 테이블 (key/value jsonb, tenant_id) | 테넌트 관리자가 UI에서 변경. 읽기=전원, 쓰기=admin+ (RLS) | `palette_settings`, `pi_flag_types`, `organization` |

### 2.2 기존 모드 플래그

| 플래그 | 전역 | 소스 | 게이팅 방식 | 상태 |
|---|---|---|---|---|
| PAL 모드 | `window.$pal` | `src/palMode.ts` — `_env_` → env 순 | 라우트 스프레드(`MainRoutes.ts:446,651`), 컴포넌트 스왑(`/organization`, `/dashboard`), 백엔드 구현체 교체(`BackendFactory`), CSS 번들, 부팅 사이드이펙트 | 활성. 단 `run.sh` 주입 목록에 없어 **프로덕션에서 빌드타임 전용** |
| GS 모드 | (지역) `isGsMode` | `MainRoutes.ts:3` | `gsExcludedRoutes` name 배열로 라우트 필터(`MainRoutes.ts:684`) | 활성. 라우트만 필터, UI측 `window.$gs`는 **어디서도 할당되지 않는 죽은 플래그** |
| 엔진 모드 | `window.$mode` | `main.ts:242` (`ProcessGPT`/`uEngine`) | 사이드바 조건, 백엔드 팩토리, 테넌트 가드 | 활성 |
| JMS | `window.$jms` | `main.ts:247` 하드코딩 `false` | 사이드바 일부 조건 | 죽은 플래그 |

### 2.3 기존 권한/메뉴 인프라 (플래그를 얹을 자리)

- **`src/utils/routePermissions.ts` — `MENU_DEFINITIONS`**: path/label/section/icon/requiredRole/minRole/hiddenInSidebar를 가진 선언적 메뉴 정의. **feature flag 필드를 추가하기에 가장 자연스러운 SSOT.**
  - ⚠️ 단, 현재 실소비처는 `customPermissions.ts`와 `AdminConsoleLayout.vue` 2곳뿐. **사이드바(`VerticalSidebar.vue`)와 라우터 가드는 이 파일을 쓰지 않음** → 플래그를 여기에만 걸면 메뉴에 반영 안 됨.
- **`menu_role_overrides` 테이블**: 테넌트별 메뉴 권한 DB 오버라이드 + 메모리 캐시 패턴. feature flag의 테넌트별 오버라이드에 그대로 재사용 가능한 구조.
- **라우터 가드 현황**: 글로벌 `beforeEach`(`router/index.ts:117`)에는 **역할/권한 체크가 전혀 없음**. `requiresAuth` meta는 선언만 되고 소비되지 않음. URL 직접 입력으로 대부분 페이지 진입 가능(Admin Console만 컴포넌트 레벨 차단). → **플래그 OFF 시 "메뉴 숨김"만으로는 불충분하고 라우트 제거 또는 가드 추가가 필수.**

---

## 3. 기능 도메인 인벤토리

기능 영역 → 라우트 → 사이드바 → 핵심 컴포넌트/스토어 매핑. (상세 영향도는 §5)

| # | 도메인 | 주요 라우트 | 사이드바 노출 조건 | 핵심 자산 | 스토어 |
|---|---|---|---|---|---|
| F1 | 업무(할일/인스턴스) — **코어** | `/todolist`, `/todolist/:id`, `/instancelist/*`, `/project/:id`, `/calendar`, `/list-pages/completed` | `!pal && !jms` (인스턴스 목록) | `TodolistCard`, `WorkItem`, `InstanceCard` | `defaultSetting` |
| F2 | 채팅/에이전트 | `/chat`, `/chats`, `/agent-chat/:id`, `/proposals` | `!gs && !pal` (ChatList) | `ChatRoomPage`(11.5k줄), `Chat.vue`(8k줄), `AgentChat` | `defaultSetting` |
| F3 | 프로세스 정의(비PAL 디자이너 스택) | `/definitions*`, `/forms/*`, `/definitions-tree`, `/definition-map*` | `isAdmin && !pal` | `ProcessDefinitionChat`, `ModelCanvas`(4.9k줄) 스택 | `bpmn`, `taskCatalog` |
| F4 | 화면(UI) 정의 | `/ui-definitions/*` | ProcessGPT·PAL 모드 | `UIDefinitionChat`, `FormDefinition` | — |
| F5 | DMN/비즈니스룰 | `/dmn/*`, `/business-rule*` | uEngine 모드 && `!pal` | `DmnChat`, `BusinessRuleDefinitions` | `dmn` |
| F6 | 스킬 관리 | `/skills`, `/skills/:id` | `mode!=='uEngine' && !gs && isAdmin && !pal` | `SkillsManagement`(1.5k줄), SkillList | — |
| F7 | 조직도 | `/organization`, `/organization-before` | PAL: 인라인 / 비PAL: `isAdmin` | PAL: `views/organization/*` ↔ 비PAL: `OrganizationChartChat` (**동일 경로 2중 구현**) | — |
| F8 | 프로세스 체계도 (PAL) | `/process-architecture` | PAL 프로세스 섹션. **PAL 기본 랜딩** | `ProcessArchitecture`(2k줄) + 4개 뷰모드 + 재구성 스튜디오 | `adminConsole` |
| F9 | 프로세스 계층/편집 스튜디오 (PAL) | `/process-hierarchy`, `/version-comparison` | PAL 프로세스 섹션 | `ProcessHierarchy`(5.4k줄) + Designer(4.7k) + Properties(**12.4k줄**) + AIGuide + Blueprint/AN 스튜디오 | `bpmn`, `taskCatalog`, `adminConsole` |
| F10 | 리뷰 보드 | `/review-board*`, `/my-inbox`, `/review-board/restructure`(PAL) | 전 모드 | `ProcessReviewBoard`, `ProcessReviewDetail`, `BpmnUengineViewer` | `adminConsole` |
| F11 | 분석 | `/analytics*`(비PAL), `/analysis-dashboard`(PAL), `/instance-toplist` | 모드별 분기, `!gs` | `Dashboard`, `AnalysisDashboard`(+Grafana iframe), `BottleneckAnalysis`, `KPIDashboard`, `PiFlagBoard` | `analytics/*`, `kpiStore` |
| F12 | 전략/온톨로지 | `/strategy-board`, `/strategy/surveys/:id`, `/analytics/ontology`, `/ontology-explorer`(PAL), `/ontology-explorer-new` | 비PAL/PAL 분기 | **온톨로지 3중 구현** (`ontology-explorer`, `-new`, `ui/OntologyGraphViewer`) | `strategyStore` |
| F13 | Admin Console (PAL) | `/admin-console/*` 11탭, `/call-activity-management`, `/work-assignment`, `/policy-document`, `/systems`, `/external-api-health` | `pal && isAdmin` (**인라인 하드코딩** `VerticalSidebar.vue:354-366`) | `PropertySchemaStudio`(2.8k줄), `AuditTrail`, `SystemOperations` 등 | `adminConsole`(1.8k줄), `taskCatalog`, `systemManagement` |
| F14 | 지식/RAG | `/knowledge`, 계정설정 Knowledge/Drive 탭 | — | `KnowledgeBasePage`, memento API | — |
| F15 | 개발·데모 라우트 | `/design-system*`, `/bpmn-auto-layout-e2e`, `/processgpt-*-e2e`, `/instance-classifier-demo`, `/markdown-editor`, `/slide-editor`, `/present` | 없음 (**인증 게이트 밖 공개 라우트**) | e2e/demo 뷰 | — |

이 외: 인증(K), 랜딩(L), 계정설정 허브(15개 탭, M)는 코어로 보고 플래그 대상에서 제외. 계정설정은 **탭 단위** 플래그가 필요한 페이지(§5.14 참고).

---

## 4. 제안: 환경변수 카탈로그

### 4.1 명명 규칙과 원칙

- 접두사 `VITE_FF_` (feature flag). **`VITE_` 접두사 필수** — 접두사 없는 변수는 클라이언트에 노출되지 않음 (`PROCESS_GPT_OFFICE_MCP_URL`이 이 함정으로 이미 2곳에서 항상 `undefined`).
- 값은 `'true'`/`'false'` 문자열. 판정은 palMode.ts 패턴 재사용: `_env_ 런타임값 → 빌드타임값` 순, 기본값은 **true(켜짐)** — 미설정 배포가 기존과 동일하게 동작하도록.
- 부팅 시 1회 평가 → `window.$features` 동결 객체로 확정 (`Object.defineProperty`, palMode.ts와 동일). 라우터 등록 전에 평가되어야 하므로 `main.ts` 최상단 import.
- 런타임 토글이 필요한 플래그는 **`run.sh` 주입 목록에 반드시 추가** (누락 시 빌드타임 전용이 됨 — 현재 PAL 모드가 이 상태).
- `env.d.ts`에 `ImportMetaEnv` 인터페이스를 도입해 전 플래그를 타입 선언 (현재 env 타입 안전성 전무).

### 4.2 페이지/도메인 플래그 (14개)

| 환경변수 | 대상 도메인 | 기본값 | 비고 |
|---|---|---|---|
| `VITE_FF_CHAT` | F2 채팅/에이전트 | true | |
| `VITE_FF_PROCESS_DEFINITION` | F3 프로세스 정의(비PAL 스택) | true | 정의 체계도(`/definition-map`) 포함 |
| `VITE_FF_UI_DEFINITION` | F4 화면 정의 | true | |
| `VITE_FF_DMN` | F5 DMN/룰 | true | |
| `VITE_FF_SKILLS` | F6 스킬 | true | |
| `VITE_FF_ORGANIZATION` | F7 조직도 | true | |
| `VITE_FF_PROCESS_ARCHITECTURE` | F8 체계도 | true | OFF 시 PAL 기본 랜딩 변경 필요 (§5.8) |
| `VITE_FF_PROCESS_HIERARCHY` | F9 계층 스튜디오 | true | OFF 시 AN/Blueprint 자동 소멸 |
| `VITE_FF_REVIEW_BOARD` | F10 리뷰 보드 | true | |
| `VITE_FF_ANALYTICS` | F11 분석 | true | |
| `VITE_FF_STRATEGY` | F12 전략/온톨로지 | true | |
| `VITE_FF_ADMIN_CONSOLE` | F13 관리 콘솔 일체 | true | 역할 체크와 별개의 축 |
| `VITE_FF_KNOWLEDGE` | F14 지식/RAG | true | |
| `VITE_FF_DEV_ROUTES` | F15 개발·데모 라우트 | **false** | **프로덕션 1순위** — 현재 인증 없이 공개됨 |

### 4.3 AI 플래그 (마스터 1 + 세부 8)

| 환경변수 | 대상 | 기본값 | 차단 지점 |
|---|---|---|---|
| `VITE_FF_AI` | **마스터 스위치** — 모든 AI 호출 | true | `AIGenerator.generate()` + `PalModeBackend.qdrantChat()` 2곳 가드 → 49개 생성기 일괄 차단 |
| `VITE_FF_AI_COPILOT` | 계층 스튜디오 AI Copilot + Blueprint/AN 생성기 | true | `ProcessHierarchyAIGuide.vue` 마운트, `useAnStudio`/`useBlueprintStudio` |
| `VITE_FF_AI_DESIGNER` | BPMN 속성 패널 인라인 생성 버튼(조건룰·cron·스크립트·API 등 10여 패널) | true | 각 패널 버튼 `v-if` |
| `VITE_FF_AI_FORM` | 폼 생성/스캔/인터뷰 AI | true | `FormDesignGenerator`류 진입 버튼 |
| `VITE_FF_AI_VOICE` | 음성(STT/실시간 어시스턴트) | true | `/voice/ws` WebSocket 컴포넌트 4종 마운트 |
| `VITE_FF_AI_IMAGE` | 이미지 생성(dall-e, 마켓플레이스) | true | `ImageGenerator` 사용 다이얼로그 |
| `VITE_FF_AI_DOC_PARSING` | 문서 파싱(Upstage 외부 API 직접 호출) | true | `upstageParser.js` — **브라우저→외부 AI 직접 호출 유일 지점** |
| `VITE_FF_AI_BROWSER_AGENT` | 브라우저 자동화 | true | `BrowserAgent.vue`(localhost 하드코딩 있음) |
| `VITE_FF_AI_CLASSIFIER` | 인스턴스 자동분류/유사 인스턴스(ML) | true | `instanceClassifier.ts`, `/instance-toplist` 라우트 |

판정 규칙: `enabled(X) = FF_AI && FF_AI_X` (마스터 OFF면 세부 전부 OFF).

**AI 플래그에 포함하면 안 되는 것**: `/completion/complete`·`/vision-complete`는 **프로세스 인스턴스 실행 경로 자체**이고, `/completion/set-tenant`·`/invite-user`·`/create-user`·`/role-binding`은 AI가 아닌 CRUD임. `/completion` 프록시를 통째로 끄면 실행/온보딩이 죽음 → **프록시 단위가 아니라 함수(생성기) 단위로 차단해야 함.**

---

## 5. 도메인 플래그별 OFF 영향도 분석

각 항목: **제거 대상**(라우트/메뉴) → **타 페이지 파급** → **리스크/주의**.

### 5.1 `VITE_FF_CHAT` (채팅/에이전트)

- **제거**: 라우트 `/chat`, `/chats`, `/agent-chat/:id`, `/proposals` · 사이드바 `ChatList`, `AgentList`, `SidebarUserList`(사람 동료), 에이전트 관련 메뉴
- **파급**:
  - 헤더 알림에서 `/chat?roomId=` 딥링크가 404 → 알림 클릭 핸들러에서 분기 필요
  - `ProcessDefinitionTeamChat`(계층 스튜디오 협업 채팅)은 별도 컴포넌트라 **살아남음** — 원하면 별도 판단
  - `WorkAssistantChatPanel`(워크아이템 보조 채팅)도 별개 — F1 코어에 붙어 있으므로 유지 권장
- **리스크**: `Chat.vue`(8k줄)·`ChatModule.vue`는 14곳+에서 재사용되는 기반 컴포넌트 — **컴포넌트를 끄는 게 아니라 라우트·메뉴·진입 버튼만 끊어야 함**. 조직도 챗, DMN 챗 등은 각자의 플래그를 따름.

### 5.2 `VITE_FF_PROCESS_DEFINITION` (비PAL 정의 스택)

- **제거**: `/definitions*`, `/forms/*`, `/definitions-tree`, `/definition-map*` · 사이드바 "프로세스 정의", 정의 목록 트리, 로고 옆 정의 체계도 아이콘
- **파급**:
  - strategy/OntologyExplorer가 `/definitions/:id`로 네비게이트 → 링크 숨김 필요
  - 랜딩 TutorialSection → `/definitions` 링크
  - `/forms/*`가 같은 컴포넌트(`ProcessDefinitionChat`)를 씀 — 폼 정의만 살리려면 분리 불가, 함께 꺼짐
- **리스크**: 이 도메인은 `ModelCanvas` 디자이너 스택 전용이라 PAL의 `BpmnUengine` 스택(F9)과 독립적 — PAL 배포에서는 어차피 사이드바에서 숨겨져 있어 OFF 부담 낮음. 단 **실행 중 인스턴스의 정의 열람 경로**가 있는지 배포 전 확인 필요.

### 5.3 `VITE_FF_UI_DEFINITION` (화면 정의)

- **제거**: `/ui-definitions/*` · 사이드바 "화면 정의"
- **파급**: WorkItem 폼 렌더링은 저장된 폼 정의를 읽을 뿐이므로 **기존 폼 실행에는 영향 없음**. 새 폼 제작만 불가.
- **리스크**: 낮음. `FormDefinition`/`FormScanModule`은 AI 플래그(`FF_AI_FORM`)와 교차 — 페이지는 살리고 AI만 끄는 조합 가능.

### 5.4 `VITE_FF_DMN` (DMN/비즈니스룰)

- **제거**: `/dmn/*`, `/business-rule*` · 사이드바 "룰 정의"
- **파급**: BPMN 디자이너의 BusinessRule Task 패널에서 룰 참조/편집 진입 → 버튼 숨김 필요. `organizationDmnRule.ts`(조직 DMN 룰)가 조직도와 결합되어 있는지 확인 필요.
- **리스크**: uEngine 모드 전용 메뉴라 ProcessGPT 배포에선 이미 숨겨져 있음. `dmn` 스토어는 단독 사용이라 격리 용이.

### 5.5 `VITE_FF_SKILLS` (스킬)

- **제거**: `/skills`, `/skills/:id` · 사이드바 스킬 목록·아이콘
- **파급**: 채팅의 skill context 주입(`Chat.vue:5645`), `SkillProposalBadge`/`ReviewModal`(제안 승인 UI), `AgentSkillEdit` — 에이전트 상세에서 스킬 편집 탭 숨김 필요. DeepAgents 오케스트레이션은 백엔드 스킬을 계속 쓸 수 있으므로 **UI 관리 기능만 꺼지는 것**임을 문서화.
- **리스크**: 중간. 채팅(F2)과 진입점이 얽혀 있어 `FF_CHAT`과의 조합 매트릭스 테스트 필요.

### 5.6 `VITE_FF_ORGANIZATION` (조직도)

- **제거**: `/organization`, `/organization-before` · 사이드바 조직도(PAL 인라인/비PAL 배열 양쪽)
- **파급**:
  - strategy/OntologyExplorer → `/organization` 네비게이트
  - `OwnerSelect`/`OwnerSettingDialog`(계층 스튜디오 속성 패널)는 조직 데이터를 **읽기만** 하므로 유지되지만, "조직도에서 보기" 류 링크는 숨김 필요
  - 계정설정 `OrgChartGroupTab`도 조직 데이터 의존 — 함께 숨길지 결정 필요
- **리스크**: 조직 **데이터**(configuration `organization` key)는 소유자 지정·업무분장 등 다른 기능의 기반. **화면만 끄고 데이터 로딩은 유지**해야 함.

### 5.7 `VITE_FF_PROCESS_ARCHITECTURE` (체계도)

- **제거**: `/process-architecture` · 사이드바 "프로세스 체계도"
- **파급**:
  - **PAL 로그인 후 기본 랜딩이 이 페이지** (`router/index.ts:136-141`) → OFF 시 대체 랜딩(`/process-hierarchy` 또는 `/todolist`) 지정 필수, 아니면 로그인 직후 404
  - Admin PiFlagBoard → `/process-architecture` 네비게이트
  - 계층 스튜디오 진입 쿼리(`entry=architecture`)가 사라짐 — 계층 스튜디오는 직접 진입으로 대체 가능
- **리스크**: 높음(랜딩). 재구성 모드·승인보드(`/review-board/restructure`)가 이 페이지에서 시작되므로 함께 무의미해짐.

### 5.8 `VITE_FF_PROCESS_HIERARCHY` (계층 스튜디오)

- **제거**: `/process-hierarchy`, `/version-comparison`, `/process-hierarchy/process_management` · 사이드바 해당 항목
- **파급** (가장 넓음):
  - **AN Transformation Studio·Blueprint Studio는 독립 라우트가 없어 자동 소멸** (계층 스튜디오 다이얼로그 전용)
  - Process Architecture → 계층 스튜디오 네비게이트(`buildProcessHierarchyQuery`) → 카드 클릭이 죽음. **F8과 사실상 세트** — 함께 끄거나, F8의 상세 진입을 비활성화
  - Admin의 `CallActivityManagement`·`PropertySchemaStudio`가 `ProcessHierarchyOpenButton`으로 진입 → 버튼 숨김 필요
  - Review Board 제출의 원천(Properties 탭에서 리뷰 제출) → 리뷰보드는 조회 전용으로 퇴화
- **리스크**: 최고. PAL의 중심 기능이라 OFF는 사실상 "PAL 축소판" 배포를 의미. 플래그는 만들되 지원 시나리오를 명확히 한정할 것.

### 5.9 `VITE_FF_REVIEW_BOARD` (리뷰 보드)

- **제거**: `/review-board`, `/review-board/:id`, `/my-inbox`, `/review-board/restructure`, `/review-board-debug` · 사이드바 "프로세스 리뷰 보드"/"내 수신함"
- **파급**:
  - 계층 스튜디오 Properties의 **리뷰 제출 버튼** 숨김 필요 (제출해도 볼 곳이 없음)
  - 재구성 승인 플로우(체계도 재구성 모드 → 승인보드) 단절 → 재구성 모드도 함께 숨기거나 즉시 반영 모드로 전환 필요
  - 헤더/알림의 리뷰 요청 알림 딥링크 처리
- **리스크**: 중간. 거버넌스(승인 없이 수정 반영) 정책 변화를 수반하므로 운영 합의 필요.

### 5.10 `VITE_FF_ANALYTICS` (분석)

- **제거**: `/analytics`, `/analytics/heatmap`, `/analytics/kpi`, `/analytics/pi-flags`, `/analysis-dashboard`, `/instance-toplist` · 사이드바 분석 섹션 전체(비PAL 배열 + PAL 덮어쓰기 블록 양쪽)
- **파급**: StrategyBoard ↔ KPI 대시보드 상호 링크, Admin `UsageAdoptionDashboard`는 Admin Console 소속이라 **잔존**(F13 소관). Grafana iframe은 페이지와 함께 사라짐.
- **리스크**: 낮음~중간. `analytics/*` 스토어 4종은 이 도메인 전용이라 격리 용이. `cubeStore`(507줄)는 이미 미라우팅 페이지 전용으로 도달 불가 상태.

### 5.11 `VITE_FF_STRATEGY` (전략/온톨로지)

- **제거**: `/strategy-board`, `/strategy/surveys/:id`, `/analytics/ontology`, `/ontology-explorer`, `/ontology-explorer-new` · 사이드바 해당 항목
- **파급**: strategy/OntologyExplorer는 `/organization`, `/definitions/:id`, `/skills/:name`, `/strategy-board`로 뻗는 **교차 허브** — 끊기는 건 "진입 경로"뿐이라 안전. 채팅 내 `OntologyGraphViewer`는 별개 구현이라 잔존(F2 소관).
- **리스크**: 낮음. KPI 대시보드가 `strategyStore`를 함께 쓰므로 F11과 조합 테스트 필요.

### 5.12 `VITE_FF_ADMIN_CONSOLE` (관리 콘솔)

- **제거**: `/admin-console/*` 11탭, `/call-activity-management`, `/work-assignment`, `/policy-document`, `/systems`, `/external-api-health` · **사이드바 인라인 하드코딩 블록(`VerticalSidebar.vue:354-366`) — MENU_DEFINITIONS를 우회하므로 별도 처리 필수**
- **파급**:
  - `adminConsole` 스토어(1.8k줄)는 Review Board·Process Architecture·계층 Properties·GlobalNoticeBanner까지 **13곳이 공유** → 스토어 자체는 끄면 안 됨. 라우트/메뉴만 제거
  - 속성 스키마를 못 만들면 계층 Properties의 스키마 필드는 기존 저장분으로만 렌더 — 동작엔 문제 없음
  - 전역 공지 배너는 SystemOperations에서 설정 — OFF 시 신규 공지 불가(기존 공지는 계속 표시)
- **리스크**: 중간. 역할(admin) 체크와 별개의 축이므로 "admin이어도 콘솔 없음" 배포가 가능해짐 — 운영 절차 문서화 필요.

### 5.13 `VITE_FF_KNOWLEDGE` (지식/RAG)

- **제거**: `/knowledge` · 계정설정 `KnowledgeFilesTab`·`DriveTab` 숨김 · 채팅의 RetrievalBox/`/query` 슬래시 커맨드 숨김
- **파급**: `/memento/*` 호출 전반(파일 업로드, Drive 연동, RAG 질의). 에이전트 지식 설정(`AgentKnowledgeManagement`)도 함께 숨김 대상.
- **리스크**: 낮음. 단 이미 업로드된 지식으로 동작하던 에이전트 답변 품질이 변할 수 있음(백엔드는 계속 RAG를 쓸 수 있으므로 "UI 관리만 차단"임을 명시).

### 5.14 `VITE_FF_DEV_ROUTES` (개발·데모, 기본 OFF 권장)

- **제거**: `/design-system`, `/design-system/login`, e2e 3종, `/instance-classifier-demo`, `/markdown-editor`, `/slide-editor`, `/present`
- **파급**: ⚠️ `/markdown-editor`·`/slide-editor`·`/present`는 공개 라우트이지만, **`MarkdownField`/`ReportField`/`SlideField` 폼 필드가 `views/markdown/*` 컴포넌트를 역임베드**함 → 라우트만 제거하고 **컴포넌트는 번들에 유지**해야 워크아이템 폼이 깨지지 않음.
- **리스크**: 라우트 제거 자체는 안전하고 보안상 이득(현재 인증 게이트 밖 노출). **프로덕션 적용 1순위.**

### 참고: 계정설정 허브 (플래그 교차 지점)

`AccountSettings.vue`는 15개 탭의 허브로, 탭들이 여러 도메인에 속함: Knowledge/Drive→F14, Skills→F6, MCPServer/MCPEnvSecret→AI 인프라, GlossaryManageTab→외부 API(`VITE_ROBO_API_BASE_URL`), TaskCatalog→F13 인접. **탭 표시 여부를 도메인 플래그에서 파생**시키는 구현이 필요(탭 전용 플래그 신설보다 파생이 유지보수에 유리).

---

## 6. AI 기능 분산 현황과 플래그 영향도

### 6.1 아키텍처 요약

```
[레거시 경로]  49개 생성기(src/components/ai/*) ──상속──▶ AIGenerator.js
                └─ POST /completion/langchain-chat/messages (XHR 스트리밍)
[PAL 경로]     10여 개 AN/Blueprint/온톨로지 생성기 ──▶ PalModeBackend.qdrantChat()
                └─ POST /pi-system-backend/langchain-chat/qdrant-chat/stream (SSE)
[에이전트 경로] AgentRouterService(/agent-router) · DeepAgentRouterService(/process-gpt-deepagents)
                · WorkAssistantAgentService(/agent) — 각자 SSE 스트리밍
[음성 경로]    wss://{host}/voice/ws — OpenAI Realtime 프로토콜 (vite dev 프록시 누락)
[외부 직접]    upstageParser.js → api.upstage.ai (브라우저 직접 호출 유일 지점)
```

→ **마스터 `FF_AI`는 위 5개 경로의 진입 함수에 가드**를 넣는 것으로 구현: `AIGenerator.generate()`, `qdrantChat()`, 3개 에이전트 서비스의 `chat/stream` 호출부, 음성 컴포넌트 마운트, upstage 파서.

### 6.2 AI 의존도별 페이지 분류

**① AI OFF 시 페이지 자체가 무의미 → 라우트·메뉴를 함께 숨겨야 함**

| 페이지 | 도메인 플래그와의 관계 |
|---|---|
| `/chat`, `/chats`, `/agent-chat/:id` | `FF_AI` OFF ⇒ `FF_CHAT`도 강제 OFF 처리 권장 |
| `/definitions/chat`, `/definitions-tree`, `/ui-definitions/chat`, `/dmn/chat` | 각 도메인의 "chat 진입"만 숨기고 목록/편집은 유지 가능 |
| `/skills*`, `/proposals` | DeepAgents 전제 기능 — `FF_AI` OFF 시 함께 숨김 |
| `/instance-toplist` (ML 분류) | `FF_AI_CLASSIFIER` |
| 계층 스튜디오 AI Copilot 패널 + Blueprint/AN 탭 | `FF_AI_COPILOT` — 페이지(F9)는 유지, 패널만 숨김 |

**② AI가 부가기능 → 버튼/패널만 숨기면 페이지 정상 동작**

- BPMN 속성 패널 생성 버튼 10여 곳(조건룰, cron, 스크립트, API, 서브프로세스, diff 요약 등) — `FF_AI_DESIGNER`
- 폼 스캔/인터뷰/디자인 생성 — `FF_AI_FORM`
- 음성 입력(AudioTextarea)·실시간 어시스턴트(FormRealtimeAssistant)·데스크톱 보이스 — `FF_AI_VOICE`
- 마켓플레이스 대표 이미지 생성 — `FF_AI_IMAGE`
- 문서 파싱(Upstage), 온톨로지 인사이트 내러티브, StrategyBoard AI 제안/정렬, 유사 인스턴스 패널, 브라우저 에이전트, 커밋 메시지·채팅방 이름 자동생성 — 각 세부 플래그

**③ 경계 케이스 — AI 플래그로 끄면 안 되는 것**

- `/completion/complete`·`/vision-complete`: **인스턴스 실행 엔진 경로**. 자동화 태스크(에이전트 태스크) 실행이 여기를 타므로, 끄면 프로세스 진행이 멈춤. AI 플래그 범위에서 명시적으로 제외.
- `/completion/set-tenant`, `/invite-user`, `/create-user`, `/update-user`, `/role-binding`, `/process-db-schema`: completion 서비스에 동거하는 **비AI CRUD**. 프록시/서비스 단위 차단 금지.
- `/validate-and-improve`: 실엔진 검증 + LLM 개선이 한 몸 — OFF 시 "검증만 수행" 폴백이 백엔드에 있는지 확인 필요.

### 6.3 AI 플래그 OFF 시 UI 처리 원칙

1. 생성 버튼·패널은 **렌더링 자체를 제거**(`v-if`) — disabled 처리 시 "왜 안 되냐" 문의 유발.
2. 슬래시 커맨드(`/partition`, `/gap`, `/tobe` 등 `anIntentRouter`)는 도움말 목록에서도 제거.
3. 가드에 걸린 호출은 조용히 무시하지 말고 **명시적 에러**("이 배포에서는 AI 기능이 비활성화되어 있습니다")를 반환 — 잔여 진입점 탐지에 도움.

---

## 7. 플래그 도입 전 정리 필요한 결합·부채

플래그를 "깨끗하게" 걸기 위해 선행 정리를 권장하는 항목:

| # | 항목 | 문제 | 권장 조치 |
|---|---|---|---|
| 1 | 사이드바 메뉴 3중 분산 | `VerticalSidebar.vue` 명령형 배열 6개 + 템플릿 인라인 리터럴(PAL 관리자 11개) + `MENU_DEFINITIONS`(미연결) | 메뉴 SSOT를 `MENU_DEFINITIONS`로 일원화하고 `feature?: string` 필드 추가 → 사이드바·라우터가 공통 필터 사용 |
| 2 | 라우터 가드에 권한·플래그 체크 부재 | URL 직접 입력으로 진입 가능 | `beforeEach`에 `matchByPath()` + feature flag 판정 추가 (라우트 미등록 방식과 병행) |
| 3 | `adminConsole` 스토어 광범위 결합 | Admin 밖 13곳이 공유 | 플래그는 라우트/메뉴만 제어, 스토어는 유지. 장기적으로 스토어 분리 |
| 4 | `/completion`에 AI·비AI 혼재 | 프록시 단위 차단 불가 | 함수 단위 가드(§6). 장기적으로 백엔드 서비스 분리 |
| 5 | 죽은 플래그 | `window.$gs` 할당 없음(11개 파일이 읽음), `window.$jms` 하드코딩 false | `$gs`는 `isGsMode`와 통합하거나 제거, `$jms` 제거 |
| 6 | 죽은 코드·스토어 | `reviewBoard.ts`·`authUser.ts` 스토어 소비처 0, `sidebarItem` 렌더 루프, `ReviewBoardCard.vue`, `KpiTargetManager.vue`(구버전), `JsonAIGenerator.js`, `SequenceFlowPanel copy.vue`, 템플릿 잔재 뷰 다수 | 삭제 (플래그 대상에서 제외) |
| 7 | 라우트 중복·유령 | `TaskCatalogAdmin` 2중 등록, `Ontology Explorer` name 중복, `MENU_DEFINITIONS` 유령 경로 5개 | 정리 후 플래그 적용 |
| 8 | run.sh 주입 목록 하드코딩 | `VITE_PAL_MODE`조차 미주입 — 런타임 토글 불가 | 신규 `VITE_FF_*` 전체 + `VITE_PAL_MODE`를 주입 목록에 추가 |
| 9 | env 타입 부재 | `ImportMetaEnv` 미선언 → `PROCESS_GPT_OFFICE_MCP_URL` 접두사 누락 버그 존재 | `env.d.ts`에 전 변수 타입 선언 |
| 10 | 음성 dev 프록시 누락 | `/voice` 프록시가 nginx에만 있고 vite에 없음 | `FF_AI_VOICE` 구현 시 함께 추가 |
| 11 | 하드코딩 URL | `BrowserAgent.vue`의 `http://localhost:8999` | env 변수화(`VITE_BROWSER_AGENT_URL`) |

---

## 8. 구현 가이드

### 8.1 플래그 모듈 (palMode.ts 패턴 복제)

```ts
// src/featureFlags.ts — main.ts 최상단에서 palMode 직후 import
const FLAG_KEYS = [
  'CHAT', 'PROCESS_DEFINITION', 'UI_DEFINITION', 'DMN', 'SKILLS',
  'ORGANIZATION', 'PROCESS_ARCHITECTURE', 'PROCESS_HIERARCHY',
  'REVIEW_BOARD', 'ANALYTICS', 'STRATEGY', 'ADMIN_CONSOLE',
  'KNOWLEDGE', 'DEV_ROUTES',
  'AI', 'AI_COPILOT', 'AI_DESIGNER', 'AI_FORM', 'AI_VOICE',
  'AI_IMAGE', 'AI_DOC_PARSING', 'AI_BROWSER_AGENT', 'AI_CLASSIFIER',
] as const;

const DEFAULT_OFF = new Set(['DEV_ROUTES']);

function resolve(key: string): boolean {
  const envKey = `VITE_FF_${key}`;
  const runtime = (window as any)._env_?.[envKey];
  const build = (import.meta as any).env?.[envKey];
  const raw = runtime ?? build;
  if (raw === undefined || raw === '') return !DEFAULT_OFF.has(key);
  return raw === true || raw === 'true';
}

const features = Object.fromEntries(FLAG_KEYS.map(k => [k, resolve(k)]));
// AI 세부 플래그는 마스터에 종속
for (const k of FLAG_KEYS) {
  if (k.startsWith('AI_')) features[k] = features['AI'] && features[k];
}
Object.defineProperty(window, '$features', {
  value: Object.freeze(features), writable: false, configurable: false,
});
```

### 8.2 적용 층위 (4곳 모두 필요)

1. **라우트 등록**: PAL 스프레드 패턴 재사용 — `...(window.$features.CHAT ? [chatRoutes] : [])`. 등록 자체를 제외하면 URL 진입이 404로 떨어져 가드 없이도 차단됨.
2. **사이드바**: `MENU_DEFINITIONS`에 `feature?: FlagKey` 추가 → 사이드바 빌드 시 공통 필터. 인라인 하드코딩 블록(PAL 관리자 메뉴)도 같은 필터를 통과하도록 수정.
3. **페이지 내 진입 버튼/패널**: 교차 링크(§5의 파급 항목)와 AI 버튼은 `v-if="$features.X"`.
4. **호출부 가드**: `AIGenerator.generate()`, `qdrantChat()` 등 §6.1의 5개 경로 진입 함수.

### 8.3 배포 체크리스트

- [ ] `.env.example`에 23개 플래그 + 기본값 + 한 줄 설명 문서화
- [ ] `run.sh` 주입 목록에 `VITE_FF_*` 전체 추가 (런타임 토글용)
- [ ] `env.d.ts`에 `ImportMetaEnv` 선언
- [ ] PAL 랜딩 폴백: `FF_PROCESS_ARCHITECTURE=false`일 때 대체 랜딩 지정
- [ ] 조합 매트릭스 최소 검증: `AI=false` 전체, `CHAT=false`+`SKILLS=true`, `PROCESS_HIERARCHY=false`+`PROCESS_ARCHITECTURE=true`, `DEV_ROUTES=false`(프로덕션 기본)
- [ ] 알림/딥링크 핸들러의 플래그 분기 (채팅·리뷰보드)

### 8.4 단계별 로드맵 제안

| 단계 | 내용 | 리스크 |
|---|---|---|
| 1 | `featureFlags.ts` 도입 + `FF_DEV_ROUTES`(기본 OFF)만 적용 — 공개 라우트 차단 | 최소, 즉시 보안 이득 |
| 2 | `FF_AI` 마스터 + 2대 차단 지점 가드, AI 버튼 `v-if` 일괄 적용 | 낮음 (기본 true라 무변화 배포) |
| 3 | 도메인 플래그 14개 — 라우트 스프레드 + 사이드바 필터 | 중간 — §5 파급 링크 처리 필요 |
| 4 | AI 세부 플래그 8개 + 계정설정 탭 파생 표시 | 중간 |
| 5 | (선택) 테넌트별 오버라이드 — `configuration` 테이블 `feature_flags` key + `menu_role_overrides` 캐시 패턴 복제 | 별도 설계 |

> 메모리 규약 준수: 구현 시 모든 변경은 PAL 전용 배포를 기준으로 하되, 플래그 기본값을 전부 "기존 동작 유지"로 두므로 비 PAL 동작에는 영향이 없음.
