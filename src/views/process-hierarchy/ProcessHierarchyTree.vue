<template>
    <div class="hierarchy-tree">
        <!-- Collapsed Mini View -->
        <div v-if="collapsed" class="tree-collapsed">
            <div
                v-for="sub in allSubProcesses"
                :key="sub.id"
                class="collapsed-item"
                :class="{ 'collapsed-item-selected': selectedId === sub.id }"
                :title="sub.name"
                @click="selectProcess(sub)"
            >
                <v-icon size="14" :color="selectedId === sub.id ? 'primary' : 'grey'">
                    mdi-file-document-outline
                </v-icon>
            </div>
        </div>

        <template v-else>
        <!-- Header -->
        <div v-if="!hideHeader" class="tree-header pa-4 pb-2">
            <div class="text-h6 font-weight-bold">
                {{ $t('processHierarchy.title') || 'Process Hierarchy' }}
            </div>
            <div class="text-caption text-medium-emphasis mt-1">
                {{ $t('processHierarchy.subtitle') || '프로세스 체계도 기반 트리' }}
            </div>
            <div v-if="statusLoading && !loading" class="tree-status-loading mt-2">
                <v-progress-linear indeterminate color="primary" height="3" rounded />
            </div>

            <!-- Search -->
            <v-text-field
                v-model="searchText"
                :placeholder="$t('processHierarchy.searchPlaceholder') || '프로세스 검색...'"
                density="compact"
                variant="outlined"
                hide-details
                prepend-inner-icon="mdi-magnify"
                clearable
                class="mt-3"
            />
        </div>

        <!-- Tree Content -->
        <div class="tree-content">
            <div v-if="loading" class="tree-loading pa-4">
                <div class="d-flex align-center mb-3">
                    <v-progress-circular indeterminate size="18" width="2" color="primary" class="mr-2" />
                    <span class="text-caption text-medium-emphasis">
                        {{ $t('common.loading') || '불러오는 중...' }}
                    </span>
                </div>
                <v-skeleton-loader
                    v-for="idx in 8"
                    :key="idx"
                    type="list-item-two-line"
                    class="tree-skeleton-item"
                />
            </div>

            <div v-else-if="!treeNodes.length" class="pa-4 text-center text-medium-emphasis">
                {{ $t('processHierarchy.noData') || '프로세스가 없습니다.' }}
            </div>

            <!-- Mega Process Level -->
            <div v-for="mega in filteredTreeNodes" :key="mega.id" class="tree-mega">
                <div
                    class="tree-node tree-node-mega"
                    @click="toggleExpand(mega.id)"
                >
                    <v-icon size="16" class="mr-1">
                        {{ isExpanded(mega.id) ? 'mdi-chevron-down' : 'mdi-chevron-right' }}
                    </v-icon>
                    <v-icon size="16" class="mr-2" color="primary">mdi-folder-network</v-icon>
                    <span class="tree-node-label">{{ mega.name }}</span>
                    <div class="ml-auto d-flex align-center ga-1">
                        <v-tooltip v-if="canManagePermissions" location="bottom">
                            <template v-slot:activator="{ props: tp }">
                                <v-icon
                                    v-bind="tp"
                                    size="14"
                                    class="permission-icon"
                                    style="cursor: pointer"
                                    @click.stop="openPermission({ id: mega.id, name: mega.name, _permLevel: 'mega' })"
                                >mdi-lock-outline</v-icon>
                            </template>
                            <span>{{ $t('permissionDialog.title') || '권한 설정' }}</span>
                        </v-tooltip>
                        <v-chip size="x-small" variant="tonal">{{ mega.subCount }}</v-chip>
                    </div>
                </div>

                <!-- Domain Level -->
                <div v-if="isExpanded(mega.id)">
                    <div v-for="domain in mega.children" :key="domain.id" class="tree-domain">
                        <div
                            class="tree-node tree-node-domain"
                            @click="toggleExpand(domain.id)"
                        >
                            <v-icon size="16" class="mr-1">
                                {{ isExpanded(domain.id) ? 'mdi-chevron-down' : 'mdi-chevron-right' }}
                            </v-icon>
                            <v-icon size="16" class="mr-2" :color="domain.color || 'grey'">mdi-folder</v-icon>
                            <span class="tree-node-label">{{ domain.name }}</span>
                            <div class="ml-auto d-flex align-center ga-1">
                                <v-tooltip v-if="canManagePermissions" location="bottom">
                                    <template v-slot:activator="{ props: tp }">
                                        <v-icon
                                            v-bind="tp"
                                            size="14"
                                            class="permission-icon"
                                            style="cursor: pointer"
                                            @click.stop="openPermission({ id: domain.id, name: domain.name, _permLevel: 'domain' })"
                                        >mdi-lock-outline</v-icon>
                                    </template>
                                    <span>{{ $t('permissionDialog.title') || '권한 설정' }}</span>
                                </v-tooltip>
                                <v-chip size="x-small" variant="tonal">{{ domain.subCount }}</v-chip>
                            </div>
                        </div>

                        <!-- Major Process Level -->
                        <div v-if="isExpanded(domain.id)">
                            <div v-for="major in domain.children" :key="major.id" class="tree-major">
                                <div
                                    class="tree-node tree-node-major"
                                    @click="toggleExpand(major.id)"
                                >
                                    <v-icon size="16" class="mr-1">
                                        {{ isExpanded(major.id) ? 'mdi-chevron-down' : 'mdi-chevron-right' }}
                                    </v-icon>
                                    <v-icon size="16" class="mr-2">mdi-folder-outline</v-icon>
                                    <span class="tree-node-label">{{ major.name }}</span>
                                    <div class="ml-auto d-flex align-center ga-1">
                                        <v-tooltip v-if="canManagePermissions" location="bottom">
                                            <template v-slot:activator="{ props: tp }">
                                                <v-icon
                                                    v-bind="tp"
                                                    size="14"
                                                    class="permission-icon"
                                                    style="cursor: pointer"
                                                    @click.stop="openPermission({ id: major.id, name: major.name, _permLevel: 'major' })"
                                                >mdi-lock-outline</v-icon>
                                            </template>
                                            <span>{{ $t('permissionDialog.title') || '권한 설정' }}</span>
                                        </v-tooltip>
                                    </div>
                                </div>

                                <!-- Sub Process Level (Leaf Nodes) -->
                                <div v-if="isExpanded(major.id)">
                                    <div
                                        v-for="sub in major.children"
                                        :key="sub.id"
                                        class="tree-node tree-node-sub"
                                        :class="{ 'tree-node-selected': selectedId === sub.id }"
                                        @click.stop="selectProcess(sub)"
                                    >
                                        <v-icon size="14" class="mr-2 ml-1">mdi-file-document-outline</v-icon>
                                        <span class="tree-node-label text-truncate">{{ sub.name }}</span>
                                        <div class="ml-auto d-flex align-center ga-1 flex-shrink-0">
                                            <!-- Editing lock indicator -->
                                            <v-tooltip v-if="lockMap.has(sub.id)" location="bottom">
                                                <template v-slot:activator="{ props: tp }">
                                                    <v-icon v-bind="tp" size="14" color="warning" class="mr-1">mdi-pencil-lock</v-icon>
                                                </template>
                                                <span>{{ lockMap.get(sub.id)?.user_id }} {{ $t('processHierarchy.lockedByOther') || '님이 편집 중' }}</span>
                                            </v-tooltip>
                                            <v-tooltip v-if="canManagePermissions" location="bottom">
                                                <template v-slot:activator="{ props: tp }">
                                                    <v-icon
                                                        v-bind="tp"
                                                        size="14"
                                                        class="permission-icon"
                                                        style="cursor: pointer"
                                                        @click.stop="openPermission({ ...sub, _permLevel: 'sub' })"
                                                    >mdi-lock-outline</v-icon>
                                                </template>
                                                <span>{{ $t('permissionDialog.title') || '권한 설정' }}</span>
                                            </v-tooltip>
                                            <v-chip
                                                v-if="getSubVersion(sub.id)"
                                                size="x-small"
                                                variant="tonal"
                                                color="primary"
                                                class="version-chip"
                                            >v{{ getSubVersion(sub.id) }}</v-chip>
                                            <v-chip
                                                v-else
                                                size="x-small"
                                                variant="tonal"
                                                color="grey"
                                                class="version-chip"
                                            >{{ $t('processHierarchy.noVersion') || 'new' }}</v-chip>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        </template>
    </div>
