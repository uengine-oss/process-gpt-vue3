/**
 * BPMN 유효성 검사 규칙 정의
 */

// 오류 레벨 상수
export const ERROR_LEVEL = {
    WARNING: 0,
    ERROR: 1
};

// 검증 결과 인터페이스
export interface ValidationItem {
    message: string;
    errorLevel: number;
    ruleId?: string;
}

export interface ValidationResult {
    [elementId: string]: ValidationItem[];
}

// 검증 규칙 인터페이스
export interface ValidationRule {
    id: string;
    level: number;
    messageKey: string;
    check: (element: any, context: ValidationContext) => boolean;
}

export interface ValidationContext {
    elements: any[];
    elementRegistry: any;
    connections: Map<string, { incoming: string[], outgoing: string[] }>;
}

/**
 * 검증 규칙 정의
 */
export const validationRules: ValidationRule[] = [
    // Error 레벨 규칙 (저장 시 경고)
    {
        id: 'E001',
        level: ERROR_LEVEL.ERROR,
        messageKey: 'validation.noStartEvent',
        check: (element, context) => {
            // 전체 프로세스에 시작 이벤트가 있는지 확인
            const hasStartEvent = context.elements.some(el => el.type === 'bpmn:StartEvent');
            // 이 규칙은 프로세스 레벨에서 한 번만 체크
            return element.type === 'bpmn:Process' && !hasStartEvent;
        }
    },
    {
        id: 'E002',
        level: ERROR_LEVEL.ERROR,
        messageKey: 'validation.noEndEvent',
        check: (element, context) => {
            const hasEndEvent = context.elements.some(el => el.type === 'bpmn:EndEvent');
            return element.type === 'bpmn:Process' && !hasEndEvent;
        }
    },

    // Warning 레벨 규칙 (저장 가능하지만 주의 필요)
    {
        id: 'W001',
        level: ERROR_LEVEL.WARNING,
        messageKey: 'validation.unnamedTask',
        check: (element) => {
            if (!element.type?.includes('Task')) return false;
            const name = element.businessObject?.name || '';
            return !name.trim();
        }
    },
    {
        id: 'W002',
        level: ERROR_LEVEL.WARNING,
        messageKey: 'validation.noIncomingConnection',
        check: (element, context) => {
            // StartEvent는 들어오는 연결이 없어도 됨
            if (element.type === 'bpmn:StartEvent') return false;
            // Task나 Gateway만 검사
            if (!element.type?.includes('Task') && !element.type?.includes('Gateway')) return false;

            const connections = context.connections.get(element.id);
            return !connections || connections.incoming.length === 0;
        }
    },
    {
        id: 'W003',
        level: ERROR_LEVEL.WARNING,
        messageKey: 'validation.noOutgoingConnection',
        check: (element, context) => {
            // EndEvent는 나가는 연결이 없어도 됨
            if (element.type === 'bpmn:EndEvent') return false;
            // Task나 Gateway만 검사
            if (!element.type?.includes('Task') && !element.type?.includes('Gateway')) return false;

            const connections = context.connections.get(element.id);
            return !connections || connections.outgoing.length === 0;
        }
    },
    {
        id: 'W004',
        level: ERROR_LEVEL.WARNING,
        messageKey: 'validation.gatewayNeedsBranches',
        check: (element, context) => {
            if (!element.type?.includes('Gateway')) return false;

            const connections = context.connections.get(element.id);
            if (!connections) return true;

            // 분기 게이트웨이는 나가는 연결이 2개 이상이어야 함
            // 병합 게이트웨이는 들어오는 연결이 2개 이상이어야 함
            const isJoinGateway = connections.incoming.length > 1;
            const isSplitGateway = connections.outgoing.length > 1;

            // 둘 다 아니면 경고
            return !isJoinGateway && !isSplitGateway;
        }
    },
    {
        id: 'W005',
        level: ERROR_LEVEL.WARNING,
        messageKey: 'validation.noLaneAssignee',
        check: (element) => {
            if (element.type !== 'bpmn:Lane') return false;
            const name = element.businessObject?.name || '';
            // Lane 이름이 없거나 기본값인 경우
            return !name.trim() || name === 'Lane' || name === 'Lane 1';
        }
    },
    {
        id: 'W006',
        level: ERROR_LEVEL.WARNING,
        messageKey: 'validation.missingCondition',
        check: (element) => {
            if (element.type !== 'bpmn:SequenceFlow') return false;

            // 게이트웨이에서 나가는 시퀀스 플로우인 경우
            const source = element.source;
            if (!source?.type?.includes('Gateway')) return false;

            // ExclusiveGateway나 InclusiveGateway에서 나가는 플로우는 조건이 필요
            if (source.type === 'bpmn:ExclusiveGateway' || source.type === 'bpmn:InclusiveGateway') {
                // default flow가 아닌 경우에만 조건 필요
                const isDefault = source.businessObject?.default?.id === element.id;
                if (isDefault) return false;

                const condition = element.businessObject?.conditionExpression;
                return !condition;
            }

            return false;
        }
    }
];

/**
 * XML을 파싱하여 요소 목록 추출
 */
export function parseXMLForValidation(xml: string): { elements: any[], connections: Map<string, { incoming: string[], outgoing: string[] }> } {
    const elements: any[] = [];
    const connections = new Map<string, { incoming: string[], outgoing: string[] }>();

    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xml, 'text/xml');

        // 모든 BPMN 요소 추출
        const bpmnElements = doc.querySelectorAll('*');
        bpmnElements.forEach(el => {
            const id = el.getAttribute('id');
            const name = el.getAttribute('name');
            const tagName = el.tagName;

            if (id) {
                elements.push({
                    id,
                    type: tagName.replace(/^bpmn:?/, 'bpmn:'),
                    businessObject: { id, name }
                });

                // 연결 정보 초기화
                if (!connections.has(id)) {
                    connections.set(id, { incoming: [], outgoing: [] });
                }
            }
        });

        // 시퀀스 플로우 연결 정보 추출
        const flows = doc.querySelectorAll('sequenceFlow, bpmn\\:sequenceFlow');
        flows.forEach(flow => {
            const sourceRef = flow.getAttribute('sourceRef');
            const targetRef = flow.getAttribute('targetRef');

            if (sourceRef && targetRef) {
                const sourceConn = connections.get(sourceRef) || { incoming: [], outgoing: [] };
                sourceConn.outgoing.push(targetRef);
                connections.set(sourceRef, sourceConn);

                const targetConn = connections.get(targetRef) || { incoming: [], outgoing: [] };
                targetConn.incoming.push(sourceRef);
                connections.set(targetRef, targetConn);
            }
        });

    } catch (error) {
        console.warn('XML 파싱 실패:', error);
    }

    return { elements, connections };
}

/**
 * 검증 실행
 */
export function runValidation(xml: string, i18nFunc?: (key: string) => string): ValidationResult {
    const result: ValidationResult = {};
    const { elements, connections } = parseXMLForValidation(xml);

    const context: ValidationContext = {
        elements,
        elementRegistry: null,
        connections
    };

    // 각 요소에 대해 모든 규칙 검사
    elements.forEach(element => {
        const violations: ValidationItem[] = [];

        validationRules.forEach(rule => {
            if (rule.check(element, context)) {
                violations.push({
                    message: i18nFunc ? i18nFunc(rule.messageKey) : rule.messageKey,
                    errorLevel: rule.level,
                    ruleId: rule.id
                });
            }
        });

        if (violations.length > 0) {
            result[element.id] = violations;
        }
    });

    return result;
}
