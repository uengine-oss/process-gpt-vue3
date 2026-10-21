# 후속 작업 프롬프트 (speckit-run 입력용)

009 구현 후 매뉴얼을 다시 전수 스캔하고 코드로 검증한 결과를 바탕으로 구성했다.
아래 `>` 블록 전체를 그대로 speckit-run에 넣으면 된다.

```bash
sed -n '/^> 의도/,$p' specs/009-tenant-admin-customization/next-prompt.md | \
  .claude/skills/speckit-run/driver.sh new --short-name tenant-terminology-policy --prompt-file -
```

---

> 의도 (why & value)
uEngine PAL은 도입 테넌트마다 업무 용어·분류 체계·운영 정책이 다른데, 지금은 제품 고유 용어(도메인/메가/메이저/서브, 0~4단계, 설계·구축·감시·제어)와 특정 고객사 전용 값(Access/Core/IP/유선/설비/공통 도메인, 망종류·제조사)이 코드에 하드코딩되어 있어 다른 업종 테넌트가 자사 체계대로 쓸 수 없다. 특히 카드 보기 분류는 업종이 다르면 프로세스가 전부 '공통' 한 열로 몰리거나 "고객관리·재고관리·품질관리"가 모두 '제어'로 오분류되고, 도메인 추론 시드가 "설비관리·공통구매" 같은 이름에서 통신사 도메인을 만들어내 DB에 굳어버린다. 또 매뉴얼이 "병합 요청함은 사이드바에 메뉴가 없으니 주소를 즐겨찾기해 두세요"(30·31장)라고 안내할 만큼 메뉴 구성 자유도가 부족하다. 009에서 만든 테넌트 설정 기반(configuration KV + 메뉴 관리) 위에, 각 테넌트 관리자가 용어·분류축·운영 정책값을 스스로 정의할 수 있게 확장한다.

> 인수조건 (Definition of Done)
- 변경(추가) 된 기능 목록 (아래 6가지 포함)
  1. **사용자 정의 메뉴 항목** — 메뉴 관리(/admin-console/menu-settings)에서 임의 경로·외부 URL 메뉴를 추가/수정/삭제. `/merge-requests`, `/my-inbox`처럼 메뉴가 없던 화면을 관리자가 직접 사이드바에 올릴 수 있다.
  2. **용어 사용자화** — 계층 레벨명(도메인/메가/메이저/서브)과 진행 단계명·색상(0~4단계 + 차세대 기획 중/폐기 예정)을 테넌트가 변경. 런타임 i18n 메시지 오버라이드 경로를 신설하고, 흩어진 중복 용어 키와 한글 리터럴 fallback을 단일 키로 정리한다.
  3. **프로세스 분류축(카드 보기 열) 사용자화** — 열 key/라벨/색/아이콘/매칭 키워드를 테넌트가 정의하고, 미매칭 시 폴백 열을 지정. 열 이동 시 proc_map에 한글 라벨 대신 key를 기록하도록 바꾸고 기존 데이터를 마이그레이션한다. ID 코드 기반 단계 추론은 설정으로 끌 수 있어야 한다.
  4. **도메인 추론 시드 제거** — 고정 6개 시드 기반 추론을 테넌트 도메인 목록 기반으로 교체하고 추론 on/off 설정 제공. 잘못 추론돼 이미 저장된 도메인을 관리자가 검토·정리할 수 있어야 한다.
  5. **운영 정책값 설정** — 공람 기간·D-7 경보·정체 기준 일수, 휴지통 보존 일수, FTE/원가 기준(연간 근무시간 2080, 주기 환산 계수, 연간 인건비 단가, 통화)을 보안 설정(33장)과 같은 방식의 관리자 화면에서 조정.
  6. **역할 표시 라벨 테넌트화** — 5개 역할의 표시명·설명을 테넌트가 변경(역할 추가/삭제는 범위 밖).
- 동반 수정 (사용자화의 전제라 필수)
  - 체계도 D-day가 DB의 `public_feedback_ends_at`을 읽지 않고 30일을 재계산하는 불일치 — 관리자가 건별 공람 기간을 조정해도 체계도에 반영되지 않는다.
  - 휴지통 영구삭제가 클라이언트에서만 실행되어, 관리자가 휴지통 화면을 열지 않으면 만료 항목이 영구히 남는 문제 — 감사 로그 보관 정책과 동일한 서버측 스케줄 정리로 이전.
