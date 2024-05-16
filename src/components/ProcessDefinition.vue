<template>
    <div style="height: 100%">
        <v-row style="height: 100%" class="ma-0">
            <v-col class="d-flex ma-0 pa-0" style="height: 100%">
                <v-card style="border-radius: 0px !important; border: none; height: 100%" flat>
                    <v-tooltip v-if="!isViewMode" :text="$t('processDefinition.processVariables')">
                        <template v-slot:activator="{ props }">
                            <v-btn @click="openProcessVariables" icon v-bind="props" class="processVariables-btn">
                                <Icon icon="tabler:variable" width="32" height="32" />
                            </v-btn>
                        </template>
                    </v-tooltip>
                    <v-tooltip v-if="!isViewMode" :text="$t('processDefinition.zoom')">
                        <template v-slot:activator="{ props }">
                            <v-btn icon v-bind="props" class="processVariables-zoom" @click="$globalState.methods.toggleZoom()">
                                <!-- 캔버스 확대 -->
                                <Icon
                                    v-if="!$globalState.state.isZoomed"
                                    icon="material-symbols:zoom-out-map-rounded"
                                    width="32"
                                    height="32"
                                />
                                <!-- 캔버스 축소 -->
                                <Icon v-else icon="material-symbols:zoom-in-map-rounded" width="32" height="32" />
                            </v-btn>
                        </template>
                    </v-tooltip>
                    <!-- 실행 버튼  -->
                    <v-tooltip v-if="$route.path.includes('/definitions/') && $route.path !== '/definitions/chat'" :text="$t('processDefinition.execution')">
                        <template v-slot:activator="{ props }">
                            <v-btn icon variant="flat" v-bind="props" class="processExecute" @click="executeProcess">
                                <Icon icon="gridicons:play" width="32" height="32" />
                            </v-btn>
                        </template>
                    </v-tooltip>
                    <bpmnu-engine
                        ref="bpmnVue"
                        :bpmn="bpmn"
                        :options="options"
                        :isViewMode="isViewMode"
                        :currentActivities="currentActivities"
                        v-on:error="handleError"
                        v-on:shown="handleShown"
                        v-on:openDefinition="(ele) => openSubProcess(ele)"
                        v-on:loading="handleLoading"
                        v-on:openPanel="(id) => openPanel(id)"
                        v-on:update-xml="(val) => $emit('update-xml', val)"
                        v-on:definition="(def) => (definitions = def)"
                        v-on:add-shape="onAddShape"
                        v-on:done="setDefinition"
                        v-on:change-sequence="onChangeSequence"
                        v-on:remove-shape="onRemoveShape"
                        v-on:change-shape="onChangeShape"
                        style="height: 100%"
                    ></bpmnu-engine>
                    <!-- <vue-bpmn ref='bpmnVue' :bpmn="bpmn" :options="options" :isViewMode="isViewMode"
                        :currentActivities="currentActivities" v-on:error="handleError" v-on:shown="handleShown"
                        v-on:openDefinition="ele => openSubProcess(ele)" v-on:loading="handleLoading"
                        v-on:openPanel="(id) => openPanel(id)" v-on:update-xml="val => $emit('update-xml', val)"
                        v-on:definition="(def) => (definitions = def)" v-on:add-shape="onAddShape"
                        v-on:change-sequence="onChangeSequence" v-on:remove-shape="onRemoveShape"
                        v-on:change-shape="onChangeShape"></vue-bpmn> -->
                </v-card>
            </v-col>
            <div v-if="panel && !isViewMode" style="position: fixed; z-index: 999; right: 0; height: 100%">
                <v-card elevation="1" style="height: calc(100vh - 155px)">
                    <bpmn-property-panel
                        :element="element"
                        @close="closePanel"
                        :roles="roles"
                        :process-variables="processVariables"
                        :key="element.id"
                        :isViewMode="isViewMode"
                        v-on:updateElement="(val) => updateElement(val)"
                        :definition="thisDefinition"
                        :processDefinitionId="definitionPath"
                        @addUengineVariable="addUengineVariable"
                    ></bpmn-property-panel>
                    <!-- {{ definition }} -->
                </v-card>
            </div>
        </v-row>
        <v-dialog v-model="isViewProcessVariables" max-width="1000">
            <v-card>
                <v-card-title class="ma-0 pa-0" style="padding: 15px 0px 0px 25px !important">{{
                    $t('processDefinition.editProcessData')
                }}</v-card-title>
                <v-btn icon style="position: absolute; right: 5px; top: 5px" @click="isViewProcessVariables = false">
                    <v-icon>mdi-close</v-icon>
                </v-btn>
                <v-card-text style="height: 1000px; width: 1000px">
                    <VDataTable class="border rounded-md" :items-per-page="5" :items-per-page-text="$t('processDefinition.itemsPerPage')">
                        <thead>
                            <tr>
                                <th class="text-subtitle-1 font-weight-semibold">{{ $t('processDefinition.name') }}</th>
                                <th class="text-subtitle-1 font-weight-semibold">{{ $t('processDefinition.type') }}</th>
                                <th class="text-subtitle-1 font-weight-semibold">{{ $t('processDefinition.form') }}</th>
                                <th class="text-subtitle-1 font-weight-semibold">{{ $t('processDefinition.description') }}</th>
                                <th class="text-subtitle-1 font-weight-semibold">{{ $t('processDefinition.dataSource') }}</th>
                                <th class="text-subtitle-1 font-weight-semibold">{{ $t('processDefinition.query') }}</th>
                                <th class="text-subtitle-1 font-weight-semibold">{{ $t('processDefinition.actions') }}</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="item in processVariables" :key="item.name">
                                <td class="text-subtitle-1">{{ item.name }}</td>
                                <td>
                                    {{ item.type }}
                                </td>
                                <td v-if="item.defaultValue" class="text-subtitle-1">{{ item.defaultValue.formDefId }}</td>
                                <td v-else class="text-subtitle-1"></td>
                                <td class="text-subtitle-1">{{ item.description }}</td>
                                <td class="text-subtitle-1">{{ item.datasource ? item.datasource.type : 'None' }}</td>
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
                    <v-row class="ma-0" style="margin: 10px 0px 10px 0px !important">
                        <v-card
                            @click="addProcessVariables"
                            elevation="9"
                            variant="outlined"
                            style="
                                padding: 10px;
                                display: flex;
                                justify-content: center;
                                align-items: center;
                                border-radius: 10px !important;
                            "
                        >
                            <div style="display: flex; justify-content: center; align-items: center">
                                <Icon icon="streamline:add-1-solid" width="24" height="24" style="color: #5eb2e8" />
                            </div>
                        </v-card>
                    </v-row>
                    <div v-if="processVariablesWindow">
                        <v-card variant="outlined">
                            <v-card-text class="ma-0 pa-0">
                                <process-variable mode="add" @add-variables="(val) => addUengineVariable(val)"></process-variable>
                            </v-card-text>
                        </v-card>
                    </div>
                    <div v-if="editDialog">
                        <v-card variant="outlined">
                            <v-card-text class="ma-0 pa-0">
                                <process-variable
                                    :key="editComponentKey"
                                    :variable="editedItem"
                                    mode="edit"
                                    @update-variables="(val) => updateVariable(val)"
                                ></process-variable>
                            </v-card-text>
                        </v-card>
                    </div>
                </v-card-text>
            </v-card>
        </v-dialog>

        <v-dialog v-model="executeDialog" max-width="1000">
            <process-execute-dialog :definitionId="definitionPath" :roles="roles" @close="executeDialog = false"></process-execute-dialog>
        </v-dialog>

        <!-- <v-navigation-drawer permanent location="right" :width="400"> {{ panelId }} </v-navigation-drawer> -->
    </div>
