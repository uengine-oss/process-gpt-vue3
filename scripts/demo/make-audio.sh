#!/usr/bin/env bash
# P5.4.3 PAL 시연 내레이션 음성 생성 (edge-tts, ko-KR).
#   bash scripts/demo/make-audio.sh [보이스]
# 원고: docs/demo-p543-pal/narration/partN.txt → 음성: docs/demo-p543-pal/audio/partN.mp3
set -euo pipefail
cd "$(dirname "$0")/../.."

VOICE="${1:-ko-KR-InJoonNeural}"   # 남성 발표 톤. 여성: ko-KR-SunHiNeural
SRC=docs/demo-p543-pal/narration
OUT=docs/demo-p543-pal/audio
mkdir -p "$OUT"

for f in "$SRC"/part*.txt; do
    n=$(basename "$f" .txt)
    echo "TTS: $n ($VOICE)"
    uvx edge-tts --voice "$VOICE" --rate=-5% --file "$f" --write-media "$OUT/$n.mp3"
done
echo "완료: $OUT"
ls -la "$OUT"
