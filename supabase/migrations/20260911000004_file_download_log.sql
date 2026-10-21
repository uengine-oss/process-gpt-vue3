-- ============================================================================
-- 파일 다운로드 이력 + 이상 탐지 (file_download_log)
--
-- [목표] 보안 확인표 항목 8(파일 다운로드 통제) / 18(이상 행위 탐지)
--        docs/security.md "3-3. 다운로드 이력과 이상 탐지"
--
-- [선행] 3-1 버킷 비공개 전환(20260911000009_storage_private_buckets.sql) +
--        3-2 서명 URL/.download() 전환. 파일을 꺼내는 길이 두 가지로 좁혀졌다.
--          · storage.download()      → 브라우저가 바이트를 직접 받는다
--          · createSignedUrl()       → 1시간짜리 주소가 나간다(그 주소로 받는다)
--        둘 다 "파일이 사용자 손에 들어간 사건" 이므로 같은 표에 남긴다.
--        (action 으로 구분: 'download' / 'signed_url' / 'view')
--
-- [설계 요약 — 20260911000001_auth_audit_log.sql 의 감사 RPC 관례를 그대로 따른다]
--   · 기록은 SECURITY DEFINER RPC `public.record_file_download()` 로만.
--     클라이언트 직접 INSERT 는 정책/권한 양쪽에서 막는다(위조 방지).
--   · user_id 는 파라미터로 받지 않고 `auth.uid()` 로 강제한다.
--     "내가 아닌 남이 받은 것처럼" 기록할 방법이 없어야 한다.
--   · IP / User-Agent 도 클라이언트 값을 믿지 않고 PostgREST 가 넘겨주는
--     `request.headers` 에서 서버측으로 뽑는다.
--   · RPC 는 어떤 경우에도 예외를 던지지 않는다 — 감사 기록 실패가 다운로드를
--     막으면 안 된다(호출부도 try/catch 하지만 이중 방어).
--   · 조회는 관리자만, 같은 테넌트만. append-only(UPDATE/DELETE 정책 없음 + REVOKE).
--
-- [이상 탐지]
--   · `public.detect_download_anomalies()` — 오늘(서버 기준 날짜) 사용자별 다운로드
--     건수가 임계치를 넘으면 그 테넌트 관리자들에게 `notifications` 알림을 넣는다.
--   · 임계치: configuration 키 `download_anomaly` 의 `daily_threshold`
--     (테넌트 행 → 전역(tenant_id IS NULL) 행 → 기본 100).
--   · 같은 날 같은 사용자에 대한 중복 알림은 notifications.id 를 결정적(deterministic)
--     UUID 로 만들어 ON CONFLICT DO NOTHING 으로 막는다. 카운터 테이블이 따로 필요 없다.
--   · pg_cron 이 매시 정각에 돌리되, pg_cron 이 없는 환경(로컬/CI)에서도 마이그레이션은
--     통과해야 하므로 스케줄 등록은 가드 + 예외 삼킴. 함수는 pg_cron 없이 직접 호출 가능.
--
-- idempotent — 재실행해도 안전하다.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. 테이블
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.file_download_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz NOT NULL DEFAULT now(),

    -- 감사 기록이 테넌트 참조 무결성 때문에 실패하면 안 되므로 FK 를 걸지 않는다
    -- (auth_login_audit 과 같은 판단). 미상일 수 있어 NULL 허용.
    tenant_id text NULL,

    -- auth.uid(). RPC 가 강제로 채운다(클라이언트가 지정할 수 없다).
    user_id uuid NULL,

    -- 조회 화면에서 사람이 알아보는 값. user_id 로 매번 조인하지 않으려고 함께 남긴다.
    email text NULL,

    bucket text NOT NULL,
    path text NOT NULL,

    -- 사용자에게 보인 이름(업로드 당시 원본 파일명). path 는 `<ts>_<uuid8>.<ext>` 라 읽기 어렵다.
    file_name text NULL,

    -- download   : 바이트를 직접 받았다 (storage.download)
    -- signed_url : 다운로드용 서명 URL 을 발급했다 (그 주소로 받을 수 있다)
    -- view       : 화면에서 열어 봤다 (미리보기 등)
    action text NOT NULL DEFAULT 'download',

    -- 서버측에서 캡처한 클라이언트 정보 (클라이언트 입력 아님)
    ip_address text NULL,
    user_agent text NULL,

    -- 호출 지점(source), 파일 크기, 정책문서 id 등 부가 정보
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- 이미 만들어진 DB 대비 (컬럼 누락 보정)
ALTER TABLE public.file_download_log ADD COLUMN IF NOT EXISTS tenant_id  text NULL;
ALTER TABLE public.file_download_log ADD COLUMN IF NOT EXISTS user_id    uuid NULL;
ALTER TABLE public.file_download_log ADD COLUMN IF NOT EXISTS email      text NULL;
ALTER TABLE public.file_download_log ADD COLUMN IF NOT EXISTS file_name  text NULL;
ALTER TABLE public.file_download_log ADD COLUMN IF NOT EXISTS ip_address text NULL;
ALTER TABLE public.file_download_log ADD COLUMN IF NOT EXISTS user_agent text NULL;
ALTER TABLE public.file_download_log ADD COLUMN IF NOT EXISTS metadata   jsonb NOT NULL DEFAULT '{}'::jsonb;

