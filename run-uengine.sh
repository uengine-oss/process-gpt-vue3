#!/bin/sh
set -eu

MODE_FILE="src/main.ts"
BACKUP_FILE="$(mktemp)"

cp "$MODE_FILE" "$BACKUP_FILE"

restore_mode() {
  if [ -f "$BACKUP_FILE" ]; then
    cp "$BACKUP_FILE" "$MODE_FILE"
    rm -f "$BACKUP_FILE"
  fi
}

trap restore_mode EXIT
trap 'restore_mode; exit 130' INT
trap 'restore_mode; exit 143' TERM

node -e "const fs = require('fs'); const file = '$MODE_FILE'; const source = fs.readFileSync(file, 'utf8'); const updated = source.replace(/value: 'ProcessGPT'/, \"value: 'uEngine'\"); if (updated === source) { console.error('Could not switch mode: ProcessGPT mode marker not found.'); process.exit(1); } fs.writeFileSync(file, updated);"

npm run dev -- "$@"
