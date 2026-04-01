/**
 * bpmn-js modeler 기준 BPMN 검증 (프로세스 정의 에디터 공통 규칙)
 * ProcessHierarchyDesigner / ProcessDefinitionChat 등에서 동일하게 사용한다.
 */

export interface BpmnValidationIssue {
    level: 'warning' | 'error';
    message: string;
    shortMessage?: string;
    elementId?: string;
    elementName?: string;
    ruleId?: string;
}

/** 테스트·특수 환경용. 미지정 시 window 기준으로 동작 */
export interface ValidateBpmnModelOverrides {
    t?: (key: string) => string;
    isPal?: boolean;
    isUEngine?: boolean;
}

function tr(t: (key: string) => string, key: string, fallback: string): string {
    const v = t(key);
    return v && v !== key ? v : fallback;
}

function resolveValidationEnv(overrides?: ValidateBpmnModelOverrides) {
    const w = typeof window !== 'undefined' ? (window as Window & { $pal?: boolean; $mode?: string; $i18n?: { global?: { t?: (k: string) => string } } }) : null;
    const t = overrides?.t ?? w?.$i18n?.global?.t ?? ((k: string) => k);
    const isPal = overrides?.isPal ?? !!w?.$pal;
    const isUEngine = overrides?.isUEngine ?? w?.$mode === 'uEngine';
    return { t, isPal, isUEngine };
}

/**
 * bpmn-js modeler만 넘기면 검증. PAL/uEngine/i18n은 window에서 읽는다.
 * @param modeler bpmn-js Modeler 또는 Viewer 인스턴스
 * @param overrides 선택. 단위 테스트 등에서 window 없이 쓸 때
 */
