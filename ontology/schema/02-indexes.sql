-- =============================================================================
-- Process GPT 그래프 온톨로지 — 02. 키(유니크) 및 인덱스
--
-- AGE는 속성 스키마·유니크 제약을 자체 지원하지 않는다. 대신 라벨 내부 테이블
-- (process_gpt."<Label>")이 일반 PG 테이블이므로:
--   * 업무키  → agtype 표현식 UNIQUE INDEX 로 DB 수준 강제 (동시 MERGE 중복 방어)
--   * 탐색    → 엣지 테이블 start_id/end_id btree (전 엣지 라벨 일괄)
--   * 스캔    → 전 노드 라벨 tenant_id btree 일괄 + 주요 라벨 GIN(properties)
-- 01-labels.sql 실행 후에 실행해야 한다(라벨 미존재 시 예외 발생).
-- =============================================================================

LOAD 'age';
SET search_path = ag_catalog, "$user", public;

-- -----------------------------------------------------------------------------
-- 1) 노드 업무키 UNIQUE 인덱스 (SCHEMA.md §6 키 정책의 물리 강제)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    r record;
    v_rel  text;
    v_cols text;
BEGIN
    FOR r IN
        SELECT * FROM (VALUES
            -- (라벨, 업무키 속성 순서)
            ('Tenant',            ARRAY['id']),
            ('Perspective',       ARRAY['tenant_id','id']),
            ('Objective',         ARRAY['tenant_id','id']),
            ('KPI',               ARRAY['tenant_id','id']),
            ('Initiative',        ARRAY['tenant_id','id']),
            ('MegaProcess',       ARRAY['tenant_id','id']),
            ('MajorProcess',      ARRAY['tenant_id','id']),
            ('ProcessDefinition', ARRAY['tenant_id','id']),
            ('ProcessVersion',    ARRAY['uuid']),
            ('Activity',          ARRAY['tenant_id','proc_def_id','element_id']),
            ('Event',             ARRAY['tenant_id','proc_def_id','element_id']),
            ('Gateway',           ARRAY['tenant_id','proc_def_id','element_id']),
            ('Role',              ARRAY['tenant_id','proc_def_id','name']),
            ('Variable',          ARRAY['tenant_id','proc_def_id','name']),
            ('Form',              ARRAY['tenant_id','id']),
            ('FormField',         ARRAY['tenant_id','form_id','key']),
            ('User',              ARRAY['tenant_id','id']),
            ('Agent',             ARRAY['tenant_id','id']),
            ('Team',              ARRAY['tenant_id','id']),
            ('OrgGroup',          ARRAY['tenant_id','id']),
            ('ProcessInstance',   ARRAY['id']),
            ('WorkItem',          ARRAY['id']),
            ('Delegation',        ARRAY['id']),
            ('Project',           ARRAY['id']),
            ('ChatRoom',          ARRAY['id']),
            ('Topic',             ARRAY['tenant_id','proc_def_id','topic_id']),
            ('Skill',             ARRAY['tenant_id','name']),
            ('KnowledgeDoc',      ARRAY['id']),
            -- [보류] Governance 레이어 활성화 시 해제:
            -- ('Review',         ARRAY['id']),
            -- ('ResourcePR',     ARRAY['id']),
            -- ('Terminology',    ARRAY['tenant_id','category','term']),
            ('GraphMeta',         ARRAY['id'])
        ) AS t(label, keys)
    LOOP
        SELECT l.relation::text INTO v_rel
        FROM ag_catalog.ag_label l
        JOIN ag_catalog.ag_graph g ON l.graph = g.graphid
        WHERE g.name = 'process_gpt' AND l.name = r.label AND l.kind = 'v';

        IF v_rel IS NULL THEN
            RAISE EXCEPTION 'vertex label "%" not found — run 01-labels.sql first', r.label;
        END IF;

        SELECT string_agg(
                   format('(ag_catalog.agtype_access_operator(properties, %L::ag_catalog.agtype))',
                          '"' || k || '"'),
                   ', ')
          INTO v_cols
          FROM unnest(r.keys) AS k;

        EXECUTE format('CREATE UNIQUE INDEX IF NOT EXISTS %I ON %s (%s)',
                       'uq_v_' || lower(r.label), v_rel, v_cols);
    END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 2) 전 노드 라벨 tenant_id btree (테넌트 스코프 스캔)
