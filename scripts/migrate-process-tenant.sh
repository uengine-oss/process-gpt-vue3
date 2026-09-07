#!/bin/sh

set -eu

usage() {
    cat <<'USAGE'
Usage:
  PROCESS_MIGRATION_DATABASE_URL='postgresql://...' \
    scripts/migrate-process-tenant.sh --source SOURCE [options]

Options:
  --source TENANT       Source tenant id (required)
  --target TENANT       Target tenant id (default: tym)
  --include-runtime     Also move instances, work items, and runtime analytics
  --apply               Commit after validation (default: preview and rollback)
  -h, --help            Show this help

Examples:
  # Safe preview
  PROCESS_MIGRATION_DATABASE_URL="$PROCESS_MIGRATION_DATABASE_URL" \
    scripts/migrate-process-tenant.sh --source process-gpt

  # One-shot migration to tym
  PROCESS_MIGRATION_DATABASE_URL="$PROCESS_MIGRATION_DATABASE_URL" \
    scripts/migrate-process-tenant.sh --source process-gpt --apply
USAGE
}

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
SQL_FILE="$SCRIPT_DIR/migrate-process-tenant.sql"
SOURCE_TENANT=
TARGET_TENANT=tym
INCLUDE_RUNTIME=false
APPLY=false

while [ "$#" -gt 0 ]; do
    case "$1" in
        --source)
            [ "$#" -ge 2 ] || { echo "Missing value for --source" >&2; exit 2; }
            SOURCE_TENANT=$2
            shift 2
            ;;
        --target)
            [ "$#" -ge 2 ] || { echo "Missing value for --target" >&2; exit 2; }
            TARGET_TENANT=$2
            shift 2
            ;;
        --include-runtime)
            INCLUDE_RUNTIME=true
            shift
            ;;
        --apply)
            APPLY=true
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo "Unknown option: $1" >&2
            usage >&2
            exit 2
            ;;
    esac
done

[ -n "$SOURCE_TENANT" ] || { echo "--source is required" >&2; usage >&2; exit 2; }
[ -n "$TARGET_TENANT" ] || { echo "--target must not be empty" >&2; exit 2; }
[ -n "${PROCESS_MIGRATION_DATABASE_URL:-}" ] || {
    echo "PROCESS_MIGRATION_DATABASE_URL is required" >&2
    exit 2
}
command -v psql >/dev/null 2>&1 || { echo "psql is required" >&2; exit 127; }
[ -f "$SQL_FILE" ] || { echo "SQL file not found: $SQL_FILE" >&2; exit 1; }

if [ "$APPLY" = true ]; then
    APPLY_PSQL=true
    MODE_LABEL=APPLY
else
    APPLY_PSQL=false
    MODE_LABEL=PREVIEW
fi

echo "[$MODE_LABEL] process data: $SOURCE_TENANT -> $TARGET_TENANT (runtime: $INCLUDE_RUNTIME)"

psql "$PROCESS_MIGRATION_DATABASE_URL" \
    -X \
    --set=ON_ERROR_STOP=1 \
    --set=source_tenant="$SOURCE_TENANT" \
    --set=target_tenant="$TARGET_TENANT" \
    --set=include_runtime="$INCLUDE_RUNTIME" \
    --set=apply="$APPLY_PSQL" \
    --file="$SQL_FILE"
