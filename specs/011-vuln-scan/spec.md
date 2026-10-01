# Feature Specification: 취약점 점검 및 CI 상시 점검 (Vulnerability Scan)

**Feature Branch**: `011-vuln-scan` (브랜치 미생성 — `.specify/feature.json`으로 추적)

**Created**: 2026-10-01

**Status**: Implemented (2026-10-01)

**Input**: User description: "uEngine PAL의 취약점 점검을 진행하여 취약점이 발견된 부분을 해결하고, 이후에는 정기적인 취약점 점검을 진행하여 프로젝트의 보안 문제점을 준비한다. DoD: Critical/High 전부 해소, GitHub Actions에서 커밋마다 점검."

## 점검 범위 (Scope)

이 레포(`process-gpt-vue3`)에 존재하는 자산만 대상이다. 다른 레포(completion, memento 등)는 범위 밖.

| 영역 | 대상 | 도구 | 게이트 |
|---|---|---|---|
| SCA — npm | 루트 `package.json` (프론트엔드 + `server.js`) | `npm audit` | Critical/High 0건 |
| SCA — Maven | `gateway/pom.xml` (Spring Cloud Gateway) | Trivy `rootfs` (빌드된 jar, 오프라인) | Critical/High 0건 |
| 시크릿 | git 추적 파일 + 신규 커밋 | gitleaks | 0건 (오탐은 `.gitleaks.toml` 허용목록) |
| SAST | `src/`, `server.js`, `gateway/` | Semgrep (`semgrep-rules/` + 공개 룰셋) | ERROR(=High) 0건 |
| IaC | `Dockerfile*`, `kubernetes/`, `gateway/kubernetes/` | Trivy `config` | Critical/High 0건 |

등급 기준은 각 도구의 원 등급(npm advisory / GHSA·NVD CVSS / gitleaks는 전부 Critical 취급 / Semgrep ERROR=High)을 따른다.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 현 시점 Critical/High 취약점 제거 (Priority: P1)

보안 담당자가 점검 도구를 돌리면 Critical/High 등급 결과가 0건이다.

**Why this priority**: DoD 1번. 실제 위험(유출된 토큰, 서명 미검증 JWT 통과, RCE급 의존성)을 없앤다.

**Independent Test**: `scripts/security/scan.sh all` 실행 → 모든 단계 PASS.

**Acceptance Scenarios**:

1. **Given** 현재 의존성, **When** `npm audit --audit-level=high`, **Then** 종료 코드 0.
2. **Given** gateway 의존성, **When** Trivy rootfs(jar) `--severity CRITICAL,HIGH --exit-code 1`, **Then** 종료 코드 0.
3. **Given** 추적 파일, **When** gitleaks 실행, **Then** 유출 0건.
4. **Given** 서명이 맞지 않는 JWT, **When** 보호 경로(`/completion/*`, `/agent/*` 등) 호출, **Then** 401.

### User Story 2 - 커밋마다 자동 점검 (Priority: P1)

개발자가 push/PR을 올리면 GitHub Actions가 위 5개 영역을 점검하고, Critical/High가 있으면 실패로 표시한다.

**Why this priority**: DoD 2번. 이후 새로 유입되는 취약점을 막는다.

**Independent Test**: 워크플로우를 `act` 또는 실제 push로 실행하여 잡이 성공하고, 일부러 취약 버전을 넣으면 실패하는지 확인.

**Acceptance Scenarios**:

1. **Given** push 또는 PR, **When** 워크플로우 실행, **Then** 5개 잡이 병렬로 돌고 결과가 GitHub Security 탭(SARIF)과 잡 요약에 남는다.
2. **Given** 신규 Critical CVE가 공개됨, **When** 주 1회 스케줄 실행, **Then** 코드 변경이 없어도 실패로 감지된다.

### Edge Cases

- `package-lock.json`이 `.gitignore`에 있어 CI는 매번 새로 해석한다 → CI에서 `npm install --package-lock-only`로 잠금파일을 생성한 뒤 audit.
- 이미 커밋 이력에 들어간 시크릿은 파일에서 지워도 이력에 남는다 → **폐기·재발급(rotate)이 필수**이며 CI는 신규 커밋 범위만 이력 스캔한다.
- 수정 버전이 없는 취약점 → 대체 패키지 교체 또는 `overrides`로 전이 의존성 상향. 그래도 불가하면 사유를 `.trivyignore`/문서에 기록(만료일 포함).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: npm 의존성의 Critical/High advisory 0건 (미사용 패키지 제거, 버전 상향, `overrides`).
- **FR-002**: gateway를 지원 중인 Spring Boot/Spring Cloud 라인으로 상향하여 Critical/High 0건.
- **FR-003**: 추적 파일 내 실제 시크릿 제거(환경변수/Secret 참조로 대체), 오탐은 허용목록으로 명시.
- **FR-004**: gateway JWT 검증에서 서명 미검증 폴백 제거(서명이 틀린 토큰 거부), 하드코딩 기본 시크릿 제거.
- **FR-005**: GitHub Actions 워크플로우 `security-scan.yml` — push/PR/주간 스케줄/수동 실행, Critical/High 시 실패.
- **FR-006**: 로컬에서 동일 점검을 재현하는 스크립트 제공.
- **FR-007**: 기존 기능 동작 유지 — PAL/비 PAL 화면 동작 변화 없음(라이브러리 상향은 API 호환 확인).

### Key Entities

- **점검 보고서**: `docs/security/vuln-scan-report-2026-10.md` — 발견 항목, 조치, 잔여 위험, rotate 필요 시크릿.

## Success Criteria *(mandatory)*

- **SC-001**: 5개 영역 Critical/High 0건 (로컬 스크립트 + CI 모두).
- **SC-002**: 프론트 `npm run build`, gateway `mvn package` 성공, gateway 라우팅·JWT 검증 동작 확인.
- **SC-003**: 워크플로우가 main push에서 녹색.

## Assumptions

- gateway는 현재 이 서버에서 `process-gpt-gateway.service`로 구동 중이며, 상향 후 재기동한다.
- Medium/Low는 이번 범위에서 차단하지 않고 보고서에 집계만 한다.
- 유출 시크릿의 실제 폐기(GitHub PAT, BlackDuck 토큰, Keycloak client secret)는 소유자가 직접 수행해야 한다.
