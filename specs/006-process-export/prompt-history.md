# Prompt History — 006-process-export

작업이력: 이 스펙에 대해 사용자가 입력한 프롬프트가 시간순으로 수집됩니다.

## Prompt — 2026-09-16T06:31:47+00:00

```text
# 프로세스 순서도 내보내기 기능
## 목적
현재는 이미지로만 내보낼 수 있는데, 내보내기 기능(export)기능을 강화하여 bpmn파일로 내보내거나, pdf 파일로 내보낸다.

## output 형태
이미지 - 현행대로.
bpmn - xml로. (가져오기 가능하도록)
pdf - 전체 프로세스를 내보낸다. 프로세스 설정, Task 설정을 내보내고 우선 전체 프로세스를 이미지로 보여주고, 프로세스 설정을 보여준 후, 각 Lane, Task에 설정 된 내용을 보여준다. 통합 RACI등 현재 프로세스 순서도 화면에서 유저가 입력 또는 설정 할 수 있는 데이터들을 정리하여 PDF로 내보내면 됨.
```

## Prompt — 2026-09-16T06:32:09+00:00

```text
PiFlagTypeManager도 같이 고쳐줘
```

## Prompt — 2026-09-16T06:33:23+00:00

```text
admin-console/task-catalog의 내부 카탈로그 목록이 너무 붙어있음.
```

## Prompt — 2026-09-16T06:33:34+00:00

```text
admin-console/task-catalog의 내부 카탈로그 목록이 너무 붙어있고, 카드 사이즈가 통일되어있지않음.
```

## Prompt — 2026-09-16T06:37:48+00:00

