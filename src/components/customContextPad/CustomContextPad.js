import { assign } from 'min-dash';
import { i18n } from '@/main';

export default function ContextPadProvider(config, injector, eventBus, contextPad,
  modeling, elementFactory, connect, create, popupMenu, canvas, rules, translate) {

  this._config = config;
  this._injector = injector;
  this._eventBus = eventBus;
  this._contextPad = contextPad;
  this._modeling = modeling;
  this._elementFactory = elementFactory;
  this._connect = connect;
  this._create = create;
  this._popupMenu = popupMenu;
  this._canvas = canvas;
  this._rules = rules;
  this._translate = translate;

  contextPad.registerProvider(this);
}

ContextPadProvider.$inject = [
  'config',
  'injector',
  'eventBus',
  'contextPad',
  'modeling',
  'elementFactory',
  'connect',
  'create',
  'popupMenu',
  'canvas',
  'rules',
  'translate'
];

ContextPadProvider.prototype.getContextPadEntries = function(element) {
  const {
    _modeling: modeling,
    _translate: translate,
    _connect: connect,
    _elementFactory: elementFactory,
    _create: create
  } = this;

  function removeElement(e) {
    modeling.removeElements([element]);
  }

  function startConnect(event, element) {
    connect.start(event, element);
  }

  function appendAction(type, className, title, options) {
    return (event, element) => {
      const shape = elementFactory.createShape(assign({ type: type }, options));
      create.start(event, shape, {
        source: element
      });
    };
  }

  const popupMenu = this._popupMenu;

  function getReplaceMenuPosition(element) {
    const Y_OFFSET = 5;

    const diagramContainer = this._canvas.getContainer();
    const pad = this._contextPad.getPad(element).html;

    const diagramRect = diagramContainer.getBoundingClientRect();
    const padRect = pad.getBoundingClientRect();

    const top = padRect.top - diagramRect.top;
    const left = padRect.left - diagramRect.left;

    return {
      x: left,
      y: top + padRect.height + Y_OFFSET
    };
  }

  function adjustParticipantSize(element, newLane) {
    const participant = element.type === 'bpmn:Participant' ? element : element.parent;
    if (participant && participant.type === 'bpmn:Participant') {
      const participantBounds = participant.getBounds? participant.getBounds() : participant.di.bounds;
      const newLaneBounds = newLane.getBounds ? newLane.getBounds() : newLane.di.bounds;
      modeling.resizeShape(participant, {
        x: participantBounds.x,
        y: participantBounds.y,
        width: participantBounds.width,
        height: participantBounds.height + newLaneBounds.height
      });
    }
  }


  function divideIntoTwoLanes(event) {
    modeling.splitLane(element, 2);
  }

  function divideIntoThreeLanes(event) {
    modeling.splitLane(element, 3);
  }

  
  function changeParticipantOrientation(event, element) {
    if (element.type !== 'bpmn:Participant') {
      return;
    }

    const isCurrentlyHorizontal = element.di.isHorizontal;
    const participantBounds = element.getBounds ? element.getBounds() : element.di.bounds;
    const childElements = element.children || [];

    // 참가자의 새로운 크기 계산
    const newBounds = {
      x: participantBounds.x,
      y: participantBounds.y,
      width: isCurrentlyHorizontal ? participantBounds.height : participantBounds.width,
      height: isCurrentlyHorizontal ? participantBounds.width : participantBounds.height
    };

    // 참가자의 방향 변경 및 크기 조정
    modeling.resizeShape(element, newBounds);
    modeling.toggleCollapse(element);

    childElements.forEach(child => {
      if (child.type === 'bpmn:Lane') {
        const childBounds = child.getBounds ? child.getBounds() : child.di.bounds;
        const newChildBounds = {
          x: isCurrentlyHorizontal ? newBounds.x + (newBounds.height - childBounds.y - childBounds.height) : childBounds.x,
          y: isCurrentlyHorizontal ? childBounds.x : newBounds.y + (newBounds.width - childBounds.x - childBounds.width),
          width: isCurrentlyHorizontal ? childBounds.height : childBounds.width,
          height: isCurrentlyHorizontal ? childBounds.width : childBounds.height
        };
        modeling.resizeShape(child, newChildBounds);
      } else {
        const childBounds = child.getBounds ? child.getBounds() : child.di.bounds;
        const newPosition = {
          x: isCurrentlyHorizontal ? newBounds.x + (newBounds.height - childBounds.y - childBounds.height) : childBounds.x,
          y: isCurrentlyHorizontal ? childBounds.x : newBounds.y + (newBounds.width - childBounds.x - childBounds.width)
        };
        modeling.moveShape(child, { x: newPosition.x - childBounds.x, y: newPosition.y - childBounds.y });
      }
    });

    modeling.updateProperties(element, {
      di: { isHorizontal: !isCurrentlyHorizontal }
    });
  }

  const actions = {};

  if (element.type === 'bpmn:Participant' || element.type === 'bpmn:Lane') {
    const isHorizontal = element.di.isHorizontal;
    

    assign(actions, {
      'lane-insert-above': {
        group: 'lane',
        className: isHorizontal ? 'bpmn-icon-lane-insert-above' : 'bpmn-icon-lane-insert-above icon-rotate-270',
        title: isHorizontal ? i18n.global.t('customContextPad.laneAbove') : i18n.global.t('customContextPad.laneToTheLeft'),
        action: {
          click: function(event2, element2) {
            modeling.addLane(element2, "top");
          }
        }
      },
      'lane-insert-below': {
        group: 'lane',
        className: isHorizontal ? 'bpmn-icon-lane-insert-below' : 'bpmn-icon-lane-insert-below icon-rotate-270',
        title: isHorizontal ? i18n.global.t('customContextPad.laneBelow') : i18n.global.t('customContextPad.laneToTheRight'),
        action: {
          click: function(event2, element2) {
            modeling.addLane(element2, "bottom");
          }
        }
      },
      'lane-divide-two': {
        group: 'lane',
        className: isHorizontal ? 'bpmn-icon-lane-divide-two' : 'bpmn-icon-lane-divide-two icon-rotate-270',
        title: i18n.global.t('customContextPad.laneDivideTwo'),
        action: {
          click: divideIntoTwoLanes
        }
      },
      'lane-divide-three': {
        group: 'lane',
        className: isHorizontal ? 'bpmn-icon-lane-divide-three' : 'bpmn-icon-lane-divide-three icon-rotate-270',
        title: i18n.global.t('customContextPad.laneDivideThree'),
        action: {
          click: divideIntoThreeLanes
        }
      },
      'delete': {
        group: 'edit',
        className: 'bpmn-icon-trash',
        title: i18n.global.t('customContextPad.delete'),
        action: {
          click: removeElement
        }
      },
      'connect': {
        group: 'connect',
        className: 'bpmn-icon-connection-multi',
        title: i18n.global.t('customContextPad.connectionMulti'),
        action: {
          click: startConnect,
          dragstart: startConnect
        }
      },
    });

    // Participant에만 적용되는 액션
    // if (element.type === 'bpmn:Participant') {
    //   assign(actions, {
    //     'participant-orientation': {
    //       group: 'lane',
    //       className: isHorizontal ? 'bpmn-icon-participant icon-rotate-90' : 'bpmn-icon-participant',
    //       title: translate(isHorizontal ? 'Change to Vertical Pool' : 'Change to Horizontal Pool'),
    //       action: {
    //         click: changeParticipantOrientation
    //       }
    //     }
    //   });
    // }
  }
  else {
    assign(actions, {
      'append.end-event': {
        group: 'model',
        className: 'bpmn-icon-end-event-none',
        title: i18n.global.t('customContextPad.endEvent'),
        action: {
          click: appendAction(
            'bpmn:EndEvent',
            'bpmn-icon-end-event-none',
            translate('Append end event')
          )
        }
      },
      'append.gateway': {
        group: 'model',
        className: 'bpmn-icon-gateway-none',
        title: i18n.global.t('customContextPad.gateway'),
        action: {
          click: appendAction(
            'bpmn:ExclusiveGateway',
            'bpmn-icon-gateway-none',
            translate('Append gateway')
          )
        }
      },
      'append.append-task': {
        group: 'model',
        className: 'bpmn-icon-task',
        title: i18n.global.t('customContextPad.task'),
        action: {
          click: appendAction(
            'bpmn:Task',
            'bpmn-icon-task',
            translate('Append task')
          )
        }
      },
      'append.intermediate-event': {
        group: 'model',
        className: 'bpmn-icon-intermediate-event-none',
        title: i18n.global.t('customContextPad.intermediateEvent'),
        action: {
          click: appendAction(
            'bpmn:IntermediateThrowEvent',
            'bpmn-icon-intermediate-event-none',
            translate('Append intermediate/boundary event')
          )
        }
      },
      'append.text-annotation': {
        group: 'model',
        className: 'bpmn-icon-text-annotation',
        title: i18n.global.t('customContextPad.textAnnotation'),
        action: {
          click: appendAction(
            'bpmn:TextAnnotation',
            'bpmn-icon-text-annotation',
            translate('Append text annotation')
          )
        }
      },
      'replace': {
        group: 'edit',
        className: 'bpmn-icon-screw-wrench',
        title: i18n.global.t('customContextPad.replace'),
        action: {
          click: function(event, element) {
            var position = assign({
              x: event.x,
              y: event.y
            }, 
            {
              cursor: { x: event.x, y: event.y }
            });
  
            popupMenu.open(element, 'bpmn-replace', position, {
              title: i18n.global.t('customContextPad.replace'),
              width: 300,
              search: true
            });
          }
        }
      },
      'delete': {
        group: 'edit',
        className: 'bpmn-icon-trash',
        title: i18n.global.t('customContextPad.delete'),
        action: {
          click: function(event, element) {
            modeling.removeElements([element]);
          }
        }
      },
      'connect': {
        group: 'connect',
        className: 'bpmn-icon-connection-multi',
        title: i18n.global.t('customContextPad.connect'),
        action: {
          click: function(event, element) {
            connect.start(event, element);
          },
          dragstart: function(event, element) {
            connect.start(event, element);
          }
        }
      }
    });
  }
  return actions;
};