import { defineStore } from 'pinia';
import BackendFactory from '@/components/api/BackendFactory';
import { useAdminConsoleStore } from '@/stores/adminConsole';
import { BUILTIN_PANEL_PROPERTIES } from '@/components/designer/bpmnModeling/bpmn/panel/builtinPanelProperties';

// 관리 화면에서는 모두 사용자 정의 속성이지만, 렌더링 방식은 구분한다.
// renderer=panel인 행은 기존 패널의 전용 컴포넌트/바인딩을 그대로 사용하고
// 일반 스키마 필드 렌더러에는 넘기지 않는다. 나머지 조건은 이전 데이터 호환용이다.
const isPanelPropertySchema = (schema: Partial<PropertySchema>) => {
    const config = schema.config || {};
    return (
        config.renderer === 'panel' ||
        config.panelProperty === true ||
        config.builtin === true ||
        (typeof config.panel === 'string' && typeof config.widget === 'string')
    );
};

const panelPropertyScope = (schema: Partial<PropertySchema>) => schema.config?.panelTaskType || schema.task_type;

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
    property_type: 'string' | 'number' | 'boolean' | 'select' | 'multiselect' | 'textarea' | 'url' | 'db-select' | 'formula' | 'date' | 'daterange' | 'user';
    is_required: boolean;
    default_value?: string;
    options?: { label: string; value: any }[];
    display_order: number;
    applies_to?: 'both' | 'process' | 'task';
    placeholder?: string;
    visible_by_default?: boolean;
    is_active?: boolean;
    config?: Record<string, any>;
    deleted_at?: string | null;
    deleted_by?: string | null;
    number_min?: number | null;
    number_max?: number | null;
    number_use_comma?: boolean;
    number_unit?: string;
    select_source_type?: 'static' | 'api';
    select_api_endpoint?: string;
    select_api_label_field?: string;
    select_api_value_field?: string;
    row_index?: number;
    col_span?: number;
    section_name?: string;
}

export interface PaletteSettings {
    visibleTaskTypes: string[];
    visibleEventTypes: string[];
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
    { value: 'bpmn:Task', label: 'Task', labelKo: '일반 작업' },
    { value: 'bpmn:ManualTask', label: 'Manual Task', labelKo: '수동 작업' },
    { value: 'bpmn:ServiceTask', label: 'Service Task', labelKo: '서비스 작업' },
    { value: 'bpmn:UserTask', label: 'User Task', labelKo: '사용자 작업' },
    { value: 'bpmn:ScriptTask', label: 'Script Task', labelKo: '스크립트 작업' },
    { value: 'bpmn:BusinessRuleTask', label: 'Business Rule Task', labelKo: '비즈니스 규칙 작업' },
    { value: 'bpmn:SendTask', label: 'Send Task', labelKo: '전송 작업' },
    { value: 'bpmn:ReceiveTask', label: 'Receive Task', labelKo: '수신 작업' },
    { value: 'bpmn:CallActivity', label: 'Call Activity', labelKo: '호출 활동' },
    { value: 'bpmn:SubProcess', label: 'Sub Process', labelKo: '하위 프로세스' },
    { value: 'bpmn:AdHocSubProcess', label: 'Ad-Hoc Sub Process', labelKo: '비정형 하위 프로세스' },
    { value: 'bpmn:Transaction', label: 'Transaction', labelKo: '트랜잭션' }
];

export const DEFAULT_VISIBLE_TASK_TYPES = AVAILABLE_TASK_TYPES.map((taskType) => taskType.value);

