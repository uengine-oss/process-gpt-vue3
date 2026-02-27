<template>
    <v-card class="permission-dialog">
        <!-- Header with glass effect -->
        <div class="dialog-header">
            <div class="header-content">
                <div class="header-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3zm0 10.99h6c-.45 3.4-2.93 6.22-6 7.01V13H6v-4.28l6-2.25V13z" fill="currentColor"/>
                    </svg>
                </div>
                <div class="header-text">
                    <h2 class="dialog-title">{{ $t('permissionDialog.title') }}</h2>
                    <div class="process-badge">
                        <span class="badge-dot"></span>
                        {{ procDef?.name || procDef?.id }}
                    </div>
                </div>
            </div>
            <button class="close-btn" @click="close">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
            </button>
        </div>

        <div class="dialog-body">
            <!-- Permission Scope Selector -->
            <div class="section">
                <div class="section-label">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M12 6v6l4 2"/>
                    </svg>
                    {{ $t('permissionDialog.permissionLevel') }}
                </div>
                <div class="scope-selector">
                    <button
                        v-for="level in scopeLevels"
                        :key="level.value"
                        class="scope-btn"
                        :class="{ active: permissionLevel === level.value, disabled: level.disabled }"
                        :disabled="level.disabled"
                        @click="permissionLevel = level.value"
                    >
                        <span class="scope-icon">{{ level.icon }}</span>
                        <span class="scope-label">{{ level.label }}</span>
                    </button>
                </div>
            </div>

            <!-- Public Access Toggle -->
            <div class="public-toggle-card" :class="{ active: isPublic }">
                <div class="toggle-content">
                    <div class="toggle-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" fill="currentColor"/>
                        </svg>
                    </div>
                    <div class="toggle-text">
                        <span class="toggle-title">{{ $t('permissionDialog.publicAccess') }}</span>
                        <span class="toggle-desc">모든 사용자가 접근 가능</span>
                    </div>
                </div>
                <label class="switch">
                    <input type="checkbox" v-model="isPublic">
                    <span class="slider"></span>
                </label>
            </div>

            <!-- Add Target Section -->
            <div v-if="!isPublic" class="section add-target-section">
                <div class="section-label">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/>
                        <circle cx="9" cy="7" r="4"/>
                        <path d="M19 8v6M22 11h-6"/>
                    </svg>
                    {{ $t('permissionDialog.addTarget') }}
                </div>

                <!-- Target Type Tabs -->
                <div class="target-tabs">
                    <button
                        v-for="tab in targetTabs"
                        :key="tab.value"
                        class="target-tab"
                        :class="{ active: targetTab === tab.value }"
                        @click="targetTab = tab.value"
                    >
                        <component :is="tab.icon" class="tab-icon" />
                        {{ tab.label }}
                    </button>
                </div>

                <!-- Search Input -->
                <div class="search-container">
                    <div class="search-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="11" cy="11" r="8"/>
                            <path d="M21 21l-4.35-4.35"/>
                        </svg>
                    </div>
                    <v-autocomplete
                        v-if="targetTab === 'user'"
                        v-model="selectedUser"
                        :items="availableUsers"
                        :item-title="item => `${item.username} (${item.email})`"
                        item-value="id"
                        :placeholder="$t('permissionDialog.searchUser')"
                        variant="plain"
                        density="compact"
                        hide-details
                        hide-no-data
                        class="search-input"
                        @update:model-value="addUserPermission"
                    />
                    <v-autocomplete
                        v-else-if="targetTab === 'organization'"
                        v-model="selectedOrganization"
                        :items="availableOrganizations"
                        :item-title="item => item.data?.name || item.name"
                        item-value="id"
                        :placeholder="$t('permissionDialog.searchOrganization')"
                        variant="plain"
                        density="compact"
                        hide-details
                        hide-no-data
                        class="search-input"
                        @update:model-value="addOrganizationPermission"
                    />
                    <v-autocomplete
                        v-else
                        v-model="selectedOrgGroup"
                        :items="availableOrgGroups"
                        item-title="name"
                        item-value="id"
                        :placeholder="$t('permissionDialog.searchOrgGroup')"
                        variant="plain"
                        density="compact"
                        hide-details
                        hide-no-data
                        class="search-input"
                        @update:model-value="addOrgGroupPermission"
                    />
                </div>
            </div>

            <!-- Permission List -->
            <div v-if="!isPublic" class="permission-list-section">
                <div class="section-label">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M9 11l3 3L22 4"/>
                        <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
                    </svg>
                    {{ $t('permissionDialog.permissionList') }}
                    <span class="count-badge" v-if="permissionList.length > 0">{{ permissionList.length }}</span>
                </div>

                <!-- Empty State -->
                <div v-if="permissionList.length === 0" class="empty-state">
                    <div class="empty-icon">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                            <path d="M7 11V7a5 5 0 0110 0v4"/>
                        </svg>
                    </div>
                    <p class="empty-text">{{ $t('permissionDialog.noPermissions') }}</p>
                </div>

                <!-- Permission Cards -->
                <TransitionGroup name="permission-card" tag="div" class="permission-cards">
                    <div
                        v-for="item in permissionList"
                        :key="item.id"
                        class="permission-card"
                    >
                        <div class="card-main">
                            <div class="avatar" :class="item.target_type">
                                <span v-if="item.target_type === 'user'">{{ getInitials(item.name) }}</span>
                                <svg v-else-if="item.target_type === 'organization'" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"/>
                                </svg>
                                <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 12.75c1.63 0 3.07.39 4.24.9 1.08.48 1.76 1.56 1.76 2.73V18H6v-1.61c0-1.18.68-2.26 1.76-2.73 1.17-.52 2.61-.91 4.24-.91zM4 13c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm1.13 1.1c-.37-.06-.74-.1-1.13-.1-.99 0-1.93.21-2.78.58A2.01 2.01 0 000 16.43V18h4.5v-1.61c0-.83.23-1.61.63-2.29zM20 13c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm4 3.43c0-.81-.48-1.53-1.22-1.85A6.95 6.95 0 0020 14c-.39 0-.76.04-1.13.1.4.68.63 1.46.63 2.29V18H24v-1.57zM12 6c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3z"/>
                                </svg>
                            </div>
                            <div class="card-info">
                                <span class="card-name">{{ item.name }}</span>
                                <span class="card-type" :class="item.target_type">
                                    {{ getTypeLabel(item.target_type) }}
                                </span>
                            </div>
                            <button class="delete-btn" @click="removePermission(item)">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                                </svg>
                            </button>
                        </div>
                        <div class="card-permissions">
                            <label class="permission-toggle" :class="{ active: item.readable }">
                                <input type="checkbox" v-model="item.readable">
                                <span class="toggle-indicator view"></span>
                                <span class="toggle-label">{{ $t('permissionDialog.view') }}</span>
                            </label>
                            <label class="permission-toggle" :class="{ active: item.executable }">
                                <input type="checkbox" v-model="item.executable">
                                <span class="toggle-indicator execute"></span>
                                <span class="toggle-label">{{ $t('permissionDialog.execute') }}</span>
                            </label>
                            <label class="permission-toggle" :class="{ active: item.writable }">
                                <input type="checkbox" v-model="item.writable">
                                <span class="toggle-indicator edit"></span>
                                <span class="toggle-label">{{ $t('permissionDialog.edit') || '수정' }}</span>
                            </label>
                        </div>
                    </div>
                </TransitionGroup>
            </div>
        </div>

        <!-- Footer Actions -->
        <div class="dialog-footer">
            <button class="btn-secondary" @click="close">
                {{ $t('permissionDialog.cancel') }}
            </button>
            <button class="btn-primary" @click="save" :disabled="saving">
                <span v-if="saving" class="spinner"></span>
                {{ $t('permissionDialog.save') }}
            </button>
        </div>
    </v-card>
