import Modeler from 'bpmn-js/lib/Modeler';
import { createRouter, createWebHistory } from 'vue-router';
import drilldown from '../../src/components/customDrilldown';
import { withCallActivityHistory } from '../../src/components/customDrilldown/drilldownHistory';
import routing from '../../src/components/autoLayout/custom-sequence-flow-final-module';
import uengine from '../../src/components/descriptors/uEngine.json';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';
import '../../src/assets/css/globalStyle.css';
import childXml from '../../P5.4.1_시정조치_프로세스.bpmn?raw';

// Deliberately duplicate a parent ID in the child and add a nested reference.
const child = childXml
    .replace(/CA_Analyze/g, 'Call')
    .replace(
        /<bpmn:userTask id="CA_Register"[^>]*>[\s\S]*?<\/bpmn:userTask>/,
        '<bpmn:callActivity id="CA_Register" name="중첩 모듈" calledElement="grandchild.bpmn" />'
    );
const parent = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" xmlns:uengine="http://uengine" id="Defs" targetNamespace="http://bpmn.io/schema/bpmn">
<bpmn:process id="Parent" isExecutable="false">
<bpmn:startEvent id="Start" name="시작"><bpmn:extensionElements><uengine:properties json="{&quot;definitionId&quot;:&quot;child.bpmn&quot;}" /></bpmn:extensionElements></bpmn:startEvent>
<bpmn:callActivity id="Call" name="시정조치 모듈" calledElement="child.bpmn" />
<bpmn:endEvent id="End" name="종료"><bpmn:extensionElements><uengine:properties json="{&quot;definitionId&quot;:&quot;child.bpmn&quot;}" /></bpmn:extensionElements></bpmn:endEvent>
<bpmn:sequenceFlow id="Flow1" sourceRef="Start" targetRef="Call"/><bpmn:sequenceFlow id="Flow2" sourceRef="Call" targetRef="End"/>
</bpmn:process><bpmndi:BPMNDiagram id="Diagram"><bpmndi:BPMNPlane id="Plane" bpmnElement="Parent">
<bpmndi:BPMNShape id="Start_di" bpmnElement="Start"><dc:Bounds x="150" y="220" width="36" height="36"/><bpmndi:BPMNLabel><dc:Bounds x="150" y="260" width="50" height="20"/></bpmndi:BPMNLabel></bpmndi:BPMNShape>
<bpmndi:BPMNShape id="Call_di" bpmnElement="Call"><dc:Bounds x="280" y="200" width="120" height="80"/></bpmndi:BPMNShape>
<bpmndi:BPMNShape id="End_di" bpmnElement="End"><dc:Bounds x="500" y="220" width="36" height="36"/></bpmndi:BPMNShape>
<bpmndi:BPMNEdge id="Flow1_di" bpmnElement="Flow1"><di:waypoint x="186" y="238"/><di:waypoint x="230" y="238"/><di:waypoint x="230" y="240"/><di:waypoint x="280" y="240"/></bpmndi:BPMNEdge>
<bpmndi:BPMNEdge id="Flow2_di" bpmnElement="Flow2"><di:waypoint x="400" y="240"/><di:waypoint x="450" y="240"/><di:waypoint x="450" y="238"/><di:waypoint x="500" y="238"/></bpmndi:BPMNEdge>
</bpmndi:BPMNPlane></bpmndi:BPMNDiagram></bpmn:definitions>`;
window.opened = [];
window.errors = [];
window.requests = [];
window.deferResolve = null;
window.parentXml = parent;
window.routerTransitions = [];
const router = (window.router = createRouter({
    history: withCallActivityHistory(createWebHistory()),
    routes: [{ path: '/:pathMatch(.*)*', component: {} }]
}));
await router.push(location.pathname + location.search);
router.afterEach((to) => window.routerTransitions.push(to.fullPath));
const modeler = (window.modeler = new Modeler({
    container: '#canvas',
    moddleExtensions: { uengine },
    additionalModules: [
        routing,
        drilldown,
        {
            callActivityDrilldownConfig: [
                'value',
                {
                    isViewMode: !new URLSearchParams(location.search).has('edit'),
                    rootLabel: '상위 프로세스',
                    moddleExtensions: { uengine },
                    resolveXml: async (id) => {
                        window.requests.push(id);
                        if (window.failRequest) throw new Error('조회 실패');
                        if (window.delayRequest)
                            await new Promise((resolve) => {
                                window.deferResolve = resolve;
                            });
                        return id === 'grandchild' ? childXml : child;
                    },
                    onOpenInNew: (id, label) => window.opened.push({ id, label }),
                    onError: (error) => window.errors.push(error.message)
                }
            ]
        }
    ]
}));
await modeler.importXML(parent);
modeler.get('canvas').zoom('fit-viewport');
window.baselineXml = (await modeler.saveXML({ format: true })).xml;
window.ready = true;