export const AVAILABLE_EVENT_TYPES = [
    { value: 'replace-with-none-start', label: 'Start Event', labelKo: '시작 이벤트', group: 'Start', icon: 'mdi-play-circle-outline' },
    { value: 'replace-with-message-start', label: 'Message Start Event', labelKo: '메시지 시작 이벤트', group: 'Start', icon: 'mdi-message-outline' },
    { value: 'replace-with-timer-start', label: 'Timer Start Event', labelKo: '타이머 시작 이벤트', group: 'Start', icon: 'mdi-timer-outline' },
    { value: 'replace-with-conditional-start', label: 'Conditional Start Event', labelKo: '조건 시작 이벤트', group: 'Start', icon: 'mdi-source-branch' },
    { value: 'replace-with-signal-start', label: 'Signal Start Event', labelKo: '시그널 시작 이벤트', group: 'Start', icon: 'mdi-access-point' },
    { value: 'replace-with-error-start', label: 'Error Start Event', labelKo: '오류 시작 이벤트', group: 'Start', icon: 'mdi-alert-circle-outline' },
    { value: 'replace-with-escalation-start', label: 'Escalation Start Event', labelKo: '에스컬레이션 시작 이벤트', group: 'Start', icon: 'mdi-arrow-up-bold-circle-outline' },
    { value: 'replace-with-compensation-start', label: 'Compensation Start Event', labelKo: '보상 시작 이벤트', group: 'Start', icon: 'mdi-undo-variant' },
    {
        value: 'replace-with-non-interrupting-message-start',
        label: 'Non-Interrupting Message Start Event',
        labelKo: '비중단 메시지 시작 이벤트',
        group: 'Start',
        icon: 'mdi-message-badge-outline'
    },
    {
        value: 'replace-with-non-interrupting-timer-start',
        label: 'Non-Interrupting Timer Start Event',
        labelKo: '비중단 타이머 시작 이벤트',
        group: 'Start',
        icon: 'mdi-timer-sand'
    },
    {
        value: 'replace-with-non-interrupting-conditional-start',
        label: 'Non-Interrupting Conditional Start Event',
        labelKo: '비중단 조건 시작 이벤트',
        group: 'Start',
        icon: 'mdi-source-branch-check'
    },
    {
        value: 'replace-with-non-interrupting-signal-start',
        label: 'Non-Interrupting Signal Start Event',
        labelKo: '비중단 시그널 시작 이벤트',
        group: 'Start',
        icon: 'mdi-access-point-check'
    },
    {
        value: 'replace-with-non-interrupting-escalation-start',
        label: 'Non-Interrupting Escalation Start Event',
        labelKo: '비중단 에스컬레이션 시작 이벤트',
        group: 'Start',
        icon: 'mdi-arrow-up-circle-outline'
    },
    {
        value: 'replace-with-none-intermediate-throw',
        label: 'Intermediate Throw Event',
        labelKo: '중간 Throw 이벤트',
        group: 'Intermediate',
        icon: 'mdi-circle-outline',
        replaceKeys: ['replace-with-none-intermediate-throw', 'replace-with-none-intermediate-throwing']
    },
    {
        value: 'replace-with-message-intermediate-catch',
        label: 'Message Intermediate Catch Event',
        labelKo: '메시지 중간 Catch 이벤트',
        group: 'Intermediate',
        icon: 'mdi-message-arrow-left-outline'
    },
    {
        value: 'replace-with-message-intermediate-throw',
        label: 'Message Intermediate Throw Event',
        labelKo: '메시지 중간 Throw 이벤트',
        group: 'Intermediate',
        icon: 'mdi-message-arrow-right-outline'
    },
    {
        value: 'replace-with-timer-intermediate-catch',
        label: 'Timer Intermediate Catch Event',
        labelKo: '타이머 중간 Catch 이벤트',
        group: 'Intermediate',
        icon: 'mdi-timer-outline'
    },
    {
        value: 'replace-with-escalation-intermediate-throw',
        label: 'Escalation Intermediate Throw Event',
        labelKo: '에스컬레이션 중간 Throw 이벤트',
        group: 'Intermediate',
        icon: 'mdi-arrow-up-bold-circle-outline'
    },
    {
        value: 'replace-with-conditional-intermediate-catch',
        label: 'Conditional Intermediate Catch Event',
        labelKo: '조건 중간 Catch 이벤트',
        group: 'Intermediate',
        icon: 'mdi-source-branch'
    },
    {
        value: 'replace-with-link-intermediate-catch',
        label: 'Link Intermediate Catch Event',
        labelKo: '링크 중간 Catch 이벤트',
        group: 'Intermediate',
        icon: 'mdi-link-variant'
    },
    {
        value: 'replace-with-link-intermediate-throw',
        label: 'Link Intermediate Throw Event',
        labelKo: '링크 중간 Throw 이벤트',
        group: 'Intermediate',
        icon: 'mdi-link-variant-plus'
    },
    {
        value: 'replace-with-compensation-intermediate-throw',
        label: 'Compensation Intermediate Throw Event',
        labelKo: '보상 중간 Throw 이벤트',
        group: 'Intermediate',
        icon: 'mdi-undo-variant'
    },
    {
        value: 'replace-with-signal-intermediate-catch',
        label: 'Signal Intermediate Catch Event',
        labelKo: '시그널 중간 Catch 이벤트',
        group: 'Intermediate',
        icon: 'mdi-access-point'
    },
    {
        value: 'replace-with-signal-intermediate-throw',
        label: 'Signal Intermediate Throw Event',
        labelKo: '시그널 중간 Throw 이벤트',
        group: 'Intermediate',
        icon: 'mdi-access-point-plus'
    },
    { value: 'replace-with-none-end', label: 'End Event', labelKo: '종료 이벤트', group: 'End', icon: 'mdi-stop-circle-outline' },
    { value: 'replace-with-message-end', label: 'Message End Event', labelKo: '메시지 종료 이벤트', group: 'End', icon: 'mdi-message-outline' },
    { value: 'replace-with-escalation-end', label: 'Escalation End Event', labelKo: '에스컬레이션 종료 이벤트', group: 'End', icon: 'mdi-arrow-up-bold-circle-outline' },
    { value: 'replace-with-error-end', label: 'Error End Event', labelKo: '오류 종료 이벤트', group: 'End', icon: 'mdi-alert-circle-outline' },
    { value: 'replace-with-cancel-end', label: 'Cancel End Event', labelKo: '취소 종료 이벤트', group: 'End', icon: 'mdi-cancel' },
    { value: 'replace-with-compensation-end', label: 'Compensation End Event', labelKo: '보상 종료 이벤트', group: 'End', icon: 'mdi-undo-variant' },
    { value: 'replace-with-signal-end', label: 'Signal End Event', labelKo: '시그널 종료 이벤트', group: 'End', icon: 'mdi-access-point' },
    { value: 'replace-with-terminate-end', label: 'Terminate End Event', labelKo: '종료 처리 이벤트', group: 'End', icon: 'mdi-close-octagon-outline' },
    { value: 'replace-with-message-boundary', label: 'Message Boundary Event', labelKo: '메시지 경계 이벤트', group: 'Boundary', icon: 'mdi-message-outline' },
    { value: 'replace-with-timer-boundary', label: 'Timer Boundary Event', labelKo: '타이머 경계 이벤트', group: 'Boundary', icon: 'mdi-timer-outline' },
    {
        value: 'replace-with-escalation-boundary',
        label: 'Escalation Boundary Event',
        labelKo: '에스컬레이션 경계 이벤트',
        group: 'Boundary',
        icon: 'mdi-arrow-up-bold-circle-outline'
    },
    { value: 'replace-with-conditional-boundary', label: 'Conditional Boundary Event', labelKo: '조건 경계 이벤트', group: 'Boundary', icon: 'mdi-source-branch' },
    { value: 'replace-with-error-boundary', label: 'Error Boundary Event', labelKo: '오류 경계 이벤트', group: 'Boundary', icon: 'mdi-alert-circle-outline' },
    { value: 'replace-with-cancel-boundary', label: 'Cancel Boundary Event', labelKo: '취소 경계 이벤트', group: 'Boundary', icon: 'mdi-cancel' },
    { value: 'replace-with-signal-boundary', label: 'Signal Boundary Event', labelKo: '시그널 경계 이벤트', group: 'Boundary', icon: 'mdi-access-point' },
    { value: 'replace-with-compensation-boundary', label: 'Compensation Boundary Event', labelKo: '보상 경계 이벤트', group: 'Boundary', icon: 'mdi-undo-variant' },
    {
        value: 'replace-with-non-interrupting-message-boundary',
        label: 'Non-Interrupting Message Boundary Event',
        labelKo: '비중단 메시지 경계 이벤트',
        group: 'Boundary',
        icon: 'mdi-message-badge-outline'
    },
    {
        value: 'replace-with-non-interrupting-timer-boundary',
        label: 'Non-Interrupting Timer Boundary Event',
        labelKo: '비중단 타이머 경계 이벤트',
        group: 'Boundary',
        icon: 'mdi-timer-sand'
    },
    {
        value: 'replace-with-non-interrupting-escalation-boundary',
        label: 'Non-Interrupting Escalation Boundary Event',
        labelKo: '비중단 에스컬레이션 경계 이벤트',
        group: 'Boundary',
        icon: 'mdi-arrow-up-circle-outline'
    },
    {
        value: 'replace-with-non-interrupting-conditional-boundary',
        label: 'Non-Interrupting Conditional Boundary Event',
        labelKo: '비중단 조건 경계 이벤트',
        group: 'Boundary',
        icon: 'mdi-source-branch-check'
    },
    {
        value: 'replace-with-non-interrupting-signal-boundary',
        label: 'Non-Interrupting Signal Boundary Event',
        labelKo: '비중단 시그널 경계 이벤트',
        group: 'Boundary',
        icon: 'mdi-access-point-check'
    }
];

