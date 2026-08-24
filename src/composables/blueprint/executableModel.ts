/**
 * executableModel — "실행형 프로세스" 데이터 모델 · BPMN 스켈레톤 추출 · 엔진 계약 검증.
 *
 * 순서도(문서형) BPMN 을 process-gpt-completion 엔진이 실행하는 definition JSON
 * (roles/activities/gateways/events/sequences/data) 으로 변환한 결과를 다룬다.
 * 변환 결과는 proc_def.definition.tobe.executable 에 저장(additive, 마이그레이션 없음)되고,
 * 관리자가 "실행 정의로 등록"하면 proc_def.definition 의 실행 필드로 병합된다.
 *
 * 엔진 계약 (specs/008-bpm-mvp-execution 02·04 실측):
 * - events[] 는 별도 배열로 저장하고 엔진 load 시 gateways 로 병합된다 (startEvent 1개 필수).
 * - start 직후에는 액티비티가 있어야 한다(find_initial_activity). 첫 태스크가 userTask 면
 *   UI 가 시작 폼(openStartForm)으로 입력을 받아 시작하므로 분기 결정 필드를 공급해도 된다.
 * - exclusive 분기 시퀀스는 properties(JSON 문자열)의 conditionFunction 으로 결정론 평가된다.
 * - serviceTask 출력은 도구 결과라 폼 분기 필드를 만들 수 없다 → serviceTask 직후 exclusive 금지.
 * - 실행 타입은 userTask/serviceTask/scriptTask 만 사용 (manual/send/receive → userTask).
 */

export interface ExecutableRole {
    name: string;
    default?: string;
    endpoint?: string;
    resolutionRule?: string;
}

export interface ExecutableActivity {
    id: string;
    name: string;
    type: string; // userTask | serviceTask | scriptTask
    description?: string;
    instruction?: string;
    role: string;
    inputData?: string[];
    outputData?: string[];
    checkpoints?: string[];
    pythonCode?: string;
    tool?: string;
    properties?: string;
    duration?: number;
    agent?: string;
    agentMode?: string;
    orchestration?: string;
    attachedEvents?: string[];
}

export interface ExecutableGateway {
    id: string;
    name?: string;
    role?: string;
    type: string; // exclusiveGateway | parallelGateway
    process?: string;
    condition?: Record<string, any>;
    conditionData?: string[];
    properties?: string;
    description?: string;
}

export interface ExecutableEvent {
    id: string;
    name?: string;
    role?: string;
    type: string; // startEvent | endEvent
    process?: string;
    properties?: string;
    description?: string;
}

export interface ExecutableSequence {
    id: string;
    name?: string;
    source: string;
    target: string;
    condition?: string;
    /** JSON 문자열. 분기 조건은 {"conditionFunction": "필드 == '예'"} 형태. */
    properties?: string;
}

export interface ExecutableDefinition {
    processDefinitionId: string;
    processDefinitionName: string;
    description?: string;
    roles: ExecutableRole[];
    activities: ExecutableActivity[];
    gateways: ExecutableGateway[];
    events: ExecutableEvent[];
    sequences: ExecutableSequence[];
    data?: any[];
    subProcesses?: any[];
}

export interface ExecutableValidation {
    errors: string[];
    warnings: string[];
    checked_at: string;
}