</template>

<script>
import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();

export default {
    name: 'PermissionDialog',
    props: {
        procDef: Object,
        processMap: Object,
        metricsMap: Object
    },
    data() {
        return {
            saving: false,
            isPublic: false,
            permissionLevel: 'sub',
            targetTab: 'user',

            selectedUser: null,
            selectedOrganization: null,
            selectedOrgGroup: null,

            userList: [],
            organizationList: [],
            orgGroupList: [],

            permissionList: [],
            originalPermissions: [],
            processHierarchy: null
        };
    },
    computed: {
        scopeLevels() {
            return [
                { value: 'sub', label: this.$t('permissionDialog.levelSub'), icon: '●', disabled: false },
                { value: 'major', label: this.$t('permissionDialog.levelMajor'), icon: '◉', disabled: !this.hasMajorLevel },
                { value: 'mega', label: this.$t('permissionDialog.levelMega'), icon: '◎', disabled: !this.hasMegaLevel },
                { value: 'domain', label: this.$t('permissionDialog.levelDomain'), icon: '◈', disabled: !this.hasDomainLevel }
            ];
        },
        targetTabs() {
            return [
                { value: 'user', label: this.$t('permissionDialog.tabUser'), icon: 'UserIcon' },
                { value: 'organization', label: this.$t('permissionDialog.tabOrganization'), icon: 'OrgIcon' },
                { value: 'org_group', label: this.$t('permissionDialog.tabOrgGroup'), icon: 'GroupIcon' }
            ];
        },
        availableUsers() {
            const addedUserIds = this.permissionList
                .filter(p => p.target_type === 'user')
                .map(p => p.target_id);
            return this.userList.filter(u => !addedUserIds.includes(u.id));
        },
        availableOrganizations() {
            const addedOrgIds = this.permissionList
                .filter(p => p.target_type === 'organization')
                .map(p => p.target_id);
            return this.organizationList.filter(o => !addedOrgIds.includes(o.id));
        },
        availableOrgGroups() {
            const addedGroupIds = this.permissionList
                .filter(p => p.target_type === 'org_group')
                .map(p => p.target_id);
            return this.orgGroupList.filter(g => !addedGroupIds.includes(g.id));
        },
        hasMajorLevel() {
            return this.processHierarchy?.major !== null;
        },
        hasMegaLevel() {
            return this.processHierarchy?.mega !== null;
        },
        hasDomainLevel() {
            return this.processHierarchy?.domain !== null;
        }
    },
    async mounted() {
        await this.loadData();
        this.processHierarchy = this.findProcessHierarchy();
    },
    methods: {
        getInitials(name) {
            if (!name) return '?';
            const parts = name.split(/[\s()]+/).filter(Boolean);
            return parts[0]?.charAt(0)?.toUpperCase() || '?';
        },
        async loadData() {
            try {
                const users = await backend.getUserList();
                this.userList = users || [];

                const groups = await backend.getGroupList();
                this.organizationList = this.flattenOrganizations(groups || []);

                const orgGroups = await backend.getOrgChartGroupList();
                this.orgGroupList = orgGroups || [];

                await this.loadExistingPermissions();
            } catch (error) {
                console.error('Failed to load data:', error);
            }
        },
        flattenOrganizations(nodes, result = []) {
            for (const node of nodes) {
                if (node.id && node.data?.name) {
                    result.push({
                        id: node.id,
                        name: node.data.name,
                        data: node.data
                    });
                }
                if (node.children && node.children.length > 0) {
                    this.flattenOrganizations(node.children, result);
                }
            }
            return result;
        },
        async loadExistingPermissions() {
            try {
                const permissions = await backend.getPermissionsByProcDef(this.procDef.id);
                if (permissions && permissions.length > 0) {
                    this.originalPermissions = [...permissions];
                    this.permissionList = permissions.map(p => ({
                        id: p.id,
                        target_type: p.target_type || 'user',
                        target_id: p.user_id || p.organization_id || p.org_group_id,
                        name: this.getTargetName(p),
                        readable: p.readable,
                        executable: p.executable || false,
                        writable: p.writable || false,
                        permission_level: p.permission_level || 'sub',
                        user_id: p.user_id,
                        organization_id: p.organization_id,
                        org_group_id: p.org_group_id
                    }));

                    if (permissions.length > 0 && permissions[0].permission_level) {
                        this.permissionLevel = permissions[0].permission_level;
                    }
                }
            } catch (error) {
                console.error('Failed to load permissions:', error);
            }
        },
        getTargetName(permission) {
            if (permission.target_type === 'user' || !permission.target_type) {
                const user = this.userList.find(u => u.id === permission.user_id);
                return user ? `${user.username} (${user.email})` : permission.user_id;
            } else if (permission.target_type === 'organization') {
                const org = this.organizationList.find(o => o.id === permission.organization_id);
                return org?.name || permission.organization_id;
            } else if (permission.target_type === 'org_group') {
                const group = this.orgGroupList.find(g => g.id === permission.org_group_id);
                return group?.name || permission.org_group_id;
            }
            return 'Unknown';
        },
        findProcessHierarchy() {
            const result = { sub: this.procDef, major: null, mega: null, domain: null };
            if (!this.processMap?.mega_proc_list) return result;

            for (const mega of this.processMap.mega_proc_list) {
                if (!mega.major_proc_list) continue;

                for (const major of mega.major_proc_list) {
                    if (major.id === this.procDef.id) {
                        result.major = major;
                        result.mega = mega;
                        result.domain = major.domain || null;
                        return result;
                    }

                    if (major.sub_proc_list) {
                        const sub = major.sub_proc_list.find(s => s.id === this.procDef.id);
                        if (sub) {
                            result.sub = sub;
                            result.major = major;
                            result.mega = mega;
                            result.domain = major.domain || null;
                            return result;
                        }
                    }
                }

                if (mega.id === this.procDef.id) {
                    result.mega = mega;
                    return result;
                }
            }
            return result;
        },
        addUserPermission(userId) {
            if (!userId) return;
            const user = this.userList.find(u => u.id === userId);
            if (!user) return;

            this.permissionList.push({
                id: `${this.procDef.id}_${userId}`,
                target_type: 'user',
                target_id: userId,
                user_id: userId,
                name: `${user.username} (${user.email})`,
                readable: true,
                executable: false,
                writable: false
            });
            this.selectedUser = null;
        },
        addOrganizationPermission(orgId) {
            if (!orgId) return;
            const org = this.organizationList.find(o => o.id === orgId);
            if (!org) return;

            this.permissionList.push({
                id: `${this.procDef.id}_${orgId}`,
                target_type: 'organization',
                target_id: orgId,
                organization_id: orgId,
                name: org.name,
                readable: true,
                executable: false,
                writable: false
            });
            this.selectedOrganization = null;
        },
        addOrgGroupPermission(groupId) {
            if (!groupId) return;
            const group = this.orgGroupList.find(g => g.id === groupId);
            if (!group) return;

            this.permissionList.push({
                id: `${this.procDef.id}_${groupId}`,
                target_type: 'org_group',
                target_id: groupId,
                org_group_id: groupId,
                name: group.name,
                readable: true,
                executable: false,
                writable: false
            });
            this.selectedOrgGroup = null;
        },
        removePermission(item) {
            const index = this.permissionList.findIndex(p => p.id === item.id);
            if (index !== -1) {
                this.permissionList.splice(index, 1);
            }
        },
        getTypeLabel(type) {
            const labels = {
                user: this.$t('permissionDialog.typeUser'),
                organization: this.$t('permissionDialog.typeOrg'),
                org_group: this.$t('permissionDialog.typeGroup')
            };
            return labels[type] || type;
        },
        getProcDefIds() {
            switch (this.permissionLevel) {
                case 'domain':
                    return this.getDomainProcesses();
                case 'mega':
                    return this.processHierarchy?.mega || this.procDef;
                case 'major':
                    return this.processHierarchy?.major || this.procDef;
                case 'sub':
                default:
                    return this.procDef;
            }
        },
        getDomainProcesses() {
            const domain = this.processHierarchy?.domain;
            if (!domain || !this.processMap?.mega_proc_list) return this.procDef;

            const domainProcesses = { id: domain, name: domain, major_proc_list: [] };

            for (const mega of this.processMap.mega_proc_list) {
                if (!mega.major_proc_list) continue;
                const matchingMajors = mega.major_proc_list.filter(m => m.domain === domain);
                if (matchingMajors.length > 0) {
                    domainProcesses.major_proc_list.push(...matchingMajors);
                }
            }
            return domainProcesses;
        },
        async save() {
            this.saving = true;
            try {
                const procDefIds = this.getProcDefIds();

                for (const original of this.originalPermissions) {
                    const stillExists = this.permissionList.find(p => p.id === original.id);
                    if (!stillExists) {
                        await backend.deleteUserPermission({ match: { id: original.id } });
                    }
                }

                for (const permission of this.permissionList) {
                    const permissionData = {
                        proc_def_id: this.procDef.id,
                        proc_def_ids: procDefIds,
                        target_type: permission.target_type,
                        readable: permission.readable,
                        executable: permission.executable,
                        writable: permission.writable || false,
                        permission_level: this.permissionLevel
                    };

                    if (permission.target_type === 'user') {
                        permissionData.user_id = permission.user_id;
                    } else if (permission.target_type === 'organization') {
                        permissionData.organization_id = permission.organization_id;
                    } else if (permission.target_type === 'org_group') {
                        permissionData.org_group_id = permission.org_group_id;
                    }

                    await backend.putUserPermission(permissionData);
                }

                this.$emit('saved');
                this.close();
            } catch (error) {
                console.error('Failed to save permissions:', error);
            } finally {
                this.saving = false;
            }
        },
        close() {
            this.$emit('close:permissionDialog');
            this.reset();
        },
        reset() {
            this.isPublic = false;
            this.permissionLevel = 'sub';
            this.targetTab = 'user';
            this.selectedUser = null;
            this.selectedOrganization = null;
            this.selectedOrgGroup = null;
            this.permissionList = [];
            this.originalPermissions = [];
        }
    }
};
</script>

