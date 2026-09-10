import { is } from 'bpmn-js/lib/util/ModelUtil';

/** A task type change does not change its outline or its connection anchors. */
export default function PreserveTaskReplacementConnections(eventBus) {
    eventBus.on('replace.start', 1500, ({ element, attrs }) => {
        if (!is(element, 'bpmn:Task') || !is(attrs, 'bpmn:Task')) return;

        // bpmnReplace resets non-resizable tasks to the default 100x80 size.
        // Imported tasks may be wider; a type change must keep their bounds too.
        attrs.width = element.width;
        attrs.height = element.height;
    });

    eventBus.on('commandStack.shape.replace.preExecute', 1500, ({ context }) => {
        const { oldShape, newData } = context;
        if (!is(oldShape, 'bpmn:Task') || !is(newData, 'bpmn:Task')) return;

        // replaceShape receives the new center, whereas oldShape stores its top-left.
        if (
            newData.width !== oldShape.width ||
            newData.height !== oldShape.height ||
            newData.x !== Math.round(oldShape.x + oldShape.width / 2) ||
            newData.y !== Math.round(oldShape.y + oldShape.height / 2)
        )
            return;

        // The reconnect commands still update BPMN references and support undo/redo.
        // Skip only their routing step so manual bends and labels stay in place.
        context.hints = { ...context.hints, layoutConnection: false };
    });
}

PreserveTaskReplacementConnections.$inject = ['eventBus'];
