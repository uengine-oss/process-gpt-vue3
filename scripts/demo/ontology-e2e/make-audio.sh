#!/usr/bin/env bash
# 온톨로지 E2E 가이드 영상 나레이션(edge-tts, ko-KR).
#   bash scripts/demo/ontology-e2e/make-audio.sh [보이스]
# 원고 docs/manuals/video/ontology-e2e-guide/narration/sN.txt → 음성 .../audio/sN.mp3
set -euo pipefail
cd "$(dirname "$0")/../../.."
VOICE="${1:-ko-KR-HyunsuMultilingualNeural}"
DIR=docs/manuals/video/ontology-e2e-guide
mkdir -p "$DIR/audio"
for f in "$DIR"/narration/s*.txt; do
    n=$(basename "$f" .txt)
    echo "TTS: $n"
    uvx edge-tts --voice "$VOICE" --rate=+4% --file "$f" --write-media "$DIR/audio/$n.mp3"
done
