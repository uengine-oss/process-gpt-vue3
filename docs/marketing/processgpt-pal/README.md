# ProcessGPT PAL 홍보 페이지

**PAL = Process Asset Library.** 회사명은 항상 **uEngine**(대소문자 정확히). 로고는 `assets/img/uengine-logo.png` — 진회색 워드마크라 다크 배경에서는 흰색 칩 위에 얹는다(히어로·푸터·영상 S3/S7). 원본은 레포 루트 `uEngine_logo (1).png`.

`index.html`은 uengine.org 제품 소개 페이지(processgpt / uengine6bpm / roboanalyzer / roboarchitect)의
구성 문법을 참고해 만든 단독 배포형 소개 페이지입니다. 폴더째 복사하면 어디서든 동작합니다
(외부 의존은 Google Fonts와 YouTube 임베드 2개뿐).

## 구성

- `index.html` — 소개 페이지 본문 (히어로 영상 → 문제 정의 → 6대 차별점 → 6단계 제품 투어 →
  거버넌스 → 운영 기능 → 비교표 → AI 옵션 → 기술 기반 → 관련 제품 → CTA)
- `assets/video/processgpt-pal-promo.mp4` — **제품 홍보 영상 (2분 40초)**.
  화면 데모 짜깁기가 아니라, 프로세스 자산화의 필요성과 가치를 설명하는 모션그래픽 브랜드 영상.
  7개 씬: ① 문서로 잠든 자산 → ② 문서 관리의 비용 4가지 → ③ PAL = Process Asset Library 소개 →
  ④ 자산이 된 프로세스(일반 **구매 프로세스** 예시를 새로 그림 — 타사 프로세스 미사용) →
  ⑤ 거버넌스(승인·병합 전 검증·감사 로그) → ⑥ 스키마 스튜디오 + AI는 선택 → ⑦ 클로징
- `assets/img/` — `docs/manuals/images/` 스크린샷 선별본 + 데모 영상 프레임 캡처
- `video-src/` — 홍보 영상 재생성 소스 (`scenes.html` 씬 애니메이션, `narration/` 나레이션 원고)

## 홍보 영상 재생성 파이프라인

시스템에 ffmpeg가 없으므로 `npm i ffmpeg-static`으로 정적 바이너리를 받는다
(drawtext 필터가 빠진 빌드라 텍스트는 전부 HTML로 렌더링).

1. **나레이션**: `video-src/narration/s1~s7.txt` →
   `uvx edge-tts --voice ko-KR-HyunsuMultilingualNeural --rate=-3% --file sN.txt --write-media sN.mp3`
   (Hyunsu 보이스가 InJoon보다 자연스러움. 길이는 s1 14.7 / s2 18.2 / s3 23.5 / s4 27.6 / s5 22.7 / s6 18.2 / s7 10.7초.)
2. **씬 녹화**: `video-src/scenes.html?scene=N`을 Playwright(`playwright-core`, 1440×900,
   `recordVideo`)로 씬 길이 + 0.9초 동안 녹화 → webm. 씬 애니메이션은 CSS delay로 타임라인을 짜고
   `load + 150ms`에 `body.go`로 시작. 폰트는 로컬 나눔 계열이라 로딩 지연 없음.
3. **씬 길이**(나레이션 + 1.7초 패딩): s1 18.5 / s2 21.2 / s3 27.3 / s4 31.5 / s5 26.1 / s6 20.5 / s7 15.5초.
   씬별로 `[0:v]fps=25,tpad=stop_mode=clone` + `[1:a]adelay=700,apad` → `-t 길이`로 mp4 인코딩
   (libx264 crf21, aac 24kHz mono, `-video_track_timescale 12800`)
4. **합본**: concat demuxer `-c copy -movflags +faststart`

나레이션 텍스트를 고치면 3단계의 씬 길이와 `scenes.html`의 CSS delay를 새 오디오 길이에 맞춰 조정할 것.

## 카피 출처·주의

- 서사 구조(문제 → 자산화 개념 → 작동 방식 → 통제 → 선택적 AI)는 `docs/pal-migration/` 문서와
  데모 내레이션의 포지셔닝("AI 없이도 완결")에서 가져왔다.
- 영상과 페이지의 프로세스 예시는 **일반 구매 프로세스(가공 예시)** 다. 이전 데모의 P5.4.3 내부심사
  프로세스는 타 업체 소유라 홍보물에 쓰지 않는다.
## 스크린샷 (자체 구매 프로세스로 재촬영 완료)

모든 `assets/img/` 스크린샷은 외부 실행 환경(http://34.22.71.73:8088, tym 테넌트)에서
직접 만든 **구매 프로세스**로 재촬영했다. 타사(P5.4.3 내부심사) 화면은 더 이상 쓰지 않는다.

- 재촬영 파이프라인·셀렉터는 `../../../` 기준 scratchpad(세션 임시)의 `reshoot/lib.js`에 있었다.
  로그인: `manual-shots@uengine.org` / 셀렉터는 `scripts/demo/record-demo.mjs`와 동일 계열.
- 만든 데이터: 도메인 `구매관리` → Mega `구매 운영` → Major `구매 실행` → 프로세스 `구매 프로세스`
  (id `01a0b2d7-be70-7430-9440-53a0f9efc8d4`). 태스크 4곳에 RACI·세부 절차·필수 Rule·Input 입력.
  목록 관리에 `구매 문서`(purchase-documents), 속성 스키마에 `Input (참조 문서)` 필드 추가.
- 삭제 주의: proc_def UI 삭제가 실패할 때가 있어, 중복본은 페이지 컨텍스트에서
  `window.$supabase`로 `proc_def.isdeleted=true` + `configuration.proc_map`의 sub 항목 제거로 정리했다.
- 페이지↔이미지 매핑: process-architecture/designer-overview/raci-matrix/validation은 구매 프로세스
  디자이너, schema-studio는 관리자 속성 스키마 화면, task-catalog-apply는 견적 검토 속성 패널,
  pdf-export/merge-verification은 구매 프로세스 PDF 정의서 미리보기(병합함이 비어 있어 PDF로 대체).
