#!/bin/sh
# 로컬 supabase(CLI) DB 에 Apache AGE 를 넣는다.
#
# supabase CLI 는 DB 이미지를 바꾸는 설정이 없고, 로컬에 같은 태그가 있으면 pull 하지 않는다.
# 그래서 AGE 를 얹은 이미지를 CLI 가 쓰는 태그 그대로 덮어쓰고 DB 컨테이너만 다시 만든다.
# 데이터는 supabase_db_* 볼륨에 있어 유지된다.
#
# supabase CLI 를 올리면서 postgres 이미지 버전이 바뀌면 AGE 가 빠진다 — 그때 BASE_IMAGE 를 맞춰 다시 실행.
set -eu

cd "$(dirname "$0")"
PROJECT_DIR="$(cd ../.. && pwd)"
BASE_IMAGE="${BASE_IMAGE:-public.ecr.aws/supabase/postgres:15.8.1.085}"
ORIG_TAG="${BASE_IMAGE%:*}:$(echo "${BASE_IMAGE##*:}")-orig"
AGE_TAG="process-gpt/supabase-postgres-age:${BASE_IMAGE##*:}"

# 원본 이미지를 처음 한 번만 -orig 로 보관한다. (이미 AGE 이미지로 덮인 뒤라면 건너뜀)
if ! docker image inspect "$ORIG_TAG" >/dev/null 2>&1; then
    docker tag "$BASE_IMAGE" "$ORIG_TAG"
fi

docker build --build-arg BASE_IMAGE="$ORIG_TAG" -t "$AGE_TAG" .
docker tag "$AGE_TAG" "$BASE_IMAGE"

# DB 컨테이너를 새 이미지로 다시 만든다.
cd "$PROJECT_DIR"
supabase stop
supabase start

# AGE 확장 생성은 superuser 가 필요하다 (supabase 의 postgres 유저는 superuser 아님). 로컬 기본 비밀번호 사용.
docker exec -e PGPASSWORD="${SUPABASE_ADMIN_PASSWORD:-postgres}" supabase_db_process-gpt-vue3 \
    psql -h 127.0.0.1 -U supabase_admin -d postgres -v ON_ERROR_STOP=1 \
    -c "CREATE EXTENSION IF NOT EXISTS age" \
    -c "SELECT extname, extversion FROM pg_extension WHERE extname = 'age'"
