\set ON_ERROR_STOP on
SET client_min_messages TO NOTICE;

-- =============================================================================
-- 기기 토큰은 본인만 다룰 수 있어야 한다
--
-- 이 테이블은 "어느 사용자에게 푸시를 보낼 때 어느 기기로 보낼지" 를 담는다.
-- 남의 행을 고칠 수 있으면 그 사람의 알림을 자기 폰으로 받을 수 있다.
--
-- 실행: process-gpt-vue3/supabase/tests/run_user_devices_test.sh
-- =============================================================================

DELETE FROM public.user_devices WHERE user_email LIKE '%@rls.test';
INSERT INTO public.user_devices (user_email, device_token) VALUES ('b@rls.test', 'B-의-토큰');

DO $$
DECLARE n integer; tok text;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"email":"a@rls.test","role":"authenticated"}', true);
  SET LOCAL ROLE authenticated;

  ---------------------------------------------------------------- R1 남의 것은 안 보인다
  SELECT count(*) INTO n FROM public.user_devices WHERE user_email = 'b@rls.test';
  IF n <> 0 THEN RAISE EXCEPTION 'R1 FAIL: 남의 기기 토큰이 보인다'; END IF;
  RAISE NOTICE 'R1 pass  남의 기기 토큰은 보이지 않는다';

  ---------------------------------------------------------------- R2 남의 것은 못 고친다
  UPDATE public.user_devices SET device_token = '가로챈-토큰' WHERE user_email = 'b@rls.test';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'R2 FAIL: 남의 알림을 가로챌 수 있다'; END IF;
  RAISE NOTICE 'R2 pass  남의 행은 덮어쓸 수 없다';

  ---------------------------------------------------------------- R3 남의 이름으로 못 넣는다
  BEGIN
    INSERT INTO public.user_devices (user_email, device_token) VALUES ('c@rls.test', '남의-이름으로');
    RAISE EXCEPTION 'R3 FAIL: 남의 이메일로 등록할 수 있다';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'R3 pass  남의 이메일로는 등록할 수 없다';
  END;

  ---------------------------------------------------------------- R4 본인 것은 된다
  INSERT INTO public.user_devices (user_email, device_token) VALUES ('a@rls.test', '내-토큰');
  SELECT device_token INTO tok FROM public.user_devices WHERE user_email = 'a@rls.test';
  IF tok IS DISTINCT FROM '내-토큰' THEN RAISE EXCEPTION 'R4 FAIL: 본인 등록이 안 된다'; END IF;
  RAISE NOTICE 'R4 pass  본인 기기는 등록되고 다시 읽힌다';

  ---------------------------------------------------------------- R5 본인 것은 지울 수 있다
  DELETE FROM public.user_devices WHERE user_email = 'a@rls.test';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'R5 FAIL: 알림 끄기가 동작하지 않는다'; END IF;
  RAISE NOTICE 'R5 pass  본인 기기는 스스로 지울 수 있다(알림 끄기)';

  RESET ROLE;
END $$;

DO $$
DECLARE n integer;
BEGIN
  ---------------------------------------------------------------- R6 발송 경로는 그대로
  SELECT count(*) INTO n FROM public.user_devices WHERE user_email = 'b@rls.test';
  IF n <> 1 THEN RAISE EXCEPTION 'R6 FAIL: 발송 쪽에서 기기를 못 읽는다'; END IF;
  RAISE NOTICE 'R6 pass  발송 경로(service_role)는 영향받지 않는다';
  RAISE NOTICE '--- user_devices: 6 checks passed ---';
END $$;

DELETE FROM public.user_devices WHERE user_email LIKE '%@rls.test';
