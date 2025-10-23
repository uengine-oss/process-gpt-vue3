<template>
    <v-card elevation="10">
        <AppBaseCard>
            <template v-slot:leftpart="{ closeDrawer }">
                <AgentChatInfo 
                    :agentInfo="agentInfo" 
                    :activeTab="activeTab"
                    @update:activeTab="activeTab = $event"
                    @agentUpdated="handleAgentUpdated"
                />
            </template>
            <template v-slot:rightpart>
                <div v-if="activeTab && ['learning', 'question', 'dmn-modeling', 'rule-inference'].includes(activeTab)" class="chat-info-view-wrapper-chats">
                    <component 
                        :is="currentTabComponent" 
                        v-bind="currentTabProps"
                        v-on="currentTabEvents"
                    />
                </div>
                <component 
                    v-else-if="activeTab"
                    :is="currentTabComponent" 
                    v-bind="currentTabProps"
                    v-on="currentTabEvents"
                />
            </template>

            <template v-slot:mobileLeftContent="{ closeDrawer }">
                <AgentChatInfo 
                    :agentInfo="agentInfo" 
                    :activeTab="activeTab"
                    :isMobile="true"
                    @update:activeTab="activeTab = $event"
                    @agentUpdated="handleAgentUpdated"
                />
            </template>
        </AppBaseCard>
    </v-card>
</template>

<script>
import AppBaseCard from '@/components/shared/AppBaseCard.vue';

import AgentChatInfo from "@/components/AgentChatInfo.vue";

// Agent Chat 탭 컴포넌트
import AgentChatLearning from "@/components/AgentChatLearning.vue";
import AgentChatQuestion from "@/components/AgentChatQuestion.vue";
import AgentChatActions from "@/components/AgentChatActions.vue";
import AgentKnowledgeManagement from "@/components/AgentKnowledgeManagement.vue";
import BusinessRuleLearning from "@/components/BusinessRuleLearning.vue";
import BusinessRuleInference from "@/components/BusinessRuleInference.vue";
import BusinessRuleManagement from "@/components/BusinessRuleManagement.vue";

import AgentCrudMixin from '@/mixins/AgentCrudMixin.vue';

import BackendFactory from '@/components/api/BackendFactory';