-- action 허용값 (재실행 안전하도록 항상 DROP 후 ADD)
ALTER TABLE public.file_download_log DROP CONSTRAINT IF EXISTS file_download_log_action_check;
ALTER TABLE public.file_download_log
    ADD CONSTRAINT file_download_log_action_check
    CHECK (action IN ('download', 'signed_url', 'view'));

-- ---------------------------------------------------------------------------
-- 2. 인덱스
--    ① 관리자 화면 기본 정렬       created_at DESC
--    ② 테넌트 스코프 목록          (tenant_id, created_at DESC)
--    ③ 사용자별 이력 + 이상 탐지    (user_id, created_at DESC)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_file_download_log_created_at
    ON public.file_download_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_file_download_log_tenant_created_at
    ON public.file_download_log (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_file_download_log_user_created_at
    ON public.file_download_log (user_id, created_at DESC);
-- 이메일 필터(화면 기본 검색 조건)
CREATE INDEX IF NOT EXISTS idx_file_download_log_email_created_at
    ON public.file_download_log (email, created_at DESC);

COMMENT ON TABLE public.file_download_log IS
'파일 다운로드/서명URL 발급 이력. append-only (UPDATE/DELETE 차단). 기록은 public.record_file_download() RPC 로만, 조회는 관리자만.';
COMMENT ON COLUMN public.file_download_log.action IS 'download(바이트 직접 수신) | signed_url(다운로드용 서명 URL 발급) | view(화면 열람)';
COMMENT ON COLUMN public.file_download_log.user_id IS 'auth.uid() — RPC 가 강제로 채운다. 클라이언트가 지정할 수 없다.';
COMMENT ON COLUMN public.file_download_log.ip_address IS 'PostgREST request.headers 의 x-forwarded-for/x-real-ip 에서 서버측 캡처 (클라이언트 입력 아님)';

-- ---------------------------------------------------------------------------
-- 3. RLS — 켜는 순간 정책 없는 동작은 전부 차단된다. 필요한 것만 연다.
-- ---------------------------------------------------------------------------
ALTER TABLE public.file_download_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "file_download_log_select_admin" ON public.file_download_log;
DROP POLICY IF EXISTS "file_download_log_insert_self" ON public.file_download_log;

-- (3-1) INSERT 정책을 만들지 않는다 = 직접 INSERT 전면 차단. 기록은 RPC 전용.
--       (auth_login_audit 은 로그인 전 anon 상황 때문에 "자기 기록" INSERT 를 열어
--        뒀지만, 다운로드는 항상 인증된 요청이라 열어 둘 이유가 없다.)

-- (3-2) SELECT — 관리자만, 같은 테넌트만.
--       관리자 판정은 레포 표준 헬퍼 public.current_user_role() 을 쓰고,
--       JWT 에 tenant 클레임이 없어 헬퍼가 판정하지 못하는 경우를 위해
--       users 테이블 직접 조회를 OR 로 함께 둔다 (auth_login_audit 과 동일).
CREATE POLICY "file_download_log_select_admin" ON public.file_download_log
    FOR SELECT TO authenticated
    USING (
        (file_download_log.tenant_id IS NULL OR file_download_log.tenant_id = public.tenant_id()
         OR EXISTS (
             SELECT 1 FROM public.users u
             WHERE u.id = auth.uid() AND u.tenant_id = file_download_log.tenant_id
         ))
        AND (
            public.current_user_role() = 'admin'
            OR EXISTS (
                SELECT 1
                FROM public.users u
                WHERE u.id = auth.uid()
                  AND (u.is_admin = true OR lower(COALESCE(u.role, '')) IN ('admin', 'superadmin'))
            )
        )
    );

-- (3-3) UPDATE / DELETE — 정책을 만들지 않는다 = 차단 (append-only)

-- ---------------------------------------------------------------------------
-- 4. GRANT / REVOKE — RLS 와 별개인 두 번째 안전망
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.file_download_log FROM anon, authenticated, PUBLIC;
GRANT SELECT ON public.file_download_log TO authenticated;   -- 정책상 관리자만
-- INSERT 는 주지 않는다. 기록은 SECURITY DEFINER RPC 로만 들어온다.

-- ---------------------------------------------------------------------------
-- 5. 기록 RPC
--
--    파라미터로 받는 것: 어떤 파일을(bucket/path/file_name), 어떤 행위로(action),
--    어떤 맥락에서(metadata) 가져갔는지. 그 밖의 "누가/어디서" 는 전부 서버가 채운다.
--      user_id    ← auth.uid()
--      email      ← users 조회 → 없으면 JWT 클레임
--      tenant_id  ← public.tenant_id() → 없으면 users 조회
--      ip / ua    ← request.headers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_file_download(
    p_bucket text,
    p_path text,
    p_file_name text DEFAULT NULL,
    p_action text DEFAULT 'download',
    p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $fn$
DECLARE
    v_action    text;
    v_bucket    text;
    v_path      text;
    v_uid       uuid;
    v_email       text;
    v_tenant_id   text;
    v_user_tenant text;
    v_headers   jsonb;
    v_agent     text;
    v_ip        text;
    v_meta      jsonb;
BEGIN
    v_action := lower(btrim(COALESCE(p_action, 'download')));
    IF v_action NOT IN ('download', 'signed_url', 'view') THEN
        -- 알 수 없는 액션은 조용히 버린다 (예외를 던지면 다운로드 흐름이 흔들린다)
        RETURN;
    END IF;

    v_bucket := NULLIF(btrim(COALESCE(p_bucket, '')), '');
    v_path   := NULLIF(btrim(COALESCE(p_path, '')), '');
    -- 무엇을 가져갔는지 모르면 남길 가치가 없다.
    IF v_bucket IS NULL OR v_path IS NULL THEN
        RETURN;
    END IF;

    v_uid := auth.uid();

    -- 테넌트/이메일: JWT 클레임 우선, 없으면 users 조회.
    BEGIN
        v_tenant_id := NULLIF(btrim(COALESCE(public.tenant_id(), '')), '');
    EXCEPTION WHEN OTHERS THEN
        v_tenant_id := NULL;
    END;

    IF v_uid IS NOT NULL THEN
        BEGIN
            -- SELECT ... INTO 는 행이 없으면 변수를 NULL 로 덮어쓴다.
            -- JWT 에서 얻은 tenant_id 를 잃지 않도록 별도 변수에 받고 나중에 합친다.
            SELECT NULLIF(btrim(COALESCE(u.email, '')), ''), NULLIF(btrim(COALESCE(u.tenant_id, '')), '')
              INTO v_email, v_user_tenant
              FROM public.users u
             WHERE u.id = v_uid
             LIMIT 1;
        EXCEPTION WHEN OTHERS THEN
            v_email := NULL;
            v_user_tenant := NULL;
        END;
        v_tenant_id := COALESCE(v_tenant_id, v_user_tenant);
    END IF;

    IF v_email IS NULL THEN
        BEGIN
            v_email := NULLIF(btrim(COALESCE(auth.jwt() ->> 'email', '')), '');
        EXCEPTION WHEN OTHERS THEN
            v_email := NULL;
        END;
    END IF;

    -- PostgREST 가 넣어주는 요청 헤더. 실행 컨텍스트에 따라 없을 수 있다.
    BEGIN
        v_headers := NULLIF(current_setting('request.headers', true), '')::jsonb;
    EXCEPTION WHEN OTHERS THEN
        v_headers := NULL;
    END;

    v_agent := left(btrim(COALESCE(v_headers ->> 'user-agent', '')), 1000);

    IF v_headers ? 'x-forwarded-for' THEN
        v_ip := btrim(split_part(v_headers ->> 'x-forwarded-for', ',', 1));
    ELSIF v_headers ? 'x-real-ip' THEN
        v_ip := btrim(v_headers ->> 'x-real-ip');
    ELSE
        v_ip := NULL;
    END IF;

    -- 헤더 전체를 넣지 않는다 (authorization/apikey 등 토큰 저장 방지).
    v_meta := COALESCE(p_metadata, '{}'::jsonb);
    IF jsonb_typeof(v_meta) <> 'object' THEN
        v_meta := '{}'::jsonb;
    END IF;
    IF v_headers IS NOT NULL THEN
        v_meta := v_meta || jsonb_strip_nulls(jsonb_build_object(
            'origin',  v_headers ->> 'origin',
            'referer', v_headers ->> 'referer'
        ));
    END IF;

    INSERT INTO public.file_download_log (
        tenant_id, user_id, email, bucket, path, file_name,
        action, ip_address, user_agent, metadata
    ) VALUES (
        v_tenant_id,
        v_uid,
        v_email,
        left(v_bucket, 200),
        left(v_path, 2000),
        left(NULLIF(btrim(COALESCE(p_file_name, '')), ''), 500),
        v_action,
        NULLIF(v_ip, ''),
        NULLIF(v_agent, ''),
        v_meta
    );
EXCEPTION WHEN OTHERS THEN
    -- 기록 실패가 다운로드를 막지 않도록 삼킨다.
    RAISE WARNING 'record_file_download failed: %', SQLERRM;
END;
$fn$;

COMMENT ON FUNCTION public.record_file_download(text, text, text, text, jsonb) IS
'파일 다운로드/서명URL 발급 기록. user_id 는 auth.uid() 로 강제하고 IP/User-Agent 는 서버측 헤더에서 캡처한다. 어떤 경우에도 예외를 던지지 않는다.';

REVOKE ALL ON FUNCTION public.record_file_download(text, text, text, text, jsonb) FROM PUBLIC;
-- anon 에게는 주지 않는다. 버킷이 비공개라 다운로드 자체가 인증 요청이다.
GRANT EXECUTE ON FUNCTION public.record_file_download(text, text, text, text, jsonb) TO authenticated;

-- ---------------------------------------------------------------------------
-- 6. 임계치 설정 키 준비 (configuration.download_anomaly)
--    값은 심지 않는다 — 미설정(기본 100)과 명시적 설정을 구분해야 나중에 기본값을
--    바꿔도 이미 조정해 둔 테넌트를 덮어쓰지 않는다
--    (20260911000003_audit_log_retention.sql / 20260911000010_tenant_session_timeout.sql 과 같은 판단).
-- ---------------------------------------------------------------------------
DO $cfg$
BEGIN
    IF to_regclass('public.configuration') IS NULL THEN
        RAISE NOTICE 'public.configuration 이 없어 다운로드 임계치 설정 준비를 건너뜁니다.';
        RETURN;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conrelid = 'public.configuration'::regclass
           AND conname = 'configuration_tenant_id_key_unique'
    ) THEN
        ALTER TABLE public.configuration
            ADD CONSTRAINT configuration_tenant_id_key_unique UNIQUE (tenant_id, key);
    END IF;
END
$cfg$;

-- ---------------------------------------------------------------------------
-- 7. 이상 탐지 함수
--
--    [무엇을 본다]
--      오늘(created_at >= date_trunc('day', now()))의 사용자별 다운로드 건수.
--      action 은 구분하지 않는다 — 서명 URL 을 100장 받아 가는 것도 같은 신호다.
--
--    [임계치]
--      configuration.download_anomaly 의 daily_threshold.
--      테넌트 행 → 전역(tenant_id IS NULL) 행 → 기본 100. 1~1,000,000 으로 clamp.
--      p_threshold 를 주면 그 값이 모든 테넌트를 덮어쓴다(수동 점검/테스트용).
--
--    [중복 방지]
--      notifications.id 를 (사용자, 날짜, 받는 관리자) 로 결정되는 UUID 로 만들고
--      ON CONFLICT (id) DO NOTHING 한다. 매시 돌아도 하루에 한 번만 들어간다.
--      건수가 더 늘어도 다시 알리지 않는다 — 알림 폭주보다 한 번의 신호가 낫다.
--
--    [SECURITY DEFINER 인 이유]
--      cron(또는 관리자)이 부르는 관리 작업이고, file_download_log 는 SELECT 가
--      관리자 RLS 로 잠겨 있으며 notifications 에도 RLS 가 있을 수 있다.
--      실행 권한은 애플리케이션 롤에 주지 않는다(아래 REVOKE).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.detect_download_anomalies(
    p_threshold integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
    DEFAULT_THRESHOLD constant integer := 100;
    MIN_THRESHOLD     constant integer := 1;
    MAX_THRESHOLD     constant integer := 1000000;
    ANOMALY_KEY       constant text    := 'download_anomaly';

    v_global_threshold integer := DEFAULT_THRESHOLD;
    v_override         integer := NULL;
    v_has_config       boolean := to_regclass('public.configuration') IS NOT NULL;
    v_day              date    := (now() AT TIME ZONE 'UTC')::date;
    v_row              record;
    v_admin            record;
    v_threshold        integer;
    v_anomalies        integer := 0;
    v_notified         integer := 0;
    v_title            text;
    v_desc             text;
BEGIN
    IF to_regclass('public.file_download_log') IS NULL THEN
        RETURN jsonb_build_object('skipped', 'file_download_log 없음');
    END IF;

    IF p_threshold IS NOT NULL THEN
        v_override := GREATEST(MIN_THRESHOLD, LEAST(MAX_THRESHOLD, p_threshold));
    ELSIF v_has_config THEN
        SELECT NULLIF(regexp_replace(COALESCE(c.value ->> 'daily_threshold', ''), '[^0-9]', '', 'g'), '')::integer
          INTO v_global_threshold
          FROM public.configuration c
         WHERE c.key = ANOMALY_KEY
           AND c.tenant_id IS NULL
         LIMIT 1;
        v_global_threshold := COALESCE(v_global_threshold, DEFAULT_THRESHOLD);
    END IF;
    v_global_threshold := GREATEST(MIN_THRESHOLD, LEAST(MAX_THRESHOLD, v_global_threshold));

    FOR v_row IN
        SELECT d.tenant_id,
               d.user_id,
               COALESCE(max(d.email), d.user_id::text) AS email,
               count(*)::integer AS download_count
          FROM public.file_download_log d
         WHERE d.created_at >= date_trunc('day', now())
           AND d.user_id IS NOT NULL
         GROUP BY d.tenant_id, d.user_id
    LOOP
        -- 테넌트별 임계치 (없으면 전역값)
        v_threshold := v_global_threshold;
        IF v_override IS NOT NULL THEN
            v_threshold := v_override;
        ELSIF v_has_config AND v_row.tenant_id IS NOT NULL THEN
            SELECT NULLIF(regexp_replace(COALESCE(c.value ->> 'daily_threshold', ''), '[^0-9]', '', 'g'), '')::integer
              INTO v_threshold
              FROM public.configuration c
             WHERE c.key = ANOMALY_KEY
               AND c.tenant_id = v_row.tenant_id
             LIMIT 1;
            v_threshold := GREATEST(MIN_THRESHOLD, LEAST(MAX_THRESHOLD, COALESCE(v_threshold, v_global_threshold)));
        END IF;

        CONTINUE WHEN v_row.download_count <= v_threshold;
        v_anomalies := v_anomalies + 1;

        CONTINUE WHEN to_regclass('public.notifications') IS NULL
                   OR to_regclass('public.users') IS NULL;

        v_title := '비정상 다운로드 감지';
        v_desc := v_row.email || ' 계정이 오늘 ' || v_row.download_count
               || '건을 내려받았습니다. (임계치 ' || v_threshold || '건)';

        -- 같은 테넌트 관리자 전원에게. 테넌트가 미상인 행은 알릴 대상을 특정할 수
        -- 없으므로 건너뛴다(카운트에는 남는다).
        FOR v_admin IN
            SELECT DISTINCT u.email
              FROM public.users u
             WHERE u.tenant_id IS NOT DISTINCT FROM v_row.tenant_id
               AND v_row.tenant_id IS NOT NULL
               AND COALESCE(btrim(u.email), '') <> ''
               AND (u.is_admin = true OR lower(COALESCE(u.role, '')) IN ('admin', 'superadmin'))
        LOOP
            BEGIN
                INSERT INTO public.notifications (
                    id, user_id, type, title, description, url,
                    is_checked, time_stamp, tenant_id
                ) VALUES (
                    -- (사용자, 날짜, 받는 관리자) 로 결정되는 UUID = 하루 한 번 보장
                    md5('download_anomaly|' || v_row.user_id::text || '|' || v_day::text || '|' || v_admin.email)::uuid,
                    v_admin.email,
                    'download_anomaly',
                    v_title,
                    v_desc,
                    '/admin?tab=audit-trail',
                    false,
                    now(),
                    v_row.tenant_id
                )
                ON CONFLICT (id) DO NOTHING;
                IF FOUND THEN
                    v_notified := v_notified + 1;
                END IF;
            EXCEPTION WHEN OTHERS THEN
                -- 알림 하나가 실패해도 나머지 탐지는 계속한다.
                RAISE WARNING 'detect_download_anomalies notify failed (%): %', v_admin.email, SQLERRM;
            END;
        END LOOP;
    END LOOP;

    RETURN jsonb_build_object(
        'anomalies', v_anomalies,
        'notifications_inserted', v_notified,
        'default_threshold', v_global_threshold,
        'day', v_day,
        'ran_at', now()
    );
END;
$fn$;

COMMENT ON FUNCTION public.detect_download_anomalies(integer) IS
'오늘 사용자별 다운로드 건수가 임계치를 넘으면 그 테넌트 관리자에게 notifications 알림을 적재한다. 임계치는 configuration.download_anomaly 의 daily_threshold(테넌트별 → 전역 → 기본 100). 같은 날 같은 사용자에 대한 중복 알림은 결정적 UUID + ON CONFLICT 로 막는다.';

-- 애플리케이션 롤은 호출할 수 없다 — 관리자 알림을 클라이언트 키로 만들 수 있으면 안 된다.
REVOKE ALL ON FUNCTION public.detect_download_anomalies(integer) FROM PUBLIC, anon, authenticated;

COMMIT;

-- ---------------------------------------------------------------------------
-- 8. pg_cron 스케줄 등록 (매시 정각)
--
--    · pg_cron 이 없는 환경(로컬 supabase, 일반 Postgres 컨테이너, CI)에서
--      마이그레이션이 실패하면 안 되므로 존재 확인 + 예외 삼킴.
--    · 같은 이름의 기존 스케줄을 먼저 unschedule 해서 재실행 시 중복 등록을 막는다.
--    · cron.schedule 은 트랜잭션 밖에서 돌려야 안전하므로 COMMIT 뒤에 둔다.
--      (20260911000003_audit_log_retention.sql 과 같은 방식)
-- ---------------------------------------------------------------------------
DO $cron_setup$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        RAISE NOTICE 'pg_cron 이 설치되어 있지 않아 download-anomaly-detection 스케줄 등록을 건너뜁니다. 운영 DB 에서는 다음을 수동 실행하세요: SELECT cron.schedule(''download-anomaly-detection'', ''0 * * * *'', ''SELECT public.detect_download_anomalies();'');';
        RETURN;
    END IF;

    BEGIN
        PERFORM cron.unschedule('download-anomaly-detection');
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    PERFORM cron.schedule(
        'download-anomaly-detection',
        '0 * * * *',
        'SELECT public.detect_download_anomalies();'
    );
    RAISE NOTICE 'pg_cron 스케줄 download-anomaly-detection 등록 완료 (매시 정각).';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'download-anomaly-detection 스케줄 등록 실패(무시): %', SQLERRM;
END;
$cron_setup$;

-- ============================================================================
-- 검증 쿼리 (적용 후 별도 실행)
-- ============================================================================
-- ① RLS 활성화:  SELECT relname, relrowsecurity FROM pg_class WHERE relname='file_download_log';
-- ② 정책 1개:    SELECT polname, polcmd FROM pg_policy WHERE polrelid='public.file_download_log'::regclass;
--                → file_download_log_select_admin / r   (INSERT 정책 없음 = RPC 전용)
-- ③ 기록 동작:   SELECT public.record_file_download('files','uploads/1_a.pdf','보고서.pdf','download','{"source":"test"}');
--                SELECT created_at, email, bucket, path, file_name, action, ip_address
--                  FROM public.file_download_log ORDER BY created_at DESC LIMIT 5;
-- ④ 위조 차단:   INSERT INTO public.file_download_log(bucket,path) VALUES('files','x'); → 권한 오류면 정상
-- ⑤ 이상 탐지:   SELECT public.detect_download_anomalies(1);   -- 임계치 1로 강제
--                SELECT * FROM public.notifications WHERE type='download_anomaly';
-- ⑥ 임계치 설정: INSERT INTO public.configuration (tenant_id, key, value)
--                VALUES ('<tenant>', 'download_anomaly', '{"daily_threshold": 50}'::jsonb)
--                ON CONFLICT (tenant_id, key) DO UPDATE SET value = EXCLUDED.value;
-- ⑦ 스케줄:      SELECT jobname, schedule FROM cron.job WHERE jobname='download-anomaly-detection';
-- ============================================================================
-- 롤백
-- ============================================================================
-- BEGIN;
-- DROP FUNCTION IF EXISTS public.detect_download_anomalies(integer);
-- DROP FUNCTION IF EXISTS public.record_file_download(text, text, text, text, jsonb);
-- DROP TABLE IF EXISTS public.file_download_log;
-- COMMIT;
-- SELECT cron.unschedule('download-anomaly-detection');
