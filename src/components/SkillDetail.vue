<template>
    <v-card elevation="10">
        <AppBaseCard :custom-menu-name="$t('SkillDetail.title')">
            <template v-slot:leftpart="{ closeDrawer }">
                <h6 class="text-h6 px-4 py-3">
                    {{ skillDisplayName || skillId }}
                </h6>
                <div class="skill-detail-left pa-2">
                    <div v-if="loadError" class="text-caption text-error py-4 text-center">
                        {{ $t('SkillDetail.loadError') }}
                    </div>
                    <div v-else-if="isLoading" class="d-flex align-center justify-center py-4">
                        <v-progress-circular indeterminate size="24" color="primary"></v-progress-circular>
                        <span class="ml-2 text-caption">{{ $t('SkillDetail.loading') }}</span>
                    </div>
                    <template v-else>
                        <!-- 위: 트리뷰 / 그래프 -->
                        <div class="left-tree-section">
                            <div class="d-flex align-center mb-1">
                                <v-btn-toggle
                                    v-model="leftViewMode"
                                    density="compact"
                                    variant="outlined"
                                    divided
                                    color="primary"
                                    class="mr-1"
                                    mandatory
                                >
                                    <v-btn value="files" size="small">
                                        <v-icon size="small">mdi-file-tree-outline</v-icon>
                                        <span class="ml-1 d-none d-sm-inline">{{ $t('SkillDetail.filesTab') }}</span>
                                    </v-btn>
                                    <v-btn value="graph" size="small">
                                        <v-icon size="small">mdi-graph-outline</v-icon>
                                        <span class="ml-1 d-none d-sm-inline">{{ $t('SkillDetail.graphTab') }}</span>
                                    </v-btn>
                                </v-btn-toggle>
                                <v-tooltip location="bottom" :text="$t('SkillDetail.addFolder')">
                                    <template v-slot:activator="{ props }">
                                        <v-btn
                                            v-bind="props"
                                            variant="text"
                                            icon
                                            size="small"
                                            :disabled="selectedNodeId === null || leftViewMode !== 'files'"
                                            @click="addNode('folder')"
                                        >
                                            <v-icon>mdi-folder-plus-outline</v-icon>
                                        </v-btn>
                                    </template>
                                </v-tooltip>
                                <v-tooltip location="bottom" :text="$t('SkillDetail.addFile')">
                                    <template v-slot:activator="{ props }">
                                        <v-btn
                                            v-bind="props"
                                            variant="text"
                                            icon
                                            size="small"
                                            :disabled="selectedNodeId === null || isFileNode || leftViewMode !== 'files'"
                                            @click="addNode('file')"
                                        >
                                            <v-icon>mdi-file-document-plus-outline</v-icon>
                                        </v-btn>
                                    </template>
                                </v-tooltip>
                            </div>
                            <v-card flat class="skill-tree-card">
                                <template v-if="leftViewMode === 'files'">
                                    <v-treeview
                                        v-if="config.roots.length > 0"
                                        :config="config"
                                        :nodes="nodes"
                                        style="user-select: none; width: 100%;"
                                    >
                                        <template #before-input="{ node }">
                                            <div
                                                @click="handleNodeClick(node)"
                                                class="skill-tree-node d-inline-flex align-center justify-space-between cursor-pointer w-100"
                                                :class="{
                                                    'text-primary': selectedNodeId === node.id,
                                                    'selected-node-background': selectedNodeId === node.id
                                                }"
                                            >
                                                <div v-if="editingNodeId !== node.id || node.data.type !== 'folder'" class="d-inline-flex align-center text-subtitle-1 font-weight-medium text-truncate ml-1">
                                                    <span class="text-truncate">
                                                        {{ node.text }}
                                                        <v-tooltip activator="parent" location="bottom">
                                                            {{ node.text }}
                                                        </v-tooltip>
                                                    </span>
                                                </div>
                                                <v-text-field
                                                    v-else
                                                    v-model="editingFolderName"
                                                    variant="plain"
                                                    density="compact"
                                                    hide-details
                                                    class="ml-1"
                                                    style="min-width: 80px; max-width: 160px;"
                                                    @keyup.enter="finishEditFolder(node)"
                                                    @keyup.esc="cancelEditFolder"
                                                    ref="folderNameInput"
                                                    autofocus
                                                ></v-text-field>
                                                <v-btn
                                                    v-if="node.data.type === 'folder' && editingNodeId !== node.id"
                                                    variant="text"
                                                    icon
                                                    size="x-small"
                                                    @click.stop="startEditFolder(node)"
                                                >
                                                    <v-icon>mdi-pencil-outline</v-icon>
                                                </v-btn>
                                                <v-btn
                                                    v-else-if="node.data.type === 'folder' && editingNodeId === node.id"
                                                    variant="text"
                                                    icon
                                                    size="x-small"
                                                    color="primary"
                                                    @click.stop="finishEditFolder(node)"
                                                >
                                                    <v-icon>mdi-check</v-icon>
                                                </v-btn>
                                            </div>
                                        </template>
                                    </v-treeview>
                                    <div v-else class="text-caption text-medium-emphasis py-4 text-center">
                                        {{ $t('SkillDetail.noFiles') }}
                                    </div>
                                </template>

                                <template v-else>
                                    <div v-if="isGraphLoading" class="d-flex align-center justify-center py-4 text-medium-emphasis">
                                        <v-progress-circular indeterminate size="20" width="2" color="primary" class="mr-2" />
                                        <span class="text-caption">{{ $t('SkillDetail.graphLoading') }}</span>
                                    </div>
                                    <div v-else-if="graphLoadError" class="text-caption text-error py-4 text-center">
                                        {{ $t('SkillDetail.graphLoadError') }}
                                    </div>
                                    <div v-else-if="graphElements.length === 0" class="text-caption text-medium-emphasis py-4 text-center">
                                        {{ $t('SkillDetail.graphEmpty') }}
                                    </div>
                                    <div v-else ref="cyContainer" class="skill-graph-canvas"></div>
                                </template>
                            </v-card>
                        </div>
                        <!-- 아래: 사용 중인 에이전트 -->
                        <div class="used-by-block mt-3">
                            <div class="d-flex align-center justify-space-between px-2 py-2">
                                <div class="d-flex align-center gap-1">
                                    <v-icon size="18" color="primary">mdi-robot-outline</v-icon>
                                    <span class="text-caption font-weight-medium ml-1">{{ $t('SkillDetail.usedByTitle') }}</span>
                                </div>
                                <div class="d-flex align-center gap-1">
                                    <v-chip size="x-small" variant="tonal" color="primary" density="compact">
                                        <template v-if="isUsageLoading">
                                            <v-progress-circular indeterminate size="12" width="2" color="primary" class="mr-1" />
                                        </template>
                                        {{ usedByAgents.length }}
                                    </v-chip>
                                    <v-btn
                                        icon
                                        variant="text"
                                        size="x-small"
                                        density="compact"
                                        color="primary"
                                        @click="showUsedBy = !showUsedBy"
                                    >
                                        <v-icon size="18">{{ showUsedBy ? 'mdi-chevron-up' : 'mdi-chevron-down' }}</v-icon>
                                    </v-btn>
                                </div>
                            </div>
                            <v-divider />
                            <div v-if="showUsedBy" class="used-by-list-wrap px-2 py-2">
                                <div v-if="isUsageLoading" class="d-flex align-center justify-center py-3 text-medium-emphasis">
                                    <v-progress-circular indeterminate size="20" width="2" color="primary" class="mr-2" />
                                    <span class="text-caption">{{ $t('SkillDetail.usedByLoading') }}</span>
                                </div>
                                <div v-else-if="usedByAgents.length === 0" class="text-caption text-medium-emphasis py-3 text-center">
                                    {{ $t('SkillDetail.usedByEmpty') }}
                                </div>
                                <v-list v-else density="compact" class="used-by-list">
                                    <v-list-item
                                        v-for="agent in usedByAgents"
                                        :key="agent.id"
                                        class="used-by-item"
                                        @click="goToAgent(agent.id)"
                                    >
                                        <template v-slot:prepend>
                                            <v-avatar size="24" class="mr-2">
                                                <img v-if="agent.profile" :src="agent.profile" :alt="agent.name" width="24" height="24" />
                                                <v-icon v-else size="24">mdi-robot-outline</v-icon>
                                            </v-avatar>
                                        </template>
                                        <v-list-item-title class="text-body-2 text-truncate">{{ agent.name }}</v-list-item-title>
                                        <template v-slot:append>
                                            <v-icon size="16" class="text-medium-emphasis">mdi-open-in-new</v-icon>
                                        </template>
                                    </v-list-item>
                                </v-list>
                            </div>
                        </div>
                    </template>
                </div>
            </template>

            <template v-slot:rightpart>
                <div class="skill-detail-right d-flex flex-column">
                    <AgentSkillEdit
                        v-if="skillFile"
                        :skillFile="skillFile"
                        @update:isLoading="isEditorLoading = $event"
                        @file-saved="onFileSaved"
                        @file-deleted="onFileDeleted"
                    />
                    <div v-else class="d-flex align-center justify-center flex-grow-1 text-body-2 text-medium-emphasis">
                        {{ $t('SkillDetail.selectFile') }}
                    </div>
                </div>
            </template>

            <template v-slot:mobileLeftContent="{ closeDrawer }">
                <div class="skill-detail-left pa-2">
                    <div v-if="loadError" class="text-caption text-error py-4 text-center">
                        {{ $t('SkillDetail.loadError') }}
                    </div>
                    <div v-else-if="isLoading" class="d-flex align-center justify-center py-4">
                        <v-progress-circular indeterminate size="24" color="primary"></v-progress-circular>
                    </div>
                    <template v-else>
                        <div class="text-subtitle-2 text-medium-emphasis mb-2 px-1">
                            {{ skillDisplayName || skillId }}
                        </div>
                        <div class="left-tree-section">
                            <v-card flat class="skill-tree-card">
                                <v-treeview
                                    v-if="config.roots.length > 0"
                                    :config="config"
                                    :nodes="nodes"
                                    style="user-select: none; width: 100%;"
                                >
                                    <template #before-input="{ node }">
                                        <div
                                            @click="handleNodeClick(node); closeDrawer && closeDrawer();"
                                            class="skill-tree-node d-inline-flex align-center cursor-pointer w-100"
                                            :class="{
                                                'text-primary': selectedNodeId === node.id,
                                                'selected-node-background': selectedNodeId === node.id
                                            }"
                                        >
                                            <span class="text-truncate text-subtitle-1 font-weight-medium ml-1">{{ node.text }}</span>
                                        </div>
                                    </template>
                                </v-treeview>
                                <div v-else class="text-caption text-medium-emphasis py-4 text-center">
                                    {{ $t('SkillDetail.noFiles') }}
                                </div>
                            </v-card>
                        </div>
                        <div class="used-by-block mt-3">
                            <div class="d-flex align-center justify-space-between px-2 py-2">
                                <div class="d-flex align-center gap-1">
                                    <v-icon size="18" color="primary">mdi-robot-outline</v-icon>
                                    <span class="text-caption font-weight-medium">{{ $t('SkillDetail.usedByTitle') }}</span>
                                </div>
                                <v-chip size="x-small" variant="tonal" color="primary" density="compact">
                                    <template v-if="isUsageLoading">
                                        <v-progress-circular indeterminate size="12" width="2" color="primary" class="mr-1" />
                                    </template>
                                    {{ usedByAgents.length }}
                                </v-chip>
                                <v-btn
                                    icon
                                    variant="text"
                                    size="x-small"
                                    density="compact"
                                    @click="showUsedBy = !showUsedBy"
                                >
                                    <v-icon size="18">{{ showUsedBy ? 'mdi-chevron-up' : 'mdi-chevron-down' }}</v-icon>
                                </v-btn>
                            </div>
                            <v-divider />
                            <div v-if="showUsedBy" class="used-by-list-wrap px-2 py-2">
                                <div v-if="isUsageLoading" class="d-flex align-center justify-center py-3">
                                    <v-progress-circular indeterminate size="20" width="2" color="primary" class="mr-2" />
                                    <span class="text-caption">{{ $t('SkillDetail.usedByLoading') }}</span>
                                </div>
                                <div v-else-if="usedByAgents.length === 0" class="text-caption text-medium-emphasis py-3 text-center">
                                    {{ $t('SkillDetail.usedByEmpty') }}
                                </div>
                                <v-list v-else density="compact" class="used-by-list">
                                    <v-list-item
                                        v-for="agent in usedByAgents"
                                        :key="agent.id"
                                        class="used-by-item"
                                        @click="goToAgent(agent.id); closeDrawer && closeDrawer();"
                                    >
                                        <template v-slot:prepend>
                                            <v-avatar size="24" class="mr-2">
                                                <img v-if="agent.profile" :src="agent.profile" :alt="agent.name" />
                                                <v-icon size="14">mdi-robot-outline</v-icon>
                                            </v-avatar>
                                        </template>
                                        <v-list-item-title class="text-body-2 text-truncate">{{ agent.name }}</v-list-item-title>
                                        <template v-slot:append>
                                            <v-icon size="16">mdi-open-in-new</v-icon>
                                        </template>
                                    </v-list-item>
                                </v-list>
                            </div>
                        </div>
                    </template>
                </div>
            </template>
        </AppBaseCard>
    </v-card>
