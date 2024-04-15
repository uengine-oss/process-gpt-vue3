<template>
    <div>
        <v-card>
            <v-row class="ma-0 pa-0">
                <!-- {{$t('processDefinition.editProcessData') }} -->
                <v-card-title class="ma-0 pa-0" style="padding: 15px 0px 0px 25px !important"> Form Mapper - {{ name }} </v-card-title>
                <v-spacer></v-spacer>
                <v-btn icon @click="openJsonDialog()">
                    <v-icon>mdi-content-save-outline</v-icon>
                </v-btn>
                <!-- <v-btn icon @click="openFunctionMenu()">
                    <v-icon>mdi-function</v-icon>
                </v-btn> -->
            </v-row>
            <div id="app" class="treeviews-container" @contextmenu.prevent="showContextMenu($event)">
                <v-treeview :config="config" :nodes="nodes" class="left-treeview"> </v-treeview>

                <ContextMenu
                    ref="contextMenu"
                    :menu-items="filterTransformItems(blockTemplates)"
                    :style="menuPositionStyle"
                    :position-x="x"
                    :position-y="y"
                    @menu_item_selected="menuItemSelected"
                />

                <v-dialog v-model="jsonDialog" max-width="600px">
                    <v-card>
                        <v-card-title>
                            Transformers JSON
                            <v-spacer></v-spacer>
                        </v-card-title>
                        <v-card-text style="max-height: 600px; overflow-y: auto">
                            <pre style="user-select: text">{{ jsonString }}</pre>
                        </v-card-text>
                    </v-card>
                </v-dialog>

                <svg id="formArea" ref="svgElement" @mousemove="updateMousePos" @mouseup="onMouseUp">
                    <block-component
                        v-for="(block, name) in blocks_"
                        :key="name"
                        :pos="block.pos"
                        :size="block.size"
                        :name="block.name"
                        :start-block-drag="startBlockDrag"
                        :delete-block="deleteBlock"
                    ></block-component>
                    <connector-component
                        v-for="(conn, index) in connectors"
                        :key="index"
                        :start-pos="conn.startPos"
                        :end-pos="conn.endPos"
                        :is-new="conn.isNew"
                        :onclick="() => removeConnection(index)"
                    ></connector-component>
                    <port-component
                        v-for="port in ports"
                        :key="port.blockName + ',' + port.name"
                        :pos="port.pos"
                        :name="port.name"
                        :block-name="port.blockName"
                        :direction="port.direction"
                        :parentNode="port.parentNode"
                        :onmousedown="newConnection(port.blockName, port.name, port.direction)"
                        :onmouseup="completeConnection(port.blockName, port.name, port.direction)"
                    ></port-component>
                    <attribute-component
                        v-for="attribute in attributes_"
                        :key="attribute.blockName + ',' + attribute.name"
                        :pos="attribute.pos"
                        :name="attribute.name"
                        :block-name="attribute.blockName"
                        :func="attribute.func"
                        @onChangeAttribute="onChangeAttribute"
                    ></attribute-component>
                </svg>

                <v-treeview :config="config" :nodes="nodes" class="right-treeview" :key="renderKey"> </v-treeview>
            </div>
        </v-card>
    </div>
</template>

<script>
import { useBpmnStore } from '@/stores/bpmn';
import VTreeview from 'vue3-treeview';
import AttributeComponent from './AttributeComponent.vue';
import BlockComponent from './BlockComponent.vue';
import ConnectorComponent from './ConnectorComponent.vue';
import PortComponent from './PortComponent.vue';
import FormMapper from './scripts/formMapper';
import ContextMenu from './ContextMenu.vue';

import StorageBaseFactory from '@/utils/StorageBaseFactory';

