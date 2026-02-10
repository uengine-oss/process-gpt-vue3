<template>
    <v-card elevation="10">
        <AppBaseCard>
            <template v-slot:leftpart="{ closeDrawer }">
                <AgentChatInfo 
                    :agentInfo="agentInfo" 
                    :activeTab="activeTab"
                    :selectedDmnId="selectedDmnId"
                    :dmnList="dmnList"
                    :isSkillLoading="isSkillLoading"
                    @agentUpdated="handleAgentUpdated"
                    @openSkillFile="openSkillFile"
                    @deleteAgent="handleDeleteAgent"
                    @tabChange="activeTab = $event"
                    @dmnChange="onDmnChange"
                    @openNewDmn="onOpenNewDmn"
                />
            </template>
            <template v-slot:rightpart>
                <component 
                    :is="currentTabComponent" 
                    :key="id + ':' + activeTab"
                    v-bind="currentTabProps"
                    v-on="currentTabEvents"
                />
            </template>

            <template v-slot:mobileLeftContent="{ closeDrawer }">
                <AgentChatInfo 
                    :agentInfo="agentInfo" 
                    :activeTab="activeTab"
                    :selectedDmnId="selectedDmnId"
                    :isMobile="true"
                    :dmnList="dmnList"
                    :isSkillLoading="isSkillLoading"
                    @agentUpdated="handleAgentUpdated"
                    @openSkillFile="openSkillFile"
                    @deleteAgent="handleDeleteAgent"
                    @tabChange="activeTab = $event"
                    @dmnChange="onDmnChange"
                    @openNewDmn="onOpenNewDmn"
                />
            </template>
        </AppBaseCard>
    </v-card>
</template>

<script>
import AppBaseCard from '@/components/shared/AppBaseCard.vue';

import AgentChatInfo from "@/components/AgentChatInfo.vue";

// Agent Chat 탭 컴포넌트
import ChatRoomPage from "@/views/chat/ChatRoomPage.vue";
import AgentChatLearning from "@/components/AgentChatLearning.vue";
import AgentChatQuestion from "@/components/AgentChatQuestion.vue";
import AgentChatActions from "@/components/AgentChatActions.vue";
import AgentKnowledgeManagement from "@/components/AgentKnowledgeManagement.vue";
import BusinessRuleLearning from "@/components/BusinessRuleLearning.vue";
import AgentSkillEdit from "@/components/AgentSkillEdit.vue";
import AgentSkillHistory from "@/components/AgentSkillHistory.vue";
import AgentDmnHistory from "@/components/AgentDmnHistory.vue";

import AgentCrudMixin from '@/mixins/AgentCrudMixin.vue';

import BackendFactory from '@/components/api/BackendFactory';

import { useDefaultSetting } from '@/stores/defaultSetting';