<style scoped>
/* Design Tokens */
.permission-dialog {
    --accent: #6366f1;
    --accent-light: #818cf8;
    --accent-dark: #4f46e5;
    --accent-subtle: rgba(99, 102, 241, 0.1);

    --success: #10b981;
    --success-subtle: rgba(16, 185, 129, 0.1);

    --warning: #f59e0b;
    --warning-subtle: rgba(245, 158, 11, 0.1);

    --danger: #ef4444;
    --danger-subtle: rgba(239, 68, 68, 0.1);

    --text-primary: #0f172a;
    --text-secondary: #475569;
    --text-muted: #94a3b8;

    --bg-primary: #ffffff;
    --bg-secondary: #f8fafc;
    --bg-tertiary: #f1f5f9;

    --border: #e2e8f0;
    --border-light: #f1f5f9;

    --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
    --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);

    --radius-sm: 6px;
    --radius-md: 10px;
    --radius-lg: 14px;
    --radius-xl: 20px;

    font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
    max-width: 560px;
    border-radius: var(--radius-xl) !important;
    overflow: hidden;
    box-shadow: var(--shadow-lg), 0 0 0 1px var(--border-light) !important;
}

/* Header */
.dialog-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px;
    background: linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-primary) 100%);
    border-bottom: 1px solid var(--border);
}

