<template>
    <div v-if="agentInfo">
        <div v-if="!editDialog && !toolPriorityDialog">
            <!-- 편집 모드가 아닐 때만 일반 화면 표시 (지식 셋팅 중일 때 테두리 linear progress) -->
            <div class="agent-info-area" :class="{ 'agent-info-area--setup-in-progress': isKnowledgeSetupInProgress }">
                <v-row class="align-center pa-4 ma-0">
                    <v-avatar size="24" class="mr-2 flex-shrink-0">
                        <!-- 프로필 이미지가 있고 로딩 성공했을 때만 표시 -->
                        <v-img 
                            v-if="agentInfo?.profile && imageLoaded && !isDefaultImage(agentInfo?.profile)"
                            :src="agentInfo?.profile" 
                            :alt="agentInfo?.username || $t('AgentChatInfo.defaultAgentName')"
                            cover
                            @error="handleImageError"
                            @load="handleImageLoad"
                        />
                        
                        <!-- 기본 이미지 (프로필 이미지가 없거나 로딩 실패 시) -->
                        <v-img 
                            v-else
                            src="/images/chat-icon.png" 
                            :alt="agentInfo?.username || $t('AgentChatInfo.defaultAgentName')"
                            cover
                        >
                            <template v-slot:error>
                                <v-icon size="large" style="color: #666;">mdi-account</v-icon>
                            </template>
                        </v-img>
                    </v-avatar>
                    <div class="agent-name-wrapper flex-grow-1 min-width-0">
                        <h5 v-if="!isMobile" class="text-h6 font-weight-bold agent-name-text">{{ agentInfo?.username || $t('AgentChatInfo.defaultAgentName') }}</h5>
                        <h6 v-else class="text-subtitle-1 font-weight-bold agent-name-text">{{ agentInfo?.username || $t('AgentChatInfo.defaultAgentName') }}</h6>
                    </div>
                    
                    <!-- 수정 버튼 -->
                    <v-btn 
                        v-if="!agentInfo?.is_default"
                        @click="openEditDialog"
                        variant="text"
                        :size="24"
                        icon
                        class="rounded-pill flex-shrink-0 mr-1"
                    >
                        <Icons :icon="'pencil'" :size="14"/>
                    </v-btn>
                    <!-- 도구 우선순위 지정 버튼 -->
                    <v-btn 
                        v-if="!agentInfo?.is_default && !gs"
                        @click="openToolPriorityDialog"
                        variant="text"
                        :size="24"
                        icon
                        class="rounded-pill flex-shrink-0 ml-1"
                    >
                        <v-icon size="18">mdi-sort</v-icon>
                        <v-tooltip activator="parent" location="bottom">
                            {{ $t('agentField.toolPriorityButton') }}
                        </v-tooltip>
                    </v-btn>
                </v-row>

                <template v-if="isKnowledgeSetupInProgress">
                    <v-progress-linear indeterminate color="primary" class="agent-info-area__progress" />
                    <div class="agent-info-area__label text-caption text-medium-emphasis px-3 py-1">
                        {{ $t('AgentChatInfo.knowledgeSetupInProgress') }}
                    </div>
                </template>
                
                <div class="agent-chat-info-content pa-4">
                    <!-- Goal Section (agent only) -->
                    <div v-if="isSectionVisible('goal')" class="pa-0 mb-1">
                        <v-icon size="small" class="mr-1">mdi-target</v-icon>
                        <span class="text-body-2 font-weight-medium">{{ $t('AgentChatInfo.labels.goal') }}</span>
                    </div>
                    <p v-if="isSectionVisible('goal')" class="text-body-2 text-medium-emphasis mb-3">
                        {{ getDisplayText(agentInfo?.goal || $t('AgentChatInfo.fallback.goal'), 'goal', 50) }}
                        <v-btn
                            v-if="shouldShowToggleButton(agentInfo?.goal || $t('AgentChatInfo.fallback.goal'), 50)"
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

                    <!-- Persona Section (agent only) -->
                    <div v-if="isSectionVisible('persona')" class="pa-0 mb-1">
                        <v-icon size="small" class="mr-1">mdi-account-tie</v-icon>
                        <span class="text-body-2 font-weight-medium">{{ $t('AgentChatInfo.labels.persona') }}</span>
                    </div>
                    <p v-if="isSectionVisible('persona')" class="text-body-2 text-medium-emphasis mb-3">
                        {{ getDisplayText(agentInfo?.persona, 'persona', 50) }}
                        <v-btn
                            v-if="shouldShowToggleButton(agentInfo?.persona, 50)"
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
                    
                    <!-- Tools Section (agent only) -->
                    <div v-if="isSectionVisible('tools')">
                        <div class="pa-0 mb-1">
                            <v-icon size="small" class="mr-1">mdi-tools</v-icon>
                            <span class="text-body-2 font-weight-medium">{{ $t('AgentChatInfo.labels.tools') }}</span>
                        </div>
                        <div v-if="parsedTools && parsedTools.length > 0" class="mb-3">
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
                        <p v-else class="text-body-2 text-medium-emphasis mb-3">{{ $t('AgentChatInfo.empty.tools') }}</p>
                    </div>

                    <!-- Endpoint Section (a2a only) -->
                    <div v-if="isSectionVisible('endpoint')" class="pa-0 mb-1">
                        <v-icon size="small" class="mr-1">mdi-cloud-outline</v-icon>
                        <span class="text-body-2 font-weight-medium">{{ $t('AgentChatInfo.labels.endpoint') }}</span>
                    </div>
                    <p v-if="isSectionVisible('endpoint')" class="text-body-2 text-medium-emphasis mb-3">
                        {{ getDisplayText(agentInfo?.endpoint, 'endpoint', 50) }}
                        <v-btn
                            v-if="shouldShowToggleButton(agentInfo?.endpoint, 50)"
                            @click="toggleTextExpansion('endpoint')"
                            variant="text"
                            size="small"
                            color="primary"
                            class="pa-0 text-caption ml-1"
                            style="min-width: auto; height: auto; vertical-align: baseline;"
                        >
                            {{ expandedTexts.endpoint ? $t('AgentChatInfo.collapse') : $t('AgentChatInfo.expand') }}
                        </v-btn>
                    </p>

                    <!-- Description Section (a2a / pgagent) -->
                    <div v-if="isSectionVisible('description')" class="pa-0 mb-1">
                        <v-icon size="small" class="mr-1">mdi-text</v-icon>
                        <span class="text-body-2 font-weight-medium">{{ $t('AgentChatInfo.labels.description') }}</span>
                    </div>
                    <p v-if="isSectionVisible('description')" class="text-body-2 text-medium-emphasis mb-3">
                        {{ getDisplayText(agentInfo?.description, 'description', 50) }}
                        <v-btn
                            v-if="shouldShowToggleButton(agentInfo?.description, 50)"
                            @click="toggleTextExpansion('description')"
                            variant="text" size="small" color="primary" class="pa-0 text-caption ml-1" style="min-width: auto; height: auto; vertical-align: baseline;">
                            {{ expandedTexts.description ? $t('AgentChatInfo.collapse') : $t('AgentChatInfo.expand') }}
                        </v-btn>
                    </p>

                    <!-- Alias Section (pgagent only; a2a alias는 기본값/숨김) -->
                    <div v-if="isSectionVisible('alias')" class="pa-0 mb-1">
                        <v-icon size="small" class="mr-1">mdi-account-box-outline</v-icon>
                        <span class="text-body-2 font-weight-medium">{{ $t('AgentChatInfo.labels.alias') }}</span>
                    </div>
                    <p v-if="isSectionVisible('alias')" class="text-body-2 text-medium-emphasis mb-3">
                        {{ agentInfo?.alias }}
                    </p>

                    <!-- Skills Section (agent / a2a / pgagent) -->
                    <div v-if="isSectionVisible('skills')">
                        <div class="pa-0 mb-1">
                            <v-icon size="small" class="mr-1">mdi-brain</v-icon>
                            <span class="text-body-2 font-weight-medium">{{ $t('AgentSkills.skills') }}</span>
                        </div>
                        <v-chip-group v-if="parsedSkills && parsedSkills.length > 0" class="mb-3">
                            <v-chip
                                v-for="skill in parsedSkills"
                                :key="skill"
                                size="small"
                                variant="outlined"
                                class="ma-1"
                            >
                                {{ skill }}
                            </v-chip>
                        </v-chip-group>
                        <p v-else class="text-body-2 text-medium-emphasis mb-3">{{ $t('AgentChatInfo.empty.skills') }}</p>
                    </div>

                    <!-- Model Section (agent only) -->
                    <div v-if="isSectionVisible('model')">
                        <div class="pa-0 mb-1">
                            <v-icon size="small" class="mr-1">mdi-robot</v-icon>
                            <span class="text-body-2 font-weight-medium">{{ $t('AgentChatInfo.labels.model') }}</span>
                        </div>
                        <p v-if="agentInfo?.model" class="text-body-2 text-medium-emphasis mb-3">
                            {{ agentInfo?.model }}
                        </p>
                        <p v-else class="text-body-2 text-medium-emphasis mb-3">{{ $t('AgentChatInfo.empty.model') }}</p>
                    </div>
                    
                    <v-divider class="mb-4"></v-divider>
                    
                    <!-- Tab Navigation - 편집 모드가 아닐 때만 표시 (클릭으로만 전환, 해시/쿼리 미사용) -->
                    <v-tabs
                        :model-value="activeTab"
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
                    <div v-if="!editDialog && agentType === 'agent'">
                        <v-divider class="mb-4"></v-divider>
                        <div class="d-flex align-center mb-1">
                            <span class="text-body-2 font-weight-medium mr-1">{{ $t('AgentChatInfo.businessRule') }}</span>
                            <v-btn size="x-small" variant="text" icon @click="$emit('openNewDmn')">
                                <v-icon>mdi-plus</v-icon>
                            </v-btn>
                            <v-btn
                                v-if="agentType === 'agent' && agentInfo.id"
                                size="x-small"
                                variant="text"
                                icon
                                class="ml-auto"
                                @click="openDmnHistory"
                            >
                                <v-icon>mdi-history</v-icon>
                                <v-tooltip activator="parent" location="left">
                                    비즈니스 규칙 변경 이력
                                </v-tooltip>
                            </v-btn>
                        </div>
                        <v-tabs
                            v-if="dmnList.length > 0"
                            :model-value="selectedDmnId"
                            direction="vertical"
                            color="primary"
                            class="agent-tabs"
                        >
                            <v-tab
                                v-for="dmn in dmnTabList"
                                :key="dmn.id"
                                :value="dmn.id"
                                class="text-left justify-start"
                                @click="handleDmnClick(dmn.id)"
                            >
                                <Icons :icon="dmn.icon" :size="16" class="mr-2"/>
                                {{ dmn.label }}
                            </v-tab>
                        </v-tabs>
                    </div>
                </div>
            </div>
        </div>

        <div v-else-if="!editDialog && toolPriorityDialog && !gs">
            <AgentToolPriority
                :modelValue="toolPriorityDialog"
                :agentInfo="agentInfo"
                @update:modelValue="toolPriorityDialog = $event"
                @agentUpdated="onToolPriorityUpdated"
                @close="toolPriorityDialog = false"
            />
        </div>

        <!-- 편집 모드일 때 OrganizationEditDialog 표시 -->
        <div v-else>
            <OrganizationEditDialog
                class="agent-chat-info-organization-edit-dialog"
                :dialogType="'edit-agent'"
                :editNode="editNode"
                @updateNode="updateAgent"
                @closeDialog="closeEditDialog"
                @deleteAgent="onDeleteAgent"
            />
        </div>
    </div>
