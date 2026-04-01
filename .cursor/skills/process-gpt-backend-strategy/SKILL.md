---
name: process-gpt-backend-strategy
description: >-
  Enforces API-layer Strategy for process-gpt-vue3: mode-specific logic and data
  shaping belong in Backend implementations (ProcessGPTBackend, UEngineBackend,
  PalModeBackend, PalUengineBackend) via BackendFactory—not in Vue with
  window.$mode branching. Use when the user asks for ProcessGPT, uEngine, PAL,
  $pal, $mode, definition save, BPMN condition mapping, todolist routes, or
  "mode-specific" features; when adding API calls or payload assembly; or when
  refactoring duplicated mode checks. Default product configuration is
  ProcessGPT with pal=false; preserve that path unless the user explicitly
  targets another mode.
---

# ProcessGPT / Backend Strategy 패턴 스킬

## 언제 이 스킬을 적용할지

- 사용자가 **특정 모드**(ProcessGPT, uEngine, PAL 등) **기능**을 요청할 때
- `window.$mode`, `$pal`, `ProcessGPT`, `uEngine`과 관련된 **새 화면·저장·API** 작업을 할 때
- **BPMN** condition, `uengine:json`, 정의 저장, 할 일 라우트 등 **데이터 가공**이 필요할 때
- **리팩터링**으로 Vue의 모드 분기를 줄이거나 Backend로 옮길 때

## 핵심 규칙 (반드시 준수)

1. **Strategy 선택은 한 곳**  
   런타임 백엔드 구현은 [`BackendFactory.createBackend()`](src/components/api/BackendFactory.ts)만 사용한다. `ProcessGPT` → `ProcessGPTBackend`, `uEngine` → `UEngineBackend`, PAL 조합은 팩토리 문서대로.

2. **API 호출·모드별 데이터 정규화는 Vue가 아니라 Backend**  
   - 금지: Vue/SFC에서 `window.$mode === 'ProcessGPT'`로 **저장 payload 조립**, **condition 문자열을 서로 다른 필드에서 뽑기**, **btoa/인코딩 정책**을 분기로 처리하기.  
   - 권장: [`Backend`](src/components/api/Backend.ts)에 메서드를 추가하고, **해당 모드의 Backend 클래스**에서 구현한다. 호출부는 `this.backend` 또는 주입된 backend 한 줄에 가깝게 유지한다.

3. **기본 구성을 깨지 말 것**  
   제품 기본은 **`ProcessGPT` + `pal === false`** 에 가깝다. 변경·검증 시 **이 경로를 1순위**로 두고, uEngine/PAL 전용은 명시적으로 요청된 경우에만 우선한다.

4. **새 기능 = 인터페이스부터**  
   공통으로 쓰일 API면 먼저 `Backend`에 시그니처를 추가하고, **네 구현체**(PG / UE / Pal* / PalUengine*)에 맞게 구현한다. 한 모드만 쓰는 API는 `optional?`로 두되, Proxy(`wrapBackendWithNullSkip`)와의 상호작용을 고려한다.

5. **UI 분기는 “표현”만**  
   탭 노출·레이아웃·라벨 등 **순수 표현**은 모드 분기가 있을 수 있다. 그러나 **도메인 규칙**(무엇을 저장할지, 어떤 필드가 condition인지)은 Backend 쪽으로 옮기는 것이 목표다.

## 작업 전 체크리스트

- [ ] 요청이 **어느 모드**용인가? (미정이면 기본 **ProcessGPT + pal=false** 가정을 사용자에게 한 줄 확인)
- [ ] **데이터 변환**이 필요한가? → Backend 또는 `src/components/api/` 아래 전용 mapper 유틸에 둔다.
- [ ] 기존 코드에 **같은 패턴의 `window.$mode` 분기**가 있는가? → 복제하지 말고 통합 지점을 찾는다.
- [ ] **회귀**: 기본 구성에서 핵심 시나리오가 깨지지 않는지 고려한다.

## 참고 파일 (이 저장소)

| 역할 | 경로 |
|------|------|
| 인터페이스 | `src/components/api/Backend.ts` |
| 팩토리 | `src/components/api/BackendFactory.ts` |
| 구현체 | `ProcessGPTBackend.ts`, `UEngineBackend.ts`, `PalModeBackend.ts`, `PalUengineBackend.ts` |
| 모드 분기가 많은 예시 | `ProcessDefinitionModule.vue`, `WorkItem.vue`, designer `*Panel.vue` |

상세 비교·분기 현황은 [`docs/bnk-vs-workspace-comparison-report.md`](docs/bnk-vs-workspace-comparison-report.md) §10을 참고한다.

## 안티패턴 (하지 말 것)

- 새 저장 로직을 `if (window.$mode == 'uEngine') { ... } else { ... }` 로만 Vue에 추가하기.
- 한 컴포넌트에서만 쓰는 **비즈니스 규칙**을 `computed`/`methods`에 숨기기 (재사용 시 모드 버그 누적).
- ProcessGPT 전용인데 `UEngineBackend`만 수정하거나 그 반대로, **요청 모드와 다른 구현체만** 고치기.

## 짧은 예시

**나쁨 (Vue에서 조건 문자열 소스 분기):**

```ts
condition: window.$mode == 'ProcessGPT' ? g.condition : parseUengineJson(g).condition
```

**좋음 (Backend 위임):**

```ts
condition: backend.getGatewayExportCondition(g)
```

(메서드명은 실제 `Backend` 정의에 맞출 것.)
