/**
 * SubProcess 전용 자동 레이아웃 패스 (구 BpmnAutoLayoutV2 의 코어 흡수본).
 *
 * 한 SubProcess 내부 노드만 별도 그래프로 묶어 EnhancedSugiyamaLayout 으로 정렬한 뒤,
 * SubProcess 컨테이너를 자식 bounding box 에 맞춰 리사이즈하고
 * \"원래 중심\"을 유지하도록 위치를 복원한다.
 *
 * 그래프 알고리즘 / Sugiyama 는 다른 IIFE 모듈이 window 에 등록한 것을 사용한다
 * (`window.GraphAlgorithm`, `window.EnhancedSugiyamaLayout`).
 */

import { nowMs, pushLayoutTiming } from './timing.js';
import {
  computeFinalSequenceFlowWaypoints,
  markSequenceFlowRoutingComplete,
  dockingPointOnShapeBoundary,
} from '../sequence-flow-final-layouter.js';

const globalRef = typeof window !== 'undefined' ? window : globalThis;

/** v1 코어의 nested 정의와 동일한 유효 노드 타입 집합 (모듈 스코프 사본) */
export const SP_VALID_NODE_TYPES = [
  'bpmn:Task', 'bpmn:UserTask', 'bpmn:ServiceTask', 'bpmn:ScriptTask', 'bpmn:BusinessRuleTask',
  'bpmn:SendTask', 'bpmn:ReceiveTask', 'bpmn:ManualTask',
  'bpmn:StartEvent', 'bpmn:EndEvent', 'bpmn:IntermediateThrowEvent', 'bpmn:IntermediateCatchEvent',
  'bpmn:ExclusiveGateway', 'bpmn:ParallelGateway', 'bpmn:InclusiveGateway', 'bpmn:EventBasedGateway',
  'bpmn:SubProcess', 'bpmn:CallActivity',
];

export function spGetTypeLabel(elementType) {
  const typeMap = {
    'bpmn:Task': '작업',
    'bpmn:UserTask': '사용자 작업',
    'bpmn:ServiceTask': '서비스 작업',
    'bpmn:SendTask': '전송 작업',
    'bpmn:ReceiveTask': '수신 작업',
    'bpmn:ManualTask': '수동 작업',
    'bpmn:BusinessRuleTask': '업무 규칙 작업',
    'bpmn:ScriptTask': '스크립트 작업',
    'bpmn:StartEvent': '시작 이벤트',
    'bpmn:EndEvent': '종료 이벤트',
    'bpmn:IntermediateThrowEvent': '중간 이벤트(발생)',
    'bpmn:IntermediateCatchEvent': '중간 이벤트(수신)',
    'bpmn:ExclusiveGateway': '배타 게이트웨이',
    'bpmn:ParallelGateway': '병렬 게이트웨이',
    'bpmn:InclusiveGateway': '포괄 게이트웨이',
    'bpmn:EventBasedGateway': '이벤트 기반 게이트웨이',
    'bpmn:SubProcess': '서브프로세스',
    'bpmn:Participant': '참여자',
    'bpmn:Lane': '레인',
    'bpmn:TextAnnotation': '텍스트 주석',
    'bpmn:DataObjectReference': '데이터 객체',
    'bpmn:DataStoreReference': '데이터 저장소',
  };
  return typeMap[elementType] || elementType.replace('bpmn:', '');
}

export function spGetNearestSubProcessId(el) {
  let p = el && el.parent;
  while (p) {
    if (p.businessObject && p.businessObject.$type === 'bpmn:SubProcess') {
      return p.id;
    }
    p = p.parent;
  }
  return null;
}

export function spIsElementInLane(element, lane) {
  if (!element || !lane) return false;
  if (typeof element.x !== 'number' || typeof element.y !== 'number' ||
      typeof element.width !== 'number' || typeof element.height !== 'number') {
    return false;
  }
  if (typeof lane.x !== 'number' || typeof lane.y !== 'number' ||
      typeof lane.width !== 'number' || typeof lane.height !== 'number') {
    return false;
  }
  const elementMidX = element.x + element.width / 2;
  const elementMidY = element.y + element.height / 2;
  return (
    elementMidX >= lane.x &&
    elementMidX <= lane.x + lane.width &&
    elementMidY >= lane.y &&
    elementMidY <= lane.y + lane.height
  );
}

