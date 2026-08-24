<template>
    <div class="hierarchy-tree">
        <!-- Collapsed Mini View -->
        <div v-if="collapsed" class="tree-collapsed">
            <div
                v-for="sub in allSubProcesses"
                :key="displayText(sub.id)"
                class="collapsed-item"
                :class="{ 'collapsed-item-selected': selectedId === sub.id }"
                :title="displayText(sub.name)"
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
            <div class="d-flex align-center justify-space-between">
                <div class="text-h6 font-weight-bold">
                    {{ $t('processHierarchy.title') || 'Process Hierarchy' }}
                </div>
                <div class="d-flex align-center ga-1">
                    <v-tooltip v-if="isOwner" location="bottom">
                        <template v-slot:activator="{ props: tp }">
                            <v-btn
                                v-bind="tp"
                                icon
                                size="x-small"
                                variant="text"
                                @click="showAddCallActivityForm"
                            >
                                <v-icon size="16">mdi-call-split</v-icon>
                            </v-btn>
                        </template>
                        <span>{{ $t('processHierarchy.addCallActivitySub') || '프로세스 모듈 추가' }}</span>
                    </v-tooltip>
                    <v-tooltip v-if="isOwner" location="bottom">
                        <template v-slot:activator="{ props: tp }">
                            <v-btn
                                v-bind="tp"
                                icon
                                size="x-small"
                                variant="text"
                                @click="showAddMegaForm"
                            >
                                <v-icon size="16">mdi-plus</v-icon>
                            </v-btn>
                        </template>
                        <span>{{ $t('processHierarchy.addMega') || 'Mega 프로세스 추가' }}</span>
                    </v-tooltip>
                    <v-btn icon size="x-small" variant="text" @click="$emit('collapse')">
                        <v-icon size="16">mdi-chevron-left</v-icon>
                    </v-btn>
                </div>
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

            <!-- Inline Add Call Activity Sub Form -->
            <div v-if="addingCallActivity" class="tree-inline-form pa-2 mx-2 mb-1">
                <div class="d-flex align-center mb-2">
                    <v-icon size="14" color="blue-grey" class="mr-1">mdi-call-split</v-icon>
                    <span class="text-caption font-weight-bold text-blue-grey">프로세스 모듈</span>
                </div>
                <v-text-field
                    v-model="newCallActivityName"
                    :placeholder="$t('processHierarchy.callActivityNamePlaceholder') || '프로세스 모듈 이름'"
                    density="compact"
                    variant="outlined"
                    hide-details
                    autofocus
                    class="mb-2"
                    @keypress.enter="confirmAddCallActivity"
                    @keydown.escape="cancelAddCallActivity"
                />
                <div class="d-flex justify-end ga-1">
                    <v-btn size="x-small" variant="text" @click="cancelAddCallActivity">
                        {{ $t('common.cancel') || '취소' }}
                    </v-btn>
                    <v-btn size="x-small" variant="flat" color="primary" :disabled="!newCallActivityName.trim()" @click="confirmAddCallActivity">
                        {{ $t('common.add') || '추가' }}
                    </v-btn>
                </div>
            </div>

            <!-- Inline Add Mega Form -->
            <div v-if="addingMega" class="tree-inline-form pa-2 mx-2 mb-1">
                <v-text-field
                    v-model="newMegaName"
                    :placeholder="$t('processHierarchy.megaNamePlaceholder') || 'Mega 프로세스 이름'"
                    density="compact"
                    variant="outlined"
                    hide-details
                    autofocus
                    class="mb-2"
                    @keypress.enter="confirmAddMega"
                    @keydown.escape="cancelAddMega"
                />
                <div class="d-flex justify-end ga-1">
                    <v-btn size="x-small" variant="text" @click="cancelAddMega">
                        {{ $t('common.cancel') || '취소' }}
                    </v-btn>
                    <v-btn size="x-small" variant="flat" color="primary" :disabled="!newMegaName.trim()" @click="confirmAddMega">
                        {{ $t('common.add') || '추가' }}
                    </v-btn>
                </div>
            </div>

            <!-- Mega Process Level -->
            <div v-for="mega in filteredTreeNodes" :key="mega.id" class="tree-mega">
                <div
                    class="tree-node tree-node-mega"
                    @click="toggleExpand(mega.id)"
                    @dblclick.stop="startRename('mega', getRawMegaId(mega.id), mega.name)"
                >
                    <v-icon size="16" class="mr-1">
                        {{ isExpanded(mega.id) ? 'mdi-chevron-down' : 'mdi-chevron-right' }}
                    </v-icon>
                    <v-icon size="16" class="mr-2" color="primary">mdi-folder-network</v-icon>
                    <template v-if="renamingId === getRawMegaId(mega.id) && renamingLevel === 'mega'">
                        <input
                            ref="renameInput"
                            v-model="renameValue"
                            class="tree-rename-input"
                            @click.stop
                            @dblclick.stop
                            @keypress.enter="confirmRename"
                            @keydown.escape="cancelRename"
                            @blur="confirmRename"
                        />
                    </template>
                    <span v-else class="tree-node-label">{{ mega.name }}</span>
                    <div class="ml-auto d-flex align-center ga-1">
                        <v-tooltip v-if="isAdmin" location="bottom">
                            <template v-slot:activator="{ props: tp }">
                                <v-icon
                                    v-bind="tp"
                                    size="14"
                                    class="rename-icon"
                                    style="cursor: pointer"
                                    @click.stop="startRename('mega', getRawMegaId(mega.id), mega.name)"
                                >mdi-pencil-outline</v-icon>
                            </template>
                            <span>이름 변경</span>
                        </v-tooltip>
                        <v-tooltip v-if="isOwner" location="bottom">
                            <template v-slot:activator="{ props: tp }">
                                <v-icon
                                    v-bind="tp"
                                    size="14"
                                    class="add-process-icon"
                                    style="cursor: pointer"
                                    @click.stop="showAddMajorForm(getRawMegaId(mega.id))"
                                >mdi-plus</v-icon>
                            </template>
                            <span>{{ $t('processHierarchy.addMajor') || 'Major 프로세스 추가' }}</span>
                        </v-tooltip>
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
                                    @dblclick.stop="startRename('major', getRawMajorId(major.id), major.name, getRawMegaId(mega.id))"
                                >
                                    <v-icon size="16" class="mr-1">
                                        {{ isExpanded(major.id) ? 'mdi-chevron-down' : 'mdi-chevron-right' }}
                                    </v-icon>
                                    <v-icon size="16" class="mr-2">mdi-folder-outline</v-icon>
                                    <template v-if="renamingId === getRawMajorId(major.id) && renamingLevel === 'major'">
                                        <input
                                            ref="renameInput"
                                            v-model="renameValue"
                                            class="tree-rename-input"
                                            @click.stop
                                            @dblclick.stop
                                            @keypress.enter="confirmRename"
                                            @keydown.escape="cancelRename"
                                            @blur="confirmRename"
                                        />
                                    </template>
                                    <span v-else class="tree-node-label">{{ major.name }}</span>
                                    <div class="ml-auto d-flex align-center ga-1">
                                        <v-tooltip v-if="isAdmin" location="bottom">
                                            <template v-slot:activator="{ props: tp }">
                                                <v-icon
                                                    v-bind="tp"
                                                    size="14"
                                                    class="rename-icon"
                                                    style="cursor: pointer"
                                                    @click.stop="startRename('major', getRawMajorId(major.id), major.name, getRawMegaId(mega.id))"
                                                >mdi-pencil-outline</v-icon>
                                            </template>
                                            <span>이름 변경</span>
                                        </v-tooltip>
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
                                                <span>{{ displayText(lockMap.get(sub.id)?.user_id) }} {{ $t('processHierarchy.lockedByOther') || '님이 편집 중' }}</span>
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
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Inline Add Major Form -->
                    <div v-if="addingMajorForMega === getRawMegaId(mega.id)" class="tree-inline-form pa-2 ml-6 mr-2 mb-1">
                        <v-text-field
                            v-model="newMajorName"
                            :placeholder="$t('processHierarchy.majorNamePlaceholder') || 'Major 프로세스 이름'"
                            density="compact"
                            variant="outlined"
                            hide-details
                            autofocus
                            class="mb-2"
                            @keypress.enter="confirmAddMajor"
                            @keydown.escape="cancelAddMajor"
                        />
                        <v-select
                            v-model="newMajorDomain"
                            :items="domainOptions"
                            item-title="name"
                            item-value="name"
                            :placeholder="$t('processHierarchy.selectDomain') || '도메인 선택'"
                            density="compact"
                            variant="outlined"
                            hide-details
                            class="mb-2"
                        />
                        <div class="d-flex justify-end ga-1">
                            <v-btn size="x-small" variant="text" @click="cancelAddMajor">
                                {{ $t('common.cancel') || '취소' }}
                            </v-btn>
                            <v-btn size="x-small" variant="flat" color="primary" :disabled="!newMajorName.trim() || !newMajorDomain" @click="confirmAddMajor">
                                {{ $t('common.add') || '추가' }}
                            </v-btn>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        </template>
    </div>
