<template>
    <v-card class="pa-4 pt-2">
        <v-row class="ma-0 pa-0 pb-2" align="center">
            <v-card-title class="pa-0">{{ $t('organizationChartDefinition.createAgentTab') }}</v-card-title>
            <v-spacer></v-spacer>
            <v-btn @click="closeAgentCreateDialog" icon variant="text" density="comfortable">
                <Icons :icon="'close'" :size="16" />
            </v-btn>
        </v-row>

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

        <v-card-text class="pa-0 pt-2 agent-create-dialog-body" :class="{ 'agent-create-dialog-body--mobile': isMobile }">
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
            <v-btn @click="saveAgent" :disabled="!isAgentValid" color="primary" rounded variant="flat">
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
    data: () => ({
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
            this.newAgent.type = this.agentSubTab;
            await this.addAgent(this.newAgent);
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
    height: calc(100vh - 300px);
    overflow: auto;
    border-bottom: 1px solid #e0e0e0;
}
.agent-create-dialog-body--mobile {
    height: calc(100vh - 150px);
}
</style>
