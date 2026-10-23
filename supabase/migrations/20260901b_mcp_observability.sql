-- ============================================================
-- MCP / LLM 관측용 이벤트 타입
-- ------------------------------------------------------------
-- tool_usage_started / tool_usage_finished 는 이미 n8n-agent,
-- deep-research, bpmn-extractor 등 8개 서비스가 "일반 진행 메시지"로
-- 쓰고 있어 MCP 전용으로 재해석할 수 없다. 그래서 별도 타입을 만든다.
--
-- ALTER TYPE ... ADD VALUE 는 함수/DO 블록 안에서 실행할 수 없으므로
-- 반드시 최상위 문으로 둔다.
-- ============================================================

ALTER TYPE event_type_enum ADD VALUE IF NOT EXISTS 'mcp_call_started';
ALTER TYPE event_type_enum ADD VALUE IF NOT EXISTS 'mcp_call_finished';
ALTER TYPE event_type_enum ADD VALUE IF NOT EXISTS 'mcp_call_failed';
ALTER TYPE event_type_enum ADD VALUE IF NOT EXISTS 'mcp_tools_loaded';
ALTER TYPE event_type_enum ADD VALUE IF NOT EXISTS 'mcp_server_health_changed';
ALTER TYPE event_type_enum ADD VALUE IF NOT EXISTS 'llm_call_finished';
