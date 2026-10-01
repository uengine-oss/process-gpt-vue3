# bpmnAutoLayout — BPMN 선·도형 자동 배치 (독립 모듈)

BPMN 2.0 XML 의 `bpmndi`(도형 좌표·선 waypoint)를 버리고 **결정적 규칙**으로 다시 그린다.
LLM 이 만든 To-Be 도면처럼 "흐름은 맞는데 좌표가 엉망인" 도면을 레인별 좌→우, 직각 선, 겹침 없는 도면으로 정리하는 용도.

- 외부 의존성 **없음** (DOM/DOMParser 도 안 씀 — 문자열 토크나이저). 브라우저·Node 어디서나 동작.
- 이 폴더를 통째로 복사하면 다른 프로젝트에서 그대로 쓸 수 있다.

## 폴더 구성

| 파일 | 용도 |
|------|------|
| `bpmnAutoLayout.ts` | 구현 본체 (TypeScript 소스, 단일 파일) |
| `bpmnAutoLayout.test.js` | node:test 단위 테스트 12건 (js/esm 빌드 검사, `npm run test:unit`) |
| `index.ts` | re-export |
| `js/esm/bpmnAutoLayout.mjs` + `.d.ts` | TypeScript 없이 쓰는 곳용 ESM 빌드 |
| `js/cjs/bpmnAutoLayout.cjs` | CommonJS 빌드 (`require`) |
| `cli.mjs` | `node cli.mjs in.bpmn [out.bpmn \| --check]` — 파일에 적용하거나 겹침·대각선 통계만 출력 |
| `build.sh` | 소스를 고친 뒤 `js/` 재생성 (레포 루트의 `typescript` 사용) |

## 다른 곳으로 옮기기

1. **TypeScript 프로젝트**: `bpmnAutoLayout.ts`(+ spec) 만 복사해서 `import { autoLayoutBpmnXml } from './bpmnAutoLayout'`.
2. **JavaScript(Node) 프로젝트**: `js/esm/bpmnAutoLayout.mjs`(ESM) 또는 `js/cjs/bpmnAutoLayout.cjs`(CJS) 만 복사.
   ```js
   import { autoLayoutBpmnXml } from './bpmnAutoLayout.mjs';   // ESM
   const { autoLayoutBpmnXml } = require('./bpmnAutoLayout.cjs'); // CJS
   ```
3. 소스를 수정했으면 `./build.sh` 로 `js/` 를 다시 만든다.

이 레포 안에서는 `src/utils/bpmnAutoLayout.ts` 가 이 폴더를 re-export 하므로 기존 import 경로(`@/utils/bpmnAutoLayout`)는 그대로 동작한다.

## API

```ts
autoLayoutBpmnXml(xml: string, options?: { originX?: number; originY?: number }): {
    xml: string;        // bpmndi 가 교체된 XML (실패 시 원문 그대로)
    changed: boolean;   // false 면 warnings 에 이유
    warnings: string[];
}

computeBpmnLayout(xml, options?): { shapes, edges, planeElement, addedLaneRefs, warnings, model }
    // DI 문자열을 만들지 않고 좌표만 계산 — 테스트·통계·다른 렌더러용
    // shapes[i] = { id, type, x, y, w, h }, edges[i] = { id, points: [{x,y}...] }

isOrthogonalPath(points): boolean   // 모든 구간이 수평/수직인지 (검증용)
```

동작 원칙: **파싱 실패·요소 없음이면 절대 던지지 않고 원문을 돌려준다** (`changed: false`). 호출 측은 결과를 BPMN 검증기에 다시 통과시키고, 실패하면 배치 전 XML 로 되돌리는 것을 권장한다 (`/tobe` 파이프라인이 그렇게 한다).

## 배치 로직 (읽는 순서대로)

입력 XML 은 정규식 토크나이저로 한 번 훑어 다음 모델을 만든다: 프로세스·참여자·레인(`flowNodeRef`), flow node(종류·이름·컨테이너·경계 이벤트 host), sequenceFlow, messageFlow, 부속 요소(텍스트 주석·데이터 객체/저장소)와 association·dataInput/OutputAssociation, 그리고 기존 DI 의 도형 y 좌표(레인·풀 순서 유지용).

1. **열(column) — longest-path 레이어링**
   시작 이벤트(선행 없는 노드)부터 DFS 로 순서 흐름을 따라가며 **뒤로 가는 선(back edge)** 을 골라낸다. back edge 를 뺀 DAG 에 Kahn 위상 정렬을 돌려 `col(n) = max(col(선행) + 1)` 로 열을 정한다. 선행이 여럿이면 가장 먼 선행보다 한 칸 뒤. 열 순서는 XML 문서 순서를 tie-break 로 써서 **같은 입력이면 항상 같은 결과**.
2. **행(row) — 레인 안 barycenter**
   노드는 자기 레인 안에서만 위아래로 움직인다. 열을 왼쪽부터 처리하면서 같은 레인 선행들의 평균 행(barycenter)을 희망 행으로 잡고, 이미 차 있으면 아래 행으로 내린다. 그래서 주 경로는 한 행에 직선으로 놓이고 분기는 아래 행에 쌓이며 합류는 주 행으로 돌아온다. `flowNodeRef` 가 빠진 노드는 선행의 레인을 물려받고 `addedLaneRefs` 로 보고한다.
