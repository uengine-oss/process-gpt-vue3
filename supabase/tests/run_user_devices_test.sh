#!/usr/bin/env bash
# 로컬 Supabase 에 대고 user_devices 접근 제한을 검증한다.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
CT="$(docker ps --format '{{.Names}}' | grep '^supabase_db_' | head -1)"
[ -n "$CT" ] || { echo "로컬 Supabase 가 떠 있지 않습니다 (npx supabase start)"; exit 1; }

docker exec -i "$CT" psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  < "$HERE/../migrations/202608310001_user_devices_rls.sql" > /dev/null
docker exec -i "$CT" psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  < "$HERE/user_devices_rls_test.sql"
echo "==> 통과"
