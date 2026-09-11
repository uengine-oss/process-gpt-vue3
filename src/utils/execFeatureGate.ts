/**
 * 실행(Exec) 기능 노출 게이트.
 *
 * 순서도의 실행 버튼 · 실행 ID 패널 · Exec 모드 뷰어 · /executable 명령은
 * 실행 엔진이 있는 배포에서만 의미가 있는 기능이다.
 *
 * 판별 기준 (PAL 모드):
 *   1. 엔진 모드(window.$mode === 'uEngine')일 것 — 엔진 없는 배포(문서화 전용)에서는 항상 숨김
 *   2. VITE_FF_EXECUTION 플래그가 꺼져 있지 않을 것 (미설정 시 기본 ON)
 *   3. 관리자(admin)일 것 — authClaimsState.isAdmin (role='admin' reconcile 포함)
 *
 * 비 PAL 모드는 기존 동작(관리자 여부만 판별)을 그대로 유지한다.
 */
import { authClaimsState } from '@/utils/authClaims';

/** VITE_FF_EXECUTION 판정: 런타임(window._env_) → 빌드타임(import.meta.env) 순. 미설정/빈값은 ON. */
function isExecutionFlagEnabled(): boolean {
    const runtime = (window as any)._env_?.VITE_FF_EXECUTION;
    const build = (import.meta as any).env?.VITE_FF_EXECUTION;
    const raw = runtime !== undefined && runtime !== '' ? runtime : build;
    if (raw === undefined || raw === null || raw === '') return true;
    return raw === true || raw === 'true';
}

function isEngineMode(): boolean {
    return (window as any).$mode === 'uEngine';
}

export function canUseExecFeatures(): boolean {
    if (!authClaimsState.isAdmin) return false;
    if ((window as any).$pal) {
        return isEngineMode() && isExecutionFlagEnabled();
    }
    return true;
}
