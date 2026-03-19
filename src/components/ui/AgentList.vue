<template>
    <div class="agent-list-container">
        <div v-if="isLoading" class="list-skeleton-loading">
            <v-skeleton-loader v-for="n in 3" :key="n" type="list-item" />
        </div>

        <div v-else-if="agentList.length === 0" class="pl-4 pr-4 py-2 text-caption text-grey">
            {{ $t('AgentList.empty') || '등록된 에이전트가 없습니다' }}
        </div>

        <ExpandableList v-else :items="agentList" :limit="5" @expanded="onExpanded" @collapsed="onCollapsed">
            <template #items="{ displayedItems }">
                <div class="agent-items">
                    <v-tooltip v-for="agent in displayedItems" bottom :key="agent.id" :text="agent.name || 'Unnamed Agent'">
                        <template v-slot:activator="{ props }">
                            <div
                                v-bind="props"
                                class="agent-item sidebar-list-hover-bg"
                                :class="{ 'sidebar-list-hover-bg--active': isAgentActive(agent) }"
                                @click="goToAgentChat(agent.id)"
                            >
                                <div class="agent-avatar">
                                    <img
                                        v-if="agent.img"
                                        :src="agent.img"
                                        :alt="agent.name"
                                        class="agent-image"
                                        width="32"
                                        height="32"
                                        @error="handleImageError"
                                    />
                                    <div v-else class="agent-emoji">🤖</div>
                                </div>
                                <div class="agent-info">
                                    <span class="agent-name">{{ agent.name || 'Unnamed Agent' }}</span>
                                    <span v-if="agent.role" class="agent-role">{{ agent.role }}</span>
                                </div>
                            </div>
                        </template>
                    </v-tooltip>
                </div>
            </template>
        </ExpandableList>
    </div>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
import AgentCrudMixin from '@/mixins/AgentCrudMixin.vue';
import ExpandableList from '@/components/ui/ExpandableList.vue';

import { useDefaultSetting } from '@/stores/defaultSetting';

const backend = BackendFactory.createBackend();

export default {
    name: 'AgentList',
    components: {
        ExpandableList
    },
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
        this.EventBus.on('agentUpdated', this.handleAgentUpdate);
        this.EventBus.on('agentAdded', this.handleAgentUpdate);
        this.EventBus.on('agentDeleted', this.handleAgentUpdate);
    },
    beforeUnmount() {
        // 이벤트 리스너 제거
        this.EventBus.off('agentUpdated', this.handleAgentUpdate);
        this.EventBus.off('agentAdded', this.handleAgentUpdate);
        this.EventBus.off('agentDeleted', this.handleAgentUpdate);
    },
    methods: {
        isAgentActive(agent) {
            if (!agent || !agent.id) return false;
            const path = this.$route?.path || '';
            const routeId = this.$route?.params?.id;
            return path.startsWith('/agent-chat/') && routeId === agent.id;
        },
        // 로컬스토리지에서 최근 열람 정보 가져오기
        getRecentlyViewedAgents() {
            try {
                const stored = localStorage.getItem('recentlyViewedAgents');
                return stored ? JSON.parse(stored) : [];
            } catch (error) {
                console.error('Failed to load recently viewed agents:', error);
                return [];
            }
        },

        // 로컬스토리지에 최근 열람 정보 저장
        saveRecentlyViewedAgent(agentId) {
            try {
                let recentAgents = this.getRecentlyViewedAgents();

                // 기존 항목 제거 (중복 방지)
                recentAgents = recentAgents.filter((item) => item.id !== agentId);

                // 새 항목을 맨 앞에 추가
                recentAgents.unshift({
                    id: agentId,
                    timestamp: Date.now()
                });

                // 최대 50개까지만 저장 (오래된 항목 제거)
                if (recentAgents.length > 50) {
                    recentAgents = recentAgents.slice(0, 50);
                }

                localStorage.setItem('recentlyViewedAgents', JSON.stringify(recentAgents));
            } catch (error) {
                console.error('Failed to save recently viewed agent:', error);
            }
        },

        // 에이전트 목록을 최근 열람 순으로 정렬
        sortAgentsByRecentlyViewed(agents) {
            const recentlyViewed = this.getRecentlyViewedAgents();

            // 최근 열람 정보를 Map으로 변환 (빠른 검색을 위해)
            const viewedMap = new Map();
            recentlyViewed.forEach((viewedAgent, index) => {
                viewedMap.set(viewedAgent.id, {
                    timestamp: viewedAgent.timestamp,
                    order: index
                });
            });

            // 에이전트 정렬
            return agents.sort((currentAgent, compareAgent) => {
                const currentAgentViewInfo = viewedMap.get(currentAgent.id);
                const compareAgentViewInfo = viewedMap.get(compareAgent.id);

                // 둘 다 최근 열람 기록이 있는 경우 - 더 최근에 본 것을 앞으로
                if (currentAgentViewInfo && compareAgentViewInfo) {
                    return currentAgentViewInfo.order - compareAgentViewInfo.order;
                }

                // 현재 에이전트만 최근 열람 기록이 있는 경우 - 앞으로 배치
                if (currentAgentViewInfo) {
                    return -1;
                }

                // 비교 에이전트만 최근 열람 기록이 있는 경우 - 뒤로 배치
                if (compareAgentViewInfo) {
                    return 1;
                }

                // 둘 다 열람 기록이 없는 경우 - 이름순으로 정렬
                return (currentAgent.name || '').localeCompare(compareAgent.name || '');
            });
        },

        async loadAgentList() {
            this.isLoading = true;
            try {
                let agentList = await backend.getAgentList();

                // 에이전트 데이터 가공
                if (Array.isArray(agentList)) {
                    agentList = agentList.filter((agent) => !agent.is_hidden);
                    const processedAgents = agentList.map((agent) => ({
                        id: agent.id,
                        name: agent.username || agent.name,
                        role: agent.role,
                        img: agent.profile || agent.img,
                        type: agent.agent_type || 'agent'
                    }));

                    // 최근 열람 순으로 정렬
                    this.agentList = this.sortAgentsByRecentlyViewed(processedAgents);
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
            // 로컬스토리지에 최근 열람 정보 저장 (화면 전환/새로고침 시 정렬에 사용)
            this.saveRecentlyViewedAgent(agentId);

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
                const existingIndex = this.agentList.findIndex((agent) => agent.id === updatedAgent.id);
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
            const existingIndex = this.agentList.findIndex((agent) => agent.id === updatedAgent.id);

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

                // 새로 추가된 에이전트를 최상단으로 이동시키기 위해 최근 열람 정보 저장
                this.saveRecentlyViewedAgent(updatedAgent.id);
            }

            // 업데이트 후 최근 열람 순으로 재정렬
            this.agentList = this.sortAgentsByRecentlyViewed([...this.agentList]);
        },

        onExpanded() {
            // 확장 시 필요한 로직이 있다면 여기에 추가
        },

        onCollapsed() {
            // 축소 시 필요한 로직이 있다면 여기에 추가
        }
    }
};
</script>

<style scoped>
.agent-list-container {
    padding: 8px 0;
}

.empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px 8px;
    text-align: center;
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
    font-size: 14px;
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
