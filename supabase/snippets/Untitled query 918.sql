-- =========================================
-- 3) 트리거 함수 본문에 tenant 'skt' 박혀있는지 확인
-- =========================================
select pg_get_functiondef('public.handle_new_auth_user()'::regprocedure) as fn_sql;
--