-- =============================================================================
-- ontological-db 감사 로그 보존 — og_data.og_audit 정리 (specs/014-ontology-graph-platform)
--
-- [배경]
--   ontological-db 엔진은 og_cypher 호출마다 og_data.og_audit 에 한 행을 넣는다(끌 수 있는 설정도,
--   보존 정책도 없다 — supabase/ontological/README.md 상류 이슈 #8·#10). strategy-service 의 60초 주기
--   동기화가 매분 수백 번 MERGE 하던 시기에 하루 10만 행·10MB 씩 쌓여, 실제 그래프(약 8MB)보다
--   감사 로그(62MB)가 훨씬 커졌다. 동기화는 원천 지문이 같으면 건너뛰게 고쳤고, 여기서는 남는 로그를
--   일정 기간만 보관한다. 이 표를 읽는 기능은 플랫폼에 없다(엔진의 에이전트 이력 조회용).
--
-- [구성]
--   ① public.purge_og_audit(p_keep_days, p_batch_size) — at 이 보존 일수를 넘긴 행을 배치로 지운다.
--      확장이 없는 DB(스냅샷·클라우드)에서는 아무것도 하지 않는다.
--   ② pg_cron 'og-audit-retention' — 매일 04:10, 14일 보관. pg_cron 이 없는 환경에서도 통과.
--
-- [멱등성] CREATE OR REPLACE FUNCTION / cron 은 같은 이름 unschedule 후 재등록. 재실행 안전.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.purge_og_audit(
    p_keep_days integer DEFAULT 14,
    p_batch_size integer DEFAULT 20000
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
    v_days  integer := GREATEST(1, LEAST(COALESCE(p_keep_days, 14), 365));
    v_batch integer := GREATEST(1, LEAST(COALESCE(p_batch_size, 20000), 100000));
    v_rows  bigint;
    v_total bigint := 0;
BEGIN
    IF to_regclass('og_data.og_audit') IS NULL THEN
        RETURN 0;
    END IF;
    LOOP
        EXECUTE format(
            'DELETE FROM og_data.og_audit WHERE audit_id IN (
                 SELECT audit_id FROM og_data.og_audit WHERE at < now() - make_interval(days => %s) LIMIT %s)',
            v_days, v_batch);
        GET DIAGNOSTICS v_rows = ROW_COUNT;
        v_total := v_total + v_rows;
        EXIT WHEN v_rows < v_batch;
    END LOOP;
    RETURN v_total;
END;
$fn$;

REVOKE ALL ON FUNCTION public.purge_og_audit(integer, integer) FROM PUBLIC, anon, authenticated;

COMMIT;

DO $cron$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'og-audit-retention';
        PERFORM cron.schedule('og-audit-retention', '10 4 * * *', 'SELECT public.purge_og_audit(14)');
    END IF;
END;
$cron$;
