import { defineStore } from 'pinia';

export interface ColorRule {
    id: string;
    name: string;
    type: 'taskType' | 'leadTime';
    priority: number;
    enabled: boolean;
    taskTypes?: string[];
    minDuration?: number;
    maxDuration?: number;
    fillColor: string;
    strokeColor?: string;
}

export interface ColorRuleSettings {
    rules: ColorRule[];
    defaultColor: string;
}

// Available BPMN task types
export const TASK_TYPES = [
    { value: 'bpmn:Task', label: 'Task' },
    { value: 'bpmn:UserTask', label: 'User Task' },
    { value: 'bpmn:ManualTask', label: 'Manual Task' },
    { value: 'bpmn:ServiceTask', label: 'Service Task' },
    { value: 'bpmn:ScriptTask', label: 'Script Task' },
    { value: 'bpmn:BusinessRuleTask', label: 'Business Rule Task' },
    { value: 'bpmn:SendTask', label: 'Send Task' },
    { value: 'bpmn:ReceiveTask', label: 'Receive Task' }
];

const STORAGE_KEY = 'bpmn_color_rules';

export const useColorRulesStore = defineStore({
    id: 'colorRules',
    state: () => ({
        rules: [] as ColorRule[],
        defaultColor: '#fdf2d0',
        isLoaded: false
    }),
    actions: {
        async loadRules() {
            try {
                const savedSettings = localStorage.getItem(STORAGE_KEY);
                if (savedSettings) {
                    const settings: ColorRuleSettings = JSON.parse(savedSettings);
                    this.rules = settings.rules || [];
                    this.defaultColor = settings.defaultColor || '#fdf2d0';
                }
                this.isLoaded = true;
            } catch (error) {
                console.error('Failed to load color rules:', error);
                this.isLoaded = true;
            }
        },
        async saveRules() {
            try {
                const settings: ColorRuleSettings = {
                    rules: this.rules,
                    defaultColor: this.defaultColor
                };
                localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
            } catch (error) {
                console.error('Failed to save color rules:', error);
            }
        },
        addRule(rule: Omit<ColorRule, 'id' | 'priority'>) {
            const newRule: ColorRule = {
                ...rule,
                id: `rule_${Date.now()}`,
                priority: this.rules.length
            };
            this.rules.push(newRule);
            this.saveRules();
        },
        updateRule(rule: ColorRule) {
            const index = this.rules.findIndex(r => r.id === rule.id);
            if (index !== -1) {
                this.rules[index] = rule;
                this.saveRules();
            }
        },
        deleteRule(id: string) {
            this.rules = this.rules.filter(r => r.id !== id);
            // Re-assign priorities
            this.rules.forEach((r, i) => r.priority = i);
            this.saveRules();
        },
        reorderRules(newOrder: ColorRule[]) {
            this.rules = newOrder.map((r, i) => ({ ...r, priority: i }));
            this.saveRules();
        },
        setDefaultColor(color: string) {
            this.defaultColor = color;
            this.saveRules();
        }
    },
    getters: {
        sortedRules: (state) => {
            return [...state.rules].sort((a, b) => a.priority - b.priority);
        },
        getColorForElement: (state) => (element: any): { fillColor: string; strokeColor?: string } | null => {
            // Get element type
            const elementType = element.businessObject?.$type;
            if (!elementType) return null;

            // Get duration from extension elements
            let duration: number | null = null;
            const extensionElements = element.businessObject?.extensionElements;
            if (extensionElements?.values) {
                const uengineProps = extensionElements.values.find((v: any) => v.$type === 'uengine:Properties');
                if (uengineProps?.json) {
                    try {
                        const parsed = JSON.parse(uengineProps.json);
                        if (parsed.duration !== undefined) {
                            duration = Number(parsed.duration);
                        }
                    } catch (e) {
                        // Ignore parse errors
                    }
                }
            }

            // Sort rules by priority
            const sortedRules = [...state.rules]
                .filter(r => r.enabled)
                .sort((a, b) => a.priority - b.priority);

            // Check lead time rules first (higher priority when priority number is same)
            for (const rule of sortedRules.filter(r => r.type === 'leadTime')) {
                if (duration !== null) {
                    const min = rule.minDuration ?? 0;
                    const max = rule.maxDuration ?? Infinity;
                    if (duration >= min && duration < max) {
                        return { fillColor: rule.fillColor, strokeColor: rule.strokeColor };
                    }
                }
            }

            // Then check task type rules
            for (const rule of sortedRules.filter(r => r.type === 'taskType')) {
                if (rule.taskTypes?.includes(elementType)) {
                    return { fillColor: rule.fillColor, strokeColor: rule.strokeColor };
                }
            }

            return null;
        }
    }
});