```text
<task-notification>
<task-id>a52ec126560e7b97d</task-id>
<tool-use-id>toolu_0123ZNvM1qpQggFcYbrGWZJ8</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/1a4523e5-187a-4da7-b19d-dbbe3015b147/tasks/a52ec126560e7b97d.output</output-file>
<status>completed</status>
<summary>Agent "Explore BPMN export code" finished</summary>
<note>A task-notification fires each time this agent stops with no live background children of its own. The user can send it another message and resume it, so the same task-id may notify more than once.</note>
<result>조사를 마쳤습니다. 항목별로 정리합니다.

---

## 1. 현재 이미지 내보내기 구현 위치

**핵심 공통 유틸: `/home/kimsanghoon/process-gpt-vue3/src/composables/useBpmnExport.ts`**
- `capturePng(options)` (L28-112) — **bpmn-js `saveSVG()` 방식**. 흐름:
  1. `await bpmnViewer.saveSVG()` (L38)
  2. `DOMParser`로 SVG의 `viewBox` 파싱해 크기 추출 (L41-47)
  3. `document.createElement('canvas')` 생성, `scale=2`, `titleHeight=50`, `padding=20` (L49-57)
  4. 흰 배경 → 프로세스명 텍스트(`bold 24*2px Arial`) → 구분선 그리기 (L65-81)
  5. SVG를 Blob→ObjectURL→`Image`로 로드 후 `ctx.drawImage`, `canvas.toDataURL('image/png')` → `&lt;a download="${processName}.png"&gt;` 클릭 (L83-108)
- `openPdfPreview()` / `closePdfPreview()` (L117-130)는 `isPreviewPDFDialog` ref만 토글 — **실제 PDF 생성은 이 파일에 없음**.

**호출처 3곳(모두 `bpmnVue.bpmnViewer` 인스턴스를 넘김):**
- `/home/kimsanghoon/process-gpt-vue3/src/views/process-hierarchy/ProcessHierarchyDesigner.vue:1807-1819` — **PAL 순서도 화면** (`this.$refs.bpmnVue.bpmnViewer`, `processName`)
- `/home/kimsanghoon/process-gpt-vue3/src/components/ProcessDefinitionChat.vue:2534-2549` — `$refs.definitionComponent.$refs.bpmnVue.bpmnViewer`
- `/home/kimsanghoon/process-gpt-vue3/src/components/apps/definition-map/SubProcessDetail.vue:430-445`

**레거시/보조 이미지 코드**
- `/home/kimsanghoon/process-gpt-vue3/src/components/designer/ModelerImageGenerator.vue` — `canvas._RENDERER.getRootElement()` + `XMLSerializer` + localStorage 저장(구형, 현재 designer 경로에서 미사용으로 보임)
- `/home/kimsanghoon/process-gpt-vue3/src/views/process-architecture/ProcessArchitecture.vue:1770-1849` — `dom-to-image`의 `toPng` + 워터마크(`Process GPT`, `Exported: &lt;KST&gt;`) → PNG, 또는 동적 `import('jspdf')`로 PDF. 체계도(아키텍처) 화면 전용이지만 **워터마크/타임스탬프 패턴은 재사용 가치 있음**.

---

## 2. BPMN 모델러 컴포넌트 구조

**`/home/kimsanghoon/process-gpt-vue3/src/components/BpmnUengine.vue` (3485줄)** — 실제 모델러 래퍼
- `import BpmnModeler from 'bpmn-js/lib/Modeler'` (L76), `BpmnViewer from 'bpmn-js/lib/Viewer'` (L77)
- 인스턴스 생성: `self.bpmnViewer = markRaw(new BpmnModeler(viewerOptions))` (L2138, L2171)
- `saveXML({format:true, preamble:true})` 호출: L246, L1563, L1837
- `importXML(xml)` 호출: L350, L459 — L414/L435/L1574에 **무한 re-import 루프 방지** 주석 있음(주의)
- PDF 다이얼로그 내장: `&lt;v-dialog v-model="isPreviewPDFDialog"&gt;` + `&lt;PDFPreviewer :bpmnViewer="bpmnViewer" @closeDialog="closePDFDialog"/&gt;` (L60-63), import는 `BPMNPDFPreviewer.vue` (L92), prop `isPreviewPDFDialog` (L175), watch (L535)
- PAL 분기: `isPal()` computed (L260), 사용처 L1708/L1717/L1737(요소 클릭 시 패널 오픈 억제), L2924(`_palCtxMenuBound` 우클릭 컨텍스트 메뉴)

**모델러 인스턴스 전역 접근: `/home/kimsanghoon/process-gpt-vue3/src/stores/bpmn.ts`**
- pinia store `useBpmnStore`, state `bpmnModeler`, getter `getModeler` (파일 끝), action `setModeler`. 또한 `processDefinition`, `runningActivityIds`, `completedActivityIds`, `piFlagFocus` 보유.
- → **export 기능에서 모델러가 필요하면 `useBpmnStore().getModeler`로 어디서든 접근 가능** (RaciMatrixDialog가 이 방식 사용).

**XML import(가져오기) — 이미 PAL 디자이너에 존재**
`/home/kimsanghoon/process-gpt-vue3/src/views/process-hierarchy/ProcessHierarchyDesigner.vue`
- 툴바 "가져오기" 버튼 L279-292 (`mdi-upload`, `@click="triggerBpmnUpload"`, `:disabled="!processNameText || isViewMode"`)
- `getCurrentXml()` L1843-1853 — `useBpmnStore().getModeler` → `saveXML({format:true, preamble:true})`
- `openXmlDialog()` L1855-1860 — XML 보기/수정 다이얼로그
- `triggerBpmnUpload()` L1862-1865 → `$refs.xmlFileInput.click()`
- `validateBpmnXml(xml)` L1867-1878 — DOMParser로 `parsererror` 검사 + 루트가 `definitions`인지 검사
- `applyXmlToCanvas(xml)` L1880-1899 — toBe 모드면 `toBeBlueprintXml` + `bpmnKey++`, 아니면 `$emit('replaceXml', xml)`
- `handleBpmnFileChange(event)` L1901-1925 — `file.text()` → `applyXmlToCanvas`, 에러별 한국어 메시지

&gt; **BPMN 내보내기(.bpmn 다운로드)는 아직 없음.** `getCurrentXml()`이 이미 있으므로 Blob 다운로드만 붙이면 됨. 가져오기는 이미 완비.

**기타 저장 경로**
- `ProcessHierarchy.vue:3104-3130` `handleSave()` — `modeler.saveXML` → `pendingSaveXml`, 버전/승인 상태 체크 후 저장
- `ProcessHierarchy.vue:3233-3250` `handleSaveToBe()` — To-Be는 `definition.tobe_bpmn`에 저장
- Designer 내 추가 `saveXML` 호출: L3571, L4021

---

## 3. 프로세스 설정 / Task 설정 데이터 구조

### 3-1. 저장 위치는 크게 3군데

**(a) BPMN XML 확장 속성 — `uengine:Properties` JSON**
`/home/kimsanghoon/process-gpt-vue3/src/utils/bpmnUengineProperties.js` (⚠ `.ts` 아님)
- `readUengineProperties(businessObject)` L5-15 — `bo.extensionElements.values`에서 `$type === 'uengine:Properties'` 찾아 `JSON.parse(propsEl.json)`
- `writeUengineProperties(modeler, shapeOrId, updates)` L19-47 — 기존 JSON에 merge 후 `bpmnFactory.create('uengine:Properties', {json, variables})` → `bpmn:ExtensionElements` 재생성 → `modeling.updateProperties`. 기존 `variables`(customProperties)와 다른 extensionElements는 보존.
- `getLaneTaskShapes(modeler, laneBO)` L52-63 — `lane.flowNodeRef`(bpmn-js가 지오메트리로 자동 유지)로 레인 소속 태스크 조회. **PDF에서 Lane별 Task 그룹핑에 바로 쓸 수 있음.**

사용처: `RaciMatrixDialog.vue:79,137,234`, `GPTLanePanel.vue:83,335`, `BpmnPropertyPanel.vue:159,565`, `bpmnCallActivityDefinitionSync.js:9`, `projectMappingsApi.ts:34`.
`ProcessHierarchyProperties.vue`는 유틸을 import하지 않고 **동일 로직을 인라인으로 반복** (L6424, 6467, 6688, 6757, 8842, 9726, 9824-9843, 9872-9897, 9915-9935, 10076-10093, 10114-10130 등).

**(b) Supabase `proc_def` 테이블 / `definition` JSON**
- `ProcessHierarchyProperties.vue` 내 `.from('proc_def')` — L7779, 7802, 11255, 11359, 11446, 11502
- 공개 범위: `proc_def.visibility` / `proc_def.allowed_org_codes` (L439-440 주석, L4696)
- 검토의견/결재: `proc_def_comments` (L8951-8953, 9097, 9140, 9366, 9456, 9496), `proc_def_approval_history` (L9261)
- 용어 정의: `glossary_terms` 테이블에 즉시 저장, `/glossary` 통합 사전과 연동 (L648-700)
- `processDefinition.definition` JSON 안에 `activities[]`, `meta.owners`, `ai_copilot`, `tobe_bpmn`, `type` 등 (`ProcessHierarchy.vue:992, 1000, 1119-1151, 8398`)

**(c) Pinia store** — `useBpmnStore` (모델러 + processDefinition + 실행 상태)

### 3-2. 필드 레지스트리 (PDF 목차의 사실상 정답지)

**`/home/kimsanghoon/process-gpt-vue3/src/components/designer/bpmnModeling/bpmn/panel/builtinPanelProperties.ts` (154줄)**
`BUILTIN_PANEL_PROPERTIES: BuiltinPanelProperty[]` — 각 항목이 `{taskType, key, labelKo, labelI18n, propertyType, widget, binding, tab, panel, displayOrder, description, config, autoSeed}`.
파일 상단 주석(L1-15)에 **"실사용 속성패널은 `ProcessHierarchyProperties.vue`이고, bpmnModeling 하위 GPT/uEngine 패널 스택은 실행 경로에 없다"**고 명시 — PDF는 이 레지스트리 + ProcessHierarchyProperties 기준으로 만들면 됨.

스코프별 전체 목록:
- **`process` 탭** (L55-68): `owner`(담당자 dialog), `parent_hierarchy`(Domain/Mega/Major), `title`, `description`, `manual_links`, `api_integrations_summary`, `system_list`, `related_project_list`, `total_duration`, `total_cost`, `task_count`, `glossary`(PAL 전용, order 55)
- **`pi-flag` 탭** (L73-74): `pi_flag_tab`, `pi_flag_agent_chat`
- **`governance` 탭** (L79-81): `governance_tab`, `review_guide`, `release_strategy`
- **`task` 공통** (L86-101): `element_id`, `name`, `description`, `form_link`, **`raci`**(dialog, binding `taskForm.raci`), **`task_io`**(labelI18n `taskIo.tab`, binding `taskForm.procedure`), `manual_links`, `api_integrations`, `data_io`, `fte_calculator`, `opex`, `system_mapping`, `related_project_mapping`, `pi_flag`, `task_catalog`(PAL 전용)
- **`bpmn:SequenceFlow`** (L106-109): `name`, `flow_type`, `condition_expression`, `condition_llm_mode`
- **`bpmn:Participant`** (L112-113): `exec_pool`, **`ppi`**(dialog)
- **`bpmn:Lane`** (L116-118): `name`, `description`(AI 생성 버튼 포함), `lane_assignment`(binding `laneResourceType/laneAssignee/laneOrganization/laneSupplier/laneRoleGroupSelectedList`)
- **`bpmn:CallActivity`** (L121): `definition_link`
- **`bpmn:BusinessRuleTask`** (L124): `dmn_rule`
- **`bpmn:SendTask`** (L127-129): `mail_recipients`, `mail_title`, `mail_contents`
- **`bpmn:DataObjectReference`** (L132-152): `attachment` (Supabase Storage `files` 버킷)

노출 제어: `/home/kimsanghoon/process-gpt-vue3/src/components/designer/bpmnModeling/bpmn/panel/builtinPanelVisibilityMixin.ts:27-31` → `useTaskCatalogStore().isBuiltinPropVisible(taskType, key)`. `ProcessHierarchyProperties.vue`는 `isBuiltinPropVisible('process','glossary')`(L651), `('task','task_catalog')`(L1286) 식으로 사용. **PDF도 이 가시성 규칙을 따라야 관리자가 숨긴 필드가 새지 않음.**

### 3-3. 폼 데이터 shape (`ProcessHierarchyProperties.vue`)

- `processForm` L4683-4699: `title, description, owner, systems[], fte, futureState('as_is'), wilTask, fteHoursPerMonth, hitlRequired, manualLinks[], kpiEnabled, ppi, visibility, allowedOrgs[]`
- `taskForm` L4704-4726: `name, description, raci, procedure, ppi, manualLinks[], systems[], fte, futureStatus('maintain'), relatedProjects[], opexCost, opexUnit('건당'), opexNote, schemaProps{}, dataAttachmentUrl, dataAttachmentFile, apiIntegrations[], conditionExpression, flowType('sequence'), conditionLlmMode`
- 그 외 상태 L4760-4800: `callActivityDefinitionId(s)`, `taskFormLinkId`(uengine json `tool` = `formHandler:&lt;form_def.id&gt;`), `businessRuleId`, `taskDataInputs/taskDataOutputs`(dataInput/OutputAssociation, 조회 전용), `sendTaskRecipients/sendTaskMailTitle/sendTaskMailContents`, `laneOrgDmnModel`, `multiTaskMappingForm`
- 별도 `taskForm` 정의가 L7018에도 있음(주의 — 중복/리셋용으로 보임)

### 3-4. 통합 RACI 뷰 — **이미 존재**

**`/home/kimsanghoon/process-gpt-vue3/src/components/designer/RaciMatrixDialog.vue` (322줄)** — PDF에 그대로 재사용할 수 있는 최적 소스
- 툴바 진입: `ProcessHierarchyDesigner.vue:242-249` "RACI" 버튼(`mdi-table-account`) → `isViewRaciMatrix = true`; 다이얼로그 L588-589, import L1121, watch L1585, data L1276
- `RACI_KEYS = ['R','A','S','C','I']` (L81), 범례 `R=책임(수행) · A=승인 · S=지원 · C=자문 · I=통보` (L6)
- `build()` L114-169 — `elementRegistry.getAll()` → Lane의 `flowNodeRef`로 `laneByTaskId` 매핑 → `el.type.includes('Task')` 필터 → `readUengineProperties(el.businessObject)`로 `{id, name, taskCode, laneName, raci, x, y}` 행 생성. **정렬: 모든 태스크에 `taskCode`가 있으면 `localeCompare(numeric)`, 아니면 `x → y` 좌표순** (L150-156). 열(orgs)은 raci에 등장하는 조직명을 등장 순서대로 (L159-168)
- `normalizeRaci` L170-179, `cellLetters/cellValue/cellClass` L180-189
- `persistRow` L225-243 — `writeUengineProperties(modeler, row.id, {raci})` + `processDefinition.activities` 동기화 + `$emit('changed')`
- props: `modelValue, isViewMode, processDefinition`; 셀 색상 CSS L298-321 (R=#c62828, A=#283593, S=#2e7d32, C=#e65100, I=#616161, multi=#6a1b9a)

&gt; **`build()` 로직을 그대로 추출해 PDF의 통합 RACI 표에 재사용 권장.**

### 3-5. 개별 필드 컴포넌트 (dialog / readonly 모드 이미 지원)

- `/home/kimsanghoon/process-gpt-vue3/src/components/designer/RaciField.vue` (226줄) — `dialogMode`(PAL 패널: 요약만 표시 + "RACI 편집" 버튼) vs 인라인(비 PAL). `rows`는 R/A/S/C/I, 값은 `string[]`. 빈 값이면 `null` emit.
- `/home/kimsanghoon/process-gpt-vue3/src/components/designer/TaskIoField.vue` (284줄) — `readonly || dialogMode`일 때 **문서형 카드 뷰**(L1-20; 번호 매긴 `&lt;ol&gt;` 스타일). `sections()` L141-152: 단일 섹션 `{key:'procedure', icon:'mdi-format-list-numbered', ordered:true, label:'업무 수행 절차'}`. 값은 `string[]`, 전부 비면 `null` emit (RaciField와 동일 규칙, L196 주석).
- `/home/kimsanghoon/process-gpt-vue3/src/components/designer/PpiField.vue` — `readonly`일 때 **성과지표 v-table**(지표명/단위/측정주기/운영정의/산출식) 렌더. `showHeader` prop으로 PAL 패널에선 헤더 끔.
- 그 외: `CheckpointsField.vue`, `DescriptionField.vue`, `InstructionField.vue`, `KeyValueField.vue`, `MandatoryRuleChecklist.vue`, `TaskCatalogSection.vue`

&gt; **`readonly` 모드가 이미 세 필드 모두에 있어 PDF 프리뷰 DOM을 이 컴포넌트로 조립 가능** → html2canvas/html-to-image 캡처 방식과 잘 맞음.

---

## 4. PDF 관련 기존 의존성 및 코드

**`package.json` dependencies (있는 것):**
- `jspdf: ^2.5.1` (L114, devDeps L207에도 중복)
- `html2pdf.js: ^0.10.3` (L107)
- `html2canvas-pro: ^1.5.8` (L106) — ⚠ 원본 `html2canvas`는 **없음**
- `html-to-image` (BPMNPDFPreviewer가 `toPng` import — package.json 해당 라인은 위 grep 범위 밖이나 실제 import 존재)
- `dom-to-image: ^2.6.0` (L93)
- `file-saver: ^2.0.5` (L101)
- `docx: ^8.0.0` (L92), `exceljs: ^4.4.0`
- **없음: `pdfmake`, `pdf-lib`**

**기존 PDF 생성 코드:**

1. **`/home/kimsanghoon/process-gpt-vue3/src/components/BPMNPDFPreviewer.vue` (221줄) — BPMN 전용, 가장 관련 높음**
   - `import { jsPDF } from 'jspdf'` (L37), `import { toPng } from 'html-to-image'` (L38)
   - props: `bpmnViewer` (required)
   - `previewSVG()` L67-146 (mounted에서 호출) — `saveSVG()` → viewBox 파싱 → `elementRegistry.filter(el =&gt; el.type === 'bpmn:Participant')`의 `participants[0].di.isHorizontal`로 **다이어그램 방향 판정** (L88-96) → `baseWidth=1920/baseHeight=1200`, 가로/세로에 따라 crop 크기 스왑 (L99-102) → 페이지 그리드 분할 (L114-118) → 각 페이지를 `viewBox` 조정한 SVG clone으로 `#svgPreviews`에 렌더 (L120-141)
   - `savePDF()` L147-213 — `bpmnViewer._definitions.name`을 파일명으로, `new jsPDF(isHorizontal ? 'l' : 'p', 'mm', 'a4')` (L159), 페이지별 `toPng(pageDiv, {pixelRatio:2, cacheBust:true, backgroundColor:'white'})` → aspect 비교 후 중앙 정렬 `addImage` (L189-206), `this.progress` 진행률 표시 → `pdf.save(`${name}.pdf`)`
   - i18n 키: `PDFPreviewer.saveDocument`, `PDFPreviewer.close`, `PDFPreviewer.savingPDF`, `PDFPreviewer.title`
   - ⚠ **한계: BPMN 다이어그램만 페이지 분할해서 넣음. 프로세스/Task 설정 데이터는 전혀 포함 안 됨** → 이번 작업의 확장 지점.

