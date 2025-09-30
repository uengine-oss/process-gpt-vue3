<template>
    <div class="no-scrollbar">
        <div class="pa-4">
            <div class="text-left mb-4">
                <div class="text-center">
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
                </div>
                
                <!-- Goal Section - 모든 버전에서 표시 -->
                <div class="pa-0 mb-1">
                    <v-icon size="small" class="mr-1">mdi-target</v-icon>
                    <span class="text-body-2 font-weight-medium">목표</span>
                </div>
                <p class="text-body-2 text-medium-emphasis mb-3">{{ agentInfo.goal || '에이전트의 목표가 설정되지 않았습니다.' }}</p>
                
                <!-- Persona Section -->
                <div v-if="agentInfo.persona" class="pa-0 mb-1">
                    <v-icon size="small" class="mr-1">mdi-account-tie</v-icon>
                    <span class="text-body-2 font-weight-medium">페르소나</span>
                </div>
                <p v-if="agentInfo.persona" class="text-body-2 text-medium-emphasis mb-3">{{ agentInfo.persona }}</p>
                
                <!-- Tools Section -->
                <div v-if="agentInfo.tools && agentInfo.tools.length > 0" class="pa-0 mb-1">
                    <v-icon size="small" class="mr-1">mdi-tools</v-icon>
                    <span class="text-body-2 font-weight-medium">도구 목록</span>
                </div>
                <div v-if="agentInfo.tools && agentInfo.tools.length > 0" class="mb-3">
                    <v-chip-group class="tools-chips">
                        <v-chip 
                            v-for="tool in parsedTools" 
                            :key="tool"
                            size="small"
                            color="success"
                            variant="outlined"
                            class="ma-1"
                        >
                            {{ tool }}
                        </v-chip>
                    </v-chip-group>
                </div>
            </div>

            <v-row class="ma-0 pa-0 pb-4">
                <v-spacer></v-spacer>
                <!-- 수정 버튼 -->
                <v-btn 
                    @click="openEditDialog"
                    color="primary"
                    variant="elevated" 
                    class="rounded-pill"
                >
                    {{ $t('organizationChartDefinition.edit') }}
                </v-btn>
            </v-row>
            
            <v-divider class="mb-4"></v-divider>
            
            <!-- Tab Navigation - 모든 버전에서 동일하게 표시 -->
            <v-tabs
                v-model="activeTab"
                direction="vertical"
                color="primary"
                class="agent-tabs"
                @update:model-value="handleTabChange"
            >
                <v-tab v-for="tab in tabList" :key="tab.value" :value="tab.value" class="text-left justify-start">
                    <v-icon start class="mr-2">{{ tab.icon }}</v-icon>
                    {{ tab.label }}
                </v-tab>
            </v-tabs>
        </div>

        <!-- 에이전트 수정 다이얼로그 -->
        <v-dialog 
            v-model="editDialog" 
            :max-width="isMobile ? '100vw' : 500"
            :fullscreen="isMobile"
        >
            <OrganizationEditDialog
                :dialogType="'edit-agent'"
                :editNode="editNode"
                @updateNode="updateAgent"
                @closeDialog="closeEditDialog"
            />
        </v-dialog>
    </div>
</template>

<script>
import OrganizationEditDialog from '@/components/ui/OrganizationEditDialog.vue';

export default {
    name: 'AgentChatInfo',
    components: {
        OrganizationEditDialog
    },
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
            currentProfileUrl: '',
            editDialog: false,
            editNode: {
                data: {}
            }
        }
    },
    mounted() {
        this.initializeImage();
    },
    computed: {
        tabList() {
            if (this.agentInfo.agent_type == 'a2a') {
                return [
                    { label: '액션 모드', value: 'actions', icon: 'mdi-tools' }
                ]
            } else {
                return [
                    { label: '학습 모드', value: 'learning', icon: 'mdi-school' },
                    { label: '질의 모드', value: 'question', icon: 'mdi-chat' },
                    { label: '액션 모드', value: 'actions', icon: 'mdi-tools' },
                    { label: '지식 관리', value: 'knowledge', icon: 'mdi-database' },
                ]
            }
        },
        
        parsedTools() {
            if (!this.agentInfo.tools) return [];
            
            // tools가 문자열인 경우 (쉼표로 구분된 값들)
            if (typeof this.agentInfo.tools === 'string') {
                return this.agentInfo.tools
                    .split(',')
                    .map(tool => tool.trim())
                    .filter(tool => tool.length > 0);
            }
            
            // tools가 배열인 경우
            if (Array.isArray(this.agentInfo.tools)) {
                return this.agentInfo.tools.filter(tool => tool && tool.trim().length > 0);
            }
            
            return [];
        }
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
                this.imageLoaded = true;
            };
            
            img.onerror = () => {
                this.imageLoaded = false;
            };
            
            // 이미지 로딩 시작
            img.src = url;
        },
        
        handleImageError() {
            this.imageLoaded = false;
        },
        
        handleImageLoad() {
            this.imageLoaded = true;
        },

        openEditDialog() {
            // agentInfo 데이터를 editNode 형태로 변환 (AgentField가 기대하는 구조에 맞춤)
            this.editNode = {
                data: {
                    id: this.agentInfo.id || '',
                    name: this.agentInfo.username || this.agentInfo.name || 'Agent',
                    email: this.agentInfo.email || '',
                    role: this.agentInfo.role || '',
                    goal: this.agentInfo.goal || '',
                    persona: this.agentInfo.persona || '',
                    endpoint: this.agentInfo.endpoint || '',
                    description: this.agentInfo.description || '',
                    skills: this.agentInfo.skills || '',
                    img: this.agentInfo.profile || this.agentInfo.img || '',
                    model: this.agentInfo.model || '',
                    type: this.agentInfo.agent_type || this.agentInfo.type || 'agent',
                    isAgent: true,
                    tools: this.agentInfo.tools || ''
                }
            };
            
            this.editDialog = true;
        },

        closeEditDialog() {
            this.editDialog = false;
        },

        updateAgent(dialogType, editNode) {
            // 부모 컴포넌트로 수정 이벤트 전달
            this.$emit('agentUpdated', editNode.data);
            this.closeEditDialog();
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

.tools-chips {
    max-height: 120px;
    overflow-y: auto;
}

.tools-chips .v-chip {
    margin: 2px !important;
    font-size: 11px !important;
    height: 24px !important;
}

/* 반응형 디자인 */
@media (max-width: 768px) {
    .tools-chips {
        max-height: 100px;
    }
    
    .tools-chips .v-chip {
        font-size: 10px !important;
        height: 22px !important;
    }
}
</style>
