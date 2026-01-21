<template>
    <div id="canvas-container" ref="container" class="vue-bpmn-diagram-container" :class="{ 'view-mode': isViewMode, 'not-pal': !isPal }" v-hammer:pan="onPan" v-hammer:pinch="onPinch" :style="{ '--label-font-size': labelFontSize + 'px' }" @dragover.prevent="onDragOver" @drop.prevent="onDrop">
        <!-- <v-btn @click="downloadSvg" color="primary">{{ $t('downloadSvg') }}</v-btn> -->
        <div v-if="isViewMode" :class="isMobile ? 'mobile-position' : 'desktop-position'">
            <div class="pa-1" :class="isMobile ? 'mobile-style' : 'desktop-style'">
                <v-icon @click="resetZoom" style="color: #444; cursor: pointer;">mdi-crosshairs-gps</v-icon>
                <v-icon @click="zoomIn" style="color: #444; cursor: pointer;">mdi-plus</v-icon>
                <span class="zoom-level-value">{{ currentZoomLevel }}%</span>
                <v-icon @click="zoomOut" style="color: #444; cursor: pointer;">mdi-minus</v-icon>
                <v-icon @click="changeOrientation" style="color: #444; cursor: pointer;">mdi-crop-rotate</v-icon>
            </div>
        </div>
        <!-- Font size and zoom controls (edit mode only) -->
        <div v-if="!isViewMode" class="font-size-controls">
            <!-- Extra controls slot (for parent component buttons) -->
            <slot name="extra-controls"></slot>
            <span v-if="$slots['extra-controls']" class="controls-divider">|</span>
            <!-- Font size controls -->
            <v-tooltip location="bottom">
                <template v-slot:activator="{ props }">
                    <v-icon v-bind="props" @click="decreaseFontSize" style="color: #444; cursor: pointer;" size="small">mdi-format-font-size-decrease</v-icon>
                </template>
                <span>{{ $t('BpmnUengine.decreaseFontSize') || 'Decrease Font Size' }}</span>
            </v-tooltip>
            <span class="font-size-value">{{ labelFontSize }}px</span>
            <v-tooltip location="bottom">
                <template v-slot:activator="{ props }">
                    <v-icon v-bind="props" @click="increaseFontSize" style="color: #444; cursor: pointer;" size="small">mdi-format-font-size-increase</v-icon>
                </template>
                <span>{{ $t('BpmnUengine.increaseFontSize') || 'Increase Font Size' }}</span>
            </v-tooltip>
            <span class="controls-divider">|</span>
            <!-- Color Ruleset button -->
            <v-tooltip location="bottom">
                <template v-slot:activator="{ props }">
                    <v-icon v-bind="props" @click="openColorRulesetDialog" style="color: #444; cursor: pointer;" size="small">mdi-palette</v-icon>
                </template>
                <span>Color Ruleset</span>
            </v-tooltip>
            <span class="controls-divider">|</span>
            <!-- Zoom controls -->
            <v-tooltip location="bottom">
                <template v-slot:activator="{ props }">
                    <v-icon v-bind="props" @click="resetZoom" style="color: #444; cursor: pointer;" size="small">mdi-crosshairs-gps</v-icon>
                </template>
                <span>{{ $t('BpmnUengine.resetZoom') || 'Fit to Screen (Ctrl+0)' }}</span>
            </v-tooltip>
            <v-tooltip location="bottom">
                <template v-slot:activator="{ props }">
                    <v-icon v-bind="props" @click="zoomOut" style="color: #444; cursor: pointer;" size="small">mdi-minus</v-icon>
                </template>
                <span>{{ $t('BpmnUengine.zoomOut') || 'Zoom Out (Ctrl+-)' }}</span>
            </v-tooltip>
            <span class="zoom-level-value">{{ currentZoomLevel }}%</span>
            <v-tooltip location="bottom">
                <template v-slot:activator="{ props }">
                    <v-icon v-bind="props" @click="zoomIn" style="color: #444; cursor: pointer;" size="small">mdi-plus</v-icon>
                </template>
                <span>{{ $t('BpmnUengine.zoomIn') || 'Zoom In (Ctrl++)' }}</span>
            </v-tooltip>
        </div>
    </div>
    <v-dialog v-model="isPreviewPDFDialog" max-width="1160px">
        <v-card >
            <v-card-title class="headline">{{ $t('PDFPreviewer.title') }}</v-card-title>
            <PDFPreviewer  :bpmnViewer="bpmnViewer" @closeDialog="closePDFDialog"/>
        </v-card>
    </v-dialog>
    <!-- Color Ruleset Dialog -->
    <ColorRulesetDialog
        v-model="showColorRulesetDialog"
        :initialRules="colorRules"
        @save="onColorRulesSave"
    />
</template>

<script>
import uEngineModdleDescriptor from '@/components/descriptors/uEngine.json';
import zeebeModdleDescriptor from '@/components/descriptors/zeebe.json';
import { useBpmnStore } from '@/stores/bpmn';
import { useTaskCatalogStore } from '@/stores/taskCatalog';
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
import customReplaceModule from './customReplace';
import phaseModdle from '@/assets/bpmn/phase-moddle.json';
import PDFPreviewer from '@/components/BPMNPDFPreviewer.vue';
import ColorRulesetDialog from '@/components/designer/bpmnModeling/bpmn/ColorRulesetDialog.vue';
import '@/components/autoLayout/bpmn-auto-layout.js';
import { markRaw } from 'vue';
import minimapModule from 'diagram-js-minimap';
import 'diagram-js-minimap/assets/diagram-js-minimap.css';
import { getCurrentUserTeamName } from '@/utils/organizationUtils';