2. `/home/kimsanghoon/process-gpt-vue3/src/components/PDFPreviewer.vue` — `jsPDF` (L30), 범용(HTML 문서용)
3. `/home/kimsanghoon/process-gpt-vue3/src/views/process-architecture/ProcessArchitecture.vue:1770-1849` — `dom-to-image` + 동적 `import('jspdf')`, PNG/PDF/XLSX(ExcelJS)/JSON/Mermaid 5종 export (L1740-1770). jsPDF 로드 실패 시 새 창에 `&lt;img&gt;` 폴백.
4. `/home/kimsanghoon/process-gpt-vue3/src/views/markdown/PdfExportHelper.vue:169-170` — 실제로는 `docx`의 `Packer.toBlob` + `saveAs` (Word)
5. `/home/kimsanghoon/process-gpt-vue3/src/views/markdown/WordExportHelper.vue:34` — `docx`

**i18n 파일 위치:** `/home/kimsanghoon/process-gpt-vue3/src/utils/locales/ko.json`, `en.json`

---

## 5. 내보내기 UI 진입점

### (A) PAL 순서도 화면 — `ProcessHierarchyDesigner.vue` 툴바 (**이번 작업의 주 타깃**)
`/home/kimsanghoon/process-gpt-vue3/src/views/process-hierarchy/ProcessHierarchyDesigner.vue` L234-358, 모두 `:disabled="!processNameText"` 패턴:

