<template>
    <v-card elevation="10">
        <AppBaseCard>
            <template v-slot:leftpart="{ closeDrawer }">
                <div class="no-scrollbar">
                    <!-- Agent Profile Card -->
                    <div class="agent-profile-card pa-4">
                        <div class="text-center mb-4">
                            <v-avatar size="80" class="mb-3">
                                <v-img 
                                    :src="agentInfo.profile || '/images/defaultUser.png'" 
                                    :alt="agentInfo.username || 'Agent'"
                                    cover
                                >
                                    <template v-slot:error>
                                        <v-img src="/images/defaultUser.png" cover>
                                            <template v-slot:error>
                                                <v-icon size="large" style="color: #666;">mdi-account</v-icon>
                                            </template>
                                        </v-img>
                                    </template>
                                </v-img>
                            </v-avatar>
                            <h5 class="text-h6 font-weight-bold mb-1">{{ agentInfo.username || 'Agent' }}</h5>
                            <!-- Goal Section -->
                            <div class="pa-0 mb-1">
                                <v-icon size="small" color="primary" class="mr-1">mdi-target</v-icon>
                                <span class="text-body-2 font-weight-medium">목표</span>
                            </div>
                            <p class="text-body-2 text-medium-emphasis mb-3">{{ agentInfo.goal || '에이전트의 목표가 설정되지 않았습니다.' }}</p>
                        </div>
                        
                        <v-divider class="mb-4"></v-divider>
                        
                        <!-- Tab Navigation -->
                        <v-tabs
                            v-model="activeTab"
                            direction="vertical"
                            color="primary"
                            class="agent-tabs"
                        >
                            <v-tab value="learning" class="text-left justify-start">
                                <v-icon start class="mr-2">mdi-school</v-icon>
                                학습 모드
                            </v-tab>
                            <v-tab value="question" class="text-left justify-start">
                                <v-icon start class="mr-2">mdi-chat</v-icon>
                                질의 모드
                            </v-tab>
                            <v-tab value="knowledge" class="text-left justify-start">
                                <v-icon start class="mr-2">mdi-database</v-icon>
                                지식 관리
                            </v-tab>
                        </v-tabs>
                    </div>
                </div>
            </template>
            <template v-slot:rightpart>
                <!-- Learning Mode Tab Content -->
                <div v-if="activeTab === 'learning' || activeTab === 'question'" class="chat-info-view-wrapper-chats">
                    <Chat :messages="messages" :agentInfo="agentInfo"
                        :isAgentMode="isAgentMode" :userInfo="userInfo" 
                        :disableChat="disableChat" :type="'instances'"
                        :name="chatName" :chatRoomId="chatRoomId"
                        @requestDraftAgent="requestDraftAgent" @sendMessage="beforeSendMessage"
                        @sendEditedMessage="beforeSendEditedMessage" @stopMessage="stopMessage"
                    ></Chat>
                </div>
                
                <!-- Knowledge Management Tab Content -->
                <div v-else-if="activeTab === 'knowledge'">
                    <div class="pa-4">
                        <h4 class="text-h5 mb-4">지식 관리</h4>
                        <p class="text-body-1 text-medium-emphasis">
                            지식 관리 기능이 준비 중입니다. 곧 업데이트될 예정입니다.
                        </p>
                        <v-card class="mt-4 pa-4" variant="outlined">
                            <div class="text-center">
                                <v-icon size="48" color="primary" class="mb-3">mdi-database-cog</v-icon>
                                <h6 class="text-h6 mb-2">지식 베이스 관리</h6>
                                <p class="text-body-2 text-medium-emphasis">
                                    에이전트의 지식과 학습 데이터를 관리할 수 있습니다.
                                </p>
                            </div>
                        </v-card>
                    </div>
                </div>
            </template>

            <template v-slot:mobileLeftContent="{ closeDrawer }">
                <div class="no-scrollbar">
                    <!-- Mobile Agent Profile Card -->
                    <div class="agent-profile-card pa-4">
                        <div class="text-center mb-4">
                            <v-avatar size="60" class="mb-3">
                                <v-img 
                                    :src="agentInfo.profile || '/images/defaultUser.png'" 
                                    :alt="agentInfo.username || 'Agent'"
                                    cover
                                >
                                    <template v-slot:error>
                                        <v-img src="/images/defaultUser.png" cover>
                                            <template v-slot:error>
                                                <v-icon size="large" style="color: #666;">mdi-account</v-icon>
                                            </template>
                                        </v-img>
                                    </template>
                                </v-img>
                            </v-avatar>
                            <h6 class="text-subtitle-1 font-weight-bold mb-1">{{ agentInfo.username || 'Agent' }}</h6>
                            <p class="text-caption text-medium-emphasis mb-0">{{ agentInfo.email || 'agent@example.com' }}</p>
                        </div>
                        
                        <v-divider class="mb-4"></v-divider>
                        
                        <!-- Mobile Tab Navigation -->
                        <v-tabs
                            v-model="activeTab"
                            direction="vertical"
                            color="primary"
                            class="agent-tabs"
                        >
                            <v-tab value="learning" class="text-left justify-start">
                                <v-icon start class="mr-2">mdi-school</v-icon>
                                학습 모드
                            </v-tab>
                            <v-tab value="knowledge" class="text-left justify-start">
                                <v-icon start class="mr-2">mdi-database</v-icon>
                                지식 관리
                            </v-tab>
                        </v-tabs>
                    </div>
                </div>
            </template>
        </AppBaseCard>
    </v-card>
</template>

<script>
import AppBaseCard from '@/components/shared/AppBaseCard.vue';

import ChatModule from "@/components/ChatModule.vue";
import Chat from "@/components/ui/Chat.vue";

import AgentChatGenerator from "@/components/ai/AgentChatGenerator.js";

export default {
    mixins: [ChatModule],
    components: {
        AppBaseCard,
        Chat
    },
    data: () => ({
        agentInfo: {
            id: '',
            profile: '/images/defaultUser.png',
            username: 'Agent',
            goal: '에이전트의 목표가 설정되지 않았습니다.',
        },
        isAgentLearning: true,
        activeTab: 'learning', // 기본값은 학습 모드
        chatRoomId: '',
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
        async getKnowledge() {
            const options = {
                agent_id: this.id
            }
            this.knowledge = await this.backend.getVecsDocuments(options);
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
                    if (responseObj.searchResults) {
                        obj.content = responseObj.content
                        obj.htmlContent = responseObj.htmlContent
                        obj.searchResults = responseObj.searchResults
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
    }
}
</script>

<style scoped>
</style>