/** definition.tobe.executable 저장 단위. */
export interface ExecutableData {
    version: number;
    definition: ExecutableDefinition | null;
    /** 변환 원본: 어느 도면에서 변환했는지. */
    source: 'asis' | 'tobe' | 'modularized';
    source_xml_hash: string;
    /**
     * 실행형 Pool 목록(participant id, 다중 지정 가능) — 풀 2개 이상 도면에서
     * 시작이벤트·실행 흐름의 기준. As-Is/To-Be 캔버스의 Pool 속성 패널에서 지정한다.
     */
    exec_pools?: Array<{ id: string; name?: string }>;
    /** @deprecated 구버전 단일 지정 — 로드 시 exec_pools 로 흡수되고, 첫 항목이 미러된다. */
    exec_pool_id?: string;
    exec_pool_name?: string;
    summary?: string;
    generated_at: string;
    validation: ExecutableValidation;
    /** Exec 뷰에서 마지막으로 직접 수정한 시각 — applied_at 보다 나중이면 재등록 필요. */
    edited_at?: string;
    /** 관리자가 proc_def.definition 에 실행 정의로 등록한 시각. */
    applied_at?: string;
    applied_by?: string;
    /** 마지막 등록이 기준으로 삼은 To-Be 도면 버전 (tobe_bpmn_versions 의 version). */
    applied_tobe_version?: string;
    /**
     * 등록 이력 — 인스턴스 start_date 와 대조해 "실행 당시" To-Be 도면 버전을 복원하는 근거.
     * (WorkItem 프로세스 탭 등 인스턴스 진행 표시가 사용. XML 본문은 tobe_bpmn_versions 에 있다.)
     */
    applied_history?: Array<{ applied_at: string; applied_by?: string; tobe_version?: string }>;
}

export const EXECUTABLE_SCHEMA_VERSION = 1;

const EXEC_ACTIVITY_TYPES = ['userTask', 'serviceTask', 'scriptTask'];
const TYPE_FALLBACK: Record<string, string> = {
    manualTask: 'userTask',
    sendTask: 'userTask',
    receiveTask: 'userTask',
    businessRuleTask: 'userTask',
    task: 'userTask',
    callActivity: 'userTask'
};

function execNowIso(): string {
    return new Date().toISOString();
}

export function createEmptyExecutable(): ExecutableData {
    return {
        version: EXECUTABLE_SCHEMA_VERSION,
        definition: null,
        source: 'asis',
        source_xml_hash: '',
        exec_pools: [],
        exec_pool_id: undefined,
        exec_pool_name: undefined,
        summary: '',
        generated_at: '',
        validation: { errors: [], warnings: [], checked_at: '' },
        edited_at: undefined,
        applied_at: undefined,
        applied_by: undefined,
        applied_tobe_version: undefined,
        applied_history: undefined
    };
}

export function normalizeExecutableData(raw: any): ExecutableData | null {
    if (!raw || typeof raw !== 'object') return null;
    const base = createEmptyExecutable();
    base.version = Number(raw.version) || EXECUTABLE_SCHEMA_VERSION;
    base.definition = raw.definition && typeof raw.definition === 'object' ? raw.definition : null;
    base.source = ['asis', 'tobe', 'modularized'].includes(raw.source) ? raw.source : 'asis';
    base.source_xml_hash = String(raw.source_xml_hash || '');
    base.exec_pools = (Array.isArray(raw.exec_pools) ? raw.exec_pools : [])
        .map((p: any) => ({ id: String(p?.id || '').trim(), name: p?.name ? String(p.name) : undefined }))
        .filter((p: { id: string }) => p.id);
    // 구버전 단일 지정 흡수 + 첫 항목 미러 (옛 판독 코드 호환)
    if (!base.exec_pools.length && raw.exec_pool_id) {
        base.exec_pools = [
            { id: String(raw.exec_pool_id), name: raw.exec_pool_name ? String(raw.exec_pool_name) : undefined }
        ];
    }
    base.exec_pool_id = base.exec_pools[0]?.id;
    base.exec_pool_name = base.exec_pools[0]?.name;
    base.summary = String(raw.summary || '');
    base.generated_at = String(raw.generated_at || '');
    base.validation = {
        errors: Array.isArray(raw.validation?.errors) ? raw.validation.errors.map(String) : [],
        warnings: Array.isArray(raw.validation?.warnings) ? raw.validation.warnings.map(String) : [],
        checked_at: String(raw.validation?.checked_at || '')
    };
    base.edited_at = raw.edited_at || undefined;
    base.applied_at = raw.applied_at || undefined;
    base.applied_by = raw.applied_by || undefined;
    base.applied_tobe_version = raw.applied_tobe_version || undefined;
    base.applied_history = Array.isArray(raw.applied_history)
        ? raw.applied_history
              .filter((h: any) => h && h.applied_at)
              .map((h: any) => ({
                  applied_at: String(h.applied_at),
                  applied_by: h.applied_by ? String(h.applied_by) : undefined,
                  tobe_version: h.tobe_version ? String(h.tobe_version) : undefined
              }))
        : undefined;
    return base;
}