| 라인 | 버튼 | 아이콘 | 액션 |
|---|---|---|---|
| L236-239 | 검증 | `mdi-check-circle-outline` | `handleValidate` |
| L244-247 | RACI | `mdi-table-account` | `isViewRaciMatrix = true` |
| L256-259 | Rule (`v-if="isPal"`) | `mdi-clipboard-check-outline` | `openRuleOverview` |
| L264-267 | XML | `mdi-code-tags` | `openXmlDialog` |
| — L270 `&lt;v-divider vertical class="mx-1"/&gt;` — | | | |
| **L271-278** | **이미지** | **`mdi-image-outline`** | **`capturePng`** ← **여기에 내보내기 메뉴 추가** |
| L279-292 | 가져오기 | `mdi-upload` | `triggerBpmnUpload` (`+ :disabled="... \|\| isViewMode"`) |
| L293-307 | AI 생성 (`v-if="aiCopilotEnabled"`) | `mdi-auto-fix` | `openGenDialog` |
| — L308 divider — | | | |
| L309-323 | 삭제 | `mdi-delete-outline` | `$emit('delete')` (`!isAdmin` 비활성) |
| L324-344 | 복제 | `mdi-content-copy` | `$emit('clone')` |
| L345-358 | 저장 | `mdi-content-save` (flat/primary) | `$emit('save')` |

