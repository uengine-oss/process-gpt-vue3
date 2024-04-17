<template>
    <div class="form-mapper">
        <v-card>
            <v-row class="ma-0 pa-0">
                <!-- {{$t('processDefinition.editProcessData') }} -->
                <v-card-title class="ma-0 pa-0" style="padding: 15px 0px 0px 25px !important"> Form Mapper </v-card-title>
                <v-spacer></v-spacer>
                <v-btn icon @click="saveFormMapperJson()">
                    <v-icon>mdi-content-save-outline</v-icon>
                </v-btn>
                <!-- <v-btn icon @click="openFunctionMenu()">
                    <v-icon>mdi-function</v-icon>
                </v-btn> -->
            </v-row>
            <div id="app" class="treeviews-container" @contextmenu.prevent="showContextMenu($event)">
                <v-treeview
                    :config="config"
                    :nodes="nodes"
                    class="left-treeview"
                    :key="renderKey"
                    @nodeOpened="handleNodeClick"
                    @nodeClosed="handleNodeClick()"
                >
                </v-treeview>

                <ContextMenu
                    ref="contextMenu"
                    :menu-items="filterTransformItems(blockTemplates)"
                    :style="menuPositionStyle"
                    :position-x="x"
                    :position-y="y"
                    :max-height="300"
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

                <svg class="test1" id="formArea" ref="svgElement" @mousemove="updateMousePos" @mouseup="onMouseUp">
                    <block-component
                        v-for="(block, name) in blocks_"
                        :key="name"
                        :pos="block.pos"
                        :size="block.size"
                        :name="block.name"
                        :appendable="block.appendable"
                        :appendComponent="appendComponent"
                        :start-block-drag="startBlockDrag"
                        :delete-block="deleteBlock"
                        @toggle-append="toggleAppend"
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
                        :tree-view="nodes"
                        :appendComponent="appendComponent"
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
                        :appendComponent="appendComponent"
                        @onChangeAttribute="onChangeAttribute"
                    ></attribute-component>
                </svg>

                <v-treeview
                    :config="config"
                    :nodes="nodes"
                    class="right-treeview"
                    :key="renderKey"
                    @nodeOpened="handleNodeClick"
                    @nodeClosed="handleNodeClick()"
                >
                </v-treeview>
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
        },
        formMapperJson: {
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
            menu: false,
            menu_x: 0,
            menu_y: 0,
            component_x: 0,
            component_y: 0,
            portIndex: 0,
            nodes: {
                // id1: {
                //     text: 'text1',
                //     children: ['id11', 'id12']
                // },
                // id11: {
                //     text: 'text11'
                // },
                // id12: {
                //     text: 'text12',
                //     children: ['id123']
                // },
                // id2: {
                //     text: 'text2'
                // },
                // id123: {
                //     text: 'text123'
                // }
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
        this.$nextTick(() => {
            //다이얼로그가 생성될 시 이상한 위치로 되기에 일정 시간을 줌
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

        this.renderFormMapperFromMappingElementJson(this.formMapperJson);
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
            const treeStructure = this.buildTreeStructure();
            const nodeHeight = 24;

            const updatePorts = (treeNode, path = '', yOffset = 0, isRootClosed = false) => {
                if (!treeNode) return;

                const effectiveYOffset = isRootClosed ? yOffset : yOffset + nodeHeight;
                const currentPath = path ? `${path}.${treeNode.text}` : treeNode.text;
                if (!isRootClosed) {
                    this.addPortToBlockTemplates(currentPath, effectiveYOffset - nodeHeight);
                } else {
                    this.addPortToBlockTemplates(currentPath, effectiveYOffset);
                }

                if (treeNode.children && treeNode.children.length > 0) {
                    const nodeOpened = this.nodes[treeNode.text].state && this.nodes[treeNode.text].state.opened;
                    let cumulativeOffset = effectiveYOffset;

                    treeNode.children.forEach((childNode, index) => {
                        const child = this.nodes[childNode];
                        updatePorts(child, currentPath, cumulativeOffset, isRootClosed || !nodeOpened);
                        if (nodeOpened && !isRootClosed) {
                            cumulativeOffset += this.getNodeHeight(child);
                        }
                    });
                }
            };

            this.getNodeHeight = function (node) {
                let totalHeight = nodeHeight;
                if (node.state && node.state.opened && node.children) {
                    node.children.forEach((child) => {
                        totalHeight += this.getNodeHeight(this.nodes[child]);
                    });
                }
                return totalHeight;
            };

            treeStructure.forEach((rootNode, index) => {
                const rootYOffset = index * nodeHeight;
                const rootClosed = !(this.nodes[rootNode.text].state && this.nodes[rootNode.text].state.opened);
                updatePorts(rootNode, '', rootYOffset, rootClosed);
            });
        },
        addPortToBlockTemplates(nodePath, yOffset) {
            this.blockTemplates.Source.ports[nodePath] = {
                x: 5,
                y: yOffset,
                direction: 'out'
            };
            this.blockTemplates.Target.ports[nodePath] = {
                x: -5,
                y: yOffset,
                direction: 'in'
            };
        },
        buildTreeStructure() {
            const buildTree = (nodeKey) => {
                const node = this.nodes[nodeKey];
                if (!node) return null;

                let treeNode = { text: node.text, children: node.children || [] };
                return treeNode;
            };

            let tree = [];
            Object.keys(this.nodes).forEach((nodeKey) => {
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
        handleNodeClick() {
            this.portIndex = 0;
            this.updateBlockTemplates(); // 포트 위치 업데이트 메소드 호출
        },
        openFunctionMenu(event) {
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
        saveFormMapperJson() {
            var jsonString = JSON.stringify(this.getMappingElementsJson(), null, 2);
            this.$emit('saveFormMapperJson', jsonString);
        },
        menuItemSelected(item) {
            this.newBlock(item.title, { x: this.component_x, y: this.component_y });
        },
        onButtonClickLeft(item, type) {
            this.newBlock(type, { x: 450, y: 300 }, item.node.text);
        },
        onButtonClickRight(item, type) {
            this.newBlock(type, { x: 1450, y: 300 }, item.node.text);
        },
        onChangeAttribute(value, blockName, name) {
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
        },
        toggleAppend(blockName) {
            if (this.appendComponent[blockName] != undefined) {
                this.appendComponent[blockName] = !this.appendComponent[blockName];
            } else {
                this.appendComponent[blockName] = true;
            }
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
        }
    },
    onBeforeUnmount() {
        this.saveFormMapperJson();
    }
};
</script>

<style>
.form-mapper .v-toolbar {
    border-top-left-radius: 12px;
    border-top-right-radius: 12px;
}
.form-mapper .v-toolbar-title {
    font-size: 16px;
    font-weight: bold;
    color: #eee;
}
.form-mapper #formArea {
    width: 100%;
    height: 80vh;
    background: #eee;
}
.form-mapper .block > rect {
    fill: rgba(127, 127, 127, 1);
    stroke: #888;
    stroke-width: 2;
    rx: 4;
    ry: 4;
}
.form-mapper .block > text {
    font-size: 11px;
    fill: #fff;
    text-anchor: start;
    alignment-baseline: middle;
    pointer-events: none;
}
.form-mapper .block > .delete-button {
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

.form-mapper .port > text {
    font-size: 11px;
    fill: rgb(255, 255, 255);
    alignment-baseline: middle;
}
.form-mapper .port > rect {
    fill: rgb(59, 0, 66);
}
.form-mapper .port > rect.background {
    fill: rgba(63, 63, 63, 0);
    width: 50px;
    height: 20px;
}
.form-mapper .port:hover > text {
    fill: rgb(115, 0, 128);
}
.form-mapper .port:hover > rect {
    fill: rgb(115, 0, 128);
    stroke-width: 3px;
    stroke: rgb(115, 0, 128);
}
.form-mapper .port:hover > rect.background {
    fill: rgba(63, 63, 63, 0.5);
    stroke-width: 0;
}

.form-mapper .connector {
    stroke: #888;
    stroke-width: 3;
    fill: none;
}
.form-mapper .connector:hover {
    stroke: #f88;
    stroke-width: 4;
}
.form-mapper .connector.isNew,
.form-mapper .connector.isNew:hover {
    stroke: rgb(115, 0, 128);
    stroke-width: 3;
}

.form-mapper .treeviews-container {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
}

.form-mapper .right-treeview .node-wrapper {
    transform: scaleX(-1);
}

.form-mapper .right-treeview .input-wrapper {
    transform: scaleX(-1);
}

.form-mapper .form-menu {
    max-height: 300px;
    overflow-y: auto;
}
.form-mapper .tree-node .input-wrapper {
    align-self: center;
}
.form-mapper .tree-node .icon-wrapper {
    align-self: center;
    width: 24px;
    height: 24px;
    margin-left: 12px;
}
.form-mapper .tree-node .icon-wrapper svg {
    width: 12px;
    height: 12px;
}
.form-mapper .left-treeview button {
    margin-left: auto;
}
.form-mapper .right-treeview button {
    margin-left: auto;
}
.form-mapper .tree-level {
    padding-left: 0 !important;
}
.form-mapper .left-treeview {
    width: 200px;
}
.form-mapper .right-treeview {
    width: 200px;
}
</style>
