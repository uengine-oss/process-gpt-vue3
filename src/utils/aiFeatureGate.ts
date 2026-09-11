/**
 * AI 기능 노출 게이트 (execFeatureGate 와 동형).
 *
 * 마스터 플래그 VITE_FF_AI 가 꺼지면 모든 AI 기능이 숨는다.
 * 세부 플래그는 마스터가 켜져 있을 때만 개별 영역을 끌 수 있다:
 *   - VITE_FF_AI_COPILOT  : 순서도 AI Copilot 패널 · Blueprint/AN 스튜디오 · AI BPMN 생성 · Lane/PI Flag AI
 *   - VITE_FF_AI_DESIGNER : BPMN 속성 패널의 인라인 생성 버튼(조건룰·cron·스크립트·API 등) · 이름/ID/diff 자동 생성
 *   - VITE_FF_AI_FORM     : 폼/워크아이템 AI 예시 생성
 *
 * 모든 플래그는 런타임(window._env_) → 빌드타임(import.meta.env) 순으로 읽고,
 * 미설정/빈값은 ON — 플래그를 명시하지 않은 배포는 기존 동작과 동일하다.
 */

export type AiFeatureKey = 'COPILOT' | 'DESIGNER' | 'FORM';

function resolveFlag(name: string): boolean {
    const runtime = (window as any)._env_?.[name];
    const build = (import.meta as any).env?.[name];
    const raw = runtime !== undefined && runtime !== '' ? runtime : build;
    if (raw === undefined || raw === null || raw === '') return true;
    return raw === true || raw === 'true';
}

export function canUseAiFeatures(sub?: AiFeatureKey): boolean {
    if (!resolveFlag('VITE_FF_AI')) return false;
    if (sub && !resolveFlag(`VITE_FF_AI_${sub}`)) return false;
    return true;
}

export const AI_DISABLED_MESSAGE = '이 배포에서는 AI 기능이 비활성화되어 있습니다. (VITE_FF_AI)';

/** AI 호출부 공용 가드 — 꺼져 있으면 명시적 에러를 던져 잔여 진입점을 드러낸다. */
export function assertAiEnabled(sub?: AiFeatureKey): void {
    if (!canUseAiFeatures(sub)) throw new Error(AI_DISABLED_MESSAGE);
}
