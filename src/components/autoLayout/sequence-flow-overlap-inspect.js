/**
 * 시퀀스 플로우–장애물(FlowNode) 겹침 **검사만** (웨이포인트 변경 없음).
 * - 표시용 bbox clearance는 reroute(12px)보다 좁게 유지.
 * - 소스·타깃도 “장애물” 후보에 넣되, 첫/마지막 세그먼트만 도킹으로 간주해 제외(과표시 방지).
 * - diagram-js segmentIntersectsRect 는 경계 점을 내부로 안 쳐서, 겹침 전용으로 경계 포함·세밀 샘플 보강.
 */
import { getBBox } from 'diagram-js/lib/util/Elements';
import { is } from 'bpmn-js/lib/util/ModelUtil';

import {
    collectSequenceFlowObstacleElements,
    obstacleRectForSegmentHitTest,
    SEQUENCE_FLOW_OBSTACLE_HIT_CLEARANCE_PX,
    segmentIntersectsRect
} from './sequence-flow-final-layouter.js';

/**
 * 겹침 검사·하이라이트 전용 clearance(px). reroute 의 12px보다 작게 해 과민 반응을 줄인다.
 * (SEQUENCE_FLOW_OBSTACLE_HIT_CLEARANCE_PX 와 동일한 수준)
 */
var OVERLAP_INSPECT_CLEARANCE_PX = SEQUENCE_FLOW_OBSTACLE_HIT_CLEARANCE_PX;

var lastOverlayIds = [];

/**
 * diagram-js pointInRect 는 경계를 제외(strict)해서, 도킹·직교 꼭짓점이 박스 위에 있으면
 * "내부 통과"로 안 잡힌다. 겹침 표시용으로 경계 포함 + 샘플 보강.
 */
function segmentIntersectsRectOverlapInspect(ax, ay, bx, by, rect) {
    var eps = 1e-5;
    function pin(x, y) {
        return x >= rect.x - eps && y >= rect.y - eps && x <= rect.x + rect.width + eps && y <= rect.y + rect.height + eps;
    }
    if (pin(ax, ay) || pin(bx, by)) {
        return true;
    }
    if (segmentIntersectsRect(ax, ay, bx, by, rect)) {
        return true;
    }
    var mx = (ax + bx) / 2;
    var my = (ay + by) / 2;
    if (pin(mx, my)) {
        return true;
    }
    for (var s = 1; s < 32; s++) {
        var t = s / 32;
        var px = ax + (bx - ax) * t;
        var py = ay + (by - ay) * t;
        if (pin(px, py)) {
            return true;
        }
    }
    return false;
}

/** reroute용 장애물 + 소스·타깃(연결선 자체는 제외). 소스/타깃은 도킹 구간만 검사에서 제외 */
function collectOverlapInspectObstacleElements(flow, elementRegistry) {
    var base = collectSequenceFlowObstacleElements(flow, elementRegistry);
    var src = flow.source;
    var tgt = flow.target;
    var seen = {};
    base.forEach(function (o) {
        seen[o.id] = true;
    });
    var out = base.slice();
    if (src && src.businessObject && is(src, 'bpmn:FlowNode') && !seen[src.id]) {
        seen[src.id] = true;
        out.push(src);
    }
    if (tgt && tgt.businessObject && is(tgt, 'bpmn:FlowNode') && !seen[tgt.id]) {
        seen[tgt.id] = true;
        out.push(tgt);
    }
    return out;
}

/** 첫 세그먼트는 소스 경계에서 나가는 구간, 마지막은 타깃으로 들어가는 구간으로 보고 제외 */
function shouldCheckSegmentAgainstObstacle(flow, segmentIndex, obstacle) {
    var wps = flow.waypoints;
    if (!Array.isArray(wps) || wps.length < 2) {
        return false;
    }
    var lastSeg = wps.length - 2;
    var src = flow.source;
    var tgt = flow.target;
    if (obstacle === src && segmentIndex === 0) {
        return false;
    }
    if (obstacle === tgt && segmentIndex === lastSeg) {
        return false;
    }
    return true;
}

function getWaypointCoords(p) {
    if (!p) {
        return { x: NaN, y: NaN };
    }
    return {
        x: p.x !== undefined ? p.x : p.original && p.original.x,
        y: p.y !== undefined ? p.y : p.original && p.original.y
    };
}

/**
 * @param {*} modeler
 * @returns {{ flow: import('diagram-js/lib/core/Types').ConnectionLike; obstacle: import('diagram-js/lib/core/Types').ShapeLike }[]}
 */
export function collectSequenceFlowOverlapPairs(modeler) {
    if (!modeler) {
        return [];
    }
    var elementRegistry = modeler.get('elementRegistry');
    if (!elementRegistry) {
        return [];
    }

    var flows = elementRegistry.getAll().filter(function (el) {
        var bo = el.businessObject;
        return bo && bo.$type === 'bpmn:SequenceFlow' && el.source && el.target;
    });

    var pairs = [];
    var seen = {};
    var c = OVERLAP_INSPECT_CLEARANCE_PX;

    flows.forEach(function (flow) {
        var wps = flow.waypoints;
        if (!Array.isArray(wps) || wps.length < 2) {
            return;
        }
        var obstacles = collectOverlapInspectObstacleElements(flow, elementRegistry);
        for (var i = 0; i < wps.length - 1; i++) {
            var a = getWaypointCoords(wps[i]);
            var b = getWaypointCoords(wps[i + 1]);
            if (typeof a.x !== 'number' || typeof a.y !== 'number' || typeof b.x !== 'number' || typeof b.y !== 'number') {
                continue;
            }
            for (var oi = 0; oi < obstacles.length; oi++) {
                var obs = obstacles[oi];
                if (!shouldCheckSegmentAgainstObstacle(flow, i, obs)) {
                    continue;
                }
                var rect = obstacleRectForSegmentHitTest(obs, c);
                if (!rect || rect.width <= 0 || rect.height <= 0) {
                    continue;
                }
                if (segmentIntersectsRectOverlapInspect(a.x, a.y, b.x, b.y, rect)) {
                    var key = flow.id + '::' + obs.id;
                    if (!seen[key]) {
                        seen[key] = true;
                        pairs.push({ flow: flow, obstacle: obs });
                    }
                }
            }
        }
    });

    return pairs;
}

