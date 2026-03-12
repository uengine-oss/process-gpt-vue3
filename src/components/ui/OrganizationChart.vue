<template>
    <div style="height: 100%; position: relative">
        <!-- 검색 UI -->
        <div class="organization-chart-search-container">
            <v-row class="align-center flex-fill border border-borderColor header-search rounded-pill px-5 ma-0 pa-0">
                <Icons :icon="'magnifer-linear'" :size="22" />
                <v-text-field
                    v-model="searchQuery"
                    variant="plain"
                    density="compact"
                    class="position-relative pt-0 ml-3 custom-placeholer-color"
                    :placeholder="$t('OrganizationChart.searchByName')"
                    single-line
                    hide-details
                    @input="onSearchInput"
                ></v-text-field>
            </v-row>
        </div>

        <VueFlow
            ref="flowRef"
            class="organization-chart-flow"
            :nodes="flowNodes"
            :edges="flowEdges"
            :node-types="nodeTypes"
            :default-viewport="{ zoom: 0.9, x: 40, y: 40 }"
            :min-zoom="0.2"
            :max-zoom="1.5"
            :nodes-draggable="false"
            :nodes-connectable="false"
            :elements-selectable="true"
            :fit-view-on-init="true"
            @node-click="handleFlowNodeClick"
            @pane-click="handlePaneClick"
        />

        <!-- Agent Badges Diagram -->
        <AgentBadgesDiagram
            :show="showBadgesDiagram"
            :agentData="selectedAgent"
            @close="closeBadgesDiagram"
            @openEditDialog="handleAgentEditFromBadges"
        />

        <!-- dialogs -->
        <v-dialog v-model="teamDialog" max-width="500">
            <OrganizationTeamDialog
                :dialogType="teamDialogType"
                :editNode="editNode"
                @updateTeam="updateTeam"
                @closeDialog="closeTeamDialog"
            ></OrganizationTeamDialog>
        </v-dialog>
        <v-dialog v-model="editDialog" :max-width="isMobile ? '100vw' : 500" :fullscreen="isMobile">
            <OrganizationEditDialog
                :dialogType="editDialogType"
                :editNode="editNode"
                @updateNode="updateNode"
                @closeDialog="closeEditDialog"
                @deleteAgent="handleDeleteAgentFromEdit"
            ></OrganizationEditDialog>
        </v-dialog>
    </div>
</template>

<script>
import { markRaw } from 'vue';
import { VueFlow } from '@vue-flow/core';
import '@vue-flow/core/dist/style.css';
import '@vue-flow/core/dist/theme-default.css';
import OrganizationTeamDialog from './OrganizationTeamDialog.vue';
import OrganizationEditDialog from './OrganizationEditDialog.vue';
import AgentBadgesDiagram from './AgentBadgesDiagram.vue';
import { buildOrganizationChartFlow } from './organization-chart/organizationChartFlow';
import OrganizationChartFlowNode from './organization-chart/OrganizationChartFlowNode.vue';

