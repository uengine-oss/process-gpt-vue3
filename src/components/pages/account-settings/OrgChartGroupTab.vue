<template>
    <div class="settings-container pa-4">
        <!-- Info Banner -->
        <div class="info-banner">
            <v-icon size="18" color="primary">mdi-information-outline</v-icon>
            <span>{{ $t('orgChartGroup.description') }}</span>
        </div>

        <!-- Header with Add Button -->
        <div class="section-header">
            <span class="section-title">{{ $t('orgChartGroup.title') }}</span>
            <v-btn color="primary" rounded variant="flat" @click="openGroupDialog()">
                <v-icon size="16" class="mr-1">mdi-plus</v-icon>
                {{ $t('orgChartGroup.addGroup') }}
            </v-btn>
        </div>

        <!-- Groups List -->
        <div class="groups-container">
            <div v-if="loading" class="loading-state">
                <v-progress-circular indeterminate size="32" color="primary" />
            </div>

            <div v-else-if="groups.length === 0" class="empty-state">
                <v-icon size="48" color="grey-lighten-1">mdi-account-group-outline</v-icon>
                <span>{{ $t('orgChartGroup.noGroups') }}</span>
            </div>

            <div v-else class="groups-list">
                <div
                    v-for="group in groups"
                    :key="group.id"
                    class="group-card"
                    :class="{ expanded: expandedGroupId === group.id }"
                >
                    <div class="group-header" @click="toggleGroup(group.id)">
                        <div class="group-info">
                            <v-icon size="20" color="primary" class="mr-2">mdi-account-group</v-icon>
                            <div>
                                <div class="group-name">{{ group.name }}</div>
                                <div class="group-desc" v-if="group.description">{{ group.description }}</div>
                            </div>
                        </div>
                        <div class="group-actions">
                            <span class="team-count">{{ getTeamCount(group.id) }} {{ $t('orgChartGroup.teams') }}</span>
                            <button class="action-btn action-edit" @click.stop="openGroupDialog(group)">
                                <v-icon size="16">mdi-pencil</v-icon>
                            </button>
                            <button class="action-btn action-delete" @click.stop="confirmDeleteGroup(group)">
                                <v-icon size="16">mdi-delete</v-icon>
                            </button>
                            <v-icon size="20" class="expand-icon">
                                {{ expandedGroupId === group.id ? 'mdi-chevron-up' : 'mdi-chevron-down' }}
                            </v-icon>
                        </div>
                    </div>

                    <!-- Expanded Team List -->
                    <v-expand-transition>
                        <div v-show="expandedGroupId === group.id" class="teams-section">
                            <div class="teams-header">
                                <span class="teams-title">{{ $t('orgChartGroup.assignedTeams') }}</span>
                                <button class="add-team-btn" @click="openTeamSelector(group)">
                                    <v-icon size="14">mdi-plus</v-icon>
                                    {{ $t('orgChartGroup.addTeam') }}
                                </button>
                            </div>
                            <div class="teams-list">
                                <div
                                    v-for="team in getGroupTeams(group.id)"
                                    :key="team.id"
                                    class="team-chip"
                                >
                                    <v-icon size="14" class="mr-1">mdi-account-multiple</v-icon>
                                    {{ team.team_name }}
                                    <button class="chip-remove" @click="removeTeamFromGroup(group.id, team.id)">
                                        <v-icon size="12">mdi-close</v-icon>
                                    </button>
                                </div>
                                <div v-if="getGroupTeams(group.id).length === 0" class="no-teams">
                                    {{ $t('orgChartGroup.noTeamsAssigned') }}
                                </div>
                            </div>
                        </div>
                    </v-expand-transition>
                </div>
            </div>
        </div>

        <!-- Add/Edit Group Dialog -->
        <v-dialog v-model="groupDialog" max-width="450" persistent>
            <v-card>
                <v-card-title class="d-flex justify-space-between pa-4 ma-0 pb-0">
                    {{ editingGroup ? $t('orgChartGroup.editGroup') : $t('orgChartGroup.addGroup') }}
                    <v-btn variant="text" density="compact" icon @click="groupDialog = false">
                        <v-icon>mdi-close</v-icon>
                    </v-btn>
                </v-card-title>
                <v-card-text class="pa-4 pb-0">
                    <v-text-field
                        v-model="groupForm.name"
                        :label="$t('orgChartGroup.groupName') + ' *'"
                        :placeholder="$t('orgChartGroup.groupNamePlaceholder')"
                        variant="outlined"
                    />
                    <v-textarea
                        v-model="groupForm.description"
                        :label="$t('orgChartGroup.groupDescription')"
                        :placeholder="$t('orgChartGroup.groupDescriptionPlaceholder')"
                        variant="outlined"
                        rows="3"
                    />
                </v-card-text>
                <v-card-actions class="d-flex justify-end align-center pa-4">
                    <v-btn color="primary" rounded variant="flat" @click="saveGroup" :disabled="!groupForm.name">
                        {{ $t('common.save') }}
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- Team Selector Dialog -->
        <v-dialog v-model="teamSelectorDialog" max-width="500">
            <div class="dialog-card">
                <div class="dialog-header">
                    <span>{{ $t('orgChartGroup.selectTeams') }}</span>
                    <button class="dialog-close" @click="teamSelectorDialog = false">
                        <v-icon size="18">mdi-close</v-icon>
                    </button>
                </div>
                <div class="dialog-content">
                    <div class="search-field">
                        <v-icon size="18" color="grey">mdi-magnify</v-icon>
                        <input
                            v-model="teamSearchQuery"
                            type="text"
                            :placeholder="$t('orgChartGroup.searchTeams')"
                            class="flat-input"
                        />
                    </div>
                    <div class="team-selector-list">
                        <div
                            v-for="team in filteredAvailableTeams"
                            :key="team.id"
                            class="team-selector-item"
                            :class="{ selected: selectedTeams.includes(team.id) }"
                            @click="toggleTeamSelection(team)"
                        >
                            <v-icon size="18" class="mr-2">
                                {{ selectedTeams.includes(team.id) ? 'mdi-checkbox-marked' : 'mdi-checkbox-blank-outline' }}
                            </v-icon>
                            <span>{{ team.name }}</span>
                        </div>
                        <div v-if="filteredAvailableTeams.length === 0" class="no-teams">
                            {{ $t('orgChartGroup.noAvailableTeams') }}
                        </div>
                    </div>
                </div>
                <div class="dialog-actions">
                    <button class="btn-cancel" @click="teamSelectorDialog = false">
                        {{ $t('common.cancel') }}
                    </button>
                    <button class="btn-save" @click="addSelectedTeams" :disabled="selectedTeams.length === 0">
                        {{ $t('orgChartGroup.addSelectedTeams') }} ({{ selectedTeams.length }})
                    </button>
                </div>
            </div>
        </v-dialog>

        <!-- Delete Confirmation Dialog -->
        <v-dialog v-model="deleteDialog" max-width="400">
            <div class="dialog-card">
                <div class="dialog-header">
                    <span>{{ $t('orgChartGroup.confirmDelete') }}</span>
                    <button class="dialog-close" @click="deleteDialog = false">
                        <v-icon size="18">mdi-close</v-icon>
                    </button>
                </div>
                <div class="dialog-content">
                    <p>{{ $t('orgChartGroup.deleteConfirmMessage', { name: deletingGroup?.name }) }}</p>
                </div>
                <div class="dialog-actions">
                    <button class="btn-cancel" @click="deleteDialog = false">
                        {{ $t('common.cancel') }}
                    </button>
                    <button class="btn-delete" @click="deleteGroup">
                        {{ $t('common.delete') }}
                    </button>
                </div>
            </div>
        </v-dialog>
    </div>
