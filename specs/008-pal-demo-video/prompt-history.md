# Prompt History — 008-pal-demo-video

작업이력: 이 스펙에 대해 사용자가 입력한 프롬프트가 시간순으로 수집됩니다.

## Prompt — 2026-09-17T03:41:29+00:00

```text
> 의도 (why & value)
- ProcessGPT PAL에 대한 시연을 TYM에서 제공한 프로세스를 기반으로 시나리오를 작성하고 준비한다.

> 인수조건 (Definition of Done)
- 프로세스 드로잉부터 ProcessGPT PAL에서 강조할 수 있는 기능(AI 기능 제외)을 설명할 수 있는 20분 이내로 시연 가능한 scenario.md 
- 시나리오의 각 부분 별 영상과 음성

> 컨텍스트 (참고자료 위치)
- @"P5.4.3 내부심사 프로세스.pptx" 
- @docs/PI_System_통합_사용자_매뉴얼.docx 
- 발표 시간 20분
```

## Note — 2026-09-17T04:23:08+00:00

```text
구현 완료: 20분 시연 패키지 — docs/demo-p543-pal/{scenario.md, narration/*.txt, videos/part1-6.webm, audio/part1-7.mp3, preview/part1-6.mp4}. 녹화 스크립트 scripts/demo/record-demo.mjs(파트별 Playwright 녹화, input 필드 자동 원복), 음성 scripts/demo/make-audio.sh(edge-tts ko-KR-InJoonNeural), 합본 scripts/demo/make-preview.sh. 로컬 tym P5.4.3에 필수 Rule 3건(기술서 원문) 시드.
```

## Note — 2026-09-17T04:23:08+00:00

```text
매뉴얼 작성: 해당 없음 — 앱 기능 추가가 아닌 시연 자산 제작으로, 사용 문서는 docs/demo-p543-pal/scenario.md(진행 대본·재생성 방법 포함)가 그 역할을 함
```

## Prompt — 2026-09-17T05:54:18+00:00

```text
영상의 화면이 너무 깜빡거림. 계속 새로고침이 되는 느낌인데.
```

## Note — 2026-09-17T06:03:53+00:00

```text
영상 깜빡임 개선: 로그인을 녹화 밖으로 분리(storageState 재사용), 파트2 리로드→읽기 모드 전환, 파트3 admin 이동→사이드바 SPA 내비게이션으로 대체. 전 파트 재녹화 — 순백(리로드) 프레임 0 확인, 파트 길이 20~45초로 단축. preview mp4 재생성.
```

## Prompt — 2026-09-18T01:31:18+00:00

```text
1. ProcessGPT PAL에 대한 홍보 페이지
> 의도 (why & value)
- ProcessGPT PAL에 대한 홍보 페이지를 작성하여 신규 고객들이 해당 페이지를 보고 제품에 대한 관심을 가질 수 있다.

> 인수조건 (Definition of Done)
- /to-be 기능이 pi-flag 유무에 따른 생성이 정상적으로 진행될 수 있다.

> 컨텍스트 (참고자료 위치)
- https://www.uengine.org/contents/processgpt.html
- https://www.youtube.com/watch?v=kd6_hKSQDYc
- https://www.uengine.org/contents/uengine6bpm.html
- https://www.youtube.com/watch?v=ZmytoLlvpMs
- https://www.uengine.org/contents/roboanalyzer.html
- https://www.uengine.org/contents/roboarchitect.html
```

## Prompt — 2026-09-18T01:31:55+00:00

```text
1. ProcessGPT PAL에 대한 홍보 페이지
> 의도 (why & value)
- ProcessGPT PAL에 대한 홍보 페이지를 작성하여 신규 고객들이 해당 페이지를 보고 제품에 대한 관심을 가질 수 있다.

> 인수조건 (Definition of Done)
- ProcessGPT PAL의 주요 기능 및 강점이 드러난 제품 홍보 영상
- 기존 회사의 제품 소개페이지를 참고(컨텍스트 참조)한 ProcessGPT PAL에 대한 소개 페이지

> 컨텍스트 (참고자료 위치)
- https://www.uengine.org/contents/processgpt.html
- https://www.youtube.com/watch?v=kd6_hKSQDYc
- https://www.uengine.org/contents/uengine6bpm.html
- https://www.youtube.com/watch?v=ZmytoLlvpMs
- https://www.uengine.org/contents/roboanalyzer.html
- https://www.uengine.org/contents/roboarchitect.html
```

## Prompt — 2026-09-18T01:37:11+00:00

