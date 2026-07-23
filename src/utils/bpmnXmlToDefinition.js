/**
 * BPMN XML → proc_def_version.definition(JSON) 변환.
 * `ProcessDefinitionModule.vue`의 `convertXMLToJSON`/`reorderActivitiesBySequence`에서
 * Vue 컴포넌트 컨텍스트(this.fullPath/this.$route) 의존성을 제거해 추출한 순수 함수.
 * `ProcessDefinitionModule.vue`는 이 모듈의 얇은 래퍼로 남아 기존 호출부와 동일하게 동작한다.
 *
 * 사용 위치:
 * - src/components/ProcessDefinitionModule.vue (다이어그램 직접 편집 후 저장 경로)
 * - src/components/api/ProcessGPTBackend.ts (전체 프로세스 개선안 반영, process-feedback-whole-definition-review)
 */

import xml2js from 'xml2js';

const INHERIT_LANE_TO_CHILDREN = true; // (기존 동작 유지)

/**
 * 시퀀스 정보를 활용하여 activities 순서를 재정렬하는 함수
 */
export function reorderActivitiesBySequence(jsonData) {
    try {
        if (!jsonData.sequences || !jsonData.activities || jsonData.activities.length === 0) {
            return jsonData;
        }

        // 시퀀스로부터 그래프 구조 생성
        const graph = {};
        const inDegree = {};

        // 모든 노드 초기화
        [...jsonData.events, ...jsonData.activities, ...jsonData.gateways].forEach((node) => {
            graph[node.id] = [];
            inDegree[node.id] = 0;
        });

        // 시퀀스로부터 그래프 간선 추가
        jsonData.sequences.forEach((seq) => {
            if (graph[seq.source] && inDegree.hasOwnProperty(seq.target)) {
                graph[seq.source].push(seq.target);
                inDegree[seq.target]++;
            }
        });

        // 시작 노드 찾기 (보통 start_event이지만 inDegree가 0인 노드들 중에서)
        let startNodes = Object.keys(inDegree).filter((node) => inDegree[node] === 0);

        if (startNodes.length === 0) {
            // 순환이 있는 경우 원래 순서 유지
            return jsonData;
        }

        // BFS를 통한 순서 결정
        const visitedOrder = [];
        const visited = new Set();
        const queue = [...startNodes];

        while (queue.length > 0) {
            const currentNode = queue.shift();

            if (visited.has(currentNode)) {
                continue;
            }

            visited.add(currentNode);
            visitedOrder.push(currentNode);

            // 다음 노드들을 큐에 추가 (inDegree 감소시키면서)
            graph[currentNode].forEach((nextNode) => {
                inDegree[nextNode]--;
                if (inDegree[nextNode] === 0 && !visited.has(nextNode)) {
                    queue.push(nextNode);
                }
            });
        }

        // activities만 추출하여 순서대로 재정렬
        const activityIds = jsonData.activities.map((activity) => activity.id);
        const orderedActivityIds = visitedOrder.filter((id) => activityIds.includes(id));

        // 순서대로 activities 재배열
        const reorderedActivities = [];
        orderedActivityIds.forEach((id) => {
            const activity = jsonData.activities.find((act) => act.id === id);
            if (activity) {
                reorderedActivities.push(activity);
            }
        });

        // 혹시 누락된 activities가 있다면 마지막에 추가
        jsonData.activities.forEach((activity) => {
            if (!reorderedActivities.find((act) => act.id === activity.id)) {
                reorderedActivities.push(activity);
            }
        });

        jsonData.activities = reorderedActivities;
        return jsonData;
    } catch (error) {
        console.error('Error reordering activities:', error);
        // 에러 발생 시 원래 데이터 반환
        return jsonData;
    }
}

/**
 * @param {string} xmlString
 * @param {string} [processDefinitionId] - 결과 JSON의 processDefinitionId. 지정하지 않으면 'Unknown'.
 *   (Vue 컴포넌트 컨텍스트에서는 this.fullPath || this.$route?.params?.id || this.processDefinition.processDefinitionId
 *   순서로 정하던 것을 호출부가 명시적으로 넘기는 방식으로 대체)
 */
