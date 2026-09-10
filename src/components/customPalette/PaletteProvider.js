import { assign } from 'min-dash';
import { i18n } from '@/main';
import '@/components/autoLayout/graph-algorithm.js';
import '@/components/autoLayout/enhancedSugiyamaLayout.js';
import '@/components/autoLayout/bpmn-auto-layout.js';
import '@/components/autoLayout/edge-router-orthogonal.js';
import '@/components/autoLayout/bpmn-waypoints-refresh.js';
import {
  computeFinalSequenceFlowWaypoints,
  collectSequenceFlowObstacleElements,
  enforceFinalSourceExitClearance,
  enforceFinalTargetApproachClearance,
  waypointsIntersectFlowObstacles,
} from '@/components/autoLayout/sequence-flow-final-layouter.js';

export default function PaletteProvider(palette,
   create, 
   elementFactory, 
   spaceTool, 
   lassoTool, 
   handTool, 
   globalConnect, 
   translate, 
   commandStack, 
   eventBus,
   modeling,
   injector,
   viewModeFlag) {

  this._create = create;
  this._elementFactory = elementFactory;
  this._spaceTool = spaceTool;
  this._lassoTool = lassoTool;
  this._handTool = handTool;
  this._globalConnect = globalConnect;
  this._translate = translate;
  this._commandStack = commandStack;
  this._isMac = (/mac/i).test(navigator.platform);
  this._eventBus = eventBus;
  this._modeling = modeling;
  this._injector = injector;
  this._isViewMode = viewModeFlag ?? false; 
  palette.registerProvider(this);
}

PaletteProvider.$inject = [
  'palette',
  'create',
  'elementFactory',
  'spaceTool',
  'lassoTool',
  'handTool',
  'globalConnect',
  'translate',
  'commandStack',
  'eventBus',
  'modeling',
  'injector',
  'viewModeFlag'
];

function clearSelectionVisualState(bpmnJS) {
  if (!bpmnJS || typeof bpmnJS.get !== 'function') {
    return;
  }

  const selection = bpmnJS.get('selection');
  if (selection && typeof selection.select === 'function') {
    selection.select(null);
  }
}

// ?뚯쟾/?ㅼ???愿???곸닔
const ROTATION_SCALE_FIX = 1 / 0.96;      // 媛濡쒋넂?몃줈 ?꾪솚 ???덉씠?꾩썐 源⑥쭚 蹂댁젙???ㅼ???
const LANE_WIDTH_SCALE = 0.8;             // lane ???ㅼ???
const LANE_HEIGHT_SCALE = 1.2;            // lane ?믪씠 ?ㅼ???
const PARTICIPANT_LABEL_HEADER_SIZE = 30;
const LANE_LABEL_HEADER_SIZE = 30;
const LANE_BODY_PADDING = 36;
// BoundaryEvent(Attacher) ?뚯쟾 諛⑺뼢 ?곸닔
const ATTACHER_ROTATION = {
  horizontalToVertical: 'clockwise',
  verticalToHorizontal: 'counter-clockwise'
};

function rerouteRotatedSequenceFlows(modeling, elementRegistry, rotationElements, horizontal) {
  elementRegistry.getAll()
    .filter(element =>
      element &&
      (element.type === 'bpmn:SequenceFlow' || element.type === 'bpmn:MessageFlow')
    )
    .forEach(flow => {
      const waypoints = (flow.waypoints || []).map(point => ({ x: point.x, y: point.y }));
      const routeSeed = waypoints.length >= 2
        ? [ waypoints[0], waypoints[waypoints.length - 1] ]
        : waypoints;
      const rerouted = computeFinalSequenceFlowWaypoints(flow, routeSeed, elementRegistry, {
        horizontalLayout: horizontal,
        snapFacingEndpoints: true,
        rerouteObstacles: true,
      });
      if (Array.isArray(rerouted) && rerouted.length >= 2) {
        const withTargetClearance = enforceFinalTargetApproachClearance(rerouted, flow.target);
        const withEndpointClearance = enforceFinalSourceExitClearance(withTargetClearance, flow.source);
        modeling.updateWaypoints(flow, withEndpointClearance);
        const finalPoints = (flow.waypoints || []).map(point => ({ x: point.x, y: point.y }));
        const repaired = repairRotatedConnection(flow, finalPoints, elementRegistry, horizontal);
        if (repaired !== finalPoints) {
          modeling.updateWaypoints(flow, repaired);
        }
      }
    });
}
function repairRotatedConnection(flow, points, elementRegistry, horizontal) {
  if (!flow?.source || !flow?.target || !Array.isArray(points) || points.length < 2) return points;
  const obstacles = collectSequenceFlowObstacleElements(flow, elementRegistry)
    .filter(element => !element.labelTarget);
  const isOrthogonal = points.every((point, index) => {
    if (!index) return true;
    const previous = points[index - 1];
    return Math.abs(point.x - previous.x) < 0.5 || Math.abs(point.y - previous.y) < 0.5;
  });
  const legLength = (left, right) => Math.abs(left.x - right.x) + Math.abs(left.y - right.y);
  const needsRepair = !isOrthogonal || points.length > 10 ||
    legLength(points[0], points[1]) < 12 ||
    legLength(points.at(-2), points.at(-1)) < 12 ||
    waypointsIntersectFlowObstacles(points, obstacles, 8);
  if (!needsRepair) return points;

  const sides = [ 'l', 'r', 't', 'b' ];
  const sidePoint = (shape, side) => {
    const cx = shape.x + shape.width / 2;
    const cy = shape.y + shape.height / 2;
    if (side === 'l') return { x: shape.x, y: cy };
    if (side === 'r') return { x: shape.x + shape.width, y: cy };
    if (side === 't') return { x: cx, y: shape.y };
    return { x: cx, y: shape.y + shape.height };
  };
  const offsetPoint = (point, side) => ({
    x: point.x + (side === 'l' ? -14 : side === 'r' ? 14 : 0),
    y: point.y + (side === 't' ? -14 : side === 'b' ? 14 : 0)
  });
  const compact = candidate => candidate.filter((point, index, all) => {
    if (index === 0 || index === all.length - 1) return true;
    const previous = all[index - 1];
    const next = all[index + 1];
    return !(
      (Math.abs(previous.x - point.x) < 0.5 && Math.abs(point.x - next.x) < 0.5) ||
      (Math.abs(previous.y - point.y) < 0.5 && Math.abs(point.y - next.y) < 0.5)
    );
  });
  const candidates = [];
  sides.forEach(sourceSide => sides.forEach(targetSide => {
    const sourceDock = sidePoint(flow.source, sourceSide);
    const targetDock = sidePoint(flow.target, targetSide);
    const sourceExit = offsetPoint(sourceDock, sourceSide);
    const targetApproach = offsetPoint(targetDock, targetSide);
    candidates.push(compact([
      sourceDock, sourceExit,
      { x: targetApproach.x, y: sourceExit.y },
      targetApproach, targetDock
    ]));
    candidates.push(compact([
      sourceDock, sourceExit,
      { x: sourceExit.x, y: targetApproach.y },
      targetApproach, targetDock
    ]));
  }));

  const sourceCenter = { x: flow.source.x + flow.source.width / 2, y: flow.source.y + flow.source.height / 2 };
  const targetCenter = { x: flow.target.x + flow.target.width / 2, y: flow.target.y + flow.target.height / 2 };
  const preferredSourceSide = horizontal
    ? (targetCenter.x >= sourceCenter.x ? 'r' : 'l')
    : (targetCenter.y >= sourceCenter.y ? 'b' : 't');
  const preferredTargetSide = horizontal
    ? (targetCenter.x >= sourceCenter.x ? 'l' : 'r')
    : (targetCenter.y >= sourceCenter.y ? 't' : 'b');
  const viable = candidates.filter(candidate => !waypointsIntersectFlowObstacles(candidate, obstacles, 8));
  if (!viable.length) return points;
  const score = candidate => {
    const length = candidate.slice(1).reduce((sum, point, index) => sum + legLength(point, candidate[index]), 0);
    const sourceSide = sides.find(side => {
      const dock = sidePoint(flow.source, side);
      return Math.abs(dock.x - candidate[0].x) < 0.5 && Math.abs(dock.y - candidate[0].y) < 0.5;
    });
    const targetSide = sides.find(side => {
      const dock = sidePoint(flow.target, side);
      const end = candidate.at(-1);
      return Math.abs(dock.x - end.x) < 0.5 && Math.abs(dock.y - end.y) < 0.5;
    });
    return length + (candidate.length - 2) * 40 +
      (sourceSide === preferredSourceSide ? 0 : 80) +
      (targetSide === preferredTargetSide ? 0 : 80);
  };
  return viable.sort((left, right) => score(left) - score(right))[0];
}
function getBounds(element) {
  return element && (element.di?.bounds || element);
}

function getCurrentBounds(element) {
  if (
    element &&
    typeof element.x === 'number' &&
    typeof element.y === 'number' &&
    typeof element.width === 'number' &&
    typeof element.height === 'number'
  ) {
    return element;
  }

  return getBounds(element);
}

function isParticipantRenderedHorizontal(element) {
  if (typeof element?.di?.isHorizontal === 'boolean') {
    return element.di.isHorizontal;
  }
  const bounds = getCurrentBounds(element);
  if (!bounds) return element?.di?.isHorizontal === true;
  return bounds.width >= bounds.height;
}

function isElementUnderParticipant(element, participant) {
  let current = element;
  while (current) {
    if (current.id === participant.id) return true;
    current = current.parent;
  }
  return false;
}

function isSequenceFlowUnderParticipant(sequenceFlow, participant) {
  return isElementUnderParticipant(sequenceFlow, participant) ||
    isElementUnderParticipant(sequenceFlow.source, participant) ||
    isElementUnderParticipant(sequenceFlow.target, participant);
}

function isElementInParticipantProcess(element, participant) {
  const processRef = participant && participant.businessObject && participant.businessObject.processRef;
  const processId = processRef && processRef.id;
  if (!element || !processId) return false;

  const bo = element.businessObject;
  if (bo && bo.$parent && bo.$parent.id === processId) {
    return true;
  }

  if (element.type === 'bpmn:SequenceFlow') {
    const sourceParent = element.source && element.source.businessObject && element.source.businessObject.$parent;
    const targetParent = element.target && element.target.businessObject && element.target.businessObject.$parent;
    return !!(
      sourceParent &&
      targetParent &&
      sourceParent.id === processId &&
      targetParent.id === processId
    );
  }

  return false;
}