```text
<task-notification>
<task-id>a8cb0745e9bba1fd0</task-id>
<tool-use-id>toolu_01YRhQ5s1yKHpPGkEX8wuK4a</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/01e62e4a-7308-428c-aa2d-2d36dad7c64f/tasks/a8cb0745e9bba1fd0.output</output-file>
<status>completed</status>
<summary>Agent "PAL 기능 자료 조사" finished</summary>
<note>A task-notification fires each time this agent stops with no live background children of its own. The user can send it another message and resume it, so the same task-id may notify more than once.</note>
<result>I have enough to produce the report.

---

# ProcessGPT PAL 조사 결과 (홍보 페이지용)

## 0. 먼저 — "PAL"의 풀네임에 대한 사실 확인

**레포 전체를 검색한 결과, PAL의 풀네임(약어 확장)은 어디에도 문서화되어 있지 않습니다.** `docs/`, `specs/`, 코드 주석, 커밋 메시지, i18n 파일 모두에서 "Process Autonomous Loop" 등의 확장형은 발견되지 않았습니다.

확인된 사실만 정리하면:
- 제품 표기는 항상 **"ProcessGPT PAL"** (`/home/kimsanghoon/process-gpt-vue3/docs/demo-p543-pal/narration/part1.txt`, `scenario.md` 제목)
- 기술적으로는 **빌드타임 플래그 `VITE_PAL_MODE`** 로 켜지는 프론트엔드 **모드**이며, `/home/kimsanghoon/process-gpt-vue3/src/palMode.ts` 가 `window.$pal` 전역을 확정(`writable: false`)합니다.
- 기원은 **PI-System**(`playground-pi-system-web`)의 기능을 ProcessGPT로 이관한 것 (`/home/kimsanghoon/process-gpt-vue3/docs/pal-migration/README.md`). "PI"는 Process Innovation(프로세스 혁신)을 뜻하며, PAL 화면 곳곳에 "PI 진행 진도율", "PI Flag", "PI 추진 담당자" 표현이 남아 있습니다.

→ **홍보 페이지 작성 시 풀네임은 반드시 제품 오너에게 확인이 필요합니다.** 기능 실체로 유추하면 "Process Asset Lifecycle" / "Process Architecture Layer" 계열이 가장 근접하지만 **레포상 근거는 없습니다.**

### 제품 포지셔닝 (근거 있는 서술)
PAL은 ProcessGPT의 **엔터프라이즈 프로세스 자산 관리(Process Asset Governance) 모드**입니다. 기존 ProcessGPT가 "AI 에이전트가 프로세스를 실행"하는 데 방점이 있다면, PAL은 **문서(규정서·기술서)로만 존재하던 전사 프로세스 체계를 살아있는 구조화 데이터로 전환하고, 승인·버전·감사까지 통제**하는 데 방점이 있습니다.

결정적 근거 — 데모 내레이션 (`docs/demo-p543-pal/narration/part1.txt`):
&gt; "오늘 시연에는 **AI 기능을 일절 사용하지 않습니다**. 모든 화면은 사람이 직접 조작합니다."
&gt; "이 모든 것이 **AI 없이, 현업 관리자의 손으로 운영 가능한** 기능들입니다. 여기에 AI 기능이 더해지면 작성과 분석이 한층 빨라집니다." (part7)

즉 PAL의 셀링포인트는 "AI가 없어도 완결되는 엔터프라이즈 BPM 거버넌스 + 켜면 더 빨라지는 AI"라는 **이중 구조**입니다. ISO 내부심사 등 인증 대응 문서 통제를 명시적 타깃으로 삼고 있습니다.

---

## 1. 핵심 기능 목록

### A. 프로세스 자산 모델링

**1) 프로세스 체계도 (Process Architecture) — `/process-architecture`**
Mega → Major → Sub 3계층 프로세스 맵을 트리·카드·매트릭스·Mermaid 4개 뷰로 제공합니다. 기술서 문서 안에만 있던 프로세스 지도가 그대로 시스템 내비게이션이 되며, 각 카드에 승인 단계(0~4단계)와 버전이 표시되고 상단 집계 바로 전사 진척도를 한눈에 봅니다. PAL 로그인 후 **기본 랜딩 화면**입니다.
- *가치*: "프로세스 지도를 PPT로 관리하다 시스템 내비게이션으로 승격" — 문서와 시스템의 이중 관리 종식
- 파일: `/home/kimsanghoon/process-gpt-vue3/src/views/process-architecture/ProcessArchitecture.vue`, `processClassification.ts`

**2) BPMN 순서도 디자이너 (실행 조건을 가진 모델)**
레인·태스크·게이트웨이를 컨텍스트 메뉴로 몇 번 클릭해 그립니다. 핵심은 "그림이 아니라는 점" — 승인 게이트웨이에 분기 조건이 실제 값으로 들어가고, "효과성 불충분 → 시정조치 복귀" 같은 루프까지 실행 가능한 모델로 표현됩니다. Call Activity 인라인 드릴다운으로 하위 프로세스를 캔버스에서 바로 파고듭니다.
- *가치*: 문서 흐름도를 누락 없이 옮기면서, 그 순간 실행·분석·감사 가능한 자산이 됨
- 파일: `/home/kimsanghoon/process-gpt-vue3/src/views/process-hierarchy/ProcessHierarchyDesigner.vue`, `/home/kimsanghoon/process-gpt-vue3/src/components/customDrilldown/CallActivityDrilldown.js`

**3) RACI + 세부 업무 수행 절차 (속성 데이터화)**
태스크마다 R(책임)/A(승인)/S(지원)/C(자문)/I(통보) 5역할과 단계별 수행 절차를 구조화 데이터로 입력합니다. R을 비우면 해당 태스크가 놓인 레인 이름이 자동으로 채워지고, 툴바 RACI 버튼으로 **전체 Task × 조직 통합 매트릭스**를 열어 셀 클릭만으로 공백→R→A→S→C→I 순환 편집이 됩니다.
- *가치*: 규정서의 RACI 표·절차서가 "첨부 문서"가 아니라 "질의·분석·감사 가능한 데이터"가 됨
- 매뉴얼: `/home/kimsanghoon/process-gpt-vue3/docs/manuals/raci-task-settings.md`

**4) Task 카탈로그 — `/admin-console/task-catalog`**
"임원 승인", "전자결재 상신" 같은 반복 표준 업무를 카탈로그에 한 번 등록해 두고, 어느 프로세스에서든 **속성째** 꺼내 씁니다. 적용 시 이름·업무 유형만이 아니라 세부 절차·RACI·관련자료 링크·사용자 정의 속성까지 함께 들어옵니다. 순서도 요소 변경(replace) 메뉴와 속성 패널 두 경로 모두에서 사용 가능하고, 잘 만든 태스크를 그 자리에서 카탈로그에 역등록할 수도 있습니다.
- *가치*: **"두 번째 프로세스부터는 그리기가 아니라 조립"** — 속도와 전사 표기 품질 균일화를 동시에
- 매뉴얼: `/home/kimsanghoon/process-gpt-vue3/docs/manuals/task-catalog.md`, DB 테이블 `task_catalog`

**5) 속성 스키마 스튜디오 — `/admin-console/property-schemas` ★최대 차별점**
고객사마다 다른 기술서 양식(Input/Output 표, 통제 Rule 등)을 **코드 수정도 배포도 없이** 흡수합니다. 관리자가 관리 화면에서 필드(키·라벨·타입·선택지 소스·그룹·표시순서·필수 여부·조건부 표시)를 추가하면, 순서도 속성 패널에 즉시 나타납니다. 값은 태스크의 uengine json에 `property_key` 그대로 저장되어 BPMN과 완전 호환됩니다.
- *가치*: **"속성 메타모델 자체가 관리 화면에서 움직이는 것, 이것이 PAL의 큰 차별점"** (내레이션 part5 원문). 고객사별 커스터마이징이 SI 프로젝트가 아니라 설정 작업이 됨
- 발전 로드맵: `/home/kimsanghoon/process-gpt-vue3/docs/widget-composer-design.md` — 전용 위젯 자체를 선언적 DSL(`config.composite`)로 전환해 관리자가 위젯 레이아웃까지 편집·미리보기하는 설계안 (Phase 0~3)

**6) 목록 관리 (선택지 목록) — `/admin-console/option-lists`**
선택형 속성이 참조하는 공용 선택지 목록을 주제별로 관리합니다. "사업부", "내부심사 문서" 같은 목록을 한 번 만들면 여러 속성이 공유 참조하며, 항목을 고칠 때 목록 한 곳만 바꾸면 전 속성에 반영됩니다. 카드에 "속성 N개에서 사용" 배지가 표시됩니다.
- *가치*: 새 문서 양식이 생겨도 목록에 항목 한 줄 추가로 끝 — 운영 관리 포인트 최소화
- 매뉴얼: `/home/kimsanghoon/process-gpt-vue3/docs/manuals/option-lists.md`

**7) 용어 사전 (Glossary) — `/glossary`**
프로세스 규정서의 "용어 정의" 표를 시스템으로 옮깁니다. 프로세스 속성 패널에서 용어를 정의하면 **기존 용어 추천 목록**(정의 미리보기 + 출처 프로세스명)이 떠서 재사용할 수 있고, 조직 전체 용어가 `/glossary`에 용어 단위로 묶여 "어떤 프로세스가 어떤 의미로 쓰는지"를 한눈에 보여줍니다. 대소문자·공백 무시 동일 용어 판정.
- *가치*: 전사 용어 불일치 해소 — 부서마다 다른 뜻으로 쓰던 용어가 드러남
- 매뉴얼: `/home/kimsanghoon/process-gpt-vue3/docs/manuals/glossary.md`, 테이블 `glossary_terms`

### B. 검증·통제

**8) 2단계 검증 (구조 검증 + 필수 Rule 체크리스트)**
검증 버튼 한 번에 두 단계가 돕니다. 1단계는 기계 검증 — 끊어진 연결, 필수 속성 누락을 즉시 잡습니다. 2단계는 필수 Rule 체크리스트 — 항목을 클릭하면 캔버스가 해당 태스크로 이동하면서 Rule 전문·RACI·참조 문서·산출 문서·수행 절차가 한 화면에 나란히 뜨고, 사람이 근거를 대조해 체크합니다.
- *가치*: **"AI 없이도 기계 검증과 사람 확인, 두 단계로 통제가 완결"** — 인증 심사 대응의 증적 구조 그 자체

**9) 프로세스 변경 관리 / 리뷰보드 — `/review-board`, `/my-inbox`**
0~4단계(초안 → 검토중 → 공개의견수렴 → 최종편집 → 게시) 승인 워크플로. 버전 그루핑, fieldChanges 기반 상세 diff, HQ/현업 이원 승인(`approveHQ`/`approveField`), 재오픈 요청, 스냅샷을 제공합니다. 내 수신함은 내 승인함·개선 요청함·내 상신함 3탭.
- *가치*: 프로세스 문서 개정이 이메일·결재 시스템을 떠돌지 않고 한 화면에서 추적됨
- 정의: `/home/kimsanghoon/process-gpt-vue3/src/utils/processStages.ts`

**10) 병합 요청함 + 병합 전 검증 — `/merge-requests`**
스킬·프로세스·의사결정(DMN) 변경안을 한 화면에서 검토·승인·병합합니다. 백미는 **병합 전 검증 탭** — 이 변경이 기존 동작을 깨뜨리는지 자동 비교해 "이 병합은 기존 동작 N개 단계를 깨뜨립니다" 배너를 병합 버튼 위에 띄웁니다.
- *가치*: 프로세스 변경에 소프트웨어 개발의 회귀 테스트 개념을 도입 — 바꿔도 안 깨진다는 확신
- 매뉴얼: `/home/kimsanghoon/process-gpt-vue3/docs/manuals/merge-requests.md`

**11) 감사 로그 (4탭 + CSV) — `/admin-console/audit-trail`**
승인 이력 / 관리자 감사 로그 / 로그인 이력 / 다운로드 이력 4탭. 기간·액션·수행자로 필터링해 탭별 CSV 내보내기가 가능하고, 행을 펼치면 변경 전후 값과 변경 사유까지 보입니다. DB 레벨에서 `admin_audit_log`가 **append-only로 강제**됩니다.
- *가치*: 내부 감사 대응 증적을 별도 준비 없이 즉시 제출
- 매뉴얼: `/home/kimsanghoon/process-gpt-vue3/docs/manuals/audit-trail.md`, 마이그레이션 `20260526_admin_audit_log_append_only.sql`

**12) 사내 정책문서 관리 — `/policy-document`**
규정·정책 문서를 등록하고 **어느 프로세스가 그 문서를 실제로 쓰고 있는지** 자동 추적합니다. `proc_def` 저장 트리거가 현재 BPMN과 To-Be BPMN에서 사용 관계를 갱신하며, 목록의 "사용 중인 프로세스"에서 해당 프로세스로 바로 이동합니다. 문서 도메인은 직접 지정 도메인 + 사용 프로세스들의 도메인을 합집합으로 표시하고, **사용 중인 문서는 삭제할 수 없습니다.**
- *가치*: "이 규정을 고치면 어떤 프로세스가 영향받나"에 즉답 — 문서 영향도 분석
- 문서: `/home/kimsanghoon/process-gpt-vue3/docs/pal-migration/03-policy-document.md`, 테이블 `audit_policy`

**13) 수정 잠금(Data Freeze) + 점검 모드 + 공지 배너 — `/admin-console/data-freeze`, `/admin-console/system-operations`**
특정 대상의 편집을 기간 단위로 동결하고, 점검 모드를 켜면 `maintenanceGate`가 전 사용자를 `PalMaintenance` 화면으로 유도합니다. 전사 공지 배너도 여기서 관리합니다. 편집은 낙관적 잠금(`acquireLockWithStaleCheck` + 하트비트)으로 한 번에 한 사람만.
- *가치*: 대규모 개편·마감 기간에 데이터 정합성을 조직 차원에서 보장
- 파일: `/home/kimsanghoon/process-gpt-vue3/src/utils/maintenanceGate.ts`, `/home/kimsanghoon/process-gpt-vue3/src/views/authentication/PalMaintenance.vue`

**14) 프로세스 구조 재구성 (3단계 Cut-over)**
조직 개편으로 체계 자체를 바꿀 때: ① 재구성 모드 Scenario Builder에서 Mega Rename·Major 이동 등을 조립하고 영향도 확인 → ② 구조변경 특별 결재 라인에서 개편안 승인 → ③ **점검 모드를 켠 상태에서 Cut-over 일괄 적용**. 반영 이력은 감사 로그에 남습니다.
- *가치*: 수십~수백 프로세스에 파급되는 개편을 무중단 사고 없이 통제된 절차로
- 매뉴얼: `/home/kimsanghoon/process-gpt-vue3/docs/manuals/process-restructure.md`

**15) 보안 설정 (테넌트 단위 5개 섹션) — `/admin-console/security-settings`**
세션 타임아웃, 로그인 잠금, MFA, 다운로드 이상 탐지, 감사 로그 보관 정책을 관리자 한 화면에서 조정하고, 모든 변경은 관리자 감사 로그에 기록됩니다. GoTrue 기반 정책 문서 4종이 별도로 정리되어 있습니다.
- 문서: `/home/kimsanghoon/process-gpt-vue3/docs/security-gotrue-{mfa,lockout,session,password}-policy.md`, `/home/kimsanghoon/process-gpt-vue3/docs/security.md`

### C. 조직·거버넌스

**16) 조직도 + 멤버십 승인 — `/organization` (최신 커밋 `3bf5a080`)**
부서 트리를 드래그로 편집하고 구성원을 배치하며, 부서장·권한까지 한 화면에서 지정합니다(자동 저장). **가입 및 권한 승인 탭**이 통합되어, 회원가입한 사용자는 관리자 승인 전까지 `SignupPending` 화면에 머무릅니다(`membershipGate`). 아직 가입 전인 신입사원을 이메일로 **사전등록**해 두면 가입 즉시 자동 배치됩니다. 사이드바 메뉴에 대기 건수 배지(`MembershipRequestBadge`)가 붙습니다.
- *가치*: 아무나 조직 데이터에 접근하지 못하는 승인 기반 온보딩 + 조직 구조가 프로세스 RACI와 연결
- 파일: `/home/kimsanghoon/process-gpt-vue3/src/views/organization/OrganizationChartView.vue`, `MembershipApprovalPanel.vue`, `/home/kimsanghoon/process-gpt-vue3/src/utils/membershipGate.ts`, 마이그레이션 `20260908000001_membership_approvals.sql`

**17) 업무분장 — `/work-assignment`**
프로세스별 담당자(오너/조직)를 지정하는 전용 화면. 사용자 검색은 Supabase `users` 폴백으로 항상 동작하고, 조직 그룹 검색은 REST 1차입니다.
- 문서: `/home/kimsanghoon/process-gpt-vue3/docs/pal-migration/09-work-assignment.md`

### D. 분석·인사이트

**18) 분석 대시보드 — `/analysis-dashboard`**
진행현황 / 프로세스분석 / 운영현황 / 입력정확도 4탭(+ `ModelOperationalBoard` 신설). PI 진행 진도율, 단계별 프로세스 수, 조직별 KPI 달성 현황, 주차별 게시 이력, **단계 역행(Churn) 현황**을 봅니다. 관리자는 탭 구성·순서를 직접 바꾸고 Grafana 보드를 연결할 수 있습니다. **차트가 순수 Vue/CSS/SVG로 구현되어 외부 차트 라이브러리 의존이 0**입니다.
- 매뉴얼: `/home/kimsanghoon/process-gpt-vue3/docs/manuals/analysis-dashboard.md`

**19) 사용 활성도 / 도입 분석 — `/admin-console/usage-adoption`**
`startUsageTracking(router)`가 PAL 모드에서만 페이지 방문·세션을 자동 수집하고, 모델 생성/편집 이벤트(`model_create`/`model_edit`)가 `putRawDefinition`·`bpmnModelService`에서 fire-and-forget으로 적재됩니다(`app_usage_events`).
- *가치*: "시스템 도입했는데 실제로 쓰나?"를 데이터로 답변 — PI 추진 성과 보고 자동화
- 파일: `/home/kimsanghoon/process-gpt-vue3/src/services/usageAnalytics.ts` (931줄)

**20) 온톨로지 익스플로러 (Process Knowledge Graph) — `/ontology-explorer`, `/ontology-explorer-new`**
BPMN 정의로부터 프로세스 지식그래프를 추출해 2D(cytoscape)·3D(3d-force-graph) 캔버스로 탐색합니다. `lib/processKg/` 33개 파일에 병목·SPOF(단일장애점)·자동화 가능성·조직 구조·재설계 등 **15종 분석 엔진**이 들어 있고, What-if 시뮬레이터와 AI 인사이트 내러티브 생성기가 붙습니다. 신 익스플로러는 **Apache AGE(Postgres 그래프 확장)** 기반 RPC 3종을 사용합니다.
- *가치*: "우리 회사 프로세스에서 한 사람이 빠지면 뭐가 멈추나"를 그래프로 답변
- 문서: `/home/kimsanghoon/process-gpt-vue3/docs/pal-migration/07-ontology-explorer.md`, `/home/kimsanghoon/process-gpt-vue3/docs/specs/graph-ontology-apache-age.md`

**21) PI Flag — `/admin-console/pi-flags`**
프로세스 혁신 과제(개선 포인트)를 태스크에 플래그로 달고, 유형별로 모아보며 관리합니다. 이슈 export 기능(`piFlagIssueExport.ts`) 포함.

**22) KPI 목표 관리 — `/admin-console/kpi-targets`**
조직별 KPI 목표를 등록하고 분석 대시보드의 달성 현황 위젯과 연동됩니다(soft delete·복원 지원).

### E. 문서 출력

**23) 프로세스 내보내기 (PNG / BPMN 2.0 / PDF 정의서)**
PNG는 빠른 공유용, `.bpmn`은 표준 BPMN 2.0 XML로 타 도구 호환·백업용. **PDF 정의서**가 하이라이트 — 표지·전체 다이어그램·프로세스 설정·Lane별 Task 전체 속성(설명·RACI·수행 절차·입출력·폼 연결·시스템·API 연동·FTE·OPEX·PPI·관리자가 추가한 사용자 정의 필드 전부)·통합 RACI 매트릭스가 한 문서로 조립됩니다.
- *가치*: **시스템에 입력하면 규정서가 자동으로 나온다** — 문서 작성 공수가 사라짐
- 매뉴얼: `/home/kimsanghoon/process-gpt-vue3/docs/manuals/process-export.md`

### F. AI 기능 (선택적 — 플래그로 ON/OFF)

**24) AI Copilot (RAG 기반 프로세스 질의)**
`PalModeBackend.qdrantChat`이 Qdrant 벡터 검색 + LangChain 백엔드에 **SSE 스트리밍**으로 질의하고, 현재 BPMN XML을 컨텍스트로 함께 전달합니다. 질의·답변은 `proc_def_copilot_log`에 사용자별로 저장되어 다시 열람할 수 있습니다.

**25) To-Be Blueprint Studio / AN Transformation Studio**
As-Is 파티셔닝 → Gap Triage → To-Be Orchestrator → Roadmap 4단계 오케스트레이션. As-Is/To-Be 비교, ROI 산정, 실행형 프로세스 생성 뷰를 제공하며 모든 데이터는 `proc_def.definition.tobe` JSON에 저장됩니다.
- 파일: `/home/kimsanghoon/process-gpt-vue3/src/composables/anStudio/useAnStudio.ts`, `/home/kimsanghoon/process-gpt-vue3/src/views/process-hierarchy/blueprint/ProcessBlueprintStudio.vue`

**26) AI 기능 마스터 플래그 (엔터프라이즈 배려)**
`VITE_FF_AI` 마스터 + `AI_COPILOT`/`AI_DESIGNER`/`AI_FORM` 세부 플래그로 AI 기능을 단계적으로 끌 수 있습니다. `VITE_FF_EXECUTION`으로 실행 기능도 분리 게이팅됩니다.
- *가치*: **보안 규제가 엄격한 고객사에 "AI 전부 끄고도 완전 동작"으로 납품 가능** — 이게 데모가 AI 없이 진행된 이유
- 근거: `/home/kimsanghoon/process-gpt-vue3/.env.example`, `/home/kimsanghoon/process-gpt-vue3/docs/feature-flag-analysis.md`

---

## 2. 기존 ProcessGPT / uEngine 대비 차별점

| 축 | 기존 ProcessGPT (기본 모드) | PAL 모드 |
|---|---|---|
| **1차 목적** | AI 에이전트가 프로세스를 **실행** (챗·딥리서치·A2A 오케스트레이션) | 전사 프로세스를 **자산으로 등록·통제·진화** |
| **진입 화면** | 채팅·할일 목록 | **프로세스 체계도** (`/process-architecture`) |
| **모델의 정체** | 실행 가능한 워크플로 | 실행 가능 + **규정 문서 원본**(RACI·절차·산출물·통제 Rule 포함) |
| **커스터마이징** | 코드 수정·재배포 | **속성 스키마 스튜디오로 무배포 메타모델 변경** |
| **재사용 단위** | 에이전트·스킬 | **Task 카탈로그**(속성 포함 표준 업무) |
| **변경 관리** | 버전 이력 | 0~4단계 승인 워크플로 + 병합 전 회귀 검증 + append-only 감사 로그 |
| **AI 의존도** | AI가 핵심 | **AI 없이 완결, 있으면 가속** (플래그로 전부 OFF 가능) |
| **사이드바** | 채팅 목록·에이전트·스킬 중심 | 프로세스 관리 / 조직관리 / 분석 / 관리자 14개 메뉴 |
| **분석** | 일반 analytics | 프로세스 KG(Apache AGE), SPOF·병목 분석, 도입 활성도, 입력 정확도 |

**PAL 게이팅 방식이 구현 차별점 자체**: 신규 라우트는 `MainRoutes.ts`의 `...(window.$pal ? [...] : [])` 스프레드 안에만 존재하고, 백엔드는 `PalModeBackend extends ProcessGPTBackend` 상속 오버라이드로 구성됩니다. 즉 **하나의 코드베이스가 두 제품을 서빙**하면서 비-PAL 모드는 바이트 단위로 영향받지 않습니다. `BackendFactory`가 `wrapBackendWithNullSkip` Proxy로 감싸 미구현 메서드도 크래시 없이 안전한 기본값을 반환합니다.

---

## 3. 기술 스택 / 아키텍처 하이라이트 (홍보용)

**프론트엔드**
- Vue 3 + TypeScript + Vite + Vuetify 3, Pinia, vue-i18n (한/영)
- `bpmn-js 17` (BPMN 2.0 표준 준수) + `bpmn-moddle`, `dmn-js 17` (의사결정 모델)
- 커스텀 BPMN 확장: PAL 전용 렌더러·팔레트, Call Activity 인라인 드릴다운, Task 교체 시 연결 보존
- 그래프 시각화: `cytoscape` 3.34(2D), `3d-force-graph` + `three` 0.185(3D), `@neo4j-nvl` 1.2(비즈니스 온톨로지)
- 문서/편집: TipTap 2, Monaco Editor, `fast-xml-parser`

**백엔드 / 데이터**
- **Supabase (PostgreSQL)** — RLS 기반 역할별 접근 제어, **멀티테넌시 격리**(모든 쿼리에 tenant 필터 + RLS 정책), GoTrue 인증(MFA·세션·잠금 정책), Storage, Realtime
- **Apache AGE** — Postgres 그래프 확장을 커스텀 도커 이미지로 빌드(`docker-compose/supabase-postgres-age/`), 온톨로지 RPC 3종
- 스키마는 `supabase/migrations/` 로 버전 관리, DB 타임존 KST 고정, `admin_audit_log` append-only 트리거 강제
- 파이썬 테스트(`supabase/tests/test_*.py`)로 마이그레이션 검증 (테넌트 격리·삭제/복원·다중 프로세스 재사용까지)

**AI / 에이전트 (ProcessGPT 스택 공유)**
- LLM 에이전트 마이크로서비스군: CrewAI Action, CrewAI/OpenAI Deep Research, LangChain ReAct, Work Assistant, **A2A(Agent-to-Agent) 오케스트레이션**, Computer-Use
- RAG: Memento 문서 RAG 서비스 + **Qdrant 벡터 검색**, SSE 스트리밍 응답
- 40+종 도메인 특화 생성기(`src/components/ai/`): BPMN 생성, 폼 디자인, DMN, 조건 룰, Cron, 조직도, 프로세스 컨설팅 등

**엔지니어링 성숙도 (신뢰감 소재)**
- Playwright E2E(스모크·게이트웨이·BPMN 오토레이아웃·정책문서), `vue-tsc` 타입체크 CI 게이트, semgrep/SAST 룰
- 성능 튜닝 실적: 조회 안티패턴 제거로 **운영 첫 화면 최대 지연 11.7초 → 1.4초** (커밋 `b3929976`)
- Docker Compose 원커맨드 전체 스택 기동, Kubernetes 매니페스트 제공

---

## 4. 태그라인 / 키워드 후보

### 메인 태그라인 (강도순)
1. **"프로세스 규정서를, 살아있는 데이터로."**
2. **"문서로 잠자던 프로세스 지도가, 시스템 내비게이션이 됩니다."** (내레이션 part1 직접 인용)
3. **"AI 없이도 완결됩니다. 켜면 더 빨라질 뿐입니다."** (PAL 포지셔닝의 정수)
4. **"두 번째 프로세스부터는, 그리기가 아니라 조립입니다."** (Task 카탈로그)
5. **"고객사마다 다른 양식을, 코드 수정 없이 흡수합니다."** (속성 스키마 스튜디오)

### 서브 카피
- "그림이 아닙니다. 실행 조건을 가진 모델입니다."
- "RACI 표도, 절차서도, 산출물 목록도 — 전부 분석·실행·감사 가능한 속성 데이터"
- "기계가 잡는 구조 검증 + 사람이 확인하는 필수 Rule — 2단계로 완결되는 통제"
- "입력하면, 규정서가 나옵니다." (PDF 정의서 자동 생성)
- "이 병합은 기존 동작 3개 단계를 깨뜨립니다 — 병합 전에 알려드립니다."
- "ISO 내부심사가 요구하는 문서 통제와 정합합니다."
- "배포 없는 커스터마이징. 관리 화면이 곧 메타모델입니다."

### 키워드 (SEO / 태그)
`프로세스 자산 관리` · `Process Asset Governance` · `BPM` · `BPMN 2.0` · `프로세스 혁신(PI)` · `프로세스 체계도` · `RACI 매트릭스` · `Task 카탈로그` · `속성 스키마 스튜디오` · `프로세스 지식그래프` · `온톨로지` · `Apache AGE` · `ISO 내부심사` · `문서 통제` · `감사 로그` · `승인 워크플로` · `병합 전 검증` · `멀티테넌시` · `Supabase` · `LLM 에이전트` · `RAG` · `Copilot` · `To-Be Blueprint` · `업무분장` · `용어 사전` · `PDF 정의서 자동 생성`

### 홍보 페이지 구성 제안 (데모 6파트를 그대로 스토리라인으로)
`docs/demo-p543-pal/`의 20분 데모가 이미 **완성된 6단계 내러티브 + 영상(webm/mp4) + 나레이션 음성(mp3)** 으로 존재합니다. 홍보 페이지 섹션을 그대로 여기에 맞추고, 각 섹션에 `preview/partN.mp4`를 임베드하면 즉시 쓸 수 있는 자산이 됩니다:

① 프로세스 지도 → ② 실행 조건을 가진 순서도 → ③ Task 카탈로그 → ④ 속성 데이터화(RACI·절차) → ⑤ 속성 스키마 스튜디오 → ⑥ 2단계 검증 → ⑦ 6가지 차별점 요약

또한 `docs/manuals/` 14종에 **실제 화면 스크린샷 PNG**가 전부 준비되어 있어(`docs/manuals/images/`) 홍보 페이지 이미지 소스로 바로 활용 가능합니다.

---

## 5. 참고한 주요 파일 (절대 경로)

**핵심 (필독)**
- `/home/kimsanghoon/process-gpt-vue3/docs/demo-p543-pal/scenario.md` — 20분 발표 대본, 홍보 카피의 원천
- `/home/kimsanghoon/process-gpt-vue3/docs/demo-p543-pal/narration/part1~7.txt` — 완성된 홍보 내러티브
- `/home/kimsanghoon/process-gpt-vue3/docs/demo-p543-internal-audit-scenario.md` — 기술서↔BPMN 커버리지 검증표
- `/home/kimsanghoon/process-gpt-vue3/docs/pal-migration/README.md` + `01`~`10` — PAL 기능 전수 목록과 설계 결정
- `/home/kimsanghoon/process-gpt-vue3/specs/007-manual-refresh/feature-gap.md` — PAL 기능 ↔ 라우트 ↔ 권한 매핑표

**코드**
- `/home/kimsanghoon/process-gpt-vue3/src/palMode.ts` — PAL 모드 활성화 (`window.$pal`)
- `/home/kimsanghoon/process-gpt-vue3/src/components/api/PalModeBackend.ts` (1,284줄, 78개 메서드)
- `/home/kimsanghoon/process-gpt-vue3/src/utils/routePermissions.ts` — `MENU_DEFINITIONS` 전체 메뉴·권한
- `/home/kimsanghoon/process-gpt-vue3/src/layouts/full/vertical-sidebar/VerticalSidebar.vue` — PAL 사이드바 4개 섹션
- `/home/kimsanghoon/process-gpt-vue3/src/router/MainRoutes.ts` — PAL 게이트 라우트 블록

**매뉴얼 (스크린샷 포함)**
- `/home/kimsanghoon/process-gpt-vue3/docs/manuals/` — 14종 (task-catalog, glossary, raci-task-settings, process-export, merge-requests, audit-trail, analysis-dashboard, organization-chart, signup-approvals, option-lists, security-settings, process-restructure, notifications-inbox)
- `/home/kimsanghoon/process-gpt-vue3/docs/widget-composer-design.md` — 속성 스키마 스튜디오 차기 로드맵</result>
<usage><subagent_tokens>123593</subagent_tokens><tool_uses>30</tool_uses><duration_ms>282751</duration_ms></usage>
</task-notification>
```

