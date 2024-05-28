<template>
    <div class="form-mapper">
        <v-card>
            <v-row class="ma-0 pa-0">
                <!-- {{$t('processDefinition.editProcessData') }} -->
                <v-card-title class="ma-0 pa-0" style="padding: 15px 0px 0px 25px !important"> Form Mapper - {{ name }} </v-card-title>
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
                    :nodes="leftNodes"
                    class="left-treeview"
                    :key="renderKey"
                    @nodeOpened="handleNodeClick(leftNodes, 'Source')"
                    @nodeClosed="handleNodeClick(leftNodes, 'Source')"
                >
                </v-treeview>

                <ContextMenu
                    ref="contextMenu"
                    :menu-items="filterTransformItems(blockTemplates)"
                    :style="menuPositionStyle"
                    :position-x="menu_x"
                    :position-y="menu_y"
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
                        v-memo="[block.pos, block.size]"
                    ></block-component>
                    <connector-component
                        v-for="(conn, index) in connectors"
                        :key="index"
                        :start-pos="conn.startPos"
                        :end-pos="conn.endPos"
                        :is-new="conn.isNew"
                        :onclick="() => removeConnection(index)"
                        v-memo="[conn.startPos, conn.endPos]"
                    ></connector-component>
                    <port-component
                        v-for="port in ports"
                        :key="port.blockName + ',' + port.name"
                        :pos="port.pos"
                        :name="port.name"
                        :block-name="port.blockName"
                        :direction="port.direction"
                        :appendComponent="appendComponent"
                        :onmousedown="newConnection(port.blockName, port.name, port.direction)"
                        :onmouseup="completeConnection(port.blockName, port.name, port.direction)"
                        v-memo="[port.pos]"
                    ></port-component>
                    <attribute-component
                        v-for="attribute in attributes_"
                        :key="attribute.blockName + ',' + attribute.name"
                        :pos="attribute.pos"
                        :name="attribute.name"
                        :value="attribute.value"
                        :block-name="attribute.blockName"
                        :func="attribute.func"
                        :appendComponent="appendComponent"
                        @onChangeAttribute="onChangeAttribute"
                        v-memo="[attribute.pos, attribute.value]"
                    ></attribute-component>
                </svg>

                <v-treeview
                    :config="config"
                    :nodes="rightNodes"
                    class="right-treeview"
                    :key="renderKey"
                    @nodeOpened="handleNodeClick(rightNodes, 'Target')"
                    @nodeClosed="handleNodeClick(rightNodes, 'Target')"
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
        },
        roles: Array,
        activities: Array
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
            leftNodes: {},
            rightNodes: {},
            config: {
                roots: ['id1', 'id2']
            },
            processVariableDescriptors: [],
            portArray: []
        };
    },
    async created() {
        await this.initializeStorage();
        await this.initializeNodesAndConfig();
        await this.processNodes(this.leftNodes, 'Source');
        await this.processNodes(this.rightNodes, 'Target');
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
            }, 500);
        });

        this.renderFormMapperFromMappingElementJson(this.formMapperJson);
    },
    methods: {
        async initializeStorage() {
            this.storage = StorageBaseFactory.getStorage('supabase');
        },
        async initializeNodesAndConfig() {
            this.leftNodes = {};
            this.rightNodes = {};
            this.config = {
                roots: []
            };
        },
        reverseObject(obj) {
            const reversedObj = {};
            const keys = Object.keys(obj).reverse();

            keys.forEach((key) => {
                reversedObj[key] = obj[key];
            });

            return reversedObj;
        },
        fetchAndProcessFormDefinitions(nodes, variable) {
            // 재귀적으로 필드를 처리하는 함수
            const processFields = (fields, parentNode) => {
                fields.forEach((field) => {
                    let node = {
                        text: field.name,
                        alias: field.alias,
                        children: []
                    };
                    parentNode.children.push(field.name); // 현재 노드를 부모 노드의 자식으로 추가
                    nodes[field.name] = node; // nodes 객체에 현재 필드 노드 저장
                    if (field.fields && field.fields.length > 0) {
                        processFields(field.fields, node); // 하위 필드가 있으면 재귀적으로 처리
                    }
                });
            };

            // 최상위 필드 처리 시작
            if (variable.fields && variable.fields.length > 0) {
                processFields(variable.fields, nodes[variable.name]);
            }
        },
        async processNodes(nodes, blockName) {
            this.processVariableNodes(nodes);
            this.processRoleNodes(nodes);
            this.processInstanceNodes(nodes);
            this.processActivityNodes(nodes);
            this.updateBlockTemplates(nodes, blockName);
            this.blockTemplates.Source.ports = this.reverseObject(this.blockTemplates.Source.ports);
            this.blockTemplates.Target.ports = this.reverseObject(this.blockTemplates.Target.ports);
        },
        processVariableNodes(nodes) {
            const definition = this.definition;
            for (const variable of definition.processVariables) {
                if (!this.config.roots.includes('Variables')) {
                    this.config.roots.push('Variables');
                }

                if (!nodes['Variables']) {
                    nodes['Variables'] = {
                        text: 'Variables',
                        children: [],
                        parent: null
                    };
                }

                if (nodes['Variables']) {
                    nodes['Variables'].children.push(variable.name);
                    nodes[variable.name] = {
                        text: variable.name,
                        children: []
                    };
                }

                this.fetchAndProcessFormDefinitions(nodes, variable);
            }
        },
        processRoleNodes(nodes) {
            const roles = this.roles;
            if (roles.length > 0) {
                if (!this.config.roots.includes('roles')) {
                    this.config.roots.push('roles');
                }

                if (!nodes['roles']) {
                    nodes['roles'] = {
                        text: 'roles',
                        children: [],
                        parent: null
                    };
                }

                roles.forEach((role) => {
                    if (nodes['roles']) {
                        nodes['roles'].children.push(role);
                        nodes[role] = {
                            text: role,
                            children: []
                        };
                    }
                });
            }
        },
        processInstanceNodes(nodes) {
            if (!this.config.roots.includes('instance')) {
                this.config.roots.push('instance');
            }

            if (!this.config.roots.includes('instance')) {
                this.config.roots.push('instance');
            }

            if (!nodes['instance']) {
                nodes['instance'] = {
                    text: 'instance',
                    children: [],
                    parent: null
                };
            }

            let instanceNodes = [
                'instanceId',
                'name',
                'locale',
                'status',
                'info',
                'dueDate',
                'mainProcessInstanceId',
                'mainActivityTracingTag',
                'rootProcessInstanceId',
                'ext1',
                'ext2',
                'ext3',
                'ext4',
                'ext5'
            ];

            if (nodes['instance']) {
                nodes['instance'].children = [];
                instanceNodes.forEach((node) => {
                    nodes['instance'].children.push(node);
                    nodes[node] = {
                        text: node,
                        children: []
                    };
                });
            }
        },
        processActivityNodes(nodes) {
            const activities = this.activities;
            if (activities.length > 0) {
                let activityNodes = ['startedTime', 'endTime', 'dueDate', 'duration', 'businessStatus', 'status'];

                if (!this.config.roots.includes('activities')) {
                    this.config.roots.push('activities');
                }

                if (!nodes['activities']) {
                    nodes['activities'] = {
                        text: 'activities',
                        children: [],
                        parent: null
                    };
                }

                if (nodes['activities']) {
                    nodes['activities'].children = [];
                    activities.forEach((activity) => {
                        nodes['activities'].children.push(activity.name);
                        nodes[activity.name] = {
                            text: activity.name,
                            children: []
                        };
                        activityNodes.forEach((node) => {
                            if (!nodes[activity.name]) {
                                nodes[activity.name] = {
                                    text: activity.name,
                                    children: []
                                };
                            }

                            nodes[activity.name].children.push(node);
                            nodes[node] = {
                                text: node,
                                children: []
                            };
                        });
                    });
                }
            }
        },
        updateBlockTemplates(nodes, blockName) {
            const treeStructure = this.transformData(nodes);
            const nodeHeight = 24;
            this.resetTreeviewPorts(blockName);

            var offset = 0;

            const calculateOffsets = (nodeArray, path = '', parent = null) => {
                nodeArray.forEach((nodeObj) => {
                    const nodeName = Object.keys(nodeObj)[0];
                    const children = nodeObj[nodeName];
                    const currentPath = path ? `${path}.${nodeName}` : nodeName;

                    if (nodes[nodeName] && parent && nodes[parent] && nodes[parent].state && nodes[parent].state.opened) {
                        offset += nodeHeight;
                    }
                    if (path != '') {
                        this.addPortToBlockTemplates(currentPath, offset, blockName);
                    }
                    if (children.length > 0) {
                        calculateOffsets(children, currentPath, nodeName);
                    }
                    if (parent == null) {
                        offset += nodeHeight;
                    }
                });
            };

            calculateOffsets(treeStructure);

        },
        addPortToBlockTemplates(nodePath, yOffset, blockName) {
            if (blockName == 'Source') {
                this.blockTemplates.Source.ports[nodePath] = {
                    x: 5,
                    y: yOffset,
                    direction: 'out'
                };
            } else if (blockName == 'Target') {
                this.blockTemplates.Target.ports[nodePath] = {
                    x: -5,
                    y: yOffset,
                    direction: 'in'
                };
            }
        },
        resetTreeviewPorts(blockName) {
            if (this.blockTemplates[blockName] && this.blockTemplates[blockName].ports) {
                this.blockTemplates[blockName].ports = {};
            }
        },
        transformData(nodes) {
            var data = nodes;
            function processNode(nodeId) {
                const node = data[nodeId];
                if (!node) return null;

                const obj = {};
                if (node.children && node.children.length > 0) {
                    const childrenArray = node.children.map((childId) => processNode(childId)).filter((n) => n !== null);
                    obj[node.text] = childrenArray.length > 0 ? childrenArray : [];
                } else {
                    obj[node.text] = [];
                }

                return obj;
            }

            const result = [];
            const rootKeys = Object.keys(data).filter((key) => data[key].parent === null);

            // 필터링된 키에 대해 반복 처리
            rootKeys.forEach((key) => {
                const rootNode = data[key];
                // 이미 parent === null 조건을 만족하는 키들을 필터링 했으므로 추가적인 검사 필요 없음
                const nodeData = processNode(key);
                if (nodeData) {
                    result.push(nodeData);
                }
            });

            return result;
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
        handleNodeClick(nodes, blockName) {
            this.portIndex = 0;
            this.updateBlockTemplates(nodes, blockName);
            this.blockTemplates.Source.ports = this.reverseObject(this.blockTemplates.Source.ports);
            this.blockTemplates.Target.ports = this.reverseObject(this.blockTemplates.Target.ports);
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

            this.menu_x = mouseX - 50;
            this.menu_y = mouseY / 2 + svgRect.y * 2;
            this.component_x = mouseX;
            this.component_y = mouseY;
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
    watch: {
        definition: {
            async handler() {
                await this.initializeNodesAndConfig();
                await this.processNodes(this.leftNodes, 'Source');
                await this.processNodes(this.rightNodes, 'Target');
            },
            deep: true
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

.form-mapper .tree .right-treeview {
    transform: scaleX(-1);
}

.form-mapper .right-treeview .input-wrapper {
    transform: scaleX(-1);
}
.form-mapper .tree-node .tree-level {
    padding-left: 16px !important;
}

.form-mapper .tree-node .node-wrapper {
    border-block-color: #eee;
    border-block-width: 1px;
    border-block-style: solid;
    width:100%;
    height: 24px;
    font-weight: bold;
    user-select: none;
}

.form-mapper .tree-node .tree-node .node-wrapper {
    height: 24px;
    font-weight: normal;
}
.form-mapper .tree-node .node-wrapper:hover {
    background: #eee;
}
.form-mapper .form-menu {
    max-height: 300px;
    overflow-y: auto;
}
.form-mapper .tree-node .input-wrapper {
    align-self: center;
    margin-left: 36px;
}
.form-mapper .tree-node .icon-wrapper {
    align-self: center;
    width: 100%;
    height: 23px;
    margin-left: 12px;
    position: relative;
    z-index: 1;
}

.form-mapper .tree-node .input-wrapper {
    position: fixed;
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
/* .form-mapper .tree-level {
    padding-left: 0 !important;
} */
.form-mapper .left-treeview {
    width: 250px;
}
.form-mapper .right-treeview {
    width: 250px;
}
</style>

