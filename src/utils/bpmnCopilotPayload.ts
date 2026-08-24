import { isBpmnModelElement } from './bpmnModelElement';

type AnyRecord = Record<string, any>;

type BuildCopilotPayloadOptions = {
    storedDefinition?: any;
    processDefinitionId?: string;
    processName?: string;
    bpmnXml?: string;
    modeler?: any;
};

function isRecord(value: any): value is AnyRecord {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function cloneJson(value: any) {
    if (value == null) return null;
    if (typeof value === 'string') {
        try {
            return JSON.parse(value || '{}');
        } catch {
            return {};
        }
    }

    try {
        return JSON.parse(JSON.stringify(value));
    } catch {
        return isRecord(value) ? { ...value } : value;
    }
}

function ensureArray(value: any): any[] {
    return Array.isArray(value) ? value : value ? [value] : [];
}

function parseJsonString(input: any, fallback: any = {}) {
    if (!input || typeof input !== 'string') return fallback;
    try {
        return JSON.parse(input);
    } catch {
        return fallback;
    }
}

function normalizeRole(value: any) {
    if (typeof value === 'string') return value;
    if (value && typeof value === 'object') {
        if (typeof value.name === 'string') return value.name;
        if (typeof value.displayName === 'string') return value.displayName;
    }
    return value == null ? '' : String(value);
}

function normalizeBpmnType(type: any) {
    const rawType = String(type || '').replace(/^bpmn:/, '');
    if (!rawType) return '';
    return rawType.charAt(0).toLowerCase() + rawType.slice(1);
}

function getUengineJsonString(businessObject: AnyRecord | null | undefined) {
    const extensionValues = businessObject?.extensionElements?.values || [];
    const propNode = extensionValues.find((item: any) => item?.$type === 'uengine:Properties' || typeof item?.json === 'string');
    return typeof propNode?.json === 'string' ? propNode.json : '';
}

function parseUengineProps(businessObject: AnyRecord | null | undefined) {
    return parseJsonString(getUengineJsonString(businessObject), {});
}

function getElementId(ref: any) {
    if (!ref) return '';
    if (typeof ref === 'string') return ref;
    return ref.id || ref.businessObject?.id || '';
}

// 가장 가까운 컨테이너(subProcess 포함) id — 변환기(definition) 규약과 동일해야
// 서브프로세스 내부 요소 판별(예: 시작이벤트 선택 다이얼로그 필터)이 유지된다.
function getProcessId(businessObject: AnyRecord | null | undefined) {
    let current = businessObject?.$parent;
    while (current) {
        if (current.$type === 'bpmn:Process' || current.$type === 'bpmn:SubProcess') return current.id || '';
        current = current.$parent;
    }
    return '';
}

function getPropertiesStringFromProps(props: AnyRecord, original = '') {
    if (original) return original;
    try {
        return Object.keys(props || {}).length > 0 ? JSON.stringify(props) : '{}';
    } catch {
        return '{}';
    }
}

function buildLaneNameByNodeId(elements: any[]) {
    const laneNameByNodeId = new Map<string, string>();
    elements
        .filter((element) => element?.type === 'bpmn:Lane')
        .forEach((lane) => {
            const laneName = lane.businessObject?.name || lane.id || '';
            ensureArray(lane.businessObject?.flowNodeRef).forEach((ref) => {
                const refId = getElementId(ref);
                if (refId && laneName) {
                    laneNameByNodeId.set(refId, laneName);
                }
            });
        });
    return laneNameByNodeId;
}

function resolveLaneName(element: any, laneNameByNodeId: Map<string, string>) {
    let current = element?.parent;
    while (current) {
        if (current.type === 'bpmn:Lane' || current.businessObject?.$type === 'bpmn:Lane') {
            return current.businessObject?.name || current.id || '';
        }
        current = current.parent;
    }
    return laneNameByNodeId.get(element?.id || element?.businessObject?.id || '') || '';
}

function expressionToValue(expression: any) {
    if (!expression) return '';
    if (typeof expression === 'string') return expression;
    return expression.body || expression.text || expression.value || '';
}

function buildActivity(element: any, laneNameByNodeId: Map<string, string>) {
    const businessObject = element.businessObject || {};
    const props = parseUengineProps(businessObject);
    const rawProperties = getUengineJsonString(businessObject);
    const role = normalizeRole(props.role) || resolveLaneName(element, laneNameByNodeId);
    const formVariableName = props.variableForHtmlFormContext?.name;

    return {
        id: businessObject.id || element.id || '',
        name: businessObject.name || element.id || '',
        type: normalizeBpmnType(businessObject.$type || element.type),
        description: props.description || '',
        instruction: props.instruction || '',
        process: getProcessId(businessObject),
        role,
        duration: props.duration || 5,
        attachedEvents: null,
        agent: props.agent || '',
        agentMode: props.agentMode || '',
        orchestration: props.orchestration || '',
        attachments: Array.isArray(props.attachments) ? props.attachments : [],
        inputData: Array.isArray(props.inputData) ? props.inputData : [],
        outputData: Array.isArray(props.outputData) ? props.outputData : [],
        tool: props.tool || (formVariableName ? `formHandler:${formVariableName}` : 'formHandler:defaultform'),
        checkpoints: Array.isArray(props.checkpoints) ? props.checkpoints : [],
        systems: Array.isArray(props.systems) ? props.systems : [],
        manualLink: props.manualLink
            || (Array.isArray(props.manualLinks) && props.manualLinks[0]
                ? (typeof props.manualLinks[0] === 'string' ? props.manualLinks[0] : props.manualLinks[0]?.url || '')
                : '')
            || '',
        manualLinks: Array.isArray(props.manualLinks) ? props.manualLinks : (props.manualLink ? [props.manualLink] : []),
        properties: getPropertiesStringFromProps(props, rawProperties)
    };
}

function buildGateway(element: any, laneNameByNodeId: Map<string, string>) {
    const businessObject = element.businessObject || {};
    const props = parseUengineProps(businessObject);
    const rawProperties = getUengineJsonString(businessObject);

    return {
        id: businessObject.id || element.id || '',
        name: businessObject.name || 'Gateway',
        type: normalizeBpmnType(businessObject.$type || element.type),
        description: props.description || `${businessObject.name || 'Gateway'} description`,
        process: getProcessId(businessObject),
        role: normalizeRole(props.role) || resolveLaneName(element, laneNameByNodeId),
        condition: props.condition || '',
        properties: getPropertiesStringFromProps(props, rawProperties)
    };
}

function buildEvent(element: any, laneNameByNodeId: Map<string, string>) {
    const businessObject = element.businessObject || {};
    const props = parseUengineProps(businessObject);
    const rawProperties = getUengineJsonString(businessObject);
    const definitionType = Object.keys(businessObject).find((key) => key.includes('Definition')) || null;

    return {
        id: businessObject.id || element.id || '',
        name: businessObject.name || element.id || '',
        type: normalizeBpmnType(businessObject.$type || element.type),
        description: props.description || '',
        role: normalizeRole(props.role) || resolveLaneName(element, laneNameByNodeId),
        process: getProcessId(businessObject),
        definitionType,
        properties: getPropertiesStringFromProps(props, rawProperties)
    };
}

function buildSubProcess(element: any, laneNameByNodeId: Map<string, string>) {
    const businessObject = element.businessObject || {};
    const props = parseUengineProps(businessObject);
    const rawProperties = getUengineJsonString(businessObject);

    return {
        id: businessObject.id || element.id || '',
        name: businessObject.name || element.id || '',
        type: normalizeBpmnType(businessObject.$type || element.type),
        role: normalizeRole(props.role) || resolveLaneName(element, laneNameByNodeId),
        process: getProcessId(businessObject),
        duration: props.duration || 5,
        properties: getPropertiesStringFromProps(props, rawProperties),
        attachedEvents: null
    };
}

function buildSequence(element: any) {
    const businessObject = element.businessObject || {};
    const props = parseUengineProps(businessObject);
    const rawProperties = getUengineJsonString(businessObject);

    return {
        id: businessObject.id || element.id || '',
        name: businessObject.name || '',
        source: getElementId(businessObject.sourceRef) || element.source?.id || '',
        target: getElementId(businessObject.targetRef) || element.target?.id || '',
        condition: props.condition || expressionToValue(businessObject.conditionExpression),
        properties: getPropertiesStringFromProps(props, rawProperties)
    };
}

function buildRole(element: any) {
    const businessObject = element.businessObject || {};
    const props = parseUengineProps(businessObject);
    const roleResolutionContext = props.roleResolutionContext || {};
    const endpoint = props.endpoint || roleResolutionContext.endpoint || '';

    return {
        name: businessObject.name || element.id || '',
        endpoint,
        resolutionRule: props.resolutionRule || '',
        default: props.default || (roleResolutionContext._type === 'org.uengine.kernel.DirectRoleResolutionContext' ? endpoint : '')
    };
}

function extractPayloadFromModeler(modeler: any) {
    try {
        const elementRegistry = modeler?.get?.('elementRegistry');
        if (!elementRegistry?.getAll) return null;

        const seenIds = new Set<string>();
        const elements = elementRegistry
            .getAll()
            .filter((element: any) => element?.id && element.type !== 'label' && !element.labelTarget)
            .filter((element: any) => {
                if (seenIds.has(element.id)) return false;
                seenIds.add(element.id);
                return true;
            });

        if (elements.length === 0) return null;

        const laneNameByNodeId = buildLaneNameByNodeId(elements);
        const activities = elements
            .filter((element: any) => {
                const type = normalizeBpmnType(element.businessObject?.$type || element.type);
                return type.endsWith('Task') || type === 'task' || type === 'callActivity';
            })
            .map((element: any) => buildActivity(element, laneNameByNodeId));

        const gateways = elements
            .filter((element: any) => normalizeBpmnType(element.businessObject?.$type || element.type).endsWith('Gateway'))
            .map((element: any) => buildGateway(element, laneNameByNodeId));

        const events = elements
            .filter((element: any) => normalizeBpmnType(element.businessObject?.$type || element.type).endsWith('Event'))
            .map((element: any) => buildEvent(element, laneNameByNodeId));

        const subProcesses = elements
            .filter((element: any) => normalizeBpmnType(element.businessObject?.$type || element.type) === 'subProcess')
            .map((element: any) => buildSubProcess(element, laneNameByNodeId));

        const sequences = elements
            .filter((element: any) => normalizeBpmnType(element.businessObject?.$type || element.type) === 'sequenceFlow')
            .map((element: any) => buildSequence(element));

        const roles = elements
            .filter((element: any) => element.type === 'bpmn:Lane')
            .map((element: any) => buildRole(element))
            .filter((role: any) => role.name);

        return {
            activities,
            gateways,
            events,
            subProcesses,
            sequences,
            roles
        };
    } catch (error) {
        console.warn('[bpmnCopilotPayload] Failed to extract BPMN payload from modeler:', error);
        return null;
    }
}

function localName(node: Element) {
    return node.localName || node.nodeName.replace(/^.*:/, '');
}

function getChildElements(node: Element) {
    return Array.from(node.children || []);
}

function getDescendants(node: Element, name: string) {
    return Array.from(node.getElementsByTagName('*')).filter((child) => localName(child) === name);
}

function getAllDescendants(node: Element) {
    return Array.from(node.getElementsByTagName('*'));
}

function closestByLocalName(node: Element, name: string) {
    let current: Element | null = node;
    while (current) {
        if (localName(current) === name) return current;
        current = current.parentElement;
    }
    return null;
}

// 가장 가까운 컨테이너(subProcess 우선, 없으면 process)의 id — getProcessId(모델러 경로)와 동일 규약.
// 자기 자신은 제외해야 subProcess 노드가 스스로를 컨테이너로 보고하지 않는다.
function closestContainerId(node: Element) {
    let current: Element | null = node.parentElement;
    while (current) {
        const name = localName(current);
        if (name === 'subProcess' || name === 'process') return current.getAttribute('id') || '';
        current = current.parentElement;
    }
    return '';
}

function getXmlUengineJsonString(node: Element) {
    const extensionElements = getChildElements(node).find((child) => localName(child) === 'extensionElements');
    if (!extensionElements) return '';

    const propertiesNode = getDescendants(extensionElements, 'properties')[0];
    if (!propertiesNode) return '';

    const jsonAttr = propertiesNode.getAttribute('json');
    if (jsonAttr) return jsonAttr;

    const jsonNode = getDescendants(propertiesNode, 'json')[0];
    return jsonNode?.textContent || '';
}

function parseXmlProps(node: Element) {
    return parseJsonString(getXmlUengineJsonString(node), {});
}

function buildXmlLaneNameByNodeId(doc: Document) {
    const laneNameByNodeId = new Map<string, string>();
    getDescendants(doc.documentElement, 'lane').forEach((lane) => {
        const laneName = lane.getAttribute('name') || lane.getAttribute('id') || '';
        getChildElements(lane)
            .filter((child) => localName(child) === 'flowNodeRef')
            .forEach((refNode) => {
                const refId = (refNode.textContent || '').trim();
                if (refId && laneName) {
                    laneNameByNodeId.set(refId, laneName);
                }
            });
    });
    return laneNameByNodeId;
}

function buildXmlActivity(node: Element, laneNameByNodeId: Map<string, string>) {
    const props = parseXmlProps(node);
    const rawProperties = getXmlUengineJsonString(node);
    const id = node.getAttribute('id') || '';
    const role = normalizeRole(props.role) || laneNameByNodeId.get(id) || '';
    const formVariableName = props.variableForHtmlFormContext?.name;

    return {
        id,
        name: node.getAttribute('name') || id,
        type: localName(node),
        description: props.description || '',
        instruction: props.instruction || '',
        process: closestContainerId(node),
        role,
        duration: props.duration || 5,
        attachedEvents: null,
        agent: props.agent || '',
        agentMode: props.agentMode || '',
        orchestration: props.orchestration || '',
        attachments: Array.isArray(props.attachments) ? props.attachments : [],
        inputData: Array.isArray(props.inputData) ? props.inputData : [],
        outputData: Array.isArray(props.outputData) ? props.outputData : [],
        tool: props.tool || (formVariableName ? `formHandler:${formVariableName}` : 'formHandler:defaultform'),
        checkpoints: Array.isArray(props.checkpoints) ? props.checkpoints : [],
        systems: Array.isArray(props.systems) ? props.systems : [],
        manualLink: props.manualLink
            || (Array.isArray(props.manualLinks) && props.manualLinks[0]
                ? (typeof props.manualLinks[0] === 'string' ? props.manualLinks[0] : props.manualLinks[0]?.url || '')
                : '')
            || '',
        manualLinks: Array.isArray(props.manualLinks) ? props.manualLinks : (props.manualLink ? [props.manualLink] : []),
        properties: getPropertiesStringFromProps(props, rawProperties)
    };
}

function buildXmlGateway(node: Element, laneNameByNodeId: Map<string, string>) {
    const props = parseXmlProps(node);
    const rawProperties = getXmlUengineJsonString(node);
    const id = node.getAttribute('id') || '';
    const name = node.getAttribute('name') || 'Gateway';

    return {
        id,
        name,
        type: localName(node),
        description: props.description || `${name} description`,
        process: closestContainerId(node),
        role: normalizeRole(props.role) || laneNameByNodeId.get(id) || '',
        condition: props.condition || '',
        properties: getPropertiesStringFromProps(props, rawProperties)
    };
}

function buildXmlEvent(node: Element, laneNameByNodeId: Map<string, string>) {
    const props = parseXmlProps(node);
    const rawProperties = getXmlUengineJsonString(node);
    const id = node.getAttribute('id') || '';
    const definitionType = getChildElements(node).find((child) => localName(child).includes('Definition'));

    return {
        id,
        name: node.getAttribute('name') || id,
        type: localName(node),
        description: props.description || '',
        role: normalizeRole(props.role) || laneNameByNodeId.get(id) || '',
        process: closestContainerId(node),
        definitionType: definitionType ? localName(definitionType) : null,
        properties: getPropertiesStringFromProps(props, rawProperties)
    };
}

function buildXmlSubProcess(node: Element, laneNameByNodeId: Map<string, string>) {
    const props = parseXmlProps(node);
    const rawProperties = getXmlUengineJsonString(node);
    const id = node.getAttribute('id') || '';

    return {
        id,
        name: node.getAttribute('name') || id,
        type: localName(node),
        role: normalizeRole(props.role) || laneNameByNodeId.get(id) || '',
        process: closestContainerId(node),
        duration: props.duration || 5,
        properties: getPropertiesStringFromProps(props, rawProperties),
        attachedEvents: null
    };
}

function buildXmlSequence(node: Element) {
    const props = parseXmlProps(node);
    const rawProperties = getXmlUengineJsonString(node);

    return {
        id: node.getAttribute('id') || '',
        name: node.getAttribute('name') || '',
        source: node.getAttribute('sourceRef') || '',
        target: node.getAttribute('targetRef') || '',
        condition: props.condition || '',
        properties: getPropertiesStringFromProps(props, rawProperties)
    };
}

function extractPayloadFromXml(xml: string | undefined) {
    if (!xml || typeof DOMParser === 'undefined') return null;

    try {
        const doc = new DOMParser().parseFromString(xml, 'application/xml');
        if (doc.getElementsByTagName('parsererror').length > 0) return null;

        const laneNameByNodeId = buildXmlLaneNameByNodeId(doc);
        // 확장 네임스페이스 마커(예: extensionElements 안의 zeebe:userTask)가
        // activity/event 로 오인되지 않도록 BPMN 모델 요소만 남긴다.
        const allElements = getAllDescendants(doc.documentElement).filter((node) => isBpmnModelElement(node));
        const activityNodes = allElements.filter((node) => {
            const type = localName(node);
            return type.endsWith('Task') || type === 'task' || type === 'callActivity';
        });
        const gatewayNodes = allElements.filter((node) => localName(node).endsWith('Gateway'));
        const eventNodes = allElements.filter((node) => localName(node).endsWith('Event'));
        const subProcessNodes = allElements.filter((node) => localName(node) === 'subProcess');
        const sequenceNodes = allElements.filter((node) => localName(node) === 'sequenceFlow');
        const laneNodes = allElements.filter((node) => localName(node) === 'lane');

        return {
            activities: activityNodes.map((node) => buildXmlActivity(node, laneNameByNodeId)),
            gateways: gatewayNodes.map((node) => buildXmlGateway(node, laneNameByNodeId)),
            events: eventNodes.map((node) => buildXmlEvent(node, laneNameByNodeId)),
            subProcesses: subProcessNodes.map((node) => buildXmlSubProcess(node, laneNameByNodeId)),
            sequences: sequenceNodes.map((node) => buildXmlSequence(node)),
            roles: laneNodes.map((node) => {
                const props = parseXmlProps(node);
                const roleResolutionContext = props.roleResolutionContext || {};
                const endpoint = props.endpoint || roleResolutionContext.endpoint || '';
                return {
                    name: node.getAttribute('name') || node.getAttribute('id') || '',
                    endpoint,
                    resolutionRule: props.resolutionRule || '',
                    default: props.default || (roleResolutionContext._type === 'org.uengine.kernel.DirectRoleResolutionContext' ? endpoint : '')
                };
            }).filter((role) => role.name)
        };
    } catch (error) {
        console.warn('[bpmnCopilotPayload] Failed to extract BPMN payload from XML:', error);
        return null;
    }
}

function isEmptyish(value: any) {
    return value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);
}

