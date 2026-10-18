#!/bin/bash
cd /Users/uengine/process-gpt/services/frontend
export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH"
export SB_URL="http://127.0.0.1:54321"
export SB_KEY="$(grep -E '^SERVICE_ROLE_KEY=' /Users/uengine/process-gpt/docker-infra/.env | cut -d= -f2-)"
exec node e2e/handover/record-work-handover.mjs
