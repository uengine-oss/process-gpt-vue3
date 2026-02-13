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
                                <v-tooltip v-if="!isBuiltinSkill" location="bottom" :text="$t('SkillDetail.addFolder')">
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
                                <v-tooltip v-if="!isBuiltinSkill" location="bottom" :text="$t('SkillDetail.addFile')">
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
                                                <div v-if="isBuiltinSkill || editingNodeId !== node.id || node.data.type !== 'folder'" class="d-inline-flex align-center text-subtitle-1 font-weight-medium text-truncate ml-1">
                                                    <span class="text-truncate">
                                                        {{ node.text }}
                                                        <v-tooltip activator="parent" location="bottom">
                                                            {{ node.text }}
                                                        </v-tooltip>
                                                    </span>
                                                </div>
                                                <v-text-field
                                                    v-else-if="!isBuiltinSkill"
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
                                                    v-if="!isBuiltinSkill && node.data.type === 'folder' && editingNodeId !== node.id"
                                                    variant="text"
                                                    icon
                                                    size="x-small"
                                                    @click.stop="startEditFolder(node)"
                                                >
                                                    <v-icon>mdi-pencil-outline</v-icon>
                                                </v-btn>
                                                <v-btn
                                                    v-else-if="!isBuiltinSkill && node.data.type === 'folder' && editingNodeId === node.id"
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
                                    <Teleport to="body" :disabled="!isGraphExpanded">
                                        <div v-if="isGraphExpanded" class="graph-overlay" @click.self="toggleGraphExpand"></div>
                                        <div class="skill-graph-wrap" :class="{ 'skill-graph-expanded': isGraphExpanded }">
                                            <div ref="cyContainer" class="skill-graph-canvas"></div>
                                            <v-btn
                                                icon
                                                variant="text"
                                                size="x-small"
                                                class="graph-fullscreen-btn"
                                                @click="toggleGraphExpand"
                                            >
                                                <v-icon size="18">{{ isGraphExpanded ? 'mdi-fullscreen-exit' : 'mdi-fullscreen' }}</v-icon>
                                            </v-btn>
                                        </div>
                                    </Teleport>
                                </template>
                            </v-card>
                        </div>
                        <v-divider class="mt-3" />
                        <!-- 아래: 사용 중인 에이전트 -->
                        <div class="used-by-block mt-3 pa-4">
                            <div class="d-flex align-center justify-space-between cursor-pointer" @click="showUsedBy = !showUsedBy">
                                <span class="text-caption font-weight-medium text-medium-emphasis">
                                    {{ $t('SkillDetail.usedByTitle') }} ({{ usedByAgents.length }})
                                </span>
                                <v-icon size="18" class="text-medium-emphasis">{{ showUsedBy ? 'mdi-chevron-up' : 'mdi-chevron-down' }}</v-icon>
                            </div>
                            <div v-if="showUsedBy" class="pt-2">
                                <div v-if="isUsageLoading" class="d-flex align-center justify-center py-3 text-medium-emphasis">
                                    <v-progress-circular indeterminate size="16" width="2" color="primary" class="mr-2" />
                                    <span class="text-caption">{{ $t('SkillDetail.usedByLoading') }}</span>
                                </div>
                                <div v-else-if="usedByAgents.length === 0" class="text-caption text-medium-emphasis py-3 text-center">
                                    {{ $t('SkillDetail.usedByEmpty') }}
                                </div>
                                <v-list v-else density="compact" class="used-by-list pa-0">
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
                        :read-only="isBuiltinSkill"
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
import { buildSkillReferenceGraph, updateGraphCurrentSkill } from '@/utils/skillReferencesGraph';

