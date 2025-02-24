<template>
    <div ref="container" class="vue-bpmn-diagram-container">
        <div style="position: absolute; top: 50px; right: 20px; pointer-events: auto; z-index: 10;">
            <div class="" style="display: flex; flex-direction: column; align-items: flex-end;">
                <v-btn @click="saveAndPreviewSVG" icon>
                    <v-icon>mdi-content-save</v-icon>
                </v-btn>
            </div>
            <div id="svgPreviews" style="margin-top: 0px; display: flex; flex-wrap: wrap;"></div>
        </div>
    </div>
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
import BackendFactory from '@/components/api/BackendFactory';
import phaseModdle from '@/assets/bpmn/phase-moddle.json';
import jsPDF from "jspdf";
import { svg2pdf } from "svg2pdf.js";
import html2canvas from "html2canvas-pro";


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
    },
    data: function () {
        return {
            diagramXML: null,
            bpmnXML: null,
            openPanel: false,
            moddle: null,
            bpmnStore: null,
            bpmnViewer: null
        };
    },
    computed: {
        async getXML() {
            let xmlObj = await this.bpmnViewer.saveXML({ format: true, preamble: true });
            return xmlObj.xml;
        },
        mode() {
            return window.$mode;
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
        if (this.mode == 'uEngine') {
            this.bpmnViewer.importXML(this.diagramXML);
        }
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
                    var canvas = this.bpmnViewer.get('canvas');
                    Object.keys(newVal).forEach((activityId) => {
                        if (newVal[activityId] === 'generating') {
                            canvas.addMarker(activityId, 'running');
                        } else if (newVal[activityId] === 'finished') {
                            canvas.addMarker(activityId, 'generated');
                        }
                    });
                }
            },
            deep: true
        },
        diagramXML(val) {
            if (this.mode == 'ProcessGPT') {
                this.bpmnViewer.importXML(val);
            }
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
            self.$emit('changeElement');
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
                console.log('import.done');
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
                        y: bbox.y - 50,
                        width: bbox.width + 100,
                        height: bbox.height + 100
                    });
                } else {
                    canvas.zoom('fit-viewport');
                    var viewbox = canvas.viewbox();
                    canvas.viewbox({
                        x: viewbox.x - 50, // 여백을 위해 약간의 오프셋을 추가
                        y: viewbox.y - 50,
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
                let endTime = performance.now();
                console.log(`initializeViewer Result Time :  ${endTime - startTime} ms`);
            });
        },
        initializeViewer() {
            var container = this.$refs.container;
            var self = this;
            var _options = Object.assign(
                {
                    container: container,
                    keyboard: {
                        bindTo: window
                    },
                    moddleExtensions: {
                        uengine: uEngineModdleDescriptor,
                        phase: phaseModdle
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
                    ],
                    moddleExtensions: {
                        phase: phaseModdle
                    }
                };

                self.bpmnViewer = new BpmnViewer(viewerOptions);
            } else {
                self.bpmnViewer = new BpmnModeler(_options);
            }
            
            self.bpmnStore = useBpmnStore();
            self.bpmnStore.setModeler(self.bpmnViewer);
            if (self.mode == 'ProcessGPT' && self.bpmn) {
                self.bpmnViewer.importXML(self.bpmn);
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
        saveAndPreviewSVG() {
            let self = this;
            this.bpmnViewer.saveSVG()
                .then(({ svg }) => {
                    // 1. SVG 파싱
                    const parser = new DOMParser();
                    const svgDoc = parser.parseFromString(svg, "image/svg+xml");
                    const svgElement = svgDoc.documentElement;

                    // 2. SVG 크기와 viewBox 가져오기
                    const width = parseFloat(svgElement.getAttribute("width"));
                    const height = parseFloat(svgElement.getAttribute("height"));
                    const [viewBoxX, viewBoxY, viewBoxWidth, viewBoxHeight] = svgElement
                        .getAttribute("viewBox")
                        .split(" ")
                        .map(parseFloat);

                    // 3. 프리뷰용 계산 (화면 표시 기준)
                    const previewCols = 3;
                    const previewRows = 2;
                    const previewPartWidth = width / previewCols;
                    const previewPartHeight = height / previewRows;

                    // 4. 다운로드용 계산 (원본 viewBox 기준)
                    const downloadCols = 3;
                    const downloadRows = 2;
                    const downloadPartWidth = viewBoxWidth / downloadCols;
                    const downloadPartHeight = viewBoxHeight / downloadRows;

                    // 5. 미리보기: 합쳐진 SVG 생성
                    const previewsContainer = document.getElementById("svgPreviews");

                    const namespace = "http://www.w3.org/2000/svg";
                    const combinedSvg = document.createElementNS(namespace, "svg");

                    // 프리뷰 SVG 크기 및 viewBox 설정
                    combinedSvg.setAttribute("width", "100%");
                    combinedSvg.setAttribute("height", "100%");
                    combinedSvg.setAttribute("viewBox", `${0} ${0} ${width} ${height}`);
                    combinedSvg.style.border = "1px solid #ccc";
                    combinedSvg.style.overflow = "hidden";

                    const serializer = new XMLSerializer();

                    // 기존 SVG 콘텐츠 추가
                    const originalContent = svgElement.cloneNode(true);
                    combinedSvg.appendChild(originalContent);

                    // 6. 프리뷰용 분할 영역 라인 표시
                    for (let row = 0; row < previewRows; row++) {
                        for (let col = 0; col < previewCols; col++) {
                            const x = col * previewPartWidth;
                            const y = row * previewPartHeight;

                            const rect = document.createElementNS(namespace, "rect");
                            rect.setAttribute("x", x);
                            rect.setAttribute("y", y);
                            rect.setAttribute("width", previewPartWidth);
                            rect.setAttribute("height", previewPartHeight);
                            rect.setAttribute("fill", "none");
                            rect.setAttribute("stroke", "red");
                            rect.setAttribute("stroke-width", "2");
                            combinedSvg.appendChild(rect);
                        }
                    }

                    // 미리보기 렌더링
                    previewsContainer.appendChild(combinedSvg);

                    // 7. 다운로드용 분할된 SVG 생성
                    const blobs = [];
                    const splitSvgs = [];

                    for (let row = 0; row < downloadRows; row++) {
                        for (let col = 0; col < downloadCols; col++) {
                            const x = viewBoxX + col * downloadPartWidth;
                            const y = viewBoxY + row * downloadPartHeight;

                            // 분할된 SVG 생성
                            const splitSvg = document.createElementNS(namespace, "svg");
                            splitSvg.setAttribute("xmlns", namespace);
                            splitSvg.setAttribute("width", downloadPartWidth);
                            splitSvg.setAttribute("height", downloadPartHeight);
                            splitSvg.setAttribute("viewBox", `${x} ${y} ${downloadPartWidth} ${downloadPartHeight}`);

                            // 기존 콘텐츠 복사 및 추가
                            const clonedContent = svgElement.cloneNode(true);
                            while (clonedContent.firstChild) {
                                splitSvg.appendChild(clonedContent.firstChild);
                            }

                            const splitSvgString = serializer.serializeToString(splitSvg);
                            const blob = new Blob([splitSvgString], { type: "image/svg+xml" });
                            blobs.push(blob);
                            splitSvgs.push(splitSvg); // PDF 삽입용 SVG 저장
                        }
                    }
                    // 8. "모든 분할된 파일 다운로드" 버튼 추가
                    const downloadSvgButton = document.createElement("button");
                    downloadSvgButton.textContent = "SVG를 한 파일로 다운로드 ";
                    downloadSvgButton.style.display = "block";
                    downloadSvgButton.style.marginTop = "20px";
                    downloadSvgButton.onclick = () => {
                        self.saveSVG();
                    };

                    previewsContainer.appendChild(downloadSvgButton);

                    // 9. "모든 분할된 파일 다운로드" 버튼 추가
                    const downloadButton = document.createElement("button");
                    downloadButton.textContent = "SVG 다운로드";
                    downloadButton.style.display = "block";
                    downloadButton.style.marginTop = "20px";
                    downloadButton.onclick = () => {
                        blobs.forEach((blob, index) => {
                            const link = document.createElement("a");
                            link.href = URL.createObjectURL(blob);
                            link.download = `diagram_part_${Math.floor(index / downloadCols)}_${index % downloadCols}.svg`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                        });
                    };

                    previewsContainer.appendChild(downloadButton);

                    // 📌 PDF 다운로드 버튼 추가
                    const pdfButton = document.createElement("button");
                    pdfButton.textContent = "PDF 다운로드";
                    pdfButton.style.display = "block";
                    pdfButton.style.marginTop = "20px";
                    document.body.appendChild(pdfButton);

                    // 📌 PDF 변환 로직
                    pdfButton.onclick = async () => {
                        console.log("📄 PDF 변환 시작...");

                        const pdf = new jsPDF({
                            orientation: "landscape",
                            unit: "pt",
                            format: [downloadPartWidth, downloadPartHeight],
                        });

                        pdf.setFont("bpmn");

                        let imagePromises = splitSvgs.map((splitSvg, index) => {
                            return new Promise((resolve, reject) => {
                                // 🌟 SVG → Blob 변환
                                const serializer = new XMLSerializer();
                                const svgString = serializer.serializeToString(splitSvg);
                                const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
                                const url = URL.createObjectURL(blob);

                                // 🌟 Blob → Image 변환
                                const img = new Image();
                                img.onload = () => {
                                    // 🌟 Canvas 생성 후 이미지 변환
                                    const canvas = document.createElement("canvas");
                                    canvas.width = downloadPartWidth;
                                    canvas.height = downloadPartHeight;
                                    const ctx = canvas.getContext("2d");

                                    ctx.drawImage(img, 0, 0, downloadPartWidth, downloadPartHeight);
                                    const imgData = canvas.toDataURL("image/png");

                                    if (index !== 0) {
                                        pdf.addPage([downloadPartWidth, downloadPartHeight]);
                                    }

                                    pdf.addImage(imgData, "PNG", 0, 0, downloadPartWidth, downloadPartHeight);

                                    // ✅ 메모리 해제
                                    URL.revokeObjectURL(url);
                                    resolve();
                                };

                                img.onerror = (error) => {
                                    console.error("❌ SVG → Image 변환 실패:", error);
                                    reject(error);
                                };

                                img.src = url;
                            });
                        });

                        // 📌 모든 이미지 변환 완료 후 PDF 저장
                        Promise.all(imagePromises).then(() => {
                            pdf.save("split_diagram.pdf");
                            console.log("✅ PDF 저장 완료!");
                        }).catch(error => {
                            console.error("❌ PDF 변환 전체 과정 중 오류 발생:", error);
                        });
                    };


                    // 10. 프리뷰 접기 버튼 추가
                    const collapseButton = document.createElement("button");
                    collapseButton.textContent = "프리뷰 접기";
                    collapseButton.style.display = "block";
                    collapseButton.style.marginTop = "20px";
                    collapseButton.onclick = () => {
                        while (previewsContainer.firstChild) {
                            previewsContainer.removeChild(previewsContainer.firstChild);
                        }
                        collapseButton.textContent = "프리뷰 접기";
                    };


                    previewsContainer.appendChild(pdfButton);
                    previewsContainer.appendChild(collapseButton);
                })
                .catch((error) => {
                    console.error("SVG 내보내기 중 오류 발생:", error);
                    alert("SVG 분할 및 다운로드에 실패했습니다.");
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
