-- ============================================================================
-- 알림 표(public.notifications) 를 정식 마이그레이션으로 만든다
--
-- [왜 지금]
--   이 표는 어떤 마이그레이션에도 없다. 운영 데이터베이스에서 손으로(또는 다른
--   경로로) 만들어졌고, 그 뒤로 마이그레이션은 늘 "있으면 고치고 없으면 넘어간다"
--   로 피해 왔다(202609020001_notifications_updated_at.sql 의 to_regclass 가드,
--   20260911000004_file_download_log.sql 의 알림 INSERT 가드).
--
--   그래서 새로 만든 데이터베이스(로컬·CI·새 테넌트 서버)에는 이 표가 아예 없다.
--   알림은 한 건도 쌓이지 않고, 이상 탐지 알림은 조용히 건너뛰어지며, 그 사실이
--   오류로 드러나지도 않는다. 표 자체를 코드로 옮겨 둔다.
--
--   또한 지금까지 이 표에는 행 수준 보안이 없었다. 로그인한 누구나 남의 알림을
--   전부 읽을 수 있었다(알림 제목·본문에는 업무명·대화 내용이 그대로 들어간다).
--   Realtime 구독도 마찬가지라, 포털은 남의 알림 이벤트까지 받아서 화면단에서
--   `notification.user_id === email` 로 걸러 내고 있었다(src/App.vue). 이 마이그레이션이
--   그 거르는 일을 데이터베이스로 내린다.
--
-- [스키마의 근거 — 추측이 아니라 쓰는 코드에서 뽑았다]
--   id           uuid  … 20260716_feedback_proposal_notifications.sql:78 gen_random_uuid()
--                        20260911000004_file_download_log.sql:435 md5(...)::uuid + ON CONFLICT (id)
--                        → 기본키여야 하고 uuid 여야 한다.
--   user_id      text  … 받는 사람. **이메일이거나 UUID 이고, 콤마로 여럿일 수 있다.**
--                        fcm_service/recipients.py 머리말 + split_recipients()
--                        포털도 이메일과 UUID 를 함께 조회한다
--                        (ProcessGPTBackend.ts fetchNotifications: inArray user_id [email, uuid])
--                        → uuid 형이 아니라 text 다.
--   type         text  … 'chat' | 'workitem' | 'workitem_bpm' | 'merge_request' |
--                        'survey' | 'download_anomaly' | 'general'
--                        (src/App.vue showNotifications, 20260907000002, 20260716,
--                         20260911000004, fcm_service/database.py:188)
--   title        text  … 알림 제목(대화면 말 내용, 업무면 활동 이름)
--   description  text  … 둘째 줄(대화방 이름 · 프로세스 인스턴스 이름)
--   url          text  … 눌렀을 때 갈 곳. 포털은 이 값으로 같은 알림을 묶는다
--                        (fetchNotifications 의 acc[item.url]).
--   is_checked   bool  … 읽음 표시. 포털은 `is_checked = false` 로만 조회한다.
--   time_stamp   timestamptz … 정렬 기준(orderBy 'time_stamp' desc). created_at 이 아니다.
--   from_user_id text  … 보낸 사람. 대화 알림은 **이름**이 들어온다
--                        (20260907000002:129 `NEW.messages->>'name'`) — 이메일이 아니다.
--   tenant_id    text  … 조직. fcm_service 가 dev 환경에서 이 값으로 거른다
--                        (database.py:327 eq('tenant_id','uengine')).
--                        기본값을 두지 않는다 — 운영과 같은 모양을 유지한다.
--   consumer     text  … 발송기(파드) 선점 표시. database.py:322 `is_('consumer','null')`
--                        로 조회하고 338 에서 파드 이름을 찍는다.
--   updated_at   timestamptz … consumer 와 함께 찍히는 선점 시각.
--                        202609020001_notifications_updated_at.sql 이 이미 가드 안에서
--                        더하고 있고, "기존 행에는 시간 정보가 없으므로 기본값을 두지
--                        않는다" 는 그 결정을 그대로 따른다.
--
-- [이미 표가 있는 운영 데이터베이스]
--   CREATE TABLE IF NOT EXISTS 는 그냥 지나가고, 아래 ADD COLUMN IF NOT EXISTS 들이
--   빠진 칸만 채운다. 있는 칸의 형·기본값·NOT NULL 은 건드리지 않는다 — 이미 들어
--   있는 수백만 행을 이 마이그레이션이 다시 쓰게 만들 이유가 없다.
--
-- idempotent — 몇 번을 다시 돌려도 같다.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. 표
--
--    id 를 뺀 모든 칸을 NULL 허용으로 둔다. 까닭이 있다.
--    포털의 읽음 처리는 UPDATE 가 아니라 upsert 다
--    (StorageBaseSupabase.putObject → supabase.from('notifications').upsert({id, is_checked})).
--    PostgREST 는 이것을 `INSERT ... ON CONFLICT (id) DO UPDATE` 로 바꾸는데,
--    PostgreSQL 은 충돌로 UPDATE 가 될 줄 알기 전에 **넣으려던 행의 NOT NULL 을
--    먼저 검사한다.** user_id 에 NOT NULL 을 걸면 읽음 처리가 전부 실패한다.
--    (검증: 아래 컨테이너 시험에서 실제로 재현했다.)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 받는 사람: 이메일 | UUID | 콤마로 이은 여럿
    user_id      text        NULL,

    type         text        NULL,
    title        text        NULL,
    description  text        NULL,
    url          text        NULL,

    -- 읽음 여부. 조회가 `eq('is_checked', false)` 라 NULL 이면 알림함에서 사라진다.
    -- 새 표에서는 그런 행이 생기지 않게 기본값을 둔다.
    is_checked   boolean     NOT NULL DEFAULT false,

    -- 정렬 기준. 이름이 created_at 이 아닌 것은 운영 표를 그대로 따르기 때문이다.
    time_stamp   timestamptz NOT NULL DEFAULT now(),

    from_user_id text        NULL,

    -- 조직 참조 무결성 때문에 알림이 실패하면 안 되므로 tenants 에 FK 를 걸지 않는다
    -- (auth_login_audit · file_download_log 와 같은 판단).
    tenant_id    text        NULL,

    -- 발송기 선점
    consumer     text        NULL,
    updated_at   timestamptz NULL
);

