begin;

-- 로그인 가능한 테스트 계정 20명 생성
-- email: user01@user.com ~ user20@user.com
-- password: pw@user01 ~ pw@user20
-- username: user01 ~ user20

insert into public.tenants (id, owner)
values ('localhost', null)
on conflict (id) do nothing;

-- 재실행 시 충돌 방지를 위한 기존 테스트 계정 정리
delete from public.users
where tenant_id = 'localhost'
  and email ~ '^user[0-9]{2}@user\.com$';

delete from auth.identities
where provider = 'email'
  and provider_id ~ '^user[0-9]{2}@user\.com$';

delete from auth.users
where email ~ '^user[0-9]{2}@user\.com$';

with seed as (
  select
    lpad(gs::text, 2, '0') as n,
    ('user' || lpad(gs::text, 2, '0'))::text as username,
    ('user' || lpad(gs::text, 2, '0') || '@user.com')::text as email,
    ('pw@user' || lpad(gs::text, 2, '0'))::text as pwd
  from generate_series(1, 20) as gs
),
target_instance as (
  select
    coalesce(
      (select i.id from auth.instances i order by i.created_at asc limit 1),
      (select u.instance_id from auth.users u where u.instance_id is not null limit 1),
      '00000000-0000-0000-0000-000000000000'::uuid
    ) as instance_id
),
inserted_auth as (
  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change,
    email_change_token_current,
    reauthentication_token,
    phone,
    phone_change,
    phone_change_token,
    raw_app_meta_data,
    raw_user_meta_data,
    is_sso_user,
    is_anonymous,
    created_at,
    updated_at,
    last_sign_in_at
  )
  select
    ti.instance_id,
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    s.email,
    crypt(s.pwd, gen_salt('bf')),
    now(),
    '',
    '',
    '',
    '',
    '',
    '',
    null,
    '',
    '',
    jsonb_build_object(
      'provider', 'email',
      'providers', jsonb_build_array('email'),
      'tenant_id', 'localhost'
    ),
    jsonb_build_object('username', s.username),
    false,
    false,
    now(),
    now(),
    now()
  from seed s
  cross join target_instance ti
  returning id, email, (raw_user_meta_data ->> 'username') as username
),
inserted_identity as (
  insert into auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  )
  select
    gen_random_uuid(),
    a.id,
    jsonb_build_object(
      'sub', a.id::text,
      'email', a.email,
      'email_verified', true
    ),
    'email',
    a.email,
    now(),
    now(),
    now()
  from inserted_auth a
  returning user_id
)
insert into public.users (
  id,
  username,
  email,
  tenant_id,
  is_admin,
  is_agent,
  profile
)
select
  a.id,
  a.username,
  a.email,
  'localhost',
  false,
  false,
  '/images/defaultUser.png'
from inserted_auth a;

commit;