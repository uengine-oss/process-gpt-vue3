<template>
    <div ref="container" class="vue-bpmn-diagram-container" :class="{ 'view-mode': isViewMode }"> 
        <!-- <v-btn @click="downloadSvg" color="primary">{{ $t('downloadSvg') }}</v-btn> -->
        <div v-if="isViewMode" :class="isMobile ? 'mobile-position' : 'desktop-position'">
            <div class="pa-1" :class="isMobile ? 'mobile-style' : 'desktop-style'">
                <v-icon @click="resetZoom" style="color: #444; cursor: pointer;">mdi-crosshairs-gps</v-icon>
                <v-icon @click="zoomIn" style="color: #444; cursor: pointer;">mdi-plus</v-icon>
                <v-icon @click="zoomOut" style="color: #444; cursor: pointer;">mdi-minus</v-icon>
                <v-icon @click="changeOrientation" style="color: #444; cursor: pointer;">mdi-crop-rotate</v-icon>
            </div>
        </div>
    </div>
    <v-dialog v-model="isPreviewPDFDialog" max-width="1160px">
        <v-card >
            <v-card-title class="headline">{{ $t('PDFPreviewer.title') }}</v-card-title>
            <PDFPreviewer  :bpmnViewer="bpmnViewer" @closeDialog="closePDFDialog"/>
        </v-card>
    </v-dialog>
</template>

<script>
import uEngineModdleDescriptor from '@/components/descriptors/uEngine.json';
import { useBpmnStore } from '@/stores/bpmn';
import 'bpmn-js/dist/assets/diagram-js.css';
import BpmnModeler from 'bpmn-js/lib/Modeler';
import BpmnViewer from 'bpmn-js/lib/Viewer';
import BpmnModdle from 'bpmn-moddle';
import ZoomScroll from './customZoomScroll';
// import ZoomScroll from 'diagram-js/lib/navigation/zoomscroll';
import MoveCanvas from './customMoveCanvas';
// import MoveCanvas from 'diagram-js/lib/navigation/movecanvas';
import BackendFactory from '@/components/api/BackendFactory';
import customBpmnModule from './customBpmn';
import customPaletteModule from './customPalette';
import paletteProvider from './customPalette/PaletteProvider';
import customContextPadModule from './customContextPad';
import customReplaceElement from './customReplaceElement';
import customPopupMenu from './customPopupMenu';
import phaseModdle from '@/assets/bpmn/phase-moddle.json';
import PDFPreviewer from '@/components/BPMNPDFPreviewer.vue';
import '@/components/autoLayout/bpmn-auto-layout.js';


const backend = BackendFactory.createBackend();

