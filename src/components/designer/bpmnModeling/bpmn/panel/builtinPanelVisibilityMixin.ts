import { useTaskCatalogStore } from '@/stores/taskCatalog';

/**
 * BPMN 속성 패널의 내장 필드 노출 제어 믹스인.
 *
 * 속성 스키마 스튜디오에서 관리하는 내장 패널 속성(task_property_schema, config.builtin=true)을
 * 읽어 필드 단위 게이팅(v-if="isBuiltinPropVisible('key')")과 라벨 오버라이드를 제공한다.
 *
 * - 오버라이드 행이 없는 필드는 기본 노출 — 스키마 로드 전/미등록 테넌트에서도 UI가 비지 않는다.
 * - task_type은 element.$type(bpmn:UserTask 등)을 그대로 사용한다. element prop이 없는
 *   서브패널은 컴포넌트에서 builtinPanelTaskTypeOverride를 정의해 지정한다.
 */
export default {
    computed: {
        builtinPanelTaskType(): string {
            const self = this as any;
            return self.builtinPanelTaskTypeOverride || self.element?.$type || '';
        }
    },
    methods: {
        isBuiltinPropVisible(key: string): boolean {
            const taskType = (this as any).builtinPanelTaskType;
            if (!taskType) return true;
            try {
                return useTaskCatalogStore().isBuiltinPropVisible(taskType, key);
            } catch (e) {
                // pinia 미초기화 등 예외 시 기본 노출을 유지한다
                return true;
            }
        },
        builtinPropLabel(key: string, fallback?: string): string {
            const taskType = (this as any).builtinPanelTaskType;
            if (!taskType) return fallback || key;
            try {
                return useTaskCatalogStore().builtinPropLabel(taskType, key, fallback);
            } catch (e) {
                return fallback || key;
            }
        }
    },
    created() {
        try {
            useTaskCatalogStore().ensureSchemasLoaded();
        } catch (e) {
            // 로드 실패 시에도 기본 노출이므로 무시
        }
    }
};
