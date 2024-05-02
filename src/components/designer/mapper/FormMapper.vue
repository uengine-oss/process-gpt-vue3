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
                        :appendComponent="appendComponent"
                        :onmousedown="newConnection(port.blockName, port.name, port.direction)"
                        :onmouseup="completeConnection(port.blockName, port.name, port.direction)"
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
            leftNodes: {
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
            rightNodes: {
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
        // if (this.processVariables && this.processVariables.length > 0) {
        //     // processVariables 사용
        //     console.log(this.processVariables);
        // } else {
        //     // 데이터가 준비되지 않았다면, watch를 사용하거나 다른 방법으로 처리
        //     this.$watch('processVariables', (newVal) => {
        //         if (newVal && newVal.length > 0) {
        //             console.log(newVal);
        //         }
        //     });
        // }

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
        async fetchAndProcessFormDefinitions(nodes, variable) {
            let name = variable.name;
            let matchingForm = this.definition.processVariables.find((form) => form.name === name && form.type === 'Form' && form.fields);

            if (matchingForm) {
                matchingForm.fields.forEach((field) => {
                    if (!nodes[variable.name]) {
                        nodes[variable.name] = {
                            text: variable.name,
                            children: []
                        };
                    }
                    let fieldNameAlias = field.name + '_' + field.alias;
                    nodes[variable.name].children.push(field.name);
                    nodes[field.name] = {
                        text: field.name,
                        object: field
                    };
                });
            }
        },
        async processVariables(nodes, blockName) {
            const definition = this.definition;

            for (const variable of definition.processVariables) {
                if (!this.config.roots.includes('Variables')) {
                    this.config.roots.push('Variables');
                }

                if (!nodes['Variables']) {
                    nodes['Variables'] = {
                        text: 'Variables',
                        children: []
                    };
                }

                if (nodes['Variables']) {
                    nodes['Variables'].children.push(variable.name);
                    nodes[variable.name] = {
                        text: variable.name,
                        children: []
                    };
                }

                await this.fetchAndProcessFormDefinitions(nodes, variable);
            }

            if (this.roles.length > 0) {
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

                this.roles.forEach((role) => {
                    if (nodes['roles']) {
                        nodes['roles'].children.push(role);
                        nodes[role] = {
                            text: role,
                            children: []
                        };
                    }
                });
            }

            if(this.activities.length > 0){
                if(!this.config.roots.includes('instance')){
                    this.config.roots.push('instance')
                }

                if(!nodes['instance']){
                    nodes['instance'] = {
                        text: 'instance',
                        children: []
                    }
                }

                let instanceNodes = ['instanceId', 'name', 'locale', 'status', 'info', 'dueDate',
                                    'mainProcessInstanceId', 'mainActivityTracingTag', 'rootProcessInstanceId',
                                    'dummy1', 'dummy2', 'dummy3', 'dummy4', 'dummy5']

                instanceNodes.forEach((node) => {
                    if(nodes['instance']){
                        nodes['instance'].children.push(node)
                        nodes[node] = {
                            text: node,
                            children: []
                        }
                    }
                })
            }

            if(this.activities.length > 0){
                let activityNodes = ['startedTime', 'endTime', 'dueDate', 'duration', 'businessStatus', 'status']

                if(!this.config.roots.includes('activities')){
                    this.config.roots.push('activities')
                }

                if(!nodes['activities']){
                    nodes['activities'] = {
                        text: 'activities',
                        children: []
                    }
                }

                this.activities.forEach((activity) => {
                    if(nodes['activities']){
                        nodes['activities'].children.push(activity.name)
                        nodes[activity.name] = {
                            text: activity.name,
                            children: []
                        }
                    }
                    
                    activityNodes.forEach((node) => {
                        if (!nodes[activity.name]) {
                            nodes[activity.name] = {
                                text: activity.name,
                                children: []
                            };
                        }

                        nodes[activity.name].children.push(node)
                        nodes[node] = {
                            text: node,
                            children: []
                        }
                    })
                })
            }

            this.updateBlockTemplates(nodes, blockName);
        },
        updateBlockTemplates(nodes, blockName) {
            const treeStructure = this.transformData(nodes);
            const nodeHeight = 24;
            this.resetTreeviewPorts(blockName);

            const updatePorts = (treeNode, path = '', yOffset = 0, isRootClosed = false) => {
                const treeNodeText = Object.keys(treeNode)[0];
                const currentPath = path ? `${path}.${treeNodeText}` : treeNodeText;
                let effectiveYOffset = yOffset + (isRootClosed ? 0 : nodeHeight);

                if (path != '') {
                    this.addPortToBlockTemplates(currentPath, effectiveYOffset - (isRootClosed ? 0 : nodeHeight), blockName);
                }

                const children = treeNode[treeNodeText];
                if (children.length > 0) {
                    const nodeOpened = nodes[treeNodeText].state && nodes[treeNodeText].state.opened;
                    children.forEach((childNode) => {
                        effectiveYOffset = updatePorts(childNode, currentPath, effectiveYOffset, isRootClosed || !nodeOpened);
                    });
                }

                return effectiveYOffset;
            };

            var rootYOffset = 0;
            treeStructure.forEach((rootNode, index) => {
                const rootText = Object.keys(rootNode)[0];
                const rootClosed = !(nodes[rootText].state && nodes[rootText].state.opened);
                if (index > 0) {
                    const higherText = Object.keys(treeStructure[index - 1])[0];
                    const higherClosed = !(nodes[higherText].state && nodes[higherText].state.opened);
                    if (higherClosed) {
                        rootYOffset += index * nodeHeight;
                    }
                }

                rootYOffset += updatePorts(rootNode, '', rootYOffset, rootClosed);
            });
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
            Object.keys(data).forEach((key) => {
                const rootNode = data[key];
                if (rootNode && rootNode.parent === null) {
                    // Assuming the root nodes have 'parent' set to null
                    const nodeData = processNode(key);
                    if (nodeData) {
                        result.push(nodeData);
                    }
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
                await this.processVariables(this.leftNodes, 'Source');
                await this.processVariables(this.rightNodes, 'Target');
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
.form-mapper .tree-node .tree-level{
    padding-left: 8px !important;
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
/* .form-mapper .tree-level {
    padding-left: 0 !important;
} */
.form-mapper .left-treeview {
    width: 200px;
}
.form-mapper .right-treeview {
    width: 200px;
}
</style>
