-- CLI 에이전트 API 키 — 회사(테넌트)가 직접 만든 Anthropic · OpenAI API 키를 둔다 (2026-11-11)
--
-- 왜
--   cli-agent(Claude Code · Codex CLI)는 지금 한 사람의 Claude 구독 토큰(쿠버네티스 Secret)으로 모든 업무를 돌린다.
--   Anthropic 약관은 구독 자격 증명을 여러 사람이 나눠 쓰거나 사용자 대신 돌리는 것을 막고, 회사가 직접 만든 API 키를
--   그 회사의 승인된 사용자가 쓰는 것은 허용한다(code.claude.com/docs/en/legal-and-compliance).
--   그래서 테넌트 관리자가 자기 회사 키를 화면(설정 › CLI 에이전트 API 키)에서 넣고, cli-agent 는 실행마다 그 키로 돈다.
--
-- 저장
--   비밀 값은 Supabase Vault(vault.create_secret / vault.update_secret)에만 암호화해 둔다. 평문은 어느 표에도 남기지 않는다.
--   public.cli_agent_credentials 는 메타(어느 공급자 · vault 비밀 id · 끝 네 자리 · 누가 · 언제)만 갖는다.
--   표는 RLS 를 켜고 정책을 두지 않는다 — 화면 · 서비스는 아래 함수로만 닿는다.
--
-- 함수
--   cli_agent_credential_set(p_provider, p_secret)  관리자만. 빈 문자열이면 지운다. 테넌트는 호출자 JWT 에서 정한다.
--   cli_agent_credential_status()                   같은 테넌트의 승인된 사용자 누구나. 비밀 값은 돌려주지 않는다
--                                                   (끝 네 자리 · 바꾼 사람 · 때는 관리자에게만).
--   cli_agent_credential_get(p_tenant, p_provider)  service_role 만(cli-agent 가 서비스 롤 키로 부른다).
--   세 함수 모두 지운 테넌트(tenants.is_deleted)로는 쓰이지 않는다.
--
-- 관리자 판정
--   이 저장소의 가입 승인 표준 헬퍼 public.membership_admin() 을 그대로 쓴다
--   (20260908000001_membership_approvals.sql — 승인된 회원이면서 is_admin 이거나 role 이 admin · superadmin).
--   화면의 판정(src/utils/authClaims.ts applyMembershipClaims → localStorage isAdmin)과 같은 규칙이다.
--
-- 멱등: create table if not exists · create or replace function · drop trigger if exists. 여러 번 적용해도 같다.
-- 적용: 운영 DB 에는 사람이 SQL 편집기(또는 psql, postgres 역할)로 이 파일을 그대로 돌린다. 적용 뒤 PostgREST 가
--       새 함수를 보도록 맨 끝에서 스키마를 다시 읽힌다.

-- 0) 앞서 있어야 하는 것 — 없으면 약한 판정으로 조용히 넘어가지 않고 멈춘다.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'supabase_vault') THEN
        RAISE EXCEPTION 'supabase_vault 확장이 없습니다. 키를 평문으로 둘 수 없어 멈춥니다 (create extension supabase_vault).';
    END IF;
    IF to_regprocedure('public.membership_admin()') IS NULL
       OR to_regprocedure('public.membership_approved()') IS NULL
       OR to_regprocedure('public.tenant_id()') IS NULL THEN
        RAISE EXCEPTION 'public.membership_admin() · membership_approved() · tenant_id() 가 없습니다. 20260908000001_membership_approvals.sql 을 먼저 적용하세요.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'is_deleted') THEN
        RAISE EXCEPTION 'public.tenants.is_deleted 가 없습니다. 지운 테넌트를 걸러 낼 수 없어 멈춥니다(20260101_base_schema.sql).';
    END IF;
END $$;

-- 1) 메타 표
CREATE TABLE IF NOT EXISTS public.cli_agent_credentials (
    tenant_id       text        NOT NULL REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE,
    provider        text        NOT NULL CHECK (provider IN ('anthropic', 'openai')),
    vault_secret_id uuid        NOT NULL,
    last4           text,
    updated_by      uuid,
    updated_at      timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, provider)
);