→ 툴팁 텍스트: `"현재 다이어그램을 이미지(PNG)로 저장합니다"` (L271). **이 화면엔 PDF 버튼이 없음** (`isPreviewPDFDialog`도 전달 안 함).

### (B) 비 PAL 정의 화면 — `ProcessDefinitionChatHeader.vue`
`/home/kimsanghoon/process-gpt-vue3/src/components/ProcessDefinitionChatHeader.vue`
- L90 `&lt;div class="mr-0 d-flex" v-if="Pal"&gt;` → L92-105 **PDF 저장 버튼** (`mdi-file-pdf-box`, `@click="savePDF"`, 툴팁 `$t('processDefinition.savePDF')`). 메서드 `savePDF()` L550-551 → `$emit('savePDF')`
- L107-125+ BPMN 가져오기 메뉴 (`Icons upload`, `v-if="fullPath != 'definition-map'"`, `$t('chat.importMenu')`)
- L303-320 컴포넌트 내보내기(.zip), `exportComponent()` L559-560
- ⚠ **이 헤더에는 `capturePng` 버튼/emit이 없음** (부모는 `@capturePng` 리스너를 붙였지만 emit 소스가 없음 — 죽은 배선으로 보임)
- `Pal()` computed L406-408: `return window.$pal`

### (C) 배선 체인 (PDF)
`ProcessDefinitionChatHeader` `@savePDF` → `ProcessDefinitionChat.vue:279,334` → `savePDF()` L2530-2533 (`isPreviewPDFDialog` false→true 토글) → `:isPreviewPDFDialog` prop L66 / `@closePDFDialog` L69 → `ProcessDefinition.vue:41,45,456,1524` → `BpmnUengine.vue:60-63` `&lt;v-dialog max-width="1160px"&gt;` + `&lt;PDFPreviewer :bpmnViewer&gt;` → `BPMNPDFPreviewer.vue`
`SubProcessDetail.vue:446-449`도 동일한 `savePDF()` 토글 패턴.

