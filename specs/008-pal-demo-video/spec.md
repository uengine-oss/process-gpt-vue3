# Feature Specification: P5.4.3 기반 ProcessGPT PAL 20분 시연 패키지 (시나리오 + 파트별 영상·음성)

**Feature Branch**: `008-pal-demo-video`

**Created**: 2026-09-17

**Status**: Draft

**Input**: User description: "TYM 제공 프로세스(P5.4.3 내부심사) 기반 PAL 시연 준비.
DoD: (1) 프로세스 드로잉부터 AI 제외 PAL 강조 기능을 20분 내 시연 가능한 scenario.md,
(2) 시나리오 각 부분별 영상과 음성. 참고: P5.4.3 내부심사 프로세스.pptx,
PI_System_통합_사용자_매뉴얼.docx, 발표 시간 20분."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 20분 시연 시나리오 문서 (Priority: P1)

발표자가 scenario.md 하나로 시연 전 과정을 리허설·진행할 수 있다.
파트별 시간 배분, 화면 동선(클릭 단위), 발표 멘트(내레이션 원고), 폴백이 담긴다.

**Why this priority**: 시연의 뼈대. 영상·음성도 이 문서의 파트 구분을 따른다.

**Independent Test**: scenario.md만 보고 제3자가 로컬 환경(tym)에서 시연 동선을
재현할 수 있고, 파트별 누적 시간이 20분 이내다.

**Acceptance Scenarios**:

1. **Given** 기존 시연 자산(docs/demo-p543-internal-audit-scenario.md, 완성 BPMN,
   tym 시드), **When** scenario.md 작성, **Then** ①프로세스 지도 ②순서도 작성
   ③Task Catalog ④속성패널 ⑤속성 스키마 ⑥검증 ⑦클로징 7개 파트가 시간·동선·
   멘트와 함께 정리된다 (AI 기능 제외).

---

### User Story 2 - 파트별 시연 영상 (Priority: P1)

각 파트의 화면 동선을 담은 영상 파일이 파트 번호별로 제공된다.

**Why this priority**: DoD 명시 항목. 리허설·백업(라이브 실패 시 영상 대체)에 사용.

**Independent Test**: videos/ 아래 파트별 영상이 재생되고, scenario.md의 해당
파트 동선과 일치한다.

**Acceptance Scenarios**:

1. **Given** 로컬 PAL(http://localhost:8088, tym) 실행 상태, **When** 녹화 스크립트
   실행, **Then** 파트 ①~⑥ 영상이 자동 생성된다 (⑦클로징은 음성 전용).
2. 영상 녹화는 재실행 가능한 스크립트로 수행하며 시연 데이터 상태를 훼손하지
   않는다 (라이브 등록용 input 필드는 녹화 후 원상 복구).

---

### User Story 3 - 파트별 내레이션 음성 (Priority: P2)

scenario.md의 파트별 멘트(발표 원고)를 한국어 TTS 음성 파일로 제공한다.

**Independent Test**: audio/ 아래 파트별 mp3가 재생되고 원고와 일치하며,
전체 합산 길이가 발표 시간 20분 안에 들어온다.

### Edge Cases

- 라이브 모델링(파트 ②)은 실수 위험이 커서 영상은 안전한 조작(컨텍스트 메뉴로
  태스크 추가·이름 입력·되돌리기)만 수행하고 저장하지 않는다.
- 파트 ⑤ 라이브 등록(input 필드)은 녹화 시 실제로 등록 후 **DB에서 삭제해
  시연 전 상태로 복구**한다.
- TTS 네트워크 불가 시 음성은 원고(scenario.md)로 대체하고 그 사실을 기록한다.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: docs/demo-p543-pal/scenario.md — 7개 파트, 파트별 시간·동선·멘트·폴백.
  기존 docs/demo-p543-internal-audit-scenario.md를 현재 로컬 상태(tym)에 맞게 갱신·계승.
- **FR-002**: 파트 ①~⑥ 영상 자동 녹화 스크립트(scripts/demo/record-demo.mjs,
  Playwright recordVideo) + docs/demo-p543-pal/videos/ 산출물.
- **FR-003**: 파트 ①~⑦ 내레이션 mp3 생성 스크립트(edge-tts) +
  docs/demo-p543-pal/audio/ 산출물.
- **FR-004**: 녹화 후 시연 사전 상태 복구(input 스키마 필드 삭제, 저장 없는 편집).

## Success Criteria *(mandatory)*

- **SC-001**: scenario.md 파트 시간 합계 ≤ 20분.
- **SC-002**: 파트 ①~⑥ 각각 영상 파일 존재, ①~⑦ 각각 음성 파일 존재.
- **SC-003**: 녹화 후 tym DB에 input 필드가 남아있지 않다 (라이브 시연 여지 보존).

## Assumptions

- 시연 환경은 로컬 PAL(http://localhost:8088, tym, manual-shots 계정) 기준.
  실제 발표는 원격(34.22.71.73) 환경일 수 있으나 동선은 동일.
- 음성은 edge-tts(ko-KR 보이스) 사용. 영상은 webm(Playwright 기본), ffmpeg가
  가능하면 mp4 변환본도 제공.
- AI 기능(Copilot, Agent 분석 등)은 시연·영상 모두에서 제외.
