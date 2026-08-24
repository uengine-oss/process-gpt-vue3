/**
 * BPMN Element 영구 UUID 관리 유틸.
 *
 * 정책 (specs/009-bpmn-element-uuid 참고):
 * - BPMN XML 의 `id`(tracingTag / legacy id)는 그대로 유지하고,
 *   각 관리 대상 요소의 `uengine:properties/@json` 확장 백에 `uuid`(UUIDv7) 키를 저장한다.
 * - 관리 대상: Process, Task 류, CallActivity/SubProcess, Gateway, Event,
 *   SequenceFlow/MessageFlow, Participant(Pool)/Lane, Association 등 Artifact,
 *   DataObject 류. BPMNDI(도형 좌표) 요소는 제외.
 * - 이미 유효한 uuid 가 있으면 절대 재발급하지 않는다(멱등).
 *   같은 문서 안에서 중복 uuid(복사/붙여넣기 산출물)는 뒤에 나오는 요소에 재발급한다.
 *
 * 이 모듈은 bpmn-moddle(또는 bpmn-js bpmnFactory) 요소 트리 위에서 동작하는 순수 로직이며
 * 브라우저(앱)와 Node 스크립트 양쪽에서 임포트한다. 의존성(uuid 생성기, 요소 팩토리)은
 * 호출자가 주입한다.
 */

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 관리 대상 판별에 사용하는 상위 타입 (moddle $instanceOf 기준) */
const MANAGED_SUPER_TYPES = [
    'bpmn:FlowElement', // Task/Event/Gateway/SequenceFlow/SubProcess/CallActivity/DataObject 등
    'bpmn:Participant',
    'bpmn:Lane',
    'bpmn:MessageFlow',
    'bpmn:Artifact', // Association/TextAnnotation/Group
    'bpmn:Process'
];

/** $instanceOf 가 없는 환경을 위한 $type 화이트리스트(보조) */
const MANAGED_TYPE_SET = new Set([
    'bpmn:Process',
    'bpmn:Task',
    'bpmn:UserTask',
    'bpmn:ServiceTask',
    'bpmn:ScriptTask',
    'bpmn:SendTask',
    'bpmn:ReceiveTask',
    'bpmn:ManualTask',
    'bpmn:BusinessRuleTask',
    'bpmn:CallActivity',
    'bpmn:SubProcess',
    'bpmn:AdHocSubProcess',
    'bpmn:Transaction',
    'bpmn:ExclusiveGateway',
    'bpmn:ParallelGateway',
    'bpmn:InclusiveGateway',
    'bpmn:EventBasedGateway',
    'bpmn:ComplexGateway',
    'bpmn:StartEvent',
    'bpmn:EndEvent',
    'bpmn:IntermediateCatchEvent',
    'bpmn:IntermediateThrowEvent',
    'bpmn:BoundaryEvent',
    'bpmn:SequenceFlow',
    'bpmn:MessageFlow',
    'bpmn:Participant',
    'bpmn:Lane',
    'bpmn:Association',
    'bpmn:TextAnnotation',
    'bpmn:Group',
    'bpmn:DataObject',
    'bpmn:DataObjectReference',
    'bpmn:DataStoreReference'
]);

export function isUuidValue(value) {
    return typeof value === 'string' && UUID_PATTERN.test(value);
}

const XML_ENTITY_PATTERN = /&(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);/;

function decodeXmlEntitiesOnce(value) {
    return value
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&#(\d+);/g, (m, code) => String.fromCodePoint(Number(code)))
        .replace(/&#x([0-9a-fA-F]+);/g, (m, code) => String.fromCodePoint(parseInt(code, 16)))
        .replace(/&amp;/g, '&');
}

function parseJsonObject(value) {
    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
    } catch (e) {
        return null;
    }
}

/**
 * json 백 파싱. 엄격 파싱 실패 시 XML 엔티티(&#34;, 이중 이스케이프된 &amp;#34; 등)를
 * 단계적으로 디코드해 재시도한다(변환 스크립트를 거치며 과잉 이스케이프된 레거시 데이터 복원).
 * 빈 값은 {}, 끝내 파싱 불가면 null 을 반환한다 — null 이면 호출부는 백을 덮어쓰지 않는다.
 */
function parseJsonSafe(value) {
    if (typeof value !== 'string' || !value.trim()) return {};
    let current = value;
    for (let i = 0; i < 3; i++) {
        const parsed = parseJsonObject(current);
        if (parsed) return parsed;
        if (!XML_ENTITY_PATTERN.test(current)) return null;
        const decoded = decodeXmlEntitiesOnce(current);
        if (decoded === current) return null;
        current = decoded;
    }
    return parseJsonObject(current);
}

