# Prompt History — 007-manual-refresh

작업이력: 이 스펙에 대해 사용자가 입력한 프롬프트가 시간순으로 수집됩니다.

## Prompt — 2026-09-17T02:46:53+00:00

```text
@docs/PI_System_통합_사용자_매뉴얼.docx 해당 사용자 메뉴얼이 이전에 작성한 메뉴얼인데, 최근 추가된 기능이 많아 메뉴얼을 전체적으로 업데이트 하려함.
@docs/manuals/ 이외에 더 추가된 기능들 목록(RACI, 조직도 등)을 먼저 정리하고 각각 스크린샷을 포함한 메뉴얼을 markdown으로 작성해서 docx에도 업데이트해줘. 그리고 메뉴얼 스크린샷 찍을때는 항상 좌측 사이드바메뉴를 닫고 찍도록해.
```

## Note — 2026-09-17T03:35:02+00:00

```text
구현 완료: 매뉴얼 격차 조사(feature-gap.md) → 신규 매뉴얼 9종 작성(raci-task-settings, organization-chart, merge-requests, option-lists, security-settings, audit-trail, analysis-dashboard, notifications-inbox, process-restructure) → docx 전 9부 36장으로 갱신(scripts/build-manual-docx.py, 재실행 가능). 스크린샷은 shoot.mjs 사이드바 자동 닫기 추가로 전부 사이드바 닫힘 상태.
```

## Note — 2026-09-17T03:35:02+00:00

```text
매뉴얼 작성: docs/manuals/{raci-task-settings,organization-chart,merge-requests,option-lists,security-settings,audit-trail,analysis-dashboard,notifications-inbox,process-restructure}.md
```

## Prompt — 2026-09-17T03:41:11+00:00

```text
/speckit-run > 의도 (why & value)
- ProcessGPT PAL에 대한 시연을 TYM에서 제공한 프로세스를 기반으로 시나리오를 작성하고 준비한다.

> 인수조건 (Definition of Done)
- 프로세스 드로잉부터 ProcessGPT PAL에서 강조할 수 있는 기능(AI 기능 제외)을 설명할 수 있는 20분 이내로 시연 가능한 scenario.md 
- 시나리오의 각 부분 별 영상과 음성

> 컨텍스트 (참고자료 위치)
- @"P5.4.3 내부심사 프로세스.pptx" 
- @docs/PI_System_통합_사용자_매뉴얼.docx 
- 발표 시간 20분
```