-- 이미 있던 표(운영)를 위한 보정. 없는 칸만 더한다.
-- NOT NULL 을 붙이지 않는다 — 기존 행에 무엇이 들어 있는지 알 수 없다.
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS user_id      text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS type         text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS title        text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS description  text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS url          text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS is_checked   boolean DEFAULT false;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS time_stamp   timestamptz DEFAULT now();
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS from_user_id text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS tenant_id    text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS consumer     text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS updated_at   timestamptz;

COMMENT ON TABLE public.notifications IS
'사용자 알림함. 포털이 읽고(본인 것만, RLS), fcm_service 가 consumer 로 선점해 푸시로 보낸다.';
COMMENT ON COLUMN public.notifications.user_id IS
'받는 사람. 이메일 또는 사용자 UUID, 담당자가 여럿이면 콤마로 이어진다(fcm_service/recipients.py).';
COMMENT ON COLUMN public.notifications.from_user_id IS
'보낸 사람. 대화 알림은 이메일이 아니라 표시 이름이 들어온다(handle_chat_insert).';
COMMENT ON COLUMN public.notifications.time_stamp IS
'알림이 생긴 시각. 알림함 정렬 기준(created_at 이 아니다).';
COMMENT ON COLUMN public.notifications.consumer IS
'이 알림을 발송하기로 선점한 fcm_service 파드 이름. NULL 이면 아직 아무도 가져가지 않은 것.';
COMMENT ON COLUMN public.notifications.updated_at IS
'fcm_service 가 이 알림을 선점(발송 담당 지정)한 시각. consumer 와 함께 기록된다.';

