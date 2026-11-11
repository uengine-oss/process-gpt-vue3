/**
 * 말로 입력하기.
 *
 * 포털과 같은 경로를 쓴다 — 녹음한 소리를 `/completion/upload` 로 보내면
 * 받아쓴 글이 돌아온다. 다른 방법을 쓰면 인식 품질이 화면마다 달라진다.
 * 그래서 녹음 · 받아쓰기 · 이어 쓰기는 포털 업무 화면과 한 벌을 쓴다(src/shared/dictation).
 *
 * 휴대폰에서 특히 쓸모가 있다. 작은 자판으로 긴 의견을 적는 것보다 말하는 편이
 * 훨씬 빠르고, 현장에서 한 손으로 쓰는 상황이 많다.
 */
export { appendTranscript, canRecord, isDenied, reasonText, startRecording, transcribe } from '../../../src/shared/dictation/index.js';