.header-content {
    display: flex;
    align-items: center;
    gap: 14px;
}

.header-icon {
    width: 44px;
    height: 44px;
    border-radius: var(--radius-md);
    background: linear-gradient(135deg, var(--accent) 0%, var(--accent-dark) 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
}

.header-text {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.dialog-title {
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0;
    letter-spacing: -0.02em;
}

.process-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--text-secondary);
}

.badge-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--accent);
    animation: pulse 2s infinite;
}

@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
}

.close-btn {
    width: 36px;
    height: 36px;
    border-radius: var(--radius-md);
    border: none;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
}

.close-btn:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
}

/* Body */
.dialog-body {
    padding: 20px 24px;
    display: flex;
    flex-direction: column;
    gap: 20px;
    max-height: 60vh;
    overflow-y: auto;
}

/* Section Label */
.section-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 12px;
}

.count-badge {
    background: var(--accent);
    color: white;
    font-size: 0.6875rem;
    font-weight: 700;
    padding: 2px 7px;
    border-radius: 10px;
    margin-left: 4px;
}

/* Scope Selector */
.scope-selector {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
}

.scope-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 12px 8px;
    border-radius: var(--radius-md);
    border: 1px solid var(--border);
    background: var(--bg-primary);
    cursor: pointer;
    transition: all 0.2s;
}