3. **좌표**
   열 폭 = 그 열 최대 도형 폭 + 60, 행 높이 = 그 행 최대 도형 높이 + 30, 도형은 셀 중앙. 레인 높이는 그 레인이 쓴 행 수로 늘어난다(최소 120). 부속 요소가 붙은 행은 위(주석 50+10)/아래(데이터 50+라벨 20+10) 여백을 더 확보한다. 참여자(풀)가 여럿이면 세로로 쌓는다. 기본 크기: 태스크 100×80, 게이트웨이 50×50, 이벤트 36×36, 서브프로세스는 내부 배치 결과 + 패딩 30.
4. **순서 흐름 선 그리기** (우선순위 순)
   - 같은 행: 직선.
   - 분기 게이트웨이에서 나가는 선: 게이트웨이 위/아래 꼭짓점에서 **수직** 으로 대상 행까지 간 뒤 수평.
   - 합류 게이트웨이로 들어오는 선: 수평으로 온 뒤 **수직** 으로 위/아래 꼭짓점 진입.
   - 그 외: 출발·도착 열 사이 여백(gutter) 중 **다른 도형과 겹치지 않는 통로** 를 골라 ㄱ자 3구간(수평→수직→수평). 통로가 모두 막히면 가장 덜 막힌 곳 + 패널티.
   - 위 수직 진출/진입선이 다른 레인의 도형을 **관통** 하면(`pathBlocked`) 3구간 통로 경로로 대체한다.
   - back edge(반복)·자기 루프: 행 아래 여백을 지나 되돌아간다. 정방향 선과 교차하지 않는다.
   - 결과는 항상 수평/수직 구간만 (`isOrthogonalPath` 로 검증 가능).
5. **경계 이벤트**: 호스트 아래 변 중앙에 붙이고 나가는 선은 아래 여백으로 빠진다.
6. **부속 요소 배치**
   연결 상대(association 또는 data association 의 반대편)를 찾아, 배치된 flow node 를 우선하고 없으면 배치된 부속 요소를 상대로 삼는다(2패스). 주석은 상대 **위**, 데이터 객체/저장소는 상대 **아래**, 같은 상대에 여러 개면 가로로 60 간격. 부속 요소끼리 연결(예: 데이터 저장소에 붙은 주석)은 상대 부속 요소 **옆**. 상대를 못 찾으면 도면 오른쪽 끝 세로 띠에 모은다. 연결선은 나란히 놓이면 수평, 위/아래면 수직, 아니면 중심 잇는 대각선(association 은 점선이라 허용).
7. **레인·풀 순서 유지**: 입력에 DI 가 있으면 레인과 풀의 위아래 순서는 기존 y 좌표 순서를 따르고, DI 가 없는 새 도면만 XML 순서를 쓴다.
8. **출력**: 기존 `bpmndi:BPMNDiagram` 을 통째로 새 것으로 바꾼다. `BPMNLabel`(명시 라벨 박스)은 만들지 않으므로 뷰어 기본 위치에 라벨이 그려진다. 네임스페이스 접두사(`bpmn:`/`bpmndi:`/`dc:`/`di:` 또는 기본 네임스페이스)는 입력에서 읽어 그대로 쓴다.

## 검증 방법

```bash
node --test src/lib/bpmnAutoLayout/bpmnAutoLayout.test.js   # 단위 테스트 (소스 수정 시 ./build.sh 먼저)
node src/lib/bpmnAutoLayout/cli.mjs some.bpmn --check   # 겹침 0 · diagonalFlows [] 이면 exit 0
```

실제 도면(`execute.bpmn`, 레인 5·flow node 35·부속 18) 기준: 겹침 0, 대각선 순서흐름 0, 경고 0, 약 30ms.

## process-gpt-vue3 통합 (순서도 자동 정렬 비교)

- 브리지: `src/components/autoLayout/column-row-layout.js` — 살아있는 bpmn-js 모델러의 `saveXML()` 결과에
  `computeBpmnLayout` 을 돌려 도형 bounds·선 waypoint·외부 라벨 위치를 `structured-layout/apply-layout.js` 의
  `applyGeometryEntries` (명령 `uengine.structuredLayout`) 로 한 번에 적용한다 → Ctrl+Z 로 되돌릴 수 있다.
- 팔레트 버튼 2개 (`customPalette/PaletteProvider.js`):
  - `mdi-auto-fix` 자동 레이아웃 (기존 로직) → `window.BpmnAutoLayout.applyAutoLayout`
  - `mdi-view-column-outline` 자동 레이아웃 (신규 로직: 열·행 정렬) → `applyColumnRowLayout`
- `BpmnUengine.vue` 메서드 `applyColumnRowLayout()`, E2E 페이지 `/bpmn-auto-layout-e2e` 에도 같은 버튼이 있다.
- 비교 리포트: `npm run test:e2e:bpmn-layout-compare` → `e2e/bpmn-auto-layout/e2e-results/bpmn-auto-layout/compare-summary.md`
  (케이스별 겹침/대각선/관통 수 + `screenshots/compare-<case>-{loaded,legacy,new}.png`).
- 한계: 세로(vertical) 풀은 가로로 바꿔 배치한다. `phase:*` 커스텀 요소는 좌표를 계산하지 않는다(기존 로직 전용).
