# Call Activity 인라인 드릴다운

`BpmnUengine.vue`의 CallActivity·StartEvent·EndEvent 이동 버튼은 읽기 모드에서 참조 BPMN을 현재 캔버스에 표시한다. 좌측 상단 카드에 모듈명, 돌아가기, 편집하기를 표시한다. 편집 모드의 이동 버튼과 카드의 편집하기는 참조 프로세스 편집 화면을 새 탭에서 연다.

## 구성

- `components/customDrilldown/CallActivityDrilldown.js`: 참조 해석, 임시 Viewer import, 표시용 Plane 복제, 중첩 탐색, 돌아가기 카드, 수명 관리.
- `components/customDrilldown/index.js`: 읽기·편집 Modeler에 등록하는 모듈.
- `components/customDrilldown/resolveLinkedProcessXml.js`: To-Be 우선 조회와 As-Is 폴백. PAL은 `definition.tobe_bpmn`도 지원한다.
- `components/customDrilldown/drilldownHistory.js`: SPA Router의 이력 처리와 캔버스 탐색을 분리한다.
- `assets/css/globalStyle.css`: `ca-drilldown*` 버튼·카드 스타일.

참조 ID는 `uengine:Properties.json.definitionId`를 우선하고, 없으면 `calledElement`를 사용한다. 마지막 `.bpmn`을 제거한다. 라벨에는 이동 버튼을 추가하지 않는다.

## 저장과 복귀

임시 Viewer에서 읽은 businessObject는 부모 definitions에 추가하지 않는다. 화면 요소에는 `<호출 요소 ID>::<자식 요소 ID>`, 대표 Plane에는 `<호출 요소 ID>_ca_plane`을 부여한다. 원본 도형, 연결선, 라벨, 레인 참조를 보존하며 자식 Plane에서는 Modeler 편집 규칙을 차단한다.

캔버스 복귀 시 부모의 확대 비율과 위치를 복원한다. XML 재import 또는 destroy 후 도착한 비동기 조회 결과는 폐기한다. destroy는 카드, popstate 리스너, History 소비자 등록을 해제한다.

History state는 Vue Router의 기존 필드를 보존하고 별도 `caDrilldown` 키에 세션·이력 항목·깊이를 저장한다. `src/router/index.ts`는 `withCallActivityHistory(createWebHistory(...))`를 사용한다. 이 래퍼는 살아 있는 드릴다운 세션에 속한 동일 URL 이력만 라우트 갱신에서 제외한다. URL이 달라지는 실제 화면 이동은 정상 처리한다. 돌아가기와 브라우저 앞/뒤 이동 모두 같은 Plane 이력을 사용한다.

## 검증

```sh
node --test e2e/process-editing/drilldown-resolver.test.mjs
npx playwright test --config playwright.process-editing.config.mjs
```

실제 bpmn-js Modeler와 Vue Router로 중첩 호출, 부모 XML 불변, 레인·라벨·연결선 복제, ID 충돌, 편집 모드, 실패 후 재시도, 재import·destroy 정리, 확대/위치 복원과 To-Be 폴백을 확인한다.