function getParticipantDescendants(elementRegistry, participant) {
  if (!elementRegistry || !participant || typeof elementRegistry.getAll !== 'function') {
    return participant.children || [];
  }

  return elementRegistry.getAll()
    .filter(element => element && element.id !== participant.id)
    .filter(element =>
      isElementUnderParticipant(element, participant) ||
      isSequenceFlowUnderParticipant(element, participant) ||
      isElementInParticipantProcess(element, participant)
    );
}

function setElementHorizontal(modeling, element, isHorizontal) {
  if (!element) return;

  if (element.di) {
    element.di.isHorizontal = isHorizontal;
  }
  if (element.businessObject) {
    element.businessObject.isHorizontal = isHorizontal;
  }

  modeling.updateProperties(element, {
    di: { isHorizontal }
  });
}

function rotateLaneLessParticipant(modeling, element, rotationElements, isHorizontal) {
  const oldParticipantBounds = getBounds(element);
  if (!oldParticipantBounds) return false;

  const newParticipantBounds = {
    x: oldParticipantBounds.x,
    y: oldParticipantBounds.y,
    width: oldParticipantBounds.height,
    height: oldParticipantBounds.width
  };

  modeling.resizeShape(element, newParticipantBounds);
  setElementHorizontal(modeling, element, isHorizontal);

  const originalSequenceFlows = rotationElements.filter(child => child.type === 'bpmn:SequenceFlow');
  const originalWaypoints = {};

  originalSequenceFlows.forEach(sequenceFlow => {
    originalWaypoints[sequenceFlow.id] = (sequenceFlow.waypoints || []).map(waypoint => {
      const relativeX = waypoint.x - oldParticipantBounds.x;
      const relativeY = waypoint.y - oldParticipantBounds.y;
      return {
        x: newParticipantBounds.x + relativeY,
        y: newParticipantBounds.y + relativeX,
        original: waypoint.original ? { x: waypoint.original.x, y: waypoint.original.y } : undefined
      };
    });
  });

  const rotatedLabelBounds = [];
  rotationElements.forEach(child => {
    if (child.type !== 'bpmn:SequenceFlow') return;
    const label = child.labels && child.labels[0];
    const labelBounds = label && label.di && label.di.label && label.di.label.bounds;
    if (!labelBounds || typeof labelBounds.x !== 'number' || typeof labelBounds.y !== 'number') return;

    const originalCenterX = labelBounds.x + labelBounds.width / 2;
    const originalCenterY = labelBounds.y + labelBounds.height / 2;
    const relativeX = originalCenterX - oldParticipantBounds.x;
    const relativeY = originalCenterY - oldParticipantBounds.y;
    rotatedLabelBounds.push({
      label,
      bounds: {
        x: newParticipantBounds.x + relativeY - labelBounds.width / 2,
        y: newParticipantBounds.y + relativeX - labelBounds.height / 2,
        width: labelBounds.width,
        height: labelBounds.height
      }
    });
  });

  rotationElements.forEach(child => {
    if (
      child.type === 'bpmn:SequenceFlow' ||
      child.type === 'bpmn:Lane' ||
      child.type === 'bpmn:LaneSet' ||
      child.type === 'bpmn:Participant' ||
      child.type === 'phase:Phase' ||
      child.type === 'phase:PhaseContainer' ||
      child.labelTarget ||
      !child.di ||
      !child.di.bounds
    ) {
      return;
    }

    const originalCenterX = child.di.bounds.x + child.di.bounds.width / 2;
    const originalCenterY = child.di.bounds.y + child.di.bounds.height / 2;
    const relativeX = originalCenterX - oldParticipantBounds.x;
    const relativeY = originalCenterY - oldParticipantBounds.y;
    modeling.resizeShape(child, {
      x: newParticipantBounds.x + relativeY - child.di.bounds.width / 2,
      y: newParticipantBounds.y + relativeX - child.di.bounds.height / 2,
      width: child.di.bounds.width,
      height: child.di.bounds.height
    });
  });

  originalSequenceFlows.forEach(sequenceFlow => {
    sequenceFlow.waypoints = originalWaypoints[sequenceFlow.id];
    modeling.updateProperties(sequenceFlow, {
      waypoints: originalWaypoints[sequenceFlow.id]
    });
  });

  rotatedLabelBounds.forEach(label => {
    if (label.bounds.width >= 10 && label.bounds.height >= 10) {
      modeling.resizeShape(label.label, label.bounds);
    }
  });

  return true;
}

function findAttachedPhaseContainer(elementRegistry, participant, wasHorizontal) {
  if (!elementRegistry || !participant) return null;

  const participantBounds = getBounds(participant);
  const candidates = elementRegistry
    .filter(el =>
      el.type === 'phase:PhaseContainer' ||
      el.businessObject?.$type === 'phase:PhaseContainer' ||
      (typeof el.id === 'string' && el.id.startsWith('PhaseContainer_'))
    )
    .filter(pc => typeof getBounds(pc)?.x === 'number' && typeof getBounds(pc)?.y === 'number');

  if (!candidates.length) return null;

  const ranked = candidates
    .map(pc => {
      const bounds = getBounds(pc);
      const distance = wasHorizontal
        ? Math.abs((bounds.y + bounds.height) - participantBounds.y)
        : Math.abs((bounds.x + bounds.width) - participantBounds.x);
      return { pc, distance };
    })
    .sort((a, b) => a.distance - b.distance);

  return ranked[0].pc;
}

function resizePhaseAxis(modeling, phaseContainer, participantBounds, toHorizontal) {
  if (!phaseContainer) return;

  const oldPhases = (phaseContainer.children || [])
    .filter(child =>
      child.type === 'phase:Phase' ||
      child.businessObject?.$type === 'phase:Phase' ||
      (typeof child.id === 'string' && child.id.startsWith('Phase_'))
    )
    .sort((a, b) => {
      const ab = getBounds(a);
      const bb = getBounds(b);
      return toHorizontal ? ab.y - bb.y : ab.x - bb.x;
    });

  const oldContainerBounds = getBounds(phaseContainer);
  const oldLengths = oldPhases.map(phase => toHorizontal ? phase.height : phase.width);
  const oldTotal = oldLengths.reduce((sum, length) => sum + length, 0);
  const thickness = 60;

  const containerBounds = toHorizontal
    ? {
        x: participantBounds.x + PARTICIPANT_LABEL_HEADER_SIZE,
        y: participantBounds.y - thickness,
        width: Math.max(0, participantBounds.width - PARTICIPANT_LABEL_HEADER_SIZE),
        height: thickness
      }
    : {
        x: participantBounds.x - thickness,
        y: participantBounds.y + PARTICIPANT_LABEL_HEADER_SIZE,
        width: thickness,
        height: Math.max(0, participantBounds.height - PARTICIPANT_LABEL_HEADER_SIZE)
      };

  modeling.resizeShape(phaseContainer, containerBounds);
  if (phaseContainer.businessObject) {
    delete phaseContainer.businessObject.__equalPhaseLengthsOnce;
  }
  setElementHorizontal(modeling, phaseContainer, !toHorizontal);

  const totalLength = toHorizontal ? containerBounds.width : containerBounds.height;
  const unitLength = oldPhases.length ? totalLength / oldPhases.length : totalLength;
  let cursor = toHorizontal ? containerBounds.x : containerBounds.y;

  oldPhases.forEach((phase, index) => {
    const length = index === oldPhases.length - 1
      ? (toHorizontal ? containerBounds.x : containerBounds.y) + totalLength - cursor
      : oldTotal > 0 ? totalLength * oldLengths[index] / oldTotal : unitLength;
    const phaseBounds = toHorizontal
      ? {
          x: cursor,
          y: containerBounds.y,
          width: length,
          height: containerBounds.height
        }
      : {
          x: containerBounds.x,
          y: cursor,
          width: containerBounds.width,
          height: length
        };

    modeling.resizeShape(phase, phaseBounds);
    setElementHorizontal(modeling, phase, !toHorizontal);
    cursor += length;
  });
}

function findLaneByOldCenter(lanes, center, axis) {
  return lanes.find(lane => {
    const bounds = getBounds(lane);
    if (!bounds) return false;
    const start = axis === 'y' ? bounds.y : bounds.x;
    const end = start + (axis === 'y' ? bounds.height : bounds.width);
    return center >= start - 1 && center <= end + 1;
  });
}

function findBoundsByCenter(boundsList, center, axis) {
  return boundsList.find(bounds => {
    if (!bounds) return false;
    const start = axis === 'y' ? bounds.y : bounds.x;
    const end = start + (axis === 'y' ? bounds.height : bounds.width);
    return center >= start - 1 && center <= end + 1;
  });
}

function isElementUnderAncestor(element, ancestor) {
  let current = element;
  while (current) {
    if (current.id === ancestor.id) return true;
    current = current.parent;
  }
  return false;
}

function resizeSubProcessesToRotatedChildren(modeling, elementRegistry) {
  if (!modeling || !elementRegistry) return;

  const all = elementRegistry.getAll();
  const subProcesses = all.filter(element =>
    element &&
    (element.type === 'bpmn:SubProcess' || element.businessObject?.$type === 'bpmn:SubProcess') &&
    typeof getCurrentBounds(element)?.x === 'number'
  );
  const marginX = 18;
  const marginY = 18;

  subProcesses.forEach(subProcess => {
    const children = all.filter(element =>
      element &&
      element.id !== subProcess.id &&
      !element.labelTarget &&
      element.type !== 'bpmn:SequenceFlow' &&
      element.type !== 'bpmn:MessageFlow' &&
      element.type !== 'bpmn:BoundaryEvent' &&
      element.type !== 'bpmn:Lane' &&
      element.type !== 'bpmn:LaneSet' &&
      element.type !== 'bpmn:Participant' &&
      element.type !== 'phase:Phase' &&
      element.type !== 'phase:PhaseContainer' &&
      isElementUnderAncestor(element, subProcess) &&
      typeof getCurrentBounds(element)?.x === 'number'
    );

    if (!children.length) return;

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    const internalWaypoints = all
      .filter(element =>
        (element.type === 'bpmn:SequenceFlow' || element.type === 'bpmn:MessageFlow') &&
        isElementUnderAncestor(element.source, subProcess) &&
        isElementUnderAncestor(element.target, subProcess)
      )
      .flatMap(element => element.waypoints || []);    children.forEach(child => {
      const bounds = getCurrentBounds(child);
      minX = Math.min(minX, bounds.x);
      maxX = Math.max(maxX, bounds.x + bounds.width);
      minY = Math.min(minY, bounds.y);
      maxY = Math.max(maxY, bounds.y + bounds.height);
    });
    internalWaypoints.forEach(point => {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    });

    if (!isFinite(minX) || !isFinite(maxX) || !isFinite(minY) || !isFinite(maxY)) return;

    try {
      modeling.resizeShape(subProcess, {
        x: minX - marginX,
        y: minY - marginY,
        width: (maxX - minX) + marginX * 2,
        height: (maxY - minY) + marginY * 2,
      });
    } catch (err) {
      console.warn('[changeParticipantOrientation] SubProcess rotated child bounds resize failed:', subProcess.id, err);
    }
  });
}

