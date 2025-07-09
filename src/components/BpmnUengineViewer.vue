<template>
    <!-- <div> -->
    <div style="height: 100%; position: relative;" ref="container" class="vue-bpmn-diagram-container" :class="{ 'view-mode': isViewMode }" v-hammer:pan="onPan" v-hammer:pinch="onPinch">
        <div :class="isMobile ? 'mobile-position' : 'desktop-position'">
            <div class="pa-1" :class="isMobile ? 'mobile-style' : 'desktop-style'">
                <v-icon @click="resetZoom" style="color: #444; cursor: pointer;">mdi-crosshairs-gps</v-icon>
                <v-icon @click="zoomIn" style="color: #444; cursor: pointer;">mdi-plus</v-icon>
                <v-icon @click="zoomOut" style="color: #444; cursor: pointer;">mdi-minus</v-icon>
                <v-icon @click="changeOrientation" style="color: #444; cursor: pointer;">mdi-crop-rotate</v-icon>
            </div>
        </div>
        <div v-if="previewersXMLLists.length > 0" style="position: absolute; top: 0px; left: 20px; pointer-events: auto; z-index: 10;">
            <v-row class="ma-0 pa-0">
                <div v-for="(previewer, index) in previewersXMLLists" :key="index">
                    <h6 @click="goToPreviewer(index)" 
                        class="text-h6 cursor-pointer"
                        style="color: #444;"
                    >{{ previewer.name }}</h6>
                    <v-icon v-if="index < previewersXMLLists.length - 1"
                    >mdi-chevron-right
                    </v-icon>
                </div>
                <div class="ma-0 pa-0 d-flex">
                    <v-icon>mdi-chevron-right</v-icon>
                    <h6 class="text-h6 font-weight-semibold"
                    >{{ bpmnViewer._definitions.name.slice(bpmnViewer._definitions.name.indexOf('/') + 1) }}</h6>
                </div>
            </v-row>
        </div>
    </div>
    <!-- </div> -->
</template>

<script>
import uEngineModdleDescriptor from '@/components/descriptors/uEngine.json';
import 'bpmn-js/dist/assets/diagram-js.css';
import BpmnModeler from 'bpmn-js/lib/Modeler';
import BpmnViewer from 'bpmn-js/lib/Viewer';
import ZoomScroll from './customZoomScroll';
// import ZoomScroll from 'diagram-js/lib/navigation/zoomscroll';
import MoveCanvas from './customMoveCanvas';
// import MoveCanvas from 'diagram-js/lib/navigation/movecanvas';
import customBpmnModule from './customBpmn';
import paletteProvider from './customPalette/PaletteProvider';
import phaseModdle from '@/assets/bpmn/phase-moddle.json';

import BackendFactory from '@/components/api/BackendFactory';

