/**
 * Ontology Explorer New 배포 구성 (specs/005 — 레이어 활성화 정책).
 *
 * 5계층(전략/프로세스/테스크/리소스/지식) 구현은 전부 유지하되, 배포(프로젝트)별로
 * 어떤 레이어를 노출할지 이 목록으로 결정한다. 목록에서 빠진 레이어는
 * 서버 조회(p_layers)·레이어 토글·범례·빈 레이어 배지·추적 도달점에서
 * 일괄 제외된다 — 코드 변경 없이 이 배열만 바꾸면 재활성화된다.
 *
 * 현재 프로젝트: 전략(BSC·KPI) 레이어는 사용하지 않음 → 'strategy' 제외.
 * 전략 레이어를 다시 켜려면 아래 배열에 'strategy' 를 추가하면 된다
 * (데모 데이터는 scripts/seed-ontology-graph.mjs --demo-strategy 로 적재).
 */
import { LAYER_ORDER } from './layerMapping';
import type { BusinessLayer } from './types';

export const ENABLED_LAYERS: BusinessLayer[] = ['process', 'task', 'resource', 'knowledge'];

export function isLayerEnabled(layer: BusinessLayer): boolean {
    return ENABLED_LAYERS.includes(layer);
}

/** 활성 레이어를 밴드 순서(위→아래)대로 — 화면 토글/범례 순회용 */
export function enabledLayerOrder(): BusinessLayer[] {
    return LAYER_ORDER.filter((layer) => ENABLED_LAYERS.includes(layer));
}

/** 전 레이어 활성 여부 — 전부 켜져 있으면 RPC p_layers 를 생략(서버 기본 전체 조회) */
export function allLayersEnabled(): boolean {
    return LAYER_ORDER.every((layer) => ENABLED_LAYERS.includes(layer));
}
