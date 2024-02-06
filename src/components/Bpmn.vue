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

        this.bpmnViewer.on('import.done', async function (event) {
            var error = event.error;
            var warnings = event.warnings;
            // console.log(self.bpmnViewer.getDefinitions());
            console.log(self.bpmnViewer.getDefinitions());
            let xml = await self.bpmnViewer.saveXML({ format: true, preamble: true });

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
            var eventBus = self.bpmnViewer.get('eventBus');
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
            // let me = this
            // let obj = this.parseJsonAndAssignProperties(val);
            // console.log(obj);
            // let bpmnModdle = this.bpmnViewer.get('moddle');
            // const rootElements = obj.rootElements.map((element) => bpmnModdle.create(element.$type, element));
            // const diagrams = obj.diagrams.map((element) => bpmnModdle.create(element.$type, element));
            // const definitions = bpmnModdle.create('bpmn:Definitions', {
            //     ...obj,
            //     diagrams: diagrams,
            //     rootElements: rootElements
            // });
            // console.log(bpmnModdle);
            // console.log(definitions);
            // // let bpmnModdleObj = bpmnModdle.create(obj.$type);
            // // let obj = new BpmnModdle(val);
            this.bpmnViewer.importXML(val);
            // this.bpmnViewer.importDefinitions(obj)
        }

    },
    methods: {
        createModdleElements(json) {
            let bpmnModdle = this.bpmnViewer.get('moddle');
            return JSON.parse(json, function reviver(key, value) {
                if (value && typeof value === 'object' && value.$type) {
                    return bpmnModdle.create(value.$type, value);
                }
                return value;
            });
        },
        // moddle elements에 대해 $parent 속성을 설정하는 함수
        assignParents(element, parent) {
            let self = this;
            if (Array.isArray(element)) {
                element.forEach((child) => self.assignParents(child, parent));
            } else if (element && typeof element === 'object') {
                element.$parent = parent;
                Object.keys(element).forEach((prop) => {
                    if (prop === '$type' || prop === '$parent') return;
                    const value = element[prop];
                    if (Array.isArray(value) || (value && typeof value === 'object')) {
                        self.assignParents(value, element); // 재귀적으로 자식 요소에 대해 부모를 설정합니다.
                    }
                });
            }
        },

        // moddle elements에 대해 bpmnElement 속성을 설정하는 함수
        assignBpmnElementProperty(diagramElements, modelElementsById) {
            let self = this;
            if (Array.isArray(diagramElements))
                diagramElements.forEach((diagramElement) => {
                    // bpmnElement 속성이 ID 문자열로 제공되면, 해당 ID를 가진 모델 요소로 대체합니다.
                    const referencedModelElement = modelElementsById[diagramElement.bpmnElement];
                    if (referencedModelElement) {
                        diagramElement.bpmnElement = referencedModelElement;
                    }


                    // 재귀적으로 모든 하위 다이어그램 요소에 대해서도 동일한 작업을 수행합니다.
                    Object.values(diagramElement).forEach((value) => {
                        if (Array.isArray(value) || (value && typeof value === 'object')) {
                            self.assignBpmnElementProperty(value, modelElementsById);
                        }
                    });
                });
        },

        // JSON 문자열을 파싱하고 모든 객체 값을 moddle element로 변환하며, $parent 및 bpmnElement 속성을 설정합니다.
        parseJsonAndAssignProperties(jsonString) {
            let self = this;
            const elements = self.createModdleElements(jsonString);
            const modelElementsById = {};

            // 모델 요소의 ID를 키로 사용하여 사전을 생성합니다.
            function indexModelElements(element) {
                if (element.id) {
                    modelElementsById[element.id] = element;
                }
                Object.values(element).forEach((value) => {
                    if (Array.isArray(value) || (value && typeof value === 'object')) {
                        indexModelElements(value);
                    }
                });
            }

            // 모든 모델 요소를 인덱싱합니다.
            indexModelElements(elements);

            // $parent 속성을 설정합니다.
            self.assignParents(elements, null);

            // 다이어그램 요소에 대한 bpmnElement 속성을 설정합니다.
            if (elements.diagrams) {
                elements.diagrams.forEach((diagram) => {
                    if (diagram.plane && diagram.plane.planeElement) {
                        self.assignBpmnElementProperty(diagram.plane.planeElement, modelElementsById);
                    }
                });
            }

            return elements;
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
