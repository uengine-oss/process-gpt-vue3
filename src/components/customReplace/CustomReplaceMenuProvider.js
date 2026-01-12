/**
 * Custom Replace Menu Provider
 * Filters task types based on enabled palette task types
 */
export default function CustomReplaceMenuProvider(popupMenu, bpmnReplace, rules) {
    this._popupMenu = popupMenu;
    this._bpmnReplace = bpmnReplace;
    this._rules = rules;

    // Register as a provider for bpmn-replace menu
    popupMenu.registerProvider('bpmn-replace', this);
}

CustomReplaceMenuProvider.$inject = [
    'popupMenu',
    'bpmnReplace',
    'rules'
];

/**
 * Get enabled task types from window global
 */
CustomReplaceMenuProvider.prototype._getEnabledTaskTypes = function() {
    const enabledTypes = window.$enabledPaletteTaskTypes || [];
    if (enabledTypes.length > 0) {
        return enabledTypes.map(t => t.task_type);
    }
    // Fallback to legacy palette settings
    const paletteSettings = window.$paletteSettings || { visibleTaskTypes: ['bpmn:ManualTask', 'bpmn:ServiceTask'] };
    return paletteSettings.visibleTaskTypes || ['bpmn:ManualTask', 'bpmn:ServiceTask'];
};

/**
 * Task type mapping for replace menu entries
 * Keys are from bpmn-js ReplaceMenuProvider
 */
const TASK_TYPE_MAP = {
    'replace-with-task': 'bpmn:Task',
    'replace-with-manual-task': 'bpmn:ManualTask',
    'replace-with-service-task': 'bpmn:ServiceTask',
    'replace-with-user-task': 'bpmn:UserTask',
    'replace-with-script-task': 'bpmn:ScriptTask',
    'replace-with-rule-task': 'bpmn:BusinessRuleTask',  // bpmn-js uses 'rule-task' not 'business-rule-task'
    'replace-with-send-task': 'bpmn:SendTask',
    'replace-with-receive-task': 'bpmn:ReceiveTask',
    'replace-with-call-activity': 'bpmn:CallActivity',
    'replace-with-collapsed-subprocess': 'bpmn:SubProcess',
    'replace-with-expanded-subprocess': 'bpmn:SubProcess'
};

/**
 * Filter popup menu entries based on enabled task types
 */
CustomReplaceMenuProvider.prototype.getPopupMenuEntries = function(element) {
    return (entries) => {
        const enabledTaskTypes = this._getEnabledTaskTypes();
        const filteredEntries = {};

        Object.keys(entries).forEach(key => {
            const taskType = TASK_TYPE_MAP[key];

            // If it's a task type entry, check if it's enabled
            if (taskType) {
                if (enabledTaskTypes.includes(taskType)) {
                    filteredEntries[key] = entries[key];
                }
            } else {
                // Not a task type entry, keep it
                filteredEntries[key] = entries[key];
            }
        });

        return filteredEntries;
    };
};