function isExplicitLaneMember(element, lane) {
  const elementId = element?.businessObject?.id || element?.id;
  const flowNodeRefs = lane?.businessObject?.flowNodeRef;
  return !!(
    elementId &&
    Array.isArray(flowNodeRefs) &&
    flowNodeRefs.some(ref => ref && ref.id === elementId)
  );
}
function getLaneContentBounds(elementRegistry, lane, isHorizontal) {
  if (!elementRegistry || !lane) return null;

  const laneBounds = getCurrentBounds(lane);
  if (!laneBounds) return null;

  const children = elementRegistry.getAll().filter(element =>
    element &&
    element.id !== lane.id &&
    !element.labelTarget &&
    element.type !== 'bpmn:SequenceFlow' &&
    element.type !== 'bpmn:MessageFlow' &&
    element.type !== 'bpmn:Lane' &&
    element.type !== 'bpmn:LaneSet' &&
    element.type !== 'bpmn:Participant' &&
    element.type !== 'bpmn:SubProcess' &&
    element.type !== 'phase:Phase' &&
    element.type !== 'phase:PhaseContainer' &&
    typeof getCurrentBounds(element)?.x === 'number' &&
    (
      isElementUnderAncestor(element, lane) ||
      isExplicitLaneMember(element, lane) ||
      isBoundsInLane(getCurrentBounds(element), laneBounds, isHorizontal)
    )
  );

  if (!children.length) return null;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  children.forEach(child => {
    const bounds = getCurrentBounds(child);
    minX = Math.min(minX, bounds.x);
    maxX = Math.max(maxX, bounds.x + bounds.width);
    minY = Math.min(minY, bounds.y);
    maxY = Math.max(maxY, bounds.y + bounds.height);
  });

  if (!isFinite(minX) || !isFinite(maxX) || !isFinite(minY) || !isFinite(maxY)) return null;
  return { minX, maxX, minY, maxY };
}

function isBoundsInLane(bounds, laneBounds, isHorizontal) {
  if (!bounds || !laneBounds) return false;

  const center = isHorizontal
    ? bounds.y + bounds.height / 2
    : bounds.x + bounds.width / 2;
  const laneStart = isHorizontal ? laneBounds.y : laneBounds.x;
  const laneEnd = laneStart + (isHorizontal ? laneBounds.height : laneBounds.width);

  return center >= laneStart - 1 && center <= laneEnd + 1;
}

function hasMovingAncestor(element, movingIds) {
  let current = element?.parent;
  while (current) {
    if (movingIds.has(current.id)) return true;
    current = current.parent;
  }
  return false;
}

function getLaneTopLevelContent(elementRegistry, lane, laneBounds, isHorizontal) {
  if (!elementRegistry || !lane || !laneBounds) return [];

  const moving = elementRegistry.getAll().filter(element =>
    element &&
    element.id !== lane.id &&
    !element.labelTarget &&
    element.type !== 'bpmn:SequenceFlow' &&
    element.type !== 'bpmn:MessageFlow' &&
    element.type !== 'bpmn:Lane' &&
    element.type !== 'bpmn:LaneSet' &&
    element.type !== 'bpmn:Participant' &&
    element.type !== 'phase:Phase' &&
    element.type !== 'phase:PhaseContainer' &&
    typeof getCurrentBounds(element)?.x === 'number' &&
    (
      isElementUnderAncestor(element, lane) ||
      isExplicitLaneMember(element, lane) ||
      isBoundsInLane(getCurrentBounds(element), laneBounds, isHorizontal)
    )
  );

  const movingIds = new Set(moving.map(element => element.id));
  return moving.filter(element => !hasMovingAncestor(element, movingIds));
}

function compactLanesAfterRotation(modeling, elementRegistry, participant, lanes, isHorizontal) {
  if (!modeling || !elementRegistry || !participant || !lanes?.length) return;

  const laneEntries = lanes
    .map(lane => ({ lane, bounds: getCurrentBounds(lane) }))
    .filter(entry =>
      entry.bounds &&
      Number.isFinite(entry.bounds.x) &&
      Number.isFinite(entry.bounds.y) &&
      Number.isFinite(entry.bounds.width) &&
      Number.isFinite(entry.bounds.height)
    )
    .sort((a, b) => {
      const aStart = isHorizontal ? a.bounds.y : a.bounds.x;
      const bStart = isHorizontal ? b.bounds.y : b.bounds.x;
      return aStart - bStart;
    });

  if (!laneEntries.length) return;

  if (laneEntries.length === 1) {
    const entry = laneEntries[0];
    const contentBounds = getLaneContentBounds(elementRegistry, entry.lane, isHorizontal);
    if (contentBounds) {
      const laneStart = isHorizontal ? entry.bounds.y : entry.bounds.x;
      const laneEnd = laneStart + (isHorizontal ? entry.bounds.height : entry.bounds.width);
      const contentStart = isHorizontal ? contentBounds.minY : contentBounds.minX;
      const contentEnd = isHorizontal ? contentBounds.maxY : contentBounds.maxX;
      if (contentStart < laneStart || contentEnd > laneEnd) {
        const expandedStart = Math.min(laneStart, contentStart - LANE_BODY_PADDING);
        const expandedEnd = Math.max(laneEnd, contentEnd + LANE_BODY_PADDING);
        const expandedBounds = {
          x: isHorizontal ? entry.bounds.x : expandedStart,
          y: isHorizontal ? expandedStart : entry.bounds.y,
          width: isHorizontal ? entry.bounds.width : expandedEnd - expandedStart,
          height: isHorizontal ? expandedEnd - expandedStart : entry.bounds.height
        };

        modeling.resizeShape(entry.lane, expandedBounds);
        modeling.resizeShape(participant, {
          x: isHorizontal ? expandedBounds.x - PARTICIPANT_LABEL_HEADER_SIZE : expandedBounds.x,
          y: isHorizontal ? expandedBounds.y : expandedBounds.y - PARTICIPANT_LABEL_HEADER_SIZE,
          width: expandedBounds.width + (isHorizontal ? PARTICIPANT_LABEL_HEADER_SIZE : 0),
          height: expandedBounds.height + (isHorizontal ? 0 : PARTICIPANT_LABEL_HEADER_SIZE)
        });
        return;
      }
    }
  }

  const minLaneSize = 120;
  let offset = 0;
  const firstEntry = laneEntries[0];
  const firstContentBounds = firstEntry
    ? getLaneContentBounds(elementRegistry, firstEntry.lane, isHorizontal)
    : null;
  const firstTrim = firstEntry && firstContentBounds
    ? Math.max(
      0,
      isHorizontal
        ? firstContentBounds.minY - (firstEntry.bounds.y + LANE_LABEL_HEADER_SIZE + LANE_BODY_PADDING)
        : firstContentBounds.minX - (firstEntry.bounds.x + LANE_LABEL_HEADER_SIZE + LANE_BODY_PADDING)
    )
    : 0;

  const plans = laneEntries.map((entry, index) => {
    const laneBounds = entry.bounds;
    const currentSize = isHorizontal ? laneBounds.height : laneBounds.width;
    const contentBounds = getLaneContentBounds(elementRegistry, entry.lane, isHorizontal);
    const desiredSize = contentBounds
      ? (
        isHorizontal
          ? Math.max(minLaneSize, contentBounds.maxY - laneBounds.y + LANE_BODY_PADDING)
          : Math.max(minLaneSize, contentBounds.maxX - laneBounds.x + LANE_BODY_PADDING)
      )
      : minLaneSize;
    const newSize = Math.min(currentSize, desiredSize);
    const currentOffset = offset;
    const leadingTrim = index === 0 ? Math.min(firstTrim, Math.max(0, newSize - minLaneSize)) : 0;
    const shiftedBounds = {
      x: laneBounds.x + (isHorizontal ? 0 : currentOffset + leadingTrim),
      y: laneBounds.y + (isHorizontal ? currentOffset + leadingTrim : 0),
      width: isHorizontal ? laneBounds.width : newSize - leadingTrim,
      height: isHorizontal ? newSize - leadingTrim : laneBounds.height
    };
    const delta = isHorizontal
      ? { x: 0, y: currentOffset }
      : { x: currentOffset, y: 0 };
    const movingContent = getLaneTopLevelContent(elementRegistry, entry.lane, laneBounds, isHorizontal);

    offset -= currentSize - newSize;

    return {
      lane: entry.lane,
      oldBounds: laneBounds,
      newBounds: shiftedBounds,
      delta,
      movingContent
    };
  });

  const updatedLaneBounds = plans.map(plan => plan.newBounds);

  plans.forEach(plan => {
    const laneBounds = plan.oldBounds;
    const shiftedBounds = plan.newBounds;
    const delta = plan.delta;

    if (Math.abs(delta.x) > 0.5 || Math.abs(delta.y) > 0.5) {
      plan.movingContent.forEach(element => {
        try {
          modeling.moveShape(element, delta);
        } catch (err) {
          console.warn('[changeParticipantOrientation] Lane content compact move failed:', element.id, err);
        }
      });
    }

    if (
      Math.abs(shiftedBounds.x - laneBounds.x) > 0.5 ||
      Math.abs(shiftedBounds.y - laneBounds.y) > 0.5 ||
      Math.abs(shiftedBounds.width - laneBounds.width) > 0.5 ||
      Math.abs(shiftedBounds.height - laneBounds.height) > 0.5
    ) {
      modeling.resizeShape(plan.lane, shiftedBounds);
    }
  });

  if (!updatedLaneBounds.length || Math.abs(offset) <= 0.5) return;

  const minX = Math.min(...updatedLaneBounds.map(bounds => bounds.x));
  const maxX = Math.max(...updatedLaneBounds.map(bounds => bounds.x + bounds.width));
  const minY = Math.min(...updatedLaneBounds.map(bounds => bounds.y));
  const maxY = Math.max(...updatedLaneBounds.map(bounds => bounds.y + bounds.height));

  modeling.resizeShape(participant, {
    x: isHorizontal ? minX - PARTICIPANT_LABEL_HEADER_SIZE : minX,
    y: isHorizontal ? minY : minY - PARTICIPANT_LABEL_HEADER_SIZE,
    width: (maxX - minX) + (isHorizontal ? PARTICIPANT_LABEL_HEADER_SIZE : 0),
    height: (maxY - minY) + (isHorizontal ? 0 : PARTICIPANT_LABEL_HEADER_SIZE)
  });
}

