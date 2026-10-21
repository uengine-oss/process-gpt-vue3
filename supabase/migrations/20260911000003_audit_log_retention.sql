-- =============================================================================
-- 감사 로그 보관 정책 (docs/security.md 4-3, 항목 17)
--
-- [목표]
--   감사 로그(admin_audit_log / auth_login_audit)는 append-only 라 계속 쌓이기만
--   한다. 보관 기간이 지난 행을 원본에서 _archive 테이블로 옮겨서
--     · 조회 화면(AuditTrail)이 보는 원본 테이블 크기를 일정하게 유지하고
--     · 그렇다고 기록을 없애지는 않는다 (법적 보관 의무 / 사후 조사)
--   는 두 가지를 동시에 만족시킨다.
--
-- [구성]
--   ① public.admin_audit_log_archive / public.auth_login_audit_archive
--      원본과 같은 구조 + archived_at. 관리자만 SELECT, 쓰기 경로 없음.
--   ② public.configuration 의 key = 'audit_log_retention'
--        value = { "retention_days": 365 }
--      테넌트별 설정. 행이 없으면 기본 365일.
--   ③ public.archive_expired_audit_logs(batch, max_batches)
--      경과 행을 배치 단위로 옮긴다. 옮기고(INSERT) 지우는(DELETE) 것이
--      한 문장이라 중간 상태가 남지 않는다.
--   ④ pg_cron 'audit-log-retention' — 매일 03:00 실행.
--      pg_cron 이 없는 환경(로컬 supabase, 일반 Postgres)에서도 이 마이그레이션이
--      실패하지 않도록 전부 조건부/예외 처리로 감쌌다.
--
-- [보관 일수 해석 규칙]
--   · 로그 행의 tenant_id 와 같은 configuration 행이 있으면 그 값
--   · 없으면(또는 로그 행의 tenant_id 가 NULL 이면) 전역 기본값
--     — 전역 기본값은 configuration.tenant_id IS NULL 행이 있으면 그 값, 없으면 365
--   · 어떤 경우든 30 ~ 3650 일로 clamp 한다. 설정 UI 와 같은 범위이며,
--     설정 행이 오염돼도 "어제 로그까지 삭제" 같은 사고가 나지 않게 하는 방어선이다.
--
-- [멱등성] CREATE TABLE IF NOT EXISTS / DROP POLICY IF EXISTS →CREATE /
--          CREATE OR REPLACE FUNCTION / cron 은 같은 이름 unschedule 후 재등록.
--          재실행 안전.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. 선행 테이블 확인
--    두 감사 테이블이 아직 없는 스냅샷에서 이 파일만 돌아가는 경우를 대비한다.
--    (없으면 아카이브 테이블도 만들 수 없으므로 아래 DO 블록들이 알아서 건너뛴다)
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. 아카이브 테이블
--
--    CREATE TABLE ... (LIKE 원본) 을 쓴다. 컬럼 이름/타입/NOT NULL 만 복제하고
--    인덱스·기본값·제약은 가져오지 않는다.
--    INCLUDING ALL 을 쓰지 않는 이유: 원본의 인덱스 5~6개가 그대로 복제되면
--    "거의 조회하지 않는 보관용 테이블"이 원본만큼 무거워진다. 아카이브 조회는
--    기간/테넌트로만 훑으므로 아래에서 인덱스 2개만 직접 만든다.
--    PK 도 복제되지 않으므로 id 에 직접 걸어준다 (중복 아카이브 방지).
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    IF to_regclass('public.admin_audit_log') IS NULL THEN
        RAISE NOTICE 'public.admin_audit_log 이 없어 아카이브 테이블 생성을 건너뜁니다.';
    ELSIF to_regclass('public.admin_audit_log_archive') IS NULL THEN
        CREATE TABLE public.admin_audit_log_archive (LIKE public.admin_audit_log);
        ALTER TABLE public.admin_audit_log_archive
            ADD COLUMN archived_at timestamptz NOT NULL DEFAULT now();
        ALTER TABLE public.admin_audit_log_archive
            ADD CONSTRAINT admin_audit_log_archive_pkey PRIMARY KEY (id);
    ELSE
        -- 이미 있는 DB: archived_at 만 보정
        ALTER TABLE public.admin_audit_log_archive
            ADD COLUMN IF NOT EXISTS archived_at timestamptz NOT NULL DEFAULT now();
    END IF;

    IF to_regclass('public.auth_login_audit') IS NULL THEN
        RAISE NOTICE 'public.auth_login_audit 이 없어 아카이브 테이블 생성을 건너뜁니다.';
    ELSIF to_regclass('public.auth_login_audit_archive') IS NULL THEN
        CREATE TABLE public.auth_login_audit_archive (LIKE public.auth_login_audit);
        ALTER TABLE public.auth_login_audit_archive
            ADD COLUMN archived_at timestamptz NOT NULL DEFAULT now();
        ALTER TABLE public.auth_login_audit_archive
            ADD CONSTRAINT auth_login_audit_archive_pkey PRIMARY KEY (id);
    ELSE
        ALTER TABLE public.auth_login_audit_archive
            ADD COLUMN IF NOT EXISTS archived_at timestamptz NOT NULL DEFAULT now();
    END IF;
