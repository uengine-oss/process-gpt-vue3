<template>
    <div>
        <!-- <v-file-input
            ref="skillsFileInput"
            accept=".zip"
            :label="$t('AgentSkills.skillUpload')"
            density="compact"
            variant="outlined"
            hide-details
            class="mb-3"
            @update:modelValue="handleSkillsChange"
        >
            <template #append-inner>
                <v-btn
                    variant="text"
                    density="comfortable"
                    icon="mdi-upload"
                    @click.stop="triggerSkillUpload"
                    :loading="isLoading && skillsFile !== null"
                    :disabled="skillsFile === null"
                ></v-btn>
            </template>
        </v-file-input> -->

        <!-- skills tools -->
        <div class="d-flex mt-1">
            <v-btn variant="text" icon size="small" @click="$emit('closeEditSkills')">
                <v-icon>mdi-arrow-left</v-icon>
            </v-btn>
            <v-btn variant="text" icon size="small">
                <v-icon>mdi-file-document-plus-outline</v-icon>
            </v-btn>
            <v-btn variant="text" icon size="small">
                <v-icon>mdi-folder-plus-outline</v-icon>
            </v-btn>
        </div>

        <!-- skills tree -->
        <v-card flat class="px-3 py-2">
            <v-treeview
                :config="config"
                :nodes="nodes"
                style="user-select: none; width: 100%;"
            >
                <template #before-input="{ node }">
                    <div @click="handleNodeClick(node)" class="d-inline-flex align-center cursor-pointer w-100"
                        :class="{
                            'text-primary': selectedNodeId === node.id,
                            'selected-node-background': selectedNodeId === node.id,
                        }"
                    >
                        <span class="text-subtitle-1 font-weight-medium text-truncate ml-1">
                            {{ node.text }}
                            <v-tooltip activator="parent" location="top">
                                {{ node.text }}
                            </v-tooltip>
                        </span>
                    </div>
                </template>
            </v-treeview>
        </v-card>
    </div>
</template>

<script>
import VTreeview from 'vue3-treeview';

import BackendFactory from '@/components/api/BackendFactory';

export default {
    components: {
        VTreeview,
    },
    props: {
        agentSkills: {
            type: Array,
            default: () => []
        },
        isLoading: {
            type: Boolean,
            default: false
        },
    },
    data: () => ({
        backend: null,
        // uploaded skills file
        skillsFile: null,

        // skills tree
        nodes: {},
        config: {
            roots: []
        },
        selectedNodeId: null,
    }),
    computed: {
    },
    watch: {
        skillsFile: {
            handler(newVal) {
                this.$emit('update:skillsFile', newVal);
            },
            deep: true
        },
        selectedNodeId: {
            handler(newVal) {
                this.$emit('update:skillFileName', newVal);
            },
            deep: true
        }
    },
    created() {
        this.backend = BackendFactory.createBackend();
    },
    async mounted() {
        if (this.agentSkills && this.agentSkills.length > 0) {
            await this.loadSkillFiles();
        }

        this.EventBus.on('skills-updated', async () => {
            await this.loadSkillFiles();
        });
    },
    methods: {
        handleSkillsChange(files) {
            if (files && files.length > 0) {
                this.skillsFile = files[0];
            } else {
                this.skillsFile = null;
            }
        },

        triggerSkillUpload() {
            if (!this.skillsFile) {
                return;
            }
            this.$emit('uploadSkills', this.skillsFile);
        },

        async loadSkillFiles() {
            this.nodes = {};
            this.config.roots = [];

            for (const skillName of this.agentSkills) {
                try {
                    const skillCheck = await this.backend.checkSkills(skillName);

                    if (!skillCheck || skillCheck.exists === false) {
                        console.warn(`서버에 스킬이 존재하지 않습니다: ${skillName}`);
                        continue;
                    }

                    const skill = await this.backend.getSkillFile(skillName);
                    if (!skill || !skill.skill_name) {
                        continue;
                    }

                    const skillId = skill.skill_name;
                    const skillText = skillCheck.name || skillId;
                    const files = Array.isArray(skill.files) ? skill.files : [];

                    if (!this.config.roots.includes(skillId)) {
                        this.config.roots.push(skillId);
                    }

                    this.nodes[skillId] = {
                        id: skillId,
                        text: skillText,
                        children: [],
                        state: {
                            opened: false
                        },
                        data: {
                            type: 'skill',
                            originalId: skillId,
                            fileCount: files.length,
                            description: skillCheck.description || '',
                            source: skillCheck.source || null,
                            documentCount: skillCheck.document_count ?? null
                        }
                    };

                    files.forEach((file, index) => {
                        const rawPath = (file.path || file.file_name || file.name || '').replace(/\\/g, '/');
                        const fallbackName = file.file_name || file.name || `file_${index + 1}`;
                        const segments = (rawPath ? rawPath.split('/') : [fallbackName]).filter(segment => segment && segment.trim().length > 0);

                        if (segments.length === 0) {
                            segments.push(fallbackName);
                        }

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
                                    ...(isFile ? {} : {
                                        state: {
                                            opened: false
                                        }
                                    }),
                                    data: {
                                        type: isFile ? 'file' : 'folder',
                                        originalId: segment,
                                        path: accumulatedPath,
                                        size: isFile ? (file.size ?? null) : null,
                                        modified: isFile ? (file.modified ?? null) : null
                                    }
                                };
                            } else if (isFile) {
                                this.nodes[nodeId].data.size = file.size ?? null;
                                this.nodes[nodeId].data.modified = file.modified ?? null;
                                this.nodes[nodeId].text = segment;
                            }

                            const parentChildren = this.nodes[parentId].children;
                            if (!parentChildren.includes(nodeId)) {
                                parentChildren.push(nodeId);
                            }

                            parentId = nodeId;
                        });
                    });

                    this.nodes[skillId].data = {
                        type: 'skill',
                        originalId: skillId,
                        fileCount: files.length,
                        description: skillCheck.description || '',
                        source: skillCheck.source || null,
                        documentCount: skillCheck.document_count ?? null
                    };
                } catch (error) {
                    console.error(`스킬 파일 정보를 불러오는데 실패했습니다: ${skillName}`, error);
                }
            }
        },

        /**
         * 트리 노드 클릭 핸들러
         * @param {Object} node - 클릭된 노드 객체
         */
        handleNodeClick(node) {
            this.selectedNodeId = null;
            if (!node || !node.id) {
                return;
            }
            const nodeId = node.id;
            const nodeType = node?.data?.type;

            if (nodeType === 'skill' || nodeType === 'folder') {
                if (!node.state) {
                    const initialState = {
                        opened: false
                    };
                    node.state = initialState;
                    if (this.nodes[nodeId]) {
                        this.nodes[nodeId].state = initialState;
                    }
                } else if (this.nodes[nodeId] && this.nodes[nodeId].state !== node.state) {
                    this.nodes[nodeId].state = node.state;
                }
                node.state.opened = !node.state.opened;
            }

            this.selectedNodeId = nodeId;
        },
    }
}
</script>

<style scoped>
::v-deep(.tree .node-text) {
    display: none;
}

.selected-node-background {
    background-color: rgba(var(--v-theme-primary), 0.1);
}
</style>
