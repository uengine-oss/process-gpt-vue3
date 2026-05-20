import { defineStore } from 'pinia';

export const useBpmnStore = defineStore({
    id: 'bpmn',
    state: () => ({
        bpmnModeler: null,
        processDefinition: null,
        // 단위 테스트 등에서 캔버스에 표시할 활성/완료 활동 id. 사용자가 다시 실행하거나
        // 패널을 닫을 때까지 유지된다 (백엔드 인스턴스 삭제와 무관). hli 패턴.
        runningActivityIds: [] as string[],
        completedActivityIds: [] as string[]
    }),
    actions: {
        setModeler(modeler: any) {
            this.bpmnModeler = modeler;
        },
        setProcessDefinition(definition: any) {
            this.processDefinition = definition;
        },
        setRunningActivityIds(ids: string[]) {
            this.runningActivityIds = Array.isArray(ids) ? [...ids] : [];
        },
        clearRunningActivityIds() {
            this.runningActivityIds = [];
        },
        setCompletedActivityIds(ids: string[]) {
            this.completedActivityIds = Array.isArray(ids) ? [...ids] : [];
        },
        addCompletedActivityId(id: string) {
            if (id && !this.completedActivityIds.includes(id)) {
                this.completedActivityIds = [...this.completedActivityIds, id];
            }
        },
        clearCompletedActivityIds() {
            this.completedActivityIds = [];
        }
    },
    getters: {
        getModeler: (state) => {
            return state.bpmnModeler;
        }
    }
});
