# Tasks

## 1. Handover in the chat (`chat-work-handover`)
- [x] 1.1 `public.handover_events` 테이블 + RLS (마이그레이션 3개 사본 동기 · 2026-10-19 에 `20261019000001/2` 로 날짜 정리, 실제 스키마 저장소 `process-gpt-infra-docker` init.sql 에도 반영)
- [x] 1.2 `origin_room_id` 컬럼 + 방 컨텍스트로 전파 (이메일 References 방식)
- [x] 1.3 ~~`UnifiedChatInput` 에 컴포저 슬롯 패스스루~~ → 머리 줄 아이콘 하나로 정리(main 의 `+` 메뉴 구조와 맞춤, 2026-10-19)
- [x] 1.4 `HandoverDialog.vue` — 산출물 선택 · 다음 단계 · 담당자 · 옵션
- [x] 1.5 담당자 피커를 표준 `UserSelectField` 로 (내장 에이전트 포함)
- [x] 1.6 `createChatHandover` — 방·브리핑·첨부·작업·이벤트·알림
- [x] 1.7 암묵 위임 추적 (`recordAgentDelegation` / `completeAgentDelegation`)
- [x] 1.8 `POST /completion/handover-suggest` — 다음 단계 초안 제안
- [x] 1.9 i18n (ko/en)

## 2. Discovery service (`process-identification`)
- [x] 2.1 `services/process-miner` 골격 + DB 접근 계층
- [x] 2.2 DFG + 노이즈 필터
- [x] 2.3 Inductive Miner (XOR/SEQ/AND/LOOP cut) + 선택적 단계 표현
- [x] 2.4 프로세스 트리 → ProcessGPT 정의 + 계약 검증
- [x] 2.5 출처별 라벨 신뢰도 규칙 (대화 원문 배제)
- [x] 2.6 순서 정보 없는 케이스 제외
- [x] 2.7 draft 버전 + PR 제안 (`resource_pull_requests` 재사용)
- [x] 2.8 REST API (`/threads` `/network` `/discovered` `/mine`) + vite 프록시
- [x] 2.9 단위 테스트 18개 (LLM·DB 없이 결정론적)

## 3. Identification screen
- [x] 3.1 `/mining/handover` 라우트 + `HandoverMining.vue`
- [x] 3.2 스레드 묶음 표시 (에이전트 단계 · 암묵 위임 구분)
- [x] 3.3 도출 결과를 기존 BPMN 모델러로 렌더 (flattened → elements 변환)
- [x] 3.4 사이드바 `프로세스 식별` 메뉴 + i18n
- [x] 3.5 식별된 신규 프로세스 제안 목록 표시

## 4. Organization mining (`organization-mining`)
- [x] 4.1 역량/자격 스키마 (`org_capabilities` · `user_capabilities` · `activity_eligibility`)
- [x] 4.2 사람 사용자·역량 시드 + 조직도 배치
- [x] 4.3 역할 클러스터링(활동 프로필 코사인) · 사람/에이전트 겸용 표시
- [x] 4.4 활동별 자격 산출(수행자·근거 건수·자동화율)
- [x] 4.5 핸드오버 네트워크(사람·에이전트 단일 그래프)
- [x] 4.6 `/organization` · `/eligibility` API
- [x] 4.7 인계 피커: 전체/사람/에이전트 탭 + 내장 에이전트 포함 + 자격 표시
- [x] 4.8 식별 화면에 조직 마이닝 결과 표시
- [x] 4.9 단위 테스트 6개 (역할·자격·자동화율·네트워크·겸용)

## 5. Conversion to execution
- [x] 5.1 식별 화면에 '실행 가능한 프로세스로 전환' 버튼
- [x] 5.2 도출 정의로 요청문 자동 구성(사람이 재서술하지 않음)
- [x] 5.3 전환 대화방 생성 + `autosend` 로 생성 자동 시작

## 6. Verification
- [x] 6.1 마이너 단위 테스트 (순차/XOR/AND/루프/선택적/노이즈/계약/라벨)
- [x] 6.2 인계 이벤트 멱등성 (유니크 인덱스) DB 픽스처 검증
- [x] 6.3 실제 앱 종단 확인 — 업무 대화 → 인계 → 식별 → 제안 → 생성 → 배포
- [x] 6.3a 수정 후 실제 브라우저에서 사용자 조작으로 재확인 (2026-10-19, 계정 3개·스레드 3개)
- [x] 6.4 Playwright 시나리오화 — 9.9