/* ------------------------------------------------------------------ */
/* BPMN 스켈레톤 추출 (AI 프롬프트 근거 + 검증 기준)                       */
/* ------------------------------------------------------------------ */

export interface BpmnSkeletonNode {
    id: string;
    name: string;
    type: string;
    lane?: string;
    /** 소속 Pool(participant id) — 단일 풀 도면이면 undefined. */
    pool?: string;
}

export interface BpmnSkeletonPool {
    id: string;
    name: string;
    processRef: string;
}

export interface BpmnSkeletonFlow {
    id: string;
    name?: string;
    source: string;
    target: string;
}

export interface BpmnSkeleton {
    lanes: string[];
    /** 풀(participant) 목록 — 2개 이상이면 실행형 Pool 지정이 필요하다. */
    pools: BpmnSkeletonPool[];
    /** 노드 id → 소속 Pool(participant id). */
    poolByNode: Record<string, string>;
    activities: BpmnSkeletonNode[];
    gateways: BpmnSkeletonNode[];
    events: BpmnSkeletonNode[];
    flows: BpmnSkeletonFlow[];
    messageFlows: BpmnSkeletonFlow[];
}

const ACTIVITY_RE = /Task$|^task$|callActivity|subProcess/;
const GATEWAY_RE = /Gateway$/;

/**
 * BPMN XML 에 액티비티(태스크류)가 하나라도 있는지 — 실행형 변환 원본 선택용 경량 판별.
 * As-Is↔To-Be 토글만 해도 빈 To-Be 캔버스가 tobe_bpmn 으로 저장되므로,
 * "XML 이 존재한다"가 아니라 "액티비티가 있다"로 원본 후보를 골라야 한다.
 * (DOMParser 불필요 — node/테스트 환경에서도 동작)
 */
const HAS_ACTIVITY_TAG_RE =
    /<([a-zA-Z0-9_]+:)?(task|userTask|serviceTask|scriptTask|manualTask|sendTask|receiveTask|businessRuleTask|callActivity|subProcess)\b/;
export function hasBpmnActivities(xml: string): boolean {
    return !!xml && HAS_ACTIVITY_TAG_RE.test(String(xml));
}
const EVENT_RE = /^startEvent$|^endEvent$|^intermediateCatchEvent$|^intermediateThrowEvent$|^boundaryEvent$/;

