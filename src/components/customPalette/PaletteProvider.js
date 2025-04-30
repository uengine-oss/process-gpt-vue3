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
   injector) {

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
  'injector'
];

PaletteProvider.prototype.getPaletteEntries = function(element) {
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


  
  function applyAutoLayout() {
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
                window.BpmnAutoLayout.applyAutoLayout(bpmnJS, { horizontal: horizontal });
                
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
  
  function adjustParticipantBoundsByLanes(participant, lanes, isHorizontal) {
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
  
  function changeParticipantHorizontalToVertical(event, element) {
    const logPrefix = '[changeParticipantOrientation]';
    const SCALE_FIX = 1 / 0.96;
  
    if (element.type !== 'bpmn:Participant') {
      console.warn(`${logPrefix} participant가 아닙니다.`);
      return;
    }
  
    const childElements = element.children || [];
    const lanes = childElements.filter(el => el.type === 'bpmn:Lane');
  
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
  
      const laneWidth = oldLaneBounds.width * 0.8 * SCALE_FIX;
      const laneHeight = oldLaneBounds.height * 1.2 * SCALE_FIX;
  
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
        const waypointX = newParticipantBounds.y + (waypoint.x - oldParticipantBounds.x) * 0.8 * SCALE_FIX;
        const waypointY = newParticipantBounds.x + (waypoint.y - oldParticipantBounds.y) * 1.2 * SCALE_FIX;
  
        const newWaypoint = { x: waypointY, y: waypointX };
  
        if (waypoint.original) {
          newWaypoint.original = { x: waypoint.original.x, y: waypoint.original.y };
        }
  
        newWaypoints.push(newWaypoint);
      });
  
      originalWaypoints[sequenceFlow.id] = newWaypoints;
    });
  
    // 🧭 기타 노드 위치 보정
    childElements.forEach(child => {
      if (
        child.type !== 'bpmn:Lane' &&
        child.type !== 'bpmn:LaneSet' &&
        child.type !== 'bpmn:Participant'
      ) {
        if (child.type !== 'bpmn:SequenceFlow') {
          const originalCenterX = child.di.bounds.x + (child.di.bounds.width / 2);
          const originalCenterY = child.di.bounds.y + (child.di.bounds.height / 2);
  
          const relativeX = originalCenterX - oldParticipantBounds.x;
          const relativeY = originalCenterY - oldParticipantBounds.y;
  
          const rotatedX = relativeY * 1.2 * SCALE_FIX;
          const rotatedY = relativeX * 0.8 * SCALE_FIX;
  
          const newChildBounds = {
            x: newParticipantBounds.x + rotatedX - (child.di.bounds.width / 2),
            y: newParticipantBounds.y + rotatedY - (child.di.bounds.height / 2),
            width: child.di.bounds.width,
            height: child.di.bounds.height
          };
  
          modeling.resizeShape(child, newChildBounds);
        }
      }
    });

    adjustParticipantBoundsByLanes(element, lanes, false);
  
    // 💡 SequenceFlow 최종 waypoint 반영
    originalSequenceFlows.forEach(sequenceFlow => {
      sequenceFlow.waypoints = originalWaypoints[sequenceFlow.id];
      modeling.updateProperties(sequenceFlow, {
        waypoints: originalWaypoints[sequenceFlow.id]
      });
    });
  }
  
  

  function changeParticipantVerticalToHorizontal(event, element) {
    const logPrefix = '[changeParticipantOrientation]';
    
    if (element.type !== 'bpmn:Participant') {
      console.warn(`${logPrefix} participant가 아닙니다.`);
      return;
    }
  
    const childElements = element.children || [];
    const lanes = childElements.filter(el => el.type === 'bpmn:Lane');
  
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
  
      const laneWidth = oldLaneBounds.width * 0.8;   // Scale Fix 없음
      const laneHeight = oldLaneBounds.height * 1.2; // Scale Fix 없음
  
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
        const waypointX = newParticipantBounds.y + (waypoint.x - oldParticipantBounds.x) * 0.8;
        const waypointY = newParticipantBounds.x + (waypoint.y - oldParticipantBounds.y) * 1.2;
  
        const newWaypoint = { x: waypointY, y: waypointX };
  
        if (waypoint.original) {
          newWaypoint.original = { x: waypoint.original.x, y: waypoint.original.y };
        }
  
        newWaypoints.push(newWaypoint);
      });
  
      originalWaypoints[sequenceFlow.id] = newWaypoints;
    });
  
    // 🧭 기타 노드 보정
    childElements.forEach(child => {
      if (
        child.type !== 'bpmn:Lane' &&
        child.type !== 'bpmn:LaneSet' &&
        child.type !== 'bpmn:Participant'
      ) {
        if (child.type !== 'bpmn:SequenceFlow') {
          const originalCenterX = child.di.bounds.x + (child.di.bounds.width / 2);
          const originalCenterY = child.di.bounds.y + (child.di.bounds.height / 2);
  
          const relativeX = originalCenterX - oldParticipantBounds.x;
          const relativeY = originalCenterY - oldParticipantBounds.y;
  
          const rotatedX = relativeY * 1.2;
          const rotatedY = relativeX * 0.8;
  
          const newChildBounds = {
            x: newParticipantBounds.x + rotatedX - (child.di.bounds.width / 2),
            y: newParticipantBounds.y + rotatedY - (child.di.bounds.height / 2),
            width: child.di.bounds.width,
            height: child.di.bounds.height
          };
  
          modeling.resizeShape(child, newChildBounds);
        }
      }
    });
  
    adjustParticipantBoundsByLanes(element, lanes, true);

    // 💡 SequenceFlow 최종 waypoint 반영
    originalSequenceFlows.forEach(sequenceFlow => {
      sequenceFlow.waypoints = originalWaypoints[sequenceFlow.id];
      modeling.updateProperties(sequenceFlow, {
        waypoints: originalWaypoints[sequenceFlow.id]
      });
    });
  }
  
  
  

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
    'create.task': createAction(
      'bpmn:Task', 'activity', 'bpmn-icon-task'
    ),
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
          applyAutoLayout();
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
              changeParticipantHorizontalToVertical(event, element);
            } else {
              changeParticipantVerticalToHorizontal(event, element);
            }
          });
        }
      }
    }
    
  });

  return actions;
};