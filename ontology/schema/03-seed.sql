-- =============================================================================
-- Process GPT 그래프 온톨로지 — 03. 시드
--   * GraphMeta: 스키마 버전 노드 (배포 확인·마이그레이션 기준점)
--   * Perspective: BSC 4관점 — 테넌트별 시드 함수 + 현존 테넌트 일괄 시드
-- 멱등: MERGE 기반, 재실행 안전.
-- =============================================================================

LOAD 'age';
SET search_path = ag_catalog, "$user", public;

-- -----------------------------------------------------------------------------
-- 1) 스키마 메타 노드
-- -----------------------------------------------------------------------------
DO $$
BEGIN
    EXECUTE format($q$
        SELECT count(*) FROM ag_catalog.cypher('process_gpt', $c$
            MERGE (m:GraphMeta {id: 'meta'})
            SET m.schema_version = '0.2.0',
                m.applied_at = %L
        $c$) AS (x ag_catalog.agtype)
    $q$, now()::text);
END $$;

-- -----------------------------------------------------------------------------
-- 2) BSC 관점(Perspective) 시드 함수 — 테넌트 생성 시마다 호출
--    (기본 4관점. 테넌트별 커스텀 관점 추가는 동일 MERGE 패턴으로 확장)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.graph_seed_perspectives(p_tenant text)
RETURNS void
LANGUAGE plpgsql
SET search_path = ag_catalog, public
AS $fn$
DECLARE
    r record;
BEGIN
    IF p_tenant IS NULL OR length(trim(p_tenant)) = 0 THEN
        RAISE EXCEPTION 'graph_seed_perspectives: tenant id is required';
    END IF;

    FOR r IN
        SELECT * FROM (VALUES
            ('financial',        'Financial',         1),
            ('customer',         'Customer',          2),
            ('internal_process', 'Internal Process',  3),
            ('learning_growth',  'Learning & Growth', 4)
        ) AS t(id, name, sort_order)
    LOOP
        EXECUTE format($q$
            SELECT count(*) FROM ag_catalog.cypher('process_gpt', $c$
                MERGE (p:Perspective {tenant_id: %L, id: %L})
                SET p.name = %L,
                    p.sort_order = %s
            $c$) AS (x ag_catalog.agtype)
        $q$, p_tenant, r.id, r.name, r.sort_order);
    END LOOP;
END $fn$;

-- 하드닝: PostgREST RPC 노출 차단 (그래프 쓰기 함수는 service_role 워커만)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        EXECUTE 'REVOKE EXECUTE ON FUNCTION public.graph_seed_perspectives(text) FROM PUBLIC, anon, authenticated';
        EXECUTE 'GRANT EXECUTE ON FUNCTION public.graph_seed_perspectives(text) TO service_role';
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 3) 현존 테넌트 일괄 시드 (테넌트가 아직 없으면 no-op; 백필 시 재실행)
-- -----------------------------------------------------------------------------
SELECT public.graph_seed_perspectives(id)
FROM public.tenants
WHERE is_deleted = false;

-- -----------------------------------------------------------------------------
-- 4) 적용 확인
-- -----------------------------------------------------------------------------
-- SELECT public.agtext(v) FROM ag_catalog.cypher('process_gpt', $$
--     MATCH (m:GraphMeta {id:'meta'}) RETURN m.schema_version
-- $$) AS (v ag_catalog.agtype);
--
-- SELECT public.agtext(t) AS tenant, count(*) AS perspectives
-- FROM ag_catalog.cypher('process_gpt', $$
--     MATCH (p:Perspective) RETURN p.tenant_id
-- $$) AS (t ag_catalog.agtype)
-- GROUP BY 1;
