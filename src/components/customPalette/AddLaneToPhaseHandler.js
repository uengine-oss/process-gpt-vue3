/**
 * lane.add 실행 시 Phase/PhaseContainer 컨텍스트면 bpmn:Lane 대신 phase:Phase만 추가하도록
 * 기본 AddLaneHandler를 래핑한다.
 * (lane.add는 diagram.init 시 등록되므로, 그 이후에 래퍼 등록)
 */
export default function AddLaneToPhaseHandler(commandStack, modeling, elementFactory, eventBus, selection) {
  const self = this;

  function registerWrapper() {
    const original = commandStack._getHandler('lane.add');
    if (!original) return;
    if (self._wrapped) return;
    self._original = original;
    self._wrapped = true;
    commandStack.register('lane.add', self);
  }

  eventBus.on('diagram.init', registerWrapper);

  /** shape가 Phase/PhaseContainer이거나, 같은 laneSet에 phase:Phase가 있으면 페이즈 컨텍스트(레인 추가 시 Phase만 추가) */
  function isPhaseContext(context) {
    const shape = context && context.shape;
    if (!shape) return false;
    const bo = shape.businessObject;
    if (bo) {
      const type = bo.$type;
      const shapeType = shape.type;
      if (type === 'phase:Phase' || shapeType === 'phase:PhaseContainer' || type === 'phase:PhaseContainer') return true;
    }
    // PhaseContainer가 bpmn:Participant로 인식되는 경우: shape의 부모 체인 또는 laneSet 내용으로 판단
    let parent = shape.parent;
    while (parent) {
      if (parent.type === 'phase:PhaseContainer' || (parent.businessObject && parent.businessObject.$type === 'phase:PhaseContainer')) return true;
      parent = parent.parent;
    }
    const processRef = (shape.businessObject && shape.businessObject.processRef) || (shape.parent && shape.parent.businessObject && shape.parent.businessObject.processRef);
    const laneSet = processRef && processRef.laneSets && processRef.laneSets[0];
    if (laneSet && Array.isArray(laneSet.lanes) && laneSet.lanes.length > 0) {
      const firstLane = laneSet.lanes[0];
      if (firstLane.$type === 'phase:Phase') return true;
    }
    return false;
  }

  function isPhaseContainerVertical(phaseContainer) {
    if (!phaseContainer || phaseContainer.width == null || phaseContainer.height == null) return false;
    return phaseContainer.height > phaseContainer.width;
  }

  function addPhaseAndSetNewLane(context) {
    const shape = context.shape;
    const location = context.location;
    const isPhase = shape.businessObject && shape.businessObject.$type === 'phase:Phase';
    const phaseContainer = isPhase ? shape.parent : shape;
    if (!phaseContainer || (phaseContainer.type !== 'phase:PhaseContainer' && phaseContainer.businessObject?.$type !== 'phase:PhaseContainer')) return;
    const processRef = phaseContainer.businessObject && phaseContainer.businessObject.processRef;
    const laneSet = processRef && processRef.laneSets && processRef.laneSets[0];
    if (!laneSet || !laneSet.lanes) return;

    const atStart = location === 'top' || location === 'left';
    let insertIndex;
    if (isPhase) {
      const currentBo = shape.businessObject;
      const index = laneSet.lanes.indexOf(currentBo);
      if (index < 0) return;
      insertIndex = atStart ? index : index + 1;
    } else {
      insertIndex = atStart ? 0 : laneSet.lanes.length;
    }

    const newPhaseBo = elementFactory._moddle.create('phase:Phase', {
      id: `Phase_${Math.random().toString(36).substr(2, 9)}`,
      name: `Phase ${laneSet.lanes.length + 1}`
    });
    // laneSet.lanes에 수동 추가하지 않음 → createShape 시 BpmnUpdater가 추가한 뒤, 원하는 인덱스로 재정렬

    const pcX = phaseContainer.x;
    const pcY = phaseContainer.y;
    const pcW = phaseContainer.width;
    const pcH = phaseContainer.height;
    const newPhaseCount = laneSet.lanes.length + 1;

    if (isPhaseContainerVertical(phaseContainer)) {
      // 세로 PhaseContainer: 높이로 분할, isHorizontal: true
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
      let newShape = null;
      for (let i = 0; i < phaseCount; i++) {
        const phaseBo = laneSet.lanes[i];
        const h = i === phaseCount - 1 ? pcH - phaseHeightFinal * (phaseCount - 1) : phaseHeightFinal;
        const bounds = { x: pcX, y: pcY + i * phaseHeightFinal, width: pcW, height: h };
        const existing = phaseContainer.children.find(c => c.businessObject === phaseBo);
        if (existing) {
          modeling.resizeShape(existing, bounds);
          if (phaseBo === newPhaseBo) newShape = existing;
        } else {
          const phaseShape = elementFactory.createShape({
            type: 'phase:Phase',
            businessObject: phaseBo,
            width: bounds.width,
            height: bounds.height,
            isHorizontal: true
          });
          modeling.createShape(phaseShape, bounds, phaseContainer);
          newShape = phaseShape;
        }
      }
      context.newLane = newShape;
      if (selection && newShape) selection.select(newShape);
      return;
    }

    // 가로 PhaseContainer: 기존 로직 그대로
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
    let newShape = null;
    for (let i = 0; i < phaseCount; i++) {
      const phaseBo = laneSet.lanes[i];
      const w = i === phaseCount - 1 ? pcW - phaseWidthFinal * (phaseCount - 1) : phaseWidthFinal;
      const bounds = { x: pcX + i * phaseWidthFinal, y: pcY, width: w, height: pcH };
      const existing = phaseContainer.children.find(c => c.businessObject === phaseBo);
      if (existing) {
        modeling.resizeShape(existing, bounds);
        if (phaseBo === newPhaseBo) newShape = existing;
      } else {
        const phaseShape = elementFactory.createShape({
          type: 'phase:Phase',
          businessObject: phaseBo,
          width: bounds.width,
          height: bounds.height,
          isHorizontal: false
        });
        modeling.createShape(phaseShape, bounds, phaseContainer);
        newShape = phaseShape;
      }
    }
    context.newLane = newShape;
    if (selection && newShape) selection.select(newShape);
  }

  this.preExecute = function (context) {
    if (isPhaseContext(context)) {
      addPhaseAndSetNewLane(context);
      return;
    }
    if (self._original && self._original.preExecute) self._original.preExecute(context);
  };

  this.execute = function (context) {
    if (isPhaseContext(context)) return context.newLane ? [context.newLane] : [];
    if (self._original && self._original.execute) return self._original.execute(context);
    return [];
  };

  this.revert = function (context) {
    if (isPhaseContext(context)) return [];
    if (self._original && self._original.revert) return self._original.revert(context);
    return [];
  };
}

AddLaneToPhaseHandler.$inject = ['commandStack', 'modeling', 'elementFactory', 'eventBus', 'selection'];
