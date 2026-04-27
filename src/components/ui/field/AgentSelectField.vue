<template>
    <div>
        <!-- Orchestration (top-level) -->
        <div class="mt-4">
            <v-select
                v-model="activity.orchestration"
                :items="orchestrationItems"
                item-title="titleKey"
                item-value="value"
                density="compact"
                :label="$t('AgentSelectInfo.orcation')"
                variant="outlined"
                :menu-props="{ maxHeight: 600 }"
                :hide-details="true"
                clearable
                :disabled="isSingleAgentType"
            >
                <template v-slot:selection="{ item }">
                    <v-row class="ma-0 pa-0 align-center">
                        <Icons v-if="item?.raw?.icon" :icon="item.raw.icon" class="select-icon" :size="40" />
                        <div>{{ item?.raw?.titleKey ? $t(item.raw.titleKey) : '' }}</div>
                    </v-row>
                </template>
                <template v-slot:item="{ item, props }">
                    <div class="pa-2 pt-0 pb-0">
                        <v-list-item v-bind="props" :class="{ 'divider-top': item.raw.divider }">
                            <template v-if="item.raw.icon" v-slot:prepend>
                                <Icons :icon="item.raw.icon" class="select-icon" :size="48" />
                            </template>
                            <template v-slot:title>
                                <div class="d-flex align-center">
                                    <span class="font-weight-medium">{{ item?.raw?.titleKey ? $t(item.raw.titleKey) : '' }}</span>
                                    <v-chip
                                        v-if="item?.raw?.costKey"
                                        size="x-small"
                                        class="ml-2"
                                        :color="getCostColor(item.raw.costKey)"
                                        variant="outlined"
                                    >
                                        {{ $t(item.raw.costKey) }}
                                    </v-chip>

                                    <!-- 각 아이템별 상세 정보 -->
                                    <DetailComponent
                                        v-if="item?.raw?.detailDesc"
                                        class="py-2 ml-2"
                                        :title="item.raw.detailDesc?.title ? $t(item.raw.detailDesc.title) : ''"
                                        :details="item.raw.detailDesc.details"
                                    />
                                </div>
                            </template>
                            <template v-slot:subtitle>
                                <div class="text-wrap mt-1">{{ item?.raw?.descKey ? $t(item.raw.descKey) : '' }}</div>
                            </template>
                        </v-list-item>
                    </div>
                </template>
            </v-select>
        </div>

        <!-- Orchestration-dependent configuration -->
        <v-row v-if="showEngineConfig" class="mt-4" dense>
            <!-- Left: agent mode / 담당 에이전트 -->
            <v-col cols="12" md="6">
                <div v-if="!isExecute">
                    <v-select
                        v-model="activity.agentMode"
                        :items="agentModeItems"
                        item-title="titleKey"
                        item-value="value"
                        density="compact"
                        :label="$t('BpmnPropertyPanel.agentMode')"
                        variant="outlined"
                        :hide-details="true"
                    >
                        <template v-slot:selection="{ item }">
                            <span>{{ item?.raw?.icon || '' }} {{ item?.raw?.titleKey ? $t(item.raw.titleKey) : '' }}</span>
                        </template>
                        <template v-slot:item="{ item, props }">
                            <v-list-item v-bind="props">
                                <template v-slot:title>
                                    <div class="d-flex align-center">
                                        <span class="font-weight-medium">{{ item?.raw?.titleKey ? $t(item.raw.titleKey) : '' }}</span>
                                        <v-chip
                                            v-if="item.raw.badge"
                                            size="x-small"
                                            class="ml-2"
                                            :color="item.raw.badgeColor || 'primary'"
                                        >
                                            {{ item.raw.badge }}
                                        </v-chip>
                                    </div>
                                </template>
                                <template v-slot:subtitle>
                                    <div class="text-wrap mt-1">{{ item?.raw?.descKey ? $t(item.raw.descKey) : '' }}</div>
                                </template>
                            </v-list-item>
                        </template>
                    </v-select>
                </div>

                <div class="mt-4">
                    <user-select-field
                        ref="agentUserSelectField"
                        v-model="selectedAgent"
                        :name="$t('organizationChartDefinition.agent')"
                        :hide-details="true"
                        :return-object="true"
                        :use-agent="true"
                        :use-multiple="true"
                        :only-agent="true"
                        :is-execute="isExecute"
                    ></user-select-field>
                </div>
            </v-col>

            <!-- Right: tools / skills -->
            <v-col cols="12" md="6">
                <v-select
                    v-model="activity.tools"
                    :items="toolList"
                    item-title="title"
                    item-value="value"
                    :label="$t('agentField.agentTools')"
                    multiple
                    chips
                    clearable
                    closable-chips
                    variant="outlined"
                    density="compact"
                    :disabled="isSingleAgentType"
                    :loading="toolsSkillsLoading"
                >
                    <template #item="{ item, props }">
                        <v-tooltip :text="item.raw.subtitle" location="top" :disabled="!item.raw.subtitle" max-width="250">
                            <template #activator="{ props: tooltipProps }">
                                <v-list-item v-bind="{ ...props, ...tooltipProps }" :title="item.raw.title">
                                    <v-list-item-subtitle v-if="item.raw.subtitle" class="text-truncate" style="max-width: 250px">{{
                                        item.raw.subtitle
                                    }}</v-list-item-subtitle>
                                </v-list-item>
                            </template>
                        </v-tooltip>
                    </template>
                </v-select>

                <v-select
                    v-model="activity.skills"
                    :items="skillItemsForSelect"
                    item-title="title"
                    item-value="value"
                    :label="$t('agentField.agentSkills')"
                    multiple
                    chips
                    clearable
                    closable-chips
                    variant="outlined"
                    density="compact"
                    class="mt-4"
                    :disabled="isSingleAgentType"
                    :loading="toolsSkillsLoading"
                >
                    <template #item="{ item, props }">
                        <v-list-subheader v-if="item.raw?.isHeader" class="text-uppercase font-weight-medium">
                            {{ item.raw.title }}
                        </v-list-subheader>
                        <v-tooltip v-else :text="item.raw?.subtitle" location="top" :disabled="!item.raw?.subtitle" max-width="250">
                            <template #activator="{ props: tooltipProps }">
                                <v-list-item v-bind="{ ...props, ...tooltipProps }" :title="item.raw?.title">
                                    <v-list-item-subtitle v-if="item.raw?.subtitle" class="text-truncate" style="max-width: 250px">{{
                                        item.raw.subtitle
                                    }}</v-list-item-subtitle>
                                </v-list-item>
                            </template>
                        </v-tooltip>
                    </template>
                </v-select>
            </v-col>
        </v-row>

        <div v-if="isExecute" class="d-flex justify-end mt-2" style="gap: 8px">
            <!-- 기존 빠른 초안 생성 버튼 -->
            <!-- <v-btn v-if="showQuickCreate" @click="selectBasicLlmAgent" color="gray" variant="flat" density="compact" class="rounded-pill">
                {{ $t('WorkItem.quickCreate') }}
            </v-btn> -->
            <v-btn @click="selectAgent" color="primary" variant="flat" density="compact" class="rounded-pill">
                {{ $t('WorkItem.select') }}
            </v-btn>
        </div>
    </div>
