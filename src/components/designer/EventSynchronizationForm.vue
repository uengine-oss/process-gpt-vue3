<template>
    <div v-if="!isLoading">
        <v-card flat>
            <v-col>
                <div style="font-size: medium;">URL</div>
                <div>
                    <v-text-field v-model="value.url"></v-text-field>
                </div>

                <!-- <div style="font-size: medium;">Event Type</div> -->
                <!-- <div>
                    <v-text-field v-model="value.eventSynchronization.eventType"></v-text-field>
                </div> -->

                <div style="font-size: medium;">Event Attributes</div>
                <draggable v-model="attributes" :options="dragOptions" class="mb-6">
                    <div v-for="(attribute, idx) in attributes" :key="idx">
                        <div v-if="attribute.isEdit" style="display: flex; align-items: center; height: 10%;">
                            <v-tooltip location="bottom">
                                <template v-slot:activator="{ props }">
                                    <v-btn v-bind="props"
                                        icon variant="text" 
                                        type="file"
                                        class="text-medium-emphasis"
                                        @click="setPrimaryKey(attribute)"
                                    >
                                        <v-icon :style="attribute.isKey ? 'color: #0085db;' : ''">mdi-key</v-icon>
                                    </v-btn>
                                </template>
                                <span>Primary Key</span>
                            </v-tooltip>
                            <v-tooltip location="bottom">
                                <template v-slot:activator="{ props }">
                                    <v-btn v-bind="props"
                                        icon variant="text" 
                                        type="file"
                                        class="text-medium-emphasis"
                                        @click="setCorrKey(attribute)"
                                    >
                                        <v-icon :style="attribute.isCorrKey ? 'color: #0085db;' : ''">mdi-link-variant</v-icon>
                                    </v-btn>
                                </template>
                                <span>Correlation Key</span>
                            </v-tooltip>
                            <v-select 
                                    style="width: 30px" 
                                    v-model="attribute.className" 
                                    :items="entityTypeList"
                                    label="ClassName"
                                    hide-details
                            ></v-select>
                            <v-text-field
                                    v-model="attribute.name" 
                                    label="Name"
                                    required
                                    hide-details
                            ></v-text-field>
                            <v-tooltip location="bottom">
                                <template v-slot:activator="{ props }">
                                    <v-btn v-bind="props"
                                        icon variant="text" 
                                        size="small"
                                        @click="saveAttribute(attribute)"
                                    >
                                        <v-icon>mdi-content-save</v-icon>
                                    </v-btn>
                                </template>
                                <span>Edit</span>
                            </v-tooltip>
                        </div> 

                        <div v-else style="display: flex; align-items: center; height: 10%;">
                            <div style="font-size: 15px; width: 15%;"> {{ attribute.className }}</div>
                            <div style="font-size: 15px; width: 65%;"> {{ attribute.name }}</div>
                            <div style="display: flex; align-items: center; width: 20%;">
                                <div style="width: 30px; height: 30px; place-content: center; text-align: center;"><v-icon v-if="attribute.isKey" disabled large style="color: #0085db;">mdi-key</v-icon></div>
                                <div style="width: 30px; height: 30px; place-content: center; text-align: center;"><v-icon v-if="attribute.isCorrKey" disabled large style="color: #0085db;">mdi-link-variant</v-icon></div>
                                <v-btn style="width: 30px; height: 30px; text-align: center;" small icon="mdi-lead-pencil" size="small" @click="editAttribute(attribute)"></v-btn>
                                <v-btn style="width: 30px; height: 30px; text-align: center;" small icon="mdi-delete" size="small" @click="deleteAttribute(attribute)"></v-btn>
                            </div>
                        </div>
                    </div>
                </draggable>

                <v-col>
                    <v-row justify="center" class="attribute-editor">
                        <v-tooltip location="bottom">
                            <template v-slot:activator="{ props }">
                                <v-btn v-bind="props"
                                    icon variant="text" 
                                    type="file"
                                    class="text-medium-emphasis"
                                    @click="setPrimaryKey()"
                                >
                                   <v-icon :style="newAttribute.isKey ? 'color: #0085db;' : ''">mdi-key</v-icon>
                                </v-btn>
                            </template>
                            <span>Primary Key</span>
                        </v-tooltip>
                        <v-tooltip location="bottom">
                            <template v-slot:activator="{ props }">
                                <v-btn v-bind="props"
                                    icon variant="text" 
                                    type="file"
                                    class="text-medium-emphasis"
                                    @click="setCorrKey()"
                                >
                                    <v-icon :style="newAttribute.isCorrKey ? 'color: #0085db;' : ''">mdi-link-variant</v-icon>
                                </v-btn>
                            </template>
                            <span>Correlation Key</span>
                        </v-tooltip>
                        <v-select 
                                style="width: 30px" 
                                v-model="newAttribute.className" 
                                :items="entityTypeList"
                                label="ClassName"
                        ></v-select>
                        <v-text-field
                                v-model="newAttribute.name" 
                                label="Name"
                                required
                                v-on:keyup.enter="addAttribute()"
                        ></v-text-field>
                    
                        <v-tooltip location="bottom">
                            <template v-slot:activator="{ props }">
                                <v-btn v-bind="props"
                                    icon variant="text" 
                                    type="file"
                                    class="text-medium-emphasis"
                                    @click="addAttribute()"
                                >
                                    <v-icon>mdi-plus</v-icon>
                                </v-btn>
                            </template>
                            <span>Add</span>
                        </v-tooltip>
                    </v-row>
                </v-col>

                <div style="font-size: medium;">Event Mapping</div>
                <div>
                    <v-btn block text color="primary" class="my-3" @click="openMapperDialog()"> Mapping </v-btn>
                </div>
            </v-col>
        </v-card>

        <v-dialog
            v-model="mappingDialog"
            max-width="80%"
            max-height="80%"
            @afterLeave="$refs.formMapper && $refs.formMapper.saveFormMapperJson()"
        >
            <mapper
                ref="formMapper"
                :definition="definition"
                :activities="activities"
                :formMapperJson="formMapperJson"
                :name="taskName"
                :expandableTrees="nodes"
                :replaceFromExpandableNode="replaceFromExpandableNode"
                :replaceToExpandableNode="replaceToExpandableNode"
                @saveFormMapperJson="saveMapper"
                @closeFormMapper="closeFormMapper"
            />
        </v-dialog>
    </div>