export const DEFAULT_VISIBLE_EVENT_TYPES = AVAILABLE_EVENT_TYPES.map((eventType) => eventType.value);

// Property types for schema
export const PROPERTY_TYPES = [
    { value: 'string', label: 'Text' },
    { value: 'textarea', label: 'Long Text' },
    { value: 'number', label: 'Number' },
    { value: 'boolean', label: 'Boolean' },
    { value: 'select', label: 'Single Select' },
    { value: 'multiselect', label: 'Multi Select' },
    { value: 'date', label: 'Date' },
    { value: 'daterange', label: 'Date Range' },
    { value: 'user', label: 'User' },
    { value: 'url', label: 'URL' },
    { value: 'db-select', label: 'DB-Select' },
    { value: 'formula', label: 'Formula' }
];

export const APPLIES_TO_OPTIONS = [
    { value: 'both', label: 'Process + Task', labelKo: '프로세스 + Task' },
    { value: 'process', label: 'Process Only', labelKo: '프로세스만' },
    { value: 'task', label: 'All Tasks', labelKo: '모든 Task' },
    ...AVAILABLE_TASK_TYPES.map((t) => ({ value: t.value, label: t.label, labelKo: t.labelKo })),
    ...Array.from(new Set(BUILTIN_PANEL_PROPERTIES.map((property) => property.taskType)))
        .filter((taskType) => !['both', 'process', 'task', ...AVAILABLE_TASK_TYPES.map((type) => type.value)].includes(taskType))
        .map((taskType) => ({
            value: taskType,
            label: taskType.replace(/^bpmn:/, ''),
            labelKo: taskType.replace(/^bpmn:/, '')
        }))
];

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
            visibleTaskTypes: [...DEFAULT_VISIBLE_TASK_TYPES],
            visibleEventTypes: [...DEFAULT_VISIBLE_EVENT_TYPES]
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
                const index = this.systems.findIndex((s) => s.id === saved.id);
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
                this.systems = this.systems.filter((s) => s.id !== id);
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
                const index = this.catalogItems.findIndex((c) => c.id === saved.id);
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
                this.catalogItems = this.catalogItems.filter((c) => c.id !== id);
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
                const index = this.propertySchemas.findIndex((s) => s.id === saved.id);
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

        // 전체 스키마 1회 로드 보장 (loadSchemas(taskType)는 목록을 부분집합으로 덮어쓰므로
        // 내장 속성 가시성 판정에는 반드시 전체 로드를 사용한다)
        async ensureSchemasLoaded() {
            if (this.schemasLoaded) return;
            await this.loadSchemas();
        },

        // 전용 패널 위젯을 사용자 정의 속성으로 등록한다. panelProperty는 일반 동적
        // 필드와 중복 렌더링되지 않도록 패널 연결만 표시하는 메타데이터이며,
        // builtin은 이전 데이터 호환을 위해 이 함수에서 제거한다.
        async syncPanelPropertySchemas() {
            await this.ensureSchemasLoaded();
            const registryByKey = new Map(BUILTIN_PANEL_PROPERTIES.map((p) => [`${p.taskType}::${p.key}`, p]));

            // config.builtin 행뿐 아니라 이전 이관 과정에서 렌더러 메타데이터가
            // 누락된 행도 키가 레지스트리와 일치하면 기존 패널 UI에 다시 연결한다.
            const legacyRows = this.propertySchemas.filter((schema) => {
                const key = `${panelPropertyScope(schema)}::${schema.property_key}`;
                return schema.config?.builtin === true || (!!registryByKey.get(key) && !isPanelPropertySchema(schema));
            });
            for (const schema of legacyRows) {
                const config = { ...(schema.config || {}) };
                delete config.builtin;
                const registryKey = `${panelPropertyScope(schema)}::${schema.property_key}`;
                const panelProperty = registryByKey.get(registryKey);
                if (panelProperty) {
                    config.renderer = 'panel';
                    config.panelProperty = true;
                    config.panelTaskType = config.panelTaskType || panelProperty.taskType;
                    config.panel = config.panel || panelProperty.panel;
                    config.widget = config.widget || panelProperty.widget;
                    config.binding = config.binding ?? panelProperty.binding ?? null;
                    config.tab = config.tab ?? panelProperty.tab ?? null;
                } else {
                    delete config.renderer;
                    delete config.panelProperty;
                    delete config.panelTaskType;
                }
                await this.saveSchema({ ...schema, config });
            }

            const existing = new Set(this.propertySchemas.map((s) => `${panelPropertyScope(s)}::${s.property_key}`));
            // 새 테넌트처럼 패널 연결 행이 하나도 없을 때만 기본 세트를 만든다.
            // 사용자가 개별 행을 영구 삭제한 뒤 다음 진입에서 되살아나는 것을 막는다.
            const hasPanelProperties = this.propertySchemas.some(isPanelPropertySchema);
            const missing = hasPanelProperties
                ? []
                : BUILTIN_PANEL_PROPERTIES.filter((p) => !existing.has(`${p.taskType}::${p.key}`));
            for (const prop of missing) {
                await this.saveSchema({
                    task_type: prop.taskType,
                    property_key: prop.key,
                    property_label: prop.labelKo,
                    property_type: prop.propertyType as PropertySchema['property_type'],
                    is_required: !!prop.required,
                    display_order: prop.displayOrder,
                    applies_to: prop.taskType as any,
                    visible_by_default: true,
                    is_active: true,
                    description: prop.description || `패널 연결 속성 (${prop.panel})`,
                    config: {
                        renderer: 'panel',
                        panelProperty: true,
                        panelTaskType: prop.taskType,
                        panel: prop.panel,
                        widget: prop.widget,
                        binding: prop.binding || null,
                        labelI18n: prop.labelI18n || null,
                        tab: prop.tab || null
                    }
                });
            }
            return legacyRows.length + missing.length;
        },

        // 이전 호출부/플러그인 호환용 별칭.
        async syncBuiltinPanelSchemas() {
            return this.syncPanelPropertySchemas();
        },

        async deleteSchema(id: string) {
            this.loading = true;
            this.error = null;
            try {
                const backend = BackendFactory.createBackend();
                await backend.deletePropertySchema(id);
                this.propertySchemas = this.propertySchemas.filter((s) => s.id !== id);
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
                const settings = await backend.getPaletteSettings();
                const visibleTaskTypes = Array.isArray(settings?.visibleTaskTypes)
                    ? [...settings.visibleTaskTypes]
                    : [...DEFAULT_VISIBLE_TASK_TYPES];
                const visibleEventTypes = Array.isArray(settings?.visibleEventTypes)
                    ? [...settings.visibleEventTypes]
                    : [...DEFAULT_VISIBLE_EVENT_TYPES];
                this.paletteSettings = { ...(settings || {}), visibleTaskTypes, visibleEventTypes };
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
                this.paletteSettings = {
                    ...settings,
                    visibleTaskTypes: [...(settings.visibleTaskTypes || [])],
                    visibleEventTypes: [...(settings.visibleEventTypes || [])]
                };
                this.paletteSettingsLoaded = true;
                if (typeof window !== 'undefined') {
                    window.$paletteSettings = this.paletteSettings;
                }
            } catch (error: any) {
                console.error('Failed to save palette settings:', error);
                this.error = error.message;
                throw error;
            } finally {
                this.loading = false;
            }
        },

        async setTaskTypeVisible(taskType: string, isVisible: boolean) {
            const visibleTaskTypes = new Set(this.paletteSettings.visibleTaskTypes || []);
            const beforeEnabled = visibleTaskTypes.has(taskType);
            if (beforeEnabled === isVisible) return;

            const typeInfo = AVAILABLE_TASK_TYPES.find((item) => item.value === taskType);
            if (isVisible) {
                visibleTaskTypes.add(taskType);
            } else {
                visibleTaskTypes.delete(taskType);
            }
            await this.savePaletteSettings({ ...this.paletteSettings, visibleTaskTypes: Array.from(visibleTaskTypes) });
            await useAdminConsoleStore().writeAdminAuditLog({
                action: 'task_type_visibility_update',
                target_type: 'task_event_type',
                target_id: taskType,
                target_name: typeInfo?.labelKo || typeInfo?.label || taskType,
                before_value: {
                    name: typeInfo?.labelKo || typeInfo?.label || taskType,
                    type_id: taskType,
                    is_enabled: beforeEnabled
                },
                after_value: {
                    name: typeInfo?.labelKo || typeInfo?.label || taskType,
                    type_id: taskType,
                    is_enabled: isVisible
                }
            });
        },

        async toggleTaskType(taskType: string) {
            await this.setTaskTypeVisible(taskType, !this.paletteSettings.visibleTaskTypes.includes(taskType));
        },

        async setEventTypeVisible(eventType: string, isVisible: boolean) {
            const visibleEventTypes = new Set(this.paletteSettings.visibleEventTypes || []);
            const beforeEnabled = visibleEventTypes.has(eventType);
            if (beforeEnabled === isVisible) return;

            const typeInfo = AVAILABLE_EVENT_TYPES.find((item) => item.value === eventType);
            if (isVisible) {
                visibleEventTypes.add(eventType);
            } else {
                visibleEventTypes.delete(eventType);
            }
            await this.savePaletteSettings({ ...this.paletteSettings, visibleEventTypes: Array.from(visibleEventTypes) });
            await useAdminConsoleStore().writeAdminAuditLog({
                action: 'event_type_visibility_update',
                target_type: 'task_event_type',
                target_id: eventType,
                target_name: typeInfo?.labelKo || typeInfo?.label || eventType,
                before_value: {
                    name: typeInfo?.labelKo || typeInfo?.label || eventType,
                    type_id: eventType,
                    is_enabled: beforeEnabled
                },
                after_value: {
                    name: typeInfo?.labelKo || typeInfo?.label || eventType,
                    type_id: eventType,
                    is_enabled: isVisible
                }
            });
        },

        async toggleEventType(eventType: string) {
            await this.setEventTypeVisible(eventType, !this.paletteSettings.visibleEventTypes.includes(eventType));
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
            const taskType = this.paletteTaskTypes.find((t) => t.id === id);
            if (!taskType) return;

            this.loading = true;
            this.error = null;
            try {
                const backend = BackendFactory.createBackend();
                const newEnabled = !taskType.is_enabled;
                const beforeEnabled = taskType.is_enabled;
                await backend.updatePaletteTaskType(id, newEnabled);
                taskType.is_enabled = newEnabled;
                if (typeof window !== 'undefined') {
                    window.$paletteTaskTypes = this.paletteTaskTypes;
                    window.$enabledPaletteTaskTypes = this.enabledPaletteTaskTypes;
                }
                await useAdminConsoleStore().writeAdminAuditLog({
                    action: 'task_type_visibility_update',
                    target_type: 'task_event_type',
                    target_id: taskType.task_type || id,
                    target_name: taskType.label_ko || taskType.label || taskType.task_type || id,
                    before_value: {
                        name: taskType.label_ko || taskType.label || taskType.task_type || id,
                        type_id: taskType.task_type || id,
                        is_enabled: beforeEnabled
                    },
                    after_value: {
                        name: taskType.label_ko || taskType.label || taskType.task_type || id,
                        type_id: taskType.task_type || id,
                        is_enabled: newEnabled
                    }
                });
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
            this.paletteSettings = {
                visibleTaskTypes: [...DEFAULT_VISIBLE_TASK_TYPES],
                visibleEventTypes: [...DEFAULT_VISIBLE_EVENT_TYPES]
            };
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
            return state.catalogItems.filter((item) => item.task_type === taskType);
        },

        // Get catalog items by system
        catalogBySystem: (state) => (systemName: string) => {
            return state.catalogItems.filter((item) => item.system_name === systemName);
        },

        // Get schemas by task type
        // 패널 연결 속성은 전용 UI로 렌더링하므로 일반 동적 필드에서 제외한다.
        schemasByTaskType: (state) => (taskType: string) => {
            return state.propertySchemas
                .filter((s) => s.task_type === taskType && !isPanelPropertySchema(s))
                .sort((a, b) => a.display_order - b.display_order);
        },

        // Get required schemas by task type
        requiredSchemasByTaskType: (state) => (taskType: string) => {
            return state.propertySchemas
                .filter((s) => s.task_type === taskType && s.is_required && !isPanelPropertySchema(s))
                .sort((a, b) => a.display_order - b.display_order);
        },

        // Get schemas filtered by target ('process' or 'task')
        // For task: optionally pass elementType (e.g., 'bpmn:ManualTask') to include type-specific schemas
        schemasByAppliesTo: (state) => (target: 'process' | 'task', elementType?: string) => {
            return state.propertySchemas
                .filter((s) => !isPanelPropertySchema(s))
                .filter((s) => {
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
                .filter((s) => !s.deleted_at)
                .filter((s) => s.is_active !== false)
                .filter((s) => s.visible_by_default !== false)
                .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
        },

        // Get deprecated schemas by target (for read-only preservation of legacy values)
        deprecatedSchemasByAppliesTo: (state) => (target: 'process' | 'task', elementType?: string) => {
            return state.propertySchemas
                .filter((s) => !isPanelPropertySchema(s))
                .filter((s) => !!s.deleted_at)
                .filter((s) => {
                    const at = s.applies_to || 'both';
                    if (target === 'process') {
                        return at === 'process' || at === 'both';
                    }
                    if (target === 'task') {
                        if (at === 'task' || at === 'both') return true;
                        if (elementType && at === elementType) return true;
                        return false;
                    }
                    return false;
                })
                .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
        },

        // 전용 패널 위젯 연결 속성. 기존 getter 이름은 호출부 호환을 위해 유지한다.
        builtinSchemas: (state) => {
            return state.propertySchemas.filter(isPanelPropertySchema);
        },

        builtinSchemaFor: (state) => (taskType: string, key: string) => {
            return state.propertySchemas.find(
                (s) => isPanelPropertySchema(s) && panelPropertyScope(s) === taskType && s.property_key === key
            );
        },

        // 패널이 내장 필드를 렌더링할지 판정. 오버라이드 행이 없으면 기본 노출.
        isBuiltinPropVisible: (state) => (taskType: string, key: string) => {
            const row = state.propertySchemas.find(
                (s) => isPanelPropertySchema(s) && panelPropertyScope(s) === taskType && s.property_key === key
            );
            if (!row) return true;
            if (row.deleted_at) return false;
            if (row.is_active === false) return false;
            return row.visible_by_default !== false;
        },

        // 관리자가 라벨을 바꿨으면 그 라벨을, 아니면 패널의 기본 라벨을 사용
        builtinPropLabel: (state) => (taskType: string, key: string, fallback?: string) => {
            const row = state.propertySchemas.find(
                (s) => isPanelPropertySchema(s) && panelPropertyScope(s) === taskType && s.property_key === key
            );
            return row?.property_label || fallback || key;
        },

        // Check if task type is visible in palette
        isTaskTypeVisible: (state) => (taskType: string) => {
            return state.paletteSettings.visibleTaskTypes.includes(taskType);
        },

        isEventTypeVisible: (state) => (eventType: string) => {
            return state.paletteSettings.visibleEventTypes.includes(eventType);
        },

        // Get enabled palette task types (new table-based)
        enabledPaletteTaskTypes: (state) => {
            return state.paletteTaskTypes.filter((t) => t.is_enabled);
        },

        // Check if task type is enabled (new table-based)
        isPaletteTaskTypeEnabled: (state) => (taskType: string) => {
            const type = state.paletteTaskTypes.find((t) => t.task_type === taskType);
            return type ? type.is_enabled : false;
        },

        // Search catalog items
        searchCatalog: (state) => (query: string) => {
            const lowerQuery = query.toLowerCase();
            return state.catalogItems.filter(
                (item) =>
                    item.display_name.toLowerCase().includes(lowerQuery) ||
                    item.name.toLowerCase().includes(lowerQuery) ||
                    item.system_name.toLowerCase().includes(lowerQuery) ||
                    (item.description && item.description.toLowerCase().includes(lowerQuery))
            );
        }
    }
});