export function validateBpmnModel(modeler: { get: (name: string) => any }, overrides?: ValidateBpmnModelOverrides): BpmnValidationIssue[] {
    const { t, isPal, isUEngine } = resolveValidationEnv(overrides);
    const results: BpmnValidationIssue[] = [];

    try {
        const elementRegistry = modeler.get('elementRegistry');
        const allElements = elementRegistry.getAll().filter((el: any) => el.type !== 'label' && !el.labelTarget);

        let hasStartEvent = false;
        let hasEndEvent = false;

        const connections = new Map<string, { incoming: string[]; outgoing: string[] }>();
        allElements.forEach((el: any) => {
            if (el.id) {
                connections.set(el.id, {
                    incoming: (el.incoming || []).map((c: any) => c.source?.id).filter(Boolean),
                    outgoing: (el.outgoing || []).map((c: any) => c.target?.id).filter(Boolean)
                });
            }
        });

        const processedIds = new Set<string>();
        allElements.forEach((element: any) => {
            if (processedIds.has(element.id)) return;
            processedIds.add(element.id);

            const type = element.type;
            if (type === 'bpmn:StartEvent') hasStartEvent = true;
            if (type === 'bpmn:EndEvent') hasEndEvent = true;

            const elementErrors: BpmnValidationIssue[] = [];

            if (type?.includes('Task')) {
                const name = element.businessObject?.name;
                if (!name || !name.trim()) {
                    elementErrors.push({
                        level: 'warning',
                        ruleId: 'W001',
                        message: tr(t, 'validation.unnamedTask', 'Task has no name.'),
                        shortMessage: tr(t, 'validation.nameRequired', 'Name Required')
                    });
                }
            }

            {
                const conn = connections.get(element.id);
                const noIncoming = !conn || conn.incoming.length === 0;
                const noOutgoing = !conn || conn.outgoing.length === 0;

                // Task: 완전 고립 시 기존 채팅 검증과 동일하게 unconnectedElement 한 건만 (W002+W003 대체)
                if (type?.includes('Task') && noIncoming && noOutgoing) {
                    elementErrors.push({
                        level: 'warning',
                        ruleId: 'UNCONNECTED_TASK',
                        message: tr(t, 'validation.unconnectedElement', 'Element is not connected.'),
                        shortMessage: tr(t, 'validation.connectionMissing', 'Connection Missing')
                    });
                } else {
                    if ((type?.includes('Task') || type?.includes('Gateway')) && type !== 'bpmn:StartEvent' && noIncoming) {
                        elementErrors.push({
                            level: 'warning',
                            ruleId: 'W002',
                            message: tr(t, 'validation.noIncomingConnection', 'No incoming connection.'),
                            shortMessage: tr(t, 'validation.connectionMissing', 'Connection Missing')
                        });
                    }
                    if ((type?.includes('Task') || type?.includes('Gateway')) && type !== 'bpmn:EndEvent' && noOutgoing) {
                        elementErrors.push({
                            level: 'warning',
                            ruleId: 'W003',
                            message: tr(t, 'validation.noOutgoingConnection', 'No outgoing connection.'),
                            shortMessage: tr(t, 'validation.connectionMissing', 'Connection Missing')
                        });
                    }
                }
            }

            if (type?.includes('Gateway')) {
                const conn = connections.get(element.id);
                if (conn) {
                    const isJoin = conn.incoming.length > 1;
                    const isSplit = conn.outgoing.length > 1;
                    if (!isJoin && !isSplit) {
                        elementErrors.push({
                            level: 'warning',
                            ruleId: 'W004',
                            message: tr(t, 'validation.gatewayNeedsBranches', 'Gateway needs at least 2 branches.'),
                            shortMessage: tr(t, 'validation.branchingRequired', 'Branching Required')
                        });
                    }
                }
            }

            if (!isPal && type === 'bpmn:Lane') {
                const name = element.businessObject?.name || '';
                if (!name.trim() || name === 'Lane' || name === 'Lane 1') {
                    elementErrors.push({
                        level: 'warning',
                        ruleId: 'W005',
                        message: tr(t, 'validation.noLaneAssignee', 'Lane has no assignee.'),
                        shortMessage: tr(t, 'validation.assigneeRequired', 'Assignee Required')
                    });
                }
            }

            if (!isPal && type === 'bpmn:SequenceFlow') {
                const source = element.source;
                if (source?.type === 'bpmn:ExclusiveGateway' || source?.type === 'bpmn:InclusiveGateway') {
                    const isDefault = source.businessObject?.default?.id === element.id;
                    if (!isDefault) {
                        const condition = element.businessObject?.conditionExpression;
                        if (!condition) {
                            elementErrors.push({
                                level: 'warning',
                                ruleId: 'W006',
                                message: tr(t, 'validation.missingCondition', 'Condition expression is missing.'),
                                shortMessage: tr(t, 'validation.conditionMissing', 'Condition Missing')
                            });
                        }
                    }
                }
            }

            if (isPal && type?.includes('Task')) {
                let description = '';
                const bo = element.businessObject;
                if (bo?.documentation?.[0]?.text) description = bo.documentation[0].text;
                if (!description?.trim() && bo?.extensionElements?.values) {
                    const uengineProps = bo.extensionElements.values.find((v: any) => v.$type === 'uengine:Properties');
                    if (uengineProps?.json) {
                        try {
                            const parsed = JSON.parse(uengineProps.json);
                            description = parsed && parsed.description ? String(parsed.description) : '';
                        } catch {
                            /* ignore */
                        }
                    }
                }
                if (!description?.trim()) {
                    elementErrors.push({
                        level: 'warning',
                        ruleId: 'PAL_MANUAL',
                        message: tr(t, 'validation.noManual', '매뉴얼이 없습니다.'),
                        shortMessage: tr(t, 'validation.noManual', '매뉴얼이 없습니다.')
                    });
                }
            }

            if (isUEngine && (type === 'bpmn:CallActivity' || type?.includes('CallActivity'))) {
                let definitionId = '';
                const bo = element.businessObject;
                if (bo?.extensionElements?.values) {
                    const uengineProps = bo.extensionElements.values.find((v: any) => v.$type === 'uengine:Properties');
                    if (uengineProps?.json) {
                        try {
                            const parsed = JSON.parse(uengineProps.json);
                            definitionId = parsed && parsed.definitionId ? String(parsed.definitionId).trim() : '';
                        } catch {
                            /* ignore */
                        }
                    }
                }
                if (!definitionId) {
                    elementErrors.push({
                        level: 'error',
                        ruleId: 'CALL_ACTIVITY',
                        message: tr(t, 'validation.callActivityNoProcess', '선택된 프로세스가 없습니다.'),
                        shortMessage: tr(t, 'validation.callActivityNoProcess', '선택된 프로세스가 없습니다.')
                    });
                }
            }

            elementErrors.forEach((err) => {
                results.push({
                    ...err,
                    elementName: element.businessObject?.name || element.id,
                    elementId: element.id
                });
            });
        });

        if (!hasStartEvent) {
            results.push({
                level: 'error',
                ruleId: 'E001',
                message: tr(t, 'validation.noStartEvent', 'No start event found.')
            });
        }
        if (!hasEndEvent) {
            results.push({
                level: 'error',
                ruleId: 'E002',
                message: tr(t, 'validation.noEndEvent', 'No end event found.')
            });
        }
    } catch (e) {
        console.error('validateBpmnModel:', e);
    }

    return results;
}
