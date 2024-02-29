import { defineStore } from 'pinia';
import { router } from '@/router';

export const useBpmnStore = defineStore({
    id: 'bpmn',
    state: () => ({
        bpmnModeler: null,
      }),
    actions: {
        setModeler(modeler: any) {
            this.bpmnModeler = modeler
        }
    },
    getters: {
        getModeler: state => {
            return state.bpmnModeler;
        },
        // getXML: async state => {
        //     if (state.bpmnModeler && typeof state.bpmnModeler?.saveXML === 'function') {
                
        //     }
        // }
    }
});
