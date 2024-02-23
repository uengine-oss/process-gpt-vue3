<template>
    <AppBaseCard>
        <!-- Process Designer Dialog -->
        <template v-slot:leftpart>
            <div class="no-scrollbar">
                <ProcessInstanceList></ProcessInstanceList>
            </div>
        </template>
        <template v-slot:rightpart>
            <v-dialog v-model="isViewProcess" max-width="1000">
                <v-card>
                    <v-card-text style="height: 1000px; width: 1000px">
                        <process-definition 
                            v-if="onLoad"    
                            style="width: 100%; height: 100%" 
                            :bpmn="bpmn" 
                            :processDefinition="processDefinition"
                            :isViewMode="true"
                            :currentActivities="currentActivities"
                        ></process-definition>
                        <div v-else style="height: 100%; text-align: center">
                            <v-progress-circular style="top: 50%" indeterminate color="primary"></v-progress-circular>
                        </div>
                    </v-card-text>
                    <v-card-actions>
                        <v-btn color="secondary"
                            class="px-4 rounded-pill mx-auto" 
                            @click="isViewProcess = false" 
                            variant="tonal"
                        >Close Dialog</v-btn>
                    </v-card-actions>
                </v-card>
            </v-dialog>
            
            <v-dialog v-model="definitionDialog" max-width="800">
                <v-card>
                    <v-card-title class="text-h5">
                        프로세스 정의 목록
                    </v-card-title>
                    <v-card-text>
                        <v-data-table
                            v-model="processDefinition"
                            :headers="headers"
                            :items="definitions"
                            item-value="id"
                            select-strategy="single"
                            show-select
                            return-object
                        ></v-data-table>
                    </v-card-text>
                    <v-card-actions>
                        <v-btn color="success" 
                            class="px-4 rounded-pill mx-auto"
                            variant="tonal"
                            @click="beforeSendMessage()"
                        >Select</v-btn>
                    </v-card-actions>
                </v-card>
            </v-dialog>

            <Chat :messages="messages"
                :chatInfo="chatInfo"
                :userInfo="userInfo" 
                :disableChat="disableChat"
                :type="'instances'"
                @sendMessage="beforeSendMessage"
                @sendEditedMessage="beforeSendEditedMessage"
                @stopMessage="stopMessage"
                @viewProcess="viewProcess"
            ></Chat>
        </template>

        <template v-slot:mobileLeftContent>
            <ProcessInstanceList></ProcessInstanceList>
        </template>
    </AppBaseCard>
</template>

<script>
import partialParse from 'partial-json-parser';
import { VectorStorage } from 'vector-storage';

import ChatGenerator from './ai/ProcessInstanceGenerator.js';
import ChatModule from '@/components/ChatModule.vue';

import AppBaseCard from '@/components/shared/AppBaseCard.vue';

import Chat from "@/components/ui/Chat.vue";
import ProcessInstanceList from '@/components/ui/ProcessInstanceList.vue';
import ProcessDefinition from '@/components/ProcessDefinition.vue';
import { VDataTable } from 'vuetify/labs/VDataTable'