const
WARNING = 0,
  ERROR = 1;

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
        currentActivities: {
            type: Array
        },
        executionScopeActivities: {
            type: Object
        },
        selectedExecutionScope: {
            type: Object
        },
        generateFormTask: {
            type: Object
        },
        isPreviewPDFDialog: {
            type: Boolean
        },
        isAIGenerated: {
            type: Boolean
        }
    },
    components: {
        PDFPreviewer
    },
    data: function () {
        return {
            diagramXML: null,
            bpmnXML: null,
            openPanel: false,
            moddle: null,
            bpmnStore: null,
            bpmnViewer: null,
            bpmnModeler: null,
            _layoutTimeout: null,
            resizeObserver: null,
            resizeTimeout: null,
        };
    },
    computed: {
        async getXML() {
            let xmlObj = await this.bpmnViewer.saveXML({ format: true, preamble: true });
            return xmlObj.xml;
        },
        mode() {
            return window.$mode;
        },
        isMobile() {
            return window.innerWidth <= 1080;
        }
    },
    mounted() {
        this.initializeViewer();
        this.setDiagramEvent();
        if (this.bpmn) {
            this.diagramXML = this.bpmn;
        } else {
            this.diagramXML = '<?xml version="1.0" encoding="UTF-8"?> <bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:uengine="http://uengine" id="Definitions_0bfky9r" targetNamespace="http://bpmn.io/schema/bpmn" exporter="bpmn-js (https://demo.bpmn.io)" exporterVersion="16.4.0"> <bpmn:process id="Process_1oscmbn" isExecutable="false"> <bpmn:extensionElements> <uengine:properties> </uengine:properties> </bpmn:extensionElements> </bpmn:process> <bpmndi:BPMNDiagram id="BPMNDiagram_1"> <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1oscmbn" /> </bpmndi:BPMNDiagram> </bpmn:definitions>';
        }
        // if (this.mode == 'uEngine') {
        this.bpmnViewer.importXML(this.diagramXML);
        this.initResizeObserver();
        // }
    },
    watch: {
        isViewMode(val) {
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
        generateFormTask: {
            handler(newVal) {
                if (newVal && Object.keys(newVal).length > 0) {
                const canvas = this.bpmnViewer.get('canvas');
                const elementRegistry = this.bpmnViewer.get('elementRegistry');

                Object.keys(newVal).forEach((activityId) => {
                    const element = elementRegistry.get(activityId);

                    if (!element) return; // 존재하지 않는 ID는 무시

                    if (newVal[activityId] === 'generating') {
                        canvas.addMarker(activityId, 'running');
                        canvas.scrollToElement(element);
                    } else if (newVal[activityId] === 'finished') {
                        canvas.addMarker(activityId, 'generated');
                    }
                });
                }
            },
            deep: true
        },
        isPreviewPDFDialog(val) {
            if(!val) {
                this.$emit('closePDFDialog');
            }
        },
    },
    methods: {
        applyAutoLayout() {
            const elementRegistry = this.bpmnViewer.get('elementRegistry');
            const participant = elementRegistry.filter(element => element.type === 'bpmn:Participant');
            const horizontal = participant[0].di.isHorizontal;
            window.BpmnAutoLayout.applyAutoLayout(this.bpmnViewer, { horizontal: horizontal });
        },
        debounce(func, timeout) {
            let timer;
            return (...args) => {
                clearTimeout(timer);
                timer = setTimeout(() => {
                    func.apply(this, args);
                }, timeout);
            };
        },
        downloadSvg() {
            this.saveSVG();
        },
        async validate() {
            let self = this;
            if(!self.bpmnXML) return;
            const validation = await backend.validate(self.bpmnXML);
            const store = useBpmnStore();
            
            var canvas = store.getModeler.get('canvas');
            
            if(validation) {
                Object.keys(validation).forEach((task) => {
                    if(task != "") {
                        const validationList = validation[task];
                        let errorLevel = -1; 
                        validationList.forEach((validation) => {
                            if (validation.errorLevel > errorLevel) {
                                errorLevel = validation.errorLevel;
                            }
                        });
                        canvas.removeMarker(task, 'error');
                        canvas.removeMarker(task, 'warning');

                        if(errorLevel == WARNING) {
                            canvas.addMarker(task, 'warning');
                        } else if(errorLevel == ERROR){
                            canvas.addMarker(task, 'error');
                        }
                    }
                });
            }
            self.$emit('changeElement', self.bpmnXML);
        },
        changeOrientation() {
            var self = this;
            const palleteProvider = self.bpmnViewer.get('paletteProvider');
            const elementRegistry = self.bpmnViewer.get('elementRegistry');
            const participant = elementRegistry.filter(element => element.type === 'bpmn:Participant');
            participant.forEach(element => {
                const horizontal = element.di.isHorizontal;
                if(horizontal) {
                    palleteProvider.changeParticipantHorizontalToVertical(event, element);
                    element.di.isHorizontal = false;
                } else {
                    palleteProvider.changeParticipantVerticalToHorizontal(event, element);
                    element.di.isHorizontal = true;
                }
            });
            self.resetZoom();
        },
        initDefaultOrientation(orientation = null) {
            let self = this;
            const elementRegistry = self.bpmnViewer.get('elementRegistry');
            const participant = elementRegistry.filter(element => element.type === 'bpmn:Participant');
            const palleteProvider = self.bpmnViewer.get('paletteProvider');
            let isHorizontal = false;
            if(self.isMobile) {
                isHorizontal = false;
            } else {
                isHorizontal = true;
            }

            if(orientation) {
                if(orientation === 'horizontal') {
                    isHorizontal = true;
                } else {
                    isHorizontal = false;
                }
            }
            
            participant.forEach(element => {
                const horizontal = element.di.isHorizontal;
                if(isHorizontal && !horizontal) {
                    if(element.width < element.height) {
                        palleteProvider.changeParticipantVerticalToHorizontal(event, element);
                        self.isHorizontal = true;
                        element.di.isHorizontal = true;
                    }
                } else if(!isHorizontal && horizontal) {
                    if(element.width > element.height) {
                        palleteProvider.changeParticipantHorizontalToVertical(event, element);
                        self.isHorizontal = false;
                        element.di.isHorizontal = false;
                    }
                }
            });

            self.resetZoom();
        },
        setDiagramEvent() {
            var self = this;
            var eventBus = this.bpmnViewer.get('eventBus');
            // eventBus.on('import.render.start', function (e) {
            //     // self.openPanel = true;
            //     // console.log("render  complete")
            //     self.$emit('openPanel', e.element.id);
            // });
            eventBus.on('import.done', async function (evt) {
                self.$emit('done');
                
                if(self.bpmn) {
                    self.$nextTick(async () => {
                        const { xml } = await self.bpmnViewer.saveXML({ format: true, preamble: true });
                        self.bpmnXML = xml;
                        self.validate();
                    });
                }
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

                var canvas = self.bpmnViewer.get('canvas');
                var elementRegistry = self.bpmnViewer.get('elementRegistry');
                var allPools = elementRegistry.filter(element => element.type === 'bpmn:Participant');

                if (allPools.length > 1) {
                    var firstPool = allPools[0];
                    var bbox = canvas.getAbsoluteBBox(firstPool);
                    canvas.viewbox({
                        x: bbox.x - 50, // 여백을 위해 약간의 오프셋을 추가
                        y: bbox.y - 100,
                        width: bbox.width + 100,
                        height: bbox.height + 100
                    });
                } else {
                    canvas.zoom('fit-viewport');
                    var viewbox = canvas.viewbox();
                    canvas.viewbox({
                        x: viewbox.x - 50, // 여백을 위해 약간의 오프셋을 추가
                        y: viewbox.y - 100,
                        width: viewbox.width + 100,
                        height: viewbox.height + 100
                    });
                }

                if (self.isPreviewMode) {
                    if (window.$mode == "ProcessGPT") {
                        if (self.currentActivities && self.currentActivities.length > 0) {
                            self.currentActivities.forEach((actId) => {
                                if (actId) canvas.addMarker(actId, 'highlight');
                            });
                        }
                    } 
                }
                eventBus.on('shape.added', async function (event) {
                    const element = event.element;
                    const businessObject = element.businessObject;

                    if (businessObject.extensionElements) {
                        businessObject.extensionElements.values[0].json = '{}';
                    }


                    try {
                        let xml = await self.getXML;
                        // console..log(xml);
                        self.extendUEngineProperties(element);
                    } catch (error) {
                        alert(error);
                    }
                });
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


                
                eventBus.on('commandStack.changed', async function (evt) {
                    console.log('commandStack.changed');
                    if(self.bpmn) {
                        const { xml } = await self.bpmnViewer.saveXML({ format: true, preamble: true });
                        self.bpmnXML = xml;
                        self.validate();
                    }
                });

                // var events = ['element.hover', 'element.out', 'element.click', 'element.dblclick', 'element.mousedown', 'element.mouseup'];
                // events.forEach(function (event) {

                // });
                if(self.isAIGenerated) {
                    if(self._layoutTimeout) {
                        clearTimeout(self._layoutTimeout);
                    }
                    self._layoutTimeout = setTimeout(() => {
                        self.applyAutoLayout();
                    }, 500); // 500ms 안 변하면 실행
                }

                let endTime = performance.now();
                console.log(`initializeViewer Result Time :  ${endTime - startTime} ms`);
            });
        },
        initializeViewer() {
            var container = this.$refs.container;
            var self = this;
            if (self.isViewMode) {
                var Blocker = function(eventBus) {
                    const ignoreEvent = (event) => {
                        event.preventDefault();
                    };

                    eventBus.on('shape.move.start', ignoreEvent);
                    eventBus.on('shape.move.move', ignoreEvent);
                    eventBus.on('shape.move.end', ignoreEvent);

                    eventBus.on('connect.start', ignoreEvent);
                    eventBus.on('connect.move', ignoreEvent);
                    eventBus.on('connect.end', ignoreEvent);

                    eventBus.on('resize.start', ignoreEvent);

                    eventBus.on('dragger.create', ignoreEvent);
                    eventBus.on('preview.move', ignoreEvent);

                    eventBus.on('drag.start', ignoreEvent);
                    eventBus.on('drag.move', ignoreEvent);
                    eventBus.on('drag.end', ignoreEvent);

                    eventBus.on('directEditing.activate', ignoreEvent);
                    eventBus.on('directEditing.deactivate', ignoreEvent);
                    eventBus.on('directEditing.cancel', ignoreEvent);
                }

                Blocker.$inject = ['eventBus'];
                const blockEditingInteractions = {
                    __init__: ['blocker'],
                    blocker: ['type', Blocker]
                };

                var viewerOptions = Object.assign(
                    {
                        container: container,
                        keyboard: {
                            bindTo: window
                        },
                        additionalModules: [
                            customBpmnModule,
                            {
                                __init__: ['paletteProvider'],
                                paletteProvider: ['type', paletteProvider],
                                viewModeFlag: ['value', true] 
                            },
                            {
                                __init__: ['contextPadProvider'],
                                contextPadProvider: ['value', {}]
                            },
                            blockEditingInteractions,
                            ZoomScroll,
                            MoveCanvas
                        ],
                        moddleExtensions: {
                            uengine: uEngineModdleDescriptor,
                            phase: phaseModdle
                        }
                    },
                    self.options
                );
                self.bpmnViewer = new BpmnModeler(viewerOptions);
            } else {
                var _options = Object.assign(
                    {
                        container: container,
                        keyboard: {
                            bindTo: window
                        },
                        moddleExtensions: {
                            uengine: uEngineModdleDescriptor,
                            phase: phaseModdle
                        },
                        additionalModules: [
                            customBpmnModule,
                            {
                                __init__: ['paletteProvider'],
                                paletteProvider: ['type', paletteProvider],
                                viewModeFlag: ['value', false] 
                            },
                            customContextPadModule,
                            customReplaceElement,
                            customPopupMenu,
                            ZoomScroll,
                            MoveCanvas
                        ]
                    },
                );
                self.bpmnViewer = new BpmnModeler(_options);
            }
            
            self.bpmnStore = useBpmnStore();
            self.bpmnStore.setModeler(self.bpmnViewer);
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
        saveSVG() {
            // `bpmnViewer`를 통해 다이어그램을 SVG로 저장
            this.bpmnViewer.saveSVG()
                .then(({ svg }) => {
                    // Blob 객체를 생성하여 SVG 데이터를 파일 형태로 준비
                    const blob = new Blob([svg], { type: 'image/svg+xml' });

                    // Blob을 이용해 다운로드를 트리거
                    const link = document.createElement('a');
                    link.href = URL.createObjectURL(blob);
                    link.download = 'diagram.svg'; // 다운로드 파일명 설정
                    document.body.appendChild(link); // 링크를 문서에 추가
                    link.click(); // 다운로드 트리거
                    document.body.removeChild(link); // 링크 삭제
                })
                .catch((error) => {
                    console.error('SVG 내보내기 실패:', error);
                    alert('SVG 파일을 저장하는 데 실패했습니다. 콘솔을 확인하세요.');
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
        },
        closePDFDialog() {
            this.$emit('closePDFDialog');
        },
        resetZoom() {
            var self = this;
            var canvas = self.bpmnViewer.get('canvas');
            var elementRegistry = self.bpmnViewer.get('elementRegistry');
            var allPools = elementRegistry.filter(element => element.type === 'bpmn:Participant');
            const zoomScroll = self.bpmnViewer.get('zoomScroll');
            const moveCanvas = self.bpmnViewer.get('MoveCanvas');
            zoomScroll.reset();


            canvas._eventBus.on('zoom', function(event) {
                let zoomLevel = event.scale;

                // 줌 범위를 0.2 ~ 2로 제한
                if (zoomLevel < 0.2) {
                    zoomLevel = 0.2;
                } else if (zoomLevel > 2) {
                    zoomLevel = 2;
                }

                // 줌 레벨을 제한된 값으로 설정
                canvas.zoom(zoomLevel, {
                    x: canvas._cachedViewbox.inner.width / 2,
                    y: canvas._cachedViewbox.inner.height / 2
                });
            });

            var x = 0;
            var y = 0;
            var width = 0;
            var height = 0;
                
            if (allPools.length > 1) {
                var firstPool = allPools[0];
                var lastPool = allPools[allPools.length - 1];
                var firstBbox = canvas.getAbsoluteBBox(firstPool);
                var lastBbox = canvas.getAbsoluteBBox(lastPool);
                x = firstBbox.x;
                y = firstBbox.y;
                width = lastBbox.x + lastBbox.width + 100;
                height = lastBbox.y + lastBbox.height + 100;
            } 
            // else if(allPools.length == 1){
            //     var firstPool = allPools[0];
            //     var firstBbox = canvas.getAbsoluteBBox(firstPool);
            //     x = firstBbox.x - 50;
            //     y = firstBbox.y - 50;
            //     width = firstBbox.x + firstBbox.width + 100;
            //     height = firstBbox.y + firstBbox.height + 100;
            // }
             else {
                var viewbox = canvas.viewbox();
                x = viewbox.x - 50;
                y = viewbox.y - 50;
                width = viewbox.x + viewbox.width + 100;
                height = viewbox.y + viewbox.height + 100;
            }

            canvas.viewbox({
                x: x,
                y: y,
                width: width,
                height: height
            });

            
            moveCanvas.canvasSize = {
                height: height,
                width: width,
                x: x,
                y: y
            }
            moveCanvas.scaleOffset = canvas.viewbox().scale;
            moveCanvas.resetMovedDistance();

            zoomScroll.canvasSize = {
                height: height,
                width: width,
                x: x,
                y: y
            }
            zoomScroll.scaleOffset = canvas.viewbox().scale;
            zoomScroll.resetMovedDistance();
        },
        zoomIn() {
            const zoomScroll = this.bpmnViewer.get('zoomScroll');
            zoomScroll.stepZoom(1);
        },
        zoomOut() {
            const zoomScroll = this.bpmnViewer.get('zoomScroll');
            zoomScroll.stepZoom(-1);
        },
        initResizeObserver() {
            const container = this.$refs.container;

            if (!container) return;

            this.resizeObserver = new ResizeObserver(() => {
            if (this.resizeTimeout) clearTimeout(this.resizeTimeout);

            this.resizeTimeout = setTimeout(() => {
                this.onContainerResizeFinished();
            }, 200);
            });

            this.resizeObserver.observe(container);
        },
        onContainerResizeFinished() {
            const container = this.$refs.container;
            if (!container && this.isAIGenerated) return;

            const { width, height } = container.getBoundingClientRect();

            if(width > height) {
                this.initDefaultOrientation('horizontal');
            } else {
                this.initDefaultOrientation('vertical');
            }

        }
    }
};
</script>

<style>

.mobile-position {
    position: absolute;
    top: 4px;
    right: 4px;
    pointer-events: auto;
    z-index: 10;
}
.desktop-position {
    position: absolute;
    top: 16px;
    right: 16px;
    pointer-events: auto;
    z-index: 10;
}
.view-mode .djs-palette {
  display: none !important;
}
</style>