export default {
    name: 'form-mapper',
    mixins: [FormMapper],
    props: {
        definition: {
            type: Object,
            required: true
        },
        name: {
            type: String,
            required: true
        }
    },
    components: {
        BlockComponent,
        PortComponent,
        ConnectorComponent,
        AttributeComponent,
        ContextMenu,
        VTreeview
    },
    data() {
        return {
            storage: null,
            renderKey: 0,
            jsonDialog: false,
            jsonString: '',
            menu: false,
            menu_x: 0,
            menu_y: 0,
            component_x: 0,
            component_y: 0,
            portIndex: 0,
            nodes: {
                id1: {
                    text: 'text1',
                    children: ['id11', 'id12']
                },
                id11: {
                    text: 'text11'
                },
                id12: {
                    text: 'text12',
                    children: ['id123']
                },
                id2: {
                    text: 'text2'
                },
                id123: {
                    text: 'text123'
                }
            },
            config: {
                roots: ['id1', 'id2']
            },
            processVariableDescriptors: []
        };
    },
    async created() {
        await this.initializeStorage();
        this.initializeNodesAndConfig();
        await this.processVariables();
        this.updateBlockTemplates();
        this.renderKey++;
    },
    mounted() {
        let me = this;

        const formArea = document.getElementById('formArea');
        const resizeObserver = new ResizeObserver((entries) => {
            for (let entry of entries) {
                this.addTreeViewPort();
            }
        });
        this.$nextTick(() => {//다이얼로그가 생성될 시 이상한 위치로 되기에 일정 시간을 줌
            setTimeout(() => {
                this.addTreeViewPort();
            }, 300);
        });
        // processVariables가 준비되었는지 확인
        if (this.processVariables && this.processVariables.length > 0) {
            // processVariables 사용
            console.log(this.processVariables);
        } else {
            // 데이터가 준비되지 않았다면, watch를 사용하거나 다른 방법으로 처리
            this.$watch('processVariables', (newVal) => {
                if (newVal && newVal.length > 0) {
                    console.log(newVal);
                }
            });
        }

        this.renderFormMapperFromMappingElementJson('');
    },
    methods: {
        async initializeStorage() {
            this.storage = StorageBaseFactory.getStorage('supabase');
        },

        initializeNodesAndConfig() {
            this.nodes = {};
            this.config = {
                roots: []
            };
        },
        async fetchAndProcessFormDefinitions(variable) {
            let formDefs = await this.storage.list('form_def');
            let name = variable.defaultValue.name;
            let alias = variable.defaultValue.alias;
            let matchingForm = formDefs.find((form) => form.name === name && form.alias === alias);

            if (matchingForm) {
                matchingForm.fields.forEach((field) => {
                    if (!this.nodes[variable.name]) {
                        this.nodes[variable.name] = {
                            text: variable.name,
                            children: []
                        };
                    }
                    let fieldNameAlias = field.name + '_' + field.alias;
                    this.nodes[variable.name].children.push(field.name);
                    this.nodes[field.name] = {
                        text: field.name,
                        object: field
                    };
                });
            }
        },
        async processVariables() {
            const definition = this.definition;

            for (const variable of definition.processVariables) {
                if (!this.config.roots.includes('Variables')) {
                    this.config.roots.push('Variables');
                }

                if (!this.nodes['Variables']) {
                    this.nodes['Variables'] = {
                        text: 'Variables',
                        children: []
                    };
                }

                if (this.nodes['Variables']) {
                    this.nodes['Variables'].children.push(variable.name);
                    this.nodes[variable.name] = {
                        text: variable.name,
                        children: []
                    };
                }

                await this.fetchAndProcessFormDefinitions(variable);
            }
        },
        updateBlockTemplates() {
            const treeStructure = this.buildTreeStructure(); // 트리 구조 생성

            const updatePorts = (treeNode, path = '') => {
                if (!treeNode) return;

                const currentPath = path ? `${path}.${treeNode.text}` : treeNode.text;
                this.addPortToBlockTemplates(currentPath);

                if (treeNode.children && treeNode.children.length > 0) {
                    treeNode.children.forEach((childNode) => {
                        updatePorts(childNode, currentPath);
                    });
                }
            };
            treeStructure.forEach((rootNode) => updatePorts(rootNode));
        },
        addPortToBlockTemplates(nodePath, parentNode) {
            this.blockTemplates.Source.ports[nodePath] = {
                x: 5,
                y: 0,
                direction: 'out',
                parentNode: { name: parentNode, offset: { x: 0, y: 24 * this.portIndex } }
            };
            this.blockTemplates.Target.ports[nodePath] = {
                x: -5,
                y: 0,
                direction: 'in',
                parentNode: { name: parentNode, offset: { x: 0, y: 24 * this.portIndex } }
            };
            this.portIndex++;
        },

        buildTreeStructure() {
            const buildTree = (nodeKey) => {
                const node = this.nodes[nodeKey];
                if (!node) return null;

                let treeNode = { text: node.text };
                if (node.children && node.children.length > 0) {
                    treeNode.children = node.children.map((childKey) => buildTree(childKey));
                }
                return treeNode;
            };

            let tree = [];
            Object.keys(this.nodes).forEach((nodeKey) => {
                // 최상위 노드만 탐색 시작점으로 삼습니다.
                // 최상위 노드는 다른 어떤 노드의 자식도 아니어야 합니다.
                const isRootNode = !Object.values(this.nodes).some((n) => n.children && n.children.includes(nodeKey));
                if (isRootNode) {
                    tree.push(buildTree(nodeKey));
                }
            });

            return tree;
        },
        addTreeViewPort() {
            var me = this;
            const formAreaRect = document.getElementById('formArea').getBoundingClientRect();

            if (this.blocks['Source']) {
                delete this.blocks['Source'];
            }
            if (this.blocks['Target']) {
                delete this.blocks['Target'];
            }
            me.blocks['Source'] = {
                type: 'Source',
                pos: { x: 0, y: 12 },
                attributes: {}
            };

            me.blocks['Target'] = {
                type: 'Target',
                pos: { x: formAreaRect.width, y: 12 },
                attributes: {}
            };
        },
        openFunctionMenu(event) {
            console.log('click menu');
            if (event) {
                const svgElement = this.$refs.svgElement;

                const svgRect = svgElement.getBoundingClientRect();

                const mouseX = event.clientX;
                const mouseY = event.clientY;

                this.menu_x = mouseX;
                this.menu_y = mouseY;
                this.component_x = this.menu_x;
                this.component_y = this.menu_y;
            }
            this.menu = true;
        },
        openJsonDialog() {
            console.log('open json');
            this.jsonString = JSON.stringify(this.getMappingElementsJson(), null, 2);
            this.jsonDialog = true; // 다이얼로그 열기
        },
        menuItemSelected(item) {
            console.log('Selected:', item);
            this.newBlock(item.title, { x: this.component_x, y: this.component_y });
        },
        onButtonClickLeft(item, type) {
            console.log('Button clicked:', item.node.text, type);
            this.newBlock(type, { x: 450, y: 300 }, item.node.text);
        },
        onButtonClickRight(item, type) {
            console.log('Button clicked:', item.node.text, type);
            this.newBlock(type, { x: 1450, y: 300 }, item.node.text);
        },
        onChangeAttribute(value, blockName, name) {
            console.log('onChangeAttribute', value, blockName, name);
            this.blocks[blockName].attributes[name] = value;
        },
        showContextMenu(event) {
            const svgElement = this.$refs.svgElement;

            const svgRect = svgElement.getBoundingClientRect();

            const mouseX = event.clientX;
            const mouseY = event.clientY;

            this.menu_x = mouseX;
            this.menu_y = mouseY;
            this.component_x = this.menu_x;
            this.component_y = this.menu_y;
            this.$refs.contextMenu.showContextMenu(this.x, this.y);
        }
    },
    computed: {
        menuPositionStyle() {
            return {
                position: 'absolute',
                left: `${this.menu_x}px`,
                top: `${this.menu_y}px`,
                transform: 'translate(0, -50%)'
            };
        },

        transformers() {
            return {
                mappingElements: [
                    {
                        _type: 'org.uengine.kernel.MappingElement',
                        argument: {},
                        transformerMapping: {
                            transformer: {
                                _type: 'org.uengine.processdesigner.mapper.transformers.ConcatTransformer',
                                name: 'Concat',
                                location: { x: 365.78125, y: 146.5 },
                                argumentSourceMap: { str1: 'trouble_class' }
                            },
                            linkedArgumentName: 'out'
                        },
                        isKey: false
                    },
                    {
                        _type: 'org.uengine.kernel.MappingElement',
                        argument: {},
                        transformerMapping: {
                            transformer: {
                                _type: 'org.uengine.processdesigner.mapper.transformers.ConcatTransformer',
                                name: 'Concat',
                                location: { x: 360.78125, y: 432.5 },
                                argumentSourceMap: { str1: 'trouble_class' }
                            },
                            linkedArgumentName: 'out'
                        },
                        isKey: false
                    }
                ]
            };
        }
    }
};
</script>