function clampNodesToLaneBodyAfterRotation(modeling, elementRegistry, participant, laneBoundsList, isHorizontal) {
  if (!modeling || !elementRegistry || !participant || !laneBoundsList.length) return;
  const participantBounds = getCurrentBounds(participant);
  if (!participantBounds) return;

  const candidates = elementRegistry.getAll().filter(element =>
    element &&
    !element.labelTarget &&
    element.type !== 'bpmn:SequenceFlow' &&
    element.type !== 'bpmn:Lane' &&
    element.type !== 'bpmn:LaneSet' &&
    element.type !== 'bpmn:Participant' &&
    element.type !== 'phase:Phase' &&
    element.type !== 'phase:PhaseContainer' &&
    element.type !== 'bpmn:BoundaryEvent' &&
    typeof getCurrentBounds(element)?.x === 'number' &&
    typeof getCurrentBounds(element)?.y === 'number'
  );

  laneBoundsList.forEach(laneBounds => {
    const laneElements = candidates.filter(element => {
      const bounds = getCurrentBounds(element);
      const centerX = bounds.x + bounds.width / 2;
      const centerY = bounds.y + bounds.height / 2;
      const insideParticipant =
        centerX >= participantBounds.x - 1 &&
        centerX <= participantBounds.x + participantBounds.width + 1 &&
        centerY >= participantBounds.y - 1 &&
        centerY <= participantBounds.y + participantBounds.height + 1;
      if (!insideParticipant) return false;
      return isHorizontal
        ? centerY >= laneBounds.y && centerY <= laneBounds.y + laneBounds.height
        : centerX >= laneBounds.x && centerX <= laneBounds.x + laneBounds.width;
    });

    const movingIds = new Set(laneElements.map(element => element.id));
    const topLevelElements = laneElements.filter(element => !hasMovingAncestor(element, movingIds));
    if (!topLevelElements.length) return;

    const minBodyStart = (isHorizontal ? laneBounds.x : laneBounds.y) + LANE_LABEL_HEADER_SIZE + LANE_BODY_PADDING;
    const firstContentStart = Math.min(...topLevelElements.map(element => {
      const bounds = getCurrentBounds(element);
      return isHorizontal ? bounds.x : bounds.y;
    }));
    const headerShift = Math.max(0, minBodyStart - firstContentStart);
    if (headerShift > 0.5) {
      topLevelElements.forEach(element => {
        modeling.moveShape(element, isHorizontal ? { x: headerShift, y: 0 } : { x: 0, y: headerShift });
      });
    }

    if (!isHorizontal) {
      const minNodeGap = 28;
      let previousEnd = null;
      topLevelElements
        .slice()
        .sort((left, right) => getCurrentBounds(left).y - getCurrentBounds(right).y)
        .forEach(element => {
          const bounds = getCurrentBounds(element);
          if (previousEnd != null && bounds.y < previousEnd + minNodeGap) {
            const delta = previousEnd + minNodeGap - bounds.y;
            modeling.moveShape(element, { x: 0, y: delta });
          }
          const updatedBounds = getCurrentBounds(element);
          previousEnd = updatedBounds.y + updatedBounds.height;
        });
    }
  });

  const currentParticipantBounds = getCurrentBounds(participant);
  const contentEnd = Math.max(...candidates.map(element => {
    const bounds = getCurrentBounds(element);
    return isHorizontal ? bounds.x + bounds.width : bounds.y + bounds.height;
  }));
  const participantEnd = isHorizontal
    ? currentParticipantBounds.x + currentParticipantBounds.width
    : currentParticipantBounds.y + currentParticipantBounds.height;
  const expansion = Math.max(0, contentEnd + LANE_BODY_PADDING - participantEnd);
  if (expansion <= 0.5) return;

  (participant.children || [])
    .filter(element => element.type === 'bpmn:Lane')
    .forEach(lane => {
      const bounds = getCurrentBounds(lane);
      if (!bounds) return;
      modeling.resizeShape(lane, {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width + (isHorizontal ? expansion : 0),
        height: bounds.height + (isHorizontal ? 0 : expansion)
      });
    });
  modeling.resizeShape(participant, {
    x: currentParticipantBounds.x,
    y: currentParticipantBounds.y,
    width: currentParticipantBounds.width + (isHorizontal ? expansion : 0),
    height: currentParticipantBounds.height + (isHorizontal ? 0 : expansion)
  });
}
PaletteProvider.prototype.rotateAndSnapAttacher = function(attacher, taskBounds, newTaskBounds, direction = 'clockwise') {
  if (!attacher || !attacher.di || !attacher.di.bounds || !taskBounds || !newTaskBounds) {
    return null;
  }
  const taskCenterX = taskBounds.x + taskBounds.width / 2;
  const taskCenterY = taskBounds.y + taskBounds.height / 2;

  const attacherBounds = attacher.di.bounds;
  const attacherCenterX = attacherBounds.x + attacherBounds.width / 2;
  const attacherCenterY = attacherBounds.y + attacherBounds.height / 2;

  const dx = attacherCenterX - taskCenterX;
  const dy = attacherCenterY - taskCenterY;

  let rotatedDx, rotatedDy;

  if (direction === 'clockwise') {
    rotatedDx = dy;
    rotatedDy = -dx;
  } else {
    rotatedDx = -dy;
    rotatedDy = dx;
  }

  let side;
  if (Math.abs(rotatedDx) > Math.abs(rotatedDy)) {
    side = rotatedDx > 0 ? 'right' : 'left';
  } else {
    side = rotatedDy > 0 ? 'bottom' : 'top';
  }

  const newTaskCenterX = newTaskBounds.x + newTaskBounds.width / 2;
  const newTaskCenterY = newTaskBounds.y + newTaskBounds.height / 2;

  let newAttacherCenterX = newTaskCenterX;
  let newAttacherCenterY = newTaskCenterY;

  switch (side) {
    case 'left':
      newAttacherCenterX = newTaskBounds.x;
      break;
    case 'right':
      newAttacherCenterX = newTaskBounds.x + newTaskBounds.width;
      break;
    case 'top':
      newAttacherCenterY = newTaskBounds.y;
      break;
    case 'bottom':
      newAttacherCenterY = newTaskBounds.y + newTaskBounds.height;
      break;
  }

  const radiusX = attacherBounds.width / 2;
  const radiusY = attacherBounds.height / 2;

  const newAttacherBounds = {
    x: newAttacherCenterX - radiusX,
    y: newAttacherCenterY - radiusY,
    width: attacherBounds.width,
    height: attacherBounds.height
  };

  return newAttacherBounds;
}

PaletteProvider.prototype.adjustParticipantBoundsByLanes = function(participant, lanes, isHorizontal) {
  var modeling = this._modeling;
  if (!lanes.length) return;
  const paddingX = isHorizontal ? PARTICIPANT_LABEL_HEADER_SIZE : 0;
  const paddingY = isHorizontal ? 0 : PARTICIPANT_LABEL_HEADER_SIZE;

  const boundsList = lanes
    .map(lane => getBounds(lane))
    .filter(bounds =>
      bounds &&
      Number.isFinite(bounds.x) &&
      Number.isFinite(bounds.y) &&
      Number.isFinite(bounds.width) &&
      Number.isFinite(bounds.height)
    );

  if (!boundsList.length) return;

  const minX = Math.min(...boundsList.map(b => b.x));
  const maxX = Math.max(...boundsList.map(b => b.x + b.width));
  const minY = Math.min(...boundsList.map(b => b.y));
  const maxY = Math.max(...boundsList.map(b => b.y + b.height));

  const newWidth = maxX - minX;
  const newHeight = maxY - minY;

  modeling.resizeShape(participant, {
    x: minX - paddingX,
    y: minY - paddingY,
    width: Math.max(10, newWidth + paddingX),
    height: Math.max(10, newHeight + paddingY)
  });

  modeling.updateProperties(participant, {
    di: { isHorizontal }
  });
}

PaletteProvider.prototype.rerouteRotatedConnections = function(horizontal) {
  const elementRegistry = this._injector.get('elementRegistry');
  rerouteRotatedSequenceFlows(
    this._modeling,
    elementRegistry,
    elementRegistry.getAll(),
    horizontal
  );
  resizeSubProcessesToRotatedChildren(this._modeling, elementRegistry);
};

PaletteProvider.prototype.applyAutoLayout = function(onLoadStart = () => {}, onLoadEnd = () => {}) {
  if (typeof window !== 'undefined' && window.$pal) return;
  var injector = this._injector;
  var elementFactory = this._elementFactory;

  try {
      if (!window.BpmnAutoLayout) {
          console.error('BpmnAutoLayout ??議댁옱?섏? ?딆뒿?덈떎.');
          return;
      }

      setTimeout(() => {
          try {
              const bpmnJS = injector;
              clearSelectionVisualState(bpmnJS);
              const elementRegistry = bpmnJS.get('elementRegistry');
              const participant = elementRegistry.filter(element => element.type === 'bpmn:Participant');
              const horizontal = participant.length > 0 ? participant[0].di?.isHorizontal : true;

              window.BpmnAutoLayout.applyAutoLayout(bpmnJS, { horizontal }, onLoadStart, onLoadEnd);
              clearSelectionVisualState(bpmnJS);
              
              const canvas = elementFactory._canvas;
              if (canvas && canvas.zoom) {
                  canvas.zoom('fit-viewport');
              }
          } catch (error) {
              console.error('?먮룞?덉씠?꾩썐???ㅽ뙣?덉뒿?덈떎.', error);
          }
      }, 50);

      
  } catch (error) {
      console.error('?먮룞?덉씠?꾩썐???ㅽ뙣?덉뒿?덈떎.', error);
  }
}

