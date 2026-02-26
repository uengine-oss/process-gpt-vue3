/**
 * BPMN Model Service
 * Phase 1: XML 파싱 및 RDB 정규화 테이블 적재
 *
 * 기능:
 * - REQ-01: 모델 생성
 * - REQ-02: 모델 저장 (XML 파싱 포함)
 * - REQ-03: 모델 상세 조회
 * - REQ-04: 모델 목록 조회
 */

import BpmnModdle from 'bpmn-moddle';

// Types
export interface BpmnModel {
    id: string;
    tenant_id: string;
    proc_def_id: string;
    name: string | null;
    description: string | null;
    status: 'draft' | 'review' | 'published' | 'archived';
    parent_proc_def_id: string | null;
    domain_id: string | null;
    hierarchy_level: 'mega' | 'major' | 'sub' | null;
    process_id: string | null;
    is_executable: boolean;
    xml_hash: string | null;
    node_count: number;
    link_count: number;
    lane_count: number;
    parsed_at: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

export interface BpmnNode {
    id?: string;
    model_id: string;
    element_id: string;
    element_type: string;
    name: string | null;
    x: number | null;
    y: number | null;
    width: number | null;
    height: number | null;
    lane_id: string | null;
    task_type: string | null;
    assignee: string | null;
    candidate_groups: string | null;
    candidate_users: string | null;
    due_date: string | null;
    gateway_direction: string | null;
    event_type: string | null;
    event_definition: string | null;
    is_expanded: boolean;
    called_element: string | null;
    documentation: string | null;
    properties: Record<string, any>;
}

export interface BpmnLink {
    id?: string;
    model_id: string;
    element_id: string;
    element_type: string;
    name: string | null;
    source_node_id: string | null;
    target_node_id: string | null;
    source_element_id: string;
    target_element_id: string;
    condition_expression: string | null;
    is_default: boolean;
    waypoints: Array<{ x: number; y: number }> | null;
    properties: Record<string, any>;
}

export interface BpmnLane {
    id?: string;
    model_id: string;
    element_id: string;
    element_type: string;
    name: string | null;
    participant_ref: string | null;
    parent_lane_id: string | null;
    is_horizontal: boolean;
    x: number | null;
    y: number | null;
    width: number | null;
    height: number | null;
    properties: Record<string, any>;
}

export interface ParsedBpmnData {
    processId: string | null;
    processName: string | null;
    isExecutable: boolean;
    nodes: BpmnNode[];
    links: BpmnLink[];
    lanes: BpmnLane[];
}

export interface ModelCreateParams {
    proc_def_id: string;
    name?: string;
    description?: string;
    parent_proc_def_id?: string;
    domain_id?: string;
    hierarchy_level?: 'mega' | 'major' | 'sub';
}

export interface ModelSaveParams {
    xml_content: string;
    thumbnail_svg?: string;
}

export interface ModelListParams {
    tenant_id?: string;
    status?: string;
    domain_id?: string;
    hierarchy_level?: string;
    search?: string;
    page?: number;
    limit?: number;
}

// XML 해시 생성 (변경 감지용)
function hashXml(xml: string): string {
    let hash = 0;
    const normalized = xml.replace(/\s+/g, ' ').trim();
    for (let i = 0; i < normalized.length; i++) {
        const char = normalized.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
}

// BPMN Element 타입 분류
function getElementCategory(type: string): 'node' | 'link' | 'lane' | 'other' {
    const nodeTypes = [
        'bpmn:Task', 'bpmn:UserTask', 'bpmn:ServiceTask', 'bpmn:ScriptTask',
        'bpmn:ManualTask', 'bpmn:BusinessRuleTask', 'bpmn:SendTask', 'bpmn:ReceiveTask',
        'bpmn:StartEvent', 'bpmn:EndEvent', 'bpmn:IntermediateThrowEvent', 'bpmn:IntermediateCatchEvent',
        'bpmn:BoundaryEvent',
        'bpmn:ExclusiveGateway', 'bpmn:ParallelGateway', 'bpmn:InclusiveGateway',
        'bpmn:EventBasedGateway', 'bpmn:ComplexGateway',
        'bpmn:SubProcess', 'bpmn:CallActivity', 'bpmn:Transaction',
        'bpmn:DataObjectReference', 'bpmn:DataStoreReference',
        'bpmn:TextAnnotation', 'bpmn:Group'
    ];

    const linkTypes = [
        'bpmn:SequenceFlow', 'bpmn:MessageFlow', 'bpmn:Association', 'bpmn:DataInputAssociation', 'bpmn:DataOutputAssociation'
    ];

    const laneTypes = ['bpmn:Participant', 'bpmn:Lane'];

    if (nodeTypes.includes(type)) return 'node';
    if (linkTypes.includes(type)) return 'link';
    if (laneTypes.includes(type)) return 'lane';
    return 'other';
}

// Task 타입 추출
function getTaskType(element: any): string | null {
    const type = element.$type;
    if (type === 'bpmn:UserTask') return 'user';
    if (type === 'bpmn:ServiceTask') return 'service';
    if (type === 'bpmn:ScriptTask') return 'script';
    if (type === 'bpmn:ManualTask') return 'manual';
    if (type === 'bpmn:BusinessRuleTask') return 'business_rule';
    if (type === 'bpmn:SendTask') return 'send';
    if (type === 'bpmn:ReceiveTask') return 'receive';
    if (type === 'bpmn:Task') return 'manual'; // default
    return null;
}

// Event 타입 추출
function getEventType(element: any): { type: string | null; definition: string | null } {
    const type = element.$type;
    let eventType: string | null = null;
    let eventDefinition: string | null = null;

    if (type.includes('StartEvent')) eventType = 'start';
    else if (type.includes('EndEvent')) eventType = 'end';
    else if (type.includes('IntermediateThrowEvent')) eventType = 'intermediate_throw';
    else if (type.includes('IntermediateCatchEvent')) eventType = 'intermediate_catch';
    else if (type.includes('BoundaryEvent')) eventType = 'boundary';

    // Event Definition
    if (element.eventDefinitions && element.eventDefinitions.length > 0) {
        const def = element.eventDefinitions[0].$type;
        if (def.includes('Timer')) eventDefinition = 'timer';
        else if (def.includes('Message')) eventDefinition = 'message';
        else if (def.includes('Signal')) eventDefinition = 'signal';
        else if (def.includes('Error')) eventDefinition = 'error';
        else if (def.includes('Escalation')) eventDefinition = 'escalation';
        else if (def.includes('Conditional')) eventDefinition = 'conditional';
        else if (def.includes('Compensate')) eventDefinition = 'compensate';
        else if (def.includes('Cancel')) eventDefinition = 'cancel';
        else if (def.includes('Terminate')) eventDefinition = 'terminate';
        else if (def.includes('Link')) eventDefinition = 'link';
    }

    return { type: eventType, definition: eventDefinition };
}

// Gateway 방향 추출
function getGatewayDirection(element: any): string | null {
    if (!element.$type.includes('Gateway')) return null;
    // 들어오는/나가는 흐름 개수로 방향 결정
    const incoming = element.incoming?.length || 0;
    const outgoing = element.outgoing?.length || 0;

    if (incoming <= 1 && outgoing > 1) return 'diverging';
    if (incoming > 1 && outgoing <= 1) return 'converging';
    if (incoming > 1 && outgoing > 1) return 'mixed';
    return null;
}

/**
 * BPMN XML 파싱
 */
export async function parseBpmnXml(xml: string, modelId: string): Promise<ParsedBpmnData> {
    const moddle = new BpmnModdle();
    const { rootElement } = await moddle.fromXML(xml);

    const nodes: BpmnNode[] = [];
    const links: BpmnLink[] = [];
    const lanes: BpmnLane[] = [];

    let processId: string | null = null;
    let processName: string | null = null;
    let isExecutable = false;

    // DI (Diagram Interchange) 정보 수집
    const diMap = new Map<string, any>();
    if (rootElement.diagrams && rootElement.diagrams.length > 0) {
        const diagram = rootElement.diagrams[0];
        if (diagram.plane && diagram.plane.planeElement) {
            diagram.plane.planeElement.forEach((di: any) => {
                if (di.bpmnElement) {
                    diMap.set(di.bpmnElement.id, di);
                }
            });
        }
    }

    // Lane과 노드의 매핑 수집
    const laneNodeMap = new Map<string, string>(); // nodeId -> laneId

    // Process 탐색 함수
    function traverseElements(elements: any[], parentLaneId: string | null = null) {
        if (!elements) return;

        elements.forEach((element: any) => {
            const elementId = element.id;
            const elementType = element.$type;
            const category = getElementCategory(elementType);
            const di = diMap.get(elementId);

            // Lane/Participant 처리
            if (category === 'lane') {
                const lane: BpmnLane = {
                    model_id: modelId,
                    element_id: elementId,
                    element_type: elementType.replace('bpmn:', ''),
                    name: element.name || null,
                    participant_ref: element.processRef?.id || null,
                    parent_lane_id: parentLaneId,
                    is_horizontal: di?.isHorizontal !== false,
                    x: di?.bounds?.x || null,
                    y: di?.bounds?.y || null,
                    width: di?.bounds?.width || null,
                    height: di?.bounds?.height || null,
                    properties: {}
                };
                lanes.push(lane);

                // Lane 내 flowNodeRef 매핑
                if (element.flowNodeRef) {
                    element.flowNodeRef.forEach((ref: any) => {
                        laneNodeMap.set(ref.id, elementId);
                    });
                }

                // 중첩 Lane 처리
                if (element.childLaneSet?.lanes) {
                    traverseElements(element.childLaneSet.lanes, elementId);
                }
            }

            // Node 처리
            if (category === 'node') {
                const taskType = getTaskType(element);
                const eventInfo = getEventType(element);
                const gatewayDir = getGatewayDirection(element);

                const node: BpmnNode = {
                    model_id: modelId,
                    element_id: elementId,
                    element_type: elementType.replace('bpmn:', ''),
                    name: element.name || null,
                    x: di?.bounds?.x || null,
                    y: di?.bounds?.y || null,
                    width: di?.bounds?.width || null,
                    height: di?.bounds?.height || null,
                    lane_id: null, // 나중에 매핑
                    task_type: taskType,
                    assignee: element.assignee || null,
                    candidate_groups: element.candidateGroups || null,
                    candidate_users: element.candidateUsers || null,
                    due_date: element.dueDate || null,
                    gateway_direction: gatewayDir,
                    event_type: eventInfo.type,
                    event_definition: eventInfo.definition,
                    is_expanded: element.isExpanded !== false,
                    called_element: element.calledElement || null,
                    documentation: element.documentation?.[0]?.text || null,
                    properties: {}
                };
                nodes.push(node);

                // SubProcess 내부 요소 재귀 처리
                if (element.flowElements) {
                    traverseElements(element.flowElements, parentLaneId);
                }
            }

            // Link 처리
            if (category === 'link') {
                const waypoints = di?.waypoint?.map((wp: any) => ({ x: wp.x, y: wp.y })) || null;

                const link: BpmnLink = {
                    model_id: modelId,
                    element_id: elementId,
                    element_type: elementType.replace('bpmn:', ''),
                    name: element.name || null,
                    source_node_id: null, // 나중에 매핑
                    target_node_id: null, // 나중에 매핑
                    source_element_id: element.sourceRef?.id || '',
                    target_element_id: element.targetRef?.id || '',
                    condition_expression: element.conditionExpression?.body || null,
                    is_default: false,
                    waypoints: waypoints,
                    properties: {}
                };
                links.push(link);
            }
        });
    }

    // Root elements 순회
    if (rootElement.rootElements) {
        rootElement.rootElements.forEach((rootEl: any) => {
            // Collaboration (Pool/Participant 포함)
            if (rootEl.$type === 'bpmn:Collaboration') {
                if (rootEl.participants) {
                    traverseElements(rootEl.participants);
                }
                if (rootEl.messageFlows) {
                    traverseElements(rootEl.messageFlows);
                }
            }

            // Process
            if (rootEl.$type === 'bpmn:Process') {
                processId = rootEl.id;
                processName = rootEl.name || null;
                isExecutable = rootEl.isExecutable || false;

                // LaneSet 처리
                if (rootEl.laneSets) {
                    rootEl.laneSets.forEach((laneSet: any) => {
                        if (laneSet.lanes) {
                            traverseElements(laneSet.lanes);
                        }
                    });
                }

                // FlowElements 처리
                if (rootEl.flowElements) {
                    traverseElements(rootEl.flowElements);
                }
            }
        });
    }

    // Lane 매핑 적용
    nodes.forEach(node => {
        const laneElementId = laneNodeMap.get(node.element_id);
        if (laneElementId) {
            const lane = lanes.find(l => l.element_id === laneElementId);
            if (lane && lane.id) {
                node.lane_id = lane.id;
            }
        }
    });

    return {
        processId,
        processName,
        isExecutable,
        nodes,
        links,
        lanes
    };
}

/**
 * BPMN Model Service Class
 */
export class BpmnModelService {
    private supabase: any;
    private tenantId: string;

    constructor() {
        this.supabase = window.$supabase;
        this.tenantId = window.$tenantName || 'default';
    }

    /**
     * REQ-01: 모델 생성
     */
    async createModel(params: ModelCreateParams): Promise<BpmnModel> {
        const { data, error } = await this.supabase
            .from('tb_bpmn_model')
            .insert({
                tenant_id: this.tenantId,
                proc_def_id: params.proc_def_id,
                name: params.name || null,
                description: params.description || null,
                parent_proc_def_id: params.parent_proc_def_id || null,
                domain_id: params.domain_id || null,
                hierarchy_level: params.hierarchy_level || null,
                status: 'draft',
                created_by: localStorage.getItem('uid') || null
            })
            .select()
            .single();

        if (error) throw new Error(`모델 생성 실패: ${error.message}`);
        return data;
    }

    /**
     * REQ-02: 모델 저장 (XML 파싱 포함)
     */
    async saveModel(procDefId: string, params: ModelSaveParams): Promise<BpmnModel> {
        // 1. 기존 모델 조회 또는 생성
        let model = await this.getModelByProcDefId(procDefId);

        if (!model) {
            model = await this.createModel({ proc_def_id: procDefId });
        }

        // 2. XML 해시 비교 (변경 없으면 스킵)
        const newHash = hashXml(params.xml_content);
        if (model.xml_hash === newHash) {
            console.log('XML 변경 없음, 파싱 스킵');
            return model;
        }

        // 3. 기존 파싱 데이터 삭제
        await this.clearModelData(model.id);

        // 4. XML 파싱
        const parsed = await parseBpmnXml(params.xml_content, model.id);

        // 5. Lane 저장 (먼저 저장하여 ID 확보)
        const laneIdMap = new Map<string, string>();
        for (const lane of parsed.lanes) {
            const { data: savedLane, error } = await this.supabase
                .from('tb_bpmn_lane')
                .insert(lane)
                .select()
                .single();

            if (error) {
                console.error('Lane 저장 실패:', error);
                continue;
            }
            laneIdMap.set(lane.element_id, savedLane.id);
        }

        // 6. Node 저장
        const nodeIdMap = new Map<string, string>();
        for (const node of parsed.nodes) {
            // Lane ID 매핑
            const laneElementId = Array.from(laneIdMap.keys()).find(key => {
                const originalLane = parsed.lanes.find(l => l.element_id === key);
                return originalLane && parsed.nodes.some(n =>
                    n.element_id === node.element_id &&
                    n.lane_id === originalLane.element_id
                );
            });

            const nodeToSave = {
                ...node,
                lane_id: laneElementId ? laneIdMap.get(laneElementId) : null
            };

            const { data: savedNode, error } = await this.supabase
                .from('tb_bpmn_node')
                .insert(nodeToSave)
                .select()
                .single();

            if (error) {
                console.error('Node 저장 실패:', error);
                continue;
            }
            nodeIdMap.set(node.element_id, savedNode.id);
        }

        // 7. Link 저장 (Node ID 매핑 적용)
        for (const link of parsed.links) {
            const linkToSave = {
                ...link,
                source_node_id: nodeIdMap.get(link.source_element_id) || null,
                target_node_id: nodeIdMap.get(link.target_element_id) || null
            };

            const { error } = await this.supabase
                .from('tb_bpmn_link')
                .insert(linkToSave);

            if (error) {
                console.error('Link 저장 실패:', error);
            }
        }

        // 8. 모델 메타데이터 업데이트
        const { data: updatedModel, error: updateError } = await this.supabase
            .from('tb_bpmn_model')
            .update({
                name: parsed.processName || model.name,
                process_id: parsed.processId,
                is_executable: parsed.isExecutable,
                xml_hash: newHash,
                node_count: parsed.nodes.length,
                link_count: parsed.links.length,
                lane_count: parsed.lanes.length,
                parsed_at: new Date().toISOString()
            })
            .eq('id', model.id)
            .select()
            .single();

        if (updateError) throw new Error(`모델 업데이트 실패: ${updateError.message}`);
        return updatedModel;
    }

    /**
     * REQ-03: 모델 상세 조회
     */
    async getModel(modelId: string): Promise<BpmnModel | null> {
        const { data, error } = await this.supabase
            .from('tb_bpmn_model')
            .select('*')
            .eq('id', modelId)
            .single();

        if (error) return null;
        return data;
    }

    /**
     * proc_def_id로 모델 조회
     */
    async getModelByProcDefId(procDefId: string): Promise<BpmnModel | null> {
        const { data, error } = await this.supabase
            .from('tb_bpmn_model')
            .select('*')
            .eq('tenant_id', this.tenantId)
            .eq('proc_def_id', procDefId)
            .single();

        if (error) return null;
        return data;
    }

    /**
     * REQ-04: 모델 목록 조회
     */
    async listModels(params: ModelListParams = {}): Promise<{ data: BpmnModel[]; total: number }> {
        const page = params.page || 1;
        const limit = params.limit || 20;
        const offset = (page - 1) * limit;

        let query = this.supabase
            .from('tb_bpmn_model')
            .select('*', { count: 'exact' })
            .eq('tenant_id', this.tenantId)
            .is('deleted_at', null);

        if (params.status) {
            query = query.eq('status', params.status);
        }
        if (params.domain_id) {
            query = query.eq('domain_id', params.domain_id);
        }
        if (params.hierarchy_level) {
            query = query.eq('hierarchy_level', params.hierarchy_level);
        }
        if (params.search) {
            query = query.ilike('name', `%${params.search}%`);
        }

        query = query.order('updated_at', { ascending: false })
            .range(offset, offset + limit - 1);

        const { data, error, count } = await query;

        if (error) throw new Error(`모델 목록 조회 실패: ${error.message}`);
        return { data: data || [], total: count || 0 };
    }

    /**
     * 모델의 노드 목록 조회
     */
    async getModelNodes(modelId: string, elementType?: string): Promise<BpmnNode[]> {
        let query = this.supabase
            .from('tb_bpmn_node')
            .select('*')
            .eq('model_id', modelId);

        if (elementType) {
            query = query.eq('element_type', elementType);
        }

        const { data, error } = await query;
        if (error) throw new Error(`노드 조회 실패: ${error.message}`);
        return data || [];
    }

    /**
     * 모델의 링크 목록 조회
     */
    async getModelLinks(modelId: string): Promise<BpmnLink[]> {
        const { data, error } = await this.supabase
            .from('tb_bpmn_link')
            .select('*')
            .eq('model_id', modelId);

        if (error) throw new Error(`링크 조회 실패: ${error.message}`);
        return data || [];
    }

    /**
     * 모델의 레인 목록 조회
     */
    async getModelLanes(modelId: string): Promise<BpmnLane[]> {
        const { data, error } = await this.supabase
            .from('tb_bpmn_lane')
            .select('*')
            .eq('model_id', modelId);

        if (error) throw new Error(`레인 조회 실패: ${error.message}`);
        return data || [];
    }

    /**
     * 모델 파싱 데이터 삭제
     */
    private async clearModelData(modelId: string): Promise<void> {
        await this.supabase.from('tb_bpmn_link').delete().eq('model_id', modelId);
        await this.supabase.from('tb_bpmn_node').delete().eq('model_id', modelId);
        await this.supabase.from('tb_bpmn_lane').delete().eq('model_id', modelId);
    }

    /**
     * 모델 삭제 (soft delete)
     */
    async deleteModel(modelId: string): Promise<void> {
        const { error } = await this.supabase
            .from('tb_bpmn_model')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', modelId);

        if (error) throw new Error(`모델 삭제 실패: ${error.message}`);
    }
}

// Singleton instance
let bpmnModelServiceInstance: BpmnModelService | null = null;

export function getBpmnModelService(): BpmnModelService {
    if (!bpmnModelServiceInstance) {
        bpmnModelServiceInstance = new BpmnModelService();
    }
    return bpmnModelServiceInstance;
}

export default BpmnModelService;
