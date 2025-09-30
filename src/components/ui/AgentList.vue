<template>
    <div class="agent-list-container">
        <div v-if="isLoading" class="loading-state">
            <v-progress-circular indeterminate size="24" color="primary"></v-progress-circular>
            <span class="ml-2 text-caption">{{ $t('AgentList.loading') }}</span>
        </div>
        
        <div v-else-if="agentList.length === 0" class="empty-state">
            <v-icon size="32" color="grey-lighten-1">mdi-robot-outline</v-icon>
            <span class="text-caption text-grey">{{ $t('AgentList.empty') }}</span>
        </div>
        
        <div v-else class="agent-items">
            <div 
                v-for="agent in agentList" 
                :key="agent.id"
                class="agent-item"
                @click="goToAgentChat(agent.id)"
            >
                <div class="agent-avatar">
                    <img 
                        v-if="agent.img" 
                        :src="agent.img" 
                        :alt="agent.name"
                        class="agent-image"
                        @error="handleImageError"
                    />
                    <div v-else class="agent-emoji">🤖</div>
                </div>
                <div class="agent-info">
                    <span class="agent-name">{{ agent.name || 'Unnamed Agent' }}</span>
                    <span v-if="agent.role" class="agent-role">{{ agent.role }}</span>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
import AgentCrudMixin from '@/mixins/AgentCrudMixin.vue';

const backend = BackendFactory.createBackend();

export default {
    name: 'AgentList',
    mixins: [AgentCrudMixin],
    data() {
        return {
            agentList: [],
            isLoading: false
        };
    },
    async mounted() {
        await this.loadAgentList();
        // 에이전트 업데이트 이벤트 리스너 등록
        this.$root.$on('agentUpdated', this.handleAgentUpdate);
        this.$root.$on('agentAdded', this.handleAgentUpdate);
        this.$root.$on('agentDeleted', this.handleAgentUpdate);
    },
    beforeDestroy() {
        // 이벤트 리스너 제거
        this.$root.$off('agentUpdated', this.handleAgentUpdate);
        this.$root.$off('agentAdded', this.handleAgentUpdate);
        this.$root.$off('agentDeleted', this.handleAgentUpdate);
    },
    methods: {
        async loadAgentList() {
            this.isLoading = true;
            try {
                // ProcessGPTBackend에 이미 있는 getAgentList() 메서드 사용
                const agentList = await backend.getAgentList();
                
                // 에이전트 데이터 가공
                if (Array.isArray(agentList)) {
                    this.agentList = agentList.map(agent => ({
                        id: agent.id,
                        name: agent.username || agent.name,
                        role: agent.role,
                        img: agent.profile || agent.img,
                        type: agent.agent_type || 'agent'
                    }));
                } else {
                    this.agentList = [];
                }
                    
            } catch (error) {
                console.error(this.$t('AgentList.loadFailed'), error);
                // 에러 발생 시 빈 배열로 설정
                this.agentList = [];
            } finally {
                this.isLoading = false;
            }
        },
        
        goToAgentChat(agentId) {
            // AgentBadgesDiagram.vue의 goToAgentChat 메서드와 동일한 방식으로 라우터 이동
            this.$router.push(`/agent-chat/${agentId}`);
        },
        
        handleImageError(event) {
            // 이미지 로드 실패 시 기본 이미지로 교체하거나 숨기기
            event.target.style.display = 'none';
        },

        async handleAgentUpdate(updatedAgent) {
            // 삭제 이벤트인 경우
            if (updatedAgent && updatedAgent.id && !updatedAgent.username && !updatedAgent.name) {
                const existingIndex = this.agentList.findIndex(agent => agent.id === updatedAgent.id);
                if (existingIndex !== -1) {
                    this.agentList.splice(existingIndex, 1);
                }
                return;
            }
            
            if (!updatedAgent || !updatedAgent.id) {
                // 전체 목록 새로고침
                await this.loadAgentList();
                return;
            }

            // 기존 에이전트 찾기
            const existingIndex = this.agentList.findIndex(agent => agent.id === updatedAgent.id);
            
            if (existingIndex !== -1) {
                // 기존 에이전트 업데이트
                this.agentList[existingIndex] = {
                    ...this.agentList[existingIndex],
                    id: updatedAgent.id,
                    name: updatedAgent.username || updatedAgent.name,
                    role: updatedAgent.role,
                    img: updatedAgent.profile || updatedAgent.img,
                    type: updatedAgent.agent_type || 'agent'
                };
            } else {
                // 새 에이전트 추가 (추가된 경우)
                const newAgent = {
                    id: updatedAgent.id,
                    name: updatedAgent.username || updatedAgent.name,
                    role: updatedAgent.role,
                    img: updatedAgent.profile || updatedAgent.img,
                    type: updatedAgent.agent_type || 'agent'
                };
                this.agentList.push(newAgent);
            }
        }
    }
};
</script>

<style scoped>
.agent-list-container {
    padding: 8px 0;
}

.loading-state,
.empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    padding: 16px 8px;
    text-align: center;
    gap: 8px;
}

.empty-state {
    color: #666;
}

.agent-items {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.agent-item {
    display: flex;
    align-items: center;
    padding: 8px 12px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    gap: 12px;
}

.agent-item:hover {
    background-color: rgba(103, 126, 234, 0.08);
    transform: translateX(2px);
}

.agent-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    overflow: hidden;
    background: #f0f0f0;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.agent-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.agent-emoji {
    font-size: 16px;
    line-height: 1;
}

.agent-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1;
}

.agent-name {
    font-size: 12px;
    font-weight: 500;
    color: #2d3436;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.agent-role {
    font-size: 10px;
    color: #636e72;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-top: 2px;
}

/* 반응형 디자인 */
@media (max-width: 768px) {
    .agent-item {
        padding: 10px 12px;
    }
    
    .agent-avatar {
        width: 36px;
        height: 36px;
    }
    
    .agent-name {
        font-size: 13px;
    }
    
    .agent-role {
        font-size: 11px;
    }
}
</style>
