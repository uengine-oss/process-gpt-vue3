import { assign } from 'min-dash';
import { i18n } from '@/main';
import '@/components/autoLayout/graph-algorithm.js';
import '@/components/autoLayout/enhancedSugiyamaLayout.js';
import '@/components/autoLayout/bpmn-auto-layout.js';

export default function PaletteProvider(
    palette,
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
    viewModeFlag
) {
    this._create = create;
    this._elementFactory = elementFactory;
    this._spaceTool = spaceTool;
    this._lassoTool = lassoTool;
    this._handTool = handTool;
    this._globalConnect = globalConnect;
    this._translate = translate;
    this._commandStack = commandStack;
    this._isMac = /mac/i.test(navigator.platform);
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

// 회전/스케일 관련 상수
const ROTATION_SCALE_FIX = 1 / 0.96; // 가로→세로 전환 시 레이아웃 깨짐 보정용 스케일
const LANE_WIDTH_SCALE = 0.8; // lane 폭 스케일
const LANE_HEIGHT_SCALE = 1.2; // lane 높이 스케일
const LANE_BODY_PADDING = 36;

// BoundaryEvent(Attacher) 회전 방향 상수
const ATTACHER_ROTATION = {
    horizontalToVertical: 'clockwise',
    verticalToHorizontal: 'counter-clockwise'
};

PaletteProvider.prototype.rotateAndSnapAttacher = function (attacher, taskBounds, newTaskBounds, direction = 'clockwise') {
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
};

PaletteProvider.prototype.adjustParticipantBoundsByLanes = function (participant, lanes, isHorizontal) {
    var modeling = this._modeling;
    if (!lanes.length) return;
    const paddingX = isHorizontal ? 30 : 0;
    const paddingY = isHorizontal ? 0 : 30;

    const minX = Math.min(...lanes.map((l) => l.di.bounds.x));
    const maxX = Math.max(...lanes.map((l) => l.di.bounds.x + l.di.bounds.width));
    const minY = Math.min(...lanes.map((l) => l.di.bounds.y));
    const maxY = Math.max(...lanes.map((l) => l.di.bounds.y + l.di.bounds.height));

    const newWidth = maxX - minX;
    const newHeight = maxY - minY;

    const currentBounds = participant.di.bounds;

    modeling.resizeShape(participant, {
        x: currentBounds.x - paddingX,
        y: currentBounds.y - paddingY,
        width: newWidth + paddingX,
        height: newHeight + paddingY
    });

    modeling.updateProperties(participant, {
        di: { isHorizontal }
    });
};

PaletteProvider.prototype.applyAutoLayout = function (onLoadStart = () => { }, onLoadEnd = () => { }) {
    var injector = this._injector;
    var elementFactory = this._elementFactory;
    var eventBus = this._eventBus;

    try {
        if (!window.BpmnAutoLayout) {
            console.error('BpmnAutoLayout 이 존재하지 않습니다.');
            return;
        }

        setTimeout(() => {
            try {
                const bpmnJS = injector;
                const elementRegistry = bpmnJS.get('elementRegistry');
                const participant = elementRegistry.filter((element) => element.type === 'bpmn:Participant');
                const horizontal = participant[0].di.isHorizontal;
                window.BpmnAutoLayout.applyAutoLayout(bpmnJS, { horizontal: horizontal }, onLoadStart, onLoadEnd);

                const canvas = elementFactory._canvas;
                if (canvas && canvas.zoom) {
                    canvas.zoom('fit-viewport');
                }

                eventBus.fire('autoLayout.complete');
            } catch (error) {
                console.error('자동레이아웃에 실패했습니다.', error);
            }
        }, 50);
    } catch (error) {
        console.error('자동레이아웃에 실패했습니다.', error);
    }
};

/**
 * Revert to the previous layout (before auto layout was applied)
 */
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
  const center = isHorizontal
    ? bounds.y + bounds.height / 2
    : bounds.x + bounds.width / 2;
  const laneStart = isHorizontal ? laneBounds.y : laneBounds.x;
  const laneEnd = laneStart + (isHorizontal ? laneBounds.height : laneBounds.width);
  return center >= laneStart - 1 && center <= laneEnd + 1;
}

