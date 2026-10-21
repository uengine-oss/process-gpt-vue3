# 온톨로지 E2E 가이드 영상 — 다시 만들기

결과물: `../ontology-e2e-guide.mp4`(+ `.srt`). 가이드 문서: `../../ontology-e2e-guide.md`.
실제 실행을 녹화한다(tym 테넌트, manual-shots@uengine.org). 서비스(8088 화면·8000 엔진·폴링·8014 전략)가 떠 있어야 한다.

```bash
python3 scripts/demo/ontology-e2e/cleanup.py          # 이전 실행 데이터 삭제 (프로세스·인스턴스·KPI)
node scripts/demo/ontology-e2e/record.mjs              # 7장면 실행·녹화 → clips/sN.webm, 매뉴얼 캡처 19장 (약 5분)
bash scripts/demo/ontology-e2e/make-audio.sh           # narration/sN.txt → audio/sN.mp3 (원고 바꿨을 때만)
node scripts/demo/ontology-e2e/make-cards.mjs          # 타이틀·엔딩 카드 → clips/s0.png, s8.png
bash scripts/demo/ontology-e2e/make-video.sh <ffmpeg> <ffprobe>   # 합성 (ffmpeg 없으면 npm i ffmpeg-static ffprobe-static)
```

- 업로드 BPMN 은 `scripts/demo/ontology-e2e/make-bpmn.py` 로 만든다(레인 담당자·에이전트 uid 가 tym 기준으로 박혀 있음).
- `clips/state.json` 의 `trims` = 장면별로 잘라낼 앞부분(첫 자막 전 페이지 로딩·에이전트 대기 구간).
- 장면 하나만 다시 찍기: `node scripts/demo/ontology-e2e/record.mjs 6 7` (앞 장면이 만든 데이터를 state.json 에서 이어 씀).
