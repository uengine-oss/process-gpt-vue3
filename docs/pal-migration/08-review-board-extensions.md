# 08. 리뷰보드 확장

pi 핸드오버 문서 02(Review Board) 대응. 1차에서는 추가 화면 2종만 이관했으나, 이후 확인 결과 `MyInbox.vue`가 리뷰보드 라우트에서만 사용되는 것으로 확인되어 **리뷰보드 화면 전체를 pi 버전으로 이관**했다.

## 이관 파일

| 파일 | 라우트 | 내용 |
|---|---|---|
| `src/views/review-board/RestructureApprovalBoard.vue` | `/review-board/restructure` | 재구조화(컷오버 잡) 승인 보드 — adminConsole 스토어의 loadCutoverJobs/approveCutoverJob/rejectCutoverJob 사용 |
| `src/views/review-board/ReviewBoardSubmissionDebug.vue` | `/review-board-debug` | 리뷰 제출 데이터 디버그 뷰 — backend.getReviewBoardData + users 조회 |
| `src/views/review-board/MyInbox.vue` | `/my-inbox` | 내 결재함 (pi 버전으로 교체) |
| `src/views/review-board/ProcessReviewBoard.vue` | `/review-board` | 리뷰보드 목록 (pi 버전으로 교체 — 버전 그루핑, 소유자 표시 등) |
| `src/views/review-board/ProcessReviewDetail.vue` | `/review-board/:reviewId` | 리뷰 상세 (pi 버전으로 교체 — fieldChanges 기반 상세 diff 등) |
| `src/utils/reviewVersionGrouping.ts` | — | 신규 — MyInbox/ProcessReviewBoard의 프로세스별 버전 그루핑 유틸 |
| `src/stores/reviewBoard.ts` | — | pi 버전으로 교체 — 타입 필드 추가만 있는 순수 additive 델타 (`submitted_by_id`, `pi_owners`/`hq_owners`/`field_owners`/`master_owner`, `is_my_submission`) |
| `src/utils/bpmnDiff.ts` | — | pi 버전으로 교체 — export 시그니처 동일(3함수), `BpmnChange.fieldChanges?` 추가 등 superset. 기존 사용처 4곳 중 3곳은 pi와 동일 파일, `SktVersionComparisonDialog.vue`는 optional 필드 추가라 영향 없음 |
| `src/components/ui/ProgressBadge.vue` | — | pi 버전으로 교체 — `processStages.getStageDef` 기반 `isPublicFeedbackStatus`로 툴팁 조건 확장 (props 동일, additive) |

## 라우트

- `/review-board/restructure`, `/review-board-debug` 두 라우트는 **PAL 게이트** 스프레드로 추가. `/review-board/restructure`는 pi와 동일하게 동적 라우트 `/review-board/:reviewId`보다 **앞에** 배치.
- `/review-board`, `/review-board/:reviewId`, `/my-inbox`는 기존 라우트 그대로(모든 모드 공유) — 컴포넌트만 pi 버전으로 교체.

## 전체 이관 근거 / 호환성 확인

- 현재 프로젝트에서 `MyInbox.vue`/`ProcessReviewBoard.vue`/`ProcessReviewDetail.vue`의 참조처는 `MainRoutes.ts`의 리뷰보드 라우트뿐 (다른 화면에서 재사용 없음) → 교체 영향 범위가 리뷰보드에 국한.
- pi 화면이 호출하는 backend 메서드 26종(getReviewBoardByInbox, approveHQ/approveField, requestReopen, getSnapshots 등) 모두 현재 `ProcessGPTBackend`에 존재.
- 공용 유틸 의존성(authClaims/datetime/processStages/reviewPermissions/roles/safeText/userIdentity/process-hierarchy/navigation/adminConsole)은 전부 pi와 동일 파일(diff 없음)이었음.
- `BpmnUengineViewer.vue`는 **교체하지 않음** — 현재 프로젝트 버전이 디자인 토큰 등으로 자체 발전해 있고, 리뷰 화면이 쓰는 인터페이스(`:bpmn`, `:diffActivities`)는 현재 버전이 그대로 지원.
- i18n: pi ProcessReviewBoard가 쓰는 `reviewBoard.*` 키 5종 모두 현재 `ko.json`에 존재.
- `ReviewBoardCard.vue`: pi에서는 더 이상 사용하지 않는 컴포넌트. pi 버전 ProcessReviewBoard로 교체되면서 현재 프로젝트에서도 참조가 사라졌다(파일은 남겨둠).

## DB

- 리뷰보드 관련 마이그레이션은 [01-db-schema.md](01-db-schema.md)의 20260213/20260409/20260525 계열로 이미 이관됨.