## Prompt — 2026-09-18T02:27:46+00:00

```text
영상 기존 것 짜집기가 아닌, 새로 만들어야함. 꼭 프로세스를 그리는 걸 보여주는게 아니라 프로세스 자산화에 대한 필요성, 가치 등을 우리 제품과 함께 설명하는 영상이 됐으면 좋겠음. 그리고 기존에 있던 프로세스는 타 업체에서 사용하던 프로세스이므로 다른 프로세스를 그려서 보여주는게 맞음.  PAL은 Process Asset Library의 약어임.
```

## Prompt — 2026-09-18T02:27:51+00:00

```text
영상 기존 것 짜집기가 아닌, 새로 만들어야함. 꼭 프로세스를 그리는 걸 보여주는게 아니라 프로세스 자산화에 대한 필요성, 가치 등을 우리 제품의 강점과 함께 설명하는 영상이 됐으면 좋겠음. 그리고 기존에 있던 프로세스는 타 업체에서 사용하던 프로세스이므로 다른 프로세스를 그려서 보여주는게 맞음.  PAL은 Process Asset Library의 약어임.
```

## Prompt — 2026-09-18T04:34:52+00:00

```text
로컬에서 실행된 곳에서(외부 http://34.22.71.73:8088/) 촬영하면됨. 후속 작업 시작.
```

