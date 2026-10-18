#!/bin/bash
cd /Users/uengine/process-gpt/services/frontend
export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH"
exec node e2e/handover/record-mining-real.mjs