</template>

<script>
import { defineComponent, ref, computed, onMounted } from 'vue';

export default defineComponent({
    name: 'OrgChartGroupTab',
    setup() {
        const loading = ref(true);
        const groups = ref([]);
        const groupTeams = ref([]);
        const availableTeams = ref([]);
        const expandedGroupId = ref(null);

        // Dialog states
        const groupDialog = ref(false);
        const teamSelectorDialog = ref(false);
        const deleteDialog = ref(false);
        const editingGroup = ref(null);
        const deletingGroup = ref(null);
        const selectedGroupForTeams = ref(null);

        // Form data
        const groupForm = ref({
            name: '',
            description: ''
        });

        // Team selection
        const teamSearchQuery = ref('');
        const selectedTeams = ref([]);

        const supabase = window.$supabase;

        // Computed
        const filteredAvailableTeams = computed(() => {
            const assignedTeamIds = getGroupTeams(selectedGroupForTeams.value?.id).map(t => t.team_id);
            let teams = availableTeams.value.filter(t => !assignedTeamIds.includes(t.id));

            if (teamSearchQuery.value) {
                const query = teamSearchQuery.value.toLowerCase();
                teams = teams.filter(t => t.name.toLowerCase().includes(query));
            }

            return teams;
        });

        // Methods
        const loadGroups = async () => {
            try {
                loading.value = true;
                const tenantId = window.$tenantName || 'default';
                const { data, error } = await supabase
                    .from('org_chart_groups')
                    .select('*')
                    .eq('tenant_id', tenantId)
                    .order('created_at', { ascending: false });

                if (error) throw error;
                groups.value = data || [];
            } catch (error) {
                console.error('Failed to load groups:', error);
            } finally {
                loading.value = false;
            }
        };

        const loadGroupTeams = async () => {
            try {
                const { data, error } = await supabase
                    .from('org_chart_group_teams')
                    .select('*');

                if (error) throw error;
                groupTeams.value = data || [];
            } catch (error) {
                console.error('Failed to load group teams:', error);
            }
        };

        const loadAvailableTeams = async () => {
            try {
                // Load teams from organization chart configuration
                const tenantId = window.$tenantName || 'default';
                const { data, error } = await supabase
                    .from('configuration')
                    .select('value')
                    .eq('key', 'organization')
                    .eq('tenant_id', tenantId)
                    .single();

                if (error && error.code !== 'PGRST116') throw error;

                if (data?.value) {
                    const orgData = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
                    // organization 데이터 구조: { chart: { id, data, children } }
                    const orgChart = orgData.chart || orgData;
                    availableTeams.value = extractTeamsFromOrgChart(orgChart);
                }
            } catch (error) {
                console.error('Failed to load available teams:', error);
            }
        };

        const extractTeamsFromOrgChart = (node) => {
            const teams = [];

            const traverse = (n) => {
                if (!n) return;

                if (n.data?.isTeam) {
                    teams.push({
                        id: n.id,
                        name: n.data.name || n.id
                    });
                }

                if (n.children) {
                    n.children.forEach(child => traverse(child));
                }
            };

            traverse(node);
            return teams;
        };

        const getTeamCount = (groupId) => {
            return groupTeams.value.filter(t => t.group_id === groupId).length;
        };

        const getGroupTeams = (groupId) => {
            return groupTeams.value.filter(t => t.group_id === groupId);
        };

        const toggleGroup = (groupId) => {
            expandedGroupId.value = expandedGroupId.value === groupId ? null : groupId;
        };

        const openGroupDialog = (group = null) => {
            editingGroup.value = group;
            groupForm.value = group
                ? { name: group.name, description: group.description || '' }
                : { name: '', description: '' };
            groupDialog.value = true;
        };

        const saveGroup = async () => {
            try {
                if (editingGroup.value) {
                    const { error } = await supabase
                        .from('org_chart_groups')
                        .update({
                            name: groupForm.value.name,
                            description: groupForm.value.description,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', editingGroup.value.id);

                    if (error) throw error;
                } else {
                    const { error } = await supabase
                        .from('org_chart_groups')
                        .insert({
                            name: groupForm.value.name,
                            description: groupForm.value.description,
                            tenant_id: window.$tenantName || 'default'
                        });

                    if (error) throw error;
                }

                groupDialog.value = false;
                await loadGroups();
            } catch (error) {
                console.error('Failed to save group:', error);
            }
        };

        const confirmDeleteGroup = (group) => {
            deletingGroup.value = group;
            deleteDialog.value = true;
        };

        const deleteGroup = async () => {
            try {
                const { error } = await supabase
                    .from('org_chart_groups')
                    .delete()
                    .eq('id', deletingGroup.value.id);

                if (error) throw error;

                deleteDialog.value = false;
                await loadGroups();
                await loadGroupTeams();
            } catch (error) {
                console.error('Failed to delete group:', error);
            }
        };

        const openTeamSelector = (group) => {
            selectedGroupForTeams.value = group;
            selectedTeams.value = [];
            teamSearchQuery.value = '';
            teamSelectorDialog.value = true;
        };

        const toggleTeamSelection = (team) => {
            const idx = selectedTeams.value.indexOf(team.id);
            if (idx > -1) {
                selectedTeams.value.splice(idx, 1);
            } else {
                selectedTeams.value.push(team.id);
            }
        };

        const addSelectedTeams = async () => {
            try {
                const teamsToAdd = availableTeams.value
                    .filter(t => selectedTeams.value.includes(t.id))
                    .map(t => ({
                        group_id: selectedGroupForTeams.value.id,
                        team_id: t.id,
                        team_name: t.name
                    }));

                const { error } = await supabase
                    .from('org_chart_group_teams')
                    .insert(teamsToAdd);

                if (error) throw error;

                teamSelectorDialog.value = false;
                await loadGroupTeams();
            } catch (error) {
                console.error('Failed to add teams:', error);
            }
        };

        const removeTeamFromGroup = async (groupId, teamRecordId) => {
            try {
                const { error } = await supabase
                    .from('org_chart_group_teams')
                    .delete()
                    .eq('id', teamRecordId);

                if (error) throw error;
                await loadGroupTeams();
            } catch (error) {
                console.error('Failed to remove team:', error);
            }
        };

        onMounted(async () => {
            await Promise.all([
                loadGroups(),
                loadGroupTeams(),
                loadAvailableTeams()
            ]);
        });

        return {
            loading,
            groups,
            groupTeams,
            availableTeams,
            expandedGroupId,
            groupDialog,
            teamSelectorDialog,
            deleteDialog,
            editingGroup,
            deletingGroup,
            groupForm,
            teamSearchQuery,
            selectedTeams,
            filteredAvailableTeams,
            getTeamCount,
            getGroupTeams,
            toggleGroup,
            openGroupDialog,
            saveGroup,
            confirmDeleteGroup,
            deleteGroup,
            openTeamSelector,
            toggleTeamSelection,
            addSelectedTeams,
            removeTeamFromGroup
        };
    }
});
</script>

<style scoped>

/* Info Banner */
.info-banner {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    background: #eff6ff;
    border: 1px solid #dbeafe;
    border-radius: 8px;
    margin-bottom: 20px;
    font-size: 13px;
    color: #1e40af;
}

/* Section Header */
.section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
}

.section-title {
    font-size: 16px;
    font-weight: 600;
    color: #1f2937;
}

.add-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.15s ease;
}

