import { assign } from 'min-dash';

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
    _connect: connect
  } = this;

  function removeElement(e) {
    modeling.removeElements([element]);
  }

  function startConnect(event, element) {
    connect.start(event, element);
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
        title: translate(isHorizontal ? 'Add Lane Above' : 'Add Lane to the Left'),
        action: {
          click: function(event2, element2) {
            modeling.addLane(element2, "top");
          }
        }
      },
      'lane-insert-below': {
        group: 'lane',
        className: isHorizontal ? 'bpmn-icon-lane-insert-below' : 'bpmn-icon-lane-insert-below icon-rotate-270',
        title: translate(isHorizontal ? 'Add Lane Below' : 'Add Lane to the Right'),
        action: {
          click: function(event2, element2) {
            modeling.addLane(element2, "bottom");
          }
        }
      },
      'lane-divide-two': {
        group: 'lane',
        className: isHorizontal ? 'bpmn-icon-lane-divide-two' : 'bpmn-icon-lane-divide-two icon-rotate-270',
        title: translate('Divide into Two Lanes'),
        action: {
          click: divideIntoTwoLanes
        }
      },
      'lane-divide-three': {
        group: 'lane',
        className: isHorizontal ? 'bpmn-icon-lane-divide-three' : 'bpmn-icon-lane-divide-three icon-rotate-270',
        title: translate('Divide into Three Lanes'),
        action: {
          click: divideIntoThreeLanes
        }
      },
      'delete': {
        group: 'edit',
        className: 'bpmn-icon-trash',
        title: translate('Remove'),
        action: {
          click: removeElement
        }
      },
      'connect': {
        group: 'connect',
        className: 'bpmn-icon-connection-multi',
        title: translate('Connect using Message Flow'),
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

  return actions;
};