export function spFindAncestorByType(element, type) {
  let current = element && element.parent;
  while (current) {
    if (current.type === type) {
      return current;
    }
    current = current.parent;
  }
  return null;
}

export function spGetLaneSortValue(lane, horizontal) {
  return horizontal ? (lane.y || 0) : (lane.x || 0);
}

export function spGetScopedLaneElements(allElements, subProcessElement, horizontal) {
  const participant = spFindAncestorByType(subProcessElement, 'bpmn:Participant');
  return allElements
    .filter((el) =>
      el &&
      el.businessObject &&
      el.businessObject.$type === 'bpmn:Lane' &&
      (!participant || (el.parent && el.parent.id === participant.id))
    )
    .sort((a, b) => spGetLaneSortValue(a, horizontal) - spGetLaneSortValue(b, horizontal));
}

function spCompactWaypoints(points) {
  const out = [];
  points.forEach((point) => {
    if (!point || typeof point.x !== 'number' || typeof point.y !== 'number') return;
    const prev = out[out.length - 1];
    if (!prev || Math.abs(prev.x - point.x) > 0.5 || Math.abs(prev.y - point.y) > 0.5) {
      out.push(point);
    }
  });
  return out;
}

export function spRouteInternalFeedback(flow, subProcessElement, internalNodes = []) {
  if (!flow || !flow.source || !flow.target || !subProcessElement) return null;
  const sourceType = flow.source.businessObject && flow.source.businessObject.$type;
  const targetType = flow.target.businessObject && flow.target.businessObject.$type;
  if (!sourceType || !targetType || !sourceType.includes('Gateway') || !targetType.includes('Gateway')) {
    return null;
  }

  const sourceCenter = {
    x: flow.source.x + (flow.source.width || 0) / 2,
    y: flow.source.y + (flow.source.height || 0) / 2,
  };
  const targetCenter = {
    x: flow.target.x + (flow.target.width || 0) / 2,
    y: flow.target.y + (flow.target.height || 0) / 2,
  };
  const obstacles = internalNodes.filter((node) =>
    node &&
    node !== flow.source &&
    node !== flow.target &&
    typeof node.x === 'number' &&
    typeof node.y === 'number' &&
    typeof node.width === 'number' &&
    typeof node.height === 'number'
  );
  const allNodes = [flow.source, flow.target, ...obstacles];
  const clearance = 28;

  if (targetCenter.x < sourceCenter.x) {
    const topY = Math.min(...allNodes.map((node) => node.y)) - clearance;
    const bottomY = Math.max(...allNodes.map((node) => node.y + node.height)) + clearance;
    const topSourceDock = dockingPointOnShapeBoundary(flow.source, 't', 0);
    const topTargetDock = dockingPointOnShapeBoundary(flow.target, 't', 0);
    const bottomSourceDock = dockingPointOnShapeBoundary(flow.source, 'b', 0);
    const bottomTargetDock = dockingPointOnShapeBoundary(flow.target, 'b', 0);
    const topCost = Math.abs(topSourceDock.y - topY) + Math.abs(topTargetDock.y - topY);
    const bottomCost = Math.abs(bottomSourceDock.y - bottomY) + Math.abs(bottomTargetDock.y - bottomY);
    const useTop = topCost <= bottomCost;
    const sourceDock = useTop ? topSourceDock : bottomSourceDock;
    const targetDock = useTop ? topTargetDock : bottomTargetDock;
    const corridorY = useTop ? topY : bottomY;
    return spCompactWaypoints([
      sourceDock,
      { x: sourceDock.x, y: corridorY },
      { x: targetDock.x, y: corridorY },
      targetDock,
    ]);
  }

  if (targetCenter.y < sourceCenter.y) {
    const leftX = Math.min(...allNodes.map((node) => node.x)) - clearance;
    const rightX = Math.max(...allNodes.map((node) => node.x + node.width)) + clearance;
    const leftSourceDock = dockingPointOnShapeBoundary(flow.source, 'l', 0);
    const leftTargetDock = dockingPointOnShapeBoundary(flow.target, 'l', 0);
    const rightSourceDock = dockingPointOnShapeBoundary(flow.source, 'r', 0);
    const rightTargetDock = dockingPointOnShapeBoundary(flow.target, 'r', 0);
    const leftCost = Math.abs(leftSourceDock.x - leftX) + Math.abs(leftTargetDock.x - leftX);
    const rightCost = Math.abs(rightSourceDock.x - rightX) + Math.abs(rightTargetDock.x - rightX);
    const useLeft = leftCost <= rightCost;
    const sourceDock = useLeft ? leftSourceDock : rightSourceDock;
    const targetDock = useLeft ? leftTargetDock : rightTargetDock;
    const corridorX = useLeft ? leftX : rightX;
    return spCompactWaypoints([
      sourceDock,
      { x: corridorX, y: sourceDock.y },
      { x: corridorX, y: targetDock.y },
      targetDock,
    ]);
  }

  return null;
}
export function resizeSubProcessToContents(bpmnModeler, subProcessElement, includeWaypoints = true) {
  const elementRegistry = bpmnModeler.get('elementRegistry');
  const modeling = bpmnModeler.get('modeling');
  const all = elementRegistry.getAll();
  const internalNodes = all.filter((el) =>
    el.businessObject &&
    !el.labelTarget &&
    SP_VALID_NODE_TYPES.includes(el.businessObject.$type) &&
    spGetNearestSubProcessId(el) === subProcessElement.id
  );
  if (!internalNodes.length) return false;

  const originalCenter = {
    x: subProcessElement.x + subProcessElement.width / 2,
    y: subProcessElement.y + subProcessElement.height / 2,
  };
  const internalNodeIds = new Set(internalNodes.map((el) => el.id));
  const internalFlows = all.filter((el) =>
    el.businessObject?.$type === 'bpmn:SequenceFlow' &&
    el.source &&
    el.target &&
    internalNodeIds.has(el.source.id) &&
    internalNodeIds.has(el.target.id)
  );
  const points = [];
  internalNodes.forEach((el) => {
    if (![el.x, el.y, el.width, el.height].every(Number.isFinite)) return;
    points.push({ x: el.x, y: el.y }, { x: el.x + el.width, y: el.y + el.height });
  });
  (includeWaypoints ? internalFlows : []).forEach((flow) => {
    (flow.waypoints || []).forEach((point) => {
      if (point && Number.isFinite(point.x) && Number.isFinite(point.y)) points.push(point);
    });
  });
  if (!points.length) return false;

  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));
  const marginX = 18;
  const marginY = 12;
  const bounds = {
    x: minX - marginX,
    y: minY - marginY,
    width: (maxX - minX) + marginX * 2,
    height: (maxY - minY) + marginY * 2,
  };

  try {
    modeling.resizeShape(subProcessElement, bounds);
    const nextCenter = {
      x: subProcessElement.x + subProcessElement.width / 2,
      y: subProcessElement.y + subProcessElement.height / 2,
    };
    const dx = originalCenter.x - nextCenter.x;
    const dy = originalCenter.y - nextCenter.y;
    if (Math.abs(dx) >= 1 || Math.abs(dy) >= 1) {
      modeling.moveShape(subProcessElement, { x: dx, y: dy });
    }
    return true;
  } catch (err) {
    console.warn(`[BPMN-Layout-SP] SubProcess ${subProcessElement.id} 리사이즈 중 오류:`, err);
    return false;
  }
}
/** 한 SubProcess 내부만 독립적으로 레이아웃 후 컨테이너 리사이즈 */
export function layoutSingleSubProcess(bpmnModeler, subProcessElement, options) {
  const timingStartMs = nowMs();
  const { horizontal = false } = options || {};
  const elementRegistry = bpmnModeler.get('elementRegistry');
  const modeling = bpmnModeler.get('modeling');
  const { Graph } = globalRef.GraphAlgorithm || {};
  const EnhancedSugiyamaLayout = globalRef.EnhancedSugiyamaLayout;

  if (!Graph || !EnhancedSugiyamaLayout) {
    console.warn('[BPMN-Layout] GraphAlgorithm 또는 EnhancedSugiyamaLayout 이 없습니다.');
    return;
  }

  const all = elementRegistry.getAll();


  const internalNodes = all.filter((el) => {
    if (!el.businessObject || el.labelTarget) return false;
    if (!SP_VALID_NODE_TYPES.includes(el.businessObject.$type)) return false;
    const nearest = spGetNearestSubProcessId(el);
    return nearest === subProcessElement.id;
  });

  if (!internalNodes.length) return;

  const internalNodeIdSet = new Set(internalNodes.map((el) => el.id));

  const internalFlows = all.filter((el) => {
    const bo = el.businessObject;
    if (!bo || bo.$type !== 'bpmn:SequenceFlow') return false;
    if (!el.source || !el.target) return false;
    return internalNodeIdSet.has(el.source.id) && internalNodeIdSet.has(el.target.id);
  });

  const graph = new Graph();
  const nodeMap = {};

  internalNodes.forEach((element) => {
    const bo = element.businessObject;
    const id = element.id;
    const type = spGetTypeLabel(bo.$type);
    const label = bo.name || type;

    graph.addNode(id, label);
    const node = graph.getNode(id);

    let nodeWidth = element.width || 100;
    let nodeHeight = element.height || 80;
    if (horizontal) {
      const tmp = nodeWidth;
      nodeWidth = nodeHeight;
      nodeHeight = tmp;
    }

    node.width = nodeWidth;
    node.height = nodeHeight;
    node.nodeType = bo.$type;

    nodeMap[id] = element;
  });

  const lanes = spGetScopedLaneElements(all, subProcessElement, horizontal);
  const spTop = horizontal ? subProcessElement.y : subProcessElement.x;
  const spBottom = spTop + (horizontal ? subProcessElement.height : subProcessElement.width);

  const overlappedLanes = lanes.filter((lane) => {
    if (typeof lane.y !== 'number' || typeof lane.height !== 'number') return false;
    const top = horizontal ? lane.y : lane.x;
    const bottom = top + (horizontal ? lane.height : lane.width);
    return bottom > spTop && top < spBottom;
  });

  if (subProcessElement.businessObject) {
    subProcessElement.businessObject.__v2OverlappedLaneIds =
      overlappedLanes.map((lane) => lane.id);
  }

  const assignedNodeIds = new Set();
  const laneIdByInternalNodeId = new Map();
  overlappedLanes.forEach((lane) => {
    const laneNodeIds = internalNodes
      .filter((node) => spIsElementInLane(node, lane))
      .map((node) => node.id);
    if (laneNodeIds.length) {
      graph.createGroup(lane.id, laneNodeIds);
      laneNodeIds.forEach((id) => {
        assignedNodeIds.add(id);
        if (!laneIdByInternalNodeId.has(id)) {
          laneIdByInternalNodeId.set(id, lane.id);
        }
      });
    }
  });

  const unassignedIds = internalNodes
    .map((n) => n.id)
    .filter((id) => !assignedNodeIds.has(id));

  if (unassignedIds.length) {
    graph.createGroup(subProcessElement.id, unassignedIds);
  }

  internalFlows.forEach((flow) => {
    if (!nodeMap[flow.source.id] || !nodeMap[flow.target.id]) return;
    graph.addEdge(flow.source.id, flow.target.id, flow.id);
  });

  const layoutOptions = (options || {}).layoutOptions || {};
  const layout = new EnhancedSugiyamaLayout(graph, horizontal, layoutOptions);
  layout.run();

  const lanePadding = Math.max(12, layoutOptions.lanePadding ?? layoutOptions.nodeMargin ?? 12);
  const laneById = new Map(overlappedLanes.map((lane) => [lane.id, lane]));
  const nodesByLaneId = new Map();
  graph.nodes.forEach((node) => {
    const laneId = laneIdByInternalNodeId.get(node.id);
    if (!laneId) return;
    if (!nodesByLaneId.has(laneId)) {
      nodesByLaneId.set(laneId, []);
    }
    nodesByLaneId.get(laneId).push(node);
  });

  nodesByLaneId.forEach((nodes, laneId) => {
    const lane = laneById.get(laneId);
    if (!lane || !nodes.length) return;

    const axis = horizontal ? 'y' : 'x';
    const group = graph.getGroup(laneId);
    const laneStart = group.minX + lanePadding;
    const laneEnd = group.maxX - lanePadding;
    if (!isFinite(laneStart) || !isFinite(laneEnd) || laneEnd <= laneStart) return;

    let min = Infinity;
    let max = -Infinity;
    nodes.forEach((node) => {
      const element = nodeMap[node.id];
      if (!element) return;
      const size = horizontal ? (element.height || 80) : (element.width || 100);
      min = Math.min(min, node[axis] - size / 2);
      max = Math.max(max, node[axis] + size / 2);
    });
    if (!isFinite(min) || !isFinite(max)) return;

    const delta = ((laneStart + laneEnd) / 2) - ((min + max) / 2);
    nodes.forEach((node) => {
      const element = nodeMap[node.id];
      if (!element) return;
      const size = horizontal ? (element.height || 80) : (element.width || 100);
      const half = size / 2;
      const minCenter = laneStart + half;
      const maxCenter = laneEnd - half;
      const shifted = node[axis] + delta;
      node[axis] = minCenter <= maxCenter
        ? Math.max(minCenter, Math.min(maxCenter, shifted))
        : (laneStart + laneEnd) / 2;
    });
  });

  const flowsForWaypoints = internalFlows;

  const COORD_DEBUG_MOVE = typeof window !== 'undefined' && window.__BPMN_LAYOUT_COORD_DEBUG__;
  graph.nodes.forEach((node) => {
    const element = nodeMap[node.id];
    if (!element) return;

    const width = element.width || 100;
    const height = element.height || 80;
    const newX = node.x - width / 2;
    const newY = node.y - height / 2;
    const dx = newX - element.x;
    const dy = newY - element.y;

    if (COORD_DEBUG_MOVE && (Math.abs(dx) >= 1 || Math.abs(dy) >= 1)) {
      const bo = element.businessObject;
      const lbl = (bo && bo.name) ? bo.name.substring(0, 12) : element.id;
      console.log('[BPMN-Layout-SP] MOVE', element.id, lbl,
        '| (', element.x?.toFixed(0), ',', element.y?.toFixed(0), ') → (', newX?.toFixed(0), ',', newY?.toFixed(0), ')',
        '| Δ(', dx?.toFixed(0), ',', dy?.toFixed(0), ')');
    }

    if (!isFinite(dx) || !isFinite(dy) || (Math.abs(dx) < 1 && Math.abs(dy) < 1)) return;

    try {
      modeling.moveShape(element, { x: dx, y: dy });
    } catch (err) {
      console.warn(`[BPMN-Layout-SP] SubProcess 내부 요소 ${element.id} 이동 중 오류:`, err);
    }
  });

  const LAYOUT_DEBUG = typeof window !== 'undefined' && window.__BPMN_LAYOUT_DEBUG__;
  resizeSubProcessToContents(bpmnModeler, subProcessElement, false);
  if (options.includeWaypoints) {
    const refreshStartMs = nowMs();
    if (globalRef.BpmnWaypointsRefresh && typeof globalRef.BpmnWaypointsRefresh.refreshFlows === 'function') {
      globalRef.BpmnWaypointsRefresh.refreshFlows(flowsForWaypoints, modeling, all, { debug: LAYOUT_DEBUG, horizontal });
    } else {
      flowsForWaypoints.forEach((flow) => {
        try {
          modeling.layoutConnection(flow);
        } catch (err) {
          console.warn('[BPMN-Layout-SP] layoutConnection 실패:', flow.id, err);
        }
      });
    }
    pushLayoutTiming('subProcessWaypoints', refreshStartMs, {
      subProcessId: subProcessElement.id,
      flowCount: flowsForWaypoints.length,
      includeWaypoints: true,
    });

    internalFlows
      .forEach((flow) => {
        try {
          const feedbackWaypoints = spRouteInternalFeedback(flow, subProcessElement, internalNodes);
          const nextWaypoints = feedbackWaypoints || computeFinalSequenceFlowWaypoints(
            flow,
            (flow.waypoints || []).map((p) => ({ x: p.x, y: p.y })),
            elementRegistry,
            {
              horizontalLayout: horizontal,
              snapFacingEndpoints: true,
              rerouteObstacles: true,
            }
          );
          if (Array.isArray(nextWaypoints) && nextWaypoints.length >= 2) {
            modeling.updateWaypoints(flow, nextWaypoints);
            markSequenceFlowRoutingComplete(flow, elementRegistry);
          }
        } catch (err) {
          console.warn('[BPMN-Layout-SP] feedback waypoints 정리 실패:', flow.id, err);
        }
      });
  }

  resizeSubProcessToContents(bpmnModeler, subProcessElement);
  pushLayoutTiming('layoutSingleSubProcess', timingStartMs, {
    subProcessId: subProcessElement.id,
    includeWaypoints: options.includeWaypoints !== false,
  });
}