// 속성 패널이 '끄기'를 키 삭제로 표현하는 키 — live bag에 없으면 삭제 의도로 존중한다.
const PANEL_DELETABLE_PROPERTY_KEYS = ['conditionMode'];

/**
 * properties(uengine bag JSON 문자열)는 문자열 통째 교체가 아니라 키 단위로 병합한다.
 * BPMN Element UUID 주입 이후 모든 요소의 XML bag이 최소 {"uuid":...}로 비어있지 않아,
 * 통째 교체하면 definition에만 있는 실행 필드(conditionFunction 등)가 저장 한 번에 소실된다.
 * live(현재 다이어그램)가 이기되, stored(definition)에만 있는 키는 보존한다.
 */
function mergePropertiesStrings(liveValue: any, storedValue: any) {
    const liveBag = parseJsonString(liveValue, null);
    const storedBag = parseJsonString(storedValue, null);
    if (!isRecord(storedBag) || Object.keys(storedBag).length === 0) return liveValue;
    if (!isRecord(liveBag)) return liveValue;
    if (Object.keys(liveBag).length === 0) return storedValue;

    const merged: AnyRecord = { ...storedBag, ...liveBag };
    PANEL_DELETABLE_PROPERTY_KEYS.forEach((key) => {
        if (!(key in liveBag)) delete merged[key];
    });
    return JSON.stringify(merged);
}