.scope-btn:hover:not(.disabled) {
    border-color: var(--accent-light);
    background: var(--accent-subtle);
}

.scope-btn.active {
    border-color: var(--accent);
    background: var(--accent-subtle);
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
}

.scope-btn.disabled {
    opacity: 0.4;
    cursor: not-allowed;
}

.scope-icon {
    font-size: 1.25rem;
    color: var(--accent);
}

.scope-label {
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--text-secondary);
    text-align: center;
    line-height: 1.3;
}

/* Public Toggle Card */
.public-toggle-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px;
    border-radius: var(--radius-lg);
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    transition: all 0.3s;
}

.public-toggle-card.active {
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(16, 185, 129, 0.05) 100%);
    border-color: var(--success);
}

.toggle-content {
    display: flex;
    align-items: center;
    gap: 12px;
}

.toggle-icon {
    width: 40px;
    height: 40px;
    border-radius: var(--radius-md);
    background: var(--bg-tertiary);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary);
    transition: all 0.3s;
}

.public-toggle-card.active .toggle-icon {
    background: var(--success-subtle);
    color: var(--success);
}

.toggle-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.toggle-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-primary);
}

.toggle-desc {
    font-size: 0.75rem;
    color: var(--text-muted);
}

/* Switch */
.switch {
    position: relative;
    width: 48px;
    height: 26px;
}

