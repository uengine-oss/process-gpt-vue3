#!/bin/sh

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
MIGRATIONS_DIR="$REPO_ROOT/supabase/migrations"
MODE=apply

if [ "${1:-}" = "--dry-run" ]; then
  MODE=dry-run
elif [ "$#" -ne 0 ]; then
  echo "Usage: $0 [--dry-run]" >&2
  exit 2
fi

# Supabase uses the numeric prefix before the first underscore as the
# migration version. Candidate source names are comma-separated so this also
# repairs repositories already renamed by an older version of this script.
MAPPINGS='20260130_proc_def_comments_approval.sql|20260130000001_proc_def_comments_approval.sql
20260130_standard_terminology.sql|20260130000002_standard_terminology.sql
20260213_kpi_review_board.sql,20260213000002_kpi_review_board.sql|20260213000001_kpi_review_board.sql
20260213_review_per_submission.sql,20260213000003_review_per_submission.sql|20260213000002_review_per_submission.sql
20260213_assigned_reviewer.sql,20260213000001_assigned_reviewer.sql|20260213000003_assigned_reviewer.sql
20260223_governance_workflow.sql|20260223000001_governance_workflow.sql
20260316_add_deprecated_at_to_task_property_schema.sql|20260316000001_add_deprecated_at_to_task_property_schema.sql
20260316_expand_task_property_schema_columns.sql|20260316000002_expand_task_property_schema_columns.sql
20260403_role_based_rls.sql|20260403000001_role_based_rls.sql
20260409_review_role_alignment.sql|20260409000001_review_role_alignment.sql
20260409_review_submission_identity.sql|20260409000002_review_submission_identity.sql
20260409_review_owner_enforcement.sql|20260409000003_review_owner_enforcement.sql
20260429_lock_heartbeat_columns.sql|20260429000001_lock_heartbeat_columns.sql
20260514_users_last_seen.sql|20260514000001_users_last_seen.sql
20260521_proc_def_editor_insert_policy.sql|20260521000001_proc_def_editor_insert_policy.sql
20260709_systems_table.sql|20260709000001_systems_table.sql
20260710_systems_soft_delete.sql|20260710000001_systems_soft_delete.sql'

errors=0
while IFS='|' read -r source_names new_name; do
  new_path="$MIGRATIONS_DIR/$new_name"
  source_count=0

  saved_ifs=$IFS
  IFS=,
  for source_name in $source_names; do
    if [ -e "$MIGRATIONS_DIR/$source_name" ]; then
      source_count=$((source_count + 1))
    fi
  done
  IFS=$saved_ifs

  if [ -e "$new_path" ] && [ "$source_count" -ne 0 ]; then
    echo "ERROR: target and source both exist: $new_name" >&2
    errors=1
  elif [ ! -e "$new_path" ] && [ "$source_count" -eq 0 ]; then
    echo "ERROR: source file not found: $source_names" >&2
    errors=1
  elif [ "$source_count" -gt 1 ]; then
    echo "ERROR: multiple source variants exist: $source_names" >&2
    errors=1
  fi
done <<EOF
$MAPPINGS
EOF

if [ "$errors" -ne 0 ]; then
  echo "No files were changed." >&2
  exit 1
fi

while IFS='|' read -r source_names new_name; do
  new_path="$MIGRATIONS_DIR/$new_name"
  old_name=

  saved_ifs=$IFS
  IFS=,
  for source_name in $source_names; do
    if [ -e "$MIGRATIONS_DIR/$source_name" ]; then
      old_name=$source_name
      break
    fi
  done
  IFS=$saved_ifs

  if [ -z "$old_name" ] && [ -e "$new_path" ]; then
    echo "SKIP   $new_name (already renamed)"
  elif [ "$MODE" = "dry-run" ]; then
    echo "RENAME $old_name -> $new_name"
  else
    mv "$MIGRATIONS_DIR/$old_name" "$new_path"
    echo "RENAMED $old_name -> $new_name"
  fi
done <<EOF
$MAPPINGS
EOF

if [ "$MODE" = "dry-run" ]; then
  echo "Dry run complete. Run without --dry-run to apply."
else
  echo "Migration versions updated. Run: supabase start"
fi
