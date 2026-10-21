# 위젯 컴포저 설계안 — 전용 위젯의 선언적(DSL) 전환과 포팅 계획

> 2026-09-14 초안. 대상: 속성 스키마 스튜디오(PropertySchemaStudio)에서 전용 패널 위젯
> 자체를 편집 가능하게 만드는 장기 구조. **PAL 모드 전용 변경** — 비 PAL 패널
> (PALUserTaskPanel 등 bpmnModeling 스택)은 건드리지 않는다.

## 1. 목표

- 전용 위젯(세부 절차, API 연동, 메일 필드 묶음 등)의 **정의를 코드가 아닌 데이터**
  (`task_property_schema.config`)로 옮겨, 관리자가 스튜디오에서 직접 편집·미리보기.
- 코드로 남아야 하는 위젯(RACI, FTE, 집계 섹션)은 **레지스트리에 등록된 블랙박스 블록**으로
  같은 인터페이스에 통합하고, 조정 가능한 표면(옵션)만 개방.
- **값 스키마 불변**: 위젯이 저장하는 값 구조(proc_def.definition JSONB, uengine json)는
  어떤 전환에서도 바꾸지 않는다. 바뀌는 것은 "어떻게 그리고 입력받는가"뿐이다.

## 2. 현재 구조 (2026-09 기준)

- 스키마 행(`task_property_schema`)이 라벨·순서·노출·필수를 지배. 렌더링은
  `SchemaFieldInput.vue` 단일 렌더러(string/textarea/number/date/boolean/select/
  multiselect/db-select/file/table/url + 조건부 표시 + API 소스).
- 전용 위젯은 `config.renderer='panel'` 행으로 표시만 관리되고, 실제 UI는
  `ProcessHierarchyProperties.vue`가 dispatch 루프에서 코드로 그린다.
  인벤토리는 `builtinPanelProperties.ts` 41행 (widget: text/textarea/select/switch/
  autocomplete/combobox/dialog/section/list-editor/ManualLinkField/file/readonly).

## 3. 아키텍처

### 3.1 위젯 레지스트리 (`src/components/ui/widgetRegistry.ts` 신설)

모든 위젯(코드·DSL 불문)을 하나의 인터페이스로 등록한다.

```ts
interface WidgetDef {
    name: string;                  // 'raci', 'task-io', 'composite' ...
    kind: 'code' | 'dsl';
    component?: Component;         // kind='code' — 기존 Vue 컴포넌트
    // 값 계약 — 동결. 마이그레이션 검증과 문서화용 (JSON Schema)
    valueSchema: object;
    // 스튜디오가 자동 폼을 만들어 config.widget_options 에 저장하는 조정 표면
    optionsSchema?: object;
    // 미리보기 렌더 가능 여부 (집계형 섹션은 placeholder 유지)
    previewable: boolean;
}
```

- `SchemaFieldInput`은 `field.config.widget`이 레지스트리에 있으면 해당 위젯으로
  위임(dispatch)한다. 패널의 하드코딩 dispatch 분기는 점진적으로 레지스트리 조회로 대체.
- 코드 위젯도 `props: { modelValue, options, readonly, preview }` 계약으로 맞춘다
  (기존 RaciField/TaskIoField 등은 어댑터 얇게 한 겹).

### 3.2 컴포지트 DSL v1 (`config.composite`)

기존 SchemaFieldInput 프리미티브를 조합해 복합 위젯을 선언한다.

```jsonc
{
    "composite": {
        "version": 1,
        "layout": [                       // 행 단위 배치, flex 비율
            { "row": ["unit", "cost"], "flex": [1, 2] },
            { "row": ["note"] }
        ],
        "fields": [                       // 각 항목 = 기존 스키마 필드 정의의 부분집합
            { "key": "unit", "label": "단위", "type": "select", "options": [...] },
            { "key": "cost", "label": "비용", "type": "number", "number_unit": "won" },
            { "key": "note", "label": "비고", "type": "textarea",
              "visible_when": { "field": "cost", "op": "not_empty" } }
        ],
        "value_mode": "object",           // 값 = { unit, cost, note } — 기존 포맷과 일치 필수
        "list": false                     // true 면 값 = 항목 배열 (list-editor 계열)
    }
}
```

- **v1 범위**: 배치(layout)·구성 필드·조건부 표시·목록화(list)·placeholder/힌트.
  기존 프리미티브 재사용이 원칙이라 렌더러 추가 코드는 "composite 해석기" 하나다.
- **v1 신규 프리미티브 2종**(포팅에 필요):
  - `string-list`: 순서 있는 문자열 배열(세부 절차 = `string[]`). 번호·추가·삭제·여러 줄.
  - `object-list`: `list: true` 컴포지트의 내부 표현 (API 연동 = 객체 배열). 기존
    `table` 타입 확장으로 구현.
