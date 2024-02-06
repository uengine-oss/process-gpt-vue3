<template>
    <v-card elevation="10">
        <AppBaseCard>
            <template v-slot:leftpart>
                <div class="no-scrollbar">
                    <Chat :name="projectName" :messages="messages" :chatInfo="chatInfo" :isChanged="isChanged"
                        :userInfo="userInfo" :type="path" @sendMessage="beforeSendMessage"
                        @sendEditedMessage="sendEditedMessage" @stopMessage="stopMessage" @getMoreChat="getMoreChat"
                        @save="saveModel"></Chat>
                </div>
            </template>
            <template v-slot:rightpart>
                <process-definition style="width: 100%; height: 100%" :bpmn="bpmn" :processDefinition="processDefinition"
                    :key="definitionChangeCount"></process-definition>
            </template>

            <template v-slot:mobileLeftContent>
                <Chat :name="projectName" :messages="messages" :chatInfo="chatInfo" :isChanged="isChanged"
                    :userInfo="userInfo" :type="path" @sendMessage="beforeSendMessage"
                    @sendEditedMessage="sendEditedMessage" @stopMessage="stopMessage" @getMoreChat="getMoreChat"
                    @save="saveModel"></Chat>
            </template>
        </AppBaseCard>
    </v-card>
</template>

<script>
import partialParse from 'partial-json-parser';
import { VectorStorage } from 'vector-storage';

