begin;

-- 테스트 계정 삭제
-- 대상: user01@user.com ~ user20@user.com
-- tenant_id: localhost

delete from auth.identities
where provider = 'email'
  and provider_id ~ '^user[0-9]{2}@user\.com$';

delete from public.users
where tenant_id = 'localhost'
  and email ~ '^user[0-9]{2}@user\.com$';

delete from auth.users
where email ~ '^user[0-9]{2}@user\.com$';

commit;
