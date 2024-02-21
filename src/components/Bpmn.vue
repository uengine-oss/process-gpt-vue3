<template>
    <!-- <div> -->
    <div ref="container" class="vue-bpmn-diagram-container"></div>
    <!-- </div> -->
</template>

<script>
import BpmnJS from 'bpmn-js/dist/bpmn-navigated-viewer.production.min.js';
import BpmnModeler from 'bpmn-js/lib/Modeler';
import BpmnModdle from 'bpmn-moddle';
import uEngineModdleDescriptor from '@/components/descriptors/uEngine.json';
import 'bpmn-js/dist/assets/diagram-js.css';

export default {
    name: 'vue-bpmn',
    props: {
        url: {
            type: String
        },
        bpmn: {
            type: String
        },
        options: {
            type: Object
        }
    },
    data: function () {
        return {
            diagramXML: null,
            openPanel: false,
            moddle: null
        };
    },
    computed: {
        // async getXML() {
        //     let xml = await self.bpmnViewer.saveXML({ format: true, preamble: true });
        //     return xml;
        // }
    },
    mounted() {
        var container = this.$refs.container;

        var self = this;
        var _options = Object.assign(
            {
                container: container,
                keyboard: {
                    bindTo: window
                },
                additionalModules: [
                ],
                moddleExtensions: {
                    uengine: uEngineModdleDescriptor
                }
            },
            this.options
        );

        this.bpmnViewer = new BpmnModeler(_options); //new BpmnJS(_options);  //
        var eventBus = this.bpmnViewer.get('eventBus');
        // eventBus.on('import.render.start', function (e) {
        //     // self.openPanel = true;
        //     console.log("render  complete")
        //     self.$emit('openPanel', e.element.id);
        // });
        eventBus.on('import.render.complete', async function (event) {
            console.log("complete?")
            var error = event.error;
            var warnings = event.warnings;
            let def = self.bpmnViewer.getDefinitions();

            self.$emit('definition', def);
            if (error) {
                self.$emit('error', error);
            } else {
                self.$emit('shown', warnings);
            }

            self.bpmnViewer.get('canvas').zoom('fit-viewport');
            // you may hook into any of the following events
            eventBus.on('element.dblclick', function (e) {
                // self.openPanel = true;
                self.$emit('openPanel', e.element.id);
            });
            eventBus.on('shape.remove', async function (e) {
                // let xml = await self.bpmnViewer.saveXML({ format: true, preamble: true });
                // console.log(xml)
                console.log(e)
                // self.$emit("update-xml", xml.xml)
                // save XML
            });
            // var events = ['element.hover', 'element.out', 'element.click', 'element.dblclick', 'element.mousedown', 'element.mouseup'];
            // events.forEach(function (event) {

            // });

        });


        if (this.url) {
            this.fetchDiagram(this.url);
        } else if (this.bpmn) {
            this.diagramXML = this.bpmn;
        }
    },
    beforeDestroy() {
        this.bpmnViewer.destroy();
    },
    watch: {
        url(val) {
            this.$emit('loading');
            this.fetchDiagram(val);
        },
        sortByIdWithParticipantFirst(array) {
            return array.sort((a, b) => {
                const aIsParticipant = a.id.toLowerCase().startsWith('participant');
                const bIsParticipant = b.id.toLowerCase().startsWith('participant');

                if (aIsParticipant && !bIsParticipant) {
                    return -1;
                } else if (!aIsParticipant && bIsParticipant) {
                    return 1;
                } else {
                    return a.id.localeCompare(b.id);
                }
            });
        },
        diagramXML(val) {
            console.log(val)
            // let obj = '<?xml version="1.0" encoding="UTF-8"?><bpmn2:definitions xmlns:bpmn2="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="Definitions_vacationProcess" targetNamespace="http://bpmn.io/schema/bpmn" exporter="Custom BPMN Modeler" exporterVersion="1.0"><bpmn2:collaboration id="Collaboration_1"><bpmn2:participant id="Participant" name="Participant" processRef="vacationProcess"/></bpmn2:collaboration><bpmn2:process id="vacationProcess" isExecutable="true"><bpmn2:laneSet id="LaneSet_1"><bpmn2:lane id="Lane_worker" name="직원"><bpmn2:flowNodeRef>requestVacation</bpmn2:flowNodeRef><bpmn2:flowNodeRef>returnVacation</bpmn2:flowNodeRef></bpmn2:lane><bpmn2:lane id="Lane_process_manager" name="프로세스 관리자"><bpmn2:flowNodeRef>approveVacation</bpmn2:flowNodeRef></bpmn2:lane></bpmn2:laneSet><bpmn2:userTask id="requestVacation" name="휴가 신청"/><bpmn2:userTask id="approveVacation" name="휴가 승인"/><bpmn2:userTask id="returnVacation" name="휴가 복귀"/><bpmn2:sequenceFlow id="SequenceFlow_requestVacation_approveVacation" sourceRef="requestVacation" targetRef="approveVacation"/><bpmn2:sequenceFlow id="SequenceFlow_approveVacation_returnVacation" sourceRef="approveVacation" targetRef="returnVacation"/></bpmn2:process><bpmndi:BPMNDiagram id="BPMNDiagram_1"><bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Collaboration_1"><bpmndi:BPMNShape id="BPMNShape_Worker" bpmnElement="Lane_worker" isHorizontal="true"><dc:Bounds x="100" y="100" width="600" height="100"/></bpmndi:BPMNShape><bpmndi:BPMNShape id="BPMNShape_Process_Manager" bpmnElement="Lane_process_manager" isHorizontal="true"><dc:Bounds x="100" y="220" width="600" height="100"/></bpmndi:BPMNShape><bpmndi:BPMNShape id="BPMNShape_requestVacation" bpmnElement="requestVacation"><dc:Bounds x="150" y="150" width="80" height="60"/></bpmndi:BPMNShape><bpmndi:BPMNShape id="BPMNShape_approveVacation" bpmnElement="approveVacation"><dc:Bounds x="150" y="230" width="80" height="60"/></bpmndi:BPMNShape><bpmndi:BPMNShape id="BPMNShape_returnVacation" bpmnElement="returnVacation"><dc:Bounds x="150" y="310" width="80" height="60"/></bpmndi:BPMNShape><bpmndi:BPMNEdge id="BPMNEdge_requestVacation_approveVacation" bpmnElement="SequenceFlow_requestVacation_approveVacation"><di:waypoint x="180" y="180"/><di:waypoint x="280" y="180"/></bpmndi:BPMNEdge><bpmndi:BPMNEdge id="BPMNEdge_approveVacation_returnVacation" bpmnElement="SequenceFlow_approveVacation_returnVacation"><di:waypoint x="180" y="180"/><di:waypoint x="280" y="180"/></bpmndi:BPMNEdge></bpmndi:BPMNPlane></bpmndi:BPMNDiagram></bpmn2:definitions>'
            this.bpmnViewer.importXML(val);
        }
    },
    methods: {
        diagramObject(obj) {
            // let obj = this.parseJsonToModdle(val);
            // const parsedData = JSON.parse(val);
            function assignParents(element, parent) {
                if (Array.isArray(element)) {
                    element.forEach((child) => assignParents(child, parent));
                } else if (element && typeof element === 'object') {
                    element.$parent = parent;
                    Object.keys(element).forEach((prop) => {
                        if (prop === '$type' || prop === '$parent') return;
                        const value = element[prop];
                        if (Array.isArray(value) || (value && typeof value === 'object')) {
                            assignParents(value, element); // 재귀적으로 자식 요소에 대해 부모를 설정합니다.
                        }
                    });
                }
            }
            assignParents(obj, null);
            // flowElements 맵 생성
            const flowElementsMap = new Map();
            obj.rootElements.forEach((rootElement) => {
                if (rootElement.participants) {
                    flowElementsMap.set(rootElement.id, rootElement);
                    rootElement.participants.forEach((part) => {
                        flowElementsMap.set(part.id, part);
                    });
                }
                if (rootElement.flowElements) {
                    rootElement.flowElements.forEach((fe) => {
                        flowElementsMap.set(fe.id, fe);
                    });
                }
                if (rootElement.laneSets) {
                    rootElement.laneSets.forEach((lanes) => {
                        flowElementsMap.set(lanes.id, lanes);
                        lanes.lanes.forEach((fe) => {
                            flowElementsMap.set(fe.id, fe);
                        });
                    });
                }
            });

            // planeElements 내의 bpmnElement 속성 업데이트
            obj.diagrams.forEach((diagram) => {
                const diagramElementObject = flowElementsMap.get(diagram.plane.bpmnElement);
                if (diagramElementObject) {
                    diagram.plane.bpmnElement = diagramElementObject;
                }
                if (diagram.plane && diagram.plane.planeElement) {
                    diagram.plane.planeElement.forEach((pe) => {
                        if (typeof pe.bpmnElement === 'string') {
                            const bpmnElementObject = flowElementsMap.get(pe.bpmnElement);
                            if (bpmnElementObject) {
                                pe.bpmnElement = bpmnElementObject;
                            }
                        }
                        if (pe.bpmnElement.sourceRef && pe.bpmnElement.targetRef) {
                            const sourceRef = flowElementsMap.get(pe.bpmnElement.sourceRef);
                            const targetRef = flowElementsMap.get(pe.bpmnElement.targetRef);
                            pe.bpmnElement.sourceRef = sourceRef;
                            pe.bpmnElement.targetRef = targetRef;
                        }
                    });
                }

                // diagram.plane.planeElement = sortArray
            });

            obj.diagrams[0].plane.planeElement = this.sortByIdWithParticipantFirst(obj.diagrams[0].plane.planeElement)
            console.log(obj)
            this.bpmnViewer.importDefinitions(obj);
        },
        sortByIdWithParticipantFirst(array) {
            return array.sort((a, b) => {
                const aIsParticipant = a.id.toLowerCase().startsWith('participant');
                const bIsParticipant = b.id.toLowerCase().startsWith('participant');

                if (aIsParticipant && !bIsParticipant) {
                    return -1;
                } else if (!aIsParticipant && bIsParticipant) {
                    return 1;
                } else {
                    return a.id.localeCompare(b.id);
                }
            });
        },
        parseJsonToModdle(jsonString) {
            const bpmnModdle = new BpmnModdle();
            // let bpmnModdle = this.bpmnViewer.get('moddle');
            return JSON.parse(jsonString, function reviver(key, value) {
                // $type 속성이 있는 객체만 moddle element로 변환합니다.
                if (value && typeof value === 'object' && value.$type) {
                    return bpmnModdle.create(value.$type, value);
                }
                // $type 속성이 없는 객체나 다른 값들은 변경하지 않고 그대로 반환합니다.
                return value;
            });
        },
        createModdleElement(element) {
            let bpmnModdle = this.bpmnViewer.get('moddle');
            const { $type, ...properties } = element;
            return bpmnModdle.create($type, properties);
        },
        convertToModdleElements(json) {
            const { rootElements, diagrams, ...definitionsProps } = json;

            const convertedRootElements = rootElements.map((rootElement) => {
                const { flowElements, laneSets, ...rootProps } = rootElement;
                const convertedFlowElements = flowElements.map(createModdleElement);
                const convertedLaneSets = laneSets.map((laneSet) => {
                    const { lanes, ...laneSetProps } = laneSet;
                    const convertedLanes = lanes.map(createModdleElement);
                    return createModdleElement({ ...laneSetProps, lanes: convertedLanes });
                });

                return createModdleElement({
                    ...rootProps,
                    flowElements: convertedFlowElements,
                    laneSets: convertedLaneSets
                });
            });

            const convertedDiagrams = diagrams.map((diagram) => {
                const { plane, ...diagramProps } = diagram;
                const { planeElement, ...planeProps } = plane;
                const convertedPlaneElements = planeElement.map(createModdleElement);

                const convertedPlane = createModdleElement({
                    ...planeProps,
                    planeElement: convertedPlaneElements
                });

                return createModdleElement({
                    ...diagramProps,
                    plane: convertedPlane
                });
            });

            return createModdleElement({
                ...definitionsProps,
                rootElements: convertedRootElements,
                diagrams: convertedDiagrams
            });
        },
        fetchDiagram(url) {
            var self = this;

            fetch(url)
                .then((response) => {
                    return response.text();
                })
                .then((text) => {
                    self.diagramXML = text;
                })
                .catch((err) => {
                    self.$emit('error', err);
                });
        }
    }
};
</script>

<style>
.vue-bpmn-diagram-container {
    height: 100%;
    width: 100%;
}

/* 팔레트 커스텀 부분 */
.vue-bpmn-diagram-container .separator{
    display: none;
}

.vue-bpmn-diagram-container .djs-palette {
    width: 610px;
    height: 50px;
    margin-left: 0px;
    background-color: white;
    border: none;
    border-radius: 10px;
    box-shadow: 0 4px 6px 0 rgba(0, 0, 0, 0.1);
}
</style>