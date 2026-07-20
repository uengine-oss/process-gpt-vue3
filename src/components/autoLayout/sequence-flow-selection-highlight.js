/**
 * 시퀀스 플로우 선택 시: 연결선 파랑, 소스 초록, 타깃 빨강 (diagram-js overlays)
 */
import { getBBox } from 'diagram-js/lib/util/Elements';
import { is } from 'bpmn-js/lib/util/ModelUtil';

var COLOR_FLOW = '#2563eb';
var COLOR_SOURCE = '#16a34a';
var COLOR_TARGET = '#dc2626';

var lastOverlayIds = [];

function getWaypointCoords(p) {
    if (!p) {
        return { x: NaN, y: NaN };
    }
    return {
        x: p.x !== undefined ? p.x : p.original && p.original.x,
        y: p.y !== undefined ? p.y : p.original && p.original.y
    };
}

function buildFullFlowPathSvg(flow) {
    var wps = flow.waypoints;
    if (!Array.isArray(wps) || wps.length < 2) {
        return null;
    }
    var bbox = getBBox(flow);
    if (!bbox || bbox.width <= 0 || bbox.height <= 0) {
        return null;
    }
    var parts = [];
    for (var i = 0; i < wps.length - 1; i++) {
        var a = getWaypointCoords(wps[i]);
        var b = getWaypointCoords(wps[i + 1]);
        if (typeof a.x !== 'number' || typeof a.y !== 'number' || typeof b.x !== 'number' || typeof b.y !== 'number') {
            continue;
        }
        var x1 = a.x - bbox.x;
        var y1 = a.y - bbox.y;
        var x2 = b.x - bbox.x;
        var y2 = b.y - bbox.y;
        parts.push('M ' + x1 + ' ' + y1 + ' L ' + x2 + ' ' + y2);
    }
    if (!parts.length) {
        return null;
    }

    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', String(bbox.width));
    svg.setAttribute('height', String(bbox.height));
    svg.style.position = 'absolute';
    svg.style.left = '0';
    svg.style.top = '0';
    svg.style.pointerEvents = 'none';
    svg.style.overflow = 'visible';
    svg.setAttribute('class', 'sequence-flow-selection-highlight-flow');

    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', parts.join(' '));
    path.setAttribute('stroke', COLOR_FLOW);
    path.setAttribute('stroke-width', '5');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    path.setAttribute('opacity', '0.95');
    svg.appendChild(path);
    return svg;
}

function buildShapeBorderOverlay(shape, color, ringIndex) {
    var w = shape.width;
    var h = shape.height;
    if (typeof w !== 'number' || typeof h !== 'number') {
        return null;
    }
    var ri = typeof ringIndex === 'number' ? ringIndex : 0;
    var pad = ri * 3;
    var div = document.createElement('div');
    div.className = 'sequence-flow-selection-highlight-node';
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
 * @param {*} modeler
 */
export function clearSequenceFlowSelectionHighlight(modeler) {
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
 * @param {*} modeler
 * @param {import('diagram-js/lib/core/Types').ConnectionLike[]} flows
 */
export function applySequenceFlowSelectionHighlight(modeler, flows) {
    clearSequenceFlowSelectionHighlight(modeler);
    if (!modeler || !Array.isArray(flows) || !flows.length) {
        return;
    }
    var overlays = modeler.get('overlays');
    if (!overlays) {
        return;
    }

    var seenSource = {};
    var seenTarget = {};
    var nodeRing = {};

    flows.forEach(function (flow) {
        if (!flow || !flow.source || !flow.target) {
            return;
        }
        var flowSvg = buildFullFlowPathSvg(flow);
        if (flowSvg) {
            lastOverlayIds.push(
                overlays.add(flow.id, {
                    position: { left: 0, top: 0 },
                    html: flowSvg
                })
            );
        }

        var src = flow.source;
        var tgt = flow.target;
        if (src && src.businessObject && is(src, 'bpmn:FlowNode') && !seenSource[src.id]) {
            seenSource[src.id] = true;
            var rS = nodeRing[src.id] || 0;
            nodeRing[src.id] = rS + 1;
            var srcHtml = buildShapeBorderOverlay(src, COLOR_SOURCE, rS);
            if (srcHtml) {
                lastOverlayIds.push(
                    overlays.add(src.id, {
                        position: { left: 0, top: 0 },
                        html: srcHtml
                    })
                );
            }
        }
        if (tgt && tgt.businessObject && is(tgt, 'bpmn:FlowNode') && !seenTarget[tgt.id]) {
            seenTarget[tgt.id] = true;
            var rT = nodeRing[tgt.id] || 0;
            nodeRing[tgt.id] = rT + 1;
            var tgtHtml = buildShapeBorderOverlay(tgt, COLOR_TARGET, rT);
            if (tgtHtml) {
                lastOverlayIds.push(
                    overlays.add(tgt.id, {
                        position: { left: 0, top: 0 },
                        html: tgtHtml
                    })
                );
            }
        }
    });
}
