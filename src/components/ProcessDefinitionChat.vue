<template>
    <v-card elevation="10" style="background-color: rgba(255, 255, 255, 0)" :class="{ 'is-deleted': isDeleted }">
        <AppBaseCard>
            <template v-slot:leftpart>
                <process-definition
                    class="process-definition-resize"
                    :bpmn="bpmn"
                    :processDefinition="processDefinition"
                    :key="definitionChangeCount"
                    :isViewMode="isViewMode"
                    :definitionPath="fullPath"
                    :definitionChat="this"
                    @update="updateDefinition"
                ></process-definition>
                <process-definition-version-dialog
                    :process="processDefinition"
                    :loading="loading"
                    :open="versionDialog"
                    :definitionPath="fullPath"
                    @close="toggleVersionDialog"
                    @save="saveDefinition"
                ></process-definition-version-dialog>
                <ProcessDefinitionVersionManager
                    :process="processDefinition"
                    :open="verMangerDialog"
                    @close="toggleVerMangerDialog"
                    @changeXML="changeXML"
                ></ProcessDefinitionVersionManager>
            </template>
            <template v-slot:rightpart>
                <div class="no-scrollbar">
                    <Chat :prompt="prompt" :name="projectName" :messages="messages" :chatInfo="chatInfo" :userInfo="userInfo" :lock="lock" 
                        :disableChat="disableChat" @sendMessage="beforeSendMessage" @sendEditedMessage="sendEditedMessage" 
                        @stopMessage="stopMessage">
                        <template v-slot:custom-tools>
                            <div class="d-flex">
                                <v-tooltip location="bottom">
                                    <template v-slot:activator="{ props }">
                                        <v-btn v-bind="props"
                                            icon variant="text" 
                                            type="file"
                                            class="text-medium-emphasis"
                                            @click="triggerFileInput"
                                        >
                                            <Icon icon="material-symbols:upload" width="24" height="24" />
                                        </v-btn>
                                    </template>
                                    <span>{{ $t('chat.import') }}</span>
                                </v-tooltip>
                                <input type="file" ref="fileInput" @change="handleFileChange" accept=".bpmn" style="display: none;" />

                                <div v-if="bpmn && fullPath != ''">
                                    <v-tooltip location="bottom">
                                        <template v-slot:activator="{ props }">
                                            <v-btn v-bind="props" icon variant="text" class="text-medium-emphasis"
                                                @click="toggleLock">
                                                <Icon v-if="lock" icon="f7:lock" width="24" height="24"></Icon>
                                                <Icon v-else icon="f7:lock-open" width="24" height="24"></Icon>
                                            </v-btn>
                                        </template>
                                        <span v-if="lock">{{ $t('chat.unlock') }}</span>
                                        <span v-else>{{ $t('chat.lock') }}</span>
                                    </v-tooltip>
                                    
                                    <v-tooltip location="bottom">
                                        <template v-slot:activator="{ props }">
                                            <v-btn v-bind="props" icon variant="text" class="text-medium-emphasis"
                                                @click="toggleVerMangerDialog">
                                                <HistoryIcon size="24" />
                                            </v-btn>
                                        </template>
                                        <span>{{ $t('chat.history') }}</span>
                                    </v-tooltip>
                                </div>
                                <div v-else>
                                    <v-tooltip location="bottom">
                                        <template v-slot:activator="{ props }">
                                            <v-btn v-bind="props" icon variant="text" class="text-medium-emphasis"
                                                @click="toggleLock">
                                                <Icon icon="material-symbols:save" width="24" height="24" />
                                            </v-btn>
                                        </template>
                                        <span>{{ $t('chat.processDefinitionSave') }}</span>
                                    </v-tooltip>
                                </div>
                                
                                <v-tooltip location="bottom">
                                    <template v-slot:activator="{ props }">
                                        <v-btn v-if="bpmn && fullPath != ''" v-bind="props" icon variant="text" class="text-medium-emphasis"
                                            @click="beforeDelete">
                                            <TrashIcon size="24" />
                                        </v-btn>
                                    </template>
                                    <span>{{ $t('processDefinition.deleteProcess') }}</span>
                                </v-tooltip>
                            </div>
                        </template>
                    </Chat>
                </div>
                <v-dialog v-model="deleteDialog" max-width="500">
                    <v-card>
                        <v-card-text>
                            {{ $t('processDefinition.deleteProcessMessage') }}
                        </v-card-text>
                        <v-card-actions class="justify-center pt-0">
                            <v-btn color="primary" variant="flat" @click="deleteProcess">{{ $t('processDefinition.delete') }}</v-btn>
                            <v-btn color="error" variant="flat" @click="deleteDialog = false">{{ $t('processDefinition.cancel') }}</v-btn>
                        </v-card-actions>
                    </v-card>
                </v-dialog>
            </template>

            <template v-slot:mobileLeftContent>
                <Chat :prompt="prompt" :name="projectName" :messages="messages" :chatInfo="chatInfo" :userInfo="userInfo" :lock="lock"
                    :disableChat="disableChat" @sendMessage="beforeSendMessage" @sendEditedMessage="sendEditedMessage"
                    @stopMessage="stopMessage">
                    <template v-slot:custom-tools>
                        <div class="d-flex">
                            <v-tooltip location="bottom">
                                <template v-slot:activator="{ props }">
                                    <v-btn v-bind="props"
                                        icon variant="text" 
                                        type="file"
                                        class="text-medium-emphasis"
                                        @click="triggerFileInput"
                                    >
                                        <Icon icon="material-symbols:upload" width="24" height="24" />
                                    </v-btn>
                                </template>
                                <span>{{ $t('chat.import') }}</span>
                            </v-tooltip>
                            <input type="file" ref="fileInput" @change="handleFileChange" accept=".bpmn" style="display: none;" />

                            <v-tooltip location="bottom">
                                <template v-slot:activator="{ props }">
                                    <v-btn v-bind="props" icon variant="text" class="text-medium-emphasis" @click="toggleLock">
                                        <Icon v-if="lock" icon="f7:lock" width="24" height="24"></Icon>
                                        <Icon v-else icon="f7:lock-open" width="24" height="24"></Icon>
                                    </v-btn>
                                </template>
                                <span v-if="lock">{{ $t('chat.unlock') }}</span>
                                <span v-else>{{ $t('chat.lock') }}</span>
                            </v-tooltip>
                            
                            <v-tooltip location="bottom">
                                <template v-slot:activator="{ props }">
                                    <v-btn v-bind="props" icon variant="text" class="text-medium-emphasis" @click="toggleVerMangerDialog">
                                        <HistoryIcon size="24" />
                                    </v-btn>
                                </template>
                                <span>{{ $t('chat.history') }}</span>
                            </v-tooltip>
                            
                            <v-tooltip location="bottom">
                                <template v-slot:activator="{ props }">
                                    <v-btn v-if="bpmn && fullPath != ''" v-bind="props" icon variant="text" class="text-medium-emphasis" @click="beforeDelete">
                                        <TrashIcon size="24" />
                                    </v-btn>
                                </template>
                                <span>{{ $t('processDefinition.deleteProcess') }}</span>
                            </v-tooltip>
                        </div>
                    </template>
                </Chat>
            </template>
        </AppBaseCard>
    </v-card>
</template>
<script>
import partialParse from 'partial-json-parser';
import { VectorStorage } from 'vector-storage';
import xml2js from 'xml2js';

import ProcessDefinition from '@/components/ProcessDefinition.vue';
import ProcessDefinitionVersionDialog from '@/components/ProcessDefinitionVersionDialog.vue';
import ProcessDefinitionVersionManager from '@/components/ProcessDefinitionVersionManager.vue';
import ChatDetail from '@/components/apps/chats/ChatDetail.vue';
import ChatListing from '@/components/apps/chats/ChatListing.vue';
import ChatProfile from '@/components/apps/chats/ChatProfile.vue';
import AppBaseCard from '@/components/shared/AppBaseCard.vue';
import { useBpmnStore } from '@/stores/bpmn';

import * as jsondiff from 'jsondiffpatch';
import ChatModule from './ChatModule.vue';
import ChatGenerator from './ai/ProcessDefinitionGenerator';
import Chat from './ui/Chat.vue';

import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();

