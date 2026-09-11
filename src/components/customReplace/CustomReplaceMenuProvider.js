/**
 * Custom Replace Menu Provider
 * 변경(replace) 메뉴를 관리자 'Task/Event 종류 설정'과 동기화한다.
 * 설정은 taskCatalog 스토어가 발행하는 window 전역에서 읽는다
 * (publishPaletteSettingsToWindow — 관리자에서 토글하면 열린 디자이너에도 반영).
 */
import { AVAILABLE_EVENT_TYPES } from '@/stores/taskCatalog';

export default function CustomReplaceMenuProvider(popupMenu, bpmnReplace, rules) {
    this._popupMenu = popupMenu;
    this._bpmnReplace = bpmnReplace;
    this._rules = rules;

    // Register as a provider for bpmn-replace menu
    popupMenu.registerProvider('bpmn-replace', this);
}

CustomReplaceMenuProvider.$inject = ['popupMenu', 'bpmnReplace', 'rules'];

/**
 * Task type mapping for replace menu entries
 * Keys are from bpmn-js ReplaceOptions
 * (bpmn:AdHocSubProcess 는 이 bpmn-js 버전에 replace 엔트리가 없어 제외)
 */
const TASK_TYPE_MAP = {
    'replace-with-task': 'bpmn:Task',
    'replace-with-manual-task': 'bpmn:ManualTask',
    'replace-with-service-task': 'bpmn:ServiceTask',
    'replace-with-user-task': 'bpmn:UserTask',
    'replace-with-script-task': 'bpmn:ScriptTask',
    'replace-with-rule-task': 'bpmn:BusinessRuleTask', // bpmn-js uses 'rule-task' not 'business-rule-task'
    'replace-with-send-task': 'bpmn:SendTask',
    'replace-with-receive-task': 'bpmn:ReceiveTask',
    'replace-with-call-activity': 'bpmn:CallActivity',
    'replace-with-subprocess': 'bpmn:SubProcess',
    'replace-with-collapsed-subprocess': 'bpmn:SubProcess',
    'replace-with-expanded-subprocess': 'bpmn:SubProcess',
    'replace-with-transaction': 'bpmn:Transaction'
};

/**
 * 이벤트 replace 엔트리 id → 관리자 설정 키.
 * AVAILABLE_EVENT_TYPES 의 value 가 곧 엔트리 id 이며, replaceKeys 는 별칭
 * (예: replace-with-none-intermediate-throwing → replace-with-none-intermediate-throw)
 */
const EVENT_KEY_MAP = (() => {
    const map = {};
    for (const eventType of AVAILABLE_EVENT_TYPES) {
        for (const key of eventType.replaceKeys || [eventType.value]) {
            map[key] = eventType.value;
        }
    }
    return map;
})();

/**
 * 노출할 Task 타입 목록. 설정이 아직 없으면 null(필터하지 않음).
 */
CustomReplaceMenuProvider.prototype._getVisibleTaskTypes = function () {
    if (Array.isArray(window.$visibleTaskTypes)) {
        return window.$visibleTaskTypes;
    }
    const enabledTypes = window.$enabledPaletteTaskTypes;
    if (Array.isArray(enabledTypes) && enabledTypes.length > 0) {
        return enabledTypes.map((t) => t.task_type);
    }
    const legacy = window.$paletteSettings?.visibleTaskTypes;
    return Array.isArray(legacy) && legacy.length > 0 ? legacy : null;
};

/**
 * 노출할 Event 타입 목록. 설정이 아직 없으면 null(필터하지 않음).
 */
CustomReplaceMenuProvider.prototype._getVisibleEventTypes = function () {
    if (Array.isArray(window.$visibleEventTypes)) {
        return window.$visibleEventTypes;
    }
    const legacy = window.$paletteSettings?.visibleEventTypes;
    return Array.isArray(legacy) ? legacy : null;
};

/**
 * Filter popup menu entries based on enabled task/event types
 */
CustomReplaceMenuProvider.prototype.getPopupMenuEntries = function () {
    return (entries) => {
        const visibleTaskTypes = this._getVisibleTaskTypes();
        const visibleEventTypes = this._getVisibleEventTypes();
        const filteredEntries = {};

        Object.keys(entries).forEach((key) => {
            const taskType = TASK_TYPE_MAP[key];
            if (taskType) {
                if (!visibleTaskTypes || visibleTaskTypes.includes(taskType)) {
                    filteredEntries[key] = entries[key];
                }
                return;
            }

            const eventKey = EVENT_KEY_MAP[key];
            if (eventKey) {
                if (!visibleEventTypes || visibleEventTypes.includes(eventKey)) {
                    filteredEntries[key] = entries[key];
                }
                return;
            }

            // 카탈로그가 관리하지 않는 엔트리(게이트웨이 등)는 그대로 둔다
            filteredEntries[key] = entries[key];
        });

        return filteredEntries;
    };
};