.add-btn:hover {
    background: #2563eb;
}

/* Groups Container */
.groups-container {
    min-height: 200px;
}

.loading-state,
.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 20px;
    gap: 12px;
    color: #9ca3af;
    font-size: 14px;
}

/* Group Card */
.group-card {
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    margin-bottom: 12px;
    background: #ffffff;
    transition: border-color 0.2s ease;
}

.group-card:hover {
    border-color: #d1d5db;
}

.group-card.expanded {
    border-color: #3b82f6;
}

.group-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px;
    cursor: pointer;
}

.group-info {
    display: flex;
    align-items: center;
}

.group-name {
    font-size: 14px;
    font-weight: 600;
    color: #1f2937;
}

.group-desc {
    font-size: 12px;
    color: #6b7280;
    margin-top: 2px;
}

.group-actions {
    display: flex;
    align-items: center;
    gap: 8px;
}

.team-count {
    font-size: 12px;
    color: #6b7280;
    background: #f3f4f6;
    padding: 4px 8px;
    border-radius: 4px;
}

.expand-icon {
    color: #9ca3af;
}

/* Teams Section */
.teams-section {
    border-top: 1px solid #f3f4f6;
    padding: 16px;
    background: #fafafa;
}

.teams-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
}

.teams-title {
    font-size: 13px;
    font-weight: 600;
    color: #374151;
}

