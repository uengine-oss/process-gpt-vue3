<template>
    <v-card elevation="10">
        <AppBaseCard>
            <template v-slot:leftpart="{ closeDrawer }">
                <AgentChatInfo 
                    :agentInfo="agentInfo" 
                    :activeTab="activeTab"
                    @update:activeTab="activeTab = $event"
                />
            </template>
            <template v-slot:rightpart>
                <!-- Learning Mode Tab Content -->
                <div v-if="activeTab === 'learning' || activeTab === 'question'" class="chat-info-view-wrapper-chats">
                    <Chat :messages="messages" :agentInfo="agentInfo"
                        :userInfo="userInfo" :chatRoomId="chatRoomId"
                        @sendMessage="beforeSendMessage" @stopMessage="stopMessage"
                    ></Chat>
                </div>
                
                <!-- Knowledge Management Tab Content -->
                <div v-else-if="activeTab === 'knowledge'">
                    <AgentKnowledgeManagement 
                        :agentInfo="agentInfo" 
                        :knowledges="knowledges" 
                        :isLoading="isLoading"
                        @deleteKnowledge="deleteKnowledge"
                    />
                </div>
            </template>

            <template v-slot:mobileLeftContent="{ closeDrawer }">
                <AgentChatInfo 
                    :agentInfo="agentInfo" 
                    :activeTab="activeTab"
                    :isMobile="true"
                    @update:activeTab="activeTab = $event"
                />
            </template>
        </AppBaseCard>
    </v-card>
</template>

<script>
import AppBaseCard from '@/components/shared/AppBaseCard.vue';

import ChatModule from "@/components/ChatModule.vue";
import Chat from "@/components/ui/Chat.vue";
import AgentKnowledgeManagement from "@/components/AgentKnowledgeManagement.vue";
import AgentChatInfo from "@/components/AgentChatInfo.vue";

import AgentChatGenerator from "@/components/ai/AgentChatGenerator.js";

export default {
    mixins: [ChatModule],
    components: {
        AppBaseCard,
        Chat,
        AgentKnowledgeManagement,
        AgentChatInfo
    },
    data: () => ({
        agentInfo: {
            id: '',
            profile: '/images/chat-icon.png',
            username: 'Agent',
            goal: '에이전트의 목표가 설정되지 않았습니다.',
        },
        isAgentLearning: true,
        activeTab: 'learning', // 기본값은 학습 모드
        chatRoomId: '',

        // knowledge management
        knowledges: [],
        isLoading: false
    }),
    computed: {
        id() {
            return this.$route.params.id;
        }
    },
    watch: {
        "$route": {
            async handler() {
                await this.init();
            },
            deep: true
        },
        activeTab: {
            async handler(newVal) {
                if(newVal === 'knowledge') {
                    await this.getKnowledge();
                } else if(newVal === 'question') {
                    this.isAgentLearning = false;
                    this.chatRoomId = `${this.agentInfo.id}-question`;
                    await this.getMessages(this.chatRoomId);
                } else {
                    this.isAgentLearning = true;
                    this.chatRoomId = `${this.agentInfo.id}-learning`;
                    await this.getMessages(this.chatRoomId);
                }
            },
            immediate: true
        }
    },
    created() {
        this.generator = new AgentChatGenerator(this, {
            isStream: false,
            preferredLanguage: "Korean",
        });

        this.isAgentChat = true;
    },
    async mounted() {
        await this.init();
    },
    methods: {
        async init() {
            this.agentInfo = await this.backend.getUserById(this.id);

            if (this.isAgentLearning) {
                this.chatRoomId = `${this.agentInfo.id}-learning`;
            } else {
                this.chatRoomId = `${this.agentInfo.id}-question`;
            }

            await this.getMessages(this.chatRoomId);
        },
        async putMessage(message){
            let uuid = this.uuid()
            if(message.uuid){
                uuid = message.uuid
            }
            let messageObj = {
                "messages": message,
                "id": this.chatRoomId,
                "uuid": uuid
            }
            
            this.putObject(`chats/${uuid}`, messageObj);
        },
         async beforeSendMessage(newMessage) {
            if (newMessage && (newMessage.text != '' || (newMessage.images && newMessage.images.length > 0) || newMessage.image != null)) {
                this.putMessage(this.createMessageObj(newMessage))
                this.generator.beforeGenerate(newMessage);
                this.sendMessage(newMessage);
            }
        },
        afterModelCreated(response) {
            if (response.work == 'A2AResponse') {
                let messageWriting = this.messages[this.messages.length - 1];
                if (messageWriting && messageWriting.isLoading) {
                    messageWriting.content += response.content
                    let content = response.content.replaceAll('\n', '<br>')
                    messageWriting.htmlContent += content
                }
            }
        },
        afterModelStopped(response) {
            // console.log(response)
        },
        async afterGenerationFinished(responseObj) {
            if(responseObj && responseObj.work) {
                let obj = this.createMessageObj(responseObj, 'agent')
                obj.name = this.agentInfo.username
                obj.profile = this.agentInfo.profile
                if (responseObj.work == 'Mem0AgentQuery') {
                    obj.content = responseObj.content
                    if (responseObj.searchResults) {
                        obj.searchResults = responseObj.searchResults
                    }
                    if (responseObj.htmlContent) {
                        obj.htmlContent = responseObj.htmlContent
                    }
                } else if (responseObj.work == 'Mem0AgentInformation' || responseObj.work == 'Mem0AgentResponse') {
                    obj.content = responseObj.content
                } else if (responseObj.work == 'A2AResponse') {
                    let content = responseObj.content
                    content = content.replaceAll('undefined', '')
                    obj.content = content
                    obj.htmlContent = content.replaceAll('\n', '<br>')
                }
                obj.uuid = this.uuid()
                await this.putMessage(obj)
            }
            await this.getMessages(this.chatRoomId);
        },

        // knowledge management
        async getKnowledge() {
            this.isLoading = true;
            const options = {
                agent_id: this.id
            }
            this.knowledges = await this.backend.getVecsDocuments(options);
            this.isLoading = false;
        },
        async deleteKnowledge(options) {
            await this.backend.deleteVecsDocument(options);
            await this.getKnowledge();
        }
    }
}
</script>

<style scoped>
</style>