</template>

<script>
import OrganizationEditDialog from '@/components/ui/OrganizationEditDialog.vue';
import AgentToolPriority from '@/components/AgentToolPriority.vue';
import BackendFactory from '@/components/api/BackendFactory';

export default {
    name: 'AgentChatInfo',
    components: {
        OrganizationEditDialog,
        AgentToolPriority
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
        },
        isSkillLoading: {
            type: Boolean,
            default: false
        },
        selectedDmnId: {
            type: String,
            default: null
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
                tools: false,
                description: false,
                endpoint: false
            },
            editProperties: {
                goal: {
                    abled: false,
                    action: () => {}
                },
                persona: {
                    abled: false,
                    action: () => {}
                },
                description: {
                    abled: false,
                    action: () => {}
                },
                tools: {
                    abled: false,
                    action: () => {}
                },
                endpoint: {
                    abled: false,
                    action: () => {}
                },
                model: {
                    abled: false,
                    action: () => {}
                }
            },
            agentType: 'agent',
            toolPriorityDialog: false,

            backend: null,
            knowledgeSetupChannel: null,
            isKnowledgeSetupInProgress: false
        }
    },
    created() {
        this.backend = BackendFactory.createBackend();
    },
    mounted() {
        this.initializeImage();
    },
    beforeUnmount() {
        this.unsubscribeKnowledgeSetup();
    },
    computed: {
        gs() {
            return window.$gs;
        },
        tabList() {
            if (this.agentInfo?.agent_type == 'agent') {
                this.agentType = 'agent';
                return [
                    { label: this.$t('AgentChatInfo.tabs.chat'), value: 'chat', icon: 'mdi-message-text-outline' },
                    { label: this.$t('AgentChatInfo.tabs.learning'), value: 'learning', icon: 'mdi-school' },
                    { label: this.$t('AgentChatInfo.tabs.question'), value: 'question', icon: 'mdi-chat' },
                    { label: this.$t('AgentChatInfo.tabs.actions'), value: 'actions', icon: 'mdi-tools' },
                    { label: this.$t('AgentChatInfo.tabs.knowledge'), value: 'knowledge', icon: 'mdi-database' },
                ]
            } else {
                this.agentType = this.agentInfo?.agent_type;
                return [
                    { label: this.$t('AgentChatInfo.tabs.chat'), value: 'chat', icon: 'mdi-message-text-outline' },
                    { label: this.$t('AgentChatInfo.tabs.actions'), value: 'actions', icon: 'mdi-tools' }
                ]
            }
        },
        
        parsedTools() {
            if (!this.agentInfo?.tools) return [];
            
            // tools가 문자열인 경우 (쉼표로 구분된 값들)
            if (typeof this.agentInfo?.tools === 'string') {
                return this.agentInfo?.tools
                    .split(',')
                    .map(tool => tool.trim())
                    .filter(tool => tool.length > 0);
            }
            
            // tools가 배열인 경우
            if (Array.isArray(this.agentInfo?.tools)) {
                return this.agentInfo?.tools.filter(tool => tool && tool.trim().length > 0);
            }
            
            return [];
        },

        parsedSkills() {
            if (!this.agentInfo?.skills || this.agentInfo?.skills === '' || this.agentInfo?.agent_type === 'pgagent') return null;

            if (typeof this.agentInfo?.skills === 'string') {
                if (this.agentInfo?.skills.includes(',')) {
                    return this.agentInfo?.skills
                        .split(',')
                        .map(skill => skill.trim())
                        .filter(skill => skill.length > 0);
                } else {
                    return [this.agentInfo?.skills.trim()];
                }
            }
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
                if (newVal) {
                    // profile이 실제로 변경되었을 때만 처리
                    if (newVal.profile !== this.currentProfileUrl) {
                        this.initializeImage();
                    }
                }
            },
            deep: true,
            immediate: true
        },
        'agentInfo.id': {
            handler(agentId) {
                this.unsubscribeKnowledgeSetup();
                if (agentId && this.backend?.watchData && this.backend?.getAgentKnowledgeSetupLog) {
                    this.subscribeKnowledgeSetup(agentId);
                }
            },
            immediate: true
        }
    },
    methods: {
        handleTabChange(newTab) {
            this.$emit('tabChange', newTab);
        },

        handleDmnClick(dmnId) {
            this.$emit('dmnChange', dmnId);
        },

        /** 에이전트 초기 지식 셋업 상태 실시간 구독 (STARTED 또는 로그 없을 때만, DONE/FAILED 시 부모에 갱신 요청 후 해제) */
        async subscribeKnowledgeSetup(agentId) {
            this.unsubscribeKnowledgeSetup();
            this.isKnowledgeSetupInProgress = false;
            if (!agentId || !this.backend?.watchData || !this.backend?.getAgentKnowledgeSetupLog) return;
            try {
                const log = await this.backend.getAgentKnowledgeSetupLog(agentId);
                if (log && (log.status === 'DONE' || log.status === 'FAILED')) return;
                this.isKnowledgeSetupInProgress = true;
                const channel = `agent-knowledge-setup-${agentId}-${Date.now()}`;
                this.knowledgeSetupChannel = await this.backend.watchData('agent_knowledge_setup_log', channel, (payload) => {
                    if (!payload?.new || (payload.eventType !== 'INSERT' && payload.eventType !== 'UPDATE')) return;
                    const row = payload.new;
                    if (row.agent_id !== agentId) return;
                    if (row.status === 'DONE' || row.status === 'FAILED') {
                        this.isKnowledgeSetupInProgress = false;
                        this.$emit('knowledgeSetupDone');
                        this.unsubscribeKnowledgeSetup();
                    }
                }, { filter: `agent_id=eq.${agentId}` });
            } catch (e) {
                this.isKnowledgeSetupInProgress = false;
                console.warn('[AgentChatInfo] 초기 지식 셋업 구독 실패:', e);
            }
        },

        unsubscribeKnowledgeSetup() {
            if (this.knowledgeSetupChannel && window.$supabase) {
                window.$supabase.removeChannel(this.knowledgeSetupChannel);
            }
            this.knowledgeSetupChannel = null;
            this.isKnowledgeSetupInProgress = false;
        },
        
        initializeImage() {
            const profileUrl = this.agentInfo?.profile;
            
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

        /**
         * 타입별로 어떤 섹션을 노출할지 정의
         * - agent: goal, persona, tools, skills, model
         * - a2a: endpoint, description, skills (alias는 기본값/숨김)
         * - pgagent: alias, description, skills
         */
        getSectionConfig() {
            return {
                agent: ['goal', 'persona', 'tools', 'skills', 'model'],
                a2a: ['endpoint', 'description', 'skills'],
                pgagent: ['alias', 'description', 'skills']
            };
        },

        getCurrentAgentType() {
            return this.agentInfo && this.agentInfo?.agent_type ? this.agentInfo?.agent_type : this.agentType || 'agent';
        },

        isSectionVisible(section) {
            const config = this.getSectionConfig();
            const type = this.getCurrentAgentType();
            const sections = config[type] || config.agent;
            return sections.includes(section);
        },

        openEditDialog() {
            // agentInfo 데이터를 editNode 형태로 변환 (AgentField가 기대하는 구조에 맞춤)
            // 먼저 agentInfo를 복사하고, 키가 다른 항목만 매핑
            this.editNode = {
                data: {
                    ...this.agentInfo,
                    name: this.agentInfo?.username || this.agentInfo?.name || this.$t('AgentChatInfo.defaultAgentName'),
                    img: this.agentInfo?.profile || this.agentInfo?.img || '',
                    type: this.agentInfo?.agent_type || this.agentInfo?.type || 'agent',
                    isAgent: true
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
        onDeleteAgent(editNode) {
            this.$emit('deleteAgent', editNode);
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
        },

        openDmnHistory() {
            this.$emit('tabChange', 'dmn-history');
        },

        openToolPriorityDialog() {
            this.toolPriorityDialog = true;
        },

        onToolPriorityUpdated(updatedData) {
            this.$emit('agentUpdated', updatedData);
        }
    }
}
</script>

<style scoped>
.agent-info-area__progress {
    margin: 0;
}

.agent-info-area__label {
    padding-top: 2px;
    padding-bottom: 2px;
}

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
