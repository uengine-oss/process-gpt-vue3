-- 1) 트리거 함수: auth.users → public.users 동기화
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.users (
    id,
    username,
    email,
    tenant_id,
    is_admin,
    role
  )
  values (
    new.id,
    coalesce(
      (new.raw_user_meta_data ->> 'name'),
      new.email
    ),
    new.email,
    'process-gpt',   -- 고정 테넌트
    false,           -- 항상 일반 유저
    'user'           -- 기본 역할
  )
  on conflict (id, tenant_id) do nothing;  -- 이미 있으면 무시

  insert into public.signup_requests (
    user_id,
    username,
    email,
    tenant_id,
    status
  )
  values (
    new.id,
    coalesce(
      (new.raw_user_meta_data ->> 'name'),
      new.email
    ),
    new.email,
    'process-gpt',
    'pending'
  )
  on conflict (user_id, tenant_id) do update
  set
    username = excluded.username,
    email = excluded.email,
    status = 'pending',
    reject_reason = null,
    reviewed_by = null,
    reviewed_at = null,
    updated_at = now();

  return new;
end;
$$;