# HumanFeedbackPanel — HITL 생성형 UI 컨트랙트

채팅창에서 도구(MCP / pdf2bpmn 워커 등)가 사용자에게 선택/승인/자유응답을
요청할 때 사용하는 통합 인터페이스. 컴포넌트 위치:
[src/components/ui/HumanFeedbackPanel.vue](../src/components/ui/HumanFeedbackPanel.vue).

도구가 백엔드를 통해 정해진 형식의 JSON 을 보내면, 프론트가 자동으로
이 컴포넌트를 렌더하고, 사용자의 응답을 다시 도구로 전달한다. **새 도구를
만들 때 별도 UI 를 새로 만들 필요 없이 이 JSON 형식만 맞추면 됨**.

---

## 1. 흐름 개요

```
[도구]                          [Supabase / SSE]            [프론트]
ask_user(...) 호출 OR
events INSERT (waiting_for_user)
   │
   └──── JSON payload ─────────────►   채팅 메시지
                                       msg.__humanFeedback = payload
                                       │
                                       └─► <HumanFeedbackPanel>
                                              사용자 선택/입력
                                              │
   ◄──── feedbackResult ──────── submit
   처리 후 다음 단계 진행
```

- **메인 채팅 도구 호출**: 백엔드 ask_user MCP 도구가 JSON 을 반환 → 프론트가
  마지막 도구 결과 (`tool_end`) 를 파싱해 `__humanFeedback` 첨부.
  ([ChatRoomPage.vue:5838](../src/views/chat/ChatRoomPage.vue:5838) 부근)
- **pdf2bpmn 워커 진행 중 HITL**: 워커가 `events` 테이블에 row INSERT →
  Supabase Realtime 으로 프론트 수신 → 같은 `__humanFeedback` 모양으로 첨부.
  ([ChatRoomPage.vue:7072](../src/views/chat/ChatRoomPage.vue:7072) 부근)

두 경로 모두 **같은 payload 스키마**를 따른다.

---

## 2. Payload 스키마 (도구 → 프론트)

```jsonc
{
  // 필수: 어떤 종류의 응답을 기대하는가
  "user_request_type": "ask_user",          // 항상 이 값 (식별자)
  "feedback_type": "select_items",          // 패널 모드 — 아래 §3 참고
  "question": "프로세스 생성 강도를 선택해주세요.",  // 패널 헤더에 표시

  // 선택: 추가 안내
  "context": "선택한 강도에 따라 노드 정규화/중복 제거 임계값이 달라집니다.",
  "missing_fields": [],                     // 누락 필드 안내 (참고용)

  // feedback_type 별 데이터
  "items": [                                // select_items 모드 필수
    { "id": "concise",  "label": "간소화 (concise)",  "description": "노드 적극 합치기" },
    { "id": "standard", "label": "표준 (standard)",   "description": "기본값" },
    { "id": "detailed", "label": "상세 (detailed)",   "description": "보수적 합치기" }
  ],
  "suggestions": [                          // suggestions / approve_reject 모드
    "이 문서로 BPMN 만들어줘",
    "이 문서 요약해줘"
  ],
  "evidence_spans": ["문서 3p '~' 라인"],   // 근거 (옵션)
  "impact_preview": ["A 노드가 추가됨"],     // 예상 결과 (옵션)

  // 입력 제약
  "allow_multiple": false,                  // 다중 선택 (기본 true)
  "min_select": 1,                          // 최소 선택 개수 (기본 1)
  "allow_skip": false,                      // 건너뛰기 버튼 (기본 false)
  "allow_other": true,                      // 직접 입력 옵션 (기본 false). §4 참고

  // 응답을 어디로 보낼지 식별 — 도구 응답 라우팅용
  "option_meta": {
    "tool": "pdf2bpmn",                     // 어느 도구의 옵션인지
    "key":  "pdf2bpmnLevel",                // 어떤 옵션인지 (e.g. tool_settings 키)
    "stage": "skills_approval",             // (옵션) 다단계 elicitation 시 단계 식별
    "task_id": "uuid",                      // (옵션) 특정 작업/todo 와 연결
    "question_id": "uuid"                   // (옵션) 같은 질문 중복 차단용
  }
}
```

