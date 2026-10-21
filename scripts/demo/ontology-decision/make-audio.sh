#!/usr/bin/env bash
# 온톨로지 근거 에이전트 판단(spec 018) 영상 나레이션(edge-tts, ko-KR) — 시나리오별.
#   bash scripts/demo/ontology-decision/make-audio.sh <sc1|sc21|sc22> [보이스]
# 원고 docs/manuals/video/ontology-agent-decision/<sc>/narration/sN.txt → 음성 .../audio/sN.mp3
set -euo pipefail
cd "$(dirname "$0")/../../.."
SC="${1:?sc1|sc21|sc22}"
VOICE="${2:-ko-KR-HyunsuMultilingualNeural}"
DIR=docs/manuals/video/ontology-agent-decision/$SC
mkdir -p "$DIR/audio"
for f in "$DIR"/narration/s*.txt; do
    n=$(basename "$f" .txt)
    echo "TTS: $n"
    # 음성 서비스가 가끔 빈 응답(NoAudioReceived)을 준다 — 몇 번 다시 시도
    for try in 1 2 3 4; do
        uvx edge-tts --voice "$VOICE" --rate=+4% --file "$f" --write-media "$DIR/audio/$n.mp3" 2>/dev/null && break
        [ "$try" = 4 ] && { echo "TTS 실패: $n" >&2; exit 1; }
        sleep 3
    done
done
