#!/bin/bash
# 빈 로컬 DB에 supabase/migrations 전체를 적용해 SQL 의존성·순서를 검증한다.
#
# - 일회용 postgres:16-alpine 컨테이너를 띄운다 (기존 DB에 영향 없음)
# - Supabase 플랫폼이 제공하는 전제(auth 스키마/롤/함수, storage 스키마,
#   supabase_realtime publication)를 최소 셈(shim)으로 주입한다
# - 타임스탬프 마이그레이션을 C-locale 파일명 순(=supabase CLI 적용 순서)으로
#   ON_ERROR_STOP 실행하고, 비타임스탬프 파일(auth_audit_log.sql 등)은 마지막에
#   별도로 실행한다 (supabase db reset 은 이 파일들을 적용하지 않음)
#
# 사용법: bash scripts/validate-migrations-empty-db.sh
set -u

REPO="$(cd "$(dirname "$0")/.." && pwd)"
MIGDIR="$REPO/supabase/migrations"
CONTAINER=pg-migration-validate
PORT="${VALIDATE_PG_PORT:-55432}"
export PGPASSWORD=postgres
PSQL="psql -h 127.0.0.1 -p $PORT -U postgres -d postgres -v ON_ERROR_STOP=1 -q"

cleanup() { docker rm -f $CONTAINER >/dev/null 2>&1; }
trap cleanup EXIT

cleanup
docker run -d --rm --name $CONTAINER -e POSTGRES_PASSWORD=postgres -p "$PORT:5432" postgres:16-alpine >/dev/null || exit 1

echo "waiting for postgres..."
for i in $(seq 1 30); do
  docker exec $CONTAINER pg_isready -U postgres >/dev/null 2>&1 && break
  sleep 1
done
sleep 2

echo "== applying supabase platform shim =="
$PSQL <<'SHIM'
DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  raw_app_meta_data jsonb DEFAULT '{}'::jsonb,
  raw_user_meta_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE
AS $$ SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE
AS $$ SELECT COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), 'anon') $$;
CREATE SCHEMA IF NOT EXISTS storage;
CREATE TABLE IF NOT EXISTS storage.buckets (
  id text PRIMARY KEY,
  name text NOT NULL,
  public boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS storage.objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text,
  name text,
  owner uuid,
  created_at timestamptz DEFAULT now()
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;
SHIM
[ $? -ne 0 ] && { echo "SHIM FAILED"; exit 1; }

PASS=0; FAIL=0; FAILED_FILES=""
cd "$MIGDIR" || exit 1

FILES=$(ls | LC_ALL=C sort | grep -E '^[0-9]+_.*\.sql$')
EXTRA=$(ls | LC_ALL=C sort | grep -E '\.sql$' | grep -vE '^[0-9]+_.*\.sql$')

echo "== applying timestamped migrations (supabase CLI order) =="
for f in $FILES; do
  OUT=$($PSQL -f "$f" 2>&1)
  if [ $? -eq 0 ]; then
    echo "OK   $f"
    PASS=$((PASS+1))
  else
    echo "FAIL $f"
    echo "$OUT" | grep -E "ERROR|LINE|DETAIL|HINT" | head -6 | sed 's/^/     /'
    FAIL=$((FAIL+1)); FAILED_FILES="$FAILED_FILES $f"
  fi
done

echo "== applying non-timestamped extras =="
for f in $EXTRA; do
  OUT=$($PSQL -f "$f" 2>&1)
  if [ $? -eq 0 ]; then
    echo "OK   $f (extra)"
  else
    echo "FAIL $f (extra)"
    echo "$OUT" | grep -E "ERROR|LINE|DETAIL|HINT" | head -6 | sed 's/^/     /'
    FAIL=$((FAIL+1)); FAILED_FILES="$FAILED_FILES $f(extra)"
  fi
done

echo ""
echo "== summary: $PASS passed, $FAIL failed =="
[ -n "$FAILED_FILES" ] && echo "failed:$FAILED_FILES"
[ $FAIL -eq 0 ] && exit 0 || exit 2
