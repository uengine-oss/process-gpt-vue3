<template>
    <div>
        <!-- Orchestration (top-level) -->
        <div v-if="!isSubAgentProfile" class="mt-4">
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
                :disabled="orchestrationSelectDisabled"
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

        <!-- CLI 에이전트 선택 (orchestration === 'cliagents' 일 때만) -->
        <div v-if="!isSubAgentProfile && activity.orchestration === 'cliagents'" class="mt-4">
            <div class="text-caption text-medium-emphasis mb-2">
                {{ $t('AgentSelectInfo.cliAgent.cliDescription') }}
            </div>
            <v-select
                v-model="cliAgentConfig.agent_cli"
                :items="cliAgentItems"
                item-title="title"
                item-value="value"
                :label="$t('AgentSelectInfo.cliAgent.cliTitle')"
                variant="outlined"
                density="compact"
                :hide-details="true"
                :loading="cliAgentsLoading"
                :disabled="engineConfigDisabled"
            >
                <template #item="{ item, props }">
                    <!-- 설치되지 않은 CLI 는 고를 수 없게 한다. 실행 시점에야
                         실패하는 것보다 선택 시점에 막는 편이 낫다. -->
                    <v-list-item v-bind="props" :disabled="!item.raw.installed" :title="item.raw.title">
                        <v-list-item-subtitle v-if="item.raw.hint" class="text-wrap">
                            {{ item.raw.hint }}
                        </v-list-item-subtitle>
                    </v-list-item>
                </template>
            </v-select>

            <v-text-field
                v-model="cliAgentConfig.model"
                class="mt-3"
                :label="$t('AgentSelectInfo.cliAgent.modelTitle')"
                :placeholder="$t('AgentSelectInfo.cliAgent.modelPlaceholder')"
                variant="outlined"
                density="compact"
                :hide-details="true"
                :disabled="engineConfigDisabled"
            />

            <v-select
                v-model="cliAgentConfig.permission"
                class="mt-3"
                :items="cliPermissionItems"
                item-title="title"
                item-value="value"
                :label="$t('AgentSelectInfo.cliAgent.permissionTitle')"
                variant="outlined"
                density="compact"
                :hide-details="true"
                :disabled="engineConfigDisabled"
            />
        </div>

        <!-- Orchestration-dependent configuration -->
        <div :class="isSubAgentProfile ? '' : 'mt-4'">
            <!-- 완료 수준 -->
            <div v-if="!isExecute">
                <div class="text-caption text-medium-emphasis mb-2">
                    {{ $t('BpmnPropertyPanel.agentMode') }}
                </div>
                <v-radio-group v-model="activity.agentMode" :hide-details="true" :disabled="engineConfigDisabled">
                    <v-row dense>
                        <v-col v-for="item in agentModeItems" :key="item.value" cols="6">
                            <v-radio :value="item.value" density="compact" :disabled="engineConfigDisabled">
                                <template #label>
                                    <div class="d-flex flex-column">
                                        <div class="d-flex align-center">
                                            <span class="font-weight-medium">{{ item?.titleKey ? $t(item.titleKey) : '' }}</span>
                                            <v-chip v-if="item.badge" size="x-small" class="ml-2" :color="item.badgeColor || 'primary'">
                                                {{ item.badge }}
                                            </v-chip>
                                        </div>
                                        <div v-if="item?.descKey" class="text-caption text-medium-emphasis mt-1">
                                            {{ $t(item.descKey) }}
                                        </div>
                                    </div>
                                </template>
                            </v-radio>
                        </v-col>
                    </v-row>
                </v-radio-group>
            </div>

            <!-- 미리 설정된 에이전트 사용 (+체크 시 에이전트 선택) -->
            <div v-if="!isSubAgentProfile" class="mt-4">
                <v-checkbox
                    v-model="activity.usePresetAgent"
                    density="compact"
                    :hide-details="true"
                    :label="$t('BpmnPropertyPanel.usePresetAgent')"
                    :disabled="engineConfigDisabled || activity.orchestration === 'a2a'"
                />
            </div>

            <div v-if="activity.usePresetAgent" class="mt-2">
                <user-select-field
                    ref="agentUserSelectField"
                    v-model="selectedAgent"
                    :name="$t('organizationChartDefinition.agent')"
                    :hide-details="true"
                    :return-object="true"
                    :use-agent="true"
                    :use-multiple="true"
                    :only-agent="true"
                    :allowed-agent-types="presetAllowedAgentTypes"
                    :is-execute="isExecute"
                    :disabled="engineConfigDisabled ? 'true' : 'false'"
                    :key="presetAgentUserSelectKey"
                ></user-select-field>
            </div>

            <!-- 도구/스킬 -->
            <div class="mt-4">
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
                    :disabled="engineConfigDisabled || activity.usePresetAgent"
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
                    :disabled="engineConfigDisabled || activity.usePresetAgent || activity.orchestration === 'langchain-react'"
                    :loading="toolsSkillsLoading"
                >
                    <template #item="{ item, props }">
                        <v-list-subheader v-if="item.raw?.isHeader" class="text-uppercase font-weight-medium">
                            {{ item.raw.title }}
                        </v-list-subheader>
                        <v-list-item v-else v-bind="props" :title="item.raw?.title">
                            <v-list-item-subtitle v-if="item.raw?.subtitle" class="text-truncate" style="max-width: 250px">{{
                                item.raw.subtitle
                            }}</v-list-item-subtitle>
                        </v-list-item>
                    </template>
                </v-select>
            </div>
        </div>

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

