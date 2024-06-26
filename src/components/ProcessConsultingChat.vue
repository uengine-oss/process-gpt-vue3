<template>
    <v-card elevation="10">
        <v-card>
            <v-card-title style="height: 55px; background-color: rgb(227, 240, 250); align-content: center;">
                <v-btn v-if="showBPMN" style="margin-right: 10px; margin-top: -4px;" icon @click="showBPMN = false">
                    <v-icon>mdi-arrow-left</v-icon>
                </v-btn>
                <v-icon small style="margin-right: 10px;">mdi-auto-fix</v-icon>
                Process Consulting AI
                <v-icon @click="closeDialog()" small style="margin-right: 5px; float: right;">mdi-close</v-icon>
            </v-card-title>
            <div style="height: 1000px;" v-if="showBPMN">
                <process-definition
                    v-if="bpmn"
                    class="process-definition-resize"
                    :bpmn="bpmn"
                    :key="definitionChangeCount"
                    :isViewMode="isViewMode"
                    :isXmlMode="isXmlMode"
                    :definitionPath="fullPath"
                    :definitionChat="this"
                    @update="updateDefinition"
                ></process-definition>
            </div>
            <div v-else :key="chatRenderKey">
                <Chat
                    :messages="messages"
                    :userInfo="userInfo"
                    :agentInfo="agentInfo"
                    :type="'consulting'"
                    :ProcessGPTActive="ProcessGPTActive"
                    @requestDraftAgent="requestDraftAgent"
                    @requestFile="requestFile"
                    @beforeReply="beforeReply"
                    @sendMessage="beforeSendMessage"
                    @startProcess="startProcess"
                    @cancelProcess="cancelProcess"
                    @deleteWorkList="deleteWorkList"
                    @deleteAllWorkList="deleteAllWorkList"
                    @sendEditedMessage="sendEditedMessage"
                    @stopMessage="stopMessage"
                    @toggleProcessGPTActive="toggleProcessGPTActive"
                    @showBPMN="changeShowMode"
                ></Chat>
            </div>
        </v-card>
    </v-card>
</template>

<script>
import ChatModule from "@/components/ChatModule.vue";
import ConsultingGenerator from "@/components/ai/ProcessConsultingGenerator.js";
import ConsultingMentoGenerator from "@/components/ai/ProcessConsultingMentoGenerator.js";
import AppBaseCard from '@/components/shared/AppBaseCard.vue';
import Chat from "@/components/ui/Chat.vue";
import axios from 'axios';
import partialParse from "partial-json-parser";
import { VectorStorage } from "vector-storage";
import ProcessDefinitionChat from "./ProcessDefinitionChat.vue";
import ProcessDefinition from '@/components/ProcessDefinition.vue';


