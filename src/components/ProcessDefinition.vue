<template>
    <div>
        <v-row style="height: 100%" class="ma-0">
            <v-col class="d-flex ma-0 pa-0">
                <v-card elevation="1" style="border-radius: 0px !important;">
                    <v-tooltip v-if="!isViewMode" :text="$t('processDefinition.processVariables')">
                        <template v-slot:activator="{ props }">
                            <v-btn @click="openProcessVariables" icon v-bind="props"
                                style="position: absolute; right:20px; top:20px; z-index:1">
                                <Icon icon="tabler:variable" width="32" height="32" />
                            </v-btn>
                        </template>
                    </v-tooltip>
                    <component :is="`bpmn`+mode" ref='bpmnVue' :bpmn="bpmn" :options="options" :isViewMode="isViewMode"
                        :currentActivities="currentActivities" v-on:error="handleError" v-on:shown="handleShown"
                        v-on:openDefinition="ele => openSubProcess(ele)" v-on:loading="handleLoading"
                        v-on:openPanel="(id) => openPanel(id)" v-on:update-xml="val => $emit('update-xml', val)"
                        v-on:definition="(def) => (definitions = def)" v-on:add-shape="onAddShape"
                        v-on:change-sequence="onChangeSequence" v-on:remove-shape="onRemoveShape"
                        v-on:change-shape="onChangeShape"></component>
                    <!-- <vue-bpmn ref='bpmnVue' :bpmn="bpmn" :options="options" :isViewMode="isViewMode"
                        :currentActivities="currentActivities" v-on:error="handleError" v-on:shown="handleShown"
                        v-on:openDefinition="ele => openSubProcess(ele)" v-on:loading="handleLoading"
                        v-on:openPanel="(id) => openPanel(id)" v-on:update-xml="val => $emit('update-xml', val)"
                        v-on:definition="(def) => (definitions = def)" v-on:add-shape="onAddShape"
                        v-on:change-sequence="onChangeSequence" v-on:remove-shape="onRemoveShape"
                        v-on:change-shape="onChangeShape"></vue-bpmn> -->
                </v-card>
            </v-col>
            <v-col v-if="panel" cols="12" sm="12" lg="4" md="6" class="d-flex">
                <v-card elevation="1">
                    <bpmn-property-panel :element="element" @close="closePanel" :isViewMode="isViewMode"
                        v-on:updateElement="(val) => updateElement(val)"></bpmn-property-panel>
                    <!-- {{ definition }} -->
                </v-card>
            </v-col>
        </v-row>
        <v-dialog v-model="isViewProcessVariables" max-width="1000">
            <v-card>
                <v-card-title class="ma-0 pa-0" style="padding: 15px 0px 0px 25px !important;">{{
                        $t('processDefinition.editProcessData') }}</v-card-title>
                <v-btn icon style="position:absolute; right:5px; top:5px;" @click="isViewProcessVariables = false">
                    <v-icon>mdi-close</v-icon>
                </v-btn>
                <v-card-text style="height: 1000px; width: 1000px;">
                    <VDataTable class="border rounded-md" :items-per-page="5"
                        :items-per-page-text="$t('processDefinition.itemsPerPage')">
                        <thead>
                            <tr>
                                <th class="text-subtitle-1 font-weight-semibold">{{ $t('processDefinition.name') }}</th>
                                <th class="text-subtitle-1 font-weight-semibold">{{ $t('processDefinition.type') }}</th>
                                <th class="text-subtitle-1 font-weight-semibold">{{ $t('processDefinition.description')
                                    }}
                                </th>
                                <th class="text-subtitle-1 font-weight-semibold">{{ $t('processDefinition.dataSource')
                                    }}
                                </th>
                                <th class="text-subtitle-1 font-weight-semibold">{{ $t('processDefinition.query') }}
                                </th>
                                <th class="text-subtitle-1 font-weight-semibold">{{ $t('processDefinition.actions') }}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="item in copyProcessDefinition.data" :key="item.name">
                                <td class="text-subtitle-1">{{ item.name }}</td>
                                <td>
                                    {{ item.type }}
                                </td>
                                <td class="text-subtitle-1">{{ item.description }}</td>
                                <td class="text-subtitle-1">{{
                        item.datasource ? item.datasource.type : 'None' }}</td>
                                <td>
                                    {{ item.datasource ? item.datasource.query : 'None' }}
                                </td>
                                <td>
                                    <div class="d-flex align-center">
                                        <v-tooltip :text="$t('processDefinition.edit')">
                                            <template v-slot:activator="{ props }">
                                                <v-btn icon flat @click="editItem(item)" v-bind="props">
                                                    <PencilIcon stroke-width="1.5" size="20" class="text-primary" />
                                                </v-btn>
                                            </template>
                                        </v-tooltip>
                                        <v-tooltip :text="$t('processDefinition.delete')">
                                            <template v-slot:activator="{ props }">
                                                <v-btn icon flat @click="deleteItem(item)" v-bind="props">
                                                    <TrashIcon stroke-width="1.5" size="20" class="text-error" />
                                                </v-btn>
                                            </template>
                                        </v-tooltip>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </VDataTable>
                    <v-row class="ma-0" style="margin:10px 0px 10px 0px !important;">
                        <v-card @click="addProcessVaribles" elevation="9" variant="outlined"
                            style="padding: 10px; display: flex; justify-content: center; align-items: center; border-radius: 10px !important;">
                            <div style="display: flex; justify-content: center; align-items: center;">
                                <Icon icon="streamline:add-1-solid" width="24" height="24" style="color: #5EB2E8" />
                            </div>
                        </v-card>
                    </v-row>
                    <div v-if="processVariblesWindow">
                        <v-card variant="outlined">
                            <v-card-text class="ma-0 pa-0">
                                <process-variable mode="add"
                                    @add-variables="val => copyProcessDefinition.data.push(val)"></process-variable>
                            </v-card-text>
                        </v-card>
                    </div>
                    <div v-if="editDialog">
                        <v-card variant="outlined">
                            <v-card-text class="ma-0 pa-0">
                                <process-variable :key="editComponentKey" :variable="editedItem" mode="edit"
                                    @update-variables="val => updateVariable(val)"></process-variable>
                            </v-card-text>
                        </v-card>
                    </div>
                </v-card-text>
            </v-card>
        </v-dialog>

        <!-- <v-dialog v-model="editDialog" max-width="1000">
            <v-card>
                <v-card-text class="px-4">
                    <process-variable :variable="editedItem" mode="edit"
                        @update-variables="val => updateVariable(val)"></process-variable>
                </v-card-text>
            </v-card>
        </v-dialog> -->

        <!-- <v-navigation-drawer permanent location="right" :width="400"> {{ panelId }} </v-navigation-drawer> -->
    </div>
