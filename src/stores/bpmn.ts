import { defineStore } from 'pinia';

export const useBpmnStore = defineStore({
    id: 'bpmn',
    state: () => ({
        bpmnModeler: null,
        processDefinition: null,
        // 단위 테스트 등에서 캔버스에 표시할 활성/완료 활동 id. 사용자가 다시 실행하거나
        // 패널을 닫을 때까지 유지된다 (백엔드 인스턴스 삭제와 무관). hli 패턴.
        runningActivityIds: [] as string[],
        completedActivityIds: [] as string[],
        // 깃발 아이콘 클릭 시 "PI Flag 탭으로 진입" 신호. 패널이 mount/갱신될 때 읽는다.
        piFlagFocus: null as { elementId: string; groupTargetIds: string[]; ts: number } | null
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
        },
        // 깃발 아이콘 진입: 패널을 PI Flag 탭으로 열고, 묶음 대상(여러 작업)을 전달
        requestPiFlagFocus(elementId: string, groupTargetIds: string[] = []) {
            this.piFlagFocus = {
                elementId,
                groupTargetIds: Array.isArray(groupTargetIds) ? [...groupTargetIds] : [],
                ts: Date.now()
            };
        }
    },
    getters: {
        getModeler: (state) => {
            return state.bpmnModeler;
        }
    }
});