COMMENT ON TABLE public.cli_agent_credentials IS
'CLI 에이전트(Claude Code · Codex)가 쓸 회사 API 키의 메타. 비밀 값은 vault.secrets 에만 있다(vault_secret_id). '
'직접 읽고 쓰지 않는다 — cli_agent_credential_set/status/get 함수로만. (20261111000001_cli_agent_credentials.sql)';

ALTER TABLE public.cli_agent_credentials ENABLE ROW LEVEL SECURITY;
-- Supabase 기본 권한은 public 의 새 표를 anon · authenticated 에도 연다. 함수로만 닿게 하려고 걷어 낸다.
REVOKE ALL ON public.cli_agent_credentials FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.cli_agent_credentials TO service_role;

-- 2) 메타 행이 지워지면 vault 의 비밀도 지운다
CREATE OR REPLACE FUNCTION public.cli_agent_credentials_drop_secret()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, pg_temp
AS $$
BEGIN
    -- 왜: 지우기 단추 · 테넌트 삭제(ON DELETE CASCADE) 어느 길로 메타가 사라져도 암호문이 vault 에 남지 않게 한다.
    --     남으면 화면에서는 「설정 안 됨」인데 키는 DB 에 살아 있다.
    DELETE FROM vault.secrets WHERE id = OLD.vault_secret_id;
    RETURN OLD;
END;
$$;
COMMENT ON FUNCTION public.cli_agent_credentials_drop_secret() IS
'메타 행이 어느 길로 지워지든(지우기 · 테넌트 삭제) vault 의 암호문도 함께 지운다 — 화면엔 없는데 키가 남는 일을 막는다.';
REVOKE ALL ON FUNCTION public.cli_agent_credentials_drop_secret() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS cli_agent_credentials_drop_secret ON public.cli_agent_credentials;
CREATE TRIGGER cli_agent_credentials_drop_secret
    AFTER DELETE ON public.cli_agent_credentials
    FOR EACH ROW EXECUTE FUNCTION public.cli_agent_credentials_drop_secret();

