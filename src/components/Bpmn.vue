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
    mounted() {
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
            console.log(self.bpmnViewer.getDefinitions());
            let def = self.bpmnViewer.getDefinitions();
            let xml = await self.bpmnViewer.saveXML({ format: true, preamble: true });
            let replacer = function (key, value) {
                // 만약 값이 객체이고 bpmnElement 속성을 가지고 있다면
                if (value && typeof value === 'object' && !Array.isArray(value)) {
                    let replacement = { ...value };
                    if (value.bpmnElement) {
                        replacement.bpmnElement = value.bpmnElement.id;
                    }
                    if (value.$parent) {
                        replacement.$parent = value.$parent.id;
                    }
                    if (value.sourceRef) {
                        replacement.sourceRef = value.sourceRef.id;
                    }
                    if (value.targetRef) {
                        replacement.targetRef = value.targetRef.id;
                    }
                    return replacement;
                }
                // 다른 경우에는 값을 그대로 반환
                return value;
            };
            let str = JSON.stringify(def, replacer);
            console.log(str);
            if (xml) console.log(xml);
            // var elementRegistry = self.bpmnViewer.get('elementRegistry');
            // console.log(elementRegistry);
            self.$emit('definition', self.bpmnViewer.getDefinitions());
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
        diagramXML(val) {
            let me = this;
            let obj = this.parseJsonToModdle(val);
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
                        // if (typeof pe.sourceRef === 'string') {
                        //     const bpmnElementObject = flowElementsMap.get(pe.sourceRef);
                        //     if (bpmnElementObject) {
                        //         bpmnElementObject.sourceRef
                        //         pe.sourceRef = bpmnElementObject;

                        //     }
                        // }
                        // if (typeof pe.targetRef === 'string') {
                        //     const bpmnElementObject = flowElementsMap.get(pe.targetRef);
                        //     if (bpmnElementObject) {
                        //         pe.targetRef = bpmnElementObject;
                        //     }
                        // }
                    });
                }
            });

            console.log(obj);
            // this.bpmnViewer.importXML(val);
            this.bpmnViewer.importDefinitions(obj);
        }
    },
    methods: {
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
</style>
