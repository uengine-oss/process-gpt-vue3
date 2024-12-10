<template>
    <!-- <div> -->
    <div style="height: 100%; position: relative;" ref="container" class="vue-bpmn-diagram-container">
        <div style="position: absolute; top: 20px; right: 20px; pointer-events: auto; z-index: 10;">
            <div class="pa-1" style="display: flex; flex-direction: column; align-items: center; border: gray 1px solid; background-color: white;">
                <v-icon class="mb-1" @click="resetZoom" style="color: #444; cursor: pointer;">mdi-crosshairs-gps</v-icon>
                <v-icon class="mb-1" @click="zoomIn" style="color: #444; cursor: pointer;">mdi-plus</v-icon>
                <v-icon @click="zoomOut" style="color: #444; cursor: pointer;">mdi-minus</v-icon>
            </div>
        </div>
    </div>
    <!-- </div> -->
</template>

<script>
import 'bpmn-js/dist/assets/diagram-js.css';
import BpmnViewer from 'bpmn-js/lib/Viewer';
import ZoomScroll from './customZoomScroll';
import MoveCanvas from './customMoveCanvas';
// import MoveCanvas from 'diagram-js/lib/navigation/movecanvas';


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
    },
    data: function () {
        return {
            diagramXML: null,
            openPanel: false,
            bpmnViewer: null
        };
    },
    computed: {
        async getXML() {
            let xml = await this.bpmnViewer.saveXML({ format: true, preamble: true });
            return xml.xml;
        }
    },
    mounted() {
        this.initializeViewer();
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

            eventBus.on('element.dblclick', function (e) {
                if (e.element.type.includes('CallActivity')) {
                    self.$emit('openDefinition', e.element.businessObject);
                } 
            });
            
            self.setTaskStatus(self.taskStatus);

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
            this.setTaskStatus(val);
        }
    },
    methods: {
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
            moveCanvas.resetMovedDistance();

            zoomScroll.canvasSize = {
                height: height,
                width: width,
                x: x,
                y: y
            }
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
        initializeViewer() {
            var container = this.$refs.container;
            var self = this;
            var _options = Object.assign(
                {
                    container: container,
                    keyboard: {
                        bindTo: window
                    }
                },
                self.options
            );

            var viewerOptions = {
                ..._options,
                additionalModules: [
                    ...(Array.isArray(_options.additionalModules) ? _options.additionalModules : []),
                    ZoomScroll,
                    MoveCanvas
                ]
            };

            self.bpmnViewer = new BpmnViewer(viewerOptions);
        },
        setTaskStatus(val) {
            let self = this;
            var canvas = self.bpmnViewer.get('canvas');
            if(val) {
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
        }
    }
};
</script>

<style></style>
