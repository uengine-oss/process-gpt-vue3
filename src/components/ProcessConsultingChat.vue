<template>
    <v-card elevation="10">
        <v-card>
            <v-card-title style="height: 55px; background-color: rgb(227, 240, 250); align-content: center;">
                <v-icon small style="margin-right: 10px;">mdi-auto-fix</v-icon>
                Process Consulting AI
                <v-icon @click="closeDialog()" small style="margin-right: 5px; float: right;">mdi-close</v-icon>
            </v-card-title>
            <div :key="chatRenderKey">
                <div style="display: none;">
                    <process-definition
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
                <div style="position: relative;">
                    <canvas v-if="initConfettiCnt < 2" ref="canvas" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 1;"></canvas>
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
                    ></Chat>
                </div>
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
// import partialParse from "partial-json-parser";
import { VectorStorage } from "vector-storage";
import ProcessDefinitionModule from './ProcessDefinitionModule.vue';
import ProcessDefinition from '@/components/ProcessDefinition.vue';
import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();

export default {
    mixins: [ChatModule, ProcessDefinitionModule],
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
        processDefinitionMap: null,

        // confetti
        initConfettiCnt: 0,
        canvas: null,
        ctx: null,
        confetti: [],
        confettiCount: 300,
        gravity: 0.5,
        terminalVelocity: 5,
        drag: 0.075,
        colors: [
            { front: 'red', back: 'darkred' },
            { front: 'green', back: 'darkgreen' },
            { front: 'blue', back: 'darkblue' },
            { front: 'yellow', back: 'darkyellow' },
            { front: 'orange', back: 'darkorange' },
            { front: 'pink', back: 'darkpink' },
            { front: 'purple', back: 'darkpurple' },
            { front: 'turquoise', back: 'darkturquoise' }
        ],
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

        this.processDefinitionMap = await backend.getProcessDefinitionMap();

//      let res = {
//     "megaProcessId": "MEGA_1",
//     "majorProcessId": "Major_1.1",
//     "processDefinitionName": "주문 처리 자동화 프로세스 03",
//     "processDefinitionId": "order_processing_automation_03",
//     "description": "이 프로세스는 의류 판매 주문의 재고 확인, 주문 수락/취소, 발송 신청 단계를 자동화합니다.",
//     "data": [
//         {
//             "name": "Order ID",
//             "description": "주문 번호",
//             "type": "Text"
//         },
//         {
//             "name": "Product ID",
//             "description": "상품 번호",
//             "type": "Text"
//         },
//         {
//             "name": "Customer Info",
//             "description": "고객 정보",
//             "type": "Text"
//         }
//     ],
//     "roles": [
//         {
//             "name": "Inventory Manager",
//             "resolutionRule": "재고 관리를 담당하는 사용자"
//         },
//         {
//             "name": "Shipping Manager",
//             "resolutionRule": "배송 관리를 담당하는 사용자"
//         }
//     ],
//     "events": [
//         {
//             "id": "start_event",
//             "name": "Start Event",
//             "type": "StartEvent",
//             "description": "주문 접수 시작 이벤트",
//             "trigger": ""
//         },
//         {
//             "id": "end_event",
//             "name": "End Event",
//             "type": "EndEvent",
//             "description": "주문 처리 종료 이벤트",
//             "trigger": ""
//         }
//     ],
//     "activities": [
//         {
//             "id": "email_filter",
//             "name": "Email Filter",
//             "type": "ScriptActivity",
//             "description": "주문 이메일을 특정 폴더로 필터링",
//             "instruction": "이메일 클라이언트에서 주문 이메일을 특정 폴더로 자동 정렬합니다.",
//             "role": "Inventory Manager",
//             "inputData": [
//                 "Order ID",
//                 "Product ID"
//             ],
//             "outputData": [],
//             "checkpoints": []
//         },
//         {
//             "id": "stock_check",
//             "name": "Stock Check",
//             "type": "ScriptActivity",
//             "description": "엑셀 문서에서 재고 확인",
//             "instruction": "엑셀 문서에서 상품 번호를 기준으로 자동 재고 확인 스크립트를 실행합니다.",
//             "role": "Inventory Manager",
//             "inputData": [
//                 "Product ID"
//             ],
//             "outputData": [],
//             "checkpoints": []
//         },
//         {
//             "id": "accept_order",
//             "name": "Accept Order",
//             "type": "EMailActivity",
//             "description": "주문 수락 이메일 발송",
//             "instruction": "주문 수락 이메일을 고객에게 자동으로 발송합니다.",
//             "role": "Shipping Manager",
//             "inputData": [
//                 "Customer Info"
//             ],
//             "outputData": [],
//             "checkpoints": []
//         },
//         {
//             "id": "decline_order",
//             "name": "Decline Order",
//             "type": "EMailActivity",
//             "description": "주문 취소 이메일 발송",
//             "instruction": "주문 취소 이메일을 고객에게 자동으로 발송합니다.",
//             "role": "Shipping Manager",
//             "inputData": [
//                 "Customer Info"
//             ],
//             "outputData": [],
//             "checkpoints": []
//         },
//         {
//             "id": "shipping_request",
//             "name": "Shipping Request",
//             "type": "EMailActivity",
//             "description": "배송 신청 이메일 발송",
//             "instruction": "택배 회사에 발송 신청 이메일을 자동으로 보냅니다.",
//             "role": "Shipping Manager",
//             "inputData": [],
//             "outputData": [],
//             "checkpoints": []
//         }
//     ],
//     "gateways": [
//         {
//             "id": "stock_check_gateway",
//             "name": "Stock Check Gateway",
//             "type": "ExclusiveGateway",
//             "description": "재고 유무에 따른 주문 수락/취소 결정",
//             "condition": "재고가 있을 경우 주문 수락, 없을 경우 주문 취소",
//             "role": "Inventory Manager"
//         }
//     ],
//     "sequences": [
//         {
//             "source": "start_event",
//             "target": "email_filter",
//             "condition": ""
//         },
//         {
//             "source": "email_filter",
//             "target": "stock_check",
//             "condition": ""
//         },
//         {
//             "source": "stock_check",
//             "target": "stock_check_gateway",
//             "condition": ""
//         },
//         {
//             "source": "stock_check_gateway",
//             "target": "accept_order",
//             "condition": "재고가 있을 경우"
//         },
//         {
//             "source": "stock_check_gateway",
//             "target": "decline_order",
//             "condition": "재고가 없을 경우"
//         },
//         {
//             "source": "accept_order",
//             "target": "shipping_request",
//             "condition": ""
//         },
//         {
//             "source": "shipping_request",
//             "target": "end_event",
//             "condition": ""
//         },
//         {
//             "source": "decline_order",
//             "target": "end_event",
//             "condition": ""
//         }
//     ]
// }
//         this.bpmn = this.createBpmnXml(res); 
//         this.definitionChangeCount++;
//         this.saveDefinition({
//             "arcv_id": `${res.processDefinitionId}_0.1`,
//             "name": res.processDefinitionName,
//             "prevDiff": null,
//             "prevSnapshot": null,
//             "proc_def_id": res.processDefinitionId,
//             "type": "bpmn",
//             "version": "0.1"
//         }); 
//         this.$emit("createdBPMN", res)

        this.messages.push({
            "role": "system",
            "content": `안녕하세요! ${this.userInfo.name}님의 프로세스에 어떤 문제 또는 어떤 부분을 자동화하고 싶으신지 말씀해주시면 도와드리겠습니다!`,
            "timeStamp": Date.now(),
        })
    },
    methods: {
        closeDialog(){
            this.$emit('closeConsultingDialog')
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
                    let jsonData = this.extractJSON(response);
                    if(jsonData && jsonData.includes('{')){
                        jsonData = JSON.parse(jsonData);
                        if(jsonData.queryFor != 'customer'){
                            this.messages[this.messages.length - 1].disableMsg = true
                        }
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
                    this.bpmn = this.createBpmnXml(response); 
                    this.definitionChangeCount++;
                    this.saveDefinition({
                        "arcv_id": `${response.processDefinitionId}_0.1`,
                        "name": response.processDefinitionName,
                        "prevDiff": null,
                        "prevSnapshot": null,
                        "proc_def_id": response.processDefinitionId,
                        "type": "bpmn",
                        "version": "0.1"
                    }); 
                    this.$emit("createdBPMN", response)
                    content = `요청하신 "${response.processDefinitionName}" 프로세스 정의를 생성했습니다. 생성된 BPMN 모델은 프로세스 정의 체계도 화면에서 확인하실 수 있습니다.`
                    this.waitForCustomer = true
                    this.initConfetti();
                    this.render();
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
        randomRange(min, max) {
            return Math.random() * (max - min) + min;
        },
        initConfetti() {
            this.canvas = this.$refs.canvas;
            this.ctx = this.canvas.getContext('2d');

            for (let i = 0; i < this.confettiCount; i++) {
                this.confetti.push({
                    color: this.colors[Math.floor(this.randomRange(0, this.colors.length))],
                    dimensions: { x: this.randomRange(10, 20), y: this.randomRange(10, 30) },
                    position: { x: this.randomRange(0, this.canvas.width), y: this.canvas.height - 1 },
                    rotation: this.randomRange(0, 2 * Math.PI),
                    scale: { x: 1, y: 1 },
                    velocity: { x: this.randomRange(-25, 25), y: this.randomRange(0, -50) }
                });
            }
            this.initConfettiCnt++;
        },
        render() {
            this.canvas.width = 1390;
            this.canvas.height = 880;
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

            this.confetti.forEach((confetto, index) => {
                let width = confetto.dimensions.x * confetto.scale.x;
                let height = confetto.dimensions.y * confetto.scale.y;

                this.ctx.translate(confetto.position.x, confetto.position.y);
                this.ctx.rotate(confetto.rotation);

                confetto.velocity.x -= confetto.velocity.x * this.drag;
                confetto.velocity.y = Math.min(confetto.velocity.y + this.gravity, this.terminalVelocity);
                confetto.velocity.x += Math.random() > 0.5 ? Math.random() : -Math.random();

                confetto.position.x += confetto.velocity.x;
                confetto.position.y += confetto.velocity.y;

                if (confetto.position.y >= this.canvas.height) this.confetti.splice(index, 1);
                if (confetto.position.x > this.canvas.width) confetto.position.x = 0;
                if (confetto.position.x < 0) confetto.position.x = this.canvas.width;

                confetto.scale.y = Math.cos(confetto.position.y * 0.1);
                this.ctx.fillStyle = confetto.scale.y > 0 ? confetto.color.front : confetto.color.back;

                this.ctx.fillRect(-width / 2, -height / 2, width, height);
                this.ctx.setTransform(1, 0, 0, 1, 0, 0);
            });

            if (this.confetti.length <= 10 && this.initConfettiCnt < 2) this.initConfetti();

            window.requestAnimationFrame(this.render);
        },
    }
}
</script>