export default {
    mixins: [AgentCrudMixin],
    components: {
        AppBaseCard,
        AgentChatInfo,
        ChatRoomPage,
        AgentChatLearning,
        AgentChatQuestion,
        AgentChatActions,
        AgentKnowledgeManagement,
        BusinessRuleLearning,
        AgentSkillEdit,
        AgentSkillHistory,
        AgentDmnHistory,
    },
    data: () => ({
        defaultSetting: useDefaultSetting(),
        agentInfo: {
            id: '',
            profile: '/images/chat-icon.png',
            username: 'Agent',
            goal: '',
            agent_type: '',
            skills: '',
            tools: '',
            persona: '',
            endpoint: '',
            description: '',
            model: '',
            is_default: false,
        },
        activeTab: 'chat',

        // knowledge management
        knowledges: [],
        isKnowledgeLoading: false,

        // action mode
        workItem: null,

        // 탭 설정
        tabHandlers: null,

        // dmn
        dmnList: [],
        selectedDmnId: null,
        
        // backend
        backend: null,
        
        // 중복 호출 방지 플래그
        isInitializing: false,

        // skill edit
        skillFile: null,
        isSkillLoading: false,

        // agent id 변경 시 해시 무시하고 기본 탭만 사용
        idJustChanged: false,

        // proc_def 리얼타임 구독 (에이전트별 DMN 목록 갱신용)
        dmnRealtimeChannel: null,
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
                const isAgentChat = (r) => r?.path?.startsWith?.('/agent-chat/');

                if (!isAgentChat(newRoute)) {
                    // 다른 라우트로 나가는 경우: 정리만, replace/로딩 금지
                    this.unsubscribeDmnRealtime();
                    return;
                }

                // 이하: newRoute는 반드시 /agent-chat/:id
                const idChanged = isAgentChat(oldRoute) && (oldRoute.params?.id !== newRoute.params?.id);

                if (idChanged) {
                    // 에이전트 채팅 내부에서 id만 변경: 쿼리/해시 없이 path만 유지
                    this.selectedDmnId = null;
                    this.idJustChanged = true;
                    await this.$router.replace({
                        path: `/agent-chat/${newRoute.params.id}`
                    }).catch(() => {});
                }

                if (idChanged) {
                    this.agentInfo = this.defaultSetting.getAgentById(newRoute.params.id);
                    if (!this.agentInfo) {
                        this.agentInfo = await this.backend.getUserById(newRoute.params.id);
                    }
                    await this.init();
                    this.subscribeDmnRealtime(newRoute.params.id);
                }
            },
            deep: true
        },
        activeTab: {
            async handler(newVal) {
                const handler = this.tabHandlers?.[newVal];
                if (handler && typeof handler.activate === 'function') {
                    await handler.activate();
                }
            }
        },
        'agentInfo.agent_type': {
            handler(newVal, oldVal) {
                // agent_type이 변경되면 탭 핸들러 재구성
                if (newVal !== oldVal) {
                    this.setupTabHandlers();
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
        this.agentInfo = this.defaultSetting.getAgentById(this.id);
        if (!this.agentInfo) {
            this.agentInfo = await this.backend.getUserById(this.id);
        }
        // agentInfo 로드 후 탭 핸들러 재구성
        this.setupTabHandlers();
        // 최초 진입은 해시가 유효하면 해시 우선
        const hashTab = window.location.hash.replace('#', '');
        if (hashTab && this.tabHandlers && this.tabHandlers[hashTab]) {
            this.activeTab = hashTab;
        } else {
            this.activeTab = 'chat';
        }
        await this.init();
        this.subscribeDmnRealtime(this.id);

        this.EventBus.on('dmn-saved', (data) => {
            // 현재 에이전트 소유의 DMN 저장일 때만 탭 전환 (클릭 없이 다른 에이전트 화면이 바뀌지 않도록)
            if (data?.owner != null && data.owner !== this.agentInfo?.id) return;
            this.selectedDmnId = data.id;
            this.activeTab = 'dmn-modeling';
        });

        this.EventBus.on('dmn-deleted', (data) => {
            // 현재 에이전트 소유의 DMN 삭제일 때만 탭/목록 갱신
            if (data?.owner != null && data.owner !== this.agentInfo?.id) return;
            this.selectedDmnId = null;
            this.activeTab = this.agentInfo.agent_type == 'agent' ? 'learning' : 'actions';
            this.getDMNList();
        });
    },
    beforeUnmount() {
        this.unsubscribeDmnRealtime();
    },
    methods: {
        /**
         * 각 탭의 동작을 정의
         * tabList를 기반으로 노출되는 탭만 핸들러에 포함
         */
        setupTabHandlers() {
            const agentType = this.agentInfo?.agent_type || 'agent';
            const handlers = {};

            // tabList에 따라 조건부로 탭 핸들러 구성
            if (agentType === 'agent') {
                // 채팅 모드 (최상단)
                handlers['chat'] = {
                    component: 'ChatRoomPage',
                    props: (vm) => ({
                        embedded: true,
                        contextAgentId: vm.id,
                        initialRoomId: vm.$route?.query?.roomId || null
                    }),
                    events: () => ({}),
                    activate: async () => {
                        this.selectedDmnId = null;
                    }
                };

                // 학습 모드
                handlers['learning'] = {
                    component: 'AgentChatLearning',
                    props: (vm) => ({}),
                    events: (vm) => ({
                        stopMessage: vm.stopMessage
                    }),
                    activate: async () => {
                        this.selectedDmnId = null;
                    }
                };

                // 질문 모드
                handlers['question'] = {
                    component: 'AgentChatQuestion',
                    props: (vm) => ({}),
                    events: (vm) => ({
                        stopMessage: vm.stopMessage
                    }),
                    activate: async () => {
                        this.selectedDmnId = null;
                    }
                };

                // 지식 관리
                handlers['knowledge'] = {
                    component: 'AgentKnowledgeManagement',
                    props: (vm) => ({
                        knowledges: vm.knowledges,
                        isLoading: vm.isKnowledgeLoading
                    }),
                    events: (vm) => ({
                        deleteKnowledge: vm.deleteKnowledge
                    }),
                    activate: async () => {
                        this.selectedDmnId = null;
                        await this.getKnowledge();
                    }
                };

                // 비즈니스 규칙 학습 (agent일 때만)
                handlers['dmn-modeling'] = {
                    component: 'BusinessRuleLearning',
                    props: (vm) => ({
                        ownerInfo: vm.agentInfo,
                        dmnId: vm.selectedDmnId
                    }),
                    events: () => ({}),
                    activate: () => {}
                };

                // 스킬 변경 이력 (agent일 때만)
                handlers['skill-history'] = {
                    component: 'AgentSkillHistory',
                    props: (vm) => ({
                        agentId: vm.agentInfo.id,
                        showHistory: true
                    }),
                    events: () => ({}),
                    activate: () => {}
                };

                // 비즈니스 규칙 변경 이력 (agent일 때만)
                handlers['dmn-history'] = {
                    component: 'AgentDmnHistory',
                    props: (vm) => ({
                        agentId: vm.agentInfo.id,
                        showHistory: true
                    }),
                    events: () => ({}),
                    activate: () => {}
                };
            }

            // 채팅 모드 (모든 agent_type 공통)
            if (!handlers['chat']) {
                handlers['chat'] = {
                    component: 'ChatRoomPage',
                    props: (vm) => ({
                        embedded: true,
                        contextAgentId: vm.id,
                        initialRoomId: vm.$route?.query?.roomId || null
                    }),
                    events: () => ({}),
                    activate: async () => {
                        this.selectedDmnId = null;
                    }
                };
            }

            // 액션 모드 (모든 agent_type에 공통)
            handlers['actions'] = {
                component: 'AgentChatActions',
                props: (vm) => ({
                    agentInfo: vm.agentInfo
                }),
                events: () => ({}),
                activate: async () => {
                    this.selectedDmnId = null;
                }
            };

            this.tabHandlers = handlers;
        },

        async init() {
            if (this.isInitializing) return;
            this.isInitializing = true;
            try {
                // const defaultTab = this.agentInfo.agent_type == 'agent' ? 'learning' : 'actions';
                if (this.idJustChanged) {
                    this.idJustChanged = false;
                    this.selectedDmnId = null;
                }
                this.activeTab = 'chat';
                await this.getDMNList();
            } finally {
                this.isInitializing = false;
            }
        },

        /** 탭 내 클릭으로 DMN 선택 시에만 비즈니스 규칙 화면으로 전환 (init/에이전트 전환 시 자동 호출 방지) */
        onDmnChange(dmnId) {
            this.selectedDmnId = dmnId;
            if (dmnId != null) {
                this.activeTab = 'dmn-modeling';
            }
        },
        /** 새 비즈니스 규칙 만들기(plus) 클릭 시에만 호출 */
        onOpenNewDmn() {
            this.selectedDmnId = null;
            this.activeTab = 'dmn-modeling';
        },

        /** 에이전트 삭제 (에이전트 페이지 편집 화면에서 삭제 버튼 확인 시) */
        async handleDeleteAgent(editNode) {
            const agentId = editNode?.data?.id || editNode?.id;
            if (!agentId) return;
            const ok = await this.deleteAgent(agentId);
            if (!ok) return;
            // 저장된 조직도(configuration)에서도 해당 에이전트 노드 제거 (조직도 페이지 로드 시 반영되도록)
            try {
                const data = await this.backend.getData('db://configuration', { match: { key: 'organization' } });
                if (data && data.value && data.value.chart && data.value.chart.children) {
                    const chart = data.value.chart;
                    chart.children = this.removeNodeFromTree(chart.children, agentId);
                    const putObj = {
                        key: 'organization',
                        value: { chart },
                        ...(data.uuid && { uuid: data.uuid })
                    };
                    await this.backend.putObject('db://configuration', putObj, { onConflict: 'key,tenant_id' });
                }
            } catch (e) {
                console.error('[AgentChat] 조직도에서 에이전트 노드 제거 실패:', e);
            }
            this.$router.push('/organization');
        },
        /** 트리에서 targetId 노드 제거 후 반환 (재귀) */
        removeNodeFromTree(children, targetId) {
            if (!children) return children;
            if (children.some(item => item.id === targetId)) {
                return children.filter(item => item.id !== targetId);
            }
            return children.map(item => ({
                ...item,
                children: item.children ? this.removeNodeFromTree(item.children, targetId) : item.children
            }));
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
            this.isKnowledgeLoading = true;
            const options = {
                agent_id: this.id
            }
            this.knowledges = await this.backend.getVecsDocuments(options);
            this.isKnowledgeLoading = false;
        },
        async deleteKnowledge(options) {
            await this.backend.deleteVecsDocument(options);
            await this.getKnowledge();
        },

        // DMN
        async getDMNList() {
            // agentInfo가 로드되지 않았으면 빈 배열 반환
            if (!this.agentInfo || !this.agentInfo.id) {
                this.dmnList = [];
                return;
            }
            
            const options = {
                match: {
                    owner: this.agentInfo.id,
                    type: "dmn"
                }
            };
            
            const result = await this.backend.listDefinition("dmn", options);
            // 결과가 배열인 경우에만 업데이트
            if (Array.isArray(result)) {
                this.dmnList = result;
            } else {
                this.dmnList = [];
            }
        },

        /** proc_def 리얼타임 구독: backend.watchData 재사용, 해당 에이전트의 DMN 추가/삭제 시 목록 갱신 */
        async subscribeDmnRealtime(agentId) {
            this.unsubscribeDmnRealtime();
            if (!agentId || typeof this.backend.watchData !== 'function') return;
            try {
                const channel = `agent-dmn-${agentId}-${Date.now()}`;
                const callback = (payload) => {
                    const isDmn = (row) => row && row.type === 'dmn';
                    if (isDmn(payload.new) || isDmn(payload.old)) {
                        this.getDMNList();
                    }
                };
                this.dmnRealtimeChannel = await this.backend.watchData('proc_def', channel, callback, { filter: `owner=eq.${agentId}` });
            } catch (e) {
                console.warn('[AgentChat] watchData(proc_def) 실패:', e);
            }
        },

        /** proc_def 리얼타임 구독 해제 (window.$supabase 사용 가능) */
        unsubscribeDmnRealtime() {
            if (this.dmnRealtimeChannel && window.$supabase) {
                window.$supabase.removeChannel(this.dmnRealtimeChannel);
            }
            this.dmnRealtimeChannel = null;
        },

        // skills
        async checkSkills(skillName) {
            const skill = await this.backend.checkSkills(skillName);
            if (skill && skill.exists) {
                return true;
            } else {
                return false;
            }
        },
    }
}
</script>
