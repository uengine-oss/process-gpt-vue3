#!/usr/bin/env bash
# 파트별 영상(webm)+내레이션(mp3)을 합친 리허설용 프리뷰 mp4 생성.
#   bash scripts/demo/make-preview.sh [ffmpeg경로]
# 영상이 음성보다 짧으면 마지막 프레임을 정지 화면으로 연장한다.
set -euo pipefail
cd "$(dirname "$0")/../.."

FFMPEG="${1:-ffmpeg}"
command -v "$FFMPEG" >/dev/null || { echo "ffmpeg가 필요합니다: $FFMPEG"; exit 1; }
DIR=docs/demo-p543-pal
mkdir -p "$DIR/preview"

for n in 1 2 3 4 5 6; do
    v="$DIR/videos/part$n.webm"; a="$DIR/audio/part$n.mp3"
    [ -f "$v" ] && [ -f "$a" ] || { echo "skip part$n (파일 없음)"; continue; }
    echo "preview: part$n"
    "$FFMPEG" -loglevel error -y -i "$v" -i "$a" \
        -filter_complex "[0:v]tpad=stop_mode=clone:stop_duration=120[v]" \
        -map "[v]" -map 1:a -c:v libx264 -pix_fmt yuv420p -preset veryfast -crf 23 -c:a aac -shortest \
        "$DIR/preview/part$n.mp4"
done
echo "완료: $DIR/preview"
ls -la "$DIR/preview"
