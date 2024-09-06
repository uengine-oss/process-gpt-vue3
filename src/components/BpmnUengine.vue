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
import ZoomScroll from 'diagram-js/lib/navigation/zoomscroll';
import MoveCanvas from 'diagram-js/lib/navigation/movecanvas';

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
        isPreviewMode: {
            type: Boolean
        },
        adminMode: {
            type: Boolean,
            default: false
        },
        currentActivities: {
            type: Array
        },
        executionScopeActivities: {
            type: Object
        },
        selectedExecutionScope: {
            type: Object
        },
        taskStatus: {
            type: Object
        },
        generateFormTask: {
            type: Object
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
        this.initializeViewer();
        var self = this;
        var eventBus = this.bpmnViewer.get('eventBus');
        // eventBus.on('import.render.start', function (e) {
        //     // self.openPanel = true;
        //     // console.log("render  complete")
        //     self.$emit('openPanel', e.element.id);
        // });
        eventBus.on('import.done', async function (evt) {
            // console.log('import.done');
            self.$emit('done');
        });
        eventBus.on('import.render.complete', async function (event) {
            let startTime = performance.now();
            var error = event.error;
            var warnings = event.warnings;
            let def = self.bpmnViewer.getDefinitions();

            self.$emit('definition', def);
            if (error) {
                self.$emit('error', error);
            } else {
                self.$emit('shown', warnings);
            }

            // console..log(def);
            // self.bpmnViewer.get('canvas').zoom('fit-viewport');
            var canvas = self.bpmnViewer.get('canvas');
            canvas.zoom('fit-viewport');

            if (self.isPreviewMode) {
                if (window.$mode == "ProcessGPT") {
                    if (self.currentActivities && self.currentActivities.length > 0) {
                        self.currentActivities.forEach((actId) => {
                            if (actId) canvas.addMarker(actId, 'highlight');
                        });
                    }
                } 
            }
            
            if (self.isViewMode) {
                if(self.taskStatus) {
                    Object.keys(self.taskStatus).forEach((task) => {
                        let taskStatus = self.taskStatus[task];
                        if(taskStatus == 'Completed') {
                            canvas.addMarker(task, 'completed');
                        } else if(taskStatus == 'Running') {
                            canvas.addMarker(task, 'running');
                        } else if(taskStatus == 'Stopped') {
                            canvas.addMarker(task, 'stopped');
                        } else if(taskStatus == 'Cancelled') {
                            canvas.addMarker(task, 'cancelled');
                        }
                    });
                }
            }

            if (self.adminMode) {
                var overlays = self.bpmnViewer.get('overlays');
                // add marker to current activity elements

                if (self.currentActivities && self.currentActivities.length > 0) {
                    self.currentActivities.forEach((actId) => {
                        const elementRegistry = self.bpmnViewer.get('elementRegistry');
                        const element = elementRegistry.get(actId);
                        if (element.type != 'bpmn:SubProcess' && element.type != 'bpmn:CallActivity') {
                            var overlayHtml = $(
                                `<img src="/assets/images/icon/tdesign-rollback.svg" style="width: 20px; height: 20px;" alt="rollback">`
                            );
                            overlayHtml.click(function (e) {
                                // alert('someone clicked ' + actId);
                                self.$emit('rollback', element);
                            });
                            if (actId)
                                overlays.add(actId, 'note', {
                                    position: {
                                        bottom: 10,
                                        right: 0
                                    },
                                    html: overlayHtml
                                });
                        }
                    });
                }
                if (self.executionScopeActivities && Object.keys(self.executionScopeActivities).length > 0) {
                    Object.keys(self.executionScopeActivities).forEach((activity) => {
                        // console.log(activity);
                        let idx = 0;
                        Object.keys(self.executionScopeActivities[activity]).forEach((executionScope) => {
                            if (self.executionScopeActivities[activity][executionScope].parent) {
                                if (self.selectedExecutionScope) {
                                    if (
                                        self.selectedExecutionScope.executionScope ==
                                        self.executionScopeActivities[activity][executionScope].parent
                                    ) {
                                        let list = `<button class="v-btn v-btn--block v-btn--elevated v-theme--light rounded-xl  v-btn--variant-elevated">${executionScope}</buton>\n`;
                                        let overlayHtml = $(`<div >${list}</div>`);
                                        overlayHtml.click(function (e) {
                                            let obj = {
                                                executionScope: executionScope,
                                                parent: self.executionScopeActivities[activity][executionScope].parent
                                            };
                                            self.$emit('selectedExecutionScope', obj);
                                        });
                                        overlays.add(activity, 'note', {
                                            position: {
                                                bottom: 80 - idx * 30,
                                                right: -10
                                            },
                                            html: overlayHtml
                                        });
                                        idx = idx + 1;
                                    } else if (
                                        self.selectedExecutionScope.parent == self.executionScopeActivities[activity][executionScope].parent
                                    ) {
                                        let list = `<button class="v-btn v-btn--block v-btn--elevated v-theme--light rounded-xl  v-btn--variant-elevated">${executionScope}</buton>\n`;
                                        let overlayHtml = $(`<div >${list}</div>`);
                                        overlayHtml.click(function (e) {
                                            let obj = {
                                                executionScope: executionScope,
                                                parent: self.executionScopeActivities[activity][executionScope].parent
                                            };
                                            self.$emit('selectedExecutionScope', obj);
                                        });
                                        overlays.add(activity, 'note', {
                                            position: {
                                                bottom: 80 - idx * 30,
                                                right: -10
                                            },
                                            html: overlayHtml
                                        });
                                        idx = idx + 1;
                                    }
                                }
                            } else {
                                let list = `<button class="v-btn v-btn--block v-btn--elevated v-theme--light rounded-xl  v-btn--variant-elevated">${executionScope}</buton>\n`;
                                let overlayHtml = $(`<div >${list}</div>`);
                                overlayHtml.click(function (e) {
                                    let obj = {
                                        executionScope: executionScope,
                                        parent: null
                                    };
                                    self.$emit('selectedExecutionScope', obj);
                                });
                                overlays.add(activity, 'note', {
                                    position: {
                                        bottom: 80 - idx * 30,
                                        right: -10
                                    },
                                    html: overlayHtml
                                });
                                idx = idx + 1;
                            }
                        });
                        // var overlayHtml = $(`<div>
                        //     <span>Execution Scope</span>
                        //     <span>Execution Scope</span>
                        //     <span>Execution Scope</span>
                        // </div>`);
                        // obj.executionScopes.split(',').forEach((scope, idx) => {

                        // });
                    });
                }
            }

            // console..log(eventBus);
            eventBus.on('shape.added', async function (event) {
                const element = event.element;
                const businessObject = element.businessObject;
                // console..log(element);
                // console..log(businessObject);
                // 이미 extensionElements가 있는 경우, 초기화 하도록 처리

                if (businessObject.extensionElements) {
                    businessObject.extensionElements.values[0].json = '{}';
                }

                // if (businessObject.$type == 'bpmn:Participant') {
                //     setTimeout(() => {
                //         const modeling = self.bpmnViewer.get('modeling');
                //         const bpmnFactory = self.bpmnViewer.get('bpmnFactory');
                //         const laneSet = bpmnFactory.create('bpmn:LaneSet');
                //         laneSet.children = [];
                //         businessObject.processRef.laneSet = laneSet;
                //         const lane = modeling.addLane(businessObject, false);  
                //     }, 0);
                // }

                try {
                    let xml = await self.getXML;
                    // console..log(xml);
                    self.extendUEngineProperties(element);
                } catch (error) {
                    alert(error);
                }

                // const bpmnFactory = self.bpmnViewer.get('bpmnFactory');
                // console..log(bpmnFactory)
                // const processVariable = self.bpmnViewer.get('moddle').create('uengine:ProcessVariables', {
                //     variables: [
                //         { key: 'variable1', value: 'value1' }
                //     ]
                // });
                // let definitions = self.bpmnViewer.getDefinitions();
                // definitions.get('rootElements').push(processVariable);
            });
            // eventBus.on('shape.changed', function (e) {
            //     self.$emit('changeShape', e.element)
            // })
            // eventBus.on('element.changed', function (e) {
            //     // self.$emit('changeShape', e.element)
            //     // console.log(e)
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
                    if (e.element.type.includes('CallActivity')) {
                        self.$emit('openDefinition', e.element.businessObject);
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

            eventBus.on('drag.end', function (e) {
                self.$nextTick(async () => {
                    self.$emit('change');
                });
            });

            eventBus.on('shape.removed', function (e) {
                self.$nextTick(async () => {
                    self.$emit('change');
                });
            });

            eventBus.on('connection.removed', function (e) {
                self.$nextTick(async () => {
                    self.$emit('change');
                });
            });

            eventBus.on('connection.added', function (e) {
                self.$nextTick(async () => {
                    self.$emit('change');
                });
            });

            eventBus.on('undo', function (e) {
                self.$nextTick(async () => {
                    self.$emit('change');
                });
            });

            eventBus.on('redo', function (e) {
                self.$nextTick(async () => {
                    self.$emit('change');
                });
            });

            self.debounce(() => {
                    self.$emit('change');
                }, 100)

            // var events = ['element.hover', 'element.out', 'element.click', 'element.dblclick', 'element.mousedown', 'element.mouseup'];
            // events.forEach(function (event) {

            // });
            let endTime = performance.now();
            console.log(`initializeViewer Result Time :  ${endTime - startTime} ms`);
        });
        if (this.url) {
            this.fetchDiagram(this.url);
        } else if (this.bpmn) {
            this.diagramXML = this.bpmn;
        } else {
            this.diagramXML =
                '<?xml version="1.0" encoding="UTF-8"?> <bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:uengine="http://uengine" id="Definitions_0bfky9r" targetNamespace="http://bpmn.io/schema/bpmn" exporter="bpmn-js (https://demo.bpmn.io)" exporterVersion="16.4.0"> <bpmn:process id="Process_1oscmbn" isExecutable="false"> <bpmn:extensionElements> <uengine:properties> </uengine:properties> </bpmn:extensionElements> </bpmn:process> <bpmndi:BPMNDiagram id="BPMNDiagram_1"> <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1oscmbn" /> </bpmndi:BPMNDiagram> </bpmn:definitions>';
        }
    },
    beforeDestroy() {
        this.bpmnViewer.destroy();
    },
    watch: {
        isViewMode(val) {
            this.bpmnViewer.destroy();
            this.initializeViewer();
        },
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
            // console..log(val);
            // let obj = '<?xml version="1.0" encoding="UTF-8"?><bpmn2:definitions xmlns:bpmn2="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="Definitions_vacationProcess" targetNamespace="http://bpmn.io/schema/bpmn" exporter="Custom BPMN Modeler" exporterVersion="1.0"><bpmn2:collaboration id="Collaboration_1"><bpmn2:participant id="Participant" name="Participant" processRef="vacationProcess"/></bpmn2:collaboration><bpmn2:process id="vacationProcess" isExecutable="true"><bpmn2:laneSet id="LaneSet_1"><bpmn2:lane id="Lane_worker" name="직원"><bpmn2:flowNodeRef>requestVacation</bpmn2:flowNodeRef><bpmn2:flowNodeRef>returnVacation</bpmn2:flowNodeRef></bpmn2:lane><bpmn2:lane id="Lane_process_manager" name="프로세스 관리자"><bpmn2:flowNodeRef>approveVacation</bpmn2:flowNodeRef></bpmn2:lane></bpmn2:laneSet><bpmn2:userTask id="requestVacation" name="휴가 신청"/><bpmn2:userTask id="approveVacation" name="휴가 승인"/><bpmn2:userTask id="returnVacation" name="휴가 복귀"/><bpmn2:sequenceFlow id="SequenceFlow_requestVacation_approveVacation" sourceRef="requestVacation" targetRef="approveVacation"/><bpmn2:sequenceFlow id="SequenceFlow_approveVacation_returnVacation" sourceRef="approveVacation" targetRef="returnVacation"/></bpmn2:process><bpmndi:BPMNDiagram id="BPMNDiagram_1"><bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Collaboration_1"><bpmndi:BPMNShape id="BPMNShape_Worker" bpmnElement="Lane_worker" isHorizontal="true"><dc:Bounds x="100" y="100" width="600" height="100"/></bpmndi:BPMNShape><bpmndi:BPMNShape id="BPMNShape_Process_Manager" bpmnElement="Lane_process_manager" isHorizontal="true"><dc:Bounds x="100" y="220" width="600" height="100"/></bpmndi:BPMNShape><bpmndi:BPMNShape id="BPMNShape_requestVacation" bpmnElement="requestVacation"><dc:Bounds x="150" y="150" width="80" height="60"/></bpmndi:BPMNShape><bpmndi:BPMNShape id="BPMNShape_approveVacation" bpmnElement="approveVacation"><dc:Bounds x="150" y="230" width="80" height="60"/></bpmndi:BPMNShape><bpmndi:BPMNShape id="BPMNShape_returnVacation" bpmnElement="returnVacation"><dc:Bounds x="150" y="310" width="80" height="60"/></bpmndi:BPMNShape><bpmndi:BPMNEdge id="BPMNEdge_requestVacation_approveVacation" bpmnElement="SequenceFlow_requestVacation_approveVacation"><di:waypoint x="180" y="180"/><di:waypoint x="280" y="180"/></bpmndi:BPMNEdge><bpmndi:BPMNEdge id="BPMNEdge_approveVacation_returnVacation" bpmnElement="SequenceFlow_approveVacation_returnVacation"><di:waypoint x="180" y="180"/><di:waypoint x="280" y="180"/></bpmndi:BPMNEdge></bpmndi:BPMNPlane></bpmndi:BPMNDiagram></bpmn2:definitions>'
            this.bpmnViewer.importXML(val);
        },
        options: {
            handler(val) {
                var eventBus = this.bpmnViewer.get('eventBus');
                var container = this.$refs.container;
                var self = this;

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
                    self.options
                );

                eventBus.fire('config.changed', {
                    config: _options
                });
            },
            deep: true
        },
        generateFormTask: {
            handler(newVal) {
                if (newVal && newVal.length > 0) {
                    var canvas = this.bpmnViewer.get('canvas');
                    newVal.forEach((activityId) => {
                        canvas.addMarker(activityId, 'running');
                    });
                }
            },
            deep: true
        }
    },
    methods: {
        debounce(func, timeout) {
            let timer;
            return (...args) => {
                clearTimeout(timer);
                timer = setTimeout(() => {
                    func.apply(this, args);
                }, timeout);
            };
        },
        initializeViewer() {
            var container = this.$refs.container;
            var self = this;
            self.bpmnStore = useBpmnStore();
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
                self.options
            );

            if (self.isViewMode) {
                var viewerOptions = {
                    ..._options,
                    additionalModules: [
                        ...(Array.isArray(_options.additionalModules) ? _options.additionalModules : []),
                        ZoomScroll,
                        MoveCanvas
                    ]
                };

                self.bpmnViewer = new BpmnViewer(viewerOptions);
                self.bpmnStore.setModeler(self.bpmnViewer);
            } else {
                self.bpmnViewer = new BpmnModeler(_options);
                self.bpmnStore.setModeler(self.bpmnViewer);
            }
            if (self.diagramXML) {
                self.bpmnViewer.importXML(self.diagramXML);
            }
        },
        extendUEngineProperties(businessObject) {
            let self = this;
            //let businessObject = element.businessObject
            if (businessObject?.businessObject?.extensionElements?.values) {
                return;
            }
            if (businessObject.extensionElements?.values) {
                return;
            }

            const bpmnFactory = self.bpmnViewer.get('bpmnFactory');

            const uengineParams = bpmnFactory.create('uengine:Properties', {
                json: ''
            });

            uengineParams.json = '{}';
            // uengineParams.instanceData = [];
            // uengineParams에 checkpoints와 parameters 추가
            // const parameter = bpmnFactory.create('uengine:Parameter', { key: 'param1', category: 'input' });
            // const parameter2 = bpmnFactory.create('uengine:Parameter', { key: 'param2', category: 'input' });
            // uengineParams.ExtendedProperties = [];

            const extensionElements = bpmnFactory.create('bpmn:ExtensionElements');
            extensionElements.get('values').push(uengineParams);

            businessObject.businessObject.extensionElements = extensionElements;

            if (businessObject.businessObject) {
                if (businessObject.businessObject.$type == 'bpmn:Participant') businessObject.businessObject.processRef.isExecutable = true;
            }
        },
        updateElement(element, extensionElements) {
            const modeling = this.bpmnViewer.get('modeling');
            modeling.updateProperties(element, { extensionElements: extensionElements });
        },
        openProcess(e) {
            alert(e);
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
                        if (prop === 'type' || prop === '$parent') return;
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

            obj.diagrams[0].plane.planeElement = this.sortByIdWithParticipantFirst(obj.diagrams[0].plane.planeElement);
            // console.log(obj);
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
                if (value && typeof value === 'object' && value.type) {
                    return bpmnModdle.create(value.type, value);
                }
                // $type 속성이 없는 객체나 다른 값들은 변경하지 않고 그대로 반환합니다.
                return value;
            });
        },
        createModdleElement(element) {
            let bpmnModdle = this.bpmnViewer.get('moddle');
            const { type, ...properties } = element;
            return bpmnModdle.create(type, properties);
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

<style></style>
