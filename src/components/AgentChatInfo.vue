<template>
    <div>
        <div v-if="!editDialog">
            <!-- 편집 모드가 아닐 때만 일반 화면 표시 -->
            <div class="text-left">
                <v-row class="align-start pa-4 ma-0">
                    <v-avatar size="24" class="mr-2 flex-shrink-0">
                        <!-- 프로필 이미지가 있고 로딩 성공했을 때만 표시 -->
                        <v-img 
                            v-if="agentInfo.profile && imageLoaded && !isDefaultImage(agentInfo.profile)"
                            :src="agentInfo.profile" 
                            :alt="agentInfo.username || $t('AgentChatInfo.defaultAgentName')"
                            cover
                            @error="handleImageError"
                            @load="handleImageLoad"
                        />
                        
                        <!-- 기본 이미지 (프로필 이미지가 없거나 로딩 실패 시) -->
                        <v-img 
                            v-else
                            src="/images/chat-icon.png" 
                            :alt="agentInfo.username || $t('AgentChatInfo.defaultAgentName')"
                            cover
                        >
                            <template v-slot:error>
                                <v-icon size="large" style="color: #666;">mdi-account</v-icon>
                            </template>
                        </v-img>
                    </v-avatar>
                    <div class="agent-name-wrapper">
                        <h5 v-if="!isMobile" class="text-h6 font-weight-bold agent-name-text">{{ agentInfo.username || $t('AgentChatInfo.defaultAgentName') }}</h5>
                        <h6 v-else class="text-subtitle-1 font-weight-bold agent-name-text">{{ agentInfo.username || $t('AgentChatInfo.defaultAgentName') }}</h6>
                    </div>
                    
                    <!-- 수정 버튼 -->
                    <v-btn 
                        @click="openEditDialog"
                        variant="text"
                        :size="20"
                        icon
                        class="rounded-pill flex-shrink-0 ml-2"
                    >
                        <Icons :icon="'pencil'" :size="14"/>
                    </v-btn>
                </v-row>
                
                <div class="agent-chat-info-content pa-4">
                    <!-- Goal Section - 모든 버전에서 표시 -->
                    <div class="pa-0 mb-1">
                        <v-icon size="small" class="mr-1">mdi-target</v-icon>
                        <span class="text-body-2 font-weight-medium">{{ $t('AgentChatInfo.labels.goal') }}</span>
                    </div>
                    <p class="text-body-2 text-medium-emphasis mb-3">
                        {{ getDisplayText(agentInfo.goal || $t('AgentChatInfo.fallback.goal'), 'goal', 50) }}
                        <v-btn
                            v-if="shouldShowToggleButton(agentInfo.goal || $t('AgentChatInfo.fallback.goal'), 50)"
                            @click="toggleTextExpansion('goal')"
                            variant="text"
                            size="small"
                            color="primary"
                            class="pa-0 text-caption ml-1"
                            style="min-width: auto; height: auto; vertical-align: baseline;"
                        >
                            {{ expandedTexts.goal ? $t('AgentChatInfo.collapse') : $t('AgentChatInfo.expand') }}
                        </v-btn>
                    </p>

                    <!-- Persona Section -->
                    <div v-if="agentInfo.persona" class="pa-0 mb-1">
                        <v-icon size="small" class="mr-1">mdi-account-tie</v-icon>
                        <span class="text-body-2 font-weight-medium">{{ $t('AgentChatInfo.labels.persona') }}</span>
                    </div>
                    <p v-if="agentInfo.persona" class="text-body-2 text-medium-emphasis mb-3">
                        {{ getDisplayText(agentInfo.persona, 'persona', 50) }}
                        <v-btn
                            v-if="shouldShowToggleButton(agentInfo.persona, 50)"
                            @click="toggleTextExpansion('persona')"
                            variant="text"
                            size="small"
                            color="primary"
                            class="pa-0 text-caption ml-1"
                            style="min-width: auto; height: auto; vertical-align: baseline;"
                        >
                            {{ expandedTexts.persona ? $t('AgentChatInfo.collapse') : $t('AgentChatInfo.expand') }}
                        </v-btn>
                    </p>
                    
                    <!-- Tools Section -->
                    <div v-if="agentInfo.tools && agentInfo.tools.length > 0" class="pa-0 mb-1">
                        <v-icon size="small" class="mr-1">mdi-tools</v-icon>
                        <span class="text-body-2 font-weight-medium">{{ $t('AgentChatInfo.labels.tools') }}</span>
                    </div>
                    <div v-if="agentInfo.tools && agentInfo.tools.length > 0" class="mb-3">
                        <v-chip-group class="tools-chips">
                            <v-chip 
                                v-for="tool in getDisplayTools()" 
                                :key="tool"
                                size="small"
                                color="success"
                                variant="outlined"
                                class="ma-1"
                            >
                                {{ tool }}
                            </v-chip>
                            <v-btn
                                v-if="shouldShowToolsToggle()"
                                @click="toggleTextExpansion('tools')"
                                variant="text"
                                size="small"
                                color="primary"
                                class="pa-0 text-caption ma-1"
                                style="min-width: auto; height: auto; vertical-align: middle;"
                            >
                                {{ expandedTexts.tools ? $t('AgentChatInfo.collapse') : $t('AgentChatInfo.expand') }}
                            </v-btn>
                        </v-chip-group>
                    </div>
                    <v-divider class="mb-4"></v-divider>
                    
                    <!-- Tab Navigation - 편집 모드가 아닐 때만 표시 -->
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

                    <!-- DMN Tabs -->
                    <div v-if="!editDialog && agentType !== 'a2a'">
                        <v-divider class="mb-4"></v-divider>
                        <span class="text-body-2 font-weight-medium">{{ $t('AgentChatInfo.businessRule') }}</span>
                        <v-btn size="x-small" variant="text" icon @click="handleDmnChange(null)">
                            <v-icon>mdi-plus</v-icon>
                        </v-btn>
                        <v-tabs
                            v-if="dmnList.length > 0"
                            v-model="selectedDmnId"
                            direction="vertical"
                            color="primary"
                            class="agent-tabs"
                            @update:model-value="handleDmnChange"
                        >
                            <v-tab v-for="dmn in dmnTabList" :key="dmn.id" :value="dmn.id" class="text-left justify-start" @click="handleDmnChange(dmn.id)">
                                <Icons :icon="dmn.icon" :size="16" class="mr-2"/>
                                {{ dmn.label }}
                            </v-tab>
                        </v-tabs>
                    </div>
                </div>
            </div>
        </div>

        <!-- 편집 모드일 때 OrganizationEditDialog 표시 -->
        <div v-else>
            <OrganizationEditDialog class="agent-chat-info-organization-edit-dialog"
                :dialogType="'edit-agent'"
                :editNode="editNode"
                @updateNode="updateAgent"
                @closeDialog="closeEditDialog"
            />
        </div>
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
                username: '',
                goal: ''
            })
        },
        activeTab: {
            type: String,
            default: 'learning'
        },
        isMobile: {
            type: Boolean,
            default: false
        },
        dmnList: {
            type: Array,
            default: () => []
        }
    },
    data() {
        return {
            imageLoaded: false,
            currentProfileUrl: '',
            editDialog: false,
            editNode: {
                data: {}
            },
            expandedTexts: {
                goal: false,
                persona: false,
                tools: false
            },
            agentType: 'agent',
            selectedDmnId: null
        }
    },
    mounted() {
        this.initializeImage();
    },
    computed: {
        tabList() {
            if (this.agentInfo.agent_type == 'a2a') {
                this.agentType = 'a2a';
                return [
                    { label: this.$t('AgentChatInfo.tabs.actions'), value: 'actions', icon: 'mdi-tools' }
                ]
            } else {
                this.agentType = 'agent';
                return [
                    { label: this.$t('AgentChatInfo.tabs.learning'), value: 'learning', icon: 'mdi-school' },
                    { label: this.$t('AgentChatInfo.tabs.question'), value: 'question', icon: 'mdi-chat' },
                    { label: this.$t('AgentChatInfo.tabs.actions'), value: 'actions', icon: 'mdi-tools' },
                    { label: this.$t('AgentChatInfo.tabs.knowledge'), value: 'knowledge', icon: 'mdi-database' },
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
        },

        dmnTabList() {
            return this.dmnList.map(dmn => ({
                id: dmn.id,
                label: dmn.name,
                icon: 'sidebarDMN'
            }));
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
        },
        $route: {
            handler(newVal) {
                if (newVal.query.dmnId) {
                    this.selectedDmnId = newVal.query.dmnId;
                }
            },
            deep: true
        }
    },
    methods: {
        handleTabChange(newTab) {
            this.$router.push({ hash: '#' + newTab });
            this.selectedDmnId = null;
        },

        handleDmnChange(dmnId) {
            if (dmnId) {
                this.selectedDmnId = dmnId;
                this.$router.push({ query: { dmnId: dmnId }, hash: '#dmn-modeling' });
            } else {
                this.selectedDmnId = null;
                this.$router.push({ query: {}, hash: '#dmn-modeling' });
            }
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
                    name: this.agentInfo.username || this.agentInfo.name || this.$t('AgentChatInfo.defaultAgentName'),
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
        },

        getTruncatedText(text, maxLength) {
            if (!text || text.length <= maxLength) {
                return text;
            }
            return text.substring(0, maxLength) + '...';
        },

        shouldShowToggleButton(text, maxLength) {
            return text && text.length > maxLength;
        },

        toggleTextExpansion(textType) {
            this.expandedTexts[textType] = !this.expandedTexts[textType];
        },

        getDisplayText(text, textType, maxLength) {
            if (!text) return '';
            
            const isExpanded = this.expandedTexts[textType];
            return isExpanded ? text : this.getTruncatedText(text, maxLength);
        },

        getDisplayTools() {
            const isExpanded = this.expandedTexts.tools;
            return isExpanded ? this.parsedTools : this.parsedTools.slice(0, 4);
        },

        shouldShowToolsToggle() {
            return this.parsedTools && this.parsedTools.length > 4;
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

.tools-chips .v-chip {
    margin: 2px !important;
    font-size: 11px !important;
    height: 24px !important;
}

.agent-name-wrapper {
    flex: 1;
    min-width: 0;
}

.agent-name-text {
    word-break: break-word;
    white-space: normal;
    margin: 0;
    text-align: left !important;
}

/* 반응형 디자인 */
@media (max-width: 768px) {
    .tools-chips .v-chip {
        font-size: 10px !important;
        height: 22px !important;
    }
}
</style>