.switch input {
    opacity: 0;
    width: 0;
    height: 0;
}

.slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--border);
    transition: 0.3s;
    border-radius: 26px;
}

.slider:before {
    position: absolute;
    content: "";
    height: 20px;
    width: 20px;
    left: 3px;
    bottom: 3px;
    background: white;
    transition: 0.3s;
    border-radius: 50%;
    box-shadow: var(--shadow-sm);
}

.switch input:checked + .slider {
    background: var(--success);
}

.switch input:checked + .slider:before {
    transform: translateX(22px);
}

/* Target Tabs */
.target-tabs {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
}

.target-tab {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 10px;
    border-radius: var(--radius-md);
    border: 1px solid var(--border);
    background: var(--bg-primary);
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.2s;
}

.target-tab:hover {
    background: var(--bg-secondary);
}

.target-tab.active {
    background: var(--accent-subtle);
    border-color: var(--accent);
    color: var(--accent);
}

/* Search Container */
.search-container {
    position: relative;
    display: flex;
    align-items: center;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    transition: all 0.2s;
}

.search-container:focus-within {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.search-icon {
    padding-left: 14px;
    color: var(--text-muted);
}

.search-input {
    flex: 1;
}

.search-input :deep(.v-field) {
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
}

.search-input :deep(.v-field__input) {
    padding: 12px 14px;
    font-size: 0.875rem;
}

/* Empty State */
.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    text-align: center;
}

.empty-icon {
    color: var(--border);
    margin-bottom: 12px;
}

.empty-text {
    font-size: 0.875rem;
    color: var(--text-muted);
    margin: 0;
}

/* Permission Cards */
.permission-cards {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.permission-card {
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    overflow: hidden;
    transition: all 0.2s;
}

.permission-card:hover {
    border-color: var(--accent-light);
    box-shadow: var(--shadow-sm);
}

.card-main {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
}

.avatar {
    width: 40px;
    height: 40px;
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.875rem;
    font-weight: 700;
    color: white;
}

.avatar.user {
    background: linear-gradient(135deg, var(--accent) 0%, var(--accent-dark) 100%);
}

.avatar.organization {
    background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
}

.avatar.org_group {
    background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%);
}