-- ---------------------------------------------------------------------------
-- 2. 인덱스 — 실제로 도는 두 질의만 본다
--
--   ① 발송기 폴링 (초 단위로 계속 돈다)
--        select * from notifications where consumer is null [and tenant_id = ?] limit 10
--      전체의 아주 작은 일부라 부분 인덱스가 맞다. 보낸 알림이 몇 백만 건이 되어도
--      인덱스는 "아직 안 보낸 것" 크기로만 남는다.
--
--   ② 알림함 (사람이 종을 누를 때마다)
--        where user_id in (email, uuid) and is_checked = false order by time_stamp desc limit 50
--      읽지 않은 것만 보므로 여기도 부분 인덱스.
--      읽음 처리 전의 조회(match {url, user_id, is_checked:false})도 같은 인덱스를 쓴다.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_notifications_unclaimed
    ON public.notifications (tenant_id, time_stamp)
    WHERE consumer IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
    ON public.notifications (user_id, time_stamp DESC)
    WHERE is_checked = false;

-- ---------------------------------------------------------------------------
-- 3. "이 알림이 내 것인가" 판정
--
--    user_id 한 칸에 세 가지가 섞여 들어온다 — 이메일, 사용자 UUID, 그리고
--    담당자가 여럿일 때의 콤마 목록("uuid-a,uuid-b"). 정책 세 군데에서 같은
--    판정을 되풀이하지 않도록 함수로 뽑는다.
--
--    판단 근거는 로그인 세션(auth.uid(), JWT 의 email)뿐이다. 둘 다 서버가
--    서명한 값이라 사용자가 고칠 수 없다.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notification_is_mine(p_user_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM unnest(string_to_array(COALESCE(p_user_id, ''), ',')) AS t(part)
        WHERE btrim(t.part) <> ''
          AND (
                (auth.uid() IS NOT NULL AND btrim(t.part) = auth.uid()::text)
             OR (NULLIF(auth.jwt() ->> 'email', '') IS NOT NULL
                 AND lower(btrim(t.part)) = lower(auth.jwt() ->> 'email'))
          )
    );
$$;

COMMENT ON FUNCTION public.notification_is_mine(text) IS
'notifications.user_id(이메일 | UUID | 콤마 목록)가 지금 로그인한 사람을 가리키는가. RLS 정책 전용.';