const backend = BackendFactory.createBackend();

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
        adminMode: {
            type: Boolean,
            default: false
        },
        instanceId: {
            type: String
        },
        diffActivities: {
            type: Object,
            default: () => ({})
        }
    },
    data: function () {
        return {
            diagramXML: null,
            openPanel: false,
            bpmnViewer: null,
            previewersXMLLists: [],
            activityStatus: null,
            currentInstanceId: null,
            subProcessInstances: {},
            isViewMode: true,
            resizeObserver: null,
            resizeTimeout: null,
            panStart: { x: 0, y: 0 },
            pinchStartZoom: 1
        };
    },
    computed: {
        async getXML() {
            let xml = await this.bpmnViewer.saveXML({ format: true, preamble: true });
            return xml.xml;
        },
        isMobile() {
            return window.innerWidth <= 768;
        },
    },
    mounted() {
        this.currentInstanceId = this.instanceId;
        this.initializeViewer();
        this.setDiagramEvent();
        if (this.url) {
            this.fetchDiagram(this.url);
        } else if (this.bpmn) {
            this.diagramXML = this.bpmn;
        } else {
            this.diagramXML =
                '<?xml version="1.0" encoding="UTF-8"?> <bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:uengine="http://uengine" id="Definitions_0bfky9r" targetNamespace="http://bpmn.io/schema/bpmn" exporter="bpmn-js (https://demo.bpmn.io)" exporterVersion="16.4.0"> <bpmn:process id="Process_1oscmbn" isExecutable="false"> <bpmn:extensionElements> <uengine:properties> </uengine:properties> </bpmn:extensionElements> </bpmn:process> <bpmndi:BPMNDiagram id="BPMNDiagram_1"> <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1oscmbn" /> </bpmndi:BPMNDiagram> </bpmn:definitions>';
        }
        this.initResizeObserver();
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
            this.bpmnViewer.importXML(val);
        },
        taskStatus(val) {
            this.activityStatus = val;
        },
        activityStatus(val) {
            this.setTaskStatus(val);
        },
        async currentInstanceId(val) {
            this.setSubProcessInstance(val);
        },
        diffActivities(newVal) {
            if (newVal && Object.keys(newVal).length > 0) {
                const canvas = this.bpmnViewer.get('canvas');
                // 이전 마커 제거 (선택 사항)
                Object.keys(newVal).forEach(activityId => {
                    canvas.removeMarker(activityId, 'added');
                    canvas.removeMarker(activityId, 'deleted');
                    canvas.removeMarker(activityId, 'modified');
                });
                
                // 새 마커 추가
                Object.keys(newVal).forEach(activityId => {
                    const changeType = newVal[activityId];
                    if (activityId && changeType) {
                        canvas.addMarker(activityId, changeType);
                    }
                });
            }
        }
    },
    methods: {
        async getVariables(instanceId) {
            const variables = await backend.getProcessVariables(instanceId);
            return variables;
        },
        async openCallActivity(element) {
            const self = this;
            const callJsonText = element.businessObject?.extensionElements?.values[0]?.$children[0]?.$body;
            if(callJsonText) {
                const callJson = JSON.parse(callJsonText);
                const callId = callJson.definitionId;
                const callDefinition = await backend.getRawDefinition(callId.replace('.bpmn', ''), { type: 'bpmn', version: callJson.version });
                const previewerXML = await self.bpmnViewer.saveXML({ format: true, preamble: true });
                
                
                const previewerObject = {
                    xml: previewerXML.xml,
                    name: self.bpmnViewer._definitions.name.slice(self.bpmnViewer._definitions.name.indexOf('/') + 1),
                    activityStatus: self.activityStatus,
                    instanceId: self.currentInstanceId
                }
                self.previewersXMLLists.push(previewerObject);
                self.diagramXML = callDefinition;
            }
        },
        async setSubProcessInstance(instanceId) {
            if(instanceId) {
                const variables = await this.getVariables(instanceId);
                this.subProcessInstances = {};

                for (let key in variables) {
                    if (key.startsWith('Activity') && key.indexOf('instanceIdOfSubProcess') > 0) {
                        let activityKey = key.split(':')[0];
                        let instanceIds = variables[key].split(',').map(id => id.trim());
                        this.subProcessInstances[activityKey] = instanceIds;
                    }
                }
                console.log(this.subProcessInstances);
            }
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
        },
        zoomIn() {
            const zoomScroll = this.bpmnViewer.get('zoomScroll');
            zoomScroll.stepZoom(1);
        },
        zoomOut() {
            const zoomScroll = this.bpmnViewer.get('zoomScroll');
            zoomScroll.stepZoom(-1);
        },
        goToPreviewer(index) {
            this.diagramXML = this.previewersXMLLists[index].xml;
            this.activityStatus = this.previewersXMLLists[index].activityStatus;
            this.currentInstanceId = this.previewersXMLLists[index].instanceId;
            this.previewersXMLLists = this.previewersXMLLists.slice(0, index);
        },
        setDiagramEvent() {
            var self = this;
            var eventBus = this.bpmnViewer.get('eventBus');
            eventBus.on('import.render.complete', async function (event) {
                let startTime = performance.now();

                var canvas = self.bpmnViewer.get('canvas');
                var elementRegistry = self.bpmnViewer.get('elementRegistry');
                var allPools = elementRegistry.filter(element => element.type === 'bpmn:Participant');
                
                self.resetZoom();

                if (window.$mode == "ProcessGPT") {
                    if (self.currentActivities && self.currentActivities.length > 0) {
                        self.currentActivities.forEach((actId) => {
                            if (actId) canvas.addMarker(actId, 'highlight');
                        });
                    }
                } 

                var overlays = self.bpmnViewer.get('overlays');

                if (self.adminMode) {
                    // add marker to current activity elements

                    if (self.currentActivities && self.currentActivities.length > 0) {
                        self.currentActivities.forEach((actId) => {
                            const element = elementRegistry.get(actId);
                            if (element) {
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
                        });
                    } 
                    
                
                }

                // 차이점 시각화 처리 추가
                if (self.diffActivities && Object.keys(self.diffActivities).length > 0) {
                    Object.keys(self.diffActivities).forEach(activityId => {
                        const changeType = self.diffActivities[activityId];
                        if (activityId && changeType) {
                            canvas.addMarker(activityId, changeType);
                        }
                    });
                }

                await self.setSubProcessInstance(self.currentInstanceId);
                if(self.subProcessInstances && Object.keys(self.subProcessInstances).length > 0) {
                    Object.keys(self.subProcessInstances).forEach((key) => {
                        const element = elementRegistry.get(key);
                        if (element) {
                            let dropdownHtml = `<select class="instance-select-box">`;
                                dropdownHtml += `<option value=""hidden style="text-align: center;">인스턴스 선택 ▼</option>\n`; // 기본값으로 아무것도 선택되지 않음
                            self.subProcessInstances[key].forEach((subProcessId, idx) => {
                                dropdownHtml += `<option class="instance-select-list" value="${subProcessId}">${subProcessId}</option>\n`;
                            });
                            dropdownHtml += `</select>`;
                            let overlayHtml = $(`<div>${dropdownHtml}</div>`);
                            overlayHtml.find('select').change(async function (e) {
                                let selectedSubProcessId = $(this).val();
                                await self.openCallActivity(element);
                                self.currentInstanceId = selectedSubProcessId;
                                const activityStatus = await backend.getActivitiesStatus(self.currentInstanceId);
                                self.activityStatus = activityStatus;
                            });
                            overlays.add(key, 'note', {
                                position: {
                                    bottom: 79,
                                    right: 98
                                },
                                html: overlayHtml
                            });
                        }
                    });
                }
                eventBus.on('element.dblclick', async function (e) {
                    if (e.element.type.includes('CallActivity')) {
                        self.$emit('openDefinition', e.element.businessObject);
                    } 
                    // if (e.element.type.includes('CallActivity')) {
                    //     self.openCallActivity(e.element);
                    // }
                });
                
                if(!self.activityStatus) {
                    self.activityStatus = self.taskStatus;
                }
                self.setTaskStatus(self.activityStatus);

                let endTime = performance.now();
                console.log(`initializeViewer Result Time :  ${endTime - startTime} ms`);
            });
        },
        initializeViewer() {
            var container = this.$refs.container;
            var self = this;
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
                        },
                        propertiesPanel: {}
                    }
                );

            self.bpmnViewer = new BpmnModeler(viewerOptions);
        },
        setTaskStatus(val) {
            let self = this;
            var canvas = self.bpmnViewer.get('canvas');
            if(val) {
                try {
                    Object.keys(val).forEach((task) => {
                        let taskStatus = val[task];
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
                } catch (error) {
                }
            }
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

            if(width - 100 > height) {
                this.initDefaultOrientation('horizontal');
            } else {
                this.initDefaultOrientation('vertical');
            }
        },
        onPan(ev) {
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
        onPinch(ev) {
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
.mobile-style {
    display: flex;
    flex-direction: row;
    align-items: center;
    border: none;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1); /* 카드 스타일 그림자 적용 */
    border-radius: 10px;
    background-color: rgba(255, 255, 255, 0.6); /* 반투명 백그라운드 0.6 적용 */
}
.desktop-style {
    display: flex;
    flex-direction: column;
    align-items: center;
    border: none;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1); /* 카드 스타일 그림자 적용 */
    border-radius: 10px;
    background-color: rgba(255, 255, 255, 0.6); /* 반투명 백그라운드 0.6 적용 */
}

/* 변경점 표시를 위한 스타일 */
.added .djs-visual > :nth-child(1) {
    stroke: #2ecc71 !important; /* 초록색 - 추가된 항목 */
    stroke-width: 3px !important;
}

.deleted .djs-visual > :nth-child(1) {
    stroke: #e74c3c !important; /* 빨간색 - 삭제된 항목 */
    stroke-width: 3px !important;
}

.modified .djs-visual > :nth-child(1) {
    stroke: #2ecc71 !important; /* 초록색 - 추가된 항목 */
    /* stroke: #3498db !important; 파란색 - 수정된 항목 */
    stroke-width: 3px !important;
}

.view-mode .djs-palette {
  display: none !important;
}
</style>
