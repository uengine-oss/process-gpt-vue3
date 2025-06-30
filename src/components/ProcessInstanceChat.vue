<template>
    <div style="background-color: rgba(255, 255, 255, 0); width: 100%;">
        <Chat :messages="messages" :agentInfo="agentInfo"
            :isAgentMode="isAgentMode" :userInfo="userInfo" 
            :disableChat="disableChat" :type="'instances'" :name="chatName" 
            :chatRoomId="chatRoomId" :hideInput="!isTaskMode"
            @requestDraftAgent="requestDraftAgent" @sendMessage="beforeSendMessage"
            @sendEditedMessage="beforeSendEditedMessage" @stopMessage="stopMessage">
            <template v-slot:custom-title>
                <div></div>
            </template>
        </Chat>
    </div>
</template>

<script>
import ChatModule from '@/components/ChatModule.vue';
import ChatGenerator from './ai/ProcessInstanceGenerator.js';

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
        useThreadId: Boolean,
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
        this.chatInfo = {
            title: 'processExecution.cardTitle',
            text: "processExecution.processDefinitionExplanation"
        }

        if (!this.isTaskMode) {
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
                        const lastMessage = this.messages[this.messages.length - 1];
                        if (lastMessage.content && lastMessage.content.length > 0) {
                            lastMessage.content = this.streamingText;
                        }
                    }
                    if (task.status == "DONE") {
                        this.$emit('updated');
                        this.EventBus.emit('instances-updated');
                        await this.getChatList(this.chatRoomId);
                        this.streamingText = '';
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
                
                await me.getChatList(me.chatRoomId)

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
            if (this.isComplete) {
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