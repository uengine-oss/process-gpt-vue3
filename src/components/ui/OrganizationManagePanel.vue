<template>
    <div class="organization-manage-panel">
        <v-tabs v-model="activeTab" density="compact" grow color="primary" class="org-manage-tabs">
            <v-tab value="org" class="text-none">{{ $t('organizationChartDefinition.cardTitle') }}</v-tab>
            <v-tab value="agent" class="text-none">{{ $t('organizationChartDefinition.createAgentTab') }}</v-tab>
        </v-tabs>

        <v-window v-model="activeTab">
            <!-- 조직도 관리 -->
            <v-window-item value="org">
                <OrganizationAddDialog
                    :teamInfo="teamInfo"
                    :userList="userList"
                    :organizationChart="organizationChart"
                    @addUser="(...args) => $emit('addUser', ...args)"
                    @updateTeam="(...args) => $emit('updateTeam', ...args)"
                    @closeDialog="(...args) => $emit('closeDialog', ...args)"
                />
            </v-window-item>

            <!-- 에이전트 생성 -->
            <v-window-item value="agent">
                <AgentCreateDialog :embedded="true" :teams="teams" @assignToTeam="(...args) => $emit('assignToTeam', ...args)" />
            </v-window-item>
        </v-window>
    </div>
</template>

<script>
import OrganizationAddDialog from './OrganizationAddDialog.vue';
import AgentCreateDialog from './AgentCreateDialog.vue';

export default {
    name: 'OrganizationManagePanel',
    components: {
        OrganizationAddDialog,
        AgentCreateDialog
    },
    props: {
        teamInfo: {
            type: Object,
            default: () => ({})
        },
        userList: {
            type: Array,
            default: () => []
        },
        organizationChart: {
            type: Object,
            default: () => ({})
        }
    },
    emits: ['addUser', 'updateTeam', 'closeDialog', 'assignToTeam'],
    data: () => ({
        activeTab: 'org'
    }),
    computed: {
        // '팀원으로 생성' 체크 시 선택할 팀 목록
        teams() {
            const children = this.organizationChart?.children || [];
            return children.filter((c) => c.data && c.data.isTeam).map((c) => ({ id: c.id, name: c.data.name }));
        }
    }
};
</script>
