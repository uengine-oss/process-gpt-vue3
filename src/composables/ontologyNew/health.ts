/**
 * health — 그래프 헬스 상태 파생 (specs/005 data-model.md §6, US5).
 *
 * INTEGRATION.md §9: "노드 존재 여부로 기능을 판단하지 말고 GraphMeta 와
 * 레이어 count 로 헬스체크할 것" — 미설치/버전 불일치/빈 레이어는 오류가
 * 아니라 상태값이다(SC-005).
 */
import { LAYER_ORDER } from './layerMapping';
import type { BusinessLayer, GraphHealth, HealthState } from './types';

/** 헬스 → 화면 상태 전이 (loading→notInstalled|incompatible|ready|error 는 호출부 책임) */
export function deriveHealthState(health: GraphHealth | null): HealthState {
    if (!health) return 'loading';
    if (!health.installed) return 'notInstalled';
    if (!health.compatible) return 'incompatible';
    return 'ready';
}

/**
 * 노드 0건 레이어 — 밴드 '적재된 데이터 없음' 배지 + 토글 비활성 대상 (FR-014).
 * 비활성(disabled) 레이어는 '빈 것'이 아니라 '이 배포에서 제외된 것'이므로
 * enabledLayers 밖의 레이어는 판정하지 않는다 (FR-021).
 */
export function deriveEmptyLayers(health: GraphHealth | null, enabledLayers: BusinessLayer[] = LAYER_ORDER): BusinessLayer[] {
    if (!health || !health.installed) return [];
    return LAYER_ORDER.filter((layer) => enabledLayers.includes(layer) && (health.layerCounts[layer] ?? 0) === 0);
}
