<template>
    <div>
        <v-toolbar extended>
            <v-toolbar-title>Form Mapper</v-toolbar-title>

            <v-spacer></v-spacer>
            <v-btn icon @click="openJsonDialog()">
                <v-icon>mdi-script-outline</v-icon>
            </v-btn>
            <v-btn icon @click="openFunctionMenu()">
                <v-icon>mdi-function</v-icon>
            </v-btn>
        </v-toolbar>
    </div>
    <div id="app" class="treeviews-container" @contextmenu.prevent="openFunctionMenu($event)">
        <v-treeview :config="config" :nodes="nodes" class="left-treeview">
            <template #after-input="item">
                <v-btn class="after" small @click.stop="onButtonClickLeft(item, 'Source')">▶</v-btn>
            </template>
        </v-treeview>

        <v-menu v-model="menu" :position-x="menu_x" :position-y="menu_y" absolute :style="menuPositionStyle">
            <v-list class="form-menu" style="max-height: 300px; overflow-y: auto">
                <v-list-item v-for="(item, index) in filterTransformItems(blockTemplates)" :key="index" @click="menuItemSelected(item)">
                    <v-list-item-title>{{ item }}</v-list-item-title>
                </v-list-item>
            </v-list>
        </v-menu>

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
                v-for="attribute in attributes"
                :key="attribute.blockName + ',' + attribute.name"
                :pos="attribute.pos"
                :name="attribute.name"
                :block-name="attribute.blockName"
                :func="attribute.func"
            ></attribute-component>
        </svg>

        <v-treeview :config="config" :nodes="nodes" class="right-treeview" :key="renderKey">
            <template #after-input="item">
                <v-btn class="after" small @click.stop="onButtonClickRight(item, 'Target')">▶</v-btn>
            </template>
        </v-treeview>
        <!-- <div id="sidebar">
      <h4>Blocks:</h4>
      <pre>{{ JSON.stringify(blocks, null, "  ") }}</pre>
      <h4>Connections:</h4>
      <pre>{{ JSON.stringify(connections, null, "  ") }}</pre>
    </div> -->
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

import ProcessDefinition from '@/components/ProcessDefinition.vue';
import StorageBaseFactory from '@/utils/StorageBaseFactory';

export default {
    name: "form-mapper",
    mixins: [FormMapper, ProcessDefinition],
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

        const definition = this.definition;
        console.log(definition.processVariables)
        

        const store = useBpmnStore();
        this.modeler = store.getModeler;
        let def = modeler.getDefinitions();
        const processElement = def.rootElements.find(element => element.$type === 'bpmn:Process');
        if (!processElement) {
            console.error('bpmn:Process element not found');
            return;
        }

        // // bpmn2:process 요소 내의 bpmn2:extensionElements 요소를 찾거나 새로 생성합니다.
        let extensionElements = processElement.extensionElements;
        if (!extensionElements) {
            extensionElements = bpmnFactory.create('bpmn:ExtensionElements');
            processElement.extensionElements = extensionElements;
        }

        // // uengine:properties 요소를 찾거나 새로 생성합니다.
        let uengineProperties
        if (extensionElements.values) {
            uengineProperties = extensionElements.values.find(val => val.$type === 'uengine:Properties');
        }

        if (!uengineProperties) {
            uengineProperties = bpmnFactory.create('uengine:Properties');
            extensionElements.get('values').push(uengineProperties);
        }

        uengineProperties?.variables?.forEach(function (variable) {
            me.processVariableDescriptors.push({
                name: variable.$attrs.name,
                type: variable.$attrs.type
            })
        })

        me.nodes = {};
        me.config = {
            roots: []
        };

        me.processVariableDescriptors.forEach(async (variable) => {
            if (!me.config.roots.includes(variable.type)) {
                me.config.roots.push(variable.type);
            }
            if (!me.nodes[variable.type]) {
                me.nodes[variable.type] = {
                    text: variable.type,
                    children: []
                };
            }

            if(me.nodes[variable.type]){
                me.nodes[variable.type].children.push(variable.name);
                me.nodes[variable.name] = {
                    text: variable.name
                };
            }

            // form.fields.forEach((field) => {
            //     me.nodes[form.id].children.push(field.name + '_' + field.alias);
            //     me.nodes[field.name + '_' + field.alias] = {
            //         text: field.name + '_' + field.alias
            //     };
            // });
        });


        me.storage = StorageBaseFactory.getStorage('supabase');
        let formDefs = await me.storage.list('form_def');

        me.renderKey++;
    },
    mounted() {
        let me = this

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
            } else {
                this.menu_x = 1550;
                this.menu_y = 350;
                this.component_x = 500;
                this.component_y = 500;
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
            this.menu = false;
            this.newBlock(item, { x: this.component_x, y: this.component_y });
        },
        onButtonClickLeft(item, type) {
            console.log('Button clicked:', item.node.text, type);
            this.newBlock(type, { x: 200, y: 200 }, item.node.text);
        },
        onButtonClickRight(item, type) {
            console.log('Button clicked:', item.node.text, type);
            this.newBlock(type, { x: 1500, y: 200 }, item.node.text);
        },
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
    height: 100%;
    margin: 0;
    padding: 0;
    overflow: hidden;
    background: white;
    user-select: none;
}
#formArea {
    width: 100%;
}
.block > rect {
    fill: rgba(127, 127, 127, 1);
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
    fill: #060;
}
.port > rect.background {
    fill: rgba(63, 63, 63, 0);
    width: 50px;
    height: 20px;
}
.port:hover > text {
    fill: #6a6;
}
.port:hover > rect {
    fill: #282;
    stroke-width: 3px;
    stroke: #282;
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
    stroke: #4c4;
    stroke-width: 3;
}

.treeviews-container {
    display: flex;
    justify-content: space-between;
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
</style>
