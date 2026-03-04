import { assign } from 'min-dash';
import { i18n } from '@/main';
import '@/components/autoLayout/graph-algorithm.js';
import '@/components/autoLayout/enhancedSugiyamaLayout.js';
import '@/components/autoLayout/bpmn-auto-layout.js';

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

// 회전/스케일 관련 상수
const ROTATION_SCALE_FIX = 1 / 0.96;      // 가로→세로 전환 시 레이아웃 깨짐 보정용 스케일
const LANE_WIDTH_SCALE = 0.8;             // lane 폭 스케일
const LANE_HEIGHT_SCALE = 1.2;            // lane 높이 스케일

// BoundaryEvent(Attacher) 회전 방향 상수
const ATTACHER_ROTATION = {
  horizontalToVertical: 'clockwise',
  verticalToHorizontal: 'counter-clockwise'
};


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
  const paddingX = isHorizontal ? 30 : 0;
  const paddingY = isHorizontal ? 0 : 30;

  const minX = Math.min(...lanes.map(l => l.di.bounds.x));
  const maxX = Math.max(...lanes.map(l => l.di.bounds.x + l.di.bounds.width));
  const minY = Math.min(...lanes.map(l => l.di.bounds.y));
  const maxY = Math.max(...lanes.map(l => l.di.bounds.y + l.di.bounds.height));

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
}

PaletteProvider.prototype.applyAutoLayout = function(onLoadStart = () => {}, onLoadEnd = () => {}) {
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
              const participant = elementRegistry.filter(element => element.type === 'bpmn:Participant');
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
}

/**
 * Revert to the previous layout (before auto layout was applied)
 */
PaletteProvider.prototype.revertLayout = function() {
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
}

PaletteProvider.prototype._rotateRelativePosition = function(relativeX, relativeY, scaleX, scaleY) {
  return {
    x: relativeY * scaleY,
    y: relativeX * scaleX
  };
};

// 함수 정의를 getPaletteEntries 바깥으로 옮긴다
PaletteProvider.prototype.changeParticipantHorizontalToVertical = function(event, element, onLoadStart = () => {}, onLoadEnd = () => {}) {
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
    childElements.forEach(child => {
      if(child.type === "bpmn:SubProcess") {
        isSubprocessImported = true;
      }
    });
    if(isSubprocessImported) {
      onLoadEnd();
      return;
    }
    const lanes = childElements
      .filter(el => el.type === 'bpmn:Lane')
      .sort((a, b) => a.di.bounds.y - b.di.bounds.y);

    if (!lanes.length) {
      console.warn(`${logPrefix} lane 이 없어 회전을 수행할 수 없습니다.`);
      onLoadEnd();
      return;
    }

    // ✅ 회전 전에 lane 전체를 감싸는 oldParticipantBounds 생성
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

    // 💡 lane 회전 전 bounds 저장 → 회전 후 bounds 계산에 사용
    const laneNewBoundsMap = new Map();
    let currentX = oldParticipantBounds.x;
    const currentY = oldParticipantBounds.y;

    lanes.forEach(lane => {
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
      modeling.updateProperties(lane, {
        di: { isHorizontal: false }
      });

      laneNewBoundsMap.set(lane.id, newLaneBounds);
    });

    // ✅ lane 회전 이후 기준으로 participant bounds 계산
    const laneBoundsList = Array.from(laneNewBoundsMap.values());

    const minX = Math.min(...laneBoundsList.map(b => b.x));
    const maxX = Math.max(...laneBoundsList.map(b => b.x + b.width));
    const minY = Math.min(...laneBoundsList.map(b => b.y));
    const maxY = Math.max(...laneBoundsList.map(b => b.y + b.height));

    const newParticipantBounds = {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };

    modeling.resizeShape(element, newParticipantBounds);
    modeling.updateProperties(element, {
      di: { isHorizontal: false }
    });

    // 🧭 SequenceFlow waypoint 보정
    const originalSequenceFlows = childElements.filter(child => child.type === 'bpmn:SequenceFlow');
    const originalWaypoints = {};

    originalSequenceFlows.forEach(sequenceFlow => {
      const waypoints = sequenceFlow.waypoints;
      const newWaypoints = [];

      waypoints.forEach(waypoint => {
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
    childElements.forEach(child => {
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
            y: newParticipantBounds.y + rotated.y - (labelBounds.height / 2),
            width: labelBounds.width,
            height: labelBounds.height
          };
          rotatedLabelBounds.push({ label, bounds: newLabelBounds });
        }
      }
    });

    // 🧭 기타 노드 위치 보정
    childElements.forEach(child => {
      if (
        child.type !== 'bpmn:Lane' &&
        child.type !== 'bpmn:LaneSet' &&
        child.type !== 'bpmn:Participant'
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
            y: newParticipantBounds.y + rotated.y - (child.di.bounds.height / 2),
            width: child.di.bounds.width,
            height: child.di.bounds.height
          };

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
        modeling.resizeShape(label.label, label.bounds);
      });
    });

    this.adjustParticipantBoundsByLanes(element, lanes, false);

    // 💡 SequenceFlow 최종 waypoint 반영
    originalSequenceFlows.forEach(sequenceFlow => {
      sequenceFlow.waypoints = originalWaypoints[sequenceFlow.id];
      modeling.updateProperties(sequenceFlow, {
        waypoints: originalWaypoints[sequenceFlow.id]
      });
    });

    this.applyAutoLayout(onLoadEnd = onLoadEnd);
  } catch (error) {
    console.error(`${logPrefix} 회전 중 오류가 발생했습니다.`, error);
    onLoadEnd();
  }
};