</template>

<script>
export default {
    name: 'ProcessHierarchyTree',
    props: {
        procMap: { type: Object, default: null },
        metricsMap: { type: Object, default: null },
        definitionList: { type: Array, default: () => [] },
        selectedId: { type: String, default: '' },
        hideHeader: { type: Boolean, default: false },
        collapsed: { type: Boolean, default: false },
        loading: { type: Boolean, default: false },
        statusLoading: { type: Boolean, default: false },
        lockMap: { type: Map, default: () => new Map() },
        canManagePermissions: { type: Boolean, default: false },
    },
    emits: ['select', 'openPermission'],
    data() {
        return {
            searchText: '',
            expandedNodes: new Set(),
        };
    },
    computed: {
        domainMap() {
            const map = {};
            if (this.metricsMap?.domains) {
                this.metricsMap.domains.forEach(d => {
                    map[d.id] = d;
                });
            }
            return map;
        },
        processDomainMap() {
            const map = {};
            if (this.metricsMap?.processes) {
                this.metricsMap.processes.forEach(p => {
                    map[p.id] = p.domain_id;
                });
            }
            return map;
        },
        definitionStatusMap() {
            const map = {};
            if (this.definitionList) {
                this.definitionList.forEach(def => {
                    const id = def.file_name || def.id;
                    map[id] = {
                        status: def.approval_state || def.status || 'draft',
                        version: def.version || def.version_tag || '',
                    };
                });
            }
            return map;
        },
        treeNodes() {
            if (!this.procMap?.mega_proc_list) return [];

            const nodes = [];

            for (const mega of this.procMap.mega_proc_list) {
                const megaNode = {
                    id: `mega_${mega.id}`,
                    name: mega.name,
                    children: [],
                    subCount: 0,
                };

                // Group major processes by domain
                const domainGroups = {};

                if (mega.major_proc_list) {
                    for (const major of mega.major_proc_list) {
                        const domainId = major.domain || this.processDomainMap[major.id] || 'unknown';
                        if (!domainGroups[domainId]) {
                            const domainInfo = this.domainMap[domainId];
                            domainGroups[domainId] = {
                                id: `domain_${mega.id}_${domainId}`,
                                name: domainInfo?.name || domainId,
                                color: domainInfo?.color || '',
                                children: [],
                                subCount: 0,
                            };
                        }

                        const majorNode = {
                            id: `major_${major.id}`,
                            name: major.name,
                            children: [],
                        };

                        if (major.sub_proc_list) {
                            for (const sub of major.sub_proc_list) {
                                majorNode.children.push({
                                    id: sub.id,
                                    name: sub.name,
                                });
                            }
                        }

                        domainGroups[domainId].children.push(majorNode);
                        domainGroups[domainId].subCount += majorNode.children.length;
                    }
                }

                for (const domainId in domainGroups) {
                    megaNode.children.push(domainGroups[domainId]);
                    megaNode.subCount += domainGroups[domainId].subCount;
                }

                nodes.push(megaNode);
            }

            return nodes;
        },
        allSubProcesses() {
            const subs = [];
            for (const mega of this.treeNodes) {
                for (const domain of (mega.children || [])) {
                    for (const major of (domain.children || [])) {
                        for (const sub of (major.children || [])) {
                            subs.push(sub);
                        }
                    }
                }
            }
            return subs;
        },
        filteredTreeNodes() {
            if (!this.searchText) return this.treeNodes;
            const query = this.searchText.toLowerCase();
            return this.filterNodes(this.treeNodes, query);
        },
    },
    methods: {
        filterNodes(nodes, query) {
            const result = [];
            for (const node of nodes) {
                const nameMatch = node.name?.toLowerCase().includes(query);
                let filteredChildren = [];

                if (node.children) {
                    filteredChildren = this.filterNodes(node.children, query);
                }

                if (nameMatch || filteredChildren.length > 0) {
                    result.push({
                        ...node,
                        children: filteredChildren.length > 0 ? filteredChildren : node.children,
                    });
                    // Auto-expand matched nodes
                    if (filteredChildren.length > 0) {
                        this.expandedNodes.add(node.id);
                    }
                }
            }
            return result;
        },

        toggleExpand(nodeId) {
            if (this.expandedNodes.has(nodeId)) {
                this.expandedNodes.delete(nodeId);
            } else {
                this.expandedNodes.add(nodeId);
            }
        },

        isExpanded(nodeId) {
            return this.expandedNodes.has(nodeId);
        },

        selectProcess(sub) {
            this.$emit('select', sub.id, sub.name);
        },

        openPermission(sub) {
            if (!this.canManagePermissions) return;
            this.$emit('openPermission', sub);
        },

        getSubStatus(subId) {
            return this.definitionStatusMap[subId]?.status || '';
        },

        getSubVersion(subId) {
            return this.definitionStatusMap[subId]?.version || '';
        },
    },
};
</script>