/**
 * properties 의 json 문자열을 얻는다. json 속성이 없으면 레거시 <uengine:json> 자식
 * 요소($children 의 $body — 디스크립터 미정의 형태)도 지원한다.
 */
function readPropsJsonString(props) {
    if (typeof props.json === 'string' && props.json.trim()) return props.json;
    const child = (props.$children || []).find((item) => item && typeof item.$type === 'string' && /(^|:)json$/i.test(item.$type));
    return child && typeof child.$body === 'string' ? child.$body : null;
}

/** json 속성으로 정규화한 뒤 레거시 <uengine:json> 자식을 제거한다(양형 공존 방지). */
function removeLegacyJsonChild(props) {
    if (!Array.isArray(props.$children)) return;
    props.$children = props.$children.filter((item) => !(item && typeof item.$type === 'string' && /(^|:)json$/i.test(item.$type)));
}

/** 요소가 UUID 관리 대상인지 판별 */
export function isManagedBpmnElement(element) {
    if (!element || !element.$type) return false;
    if (typeof element.$instanceOf === 'function') {
        return MANAGED_SUPER_TYPES.some((type) => {
            try {
                return element.$instanceOf(type);
            } catch (e) {
                return false;
            }
        });
    }
    return MANAGED_TYPE_SET.has(element.$type);
}

function pushUnique(target, seen, element) {
    if (!element || typeof element !== 'object') return;
    if (seen.has(element)) return;
    seen.add(element);
    target.push(element);
}

function collectFromContainer(container, out, seen) {
    if (!container) return;

    (container.flowElements || []).forEach((el) => {
        pushUnique(out, seen, el);
        // SubProcess/AdHocSubProcess/Transaction 은 FlowElementsContainer
        if (el && (el.flowElements || el.artifacts || el.laneSets)) {
            collectFromContainer(el, out, seen);
        }
    });
    (container.artifacts || []).forEach((el) => pushUnique(out, seen, el));
    (container.laneSets || []).forEach((laneSet) => collectLanes(laneSet, out, seen));
}

function collectLanes(laneSet, out, seen) {
    if (!laneSet) return;
    (laneSet.lanes || []).forEach((lane) => {
        pushUnique(out, seen, lane);
        if (lane && lane.childLaneSet) collectLanes(lane.childLaneSet, out, seen);
    });
}

/**
 * definitions(bpmn:Definitions moddle 요소)에서 UUID 관리 대상 요소를
 * 문서 순서에 가깝게 수집한다. DI 요소는 순회하지 않는다.
 */
export function walkManagedElements(definitions) {
    const out = [];
    const seen = new Set();
    if (!definitions) return out;

    (definitions.rootElements || []).forEach((root) => {
        if (!root || !root.$type) return;
        if (root.$type === 'bpmn:Collaboration') {
            (root.participants || []).forEach((p) => pushUnique(out, seen, p));
            (root.messageFlows || []).forEach((m) => pushUnique(out, seen, m));
            (root.artifacts || []).forEach((a) => pushUnique(out, seen, a));
        } else if (root.$type === 'bpmn:Process') {
            pushUnique(out, seen, root);
            collectFromContainer(root, out, seen);
        }
    });

    return out.filter(isManagedBpmnElement);
}

function findUengineProperties(element) {
    const values = (element.extensionElements && element.extensionElements.values) || [];
    return values.find((item) => item && (item.$type === 'uengine:Properties' || typeof item.json === 'string'));
}

/** 요소의 uengine:properties json 백에서 uuid 를 읽는다. 없으면 null */
export function readElementUuid(element) {
    const props = findUengineProperties(element);
    if (!props) return null;
    const raw = readPropsJsonString(props);
    const bag = parseJsonSafe(raw == null ? '' : raw);
    return bag && typeof bag.uuid === 'string' ? bag.uuid : null;
}

/**
 * 요소의 uengine:properties json 백에 uuid 를 기록한다.
 * 기존 json 백이 끝내 파싱 불가하면 내용 보호를 위해 덮어쓰지 않고 false 를 반환한다.
 * @param {Function} createElement (type, props) => moddle element — bpmnFactory.create 또는 moddle.create
 * @returns {boolean} 기록 성공 여부
 */
