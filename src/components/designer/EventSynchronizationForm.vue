<template>
    <div v-if="loading">
        <v-card flat>
            <v-col>
                <div style="font-size: medium;">Event Type</div>
                <div>
                    <v-text-field v-model="modelValue.eventType"></v-text-field>
                </div>

                <div style="font-size: medium;">Parameters</div>
                <draggable v-model="eventSynchronization.attributes" :options="dragOptions" style="height: 250px;">
                    <div v-for="(attribute, idx) in eventSynchronization.attributes" :key="idx">
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
        loading: false,
        drag: false,
        eventSynchronization: null,
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
        "eventSynchronization.attributes": {
            handler: function(newVal, oldVal) {
                if(!this.loading) return;
                this.modelValue.attributes = newVal.map(({ isEdit, ...rest }) => rest);
                this.$emit('update:modelValue', this.modelValue);
            },
            deep: true
        }
    },
    methods:{
        init(){
            var me = this
            me.loading =  false;
            me.bpmnModeler = useBpmnStore().getModeler;

            if(!me.modelValue) me.modelValue.eventSynchronization = {}
            if(!me.modelValue.eventType) me.modelValue.eventType = ''
            if(!me.modelValue.attributes) me.modelValue.attributes = []
            if(!me.modelValue.mappingContext) me.modelValue.mappingContext = {}
            me.eventSynchronization = JSON.parse(JSON.stringify(me.modelValue));
            me.eventSynchronization.attributes.map(attribute => ({ ...attribute, isEdit: false }))

            me.$emit('update:modelValue', me.modelValue);
            me.loading = true;
        },
        openMapperDialog(){
            var me = this
            
            /*
                Logic
            */
            // {'processVariables': this.eventSynchronization.attributes }
            
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
            me.mapper = {'processVariables': me.eventSynchronization.attributes }
            me.formMapperJson = JSON.stringify(me.modelValue.mappingContext, null, 2);
            me.mappingDialog = true;
        },
        saveMapper(jsonString) {
            this.formMapperJson = jsonString;
            this.modelValue.mappingContext = JSON.parse(jsonString);
            this.$emit('update:modelValue', this.modelValue);
            this.mappingDialog = false;
        },
        addAttribute(){
            // Add attribute
            this.eventSynchronization.attributes.push(JSON.parse(JSON.stringify(this.newAttribute)));
            // init attribute
            this.newAttribute = {name: '', className: 'String', isKey: false, isCorrKey: false}
        },
        editAttribute(attribute){
            var me = this
            if(attribute) attribute.isEdit = true
        },
        saveAttribute(attribute){
            if(attribute) attribute.isEdit = false
        },
        deleteAttribute(attribute){
            if(!attribute) return;
            this.eventSynchronization.attributes.splice(this.eventSynchronization.attributes.findIndex(attr => attr.name == attribute.name), 1);
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
        validation(){
            // var me = this
            // me.modelValue.attributes.push({name: "id",className:"Long",isKey: true, isCorrKey: true})
            // me.modelValue.attributes.push({name: "name",className:"Long",isKey: true, isCorrKey: false})
            return true;
        }
    }
}
</script>