# Tasks

## 1. Handover in the chat (`chat-work-handover`)
- [x] 1.1 `public.handover_events` 테이블 + RLS (마이그레이션 3개 사본 동기)
- [x] 1.2 `origin_room_id` 컬럼 + 방 컨텍스트로 전파 (이메일 References 방식)
- [x] 1.3 `UnifiedChatInput` 에 컴포저 슬롯 패스스루 (기존 도구 보존)
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
- [ ] 6.4 Playwright 시나리오화 (현재는 녹화 스크립트로만 확인)

## 7. Follow-ups (not in this change)
- [ ] 7.1 활동명 LLM 정규화 → 암묵 위임을 제어 흐름에 복귀
- [ ] 7.2 업무 키(견적번호 등) 기반 상관 + 케이스 분할
- [ ] 7.3 조직도 자동 반영 제안(현재는 조회·표시까지)
- [ ] 7.4 `todolist` 실행 이력 인제스천