### 필수 필드

| 필드 | 타입 | 의미 |
|---|---|---|
| `user_request_type` | `"ask_user"` | 프론트가 HITL 패널을 띄울 트리거. 항상 이 값. |
| `feedback_type` | string | 아래 §3 의 모드 중 하나. |
| `question` | string | 패널 헤더에 보일 질문. |

### 모드별 추가 필수 필드

| feedback_type | 필수 추가 필드 |
|---|---|
| `select_items` | `items` (≥1) |
| `suggestions` | `suggestions` (≥1) |
| `approve_reject_with_edit` | (없음 — `suggestions` 는 옵션) |
| `confirm` | (없음) |

---

## 3. feedback_type 모드별 사용

### 3.1 `select_items` — 옵션 카드 + 체크박스

여러 후보 중에서 선택. 가장 일반적인 모드. 단일/다중 모두 지원.

```jsonc
{
  "user_request_type": "ask_user",
  "feedback_type": "select_items",
  "question": "다음 스킬을 생성할까요?",
  "items": [
    { "id": "skill_review_inspection", "label": "검토/심사 처리",
      "description": "심사 단계마다 반복되는 체크리스트 자동화" },
    { "id": "skill_notify_stakeholder", "label": "이해관계자 통지",
      "description": "결재 진행 상황 메일 발송" }
  ],
  "allow_multiple": true,
  "min_select": 0,
  "allow_other": false,
  "option_meta": { "tool": "pdf2bpmn", "key": "skills_approval", "task_id": "..." }
}
```

응답:
```jsonc
{
  "type": "select_items",
  "selectedIds": ["skill_review_inspection"],
  "selectedItems": [{ "id": "...", "label": "...", "description": "..." }]
}
```

### 3.2 `suggestions` — 빠른 칩 선택 (단일)

추천 질문/답변 칩에서 하나 선택. 텍스트만 짧게.

```jsonc
{
  "user_request_type": "ask_user",
  "feedback_type": "suggestions",
  "question": "이 파일로 무엇을 도와드릴까요?",
  "suggestions": [
    "이 파일로 BPMN 프로세스 만들어줘",
    "이 파일을 표 중심으로 마크다운 정리해줘",
    "이 파일 핵심 내용 요약해줘"
  ]
}
```

응답: `{ "type": "suggestions", "selected": "이 파일로 BPMN..." }`

### 3.3 `approve_reject_with_edit` — 승인/반려 + 자유 입력

Yes/No 결정 + 사유/수정 의견 textarea. 워커의 변경 제안 검토용.

```jsonc
{
  "user_request_type": "ask_user",
  "feedback_type": "approve_reject_with_edit",
  "question": "이 게이트웨이 분기를 다음과 같이 정의했습니다. 적용할까요?",
  "context": "Gateway: 결재 단계 — 금액 ≥ 1억원이면 임원 승인 경로",
  "evidence_spans": ["문서 12p '결재 라인 기준' 표"],
  "impact_preview": ["BPMN 에 ExclusiveGateway + 2 sequenceFlow 추가"],
  "suggestions": ["임원 결재만 추가", "전결권자 분기 추가"],
  "option_meta": { "tool": "pdf2bpmn", "key": "gateway_approval",
                   "task_id": "...", "question_id": "..." }
}
```

응답:
```jsonc
{
  "type": "approve_reject_with_edit",
  "decision": "approve",                 // 또는 "reject"
  "answer":   "승인",                     // 표시용
  "reason":   "수정 의견 자유 텍스트",
  "selectedSuggestion": "임원 결재만 추가"  // 칩 선택했을 때만
}
```

### 3.4 `confirm` — 단순 확인

다른 데이터 없이 "확인" 버튼만. 통보성.

응답: `{ "type": "confirm" }`

---

## 4. "직접 입력" (Other) 옵션 — claude code 식 패턴