import ChatGenerator from './ai/ProcessDefinitionGenerator';
import Chat from './ui/Chat.vue';
import ChatModule from './ChatModule.vue';
import AppBaseCard from '@/components/shared/AppBaseCard.vue';
import ChatListing from '@/components/apps/chats/ChatListing.vue';
import ChatDetail from '@/components/apps/chats/ChatDetail.vue';
import ChatProfile from '@/components/apps/chats/ChatProfile.vue';
import ProcessDefinition from '@/components/ProcessDefinition.vue';
// import BpmnModelingCanvas from '@/components/designer/bpmnModeling/BpmnModelCanvas.vue';
import { ref } from 'vue';

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
        ChatGenerator
    },
    data: () => ({
        processDefinition: null,
        bpmn: null,
        projectName: '',
        path: 'definitions',
        definitionChangeCount: 0,
        chatInfo: {
            title: '프로세스 정의 관리',
            text: "대화형으로 프로세스를 관리하십시오. \n 예를 들어, '영업관리 프로세스를 다음과 같이 등록해줘: 1. 영업기회등 고객명, 예상사업규모, 키맨, 요구사항 2. 제안 작성: 제안 내용, 가격 3. 수주 혹은 실주 4. 수주한 경우, 계약진행' 와 같은 명령을 할 수 있습니다."
        },
        changedModel: null,
        processDefinitionMap: null,
    }),
    async created() {
        await this.init();

        this.generator = new ChatGenerator(this, {
            isStream: true,
            preferredLanguage: 'Korean'
        });

        this.saveDefinitionMap({messages: JSON.stringify(this.messages)})
    },
    watch: {
        $route: {
            //     deep: true,
            async handler(newVal, oldVal) {
                //         if (newVal.path !== oldVal.path) {
                //             // console.log('aa');
                //             // this.processDefinition = null;
                //             // this.bpmn = null;
                var path = this.$route.href.replace('#/', '');
                this.loadData(path);

                // this.messages = await this.loadMessages(path);
                //         }
            }
        }
    },
    methods: {
        async loadData(path) {
            const value = await this.getData(path);
            if (value) {
                if (this.$route.params && this.$route.params.id) {
                    this.processDefinition = partialParse(value.model);
                    if (!this.processDefinition) {
                        this.processDefinition = [];
                    } else {
                        this.bpmn =
                            '<?xml version="1.0" encoding="UTF-8"?><bpmn2:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:bpmn2="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" xmlns:uengine="http://uengine" id="sample-diagram" targetNamespace="http://bpmn.io/schema/bpmn" xsi:schemaLocation="http://www.omg.org/spec/BPMN/20100524/MODEL BPMN20.xsd"><bpmn2:collaboration id="Collaboration_1tj7ei2"><bpmn2:participant id="Participant_1eqhejj" processRef="Process_1"/></bpmn2:collaboration><bpmn2:process id="Process_1" isExecutable="false"><bpmn2:laneSet id="LaneSet_1g2nbpc"><bpmn2:lane id="Lane_0wneims" name="Woker"><bpmn2:flowNodeRef>StartEvent_1</bpmn2:flowNodeRef><bpmn2:flowNodeRef>Activity_1ta8n6y</bpmn2:flowNodeRef></bpmn2:lane><bpmn2:lane id="Lane_1lf58ly" name="HR"><bpmn2:flowNodeRef>Event_0h4j724</bpmn2:flowNodeRef><bpmn2:flowNodeRef>Activity_0ji9jev</bpmn2:flowNodeRef></bpmn2:lane></bpmn2:laneSet><bpmn2:startEvent id="StartEvent_1" name="시작" magic:spell="Avada Kedavra"><bpmn2:outgoing>Flow_0sp25wg</bpmn2:outgoing></bpmn2:startEvent><bpmn2:sequenceFlow id="Flow_0sp25wg" sourceRef="StartEvent_1" targetRef="Activity_1ta8n6y"/><bpmn2:sequenceFlow id="Flow_03dbjwz" sourceRef="Activity_1ta8n6y" targetRef="Activity_0ji9jev"/><bpmn2:endEvent id="Event_0h4j724" name="종료"><bpmn2:incoming>Flow_182335x</bpmn2:incoming></bpmn2:endEvent><bpmn2:sequenceFlow id="Flow_182335x" sourceRef="Activity_0ji9jev" targetRef="Event_0h4j724"/><bpmn2:userTask id="Activity_1ta8n6y" name="휴가 신청"><bpmn2:documentation>Vacation</bpmn2:documentation><bpmn2:incoming>Flow_0sp25wg</bpmn2:incoming><bpmn2:outgoing>Flow_03dbjwz</bpmn2:outgoing></bpmn2:userTask><bpmn2:userTask id="Activity_0ji9jev" name="승인"><bpmn2:documentation>confirm</bpmn2:documentation><bpmn2:incoming>Flow_03dbjwz</bpmn2:incoming><bpmn2:outgoing>Flow_182335x</bpmn2:outgoing></bpmn2:userTask></bpmn2:process><bpmndi:BPMNDiagram id="BPMNDiagram_1"><bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Collaboration_1tj7ei2"><bpmndi:BPMNShape id="Participant_1eqhejj_di" bpmnElement="Participant_1eqhejj" isHorizontal="true"><dc:Bounds x="270" y="150" width="600" height="250"/></bpmndi:BPMNShape><bpmndi:BPMNShape id="Lane_0wneims_di" bpmnElement="Lane_0wneims" isHorizontal="true"><dc:Bounds x="300" y="150" width="570" height="125"/><bpmndi:BPMNLabel/></bpmndi:BPMNShape><bpmndi:BPMNShape id="Lane_1lf58ly_di" bpmnElement="Lane_1lf58ly" isHorizontal="true"><dc:Bounds x="300" y="275" width="570" height="125"/><bpmndi:BPMNLabel/></bpmndi:BPMNShape><bpmndi:BPMNShape id="_BPMNShape_StartEvent_2" bpmnElement="StartEvent_1"><dc:Bounds x="352" y="192" width="36" height="36"/><bpmndi:BPMNLabel><dc:Bounds x="361" y="235" width="20" height="14"/></bpmndi:BPMNLabel></bpmndi:BPMNShape><bpmndi:BPMNShape id="Event_0h4j724_di" bpmnElement="Event_0h4j724"><dc:Bounds x="762" y="322" width="36" height="36"/><bpmndi:BPMNLabel><dc:Bounds x="770" y="365" width="20" height="14"/></bpmndi:BPMNLabel></bpmndi:BPMNShape><bpmndi:BPMNShape id="Activity_18762mc_di" bpmnElement="Activity_1ta8n6y"><dc:Bounds x="440" y="170" width="100" height="80"/></bpmndi:BPMNShape><bpmndi:BPMNShape id="Activity_1omaje8_di" bpmnElement="Activity_0ji9jev"><dc:Bounds x="600" y="300" width="100" height="80"/></bpmndi:BPMNShape><bpmndi:BPMNEdge id="Flow_0sp25wg_di" bpmnElement="Flow_0sp25wg"><di:waypoint x="388" y="210"/><di:waypoint x="440" y="210"/></bpmndi:BPMNEdge><bpmndi:BPMNEdge id="Flow_03dbjwz_di" bpmnElement="Flow_03dbjwz"><di:waypoint x="540" y="210"/><di:waypoint x="570" y="210"/><di:waypoint x="570" y="340"/><di:waypoint x="600" y="340"/></bpmndi:BPMNEdge><bpmndi:BPMNEdge id="Flow_182335x_di" bpmnElement="Flow_182335x"><di:waypoint x="700" y="340"/><di:waypoint x="762" y="340"/></bpmndi:BPMNEdge></bpmndi:BPMNPlane></bpmndi:BPMNDiagram></bpmn2:definitions>';
                        // this.bpmn = `{"$type":"bpmn:Definitions","id":"sample-diagram","targetNamespace":"http:\/\/bpmn.io\/schema\/bpmn","rootElements":[{"$type":"bpmn:Collaboration","id":"Collaboration_1tj7ei2","participants":[{"$type":"bpmn:Participant","id":"Participant_1eqhejj"}]},{"$type":"bpmn:Process","id":"Process_1","isExecutable":false,"laneSets":[{"$type":"bpmn:LaneSet","id":"LaneSet_1g2nbpc","lanes":[{"$type":"bpmn:Lane","id":"Lane_0wneims","name":"Woker"},{"$type":"bpmn:Lane","id":"Lane_1lf58ly","name":"HR"}]}],"flowElements":[{"$type":"bpmn:StartEvent","id":"StartEvent_1","name":"\uc2dc\uc791","eventDefinitions":[]},{"$type":"bpmn:SequenceFlow","id":"Flow_0sp25wg"},{"$type":"bpmn:SequenceFlow","id":"Flow_03dbjwz"},{"$type":"bpmn:EndEvent","id":"Event_0h4j724","name":"\uc885\ub8cc","eventDefinitions":[]},{"$type":"bpmn:SequenceFlow","id":"Flow_182335x"},{"$type":"bpmn:UserTask","id":"Activity_1ta8n6y","name":"\ud734\uac00 \uc2e0\uccad","documentation":[{"$type":"bpmn:Documentation","text":"Vacation"}],"script":"console.log('hello world')"},{"$type":"bpmn:UserTask","id":"Activity_0ji9jev","name":"\uc2b9\uc778","documentation":[{"$type":"bpmn:Documentation","text":"confirm"}]}]}],"diagrams":[{"$type":"bpmndi:BPMNDiagram","id":"BPMNDiagram_1","plane":{"$type":"bpmndi:BPMNPlane","id":"BPMNPlane_1","planeElement":[{"$type":"bpmndi:BPMNShape","id":"Participant_1eqhejj_di","isHorizontal":true,"bounds":{"$type":"dc:Bounds","x":270,"y":150,"width":600,"height":250}},{"$type":"bpmndi:BPMNShape","id":"Lane_1lf58ly_di","isHorizontal":true,"bounds":{"$type":"dc:Bounds","x":300,"y":275,"width":570,"height":125},"label":{"$type":"bpmndi:BPMNLabel"}},{"$type":"bpmndi:BPMNShape","id":"Lane_0wneims_di","isHorizontal":true,"bounds":{"$type":"dc:Bounds","x":300,"y":150,"width":570,"height":125},"label":{"$type":"bpmndi:BPMNLabel"}},{"$type":"bpmndi:BPMNShape","id":"_BPMNShape_StartEvent_2","bounds":{"$type":"dc:Bounds","x":352,"y":192,"width":36,"height":36},"label":{"$type":"bpmndi:BPMNLabel","bounds":{"$type":"dc:Bounds","x":361,"y":235,"width":20,"height":14}}},{"$type":"bpmndi:BPMNShape","id":"Event_0h4j724_di","bounds":{"$type":"dc:Bounds","x":762,"y":322,"width":36,"height":36},"label":{"$type":"bpmndi:BPMNLabel","bounds":{"$type":"dc:Bounds","x":770,"y":365,"width":20,"height":14}}},{"$type":"bpmndi:BPMNShape","id":"Activity_18762mc_di","bounds":{"$type":"dc:Bounds","x":440,"y":170,"width":100,"height":80}},{"$type":"bpmndi:BPMNShape","id":"Activity_1omaje8_di","bounds":{"$type":"dc:Bounds","x":600,"y":300,"width":100,"height":80}},{"$type":"bpmndi:BPMNEdge","id":"Flow_0sp25wg_di","waypoint":[{"$type":"dc:Point","x":388,"y":210},{"$type":"dc:Point","x":440,"y":210}]},{"$type":"bpmndi:BPMNEdge","id":"Flow_03dbjwz_di","waypoint":[{"$type":"dc:Point","x":540,"y":210},{"$type":"dc:Point","x":570,"y":210},{"$type":"dc:Point","x":570,"y":340},{"$type":"dc:Point","x":600,"y":340}]},{"$type":"bpmndi:BPMNEdge","id":"Flow_182335x_di","waypoint":[{"$type":"dc:Point","x":700,"y":340},{"$type":"dc:Point","x":762,"y":340}]}]}}]}`;
                        this.projectName = this.processDefinition.name;
                        this.definitionChangeCount++;
                    }
                }
            }

            this.processDefinitionMap = await this.getData("definition");
        },

        beforeSendMessage(newMessage) {
            this.sendMessage(newMessage);
        },

        afterModelCreated(response) {
            try {
                let jsonProcess = this.extractJSON(response);

                if (jsonProcess) {
                    let unknown = partialParse(jsonProcess);
                    if (unknown.modifications) {
                        //means process modification
                        unknown.modifications.forEach((modification) => {
                            if (modification.action == 'replace') {
                                this.jsonPathReplace(this.processDefinition, modification.targetJsonPath, modification.value);
                                this.model = this.createBpmnXml(this.processDefinition);
                            } else if (modification.action == 'add') {
                                this.jsonPathAdd(this.processDefinition, modification.targetJsonPath, modification.value);
                                this.model = this.createBpmnXml(this.processDefinition);
                            } else if (modification.action == 'delete') {
                                this.jsonPathDelete(this.processDefinition, modification.targetJsonPath);
                                this.model = this.createBpmnXml(this.processDefinition);
                            }
                        });
                    } else if (unknown.processDefinitionId) {
                        this.processDefinition = unknown;
                        this.model = this.createBpmnXml(this.processDefinition);
                    }
                    this.definitionChangeCount++;
                }
            } catch (error) {
                console.log(error);
            }
        },

        afterGenerationFinished(response) {
            let modelText = '';
            let path = this.path;
            let putObj = {
                messages: JSON.stringify(this.messages),
                model: null
            };

            if (this.processDefinition) {
                path = `${this.path}/${this.processDefinition.processDefinitionId}`;

                modelText = JSON.stringify(this.processDefinition);
                this.saveDefinition(this.processDefinition);
                putObj.model = modelText;
                this.putObject(`models/${this.processDefinition.processDefinitionId}`, { name: this.projectName, model: this.model });
                this.putObject(path, putObj);
                this.saveDefinitionMap(putObj);
            }
        },
        async saveDefinitionMap(obj) {
            var path = 'definition';
            if (this.processDefinition) {
                var megaProcessId = this.processDefinition.megaProcessId;
                var majorProcessId = this.processDefinition.majorProcessId;

                this.processDefinitionMap = await this.getData(path);
                if (this.processDefinitionMap && this.processDefinitionMap.megaProcess) {
                    const megaProcesses = Object.values(this.processDefinitionMap.megaProcess);
                    console.log(megaProcesses)
                    path += "/megaProcess/"
                    megaProcesses.forEach((mega, megaIdx) => {
                        if (mega.id == megaProcessId && mega.majorProcess) {
                            path += `${megaIdx}/majorProcess/`;
                            mega.majorProcess.forEach((major, majorIdx) => {
                                if (major.id == majorProcessId) {
                                    path += `${majorIdx}/subProcess`;
                                }
                            })
                        }
                    });
                }
                
                if (path.includes('subProcess')) {
                    console.log(path)
                    obj.id = this.processDefinition.processDefinitionId;
                    obj.name = this.processDefinition.processDefinitionName;
                    this.pushObject(path, obj);
                }
            }
        },
        convertToProcessDefinition(jsonInput) {
            const processDefinition = {
                processDefinitionName: jsonInput.name,
                processDefinitionId: jsonInput.definitionId,
                description: '', // Assuming a generic description; update as needed
                data: jsonInput.processVariableDescriptors.map((variable) => ({
                    name: variable.name,
                    description: variable.displayName.text,
                    type: 'Text' // Assuming all variables are of type Text; update logic as needed for different types
                })),
                roles: Object.values(jsonInput.elements)
                    .filter((element) => element != null)
                    .filter((element) => element._type == 'org.uengine.kernel.Role')
                    .map((role) => ({
                        name: role.name,
                        resolutionRule: role.roleResolutionContext.endpoint
                    })),
                activities: Object.values(jsonInput.elements)
                    .filter((element) => element != null)
                    .filter((element) => element._type == 'org.uengine.kernel.HumanActivity')
                    .map((activity) => ({
                        name: activity.name || activity.oldName,
                        id: activity.elementView.id,
                        type: 'UserActivity', // Assuming UserActivity; update as needed for different activity types
                        description: activity.name + ' 활동', // Assuming a generic description; update as needed
                        instruction: '장애 정보를 기반으로 문제를 해결하세요.', // Assuming a generic instruction; update as needed
                        role: activity.role.name,
                        inputData: activity.parameters?.map((param) => ({
                            name: param.variable.name
                        })),
                        outputData: activity.parameters?.map((param) => ({
                            name: param.variable.name
                        })),
                        checkpoints: [] // Assuming no checkpoints; update as needed
                    })),
                sequences: Object.values(jsonInput.relations)
                    .filter((relation) => relation != null)
                    .filter((relation) => relation._type == 'org.uengine.kernel.bpmn.SequenceFlow')
                    .map((sequence) => ({
                        source: sequence.from,
                        target: sequence.to
                    }))
            };

            return processDefinition;
        },
        async saveModel() {
            // alert(model);
            console.log(this.changedModel);
            this.projectName = this.projectName;
            const apiToken = this.generator.getToken();
            let definition = this.convertToProcessDefinition(this.changedModel);
            const vectorStore = new VectorStorage({ openAIApiKey: apiToken });
            let vectorId = await vectorStore.similaritySearch({
                query: this.projectName,
                k: 1
            });
            if (vectorId) {
                console.log(vectorId);
                let path = `definitions/${this.changedModel.definitionId ? this.changedModel.definitionId : this.$route.params.id}/model`;
                this.pushObject(path, definition);
                this.deleteVectorStorage(vectorId.similarItems[0].id);
                this.saveDefinition(definition);
            }
        },
        // parseDefinition(model) {
        //     let definition = {};
        //     // 변형 로직 Model to Def
        //     return definition;
        // },
        async saveDefinition(definition) {
            // Create an instance of VectorStorage
            const apiToken = this.generator.getToken();
            const vectorStore = new VectorStorage({ openAIApiKey: apiToken });

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
        // absY(y, height) {
        //     return element.elementView.y - (element.elementView.height / 2)
        // }
        createBpmnXml(jsonProcess) {
            // XML 문서 초기화
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(
                '<?xml version="1.0" encoding="UTF-8"?><bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"></bpmn:definitions>',
                'application/xml'
            );
            const bpmn = xmlDoc.documentElement;

            // XML 네임스페이스 설정
            bpmn.setAttribute('xmlns:bpmn', 'http://www.omg.org/spec/BPMN/20100524/MODEL');
            bpmn.setAttribute('xmlns:bpmndi', 'http://www.omg.org/spec/BPMN/20100524/DI');
            bpmn.setAttribute('xmlns:dc', 'http://www.omg.org/spec/DD/20100524/DC');
            bpmn.setAttribute('xmlns:di', 'http://www.omg.org/spec/DD/20100524/DI');
            bpmn.setAttribute('id', 'Definitions_1');
            bpmn.setAttribute('targetNamespace', 'http://bpmn.io/schema/bpmn');
            bpmn.setAttribute('exporter', 'Custom BPMN Modeler');
            bpmn.setAttribute('exporterVersion', '1.0');

            // 콜라보레이션 및 참가자 요소 생성
            const collaboration = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:collaboration');
            collaboration.setAttribute('id', 'Collaboration_1');
            const participant = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:participant');
            participant.setAttribute('id', 'Participant_' + jsonProcess.processDefinitionId);
            participant.setAttribute('name', jsonProcess.processDefinitionName);
            participant.setAttribute('processRef', 'Process_' + jsonProcess.processDefinitionId);
            collaboration.appendChild(participant);
            bpmn.appendChild(collaboration);

            // Process 요소 생성
            const process = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:process');
            process.setAttribute('id', jsonProcess.processDefinitionId); //.replace(/\s+/g, '_'));
            process.setAttribute('isExecutable', 'true');

            bpmn.appendChild(process);

            // 레인셋 생성
            const laneSet = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:laneSet');
            laneSet.setAttribute('id', 'LaneSet_' + jsonProcess.processDefinitionId);
            process.appendChild(laneSet);

            // 레인 생성 및 역할 할당
            if (jsonProcess.roles)
                jsonProcess.roles.forEach((role) => {
                    const lane = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:lane');
                    lane.setAttribute('id', 'Lane_' + role.name.replace(/\s+/g, '_'));
                    lane.setAttribute('name', role.name);
                    laneSet.appendChild(lane);

                    // 해당 역할에 매핑된 활동들을 레인에 할당
                    if (jsonProcess.activities)
                        jsonProcess.activities.forEach((activity) => {
                            if (activity.role === role.name) {
                                const flowNodeRef = xmlDoc.createElementNS(
                                    'http://www.omg.org/spec/BPMN/20100524/MODEL',
                                    'bpmn:flowNodeRef'
                                );
                                flowNodeRef.textContent = activity.id;
                                lane.appendChild(flowNodeRef);
                            }
                        });
                });

            // 각 활동 (Activity) 요소 생성
            if (jsonProcess.activities)
                jsonProcess.activities.forEach((activity) => {
                    const task = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:userTask');
                    task.setAttribute('id', activity.id);
                    task.setAttribute('name', activity.name);
                    process.appendChild(task);
                });

            // 시퀀스 플로우 생성
            if (jsonProcess.sequences)
                jsonProcess.sequences.forEach((sequence) => {
                    const sequenceFlow = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn:sequenceFlow');
                    sequenceFlow.setAttribute('id', 'SequenceFlow_' + sequence.source + '_' + sequence.target);
                    sequenceFlow.setAttribute('sourceRef', sequence.source);
                    sequenceFlow.setAttribute('targetRef', sequence.target);
                    process.appendChild(sequenceFlow);
                });

            //            bpmn.appendChild(process);

            // BPMNDiagram 요소 추가
            const bpmnDiagram = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/DI', 'bpmndi:BPMNDiagram');
            bpmnDiagram.setAttribute('id', 'BPMNDiagram_' + jsonProcess.processDefinitionId);
            const bpmnPlane = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/DI', 'bpmndi:BPMNPlane');
            bpmnPlane.setAttribute('id', 'BPMNPlane_' + jsonProcess.processDefinitionId);
            bpmnPlane.setAttribute('bpmnElement', collaboration.getAttribute('id'));
            bpmnDiagram.appendChild(bpmnPlane);

            // 레인의 시각적 표현 추가
            if (jsonProcess.roles)
                jsonProcess.roles.forEach((role, index) => {
                    const laneShape = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/DI', 'bpmndi:BPMNShape');
                    laneShape.setAttribute('id', 'BPMNShape_Lane_' + role.name.replace(/\s+/g, '_'));
                    laneShape.setAttribute('bpmnElement', 'Lane_' + role.name.replace(/\s+/g, '_'));

                    const laneBounds = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DC', 'dc:Bounds');
                    laneBounds.setAttribute('x', 100);
                    laneBounds.setAttribute('y', 100 + index * 100);
                    laneBounds.setAttribute('width', 600);
                    laneBounds.setAttribute('height', 100);

                    laneShape.appendChild(laneBounds);
                    bpmnPlane.appendChild(laneShape);
                });

            // 활동 및 시퀀스 플로우의 시각적 표현 추가
            if (jsonProcess.activities)
                jsonProcess.activities.forEach((activity, index) => {
                    const shape = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/DI', 'bpmndi:BPMNShape');
                    shape.setAttribute('id', 'BPMNShape_' + activity.id);
                    shape.setAttribute('bpmnElement', activity.id);

                    const bounds = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DC', 'dc:Bounds');
                    bounds.setAttribute('x', 150 + index * 100); // 위치 예제
                    bounds.setAttribute('y', 120 + index * 60); // 위치 예제
                    bounds.setAttribute('width', 80);
                    bounds.setAttribute('height', 60);

                    shape.appendChild(bounds);
                    bpmnPlane.appendChild(shape);
                });

            if (jsonProcess.sequences)
                jsonProcess.sequences.forEach((sequence) => {
                    const edge = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/DI', 'bpmndi:BPMNEdge');
                    edge.setAttribute('id', 'BPMNEdge_' + sequence.source + '_' + sequence.target);
                    edge.setAttribute('bpmnElement', 'SequenceFlow_' + sequence.source + '_' + sequence.target);

                    // Waypoint 예제 (실제 좌표는 활동의 위치에 따라 조정되어야 함)
                    const waypoint1 = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DI', 'di:waypoint');
                    waypoint1.setAttribute('x', 200); // 예제 좌표
                    waypoint1.setAttribute('y', 150); // 예제 좌표
                    edge.appendChild(waypoint1);

                    const waypoint2 = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DI', 'di:waypoint');
                    waypoint2.setAttribute('x', 300); // 예제 좌표
                    waypoint2.setAttribute('y', 150); // 예제 좌표
                    edge.appendChild(waypoint2);

                    bpmnPlane.appendChild(edge);
                });

            // // 시각적 요소 생성 (BPMNShape 및 BPMNEdge)
            // if(jsonProcess.activities)
            // jsonProcess.activities.forEach((activity, index) => {
            //     const shape = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/DI', 'bpmndi:BPMNShape');
            //     shape.setAttribute('id', 'BPMNShape_' + activity.id);
            //     shape.setAttribute('bpmnElement', activity.id);

            //     const bounds = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DC', 'dc:Bounds');
            //     bounds.setAttribute('x', 100 + (index * 150)); // 예제 위치
            //     bounds.setAttribute('y', 100);
            //     bounds.setAttribute('width', 100);
            //     bounds.setAttribute('height', 80);

            //     shape.appendChild(bounds);
            //     bpmnPlane.appendChild(shape);
            // });

            // // 시퀀스 플로우 시각적 요소
            // if(jsonProcess.sequences)
            // jsonProcess.sequences.forEach(sequence => {
            //     const edge = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/DI', 'bpmndi:BPMNEdge');
            //     edge.setAttribute('id', 'BPMNEdge_' + sequence.source + '_' + sequence.target);
            //     edge.setAttribute('bpmnElement', 'SequenceFlow_' + sequence.source + '_' + sequence.target);

            //     // 예제 waypoint
            //     const waypoint1 = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DI', 'di:waypoint');
            //     waypoint1.setAttribute('x', 150);
            //     waypoint1.setAttribute('y', 140);

            //     const waypoint2 = xmlDoc.createElementNS('http://www.omg.org/spec/DD/20100524/DI', 'di:waypoint');
            //     waypoint2.setAttribute('x', 250);
            //     waypoint2.setAttribute('y', 140);

            //     edge.appendChild(waypoint1);
            //     edge.appendChild(waypoint2);

            //     bpmnPlane.appendChild(edge);
            // });

            bpmn.appendChild(bpmnDiagram);

            // XML 문자열로 변환
            const serializer = new XMLSerializer();
            const xmlString = serializer.serializeToString(xmlDoc);
            return xmlString;
        }
    }
};
</script>

<style scoped></style>