</template>

<script>
import UserSelectField from '@/components/ui/field/UserSelectField.vue';
import DetailComponent from '@/components/ui-components/details/DetailComponent.vue';

import { useDefaultSetting } from '@/stores/defaultSetting';

export default {
    components: {
        UserSelectField,
        DetailComponent
    },
    props: {
        modelValue: {
            type: Object,
            required: true
        },
        backend: {
            type: Object,
            required: true
        },
        isExecute: {
            type: Boolean,
            default: false
        },
        showQuickCreate: {
            type: Boolean,
            default: false
        }
    },
    data() {
        return {
            defaultSetting: useDefaultSetting(),
            activity: this.modelValue,
            agentModeItems: [
                {
                    titleKey: 'AgentSelectInfo.agentMode.draft.title',
                    value: 'draft',
                    descKey: 'AgentSelectInfo.agentMode.draft.description'
                },
                {
                    titleKey: 'AgentSelectInfo.agentMode.complete.title',
                    value: 'complete',
                    descKey: 'AgentSelectInfo.agentMode.complete.description'
                }
            ],
            mcpTools: {},
            toolList: [],
            uploadedSkills: [],
            builtinSkills: [],
            toolsSkillsLoading: false,
            orchestrationItems: [
                {
                    titleKey: 'common.none',
                    value: null,
                    descKey: ''
                },
                {
                    titleKey: 'AgentSelectInfo.orchestration.crewaiDeepResearch.title',
                    value: 'crewai-deep-research',
                    icon: 'playoff',
                    descKey: 'AgentSelectInfo.orchestration.crewaiDeepResearch.description',
                    costKey: 'AgentSelectInfo.cost.medium',
                    detailDesc: {
                        title: 'AgentSelectInfo.orchestration.crewaiDeepResearch.detailDesc.title',
                        details: [
                            {
                                title: 'AgentSelectInfo.orchestration.crewaiDeepResearch.detailDesc.details.0.title'
                            },
                            {
                                title: 'AgentSelectInfo.orchestration.crewaiDeepResearch.detailDesc.details.1.title'
                            },
                            {
                                title: 'AgentSelectInfo.orchestration.crewaiDeepResearch.detailDesc.details.2.title'
                            }
                        ]
                    }
                },
                {
                    titleKey: 'AgentSelectInfo.orchestration.deepResearchCustom.title',
                    value: 'deep-research-custom',
                    icon: 'playoff',
                    descKey: 'AgentSelectInfo.orchestration.deepResearchCustom.description',
                    costKey: 'AgentSelectInfo.cost.medium',
                    detailDesc: {
                        title: 'AgentSelectInfo.orchestration.deepResearchCustom.detailDesc.title',
                        details: [
                            {
                                title: 'AgentSelectInfo.orchestration.deepResearchCustom.detailDesc.details.0.title'
                            },
                            {
                                title: 'AgentSelectInfo.orchestration.deepResearchCustom.detailDesc.details.1.title'
                            },
                            {
                                title: 'AgentSelectInfo.orchestration.deepResearchCustom.detailDesc.details.2.title'
                            }
                        ]
                    }
                },
                {
                    titleKey: 'AgentSelectInfo.orchestration.crewaiAction.title',
                    value: 'crewai-action',
                    icon: 'flowchart',
                    descKey: 'AgentSelectInfo.orchestration.crewaiAction.description',
                    costKey: 'AgentSelectInfo.cost.low',
                    detailDesc: {
                        title: 'AgentSelectInfo.orchestration.crewaiAction.detailDesc.title',
                        details: [
                            {
                                title: 'AgentSelectInfo.orchestration.crewaiAction.detailDesc.details.0.title'
                            },
                            {
                                title: 'AgentSelectInfo.orchestration.crewaiAction.detailDesc.details.1.title'
                            },
                            {
                                title: 'AgentSelectInfo.orchestration.crewaiAction.detailDesc.details.2.title'
                            }
                        ]
                    }
                },
                {
                    titleKey: 'AgentSelectInfo.orchestration.deepagents.title',
                    value: 'deepagents',
                    icon: 'playoff',
                    descKey: 'AgentSelectInfo.orchestration.deepagents.description',
                    costKey: 'AgentSelectInfo.cost.medium',
                    detailDesc: {
                        title: 'AgentSelectInfo.orchestration.deepagents.detailDesc.title',
                        details: [
                            {
                                title: 'AgentSelectInfo.orchestration.deepagents.detailDesc.details.0.title'
                            },
                            {
                                title: 'AgentSelectInfo.orchestration.deepagents.detailDesc.details.1.title'
                            },
                            {
                                title: 'AgentSelectInfo.orchestration.deepagents.detailDesc.details.2.title'
                            }
                        ]
                    }
                }
            ],

            selectedAgent: null,
            agentType: null,
            agentAlias: null
        };
    },
    computed: {
        isSingleAgentType() {
            return this.agentType === 'pgagent' || this.agentType === 'a2a';
        },
        showEngineConfig() {
            // pgagent/a2a 선택 시에도 하단 섹션이 "숨김"이 아니라 disable 상태로 보이도록 유지
            return this.isSingleAgentType || !!this.activity.orchestration;
        },
        skillItemsForSelect() {
            const items = [];
            if (this.uploadedSkills.length > 0) {
                items.push({ isHeader: true, title: this.$t('BpmnPropertyPanel.skillsUploaded'), value: '__header_uploaded' });
                this.uploadedSkills.forEach((s) => {
                    items.push({ title: s.name, value: s.name, subtitle: s.description || '' });
                });
            }
            if (this.builtinSkills.length > 0) {
                items.push({ isHeader: true, title: this.$t('BpmnPropertyPanel.skillsBuiltin'), value: '__header_builtin' });
                this.builtinSkills.forEach((s) => {
                    items.push({ title: s.name, value: s.name, subtitle: s.description || '' });
                });
            }
            return items;
        }
    },
    watch: {
        modelValue: {
            deep: true,
            handler(newVal) {
                if (newVal) {
                    this.activity.agentMode = /[A-Z]/.test(newVal.agentMode) ? newVal.agentMode.toLowerCase() : newVal.agentMode;
                    this.activity.orchestration = newVal.orchestration;
                    this.activity.agent = newVal.agent;
                    if (newVal.tools !== undefined) this.activity.tools = newVal.tools;
                    if (newVal.skills !== undefined) this.activity.skills = newVal.skills;
                }
            }
        },
        'activity.orchestration': {
            handler(newVal) {
                // 기본값 규칙:
                // - 오케스트레이션이 선택되면 agentMode는 기본 'draft'
                // - 오케스트레이션이 '없음'(null)이면 agentMode도 '없음'(null)
                // - 단, 담당 에이전트가 pgagent/a2a이면 예외(자동 변경하지 않음)
                if (this.isSingleAgentType) return;
                if (newVal) {
                    if (!this.activity.agentMode) this.activity.agentMode = 'draft';
                } else {
                    this.activity.agentMode = null;
                }
            }
        },
        selectedAgent: {
            deep: true,
            handler(newVal) {
                if (newVal && newVal.length > 0) {
                    let agentIds = [];
                    newVal.forEach((agent) => {
                        this.agentType = agent.agentType;
                        this.agentAlias = agent.alias;
                        if (this.isSingleAgentType) {
                            // 단일 에이전트 타입에서는 멀티 오케스트레이션 및 도구/스킬 사용을 비활성화한다.
                            this.activity.orchestration = null;
                            this.activity.tools = [];
                            this.activity.skills = [];
                        }
                        agentIds.push(agent.id);
                    });
                    this.activity.agent = agentIds.join(',');
                } else {
                    this.agentType = null;
                    this.agentAlias = null;
                    // 담당 에이전트를 비우면 activity.agent도 반드시 비워 저장되도록 동기화
                    this.activity.agent = null;
                }
            }
        },
        activity: {
            deep: true,
            handler(newVal) {
                if (newVal) {
                    if (!Array.isArray(newVal.tools)) newVal.tools = [];
                    if (!Array.isArray(newVal.skills)) newVal.skills = [];
                }
                if (!this.isExecute) {
                    this.$emit('update:modelValue', newVal);
                }
            }
        }
    },
    created() {
        if (this.modelValue) {
            // agentMode가 없거나 undefined/null인 경우 기본값은 비움(null)
            if (!this.modelValue.agentMode) {
                this.activity.agentMode = null;
            } else {
                this.activity.agentMode = /[A-Z]/.test(this.modelValue.agentMode)
                    ? this.modelValue.agentMode.toLowerCase()
                    : this.modelValue.agentMode;
            }
            this.activity.orchestration = this.modelValue.orchestration || null;
            this.activity.agent = this.modelValue.agent || null;
        } else {
            this.activity = {
                agent: null,
                agentMode: null,
                orchestration: null
            };
        }
    },
    async mounted() {
        await this.loadToolsAndSkills();
        if (this.activity.agent && this.activity.agent !== null) {
            if (this.activity.agent.includes(',')) {
                const agents = this.activity.agent.split(',');
                const selectedAgents = [];
                for (const agentId of agents) {
                    let agent = this.defaultSetting.getAgentById(agentId);
                    if (!agent) {
                        agent = await this.backend.getUserById(agentId);
                    }
                    if (agent && agent.id && agent.is_agent) {
                        selectedAgents.push({
                            ...agent,
                            id: agent.id,
                            name: agent.username,
                            isAgent: agent.is_agent,
                            agentType: agent.agent_type,
                            alias: agent.alias
                        });
                    }
                }
                this.selectedAgent = selectedAgents;
            } else {
                const agentId = this.activity.agent;
                let agent = this.defaultSetting.getAgentById(agentId);
                if (!agent) {
                    agent = await this.backend.getUserById(agentId);
                }
                if (agent && agent.id && agent.is_agent) {
                    this.selectedAgent = [
                        {
                            ...agent,
                            id: agent.id,
                            name: agent.username,
                            isAgent: agent.is_agent,
                            agentType: agent.agent_type,
                            alias: agent.alias
                        }
                    ];
                }
            }
        }

        if (this.isExecute) {
            this.activity.agentMode = 'draft';
        }
    },
    methods: {
        getCostColor(costKey) {
            if (costKey === 'AgentSelectInfo.cost.low') {
                return 'success';
            } else if (costKey === 'AgentSelectInfo.cost.medium') {
                return 'warning';
            } else if (costKey === 'AgentSelectInfo.cost.high') {
                return 'error';
            }
            return 'grey';
        },
        selectBasicLlmAgent() {
            const basicLlmAgent = this.defaultSetting.getAgentList.find(
                (agent) => agent.alias === 'default' && agent.agent_type === 'pgagent'
            );
            if (basicLlmAgent) {
                const basicLlmActivity = {
                    ...this.activity,
                    agent: basicLlmAgent.id,
                    agentMode: 'draft',
                    orchestration: basicLlmAgent.alias
                };
                this.$emit('update:modelValue', basicLlmActivity);
            }
        },
        selectAgent() {
            this.$emit('update:modelValue', this.activity);
        },
        expandAgentUserSelectField() {
            const userSelectFieldRef = this.$refs.agentUserSelectField;
            if (userSelectFieldRef && typeof userSelectFieldRef.openAgentSelectMenu === 'function') {
                userSelectFieldRef.openAgentSelectMenu();
            }
        },
        parseMcpTenantPayload(raw) {
            if (raw == null) return {};
            let data = raw;
            if (typeof data === 'string') {
                try {
                    data = JSON.parse(data);
                } catch {
                    return {};
                }
            }
            if (data && typeof data === 'object' && data.mcpServers && typeof data.mcpServers === 'object') {
                return data.mcpServers;
            }
            if (data && typeof data === 'object' && !data.mcpServers) return data;
            return {};
        },
        mcpSubtitle(config) {
            if (!config || typeof config !== 'object') return '';
            const subtitle = config.description || '';
            if (subtitle) return String(subtitle);
            if (config.command === 'npx') return 'Node.js Package';
            if (config.command === 'uvx') return 'Python Package';
            if (config.command === 'deno') return 'Deno Runtime';
            if (['url', 'sse', 'http'].includes(config.type)) return 'Web Service';
            return 'Custom Server';
        },
        normalizeSkillListResult(result) {
            const raw = result && result.skills !== undefined ? result.skills : result;
            const list = Array.isArray(raw) ? raw : raw && raw.skills;
            const arr = Array.isArray(list) ? list : [];
            return arr
                .map((s) => {
                    if (typeof s === 'string') return { name: s, description: '' };
                    return { name: s.name || s.skill_name || '', description: (s.description || '').toString() };
                })
                .filter((s) => s.name);
        },
        async loadToolsAndSkills() {
            if (!this.backend) return;
            this.toolsSkillsLoading = true;
            try {
                const mcpPromise = this.backend.getMCPByTenant ? this.backend.getMCPByTenant() : Promise.resolve(null);
                const uploadedPromise =
                    this.backend.getTenantSkills && window.$tenantName
                        ? this.backend.getTenantSkills(window.$tenantName)
                        : Promise.resolve([]);
                const builtinPromise =
                    typeof this.backend.getTenantBuiltinSkills === 'function'
                        ? this.backend.getTenantBuiltinSkills()
                        : Promise.resolve([]);

                const [mcpRaw, uploadedResult, builtinResult] = await Promise.all([mcpPromise, uploadedPromise, builtinPromise]);

                const mcpServers = this.parseMcpTenantPayload(mcpRaw);
                this.mcpTools = mcpServers || {};
                this.toolList = Object.entries(this.mcpTools).map(([name, config]) => ({
                    title: name,
                    value: name,
                    subtitle: this.mcpSubtitle(config)
                }));

                this.uploadedSkills = this.normalizeSkillListResult(uploadedResult || []);
                this.builtinSkills = this.normalizeSkillListResult(builtinResult || []);
            } catch (e) {
                // eslint-disable-next-line no-console
                console.error('[AgentSelectField] loadToolsAndSkills error', e);
                this.mcpTools = {};
                this.toolList = [];
                this.uploadedSkills = [];
                this.builtinSkills = [];
            } finally {
                this.toolsSkillsLoading = false;
            }
        }
    }
};
</script>
