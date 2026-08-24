type AnyRecord = Record<string, any>;

function isRecord(value: any): value is AnyRecord {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function toText(value: any): string {
    return value == null ? '' : String(value);
}

function parseJson(value: any): AnyRecord {
    if (!value || typeof value !== 'string') return {};
    try {
        const parsed = JSON.parse(value);
        return isRecord(parsed) ? parsed : {};
    } catch {
        return {};
    }
}

export function readConditionExpressionBody(conditionExpression: any): string {
    if (!conditionExpression) return '';
    return toText(
        conditionExpression.body ?? conditionExpression.$body ?? conditionExpression.text ?? conditionExpression.value ?? ''
    ).trim();
}

export function readUengineJsonProps(businessObject: AnyRecord | null | undefined): AnyRecord {
    const values = businessObject?.extensionElements?.values || [];
    const propsEl = values.find((item: any) => item?.$type === 'uengine:Properties' || typeof item?.json === 'string');
    return parseJson(propsEl?.json);
}

function stringifyConditionValue(value: any): string {
    if (value == null) return '';
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    const text = toText(value).trim();
    if (!text) return '';
    if (/^['"].*['"]$/.test(text)) return text;
    if (/^-?\d+(\.\d+)?$/.test(text)) return text;
    if (text === 'true' || text === 'false') return text;
    return JSON.stringify(text);
}

function legacyEvaluateToExpression(condition: AnyRecord): string {
    const left = toText(
        condition.key ?? condition.name ?? condition.pv?.name ?? condition.variable ?? condition.processVariable ?? ''
    ).trim();
    const operator = toText(condition.condition ?? condition.operator ?? '==').trim() || '==';
    const right = stringifyConditionValue(condition.val ?? condition.value ?? condition.expectedValue ?? '');
    if (!left || !right) return '';
    return `${left} ${operator} ${right}`;
}

function legacyConditionToExpression(condition: any): string {
    if (!condition) return '';
    if (typeof condition === 'string') return condition.trim();
    if (!isRecord(condition)) return '';

    const direct =
        readConditionExpressionBody(condition.conditionExpression) ||
        toText(condition.body ?? condition.expression ?? condition.conditionExpression ?? '').trim();
    if (direct) return direct;

    if (Array.isArray(condition.conditionsVt) && condition.conditionsVt.length) {
        const joiner = toText(condition._type).includes('And') ? ' && ' : ' || ';
        return condition.conditionsVt
            .map(legacyConditionToExpression)
            .filter(Boolean)
            .map((expr: string) => `(${expr})`)
            .join(joiner);
    }

    if (condition.condition && isRecord(condition.condition)) {
        return legacyConditionToExpression(condition.condition);
    }

    return legacyEvaluateToExpression(condition);
}

export function isLegacyDefaultSequenceFlow(element: any): boolean {
    const businessObject = element?.businessObject || element;
    const props = readUengineJsonProps(businessObject);
    const condition = props.condition;
    const type = toText(condition?._type || condition?.type || props.conditionType || '').toLowerCase();
    const name = toText(businessObject?.name || element?.name || '')
        .trim()
        .toLowerCase();
    return (
        type.includes('otherwise') ||
        props.defaultFlow === true ||
        props.isDefault === true ||
        props.otherwise === true ||
        name === 'otherwise' ||
        name === 'default'
    );
}

type SequenceFlowConditionOptions = {
    includeNameFallback?: boolean;
    emptyFallbackExpression?: string;
    fallbackOnlyWhenConditionRequired?: boolean;
};

export function getSequenceFlowConditionExpression(element: any, options: SequenceFlowConditionOptions = {}): string {
    const businessObject = element?.businessObject || element;
    const current = readConditionExpressionBody(businessObject?.conditionExpression);
    if (current) return current;

    const props = readUengineJsonProps(businessObject);
    const legacy = legacyConditionToExpression(props.condition || props.conditionExpression);
    if (legacy) return legacy;

    const canUseFallback = !options.fallbackOnlyWhenConditionRequired || shouldUseSequenceFlowConditionFallback(element);
    if (options.includeNameFallback && canUseFallback) {
        const name = toText(businessObject?.name || element?.name || '').trim();
        if (name && !/^(otherwise|default)$/i.test(name)) return name;
        const emptyFallback = toText(options.emptyFallbackExpression).trim();
        if (emptyFallback) return emptyFallback;
    }

    return '';
}

function isSequenceFlow(element: any): boolean {
    return element?.type === 'bpmn:SequenceFlow' || element?.businessObject?.$type === 'bpmn:SequenceFlow';
}

function isDefaultSequenceFlow(element: any): boolean {
    const businessObject = element?.businessObject || element;
    const sourceBusinessObject = element?.source?.businessObject || businessObject?.sourceRef;
    const defaultFlow = sourceBusinessObject?.default;
    return !!defaultFlow && (defaultFlow === businessObject || defaultFlow.id === businessObject?.id);
}

function canHaveDefaultFlow(sourceBusinessObject: any): boolean {
    const type = toText(sourceBusinessObject?.$type);
    return /Gateway|Activity|Task|SubProcess|CallActivity/.test(type);
}

function canUseConditionFallbackSource(sourceBusinessObject: any): boolean {
    const type = toText(sourceBusinessObject?.$type);
    if (/ParallelGateway|EventBasedGateway/.test(type)) return false;
    return /Gateway|Activity|Task|SubProcess|CallActivity/.test(type);
}

function getOutgoingCount(sourceElement: any, sourceBusinessObject: any): number {
    const elementOutgoing = sourceElement?.outgoing;
    if (Array.isArray(elementOutgoing)) return elementOutgoing.length;

    const businessOutgoing = sourceBusinessObject?.outgoing;
    if (Array.isArray(businessOutgoing)) return businessOutgoing.length;

    return 0;
}

export function shouldUseSequenceFlowConditionFallback(element: any): boolean {
    const businessObject = element?.businessObject || element;
    const sourceElement = element?.source;
    const sourceBusinessObject = sourceElement?.businessObject || businessObject?.sourceRef;

    if (!sourceBusinessObject || !canUseConditionFallbackSource(sourceBusinessObject)) return false;
    return getOutgoingCount(sourceElement, sourceBusinessObject) > 1;
}

export function materializeSequenceFlowConditionExpressions(modeler: any, options: SequenceFlowConditionOptions = {}): number {
    const elementRegistry = modeler?.get?.('elementRegistry');
    const bpmnFactory = modeler?.get?.('bpmnFactory');
    if (!elementRegistry || !bpmnFactory) return 0;

    const elements = typeof elementRegistry.getAll === 'function' ? elementRegistry.getAll() : [];
    let updated = 0;

    elements.filter(isSequenceFlow).forEach((element: any) => {
        const businessObject = element.businessObject;
        if (!businessObject) return;

        const sourceBusinessObject = element.source?.businessObject || businessObject.sourceRef;
        if (isLegacyDefaultSequenceFlow(element) && sourceBusinessObject && canHaveDefaultFlow(sourceBusinessObject)) {
            if (!isDefaultSequenceFlow(element)) {
                sourceBusinessObject.default = businessObject;
                updated++;
            }
            return;
        }

        if (isDefaultSequenceFlow(element) || readConditionExpressionBody(businessObject.conditionExpression)) return;

        const expression = getSequenceFlowConditionExpression(element, {
            ...options,
            fallbackOnlyWhenConditionRequired: true
        });
        if (!expression) return;

        businessObject.conditionExpression = bpmnFactory.create('bpmn:FormalExpression', { body: expression });
        updated++;
    });

    return updated;
}
