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
                <div v-if="activeTab === 'learning'" class="chat-info-view-wrapper-chats">
                    <Chat :messages="messages" :agentInfo="agentInfo"
                        :isAgentMode="isAgentMode" :userInfo="userInfo" 
                        :disableChat="disableChat" :type="'instances'"
                        :name="chatName" :chatRoomId="agentInfo.id"
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
        agentInfo: {},
        isAgentLearning: true,
        activeTab: 'learning', // 기본값은 학습 모드
    }),
    computed: {
        id() {
            return this.$route.params.id;
        }
    },
    watch: {
        "$route": {
            handler() {
                this.init();
            },
            deep: true
        },
        activeTab: {
            async handler(newVal) {
                if(newVal === 'knowledge') {
                    await this.getKnowledge();
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
            await this.getMessages(this.agentInfo.id);

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
                "id": this.agentInfo.id,
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
                if (responseObj.work == 'Mem0AgentInformation' || responseObj.work == 'Mem0AgentResponse') {
                    obj.content = responseObj.content
                } else if (responseObj.work == 'A2AResponse') {
                    let content = responseObj.content
                    content = content.replaceAll('undefined', '')
                    obj.content = content
                    obj.htmlContent = content.replaceAll('\n', '<br>')
                }
                obj.uuid = this.uuid()
                await this.putMessage(obj)
                await this.getMessages(this.agentInfo.id);
            }
        },
    }
}
</script>

<style scoped>
</style>
