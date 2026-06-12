import { ref } from 'vue';

export type SequenceLogLevel = 'info' | 'warn' | 'debug' | 'layout';

export interface SequenceLogLine {
  ts: number;
  level: SequenceLogLevel;
  tag: string;
  message: string;
}

const MAX_LINES = 800;

/** 템플릿·devtools에서 구독 */
export const sequenceLogLines = ref<SequenceLogLine[]>([]);

function trim() {
  if (sequenceLogLines.value.length > MAX_LINES) {
    sequenceLogLines.value = sequenceLogLines.value.slice(-MAX_LINES);
  }
}

/**
 * 시퀀스/레이아웃 디버그 로그 (BpmnLayouter·waypoints 등에서 호출)
 * @example pushSequenceLog('layout', 'obstacle', `reroute ${connectionId}`)
 */
export function pushSequenceLog(
  level: SequenceLogLevel,
  tag: string,
  message: string,
) {
  sequenceLogLines.value = [
    ...sequenceLogLines.value,
    { ts: Date.now(), level, tag, message },
  ];
  trim();
}

export function clearSequenceLog() {
  sequenceLogLines.value = [];
}

declare global {
  interface Window {
    /** 브라우저 콘솔에서: sequenceLog('info','test','hello') */
    sequenceLog: typeof pushSequenceLog;
    clearSequenceLog: typeof clearSequenceLog;
  }
}

if (typeof window !== 'undefined') {
  window.sequenceLog = pushSequenceLog;
  window.clearSequenceLog = clearSequenceLog;
}
