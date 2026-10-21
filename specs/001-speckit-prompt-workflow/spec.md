# Feature Specification: Speckit 프롬프트 → 스펙 워크플로우 (speckit-run)

**Feature Branch**: `001-speckit-prompt-workflow`
**Created**: 2026-09-16
**Status**: Implemented
**Input**: 사용자 프롬프트 원문은 [prompt-history.md](./prompt-history.md) 참조

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 프롬프트로 스펙 정의 및 작업 실행 (Priority: P1)

사용자가 작업 프롬프트를 입력하면, 에이전트가 Spec Kit 규약(`specs/NNN-slug/`)에 따라
스펙을 생성·정의하고 그 스펙 하에서 실제 작업을 실행한다.

**검증**: `.claude/skills/speckit-run/driver.sh new --prompt-file - < 프롬프트` 실행 시
`specs/NNN-slug/spec.md`(spec-kit 템플릿 기반)와 `prompt-history.md`(첫 프롬프트 수록)가 생성되고,
`.specify/feature.json`이 해당 스펙을 활성 피처로 가리킨다.

### User Story 2 - 프롬프트 전량 작업이력 수집 (Priority: P1)

사용자가 입력한 프롬프트는 예외 없이 활성 스펙의 `prompt-history.md`에 타임스탬프와 함께
원문 그대로(verbatim) 누적된다.

**검증**:
- 수동 경로: `driver.sh log "<프롬프트>"` 실행 후 history에 `## Prompt — <ISO시각>` 항목 추가 확인.
- 자동 경로: `.claude/settings.json`의 `UserPromptSubmit` 훅이 매 프롬프트를 `driver.sh hook`으로
  전달하여 활성 스펙에 자동 append. 활성 스펙이 없으면 조용히 무시(exit 0).

### User Story 3 - 작업 결과 기록 (Priority: P2)

에이전트는 작업 완료 시 `driver.sh note "<요약>"`으로 결과를 같은 이력 파일에 남긴다.

### Edge Cases

- 활성 스펙이 없을 때 `log`/`note` → 명시적 에러(`--feature`로 지정 가능); `hook`은 무해하게 종료.
- 멀티라인·따옴표 포함 프롬프트 → `--prompt-file -`(stdin) 경로로 원문 보존.
- `feature.json`이 레포 상대 경로를 저장 → 드라이버가 REPO_ROOT 기준으로 정규화(레포 밖 cwd에서도 동작).
- 훅 stdout은 모델 컨텍스트에 주입되므로 hook 모드는 stdout을 내지 않는다.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 프롬프트 1건으로 spec-kit `create-new-feature.sh`를 통해 순번 스펙 디렉터리를 생성한다.
- **FR-002**: 스펙 생성 시 해당 프롬프트를 `prompt-history.md`의 첫 항목으로 기록한다.
- **FR-003**: 이후 모든 사용자 프롬프트는 UserPromptSubmit 훅으로 활성 스펙 이력에 자동 수집된다.
- **FR-004**: 이력 항목은 ISO-8601 타임스탬프 + 원문 코드블록 형식을 유지한다.
- **FR-005**: 스펙 정의·계획·실행은 설치된 spec-kit 스킬(`/speckit-specify`, `/speckit-plan`,
  `/speckit-tasks`, `/speckit-implement`)과 호환된다.

### Key Entities

- **스펙 디렉터리** `specs/NNN-slug/`: `spec.md`, `prompt-history.md`, (선택) `plan.md`, `tasks.md`
- **활성 피처 포인터** `.specify/feature.json`: `feature_directory` 키
- **드라이버** `.claude/skills/speckit-run/driver.sh`: new/log/note/current/list/hook

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 새 프롬프트 → 스펙 생성까지 명령 1회.
- **SC-002**: 세션 중 입력된 사용자 프롬프트의 100%가 활성 스펙 이력에 남는다(훅 자동 수집).
- **SC-003**: 이력 파일만 읽어도 스펙에 대한 요구 변경 흐름을 시간순으로 재구성할 수 있다.

## Assumptions

- `jq`, `bash`가 존재하는 Linux/macOS 환경.
- 프롬프트 이력은 커밋 대상 산출물이다(스펙과 함께 버전 관리).
- 이 레포 정책상 변경은 PAL 모드 범위에 한정된다는 기존 규약과는 독립적인 메타(워크플로우) 기능이다.