<style scoped>
.hierarchy-tree {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: #fff;
}

.tree-header {
    flex-shrink: 0;
    border-bottom: 1px solid #eee;
}

.tree-content {
    flex: 1;
    overflow-y: auto;
    padding: 4px 0;
}

.tree-loading {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.tree-skeleton-item {
    border-radius: 10px;
}

.tree-node {
    display: flex;
    align-items: center;
    padding: 6px 12px;
    cursor: pointer;
    font-size: 13px;
    user-select: none;
    transition: background-color 0.15s;
}

.tree-node:hover {
    background-color: #f5f5f5;
}

.tree-node-selected {
    background-color: #e3f2fd !important;
    font-weight: 500;
}

.tree-node-mega {
    padding-left: 8px;
    font-weight: 600;
}

.tree-node-domain {
    padding-left: 24px;
}

.tree-node-major {
    padding-left: 40px;
}

.tree-node-sub {
    padding-left: 56px;
    font-size: 12.5px;
}

.tree-node-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
}

.permission-icon {
    opacity: 0;
    transition: opacity 0.15s;
}

.tree-node:hover .permission-icon {
    opacity: 0.5;
}

.tree-node:hover .permission-icon:hover {
    opacity: 1;
}

.version-chip {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.02em;
}

.tree-collapsed {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 8px 4px;
    gap: 2px;
    overflow-y: auto;
    height: 100%;
}

.collapsed-item {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    cursor: pointer;
    transition: background-color 0.15s;
}

.collapsed-item:hover {
    background-color: #f5f5f5;
}

.collapsed-item-selected {
    background-color: #e3f2fd !important;
}
</style>