.add-team-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 4px;
    font-size: 12px;
    color: #6b7280;
    cursor: pointer;
    transition: all 0.15s ease;
}

.add-team-btn:hover {
    border-color: #3b82f6;
    color: #3b82f6;
}

.teams-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.team-chip {
    display: flex;
    align-items: center;
    padding: 6px 10px;
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 16px;
    font-size: 12px;
    color: #374151;
}

.chip-remove {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    margin-left: 6px;
    background: transparent;
    border: none;
    border-radius: 50%;
    color: #9ca3af;
    cursor: pointer;
    transition: all 0.15s ease;
}

.chip-remove:hover {
    background: #fef2f2;
    color: #ef4444;
}

.no-teams {
    font-size: 13px;
    color: #9ca3af;
    padding: 8px 0;
}

/* Action Buttons */
.action-btn {
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 6px;
    background: transparent;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background-color 0.15s ease;
}

.action-btn:hover {
    background-color: #f3f4f6;
}

.action-edit {
    color: #6b7280;
}

.action-edit:hover {
    color: #3b82f6;
    background-color: #eff6ff;
}

.action-delete {
    color: #9ca3af;
}

.action-delete:hover {
    color: #ef4444;
    background-color: #fef2f2;
}

/* Dialog */
.dialog-card {
    background: #ffffff;
    border-radius: 12px;
    overflow: hidden;
}

