/**
 * elements[] 형식 processDefinition → flattened proc_def.definition 변환.
 *
 * deepagent(bpmn-process-generation-skill)이 emit 하는 출력계약의 processDefinition 은
 * `elements[]`(elementType: Activity/Event/Gateway/Sequence) 형식이다. 그러나 DB(proc_def.definition)
 * 와 ProcessGPT 엔진/모델러는 flattened 형식(activities/events/gateways/sequences 분리 배열)을 쓴다.
 *
 * 이 함수는 백엔드 스킬의 scripts/save_to_supabase.py `flatten()` 과 동일한 매핑을 JS 로 옮긴 것이다.
 * (pdf2bpmn 저장 스키마와 동일)
 */

const EVENT_TYPE_MAP = {
    StartEvent: 'startEvent',
    EndEvent: 'endEvent',
    IntermediateCatchEvent: 'intermediateCatchEvent',
    IntermediateThrowEvent: 'intermediateThrowEvent'
};
const GATEWAY_TYPE_MAP = {
    ExclusiveGateway: 'exclusiveGateway',
    ParallelGateway: 'parallelGateway',
    InclusiveGateway: 'inclusiveGateway'
};
const ACTIVITY_TYPE_MAP = {
    UserActivity: 'userTask',
    ManualActivity: 'manualTask',
    ServiceActivity: 'serviceTask',
    ScriptActivity: 'scriptTask'
};

function asPropsString(value) {
    // properties 는 ProcessGPT 규격상 JSON 문자열로 저장한다.
    if (value === null || value === undefined) return '{}';
    if (typeof value === 'string') return value || '{}';
    try {
        return JSON.stringify(value);
    } catch (e) {
        return '{}';
    }
}

function asIntDuration(value) {
    if (value === null || value === undefined) return null;
    const n = parseInt(String(value).trim(), 10);
    return Number.isFinite(n) ? n : value;
}

/**
 * @param {object} processDefinition elements[] 형식 processDefinition
 * @returns {object} flattened definition
 */
export function elementsToFlattenedDefinition(processDefinition) {
    const pd = processDefinition || {};
    const procId = pd.processDefinitionId || pd.processDefinitionName || '';
    const elements = Array.isArray(pd.elements) ? pd.elements : [];

    const activities = [];
    const gateways = [];
    const events = [];
    const sequences = [];

    for (const el of elements) {
        if (!el || typeof el !== 'object') continue;
        const et = el.elementType;
        if (et === 'Activity') {
            activities.push({
                id: el.id,
                name: el.name,
                role: el.role,
                tool: el.tool,
                type: ACTIVITY_TYPE_MAP[el.type] || 'userTask',
                agent: el.agent,
                process: procId,
                duration: asIntDuration(el.duration),
                agentMode: el.agentMode || 'none',
                skills: el.skills || [],
                inputData: el.inputData || [],
                outputData: el.outputData || [],
                properties: asPropsString(el.properties),
                attachments: el.attachments || [],
                checkpoints: el.checkpoints || [],
                description: el.description || '',
                instruction: el.instruction || '',
                orchestration: el.orchestration,
                attachedEvents: el.attachedEvents,
                customProperties: el.customProperties || []
            });
        } else if (et === 'Gateway') {
            gateways.push({
                id: el.id,
                name: el.name,
                role: el.role,
                type: GATEWAY_TYPE_MAP[el.type] || 'exclusiveGateway',
                process: procId,
                conditionData: el.conditionData || [],
                properties: asPropsString(el.properties),
                description: el.description || ''
            });
        } else if (et === 'Event') {
            events.push({
                id: el.id,
                name: el.name,
                role: el.role,
                type: EVENT_TYPE_MAP[el.type] || 'startEvent',
                process: procId,
                trigger: el.trigger || '',
                properties: asPropsString(el.properties),
                description: el.description || ''
            });
        } else if (et === 'Sequence') {
            sequences.push({
                id: el.id,
                name: el.name || '',
                source: el.source,
                target: el.target,
                condition: el.condition || '',
                properties: asPropsString(el.properties)
            });
        }
    }

    const flat = {
        data: pd.data || [],
        roles: pd.roles || [],
        events,
        gateways,
        sequences,
        activities,
        description: pd.description || '',
        isHorizontal: pd.isHorizontal !== undefined ? pd.isHorizontal : true,
        participants: pd.participants || [],
        subProcesses: pd.subProcesses || [],
        processDefinitionId: procId,
        processDefinitionName: pd.processDefinitionName || ''
    };
    // DMN(있으면) 보존
    if (pd.dmn_decisions !== undefined && pd.dmn_decisions !== null) flat.dmn_decisions = pd.dmn_decisions;
    if (pd.dmn_rules !== undefined && pd.dmn_rules !== null) flat.dmn_rules = pd.dmn_rules;
    if (pd.megaProcessId) flat.megaProcessId = pd.megaProcessId;
    if (pd.majorProcessId) flat.majorProcessId = pd.majorProcessId;
    return flat;
}

export default elementsToFlattenedDefinition;
