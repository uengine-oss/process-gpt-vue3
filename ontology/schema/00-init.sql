-- =============================================================================
-- Process GPT 그래프 온톨로지 — 00. 초기화 (Apache AGE)
-- 설계: docs/specs/graph-ontology-apache-age.md · 스키마 계약: ontology/SCHEMA.md
--
-- 전제:
--   * PostgreSQL 15 (supabase/postgres:15.x) 에 Apache AGE(release/PG15/1.5.x)가
--     설치되어 있어야 한다. (이미지 빌드 방법: 설계 문서 §4.1)
--   * superuser(또는 supabase_admin)로 실행.
-- 적용 순서: 00-init → 01-labels → 02-indexes → 03-seed
-- 멱등: 모든 구문은 재실행 안전.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS age;

LOAD 'age';
SET search_path = ag_catalog, "$user", public;

-- (선택) 상시 사용 DB라면 세션마다 LOAD 없이 쓰도록:
--   ALTER DATABASE postgres SET session_preload_libraries = 'age';
--   ALTER DATABASE postgres SET search_path = ag_catalog, "$user", public;

-- -----------------------------------------------------------------------------
-- 1) 그래프 생성 (단일 그래프 + 전 노드 tenant_id 속성 전략 — 설계 문서 §4.2)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM ag_catalog.ag_graph WHERE name = 'process_gpt') THEN
        PERFORM ag_catalog.create_graph('process_gpt');
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2) 라벨 생성 헬퍼 (멱등)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.graph_ensure_vlabel(p_label text)
RETURNS void LANGUAGE plpgsql AS $fn$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ag_catalog.ag_label l
        JOIN ag_catalog.ag_graph g ON l.graph = g.graphid
        WHERE g.name = 'process_gpt' AND l.name = p_label AND l.kind = 'v'
    ) THEN
        -- 시그니처: create_vlabel(graph_name cstring, label_name cstring) — 명시 캐스팅 필요
        PERFORM ag_catalog.create_vlabel('process_gpt'::cstring, p_label::cstring);
    END IF;
END $fn$;

CREATE OR REPLACE FUNCTION public.graph_ensure_elabel(p_label text)
RETURNS void LANGUAGE plpgsql AS $fn$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ag_catalog.ag_label l
        JOIN ag_catalog.ag_graph g ON l.graph = g.graphid
        WHERE g.name = 'process_gpt' AND l.name = p_label AND l.kind = 'e'
    ) THEN
        PERFORM ag_catalog.create_elabel('process_gpt'::cstring, p_label::cstring);
    END IF;
END $fn$;

-- -----------------------------------------------------------------------------
-- 3) agtype 캐스팅 헬퍼 — 하이브리드(SQL↔Cypher) 질의에서 사용
--    예: SELECT public.agtext(col) FROM cypher(...) AS (col agtype);
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.agtext(v ag_catalog.agtype)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
    SELECT CASE WHEN v IS NULL THEN NULL ELSE trim(both '"' from v::text) END
$$;

-- -----------------------------------------------------------------------------
-- 4) 동기화 인프라 테이블 (설계 문서 §5)
-- -----------------------------------------------------------------------------
-- 4-1) outbox: 실행류(고빈도) 테이블의 행 트리거가 한 줄 INSERT → 워커가 배치 MERGE
CREATE TABLE IF NOT EXISTS public.graph_sync_outbox (
    seq          bigserial PRIMARY KEY,
    src_table    text NOT NULL,                 -- 'bpm_proc_inst' | 'todolist' | 'delegation_history' | 'chat_rooms' ...
    op           text NOT NULL CHECK (op IN ('UPSERT', 'DELETE')),
    pk           jsonb NOT NULL,                -- 예: {"proc_inst_id":"..."} / {"id":"..."}
    tenant_id    text,
    enqueued_at  timestamptz NOT NULL DEFAULT now(),
    processed_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_graph_sync_outbox_pending
    ON public.graph_sync_outbox (seq) WHERE processed_at IS NULL;

-- 4-2) dangling 리포트: 서비스 경계·문자열 규약 참조가 그래프에서 해석 불가할 때 적재
--      (원천 무변경 원칙상 placeholder 노드를 만들지 않는다 — SCHEMA.md §7)
CREATE TABLE IF NOT EXISTS public.graph_sync_dangling (
    id          bigserial PRIMARY KEY,
    src         text NOT NULL,                  -- 참조를 들고 있던 원천 (예: 'strategy.kpi', 'todolist.user_id')
    src_pk      text NOT NULL,
    ref_label   text NOT NULL,                  -- 존재하지 않아 연결하지 못한 대상 라벨 (예: 'ProcessDefinition')
    ref_key     jsonb NOT NULL,                 -- 대상 키 (예: {"tenant_id":"...","id":"..."})
    edge_label  text,                           -- 만들려던 엣지 라벨
    tenant_id   text,
    first_seen  timestamptz NOT NULL DEFAULT now(),
    last_seen   timestamptz NOT NULL DEFAULT now(),
    resolved_at timestamptz,
    CONSTRAINT graph_sync_dangling_uq UNIQUE (src, src_pk, ref_label, ref_key, edge_label)
);
CREATE INDEX IF NOT EXISTS idx_graph_sync_dangling_open
    ON public.graph_sync_dangling (ref_label) WHERE resolved_at IS NULL;

-- -----------------------------------------------------------------------------
-- 5) 하드닝
--    supabase는 public 스키마 신규 테이블에 anon/authenticated ALL 권한을 기본
--    상속시키므로(default privileges), 동기화 인프라를 REST 표면에서 차단한다.
--    (RLS on + 정책 없음 = 전면 차단. service_role은 BYPASSRLS로 워커 접근 유지)
-- -----------------------------------------------------------------------------
ALTER TABLE public.graph_sync_outbox   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.graph_sync_dangling ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        EXECUTE 'REVOKE ALL ON TABLE public.graph_sync_outbox, public.graph_sync_dangling FROM anon, authenticated';
        EXECUTE 'REVOKE ALL ON SEQUENCE public.graph_sync_outbox_seq_seq, public.graph_sync_dangling_id_seq FROM anon, authenticated';
        EXECUTE 'REVOKE EXECUTE ON FUNCTION public.graph_ensure_vlabel(text), public.graph_ensure_elabel(text) FROM PUBLIC, anon, authenticated';
    END IF;
END $$;

-- 보안: process_gpt 스키마(그래프 내부 테이블)에는 RLS가 없다.
-- PostgREST 노출 스키마(PGRST_DB_SCHEMAS)에 포함하지 말고, service role 경유로만 접근한다. (설계 문서 §4.1)
