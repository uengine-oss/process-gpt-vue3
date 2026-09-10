const BEFORE = Symbol('moveSemanticOrder');

// Reorder only surviving members; semantic add/remove remains the command's job.
export function restoreOrder(collection, before) {
  const current = new Set(collection), previous = new Set(before);
  const ordered = before.filter(value => current.has(value));
  ordered.push(...collection.filter(value => !previous.has(value)));
  collection.splice(0, collection.length, ...ordered);
}

export default function MoveSemanticOrder(eventBus, elementRegistry) {
  for (const command of ['shape.move', 'connection.delete']) {
    eventBus.on(`commandStack.${command}.preExecute`, 1500, ({context}) => {
      const element = context.shape || context.connection;
      const node = element.businessObject;
      const collection = element.type === 'bpmn:Lane' ? node?.$parent?.lanes : node?.$parent?.flowElements;
      const collections = [collection];
      // BpmnUpdater also changes the direct visual parent's lane references.
      if (element.parent?.type === 'bpmn:Lane') collections.push(element.parent.businessObject.flowNodeRef);
      context[BEFORE] = collections.filter(Boolean).map(collection => ({collection, node, index: collection.indexOf(node)}))
        .filter(before => before.index >= 0);
    });
    eventBus.on(`commandStack.${command}.reverted`, 500, ({context}) => {
      for (const before of context[BEFORE] || []) {
        const current = before.collection.indexOf(before.node);
        if (current >= 0 && current !== before.index) {
          before.collection.splice(current, 1);
          before.collection.splice(before.index, 0, before.node);
        }
      }
    });
  }
  eventBus.on('commandStack.lane.updateRefs.preExecute', 1500, ({context}) => {
    context[BEFORE] = elementRegistry.getAll().filter(element => element.type === 'bpmn:Lane')
      .map(element => element.businessObject.flowNodeRef).filter(Boolean)
      .map(collection => ({collection, values: collection.slice()}));
  });
  eventBus.on('commandStack.lane.updateRefs.reverted', 500, ({context}) => {
    for (const before of context[BEFORE] || []) restoreOrder(before.collection, before.values);
  });
}

MoveSemanticOrder.$inject = ['eventBus', 'elementRegistry'];
