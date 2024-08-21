<template>
    <v-card elevation="10">
        <v-card v-if="ProcessPreviewMode" class="process-consulting-chat-layout-card">
            <v-card-title style="height: 55px; background-color: rgb(227, 240, 250); display: flex; align-items: center; justify-content: space-between;">
                <div style="display: flex; align-items: center;">
                    <v-icon small style="margin-right: 10px;">mdi-auto-fix</v-icon>
                    Process Preview
                </div>
                <!-- <div style="flex: 1; text-align: center;">현재 단계: {{ currentStep }}</div> -->
                <div>
                    <v-btn @click="prevStep" small :disabled="currentStepIndex === 0" style="margin-right: 5px;">이전 단계</v-btn>
                    <v-btn @click="nextStep" :disabled="currentStepIndex === stepIds.length - 1" small>다음 단계</v-btn>
                    <v-btn style="margin-left: 15px;" :disabled="!isChanged" :color="isChanged ? 'primary':''" @click="saveDef()" small>저장</v-btn>
                    <v-icon @click="closeDialog()" small style="margin-left: 10px;">mdi-close</v-icon>
                </div>
            </v-card-title>
            <div :key="chatRenderKey" style="display: flex; flex-direction: column; height: 100%; margin-bottom: 10px;">
                <div style="display: flex; flex: 1; margin-bottom: 10px;">
                    <div style="flex: 0 0 60%; margin-right: 10px;">
                        <process-definition
                            class="process-definition-resize"
                            :bpmn="bpmn"
                            :key="definitionChangeCount"
                            :isViewMode="true"
                            :isXmlMode="isXmlMode"
                            :definitionPath="fullPath"
                            :definitionChat="this"
                            :currentActivities="currentStepId"
                            @update="updateDefinition"
                        ></process-definition>
                    </div>
                    <div style="flex: 0 0 40%; display: flex; flex-direction: column;">
                        <v-card elevation="1" style="flex: 0 0 60%; margin-bottom: 10px; display: flex; align-items: center; justify-content: center; width: 98%; margin-top: 5px;">
                            <FormWorkItem 
                                :key="definitionChangeCount" 
                                :formId="currentFormId"
                                :isPreviewMode="true" 
                                :currentFormData="currentFormData"
                            />
                        </v-card>
                        <v-card class="process-consulting-chat-components" elevation="1" style="flex: 0 0 40%; display: flex; flex-direction: column; width: 98%;">
                            <Chat
                                :messages="messages"
                                :userInfo="userInfo"
                                :agentInfo="agentInfo"
                                :type="'preview'"
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
                        </v-card>
                    </div>
                </div>
            </div>
        </v-card>
        <v-card v-else>
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
                        :isViewMode="true"
                        :isXmlMode="isXmlMode"
                        :definitionPath="fullPath"
                        :definitionChat="this"
                        @update="updateDefinition"
                    ></process-definition>
                </div>
                <div style="position: relative;">
                    <!-- <canvas v-if="initConfettiCnt < 2" ref="canvas" :style="showConfetti ? 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 1;':'display: none;'"></canvas> -->
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
import FormWorkItem from './apps/todolist/FormWorkItem.vue';
import { useBpmnStore } from '@/stores/bpmn';
import ChatModule from "@/components/ChatModule.vue";
import ConsultingGenerator from "@/components/ai/ProcessConsultingGenerator.js";
import FormDesignGenerator from "@/components/ai/FormDesignGenerator.js";
import ProcessDefinitionGenerator from "@/components/ai/ProcessDefinitionGenerator.js";
import ConsultingMentoGenerator from "@/components/ai/ProcessConsultingMentoGenerator.js";
import ProcessPreviewGenerator from "@/components/ai/ProcessPreviewGenerator.js";
import AppBaseCard from '@/components/shared/AppBaseCard.vue';
import Chat from "@/components/ui/Chat.vue";
import axios from 'axios';
import partialParse from "partial-json-parser";
import { VectorStorage } from "vector-storage";
import ProcessDefinitionModule from './ProcessDefinitionModule.vue';
import ProcessDefinition from '@/components/ProcessDefinition.vue';
import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();