.dialog-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid #f3f4f6;
    font-size: 16px;
    font-weight: 600;
    color: #1f2937;
}

.dialog-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: #9ca3af;
    cursor: pointer;
    transition: all 0.15s ease;
}

.dialog-close:hover {
    background: #f3f4f6;
    color: #6b7280;
}

.dialog-content {
    padding: 20px;
}

.dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 16px 20px;
    border-top: 1px solid #f3f4f6;
    background: #fafafa;
}

/* Form Fields */
.form-field {
    margin-bottom: 16px;
}

.form-field:last-child {
    margin-bottom: 0;
}

.form-field label {
    display: block;
    font-size: 13px;
    font-weight: 500;
    color: #374151;
    margin-bottom: 6px;
}

.flat-input {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    font-size: 14px;
    color: #1f2937;
    transition: border-color 0.15s ease;
}

.flat-input:focus {
    outline: none;
    border-color: #3b82f6;
}

.flat-textarea {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    font-size: 14px;
    color: #1f2937;
    resize: vertical;
    transition: border-color 0.15s ease;
}

.flat-textarea:focus {
    outline: none;
    border-color: #3b82f6;
}

/* Search Field */
.search-field {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    margin-bottom: 16px;
}

.search-field .flat-input {
    flex: 1;
    border: none;
    padding: 0;
    background: transparent;
}

.search-field .flat-input:focus {
    outline: none;
}

/* Team Selector */
.team-selector-list {
    max-height: 300px;
    overflow-y: auto;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
}

.team-selector-item {
    display: flex;
    align-items: center;
    padding: 12px;
    cursor: pointer;
    border-bottom: 1px solid #f3f4f6;
    transition: background-color 0.15s ease;
}

.team-selector-item:last-child {
    border-bottom: none;
}

.team-selector-item:hover {
    background: #f9fafb;
}

.team-selector-item.selected {
    background: #eff6ff;
}

.team-selector-item .v-icon {
    color: #9ca3af;
}

.team-selector-item.selected .v-icon {
    color: #3b82f6;
}

/* Buttons */
.btn-cancel {
    padding: 8px 16px;
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    color: #6b7280;
    cursor: pointer;
    transition: all 0.15s ease;
}

.btn-cancel:hover {
    background: #f9fafb;
}

.btn-save {
    padding: 8px 16px;
    background: #3b82f6;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    color: white;
    cursor: pointer;
    transition: background-color 0.15s ease;
}

.btn-save:hover:not(:disabled) {
    background: #2563eb;
}

.btn-save:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.btn-delete {
    padding: 8px 16px;
    background: #ef4444;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    color: white;
    cursor: pointer;
    transition: background-color 0.15s ease;
}

.btn-delete:hover {
    background: #dc2626;
}
</style>
