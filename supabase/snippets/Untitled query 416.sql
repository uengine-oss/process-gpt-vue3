create table public.api_key (
  uuid uuid not null default gen_random_uuid (),
  key text not null,
  value text null,
  constraint api_key_pkey primary key (uuid)
) TABLESPACE pg_default;