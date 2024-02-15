<template>
    <v-card elevation="10" style="background-color: rgba(255, 255, 255, 0)">
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
                    @update="isChanged = true" :key="definitionChangeCount"
                    @updateDefinition="(val) => processDefinition = val"></process-definition>
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
        isChanged: false,
        chatInfo: {
            title: 'processDefinition.cardTitle',
            text: "processDefinition.processDefinitionExplanation"
        },
        changedModel: null,
        processDefinitionMap: null
    }),
    async created() {
        await this.init();

        this.generator = new ChatGenerator(this, {
            isStream: true,
            preferredLanguage: 'Korean'
        });

        // this.saveDefinitionMap({ messages: JSON.stringify(this.messages) });
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
        },
        processDefinition: {
            deep: true,
            handler(newVal, oldVal) {
                if (oldVal != null) {
                    let putObj = {
                        id: newVal.processDefinitionId,
                        name: newVal.processDefinitionName,
                        definition: newVal
                    };
                    let modelText = JSON.stringify(this.processDefinition);
                    putObj.model = modelText
                    let path = `${this.path}/${newVal.processDefinitionId}`
                    this.putObject(path, putObj)
                }
            }
        }
    },
    methods: {
        async loadData(path) {
            // this.bpmn = '<?xml version="1.0" encoding="UTF-8"?><bpmn2:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:bpmn2="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" xmlns:uengine="http://uengine" id="sample-diagram" targetNamespace="http://bpmn.io/schema/bpmn" xsi:schemaLocation="http://www.omg.org/spec/BPMN/20100524/MODEL BPMN20.xsd"><bpmn2:collaboration id="Collaboration_1tj7ei2"><bpmn2:participant id="Participant_1eqhejj" processRef="Process_1"/></bpmn2:collaboration><bpmn2:process id="Process_1" isExecutable="false"><bpmn2:laneSet id="LaneSet_1g2nbpc"><bpmn2:lane id="Lane_0wneims" name="Woker"><bpmn2:flowNodeRef>StartEvent_1</bpmn2:flowNodeRef><bpmn2:flowNodeRef>Activity_1ta8n6y</bpmn2:flowNodeRef></bpmn2:lane><bpmn2:lane id="Lane_1lf58ly" name="HR"><bpmn2:flowNodeRef>Event_0h4j724</bpmn2:flowNodeRef><bpmn2:flowNodeRef>Activity_0ji9jev</bpmn2:flowNodeRef></bpmn2:lane></bpmn2:laneSet><bpmn2:startEvent id="StartEvent_1" name="시작" magic:spell="Avada Kedavra"><bpmn2:outgoing>Flow_0sp25wg</bpmn2:outgoing></bpmn2:startEvent><bpmn2:sequenceFlow id="Flow_0sp25wg" sourceRef="StartEvent_1" targetRef="Activity_1ta8n6y"/><bpmn2:sequenceFlow id="Flow_03dbjwz" sourceRef="Activity_1ta8n6y" targetRef="Activity_0ji9jev"/><bpmn2:endEvent id="Event_0h4j724" name="종료"><bpmn2:incoming>Flow_182335x</bpmn2:incoming></bpmn2:endEvent><bpmn2:sequenceFlow id="Flow_182335x" sourceRef="Activity_0ji9jev" targetRef="Event_0h4j724"/><bpmn2:userTask id="Activity_1ta8n6y" name="휴가 신청"><bpmn2:documentation>Vacation</bpmn2:documentation><bpmn2:incoming>Flow_0sp25wg</bpmn2:incoming><bpmn2:outgoing>Flow_03dbjwz</bpmn2:outgoing></bpmn2:userTask><bpmn2:userTask id="Activity_0ji9jev" name="승인"><bpmn2:documentation>confirm</bpmn2:documentation><bpmn2:incoming>Flow_03dbjwz</bpmn2:incoming><bpmn2:outgoing>Flow_182335x</bpmn2:outgoing></bpmn2:userTask></bpmn2:process><bpmndi:BPMNDiagram id="BPMNDiagram_1"><bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Collaboration_1tj7ei2"><bpmndi:BPMNShape id="Participant_1eqhejj_di" bpmnElement="Participant_1eqhejj" isHorizontal="true"><dc:Bounds x="270" y="150" width="600" height="250"/></bpmndi:BPMNShape><bpmndi:BPMNShape id="Lane_0wneims_di" bpmnElement="Lane_0wneims" isHorizontal="true"><dc:Bounds x="300" y="150" width="570" height="125"/><bpmndi:BPMNLabel/></bpmndi:BPMNShape><bpmndi:BPMNShape id="Lane_1lf58ly_di" bpmnElement="Lane_1lf58ly" isHorizontal="true"><dc:Bounds x="300" y="275" width="570" height="125"/><bpmndi:BPMNLabel/></bpmndi:BPMNShape><bpmndi:BPMNShape id="_BPMNShape_StartEvent_2" bpmnElement="StartEvent_1"><dc:Bounds x="352" y="192" width="36" height="36"/><bpmndi:BPMNLabel><dc:Bounds x="361" y="235" width="20" height="14"/></bpmndi:BPMNLabel></bpmndi:BPMNShape><bpmndi:BPMNShape id="Event_0h4j724_di" bpmnElement="Event_0h4j724"><dc:Bounds x="762" y="322" width="36" height="36"/><bpmndi:BPMNLabel><dc:Bounds x="770" y="365" width="20" height="14"/></bpmndi:BPMNLabel></bpmndi:BPMNShape><bpmndi:BPMNShape id="Activity_18762mc_di" bpmnElement="Activity_1ta8n6y"><dc:Bounds x="440" y="170" width="100" height="80"/></bpmndi:BPMNShape><bpmndi:BPMNShape id="Activity_1omaje8_di" bpmnElement="Activity_0ji9jev"><dc:Bounds x="600" y="300" width="100" height="80"/></bpmndi:BPMNShape><bpmndi:BPMNEdge id="Flow_0sp25wg_di" bpmnElement="Flow_0sp25wg"><di:waypoint x="388" y="210"/><di:waypoint x="440" y="210"/></bpmndi:BPMNEdge><bpmndi:BPMNEdge id="Flow_03dbjwz_di" bpmnElement="Flow_03dbjwz"><di:waypoint x="540" y="210"/><di:waypoint x="570" y="210"/><di:waypoint x="570" y="340"/><di:waypoint x="600" y="340"/></bpmndi:BPMNEdge><bpmndi:BPMNEdge id="Flow_182335x_di" bpmnElement="Flow_182335x"><di:waypoint x="700" y="340"/><di:waypoint x="762" y="340"/></bpmndi:BPMNEdge></bpmndi:BPMNPlane></bpmndi:BPMNDiagram></bpmn2:definitions>';
            // this.bpmn = `{"$type":"bpmn:Definitions","id":"sample-diagram","targetNamespace":"http://bpmn.io/schema/bpmn","rootElements":[{"$type":"bpmn:Collaboration","id":"Collaboration_1tj7ei2","participants":[{"$type":"bpmn:Participant","id":"Participant_1eqhejj","$parent":"Collaboration_1tj7ei2"}],"$parent":"sample-diagram"},{"$type":"bpmn:Process","id":"Process_1","isExecutable":false,"laneSets":[{"$type":"bpmn:LaneSet","id":"LaneSet_1g2nbpc","lanes":[{"$type":"bpmn:Lane","id":"Lane_0wneims","name":"Woker","$parent":"LaneSet_1g2nbpc"},{"$type":"bpmn:Lane","id":"Lane_1lf58ly","name":"HR","$parent":"LaneSet_1g2nbpc"}],"$parent":"Process_1"}],"flowElements":[{"$type":"bpmn:StartEvent","id":"StartEvent_1","name":"시작","eventDefinitions":[],"$parent":"Process_1"},{"$type":"bpmn:SequenceFlow","id":"Flow_0sp25wg","$parent":"Process_1","sourceRef":"StartEvent_1","targetRef":"Activity_1ta8n6y"},{"$type":"bpmn:SequenceFlow","id":"Flow_03dbjwz","$parent":"Process_1","sourceRef":"Activity_1ta8n6y","targetRef":"Activity_0ji9jev"},{"$type":"bpmn:EndEvent","id":"Event_0h4j724","name":"종료","eventDefinitions":[],"$parent":"Process_1"},{"$type":"bpmn:SequenceFlow","id":"Flow_182335x","$parent":"Process_1","sourceRef":"Activity_0ji9jev","targetRef":"Event_0h4j724"},{"$type":"bpmn:UserTask","id":"Activity_1ta8n6y","name":"휴가 신청","documentation":[{"$type":"bpmn:Documentation","text":"Vacation","$parent":"Activity_1ta8n6y"}],"uengine-params":{"script": "System.out.println('hello world')"},"$parent":"Process_1"},{"$type":"bpmn:UserTask","id":"Activity_0ji9jev","name":"승인","documentation":[{"$type":"bpmn:Documentation","text":"confirm","$parent":"Activity_0ji9jev"}],"$parent":"Process_1"}],"$parent":"sample-diagram"}],"diagrams":[{"$type":"bpmndi:BPMNDiagram","id":"BPMNDiagram_1","plane":{"$type":"bpmndi:BPMNPlane","id":"BPMNPlane_1","planeElement":[{"$type":"bpmndi:BPMNShape","id":"Lane_1lf58ly_di","isHorizontal":true,"bounds":{"$type":"dc:Bounds","x":300,"y":275,"width":570,"height":125,"$parent":"Lane_1lf58ly_di"},"label":{"$type":"bpmndi:BPMNLabel","$parent":"Lane_1lf58ly_di"},"bpmnElement":"Lane_1lf58ly","$parent":"BPMNPlane_1"},{"$type":"bpmndi:BPMNShape","id":"Lane_0wneims_di","isHorizontal":true,"bounds":{"$type":"dc:Bounds","x":300,"y":150,"width":570,"height":125,"$parent":"Lane_0wneims_di"},"label":{"$type":"bpmndi:BPMNLabel","$parent":"Lane_0wneims_di"},"bpmnElement":"Lane_0wneims","$parent":"BPMNPlane_1"},{"$type":"bpmndi:BPMNShape","id":"Participant_1eqhejj_di","isHorizontal":true,"bounds":{"$type":"dc:Bounds","x":270,"y":150,"width":600,"height":250,"$parent":"Participant_1eqhejj_di"},"bpmnElement":"Participant_1eqhejj","$parent":"BPMNPlane_1"},{"$type":"bpmndi:BPMNShape","id":"_BPMNShape_StartEvent_2","bounds":{"$type":"dc:Bounds","x":352,"y":192,"width":36,"height":36,"$parent":"_BPMNShape_StartEvent_2"},"label":{"$type":"bpmndi:BPMNLabel","bounds":{"$type":"dc:Bounds","x":361,"y":235,"width":20,"height":14},"$parent":"_BPMNShape_StartEvent_2"},"bpmnElement":"StartEvent_1","$parent":"BPMNPlane_1"},{"$type":"bpmndi:BPMNShape","id":"Event_0h4j724_di","bounds":{"$type":"dc:Bounds","x":762,"y":322,"width":36,"height":36,"$parent":"Event_0h4j724_di"},"label":{"$type":"bpmndi:BPMNLabel","bounds":{"$type":"dc:Bounds","x":770,"y":365,"width":20,"height":14},"$parent":"Event_0h4j724_di"},"bpmnElement":"Event_0h4j724","$parent":"BPMNPlane_1"},{"$type":"bpmndi:BPMNShape","id":"Activity_18762mc_di","bounds":{"$type":"dc:Bounds","x":440,"y":170,"width":100,"height":80,"$parent":"Activity_18762mc_di"},"bpmnElement":"Activity_1ta8n6y","$parent":"BPMNPlane_1"},{"$type":"bpmndi:BPMNShape","id":"Activity_1omaje8_di","bounds":{"$type":"dc:Bounds","x":600,"y":300,"width":100,"height":80,"$parent":"Activity_1omaje8_di"},"bpmnElement":"Activity_0ji9jev","$parent":"BPMNPlane_1"},{"$type":"bpmndi:BPMNEdge","id":"Flow_0sp25wg_di","waypoint":[{"$type":"dc:Point","x":388,"y":210,"$parent":"Flow_0sp25wg_di"},{"$type":"dc:Point","x":440,"y":210,"$parent":"Flow_0sp25wg_di"}],"bpmnElement":"Flow_0sp25wg","$parent":"BPMNPlane_1"},{"$type":"bpmndi:BPMNEdge","id":"Flow_03dbjwz_di","waypoint":[{"$type":"dc:Point","x":540,"y":210,"$parent":"Flow_03dbjwz_di"},{"$type":"dc:Point","x":570,"y":210,"$parent":"Flow_03dbjwz_di"},{"$type":"dc:Point","x":570,"y":340,"$parent":"Flow_03dbjwz_di"},{"$type":"dc:Point","x":600,"y":340,"$parent":"Flow_03dbjwz_di"}],"bpmnElement":"Flow_03dbjwz","$parent":"BPMNPlane_1"},{"$type":"bpmndi:BPMNEdge","id":"Flow_182335x_di","waypoint":[{"$type":"dc:Point","x":700,"y":340,"$parent":"Flow_182335x_di"},{"$type":"dc:Point","x":762,"y":340,"$parent":"Flow_182335x_di"}],"bpmnElement":"Flow_182335x","$parent":"BPMNPlane_1"}],"bpmnElement":"Collaboration_1tj7ei2","$parent":"BPMNDiagram_1"},"$parent":"sample-diagram"}]}`;
            // this.projectName = this.processDefinition.name;
            // this.definitionChangeCount++;
            const value = await this.getData(path, { key: "id" });
            if (value) {
                if (this.$route.params && this.$route.params.id) {
                    this.processDefinition = partialParse(value.model);
                    if (!this.processDefinition) {
                        this.processDefinition = [];
                    } else {
                        this.bpmn = this.createBpmnXml(this.processDefinition);
                        // this.bpmn = `{"$type":"bpmn:Definitions","id":"sample-diagram","targetNamespace":"http://bpmn.io/schema/bpmn","rootElements":[{"$type":"bpmn:Collaboration","id":"Collaboration_1tj7ei2","participants":[{"$type":"bpmn:Participant","id":"Participant_1eqhejj","$parent":"Collaboration_1tj7ei2"}],"$parent":"sample-diagram"},{"$type":"bpmn:Process","id":"Process_1","isExecutable":false,"laneSets":[{"$type":"bpmn:LaneSet","id":"LaneSet_1g2nbpc","lanes":[{"$type":"bpmn:Lane","id":"Lane_0wneims","name":"Woker","$parent":"LaneSet_1g2nbpc"},{"$type":"bpmn:Lane","id":"Lane_1lf58ly","name":"HR","$parent":"LaneSet_1g2nbpc"}],"$parent":"Process_1"}],"flowElements":[{"$type":"bpmn:StartEvent","id":"StartEvent_1","name":"시작","eventDefinitions":[],"$parent":"Process_1"},{"$type":"bpmn:SequenceFlow","id":"Flow_0sp25wg","$parent":"Process_1","sourceRef":"StartEvent_1","targetRef":"Activity_1ta8n6y"},{"$type":"bpmn:SequenceFlow","id":"Flow_03dbjwz","$parent":"Process_1","sourceRef":"Activity_1ta8n6y","targetRef":"Activity_0ji9jev"},{"$type":"bpmn:EndEvent","id":"Event_0h4j724","name":"종료","eventDefinitions":[],"$parent":"Process_1"},{"$type":"bpmn:SequenceFlow","id":"Flow_182335x","$parent":"Process_1","sourceRef":"Activity_0ji9jev","targetRef":"Event_0h4j724"},{"$type":"bpmn:UserTask","id":"Activity_1ta8n6y","name":"휴가 신청","documentation":[{"$type":"bpmn:Documentation","text":"Vacation","$parent":"Activity_1ta8n6y"}],"$parent":"Process_1"},{"$type":"bpmn:UserTask","id":"Activity_0ji9jev","name":"승인","documentation":[{"$type":"bpmn:Documentation","text":"confirm","$parent":"Activity_0ji9jev"}],"$parent":"Process_1"}],"$parent":"sample-diagram"}],"diagrams":[{"$type":"bpmndi:BPMNDiagram","id":"BPMNDiagram_1","plane":{"$type":"bpmndi:BPMNPlane","id":"BPMNPlane_1","planeElement":[{"$type":"bpmndi:BPMNShape","id":"Participant_1eqhejj_di","isHorizontal":true,"bounds":{"$type":"dc:Bounds","x":270,"y":150,"width":600,"height":250,"$parent":"Participant_1eqhejj_di"},"bpmnElement":"Participant_1eqhejj","$parent":"BPMNPlane_1"},{"$type":"bpmndi:BPMNShape","id":"Lane_1lf58ly_di","isHorizontal":true,"bounds":{"$type":"dc:Bounds","x":300,"y":275,"width":570,"height":125,"$parent":"Lane_1lf58ly_di"},"label":{"$type":"bpmndi:BPMNLabel","$parent":"Lane_1lf58ly_di"},"bpmnElement":"Lane_1lf58ly","$parent":"BPMNPlane_1"},{"$type":"bpmndi:BPMNShape","id":"Lane_0wneims_di","isHorizontal":true,"bounds":{"$type":"dc:Bounds","x":300,"y":150,"width":570,"height":125,"$parent":"Lane_0wneims_di"},"label":{"$type":"bpmndi:BPMNLabel","$parent":"Lane_0wneims_di"},"bpmnElement":"Lane_0wneims","$parent":"BPMNPlane_1"},{"$type":"bpmndi:BPMNShape","id":"_BPMNShape_StartEvent_2","bounds":{"$type":"dc:Bounds","x":352,"y":192,"width":36,"height":36,"$parent":"_BPMNShape_StartEvent_2"},"label":{"$type":"bpmndi:BPMNLabel","bounds":{"$type":"dc:Bounds","x":361,"y":235,"width":20,"height":14},"$parent":"_BPMNShape_StartEvent_2"},"bpmnElement":"StartEvent_1","$parent":"BPMNPlane_1"},{"$type":"bpmndi:BPMNShape","id":"Event_0h4j724_di","bounds":{"$type":"dc:Bounds","x":762,"y":322,"width":36,"height":36,"$parent":"Event_0h4j724_di"},"label":{"$type":"bpmndi:BPMNLabel","bounds":{"$type":"dc:Bounds","x":770,"y":365,"width":20,"height":14},"$parent":"Event_0h4j724_di"},"bpmnElement":"Event_0h4j724","$parent":"BPMNPlane_1"},{"$type":"bpmndi:BPMNShape","id":"Activity_18762mc_di","bounds":{"$type":"dc:Bounds","x":440,"y":170,"width":100,"height":80,"$parent":"Activity_18762mc_di"},"bpmnElement":"Activity_1ta8n6y","$parent":"BPMNPlane_1"},{"$type":"bpmndi:BPMNShape","id":"Activity_1omaje8_di","bounds":{"$type":"dc:Bounds","x":600,"y":300,"width":100,"height":80,"$parent":"Activity_1omaje8_di"},"bpmnElement":"Activity_0ji9jev","$parent":"BPMNPlane_1"},{"$type":"bpmndi:BPMNEdge","id":"Flow_0sp25wg_di","waypoint":[{"$type":"dc:Point","x":388,"y":210,"$parent":"Flow_0sp25wg_di"},{"$type":"dc:Point","x":440,"y":210,"$parent":"Flow_0sp25wg_di"}],"bpmnElement":"Flow_0sp25wg","$parent":"BPMNPlane_1"},{"$type":"bpmndi:BPMNEdge","id":"Flow_03dbjwz_di","waypoint":[{"$type":"dc:Point","x":540,"y":210,"$parent":"Flow_03dbjwz_di"},{"$type":"dc:Point","x":570,"y":210,"$parent":"Flow_03dbjwz_di"},{"$type":"dc:Point","x":570,"y":340,"$parent":"Flow_03dbjwz_di"},{"$type":"dc:Point","x":600,"y":340,"$parent":"Flow_03dbjwz_di"}],"bpmnElement":"Flow_03dbjwz","$parent":"BPMNPlane_1"},{"$type":"bpmndi:BPMNEdge","id":"Flow_182335x_di","waypoint":[{"$type":"dc:Point","x":700,"y":340,"$parent":"Flow_182335x_di"},{"$type":"dc:Point","x":762,"y":340,"$parent":"Flow_182335x_di"}],"bpmnElement":"Flow_182335x","$parent":"BPMNPlane_1"}],"bpmnElement":"Collaboration_1tj7ei2","$parent":"BPMNDiagram_1"},"$parent":"sample-diagram"}]}`;
                        this.projectName = this.processDefinition.name;
                        this.definitionChangeCount++;
                    }
                }
            }
        },

        beforeSendMessage(newMessage) {
            this.sendMessage(newMessage);
        },

        afterModelCreated(response) {
            let jsonProcess
            try {
                jsonProcess = this.extractJSON(response);

                if (jsonProcess) {
                    let unknown = partialParse(jsonProcess);
                    if (unknown.modifications) {
                        //means process modification
                        unknown.modifications.forEach((modification) => {
                            if (modification.action == 'replace') {
                                this.jsonPathReplace(this.processDefinition, modification.targetJsonPath, modification.value);
                                this.bpmn = this.createBpmnXml(this.processDefinition);
                            } else if (modification.action == 'add') {
                                this.jsonPathAdd(this.processDefinition, modification.targetJsonPath, modification.value);
                                this.bpmn = this.createBpmnXml(this.processDefinition);
                            } else if (modification.action == 'delete') {
                                this.jsonPathDelete(this.processDefinition, modification.targetJsonPath);
                                this.bpmn = this.createBpmnXml(this.processDefinition);
                            }
                        });
                    } else if (unknown.processDefinitionId) {
                        this.processDefinition = unknown;
                        this.bpmn = this.createBpmnXml(this.processDefinition);
                    }
                    this.definitionChangeCount++;
                }
            } catch (error) {
                console.log(jsonProcess)
                console.log(error);
            }
        },

        afterGenerationFinished(response) {
            let modelText = '';
            let path = this.path;
            let putObj = {
                id: this.processDefinition.processDefinitionId,
                name: this.processDefinition.processDefinitionName,
                definition: this.processDefinition
            };

            if (this.processDefinition) {
                path = `${this.path}/${this.processDefinition.processDefinitionId}`;

                modelText = JSON.stringify(this.processDefinition);
                this.saveDefinition(this.processDefinition);
                putObj.model = modelText;
                // this.putObject(`models/${this.processDefinition.processDefinitionId}`, { name: this.projectName, model: this.model });
                this.putObject(path, putObj);
                // this.saveDefinitionMap(putObj);
            }
        },
        // async saveDefinitionMap(obj) {
        //     if (this.processDefinition) {
        //         var megaProcessId = this.processDefinition.megaProcessId;
        //         var majorProcessId = this.processDefinition.majorProcessId;

        //         this.processDefinitionMap = await this.getData(this.path);
        //         if (this.processDefinitionMap && this.processDefinitionMap.megaProcess) {
        //             const megaProcesses = Object.values(this.processDefinitionMap.megaProcess);
        //             console.log(megaProcesses);
        //             megaProcesses.forEach((mega, megaIdx) => {
        //                 if (mega.id == megaProcessId && mega.majorProcess) {
        //                     mega.majorProcess.forEach((major, majorIdx) => {
        //                         if (major.id == majorProcessId) {
        //                         }
        //                     });
        //                 }
        //             });
        //         }

        //         if (path.includes('subProcess')) {
        //             obj.id = this.processDefinition.processDefinitionId;
        //             obj.name = this.processDefinition.processDefinitionName;
        //             this.pushObject(path, obj);
        //         }
        //     }
        // },
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
                let path = `proc_def/${this.changedModel.definitionId ? this.changedModel.definitionId : this.$route.params.id}/model`;
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
        createBpmnXml(jsonModel) {
            // XML 문서 초기화

            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString('<?xml version="1.0" encoding="UTF-8"?><bpmn2:definitions xmlns:bpmn2="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI"></bpmn2:definitions>', 'application/xml');
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
                    process.appendChild(sequenceFlow);

                    outGoing[sequence.source] = 'SequenceFlow_' + sequence.source + '_' + sequence.target
                    inComing[sequence.target] = 'SequenceFlow_' + sequence.source + '_' + sequence.target
                });

            // Activities 생성
            if (jsonModel.activities)
                jsonModel.activities.forEach((activity, idx) => {
                    const userTask = xmlDoc.createElementNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmn2:userTask');
                    userTask.setAttribute('id', activity.id);
                    userTask.setAttribute('name', activity.name);
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

<style scoped></style>