/** BPMN XML 에서 실행 변환에 필요한 구조(노드·흐름·레인·풀)를 결정론적으로 추출한다. */
export function extractBpmnSkeleton(xml: string): BpmnSkeleton {
    const empty: BpmnSkeleton = {
        lanes: [],
        pools: [],
        poolByNode: {},
        activities: [],
        gateways: [],
        events: [],
        flows: [],
        messageFlows: []
    };
    if (!xml) return empty;
    let doc: Document;
    try {
        doc = new DOMParser().parseFromString(xml, 'application/xml');
    } catch {
        return empty;
    }
    if (doc.getElementsByTagName('parsererror').length) return empty;

    // lane → flowNodeRef 역색인
    const laneByNode = new Map<string, string>();
    const laneNames: string[] = [];
    for (const lane of Array.from(doc.getElementsByTagName('*')).filter((e) => e.localName === 'lane')) {
        const laneName = lane.getAttribute('name') || '';
        if (laneName && !laneNames.includes(laneName)) laneNames.push(laneName);
        for (const ref of Array.from(lane.children).filter((c) => c.localName === 'flowNodeRef')) {
            const nodeId = (ref.textContent || '').trim();
            if (nodeId && !laneByNode.has(nodeId)) laneByNode.set(nodeId, laneName);
        }
    }
    // participant(pool) — 이름은 레인 후보로도 (단일 레인 풀 대비)
    const pools: BpmnSkeletonPool[] = [];
    for (const p of Array.from(doc.getElementsByTagName('*')).filter((e) => e.localName === 'participant')) {
        const name = p.getAttribute('name') || '';
        if (name && !laneNames.includes(name)) laneNames.push(name);
        const pid = p.getAttribute('id');
        if (pid) pools.push({ id: pid, name: name || pid, processRef: p.getAttribute('processRef') || '' });
    }
    // 노드 → 소속 Pool: participant.processRef 가 가리키는 process 의 하위 노드 전부
    const poolByNode: Record<string, string> = {};
    for (const proc of Array.from(doc.getElementsByTagName('*')).filter((e) => e.localName === 'process')) {
        const procId = proc.getAttribute('id') || '';
        const pool = pools.find((x) => x.processRef === procId);
        if (!pool) continue;
        for (const el of Array.from(proc.getElementsByTagName('*'))) {
            const nid = el.getAttribute && el.getAttribute('id');
            if (nid && !(nid in poolByNode)) poolByNode[nid] = pool.id;
        }
    }

    const out: BpmnSkeleton = {
        lanes: laneNames,
        pools,
        poolByNode,
        activities: [],
        gateways: [],
        events: [],
        flows: [],
        messageFlows: []
    };
    for (const el of Array.from(doc.getElementsByTagName('*'))) {
        const ln = el.localName || '';
        const id = el.getAttribute('id');
        if (!id) continue;
        const node = { id, name: el.getAttribute('name') || '', type: ln, lane: laneByNode.get(id), pool: poolByNode[id] };
        if (ACTIVITY_RE.test(ln)) out.activities.push(node);
        else if (GATEWAY_RE.test(ln)) out.gateways.push(node);
        else if (EVENT_RE.test(ln)) out.events.push(node);
        else if (ln === 'sequenceFlow') {
            out.flows.push({
                id,
                name: el.getAttribute('name') || undefined,
                source: el.getAttribute('sourceRef') || '',
                target: el.getAttribute('targetRef') || ''
            });
        } else if (ln === 'messageFlow') {
            out.messageFlows.push({
                id,
                name: el.getAttribute('name') || undefined,
                source: el.getAttribute('sourceRef') || '',
                target: el.getAttribute('targetRef') || ''
            });
        }
    }
    return out;
}

/* ------------------------------------------------------------------ */
/* 정규화 (AI 응답 → 엔진 스키마)                                        */
/* ------------------------------------------------------------------ */

function toJsonString(v: any, fallback = '{}'): string {
    if (v == null || v === '') return fallback;
    if (typeof v === 'string') {
        try {
            JSON.parse(v);
            return v;
        } catch {
            return fallback;
        }
    }
    try {
        return JSON.stringify(v);
    } catch {
        return fallback;
    }
}

/**
 * 문자열 배열 정규화 — AI가 inputData/outputData 항목을 객체({name,...})로 반환하면
 * 이름 키를 추출한다. 과거에 String(객체)로 뭉개져 저장된 "[object Object]" 잔재는 버린다.
 */
export function cleanStringArray(v: any): string[] {
    if (!Array.isArray(v)) return [];
    return v
        .map((item) => {
            if (item == null) return '';
            if (typeof item === 'string') return item.trim();
            if (typeof item === 'object') {
                const name = item.name ?? item.key ?? item.id ?? item.label ?? item.text ?? item.field;
                return name != null ? String(name).trim() : '';
            }
            return String(item).trim();
        })
        .filter((s) => !!s && s !== '[object Object]');
}

function strArray(v: any): string[] {
    return cleanStringArray(v);
}

/**
 * AI 가 반환한 definition JSON 을 엔진 스키마에 맞게 정규화한다.
 * - 실행 불가 타입(manual/send/receive/callActivity 등) → userTask
 * - properties/condition 형태 보정 (properties 는 JSON "문자열")
 * - conditionFunction 이 객체로 온 경우 문자열 properties 로 흡수
 */