PaletteProvider.prototype._rotateRelativePosition = function(relativeX, relativeY, scaleX, scaleY) {
  return {
    x: relativeY * scaleY,
    y: relativeX * scaleX
  };
};

// ?⑥닔 ?뺤쓽瑜?getPaletteEntries 諛붽묑?쇰줈 ??릿??
PaletteProvider.prototype.changeParticipantHorizontalToVertical = function(event, element, onLoadStart = () => {}, onLoadEnd = () => {}) {
  onLoadStart();
  const modeling = this._modeling;
  const logPrefix = '[changeParticipantOrientation]';

  try {
    if (element.type !== 'bpmn:Participant') {
      console.warn(`${logPrefix} participant媛 ?꾨떃?덈떎.`);
      onLoadEnd();
      return;
    }

    const childElements = element.children || [];
    const elementRegistry = this._injector.get('elementRegistry');
    const rotationElements = getParticipantDescendants(elementRegistry, element);

    let isSubprocessImported = false;
    // ?쒕툕?꾨줈?몄뒪媛 ?덉쑝硫?源⑥???臾몄젣媛 ?덉뼱 ?쒕툕?꾨줈?몄뒪媛 ?덉쓣 寃쎌슦?먮뒗 ?꾩떆 鍮꾪솢?깊솕
    // childElements.forEach(child => {
    //   if(child.type === "bpmn:SubProcess") {
    //     isSubprocessImported = true;
    //   }
    // });
    // if(isSubprocessImported) {
    //   onLoadEnd();
    //   return;
    // }
    const lanes = childElements
      .filter(el => el.type === 'bpmn:Lane')
      .sort((a, b) => a.di.bounds.y - b.di.bounds.y);

    if (!lanes.length) {
      rotateLaneLessParticipant(modeling, element, rotationElements, false);
      onLoadEnd();
      return;
    }

    // ???뚯쟾 ?꾩뿉 lane ?꾩껜瑜?媛먯떥??oldParticipantBounds ?앹꽦
    const oldMinX = Math.min(...lanes.map(lane => lane.di.bounds.x));
    const oldMaxX = Math.max(...lanes.map(lane => lane.di.bounds.x + lane.di.bounds.width));
    const oldMinY = Math.min(...lanes.map(lane => lane.di.bounds.y));
    const oldMaxY = Math.max(...lanes.map(lane => lane.di.bounds.y + lane.di.bounds.height));

    const oldParticipantBounds = {
      x: oldMinX,
      y: oldMinY,
      width: oldMaxX - oldMinX,
      height: oldMaxY - oldMinY
    };

    // ?뮕 lane ?뚯쟾 ??bounds ??????뚯쟾 ??bounds 怨꾩궛???ъ슜
    const laneNewBoundsMap = new Map();
    let currentX = oldParticipantBounds.x;
    const currentY = oldParticipantBounds.y + PARTICIPANT_LABEL_HEADER_SIZE;

    lanes.forEach(lane => {
      const oldLaneBounds = lane.di.bounds;

      const laneWidth = oldLaneBounds.width * LANE_WIDTH_SCALE * ROTATION_SCALE_FIX;
      const laneHeight = oldLaneBounds.height * LANE_HEIGHT_SCALE * ROTATION_SCALE_FIX;

      const newLaneBounds = {
        x: currentX,
        y: currentY,
        width: laneHeight,
        height: laneWidth + LANE_LABEL_HEADER_SIZE
      };

      currentX += laneHeight;

      modeling.resizeShape(lane, newLaneBounds);
      modeling.updateProperties(lane, {
        di: { isHorizontal: false }
      });

      laneNewBoundsMap.set(lane.id, newLaneBounds);
    });

    // ??lane ?뚯쟾 ?댄썑 湲곗??쇰줈 participant bounds 怨꾩궛
    const laneBoundsList = Array.from(laneNewBoundsMap.values());

    const minX = Math.min(...laneBoundsList.map(b => b.x));
    const maxX = Math.max(...laneBoundsList.map(b => b.x + b.width));
    const minY = Math.min(...laneBoundsList.map(b => b.y));
    const maxY = Math.max(...laneBoundsList.map(b => b.y + b.height));

    const newParticipantBounds = {
      x: minX,
      y: minY - PARTICIPANT_LABEL_HEADER_SIZE,
      width: maxX - minX,
      height: (maxY - minY) + PARTICIPANT_LABEL_HEADER_SIZE
    };

    modeling.resizeShape(element, newParticipantBounds);
    modeling.updateProperties(element, {
      di: { isHorizontal: false }
    });

    // ?㎛ SequenceFlow waypoint 蹂댁젙
    const originalSequenceFlows = rotationElements.filter(child => child.type === 'bpmn:SequenceFlow');
    const originalWaypoints = {};

    originalSequenceFlows.forEach(sequenceFlow => {
      const waypoints = sequenceFlow.waypoints;
      const newWaypoints = [];

      waypoints.forEach(waypoint => {
        const waypointX = newParticipantBounds.y + (waypoint.x - oldParticipantBounds.x) * LANE_WIDTH_SCALE * ROTATION_SCALE_FIX;
        const waypointY = newParticipantBounds.x + (waypoint.y - oldParticipantBounds.y) * LANE_HEIGHT_SCALE * ROTATION_SCALE_FIX;

        const newWaypoint = { x: waypointY, y: waypointX + LANE_LABEL_HEADER_SIZE };

        if (waypoint.original) {
          newWaypoint.original = { x: waypoint.original.x, y: waypoint.original.y };
        }

        newWaypoints.push(newWaypoint);
      });

      originalWaypoints[sequenceFlow.id] = newWaypoints;
    });

    let rotatedLabelBounds = [];
    rotationElements.forEach(child => {
      if (child.type === 'bpmn:SequenceFlow') {
        const label = child.labels && child.labels[0];
        if (label && label.di && label.di.label) {
          const labelBounds = label.di.label.bounds;
          if (!labelBounds || typeof labelBounds.x !== 'number' || typeof labelBounds.y !== 'number') {
            return;
          }

          const originalCenterX = labelBounds.x + (labelBounds.width / 2);
          const originalCenterY = labelBounds.y + (labelBounds.height / 2);

          const relativeX = originalCenterX - oldParticipantBounds.x;
          const relativeY = originalCenterY - oldParticipantBounds.y;

          const scaleX = LANE_WIDTH_SCALE * ROTATION_SCALE_FIX;
          const scaleY = LANE_HEIGHT_SCALE * ROTATION_SCALE_FIX;
          const rotated = this._rotateRelativePosition(relativeX, relativeY, scaleX, scaleY);

          const newLabelBounds = {
            x: newParticipantBounds.x + rotated.x - (labelBounds.width / 2),
            y: newParticipantBounds.y + rotated.y - (labelBounds.height / 2) + LANE_LABEL_HEADER_SIZE,
            width: labelBounds.width,
            height: labelBounds.height
          };
          rotatedLabelBounds.push({ label, bounds: newLabelBounds });
        }
      }
    });

    // ?㎛ 湲고? ?몃뱶 ?꾩튂 蹂댁젙
    const rotatedElementDeltas = new Map();
    rotationElements.forEach(child => {
      if (
        child.type !== 'bpmn:Lane' &&
        child.type !== 'bpmn:LaneSet' &&
        child.type !== 'bpmn:Participant' &&
        child.type !== 'phase:Phase' &&
        child.type !== 'phase:PhaseContainer' &&
        !child.labelTarget &&
        child.di &&
        child.di.bounds
      ) {
        if (child.type !== 'bpmn:SequenceFlow' && child.type !== 'bpmn:BoundaryEvent') {
          const originalCenterX = child.di.bounds.x + (child.di.bounds.width / 2);
          const originalCenterY = child.di.bounds.y + (child.di.bounds.height / 2);

          const relativeX = originalCenterX - oldParticipantBounds.x;
          const relativeY = originalCenterY - oldParticipantBounds.y;

          const scaleX = LANE_WIDTH_SCALE * ROTATION_SCALE_FIX;
          const scaleY = LANE_HEIGHT_SCALE * ROTATION_SCALE_FIX;
          const rotated = this._rotateRelativePosition(relativeX, relativeY, scaleX, scaleY);

          const newChildBounds = {
            x: newParticipantBounds.x + rotated.x - (child.di.bounds.width / 2),
            y: newParticipantBounds.y + rotated.y - (child.di.bounds.height / 2) + LANE_LABEL_HEADER_SIZE,
            width: child.di.bounds.width,
            height: child.di.bounds.height
          };
          let clampDeltaY = 0;
          const originalLane = findLaneByOldCenter(lanes, originalCenterY, 'y');
          const targetLaneBounds = originalLane
            ? laneNewBoundsMap.get(originalLane.id)
            : findBoundsByCenter(laneBoundsList, newChildBounds.x + newChildBounds.width / 2, 'x');
          if (targetLaneBounds) {
            const minBodyY = targetLaneBounds.y + LANE_LABEL_HEADER_SIZE + LANE_BODY_PADDING;
            if (newChildBounds.y < minBodyY) {
              clampDeltaY = minBodyY - newChildBounds.y;
              newChildBounds.y = minBodyY;
            }
          }
          rotatedElementDeltas.set(child.id, {
            dx: 0,
            dy: clampDeltaY,
          });

          modeling.resizeShape(child, newChildBounds);

          if(child.attachers && child.attachers.length > 0) {
            child.attachers.forEach(attacher => {
              const newBounds = this.rotateAndSnapAttacher(
                attacher,
                child.di.bounds,
                newChildBounds,
                ATTACHER_ROTATION.horizontalToVertical
              );
              if (newBounds) {
                modeling.resizeShape(attacher, newBounds);
              }
            });
          }
        }
      }

      rotatedLabelBounds.forEach(label => {
        if (label.bounds.width >= 10 && label.bounds.height >= 10) {
          modeling.resizeShape(label.label, label.bounds);
        }
      });
    });

    const phaseContainer = findAttachedPhaseContainer(this._injector.get('elementRegistry'), element, true);
    resizePhaseAxis(modeling, phaseContainer, getBounds(element), false);

    // ?뮕 SequenceFlow 理쒖쥌 waypoint 諛섏쁺
    originalSequenceFlows.forEach(sequenceFlow => {
      const waypoints = originalWaypoints[sequenceFlow.id] || [];
      const sourceDelta = sequenceFlow.source ? rotatedElementDeltas.get(sequenceFlow.source.id) : null;
      const targetDelta = sequenceFlow.target ? rotatedElementDeltas.get(sequenceFlow.target.id) : null;
      if (sourceDelta && waypoints[0]) {
        waypoints[0] = { ...waypoints[0], x: waypoints[0].x + sourceDelta.dx, y: waypoints[0].y + sourceDelta.dy };
      }
      if (targetDelta && waypoints.length > 1) {
        const lastIndex = waypoints.length - 1;
        waypoints[lastIndex] = {
          ...waypoints[lastIndex],
          x: waypoints[lastIndex].x + targetDelta.dx,
          y: waypoints[lastIndex].y + targetDelta.dy,
        };
      }
      sequenceFlow.waypoints = waypoints;
      modeling.updateProperties(sequenceFlow, {
        waypoints
      });
    });
    clampNodesToLaneBodyAfterRotation(modeling, this._injector.get('elementRegistry'), element, laneBoundsList, false);
    resizeSubProcessesToRotatedChildren(modeling, this._injector.get('elementRegistry'));
    compactLanesAfterRotation(modeling, this._injector.get('elementRegistry'), element, lanes, false);

    const sync = window.BpmnAutoLayout && window.BpmnAutoLayout.syncPhaseContainersWithParticipants;
    if (typeof sync === 'function') {
      sync(this._injector, { horizontal: false });
    }
    onLoadEnd();
  } catch (error) {
    console.error(`${logPrefix} ?뚯쟾 以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.`, error);
    onLoadEnd();
  }
};