/**
 * 요소 병합: 현재 다이어그램(live, XML/uengine:properties에서 추출)이 항상 우선한다.
 * - 저장된 definition에만 있는 보강 필드(pythonCode·conditionData·endpoint·uuid 등)는 보존
 * - 추출기의 기본값(tool defaultform, duration 5)·빈 값이 저장된 실값을 덮지 않게 보호
 * 과거처럼 stored가 전 필드 우선하면 캔버스 수정이 definition(=실행 정의)에 영원히 반영되지 않는다.
 */
function mergeElement(liveItem: AnyRecord, storedItem: AnyRecord) {
    const merged: AnyRecord = { ...storedItem, ...liveItem };
    Object.keys(storedItem || {}).forEach((key) => {
        const liveVal = (liveItem as any)[key];
        const storedVal = (storedItem as any)[key];
        if (isEmptyish(storedVal)) return;
        if (isEmptyish(liveVal)) {
            merged[key] = storedVal;
            return;
        }
        if (key === 'properties') merged[key] = mergePropertiesStrings(liveVal, storedVal);
        if (key === 'tool' && liveVal === 'formHandler:defaultform' && storedVal !== liveVal) merged[key] = storedVal;
        if (key === 'duration' && liveVal === 5 && storedVal !== 5) merged[key] = storedVal;
    });
    return merged;
}

