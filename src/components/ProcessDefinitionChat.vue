<template>
    <v-card elevation="10" style="background-color: rgba(255, 255, 255, 0)">
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
                    <Chat
                        :name="projectName"
                        :messages="messages"
                        :chatInfo="chatInfo"
                        :isChanged="true"
                        :userInfo="userInfo"
                        :type="'definitions'"
                        :lock="lock"
                        :disableChat="disableChat"
                        @sendMessage="beforeSendMessage"
                        @sendEditedMessage="sendEditedMessage"
                        @stopMessage="stopMessage"
                        @getMoreChat="getMoreChat"
                        @loadBPMN="(bpmn) => loadBPMN(bpmn)"
                        @openVerMangerDialog="toggleVerMangerDialog"
                        @toggleLock="toggleLock"
                    ></Chat>
                </div>
            </template>

            <template v-slot:mobileLeftContent>
                <Chat
                    :name="projectName"
                    :messages="messages"
                    :chatInfo="chatInfo"
                    :isChanged="isChanged"
                    :userInfo="userInfo"
                    :type="'definitions'"
                    :lock="lock"
                    :disableChat="disableChat"
                    @sendMessage="beforeSendMessage"
                    @sendEditedMessage="sendEditedMessage"
                    @stopMessage="stopMessage"
                    @getMoreChat="getMoreChat"
                    @loadBPMN="(bpmn) => loadBPMN(bpmn)"
                    @openVerMangerDialog="toggleVerMangerDialog"
                    @toggleLock="toggleLock"
                ></Chat>
            </template>
        </AppBaseCard>
    </v-card>
</template>

<script>
import partialParse from 'partial-json-parser';
import { VectorStorage } from 'vector-storage';