---

## 6. PAL 모드 분기

### 플래그 정의: `/home/kimsanghoon/process-gpt-vue3/src/palMode.ts` (13줄, 전문)
```ts
const runtimePalMode = (window as any)._env_?.VITE_PAL_MODE;
const buildPalMode = import.meta.env.VITE_PAL_MODE;
const enabled = runtimePalMode === true || runtimePalMode === 'true' || buildPalMode === 'true';
Object.defineProperty(window, '$pal', { value: enabled, writable: false, configurable: false });
```
- `main.ts:8`에서 `import './palMode'` — **라우터가 모드별 화면을 구성하기 전에 먼저 평가되어야 함**(L1-2 주석)
- 런타임(`window._env_.VITE_PAL_MODE`) 또는 빌드타임(`import.meta.env.VITE_PAL_MODE`) 둘 다 지원. `writable:false, configurable:false`라 **테스트에서 재정의 불가** (주의)

### 사용 패턴 3가지
1. **Options API computed** (가장 흔함): `isPal() { return !!window.$pal; }`
   - `ProcessHierarchyDesigner.vue:1328-1330`, `BpmnUengine.vue:260`, `BpmnUengineViewer.vue:249`, `ProcessDefinitionChatHeader.vue:406` (`Pal()`), `ProcessHierarchyProperties.vue:4863` (`isPalMode()`), `AccountSettings.vue:451`, `ExtraBox.vue:56`