/**
 * existingIds가 주어지면(요소 배열) 다이어그램에서 사라진 저장 전용 항목은 버린다 —
 * 안 그러면 캔버스에서 지운 태스크가 definition에 남아 실행 시 유령 태스크로 살아난다.
 * null이면(roles처럼 다이어그램 밖에서 관리될 수 있는 배열) 기존처럼 전부 보존한다.
 */
function mergeArrayById(liveValue: any, storedValue: any, idKey = 'id', existingIds: Set<string> | null = null) {
    const liveArray = ensureArray(liveValue);
    const storedArray = ensureArray(storedValue);
    if (liveArray.length === 0) return storedArray;
    if (storedArray.length === 0) return liveArray;

    const storedById = new Map<string, any>();
    storedArray.forEach((item) => {
        const id = item?.[idKey];
        if (id) storedById.set(String(id), item);
    });

    const merged = liveArray.map((liveItem) => {
        const id = liveItem?.[idKey];
        const storedItem = id ? storedById.get(String(id)) : null;
        return storedItem ? mergeElement(liveItem, storedItem) : liveItem;
    });

    storedArray.forEach((storedItem) => {
        const id = storedItem?.[idKey];
        if (!id) return;
        if (existingIds && !existingIds.has(String(id))) return;
        if (!merged.some((item) => String(item?.[idKey]) === String(id))) {
            merged.push(storedItem);
        }
    });

    return merged;
}

