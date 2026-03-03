import { defineStore } from 'pinia';
import BackendFactory from '@/components/api/BackendFactory';

// Interfaces
export interface TaskSystem {
    id: string;
    name: string;
    description?: string;
}

export interface TaskCatalogItem {
    id: string;
    name: string;
    system_id?: string;
    system_name: string;
    display_name: string;
    task_type: string;
    properties: Record<string, any>;
    description?: string;
    level?: string;
}

export interface PropertySchema {
    id: string;
    task_type: string;
    property_key: string;
    property_label: string;
    property_type: 'string' | 'number' | 'boolean' | 'select' | 'textarea' | 'url' | 'db-select' | 'formula';
    is_mandatory: boolean;
    default_value?: string;
    options?: { label: string; value: any }[];
    display_order: number;
    applies_to?: 'both' | 'process' | 'task';
    placeholder?: string;
    visible_by_default?: boolean;
    config?: Record<string, any>;
    // Layout properties
    row_index?: number;      // Row position (0-based, properties with same row_index appear on same row)
    col_span?: number;       // Column span (1-12, Vuetify grid system)
    section_name?: string;   // Section header name (properties with same section are grouped)
}

export interface PaletteSettings {
    visibleTaskTypes: string[];
}

export interface PaletteTaskType {
    id: string;
    task_type: string;
    label: string;
    label_ko?: string;
    icon?: string;
    is_enabled: boolean;
    display_order: number;
}

// Available BPMN task types for palette settings
export const AVAILABLE_TASK_TYPES = [
    { value: 'bpmn:ManualTask', label: 'Manual Task', labelKo: '수동 작업' },
    { value: 'bpmn:ServiceTask', label: 'Service Task', labelKo: '서비스 작업' },
    { value: 'bpmn:UserTask', label: 'User Task', labelKo: '사용자 작업' },
    { value: 'bpmn:ScriptTask', label: 'Script Task', labelKo: '스크립트 작업' },
    { value: 'bpmn:BusinessRuleTask', label: 'Business Rule Task', labelKo: '비즈니스 규칙 작업' },
    { value: 'bpmn:SendTask', label: 'Send Task', labelKo: '전송 작업' },
    { value: 'bpmn:ReceiveTask', label: 'Receive Task', labelKo: '수신 작업' }
];

// Property types for schema
export const PROPERTY_TYPES = [
    { value: 'string', label: 'Text' },
    { value: 'textarea', label: 'Text Area' },
    { value: 'number', label: 'Number' },
    { value: 'boolean', label: 'Boolean' },
    { value: 'select', label: 'Select' },
    { value: 'url', label: 'URL' },
    { value: 'db-select', label: 'DB-Select' },
    { value: 'formula', label: 'Formula' }
];

export const APPLIES_TO_OPTIONS = [
    { value: 'both', label: 'Process + Task', labelKo: '프로세스 + Task' },
    { value: 'process', label: 'Process Only', labelKo: '프로세스만' },
    { value: 'task', label: 'All Tasks', labelKo: '모든 Task' },
    ...AVAILABLE_TASK_TYPES.map(t => ({ value: t.value, label: t.label, labelKo: t.labelKo })),
];

// Built-in property keys that exist by default in ProcessHierarchyProperties
// These should be hidden from the schema manager to avoid duplication
export const BUILT_IN_PROPERTY_KEYS = ['title', 'name'];