END $$;

-- 아카이브용 인덱스 — 조회는 "언제/어느 테넌트" 두 축뿐이다.
DO $$
BEGIN
    IF to_regclass('public.admin_audit_log_archive') IS NOT NULL THEN
        CREATE INDEX IF NOT EXISTS idx_admin_audit_log_archive_created_at
            ON public.admin_audit_log_archive (created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_admin_audit_log_archive_tenant_created_at
            ON public.admin_audit_log_archive (tenant_id, created_at DESC);

        COMMENT ON TABLE public.admin_audit_log_archive IS
            '보관 기간이 지난 admin_audit_log 행의 보관소. archive_expired_audit_logs() 만 기록한다. 관리자만 SELECT, 애플리케이션 쓰기 경로 없음.';
    END IF;

    IF to_regclass('public.auth_login_audit_archive') IS NOT NULL THEN
        CREATE INDEX IF NOT EXISTS idx_auth_login_audit_archive_created_at
            ON public.auth_login_audit_archive (created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_auth_login_audit_archive_tenant_created_at
            ON public.auth_login_audit_archive (tenant_id, created_at DESC);

        COMMENT ON TABLE public.auth_login_audit_archive IS
            '보관 기간이 지난 auth_login_audit 행의 보관소. archive_expired_audit_logs() 만 기록한다. 관리자만 SELECT, 애플리케이션 쓰기 경로 없음.';
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. 아카이브 테이블 RLS
--    · SELECT  : 관리자만 (원본 auth_login_audit 의 판정 로직과 동일)
--    · INSERT/UPDATE/DELETE : 정책을 만들지 않는다 = 전면 차단.
--      기록은 SECURITY DEFINER 함수(소유자 권한)만 할 수 있고, 소유자는 RLS 를
--      우회하므로 정책 없이도 동작한다.
--    · GRANT 단에서도 SELECT 만 남긴다 (이중 안전망).
--
--    admin_audit_log_archive 는 tenant_id 가 NOT NULL 이고
--    auth_login_audit_archive 는 NULL 을 허용하므로 조건을 각각 맞춘다.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    IF to_regclass('public.admin_audit_log_archive') IS NOT NULL THEN
        ALTER TABLE public.admin_audit_log_archive ENABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS admin_audit_log_archive_select ON public.admin_audit_log_archive;
        CREATE POLICY admin_audit_log_archive_select ON public.admin_audit_log_archive
            FOR SELECT TO anon, authenticated
            USING (
                public.current_user_role() = 'admin'
                OR EXISTS (
                    SELECT 1 FROM public.users u
                     WHERE u.id = auth.uid()
                       AND (u.is_admin = true OR lower(COALESCE(u.role, '')) IN ('admin', 'superadmin'))
                )
            );

        REVOKE ALL ON public.admin_audit_log_archive FROM anon, authenticated, PUBLIC;
        GRANT SELECT ON public.admin_audit_log_archive TO anon, authenticated;
    END IF;

    IF to_regclass('public.auth_login_audit_archive') IS NOT NULL THEN
        ALTER TABLE public.auth_login_audit_archive ENABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS auth_login_audit_archive_select ON public.auth_login_audit_archive;
        CREATE POLICY auth_login_audit_archive_select ON public.auth_login_audit_archive
            FOR SELECT TO authenticated
            USING (
                public.current_user_role() = 'admin'
                OR EXISTS (
                    SELECT 1 FROM public.users u
                     WHERE u.id = auth.uid()
                       AND (u.is_admin = true OR lower(COALESCE(u.role, '')) IN ('admin', 'superadmin'))
                )
            );

        REVOKE ALL ON public.auth_login_audit_archive FROM anon, authenticated, PUBLIC;
        GRANT SELECT ON public.auth_login_audit_archive TO authenticated;
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. 보관 일수 설정 키 문서화
--    값은 심지 않는다 — 미설정(기본 365)과 명시적 설정을 구분해야 나중에
--    기본값을 바꿔도 이미 조정해 둔 테넌트를 덮어쓰지 않는다.
--    (20260911000010_tenant_session_timeout.sql 과 같은 판단)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    IF to_regclass('public.configuration') IS NULL THEN
        RAISE NOTICE 'public.configuration 이 없어 보관 일수 설정 준비를 건너뜁니다.';
        RETURN;
    END IF;

    -- 업서트(ON CONFLICT (tenant_id, key))에 필요한 유일 제약 보장.
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conrelid = 'public.configuration'::regclass
           AND conname = 'configuration_tenant_id_key_unique'
    ) THEN
        ALTER TABLE public.configuration
            ADD CONSTRAINT configuration_tenant_id_key_unique UNIQUE (tenant_id, key);
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4. 아카이브 함수
--
--    [SECURITY DEFINER 인 이유 — 필수]
--      원본 두 테이블은 append-only 로 잠겨 있다.
--        · admin_audit_log : RLS ON + DELETE 정책 없음 + REVOKE DELETE
--          (20260526_admin_audit_log_append_only.sql)
--        · auth_login_audit : RLS ON + DELETE 정책 없음 + REVOKE ALL
--          (20260911000001_auth_audit_log.sql)
--      호출자 권한(SECURITY INVOKER)으로 돌면 DELETE 가 반드시 막힌다.
--      SECURITY DEFINER 로 두면 함수 소유자(= 이 마이그레이션을 실행한 롤,
--      보통 postgres/supabase_admin = 테이블 소유자) 권한으로 실행되고,
--      PostgreSQL 은 테이블 소유자에게 RLS 를 적용하지 않는다
--      (FORCE ROW LEVEL SECURITY 를 켠 적이 없으므로). REVOKE 도 anon/
--      authenticated/PUBLIC 대상이라 소유자 권한에는 영향이 없다.
--      → append-only 정책은 "애플리케이션 클라이언트" 를 막는 것이고,
--        보관 정책은 DB 소유자가 수행하는 관리 작업이라 충돌하지 않는다.
--      SECURITY DEFINER 의 필수 안전장치인 search_path 고정도 함께 둔다.
--
--    [배치]
--      한 번의 문장이 p_batch_size 행씩만 옮기고, 최대 p_max_batches 번 반복한다.
--      기본 1000 x 50 = 호출당 최대 50,000 행. 밀린 물량이 많아도 하루치씩
--      따라잡히며, 한 문장이 테이블 전체를 훑고 잠그는 상황을 막는다.
--
--    [원자성]
--      DELETE ... RETURNING 을 CTE 로 감싸 INSERT 와 한 문장으로 묶었다.
--      "지웠는데 아카이브에 없다" 는 중간 상태가 생길 수 없다.
--      함수 전체도 하나의 트랜잭션이므로 중간에 실패하면 전부 롤백된다.
--
--    [컬럼 목록]
--      원본/아카이브 양쪽에 모두 있는 컬럼만 원본의 컬럼 순서대로 뽑아 쓴다.
--      나중에 원본에 컬럼이 추가돼도(감사 로그는 실제로 그런 적이 있다 —
--      20260911000002_admin_audit_log_actor_enforcement.sql) 함수가 깨지지 않고,
--      아카이브에 아직 없는 컬럼은 조용히 제외된다.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.archive_expired_audit_logs(
    p_batch_size  integer DEFAULT 1000,
    p_max_batches integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
    DEFAULT_RETENTION_DAYS constant integer := 365;
    MIN_RETENTION_DAYS     constant integer := 30;
    MAX_RETENTION_DAYS     constant integer := 3650;
    RETENTION_KEY          constant text    := 'audit_log_retention';

    v_pair        record;
    v_global_days integer;
    v_cols        text;
    v_sql         text;
    v_rows        bigint;
    v_moved       bigint;
    v_result      jsonb := '{}'::jsonb;
    v_batch       integer := GREATEST(1, LEAST(COALESCE(p_batch_size, 1000), 100000));
    v_batches     integer := GREATEST(1, LEAST(COALESCE(p_max_batches, 50), 1000));
BEGIN
    -- 전역 기본값: configuration 에 tenant_id IS NULL 행이 있으면 그 값, 없으면 365.
    v_global_days := DEFAULT_RETENTION_DAYS;
    IF to_regclass('public.configuration') IS NOT NULL THEN
        SELECT NULLIF(regexp_replace(COALESCE(c.value ->> 'retention_days', ''), '[^0-9]', '', 'g'), '')::integer
          INTO v_global_days
          FROM public.configuration c
         WHERE c.key = RETENTION_KEY
           AND c.tenant_id IS NULL
         LIMIT 1;
        v_global_days := COALESCE(v_global_days, DEFAULT_RETENTION_DAYS);
    END IF;
    v_global_days := GREATEST(MIN_RETENTION_DAYS, LEAST(MAX_RETENTION_DAYS, v_global_days));

    FOR v_pair IN
        SELECT * FROM (VALUES
            ('admin_audit_log',  'admin_audit_log_archive'),
            ('auth_login_audit', 'auth_login_audit_archive')
        ) AS t(src, arc)
    LOOP
        CONTINUE WHEN to_regclass('public.' || quote_ident(v_pair.src)) IS NULL
                   OR to_regclass('public.' || quote_ident(v_pair.arc)) IS NULL;

        -- 양쪽에 다 있는 컬럼만, 원본 컬럼 순서대로
        SELECT string_agg(quote_ident(s.column_name), ', ' ORDER BY s.ordinal_position)
          INTO v_cols
          FROM information_schema.columns s
         WHERE s.table_schema = 'public'
           AND s.table_name = v_pair.src
           AND EXISTS (
               SELECT 1 FROM information_schema.columns a
                WHERE a.table_schema = 'public'
                  AND a.table_name = v_pair.arc
                  AND a.column_name = s.column_name
           );

        CONTINUE WHEN v_cols IS NULL;

        v_sql := format($sql$
            WITH expired AS (
                SELECT l.id
                  FROM public.%1$I l
                  LEFT JOIN public.configuration c
                         ON c.key = %2$L
                        AND c.tenant_id = l.tenant_id
                 WHERE l.created_at < now() - (
                           GREATEST(%6$s, LEAST(%7$s,
                               COALESCE(
                                   NULLIF(regexp_replace(COALESCE(c.value ->> 'retention_days', ''), '[^0-9]', '', 'g'), '')::integer,
                                   %3$s
                               )
                           )) * INTERVAL '1 day'
                       )
                 ORDER BY l.created_at
                 LIMIT %4$s
            ),
            moved AS (
                DELETE FROM public.%1$I d
                 USING expired e
                 WHERE d.id = e.id
                RETURNING d.*
            )
            INSERT INTO public.%5$I (%8$s, archived_at)
            SELECT %8$s, now() FROM moved
        $sql$,
            v_pair.src,            -- %1$I
            RETENTION_KEY,         -- %2$L
            v_global_days,         -- %3$s
            v_batch,               -- %4$s
            v_pair.arc,            -- %5$I
            MIN_RETENTION_DAYS,    -- %6$s
            MAX_RETENTION_DAYS,    -- %7$s
            v_cols                 -- %8$s  (quote_ident 로 이미 이스케이프됨)
        );

        v_moved := 0;
        FOR i IN 1..v_batches LOOP
            EXECUTE v_sql;
            GET DIAGNOSTICS v_rows = ROW_COUNT;
            v_moved := v_moved + v_rows;
            EXIT WHEN v_rows < v_batch;   -- 마지막 배치 (더 옮길 게 없다)
        END LOOP;

        v_result := v_result || jsonb_build_object(v_pair.src, v_moved);
    END LOOP;

    RETURN v_result || jsonb_build_object(
        'global_retention_days', v_global_days,
        'ran_at', now()
    );
END;
$fn$;

COMMENT ON FUNCTION public.archive_expired_audit_logs(integer, integer) IS
'보관 기간이 지난 감사 로그를 _archive 테이블로 옮긴다(원본에서 삭제). 보관 일수는 configuration.audit_log_retention 의 retention_days(테넌트별), 미설정 시 365일, 30~3650일로 clamp. append-only 제약(REVOKE DELETE/RLS)을 통과해야 하므로 SECURITY DEFINER.';

-- 실행 권한은 DB 소유자(cron 작업 실행자)에게만. 애플리케이션 롤은 호출 불가 —
-- 감사 로그를 지우는 함수를 클라이언트 키로 부를 수 있으면 안 된다.
REVOKE ALL ON FUNCTION public.archive_expired_audit_logs(integer, integer) FROM PUBLIC, anon, authenticated;

COMMIT;

-- ---------------------------------------------------------------------------
-- 5. pg_cron 스케줄 등록 (매일 03:00)
--
--    · pg_cron extension 이 없는 환경(로컬 supabase, 일반 Postgres 컨테이너,
--      CI)에서 마이그레이션이 실패하면 안 되므로 존재 확인 + 예외 삼킴.
--    · 같은 이름의 기존 스케줄을 먼저 unschedule 해서 재실행 시 중복 등록을
--      막는다 (pg_cron 은 같은 이름으로 여러 job 을 만들 수 있다).
--    · cron.schedule 은 트랜잭션 밖에서 돌려야 안전하므로 COMMIT 뒤에 둔다.
--    · 시각 기준은 pg_cron 설정(cron.timezone, 기본 GMT)이다. 운영에서 KST
--      03:00 에 돌리려면 '0 18 * * *' 로 바꾸거나 cron.timezone 을 조정한다.
-- ---------------------------------------------------------------------------
DO $cron_setup$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        RAISE NOTICE 'pg_cron 이 설치되어 있지 않아 audit-log-retention 스케줄 등록을 건너뜁니다. 운영 DB 에서는 다음을 수동 실행하세요: SELECT cron.schedule(''audit-log-retention'', ''0 3 * * *'', ''SELECT public.archive_expired_audit_logs();'');';
        RETURN;
    END IF;

    -- 기존 동명 스케줄 제거 (없으면 예외가 나므로 삼킨다)
    BEGIN
        PERFORM cron.unschedule('audit-log-retention');
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    PERFORM cron.schedule(
        'audit-log-retention',
        '0 3 * * *',
        'SELECT public.archive_expired_audit_logs();'
    );
    RAISE NOTICE 'pg_cron 스케줄 audit-log-retention 등록 완료 (매일 03:00).';
EXCEPTION WHEN OTHERS THEN
    -- 권한 부족 등 어떤 이유로든 스케줄 등록이 실패해도 마이그레이션은 통과시킨다.
    RAISE NOTICE 'audit-log-retention 스케줄 등록 실패(무시): %', SQLERRM;
END;
$cron_setup$;

-- =============================================================================
-- 검증 쿼리 (적용 후 별도 실행)
-- =============================================================================
-- ① 아카이브 테이블/RLS
--    SELECT relname, relrowsecurity FROM pg_class
--     WHERE relname IN ('admin_audit_log_archive','auth_login_audit_archive');
--
-- ② 함수 동작 (pg_cron 없이도 확인 가능)
--    SELECT public.archive_expired_audit_logs();
--    → {"admin_audit_log": 0, "auth_login_audit": 0, "global_retention_days": 365, ...}
--
-- ③ 테넌트별 보관 일수 설정 (관리자 콘솔 > 시스템 운영 에서도 가능)
--    INSERT INTO public.configuration (tenant_id, key, value)
--    VALUES ('<tenant>', 'audit_log_retention', '{"retention_days": 90}'::jsonb)
--    ON CONFLICT (tenant_id, key) DO UPDATE SET value = EXCLUDED.value;
--
-- ④ 전역 기본값 변경 (tenant_id NULL 행)
--    INSERT INTO public.configuration (tenant_id, key, value)
--    VALUES (NULL, 'audit_log_retention', '{"retention_days": 180}'::jsonb);
--
-- ⑤ 스케줄 확인
--    SELECT jobname, schedule, command, active FROM cron.job WHERE jobname = 'audit-log-retention';
--
-- =============================================================================
-- 롤백
-- =============================================================================
-- SELECT cron.unschedule('audit-log-retention');
-- BEGIN;
-- DROP FUNCTION IF EXISTS public.archive_expired_audit_logs(integer, integer);
-- -- 아카이브 테이블은 기록이므로 기본적으로 남긴다. 정말 지우려면:
-- -- DROP TABLE IF EXISTS public.admin_audit_log_archive;
-- -- DROP TABLE IF EXISTS public.auth_login_audit_archive;
-- COMMIT;
