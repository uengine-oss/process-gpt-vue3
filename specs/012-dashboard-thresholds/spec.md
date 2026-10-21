# Feature Specification: 분석 대시보드 차트 기준값 설정

**Feature Branch**: `012-dashboard-thresholds`
**Created**: 2026-10-02
**Status**: Implemented (manual: docs/manuals/dashboard-thresholds.md)
**Input**: "각 Dashboard의 차트에서 기준값을 하드코딩이 아닌 직접 설정 할 수 있도록 변경하여, 기준값이 변경 될 때 마다 차트 계산 데이터를 직접 수정하는 것이 아닌 해당 기준 값만 변경 가능하도록 한다." (전문: prompt-history.md)

## 배경 — 현재 하드코딩된 기준값

분석 대시보드(`/analysis-dashboard`)의 네이티브 뷰 4종과 pi-system-backend(= process-gpt-completion, `API_PATH_PREFIX=/pi-system-backend`)의 Dashboard / Operational Board API 에 기준값이 코드로 박혀 있다.

| 뷰 | 차트 | 기준값 | 위치 |
|---|---|---|---|
| 진행현황 | 본부별 KPI 달성(RAG) | 달성률 ≥100% G, ≥50% A | ExecutiveSummary.vue (백엔드 `kpi_divisions.rag` 는 70/40 으로 서로 다름) |
| 진행현황 | 주간 완료 추이 | 주간 목표선 (백엔드가 항상 NULL) | dashboard_api.py |
| 진행현황 | 단계 역행(Churn) 위험도 | 역행 ≥3 높음, ≥2 중간 | ExecutiveSummary.vue |
| 운영현황 | 병목 FTE 산정 | 월 근무일 22 | operational_board_api.py |
| 운영현황 | FTE 등급 분포 | ≥5 Critical, ≥3 High, ≥1 Medium | OperationalBoard.vue |
| 운영현황 | 장기 미갱신(좀비) | 90일 주의, 180일 위험 | operational_board_api.py + OperationalBoard.vue |
| 운영현황 | 검토 지연 | 7일 | operational_board_api.py |
| 입력정확도 | 속성별 입력 충실도 | ≥80% 양호, ≥60% 주의 | GovernanceQuality.vue |

상대 비율 기반 색 농도(히트맵 단계 0.8/0.6/…)는 "기준값"이 아니라 시각화 스케일이므로 범위 밖이다.

## User Scenarios & Testing

### User Story 1 — 관리자가 차트 기준값을 바꾼다 (P1)

관리자는 분석 대시보드 상단의 "차트 기준값" 버튼으로 설정 창을 열어, 뷰별로 묶인 기준값을 바꾸고 저장한다. 저장 즉시 열려 있는 대시보드의 색·등급·필터·목표선이 새 기준으로 다시 계산된다.

**Acceptance**
1. Given 관리자, When 좀비 "위험" 기준을 180→120 으로 저장, Then 운영현황의 장기 미갱신 카드가 120일 이상을 빨강으로 표시하고 필터 라벨이 "120일+" 로 바뀐다.
2. Given 관리자, When 주간 완료 목표를 5 로 저장, Then 진행현황 주간 추이에 목표선(5)이 그려진다.
3. Given 비관리자, Then 기준값 버튼이 보이지 않고 DB 쓰기도 RLS 로 거부된다.
4. Given 잘못된 값(주의 ≥ 위험, 음수 등), Then 저장 버튼이 비활성화되고 항목에 오류가 표시된다.
5. "기본값으로 되돌리기" 를 누르면 원래 하드코딩 값으로 채워진다.

### User Story 2 — 변경 이력이 감사로그에 남는다 (P1)

**Acceptance**
1. Given 기준값 저장, Then `admin_audit_log` 에 `action=dashboard_threshold_update`, `target_type=dashboard_threshold` 행이 변경 전/후 값과 함께 쌓이고, 수행자는 로그인 사용자로 강제된다.
2. 관리자 콘솔 › 감사 로그에서 "대시보드 기준값 변경" 으로 보이고, 변경 상세에 항목명(예: "좀비 위험 기준(일)")과 전→후 값이 표시된다.
3. 값이 실제로 바뀌지 않은 저장은 로그를 남기지 않는다.
4. 기록은 DB 트리거가 하므로 SQL 직접 수정 등 화면 밖 경로로 바꿔도 남는다.

### Edge Cases
- 설정 행이 없거나 일부 키만 있으면 누락 키는 기본값을 쓴다(기존 동작 유지).
- 저장된 값이 손상(문자열·음수·순서 역전)이면 백엔드·프론트 모두 해당 그룹을 기본값으로 대체한다.
- 비 PAL 모드는 변경 없음(버튼 미노출, 백엔드는 설정이 없으면 기본값 = 기존 값).

## Requirements

- **FR-001** 기준값은 테넌트별 `configuration` 행(`key='dashboard_thresholds'`, value=평탄 JSON)으로 저장한다.
- **FR-002** 프론트(차트 색·등급·라벨)와 백엔드(SQL 필터·RAG·FTE·목표선)가 같은 키·같은 기본값·같은 검증 규칙을 쓴다.
- **FR-003** 백엔드 `GET /dashboard/thresholds` 가 정규화된 현재값과 기본값을 돌려준다. 쓰기는 관리자 세션으로 `configuration` 에 직접 upsert(기존 RLS: admin 만 쓰기).
- **FR-004** `configuration` AFTER INSERT/UPDATE/DELETE 트리거가 이 키의 변경을 `admin_audit_log` 에 기록한다(before/after 는 바뀐 키만).
- **FR-005** 감사로그 화면에 action/target/항목 라벨을 등록한다.
- **FR-006** PAL 전용 화면 범위에서만 노출한다.

### 기준값 키 (기본값)

| 키 | 기본 | 의미 |
|---|---|---|
| kpi_rag_green_pct | 100 | KPI 달성률 G 하한(%) |
| kpi_rag_amber_pct | 50 | KPI 달성률 A 하한(%) — green 보다 작아야 함 |
| velocity_weekly_target | 0 | 주간 완료 목표(건), 0 = 목표선 없음 |
| churn_high | 3 | 역행 횟수 "높음" 하한 |
| churn_medium | 2 | 역행 횟수 "중간" 하한 — high 보다 작아야 함 |
| fte_working_days | 22 | FTE 산정 월 근무일 (1~31) |
| fte_critical | 5 | FTE Critical 하한 |
| fte_high | 3 | FTE High 하한 |
| fte_medium | 1 | FTE Medium 하한 — critical > high > medium > 0 |
| zombie_warning_days | 90 | 장기 미갱신 주의(일) |
| zombie_danger_days | 180 | 장기 미갱신 위험(일) — warning 보다 커야 함 |
| review_delay_days | 7 | 검토 지연 기준(일) |
| dq_good_pct | 80 | 입력 충실도 양호 하한(%) |
| dq_warning_pct | 60 | 입력 충실도 주의 하한(%) — good 보다 작아야 함 |

백엔드 `kpi_divisions.rag` 의 70/40 은 화면이 쓰는 100/50 으로 통일한다(화면은 이 필드를 쓰지 않으므로 표시 변화 없음).

## Success Criteria

- **SC-001** 위 14개 기준값 중 어느 것을 바꿔도 코드 수정·배포 없이 다음 조회부터 반영된다.
- **SC-002** 기준값 변경 1회당 감사로그 1행이 남고 전/후 값을 확인할 수 있다.
- **SC-003** 설정이 없는 테넌트의 대시보드 결과는 변경 전과 동일하다(RAG 백엔드 필드 제외).
