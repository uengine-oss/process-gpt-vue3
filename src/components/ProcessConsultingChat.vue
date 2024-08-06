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
                    <canvas v-if="showConfetti && initConfettiCnt < 2" ref="canvas" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 1;"></canvas>
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
        showConfetti: false,
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

        this.messages.push({
            "role": "system",
            "content": `${this.userInfo.name}님 안녕하세요! 어떤 업무에 어떤 문제를 겪고 계신가요? 말씀해주시면 도와드리겠습니다!`,
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
                    this.showConfetti = false
                    this.initConfettiCnt = 0
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
                                content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
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
            this.showConfetti = true
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