function hasMovingAncestor(element, movingIds) {
  let current = element && element.parent;
  while (current) {
    if (movingIds.has(current.id)) return true;
    current = current.parent;
  }
  return false;
}

function getLaneContentBounds(elementRegistry, lane, isHorizontal) {
  if (!elementRegistry || !lane) return null;
  const laneBounds = getElementBounds(lane);
  if (!laneBounds) return null;

  const children = elementRegistry.getAll().filter(element => {
    const bounds = getElementBounds(element);
    return element &&
      element.id !== lane.id &&
      !element.labelTarget &&
      element.type !== 'bpmn:SequenceFlow' &&
      element.type !== 'bpmn:MessageFlow' &&
      element.type !== 'bpmn:Lane' &&
      element.type !== 'bpmn:LaneSet' &&
      element.type !== 'bpmn:Participant' &&
      element.type !== 'bpmn:SubProcess' &&
      element.type !== 'bpmn:CallActivity' &&
      bounds &&
      (
        element.parent && element.parent.id === lane.id ||
        isBoundsInLane(bounds, laneBounds, isHorizontal)
      );
  });

  if (!children.length) return null;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  children.forEach(child => {
    const bounds = getElementBounds(child);
    minX = Math.min(minX, bounds.x);
    maxX = Math.max(maxX, bounds.x + bounds.width);
    minY = Math.min(minY, bounds.y);
    maxY = Math.max(maxY, bounds.y + bounds.height);
  });

  if (!isFinite(minX) || !isFinite(maxX) || !isFinite(minY) || !isFinite(maxY)) return null;
  return { minX, maxX, minY, maxY };
}

function getLaneTopLevelContent(elementRegistry, lane, laneBounds, isHorizontal) {
  if (!elementRegistry || !lane || !laneBounds) return [];

  const moving = elementRegistry.getAll().filter(element => {
    const bounds = getElementBounds(element);
    return element &&
      element.id !== lane.id &&
      !element.labelTarget &&
      element.type !== 'bpmn:SequenceFlow' &&
      element.type !== 'bpmn:MessageFlow' &&
      element.type !== 'bpmn:Lane' &&
      element.type !== 'bpmn:LaneSet' &&
      element.type !== 'bpmn:Participant' &&
      bounds &&
      (
        element.parent && element.parent.id === lane.id ||
        isBoundsInLane(bounds, laneBounds, isHorizontal)
      );
  });

  const movingIds = new Set(moving.map(element => element.id));
  return moving.filter(element => !hasMovingAncestor(element, movingIds));
}

function compactLanesAfterRotation(modeling, elementRegistry, participant, lanes, isHorizontal) {
  if (!modeling || !elementRegistry || !participant || !lanes || !lanes.length) return;

  const laneEntries = lanes
    .map(lane => ({ lane, bounds: getElementBounds(lane) }))
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
        ? firstContentBounds.minY - (firstEntry.bounds.y + LANE_BODY_PADDING)
        : firstContentBounds.minX - (firstEntry.bounds.x + LANE_BODY_PADDING)
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

    return { lane: entry.lane, oldBounds: laneBounds, newBounds: shiftedBounds, delta, movingContent };
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
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  });
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
  return element &&
    !element.labelTarget &&
    element.type !== 'bpmn:SequenceFlow' &&
    element.type !== 'bpmn:MessageFlow' &&
    element.type !== 'bpmn:Collaboration' &&
    element.type !== 'bpmn:Process' &&
    element.type !== 'bpmn:Participant' &&
    element.type !== 'bpmn:Lane' &&
    element.type !== 'bpmn:LaneSet';
}

