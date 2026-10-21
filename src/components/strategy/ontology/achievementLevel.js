// 달성률 → 상태 단계(위험·주의·양호)와 색. 전략맵 탭과 온톨로지 익스플로러가 같은 기준을 쓴다.
// 기준값은 분석 대시보드 차트 기준값(configuration 'dashboard_thresholds')의 KPI RAG 와 같다:
//   양호 ≥ kpi_rag_green_pct(기본 100) · 주의 ≥ kpi_rag_amber_pct(기본 50) · 그 미만 위험.
//   ('달성'이라 쓰지 않는다 — 테넌트가 기준을 100% 미만으로 낮추면 목표 미달인데 '달성'으로 읽힌다)

export const DEFAULT_LEVEL_THRESHOLDS = Object.freeze({ green: 100, amber: 50 });

/** 흰 배경에서 글자·채움 모두 4.5:1 이상인 고정색(테마 error/warning 은 파스텔이라 쓰지 않는다). */
export const LEVEL_COLORS = Object.freeze({ risk: '#dc2626', warn: '#b45309', ok: '#15803d', none: '#6b7280' });
export const LEVEL_TEXT = Object.freeze({ risk: '위험', warn: '주의', ok: '양호' });

/**
 * @param {number|null|undefined} achievement
 * @param {{ green: number, amber: number }} [thresholds]
 * @returns {'risk'|'warn'|'ok'|null} 달성률이 없으면 null
 */
export function achievementLevel(achievement, thresholds = DEFAULT_LEVEL_THRESHOLDS) {
    if (achievement == null || Number.isNaN(Number(achievement))) return null;
    const a = Number(achievement);
    if (a >= thresholds.green) return 'ok';
    if (a >= thresholds.amber) return 'warn';
    return 'risk';
}

export function levelColor(level) {
    return LEVEL_COLORS[level] || LEVEL_COLORS.none;
}