PaletteProvider.prototype.changeParticipantVerticalToHorizontal = function(event, element, onLoadStart = () => {}, onLoadEnd = () => {}) {
  onLoadStart();
  const modeling = this._modeling;
  const logPrefix = '[changeParticipantOrientation]';
  try {
    if (element.type !== 'bpmn:Participant') {
      console.warn(`${logPrefix} participant媛 ?꾨떃?덈떎.`);
      onLoadEnd();
      return;
    }

    const childElements = element.children || [];
    const elementRegistry = this._injector.get('elementRegistry');
    const rotationElements = getParticipantDescendants(elementRegistry, element);

    let isSubprocessImported = false;
    // ?쒕툕?꾨줈?몄뒪媛 ?덉쑝硫?源⑥???臾몄젣媛 ?덉뼱 ?쒕툕?꾨줈?몄뒪媛 ?덉쓣 寃쎌슦?먮뒗 ?꾩떆 鍮꾪솢?깊솕
    // childElements.forEach(child => {
    //   if(child.type === "bpmn:SubProcess") {
    //     isSubprocessImported = true;
    //   }
    // });
    // if(isSubprocessImported) {
    //   alert('?쒕툕?꾨줈?몄뒪媛 ?ы븿???꾨줈?몄뒪??媛濡??몃줈 ?뚯쟾??吏?먰븯吏 ?딆뒿?덈떎.');
    //   onLoadEnd();
    //   return;
    // }
    const lanes = childElements
      .filter(el => el.type === 'bpmn:Lane')
      .sort((a, b) => a.di.bounds.x - b.di.bounds.x);

    if (!lanes.length) {
      rotateLaneLessParticipant(modeling, element, rotationElements, true);
      onLoadEnd();
      return;
    }

    // ???뚯쟾 ??lane 湲곗??쇰줈 oldParticipantBounds ?앹꽦
    const oldMinX = Math.min(...lanes.map(lane => lane.di.bounds.x));
    const oldMaxX = Math.max(...lanes.map(lane => lane.di.bounds.x + lane.di.bounds.width));
    const oldMinY = Math.min(...lanes.map(lane => lane.di.bounds.y));
    const oldMaxY = Math.max(...lanes.map(lane => lane.di.bounds.y + lane.di.bounds.height));

    const oldParticipantBounds = {
      x: oldMinX,
      y: oldMinY,
      width: oldMaxX - oldMinX,
      height: oldMaxY - oldMinY
    };

    // ?뮕 lane ?뚯쟾 ??bounds ??????뚯쟾 ??bounds 怨꾩궛???ъ슜
    const laneNewBoundsMap = new Map();
    let currentY = oldParticipantBounds.y;
    const currentX = oldParticipantBounds.x + PARTICIPANT_LABEL_HEADER_SIZE;

    lanes.forEach(lane => {
      const oldLaneBounds = lane.di.bounds;

      const laneWidth = oldLaneBounds.width * LANE_WIDTH_SCALE;   // Scale Fix ?놁쓬
      const laneHeight = oldLaneBounds.height * LANE_HEIGHT_SCALE; // Scale Fix ?놁쓬

      const newLaneBounds = {
        x: currentX,
        y: currentY,
        width: laneHeight + LANE_LABEL_HEADER_SIZE,
        height: laneWidth
      };

      currentY += laneWidth;

      modeling.resizeShape(lane, newLaneBounds);
      modeling.updateProperties(lane, {
        di: { isHorizontal: true }
      });

      laneNewBoundsMap.set(lane.id, newLaneBounds);
    });

    // ??lane ?뚯쟾 ?댄썑 湲곗??쇰줈 participant bounds 怨꾩궛
    const laneBoundsList = Array.from(laneNewBoundsMap.values());

    const minX = Math.min(...laneBoundsList.map(b => b.x));
    const maxX = Math.max(...laneBoundsList.map(b => b.x + b.width));
    const minY = Math.min(...laneBoundsList.map(b => b.y));
    const maxY = Math.max(...laneBoundsList.map(b => b.y + b.height));

    const newParticipantBounds = {
      x: minX - PARTICIPANT_LABEL_HEADER_SIZE,
      y: minY,
      width: (maxX - minX) + PARTICIPANT_LABEL_HEADER_SIZE,
      height: maxY - minY
    };

    modeling.resizeShape(element, newParticipantBounds);
    modeling.updateProperties(element, {
      di: { isHorizontal: true }
    });

    // ?㎛ SequenceFlow waypoint 蹂댁젙
    const originalSequenceFlows = rotationElements.filter(child => child.type === 'bpmn:SequenceFlow');
    const originalWaypoints = {};

    originalSequenceFlows.forEach(sequenceFlow => {
      const waypoints = sequenceFlow.waypoints;
      const newWaypoints = [];

      waypoints.forEach(waypoint => {
        const waypointX = newParticipantBounds.y + (waypoint.x - oldParticipantBounds.x) * LANE_WIDTH_SCALE;
        const waypointY = newParticipantBounds.x + (waypoint.y - oldParticipantBounds.y) * LANE_HEIGHT_SCALE;

        const newWaypoint = { x: waypointY + LANE_LABEL_HEADER_SIZE, y: waypointX };

        if (waypoint.original) {
          newWaypoint.original = { x: waypoint.original.x, y: waypoint.original.y };
        }

        newWaypoints.push(newWaypoint);
      });

      originalWaypoints[sequenceFlow.id] = newWaypoints;
    });

    let rotatedLabelBounds = [];


    rotationElements.forEach(child => {
      if (child.type === 'bpmn:SequenceFlow') {
        const label = child.labels && child.labels[0];
        if (label && label.di && label.di.label) {
          const labelBounds = label.di.label.bounds;
          if (!labelBounds || typeof labelBounds.x !== 'number' || typeof labelBounds.y !== 'number') {
            return;
          }

          const originalCenterX = labelBounds.x + (labelBounds.width / 2);
          const originalCenterY = labelBounds.y + (labelBounds.height / 2);
          
          const relativeX = originalCenterX - oldParticipantBounds.x;
          const relativeY = originalCenterY - oldParticipantBounds.y;

          const scaleX = LANE_WIDTH_SCALE;
          const scaleY = LANE_HEIGHT_SCALE;
          const rotated = this._rotateRelativePosition(relativeX, relativeY, scaleX, scaleY);

          const newLabelBounds = {
            x: newParticipantBounds.x + rotated.x - (labelBounds.width / 2) + LANE_LABEL_HEADER_SIZE,
            y: newParticipantBounds.y + rotated.y - (labelBounds.height / 2),
            width: labelBounds.width,
            height: labelBounds.height
          };
          rotatedLabelBounds.push({ label, bounds: newLabelBounds });
        }
      }
    });

    // ?㎛ 湲고? ?몃뱶 蹂댁젙
    const rotatedElementDeltas = new Map();
    rotationElements.forEach(child => {
      if (
        child.type !== 'bpmn:Lane' &&
        child.type !== 'bpmn:LaneSet' &&
        child.type !== 'bpmn:Participant' &&
        child.type !== 'phase:Phase' &&
        child.type !== 'phase:PhaseContainer' &&
        !child.labelTarget &&
        child.di &&
        child.di.bounds
      ) {
        if (child.type !== 'bpmn:SequenceFlow' && child.type !== 'bpmn:BoundaryEvent') {
          const originalCenterX = child.di.bounds.x + (child.di.bounds.width / 2);
          const originalCenterY = child.di.bounds.y + (child.di.bounds.height / 2);

          const relativeX = originalCenterX - oldParticipantBounds.x;
          const relativeY = originalCenterY - oldParticipantBounds.y;
  
          const scaleX = LANE_WIDTH_SCALE;
          const scaleY = LANE_HEIGHT_SCALE;
          const rotated = this._rotateRelativePosition(relativeX, relativeY, scaleX, scaleY);

          const newChildBounds = {
            x: newParticipantBounds.x + rotated.x - (child.di.bounds.width / 2) + LANE_LABEL_HEADER_SIZE,
            y: newParticipantBounds.y + rotated.y - (child.di.bounds.height / 2),
            width: child.di.bounds.width,
            height: child.di.bounds.height
          };
          let clampDeltaX = 0;
          const originalLane = findLaneByOldCenter(lanes, originalCenterX, 'x');
          const targetLaneBounds = originalLane
            ? laneNewBoundsMap.get(originalLane.id)
            : findBoundsByCenter(laneBoundsList, newChildBounds.y + newChildBounds.height / 2, 'y');
          if (targetLaneBounds) {
            const minBodyX = targetLaneBounds.x + LANE_LABEL_HEADER_SIZE + LANE_BODY_PADDING;
            if (newChildBounds.x < minBodyX) {
              clampDeltaX = minBodyX - newChildBounds.x;
              newChildBounds.x = minBodyX;
            }
          }
          rotatedElementDeltas.set(child.id, {
            dx: clampDeltaX,
            dy: 0,
          });

          modeling.resizeShape(child, newChildBounds);

          
          if(child.attachers && child.attachers.length > 0) {
            child.attachers.forEach(attacher => {
              const newBounds = this.rotateAndSnapAttacher(
                attacher,
                child.di.bounds,
                newChildBounds,
                ATTACHER_ROTATION.verticalToHorizontal
              );
              if (newBounds) {
                modeling.resizeShape(attacher, newBounds);
              }
            });
          }
        }
      }
    });

    const phaseContainer = findAttachedPhaseContainer(this._injector.get('elementRegistry'), element, false);
    resizePhaseAxis(modeling, phaseContainer, getBounds(element), true);

    // ?뮕 SequenceFlow 理쒖쥌 waypoint 諛섏쁺
    originalSequenceFlows.forEach(sequenceFlow => {
      const waypoints = originalWaypoints[sequenceFlow.id] || [];
      const sourceDelta = sequenceFlow.source ? rotatedElementDeltas.get(sequenceFlow.source.id) : null;
      const targetDelta = sequenceFlow.target ? rotatedElementDeltas.get(sequenceFlow.target.id) : null;
      if (sourceDelta && waypoints[0]) {
        waypoints[0] = { ...waypoints[0], x: waypoints[0].x + sourceDelta.dx, y: waypoints[0].y + sourceDelta.dy };
      }
      if (targetDelta && waypoints.length > 1) {
        const lastIndex = waypoints.length - 1;
        waypoints[lastIndex] = {
          ...waypoints[lastIndex],
          x: waypoints[lastIndex].x + targetDelta.dx,
          y: waypoints[lastIndex].y + targetDelta.dy,
        };
      }
      sequenceFlow.waypoints = waypoints;
      modeling.updateProperties(sequenceFlow, {
        waypoints
      });
    });
    clampNodesToLaneBodyAfterRotation(modeling, this._injector.get('elementRegistry'), element, laneBoundsList, true);
    resizeSubProcessesToRotatedChildren(modeling, this._injector.get('elementRegistry'));
    compactLanesAfterRotation(modeling, this._injector.get('elementRegistry'), element, lanes, true);

    rotatedLabelBounds.forEach(label => {
      if (label.bounds.width >= 10 && label.bounds.height >= 10) {
        modeling.resizeShape(label.label, label.bounds);
      }
    });

    const sync = window.BpmnAutoLayout && window.BpmnAutoLayout.syncPhaseContainersWithParticipants;
    if (typeof sync === 'function') {
      sync(this._injector, { horizontal: true });
    }
    onLoadEnd();
  } catch (error) {
    console.error(`${logPrefix} ?뚯쟾 以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.`, error);
    onLoadEnd();
  }
};