export function writeElementUuid(element, uuid, createElement) {
    let ext = element.extensionElements;
    if (!ext) {
        ext = createElement('bpmn:ExtensionElements', {});
        element.extensionElements = ext;
        ext.$parent = element;
    }
    const values = typeof ext.get === 'function' ? ext.get('values') : (ext.values = ext.values || []);

    let props = values.find((item) => item && (item.$type === 'uengine:Properties' || typeof item.json === 'string'));
    if (!props) {
        props = createElement('uengine:Properties', { json: JSON.stringify({ uuid }) });
        values.push(props);
        props.$parent = ext;
        return true;
    }
    const raw = readPropsJsonString(props);
    const bag = parseJsonSafe(raw == null ? '' : raw);
    if (!bag) return false;
    bag.uuid = uuid;
    props.json = JSON.stringify(bag);
    removeLegacyJsonChild(props);
    return true;
}

/** 요소의 json 백에서 uuid 키를 제거한다 (복사/붙여넣기 훅, 롤백용) */
export function stripElementUuid(element) {
    const props = findUengineProperties(element);
    if (!props) return false;
    const raw = readPropsJsonString(props);
    const bag = parseJsonSafe(raw == null ? '' : raw);
    if (!bag || !('uuid' in bag)) return false;
    delete bag.uuid;
    props.json = JSON.stringify(bag);
    removeLegacyJsonChild(props);
    return true;
}

/**
 * 모든 관리 대상 요소에 UUID 가 존재하도록 보장한다(멱등).
 * - 유효한 uuid 는 유지, 없거나 형식이 틀리면 신규 발급.
 * - uuid 가 없더라도 knownUuidsByElementId 에 요소 id 매핑이 있으면 그 uuid 를 재사용
 *   (구버전 스냅샷 복원·AI 재생성 등에서 동일 요소의 UUID 연속성 유지).
 * - 문서 내 중복 uuid 는 뒤 요소에 재발급(복사 안전망).
 * - takenUuids 로 전달된 uuid(다른 프로세스가 이미 사용 — 프로세스 복제 산출물)도 재발급.
 *
 * @param {Object} definitions bpmn:Definitions moddle 요소
 * @param {Object} opts { createElement, uuidFn, takenUuids?, knownUuidsByElementId? } — createElement/uuidFn 필수
 * @returns {{ changed: boolean, issued: number, reissued: number, entries: Array }}
 *   entries: [{ elementUuid, elementId, elementType, name }] — 매핑 테이블 동기화용
 */
export function ensureElementUuids(definitions, opts) {
    const { createElement, uuidFn, takenUuids, knownUuidsByElementId } = opts || {};
    if (typeof createElement !== 'function' || typeof uuidFn !== 'function') {
        throw new Error('ensureElementUuids: createElement / uuidFn 옵션이 필요합니다.');
    }

    const seen = new Set();
    if (takenUuids) {
        for (const taken of takenUuids) {
            if (typeof taken === 'string') seen.add(taken.toLowerCase());
        }
    }
    const entries = [];
    let issued = 0;
    let reissued = 0;

    walkManagedElements(definitions).forEach((element) => {
        if (!element.id) return; // id 없는 요소는 참조 불가 — 대상 제외

        let uuid = readElementUuid(element);
        if (!isUuidValue(uuid)) {
            const known = knownUuidsByElementId ? knownUuidsByElementId.get(element.id) : null;
            uuid = isUuidValue(known) && !seen.has(known.toLowerCase()) ? known : uuidFn();
            // json 백이 파싱 불가한 요소는 건너뛴다(내용 보호, fail-open) — 매핑에도 싣지 않는다.
            if (!writeElementUuid(element, uuid, createElement)) return;
            issued += 1;
        } else if (seen.has(uuid.toLowerCase())) {
            const next = uuidFn();
            if (!writeElementUuid(element, next, createElement)) return;
            uuid = next;
            reissued += 1;
        }
        seen.add(uuid.toLowerCase());
        entries.push({
            elementUuid: uuid.toLowerCase(),
            elementId: element.id,
            elementType: element.$type,
            name: element.name || null
        });
    });

    return { changed: issued + reissued > 0, issued, reissued, entries };
}

/**
 * proc_def.definition(jsonb, flat 형식: activities/events/gateways/sequences/…)의
 * 각 요소에 XML 에서 확정된 uuid 를 복사한다(요소 id 기준 매칭, 멱등).
 * @returns {{ changed: boolean, definition: Object }} 변경 시 새 객체 반환
 */