## Prompt — 2026-09-18T05:58:17+00:00

```text
UENGINE -> uEngine으로 대소문자 정확히 구분해야하고, @"uEngine_logo (1).png" 이건 회사 로고임.
```

## Prompt — 2026-09-18T05:59:03+00:00

```text
UENGINE -> uEngine으로 대소문자 정확히 구분해야하고, @"uEngine_logo (1).png" 이건 회사 로고임. 나레이션은 좀 더 자연스러운 보이스로.
```

## Prompt — 2026-09-18T06:44:13+00:00

```text
<task-notification>
<task-type>artifact-auto-react</task-type>
<summary>Auto-replied to comment thread on Artifact: "ProcessGPT PAL"</summary>
Auto-replied to thread 4d563752-065a-42db-8211-e83439e3462a on artifact https://claude.ai/code/artifact/f2098bc2-8a25-4009-9fa4-c603f8a433c1 — an acknowledgement only. If the thread asks for a change to the artifact, read the thread and make the change yourself if appropriate. The auto-posted reply (comment 1a3eabad-1432-4355-b8f1-7c922bdc074a) is already in the thread — do NOT post another; the commenter can see it. Once you have finished acting on the thread, resolve it (Artifact tool, action "resolve"); leave it open only if the conversation is still active or the commenter still needs an answer beyond the posted reply.
</task-notification>
```