function hasExtractedBpmnContent(payload: any) {
    return !!(
        payload &&
        (ensureArray(payload.activities).length > 0 ||
            ensureArray(payload.gateways).length > 0 ||
            ensureArray(payload.events).length > 0 ||
            ensureArray(payload.sequences).length > 0)
    );
}

export function buildCopilotProcessDefinitionPayload(options: BuildCopilotPayloadOptions) {
    const base = cloneJson(options.storedDefinition) || {};
    const liveFromModeler = extractPayloadFromModeler(options.modeler);
    const liveFromXml = extractPayloadFromXml(options.bpmnXml);
    const live = hasExtractedBpmnContent(liveFromModeler) ? liveFromModeler : liveFromXml;

    if (!isRecord(base) && !live) return null;

    const payload = isRecord(base) ? { ...base } : {};
    if (live) {
        // 다이어그램에 실존하는 id 집합 — 모델러가 접힌 서브프로세스 내부 등을 놓칠 수 있어 XML 추출과 합집합
        const existingIds = (key: string) => {
            const ids = new Set<string>();
            [live, liveFromXml].forEach((src: any) => {
                if (!src) return;
                ensureArray(src[key]).forEach((item: any) => {
                    if (item?.id) ids.add(String(item.id));
                });
            });
            return ids;
        };
        payload.activities = mergeArrayById(live.activities, payload.activities, 'id', existingIds('activities'));
        payload.gateways = mergeArrayById(live.gateways, payload.gateways, 'id', existingIds('gateways'));
        payload.events = mergeArrayById(live.events, payload.events, 'id', existingIds('events'));
        payload.subProcesses = mergeArrayById(live.subProcesses, payload.subProcesses, 'id', existingIds('subProcesses'));
        payload.sequences = mergeArrayById(live.sequences, payload.sequences, 'id', existingIds('sequences'));
        payload.roles = mergeArrayById(live.roles, payload.roles, 'name');
    }

    // 호출자가 넘긴 현재 행(row) id/이름이 항상 우선 — storedDefinition 내부 값이 우선하면
    // 복사본(definition 내부에 원본 id가 남은 경우)이 재저장으로도 치유되지 않고,
    // 엔진이 인스턴스 생성 시 내부 id를 신뢰해 원본 정의의 태스크로 실행된다.
    payload.processDefinitionId = options.processDefinitionId || payload.processDefinitionId || '';
    payload.processDefinitionName = options.processName || payload.processDefinitionName || '';

    return payload;
}
