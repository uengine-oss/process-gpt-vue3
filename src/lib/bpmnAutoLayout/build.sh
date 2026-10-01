#!/usr/bin/env bash
# js/ 산출물(ESM + CJS + 타입 선언) 재생성. TypeScript 없이 쓰는 곳(Node 스크립트 등)에 js/ 만 복사하면 된다.
set -euo pipefail
cd "$(dirname "$0")"
TSC="$(cd ../../.. && pwd)/node_modules/typescript/bin/tsc"
rm -rf js && mkdir -p js/esm js/cjs
node "$TSC" bpmnAutoLayout.ts --outDir js/esm --module esnext --target es2020 --moduleResolution node --declaration --strict --skipLibCheck
node "$TSC" bpmnAutoLayout.ts --outDir js/cjs --module commonjs --target es2020 --moduleResolution node --strict --skipLibCheck
mv js/esm/bpmnAutoLayout.js js/esm/bpmnAutoLayout.mjs
mv js/cjs/bpmnAutoLayout.js js/cjs/bpmnAutoLayout.cjs
echo "built: js/esm/bpmnAutoLayout.mjs, js/esm/bpmnAutoLayout.d.ts, js/cjs/bpmnAutoLayout.cjs"