export function normalizeExecutableDefinition(raw: any, opts: { defId?: string; processName?: string } = {}): ExecutableDefinition | null {
    if (!raw || typeof raw !== 'object') return null;
    const def: ExecutableDefinition = {
        processDefinitionId: String(raw.processDefinitionId || opts.defId || '').toLowerCase(),
        processDefinitionName: String(raw.processDefinitionName || opts.processName || ''),
        description: raw.description ? String(raw.description) : undefined,
        roles: [],
        activities: [],
        gateways: [],
        events: [],
        sequences: [],
        data: Array.isArray(raw.data) ? raw.data : [],
        subProcesses: Array.isArray(raw.subProcesses) ? raw.subProcesses : []
    };

    for (const r of Array.isArray(raw.roles) ? raw.roles : []) {
        if (!r || !r.name) continue;
        def.roles.push({
            name: String(r.name),
            default: r.default != null ? String(r.default) : r.endpoint != null ? String(r.endpoint) : undefined,
            endpoint: r.endpoint != null ? String(r.endpoint) : undefined,
            resolutionRule: r.resolutionRule ? String(r.resolutionRule) : undefined
        });
    }

    for (const a of Array.isArray(raw.activities) ? raw.activities : []) {
        if (!a || !a.id) continue;
        let type = String(a.type || 'userTask');
        if (!EXEC_ACTIVITY_TYPES.includes(type)) type = TYPE_FALLBACK[type] || 'userTask';
        def.activities.push({
            id: String(a.id),
            name: String(a.name || a.id),
            type,
            description: String(a.description || a.name || a.id),
            instruction: a.instruction ? String(a.instruction) : '',
            role: String(a.role || ''),
            inputData: strArray(a.inputData),
            outputData: strArray(a.outputData),
            checkpoints: strArray(a.checkpoints),
            pythonCode: a.pythonCode ? String(a.pythonCode) : undefined,
            tool: a.tool ? String(a.tool) : '',
            properties: toJsonString(a.properties),
            duration: a.duration != null && !Number.isNaN(Number(a.duration)) ? Number(a.duration) : undefined,
            agent: a.agent ? String(a.agent) : undefined,
            agentMode: a.agentMode ? String(a.agentMode) : undefined,
            orchestration: a.orchestration ? String(a.orchestration) : undefined,
            attachedEvents: strArray(a.attachedEvents)
        });
    }

    for (const g of Array.isArray(raw.gateways) ? raw.gateways : []) {
        if (!g || !g.id) continue;
        let type = String(g.type || 'exclusiveGateway');
        if (type === 'exclusive') type = 'exclusiveGateway';
        if (type === 'parallel') type = 'parallelGateway';
        if (type === 'inclusive') type = 'inclusiveGateway';
        // AI 가 이벤트를 gateways 에 넣은 경우 events 로 회수
        if (/Event$/i.test(type) || type === 'startEvent' || type === 'endEvent') {
            def.events.push({
                id: String(g.id),
                name: String(g.name || ''),
                role: g.role ? String(g.role) : '',
                type: /start/i.test(type) ? 'startEvent' : 'endEvent',
                properties: toJsonString(g.properties),
                description: String(g.description || '')
            });
            continue;
        }
        def.gateways.push({
            id: String(g.id),
            name: String(g.name || ''),
            role: g.role ? String(g.role) : '',
            type,
            condition: g.condition && typeof g.condition === 'object' ? g.condition : {},
            conditionData: Array.isArray(g.conditionData) ? g.conditionData.map(String) : undefined,
            properties: toJsonString(g.properties),
            description: String(g.description || '')
        });
    }

    for (const e of Array.isArray(raw.events) ? raw.events : []) {
        if (!e || !e.id) continue;
        const t = String(e.type || '');
        def.events.push({
            id: String(e.id),
            name: String(e.name || ''),
            role: e.role ? String(e.role) : '',
            type: /start/i.test(t) ? 'startEvent' : /end/i.test(t) ? 'endEvent' : t,
            properties: toJsonString(e.properties),
            description: String(e.description || '')
        });
    }

    for (const s of Array.isArray(raw.sequences) ? raw.sequences : []) {
        if (!s || !s.source || !s.target) continue;
        let properties = s.properties;
        // conditionFunction 이 별도 키/객체로 온 경우 properties(JSON 문자열)로 흡수
        const cf = s.conditionFunction || (properties && typeof properties === 'object' ? properties.conditionFunction : undefined);
        if (typeof properties === 'object' && properties !== null) properties = toJsonString(properties);
        else properties = toJsonString(properties, '');
        if (cf && (!properties || !properties.includes('conditionFunction'))) {
            properties = JSON.stringify({ conditionFunction: String(cf) });
        }
        def.sequences.push({
            id: String(s.id || `${s.source}_${s.target}`),
            name: s.name ? String(s.name) : undefined,
            source: String(s.source),
            target: String(s.target),
            condition: s.condition != null && typeof s.condition === 'string' ? s.condition : '',
            properties: properties || undefined
        });
    }

    return def;
}