// import BpmnModelingCanvas from '@/components/designer/bpmnModeling/BpmnModelCanvas.vue';
var jsondiffpatch = jsondiff.create({
    objectHash: function (obj, index) {
        return '$$index:' + index;
    }
});
export default {
    mixins: [ChatModule],
    name: 'ProcessDefinitionChat',
    components: {
        Chat,
        AppBaseCard,
        ChatListing,
        ChatDetail,
        ChatProfile,
        ProcessDefinition,
        // BpmnModelingCanvas,
        ChatGenerator,
        ProcessDefinitionVersionDialog,
        ProcessDefinitionVersionManager
    },
    data: () => ({
        prompt: "",
        processDefinition: null,
        bpmn: null,
        changedXML: '',
        projectName: '',
        path: 'proc_def',
        definitionChangeCount: 0,
        isChanged: false,
        chatInfo: {
            title: 'processDefinition.cardTitle',
            text: 'processDefinition.processDefinitionExplanation'
        },
        processDefinitionMap: null,
        modeler: null,
        lock: false,
        disableChat: false,
        isViewMode: false,
        // version
        versionDialog: false,
        verMangerDialog: false,
        loading: false,
        // delete
        deleteDialog: false,
        isDeleted: false,
    }),
    async created() {
        $try(async ()=>{
            await this.init();
            this.generator = new ChatGenerator(this, {
                isStream: true,
                preferredLanguage: 'Korean'
            });
            if(this.$store.state.messages) {
                const messagesString = JSON.stringify(this.$store.state.messages);
                this.prompt = `아래 대화 내용에서 프로세스를 유추하여 프로세스 정의를 생성해주세요. 이때 가능한 프로세스를 일반화하여 작성:
                ${messagesString}.`;
                this.$store.commit('clearMessages');
            }
        })
    },
    watch: {
        $route: {
            deep: true,
            handler(newVal, oldVal) {
                if (newVal.path !== oldVal.path) {
                    if (!(newVal.path.startsWith('/definitions') || newVal.path.startsWith('/forms'))) return;

                    if (newVal.params.pathMatch) {
                        this.init();
                    }
                }
            }
        }
    },
    computed: {
        fullPath() {
            let path = this.$route.params.pathMatch.join('/');
            if (path.startsWith('/')) {
                path = fullPath.substring(1);
            }
            return path;
        }
    },
    async beforeRouteLeave(to, from, next) {
        const store = useBpmnStore();
        const modeler = store.getModeler;
        const xmlObj = await modeler.saveXML({ format: true, preamble: true });

        if (from.path === '/definitions/chat' && xmlObj && xmlObj.xml && !this.isViewMode) {
            const answer = window.confirm('You have unsaved changes. Are you sure you want to leave?');
            if (answer) {
                next();
            } else {
                next(false);
            }
        } else {
            next();
        }
    },
    methods: {
        beforeDelete() {
            if (this.bpmn) {
                this.deleteDialog = true;
            }
        },
        async deleteProcess() {
            var me = this;
            me.$try({
                context: me,
                action: async () => {
                    await backend.deleteDefinition(me.fullPath);
                    me.deleteDialog = false;
                    me.isDeleted = true;
                    me.EventBus.emit('definitions-updated');
                }
            });
        },
        triggerFileInput() {
            this.$refs.fileInput.click();
        },
        handleFileChange(event) {
            let me = this;
            const file = event.target.files[0];
            if (!file) {
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                const content = e.target.result;
                // 파일 내용 처리
                me.loadBPMN(content);
            };
            reader.readAsText(file);
        },
        checkedLock(defId) {
            var me = this;
            me.$try({
                context: me,
                action: async () => {
                    const lockObj = await me.getData(`lock/${defId}`, { key: 'id' });
                    if (lockObj && lockObj.id && lockObj.user_id && lockObj.user_id == this.userInfo.email) {
                        me.lock = false;
                        me.disableChat = false;
                        me.isViewMode = false;
                    } else {
                        me.lock = true;
                        me.disableChat = true;
                        me.isViewMode = true;
                    }
                }
            });
        },
        toggleLock() {
            var me = this;
            me.$try({
                context: me,
                action: async () => {
                    if (me.lock) {
                        // 잠금 > 수정가능 하도록
                        if (me.processDefinition && me.useLock) {
                            await me.storage.putObject('lock', {
                                id: me.processDefinition.processDefinitionId,
                                user_id: me.userInfo.email
                            });
                        }
                        me.disableChat = false;
                        me.isViewMode = false;
                        me.lock = false;
                        me.definitionChangeCount++;
                    } else {
                        // 현재 수정가능 > 잠금 상태로 (저장)
                        me.toggleVersionDialog(true);
                    }
                }
            });
        },
        toggleVerMangerDialog(open) {
            // Version Manager Dialog
            this.verMangerDialog = open;
        },
        toggleVersionDialog(open) {
            // Version Dialog
            this.versionDialog = open;
        },
        saveDefinition(info) {
            var me = this;
            me.$try({
                context: me,
                action: async () => {
                    me.loading = true;

                    const store = useBpmnStore();
                    const modeler = store.getModeler;
                    const xmlObj = await modeler.saveXML({ format: true, preamble: true });

                    // if (me.processDefinition) {
                    //     info.definition = me.processDefinition;
                    // }
                    if (xmlObj && xmlObj.xml && window.$mode != 'uEngine') {
                        me.processDefinition = await me.convertXMLToJSON(xmlObj.xml);
                        if (info.name && info.name != '') {
                            me.processDefinition.processDefinitionName = info.name;
                        }
                        info.definition = me.processDefinition;
                    }

                    await me.saveModel(info, xmlObj.xml);
                    me.bpmn = xmlObj.xml;

                    me.disableChat = true;
                    me.isViewMode = true;
                    me.lock = true; // 잠금처리 ( 수정 불가 )
                    me.definitionChangeCount++;
                    
                    // 신규 프로세스 이동.
                    if (me.fullPath == 'chat') {
                        me.$router.push(`/definitions/${info.proc_def_id}`);
                        me.EventBus.emit('definitions-updated');
                    }

                    me.loading = false;
                    me.toggleVersionDialog(false);

                },
                onFail: (e) => {
                    console.log(e)
                }
            });
        },
        changeXML(info) {
            var me = this;
            me.$try({
                context: me,
                action: async () => {
                    if (!info) return;
                    if (!info.id) return;

                    await me.storage.putObject(`${me.path}`, {
                        id: info.id,
                        name: info.name,
                        bpmn: info.xml
                    });
                    me.bpmn = info.xml;
                    me.definitionChangeCount++;
                    me.toggleVerMangerDialog(false);
                }
            });
        },
        loadBPMN(bpmn) {
            this.bpmn = bpmn;
            this.definitionChangeCount++;
        },
        removePositionKey(obj) {
            // 배열인 경우, 각 요소에 대해 재귀적으로 함수를 호출
            if (Array.isArray(obj)) {
                return obj.map((item) => removePositionKey(item));
            }
            // 객체인 경우, 키를 순회하며 'position' 키를 제외한 새 객체 생성
            else if (typeof obj === 'object' && obj !== null) {
                const newObj = {};
                Object.keys(obj).forEach((key) => {
                    if (key !== 'position') {
                        // 'position' 키가 아닌 경우, 재귀적으로 처리
                        newObj[key] = removePositionKey(obj[key]);
                    }
                });
                return newObj;
            }
            // 기본 타입인 경우, 그대로 반환
            return obj;
        },
        async updateDefinition() {
            const store = useBpmnStore();
            let modeler = store.getModeler;
            let xml = await modeler.saveXML({ format: true, preamble: true });
            console.log(xml.xml);
            this.bpmn = xml.xml;
            this.definitionChangeCount++;
            // this.processDefinition = val
            // this.bpmn = this.createBpmnXml(val)
            this.isChanged = true;
        },
        async loadData(path) {
            const me = this;
            me.$try({
                context: me,
                action: async () => {
                    me.isDeleted = false;
                    let fullPath = me.$route.params.pathMatch.join('/');
                    if (fullPath.startsWith('/')) {
                        fullPath = fullPath.substring(1);
                    }
                    let lastPath = this.$route.params.pathMatch[this.$route.params.pathMatch.length - 1];
                    if (fullPath && lastPath != 'chat') {
                        let definition = await backend.getRawDefinition(fullPath, { type: 'bpmn' });
                        if (definition) {
                            me.bpmn = definition;
                            me.definitionChangeCount++;
                        }
                        if (me.useLock) {
                            const value = await backend.getRawDefinition(fullPath);
                            if (value) {
                                me.processDefinition = value.definition;
                                me.projectName = me.processDefinition.processDefinitionName;
                            }
                            me.checkedLock(lastPath);
                        } else {
                            me.processDefinition = {
                                processDefinitionId: lastPath,
                                processDefinitionName: lastPath
                            }
                        }
                    } else if (lastPath == 'chat') {
                        me.processDefinition = null;
                        me.projectName = null;
                        me.bpmn = null;

                        if (me.$route.query && me.$route.query.id) {
                            me.processDefinition = {
                                processDefinitionId: me.$route.query.id
                            };
                            if (me.$route.query.name) {
                                me.projectName = me.$route.query.name;
                                me.processDefinition.processDefinitionName = me.projectName;
                            }
                        }
                        
                        me.lock = false;
                        me.disableChat = false;
                        me.isViewMode = false;
                        me.definitionChangeCount++;
                    }
                    me.processDefinitionMap = await backend.getProcessDefinitionMap();
                }
            });
        },

        beforeSendMessage(newMessage) {
            this.sendMessage(newMessage);
        },
        extractPropertyNameAndIndex(jsonPath) {
            let match;
            match = jsonPath.match(/^\$\.(\w+)\[(\d+)\]$/);
            if (!match) {
                match = jsonPath.match(/^\$\.(\w+)\[\?(.*)\]$/);
                return match ? { propertyName: match[1], index: match.index } : null;
            } else {
                return { propertyName: match[1], index: parseInt(match[2], 10) };
            }
        },
        modificationAdd(modification) {
            let obj = this.extractPropertyNameAndIndex(modification.targetJsonPath);
            if (obj) {
                this.processDefinition[obj.propertyName].splice(obj.index, 0, modification.value);
            } else if (this.processDefinition[modification.targetJsonPath.replace('$.', '')]) {
                this.processDefinition[modification.targetJsonPath.replace('$.', '')].push(modification.value);
            }
        },
        modificationReplace(modification) {
            let obj = this.extractPropertyNameAndIndex(modification.targetJsonPath);
            // const updateAtIndex = (array, index, newValue) => (array[index] = newValue, array);
            this.processDefinition[obj.propertyName][obj.index] = modification.value;
            // this.processDefinition[obj.propertyName].splice(obj.index, 0, modification.value)
        },
        modificationRemove(modification) {
            let obj = this.extractPropertyNameAndIndex(modification.targetJsonPath);
            this.processDefinition[obj.propertyName].splice(obj.index, 1);
            // {
            //     action: "replace",
            //     index: 2,
            //     targetJsonPath: "$.sequences[2]",
            //     value: {
            //         "source": "AcceptLeader",
            //         "target": "ReturnFromLeave"
            //     }
            // }
        },
        async afterModelCreated(response) {
            let jsonProcess;
            try {
                jsonProcess = this.extractJSON(response);

                if (jsonProcess) {
                    let unknown = partialParse(jsonProcess);
                    if (unknown.processDefinitionId) {
                        this.processDefinition = unknown;
                        this.bpmn = this.createBpmnXml(this.processDefinition);
                        this.definitionChangeCount++;
                    }
                }
            } catch (error) {
                console.log(jsonProcess);
                console.log(error);
            }
        },

        afterGenerationFinished(response) {
            let jsonProcess = this.extractJSON(response);

            if (jsonProcess) {
                let unknown = JSON.parse(jsonProcess);
                if (unknown.modifications) {
                    unknown.modifications.forEach((modification) => {
                        if (modification.action == 'replace') {
                            this.jsonPathReplace(this.processDefinition, modification.targetJsonPath, modification.value);
                            console.log(this.processDefinition);
                            this.bpmn = this.createBpmnXml(this.processDefinition);
                        } else if (modification.action == 'add') {
                            this.modificationAdd(modification);
                            this.bpmn = this.createBpmnXml(this.processDefinition);
                        } else if (modification.action == 'delete') {
                            this.modificationRemove(modification);
                            this.bpmn = this.createBpmnXml(this.processDefinition);
                        }
                    });

                    this.definitionChangeCount++;
                }
            }

            this.isChanged = true;
        },
        afterModelStopped(response) {
        },
        async convertXMLToJSON(xmlString) {
            try {
                xmlString = xmlString.replace(/\$type/g, '_type');//sanitizing for $type

                const parser = new xml2js.Parser({ explicitArray: false, mergeAttrs: true });
                const result = await parser.parseStringPromise(xmlString);
                const process = result['bpmn:definitions'] && result['bpmn:definitions']['bpmn:process'] ? result['bpmn:definitions']['bpmn:process'] : {};
                const startEvent = process['bpmn:startEvent'] || {};
                const endEvent = process['bpmn:endEvent'] || {};
                function ensureArray(item) {
                    return Array.isArray(item) ? item : (item ? [item] : []);
                }
                const lanes = ensureArray(process['bpmn:laneSet'] ? process['bpmn:laneSet']['bpmn:lane'] : []);
                const activities = ensureArray(process['bpmn:userTask'] || []);
                const scriptTasks = ensureArray(process['bpmn:scriptTask'] || []);
                const sequenceFlows = ensureArray(process['bpmn:sequenceFlow'] || []);
                const gateways = ensureArray(process['bpmn:exclusiveGateway'] || []);

                const data = process['bpmn:extensionElements'] && process['bpmn:extensionElements']['uengine:properties'] ? (Array.isArray(process['bpmn:extensionElements']['uengine:properties']['uengine:variable']) ? process['bpmn:extensionElements']['uengine:properties']['uengine:variable'] : [process['bpmn:extensionElements']['uengine:properties']['uengine:variable']]).map(varData => ({
                        name: varData.name,
                        description: varData.name + ' description',
                        type: varData.type
                    })) : [];


                const jsonData = {
                    processDefinitionName: process.id || 'Unknown',
                    processDefinitionId: process.id || 'Unknown',
                    description: "process.description",
                    data: data,
                    roles: lanes.map(lane => ({
                        name: lane.name,
                        resolutionRule: lane.name === 'applicant' ? 'initiator' : 'system'
                    })),
                    events: [
                        {
                            name: startEvent.id || 'StartEvent',
                            id: startEvent.id || 'StartEvent',
                            type: 'StartEvent',
                            description: 'start event',
                            role: lanes[0] ? lanes[0].name : 'Unknown'
                        },
                        {
                            name: endEvent.id || 'EndEvent',
                            id: endEvent.id || 'EndEvent',
                            type: 'EndEvent',
                            description: 'end event',
                            role: lanes.length > 0 ? lanes[lanes.length - 1].name : 'Unknown'
                        }
                    ],
                    activities: [
                        ...activities.map(activity => {
                            try{
                                let task = {}
                                task.name = activity.name
                                task.id = activity.id
                                task.type = 'UserActivity'
                                task.description = `${activity.name} description`
                                task.instruction = `${activity.name} instruction`
                                task.role = lanes.find(lane => {
                                        const flowNodeRefs = Array.isArray(lane['bpmn:flowNodeRef']) ? lane['bpmn:flowNodeRef'] : [lane['bpmn:flowNodeRef']];
                                        return flowNodeRefs.includes(activity.id);
                                    }) ? 
                                    lanes.find(lane => {
                                        const flowNodeRefs = Array.isArray(lane['bpmn:flowNodeRef']) ? lane['bpmn:flowNodeRef'] : [lane['bpmn:flowNodeRef']];
                                        return flowNodeRefs.includes(activity.id);
                                    }).name : 'Unknown'

                                let isProperties = activity['bpmn:extensionElements'] && activity['bpmn:extensionElements']['uengine:properties']

                                if(isProperties){
                                    let parseProperties = JSON.parse(activity['bpmn:extensionElements']['uengine:properties']['uengine:json'])
                                    task.inputData = parseProperties && parseProperties.parameters ? parseProperties.parameters.filter(param => param.direction === "IN")
                                        .map(param => param.variable.name) : []
                                    task.outputData = parseProperties && parseProperties.parameters ? parseProperties.parameters.filter(param => param.direction === "OUT")
                                        .map(param => param.variable.name) : []
                                } else {
                                    task.inputData = []
                                    task.outputData = []
                                }
                                task.tool = "formHandler:" + JSON.parse(activity['bpmn:extensionElements']['uengine:properties']['uengine:json']).variableForHtmlFormContext.name
                                return task
                            }catch(e){

                            }
                        }
                        
                        ),
                        ...scriptTasks.map(task => ({
                            name: task.name,
                            id: task.id,
                            type: 'ScriptActivity',
                            description: task.name + ' description',
                            instruction: task.name + ' instruction',
                            role: lanes.find(lane => {
                                const flowNodeRefs = Array.isArray(lane['bpmn:flowNodeRef']) ? lane['bpmn:flowNodeRef'] : [lane['bpmn:flowNodeRef']];
                                return flowNodeRefs.includes(task.id);
                            }) ? lanes.find(lane => {
                                const flowNodeRefs = Array.isArray(lane['bpmn:flowNodeRef']) ? lane['bpmn:flowNodeRef'] : [lane['bpmn:flowNodeRef']];
                                return flowNodeRefs.includes(task.id);
                            }).name : 'Unknown',
                            pythonCode: task['bpmn:extensionElements'] && task['bpmn:extensionElements']['uengine:properties'] ? JSON.parse(task['bpmn:extensionElements']['uengine:properties']['uengine:json']).script : ''
                        }))
                    ],
                    gateways: [
                        ...gateways.map(gateway => ({
                            id: gateway.id || 'Gateway',
                            name: gateway.name || 'Gateway',
                            type: "ExclusiveGateway",
                            description: gateway.name + ' description',
                            role: lanes.find(lane => {
                                const flowNodeRefs = Array.isArray(lane['bpmn:flowNodeRef']) ? lane['bpmn:flowNodeRef'] : [lane['bpmn:flowNodeRef']];
                                return flowNodeRefs.includes(gateway.id);
                            }) ? lanes.find(lane => {
                                const flowNodeRefs = Array.isArray(lane['bpmn:flowNodeRef']) ? lane['bpmn:flowNodeRef'] : [lane['bpmn:flowNodeRef']];
                                return flowNodeRefs.includes(gateway.id);
                            }).name : 'Unknown',
                            condition: gateway['bpmn:extensionElements'] && gateway['bpmn:extensionElements']['uengine:properties'] ? JSON.parse(gateway["bpmn:extensionElements"]["uengine:properties"]["uengine:json"]).condition || '' : ''
                        }))
                    ],
                    sequences: sequenceFlows.map(flow => ({
                        source: flow.sourceRef,
                        target: flow.targetRef,
                        condition: flow['bpmn:extensionElements'] && flow['bpmn:extensionElements']['uengine:properties'] ? JSON.parse(flow["bpmn:extensionElements"]["uengine:properties"]["uengine:json"]).condition || '' : ''
                    }))
                };
                return jsonData;
            } catch (error) {
                console.error('Error parsing XML:', error);
                throw error;
            }
        },
        // convertXMLToJSON(xmlString) {
        //     const parser = new DOMParser();
        //     const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
        //     // Lanes (Roles) 추출
        //     const lanes = xmlDoc.getElementsByTagName('bpmn:lane');
        //     const laneMap = Array.from(lanes).reduce((acc, lane) => {
        //         const laneName = lane.getAttribute('name');
        //         const flowNodeRefs = lane.getElementsByTagName('bpmn:flowNodeRef');
        //         Array.from(flowNodeRefs).forEach((flowNodeRef) => {
        //             const activityId = flowNodeRef.textContent;
        //             acc[activityId] = laneName; // Map activity ID to lane (role) name
        //         });
        //         return acc;
        //     }, {});

        //     // User Tasks 추출
        //     const userTasks = xmlDoc.getElementsByTagName('bpmn:userTask');
        //     const activities = Array.from(userTasks).map((task) => {
        //         const id = task.getAttribute('id');
        //         return {
        //             name: task.getAttribute('name'),
        //             id: id,
        //             type: 'UserActivity',
        //             description: '', // XML에서 제공되지 않음
        //             instruction: '', // XML에서 제공되지 않음
        //             role: laneMap[id] || '', // LaneMap에서 Role 할당
        //             inputData: [], // XML에서 제공되지 않음
        //             outputData: [], // XML에서 제공되지 않음
        //             checkpoints: [] // XML에서 제공되지 않음
        //         };
        //     });

        //     // Sequence Flows 추출
        //     const sequenceFlows = xmlDoc.getElementsByTagName('bpmn:sequenceFlow');
        //     const sequences = Array.from(sequenceFlows)
        //         .map((flow) => {
        //             if (flow.getAttribute('sourceRef') != 'StartEvent_1' && flow.getAttribute('targetRef') != 'EndEvent')
        //                 return {
        //                     source: flow.getAttribute('sourceRef'),
        //                     target: flow.getAttribute('targetRef')
        //                 };
        //         })
        //         .filter((flow) => flow);

        //     // activities 배열을 sequenceFlow의 순서에 따라 정렬
        //     // const orderedActivities = [];
        //     // let currentId = xmlDoc.getElementsByTagName("bpmn:startEvent")[0].getAttribute("id");
        //     // while (sequences.length > 0) {
        //     //     const currentIndex = sequences.findIndex(seq => seq.source === currentId);
        //     //     if (currentIndex === -1) break;

        //     //     const currentSequence = sequences.splice(currentIndex, 1)[0];
        //     //     const activityIndex = activities.findIndex(act => act.id === currentSequence.target);
        //     //     if (activityIndex !== -1) {
        //     //         orderedActivities.push(activities[activityIndex]);
        //     //     }
        //     //     currentId = currentSequence.target;
        //     // }
        //     let orderedActivities = this.orderActivitiesBySequence(activities, sequences);

        //     return { activities: orderedActivities, sequences };
        // },
        // orderActivitiesBySequence(activities, sequences) {
        //     // 시작 활동 찾기: 'source'가 되지만 'target'이 되지 않는 항목
        //     const orderedActivities = []
        //     let currentId = sequences.find((seq) => !sequences.some((innerSeq) => innerSeq.target === seq.source))?.source;
        //     let startActivity = activities.findIndex((act) => act.id === currentId);
        //     if (startActivity !== -1) {
        //         orderedActivities.push(activities[startActivity]);
        //     }
        //     const visitedSequences = new Set(); // 중복 방문 방지
        //     // orderedActivities.push(ac)
        //     while (currentId && sequences.length > visitedSequences.size) {
        //         const sequence = sequences.find((seq) => seq.source === currentId && !visitedSequences.has(seq.source + seq.target));
        //         if (!sequence) break; // 다음 시퀀스를 찾을 수 없으면 중단

        //         visitedSequences.add(sequence.source + sequence.target); // 시퀀스 방문 기록
        //         const activityIndex = activities.findIndex((act) => act.id === sequence.target);
        //         if (activityIndex !== -1) {
        //             orderedActivities.push(activities[activityIndex]);
        //         }
        //         currentId = sequence.target; // 다음 대상으로 이동
        //     }

        //     return orderedActivities;
        // },
        // convertToProcessDefinition(jsonInput) {
        //     const processDefinition = {
        //         processDefinitionName: jsonInput.name,
        //         processDefinitionId: jsonInput.definitionId,
        //         description: '', // Assuming a generic description; update as needed
        //         data: jsonInput.processVariableDescriptors.map((variable) => ({
        //             name: variable.name,
        //             description: variable.displayName.text,
        //             type: 'Text' // Assuming all variables are of type Text; update logic as needed for different types
        //         })),
        //         roles: Object.values(jsonInput.elements)
        //             .filter((element) => element != null)
        //             .filter((element) => element._type == 'org.uengine.kernel.Role')
        //             .map((role) => ({
        //                 name: role.name,
        //                 resolutionRule: role.roleResolutionContext.endpoint
        //             })),
        //         activities: Object.values(jsonInput.elements)
        //             .filter((element) => element != null)
        //             .filter((element) => element._type == 'org.uengine.kernel.HumanActivity')
        //             .map((activity) => ({
        //                 name: activity.name || activity.oldName,
        //                 id: activity.elementView.id,
        //                 type: 'UserActivity', // Assuming UserActivity; update as needed for different activity types
        //                 description: activity.name + ' 활동', // Assuming a generic description; update as needed
        //                 instruction: '장애 정보를 기반으로 문제를 해결하세요.', // Assuming a generic instruction; update as needed
        //                 role: activity.role.name,
        //                 inputData: activity.parameters?.map((param) => ({
        //                     name: param.variable.name
        //                 })),
        //                 outputData: activity.parameters?.map((param) => ({
        //                     name: param.variable.name
        //                 })),
        //                 checkpoints: [] // Assuming no checkpoints; update as needed
        //             })),
        //         sequences: Object.values(jsonInput.relations)
        //             .filter((relation) => relation != null)
        //             .filter((relation) => relation._type == 'org.uengine.kernel.bpmn.SequenceFlow')
        //             .map((sequence) => ({
        //                 source: sequence.from,
        //                 target: sequence.to
        //             }))
        //     };

        //     return processDefinition;
        // },
        async saveModel(info, xml) {
            var me = this;
            me.$try({
                context: me,
                action: async () => {
                
                    if(window.$mode == 'uEngine') {
                        // GPT
                        await backend.putRawDefinition(xml, info.proc_def_id, info);

                        if (me.$route.fullPath == '/definitions/chat') {
                            me.$router.push('/definitions/' + info.proc_def_id);
                        }
                    } else {
                        // uEngine
                        if(!me.processDefinition) me.processDefinition = {}
                        if(!me.processDefinition.processDefinitionId) me.processDefinition.processDefinitionId = null
                        if(!me.processDefinition.processDefinitionName) me.processDefinition.processDefinitionName = null


                        me.processDefinition.processDefinitionId = info.proc_def_id ? info.proc_def_id : prompt('please give a ID for the process definition');

                        if (!me.processDefinition.processDefinitionName && info.name) {
                            me.processDefinition.processDefinitionName = info.name
                        } else if (!me.processDefinition.processDefinitionName && !info.name) {
                            me.processDefinition.processDefinitionName = prompt('please give a name for the process definition');
                        }

                        me.projectName = me.processDefinition.processDefinitionName;
                        if (!me.processDefinition.processDefinitionId || !me.processDefinition.processDefinitionName) {
                            throw new Error('processDefinitionId or processDefinitionName is missing');
                        }
                        await backend.putRawDefinition(xml, info.proc_def_id, info);
                        await this.saveToVectorStore(me.processDefinition);

                        if (me.$route.fullPath == '/definitions/chat') {
                            me.$router.push('/definitions/' + me.processDefinition.processDefinitionId);
                        }
                    }
                },
                catch: (e) => {
                    console.log(e)
                }
            });
        },
        async saveToVectorStore(definition) {
            // Create an instance of VectorStorage
            // const apiToken = this.generator.getToken();
            const vectorStore = new VectorStorage({ openAIApiKey: this.openaiToken });

            // Add a text document to the store
            await vectorStore.addText(JSON.stringify(definition), {
                category: definition.processDefinitionId
            });
        },
        generateElement(name, x, y, width, height, id, canvas) {
            var me = this;
            const component = me.getComponentByName(name);
            if (!component) return null;

            if (!id) id = me.uuid();
            if (!x) x = 500;
            if (!y) x = 500;
            if (!canvas) canvas = null;

            return component.computed.createNew(canvas, id, x, y, width, height);
        },
        getComponentByName: function (name) {
            var componentByName;
            $.each(window.bpmnComponents, function (i, component) {
                if (component.default.name == name) {
                    componentByName = component;
                }
            });
            return componentByName;
        },
        // createBpmnXml(jsonModel) {
        //     const bpmnDefinitions = {
        //         "$type": "bpmn:Definitions",
        //         "id": "Definitions_1",
        //         "targetNamespace": "http://bpmn.io/schema/bpmn",
        //         "exporter": "Custom BPMN Modeler",
        //         "exporterVersion": "1.0",
        //         "rootElements": [
        //             {
        //                 "$type": "bpmn:Collaboration",
        //                 "id": "Collaboration_1",
        //                 "participants": [
        //                     {
        //                         "$type": "bpmn:Participant",
        //                         "id": "Participant_" + jsonModel.processDefinitionId,
        //                         "name": jsonModel.processDefinitionName,
        //                         "$parent": "Collaboration_1"
        //                     }
        //                 ],
        //                 "$parent": "Definitions_1"
        //             },
        //             {
        //                 "$type": "bpmn:Process",
        //                 "id": jsonModel.processDefinitionId,
        //                 "isExecutable": true,
        //                 "laneSets": [
        //                     {
        //                         "$type": "bpmn:LaneSet",
        //                         "id": "LaneSet_" + jsonModel.processDefinitionId,
        //                         "$parent": jsonModel.processDefinitionId
        //                     }
        //                 ],
        //                 "flowElements": jsonModel.activities.map(activity => ({
        //                     "$type": "bpmn:UserTask",
        //                     "id": activity.id,
        //                     "name": activity.name,
        //                     "$parent": jsonModel.processDefinitionId
        //                 })).concat(jsonModel.sequences.map(sequence => ({
        //                     "$type": "bpmn:SequenceFlow",
        //                     "id": "SequenceFlow_" + sequence.source + "_" + sequence.target,
        //                     "$parent": jsonModel.processDefinitionId,
        //                     "sourceRef": sequence.source,
        //                     "targetRef": sequence.target
        //                 }))),
        //                 "$parent": "Definitions_1"
        //             }
        //         ],
        //         "diagrams": [
        //             {
        //                 "$type": "bpmndi:BPMNDiagram",
        //                 "id": "BPMNDiagram_" + jsonModel.processDefinitionId,
        //                 "plane": {
        //                     "$type": "bpmndi:BPMNPlane",
        //                     "id": "BPMNPlane_" + jsonModel.processDefinitionId,
        //                     "planeElement": jsonModel.activities.map((activity, index) => ({
        //                         "$type": "bpmndi:BPMNShape",
        //                         "id": "BPMNShape_" + activity.id,
        //                         "bounds": {
        //                             "$type": "dc:Bounds",
        //                             "x": 150 + (index * 100), // 간격 조정
        //                             "y": 120 + (index * 60), // 높이 조정
        //                             "width": 80,
        //                             "height": 60
        //                         },
        //                         "bpmnElement": activity.id,
        //                         "$parent": "BPMNPlane_" + jsonModel.processDefinitionId
        //                     })),
        //                     "bpmnElement": "Collaboration_1",
        //                     "$parent": "BPMNDiagram_" + jsonModel.processDefinitionId
        //                 },
        //                 "$parent": "Definitions_1"
        //             }
        //         ]
        //     };

        //     // SequenceFlow에 대한 BPMNEdge 추가
        //     jsonModel.sequences.forEach((sequence, index) => {
        //         const sourceIndex = jsonModel.activities.findIndex(activity => activity.id === sequence.source);
        //         const targetIndex = jsonModel.activities.findIndex(activity => activity.id === sequence.target);

        //         bpmnDefinitions.diagrams[0].plane.planeElement.push({
        //             "$type": "bpmndi:BPMNEdge",
        //             "id": "BPMNEdge_" + sequence.source + "_" + sequence.target,
        //             "waypoint": [
        //                 {
        //                     "$type": "dc:Point",
        //                     "x": 190 + (sourceIndex * 100),
        //                     "y": 150 + (sourceIndex * 60)
        //                 },
        //                 {
        //                     "$type": "dc:Point",
        //                     "x": 190 + (targetIndex * 100),
        //                     "y": 150 + (targetIndex * 60)
        //                 }
        //             ],
        //             "bpmnElement": "SequenceFlow_" + sequence.source + "_" + sequence.target,
        //             "$parent": "BPMNPlane_" + jsonModel.processDefinitionId
        //         });
        //     });

        //     return bpmnDefinitions;
        // },
        // absY(y, height) {
        //     return element.elementView.y - (element.elementView.height / 2)
        // }
        taskMapping(activity) {
            switch (activity) {
                case 'ScriptActivity':
                    return 'bpmn:scriptTask';
                case 'EmailActivity':
                    return 'bpmn:sendTask';
                default:
                    return 'bpmn:userTask';
            }
        },
        createBpmnXml(jsonModel) {
            // XML 문서 초기화
            let me = this;
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(
                '<?xml version="1.0" encoding="UTF-8"?><bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:uengine="http://uengine" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" id="Definitions_0bfky9r" targetNamespace="http://bpmn.io/schema/bpmn" exporter="bpmn-js (https://demo.bpmn.io)" exporterVersion="16.4.0"></bpmn:definitions>',
                'application/xml'
            );
            const bpmnDefinitions = xmlDoc.documentElement;

            bpmnDefinitions.setAttribute('id', 'Definitions_' + jsonModel.processDefinitionId);
            bpmnDefinitions.setAttribute('targetNamespace', 'http://bpmn.io/schema/bpmn');
            bpmnDefinitions.setAttribute('exporter', 'Custom BPMN Modeler');
            bpmnDefinitions.setAttribute('exporterVersion', '1.0');

            const collaboration = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:collaboration');
            collaboration.setAttribute('id', 'Collaboration_1');
            bpmnDefinitions.appendChild(collaboration);

            const process = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:process');
            process.setAttribute('id', jsonModel.processDefinitionId);
            process.setAttribute('isExecutable', 'true');
            bpmnDefinitions.appendChild(process);
            // Collaboration 추가
            const pc = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:participant');
            pc.setAttribute('id', `Participant`);
            pc.setAttribute('name', `Participant`);
            pc.setAttribute('processRef', jsonModel.processDefinitionId);
            collaboration.appendChild(pc);

            // Data 매핑
            const extensionElements = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:extensionElements');
            const root = xmlDoc.createElementNS('http://uengine', 'uengine:properties');
            if (jsonModel.data) {
                jsonModel.data.forEach((data) => {
                    const variable = xmlDoc.createElementNS('http://uengine', 'uengine:variable');
                    variable.setAttribute('name', data.name);
                    variable.setAttribute('type', data.type);
                    root.appendChild(variable);
                });
            }

            extensionElements.appendChild(root);
            process.appendChild(extensionElements);
            // Lane 및 Activity 매핑
            const laneActivityMapping = {};
            if (jsonModel.activities)
                jsonModel.activities.forEach((activity) => {
                    if (!laneActivityMapping[activity?.role]) {
                        laneActivityMapping[activity?.role] = [];
                    }
                    laneActivityMapping[activity.role].push(activity.id);
                });
            if (jsonModel.gateways)
                jsonModel.gateways.forEach((gateway) => {
                    if (!laneActivityMapping[gateway?.role]) {
                        laneActivityMapping[gateway?.role] = [];
                    }
                    laneActivityMapping[gateway.role].push(gateway.id);
                });

            // Lanes 생성
            if (jsonModel.roles) {
                const laneSet = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:laneSet');
                laneSet.setAttribute('id', 'LaneSet_1');
                process.appendChild(laneSet);
                jsonModel.roles.forEach((role, idx) => {
                    const lane = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:lane');
                    lane.setAttribute('id', 'Lane_' + idx);
                    lane.setAttribute('name', role.name);
                    laneSet.appendChild(lane);
                    // Activity를 Lane에 할당
                    if (laneActivityMapping[role.name]) {
                        laneActivityMapping[role.name].forEach((activityId) => {
                            const flowNodeRef = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:flowNodeRef');
                            flowNodeRef.textContent = activityId;
                            lane.appendChild(flowNodeRef);
                        });
                    }
                });
            }

            let inComing = {};
            let outGoing = {};

            let lastXPos = 140;
            let positionMapping = {};
            // Sequences 생성
            if (jsonModel.sequences)
                jsonModel.sequences.forEach((sequence, idx) => {
                    if (!positionMapping[sequence.source]) {
                        positionMapping[sequence.source] = lastXPos;
                        lastXPos += 120; 
                    }
                    if(idx === jsonModel.sequences.length - 1){
                        positionMapping[sequence.target] = lastXPos += 130
                    }   
                    const sequenceFlow = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:sequenceFlow');
                    sequenceFlow.setAttribute('id', 'SequenceFlow_' + sequence.source + '_' + sequence.target);
                    sequenceFlow.setAttribute('name', sequence.name ? sequence.name : '');
                    sequenceFlow.setAttribute('sourceRef', sequence.source);
                    sequenceFlow.setAttribute('targetRef', sequence.target);
                    let extensionElements = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:extensionElements');
                    let root = xmlDoc.createElementNS('http://uengine', 'uengine:properties');
                    let params = xmlDoc.createElementNS('http://uengine', 'uengine:json');
                    params.setAttribute('key', 'condition');
                    params.textContent = JSON.stringify({
                        condition: sequence.condition ? sequence.condition : ''
                    });
                    // }
                    root.appendChild(params);
                    extensionElements.appendChild(root);
                    sequenceFlow.appendChild(extensionElements);
                    process.appendChild(sequenceFlow);

                    outGoing[sequence.source] = 'SequenceFlow_' + sequence.source + '_' + sequence.target;
                    inComing[sequence.target] = 'SequenceFlow_' + sequence.source + '_' + sequence.target;
                });

            // Activities 생성
            if (jsonModel.activities)
                jsonModel.activities.forEach((activity, idx) => {
                    const userTaskType = me.taskMapping(activity.type);

                    const userTask = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', userTaskType);
                    userTask.setAttribute('id', activity.id);
                    userTask.setAttribute('name', activity.name);
                    // let extensionElements = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:description');
                    if (outGoing[activity.id]) {
                        let outGoingSeq = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:outgoing');
                        outGoingSeq.textContent = outGoing[activity.id];
                        userTask.appendChild(outGoingSeq);
                    }
                    if (inComing[activity.id]) {
                        let inComingSeq = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:incoming');
                        inComingSeq.textContent = inComing[activity.id];
                        userTask.appendChild(inComingSeq);
                    }
                    let extensionElements = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:extensionElements');
                    let root = xmlDoc.createElementNS('http://uengine', 'uengine:properties');
                    let params = xmlDoc.createElementNS('http://uengine', 'uengine:json');
                    params.setAttribute('key', 'condition');
                    // {"argument":{"text":"symptom"}, "variable":{"name": "symptom"}, "direction":
                    //     "OUT"}
                    let inputDataList = [];
                    let outputDataList = [];
                    activity?.inputData?.forEach((data) => {
                        inputDataList.push({
                            argument: { text: data },
                            variable: { name: data },
                            direction: 'OUT'
                        });
                    });
                    activity?.outputData?.forEach((data) => {
                        outputDataList.push({
                            argument: { text: data },
                            variable: { name: data },
                            direction: 'IN'
                        });
                    });

                    let activityData = {
                        role: { name: activity.role },
                        parameters: [...inputDataList, ...outputDataList]
                    };
                    params.textContent = JSON.stringify(activityData);
                    root.appendChild(params);
                    extensionElements.appendChild(root);
                    userTask.appendChild(extensionElements);
                    // let root = xmlDoc.createElementNS('http://uengine', 'uengine:Uengine-params');
                    // let role = xmlDoc.createElementNS('http://uengine', 'uengine:Role');
                    // // role.textContent = activity.role
                    // // root.appendChild(role)
                    // let desc = xmlDoc.createElementNS('http://uengine', 'uengine:Description');
                    // // desc.textContent = activity.description
                    // // root.appendChild(desc)
                    // let checkpoints = xmlDoc.createElementNS('http://uengine', 'uengine:Checkpoint');
                    // if (activity.checkpoints) {
                    //     activity.checkpoints.forEach((checkpoint) => {
                    //         console.log(checkpoint)
                    //         let check = xmlDoc.createElementNS('http://uengine', 'uengine:Checkpoint');
                    //         check.textContent = checkpoint
                    //         checkpoints.appendChild(check)
                    //     })
                    // }
                    // root.appendChild(checkpoints)

                    // // Params
                    // let params = xmlDoc.createElementNS('http://uengine', 'uengine:Parameter');
                    // if (activity.inputData) {
                    //     activity.inputData.forEach((data) => {
                    //         let param = xmlDoc.createElementNS('http://uengine', 'uengine:Parameter');
                    //         param.setAttribute('key', data.name)
                    //         param.setAttribute('category', "input")
                    //         params.appendChild(param)
                    //     })
                    // }
                    // if (activity.outputData) {
                    //     activity.outputData.forEach((data) => {
                    //         let param = xmlDoc.createElementNS('http://uengine', 'uengine:Parameter');
                    //         param.setAttribute('key', data.name)
                    //         param.setAttribute('category', "output")
                    //         params.appendChild(param)
                    //     })
                    // }
                    // root.appendChild(params)
                    // extensionElements.appendChild(root)
                    // userTask.appendChild(extensionElements)

                    if (jsonModel.events) {
                        jsonModel.events.forEach((event, index) => {
                            const bpmnEvent = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:' + event.type);
                            bpmnEvent.setAttribute('id', event.id);
                            bpmnEvent.setAttribute('name', event.name);
                            process.appendChild(bpmnEvent);

                            // if (outGoing[event.id]) {
                            //     let outGoingSeq = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:outgoing');
                            //     outGoingSeq.textContent = outGoing[event.id];
                            //     bpmnEvent.appendChild(outGoingSeq);
                            // }
                            // if (inComing[event.id]) {
                            //     let inComingSeq = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:incoming');
                            //     inComingSeq.textContent = inComing[event.id];
                            //     bpmnEvent.appendChild(inComingSeq);
                            // }
                        });
                    }

                    // if (idx == 0) {
                    //     // 시작일땐 StartEvent와 연결
                    //     const startEvent = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:startEvent');
                    //     startEvent.setAttribute('id', 'StartEvent_1');
                    //     startEvent.setAttribute('name', 'StartEvent');
                    //     process.appendChild(startEvent);

                    //     const sequenceFlow = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:sequenceFlow');
                    //     sequenceFlow.setAttribute('id', 'SequenceFlow_' + 'StartEvent' + '_' + activity.id);
                    //     sequenceFlow.setAttribute('name', '');
                    //     sequenceFlow.setAttribute('sourceRef', 'StartEvent_1');
                    //     sequenceFlow.setAttribute('targetRef', activity.id);
                    //     let extensionElements = xmlDoc.createElementNS(
                    //         'http://www.omg.org/spec/BPMN/20100524/MODEL',
                    //         'bpmn:extensionElements'
                    //     );
                    //     let root = xmlDoc.createElementNS('http://uengine', 'uengine:Uengine-params');
                    //     let conditionParam = xmlDoc.createElementNS('http://uengine', 'uengine:Parameter');
                    //     let conditionParams = xmlDoc.createElementNS('http://uengine', 'uengine:Parameter');
                    //     conditionParam.setAttribute('key', 'condition');
                    //     conditionParam.textContent = '';
                    //     conditionParams.appendChild(conditionParam);
                    //     root.appendChild(conditionParams);
                    //     extensionElements.appendChild(root);
                    //     sequenceFlow.appendChild(extensionElements);
                    //     process.appendChild(sequenceFlow);

                    //     let inComingSeq = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:incoming');
                    //     inComingSeq.textContent = 'SequenceFlow_' + 'StartEvent' + '_' + activity.id;
                    //     userTask.appendChild(inComingSeq);
                    // } else if (idx == jsonModel.activities.length - 1) {
                    //     // 마지막엔 EndEvent와 연결
                    //     // EndEvent 요소 추가
                    //     const endEvent = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:endEvent');
                    //     endEvent.setAttribute('id', 'EndEvent');
                    //     endEvent.setAttribute('name', 'EndEvent');
                    //     process.appendChild(endEvent);

                    //     const sequenceFlow = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:sequenceFlow');
                    //     sequenceFlow.setAttribute('id', 'SequenceFlow_' + activity.id + '_' + 'EndEvent');
                    //     sequenceFlow.setAttribute('name', '');
                    //     sequenceFlow.setAttribute('sourceRef', activity.id);
                    //     sequenceFlow.setAttribute('targetRef', 'EndEvent');
                    //     let extensionElements = xmlDoc.createElementNS(
                    //         'http://www.omg.org/spec/BPMN/20100524/MODEL',
                    //         'bpmn:extensionElements'
                    //     );
                    //     let root = xmlDoc.createElementNS('http://uengine', 'uengine:Uengine-params');
                    //     let conditionParam = xmlDoc.createElementNS('http://uengine', 'uengine:Parameter');
                    //     let conditionParams = xmlDoc.createElementNS('http://uengine', 'uengine:Parameter');
                    //     conditionParam.setAttribute('key', 'condition');
                    //     conditionParam.textContent = '';
                    //     conditionParams.appendChild(conditionParam);
                    //     root.appendChild(conditionParams);
                    //     extensionElements.appendChild(root);
                    //     sequenceFlow.appendChild(extensionElements);
                    //     process.appendChild(sequenceFlow);

                    //     let outGoingSeq = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:outgoing');
                    //     outGoingSeq.textContent = 'SequenceFlow_' + activity.id + '_' + 'EndEvent';
                    //     userTask.appendChild(outGoingSeq);
                    // }
                    process.appendChild(userTask);
                });
                if (jsonModel.gateways) {
                    jsonModel.gateways.forEach((gateway) => {
                        const bpmnGateway = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:' + gateway.type);
                        bpmnGateway.setAttribute('id', gateway.id);
                        bpmnGateway.setAttribute('name', gateway.name);
                        let extensionElements = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:extensionElements');
                        let root = xmlDoc.createElementNS('http://uengine', 'uengine:properties');
                        let params = xmlDoc.createElementNS('http://uengine', 'uengine:json');
                        params.setAttribute('key', 'condition');
                        params.textContent = JSON.stringify({
                            condition: gateway.condition ? gateway.condition : ''
                        });
                        root.appendChild(params);
                        extensionElements.appendChild(root);
                        bpmnGateway.appendChild(extensionElements);

                        if (outGoing[gateway.id]) {
                            let outGoingSeq = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:outgoing');
                            outGoingSeq.textContent = outGoing[gateway.id];
                            bpmnGateway.appendChild(outGoingSeq);
                        }
                        if (inComing[gateway.id]) {
                            let inComingSeq = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:incoming');
                            inComingSeq.textContent = inComing[gateway.id];
                            bpmnGateway.appendChild(inComingSeq);
                        }

                        process.appendChild(bpmnGateway);
                    });
                }

            // BPMN Diagram Draw
            const bpmnDiagram = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/DI', 'bpmndi:BPMNDiagram');
            bpmnDiagram.setAttribute('id', 'BPMNDiagram_1');
            bpmnDefinitions.appendChild(bpmnDiagram);

            const bpmnPlane = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/DI', 'bpmndi:BPMNPlane');
            bpmnPlane.setAttribute('id', 'BPMNPlane_1');
            bpmnPlane.setAttribute('bpmnElement', 'Collaboration_1');
            bpmnDiagram.appendChild(bpmnPlane);
            let participantHeight = jsonModel?.roles.length > 0 ? jsonModel?.roles.length * 100 : 100;
            const participantShape = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/DI', 'bpmndi:BPMNShape');
            participantShape.setAttribute('id', 'Participant_1');
            participantShape.setAttribute('bpmnElement', 'Participant');
            const dcBoundsParticipant = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DC', 'dc:Bounds');
            dcBoundsParticipant.setAttribute('x', '70');
            dcBoundsParticipant.setAttribute('y', `100`);
            // 스윔라인을 감싸고있는 가장 바깥 라인의 길이
            dcBoundsParticipant.setAttribute('width', `${lastXPos + 30}`);
            dcBoundsParticipant.setAttribute('height', participantHeight);
            participantShape.appendChild(dcBoundsParticipant);
            bpmnPlane.appendChild(participantShape);
            // if (jsonModel.roles) {

            // }

            //         <bpmndi:BPMNShape id="Participant_0r9od0v_di" bpmnElement="Participant_0r9od0v" isHorizontal="true">
            //     <dc:Bounds x="156" y="62" width="600" height="250" />
            //   </bpmndi:BPMNShape>
            let rolePos = {};
            let activityPos = {};

            // Lane 및 Activity에 대한 시각적 표현 추가
            if (jsonModel.roles)
                jsonModel.roles.forEach((role, roleIndex) => {
                    const laneShape = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/DI', 'bpmndi:BPMNShape');
                    laneShape.setAttribute('id', `BPMNShape_${roleIndex}`);
                    laneShape.setAttribute('bpmnElement', `Lane_${roleIndex}`);
                    laneShape.setAttribute('isHorizontal', true);
                    const dcBoundsLane = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DC', 'dc:Bounds');
                    dcBoundsLane.setAttribute('x', '100');
                    dcBoundsLane.setAttribute('y', `${100 + roleIndex * 100}`);
                    // 가장 바깥 라인 안쪽의 스윔라인 자체 길이
                    dcBoundsLane.setAttribute('width', `${lastXPos}`);
                    dcBoundsLane.setAttribute('height', '100');
                    laneShape.appendChild(dcBoundsLane);
                    bpmnPlane.appendChild(laneShape);
                    rolePos[role.name] = {
                        x: dcBoundsLane.getAttribute('x'),
                        y: dcBoundsLane.getAttribute('y')
                    };
                });

                if (jsonModel.activities) {
                    jsonModel.activities.forEach((activity, activityIndex) => {
                        if (!activity.role) {
                            return false;
                        }

                        // 기본 activityX 설정
                        let activityX = positionMapping[activity.id] ? positionMapping[activity.id] - 20 : lastXPos + 120;
                        let activityY = parseInt(rolePos[activity.role].y);

                        // 레인을 넘어가는 활동(task)에 대해서만 위치를 더 오른쪽으로 이동
                        if (activityIndex > 0 && jsonModel.activities[activityIndex - 1].role !== activity.role) {
                            activityX = lastXPos + 40; // 원하는 만큼 오른쪽으로 이동
                        }

                        const activityShape = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/DI', 'bpmndi:BPMNShape');
                        activityShape.setAttribute('id', `BPMNShape_${activity.id}`);
                        activityShape.setAttribute('bpmnElement', activity.id);

                        const dcBoundsActivity = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DC', 'dc:Bounds');
                        dcBoundsActivity.setAttribute('x', activityX);
                        dcBoundsActivity.setAttribute('y', activityY + 10);
                        dcBoundsActivity.setAttribute('width', 100);
                        dcBoundsActivity.setAttribute('height', 80);
                        activityPos[activity.id] = {
                            x: activityX,
                            y: activityY + 10,
                            width: 100,
                            height: 80
                        };

                        activityShape.appendChild(dcBoundsActivity);
                        bpmnPlane.appendChild(activityShape);

                        // 활동의 X 좌표를 업데이트
                        rolePos[activity.role].x = activityX + 120;
                        lastXPos = activityX + 120;
                    });
                }
            //gateway 스티커
            if (jsonModel.gateways){
                jsonModel.gateways.forEach((gateway) => {
                    let gatewayX = positionMapping[gateway.id] ? positionMapping[gateway.id] : rolePos[gateway.role].x + 120;
                    let gatewayY = parseInt(rolePos[gateway.role].y);
                    const gatewayShape = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/DI', 'bpmndi:BPMNShape');
                    gatewayShape.setAttribute('id', `Shape_${gateway.id}`);
                    gatewayShape.setAttribute('bpmnElement', gateway.id);
                    const dcBounds = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DC', 'dc:Bounds');
                    dcBounds.setAttribute('x', gatewayX); 
                    dcBounds.setAttribute('y', gatewayY + 25); 
                    dcBounds.setAttribute('width', '50');
                    dcBounds.setAttribute('height', '50');
                    gatewayShape.appendChild(dcBounds);
                    bpmnPlane.appendChild(gatewayShape);

                    activityPos[gateway.id] = {
                        x: gatewayX,
                        y: gatewayY + 25,
                        width: 50,
                        height: 50
                    };
                    rolePos[gateway.role].x += 120;
                });
            }
            // start, end event(동그라미 스티커)
            if (jsonModel.events) {
                jsonModel.events.forEach((event) => {
                    let eventX;
                    let eventY;
                    if (event.type == 'StartEvent') {
                        // 시작 이벤트(동그라미 스티커에 대해서 동그라미 스티커가 생성되는 위치 )
                        eventX = 160;
                        eventY = parseInt(rolePos[jsonModel.activities[0].role].y) + 33;
                    } else if (event.type == 'EndEvent') {
                        eventX = positionMapping[event.id] ? positionMapping[event.id] : lastXPos + 120;
                        eventY = parseInt(rolePos[jsonModel.activities[jsonModel.activities.length - 1].role].y) + 33;
                    } else {
                        eventX = 200;
                        eventY = 200;
                    }
                    const eventShape = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/DI', 'bpmndi:BPMNShape');
                    eventShape.setAttribute('id', `Shape_${event.id}`);
                    eventShape.setAttribute('bpmnElement', event.id);
                    const dcBounds = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DC', 'dc:Bounds');
                    dcBounds.setAttribute('x', eventX);
                    dcBounds.setAttribute('y', eventY);
                    dcBounds.setAttribute('width', '34');
                    dcBounds.setAttribute('height', '34');
                    eventShape.appendChild(dcBounds);

                    // 라벨 추가
                    const eventLabel = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/DI', 'bpmndi:BPMNLabel');
                    const dcBoundsLabel = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DC', 'dc:Bounds');
                    dcBoundsLabel.setAttribute('x', eventX - 15); // 라벨의 x 좌표
                    dcBoundsLabel.setAttribute('y', eventY + 40); // 라벨의 y 좌표, 원하는 값으로 수정
                    dcBoundsLabel.setAttribute('width', '64');
                    dcBoundsLabel.setAttribute('height', '14');
                    eventLabel.appendChild(dcBoundsLabel);
                    eventShape.appendChild(eventLabel);

                    bpmnPlane.appendChild(eventShape);

                    activityPos[event.id] = {
                        x: eventX,
                        y: eventY,
                        width: 34,
                        height: 34
                    };
                });
            }

            if (jsonModel.sequences) {
                jsonModel.sequences.forEach((sequence) => {
                    if (!activityPos[sequence.source] || !activityPos[sequence.target]) {
                        return false;
                    }
                    const bpmnEdge = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/DI', 'bpmndi:BPMNEdge');
                    bpmnEdge.setAttribute('id', `BPMNEdge_${sequence.source}_${sequence.target}`);
                    bpmnEdge.setAttribute('bpmnElement', 'SequenceFlow_' + sequence.source + '_' + sequence.target);

                    let startX, startY, endX, endY;
                    startX = parseInt(activityPos[sequence.source].x) + parseInt(activityPos[sequence.source].width);
                    startY = parseInt(activityPos[sequence.source].y) + parseInt(activityPos[sequence.source].height) / 2;

                    endX = parseInt(activityPos[sequence.target].x);
                    endY = parseInt(activityPos[sequence.target].y) + parseInt(activityPos[sequence.target].height) / 2;

                    // 첫 번째 waypoint (시작점)
                    const waypoint1 = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DI', 'di:waypoint');
                    waypoint1.setAttribute('x', startX);
                    waypoint1.setAttribute('y', startY);
                    bpmnEdge.appendChild(waypoint1);

                    // 시작점과 끝점이 같은 레인에 있는 경우
                    if (startY === endY) {
                        // 두 번째 waypoint (끝점)
                        const waypoint2 = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DI', 'di:waypoint');
                        waypoint2.setAttribute('x', endX);
                        waypoint2.setAttribute('y', endY);
                        bpmnEdge.appendChild(waypoint2);
                    } else {
                        // 시작점과 끝점이 다른 레인에 있는 경우
                        // 첫 번째 변곡점 (레인 변경 시작)
                        const waypointMiddle1 = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DI', 'di:waypoint');
                        waypointMiddle1.setAttribute('x', startX + 25); // X 좌표를 조정하여 레인 변경 시작
                        waypointMiddle1.setAttribute('y', startY);
                        bpmnEdge.appendChild(waypointMiddle1);

                        // 두 번째 변곡점 (레인 변경 완료)
                        const waypointMiddle2 = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DI', 'di:waypoint');
                        waypointMiddle2.setAttribute('x', startX + 25); // X 좌표를 유지
                        waypointMiddle2.setAttribute('y', endY); // Y 좌표를 끝점의 Y로 변경하여 레인 변경 완료
                        bpmnEdge.appendChild(waypointMiddle2);

                        // 세 번째 변곡점 (끝점으로 이동)
                        const waypointMiddle3 = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DI', 'di:waypoint');
                        waypointMiddle3.setAttribute('x', endX); // X 좌표를 끝점의 X로 변경
                        waypointMiddle3.setAttribute('y', endY); // Y 좌표를 유지
                        bpmnEdge.appendChild(waypointMiddle3);

                        // 두 번째 waypoint (끝점)
                        const waypoint2 = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DI', 'di:waypoint');
                        waypoint2.setAttribute('x', endX);
                        waypoint2.setAttribute('y', endY);
                        bpmnEdge.appendChild(waypoint2);
                    }

                    bpmnPlane.appendChild(bpmnEdge);
                });
            }
            
            // XML 문자열로 변환 및 반환
            const serializer = new XMLSerializer();
            const bpmnXml = serializer.serializeToString(xmlDoc);
            return bpmnXml;

            // 기존 코드
            // // XML 문서 초기화
            // const parser = new DOMParser();
            // const xmlDoc = parser.parseFromString(
            //     '<?xml version="1.0" encoding="UTF-8"?><bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"></bpmn:definitions>',
            //     'application/xml'
            // );
            // const bpmn = xmlDoc.documentElement;

            // // XML 네임스페이스 설정
            // bpmn.setAttribute('xmlns:bpmn', 'http://www.omg.org/spec/BPMN/20100524/MODEL');
            // bpmn.setAttribute('xmlns:bpmndi', 'http://www.omg.org/spec/BPMN/20100524/DI');
            // bpmn.setAttribute('xmlns:dc', 'http://www.omg.org/spec/DD/20100524/DC');
            // bpmn.setAttribute('xmlns:di', 'http://www.omg.org/spec/DD/20100524/DI');
            // bpmn.setAttribute('id', 'Definitions_1');
            // bpmn.setAttribute('targetNamespace', 'http://bpmn.io/schema/bpmn');
            // bpmn.setAttribute('exporter', 'Custom BPMN Modeler');
            // bpmn.setAttribute('exporterVersion', '1.0');

            // // 콜라보레이션 및 참가자 요소 생성
            // const collaboration = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:collaboration');
            // collaboration.setAttribute('id', 'Collaboration_1');
            // const participant = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:participant');
            // participant.setAttribute('id', 'Participant_' + jsonProcess.processDefinitionId);
            // participant.setAttribute('name', jsonProcess.processDefinitionName);
            // participant.setAttribute('processRef', 'Process_' + jsonProcess.processDefinitionId);
            // collaboration.appendChild(participant);
            // bpmn.appendChild(collaboration);

            // // Process 요소 생성
            // const process = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:process');
            // process.setAttribute('id', jsonProcess.processDefinitionId); //.replace(/\s+/g, '_'));
            // process.setAttribute('isExecutable', 'true');

            // bpmn.appendChild(process);

            // // 레인셋 생성
            // const laneSet = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:laneSet');
            // laneSet.setAttribute('id', 'LaneSet_' + jsonProcess.processDefinitionId);
            // process.appendChild(laneSet);

            // // 레인 생성 및 역할 할당
            // if (jsonProcess.roles)
            //     jsonProcess.roles.forEach((role) => {
            //         const lane = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:lane');
            //         lane.setAttribute('id', 'Lane_' + role.name.replace(/\s+/g, '_'));
            //         lane.setAttribute('name', role.name);
            //         laneSet.appendChild(lane);

            //         // 해당 역할에 매핑된 활동들을 레인에 할당
            //         if (jsonProcess.activities)
            //             jsonProcess.activities.forEach((activity) => {
            //                 if (activity.role === role.name) {
            //                     const flowNodeRef = xmlDoc.createElementNS(
            //                         'http://www.omg.org/spec/BPMN/20100524/MODEL',
            //                         'bpmn:flowNodeRef'
            //                     );
            //                     flowNodeRef.textContent = activity.id;
            //                     lane.appendChild(flowNodeRef);
            //                 }
            //             });
            //     });

            // // 각 활동 (Activity) 요소 생성
            // if (jsonProcess.activities)
            //     jsonProcess.activities.forEach((activity) => {
            //         const task = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:userTask');
            //         task.setAttribute('id', activity.id);
            //         task.setAttribute('name', activity.name);
            //         process.appendChild(task);
            //     });

            // // 시퀀스 플로우 생성
            // if (jsonProcess.sequences)
            //     jsonProcess.sequences.forEach((sequence) => {
            //         const sequenceFlow = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:sequenceFlow');
            //         sequenceFlow.setAttribute('id', 'SequenceFlow_' + sequence.source + '_' + sequence.target);
            //         sequenceFlow.setAttribute('sourceRef', sequence.source);
            //         sequenceFlow.setAttribute('targetRef', sequence.target);
            //         process.appendChild(sequenceFlow);
            //     });

            // //            bpmn.appendChild(process);

            // // BPMNDiagram 요소 추가
            // const bpmnDiagram = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/DI', 'bpmndi:BPMNDiagram');
            // bpmnDiagram.setAttribute('id', 'BPMNDiagram_' + jsonProcess.processDefinitionId);
            // const bpmnPlane = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/DI', 'bpmndi:BPMNPlane');
            // bpmnPlane.setAttribute('id', 'BPMNPlane_' + jsonProcess.processDefinitionId);
            // bpmnPlane.setAttribute('bpmnElement', collaboration.getAttribute('id'));
            // bpmnDiagram.appendChild(bpmnPlane);

            // // 레인의 시각적 표현 추가
            // if (jsonProcess.roles)
            //     jsonProcess.roles.forEach((role, index) => {
            //         const laneShape = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/DI', 'bpmndi:BPMNShape');
            //         laneShape.setAttribute('id', 'BPMNShape_Lane_' + role.name.replace(/\s+/g, '_'));
            //         laneShape.setAttribute('bpmnElement', 'Lane_' + role.name.replace(/\s+/g, '_'));

            //         const laneBounds = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DC', 'dc:Bounds');
            //         laneBounds.setAttribute('x', 100);
            //         laneBounds.setAttribute('y', 100 + index * 100);
            //         laneBounds.setAttribute('width', 600);
            //         laneBounds.setAttribute('height', 100);

            //         laneShape.appendChild(laneBounds);
            //         bpmnPlane.appendChild(laneShape);
            //     });

            // // 활동 및 시퀀스 플로우의 시각적 표현 추가
            // if (jsonProcess.activities)
            //     jsonProcess.activities.forEach((activity, index) => {
            //         const shape = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/DI', 'bpmndi:BPMNShape');
            //         shape.setAttribute('id', 'BPMNShape_' + activity.id);
            //         shape.setAttribute('bpmnElement', activity.id);

            //         const bounds = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DC', 'dc:Bounds');
            //         bounds.setAttribute('x', 150 + index * 100); // 위치 예제
            //         bounds.setAttribute('y', 120 + index * 60); // 위치 예제
            //         bounds.setAttribute('width', 80);
            //         bounds.setAttribute('height', 60);

            //         shape.appendChild(bounds);
            //         bpmnPlane.appendChild(shape);
            //     });

            // if (jsonProcess.sequences)
            //     jsonProcess.sequences.forEach((sequence) => {
            //         const edge = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/DI', 'bpmndi:BPMNEdge');
            //         edge.setAttribute('id', 'BPMNEdge_' + sequence.source + '_' + sequence.target);
            //         edge.setAttribute('bpmnElement', 'SequenceFlow_' + sequence.source + '_' + sequence.target);

            //         // Waypoint 예제 (실제 좌표는 활동의 위치에 따라 조정되어야 함)
            //         const waypoint1 = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DI', 'di:waypoint');
            //         waypoint1.setAttribute('x', 200); // 예제 좌표
            //         waypoint1.setAttribute('y', 150); // 예제 좌표
            //         edge.appendChild(waypoint1);

            //         const waypoint2 = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DI', 'di:waypoint');
            //         waypoint2.setAttribute('x', 300); // 예제 좌표
            //         waypoint2.setAttribute('y', 150); // 예제 좌표
            //         edge.appendChild(waypoint2);

            //         bpmnPlane.appendChild(edge);
            //     });

            // // // 시각적 요소 생성 (BPMNShape 및 BPMNEdge)
            // // if(jsonProcess.activities)
            // // jsonProcess.activities.forEach((activity, index) => {
            // //     const shape = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/DI', 'bpmndi:BPMNShape');
            // //     shape.setAttribute('id', 'BPMNShape_' + activity.id);
            // //     shape.setAttribute('bpmnElement', activity.id);

            // //     const bounds = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DC', 'dc:Bounds');
            // //     bounds.setAttribute('x', 100 + (index * 150)); // 예제 위치
            // //     bounds.setAttribute('y', 100);
            // //     bounds.setAttribute('width', 100);
            // //     bounds.setAttribute('height', 80);

            // //     shape.appendChild(bounds);
            // //     bpmnPlane.appendChild(shape);
            // // });

            // // // 시퀀스 플로우 시각적 요소
            // // if(jsonProcess.sequences)
            // // jsonProcess.sequences.forEach(sequence => {
            // //     const edge = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/DI', 'bpmndi:BPMNEdge');
            // //     edge.setAttribute('id', 'BPMNEdge_' + sequence.source + '_' + sequence.target);
            // //     edge.setAttribute('bpmnElement', 'SequenceFlow_' + sequence.source + '_' + sequence.target);

            // //     // 예제 waypoint
            // //     const waypoint1 = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DI', 'di:waypoint');
            // //     waypoint1.setAttribute('x', 150);
            // //     waypoint1.setAttribute('y', 140);

            // //     const waypoint2 = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DI', 'di:waypoint');
            // //     waypoint2.setAttribute('x', 250);
            // //     waypoint2.setAttribute('y', 140);

            // //     edge.appendChild(waypoint1);
            // //     edge.appendChild(waypoint2);

            // //     bpmnPlane.appendChild(edge);
            // // });

            // bpmn.appendChild(bpmnDiagram);

            // // XML 문자열로 변환
            // const serializer = new XMLSerializer();
            // const xmlString = serializer.serializeToString(xmlDoc);
            // return xmlString;
        }
    }
};
</script>

<style scoped>
.process-definition-resize {
    width: 100%;
    height: 100%;
}

@media only screen and (max-width: 1279px) {
    .process-definition-resize {
        width: 100%;
        height: calc(100vh - 192px);
    }
}

:deep(.left-part) {
    width: 80%;
    /* Apply specific width */
}

.is-deleted {
    position: relative;
}
.is-deleted::after {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5); /* 회색 오버레이 */
    z-index: 10;
}
</style>
