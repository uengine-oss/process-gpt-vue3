import type { PropertySchema } from '@/stores/taskCatalog';

export interface SchemaRequiredViolation {
    elementId: string;
    elementName: string;
    elementType: string;
    scope: 'process' | 'task';
    propertyKey: string;
    propertyLabel: string;
}

const TASK_LIKE_PATTERNS = [/Task$/, /SubProcess$/, /CallActivity$/];

function isTaskLikeType(type: string): boolean {
    if (!type) return false;
    return TASK_LIKE_PATTERNS.some((re) => re.test(type));
}

function toText(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return '';
}

function isMissingValue(value: unknown): boolean {
    if (value === undefined || value === null) return true;
    if (typeof value === 'string') return value.trim() === '';
    if (Array.isArray(value)) return value.length === 0;
    return false;
}

function parseUengineProps(bo: any): Record<string, any> {
    try {
        const values = bo?.extensionElements?.values;
        if (!Array.isArray(values)) return {};
        const uengine =
            values.find((v: any) => v?.$type === 'uengine:Properties' && v?.json) ||
            (values[0]?.json ? values[0] : null);
        if (!uengine?.json) return {};
        const parsed = JSON.parse(uengine.json);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

function collectForFields(
    fields: PropertySchema[],
    source: Record<string, any>,
    scope: 'process' | 'task',
    elementId: string,
    elementName: string,
    elementType: string,
    out: SchemaRequiredViolation[]
): void {
    fields.forEach((f) => {
        if (!f?.is_required) return;
        if (f.property_type === 'daterange') {
            const startKey = `${f.property_key}_start`;
            const endKey = `${f.property_key}_end`;
            if (isMissingValue(source[startKey]) || isMissingValue(source[endKey])) {
                out.push({
                    elementId,
                    elementName,
                    elementType,
                    scope,
                    propertyKey: f.property_key,
                    propertyLabel: f.property_label || f.property_key
                });
            }
            return;
        }
        if (isMissingValue(source[f.property_key])) {
            out.push({
                elementId,
                elementName,
                elementType,
                scope,
                propertyKey: f.property_key,
                propertyLabel: f.property_label || f.property_key
            });
        }
    });
}

export interface CollectViolationsParams {
    modeler: any;
    processDefinition?: { id?: string; name?: string; definition?: Record<string, any> } | null;
    processName?: string;
    schemasByAppliesTo: (
        target: 'process' | 'task',
        elementType?: string
    ) => PropertySchema[];
}

export function collectProcessRequiredViolations(
    params: CollectViolationsParams
): SchemaRequiredViolation[] {
    const { modeler, processDefinition, processName, schemasByAppliesTo } = params;
    const violations: SchemaRequiredViolation[] = [];
    if (!modeler || typeof schemasByAppliesTo !== 'function') return violations;

    const processFields = schemasByAppliesTo('process') || [];
    const definitionObject = processDefinition?.definition;
    const processSource: Record<string, any> =
        definitionObject && typeof definitionObject === 'object'
            ? { ...definitionObject }
            : {};
    const processId = toText(processDefinition?.id) || 'process';
    const processLabel = toText(processName) || toText(processDefinition?.name) || processId;
    collectForFields(
        processFields,
        processSource,
        'process',
        processId,
        processLabel,
        'process',
        violations
    );

    let elementRegistry: any = null;
    try {
        elementRegistry = modeler.get('elementRegistry');
    } catch {
        elementRegistry = null;
    }
    if (!elementRegistry) return violations;

    const allElements = elementRegistry.getAll?.() ?? [];
    const seen = new Set<string>();
    allElements.forEach((el: any) => {
        if (!el?.id || seen.has(el.id)) return;
        if (el.type === 'label' || el.labelTarget) return;
        const type: string = toText(el.type || el.$type);
        if (!isTaskLikeType(type)) return;
        seen.add(el.id);
        const bo = el.businessObject || {};
        const taskSource = parseUengineProps(bo);
        const taskFields = schemasByAppliesTo('task', type) || [];
        const elementName = toText(bo.name).trim() || toText(el.id);
        collectForFields(
            taskFields,
            taskSource,
            'task',
            toText(el.id),
            elementName,
            type,
            violations
        );
    });

    return violations;
}

export function formatViolationMessage(violation: SchemaRequiredViolation): string {
    const scopeLabel = violation.scope === 'process' ? '프로세스' : violation.elementName;
    return `[${scopeLabel}] ${violation.propertyLabel} 항목은 필수 입력입니다.`;
}

export interface MandatoryRuleEntry {
    elementId: string;
    elementName: string;
    elementType: string;
    taskCode: string;
    /** mandatory_rule 원문을 줄 단위로 나눈 목록 (빈 줄 제외) */
    rules: string[];
    /** Rule 준수 여부를 바로 확인할 수 있게 함께 보여줄 태스크 속성값 */
    props: {
        input: string[];
        output: string[];
        procedure: string[];
        raci: Record<string, string[]> | null;
    };
}

function toStringArray(value: unknown): string[] {
    if (Array.isArray(value)) return value.map((v) => toText(v)).filter((v) => v.trim() !== '');
    const text = toText(value).trim();
    return text ? [text] : [];
}

/**
 * 검증 다이얼로그의 필수 Rule 체크리스트 수집.
 * uengine json 에 mandatory_rule 값이 있는 태스크 계열 요소만 대상이며,
 * 검증(에러 탐지)과 별개로 사람이 Rule 준수를 확인하는 용도라 위반을 만들지 않는다.
 */
export function collectMandatoryRuleChecklist(modeler: any): MandatoryRuleEntry[] {
    const entries: MandatoryRuleEntry[] = [];
    let elementRegistry: any = null;
    try {
        elementRegistry = modeler?.get('elementRegistry');
    } catch {
        elementRegistry = null;
    }
    if (!elementRegistry) return entries;

    const seen = new Set<string>();
    (elementRegistry.getAll?.() ?? []).forEach((el: any) => {
        if (!el?.id || seen.has(el.id)) return;
        if (el.type === 'label' || el.labelTarget) return;
        const type = toText(el.type || el.$type);
        if (!isTaskLikeType(type)) return;
        seen.add(el.id);

        const bo = el.businessObject || {};
        const props = parseUengineProps(bo);
        const rules = toText(props.mandatory_rule)
            .split('\n')
            .map((r) => r.trim())
            .filter(Boolean);
        if (rules.length === 0) return;

        const raci =
            props.raci && typeof props.raci === 'object' && !Array.isArray(props.raci)
                ? (props.raci as Record<string, string[]>)
                : null;
        entries.push({
            elementId: toText(el.id),
            elementName: toText(bo.name).trim() || toText(el.id),
            elementType: type,
            taskCode: toText(props.taskCode),
            rules,
            props: {
                input: toStringArray(props.input),
                output: toStringArray(props.output),
                procedure: toStringArray(props.procedure),
                raci
            }
        });
    });
    return entries;
}
