// Shared helpers for reading/writing a BPMN element's uengine:Properties extension,
// and for resolving which task elements currently belong to a given lane.
// Used by lane rename sync and lane-agent-role cascade (see openspec/changes/lane-role-agent-cascade).

export function readUengineProperties(businessObject) {
    const values = businessObject?.extensionElements?.values;
    if (!values || values.length === 0) return {};
    const propsEl = values.find((v) => v.$type === 'uengine:Properties') || values[0];
    if (!propsEl?.json) return {};
    try {
        return JSON.parse(propsEl.json) || {};
    } catch (e) {
        return {};
    }
}

// Merges `updates` into the element's existing uengine:Properties JSON and writes it back,
// preserving any other extensionElements entries and the existing customProperties variables.
export function writeUengineProperties(modeler, shapeOrId, updates) {
    if (!modeler) return null;
    const elementRegistry = modeler.get('elementRegistry');
    const modeling = modeler.get('modeling');
    const bpmnFactory = modeler.get('bpmnFactory');

    const shapeElement = typeof shapeOrId === 'string' ? elementRegistry.get(shapeOrId) : shapeOrId;
    if (!shapeElement) return null;
    const bo = shapeElement.businessObject || shapeElement;

    const current = readUengineProperties(bo);
    const merged = { ...current, ...updates };
    const json = JSON.stringify(merged);

    let otherExtValues = [];
    let variables = [];
    if (bo.extensionElements?.values) {
        otherExtValues = bo.extensionElements.values.filter((v) => v.$type !== 'uengine:Properties');
        const existingProps = bo.extensionElements.values.find((v) => v.$type === 'uengine:Properties');
        variables = existingProps?.variables || [];
    }

    const uengineEl = bpmnFactory.create('uengine:Properties', { json, variables });
    const newExtensionElements = bpmnFactory.create('bpmn:ExtensionElements', {
        values: [...otherExtValues, uengineEl]
    });
    modeling.updateProperties(shapeElement, { extensionElements: newExtensionElements });
    return merged;
}

// Returns the live task/activity shapes currently inside a lane, via bpmn-js's
// auto-maintained `lane.flowNodeRef` (kept in sync by UpdateFlowNodeRefsBehavior on every
// move/resize) -- this reflects current geometric containment, not a stale persisted value.
export function getLaneTaskShapes(modeler, laneBusinessObject) {
    if (!modeler || !laneBusinessObject?.flowNodeRef) return [];
    const elementRegistry = modeler.get('elementRegistry');
    const isTaskLike = (bo) => {
        const type = bo?.$type || '';
        return type.includes('Task') || type.includes('Activity');
    };
    return laneBusinessObject.flowNodeRef
        .filter(isTaskLike)
        .map((flowNode) => elementRegistry.get(flowNode.id))
        .filter(Boolean);
}