-- "이 id 의 알림이 이미 표에 있는가".
--
-- 읽기 정책을 넓히려는 것이 아니라, PostgreSQL 이 upsert 를 검사할 때 지나갈 길을
-- 내주려는 것이다(아래 [함정 2]). **아직 표에 없는 행** 은 곧 "지금 넣고 있는 행"
-- 이고, 그런 행에 대해서만 SELECT 정책이 통과하면 된다. 이미 있는 행 — 즉 사람이
-- 실제로 읽을 수 있는 모든 행 — 에 대해서는 이 함수가 참을 돌려주므로 이 갈래는
-- 읽기를 한 줄도 넓히지 않는다.
--
-- RLS 를 지나 확인해야 하므로 SECURITY DEFINER. 알려 주는 것은 "그 uuid 가 쓰였는가"
-- 하나뿐이고, 그것은 기본키 충돌 오류로도 알 수 있는 사실이다.
CREATE OR REPLACE FUNCTION public.notification_row_exists(p_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (SELECT 1 FROM public.notifications n WHERE n.id = p_id);
$$;

COMMENT ON FUNCTION public.notification_row_exists(uuid) IS
'그 id 의 알림이 이미 있는가. upsert 의 RLS 검사에서 "지금 넣는 행" 을 가려내는 데만 쓴다.';

-- ---------------------------------------------------------------------------
-- 4. RLS
--
--   SELECT : 본인 알림만.
--   UPDATE : 고칠 수 있는 행은 본인 알림만(USING). 고칠 수 있는 칸은 읽음 표시뿐
--            (6번의 트리거). WITH CHECK 은 일부러 열어 둔다 — 아래 [함정 1] 참고.
--   INSERT : 로그인한 사용자에게 연다. **여기에는 사정이 있다.**
--
--     알림을 만드는 길이 네 갈래인데, 그중 둘이 호출한 사람의 권한으로 돈다.
--       · public.handle_chat_insert()    (20260907000002:91)  — SECURITY INVOKER
--       · public.handle_todolist_change()(20260907000002:165) — SECURITY INVOKER
--     포털에서 대화를 보내거나 업무를 넘기면 이 트리거가 **받는 사람(남)** 앞으로
--     알림을 넣는다. 즉 "자기 앞으로만 넣을 수 있다" 로 조이면 대화 알림과 업무
--     알림이 그 자리에서 끊긴다. 포털 코드(ProcessGPTBackend.sendNotification)도
--     같은 일을 한다 — 결재자·요청자에게 보낸다.
--
--     from_user_id 로 보낸 사람을 강제하는 것도 안 된다. 대화 알림의 from_user_id
--     에는 이메일이 아니라 표시 이름이 들어오기 때문이다(20260907000002:129).
--
--     그래서 INSERT 는 "받는 사람 칸이 빈 문자열은 아닐 것" 만 본다. 지금과 같은
--     수준이며, 좁히려면 서버측 경로(SECURITY DEFINER RPC)로 옮기는 별도 작업이
--     필요하다. → 보고에 남긴다.
--
--     `user_id IS NULL` 을 허용해야 하는 까닭은 따로 있다. 포털의 읽음 처리는
--     upsert 라서 PostgreSQL 이 `INSERT ... ON CONFLICT (id) DO UPDATE` 로 실행하는데,
--     **충돌이 나서 UPDATE 로 갈 것이 확정되기 전에 INSERT 정책의 WITH CHECK 을
--     넣으려던 행에 대해 먼저 검사한다.** 그 행은 {id, is_checked} 뿐이라 user_id 가
--     NULL 이다. NULL 을 막으면 알림함의 읽음 처리가 통째로
--     "new row violates row-level security policy" 로 죽는다(컨테이너에서 재현했다).
--     남의 알림을 upsert 로 건드리는 것은 UPDATE 정책의 USING 이 막는다.
--
--   [함정 1] UPDATE 정책의 WITH CHECK 을 "본인 것" 으로 조이면 안 된다
--     PostgreSQL 은 `ON CONFLICT DO UPDATE` 가 붙은 INSERT 에 대해, **충돌이
--     실제로 일어나지 않아도** 넣으려는 행에 UPDATE 정책의 WITH CHECK 을 함께
--     적용한다(컨테이너에서 세 경우로 확인했다).
--       · 포털 읽음 처리   : 넣으려는 행의 user_id 가 NULL → "내 것" 이 아니다 → 실패
--       · handle_chat_insert: 넣으려는 행의 user_id 가 **받는 사람(남)** → 실패
--     즉 WITH CHECK 을 조이면 알림함의 읽음 처리와 대화 알림이 통째로 멈춘다.
--     겉보기에 가장 당연한 정책이 기능을 죽이는 자리다.
--
--     그래서 WITH CHECK 은 열어 두고, 두 가지로 대신 지킨다.
--       ① USING — 남의 알림 행에는 애초에 UPDATE 가 닿지 않는다(0건 또는 오류).
--       ② 6번의 BEFORE UPDATE 트리거 — 브라우저가 보낸 UPDATE 에서 읽음 표시
--          외의 모든 칸을 옛 값으로 되돌린다. user_id 를 남의 것으로 바꿔 옮기는
--          것도 여기서 막힌다(WITH CHECK 이 하려던 일을 트리거가 한다).
--
--   [함정 2] 같은 이유로 SELECT 정책에도 두 개의 통로가 필요하다
--     PostgreSQL 은 `ON CONFLICT DO UPDATE` 가 붙은 INSERT 에 **SELECT 정책까지**
--     넣으려는 행에 적용한다(rowsecurity.c 의 conflict check). 확인한 결과:
--       · SELECT 정책이 "본인 것" 뿐이면 **대화 보내기 자체가 실패한다.**
--         handle_chat_insert 가 받는 사람 앞으로 넣는 행이 보낸 사람에게는 보이지
--         않기 때문이다. 알림만 안 가는 것이 아니라 chats INSERT 가 통째로 죽는다:
--           ERROR: new row violates row-level security policy for table "notifications"
--           CONTEXT: PL/pgSQL function handle_chat_insert() line 31
--       · 읽음 처리 upsert 도 같은 이유로 죽는다(넣으려는 행의 user_id 가 NULL).
--       · 포털의 sendNotification(결재·PR 알림)도 마찬가지다. storage.putObject 는
--         supabase-js 의 upsert 이고, 받는 사람은 남이다.
--
--     그래서 SELECT 정책에 두 갈래를 덧댄다.
--       · user_id IS NULL                        — 읽음 처리가 넣으려는 행
--       · NOT public.notification_row_exists(id) — 아직 표에 없는 행 = 지금 넣는 행
--     둘 다 "사람이 하는 조회" 를 넓히지 않는다. 읽을 수 있는 행은 모두 이미 표에
--     있으므로 두 번째 갈래는 실제 조회에서 언제나 거짓이고, 받는 사람이 없는 행은
--     어느 알림함에도 뜨지 않는다(조회가 늘 user_id 로 걸러진다).
--
--     더 깔끔한 길은 handle_chat_insert / sendNotification 의 쓸모없는 ON CONFLICT 절
--     (언제나 새 uuid 라 충돌이 날 수 없다)을 지우거나 트리거를 SECURITY DEFINER 로
--     바꾸는 것이다. 그러면 이 통로도 필요 없다. 다만 그것은 대화·포털 쪽 변경이라
--     여기서 하지 않는다. → 보고에 남긴다.
--
--   DELETE : 정책을 만들지 않는다 = 아무도 지울 수 없다(service_role 제외).
--
--   fcm_service 와 엔진은 service_role 키로 붙는다. 이 역할은 RLS 를 지나가므로
--   발송·적재 경로는 아무것도 바뀌지 않는다.
-- ---------------------------------------------------------------------------
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notifications_select_own   ON public.notifications;
DROP POLICY IF EXISTS notifications_update_own   ON public.notifications;
DROP POLICY IF EXISTS notifications_insert_authn ON public.notifications;

-- 뒤의 두 OR 는 "읽기" 를 넓히려는 것이 아니다. PostgreSQL 이 upsert 를 검사할 때
-- 지나가는 통로다 — 바로 위 [함정 2] 를 보라. 지우면 대화·알림 발송·읽음 처리가 멈춘다.
CREATE POLICY notifications_select_own ON public.notifications
    FOR SELECT TO authenticated
    USING (
        public.notification_is_mine(user_id)
        -- 읽음 처리 upsert 가 넣으려는 행({id, is_checked} 뿐이라 받는 사람이 없다).
        -- 이런 행이 실제로 표에 남더라도 누구의 알림함에도 뜨지 않는다(조회가 늘
        -- user_id 로 걸러진다).
        OR user_id IS NULL
        -- 아직 표에 없는 행 = 지금 넣고 있는 행. 사람이 읽을 수 있는 행은 모두
        -- 표에 있으므로 이 갈래는 읽기를 한 줄도 넓히지 않는다.
        OR NOT public.notification_row_exists(id)
    );

-- WITH CHECK (true) 는 실수가 아니다 — 위 [함정 1] 참고. 빠뜨리면 USING 이 그대로
-- WITH CHECK 으로 쓰여 읽음 처리와 대화 알림이 멈추므로 반드시 명시한다.
-- "남의 알림으로 바꿔치기" 는 6번 트리거가 막는다.
CREATE POLICY notifications_update_own ON public.notifications
    FOR UPDATE TO authenticated
    USING (public.notification_is_mine(user_id))
    WITH CHECK (true);

CREATE POLICY notifications_insert_authn ON public.notifications
    FOR INSERT TO authenticated
    WITH CHECK (user_id IS NULL OR btrim(user_id) <> '');

-- ---------------------------------------------------------------------------
-- 5. GRANT / REVOKE — RLS 와 별개인 두 번째 안전망
--
--   anon 이 알림을 만질 이유는 없다. 포털은 언제나 로그인 뒤에 이 표를 본다.
--
--   authenticated 에게 UPDATE 를 **칸 단위로 주지 않고 표 단위로 준다.**
--   그렇게 해야 하는 까닭이 있다. handle_chat_insert 의 알림 INSERT 에는
--   `ON CONFLICT (id) DO UPDATE SET user_id=..., title=..., ...` 이 붙어 있는데,
--   PostgreSQL 은 충돌이 실제로 일어나는지와 무관하게 그 SET 에 적힌 모든 칸의
--   UPDATE 권한을 문장 실행 전에 검사한다. 칸 단위로 주면 대화를 보내는 것
--   자체가 "permission denied for table notifications" 로 죽는다
--   (칸 단위 GRANT UPDATE(b) 만 준 표에 `ON CONFLICT DO UPDATE SET a, b` 를 날려
--    컨테이너에서 확인했다 — 충돌이 없어도 거절된다).
--   대신 "읽음 표시만 바꿀 수 있다" 는 6번의 트리거가 지킨다.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        EXECUTE 'REVOKE ALL ON public.notifications FROM anon';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        EXECUTE 'REVOKE ALL ON public.notifications FROM authenticated';
        EXECUTE 'GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        EXECUTE 'GRANT ALL ON public.notifications TO service_role';
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 6. 사용자가 바꿀 수 있는 것은 읽음 표시뿐
--
--   5번에서 본 이유로 UPDATE 권한을 표 단위로 줄 수밖에 없다. 그러면 정책만으로는
--   "내 알림의 제목·주소를 내가 고치는 것" 을 막지 못한다. 알림 주소(url)는 눌렀을
--   때 가는 곳이라 남겨 두면 자기 알림을 미끼로 바꿔 두는 장난이 가능하다.
--
--   그래서 호출한 역할이 브라우저(authenticated/anon)일 때는 읽음 표시를 뺀 모든
--   칸을 옛 값으로 되돌린다. **오류를 내지 않고 되돌린다** — 읽음 처리는 upsert
--   라서 id 를 함께 보내고, 오류로 막으면 알림함이 통째로 멈춘다. 되돌리면 기능은
--   그대로이고 위조만 사라진다.
--
--   service_role(fcm_service 의 consumer/updated_at 선점), postgres, 그리고
--   SECURITY DEFINER 함수는 current_user 가 다르므로 이 트리거가 비켜선다.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notifications_client_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF current_user IN ('authenticated', 'anon') THEN
        NEW.id           := OLD.id;
        NEW.user_id      := OLD.user_id;
        NEW.type         := OLD.type;
        NEW.title        := OLD.title;
        NEW.description  := OLD.description;
        NEW.url          := OLD.url;
        NEW.time_stamp   := OLD.time_stamp;
        NEW.from_user_id := OLD.from_user_id;
        NEW.tenant_id    := OLD.tenant_id;
        NEW.consumer     := OLD.consumer;
        NEW.updated_at   := OLD.updated_at;
        -- is_checked 만 새 값을 살린다.
    END IF;
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.notifications_client_update_guard() IS
'브라우저(authenticated/anon)가 보내는 UPDATE 에서 is_checked 외의 변경을 조용히 되돌린다.';

DROP TRIGGER IF EXISTS notifications_client_update_guard ON public.notifications;
CREATE TRIGGER notifications_client_update_guard
    BEFORE UPDATE ON public.notifications
    FOR EACH ROW
    EXECUTE FUNCTION public.notifications_client_update_guard();

-- ---------------------------------------------------------------------------
-- 7. Realtime
--
--   포털은 이 표를 실시간으로 구독한다(ProcessGPTBackend.watchNotifications →
--   channel 'notifications'). publication 에 들어 있지 않으면 알림이 종에 즉시
--   뜨지 않고 새로고침해야 보인다.
--
--   RLS 를 켰으므로 이제 구독자는 자기 알림 이벤트만 받는다 — 지금까지 화면단에서
--   하던 거르기(src/App.vue 의 user_id 비교)를 데이터베이스가 대신한다.
--
--   REPLICA IDENTITY 는 기본값 그대로 둔다. 포털이 쓰는 것은 새로 생긴 알림(INSERT)
--   이고, 그 이벤트는 행 전체가 실린다. FULL 은 모든 UPDATE 마다 옛 행까지 WAL 에
--   싣게 하므로(선점 UPDATE 가 알림마다 한 번씩 일어난다) 얻는 것 없이 무겁기만 하다.
--
--   publication 이 없는 환경(순수 PostgreSQL, CI)에서도 마이그레이션은 지나가야 한다.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
       AND NOT EXISTS (
           SELECT 1 FROM pg_publication_tables
           WHERE pubname = 'supabase_realtime'
             AND schemaname = 'public'
             AND tablename = 'notifications'
       )
    THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    END IF;
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;

COMMIT;

-- PostgREST 가 새 표/권한을 곧바로 알아보게 한다.
NOTIFY pgrst, 'reload schema';
