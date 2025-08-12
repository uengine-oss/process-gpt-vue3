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
            <template v-slot:custom-chat>
                <!-- streaming text -->
                <div v-if="streamingText" class="position-absolute bottom-0 end-0 ml-2">
                    <div class="mx-2">
                        <v-sheet class="chat-message-bubble rounded-md px-3 py-2 other-message w-100" style="max-width: 100% !important;">
                            <pre class="text-body-1">{{ streamingText }}</pre>
                        </v-sheet>
                    </div>
                </div>
                <!-- feedback -->
                <div v-if="useFeedback" class="bottom-0 end-0 ml-2 mr-2">
                    <span class="text-body-2">프로세스 실행이 정상인가요?</span>
                    <v-btn icon size="x-small" variant="text" color="success" @click="selectFeedback('good')">
                        <v-icon>mdi-thumb-up</v-icon>
                    </v-btn>
                    <v-btn icon size="x-small" variant="text" color="error" @click="selectFeedback('bad')">
                        <v-icon>mdi-thumb-down</v-icon>
                    </v-btn>
                </div>
                <div v-else-if="!useFeedback && showAcceptFeedback" class="bottom-0 end-0 ml-2">
                    <span class="text-body-2">피드백을 반영하시겠습니까?</span>
                    <v-btn icon size="x-small" variant="text" color="success" @click="showFeedback = true">
                        <v-icon>mdi-check</v-icon>
                    </v-btn>
                    <v-btn icon size="x-small" variant="text" color="error" @click="cancelAppliedFeedback">
                        <v-icon>mdi-close</v-icon>
                    </v-btn>
                </div>
                <div class="pr-4">
                    <ProcessFeedback 
                        v-if="showFeedback"
                        :lastMessage="lastMessage"
                        :task="lastTask"
                        :isAcceptMode="showAcceptFeedback"
                        @submitFeedback="submitFeedback"
                        @closeFeedback="closeFeedback"
                    />
                </div>
            </template>
        </Chat>
    </div>
</template>

<script>
import ChatModule from '@/components/ChatModule.vue';
import ChatGenerator from './ai/ProcessInstanceGenerator.js';

import Chat from "@/components/ui/Chat.vue";
import ProcessFeedback from "@/components/ui/ProcessFeedback.vue";

import BackendFactory from "@/components/api/BackendFactory";
const backend = BackendFactory.createBackend();

export default {
    mixins: [ChatModule],
    components: {
        Chat,
        ProcessFeedback,
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

        subscription: null,
        runningTaskId: null,
        streamingText: '',

        // feedback
        useFeedback: false,
        showFeedback: false,
        lastMessage: null,
        lastTask: null,
        showAcceptFeedback: false,
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
                this.runningTaskId = workItem.taskId;;
                await this.getTaskLog(true);
            }
        }
    },
    beforeUnmount() {
        if (this.subscription) {
            // console.log('Unsubscribing from task log for taskId:', this.runningTaskId);
            window.$supabase.removeChannel(this.subscription);
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
                    await this.getLastTask(newVal.params.instId);
                }
            }
        },
        messages(newVal) {
            if (newVal.length > 0) {
                this.lastMessage = newVal[newVal.length - 1];
            }
        },
        lastMessage(newVal) {
            if (newVal && newVal.role == 'system' && !this.isTaskMode) {
                this.useFeedback = true;
                if (newVal.jsonContent && newVal.jsonContent.appliedFeedback) {
                    this.useFeedback = false;
                    this.showAcceptFeedback = true;
                } else {
                    this.showAcceptFeedback = false;
                }
            } else {
                this.useFeedback = false;
            }
        }
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
                await this.getLastTask(id);
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
                id = me.$route.params.instId.replace(/_DOT_/g, '.');
                this.chatRoomId = id;
            }

            if (id) {
                const value = await backend.getInstance(id);
                if (value) {
                    me.processInstance = value;
                    me.checkDisableChat();
                }
                await me.loadProcess();
                
                await me.getMessages(me.chatRoomId)
                await me.getLastTask(id);
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
                if (this.processInstance.participants &&
                    this.processInstance.participants.length > 0 &&
                    !this.processInstance.participants.includes(this.userInfo.email)
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
        },

        async selectFeedback(type) {
            if (this.lastMessage.jsonContent) {
                this.lastMessage.jsonContent.executionResult = type;
            } else {
                this.lastMessage.jsonContent = {
                    executionResult: type
                }
            }
            if (type == 'good') {
                backend.setFeedback(this.lastTask, type);
            } else if (type == 'bad') {
                this.showFeedback = true;
            }
            this.useFeedback = false;
        },
        closeFeedback() {
            this.showFeedback = false;
            // this.showAcceptFeedback = false;
        },
        async getLastTask(instId) {
            const worklist = await backend.getWorkListByInstId(instId);
            if (!this.lastMessage) {
                this.lastMessage = this.messages[this.messages.length - 1];
            }
            if (this.lastMessage && this.lastMessage.jsonContent && this.lastMessage.jsonContent.completedActivities && this.lastMessage.jsonContent.completedActivities.length > 0) {
                const completedActivities = this.lastMessage.jsonContent.completedActivities;
                const completedActivityIds = completedActivities.map(item => item.completedActivityId);
                const workItems = worklist.filter(item => item.status == 'DONE' && completedActivityIds.includes(item.tracingTag));
                if (workItems.length > 0) {
                    const workItem = workItems.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))[0];
                    this.lastTask = workItem;
                    if (this.lastTask.task.temp_feedback && this.lastTask.task.temp_feedback.length > 0) {
                        this.useFeedback = false;
                    }
                }
            }
        },

        async getMessages(chatRoomId) {
            var me = this;
            me.messages = []
            let messages = await this.backend.getMessages(chatRoomId)
            if (messages) {
                let allMessages = messages.map(message => {
                    let newMessage = message.messages;
                    newMessage.thread_id = message.thread_id || null;
                    newMessage.uuid = message.uuid;
                    return newMessage;
                });
                allMessages.sort((a, b) => {
                    return new Date(a.timeStamp) - new Date(b.timeStamp);
                });
                me.messages = allMessages;
            }
        },
        async submitFeedback(taskId) {
            this.closeFeedback();
            this.runningTaskId = taskId;
            await this.getTaskLog(false);
            await this.loadData();
        },
        async getTaskLog(useFeedback) {
            this.subscription = await backend.getTaskLog(this.runningTaskId, async (task) => {
                this.useFeedback = false;
                if (task.log) {
                    this.streamingText = task.log;
                }
                if (task.status == "DONE") {
                    this.streamingText = '';
                    if (this.subscription) {
                        // console.log('Unsubscribing from task log for taskId:', this.runningTaskId);
                        window.$supabase.removeChannel(this.subscription);
                    }
                    await this.loadData();
                    this.$emit('updated');
                    this.EventBus.emit('instances-updated');
                    this.useFeedback = useFeedback;
                }
            });
        },
        async cancelAppliedFeedback() {
            if (this.lastMessage && this.lastMessage.jsonContent) {
                this.lastMessage.jsonContent.appliedFeedback = false;
                await backend.updateInstanceChat(this.chatRoomId, this.lastMessage, this.lastMessage.thread_id, this.lastMessage.uuid);
            }
        }
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