const backend = BackendFactory.createBackend();

const
WARNING = 0,
  ERROR = 1;

export default {
    name: 'bpmn-uengine',
    inheritAttrs: false,
    emits: [
        'closePDFDialog',
        'error',
        'shown',
        'openDefinition',
        'loading',
        'openPanel',
        'updateXml',
        'definition',
        'addShape',
        'done',
        'changeElement'
    ],
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
        },
        onLoadStart: {
            type: Function,
            default: () => {
                return () => {
                }
            }
        },
        onLoadEnd: {
            type: Function,
            default: () => {
                return () => {
                }
            }
        }
    },
    components: {
        PDFPreviewer,
        ColorRulesetDialog
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
            panStart: { x: 0, y: 0 },
            pinchStartZoom: 1,
            isHorizontal: false,
            labelFontSize: 12, // Default font size for task labels
            currentZoomLevel: 100, // Current zoom level percentage
            showColorRulesetDialog: false,
            colorRules: [], // Color rules loaded from BPMN XML
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
        },
        isPal() {
            return window.$pal;
        },
    },
    async mounted() {
        this.onLoadStart();
        this.canvasContainer = document.getElementById('canvas-container');

        // Load palette settings before initializing viewer
        await this.loadPaletteSettings();

        this.initializeViewer();
        this.setDiagramEvent();
        if (this.bpmn) {
            this.diagramXML = this.bpmn;
        } else {
            // 사용자 팀명 조회하여 Lane 이름에 사용
            let laneName = 'Lane 1';
            try {
                const teamName = await getCurrentUserTeamName();
                if (teamName) {
                    laneName = teamName;
                }
            } catch (e) {
                console.warn('[BpmnUengine] 팀명 조회 실패, 기본값 사용:', e);
            }

            // Default BPMN with Swimlane (Pool + Lane) and StartEvent -> ManualTask -> EndEvent
            this.diagramXML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" xmlns:uengine="http://uengine" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn" exporter="bpmn-js (https://demo.bpmn.io)" exporterVersion="16.4.0">
  <bpmn:collaboration id="Collaboration_1">
    <bpmn:participant id="Participant_1" name="Process" processRef="Process_1"/>
  </bpmn:collaboration>
  <bpmn:process id="Process_1" isExecutable="false">
    <uengine:ProcessVariables id="ProcessVariables_1">
      <uengine:ProcessVariable key="variable1" value="value1"/>
      <uengine:ProcessVariable key="variable2" value="value2"/>
    </uengine:ProcessVariables>
    <bpmn:laneSet id="LaneSet_1">
      <bpmn:lane id="Lane_1" name="${laneName}">
        <bpmn:flowNodeRef>StartEvent_1</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>ManualTask_1</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>EndEvent_1</bpmn:flowNodeRef>
      </bpmn:lane>
    </bpmn:laneSet>
    <bpmn:startEvent id="StartEvent_1" name="Start">
      <bpmn:outgoing>Flow_1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:manualTask id="ManualTask_1" name="Manual Task">
      <bpmn:incoming>Flow_1</bpmn:incoming>
      <bpmn:outgoing>Flow_2</bpmn:outgoing>
    </bpmn:manualTask>
    <bpmn:endEvent id="EndEvent_1" name="End">
      <bpmn:incoming>Flow_2</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_1" sourceRef="StartEvent_1" targetRef="ManualTask_1"/>
    <bpmn:sequenceFlow id="Flow_2" sourceRef="ManualTask_1" targetRef="EndEvent_1"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Collaboration_1">
      <bpmndi:BPMNShape id="Participant_1_di" bpmnElement="Participant_1" isHorizontal="true">
        <dc:Bounds x="160" y="80" width="600" height="250"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Lane_1_di" bpmnElement="Lane_1" isHorizontal="true">
        <dc:Bounds x="190" y="80" width="570" height="250"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1">
        <dc:Bounds x="232" y="182" width="36" height="36"/>
        <bpmndi:BPMNLabel>
          <dc:Bounds x="238" y="225" width="24" height="14"/>
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="ManualTask_1_di" bpmnElement="ManualTask_1">
        <dc:Bounds x="340" y="160" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="EndEvent_1_di" bpmnElement="EndEvent_1">
        <dc:Bounds x="512" y="182" width="36" height="36"/>
        <bpmndi:BPMNLabel>
          <dc:Bounds x="520" y="225" width="20" height="14"/>
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1">
        <di:waypoint x="268" y="200"/>
        <di:waypoint x="340" y="200"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_2_di" bpmnElement="Flow_2">
        <di:waypoint x="440" y="200"/>
        <di:waypoint x="512" y="200"/>
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;
        }
        // if (this.mode == 'uEngine') {
        this.bpmnViewer.importXML(this.diagramXML);
        this.initResizeObserver();
        // }

        // Add keyboard event listener for Ctrl+C/V/Z/Y
        this._keyboardHandler = this.handleKeyboardShortcuts.bind(this);
        document.addEventListener('keydown', this._keyboardHandler);
    },
    beforeUnmount() {
        // Remove keyboard event listener
        if (this._keyboardHandler) {
            document.removeEventListener('keydown', this._keyboardHandler);
        }
        // Clean up resize observer
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
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
                let self = this;
                if (newVal && Object.keys(newVal).length > 0) {
                    const canvas = this.bpmnViewer.get('canvas');
                    const container = this.canvasContainer;
                    const elementRegistry = this.bpmnViewer.get('elementRegistry');

                    Object.keys(newVal).forEach((activityId) => {
                        const element = elementRegistry.get(activityId);
                        if (!element) return;
                        
                        if (newVal[activityId] === 'generating') {
                            // 보라색 테두리 추가
                            canvas.addMarker(activityId, 'running');
                            
                            // 화면 정중앙에 액티비티 배치
                            const viewbox = canvas.viewbox();
                            const elementMid = {
                                x: element.x + element.width / 2,
                                y: element.y + element.height / 2
                            };

                            // 확대를 100% (zoom = 1.0)로 설정
                            const zoom = 1.0;
                            
                            // viewbox를 element 중심으로 이동
                            canvas.viewbox({
                                x: elementMid.x - (viewbox.outer.width / zoom / 2),
                                y: elementMid.y - (viewbox.outer.height / zoom / 2),
                                width: viewbox.outer.width / zoom,
                                height: viewbox.outer.height / zoom
                            });
                            
                            console.log(`📍 액티비티 "${activityId}" 포커싱 완료 (정중앙, 100% 줌)`);
                        } else if (newVal[activityId] === 'finished') {
                            canvas.addMarker(activityId, 'generated');
                            console.log('✅ 폼 생성 완료');
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
        async loadPaletteSettings() {
            try {
                const catalogStore = useTaskCatalogStore();
                // Load new table-based palette task types
                await catalogStore.loadPaletteTaskTypes();

                // Set enabled palette task types to window for PaletteProvider access
                window.$enabledPaletteTaskTypes = catalogStore.enabledPaletteTaskTypes;

                // Legacy support: also load old palette settings
                await catalogStore.loadPaletteSettings();
                window.$paletteSettings = catalogStore.paletteSettings;
            } catch (error) {
                console.error('Failed to load palette settings:', error);
                // Set default settings
                window.$enabledPaletteTaskTypes = [];
                window.$paletteSettings = { visibleTaskTypes: ['bpmn:ManualTask', 'bpmn:ServiceTask'] };
            }
        },
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
                    palleteProvider.changeParticipantHorizontalToVertical(event, element, self.onLoadStart, self.onLoadEnd);
                    element.di.isHorizontal = false;
                } else {
                    palleteProvider.changeParticipantVerticalToHorizontal(event, element, self.onLoadStart, self.onLoadEnd);
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

            this.isHorizontal = isHorizontal;
            
            participant.forEach(element => {
                const horizontal = element.di.isHorizontal;
                if(isHorizontal && !horizontal) {
                    if(element.width < element.height) {
                        palleteProvider.changeParticipantVerticalToHorizontal(event, element, self.onLoadStart, self.onLoadEnd);
                        self.isHorizontal = true;
                        element.di.isHorizontal = true;
                    }
                } else if(!isHorizontal && horizontal) {
                    if(element.width > element.height) {
                        palleteProvider.changeParticipantHorizontalToVertical(event, element, self.onLoadStart, self.onLoadEnd);
                        self.isHorizontal = false;
                        element.di.isHorizontal = false;
                    }
                }
            });

            // self.resetZoom();
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

                // Load color rules from BPMN and store in window for renderer
                self.$nextTick(() => {
                    const rules = self.loadColorRulesFromBpmn();
                    window.$bpmnColorRules = rules;
                    self.colorRules = rules;
                    // Apply color rules after loading to re-render tasks with correct colors
                    self.$nextTick(() => {
                        self.applyColorRules();
                    });
                });

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

                // 안전한 zoom 함수 - Pool을 화면 중앙에 정렬
                const safeZoom = (retryCount = 0) => {
                    const container = self.$refs.container;
                    const containerWidth = container?.clientWidth || 0;
                    const containerHeight = container?.clientHeight || 0;

                    // 컨테이너 크기가 유효하지 않으면 재시도
                    if (containerWidth <= 0 || containerHeight <= 0) {
                        if (retryCount < 5) {
                            setTimeout(() => safeZoom(retryCount + 1), 100);
                        }
                        return;
                    }

                    try {
                        // 모든 요소의 bounding box 계산
                        let contentBBox;
                        if (allPools.length > 0) {
                            // Pool이 있으면 모든 Pool의 통합 bbox 계산
                            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                            allPools.forEach(pool => {
                                const bbox = canvas.getAbsoluteBBox(pool);
                                if (bbox) {
                                    minX = Math.min(minX, bbox.x);
                                    minY = Math.min(minY, bbox.y);
                                    maxX = Math.max(maxX, bbox.x + bbox.width);
                                    maxY = Math.max(maxY, bbox.y + bbox.height);
                                }
                            });
                            contentBBox = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
                        } else {
                            // Pool이 없으면 전체 요소의 bbox 사용
                            canvas.zoom('fit-viewport');
                            contentBBox = canvas.viewbox();
                        }

                        if (contentBBox && contentBBox.width > 0 && contentBBox.height > 0) {
                            // padding 추가
                            const padding = 50;
                            const contentWidth = contentBBox.width + padding * 2;
                            const contentHeight = contentBBox.height + padding * 2;

                            // 컨테이너 비율에 맞춰 zoom 계산
                            const scaleX = containerWidth / contentWidth;
                            const scaleY = containerHeight / contentHeight;
                            const scale = Math.min(scaleX, scaleY, 1); // 최대 1배율

                            // 중앙 정렬을 위한 viewbox 계산
                            const viewboxWidth = containerWidth / scale;
                            const viewboxHeight = containerHeight / scale;
                            const centerX = contentBBox.x + contentBBox.width / 2;
                            const centerY = contentBBox.y + contentBBox.height / 2;

                            canvas.viewbox({
                                x: centerX - viewboxWidth / 2,
                                y: centerY - viewboxHeight / 2,
                                width: viewboxWidth,
                                height: viewboxHeight
                            });
                        }
                    } catch (e) {
                        // zoom 실패 시 재시도
                        if (retryCount < 5) {
                            setTimeout(() => safeZoom(retryCount + 1), 100);
                        }
                    }
                };

                // DOM 렌더링 후 zoom 실행
                setTimeout(() => safeZoom(), 50);
                // you may hook into any of the following events
                if (self.isViewMode) {
                    const elementRegistry = self.bpmnViewer.get('elementRegistry');
                    const overlays = self.bpmnViewer.get('overlays');

                    const callActivities = elementRegistry.filter(element => element.type === 'bpmn:CallActivity');
                    
                    callActivities.forEach(element => {
                        const businessObject = element.businessObject;
                        if (businessObject.extensionElements && businessObject.extensionElements.values && businessObject.extensionElements.values.length > 0) {
                            const json = businessObject.extensionElements.values[0].json;
                            if (json) {
                                try {
                                    const properties = JSON.parse(json);
                                    if (properties.definitionId) {
                                        const html = document.createElement('div');
                                        html.className = 'call-activity-link-btn';
                                        html.style.cssText = 'cursor: pointer; width: 20px; height: 20px; background: #fff; border-radius: 50%; border: 1px solid #ccc; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1);';
                                        html.innerHTML = '<i class="v-icon notranslate mdi mdi-open-in-new theme--light" style="font-size: 14px; color: #333;"></i>';
                                        
                                        html.addEventListener('click', function(e) {
                                            e.stopPropagation(); // Prevent element selection
                                            window.open(`/definitions/${properties.definitionId.replace('.bpmn', '')}`, '_blank');
                                        });

                                        overlays.add(element.id, {
                                            position: {
                                                top: -10,
                                                right: -10
                                            },
                                            html: html
                                        });
                                    }
                                } catch (err) {
                                    console.error('Failed to parse CallActivity properties', err);
                                }
                            }
                        }
                    });

                    // Use high priority (2000) to handle dblclick before directEditing module
                    // This prevents text from disappearing when directEditing tries to activate
                    eventBus.on('element.dblclick', 2000, function (e) {
                        // Stop propagation to prevent directEditing from activating
                        e.stopPropagation();

                        if (e.element.type.includes('CallActivity')) {
                            self.$emit('openDefinition', e.element.businessObject);
                        } else if (e.element.type.includes('Collaboration')) {
                            const businessObject = e.element.businessObject;
                            if (businessObject.extensionElements && businessObject.extensionElements.values && businessObject.extensionElements.values.length > 0) {
                                const json = businessObject.extensionElements.values[0].json;
                                if (json) {
                                    try {
                                        const properties = JSON.parse(json);
                                        if (properties.definitionId) {
                                            window.open(`/definitions/${properties.definitionId.replace('.bpmn', '')}`, '_blank');
                                        }
                                    } catch (err) {
                                        console.error('Failed to parse CallActivity properties', err);
                                    }
                                }
                            }
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
                        self.$emit('update:isAIGenerated', false); 
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
                var Blocker = function(eventBus, elementRegistry, graphicsFactory) {
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

                    // Fix: Re-render selected elements to prevent text from disappearing
                    // when directEditing is blocked in view mode
                    eventBus.on('selection.changed', function(event) {
                        const newSelection = event.newSelection || [];
                        const oldSelection = event.oldSelection || [];

                        // Re-render newly selected elements after a short delay
                        // to ensure the text is visible after directEditing is blocked
                        setTimeout(() => {
                            newSelection.forEach(element => {
                                if (element && element.type && element.type.includes('Task')) {
                                    try {
                                        const gfx = elementRegistry.getGraphics(element);
                                        if (gfx) {
                                            graphicsFactory.update('shape', element, gfx);
                                        }
                                    } catch (e) {
                                        // Ignore errors
                                    }
                                }
                            });
                        }, 10);
                    });
                }

                Blocker.$inject = ['eventBus', 'elementRegistry', 'graphicsFactory'];
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
                            MoveCanvas,
                            minimapModule
                        ],
                        moddleExtensions: {
                            uengine: uEngineModdleDescriptor,
                            zeebe: zeebeModdleDescriptor,
                            phase: phaseModdle
                        }
                    },
                    self.options
                );
                self.bpmnViewer = markRaw(new BpmnModeler(viewerOptions));
            } else {
                var _options = Object.assign(
                    {
                        container: container,
                        keyboard: {
                            bindTo: window
                        },
                        moddleExtensions: {
                            uengine: uEngineModdleDescriptor,
                            zeebe: zeebeModdleDescriptor,
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
                            customReplaceModule,
                            ZoomScroll,
                            MoveCanvas,
                            minimapModule
                        ]
                    },
                );
                self.bpmnViewer = markRaw(new BpmnModeler(_options));
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
            var zoomScroll = self.bpmnViewer.get('zoomScroll');
            var moveCanvas = self.bpmnViewer.get('MoveCanvas');

            var allPools = elementRegistry.filter(element => element.type === 'bpmn:Participant');

            zoomScroll.reset();

            // ✅ 1) 기본 줌: 캔버스 꽉 채우기
            canvas.zoom('fit-viewport', 'auto');

            // ✅ 2) 줌 제한 핸들러
            canvas._eventBus.on('zoom', function(event) {
                let zoomLevel = event.scale;

                if (zoomLevel < 0.2) {
                    zoomLevel = 0.2;
                } else if (zoomLevel > 2) {
                    zoomLevel = 2;
                }

                canvas.zoom(zoomLevel, {
                    x: canvas._cachedViewbox.inner.width / 2,
                    y: canvas._cachedViewbox.inner.height / 2
                });
            });

            // ✅ 3) 꽉 찬 상태의 bbox 가져오기
            const bbox = canvas.viewbox();

            // ✅ 4) 필요하면 여기서 padding / 이동 조정하고 싶으면 scroll 사용
            // 예: canvas.scroll({ dx: 50, dy: 50 });

            // ✅ 5) zoomScroll, moveCanvas 동기화
            moveCanvas.canvasSize = {
                height: bbox.height,
                width: bbox.width,
                x: bbox.x,
                y: bbox.y
            };
            moveCanvas.scaleOffset = bbox.scale;
            moveCanvas.resetMovedDistance();

            zoomScroll.canvasSize = {
                height: bbox.height,
                width: bbox.width,
                x: bbox.x,
                y: bbox.y
            };
            zoomScroll.scaleOffset = bbox.scale;
            zoomScroll.resetMovedDistance();
            this.updateZoomLevel();
        },
        zoomIn() {
            const zoomScroll = this.bpmnViewer.get('zoomScroll');
            zoomScroll.stepZoom(1);
            this.updateZoomLevel();
        },
        zoomOut() {
            const zoomScroll = this.bpmnViewer.get('zoomScroll');
            zoomScroll.stepZoom(-1);
            this.updateZoomLevel();
        },
        updateZoomLevel() {
            if (this.bpmnViewer) {
                const canvas = this.bpmnViewer.get('canvas');
                this.currentZoomLevel = Math.round(canvas.zoom() * 100);
            }
        },
        setZoomLevel(level) {
            if (this.bpmnViewer) {
                const canvas = this.bpmnViewer.get('canvas');
                canvas.zoom(level / 100, 'auto');
                this.currentZoomLevel = level;
            }
        },
        increaseFontSize() {
            if (this.labelFontSize < 24) {
                this.labelFontSize += 2;
                this.applyFontSize();
            }
        },
        decreaseFontSize() {
            if (this.labelFontSize > 8) {
                this.labelFontSize -= 2;
                this.applyFontSize();
            }
        },
        applyFontSize() {
            // Apply font size to all label text elements while maintaining center position
            const container = this.$refs.container;
            if (!container) return;

            // Handle internal labels (inside tasks, events, etc.)
            const internalTexts = container.querySelectorAll('.djs-element .djs-visual text');
            internalTexts.forEach(textEl => {
                const parentGroup = textEl.closest('.djs-element');
                if (!parentGroup) return;

                // Get the shape dimensions from the rect/polygon in the visual
                const rect = parentGroup.querySelector('.djs-visual rect');
                const polygon = parentGroup.querySelector('.djs-visual polygon');

                let shapeWidth = 0;
                if (rect) {
                    shapeWidth = parseFloat(rect.getAttribute('width')) || 0;
                } else if (polygon) {
                    // For gateway (diamond shape)
                    const bbox = polygon.getBBox();
                    shapeWidth = bbox.width;
                }

                if (shapeWidth > 0) {
                    const centerX = shapeWidth / 2;

                    // Apply font size
                    textEl.style.fontSize = this.labelFontSize + 'px';

                    // Set text-anchor to middle and position at center
                    textEl.setAttribute('text-anchor', 'middle');
                    textEl.setAttribute('x', centerX);

                    // Update all tspan elements
                    const tspans = textEl.querySelectorAll('tspan');
                    tspans.forEach(tspan => {
                        tspan.style.fontSize = this.labelFontSize + 'px';
                        tspan.setAttribute('x', centerX);
                    });
                }
            });

            // Handle external labels (sequence flow labels, etc.)
            const externalLabels = container.querySelectorAll('.djs-label text');
            externalLabels.forEach(textEl => {
                // Just change font size for external labels, keep their position
                textEl.style.fontSize = this.labelFontSize + 'px';

                const tspans = textEl.querySelectorAll('tspan');
                tspans.forEach(tspan => {
                    tspan.style.fontSize = this.labelFontSize + 'px';
                });
            });
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
            if (!container || this.isAIGenerated || !container.getBoundingClientRect) return;

            const { width, height } = container.getBoundingClientRect();

            let isHorizontal = false;
            if(width - 100 > height) {
                this.initDefaultOrientation('horizontal');
                isHorizontal = true;
            } else {
                this.initDefaultOrientation('vertical');
                isHorizontal = false;
            }
            this.EventBus.emit('orientation-changed', {
                isHorizontal: isHorizontal
            });

        },
        onPan(ev) {
            const srcEvent = ev.srcEvent;
            if (srcEvent.pointerType === 'mouse' || srcEvent.type.startsWith('mouse')) {
                return;
            }

            const canvas = this.bpmnViewer.get('canvas');
            
            if (ev.type === 'panstart') {
            const viewbox = canvas.viewbox();
            this.panStart = { x: viewbox.x, y: viewbox.y };
            }

            if (ev.type === 'panmove') {
            const viewbox = canvas.viewbox();
            const scale = viewbox.scale || 1;

            canvas.viewbox({
                x: this.panStart.x - ev.deltaX / scale,
                y: this.panStart.y - ev.deltaY / scale,
                width: viewbox.width,
                height: viewbox.height
            });
            }

            if (ev.type === 'panend') {
            }
            ev.srcEvent.stopPropagation();
            ev.srcEvent.preventDefault();
        },
        handleKeyboardShortcuts(event) {
            // Skip if in view mode or if target is an input element
            if (this.isViewMode) return;

            const target = event.target;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
                return;
            }

            const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
            const modifierKey = isMac ? event.metaKey : event.ctrlKey;

            if (!modifierKey) return;
            if (!this.bpmnViewer) return;

            try {
                const copyPaste = this.bpmnViewer.get('copyPaste');
                const commandStack = this.bpmnViewer.get('commandStack');
                const selection = this.bpmnViewer.get('selection');

                switch (event.key.toLowerCase()) {
                    case 'c':
                        // Copy
                        const selectedElements = selection.get();
                        if (selectedElements.length > 0) {
                            copyPaste.copy(selectedElements);
                        }
                        event.preventDefault();
                        break;
                    case 'v':
                        // Paste
                        copyPaste.paste();
                        event.preventDefault();
                        break;
                    case 'x':
                        // Cut
                        const elementsTocut = selection.get();
                        if (elementsTocut.length > 0) {
                            copyPaste.copy(elementsTocut);
                            const modeling = this.bpmnViewer.get('modeling');
                            modeling.removeElements(elementsTocut);
                        }
                        event.preventDefault();
                        break;
                    case 'z':
                        if (event.shiftKey) {
                            // Redo (Ctrl+Shift+Z)
                            commandStack.redo();
                        } else {
                            // Undo (Ctrl+Z)
                            commandStack.undo();
                        }
                        event.preventDefault();
                        break;
                    case 'y':
                        // Redo (Ctrl+Y)
                        commandStack.redo();
                        event.preventDefault();
                        break;
                    case '=':
                    case '+':
                        // Zoom In (Ctrl+Plus)
                        this.zoomIn();
                        event.preventDefault();
                        break;
                    case '-':
                        // Zoom Out (Ctrl+Minus)
                        this.zoomOut();
                        event.preventDefault();
                        break;
                    case '0':
                        // Reset Zoom (Ctrl+0)
                        this.resetZoom();
                        event.preventDefault();
                        break;
                }
            } catch (e) {
                console.warn('Keyboard shortcut error:', e);
            }
        },
        onPinch(ev) {
            const srcEvent = ev.srcEvent;
            if (srcEvent.pointerType === 'mouse' || srcEvent.type.startsWith('mouse')) {
                return;
            }
            const canvas = this.bpmnViewer.get('canvas');

            if (ev.type === 'pinchstart') {
            this.pinchStartZoom = canvas.zoom();
            }

            if (ev.type === 'pinchmove') {
            const newZoom = this.pinchStartZoom * ev.scale;
            canvas.zoom(newZoom);
            }

            if (ev.type === 'pinchend') {
            }
            ev.srcEvent.stopPropagation();
            ev.srcEvent.preventDefault();
        },
        onDragOver(event) {
            // Enable drop
            event.dataTransfer.dropEffect = 'copy';
        },
        onDrop(event) {
            if (this.isViewMode) return;

            try {
                const data = event.dataTransfer.getData('application/json');
                if (!data) return;

                const parsed = JSON.parse(data);
                if (parsed.type !== 'task-catalog') return;

                const item = parsed.item;
                if (!item) return;

                // Get drop position relative to canvas
                const canvas = this.bpmnViewer.get('canvas');
                const container = this.$refs.container;
                const rect = container.getBoundingClientRect();

                // Convert screen coordinates to canvas coordinates
                const viewbox = canvas.viewbox();
                const x = (event.clientX - rect.left) / viewbox.scale + viewbox.x;
                const y = (event.clientY - rect.top) / viewbox.scale + viewbox.y;

                // Create the task element
                this.createTaskFromCatalog(item, { x, y });
            } catch (error) {
                console.error('Failed to handle drop:', error);
            }
        },
        createTaskFromCatalog(catalogItem, position) {
            if (!this.bpmnViewer) return;

            console.log('=== createTaskFromCatalog ===');
            console.log('catalogItem:', catalogItem);
            console.log('catalogItem.task_type:', catalogItem.task_type);
            console.log('catalogItem.name:', catalogItem.name);
            console.log('catalogItem.properties:', catalogItem.properties);

            const modeling = this.bpmnViewer.get('modeling');
            const elementFactory = this.bpmnViewer.get('elementFactory');
            const elementRegistry = this.bpmnViewer.get('elementRegistry');
            const bpmnFactory = this.bpmnViewer.get('bpmnFactory');

            // Find parent (process or participant)
            let parent = null;
            const participants = elementRegistry.filter(e => e.type === 'bpmn:Participant');
            if (participants.length > 0) {
                // Find which participant contains the drop position
                for (const participant of participants) {
                    if (position.x >= participant.x &&
                        position.x <= participant.x + participant.width &&
                        position.y >= participant.y &&
                        position.y <= participant.y + participant.height) {
                        parent = participant;
                        break;
                    }
                }
                if (!parent) {
                    parent = participants[0];
                }
            } else {
                // No participant, find process
                const processes = elementRegistry.filter(e => e.type === 'bpmn:Process');
                if (processes.length > 0) {
                    parent = processes[0];
                }
            }

            if (!parent) {
                console.warn('No parent element found for task creation');
                return;
            }

            // Determine task type - use stored type from catalog
            let taskType = catalogItem.task_type || 'bpmn:ManualTask';
            // Ensure taskType has bpmn: prefix
            if (!taskType.startsWith('bpmn:')) {
                taskType = 'bpmn:' + taskType;
            }
            console.log('Final taskType:', taskType);

            // Task name - use the name from catalog (original task name)
            const taskName = catalogItem.name || catalogItem.display_name || 'New Task';
            console.log('Task name:', taskName);

            // Create business object for the task with the correct type
            const businessObject = bpmnFactory.create(taskType, {
                name: taskName
            });

            // Create shape with the correct type
            const shape = elementFactory.createShape({
                type: taskType,
                businessObject: businessObject
            });

            // Add shape to canvas
            const createdShape = modeling.createShape(shape, position, parent);
            console.log('Created shape:', createdShape);

            // Prepare extension elements with ALL properties from catalog
            const propertiesJson = {
                ...catalogItem.properties,
                _catalogId: catalogItem.id,
                _systemName: catalogItem.system_name
            };
            console.log('Properties to save:', propertiesJson);

            // Create extension elements
            const extensionElements = bpmnFactory.create('bpmn:ExtensionElements');
            const uengineProperties = bpmnFactory.create('uengine:Properties', {
                json: JSON.stringify(propertiesJson)
            });
            extensionElements.get('values').push(uengineProperties);

            // Use modeling API to properly set the extension elements
            modeling.updateProperties(createdShape, {
                extensionElements: extensionElements
            });

            console.log(`Created ${taskType} from catalog: ${taskName}`);
            console.log('=== createTaskFromCatalog done ===');
        },
        openColorRulesetDialog() {
            // Load rules from BPMN XML before opening dialog
            this.colorRules = this.loadColorRulesFromBpmn();
            console.log('[BpmnUengine] Opening dialog with rules:', this.colorRules);
            this.showColorRulesetDialog = true;
        },
        loadColorRulesFromBpmn() {
            if (!this.bpmnViewer) {
                console.log('[BpmnUengine] loadColorRulesFromBpmn: no bpmnViewer');
                return [];
            }

            try {
                const elementRegistry = this.bpmnViewer.get('elementRegistry');
                const collaboration = elementRegistry.filter(e => e.type === 'bpmn:Collaboration')[0];

                console.log('[BpmnUengine] loadColorRulesFromBpmn: collaboration:', collaboration?.id);

                if (!collaboration || !collaboration.businessObject) {
                    console.log('[BpmnUengine] loadColorRulesFromBpmn: no collaboration or businessObject');
                    return [];
                }

                const businessObject = collaboration.businessObject;
                console.log('[BpmnUengine] loadColorRulesFromBpmn: extensionElements:', businessObject.extensionElements);

                if (!businessObject.extensionElements || !businessObject.extensionElements.values) {
                    console.log('[BpmnUengine] loadColorRulesFromBpmn: no extensionElements');
                    return [];
                }

                const uengineProps = businessObject.extensionElements.values.find(
                    v => v.$type === 'uengine:Properties'
                );

                console.log('[BpmnUengine] loadColorRulesFromBpmn: uengineProps:', uengineProps);

                if (!uengineProps || !uengineProps.json) {
                    console.log('[BpmnUengine] loadColorRulesFromBpmn: no uengineProps or json');
                    return [];
                }

                try {
                    const props = JSON.parse(uengineProps.json);
                    console.log('[BpmnUengine] loadColorRulesFromBpmn: parsed props:', props);
                    console.log('[BpmnUengine] loadColorRulesFromBpmn: colorRules:', props.colorRules);
                    return props.colorRules || [];
                } catch (e) {
                    console.warn('Failed to parse color rules from BPMN:', e);
                    return [];
                }
            } catch (e) {
                console.warn('Failed to load color rules from BPMN:', e);
                return [];
            }
        },
        saveColorRulesToBpmn(rules) {
            console.log('[BpmnUengine] saveColorRulesToBpmn called with rules:', rules);

            if (!this.bpmnViewer) {
                console.log('[BpmnUengine] saveColorRulesToBpmn: no bpmnViewer');
                return;
            }

            try {
                const elementRegistry = this.bpmnViewer.get('elementRegistry');
                const modeling = this.bpmnViewer.get('modeling');
                const bpmnFactory = this.bpmnViewer.get('bpmnFactory');

                const collaboration = elementRegistry.filter(e => e.type === 'bpmn:Collaboration')[0];

                if (!collaboration) {
                    console.warn('[BpmnUengine] saveColorRulesToBpmn: No Collaboration element found');
                    return;
                }

                console.log('[BpmnUengine] saveColorRulesToBpmn: collaboration:', collaboration.id);

                const businessObject = collaboration.businessObject;

                // Get or create extension elements
                let extensionElements = businessObject.extensionElements;
                if (!extensionElements) {
                    console.log('[BpmnUengine] saveColorRulesToBpmn: creating new extensionElements');
                    extensionElements = bpmnFactory.create('bpmn:ExtensionElements');
                    extensionElements.values = [];
                }

                // Find or create uengine:Properties
                let uengineProps = extensionElements.values?.find(
                    v => v.$type === 'uengine:Properties'
                );

                let existingProps = {};
                if (uengineProps && uengineProps.json) {
                    try {
                        existingProps = JSON.parse(uengineProps.json);
                    } catch (e) {
                        // Ignore parse error
                    }
                }

                // Update colorRules in props
                existingProps.colorRules = rules;
                console.log('[BpmnUengine] saveColorRulesToBpmn: existingProps after update:', existingProps);

                if (!uengineProps) {
                    console.log('[BpmnUengine] saveColorRulesToBpmn: creating new uengineProps');
                    uengineProps = bpmnFactory.create('uengine:Properties', {
                        json: JSON.stringify(existingProps)
                    });
                    extensionElements.get('values').push(uengineProps);
                } else {
                    console.log('[BpmnUengine] saveColorRulesToBpmn: updating existing uengineProps');
                    uengineProps.json = JSON.stringify(existingProps);
                }

                // Update the element
                modeling.updateProperties(collaboration, {
                    extensionElements: extensionElements
                });

                console.log('[BpmnUengine] saveColorRulesToBpmn: saved successfully');

                // Store rules in window for renderer access
                window.$bpmnColorRules = rules;

            } catch (e) {
                console.error('Failed to save color rules to BPMN:', e);
            }
        },
        onColorRulesSave(rules) {
            this.colorRules = rules;
            this.saveColorRulesToBpmn(rules);
            this.applyColorRules();
        },
        applyColorRules() {
            if (!this.bpmnViewer) return;

            try {
                const elementRegistry = this.bpmnViewer.get('elementRegistry');
                const graphicsFactory = this.bpmnViewer.get('graphicsFactory');

                // Get all task elements
                const tasks = elementRegistry.filter(e =>
                    e.type && e.type.includes('Task')
                );

                // Re-render each task to apply new colors
                tasks.forEach(task => {
                    const gfx = elementRegistry.getGraphics(task);
                    if (gfx) {
                        graphicsFactory.update('shape', task, gfx);
                    }
                });

            } catch (e) {
                console.error('Failed to apply color rules:', e);
            }
        },
        refreshElement(elementId) {
            if (!this.bpmnViewer) return;

            try {
                const elementRegistry = this.bpmnViewer.get('elementRegistry');
                const graphicsFactory = this.bpmnViewer.get('graphicsFactory');

                const element = elementRegistry.get(elementId);
                if (element) {
                    const gfx = elementRegistry.getGraphics(element);
                    if (gfx) {
                        graphicsFactory.update('shape', element, gfx);
                    }
                }
            } catch (e) {
                console.error('Failed to refresh element:', e);
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

/* View 모드에서 요소 클릭 허용 (Property Panel 열기 위해) */
#canvas-container.view-mode .djs-element,
#canvas-container.view-mode .djs-element * {
  pointer-events: auto !important;
}

/* Font size controls */
.font-size-controls {
  position: absolute;
  top: 16px;
  right: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.95);
  padding: 4px 8px;
  border-radius: 4px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
  z-index: 10;
}

.font-size-value {
  font-size: 12px;
  color: #666;
  min-width: 36px;
  text-align: center;
}

.zoom-level-value {
  font-size: 12px;
  color: #666;
  min-width: 40px;
  text-align: center;
}

.controls-divider {
  color: #ccc;
  margin: 0 4px;
}

/* Dynamic text color for dark backgrounds */
.djs-element[data-dark-bg="true"] text,
.djs-element[data-dark-bg="true"] text tspan {
  fill: #ffffff !important;
}

.djs-element[data-dark-bg="false"] text,
.djs-element[data-dark-bg="false"] text tspan {
  fill: #000000 !important;
}

/* Minimap styling - positioned above BPMN.io logo */
.djs-minimap {
  bottom: 40px !important;
  top: auto !important;
  right: 10px !important;
  left: auto !important;
}

.djs-minimap .toggle {
  width: 32px;
  height: 32px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.djs-minimap .toggle:hover {
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

/* Map icon */
.djs-minimap .toggle::before {
  content: '';
  display: block;
  width: 18px;
  height: 18px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='white' d='M15 5.1L9 3 3 5.02v16.2l6-2.33 6 2.1 6-2.02V2.77L15 5.1zm0 13.79-6-2.11V5.11l6 2.11v11.67z'/%3E%3C/svg%3E");
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
}

.djs-minimap .map {
  border: 1px solid #e8e8e8;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

</style>