-- 3) 넣기 · 바꾸기 · 지우기 — 관리자만
CREATE OR REPLACE FUNCTION public.cli_agent_credential_set(p_provider text, p_secret text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, pg_temp
AS $$
DECLARE
    v_tenant   text := public.tenant_id();
    v_provider text := lower(btrim(coalesce(p_provider, '')));
    v_secret   text := btrim(coalesce(p_secret, ''));
    v_name     text;
    v_desc     text;
    v_id       uuid;
BEGIN
    -- 왜 테넌트를 인자로 받지 않나: 남의 회사 키를 덮어쓰지 못하게 호출자 토큰의 테넌트만 쓴다.
    IF v_tenant IS NULL THEN
        RAISE EXCEPTION '테넌트를 알 수 없습니다.' USING ERRCODE = '42501';
    END IF;
    -- 왜: 지운 회사(is_deleted)로는 넣지도 바꾸지도 못한다. 토큰이 아직 살아 있어도 그 회사는 더 쓰이지 않는다.
    IF NOT EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = v_tenant AND t.is_deleted IS NOT TRUE) THEN
        RAISE EXCEPTION '사용할 수 없는 테넌트입니다.' USING ERRCODE = '42501';
    END IF;
    -- 왜 membership_admin(): 이 저장소의 관리자 판정 한 곳(승인된 회원 + is_admin 또는 admin · superadmin)을 그대로 따른다.
    IF NOT public.membership_admin() THEN
        RAISE EXCEPTION '관리자만 CLI 에이전트 API 키를 바꿀 수 있습니다.' USING ERRCODE = '42501';
    END IF;
    IF v_provider NOT IN ('anthropic', 'openai') THEN
        RAISE EXCEPTION '알 수 없는 공급자입니다: %', p_provider USING ERRCODE = '22023';
    END IF;

    v_name := 'cli_agent:' || v_tenant || ':' || v_provider;
    v_desc := 'CLI 에이전트 API 키 — 테넌트 ' || v_tenant || ', ' || v_provider || ' (public.cli_agent_credentials)';

    -- 왜 잠그나: 관리자 둘이 동시에 넣으면 vault 비밀이 둘 생겨 하나가 주인 없이 남는다. 같은 (테넌트, 공급자)만 줄 세운다.
    PERFORM pg_advisory_xact_lock(hashtextextended('cli_agent_credentials:' || v_tenant || ':' || v_provider, 0));

    -- 빈 값 = 지우기. 메타를 지우면 트리거가 vault 암호문을 지운다. 이름으로 남은 것(예전 실패의 찌꺼기)도 같이 걷는다.
    IF v_secret = '' THEN
        DELETE FROM public.cli_agent_credentials WHERE tenant_id = v_tenant AND provider = v_provider;
        DELETE FROM vault.secrets WHERE name = v_name;
        RETURN;
    END IF;

    -- 왜 모양을 서버에서도 보나: 접두사(sk-ant- 등)는 화면이 경고만 한다. 다만 공백 · 줄바꿈이 섞인 값은 붙여 넣기 실수라
    -- CLI 환경 변수로 넣으면 인증이 늘 실패한다. 너무 짧은 값은 끝 네 자리가 키의 대부분을 드러낸다.
    IF v_secret ~ '[[:space:][:cntrl:]]' THEN
        RAISE EXCEPTION 'API 키에 공백이나 줄바꿈이 들어 있습니다.' USING ERRCODE = '22023';
    END IF;
    IF length(v_secret) < 12 OR length(v_secret) > 1024 THEN
        RAISE EXCEPTION 'API 키 길이가 맞지 않습니다(12~1024자).' USING ERRCODE = '22023';
    END IF;

    SELECT c.vault_secret_id INTO v_id
      FROM public.cli_agent_credentials c
     WHERE c.tenant_id = v_tenant AND c.provider = v_provider;
    IF v_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM vault.secrets s WHERE s.id = v_id) THEN
        v_id := NULL;  -- 메타는 있는데 암호문이 사라졌다(누가 vault 에서 지웠다). 새로 만든다.
    END IF;
    IF v_id IS NULL THEN
        -- 메타 없이 이 이름으로 남은 비밀(예전 실패의 찌꺼기)이 있으면 그것을 다시 쓴다. 이름은 유일이라 새로 만들면 부딪친다.
        SELECT s.id INTO v_id FROM vault.secrets s WHERE s.name = v_name;
    ELSE
        -- 메타가 가리키는 비밀이 따로 있는데 같은 이름의 찌꺼기가 또 있으면 지운다 — 옛 키 암호문이 주인 없이 남지 않게.
        DELETE FROM vault.secrets WHERE name = v_name AND id <> v_id;
    END IF;

    IF v_id IS NULL THEN
        v_id := vault.create_secret(v_secret, v_name, v_desc);
    ELSE
        -- 값만 바꾼다. 이름 · 설명은 그대로 둔다 — 이름을 바꾸려 들면 같은 이름의 비밀과 부딪쳐(이름 유일) 바꾸기가 실패한다.
        PERFORM vault.update_secret(v_id, v_secret);
    END IF;

    INSERT INTO public.cli_agent_credentials AS c (tenant_id, provider, vault_secret_id, last4, updated_by, updated_at)
    VALUES (v_tenant, v_provider, v_id, right(v_secret, 4), auth.uid(), now())
    ON CONFLICT (tenant_id, provider) DO UPDATE
        SET vault_secret_id = EXCLUDED.vault_secret_id,
            last4           = EXCLUDED.last4,
            updated_by      = EXCLUDED.updated_by,
            updated_at      = EXCLUDED.updated_at;
