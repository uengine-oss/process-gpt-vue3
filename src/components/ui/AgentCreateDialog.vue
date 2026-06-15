<template>
    <v-card class="pa-4 pt-2" :flat="embedded">
        <!-- embedded(탭 내장) 모드에서는 상위 탭이 제목을 표시하므로 자체 헤더/닫기 숨김 -->
        <v-row v-if="!embedded" class="ma-0 pa-0 pb-2" align="center">
            <v-card-title class="pa-0">{{ $t('organizationChartDefinition.createAgentTab') }}</v-card-title>
            <v-spacer></v-spacer>
            <v-btn @click="closeAgentCreateDialog" icon variant="text" density="comfortable">
                <Icons :icon="'close'" :size="16" />
            </v-btn>
        </v-row>

        <!-- 단독 생성 대신 선택한 팀에 바로 추가 (탭 바로 하단) -->
        <div class="pb-2">
            <v-checkbox
                v-model="assignToTeam"
                :label="$t('organizationChartDefinition.createAsTeamMember')"
                density="compact"
                hide-details
            ></v-checkbox>
            <v-autocomplete
                v-if="assignToTeam"
                v-model="selectedTeamId"
                :items="teams"
                item-title="name"
                item-value="id"
                :label="$t('organizationChartDefinition.selectTeam')"
                variant="outlined"
                density="compact"
                prepend-inner-icon="mdi-account-group"
                hide-details
                class="mt-1"
            ></v-autocomplete>
        </div>

        <div class="px-0 pb-2" style="border-bottom: 1px solid #e0e0e0">
            <div class="d-flex flex-wrap">
                <v-btn
                    v-for="item in filteredAgentSubTabItems"
                    class="mr-2"
                    :key="item.value"
                    variant="text"
                    color="default"
                    size="x-small"
                    @click="agentSubTab = item.value"
                    :class="{ 'selected-sub-tab': agentSubTab === item.value }"
                >
                    {{ $t(item.text) }}
                </v-btn>
            </div>
        </div>

        <v-card-text
            class="pa-0 pt-2 agent-create-dialog-body"
            :class="{ 'agent-create-dialog-body--mobile': isMobile, 'agent-create-dialog-body--team': assignToTeam }"
        >
            <v-window v-model="agentSubTab">
                <v-window-item value="agent">
                    <AgentField v-model="newAgent" class="agent-field-dialog-contents" :nameRules="nameRules" :dialogReset="dialogReset" />
                </v-window-item>

                <v-window-item v-if="!gs" value="a2a">
                    <AgentField
                        v-model="newAgent"
                        class="agent-field-dialog-contents"
                        :nameRules="nameRules"
                        :type="agentSubTab"
                        :dialogReset="dialogReset"
                    />
                </v-window-item>

                <v-window-item v-if="!gs" value="pgagent">
                    <AgentField
                        v-model="newAgent"
                        class="agent-field-dialog-contents"
                        :nameRules="nameRules"
                        :type="agentSubTab"
                        :dialogReset="dialogReset"
                    />
                </v-window-item>
            </v-window>
        </v-card-text>

        <v-row class="ma-0 pt-4">
            <v-spacer></v-spacer>
            <v-btn @click="saveAgent" :disabled="!isAgentValid || (assignToTeam && !selectedTeamId)" color="primary" rounded variant="flat">
                {{ $t('organizationChartDefinition.save') }}
            </v-btn>
        </v-row>
    </v-card>
</template>

<script>
import AgentField from './field/AgentField.vue';
import AgentCrudMixin from '@/mixins/AgentCrudMixin.vue';

export default {
    name: 'AgentCreateDialog',
    components: {
        AgentField
    },
    mixins: [AgentCrudMixin],
    props: {
        // true 이면 다이얼로그가 아닌 탭 패널에 내장되어 헤더/닫기 버튼을 숨김
        embedded: {
            type: Boolean,
            default: false
        },
        // '팀원으로 생성' 체크 시 선택 가능한 팀 목록 [{ id, name }]
        teams: {
            type: Array,
            default: () => []
        }
    },
    emits: ['closeDialog', 'assignToTeam'],
    data: () => ({
        assignToTeam: false,
        selectedTeamId: null,
        agentSubTab: 'agent',
        agentSubTabItems: [
            {
                text: 'organizationChartDefinition.addNewAgent',
                value: 'agent'
            },
            {
                text: 'organizationChartDefinition.addNewA2A',
                value: 'a2a'
            },
            {
                text: 'organizationChartDefinition.addNewPGAgent',
                value: 'pgagent'
            }
        ],
        newAgent: {
            id: '',
            name: '',
            role: '',
            goal: '',
            persona: '',
            pid: '',
            img: '/images/chat-icon.png',
            isAgent: true,
            type: 'agent',
            endpoint: '',
            description: '',
            tools: '',
            alias: ''
        },
        dialogReset: false
    }),
    computed: {
        isMobile() {
            return window.innerWidth <= 768;
        },
        gs() {
            return window.$gs;
        },
        filteredAgentSubTabItems() {
            if (this.gs) {
                return this.agentSubTabItems.filter((item) => item.value === 'agent');
            }
            return this.agentSubTabItems;
        },
        nameRules() {
            return [(value) => !!value || this.$t('organizationChartDefinition.nameRequired')];
        },
        isAgentValid() {
            return this.newAgent && this.nameRules.every((rule) => rule(this.newAgent.name) === true);
        }
    },
    mounted() {
        this.EventBus.on('agentAdded', this.resetAgentCreateForm);
    },
    beforeUnmount() {
        this.EventBus.off('agentAdded', this.resetAgentCreateForm);
    },
    methods: {
        async saveAgent() {
            // addAgent 가 emit 하는 'agentAdded' payload 가 resetAgentCreateForm 로 비워지지 않도록 클론을 넘긴다
            const agentToSave = { ...this.newAgent, type: this.agentSubTab };
            const assignToTeam = this.assignToTeam;
            const teamId = this.selectedTeamId;
            if (assignToTeam && teamId) {
                agentToSave.pid = teamId;
            }
            const ok = await this.addAgent(agentToSave);
            if (ok && assignToTeam && teamId) {
                // 차트에 팀원으로 추가 + 영속화는 부모(OrganizationChartChat)가 처리
                this.$emit('assignToTeam', { agent: agentToSave, teamId });
            }
        },
        resetAgentCreateForm() {
            Object.assign(this.newAgent, {
                id: '',
                name: '',
                role: '',
                goal: '',
                persona: '',
                pid: '',
                endpoint: '',
                description: '',
                tools: '',
                alias: '',
                type: 'agent'
            });
            this.newAgent.img = '/images/chat-icon.png';
            this.newAgent.isAgent = true;
            this.assignToTeam = false;
            this.selectedTeamId = null;
            this.dialogReset = true;
            this.$nextTick(() => {
                this.dialogReset = false;
            });
        },
        closeAgentCreateDialog() {
            this.$emit('closeDialog');
        }
    }
};
</script>

<style scoped>
.selected-sub-tab {
    background: #b0b0b0 !important;
    color: white !important;
}
.agent-create-dialog-body {
    height: calc(100vh - 320px);
    overflow: auto;
    border-bottom: 1px solid #e0e0e0;
}
.agent-create-dialog-body--mobile {
    height: calc(100vh - 150px);
}
/* '팀원으로 생성' 체크 시 팀 선택 영역만큼 본문 높이 축소 */
.agent-create-dialog-body--team {
    height: calc(100vh - 370px);
}
</style>
