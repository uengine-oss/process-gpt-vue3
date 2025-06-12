<template>
    <div class="form-user-select-field">
        <v-autocomplete v-model="localModelValue" 
            :items="usersToSelect" 
            :label="(localAlias && localAlias.length > 0) ? localAlias : localName" 
            :disabled="localDisabled"
            item-title="username" 
            :item-value="itemValue" 
            :return-object="returnObject"
            chips multiple small-chips :closable-chips="!localReadonly"
            :readonly="localReadonly"
            :variant="localReadonly ? 'filled' : 'outlined'"
            :hide-details="hideDetails"
            :density="density"
        >
            <template v-slot:chip="{ props, item }">
                <v-chip v-bind="props" :text="item.raw.username ?? item.raw.email"></v-chip>
            </template>

            <template v-slot:item="{ props, item }">
                <v-list-item v-bind="props"
                    :title="item.raw.username ?? item.raw.email" 
                    :subtitle="item.raw.email"
                ></v-list-item>
            </template>
        </v-autocomplete>
    </div>
</template>

<script>
import { commonSettingInfos } from "./CommonSettingInfos.vue"
import BackendFactory from '@/components/api/BackendFactory';
const backend = BackendFactory.createBackend();

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
                // return window.$mode === 'ProcessGPT' ? 'email' : 'id';
                return window.$mode === 'ProcessGPT' ? 'email' : undefined;
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
        }
    },

    data() {
        return {
            localModelValue: [],

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
            agentList: []
        };
    },

    watch: {
        modelValue: {
            handler() {
                if(JSON.stringify(this.localModelValue) === JSON.stringify(this.modelValue)) return
                if(this.isProcessGPT) {
                    this.localModelValue = (this.modelValue && this.modelValue.length > 0) ? this.modelValue : []
                } else {
                    if(!this.modelValue) {
                        this.localModelValue = []
                    } else if(Object.keys(this.modelValue).includes('values')) {
                        this.localModelValue = this.modelValue.values
                    } else {
                        this.localModelValue = Array.isArray(this.modelValue) ? this.modelValue : [this.modelValue]
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
        this.localModelValue = this.modelValue ?? []
        
        this.localName = this.name ?? "name"
        this.localAlias = this.alias ?? ""
        this.localDisabled = this.disabled === "true"
        this.localReadonly = this.readonly === "true"
    },
    async mounted() {
        this.userList = await backend.getUserList();
        this.agentList = await backend.getAgentList();
        if(!this.agentList) this.agentList  = []

        if(this.useAgent) {
            const list = [...this.userList, ...this.agentList];
            this.usersToSelect = list.map(member => {
                if ("username" in member) {
                    return member;
                } else {
                    return {
                        id: member.id,
                        username: member.name,
                        email: member.id
                    };
                }
            });
        } else {
            this.usersToSelect = this.userList;
        }
    }
};
</script>

<style lang="scss">
.form-user-select-field {
    margin-bottom: 16px;
}
</style>