</template>


<script>
import BackendFactory from '@/components/api/BackendFactory';
import Mapper from '@/components/designer/mapper/Mapper.vue';
// import URLMapper from '@/components/designer/mapper/URLMapper.vue';
import { useBpmnStore } from '@/stores/bpmn';

export default {
    props:{
        modelValue: {
            type: Object,
            default: function () {
                return {}
            },
        },
        roles: Array,
        taskName: String,
        definition: Object
    },
    components:{
        Mapper,
        // 'url-mapper': URLMapper
    },
    data:() =>({
        isLoading: false,
        drag: false,
        value: null, // temp value (copy)
        attributes: [], // temp attributes (add edit .. for Function)
        entityTypeList: ['Integer', 'String', 'Boolean', 'Float', 'Double', 'Long', 'Date', 'BigDecimal'],
        newAttribute: {
            name: '',
            className: 'String',
            isKey: false,
            isCorrKey: false
        },
        // mapper
        bpmnModeler: null,
        mappingDialog: false,
        // mapper: null,
        activities: null,
        formMapperJson: null,
        nodes: null,
        replaceFromExpandableNode: null,
        replaceToExpandableNode: null,
    }),
    created(){
        this.init()
    },
    computed:{
        dragOptions() {
            return {
                animation: 200,
                group: "description",
                disabled: false,
                ghostClass: "ghost"
            };
        }
    },
    watch:{
        "value": {
            handler: function(newVal, oldVal) {
                var me = this
                if(me.isLoading) return;
                if(JSON.stringify(me.value) == JSON.stringify(me.modelValue)) return;

                me.$emit('update:modelValue', JSON.parse(JSON.stringify(me.value)));
            },
            deep: true
        },
        "attributes": {
            handler: function(newVal, oldVal) {
                var me = this
                if(me.isLoading) return;
                if(JSON.stringify(newVal) == JSON.stringify(me.value.eventSynchronization.attributes)) return;
                me.value.eventSynchronization.attributes = newVal.map(({ isEdit, ...rest }) => rest);
            },
            deep: true
        }
    },
    methods:{
        init(){
            var me = this
            me.isLoading = true;
            me.bpmnModeler = useBpmnStore().getModeler;
            me.value = JSON.parse(JSON.stringify(me.modelValue));
            me.attributes = me.value.eventSynchronization.attributes.map(attribute => ({ ...attribute, isEdit: false }))
            if(me.attributes && me.attributes.length == 0){
                // me.attributes.push({name: 'id', className: 'Long', isKey: false, isCorrKey: true}) //init value.
            }
            me.isLoading = false;
        },
        openMapperDialog(){
            var me = this
       
            
            let nodeName = "Arguments"
            let instanceNodes = me.value.eventSynchronization.attributes.map(attribute => attribute.name);
            if(!me.nodes) me.nodes = {}
            if(!me.nodes[nodeName]) me.nodes[nodeName] = {} 
               
            me.nodes[nodeName].text = nodeName
            me.nodes[nodeName].children = [];
            me.nodes[nodeName].parent = null;
            
     
            instanceNodes.forEach((node) => {
                me.nodes[nodeName].children.push(node);
                if(!me.nodes[node]) me.nodes[node] = {}
                me.nodes[node].text = node
                // me.nodes[node].children = [];
            });

            me.replaceFromExpandableNode = function(nodeKey) {
                if(nodeKey.indexOf(`${nodeName}.`) != -1) {
                    return nodeKey.replace(`${nodeName}.`, `[${nodeName}].`);
                }
                return null;
            };

            me.replaceToExpandableNode = function(nodeKey) {
                if(nodeKey.indexOf(`[${nodeName}].`) != -1) {
                    return nodeKey.replace(`[${nodeName}].`, `${nodeName}.`);
                }
                return null;
            };

            // me.mapper = {'processVariables': me.attributes }
            me.formMapperJson = JSON.stringify(me.value.eventSynchronization.mappingContext, null, 2);
            me.mappingDialog = true;
        },
        saveMapper(jsonString) {
            this.formMapperJson = jsonString;
            this.value.eventSynchronization.mappingContext = JSON.parse(jsonString);
            this.mappingDialog = false;
        },
        closeFormMapper() {
            this.mappingDialog = false;
        },
        addAttribute(){
            var me = this
            // Add attribute
            me.attributes.push(JSON.parse(JSON.stringify(me.newAttribute)));
            // init attribute
            me.newAttribute = {name: '', className: 'String', isKey: false, isCorrKey: false}
        },
        editAttribute(attribute){
            var me = this
            if(attribute) attribute.isEdit = true
        },
        saveAttribute(attribute){
            if(attribute) attribute.isEdit = false
        },
        deleteAttribute(attribute){
            var me = this
            if(!attribute) return;
            me.attributes.splice(me.attributes.findIndex(attr => attr.name == attribute.name), 1);
        },
        setPrimaryKey(attribute){
            if(attribute){
                attribute.isKey = !attribute.isKey
            } else {
                this.newAttribute.isKey = !this.newAttribute.isKey
            }
        },
        setCorrKey(attribute){
            if(attribute){
                attribute.isCorrKey = !attribute.isCorrKey
            } else {
                this.newAttribute.isCorrKey = !this.newAttribute.isCorrKey
            }
        },
    }
}
</script>