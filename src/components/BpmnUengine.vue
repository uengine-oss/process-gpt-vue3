<template>
    <div id="canvas-container" ref="container" class="vue-bpmn-diagram-container" :class="{ 'view-mode': isViewMode, 'not-pal': !isPal, 'mini-preview': isPreviewMode }" v-hammer:pan="onPan" v-hammer:pinch="onPinch" :style="{ '--label-font-size': labelFontSize + 'px' }" @dragover.prevent="onDragOver" @drop.prevent="onDrop" @contextmenu.prevent="onContextMenu">
        <!-- <v-btn @click="downloadSvg" color="primary">{{ $t('downloadSvg') }}</v-btn> -->
        <div v-if="isViewMode && !isPreviewMode" :class="isMobile ? 'mobile-position' : 'desktop-position'">
            <div class="pa-1" :class="isMobile ? 'mobile-style' : 'desktop-style'">
                <v-icon @click="resetZoom" style="color: #444; cursor: pointer;">mdi-crosshairs-gps</v-icon>
                <v-icon @click="zoomIn" style="color: #444; cursor: pointer;">mdi-plus</v-icon>
                <span class="zoom-level-value">{{ currentZoomLevel }}%</span>
                <v-icon @click="zoomOut" style="color: #444; cursor: pointer;">mdi-minus</v-icon>
                <v-icon v-if="!isPalUengine" @click="changeOrientation" style="color: #444; cursor: pointer;">mdi-crop-rotate</v-icon>
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
// skt 마이그레이션 요소 변경 비활성화
// import customReplaceModule from './customReplace';
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
        'addComment',
        'updateXml',
        'definition',
        'addShape',
        'done',
        'changeElement',
        'multiSelect'
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
        registerToStore: {
            type: Boolean,
            default: true
        },
        commentCounts: {
            type: Object,
            default: () => ({})
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
            // Playwright 테스트용 클래스 카운터
            playwrightClassCounters: {
                task: 0,
                lane: 0,
                gateway: 0,
                event: 0,
                sequenceflow: 0,
                participant: 0
            },
            showColorRulesetDialog: false,
            colorRules: [], // Color rules loaded from BPMN XML
            // compensate boundaryEvent ↔ 보상 task 연결 시 자동으로 compensateTask 채움
            compensateAutoFillInstalled: false
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
        isPalUengine() {
            return !!(window.$pal && window.$mode === 'uEngine');
        },
    },
    async mounted() {
        this.onLoadStart();
        this.canvasContainer = document.getElementById('canvas-container');

        // Load palette settings before initializing viewer
        await this.loadPaletteSettings();

        this.initializeViewer();
        this.setDiagramEvent();
        if (typeof this.bpmn === 'string' && this.bpmn.trim().length > 0) {
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
        Promise.resolve()
            .then(() => this.bpmnViewer.importXML(this.diagramXML))
            .catch((e) => {
                console.error('[BpmnUengine] 초기 import 실패:', e);
                this.$emit('error', e);
            })
            .finally(() => {
                try {
                    this.onLoadEnd();
                } catch (_) {
                }
            });
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
       bpmn: {
            async handler(newVal) {
                if(this.registerToStore) {
                    return;
                }
                try {
                    if (typeof newVal !== 'string' || newVal.trim().length === 0) return;
                    if (!this.bpmnViewer) return;
                    this.onLoadStart();
                    this.diagramXML = newVal;
                    await this.bpmnViewer.importXML(newVal);
                } catch (e) {
                    console.error('[BpmnUengine] bpmn prop 변경시 import 실패:', e);
                    this.$emit('error', e);
                } finally {
                    try {
                        this.onLoadEnd();
                    } catch (_) {
                    }
                }
            }
        },
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
        commentCounts: {
            handler(val) {
                this.renderCommentBadges(val);
            },
            deep: true
        },
    },
    methods: {
        // 노드별 코멘트 배지 오버레이 렌더링
        renderCommentBadges(commentCounts) {
            if (!this.bpmnViewer) return;
            try {
                const overlays = this.bpmnViewer.get('overlays');
                const elementRegistry = this.bpmnViewer.get('elementRegistry');

                // 기존 코멘트 배지 제거
                overlays.remove({ type: 'comment-badge' });

                if (!commentCounts || Object.keys(commentCounts).length === 0) return;

                Object.entries(commentCounts).forEach(([elementId, countObj]) => {
                    const count = typeof countObj === 'object' ? (countObj.unresolved || 0) : (countObj || 0);
                    if (count === 0) return;
                    const element = elementRegistry.get(elementId);
                    if (!element) return;

                    const badge = document.createElement('div');
                    badge.className = 'comment-count-badge';
                    badge.style.cssText = [
                        'cursor: pointer',
                        'min-width: 18px',
                        'height: 18px',
                        'background: #e53935',
                        'border-radius: 9px',
                        'border: 2px solid #fff',
                        'display: flex',
                        'align-items: center',
                        'justify-content: center',
                        'padding: 0 4px',
                        'box-shadow: 0 1px 4px rgba(0,0,0,0.25)',
                        'font-size: 10px',
                        'font-weight: bold',
                        'color: #fff',
                        'font-family: Arial, sans-serif',
                        'pointer-events: auto'
                    ].join(';');
                    badge.textContent = count > 99 ? '99+' : String(count);

                    const self = this;
                    badge.addEventListener('click', function(e) {
                        e.stopPropagation();
                        self.$emit('addComment', elementId);
                    });

                    overlays.add(elementId, 'comment-badge', {
                        position: { top: -10, right: -10 },
                        html: badge
                    });
                });
            } catch (e) {
                console.warn('[BpmnUengine] renderCommentBadges 오류:', e);
            }
        },

        // 특정 요소로 캔버스 포커스 이동
        focusElement(elementId) {
            if (!this.bpmnViewer || !elementId) return;
            try {
                const canvas = this.bpmnViewer.get('canvas');
                const elementRegistry = this.bpmnViewer.get('elementRegistry');
                const element = elementRegistry.get(elementId);
                if (!element) return;

                const viewbox = canvas.viewbox();
                const elementMid = {
                    x: element.x + element.width / 2,
                    y: element.y + element.height / 2
                };
                const zoom = 1.0;
                canvas.viewbox({
                    x: elementMid.x - (viewbox.outer.width / zoom / 2),
                    y: elementMid.y - (viewbox.outer.height / zoom / 2),
                    width: viewbox.outer.width / zoom,
                    height: viewbox.outer.height / zoom
                });
                canvas.zoom(zoom);
            } catch (e) {
                console.warn('[BpmnUengine] focusElement 오류:', e);
            }
        },

        // Phase 1-3: Apply validation markers on canvas
        applyValidationMarkers(items) {
            if (!this.bpmnViewer) return;
            try {
                const canvas = this.bpmnViewer.get('canvas');
                const elementRegistry = this.bpmnViewer.get('elementRegistry');

                // Remove all existing validation markers
                elementRegistry.getAll().forEach(el => {
                    canvas.removeMarker(el.id, 'validation-error');
                    canvas.removeMarker(el.id, 'validation-warning');
                });

                // Add markers per item
                (items || []).forEach(item => {
                    if (!item.elementId) return;
                    const el = elementRegistry.get(item.elementId);
                    if (!el) return;
                    if (item.level === 'error') {
                        canvas.addMarker(item.elementId, 'validation-error');
                    } else {
                        canvas.addMarker(item.elementId, 'validation-warning');
                    }
                });
            } catch (e) {
                console.warn('[BpmnUengine] applyValidationMarkers error:', e);
            }
        },

        hasCompensateEventDefinition(element) {
            const defs = element?.businessObject?.eventDefinitions || [];
            return Array.isArray(defs) && defs.some((d) => d?.$type === 'bpmn:CompensateEventDefinition');
        },
        isCompensationHandlerTask(element) {
            return element?.businessObject?.isForCompensation === true;
        },
        ensureUengineJsonOnElement(element) {
            const bpmnFactory = this.bpmnViewer.get('bpmnFactory');
            const bo = element?.businessObject;
            if (!bo) return { bo: null, uengineProps: null, jsonObj: {} };

            if (!bo.extensionElements) {
                bo.extensionElements = bpmnFactory.create('bpmn:ExtensionElements', { values: [] });
            }
            if (!bo.extensionElements.values) {
                bo.extensionElements.values = [];
            }
            if (bo.extensionElements.values.length === 0) {
                bo.extensionElements.values.push(
                    bpmnFactory.create('uengine:Properties', {
                        json: '{}',
                        variables: []
                    })
                );
            }

            const uengineProps = bo.extensionElements.values[0];
            if (typeof uengineProps.json !== 'string') uengineProps.json = '{}';

            let jsonObj = {};
            try {
                jsonObj = JSON.parse(uengineProps.json || '{}');
            } catch (e) {
                jsonObj = {};
            }

            return { bo, uengineProps, jsonObj };
        },
        applyCompensateTaskAutoFillFromConnection(connection) {
            if (!connection || connection?.businessObject?.$type !== 'bpmn:Association') return;

            const a = connection.source;
            const b = connection.target;

            // 양방향 케이스 모두 지원
            let boundary = null;
            let handlerTask = null;

            if (this.hasCompensateEventDefinition(a) && this.isCompensationHandlerTask(b)) {
                boundary = a;
                handlerTask = b;
            } else if (this.hasCompensateEventDefinition(b) && this.isCompensationHandlerTask(a)) {
                boundary = b;
                handlerTask = a;
            } else {
                return;
            }

            const modeling = this.bpmnViewer.get('modeling');
            const { bo, uengineProps, jsonObj } = this.ensureUengineJsonOnElement(boundary);
            if (!bo || !uengineProps) return;

            jsonObj.compensateTask = {
                name: handlerTask?.businessObject?.name || '',
                tracingTag: handlerTask?.businessObject?.id || handlerTask?.id || ''
            };

            uengineProps.json = JSON.stringify(jsonObj);

            // 모델에 반영 (저장 시 XML에도 반영됨)
            modeling.updateProperties(boundary, {
                extensionElements: bo.extensionElements
            });
        },
        clearCompensateTaskIfAssociationRemoved(connection) {
            if (!connection || connection?.businessObject?.$type !== 'bpmn:Association') return;
            const a = connection.source;
            const b = connection.target;

            // association이 제거될 때, source/target 중 compensate boundaryEvent가 있으면 compensateTask를 비움
            const boundary = this.hasCompensateEventDefinition(a) ? a : this.hasCompensateEventDefinition(b) ? b : null;
            if (!boundary) return;

            const modeling = this.bpmnViewer.get('modeling');
            const { bo, uengineProps, jsonObj } = this.ensureUengineJsonOnElement(boundary);
            if (!bo || !uengineProps) return;

            // 연결이 사라졌으니 초기화(기존 null 형태와 호환)
            jsonObj.compensateTask = null;
            uengineProps.json = JSON.stringify(jsonObj);
            modeling.updateProperties(boundary, {
                extensionElements: bo.extensionElements
            });
        },
        setupCompensateAutoFillListeners() {
            // 뷰어가 없거나 이미 설치했으면 스킵
            if (!this.bpmnViewer || this.compensateAutoFillInstalled) return;
            // 편집 모드에서만 자동 채움 (읽기모드에서는 불필요)
            if (this.isViewMode) return;

            const eventBus = this.bpmnViewer.get('eventBus');

            const onConnCreate = (e) => this.applyCompensateTaskAutoFillFromConnection(e?.context?.connection);
            const onReconnect = (e) => this.applyCompensateTaskAutoFillFromConnection(e?.context?.connection);
            const onDelete = (e) => this.clearCompensateTaskIfAssociationRemoved(e?.context?.connection);

            eventBus.on('commandStack.connection.create.executed', onConnCreate);
            eventBus.on('commandStack.connection.reconnectEnd.executed', onReconnect);
            eventBus.on('commandStack.connection.delete.executed', onDelete);

            this.compensateAutoFillInstalled = true;
        },
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
            if (window.$pal) return;
            const elementRegistry = this.bpmnViewer.get('elementRegistry');
            const participant = elementRegistry.filter(element => element.type === 'bpmn:Participant');
            const horizontal = participant[0].di.isHorizontal;
            window.BpmnAutoLayout.applyAutoLayout(this.bpmnViewer, { horizontal: horizontal });
            this.EventBus.emit('autoLayout.complete');
        },
        revertAutoLayout() {
            if (!window.BpmnAutoLayout || !window.BpmnAutoLayout.hasLayoutSnapshot()) {
                console.warn('No layout snapshot available to restore');
                this.$root.$emit('show-snackbar', {
                    message: this.$t('BpmnUengine.noLayoutSnapshot') || 'No layout snapshot available',
                    color: 'warning'
                });
                return false;
            }
            const success = window.BpmnAutoLayout.restoreLayoutSnapshot(this.bpmnViewer);
            if (success) {
                this.$root.$emit('show-snackbar', {
                    message: this.$t('BpmnUengine.layoutRestored') || 'Layout restored successfully',
                    color: 'success'
                });
            }
            return success;
        },
        hasLayoutSnapshot() {
            return window.BpmnAutoLayout && window.BpmnAutoLayout.hasLayoutSnapshot();
        },
        // ========== 프로세스 간 복사/붙여넣기 기능 ==========
        getCurrentProcessId() {
            // 현재 프로세스 ID 가져오기 (URL 또는 props에서)
            return this.$route?.params?.pathMatch || window.location.pathname || 'unknown';
        },
        saveToCrossProcessClipboard(elements) {
            try {
                const elementRegistry = this.bpmnViewer.get('elementRegistry');

                // Shape 요소와 Connection 요소 분리
                const shapes = elements.filter(el => !el.waypoints);
                const shapeIds = new Set(shapes.map(el => el.id));

                // 선택된 Shape 간의 연결선 찾기
                const connections = [];
                shapes.forEach(shape => {
                    // outgoing connections
                    if (shape.outgoing) {
                        shape.outgoing.forEach(conn => {
                            if (conn.target && shapeIds.has(conn.target.id)) {
                                connections.push({
                                    type: conn.type,
                                    id: conn.id,
                                    sourceId: conn.source.id,
                                    targetId: conn.target.id,
                                    name: conn.businessObject?.name || '',
                                    waypoints: conn.waypoints?.map(wp => ({ x: wp.x, y: wp.y })) || [],
                                    properties: this.extractElementProperties(conn)
                                });
                            }
                        });
                    }
                });

                const clipboardData = {
                    processId: this.getCurrentProcessId(),
                    timestamp: Date.now(),
                    elements: shapes.map(el => {
                        const businessObject = el.businessObject;
                        return {
                            type: el.type,
                            id: el.id,
                            name: businessObject?.name || '',
                            x: el.x,
                            y: el.y,
                            width: el.width,
                            height: el.height,
                            properties: this.extractElementProperties(el)
                        };
                    }),
                    connections: connections
                };
                localStorage.setItem('bpmn-cross-process-clipboard', JSON.stringify(clipboardData));
                console.log('프로세스 간 클립보드에 저장됨:', clipboardData.elements.length, '개 요소,', connections.length, '개 연결선');
            } catch (e) {
                console.error('프로세스 간 복사 실패:', e);
            }
        },
        extractElementProperties(element) {
            const bo = element.businessObject;
            if (!bo) return {};

            const props = {
                name: bo.name,
                documentation: bo.documentation?.[0]?.text || ''
            };

            // uengine 확장 속성 추출
            const extensionElements = bo.extensionElements;
            if (extensionElements && extensionElements.values) {
                const uengineProps = extensionElements.values.find(v => v.$type === 'uengine:Properties');
                if (uengineProps && uengineProps.json) {
                    try {
                        props.uengineJson = uengineProps.json;
                    } catch (e) {}
                }
            }

            return props;
        },
        getFromCrossProcessClipboard() {
            try {
                const data = localStorage.getItem('bpmn-cross-process-clipboard');
                if (data) {
                    const parsed = JSON.parse(data);
                    // 10분 이내 복사된 데이터만 유효
                    if (Date.now() - parsed.timestamp < 10 * 60 * 1000) {
                        return parsed;
                    }
                }
            } catch (e) {
                console.error('프로세스 간 클립보드 읽기 실패:', e);
            }
            return null;
        },
        pasteFromCrossProcessClipboard(clipboardData) {
            if (!clipboardData || !clipboardData.elements || clipboardData.elements.length === 0) {
                return;
            }

            try {
                const modeling = this.bpmnViewer.get('modeling');
                const elementFactory = this.bpmnViewer.get('elementFactory');
                const elementRegistry = this.bpmnViewer.get('elementRegistry');
                const canvas = this.bpmnViewer.get('canvas');
                const bpmnFactory = this.bpmnViewer.get('bpmnFactory');

                // 현재 뷰포트 중앙 위치 계산
                const viewbox = canvas.viewbox();
                const centerX = viewbox.x + viewbox.width / 2;
                const centerY = viewbox.y + viewbox.height / 2;

                // 복사된 요소들의 바운딩 박스 계산
                let minX = Infinity, minY = Infinity;
                clipboardData.elements.forEach(el => {
                    if (el.x < minX) minX = el.x;
                    if (el.y < minY) minY = el.y;
                });

                // 부모 요소 찾기 (Pool 또는 Process)
                const rootElement = canvas.getRootElement();
                let parent = rootElement;
                const participants = elementRegistry.filter(el => el.type === 'bpmn:Participant');
                if (participants.length > 0) {
                    parent = participants[0];
                }

                // 기존 ID → 새 ID 매핑
                const idMapping = {};
                const timestamp = Date.now();

                const createdElements = [];

                // 1. Shape 요소들 생성
                clipboardData.elements.forEach((elData, index) => {
                    // 새 ID 생성
                    const newId = elData.type.replace('bpmn:', '') + '_' + timestamp + '_' + index;
                    idMapping[elData.id] = newId;

                    // 새 위치 계산 (뷰포트 중앙 기준 + 오프셋)
                    const offsetX = elData.x - minX;
                    const offsetY = elData.y - minY;
                    const newX = centerX + offsetX;
                    const newY = centerY + offsetY;

                    // 비즈니스 오브젝트 생성
                    const businessObject = bpmnFactory.create(elData.type, {
                        id: newId,
                        name: elData.properties?.name || elData.name || ''
                    });

                    // Shape 생성
                    const shape = elementFactory.createShape({
                        type: elData.type,
                        businessObject: businessObject,
                        width: elData.width || 100,
                        height: elData.height || 80
                    });

                    // 캔버스에 추가
                    const createdShape = modeling.createShape(shape, { x: newX, y: newY }, parent);
                    createdElements.push(createdShape);

                    // 새로 생성된 요소 ID 저장
                    idMapping[elData.id] = createdShape.id;

                    // uengine 확장 속성 복원 (ID 참조 업데이트)
                    if (elData.properties?.uengineJson) {
                        try {
                            let jsonStr = elData.properties.uengineJson;
                            // JSON 내 ID 참조 업데이트
                            Object.keys(idMapping).forEach(oldId => {
                                const newId = idMapping[oldId];
                                jsonStr = jsonStr.replace(new RegExp(oldId, 'g'), newId);
                            });

                            const moddle = this.bpmnViewer.get('moddle');
                            const extensionElements = moddle.create('bpmn:ExtensionElements');
                            const uengineProps = moddle.create('uengine:Properties', {
                                json: jsonStr
                            });
                            extensionElements.values = [uengineProps];
                            modeling.updateProperties(createdShape, { extensionElements });
                        } catch (e) {
                            console.warn('확장 속성 복원 실패:', e);
                        }
                    }
                });

                // 2. 연결선(SequenceFlow) 생성
                if (clipboardData.connections && clipboardData.connections.length > 0) {
                    clipboardData.connections.forEach((connData, index) => {
                        try {
                            const sourceId = idMapping[connData.sourceId];
                            const targetId = idMapping[connData.targetId];

                            if (!sourceId || !targetId) {
                                console.warn('연결선 복원 실패: source 또는 target을 찾을 수 없음', connData);
                                return;
                            }

                            const sourceElement = elementRegistry.get(sourceId);
                            const targetElement = elementRegistry.get(targetId);

                            if (!sourceElement || !targetElement) {
                                console.warn('연결선 복원 실패: 요소를 찾을 수 없음', sourceId, targetId);
                                return;
                            }

                            // 연결선 생성
                            const connection = modeling.connect(sourceElement, targetElement, {
                                type: connData.type || 'bpmn:SequenceFlow'
                            });

                            // 연결선 이름 설정
                            if (connData.name) {
                                modeling.updateProperties(connection, { name: connData.name });
                            }

                            console.log('연결선 생성:', sourceId, '->', targetId);
                        } catch (e) {
                            console.warn('연결선 복원 실패:', e);
                        }
                    });
                }

                // 생성된 요소들 선택
                const selection = this.bpmnViewer.get('selection');
                selection.select(createdElements);

                console.log('프로세스 간 붙여넣기 완료:', createdElements.length, '개 요소,',
                    (clipboardData.connections?.length || 0), '개 연결선');
            } catch (e) {
                console.error('프로세스 간 붙여넣기 실패:', e);
            }
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
        addTestClassToElement(element, canvas) {
            // 개별 요소에 Playwright 테스트 클래스 추가
            const gfx = canvas.getGraphics(element);
            if (!gfx) return;

            let testClass = '';
            let elementType = element.type;
            let categoryType = '';

            // 타입별 클래스 매핑
            if (elementType.includes('Task') || elementType === 'bpmn:CallActivity') {
                categoryType = 'task';
                testClass = `playwright-task-${this.playwrightClassCounters.task}`;
                this.playwrightClassCounters.task++;
            } else if (elementType === 'bpmn:Lane') {
                categoryType = 'lane';
                testClass = `playwright-lane-${this.playwrightClassCounters.lane}`;
                this.playwrightClassCounters.lane++;
            } else if (elementType.includes('Gateway')) {
                categoryType = 'gateway';
                testClass = `playwright-gateway-${this.playwrightClassCounters.gateway}`;
                this.playwrightClassCounters.gateway++;
            } else if (elementType.includes('Event')) {
                categoryType = 'event';
                testClass = `playwright-event-${this.playwrightClassCounters.event}`;
                this.playwrightClassCounters.event++;
            } else if (elementType === 'bpmn:SequenceFlow') {
                categoryType = 'sequenceflow';
                testClass = `playwright-sequenceflow-${this.playwrightClassCounters.sequenceflow}`;
                this.playwrightClassCounters.sequenceflow++;
            } else if (elementType === 'bpmn:Participant') {
                categoryType = 'participant';
                testClass = `playwright-participant-${this.playwrightClassCounters.participant}`;
                this.playwrightClassCounters.participant++;
            }

            if (testClass) {
                // 메인 그래픽 요소에 클래스 추가
                gfx.classList.add(testClass);
                
                // 레인과 참가자의 경우 모든 .djs-hit 영역에도 클래스 추가
                if (categoryType === 'lane' || categoryType === 'participant') {
                    const hitAreas = gfx.querySelectorAll('.djs-hit');
                    hitAreas.forEach(hitArea => {
                        hitArea.classList.add(testClass);
                        if (element.businessObject && element.businessObject.name) {
                            hitArea.setAttribute('data-test-name', element.businessObject.name);
                        }
                    });
                }
                
                // 요소 이름이 있으면 data 속성으로도 추가
                if (element.businessObject && element.businessObject.name) {
                    gfx.setAttribute('data-test-name', element.businessObject.name);
                }
            }
        },
        addTestClassesToElements(canvas, elementRegistry) {
            // 모든 요소에 Playwright 테스트 클래스 추가 (초기 로드 시)
            // 카운터 초기화
            this.playwrightClassCounters = {
                task: 0,
                lane: 0,
                gateway: 0,
                event: 0,
                sequenceflow: 0,
                participant: 0
            };

            const allElements = elementRegistry.getAll();
            allElements.forEach(element => {
                this.addTestClassToElement(element, canvas);
            });
        },
        changeOrientation() {
            if (window.$pal && window.$mode === 'uEngine') return;
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
                
                // Playwright 테스트용 고유 클래스 추가
                self.addTestClassesToElements(canvas, elementRegistry);
                
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

                    // View 모드: 더블클릭 시 패널 열기
                    eventBus.on('element.dblclick', function (e) {
                        self.$emit('openPanel', e.element.id);
                    });
                } else {
                    // Edit 모드: 더블클릭 시 인라인 텍스트 편집 (표준 BPMN UX)
                    // CallActivity와 Collaboration만 특별 처리
                    eventBus.on('element.dblclick', function (e) {
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
                        }
                        // Task, Event, Gateway 등은 directEditing이 자동 활성화됨 (인라인 텍스트 편집)
                    });

                    // Edit 모드: 우클릭 시 속성 패널 열기 (DOM 이벤트 사용)
                    const canvas = self.bpmnViewer.get('canvas');
                    const container = canvas.getContainer();
                    container.addEventListener('contextmenu', function(event) {
                        event.preventDefault();
                        event.stopPropagation();

                        // 클릭된 SVG 요소에서 data-element-id 찾기
                        let target = event.target;
                        let elementId = null;

                        while (target && target !== container) {
                            elementId = target.getAttribute('data-element-id');
                            if (elementId) break;
                            target = target.parentElement;
                        }

                        if (elementId) {
                            // Root element나 빈 공간은 무시
                            const elementRegistry = self.bpmnViewer.get('elementRegistry');
                            const element = elementRegistry.get(elementId);
                            if (element && element.type !== 'bpmn:Process' && element.type !== 'bpmn:Collaboration') {
                                self.$emit('openPanel', elementId);
                            }
                        }
                    });
                }

                // ContextPad에서 속성 패널 열기 버튼 클릭 시
                eventBus.on('element.openPanel', function (e) {
                    self.$emit('openPanel', e.element.id);
                });

                // ContextPad에서 코멘트 작성 버튼 클릭 시
                eventBus.on('element.addComment', function (e) {
                    self.$emit('addComment', e.element.id);
                });

                // directEditing 시작/종료 시 커스텀 텍스트 처리 (인라인 편집 충돌 방지)
                eventBus.on('directEditing.activate', function (e) {
                    // 인라인 편집 시작 시 해당 요소의 커스텀 텍스트 숨기기
                    const elementId = e.active?.element?.id;
                    if (elementId) {
                        const container = document.querySelector(`[data-element-id="${elementId}"]`);
                        if (container) {
                            const customText = container.closest('.djs-element')?.querySelector('text.custom-wrapped-text');
                            if (customText) {
                                customText.style.display = 'none';
                            }
                        }
                    }
                });

                eventBus.on('directEditing.complete', function (e) {
                    // 인라인 편집 완료 시 해당 요소 다시 렌더링
                    const elementId = e.active?.element?.id;
                    if (elementId) {
                        const elementRegistry = self.bpmnViewer.get('elementRegistry');
                        const element = elementRegistry.get(elementId);
                        if (element) {
                            // 요소를 다시 렌더링하여 텍스트 업데이트
                            const graphicsFactory = self.bpmnViewer.get('graphicsFactory');
                            const gfx = elementRegistry.getGraphics(element);
                            if (gfx) {
                                graphicsFactory.update('shape', element, gfx);
                            }
                        }
                    }
                });

                eventBus.on('directEditing.cancel', function (e) {
                    // 인라인 편집 취소 시 커스텀 텍스트 다시 보이기
                    const elementId = e.active?.element?.id;
                    if (elementId) {
                        const container = document.querySelector(`[data-element-id="${elementId}"]`);
                        if (container) {
                            const customText = container.closest('.djs-element')?.querySelector('text.custom-wrapped-text');
                            if (customText) {
                                customText.style.display = '';
                            }
                        }
                    }
                });

                eventBus.on('commandStack.changed', async function (evt) {
                    console.log('commandStack.changed');
                    if(self.bpmn) {
                        const { xml } = await self.bpmnViewer.saveXML({ format: true, preamble: true });
                        self.bpmnXML = xml;
                        self.validate();
                    }
                });

                // Phase 4-2: Business ID auto-assignment on task creation
                eventBus.on('shape.added', function(event) {
                    const element = event.element;
                    if (!element || !element.type || !element.type.includes('Task')) return;
                    // Only assign if no businessId already
                    const extEls = element.businessObject?.extensionElements;
                    if (extEls?.values) {
                        const uProps = extEls.values.find(v => v.$type === 'uengine:Properties');
                        if (uProps?.json) {
                            try {
                                const parsed = JSON.parse(uProps.json);
                                if (parsed.businessId) return; // Already has one
                            } catch(e) {}
                        }
                    }
                    // Auto-assign via window.$bpmnHierarchyPath if set
                    const hierarchyPath = window.$bpmnHierarchyPath;
                    if (!hierarchyPath) return;
                    // Collect existing businessIds
                    const registry = self.bpmnViewer.get('elementRegistry');
                    const existingIds = new Set();
                    registry.filter(el => el.type && el.type.includes('Task')).forEach(el => {
                        const ext = el.businessObject?.extensionElements;
                        if (ext?.values) {
                            const p = ext.values.find(v => v.$type === 'uengine:Properties');
                            if (p?.json) {
                                try {
                                    const pj = JSON.parse(p.json);
                                    if (pj.businessId) existingIds.add(pj.businessId);
                                } catch(e) {}
                            }
                        }
                    });
                    // Generate new ID
                    const prefix = `${hierarchyPath}-T`;
                    let maxNum = 0;
                    existingIds.forEach(id => {
                        if (id.startsWith(prefix)) {
                            const n = parseInt(id.slice(prefix.length), 10);
                            if (!isNaN(n) && n > maxNum) maxNum = n;
                        }
                    });
                    const newBid = `${prefix}${String(maxNum + 1).padStart(2, '0')}`;
                    // Assign via modeling.updateProperties
                    try {
                        const modeling = self.bpmnViewer.get('modeling');
                        const bpmnFactory = self.bpmnViewer.get('bpmnFactory');
                        let businessObject = element.businessObject;
                        if (!businessObject.extensionElements) {
                            businessObject.extensionElements = bpmnFactory.create('bpmn:ExtensionElements', { values: [] });
                        }
                        let uProp = businessObject.extensionElements.values.find(v => v.$type === 'uengine:Properties');
                        if (!uProp) {
                            uProp = bpmnFactory.create('uengine:Properties', { json: '{}' });
                            businessObject.extensionElements.values.push(uProp);
                        }
                        const jsonData = JSON.parse(uProp.json || '{}');
                        jsonData.businessId = newBid;
                        uProp.json = JSON.stringify(jsonData);
                    } catch (e) {
                        console.warn('[BpmnUengine] businessId assignment failed:', e);
                    }
                });

                // Phase 4-4: SSO Lane - block direct editing for Organization type
                eventBus.on('directEditing.activate', function(event) {
                    const element = event.active?.element;
                    if (!element || element.type !== 'bpmn:Lane') return;
                    // Check if lane has Organization type
                    const ext = element.businessObject?.extensionElements;
                    if (ext?.values) {
                        const uProp = ext.values.find(v => v.$type === 'uengine:Properties');
                        if (uProp?.json) {
                            try {
                                const parsed = JSON.parse(uProp.json);
                                if (parsed.roleResolutionContext?._type === 'Organization') {
                                    // Cancel direct editing, open panel instead
                                    const directEditing = self.bpmnViewer.get('directEditing');
                                    directEditing.cancel();
                                    self.$emit('openPanel', element.id);
                                }
                            } catch(e) {}
                        }
                    }
                });

                // Phase 2-7: Multi-select detection
                eventBus.on('selection.changed', function(event) {
                    const newSelection = event.newSelection || [];
                    const tasks = newSelection.filter(el => el.type && el.type.includes('Task'));
                    if (tasks.length >= 2) {
                        self.$emit('multiSelect', tasks);
                    } else {
                        self.$emit('multiSelect', []);
                    }
                });

                // var events = ['element.hover', 'element.out', 'element.click', 'element.dblclick', 'element.mousedown', 'element.mouseup'];
                // events.forEach(function (event) {

                // });
                if(self.isAIGenerated && !(window.$pal && window.$mode === 'uEngine')) {
                    if(self._layoutTimeout) {
                        clearTimeout(self._layoutTimeout);
                    }
                    self._layoutTimeout = setTimeout(() => {
                        self.applyAutoLayout();
                        self.$emit('update:isAIGenerated', false);
                    }, 500); // 500ms 안 변하면 실행
                }

                // 코멘트 배지 렌더링 (commentCounts prop이 있을 때)
                if (self.commentCounts && Object.keys(self.commentCounts).length > 0) {
                    self.$nextTick(() => {
                        self.renderCommentBadges(self.commentCounts);
                    });
                }

                let endTime = performance.now();
                console.log(`initializeViewer Result Time :  ${endTime - startTime} ms`);
                if (!(window.$pal && window.$mode === 'uEngine')) {
                    self.applyAutoLayout();
                }
                self.resetZoom();
            });
            
            // 사용자가 수동으로 요소를 추가할 때 클래스 추가
            eventBus.on('shape.added', function(event) {
                const element = event.element;
                const canvas = self.bpmnViewer.get('canvas');
                
                // 실시간으로 추가되는 요소에 클래스 추가
                setTimeout(() => {
                    self.addTestClassToElement(element, canvas);
                }, 100);
            });
            
            // 연결(시퀀스 플로우)이 추가될 때도 클래스 추가
            eventBus.on('connection.added', function(event) {
                const element = event.element;
                const canvas = self.bpmnViewer.get('canvas');
                
                setTimeout(() => {
                    self.addTestClassToElement(element, canvas);
                }, 100);
            });

            // compensate boundaryEvent ↔ 보상 task 연결 시 compensateTask 자동 채움
            // (association 연결 시 target의 name/id를 boundaryEvent uengine:json.compensateTask로 저장)
            this.setupCompensateAutoFillListeners();
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
                            // skt 마이그레이션 요소 변경 비활성화
                            // customReplaceModule,
                            ZoomScroll,
                            MoveCanvas,
                            minimapModule
                        ]
                    },
                );
                self.bpmnViewer = markRaw(new BpmnModeler(_options));
            }
            
            if (self.registerToStore) {
                self.bpmnStore = useBpmnStore();
                self.bpmnStore.setModeler(self.bpmnViewer);
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

            // Guard: skip if canvas container has no dimensions (prevents SVGMatrix non-finite error)
            try {
                var container = canvas._container || canvas.getContainer?.();
                if (container && (container.clientWidth === 0 || container.clientHeight === 0)) {
                    return;
                }
            } catch (e) { /* ignore */ }

            var allPools = elementRegistry.filter(element => element.type === 'bpmn:Participant');

            try {
                zoomScroll.reset();
            } catch (e) {
                console.warn('[BpmnUengine] zoomScroll.reset() failed:', e.message);
                return;
            }

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

            if (!this.bpmnViewer) return;

            try {
                const copyPaste = this.bpmnViewer.get('copyPaste');
                const commandStack = this.bpmnViewer.get('commandStack');
                const selection = this.bpmnViewer.get('selection');
                const modeling = this.bpmnViewer.get('modeling');

                // Handle Delete/Backspace key (without modifier)
                if (event.key === 'Delete' || event.key === 'Backspace') {
                    const selectedElements = selection.get();
                    if (selectedElements.length > 0) {
                        // Filter out root elements that shouldn't be deleted
                        const deletableElements = selectedElements.filter(el =>
                            el.type !== 'bpmn:Process' &&
                            el.type !== 'bpmn:Collaboration'
                        );
                        if (deletableElements.length > 0) {
                            modeling.removeElements(deletableElements);
                        }
                    }
                    event.preventDefault();
                    return;
                }

                // Handle Arrow keys for element movement (without modifier)
                if (!modifierKey && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
                    const selectedElements = selection.get();
                    if (selectedElements.length > 0) {
                        const step = event.shiftKey ? 10 : 1; // Shift: 10px step, Normal: 1px step
                        let dx = 0, dy = 0;

                        switch (event.key) {
                            case 'ArrowUp': dy = -step; break;
                            case 'ArrowDown': dy = step; break;
                            case 'ArrowLeft': dx = -step; break;
                            case 'ArrowRight': dx = step; break;
                        }

                        // Move only shape elements (not connections)
                        const shapeElements = selectedElements.filter(el =>
                            el.waypoints === undefined && // Not a connection
                            el.type !== 'bpmn:Process' &&
                            el.type !== 'bpmn:Collaboration'
                        );

                        if (shapeElements.length > 0) {
                            modeling.moveElements(shapeElements, { x: dx, y: dy });
                        }
                    }
                    event.preventDefault();
                    return;
                }

                // Handle modifier key shortcuts (Ctrl/Cmd)
                if (!modifierKey) return;

                switch (event.key.toLowerCase()) {
                    case 'c':
                        // Copy (내부 + 프로세스 간 복사)
                        const selectedElements = selection.get();
                        if (selectedElements.length > 0) {
                            // 내부 복사
                            copyPaste.copy(selectedElements);
                            // 프로세스 간 복사를 위해 localStorage에 저장
                            this.saveToCrossProcessClipboard(selectedElements);
                        }
                        event.preventDefault();
                        break;
                    case 'v':
                        // Paste (내부 붙여넣기 시도 후, 없으면 프로세스 간 붙여넣기)
                        const crossProcessData = this.getFromCrossProcessClipboard();
                        if (crossProcessData && crossProcessData.processId !== this.getCurrentProcessId()) {
                            // 다른 프로세스에서 복사한 경우 프로세스 간 붙여넣기
                            this.pasteFromCrossProcessClipboard(crossProcessData);
                        } else {
                            // 같은 프로세스 내 붙여넣기
                            copyPaste.paste();
                        }
                        event.preventDefault();
                        break;
                    case 'x':
                        // Cut
                        const elementsTocut = selection.get();
                        if (elementsTocut.length > 0) {
                            copyPaste.copy(elementsTocut);
                            this.saveToCrossProcessClipboard(elementsTocut);
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
        onContextMenu(event) {
            // 기본 브라우저 컨텍스트 메뉴 방지 (Edit 모드에서만)
            // bpmn-js의 element.contextmenu 이벤트에서 패널을 열도록 처리
            if (!this.isViewMode) {
                event.preventDefault();
            }
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

/* Phase 1-3: Validation markers */
.djs-element.validation-error .djs-visual rect,
.djs-element.validation-error .djs-visual circle,
.djs-element.validation-error .djs-visual polygon {
    stroke: #F44336 !important;
    stroke-width: 2px !important;
}
.djs-element.validation-warning .djs-visual rect,
.djs-element.validation-warning .djs-visual circle,
.djs-element.validation-warning .djs-visual polygon {
    stroke: #FF9800 !important;
    stroke-width: 2px !important;
}

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
  background: rgba(255, 255, 255, 0.7);
  padding: 4px 8px;
  border-radius: 4px;
  z-index: 10;
}

.font-size-controls-mobile {
    top: 12px;
    flex-direction: column;
    align-items: flex-end;
}

.controls-group {
  display: flex;
  align-items: center;
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

.mini-preview .bjs-powered-by,
.mini-preview .djs-palette,
.mini-preview .djs-context-pad,
.mini-preview .djs-overlay-container {
  display: none !important;
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