export async function convertXMLToJSON(xmlString, processDefinitionId) {
    try {
        if (!xmlString) return {};
        xmlString = xmlString.replace(/\$type/g, '_type');

        const parser = new xml2js.Parser({ explicitArray: false, mergeAttrs: true });
        const result = await parser.parseStringPromise(xmlString);

        const buildDiShapeIndex = (defs) => {
            const idx = Object.create(null);
            const A = (x) => (Array.isArray(x) ? x : x ? [x] : []);
            const diagrams = A(defs?.['bpmndi:BPMNDiagram']);
            for (const diag of diagrams) {
                const plane = diag?.['bpmndi:BPMNPlane'] || {};
                const shapes = A(plane?.['bpmndi:BPMNShape']);
                for (const sh of shapes) {
                    const be = sh?.bpmnElement || sh?.['@_bpmnElement'] || sh?.['bpmnElement'];
                    const b = sh?.['dc:Bounds'] || sh?.['dc:bounds'] || sh?.['Bounds'];
                    if (!be || !b) continue;
                    const num = (v) => (v == null ? NaN : Number(v));
                    const x = num(b.x ?? b['@_x']);
                    const y = num(b.y ?? b['@_y']);
                    const w = num(b.width ?? b['@_width']);
                    const h = num(b.height ?? b['@_height']);
                    if (Number.isNaN(x) || Number.isNaN(y) || Number.isNaN(w) || Number.isNaN(h)) continue;
                    idx[be] = { x, y, w, h };
                }
            }
            return idx;
        };

        const DI_INDEX = buildDiShapeIndex(result?.['bpmn:definitions']);

        // ---------- utils ----------
        const ensureArray = (x) => (Array.isArray(x) ? x : x ? [x] : []);
        const safeJson = (s, f = null) => {
            try {
                return s ? JSON.parse(s) : f;
            } catch {
                return f;
            }
        };
        const decodeXmlEntities = (s) => {
            if (!s || typeof s !== 'string') return s;
            return s
                .replace(/&quot;/g, '"')
                .replace(/&#34;/g, '"')
                .replace(/&apos;/g, "'")
                .replace(/&#39;/g, "'")
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&amp;/g, '&');
        };

        // ① JSON 파싱 캐시(문자열 → 객체 변환 1회만)
        const jsonCache = new WeakMap();
        const getPropsJson = (node) => {
            if (!node) return null;
            const first = (v) => (Array.isArray(v) ? v[0] : v);
            const ext = first(node['bpmn:extensionElements']);
            const props = first(ext?.['uengine:properties']);
            const raw = props?.['uengine:json'] || props?.['json'] || props?.$?.json || null;
            if (!raw) return null;
            if (typeof raw !== 'string') return raw;
            const str = decodeXmlEntities(raw);
            if (!jsonCache.has(node)) {
                jsonCache.set(node, safeJson(str, null));
            }
            return jsonCache.get(node);
        };

        const serializePropsJson = (node, propsJson) => {
            const parsed = propsJson ?? getPropsJson(node) ?? {};
            return JSON.stringify(parsed);
        };

        // ---------- route / meta ----------
        let definitionName = null;
        let version = null;
        let shortDescription = null;
        processDefinitionId = processDefinitionId || 'Unknown';

        // ---------- root extracts ----------
        let processes = result['bpmn:definitions']?.['bpmn:process'] || {};
        processes = Array.isArray(processes) ? processes : [processes];

        let event = [];
        let lanes = [];
        let activities = [];
        let subProcesses = [];
        let sequenceFlows = [];
        let gateways = [];
        let instanceNamePattern = null;
        let data = [];

        const participants = result['bpmn:definitions']?.['bpmn:collaboration']?.['bpmn:participant'] || {};

        function extractVariables(process) {
            const props = process['bpmn:extensionElements']?.['uengine:properties'];
            if (!props) return [];
            const vars = props['uengine:variable'];
            if (!vars) return [];
            const arr = ensureArray(vars);
            if (window.$mode == 'ProcessGPT') {
                return arr.map((v) => ({
                    name: v.name,
                    description: v.description || `${v.name} description`,
                    type: v.type
                }));
            }
            return arr.map((v) => ({
                name: v.name,
                description: v.description || `${v.name} description`,
                type: v.type,
                defaultValue: v['uengine:json'] ? safeJson(v['uengine:json'])?.defaultValue ?? null : null
            }));
        }

        // ---------- Lane 역색인 ----------
        const resolveRole = (nodeId, childLanes, parentLanes) => {
            const A = (x) => (Array.isArray(x) ? x : x ? [x] : []);
            const nodeRect = DI_INDEX && DI_INDEX[nodeId];

            // 1) 좌상단(x,y) 점이 들어가는 Lane 하나 선택
            if (nodeRect) {
                const px = nodeRect.x,
                    py = nodeRect.y;
                const candidates = [...A(childLanes), ...A(parentLanes)];
                for (const lane of candidates) {
                    const r = DI_INDEX && DI_INDEX[lane.id];
                    if (!r) continue;
                    if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) {
                        return lane.name || 'Unknown';
                    }
                }
            }

            // 2) flowNodeRef 폴백
            const buildLaneIndex = (lanesArr = []) => {
                const map = new Map();
                for (const lane of lanesArr) {
                    const refs = A(lane['bpmn:flowNodeRef'] || lane.flowNodeRef);
                    for (const id of refs) if (!map.has(id)) map.set(id, lane.name || 'Unknown');
                }
                return map;
            };
            const childIdx = buildLaneIndex(childLanes);
            if (childIdx.has(nodeId)) return childIdx.get(nodeId);
            if (INHERIT_LANE_TO_CHILDREN) {
                const parentIdx = buildLaneIndex(parentLanes);
                if (parentIdx.has(nodeId)) return parentIdx.get(nodeId);
            }

            // 3) 최종 폴백
            return 'Unknown';
        };

        // 항상 문자열을 보장하도록 역할 값을 정규화
        const normalizeRole = (val) => {
            if (typeof val === 'string') return val;
            if (val && typeof val === 'object') {
                if (typeof val.name === 'string') return val.name;
                return '';
            }
            return val == null ? '' : String(val);
        };

        // ---------- 재귀 파서 ----------
        function processSubProcess(subProcessTmp, processId, key) {
            const type = key ? key.replace('bpmn:', '') : 'subProcess';
            if (Array.isArray(subProcessTmp)) {
                return subProcessTmp.map((obj) => ({ ...obj, type: type, process: processId }));
            } else {
                return [{ ...subProcessTmp, type: type, process: processId }];
            }
        }

        function processBpmnProcess(proc) {
            let events = [];
            let activities = [];
            let gateways = [];
            let subProcesses = [];
            let lanes = [];
            let sequenceFlows = [];
            let data = [];
            let instanceNamePattern = null;
            let definitionName = null;
            let version = null;
            let shortDescription = null;

            // lanes / flows 먼저
            {
                let lanesTmp = ensureArray(proc['bpmn:laneSet'] ? proc['bpmn:laneSet']['bpmn:lane'] : []);
                lanesTmp = lanesTmp.map((obj) => ({ ...obj, process: proc.id }));
                lanes = lanes.concat(lanesTmp);

                let sequenceFlowsTmp = ensureArray(proc['bpmn:sequenceFlow'] || []);
                sequenceFlows = sequenceFlows.concat(sequenceFlowsTmp);

                // variables
                let dataTmp = extractVariables(proc);
                data = data.concat(dataTmp);

                // process-level json meta
                const processJson = getPropsJson(proc);
                if (processJson) {
                    instanceNamePattern = processJson.instanceNamePattern ?? null;
                    definitionName = processJson.definitionName ?? null;
                    version = processJson.version ?? null;
                    shortDescription = processJson.shortDescription ?? null;
                }
            }

            // 단일 루프: 키 순서 그대로 유지
            Object.keys(proc).forEach((key) => {
                const val = proc[key];
                if (!val) return;

                if (key.includes('Event')) {
                    let list = Array.isArray(val)
                        ? val.map((o) => ({ ...o, type: key.replace('bpmn:', ''), process: proc.id }))
                        : [{ ...val, type: key.replace('bpmn:', ''), process: proc.id }];
                    events = events.concat(list);
                } else if (key.includes('Task')) {
                    let list = Array.isArray(val)
                        ? val.map((o) => ({ ...o, type: key.replace('bpmn:', ''), process: proc.id }))
                        : [{ ...val, type: key.replace('bpmn:', ''), process: proc.id }];
                    activities = activities.concat(list);
                } else if (key.includes('Gateway')) {
                    let list = Array.isArray(val)
                        ? val.map((o) => ({ ...o, type: key.replace('bpmn:', ''), process: proc.id }))
                        : [{ ...val, type: key.replace('bpmn:', ''), process: proc.id }];
                    gateways = gateways.concat(list);
                } else if (key.toLowerCase().includes('subprocess')) {
                    const subs = processSubProcess(val, proc.id, key);

                    subs.forEach((sp) => {
                        const subRes = processBpmnProcess(sp);

                        // childrenRaw 보관(원형 유지)
                        sp.childrenRaw = {
                            events: subRes.events.slice(),
                            activities: subRes.activities.slice(),
                            gateways: subRes.gateways.slice(),
                            subProcesses: subRes.subProcesses.slice(),
                            sequences: subRes.sequenceFlows.slice(),
                            lanes: subRes.lanes.slice(),
                            data: subRes.data.slice()
                        };

                        // flatten 유지(나중에 재배치할 거라 그대로 합침)
                        events = events.concat(subRes.events);
                        activities = activities.concat(subRes.activities);
                        gateways = gateways.concat(subRes.gateways);
                        lanes = lanes.concat(subRes.lanes);
                        sequenceFlows = sequenceFlows.concat(subRes.sequenceFlows);
                        data = data.concat(subRes.data);
                    });

                    subProcesses = subProcesses.concat(subs);
                }
            });

            // attachedToRef → attachedEvents
            Object.keys(proc).forEach((key) => {
                if (!key.includes('Event')) return;
                let evList = Array.isArray(proc[key]) ? proc[key] : [proc[key]];
                evList.forEach((ev) => {
                    if (ev && ev.attachedToRef) {
                        const attachedActivity = activities.find((a) => a.id == ev.attachedToRef);
                        const attachedSubProcess = subProcesses.find((s) => s.id == ev.attachedToRef);
                        if (attachedActivity) {
                            attachedActivity.attachedEvents = attachedActivity.attachedEvents || [];
                            attachedActivity.attachedEvents.push(ev.id);
                        }
                        if (attachedSubProcess) {
                            attachedSubProcess.attachedEvents = attachedSubProcess.attachedEvents || [];
                            attachedSubProcess.attachedEvents.push(ev.id);
                        }
                    }
                });
            });

            return {
                events,
                activities,
                gateways,
                subProcesses,
                lanes,
                sequenceFlows,
                data,
                instanceNamePattern,
                definitionName,
                version,
                shortDescription
            };
        }

        // ---------- 빌더 ----------
        const buildEvent = (ev, lanesForRole, parentLanes) => {
            const definitionType = Object.keys(ev).filter((k) => k.includes('Definition'));
            return {
                name: ev.name,
                id: ev.id,
                type: ev.type,
                description: 'start event',
                role: resolveRole(ev.id, lanesForRole, parentLanes),
                process: ev.process,
                definitionType: definitionType ? definitionType[0] : null,
                properties: ev['bpmn:extensionElements']?.['uengine:properties']?.['uengine:json'] || '{}'
            };
        };

        const buildActivity = (activity, lanesForRole, parentLanes) => {
            const task = {};
            task.name = activity.name;
            task.id = activity.id;
            task.type = activity.type;
            task.description = ''; //`${activity.name} description`;
            task.instruction = ''; //`${activity.name} instruction`;
            task.process = activity.process;
            task.attachedEvents = activity.attachedEvents || null;
            task.agent = '';
            task.usePresetAgent = false;
            task.agentMode = '';
            task.orchestration = '';
            task.agentAssignedFrom = null;
            task.attachments = [];
            task.inputData = [];
            task.outputData = [];
            task.tool = 'formHandler:defaultform';
            task.tools = [];
            task.skills = [];
            task.properties = activity['bpmn:extensionElements']?.['uengine:properties']?.['uengine:json'] || '{}';
            if (window.$pal && window.$mode === 'uEngine') {
                task.uuid = activity.id;
            }

            task.role = normalizeRole(resolveRole(activity.id, lanesForRole, parentLanes));

            const propsJson = getPropsJson(activity) || {};
            if (propsJson) {
                if (Object.prototype.hasOwnProperty.call(propsJson, 'role')) {
                    task.role = normalizeRole(propsJson.role) || task.role;
                }
                task.duration = propsJson.duration || 5;
                task.description = propsJson.description || task.description;
                task.instruction = propsJson.instruction || task.instruction;
                task.checkpoints = propsJson.checkpoints || task.checkpoints;
                task.agent = propsJson.agent || task.agent;
                // '미리 설정된 에이전트 사용' 은 UI 전용처럼 보이지만 저장되지 않으면
                // 패널 재진입 때 !!agent 로 재유도되면서 선택이 초기화된다.
                task.usePresetAgent =
                    propsJson.usePresetAgent !== undefined ? !!propsJson.usePresetAgent : !!task.agent;
                task.agentMode = propsJson.agentMode || task.agentMode;
                task.orchestration = propsJson.orchestration || task.orchestration;
                task.agentAssignedFrom = propsJson.agentAssignedFrom || task.agentAssignedFrom;
                task.attachments = propsJson.attachments || task.attachments;
                task.inputData = propsJson.inputData || task.inputData;
                task.outputData = propsJson.outputData || task.outputData;
                task.tool = propsJson.tool || task.tool;
                task.tools = propsJson.tools || task.tools;
                task.skills = propsJson.skills || task.skills;
            }

            if (propsJson && propsJson.variableForHtmlFormContext && propsJson.variableForHtmlFormContext.name) {
                task.tool = `formHandler:${propsJson.variableForHtmlFormContext.name}`;
            }

            return task;
        };

        const buildGateway = (gateway, lanesForRole, parentLanes) => {
            const propsJson = getPropsJson(gateway) || {};
            return {
                id: gateway.id || 'Gateway',
                name: gateway.name || 'Gateway',
                type: gateway.type,
                description: (gateway.name || 'Gateway') + ' description',
                process: gateway.process,
                role: resolveRole(gateway.id, lanesForRole, parentLanes),
                condition: window.$mode == 'ProcessGPT' ? gateway.condition || '' : propsJson?.condition || '',
                // 게이트웨이 참조정보(분기 판단용 폼/필드 키): ["form_id.field_id", ...]
                conditionData: Array.isArray(propsJson?.conditionData) ? propsJson.conditionData : [],
                properties: gateway['bpmn:extensionElements']?.['uengine:properties']?.['uengine:json'] || '{}'
            };
        };

        const buildSequence = (flow) => {
            let condition = '';
            if (window.$mode == 'ProcessGPT') {
                condition = flow.condition || '';
            } else {
                const fjStr = flow['bpmn:extensionElements']?.['uengine:properties']?.['uengine:json'];
                condition = (fjStr ? safeJson(fjStr, {})?.condition : '') || flow.condition || '';
            }
            return {
                id: flow.id,
                name: flow.name,
                source: flow.sourceRef || flow.source,
                target: flow.targetRef || flow.target,
                condition,
                properties: flow['bpmn:extensionElements']?.['uengine:properties']?.['uengine:json'] || '{}'
            };
        };

        const buildRolesFromLanes = (lanesArr) => {
            return (lanesArr || []).map((lane) => {
                let endpoint = '';
                let defaultEndpoint = '';
                const laneJson = getPropsJson(lane);
                if (laneJson?.roleResolutionContext?._type === 'org.uengine.kernel.ExternalCustomerRoleResolutionContext') {
                    endpoint = 'external_customer';
                    defaultEndpoint = endpoint;
                } else {
                    if (!lane.endpoint) {
                        if (laneJson?.roleResolutionContext) {
                            if (laneJson.roleResolutionContext.endpoint) {
                                endpoint = laneJson.roleResolutionContext.endpoint;
                            }
                            if (laneJson.roleResolutionContext._type === 'org.uengine.kernel.DirectRoleResolutionContext') {
                                defaultEndpoint = endpoint;
                            }
                        }
                    } else {
                        endpoint = lane.endpoint;
                        defaultEndpoint = endpoint;
                    }
                }
                function isUUID(uuid) {
                    const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                    return regex.test(uuid);
                }
                if (endpoint && endpoint.length > 0) {
                    if (Array.isArray(endpoint)) {
                        endpoint = endpoint.filter((item) => isUUID(item));
                    } else {
                        endpoint = isUUID(endpoint) || endpoint == 'external_customer' ? endpoint : '';
                    }
                }
                if (defaultEndpoint && defaultEndpoint.length > 0) {
                    if (Array.isArray(defaultEndpoint)) {
                        defaultEndpoint = defaultEndpoint.filter((item) => isUUID(item));
                    } else {
                        defaultEndpoint = isUUID(defaultEndpoint) || defaultEndpoint == 'external_customer' ? defaultEndpoint : '';
                    }
                }
                return {
                    name: lane.name,
                    endpoint: endpoint,
                    resolutionRule: lane.resolutionRule,
                    default: defaultEndpoint
                };
            });
        };

        const buildSubprocessChildren = (raw, parentLanesForInheritance, parentProcName, parentProcId) => {
            if (!raw) return null;
            const childLanes = raw.lanes || [];
            const parentLanes = parentLanesForInheritance || [];

            return {
                // Pydantic 필수 필드 보완(부모 정의 상속)
                processDefinitionName: parentProcName,
                processDefinitionId: parentProcId,

                data: (raw.data || []).slice(),
                roles: buildRolesFromLanes(childLanes),
                events: (raw.events || []).map((ev) => buildEvent(ev, childLanes, parentLanes)),
                activities: (raw.activities || []).map((a) => buildActivity(a, childLanes, parentLanes)),
                gateways: (raw.gateways || []).map((g) => buildGateway(g, childLanes, parentLanes)),
                sequences: (raw.sequences || raw.sequenceFlows || []).map(buildSequence),

                subProcesses: (raw.subProcesses || []).map((childSp) => {
                    const propsJson = getPropsJson(childSp) || {};
                    return {
                        id: childSp.id,
                        name: childSp.name,
                        role: resolveRole(childSp.id, childLanes, parentLanes),
                        type: childSp.type,
                        process: childSp.process,
                        duration: propsJson?.duration ? propsJson.duration : 5,
                        description: propsJson.description || '',
                        instruction: propsJson.instruction || '',
                        tool: propsJson.tool || 'formHandler:defaultform',
                        properties: serializePropsJson(childSp, propsJson),
                        attachedEvents: childSp.attachedEvents || null,
                        // 재귀
                        children: buildSubprocessChildren(
                            childSp.childrenRaw,
                            INHERIT_LANE_TO_CHILDREN ? (childLanes.length ? childLanes : parentLanes) : [],
                            parentProcName,
                            parentProcId
                        )
                    };
                })
            };
        };

        // ---------- parse each process ----------
        for (let process of processes) {
            const res = processBpmnProcess(process);
            event = event.concat(res.events);
            lanes = lanes.concat(res.lanes);
            activities = activities.concat(res.activities);
            subProcesses = subProcesses.concat(res.subProcesses);
            sequenceFlows = sequenceFlows.concat(res.sequenceFlows);
            gateways = gateways.concat(res.gateways);
            data = data.concat(res.data);

            if (!instanceNamePattern && res.instanceNamePattern) instanceNamePattern = res.instanceNamePattern;
            if (!definitionName && res.definitionName) definitionName = res.definitionName;
            if (!version && res.version) version = res.version;
            if (!shortDescription && res.shortDescription) shortDescription = res.shortDescription;
        }

        // ---------- final JSON ----------
        const jsonData = {
            processDefinitionName: definitionName,
            processDefinitionId: processDefinitionId,
            version: version,
            shortDescription: shortDescription,
            description: 'process.description',
            data: data,
            roles: lanes.map((lane) => {
                let endpoint = '';
                let defaultEndpoint = '';
                const laneJson = getPropsJson(lane);
                if (laneJson?.roleResolutionContext?._type === 'org.uengine.kernel.ExternalCustomerRoleResolutionContext') {
                    endpoint = 'external_customer';
                    defaultEndpoint = endpoint;
                } else {
                    if (!lane.endpoint) {
                        if (laneJson?.roleResolutionContext) {
                            if (laneJson.roleResolutionContext.endpoint) {
                                endpoint = laneJson.roleResolutionContext.endpoint;
                            }
                            if (laneJson.roleResolutionContext._type === 'org.uengine.kernel.DirectRoleResolutionContext') {
                                defaultEndpoint = endpoint;
                            }
                        }
                    } else {
                        endpoint = lane.endpoint;
                        defaultEndpoint = endpoint;
                    }
                }
                function isUUID(uuid) {
                    const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                    return regex.test(uuid);
                }
                if (endpoint && endpoint.length > 0) {
                    if (Array.isArray(endpoint)) {
                        endpoint = endpoint.filter((item) => isUUID(item));
                    } else {
                        endpoint = isUUID(endpoint) || endpoint == 'external_customer' ? endpoint : '';
                    }
                }
                if (defaultEndpoint && defaultEndpoint.length > 0) {
                    if (Array.isArray(defaultEndpoint)) {
                        defaultEndpoint = defaultEndpoint.filter((item) => isUUID(item));
                    } else {
                        defaultEndpoint = isUUID(defaultEndpoint) || defaultEndpoint == 'external_customer' ? defaultEndpoint : '';
                    }
                }
                return {
                    name: lane.name,
                    endpoint: endpoint,
                    resolutionRule: lane.resolutionRule,
                    default: defaultEndpoint
                };
            }),
            events: [...event.map((ev) => buildEvent(ev, lanes, []))],
            activities: [...activities.map((activity) => buildActivity(activity, lanes, []))],
            subProcesses: [
                ...subProcesses.map((sp) => {
                    const propsJson = getPropsJson(sp) || {};
                    return {
                        id: sp.id,
                        name: sp.name,
                        type: sp.type,
                        role: resolveRole(sp.id, lanes, []),
                        process: sp.process,
                        duration: propsJson?.duration ? propsJson.duration : 5,
                        description: propsJson.description || '',
                        instruction: propsJson.instruction || '',
                        tool: propsJson.tool || 'formHandler:defaultform',
                        properties: serializePropsJson(sp, propsJson),
                        attachedEvents: sp.attachedEvents || null,
                        children: buildSubprocessChildren(sp.childrenRaw, lanes, definitionName, processDefinitionId)
                    };
                })
            ],
            gateways: [...gateways.map((gateway) => buildGateway(gateway, lanes, []))],
            sequences: sequenceFlows.map((flow) => buildSequence(flow)),
            participants: participants,
            instanceNamePattern: instanceNamePattern
        };

        // ---------- 안정적 재배치: 서브프로세스 기원 항목은 항상 끝으로 ----------
        // (reorderActivitiesBySequence 이후에 한 번 더 강제)
        const moveSubprocToEnd = (arr, subprocIdSet) => {
            const head = [];
            const tail = [];
            for (const item of arr || []) {
                if (subprocIdSet.has(item.process)) tail.push(item);
                else head.push(item);
            }
            return head.concat(tail); // 안정적(stable) 파티션
        };

        // 먼저 기존 정렬 로직 적용
        let reordered = reorderActivitiesBySequence(jsonData);

        // 모든 서브프로세스 ID 수집(중첩 포함) — subProcesses는 전체 플랫 수집이라 충분
        const subprocIds = new Set((reordered.subProcesses || []).map((sp) => sp.id));

        // 최종 강제: 이벤트/액티비티/게이트웨이에서 서브 기원은 맨 끝
        reordered.events = moveSubprocToEnd(reordered.events, subprocIds);
        reordered.activities = moveSubprocToEnd(reordered.activities, subprocIds);
        reordered.gateways = moveSubprocToEnd(reordered.gateways, subprocIds);
        // sequences는 요구사항에 없으므로 유지 (원하면 동일 규칙 적용 가능)

        return reordered;
    } catch (error) {
        console.error('Error parsing XML:', error);
        throw error;
    }
}
