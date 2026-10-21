#!/usr/bin/env bash
# 온톨로지 근거 에이전트 판단(spec 018) 영상 합성 — 시나리오별 장면 영상(clips/sN.webm)·카드(sN.png) + 나레이션(audio/sN.mp3)
# → docs/manuals/video/ontology-agent-decision/<sc>.mp4 + 자막(srt). 장면 목록은 narration/sN.txt 로 정한다.
#   bash scripts/demo/ontology-decision/make-video.sh <sc1|sc21|sc22> <ffmpeg> <ffprobe>
# 시스템에 ffmpeg 가 없으면 스크래치 폴더에 `npm i ffmpeg-static ffprobe-static` 후 그 경로를 넘긴다.
#
# 장면 길이 = max(나레이션+여유, 화면 영상). 화면이 나레이션보다 길면 최대 1.35배까지 빨리 돌려 빈 구간을 줄이고,
# 짧으면 마지막 프레임을 정지 화면으로 늘린다. 나레이션은 장면 시작 0.6초 뒤에 깔린다.
set -euo pipefail
cd "$(dirname "$0")/../../.."
SC="${1:?sc1|sc21|sc22}"; FF="${2:-ffmpeg}"; FP="${3:-ffprobe}"
DIR=docs/manuals/video/ontology-agent-decision/$SC
OUT=docs/manuals/video/ontology-agent-decision/$SC.mp4
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
dur() { "$FP" -v error -show_entries format=duration -of csv=p=0 "$1"; }
VF="scale=1440:900:flags=lanczos,fps=30,format=yuv420p"

: > "$TMP/list.txt"
: > "$TMP/srt-src.txt"
t_acc=0
for n in $(ls "$DIR"/narration/s*.txt | sed -E 's/.*s([0-9]+)\.txt/\1/' | sort -n); do
    a="$DIR/audio/s$n.mp3"; ad=$(dur "$a"); trim=""
    if [ -f "$DIR/clips/s$n.png" ]; then
        len=$(python3 -c "print(round($ad + 1.8, 2))")
        "$FF" -loglevel error -y -loop 1 -i "$DIR/clips/s$n.png" -i "$a" \
            -filter_complex "[0:v]$VF[v];[1:a]adelay=600|600,apad[a]" \
            -map "[v]" -map "[a]" -t "$len" -c:v libx264 -preset veryfast -crf 24 -c:a aac -b:a 128k -ar 44100 "$TMP/p$n.mp4"
    else
        v="$DIR/clips/s$n.webm"
        # 녹화 드라이버가 남긴 앞부분 잘라낼 길이(첫 자막 직전까지 = 페이지 로딩 구간)
        trim=$(python3 -c "import json;print(json.load(open('$DIR/clips/state.json')).get('trims',{}).get('$n',0))" 2>/dev/null || echo 0)
        vd=$(python3 -c "print(max(1.0, $(dur "$v") - $trim))")
        read -r speed len < <(python3 -c "
a=$ad+1.6; v=$vd
s=min(v/a, 1.35) if v>a else 1.0
print(round(s,3), round(max(a, v/s), 2))")
        "$FF" -loglevel error -y -ss "$trim" -i "$v" -i "$a" \
            -filter_complex "[0:v]setpts=PTS/$speed,tpad=stop_mode=clone:stop_duration=120,$VF[v];[1:a]adelay=600|600,apad[a]" \
            -map "[v]" -map "[a]" -t "$len" -c:v libx264 -preset veryfast -crf 24 -c:a aac -b:a 128k -ar 44100 "$TMP/p$n.mp4"
    fi
    echo "s$n: narration ${ad}s → part ${len}s${trim:+ (앞 ${trim}s 잘라냄)}"
    echo "file '$TMP/p$n.mp4'" >> "$TMP/list.txt"
    echo "$t_acc|$ad|$DIR/narration/s$n.txt" >> "$TMP/srt-src.txt"
    t_acc=$(python3 -c "print($t_acc + $len)")
done
"$FF" -loglevel error -y -f concat -safe 0 -i "$TMP/list.txt" -c copy -movflags +faststart "$OUT"

# 자막: 장면 나레이션을 문장 단위로 쪼개 글자 수 비례로 시간을 나눈다
python3 - "$TMP/srt-src.txt" "${OUT%.mp4}.srt" <<'EOF'
import re, sys
def ts(t):
    h, r = divmod(t, 3600); m, s = divmod(r, 60)
    return f"{int(h):02}:{int(m):02}:{int(s):02},{int(round((s - int(s)) * 1000)):03}"
cues = []
for line in open(sys.argv[1], encoding="utf-8"):
    start, dur, path = line.rstrip("\n").split("|")
    text = " ".join(open(path, encoding="utf-8").read().split())
    sents = [s for s in re.split(r"(?<=[.?!])\s+", text) if s]
    total = sum(len(s) for s in sents)
    t = float(start) + 0.6
    for s in sents:
        d = float(dur) * len(s) / total
        cues.append((t, t + d, s)); t += d
with open(sys.argv[2], "w", encoding="utf-8") as f:
    for i, (a, b, s) in enumerate(cues, 1):
        f.write(f"{i}\n{ts(a)} --> {ts(b)}\n{s}\n\n")
EOF
echo "완료: $OUT ($(dur "$OUT")s), ${OUT%.mp4}.srt"
