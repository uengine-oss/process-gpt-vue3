CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.glossaries (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'Business',
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.domains (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.owners (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  name text NOT NULL UNIQUE,
  email text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'Owner',
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.tags (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  name text NOT NULL UNIQUE,
  color text NOT NULL DEFAULT '#3498db',
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.terms (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  glossary_id uuid NOT NULL REFERENCES public.glossaries(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'Draft',
  synonyms text[] NOT NULL DEFAULT '{}',
  batch_id uuid,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (glossary_id, name)
);

CREATE TABLE IF NOT EXISTS public.term_domains (
  term_id uuid NOT NULL REFERENCES public.terms(id) ON DELETE CASCADE,
  domain_id uuid NOT NULL REFERENCES public.domains(id) ON DELETE CASCADE,
  PRIMARY KEY (term_id, domain_id)
);

CREATE TABLE IF NOT EXISTS public.term_owners (
  term_id uuid NOT NULL REFERENCES public.terms(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES public.owners(id) ON DELETE CASCADE,
  PRIMARY KEY (term_id, owner_id)
);

CREATE TABLE IF NOT EXISTS public.term_reviewers (
  term_id uuid NOT NULL REFERENCES public.terms(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES public.owners(id) ON DELETE CASCADE,
  PRIMARY KEY (term_id, owner_id)
);

CREATE TABLE IF NOT EXISTS public.term_tags (
  term_id uuid NOT NULL REFERENCES public.terms(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  PRIMARY KEY (term_id, tag_id)
);

CREATE TABLE IF NOT EXISTS public.term_related_terms (
  term_id uuid NOT NULL REFERENCES public.terms(id) ON DELETE CASCADE,
  related_term_id uuid NOT NULL REFERENCES public.terms(id) ON DELETE CASCADE,
  PRIMARY KEY (term_id, related_term_id),
  CONSTRAINT term_related_terms_not_self CHECK (term_id <> related_term_id)
);

CREATE TABLE IF NOT EXISTS public.business_calendars (
  year integer PRIMARY KEY,
  exclude_weekends boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.business_calendar_non_business_days (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  calendar_year integer NOT NULL REFERENCES public.business_calendars(year) ON DELETE CASCADE,
  date date NOT NULL,
  reason text NOT NULL DEFAULT '수동 지정',
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (calendar_year, date)
);

CREATE TABLE IF NOT EXISTS public.business_calendar_holidays (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  calendar_year integer NOT NULL REFERENCES public.business_calendars(year) ON DELETE CASCADE,
  date date NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (calendar_year, date)
);

CREATE INDEX IF NOT EXISTS idx_terms_glossary_id ON public.terms(glossary_id);
CREATE INDEX IF NOT EXISTS idx_terms_batch_id ON public.terms(batch_id);
CREATE INDEX IF NOT EXISTS idx_terms_name_lower ON public.terms((lower(name)));

CREATE TRIGGER glossaries_set_updated_at
BEFORE UPDATE ON public.glossaries
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER domains_set_updated_at
BEFORE UPDATE ON public.domains
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER owners_set_updated_at
BEFORE UPDATE ON public.owners
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER tags_set_updated_at
BEFORE UPDATE ON public.tags
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER terms_set_updated_at
BEFORE UPDATE ON public.terms
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER business_calendars_set_updated_at
BEFORE UPDATE ON public.business_calendars
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated, service_role;