.card-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.card-name {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.card-type {
    font-size: 0.6875rem;
    font-weight: 500;
    padding: 2px 8px;
    border-radius: 4px;
    width: fit-content;
}

.card-type.user {
    background: var(--accent-subtle);
    color: var(--accent);
}

.card-type.organization {
    background: rgba(59, 130, 246, 0.1);
    color: #3b82f6;
}

.card-type.org_group {
    background: rgba(139, 92, 246, 0.1);
    color: #8b5cf6;
}

.delete-btn {
    width: 32px;
    height: 32px;
    border-radius: var(--radius-sm);
    border: none;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
}

.delete-btn:hover {
    background: var(--danger-subtle);
    color: var(--danger);
}

.card-permissions {
    display: flex;
    gap: 8px;
    padding: 12px 16px;
    background: var(--bg-secondary);
    border-top: 1px solid var(--border-light);
}

.permission-toggle {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border-radius: var(--radius-sm);
    background: var(--bg-primary);
    border: 1px solid var(--border);
    cursor: pointer;
    transition: all 0.2s;
}

.permission-toggle input {
    display: none;
}

.permission-toggle:hover {
    border-color: var(--text-muted);
}

.permission-toggle.active {
    border-color: transparent;
}

.permission-toggle.active:has(.toggle-indicator.view) {
    background: var(--accent-subtle);
    border-color: var(--accent);
}

.permission-toggle.active:has(.toggle-indicator.execute) {
    background: var(--success-subtle);
    border-color: var(--success);
}

.permission-toggle.active:has(.toggle-indicator.edit) {
    background: var(--warning-subtle);
    border-color: var(--warning);
}

.toggle-indicator {
    width: 16px;
    height: 16px;
    border-radius: 4px;
    border: 2px solid var(--border);
    position: relative;
    transition: all 0.2s;
}

.permission-toggle.active .toggle-indicator {
    border-color: transparent;
}

.permission-toggle.active .toggle-indicator.view {
    background: var(--accent);
}

.permission-toggle.active .toggle-indicator.execute {
    background: var(--success);
}

.permission-toggle.active .toggle-indicator.edit {
    background: var(--warning);
}

.permission-toggle.active .toggle-indicator::after {
    content: '';
    position: absolute;
    left: 4px;
    top: 1px;
    width: 5px;
    height: 9px;
    border: solid white;
    border-width: 0 2px 2px 0;
    transform: rotate(45deg);
}

.toggle-label {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--text-secondary);
}

.permission-toggle.active .toggle-label {
    color: var(--text-primary);
}

/* Card Animations */
.permission-card-enter-active {
    animation: slideIn 0.3s ease-out;
}

.permission-card-leave-active {
    animation: slideOut 0.2s ease-in;
}

@keyframes slideIn {
    from {
        opacity: 0;
        transform: translateY(-10px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

@keyframes slideOut {
    from {
        opacity: 1;
        transform: translateX(0);
    }
    to {
        opacity: 0;
        transform: translateX(20px);
    }
}

/* Footer */
.dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    padding: 16px 24px;
    background: var(--bg-secondary);
    border-top: 1px solid var(--border);
}

.btn-secondary,
.btn-primary {
    padding: 10px 20px;
    border-radius: var(--radius-md);
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 8px;
}

.btn-secondary {
    background: var(--bg-primary);
    border: 1px solid var(--border);
    color: var(--text-secondary);
}

.btn-secondary:hover {
    background: var(--bg-tertiary);
    border-color: var(--text-muted);
}

.btn-primary {
    background: linear-gradient(135deg, var(--accent) 0%, var(--accent-dark) 100%);
    border: none;
    color: white;
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
}

.btn-primary:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(99, 102, 241, 0.4);
}

.btn-primary:disabled {
    opacity: 0.7;
    cursor: not-allowed;
    transform: none;
}

/* Spinner */
.spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

/* Scrollbar */
.dialog-body::-webkit-scrollbar {
    width: 6px;
}

.dialog-body::-webkit-scrollbar-track {
    background: transparent;
}

.dialog-body::-webkit-scrollbar-thumb {
    background: var(--border);
    border-radius: 3px;
}

.dialog-body::-webkit-scrollbar-thumb:hover {
    background: var(--text-muted);
}
</style>