import ProcessDefinition from '@/components/ProcessDefinition.vue';
import ProcessDefinitionVersionDialog from '@/components/ProcessDefinitionVersionDialog.vue';
import ProcessDefinitionVersionManager from '@/components/ProcessDefinitionVersionManager.vue';
import ChatDetail from '@/components/apps/chats/ChatDetail.vue';
import ChatListing from '@/components/apps/chats/ChatListing.vue';
import ChatProfile from '@/components/apps/chats/ChatProfile.vue';
import AppBaseCard from '@/components/shared/AppBaseCard.vue';
import { useBpmnStore } from '@/stores/bpmn';
import axios from 'axios';
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
        loading: false
    }),
    async created() {
        await this.init();
        this.generator = new ChatGenerator(this, {
            isStream: true,
            preferredLanguage: 'Korean'
        });
    },
    watch: {
        $route: {
            deep: true,
            handler(newVal, oldVal) {
                if (newVal.path !== oldVal.path) {
                    if (newVal.params.pathMatch) {
                        this.init();
                    }
                }
            }
        }
    },
    computed: {
        fullPath() {
            const path = this.$route.params.pathMatch.join('/');
            if (path.startsWith('/')) {
                path = fullPath.substring(1);
            }
            return path;
        }
    },
    methods: {
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

                    if (me.processDefinition) {
                        info.definition = me.processDefinition;
                    } else if (!me.processDefinition && xmlObj && xmlObj.xml) {
                        me.processDefinition = me.convertXMLToJSON(xmlObj.xml);
                        info.definition = me.processDefinition;
                    }

                    await me.saveModel(info, xmlObj.xml);
                    me.bpmn = xmlObj.xml;

                    me.disableChat = true;
                    me.isViewMode = true;
                    me.lock = true; // 잠금처리 ( 수정 불가 )
                    me.definitionChangeCount++;

                    // 신규 프로세스 이동.
                    if (!me.$route.params.pathMatch) {
                        me.$router.push(`/definitions/${info.proc_def_id}`);
                    }

                    me.loading = false;
                    me.toggleVersionDialog(false);
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
                    const fullPath = me.$route.params.pathMatch.join('/');
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
                                me.projectName = value.name;
                            }
                            me.checkedLock(lastPath);
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

        convertXMLToJSON(xmlString) {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
            // Lanes (Roles) 추출
            const lanes = xmlDoc.getElementsByTagName('bpmn:lane');
            const laneMap = Array.from(lanes).reduce((acc, lane) => {
                const laneName = lane.getAttribute('name');
                const flowNodeRefs = lane.getElementsByTagName('bpmn:flowNodeRef');
                Array.from(flowNodeRefs).forEach((flowNodeRef) => {
                    const activityId = flowNodeRef.textContent;
                    acc[activityId] = laneName; // Map activity ID to lane (role) name
                });
                return acc;
            }, {});

            // User Tasks 추출
            const userTasks = xmlDoc.getElementsByTagName('bpmn:userTask');
            const activities = Array.from(userTasks).map((task) => {
                const id = task.getAttribute('id');
                return {
                    name: task.getAttribute('name'),
                    id: id,
                    type: 'UserActivity',
                    description: '', // XML에서 제공되지 않음
                    instruction: '', // XML에서 제공되지 않음
                    role: laneMap[id] || '', // LaneMap에서 Role 할당
                    inputData: [], // XML에서 제공되지 않음
                    outputData: [], // XML에서 제공되지 않음
                    checkpoints: [] // XML에서 제공되지 않음
                };
            });

            // Sequence Flows 추출
            const sequenceFlows = xmlDoc.getElementsByTagName('bpmn:sequenceFlow');
            const sequences = Array.from(sequenceFlows)
                .map((flow) => {
                    if (flow.getAttribute('sourceRef') != 'StartEvent_1' && flow.getAttribute('targetRef') != 'EndEvent')
                        return {
                            source: flow.getAttribute('sourceRef'),
                            target: flow.getAttribute('targetRef')
                        };
                })
                .filter((flow) => flow);

            // activities 배열을 sequenceFlow의 순서에 따라 정렬
            // const orderedActivities = [];
            // let currentId = xmlDoc.getElementsByTagName("bpmn:startEvent")[0].getAttribute("id");
            // while (sequences.length > 0) {
            //     const currentIndex = sequences.findIndex(seq => seq.source === currentId);
            //     if (currentIndex === -1) break;

            //     const currentSequence = sequences.splice(currentIndex, 1)[0];
            //     const activityIndex = activities.findIndex(act => act.id === currentSequence.target);
            //     if (activityIndex !== -1) {
            //         orderedActivities.push(activities[activityIndex]);
            //     }
            //     currentId = currentSequence.target;
            // }
            let orderedActivities = this.orderActivitiesBySequence(activities, sequences);

            return { activities: orderedActivities, sequences };
        },
        orderActivitiesBySequence(activities, sequences) {
            // 시작 활동 찾기: 'source'가 되지만 'target'이 되지 않는 항목
            let currentId = sequences.find((seq) => !sequences.some((innerSeq) => innerSeq.target === seq.source))?.source;
            let startActivity = activities.findIndex((act) => act.id === currentId);
            const orderedActivities = [activities[startActivity]];
            const visitedSequences = new Set(); // 중복 방문 방지
            // orderedActivities.push(ac)
            while (currentId && sequences.length > visitedSequences.size) {
                const sequence = sequences.find((seq) => seq.source === currentId && !visitedSequences.has(seq.source + seq.target));
                if (!sequence) break; // 다음 시퀀스를 찾을 수 없으면 중단

                visitedSequences.add(sequence.source + sequence.target); // 시퀀스 방문 기록
                const activityIndex = activities.findIndex((act) => act.id === sequence.target);
                if (activityIndex !== -1) {
                    orderedActivities.push(activities[activityIndex]);
                }
                currentId = sequence.target; // 다음 대상으로 이동
            }

            return orderedActivities;
        },
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
                    if (!me.processDefinition && xml) {
                        me.processDefinition = me.convertXMLToJSON(xml);
                    }

                    me.processDefinition.processDefinitionId = info.proc_def_id
                        ? info.proc_def_id
                        : prompt('please give a ID for the process definition');
                    // Version 저장시 제외.
                    me.processDefinition.processDefinitionName = info.name
                        ? info.name
                        : prompt('please give a name for the process definition');

                    me.projectName = me.processDefinition.processDefinitionName;
                    if (!me.processDefinition.processDefinitionId || !me.processDefinition.processDefinitionName) {
                        throw new Error('processDefinitionId or processDefinitionName is missing');
                    }
                    await backend.putRawDefinition(xml, info.proc_def_id, info);
                    await this.saveToVectorStore(me.processDefinition);
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
            // Sequences 생성
            if (jsonModel.sequences)
                jsonModel.sequences.forEach((sequence) => {
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
                            argument: { text: data.name },
                            variable: { name: data.name },
                            direction: 'OUT'
                        });
                    });
                    activity?.outputData?.forEach((data) => {
                        outputDataList.push({
                            argument: { text: data.name },
                            variable: { name: data.name },
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

                    if (idx == 0) {
                        // 시작일땐 StartEvent와 연결
                        const startEvent = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:startEvent');
                        startEvent.setAttribute('id', 'StartEvent_1');
                        startEvent.setAttribute('name', 'StartEvent');
                        process.appendChild(startEvent);

                        const sequenceFlow = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:sequenceFlow');
                        sequenceFlow.setAttribute('id', 'SequenceFlow_' + 'StartEvent' + '_' + activity.id);
                        sequenceFlow.setAttribute('name', '');
                        sequenceFlow.setAttribute('sourceRef', 'StartEvent_1');
                        sequenceFlow.setAttribute('targetRef', activity.id);
                        let extensionElements = xmlDoc.createElementNS(
                            'http://www.omg.org/spec/BPMN/20100524/MODEL',
                            'bpmn:extensionElements'
                        );
                        let root = xmlDoc.createElementNS('http://uengine', 'uengine:Uengine-params');
                        let conditionParam = xmlDoc.createElementNS('http://uengine', 'uengine:Parameter');
                        let conditionParams = xmlDoc.createElementNS('http://uengine', 'uengine:Parameter');
                        conditionParam.setAttribute('key', 'condition');
                        conditionParam.textContent = '';
                        conditionParams.appendChild(conditionParam);
                        root.appendChild(conditionParams);
                        extensionElements.appendChild(root);
                        sequenceFlow.appendChild(extensionElements);
                        process.appendChild(sequenceFlow);

                        let inComingSeq = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:incoming');
                        inComingSeq.textContent = 'SequenceFlow_' + 'StartEvent' + '_' + activity.id;
                        userTask.appendChild(inComingSeq);
                    } else if (idx == jsonModel.activities.length - 1) {
                        // 마지막엔 EndEvent와 연결
                        // EndEvent 요소 추가
                        const endEvent = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:endEvent');
                        endEvent.setAttribute('id', 'EndEvent');
                        endEvent.setAttribute('name', 'EndEvent');
                        process.appendChild(endEvent);

                        const sequenceFlow = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:sequenceFlow');
                        sequenceFlow.setAttribute('id', 'SequenceFlow_' + activity.id + '_' + 'EndEvent');
                        sequenceFlow.setAttribute('name', '');
                        sequenceFlow.setAttribute('sourceRef', activity.id);
                        sequenceFlow.setAttribute('targetRef', 'EndEvent');
                        let extensionElements = xmlDoc.createElementNS(
                            'http://www.omg.org/spec/BPMN/20100524/MODEL',
                            'bpmn:extensionElements'
                        );
                        let root = xmlDoc.createElementNS('http://uengine', 'uengine:Uengine-params');
                        let conditionParam = xmlDoc.createElementNS('http://uengine', 'uengine:Parameter');
                        let conditionParams = xmlDoc.createElementNS('http://uengine', 'uengine:Parameter');
                        conditionParam.setAttribute('key', 'condition');
                        conditionParam.textContent = '';
                        conditionParams.appendChild(conditionParam);
                        root.appendChild(conditionParams);
                        extensionElements.appendChild(root);
                        sequenceFlow.appendChild(extensionElements);
                        process.appendChild(sequenceFlow);

                        let outGoingSeq = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:outgoing');
                        outGoingSeq.textContent = 'SequenceFlow_' + activity.id + '_' + 'EndEvent';
                        userTask.appendChild(outGoingSeq);
                    }
                    process.appendChild(userTask);
                });

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
            dcBoundsParticipant.setAttribute('width', '830');
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
                    dcBoundsLane.setAttribute('width', '800');
                    dcBoundsLane.setAttribute('height', '100');
                    laneShape.appendChild(dcBoundsLane);
                    bpmnPlane.appendChild(laneShape);
                    rolePos[role.name] = {
                        x: dcBoundsLane.getAttribute('x'),
                        y: dcBoundsLane.getAttribute('y')
                    };
                });
            let lastXPos = 140;

            if (jsonModel.activities) {
                const firstActivity = jsonModel.activities[0];
                const lastActivity = jsonModel.activities[jsonModel.activities.length - 1];
                jsonModel.activities.forEach((activity, activityIndex) => {
                    if (!activity.role) {
                        return false;
                    }
                    if (activityIndex == 0 && firstActivity.role) {
                        // StartEvent의 BPMNShape 추가
                        let eventY = parseInt(rolePos[firstActivity.role].y) + 32;
                        const startEventShape = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/DI', 'bpmndi:BPMNShape');
                        startEventShape.setAttribute('id', `StartEvent_di`);
                        startEventShape.setAttribute('bpmnElement', `StartEvent_1`);
                        const startEventBounds = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DC', 'dc:Bounds');
                        startEventBounds.setAttribute('x', lastXPos);
                        startEventBounds.setAttribute('y', eventY);
                        startEventBounds.setAttribute('width', 36);
                        startEventBounds.setAttribute('height', 36);
                        startEventShape.appendChild(startEventBounds);
                        bpmnPlane.appendChild(startEventShape);
                        activityPos['startEvent'] = {
                            x: lastXPos,
                            y: eventY,
                            width: 36,
                            height: 36
                        };
                        lastXPos = lastXPos;
                        lastXPos += 120;
                    }
                    let activityY = parseInt(rolePos[activity.role].y);
                    const activityShape = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/DI', 'bpmndi:BPMNShape');
                    activityShape.setAttribute('id', `BPMNShape_${activity.id}`);
                    activityShape.setAttribute('bpmnElement', activity.id);

                    const dcBoundsActivity = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DC', 'dc:Bounds');
                    dcBoundsActivity.setAttribute('x', lastXPos);
                    dcBoundsActivity.setAttribute('y', activityY + 10);
                    dcBoundsActivity.setAttribute('width', 100);
                    dcBoundsActivity.setAttribute('height', 80);
                    activityPos[activity.id] = {
                        x: lastXPos,
                        y: activityY + 10,
                        width: 100,
                        height: 80
                    };
                    // if (!activity.pos)
                    //     activity.pos = {}
                    // activity.pos.x = lastXPos
                    // activity.pos.y =  activityY + 20
                    // activity.pos.width = 80
                    // activity.pos.height = 60

                    activityShape.appendChild(dcBoundsActivity);
                    bpmnPlane.appendChild(activityShape);
                    lastXPos = lastXPos;
                    lastXPos += 120;

                    if (activityIndex == jsonModel.activities.length - 1 && lastActivity.role) {
                        // EndEvent의 BPMNShape 추가
                        let eventY = parseInt(rolePos[lastActivity.role].y) + 32;
                        const endEventShape = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/DI', 'bpmndi:BPMNShape');
                        endEventShape.setAttribute('id', `EndEvent_di`);
                        endEventShape.setAttribute('bpmnElement', `EndEvent`);
                        const endEventBounds = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DC', 'dc:Bounds');
                        // endEventBounds.setAttribute('x', '100'); // 위치는 예시이며, 실제 모델에 따라 조정 필요
                        // endEventBounds.setAttribute('y', '218');
                        endEventBounds.setAttribute('x', lastXPos);
                        endEventBounds.setAttribute('y', eventY);
                        endEventBounds.setAttribute('width', 36);
                        endEventBounds.setAttribute('height', 36);
                        endEventShape.appendChild(endEventBounds);
                        bpmnPlane.appendChild(endEventShape);

                        // 마지막엔 Event들 Sequence 생성
                        // Start Event
                        const startBpmnEdge = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/DI', 'bpmndi:BPMNEdge');
                        startBpmnEdge.setAttribute('id', `BPMNEdge_StartEvent_${firstActivity.id}`);
                        startBpmnEdge.setAttribute('bpmnElement', 'SequenceFlow_' + 'StartEvent' + '_' + firstActivity.id);
                        const startWaypoint1 = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DI', 'di:waypoint');
                        // let startX, startY, endX, endY;

                        startWaypoint1.setAttribute(
                            'x',
                            parseInt(activityPos['startEvent']?.x) + parseInt(activityPos['startEvent']?.width)
                        );
                        startWaypoint1.setAttribute(
                            'y',
                            parseInt(activityPos['startEvent']?.y) + parseInt(activityPos['startEvent']?.height) / 2
                        );
                        startBpmnEdge.appendChild(startWaypoint1);
                        const startWaypoint2 = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DI', 'di:waypoint');

                        startWaypoint2.setAttribute('x', parseInt(activityPos[firstActivity.id]?.x));
                        startWaypoint2.setAttribute(
                            'y',
                            parseInt(activityPos[firstActivity.id]?.y) + parseInt(activityPos[firstActivity.id]?.height) / 2
                        );
                        startBpmnEdge.appendChild(startWaypoint2);

                        const endBpmnEdge = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/DI', 'bpmndi:BPMNEdge');
                        endBpmnEdge.setAttribute('id', `BPMNEdge_${lastActivity.id}_EndEvent`);
                        endBpmnEdge.setAttribute('bpmnElement', 'SequenceFlow_' + lastActivity.id + '_' + 'EndEvent');
                        const endWaypoint1 = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DI', 'di:waypoint');
                        // startX =
                        // startY =
                        endWaypoint1.setAttribute(
                            'x',
                            parseInt(activityPos[lastActivity.id]?.x) + parseInt(activityPos[lastActivity.id]?.width)
                        );
                        endWaypoint1.setAttribute(
                            'y',
                            parseInt(activityPos[lastActivity.id]?.y) + parseInt(activityPos[lastActivity.id]?.height) / 2
                        );
                        endBpmnEdge.appendChild(endWaypoint1);
                        const endWaypoint2 = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DI', 'di:waypoint');
                        // endX = parseInt(activityPos['endEvent'].x)
                        // endY = parseInt(activityPos[sequence.target].y) + (parseInt(activityPos[sequence.target].height) / 2)
                        endWaypoint2.setAttribute('x', lastXPos);
                        endWaypoint2.setAttribute('y', eventY + 18);
                        endBpmnEdge.appendChild(endWaypoint2);
                        bpmnPlane.appendChild(startBpmnEdge);
                        bpmnPlane.appendChild(endBpmnEdge);
                    }
                });
            }

            if (jsonModel.sequences)
                jsonModel.sequences.forEach((sequence) => {
                    if (!activityPos[sequence.source] || !activityPos[sequence.target]) {
                        return false;
                    }
                    const bpmnEdge = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/DI', 'bpmndi:BPMNEdge');
                    bpmnEdge.setAttribute('id', `BPMNEdge_${sequence.source}_${sequence.target}`);
                    bpmnEdge.setAttribute('bpmnElement', 'SequenceFlow_' + sequence.source + '_' + sequence.target);

                    // 예시로, 시작점과 끝점만 정의합니다. 실제 좌표는 모델에 따라 달라집니다.
                    const waypoint1 = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DI', 'di:waypoint');
                    // activity
                    let startX, startY, endX, endY;
                    startX = parseInt(activityPos[sequence.source].x) + parseInt(activityPos[sequence.source].width);
                    startY = parseInt(activityPos[sequence.source].y) + parseInt(activityPos[sequence.source].height) / 2;
                    waypoint1.setAttribute('x', startX);
                    waypoint1.setAttribute('y', startY);
                    bpmnEdge.appendChild(waypoint1);

                    const waypoint2 = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DI', 'di:waypoint');
                    endX = parseInt(activityPos[sequence.target].x);
                    endY = parseInt(activityPos[sequence.target].y) + parseInt(activityPos[sequence.target].height) / 2;
                    waypoint2.setAttribute('x', endX);
                    waypoint2.setAttribute('y', endY);
                    bpmnEdge.appendChild(waypoint2);

                    bpmnPlane.appendChild(bpmnEdge);
                });
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
</style>
