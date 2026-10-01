/**
 * Task Catalog 항목을 순서도 요소에 적용하는 공용 로직.
 * 변경(replace) 메뉴와 속성패널의 "카탈로그 적용"이 같은 경로를 쓴다 — 두 진입점의
 * 결과(요소 타입 전환 + 이름 + uengine:Properties 병합)가 항상 일치해야 한다.
 */

/** 카탈로그 등록 시 스냅샷에서 제외하는 요소 고유 상태 키 */
export const CATALOG_SNAPSHOT_EXCLUDED_KEYS = ['comments', '_catalogId'];

export function readUenginePropsJson(businessObject) {
    const propsEl = businessObject?.extensionElements?.values?.find((v) => v.$type === 'uengine:Properties');
    if (!propsEl?.json) return {};
    try {
        const parsed = JSON.parse(propsEl.json);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (e) {
        return {};
    }
}

export function normalizeCatalogTaskType(taskType) {
    const value = String(taskType || '').trim() || 'bpmn:UserTask';
    return value.startsWith('bpmn:') ? value : `bpmn:${value}`;
}

/**
 * 요소에 카탈로그 항목의 이름·속성을 적용하고 필요 시 타입을 전환한다.
 * 기존 uengine 속성은 유지하되 카탈로그 값이 같은 키를 덮어쓴다.
 *
 * 순서가 중요하다 — 이름·속성을 먼저 적용한 뒤 타입을 전환한다:
 * bpmn-js 의 replaceElement 가 name/extensionElements 를 새 요소로 자체 복사하므로,
 * 전환 커맨드의 후처리 훅에서 예외가 나도 적용 값이 유실되지 않는다
 * (전환 후 rename 방식은 훅 예외 시 이름이 안 바뀌는 문제가 있었다).
 * @returns 적용된(타입 전환 시 새로 생성된) 요소
 */
export function applyCatalogItemToElement(modeler, element, item) {
    if (!modeler || !element || !item) return element;

    const modeling = modeler.get('modeling');
    const bpmnFactory = modeler.get('bpmnFactory');
    const bpmnReplace = modeler.get('bpmnReplace');
    const elementRegistry = modeler.get('elementRegistry');

    // 속성패널 등에서 Vue 반응형 프록시로 감싼 요소가 넘어올 수 있다 — 그대로 모델링에
    // 넘기면 diagram-js 의 읽기 전용 속성(outgoing 등)에서 프록시 불변식 위반이 나므로
    // 레지스트리의 원본 요소로 재해석한다 (패널 saveTask 와 같은 패턴).
    const elementId = element?.id || element?.businessObject?.id;
    let target = (elementId && elementRegistry?.get?.(elementId)) || element;

    const bo = target.businessObject;
    const existingProps = readUenginePropsJson(bo);
    const catalogProps = item.properties && typeof item.properties === 'object' ? item.properties : {};
    const merged = {
        ...existingProps,
        ...catalogProps,
        _catalogId: item.id || existingProps._catalogId || '',
        _systemName: item.system_name || catalogProps._systemName || ''
    };

    const propsEl = bo.extensionElements?.values?.find((v) => v.$type === 'uengine:Properties');
    const otherValues = bo.extensionElements?.values?.filter((v) => v.$type !== 'uengine:Properties') || [];
    const uengineEl = bpmnFactory.create('uengine:Properties', {
        json: JSON.stringify(merged),
        variables: propsEl?.variables || []
    });
    const extensionElements = bpmnFactory.create('bpmn:ExtensionElements', {
        values: [...otherValues, uengineEl]
    });

    modeling.updateProperties(target, {
        name: item.name || item.display_name || bo.name,
        extensionElements
    });

    const taskType = normalizeCatalogTaskType(item.task_type);
    const currentType = target.type || target.businessObject?.$type;
    if (currentType !== taskType) {
        target = bpmnReplace.replaceElement(target, { type: taskType });
    }

    // 적용 완료 통지 — 속성패널이 구독해 열린 상태에서도 즉시 갱신한다.
    // (selection 재선택은 같은 요소일 때 prop 변화가 없어 패널 watcher 가 뜨지 않는다)
    try {
        modeler.get('eventBus')?.fire('taskCatalog.applied', { element: target });
    } catch (e) {
        /* eventBus 미제공(테스트 스텁 등) 무시 */
    }

    return target;
}

/**
 * 순서도 요소를 카탈로그 등록용 항목으로 스냅샷한다.
 * 요소 고유 상태(코멘트·카탈로그 참조)는 제외하고 나머지 속성 전체를 보존한다.
 */
export function snapshotElementForCatalog(element) {
    const bo = element?.businessObject || element;
    if (!bo) return null;
    const uengineProps = readUenginePropsJson(bo);
    const properties = { ...uengineProps };
    for (const key of CATALOG_SNAPSHOT_EXCLUDED_KEYS) {
        delete properties[key];
    }
    return {
        name: bo.name || '',
        task_type: element?.type || bo.$type || 'bpmn:UserTask',
        description: typeof properties.description === 'string' ? properties.description : '',
        properties
    };
}