function randomOverlapColor() {
    var h = Math.floor(Math.random() * 360);
    var s = 62 + Math.floor(Math.random() * 28);
    var l = 40 + Math.floor(Math.random() * 14);
    return 'hsl(' + h + ', ' + s + '%, ' + l + '%)';
}

function buildFlowSegmentOverlaySvg(flow, obstacle, color) {
    var wps = flow.waypoints;
    if (!Array.isArray(wps) || wps.length < 2) {
        return null;
    }
    var c = OVERLAP_INSPECT_CLEARANCE_PX;
    var rect = obstacleRectForSegmentHitTest(obstacle, c);
    var segs = [];
    for (var i = 0; i < wps.length - 1; i++) {
        if (!shouldCheckSegmentAgainstObstacle(flow, i, obstacle)) {
            continue;
        }
        var a = getWaypointCoords(wps[i]);
        var b = getWaypointCoords(wps[i + 1]);
        if (typeof a.x !== 'number' || typeof a.y !== 'number' || typeof b.x !== 'number' || typeof b.y !== 'number') {
            continue;
        }
        if (segmentIntersectsRectOverlapInspect(a.x, a.y, b.x, b.y, rect)) {
            segs.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y });
        }
    }
    if (!segs.length) {
        return null;
    }

    var bbox = getBBox(flow);
    var parts = [];
    for (var s = 0; s < segs.length; s++) {
        var g = segs[s];
        var x1 = g.ax - bbox.x;
        var y1 = g.ay - bbox.y;
        var x2 = g.bx - bbox.x;
        var y2 = g.by - bbox.y;
        parts.push('M ' + x1 + ' ' + y1 + ' L ' + x2 + ' ' + y2);
    }

    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', String(bbox.width));
    svg.setAttribute('height', String(bbox.height));
    svg.style.position = 'absolute';
    svg.style.left = '0';
    svg.style.top = '0';
    svg.style.pointerEvents = 'none';
    svg.style.overflow = 'visible';

    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', parts.join(' '));
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', '5');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    path.setAttribute('opacity', '0.95');
    svg.appendChild(path);
    return svg;
}

function buildObstacleBorderOverlay(obstacle, color, ringIndex) {
    var w = obstacle.width;
    var h = obstacle.height;
    if (typeof w !== 'number' || typeof h !== 'number') {
        return null;
    }
    var pad = ringIndex * 3;
    var div = document.createElement('div');
    div.style.cssText =
        'position:absolute;box-sizing:border-box;pointer-events:none;border:3px solid ' +
        color +
        ';border-radius:4px;left:' +
        -pad +
        'px;top:' +
        -pad +
        'px;width:' +
        (w + pad * 2) +
        'px;height:' +
        (h + pad * 2) +
        'px;';
    return div;
}

/**
 * 이전 겹침 표시 제거 (오버레이만).
 * @param {*} modeler
 */
export function clearSequenceFlowOverlapInspect(modeler) {
    if (!modeler) {
        lastOverlayIds = [];
        return;
    }
    var overlays = modeler.get('overlays');
    if (!overlays) {
        lastOverlayIds = [];
        return;
    }
    lastOverlayIds.forEach(function (id) {
        try {
            overlays.remove(id);
        } catch (e) {
            /* ignore */
        }
    });
    lastOverlayIds = [];
}

/**
 * 겹침 (flow, obstacle) 쌍마다 동일 랜덤 색으로 연결 구간·장애물 테두리 표시.
 * @param {*} modeler
 * @returns {{ pairCount: number }}
 */
export function applySequenceFlowOverlapInspect(modeler) {
    clearSequenceFlowOverlapInspect(modeler);
    if (!modeler) {
        return { pairCount: 0 };
    }
    var overlays = modeler.get('overlays');
    if (!overlays) {
        return { pairCount: 0 };
    }

    var pairs = collectSequenceFlowOverlapPairs(modeler);
    var obstacleRing = {};

    pairs.forEach(function (pair) {
        var color = randomOverlapColor();
        var oid = pair.obstacle.id;
        var ring = obstacleRing[oid] || 0;
        obstacleRing[oid] = ring + 1;

        var flowSvg = buildFlowSegmentOverlaySvg(pair.flow, pair.obstacle, color);
        if (flowSvg) {
            var fid = overlays.add(pair.flow.id, {
                position: { left: 0, top: 0 },
                html: flowSvg
            });
            lastOverlayIds.push(fid);
        }

        var obsHtml = buildObstacleBorderOverlay(pair.obstacle, color, ring);
        if (obsHtml) {
            var oid2 = overlays.add(pair.obstacle.id, {
                position: { left: 0, top: 0 },
                html: obsHtml
            });
            lastOverlayIds.push(oid2);
        }
    });

    return { pairCount: pairs.length };
}

if (typeof window !== 'undefined') {
    window.clearSequenceFlowOverlapInspect = clearSequenceFlowOverlapInspect;
    window.applySequenceFlowOverlapInspect = applySequenceFlowOverlapInspect;
}
