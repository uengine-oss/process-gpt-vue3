/**
 * 칸반 카드 · 열의 상태 색.
 *
 * 전에는 내 업무 카드를 주 색으로 꽉 칠하고(흰 글자), 열마다 다른 옅은 바탕(회색 · 하늘 · 연두)을 깔았다.
 * 꽉 찬 카드 안에 빨간 「기한 지남」 칩이 앉으면 읽히지 않았고, 다크 테마에서는 열 바탕이 짙은 파랑 · 초록이 됐다
 * (2026-11-11 검토 「여기 UI도 약간 조금 어색해요」). 이제 카드는 흰 면 그대로 두고 상태는 왼쪽 띠와
 * 열 머리의 점으로만 보인다. 상태 → 색 이름 규칙을 여기 한 곳에 둔다(카드 · 열 머리가 같이 쓴다).
 */

/** 업무 상태(또는 칸반 열 id) → 색 이름. 'progress' | 'waiting' | 'todo' | 'done' */
export function kanbanTone(status) {
    const s = String(status || '').toUpperCase();
    if (s === 'DONE' || s === 'COMPLETED') return 'done';
    if (s === 'PENDING') return 'waiting';
    if (s === 'IN_PROGRESS' || s === 'SUBMITTED' || s === 'NEW' || s === 'RUNNING') return 'progress';
    return 'todo';
}

/**
 * 색 이름 → CSS 색. 앱 토큰(Vuetify 테마 · --cds-*)만 써서 라이트 · 스카이 · 다크가 함께 맞는다.
 * 진행 중은 주 색, 보류는 경고 색, 완료는 성공 색, 예정은 흐린 글자 색.
 */
export const TONE_COLOR = {
    progress: 'rgb(var(--v-theme-primary))',
    waiting: 'rgb(var(--v-theme-warning))',
    done: 'rgb(var(--v-theme-success))',
    todo: 'var(--cds-text-muted)'
};