export default {
    components: {
        VueFlow,
        OrganizationTeamDialog,
        OrganizationEditDialog,
        AgentBadgesDiagram
    },
    props: {
        node: {
            type: Object,
            default: () => ({})
        }
    },
    data: () => ({
        localNode: {},
        flowNodes: [],
        flowEdges: [],
        transformedTreeRoot: null,
        nodeTypes: {
            root: markRaw(OrganizationChartFlowNode),
            team: markRaw(OrganizationChartFlowNode),
            member: markRaw(OrganizationChartFlowNode)
        },
        backend: null,
        userList: [],
        searchQuery: '',
        searchResults: [],
        selectedNodeId: null,

        // dialog
        editNode: null,
        teamDialog: false,
        teamDialogType: '',
        editDialog: false,
        editDialogType: '',

        // badges diagram
        showBadgesDiagram: false,
        selectedAgent: null
    }),
    computed: {
        isMobile() {
            return window.innerWidth <= 768;
        }
    },
    watch: {
        async node(newVal) {
            if (newVal && newVal.id && newVal.data) {
                this.syncLocalNode(newVal);
                await this.loadUserList();
                this.drawTree();
            }
        },
        searchQuery() {
            this.drawTree();
        }
    },
    async mounted() {
        await this.loadUserList();
        if (this.node && this.node.id && this.node.data) {
            this.syncLocalNode(this.node);
            this.drawTree();
        }
    },

    methods: {
        cloneChartNode(node) {
            return JSON.parse(JSON.stringify(node || {}));
        },
        syncLocalNode(node) {
            this.localNode = this.cloneChartNode(node);
        },
        emitChartUpdate() {
            this.$emit('updateNode', this.cloneChartNode(this.localNode));
        },
        async loadUserList() {
            try {
                // backend 인스턴스가 없으면 생성
                if (!this.backend) {
                    const BackendFactory = (await import('@/components/api/BackendFactory')).default;
                    this.backend = BackendFactory.createBackend();
                }
                this.userList = await this.backend.getUserList({});
            } catch (error) {
                this.userList = [];
            }
        },
        getUserData(content) {
            // root나 팀인 경우 원본 데이터 사용
            if (content.id === 'root' || content.isTeam) {
                return content;
            }

            // 사용자 ID로 users 테이블에서 실제 최신 데이터 찾기
            const user = this.userList.find((u) => u.id === content.id);
            if (user) {
                return {
                    // users 테이블의 최신 데이터 사용
                    username: user.username,
                    name: user.username || user.name, // AgentBadgesDiagram에서 사용
                    email: user.email,
                    role: user.role,
                    profile: user.profile,
                    // 에이전트 관련 추가 필드들
                    goal: user.goal,
                    persona: user.persona,
                    tools: user.tools,
                    skills: user.skills,
                    agent_type: user.agent_type,
                    isAgent: user.is_agent,
                    alias: user.alias
                };
            }

            // 사용자를 찾지 못한 경우 조직도 데이터 사용 (fallback)
            return {
                username: content.username || content.name,
                name: content.username || content.name,
                email: content.email,
                role: content.role,
                profile: content.profile || content.img,
                goal: content.goal,
                persona: content.persona,
                tools: content.tools,
                skills: content.skills,
                agent_type: content.agent_type,
                isAgent: content.is_agent || content.isAgent,
                alias: content.alias
            };
        },
        getUserDataById(nodeId) {
            // 조직도 데이터에서 노드 찾기
            const node = this.findNodeInTree(this.localNode, nodeId);
            if (node) {
                return this.getUserData(node.data || node);
            }

            // 노드를 찾지 못한 경우 기본값 반환
            return { name: nodeId };
        },
        findNodeInTree(node, targetId) {
            if (!node) return null;

            if (node.id === targetId || node.data?.id === targetId) {
                return node;
            }

            if (node.children) {
                for (let child of node.children) {
                    const found = this.findNodeInTree(child, targetId);
                    if (found) return found;
                }
            }

            return null;
        },
        drawTree() {
            const flowGraph = buildOrganizationChartFlow(this.localNode, this.getUserData, this.searchQuery);
            this.flowNodes = flowGraph.nodes.map((node) => ({
                ...node,
                data: {
                    ...node.data,
                    selected: node.id === this.selectedNodeId,
                    ...this.createNodeActions(node)
                }
            }));
            this.flowEdges = flowGraph.edges;
            this.transformedTreeRoot = flowGraph.transformedRoot;
            this.searchResults = this.flowNodes.filter((node) => node.data.matchesSearch).map((node) => node.data.originalId || node.id);

            this.$nextTick(() => {
                this.$refs.flowRef?.fitView?.({ padding: 0.2, duration: 250 });
            });
        },
        onSearchInput() {
            if (this.searchQuery.trim()) {
                this.performSearch();
            } else {
                this.clearSearch();
            }
        },
        performSearch() {
            this.drawTree();
        },
        clearSearch() {
            this.searchResults = [];
            this.drawTree();
        },
        findNodeById(node, id) {
            if (node.id === id) {
                return node;
            }
            if (node.children) {
                for (let child of node.children) {
                    let found = this.findNodeById(child, id);
                    if (found) {
                        return found;
                    }
                }
            }
            return null;
        },
        // 원본 데이터에서 노드를 찾는 메서드 (변환 전 데이터 사용)
        findOriginalNodeById(node, id) {
            if (node.id == id || (node.data && node.data.id == id)) {
                return node;
            }
            if (node.children) {
                for (let child of node.children) {
                    let found = this.findOriginalNodeById(child, id);
                    if (found) {
                        return found;
                    }
                }
            }
            return null;
        },
        createNodeActions(flowNode) {
            const originalId = flowNode?.data?.originalId || flowNode?.id;
            const targetNode = this.findOriginalNodeById(this.localNode, originalId);

            if (!targetNode) {
                return {};
            }

            if (flowNode.data.isRoot) {
                return {
                    addTeam: () => {
                        this.editNode = targetNode;
                        this.openTeamDialog('add');
                    }
                };
            }

            if (flowNode.data.isTeam) {
                return {
                    addMember: () => {
                        this.editNode = targetNode;
                        this.$emit('addMember', this.cloneChartNode(targetNode));
                    },
                    editTeam: () => {
                        this.editNode = targetNode;
                        this.openTeamDialog('edit');
                    },
                    deleteTeam: () => {
                        this.editNode = targetNode;
                        this.openTeamDialog('delete');
                    }
                };
            }

            return {
                editUser: () => {
                    this.editNode = targetNode;
                    this.openEditDialog('edit-user');
                },
                editAgent: () => {
                    this.editNode = targetNode;
                    this.openEditDialog('edit-agent');
                },
                deleteAgent: () => {
                    this.editNode = targetNode;
                    this.openEditDialog('delete');
                }
            };
        },
        handleFlowNodeClick(event) {
            const flowNode = event?.node;
            if (!flowNode) return;

            const originalId = flowNode.data.originalId || flowNode.id;
            const foundNode = this.findOriginalNodeById(this.localNode, originalId);
            if (!foundNode?.data) return;

            this.selectedNodeId = flowNode.id;
            this.editNode = foundNode;
            this.drawTree();

            if (foundNode.data.isAgent) {
                if (this.showBadgesDiagram && this.selectedAgent && this.selectedAgent.id === foundNode.data.id) {
                    this.closeBadgesDiagram();
                    return;
                }

                const nodeData = foundNode.data || foundNode;
                const latestAgentData = this.getUserData(nodeData);
                const id = nodeData.id ?? foundNode.id ?? latestAgentData.id;
                const name =
                    nodeData.name ?? nodeData.username ?? foundNode.name ?? latestAgentData.name ?? latestAgentData.username ?? 'Agent';
                const img = nodeData.img ?? nodeData.profile ?? latestAgentData.profile ?? latestAgentData.img;
                const profile = nodeData.profile ?? nodeData.img ?? latestAgentData.profile ?? latestAgentData.img;
                this.selectedAgent = {
                    ...latestAgentData,
                    ...nodeData,
                    id,
                    name: String(name || 'Agent').trim() || 'Agent',
                    img: img || '/images/chat-icon.png',
                    profile: profile || img || '/images/chat-icon.png'
                };
                this.showBadgesDiagram = true;
            } else {
                this.closeBadgesDiagram();
            }
        },
        handlePaneClick() {
            this.selectedNodeId = null;
            this.drawTree();
            this.closeBadgesDiagram();
        },
        closeBadgesDiagram() {
            this.showBadgesDiagram = false;
            this.selectedAgent = null;
        },
        /**
         * 조직도에서 지정한 에이전트 노드를 선택하고 AgentBadgesDiagram 표시 (부모에서 호출)
         * @param {string} agentId - 선택할 에이전트 id
         * @param {Object} [fallbackData] - 노드를 아직 찾지 못할 때 사용할 에이전트 데이터 (예: 방금 추가한 newAgent)
         */
        async selectAgentById(agentId, fallbackData = null) {
            await this.loadUserList();

            const foundNode = this.findOriginalNodeById(this.localNode, agentId);
            const nodeData = (foundNode && (foundNode.data || foundNode)) || fallbackData;
            const isAgent = foundNode?.data?.isAgent ?? fallbackData?.isAgent ?? true;

            if (!nodeData || !isAgent) return;

            if (foundNode) this.editNode = foundNode;

            const latestAgentData = this.getUserData(nodeData);
            // 노드(래퍼·data·fallback) id/name 우선 보장 → AgentBadgesDiagram 이름·설정 버튼 노출
            const id = nodeData.id ?? foundNode?.id ?? latestAgentData.id ?? agentId;
            const name =
                nodeData.name ?? nodeData.username ?? foundNode?.name ?? latestAgentData.name ?? latestAgentData.username ?? 'Agent';
            const img = nodeData.img ?? nodeData.profile ?? latestAgentData.profile ?? latestAgentData.img;
            const profile = nodeData.profile ?? nodeData.img ?? latestAgentData.profile ?? latestAgentData.img;
            this.selectedAgent = {
                ...latestAgentData,
                ...(typeof nodeData === 'object' && nodeData !== null ? nodeData : {}),
                id,
                name: String(name || 'Agent').trim() || 'Agent',
                img: img || '/images/chat-icon.png',
                profile: profile || img || '/images/chat-icon.png'
            };
            this.showBadgesDiagram = true;
            this.selectedNodeId = this.flowNodes.find((node) => (node.data.originalId || node.id) === agentId)?.id || null;
            this.drawTree();
        },
        handleAgentEditFromBadges(agentData) {
            // AgentBadgesDiagram에서 수정 버튼 클릭 시 호출
            // selectedAgent를 editNode로 설정하고 수정 다이얼로그 열기
            if (agentData) {
                // 조직도에서 해당 에이전트 노드 찾기
                const foundNode = this.findOriginalNodeById(this.localNode, agentData.id);
                if (foundNode) {
                    this.editNode = foundNode;
                    this.openEditDialog('edit-agent');
                }
            }
        },
        openTeamDialog(type) {
            this.teamDialog = true;
            this.teamDialogType = type;
        },
        closeTeamDialog() {
            this.teamDialog = false;
            this.teamDialogType = '';
        },
        async updateTeam(type, editNode, newTeam) {
            const localEditNode = this.findOriginalNodeById(this.localNode, editNode?.id);

            if (type == 'add') {
                this.localNode.children.push({
                    id: newTeam.id,
                    data: newTeam,
                    children: []
                });
            } else if (type == 'delete') {
                this.localNode.children = await this.deleteNode(localEditNode || editNode, this.localNode.children);
            } else if (type == 'edit') {
                if (localEditNode?.data?.isTeam) {
                    localEditNode.data = {
                        ...localEditNode.data,
                        ...newTeam
                    };
                }
            }
            await this.drawTree();
            this.emitChartUpdate();
            this.closeTeamDialog();
        },
        deleteNode(obj, children) {
            if (children && children.some((item) => item.id == obj.id)) {
                children = children.filter((item) => item.id != obj.id);
            } else {
                children.forEach(async (item) => {
                    item.children = await this.deleteNode(obj, item.children);
                });
            }
            return children;
        },
        openEditDialog(type) {
            this.editDialog = true;
            this.editDialogType = type;
        },
        closeEditDialog() {
            this.editDialog = false;
            this.editDialogType = '';
        },
        /** 에이전트 편집 다이얼로그에서 삭제 확인 시 부모로 전달 */
        handleDeleteAgentFromEdit(editNode) {
            this.$emit('deleteAgent', editNode);
        },

        async updateNode(type, editNode) {
            const localEditNode = this.findOriginalNodeById(this.localNode, editNode?.id);

            if (type == 'edit' || type == 'edit-agent') {
                if (localEditNode) {
                    localEditNode.data = {
                        ...localEditNode.data,
                        ...(editNode?.data || {})
                    };
                    if (editNode?.children) {
                        localEditNode.children = this.cloneChartNode(editNode.children);
                    }
                }
                // 에이전트 수정인 경우 정확한 타입으로 emit
                const emitType = type === 'edit-agent' ? 'edit-agent' : 'edit';
                this.$emit('updateAgent', emitType, localEditNode || editNode);
            } else if (type == 'delete') {
                this.localNode.children = await this.deleteNode(localEditNode || editNode, this.localNode.children);
                this.$emit('updateAgent', type, localEditNode || editNode);
            }
            await this.drawTree();
            this.emitChartUpdate();
            this.closeEditDialog();
        }
    }
};
</script>

<style scoped>
.organization-chart-search-container {
    position: absolute;
    top: 20px;
    left: 20px;
    z-index: 100;
    width: 300px;
}

.header-search {
    background-color: white !important;
    min-height: 36px !important;
    height: 36px !important;
}

.organization-chart-flow {
    width: 100%;
    height: 100%;
    background-color: #eef4fb;
    background-image: radial-gradient(circle at top right, rgba(59, 130, 246, 0.08), transparent 28%),
        linear-gradient(180deg, #f8fbff 0%, #eef4fb 100%);
}

@media screen and (max-width: 768px) {
    .organization-chart-flow {
        height: calc(100vh - 40px) !important;
    }
}
</style>