import axios from 'axios';
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
        },
        isSubAgentProfile: {
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
            // CLI 에이전트(오케스트레이션 'cliagents') 전용 설정. 하나의 오브젝트로
            // 묶어 activity.agentConfig 로 저장한다 — 워크아이템까지 그대로 실려야
            // 실행 시점에 "어떤 CLI로 돌릴지"를 알 수 있다.
            cliAgentConfig: { agent_cli: null, model: '', permission: 'workspace_write' },
            cliAgentItems: [],
            cliAgentsLoading: false,
            uploadedSkills: [],
            builtinSkills: [],
            toolsSkillsLoading: false,
            orchestrationItems: [
                {
                    titleKey: 'AgentSelectInfo.orchestration.none.title',
                    value: null,
                    descKey: ''
                },
                {
                    titleKey: 'AgentSelectInfo.orchestration.deepagents.title',
                    value: 'deepagents',
                    icon: 'playoff',
                    descKey: 'AgentSelectInfo.orchestration.deepagents.description',
                    costKey: 'AgentSelectInfo.cost.high',
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
                },
                {
                    titleKey: 'AgentSelectInfo.orchestration.langchainReact.title',
                    value: 'langchain-react',
                    icon: 'flowchart',
                    descKey: 'AgentSelectInfo.orchestration.langchainReact.description',
                    costKey: 'AgentSelectInfo.cost.low',
                    detailDesc: {
                        title: 'AgentSelectInfo.orchestration.langchainReact.detailDesc.title',
                        details: [
                            {
                                title: 'AgentSelectInfo.orchestration.langchainReact.detailDesc.details.0.title'
                            },
                            {
                                title: 'AgentSelectInfo.orchestration.langchainReact.detailDesc.details.1.title'
                            },
                            {
                                title: 'AgentSelectInfo.orchestration.langchainReact.detailDesc.details.2.title'
                            }
                        ]
                    }
                },
                {
                    titleKey: 'AgentSelectInfo.orchestration.agentToAgent.title',
                    value: 'a2a',
                    icon: 'playoff',
                    descKey: 'AgentSelectInfo.orchestration.agentToAgent.description',
                    costKey: 'AgentSelectInfo.cost.medium',
                    detailDesc: {
                        title: 'AgentSelectInfo.orchestration.agentToAgent.detailDesc.title',
                        details: [
                            {
                                title: 'AgentSelectInfo.orchestration.agentToAgent.detailDesc.details.0.title'
                            },
                            {
                                title: 'AgentSelectInfo.orchestration.agentToAgent.detailDesc.details.1.title'
                            },
                            {
                                title: 'AgentSelectInfo.orchestration.agentToAgent.detailDesc.details.2.title'
                            },
                            {
                                title: 'AgentSelectInfo.orchestration.agentToAgent.detailDesc.details.3.title'
                            }
                        ]
                    }
                },
                {
                    titleKey: 'AgentSelectInfo.orchestration.cliagents.title',
                    value: 'cliagents',
                    icon: 'flowchart',
                    descKey: 'AgentSelectInfo.orchestration.cliagents.description',
                    costKey: 'AgentSelectInfo.cost.high',
                    detailDesc: {
                        title: 'AgentSelectInfo.orchestration.cliagents.detailDesc.title',
                        details: [
                            { title: 'AgentSelectInfo.orchestration.cliagents.detailDesc.details.0.title' },
                            { title: 'AgentSelectInfo.orchestration.cliagents.detailDesc.details.1.title' },
                            { title: 'AgentSelectInfo.orchestration.cliagents.detailDesc.details.2.title' },
                            { title: 'AgentSelectInfo.orchestration.cliagents.detailDesc.details.3.title' }
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
                }
            ],

            selectedAgent: null,
            agentType: null,
            agentAlias: null,
            // true 동안의 activity.orchestration/agent 변경은 사용자 조작이 아닌 것으로 간주한다
            // (초기 props 로딩, 레인 캐스케이드로 인한 외부 갱신 등). created()에서 시작해 mounted() 이후 해제.
            suppressManualMarker: true
        };
    },
    computed: {
        cliPermissionItems() {
            return [
                { value: 'read_only', title: this.$t('AgentSelectInfo.cliAgent.permission.read_only') },
                { value: 'workspace_write', title: this.$t('AgentSelectInfo.cliAgent.permission.workspace_write') },
                { value: 'command_exec', title: this.$t('AgentSelectInfo.cliAgent.permission.command_exec') }
            ];
        },

        isSingleAgentType() {
            return this.agentType === 'pgagent' || this.agentType === 'a2a';
        },
        /** 연구 방식(오케스트레이션) 변경 불가: 단독 pgagent/a2a 담당자 모드일 때만 (단, orchestration이 a2a인 프리셋 모드는 예외) */
        orchestrationSelectDisabled() {
            if (this.agentType === 'pgagent') return true;
            if (this.agentType === 'a2a' && this.activity.orchestration !== 'a2a') return true;
            return false;
        },
        presetAllowedAgentTypes() {
            return this.activity.orchestration === 'a2a' ? ['a2a'] : ['agent'];
        },
        presetAgentUserSelectKey() {
            return `preset-agent-${this.activity.orchestration === 'a2a' ? 'a2a' : 'agent'}`;
        },
        engineConfigDisabled() {
            // orchestration이 'a2a'인 경우: 미리 설정 에이전트·완료 수준 등은 사용 가능
            if (this.activity.orchestration === 'a2a') return false;
            // isSubAgentProfile: 서브 에이전트 프로필 설정 모드(연구방식 없이 프로필·도구·스킬 구성)
            if (this.isSubAgentProfile) return this.isSingleAgentType;
            // orchestration이 '없음'(null)인 경우: 하위 영역은 노출하되 비활성화
            return this.isSingleAgentType || !this.activity.orchestration;
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
        // CLI 설정은 activity.agentConfig 로 흘려보낸다. 이 값이 프로세스 정의에
        // 저장되고, 엔진이 워크아이템의 agent_config 로 옮겨 실어야 실행 시점에
        // 어떤 CLI·모델·권한으로 돌릴지 결정할 수 있다.
        cliAgentConfig: {
            deep: true,
            handler(newVal) {
                if (this.activity.orchestration !== 'cliagents') return;
                this.activity.agentConfig = { ...newVal };
            }
        },
        modelValue: {
            deep: true,
            handler(newVal) {
                if (newVal) {
                    this.activity.agentMode = /[A-Z]/.test(newVal.agentMode) ? newVal.agentMode.toLowerCase() : newVal.agentMode;
                    this.activity.orchestration = this.isSubAgentProfile ? 'deepagents' : newVal.orchestration;
                    this.activity.agent = newVal.agent;
                    if (newVal.tools !== undefined) this.activity.tools = newVal.tools;
                    if (newVal.skills !== undefined) this.activity.skills = newVal.skills;
                    // usePresetAgent 는 사용자가 명시적으로 켠 체크 상태다.
                    // 들어온 값에 키가 없다고 해서 !!agent 로 되돌리면, 체크는 했지만
                    // 아직 에이전트를 고르지 않은 구간(agent=null)에서 체크가 스스로 풀리고
                    // 선택기가 사라져 '저장이 안 되는' 것처럼 보인다. 로컬이 이미 true 면 유지한다.
                    if (newVal.usePresetAgent !== undefined) {
                        this.activity.usePresetAgent = !!newVal.usePresetAgent;
                    } else if (!this.activity.usePresetAgent) {
                        this.activity.usePresetAgent = !!newVal.agent;
                    }
                    if (newVal.orchestration === 'a2a') {
                        this.activity.usePresetAgent = true;
                    }
                }
            }
        },
        'activity.usePresetAgent': {
            handler(newVal) {
                if (newVal) {
                    // 미리 설정된 에이전트 사용 시 도구/스킬은 불필요하므로 초기화 + (UI에서 disabled 처리)
                    this.activity.tools = [];
                    this.activity.skills = [];
                } else {
                    this.selectedAgent = null;
                    this.activity.agent = null;
                }
            }
        },
        'activity.orchestration': {
            handler(newVal, oldVal) {
                if (!this.suppressManualMarker && newVal !== oldVal) {
                    this.activity.agentAssignedFrom = 'manual';
                }
                if (newVal === 'cliagents') {
                    this.loadCliAgents();
                    this.activity.agentConfig = { ...this.cliAgentConfig };
                } else if (this.activity.agentConfig) {
                    // 다른 오케스트레이션으로 바꾸면 CLI 설정은 남기지 않는다.
                    // 남아 있으면 나중에 되돌렸을 때 지운 줄 알았던 값이 살아난다.
                    this.activity.agentConfig = null;
                }
                if (this.isSubAgentProfile) {
                    if (newVal === 'a2a') {
                        this.activity.usePresetAgent = true;
                    }
                    return;
                }
                if (newVal === 'a2a') {
                    this.activity.usePresetAgent = true;
                    if (this.selectedAgent && this.selectedAgent.length > 0) {
                        const allA2a = this.selectedAgent.every((a) => a.agentType === 'a2a');
                        if (!allA2a) {
                            this.selectedAgent = null;
                            this.activity.agent = null;
                        }
                    }
                }
                // 기본값 규칙:
                // - 오케스트레이션이 선택되면 agentMode는 기본 'draft'
                // - 오케스트레이션이 '없음'(null)이면 agentMode도 '없음'(null)
                // - 단, 담당 에이전트가 pgagent/a2a이면 예외(자동 변경하지 않음)
                if (this.isSingleAgentType && newVal !== 'a2a') return;
                if (newVal) {
                    if (!this.activity.agentMode) this.activity.agentMode = 'draft';
                } else {
                    this.activity.agentMode = null;
                    // orchestration이 '없음'이 되면 하위 값들은 초기화하고 조작도 막는다.
                    this.activity.usePresetAgent = false;
                    this.selectedAgent = null;
                    this.activity.agent = null;
                    this.activity.tools = [];
                    this.activity.skills = [];
                }
            }
        },
        selectedAgent: {
            deep: true,
            handler(newVal) {
                if (!this.suppressManualMarker) {
                    this.activity.agentAssignedFrom = 'manual';
                }
                if (newVal && newVal.length > 0) {
                    let agentIds = [];
                    newVal.forEach((agent) => {
                        this.agentType = agent.agentType;
                        this.agentAlias = agent.alias;
                        if (this.isSingleAgentType && this.activity.orchestration !== 'a2a') {
                            // 단일 에이전트 타입에서는 멀티 오케스트레이션 및 도구/스킬 사용을 비활성화한다.
                            this.activity.orchestration = this.isSubAgentProfile ? 'deepagents' : null;
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
        if (this.modelValue?.agentConfig) {
            this.cliAgentConfig = { ...this.cliAgentConfig, ...this.modelValue.agentConfig };
        }
        if (this.modelValue?.orchestration === 'cliagents') {
            this.loadCliAgents();
        }
        if (this.modelValue) {
            // agentMode가 없거나 undefined/null인 경우 기본값은 비움(null)
            if (!this.modelValue.agentMode) {
                this.activity.agentMode = null;
            } else {
                this.activity.agentMode = /[A-Z]/.test(this.modelValue.agentMode)
                    ? this.modelValue.agentMode.toLowerCase()
                    : this.modelValue.agentMode;
            }
            this.activity.orchestration = this.isSubAgentProfile ? 'deepagents' : this.modelValue.orchestration || null;
            this.activity.agent = this.modelValue.agent || null;
            this.activity.usePresetAgent =
                this.modelValue.usePresetAgent !== undefined ? !!this.modelValue.usePresetAgent : !!this.modelValue.agent;
            if (this.activity.orchestration === 'a2a') {
                this.activity.usePresetAgent = true;
            }
        } else {
            this.activity = {
                agent: null,
                agentMode: null,
                orchestration: null,
                usePresetAgent: false
            };
        }
    },
    async mounted() {
        await this.loadToolsAndSkills();
        if (this.activity.usePresetAgent && this.activity.agent && this.activity.agent !== null) {
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
        } else if (this.isSubAgentProfile && !this.activity.agentMode && !this.isSingleAgentType) {
            this.activity.agentMode = 'draft';
        }

        // 초기 로딩(props로부터의 값 복원)이 끝난 뒤부터는 orchestration/agent 변경을
        // 사용자의 직접 수정으로 간주해 agentAssignedFrom을 'manual'로 표시한다.
        this.$nextTick(() => {
            this.suppressManualMarker = false;
        });
    },
    methods: {
        async loadCliAgents() {
            if (this.cliAgentsLoading || this.cliAgentItems.length) return;
            this.cliAgentsLoading = true;
            try {
                const response = await axios.get('/process-gpt-cli-agent/agents');
                this.cliAgentItems = (response.data?.agents || []).map((agent) => ({
                    value: agent.agent_id,
                    title: agent.display_name || agent.agent_id,
                    installed: !!agent.installed,
                    // 설치/인증이 안 된 이유를 그 자리에서 보여준다. 실행을 눌러
                    // 실패 메시지로 알게 되는 것보다 낫다.
                    hint: agent.installed
                        ? agent.authenticated === false
                            ? `${this.$t('AgentSelectInfo.cliAgent.cliNotAuthenticated')}${agent.auth_hint ? ` — ${agent.auth_hint}` : ''}`
                            : ''
                        : `${this.$t('AgentSelectInfo.cliAgent.cliNotInstalled')}${agent.install_hint ? ` — ${agent.install_hint}` : ''}`
                }));
            } catch (error) {
                console.error('CLI 에이전트 가용성 조회 실패:', error);
                // 서비스가 내려가 있으면 목록을 비워 둔다. 임의로 채워 넣으면
                // 설치되지도 않은 CLI 를 고를 수 있게 된다.
                this.cliAgentItems = [];
            } finally {
                this.cliAgentsLoading = false;
            }
        },

        // 레인 캐스케이드 등 외부(사용자 조작이 아닌)에서 orchestration/agent를 갱신할 때 사용.
        // suppressManualMarker로 감싸서 이 갱신이 'manual' 마커를 붙이지 않도록 한다.
        applyExternalCascade({ orchestration, agent }) {
            this.suppressManualMarker = true;
            this.activity.orchestration = orchestration;
            this.activity.agent = agent;
            this.activity.agentAssignedFrom = 'lane-cascade';
            this.$nextTick(() => {
                this.suppressManualMarker = false;
            });
        },
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
                    typeof this.backend.getTenantBuiltinSkills === 'function' ? this.backend.getTenantBuiltinSkills() : Promise.resolve([]);

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