export default {
    mixins: [ChatModule],
    components: {
        AppBaseCard,
        Chat,
        ProcessInstanceList,
        ProcessDefinition,
        VDataTable
    },
    data: () => ({
        headers: [
            { title: 'id', align: 'start', key: 'processDefinitionId' },
            { title: 'name', align: 'start', key: 'processDefinitionName' },
            { title: 'description', align: 'start', key: 'description' },
        ],
        definitions: null,
        definitionDialog: false,
        processDefinition: [],
        processInstance: null,
        path: 'proc_inst',
        organizationChart: [],
        chatInfo: {
            title: 'processExecution.cardTitle',
            text: "processExecution.processDefinitionExplanation"
        },
        // bpmn
        isViewProcess: false,
        onLoad: false,
        bpmn: null,
        currentActivities: null,
    }),
    async created() {
        await this.init();
        this.generator = new ChatGenerator(this, {
            isStream: true,
            preferredLanguage: 'Korean'
        });
        if(localStorage.getItem('instancePrompt')){
            let prompt = JSON.parse(localStorage.getItem('instancePrompt'))
            this.beforeSendMessage(prompt.content)
            localStorage.removeItem('instancePrompt')
        }
    },
    watch: {
        "$route": {
            deep: true,
            async handler(newVal, oldVal) {
                if (newVal.query !== oldVal.query) {
                    this.messages = [];
                    await this.init();
                }
            }
        },
    },
    methods: {
        async viewProcess() {
            this.onLoad = false;
            let id = "";
            let def_id = "";

            if (this.$route.query.id || (this.processInstance && this.processInstance.proc_inst_id)) {
                this.isViewProcess = !this.isViewProcess;

                if (this.processInstance && this.processInstance.proc_inst_id) {
                    id = this.processInstance.proc_inst_id;
                    this.currentActivities = this.processInstance.current_activity_ids;
                    def_id = id.split('.')[0];
                
                } else if (this.$route.query.id) {
                    id = this.$route.query.id;
                    def_id = id.split('.')[0];
                    const proc_inst = await this.getData(`${def_id}/${id}`, {key: "proc_inst_id"});
                    if (proc_inst) {
                        this.currentActivities = proc_inst.current_activity_ids;
                    }
                }

                var defInfo = await this.getData(`proc_def/${def_id}`, {key: "id"});
                if (defInfo) {
                    let definition = defInfo.definition;
                    this.bpmn = this.createBpmnXml(definition);
                    this.onLoad = true;
                }
            } else {
                alert("실행 중인 프로세스 인스턴스를 선택하세요.");
                return;
            }
        },
        async loadData(path) {
            let value;
            this.processInstance = null;

            if (this.$route.query.id) {
                const id = this.$route.query.id;
                this.loadMessages(`${this.path}/${id}`, {key: "id"});

                var def_id = id.split('.')[0];
                value = await this.getData(`${def_id}/${id}`, {key: "proc_inst_id"});
                if (value) {
                    this.processInstance = value;
                }
            }
            
            value = await this.getData("organization");
            
            if (value && value.organizationChart) {
                this.organizationChart = JSON.parse(value.organizationChart);
                
                if (!this.organizationChart) {
                    this.organizationChart = [];
                }
            }
        },
        checkDisableChat(value) {
            if (value.status && value.status == 'Completed') {
                this.disableChat = true;
            }

            if (value.nextUserId && value.nextUserId !== this.userInfo.email) {
                this.disableChat = true;
            }
        },
        async beforeSendMessage(newMessage) {
            if (newMessage && newMessage.text != '') {
                if (this.processInstance && this.processInstance.proc_inst_id) {
                    this.generator.beforeGenerate(newMessage, false);

                    this.sendMessage(newMessage);
                } else {
                    this.processDefinition = [];
                    this.generator.beforeGenerate(newMessage, true);

                    var procDefs = await this.queryFromVectorDB(newMessage.text);
                    procDefs = procDefs.map(item => JSON.parse(item));
                    this.definitions = procDefs;
                    this.definitionDialog = true;
                }
            } else {
                if (this.processInstance && this.processInstance.proc_inst_id) {
                    this.generator.beforeGenerate(newMessage, false);
                } else {
                    this.generator.beforeGenerate(newMessage, true);
                }

                this.definitionDialog = false;
                var msgObj = {
                    text: this.generator.input.answer,
                    image: this.generator.input.image
                }
                this.sendMessage(msgObj);
            }
        },
        beforeSendEditedMessage(index) {
            if (index > 0) {
                this.generator.beforeGenerate(this.messages[index-1].content, false);
                this.sendEditedMessage(index);
            }
        },
        async saveMessages(messages) {
            if (this.processInstance) {
                var instObj = await this.getData(`${this.path}/${this.processInstance.proc_inst_id}`, {key: 'id'});
                instObj.messages = messages;
                await this.putObject(this.path, instObj);
            }
        },
        afterModelCreated(response) {
        },
        async afterGenerationFinished(response) {
            let messageWriting = this.messages[this.messages.length - 1];
            messageWriting.jsonContent = response;
            
            const jsonData = JSON.parse(response);
            if (jsonData) {
                if (jsonData.description) {
                    messageWriting.content = jsonData.description;
                }

                this.saveInstance(jsonData);
                // this.saveTodolist(jsonData);

                if (!this.$route.query.id) {
                    this.$router.replace(`chat?id=${jsonData.instanceId}`);
                }
            }
        },
        afterModelStopped(response) {
            let path = '';

            if (this.$route.query.id) {
                path = this.$route.query.id;
            } else if (this.processInstance && this.processInstance.processInstanceId) {
                path = this.processInstance.processInstanceId;
            }
            
            if (path != '') {
                let putObj = {
                    messages: this.messages
                };
                this.putObject(`${this.path}/${path}`, putObj, {key: 'id'});
            }
        },
        async saveInstance(data) {
            if (data) {
                var user_ids = [];
                if (data.nextActivities && data.nextActivities.length > 0) {
                    var nextUsers = data.nextActivities.map(item => item.nextUserEmail);
                    if (nextUsers) user_ids = nextUsers;
                }

                if (!user_ids.includes(this.userInfo.email))
                    user_ids.push(this.userInfo.email)

                if (this.processInstance) {
                    var instObj = await this.getData(`${this.path}/${data.instanceId}`, {key: 'id'});
                    instObj.user_ids = [...instObj.user_ids, ...user_ids];
                    instObj.messages = this.messages;
                    await this.putObject(this.path, instObj);
                } else {
                    let putObj = {
                        id: data.instanceId,
                        user_ids: user_ids,
                        messages: this.messages
                    }
                    await this.putObject(this.path, putObj);
                    // this.checkDisableChat(putObj);
                }
            }
        },
        async saveTodolist(data) {
            if (data) {
                let putObj = {
                    proc_inst_id: data.instanceId,
                    proc_def_id: data.processDefinitionId,
                    activity_ids: data.nextActivities,
                    user_id: this.userInfo.email,
                    start_date: Date.now(),
                    end_date: null,
                    status: 'pending',
                }
                if (data.nextActivities.length < 1) {
                    putObj.status = 'done';
                }
                await this.putObject('todolist', putObj);
            }

            // if (this.processInstance) {
            //     const checkedNextAct = await this.checkNextActivity(this.processInstance.currentActivityId, this.processInstance.nextActivityId);
            //     if (this.processInstance.currentUserEmail !== "") {
            //         const path = `todolist/${this.processInstance.currentUserEmail}`;
            //         const pushObj = {
            //             definitionId: this.processInstance.processDefinitionId,
            //             definitionName: this.processInstance.processDefinitionName,
            //             instanceId: this.processInstance.processInstanceId,
            //             instanceName: this.processInstance.processInstanceName,
            //             activityId: this.processInstance.currentActivityId,
            //             activityName: this.processInstance.currentActivityName,
            //             userId: this.processInstance.currentUserEmail,
            //             endDate: Date.now(),
            //         };

            //         if (checkedNextAct) {
            //             pushObj.status = 'done';
            //         } else {
            //             pushObj.status = 'pending';
            //         }

            //         const workItem = await this.checkTodolist(path, pushObj);
            //         if (workItem) {
            //             pushObj.startDate = workItem.startDate;
            //             await this.delete(`${path}/${workItem.key}`);
            //         } else {
            //             pushObj.startDate = Date.now();
            //         }
                    
            //         await this.pushObject(path, pushObj);
            //         await this.saveUserInstance(pushObj);
            //     }

            //     if (this.processInstance.nextUserEmail !== '' && this.checkUserEmail(this.processInstance.nextUserEmail)) {
            //         const path = `todolist/${this.processInstance.nextUserEmail}`;
            //         const pushObj = {
            //             definitionId: this.processInstance.processDefinitionId,
            //             definitionName: this.processInstance.processDefinitionName,
            //             instanceId: this.processInstance.processInstanceId,
            //             instanceName: this.processInstance.processInstanceName,
            //             activityId: this.processInstance.nextActivityId,
            //             activityName: this.processInstance.nextActivityName,
            //             activityName: this.processInstance.nextActivityName,
            //             userId: this.processInstance.nextUserEmail,
            //             startDate: Date.now(),
            //         };

            //         if (checkedNextAct) {
            //             pushObj.status = 'in_progress';
            //         } else {
            //             pushObj.status = 'todo';
            //         }

            //         if (this.processInstance.nextActivityId == "end_process") {
            //             pushObj.activityId = "";
            //             pushObj.activityName = "";
            //         }

            //         const workItem = await this.checkTodolist(path, pushObj);
            //         if (workItem) {
            //             await this.delete(`${path}/${workItem.key}`);
            //         }

            //         await this.pushObject(path, pushObj);
            //         await this.saveUserInstance(pushObj);
            //         await this.beforeSendNotification(pushObj);

            //     } else {
            //         let actIdx = -1;
            //         if (this.processDefinition && this.processDefinition.activities) {
            //             actIdx = this.processDefinition.activities.findIndex(activity => 
            //                 activity.id == this.processInstance.nextActivityId
            //             );
            //         }
            //         if (actIdx > -1) {
            //             alert("다음 담당자가 조직도상에 없습니다. 담당자를 다시 지정해주시거나 담당자를 등록해주세요");
            //         } else {
            //             this.saveInstance('Completed');
            //         }
            //     }
            // }
        },

        async saveDefinitionToVectorDB() {
            let definitions = await this.getData("proc_def");
            if (definitions) {
                const apiToken = this.generator.getToken();
                const vectorStore = new VectorStorage({ openAIApiKey: apiToken });

                let list = Object.values(definitions);
                list.forEach(async (item) => {
                    if (item.definition) {
                        await vectorStore.addText(JSON.stringify(item.definition), {
                            category: item.definition.processDefinitionId
                        });
                    }
                })
            }
        },

        async queryFromVectorDB(messsage){
            const apiToken = this.generator.getToken();
            const vectorStore = new VectorStorage({ openAIApiKey: apiToken });

            // Perform a similarity search
            const results = await vectorStore.similaritySearch({
                query: messsage
            });

            if (results.similarItems.length > 0) {
                return results.similarItems.map(item => item.text);
            } else {
                this.saveDefinitionToVectorDB();
                this.queryFromVectorDB(messsage);
            }
        },


        // bpmn
        createBpmnXml(jsonModel) {
            // XML 문서 초기화
            let me = this;
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString('<?xml version="1.0" encoding="UTF-8"?><bpmn2:definitions xmlns:bpmn2="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" xmlns:uengine="http://uengine"></bpmn2:definitions>', 'application/xml');
            const bpmnDefinitions = xmlDoc.documentElement;

            bpmnDefinitions.setAttribute('id', 'Definitions_' + jsonModel.processDefinitionId);
            bpmnDefinitions.setAttribute('targetNamespace', 'http://bpmn.io/schema/bpmn');
            bpmnDefinitions.setAttribute('exporter', 'Custom BPMN Modeler');
            bpmnDefinitions.setAttribute('exporterVersion', '1.0');

            const collaboration = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn2:collaboration');
            collaboration.setAttribute('id', 'Collaboration_1');
            bpmnDefinitions.appendChild(collaboration);

            const process = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn2:process');
            process.setAttribute('id', jsonModel.processDefinitionId);
            process.setAttribute('isExecutable', 'true');
            bpmnDefinitions.appendChild(process);
            // Collaboration 추가
            const participant = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn2:participant');
            participant.setAttribute('id', `Participant`);
            participant.setAttribute('name', `Participant`);
            participant.setAttribute('processRef', jsonModel.processDefinitionId);
            collaboration.appendChild(participant);

            const laneSet = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn2:laneSet');
            laneSet.setAttribute('id', 'LaneSet_1');
            process.appendChild(laneSet);

            // Lane 및 Activity 매핑
            const laneActivityMapping = {};
            if (jsonModel.activities)
                jsonModel.activities.forEach(activity => {
                    if (!laneActivityMapping[activity.role]) {
                        laneActivityMapping[activity.role] = [];
                    }
                    laneActivityMapping[activity.role].push(activity.id);
                });

            // Lanes 생성
            if (jsonModel.roles)
                jsonModel.roles.forEach((role, idx) => {
                    const lane = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn2:lane');
                    lane.setAttribute('id', 'Lane_' + idx);
                    lane.setAttribute('name', role.name);
                    laneSet.appendChild(lane);
                    // Activity를 Lane에 할당
                    if (laneActivityMapping[role.name]) {
                        laneActivityMapping[role.name].forEach(activityId => {
                            const flowNodeRef = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn2:flowNodeRef');
                            flowNodeRef.textContent = activityId;
                            lane.appendChild(flowNodeRef);
                        });
                    }
                });
            let inComing = {}
            let outGoing = {}
            // Sequences 생성
            if (jsonModel.sequences)
                jsonModel.sequences.forEach(sequence => {
                    const sequenceFlow = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn2:sequenceFlow');
                    sequenceFlow.setAttribute('id', 'SequenceFlow_' + sequence.source + '_' + sequence.target);
                    sequenceFlow.setAttribute('sourceRef', sequence.source);
                    sequenceFlow.setAttribute('targetRef', sequence.target);
                    let extensionElements = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn2:extensionElements');
                    let root = xmlDoc.createElementNS('http://uengine', 'uengine:uengine-params');
                    extensionElements.setAttribute('description', sequence.description ? sequence.description : "")
                    let params = xmlDoc.createElementNS('http://uengine', 'uengine:parameters');
                    // if (sequence.condition) {
                    let param = xmlDoc.createElementNS('http://uengine', 'uengine:parameter');
                    param.setAttribute('key', "condition")
                    param.textContent = "asdf > 0"
                    params.appendChild(param)
                    // }
                    root.appendChild(params)
                    extensionElements.appendChild(root)
                    sequenceFlow.appendChild(extensionElements)
                    process.appendChild(sequenceFlow);

                    outGoing[sequence.source] = 'SequenceFlow_' + sequence.source + '_' + sequence.target
                    inComing[sequence.target] = 'SequenceFlow_' + sequence.source + '_' + sequence.target
                });

            // Activities 생성
            if (jsonModel.activities)
                jsonModel.activities.forEach((activity, idx) => {

                    const userTaskType = me.taskMapping(activity)

                    const userTask = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', userTaskType);
                    userTask.setAttribute('id', activity.id);
                    userTask.setAttribute('name', activity.name);
                    // let extensionElements = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn2:description');
                    if (outGoing[activity.id]) {
                        let outGoingSeq = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn2:outgoing');
                        outGoingSeq.textContent = outGoing[activity.id]
                        userTask.appendChild(outGoingSeq)
                    }
                    if (inComing[activity.id]) {
                        let inComingSeq = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn2:incoming');
                        inComingSeq.textContent = inComing[activity.id]
                        userTask.appendChild(inComingSeq)
                    }
                    let extensionElements = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn2:extensionElements');
                    let root = xmlDoc.createElementNS('http://uengine', 'uengine:uengine-params');
                    root.setAttribute('role', activity.role)
                    root.setAttribute('description', activity.description)
                    let params = xmlDoc.createElementNS('http://uengine', 'uengine:parameters');
                    if (activity.inputData) {
                        activity.inputData.forEach((data) => {
                            let param = xmlDoc.createElementNS('http://uengine', 'uengine:parameter');
                            param.setAttribute('key', data.name)
                            param.setAttribute('category', "input")
                            params.appendChild(param)
                        })

                        // userTask.appendChild(extensionElements)
                    }
                    if (activity.outputData) {
                        activity.outputData.forEach((data) => {
                            let param = xmlDoc.createElementNS('http://uengine', 'uengine:parameter');
                            param.setAttribute('key', data.name)
                            param.setAttribute('category', "output")
                            params.appendChild(param)
                        })
                        root.appendChild(params)
                        extensionElements.appendChild(root)
                    }
                    root.appendChild(params)
                    extensionElements.appendChild(root)
                    userTask.appendChild(extensionElements)

                    if (idx == 0) {
                        // 시작일땐 StartEvent와 연결
                        const startEvent = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn2:startEvent');
                        startEvent.setAttribute('id', 'StartEvent_1');
                        startEvent.setAttribute('name', 'StartEvent');
                        process.appendChild(startEvent);

                        const sequenceFlow = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn2:sequenceFlow');
                        sequenceFlow.setAttribute('id', 'SequenceFlow_' + 'StartEvent' + '_' + activity.id);
                        sequenceFlow.setAttribute('sourceRef', 'StartEvent_1');
                        sequenceFlow.setAttribute('targetRef', activity.id);
                        let extensionElements = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn2:extensionElements');
                        let root = xmlDoc.createElementNS('http://uengine', 'uengine:uengine-params');
                        let conditionParam = xmlDoc.createElementNS('http://uengine', 'uengine:parameter');
                        let conditionParams = xmlDoc.createElementNS('http://uengine', 'uengine:parameters');
                        conditionParam.setAttribute('key', "condition")
                        conditionParam.textContent = "asdf > 0"
                        conditionParams.appendChild(conditionParam)
                        root.appendChild(conditionParams)
                        extensionElements.appendChild(root)
                        sequenceFlow.appendChild(extensionElements)
                        process.appendChild(sequenceFlow);

                        let inComingSeq = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn2:incoming');
                        inComingSeq.textContent = 'SequenceFlow_' + 'StartEvent' + '_' + activity.id
                        userTask.appendChild(inComingSeq)
                    } else if (idx == jsonModel.activities.length - 1) {
                        // 마지막엔 EndEvent와 연결
                        // EndEvent 요소 추가
                        const endEvent = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn2:endEvent');
                        endEvent.setAttribute('id', 'EndEvent');
                        endEvent.setAttribute('name', 'EndEvent');
                        process.appendChild(endEvent);

                        const sequenceFlow = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn2:sequenceFlow');
                        sequenceFlow.setAttribute('id', 'SequenceFlow_' + activity.id + '_' + 'EndEvent');
                        sequenceFlow.setAttribute('sourceRef', activity.id);
                        sequenceFlow.setAttribute('targetRef', 'EndEvent');
                        let extensionElements = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn2:extensionElements');
                        let root = xmlDoc.createElementNS('http://uengine', 'uengine:uengine-params');
                        let conditionParam = xmlDoc.createElementNS('http://uengine', 'uengine:parameter');
                        let conditionParams = xmlDoc.createElementNS('http://uengine', 'uengine:parameters');
                        conditionParam.setAttribute('key', "condition")
                        conditionParam.textContent = "asdf > 0"
                        conditionParams.appendChild(conditionParam)
                        root.appendChild(conditionParams)
                        extensionElements.appendChild(root)
                        sequenceFlow.appendChild(extensionElements)
                        process.appendChild(sequenceFlow);

                        let outGoingSeq = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn2:outgoing');
                        outGoingSeq.textContent = 'SequenceFlow_' + activity.id + '_' + 'EndEvent'
                        userTask.appendChild(outGoingSeq)
                    }
                    process.appendChild(userTask);
                });


            const bpmnDiagram = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/DI', 'bpmndi:BPMNDiagram');
            bpmnDiagram.setAttribute('id', 'BPMNDiagram_1');
            bpmnDefinitions.appendChild(bpmnDiagram);

            const bpmnPlane = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/DI', 'bpmndi:BPMNPlane');
            bpmnPlane.setAttribute('id', 'BPMNPlane_1');
            bpmnPlane.setAttribute('bpmnElement', 'Collaboration_1');
            bpmnDiagram.appendChild(bpmnPlane);
            let rolePos = {}
            let activityPos = {};

            // Lane 및 Activity에 대한 시각적 표현 추가
            if (jsonModel.roles)
                jsonModel.roles.forEach((role, roleIndex) => {
                    const laneShape = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/DI', 'bpmndi:BPMNShape');
                    laneShape.setAttribute('id', `BPMNShape_${roleIndex}`);
                    laneShape.setAttribute('bpmnElement', `Lane_${roleIndex}`);
                    laneShape.setAttribute('isHorizontal', true)
                    const dcBoundsLane = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DC', 'dc:Bounds');
                    dcBoundsLane.setAttribute('x', '100');
                    dcBoundsLane.setAttribute('y', `${100 + roleIndex * 100}`);
                    dcBoundsLane.setAttribute('width', '600');
                    dcBoundsLane.setAttribute('height', '100');
                    laneShape.appendChild(dcBoundsLane);
                    bpmnPlane.appendChild(laneShape);
                    rolePos[role.name] = {
                        x: dcBoundsLane.getAttribute('x'),
                        y: dcBoundsLane.getAttribute('y')
                    }
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
                        let eventY = parseInt(rolePos[firstActivity.role].y) + 36
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
                        }
                        lastXPos += 120

                    }
                    let activityY = parseInt(rolePos[activity.role].y)
                    const activityShape = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/DI', 'bpmndi:BPMNShape');
                    activityShape.setAttribute('id', `BPMNShape_${activity.id}`);
                    activityShape.setAttribute('bpmnElement', activity.id);

                    const dcBoundsActivity = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DC', 'dc:Bounds');
                    dcBoundsActivity.setAttribute('x', lastXPos);
                    dcBoundsActivity.setAttribute('y', `${activityY + 20}`);
                    dcBoundsActivity.setAttribute('width', 80);
                    dcBoundsActivity.setAttribute('height', 60);
                    activityPos[activity.id] = {
                        x: lastXPos,
                        y: activityY + 20,
                        width: 80,
                        height: 60
                    }
                    activityShape.appendChild(dcBoundsActivity);
                    bpmnPlane.appendChild(activityShape);
                    lastXPos += 120

                    if (activityIndex == jsonModel.activities.length - 1 && lastActivity.role) {
                        // EndEvent의 BPMNShape 추가
                        let eventY = parseInt(rolePos[lastActivity.role].y) + 36
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

                        startWaypoint1.setAttribute('x', parseInt(activityPos['startEvent'].x) + parseInt(activityPos['startEvent'].width));
                        startWaypoint1.setAttribute('y', parseInt(activityPos['startEvent'].y) + (parseInt(activityPos['startEvent'].height) / 2));
                        startBpmnEdge.appendChild(startWaypoint1);
                        const startWaypoint2 = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DI', 'di:waypoint');

                        startWaypoint2.setAttribute('x', parseInt(activityPos[firstActivity.id].x));
                        startWaypoint2.setAttribute('y', parseInt(activityPos[firstActivity.id].y) + (parseInt(activityPos[firstActivity.id].height) / 2));
                        startBpmnEdge.appendChild(startWaypoint2);

                        const endBpmnEdge = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/DI', 'bpmndi:BPMNEdge');
                        endBpmnEdge.setAttribute('id', `BPMNEdge_${lastActivity.id}_EndEvent`);
                        endBpmnEdge.setAttribute('bpmnElement', 'SequenceFlow_' + lastActivity.id + '_' + 'EndEvent');
                        const endWaypoint1 = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DI', 'di:waypoint');
                        // startX = 
                        // startY = 
                        endWaypoint1.setAttribute('x', parseInt(activityPos[lastActivity.id].x) + parseInt(activityPos[lastActivity.id].width));
                        endWaypoint1.setAttribute('y', parseInt(activityPos[lastActivity.id].y) + (parseInt(activityPos[lastActivity.id].height) / 2));
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
                jsonModel.sequences.forEach(sequence => {
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
                    startX = parseInt(activityPos[sequence.source].x) + parseInt(activityPos[sequence.source].width)
                    startY = parseInt(activityPos[sequence.source].y) + (parseInt(activityPos[sequence.source].height) / 2)
                    waypoint1.setAttribute('x', startX);
                    waypoint1.setAttribute('y', startY);
                    bpmnEdge.appendChild(waypoint1);

                    const waypoint2 = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DI', 'di:waypoint');
                    endX = parseInt(activityPos[sequence.target].x)
                    endY = parseInt(activityPos[sequence.target].y) + (parseInt(activityPos[sequence.target].height) / 2)
                    waypoint2.setAttribute('x', endX);
                    waypoint2.setAttribute('y', endY);
                    bpmnEdge.appendChild(waypoint2);

                    bpmnPlane.appendChild(bpmnEdge);
                });
            // XML 문자열로 변환 및 반환
            const serializer = new XMLSerializer();
            const bpmn2Xml = serializer.serializeToString(xmlDoc);
            return bpmn2Xml;
        },
        taskMapping(activity) {
            switch (activity) {
                case "ScriptActivity": return 'bpmn2:scriptTask';
                case "EmailActivity": return 'bpmn2:sendTask';
                default: return 'bpmn2:userTask';
            }
        },
    }
};
</script>
