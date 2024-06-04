<template>
    <div v-if="!isLoading">
        <v-card flat>
            <v-col>
                <div style="font-size: medium;">URL</div>
                <div>
                    <v-text-field v-model="modelValue.url"></v-text-field>
                </div>

                <div style="font-size: medium;">Event Type</div>
                <div>
                    <v-text-field v-model="modelValue.eventSynchronization.eventType"></v-text-field>
                </div>

                <div style="font-size: medium;">Parameters</div>
                <draggable v-model="attributes" :options="dragOptions" style="height: 200px;">
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
            @afterLeave="$refs.formMapper && $refs.formMapper.saveMapper"
        >
            <form-mapper
                ref="formMapper"
                :definition="mapper"
                :activities="activities"
                :formMapperJson="formMapperJson"
                :name="taskName"
                :roles="roles"
                @saveFormMapperJson="saveMapper"
            />
        </v-dialog>
    </div>
</template>


<script>
import BackendFactory from '@/components/api/BackendFactory';
import FormMapper from '@/components/designer/mapper/FormMapper.vue';
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
        taskName: String
    },
    components:{
        FormMapper
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
        mapper: null,
        activities: null,
        formMapperJson: null
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
              
                this.$emit('update:modelValue', me.value);
            },
            deep: true
        },
        "attributes": {
            handler: function(newVal, oldVal) {
                if(this.isLoading) return;
                if(JSON.stringify(newVal) == JSON.stringify(oldVal)) return;
                this.value.eventSynchronization.attributes = newVal.map(({ isEdit, ...rest }) => rest);
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
            me.isLoading = false;
        },
        openMapperDialog(){
            var me = this
            
            /*
                Logic
            */
            const processElement = me.bpmnModeler.getDefinitions().rootElements.filter((element) => element.$type === 'bpmn:Process');
            if (processElement) {
                if(!me.activities) me.activities = []
                processElement.forEach((process) => {
                    process.flowElements.forEach((ele) => {
                        if (ele.$type.toLowerCase().indexOf('task') != -1) {
                            me.activities.push(ele);
                        } else if (ele.$type.toLowerCase().indexOf('subprocess') != -1) {
                            ele.flowElements.forEach((subProcessEle) => {
                                if (subProcessEle.$type.toLowerCase().indexOf('task') != -1) {
                                    me.activities.push(subProcessEle);
                                }
                            });
                        }
                    });
                });
            }
            me.mapper = {'processVariables': me.attributes }
            me.formMapperJson = JSON.stringify(me.value.eventSynchronization.mappingContext, null, 2);
            me.mappingDialog = true;
        },
        saveMapper(jsonString) {
            this.formMapperJson = jsonString;
            this.modelValue.eventSynchronization.mappingContext = JSON.parse(jsonString);
            this.$emit('update:modelValue', this.modelValue);
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