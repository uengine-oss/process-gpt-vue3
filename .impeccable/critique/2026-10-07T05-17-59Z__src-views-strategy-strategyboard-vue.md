---
target: 전략 보드 · 온톨로지 익스플로러 · 스키마 · 기업 운영 온톨로지
total_score: 21
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 3
target_identity: "file:/home/kimsanghoon/process-gpt-vue3/src/views/strategy/StrategyBoard.vue"
target_fingerprint: "sha256:17a51248eda3a2a567c568a4b37fe0b6b6bfed427de5d77036e9f0ae9377eaf5"
target_path: /home/kimsanghoon/process-gpt-vue3/src/views/strategy/StrategyBoard.vue
timestamp: 2026-10-07T05-17-59Z
slug: src-views-strategy-strategyboard-vue
---
Method: dual-agent (A: design review · B: detector+browser)

## Design Health Score — 21/40 (Acceptable)
| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | 시스템 상태 가시성 | 3 | 체인이 KPI에서 끊겨도 '끊김' 상태 표시 없음 |
| 2 | 현실 세계 일치 | 2 | 스키마 탭 영문 타입명·DB 컬럼명 노출 |
| 3 | 사용자 통제 | 3 | 미니맵/선택 노드로 이동 없음 |
| 4 | 일관성 | 1 | 같은 달성률이 탭마다 다른 색(80.8% 파랑 vs 빨강 미달), PAL 박스 규약 이탈 |
| 5 | 오류 예방 | 2 | 전략맵 초기화가 추가 버튼 옆 동급 크기 |
| 6 | 인식 | 2 | 범례가 툴바 아래 텍스트 한 줄, 미달 기준 설명 없음 |
| 7 | 유연성 | 3 | 키보드 노드 이동·URL 공유 없음 |
| 8 | 미니멀 | 1 | 전략 10개 중 9개 빨강, 엣지 회색 덩어리 |
| 9 | 오류 복구 | 2 | 미연결 KPI 안내가 원인 분석 클릭 후에야 |
| 10 | 도움말 | 2 | 미달 기준(100% 미만) 설명 없음 |

## Priority Issues
- [P0] 미달 판정 과포화(<100% 전부 빨강, 전략은 KPI 하나만 미달이어도 빨강) → 3단계(위험<70 빨강 채움 / 주의 70~99 amber 외곽선 / 달성 무표시), 전략은 가중 달성률 기준
- [P1] 탭별 달성률 색 체계 불일치(StrategyBoard.vue achievementColor 70/40 vs explorer 100/70) → 공용 모듈 + dashboard_thresholds 연동
- [P1] KPI 원인 추적 동선 단절(14 KPI 중 8개 프로세스 미연결, 원인분석 버튼 파스텔 tonal 대비 ~2.2:1, 속성표 아래) → 상단 primary 버튼, '실행 미연결' 배지·안내, 속성표 접기, KPI 패널에 병목 태스크 직접 표시
- [P1] PAL 박스/여백 규약 이탈(탭 compact·px-2로 정렬선 3개, 1280에서 툴바 줄바꿈, 390px 제목 글자 단위 깨짐) → 분석대시보드 inner container + 탭 56px, 헤더 액션 1+오버플로 메뉴
- [P2] 엣지 노이즈·가로폭(8열 1950px, 열 건너뛰기 점선 수백 개, 워크아이템 289) → 선택 전 인접 엣지만 옅게, 워크아이템/리소스 기본 접기, compact 모드

## Detector
CLI: side-tab 5건(StrategyBoard.vue:1836 .lane-label, StrategyOntologyExplorer.vue:938/972/977 .soe-card, OntologySchemaView.vue:291 .osv-box) — 타입/상태 인코딩이라 반쯤 의도적.
Browser: explorer 576건(side-tab 429 반복집계, undersized-ui-text 108 = 10px 배지), schema low-contrast 4(#16a34a 3.3:1), /analytics/ontology low-contrast 14(#707a82 4.4:1, 흰글자 on #0085db 3.9:1). layout-transition/bounce-easing/clipped-overflow/dark-glow 는 앱 셸 공통(대상 밖).

## Persona Red Flags
Alex: 키보드 노드 이동·URL 공유·미니맵 없음, 같은 데이터 화면 2개.
Sam: 배지 10px, 원인분석·초기화 버튼 대비 2.2~2.4:1, 카드 div@click(role/tabindex 없음), 흐린 카드 1.4:1.
경영기획 담당자: 미연결 KPI 선택 시 체인이 전략에서 끝나고 원인분석 후에야 안내 → 이탈.

## Questions
1. 기본 뷰가 8열 전체가 아니라 '위험 KPI 3개 + 병목 경로'여야 하지 않나?
2. 미연결 KPI가 과반이면 익스플로러의 첫 역할은 '연결하라' 작업목록 아닌가?
3. 스키마 탭·/analytics/ontology 는 관리자 영역으로 옮겨야 하지 않나?