-- -----------------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
    FOR r IN
        SELECT l.name AS label, l.relation::text AS rel
        FROM ag_catalog.ag_label l
        JOIN ag_catalog.ag_graph g ON l.graph = g.graphid
        WHERE g.name = 'process_gpt' AND l.kind = 'v' AND l.name NOT LIKE '\_%'
    LOOP
        EXECUTE format(
            'CREATE INDEX IF NOT EXISTS %I ON %s ((ag_catalog.agtype_access_operator(properties, ''"tenant_id"''::ag_catalog.agtype)))',
            'ix_v_' || lower(r.label) || '_tenant', r.rel);
    END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 3) 전 엣지 라벨 start_id / end_id btree (그래프 탐색 성능의 핵심)
-- -----------------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
    FOR r IN
        SELECT l.name AS label, l.relation::text AS rel
        FROM ag_catalog.ag_label l
        JOIN ag_catalog.ag_graph g ON l.graph = g.graphid
        WHERE g.name = 'process_gpt' AND l.kind = 'e' AND l.name NOT LIKE '\_%'
    LOOP
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %s (start_id)',
                       'ix_e_' || lower(r.label) || '_s', r.rel);
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %s (end_id)',
                       'ix_e_' || lower(r.label) || '_e', r.rel);
    END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 4) 보조 조회 인덱스 (비유니크)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    r record;
    v_rel text;
BEGIN
    FOR r IN
        SELECT * FROM (VALUES
            -- (라벨, 속성, 인덱스명 접미)
            ('User',            'email',       'email'),        -- todolist.user_id 가 email 인 경우의 resolver
            ('Agent',           'alias',       'alias'),
            ('WorkItem',        'status',      'status'),
            ('WorkItem',        'activity_id', 'activity'),     -- EXECUTES 바인딩용
            ('ProcessInstance', 'status',      'status'),
            ('KPI',             'measure_type','mtype'),
            ('KnowledgeDoc',    'doc_role',    'role')
        ) AS t(label, prop, suffix)
    LOOP
        SELECT l.relation::text INTO v_rel
        FROM ag_catalog.ag_label l
        JOIN ag_catalog.ag_graph g ON l.graph = g.graphid
        WHERE g.name = 'process_gpt' AND l.name = r.label AND l.kind = 'v';

        EXECUTE format(
            'CREATE INDEX IF NOT EXISTS %I ON %s ((ag_catalog.agtype_access_operator(properties, %L::ag_catalog.agtype)))',
            'ix_v_' || lower(r.label) || '_' || r.suffix, v_rel, '"' || r.prop || '"');
    END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 5) 주요 라벨 GIN(properties) — 애드혹 속성 질의용 (쓰기 비용 대비 허브 라벨만)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    r record;
    v_rel text;
BEGIN
    FOR r IN
        SELECT unnest(ARRAY['ProcessDefinition','Activity','ProcessInstance','WorkItem',
                            'KPI','Objective','User','Agent','KnowledgeDoc']) AS label
    LOOP
        SELECT l.relation::text INTO v_rel
        FROM ag_catalog.ag_label l
        JOIN ag_catalog.ag_graph g ON l.graph = g.graphid
        WHERE g.name = 'process_gpt' AND l.name = r.label AND l.kind = 'v';

        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %s USING gin (properties)',
                       'gin_v_' || lower(r.label), v_rel);
    END LOOP;
END $$;