// Existing application view helpers; independent of the Phase rotation implementation.
(function () {
PaletteProvider.prototype.revertLayout = function () {
    try {
        if (!window.BpmnAutoLayout) {
            console.error('BpmnAutoLayout이 존재하지 않습니다.');
            return false;
        }

        if (!window.BpmnAutoLayout.hasLayoutSnapshot()) {
            console.warn('복구할 레이아웃 스냅샷이 없습니다.');
            return false;
        }

        const bpmnJS = this._injector;
        const success = window.BpmnAutoLayout.restoreLayoutSnapshot(bpmnJS);

        if (success) {
            console.log('레이아웃이 복구되었습니다.');
            // Clear the snapshot after successful restore
            window.BpmnAutoLayout.clearLayoutSnapshot();
        }

        return success;
    } catch (error) {
        console.error('레이아웃 복구에 실패했습니다.', error);
        return false;
    }
};

function getElementBounds(element) {
    if (!element) return null;
    if (
        typeof element.x === 'number' &&
        typeof element.y === 'number' &&
        typeof element.width === 'number' &&
        typeof element.height === 'number'
    ) {
        return element;
    }
    return element.di && element.di.bounds ? element.di.bounds : null;
}

function isBoundsInLane(bounds, laneBounds, isHorizontal) {
    if (!bounds || !laneBounds) return false;
    const center = isHorizontal ? bounds.y + bounds.height / 2 : bounds.x + bounds.width / 2;
    const laneStart = isHorizontal ? laneBounds.y : laneBounds.x;
    const laneEnd = laneStart + (isHorizontal ? laneBounds.height : laneBounds.width);
    return center >= laneStart - 1 && center <= laneEnd + 1;
}





function isElementDescendantOf(element, ancestor) {
    let current = element && element.parent;
    while (current) {
        if (current.id === ancestor.id) return true;
        current = current.parent;
    }
    return false;
}

function isRealDiagramShape(element) {
    return (
        element &&
        !element.labelTarget &&
        element.type !== 'bpmn:SequenceFlow' &&
        element.type !== 'bpmn:MessageFlow' &&
        element.type !== 'bpmn:Collaboration' &&
        element.type !== 'bpmn:Process' &&
        element.type !== 'bpmn:Participant' &&
        element.type !== 'bpmn:Lane' &&
        element.type !== 'bpmn:LaneSet'
    );
}

function collectBounds(elements) {
    const valid = elements
        .map(getElementBounds)
        .filter(
            (bounds) =>
                bounds &&
                Number.isFinite(bounds.x) &&
                Number.isFinite(bounds.y) &&
                Number.isFinite(bounds.width) &&
                Number.isFinite(bounds.height)
        );

    if (!valid.length) return null;

    const minX = Math.min(...valid.map((bounds) => bounds.x));
    const minY = Math.min(...valid.map((bounds) => bounds.y));
    const maxX = Math.max(...valid.map((bounds) => bounds.x + bounds.width));
    const maxY = Math.max(...valid.map((bounds) => bounds.y + bounds.height));

    return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}


function isBoundsOverlapping(bounds, containerBounds) {
    if (!bounds || !containerBounds) return false;

    return (
        bounds.x < containerBounds.x + containerBounds.width &&
        bounds.x + bounds.width > containerBounds.x &&
        bounds.y < containerBounds.y + containerBounds.height &&
        bounds.y + bounds.height > containerBounds.y
    );
}

function setDiagramHorizontal(element, isHorizontal) {
    if (!element) return;

    if (element.di) {
        element.di.isHorizontal = isHorizontal;
    }

    if (element.businessObject) {
        element.businessObject.isHorizontal = isHorizontal;
    }
}

function collectLaneIdsFromLaneSets(laneSets, laneIds = new Set()) {
    (laneSets || []).forEach((laneSet) => {
        (laneSet.lanes || []).forEach((lane) => {
            if (lane.id) laneIds.add(lane.id);
            collectLaneIdsFromLaneSets(lane.childLaneSet ? [lane.childLaneSet] : [], laneIds);
        });
    });

    return laneIds;
}

function syncParticipantLaneOrientation(elementRegistry, participant, isHorizontal) {
    setDiagramHorizontal(participant, isHorizontal);

    if (!elementRegistry || !participant) return;

    const participantBounds = getElementBounds(participant);
    const processLaneIds = collectLaneIdsFromLaneSets(participant.businessObject?.processRef?.laneSets);
    const participants = elementRegistry.filter((element) => element.type === 'bpmn:Participant');
    const shouldSyncAllLanes = participants.length === 1;
    const lanes = elementRegistry.filter(
        (element) =>
            element.type === 'bpmn:Lane' &&
            (shouldSyncAllLanes ||
                processLaneIds.has(element.id) ||
                isElementDescendantOf(element, participant) ||
                isBoundsOverlapping(getElementBounds(element), participantBounds))
    );

    lanes.forEach((lane) => setDiagramHorizontal(lane, isHorizontal));
}


PaletteProvider.prototype.syncAllLaneOrientationForView = function (isHorizontal) {
    const elementRegistry = this._injector && this._injector.get('elementRegistry');
    if (!elementRegistry) return;

    elementRegistry
        .filter((element) => element.type === 'bpmn:Participant' || element.type === 'bpmn:Lane')
        .forEach((element) => setDiagramHorizontal(element, isHorizontal));
};

PaletteProvider.prototype.normalizeDiagramBoundsForView = function () {
    if (!this._isViewMode) return;

    const modeling = this._modeling;
    const elementRegistry = this._injector && this._injector.get('elementRegistry');
    if (!modeling || !elementRegistry) return;

    const participants = elementRegistry.filter((element) => element.type === 'bpmn:Participant');
    participants.forEach((participant) => {
        const participantBounds = getElementBounds(participant);
        if (!participantBounds) return;

        const isHorizontal = participant.di?.isHorizontal !== false;
        const lanes = elementRegistry.filter(
            (element) =>
                element.type === 'bpmn:Lane' &&
                (isElementDescendantOf(element, participant) || isBoundsInLane(getElementBounds(element), participantBounds, isHorizontal))
        );
        const content = elementRegistry.filter(
            (element) =>
                isRealDiagramShape(element) &&
                (isElementDescendantOf(element, participant) || isBoundsInLane(getElementBounds(element), participantBounds, isHorizontal))
        );

        const contentBounds = collectBounds(content);
        if (!contentBounds) return;

        const laneBounds = collectBounds(lanes);
        const axisPadding = 80;
        const outerPadding = 30;
        const minAxisSize = 240;

        if (isHorizontal) {
            const nextX = Math.min(contentBounds.minX - axisPadding, laneBounds?.minX ?? participantBounds.x);
            const nextWidth = Math.max(minAxisSize, contentBounds.width + axisPadding * 2);

            lanes.forEach((lane) => {
                const bounds = getElementBounds(lane);
                if (!bounds) return;
                if (Math.abs(bounds.x - nextX) > 0.5 || Math.abs(bounds.width - nextWidth) > 0.5) {
                    modeling.resizeShape(lane, { ...bounds, x: nextX, width: nextWidth });
                }
            });

            const updatedLaneBounds = collectBounds(lanes);
            const minY = updatedLaneBounds?.minY ?? Math.min(contentBounds.minY - outerPadding, participantBounds.y);
            const maxY =
                updatedLaneBounds?.maxY ?? Math.max(contentBounds.maxY + outerPadding, participantBounds.y + participantBounds.height);
            modeling.resizeShape(participant, {
                x: nextX - outerPadding,
                y: minY,
                width: nextWidth + outerPadding,
                height: maxY - minY
            });
        } else {
            const nextY = Math.min(contentBounds.minY - axisPadding, laneBounds?.minY ?? participantBounds.y);
            const nextHeight = Math.max(minAxisSize, contentBounds.height + axisPadding * 2);

            lanes.forEach((lane) => {
                const bounds = getElementBounds(lane);
                if (!bounds) return;
                if (Math.abs(bounds.y - nextY) > 0.5 || Math.abs(bounds.height - nextHeight) > 0.5) {
                    modeling.resizeShape(lane, { ...bounds, y: nextY, height: nextHeight });
                }
            });

            const updatedLaneBounds = collectBounds(lanes);
            const minX = updatedLaneBounds?.minX ?? Math.min(contentBounds.minX - outerPadding, participantBounds.x);
            const maxX =
                updatedLaneBounds?.maxX ?? Math.max(contentBounds.maxX + outerPadding, participantBounds.x + participantBounds.width);
            modeling.resizeShape(participant, {
                x: minX,
                y: nextY - outerPadding,
                width: maxX - minX,
                height: nextHeight + outerPadding
            });
        }
    });

    participants.forEach((participant) => {
        const isHorizontal = participant.di?.isHorizontal !== false;
        syncParticipantLaneOrientation(elementRegistry, participant, isHorizontal);
    });
};


// 함수 정의를 getPaletteEntries 바깥으로 옮긴다

})();

