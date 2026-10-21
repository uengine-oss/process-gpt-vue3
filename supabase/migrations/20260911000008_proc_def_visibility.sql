-- ============================================================================
-- 프로세스 공개 범위 (proc_def.visibility / proc_def.allowed_org_codes)
--
-- [목표] 보안 확인표 항목 5 / docs/security.md "4-2. 프로세스 공개 범위"
--
-- [설계 요약]
--   1) proc_def 에 공개 범위 컬럼 2개를 추가한다.
--        · visibility          text   'all' | 'org' | 'private'   (기본 'all')
--        · allowed_org_codes   text[] visibility='org' 일 때 허용 조직 코드 목록
--      기존 행은 DEFAULT 'all' 로 채워져 **조회 동작이 바뀌지 않는다.**
--   2) SELECT RLS 를 visibility 기준으로 재작성한다.
--        · admin 이상            → 항상 조회 가능
--        · visibility='all'      → 기존과 동일 (테넌트 내 공개)
--        · visibility='org'      → 사용자의 조직 코드가 allowed_org_codes 에 포함될 때만
--        · visibility='private'  → 작성자(= proc_def.owner) 와 관리자만
--
-- [조직 코드 체계 — 이 레포의 실제 모습]
--   조직도는 별도 테이블이 아니라 `configuration` 테이블의 key='organization' 행
--   (`value->'chart'`) 에 JSONB 트리로 저장된다. 부서 노드는 `data.isTeam = true` 이고
--   **노드 id(UUID 문자열, 루트는 'root')가 곧 조직 코드**다.
--   (src/views/organization/orgChartModel.ts, src/utils/organizationUtils.ts 참고)
--
--   사용자 ↔ 조직 연결은 두 갈래가 공존한다. 어느 한쪽만 보면 누락이 생기므로
--   `public.current_user_org_codes()` 는 아래를 **모두** 모아 하나의 키 집합으로 만든다.
--     ① users 컬럼      : department_id(= 조직도 노드 id), department_name,
--                         org_code / org_name (사내 SSO app_metadata 에서 온 외부 코드)
--     ② 조직도 트리 탐색 : 사용자(id/email/username) 노드를 찾아 **상위 부서 전부**의
--                         id · name · org_code 를 수집한다. 상위 조직을 지정하면 그 하위
--                         부서 구성원도 함께 열람 가능해야 하기 때문이다.
--                         (클라이언트 organizationUtils.getCurrentUserOrganizations() 와 동일 규약)
--
-- [테넌트 판별]
--   이 레포의 표준대로 `public.tenant_id()` (JWT app_metadata.tenant_id) 를 쓴다.
--   ※ 기존 SELECT 정책은 `USING (true)` 라 테넌트 비교 자체가 없었다. 여기서
--     `tenant_id = public.tenant_id()` 를 넣되 **`public.tenant_id()` 가 NULL 인 경우
--     (JWT 에 테넌트가 없는 anon/외부폼 경로)는 기존처럼 통과**시켜 회귀를 막는다.
--     테넌트 스코핑을 완전히 닫는 것은 별도 과제다(앱은 항상 .eq('tenant_id', ...) 로 거른다).
--
-- [관리자 판별]
--   `public.current_user_role()` / `public.has_role_at_least('admin')` (20260403000001) 재사용.
--
-- [알려진 한계 — QA 체크리스트]
--   · visibility='private' 인데 owner 가 비어 있으면 **관리자만** 조회할 수 있다.
--     UI 에서 담당자 미지정 상태로 비공개를 고르면 경고를 띄운다.
--   · SECURITY DEFINER / 뷰 소유자 권한으로 proc_def 를 읽는 곳은 이 정책을 우회한다.
--     현재 레포에서 확인된 우회 지점(수정하지 않음, 후속 과제):
--       - VIEW public.v_review_board            (20260902000002_review_owner_role_mapping.sql)
--       - VIEW public.v_process_performance     (20260126_departments_analytics.sql)
--       - VIEW public.v_sla_compliance          (20260202_task_execution_nullable_and_view_filters.sql)
--         → 세 뷰 모두 security_invoker 미설정이라 뷰 소유자 권한으로 읽는다.
--       - FUNCTION public.sync_departments_from_org_chart(text)      (SECURITY DEFINER)
--       - FUNCTION public.insert_feedback_resource_notification(...) (SECURITY DEFINER)
--     ※ fetch_pending_task / sync_proc_map_name / ontology_* 는 proc_def 를 읽지 않아 무관.
--   · 서버(파이썬) 측은 service_role 키를 쓰므로 RLS 자체를 우회한다(기존과 동일).
--
-- idempotent: 반복 실행 가능.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. 컬럼 추가
--    NULL 을 'all' 로 간주하도록 정책에서 coalesce 한다 (NOT NULL 을 걸지 않는 이유:
--    visibility 를 명시적으로 null 로 보내는 기존 업서트 경로를 깨뜨리지 않기 위해).
-- ---------------------------------------------------------------------------
ALTER TABLE public.proc_def
    ADD COLUMN IF NOT EXISTS visibility text DEFAULT 'all',
    ADD COLUMN IF NOT EXISTS allowed_org_codes text[] DEFAULT '{}'::text[];

