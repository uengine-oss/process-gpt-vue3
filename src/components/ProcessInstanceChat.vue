<template>
    <div style="background-color: rgba(255, 255, 255, 0); width: 100%;">
        <Chat :messages="messages" :agentInfo="agentInfo"
            :isAgentMode="isAgentMode" :userInfo="userInfo" 
            :disableChat="disableChat" :type="'instances'" :name="chatName" 
            :chatRoomId="chatRoomId" :hideInput="!isTaskMode"
            @requestDraftAgent="requestDraftAgent" @sendMessage="beforeSendMessage"
            @sendEditedMessage="beforeSendEditedMessage" @stopMessage="stopMessage"
            @reGenerateAgentAI="reGenerateAgentAI">
            <template v-slot:custom-title>
                <div></div>
            </template>
        </Chat>
    </div>
</template>

<script>
import ChatModule from '@/components/ChatModule.vue';
import ChatGenerator from './ai/ProcessInstanceGenerator.js';
import AgentGenerator from './ai/WorkItemAgentGenerator.js';

import Chat from "@/components/ui/Chat.vue";

import BackendFactory from "@/components/api/BackendFactory";
const backend = BackendFactory.createBackend();

export default {
    mixins: [ChatModule],
    components: {
        Chat,
    },
    props:{
        isComplete: Boolean,
        isAgentMode: Boolean,
        html: String,
        formData: Object,
        useThreadId: Boolean,
        simulationInstances: Array,
    },
    data: () => ({
        processDefinition: null,
        processInstance: null,
        
        chatInfo: null,
        imgKeyList: [],

        // bpmn
        onLoad: false,
        bpmn: null,
        currentActivities: null,
        
        isTaskMode: false,

        // mcp agent
        threadId: '',
    }),
    computed: {
        chatName() {
            if (this.processInstance && this.processInstance.name) {
                return this.processInstance.name;
            }
            return '';
        },
    },
    async mounted() {
        await this.init();

        this.generator = new ChatGenerator(this, {
            isStream: true,
            preferredLanguage: 'Korean'
        });

        if(!this.isAgentMode){
            this.chatInfo = {
                title: 'processExecution.cardTitle',
                text: "processExecution.processDefinitionExplanation"
            }
        } else {
            this.chatInfo = {
                title: 'processExecution.cardTitle',
                text: "processExecution.agent"
            }
            this.generator = new AgentGenerator(this, {
                isStream: true,
                preferredLanguage: 'Korean'
            });

            this.handleDraftResponse()
        }

        if (!this.isAgentMode && !this.isTaskMode) {
            const worklist = await backend.getWorkListByInstId(this.chatRoomId);
            const workItem = worklist.find(item => item.task.status == 'SUBMITTED');
            this.streamingText = '';
            if (workItem) {
                const taskId = workItem.taskId;
                await backend.getTaskLog(taskId, async (task) => {
                    if (this.streamingText == '') {
                        this.streamingText = task.log;
                        this.messages.push({
                            role: 'system',
                            content: this.streamingText,
                        });
                    } else if (this.streamingText != '') {
                        this.streamingText = task.log;
                        this.messages[this.messages.length - 1].content = this.streamingText;
                    }
                    if (task.status == "DONE") {
                        this.$emit('updated');
                        this.EventBus.emit('instances-updated');
                        await this.getChatList(this.chatRoomId);
                    }
                });
            }
        }
    },
    watch: {
        "$route": {
            deep: true,
            async handler(newVal, oldVal) {
                if (newVal.params.taskId && newVal.params.taskId !== oldVal.params.taskId) {
                    if (!newVal.params.taskId) {
                        this.messages = [];
                    }
                    this.isTaskMode = true;
                    await this.init();
                } else if (newVal.params.instId && newVal.params.instId !== oldVal.params.instId) {
                    this.messages = [];
                    this.isTaskMode = false;
                    await this.init();
                }
            }
        },
    },
    methods: {
        async resizeBase64Image(base64Str, minWidth, minHeight) {
            return new Promise((resolve) => {
                const img = new Image();
                img.src = base64Str;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > minWidth) {
                            height *= minWidth / width;
                            width = minWidth;
                        }
                    } else {
                        if (height > minHeight) {
                            width *= minHeight / height;
                            height = minHeight;
                        }
                    }
                    canvas.width = width;
                    canvas.height = height;
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL());
                };
            });
        },
        reGenerateAgentAI(){
            this.messages = []
            this.handleDraftResponse()
        },
        async handleDraftResponse() {
            this.messages.push({
                role: 'system',
                content: '...',
                isLoading: true
            });
            this.isVisionMode = false
            this.imgKeyList = []
        
            if(this.formData && typeof this.formData == 'object'){
                for (const key of Object.keys(this.formData)) {
                    if(this.formData[key] && (typeof this.formData[key] == 'string' && this.formData[key].includes("data:image/"))){
                        this.imgKeyList.push(key)
                        this.isVisionMode = true
                        this.generator.previousMessages = []
                        const resizedImage = await this.resizeBase64Image(this.formData[key], 512, 512);
                        this.generator.previousMessages.push({
                            "content": [
                                {
                                    "type": "text",
                                    "text": "해당 이미지를 분석하고 이미지 분석 내용을 자세하게 한글로 설명해. 이미지에 표시된 날짜, 글자 위주로 집중 분석한 결과를 설명해. 결과는 최대한 정확하고 자세하지만 최대한 요약해서 생성해주면 좋아."
                                },
                                {
                                    "type": "image_url",
                                    "image_url": {
                                        "url": resizedImage
                                    }
                                }
                            ],
                            "role": "user"
                        });
                        this.generator.model = "gpt-4-vision-preview";
                    } 
                }
            }
            if(this.isVisionMode){
                this.generator.generate()
            } else {
                this.generateAgentAI()
            }
        },
        async generateAgentAI(response){
            var me = this
            this.isVisionMode = false
            
            this.generator = new AgentGenerator(this, {
                isStream: true,
                preferredLanguage: 'Korean'
            });
                        
            this.generator.model = "gpt-4o";
            
            if(response){
                this.generator.previousMessages.push({
                    "content": "첨부된 이미지에 대한 설명: " + response,
                    "role": "user"
                })
            }
            if(this.processInstance && this.processInstance.instId){
                const instance = await backend.getInstance(this.processInstance.instId);
                this.generator.previousMessages.push({
                    "content": "이전 작업 내역 리스트: " + JSON.stringify(instance),
                    "role": "user"
                })
            } else if(this.simulationInstances && this.simulationInstances.length > 0) {
                this.generator.previousMessages.push({
                    "content": "이전 작업 내역 리스트: " + JSON.stringify(this.simulationInstances),
                    "role": "user"
                })
            } else {
                this.generator.previousMessages.push({
                    "content": "이전 작업 내역 리스트: []",
                    "role": "user"
                })
            }

            this.generator.previousMessages.push({
                "content": "현재 작업 입력 양식: " + this.html,
                "role": "user"
            })

            let formData = JSON.parse(JSON.stringify(me.formData))
            if(this.imgKeyList.length > 0){
                this.imgKeyList.forEach(function (key){
                    delete formData[key]
                })
                me.imgKeyList = []
            }
            let formValues = {
                "formValues": formData
            }
            this.generator.previousMessages.push({
                "content": "생성해야할 답변 형식: " + JSON.stringify(formValues),
                "role": "user"
            })
            const userList = await backend.getUserList();
            this.generator.previousMessages.push({
                "content": "유저 목록: " + JSON.stringify(userList),
                "role": "user"
            })
            const organization = await this.getData(`configuration/organization`, {key: 'key'});
            if(organization && organization.value){
                this.generator.previousMessages.push({
                    "content": "회사 조직도: " + JSON.stringify(organization.value),
                    "role": "user"
                })
            }

            this.generator.generate()
        },
        requestDraftAgent(newVal) {
            var me = this
            me.$try({
                context: me,
                action() {
                    if (newVal) me.agentInfo.draftPrompt = newVal
                    me.messages.push(me.createMessageObj(newVal))

                    if (!me.agentInfo.draftPrompt) return;
                    me.agentInfo.isRunning = true
                    me.requestAgent(me.agentInfo.draftPrompt)
                },
                // onFail() {
                // }
            })
        },
        async loadProcess() {
            this.onLoad = false;
            let id, defId;
            if (this.processInstance && this.processInstance.currentActivityIds) {
                this.currentActivities = this.processInstance.currentActivityIds;
                id = this.processInstance.instId;
                defId = id.split('.')[0];
            } else {
                id = this.$route.params.taskId;
                defId = id.split('.')[0];
                this.processInstance = await backend.getInstance(id);
                if (this.processInstance) {
                    this.currentActivities = this.processInstance.currentActivityIds;
                }
            }
            var bpmn = await backend.getRawDefinition(defId, { type: "bpmn"});
            if (bpmn) {
                this.bpmn = bpmn;
            }
            this.onLoad = true;
        },
        async loadData(path) {
            const me = this;
            me.processInstance = null;
            me.bpmn = null;
            
            let id;
            if (me.$route.params.taskId) {
                const taskId = me.$route.params.taskId;
                const workitem = await backend.getWorkItem(taskId);     
                if (workitem) {
                    id = workitem.worklist.instId;
                    this.chatRoomId = id;
                }
                if (me.useThreadId) {
                    me.chatRoomId = taskId;
                }
            } else if (me.$route.params.instId) {
                id = decodeURIComponent(atob(me.$route.params.instId));
                this.chatRoomId = id;
            }

            if (id) {
                const value = await backend.getInstance(id);
                if (value) {
                    me.processInstance = value;
                    me.checkDisableChat();
                }
                await me.loadProcess();
                if(this.isAgentMode){
                    me.processInstanceId = value.instId
                } else {
                    await me.getChatList(me.chatRoomId)
                }
            }

            if (me.useThreadId) {
                if (me.messages.length > 0) {
                    me.threadId = me.messages[0].threadId;
                } else {
                    me.threadId = await backend.createThreadId();
                }
            }
        },
        checkDisableChat() {
            if (this.isComplete || this.isAgentMode) {
                this.disableChat = true;
            }

            if (this.processInstance) {
                if (this.processInstance.currentUserIds &&
                    this.processInstance.currentUserIds.length > 0 &&
                    !this.processInstance.currentUserIds.includes(this.userInfo.email)
                ) {
                    this.disableChat = true;
                }
            }
        },
        async beforeSendMessage(newMessage) {
            if (newMessage) {
                if (this.useThreadId && this.threadId) {
                    const message = this.createMessageObj(newMessage);
                    this.putMessage(message);
                    this.messages.push(message);
                    const result = await backend.sendMessageWithThreadId(this.threadId, newMessage.text, this.chatRoomId);
                    if (result) {
                        this.messages.push(result);
                    }
                } else {
                    if (this.chatRoomId) {
                        this.putMessage(this.createMessageObj(newMessage));
                        await this.generator.beforeGenerate(newMessage, false);
                    } else {
                        await this.generator.beforeGenerate(newMessage, true);
                    }
                    this.sendMessage(newMessage);
                }
            }
        },
        beforeSendEditedMessage(index) {
            if (index > 0) {
                this.generator.beforeGenerate(this.messages[index - 1].content, false);
                this.sendEditedMessage(index);
            }
        },
        async putMessage(msg) {
            const uuid = this.uuid();
            const message = {
                "messages": msg,
                "id": this.chatRoomId,
                "uuid": uuid,
                "thread_id": this.threadId || null
            }
            this.putObject(`chats/${uuid}`, message);
        },
        afterModelCreated(response) {
        },
        async afterGenerationFinished(response) {
            var me = this;
            let messageWriting = me.messages[me.messages.length - 1];
            messageWriting.jsonContent = response;

            const jsonData = response;
            if (jsonData) {
                if (jsonData.instanceId) {
                    me.processInstance = await backend.getInstance(jsonData.instanceId);
                }
                if (jsonData.nextActivities && jsonData.nextActivities.length > 0) {
                    messageWriting.content = jsonData.nextActivities.map(item => item.messageToUser).join('\n\n');
                }
            }

            me.checkDisableChat();
            me.EventBus.emit('instances-updated');
            me.EventBus.emit('process-definition-updated');
        },
        afterAgentGeneration(response) {
            this.$emit('agentGenerationFinished', response)
        },
        afterModelStopped(response) {
            let id;

            if (this.$route.params.taskId) {
                id = this.$route.params.taskId;
            } else if (this.processInstance && this.processInstance.instId) {
                id = this.processInstance.instId;
            }

            if (id != '') {
                
            }
        },
    }
};
</script>

<style scoped>
.process-definition-resize {
    width: 100%;
    height: 100%;
}

@media only screen and (max-width:1279px) {
    .process-definition-resize {
        width: 100%;
        height: calc(100% - 38px) !important;
    }
}

:deep(.left-part) {
    width: 75%;
    /* Apply specific width */
}
</style>