/* ------------------------------------------------------------------ */
/* 엔진 계약 검증                                                        */
/* ------------------------------------------------------------------ */

function parseProps(propString?: string): Record<string, any> {
    if (!propString) return {};
    try {
        const v = JSON.parse(propString);
        return v && typeof v === 'object' ? v : {};
    } catch {
        return {};
    }
}

/* 분기 라벨 ↔ conditionFunction 값 극성 검사 — AI 변환이 형제 분기의 값을 서로
 * 뒤바꿔 배정하면(라벨 '있음'에 == '아니오') 실행 시 분기가 반대로 흐른다. */
const BRANCH_NEG_WORDS = ['아니오', '아니요', '아님', '없음', '없다', '불가', '부적합', '미충족', '미통과', '반려', '거부', 'no', 'false'];
const BRANCH_POS_WORDS = ['예', '네', '응', '그래', '맞음', '있음', '있다', '가능', '적합', '충족', '통과', '승인', '동의', 'yes', 'true', 'ok'];

/** 라벨/비교값/필드명을 긍정(1)·부정(-1)으로 분류. 판단 불가면 null(검사 생략). */
function branchPolarity(raw?: string): 1 | -1 | null {
    const t = String(raw || '').toLowerCase().replace(/\s+/g, '').replace(/[?!.]+$/, '');
    if (!t) return null;
    // 부정 우선 — '누락없음'·'미통과'가 긍정 접미('있음'·'통과')보다 먼저 걸리게
    for (const w of BRANCH_NEG_WORDS) if (t === w || (w.length >= 2 && t.endsWith(w))) return -1;
    for (const w of BRANCH_POS_WORDS) if (t === w || (w.length >= 2 && t.endsWith(w))) return 1;
    return null;
}

/** conditionFunction 의 유효 극성 = 비교값 극성 × 필드명 극성 × (!= 이면 반전).
 *  필드명 극성은 '반려여부 == 예'(부정 분기)·'누락사항있음 == 아니오'(부정 분기)처럼
 *  질문이 필드명에 박힌 경우를 흡수한다. 애매하면 null. */
