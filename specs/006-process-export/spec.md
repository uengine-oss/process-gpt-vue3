# Feature Specification: 프로세스 순서도 내보내기 강화 (이미지·BPMN·PDF)

**Feature Branch**: `006-process-export`

**Created**: 2026-09-16

**Status**: Draft

**Input**: User description: "현재는 이미지로만 내보낼 수 있는데, 내보내기 기능을 강화하여 BPMN 파일 또는 PDF 파일로 내보낸다. 이미지: 현행대로. BPMN: XML로(가져오기 가능하도록). PDF: 전체 프로세스 이미지 → 프로세스 설정 → 각 Lane/Task 설정 → 통합 RACI 등 유저가 입력·설정한 데이터를 정리하여 내보낸다."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 내보내기 메뉴 통합 및 BPMN(XML) 내보내기 (Priority: P1)

PAL 모드의 프로세스 순서도 화면(`/process-hierarchy` 디자이너 탭)에서 사용자는 툴바의 "내보내기" 메뉴를 열어 **이미지(PNG) / BPMN(XML) / PDF** 중 하나를 선택한다. BPMN을 선택하면 현재 캔버스의 다이어그램이 표준 BPMN 2.0 XML(`.bpmn`) 파일로 다운로드되고, 이 파일은 같은 화면의 기존 "가져오기" 버튼으로 다시 불러올 수 있다.

**Why this priority**: BPMN 내보내기는 이미 존재하는 `saveXML` 경로에 다운로드만 붙이면 되는 최소 비용·최대 확실성 기능이며, 내보내기 메뉴 UI는 나머지 스토리의 진입점이다.

**Independent Test**: 프로세스를 열고 내보내기 → BPMN 선택 → `<프로세스명>.bpmn` 다운로드 확인 → 가져오기 버튼으로 같은 파일 업로드 시 다이어그램이 동일하게 복원되는지 확인.

**Acceptance Scenarios**:

1. **Given** PAL 모드에서 프로세스가 로드된 디자이너 화면, **When** 내보내기 메뉴에서 "BPMN(XML)" 선택, **Then** `<프로세스명>.bpmn` 파일이 다운로드되며 내용은 `bpmn:definitions` 루트의 유효한 XML이다(uengine 확장 속성 포함).
2. **Given** 방금 내보낸 `.bpmn` 파일, **When** 같은 화면의 "가져오기"로 업로드, **Then** 오류 없이 다이어그램이 복원된다.
3. **Given** PAL 모드에서 내보내기 메뉴, **When** "이미지(PNG)" 선택, **Then** 기존 `capturePng`와 동일하게 PNG가 다운로드된다(현행 유지).
4. **Given** 비 PAL 모드, **When** 같은 디자이너 화면 진입, **Then** 기존 단일 "이미지" 버튼이 그대로 보이고 새 메뉴/기능은 노출되지 않는다.

---

### User Story 2 - 프로세스 문서 PDF 내보내기 (Priority: P2)

사용자가 내보내기 메뉴에서 "PDF"를 선택하면 미리보기 다이얼로그가 열리고, 문서는 다음 순서로 구성된다:

1. **표지/전체 프로세스 다이어그램**: 프로세스명 + 전체 순서도 이미지(기존 BPMNPDFPreviewer의 페이지 분할 방식).
2. **프로세스 설정**: 프로세스명, 설명, 담당자(owner), 시스템 목록, 매뉴얼 링크 등 프로세스 수준에서 사용자가 입력한 설정.
3. **Lane/Task 설정**: 각 Lane(이름, 설명, 배정 정보) 아래에 소속 Task들을 순서대로 — Task명, 설명, RACI, 업무 수행 절차(Task IO), 매뉴얼 링크, 시스템, OPEX 등 사용자가 입력한 값이 있는 항목만.
4. **통합 RACI 매트릭스**: RaciMatrixDialog와 동일한 행(Task)×열(조직) 표.

"PDF 저장" 버튼으로 A4 다중 페이지 PDF(`<프로세스명>.pdf`)가 생성·다운로드된다.

**Why this priority**: 이 기능의 핵심 가치이지만 데이터 수집·레이아웃 작업량이 가장 크므로 BPMN/메뉴(P1) 이후 진행.

**Independent Test**: 설정 데이터(RACI, 절차, 설명 등)가 입력된 프로세스에서 PDF 내보내기 → 다운로드된 PDF에 4개 섹션이 순서대로 존재하고 입력한 값이 표시되는지 확인.

**Acceptance Scenarios**:

1. **Given** Lane 2개·Task 4개에 RACI/절차/설명이 입력된 프로세스, **When** PDF 내보내기 실행, **Then** PDF에 다이어그램 → 프로세스 설정 → Lane별 Task 설정 → 통합 RACI 순으로 모든 입력값이 나타난다.
2. **Given** 값이 비어 있는 속성(예: OPEX 미입력), **When** PDF 생성, **Then** 해당 항목은 표시가 생략되거나 "-"로 표기되어 빈 섹션이 장황하게 나오지 않는다.
3. **Given** 관리자가 Task Catalog 가시성 설정으로 숨긴 내장 속성, **When** PDF 생성, **Then** 숨겨진 속성은 PDF에도 나오지 않는다.
4. **Given** 세로 방향(Participant vertical) 다이어그램, **When** PDF 생성, **Then** 다이어그램 페이지가 세로 판형으로 잘리지 않고 렌더된다(기존 방향 판정 로직 유지).

---

### Edge Cases

- 프로세스명이 비어 있으면 내보내기 메뉴는 기존 이미지 버튼과 동일하게 비활성화된다(`!processNameText`).
- Lane이 없는(Pool만 있거나 평면) 다이어그램: Task들은 "(Lane 없음)" 그룹으로 묶어 출력한다.
- RACI가 어떤 Task에도 입력되지 않은 경우: 통합 RACI 섹션은 "입력된 RACI가 없습니다" 안내 문구로 대체한다.
- 다이어그램이 매우 큰 경우: 기존 BPMNPDFPreviewer의 1920×1200 crop 그리드 분할 방식을 그대로 사용해 여러 페이지로 나눈다.
- PDF 생성 중 오류(이미지 캡처 실패 등): 진행률 표시를 멈추고 스낵바/알림으로 실패를 알리며 다이얼로그는 닫히지 않는다.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: PAL 모드의 `ProcessHierarchyDesigner` 툴바에서 기존 "이미지" 버튼을 "내보내기" 드롭다운 메뉴(이미지 PNG / BPMN XML / PDF)로 대체한다. 비 PAL 모드에서는 기존 단일 이미지 버튼을 유지한다.
- **FR-002**: BPMN 내보내기는 `saveXML({format:true, preamble:true})` 결과를 `<프로세스명>.bpmn`으로 다운로드하며, 기존 가져오기(`validateBpmnXml` → `applyXmlToCanvas`)로 재가져오기가 가능해야 한다.
- **FR-003**: 이미지 내보내기는 기존 `useBpmnExport.capturePng` 동작을 변경 없이 그대로 사용한다.
- **FR-004**: PDF 내보내기는 미리보기 다이얼로그를 통해 (a) 전체 다이어그램 이미지, (b) 프로세스 설정, (c) Lane별 Task 설정, (d) 통합 RACI 표 순서의 A4 PDF를 생성한다.
- **FR-005**: Lane/Task 데이터는 모델러의 `elementRegistry` + `readUengineProperties`로 수집하고, Lane 소속은 `flowNodeRef` 기준, Task 순서는 RaciMatrixDialog와 동일한 정렬(taskCode → 좌표순)을 따른다.
- **FR-006**: 내장 속성 노출은 `useTaskCatalogStore().isBuiltinPropVisible(taskType, key)` 가시성 규칙을 따른다.
- **FR-007**: PDF 생성은 기존 의존성(jspdf, html-to-image)만 사용하고 새 패키지를 추가하지 않는다.
- **FR-008**: 값이 비어 있는 속성은 출력에서 생략한다.

### Key Entities

- **ProcessExportData**: PDF용 수집 데이터 — 프로세스 설정(제목·설명·담당자·시스템·링크), Lane 목록(이름·설명·배정), Lane별 Task 목록(이름·설명·RACI·절차·기타 uengine 속성), 통합 RACI(행=Task, 열=조직).
- **uengine:Properties**: BPMN XML 확장 요소에 JSON으로 저장된 사용자 입력 값(기존 구조, 변경 없음).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 내보낸 `.bpmn` 파일을 가져오기로 업로드하면 오류 없이 동일 다이어그램이 복원된다.
- **SC-002**: RACI·절차·설명이 입력된 프로세스의 PDF에 해당 값이 100% 누락 없이 표시된다.
- **SC-003**: 비 PAL 모드 화면의 DOM/동작에 변화가 없다.
- **SC-004**: 새 npm 의존성 추가 0건.

## Assumptions

- 대상 화면은 PAL 순서도 화면(`src/views/process-hierarchy/ProcessHierarchyDesigner.vue`)이며, 비 PAL 정의 화면(ProcessDefinitionChat 계열)의 기존 PDF 버튼은 이번 범위에서 변경하지 않는다.
- 프로세스 설정 값은 디자이너에 전달되는 `processDefinition`과 프로세스 요소의 uengine 속성에서 읽을 수 있는 범위만 출력한다(서버 재조회 없음).
- PDF 레이아웃은 화면 미리보기 DOM을 `html-to-image`로 캡처해 jsPDF에 삽입하는 방식(기존 BPMNPDFPreviewer 패턴)을 사용한다.
- To-Be 블루프린트 모드가 활성인 경우에도 현재 캔버스에 로드된 다이어그램을 그대로 내보낸다.