export default {
    mixins: [AgentCrudMixin],
    components: {
        AppBaseCard,
        AgentChatInfo,
        AgentChatLearning,
        AgentChatQuestion,
        AgentChatActions,
        AgentKnowledgeManagement,
        BusinessRuleLearning,
        BusinessRuleInference,
        BusinessRuleManagement
    },
    data: () => ({
        agentInfo: {
            id: '',
            profile: '/images/chat-icon.png',
            username: 'Agent',
            goal: '에이전트의 목표가 설정되지 않았습니다.',
            agent_type: 'agent',
        },
        activeTab: '',

        // knowledge management
        knowledges: [],
        isLoading: false,

        // action mode
        workItem: null,

        // 탭 설정
        tabHandlers: null,

        // dmn
        dmnList: [],
        selectedDmnId: null,
        
        // backend
        backend: null,
    }),
    computed: {
        id() {
            return this.$route.params.id;
        },
        currentTabComponent() {
            const handler = this.tabHandlers?.[this.activeTab];
            return handler?.component || null;
        },
        currentTabProps() {
            const handler = this.tabHandlers?.[this.activeTab];
            return handler?.props?.(this) || {};
        },
        currentTabEvents() {
            const handler = this.tabHandlers?.[this.activeTab];
            return handler?.events?.(this) || {};
        }
    },
    watch: {
        "$route": {
            async handler(newRoute, oldRoute) {
                // 해시만 변경된 경우는 init을 호출하지 않음
                if (oldRoute && newRoute.path === oldRoute.path && 
                    newRoute.hash !== oldRoute.hash) {
                    return;
                }
                await this.init();
            },
            deep: true
        },
        activeTab: {
            async handler(newVal, oldVal) {
                // 초기 로딩이 아닌 경우에만 URL 해시 업데이트
                if (newVal && oldVal !== '') {
                    window.location.hash = newVal;
                }
                
                const handler = this.tabHandlers?.[newVal];
                if (handler && typeof handler.activate === 'function') {
                    await handler.activate();
                }
            }
        }
    },
    created() {
        this.backend = BackendFactory.createBackend();

        // 탭 핸들러 초기화
        this.setupTabHandlers();
    },
    async mounted() {
        await this.init();

        this.EventBus.on('dmn-deleted', () => {
            this.selectedDmnId = null;
        });
    },
    methods: {
        /**
         * 각 탭의 동작을 정의
         */
        setupTabHandlers() {
            this.tabHandlers = {
                // 학습 모드
                'learning': {
                    component: 'AgentChatLearning',
                    props: (vm) => ({}),
                    events: (vm) => ({
                        stopMessage: vm.stopMessage
                    }),
                    activate: async () => {
                        this.selectedDmnId = null;
                    }
                },

                // 질문 모드
                'question': {
                    component: 'AgentChatQuestion',
                    props: (vm) => ({}),
                    events: (vm) => ({
                        stopMessage: vm.stopMessage
                    }),
                    activate: async () => {
                        this.selectedDmnId = null;
                    }
                },

                // 액션 모드
                'actions': {
                    component: 'AgentChatActions',
                    props: (vm) => ({
                        agentInfo: vm.agentInfo
                    }),
                    events: () => ({}),
                    activate: async () => {
                        this.selectedDmnId = null;
                    }
                },

                // 지식 관리
                'knowledge': {
                    component: 'AgentKnowledgeManagement',
                    props: (vm) => ({
                        knowledges: vm.knowledges,
                        isLoading: vm.isLoading
                    }),
                    events: (vm) => ({
                        deleteKnowledge: vm.deleteKnowledge
                    }),
                    activate: async () => {
                        this.selectedDmnId = null;
                        await this.getKnowledge();
                    }
                },

                // 비즈니스 규칙 학습
                'dmn-modeling': {
                    component: 'BusinessRuleLearning',
                    props: (vm) => ({
                        ownerInfo: vm.agentInfo,
                        dmnId: vm.selectedDmnId
                    }),
                    events: () => ({}),
                    activate: () => {
                    }
                },

                // 비즈니스 규칙 추론
                'rule-inference': {
                    component: 'BusinessRuleInference',
                    props: (vm) => ({
                        ownerInfo: vm.agentInfo,
                        dmnList: vm.dmnList
                    }),
                    events: (vm) => ({
                        stopMessage: vm.stopMessage
                    }),
                    activate: async () => {
                        this.selectedDmnId = null;
                        await this.getDMNList();
                    }
                },

                // 비즈니스 규칙 관리
                'rule-management': {
                    component: 'BusinessRuleManagement',
                    props: (vm) => ({
                        ownerInfo: vm.agentInfo,
                        dmnList: vm.dmnList
                    }),
                    events: (vm) => ({
                        'edit-dmn': vm.goEditDMN
                    }),
                    activate: async () => {
                        this.selectedDmnId = null;
                        await this.getDMNList();
                    }
                }
            };
        },

        async init() {
            this.agentInfo = await this.backend.getUserById(this.id);
            
            // URL 해시가 있으면 해당 탭으로, 없으면 기본 탭으로 설정
            const hashTab = window.location.hash.replace('#', '');
            let selectedTab = '';
            
            // 해시가 있고 유효한 탭이면 해시 우선
            if (hashTab && this.tabHandlers && this.tabHandlers[hashTab]) {
                selectedTab = hashTab;
            } else {
                // 해시가 없거나 유효하지 않으면 기본 탭
                selectedTab = this.agentInfo.agent_type == 'a2a' ? 'actions' : 'learning';
                // 기본 탭으로 설정할 때는 해시도 업데이트
                window.location.hash = selectedTab;
            }
            
            // activeTab이 이미 같은 값이면 watch가 트리거되지 않으므로 수동으로 activate 호출
            const shouldActivate = this.activeTab === selectedTab;
            
            // activeTab 설정
            this.activeTab = selectedTab;
            
            // activeTab이 변경되지 않은 경우 수동으로 activate 호출
            if (shouldActivate) {
                const handler = this.tabHandlers?.[selectedTab];
                if (handler && typeof handler.activate === 'function') {
                    await handler.activate();
                }
            }
        },

        // agent update handler
        async handleAgentUpdated(updatedData) {
            try {
                // 믹스인의 updateAgent 메서드 호출하여 DB 업데이트
                await this.updateAgent(updatedData, 'edit-agent');
                
                // 로컬 agentInfo 업데이트 (실시간 반영)
                this.agentInfo = {
                    ...this.agentInfo,
                    ...updatedData,
                    // 필드명 매핑 (백엔드에서 온 데이터를 UI에서 사용하는 형태로)
                    username: updatedData.username || updatedData.name,
                    profile: updatedData.profile || updatedData.img
                };
                
            } catch (error) {
                console.error('에이전트 수정 실패:', error);
            }
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
        },

        // DMN
        async getDMNList() {
            let options = null;
            if (this.agentInfo && this.agentInfo.id) {
                options = {
                    match: {
                        owner: this.agentInfo.id,
                        type: "dmn"
                    }
                }
            }
            this.dmnList = await this.backend.listDefinition("dmn", options);
        },
        goEditDMN(id) {
            this.selectedDmnId = id;
            this.activeTab = 'dmn-modeling';
        },
    }
}
</script>
