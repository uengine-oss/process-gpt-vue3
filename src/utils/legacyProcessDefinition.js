export function isLegacyProcessDefinition(definition) {
    if (!definition || typeof definition !== 'object') return false;
    return (
        Array.isArray(definition.activities) ||
        Array.isArray(definition.events) ||
        Array.isArray(definition.gateways) ||
        Array.isArray(definition.sequences)
    );
}

export function convertLegacyProcessDefinitionToElements(definition) {
    const oldObj = JSON.parse(JSON.stringify(definition || {}));
    oldObj.elements = [];

    const typeMapping = {
        startEvent: 'StartEvent',
        endEvent: 'EndEvent',
        userTask: 'UserActivity',
        serviceTask: 'ServiceActivity',
        scriptTask: 'ScriptActivity',
        sendTask: 'EmailActivity',
        exclusiveGateway: 'ExclusiveGateway',
        parallelGateway: 'ParallelGateway',
        task: 'Activity'
    };

    const normalizeBpmnId = (rawId) => {
        const base = String(rawId || '').trim();
        if (!base) return `id_${Math.random().toString(36).slice(2, 10)}`;
        const safe = base.replace(/[^A-Za-z0-9_.-]/g, '_');
        return /^[A-Za-z_]/.test(safe) ? safe : `id_${safe}`;
    };

    const idMap = {};
    const registerId = (id) => {
        if (!id) return;
        if (!idMap[id]) idMap[id] = normalizeBpmnId(id);
    };

    (oldObj.activities || []).forEach((activity) => registerId(activity.id));
    (oldObj.events || []).forEach((event) => registerId(event.id));
    (oldObj.gateways || []).forEach((gateway) => registerId(gateway.id));
    (oldObj.sequences || []).forEach((sequence) => {
        registerId(sequence.source);
        registerId(sequence.target);
    });

    if (Array.isArray(oldObj.activities)) {
        oldObj.activities.forEach((activity) => {
            let checkpoints = [];
            let duration = activity.duration || '5';
            try {
                if (activity.properties) {
                    const props = typeof activity.properties === 'string' ? JSON.parse(activity.properties) : activity.properties;
                    if (props?.checkpoints) checkpoints = props.checkpoints;
                    if (props?.duration) duration = props.duration;
                }
            } catch (e) {}

            oldObj.elements.push({
                elementType: 'Activity',
                id: idMap[activity.id] || normalizeBpmnId(activity.id),
                name: activity.name,
                type: typeMapping[activity.type] || 'UserActivity',
                source: '',
                description: activity.description || '',
                instruction: activity.instruction || '',
                role: activity.role || '',
                inputData: activity.inputData || [],
                outputData: activity.outputData || [],
                checkpoints,
                duration
            });
        });
    }

    if (Array.isArray(oldObj.events)) {
        oldObj.events.forEach((event) => {
            oldObj.elements.push({
                elementType: 'Event',
                id: idMap[event.id] || normalizeBpmnId(event.id),
                name: event.name,
                role: event.role || '',
                source: '',
                type: typeMapping[event.type] || event.type,
                description: event.description || '',
                trigger: event.type === 'startEvent' ? '프로세스 시작' : '프로세스 종료'
            });
        });
    }

    if (Array.isArray(oldObj.gateways)) {
        oldObj.gateways.forEach((gateway) => {
            oldObj.elements.push({
                elementType: 'Gateway',
                id: idMap[gateway.id] || normalizeBpmnId(gateway.id),
                name: gateway.name || 'Gateway',
                role: gateway.role || '',
                source: '',
                type: typeMapping[gateway.type] || 'ExclusiveGateway',
                description: gateway.description || '분기점'
            });
        });
    }

    if (Array.isArray(oldObj.sequences)) {
        const targetToSourceMap = {};
        oldObj.sequences.forEach((sequence) => {
            if (!targetToSourceMap[sequence.target]) targetToSourceMap[sequence.target] = [];
            targetToSourceMap[sequence.target].push(idMap[sequence.source] || normalizeBpmnId(sequence.source));
        });

        oldObj.elements.forEach((element) => {
            if (targetToSourceMap[element.id] && targetToSourceMap[element.id].length > 0) {
                element.source = targetToSourceMap[element.id][0];
            }
        });

        oldObj.sequences.forEach((sequence) => {
            let condition = null;
            try {
                if (sequence.condition && sequence.condition !== '') {
                    if (typeof sequence.condition === 'string' && sequence.condition.startsWith('{')) {
                        const condObj = JSON.parse(sequence.condition);
                        condition = {
                            key: condObj.key || '',
                            condition: condObj.operator || '==',
                            value: condObj.value || ''
                        };
                    } else if (typeof sequence.condition === 'string') {
                        condition = sequence.condition;
                    } else {
                        condition = sequence.condition;
                    }
                }
            } catch (e) {}

            const sequenceElement = {
                elementType: 'Sequence',
                id: normalizeBpmnId(sequence.id),
                name: String(sequence.id || '')
                    .replace('SequenceFlow_', '')
                    .replace(/_/g, ' '),
                source: idMap[sequence.source] || normalizeBpmnId(sequence.source),
                target: idMap[sequence.target] || normalizeBpmnId(sequence.target)
            };
            if (condition) sequenceElement.condition = condition;
            oldObj.elements.push(sequenceElement);
        });
    }

    return oldObj;
}
