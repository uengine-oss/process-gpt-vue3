<template>
    <div class="settings-container pa-4">
        <!-- Info Banner -->
        <v-alert dense outlined type="info" color="gray" class="mb-4 pa-4 pt-2 pb-2">
            <span class="text-body-1">{{ $t('orgChartGroup.description') }}</span>
        </v-alert>
        
        <!-- Header with Add Button -->
        <div class="d-flex align-center mb-4">
            <span class="text-h6 font-weight-bold">{{ $t('orgChartGroup.title') }}</span>
            <v-spacer />
            <v-btn color="primary" rounded variant="flat" @click="openGroupDialog()">
                <v-icon size="16" class="mr-1">mdi-plus</v-icon>
                {{ $t('orgChartGroup.addGroup') }}
            </v-btn>
        </div>

        <!-- Groups List -->
        <div class="groups-container">
            <div v-if="loading" class="d-flex flex-column align-center justify-center text-grey py-16 ga-3">
                <v-progress-circular indeterminate size="32" color="primary" />
            </div>

            <div v-else-if="groups.length === 0" class="d-flex flex-column align-center justify-center text-grey py-16 ga-3">
                <v-icon size="48" color="grey-lighten-1">mdi-account-group-outline</v-icon>
                <span>{{ $t('orgChartGroup.noGroups') }}</span>
            </div>

            <div v-else class="groups-list">
                <v-card v-for="group in groups" :key="group.id" class="pa-0 mb-3" variant="outlined">
                    <div class="d-flex align-center justify-space-between pa-4">
                        <div class="d-flex align-center">
                            <v-icon size="20" color="primary" class="mr-2">mdi-account-group</v-icon>
                            <div>
                                <div class="text-subtitle-2 font-weight-bold">{{ group.name }}</div>
                                <div class="text-caption text-grey" v-if="group.description">{{ group.description }}</div>
                            </div>
                        </div>
                        <div class="d-flex align-center ga-1">
                            <v-chip size="small" color="warning" variant="tonal">
                                {{ getTeamCount(group.id) }} {{ $t('orgChartGroup.teams') }}
                            </v-chip>
                            <v-tooltip location="bottom">
                                <template v-slot:activator="{ props }">
                                    <v-btn v-bind="props" icon variant="text" class="text-medium-emphasis" density="comfortable" @click.stop="confirmDeleteGroup(group)">
                                        <v-icon color="error">mdi-delete-outline</v-icon>
                                    </v-btn>
                                </template>
                                {{ $t('common.delete') }}
                            </v-tooltip>
                            <v-tooltip location="bottom">
                                <template v-slot:activator="{ props }">
                                    <v-btn v-bind="props" icon variant="text" class="text-medium-emphasis" density="comfortable" @click.stop="openGroupDialog(group)">
                                        <v-icon>mdi-pencil</v-icon>
                                    </v-btn>
                                </template>
                                {{ $t('orgChartGroup.editGroup') }}
                            </v-tooltip>
                            <v-tooltip location="bottom">
                                <template v-slot:activator="{ props }">
                                    <v-btn v-bind="props" icon variant="text" class="text-medium-emphasis" density="comfortable" @click="openTeamSelector(group)">
                                        <v-icon size="32">mdi-plus</v-icon>
                                    </v-btn>
                                </template>
                                {{ $t('orgChartGroup.addTeam') }}
                            </v-tooltip>
                        </div>
                    </div>

                    <div class="px-4 pb-4">
                        <div class="d-flex flex-wrap ga-2">
                            <v-chip v-for="team in getGroupTeams(group.id)" :key="team.id" size="small" closable @click:close="removeTeamFromGroup(group.id, team.id)">
                                <v-icon size="14" class="mr-1">mdi-account-multiple</v-icon>
                                {{ team.team_name }}
                            </v-chip>
                            <span v-if="getGroupTeams(group.id).length === 0" class="text-caption text-grey pa-2">
                                {{ $t('orgChartGroup.noTeamsAssigned') }}
                            </span>
                        </div>
                    </div>
                </v-card>
            </div>
        </div>

        <!-- Add/Edit Group Dialog -->
        <v-dialog v-model="groupDialog" :fullscreen="isMobile" :max-width="isMobile ? '100%' : '450px'" persistent>
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
        <v-dialog v-model="teamSelectorDialog" :fullscreen="isMobile" :max-width="isMobile ? '100%' : '500px'" persistent>
            <v-card :style="isMobile ? '' : 'max-height: 600px;'" class="d-flex flex-column">
                <v-card-title class="d-flex justify-space-between pa-4 ma-0 pb-0">
                    {{ $t('orgChartGroup.selectTeams') }}
                    <v-btn variant="text" density="compact" icon @click="teamSelectorDialog = false">
                        <v-icon>mdi-close</v-icon>
                    </v-btn>
                </v-card-title>
                <v-card-text class="pa-4 pb-0 d-flex flex-column" style="overflow: hidden;">
                    <div class="d-flex align-center border border-borderColor rounded-pill px-5 mb-4 flex-shrink-0"
                        style="min-width: 160px;">
                        <Icons :icon="'magnifer-linear'" :size="20" />
                        <v-text-field
                            v-model="teamSearchQuery"
                            variant="plain"
                            density="compact"
                            class="position-relative pt-0 ml-3 custom-placeholer-color org-chart-group-search-input"
                            :placeholder="$t('orgChartGroup.searchTeams')"
                            single-line
                            hide-details
                        />
                    </div>
                    <v-list class="pa-0 border rounded flex-grow-1" style="max-height: 300px; overflow-y: auto;">
                        <v-list-item
                            v-for="team in filteredAvailableTeams"
                            :key="team.id"
                            :class="{ 'bg-blue-lighten-5': selectedTeams.includes(team.id) }"
                            @click="toggleTeamSelection(team)"
                        >
                            <template v-slot:prepend>
                                <v-icon size="18" :color="selectedTeams.includes(team.id) ? 'primary' : 'grey'">
                                    {{ selectedTeams.includes(team.id) ? 'mdi-checkbox-marked' : 'mdi-checkbox-blank-outline' }}
                                </v-icon>
                            </template>
                            <v-list-item-title>{{ team.name }}</v-list-item-title>
                        </v-list-item>
                        <div v-if="filteredAvailableTeams.length === 0" class="text-center text-grey pa-4">
                            {{ $t('orgChartGroup.noAvailableTeams') }}
                        </div>
                    </v-list>
                </v-card-text>
                <v-card-actions class="d-flex justify-end align-center pa-4">
                    <v-btn color="gray" rounded="pill" variant="flat" @click="teamSelectorDialog = false">
                        {{ $t('common.cancel') }}
                    </v-btn>
                    <v-btn color="primary" rounded variant="flat" @click="addSelectedTeams" :disabled="selectedTeams.length === 0">
                        {{ $t('orgChartGroup.addSelectedTeams') }} ({{ selectedTeams.length }})
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- Delete Confirmation Dialog -->
        <v-dialog v-model="deleteDialog" :max-width="isMobile ? '100%' : '400px'" persistent>
            <v-card>
                <v-card-title class="d-flex justify-space-between pa-4 ma-0 pb-0">
                    {{ $t('orgChartGroup.deleteGroup') }}
                    <v-btn variant="text" density="compact" icon @click="deleteDialog = false">
                        <v-icon>mdi-close</v-icon>
                    </v-btn>
                </v-card-title>
                <v-card-text class="pa-4 pb-0">
                    <p>{{ $t('orgChartGroup.deleteConfirmMessage', { name: deletingGroup?.name }) }}</p>
                </v-card-text>
                <v-card-actions class="d-flex justify-end align-center pa-4">
                    <v-btn color="gray" rounded="pill" variant="flat" @click="deleteDialog = false">
                        {{ $t('common.cancel') }}
                    </v-btn>
                    <v-btn color="error" rounded variant="flat" @click="deleteGroup">
                        {{ $t('common.delete') }}
                    </v-btn>
                </v-card-actions>
            </v-card>
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
        const isMobile = computed(() => window.innerWidth <= 768);

        // Computed
        const filteredAvailableTeams = computed(() => {
            const assignedTeamIds = getGroupTeams(selectedGroupForTeams.value?.id).map((t) => t.team_id);
            let teams = availableTeams.value.filter((t) => !assignedTeamIds.includes(t.id));

            if (teamSearchQuery.value) {
                const query = teamSearchQuery.value.toLowerCase();
                teams = teams.filter((t) => t.name.toLowerCase().includes(query));
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
                const { data, error } = await supabase.from('org_chart_group_teams').select('*');

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
                    n.children.forEach((child) => traverse(child));
                }
            };

            traverse(node);
            return teams;
        };

        const getTeamCount = (groupId) => {
            return groupTeams.value.filter((t) => t.group_id === groupId).length;
        };

        const getGroupTeams = (groupId) => {
            return groupTeams.value.filter((t) => t.group_id === groupId);
        };

        const openGroupDialog = (group = null) => {
            editingGroup.value = group;
            groupForm.value = group ? { name: group.name, description: group.description || '' } : { name: '', description: '' };
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
                    const { error } = await supabase.from('org_chart_groups').insert({
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
                const { error } = await supabase.from('org_chart_groups').delete().eq('id', deletingGroup.value.id);

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
                    .filter((t) => selectedTeams.value.includes(t.id))
                    .map((t) => ({
                        group_id: selectedGroupForTeams.value.id,
                        team_id: t.id,
                        team_name: t.name
                    }));

                const { error } = await supabase.from('org_chart_group_teams').insert(teamsToAdd);

                if (error) throw error;

                teamSelectorDialog.value = false;
                await loadGroupTeams();
            } catch (error) {
                console.error('Failed to add teams:', error);
            }
        };

        const removeTeamFromGroup = async (groupId, teamRecordId) => {
            try {
                const { error } = await supabase.from('org_chart_group_teams').delete().eq('id', teamRecordId);

                if (error) throw error;
                await loadGroupTeams();
            } catch (error) {
                console.error('Failed to remove team:', error);
            }
        };

        onMounted(async () => {
            await Promise.all([loadGroups(), loadGroupTeams(), loadAvailableTeams()]);
        });

        return {
            loading,
            groups,
            groupTeams,
            availableTeams,
            isMobile,
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

<style>
.groups-container {
    min-height: 200px;
}

.org-chart-group-search-input input {
   padding: 0px !important;
}
</style>