## Prompt — 2026-09-18T06:45:47+00:00

```text
<task-notification>
<task-type>artifact-auto-react</task-type>
<summary>Auto-replied to comment thread on Artifact: "ProcessGPT PAL"</summary>
Auto-replied to thread 4d563752-065a-42db-8211-e83439e3462a on artifact https://claude.ai/code/artifact/f2098bc2-8a25-4009-9fa4-c603f8a433c1 — an acknowledgement only. If the thread asks for a change to the artifact, read the thread and make the change yourself if appropriate. The auto-posted reply (comment c3dd5abf-48fd-4127-9817-6f11f05516a4) is already in the thread — do NOT post another; the commenter can see it. Once you have finished acting on the thread, resolve it (Artifact tool, action "resolve"); leave it open only if the conversation is still active or the commenter still needs an answer beyond the posted reply.
</task-notification>
```

## Prompt — 2026-09-18T06:57:12+00:00

```text
<task-notification>
<task-type>artifact-auto-react</task-type>
<summary>Auto-replied to comment thread on Artifact: "ProcessGPT PAL"</summary>
Auto-replied to thread e3b30cc0-6337-4490-a9fa-119e217d211b on artifact https://claude.ai/code/artifact/f2098bc2-8a25-4009-9fa4-c603f8a433c1 — an acknowledgement only. If the thread asks for a change to the artifact, read the thread and make the change yourself if appropriate. The auto-posted reply (comment 974fa86b-e883-4485-904d-70780313d40b) is already in the thread — do NOT post another; the commenter can see it. Once you have finished acting on the thread, resolve it (Artifact tool, action "resolve"); leave it open only if the conversation is still active or the commenter still needs an answer beyond the posted reply.
</task-notification>
```

