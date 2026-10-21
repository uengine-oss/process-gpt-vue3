#!/bin/sh
# 로컬 supabase(CLI) DB 에 ontological-db 확장을 넣는다 (spec 014 US1). supabase/age/install.sh 와 같은 방식.
#
# supabase CLI 는 DB 이미지를 바꾸는 설정이 없고, 로컬에 같은 태그가 있으면 pull 하지 않는다.
# 그래서 확장을 얹은 이미지를 CLI 가 쓰는 태그 그대로 덮어쓰고 DB 컨테이너만 다시 만든다.
# 데이터는 supabase_db_* 볼륨에 있어 유지된다. BASE_IMAGE 가 이미 AGE 를 얹은 태그라면 두 확장이 함께 들어간다.
#
# 되돌리기: docker tag process-gpt/supabase-postgres-age:${BASE_IMAGE##*:} "$BASE_IMAGE" (AGE 만) 또는 "${BASE_IMAGE}-orig" (확장 없음) 후 supabase stop && supabase start
set -eu

cd "$(dirname "$0")"
PROJECT_DIR="$(cd ../.. && pwd)"
BASE_IMAGE="${BASE_IMAGE:-public.ecr.aws/supabase/postgres:15.8.1.085}"
ORIG_TAG="${BASE_IMAGE}-orig"
OG_TAG="process-gpt/supabase-postgres-ontological:${BASE_IMAGE##*:}"
SERVICE_ROLE="${OG_SERVICE_ROLE:-postgres}"

# 원본(확장 없는) 이미지는 처음 한 번만 -orig 로 보관한다.
if ! docker image inspect "$ORIG_TAG" >/dev/null 2>&1; then
    docker tag "$BASE_IMAGE" "$ORIG_TAG"
fi

# 현재 CLI 태그(AGE 가 얹혀 있으면 그것까지)를 베이스로 빌드한다.
docker build --build-arg BASE_IMAGE="$BASE_IMAGE" -t "$OG_TAG" .
docker tag "$OG_TAG" "$BASE_IMAGE"

cd "$PROJECT_DIR"
supabase stop
supabase start

# 확장 생성은 superuser 가 필요하다(supabase 의 postgres 유저는 superuser 아님).
# og_grant 가 함수·테이블 권한을 주고, 런타임 타입 생성(새 라벨)에 필요한 og_data 스키마 CREATE 는 따로 준다.
docker exec -e PGPASSWORD="${SUPABASE_ADMIN_PASSWORD:-postgres}" supabase_db_process-gpt-vue3 \
    psql -h 127.0.0.1 -U supabase_admin -d postgres -v ON_ERROR_STOP=1 \
    -c "CREATE EXTENSION IF NOT EXISTS ontological CASCADE" \
    -c "SELECT og_grant('${SERVICE_ROLE}', 'admin')" \
    -c "GRANT CREATE ON SCHEMA og_data TO ${SERVICE_ROLE}" \
    -c "SELECT extname, extversion FROM pg_extension WHERE extname IN ('ontological', 'vector', 'age') ORDER BY 1"
