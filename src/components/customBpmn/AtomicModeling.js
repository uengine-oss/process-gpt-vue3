const COMMAND = 'uengine.atomicModeling';

function AtomicModelingHandler() {}

AtomicModelingHandler.prototype.preExecute = function(context) {
  context.execute();
};

AtomicModelingHandler.prototype.execute = function() {
  return [];
};

AtomicModelingHandler.prototype.revert = function() {
  return [];
};

export default function AtomicModeling(commandStack, eventBus) {
  let executing = false;
  let flushingHistory = false;

  eventBus.on([`commandStack.${COMMAND}.executed`, `commandStack.${COMMAND}.reverted`], () => {
    flushingHistory = true;
  });
  // Keep elements.changed consumers inside the transaction on undo/redo too.
  eventBus.on('commandStack.changed', 0, () => {
    flushingHistory = false;
  });

  commandStack.registerHandler(COMMAND, AtomicModelingHandler);

  this.execute = function(callback) {
    executing = true;
    try {
      commandStack.execute(COMMAND, { execute: callback });
    } finally {
      executing = false;
    }
  };

  this.isExecuting = function() {
    return executing || flushingHistory;
  };
}

AtomicModeling.$inject = [ 'commandStack', 'eventBus' ];