## Prompt — 2026-09-18T06:58:46+00:00

```text
<task-notification>
<task-type>artifact-changed</task-type>
<summary>Artifact changed: "ProcessGPT PAL"</summary>
Artifact https://claude.ai/code/artifact/f2098bc2-8a25-4009-9fa4-c603f8a433c1 appears to have been republished by another session — it is now version 1789714661-880d. Your copy is stale; re-read before editing or republishing (WebFetch the url).
</task-notification>
```

## Prompt — 2026-09-18T07:01:51+00:00

```text
@~/Downloads/유엔진솔루션즈_uEngine PAL 제안_TYM_v2.pptx The Problem부분을 pptx 5페이지 참고해서 수정하고, 6페이지부분도 넣고싶은데 이랑 why pal부분에 대체될 만한 곳이 있으면 넣거나 도입효과로 따로 넣거나 흐름에 맞게 넣어봐.
```

## Prompt — 2026-09-18T07:32:19+00:00

```text
@"docs/유엔진솔루션즈_uEngine PAL 제안_TYM_v2.pptx"
```

## Prompt — 2026-09-18T07:41:00+00:00

```text
해당 artifact 파일은 어디에 있지?
```

## Prompt — 2026-09-18T07:55:05+00:00

```text
pi-flag 관련 부분도 기능을 강조하고싶음.
```