-- 기존 행 백필 (컬럼 추가 직후엔 DEFAULT 로 채워지지만, 재실행/부분 적용 대비)
UPDATE public.proc_def SET visibility = 'all' WHERE visibility IS NULL;
UPDATE public.proc_def SET allowed_org_codes = '{}'::text[] WHERE allowed_org_codes IS NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'proc_def_visibility_check'
          AND conrelid = 'public.proc_def'::regclass
    ) THEN
        ALTER TABLE public.proc_def
            ADD CONSTRAINT proc_def_visibility_check
            CHECK (visibility IS NULL OR visibility IN ('all', 'org', 'private'));
    END IF;
END $$;

COMMENT ON COLUMN public.proc_def.visibility IS
    '공개 범위: all=테넌트 전체 공개(기본), org=allowed_org_codes 조직만, private=작성자(owner)와 관리자만';
COMMENT ON COLUMN public.proc_def.allowed_org_codes IS
    'visibility=org 일 때 열람 가능한 조직 코드 목록. 조직도(configuration key=organization) 부서 노드 id 를 저장한다.';

-- visibility 가 'all' 이 아닌 행은 소수이므로 부분 인덱스로 충분하다.
CREATE INDEX IF NOT EXISTS idx_proc_def_visibility_restricted
    ON public.proc_def (tenant_id, visibility)
    WHERE visibility IS NOT NULL AND visibility <> 'all';

CREATE INDEX IF NOT EXISTS idx_proc_def_allowed_org_codes
    ON public.proc_def USING gin (allowed_org_codes)
    WHERE allowed_org_codes IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. 현재 사용자 식별 헬퍼
--    current_user_role() 과 같은 방식으로 JWT sub 를 읽는다(auth.uid() 의존 제거).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_request_uid()
RETURNS uuid
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_uid uuid;
BEGIN
    BEGIN
        v_uid := (current_setting('request.jwt.claims', true)::json ->> 'sub')::uuid;
    EXCEPTION WHEN OTHERS THEN
        v_uid := NULL;
    END;
    RETURN v_uid;
END;
$$;

-- 현재 사용자를 가리킬 수 있는 키(uuid / email / username) — 소문자·trim 정규화
CREATE OR REPLACE FUNCTION public.current_user_identity_keys()
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT COALESCE(array_agg(DISTINCT k), '{}'::text[])
    FROM (
        SELECT lower(btrim(v.x)) AS k
        FROM public.users u
        CROSS JOIN LATERAL (VALUES (u.id::text), (u.email), (u.username)) AS v(x)
        WHERE u.id = public.current_request_uid()
          AND (public.tenant_id() IS NULL OR u.tenant_id = public.tenant_id())
    ) s
    WHERE s.k IS NOT NULL AND s.k <> '';
$$;