function conditionEffectivePolarity(expr: string): 1 | -1 | null {
    const text = String(expr || '');
    const hasEq = text.includes('==');
    const hasNeq = text.includes('!=');
    if (hasEq === hasNeq) return null;
    const values: string[] = [];
    const rest = text.replace(/(['"])((?:(?!\1).)*)\1/g, (_m, _q, v) => {
        values.push(String(v));
        return ' ';
    });
    if (!values.length) return null;
    const valuePols = values.map((v) => branchPolarity(v));
    if (valuePols.includes(null) || new Set(valuePols).size > 1) return null;
    const fieldPols = (rest.match(/[A-Za-z가-힣0-9_]+/g) || ([] as string[]))
        .filter((t: string) => !['or', 'and', 'not', 'in'].includes(t.toLowerCase()))
        .map((t) => branchPolarity(t.replace(/(여부|유무|인지)$/, '')))
        .filter((p): p is 1 | -1 => p !== null);
    if (new Set(fieldPols).size > 1) return null;
    const fieldPol = fieldPols[0] ?? 1;
    return ((valuePols[0] as number) * fieldPol * (hasNeq ? -1 : 1)) as 1 | -1;
}

/** 변환된 실행 정의를 엔진 계약(008 스펙 실측 규칙)으로 검증한다. */
export function validateExecutableDefinition(def: ExecutableDefinition | null): ExecutableValidation {
    const errors: string[] = [];
    const warnings: string[] = [];
    const done = (): ExecutableValidation => ({ errors, warnings, checked_at: execNowIso() });

    if (!def) {
        errors.push('실행 정의(definition)가 없습니다.');
        return done();
    }
    if (!def.processDefinitionId) errors.push('processDefinitionId 가 없습니다.');
    if (!Array.isArray(def.activities) || !def.activities.length) errors.push('activities 가 비어 있습니다.');
    if (!Array.isArray(def.roles) || !def.roles.length) errors.push('roles 가 비어 있습니다.');

    const starts = (def.events || []).filter((e) => e.type === 'startEvent');
    const ends = (def.events || []).filter((e) => e.type === 'endEvent');
    // 다중 시작(specs/010·t526 엔진 패치)이 지원되므로 startEvent 는 1개 이상이면 된다.
    if (!starts.length) errors.push('startEvent 가 최소 1개 필요합니다.');
    else if (starts.length >= 2) warnings.push(`startEvent 가 ${starts.length}개입니다 — 실행 시 시작점 선택 다이얼로그를 거칩니다.`);
    if (!ends.length) errors.push('endEvent 가 최소 1개 필요합니다.');

    const nodeIds = new Set<string>();
    for (const a of def.activities || []) nodeIds.add(a.id);
    for (const g of def.gateways || []) nodeIds.add(g.id);
    for (const e of def.events || []) nodeIds.add(e.id);

    // 시퀀스 참조 무결성 + 인접 맵
    const outgoing = new Map<string, ExecutableSequence[]>();
    const incoming = new Map<string, ExecutableSequence[]>();
    for (const s of def.sequences || []) {
        if (!nodeIds.has(s.source)) errors.push(`시퀀스 ${s.id} 의 source(${s.source})가 정의에 없습니다.`);
        if (!nodeIds.has(s.target)) errors.push(`시퀀스 ${s.id} 의 target(${s.target})가 정의에 없습니다.`);
        if (!outgoing.has(s.source)) outgoing.set(s.source, []);
        outgoing.get(s.source)!.push(s);
        if (!incoming.has(s.target)) incoming.set(s.target, []);
        incoming.get(s.target)!.push(s);
    }

    const activityById = new Map((def.activities || []).map((a) => [a.id, a]));
    const gatewayById = new Map((def.gateways || []).map((g) => [g.id, g]));

    // start 직후 액티비티 필수 (find_initial_activity 계약) — 다중 시작이면 시작점마다 검사
    for (const start of starts) {
        const label = starts.length > 1 ? `startEvent "${start.name || start.id}"` : 'startEvent';
        const startOut = outgoing.get(start.id) || [];
        if (!startOut.length) {
            errors.push(`${label} 에서 나가는 시퀀스가 없습니다.`);
        } else {
            const first = activityById.get(startOut[0].target);
            if (!first) {
                errors.push(`${label} 직후에는 액티비티가 와야 합니다 (게이트웨이/이벤트 불가 — find_initial_activity 계약).`);
            }
            // 첫 태스크가 userTask 면 실행 시작 시 폼 입력(openStartForm)으로 값을 받으므로
            // exclusive 직결이어도 분기 결정 필드 공급이 가능하다 — 과거 "빈 폼 자동 제출" 경고는 폐기.
        }
    }

    // exclusive 분기: 2개 이상 outgoing 이면 전부 conditionFunction 필요
    for (const g of def.gateways || []) {
        const outs = outgoing.get(g.id) || [];
        if (g.type === 'exclusiveGateway' && outs.length >= 2) {
            const seenExpr = new Map<string, string>();
            for (const s of outs) {
                const props = parseProps(s.properties);
                const expr = String(props.conditionFunction || s.condition || '').trim();
                if (!expr) {
                    errors.push(`exclusive 게이트웨이 "${g.name || g.id}" 분기 시퀀스 ${s.id} 에 conditionFunction 이 없습니다.`);
                    continue;
                }
                // 형제 분기와 동일한 조건식이면 어느 쪽으로도 구분 불가
                const key = expr.replace(/\s+/g, '');
                const dup = seenExpr.get(key);
                if (dup) {
                    errors.push(
                        `exclusive 게이트웨이 "${g.name || g.id}" 의 분기 ${dup} 와 ${s.id} 의 conditionFunction 이 동일합니다("${expr}") — 분기를 구분할 수 없습니다.`
                    );
                } else {
                    seenExpr.set(key, s.id);
                }
                // 라벨과 조건값의 극성이 반대면 형제 분기와 값이 뒤바뀐 것 (운영 반전 사고 재발 방지)
                const labelPol = branchPolarity(s.name);
                const exprPol = conditionEffectivePolarity(expr);
                if (labelPol !== null && exprPol !== null && labelPol !== exprPol) {
                    errors.push(
                        `분기 시퀀스 ${s.id}(라벨 "${s.name}")의 conditionFunction("${expr}")이 라벨과 반대 의미입니다 — 형제 분기와 값이 뒤바뀐 것으로 보입니다. 각 분기의 비교 값은 자기 라벨 어휘를 그대로 쓰세요.`
                    );
                }
            }
        }
    }

    // serviceTask 직후 exclusive 게이트웨이 금지 (도구 출력은 폼 분기 필드를 만들 수 없음)
    for (const a of def.activities || []) {
        if (a.type !== 'serviceTask') continue;
        const outs = outgoing.get(a.id) || [];
        for (const s of outs) {
            const g = gatewayById.get(s.target);
            if (g && g.type === 'exclusiveGateway' && (outgoing.get(g.id) || []).length >= 2) {
                errors.push(
                    `serviceTask "${a.name}" 가 exclusive 게이트웨이("${g.name || g.id}")로 직결됩니다. 도구 출력은 분기 결정 필드를 공급할 수 없습니다 — 사람 확인 userTask 를 사이에 두세요.`
                );
            }
        }
    }

    // 실행 타입 검증
    for (const a of def.activities || []) {
        if (!EXEC_ACTIVITY_TYPES.includes(a.type)) {
            errors.push(`액티비티 "${a.name}" 의 타입(${a.type})은 실행 불가입니다 (userTask/serviceTask/scriptTask 만 지원).`);
        }
        if (a.type === 'scriptTask' && !a.pythonCode) {
            warnings.push(`scriptTask "${a.name}" 에 pythonCode 가 없습니다.`);
        }
        if (a.role && def.roles.every((r) => r.name !== a.role)) {
            errors.push(`액티비티 "${a.name}" 의 role("${a.role}")이 roles 에 정의되어 있지 않습니다.`);
        }
        if (!a.role) warnings.push(`액티비티 "${a.name}" 에 role 이 없습니다.`);
    }

    // 도달성: start 에서 BFS
    if (starts.length === 1) {
        const visited = new Set<string>([starts[0].id]);
        const queue = [starts[0].id];
        while (queue.length) {
            const cur = queue.shift()!;
            for (const s of outgoing.get(cur) || []) {
                if (!visited.has(s.target)) {
                    visited.add(s.target);
                    queue.push(s.target);
                }
            }
        }
        const unreachable = [...nodeIds].filter((id) => !visited.has(id));
        if (unreachable.length) {
            const names = unreachable
                .slice(0, 5)
                .map((id) => activityById.get(id)?.name || gatewayById.get(id)?.name || id);
            errors.push(
                `start 에서 도달 불가한 노드 ${unreachable.length}개: ${names.join(', ')}${unreachable.length > 5 ? ' …' : ''} (고립 섬·미연결 흐름 제거 필요).`
            );
        }
    }

    // 역할 endpoint (담당자 계정) — 없으면 LLM 보정에 의존하므로 경고
    for (const r of def.roles || []) {
        if (!r.endpoint) warnings.push(`역할 "${r.name}" 에 endpoint(담당자 email/uuid)가 없습니다 — 실행 시 LLM 역할 보정에 의존합니다.`);
    }

    return done();
}