<style>
.v-toolbar {
    border-top-left-radius: 12px;
    border-top-right-radius: 12px;
}
.v-toolbar-title {
    font-size: 16px;
    font-weight: bold;
    color: #eee;
}
#formArea {
    width: 100%;
    height: 80vh;
    background: #eee;
}
.block > rect {
    fill: rgba(127, 127, 127, 1);
    stroke: #888;
    stroke-width: 2;
    rx: 4;
    ry: 4;
}
.block > text {
    font-size: 11px;
    fill: #fff;
    text-anchor: middle;
    alignment-baseline: middle;
    pointer-events: none;
}
.block > .delete-button {
    background: none;
    border: none;
    cursor: pointer;
    width: 24px;
    height: 24px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
}

.port > text {
    font-size: 11px;
    fill: rgb(255, 255, 255);
    alignment-baseline: middle;
}
.port > rect {
    fill: rgb(59, 0, 66);
}
.port > rect.background {
    fill: rgba(63, 63, 63, 0);
    width: 50px;
    height: 20px;
}
.port:hover > text {
    fill: rgb(115, 0, 128);
}
.port:hover > rect {
    fill: rgb(115, 0, 128);
    stroke-width: 3px;
    stroke: rgb(115, 0, 128);
}
.port:hover > rect.background {
    fill: rgba(63, 63, 63, 0.5);
    stroke-width: 0;
}

.connector {
    stroke: #888;
    stroke-width: 3;
    fill: none;
}
.connector:hover {
    stroke: #f88;
    stroke-width: 4;
}
.connector.isNew,
.connector.isNew:hover {
    stroke: rgb(115, 0, 128);
    stroke-width: 3;
}

.treeviews-container {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
}

.right-treeview .node-wrapper {
    transform: scaleX(-1);
}

.right-treeview .input-wrapper {
    transform: scaleX(-1);
}

.form-menu {
    max-height: 300px;
    overflow-y: auto;
}
.tree-node .input-wrapper {
    align-self: center;
}
.tree-node .icon-wrapper {
    align-self: center;
    width: 24px;
    height: 24px;
    margin-left: 12px;
}
.tree-node .icon-wrapper svg {
    width: 12px;
    height: 12px;
}
.left-treeview button {
    margin-left: auto;
}
.right-treeview button {
    margin-left: auto;
}
.tree-level {
    padding-left: 0 !important;
}
.left-treeview {
    width: 200px;
}
.right-treeview {
    width: 200px;
}
</style>