function collectBounds(elements) {
  const valid = elements
    .map(getElementBounds)
    .filter(bounds =>
      bounds &&
      Number.isFinite(bounds.x) &&
      Number.isFinite(bounds.y) &&
      Number.isFinite(bounds.width) &&
      Number.isFinite(bounds.height)
    );

  if (!valid.length) return null;

  const minX = Math.min(...valid.map(bounds => bounds.x));
  const minY = Math.min(...valid.map(bounds => bounds.y));
  const maxX = Math.max(...valid.map(bounds => bounds.x + bounds.width));
  const maxY = Math.max(...valid.map(bounds => bounds.y + bounds.height));

  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

function getSequenceFlowEndpoint(flow, endpoint) {
  const businessObject = flow && flow.businessObject;
  const ref = endpoint === 'source'
    ? businessObject?.sourceRef || flow.source
    : businessObject?.targetRef || flow.target;

  return ref && ref.id ? ref.id : null;
}

function isBoundsOverlapping(bounds, containerBounds) {
  if (!bounds || !containerBounds) return false;

  return bounds.x < containerBounds.x + containerBounds.width &&
    bounds.x + bounds.width > containerBounds.x &&
    bounds.y < containerBounds.y + containerBounds.height &&
    bounds.y + bounds.height > containerBounds.y;
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
  (laneSets || []).forEach(laneSet => {
    (laneSet.lanes || []).forEach(lane => {
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
  const participants = elementRegistry.filter(element => element.type === 'bpmn:Participant');
  const shouldSyncAllLanes = participants.length === 1;
  const lanes = elementRegistry.filter(element =>
    element.type === 'bpmn:Lane' &&
    (
      shouldSyncAllLanes ||
      processLaneIds.has(element.id) ||
      isElementDescendantOf(element, participant) ||
      isBoundsOverlapping(getElementBounds(element), participantBounds)
    )
  );

  lanes.forEach(lane => setDiagramHorizontal(lane, isHorizontal));
}

function collectParticipantRotationElements(elementRegistry, participant, lanes, participantBounds, isHorizontal) {
  if (!elementRegistry || !participant || !participantBounds) {
    return { shapes: [], sequenceFlows: [] };
  }

  const laneBoundsList = (lanes || []).map(getElementBounds).filter(Boolean);
  const isInsideRotatingArea = element => {
    const bounds = getElementBounds(element);
    return isElementDescendantOf(element, participant) ||
      isBoundsInLane(bounds, participantBounds, isHorizontal) ||
      laneBoundsList.some(laneBounds => isBoundsInLane(bounds, laneBounds, isHorizontal)) ||
      isBoundsOverlapping(bounds, participantBounds);
  };

  const shapes = elementRegistry.getAll().filter(element =>
    isRealDiagramShape(element) &&
    element.type !== 'bpmn:BoundaryEvent' &&
    isInsideRotatingArea(element)
  );
  const shapeIds = new Set(shapes.map(element => element.id));

  const sequenceFlows = elementRegistry.filter(element => {
    if (!element || element.type !== 'bpmn:SequenceFlow') return false;
    const sourceId = getSequenceFlowEndpoint(element, 'source');
    const targetId = getSequenceFlowEndpoint(element, 'target');
    const source = sourceId ? elementRegistry.get(sourceId) : null;
    const target = targetId ? elementRegistry.get(targetId) : null;
    return (
      (sourceId && shapeIds.has(sourceId)) ||
      (targetId && shapeIds.has(targetId)) ||
      (source && isInsideRotatingArea(source) && target && isInsideRotatingArea(target))
    );
  });

  return { shapes, sequenceFlows };
}

PaletteProvider.prototype.syncAllLaneOrientationForView = function (isHorizontal) {
  const elementRegistry = this._injector && this._injector.get('elementRegistry');
  if (!elementRegistry) return;

  elementRegistry.filter(element =>
    element.type === 'bpmn:Participant' ||
    element.type === 'bpmn:Lane'
  ).forEach(element => setDiagramHorizontal(element, isHorizontal));
};

PaletteProvider.prototype.normalizeDiagramBoundsForView = function () {
  if (!this._isViewMode) return;

  const modeling = this._modeling;
  const elementRegistry = this._injector && this._injector.get('elementRegistry');
  if (!modeling || !elementRegistry) return;

  const participants = elementRegistry.filter(element => element.type === 'bpmn:Participant');
  participants.forEach(participant => {
    const participantBounds = getElementBounds(participant);
    if (!participantBounds) return;

    const isHorizontal = participant.di?.isHorizontal !== false;
    const lanes = elementRegistry.filter(element =>
      element.type === 'bpmn:Lane' &&
      (
        isElementDescendantOf(element, participant) ||
        isBoundsInLane(getElementBounds(element), participantBounds, isHorizontal)
      )
    );
    const content = elementRegistry.filter(element =>
      isRealDiagramShape(element) &&
      (
        isElementDescendantOf(element, participant) ||
        isBoundsInLane(getElementBounds(element), participantBounds, isHorizontal)
      )
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

      lanes.forEach(lane => {
        const bounds = getElementBounds(lane);
        if (!bounds) return;
        if (Math.abs(bounds.x - nextX) > 0.5 || Math.abs(bounds.width - nextWidth) > 0.5) {
          modeling.resizeShape(lane, { ...bounds, x: nextX, width: nextWidth });
        }
      });

      const updatedLaneBounds = collectBounds(lanes);
      const minY = updatedLaneBounds?.minY ?? Math.min(contentBounds.minY - outerPadding, participantBounds.y);
      const maxY = updatedLaneBounds?.maxY ?? Math.max(contentBounds.maxY + outerPadding, participantBounds.y + participantBounds.height);
      modeling.resizeShape(participant, {
        x: nextX - outerPadding,
        y: minY,
        width: nextWidth + outerPadding,
        height: maxY - minY
      });
    } else {
      const nextY = Math.min(contentBounds.minY - axisPadding, laneBounds?.minY ?? participantBounds.y);
      const nextHeight = Math.max(minAxisSize, contentBounds.height + axisPadding * 2);

      lanes.forEach(lane => {
        const bounds = getElementBounds(lane);
        if (!bounds) return;
        if (Math.abs(bounds.y - nextY) > 0.5 || Math.abs(bounds.height - nextHeight) > 0.5) {
          modeling.resizeShape(lane, { ...bounds, y: nextY, height: nextHeight });
        }
      });

      const updatedLaneBounds = collectBounds(lanes);
      const minX = updatedLaneBounds?.minX ?? Math.min(contentBounds.minX - outerPadding, participantBounds.x);
      const maxX = updatedLaneBounds?.maxX ?? Math.max(contentBounds.maxX + outerPadding, participantBounds.x + participantBounds.width);
      modeling.resizeShape(participant, {
        x: minX,
        y: nextY - outerPadding,
        width: maxX - minX,
        height: nextHeight + outerPadding
      });
    }
  });

  participants.forEach(participant => {
    const isHorizontal = participant.di?.isHorizontal !== false;
    syncParticipantLaneOrientation(elementRegistry, participant, isHorizontal);
  });
};

PaletteProvider.prototype._rotateRelativePosition = function (relativeX, relativeY, scaleX, scaleY) {
    return {
        x: relativeY * scaleY,
        y: relativeX * scaleX
    };
};

// 함수 정의를 getPaletteEntries 바깥으로 옮긴다
PaletteProvider.prototype.changeParticipantHorizontalToVertical = function (event, element, onLoadStart = () => { }, onLoadEnd = () => { }, options = {}) {
    onLoadStart();
    const modeling = this._modeling;
    const logPrefix = '[changeParticipantOrientation]';

    try {
        if (element.type !== 'bpmn:Participant') {
            console.warn(`${logPrefix} participant가 아닙니다.`);
            onLoadEnd();
            return;
        }

        const childElements = element.children || [];
        let isSubprocessImported = false;
        // 서브프로세스가 있으면 깨지는 문제가 있어 서브프로세스가 있을 경우에는 임시 비활성화
        childElements.forEach((child) => {
            if (child.type === 'bpmn:SubProcess') {
                isSubprocessImported = true;
            }
        });
        if (isSubprocessImported) {
            onLoadEnd();
            return;
        }
        const lanes = childElements.filter((el) => el.type === 'bpmn:Lane').sort((a, b) => a.di.bounds.y - b.di.bounds.y);

        if (!lanes.length) {
            console.warn(`${logPrefix} lane 이 없어 회전을 수행할 수 없습니다.`);
            onLoadEnd();
            return;
        }

        // ✅ 회전 전에 lane 전체를 감싸는 oldParticipantBounds 생성
        const oldMinX = Math.min(...lanes.map((lane) => lane.di.bounds.x));
        const oldMaxX = Math.max(...lanes.map((lane) => lane.di.bounds.x + lane.di.bounds.width));
        const oldMinY = Math.min(...lanes.map((lane) => lane.di.bounds.y));
        const oldMaxY = Math.max(...lanes.map((lane) => lane.di.bounds.y + lane.di.bounds.height));

        const oldParticipantBounds = {
            x: oldMinX,
            y: oldMinY,
            width: oldMaxX - oldMinX,
            height: oldMaxY - oldMinY
        };
        const elementRegistry = this._injector && this._injector.get('elementRegistry');
        const rotationElements = collectParticipantRotationElements(elementRegistry, element, lanes, oldParticipantBounds, true);
        const childElementIds = new Set(childElements.map((child) => child.id));
        [...rotationElements.shapes, ...rotationElements.sequenceFlows].forEach((child) => {
            if (child && !childElementIds.has(child.id)) {
                childElements.push(child);
                childElementIds.add(child.id);
            }
        });

        // 💡 lane 회전 전 bounds 저장 → 회전 후 bounds 계산에 사용
        const laneNewBoundsMap = new Map();
        let currentX = oldParticipantBounds.x;
        const currentY = oldParticipantBounds.y;

        lanes.forEach((lane) => {
            const oldLaneBounds = lane.di.bounds;

            const laneWidth = oldLaneBounds.width * LANE_WIDTH_SCALE * ROTATION_SCALE_FIX;
            const laneHeight = oldLaneBounds.height * LANE_HEIGHT_SCALE * ROTATION_SCALE_FIX;

            const newLaneBounds = {
                x: currentX,
                y: currentY,
                width: laneHeight,
                height: laneWidth
            };

            currentX += laneHeight;

            modeling.resizeShape(lane, newLaneBounds);
            setDiagramHorizontal(lane, false);
            modeling.updateProperties(lane, {
                di: { isHorizontal: false }
            });

            laneNewBoundsMap.set(lane.id, newLaneBounds);
        });

        // ✅ lane 회전 이후 기준으로 participant bounds 계산
        const laneBoundsList = Array.from(laneNewBoundsMap.values());

        const minX = Math.min(...laneBoundsList.map((b) => b.x));
        const maxX = Math.max(...laneBoundsList.map((b) => b.x + b.width));
        const minY = Math.min(...laneBoundsList.map((b) => b.y));
        const maxY = Math.max(...laneBoundsList.map((b) => b.y + b.height));

        const newParticipantBounds = {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY
        };

        modeling.resizeShape(element, newParticipantBounds);
        setDiagramHorizontal(element, false);
        modeling.updateProperties(element, {
            di: { isHorizontal: false }
        });

        // 🧭 SequenceFlow waypoint 보정
        const originalSequenceFlows = childElements.filter((child) => child.type === 'bpmn:SequenceFlow');
        const originalWaypoints = {};

        originalSequenceFlows.forEach((sequenceFlow) => {
            const waypoints = sequenceFlow.waypoints;
            const newWaypoints = [];

            waypoints.forEach((waypoint) => {
                const waypointX = newParticipantBounds.y + (waypoint.x - oldParticipantBounds.x) * LANE_WIDTH_SCALE * ROTATION_SCALE_FIX;
                const waypointY = newParticipantBounds.x + (waypoint.y - oldParticipantBounds.y) * LANE_HEIGHT_SCALE * ROTATION_SCALE_FIX;

                const newWaypoint = { x: waypointY, y: waypointX };

                if (waypoint.original) {
                    newWaypoint.original = { x: waypoint.original.x, y: waypoint.original.y };
                }

                newWaypoints.push(newWaypoint);
            });

            originalWaypoints[sequenceFlow.id] = newWaypoints;
        });

        let rotatedLabelBounds = [];
        childElements.forEach((child) => {
            if (child.type === 'bpmn:SequenceFlow') {
                const label = child.labels && child.labels[0];
                if (label && label.di && label.di.label) {
                    const labelBounds = label.di.label.bounds;
                    if (!labelBounds || typeof labelBounds.x !== 'number' || typeof labelBounds.y !== 'number') {
                        return;
                    }

                    const originalCenterX = labelBounds.x + labelBounds.width / 2;
                    const originalCenterY = labelBounds.y + labelBounds.height / 2;

                    const relativeX = originalCenterX - oldParticipantBounds.x;
                    const relativeY = originalCenterY - oldParticipantBounds.y;

                    const scaleX = LANE_WIDTH_SCALE * ROTATION_SCALE_FIX;
                    const scaleY = LANE_HEIGHT_SCALE * ROTATION_SCALE_FIX;
                    const rotated = this._rotateRelativePosition(relativeX, relativeY, scaleX, scaleY);

                    const newLabelBounds = {
                        x: newParticipantBounds.x + rotated.x - labelBounds.width / 2,
                        y: newParticipantBounds.y + rotated.y - labelBounds.height / 2,
                        width: labelBounds.width,
                        height: labelBounds.height
                    };
                    rotatedLabelBounds.push({ label, bounds: newLabelBounds });
                }
            }
        });

        // 🧭 기타 노드 위치 보정
        childElements.forEach((child) => {
            if (child.type !== 'bpmn:Lane' && child.type !== 'bpmn:LaneSet' && child.type !== 'bpmn:Participant') {
                if (child.type !== 'bpmn:SequenceFlow' && child.type !== 'bpmn:BoundaryEvent') {
                    const oldChildBounds = { ...child.di.bounds };
                    const originalCenterX = oldChildBounds.x + oldChildBounds.width / 2;
                    const originalCenterY = oldChildBounds.y + oldChildBounds.height / 2;

                    const relativeX = originalCenterX - oldParticipantBounds.x;
                    const relativeY = originalCenterY - oldParticipantBounds.y;

                    const scaleX = LANE_WIDTH_SCALE * ROTATION_SCALE_FIX;
                    const scaleY = LANE_HEIGHT_SCALE * ROTATION_SCALE_FIX;
                    const rotated = this._rotateRelativePosition(relativeX, relativeY, scaleX, scaleY);

                    const newChildBounds = {
                        x: newParticipantBounds.x + rotated.x - oldChildBounds.width / 2,
                        y: newParticipantBounds.y + rotated.y - oldChildBounds.height / 2,
                        width: oldChildBounds.width,
                        height: oldChildBounds.height
                    };

                    modeling.resizeShape(child, newChildBounds);

                    if (child.attachers && child.attachers.length > 0) {
                        child.attachers.forEach((attacher) => {
                            const newBounds = this.rotateAndSnapAttacher(
                                attacher,
                                oldChildBounds,
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

            rotatedLabelBounds.forEach((label) => {
                modeling.resizeShape(label.label, label.bounds);
            });
        });

        this.adjustParticipantBoundsByLanes(element, lanes, false);
        if (!options.skipAutoLayout) {
            compactLanesAfterRotation(modeling, elementRegistry, element, lanes, false);
        }
        syncParticipantLaneOrientation(elementRegistry, element, false);

        // 💡 SequenceFlow 최종 waypoint 반영
        originalSequenceFlows.forEach((sequenceFlow) => {
            sequenceFlow.waypoints = originalWaypoints[sequenceFlow.id];
            modeling.updateProperties(sequenceFlow, {
                waypoints: originalWaypoints[sequenceFlow.id]
            });
        });

        if (options.skipAutoLayout) {
            onLoadEnd();
            return;
        }
        this.applyAutoLayout((onLoadEnd = onLoadEnd));
    } catch (error) {
        console.error(`${logPrefix} 회전 중 오류가 발생했습니다.`, error);
        onLoadEnd();
    }
};

PaletteProvider.prototype.changeParticipantVerticalToHorizontal = function (event, element, onLoadStart = () => { }, onLoadEnd = () => { }, options = {}) {
    onLoadStart();
    const modeling = this._modeling;
    const logPrefix = '[changeParticipantOrientation]';
    try {
        if (element.type !== 'bpmn:Participant') {
            console.warn(`${logPrefix} participant가 아닙니다.`);
            onLoadEnd();
            return;
        }

        const childElements = element.children || [];
        let isSubprocessImported = false;
        // 서브프로세스가 있으면 깨지는 문제가 있어 서브프로세스가 있을 경우에는 임시 비활성화
        childElements.forEach((child) => {
            if (child.type === 'bpmn:SubProcess') {
                isSubprocessImported = true;
            }
        });
        if (isSubprocessImported) {
            alert('서브프로세스가 포함된 프로세스는 가로/세로 회전을 지원하지 않습니다.');
            onLoadEnd();
            return;
        }
        const lanes = childElements.filter((el) => el.type === 'bpmn:Lane').sort((a, b) => a.di.bounds.x - b.di.bounds.x);

        if (!lanes.length) {
            console.warn(`${logPrefix} lane 이 없어 회전을 수행할 수 없습니다.`);
            onLoadEnd();
            return;
        }

        // ✅ 회전 전 lane 기준으로 oldParticipantBounds 생성
        const oldMinX = Math.min(...lanes.map((lane) => lane.di.bounds.x));
        const oldMaxX = Math.max(...lanes.map((lane) => lane.di.bounds.x + lane.di.bounds.width));
        const oldMinY = Math.min(...lanes.map((lane) => lane.di.bounds.y));
        const oldMaxY = Math.max(...lanes.map((lane) => lane.di.bounds.y + lane.di.bounds.height));

        const oldParticipantBounds = {
            x: oldMinX,
            y: oldMinY,
            width: oldMaxX - oldMinX,
            height: oldMaxY - oldMinY
        };
        const elementRegistry = this._injector && this._injector.get('elementRegistry');
        const rotationElements = collectParticipantRotationElements(elementRegistry, element, lanes, oldParticipantBounds, false);
        const childElementIds = new Set(childElements.map((child) => child.id));
        [...rotationElements.shapes, ...rotationElements.sequenceFlows].forEach((child) => {
            if (child && !childElementIds.has(child.id)) {
                childElements.push(child);
                childElementIds.add(child.id);
            }
        });

        // 💡 lane 회전 전 bounds 저장 → 회전 후 bounds 계산에 사용
        const laneNewBoundsMap = new Map();
        let currentY = oldParticipantBounds.y;
        const currentX = oldParticipantBounds.x;

        lanes.forEach((lane) => {
            const oldLaneBounds = lane.di.bounds;

            const laneWidth = oldLaneBounds.width * LANE_WIDTH_SCALE; // Scale Fix 없음
            const laneHeight = oldLaneBounds.height * LANE_HEIGHT_SCALE; // Scale Fix 없음

            const newLaneBounds = {
                x: currentX,
                y: currentY,
                width: laneHeight,
                height: laneWidth
            };

            currentY += laneWidth;

            modeling.resizeShape(lane, newLaneBounds);
            setDiagramHorizontal(lane, true);
            modeling.updateProperties(lane, {
                di: { isHorizontal: true }
            });

            laneNewBoundsMap.set(lane.id, newLaneBounds);
        });

        // ✅ lane 회전 이후 기준으로 participant bounds 계산
        const laneBoundsList = Array.from(laneNewBoundsMap.values());

        const minX = Math.min(...laneBoundsList.map((b) => b.x));
        const maxX = Math.max(...laneBoundsList.map((b) => b.x + b.width));
        const minY = Math.min(...laneBoundsList.map((b) => b.y));
        const maxY = Math.max(...laneBoundsList.map((b) => b.y + b.height));

        const newParticipantBounds = {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY
        };

        modeling.resizeShape(element, newParticipantBounds);
        setDiagramHorizontal(element, true);
        modeling.updateProperties(element, {
            di: { isHorizontal: true }
        });

        // 🧭 SequenceFlow waypoint 보정
        const originalSequenceFlows = childElements.filter((child) => child.type === 'bpmn:SequenceFlow');
        const originalWaypoints = {};

        originalSequenceFlows.forEach((sequenceFlow) => {
            const waypoints = sequenceFlow.waypoints;
            const newWaypoints = [];

            waypoints.forEach((waypoint) => {
                const waypointX = newParticipantBounds.y + (waypoint.x - oldParticipantBounds.x) * LANE_WIDTH_SCALE;
                const waypointY = newParticipantBounds.x + (waypoint.y - oldParticipantBounds.y) * LANE_HEIGHT_SCALE;

                const newWaypoint = { x: waypointY, y: waypointX };

                if (waypoint.original) {
                    newWaypoint.original = { x: waypoint.original.x, y: waypoint.original.y };
                }

                newWaypoints.push(newWaypoint);
            });

            originalWaypoints[sequenceFlow.id] = newWaypoints;
        });

        let rotatedLabelBounds = [];

        childElements.forEach((child) => {
            if (child.type === 'bpmn:SequenceFlow') {
                const label = child.labels && child.labels[0];
                if (label && label.di && label.di.label) {
                    const labelBounds = label.di.label.bounds;
                    if (!labelBounds || typeof labelBounds.x !== 'number' || typeof labelBounds.y !== 'number') {
                        return;
                    }

                    const originalCenterX = labelBounds.x + labelBounds.width / 2;
                    const originalCenterY = labelBounds.y + labelBounds.height / 2;

                    const relativeX = originalCenterX - oldParticipantBounds.x;
                    const relativeY = originalCenterY - oldParticipantBounds.y;

                    const scaleX = LANE_WIDTH_SCALE;
                    const scaleY = LANE_HEIGHT_SCALE;
                    const rotated = this._rotateRelativePosition(relativeX, relativeY, scaleX, scaleY);

                    const newLabelBounds = {
                        x: newParticipantBounds.x + rotated.x - labelBounds.width / 2,
                        y: newParticipantBounds.y + rotated.y - labelBounds.height / 2,
                        width: labelBounds.width,
                        height: labelBounds.height
                    };
                    rotatedLabelBounds.push({ label, bounds: newLabelBounds });
                }
            }
        });

        // 🧭 기타 노드 보정
        childElements.forEach((child) => {
            if (child.type !== 'bpmn:Lane' && child.type !== 'bpmn:LaneSet' && child.type !== 'bpmn:Participant') {
                if (child.type !== 'bpmn:SequenceFlow' && child.type !== 'bpmn:BoundaryEvent') {
                    const oldChildBounds = { ...child.di.bounds };
                    const originalCenterX = oldChildBounds.x + oldChildBounds.width / 2;
                    const originalCenterY = oldChildBounds.y + oldChildBounds.height / 2;

                    const relativeX = originalCenterX - oldParticipantBounds.x;
                    const relativeY = originalCenterY - oldParticipantBounds.y;

                    const scaleX = LANE_WIDTH_SCALE;
                    const scaleY = LANE_HEIGHT_SCALE;
                    const rotated = this._rotateRelativePosition(relativeX, relativeY, scaleX, scaleY);

                    const newChildBounds = {
                        x: newParticipantBounds.x + rotated.x - oldChildBounds.width / 2,
                        y: newParticipantBounds.y + rotated.y - oldChildBounds.height / 2,
                        width: oldChildBounds.width,
                        height: oldChildBounds.height
                    };

                    modeling.resizeShape(child, newChildBounds);

                    if (child.attachers && child.attachers.length > 0) {
                        child.attachers.forEach((attacher) => {
                            const newBounds = this.rotateAndSnapAttacher(
                                attacher,
                                oldChildBounds,
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

        this.adjustParticipantBoundsByLanes(element, lanes, true);
        if (!options.skipAutoLayout) {
            compactLanesAfterRotation(modeling, elementRegistry, element, lanes, true);
        }
        syncParticipantLaneOrientation(elementRegistry, element, true);

        // 💡 SequenceFlow 최종 waypoint 반영
        originalSequenceFlows.forEach((sequenceFlow) => {
            sequenceFlow.waypoints = originalWaypoints[sequenceFlow.id];
            modeling.updateProperties(sequenceFlow, {
                waypoints: originalWaypoints[sequenceFlow.id]
            });
        });

        rotatedLabelBounds.forEach((label) => {
            modeling.resizeShape(label.label, label.bounds);
        });

        if (options.skipAutoLayout) {
            onLoadEnd();
            return;
        }
        this.applyAutoLayout((onLoadEnd = onLoadEnd));
    } catch (error) {
        console.error(`${logPrefix} 회전 중 오류가 발생했습니다.`, error);
        onLoadEnd();
    }
};

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
                click: function (event) {
                    const bpmnJS = injector;
                    const elementRegistry = bpmnJS.get('elementRegistry');
                    const participant = elementRegistry.filter((element) => element.type === 'bpmn:Participant');
                    participant.forEach((element) => {
                        const horizontal = element.di.isHorizontal;
                        if (horizontal) {
                            me.changeParticipantHorizontalToVertical(event, element);
                        } else {
                            me.changeParticipantVerticalToHorizontal(event, element);
                        }
                    });
                }
            }
        }
    });

    return actions;
};
