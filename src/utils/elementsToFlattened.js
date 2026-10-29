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
 * 요소의 `source`(앞 노드)에는 적혀 있는데 Sequence 요소가 없는 연결선을 만든다.
 *
 * 그림(BPMNXmlGenerator.ensureSequenceGuardrails)은 같은 규칙으로 화살표를 채워 그리는데 정의 JSON 은
 * 그러지 않아 둘이 갈라졌다. 딥 에이전트가 시작 이벤트에서 나가는 Sequence 를 빠뜨리고 첫 액티비티에
 * source:'start' 만 적으면(VM 녹화 「한빛오피스 대량 주문 견적 승인」), 흐름도에는 시작 → 「견적 요청 접수」
 * 화살표가 있는데 proc_def.definition 에는 없어 실행 엔진·실행 창이 첫 단계를 건너뛰었다.
 * 그림과 같은 연결선을 정의에도 넣어, 사용자가 확인한 흐름도대로 실행되게 한다.
 * (그림 쪽과 달리 source 가 정의에 없는 노드를 가리키면 만들지 않는다 — 시작 지점이 엉뚱해진다.)
 */
function sequencesFromSourceHints(elements, sequences) {
    const nodeIds = new Set(elements.filter((el) => el && el.elementType !== 'Sequence' && el.id).map((el) => el.id));
    const existing = new Set(sequences.filter((s) => s.source && s.target).map((s) => `${s.source}__${s.target}`));
    const usedIds = new Set(sequences.map((s) => s.id).filter(Boolean));
    const added = [];
    for (const el of elements) {
        if (!el || typeof el !== 'object' || el.elementType === 'Sequence' || !el.id) continue;
        const source = typeof el.source === 'string' ? el.source.trim() : '';
        if (!source || source === 'none' || source === el.id || !nodeIds.has(source)) continue;
        const key = `${source}__${el.id}`;
        if (existing.has(key)) continue;
        existing.add(key);
        let id = `seq_${source}_${el.id}`;
        for (let n = 1; usedIds.has(id); n++) id = `seq_${source}_${el.id}_${n}`;
        usedIds.add(id);
        added.push({ id, name: '', source, target: el.id, condition: '', properties: '{}' });
    }
    return added;
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
                rootAgent: el.rootAgent || null,
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

    sequences.push(...sequencesFromSourceHints(elements, sequences));

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