- 해당 기능에 대한 사용자 가이드(docs/manuals/) 및 변경 감사 로그 기록
- 회귀 없음: 비 PAL 동작 불변, vue-tsc·빌드·유닛 테스트 통과

> 범위 밖 (규모가 커 별도 스펙 권장)
- **DMN 라우팅 룰 스키마 + 내부조직역할 관리 화면** — 조건 5열(역할/도메인/지역/망종류/제조사)·결과 2열이 코드 고정이고, `/admin-console/suppliers` 라우트가 아예 없어 메뉴 클릭 시 404다. business rule이 localStorage에 저장돼 테넌트 격리도 없다. 화면 이관·DB 이전이 선행돼야 한다.
- **PID 체계 사용자화** — 프리픽스형(`MAJ-001`)과 점 계층형(`부모.n`) 두 체계가 공존·비호환이라 통합이 선행 과제.
- **커스텀 역할 추가** — DB CHECK 3곳과 RLS `has_role_at_least()` 레벨 매핑에 5개 역할이 박혀 있어 파급이 크다.
- 정책문서 허용 형식/카테고리, 조직도 부서 커스텀 속성, 사용 활성도 집계 기간(7일 고정).

> 컨텍스트 (참고자료 위치)
- 매뉴얼: @docs/PI_System_통합_사용자_매뉴얼.docx
  - 1장 — 계층 구조(도메인/메가/메이저/서브), 단계별 집계 바(0~4단계), 카드 보기 4열(설계·구축·감시·제어)
  - 5장 7·9절 — 소요시간·비용, FTE 계산기
  - 17장 5절 — DMN 라우팅 룰(망종류·제조사)
  - 23장 — 휴지통 "남은 일수"
  - 30·31장 — 사이드바에 메뉴가 없는 화면 안내
  - 33·35장 — 이미 테넌트화된 선례(보안 설정 5종, 분석 대시보드 탭 구성)
- 직전 스펙: specs/009-tenant-admin-customization/ (도메인 관리·미분류 정리·메뉴 관리)
- 재사용할 패턴: configuration 테넌트 KV — src/services/menuSettingsService.ts, src/services/dashboardSettingsService.ts, 보안 설정(SecuritySettings.vue + stores/adminConsole.ts의 fetch/save + writeAdminAuditLog), 선택지 목록(option_list + OptionListManagement.vue)
- 하드코딩 위치(검증 완료)
  - 계층 용어: src/utils/locales/ko.json(중복 키 6개 네임스페이스), ProcessArchHierarchyView.vue(범례 + 한글 fallback), ProcessArchMatrixView.vue:22, ProcessArchTreeView.vue:117, composables/ontologyNew/layerMapping.ts:151-152, utils/dataFreeze.ts:221-222
  - 진행 단계: src/utils/processStages.ts:29-80(STAGE_DEFS), ProgressBadge.vue:166-176(wip/sunset 별도), locales progressBadge.*(경쟁 라벨), 색상 3중 정의(TS hex / ExecutiveSummary.vue CSS / ProcessArchHierarchyView.vue CSS 변수)
  - 분류축: src/views/process-architecture/processClassification.ts:3-27, ProcessArchCardView.vue:270-305(COLUMN_DEFS 중복) 및 :244-326(localStorage 열 이름), processMapMove.ts:105-112·167-170(한글 라벨을 proc_map에 기록)
  - 도메인 시드: useProcessArchitecture.ts:16(DOMAIN_SORT_ORDER), :263(knownDomainSeed), processClassification.ts:170(한글 부분 문자열 매칭)
  - 정책값: ProcessGPTBackend.ts:10986·11001(공람 30일), useProcessArchitecture.ts:653-664(D-day 재계산), stores/reviewBoard.ts:120-126(D-7), RecycleBin.vue:221·462 + stores/adminConsole.ts(보존 30일 8곳), ProcessHierarchyProperties.vue:4406(2080시간)·4453·4472(환산 계수)·4793(빈도 주기), composables/blueprint/blueprintModel.ts:18(인건비 단가)
  - 역할 라벨: src/utils/roles.ts:33-69(ROLE_META)
- 런타임 i18n: src/main.ts:193-197 createI18n — `mergeLocaleMessage` 호출이 코드베이스에 0건이라 오버라이드 경로 신설이 필요
