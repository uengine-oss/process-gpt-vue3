# 09. 업무분장 (Work Assignment)

pi 핸드오버 문서 13 대응. 프로세스별 담당자(오너/조직) 지정 화면.

## 이관 파일

| 파일 | 출처 |
|---|---|
| `src/views/work-assignment/WorkAssignment.vue` | pi 동일 경로 (54K, 그대로 복사) |

## 라우트 / 사이드바

- PAL 블록에 `/work-assignment` → WorkAssignment
- 관리자 섹션 사이드바에 `업무분장` (icon `users-group-rounded-line-duotone`) — MENU_DEFINITIONS 라벨/아이콘 준수

## 포함/제외 판단 (설계 결정)

이 화면은 조직 그룹 검색(`searchGroupsByName`/`getGroupById`)을 사용하는데, 이는 **제외 영역(조직 연동)의 REST API**다. 그러나:

- `PalModeBackend.searchGroupsByName`은 REST 실패 시 **빈 목록으로 우아하게 폴백** (`{ groups: [], ... }`)
- `getGroupById`는 실패 시 null 반환
- 사용자 검색(`searchUsersByName`)은 Supabase `users` 테이블 폴백이 이미 구현되어 있어 정상 동작

→ 조직 연동 백엔드를 이관하지 않고도 **사용자 기반 담당자 지정은 완전히 동작**하므로 화면을 포함하되, 조직(그룹) 검색은 빈 결과로 표시되는 제한을 문서화한다. 향후 조직 데이터 소스가 생기면 `PalModeBackend`의 두 메서드에 Supabase 폴백만 붙이면 된다.

참고: 이후 `/pi-system-backend/` dev 프록시가 추가되어([02-system-management.md](02-system-management.md)), 이관된 `playground-pi-system-backend`가 organization 엔드포인트를 서빙하는 환경이라면 그룹 검색 REST도 실제로 동작한다 (프론트 코드는 무수정 — 이미 REST 1차 구조).

## 기타 의존성 (모두 현재 프로젝트에 존재)

- `components/ui/ProgressBadge.vue`, `utils/safeText.ts`, `utils/processStages.ts`, `utils/userIdentity.ts`, `views/process-hierarchy/navigation.ts`
- backend: `getData`, `getProcessDefinitionMap` / 테이블: `proc_def`, `proc_def_version`, `proc_def_approval_state`