END;
$$;
COMMENT ON FUNCTION public.cli_agent_credential_set(text, text) IS
'회사 관리자가 CLI 에이전트 API 키를 넣는다(빈 값이면 지운다). 테넌트는 호출자 토큰에서 정해 남의 회사 키를 건드리지 못한다. '
'비밀 값은 vault 에만, 메타에는 끝 네 자리만 남긴다.';
REVOKE ALL ON FUNCTION public.cli_agent_credential_set(text, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cli_agent_credential_set(text, text) TO authenticated;

-- 4) 상태 — 같은 회사 사용자 누구나, 비밀 값 없이
CREATE OR REPLACE FUNCTION public.cli_agent_credential_status()
RETURNS TABLE (provider text, configured boolean, last4 text, updated_at timestamptz, updated_by_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, vault, pg_temp
AS $$
    -- 왜 누구나: 채팅의 「CLI 코딩 에이전트」 선택지는 회사 키가 있을 때 모두에게 열린다. 일반 사용자는 「있다 · 없다」만 알면 된다.
    -- 왜 관리자에게만 끝 네 자리 · 바꾼 사람 · 때: 어느 키가 언제 들어왔는지 대조하는 것은 관리자 일이다.
    -- 지운 회사(is_deleted)면 아무 줄도 돌려주지 않는다.
    -- 공급자 둘을 늘 돌려준다(없으면 configured=false) — 화면이 빈 줄을 따로 지어내지 않게.
    SELECT p.provider,
           (c.vault_secret_id IS NOT NULL AND EXISTS (SELECT 1 FROM vault.secrets s WHERE s.id = c.vault_secret_id)) AS configured,
           CASE WHEN public.membership_admin() THEN c.last4 END AS last4,
           CASE WHEN public.membership_admin() THEN c.updated_at END AS updated_at,
           CASE WHEN public.membership_admin() THEN u.username END AS updated_by_name
      FROM (VALUES ('anthropic'), ('openai')) AS p(provider)
      LEFT JOIN public.cli_agent_credentials c
             ON c.tenant_id = public.tenant_id() AND c.provider = p.provider
      LEFT JOIN public.users u
             ON u.id = c.updated_by AND u.tenant_id = c.tenant_id
     WHERE public.tenant_id() IS NOT NULL
       AND public.membership_approved()
       AND EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = public.tenant_id() AND t.is_deleted IS NOT TRUE)
     ORDER BY p.provider;
$$;
COMMENT ON FUNCTION public.cli_agent_credential_status() IS
'회사 키가 설정됐는지 같은 테넌트의 승인된 사용자 누구나 본다(채팅의 CLI 코딩 에이전트 선택지). 비밀 값은 돌려주지 않고, '
'끝 네 자리 · 바꾼 사람 · 때는 관리자에게만 보인다. 지운 테넌트는 아무 줄도 받지 않는다.';
REVOKE ALL ON FUNCTION public.cli_agent_credential_status() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cli_agent_credential_status() TO authenticated;

-- 5) 꺼내기 — service_role 만
CREATE OR REPLACE FUNCTION public.cli_agent_credential_get(p_tenant text, p_provider text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, vault, pg_temp
AS $$
    -- 왜 서비스 롤만: 평문 키가 나가는 유일한 길이다. cli-agent 가 실행 직전에 서비스 롤 키로 읽어 CLI 환경에만 넣는다.
    -- 사용자 토큰(anon · authenticated)으로는 관리자라도 다시 볼 수 없다 — 화면은 쓰기 전용이다.
    -- 지운 회사(is_deleted)의 키는 내주지 않는다 — 회사를 지웠는데 그 회사 업무가 남아 키로 돌면 안 된다.
    SELECT d.decrypted_secret
      FROM public.cli_agent_credentials c
      JOIN public.tenants t ON t.id = c.tenant_id AND t.is_deleted IS NOT TRUE
      JOIN vault.decrypted_secrets d ON d.id = c.vault_secret_id
     WHERE c.tenant_id = p_tenant
       AND c.provider = lower(btrim(coalesce(p_provider, '')));
$$;
COMMENT ON FUNCTION public.cli_agent_credential_get(text, text) IS
'cli-agent 가 실행마다 그 테넌트의 키를 꺼낸다. 평문이 나가는 유일한 길이라 service_role 만 부를 수 있다.';
REVOKE ALL ON FUNCTION public.cli_agent_credential_get(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cli_agent_credential_get(text, text) TO service_role;

-- PostgREST 가 새 함수를 바로 보게
NOTIFY pgrst, 'reload schema';