## Prompt — 2026-09-18T08:11:12+00:00

```text
이어서 PI Flag 강조 섹션 진행해줘
```

## Prompt — 2026-09-18T08:35:14+00:00

```text
이번 세션 이전 프롬프트도 모두 추가해줘.
```

## Prompt — 2026-09-18T08:56:55+00:00

```text
# 중요한점
1. 제품소개서 페이지 - ProcessGPT -> uEngine PAL로 명칭 모두 변경. (영상도 변경필요하면 변경)
2. 이미지에서 너무 비어서 나오는 부분 수정(프로세스 체계도가 실사용 데이터로 많이 보였으면 좋겠음)
```

## Prompt — 2026-09-18T08:57:59+00:00

```text
# 중요한점
1. 제품소개서 페이지 - ProcessGPT -> uEngine PAL로 명칭 모두 변경. (영상도 변경필요하면 변경)
2. 이미지에서 너무 비어서 나오는 부분 수정(프로세스 체계도가 실사용 데이터로 많이 보였으면 좋겠음)
3. 대시보드도 데이터가 가득 찬 상태로 캡쳐됐으면 좋겠음.
4. 용어사전도 두 개밖에 안보이는데 더 많이 등록해서 보여질 수 있도록 
5. PI Flag도 4번과 마찬가지.
```

