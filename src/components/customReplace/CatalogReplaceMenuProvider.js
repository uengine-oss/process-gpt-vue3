/**
 * Catalog Replace Menu Provider
 * 변경(replace) 메뉴 하단에 Task Catalog 항목을 추가한다 — 별도 메뉴 없이
 * 기존 "요소 변경" 흐름에서 등록된 Task 를 선택해 타입·이름·속성을 한 번에 적용한다.
 * 카탈로그 목록은 taskCatalog 스토어에서 읽는다 (디자이너 진입 시 PAL 모드에서 로드).
 */
import { useTaskCatalogStore } from '@/stores/taskCatalog';
import { applyCatalogItemToElement, normalizeCatalogTaskType } from '@/components/designer/taskCatalogApply';

/** 카탈로그 적용을 지원하는 요소(Activity 계열)인지 판정 */
const APPLICABLE_TYPES = new Set([
    'bpmn:Task',
    'bpmn:ManualTask',
    'bpmn:ServiceTask',
    'bpmn:UserTask',
    'bpmn:ScriptTask',
    'bpmn:BusinessRuleTask',
    'bpmn:SendTask',
    'bpmn:ReceiveTask',
    'bpmn:CallActivity',
    'bpmn:SubProcess',
    'bpmn:AdHocSubProcess',
    'bpmn:Transaction'
]);

const TYPE_ICON_CLASS = {
    'bpmn:Task': 'bpmn-icon-task',
    'bpmn:ManualTask': 'bpmn-icon-manual-task',
    'bpmn:ServiceTask': 'bpmn-icon-service-task',
    'bpmn:UserTask': 'bpmn-icon-user-task',
    'bpmn:ScriptTask': 'bpmn-icon-script-task',
    'bpmn:BusinessRuleTask': 'bpmn-icon-business-rule-task',
    'bpmn:SendTask': 'bpmn-icon-send-task',
    'bpmn:ReceiveTask': 'bpmn-icon-receive-task',
    'bpmn:CallActivity': 'bpmn-icon-call-activity',
    'bpmn:SubProcess': 'bpmn-icon-subprocess-expanded',
    'bpmn:AdHocSubProcess': 'bpmn-icon-subprocess-expanded',
    'bpmn:Transaction': 'bpmn-icon-transaction'
};

export default function CatalogReplaceMenuProvider(popupMenu, injector) {
    this._popupMenu = popupMenu;
    this._injector = injector;

    // 낮은 priority 로 등록해 기본 replace 엔트리 뒤(그룹 하단)에 붙인다
    popupMenu.registerProvider('bpmn-replace', 900, this);
}

CatalogReplaceMenuProvider.$inject = ['popupMenu', 'injector'];

CatalogReplaceMenuProvider.prototype._getCatalogItems = function () {
    try {
        const store = useTaskCatalogStore();
        return Array.isArray(store.catalogItems) ? store.catalogItems : [];
    } catch (e) {
        // pinia 미초기화(테스트 등) 시 카탈로그 엔트리 없이 동작
        return [];
    }
};

CatalogReplaceMenuProvider.prototype.getPopupMenuEntries = function (element) {
    return (entries) => {
        const elementType = element?.type || element?.businessObject?.$type;
        if (!APPLICABLE_TYPES.has(elementType)) return entries;

        const items = this._getCatalogItems();
        if (!items.length) return entries;

        const injector = this._injector;
        const result = { ...entries };
        for (const item of items) {
            if (!item || !item.id) continue;
            const taskType = normalizeCatalogTaskType(item.task_type);
            result[`replace-with-catalog-${item.id}`] = {
                label: item.display_name || item.name || item.id,
                description: item.system_name || item.description || undefined,
                className: TYPE_ICON_CLASS[taskType] || 'bpmn-icon-task',
                group: { id: 'task-catalog', name: 'Task Catalog' },
                action: () => {
                    // modeler 서비스는 실행 시점에 조회 — 순환 주입을 피한다
                    const modeler = {
                        get: (name) => injector.get(name)
                    };
                    const applied = applyCatalogItemToElement(modeler, element, item);
                    // 타입이 그대로면 selection 이벤트가 없어 속성패널이 갱신되지 않는다 — 재선택 강제
                    try {
                        const selection = injector.get('selection', false);
                        if (selection && applied) {
                            selection.select(null);
                            selection.select(applied);
                        }
                    } catch (e) {
                        /* selection 미지원 환경 무시 */
                    }
                }
            };
        }
        return result;
    };
};