PaletteProvider.prototype.getPaletteEntries = function (element) {
    if (this._isViewMode) {
        return {};
    }
    let me = this;
    var actions = {},
        create = this._create,
        elementFactory = this._elementFactory,
        spaceTool = this._spaceTool,
        lassoTool = this._lassoTool,
        handTool = this._handTool,
        globalConnect = this._globalConnect,
        translate = this._translate,
        commandStack = this._commandStack,
        isMac = this._isMac,
        eventBus = this._eventBus,
        modeling = this._modeling,
        injector = this._injector;

    function createAction(type, group, className, title, options) {
        function createListener(event) {
            var shape = elementFactory.createShape(assign({ type: type }, options));

            // if (options) {
            //   shape.businessObject.di.isExpanded = options.isExpanded;
            // }

            create.start(event, shape);
        }

        var shortType = type.replace(/^bpmn:/, '');
        var translatedShortType = i18n.global.t(`PaletteProvider.${shortType}`);

        return {
            group: group,
            className: className,
            title: title || translatedShortType,
            action: {
                dragstart: createListener,
                click: createListener
            }
        };
    }

    function createParticipant(event, collapsed, isHorizontal) {
        var participantShape = elementFactory.createParticipantShape({
            isHorizontal: isHorizontal,
            width: isHorizontal ? 450 : 300,
            height: isHorizontal ? 200 : 400
        });
        create.start(event, participantShape);
    }

    assign(actions, {
        undo: {
            group: 'tools',
            className: 'mdi mdi-undo-variant',
            title: isMac ? i18n.global.t('PaletteProvider.undoCmdZ') : i18n.global.t('PaletteProvider.undoCtrlZ'),
            action: {
                click: function (event) {
                    commandStack.undo();
                }
            }
        },
        redo: {
            group: 'tools',
            className: 'mdi mdi-redo-variant',
            title: isMac ? i18n.global.t('PaletteProvider.RedoCmdShiftZ') : i18n.global.t('PaletteProvider.RedoCtrlY'),
            action: {
                click: function (event) {
                    commandStack.redo();
                }
            }
        },
        'hand-tool': {
            group: 'tools',
            className: 'bpmn-icon-hand-tool',
            title: i18n.global.t('PaletteProvider.handTool'),
            action: {
                click: function (event) {
                    handTool.activateHand(event);
                }
            }
        },
        // 'custom-separator': {
        //   group: 'custom',
        //   separator: true
        // },
        'lasso-tool': {
            group: 'tools',
            className: 'bpmn-icon-lasso-tool',
            title: i18n.global.t('PaletteProvider.lassoTool'),
            action: {
                click: function (event) {
                    lassoTool.activateSelection(event);
                }
            }
        },
        'space-tool': {
            group: 'tools',
            className: 'bpmn-icon-space-tool',
            title: i18n.global.t('PaletteProvider.spaceTool'),
            action: {
                click: function (event) {
                    spaceTool.activateSelection(event);
                }
            }
        },
        'global-connect-tool': {
            group: 'tools',
            className: 'bpmn-icon-connection-multi',
            title: i18n.global.t('PaletteProvider.globalConnectTool'),
            action: {
                click: function (event) {
                    globalConnect.toggle(event);
                }
            }
        },
        // 'tool-separator': {
        //   group: 'tools',
        //   separator: true
        // },
        'create.start-event': createAction('bpmn:StartEvent', 'event', 'bpmn-icon-start-event-none'),
        'create.intermediate-event': createAction('bpmn:IntermediateThrowEvent', 'event', 'bpmn-icon-intermediate-event-none'),
        'create.end-event': createAction('bpmn:EndEvent', 'event', 'bpmn-icon-end-event-none'),
        'create.exclusive-gateway': createAction('bpmn:ExclusiveGateway', 'gateway', 'bpmn-icon-gateway-xor')
        // Task types are conditionally added based on palette settings
        // Check window.$paletteSettings for visible task types
    });

    // Add task types based on palette settings
    // var enabledTaskTypes = window.$enabledPaletteTaskTypes || [];
    // var visibleTaskTypes =
    //     enabledTaskTypes.length > 0
    //         ? enabledTaskTypes.map((t) => t.task_type)
    //         : window.$paletteSettings?.visibleTaskTypes || ['bpmn:UserTask'];
    var visibleTaskTypes = 'bpmn:UserTask';

    if (visibleTaskTypes.includes('bpmn:ManualTask')) {
        actions['create.manual-task'] = createAction(
            'bpmn:ManualTask',
            'activity',
            'bpmn-icon-task',
            i18n.global.t('PaletteProvider.ManualTask')
        );
    }

    if (visibleTaskTypes.includes('bpmn:ServiceTask')) {
        actions['create.service-task'] = createAction(
            'bpmn:ServiceTask',
            'activity',
            'bpmn-icon-service-task',
            i18n.global.t('PaletteProvider.ServiceTask')
        );
    }

    if (visibleTaskTypes.includes('bpmn:UserTask')) {
        actions['create.user-task'] = createAction(
            'bpmn:UserTask',
            'activity',
            'bpmn-icon-user-task',
            i18n.global.t('PaletteProvider.UserTask')
        );
    }

    if (visibleTaskTypes.includes('bpmn:ScriptTask')) {
        actions['create.script-task'] = createAction(
            'bpmn:ScriptTask',
            'activity',
            'bpmn-icon-script-task',
            i18n.global.t('PaletteProvider.ScriptTask')
        );
    }

    if (visibleTaskTypes.includes('bpmn:BusinessRuleTask')) {
        actions['create.business-rule-task'] = createAction(
            'bpmn:BusinessRuleTask',
            'activity',
            'bpmn-icon-business-rule-task',
            i18n.global.t('PaletteProvider.BusinessRuleTask')
        );
    }

    if (visibleTaskTypes.includes('bpmn:SendTask')) {
        actions['create.send-task'] = createAction(
            'bpmn:SendTask',
            'activity',
            'bpmn-icon-send-task',
            i18n.global.t('PaletteProvider.SendTask')
        );
    }

    if (visibleTaskTypes.includes('bpmn:ReceiveTask')) {
        actions['create.receive-task'] = createAction(
            'bpmn:ReceiveTask',
            'activity',
            'bpmn-icon-receive-task',
            i18n.global.t('PaletteProvider.ReceiveTask')
        );
    }

    assign(actions, {
        'create.subprocess-expanded': createAction(
            'bpmn:SubProcess',
            'activity',
            'bpmn-icon-subprocess-expanded',
            i18n.global.t('PaletteProvider.expandedSubProcess'),
            { isExpanded: true }
        ),
        'create.data-store': createAction(
            'bpmn:DataStoreReference',
            'data-object',
            'bpmn-icon-data-store',
            i18n.global.t('PaletteProvider.dataStore')
        ),
        'create.data-object': createAction(
            'bpmn:DataObjectReference',
            'data-object',
            'bpmn-icon-data-object',
            i18n.global.t('PaletteProvider.dataObject')
        ),
        'create.participant-expanded': {
            group: 'collaboration',
            className: 'bpmn-icon-participant',
            title: i18n.global.t('PaletteProvider.participantCollapsed'),
            action: {
                dragstart: function (event) {
                    createParticipant(event, false, true);
                },
                click: function (event) {
                    createParticipant(event, false, true);
                }
            }
        },
        'create.participant-collapsed': {
            group: 'collaboration',
            className: 'bpmn-icon-participant icon-rotate-90',
            title: i18n.global.t('PaletteProvider.participantExpanded'),
            action: {
                dragstart: function (event) {
                    createParticipant(event, true, false);
                },
                click: function (event) {
                    createParticipant(event, true, false);
                }
            }
        },
        'auto-layout': {
            group: 'collaboration',
            className: 'mdi mdi-auto-fix',
            title: i18n.global.t('PaletteProvider.autoLayout'),
            action: {
                click: function (event) {
                    me.applyAutoLayout();
                }
            }
        },
        'revert-layout': {
            group: 'collaboration',
            className: 'mdi mdi-restore',
            title: i18n.global.t('PaletteProvider.revertLayout') || 'Revert Layout',
            action: {
                click: function (event) {
                    me.revertLayout();
                }
            }
        },
    'change-orientation': {
      group: 'collaboration',
      className: 'mdi mdi-crop-rotate',
      title: i18n.global.t('PaletteProvider.changeOrientation'),
      action: {
        click: function(event) {
          const bpmnJS = injector;
          const elementRegistry = bpmnJS.get('elementRegistry');
          const participant = elementRegistry.filter(element => element.type === 'bpmn:Participant');
          const atomicModeling = bpmnJS.get('atomicModeling');
          atomicModeling.execute(() => {
            participant.forEach(element => {
              const horizontal = isParticipantRenderedHorizontal(element);
              if (horizontal) {
                me.changeParticipantHorizontalToVertical(event, element);
              } else {
                me.changeParticipantVerticalToHorizontal(event, element);
              }
            });
          });
        }
      }
    }
    
  });

  return actions;
};
