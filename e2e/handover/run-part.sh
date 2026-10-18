#!/bin/bash
# 녹화 구간 실행 래퍼. 셸 타임아웃과 무관하게 끝까지 돌도록 분리 실행한다.
cd /Users/uengine/process-gpt/services/frontend
export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH"
export SB_URL="http://127.0.0.1:54321"
export SB_KEY="$(grep -E '^SERVICE_ROLE_KEY=' /Users/uengine/process-gpt/docker-infra/.env | cut -d= -f2-)"
export PART="$1"
exec node e2e/handover/record-part.mjs