</template>

<script>
import { Icon } from '@iconify/vue';
import { VDataTable } from 'vuetify/labs/VDataTable';
// import VueBpmn from './Bpmn-LLM.vue';
import { useBpmnStore } from '@/stores/bpmn';
import BpmnLLM from './BpmnLLM.vue';
import BpmnuEngine from './BpmnUengine.vue';
import customBpmnModule from './customBpmn';
import ProcessVariable from './designer/bpmnModeling/bpmn/mapper/ProcessVariable.vue';
import BpmnPropertyPanel from './designer/bpmnModeling/bpmn/panel/BpmnPropertyPanel.vue';
import ProcessExecuteDialog from './apps/definition-map/ProcessExecuteDialog.vue';
export default {
    name: 'ProcessDefinition',
    components: {
        BpmnLLM,
        BpmnuEngine,
        BpmnPropertyPanel,
        ProcessVariable,
        Icon,
        VDataTable,
        ProcessExecuteDialog
    },
    props: {
        processDefinition: Object,
        bpmn: String,
        isViewMode: Boolean,
        currentActivities: Array,
        definitionChat: Object,
        definitionPath: String
    },
    data: () => ({
        panel: false,
        panelId: null,
        options: {
            propertiesPanel: {},
            additionalModules: [customBpmnModule]
        },
        roles: [],
        element: null,
        definitions: null,
        isViewProcessVariables: false,
        copyProcessDefinition: null,
        processVariablesWindow: false,
        editDialog: false,
        editedIndex: null,
        editedItem: null,
        lastEditedIndex: 0,
        editComponentKey: 0,
        bpmnModeler: null,
        processVariables: [],
        executeDialog: false
        // definitionPath: null
    }),
    computed: {
        mode() {
            if (window.$mode == 'ProcessGPT') {
                return 'LLM';
            } else {
                return window.$mode;
            }
        },
        thisDefinition() {
            return {
                processVariables: this.processVariables
            };
        }
    },
    watch: {
        copyProcessDefinition: {
            deep: true,
            handler(newVal) {
                console.log('********* watch  ********');
                this.$emit('updateDefinition', newVal);
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
                this.$emit('valueToStr', str);
            }
        },
        panel: {
            handler() {
                let me = this;
                me.roles = [];

                let def = this.bpmnModeler.getDefinitions();
                const processElement = def.rootElements.filter((element) => element.$type === 'bpmn:Process');
                if (!processElement) {
                    console.error('bpmn:Process element not found');
                    return;
                }

                processElement.forEach((process) => {
                    (process.laneSets || []).forEach((laneSet) => {
                        (laneSet.lanes || []).forEach((lane) => {
                            // 레인의 이름을 배열에 추가합니다.
                            if (lane?.name?.length > 0) me.roles.push(lane.name);
                        });
                    });
                });
            }
        },
        executeDialog() {
            let me = this;
            me.roles = [];
            let def = this.bpmnModeler.getDefinitions();
            const processElement = def.rootElements.filter((element) => element.$type === 'bpmn:Process');
            if (!processElement) {
                console.error('bpmn:Process element not found');
                return;
            }

            processElement.forEach((process) => {
                (process.laneSets || []).forEach((laneSet) => {
                    (laneSet.lanes || []).forEach((lane) => {
                        // 레인의 이름을 배열에 추가합니다.
                        if (lane?.name?.length > 0) me.roles.push(lane.name);
                    });
                });
            });
        }
    },
    created() {
        // const fullPath = this.$route.params.pathMatch.join('/');
        // if (fullPath.startsWith('/')) {
        //     fullPath = fullPath.substring(1);
        // }
        // this.definitionPath = fullPath;
    },
    mounted() {
        // Initial Data
        if (this.processDefinition) this.copyProcessDefinition = this.processDefinition;
        else
            this.copyProcessDefinition = {
                megaProcessId: '',
                majorProcessId: '',
                processDefinitionName: '',
                processDefinitionId: this.uuid(),
                events: [],
                gateways: [],
                participants: [],
                description: '',
                data: [],
                roles: [],
                activities: [],
                sequences: []
            };
        const store = useBpmnStore();
        store.setProcessDefinition(this);
        this.bpmnModeler = store.getModeler;

        // const def = this.bpmnModeler.getDefinitions();
        // console.log(this.definitions)
        // LLM과 uEngine 각각 처리 필요.
        // this.processVariables = this.copyProcessDefinition.data
    },
    methods: {
        setDefinition() {
            let self = this;
            const def = this.bpmnModeler.getDefinitions();
            let bpmnFactory = this.bpmnModeler.get('bpmnFactory');
            const processElement = def.rootElements.find((element) => element.$type === 'bpmn:Process');
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
            let uengineProperties;
            if (extensionElements.values) {
                uengineProperties = extensionElements.values.find((val) => val.$type === 'uengine:Properties');
            }

            if (!uengineProperties) {
                uengineProperties = bpmnFactory.create('uengine:Properties');
                extensionElements.get('values').push(uengineProperties);
            }

            uengineProperties?.variables?.forEach(function (variable) {
                let obj = {
                    name: variable.$attrs.name,
                    type: variable.$attrs.type
                };
                if (variable.json) {
                    obj.defaultValue = JSON.parse(variable.json).defaultValue;
                }
                self.processVariables.push(obj);
            });
        },
        executeProcess() {
            console.log(this.executeDialog);
            this.executeDialog = !this.executeDialog;
        },
        addUengineVariable(val) {
            if (val.type == 'Form') {
                let defaultValue = {
                    _type: 'org.uengine.contexts.HtmlFormContext',
                    formDefId: `${val.defaultValue}`,
                    filePath: `${val.defaultValue}.form`
                };
                val.defaultValue = defaultValue;
            }

            // definitions 객체에서 bpmn2:process 요소를 찾습니다.
            const bpmnFactory = this.bpmnModeler.get('bpmnFactory');
            const processElement = this.definitions.rootElements.find((element) => element.$type === 'bpmn:Process');
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
            let uengineProperties;
            if (extensionElements.values) {
                uengineProperties = extensionElements.values.find((val) => val.$type === 'uengine:Properties');
            }

            if (!uengineProperties) {
                uengineProperties = bpmnFactory.create('uengine:Properties');
                extensionElements.get('values').push(uengineProperties);
            }

            // 새로운 uengine:variable 요소를 생성하고 속성을 설정합니다.
            const newVariable = bpmnFactory.create('uengine:Variable', {
                name: val.name,
                type: val.type,
                json: JSON.stringify({ defaultValue: val.defaultValue }) // fix string to json
                // json: JSON.stringify({ defaultValue: JSON.stringify(val.defaultValue) })
            });

            // 생성된 uengine:variable 요소를 uengine:properties 요소에 추가합니다.
            uengineProperties.get('variables').push(newVariable);
            this.processVariables.push(val);
            // console.log(this.processVariables)
        },
        openSubProcess(e) {
            this.$emit('openSubProcess', e);
        },
        uuid() {
            function s4() {
                return Math.floor((1 + Math.random()) * 0x10000)
                    .toString(16)
                    .substring(1);
            }

            return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
        },
        onAddShape(e) {
            console.log(e);
            let element;
            if (e.type.includes('Task')) {
                element = this.createActivity(e);
                this.copyProcessDefinition.activities.push(element);
            } else if (e.type.includes('Participant')) {
                element = this.createParticipant(e);
                this.copyProcessDefinition.participants.push(element);
            } else if (e.type.includes('Lane')) {
                element = this.createRole(e);
                this.copyProcessDefinition.roles.push(element);
            }
        },
        onChangeShape(e) {
            console.log(e);
        },
        onChangeSequence(e) {
            console.log(e);
        },
        onRemoveShape(e) {
            console.log(e);
        },
        createParticipant(element) {
            let participant = {
                name: element.name,
                resolutionRule: '',
                pos: {
                    x: element.x,
                    y: element.y,
                    width: element.width,
                    height: element.height
                }
            };
            return participant;
        },
        createRole(element) {
            let role = {
                name: element.name,
                resolutionRule: '',
                pos: {
                    x: element.x,
                    y: element.y,
                    width: element.width,
                    height: element.height
                }
            };
            return role;
        },
        createActivity(element) {
            let task = this.taskMapping(element.type);
            let activity = {
                name: '',
                id: element.id,
                type: task,
                description: '',
                role: '',
                outputData: [],
                executeDialog: false,
                inputData: [],
                pos: {
                    x: element.x,
                    y: element.y,
                    width: element.width,
                    height: element.height
                }
            };
            return activity;
        },
        editItem(item) {
            this.editedIndex = this.processVariables.indexOf(item);
            this.editedItem = Object.assign({}, item);

            if (this.processVariablesWindow == true) {
                this.processVariablesWindow = false;
            }
            this.editComponentKey ^= 1; // ProcessVariable 컴포넌트 새로고침용 변수

            if (this.lastEditedIndex == this.editedIndex) {
                this.editDialog = !this.editDialog;
            } else {
                this.editDialog = true;
            }
            this.lastEditedIndex = this.editedIndex;
        },
        deleteItem(item) {
            const index = this.processVariables.indexOf(item);
            if (confirm('Are you sure you want to delete this item?')) {
                const processElement = this.definitions.rootElements.find((element) => element.$type === 'bpmn:Process');
                if (!processElement) {
                    console.error('bpmn:Process element not found');
                    return;
                }

                // bpmn2:process 요소 내의 bpmn2:extensionElements 요소를 찾거나 새로 생성합니다.
                let extensionElements = processElement.extensionElements;

                // uengine:properties 요소를 찾거나 새로 생성합니다.
                let uengineProperties;
                if (extensionElements.values) {
                    uengineProperties = extensionElements.values.find((val) => val.$type === 'uengine:Properties');
                }
                console.log(uengineProperties.get('variables').findIndex((val) => val.$attrs.name === item.name));
                if (index !== -1) {
                    uengineProperties.get('variables').splice(index, 1);
                }
                this.processVariables.splice(index, 1);
            }
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
            const index = array.findIndex((item) => item[key] === id);
            if (index !== -1) {
                array[index] = newItem;
            }
        },
        updateVariable(val) {
            this.processVariables[this.editedIndex] = val;

            const processElement = this.definitions.rootElements.find((element) => element.$type === 'bpmn:Process');
            if (!processElement) {
                console.error('bpmn:Process element not found');
                return;
            }

            // bpmn2:process 요소 내의 bpmn2:extensionElements 요소를 찾거나 새로 생성합니다.
            let extensionElements = processElement.extensionElements;

            // uengine:properties 요소를 찾거나 새로 생성합니다.
            let uengineProperties;
            if (extensionElements.values) {
                uengineProperties = extensionElements.values.find((val) => val.$type === 'uengine:Properties');
            }
            uengineProperties.get('variables')[this.editedIndex].$attrs.name = val.name;
            uengineProperties.get('variables')[this.editedIndex].$attrs.type = val.type;
            uengineProperties.get('variables')[this.editedIndex].json = val.json;

            this.editDialog = false;
        },
        openProcessVariables() {
            this.isViewProcessVariables = !this.isViewProcessVariables;
        },
        addProcessVariables() {
            if (this.editDialog == true) {
                this.editDialog = false;
            }
            this.processVariablesWindow = !this.processVariablesWindow;
        },
        updateElement(element) {
            this.$emit('update');
        },
        openPanel(id) {
            console.log(id);
            this.panel = true;
            this.element = this.findElement(this.definitions, 'id', id);
            this.$refs.bpmnVue.extendUEngineProperties(this.element);
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
                    return 'ScriptActivity';
                case 'bpmn:sendTask':
                    return 'EmailActivity';
                default:
                    return 'UserActivity';
            }
        },
        convertElementToJSON(element) {
            console.log(element.name);
            if (element.$type.includes('Task')) {
                // Task Parser
                let taskType = this.taskMapping(element.$type);
                let inputData = {};
                let outputData = {};
                this.copyElement?.extensionElements?.values?.[0]?.$children?.[0]?.$children.forEach(function (data) {
                    console.log(data);
                    if (data.category == 'input') {
                        inputData[data.key] = { mandatory: data.mandatory ? data.mandatory : false };
                        // inputData.push(obj)
                    } else if (data.category == 'output') {
                        outputData[data.key] = { mandatory: data.mandatory ? data.mandatory : false };
                    }
                });
                let resultInputData = Object.keys(inputData).length > 0 ? [inputData] : [];
                let resultOutputData = Object.keys(outputData).length > 0 ? [outputData] : [];
                let checkpoints = [];
                element.extensionElements?.values[0]?.$children[0]?.$children.forEach(function (checkpoint) {
                    checkpoints.push(checkpoint.checkpoint);
                });
                let task = {
                    checkpoints: checkpoints,
                    description: element.extensionElements.values[0].description,
                    id: element.id,
                    inputData: resultInputData,
                    instruction: '',
                    name: element.name,
                    outputData: resultOutputData,
                    role: element.extensionElements.values[0].role,
                    type: taskType
                };
                if (element.extensionElements.values[0].pythonCode) task['pythonCode'] = element.extensionElements.values[0].pythonCode;
                console.log(task);
                this.updateItemByKey(this.copyProcessDefinition.activities, 'id', task.id, task);
            } else if (element.$type.includes('Flow')) {
                // Sequence Parser
                let sequence = {
                    name: element.name,
                    source: element.sourceRef.id,
                    target: element.targetRef.id,
                    condition: element.extensionElements.values[0].$children[0].$children[0].$body
                };
                this.updateItemByKey(this.copyProcessDefinition.sequences, 'source', sequence.source, sequence);
            } else if (element.$type.includes('Lane')) {
                // Role Parser
            }
        }
    }
};
</script>

<style scoped>
.processVariables-zoom {
    position: absolute;
    right: 20px;
    top: 20px;
    z-index: 1;
}
.processExecute {
    position: absolute;
    right: 80px;
    top: 20px;
    z-index: 1;
}
.processVariables-btn {
    position: absolute;
    left: 5px;
    top: 20px;
    z-index: 1;
}
</style>