## 8. Stabilization (2026-10-19)
- [x] 8.1 반복 컷을 표준 IM 방식으로 (반려 후 재검토 → `loop(검토, 수정)`)
- [x] 8.2 선택 단계 판정을 컷별 하위 로그 기준으로 (갈래 안 필수 단계 유지)
- [x] 8.3 컷 없음 대안을 순서 없는 반복 `⟲(τ, …)` 으로 (배타 분기 날조 금지)
- [x] 8.4 스레드 첫 인계의 '지금까지 한 일'과 넘긴 사람을 첫 단계로 (두 사람 인계도 분석)
- [x] 8.5 활동명 없는 위임을 인계 네트워크·자동화율·활동별 자격에 반영 (제어 흐름 제외 유지)
- [x] 8.6 회귀 테스트 `tests/test_regressions.py` (12개) · `tests/test_server.py` (15개)
- [x] 8.7 API 테넌트 강제 (JWT 검증, agent SDK `tenant_auth`) · CORS 기본 닫음 · 데모 기본값 제거
- [x] 8.8 DB 연결: 읽기 autocommit · 실패 후 회복 · 제안 등록 트랜잭션 + 정의 단위 잠금
- [x] 8.9 마이너 포트 8015 (strategy 8014 와 동시 기동) · vite 프록시
- [x] 8.10 인계 todo 생성 실패 수정 — `task_execution_properties.proc_inst_id` NULL 허용 마이그레이션
- [x] 8.11 에이전트에게 인계하면 넘긴 사람도 방에 남김 (스레드가 에이전트에서 끊기지 않게)

- [x] 8.12 게이트웨이 배포 경로 — nginx `/process-miner/` 라우트, compose `process-miner` 서비스, Dockerfile
- [x] 8.13 `/handover-suggest` 복구 — 체인을 요청 때 생성(main 의 지연 LLM 과 맞춤)
- [x] 8.14 실행 전환 요청의 조건 표시를 게이트웨이 역할(minedRole)로 판정
- [x] 8.15 HITL 응답 턴 · 실행 전환 방은 위임으로 기록하지 않음
- [x] 8.16 게이트웨이(8088) 뒤 실환경 확인 — 에이전트 응답 · returned_at · AI 제안 · 실행 전환 · 저장

## 9. Stabilization (2026-10-20)
- [x] 9.1 끝난 스레드만 도출 — 마지막으로 받은 할 일 완료, 에이전트가 마지막이면 업무 종료(`closed_at`) (`eventlog.thread_finished`)
- [x] 9.2 `handover_events.closed_at` 마이그레이션(`20261020000001`) · infra-docker init.sql
- [x] 9.3 인계로 넘긴 파일을 받는 방 작업 폴더(`files/skills/{tenant}/{room}/`)에 둔다 — memento 없이도 전달
- [x] 9.4 deepagents 저장 키 인코딩(한글 파일 이름) · 인계 할 일 폴러가 받는 방 작업 폴더를 쓰고 결과를 방에 남김
- [x] 9.5 넘기면 내가 받은 할 일을 완료 · 사람이 받은 할 일은 IN_PROGRESS 로(할 일 화면에 보이게)
- [x] 9.6 에이전트에게 넘긴 방에서 업무 종료(인계 창 아이콘)
- [x] 9.7 식별 화면 — 도출이 안 돼도 스레드 목록, 진행 중 표시
- [x] 9.8 보낸 쪽 인계 알림이 덮어써지던 문제(`await backend.uuid()`) · 받는 방 이름에 시작 방 이름
- [x] 9.9 e2e `playwright/e2e/handover/handover-stabilization.spec.ts` — 네 가지 형태(반려 반복 · 갈래 · 에이전트 중간 · 두 사람)

- [x] 9.10 서로 다른 업무를 묶음으로 갈라 묶음마다 도출(`grouping.py`, `/processes`, 식별 화면 업무 선택) — 한 프로세스의 갈래로 그리지 않음

## 7. Follow-ups (not in this change)
- [ ] 7.1 활동명 LLM 정규화 → 암묵 위임을 제어 흐름에 복귀
- [ ] 7.2 업무 키(견적번호 등) 기반 상관 + 장기 방의 케이스 분할 (업무 종류별 분리는 9.10)
- [ ] 7.3 조직도 자동 반영 제안(현재는 조회·표시까지)
- [ ] 7.4 `todolist` 실행 이력 인제스천
