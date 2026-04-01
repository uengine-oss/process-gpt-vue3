import { assign } from 'min-dash';
import { i18n } from '@/main';
import { indexOf } from 'lodash';
import BackendFactory from '@/components/api/BackendFactory';

function __bpmnModelingPolicy() {
    try {
        return BackendFactory.createBackend().getBpmnModelingPolicy();
    } catch (e) {
        return {
            defaultAppendTaskBpmnType: 'bpmn:ManualTask',
            paletteVisibleTaskBpmnTypes: null,
            multiReplaceTaskBpmnTypes: null
        };
    }
}

export default function ContextPadProvider(
    config,
    injector,
    eventBus,
    contextPad,
    modeling,
    elementFactory,
    connect,
    create,
    popupMenu,
    canvas,
    rules,
    translate,
    autoPlace,
    selection
) {
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
    this._selection = selection;

    contextPad.registerProvider(500, this);

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
    'autoPlace',
    'selection'
];

ContextPadProvider.prototype.getContextPadEntries = function (element) {
    const {
        _modeling: modeling,
        _translate: translate,
        _connect: connect,
        _elementFactory: elementFactory,
        _create: create,
        _injector: injector,
        _selection: selection
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
        const participant = targetElement.type === 'bpmn:Participant' ? targetElement : targetElement.parent;

        if (!participant || participant.type !== 'bpmn:Participant') {
            console.warn('No participant found for lane equalization');
            return;
        }

        const lanes = participant.children.filter((child) => child.type === 'bpmn:Lane');
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
                const newHeight = isLast ? availableHeight - equalHeight * (sortedLanes.length - 1) : equalHeight;

                const newY = participant.y + laneHeaderHeight + equalHeight * index;

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
                const newWidth = isLast ? availableWidth - equalWidth * (sortedLanes.length - 1) : equalWidth;

                const newX = participant.x + laneHeaderWidth + equalWidth * index;

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
        // PhaseContainer는 processRef로 별도 Process를 참조 (heonum 구조)
        const processRef = phaseContainer.businessObject.processRef;
        const laneSet = processRef && processRef.laneSets && processRef.laneSets[0];
        if (!laneSet) {
            console.error('🚨 PhaseContainer processRef의 LaneSet을 찾을 수 없습니다.');
            return;
        }

        for (let i = 0; i < numPhases; i++) {
            const phase = elementFactory._moddle.create('phase:Phase', {
                id: `Phase_${Math.random().toString(36).substr(2, 9)}`,
                name: `Phase ${i + 1}`
            });
            laneSet.lanes.push(phase);
        }
        console.log(`✅ ${numPhases}개의 Phase 추가 완료.`);
    }

    function isPhaseContainerShape(shape) {
        return (
            shape &&
            (shape.type === 'phase:PhaseContainer' || (shape.businessObject && shape.businessObject.$type === 'phase:PhaseContainer'))
        );
    }

    /** PhaseContainer가 세로 배치(왼쪽 붙음)인지: 높이 > 너비 */
    function isPhaseContainerVertical(phaseContainer) {
        if (!phaseContainer || phaseContainer.width == null || phaseContainer.height == null) return false;
        return phaseContainer.height > phaseContainer.width;
    }

    /** Phase 좌/우에 새 Phase 추가 후 전체 너비 재배분 */
    function insertPhaseAt(phaseElement, side) {
        const phaseContainer = phaseElement.parent;
        if (!isPhaseContainerShape(phaseContainer)) {
            console.error('🚨 Phase의 부모 PhaseContainer를 찾을 수 없습니다.');
            return;
        }
        const processRef = phaseContainer.businessObject.processRef;
        const laneSet = processRef && processRef.laneSets && processRef.laneSets[0];
        if (!laneSet || !laneSet.lanes) {
            console.error('🚨 PhaseContainer processRef의 LaneSet을 찾을 수 없습니다.');
            return;
        }
        const currentBo = phaseElement.businessObject;
        const index = laneSet.lanes.indexOf(currentBo);
        if (index < 0) return;
        const insertIndex = side === 'left' ? index : index + 1;
        const newPhaseBo = elementFactory._moddle.create('phase:Phase', {
            id: `Phase_${Math.random().toString(36).substr(2, 9)}`,
            name: `Phase ${laneSet.lanes.length + 1}`
        });

        const pcX = phaseContainer.x;
        const pcY = phaseContainer.y;
        const pcW = phaseContainer.width;
        const pcH = phaseContainer.height;
        const newPhaseCount = laneSet.lanes.length + 1;

        if (isPhaseContainerVertical(phaseContainer)) {
            const phaseHeight = pcH / newPhaseCount;
            const newBounds = { x: pcX, y: pcY + insertIndex * phaseHeight, width: pcW, height: phaseHeight };
            const newPhaseShape = elementFactory.createShape({
                type: 'phase:Phase',
                businessObject: newPhaseBo,
                width: newBounds.width,
                height: newBounds.height,
                isHorizontal: true
            });
            modeling.createShape(newPhaseShape, newBounds, phaseContainer);
            const addedIndex = laneSet.lanes.indexOf(newPhaseBo);
            if (addedIndex >= 0) {
                laneSet.lanes.splice(addedIndex, 1);
                laneSet.lanes.splice(insertIndex, 0, newPhaseBo);
            }
            const phaseCount = laneSet.lanes.length;
            const phaseHeightFinal = pcH / phaseCount;
            for (let i = 0; i < phaseCount; i++) {
                const phaseBo = laneSet.lanes[i];
                const h = i === phaseCount - 1 ? pcH - phaseHeightFinal * (phaseCount - 1) : phaseHeightFinal;
                const bounds = { x: pcX, y: pcY + i * phaseHeightFinal, width: pcW, height: h };
                const existing = phaseContainer.children.find((c) => c.businessObject === phaseBo);
                if (existing) {
                    modeling.resizeShape(existing, bounds);
                } else {
                    const phaseShape = elementFactory.createShape({
                        type: 'phase:Phase',
                        businessObject: phaseBo,
                        width: bounds.width,
                        height: bounds.height,
                        isHorizontal: true
                    });
                    modeling.createShape(phaseShape, bounds, phaseContainer);
                }
            }
            if (selection && newPhaseShape) selection.select(newPhaseShape);
            return;
        }

        const phaseWidth = pcW / newPhaseCount;
        const newBounds = { x: pcX + insertIndex * phaseWidth, y: pcY, width: phaseWidth, height: pcH };
        const newPhaseShape = elementFactory.createShape({
            type: 'phase:Phase',
            businessObject: newPhaseBo,
            width: newBounds.width,
            height: newBounds.height,
            isHorizontal: false
        });
        modeling.createShape(newPhaseShape, newBounds, phaseContainer);
        const addedIndex = laneSet.lanes.indexOf(newPhaseBo);
        if (addedIndex >= 0) {
            laneSet.lanes.splice(addedIndex, 1);
            laneSet.lanes.splice(insertIndex, 0, newPhaseBo);
        }

        const phaseCount = laneSet.lanes.length;
        const phaseWidthFinal = pcW / phaseCount;
        for (let i = 0; i < phaseCount; i++) {
            const phaseBo = laneSet.lanes[i];
            const w = i === phaseCount - 1 ? pcW - phaseWidthFinal * (phaseCount - 1) : phaseWidthFinal;
            const bounds = { x: pcX + i * phaseWidthFinal, y: pcY, width: w, height: pcH };
            const existing = phaseContainer.children.find((c) => c.businessObject === phaseBo);
            if (existing) {
                modeling.resizeShape(existing, bounds);
            } else {
                const phaseShape = elementFactory.createShape({
                    type: 'phase:Phase',
                    businessObject: phaseBo,
                    width: bounds.width,
                    height: bounds.height,
                    isHorizontal: false
                });
                modeling.createShape(phaseShape, bounds, phaseContainer);
            }
        }
        if (selection && newPhaseShape) selection.select(newPhaseShape);
    }

    /** PhaseContainer 맨 앞/맨 뒤에 Phase 하나 추가 후 전체 너비 재배분 */
    function addPhaseToContainer(phaseContainerElement, position) {
        if (!isPhaseContainerShape(phaseContainerElement)) return;
        const processRef = phaseContainerElement.businessObject.processRef;
        const laneSet = processRef && processRef.laneSets && processRef.laneSets[0];
        if (!laneSet || !laneSet.lanes) return;
        const newPhaseBo = elementFactory._moddle.create('phase:Phase', {
            id: `Phase_${Math.random().toString(36).substr(2, 9)}`,
            name: `Phase ${laneSet.lanes.length + 1}`
        });

        const pcX = phaseContainerElement.x;
        const pcY = phaseContainerElement.y;
        const pcW = phaseContainerElement.width;
        const pcH = phaseContainerElement.height;
        const newPhaseCount = laneSet.lanes.length + 1;
        const insertIndex = position === 'start' ? 0 : laneSet.lanes.length;

        if (isPhaseContainerVertical(phaseContainerElement)) {
            const phaseHeight = pcH / newPhaseCount;
            const newBounds = { x: pcX, y: pcY + insertIndex * phaseHeight, width: pcW, height: phaseHeight };
            const newPhaseShape = elementFactory.createShape({
                type: 'phase:Phase',
                businessObject: newPhaseBo,
                width: newBounds.width,
                height: newBounds.height,
                isHorizontal: true
            });
            modeling.createShape(newPhaseShape, newBounds, phaseContainerElement);
            if (position === 'start') {
                const addedIndex = laneSet.lanes.indexOf(newPhaseBo);
                if (addedIndex >= 0) {
                    laneSet.lanes.splice(addedIndex, 1);
                    laneSet.lanes.unshift(newPhaseBo);
                }
            }
            const phaseCount = laneSet.lanes.length;
            const phaseHeightFinal = pcH / phaseCount;
            for (let i = 0; i < phaseCount; i++) {
                const phaseBo = laneSet.lanes[i];
                const h = i === phaseCount - 1 ? pcH - phaseHeightFinal * (phaseCount - 1) : phaseHeightFinal;
                const bounds = { x: pcX, y: pcY + i * phaseHeightFinal, width: pcW, height: h };
                const existing = phaseContainerElement.children.find((c) => c.businessObject === phaseBo);
                if (existing) {
                    modeling.resizeShape(existing, bounds);
                } else {
                    const phaseShape = elementFactory.createShape({
                        type: 'phase:Phase',
                        businessObject: phaseBo,
                        width: bounds.width,
                        height: bounds.height,
                        isHorizontal: true
                    });
                    modeling.createShape(phaseShape, bounds, phaseContainerElement);
                }
            }
            if (selection && newPhaseShape) selection.select(newPhaseShape);
            return;
        }

        const phaseWidth = pcW / newPhaseCount;
        const newBounds = { x: pcX + insertIndex * phaseWidth, y: pcY, width: phaseWidth, height: pcH };
        const newPhaseShape = elementFactory.createShape({
            type: 'phase:Phase',
            businessObject: newPhaseBo,
            width: newBounds.width,
            height: newBounds.height,
            isHorizontal: false
        });
        modeling.createShape(newPhaseShape, newBounds, phaseContainerElement);
        if (position === 'start') {
            const addedIndex = laneSet.lanes.indexOf(newPhaseBo);
            if (addedIndex >= 0) {
                laneSet.lanes.splice(addedIndex, 1);
                laneSet.lanes.unshift(newPhaseBo);
            }
        }

        const phaseCount = laneSet.lanes.length;
        const phaseWidthFinal = pcW / phaseCount;
        for (let i = 0; i < phaseCount; i++) {
            const phaseBo = laneSet.lanes[i];
            const w = i === phaseCount - 1 ? pcW - phaseWidthFinal * (phaseCount - 1) : phaseWidthFinal;
            const bounds = { x: pcX + i * phaseWidthFinal, y: pcY, width: w, height: pcH };
            const existing = phaseContainerElement.children.find((c) => c.businessObject === phaseBo);
            if (existing) {
                modeling.resizeShape(existing, bounds);
            } else {
                const phaseShape = elementFactory.createShape({
                    type: 'phase:Phase',
                    businessObject: phaseBo,
                    width: bounds.width,
                    height: bounds.height,
                    isHorizontal: false
                });
                modeling.createShape(phaseShape, bounds, phaseContainerElement);
            }
        }
        if (selection && newPhaseShape) selection.select(newPhaseShape);
    }

    function addPhaseContainer(participantElement) {
        const parentElement = participantElement.parent;
        if (!parentElement) {
            console.error('🚨 Participant의 부모 요소를 찾을 수 없습니다.', participantElement);
            return null;
        }

        const participantDi = getDi(participantElement);
        if (!participantDi) {
            console.error('🚨 Participant의 DI 정보가 없습니다.', participantElement);
            return null;
        }

        const participantBounds = participantElement.getBounds
            ? participantElement.getBounds()
            : { x: participantElement.x, y: participantElement.y, width: participantElement.width, height: participantElement.height };
        const isParticipantVertical = participantDi.isHorizontal === false;

        const processBo = elementFactory._moddle.create('bpmn:Process', {
            id: `Process_${Math.random().toString(36).substr(2, 9)}`,
            isExecutable: false,
            laneSets: []
        });

        const laneSet = elementFactory._moddle.create('bpmn:LaneSet', {
            id: `LaneSet_${Math.random().toString(36).substr(2, 9)}`,
            lanes: []
        });
        processBo.laneSets = [laneSet];

        const definitions = parentElement.businessObject.$parent;
        if (definitions && definitions.get('rootElements')) {
            definitions.get('rootElements').push(processBo);
        }

        const phaseNames = ['Phase 1', 'Phase 2', 'Phase 3'];
        const phaseBos = [];
        for (let i = 0; i < 3; i++) {
            phaseBos.push(
                elementFactory._moddle.create('phase:Phase', {
                    id: `Phase_${Math.random().toString(36).substr(2, 9)}`,
                    name: phaseNames[i]
                })
            );
        }

        if (isParticipantVertical) {
            const phaseStripWidth = 60;
            const phaseContainerBO = elementFactory._moddle.create('phase:PhaseContainer', {
                id: `PhaseContainer_${Math.random().toString(36).substr(2, 9)}`,
                numPhases: 3,
                processRef: processBo,
                isHorizontal: true
            });
            const pcX = participantBounds.x - phaseStripWidth;
            const pcY = participantBounds.y;
            const pcW = phaseStripWidth;
            const pcH = participantBounds.height;

            const phaseContainerDI = elementFactory._moddle.create('bpmndi:BPMNShape', {
                id: `DI_${phaseContainerBO.id}`,
                bpmnElement: phaseContainerBO,
                isHorizontal: true,
                bounds: { x: pcX, y: pcY, width: pcW, height: pcH }
            });
            phaseContainerDI.$parent = participantDi.$parent;

            const parentBO = parentElement.businessObject;
            if (!Array.isArray(parentBO.children)) {
                parentBO.children = [];
            }
            parentBO.children.push(phaseContainerBO);

            let planeElement = participantDi.$parent.get('planeElement');
            if (!Array.isArray(planeElement)) {
                planeElement = [planeElement];
                participantDi.$parent.set('planeElement', planeElement);
            }
            planeElement.push(phaseContainerDI);

            const phaseContainer = elementFactory.createShape({
                type: 'phase:PhaseContainer',
                businessObject: phaseContainerBO,
                width: pcW,
                height: pcH,
                isHorizontal: true
            });
            modeling.createShape(phaseContainer, { x: pcX, y: pcY }, parentElement);
            modeling.resizeShape(phaseContainer, { x: pcX, y: pcY, width: pcW, height: pcH });

            const phaseHeight = Math.floor(pcH / 3);
            for (let i = 0; i < 3; i++) {
                const phaseBo = phaseBos[i];
                const phaseH = i === 2 ? pcH - phaseHeight * 2 : phaseHeight;
                const bounds = { x: pcX, y: pcY + i * phaseHeight, width: pcW, height: phaseH };
                const phaseShape = elementFactory.createShape({
                    type: 'phase:Phase',
                    businessObject: phaseBo,
                    width: bounds.width,
                    height: bounds.height,
                    isHorizontal: true
                });
                modeling.createShape(phaseShape, bounds, phaseContainer);
            }
            console.log('✅ PhaseContainer + Phase 3개 생성 완료 (세로 participant, 왼쪽, isHorizontal: true):', phaseContainer);
            return phaseContainer;
        }

        const phaseContainerBO = elementFactory._moddle.create('phase:PhaseContainer', {
            id: `PhaseContainer_${Math.random().toString(36).substr(2, 9)}`,
            numPhases: 3,
            processRef: processBo,
            isHorizontal: false
        });

        const phaseHeight = 60;
        const phaseContainerHeight = phaseHeight;
        const phaseContainerY = participantBounds.y - phaseContainerHeight;

        const phaseContainerDI = elementFactory._moddle.create('bpmndi:BPMNShape', {
            id: `DI_${phaseContainerBO.id}`,
            bpmnElement: phaseContainerBO,
            isHorizontal: false,
            bounds: {
                x: participantBounds.x,
                y: phaseContainerY,
                width: participantBounds.width,
                height: phaseContainerHeight
            }
        });
        phaseContainerDI.isHorizontal = false;
        phaseContainerDI.$parent = participantDi.$parent;

        const parentBO = parentElement.businessObject;
        if (!Array.isArray(parentBO.children)) {
            parentBO.children = [];
        }
        parentBO.children.push(phaseContainerBO);

        let planeElement = participantDi.$parent.get('planeElement');
        if (!Array.isArray(planeElement)) {
            planeElement = [planeElement];
            participantDi.$parent.set('planeElement', planeElement);
        }
        planeElement.push(phaseContainerDI);

        const phaseContainer = elementFactory.createShape({
            type: 'phase:PhaseContainer',
            businessObject: phaseContainerBO,
            width: participantBounds.width,
            height: phaseContainerHeight,
            isHorizontal: false
        });

        const pcX = participantBounds.x;
        const pcY = participantBounds.y - phaseContainerHeight;
        const pcW = participantBounds.width;
        const pcH = phaseContainerHeight;

        const position = { x: pcX, y: pcY };
        modeling.createShape(phaseContainer, position, parentElement);
        modeling.resizeShape(phaseContainer, { x: pcX, y: pcY, width: pcW, height: pcH });

        const phaseWidth = Math.floor(pcW / 3);
        for (let i = 0; i < 3; i++) {
            const phaseBo = phaseBos[i];
            const phaseW = i === 2 ? pcW - phaseWidth * 2 : phaseWidth;
            const bounds = {
                x: pcX + i * phaseWidth,
                y: pcY,
                width: phaseW,
                height: phaseHeight
            };
            const phaseShape = elementFactory.createShape({
                type: 'phase:Phase',
                businessObject: phaseBo,
                width: bounds.width,
                height: bounds.height,
                isHorizontal: false
            });
            modeling.createShape(phaseShape, bounds, phaseContainer);
        }

        console.log('✅ PhaseContainer + Phase 3개 생성 완료 (heonum 구조):', phaseContainer);
        return phaseContainer;
    }

    const actions = this._originalGetContextPadEntries(element);
    const isPhase = element.businessObject && element.businessObject.$type === 'phase:Phase';
    const isPhaseContainer =
        element.type === 'phase:PhaseContainer' || (element.businessObject && element.businessObject.$type === 'phase:PhaseContainer');
    const usePhaseAdd = isPhase || isPhaseContainer;
    const showLaneGroup =
        element.type === 'bpmn:Participant' ||
        element.type === 'bpmn:Lane' ||
        element.type === 'phase:PhaseContainer' ||
        element.type === 'phase:Phase' ||
        usePhaseAdd;
    const needPhaseUpdater = showLaneGroup && usePhaseAdd;
    const phaseContainerForPad = usePhaseAdd ? (isPhase ? element.parent : element) : null;
    const isPhaseVertical = phaseContainerForPad && isPhaseContainerVertical(phaseContainerForPad);

    if (showLaneGroup) {
        const isHorizontal = element.di && element.di.isHorizontal;
        assign(actions, {
            'lane-insert-above': {
                group: 'lane',
                className: usePhaseAdd
                    ? isPhaseVertical
                        ? 'mdi mdi-arrow-up-bold'
                        : 'mdi mdi-arrow-left-bold'
                    : isHorizontal
                    ? 'bpmn-icon-lane-insert-above'
                    : 'bpmn-icon-lane-insert-above icon-rotate-270',
                title: usePhaseAdd
                    ? isPhaseVertical
                        ? i18n.global.t('customContextPad.phaseAbove')
                        : i18n.global.t('customContextPad.phaseLeft')
                    : isHorizontal
                    ? i18n.global.t('customContextPad.laneAbove')
                    : i18n.global.t('customContextPad.laneToTheLeft'),
                action: {
                    click: usePhaseAdd
                        ? function (event, el) {
                              if (isPhase) insertPhaseAt(el, 'left');
                              else addPhaseToContainer(el, 'start');
                          }
                        : actions['lane-insert-above'] && actions['lane-insert-above'].action.click
                }
            },
            'lane-insert-below': {
                group: 'lane',
                className: usePhaseAdd
                    ? isPhaseVertical
                        ? 'mdi mdi-arrow-down-bold'
                        : 'mdi mdi-arrow-right-bold'
                    : isHorizontal
                    ? 'bpmn-icon-lane-insert-below'
                    : 'bpmn-icon-lane-insert-below icon-rotate-270',
                title: usePhaseAdd
                    ? isPhaseVertical
                        ? i18n.global.t('customContextPad.phaseBelow')
                        : i18n.global.t('customContextPad.phaseRight')
                    : isHorizontal
                    ? i18n.global.t('customContextPad.laneBelow')
                    : i18n.global.t('customContextPad.laneToTheRight'),
                action: {
                    click: usePhaseAdd
                        ? function (event, el) {
                              if (isPhase) insertPhaseAt(el, 'right');
                              else addPhaseToContainer(el, 'end');
                          }
                        : actions['lane-insert-below'] && actions['lane-insert-below'].action.click
                }
            },
            ...(usePhaseAdd
                ? {}
                : {
                      'lane-divide-two': {
                          group: 'lane',
                          className: isHorizontal ? 'bpmn-icon-lane-divide-two' : 'bpmn-icon-lane-divide-two icon-rotate-270',
                          title: i18n.global.t('customContextPad.laneDivideTwo'),
                          action: { click: divideIntoTwoLanes }
                      },
                      'lane-divide-three': {
                          group: 'lane',
                          className: isHorizontal ? 'bpmn-icon-lane-divide-three' : 'bpmn-icon-lane-divide-three icon-rotate-270',
                          title: i18n.global.t('customContextPad.laneDivideThree'),
                          action: { click: divideIntoThreeLanes }
                      },
                      'lane-insert-single': {
                          group: 'lane',
                          className: isHorizontal ? 'bpmn-icon-participant' : 'bpmn-icon-participant icon-rotate-90',
                          title: isHorizontal ? i18n.global.t('customContextPad.lane') : i18n.global.t('customContextPad.laneToTheLeft'),
                          action: function (event, element) {
                              const laneCount = element.children.filter((child) => child.type === 'bpmn:Lane').length;
                              insertLanes(1);
                          }
                      }
                  }),
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
            connect: {
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
                            addPhaseContainer(element);
                        }
                    }
                }
            });
        }
    }

    if (needPhaseUpdater) {
        return function (entries) {
            assign(entries, actions);
            delete entries['lane-divide-two'];
            delete entries['lane-divide-three'];
            delete entries['lane-insert-single']; // Phase 선택 시 "페이즈 추가" 버튼 제거 (위/아래/좌/우만 유지)
            return entries;
        };
    }

    if (actions['append.end-event']) {
        actions['append.end-event'].title = i18n.global.t('customContextPad.endEvent');
    }
    if (actions['append.gateway']) {
        actions['append.gateway'].title = i18n.global.t('customContextPad.gateway');
    }
    if (actions['append.append-task']) {
        const appendTaskType = __bpmnModelingPolicy().defaultAppendTaskBpmnType;
        const newAction = appendAction(appendTaskType, actions['append.append-task'].className, i18n.global.t('customContextPad.task'), {});

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
                    const selectedTasks = selectedElements.filter((el) => el.type && el.type.includes('Task'));

                    if (selectedTasks.length > 1) {
                        // 다중 Task 선택 시 HTML 기반 드롭다운 메뉴 표시
                        showMultiTaskReplaceMenu(event, selectedTasks, bpmnReplace, selection);
                    } else {
                        // 단일 요소 선택 시 기존 동작
                        var position = assign(
                            {
                                x: event.x,
                                y: event.y
                            },
                            {
                                cursor: { x: event.x, y: event.y }
                            }
                        );

                        popupMenu.open(element, 'bpmn-replace', position, {
                            title: i18n.global.t('customContextPad.replace'),
                            width: 300,
                            search: true
                        });
                    }
                }
            }
        };
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
            {
                type: 'bpmn:ServiceTask',
                label: i18n.global.t('CustomReplaceElement.replace-with-service-task') || 'Service Task',
                icon: '⚙️'
            },
            { type: 'bpmn:UserTask', label: i18n.global.t('CustomReplaceElement.replace-with-user-task') || 'User Task', icon: '👤' },
            { type: 'bpmn:ScriptTask', label: i18n.global.t('CustomReplaceElement.replace-with-script-task') || 'Script Task', icon: '📜' },
            {
                type: 'bpmn:BusinessRuleTask',
                label: i18n.global.t('CustomReplaceElement.replace-with-rule-task') || 'Business Rule Task',
                icon: '📋'
            },
            { type: 'bpmn:SendTask', label: i18n.global.t('CustomReplaceElement.replace-with-send-task') || 'Send Task', icon: '📤' },
            {
                type: 'bpmn:ReceiveTask',
                label: i18n.global.t('CustomReplaceElement.replace-with-receive-task') || 'Receive Task',
                icon: '📥'
            }
        ];

        const policy = __bpmnModelingPolicy();
        const enabledTypes = policy.multiReplaceTaskBpmnTypes
            ? policy.multiReplaceTaskBpmnTypes
            : window.$enabledPaletteTaskTypes?.map((t) => t.task_type) ||
              window.$paletteSettings?.visibleTaskTypes || ['bpmn:ManualTask', 'bpmn:ServiceTask'];

        const filteredTaskTypes = taskTypes.filter((t) => enabledTypes.includes(t.type));

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
        filteredTaskTypes.forEach((taskType) => {
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
                selectedTasks.forEach((task) => {
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
    const isEditable = editableTypes.some((type) => element.type && element.type.includes(type));

    if (isEditable) {
        const eventBus = injector.get('eventBus');

        actions['open-panel'] = {
            group: 'edit',
            className: 'mdi mdi-card-text-outline',
            title: i18n.global.t('customContextPad.openPanel') || '속성 패널 열기',
            action: {
                click: function (event, element) {
                    // openPanel 이벤트 발생
                    eventBus.fire('element.openPanel', { element: element });
                }
            }
        };

        // Task 타입에만 코멘트 작성 버튼 추가
        const isTaskElement = element.type && element.type.includes('Task');
        if (isTaskElement) {
            actions['add-comment'] = {
                group: 'edit',
                className: 'mdi mdi-comment-plus-outline',
                title: i18n.global.t('customContextPad.addComment') || '코멘트 작성',
                action: {
                    click: function (event, element) {
                        eventBus.fire('element.addComment', { element: element });
                    }
                }
            };
        }
    }

    return actions;
};

// 다중 선택 시 ContextPad 엔트리
ContextPadProvider.prototype.getMultiElementContextPadEntries = function (elements) {
    const { _modeling: modeling, _injector: injector } = this;

    const actions = {};

    // Task 요소만 필터링
    const taskElements = elements.filter((el) => el.type && el.type.includes('Task'));

    // Task가 2개 이상 선택된 경우 타입 변경 액션 추가
    if (taskElements.length >= 1) {
        const bpmnReplace = injector.get('bpmnReplace');
        const selection = injector.get('selection');

        actions['multi-replace'] = {
            group: 'edit',
            className: 'bpmn-icon-screw-wrench',
            title: i18n.global.t('customContextPad.replaceMultipleTasks') || `타입 변경 (${taskElements.length}개 Task)`,
            action: {
                click: function (event, elements) {
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
        {
            type: 'bpmn:BusinessRuleTask',
            label: i18n.global.t('CustomReplaceElement.replace-with-rule-task') || 'Business Rule Task',
            icon: '📋'
        },
        { type: 'bpmn:SendTask', label: i18n.global.t('CustomReplaceElement.replace-with-send-task') || 'Send Task', icon: '📤' },
        { type: 'bpmn:ReceiveTask', label: i18n.global.t('CustomReplaceElement.replace-with-receive-task') || 'Receive Task', icon: '📥' }
    ];

    const policy = __bpmnModelingPolicy();
    const enabledTypes = policy.multiReplaceTaskBpmnTypes
        ? policy.multiReplaceTaskBpmnTypes
        : window.$enabledPaletteTaskTypes?.map((t) => t.task_type) ||
          window.$paletteSettings?.visibleTaskTypes || ['bpmn:ManualTask', 'bpmn:ServiceTask'];

    const filteredTaskTypes = taskTypes.filter((t) => enabledTypes.includes(t.type));

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
    filteredTaskTypes.forEach((taskType) => {
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
            selectedTasks.forEach((task) => {
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
