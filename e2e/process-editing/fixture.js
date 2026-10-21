import { createApp, h } from 'vue';
import { createVuetify } from 'vuetify';
import 'vuetify/styles';
import Modeler from 'bpmn-js/lib/Modeler';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';
import routingModule from '../../src/components/autoLayout/custom-sequence-flow-final-module.js';
import CardView from '../../src/views/process-architecture/ProcessArchCardView.vue';
import TreeView from '../../src/views/process-architecture/ProcessArchTreeView.vue';
import xml from '../../P5.4.1_시정조치_프로세스.bpmn?raw';

const mode = new URLSearchParams(location.search).get('mode');
window.navigations = [];
window.favorites = [];
if (mode) {
    const app = createApp({
        render: () =>
            h(mode === 'tree' ? TreeView : CardView, {
                procMap: {
                    mega_proc_list: [
                        {
                            id: 'mega',
                            name: '품질',
                            major_proc_list: [
                                {
                                    id: 'major',
                                    name: '품질관리',
                                    sub_proc_list: [{ id: 'capa', name: '시정조치', description: '시정조치 절차' }]
                                }
                            ]
                        }
                    ]
                },
                domains: [],
                selectedDomain: null,
                processStatuses: new Map(),
                favorites: new Set(),
                readonly: new URLSearchParams(location.search).has('readonly'),
                onNavigate: (...args) => window.navigations.push(args),
                onToggleFavorite: (id) => window.favorites.push(id)
            })
    });
    app.config.globalProperties.$t = (key) => key;
    app.use(createVuetify()).mount('#app');
} else {
    const modeler = (window.modeler = new Modeler({ container: '#canvas', additionalModules: [routingModule] }));
    window.importResult = await modeler.importXML(xml);
    modeler.get('canvas').zoom('fit-viewport');
}
window.ready = true;
