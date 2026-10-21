# Feature Specification: 통합 사용자 매뉴얼 전면 업데이트 (신규 기능 매뉴얼 + docx 반영)

**Feature Branch**: `007-manual-refresh`

**Created**: 2026-09-17

**Status**: Draft

**Input**: User description: "docs/PI_System_통합_사용자_매뉴얼.docx는 이전에 작성한
매뉴얼인데 최근 추가된 기능이 많아 전체적으로 업데이트하려 함. docs/manuals/ 이외에
더 추가된 기능들 목록(RACI, 조직도 등)을 먼저 정리하고, 각각 스크린샷을 포함한
매뉴얼을 markdown으로 작성해서 docx에도 업데이트. 스크린샷은 항상 좌측 사이드바
메뉴를 닫고 촬영."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 신규 기능 매뉴얼 격차 목록 정리 (Priority: P1)

매뉴얼 관리자는 현재 docx(23개 장)와 docs/manuals/(4개 md)가 다루지 않는
신규 기능이 무엇인지 목록으로 확인하고 싶다.

**Why this priority**: 어떤 매뉴얼을 새로 써야 하는지가 이후 모든 작업의 입력이 된다.

**Independent Test**: 격차 목록 문서가 스펙 디렉터리에 존재하고, 각 항목에
라우트·화면 근거가 있다.

**Acceptance Scenarios**:

1. **Given** 기존 docx 목차와 docs/manuals/ 목록, **When** 현재 라우트/화면과 대조,
   **Then** 문서화되지 않은 사용자 노출 기능 목록이 산출된다 (RACI, 조직도 포함).

---

### User Story 2 - 신규 기능별 markdown 매뉴얼 작성 (Priority: P1)

신규 유저가 각 신규 기능을 순서대로 따라 할 수 있는 시나리오 기반 매뉴얼을
docs/manuals/<slug>.md로 작성하고, 핵심 단계마다 스크린샷을 넣는다.

**Why this priority**: 사용자 요청의 핵심 산출물.

**Independent Test**: 각 md가 write-feature-manual 규약(시나리오 개요·사전 조건·
단계별 따라 하기·확인 포인트)을 갖추고, 이미지가 실제 화면 캡처다.

**Acceptance Scenarios**:

1. **Given** 격차 목록의 각 기능, **When** 매뉴얼 작성 완료,
   **Then** docs/manuals/<slug>.md + images/<slug>/*.png가 존재한다.
2. **Given** 모든 스크린샷, **When** 캡처 수행, **Then** 좌측 사이드바 메뉴가
   닫힌 상태로 촬영되어 본문 영역이 넓게 보인다.

---

### User Story 3 - docx 통합 매뉴얼 업데이트 (Priority: P2)

기존 docx에 신규 기능 장(章)들을 추가해 통합 매뉴얼을 최신화한다.
docs/manuals/의 기존 4개 매뉴얼(용어 사전, 가입·권한 승인, 프로세스 내보내기,
Task 카탈로그)도 docx에 장으로 반영한다.

**Why this priority**: markdown 원본이 완성된 뒤에야 수행 가능.

**Independent Test**: 업데이트된 docx를 열면 신규 장들이 목차와 본문(스크린샷 포함)에
나타나고 기존 23개 장은 보존된다.

**Acceptance Scenarios**:

1. **Given** 완성된 md 매뉴얼들, **When** docx 갱신 스크립트 실행,
   **Then** docx에 신규 장 + 이미지가 삽입되고 기존 내용은 유지된다.

### Edge Cases

- 기능이 관리자 전용(권한 게이트)이라 일반 계정으로 화면이 안 보이는 경우 →
  캡처 계정(manual-shots, admin)으로 촬영하고 사전 조건에 권한을 명시한다.
- 라우트는 있으나 feature flag로 숨겨진 화면(dev 전용) → 매뉴얼 대상에서 제외한다.
- 데이터가 비어 화면이 허전한 경우 → 로컬 DB(tym 테넌트)에 시연용 데이터를 시드한 뒤 촬영한다.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 격차 목록 문서(specs/007-manual-refresh/feature-gap.md)를 작성한다.
  각 항목: 기능명, 라우트, 화면 컴포넌트, 기존 문서화 여부.
- **FR-002**: 격차 목록의 각 사용자 노출 기능에 대해 docs/manuals/<slug>.md 매뉴얼을
  작성한다 (최소: RACI 설정, 조직도 포함).
- **FR-003**: 모든 스크린샷은 shoot.mjs로 캡처하며 **좌측 사이드바를 닫은 상태**로
  촬영한다. shoot.mjs에 사이드바 자동 닫기 지원을 추가한다(기본 동작).
- **FR-004**: docx에 신규 장을 추가한다 — 신규 작성 매뉴얼 + 기존 docs/manuals 4종.
  기존 장·이미지·스타일은 보존한다.
- **FR-005**: docx 갱신은 재실행 가능한 스크립트로 수행한다(md → docx 장 변환).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 격차 목록에 RACI·조직도가 포함되고 각 항목에 근거 라우트가 있다.
- **SC-002**: 신규 매뉴얼 md 각각에 스크린샷이 3장 이상 포함되며 모두 사이드바가
  닫힌 화면이다.
- **SC-003**: 갱신된 docx의 목차에 신규 장들이 나타나고, 기존 23개 장이 유지된다.

## Assumptions

- 로컬 환경(http://localhost:8088, tym 테넌트, manual-shots 계정)에서 캡처한다.
- PAL 모드 화면 기준으로 작성한다 (이 레포의 운영 모드).
- dev 전용/feature flag OFF 화면, 백엔드 전용 기능은 이번 매뉴얼 대상에서 제외.
- docx 갱신은 python-docx(스크래치 venv)로 수행한다.
