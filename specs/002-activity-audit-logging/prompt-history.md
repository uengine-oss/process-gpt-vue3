# Prompt History — 002-activity-audit-logging

작업이력: 이 스펙에 대해 사용자가 입력한 프롬프트가 시간순으로 수집됩니다.

## Prompt — 2026-09-16T03:15:25+00:00

```text
# 활동 로그 수집
 감사로그 > 활동 로그에 사용자 및 관리자의 모든 페이지에 대한 로그가 정상적으로 적재되는지 검토해야함. 현재는 프로세스 순서도, 속성 스키마 관리, 관리자 보안 설정, Task 종류관리에 대한 로그만 적재되고 있는데, 로그인 조회 등록 수정 삭제 다운로드 등 주요 행위 로그를 모두 기록 해야한다.
 ## 현재 활성화 되어있는 페이지 목록
 - process-architecture
 - review-board
 - call-activity-management
 - glossary
 - organization
 - admin-request
 - analysis-dashboard
 - admin-console/ 하위 라우팅 페이지

완료 후, 사용자 활동 로그 목록에 모든 조회 활동에 대한 로그가 정상적으로 표시된다. 유저가 직접 테스트 할 수 있도록 테스트 가이드 문서(logging-test.md)를 docs/logging 하위에 각 기능 별로 로그 적재 방법을 작성한다.
```

## Prompt — 2026-09-16T03:16:33+00:00

```text
위 작업을 '/speckit-run'의 구조로 spec과 문서를 작성해.
```

## Note — 2026-09-16T03:32:36+00:00

```text
구현 완료: 활동 로그 전면 수집 — page_view 라우터 훅(activityAuditLog.ts), 8개 영역+admin-console CUD/내보내기 call site 추가, AuditTrail 라벨맵 확장, export_log 죽은 코드 대체, docs/logging/logging-test.md 작성, vue-tsc 통과
```

## Prompt — 2026-09-16T03:49:12+00:00

```text
프로세스 순서도에 대한 로그는 정상적으로 쌓이지않음.
```

## Note — 2026-09-16T03:52:00+00:00

```text
보완: 프로세스 순서도(/process-hierarchy)·버전비교 page_view 누락 수정 — allowlist 추가, 라벨 보강(EXTRA_ROUTE_LABELS), 쿼리 id 기준 프로세스별 조회 기록, 가이드 문서 갱신, vue-tsc 통과
```

## Prompt — 2026-09-16T04:33:31+00:00

```text
단순 프로세스 조회시에도, proc_id, proc_name 으로 뜸
```

## Note — 2026-09-16T04:36:17+00:00

```text
보완: page_view 로그에서 after_value(proc_id/proc_name) 제거 — 조회 로그의 변경 내역 칸이 비도록, 프로세스 식별은 target_id(프로세스 id)·target_name(페이지명(프로세스명))으로
```