export default {
    mixins: [ChatModule],
    name: 'Chats',
    components: {
        Chat,
        AppBaseCard,
        ProcessDefinition
    },
    data: () => ({
        chatRenderKey: 0,
        isMentoMode: false,
        waitForCustomer: false,
        bpmn: null,
        definitionChangeCount: 0,
        showBPMN: false,
    }),
    computed: {},
    watch: {},  
    async created() {
        this.init();
        this.generator = new ConsultingGenerator(this, {
            isStream: true,
            preferredLanguage: "Korean"
        });

        this.userInfo = await this.storage.getUserInfo();

        this.EventBus.on('messages-updated', () => {
            this.chatRenderKey++;
        });

        // this.bpmn = ProcessDefinitionChat.methods.createBpmnXml(JSON.parse('{"megaProcessId":"","majorProcessId":"","processDefinitionName":"주문 처리 자동화 프로세스","processDefinitionId":"OrderProcessingAutomation","description":"주문 확인부터 발송까지 자동화된 주문 처리 프로세스","data":[{"name":"orderDetails","description":"주문 세부 사항","type":"Document"},{"name":"inventoryStatus","description":"재고 상태","type":"Boolean"},{"name":"customerEmail","description":"고객 이메일","type":"Text"}],"roles":[{"name":"system","resolutionRule":"자동화 시스템 역할"}],"events":[{"id":"startEvent","name":"주문 시작 이벤트","type":"StartEvent","description":"주문이 들어오면 시작 이벤트 발생"},{"id":"endEvent","name":"주문 완료 이벤트","type":"EndEvent","description":"주문 처리 완료"}],"activities":[{"id":"sendEmail","name":"이메일 알림 발송","type":"UserActivity","description":"고객에게 주문 확인 이메일 발송","instruction":"고객에게 주문 확인 이메일을 발송하세요","role":"system","inputData":["orderDetails","customerEmail"],"outputData":["customerEmail"],"checkpoints":[]},{"id":"checkInventory","name":"재고 확인","type":"UserActivity","description":"주문 상품 재고를 확인","instruction":"주문 상품의 재고를 확인하세요","role":"system","inputData":["orderDetails"],"outputData":["inventoryStatus"],"checkpoints":[]},{"id":"orderCancelNotification","name":"주문 취소 알림","type":"UserActivity","description":"재고가 없을 시 고객에게 주문 취소 이메일 발송","instruction":"재고가 없을 경우 고객에게 주문 취소 이메일을 발송하세요","role":"system","inputData":["customerEmail"],"outputData":[],"checkpoints":[]},{"id":"requestShipment","name":"자동 발송 신청","type":"UserActivity","description":"택배회사로 자동 발송 신청","instruction":"택배회사로 자동 발송 신청을 진행","role":"system","inputData":["orderDetails"],"outputData":[],"checkpoints":[]},{"id":"shipmentNotification","name":"택배 발송 알림","type":"UserActivity","description":"고객에게 택배 발송 알림 이메일 발송","instruction":"고객에게 택배 발송 알림 이메일을 발송","role":"system","inputData":["customerEmail"],"outputData":[],"checkpoints":[]}],"gateways":[{"id":"inventoryCheckGateway","name":"재고 확인 게이트웨이","type":"ExclusiveGateway","description":"재고 상태에 따라 프로세스를 분기","condition":"inventoryStatus","role":"system"}],"sequences":[{"source":"startEvent","target":"sendEmail","condition":""},{"source":"sendEmail","target":"checkInventory","condition":""},{"source":"checkInventory","target":"inventoryCheckGateway","condition":""},{"source":"inventoryCheckGateway","target":"orderCancelNotification","condition":"inventoryStatus == false"},{"source":"inventoryCheckGateway","target":"requestShipment","condition":"inventoryStatus == true"},{"source":"requestShipment","target":"shipmentNotification","condition":""},{"source":"shipmentNotification","target":"endEvent","condition":""},{"source":"orderCancelNotification","target":"endEvent","condition":""}]}')); 
        this.messages.push({
            "role": "system",
            "content": `안녕하세요! ${this.userInfo.name}님의 프로세스에 어떤 문제 또는 어떤 부분을 자동화하고 싶으신지 말씀해주시면 도와드리겠습니다!`,
            "timeStamp": Date.now(),
            // "bpmn": true
        })
    },
    methods: {
        closeDialog(){
            this.$emit('closeConsultingDialog')
        },
        changeShowMode(){
            this.showBPMN = true
        },
        async beforeSendMessage(newMessage) {
            if (newMessage && (newMessage.text != '' || newMessage.image != null)) {
                this.waitForCustomer = false
                newMessage.callType = 'consulting'
                this.sendMessage(newMessage);
            }
        },

        afterModelCreated(response) {
            // if(response.includes('"megaProcessId":')){
            //     let jsonProcess;
            //     try {
            //         jsonProcess = this.extractJSON(response);
    
            //         if (jsonProcess) {
            //             let unknown = partialParse(jsonProcess);
            //             if (unknown.processDefinitionId) {
            //                 // this.processDefinition = unknown; 
            //                 this.bpmn = this.createBpmnXml(unknown);
            //                 this.definitionChangeCount++;
            //             }
            //         }
            //     } catch (error) {
            //         console.log(jsonProcess);
            //         console.log(error);
            //     }
            // }
            if(this.isMentoMode){
                this.messages[this.messages.length - 1].disableMsg = true
            } else {
                if(response.includes('"queryFor"')){
                    let paringRes = partialParse(response)
                    if(paringRes.queryFor != 'customer'){
                        this.messages[this.messages.length - 1].disableMsg = true
                    }
                }
            }
        },
        afterModelStopped(response) {},
        async afterGenerationFinished(response) {
            console.log(response)
            let content
            if(this.isMentoMode){
                content = response
            } else {
                if(response.queryFor == 'customer'){
                    this.waitForCustomer = true
                }
                if(response.processDefinitionId){
                    this.bpmn = ProcessDefinitionChat.methods.createBpmnXml(response); 
                    this.messages[this.messages.length - 1].bpmn = true
                    content = '요청하신 프로세스 정의를 생성했습니다.'
                    this.waitForCustomer = true
                } else {
                    content = response.content
                }
            }

            this.messages[this.messages.length - 1].content = content

            if(!this.waitForCustomer){
                if(this.isMentoMode){
                    this.generator = new ConsultingGenerator(this, {
                        isStream: true,
                        preferredLanguage: "Korean"
                    });
                    this.isMentoMode = false
                } else {
                    this.generator = new ConsultingMentoGenerator(this, {
                        isStream: true,
                        preferredLanguage: "Korean"
                    });
                    this.isMentoMode = true
                }
                let chatMsgs = [];
                if (this.messages && this.messages.length > 0) {
                    this.messages.forEach((msg) => {
                        if (msg.content) {
                            chatMsgs.push({
                                role: msg.role,
                                content: msg.content
                            });
                        }
                    });
                }
    
                if(this.generator){
                    this.generator.model = "gpt-4o";
                }
                this.generator.previousMessages = [this.generator.previousMessages[0], ...chatMsgs];
                if(!this.isMentoMode){
                    this.setPrompt('consulting')
                }
                this.startGenerate();
            }
        },

    }
}
</script>