export const useTaskCatalogStore = defineStore({
    id: 'taskCatalog',
    state: () => ({
        // Task Systems (OSS)
        systems: [] as TaskSystem[],
        systemsLoaded: false,

        // Task Catalog
        catalogItems: [] as TaskCatalogItem[],
        catalogLoaded: false,

        // Property Schemas
        propertySchemas: [] as PropertySchema[],
        schemasLoaded: false,

        // Palette Settings (legacy)
        paletteSettings: {
            visibleTaskTypes: ['bpmn:ManualTask', 'bpmn:ServiceTask']
        } as PaletteSettings,
        paletteSettingsLoaded: false,

        // Palette Task Types (new table-based)
        paletteTaskTypes: [] as PaletteTaskType[],
        paletteTaskTypesLoaded: false,

        // Loading states
        loading: false,
        error: null as string | null
    }),

    actions: {
        // ============================================
        // Task Systems (OSS)
        // ============================================
        async loadSystems() {
            if (this.systemsLoaded) return;
            this.loading = true;
            this.error = null;
            try {
                const backend = BackendFactory.createBackend();
                this.systems = await backend.getTaskSystems();
                this.systemsLoaded = true;
            } catch (error: any) {
                console.error('Failed to load task systems:', error);
                this.error = error.message;
            } finally {
                this.loading = false;
            }
        },

        async saveSystem(system: Partial<TaskSystem>) {
            this.loading = true;
            this.error = null;
            try {
                const backend = BackendFactory.createBackend();
                const saved = await backend.saveTaskSystem(system);
                const index = this.systems.findIndex(s => s.id === saved.id);
                if (index !== -1) {
                    this.systems[index] = saved;
                } else {
                    this.systems.push(saved);
                }
                return saved;
            } catch (error: any) {
                console.error('Failed to save task system:', error);
                this.error = error.message;
                throw error;
            } finally {
                this.loading = false;
            }
        },

        async deleteSystem(id: string) {
            this.loading = true;
            this.error = null;
            try {
                const backend = BackendFactory.createBackend();
                await backend.deleteTaskSystem(id);
                this.systems = this.systems.filter(s => s.id !== id);
            } catch (error: any) {
                console.error('Failed to delete task system:', error);
                this.error = error.message;
                throw error;
            } finally {
                this.loading = false;
            }
        },

        // ============================================
        // Task Catalog
        // ============================================
        async loadCatalog(options?: { taskType?: string; systemName?: string; search?: string }) {
            this.loading = true;
            this.error = null;
            try {
                const backend = BackendFactory.createBackend();
                this.catalogItems = await backend.getTaskCatalogList(options);
                this.catalogLoaded = true;
            } catch (error: any) {
                console.error('Failed to load task catalog:', error);
                this.error = error.message;
            } finally {
                this.loading = false;
            }
        },

        async saveCatalogItem(item: Partial<TaskCatalogItem>) {
            this.loading = true;
            this.error = null;
            try {
                const backend = BackendFactory.createBackend();
                const saved = await backend.saveTaskCatalog(item);
                const index = this.catalogItems.findIndex(c => c.id === saved.id);
                if (index !== -1) {
                    this.catalogItems[index] = saved;
                } else {
                    this.catalogItems.push(saved);
                }
                return saved;
            } catch (error: any) {
                console.error('Failed to save catalog item:', error);
                this.error = error.message;
                throw error;
            } finally {
                this.loading = false;
            }
        },

        async deleteCatalogItem(id: string) {
            this.loading = true;
            this.error = null;
            try {
                const backend = BackendFactory.createBackend();
                await backend.deleteTaskCatalog(id);
                this.catalogItems = this.catalogItems.filter(c => c.id !== id);
            } catch (error: any) {
                console.error('Failed to delete catalog item:', error);
                this.error = error.message;
                throw error;
            } finally {
                this.loading = false;
            }
        },

        // ============================================
        // Property Schemas
        // ============================================
        async loadSchemas(taskType?: string) {
            this.loading = true;
            this.error = null;
            try {
                const backend = BackendFactory.createBackend();
                this.propertySchemas = await backend.getPropertySchemas(taskType);
                this.schemasLoaded = true;
            } catch (error: any) {
                console.error('Failed to load property schemas:', error);
                this.error = error.message;
            } finally {
                this.loading = false;
            }
        },

        async saveSchema(schema: Partial<PropertySchema>) {
            this.loading = true;
            this.error = null;
            try {
                const backend = BackendFactory.createBackend();
                const saved = await backend.savePropertySchema(schema);
                const index = this.propertySchemas.findIndex(s => s.id === saved.id);
                if (index !== -1) {
                    this.propertySchemas[index] = saved;
                } else {
                    this.propertySchemas.push(saved);
                }
                return saved;
            } catch (error: any) {
                console.error('Failed to save property schema:', error);
                this.error = error.message;
                throw error;
            } finally {
                this.loading = false;
            }
        },

        async deleteSchema(id: string) {
            this.loading = true;
            this.error = null;
            try {
                const backend = BackendFactory.createBackend();
                await backend.deletePropertySchema(id);
                this.propertySchemas = this.propertySchemas.filter(s => s.id !== id);
            } catch (error: any) {
                console.error('Failed to delete property schema:', error);
                this.error = error.message;
                throw error;
            } finally {
                this.loading = false;
            }
        },

        // ============================================
        // Palette Settings
        // ============================================
        async loadPaletteSettings() {
            if (this.paletteSettingsLoaded) return;
            this.loading = true;
            this.error = null;
            try {
                const backend = BackendFactory.createBackend();
                this.paletteSettings = await backend.getPaletteSettings();
                this.paletteSettingsLoaded = true;
            } catch (error: any) {
                console.error('Failed to load palette settings:', error);
                this.error = error.message;
            } finally {
                this.loading = false;
            }
        },

        async savePaletteSettings(settings: PaletteSettings) {
            this.loading = true;
            this.error = null;
            try {
                const backend = BackendFactory.createBackend();
                await backend.savePaletteSettings(settings);
                this.paletteSettings = settings;
            } catch (error: any) {
                console.error('Failed to save palette settings:', error);
                this.error = error.message;
                throw error;
            } finally {
                this.loading = false;
            }
        },

        toggleTaskType(taskType: string) {
            const index = this.paletteSettings.visibleTaskTypes.indexOf(taskType);
            if (index !== -1) {
                this.paletteSettings.visibleTaskTypes.splice(index, 1);
            } else {
                this.paletteSettings.visibleTaskTypes.push(taskType);
            }
            this.savePaletteSettings(this.paletteSettings);
        },

        // ============================================
        // Palette Task Types (new table-based)
        // ============================================
        async loadPaletteTaskTypes() {
            if (this.paletteTaskTypesLoaded) return;
            this.loading = true;
            this.error = null;
            try {
                const backend = BackendFactory.createBackend();
                this.paletteTaskTypes = await backend.getPaletteTaskTypes();
                this.paletteTaskTypesLoaded = true;
            } catch (error: any) {
                console.error('Failed to load palette task types:', error);
                this.error = error.message;
            } finally {
                this.loading = false;
            }
        },

        async togglePaletteTaskType(id: string) {
            const taskType = this.paletteTaskTypes.find(t => t.id === id);
            if (!taskType) return;

            this.loading = true;
            this.error = null;
            try {
                const backend = BackendFactory.createBackend();
                const newEnabled = !taskType.is_enabled;
                await backend.updatePaletteTaskType(id, newEnabled);
                taskType.is_enabled = newEnabled;
            } catch (error: any) {
                console.error('Failed to toggle palette task type:', error);
                this.error = error.message;
                throw error;
            } finally {
                this.loading = false;
            }
        },

        // ============================================
        // Reset
        // ============================================
        reset() {
            this.systems = [];
            this.systemsLoaded = false;
            this.catalogItems = [];
            this.catalogLoaded = false;
            this.propertySchemas = [];
            this.schemasLoaded = false;
            this.paletteSettings = { visibleTaskTypes: ['bpmn:ManualTask', 'bpmn:ServiceTask'] };
            this.paletteSettingsLoaded = false;
            this.paletteTaskTypes = [];
            this.paletteTaskTypesLoaded = false;
            this.loading = false;
            this.error = null;
        }
    },

    getters: {
        // Get systems sorted by name
        sortedSystems: (state) => {
            return [...state.systems].sort((a, b) => a.name.localeCompare(b.name));
        },

        // Get catalog items by task type
        catalogByTaskType: (state) => (taskType: string) => {
            return state.catalogItems.filter(item => item.task_type === taskType);
        },

        // Get catalog items by system
        catalogBySystem: (state) => (systemName: string) => {
            return state.catalogItems.filter(item => item.system_name === systemName);
        },

        // Get schemas by task type
        schemasByTaskType: (state) => (taskType: string) => {
            return state.propertySchemas
                .filter(s => s.task_type === taskType)
                .sort((a, b) => a.display_order - b.display_order);
        },

        // Get mandatory schemas by task type
        mandatorySchemasByTaskType: (state) => (taskType: string) => {
            return state.propertySchemas
                .filter(s => s.task_type === taskType && s.is_mandatory)
                .sort((a, b) => a.display_order - b.display_order);
        },

        // Get schemas filtered by target ('process' or 'task')
        // For task: optionally pass elementType (e.g., 'bpmn:ManualTask') to include type-specific schemas
        schemasByAppliesTo: (state) => (target: 'process' | 'task', elementType?: string) => {
            return state.propertySchemas
                .filter(s => {
                    const at = s.applies_to || 'both';
                    if (target === 'process') {
                        return at === 'process' || at === 'both';
                    }
                    if (target === 'task') {
                        if (at === 'task' || at === 'both') return true;
                        // Specific BPMN type match
                        if (elementType && at === elementType) return true;
                        return false;
                    }
                    return false;
                })
                .filter(s => s.visible_by_default !== false)
                .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
        },

        // Check if task type is visible in palette
        isTaskTypeVisible: (state) => (taskType: string) => {
            return state.paletteSettings.visibleTaskTypes.includes(taskType);
        },

        // Get enabled palette task types (new table-based)
        enabledPaletteTaskTypes: (state) => {
            return state.paletteTaskTypes.filter(t => t.is_enabled);
        },

        // Check if task type is enabled (new table-based)
        isPaletteTaskTypeEnabled: (state) => (taskType: string) => {
            const type = state.paletteTaskTypes.find(t => t.task_type === taskType);
            return type ? type.is_enabled : false;
        },

        // Search catalog items
        searchCatalog: (state) => (query: string) => {
            const lowerQuery = query.toLowerCase();
            return state.catalogItems.filter(item =>
                item.display_name.toLowerCase().includes(lowerQuery) ||
                item.name.toLowerCase().includes(lowerQuery) ||
                item.system_name.toLowerCase().includes(lowerQuery) ||
                (item.description && item.description.toLowerCase().includes(lowerQuery))
            );
        }
    }
});