`select_items` 또는 `suggestions` 모드에 사용자가 후보 외 의견을 직접 쓸 수 있게
허용하려면 `allow_other: true` 를 추가한다.

```jsonc
{
  "user_request_type": "ask_user",
  "feedback_type": "select_items",
  "question": "어떤 방식으로 변환할까요?",
  "items": [
    { "id": "dmn",   "label": "DMN 의사결정표로 생성", "description": "..." },
    { "id": "skill", "label": "스킬로 변환",          "description": "..." },
    { "id": "skip",  "label": "건너뛰기" }
  ],
  "allow_multiple": false,
  "allow_other": true,
  "option_meta": { "tool": "pdf2bpmn", "key": "gateway_dmn_or_skill", "task_id": "..." }
}
```

`allow_other=true` 면 패널 하단에 "직접 입력" textarea 가 추가됨. 사용자는:
- (a) 칩/체크박스에서 옵션을 고르거나
- (b) textarea 에 자유 의견을 쓰거나
- (c) 둘 다 (옵션 선택 + 추가 코멘트)

응답에 `customText` 가 함께 들어옴:
```jsonc
{
  "type": "select_items",
  "selectedIds": ["skill"],                  // 빈 배열일 수 있음 (자유 의견만 쓴 경우)
  "selectedItems": [...],
  "customText": "DMN 으로 만들되 분기 조건은 한국어로 적어주세요"
}
```

도구 측에서는 `selectedIds` 가 비어있으면 `customText` 만 사용해 처리.

---

## 5. 응답 라우팅 — `option_meta` 의 역할

프론트는 두 가지 응답 경로를 사용:

### 5.1 메인 채팅 도구 (ask_user MCP) 의 응답

`handleHumanFeedbackSubmit` ([ChatRoomPage.vue:3402](../src/views/chat/ChatRoomPage.vue:3402))
가 처리. `option_meta.tool` 와 `option_meta.key` 가 있으면:
- 다음 메시지 본문 = `selectedItems[0].id` 만 (UI 노출 X, `hideUserMessage:true`)
- localStorage `process-gpt:toolsSettings[option_meta.key] = id` 자동 갱신
- 다음 백엔드 요청의 `metadata.tool_settings` 에 자동 포함

이렇게 하면 백엔드의 `_resume_pending_*` 가 사용자 응답을 정확히 매칭.

### 5.2 pdf2bpmn 워커 진행 중 HITL 의 응답

`submitPdf2BpmnHumanFeedback(taskId, payload)`
([ChatRoomPage.vue:3457](../src/views/chat/ChatRoomPage.vue:3457)) 가 처리.
응답을 `todolist.output` 컬럼에 기록 → 워커가 polling/realtime 으로 감지.

`option_meta.task_id` 가 있으면 그 todo 의 output 으로 라우팅.
`option_meta.question_id` 는 같은 질문에 두 번 응답하지 않도록 dedupe.

---

## 6. 백엔드 측 구현 요약

### 6.1 MCP 도구에서 ask_user 호출 (메인 채팅)

[process-gpt-mcp/src/process_gpt_mcp/server.py](../../work-assistant-agent/process-gpt-mcp/src/process_gpt_mcp/server.py)
의 `ask_user` 도구 시그니처:

```python
@mcp.tool()
async def ask_user(
    question: str,
    context: Optional[str] = None,
    suggestions: Optional[List[str]] = None,
    feedback_type: Optional[str] = None,           # NEW
    items: Optional[List[Dict[str, Any]]] = None,  # NEW
    allow_multiple: Optional[bool] = None,         # NEW
    min_select: Optional[int] = None,              # NEW
    allow_other: Optional[bool] = None,            # NEW (TODO: 추가)
    option_meta: Optional[Dict[str, Any]] = None,  # NEW
    ...
) -> str:
    # 위 인자들을 그대로 response JSON 에 포함시켜 반환.
    return json.dumps(response, ensure_ascii=False)
```

### 6.2 pdf2bpmn 워커에서 events 테이블에 INSERT