- **v1 비범위(의도적 제외)**: 계산식·커스텀 액션·드래그 정렬·셀 간 배타 규칙 등 로직.
  로직이 필요하면 코드 위젯으로 남긴다. DSL에 로직을 넣기 시작하면 사실상 코드
  에디터의 보안·유지보수 문제로 수렴하므로 v2에서도 화이트리스트 함수(sum 등)까지만 검토.

### 3.3 스튜디오 편집기

- 편집 다이얼로그에 "위젯 구성" 탭 추가: 필드 팔레트(기존 타입 + string-list)에서
  추가 → 행 배치(위/아래 이동, 같은 행 묶기) → 필드별 세부 설정(기존 폼 재사용).
- 미리보기는 기존 `SchemaFieldInput preview`가 composite를 해석하므로 공짜로 동작.
  현재의 "전용 위젯" placeholder는 코드 위젯 중 previewable=false인 것에만 남는다.
- 저장은 기존 saveField 화이트리스트에 `config.composite`, `config.widget_options`
  두 키만 추가. DB 마이그레이션 불필요(모두 config JSONB 안).

### 3.4 전환·롤백 전략 (dual-render)

- 포팅된 위젯은 스키마 행에 `config.renderer='composite'`를 세워 전환한다.
  패널 dispatch는 renderer 플래그를 보고 코드 경로 ↔ composite 경로를 택한다.
- 값 포맷이 동일하므로 **롤백 = 플래그 되돌리기**. 코드 위젯 구현은 한 릴리즈 이상
  유지한 뒤 제거한다.
- 포팅 검증: valueSchema(JSON Schema)로 "코드 위젯이 쓰던 값 ↔ composite가 쓰는 값"
  왕복 테스트를 위젯별로 1개 이상 추가.

## 4. 포팅 계획 — 인벤토리 분류 (builtinPanelProperties 41행 기준)

### A. 이미 프리미티브로 충분 (별도 포팅 없음 — dispatch만 레지스트리화)
text/textarea/switch/readonly/file 위젯 전부: title, description(프로세스·Task·Lane),
name, element_id, mail_title, mail_contents, condition_expression, condition_llm_mode,
exec_pool, attachment(file). autocomplete 계열(system_mapping, related_project_mapping,
form_link, definition_link, dmn_rule)은 **db-select 프리미티브로 흡수 가능** — 대상
테이블·컬럼을 config.db로 이미 표현할 수 있다.

### B. DSL 포팅 1차 (v1으로 완전 편집 가능)
| 위젯 | 값 포맷(동결) | 필요 프리미티브 |
|---|---|---|
| task_io 세부 업무 수행 절차 | `string[]` | string-list |
| api_integrations (list-editor) | 객체 배열 | object-list |
| opex (unit/cost/note) | 개별 키 3개 | composite object |
| mail 필드 묶음 (SendTask 3필드) | 개별 키 | composite object(그룹화) |
| sequence flow 묶음 (종류→조건식→LLM) | 개별 키 | composite + visible_when |

### C. DSL 포팅 2차 (프리미티브 보강 후)
manual_links(ManualLinkField — url-list + 집계 표시 분리), lane_assignment
(유형별 조건 분기 — visible_when 중첩), ppi(지표 목록 — object-list + 다이얼로그 입력 모드).

### D. 코드 유지 + optionsSchema 개방 (포팅 비대상)
- **상호작용 로직형**: raci(셀 배타 규칙), fte_calculator(계산식), owner(권한·이력),
  parent_hierarchy(모듈 전환 사이드이펙트).
- **집계 섹션형**(widget='section' 읽기 전용): total_duration, total_cost, task_count,
  system_list, api_integrations_summary, data_io, pi_flag 계열, governance 계열 —
  데이터 소스가 코드(집계 쿼리)라 DSL 이득이 없다. 라벨·노출은 이미 스키마 행이 지배.

## 5. 로드맵

- **Phase 0** (기반): widgetRegistry + SchemaFieldInput dispatch + saveField 키 2종.
- **Phase 1**: string-list 프리미티브 + task_io 포팅(dual-render), 스튜디오 "위젯 구성"
  탭 최소 버전(필드 추가/삭제/순서). ← 첫 실사용 검증 지점
- **Phase 2**: object-list/composite object + B군 나머지 포팅, 행 배치 편집 UI.
- **Phase 3**: C군 프리미티브 보강, D군 optionsSchema 개방(방안 1 통합).

## 6. 리스크

- **패널 dispatch 이중화 기간**: renderer 플래그 분기 동안 코드·DSL 두 경로가 공존 —
  위젯별 왕복 테스트와 짧은 전환 주기로 관리.
- **DSL 스코프 크리프**: 로직 요구가 들어오면 v1 비범위 원칙을 지키고 코드 위젯 +
  optionsSchema로 해결하는 것을 기본값으로 한다.
- **테넌트 간 정의 이동**: 기존 템플릿 내보내기/가져오기가 config를 통째로 다루므로
  composite 정의도 자동 포함 — 가져오기 시 version 필드로 호환성 검사만 추가.