</template>

<script>
import { Icon } from '@iconify/vue';
import { VDataTable } from 'vuetify/labs/VDataTable';
// import VueBpmn from './Bpmn-LLM.vue';
import BpmnLLM from './BpmnLLM.vue';
import BpmnuEngine from './BpmnUengine.vue';
import customBpmnModule from './customBpmn';
import BpmnPropertyPanel from './designer/bpmnModeling/bpmn/BpmnPropertyPanel.vue';
import ProcessVariable from './designer/bpmnModeling/bpmn/mapper/ProcessVariable.vue';



export default {
    name: 'ProcessDefinition',
    components: {
        BpmnLLM,
        BpmnuEngine,
        BpmnPropertyPanel,
        ProcessVariable,
        Icon,
        VDataTable
    },
    props: {
        processDefinition: Object,
        bpmn: String,
        isViewMode: Boolean,
        currentActivities: Array,
    },
    data: () => ({
        panel: false,
        panelId: null,
        options: {
            propertiesPanel: {},
            additionalModules: [customBpmnModule],
        },
        element: null,
        definitions: null,
        isViewProcessVariables: false,
        copyProcessDefinition: null,
        processVariblesWindow: false,
        editDialog: false,
        editedIndex: null,
        editedItem: null,
        lastEditedIndex: 0,
        editComponentKey: 0,
    }),
    computed: {
        mode() {
            return window.$mode
        }
    },
    watch: {
        copyProcessDefinition: {
            deep: true,
            handler(newVal) {
                console.log("********* watch  ********")
                this.$emit("updateDefinition", newVal)
            }
        },
        definitions: {
            deep: true,
            handler(newVal) {
                let replacer = function (key, value) {
                    // 만약 값이 객체이고 bpmnElement 속성을 가지고 있다면
                    if (value && typeof value === 'object' && !Array.isArray(value)) {
                        let replacement = { ...value };
                        if (value.bpmnElement) {
                            replacement.bpmnElement = value.bpmnElement.id;
                        }
                        if (value.$parent) {
                            replacement.$parent = value.$parent.id;
                        }
                        if (value.sourceRef) {
                            replacement.sourceRef = value.sourceRef.id;
                        }
                        if (value.targetRef) {
                            replacement.targetRef = value.targetRef.id;
                        }
                        return replacement;
                    }
                    // 다른 경우에는 값을 그대로 반환
                    return value;
                };
                let str = JSON.stringify(newVal, replacer);
                this.$emit("valueToStr", str)
            }
        }
    },
    created() { },
    mounted() {
        // Initial Data
        if (this.processDefinition)
            this.copyProcessDefinition = this.processDefinition
        else
            this.copyProcessDefinition = {
                "megaProcessId": "",
                "majorProcessId": "",
                "processDefinitionName": "",
                "processDefinitionId": this.uuid(),
                "events": [],
                "gateways": [],
                "participants": [],
                "description": "",
                "data": [],
                "roles": [],
                "activities": [],
                "sequences": []
            }
    },
    methods: {
        openSubProcess(e) {
            this.$emit('openSubProcess', e)
        },
        uuid() {
            function s4() {
                return Math.floor((1 + Math.random()) * 0x10000)
                    .toString(16)
                    .substring(1);
            }

            return s4() + s4() + '-' + s4() + '-' +
                s4() + '-' + s4() + s4() + s4();
        },
        onAddShape(e) {
            console.log(e)
            let element;
            if (e.type.includes("Task")) {
                element = this.createActivity(e)
                this.copyProcessDefinition.activities.push(element)
            } else if (e.type.includes("Participant")) {
                element = this.createParticipant(e)
                this.copyProcessDefinition.participants.push(element)
            } else if (e.type.includes("Lane")) {
                element = this.createRole(e)
                this.copyProcessDefinition.roles.push(element)
            }

        },
        onChangeShape(e) {
            console.log(e)
        },
        onChangeSequence(e) {
            console.log(e)
        },
        onRemoveShape(e) {
            console.log(e)
        },
        createParticipant(element) {
            let participant = {
                "name": element.name,
                "resolutionRule": "",
                "pos": {
                    x: element.x,
                    y: element.y,
                    width: element.width,
                    height: element.height
                }
            }
            return participant
        },
        createRole(element) {
            let role = {
                "name": element.name,
                "resolutionRule": "",
                "pos": {
                    x: element.x,
                    y: element.y,
                    width: element.width,
                    height: element.height
                }
            }
            return role
        },
        createActivity(element) {
            let task = this.taskMapping(element.type)
            let activity = {
                "name": "",
                "id": element.id,
                "type": task,
                "description": "",
                "role": "",
                "outputData": [],
                "inputData": [],
                "pos": {
                    x: element.x,
                    y: element.y,
                    width: element.width,
                    height: element.height
                }
            }
            return activity
        },
        editItem(item) {
            this.editedIndex = this.copyProcessDefinition.data.indexOf(item);
            this.editedItem = Object.assign({}, item);

            if (this.processVariblesWindow == true) {
                this.processVariblesWindow = false;
            }
            this.editComponentKey ^= 1; // ProcessVariable 컴포넌트 새로고침용 변수

            if (this.lastEditedIndex == this.editedIndex) {
                this.editDialog = !this.editDialog
            } else {
                this.editDialog = true
            }
            this.lastEditedIndex = this.editedIndex
        },
        deleteItem(item) {
            const index = this.copyProcessDefinition.data.indexOf(item);
            confirm('Are you sure you want to delete this item?') && this.copyProcessDefinition.data.splice(index, 1);
        },
        findElement(obj, key, id) {
            if (obj.hasOwnProperty(key) && obj[key] === id) {
                return obj;
            }

            for (let prop in obj) {
                if (obj[prop] instanceof Object) {
                    let result = this.findElement(obj[prop], key, id);
                    if (result) {
                        return result;
                    }
                }
            }

            return null;
        },
        updateItemByKey(array, key, id, newItem) {
            const index = array.findIndex(item => item[key] === id);
            if (index !== -1) {
                array[index] = newItem;
            }
        },
        updateVariable(val) {
            this.copyProcessDefinition.data[editedIndex] = val;
            this.editDialog = false
        },
        openProcessVariables() {
            this.isViewProcessVariables = !this.isViewProcessVariables
        },
        addProcessVaribles() {
            if (this.editDialog == true) {
                this.editDialog = false
            }
            this.processVariblesWindow = !this.processVariblesWindow
        },
        updateElement(element) {
            // let 
            // this.convertElementToJSON(element);
            // this.changeElement(this.copyProcessDefinition, 'id', newObj.id, newObj)
            // obj = newObj
            this.$emit('update')
        },
        openPanel(id) {
            this.panel = true;
            this.element = this.findElement(this.definitions, 'id', id);

            this.$refs.bpmnVue.extendUEngineProperties(this.element)
        },
        closePanel() {
            this.element = null;
            this.panel = false;
        },
        handleError() {
            console.error('failed to show diagram', err);
        },
        handleShown() {
            console.log('diagram shown');
        },
        handleLoading() {
            console.log('diagram loading');
        },
        taskMapping(activity) {
            switch (activity) {
                case 'bpmn:ScriptTask':
                    return "ScriptActivity";
                case 'bpmn:sendTask':
                    return "EmailActivity";
                default:
                    return 'UserActivity';
            }
        },
        convertElementToJSON(element) {
            console.log(element.name)
            if (element.$type.includes("Task")) {
                // Task Parser
                let taskType = this.taskMapping(element.$type)
                let inputData = {}
                let outputData = {}
                this.copyElement?.extensionElements?.values?.[0]?.$children?.[0]?.$children.forEach(function (data) {
                    console.log(data)
                    if (data.category == 'input') {
                        inputData[data.key] = { "mandatory": data.mandatory ? data.mandatory : false };
                        // inputData.push(obj)
                    } else if (data.category == 'output') {
                        outputData[data.key] = { "mandatory": data.mandatory ? data.mandatory : false };
                    }
                })
                let resultInputData = Object.keys(inputData).length > 0 ? [inputData] : []
                let resultOutputData = Object.keys(outputData).length > 0 ? [outputData] : []
                let checkpoints = []
                element.extensionElements?.values[0]?.$children[0]?.$children.forEach(function (checkpoint) {
                    checkpoints.push(checkpoint.checkpoint)
                })
                let task = {
                    checkpoints: checkpoints,
                    description: element.extensionElements.values[0].description,
                    id: element.id,
                    inputData: resultInputData,
                    instruction: "",
                    name: element.name,
                    outputData: resultOutputData,
                    role: element.extensionElements.values[0].role,
                    type: taskType
                }
                if (element.extensionElements.values[0].pythonCode)
                    task['pythonCode'] = element.extensionElements.values[0].pythonCode
                console.log(task)
                this.updateItemByKey(this.copyProcessDefinition.activities, "id", task.id, task)
            } else if (element.$type.includes("Flow")) {
                // Sequence Parser
                let sequence = {
                    name: element.name,
                    source: element.sourceRef.id,
                    target: element.targetRef.id,
                    condition: element.extensionElements.values[0].$children[0].$children[0].$body
                }
                this.updateItemByKey(this.copyProcessDefinition.sequences, "source", sequence.source, sequence)
            } else if (element.$type.includes("Lane")) {
                // Role Parser
            }
        }
    }
};
</script>