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
            console.error('BpmnAutoLayout 모듈을 찾을 수 없습니다.');
            alert('자동 레이아웃 모듈을 불러올 수 없습니다.');
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
                console.error('자동 레이아웃 적용 중 오류가 발생했습니다:', error);
            }
        }, 50);
        
    } catch (error) {
        console.error('자동 레이아웃 적용 중 오류가 발생했습니다:', error);
        alert('자동 레이아웃 적용 중 오류가 발생했습니다. 콘솔을 확인하세요.');
    }
  }

  function changeParticipantHorizontalToVertical(event, element) {
    const logPrefix = '[changeParticipantOrientation]';

    if (element.type !== 'bpmn:Participant') {
      console.warn(`${logPrefix} 대상이 Participant가 아닙니다.`);
      return;
    }

    const participantBounds = element.di.bounds;
    const childElements = element.children || [];

    const newParticipantBounds = {
      x: participantBounds.x,
      y: participantBounds.y,
      width: participantBounds.height * 1.2,
      height: participantBounds.width * 0.8
    };

    modeling.resizeShape(element, newParticipantBounds);
    modeling.updateProperties(element, {
      di: { isHorizontal: false }
    });

    const paddingX = 50;
    const paddingY = 30;
    const nodeSpacingX = 150;
    let currentY = newParticipantBounds.y + paddingY;
    let currentX = newParticipantBounds.x;

    const lanes = childElements.filter(el => el.type === 'bpmn:Lane');
    const visited = new Set();

    lanes.forEach(lane => {
      const laneBounds = lane.di.bounds;
      const laneWidth = laneBounds.width * 0.8;
      const laneHeight = laneBounds.height * 1.2;

      // 높이, 너비 바꾸고 Y 좌표 누적 배치
      const newLaneBounds = {
        x: currentX,
        y: currentY,
        width: laneHeight,
        height: laneWidth
      };

      currentX = currentX + laneHeight;

      modeling.resizeShape(lane, newLaneBounds);
      modeling.updateProperties(lane, {
        di: { isHorizontal: false }
      });
    });

    const originalSequenceFlows = element.children.filter(child => child.type === 'bpmn:SequenceFlow');
    const originalWaypoints = {};
    originalSequenceFlows.forEach(sequenceFlow => {
      const waypoints = sequenceFlow.waypoints;
      const newWaypoints = [];
      waypoints.forEach(waypoint => {
        const waypointX = newParticipantBounds.y + (waypoint.x - participantBounds.x) * 0.8;
        const waypointY = newParticipantBounds.x + (waypoint.y - participantBounds.y) * 1.2;
        const newWaypoint = {x: waypointY, y: waypointX };
        if(waypoint.original) {
          const original = { x: waypoint.original.x, y: waypoint.original.y };
          newWaypoint.original = original;
        }
        newWaypoints.push(newWaypoint);
      });
      originalWaypoints[sequenceFlow.id] = newWaypoints;
    });

    element.children.forEach(child => {
      if (child.type != 'bpmn:Lane' &&
        child.type != 'bpmn:LaneSet' &&
        child.type != 'bpmn:Participant') {
        if (child.type != 'bpmn:SequenceFlow') {
          let childOffsetX = 0;
          let childOffsetY = 0;

          const childX = newParticipantBounds.y + (child.di.bounds.x - participantBounds.x) * 0.8 - childOffsetX;
          const childY = newParticipantBounds.x + (child.di.bounds.y - participantBounds.y) * 1.2 + childOffsetY;
          const childWidth = child.di.bounds.width;
          const childHeight = child.di.bounds.height;
          const newChildBounds = {
            x: childY,
            y: childX,
            width: childWidth,
            height: childHeight
          };

          modeling.resizeShape(child, newChildBounds);
        }
      }
    });

    const changeSequenceFlows = element.children.filter(child => child.type === 'bpmn:SequenceFlow');
    changeSequenceFlows.forEach(sequenceFlow => {
      sequenceFlow.waypoints = originalWaypoints[sequenceFlow.id];
      modeling.updateProperties(sequenceFlow, {
        waypoints: originalWaypoints[sequenceFlow.id]
      });
    });

    console.log(`${logPrefix} ? 수평 회전 및 정렬 완료`);
  }

  function changeParticipantVerticalToHorizontal(event, element) {
    const logPrefix = '[changeParticipantOrientation]';
  
    if (element.type !== 'bpmn:Participant') {
      console.warn(`${logPrefix} 대상이 Participant가 아닙니다.`);
      return;
    }
  
    const participantBounds = element.di.bounds;
    const childElements = element.children || [];
  
    // 세로에서 가로로 회전 (반대 연산)
    const newParticipantBounds = {
      x: participantBounds.x,
      y: participantBounds.y,
      width: participantBounds.height * 1.2,
      height: participantBounds.width * 0.8
    };
  
    modeling.resizeShape(element, newParticipantBounds);
    modeling.updateProperties(element, {
      di: { isHorizontal: true }
    });
  
    const paddingX = 30;
    const paddingY = 50;
    let currentY = newParticipantBounds.y;
    let currentX = newParticipantBounds.x + paddingX;
  
    const lanes = childElements.filter(el => el.type === 'bpmn:Lane');
  
    lanes.forEach(lane => {
      const laneBounds = lane.di.bounds;
      const laneWidth = laneBounds.width * 0.8;
      const laneHeight = laneBounds.height * 1.2;
      const newLaneBounds = {
        x: currentX,
        y: currentY,
        width: laneHeight,
        height: laneWidth
      };
  
      currentY = currentY + laneWidth;
  
      modeling.resizeShape(lane, newLaneBounds);
      modeling.updateProperties(lane, {
        di: { isHorizontal: true }
      });
    });
  
    const originalSequenceFlows = element.children.filter(child => child.type === 'bpmn:SequenceFlow');
    const originalWaypoints = {};
    originalSequenceFlows.forEach(sequenceFlow => {
      const waypoints = sequenceFlow.waypoints;
      const newWaypoints = [];
      waypoints.forEach(waypoint => {
        const waypointX = newParticipantBounds.y + (waypoint.x - participantBounds.x) * 0.8;
        const waypointY = newParticipantBounds.x + (waypoint.y - participantBounds.y) * 1.2;
        const newWaypoint = {
          x: waypointY,
          y: waypointX
        };
        if (waypoint.original) {
          const original = { x: waypoint.original.x, y: waypoint.original.y };
          newWaypoint.original = original;
        }
        newWaypoints.push(newWaypoint);
      });
      originalWaypoints[sequenceFlow.id] = newWaypoints;
    });
  
    element.children.forEach(child => {
      if (child.type != 'bpmn:Lane' &&
          child.type != 'bpmn:LaneSet' &&
          child.type != 'bpmn:Participant') {
        if (child.type != 'bpmn:SequenceFlow') {
          let childOffsetX = 0;
          let childOffsetY = 0;

          const childX = newParticipantBounds.x + (child.di.bounds.y - participantBounds.y) * 1.2  - childOffsetY;
          const childY = newParticipantBounds.y + (child.di.bounds.x - participantBounds.x) * 0.8 - childOffsetX;
          
          const newChildBounds = {
            x: childX,
            y: childY,
            width: child.di.bounds.width,
            height: child.di.bounds.height
          };
  
          modeling.resizeShape(child, newChildBounds);
        }
      }
    });
  
    const changeSequenceFlows = element.children.filter(child => child.type === 'bpmn:SequenceFlow');
    changeSequenceFlows.forEach(sequenceFlow => {
      sequenceFlow.waypoints = originalWaypoints[sequenceFlow.id];
      modeling.updateProperties(sequenceFlow, {
        waypoints: originalWaypoints[sequenceFlow.id]
      });
    });
  
    console.log(`${logPrefix} ? 세로 → 가로 회전 및 정렬 완료`);
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
      title: i18n.global.t('PaletteProvider.autoLayout') || '자동 레이아웃',
      action: {
        click: function(event) {
          applyAutoLayout();
        }
      }
    },
    'change-orientation': {
      group: 'collaboration',
      className: 'mdi mdi-crop-rotate',
      title: i18n.global.t('PaletteProvider.changeOrientation') || '레이아웃 방향 전환',
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