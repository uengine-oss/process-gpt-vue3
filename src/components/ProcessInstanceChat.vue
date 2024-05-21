<template>
    <div style="background-color: rgba(255, 255, 255, 0)">
        <!-- <v-dialog v-model="definitionDialog" max-width="800">
            <v-card>
                <v-card-title class="text-h5">
                    프로세스 정의 목록
                </v-card-title>
                <v-card-text>
                    <VDataTable v-if="onLoad" :headers="headers" :items="definitions"
                        item-value="processDefinitionId">
                        <template v-slot:item.actions="{ item }">
                            <v-btn color="primary" class="px-4 rounded-pill mx-auto" variant="tonal"
                                @click="beforeSendMessage(null, item.raw.processDefinitionId)">Select</v-btn>
                        </template>
                    </VDataTable>
                    <div v-else style="height: 100%; text-align: center">
                        <v-progress-circular style="top: 50%" indeterminate color="primary"></v-progress-circular>
                    </div>
                </v-card-text>
            </v-card>
        </v-dialog> -->
        <Chat :messages="messages" :agentInfo="agentInfo" :chatInfo="chatInfo"
            :isAgentMode="isAgentMode" :userInfo="userInfo" :disableChat="disableChat" :type="'instances'" :name="chatName"
            @requestDraftAgent="requestDraftAgent" @sendMessage="beforeSendMessage"
            @sendEditedMessage="beforeSendEditedMessage" @stopMessage="stopMessage"
        ></Chat>
        <!-- <template v-slot:mobileLeftContent>
            <Chat :messages="messages" :agentInfo="agentInfo" :draftAgentPrompt="draftAgentPrompt" :chatInfo="chatInfo"
                :userInfo="userInfo" :disableChat="disableChat" :type="'instances'" :name="chatName"
                @requestDraftAgent="requestDraftAgent" @sendMessage="beforeSendMessage"
                @sendEditedMessage="beforeSendEditedMessage" @stopMessage="stopMessage"
            ></Chat>
        </template> -->
    </div>
</template>

<script>
import { format } from 'date-fns';

import { VectorStorage } from 'vector-storage';
import { VDataTable } from 'vuetify/labs/VDataTable';

import ChatModule from '@/components/ChatModule.vue';
import ChatGenerator from './ai/ProcessInstanceGenerator.js';

import AppBaseCard from '@/components/shared/AppBaseCard.vue';

import ProcessDefinition from '@/components/ProcessDefinition.vue';
import Chat from "@/components/ui/Chat.vue";
import ProcessInstanceList from '@/components/ui/ProcessInstanceList.vue';
// import WorkItem from './apps/todolist/WorkItem.vue';

import BackendFactory from "@/components/api/BackendFactory";
const backend = BackendFactory.createBackend();

export default {
    mixins: [ChatModule],
    components: {
        AppBaseCard,
        Chat,
        ProcessInstanceList,
        ProcessDefinition,
        VDataTable,
        // WorkItem,
    },
    props:{
        isComplete: Boolean,
        isAgentMode: Boolean
    },
    data: () => ({
        headers: [
            { title: 'id', align: 'start', key: 'processDefinitionId' },
            { title: 'name', align: 'start', key: 'processDefinitionName' },
            { title: 'description', align: 'start', key: 'description' },
            { title: 'actions', align: 'start', key: 'actions' },
        ],
        definitions: null,
        definitionDialog: false,
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
    },
    async created() {
        await this.init();
        this.generator = new ChatGenerator(this, {
            isStream: true,
            preferredLanguage: 'Korean'
        });
        if (localStorage.getItem('instancePrompt') && this.$route.query.process) {
            const newMessage = {
                text: localStorage.getItem('instancePrompt')
            }
            this.processDefinition = this.$route.query.process;
            await this.beforeSendMessage(newMessage)
            localStorage.removeItem('instancePrompt')
        }
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
        // 
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
                    await this.init();
                }
            }
        },
    },
    methods: {
        async viewProcess() {
            
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
            me.$try({
                context: me,
                action: async () => {
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
                            await me.loadMessages(`proc_inst/${value.proc_inst_id}`, { key: 'id' });
                        }
                    }                    
                }
            })
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
                if (this.processInstance && this.processInstance.proc_inst_id) {
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
        async saveMessages(messages) {
            if (this.processInstance) {
                var instObj = await this.getData(`${this.path}/${this.processInstance.proc_inst_id}`, { key: 'id' });
                instObj.messages = messages;
                await this.putObject(this.path, instObj);
            }
        },
        afterModelCreated(response) {
        },
        async afterGenerationFinished(response) {
            let messageWriting = this.messages[this.messages.length - 1];
            messageWriting.jsonContent = response;

            // const jsonData = JSON.parse(response);
            const jsonData = response;
            if (jsonData && jsonData.nextActivities && jsonData.nextActivities.length > 0) {
                messageWriting.content = jsonData.nextActivities.map(item => item.messageToUser).join('\n\n');
            }

            this.checkDisableChat();
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
        height: calc(100vh - 192px);
    }
}

:deep(.left-part) {
    width: 80%;
    /* Apply specific width */
}
</style>