const tenantGraphCacheStore = {};

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
            isBuiltinSkill: false,
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
            /** API에서 받은 스킬 전체 파일 목록 (그래프는 이걸 기준으로 항상 전체 파일 노드 생성) */
            skillFilesFromApi: [],
            cy: null,
            isGraphLoading: false,
            graphLoadError: false,
            graphElements: [],
            isGraphExpanded: false
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
        this._escHandler = (e) => {
            if (e.key === 'Escape' && this.isGraphExpanded) {
                this.toggleGraphExpand();
            }
        };
        window.addEventListener('keydown', this._escHandler);

        if (this.skillId) {
            this.loadSkillStructure();
        } else {
            this.isLoading = false;
            this.loadError = true;
        }
    },
    beforeUnmount() {
        this.destroyGraph();
        if (this._escHandler) {
            window.removeEventListener('keydown', this._escHandler);
        }
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
            this.isBuiltinSkill = false;
            this.selectedNodeId = null;
            this.skillFile = null;
            this.nodes = {};
            this.config.roots = [];
            this.skillFilesFromApi = [];
            this.leftViewMode = 'files';
            this.destroyGraph();
            this.graphElements = [];
            this.graphLoadError = false;

            try {
                if (!this.skillId) {
                    this.loadError = true;
                    return;
                }
                const skill = await this.backend.getSkillFile(this.skillId);
                if (!skill || !skill.skill_name) {
                    this.loadError = true;
                    return;
                }

                this.skillDisplayName = skill.skill_name;
                // 기본 내장 스킬 여부 확인 (내장 스킬은 조회 전용)
                try {
                    const builtinResult = this.backend.getTenantBuiltinSkills ? await this.backend.getTenantBuiltinSkills() : [];
                    const raw = builtinResult?.skills ?? builtinResult;
                    const builtinList = Array.isArray(raw) ? raw : (raw?.skills || []);
                    const builtinNames = builtinList.map((s) => (typeof s === 'string' ? s : (s.name || s.skill_name || ''))).filter(Boolean);
                    this.isBuiltinSkill = builtinNames.includes(skill.skill_name);
                } catch (e) {
                    this.isBuiltinSkill = false;
                }
                // 이 스킬을 사용 중인 에이전트 목록 로드 (파일 트리와는 독립)
                this.loadUsedByAgents();
                const skillId = skill.skill_name;
                const files = Array.isArray(skill.files) ? skill.files : [];

                // 그래프는 API 파일 목록 기준으로 항상 전체 파일 포함 (SKILL.md 루트 포함)
                this.skillFilesFromApi = files.map((f) => ({
                    path: String(f.path || f.file_name || f.name || '').replace(/\\/g, '/'),
                    size: f.size ?? null,
                    modified: f.modified ?? null
                })).filter((f) => f.path && f.path.trim());

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

                // query.file가 있으면 해당 파일 선택, 없으면 SKILL.md 기본 선택
                const fileFromQuery = this.$route?.query?.file;
                let nodeToSelect = null;
                if (fileFromQuery && typeof fileFromQuery === 'string') {
                    const targetPath = String(fileFromQuery).replace(/\\/g, '/').trim();
                    nodeToSelect = Object.keys(this.nodes).find((id) => {
                        const node = this.nodes[id];
                        return node?.data?.type === 'file' && String(node.data.path || '').replace(/\\/g, '/') === targetPath;
                    });
                }
                if (!nodeToSelect) {
                    nodeToSelect = Object.keys(this.nodes).find((id) => {
                        const node = this.nodes[id];
                        return node?.data?.type === 'file' && (node.data.path === 'SKILL.md' || node.data.path.endsWith('/SKILL.md'));
                    });
                }
                if (nodeToSelect) {
                    this.$nextTick(() => {
                        this.selectedNodeId = nodeToSelect;
                    });
                }
            } catch (error) {
                console.error('Skill structure load failed:', error);
                this.loadError = true;
            } finally {
                this.isLoading = false;
                // 기본 선택(SKILL.md) 상태에서도 그래프 탭이면 전체 파일 기준 그래프 생성
                if (this.leftViewMode === 'graph' && !this.loadError) {
                    this.ensureGraphReady();
                }
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
            const tenantId = window.$tenantName;
            if (tenantId && tenantGraphCacheStore) {
                delete tenantGraphCacheStore[tenantId];
            }
        },

        onFileDeleted() {
            this.skillFile = null;
            const tenantId = window.$tenantName;
            if (tenantId && tenantGraphCacheStore) {
                delete tenantGraphCacheStore[tenantId];
            }
            this.loadSkillStructure();
        },

        async ensureGraphReady() {
            const skillName = (this.skillDisplayName || this.skillId || '').trim();
            if (!skillName) return;
            if (this.isLoading || this.loadError) return;

            const tenantId = window.$tenantName;
            const cached = tenantId && this.graphCacheByTenantId?.[tenantId];
            if (cached && Array.isArray(cached.elements)) {
                this.graphElements = updateGraphCurrentSkill(cached.elements, skillName);
                this.$nextTick(() => {
                    this.$nextTick(() => this.initOrUpdateGraph());
                });
                return;
            }

            this.isGraphLoading = true;
            this.graphLoadError = false;
            try {
                const tenantId = window.$tenantName;
                let tenantResult = null;
                try {
                    tenantResult = await this.backend.getTenantSkills(tenantId);
                } catch (e) {
                    console.warn('getTenantSkills failed, using single-skill graph', e);
                }

                const skills = (tenantResult?.skills ?? []).filter((s) => s && (s.name || s.skill_name));
                if (!skills.length) {
                    tenantResult = null;
                }

                let graph;
                if (tenantResult && skills.length > 0) {
                    const allSkillsData = [];
                    const totalFileCap = 100;
                    const chunkSize = 10;
                    let totalLoaded = 0;

                    for (const s of skills) {
                        const skName = s.name || s.skill_name || '';
                        if (!skName) continue;
                        let skillMeta = null;
                        try {
                            skillMeta = await this.backend.getSkillFile(skName);
                        } catch (e) {
                            continue;
                        }
                        if (!skillMeta || !skillMeta.skill_name) continue;
                        const files = Array.isArray(skillMeta.files) ? skillMeta.files : [];
                        const filesMeta = files.map((f) => ({
                            path: String(f.path || f.file_name || f.name || '').replace(/\\/g, '/'),
                            size: f.size ?? null,
                            modified: f.modified ?? null
                        })).filter((f) => f.path && f.path.trim());

                        const mdPaths = filesMeta
                            .map((f) => (f.path || '').trim())
                            .filter((p) => p && (p.endsWith('.md') || p.endsWith('.markdown')));
                        const remaining = totalFileCap - totalLoaded;
                        const targetMd = mdPaths.slice(0, Math.min(mdPaths.length, remaining));
                        if (targetMd.length === 0 && filesMeta.length > 0) {
                            allSkillsData.push({ skillName: skName, filesMeta, contentsByPath: {} });
                            continue;
                        }

                        const contentsByPath = {};
                        for (let i = 0; i < targetMd.length; i += chunkSize) {
                            const chunk = targetMd.slice(i, i + chunkSize);
                            const results = await Promise.all(
                                chunk.map(async (p) => {
                                    const file = await this.backend.getSkillFile(skName, p);
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
                        totalLoaded += targetMd.length;
                        allSkillsData.push({ skillName: skName, filesMeta, contentsByPath });
                        if (totalLoaded >= totalFileCap) break;
                    }

                    graph = buildSkillReferenceGraph({
                        skillName,
                        filesMeta: [],
                        contentsByPath: {},
                        includeNonMarkdownNodes: true,
                        allSkillsData
                    });
                } else {
                    const filesMeta = (this.skillFilesFromApi || []).slice();
                    const filePaths = filesMeta
                        .map((f) => (f.path || '').trim())
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

                    graph = buildSkillReferenceGraph({
                        skillName,
                        filesMeta,
                        contentsByPath,
                        includeNonMarkdownNodes: true
                    });
                }

                this.graphElements = graph.elements || [];
                if (tenantId) {
                    tenantGraphCacheStore[tenantId] = { elements: this.graphElements };
                }

                this.$nextTick(() => {
                    this.$nextTick(() => this.initOrUpdateGraph());
                });
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
                        'font-size': 11,
                        'font-family': '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                        'text-wrap': 'wrap',
                        'text-max-width': 120,
                        'text-valign': 'center',
                        'text-halign': 'center',
                        'background-color': '#6366f1',
                        'background-opacity': 0.9,
                        color: '#ffffff',
                        'text-outline-width': 0,
                        shape: 'roundrectangle',
                        width: 'label',
                        height: 'label',
                        padding: '10px',
                        'border-width': 0,
                        'overlay-opacity': 0,
                        'transition-property': 'background-color, border-width, border-color',
                        'transition-duration': '0.2s'
                    }
                },
                {
                    selector: 'node[ext="md"]',
                    style: { 'background-color': '#6366f1', color: '#ffffff' }
                },
                {
                    selector: 'node[ext="py"]',
                    style: { 'background-color': '#eab308', color: '#422006' }
                },
                {
                    selector: 'node[ext="js"]',
                    style: { 'background-color': '#f59e0b', color: '#451a03' }
                },
                {
                    selector: 'node[ext="ts"]',
                    style: { 'background-color': '#3b82f6', color: '#ffffff' }
                },
                {
                    selector: 'node[ext="json"]',
                    style: { 'background-color': '#f97316', color: '#ffffff' }
                },
                {
                    selector: 'node[ext="yaml"], node[ext="yml"], node[ext="toml"]',
                    style: { 'background-color': '#ec4899', color: '#ffffff' }
                },
                {
                    selector: 'node[ext="html"], node[ext="css"], node[ext="vue"]',
                    style: { 'background-color': '#14b8a6', color: '#ffffff' }
                },
                {
                    selector: 'node[ext="sh"], node[ext="sql"]',
                    style: { 'background-color': '#8b5cf6', color: '#ffffff' }
                },
                {
                    selector: 'node[ext="txt"], node[ext="csv"]',
                    style: { 'background-color': '#94a3b8', color: '#ffffff' }
                },
                {
                    selector: 'node[isCurrentSkill=1]',
                    style: {
                        'border-width': 2,
                        'border-color': '#1e1b4b'
                    }
                },
                {
                    selector: 'node[isCurrentSkill=0]',
                    style: {
                        'background-opacity': 0.7
                    }
                },
                {
                    selector: 'node[type="external"]',
                    style: {
                        'background-color': '#34d399',
                        color: '#064e3b',
                        shape: 'ellipse'
                    }
                },
                {
                    selector: 'edge',
                    style: {
                        width: 1.5,
                        'line-color': 'rgba(148, 163, 184, 0.5)',
                        'line-style': 'solid',
                        'target-arrow-color': 'rgba(148, 163, 184, 0.7)',
                        'target-arrow-shape': 'triangle',
                        'arrow-scale': 0.8,
                        'curve-style': 'bezier',
                        label: 'data(count)',
                        'font-size': 9,
                        color: '#94a3b8',
                        'text-background-color': '#ffffff',
                        'text-background-opacity': 0.8,
                        'text-background-padding': '2px',
                        'transition-property': 'line-color, target-arrow-color, width',
                        'transition-duration': '0.2s'
                    }
                },
                {
                    selector: 'node:active',
                    style: {
                        'overlay-opacity': 0.08,
                        'overlay-color': '#6366f1'
                    }
                },
                {
                    selector: ':selected',
                    style: {
                        'border-width': 2,
                        'border-color': '#4338ca',
                        'background-color': '#4f46e5'
                    }
                }
            ];

            const getFileExt = (label) => {
                if (!label) return 'other';
                const dot = label.lastIndexOf('.');
                return dot > 0 ? label.slice(dot + 1).toLowerCase() : 'other';
            };

            const extPrefixMap = {
                md: 'MD', py: 'PY', js: 'JS', ts: 'TS',
                json: 'JSON', yaml: 'YAML', yml: 'YAML', toml: 'TOML',
                txt: 'TXT', csv: 'CSV', html: 'HTML', css: 'CSS',
                sh: 'SH', sql: 'SQL', xml: 'XML', vue: 'VUE',
                java: 'JAVA', go: 'GO', rs: 'RS', rb: 'RB'
            };

            const elements = (this.graphElements || []).map((el) => {
                if (el?.data?.type === 'file') {
                    const ext = getFileExt(el.data.label || el.data.path);
                    const prefix = extPrefixMap[ext] || ext.toUpperCase();
                    return {
                        ...el,
                        data: {
                            ...el.data,
                            label: `[${prefix}] ${el.data.label || ''}`,
                            ext: ext,
                            isMarkdown: el.data.isMarkdown ? 1 : 0,
                            isCurrentSkill: el.data.isCurrentSkill === 1 ? 1 : 0
                        }
                    };
                }
                if (el?.data?.type === 'external') {
                    return { ...el, data: { ...el.data, ext: 'external', isCurrentSkill: 0 } };
                }
                return el;
            });

            const fitToCurrentSkill = () => {
                if (!this.cy) return;
                const currentNodes = this.cy.$('node[isCurrentSkill=1]');
                if (currentNodes.length > 0) {
                    this.cy.fit(currentNodes, 20);
                } else {
                    this.cy.fit(undefined, 10);
                }
            };

            if (!this.cy) {
                this.cy = cytoscape({
                    container,
                    elements,
                    style,
                    layout: { name: 'cose', animate: false, fit: true, padding: 20, nodeRepulsion: 8000, idealEdgeLength: 80, edgeElasticity: 100, gravity: 0.25 }
                });
                fitToCurrentSkill();

                this.cy.on('tap', 'node', (evt) => {
                    const data = evt?.target?.data?.();
                    if (!data) return;
                    if (data.type === 'external' && data.url) {
                        window.open(data.url, '_blank', 'noopener,noreferrer');
                        return;
                    }
                    if (data.type === 'file' && data.path) {
                        this.openFileByPath(data.path);
                    }
                });

                window.addEventListener('resize', this.onGraphResize, { passive: true });
            } else {
                this.cy.json({ elements, style });
                this.cy.layout({ name: 'cose', animate: false, fit: true, padding: 20, nodeRepulsion: 8000, idealEdgeLength: 80, edgeElasticity: 100, gravity: 0.25 }).run();
                fitToCurrentSkill();
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

        toggleGraphExpand() {
            this.isGraphExpanded = !this.isGraphExpanded;
            this.$nextTick(() => {
                if (this.cy) {
                    this.cy.resize();
                    this.cy.fit(undefined, 20);
                }
            });
        },

        openFileByPath(path) {
            const normalized = String(path || '').replace(/\\/g, '/');
            const currentSkill = (this.skillDisplayName || this.skillId || '').trim();

            const slashIdx = normalized.indexOf('/');
            if (slashIdx > 0) {
                const refSkillName = normalized.slice(0, slashIdx);
                const filePath = normalized.slice(slashIdx + 1);
                if (refSkillName !== currentSkill) {
                    this.$router.push('/skills/' + encodeURIComponent(refSkillName) + (filePath ? '?file=' + encodeURIComponent(filePath) : ''));
                    return;
                }
            }

            const pathWithinSkill = slashIdx > 0 ? normalized.slice(slashIdx + 1) : normalized;
            const matchId = Object.keys(this.nodes).find((id) => {
                const n = this.nodes[id];
                return n?.data?.type === 'file' && String(n.data.path || '').replace(/\\/g, '/') === pathWithinSkill;
            });
            if (matchId) {
                this.selectedNodeId = matchId;
                return;
            }
            const skillName = slashIdx > 0 ? normalized.slice(0, slashIdx) : currentSkill;
            const filePathToFetch = slashIdx > 0 ? normalized.slice(slashIdx + 1) : normalized;
            if (!skillName) return;
            this.backend.getSkillFile(skillName, filePathToFetch).then((file) => {
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

.skill-graph-wrap {
    position: relative;
}

.skill-graph-canvas {
    width: 100%;
    height: 360px;
    min-height: 240px;
    background: #f8fafc;
    border-radius: 8px;
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

<style>
.graph-overlay {
    position: fixed;
    inset: 0;
    z-index: 2000;
    background: rgba(0, 0, 0, 0.5);
}

.skill-graph-wrap.skill-graph-expanded {
    position: fixed;
    inset: 24px;
    z-index: 2001;
    background: #ffffff;
    padding: 16px;
    border-radius: 12px;
    box-shadow: 0 24px 48px rgba(0, 0, 0, 0.2);
}

.skill-graph-wrap.skill-graph-expanded .skill-graph-canvas {
    height: 100%;
    border-radius: 8px;
}

.graph-fullscreen-btn {
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 1;
    opacity: 0.5;
}

.graph-fullscreen-btn:hover {
    opacity: 1;
}
</style>