export default {
    mixins: [ChatModule, ProcessDefinitionModule],
    name: 'ProcessConsultingChat',
    components: {
        Chat,
        AppBaseCard,
        ProcessDefinition,
        FormWorkItem
    },
    props: {
        ProcessPreviewMode: Boolean,
        proc_bpmn: String
    },
    data: () => ({
        chatRenderKey: 0,
        isMentoMode: false,
        waitForCustomer: false,
        processDefinitionMap: null,
        stepIds: [],
        currentStepId: [],
        currentStepIndex: 0,
        isPreviewMode: false,
        currentFormId: null,
        isChanged: false,
        currentFormData: null,
        editMode: null,

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
        this.isConsultingMode = true
        this.userInfo = await this.storage.getUserInfo();

        this.processDefinitionMap = await backend.getProcessDefinitionMap();

        this.messages.push({
            "role": "system",
            "content": `${this.userInfo.name}님 안녕하세요! 어떤 업무에 어떤 문제를 겪고 계신가요? 말씀해주시면 도와드리겠습니다!`,
            "timeStamp": Date.now(),
        })

        if(this.proc_bpmn){
            this.messages = []
            this.$emit("openProcessPreview")
            this.bpmn = this.proc_bpmn
            this.processDefinition = await this.convertXMLToJSON(this.bpmn);
            this.definitionChangeCount++;
            this.messages.push({
                "role": "system",
                "content": `컨설팅 내용을 기반으로한 모델 생성이 완료되었습니다. 생성된 모델을 리뷰하고 필요한 부분을 추가, 개선하는 단계입니다. 개선하고자하는 부분이 있으시다면 말씀해주세요!`,
                "timeStamp": Date.now(),
            })

            this.isPreviewMode = true
            this.generator = new ProcessPreviewGenerator(this, {
                isStream: true,
                preferredLanguage: "Korean"
            });
           
            this.initializeSteps();
        } else {
            this.generator = new ConsultingGenerator(this, {
                isStream: true,
                preferredLanguage: "Korean"
            });
        }

        this.EventBus.on('messages-updated', () => {
            this.chatRenderKey++;
        });

        this.EventBus.on('html-updated', (newformData) => {
            this.currentFormData = newformData
            if(this.generator.setFormData) this.generator.setFormData(newformData);
        });

    },
    methods: {
        async saveDef(){
            await this.saveDefinition({
                "arcv_id": `${this.processDefinition.processDefinitionId}_0.1`,
                "name": this.processDefinition.processDefinitionName,
                "prevDiff": null,
                "prevSnapshot": null,
                "proc_def_id": this.processDefinition.processDefinitionId,
                "type": "bpmn",
                "version": "0.1"
            }); 
            await this.$emit("createdBPMN", this.processDefinition)
            this.isChanged = false
        },
        initializeSteps() {
            this.stepIds = this.getUniqueSequenceIds();
            this.currentStepIndex = 0;
            this.updateCurrentStepId();
        },
        prevStep() {
            if (this.currentStepIndex > 0) {
                this.currentStepIndex--;
                this.updateCurrentStepId();
            }
        },
        nextStep() {
            if (this.currentStepIndex < this.stepIds.length - 1) {
                this.currentStepIndex++;
                this.updateCurrentStepId();
            }
        },
        updateCurrentStepId() {
            this.currentStepId = [this.stepIds[this.currentStepIndex]];
            this.updateCurrentFormId()
        },
        updateCurrentFormId(){
            let currentComponent
            if(this.processDefinition && this.processDefinition.activities){
                currentComponent = this.processDefinition.activities.find(x => x.id == this.currentStepId)
                this.currentFormId = null
                if(currentComponent && currentComponent.tool){
                    this.currentFormId = currentComponent.tool.split(':')[1];
                }
                this.definitionChangeCount++;
            }
        },
        getUniqueSequenceIds() {
            return [...new Set(this.processDefinition.sequences.map(seq => seq.source))];
        },
        closeDialog(){
            this.isPreviewMode = false
            this.$emit('closeConsultingDialog')
        },
        async beforeSendMessage(newMessage) {
            if (newMessage && (newMessage.text != '' || newMessage.image != null)) {
                this.waitForCustomer = false
                if(this.isPreviewMode){
                    newMessage.callType = 'preview'
                } else {
                    newMessage.callType = 'consulting'
                }
                this.sendMessage(newMessage);
            }
        },

        afterModelCreated(response) {
            if(this.isPreviewMode){

            } else {
                if(this.isMentoMode){
                    this.messages[this.messages.length - 1].disableMsg = true
                } else {
                    try {
                        response = JSON.parse(response);
                    } catch(e){
                        try {
                            response = partialParse(response);
                        } catch(e){
                            response = this.extractJSON(response);
                            try {
                                response = JSON.parse(response);
                            } catch(e){
                                response = partialParse(response)
                            }
                        }
                    }
                    if(response){
                        if(response.processDefinitionId){
                            this.bpmn = this.createBpmnXml(response); 
                            this.definitionChangeCount++;
                            this.messages = []
                            this.messages.push({
                                "role": "system",
                                "content": `컨설팅 내용을 기반으로 모델 생성중입니다. 잠시만 기다려주세요!`,
                                "timeStamp": Date.now(),
                            })
                            this.$emit("openProcessPreview")
                        } else if(response.queryFor && response.queryFor != 'customer'){
                            this.messages[this.messages.length - 1].disableMsg = true
                        }
                    }
                }
            }
        },
        afterModelStopped(response) {},
        async afterGenerationFinished(response) {
            let content
            if(this.isPreviewMode){
                try {
                    if(this.editMode){
                        const store = useBpmnStore();
                        const modeler = store.getModeler;
                        this.isChanged = true
                        if(response.modifications){
                            if(this.editMode == 'form'){
                                let formData = await this.getModifiedPrevFormOutput(response.modifications, this.currentFormData)
                                    formData = formData.replace("<body>", "")
                                    formData = formData.replace("</body>", "")
                                    this.currentFormData = formData
                                    await this.backend.putRawDefinition(formData, this.currentFormId, { type: 'form' });
                                    this.messages[this.messages.length - 1].content = '요청하신 폼 수정이 완료되었습니다.'
                            } else {
                                for (let modification of response.modifications) {
                                    if (modification.action == 'replace') {
                                        this.jsonPathReplace(this.processDefinition, modification.targetJsonPath, modification.value);
                                        this.bpmn = this.createBpmnXml(this.processDefinition);
                                    } else if (modification.action == 'add') {
                                        this.modificationAdd(modification);
                                        this.modificationElement(modification, modeler);
                                        let xml = await modeler.saveXML({ format: true, preamble: true });
                                        this.bpmn = xml.xml;
                                    } else if (modification.action == 'delete') {
                                        this.modificationRemove(modification, modeler);
                                        let xml = await modeler.saveXML({ format: true, preamble: true });
                                        this.bpmn = xml.xml;
                                    }
                                    
                                    if(modification.messageForUser){
                                        this.messages.push({
                                            "role": "system",
                                            "content": modification.messageForUser,
                                            "timeStamp": Date.now(),
                                        })
                                    }
                                }
                            }
                        }
                        this.editMode = null
                        this.generator = new ProcessPreviewGenerator(this, {
                            isStream: true,
                            preferredLanguage: "Korean"
                        });
                        this.definitionChangeCount++;
                    } else {
                        if(this.messages[this.messages.length - 1].role == 'system'){
                            this.messages.pop()
                        }
                        if(response.type == 'form' || (typeof response == 'string' && response.includes('form'))){
                            this.editMode = 'form'
                            this.generator = new FormDesignGenerator(this, {
                                isStream: true,
                                preferredLanguage: "Korean"
                            });
                            if (this.currentFormData) {
                                this.generator.setFormData(this.currentFormData);
                            }
                        } else {
                            this.editMode = 'proc_def'
                            this.generator = new ProcessDefinitionGenerator(this, {
                                isStream: true,
                                preferredLanguage: "Korean"
                            });
                            if (this.processDefinition) {
                                this.generator.setProcessDefinition(this.processDefinition);
                            }
                        }
                        let msg = [{
                            role: this.messages[this.messages.length - 1].role,
                            content: this.messages[this.messages.length - 1].content
                        }]
                        this.generator.previousMessages = [this.generator.previousMessages[0], ...msg];
                        this.startGenerate();
                    }
                } catch(e) {
                    console.log(e)
                    this.editMode = null
                    this.generator = new ProcessPreviewGenerator(this, {
                        isStream: true,
                        preferredLanguage: "Korean"
                    });
                }
            } else {
                try {
                    if(this.isMentoMode){
                        content = response
                    } else {
                        if(typeof response == 'string'){
                            try {
                                response = JSON.parse(response)
                            } catch(e){
                                response = partialParse(response)
                            }
                        }
                        if(response){
                            if(response.queryFor == 'customer'){
                                this.waitForCustomer = true
                            }
        
                            if(response.processDefinitionId){
                                this.waitForCustomer = true
                                this.processDefinition = response
                                this.bpmn = this.createBpmnXml(response); 
                                this.definitionChangeCount++;
                                await this.checkedFormData();
                                this.saveDef()
                                this.$emit("modelCreated", this.bpmn)
                                // this.initConfetti();
                                // this.render();
                            } else {
                                this.showConfetti = false
                                this.initConfettiCnt = 0
                                content = response.content
                                this.messages[this.messages.length - 1].content = content
                            }
                        }
                    }
    
    
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
                } catch(e) {
                    console.log(e)
                    this.waitForCustomer = true
                    this.generator = new ConsultingGenerator(this, {
                        isStream: true,
                        preferredLanguage: "Korean"
                    });
                    this.isMentoMode = false
                }
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
<style scoped>
.process-definition-resize {
    width: 100%;
    height: 100%;
}
</style>