</template>

<script>
import AppBaseCard from '@/components/shared/AppBaseCard.vue';
import AgentSkillEdit from '@/components/AgentSkillEdit.vue';
import VTreeview from 'vue3-treeview';
import BackendFactory from '@/components/api/BackendFactory';
import cytoscape from 'cytoscape';
import { buildSkillReferenceGraph } from '@/utils/skillReferencesGraph';

export default {
    name: 'SkillDetail',
    components: {
        AppBaseCard,
        AgentSkillEdit,
        VTreeview
    },
    data() {
        return {
            backend: null,
            skillId: '',
            skillDisplayName: '',
            isLoading: true,
            loadError: false,
            isUsageLoading: false,
            usedByAgents: [],
            showUsedBy: false,
            nodes: {},
            config: { roots: [] },
            selectedNodeId: null,
            skillFile: null,
            editingNodeId: null,
            editingFolderName: '',
            originalFolderName: '',

            leftViewMode: 'files',
            cy: null,
            isGraphLoading: false,
            graphLoadError: false,
            graphElements: [],
            graphCacheBySkillName: {}
        };
    },
    computed: {
        isFileNode() {
            return this.selectedNodeId && this.nodes[this.selectedNodeId] && this.nodes[this.selectedNodeId].data?.type === 'file';
        }
    },
    watch: {
        '$route.params.id': {
            handler(newId) {
                if (newId) {
                    this.skillId = decodeURIComponent(newId);
                    this.loadSkillStructure();
                }
            },
            immediate: true
        },
        leftViewMode(newVal) {
            if (newVal === 'graph') {
                this.ensureGraphReady();
            } else {
                this.destroyGraph();
            }
        },
        selectedNodeId: {
            async handler(newVal) {
                const node = this.nodes[newVal];
                if (!node || (node.data && node.data.type !== 'file')) {
                    this.skillFile = null;
                    return;
                }
                const skillName = node.id.split('::')[0];
                const filePath = node.data.path;
                const file = await this.backend.getSkillFile(skillName, filePath);
                this.skillFile = file || null;
            },
            deep: true
        }
    },
    created() {
        this.backend = BackendFactory.createBackend();
        const id = this.$route.params.id;
        if (id) {
            this.skillId = decodeURIComponent(id);
        }
    },
    mounted() {
        if (this.skillId) {
            this.loadSkillStructure();
        } else {
            this.isLoading = false;
            this.loadError = true;
        }
    },
    beforeUnmount() {
        this.destroyGraph();
    },
    methods: {
        async loadUsedByAgents() {
            const targetSkill = (this.skillDisplayName || this.skillId || '').trim();
            if (!targetSkill) {
                this.usedByAgents = [];
                return;
            }

            this.isUsageLoading = true;
            try {
                const [mappings, agents] = await Promise.all([
                    this.backend.getAgentSkillsBySkill(targetSkill, window.$tenantName),
                    this.backend.getAgentList()
                ]);

                const mappingList = Array.isArray(mappings) ? mappings : (mappings || []);
                const agentList = Array.isArray(agents) ? agents : [];
                const matched = [];

                const agentMap = new Map();
                for (const agent of agentList) {
                    if (!agent) continue;
                    if (agent.is_agent !== true) continue;
                    if (agent.tenant_id && agent.tenant_id !== window.$tenantName) continue;
                    if (agent.agent_type && agent.agent_type !== 'agent') continue;
                    if (!agent.id) continue;
                    agentMap.set(agent.id, agent);
                }

                for (const row of mappingList) {
                    if (!row) continue;
                    const userId = row.user_id || row.userId;
                    if (!userId) continue;
                    const agent = agentMap.get(userId);
                    if (!agent) continue;
                    matched.push({
                        id: agent.id,
                        name: agent.username || agent.name || agent.alias || agent.id,
                        role: agent.role || '',
                        profile: agent.profile || agent.img || ''
                    });
                }

                matched.sort((a, b) => String(a.name).localeCompare(String(b.name)));
                this.usedByAgents = matched;
            } catch (e) {
                console.error('Failed to load used-by agents', e);
                this.usedByAgents = [];
            } finally {
                this.isUsageLoading = false;
            }
        },

        goToAgent(agentId) {
            if (!agentId) return;
            this.$router.push(`/agent-chat/${agentId}`);
        },

        async loadSkillStructure() {
            this.isLoading = true;
            this.loadError = false;
            this.selectedNodeId = null;
            this.skillFile = null;
            this.nodes = {};
            this.config.roots = [];
            this.leftViewMode = 'files';
            this.destroyGraph();
            this.graphElements = [];
            this.graphLoadError = false;

            try {
                const skill = await this.backend.getSkillFile(this.skillId);
                if (!skill || !skill.skill_name) {
                    this.loadError = true;
                    return;
                }

                this.skillDisplayName = skill.skill_name;
                // 이 스킬을 사용 중인 에이전트 목록 로드 (파일 트리와는 독립)
                this.loadUsedByAgents();
                const skillId = skill.skill_name;
                const files = Array.isArray(skill.files) ? skill.files : [];

                this.config.roots = [skillId];
                this.nodes[skillId] = {
                    id: skillId,
                    text: skill.skill_name,
                    children: [],
                    state: { opened: true },
                    data: {
                        type: 'skill',
                        path: '',
                        originalId: skillId
                    },
                    exists: true
                };

                files.forEach((file, index) => {
                    const rawPath = (file.path || file.file_name || file.name || '').replace(/\\/g, '/');
                    const fallbackName = file.file_name || file.name || `file_${index + 1}`;
                    const segments = (rawPath ? rawPath.split('/') : [fallbackName]).filter(
                        (s) => s && s.trim().length > 0
                    );
                    if (segments.length === 0) segments.push(fallbackName);

                    let parentId = skillId;
                    let accumulatedPath = '';

                    segments.forEach((segment, segmentIndex) => {
                        accumulatedPath = accumulatedPath ? `${accumulatedPath}/${segment}` : segment;
                        const nodeId = `${skillId}::${accumulatedPath}`;
                        const isFile = segmentIndex === segments.length - 1;

                        if (!this.nodes[nodeId]) {
                            this.nodes[nodeId] = {
                                id: nodeId,
                                text: segment,
                                children: [],
                                ...(isFile ? {} : { state: { opened: true } }),
                                data: {
                                    type: isFile ? 'file' : 'folder',
                                    originalId: segment,
                                    path: accumulatedPath,
                                    size: isFile ? (file.size ?? null) : null,
                                    modified: isFile ? (file.modified ?? null) : null
                                },
                                exists: true
                            };
                        } else if (isFile) {
                            this.nodes[nodeId].data.size = file.size ?? null;
                            this.nodes[nodeId].data.modified = file.modified ?? null;
                            this.nodes[nodeId].text = segment;
                        }

                        const parentChildren = this.nodes[parentId].children;
                        if (!parentChildren.includes(nodeId)) parentChildren.push(nodeId);
                        parentId = nodeId;
                    });
                });

                // SKILL.md를 기본 선택
                const skillMdNodeId = Object.keys(this.nodes).find((id) => {
                    const node = this.nodes[id];
                    return node?.data?.type === 'file' && (node.data.path === 'SKILL.md' || node.data.path.endsWith('/SKILL.md'));
                });
                if (skillMdNodeId) {
                    this.$nextTick(() => {
                        this.selectedNodeId = skillMdNodeId;
                    });
                }
            } catch (error) {
                console.error('Skill structure load failed:', error);
                this.loadError = true;
            } finally {
                this.isLoading = false;
            }
        },

        handleNodeClick(node) {
            if (this.editingNodeId) return;
            if (!node || !node.id) return;
            const nodeId = node.id;
            const nodeType = node?.data?.type;

            if (nodeType === 'skill' || nodeType === 'folder') {
                if (!node.state) {
                    node.state = { opened: true };
                    if (this.nodes[nodeId]) this.nodes[nodeId].state = node.state;
                } else if (this.nodes[nodeId] && this.nodes[nodeId].state !== node.state) {
                    this.nodes[nodeId].state = node.state;
                }
                node.state.opened = !node.state.opened;
            }

            this.selectedNodeId = nodeId;
        },

        addNode(type) {
            let newNode = null;
            let parentNode = null;
            if (type === 'file') {
                const result = this.addFile();
                newNode = result?.fileNode;
                parentNode = result?.parentNode;
            } else if (type === 'folder') {
                const result = this.addFolder();
                newNode = result?.folderNode;
                parentNode = result?.parentNode;
            }
            if (!newNode || !parentNode) return;
            this.nodes[newNode.id] = newNode;
            this.selectedNodeId = newNode.id;
            parentNode.children.push(newNode.id);
        },

        addFile() {
            const parentNode = this.nodes[this.selectedNodeId];
            if (!parentNode) return;
            let newNodeId = parentNode.id;
            let newNodePath = '';
            if (parentNode.data.type === 'skill') {
                newNodeId += '::new_file.md';
                newNodePath = 'new_file.md';
            } else if (parentNode.data.type === 'folder') {
                newNodeId += '/new_file.md';
                newNodePath = parentNode.data.path + '/new_file.md';
            }
            const fileNode = {
                id: newNodeId,
                text: 'new_file.md',
                children: [],
                data: { type: 'file', path: newNodePath },
                exists: false
            };
            return { fileNode, parentNode };
        },

        addFolder() {
            let parentNode = this.nodes[this.selectedNodeId];
            if (!parentNode) return;
            let newNodeId = parentNode.id;
            let newNodePath = '';
            if (parentNode.data.type === 'skill') {
                newNodeId += '::new_folder';
                newNodePath = 'new_folder';
            } else if (parentNode.data.type === 'folder') {
                newNodeId += '/new_folder';
                newNodePath = parentNode.data.path + '/new_folder';
            } else if (parentNode.data.type === 'file') {
                const afterColon = parentNode.id.indexOf('::') >= 0 ? parentNode.id.split('::')[1] : '';
                const pathSegments = afterColon ? afterColon.split('/').filter(Boolean) : [];
                const parentPath = pathSegments.slice(0, -1).join('/');
                const skillPrefix = parentNode.id.split('::')[0];
                parentNode = parentPath ? this.nodes[skillPrefix + '::' + parentPath] : this.nodes[skillPrefix];
                if (!parentNode) return;
                newNodeId = parentNode.data.type === 'skill' ? parentNode.id + '::new_folder' : parentNode.id + '/new_folder';
                newNodePath = parentNode.data.path ? parentNode.data.path + '/new_folder' : 'new_folder';
            }
            const folderNode = {
                id: newNodeId,
                text: 'new_folder',
                children: [],
                data: { type: 'folder', path: newNodePath, originalId: newNodeId },
                state: { opened: true },
                exists: false
            };
            return { folderNode, parentNode };
        },

        startEditFolder(node) {
            this.editingNodeId = node.id;
            this.editingFolderName = node.text;
            this.originalFolderName = node.text;
            this.$nextTick(() => {
                const input = this.$refs.folderNameInput;
                if (Array.isArray(input) && input[0]?.$el) input[0].$el.querySelector('input')?.focus();
                else if (input?.$el) input.$el.querySelector('input')?.focus();
            });
        },

        finishEditFolder(node) {
            if (this.editingNodeId !== node.id) return;
            const newName = this.editingFolderName.trim();
            if (!newName || newName === this.originalFolderName) {
                this.cancelEditFolder();
                return;
            }
            if (this.nodes[node.id]) {
                this.nodes[node.id].text = newName;
                if (this.nodes[node.id].data?.path) {
                    const pathParts = this.nodes[node.id].data.path.split('/');
                    pathParts[pathParts.length - 1] = newName;
                    this.nodes[node.id].data.path = pathParts.join('/');
                }
            }
            this.editingNodeId = null;
            this.editingFolderName = '';
            this.originalFolderName = '';
        },

        cancelEditFolder() {
            this.editingNodeId = null;
            this.editingFolderName = '';
            this.originalFolderName = '';
        },

        onFileSaved() {
            if (this.selectedNodeId && this.nodes[this.selectedNodeId]) {
                this.nodes[this.selectedNodeId].exists = true;
            }
        },

        onFileDeleted() {
            this.skillFile = null;
            this.loadSkillStructure();
        },

        async ensureGraphReady() {
            const skillName = (this.skillDisplayName || this.skillId || '').trim();
            if (!skillName) return;
            if (this.isLoading || this.loadError) return;

            const cached = this.graphCacheBySkillName?.[skillName];
            if (cached && Array.isArray(cached.elements)) {
                this.graphElements = cached.elements;
                this.$nextTick(() => this.initOrUpdateGraph());
                return;
            }

            this.isGraphLoading = true;
            this.graphLoadError = false;
            try {
                const filePaths = Object.keys(this.nodes)
                    .map((id) => this.nodes[id])
                    .filter((n) => n?.data?.type === 'file' && n?.data?.path)
                    .map((n) => String(n.data.path).replace(/\\/g, '/'))
                    .filter((p) => p && (p.endsWith('.md') || p.endsWith('.markdown')));

                const cap = 50;
                const targetPaths = filePaths.slice(0, cap);
                const contentsByPath = {};
                const chunkSize = 10;
                for (let i = 0; i < targetPaths.length; i += chunkSize) {
                    const chunk = targetPaths.slice(i, i + chunkSize);
                    const results = await Promise.all(
                        chunk.map(async (p) => {
                            const file = await this.backend.getSkillFile(skillName, p);
                            return { path: p, file };
                        })
                    );
                    for (const r of results) {
                        const content = r?.file?.content;
                        if (typeof content === 'string') {
                            contentsByPath[r.path] = content;
                        }
                    }
                }

                const filesMeta = Object.keys(this.nodes)
                    .map((id) => this.nodes[id])
                    .filter((n) => n?.data?.type === 'file' && n?.data?.path)
                    .map((n) => ({
                        path: String(n.data.path).replace(/\\/g, '/'),
                        size: n?.data?.size ?? null,
                        modified: n?.data?.modified ?? null
                    }));

                const graph = buildSkillReferenceGraph({
                    skillName,
                    filesMeta,
                    contentsByPath,
                    includeNonMarkdownNodes: true
                });

                this.graphElements = graph.elements || [];
                this.graphCacheBySkillName = this.graphCacheBySkillName || {};
                this.graphCacheBySkillName[skillName] = { elements: this.graphElements };

                this.$nextTick(() => this.initOrUpdateGraph());
            } catch (e) {
                console.error('Failed to build graph', e);
                this.graphLoadError = true;
                this.graphElements = [];
                this.destroyGraph();
            } finally {
                this.isGraphLoading = false;
            }
        },

        initOrUpdateGraph() {
            if (this.leftViewMode !== 'graph') return;
            const container = this.$refs.cyContainer;
            if (!container) return;

            const style = [
                {
                    selector: 'node',
                    style: {
                        label: 'data(label)',
                        'font-size': 10,
                        'text-wrap': 'wrap',
                        'text-max-width': 110,
                        'background-color': 'rgb(103, 126, 234)',
                        color: '#1a1a1a',
                        'text-outline-width': 0
                    }
                },
                {
                    selector: 'node[isMarkdown=0]',
                    style: { 'background-color': 'rgb(160, 160, 160)' }
                },
                {
                    selector: 'edge',
                    style: {
                        width: 2,
                        'line-color': 'rgba(103, 126, 234, 0.65)',
                        'target-arrow-color': 'rgba(103, 126, 234, 0.65)',
                        'target-arrow-shape': 'triangle',
                        'curve-style': 'bezier',
                        label: 'data(count)',
                        'font-size': 9,
                        color: '#555'
                    }
                },
                {
                    selector: ':selected',
                    style: {
                        'border-width': 3,
                        'border-color': 'rgb(103, 126, 234)'
                    }
                }
            ];

            const elements = (this.graphElements || []).map((el) => {
                if (el?.data?.type === 'file') {
                    return {
                        ...el,
                        data: { ...el.data, isMarkdown: el.data.isMarkdown ? 1 : 0 }
                    };
                }
                return el;
            });

            if (!this.cy) {
                this.cy = cytoscape({
                    container,
                    elements,
                    style,
                    layout: { name: 'cose', animate: false, fit: true, padding: 10 }
                });

                this.cy.on('tap', 'node', (evt) => {
                    const data = evt?.target?.data?.();
                    if (!data || data.type !== 'file') return;
                    const path = data.path;
                    if (path) this.openFileByPath(path);
                });

                window.addEventListener('resize', this.onGraphResize, { passive: true });
            } else {
                this.cy.json({ elements, style });
                this.cy.layout({ name: 'cose', animate: false, fit: true, padding: 10 }).run();
                this.onGraphResize();
            }
        },

        onGraphResize() {
            try {
                if (this.cy) {
                    this.cy.resize();
                    this.cy.fit(undefined, 10);
                }
            } catch (e) {
                // ignore
            }
        },

        destroyGraph() {
            if (this.cy) {
                try {
                    window.removeEventListener('resize', this.onGraphResize);
                    this.cy.destroy();
                } catch (e) {
                    // ignore
                }
            }
            this.cy = null;
        },

        openFileByPath(path) {
            const normalized = String(path || '').replace(/\\/g, '/');
            const matchId = Object.keys(this.nodes).find((id) => {
                const n = this.nodes[id];
                return n?.data?.type === 'file' && String(n.data.path || '').replace(/\\/g, '/') === normalized;
            });
            if (matchId) {
                this.selectedNodeId = matchId;
                return;
            }
            const skillName = (this.skillDisplayName || this.skillId || '').trim();
            if (!skillName) return;
            this.backend.getSkillFile(skillName, normalized).then((file) => {
                this.skillFile = file || null;
            });
        }
    }
};
</script>

<style scoped>
.skill-detail-left {
    min-height: 200px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.left-tree-section {
    flex: 1;
    min-height: 0;
    overflow: auto;
}

.skill-detail-right {
    min-height: 200px;
}

.used-by-block {
    flex-shrink: 0;
    background: rgba(var(--v-theme-on-surface), 0.03);
    border-radius: 8px;
    border: none;
    overflow: hidden;
}

.used-by-list-wrap {
    max-height: 200px;
    overflow-y: auto;
}

.used-by-block :deep(.v-list-item) {
    border-radius: 8px;
}

.used-by-item {
    cursor: pointer;
}

.used-by-item:hover {
    background: rgba(var(--v-theme-primary), 0.06);
}

.skill-tree-card {
    padding: 4px 8px;
}

.skill-graph-canvas {
    width: 100%;
    height: 360px;
    min-height: 240px;
}

.skill-tree-node {
    padding: 4px 0;
    border-radius: 4px;
}

.selected-node-background {
    background-color: rgba(var(--v-theme-primary), 0.1);
}

::v-deep(.tree .node-text) {
    display: none;
}
</style>
