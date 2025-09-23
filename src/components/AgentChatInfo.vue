<template>
    <div class="no-scrollbar">
        <div class="pa-4">
            <div class="text-center mb-4">
                <v-avatar :size="isMobile ? 60 : 80" class="mb-3">
                    <!-- 프로필 이미지가 있고 로딩 성공했을 때만 표시 -->
                    <v-img 
                        v-if="agentInfo.profile && imageLoaded && !isDefaultImage(agentInfo.profile)"
                        :src="agentInfo.profile" 
                        :alt="agentInfo.username || 'Agent'"
                        cover
                        @error="handleImageError"
                        @load="handleImageLoad"
                    />
                    
                    <!-- 기본 이미지 (프로필 이미지가 없거나 로딩 실패 시) -->
                    <v-img 
                        v-else
                        src="/images/chat-icon.png" 
                        :alt="agentInfo.username || 'Agent'"
                        cover
                    >
                        <template v-slot:error>
                            <v-icon size="large" style="color: #666;">mdi-account</v-icon>
                        </template>
                    </v-img>
                </v-avatar>
                <h5 v-if="!isMobile" class="text-h6 font-weight-bold mb-1">{{ agentInfo.username || 'Agent' }}</h5>
                <h6 v-else class="text-subtitle-1 font-weight-bold mb-1">{{ agentInfo.username || 'Agent' }}</h6>
                
                <!-- Goal Section - 모든 버전에서 표시 -->
                <div class="pa-0 mb-1">
                    <v-icon size="small" color="primary" class="mr-1">mdi-target</v-icon>
                    <span class="text-body-2 font-weight-medium">목표</span>
                </div>
                <p class="text-body-2 text-medium-emphasis mb-3">{{ agentInfo.goal || '에이전트의 목표가 설정되지 않았습니다.' }}</p>
            </div>
            
            <v-divider class="mb-4"></v-divider>
            
            <!-- Tab Navigation - 모든 버전에서 동일하게 표시 -->
            <v-tabs
                v-model="activeTab"
                direction="vertical"
                color="primary"
                class="agent-tabs"
                @update:model-value="handleTabChange"
            >
                <v-tab value="learning" class="text-left justify-start">
                    <v-icon start class="mr-2">mdi-school</v-icon>
                    학습 모드
                </v-tab>
                <v-tab value="question" class="text-left justify-start">
                    <v-icon start class="mr-2">mdi-chat</v-icon>
                    질의 모드
                </v-tab>
                <v-tab value="actions" class="text-left justify-start">
                    <v-icon start class="mr-2">mdi-tools</v-icon>
                    액션 모드
                </v-tab>
                <v-tab value="knowledge" class="text-left justify-start">
                    <v-icon start class="mr-2">mdi-database</v-icon>
                    지식 관리
                </v-tab>
            </v-tabs>
        </div>
    </div>
</template>

<script>
export default {
    name: 'AgentChatInfo',
    props: {
        agentInfo: {
            type: Object,
            default: () => ({
                id: '',
                profile: '/images/chat-icon.png',
                username: 'Agent',
                goal: '에이전트의 목표가 설정되지 않았습니다.'
            })
        },
        activeTab: {
            type: String,
            default: 'learning'
        },
        isMobile: {
            type: Boolean,
            default: false
        }
    },
    data() {
        return {
            imageLoaded: false,
            currentProfileUrl: ''
        }
    },
    mounted() {
        this.initializeImage();
    },
    watch: {
        agentInfo: {
            handler(newVal) {
                // profile이 실제로 변경되었을 때만 처리
                if (newVal.profile !== this.currentProfileUrl) {
                    this.initializeImage();
                }
            },
            deep: true,
            immediate: true
        }
    },
    methods: {
        handleTabChange(newTab) {
            this.$emit('update:activeTab', newTab);
        },
        
        initializeImage() {
            const profileUrl = this.agentInfo.profile;
            
            // 기본 이미지이거나 URL이 없으면 바로 기본 이미지 표시
            if (this.isDefaultImage(profileUrl)) {
                this.imageLoaded = false;
                this.currentProfileUrl = profileUrl;
                return;
            }
            
            // 새로운 프로필 이미지인 경우 로딩 시도
            if (profileUrl && profileUrl !== this.currentProfileUrl) {
                this.imageLoaded = false;
                this.currentProfileUrl = profileUrl;
                
                // 이미지가 이미 캐시되어 있는지 확인
                this.checkImageCache(profileUrl);
            }
        },
        
        isDefaultImage(url) {
            return !url || url === '/images/chat-icon.png';
        },
        
        checkImageCache(url) {
            const img = new Image();
            
            img.onload = () => {
                console.log('Image loaded successfully:', url);
                this.imageLoaded = true;
            };
            
            img.onerror = () => {
                console.log('Image failed to load:', url);
                this.imageLoaded = false;
            };
            
            // 이미지 로딩 시작
            img.src = url;
        },
        
        handleImageError() {
            console.log('v-img error event triggered');
            this.imageLoaded = false;
        },
        
        handleImageLoad() {
            console.log('v-img load event triggered');
            this.imageLoaded = true;
        }
    }
}
</script>

<style scoped>
.agent-tabs {
    width: 100%;
}

.no-scrollbar {
    overflow-y: auto;
    scrollbar-width: none;
    -ms-overflow-style: none;
}

.no-scrollbar::-webkit-scrollbar {
    display: none;
}
</style>
