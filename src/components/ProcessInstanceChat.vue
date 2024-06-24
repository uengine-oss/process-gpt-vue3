<template>
    <div style="background-color: rgba(255, 255, 255, 0); width: 100%;">
        <Chat :messages="messages" :agentInfo="agentInfo" :chatInfo="chatInfo"
            :isAgentMode="isAgentMode" :userInfo="userInfo" :disableChat="disableChat" :type="'instances'" :name="chatName" :chatRoomId="chatRoomId"
            @requestDraftAgent="requestDraftAgent" @sendMessage="beforeSendMessage"
            @sendEditedMessage="beforeSendEditedMessage" @stopMessage="stopMessage">
            <template v-slot:custom-title v-if="$route.params.instId">
                <div></div>
            </template>
        </Chat>
    </div>
</template>

<script>

import { VectorStorage } from 'vector-storage';

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
        isAgentMode: Boolean
    },
    data: () => ({
        processDefinition: null,
        processInstance: null,
        path: 'proc_inst',
        organizationChart: [],
        chatInfo: null,
        // bpmn
        onLoad: false,
        bpmn: null,
        currentActivities: null,
        
        // temp
        isRunningId: null,
    }),
    computed: {
        chatName() {
            if (this.processInstance && this.processInstance.proc_inst_name) {
                return this.processInstance.proc_inst_name;
            }
            return '';
        },
        instanceId () {
            if (this.processInstance && this.processInstance.proc_inst_id) {
                return this.processInstance.proc_inst_id;
            } else if (this.$route.params.instId) {
                return atob(this.$route.params.instId);
            }
            return '';
        }
    },
    async created() {
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
        }
    },
    mounted() {
        if (this.processInstance && this.processInstance.proc_inst_id) {
            this.chatRoomId = this.processInstance.proc_inst_id;
        }
    },
    beforeUnmount() {

    },
    watch: {
        "$route": {
            deep: true,
            async handler(newVal, oldVal) {
                if (newVal.params.taskId && newVal.params.taskId !== oldVal.params.taskId) {
                    if (!newVal.params.taskId) {
                        this.messages = [];
                    }
                    await this.init();
                } else if (newVal.params.instId && newVal.params.instId !== oldVal.params.instId) {
                    this.messages = [];
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
            if (this.processInstance && this.processInstance.current_activity_ids) {
                this.currentActivities = this.processInstance.current_activity_ids;
                id = this.processInstance.proc_inst_id;
                defId = id.split('.')[0];
            } else {
                id = this.$route.params.taskId;
                defId = id.split('.')[0];
                this.processInstance = await backend.getInstance(id);
                if (this.processInstance) {
                    this.currentActivities = this.processInstance.current_activity_ids;
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
                }
            } else if (me.$route.params.instId) {
                id = atob(me.$route.params.instId);
            }
            if (id) {
                const value = await backend.getInstance(id);
                if (value) {
                    me.processInstance = value;
                    me.checkDisableChat();
                }
                await me.loadProcess();
                if(this.isAgentMode){
                    await me.loadAgentMessages(`proc_inst/${value.proc_inst_id}`, { key: 'id' });
                    me.processInstanceId = value.proc_inst_id
                } else {
                    await me.getChatList(id)
                    // await me.loadMessages(`proc_inst/${value.proc_inst_id}`, { key: 'id' });
                }
            } 
        },
        checkDisableChat() {
            if (this.isComplete) {
                this.disableChat = true;
            }

            if (this.processInstance) {
                if (this.processInstance.current_user_ids &&
                    this.processInstance.current_user_ids.length > 0 &&
                    !this.processInstance.current_user_ids.includes(this.userInfo.email)
                ) {
                    this.disableChat = true;
                }
            }
        },
        async beforeSendMessage(newMessage) {
            if (newMessage && newMessage.text != '') {
                if (this.instanceId) {
                    this.putMessage(this.createMessageObj(newMessage));
                    this.generator.beforeGenerate(newMessage, false);
                } else {
                    this.generator.beforeGenerate(newMessage, true);
                }
                this.sendMessage(newMessage);
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
                "id": this.instanceId,
                "uuid": uuid,
            }
            this.putObject(`chats/${uuid}`, message);
        },
        afterModelCreated(response) {
        },
        async afterGenerationFinished(response) {
            var me = this;
            let messageWriting = me.messages[me.messages.length - 1];
            messageWriting.jsonContent = response;

            // const jsonData = JSON.parse(response);
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
            } else if (this.processInstance && this.processInstance.proc_inst_id) {
                id = this.processInstance.proc_inst_id;
            }

            if (id != '') {
                let putObj = {
                    messages: this.messages
                };
                this.putObject(`proc_inst/${id}`, putObj, { key: 'id' });
            }
        },

        async sendNotification(data) {
            const options = {
                match: {
                    id: this.userInfo.uid,
                    email: this.userInfo.email,
                }
            };
            const result = await this.getData('users', options);
            let notifications = result.notifications;
            if (!notifications) {
                notifications = [];
            }
            const noti = {
                id: data.instanceId,
                type: 'instance',
                isChecked: false,
            };
            notifications.push(noti);

            const obj = {
                id: this.userInfo.uid,
                notifications: notifications,
            };
            this.putObject('users', obj);
        },

        async saveDefinitionToVectorDB() {
            const list = await this.storage.list("proc_def");
            if (list && list.length > 0) {
                // const apiToken = this.generator.getToken();
                const vectorStore = new VectorStorage({ openAIApiKey: this.openaiToken });

                list.forEach(async (item) => {
                    if (item.definition) {
                        const jsonText = JSON.stringify(item.definition);
                        await vectorStore.addText(jsonText, {
                            category: item.definition.processDefinitionId
                        });
                    }
                })
            }
        },

        async queryFromVectorDB(messsage) {
            // const apiToken = this.generator.getToken();
            const vectorStore = new VectorStorage({ openAIApiKey: this.openaiToken });

            // Perform a similarity search
            const results = await vectorStore.similaritySearch({
                query: messsage
            });
            if (results.similarItems.length > 0) {
                const res = results.similarItems.map(item => item.text);
                return res
            } else {
                await this.saveDefinitionToVectorDB();
                return this.queryFromVectorDB(messsage);
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
        height: calc(100vh - 192px) !important;
    }
}

:deep(.left-part) {
    width: 75%;
    /* Apply specific width */
}
</style>