2. **Composition computed**: `const isPalMode = computed(() =&gt; !!(window as any).$pal)` — `FullLayout.vue:39`, `ProcessArchitecture.vue:689`
3. **모듈 최상위 상수**: `const isPalMode = !!(window as any).$pal` — `AdminConsoleLayout.vue:27`
4. **템플릿 직접 참조**: `NotificationDD.vue:79` `isPal: !!window.$pal`

### 라우터 분기: `/home/kimsanghoon/process-gpt-vue3/src/router/index.ts`
- L166-176: PAL 점검 모드 — `if (window.$pal)` 시 admin 아닌 사용자를 점검 안내 화면으로
- L178-182: `if (window.$pal &amp;&amp; to.path === '/')` — PAL 루트는 랜딩 대신 인증 상태별 시작 화면

`/home/kimsanghoon/process-gpt-vue3/src/router/MainRoutes.ts`
- L449-452: `/process-hierarchy` → `ProcessHierarchy.vue` (**PAL/비PAL 공통 등록**)
- **L453 `...(window.$pal ? [ ... ] : [])`** — PAL 전용 라우트 스프레드 블록: `/process-hierarchy/process_management`(L457-458), `/analysis-dashboard`(L462-463), `/glossary`(L466-469, "통합 용어 사전") 등

### 디자이너 화면에서의 PAL 분기 실태
- **`/process-hierarchy` 라우트 자체는 PAL 전용이 아님** (L449-452은 조건 밖). 즉 `ProcessHierarchyDesigner.vue`는 비 PAL에서도 도달 가능 → **새 export 기능은 라우트가 아니라 `isPal` computed로 명시 게이팅해야 함**.
- 디자이너 내 `isPal` 실제 사용처는 단 2곳: 툴바 "Rule" 버튼 `v-if="isPal"` (L251), `mandatoryRuleChecklist = this.isPal ? collectMandatoryRuleChecklist(modeler) : []` (L4060)
- 속성패널 `ProcessHierarchyProperties.vue`는 `isPalMode` 게이팅이 훨씬 많음: L61(탭 클릭), L441, L651(glossary), L1286(task_catalog), L6960(`loadProcessVisibility`), L7050(catalogStore 로드), L7055, L11619
- `BpmnUengine.vue`: `isPal`일 때 요소 클릭 시 패널 자동 오픈 안 함(L1708-1737), PAL 전용 우클릭 컨텍스트 메뉴(L2924)
- CSS 클래스 분기도 사용: `BpmnUengine.vue:6` `:class="{'not-pal': !isPal}"`, `FullLayout.vue:92-105` `pal-main-no-header/pal-content-container/pal-page-shell/pal-page-frame`

### 기타 PAL 관련
- `PalModeBackend` — 백엔드 구현체 클래스명. 코드가 아닌 **주석에서만** 참조됨: `stores/adminConsole.ts:1691, 1756, 2126`, `utils/procDefVisibility.ts:15`, `services/activityAuditLog.ts:8`("PAL 모드 전용: 비 PAL 에서는 아무것도 하지 않는다"), `ProcessHierarchy.vue:954`. 실제 인스턴스는 `backend` 싱글턴으로 주입되는 구조.

---

## 기존 스펙 상태

`/home/kimsanghoon/process-gpt-vue3/specs/006-process-export/` 가 이미 생성되어 있습니다.
- `spec.md` — **템플릿 미채움 상태** (`[FEATURE NAME]`, `$ARGUMENTS` 그대로)
- `prompt-history.md` — 2026-09-16T06:31:47Z에 이번 요구사항 원문 기록됨: 이미지(현행 유지) / BPMN(XML, 가져오기 가능) / PDF(전체 프로세스 이미지 → 프로세스 설정 → 각 Lane·Task 설정 → 통합 RACI). 이후 3개 프롬프트는 무관한 작업(PiFlagTypeManager, task-catalog UI)이 섞여 있음.

---

## 구현 시 핵심 포인트 요약

