<template>
    <!-- <div> -->
    <div ref="container" class="vue-bpmn-diagram-container"></div>
    <!-- </div> -->
</template>

<script>
import uEngineModdleDescriptor from '@/components/descriptors/uEngine.json';
import { useBpmnStore } from '@/stores/bpmn';
import 'bpmn-js/dist/assets/diagram-js.css';
import BpmnModeler from 'bpmn-js/lib/Modeler';
import BpmnViewer from 'bpmn-js/lib/Viewer';
import BpmnModdle from 'bpmn-moddle';
import { createApp } from 'vue';
export default {
    name: 'bpmn-uengine',
    props: {
        url: {
            type: String
        },
        bpmn: {
            type: String
        },
        options: {
            type: Object
        },
        isViewMode: {
            type: Boolean
        },
        currentActivities: {
            type: Array
        }
    },
    data: function () {
        return {
            diagramXML: null,
            openPanel: false,
            moddle: null,
            bpmnStore: null,
            bpmnViewer: null
        };
    },
    computed: {
        async getXML() {
            let xml = await this.bpmnViewer.saveXML({ format: true, preamble: true });
            return xml;
        }
    },
    mounted() {
        var container = this.$refs.container;

        var self = this;
        this.bpmnStore = useBpmnStore();
        var _options = Object.assign(
            {
                container: container,
                keyboard: {
                    bindTo: window
                },
                moddleExtensions: {
                    uengine: uEngineModdleDescriptor
                }
            },
            this.options
        );

        if (self.isViewMode) {
            self.bpmnViewer = new BpmnViewer(_options);
            self.bpmnStore.setModeler(self.bpmnViewer)
        } else {
            self.bpmnViewer = new BpmnModeler(_options); //new BpmnJS(_options);  //
            self.bpmnStore.setModeler(self.bpmnViewer)
        }

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

            console.log(def)
            // self.bpmnViewer.get('canvas').zoom('fit-viewport');
            var canvas = self.bpmnViewer.get('canvas');
            canvas.zoom('fit-viewport');

            if (self.isViewMode) {
                // add marker to current activity elements
                if (self.currentActivities && self.currentActivities.length > 0) {
                    self.currentActivities.forEach(actId => {
                        if (actId) canvas.addMarker(actId, 'highlight')
                    })
                }
            }
            console.log(eventBus)
            eventBus.on('shape.added', async function (event) {
                const element = event.element;
                const businessObject = element.businessObject;
                console.log(element)
                console.log(businessObject)
                // 이미 extensionElements가 있는 경우, 추가 작업을 수행하지 않음
                if (businessObject.extensionElements) {
                    return;
                }

                let xml = await self.getXML
                console.log(xml)
                self.extendUEngineProperties(element)

                // const bpmnFactory = self.bpmnViewer.get('bpmnFactory');
                // console.log(bpmnFactory)
                const processVariable = this.bpmnViewer.get('moddle').create('uengine:ProcessVariables', {
                    variables: [
                        { key: 'variable1', value: 'value1' }
                    ]
                });
                let definitions = self.bpmnViewer.getDefinitions();
                definitions.get('rootElements').push(processVariable);


            })
            // eventBus.on('shape.changed', function (e) {
            //     self.$emit('changeShape', e.element)
            // })
            // eventBus.on('connection.changed', function (e) {
            //     self.$emit('changeSequence', e.element)
            // })
            // eventBus.on('shape.removed', async function (e) {
            //     self.$emit('removeShape', e.element)
            // });
            // you may hook into any of the following events
            if (self.isViewMode) {
                eventBus.on('element.dblclick', function (e) {
                    // self.openPanel = true;
                    if (e.element.type.includes("CallActivity")) {
                        self.$emit('openDefinition', e.element.businessObject)
                    } else {
                        self.$emit('openPanel', e.element.id);
                    }
                });
            } else {
                eventBus.on('element.dblclick', function (e) {
                    // self.openPanel = true;
                    self.$emit('openPanel', e.element.id);
                });
            }


            // var events = ['element.hover', 'element.out', 'element.click', 'element.dblclick', 'element.mousedown', 'element.mouseup'];
            // events.forEach(function (event) {

            // });

        });
        if (this.url) {
            this.fetchDiagram(this.url);
        } else if (this.bpmn) {
            this.diagramXML = this.bpmn;
        } else {
            this.diagramXML = '<?xml version="1.0" encoding="UTF-8"?> <bpmn2:definitions xmlns:bpmn2="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" xmlns:uengine="http://uengine" id="Definitions_vacation_management" targetNamespace="http://bpmn.io/schema/bpmn" exporter="Custom BPMN Modeler" exporterVersion="1.0"> <bpmn2:collaboration id="Collaboration_1"> <bpmn2:participant id="Participant" name="Participant" processRef="vacation_management" /> </bpmn2:collaboration> <bpmn2:process id="vacation_management" isExecutable="true"> <bpmn2:extensionElements> <uengine:data> <uengine:variable name="symptom" type="string" /> <uengine:variable name="troubleType" type="string" /> <!-- troubleType 변수 추가 --> </uengine:data> </bpmn2:extensionElements> <bpmn2:laneSet id="LaneSet_1"> <bpmn2:lane id="Lane_0" name="직원"> <bpmn2:flowNodeRef>apply_vacation</bpmn2:flowNodeRef> <bpmn2:flowNodeRef>email_notification</bpmn2:flowNodeRef> <bpmn2:flowNodeRef>return_vacation</bpmn2:flowNodeRef> </bpmn2:lane> <bpmn2:lane id="Lane_1" name="관리자"> <bpmn2:flowNodeRef>approve_vacation</bpmn2:flowNodeRef> </bpmn2:lane> </bpmn2:laneSet> <bpmn2:sequenceFlow id="SequenceFlow_apply_vacation_approve_vacation" name="" sourceRef="apply_vacation" targetRef="approve_vacation"> <bpmn2:extensionElements description=""> <uengine:properties> <uengine:json> { "role": {"name": "initiator"}, "parameters": [ {"argument":{"text":"symptom"}, "variable":{"name": "symptom"}, "direction": "OUT"}, {"argument":{"text":"troubleType"}, "variable":{"name": "troubleType"}, "direction": "OUT"} <!-- troubleType 입력 추가 --> ] } </uengine:json> </uengine:properties> </bpmn2:extensionElements> </bpmn2:sequenceFlow> <bpmn2:sequenceFlow id="SequenceFlow_approve_vacation_email_notification" name="" sourceRef="approve_vacation" targetRef="email_notification"> <bpmn2:extensionElements description=""> <uengine:properties> <uengine:json> { "role": {"name": "initiator"}, "parameters": [ {"argument":{"text":"symptom"}, "variable":{"name": "symptom"}, "direction": "OUT"}, {"argument":{"text":"troubleType"}, "variable":{"name": "troubleType"}, "direction": "OUT"} <!-- troubleType 입력 추가 --> ] } </uengine:json> </uengine:properties> </bpmn2:extensionElements> </bpmn2:sequenceFlow> <bpmn2:sequenceFlow id="SequenceFlow_email_notification_return_vacation" name="" sourceRef="email_notification" targetRef="return_vacation"> <bpmn2:extensionElements description=""> <uengine:properties> <uengine:json> { "role": {"name": "initiator"}, "parameters": [ {"argument":{"text":"symptom"}, "variable":{"name": "symptom"}, "direction": "OUT"}, {"argument":{"text":"troubleType"}, "variable":{"name": "troubleType"}, "direction": "OUT"} <!-- troubleType 입력 추가 --> ] } </uengine:json> </uengine:properties> </bpmn2:extensionElements> </bpmn2:sequenceFlow> <bpmn2:startEvent id="StartEvent_1" name="StartEvent" /> <bpmn2:sequenceFlow id="SequenceFlow_StartEvent_apply_vacation" name="" sourceRef="StartEvent_1" targetRef="apply_vacation"> <bpmn2:extensionElements> <uengine:properties> <uengine:json> { "role": {"name": "initiator"}, "parameters": [ {"argument":{"text":"symptom"}, "variable":{"name": "symptom"}, "direction": "OUT"}, {"argument":{"text":"troubleType"}, "variable":{"name": "troubleType"}, "direction": "OUT"} <!-- troubleType 입력 추가 --> ] } </uengine:json> </uengine:properties> </bpmn2:extensionElements> </bpmn2:sequenceFlow> <bpmn2:userTask id="apply_vacation" name="휴가 신청"> <bpmn2:outgoing>SequenceFlow_apply_vacation_approve_vacation</bpmn2:outgoing> <bpmn2:extensionElements> <uengine:properties> <uengine:json> { "role": {"name": "initiator"}, "parameters": [ {"argument":{"text":"symptom"}, "variable":{"name": "symptom"}, "direction": "OUT"}, {"argument":{"text":"troubleType"}, "variable":{"name": "troubleType"}, "direction": "OUT"} <!-- troubleType 입력 추가 --> ] } </uengine:json> </uengine:properties> </bpmn2:extensionElements> <bpmn2:incoming>SequenceFlow_StartEvent_apply_vacation</bpmn2:incoming> </bpmn2:userTask> <bpmn2:userTask id="approve_vacation" name="휴가 승인"> <bpmn2:outgoing>SequenceFlow_approve_vacation_email_notification</bpmn2:outgoing> <bpmn2:incoming>SequenceFlow_apply_vacation_approve_vacation</bpmn2:incoming> <bpmn2:extensionElements> <uengine:uengine-params role="관리자" description="관리자가 휴가를 승인하는 활동입니다."> <uengine:checkpoints> <uengine:checkpoint checkpoint="휴가 잔여 일 수 확인" /> </uengine:checkpoints> <uengine:parameters /> </uengine:uengine-params> </bpmn2:extensionElements> </bpmn2:userTask> <bpmn2:scriptTask id="email_notification" name="메일 발송"> <bpmn2:outgoing>SequenceFlow_email_notification_return_vacation</bpmn2:outgoing> <bpmn2:incoming>SequenceFlow_approve_vacation_email_notification</bpmn2:incoming> <bpmn2:extensionElements> <uengine:properties> <uengine:json> { "role": {"name": "initiator"}, "parameters": [ {"argument":{"text":"symptom"}, "variable":{"name": "symptom"}, "direction": "OUT"}, {"argument":{"text":"troubleType"}, "variable":{"name": "troubleType"}, "direction": "OUT"} <!-- troubleType 입력 추가 --> ] } </uengine:json> </uengine:properties> </bpmn2:extensionElements> </bpmn2:scriptTask> <bpmn2:endEvent id="EndEvent" name="EndEvent" /> <bpmn2:sequenceFlow id="SequenceFlow_return_vacation_EndEvent" name="" sourceRef="return_vacation" targetRef="EndEvent"> <bpmn2:extensionElements> <uengine:properties> <uengine:json> { "role": {"name": "initiator"}, "parameters": [ {"argument":{"text":"symptom"}, "variable":{"name": "symptom"}, "direction": "OUT"}, {"argument":{"text":"troubleType"}, "variable":{"name": "troubleType"}, "direction": "OUT"} <!-- troubleType 입력 추가 --> ] } </uengine:json> </uengine:properties> </bpmn2:extensionElements> </bpmn2:sequenceFlow> <bpmn2:userTask id="return_vacation" name="휴가 복귀"> <bpmn2:incoming>SequenceFlow_email_notification_return_vacation</bpmn2:incoming> <bpmn2:extensionElements> <uengine:properties> <uengine:json> { "role": {"name": "initiator"}, "parameters": [ {"argument":{"text":"symptom"}, "variable":{"name": "symptom"}, "direction": "OUT"}, {"argument":{"text":"troubleType"}, "variable":{"name": "troubleType"}, "direction": "OUT"} <!-- troubleType 입력 추가 --> ] } </uengine:json> </uengine:properties> </bpmn2:extensionElements> <bpmn2:outgoing>SequenceFlow_return_vacation_EndEvent</bpmn2:outgoing> </bpmn2:userTask> </bpmn2:process> <bpmndi:BPMNDiagram id="BPMNDiagram_1"> <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Collaboration_1"> <bpmndi:BPMNShape id="BPMNShape_0" bpmnElement="Lane_0" isHorizontal="true"> <dc:Bounds x="100" y="100" width="600" height="100" /> </bpmndi:BPMNShape> <bpmndi:BPMNShape id="BPMNShape_1" bpmnElement="Lane_1" isHorizontal="true"> <dc:Bounds x="100" y="200" width="600" height="100" /> </bpmndi:BPMNShape> <bpmndi:BPMNShape id="StartEvent_di" bpmnElement="StartEvent_1"> <dc:Bounds x="140" y="136" width="36" height="36" /> </bpmndi:BPMNShape> <bpmndi:BPMNShape id="BPMNShape_apply_vacation" bpmnElement="apply_vacation"> <dc:Bounds x="260" y="120" width="80" height="60" /> </bpmndi:BPMNShape> <bpmndi:BPMNShape id="BPMNShape_approve_vacation" bpmnElement="approve_vacation"> <dc:Bounds x="380" y="220" width="80" height="60" /> </bpmndi:BPMNShape> <bpmndi:BPMNShape id="BPMNShape_email_notification" bpmnElement="email_notification"> <dc:Bounds x="500" y="120" width="80" height="60" /> </bpmndi:BPMNShape> <bpmndi:BPMNShape id="BPMNShape_return_vacation" bpmnElement="return_vacation"> <dc:Bounds x="620" y="120" width="80" height="60" /> </bpmndi:BPMNShape> <bpmndi:BPMNShape id="EndEvent_di" bpmnElement="EndEvent"> <dc:Bounds x="740" y="136" width="36" height="36" /> </bpmndi:BPMNShape> <bpmndi:BPMNEdge id="BPMNEdge_StartEvent_apply_vacation" bpmnElement="SequenceFlow_StartEvent_apply_vacation"> <di:waypoint x="176" y="154" /> <di:waypoint x="260" y="150" /> </bpmndi:BPMNEdge> <bpmndi:BPMNEdge id="BPMNEdge_return_vacation_EndEvent" bpmnElement="SequenceFlow_return_vacation_EndEvent"> <di:waypoint x="700" y="150" /> <di:waypoint x="740" y="154" /> </bpmndi:BPMNEdge> <bpmndi:BPMNEdge id="BPMNEdge_apply_vacation_approve_vacation" bpmnElement="SequenceFlow_apply_vacation_approve_vacation"> <di:waypoint x="340" y="150" /> <di:waypoint x="380" y="250" /> </bpmndi:BPMNEdge> <bpmndi:BPMNEdge id="BPMNEdge_approve_vacation_email_notification" bpmnElement="SequenceFlow_approve_vacation_email_notification"> <di:waypoint x="460" y="250" /> <di:waypoint x="500" y="150" /> </bpmndi:BPMNEdge> <bpmndi:BPMNEdge id="BPMNEdge_email_notification_return_vacation" bpmnElement="SequenceFlow_email_notification_return_vacation"> <di:waypoint x="580" y="150" /> <di:waypoint x="620" y="150" /> </bpmndi:BPMNEdge> </bpmndi:BPMNPlane> </bpmndi:BPMNDiagram> </bpmn2:definitions>'
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
        extendUEngineProperties(businessObject) {
            let self = this
            //let businessObject = element.businessObject

            if (businessObject.extensionElements?.values) {
                return;
            }

            const bpmnFactory = self.bpmnViewer.get('bpmnFactory');

            const uengineParams = bpmnFactory.create('uengine:Properties', {
                role: '',
                pythonCode: '',
                description: '',
                definition: ''
            });

            uengineParams.checkpoints = [];
            uengineParams.instanceData = [];
            // uengineParams에 checkpoints와 parameters 추가
            // const parameter = bpmnFactory.create('uengine:Parameter', { key: 'param1', category: 'input' });
            // const parameter2 = bpmnFactory.create('uengine:Parameter', { key: 'param2', category: 'input' });
            uengineParams.ExtendedProperties = [];

            const extensionElements = bpmnFactory.create('bpmn:ExtensionElements');
            extensionElements.get('values').push(uengineParams);

            businessObject.extensionElements = extensionElements;


            //TODO: 불필요
            // 요소 업데이트를 위해 모델링 컴포넌트 사용
            // setTimeout(async () => {
            //     const modeling = self.bpmnViewer.get('modeling');
            //     modeling.updateProperties(businessObject, { extensionElements: extensionElements });
            //     let xml = await self.bpmnViewer.saveXML({ format: true, preamble: true });
            //     console.log(xml)
            // }, 0);

        },
        updateElement(element, extensionElements) {
            const modeling = this.bpmnViewer.get('modeling');
            modeling.updateProperties(element, { extensionElements: extensionElements });
        },
        openProcess(e) {
            alert(e)
        },
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

.highlight:not(.djs-connection) .djs-visual> :nth-child(1) {
    stroke-width: 2px !important;
    stroke: #5140bd !important;
    fill: #5140bd !important;
}

.highlight:not(.djs-connection) .djs-visual> :nth-child(2) {
    fill: #ffffff !important;
}

/* 팔레트 커스텀 부분 */
.vue-bpmn-diagram-container .separator {
    display: none;
}

/* .vue-bpmn-diagram-container .djs-direct-editing-parent {
    width:80px !important;
    height:60px !important;
} */

.vue-bpmn-diagram-container .djs-palette {
    width: 630px !important;
    height: 50px;
    margin-left: 0px;
    background-color: white;
    border: none;
    border-radius: 10px;
    box-shadow: 0 4px 6px 0 rgba(0, 0, 0, 0.1);
}

.vue-bpmn-diagram-container .djs-context-pad .entry {
    width: 30px;
    height: 30px;
    /* border: solid 1px rgba(124, 124, 124, 0.3); */
    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.7);
}

.vue-bpmn-diagram-container .djs-context-pad .group {
    min-width: 100px;
}

@media only screen and (max-width:800px) {
    .vue-bpmn-diagram-container .djs-palette {
        width: 325px !important;
        height: 94px !important;
    }
}
</style>