</template>

<script>
import { getDomainSortIndex } from '@/views/process-architecture/useProcessArchitecture';
import { getMajorBusinessDomain } from '@/views/process-architecture/processClassification';
import { toSafeText } from '@/utils/safeText';

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
        isAdmin: { type: Boolean, default: false },
        isOwner: { type: Boolean, default: false },
    },
    emits: ['select', 'openPermission', 'collapse', 'addMegaProcess', 'addMajorProcess', 'addCallActivitySub', 'renameProcess'],
    data() {
        return {
            searchText: '',
            expandedNodes: new Set(),
            addingMega: false,
            newMegaName: '',
            addingMajorForMega: null,
            newMajorName: '',
            newMajorDomain: '',
            addingCallActivity: false,
            newCallActivityName: '',
            renamingLevel: null,
            renamingId: null,
            renamingMegaId: null,
            renameValue: '',
        };
    },
    computed: {
        domainMap() {
            const map = {};
            if (this.metricsMap?.domains) {
                this.metricsMap.domains.forEach(d => {
                    const id = toSafeText(d?.id).trim();
                    if (!id) return;
                    map[id] = {
                        ...d,
                        id,
                        name: toSafeText(d?.name || id),
                        color: toSafeText(d?.color).trim(),
                    };
                });
            }
            return map;
        },
        processDomainMap() {
            const map = {};
            if (this.metricsMap?.processes) {
                this.metricsMap.processes.forEach(p => {
                    const id = toSafeText(p?.id).trim();
                    if (!id) return;
                    map[id] = toSafeText(p?.domain_id).trim();
                });
            }
            return map;
        },
        definitionStatusMap() {
            const map = {};
            if (this.definitionList) {
                this.definitionList.forEach(def => {
                    const id = toSafeText(def?.file_name || def?.id).trim();
                    if (!id) return;
                    const version = toSafeText(def?.version).trim();
                    map[id] = {
                        status: version ? toSafeText(def?.approval_state || def?.status).trim() : '',
                        version,
                    };
                });
            }
            return map;
        },
        treeNodes() {
            if (!this.procMap?.mega_proc_list) return [];

            const nodes = [];

            for (const [megaIndex, mega] of this.procMap.mega_proc_list.entries()) {
                const megaId = toSafeText(mega?.id || `mega-${megaIndex}`).trim() || `mega-${megaIndex}`;
                const megaNode = {
                    id: `mega_${megaId}`,
                    name: toSafeText(mega?.name || megaId),
                    children: [],
                    subCount: 0,
                };

                // Group major processes by domain
                const domainGroups = {};

                if (mega.major_proc_list) {
                    for (const [majorIndex, major] of mega.major_proc_list.entries()) {
                        const majorId = toSafeText(major?.id || `${megaId}-major-${majorIndex}`).trim() || `${megaId}-major-${majorIndex}`;
                        const resolvedDomain = toSafeText(
                            getMajorBusinessDomain(major, this.metricsMap?.domains || []) ||
                            this.processDomainMap[majorId] ||
                            'unknown'
                        ).trim() || 'unknown';
                        const domainInfo = this.domainMap[resolvedDomain] || (this.metricsMap?.domains || []).find(d => {
                            const domainName = toSafeText(d?.name).trim();
                            const domainId = toSafeText(d?.id).trim();
                            return domainName === resolvedDomain || domainId === resolvedDomain;
                        });
                        const domainId = toSafeText(domainInfo?.id || resolvedDomain).trim() || 'unknown';
                        if (!domainGroups[domainId]) {
                            domainGroups[domainId] = {
                                id: `domain_${megaId}_${domainId}`,
                                name: toSafeText(domainInfo?.name || resolvedDomain),
                                color: toSafeText(domainInfo?.color).trim(),
                                children: [],
                                subCount: 0,
                            };
                        }

                        const majorNode = {
                            id: `major_${majorId}`,
                            name: toSafeText(major?.name || majorId),
                            children: [],
                        };

                        if (major.sub_proc_list) {
                            for (const [subIndex, sub] of major.sub_proc_list.entries()) {
                                const subId = toSafeText(sub?.id || `${majorId}-sub-${subIndex}`).trim() || `${majorId}-sub-${subIndex}`;
                                majorNode.children.push({
                                    id: subId,
                                    name: toSafeText(sub?.name || subId),
                                });
                            }
                        }

                        domainGroups[domainId].children.push(majorNode);
                        domainGroups[domainId].subCount += majorNode.children.length;
                    }
                }

                const sortedDomainKeys = Object.keys(domainGroups).sort(
                    (a, b) => getDomainSortIndex(domainGroups[a].name) - getDomainSortIndex(domainGroups[b].name)
                );
                for (const domainId of sortedDomainKeys) {
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
        domainOptions() {
            if (!this.metricsMap?.domains) return [];
            return this.metricsMap.domains.map((domain, index) => {
                const id = toSafeText(domain?.id || `domain-${index}`).trim() || `domain-${index}`;
                return {
                    ...domain,
                    id,
                    name: toSafeText(domain?.name || id),
                    color: toSafeText(domain?.color).trim(),
                };
            });
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

        displayText(value) {
            return toSafeText(value);
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
            this.$emit('select', toSafeText(sub?.id).trim(), toSafeText(sub?.name).trim());
        },

        openPermission(sub) {
            if (!this.canManagePermissions) return;
            this.$emit('openPermission', {
                ...sub,
                id: toSafeText(sub?.id).trim(),
                name: toSafeText(sub?.name).trim(),
            });
        },

        getSubStatus(subId) {
            return this.definitionStatusMap[subId]?.status || '';
        },

        getSubVersion(subId) {
            return this.definitionStatusMap[subId]?.version || '';
        },

        // --- Add Mega Process ---
        showAddMegaForm() {
            this.addingMega = true;
            this.newMegaName = '';
            this.cancelAddMajor();
            this.cancelAddCallActivity();
        },
        cancelAddMega() {
            this.addingMega = false;
            this.newMegaName = '';
        },
        confirmAddMega() {
            const name = this.newMegaName.trim();
            if (!name) return;
            const isDuplicate = (this.procMap?.mega_proc_list || []).some(
                m => m.name.toLowerCase() === name.toLowerCase()
            );
            if (isDuplicate) {
                if (this.$toast) {
                    this.$toast.error(this.$t('processHierarchy.duplicateMegaName') || '동일한 이름의 Mega 프로세스가 이미 존재합니다.');
                }
                return;
            }
            this.$emit('addMegaProcess', { name });
            this.cancelAddMega();
        },

        // --- Add Call Activity SubProcess ---
        showAddCallActivityForm() {
            this.addingCallActivity = true;
            this.newCallActivityName = '';
            this.cancelAddMega();
            this.cancelAddMajor();
        },
        cancelAddCallActivity() {
            this.addingCallActivity = false;
            this.newCallActivityName = '';
        },
        confirmAddCallActivity() {
            const name = this.newCallActivityName.trim();
            if (!name) return;
            this.$emit('addCallActivitySub', { name });
            this.cancelAddCallActivity();
        },

        // --- Add Major Process ---
        showAddMajorForm(rawMegaId) {
            this.addingMajorForMega = rawMegaId;
            this.newMajorName = '';
            this.newMajorDomain = '';
            this.cancelAddMega();
        },
        cancelAddMajor() {
            this.addingMajorForMega = null;
            this.newMajorName = '';
            this.newMajorDomain = '';
        },
        confirmAddMajor() {
            const name = this.newMajorName.trim();
            if (!name) return;
            if (!this.newMajorDomain) {
                if (this.$toast) {
                    this.$toast.error(this.$t('processHierarchy.domainRequired') || '도메인을 선택해주세요.');
                }
                return;
            }
            const mega = (this.procMap?.mega_proc_list || []).find(m => m.id === this.addingMajorForMega);
            if (mega) {
                const isDuplicate = (mega.major_proc_list || []).some(
                    m => m.name.toLowerCase() === name.toLowerCase()
                );
                if (isDuplicate) {
                    if (this.$toast) {
                        this.$toast.error(this.$t('processHierarchy.duplicateMajorName') || '동일한 이름의 Major 프로세스가 이미 존재합니다.');
                    }
                    return;
                }
            }
            this.$emit('addMajorProcess', {
                megaId: this.addingMajorForMega,
                name,
                domain: this.newMajorDomain,
            });
            this.cancelAddMajor();
        },

        getRawMegaId(treeNodeId) {
            return toSafeText(treeNodeId).replace(/^mega_/, '');
        },

        getRawMajorId(treeNodeId) {
            return toSafeText(treeNodeId).replace(/^major_/, '');
        },

        // --- Rename Process ---
        startRename(level, id, currentName, megaId) {
            if (!this.isAdmin) return;
            this.renamingLevel = level;
            this.renamingId = id;
            this.renamingMegaId = megaId || null;
            this.renameValue = currentName;
            this.$nextTick(() => {
                const input = this.$refs.renameInput;
                const el = Array.isArray(input) ? input[0] : input;
                if (el) {
                    el.focus();
                    el.select();
                }
            });
        },
        cancelRename() {
            this.renamingLevel = null;
            this.renamingId = null;
            this.renamingMegaId = null;
            this.renameValue = '';
        },
        confirmRename() {
            const name = this.renameValue.trim();
            if (!name || !this.renamingLevel || !this.renamingId) {
                this.cancelRename();
                return;
            }
            // Find the original name to check if it actually changed
            let originalName = '';
            if (this.renamingLevel === 'mega') {
                const mega = (this.procMap?.mega_proc_list || []).find(m => m.id === this.renamingId);
                originalName = mega?.name || '';
            } else if (this.renamingLevel === 'major') {
                for (const mega of (this.procMap?.mega_proc_list || [])) {
                    const major = (mega.major_proc_list || []).find(m => m.id === this.renamingId);
                    if (major) {
                        originalName = major.name || '';
                        break;
                    }
                }
            }
            if (name === originalName) {
                this.cancelRename();
                return;
            }
            this.$emit('renameProcess', {
                level: this.renamingLevel,
                id: this.renamingId,
                megaId: this.renamingMegaId,
                name,
            });
            this.cancelRename();
        },

        expandToSelected() {
            if (!this.selectedId || !this.treeNodes?.length) return;
            for (const mega of this.treeNodes) {
                for (const domain of (mega.children || [])) {
                    for (const major of (domain.children || [])) {
                        const found = (major.children || []).some(sub => sub.id === this.selectedId);
                        if (found) {
                            this.expandedNodes.add(mega.id);
                            this.expandedNodes.add(domain.id);
                            this.expandedNodes.add(major.id);
                            this.$nextTick(() => {
                                const el = this.$el?.querySelector('.tree-node-selected');
                                if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
                            });
                            return;
                        }
                    }
                }
            }
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

.add-process-icon {
    opacity: 0;
    transition: opacity 0.15s;
}

.tree-node:hover .add-process-icon {
    opacity: 0.5;
}

.tree-node:hover .add-process-icon:hover {
    opacity: 1;
}

.tree-inline-form {
    background: rgba(var(--v-theme-primary), 0.04);
    border: 1px solid rgba(var(--v-theme-primary), 0.15);
    border-radius: 8px;
}

.rename-icon {
    opacity: 0;
    transition: opacity 0.15s;
}

.tree-node:hover .rename-icon {
    opacity: 0.5;
}

.tree-node:hover .rename-icon:hover {
    opacity: 1;
}

.tree-rename-input {
    flex: 1;
    min-width: 0;
    font-size: 13px;
    padding: 2px 6px;
    border: 1px solid rgba(var(--v-theme-primary), 0.5);
    border-radius: 4px;
    outline: none;
    background: #fff;
}

.tree-rename-input:focus {
    border-color: rgb(var(--v-theme-primary));
    box-shadow: 0 0 0 2px rgba(var(--v-theme-primary), 0.15);
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