-- ---------------------------------------------------------------------------
-- 3. 현재 사용자의 조직 코드 집합
--    users 컬럼 + 조직도 트리의 상위 부서 식별자를 모두 모은다.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_org_codes()
RETURNS text[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_uid        uuid;
    v_tenant     text;
    v_identity   text[];
    v_codes      text[] := '{}'::text[];
    v_chart      jsonb;
    v_tree_codes text[];
BEGIN
    v_uid := public.current_request_uid();
    IF v_uid IS NULL THEN
        RETURN '{}'::text[];
    END IF;

    v_tenant := public.tenant_id();

    -- ① users 테이블의 조직 컬럼
    SELECT COALESCE(
               array_remove(
                   ARRAY[
                       NULLIF(lower(btrim(COALESCE(u.department_id, ''))), ''),
                       NULLIF(lower(btrim(COALESCE(u.department_name, ''))), ''),
                       NULLIF(lower(btrim(COALESCE(u.org_code, ''))), ''),
                       NULLIF(lower(btrim(COALESCE(u.org_name, ''))), '')
                   ],
                   NULL
               ),
               '{}'::text[]
           )
      INTO v_codes
      FROM public.users u
     WHERE u.id = v_uid
       AND (v_tenant IS NULL OR u.tenant_id = v_tenant)
     LIMIT 1;

    v_codes := COALESCE(v_codes, '{}'::text[]);

    -- ② 조직도 트리에서 사용자 노드의 상위 부서를 모두 수집
    SELECT c.value -> 'chart'
      INTO v_chart
      FROM public.configuration c
     WHERE c.key = 'organization'
       AND (v_tenant IS NULL OR c.tenant_id = v_tenant)
     LIMIT 1;

    IF v_chart IS NULL OR jsonb_typeof(v_chart) <> 'object' THEN
        RETURN v_codes;
    END IF;

    v_identity := public.current_user_identity_keys();
    IF COALESCE(array_length(v_identity, 1), 0) = 0 AND COALESCE(array_length(v_codes, 1), 0) = 0 THEN
        RETURN v_codes;
    END IF;

    WITH RECURSIVE walk(node, ancestors) AS (
        SELECT v_chart, '{}'::text[]
        UNION ALL
        SELECT child.value,
               w.ancestors || COALESCE(
                   array_remove(
                       ARRAY[
                           NULLIF(lower(btrim(COALESCE(w.node ->> 'id', ''))), ''),
                           NULLIF(lower(btrim(COALESCE(w.node -> 'data' ->> 'id', ''))), ''),
                           NULLIF(lower(btrim(COALESCE(w.node -> 'data' ->> 'name', ''))), ''),
                           NULLIF(lower(btrim(COALESCE(w.node -> 'data' ->> 'org_code', ''))), ''),
                           NULLIF(lower(btrim(COALESCE(w.node -> 'data' ->> 'org_name', ''))), '')
                       ],
                       NULL
                   ),
                   '{}'::text[]
               )
          FROM walk w
          CROSS JOIN LATERAL jsonb_array_elements(
                   CASE WHEN jsonb_typeof(w.node -> 'children') = 'array'
                        THEN w.node -> 'children'
                        ELSE '[]'::jsonb END
               ) AS child(value)
    ),
    hit AS (
        SELECT w.ancestors
             , COALESCE(
                   array_remove(
                       ARRAY[
                           NULLIF(lower(btrim(COALESCE(w.node ->> 'id', ''))), ''),
                           NULLIF(lower(btrim(COALESCE(w.node -> 'data' ->> 'id', ''))), ''),
                           NULLIF(lower(btrim(COALESCE(w.node -> 'data' ->> 'name', ''))), ''),
                           NULLIF(lower(btrim(COALESCE(w.node -> 'data' ->> 'org_code', ''))), ''),
                           NULLIF(lower(btrim(COALESCE(w.node -> 'data' ->> 'org_name', ''))), '')
                       ],
                       NULL
                   ),
                   '{}'::text[]
               ) AS self_keys
          FROM walk w
         WHERE
            -- 사용자 본인 노드 (부서가 아닌 구성원 노드)
            (
                lower(COALESCE(w.node -> 'data' ->> 'isTeam', '')) NOT IN ('true', 't', '1')
                AND COALESCE(array_length(v_identity, 1), 0) > 0
                AND ARRAY[
                        NULLIF(lower(btrim(COALESCE(w.node ->> 'id', ''))), ''),
                        NULLIF(lower(btrim(COALESCE(w.node -> 'data' ->> 'id', ''))), ''),
                        NULLIF(lower(btrim(COALESCE(w.node -> 'data' ->> 'email', ''))), ''),
                        NULLIF(lower(btrim(COALESCE(w.node -> 'data' ->> 'username', ''))), ''),
                        NULLIF(lower(btrim(COALESCE(w.node -> 'data' ->> 'name', ''))), '')
                    ] && v_identity
            )
            -- 또는 users 컬럼이 가리키는 부서 노드
            OR (
                lower(COALESCE(w.node -> 'data' ->> 'isTeam', '')) IN ('true', 't', '1')
                AND COALESCE(array_length(v_codes, 1), 0) > 0
                AND ARRAY[
                        NULLIF(lower(btrim(COALESCE(w.node ->> 'id', ''))), ''),
                        NULLIF(lower(btrim(COALESCE(w.node -> 'data' ->> 'id', ''))), ''),
                        NULLIF(lower(btrim(COALESCE(w.node -> 'data' ->> 'name', ''))), ''),
                        NULLIF(lower(btrim(COALESCE(w.node -> 'data' ->> 'org_code', ''))), '')
                    ] && v_codes
            )
    )
    SELECT COALESCE(array_agg(DISTINCT k), '{}'::text[])
      INTO v_tree_codes
      FROM hit h
      CROSS JOIN LATERAL unnest(h.ancestors || h.self_keys) AS t(k)
     WHERE t.k IS NOT NULL AND t.k <> '';

    RETURN (
        SELECT COALESCE(array_agg(DISTINCT k), '{}'::text[])
        FROM unnest(v_codes || COALESCE(v_tree_codes, '{}'::text[])) AS t(k)
        WHERE t.k IS NOT NULL AND t.k <> ''
    );
EXCEPTION WHEN OTHERS THEN
    -- 조직도 JSON 이 예상 밖 모양이어도 조회 자체가 깨지면 안 된다.
    RETURN COALESCE(v_codes, '{}'::text[]);
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. 공개 범위 판정 헬퍼
-- ---------------------------------------------------------------------------

-- proc_def.owner 는 사용자 email(또는 id/username) 문자열이다.
CREATE OR REPLACE FUNCTION public.proc_def_is_author(p_owner text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
    SELECT COALESCE(
        NULLIF(lower(btrim(COALESCE(p_owner, ''))), '') = ANY (public.current_user_identity_keys()),
        false
    );
$$;

-- 단건 판정 헬퍼 (RPC/테스트/다른 화면에서 재사용).
-- ※ RLS 정책 자체는 아래 5번에서 이 함수를 쓰지 않고 조건을 직접 편다.
--   current_user_org_codes() 를 행마다 호출하지 않도록 `(SELECT ...)` InitPlan 으로 한 번만
--   평가시키기 위해서다.
CREATE OR REPLACE FUNCTION public.proc_def_visibility_allows(
    p_visibility        text,
    p_allowed_org_codes text[],
    p_owner             text
)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
    SELECT CASE COALESCE(NULLIF(btrim(p_visibility), ''), 'all')
        WHEN 'org' THEN COALESCE(
            (
                SELECT COALESCE(array_agg(lower(btrim(c))), '{}'::text[])
                FROM unnest(COALESCE(p_allowed_org_codes, '{}'::text[])) AS c
                WHERE btrim(COALESCE(c, '')) <> ''
            ) && public.current_user_org_codes(),
            false
        )
        WHEN 'private' THEN public.proc_def_is_author(p_owner)
        ELSE true
    END;
$$;

GRANT EXECUTE ON FUNCTION public.current_request_uid() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.current_user_identity_keys() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.current_user_org_codes() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.proc_def_is_author(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.proc_def_visibility_allows(text, text[], text) TO authenticated, anon;

-- ---------------------------------------------------------------------------
-- 5. SELECT RLS 재작성
--    기존: proc_def_select_all  USING (true)
--    신규: proc_def_select_visibility
-- ---------------------------------------------------------------------------
ALTER TABLE public.proc_def ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "proc_def_select_all" ON public.proc_def;
DROP POLICY IF EXISTS "proc_def_select_visibility" ON public.proc_def;

CREATE POLICY "proc_def_select_visibility" ON public.proc_def
    FOR SELECT
    USING (
        -- 관리자(admin/superadmin)는 공개 범위와 무관하게 항상 조회 가능
        public.has_role_at_least('admin')
        OR (
            -- 테넌트 스코프: JWT 에 테넌트가 없으면(anon/외부 경로) 기존과 동일하게 통과
            (public.tenant_id() IS NULL OR tenant_id IS NULL OR tenant_id = public.tenant_id())
            AND (
                -- visibility='all' (기본값/NULL 포함) → 기존과 동일하게 테넌트 내 공개
                COALESCE(NULLIF(btrim(visibility), ''), 'all') = 'all'

                -- visibility='org' → 사용자의 조직 코드가 allowed_org_codes 에 포함될 때만.
                --   current_user_org_codes() 는 (SELECT ...) 로 감싸 쿼리당 1회만 평가된다.
                OR (
                    COALESCE(NULLIF(btrim(visibility), ''), 'all') = 'org'
                    AND (
                        SELECT COALESCE(array_agg(lower(btrim(c))), '{}'::text[])
                        FROM unnest(COALESCE(allowed_org_codes, '{}'::text[])) AS c
                        WHERE btrim(COALESCE(c, '')) <> ''
                    ) && (SELECT public.current_user_org_codes())
                )

                -- visibility='private' → 작성자(owner) 본인만 (관리자는 위에서 이미 통과)
                OR (
                    COALESCE(NULLIF(btrim(visibility), ''), 'all') = 'private'
                    AND NULLIF(lower(btrim(COALESCE(owner, ''))), '') = ANY (
                        SELECT unnest(public.current_user_identity_keys())
                    )
                )
            )
        )
    );

-- INSERT / UPDATE / DELETE 정책은 기존 그대로 둔다
-- (proc_def_insert_editor / proc_def_update_editor / proc_def_delete_admin).
-- ※ UPDATE 정책이 editor+ 이므로 editor 는 visibility 도 바꿀 수 있다.
--   화면에서는 편집 권한이 있는 사용자에게만 공개 범위 UI 를 노출한다.
