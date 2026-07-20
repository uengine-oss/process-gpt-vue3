# bpmn-artifact-display Specification

## Purpose
TBD - created by archiving change wa-process-artifact-restore. Update Purpose after archive.
## Requirements

### Requirement: One artifact tab per generated process
The artifact sidebar MUST represent one generated process as one file tab. Files
written below the chat-room root (the `default` group) and files written below
the room's sole `process-*` directory SHALL be merged into the same logical
process tab. A late `process-definition.json` name resolution MUST update that
tab; it MUST NOT leave a second `산출물 파일` tab behind.

Logical duplicates (for example `skills/x/SKILL.md` emitted once at the room
root and once below `process-*/`) MUST appear once, with the process-scoped copy
taking precedence.

#### Scenario: Root artifacts arrive before the sole process directory
- **GIVEN** a DeepAgent chat has emitted room-root skill files into a `default` artifact group
- **WHEN** the same generation emits `process-*/process-definition.json` and process-scoped files
- **THEN** the UI MUST move the root artifacts into the sole process group
- **AND** exactly one file tab MUST remain for that process
- **AND** logically duplicate file rows MUST be shown once

#### Scenario: Root artifacts arrive after the sole process directory
- **GIVEN** a DeepAgent chat already has exactly one `process-*` artifact group
- **WHEN** a room-root artifact is emitted later
- **THEN** the artifact MUST be added to the existing process tab
- **AND** a separate `산출물 파일` tab MUST NOT be created

### Requirement: Generated artifacts use format-appropriate previews
The file panel MUST preview BPMN, Markdown, HTML, JSON, form, and supported text
artifacts with the matching viewer. Refreshing or reopening the chat MUST
restore the same logical artifact set and previews. Internal control files whose
names begin with `.` MUST NOT be presented as user deliverables.

#### Scenario: Reopen a generated process artifact set
- **GIVEN** a generated process contains BPMN, Markdown, HTML, JSON, form, and skill artifacts
- **WHEN** the user selects each artifact before and after reopening the room
- **THEN** each supported format MUST render through its appropriate preview
- **AND** the BPMN artifact MUST remain available
- **AND** internal dot-prefixed control files MUST remain hidden
### Requirement: 저장된 프로세스 산출물의 참조 기반 복원
프론트는 `__contract` 가 없어도 저장된 프로세스 참조(`process_id`/`id`)를 가진 산출물을 복원 가능으로 판정해 `type: 'process'` 패널을 복원 MUST.
저장 프로세스 참조(`savedProcesses[0].process_id` 또는 `.id`)를 가지면 그 결과를
복원 가능(restorable)으로 판정하고 우측 ArtifactPanel 에 `type: 'process'`
패널을 복원해야 한다. 복원된 패널은 프로세스가 이미 저장되었음을 '저장됨' 으로
표시 SHOULD.

프론트는 work-assistant 완료 메시지의 영속 스키마(`savedProcesses` 원소가
`{ id, name, bpmn_xml, neo4j_proc_id }`)와 라이브 매핑 스키마(`{ process_id,
process_name, bpmn_xml }`)를 모두 인식 MUST.

#### Scenario: __contract 없는 저장참조 결과가 복원 가능으로 판정
- **GIVEN** 영속된 assistant 메시지의 `pdf2bpmnResult` 가 `__contract` 없이
  `savedProcesses: [{ id: <proc_def_id>, name: <프로세스명>, bpmn_xml: null }]`
  형태를 가진다
- **WHEN** 프론트가 그 결과의 복원 가능성을 판정한다
  (`isRestorableProcessResult`)
- **THEN** 결과는 복원 가능(`true`)으로 판정되어야 한다
- **AND** 복원 디스크립터(`buildProcessPanelFromMessage`)는
  `type: 'process'`, 저장된 프로세스명 라벨, `data.result` 를 담아 반환되어야 한다

#### Scenario: 저장참조 결과에서 process_id/이름 추출
- **GIVEN** 위와 같은 영속 스키마(`savedProcesses[0]` 가 `id`/`name` 키 사용)
- **WHEN** `processIdFromResult`/`processNameFromResult` 를 호출한다
- **THEN** `processIdFromResult` 는 `savedProcesses[0].id` 를 반환해야 한다
  (`process_id` 가 없어도 `id` 로 폴백)
- **AND** `processNameFromResult` 는 `savedProcesses[0].name` 을 반환해야 한다

#### Scenario: 채팅방 재진입 시 저장된 프로세스 패널 복원 (LIVE)
- **GIVEN** work-assistant 모드로 프로세스를 생성해 "생성 완료" 메시지가 영속된
  채팅방에 로그인한 사용자
- **WHEN** 사용자가 그 채팅방을 새로고침/재진입한다
- **THEN** 우측 ArtifactPanel 에 프로세스 산출물 패널이 자동 복원되어야 한다
  (빈 화면이 아니어야 한다)
- **AND** 패널의 미리보기를 열면 저장된 정의로부터 BPMN 다이어그램이 렌더되어야
  한다

### Requirement: 저장된 프로세스 미리보기의 process_id 경유
복원된 프로세스 패널의 미리보기 payload 는 `process_id` 를 포함해야 한다(MUST).
그래야 저장된(`__saved`) 프로세스의 미리보기가 `process_id` 로 정의를 조회해
BPMN XML 을 그때 생성·렌더할 수 있다. `bpmn_xml` 이 영속본에서 null 인 것은
정상이며(열 때 생성), 이 동작을 바꾸지 않는다(MUST NOT).

#### Scenario: previewPayload 에 process_id 포함
- **GIVEN** 저장참조 결과(`savedProcesses[0]` 에 `id`/`process_id`)로 렌더된
  `ProcessArtifactViewer`
- **WHEN** 미리보기 payload(`previewPayload`)를 계산한다
- **THEN** payload 는 `process_id`(= 저장된 proc_def id)를 포함해야 한다
- **AND** 저장본이면 `__unsaved` 가 false 여서 미리보기가 `process_id` 조회
  경로를 타야 한다
