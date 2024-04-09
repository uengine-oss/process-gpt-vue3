<template>
    <div>
        <v-toolbar>
            <v-toolbar-title>Form Mapper</v-toolbar-title>

            <v-btn icon @click="openJsonDialog()">
                <v-icon style="color: #eee">mdi-content-save-outline</v-icon>
            </v-btn>
            <!-- <v-btn icon @click="openFunctionMenu()">
                <v-icon>mdi-function</v-icon>
            </v-btn> -->
        </v-toolbar>
    </div>
    <div id="app" class="treeviews-container" @contextmenu.prevent="showContextMenu($event)">
        <v-treeview :config="config" :nodes="nodes" class="left-treeview elevation-1">
            <template #after-input="item">
                <v-btn class="after" small @click.stop="onButtonClickLeft(item, 'Source')">▶</v-btn>
            </template>
        </v-treeview>

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

        <v-treeview :config="config" :nodes="nodes" class="right-treeview elevation-1" :key="renderKey">
            <template #after-input="item">
                <v-btn class="after" small @click.stop="onButtonClickRight(item, 'Target')">▶</v-btn>
            </template>
        </v-treeview>
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
    name: "form-mapper",
    mixins: [FormMapper],
    props: {
        definition: {
            type: Object,
            required: true,
        },
    },
    components: {
        BlockComponent,
        PortComponent,
        ConnectorComponent,
        AttributeComponent,
        ContextMenu,
        VTreeview,
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
            processVariableDescriptors: [],
        };
    },
    async created() {
        let me = this

        me.storage = StorageBaseFactory.getStorage('supabase');

        const definition = this.definition;

        me.nodes = {};
        me.config = {
            roots: []
        };

        var test = [
                {'name': "장애신고",
                'type': "Form",
                'defaultValue': "form11_장애신고",
                'description': "",
                'datasource': {
                    'type': "",
                    'sql': ""
                },
                'table': ""},
                {'name': "장애처리",
                'type': "Form",
                'defaultValue': "form22_장애처리",
                'description': "",
                'datasource': {
                    'type': "",
                    'sql': ""
                },
                'table': ""},
                {'name': "처리알림",
                'type': "Form",
                'defaultValue': "form33_처리알림",
                'description': "",
                'datasource': {
                    'type': "",
                    'sql': ""
                },
                'table': ""},
                {'name': "비고",
                'type': "Text",
                'defaultValue': "",
                'description': "",
                'datasource': {
                    'type': "",
                    'sql': ""
                },
                'table': ""}
        ]

        test.forEach(async (variable) => {
            if (!me.config.roots.includes("Variables")) {
                me.config.roots.push("Variables");
            }

            if (!me.nodes["Variables"]) {
                me.nodes["Variables"] = {
                    text: "Variables",
                    children: []
                };
            }

            if(me.nodes["Variables"]){
                me.nodes["Variables"].children.push(variable.name);
                me.nodes[variable.name] = {
                    text: variable.name,
                    children: []
                };
            }

            let formDefs = await me.storage.list('form_def');
            let [formName, formAlias] = variable.defaultValue.split('_');
            let matchingForm = formDefs.find(form => form.name === formName && form.alias === formAlias)

            if (matchingForm) {
                matchingForm.fields.forEach(field => {
                    if (!me.nodes[variable.name]) {
                        me.nodes[variable.name] = {
                            text: variable.name,
                            children: []
                        };
                    }
                    let fieldNameAlias = field.name + '_' + field.alias;
                    me.nodes[variable.name].children.push(field.name);
                    me.nodes[field.name] = {
                        text: field.name,
                        object: field
                    };
                });
            }

            // form.fields.forEach(async (field) => {
            //     me.nodes[form.id].children.push(field.name + '_' + field.alias);
            //     me.nodes[field.name + '_' + field.alias] = {
            //         text: field.name + '_' + field.alias
            //     };
            // });
        });

        me.renderKey++;
    },
    mounted() {
        let me = this;

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
    },
    methods: {
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
            this.jsonString = JSON.stringify(this.transformers, null, 2);
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
        }
    }
};
</script>

<style>
#app {
    box-sizing: border-box;
    width: 100%;
    height: 100vh;
    margin: 0;
    padding: 0;
    overflow: hidden;
    background: white;
    border-bottom-left-radius: 12px;
    border-bottom-right-radius: 12px;
    user-select: none;
}
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
    height: 100vh;
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
.left-treeview button{
    margin-left: auto;
}
.right-treeview button{
    margin-left: auto;
}
.tree-level  {
    padding-left: 0 !important;
}
</style>
