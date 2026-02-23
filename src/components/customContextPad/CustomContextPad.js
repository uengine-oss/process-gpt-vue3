import { assign } from 'min-dash';
import { i18n } from '@/main';
import { indexOf } from 'lodash';

export default function ContextPadProvider(config, injector, eventBus, contextPad,
  modeling, elementFactory, connect, create, popupMenu, canvas, rules, translate, autoPlace) {

  const originalContextPadProvider = injector.get('contextPadProvider');
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
  this._autoPlace = autoPlace;

  contextPad.registerProvider(this);

  this._originalGetContextPadEntries = originalContextPadProvider.getContextPadEntries.bind(originalContextPadProvider);
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
  'translate',
  'autoPlace'
];

ContextPadProvider.prototype.getContextPadEntries = function (element) {
  const {
    _modeling: modeling,
    _translate: translate,
    _connect: connect,
    _elementFactory: elementFactory,
    _create: create,
    _injector: injector
  } = this;
  function removeElement(e) {
    modeling.removeElements([element]);
  }

  function startConnect(event, element) {
    connect.start(event, element);
  }

  function appendAction(type, className, title, options) {
    const autoPlace = injector.get('autoPlace', false);
    function appendStart(event, element) {
      const shape = elementFactory.createShape(assign({ type }, options));
      create.start(event, shape, { source: element });
    }

    const append = autoPlace
      ? function (_, element) {
          const shape = elementFactory.createShape(assign({ type }, options));

          // Check if this is a Task type (for middle insertion)
          const isTaskType = type.includes('Task');

          // Check if source element is a Gateway (don't insert in middle for Gateway sources)
          const isSourceGateway = element.type && element.type.includes('Gateway');

          // Check if we should insert in the middle of a flow
          // Only for Task types, and not when source is a Gateway
          if (isTaskType && !isSourceGateway) {
            const outgoingConnections = element.outgoing || [];

            // Only insert in middle if there's exactly one outgoing connection
            if (outgoingConnections.length === 1) {
              const connection = outgoingConnections[0];
              const targetElement = connection.target;

              // Insert in middle if there's a valid target
              if (targetElement) {
                try {
                  // Calculate position for new shape (between source and target)
                  const sourceCenter = {
                    x: element.x + element.width / 2,
                    y: element.y + element.height / 2
                  };
                  const targetCenter = {
                    x: targetElement.x + targetElement.width / 2,
                    y: targetElement.y + targetElement.height / 2
                  };

                  // Position new shape in the middle
                  const newPosition = {
                    x: (sourceCenter.x + targetCenter.x) / 2,
                    y: (sourceCenter.y + targetCenter.y) / 2
                  };

                  // Store original target before modifying
                  const originalTarget = targetElement;

                  // Create the new shape at the calculated position
                  const newShape = modeling.createShape(shape, newPosition, element.parent);

                  // Reconnect: element -> newShape (modify existing connection)
                  modeling.reconnectEnd(connection, newShape, {
                    x: newShape.x + newShape.width / 2,
                    y: newShape.y + newShape.height / 2
                  });

                  // Create new connection: newShape -> originalTarget
                  modeling.connect(newShape, originalTarget);

                  return;
                } catch (e) {
                  console.warn('Failed to insert task in middle of flow:', e);
                  // Fall through to default behavior
                }
              }
            }
          }

          // Default behavior: append without insertion
          autoPlace.append(element, shape);
        }
      : appendStart;

    const previewAppend = autoPlace
      ? function (_, element) {
          try {
            appendPreview.create(element, type, options);
          } catch (e) {
            console.warn('[appendPreview] 실패:', e);
          }

          return () => {
            appendPreview.cleanUp();
          };
        }
      : null;

    return {
      group: 'model',
      className,
      title,
      action: {
        dragstart: appendStart,
        click: append,
        hover: previewAppend
      }
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
      const participantBounds = participant.getBounds ? participant.getBounds() : participant.di.bounds;
      const newLaneBounds = newLane.getBounds ? newLane.getBounds() : newLane.di.bounds;
      modeling.resizeShape(participant, {
        x: participantBounds.x,
        y: participantBounds.y,
        width: participantBounds.width,
        height: participantBounds.height + newLaneBounds.height
      });
    }
  }



  function insertLanes(num) {
    modeling.splitLane(element, num);
  }

  function divideIntoTwoLanes(event) {
    modeling.splitLane(element, 2);
  }

  function divideIntoThreeLanes(event) {
    modeling.splitLane(element, 3);
  }

  // Equalize lane sizes within a participant
  function equalizeLaneSizes(event, targetElement) {
    const participant = targetElement.type === 'bpmn:Participant'
      ? targetElement
      : targetElement.parent;

    if (!participant || participant.type !== 'bpmn:Participant') {
      console.warn('No participant found for lane equalization');
      return;
    }

    const lanes = participant.children.filter(child => child.type === 'bpmn:Lane');
    if (lanes.length < 2) {
      console.warn('Need at least 2 lanes to equalize');
      return;
    }

    const isHorizontal = participant.di?.isHorizontal !== false;

    if (isHorizontal) {
      // Horizontal layout: equalize heights
      const totalHeight = participant.height;
      const laneHeaderHeight = 30; // Header area for participant name
      const availableHeight = totalHeight - laneHeaderHeight;
      const equalHeight = Math.floor(availableHeight / lanes.length);

      // Sort lanes by Y position
      const sortedLanes = [...lanes].sort((a, b) => a.y - b.y);

      sortedLanes.forEach((lane, index) => {
        const isLast = index === sortedLanes.length - 1;
        const newHeight = isLast
          ? availableHeight - (equalHeight * (sortedLanes.length - 1))
          : equalHeight;

        const newY = participant.y + laneHeaderHeight + (equalHeight * index);

        modeling.resizeShape(lane, {
          x: lane.x,
          y: newY,
          width: lane.width,
          height: newHeight
        });
      });
    } else {
      // Vertical layout: equalize widths
      const totalWidth = participant.width;
      const laneHeaderWidth = 30; // Header area for participant name
      const availableWidth = totalWidth - laneHeaderWidth;
      const equalWidth = Math.floor(availableWidth / lanes.length);

      // Sort lanes by X position
      const sortedLanes = [...lanes].sort((a, b) => a.x - b.x);

      sortedLanes.forEach((lane, index) => {
        const isLast = index === sortedLanes.length - 1;
        const newWidth = isLast
          ? availableWidth - (equalWidth * (sortedLanes.length - 1))
          : equalWidth;

        const newX = participant.x + laneHeaderWidth + (equalWidth * index);

        modeling.resizeShape(lane, {
          x: newX,
          y: lane.y,
          width: newWidth,
          height: lane.height
        });
      });
    }
  }

  function getDi(element) {
    if (!element) return null;
    return element.di || (element.businessObject && element.businessObject.$parent && element.businessObject.$parent.di);
  }

  function splitPhaseContainer(phaseContainer, numPhases) {
    const laneSet = phaseContainer.businessObject.laneSets[0];
    if (!laneSet) {
      console.error("🚨 LaneSet을 찾을 수 없습니다.");
      return;
    }

    for (let i = 0; i < numPhases; i++) {
      // ✅ Phase 생성 (Lane 대신 Phase 사용)
      const phase = elementFactory._moddle.create('phase:Phase', {
        id: `Phase_${Math.random().toString(36).substr(2, 9)}`,
        name: `Phase ${i + 1}`
      });

      laneSet.lanes.push(phase);
    }

    // ✅ LaneSet 업데이트
    modeling.updateProperties(phaseContainer, {
      laneSets: [laneSet]
    });

    console.log(`✅ ${numPhases}개의 Phase 추가 완료.`);
  }


  function addPhaseContainer(participantElement) {


    const processBo = elementFactory._moddle.create('bpmn:Process', {
      id: `Process_${Math.random().toString(36).substr(2, 9)}`,
      isExecutable: false,
      laneSets: []
    })

    // ✅ Participant의 부모 요소 가져오기
    const parentElement = participantElement.parent;
    if (!parentElement) {
      console.error("🚨 Participant의 부모 요소를 찾을 수 없습니다.", participantElement);
      return;
    }

    // ✅ DI 정보 가져오기
    const participantDi = getDi(participantElement);
    if (!participantDi) {
      console.error("🚨 Participant의 DI 정보가 없습니다.", participantElement);
      return;
    }

    // ✅ BusinessObject 생성
    const phaseContainerBO = elementFactory._moddle.create('phase:PhaseContainer', {
      id: `PhaseContainer_${Math.random().toString(36).substr(2, 9)}`,
      numPhases: 0,
      processRef: processBo,
      isHorizontal: false
    });

    // ✅ LaneSet 추가 (splitLane()을 위해 필요)
    const laneSet = elementFactory._moddle.create('bpmn:LaneSet', {
      id: `LaneSet_${Math.random().toString(36).substr(2, 9)}`,
      lanes: []
    });
    processBo.laneSets = [laneSet];  // ✅ LaneSet 추가

    // ✅ DI 정보 생성
    const phaseContainerDI = elementFactory._moddle.create('bpmndi:BPMNShape', {
      id: `DI_${phaseContainerBO.id}`,
      bpmnElement: phaseContainerBO,
      isHorizontal: false,
      bounds: {
        x: participantElement.x + participantElement.width / 2,
        y: participantElement.y - 30, // ✅ Participant 위쪽에 배치
        width: participantElement.width,
        height: 90
      }
    });

    phaseContainerDI.isHorizontal = false

    // ✅ 반드시 $parent를 설정
    phaseContainerDI.$parent = participantDi.$parent;

    // ✅ 부모-자식 관계 초기화
    const parentBO = parentElement.businessObject;

    if (!Array.isArray(parentBO.children)) {
      parentBO.children = [];
    }
    parentBO.children.push(phaseContainerBO);

    // ✅ planeElement 배열이 맞는지 확인 후 push
    let planeElement = participantDi.$parent.get('planeElement');
    if (!Array.isArray(planeElement)) {
      planeElement = [planeElement];
      participantDi.$parent.set('planeElement', planeElement);
    }
    planeElement.push(phaseContainerDI);

    // ✅ PhaseContainer 생성
    const phaseContainer = elementFactory.createShape({
      type: 'phase:PhaseContainer',
      businessObject: phaseContainerBO,
      width: participantElement.width,
      height: 90,
      isHorizontal: false
    });


    // ✅ PhaseContainer의 위치 설정
    const position = {
      x: participantElement.x + participantElement.width / 2,
      y: participantElement.y - 45
    };

    // ✅ PhaseContainer를 `Participant`의 부모에 추가
    modeling.createShape(phaseContainer, position, parentElement);

    console.log("✅ PhaseContainer 생성 완료:", phaseContainer);
    return phaseContainer;
  }


  const actions = this._originalGetContextPadEntries(element);
  if (element.type === 'bpmn:Participant' || element.type === 'bpmn:Lane' || element.type === 'phase:PhaseContainer') {
    const isHorizontal = element.di.isHorizontal
    assign(actions, {
      'lane-insert-above': {
        group: 'lane',
        className: isHorizontal ? 'bpmn-icon-lane-insert-above' : 'bpmn-icon-lane-insert-above icon-rotate-270',
        title: isHorizontal ? i18n.global.t('customContextPad.laneAbove') : i18n.global.t('customContextPad.laneToTheLeft'),
        action: {
          click: actions['lane-insert-above'].action.click
        }
      },
      'lane-insert-below': {
        group: 'lane',
        className: isHorizontal ? 'bpmn-icon-lane-insert-below' : 'bpmn-icon-lane-insert-below icon-rotate-270',
        title: isHorizontal ? i18n.global.t('customContextPad.laneBelow') : i18n.global.t('customContextPad.laneToTheRight'),
        action: {
          click: actions['lane-insert-below'].action.click
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
      'lane-insert-single': {
        group: 'lane',
        className: isHorizontal ? 'bpmn-icon-participant' : 'bpmn-icon-participant icon-rotate-90',
        title: isHorizontal ? i18n.global.t('customContextPad.lane') : i18n.global.t('customContextPad.laneToTheLeft'),
        action: {
          click: function (event, element) {
            const laneCount = element.children.filter(child => child.type === 'bpmn:Lane').length;
            insertLanes(1);
          }
        }
      },
      'lane-equalize': {
        group: 'lane',
        className: 'mdi mdi-equal',
        title: i18n.global.t('customContextPad.laneEqualize') || 'Equalize Lane Sizes',
        action: {
          click: function (event, targetElement) {
            equalizeLaneSizes(event, targetElement);
          }
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
      }
    });

    if (element.type === 'bpmn:Participant') {
      assign(actions, {
        'append.phase.container': {
          group: 'model',
          className: 'mdi mdi-label-outline',
          title: i18n.global.t('customContextPad.phase'),
          action: {
            click: function (event, element) {
              const phaseContainer = addPhaseContainer(element);

              modeling.splitLane(phaseContainer, 3);
            }
          }
        }
      });
    }

    if (element.type === 'phase:PhaseContainer') {
      assign(actions, {
        'append.phase': {
          group: 'model',
          className: 'bpmn-icon-phase',
          title: i18n.global.t('customContextPad.phase'),
          action: {
            click: function (event, element) {
              splitPhaseContainer(element, 3); // 기본 2개로 나누기
            }
          }
        }
      });
    }
  }

  if (actions['append.end-event']) {
    actions['append.end-event'].title = i18n.global.t('customContextPad.endEvent');
  }
  if (actions['append.gateway']) {
    actions['append.gateway'].title = i18n.global.t('customContextPad.gateway');
  }
  if (actions['append.append-task']) {
    const newAction = appendAction(
      'bpmn:ManualTask',
      actions['append.append-task'].className,
      i18n.global.t('customContextPad.task'),
      {}
    );

    actions['append.append-task'].action = newAction.action;
  }
  if (actions['append.intermediate-event']) {
    actions['append.intermediate-event'].title = i18n.global.t('customContextPad.intermediateEvent');
  }
  if (actions['append.text-annotation']) {
    actions['append.text-annotation'].title = i18n.global.t('customContextPad.textAnnotation');
  }
  if (actions['replace']) {
    const selection = injector.get('selection');
    const bpmnReplace = injector.get('bpmnReplace');
    const popupMenu = injector.get('popupMenu');

    actions['replace'] = {
      group: 'edit',
      className: 'bpmn-icon-screw-wrench',
      title: i18n.global.t('customContextPad.replace'),
      action: {
        click: function (event, element) {
          // 여러 Task가 선택된 경우 동시 타입 변경
          const selectedElements = selection.get();
          const selectedTasks = selectedElements.filter(el => el.type && el.type.includes('Task'));

          if (selectedTasks.length > 1) {
            // 다중 Task 선택 시 HTML 기반 드롭다운 메뉴 표시
            showMultiTaskReplaceMenu(event, selectedTasks, bpmnReplace, selection);
          } else {
            // 단일 요소 선택 시 기존 동작
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
      }
    }
  }

  // 다중 Task 타입 변경 메뉴 표시 함수
  function showMultiTaskReplaceMenu(event, selectedTasks, bpmnReplace, selection) {
    // 기존 메뉴 제거
    const existingMenu = document.getElementById('multi-task-replace-menu');
    if (existingMenu) {
      existingMenu.remove();
    }

    // 사용 가능한 Task 타입 목록
    const taskTypes = [
      { type: 'bpmn:ManualTask', label: i18n.global.t('CustomReplaceElement.replace-with-manual-task') || 'Manual Task', icon: '✋' },
      { type: 'bpmn:ServiceTask', label: i18n.global.t('CustomReplaceElement.replace-with-service-task') || 'Service Task', icon: '⚙️' },
      { type: 'bpmn:UserTask', label: i18n.global.t('CustomReplaceElement.replace-with-user-task') || 'User Task', icon: '👤' },
      { type: 'bpmn:ScriptTask', label: i18n.global.t('CustomReplaceElement.replace-with-script-task') || 'Script Task', icon: '📜' },
      { type: 'bpmn:BusinessRuleTask', label: i18n.global.t('CustomReplaceElement.replace-with-rule-task') || 'Business Rule Task', icon: '📋' },
      { type: 'bpmn:SendTask', label: i18n.global.t('CustomReplaceElement.replace-with-send-task') || 'Send Task', icon: '📤' },
      { type: 'bpmn:ReceiveTask', label: i18n.global.t('CustomReplaceElement.replace-with-receive-task') || 'Receive Task', icon: '📥' }
    ];

    // 활성화된 Task 타입만 필터링
    const enabledTypes = window.$enabledPaletteTaskTypes?.map(t => t.task_type) ||
      window.$paletteSettings?.visibleTaskTypes ||
      ['bpmn:ManualTask', 'bpmn:ServiceTask'];

    const filteredTaskTypes = taskTypes.filter(t => enabledTypes.includes(t.type));

    // 메뉴 컨테이너 생성
    const menu = document.createElement('div');
    menu.id = 'multi-task-replace-menu';
    menu.style.cssText = `
      position: fixed;
      left: ${event.clientX || event.x}px;
      top: ${event.clientY || event.y}px;
      background: white;
      border: 1px solid #ccc;
      border-radius: 4px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      z-index: 10000;
      min-width: 200px;
      padding: 4px 0;
      font-family: Arial, sans-serif;
      font-size: 13px;
    `;

    // 헤더
    const header = document.createElement('div');
    header.style.cssText = 'padding: 8px 12px; font-weight: bold; border-bottom: 1px solid #eee; color: #333;';
    header.textContent = `타입 변경 (${selectedTasks.length}개 Task)`;
    menu.appendChild(header);

    // 메뉴 아이템 생성
    filteredTaskTypes.forEach(taskType => {
      const item = document.createElement('div');
      item.style.cssText = `
        padding: 8px 12px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
      `;
      item.innerHTML = `<span>${taskType.icon}</span><span>${taskType.label}</span>`;

      item.addEventListener('mouseenter', () => {
        item.style.backgroundColor = '#f0f0f0';
      });
      item.addEventListener('mouseleave', () => {
        item.style.backgroundColor = 'white';
      });

      item.addEventListener('click', () => {
        // 선택된 모든 Task의 타입 변경
        const replacedElements = [];
        selectedTasks.forEach(task => {
          try {
            const replaced = bpmnReplace.replaceElement(task, { type: taskType.type });
            replacedElements.push(replaced);
          } catch (e) {
            console.warn('Task 타입 변경 실패:', task.id, e);
          }
        });

        // 변경된 요소들 다시 선택
        if (replacedElements.length > 0) {
          selection.select(replacedElements);
        }

        console.log(`${selectedTasks.length}개 Task를 ${taskType.type}으로 변경 완료`);
        menu.remove();
      });

      menu.appendChild(item);
    });

    // 문서에 메뉴 추가
    document.body.appendChild(menu);

    // 메뉴 외부 클릭 시 닫기
    const closeMenu = (e) => {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      }
    };
    setTimeout(() => {
      document.addEventListener('click', closeMenu);
    }, 100);

    // ESC 키로 닫기
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        menu.remove();
        document.removeEventListener('keydown', handleEsc);
      }
    };
    document.addEventListener('keydown', handleEsc);
  }
  if (actions['connect']) {
    actions['connect'].title = i18n.global.t('customContextPad.connect');
  }
  if (actions['delete']) {
    actions['delete'].title = i18n.global.t('customContextPad.delete');
  }

  // 속성 패널 열기 버튼 추가 (Task, Event, Gateway 등)
  const editableTypes = ['Task', 'Event', 'Gateway', 'SubProcess', 'CallActivity'];
  const isEditable = editableTypes.some(type => element.type && element.type.includes(type));

  if (isEditable) {
    const eventBus = injector.get('eventBus');

    actions['open-panel'] = {
      group: 'edit',
      className: 'mdi mdi-card-text-outline',
      title: i18n.global.t('customContextPad.openPanel') || '속성 패널 열기',
      action: {
        click: function(event, element) {
          // openPanel 이벤트 발생
          eventBus.fire('element.openPanel', { element: element });
        }
      }
    };
  }

  return actions;
};

// 다중 선택 시 ContextPad 엔트리
ContextPadProvider.prototype.getMultiElementContextPadEntries = function(elements) {
  const {
    _modeling: modeling,
    _injector: injector
  } = this;

  const actions = {};

  // Task 요소만 필터링
  const taskElements = elements.filter(el => el.type && el.type.includes('Task'));

  // Task가 2개 이상 선택된 경우 타입 변경 액션 추가
  if (taskElements.length >= 1) {
    const bpmnReplace = injector.get('bpmnReplace');
    const selection = injector.get('selection');

    actions['multi-replace'] = {
      group: 'edit',
      className: 'bpmn-icon-screw-wrench',
      title: i18n.global.t('customContextPad.replaceMultipleTasks') || `타입 변경 (${taskElements.length}개 Task)`,
      action: {
        click: function(event, elements) {
          showMultiTaskReplaceMenuForElements(event, taskElements, bpmnReplace, selection);
        }
      }
    };
  }

  return actions;
};

// 다중 Task 타입 변경 메뉴 (다중 선택용)
function showMultiTaskReplaceMenuForElements(event, selectedTasks, bpmnReplace, selection) {
  // 기존 메뉴 제거
  const existingMenu = document.getElementById('multi-task-replace-menu');
  if (existingMenu) {
    existingMenu.remove();
  }

  // 사용 가능한 Task 타입 목록
  const taskTypes = [
    { type: 'bpmn:ManualTask', label: i18n.global.t('CustomReplaceElement.replace-with-manual-task') || 'Manual Task', icon: '✋' },
    { type: 'bpmn:ServiceTask', label: i18n.global.t('CustomReplaceElement.replace-with-service-task') || 'Service Task', icon: '⚙️' },
    { type: 'bpmn:UserTask', label: i18n.global.t('CustomReplaceElement.replace-with-user-task') || 'User Task', icon: '👤' },
    { type: 'bpmn:ScriptTask', label: i18n.global.t('CustomReplaceElement.replace-with-script-task') || 'Script Task', icon: '📜' },
    { type: 'bpmn:BusinessRuleTask', label: i18n.global.t('CustomReplaceElement.replace-with-rule-task') || 'Business Rule Task', icon: '📋' },
    { type: 'bpmn:SendTask', label: i18n.global.t('CustomReplaceElement.replace-with-send-task') || 'Send Task', icon: '📤' },
    { type: 'bpmn:ReceiveTask', label: i18n.global.t('CustomReplaceElement.replace-with-receive-task') || 'Receive Task', icon: '📥' }
  ];

  // 활성화된 Task 타입만 필터링
  const enabledTypes = window.$enabledPaletteTaskTypes?.map(t => t.task_type) ||
    window.$paletteSettings?.visibleTaskTypes ||
    ['bpmn:ManualTask', 'bpmn:ServiceTask'];

  const filteredTaskTypes = taskTypes.filter(t => enabledTypes.includes(t.type));

  // 메뉴 컨테이너 생성
  const menu = document.createElement('div');
  menu.id = 'multi-task-replace-menu';
  menu.style.cssText = `
    position: fixed;
    left: ${event.clientX || event.x || 100}px;
    top: ${event.clientY || event.y || 100}px;
    background: white;
    border: 1px solid #ccc;
    border-radius: 4px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    z-index: 10000;
    min-width: 200px;
    padding: 4px 0;
    font-family: Arial, sans-serif;
    font-size: 13px;
  `;

  // 헤더
  const header = document.createElement('div');
  header.style.cssText = 'padding: 8px 12px; font-weight: bold; border-bottom: 1px solid #eee; color: #333;';
  header.textContent = `타입 변경 (${selectedTasks.length}개 Task)`;
  menu.appendChild(header);

  // 메뉴 아이템 생성
  filteredTaskTypes.forEach(taskType => {
    const item = document.createElement('div');
    item.style.cssText = `
      padding: 8px 12px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
    `;
    item.innerHTML = `<span>${taskType.icon}</span><span>${taskType.label}</span>`;

    item.addEventListener('mouseenter', () => {
      item.style.backgroundColor = '#f0f0f0';
    });
    item.addEventListener('mouseleave', () => {
      item.style.backgroundColor = 'white';
    });

    item.addEventListener('click', () => {
      // 선택된 모든 Task의 타입 변경
      const replacedElements = [];
      selectedTasks.forEach(task => {
        try {
          const replaced = bpmnReplace.replaceElement(task, { type: taskType.type });
          replacedElements.push(replaced);
        } catch (e) {
          console.warn('Task 타입 변경 실패:', task.id, e);
        }
      });

      // 변경된 요소들 다시 선택
      if (replacedElements.length > 0) {
        selection.select(replacedElements);
      }

      console.log(`${selectedTasks.length}개 Task를 ${taskType.type}으로 변경 완료`);
      menu.remove();
    });

    menu.appendChild(item);
  });

  // 문서에 메뉴 추가
  document.body.appendChild(menu);

  // 메뉴 외부 클릭 시 닫기
  const closeMenu = (e) => {
    if (!menu.contains(e.target)) {
      menu.remove();
      document.removeEventListener('click', closeMenu);
    }
  };
  setTimeout(() => {
    document.addEventListener('click', closeMenu);
  }, 100);

  // ESC 키로 닫기
  const handleEsc = (e) => {
    if (e.key === 'Escape') {
      menu.remove();
      document.removeEventListener('keydown', handleEsc);
    }
  };
  document.addEventListener('keydown', handleEsc);
}