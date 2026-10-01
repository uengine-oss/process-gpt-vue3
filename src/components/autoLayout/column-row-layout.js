/**
 * 신규 자동 정렬(열·행 결정형) 브리지 — src/lib/bpmnAutoLayout(순수 XML 로직)의 결과를
 * 살아있는 bpmn-js 모델러에 적용한다.
 *
 * 흐름: saveXML → computeBpmnLayout(xml) → 도형 bounds / 선 waypoint / 외부 라벨 위치를
 *       structured-layout 의 명령(uengine.structuredLayout)으로 한 번에 적용 (Ctrl+Z 로 되돌리기 가능).
 *
 * 기존 로직(window.BpmnAutoLayout.applyAutoLayout)과 나란히 두고 결과를 비교하기 위한 두 번째 버튼용.
 * 배치 규칙은 src/lib/bpmnAutoLayout/README.md 참조.
 */
import { computeBpmnLayout } from '@/lib/bpmnAutoLayout';
import { applyGeometryEntries } from './structured-layout/apply-layout.js';

const ORIENTED_TYPES = ['bpmn:Participant', 'bpmn:Lane'];
const LABEL_GAP = 4;
const noop = () => undefined;

function segmentMidpoint(points) {
    if (points.length < 2) return points[0] || { x: 0, y: 0 };
    const i = Math.floor((points.length - 1) / 2);
    const a = points[i];
    const b = points[i + 1];
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** 살아있는 모델러의 XML 로 새 좌표를 계산해 엔트리 목록으로 돌려준다 (적용은 하지 않음). */
export async function planColumnRowLayout(modeler) {
    const { xml } = await modeler.saveXML({ format: false });
    const result = computeBpmnLayout(xml);
    const registry = modeler.get('elementRegistry');
    const after = [];
    const planned = new Map();

    for (const s of result.shapes) {
        const element = registry.get(s.id);
        if (!element || element.waypoints || element.labelTarget) continue;
        const entry = { element, bounds: { x: s.x, y: s.y, width: s.w, height: s.h } };
        if (element.di && ORIENTED_TYPES.includes(element.type)) entry.orientation = { value: true };
        after.push(entry);
        planned.set(s.id, entry);
    }
    for (const e of result.edges) {
        const element = registry.get(e.id);
        if (!element || !element.waypoints || e.points.length < 2) continue;
        const entry = { element, waypoints: e.points.map((p) => ({ x: p.x, y: p.y })) };
        after.push(entry);
        planned.set(e.id, entry);
    }
    // 외부 라벨(이벤트·게이트웨이 이름, 선 이름)은 새 로직이 좌표를 만들지 않으므로 대상 옆에 다시 붙인다.
    for (const element of registry.getAll()) {
        const target = element.labelTarget;
        const entry = target && planned.get(target.id);
        if (!entry) continue;
        const width = Number.isFinite(element.width) ? element.width : 0;
        const height = Number.isFinite(element.height) ? element.height : 0;
        let x;
        let y;
        if (entry.waypoints) {
            const mid = segmentMidpoint(entry.waypoints);
            x = mid.x - width / 2;
            y = mid.y - height - LABEL_GAP;
        } else {
            x = entry.bounds.x + entry.bounds.width / 2 - width / 2;
            y = entry.bounds.y + entry.bounds.height + LABEL_GAP;
        }
        after.push({ element, bounds: { x, y, width, height } });
    }
    return { ...result, entries: after };
}

/**
 * 신규 로직으로 자동 정렬을 적용한다.
 * @returns {Promise<{applied:number, warnings:string[]}>}
 */
export async function applyColumnRowLayout(modeler, { onLoadStart = noop, onLoadEnd = noop } = {}) {
    onLoadStart();
    try {
        const plan = await planColumnRowLayout(modeler);
        if (!plan.entries.length) throw new Error('배치할 요소가 없습니다.');
        applyGeometryEntries(modeler, plan.entries, { horizontal: true });
        if (typeof window !== 'undefined') window.isHorizontalLayout = true;
        modeler.get('eventBus').fire('autoLayout.complete', { engine: 'column-row', result: plan });
        if (plan.warnings.length) console.warn('[column-row-layout]', plan.warnings);
        return { applied: plan.entries.length, warnings: plan.warnings };
    } finally {
        onLoadEnd();
    }
}
