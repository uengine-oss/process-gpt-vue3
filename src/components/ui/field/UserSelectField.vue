<template>
    <div class="form-user-select-field">
        <v-autocomplete v-model="localModelValue" 
            :items="usersToSelect" 
            :label="(localAlias && localAlias.length > 0) ? localAlias : localName" 
            :disabled="localDisabled"
            item-title="username" 
            :item-value="itemValue" 
            :return-object="returnObject"
            chips small-chips
            :multiple="useMultiple"
            :closable-chips="!localReadonly"
            :readonly="localReadonly"
            :variant="localReadonly ? 'filled' : 'outlined'"
            :hide-details="hideDetails"
            :density="density"
            @update:model-value="handleSelectionChange"
        >
            <template v-slot:chip="{ props, item }">
                <v-chip v-bind="props" :text="item.raw.username ?? item.raw.email"></v-chip>
            </template>

            <template v-slot:item="{ props, item }">
                <v-list-item v-bind="props">
                    <template v-slot:title>
                        <div class="d-flex align-center">
                            <span class="font-weight-medium">{{ item.raw.username ?? item.raw.email }}</span>
                            <v-chip v-if="item.raw.isAgent" size="x-small" class="ml-2" color="primary" variant="outlined">
                                {{ getAgentType(item.raw.agentType) }}
                            </v-chip>
                        </div>
                    </template>
                    <template v-slot:subtitle>
                        <div v-if="!item.raw.isAgent" class="text-wrap">{{ item.raw.email }}</div>
                        <div v-else class="text-wrap">{{ item.raw.goal || item.raw.description }}</div>
                    </template>
                </v-list-item>
            </template>
        </v-autocomplete>
    </div>
</template>

<script>
import { commonSettingInfos } from "./CommonSettingInfos.vue"
import BackendFactory from '@/components/api/BackendFactory';

export default {
    name: "UserSelectField",

    props: {
        // UI 관련 설정 props 시작 
        hideDetails: {
            type: Boolean,
            default: false
        },
        density: {
            type: String,
            default: 'compact'
        },
        // UI 관련 설정 props 끝
        modelValue: Array,
        vueRenderUUID: String,
        tagName: String,

        name: String,
        alias: String,
        disabled: String,
        readonly: String,
        isProcessGPT: {
            type: Boolean,
            default() {
                return window.$mode === 'ProcessGPT' ? true : false;
            }
        },
        itemValue: {
            type: String,
            default() {
                return 'id';
                // return window.$mode === 'ProcessGPT' ? 'email' : undefined;
            }
        },
        returnObject: {
            type: Boolean,
            default() {
                return window.$mode !== 'ProcessGPT';
            }
        },
        useAgent: {
            type: Boolean,
            default: false
        },
        useMultiple: {
            type: Boolean,
            default: true
        }
    },

    data() {
        return {
            localModelValue: this.useMultiple ? [] : null,

            localName: "",
            localAlias: "",
            localDisabled: false,
            localReadonly: false,

            settingInfos: [
                commonSettingInfos["localName"],
                commonSettingInfos["localAlias"],
                commonSettingInfos["localDisabled"],
                commonSettingInfos["localReadonly"]
            ],

            usersToSelect: [],
            userList: [],

            backend: null,
        };
    },

    watch: {
        modelValue: {
            handler() {
                if(JSON.stringify(this.localModelValue) === JSON.stringify(this.modelValue)) return
                if(this.isProcessGPT) {
                    if (this.useMultiple) {
                        this.localModelValue = (this.modelValue && this.modelValue.length > 0) ? this.modelValue : []
                    } else {
                        this.localModelValue = this.modelValue || null
                    }
                } else {
                    if(!this.modelValue) {
                        this.localModelValue = this.useMultiple ? [] : null
                    } else if(Object.keys(this.modelValue).includes('values')) {
                        this.localModelValue = this.modelValue.values
                    } else {
                        if (this.useMultiple) {
                            this.localModelValue = Array.isArray(this.modelValue) ? this.modelValue : [this.modelValue]
                        } else {
                            this.localModelValue = Array.isArray(this.modelValue) ? this.modelValue[0] : this.modelValue
                        }
                    }
                }
            },
            deep: true,
            immediate: true
        },

        localModelValue: {
            handler() {
                if(JSON.stringify(this.localModelValue) === JSON.stringify(this.modelValue)) return
                this.$emit('update:modelValue', this.localModelValue)
            },
            deep: true,
            immediate: true
        }
    },
    created() {
        this.localModelValue = this.modelValue ?? (this.useMultiple ? [] : null)
        
        this.localName = this.name ?? "name"
        this.localAlias = this.alias ?? ""
        this.localDisabled = this.disabled === "true"
        this.localReadonly = this.readonly === "true"
    },
    async mounted() {
        this.backend = BackendFactory.createBackend();

        this.userList = await this.backend.getUserList();

        if(this.useAgent) {
            if (this.useMultiple) {
                // 모든 유저를 선택 목록에 포함
                this.usersToSelect = this.userList.map(member => {
                    return {
                        id: member.id,
                        username: member.username,
                        email: member.email,
                        goal: member.goal,
                        description: member.description,
                        isAgent: member.is_agent,
                        agentType: member.agent_type,
                    };
                });
            } else {
                const agentList = this.userList.filter(member => member.is_agent);
                this.usersToSelect = agentList.map(agent => {
                    return {
                        id: agent.id,
                        username: agent.username,
                        email: agent.email,
                        goal: agent.goal,
                        description: agent.description,
                        isAgent: agent.is_agent,
                        agentType: agent.agent_type,
                    };
                });
            }
        } else {
            this.usersToSelect = this.userList.filter(member => !member.is_agent);
        }
    },

    methods: {
        handleSelectionChange(newValue) {
            if (!this.useAgent || !this.useMultiple) {
                return;
            }

            // 선택된 값들 중 isAgent가 false인 유저가 2개 이상인지 확인
            const nonAgentUsers = newValue.filter(user => {
                const userData = this.returnObject ? user : this.usersToSelect.find(u => u[this.itemValue] === user);
                return userData && !userData.isAgent;
            });

            if (nonAgentUsers.length > 1) {
                // isAgent가 false인 유저가 2개 이상이면 마지막 선택된 것만 유지
                const lastNonAgentUser = nonAgentUsers[nonAgentUsers.length - 1];
                const agentUsers = newValue.filter(user => {
                    const userData = this.returnObject ? user : this.usersToSelect.find(u => u[this.itemValue] === user);
                    return userData && userData.isAgent;
                });
                
                this.localModelValue = [...agentUsers, lastNonAgentUser];
            } else {
                this.localModelValue = newValue;
            }
        },

        getAgentType(agentType) {
            switch (agentType) {
                case 'agent':
                    return 'Agent';
                case 'a2a':
                    return 'A2A';
                case 'pgagent':
                    return 'ProcessGPT Agent';
                default:
                    return 'Agent';
            }
        }
    }
};
</script>

<style lang="scss">
.form-user-select-field {
    margin-bottom: 16px;
}
</style>