## Prompt — 2026-09-21T00:46:18+00:00

```text
체계도, Task Catalog 이미지 여전히 마음에 안듬. 체계도 이미지는 manufacturing처럼 가로로도 많이 있어야함.
```

## Prompt — 2026-09-21T00:51:08+00:00

```text
speckit-run skill을 다른사람에게 공유할 때 뭐뭐 전달해줘야함?
```

## Prompt — 2026-09-21T00:55:49+00:00

```text
UserPromptSubmit hook error
Failed with non-blocking status code: /bin/sh: /Users/kimsanghoon/IdeaProjects/playground-pi-system-web/.claude/skills/speckit-run/driver.sh: Permission denied
```

## Prompt — 2026-09-21T01:30:13+00:00

```text
프로세스 체계도 SubProcess가 한개씩만 보이는데, 여러개 두는게 좋을 것 같음.
```

## Prompt — 2026-09-28T02:33:27+00:00

```text
/speckit-run > 의도 (why & value)
현재 추가되어있는 기능들 중, 메뉴얼 기반으로 사용자화가 부족 한 부분(도메인 수정/삭제, 미분류 도메인, 메뉴 목록 설정 등)을 찾아 수정하여 각 테넌트의 관리자가 uEngine PAL을 자신의 업무 환경에 맞춰 사용 할 수 있도록 한다.

> 인수조건 (Definition of Done)
- 변경(추가) 된 기능 목록 (최소 위 3가지 포함)
- 해당 기능에 대한 사용자 가이드

> 컨텍스트 (참고자료 위치)
- @docs/PI_System_통합_사용자_매뉴얼.docx
```