1. **BPMN export는 가장 쉬움** — `ProcessHierarchyDesigner.vue`의 `getCurrentXml()` (L1843-1853)이 이미 있음. Blob + `&lt;a download&gt;` 또는 `file-saver`의 `saveAs`만 추가.
2. **PDF는 `BPMNPDFPreviewer.vue`를 베이스로 확장** — `isHorizontal` 방향 판정, jsPDF A4 + `html-to-image` `toPng(pixelRatio:2)`, 진행률 표시가 이미 검증됨. 여기에 (a) 프로세스 설정 섹션, (b) Lane/Task 설정 섹션, (c) 통합 RACI 표 페이지를 앞뒤로 추가하는 형태.
3. **데이터 수집 함수는 신규 필요** — `useBpmnStore().getModeler` → `elementRegistry.getAll()` → `readUengineProperties(bo)` 순회. `RaciMatrixDialog.build()` (L114-169)와 `getLaneTaskShapes()` 패턴 그대로 차용.
4. **가시성 규칙 준수** — `useTaskCatalogStore().isBuiltinPropVisible(taskType, key)`로 관리자가 숨긴 필드는 PDF에서도 제외.
5. **`readonly` 모드 컴포넌트 재사용 가능** — `TaskIoField`(문서형 카드), `PpiField`(v-table), `RaciField`로 프리뷰 DOM 조립 후 캡처.
6. **PAL 게이팅** — `/process-hierarchy` 라우트는 PAL 전용이 아니므로 신규 UI는 반드시 `isPal` computed(`!!window.$pal`)로 감쌀 것. 툴바 L271-278 "이미지" 버튼 자리를 `v-menu` 드롭다운(이미지/BPMN/PDF)으로 교체하는 것이 가장 자연스러움.
7. **`useBpmnExport.ts`는 `openPdfPreview/closePdfPreview`만 있고 PDF 생성 로직이 없음** — 확장 지점으로 적합.</result>
<usage><subagent_tokens>91693</subagent_tokens><tool_uses>63</tool_uses><duration_ms>345475</duration_ms></usage>
</task-notification>
```

## Prompt — 2026-09-16T06:38:30+00:00

```text
여기서 작업한 목록 대충 정리해봐.
```

## Prompt — 2026-09-16T06:39:08+00:00

```text
세션 아이디 뭐임? 문서쓰게할거야.
```

## Prompt — 2026-09-16T06:40:53+00:00

```text
/speckit-clarify
```

## Prompt — 2026-09-16T06:41:01+00:00

```text
/write-feature-manual 3679f9ac-6cd2-4028-8dd7-a77ef26cb9ee세션과 docs/task-catalog-*, docs/glossary-*을 참고해서 카탈로그 기능과 용어 사전 기능에 대한 메뉴얼 작성해.
```

## Prompt — 2026-09-16T06:44:29+00:00

```text
speckit-run: 006-process-export 구현 — 내보내기 메뉴(이미지/BPMN/PDF), processExportData 유틸, ProcessPdfExportDialog 신규
```

## Prompt — 2026-09-16T06:49:10+00:00

```text
<task-notification>
<task-id>bsr5y2cvs</task-id>
<tool-use-id>toolu_01LfgHaBWTsm66J5XEz2KS1S</tool-use-id>
<output-file>/tmp/claude-1001/-home-kimsanghoon-process-gpt-vue3/1a4523e5-187a-4da7-b19d-dbbe3015b147/tasks/bsr5y2cvs.output</output-file>
<status>completed</status>
<summary>Background command "Build the app to verify compilation" completed (exit code 0)</summary>
</task-notification>
```

## Note — 2026-09-16T06:49:17+00:00

```text
구현 완료: PAL 순서도 툴바에 내보내기 메뉴(이미지 PNG/BPMN XML/PDF) 추가 — BPMN은 .bpmn 다운로드(가져오기 호환), PDF는 다이어그램+프로세스 설정+Lane/Task 설정+통합 RACI 정의서 (ProcessPdfExportDialog.vue, processExportData.js 신규). vite build 통과.
```

## Note — 2026-09-16T06:54:19+00:00

```text
매뉴얼 작성: docs/manuals/process-export.md (스크린샷 6장: docs/manuals/images/process-export/)
```

## Prompt — 2026-09-16T07:07:53+00:00

```text
Task에 설정되는 요소들이 모두 나오는 형식이 아니라 RACI, 업무 수행 절차만 나오고있음. 모두 표시해야함.
```

## Note — 2026-09-16T07:25:46+00:00

```text
보완: PDF Task 설정 전체 항목 출력 — 입력물/산출물·데이터객체 입출력·폼 연결·연관 과제·Future Status·필수 Rule·메일 설정·연결 프로세스·커스텀 스키마 필드·Task 코드 추가, 커스텀 스키마 키(output 등) 중복 제거. 빌드 통과·스크린샷 재검증.
```

## Prompt — 2026-09-17T02:46:37+00:00

```text
/speckit-run @docs/PI_System_통합_사용자_매뉴얼.docx 해당 사용자 메뉴얼이 이전에 작성한 메뉴얼인데, 최근 추가된 기능이 많아 메뉴얼을 전체적으로 업데이트 하려함.
@docs/manuals/ 이외에 더 추가된 기능들 목록(RACI, 조직도 등)을 먼저 정리하고 각각 스크린샷을 포함한 메뉴얼을 markdown으로 작성해서 docx에도 업데이트해줘. 그리고 메뉴얼 스크린샷 찍을때는 항상 좌측 사이드바메뉴를 닫고 찍도록해.
```