export function syncFlatDefinitionUuids(definition, entries) {
    if (!definition || typeof definition !== 'object' || Array.isArray(definition)) {
        return { changed: false, definition };
    }
    const byId = new Map();
    (entries || []).forEach((entry) => {
        if (entry && entry.elementId) byId.set(entry.elementId, entry.elementUuid);
    });
    if (!byId.size) return { changed: false, definition };

    const ARRAY_KEYS = ['activities', 'events', 'gateways', 'sequences', 'subProcesses', 'participants'];
    let changed = false;
    const next = { ...definition };

    ARRAY_KEYS.forEach((key) => {
        const list = definition[key];
        if (!Array.isArray(list) || !list.length) return;
        let listChanged = false;
        const nextList = list.map((el) => {
            if (!el || typeof el !== 'object' || !el.id) return el;
            const uuid = byId.get(el.id);
            if (!uuid || el.uuid === uuid) return el;
            listChanged = true;
            return { ...el, uuid };
        });
        if (listChanged) {
            next[key] = nextList;
            changed = true;
        }
    });

    return changed ? { changed, definition: next } : { changed: false, definition };
}

/**
 * proc_map(프로세스 체계도) JSON 노드(mega/major/sub)에 uuid 를 보장한다(멱등).
 * 기존 uuid 는 유지, 없으면 발급. 새 객체를 반환한다.
 * @returns {{ changed: boolean, map: Object }}
 */
export function ensureProcMapUuids(procMap, uuidFn) {
    if (!procMap || typeof procMap !== 'object' || typeof uuidFn !== 'function') {
        return { changed: false, map: procMap };
    }
    let changed = false;

    const ensureNode = (node) => {
        if (!node || typeof node !== 'object') return node;
        let next = node;
        if (!isUuidValue(node.uuid)) {
            next = { ...node, uuid: uuidFn() };
            changed = true;
        }
        ['major_proc_list', 'sub_proc_list'].forEach((key) => {
            const list = next[key];
            if (!Array.isArray(list) || !list.length) return;
            const nextList = list.map(ensureNode);
            if (nextList.some((item, i) => item !== list[i])) {
                next = next === node ? { ...node } : next;
                next[key] = nextList;
            }
        });
        return next;
    };

    const megaList = Array.isArray(procMap.mega_proc_list) ? procMap.mega_proc_list : null;
    if (!megaList) return { changed: false, map: procMap };

    const nextMega = megaList.map(ensureNode);
    if (!changed) return { changed: false, map: procMap };
    return { changed: true, map: { ...procMap, mega_proc_list: nextMega } };
}

/**
 * 기존에 발급된 uuid 를 노드 id 기준으로 보존·병합한다.
 * 화면 흐름이 노드 객체를 재구성하면서 uuid 를 잃어버려도,
 * 저장 시점에 기존 저장본의 uuid 를 되살린다.
 */
export function mergeProcMapUuids(editedMap, storedMap) {
    if (!editedMap || typeof editedMap !== 'object') return editedMap;
    if (!storedMap || typeof storedMap !== 'object') return editedMap;

    const collectUuids = (node, level, acc) => {
        if (!node || typeof node !== 'object') return;
        if (node.id != null && isUuidValue(node.uuid)) acc.set(`${level}:${node.id}`, node.uuid);
        (node.major_proc_list || []).forEach((child) => collectUuids(child, 'major', acc));
        (node.sub_proc_list || []).forEach((child) => collectUuids(child, 'sub', acc));
    };
    const stored = new Map();
    (storedMap.mega_proc_list || []).forEach((node) => collectUuids(node, 'mega', stored));
    if (!stored.size) return editedMap;

    let changed = false;
    const restore = (node, level) => {
        if (!node || typeof node !== 'object') return node;
        let next = node;
        if (node.id != null && !isUuidValue(node.uuid)) {
            const known = stored.get(`${level}:${node.id}`);
            if (known) {
                next = { ...node, uuid: known };
                changed = true;
            }
        }
        ['major_proc_list', 'sub_proc_list'].forEach((key) => {
            const childLevel = key === 'major_proc_list' ? 'major' : 'sub';
            const list = next[key];
            if (!Array.isArray(list) || !list.length) return;
            const nextList = list.map((child) => restore(child, childLevel));
            if (nextList.some((item, i) => item !== list[i])) {
                next = next === node ? { ...node } : next;
                next[key] = nextList;
            }
        });
        return next;
    };

    const megaList = Array.isArray(editedMap.mega_proc_list) ? editedMap.mega_proc_list : null;
    if (!megaList) return editedMap;
    const nextMega = megaList.map((node) => restore(node, 'mega'));
    return changed ? { ...editedMap, mega_proc_list: nextMega } : editedMap;
}
