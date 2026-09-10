import UpdateFlowNodeRefsHandler from 'bpmn-js/lib/features/modeling/cmd/UpdateFlowNodeRefsHandler';

export default function SubprocessLaneOwnership(eventBus, elementRegistry) {
  const handler = new UpdateFlowNodeRefsHandler(elementRegistry);
  const frames = [];
  eventBus.on('commandStack.elements.move.preExecute', 6000, ({context}) => {
    const selected = new Set(context.shapes);
    const elements = elementRegistry.getAll();
    const lanes = elements.filter(element => element.type === 'bpmn:Lane');
    const owners = new Map();
    for (const shape of elements) {
      if (shape.type !== 'bpmn:SubProcess' || !shape.di?.isExpanded || selected.has(shape)) continue;
      const node = shape.businessObject;
      owners.set(node, { scope: node.$parent, lanes: lanes.filter(lane =>
        lane.businessObject.flowNodeRef?.includes(node)).map(lane => lane.businessObject) });
    }
    frames.push({context, owners});
  });
  eventBus.on('commandStack.lane.updateRefs.preExecute', 2000, ({context}) => {
    const frame = frames.at(-1);
    if (!frame || context.updates) return;
    const updates = handler._computeUpdates(context.flowNodeShapes, context.laneShapes);
    for (const update of updates) {
      const original = frame.owners.get(update.flowNode);
      if (!original || original.scope !== update.flowNode.$parent ||
        original.lanes.some(lane => !elementRegistry.get(lane.id))) continue;
      // Space insertion is geometric, not a request to change subprocess ownership.
      update.add = original.lanes.slice();
    }
    context.updates = updates;
  });
  eventBus.on('commandStack.elements.move.postExecuted', 0, ({context}) => {
    const index = frames.findIndex(frame => frame.context === context);
    if (index >= 0) frames.splice(index, 1);
  });
  eventBus.on(['commandStack.changed', 'import.done', 'diagram.destroy', 'error'], 0, () => {
    frames.length = 0;
  });
}

SubprocessLaneOwnership.$inject = ['eventBus', 'elementRegistry'];