```python
# src/pdf2bpmn/hitl.py (신규)
async def emit_waiting_for_user(supabase, *, todo_id, payload):
    supabase.table("events").insert({
        "todo_id": todo_id,
        "event_type": "waiting_for_user",
        "payload": payload,           # 위 §2 의 JSON 그대로
        "created_at": "now()",
    }).execute()

async def wait_for_user_response(supabase, *, todo_id, question_id, timeout_sec=600):
    # todolist.output 폴링 또는 events 테이블의 "user_response" event 구독
    ...
```

---

## 7. 새 도구에서 이 패널을 쓰는 체크리스트

1. 어떤 모드가 적합한가? (`select_items` / `suggestions` / `approve_reject_with_edit` / `confirm`)
2. 사용자가 자유롭게 적을 여지가 있는가? → `allow_other: true`
3. 응답이 어디로 가야 하는가?
   - 메인 채팅 LLM 흐름이면 → `option_meta.tool` + `option_meta.key` 만 채우면 됨
   - 별도 워커가 받아야 하면 → `option_meta.task_id` + `question_id` 도 추가
4. `items[].id` 는 백엔드가 그대로 받을 식별자 — 짧고 영문/스네이크.
5. `items[].description` 은 1-2줄 미리보기. 마크다운 짧은 줄 OK.
6. 다단계 elicitation 이면 `option_meta.stage` 로 단계 구분.

---

## 8. 자주 쓰는 예시

### 예시 A: 작업 옵션 선택 (이미 구현됨)

```python
{
  "user_request_type": "ask_user",
  "feedback_type": "select_items",
  "question": "프로세스 생성 강도?",
  "items": [{"id":"concise",...}, {"id":"standard",...}, {"id":"detailed",...}],
  "allow_multiple": False, "min_select": 1, "allow_skip": False,
  "option_meta": {"tool":"pdf2bpmn", "key":"pdf2bpmnLevel"}
}
```

### 예시 B: 워커가 스킬 후보 승인 요청

```python
{
  "user_request_type": "ask_user",
  "feedback_type": "select_items",
  "question": "다음 스킬 후보 중 만들 것을 선택해주세요.",
  "context": "활동 지침에서 반복 패턴을 찾았습니다. 선택한 것만 등록됩니다.",
  "items": [{"id": s["safe_name"], "label": s["name"],
             "description": s["summary"]} for s in candidates],
  "allow_multiple": True, "min_select": 0, "allow_other": True,
  "option_meta": {"tool":"pdf2bpmn", "key":"skills_approval",
                  "task_id": todo_id, "question_id": str(uuid4())}
}
```

### 예시 C: DMN vs 스킬 선택

```python
{
  "user_request_type": "ask_user",
  "feedback_type": "select_items",
  "question": "다음 게이트웨이 분기를 어떤 형태로 만들까요?",
  "context": f"Gateway: {gateway_name}\n조건: {conditions_text}",
  "items": [
    {"id":"dmn",   "label":"DMN 의사결정표",
     "description":"분기 조건 매트릭스 형태. BusinessRuleTask 로 호출"},
    {"id":"skill", "label":"스킬로 변환",
     "description":"의사결정 로직을 자연어 스킬로 등록"},
    {"id":"skip",  "label":"건너뛰기"}
  ],
  "allow_multiple": False, "min_select": 1, "allow_other": True,
  "option_meta": {"tool":"pdf2bpmn", "key":"gateway_dmn_or_skill",
                  "task_id": todo_id, "question_id": gateway_id}
}
```

---

## 9. 변경 이력

- v1: select_items / suggestions / approve_reject_with_edit / confirm 4가지 모드
- v1.1: `feedback_type`, `items`, `option_meta` 가 ask_user 시그니처에 추가됨 (이전엔 무시되어 select_items UI 가 안 떴음)
- v1.2: 메시지 인라인 패널 추가 — pdf2bpmn 워커 진행 상태와 무관하게
  `__humanFeedback` 만 있으면 자동 렌더 (Chat.vue:131 부근)
- v1.3: `allow_other` 옵션 + 직접 입력 textarea (claude code A/B/C/Other 패턴)