PaletteProvider.prototype.changeParticipantVerticalToHorizontal = function(event, element, onLoadStart = () => {}, onLoadEnd = () => {}) {
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
    childElements.forEach(child => {
      if(child.type === "bpmn:SubProcess") {
        isSubprocessImported = true;
      }
    });
    if(isSubprocessImported) {
      alert('서브프로세스가 포함된 프로세스는 가로/세로 회전을 지원하지 않습니다.');
      onLoadEnd();
      return;
    }
    const lanes = childElements
      .filter(el => el.type === 'bpmn:Lane')
      .sort((a, b) => a.di.bounds.x - b.di.bounds.x);

    if (!lanes.length) {
      console.warn(`${logPrefix} lane 이 없어 회전을 수행할 수 없습니다.`);
      onLoadEnd();
      return;
    }

    // ✅ 회전 전 lane 기준으로 oldParticipantBounds 생성
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

    // 💡 lane 회전 전 bounds 저장 → 회전 후 bounds 계산에 사용
    const laneNewBoundsMap = new Map();
    let currentY = oldParticipantBounds.y;
    const currentX = oldParticipantBounds.x;

    lanes.forEach(lane => {
      const oldLaneBounds = lane.di.bounds;

      const laneWidth = oldLaneBounds.width * LANE_WIDTH_SCALE;   // Scale Fix 없음
      const laneHeight = oldLaneBounds.height * LANE_HEIGHT_SCALE; // Scale Fix 없음

      const newLaneBounds = {
        x: currentX,
        y: currentY,
        width: laneHeight,
        height: laneWidth
      };

      currentY += laneWidth;

      modeling.resizeShape(lane, newLaneBounds);
      modeling.updateProperties(lane, {
        di: { isHorizontal: true }
      });

      laneNewBoundsMap.set(lane.id, newLaneBounds);
    });

    // ✅ lane 회전 이후 기준으로 participant bounds 계산
    const laneBoundsList = Array.from(laneNewBoundsMap.values());

    const minX = Math.min(...laneBoundsList.map(b => b.x));
    const maxX = Math.max(...laneBoundsList.map(b => b.x + b.width));
    const minY = Math.min(...laneBoundsList.map(b => b.y));
    const maxY = Math.max(...laneBoundsList.map(b => b.y + b.height));

    const newParticipantBounds = {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };

    modeling.resizeShape(element, newParticipantBounds);
    modeling.updateProperties(element, {
      di: { isHorizontal: true }
    });

    // 🧭 SequenceFlow waypoint 보정
    const originalSequenceFlows = childElements.filter(child => child.type === 'bpmn:SequenceFlow');
    const originalWaypoints = {};

    originalSequenceFlows.forEach(sequenceFlow => {
      const waypoints = sequenceFlow.waypoints;
      const newWaypoints = [];

      waypoints.forEach(waypoint => {
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


    childElements.forEach(child => {
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
            x: newParticipantBounds.x + rotated.x - (labelBounds.width / 2),
            y: newParticipantBounds.y + rotated.y - (labelBounds.height / 2),
            width: labelBounds.width,
            height: labelBounds.height
          };
          rotatedLabelBounds.push({ label, bounds: newLabelBounds });
        }
      }
    });

    // 🧭 기타 노드 보정
    childElements.forEach(child => {
      if (
        child.type !== 'bpmn:Lane' &&
        child.type !== 'bpmn:LaneSet' &&
        child.type !== 'bpmn:Participant'
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
            x: newParticipantBounds.x + rotated.x - (child.di.bounds.width / 2),
            y: newParticipantBounds.y + rotated.y - (child.di.bounds.height / 2),
            width: child.di.bounds.width,
            height: child.di.bounds.height
          };

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

    this.adjustParticipantBoundsByLanes(element, lanes, true);

    // 💡 SequenceFlow 최종 waypoint 반영
    originalSequenceFlows.forEach(sequenceFlow => {
      sequenceFlow.waypoints = originalWaypoints[sequenceFlow.id];
      modeling.updateProperties(sequenceFlow, {
        waypoints: originalWaypoints[sequenceFlow.id]
      });
    });

    rotatedLabelBounds.forEach(label => {
      modeling.resizeShape(label.label, label.bounds);
    });

    this.applyAutoLayout(onLoadEnd = onLoadEnd);
  } catch (error) {
    console.error(`${logPrefix} 회전 중 오류가 발생했습니다.`, error);
    onLoadEnd();
  }
};


PaletteProvider.prototype.getPaletteEntries = function(element) {
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
    'undo': {
      group: 'tools',
      className: 'mdi mdi-undo-variant',
      title: isMac ? i18n.global.t('PaletteProvider.undoCmdZ') : i18n.global.t('PaletteProvider.undoCtrlZ'),
      action: {
        click: function(event) {
          commandStack.undo();
        }
      }
    },
    'redo': {
      group: 'tools',
      className: 'mdi mdi-redo-variant',
      title: isMac ? i18n.global.t('PaletteProvider.RedoCmdShiftZ') : i18n.global.t('PaletteProvider.RedoCtrlY'),
      action: {
        click: function(event) {
          commandStack.redo();
        }
      }
    },
    'hand-tool': {
      group: 'tools',
      className: 'bpmn-icon-hand-tool',
      title: i18n.global.t('PaletteProvider.handTool'),
      action: {
        click: function(event) {
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
        click: function(event) {
          lassoTool.activateSelection(event);
        }
      }
    },
    'space-tool': {
      group: 'tools',
      className: 'bpmn-icon-space-tool',
      title: i18n.global.t('PaletteProvider.spaceTool'),
      action: {
        click: function(event) {
          spaceTool.activateSelection(event);
        }
      }
    },
    'global-connect-tool': {
      group: 'tools',
      className: 'bpmn-icon-connection-multi',
      title: i18n.global.t('PaletteProvider.globalConnectTool'),
      action: {
        click: function(event) {
          globalConnect.toggle(event);
        }
      }
    },
    // 'tool-separator': {
    //   group: 'tools',
    //   separator: true
    // },
    'create.start-event': createAction(
      'bpmn:StartEvent', 'event', 'bpmn-icon-start-event-none'
    ),
    'create.intermediate-event': createAction(
      'bpmn:IntermediateThrowEvent', 'event', 'bpmn-icon-intermediate-event-none'
    ),
    'create.end-event': createAction(
      'bpmn:EndEvent', 'event', 'bpmn-icon-end-event-none'
    ),
    'create.exclusive-gateway': createAction(
      'bpmn:ExclusiveGateway', 'gateway', 'bpmn-icon-gateway-xor'
    ),
    // Task types are conditionally added based on palette settings
    // Check window.$paletteSettings for visible task types
  });

  // Add task types based on palette settings
  // Use new table-based palette task types if available
  var enabledTaskTypes = window.$enabledPaletteTaskTypes || [];
  var visibleTaskTypes = enabledTaskTypes.length > 0
    ? enabledTaskTypes.map(t => t.task_type)
    : (window.$paletteSettings?.visibleTaskTypes || ['bpmn:ManualTask', 'bpmn:ServiceTask']);

  if (visibleTaskTypes.includes('bpmn:ManualTask')) {
    actions['create.manual-task'] = createAction(
      'bpmn:ManualTask', 'activity', 'bpmn-icon-task', i18n.global.t('PaletteProvider.ManualTask')
    );
  }

  if (visibleTaskTypes.includes('bpmn:ServiceTask')) {
    actions['create.service-task'] = createAction(
      'bpmn:ServiceTask', 'activity', 'bpmn-icon-service-task', i18n.global.t('PaletteProvider.ServiceTask')
    );
  }

  if (visibleTaskTypes.includes('bpmn:UserTask')) {
    actions['create.user-task'] = createAction(
      'bpmn:UserTask', 'activity', 'bpmn-icon-user-task', i18n.global.t('PaletteProvider.UserTask')
    );
  }

  if (visibleTaskTypes.includes('bpmn:ScriptTask')) {
    actions['create.script-task'] = createAction(
      'bpmn:ScriptTask', 'activity', 'bpmn-icon-script-task', i18n.global.t('PaletteProvider.ScriptTask')
    );
  }

  if (visibleTaskTypes.includes('bpmn:BusinessRuleTask')) {
    actions['create.business-rule-task'] = createAction(
      'bpmn:BusinessRuleTask', 'activity', 'bpmn-icon-business-rule-task', i18n.global.t('PaletteProvider.BusinessRuleTask')
    );
  }

  if (visibleTaskTypes.includes('bpmn:SendTask')) {
    actions['create.send-task'] = createAction(
      'bpmn:SendTask', 'activity', 'bpmn-icon-send-task', i18n.global.t('PaletteProvider.SendTask')
    );
  }

  if (visibleTaskTypes.includes('bpmn:ReceiveTask')) {
    actions['create.receive-task'] = createAction(
      'bpmn:ReceiveTask', 'activity', 'bpmn-icon-receive-task', i18n.global.t('PaletteProvider.ReceiveTask')
    );
  }

  assign(actions, {
    'create.subprocess-expanded': createAction(
      'bpmn:SubProcess', 'activity', 'bpmn-icon-subprocess-expanded', i18n.global.t('PaletteProvider.expandedSubProcess'),
      { isExpanded: true }
    ),
    'create.data-store': createAction(
      'bpmn:DataStoreReference', 'data-object', 'bpmn-icon-data-store', i18n.global.t('PaletteProvider.dataStore')
    ),
    'create.data-object': createAction(
      'bpmn:DataObjectReference', 'data-object', 'bpmn-icon-data-object', i18n.global.t('PaletteProvider.dataObject')
    ),
    'create.participant-expanded': {
      group: 'collaboration',
      className: 'bpmn-icon-participant',
      title: i18n.global.t('PaletteProvider.participantCollapsed'),
      action: {
        dragstart: function(event) {
          createParticipant(event, false, true);
        },
        click: function(event) {
          createParticipant(event, false, true);
        }
      }
    },
    'create.participant-collapsed': {
      group: 'collaboration',
      className: 'bpmn-icon-participant icon-rotate-90',
      title: i18n.global.t('PaletteProvider.participantExpanded'),
      action: {
        dragstart: function(event) {
          createParticipant(event, true, false);
        },
        click: function(event) {
          createParticipant(event, true, false);
        }
      }
    },
    'auto-layout': {
      group: 'collaboration',
      className: 'mdi mdi-auto-fix',
      title: i18n.global.t('PaletteProvider.autoLayout'),
      action: {
        click: function(event) {
          me.applyAutoLayout();
        }
      }
    },
    'revert-layout': {
      group: 'collaboration',
      className: 'mdi mdi-restore',
      title: i18n.global.t('PaletteProvider.revertLayout') || 'Revert Layout',
      action: {
        click: function(event) {
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
          participant.forEach(element => {
            const horizontal = element.di.isHorizontal;
            if(horizontal) {
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